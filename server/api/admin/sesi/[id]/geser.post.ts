// server/api/admin/sesi/[id]/geser.post.ts
// Geser sebuah sesi satu langkah naik atau turun di dalam kegiatannya.
//
// Endpoint sendiri, bukan PATCH `urutan`: klien tidak perlu tahu angka urutan
// tetangganya, dan pertukaran dihitung dari keadaan database saat itu juga —
// dua pengelola yang menggeser bersamaan tidak bisa saling menimpa dengan angka
// yang sudah basi.

import { asc, eq } from 'drizzle-orm'
import { db } from '../../../../db'
import { ccSesi } from '../../../../db/schema'
import { wajibRole } from '../../../../utils/session'
import { bacaArah, geserDalamDaftar } from '../../../../utils/urutan'
import { salah } from '../../../../utils/validasi-event'

export default defineEventHandler(async (event) => {
  await wajibRole(event, 'editor')

  const id = getRouterParam(event, 'id')
  if (!id) throw salah('ID sesi wajib diisi')

  const body = await readBody<Record<string, unknown>>(event) ?? {}
  const arah = bacaArah(body.arah)

  const sesi = db.select({ kegiatanId: ccSesi.kegiatanId }).from(ccSesi).where(eq(ccSesi.id, id)).get()
  if (!sesi) throw createError({ statusCode: 404, statusMessage: 'Sesi tidak ditemukan' })

  // Urutannya harus sama persis dengan yang dipakai susunSesi(), kalau tidak
  // "naik" di layar bisa berarti turun di database.
  const daftar = db
    .select({ id: ccSesi.id })
    .from(ccSesi)
    .where(eq(ccSesi.kegiatanId, sesi.kegiatanId))
    .orderBy(asc(ccSesi.urutan), asc(ccSesi.createdAt))
    .all()

  const baru = geserDalamDaftar(daftar, id, arah)

  // Satu transaksi: daftar yang setengah tertulis akan menampilkan dua sesi pada
  // posisi yang sama sampai ada yang menggesernya lagi.
  db.transaction((tx) => {
    for (const baris of baru) {
      tx.update(ccSesi).set({ urutan: baris.urutan }).where(eq(ccSesi.id, baris.id)).run()
    }
  })

  return { data: { digeser: baru.length > 0 } }
})
