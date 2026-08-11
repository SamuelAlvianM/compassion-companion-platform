// server/db/schema/sesi.ts
// Sesi = "partisi" sebuah kegiatan (Day 1, Day 2, …) beserta isinya.
//
// Dua tabel, bukan empat. Materi pembelajaran, galeri foto, dan referensi punya
// bentuk data yang praktis sama — judul, jenis, berkas atau tautan, urutan — jadi
// ketiganya ditampung `cc_sesi_item` dengan kolom pembeda `bagian`. Memisahkannya
// jadi tiga tabel berarti tiga migrasi, tiga set endpoint, dan tiga logika urutan
// yang identik. Polanya sama dengan `cfsme_page_section` di website-cosmos: satu
// tabel item berurutan, jenisnya ditentukan kolom.

import { relations, sql, type InferSelectModel } from 'drizzle-orm'
import { sqliteTable, text, integer, index, check } from 'drizzle-orm/sqlite-core'
import { generateCcId } from '../../utils/randomId'

/** Kelompok tampilan di halaman detail event. */
export const SESI_BAGIAN = ['materi', 'galeri', 'referensi'] as const
export type SesiBagian = (typeof SESI_BAGIAN)[number]

/**
 * Jenis isi. `youtube` sengaja dipisah dari `tautan` karena diperlakukan berbeda:
 * ia di-embed sebagai iframe, bukan dibuka di tab baru.
 */
export const ITEM_JENIS = ['pdf', 'dokumen', 'video', 'youtube', 'gambar', 'tautan'] as const
export type ItemJenis = (typeof ITEM_JENIS)[number]

export const ccSesi = sqliteTable(
  'cc_sesi',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateCcId('ccs')),

    kegiatanId: text('kegiatan_id')
      .notNull()
      .references(() => ccKegiatan.id, { onDelete: 'cascade' }),

    judul: text('judul', { length: 300 }).notNull(),
    judulEn: text('judul_en', { length: 300 }),

    /** Tanggal sesi ini berlangsung. Boleh kosong untuk sesi tanpa jadwal tetap. */
    tanggal: integer('tanggal', { mode: 'timestamp' }),

    /** Urutan tampil, mulai 0. Bukan turunan tanggal: sesi boleh tanpa tanggal. */
    urutan: integer('urutan').notNull().default(0),

    /** Sembunyikan dari halaman publik tanpa menghapus isinya. */
    tampil: integer('tampil', { mode: 'boolean' }).notNull().default(true),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
  },
  t => [index('idx_sesi_kegiatan_urutan').on(t.kegiatanId, t.urutan)],
)

export const ccSesiItem = sqliteTable(
  'cc_sesi_item',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateCcId('cci')),

    sesiId: text('sesi_id')
      .notNull()
      .references(() => ccSesi.id, { onDelete: 'cascade' }),

    bagian: text('bagian', { enum: SESI_BAGIAN }).notNull(),
    jenis: text('jenis', { enum: ITEM_JENIS }).notNull(),

    /** Untuk galeri, judul dipakai sebagai teks alternatif gambar. */
    judul: text('judul', { length: 300 }).notNull(),
    judulEn: text('judul_en', { length: 300 }),

    /** Berkas yang diunggah. Kosong bila item ini berupa tautan luar. */
    mediaId: text('media_id').references(() => ccMedia.id, { onDelete: 'set null' }),

    /** Tautan luar: URL YouTube (boleh unlisted) atau alamat web biasa. */
    url: text('url', { length: 1000 }),

    /**
     * Hanya berarti untuk `bagian = 'materi'`. Yang terkunci disaring di server:
     * peserta kegiatan ini, atau pengelola level ≤ 3.
     */
    terkunci: integer('terkunci', { mode: 'boolean' }).notNull().default(false),

    urutan: integer('urutan').notNull().default(0),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
  },
  t => [
    index('idx_sesi_item_sesi').on(t.sesiId, t.bagian, t.urutan),
    // Item tanpa berkas maupun tautan tidak bisa dibuka sama sekali — tolak di
    // level database, bukan hanya di form, supaya tidak ada baris mati.
    check('chk_sesi_item_sumber', sql`${t.mediaId} IS NOT NULL OR ${t.url} IS NOT NULL`),
  ],
)

export const ccSesiRelations = relations(ccSesi, ({ one, many }) => ({
  kegiatan: one(ccKegiatan, {
    fields: [ccSesi.kegiatanId],
    references: [ccKegiatan.id],
  }),
  items: many(ccSesiItem),
}))

export const ccSesiItemRelations = relations(ccSesiItem, ({ one }) => ({
  sesi: one(ccSesi, {
    fields: [ccSesiItem.sesiId],
    references: [ccSesi.id],
  }),
  media: one(ccMedia, {
    fields: [ccSesiItem.mediaId],
    references: [ccMedia.id],
  }),
}))

export type DBSesi = InferSelectModel<typeof ccSesi>
export type DBSesiItem = InferSelectModel<typeof ccSesiItem>

// Import silang ditaruh di akhir berkas untuk menghindari circular import ESM
// (pola yang sama dipakai users.ts, kegiatan.ts, dan peserta.ts).
import { ccKegiatan } from './kegiatan'
import { ccMedia } from './media'
