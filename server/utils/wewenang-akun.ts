// server/utils/wewenang-akun.ts
// Siapa boleh mengubah akun siapa.
//
// Dipisah dari handler-nya karena aturan ini dipakai tiga endpoint (buat akun,
// ubah akun, reset password) dan satu saja yang lupa memeriksanya sudah cukup untuk
// membuka jalan naik pangkat: admin (level 2) yang bisa mereset password master
// (level 1) tinggal masuk sebagai master.

import { ROLE_LEVELS, type UserRole } from '../db/schema'
import type { SessionUser } from './session'

/**
 * Boleh menyentuh akun dengan role `sasaran`?
 *
 * Aturannya: **wewenang harus benar-benar lebih besar**, bukan sekadar setara.
 * Dua admin yang bisa saling mereset password berarti masing-masing memegang akun
 * yang lain, dan tidak ada jejak siapa yang melakukannya.
 *
 * Master dikecualikan: ia memang didefinisikan sebagai pemegang seluruh
 * pengelolaan akun, dan tanpa pengecualian ini master yang lupa passwordnya tidak
 * bisa dipulihkan oleh siapa pun — termasuk master lain.
 *
 * Akun sendiri selalu boleh; itu urusan /api/users/me dan /api/users/password.
 */
export const bolehKelolaAkun = (aktor: SessionUser, sasaran: UserRole, sasaranId?: string) => {
  if (sasaranId && sasaranId === aktor.id) return true
  if (aktor.role === 'master') return true
  return ROLE_LEVELS[aktor.role] < ROLE_LEVELS[sasaran]
}

/** Versi yang melempar 403, untuk dipakai langsung di handler. */
export const wajibKelolaAkun = (aktor: SessionUser, sasaran: UserRole, sasaranId?: string) => {
  if (!bolehKelolaAkun(aktor, sasaran, sasaranId)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Wewenang Anda tidak mencukupi untuk akun dengan role tersebut',
    })
  }
}
