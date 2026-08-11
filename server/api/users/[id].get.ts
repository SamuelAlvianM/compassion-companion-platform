// server/api/users/[id].get.ts
// Profil satu user + riwayat kegiatan + refleksinya.
// Boleh diakses oleh user itu sendiri, atau pengelola (level <= 3).

import { wajibLogin } from '../../utils/session'
import { bangunProfil } from '../../utils/profil'

export default defineEventHandler(async (event) => {
  const pengakses = await wajibLogin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID diperlukan' })

  return bangunProfil(pengakses, id)
})
