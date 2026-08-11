// server/api/storage/[...path].get.ts
// Melayani binary file dari DB berdasarkan storageKey.
// Contoh: GET /api/storage/uploads/2026/08/ccm-A1b2C3d4.png
//
// Pola sama dengan website-cosmos, hanya sumber blob-nya SQLite.

import { mediaService } from '../../utils/media-services'

export default defineEventHandler(async (event) => {
  const pathParam = getRouterParam(event, 'path')
  if (!pathParam) {
    throw createError({ statusCode: 400, statusMessage: 'Path diperlukan' })
  }

  // Tolak percobaan path traversal sebelum menyentuh database.
  if (pathParam.includes('..')) {
    throw createError({ statusCode: 400, statusMessage: 'Path tidak valid' })
  }

  // storageKey di DB disimpan sebagai "/storage/uploads/..."
  const file = await mediaService.getByStorageKey(`/storage/${pathParam}`)

  if (!file?.fileData) {
    throw createError({ statusCode: 404, statusMessage: 'File tidak ditemukan' })
  }

  // Konten ber-hash-nama (id acak) tidak pernah berubah, jadi aman di-cache selamanya.
  setResponseHeaders(event, {
    'Content-Type': file.mimeType,
    'Content-Length': String(file.fileSize),
    'Cache-Control': 'public, max-age=31536000, immutable',
    // Gambar, video, dan PDF ditampilkan inline; dokumen lain diunduh.
    'Content-Disposition':
      file.kind === 'gambar' || file.kind === 'video' || file.mimeType === 'application/pdf'
        ? `inline; filename="${encodeURIComponent(file.originalName)}"`
        : `attachment; filename="${encodeURIComponent(file.originalName)}"`,
    'X-Content-Type-Options': 'nosniff',
  })

  return file.fileData
})
