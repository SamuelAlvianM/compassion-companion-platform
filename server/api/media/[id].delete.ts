// server/api/media/[id].delete.ts
import { mediaService } from '../../utils/media-services'
import { wajibRole } from '../../utils/session'

export default defineEventHandler(async (event) => {
  await wajibRole(event, 'editor')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID diperlukan' })
  }

  // Baris di cc_media_gambar / _video / _etc ikut terhapus lewat ON DELETE CASCADE.
  const dihapus = await mediaService.deleteMedia(id)
  if (!dihapus.length) {
    throw createError({ statusCode: 404, statusMessage: 'Media tidak ditemukan' })
  }

  return { status: 200, message: 'Media dihapus', data: dihapus[0] }
})
