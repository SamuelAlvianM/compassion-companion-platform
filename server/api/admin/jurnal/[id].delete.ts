// server/api/admin/jurnal/[id].delete.ts
// Hapus jurnal. Admin ke atas — editor bisa menulis dan mengajukan, tapi tidak
// membuang tulisan yang mungkin bukan miliknya.

import { eq } from 'drizzle-orm'
import { db } from '../../../db'
import { ccJurnal, LOG_AKSI } from '../../../db/schema'
import { wajibRole } from '../../../utils/session'
import { catatLog } from '../../../utils/log'

export default defineEventHandler(async (event) => {
  const pengakses = await wajibRole(event, 'admin')

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Id jurnal tidak ada' })

  const baris = db.select().from(ccJurnal).where(eq(ccJurnal.id, id)).get()
  if (!baris) throw createError({ statusCode: 404, statusMessage: 'Jurnal tidak ditemukan' })

  // Yang sedang terbit tidak bisa dihapus begitu saja: alamatnya sudah publik dan
  // mungkin sudah dibagikan. Tarik dulu ke draft — dua langkah, dan langkah
  // pertamanya bisa dibatalkan.
  if (baris.status === 'published') {
    throw createError({
      statusCode: 409,
      statusMessage: 'Tarik dulu jurnal ini dari halaman publik sebelum menghapusnya',
    })
  }

  db.delete(ccJurnal).where(eq(ccJurnal.id, id)).run()

  // Judulnya ikut disalin ke log. Ini satu-satunya tempat yang benar-benar
  // membutuhkan salinan itu: sesudah baris ini, tidak ada lagi yang bisa
  // memberi tahu tulisan mana yang hilang.
  catatLog(pengakses, {
    segmen: 'jurnal',
    aksi: LOG_AKSI.jurnalDihapus,
    objekId: id,
    objekLabel: baris.judul,
    objekSlug: null,
    catatan: `Status terakhir: ${baris.status}`,
  })

  return { data: { id } }
})
