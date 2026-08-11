// server/api/users/me.get.ts
// Profil sendiri.
//
// Handler terpisah (bukan mengandalkan [id].get.ts dengan id='me'): karena
// me.patch.ts sudah mendaftarkan /api/users/me sebagai rute statis, permintaan GET
// ke path itu tidak lagi mengisi router param `id`.

import { wajibLogin } from '../../utils/session'
import { bangunProfil } from '../../utils/profil'

export default defineEventHandler(async (event) => {
  const user = await wajibLogin(event)
  return bangunProfil(user, 'me')
})
