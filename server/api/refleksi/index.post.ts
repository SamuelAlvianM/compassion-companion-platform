// server/api/refleksi/index.post.ts
// Tulis refleksi baru. Wajib masuk.

import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { ccRefleksi, ccKegiatan, REFLEKSI_VISIBILITAS, type RefleksiVisibilitas } from '../../db/schema'
import { wajibLogin } from '../../utils/session'

const PANJANG_MAKS = 5000

export default defineEventHandler(async (event) => {
  const user = await wajibLogin(event)
  const body = await readBody<{
    isi?: string
    kegiatanSlug?: string
    visibilitas?: string
    mediaId?: string
  }>(event)

  const isi = body?.isi?.trim()
  if (!isi) throw createError({ statusCode: 400, statusMessage: 'Isi refleksi tidak boleh kosong' })
  if (isi.length > PANJANG_MAKS) {
    throw createError({ statusCode: 400, statusMessage: `Refleksi maksimal ${PANJANG_MAKS} karakter` })
  }

  const visibilitas: RefleksiVisibilitas =
    REFLEKSI_VISIBILITAS.includes(body?.visibilitas as RefleksiVisibilitas)
      ? (body!.visibilitas as RefleksiVisibilitas)
      : 'publik'

  let kegiatanId: string | null = null
  if (body?.kegiatanSlug) {
    const kegiatan = db
      .select({ id: ccKegiatan.id })
      .from(ccKegiatan)
      .where(eq(ccKegiatan.slug, body.kegiatanSlug))
      .get()
    if (!kegiatan) throw createError({ statusCode: 404, statusMessage: 'Kegiatan tidak ditemukan' })
    kegiatanId = kegiatan.id
  }

  const [dibuat] = db
    .insert(ccRefleksi)
    .values({ userId: user.id, kegiatanId, isi, visibilitas, mediaId: body?.mediaId ?? null })
    .returning()
    .all()

  setResponseStatus(event, 201)
  return { status: 201, message: 'Refleksi tersimpan', data: dibuat }
})
