// deploy/snapshot-db.mjs — jalan di MESIN LOKAL, dipanggil deploy.sh --kirim-db.
//
// Menyalin data/cc.db ke deploy/cc.db.snapshot untuk dikirim ke server.
//
// Kenapa tidak `cp` biasa: database ini jalan dalam mode WAL. Tulisan terbaru
// ada di cc.db-wal dan belum tentu sudah masuk ke cc.db — saat berkas ini
// ditulis, WAL-nya 119 KB dari db 262 KB. Menyalin cc.db saja berarti
// mengirim database yang kehilangan perubahan paling akhir, diam-diam.
//
// `VACUUM INTO` menulis satu berkas utuh yang sudah menyertakan isi WAL,
// tanpa mengunci atau mengubah database sumber.
import Database from 'better-sqlite3'
import { existsSync, rmSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const sumber = resolve(here, '..', process.env.DATABASE_URL ?? './data/cc.db')
const tujuan = resolve(here, 'cc.db.snapshot')

if (!existsSync(sumber)) {
  console.error(`[snapshot-db] Tidak ada database di ${sumber}`)
  process.exit(1)
}

// VACUUM INTO menolak menulis ke berkas yang sudah ada.
if (existsSync(tujuan)) rmSync(tujuan)

const db = new Database(sumber, { readonly: true })
db.exec(`VACUUM INTO '${tujuan.replace(/'/g, "''")}'`)

// Sanity check: snapshot kosong berarti ada yang salah, dan lebih baik ketahuan
// di sini daripada setelah terkirim ke produksi.
const cek = new Database(tujuan, { readonly: true })
const jumlahUser = cek.prepare('select count(*) c from cc_user').get().c
const jumlahKegiatan = cek.prepare('select count(*) c from cc_kegiatan').get().c
console.log(`[snapshot-db] ${tujuan}`)
console.log(`[snapshot-db] cc_user=${jumlahUser} cc_kegiatan=${jumlahKegiatan}`)
if (jumlahUser === 0) {
  console.error('[snapshot-db] Tidak ada satu pun akun — server akan mustahil dimasuki.')
  process.exit(1)
}
