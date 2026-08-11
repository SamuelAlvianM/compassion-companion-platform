// server/api/refleksi/[id].delete.ts
// Hapus refleksi. Boleh oleh penulisnya sendiri atau pengelola (level <= 2).

import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { ccRefleksi, ROLE_LEVELS } from '../../db/schema'
import { wajibLogin } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const user = await wajibLogin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID diperlukan' })

  const refleksi = db.select().from(ccRefleksi).where(eq(ccRefleksi.id, id)).get()
  if (!refleksi) throw createError({ statusCode: 404, statusMessage: 'Refleksi tidak ditemukan' })

  if (refleksi.userId !== user.id && ROLE_LEVELS[user.role] > 2) {
    throw createError({ statusCode: 403, statusMessage: 'Hanya penulis yang bisa menghapus refleksi ini' })
  }

  db.delete(ccRefleksi).where(eq(ccRefleksi.id, id)).run()
  return { status: 200, message: 'Refleksi dihapus' }
})
