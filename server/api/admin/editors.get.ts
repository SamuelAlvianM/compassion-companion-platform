// server/api/admin/editors.get.ts
// Daftar orang yang bisa ditugaskan mengurus sebuah jurnal: editor ke atas.
//
// Endpoint kecil sendiri, bukan menumpang /api/users: yang dibutuhkan pemilih di
// halaman jurnal cuma id + nama, sementara daftar member membawa email, nomor
// WhatsApp, dan hitungan kegiatan tiap orang — data pribadi yang tidak ada
// urusannya dengan memilih editor.

import { asc, eq, inArray } from 'drizzle-orm'
import { db } from '../../db'
import { ccUser, ROLE_LEVELS, USER_ROLES } from '../../db/schema'
import { wajibRole } from '../../utils/session'

export default defineEventHandler(async (event) => {
  // Editor ikut boleh membacanya: daftar ini cuma nama-nama pengelola, dan layar
  // jurnal memakainya untuk menuliskan siapa yang menangani apa. Yang digerbangi
  // admin adalah menugaskan, bukan melihat.
  await wajibRole(event, 'editor')

  // Yang levelnya <= 3: master, admin, editor. Admin ikut karena pada praktiknya
  // ia juga mengerjakan review saat editor sedang tidak ada.
  const peran = USER_ROLES.filter(r => ROLE_LEVELS[r] <= 3)

  const rows = await db
    .select({ id: ccUser.id, nama: ccUser.fullName, role: ccUser.role })
    .from(ccUser)
    .where(inArray(ccUser.role, peran))
    .orderBy(asc(ccUser.fullName))

  // Akun nonaktif disaring di JS, bukan di WHERE, supaya satu query cukup dan
  // syaratnya terbaca berdampingan dengan alasannya.
  const aktif = await db.select({ id: ccUser.id }).from(ccUser).where(eq(ccUser.isActive, true))
  const idAktif = new Set(aktif.map(a => a.id))

  return { data: rows.filter(r => idAktif.has(r.id)) }
})
