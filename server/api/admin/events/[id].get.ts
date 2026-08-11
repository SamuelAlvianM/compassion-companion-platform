// server/api/admin/events/[id].get.ts
// Detail kegiatan untuk form admin: seluruh kolom + semua sesi, termasuk yang
// `tampil = false` dan seluruh materi terkunci (pengelola memang berhak).

import { eq } from 'drizzle-orm'
import { db } from '../../../db'
import { ccKegiatan, ccMedia } from '../../../db/schema'
import { wajibRole } from '../../../utils/session'
import { susunSesi } from '../../../utils/sesi-payload'

export default defineEventHandler(async (event) => {
  await wajibRole(event, 'editor')

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID kegiatan wajib diisi' })

  const kegiatan = db.select().from(ccKegiatan).where(eq(ccKegiatan.id, id)).get()
  if (!kegiatan) throw createError({ statusCode: 404, statusMessage: 'Kegiatan tidak ditemukan' })

  const cover = kegiatan.coverMediaId
    ? db
        .select({ id: ccMedia.id, publicUrl: ccMedia.publicUrl, originalName: ccMedia.originalName })
        .from(ccMedia)
        .where(eq(ccMedia.id, kegiatan.coverMediaId))
        .get()
    : null

  return {
    data: { ...kegiatan, cover: cover ?? null },
    sesi: await susunSesi(kegiatan.id, true, true),
  }
})
