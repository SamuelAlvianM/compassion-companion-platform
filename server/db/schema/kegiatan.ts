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

    /**
     * Tanggal saja — jamnya ditaruh di `jamMulai`/`jamSelesai`, bukan digabung ke
     * timestamp ini. Alasannya fase: `faseKegiatan()` menganggap kegiatan
     * berlangsung sepanjang HARI tanggalMulai, dan itu justru yang diminta
     * ("kalau tanggal hari ini, ya berlangsung"). Kalau jam ikut masuk ke sini,
     * event jam 14.00 akan tercatat "mendatang" sepanjang pagi di hari-H.
     */
    tanggalMulai: integer('tanggal_mulai', { mode: 'timestamp' }).notNull(),
    tanggalSelesai: integer('tanggal_selesai', { mode: 'timestamp' }),

    /**
     * Jam acara, `HH:MM` 24 jam, menit kelipatan 5 (ditegakkan di validator).
     * Terutama berarti untuk event sehari, yang tanggal selesainya tidak menambah
     * informasi apa pun — jamnya yang menentukan orang bisa ikut atau tidak.
     *
     * Menggantikan kolom `waktu` yang berupa teks bebas ("09.00 – 16.30 WIB").
     * `waktu` sengaja TIDAK dihapus: ia masih memuat isi event lama dan dipakai
     * sebagai cadangan tampilan selama kedua jam ini masih kosong.
     */
    jamMulai: text('jam_mulai', { length: 5 }),
    jamSelesai: text('jam_selesai', { length: 5 }),

    /** Batas akhir pendaftaran — tanggal SEKALIGUS jam, jadi timestamp penuh. */
    tutupPendaftaran: integer('tutup_pendaftaran', { mode: 'timestamp' }),

    kuota: integer('kuota'),
    /** Harga dalam rupiah penuh (bukan sen). 0 = gratis. */
    harga: integer('harga').notNull().default(0),

    status: text('status', { enum: KEGIATAN_STATUS }).notNull().default('draft'),

    /** Gambar utama: sampul lebar di kepala halaman detail event. */
    coverMediaId: text('cover_media_id'),
    /**
     * Thumbnail: gambar kecil di kartu event.
     *
     * Kolom sendiri, bukan turunan `coverMediaId`, karena keduanya dipotong untuk
     * bingkai yang berbeda — sampul lebar dan kotak kartu. Memakai satu berkas
     * untuk keduanya berarti salah satu selalu terpotong di tempat yang salah,
     * biasanya tepat pada wajah orang. Kosong berarti kartunya jatuh kembali ke
     * gambar utama.
     */
    thumbnailMediaId: text('thumbnail_media_id'),

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
