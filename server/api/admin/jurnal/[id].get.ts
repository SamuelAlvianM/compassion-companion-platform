// server/api/admin/jurnal/[id].get.ts
// Satu jurnal utuh untuk halaman sunting — termasuk isi HTML dan kolom EN yang
// tidak pernah dikirim ke daftar.

import { eq } from 'drizzle-orm'
import { db } from '../../../db'
import { ccJurnal, ccKegiatan, ccMedia, ccUser } from '../../../db/schema'
import { wajibRole } from '../../../utils/session'
import { bolehSunting } from '../../../utils/validasi-jurnal'

export default defineEventHandler(async (event) => {
  const pengakses = await wajibRole(event, 'editor')

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Id jurnal tidak ada' })

  const baris = db.select().from(ccJurnal).where(eq(ccJurnal.id, id)).get()
  if (!baris) throw createError({ statusCode: 404, statusMessage: 'Jurnal tidak ditemukan' })

  // Sampul diambil terpisah, bukan lewat join: `coverMediaId` boleh menunjuk ke
  // media yang sudah dihapus, dan join akan menghilangkan seluruh barisnya.
  const cover = baris.coverMediaId
    ? db.select({ url: ccMedia.publicUrl }).from(ccMedia).where(eq(ccMedia.id, baris.coverMediaId)).get()
    : null

  const kegiatan = baris.kegiatanId
    ? db
        .select({ id: ccKegiatan.id, judul: ccKegiatan.judul })
        .from(ccKegiatan)
        .where(eq(ccKegiatan.id, baris.kegiatanId))
        .get()
    : null

  // Nama editor yang ditugaskan — dipakai kepala halaman admin ("ditangani X").
  const editor = baris.editorId
    ? db.select({ id: ccUser.id, nama: ccUser.fullName }).from(ccUser).where(eq(ccUser.id, baris.editorId)).get()
    : null

  return {
    data: {
      ...baris,
      coverUrl: cover?.url ?? null,
      kegiatan: kegiatan ?? null,
      editor: editor ?? null,
      // Dihitung server, dipakai layar untuk mengunci seluruh formulir: editor yang
      // tidak ditugaskan boleh membaca jurnal ini, tidak mengubahnya.
      bolehSunting: bolehSunting(baris, pengakses),
    },
  }
})
