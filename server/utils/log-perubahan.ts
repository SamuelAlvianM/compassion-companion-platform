// server/utils/log-perubahan.ts
// Menyusun kalimat "apa yang berubah" untuk dicatat di cc_log.
//
// Dipisah dari endpointnya karena persoalannya sendiri, dan bukan persoalan yang
// kecil: sebuah baris kegiatan punya dua puluhan kolom dengan tipe yang
// berbeda-beda — teks pendek, teks panjang, angka, tanggal, jam, JSON — dan
// masing-masing punya cara sendiri untuk dibaca manusia.
//
// Aturan utamanya satu: LOG BUKAN SALINAN DATA. Deskripsi sebuah kegiatan bisa
// ribuan karakter, dan mencatat sebelum-sesudahnya utuh akan membuat tabel
// pengamat lebih besar daripada tabel yang diamatinya. Nilai panjang karena itu
// diringkas menjadi keterangan, bukan disalin.

/** Nama kolom sebagaimana dibaca orang. Kolom yang tidak terdaftar di sini tidak
    pernah dilaporkan — itu sekaligus penyaringnya, jadi kolom teknis seperti
    `updatedAt` dan `slug` tidak perlu didaftar-hitamkan satu per satu. */
const LABEL: Record<string, string> = {
  judul: 'Judul',
  judulEn: 'Judul (EN)',
  deskripsi: 'Deskripsi',
  deskripsiEn: 'Deskripsi (EN)',
  lokasi: 'Lokasi',
  waktu: 'Keterangan waktu',
  ajakan: 'Ajakan',
  ajakanEn: 'Ajakan (EN)',
  ajakanIsi: 'Isi ajakan',
  ajakanIsiEn: 'Isi ajakan (EN)',
  testimoni: 'Testimoni',
  tautanDaring: 'Tautan daring',
  tanggalMulai: 'Tanggal mulai',
  tanggalSelesai: 'Tanggal selesai',
  jamMulai: 'Jam mulai',
  jamSelesai: 'Jam selesai',
  tutupPendaftaran: 'Penutupan pendaftaran',
  kuota: 'Kuota',
  harga: 'Harga',
  status: 'Status',
  coverMediaId: 'Gambar sampul',
  thumbnailMediaId: 'Thumbnail',
}

/** Kolom yang isinya bisa sangat panjang. Untuk yang ini nilainya tidak pernah
    ditulis; yang dicatat cuma bahwa ia berubah, beserta ukurannya. */
const PANJANG = new Set([
  'deskripsi', 'deskripsiEn', 'ajakanIsi', 'ajakanIsiEn', 'testimoni',
])

/** Kolom yang isinya id media. Nilainya tidak berarti apa-apa untuk dibaca. */
const RUJUKAN = new Set(['coverMediaId', 'thumbnailMediaId'])

const BATAS_TEKS = 60

const tanggal = (d: Date) =>
  new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta',
  }).format(d)

const rupiah = (n: number) =>
  n === 0 ? 'gratis' : `Rp${new Intl.NumberFormat('id-ID').format(n)}`

/** Satu nilai, sebagai teks yang bisa dibaca. */
const bacaNilai = (kolom: string, nilai: unknown): string => {
  if (nilai === null || nilai === undefined || nilai === '') return '(kosong)'
  if (nilai instanceof Date) return tanggal(nilai)
  if (kolom === 'harga' && typeof nilai === 'number') return rupiah(nilai)
  if (kolom === 'kuota') return `${nilai} orang`

  const teks = String(nilai)
  // Dipotong di batas kata, bukan di tengah kata — log yang berbunyi
  // "Yogyakarta, Gedung Serba…" masih terbaca; "Yogyakarta, Gedung Serbagu" tidak
  // memberi tahu apa pun lebih banyak tapi terlihat seperti data rusak.
  if (teks.length <= BATAS_TEKS) return teks
  const potongan = teks.slice(0, BATAS_TEKS)
  const spasi = potongan.lastIndexOf(' ')
  return `${(spasi > BATAS_TEKS * 0.6 ? potongan.slice(0, spasi) : potongan).trimEnd()}…`
}

/** Ukuran isi panjang, untuk dilaporkan tanpa menyalin isinya. */
const ukuran = (nilai: unknown): string => {
  if (nilai === null || nilai === undefined || nilai === '') return 'dikosongkan'
  if (Array.isArray(nilai)) return `${nilai.length} butir`
  const n = String(nilai).replace(/<[^>]*>/g, '').length
  return `${new Intl.NumberFormat('id-ID').format(n)} karakter`
}

const samaSaja = (a: unknown, b: unknown): boolean => {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
  if (a instanceof Date || b instanceof Date) return false
  // Testimoni tersimpan sebagai JSON; dibandingkan sebagai teksnya karena dua
  // larik dengan isi sama selalu bukan objek yang sama.
  if (typeof a === 'object' || typeof b === 'object') {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
  }
  // `null` dan `''` diperlakukan sama: keduanya berarti "tidak diisi", dan
  // formulir yang mengirim "" untuk kolom yang tadinya null akan melaporkan
  // perubahan yang tidak dirasakan siapa pun.
  const kosongA = a === null || a === undefined || a === ''
  const kosongB = b === null || b === undefined || b === ''
  if (kosongA && kosongB) return true
  return a === b
}

/**
 * Daftar perubahan sebagai kalimat-kalimat pendek, satu baris per kolom.
 *
 * Mengembalikan `null` kalau tidak ada yang berubah — pemanggilnya memakai itu
 * untuk memutuskan tidak mencatat apa-apa. Menyimpan baris log "disunting" yang
 * isinya tidak ada perubahan cuma menambah baris yang harus dilewati pembacanya.
 *
 * `batasBaris` menahan panjangnya: menyimpan tiga puluh baris perubahan dalam satu
 * catatan membuat kartunya tidak terbaca. Sisanya diringkas jadi hitungan.
 */
export const ringkasPerubahan = (
  // `object`, bukan `Record<string, unknown>`: yang dikirim pemanggilnya adalah
  // baris database dan hasil validator — keduanya interface, dan interface di
  // TypeScript tidak punya index signature implisit sehingga ditolak oleh
  // `Record`. Diperlonggar di sini, lalu dibaca lewat satu cast di bawah, supaya
  // tiap pemanggilnya tidak perlu menaburkan cast sendiri-sendiri.
  lamaObj: object,
  baruObj: object,
  batasBaris = 6,
): string | null => {
  const lama = lamaObj as Record<string, unknown>
  const baru = baruObj as Record<string, unknown>
  const baris: string[] = []

  for (const kolom of Object.keys(LABEL)) {
    if (!(kolom in baru)) continue
    if (samaSaja(lama[kolom], baru[kolom])) continue

    const label = LABEL[kolom]

    if (PANJANG.has(kolom)) {
      baris.push(`${label}: ${ukuran(baru[kolom])}`)
      continue
    }
    if (RUJUKAN.has(kolom)) {
      const ada = baru[kolom] !== null && baru[kolom] !== ''
      baris.push(`${label}: ${ada ? 'diganti' : 'dilepas'}`)
      continue
    }

    baris.push(`${label}: ${bacaNilai(kolom, lama[kolom])} → ${bacaNilai(kolom, baru[kolom])}`)
  }

  if (!baris.length) return null
  if (baris.length <= batasBaris) return baris.join('\n')

  const sisa = baris.length - batasBaris
  return `${baris.slice(0, batasBaris).join('\n')}\n…dan ${sisa} kolom lainnya`
}
