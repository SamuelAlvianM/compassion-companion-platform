// server/api/admin/sesi-item/index.post.ts
// Tambah materi / foto galeri / referensi ke sebuah sesi.

import { and, eq, sql } from 'drizzle-orm'
import { db } from '../../../db'
import { ccMedia, ccSesi, ccSesiItem } from '../../../db/schema'
import { wajibRole } from '../../../utils/session'
import { bacaItem, salah } from '../../../utils/validasi-event'

export default defineEventHandler(async (event) => {
  await wajibRole(event, 'editor')

  const body = await readBody<Record<string, unknown>>(event) ?? {}
  const sesiId = typeof body.sesiId === 'string' ? body.sesiId : ''
  if (!sesiId) throw salah('sesiId wajib diisi')

  const sesi = db.select({ id: ccSesi.id }).from(ccSesi).where(eq(ccSesi.id, sesiId)).get()
  if (!sesi) throw createError({ statusCode: 404, statusMessage: 'Sesi tidak ditemukan' })

  const data = bacaItem(body)

  // Media divalidasi keberadaannya di sini. Tanpa ini, mediaId ngawur akan lolos
  // (FK-nya `set null` saat dihapus, bukan penolak saat disisipkan) dan itemnya
  // jadi baris yang tidak menunjuk ke mana-mana.
  if (data.mediaId) {
    const media = db.select({ id: ccMedia.id }).from(ccMedia).where(eq(ccMedia.id, data.mediaId)).get()
    if (!media) throw salah('Berkas tidak ditemukan di pustaka media')
  }

  const puncak = db
    .select({ maks: sql<number | null>`max(${ccSesiItem.urutan})` })
    .from(ccSesiItem)
    .where(and(eq(ccSesiItem.sesiId, sesiId), eq(ccSesiItem.bagian, data.bagian)))
    .get()

  const item = db
    .insert(ccSesiItem)
    .values({ ...data, sesiId, urutan: (puncak?.maks ?? -1) + 1 })
    .returning()
    .get()

  return { data: item }
})
