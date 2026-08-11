// server/api/admin/events/[id].patch.ts
// Ubah kegiatan. Slug ikut disusun ulang dari judul baru, tapi hanya kalau
// judulnya benar-benar berubah — slug yang berganti diam-diam akan mematikan
// tautan yang sudah pernah dibagikan.

import { eq } from 'drizzle-orm'
import { db } from '../../../db'
import { ccKegiatan } from '../../../db/schema'
import { wajibRole } from '../../../utils/session'
import { bacaKegiatan, slugUnik } from '../../../utils/validasi-event'

export default defineEventHandler(async (event) => {
  await wajibRole(event, 'admin')

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID kegiatan wajib diisi' })

  const lama = db.select().from(ccKegiatan).where(eq(ccKegiatan.id, id)).get()
  if (!lama) throw createError({ statusCode: 404, statusMessage: 'Kegiatan tidak ditemukan' })

  const body = await readBody<Record<string, unknown>>(event) ?? {}

  // Body ditumpuk DI ATAS baris yang sudah ada, bukan dibaca sendirian. Tanpa ini
  // PATCH selalu harus lengkap: penyuntingan di tempat yang cuma mengirim satu
  // field akan mengosongkan seluruh kolom lain karena `bacaKegiatan` mengembalikan
  // null untuk apa pun yang tidak ada di body.
  const gabungan = {
    judul: lama.judul,
    judulEn: lama.judulEn,
    deskripsi: lama.deskripsi,
    deskripsiEn: lama.deskripsiEn,
    lokasi: lama.lokasi,
    waktu: lama.waktu,
    ajakan: lama.ajakan,
    ajakanEn: lama.ajakanEn,
    ajakanIsi: lama.ajakanIsi,
    ajakanIsiEn: lama.ajakanIsiEn,
    testimoni: lama.testimoni,
    tautanDaring: lama.tautanDaring,
    tanggalMulai: lama.tanggalMulai.toISOString(),
    tanggalSelesai: lama.tanggalSelesai?.toISOString() ?? null,
    jamMulai: lama.jamMulai,
    jamSelesai: lama.jamSelesai,
    tutupPendaftaran: lama.tutupPendaftaran?.toISOString() ?? null,
    kuota: lama.kuota,
    harga: lama.harga,
    status: lama.status,
    coverMediaId: lama.coverMediaId,
    ...body,
  }

  const data = bacaKegiatan(gabungan)

  const slugBaru = typeof body?.slug === 'string' && body.slug.trim()
    ? slugUnik(String(body.slug), id)
    : data.judul !== lama.judul
      ? slugUnik(data.judul, id)
      : lama.slug

  const hasil = db
    .update(ccKegiatan)
    .set({ ...data, slug: slugBaru })
    .where(eq(ccKegiatan.id, id))
    .returning()
    .get()

  return { data: hasil }
})
