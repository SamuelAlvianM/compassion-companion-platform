// server/api/users/password.post.ts
// Ganti password sendiri.
//
// Password lama tetap diminta meski sesi sudah terbukti valid: kalau ada perangkat
// yang tertinggal dalam keadaan masuk, orang lain tidak boleh bisa mengunci pemilik
// akun keluar hanya dengan mengganti passwordnya.

import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { ccUser } from '../../db/schema'
import { hashPassword, verifyPassword } from '../../utils/password'
import { wajibLogin } from '../../utils/session'

// 6, bukan 8: kredensial yang dipakai sekarang (mis. `user123`, 7 karakter) harus
// tetap bisa dipasang ulang lewat form ini. Kalau nanti kredensial produksi sudah
// ditetapkan, naikkan ke 12 sekalian — 6 terlalu longgar untuk situs sungguhan.
const PANJANG_MINIMAL = 6

export default defineEventHandler(async (event) => {
  const sesi = await wajibLogin(event)
  const body = await readBody<{ passwordLama?: string, passwordBaru?: string }>(event)

  const lama = body?.passwordLama ?? ''
  const baru = body?.passwordBaru ?? ''

  if (!lama || !baru) {
    throw createError({ statusCode: 400, statusMessage: 'Password lama dan baru wajib diisi' })
  }
  if (baru.length < PANJANG_MINIMAL) {
    throw createError({
      statusCode: 400,
      statusMessage: `Password baru minimal ${PANJANG_MINIMAL} karakter`,
    })
  }
  if (baru === lama) {
    throw createError({ statusCode: 400, statusMessage: 'Password baru harus berbeda dari yang lama' })
  }

  const user = db.select().from(ccUser).where(eq(ccUser.id, sesi.id)).get()
  if (!user) throw createError({ statusCode: 404, statusMessage: 'User tidak ditemukan' })

  if (!(await verifyPassword(lama, user.password))) {
    throw createError({ statusCode: 401, statusMessage: 'Password lama salah' })
  }

  db.update(ccUser)
    .set({ password: await hashPassword(baru) })
    .where(eq(ccUser.id, user.id))
    .run()

  return { status: 200, message: 'Password berhasil diubah' }
})
