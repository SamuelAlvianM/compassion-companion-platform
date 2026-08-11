// server/db/schema/kegiatan.ts
// Kegiatan = event/program yang bisa didaftari peserta (mis. "Leadership with Compassion").
import { relations, sql, type InferSelectModel } from 'drizzle-orm'
import { sqliteTable, text, integer, index, check } from 'drizzle-orm/sqlite-core'
import { generateCcId } from '../../utils/randomId'

export const KEGIATAN_STATUS = ['draft', 'terbit', 'selesai', 'batal'] as const
export type KegiatanStatus = (typeof KEGIATAN_STATUS)[number]

export const ccKegiatan = sqliteTable(
  'cc_kegiatan',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateCcId('cck')),

    slug: text('slug', { length: 200 }).notNull().unique(),

    /** Konten dwibahasa mengikuti pola i18n situs (/id dan /en). */
    judul: text('judul', { length: 300 }).notNull(),
    judulEn: text('judul_en', { length: 300 }),
    deskripsi: text('deskripsi'),
    deskripsiEn: text('deskripsi_en'),

    lokasi: text('lokasi', { length: 300 }),

    /** Jam acara sebagai teks, mis. "09.00 – 16.30 WIB". Sengaja teks, bukan
        timestamp: banyak acara berupa rangkaian sesi dengan jeda, dan menyimpannya
        sebagai waktu tunggal justru memaksa penyederhanaan yang keliru. */
    waktu: text('waktu', { length: 120 }),

    /** Ajakan panjang di halaman detail — judul + badannya, dwibahasa. */
    ajakan: text('ajakan', { length: 300 }),
    ajakanEn: text('ajakan_en', { length: 300 }),
    ajakanIsi: text('ajakan_isi'),
    ajakanIsiEn: text('ajakan_isi_en'),

    /** Testimoni peserta: [{ nama, teks }]. JSON karena jumlahnya bebas dan tidak
        pernah dicari, disaring, atau dihubungkan ke tabel lain — tabel sendiri
        hanya menambah join tanpa menambah kemampuan. */
    testimoni: text('testimoni', { mode: 'json' }).$type<{ nama: string, teks: string }[]>(),
    /** Tempat daring, mis. link Zoom. Kosong berarti kegiatan luring. */
    tautanDaring: text('tautan_daring', { length: 500 }),

    /** Disimpan sebagai unix timestamp; dipasangkan dengan UI date + time picker. */
    tanggalMulai: integer('tanggal_mulai', { mode: 'timestamp' }).notNull(),
    tanggalSelesai: integer('tanggal_selesai', { mode: 'timestamp' }),
    /** Batas akhir pendaftaran */
    tutupPendaftaran: integer('tutup_pendaftaran', { mode: 'timestamp' }),

    kuota: integer('kuota'),
    /** Harga dalam rupiah penuh (bukan sen). 0 = gratis. */
    harga: integer('harga').notNull().default(0),

    status: text('status', { enum: KEGIATAN_STATUS }).notNull().default('draft'),

    coverMediaId: text('cover_media_id'),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    index('idx_kegiatan_status').on(t.status),
    index('idx_kegiatan_tanggal_mulai').on(t.tanggalMulai),
    check('chk_kegiatan_harga', sql`${t.harga} >= 0`),
    check('chk_kegiatan_kuota', sql`${t.kuota} IS NULL OR ${t.kuota} > 0`),
  ],
)

export const ccKegiatanRelations = relations(ccKegiatan, ({ many }) => ({
  peserta: many(ccPeserta),
  detailTransaksi: many(ccTransaksiDetail),
}))

export type DBKegiatan = InferSelectModel<typeof ccKegiatan>

import { ccPeserta } from './peserta'
import { ccTransaksiDetail } from './transaksi'
