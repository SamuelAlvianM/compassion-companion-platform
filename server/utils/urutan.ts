// server/utils/urutan.ts
// Menggeser satu baris naik atau turun di dalam daftar berurutan.
//
// Dipakai untuk sesi maupun item sesi — keduanya punya kolom `urutan` dengan aturan
// yang sama, jadi logikanya ditulis sekali di sini.
//
// Yang ditukar bukan sekadar nilai `urutan` dua baris, melainkan SELURUH daftar
// ditulis ulang jadi 0..n-1 setelah pertukaran. Alasannya: `urutan` tidak dijamin
// rapat maupun unik — nilai bawaannya 0, PATCH boleh menaruh angka apa pun, dan
// penghapusan meninggalkan lubang. Pada daftar dengan dua baris berurutan sama,
// menukar nilainya tidak mengubah apa pun dan tombol geser tampak rusak tanpa galat.
// Menormalkan sekalian membuat keadaan itu sembuh sendiri begitu tombolnya dipakai.

import { salah } from './validasi-event'

export type Arah = 'naik' | 'turun'

export const bacaArah = (nilai: unknown): Arah => {
  if (nilai !== 'naik' && nilai !== 'turun') throw salah('Arah harus "naik" atau "turun"')
  return nilai
}

/**
 * Hitung urutan baru untuk seluruh daftar setelah `id` digeser satu langkah.
 *
 * @param daftar  sudah terurut sebagaimana ditampilkan (urutan, lalu createdAt)
 * @returns pasangan {id, urutan} untuk ditulis; kosong bila baris sudah di ujung
 */
export const geserDalamDaftar = <T extends { id: string }>(
  daftar: T[],
  id: string,
  arah: Arah,
): { id: string, urutan: number }[] => {
  const i = daftar.findIndex(baris => baris.id === id)
  if (i === -1) throw createError({ statusCode: 404, statusMessage: 'Baris tidak ditemukan di daftarnya' })

  const tujuan = arah === 'naik' ? i - 1 : i + 1
  // Sudah di ujung: bukan galat, hanya tidak ada yang perlu dikerjakan. Tombolnya
  // memang sudah dinonaktifkan di sana, tapi klik ganda yang cepat masih bisa
  // menyusul setelah daftarnya bergeser.
  if (tujuan < 0 || tujuan >= daftar.length) return []

  const baru = [...daftar]
  ;[baru[i], baru[tujuan]] = [baru[tujuan]!, baru[i]!]

  return baru.map((baris, urutan) => ({ id: baris.id, urutan }))
}
