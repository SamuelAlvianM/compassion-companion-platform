// server/api/admin/jurnal/[id].patch.ts
// Sunting jurnal dari dashboard — dipakai autosave (satu-dua kolom per permintaan),
// tombol perpindahan status, dan penugasan editor.
//
// Satu endpoint untuk ketiganya, bukan tiga: perpindahan status hampir selalu
// terjadi bersamaan dengan simpanan terakhir ("perbaiki lalu ajukan"), dan
// memisahkannya berarti dua permintaan yang bisa gagal setengah jalan.

import { eq } from 'drizzle-orm'
import { db } from '../../../db'
import { ccJurnal } from '../../../db/schema'
import { wajibRole } from '../../../utils/session'
import {
  bacaBodyJurnal,
  periksaEditorId,
  periksaPindahStatus,
  slugJurnalUnik,
  wajibBolehSunting,
} from '../../../utils/validasi-jurnal'
import { catatLog, namaAkun } from '../../../utils/log'
import { LOG_AKSI, type JurnalStatus } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const pengakses = await wajibRole(event, 'editor')

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Id jurnal tidak ada' })

  const lama = db.select().from(ccJurnal).where(eq(ccJurnal.id, id)).get()
  if (!lama) throw createError({ statusCode: 404, statusMessage: 'Jurnal tidak ditemukan' })

  const body = await readBody<Record<string, unknown>>(event) ?? {}

  // Menyunting isi dan memindahkan status adalah dua wewenang yang berbeda.
  // Editor yang tidak ditugaskan boleh MEMBUKA jurnal ini (daftar & halaman
  // suntingnya terbuka untuk semua editor, hanya-baca), tapi tidak menulis apa pun
  // ke dalamnya.
  const menyunting = Object.keys(body).some(k => k !== 'status' && k !== 'catatanRevisi')
  if (menyunting) wajibBolehSunting(lama, pengakses)

  const data = bacaBodyJurnal(body, true) as Record<string, unknown>

  // Penugasan editor: admin ke atas. Ini yang menentukan antrean siapa tulisan ini
  // masuk, dan penulisnya tidak pernah diberi tahu siapa orangnya. Aturannya
  // dipinjam dari validator supaya sama persis dengan yang dipakai POST — editor
  // sekarang bisa dipilih sejak layar "tulis baru".
  if (body.editorId !== undefined) {
    data.editorId = periksaEditorId(body.editorId, pengakses)
  }

  // Slug mengikuti judul HANYA selama tulisan belum pernah terbit. Sesudah terbit
  // ia beku: alamat yang sudah dibagikan orang tidak boleh mati karena penulisnya
  // membetulkan satu salah ketik di judul.
  if (data.judul && !lama.diterbitkanPada && data.judul !== lama.judul) {
    data.slug = slugJurnalUnik(String(data.judul), id)
  }

  if (typeof body.status === 'string') {
    const tujuan = periksaPindahStatus(lama, body.status, pengakses)
    data.status = tujuan

    // Tanggal terbit dipasang sekali, saat pertama kali benar-benar terbit.
    // Menerbitkan ulang tulisan yang pernah ditarik tidak menggesernya — bagi
    // pembaca itu tulisan yang sama, bukan tulisan baru.
    if (tujuan === 'published' && !lama.diterbitkanPada) data.diterbitkanPada = new Date()

    if (tujuan === 'revisi') {
      const catatan = typeof body.catatanRevisi === 'string' ? body.catatanRevisi.trim() : ''
      if (!catatan) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Isi catatan revisi — status “perlu revisi” tanpa alasan tidak bisa ditindaklanjuti penulisnya',
        })
      }
      data.catatanRevisi = catatan
    }
    // Catatan dibersihkan begitu tulisannya bergerak maju lagi, supaya keluhan yang
    // sudah dijawab tidak terus muncul di kepala halaman penulisnya.
    else if (tujuan === 'approved' || tujuan === 'published') {
      data.catatanRevisi = null
    }
  }

  if (!Object.keys(data).length) return { data: lama }

  const baris = db.update(ccJurnal).set(data).where(eq(ccJurnal.id, id)).returning().get()

  // Pencatatan sesudah barisnya tersimpan, dan HANYA untuk yang berarti.
  //
  // Endpoint ini juga melayani autosave — satu-dua kolom tiap beberapa detik.
  // Kalau semua panggilan dicatat, log jurnal akan terisi ratusan baris "disunting"
  // yang menenggelamkan enam baris yang sebenarnya ingin dibaca master. Jadi yang
  // dicatat cuma dua: editornya berganti, dan statusnya berpindah.
  if (data.editorId !== undefined && data.editorId !== lama.editorId) {
    catatLog(pengakses, {
      segmen: 'jurnal',
      aksi: LOG_AKSI.jurnalEditorDitugaskan,
      objekId: baris.id,
      objekLabel: baris.judul,
      objekSlug: baris.slug,
      catatan: data.editorId
        ? `Diperiksa oleh ${namaAkun(String(data.editorId))}`
        : `Penugasan editor dilepas (sebelumnya ${namaAkun(lama.editorId)})`,
    })
  }

  if (data.status && data.status !== lama.status) {
    catatLog(pengakses, {
      segmen: 'jurnal',
      aksi: aksiStatus(lama.status, data.status as JurnalStatus),
      objekId: baris.id,
      objekLabel: baris.judul,
      objekSlug: baris.slug,
      catatan: data.status === 'revisi' ? String(data.catatanRevisi ?? '') : null,
    })
  }

  return { data: baris }
})

/**
 * Perpindahan status jadi nama aksi. Sengaja memakai PASANGAN dari→ke, bukan
 * status tujuannya saja: `-> draft` berarti dua hal yang sama sekali berbeda
 * tergantung asalnya — penulis menarik kembali kirimannya, atau admin mencabut
 * tulisan dari halaman publik. Log yang menyebut keduanya "jadi draft" menghapus
 * justru bedanya.
 */
const aksiStatus = (dari: JurnalStatus, ke: JurnalStatus): string => {
  if (ke === 'published') return LOG_AKSI.jurnalTerbit
  if (ke === 'approved') return LOG_AKSI.jurnalDisetujui
  if (ke === 'revisi') return LOG_AKSI.jurnalRevisi
  if (ke === 'review') return LOG_AKSI.jurnalDiajukan
  if (ke === 'draft') return dari === 'published' ? LOG_AKSI.jurnalDicabut : LOG_AKSI.jurnalDitarikPenulis
  return `jurnal.${ke}`
}
