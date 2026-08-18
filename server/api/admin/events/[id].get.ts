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

  const berkas = (mediaId: string | null) => mediaId
    ? db
        .select({ id: ccMedia.id, publicUrl: ccMedia.publicUrl, originalName: ccMedia.originalName })
        .from(ccMedia)
        .where(eq(ccMedia.id, mediaId))
        .get() ?? null
    : null

  // `cover`/`thumbnail` dikirim sebagai alamat siap pakai, bukan cuma id-nya:
  // formulir menggambar pratinjau keduanya, dan tanpa ini ia harus menebak URL
  // dari id — bentuk yang hanya diketahui media-services.
  const cover = berkas(kegiatan.coverMediaId)
  const thumbnail = berkas(kegiatan.thumbnailMediaId)

  return {
    data: {
      ...kegiatan,
      cover: cover?.publicUrl ?? null,
      thumbnail: thumbnail?.publicUrl ?? null,
    },
    sesi: await susunSesi(kegiatan.id, true, true),
  }
})
