// server/api/admin/sesi-item/[id].delete.ts
// Hapus satu item sesi. Berkasnya tetap di pustaka media — lihat alasan yang sama
// di server/api/admin/sesi/[id].delete.ts.

import { eq } from 'drizzle-orm'
import { db } from '../../../db'
import { ccSesiItem } from '../../../db/schema'
import { wajibRole } from '../../../utils/session'

export default defineEventHandler(async (event) => {
  await wajibRole(event, 'editor')

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID item wajib diisi' })

  const item = db.select({ id: ccSesiItem.id }).from(ccSesiItem).where(eq(ccSesiItem.id, id)).get()
  if (!item) throw createError({ statusCode: 404, statusMessage: 'Item tidak ditemukan' })

  db.delete(ccSesiItem).where(eq(ccSesiItem.id, id)).run()
  return { ok: true }
})
