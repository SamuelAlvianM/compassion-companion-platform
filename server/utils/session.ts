// server/utils/session.ts
// Sesi berbasis cookie terenkripsi (h3 `useSession`) — tanpa tabel sesi di database.
//
// Isinya sengaja minimal: id, username, nama, role. Cukup untuk memutuskan hak akses
// dan untuk mengisi otomatis formulir pendaftaran, tanpa menaruh data sensitif di cookie.

import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { ccUser, hasAtLeast, type UserRole } from '../db/schema'

export interface SessionUser {
  id: string
  username: string
  fullName: string
  email: string | null
  role: UserRole
}

const sessionConfig = () => {
  const password = useRuntimeConfig().sessionPassword

  // Digagalkan di sini, bukan dibiarkan memakai nilai bawaan. Kunci sesi yang lemah
  // atau seragam antar-salinan repo berarti cookie master bisa dipalsukan — kegagalan
  // yang tidak menimbulkan gejala apa pun sampai ada yang memanfaatkannya.
  if (!password || password.length < 32) {
    throw createError({
      statusCode: 500,
      statusMessage:
        'NUXT_SESSION_PASSWORD belum diisi atau kurang dari 32 karakter. Salin .env.example jadi .env lalu isi nilainya.',
    })
  }

  return {
    name: 'cc-session',
    password,
    cookie: {
      httpOnly: true,
      sameSite: 'lax' as const,
      // `secure` mengikuti protokol: di dev (http://localhost) cookie tetap terkirim,
      // di produksi (https) cookie hanya dikirim lewat koneksi terenkripsi.
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30,
    },
  }
}

export const ambilSesi = (event: H3Event) => useSession<{ user?: SessionUser }>(event, sessionConfig())

export const setSesiUser = async (event: H3Event, user: SessionUser) => {
  const session = await ambilSesi(event)
  await session.update({ user })
}

export const hapusSesi = async (event: H3Event) => {
  const session = await ambilSesi(event)
  await session.clear()
}

/** User yang sedang login, atau null. Tidak melempar error. */
export const userSaatIni = async (event: H3Event): Promise<SessionUser | null> => {
  const session = await ambilSesi(event)
  const user = session.data.user
  if (!user) return null

  // Diverifikasi ulang ke database supaya akun yang dinonaktifkan atau rolenya
  // diturunkan langsung kehilangan akses, tanpa menunggu cookie kedaluwarsa.
  const segar = db
    .select({
      id: ccUser.id,
      username: ccUser.username,
      fullName: ccUser.fullName,
      email: ccUser.email,
      role: ccUser.role,
      isActive: ccUser.isActive,
    })
    .from(ccUser)
    .where(eq(ccUser.id, user.id))
    .get()

  if (!segar?.isActive) return null
  const { isActive: _aktif, ...bersih } = segar
  return bersih
}

/** Wajib login. Melempar 401 kalau tidak ada sesi. */
export const wajibLogin = async (event: H3Event) => {
  const user = await userSaatIni(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Perlu masuk terlebih dahulu' })
  return user
}

/** Wajib login DAN role minimal tertentu. Melempar 401 atau 403. */
export const wajibRole = async (event: H3Event, minimal: UserRole) => {
  const user = await wajibLogin(event)
  if (!hasAtLeast(user.role, minimal)) {
    throw createError({ statusCode: 403, statusMessage: 'Wewenang tidak mencukupi' })
  }
  return user
}
