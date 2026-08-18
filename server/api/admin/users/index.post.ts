// server/api/admin/users/index.post.ts
// Buat akun baru. Satu-satunya cara akun lahir di situs ini selain seeder —
// tidak ada pendaftaran mandiri, dan memang tidak direncanakan ada.

import { db } from '../../../db'
import { ccUser, LOG_AKSI, ROLE_LABELS, ROLE_LEVELS } from '../../../db/schema'
import { hashPassword, wajibPanjang } from '../../../utils/password'
import { wajibRole } from '../../../utils/session'
import { bacaUser } from '../../../utils/validasi-user'
import { wajibKelolaAkun } from '../../../utils/wewenang-akun'
import { catatLog } from '../../../utils/log'

export default defineEventHandler(async (event) => {
  const aktor = await wajibRole(event, 'admin')

  const body = await readBody<Record<string, unknown>>(event) ?? {}

  const password = typeof body.password === 'string' ? body.password : ''
  if (!password) throw createError({ statusCode: 400, statusMessage: 'Password wajib diisi' })
  wajibPanjang(password)

  const data = bacaUser(body)

  // Diperiksa SEBELUM barisnya ditulis: admin yang membuat akun master lalu masuk
  // ke situ sama saja dengan menaikkan pangkatnya sendiri.
  wajibKelolaAkun(aktor, data.role)

  const dibuat = db
    .insert(ccUser)
    .values({ ...data, password: await hashPassword(password) })
    .returning({
      id: ccUser.id,
      username: ccUser.username,
      fullName: ccUser.fullName,
      email: ccUser.email,
      role: ccUser.role,
      phoneNumber: ccUser.phoneNumber,
      isActive: ccUser.isActive,
      createdAt: ccUser.createdAt,
    })
    .get()

  catatLog(aktor, {
    segmen: 'member',
    aksi: LOG_AKSI.memberDibuat,
    objekId: dibuat.id,
    objekLabel: dibuat.fullName,
    objekSlug: null,
    catatan: `Username ${dibuat.username}, role ${ROLE_LABELS[dibuat.role]}`,
  })

  return {
    data: { ...dibuat, level: ROLE_LEVELS[dibuat.role], roleLabel: ROLE_LABELS[dibuat.role] },
  }
})
