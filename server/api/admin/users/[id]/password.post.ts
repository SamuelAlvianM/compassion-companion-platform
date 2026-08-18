// server/api/admin/users/[id]/password.post.ts
// Pengelola memasang password baru untuk akun lain, tanpa password lama.
//
// Ini jalur pemulihan resmi situs ini: akun dibuat oleh admin dan passwordnya
// disampaikan lewat WhatsApp, jadi "pemakainya lupa" tidak bisa diselesaikan
// pemakainya sendiri. Password lama memang tidak diminta — kalau admin tahu
// password lama, endpoint ini tidak perlu ada.
//
// Yang menjaga: `wajibKelolaAkun` — pengelola hanya boleh menyentuh akun yang
// wewenangnya lebih rendah dari dirinya. Tanpa itu, admin bisa mereset password
// master lalu masuk sebagai master.

import { eq } from 'drizzle-orm'
import { db } from '../../../../db'
import { ccUser, LOG_AKSI } from '../../../../db/schema'
import { hashPassword, wajibPanjang } from '../../../../utils/password'
import { wajibRole } from '../../../../utils/session'
import { wajibKelolaAkun } from '../../../../utils/wewenang-akun'
import { catatLog } from '../../../../utils/log'

export default defineEventHandler(async (event) => {
  const aktor = await wajibRole(event, 'admin')

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID user wajib diisi' })

  const body = await readBody<{ passwordBaru?: string }>(event)
  const baru = body?.passwordBaru ?? ''
  if (!baru) throw createError({ statusCode: 400, statusMessage: 'Password baru wajib diisi' })
  wajibPanjang(baru)

  const sasaran = db
    .select({ id: ccUser.id, username: ccUser.username, fullName: ccUser.fullName, role: ccUser.role })
    .from(ccUser)
    .where(eq(ccUser.id, id))
    .get()
  if (!sasaran) throw createError({ statusCode: 404, statusMessage: 'User tidak ditemukan' })

  wajibKelolaAkun(aktor, sasaran.role, sasaran.id)

  db.update(ccUser).set({ password: await hashPassword(baru) }).where(eq(ccUser.id, id)).run()

  // Sesi pemilik akun sengaja TIDAK dibatalkan. Sesi disimpan di cookie terenkripsi,
  // bukan di tabel, jadi tidak ada daftar yang bisa dicabut dari sini — dan
  // memalsukan pencabutan (mis. menaikkan sebuah nomor versi) berarti menambah
  // kolom yang harus diperiksa di setiap permintaan demi kasus yang di sini
  // bukan ancamannya: yang mereset adalah pengelola yang memang berwenang.

  // Yang dicatat cuma bahwa passwordnya direset dan oleh siapa. Nilainya jelas
  // tidak, dan itu bukan kehati-hatian berlebihan: log ini dibaca lewat halaman
  // web, dan satu-satunya alasan sebuah password ada di sana adalah supaya bisa
  // dibaca orang.
  catatLog(aktor, {
    segmen: 'member',
    aksi: LOG_AKSI.memberPassword,
    objekId: sasaran.id,
    objekLabel: sasaran.fullName,
    objekSlug: null,
    catatan: sasaran.id === aktor.id ? 'Mengatur ulang password sendiri' : null,
  })

  return {
    status: 200,
    message: `Password ${sasaran.username} berhasil diubah`,
    data: { id: sasaran.id, username: sasaran.username, fullName: sasaran.fullName },
  }
})
