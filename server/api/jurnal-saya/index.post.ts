// server/api/jurnal-saya/index.post.ts
// Member memulai tulisan barunya sendiri.
//
// Izinnya per orang, bukan per role: `bolehTulisJurnal` dibuka admin di halaman
// member. Selama tertutup, endpoint ini menolak — dan tombolnya memang tidak
// digambar di layar, tapi yang menentukan tetap server.

import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { ccJurnal, ccUser, LOG_AKSI, ROLE_LEVELS } from '../../db/schema'
import { wajibLogin } from '../../utils/session'
import { slugJurnalUnik } from '../../utils/validasi-jurnal'
import { bersihkanHtml } from '../../utils/html'
import { catatLog } from '../../utils/log'

export default defineEventHandler(async (event) => {
  const user = await wajibLogin(event)

  const akun = db
    .select({ boleh: ccUser.bolehTulisJurnal, nama: ccUser.fullName })
    .from(ccUser)
    .where(eq(ccUser.id, user.id))
    .get()

  // Pengelola tidak butuh izin tambahan; wewenangnya sudah datang dari rolenya.
  const bolehMenulis = ROLE_LEVELS[user.role] <= 3 || akun?.boleh
  if (!bolehMenulis) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Akses menulis jurnal belum dibuka untuk akun ini',
    })
  }

  const body = await readBody<{ judul?: string, isi?: string }>(event) ?? {}
  const judul = (body.judul ?? '').trim()
  if (!judul) throw createError({ statusCode: 400, statusMessage: 'Judul wajib diisi' })
  if (judul.length > 300) throw createError({ statusCode: 400, statusMessage: 'Judul maksimal 300 karakter' })

  // Member hanya mengirim judul dan isi. Kategori, event, sampul, dan ringkasan
  // ditentukan admin nanti — istilah redaksional itu bukan urusan penulisnya, dan
  // yang menerbitkan tetap admin.
  const baris = db
    .insert(ccJurnal)
    .values({
      slug: slugJurnalUnik(judul),
      judul,
      isi: bersihkanHtml(body.isi),
      status: 'draft',
      kontributor: akun?.nama ?? user.fullName,
      userId: user.id,
      dibuatOleh: user.id,
    })
    .returning()
    .get()

  catatLog(user, {
    segmen: 'jurnal',
    aksi: LOG_AKSI.jurnalDibuat,
    objekId: baris.id,
    objekLabel: baris.judul,
    objekSlug: baris.slug,
    catatan: 'Ditulis sendiri oleh member',
  })

  return { data: { id: baris.id, judul: baris.judul, status: baris.status } }
})
