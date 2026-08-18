// server/utils/validasi-jurnal.ts
// Pemeriksaan isi, wewenang, dan perpindahan status jurnal. Dipakai bersama oleh
// seluruh endpoint jurnal — admin maupun member — supaya tidak ada dua tempat yang
// menegakkan aturan yang berbeda.

import { and, eq, ne } from 'drizzle-orm'
import { db } from '../db'
import {
  ccJurnal,
  ccUser,
  JURNAL_STATUS,
  JURNAL_TIPE,
  ROLE_LEVELS,
  type DBJurnal,
  type JurnalStatus,
  type JurnalTipe,
  type UserRole,
} from '../db/schema'
import { slugify } from './randomId'
import { bersihkanHtml } from './html'

const salah = (pesan: string) => createError({ statusCode: 400, statusMessage: pesan })
const ditolak = (pesan: string) => createError({ statusCode: 403, statusMessage: pesan })

/** Bentuk minimum pengakses yang dibutuhkan aturan di bawah. */
export interface Pengakses {
  id: string
  role: UserRole
}

export const levelDari = (p: Pengakses) => ROLE_LEVELS[p.role]

/**
 * Slug unik. Bentrokan diselesaikan dengan akhiran angka, bukan ditolak — dua
 * tulisan boleh berjudul sama, dan penulisnya tidak perlu tahu bahwa judul itu
 * pernah dipakai orang lain dua tahun lalu.
 */
export const slugJurnalUnik = (judul: string, abaikanId?: string) => {
  const dasar = slugify(judul) || 'jurnal'
  let kandidat = dasar
  for (let i = 2; i < 100; i++) {
    const ada = db
      .select({ id: ccJurnal.id })
      .from(ccJurnal)
      .where(abaikanId
        ? and(eq(ccJurnal.slug, kandidat), ne(ccJurnal.id, abaikanId))
        : eq(ccJurnal.slug, kandidat))
      .get()
    if (!ada) return kandidat
    kandidat = `${dasar}-${i}`
  }
  throw salah('Tidak bisa menyusun slug unik untuk judul ini')
}

const teks = (nilai: unknown, maks: number, nama: string): string | null => {
  if (nilai === null || nilai === undefined) return null
  if (typeof nilai !== 'string') throw salah(`${nama} harus berupa teks`)
  const bersih = nilai.trim()
  if (!bersih) return null
  if (bersih.length > maks) throw salah(`${nama} maksimal ${maks} karakter`)
  return bersih
}

export interface BodyJurnal {
  judul?: string
  judulEn?: string | null
  ringkasan?: string | null
  ringkasanEn?: string | null
  isi?: string | null
  isiEn?: string | null
  tipe?: JurnalTipe | null
  kontributor?: string
  kontributorPeran?: string | null
  userId?: string | null
  kegiatanId?: string | null
  coverMediaId?: string | null
  editorId?: string | null
}

/**
 * Normalkan body menjadi kolom yang siap ditulis.
 *
 * `sebagian: true` untuk PATCH — kolom yang tidak dikirim tidak disentuh, sehingga
 * autosave bisa mengirim satu kolom saja tanpa mengosongkan sisanya.
 */
export const bacaBodyJurnal = (body: BodyJurnal, sebagian = false) => {
  const hasil: Record<string, unknown> = {}

  if (!sebagian || body.judul !== undefined) {
    const judul = teks(body.judul, 300, 'Judul')
    if (!judul) throw salah('Judul jurnal wajib diisi')
    hasil.judul = judul
  }

  if (!sebagian || body.kontributor !== undefined) {
    const kontributor = teks(body.kontributor, 200, 'Nama penulis')
    if (!kontributor) throw salah('Nama penulis wajib diisi')
    hasil.kontributor = kontributor
  }

  if (body.judulEn !== undefined) hasil.judulEn = teks(body.judulEn, 300, 'Judul (EN)')
  if (body.kontributorPeran !== undefined) {
    hasil.kontributorPeran = teks(body.kontributorPeran, 200, 'Peran penulis')
  }

  // Ringkasan dibersihkan sebagai teks, bukan HTML: ia dipakai di kartu daftar dan
  // di meta description, dua tempat yang tidak pernah menggambar tag.
  if (body.ringkasan !== undefined) hasil.ringkasan = teks(body.ringkasan, 600, 'Ringkasan')
  if (body.ringkasanEn !== undefined) hasil.ringkasanEn = teks(body.ringkasanEn, 600, 'Ringkasan (EN)')

  // Isi SELALU lewat pembersih — lihat server/utils/html.ts.
  if (body.isi !== undefined) hasil.isi = bersihkanHtml(body.isi)
  if (body.isiEn !== undefined) hasil.isiEn = bersihkanHtml(body.isiEn)

  // Kategori boleh dikosongkan: tulisan dari member lahir tanpa kategori, dan
  // admin yang menentukannya sebelum terbit.
  if (body.tipe !== undefined) {
    if (body.tipe === null || body.tipe === ('' as unknown)) hasil.tipe = null
    else if (!JURNAL_TIPE.includes(body.tipe)) throw salah('Tipe jurnal tidak dikenal')
    else hasil.tipe = body.tipe
  }

  if (body.userId !== undefined) hasil.userId = body.userId || null
  if (body.kegiatanId !== undefined) hasil.kegiatanId = body.kegiatanId || null
  if (body.coverMediaId !== undefined) hasil.coverMediaId = body.coverMediaId || null

  return hasil
}

/**
 * Calon editor yang ditugaskan. Dipakai POST maupun PATCH — sejak editor bisa
 * dipilih sudah di layar "tulis baru", pemeriksaannya berjalan di dua tempat, dan
 * dua tempat yang menegakkan aturan sendiri-sendiri adalah cara aturan itu
 * menyimpang.
 *
 * Mengembalikan id yang sudah bersih (atau null), bukan boolean: yang memanggil
 * selalu butuh nilainya, dan mengembalikan nilai membuat tidak ada jalan memakai
 * nilai mentah yang belum diperiksa.
 */
export const periksaEditorId = (nilai: unknown, p: Pengakses): string | null => {
  if (levelDari(p) > 2) throw ditolak('Hanya admin yang bisa menugaskan editor')
  const tujuan = nilai ? String(nilai) : null
  if (!tujuan) return null

  const calon = db.select({ role: ccUser.role }).from(ccUser).where(eq(ccUser.id, tujuan)).get()
  if (!calon) throw salah('Editor tidak ditemukan')
  if (ROLE_LEVELS[calon.role] > 3) throw salah('Yang bisa ditugaskan hanya editor ke atas')
  return tujuan
}

// ── Wewenang ─────────────────────────────────────────────────────────────────

/** Pemilik tulisan = yang membuat barisnya. Untuk jurnal titipan member, itu
    membernya sendiri; untuk yang ditulis pengelola, ya pengelola itu. */
export const pemilikJurnal = (baris: Pick<DBJurnal, 'dibuatOleh'>) => baris.dibuatOleh

/**
 * Boleh menyunting ISI tulisan ini?
 *
 *   admin/master  — selalu
 *   editor        — TIDAK PERNAH. Ia membaca dan memutuskan, tidak memperbaiki.
 *   member        — hanya tulisannya sendiri, dan hanya saat giliran ada padanya
 *                   (draft atau revisi). Saat sedang diperiksa, tulisan dibekukan:
 *                   yang sedang dibaca orang lain tidak boleh berubah di bawah
 *                   tangannya.
 *
 * Editor sempat boleh menyunting jurnal yang ditugaskan kepadanya. Dicabut atas
 * permintaan, dan alasannya bukan soal kepercayaan melainkan soal apa yang
 * dihasilkan alur ini: kalau editor bisa memperbaiki sendiri kalimat yang
 * mengganggunya, ia akan memperbaikinya — itu jalan yang paling cepat — dan
 * penulisnya tidak pernah tahu tulisannya berubah, tidak pernah belajar apa yang
 * kurang, dan lama-lama yang terbit bukan lagi suaranya.
 *
 * Yang tersisa untuk editor: membaca, lalu menyatakan "setujui" atau "revisi"
 * beserta catatannya. Perbaikannya dikerjakan penulisnya — atau admin yang
 * membantu mewakilinya.
 */
export const bolehSunting = (baris: DBJurnal, p: Pengakses) => {
  const level = levelDari(p)
  if (level <= 2) return true
  if (level === 3) return false
  return pemilikJurnal(baris) === p.id && (baris.status === 'draft' || baris.status === 'revisi')
}

export const wajibBolehSunting = (baris: DBJurnal, p: Pengakses) => {
  if (bolehSunting(baris, p)) return
  const level = levelDari(p)
  if (level === 3) {
    throw ditolak('Editor membaca dan memutuskan, tidak menyunting. Kembalikan tulisannya untuk revisi beserta catatannya.')
  }
  if (level >= 4 && pemilikJurnal(baris) === p.id) {
    throw ditolak('Tulisan sedang diperiksa. Menunggu hasilnya sebelum bisa disunting lagi.')
  }
  throw ditolak('Anda tidak berwenang menyunting jurnal ini')
}

/**
 * Perpindahan status yang mungkin, dan siapa yang boleh menekannya.
 *
 *   draft     -> review              penulis mengirimkannya
 *   review    -> approved | revisi   keputusan editor yang ditugaskan (atau admin)
 *   review    -> draft               penulis menarik kembali kirimannya
 *   revisi    -> review              dikirim ulang sesudah diperbaiki
 *   approved  -> published           HANYA admin: ia yang menentukan kapan terbit
 *   approved  -> revisi              masih bisa dikembalikan sebelum terbit
 *   published -> draft               ditarik dari halaman publik, admin saja
 */
const TRANSISI: Record<JurnalStatus, JurnalStatus[]> = {
  draft: ['review'],
  review: ['approved', 'revisi', 'draft'],
  revisi: ['review'],
  approved: ['published', 'revisi'],
  published: ['draft'],
}

/** Keputusan redaksi: milik editor yang ditugaskan, atau admin ke atas. */
const KEPUTUSAN_EDITOR: JurnalStatus[] = ['approved', 'revisi']

/** Menerbitkan dan menarik dari publik: admin ke atas saja. */
const KEPUTUSAN_ADMIN = (dari: JurnalStatus, ke: JurnalStatus) =>
  ke === 'published' || (dari === 'published' && ke === 'draft')

export const periksaPindahStatus = (
  baris: DBJurnal,
  ke: string,
  p: Pengakses,
): JurnalStatus => {
  if (!JURNAL_STATUS.includes(ke as JurnalStatus)) throw salah('Status tidak dikenal')
  const tujuan = ke as JurnalStatus
  const dari = baris.status
  if (dari === tujuan) return tujuan

  if (!TRANSISI[dari].includes(tujuan)) {
    throw salah(`Status tidak bisa langsung berpindah dari “${dari}” ke “${tujuan}”`)
  }

  const level = levelDari(p)

  if (KEPUTUSAN_ADMIN(dari, tujuan)) {
    if (level > 2) throw ditolak('Hanya admin yang bisa menerbitkan atau menarik jurnal dari halaman publik')
    // Kategori wajib ADA sebelum terbit — bukan saat kolomnya diisi. Tulisan dari
    // member lahir tanpa kategori, dan admin yang menentukannya; pemeriksaannya
    // ditaruh tepat di ambang terbit supaya tidak ada tulisan tampil di /jurnal
    // tanpa tempat yang jelas.
    if (tujuan === 'published' && !baris.tipe) {
      throw salah('Kategori jurnal belum diisi. Tentukan kategorinya dulu sebelum diterbitkan.')
    }
    return tujuan
  }

  if (KEPUTUSAN_EDITOR.includes(tujuan)) {
    const bolehMemutuskan = level <= 2 || (level === 3 && baris.editorId === p.id)
    if (!bolehMemutuskan) {
      throw ditolak('Hanya editor yang ditugaskan (atau admin) yang bisa menyetujui atau meminta revisi')
    }
    return tujuan
  }

  // Sisanya (draft -> review, revisi -> review, review -> draft) milik PENULISNYA,
  // dan tetap terbuka bagi admin yang membantu — kadang mewakili member yang tidak
  // sanggup menyelesaikan permintaan editor.
  //
  // EDITOR TIDAK IKUT, meski levelnya di atas member. Mengirim adalah pekerjaan
  // penulis; editor yang bisa mengirim ulang tulisan orang lain berarti bisa
  // mengembalikan naskah ke antrean tanpa naskahnya diperbaiki siapa pun — giliran
  // penulisnya terenggut, dan tulisannya membeku lagi dengan isi yang sama.
  //
  // Batasnya `level <= 2`, sama persis dengan `bolehMengirim` di halaman sunting.
  // Keduanya harus tetap sama: layar yang menyembunyikan tombol sementara server
  // masih menerimanya bukan aturan, cuma tampilan.
  const bolehPenulis = level <= 2 || pemilikJurnal(baris) === p.id
  if (!bolehPenulis) throw ditolak('Mengirim tulisan untuk diperiksa adalah pekerjaan penulisnya')

  // Admin yang mengirim tulisan ke review harus sudah menunjuk editornya —
  // termasuk (dan terutama) saat tulisan itu ditulisnya sendiri. Tanpa aturan ini
  // sebuah tulisan bisa berjalan dari draft sampai terbit tanpa pernah ada orang
  // kedua yang membacanya, dan alur reviewnya cuma jadi formalitas tiga klik.
  //
  // Tidak berlaku bagi member: tulisan titipan memang tiba tanpa editor, dan yang
  // menugaskan editor sesudah itu adalah admin. Jalurnya pun endpoint lain
  // (/api/jurnal-saya), jadi baris ini tidak pernah dilewatinya.
  if (tujuan === 'review' && level <= 2 && !baris.editorId) {
    throw salah('Tentukan dulu editor yang akan memeriksa tulisan ini sebelum mengirimkannya.')
  }

  return tujuan
}
