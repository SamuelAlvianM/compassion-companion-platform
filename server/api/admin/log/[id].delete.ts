// server/api/admin/log/[id].delete.ts
// Hapus satu baris log. Master saja, sama seperti membacanya.

import { eq } from 'drizzle-orm'
import { db } from '../../../db'
import { ccLog } from '../../../db/schema'
import { wajibRole } from '../../../utils/session'

export default defineEventHandler(async (event) => {
  await wajibRole(event, 'master')

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Id catatan tidak ada' })

  const hasil = db.delete(ccLog).where(eq(ccLog.id, id)).run()
  if (!hasil.changes) throw createError({ statusCode: 404, statusMessage: 'Catatan tidak ditemukan' })

  return { data: { id } }
})
