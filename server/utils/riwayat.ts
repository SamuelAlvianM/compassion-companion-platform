// server/utils/riwayat.ts
// Riwayat keikutsertaan seorang user pada kegiatan.
//
// Dicocokkan lewat userId ATAU email: pendaftaran yang dibuat sebelum seseorang
// punya akun tersimpan dengan userId null, dan pendaftaran itu tetap miliknya.
//
// Pendaftaran berstatus `batal` TIDAK ikut. Riwayat ini menjawab "event apa saja
// yang pernah diikuti orang ini", dan yang dibatalkan justru berarti ia tidak
// ikut — barisnya hanya menambah nama event yang tidak pernah ia hadiri. Disaring
// di sini, satu tempat, karena keduanya yang memakai — halaman profil dan panel
// detail user di /admin/members — sama-sama sudah tidak menampilkan status.
//
// Yang batal tetap terlihat utuh di tab "Daftar peserta" event yang bersangkutan;
// di sanalah pembatalan diurus dan bisa dianulir.

import { and, desc, eq, ne, or } from 'drizzle-orm'
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
    .where(and(cocok, ne(ccPeserta.status, 'batal')))
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
      // `hadir` sekarang diturunkan dari kolom hadir_pada, bukan dari status —
      // status hanya menceritakan perjalanan pendaftaran, bukan kehadiran.
      hadir: data.filter(d => Boolean(d.hadirPada)).length,
      konfirmasi: data.filter(d => d.status === 'konfirmasi').length,
      diproses: data.filter(d => d.status === 'baru' || d.status === 'proses').length,
      selesai: data.filter(d => d.fase === 'selesai').length,
    },
  }
}
