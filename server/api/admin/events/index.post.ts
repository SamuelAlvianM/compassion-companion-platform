// server/api/admin/events/index.post.ts
// Buat kegiatan baru — sekaligus satu sesi kosong sebagai titik mulai.

import { db } from '../../../db'
import { ccKegiatan, ccSesi, LOG_AKSI } from '../../../db/schema'
import { wajibRole } from '../../../utils/session'
import { bacaKegiatan, slugUnik } from '../../../utils/validasi-event'
import { catatLog } from '../../../utils/log'

export default defineEventHandler(async (event) => {
  const pengakses = await wajibRole(event, 'admin')

  const body = await readBody<Record<string, unknown>>(event)
  const data = bacaKegiatan(body ?? {})
  const slug = slugUnik(data.judul)

  // Kegiatan + sesi pertamanya ditulis dalam satu transaksi: kegiatan tanpa sesi
  // akan menampilkan blok "Materi & dokumentasi" yang kosong sama sekali, dan
  // pengelola harus menebak bahwa sesi harus dibuat manual dulu.
  const hasil = db.transaction((tx) => {
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

  // Di luar transaksi: log adalah pengamat, dan pengamat yang gagal tidak boleh
  // menggulung balik pekerjaan yang sudah benar.
  catatLog(pengakses, {
    segmen: 'event',
    aksi: LOG_AKSI.eventDibuat,
    objekId: hasil.data.id,
    objekLabel: hasil.data.judul,
    objekSlug: hasil.data.slug,
    // Tanggalnya ikut dicatat, bukan cuma statusnya. Log event yang isinya
    // "dibuat" saja tidak bisa dibedakan satu sama lain saat sebuah program
    // berulang tiap tahun dengan judul yang sama.
    catatan: [
      `Status awal: ${hasil.data.status}`,
      `Tanggal: ${new Intl.DateTimeFormat('id-ID', {
        day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta',
      }).format(hasil.data.tanggalMulai)}`,
    ].join('\n'),
  })

  return hasil
})
