// deploy/migrate.mjs — jalan DI SERVER, dipanggil deploy.sh --migrasi.
//
// deploy.sh menaruh berkas ini di ~/ccwebsite/.output/server/ supaya
// better-sqlite3 ter-resolve dari node_modules milik .output. Server tidak punya
// node_modules sendiri dan tidak perlu punya: bundle Nitro sudah membawanya,
// termasuk prebuild linux-x64 better-sqlite3.
//
// KENAPA MIGRATOR-NYA DITULIS SENDIRI, BUKAN `drizzle-orm/better-sqlite3/migrator`
// ------------------------------------------------------------------------------
// Versi pertama berkas ini mengimpor migrator bawaan drizzle. Itu tidak pernah
// bisa jalan, dan baru ketahuan pada `--migrasi` pertama yang sungguhan (12 Agu
// 2026) — deploy pertama memakai `--kirim-db`, yang membawa database dengan
// riwayat migrasi sudah lengkap, sehingga jalur ini tidak pernah tersentuh:
//
//   Cannot find module '.../drizzle-orm/better-sqlite3/migrator.js'
//
// Nitro hanya menyertakan modul yang benar-benar diimpor kode aplikasi.
// Aplikasi memakai `drizzle-orm/better-sqlite3` (driver) tapi tidak pernah
// memakai migrator-nya, jadi `migrator.js` ikut terbuang saat tree-shaking.
// Menambahkan impor palsu di kode aplikasi hanya untuk menahannya di bundle
// berarti membawa perkakas deploy ke dalam berkas yang melayani pengunjung.
//
// Yang ditiru di bawah ini perilaku `SQLiteDialect.migrate()` **persis**, supaya
// riwayat di `__drizzle_migrations` tetap terbaca drizzle di mesin lokal:
//
//   · nama tabel `__drizzle_migrations`, kolom id/hash/created_at
//   · `hash` = sha256 dari ISI BERKAS .sql utuh (sebelum dipecah)
//   · `created_at` = `when` milik entri di meta/_journal.json
//   · sebuah migrasi dijalankan bila `created_at` baris terakhir < `when`-nya
//   · seluruh migrasi yang tertunda dijalankan dalam SATU transaksi
//
// drizzle-kit sengaja tetap TIDAK dipakai di server: `push` membandingkan skema
// lalu bertanya interaktif, dan tanpa TTY itu bisa gagal diam-diam.

import Database from 'better-sqlite3'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const dbPath = resolve(process.cwd(), process.env.DATABASE_URL ?? './data/cc.db')
const folderMigrasi = resolve(process.cwd(), 'server/db/migrations')

mkdirSync(dirname(dbPath), { recursive: true })

const sqlite = new Database(dbPath)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

console.log(`[migrate] db      : ${dbPath}`)
console.log(`[migrate] migrasi : ${folderMigrasi}`)

/** Baca meta/_journal.json + tiap .sql — sama seperti readMigrationFiles() drizzle. */
const bacaMigrasi = () => {
  const journal = JSON.parse(readFileSync(`${folderMigrasi}/meta/_journal.json`, 'utf8'))
  return journal.entries.map((entri) => {
    const isi = readFileSync(`${folderMigrasi}/${entri.tag}.sql`, 'utf8')
    return {
      tag: entri.tag,
      // Dipecah pada penanda yang ditulis drizzle-kit; tiap potongan satu
      // pernyataan. Hash dihitung dari isi UTUH, bukan dari potongannya.
      pernyataan: isi.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean),
      when: entri.when,
      hash: createHash('sha256').update(isi).digest('hex'),
    }
  })
}

// `id SERIAL PRIMARY KEY` bukan salah ketik — begitulah drizzle membuatnya, dan
// di SQLite itu berarti kolom bertipe SERIAL yang isinya selalu NULL. Ditiru apa
// adanya supaya database yang lahir di sini identik dengan yang lahir di lokal.
sqlite.exec(`CREATE TABLE IF NOT EXISTS __drizzle_migrations (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at numeric
)`)

const terakhir = sqlite
  .prepare('SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1')
  .get()

const semua = bacaMigrasi()
const tertunda = semua.filter(m => !terakhir || Number(terakhir.created_at) < m.when)

if (!tertunda.length) {
  console.log(`[migrate] tidak ada migrasi baru (${semua.length} sudah tercatat).`)
}
else {
  console.log(`[migrate] ${tertunda.length} migrasi akan dijalankan: ${tertunda.map(m => m.tag).join(', ')}`)

  const catat = sqlite.prepare('INSERT INTO __drizzle_migrations ("hash", "created_at") VALUES (?, ?)')

  // Satu transaksi untuk seluruh migrasi yang tertunda — sama seperti drizzle.
  // Gagal di tengah berarti tidak ada satu pun yang tercatat setengah jalan.
  const jalankan = sqlite.transaction(() => {
    for (const m of tertunda) {
      for (const pernyataan of m.pernyataan) sqlite.exec(pernyataan)
      catat.run(m.hash, m.when)
      console.log(`[migrate]   OK ${m.tag} (${m.pernyataan.length} pernyataan)`)
    }
  })

  jalankan()
}

const tabel = sqlite
  .prepare("select name from sqlite_master where type='table' and name like 'cc_%' order by name")
  .all()
  .map(r => r.name)
console.log(`[migrate] selesai. ${tabel.length} tabel: ${tabel.join(', ')}`)
sqlite.close()
