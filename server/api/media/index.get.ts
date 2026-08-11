// server/api/media/index.get.ts
// Daftar media dengan paginasi. fileData sengaja TIDAK ikut diseleksi —
// menarik blob untuk sebuah listing akan sangat boros memori.

import { and, desc, eq, like, sql } from 'drizzle-orm'
import { db } from '../../db'
import { ccMedia, MEDIA_KINDS, type MediaKind } from '../../db/schema'
import { wajibRole } from '../../utils/session'

export default defineEventHandler(async (event) => {
  // Listing pustaka media membocorkan seluruh nama berkas yang pernah diunggah,
  // termasuk materi yang belum terbit. /api/storage/** tetap publik supaya <img>
  // di halaman umum tidak perlu sesi.
  await wajibRole(event, 'editor')

  const q = getQuery(event)

  const page = Math.max(1, Number(q.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(q.limit) || 24))
  const kind = typeof q.kind === 'string' && MEDIA_KINDS.includes(q.kind as MediaKind)
    ? (q.kind as MediaKind)
    : undefined

  // Pencarian dikerjakan di SQL, bukan di klien seperti daftar event: pustaka media
  // tumbuh setiap unggahan dan sudah berpaginasi, jadi menyaring di klien hanya akan
  // menyaring satu halaman — berkas yang dicari justru sering ada di halaman lain.
  const cari = typeof q.cari === 'string' ? q.cari.trim() : ''

  const syarat = [
    kind ? eq(ccMedia.kind, kind) : undefined,
    cari ? like(ccMedia.originalName, `%${cari}%`) : undefined,
  ].filter(Boolean)

  const where = syarat.length ? and(...syarat) : undefined

  const rows = await db
    .select({
      id: ccMedia.id,
      originalName: ccMedia.originalName,
      fileName: ccMedia.fileName,
      mimeType: ccMedia.mimeType,
      fileSize: ccMedia.fileSize,
      storageKey: ccMedia.storageKey,
      publicUrl: ccMedia.publicUrl,
      kind: ccMedia.kind,
      uploadedBy: ccMedia.uploadedBy,
      uploadedAt: ccMedia.uploadedAt,
    })
    .from(ccMedia)
    .where(where)
    .orderBy(desc(ccMedia.uploadedAt))
    .limit(limit)
    .offset((page - 1) * limit)

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(ccMedia)
    .where(where)

  return {
    data: rows,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }
})
