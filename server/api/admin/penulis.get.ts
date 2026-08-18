// server/api/admin/penulis.get.ts
// Daftar akun yang bisa dicantumkan sebagai PENULIS sebuah jurnal.
//
// Berbeda dari /api/admin/editors, yang isinya editor ke atas saja: yang ini
// seluruh akun aktif, karena tulisan yang dimasukkan admin hampir selalu tulisan
// member — bukan tulisan pengelola.
//
// Endpoint kecil sendiri, bukan menumpang /api/users, dengan alasan yang sama
// seperti editors.get.ts: pemilih di halaman jurnal cuma butuh id + nama,
// sementara daftar member membawa email, nomor WhatsApp, dan hitungan kegiatan
// tiap orang — data pribadi yang tidak ada urusannya dengan memilih penulis.

import { and, asc, eq, ne } from 'drizzle-orm'
import { db } from '../../db'
import { ccUser } from '../../db/schema'
import { wajibRole } from '../../utils/session'

export default defineEventHandler(async (event) => {
  // Editor ikut boleh membacanya. Yang menentukan boleh-tidaknya mengganti
  // penulis bukan endpoint ini melainkan hak sunting barisnya, dan itu diperiksa
  // di /api/admin/jurnal/[id].patch.ts.
  const pengakses = await wajibRole(event, 'editor')

  // Akun master tidak diperlihatkan kepada siapa pun selain master — aturan yang
  // sama dengan /api/users. Daftar nama pun sebuah pengakuan bahwa akun itu ada.
  const saring = pengakses.role === 'master'
    ? eq(ccUser.isActive, true)
    : and(eq(ccUser.isActive, true), ne(ccUser.role, 'master'))

  const rows = await db
    .select({ id: ccUser.id, nama: ccUser.fullName, role: ccUser.role })
    .from(ccUser)
    .where(saring)
    .orderBy(asc(ccUser.fullName))

  return { data: rows }
})
