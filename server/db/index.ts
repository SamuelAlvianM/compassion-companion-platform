// server/db/index.ts
// Klien SQLite (better-sqlite3) + drizzle.
//
// File database default: ./data/cc.db  (bisa dioverride lewat env DATABASE_URL)
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import * as schema from './schema'

const dbPath = resolve(process.cwd(), process.env.DATABASE_URL ?? './data/cc.db')

// Pastikan foldernya ada, kalau tidak better-sqlite3 melempar SQLITE_CANTOPEN.
mkdirSync(dirname(dbPath), { recursive: true })

const sqlite = new Database(dbPath)

// WAL: baca dan tulis bisa jalan bersamaan — penting karena Nitro menangani request paralel.
sqlite.pragma('journal_mode = WAL')
// SQLite mematikan foreign key secara default; tanpa ini onDelete cascade tidak berjalan.
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })
export { schema, sqlite }
