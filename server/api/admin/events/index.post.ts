// server/api/admin/events/index.post.ts
// Buat kegiatan baru — sekaligus satu sesi kosong sebagai titik mulai.

import { db } from '../../../db'
import { ccKegiatan, ccSesi } from '../../../db/schema'
import { wajibRole } from '../../../utils/session'
import { bacaKegiatan, slugUnik } from '../../../utils/validasi-event'

export default defineEventHandler(async (event) => {
  await wajibRole(event, 'admin')

  const body = await readBody<Record<string, unknown>>(event)
  const data = bacaKegiatan(body ?? {})
  const slug = slugUnik(data.judul)

  // Kegiatan + sesi pertamanya ditulis dalam satu transaksi: kegiatan tanpa sesi
  // akan menampilkan blok "Materi & dokumentasi" yang kosong sama sekali, dan
  // pengelola harus menebak bahwa sesi harus dibuat manual dulu.
  return db.transaction((tx) => {
    const kegiatan = tx.insert(ccKegiatan).values({ ...data, slug }).returning().get()

    const sesi = tx
      .insert(ccSesi)
      .values({
        kegiatanId: kegiatan.id,
        judul: 'Sesi 1',
        judulEn: 'Session 1',
        tanggal: data.tanggalMulai,
        urutan: 0,
      })
      .returning()
      .get()

    return { data: { ...kegiatan, sesi: [sesi] } }
  })
})
