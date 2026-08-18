// server/api/admin/events/[id].patch.ts
// Ubah kegiatan. Slug ikut disusun ulang dari judul baru, tapi hanya kalau
// judulnya benar-benar berubah — slug yang berganti diam-diam akan mematikan
// tautan yang sudah pernah dibagikan.

import { eq } from 'drizzle-orm'
import { db } from '../../../db'
import { ccKegiatan, LOG_AKSI } from '../../../db/schema'
import { wajibRole } from '../../../utils/session'
import { bacaKegiatan, slugUnik } from '../../../utils/validasi-event'
import { catatLog } from '../../../utils/log'
import { ringkasPerubahan } from '../../../utils/log-perubahan'

export default defineEventHandler(async (event) => {
  const pengakses = await wajibRole(event, 'admin')

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
    thumbnailMediaId: lama.thumbnailMediaId,
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

  // Perubahan status dicatat terpisah dari penyuntingan biasa: "draf jadi terbit"
  // dan "satu kalimat deskripsi dirapikan" bukan kejadian dengan bobot yang sama,
  // dan yang pertama itulah yang dicari orang saat membuka log.
  //
  // Dibandingkan `lama` (baris sebelum disimpan) dengan `data` (nilai yang sudah
  // divalidasi), BUKAN dengan `hasil`. `hasil` datang dari database dan membawa
  // `updatedAt` yang selalu berubah, sehingga tiap penyimpanan akan selalu
  // terlihat mengubah sesuatu meski tidak ada yang disentuh.
  const rincian = ringkasPerubahan(lama, data)

  // Tidak ada yang berubah -> tidak ada yang dicatat. Menyimpan formulir tanpa
  // mengubah apa pun adalah hal yang sering terjadi (orang membuka, membaca, lalu
  // menekan simpan), dan tiap kalinya meninggalkan baris log kosong.
  if (rincian || data.status !== lama.status) {
    catatLog(pengakses, {
      segmen: 'event',
      aksi: data.status !== lama.status ? LOG_AKSI.eventStatus : LOG_AKSI.eventDiubah,
      objekId: hasil.id,
      objekLabel: hasil.judul,
      objekSlug: hasil.slug,
      catatan: rincian,
    })
  }

  return { data: hasil }
})

