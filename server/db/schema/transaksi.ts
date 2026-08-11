// server/db/schema/transaksi.ts
// Pola master-detail klasik:
//   ccTransaksiMaster -> satu nota/invoice (siapa, kapan, total, status bayar)
//   ccTransaksiDetail -> baris-baris item di dalam nota tersebut
//
// Nilai uang disimpan sebagai integer rupiah penuh supaya tidak kena galat pembulatan float.
import { relations, sql, type InferSelectModel } from 'drizzle-orm'
import { sqliteTable, text, integer, index, check } from 'drizzle-orm/sqlite-core'
import { generateCcId, generateNomorTransaksi } from '../../utils/randomId'
import { ccUser } from './users'
import { ccPeserta } from './peserta'
import { ccKegiatan } from './kegiatan'

export const TRANSAKSI_STATUS = [
  'draft',
  'belum_bayar',
  'menunggu_verifikasi',
  'lunas',
  'batal',
  'refund',
] as const
export type TransaksiStatus = (typeof TRANSAKSI_STATUS)[number]

export const METODE_BAYAR = ['transfer', 'tunai', 'qris', 'gratis', 'lainnya'] as const
export type MetodeBayar = (typeof METODE_BAYAR)[number]

export const ccTransaksiMaster = sqliteTable(
  'cc_transaksi_master',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateCcId('cct')),

    /** Nomor nota yang ditampilkan ke pengguna, mis. CC/2026/08/A1B2C3D4 */
    nomor: text('nomor', { length: 50 }).notNull().unique().$defaultFn(() => generateNomorTransaksi()),

    pesertaId: text('peserta_id').references(() => ccPeserta.id, { onDelete: 'set null' }),
    userId: text('user_id').references(() => ccUser.id, { onDelete: 'set null' }),

    tanggal: integer('tanggal', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),

    /** subtotal - diskon = total. Dijaga konsisten oleh service, bukan trigger. */
    subtotal: integer('subtotal').notNull().default(0),
    diskon: integer('diskon').notNull().default(0),
    total: integer('total').notNull().default(0),

    metodeBayar: text('metode_bayar', { enum: METODE_BAYAR }),
    status: text('status', { enum: TRANSAKSI_STATUS }).notNull().default('draft'),

    /** Bukti transfer — menunjuk ke cc_media (biasanya ber-kind 'gambar'). */
    buktiMediaId: text('bukti_media_id'),

    dibayarPada: integer('dibayar_pada', { mode: 'timestamp' }),
    catatan: text('catatan'),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    index('idx_trx_status').on(t.status),
    index('idx_trx_peserta').on(t.pesertaId),
    index('idx_trx_user').on(t.userId),
    index('idx_trx_tanggal').on(t.tanggal),
    check('chk_trx_subtotal', sql`${t.subtotal} >= 0`),
    check('chk_trx_diskon', sql`${t.diskon} >= 0`),
    check('chk_trx_total', sql`${t.total} >= 0`),
  ],
)

export const ccTransaksiDetail = sqliteTable(
  'cc_transaksi_detail',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateCcId('ccd')),

    /** Hapus master -> baris detail ikut terhapus. */
    transaksiId: text('transaksi_id')
      .notNull()
      .references(() => ccTransaksiMaster.id, { onDelete: 'cascade' }),

    /** Item biasanya merujuk ke satu kegiatan, tapi boleh kosong untuk item bebas. */
    kegiatanId: text('kegiatan_id').references(() => ccKegiatan.id, { onDelete: 'set null' }),

    /** Disalin saat transaksi dibuat supaya nota lama tetap terbaca walau kegiatan berubah nama. */
    deskripsi: text('deskripsi', { length: 300 }).notNull(),

    qty: integer('qty').notNull().default(1),
    hargaSatuan: integer('harga_satuan').notNull().default(0),
    /** qty * hargaSatuan, disimpan agar laporan tidak perlu menghitung ulang. */
    subtotal: integer('subtotal').notNull().default(0),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index('idx_trxd_transaksi').on(t.transaksiId),
    index('idx_trxd_kegiatan').on(t.kegiatanId),
    check('chk_trxd_qty', sql`${t.qty} > 0`),
    check('chk_trxd_harga', sql`${t.hargaSatuan} >= 0`),
  ],
)

export const ccTransaksiMasterRelations = relations(ccTransaksiMaster, ({ one, many }) => ({
  peserta: one(ccPeserta, { fields: [ccTransaksiMaster.pesertaId], references: [ccPeserta.id] }),
  user: one(ccUser, { fields: [ccTransaksiMaster.userId], references: [ccUser.id] }),
  detail: many(ccTransaksiDetail),
}))

export const ccTransaksiDetailRelations = relations(ccTransaksiDetail, ({ one }) => ({
  master: one(ccTransaksiMaster, {
    fields: [ccTransaksiDetail.transaksiId],
    references: [ccTransaksiMaster.id],
  }),
  kegiatan: one(ccKegiatan, {
    fields: [ccTransaksiDetail.kegiatanId],
    references: [ccKegiatan.id],
  }),
}))

export type DBTransaksiMaster = InferSelectModel<typeof ccTransaksiMaster>
export type DBTransaksiDetail = InferSelectModel<typeof ccTransaksiDetail>
