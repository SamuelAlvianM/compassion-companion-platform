// server/api/users/me.patch.ts
// Ubah profil sendiri: nama lengkap, email, nomor HP.
//
// Username dan role sengaja TIDAK bisa diubah di sini — role hanya boleh diubah
// pengelola, dan username dipakai untuk masuk sehingga perubahannya perlu alur
// tersendiri.

import { and, eq, ne } from 'drizzle-orm'
import { db } from '../../db'
import { ccUser } from '../../db/schema'
import { wajibLogin } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const user = await wajibLogin(event)
  const body = await readBody<{ fullName?: string, email?: string, phoneNumber?: string }>(event)

  const fullName = body?.fullName?.trim()
  const email = body?.email?.trim().toLowerCase() || null
  const phoneNumber = body?.phoneNumber?.trim() || null

  if (!fullName) {
    throw createError({ statusCode: 400, statusMessage: 'Nama lengkap wajib diisi' })
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw createError({ statusCode: 400, statusMessage: 'Format email tidak valid' })
  }

  // Email unik di seluruh tabel; diperiksa lebih dulu agar pesannya jelas
  // ketimbang melempar galat constraint mentah dari SQLite.
  if (email) {
    const dipakai = db
      .select({ id: ccUser.id })
      .from(ccUser)
      .where(and(eq(ccUser.email, email), ne(ccUser.id, user.id)))
      .get()
    if (dipakai) {
      throw createError({ statusCode: 409, statusMessage: 'Email itu sudah dipakai akun lain' })
    }
  }

  const [diperbarui] = db
    .update(ccUser)
    .set({ fullName, email, phoneNumber })
    .where(eq(ccUser.id, user.id))
    .returning({
      id: ccUser.id,
      username: ccUser.username,
      fullName: ccUser.fullName,
      email: ccUser.email,
      phoneNumber: ccUser.phoneNumber,
      role: ccUser.role,
    })
    .all()

  return { status: 200, message: 'Profil diperbarui', data: diperbarui }
})
