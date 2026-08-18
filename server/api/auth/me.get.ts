// server/api/auth/me.get.ts
// Mengembalikan user yang sedang login, atau null. Sengaja TIDAK melempar 401 —
// halaman publik memakainya sekadar untuk tahu apakah ada sesi.
import { eq } from 'drizzle-orm'
import { userSaatIni } from '../../utils/session'
import { db } from '../../db'
import { ccUser, ROLE_LEVELS } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const user = await userSaatIni(event)
  if (!user) return { user: null }

  // Izin menulis jurnal ikut dikirim: halaman member memakainya untuk memutuskan
  // menggambar tombol "Tulis jurnal" atau tidak. Dibaca dari tabel, bukan dari
  // cookie sesi — admin bisa membukanya di tengah sesi orangnya, dan nilai yang
  // dibekukan di cookie baru berubah setelah orang itu keluar-masuk lagi.
  const akun = db
    .select({ boleh: ccUser.bolehTulisJurnal })
    .from(ccUser)
    .where(eq(ccUser.id, user.id))
    .get()

  return {
    user: {
      ...user,
      level: ROLE_LEVELS[user.role],
      bolehTulisJurnal: Boolean(akun?.boleh),
    },
  }
})
