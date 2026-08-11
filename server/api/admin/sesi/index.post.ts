// server/api/admin/sesi/index.post.ts
// Tambah sesi ke sebuah kegiatan. Urutannya diletakkan di belakang sesi terakhir.

import { eq, sql } from 'drizzle-orm'
import { db } from '../../../db'
import { ccKegiatan, ccSesi } from '../../../db/schema'
import { wajibRole } from '../../../utils/session'
import { keTanggal, salah } from '../../../utils/validasi-event'

export default defineEventHandler(async (event) => {
  await wajibRole(event, 'editor')

  const body = await readBody<Record<string, unknown>>(event)
  const kegiatanId = typeof body?.kegiatanId === 'string' ? body.kegiatanId : ''
  if (!kegiatanId) throw salah('kegiatanId wajib diisi')

  const kegiatan = db.select({ id: ccKegiatan.id }).from(ccKegiatan).where(eq(ccKegiatan.id, kegiatanId)).get()
  if (!kegiatan) throw createError({ statusCode: 404, statusMessage: 'Kegiatan tidak ditemukan' })

  // Urutan berikutnya dihitung dari MAX, bukan COUNT: sesi yang dihapus di tengah
  // membuat COUNT menghasilkan angka yang sudah dipakai.
  const puncak = db
    .select({ maks: sql<number | null>`max(${ccSesi.urutan})` })
    .from(ccSesi)
    .where(eq(ccSesi.kegiatanId, kegiatanId))
    .get()
  const urutan = (puncak?.maks ?? -1) + 1

  const judul = typeof body?.judul === 'string' && body.judul.trim()
    ? body.judul.trim()
    : `Sesi ${urutan + 1}`

  const sesi = db
    .insert(ccSesi)
    .values({
      kegiatanId,
      judul,
      judulEn: typeof body?.judulEn === 'string' && body.judulEn.trim() ? body.judulEn.trim() : null,
      tanggal: keTanggal(body?.tanggal),
      urutan,
    })
    .returning()
    .get()

  return { data: sesi }
})
