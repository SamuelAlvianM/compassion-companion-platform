// server/api/admin/jurnal/index.post.ts
// Buat jurnal baru. Selalu lahir sebagai draft — tidak ada jalan membuat tulisan
// yang langsung terbit, sama seperti tidak ada transisi draft -> terbit.

import { db } from '../../../db'
import { ccJurnal } from '../../../db/schema'
import { wajibRole } from '../../../utils/session'
import { bacaBodyJurnal, periksaEditorId, slugJurnalUnik } from '../../../utils/validasi-jurnal'
import { catatLog, namaAkun } from '../../../utils/log'
import { LOG_AKSI } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const pengakses = await wajibRole(event, 'editor')

  const body = await readBody<Record<string, unknown>>(event)
  const data = bacaBodyJurnal(body ?? {})
  const slug = slugJurnalUnik(String(data.judul))

  // Editor boleh sudah ditunjuk sejak barisnya lahir. Sebelumnya kolom ini baru
  // muncul sesudah draftnya jadi, sehingga admin yang sudah tahu siapa yang akan
  // memeriksa tetap harus kembali ke formulir yang sama untuk satu isian.
  //
  // Tetap boleh kosong: draft memang boleh mengendap tanpa editor. Yang menolak
  // kekosongan itu ada di ambang `review`, bukan di sini.
  //
  // Nilai kosong dilewatkan tanpa diperiksa, bukan dikirim ke `periksaEditorId`
  // yang akan menolaknya dengan 403 — endpoint ini juga terbuka bagi editor, dan
  // "tidak menugaskan siapa pun" bukan tindakan yang perlu wewenang admin.
  const editorId = body?.editorId ? periksaEditorId(body.editorId, pengakses) : null

  const baris = db
    .insert(ccJurnal)
    .values({
      ...data,
      judul: String(data.judul),
      kontributor: String(data.kontributor),
      editorId,
      slug,
      status: 'draft',
      dibuatOleh: pengakses.id,
    })
    .returning()
    .get()

  // Dicatat sebagai satu baris, bukan dua. Membuat draf sambil sekalian menunjuk
  // editornya adalah satu tindakan di layar; memecahnya jadi "dibuat" + "editor
  // ditugaskan" dengan stempel waktu yang sama cuma membuat lognya berisik.
  catatLog(pengakses, {
    segmen: 'jurnal',
    aksi: LOG_AKSI.jurnalDibuat,
    objekId: baris.id,
    objekLabel: baris.judul,
    objekSlug: baris.slug,
    catatan: editorId ? `Editor langsung ditugaskan: ${namaAkun(editorId)}` : null,
  })

  return { data: baris }
})
