// server/api/admin/sesi/[id].patch.ts
// Ubah judul, tanggal, urutan, atau visibilitas sebuah sesi.

import { eq } from 'drizzle-orm'
import { db } from '../../../db'
import { ccSesi } from '../../../db/schema'
import { wajibRole } from '../../../utils/session'
import { keTanggal, salah } from '../../../utils/validasi-event'

export default defineEventHandler(async (event) => {
  await wajibRole(event, 'editor')

  const id = getRouterParam(event, 'id')
  if (!id) throw salah('ID sesi wajib diisi')

  const lama = db.select().from(ccSesi).where(eq(ccSesi.id, id)).get()
  if (!lama) throw createError({ statusCode: 404, statusMessage: 'Sesi tidak ditemukan' })

  const body = await readBody<Record<string, unknown>>(event) ?? {}

  // PATCH parsial: kolom yang tidak dikirim dibiarkan apa adanya, supaya form yang
  // hanya mengubah urutan tidak ikut mengosongkan tanggal.
  const patch: Partial<typeof lama> = {}
  if (typeof body.judul === 'string') {
    const judul = body.judul.trim()
    if (!judul) throw salah('Judul sesi tidak boleh kosong')
    patch.judul = judul
  }
  if ('judulEn' in body) patch.judulEn = typeof body.judulEn === 'string' && body.judulEn.trim() ? body.judulEn.trim() : null
  if ('tanggal' in body) patch.tanggal = keTanggal(body.tanggal)
  if ('urutan' in body) {
    const urutan = Number(body.urutan)
    if (!Number.isFinite(urutan) || urutan < 0) throw salah('Urutan harus angka >= 0')
    patch.urutan = Math.trunc(urutan)
  }
  if ('tampil' in body) patch.tampil = Boolean(body.tampil)

  if (!Object.keys(patch).length) return { data: lama }

  return { data: db.update(ccSesi).set(patch).where(eq(ccSesi.id, id)).returning().get() }
})
