// server/db/schema/jurnal.ts
// Jurnal = tulisan redaksional yang dikurasi editor: refleksi event, sharing
// journey, insight, dan praktik.
//
// Dipisahkan dari `cc_refleksi` dan bukan sekadar "refleksi yang ditandai terbit".
// Alasannya alur, bukan bentuk data: refleksi ditulis peserta untuk dirinya sendiri
// dan visibilitasnya miliknya; jurnal melewati review dan menjadi suara komunitas
// di halaman publik. Satu refleksi bisa MENJADI jurnal (isinya disalin editor),
// tapi keduanya tidak pernah jadi baris yang sama — kalau digabung, menyunting
// jurnal berarti menyunting tulisan pribadi orang lain.

import { relations, sql, type InferSelectModel } from 'drizzle-orm'
import { sqliteTable, text, integer, index, check } from 'drizzle-orm/sqlite-core'
import { generateCcId } from '../../utils/randomId'
import { ccUser } from './users'
import { ccKegiatan } from './kegiatan'
import { ccMedia } from './media'

/** Empat tipe yang sudah dipakai halaman publik sejak versi statisnya. */
export const JURNAL_TIPE = ['event-reflection', 'sharing-journey', 'insight', 'practice'] as const
export type JurnalTipe = (typeof JURNAL_TIPE)[number]

/**
 * Alur persetujuan. Lima keadaan, dan tiap perpindahannya milik peran tertentu:
 *
 *   draft     -> masih dikerjakan penulisnya (admin atau member pemiliknya)
 *   review    -> dikirim untuk diperiksa; admin menugaskan editor yang mengurusnya
 *   revisi    -> dikembalikan editor beserta catatan, bola kembali ke PENULISNYA
 *   approved  -> editor menyatakan tulisannya siap; belum tampil di mana pun
 *   published -> diterbitkan admin, tampil di /jurnal
 *
 * Yang MEREVIEW editor, yang MENERBITKAN admin. Pembagian itu disengaja: editor
 * menjaga isinya, admin menjaga kapan komunitas ini bersuara.
 *
 * `revisi` bukan penolakan permanen melainkan giliran yang berpindah kembali ke
 * penulis. Tidak ada status "ditolak" — tulisan yang tidak jadi terbit tinggal
 * ditahan di draft, dan status akhir yang tidak bisa dilanjutkan cuma memaksa
 * orang menghapus barisnya.
 */
export const JURNAL_STATUS = ['draft', 'review', 'revisi', 'approved', 'published'] as const
export type JurnalStatus = (typeof JURNAL_STATUS)[number]

export const ccJurnal = sqliteTable(
  'cc_jurnal',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateCcId('ccj')),

    /** Alamat publiknya: /id/jurnal/{slug}. Unik, dan tidak ikut berubah saat
        judulnya disunting — tautan yang sudah dibagikan orang tidak boleh mati. */
    slug: text('slug', { length: 200 }).notNull().unique(),

    /**
     * Dwibahasa, tapi versi Inggrisnya OPSIONAL — berbeda dari kegiatan, yang
     * judulnya hampir selalu punya padanan. Jurnal ditulis kontributor dalam satu
     * bahasa; memaksa terjemahan berarti menunda terbitnya sampai ada yang sempat
     * menerjemahkan. Halaman /en menampilkan versi Inggris bila ada, kalau tidak
     * jatuh ke aslinya.
     */
    judul: text('judul', { length: 300 }).notNull(),
    judulEn: text('judul_en', { length: 300 }),

    /** Kutipan pembuka di kartu daftar. Bukan potongan otomatis dari isi: kalimat
        pertama sebuah refleksi sering berupa latar, bukan yang membuat orang mau
        membacanya. */
    ringkasan: text('ringkasan'),
    ringkasanEn: text('ringkasan_en'),

    /** Badan tulisan sebagai HTML dari editor (Tiptap). Selalu melewati
        `bersihkanHtml()` di server sebelum disimpan — lihat server/utils/html.ts.
        Yang tersimpan sudah aman digambar apa adanya. */
    isi: text('isi'),
    isiEn: text('isi_en'),

    /**
     * Kategori. BOLEH KOSONG, dan itu perubahan yang disengaja.
     *
     * Tulisan yang datang dari member lahir tanpa kategori — member hanya menulis
     * judul dan isinya; kategori ditentukan admin, karena ia yang tahu tulisan itu
     * duduk sebagai refleksi event, sharing journey, insight, atau praktik.
     * Kewajibannya ditegakkan di ambang TERBIT, bukan di kolomnya: memaksanya sejak
     * awal berarti member harus memilih istilah redaksional yang bukan urusannya.
     */
    tipe: text('tipe', { enum: JURNAL_TIPE }),
    status: text('status', { enum: JURNAL_STATUS }).notNull().default('draft'),

    /**
     * Editor yang ditugaskan mengurus tulisan ini, dipilih admin.
     *
     * Penulisnya tidak pernah diberi tahu siapa — yang ia lihat cuma "sedang
     * diperiksa" atau "perlu revisi". Itu menjaga percakapan revisi tetap tentang
     * tulisannya, bukan tentang siapa yang menilainya.
     *
     * Editor lain tetap bisa MELIHAT jurnal yang bukan tugasnya, tapi tidak
     * menyuntingnya (lihat server/utils/validasi-jurnal.ts).
     */
    editorId: text('editor_id').references(() => ccUser.id, { onDelete: 'set null' }),

    /**
     * Kontributor ditulis sebagai teks, bukan hanya sebagai relasi ke akun.
     *
     * Sebagian penulis bukan member — pembicara tamu, tim, atau orang yang menulis
     * sekali lalu tidak pernah membuka akun. `userId` diisi bila orangnya memang
     * punya akun (memberi tautan ke profilnya); namanya tetap disimpan supaya
     * tulisan tidak kehilangan penulis saat akun itu dihapus.
     */
    kontributor: text('kontributor', { length: 200 }).notNull(),
    kontributorPeran: text('kontributor_peran', { length: 200 }),
    userId: text('user_id').references(() => ccUser.id, { onDelete: 'set null' }),

    /** Event yang direfleksikan. Wajib secara praktis untuk tipe
        `event-reflection` (ditegakkan di validator, bukan di sini — tipenya bisa
        diubah di tengah penyuntingan dan constraint akan menolak keadaan sementara
        yang wajar). */
    kegiatanId: text('kegiatan_id').references(() => ccKegiatan.id, { onDelete: 'set null' }),

    /** Gambar sampul kartu & kepala artikel. */
    coverMediaId: text('cover_media_id').references(() => ccMedia.id, { onDelete: 'set null' }),

    /** Catatan admin saat mengembalikan tulisan ke `revisi`. Ditampilkan ke editor
        di kepala halaman sunting — status "perlu revisi" tanpa alasannya cuma
        memindahkan tulisan tanpa memberi tahu apa yang harus diperbaiki. */
    catatanRevisi: text('catatan_revisi'),

    /** Yang membuat barisnya. Berbeda dari `kontributor`: yang menulis di aplikasi
        belum tentu yang namanya tercantum sebagai penulis. */
    dibuatOleh: text('dibuat_oleh').references(() => ccUser.id, { onDelete: 'set null' }),

    /**
     * Kapan pertama kali terbit. Dipakai sebagai tanggal yang dibaca publik dan
     * urutan daftar — bukan `createdAt`, yang bisa jauh lebih awal kalau drafnya
     * mengendap berminggu-minggu. Tetap terisi kalau nanti ditarik kembali ke
     * draft: tanggal terbit pertamanya bukan sesuatu yang berubah.
     */
    diterbitkanPada: integer('diterbitkan_pada', { mode: 'timestamp' }),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    index('idx_jurnal_status').on(t.status),
    index('idx_jurnal_tipe').on(t.tipe),
    index('idx_jurnal_kegiatan').on(t.kegiatanId),
    // Daftar publik selalu diurut dari yang terbaru terbit.
    index('idx_jurnal_terbit').on(t.diterbitkanPada),
    check('chk_jurnal_judul', sql`length(trim(${t.judul})) > 0`),
    check('chk_jurnal_kontributor', sql`length(trim(${t.kontributor})) > 0`),
  ],
)

export const ccJurnalRelations = relations(ccJurnal, ({ one }) => ({
  penulis: one(ccUser, { fields: [ccJurnal.userId], references: [ccUser.id] }),
  kegiatan: one(ccKegiatan, { fields: [ccJurnal.kegiatanId], references: [ccKegiatan.id] }),
  cover: one(ccMedia, { fields: [ccJurnal.coverMediaId], references: [ccMedia.id] }),
}))

export type DBJurnal = InferSelectModel<typeof ccJurnal>

/** Label yang dibaca orang. Ditulis sekali di sini karena dipakai dashboard,
    daftar admin, dan halaman publik. */
export const JURNAL_STATUS_LABEL: Record<JurnalStatus, string> = {
  draft: 'Draft',
  review: 'Direview',
  revisi: 'Perlu revisi',
  approved: 'Disetujui',
  published: 'Terbit',
}

/**
 * Label yang dilihat PENULIS (member), bukan pengelola.
 *
 * Sengaja berbeda: "Direview" dan "Disetujui" adalah keadaan pekerjaan redaksi,
 * dan bagi pemilik tulisan keduanya sama saja artinya — sedang di tangan orang
 * lain, tidak ada yang perlu ia kerjakan. Yang benar-benar perlu ia bedakan cuma
 * "giliran saya" dan "sudah selesai".
 */
export const JURNAL_STATUS_LABEL_PENULIS: Record<JurnalStatus, string> = {
  draft: 'Draf',
  review: 'Sedang diperiksa',
  revisi: 'Perlu direvisi',
  approved: 'Sedang diperiksa',
  published: 'Sudah terbit',
}

export const JURNAL_TIPE_LABEL: Record<JurnalTipe, string> = {
  'event-reflection': 'Event Reflection',
  'sharing-journey': 'Sharing Journey',
  insight: 'Insight',
  practice: 'Practice',
}
