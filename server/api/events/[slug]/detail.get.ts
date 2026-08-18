// server/api/events/[slug]/detail.get.ts
// Satu kegiatan publik berdasarkan slug, dengan bentuk payload yang sama seperti
// satu baris di GET /api/events — supaya EventRegisterModal bisa menerima keduanya
// tanpa penyesuaian.

import { and, eq, ne, sql } from 'drizzle-orm'
import { db } from '../../../db'
import { ccKegiatan, ccMedia, ccPeserta } from '../../../db/schema'
import { faseKegiatan, pendaftaranTerbuka } from '../../../utils/kegiatan'
import { userSaatIni } from '../../../utils/session'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Slug kegiatan wajib diisi' })

  const row = db.select().from(ccKegiatan).where(eq(ccKegiatan.slug, slug)).get()
  if (!row || row.status === 'draft') {
    throw createError({ statusCode: 404, statusMessage: 'Kegiatan tidak ditemukan' })
  }

  const hitungan = db
    .select({ jumlah: sql<number>`count(*)` })
    .from(ccPeserta)
    .where(and(eq(ccPeserta.kegiatanId, row.id), ne(ccPeserta.status, 'batal')))
    .get()
  const terdaftar = hitungan?.jumlah ?? 0

  const user = await userSaatIni(event)
  const sudahTerdaftar = Boolean(user?.email && db
    .select({ id: ccPeserta.id })
    .from(ccPeserta)
    .where(and(
      eq(ccPeserta.kegiatanId, row.id),
      eq(ccPeserta.email, user.email),
      ne(ccPeserta.status, 'batal'),
    ))
    .get())

  const cover = row.coverMediaId
    ? db.select({ publicUrl: ccMedia.publicUrl }).from(ccMedia).where(eq(ccMedia.id, row.coverMediaId)).get()
    : null

  const sekarang = new Date()

  return {
    data: {
      id: row.id,
      slug: row.slug,
      judul: row.judul,
      judulEn: row.judulEn,
      deskripsi: row.deskripsi,
      deskripsiEn: row.deskripsiEn,
      lokasi: row.lokasi,
      jamMulai: row.jamMulai,
      jamSelesai: row.jamSelesai,
      ajakan: row.ajakan,
      ajakanEn: row.ajakanEn,
      ajakanIsi: row.ajakanIsi,
      ajakanIsiEn: row.ajakanIsiEn,
      testimoni: row.testimoni ?? [],
      daring: Boolean(row.tautanDaring),
      cover: cover?.publicUrl ?? null,
      tanggalMulai: row.tanggalMulai,
      tanggalSelesai: row.tanggalSelesai,
      tutupPendaftaran: row.tutupPendaftaran,
      harga: row.harga,
      kuota: row.kuota,
      terdaftar,
      sisaKuota: row.kuota === null ? null : Math.max(0, row.kuota - terdaftar),
      fase: faseKegiatan(row, sekarang),
      pendaftaranTerbuka: pendaftaranTerbuka(row, sekarang) && (row.kuota === null || terdaftar < row.kuota),
      sudahTerdaftar,
    },
  }
})
