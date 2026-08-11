// server/db/schema/refleksi.ts
// Refleksi = catatan/komentar yang ditulis user, biasanya setelah mengikuti kegiatan.
//
// Dipisahkan dari jurnal redaksional: jurnal ditulis & dikurasi editor, refleksi
// ditulis peserta sendiri. Keduanya bisa tampil berdampingan nanti, tapi alur
// penulisan dan hak aksesnya berbeda.

import { relations, sql, type InferSelectModel } from 'drizzle-orm'
import { sqliteTable, text, integer, index, check } from 'drizzle-orm/sqlite-core'
import { generateCcId } from '../../utils/randomId'
import { ccUser } from './users'
import { ccKegiatan } from './kegiatan'
import { ccMedia } from './media'

export const REFLEKSI_VISIBILITAS = ['publik', 'peserta', 'pribadi'] as const
export type RefleksiVisibilitas = (typeof REFLEKSI_VISIBILITAS)[number]

export const ccRefleksi = sqliteTable(
  'cc_refleksi',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateCcId('ccr')),

    /** Penulis. Hapus akun -> refleksinya ikut terhapus. */
    userId: text('user_id')
      .notNull()
      .references(() => ccUser.id, { onDelete: 'cascade' }),

    /** Boleh kosong: refleksi tidak harus terikat pada satu kegiatan. */
    kegiatanId: text('kegiatan_id').references(() => ccKegiatan.id, { onDelete: 'set null' }),

    isi: text('isi').notNull(),

    /** Satu gambar pendamping, mengikuti tampilan kartu bergaya Instagram. */
    mediaId: text('media_id').references(() => ccMedia.id, { onDelete: 'set null' }),

    /**
     * publik  -> tampil di profil dan bisa dilihat siapa saja
     * peserta -> hanya sesama peserta kegiatan yang sama
     * pribadi -> hanya penulis dan pengelola (level <= 2)
     */
    visibilitas: text('visibilitas', { enum: REFLEKSI_VISIBILITAS }).notNull().default('publik'),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    index('idx_refleksi_user').on(t.userId),
    index('idx_refleksi_kegiatan').on(t.kegiatanId),
    index('idx_refleksi_dibuat').on(t.createdAt),
    check('chk_refleksi_isi', sql`length(trim(${t.isi})) > 0`),
  ],
)

export const ccRefleksiRelations = relations(ccRefleksi, ({ one }) => ({
  penulis: one(ccUser, { fields: [ccRefleksi.userId], references: [ccUser.id] }),
  kegiatan: one(ccKegiatan, { fields: [ccRefleksi.kegiatanId], references: [ccKegiatan.id] }),
  media: one(ccMedia, { fields: [ccRefleksi.mediaId], references: [ccMedia.id] }),
}))

export type DBRefleksi = InferSelectModel<typeof ccRefleksi>
