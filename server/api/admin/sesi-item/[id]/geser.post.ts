// server/api/admin/sesi-item/[id]/geser.post.ts
// Geser sebuah item satu langkah di dalam bagiannya sendiri.
//
// Cakupannya sesi + bagian, bukan sesi saja: materi, galeri, dan referensi berbagi
// satu tabel tapi tampil sebagai tiga daftar terpisah, dan `urutan` masing-masing
// dihitung sendiri-sendiri (lihat MAX+1 di index.post.ts). Menggeser lintas bagian
// akan menukar foto galeri dengan berkas materi tanpa ada yang memintanya.

import { and, asc, eq } from 'drizzle-orm'
import { db } from '../../../../db'
import { ccSesiItem } from '../../../../db/schema'
import { wajibRole } from '../../../../utils/session'
import { bacaArah, geserDalamDaftar } from '../../../../utils/urutan'
import { salah } from '../../../../utils/validasi-event'

export default defineEventHandler(async (event) => {
  await wajibRole(event, 'editor')

  const id = getRouterParam(event, 'id')
  if (!id) throw salah('ID item wajib diisi')

  const body = await readBody<Record<string, unknown>>(event) ?? {}
  const arah = bacaArah(body.arah)

  const item = db
    .select({ sesiId: ccSesiItem.sesiId, bagian: ccSesiItem.bagian })
    .from(ccSesiItem)
    .where(eq(ccSesiItem.id, id))
    .get()
  if (!item) throw createError({ statusCode: 404, statusMessage: 'Item tidak ditemukan' })

  const daftar = db
    .select({ id: ccSesiItem.id })
    .from(ccSesiItem)
    .where(and(eq(ccSesiItem.sesiId, item.sesiId), eq(ccSesiItem.bagian, item.bagian)))
    .orderBy(asc(ccSesiItem.urutan), asc(ccSesiItem.createdAt))
    .all()

  const baru = geserDalamDaftar(daftar, id, arah)

  db.transaction((tx) => {
    for (const baris of baru) {
      tx.update(ccSesiItem).set({ urutan: baris.urutan }).where(eq(ccSesiItem.id, baris.id)).run()
    }
  })

  return { data: { digeser: baru.length > 0 } }
})
