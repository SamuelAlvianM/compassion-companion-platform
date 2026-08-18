// server/db/schema/kunjungan.ts
// Penghitung kunjungan situs publik.
//
// Dua tabel, dua pertanyaan yang berbeda:
//
//   cc_kunjungan   — berapa kali halaman dibuka (satu angka per hari)
//   cc_pengunjung  — berapa ORANG yang membukanya (satu baris per orang per hari)
//
// Yang kedua itu yang tampil di dashboard, karena "berapa orang" yang ditanyakan.
//
// TIDAK ADA DATA PRIBADI YANG DISIMPAN. Orang dibedakan lewat `sidik`: hash dari
// alamat IP + user-agent + TANGGAL + rahasia server. Tanggal ikut masuk ke dalam
// hash-nya dengan sengaja — itu membuat sidik orang yang sama berbeda tiap hari,
// sehingga tidak ada yang bisa dilacak dari satu hari ke hari berikutnya, bahkan
// oleh pemilik databasenya. Hash-nya juga tidak bisa dibalik jadi alamat IP.
//
// Konsekuensinya jujur dan perlu diketahui: satu orang yang datang tiga hari
// berturut-turut terhitung tiga. Yang dijawab tabel ini "berapa orang datang hari
// itu", bukan "berapa orang yang pernah datang".

import { sql } from 'drizzle-orm'
import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const ccKunjungan = sqliteTable('cc_kunjungan', {
  /** `YYYY-MM-DD` menurut waktu Jakarta — bukan UTC, supaya batas harinya sama
      dengan batas hari yang dipakai seluruh tampilan tanggal di situs ini. */
  tanggal: text('tanggal').primaryKey(),
  jumlah: integer('jumlah').notNull().default(0),
  diperbaruiPada: integer('diperbarui_pada', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

export const ccPengunjung = sqliteTable('cc_pengunjung', {
  tanggal: text('tanggal').notNull(),
  /** Hash harian; lihat catatan di kepala berkas. Bukan pengenal orangnya. */
  sidik: text('sidik').notNull(),
}, t => [primaryKey({ columns: [t.tanggal, t.sidik] })])

export type Kunjungan = typeof ccKunjungan.$inferSelect
