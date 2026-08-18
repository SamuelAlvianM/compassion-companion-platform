// server/api/jurnal-saya/[id].get.ts
// Satu tulisan milik sendiri, untuk layar tulis member.
//
// Yang dikirim sengaja sempit: judul, isi, status, dan catatan revisi. TIDAK ada
// `editorId`, tidak ada nama editornya — penulis tidak perlu tahu siapa yang
// memeriksa, dan itu menjaga percakapan revisi tetap tentang tulisannya.

import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { ccJurnal } from '../../db/schema'
import { wajibLogin } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const user = await wajibLogin(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Id jurnal tidak ada' })

  const baris = db.select().from(ccJurnal).where(eq(ccJurnal.id, id)).get()

  // 404, bukan 403, untuk tulisan orang lain: keberadaan draf orang lain bukan
  // sesuatu yang perlu dikonfirmasi kepada yang bukan pemiliknya.
  if (!baris || baris.dibuatOleh !== user.id) {
    throw createError({ statusCode: 404, statusMessage: 'Tulisan tidak ditemukan' })
  }

  return {
    data: {
      id: baris.id,
      judul: baris.judul,
      isi: baris.isi,
      status: baris.status,
      catatanRevisi: baris.catatanRevisi,
      slug: baris.slug,
      diterbitkanPada: baris.diterbitkanPada,
      updatedAt: baris.updatedAt,
      // Giliran menulis ada padanya hanya saat draf atau perlu revisi.
      bolehSunting: baris.status === 'draft' || baris.status === 'revisi',
    },
  }
})
