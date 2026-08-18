// server/api/admin/log/index.get.ts
// Daftar jejak kerja. MASTER SAJA.
//
// Bukan `wajibRole(event, 'admin')`: catatan ini merekam apa yang dikerjakan admin
// dan editor, dan yang direkam bukan pemegang rekamannya. Kalau admin bisa
// membacanya, ia juga akan bisa menghapusnya lewat endpoint sebelah — dan log yang
// bisa dihapus pelakunya bukan log.

import { and, desc, eq, gte, sql } from 'drizzle-orm'
import { db } from '../../../db'
import {
  ccJurnal,
  ccKegiatan,
  ccLog,
  ccUser,
  LOG_AKSI,
  LOG_AKSI_LABEL,
  LOG_SEGMEN,
  LOG_SIMPAN_HARI,
  type DBLog,
  type LogSegmen,
} from '../../../db/schema'
import { wajibRole } from '../../../utils/session'
import { bersihkanLogSekarang } from '../../../utils/log'

const HARI = 24 * 60 * 60 * 1000

export default defineEventHandler(async (event) => {
  await wajibRole(event, 'master')

  // Dibersihkan tepat sebelum dibaca. Pembersihan yang menumpang pada penulisan
  // bisa tertinggal berhari-hari kalau tidak ada aktivitas; yang dilihat master
  // harus selalu benar-benar berumur ≤ 7 hari, bukan "≤ 7 hari sejak terakhir ada
  // yang bekerja".
  bersihkanLogSekarang()

  const q = getQuery(event)
  const segmen = LOG_SEGMEN.includes(q.segmen as LogSegmen) ? (q.segmen as LogSegmen) : null
  const cari = typeof q.cari === 'string' ? q.cari.trim().toLowerCase() : ''
  const aksi = typeof q.aksi === 'string' && q.aksi !== 'semua' ? q.aksi : ''
  const pelaku = typeof q.pelaku === 'string' && q.pelaku !== 'semua' ? q.pelaku : ''
  // Rentang waktu. Dibatasi umur simpan — meminta 30 hari pada tabel yang isinya
  // dibuang tiap 7 hari cuma menjanjikan sesuatu yang tidak ada.
  const hari = Math.min(Math.max(Number(q.hari) || LOG_SIMPAN_HARI, 1), LOG_SIMPAN_HARI)

  const sejak = new Date(Date.now() - hari * HARI)

  const semua = db
    .select()
    .from(ccLog)
    .where(and(
      segmen ? eq(ccLog.segmen, segmen) : undefined,
      gte(ccLog.createdAt, sejak),
    ))
    .orderBy(desc(ccLog.createdAt))
    .all()

  /**
   * Penyaringan dikerjakan di JS, bukan di WHERE.
   *
   * Bukan karena malas: penyaringnya bekerja pada TINGKAT OBJEK, bukan tingkat
   * baris. Halaman log mengelompokkan barisnya per jurnal/event/member, dan sebuah
   * kartu yang isinya cuma langkah-langkah yang kebetulan cocok dengan kata
   * pencarian bukan lagi riwayat — ia potongan riwayat yang menyesatkan, karena
   * "6 langkah" berubah jadi "2 langkah" tanpa ada yang memberi tahu bahwa
   * empat sisanya disembunyikan.
   *
   * Jadi yang dicocokkan barisnya, tapi yang dikembalikan SELURUH riwayat objek
   * yang punya baris cocok. Itu tidak bisa ditulis sebagai satu WHERE tanpa
   * subquery yang harus menangani `objek_id` yang null (pendaftar tamu).
   *
   * Aman dilakukan di memori karena jumlahnya terbatas dengan sendirinya: umur
   * simpannya 7 hari, dan yang dicatat cuma perpindahan yang berarti.
   */
  const kunci = (row: DBLog) => row.objekId ?? `label:${row.objekLabel ?? '—'}`

  const cocok = (row: DBLog) => {
    if (aksi && row.aksi !== aksi) return false
    if (pelaku && row.pelakuId !== pelaku) return false
    if (!cari) return true
    return [
      row.objekLabel,
      row.pelakuNama,
      row.catatan,
      LOG_AKSI_LABEL[row.aksi] ?? row.aksi,
    ].some(nilai => nilai?.toLowerCase().includes(cari))
  }

  const adaFilter = Boolean(cari || aksi || pelaku)
  const kunciLolos = new Set(semua.filter(cocok).map(kunci))
  const baris = adaFilter ? semua.filter(row => kunciLolos.has(kunci(row))) : semua

  // Hitungan per segmen dibaca dari SELURUH tabel tanpa penyaring apa pun — kalau
  // dihitung dari hasil yang sudah disaring, angka di tab akan berubah-ubah
  // mengikuti apa yang sedang diketik di kotak cari.
  const perSegmen = db
    .select({ segmen: ccLog.segmen, jumlah: sql<number>`count(*)` })
    .from(ccLog)
    .groupBy(ccLog.segmen)
    .all()

  // Pilihan untuk dua penyaring, disusun dari isi segmen yang sedang dibuka.
  // Diambil dari `semua` (sebelum disaring) supaya pilihannya tidak menghilang
  // begitu salah satunya dipakai — dropdown yang mengosongkan dirinya sendiri
  // sesudah dipilih tidak bisa diubah lagi tanpa mereset dulu.
  const aksiTersedia = [...new Set(semua.map(r => r.aksi))]
    .map(a => ({ value: a, label: LOG_AKSI_LABEL[a] ?? a }))
    .sort((a, b) => a.label.localeCompare(b.label))

  const pelakuTersedia = [...new Map(
    semua.filter(r => r.pelakuId).map(r => [r.pelakuId!, r.pelakuNama ?? r.pelakuId!]),
  )].map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label))

  return {
    data: baris.map(row => ({
      ...row,
      aksiLabel: LOG_AKSI_LABEL[row.aksi] ?? row.aksi,
      tautan: tautanUntuk(row),
    })),
    meta: {
      total: perSegmen.reduce((n, s) => n + s.jumlah, 0),
      perSegmen: Object.fromEntries(perSegmen.map(s => [s.segmen, s.jumlah])),
      simpanHari: LOG_SIMPAN_HARI,
      // Berapa objek yang lolos saringan — dipakai halaman untuk mengatakan
      // "3 dari 12 ditemukan", bukan sekadar menampilkan sisa yang tidak diketahui
      // dari berapa.
      objekTampil: new Set(baris.map(kunci)).size,
      objekTotal: new Set(semua.map(kunci)).size,
      aksiTersedia,
      pelakuTersedia,
      // Kejadian terlama yang masih tersimpan — dipakai halaman log untuk
      // mengatakan sejauh mana ke belakang yang terbaca, alih-alih membiarkan
      // master menebak apakah daftar yang pendek berarti sepi atau sudah terpangkas.
      terlama: db.select({ w: ccLog.createdAt }).from(ccLog).orderBy(ccLog.createdAt).limit(1).get()?.w ?? null,
    },
  }
})

/**
 * Ke mana sebuah baris log mengarah kalau diklik.
 *
 * Ditentukan dari AKSInya, bukan dari keadaan objeknya sekarang. Sebuah baris log
 * adalah catatan sebuah momen: "diterbitkan" mengarah ke halaman publik karena di
 * situlah hasil tindakan itu terlihat, meskipun tulisannya sesudah itu ditarik
 * lagi. Kalau tautannya mengikuti status terkini, dua baris yang berbeda kejadian
 * akan mengarah ke tempat yang sama dan lognya berhenti bercerita.
 *
 * Objek yang sudah dihapus tidak diberi tautan sama sekali — halaman yang menyambut
 * dengan 404 lebih buruk daripada baris yang memang tidak bisa diklik.
 */
const tautanUntuk = (row: DBLog) => {
  if (!row.objekId) return null

  if (row.segmen === 'jurnal') {
    if (row.aksi === LOG_AKSI.jurnalDihapus) return null
    const ada = db.select({ id: ccJurnal.id }).from(ccJurnal).where(eq(ccJurnal.id, row.objekId)).get()
    if (!ada) return null
    // Terbit → halaman publiknya, dengan penanda `sorot` yang membuat kartunya
    // berkedip supaya master tahu tulisan mana yang dimaksud di antara belasan.
    if (row.aksi === LOG_AKSI.jurnalTerbit && row.objekSlug) {
      return `/id/jurnal?sorot=${encodeURIComponent(row.objekSlug)}`
    }
    return `/admin/jurnal/${row.objekId}`
  }

  if (row.segmen === 'event') {
    if (row.aksi === LOG_AKSI.eventDihapus) return null
    const ada = db.select({ id: ccKegiatan.id }).from(ccKegiatan).where(eq(ccKegiatan.id, row.objekId)).get()
    if (!ada) return null
    return `/admin/event/${row.objekId}`
  }

  // Member: pendaftaran tamu tidak punya akun, jadi objekId-nya id peserta —
  // baris itu tidak punya halaman member yang bisa dituju. Pemeriksaan ke tabel
  // akun sekaligus menutup akun yang sudah dihapus.
  const akun = db.select({ id: ccUser.id }).from(ccUser).where(eq(ccUser.id, row.objekId)).get()
  return akun ? `/admin/member/${row.objekId}` : null
}
