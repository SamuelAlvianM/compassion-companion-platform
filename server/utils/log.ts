// server/utils/log.ts
// Satu-satunya jalan menulis ke `cc_log`, dan tempat pembersihan 7 harinya hidup.

import { eq, lt } from 'drizzle-orm'
import { db } from '../db'
import { ccLog, ccUser, LOG_SIMPAN_HARI, type LogSegmen } from '../db/schema'
import type { SessionUser } from './session'

export interface CatatanLog {
  segmen: LogSegmen
  aksi: string
  objekId?: string | null
  objekLabel?: string | null
  objekSlug?: string | null
  catatan?: string | null
}

const HARI = 24 * 60 * 60 * 1000

/**
 * Pembersihan dijalankan MENUMPANG pada penulisan, bukan lewat penjadwal.
 *
 * Aplikasi ini satu proses Nitro dengan SQLite di berkas yang sama; menambah cron
 * berarti menambah sesuatu yang bisa mati diam-diam dan tidak ada yang tahu. Yang
 * dijamin di sini lebih sederhana dan cukup: log tidak pernah tumbuh melewati 7
 * hari SELAMA masih ada yang dicatat — dan kalau tidak ada yang dicatat, tidak ada
 * yang tumbuh.
 *
 * Dibatasi sekali per jam supaya DELETE-nya tidak ikut menempel di tiap
 * permintaan. Variabelnya di memori proses: kalau server restart, pembersihan
 * berikutnya cuma berjalan sekali lebih awal — tidak ada ruginya.
 */
let bersihTerakhir = 0

const bersihkanLogLama = () => {
  const sekarang = Date.now()
  if (sekarang - bersihTerakhir < 60 * 60 * 1000) return
  bersihTerakhir = sekarang
  const batas = new Date(sekarang - LOG_SIMPAN_HARI * HARI)
  db.delete(ccLog).where(lt(ccLog.createdAt, batas)).run()
}

/** Paksa pembersihan sekarang, mengabaikan pembatas sejam. Dipakai endpoint log
    supaya master tidak pernah melihat baris yang seharusnya sudah kedaluwarsa
    hanya karena kebetulan belum ada yang menulis log sejak sejam lalu. */
export const bersihkanLogSekarang = () => {
  bersihTerakhir = Date.now()
  const batas = new Date(Date.now() - LOG_SIMPAN_HARI * HARI)
  return db.delete(ccLog).where(lt(ccLog.createdAt, batas)).run().changes
}

/**
 * Catat satu kejadian.
 *
 * TIDAK PERNAH melempar. Pencatatan adalah efek samping dari pekerjaan sebenarnya;
 * kalau menulis log gagal, yang salah bukan tindakan penggunanya, dan menggagalkan
 * permintaan karena catatannya gagal ditulis berarti fitur pengamat ikut
 * menjatuhkan fitur yang diamatinya.
 */
export const catatLog = (pelaku: Pick<SessionUser, 'id' | 'fullName' | 'role'> | null, isi: CatatanLog) => {
  try {
    db.insert(ccLog).values({
      segmen: isi.segmen,
      aksi: isi.aksi,
      objekId: isi.objekId ?? null,
      objekLabel: isi.objekLabel ?? null,
      objekSlug: isi.objekSlug ?? null,
      pelakuId: pelaku?.id ?? null,
      pelakuNama: pelaku?.fullName ?? null,
      pelakuRole: pelaku?.role ?? null,
      catatan: isi.catatan ?? null,
    }).run()
    bersihkanLogLama()
  } catch (err) {
    console.error('[log] gagal mencatat', isi.aksi, err)
  }
}

/**
 * Nama akun untuk ditulis ke dalam `catatan`.
 *
 * Yang disimpan namanya, bukan idnya, karena kalimat log dibaca manusia: "Editor
 * ditugaskan: ccu-OrOGgIIX" tidak memberi tahu siapa pun apa-apa. Kalau akunnya
 * sudah tidak ada, id-nya dipakai apa adanya — lebih baik daripada kalimat yang
 * menggantung tanpa objek.
 */
export const namaAkun = (id: string | null | undefined) => {
  if (!id) return '—'
  const akun = db.select({ nama: ccUser.fullName }).from(ccUser).where(eq(ccUser.id, id)).get()
  return akun?.nama ?? id
}
