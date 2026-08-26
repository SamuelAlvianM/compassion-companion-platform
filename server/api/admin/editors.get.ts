// server/api/admin/editors.get.ts
// Daftar orang yang bisa ditugaskan memeriksa sebuah jurnal: HANYA yang berperan
// editor.
//
// Endpoint kecil sendiri, bukan menumpang /api/users: yang dibutuhkan pemilih di
// halaman jurnal cuma id + nama, sementara daftar member membawa email, nomor
// WhatsApp, dan hitungan kegiatan tiap orang — data pribadi yang tidak ada
// urusannya dengan memilih editor.

import { and, asc, eq } from 'drizzle-orm'
import { db } from '../../db'
import { ccUser } from '../../db/schema'
import { wajibRole } from '../../utils/session'

export default defineEventHandler(async (event) => {
  // Editor ikut boleh membacanya: daftar ini cuma nama-nama pengelola, dan layar
  // jurnal memakainya untuk menuliskan siapa yang menangani apa. Yang digerbangi
  // admin adalah menugaskan, bukan melihat.
  await wajibRole(event, 'editor')

  // Sebelumnya daftar ini berisi level <= 3 — master, admin, dan editor — dengan
  // alasan admin kadang ikut memeriksa saat editor tidak ada. Praktiknya kotak
  // "Pilih editor" jadi berisi nama-nama yang bukan editor, termasuk admin yang
  // sedang menulis jurnal itu sendiri, sehingga sebuah tulisan bisa ditugaskan
  // kepada penulisnya sendiri. Menugaskan pemeriksaan adalah menyerahkannya ke
  // orang lain; yang ditawarkan karena itu hanya mereka yang perannya memang
  // memeriksa.
  const rows = await db
    .select({ id: ccUser.id, nama: ccUser.fullName, role: ccUser.role })
    .from(ccUser)
    // Akun nonaktif tidak ikut: menugaskan kepada akun yang tidak bisa masuk
    // sama saja dengan tidak menugaskan siapa-siapa.
    .where(and(eq(ccUser.role, 'editor'), eq(ccUser.isActive, true)))
    .orderBy(asc(ccUser.fullName))

  return { data: rows }
})
