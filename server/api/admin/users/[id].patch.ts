// server/api/admin/users/[id].patch.ts
// Ubah akun orang lain: identitas, role, dan status aktif.
//
// Password TIDAK diubah di sini — jalurnya sendiri di [id]/password.post.ts, supaya
// menyimpan perubahan nama tidak pernah bisa ikut mengganti password tanpa sengaja.

import { eq } from 'drizzle-orm'
import { db } from '../../../db'
import { ccUser, LOG_AKSI, ROLE_LABELS, ROLE_LEVELS } from '../../../db/schema'
import { wajibRole } from '../../../utils/session'
import { bacaUser } from '../../../utils/validasi-user'
import { wajibKelolaAkun } from '../../../utils/wewenang-akun'
import { catatLog } from '../../../utils/log'

export default defineEventHandler(async (event) => {
  const aktor = await wajibRole(event, 'admin')

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID user wajib diisi' })

  const lama = db.select().from(ccUser).where(eq(ccUser.id, id)).get()
  if (!lama) throw createError({ statusCode: 404, statusMessage: 'User tidak ditemukan' })

  // Dua pemeriksaan, bukan satu: yang pertama menahan penyuntingan akun yang lebih
  // tinggi, yang kedua menahan penaikan pangkat lewat kolom `role`. Tanpa yang
  // kedua, admin bisa mengubah akun user biasa menjadi master lalu memakai jalur
  // reset password untuk masuk ke situ.
  wajibKelolaAkun(aktor, lama.role, lama.id)

  const body = await readBody<Record<string, unknown>>(event) ?? {}

  // Body ditumpuk di atas baris yang ada supaya PATCH boleh parsial — pola yang
  // sama dipakai /api/admin/events/[id].
  const data = bacaUser({
    fullName: lama.fullName,
    email: lama.email,
    phoneNumber: lama.phoneNumber,
    role: lama.role,
    isActive: lama.isActive,
    bolehTulisJurnal: lama.bolehTulisJurnal,
    ...body,
  }, { abaikanId: id, usernameSekarang: lama.username })

  if (data.role !== lama.role) wajibKelolaAkun(aktor, data.role)

  // Menonaktifkan akun sendiri berarti kehilangan akses seketika (userSaatIni
  // memeriksa isActive tiap permintaan) tanpa ada yang bisa mengembalikannya
  // kecuali master lain. Ditolak di sini, bukan disembunyikan di UI.
  if (lama.id === aktor.id && !data.isActive) {
    throw createError({ statusCode: 400, statusMessage: 'Akun sendiri tidak bisa dinonaktifkan' })
  }

  const hasil = db
    .update(ccUser)
    .set(data)
    .where(eq(ccUser.id, id))
    .returning({
      id: ccUser.id,
      username: ccUser.username,
      fullName: ccUser.fullName,
      email: ccUser.email,
      role: ccUser.role,
      phoneNumber: ccUser.phoneNumber,
      isActive: ccUser.isActive,
    })
    .get()

  // Tiga perubahan pada akun punya bobot berbeda dan dicatat sebagai baris
  // sendiri-sendiri: role menentukan wewenang, izin jurnal menentukan siapa yang
  // boleh menulis, dan nonaktif menentukan siapa yang masih bisa masuk. Sisanya
  // (nama, telepon, email) tidak dicatat — itu pembetulan data, bukan keputusan.
  const objek = { objekId: hasil.id, objekLabel: hasil.fullName, objekSlug: null }

  if (data.role !== lama.role) {
    catatLog(aktor, {
      segmen: 'member',
      aksi: LOG_AKSI.memberRole,
      ...objek,
      catatan: `${ROLE_LABELS[lama.role]} → ${ROLE_LABELS[hasil.role]}`,
    })
  }

  if (data.bolehTulisJurnal !== lama.bolehTulisJurnal) {
    catatLog(aktor, {
      segmen: 'member',
      aksi: LOG_AKSI.memberIzinJurnal,
      ...objek,
      catatan: data.bolehTulisJurnal ? 'Izin menulis jurnal DIBUKA' : 'Izin menulis jurnal DITUTUP',
    })
  }

  if (data.isActive !== lama.isActive) {
    catatLog(aktor, {
      segmen: 'member',
      aksi: LOG_AKSI.memberStatus,
      ...objek,
      catatan: data.isActive ? 'Akun diaktifkan' : 'Akun dinonaktifkan',
    })
  }

  return {
    data: { ...hasil, level: ROLE_LEVELS[hasil.role], roleLabel: ROLE_LABELS[hasil.role] },
  }
})
