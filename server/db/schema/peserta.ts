// server/db/schema/peserta.ts
// Peserta = satu pendaftaran orang pada satu kegiatan.
// userId boleh kosong supaya pendaftaran tamu (tanpa akun) tetap bisa dicatat.
import { relations, sql, type InferSelectModel } from 'drizzle-orm'
import { sqliteTable, text, integer, index, unique, check } from 'drizzle-orm/sqlite-core'
import { generateCcId } from '../../utils/randomId'
import { ccUser } from './users'
import { ccKegiatan } from './kegiatan'

/**
 * Alur pendaftaran, dijalankan manual oleh admin — tidak ada perpindahan otomatis.
 *
 *   baru ──► proses ──► konfirmasi
 *     └─────────┴───────────┴──────► batal
 *                                      │
 *              dipulihkan ke status sebelumnya
 *
 * `batal` berarti orangnya benar-benar tidak jadi ikut. Karena itu ia bukan ujung
 * yang mati: yang membatalkan lalu berubah pikiran dikembalikan ke status terakhir
 * sebelum batal, bukan diulang dari awal — kerja admin yang sudah dilakukan
 * (menghubungi, memverifikasi pembayaran) tidak perlu diulang.
 */
export const PESERTA_STATUS = ['baru', 'proses', 'konfirmasi', 'batal'] as const
export type PesertaStatus = (typeof PESERTA_STATUS)[number]

/** Urutan maju. Dipakai server untuk memvalidasi transisi, bukan hanya UI. */
export const PESERTA_ALUR = ['baru', 'proses', 'konfirmasi'] as const

/** Status berikutnya dalam alur maju, atau null kalau sudah di ujung. */
export const statusBerikutnya = (status: PesertaStatus): PesertaStatus | null => {
  const i = PESERTA_ALUR.indexOf(status as (typeof PESERTA_ALUR)[number])
  if (i === -1 || i === PESERTA_ALUR.length - 1) return null
  return PESERTA_ALUR[i + 1]
}

export const ccPeserta = sqliteTable(
  'cc_peserta',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateCcId('ccp')),

    kegiatanId: text('kegiatan_id')
      .notNull()
      .references(() => ccKegiatan.id, { onDelete: 'cascade' }),
    /** Null = pendaftar tamu yang belum/tidak punya akun. */
    userId: text('user_id').references(() => ccUser.id, { onDelete: 'set null' }),

    /** Disalin saat mendaftar supaya data historis tidak ikut berubah kalau profil user diedit. */
    nama: text('nama', { length: 200 }).notNull(),
    email: text('email', { length: 255 }).notNull(),
    noHp: text('no_hp', { length: 20 }),
    institusi: text('institusi', { length: 200 }),
    catatan: text('catatan'),

    status: text('status', { enum: PESERTA_STATUS }).notNull().default('baru'),

    /**
     * Status sebelum dibatalkan, supaya pembatalan bisa dianulir tanpa menebak.
     * Disimpan sebagai kolom, bukan diturunkan dari riwayat: tidak ada tabel
     * riwayat status di sini, dan menambahkannya hanya demi satu langkah mundur
     * berarti setiap perubahan status menulis dua baris seumur hidup tabel ini.
     */
    statusSebelumBatal: text('status_sebelum_batal', { enum: PESERTA_STATUS }),

    terdaftarPada: integer('terdaftar_pada', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    /** Diisi saat peserta benar-benar hadir (check-in). */
    hadirPada: integer('hadir_pada', { mode: 'timestamp' }),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    // Satu email hanya boleh terdaftar sekali per kegiatan.
    unique('uq_peserta_kegiatan_email').on(t.kegiatanId, t.email),
    index('idx_peserta_kegiatan').on(t.kegiatanId),
    index('idx_peserta_status').on(t.status),
    index('idx_peserta_user').on(t.userId),
    check('chk_peserta_email', sql`${t.email} LIKE '%_@_%'`),
  ],
)

export const ccPesertaRelations = relations(ccPeserta, ({ one, many }) => ({
  kegiatan: one(ccKegiatan, { fields: [ccPeserta.kegiatanId], references: [ccKegiatan.id] }),
  user: one(ccUser, { fields: [ccPeserta.userId], references: [ccUser.id] }),
  transaksi: many(ccTransaksiMaster),
}))

export type DBPeserta = InferSelectModel<typeof ccPeserta>

import { ccTransaksiMaster } from './transaksi'
