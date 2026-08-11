// server/api/media/upload.post.ts
// Terima multipart/form-data, simpan blob ke cc_media + metadata ke tabel subtype.
//
// Field:
//   file        (wajib)  — berkas yang diunggah, boleh lebih dari satu
//   hanyaKind   (opsional) — 'gambar' | 'video' | 'etc' untuk membatasi jenis
//   altText     (opsional) — teks alternatif, khusus gambar
//   caption     (opsional)

import { simpanMedia } from '../../utils/media-services'
import { MEDIA_KINDS, type MediaKind } from '../../db/schema'
import { wajibRole } from '../../utils/session'

export default defineEventHandler(async (event) => {
  // Dulu endpoint ini terbuka untuk siapa saja. Sejak materi event diunggah lewat
  // sini, siapa pun bisa menitipkan berkas ke database kalau dibiarkan.
  const user = await wajibRole(event, 'editor')

  const form = await readMultipartFormData(event)
  if (!form?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Tidak ada file yang diunggah' })
  }

  const textField = (name: string) =>
    form.find((f) => f.name === name && !f.filename)?.data.toString('utf-8')

  const rawKind = textField('hanyaKind')
  if (rawKind && !MEDIA_KINDS.includes(rawKind as MediaKind)) {
    throw createError({
      statusCode: 400,
      statusMessage: `hanyaKind harus salah satu dari: ${MEDIA_KINDS.join(', ')}`,
    })
  }

  const files = form.filter((f) => f.name === 'file' && f.filename && f.data?.length)
  if (!files.length) {
    throw createError({ statusCode: 400, statusMessage: "Field 'file' wajib ada" })
  }

  const hasil = []
  for (const part of files) {
    hasil.push(
      await simpanMedia({
        originalName: part.filename!,
        mimeType: part.type || 'application/octet-stream',
        data: part.data,
        hanyaKind: (rawKind as MediaKind) || undefined,
        altText: textField('altText'),
        caption: textField('caption'),
      }),
    )
  }

  setResponseStatus(event, 201)
  return {
    status: 201,
    message: `${hasil.length} file berhasil diunggah`,
    data: hasil,
  }
})
