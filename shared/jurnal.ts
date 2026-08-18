// shared/jurnal.ts
// Daftar jurnal redaksional.
//
// Masih data tetap, bukan tabel database — jurnal di situs ini belum punya CRUD.
// Dipindahkan ke `shared/` karena sekarang ada DUA pembacanya: layar
// `/admin/jurnal` dan agregasi dashboard. Selama daftarnya disalin di dua tempat,
// angka di dashboard akan menyimpang dari daftar yang dibaca orang begitu salah
// satunya disunting — dan penyimpangan itu tidak menghasilkan galat apa pun.
//
// `shared/` bisa dibaca sisi klien maupun sisi server; itu syaratnya di sini,
// karena pembacanya satu halaman Vue dan satu endpoint Nitro.

export interface Jurnal {
  id: string
  title: string
  status: 'Published' | 'Draft'
  type: 'Sharing Journey' | 'Event Reflection' | 'Insight' | 'Practice'
  contributor: string
  created: string
  updated: string
  /** `YYYY-MM-DD` — dipakai mengurutkan dan mengelompokkan per bulan. */
  date: string
}

export const JURNAL: Jurnal[] = [
  { id: 'menemukan-arah', title: 'Menemukan Arah dalam Kebersamaan', status: 'Published', type: 'Sharing Journey', contributor: 'Imanuel Ananta', created: '31 Mar 2026', updated: '12 Mei 2026', date: '2026-05-12' },
  { id: 'belajar-mendengarkan', title: 'Ketika Saya Belajar Mendengarkan', status: 'Published', type: 'Event Reflection', contributor: 'Nicholas', created: '1 Mei 2026', updated: '1 Mei 2026', date: '2026-05-01' },
  { id: 'membawa-kegelisahan', title: 'Membawa Kegelisahan kepada Tuhan', status: 'Published', type: 'Event Reflection', contributor: 'Anna', created: '20 Apr 2026', updated: '20 Apr 2026', date: '2026-04-20' },
  { id: 'kehadiran-membuka-ruang', title: 'Kehadiran yang Membuka Ruang', status: 'Published', type: 'Insight', contributor: 'Henk T. Sengkey', created: '8 Apr 2026', updated: '8 Apr 2026', date: '2026-04-08' },
  { id: 'tiga-menit', title: 'Tiga Menit untuk Mendengarkan Diri', status: 'Published', type: 'Practice', contributor: 'Tim Compassionate Companion', created: '28 Mar 2026', updated: '28 Mar 2026', date: '2026-03-28' },
  { id: 'mendampingi-lansia', title: 'Tips Mendampingi Lansia yang Susah Diatur', status: 'Draft', type: 'Practice', contributor: 'Maria', created: '21 Mar 2026', updated: '21 Mar 2026', date: '2026-03-21' },
]
