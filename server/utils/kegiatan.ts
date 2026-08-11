// server/utils/kegiatan.ts
//
// Ada DUA konsep berbeda yang gampang tertukar:
//
//   status (kolom di DB) — keadaan redaksional: draft | terbit | selesai | batal.
//                          Ditentukan admin, tidak berubah sendiri.
//   fase   (diturunkan)  — posisi terhadap waktu sekarang:
//                          mendatang | berlangsung | selesai | batal.
//
// Fase TIDAK disimpan sebagai kolom. Kalau disimpan, ia akan basi begitu tanggalnya
// terlewat dan butuh cron untuk memutakhirkan. Menurunkannya saat dibaca membuatnya
// selalu benar tanpa pekerjaan latar belakang.

import type { DBKegiatan } from '../db/schema'

export const FASE = ['mendatang', 'berlangsung', 'selesai', 'batal'] as const
export type Fase = (typeof FASE)[number]

export const FASE_LABEL: Record<Fase, { id: string, en: string }> = {
  mendatang: { id: 'Mendatang', en: 'Upcoming' },
  berlangsung: { id: 'Berlangsung', en: 'Ongoing' },
  selesai: { id: 'Selesai', en: 'Completed' },
  batal: { id: 'Dibatalkan', en: 'Cancelled' },
}

/**
 * Tentukan fase sebuah kegiatan.
 *
 * `batal` dan `selesai` di kolom status menang atas perhitungan tanggal: admin bisa
 * menutup kegiatan lebih awal, dan itu harus dihormati.
 *
 * Kegiatan tanpa tanggalSelesai dianggap berlangsung sepanjang hari tanggalMulai.
 */
export const faseKegiatan = (
  kegiatan: Pick<DBKegiatan, 'status' | 'tanggalMulai' | 'tanggalSelesai'>,
  sekarang: Date = new Date(),
): Fase => {
  if (kegiatan.status === 'batal') return 'batal'
  if (kegiatan.status === 'selesai') return 'selesai'

  const mulai = kegiatan.tanggalMulai.getTime()
  // Tanpa tanggal selesai, pakai akhir hari tanggalMulai supaya kegiatan sehari
  // tidak langsung berpindah ke "selesai" begitu jam mulai lewat.
  const selesai = (kegiatan.tanggalSelesai ?? kegiatan.tanggalMulai).getTime() + 86_400_000 - 1
  const kini = sekarang.getTime()

  if (kini < mulai) return 'mendatang'
  if (kini > selesai) return 'selesai'
  return 'berlangsung'
}

/** Pendaftaran hanya terbuka untuk kegiatan yang belum lewat dan belum ditutup. */
export const pendaftaranTerbuka = (
  kegiatan: Pick<DBKegiatan, 'status' | 'tanggalMulai' | 'tanggalSelesai' | 'tutupPendaftaran'>,
  sekarang: Date = new Date(),
) => {
  const fase = faseKegiatan(kegiatan, sekarang)
  if (fase === 'selesai' || fase === 'batal') return false
  if (kegiatan.status !== 'terbit') return false
  if (kegiatan.tutupPendaftaran && sekarang.getTime() > kegiatan.tutupPendaftaran.getTime()) return false
  return true
}
