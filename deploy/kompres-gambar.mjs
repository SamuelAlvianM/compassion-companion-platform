// deploy/kompres-gambar.mjs
// Memampatkan ulang gambar yang SUDAH tersimpan di pustaka media.
//
// Kenapa perlu: sampai perbaikan pipeline unggahan, gambar naik ke database apa
// adanya — foto ponsel 4000 px yang kebetulan berformat PNG tersimpan utuh, dan
// setiap pengunjung mengunduhnya utuh pula. Di produksi itu menumpuk jadi 35 MB
// untuk 25 gambar, dengan sampul event 1,6-2,9 MB per buah. Servernya sendiri
// menjawab dalam 20 milidetik; yang lama justru kabelnya.
//
// Perbaikan pipeline hanya berlaku untuk unggahan BARU. Berkas lama tidak akan
// mengecil sendiri, jadi ia perlu disentuh sekali — itu tugas skrip ini.
//
// Yang dilakukan per baris `cc_media` ber-kind 'gambar':
//   1. kecilkan sampai sisi terpanjang <= SISI_MAKS
//   2. kodekan ulang ke WebP (menyimpan alpha, jadi PNG transparan tetap aman)
//   3. tulis balik blob + ukuran + mime, dan ganti ekstensi di storage_key
//
// EKSTENSINYA SENGAJA IKUT BERUBAH. Berkas dilayani dengan
// `Cache-Control: immutable, max-age=1 tahun`, jadi kalau alamatnya tetap sama,
// Cloudflare akan terus menyajikan versi lama yang besar itu sampai setahun ke
// depan — perbaikannya tidak akan pernah sampai ke pengunjung. Alamat baru berarti
// entri cache baru. Tidak ada yang menyimpan alamat ini secara terpisah: semua
// pembaca mengambilnya dari kolom `public_url` baris yang sama.
//
// Pemakaian (dijalankan DI SERVER, tempat databasenya berada):
//   node deploy/kompres-gambar.mjs --uji     # laporan saja, tidak menulis
//   node deploy/kompres-gambar.mjs           # tulis perubahan
//
// AMBIL SNAPSHOT DULU. Skrip ini menimpa blob di tempat:
//   sqlite3 data/cc.db "VACUUM INTO '/root/backup-sebelum-kompres.db'"

import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)

/** Modul native diambil dari .output kalau ada — di server, hanya di situ ia
    terpasang; di mesin pengembangan, node_modules biasa yang punya. */
const muat = (nama) => {
  const diOutput = resolve(process.cwd(), '.output/server/node_modules', nama)
  return require(existsSync(diOutput) ? diOutput : nama)
}

const Database = muat('better-sqlite3')
const sharp = muat('sharp')

const SISI_MAKS = 1920
const MUTU = 82
/** Hanya tulis kalau hasilnya benar-benar lebih kecil. Menukar berkas demi selisih
    beberapa persen berarti mengodekan ulang tanpa alasan — dan tiap pengodean
    ulang gambar lossy sedikit menurunkan mutunya. */
const AMBANG = 0.95

/** Ganti ekstensi apa pun jadi .webp. Ditulis dengan lastIndexOf, bukan regex:
    pola ekstensi butuh backslash ganda, dan itu gampang rusak saat berkas ini
    disalin lewat shell. */
const keWebp = (nama) => {
  const titik = nama.lastIndexOf('.')
  return (titik > 0 ? nama.slice(0, titik) : nama) + '.webp'
}

const ujiSaja = process.argv.includes('--uji')
const berkasDb = process.env.CC_DB ?? 'data/cc.db'

const db = new Database(berkasDb)
const mb = (n) => (n / 1048576).toFixed(2)

const baris = db
  .prepare(`select id, original_name, file_name, mime_type, file_size, storage_key, public_url
            from cc_media where kind = 'gambar' order by file_size desc`)
  .all()

console.log(`${baris.length} gambar di ${berkasDb}${ujiSaja ? ' (UJI — tidak menulis)' : ''}\n`)

let sebelum = 0
let sesudah = 0
let diubah = 0

for (const m of baris) {
  const blob = db.prepare('select file_data from cc_media where id = ?').get(m.id).file_data
  const asal = Buffer.isBuffer(blob) ? blob : Buffer.from(blob)
  sebelum += asal.length

  let hasil
  let meta
  try {
    meta = await sharp(asal).metadata()
    hasil = await sharp(asal)
      .resize({ width: SISI_MAKS, height: SISI_MAKS, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: MUTU })
      .toBuffer()
  }
  catch (e) {
    console.log(`  LEWAT  ${m.original_name} — tidak bisa dibaca sharp: ${e.message}`);
    sesudah += asal.length
    continue
  }

  if (hasil.length >= asal.length * AMBANG) {
    console.log(`  tetap  ${m.original_name} (${mb(asal.length)}MB — sudah ringkas)`)
    sesudah += asal.length
    continue
  }

  const metaBaru = await sharp(hasil).metadata()
  const namaBaru = keWebp(m.file_name)
  const kunciBaru = keWebp(m.storage_key)
  const urlBaru = keWebp(m.public_url)

  console.log(`  KECIL  ${m.original_name}`)
  console.log(`         ${mb(asal.length)}MB ${meta.width}x${meta.height} ${meta.format}`
    + ` -> ${mb(hasil.length)}MB ${metaBaru.width}x${metaBaru.height} webp`)

  if (!ujiSaja) {
    db.transaction(() => {
      db.prepare(`update cc_media set file_data = ?, file_size = ?, mime_type = 'image/webp',
                  file_name = ?, storage_key = ?, public_url = ? where id = ?`)
        .run(hasil, hasil.length, namaBaru, kunciBaru, urlBaru, m.id)
      db.prepare(`update cc_media_gambar set mime_type = 'image/webp', width = ?, height = ?
                  where media_id = ?`)
        .run(metaBaru.width ?? null, metaBaru.height ?? null, m.id)
    })()
  }

  sesudah += hasil.length
  diubah++
}

console.log(`\n${diubah} gambar dimampatkan`)
console.log(`total: ${mb(sebelum)}MB -> ${mb(sesudah)}MB (hemat ${mb(sebelum - sesudah)}MB)`)
if (ujiSaja) console.log('\nUJI — tidak ada yang ditulis. Jalankan tanpa --uji untuk menerapkan.')
