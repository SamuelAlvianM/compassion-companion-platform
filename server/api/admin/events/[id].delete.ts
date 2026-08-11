// server/api/admin/events/[id].delete.ts
// Hapus kegiatan. Sesi & itemnya ikut terhapus lewat ON DELETE CASCADE.
//
// Kegiatan yang sudah punya peserta ditolak: `cc_peserta.kegiatanId` juga cascade,
// jadi menghapusnya akan menghilangkan catatan pendaftaran orang sungguhan tanpa
// jejak. Untuk kasus itu, status `batal` yang benar, bukan penghapusan.

import { and, eq, ne, sql } from 'drizzle-orm'
import { db } from '../../../db'
import { ccKegiatan, ccPeserta } from '../../../db/schema'
import { wajibRole } from '../../../utils/session'

export default defineEventHandler(async (event) => {
  await wajibRole(event, 'admin')

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID kegiatan wajib diisi' })

  const kegiatan = db.select().from(ccKegiatan).where(eq(ccKegiatan.id, id)).get()
  if (!kegiatan) throw createError({ statusCode: 404, statusMessage: 'Kegiatan tidak ditemukan' })

  const peserta = db
    .select({ jumlah: sql<number>`count(*)` })
    .from(ccPeserta)
    .where(and(eq(ccPeserta.kegiatanId, id), ne(ccPeserta.status, 'batal')))
    .get()

  if ((peserta?.jumlah ?? 0) > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: `Kegiatan ini punya ${peserta!.jumlah} peserta. Ubah statusnya jadi "batal" alih-alih menghapus.`,
    })
  }

  db.delete(ccKegiatan).where(eq(ccKegiatan.id, id)).run()
  return { ok: true }
})
