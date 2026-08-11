// server/db/schema/media.ts
//
// Pola diambil dari website-cosmos (server/db/schema/media.ts + api/storage/[...path].get.ts):
// binary file disimpan langsung di kolom blob, lalu dilayani lewat /api/storage/[...path]
// berdasarkan `storageKey`. Di Postgres kolomnya `bytea`; di SQLite padanannya `blob`.
//
// Struktur supertype/subtype:
//   ccMedia        -> tabel utama. Semua file (apa pun jenisnya) punya baris di sini.
//                     Blob + storageKey + publicUrl ada di tabel ini saja.
//   ccMediaGambar  -> metadata khusus gambar  (hanya menerima mime image/*)
//   ccMediaVideo   -> metadata khusus video   (hanya menerima mime video/*)
//   ccMediaEtc     -> metadata dokumen        (pdf, doc/docx, xls/xlsx, ppt/pptx, csv)
//
// Subtype selalu 1:1 ke ccMedia lewat mediaId (primary key sekaligus foreign key).

import { relations, sql, type InferSelectModel } from 'drizzle-orm'
import { sqliteTable, text, integer, blob, index, check } from 'drizzle-orm/sqlite-core'
// Import eksplisit (bukan auto-import Nitro): drizzle-kit membaca file ini di luar Nitro.
import { generateCcId } from '../../utils/randomId'
import { ccUser } from './users'

/** Jenis media, dipakai untuk memilih tabel subtype yang tepat. */
export const MEDIA_KINDS = ['gambar', 'video', 'etc'] as const
export type MediaKind = (typeof MEDIA_KINDS)[number]

export const ccMedia = sqliteTable(
  'cc_media',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateCcId('ccm')),

    /** Nama file asli saat diunggah, mis. "sertifikat peserta.pdf" */
    originalName: text('original_name', { length: 500 }).notNull(),
    /** Nama file hasil normalisasi, mis. "ccm-A1b2C3d4.pdf" */
    fileName: text('file_name', { length: 500 }).notNull(),
    mimeType: text('mime_type', { length: 100 }).notNull(),
    /** Ukuran dalam byte */
    fileSize: integer('file_size').notNull(),

    /** Kunci kanonik, disimpan sebagai "/storage/uploads/2026/08/ccm-A1b2C3d4.pdf" */
    storageKey: text('storage_key', { length: 500 }).notNull().unique(),
    /** URL siap pakai untuk <img>/<a>, mis. "/api/storage/uploads/2026/08/ccm-A1b2C3d4.pdf" */
    publicUrl: text('public_url', { length: 1000 }).notNull(),

    /** Binary file. Ini "path utama untuk kirim-kirim" — blob hanya ada di tabel ini. */
    fileData: blob('file_data', { mode: 'buffer' }).notNull(),

    kind: text('kind', { enum: MEDIA_KINDS }).notNull(),

    uploadedBy: text('uploaded_by').references(() => ccUser.id, { onDelete: 'set null' }),
    uploadedAt: integer('uploaded_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index('idx_media_kind').on(t.kind),
    index('idx_media_uploaded_by').on(t.uploadedBy),
    check('chk_media_size_positive', sql`${t.fileSize} > 0`),
  ],
)

/** Metadata khusus gambar. Constraint memastikan tabel ini HANYA menerima gambar. */
export const ccMediaGambar = sqliteTable(
  'cc_media_gambar',
  {
    mediaId: text('media_id')
      .primaryKey()
      .references(() => ccMedia.id, { onDelete: 'cascade' }),

    /** Disalin dari ccMedia.mimeType supaya CHECK di bawah bisa menjaganya. */
    mimeType: text('mime_type', { length: 100 }).notNull(),
    width: integer('width'),
    height: integer('height'),
    /** Teks alternatif untuk aksesibilitas */
    altText: text('alt_text', { length: 500 }),
    caption: text('caption'),
    /** Warna dominan (hex) untuk placeholder saat gambar belum termuat */
    dominantColor: text('dominant_color', { length: 9 }),
    /** Thumbnail kecil, opsional. Blob besar tetap di ccMedia.fileData. */
    thumbnail: blob('thumbnail', { mode: 'buffer' }),
  },
  (t) => [
    // "hanya terima gambar" ditegakkan di level database, bukan cuma di aplikasi.
    check('chk_media_gambar_mime', sql`${t.mimeType} LIKE 'image/%'`),
  ],
)

export const ccMediaVideo = sqliteTable(
  'cc_media_video',
  {
    mediaId: text('media_id')
      .primaryKey()
      .references(() => ccMedia.id, { onDelete: 'cascade' }),

    mimeType: text('mime_type', { length: 100 }).notNull(),
    /** Durasi dalam detik */
    durationSeconds: integer('duration_seconds'),
    width: integer('width'),
    height: integer('height'),
    /** Gambar poster/cover, menunjuk ke baris ccMedia lain yang ber-kind 'gambar' */
    posterMediaId: text('poster_media_id').references(() => ccMedia.id, { onDelete: 'set null' }),
  },
  (t) => [check('chk_media_video_mime', sql`${t.mimeType} LIKE 'video/%'`)],
)

/** Dokumen: pdf, docs, excel, powerpoint, csv. */
export const DOC_TYPES = ['pdf', 'doc', 'xls', 'ppt', 'csv', 'lainnya'] as const
export type DocType = (typeof DOC_TYPES)[number]

export const ccMediaEtc = sqliteTable('cc_media_etc', {
  mediaId: text('media_id')
    .primaryKey()
    .references(() => ccMedia.id, { onDelete: 'cascade' }),

  mimeType: text('mime_type', { length: 100 }).notNull(),
  docType: text('doc_type', { enum: DOC_TYPES }).notNull(),
  /** Jumlah halaman (kalau terbaca, mis. PDF) */
  pageCount: integer('page_count'),
  /** Judul yang ditampilkan di daftar unduhan */
  displayTitle: text('display_title', { length: 300 }),
})

// ── Relations ────────────────────────────────────────────────────────────────

export const ccMediaRelations = relations(ccMedia, ({ one }) => ({
  uploader: one(ccUser, { fields: [ccMedia.uploadedBy], references: [ccUser.id] }),
  gambar: one(ccMediaGambar, { fields: [ccMedia.id], references: [ccMediaGambar.mediaId] }),
  video: one(ccMediaVideo, { fields: [ccMedia.id], references: [ccMediaVideo.mediaId] }),
  etc: one(ccMediaEtc, { fields: [ccMedia.id], references: [ccMediaEtc.mediaId] }),
}))

export const ccMediaGambarRelations = relations(ccMediaGambar, ({ one }) => ({
  media: one(ccMedia, { fields: [ccMediaGambar.mediaId], references: [ccMedia.id] }),
}))

export const ccMediaVideoRelations = relations(ccMediaVideo, ({ one }) => ({
  media: one(ccMedia, { fields: [ccMediaVideo.mediaId], references: [ccMedia.id] }),
  poster: one(ccMedia, { fields: [ccMediaVideo.posterMediaId], references: [ccMedia.id] }),
}))

export const ccMediaEtcRelations = relations(ccMediaEtc, ({ one }) => ({
  media: one(ccMedia, { fields: [ccMediaEtc.mediaId], references: [ccMedia.id] }),
}))

export type DBMedia = InferSelectModel<typeof ccMedia>
export type DBMediaGambar = InferSelectModel<typeof ccMediaGambar>
export type DBMediaVideo = InferSelectModel<typeof ccMediaVideo>
export type DBMediaEtc = InferSelectModel<typeof ccMediaEtc>
