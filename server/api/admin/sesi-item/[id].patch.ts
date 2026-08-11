// server/api/admin/sesi-item/[id].patch.ts
// Ubah satu item sesi. Body lengkap (bukan parsial) karena jenis, berkas, dan
// tautan saling bergantung — memvalidasinya sepotong-sepotong bisa menghasilkan
// kombinasi yang mustahil, mis. jenis `youtube` tanpa URL.

import { eq } from 'drizzle-orm'
import { db } from '../../../db'
import { ccMedia, ccSesiItem } from '../../../db/schema'
import { wajibRole } from '../../../utils/session'
import { bacaItem, salah } from '../../../utils/validasi-event'

export default defineEventHandler(async (event) => {
  await wajibRole(event, 'editor')

  const id = getRouterParam(event, 'id')
  if (!id) throw salah('ID item wajib diisi')

  const lama = db.select().from(ccSesiItem).where(eq(ccSesiItem.id, id)).get()
  if (!lama) throw createError({ statusCode: 404, statusMessage: 'Item tidak ditemukan' })

  const body = await readBody<Record<string, unknown>>(event) ?? {}
  const data = bacaItem({ bagian: lama.bagian, urutan: lama.urutan, ...body })

  if (data.mediaId && data.mediaId !== lama.mediaId) {
    const media = db.select({ id: ccMedia.id }).from(ccMedia).where(eq(ccMedia.id, data.mediaId)).get()
    if (!media) throw salah('Berkas tidak ditemukan di pustaka media')
  }

  return { data: db.update(ccSesiItem).set(data).where(eq(ccSesiItem.id, id)).returning().get() }
})
