// server/api/users/password.post.ts
// Ganti password sendiri.
//
// `passwordLama` OPSIONAL. Kalau dikirim, ia diverifikasi seperti biasa; kalau
// dikosongkan, password tetap diganti selama sesinya sah.
//
// Ini melonggarkan perlindungan yang sebelumnya ada di sini, dan konsekuensinya
// perlu tercatat: dulu password lama diminta supaya perangkat yang tertinggal dalam
// keadaan masuk tidak bisa dipakai orang lain mengunci pemiliknya keluar. Dengan
// jalur ini, siapa pun yang memegang perangkat yang masih login bisa mengganti
// password tanpa mengetahui yang lama.
//
// Ditukar secara sadar dengan alasan yang berlaku di situs ini: akun tidak dibuat
// sendiri oleh pemakainya melainkan oleh admin, dan passwordnya dikirim lewat
// WhatsApp — jadi "lupa password lama" bukan kejadian langka melainkan keadaan
// normal, dan sebelum ini satu-satunya jalan keluar adalah menghubungi admin.
// Yang menjaga pintunya sekarang tinggal sesi itu sendiri: cookie terenkripsi,
// httpOnly, dan diverifikasi ulang ke database tiap permintaan.
//
// Kalau suatu saat situs ini dipakai orang di perangkat bersama, kembalikan
// kewajiban `passwordLama` di sini dan sandarkan pemulihan pada reset oleh admin
// (POST /api/admin/users/[id]/password) yang sudah ada.

import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { ccUser } from '../../db/schema'
import { hashPassword, verifyPassword, wajibPanjang } from '../../utils/password'
import { wajibLogin } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const sesi = await wajibLogin(event)
  const body = await readBody<{ passwordLama?: string, passwordBaru?: string }>(event)

  const lama = body?.passwordLama ?? ''
  const baru = body?.passwordBaru ?? ''

  if (!baru) throw createError({ statusCode: 400, statusMessage: 'Password baru wajib diisi' })
  wajibPanjang(baru)

  const user = db.select().from(ccUser).where(eq(ccUser.id, sesi.id)).get()
  if (!user) throw createError({ statusCode: 404, statusMessage: 'User tidak ditemukan' })

  // Hanya diperiksa kalau memang dikirim. Yang mengisinya berhak tahu kalau salah
  // ketik — diam-diam menerimanya akan membuat orang mengira password lamanya
  // benar padahal bukan.
  if (lama && !(await verifyPassword(lama, user.password))) {
    throw createError({ statusCode: 401, statusMessage: 'Password lama salah' })
  }

  if (baru === lama) {
    throw createError({ statusCode: 400, statusMessage: 'Password baru harus berbeda dari yang lama' })
  }

  db.update(ccUser)
    .set({ password: await hashPassword(baru) })
    .where(eq(ccUser.id, user.id))
    .run()

  return { status: 200, message: 'Password berhasil diubah' }
})
