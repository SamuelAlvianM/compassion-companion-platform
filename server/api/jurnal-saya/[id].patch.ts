// server/api/jurnal-saya/[id].patch.ts
// Member menyimpan tulisannya, dan mengirimkannya untuk diperiksa.
//
// Dua hal saja yang boleh diubah dari sini: judul dan isi. Status hanya boleh
// bergerak ke `review` — mengirimkan. Menyetujui, meminta revisi, dan menerbitkan
// bukan miliknya, dan tidak ada jalannya di endpoint ini sama sekali.

import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { ccJurnal, LOG_AKSI } from '../../db/schema'
import { wajibLogin } from '../../utils/session'
import { slugJurnalUnik } from '../../utils/validasi-jurnal'
import { bersihkanHtml } from '../../utils/html'
import { catatLog } from '../../utils/log'

export default defineEventHandler(async (event) => {
  const user = await wajibLogin(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Id jurnal tidak ada' })

  const lama = db.select().from(ccJurnal).where(eq(ccJurnal.id, id)).get()
  if (!lama || lama.dibuatOleh !== user.id) {
    throw createError({ statusCode: 404, statusMessage: 'Tulisan tidak ditemukan' })
  }

  // Dibekukan selama ada di tangan orang lain. Tanpa ini, tulisan bisa berubah di
  // bawah tangan editor yang sedang membacanya — dan catatan revisinya jadi
  // menunjuk kalimat yang sudah tidak ada.
  const giliranSaya = lama.status === 'draft' || lama.status === 'revisi'

  const body = await readBody<{ judul?: string, isi?: string, status?: string }>(event) ?? {}
  const data: Record<string, unknown> = {}

  if (body.judul !== undefined || body.isi !== undefined) {
    if (!giliranSaya) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Tulisan sedang diperiksa, jadi belum bisa disunting. Tunggu hasilnya dulu.',
      })
    }

    if (body.judul !== undefined) {
      const judul = String(body.judul).trim()
      if (!judul) throw createError({ statusCode: 400, statusMessage: 'Judul wajib diisi' })
      if (judul.length > 300) throw createError({ statusCode: 400, statusMessage: 'Judul maksimal 300 karakter' })
      data.judul = judul
      // Slug ikut judul selama belum pernah terbit — sesudah itu beku, karena
      // alamatnya sudah bisa dibagikan orang.
      if (!lama.diterbitkanPada && judul !== lama.judul) data.slug = slugJurnalUnik(judul, id)
    }

    if (body.isi !== undefined) data.isi = bersihkanHtml(body.isi)
  }

  if (body.status !== undefined) {
    if (body.status !== 'review') {
      throw createError({ statusCode: 403, statusMessage: 'Anda hanya bisa mengirimkan tulisan untuk diperiksa' })
    }
    if (!giliranSaya) {
      throw createError({ statusCode: 409, statusMessage: 'Tulisan ini sudah dikirim dan sedang diperiksa' })
    }
    const judulAkhir = String(data.judul ?? lama.judul).trim()
    const isiAkhir = data.isi !== undefined ? data.isi : lama.isi
    if (!judulAkhir || !isiAkhir) {
      throw createError({ statusCode: 400, statusMessage: 'Judul dan isi tulisan harus terisi sebelum dikirim' })
    }
    data.status = 'review'
  }

  if (!Object.keys(data).length) return { data: { id: lama.id, status: lama.status } }

  const baris = db.update(ccJurnal).set(data).where(eq(ccJurnal.id, id)).returning().get()

  // Hanya pengirimannya yang dicatat. Menyimpan draf berkali-kali adalah cara
  // orang menulis, bukan kejadian yang perlu dilaporkan ke master.
  if (data.status === 'review' && lama.status !== 'review') {
    catatLog(user, {
      segmen: 'jurnal',
      aksi: LOG_AKSI.jurnalDiajukan,
      objekId: baris.id,
      objekLabel: baris.judul,
      objekSlug: baris.slug,
      catatan: lama.status === 'revisi' ? 'Dikirim ulang sesudah revisi' : 'Kiriman pertama',
    })
  }

  return {
    data: {
      id: baris.id,
      judul: baris.judul,
      status: baris.status,
      catatanRevisi: baris.catatanRevisi,
      updatedAt: baris.updatedAt,
    },
  }
})
