// server/utils/riwayat.ts
// Riwayat keikutsertaan seorang user pada kegiatan.
//
// Dicocokkan lewat userId ATAU email: pendaftaran yang dibuat sebelum seseorang
// punya akun tersimpan dengan userId null, dan pendaftaran itu tetap miliknya.

import { and, desc, eq, or } from 'drizzle-orm'
import { db } from '../db'
import { ccKegiatan, ccPeserta } from '../db/schema'
import { faseKegiatan } from './kegiatan'

export const riwayatKegiatan = async (userId: string, email: string | null) => {
  const cocok = email
    ? or(eq(ccPeserta.userId, userId), eq(ccPeserta.email, email))
    : eq(ccPeserta.userId, userId)

  const rows = await db
    .select({
      pesertaId: ccPeserta.id,
      status: ccPeserta.status,
      terdaftarPada: ccPeserta.terdaftarPada,
      hadirPada: ccPeserta.hadirPada,
      slug: ccKegiatan.slug,
      judul: ccKegiatan.judul,
      judulEn: ccKegiatan.judulEn,
      lokasi: ccKegiatan.lokasi,
      harga: ccKegiatan.harga,
      kegiatanStatus: ccKegiatan.status,
      tanggalMulai: ccKegiatan.tanggalMulai,
      tanggalSelesai: ccKegiatan.tanggalSelesai,
    })
    .from(ccPeserta)
    .innerJoin(ccKegiatan, eq(ccPeserta.kegiatanId, ccKegiatan.id))
    .where(and(cocok))
    .orderBy(desc(ccKegiatan.tanggalMulai))

  const sekarang = new Date()
  const data = rows.map(row => ({
    ...row,
    fase: faseKegiatan(
      { status: row.kegiatanStatus, tanggalMulai: row.tanggalMulai, tanggalSelesai: row.tanggalSelesai },
      sekarang,
    ),
  }))

  return {
    data,
    ringkas: {
      total: data.length,
      hadir: data.filter(d => d.status === 'hadir').length,
      terkonfirmasi: data.filter(d => d.status === 'terkonfirmasi').length,
      menunggu: data.filter(d => d.status === 'menunggu').length,
      selesai: data.filter(d => d.fase === 'selesai').length,
    },
  }
}
