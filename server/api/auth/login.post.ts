// server/api/auth/login.post.ts
import { eq, or } from 'drizzle-orm'
import { db } from '../../db'
import { ccUser } from '../../db/schema'
import { verifyPassword } from '../../utils/password'
import { setSesiUser } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ username?: string, password?: string }>(event)
  const username = body?.username?.trim()
  const password = body?.password

  if (!username || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Username dan password wajib diisi' })
  }

  // Boleh masuk memakai username atau email.
  const user = db
    .select()
    .from(ccUser)
    .where(or(eq(ccUser.username, username), eq(ccUser.email, username)))
    .get()

  // Pesan galat sengaja sama untuk "user tidak ada" dan "password salah": membedakan
  // keduanya akan memberi tahu penyerang username mana yang terdaftar.
  const gagal = () => createError({ statusCode: 401, statusMessage: 'Username atau password salah' })

  if (!user || !user.isActive) throw gagal()
  if (!(await verifyPassword(password, user.password))) throw gagal()

  db.update(ccUser).set({ lastLogin: new Date() }).where(eq(ccUser.id, user.id)).run()

  const aman = {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
  }
  await setSesiUser(event, aman)

  return { status: 200, message: 'Berhasil masuk', data: aman }
})
