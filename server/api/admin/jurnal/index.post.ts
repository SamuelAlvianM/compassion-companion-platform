// server/api/admin/jurnal/index.post.ts
// Buat jurnal baru. Selalu lahir sebagai draft — tidak ada jalan membuat tulisan
// yang langsung terbit, sama seperti tidak ada transisi draft -> terbit.
//
// ADMIN KE ATAS SAJA. Endpoint ini sempat bergerbang `editor`, sisa dari masa
// ketika editor memang menulis. Sejak `bolehSunting` menolak level 3 tanpa
// kecuali, gerbang itu cuma menyisakan satu jalan yang tidak berujung: editor
// bisa MEMBUAT baris, lalu tidak bisa menyentuh isinya sedetik kemudian — draf
// kosong yang mengendap di antrean, dengan namanya sebagai pembuat.
//
// Editor yang ingin menulis atas namanya sendiri tetap bisa, lewat
// /api/jurnal-saya — di sana ia berdiri sebagai PENULIS, tulisannya melewati
// editor lain, dan admin yang menerbitkannya. Yang ditutup di sini adalah
// menulis dari dalam dashboard redaksi, tempat ia bertugas menilai.

import { db } from '../../../db'
import { ccJurnal } from '../../../db/schema'
import { wajibRole } from '../../../utils/session'
import { bacaBodyJurnal, periksaEditorId, slugJurnalUnik } from '../../../utils/validasi-jurnal'
import { catatLog, namaAkun } from '../../../utils/log'
import { LOG_AKSI } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const pengakses = await wajibRole(event, 'admin')

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
  // Nilai kosong tetap dilewatkan tanpa diperiksa, bukan dikirim ke
  // `periksaEditorId`. Sejak gerbangnya naik ke admin, keduanya memang tidak
  // pernah lagi berbeda hasilnya — tapi "tidak menugaskan siapa pun" bukan
  // tindakan yang perlu wewenang, dan menuliskannya begitu membuat baris ini
  // tetap benar seandainya gerbangnya bergeser lagi.
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
