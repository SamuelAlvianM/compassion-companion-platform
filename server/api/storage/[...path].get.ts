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

  const inline = file.kind === 'gambar' || file.kind === 'video' || file.mimeType === 'application/pdf'

  // Konten ber-hash-nama (id acak) tidak pernah berubah, jadi aman di-cache selamanya.
  setResponseHeaders(event, {
    'Content-Type': file.mimeType,
    'Cache-Control': 'public, max-age=31536000, immutable',
    // Gambar, video, dan PDF ditampilkan inline; dokumen lain diunduh.
    'Content-Disposition': inline
      ? `inline; filename="${encodeURIComponent(file.originalName)}"`
      : `attachment; filename="${encodeURIComponent(file.originalName)}"`,
    'X-Content-Type-Options': 'nosniff',
    // Diumumkan untuk SEMUA berkas, bukan hanya video: peramban tidak bertanya
    // dulu — ia mengirim `Range` kalau tahu ini didukung, dan diam saja kalau tidak.
    'Accept-Ranges': 'bytes',
  })

  /**
   * Permintaan sebagian (`Range`) — inilah yang membuat video bisa digeser.
   *
   * Tanpa ini `<video>` cuma bisa memutar dari awal: menggeser ke menit ke-10 berarti
   * peramban harus mengunduh sembilan menit pertama dulu, dan Safari malah menolak
   * memutar sama sekali. Rekaman sesi berdurasi satu jam praktis tidak bisa dipakai.
   *
   * Yang ditangani hanya bentuk `bytes=awal-akhir` dengan satu jangkauan — itu yang
   * dikirim pemutar video. Bentuk lain (multipart, suffix range) dibiarkan jatuh ke
   * balasan utuh di bawah; jawaban 200 yang lengkap selalu sah bagi peminta Range.
   */
  const range = getRequestHeader(event, 'range')
  const cocok = range ? /^bytes=(\d+)-(\d*)$/.exec(range.trim()) : null

  if (cocok) {
    const awal = Number(cocok[1])
    const akhir = cocok[2] ? Math.min(Number(cocok[2]), file.fileSize - 1) : file.fileSize - 1

    // Jangkauan di luar berkas dijawab 416 beserta ukuran sebenarnya, bukan 200:
    // pemutar memakai balasan itu untuk membetulkan permintaannya sendiri.
    if (awal >= file.fileSize || akhir < awal) {
      setResponseHeaders(event, { 'Content-Range': `bytes */${file.fileSize}` })
      setResponseStatus(event, 416)
      return ''
    }

    setResponseStatus(event, 206)
    setResponseHeaders(event, {
      'Content-Range': `bytes ${awal}-${akhir}/${file.fileSize}`,
      'Content-Length': String(akhir - awal + 1),
    })
    return file.fileData.subarray(awal, akhir + 1)
  }

  setResponseHeaders(event, { 'Content-Length': String(file.fileSize) })
  return file.fileData
})
