// server/api/events/[slug]/sesi.get.ts
// Sesi + materi sebuah kegiatan untuk halaman detail event publik.
//
// Materi terkunci tetap terkirim judulnya, tapi tanpa URL/mediaId bila pembaca
// tidak berhak — penyaringannya di sini, bukan lewat v-if di template, supaya
// tautannya tidak bisa dibaca dari devtools.

import { eq } from 'drizzle-orm'
import { db } from '../../../db'
import { ccKegiatan, hasAtLeast } from '../../../db/schema'
import { userSaatIni } from '../../../utils/session'
import { bolehBukaMateri } from '../../../utils/sesi'
import { susunSesi } from '../../../utils/sesi-payload'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Slug kegiatan wajib diisi' })

  const kegiatan = db
    .select({ id: ccKegiatan.id, status: ccKegiatan.status, judul: ccKegiatan.judul })
    .from(ccKegiatan)
    .where(eq(ccKegiatan.slug, slug))
    .get()

  if (!kegiatan || kegiatan.status === 'draft') {
    throw createError({ statusCode: 404, statusMessage: 'Kegiatan tidak ditemukan' })
  }

  const user = await userSaatIni(event)
  const boleh = await bolehBukaMateri(user, kegiatan.id)

  // Pengelola level <= 3 menyunting sesi langsung di halaman publik ini, jadi sesi
  // yang `tampil = false` ikut dikirim kepadanya — kalau tidak, sesi yang baru saja
  // ia sembunyikan lenyap dari layar dan tidak ada jalan untuk menampilkannya lagi
  // selain lewat form admin. Bagi pengunjung biasa penyaringannya tidak berubah.
  const pengelola = Boolean(user && hasAtLeast(user.role, 'editor'))

  return {
    data: await susunSesi(kegiatan.id, boleh, pengelola),
    meta: { bolehBukaMateri: boleh, masuk: Boolean(user), pengelola },
  }
})
