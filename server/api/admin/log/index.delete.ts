// server/api/admin/log/index.delete.ts
// Master mengosongkan log — seluruhnya, satu segmen, atau riwayat satu objek.
//
// Ada supaya tabel ini tidak pernah jadi beban yang tidak bisa dilepas. Pembersihan
// 7 hari sudah berjalan sendiri (server/utils/log.ts); ini jalan manualnya untuk
// saat master memang ingin memulai dari kosong.

import { and, eq } from 'drizzle-orm'
import { db } from '../../../db'
import { ccLog, LOG_SEGMEN, type LogSegmen } from '../../../db/schema'
import { wajibRole } from '../../../utils/session'

export default defineEventHandler(async (event) => {
  await wajibRole(event, 'master')

  const q = getQuery(event)
  const segmen = LOG_SEGMEN.includes(q.segmen as LogSegmen) ? (q.segmen as LogSegmen) : null

  // `objekId` membuang seluruh riwayat SATU jurnal/event/member sekaligus.
  // Halaman log mengelompokkan barisnya per objek, jadi "buang yang ini" di layar
  // berarti satu kelompok — dan mengirim delapan permintaan DELETE untuk satu klik
  // adalah cara membuat penghapusan bisa berhasil setengah.
  const objekId = typeof q.objekId === 'string' && q.objekId ? q.objekId : null

  const syarat = [
    segmen ? eq(ccLog.segmen, segmen) : undefined,
    objekId ? eq(ccLog.objekId, objekId) : undefined,
  ].filter(Boolean)

  const hasil = db.delete(ccLog).where(syarat.length ? and(...syarat) : undefined).run()

  return {
    data: { dihapus: hasil.changes, segmen, objekId },
    message: objekId
      ? `${hasil.changes} catatan riwayat dihapus`
      : segmen
        ? `${hasil.changes} catatan segmen ${segmen} dihapus`
        : `${hasil.changes} catatan dihapus`,
  }
})
