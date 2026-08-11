// server/api/auth/me.get.ts
// Mengembalikan user yang sedang login, atau null. Sengaja TIDAK melempar 401 —
// halaman publik memakainya sekadar untuk tahu apakah ada sesi.
import { userSaatIni } from '../../utils/session'
import { ROLE_LEVELS } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const user = await userSaatIni(event)
  return { user: user ? { ...user, level: ROLE_LEVELS[user.role] } : null }
})
