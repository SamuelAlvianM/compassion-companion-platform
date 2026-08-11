// server/api/auth/logout.post.ts
import { hapusSesi } from '../../utils/session'

export default defineEventHandler(async (event) => {
  await hapusSesi(event)
  return { status: 200, message: 'Berhasil keluar' }
})
