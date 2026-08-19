// server/utils/validasi-event.ts
// Pembacaan & validasi body untuk CRUD kegiatan dan sesi.
//
// Ditaruh di satu berkas karena create dan update memakai aturan yang sama; kalau
// disalin per handler, keduanya pasti menyimpang begitu ada aturan yang berubah.

import { and, eq, ne } from 'drizzle-orm'
import { db } from '../db'
import { ccKegiatan, ITEM_JENIS, KEGIATAN_STATUS, SESI_BAGIAN, type ItemJenis, type SesiBagian } from '../db/schema'
import { slugify } from './randomId'
import { idYoutube } from './sesi'

const teks = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const teksAtauNull = (v: unknown) => {
  const s = teks(v)
  return s === '' ? null : s
}

export const salah = (pesan: string) => createError({ statusCode: 400, statusMessage: pesan })

/**
 * Tanggal dari `YYYY-MM-DD`, `YYYY-MM-DDTHH:MM`, atau ISO penuh; selalu
 * ditafsirkan sebagai WIB.
 *
 * Bentuk `…THH:MM` tanpa zona ditambahi `+07:00` di sini, bukan dibiarkan dibaca
 * `new Date()`: tanpa zona, JS memakai zona waktu SERVER. Di mesin pengembangan
 * kebetulan sama-sama WIB, jadi kesalahannya baru muncul di server produksi yang
 * berjalan UTC — batas pendaftaran akan bergeser tujuh jam tanpa galat apa pun.
 */
export const keTanggal = (v: unknown): Date | null => {
  const s = teks(v)
  if (!s) return null
  let iso = s
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) iso = `${s}T00:00:00+07:00`
  else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s)) iso = `${s}${s.length === 16 ? ':00' : ''}+07:00`
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) throw salah(`Tanggal tidak valid: ${s}`)
  return d
}

/**
 * Jam `HH:MM` 24 jam dengan menit kelipatan 5.
 *
 * Kelipatan lima ditegakkan di server, bukan hanya di timepicker: pemilih jam di
 * form memang hanya menawarkan kelipatan lima, tapi nilai yang tidak lewat form
 * (mis. PATCH langsung) akan membuat halaman menampilkan jam yang tidak pernah
 * bisa dipilih ulang oleh pemiliknya sendiri.
 */
export const keJam = (v: unknown): string | null => {
  const s = teks(v)
  if (!s) return null
  const cocok = /^(\d{1,2}):(\d{2})$/.exec(s)
  if (!cocok) throw salah(`Jam tidak valid: ${s}. Pakai bentuk HH:MM.`)
  const jam = Number(cocok[1])
  const menit = Number(cocok[2])
  if (jam > 23 || menit > 59) throw salah(`Jam tidak valid: ${s}`)
  if (menit % 5 !== 0) throw salah('Menit harus kelipatan 5')
  return `${String(jam).padStart(2, '0')}:${String(menit).padStart(2, '0')}`
}

/** `YYYY-MM-DD` sebuah tanggal menurut WIB — untuk membandingkan hari, bukan jam. */
const hariWib = (d: Date) => new Intl.DateTimeFormat('en-CA', {
  year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Jakarta',
}).format(d)

/**
 * Slug unik. Bentrokan diselesaikan dengan menambah akhiran angka, bukan ditolak —
 * dua kegiatan boleh saja berjudul sama di tahun berbeda.
 */
export const slugUnik = (judul: string, abaikanId?: string) => {
  const dasar = slugify(judul) || 'kegiatan'
  let kandidat = dasar
  for (let i = 2; i < 100; i++) {
    const ada = db
      .select({ id: ccKegiatan.id })
      .from(ccKegiatan)
      .where(abaikanId
        ? and(eq(ccKegiatan.slug, kandidat), ne(ccKegiatan.id, abaikanId))
        : eq(ccKegiatan.slug, kandidat))
      .get()
    if (!ada) return kandidat
    kandidat = `${dasar}-${i}`
  }
  throw salah('Tidak bisa menyusun slug unik untuk judul ini')
}

export interface BodyKegiatan {
  judul: string
  judulEn: string | null
  deskripsi: string | null
  deskripsiEn: string | null
  lokasi: string
  waktu: string | null
  ajakan: string | null
  ajakanEn: string | null
  ajakanIsi: string | null
  ajakanIsiEn: string | null
  testimoni: { nama: string, teks: string }[] | null
  tautanDaring: string | null
  tanggalMulai: Date
  tanggalSelesai: Date | null
  jamMulai: string | null
  jamSelesai: string | null
  tutupPendaftaran: Date | null
  kuota: number | null
  harga: number
  status: (typeof KEGIATAN_STATUS)[number]
  coverMediaId: string | null
  thumbnailMediaId: string | null
}

export const bacaKegiatan = (body: Record<string, unknown>): BodyKegiatan => {
  const judul = teks(body.judul)
  if (!judul) throw salah('Judul kegiatan wajib diisi')

  // Lokasi wajib, sejajar dengan judul dan tanggal mulai.
  //
  // Kolomnya di database tetap nullable, dan itu disengaja: baris lama yang lahir
  // sebelum aturan ini tidak boleh jadi tidak bisa dibuka. Yang ditegakkan adalah
  // apa yang masuk lewat sini — bukan apa yang sudah terlanjur ada.
  //
  // Acara daring pun tetap punya lokasi, dan menuliskannya lebih baik daripada
  // membiarkan kolomnya kosong: "Online via Zoom" memberi tahu pembacanya bahwa
  // acaranya memang daring, sementara kolom kosong tidak bisa dibedakan dari
  // kolom yang lupa diisi.
  const lokasi = teks(body.lokasi)
  if (!lokasi) throw salah('Lokasi wajib diisi')

  const tanggalMulai = keTanggal(body.tanggalMulai)
  if (!tanggalMulai) throw salah('Tanggal mulai wajib diisi')

  const tanggalSelesai = keTanggal(body.tanggalSelesai)
  // Boleh SAMA — event sehari memang begitu; yang ditolak hanya yang mundur.
  if (tanggalSelesai && tanggalSelesai < tanggalMulai) {
    throw salah('Tanggal selesai tidak boleh mendahului tanggal mulai')
  }

  // Batas pendaftaran sesudah acaranya mulai bukan batas apa pun: ia menawarkan
  // pendaftaran untuk acara yang sedang berlangsung. Dibandingkan sebagai HARI,
  // bukan sebagai timestamp — batas "23.55 pada hari acara" itu sah dan lazim,
  // sementara `tanggalMulai` sendiri jatuh pada 00.00 hari itu.
  const tutupPendaftaran = keTanggal(body.tutupPendaftaran)
  if (tutupPendaftaran && hariWib(tutupPendaftaran) > hariWib(tanggalMulai)) {
    throw salah('Batas akhir pendaftaran tidak boleh melewati tanggal mulai')
  }

  const jamMulai = keJam(body.jamMulai)
  const jamSelesai = keJam(body.jamSelesai)

  // Urutan jam hanya bisa diperiksa pada event yang jatuh di SATU hari. Untuk
  // event berhari-hari, "selesai 09.00" sesudah "mulai 16.00" justru normal:
  // keduanya jam pada hari yang berbeda.
  const sehari = !tanggalSelesai || hariWib(tanggalSelesai) === hariWib(tanggalMulai)
  if (sehari && jamMulai && jamSelesai && jamSelesai <= jamMulai) {
    throw salah('Jam selesai harus setelah jam mulai')
  }

  // Status tidak lagi diminta formulir mana pun — fase kini murni turunan tanggal.
  // Bawaannya `terbit` supaya event yang baru dibuat langsung terlihat; nilainya
  // masih diterima kalau memang dikirim, karena `batal` tetap dihormati
  // faseKegiatan() dan suatu saat bisa perlu dipasang lewat API.
  const status = teks(body.status) || 'terbit'
  if (!KEGIATAN_STATUS.includes(status as never)) throw salah(`Status tidak dikenal: ${status}`)

  const harga = Number(body.harga ?? 0)
  if (!Number.isFinite(harga) || harga < 0) throw salah('Harga tidak boleh negatif')

  // Kuota kosong berarti tanpa batas — dibedakan dari 0, yang berarti penuh dan
  // ditolak oleh CHECK constraint di skema.
  //
  // Pemeriksaan "kosong" harus menerima ANGKA, bukan hanya string. Versi
  // sebelumnya memakai `teks(kuotaMentah) !== ''`, dan `teks()` mengembalikan ''
  // untuk apa pun yang bukan string — sehingga kuota berupa angka (yang justru
  // bentuk normalnya dari JSON) selalu dibuang diam-diam jadi "tanpa batas".
  const kuotaMentah = body.kuota
  const kuotaKosong = kuotaMentah === null || kuotaMentah === undefined
    || (typeof kuotaMentah === 'string' && kuotaMentah.trim() === '')

  let kuota: number | null = null
  if (!kuotaKosong) {
    kuota = Number(kuotaMentah)
    if (!Number.isInteger(kuota) || kuota < 1) throw salah('Kuota minimal 1, atau kosongkan untuk tanpa batas')
  }

  return {
    judul,
    judulEn: teksAtauNull(body.judulEn),
    deskripsi: teksAtauNull(body.deskripsi),
    deskripsiEn: teksAtauNull(body.deskripsiEn),
    lokasi,
    waktu: teksAtauNull(body.waktu),
    ajakan: teksAtauNull(body.ajakan),
    ajakanEn: teksAtauNull(body.ajakanEn),
    ajakanIsi: teksAtauNull(body.ajakanIsi),
    ajakanIsiEn: teksAtauNull(body.ajakanIsiEn),
    // Testimoni hanya diterima sebagai larik objek {nama, teks}; bentuk lain
    // diabaikan supaya kolom JSON tidak menampung apa saja.
    //
    // Baris yang kedua kolomnya kosong dibuang di sini, bukan cuma dicegah di form:
    // ia tidak menampilkan apa pun di halaman tapi tetap terhitung oleh
    // `v-if="testimoni.length"`, sehingga panel testimoni bisa terbuka berisi kotak
    // kosong tanpa ada yang tahu dari mana asalnya.
    testimoni: Array.isArray(body.testimoni)
      ? (body.testimoni as unknown[])
          .filter((k): k is { nama: string, teks: string } =>
            Boolean(k) && typeof k === 'object' && 'nama' in k! && 'teks' in k!)
          .map(k => ({ nama: String(k.nama).trim(), teks: String(k.teks).trim() }))
          .filter(k => k.nama !== '' || k.teks !== '')
      : null,
    tautanDaring: teksAtauNull(body.tautanDaring),
    tanggalMulai,
    tanggalSelesai,
    jamMulai,
    jamSelesai,
    tutupPendaftaran,
    kuota,
    harga: Math.round(harga),
    status: status as BodyKegiatan['status'],
    coverMediaId: teksAtauNull(body.coverMediaId),
    thumbnailMediaId: teksAtauNull(body.thumbnailMediaId),
  }
}

export interface BodyItem {
  bagian: SesiBagian
  jenis: ItemJenis
  judul: string
  judulEn: string | null
  mediaId: string | null
  url: string | null
  terkunci: boolean
  urutan: number
}

export const bacaItem = (body: Record<string, unknown>): BodyItem => {
  const bagian = teks(body.bagian) as SesiBagian
  if (!SESI_BAGIAN.includes(bagian)) throw salah(`Bagian tidak dikenal: ${bagian || '(kosong)'}`)

  const jenis = teks(body.jenis) as ItemJenis
  if (!ITEM_JENIS.includes(jenis)) throw salah(`Jenis tidak dikenal: ${jenis || '(kosong)'}`)

  const judul = teks(body.judul)
  if (!judul) throw salah('Judul item wajib diisi')

  const mediaId = teksAtauNull(body.mediaId)
  let url = teksAtauNull(body.url)

  // YouTube divalidasi di server, bukan hanya di form: URL yang tidak bisa
  // diuraikan jadi ID akan menghasilkan iframe kosong di halaman publik, dan itu
  // baru ketahuan setelah terbit.
  if (jenis === 'youtube') {
    if (!url) throw salah('Tautan YouTube wajib diisi')
    if (!idYoutube(url)) throw salah('Tautan YouTube tidak dikenali. Pakai bentuk youtube.com/watch?v=… atau youtu.be/…')
  }

  if (jenis === 'tautan') {
    if (!url) throw salah('Alamat tautan wajib diisi')
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  }

  if (!mediaId && !url) throw salah('Item harus punya berkas atau tautan')

  const urutan = Number(body.urutan ?? 0)

  return {
    bagian,
    jenis,
    judul,
    judulEn: teksAtauNull(body.judulEn),
    mediaId,
    url,
    // Materi **terkunci secara bawaan** — hanya peserta event (plus pengelola
    // level ≤ 3) yang boleh membukanya. Pengelola masih bisa membukanya untuk
    // umum dengan mengirim `terkunci: false` secara eksplisit, mis. untuk silabus.
    //
    // Galeri dan referensi tidak pernah dikunci: keduanya dokumentasi publik, dan
    // gembok di sana cuma bikin halaman penuh gembok tanpa maksud.
    terkunci: bagian === 'materi' ? body.terkunci !== false : false,
    urutan: Number.isFinite(urutan) ? Math.max(0, Math.trunc(urutan)) : 0,
  }
}
