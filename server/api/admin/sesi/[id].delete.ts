// server/api/admin/sesi/[id].delete.ts
// Hapus sesi beserta seluruh itemnya (ON DELETE CASCADE di cc_sesi_item).
//
// Berkas di cc_media sengaja TIDAK ikut dihapus: satu media bisa dipakai beberapa
// item, dan menghapusnya di sini akan mematikan tautan di sesi lain.

import { eq } from 'drizzle-orm'
import { db } from '../../../db'
import { ccSesi } from '../../../db/schema'
import { wajibRole } from '../../../utils/session'

export default defineEventHandler(async (event) => {
  await wajibRole(event, 'editor')

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID sesi wajib diisi' })

  const sesi = db.select({ id: ccSesi.id }).from(ccSesi).where(eq(ccSesi.id, id)).get()
  if (!sesi) throw createError({ statusCode: 404, statusMessage: 'Sesi tidak ditemukan' })

  db.delete(ccSesi).where(eq(ccSesi.id, id)).run()
  return { ok: true }
})
