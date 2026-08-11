// server/api/admin/events/index.get.ts
// Daftar kegiatan untuk /admin/events. Berbeda dari /api/events publik: draft ikut
// tampil, dan setiap baris membawa hitungan peserta, sesi, serta materi.

import { asc, desc, eq, like, ne, or, sql } from 'drizzle-orm'
import { db } from '../../../db'
import { ccKegiatan, ccPeserta, ccSesi, ccSesiItem } from '../../../db/schema'
import { faseKegiatan } from '../../../utils/kegiatan'
import { wajibRole } from '../../../utils/session'

export default defineEventHandler(async (event) => {
  await wajibRole(event, 'editor')

  const q = getQuery(event)
  const cari = typeof q.cari === 'string' ? q.cari.trim() : ''
  const status = typeof q.status === 'string' ? q.status.trim() : ''

  const filters = []
  if (cari) filters.push(or(like(ccKegiatan.judul, `%${cari}%`), like(ccKegiatan.slug, `%${cari}%`))!)
  if (status) filters.push(eq(ccKegiatan.status, status as never))

  const rows = await db
    .select()
    .from(ccKegiatan)
    .where(filters.length ? sql`${sql.join(filters, sql` and `)}` : undefined)
    .orderBy(desc(ccKegiatan.tanggalMulai))

  const peserta = await db
    .select({ kegiatanId: ccPeserta.kegiatanId, jumlah: sql<number>`count(*)` })
    .from(ccPeserta)
    .where(ne(ccPeserta.status, 'batal'))
    .groupBy(ccPeserta.kegiatanId)
  const pesertaPer = new Map(peserta.map(p => [p.kegiatanId, p.jumlah]))

  // Sesi & materi dihitung lewat satu join, bukan query per kegiatan — daftar ini
  // bisa panjang dan pola N+1 akan terasa begitu event bertambah.
  const sesi = await db
    .select({
      kegiatanId: ccSesi.kegiatanId,
      sesi: sql<number>`count(distinct ${ccSesi.id})`,
      item: sql<number>`count(${ccSesiItem.id})`,
    })
    .from(ccSesi)
    .leftJoin(ccSesiItem, eq(ccSesiItem.sesiId, ccSesi.id))
    .groupBy(ccSesi.kegiatanId)
    .orderBy(asc(ccSesi.kegiatanId))
  const sesiPer = new Map(sesi.map(s => [s.kegiatanId, s]))

  const sekarang = new Date()
  return {
    data: rows.map((row) => {
      const hitungan = sesiPer.get(row.id)
      return {
        id: row.id,
        slug: row.slug,
        judul: row.judul,
        judulEn: row.judulEn,
        lokasi: row.lokasi,
        tanggalMulai: row.tanggalMulai,
        tanggalSelesai: row.tanggalSelesai,
        harga: row.harga,
        kuota: row.kuota,
        status: row.status,
        fase: faseKegiatan(row, sekarang),
        terdaftar: pesertaPer.get(row.id) ?? 0,
        jumlahSesi: hitungan?.sesi ?? 0,
        jumlahItem: hitungan?.item ?? 0,
      }
    }),
  }
})
