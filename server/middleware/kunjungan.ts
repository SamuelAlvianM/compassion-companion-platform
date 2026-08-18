// server/middleware/kunjungan.ts
// Mencatat kunjungan halaman publik: berapa kali dibuka, dan oleh berapa orang.
//
// Yang dihitung hanya permintaan HALAMAN — bukan berkas, bukan API, bukan layar
// admin. Tanpa penyaringan itu, satu kali buka halaman akan terhitung puluhan kali
// (tiap gambar, skrip, dan panggilan data ikut lewat sini), dan angkanya berhenti
// berarti apa pun.
//
// Cara membedakan orang tanpa menyimpan apa pun tentang dirinya dijelaskan di
// server/db/schema/kunjungan.ts.

import { createHash } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { db } from '../db'
import { ccKunjungan, ccPengunjung } from '../db/schema'

/** Hari menurut waktu Jakarta, bukan UTC — batas harinya harus sama dengan batas
    hari yang dipakai seluruh tampilan tanggal di situs ini. */
const hariJakarta = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

const DILEWATI = [
  '/api/',
  '/_nuxt',
  '/_ipx',
  '/__nuxt',
  '/admin', // layar pengelola bukan kunjungan situs
  '/favicon',
  '/images/',
  '/fonts/',
  '/storage/',
]

/**
 * Rahasia yang ikut masuk ke dalam hash.
 *
 * Tanpa ini, siapa pun yang memegang databasenya bisa menghitung ulang hash untuk
 * satu alamat IP yang dicurigai lalu mencocokkannya — daftar hash jadi daftar IP
 * yang cuma perlu ditebak satu per satu. Diambil dari runtime config bila ada;
 * kalau tidak, dari nilai acak yang lahir bersama proses ini. Yang terakhir
 * berarti hitungannya bisa terpecah setelah server dijalankan ulang di tengah
 * hari — satu orang bisa terhitung dua. Itu ditukar dengan tidak pernah menaruh
 * rahasia tetap di dalam kode.
 */
const rahasiaCadangan = createHash('sha256').update(String(Math.random())).digest('hex')

const sidikHarian = (event: any, tanggal: string) => {
  const rahasia = process.env.NUXT_KUNJUNGAN_SECRET || rahasiaCadangan
  const ip = getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
    || event.node.req.socket.remoteAddress
    || 'tanpa-ip'
  const ua = getRequestHeader(event, 'user-agent') ?? 'tanpa-ua'
  return createHash('sha256').update(`${tanggal}|${ip}|${ua}|${rahasia}`).digest('hex').slice(0, 32)
}

export default defineEventHandler((event) => {
  if (event.method !== 'GET') return

  const path = event.path.split('?')[0] ?? ''
  if (DILEWATI.some(awalan => path.startsWith(awalan))) return
  // Berkas apa pun yang punya ekstensi bukan halaman.
  if (/\.[a-z0-9]{2,5}$/i.test(path)) return

  try {
    const tanggal = hariJakarta()

    db
      .insert(ccKunjungan)
      .values({ tanggal, jumlah: 1, diperbaruiPada: new Date() })
      .onConflictDoUpdate({
        target: ccKunjungan.tanggal,
        set: { jumlah: sql`${ccKunjungan.jumlah} + 1`, diperbaruiPada: new Date() },
      })
      .run()

    // Orang yang sama pada hari yang sama menghasilkan sidik yang sama, jadi
    // barisnya cukup diabaikan — tidak ada yang perlu diperbarui.
    db
      .insert(ccPengunjung)
      .values({ tanggal, sidik: sidikHarian(event, tanggal) })
      .onConflictDoNothing()
      .run()
  }
  catch {
    // Penghitung tidak boleh menjatuhkan halaman. Kalau tulisannya gagal — database
    // terkunci, disk penuh — yang hilang satu angka statistik, dan itu jauh lebih
    // murah daripada satu halaman yang tidak terbuka.
  }
})
