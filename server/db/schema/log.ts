// server/db/schema/log.ts
// Jejak kerja: siapa melakukan apa, pada apa, kapan.
//
// Ini BUKAN audit trail keamanan dan tidak berpura-pura jadi satu. Yang dicatat
// hanya perpindahan yang berarti bagi orang — jurnal dibuat, editornya ditugaskan,
// diminta revisi, disetujui, diterbitkan; event dibuat atau dicabut; member berubah
// role atau izinnya. Autosave, pembacaan, dan penyuntingan kata per kata tidak
// dicatat: kalau semuanya dicatat, yang tersisa cuma tumpukan yang tidak bisa
// dibaca siapa pun.
//
// Hanya MASTER yang bisa melihatnya (lihat server/api/admin/log/*). Admin dan
// editor tidak: catatan ini merekam pekerjaan mereka, dan yang direkam bukan
// pemegang rekamannya.
//
// Barisnya sengaja MENYIMPAN SALINAN nama pelaku dan judul objeknya, bukan hanya
// id-nya. Log yang isinya join ke tabel lain akan kehilangan artinya begitu jurnal
// atau akunnya dihapus — justru pada baris yang paling perlu dibaca ("siapa yang
// menghapus ini?"). Id-nya tetap disimpan untuk menyusun tautan selama objeknya
// masih ada.

import { sql, type InferSelectModel } from 'drizzle-orm'
import { sqliteTable, text, integer, index, check } from 'drizzle-orm/sqlite-core'
import { generateCcId } from '../../utils/randomId'

/** Tiga segmen yang diminta: pekerjaan redaksi, pekerjaan event, dan perubahan akun. */
export const LOG_SEGMEN = ['jurnal', 'event', 'member'] as const
export type LogSegmen = (typeof LOG_SEGMEN)[number]

/**
 * Aksi disimpan sebagai TEXT bebas, bukan enum kolom.
 *
 * Alasannya: daftarnya akan tumbuh tiap kali ada alur baru, dan enum di SQLite
 * berarti migrasi tiap penambahan — untuk tabel yang isinya cuma catatan, itu
 * biaya yang tidak sepadan. Yang menjaga konsistensinya konstanta di bawah:
 * seluruh kode memanggil `LOG_AKSI.jurnalTerbit`, tidak pernah mengetik stringnya.
 */
export const LOG_AKSI = {
  jurnalDibuat: 'jurnal.dibuat',
  jurnalEditorDitugaskan: 'jurnal.editor-ditugaskan',
  jurnalDiajukan: 'jurnal.diajukan-review',
  jurnalDitarikPenulis: 'jurnal.ditarik-ke-draft',
  jurnalRevisi: 'jurnal.diminta-revisi',
  jurnalDisetujui: 'jurnal.disetujui',
  jurnalTerbit: 'jurnal.diterbitkan',
  jurnalDicabut: 'jurnal.ditarik-dari-publik',
  jurnalDihapus: 'jurnal.dihapus',

  eventDibuat: 'event.dibuat',
  eventDiubah: 'event.diubah',
  eventStatus: 'event.status-berubah',
  eventDihapus: 'event.dihapus',

  memberDibuat: 'member.dibuat',
  memberRole: 'member.role-diubah',
  memberIzinJurnal: 'member.izin-jurnal-diubah',
  memberStatus: 'member.status-diubah',
  memberPassword: 'member.password-diatur-ulang',
  memberDaftarEvent: 'member.daftar-event',
} as const

export type LogAksi = (typeof LOG_AKSI)[keyof typeof LOG_AKSI]

/** Label yang dibaca orang di layar. Ditulis sekali di sini karena halaman log,
    dan nanti mungkin ekspornya, membaca daftar yang sama. */
export const LOG_AKSI_LABEL: Record<string, string> = {
  'jurnal.dibuat': 'Dibuat',
  'jurnal.editor-ditugaskan': 'Editor ditugaskan',
  'jurnal.diajukan-review': 'Diajukan untuk diperiksa',
  'jurnal.ditarik-ke-draft': 'Ditarik kembali ke draf',
  'jurnal.diminta-revisi': 'Diminta revisi',
  'jurnal.disetujui': 'Disetujui editor',
  'jurnal.diterbitkan': 'Diterbitkan',
  'jurnal.ditarik-dari-publik': 'Ditarik dari halaman publik',
  'jurnal.dihapus': 'Dihapus',

  'event.dibuat': 'Event dibuat',
  'event.diubah': 'Event disunting',
  'event.status-berubah': 'Status event berubah',
  'event.dihapus': 'Event dihapus',

  'member.dibuat': 'Akun dibuat',
  'member.role-diubah': 'Role diubah',
  'member.izin-jurnal-diubah': 'Izin menulis jurnal diubah',
  'member.status-diubah': 'Status akun diubah',
  'member.password-diatur-ulang': 'Password diatur ulang',
  'member.daftar-event': 'Mendaftar event',
}

export const ccLog = sqliteTable(
  'cc_log',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateCcId('ccl')),

    segmen: text('segmen', { enum: LOG_SEGMEN }).notNull(),
    aksi: text('aksi', { length: 60 }).notNull(),

    /** Objek yang dikenai tindakan. Tanpa FK dan tanpa cascade — dengan sengaja:
        baris "dihapus" harus tetap ada sesudah objeknya hilang. */
    objekId: text('objek_id', { length: 40 }),
    /** Salinan judul/nama saat kejadian, supaya lognya tetap terbaca. */
    objekLabel: text('objek_label', { length: 300 }),
    /** Alamat publiknya bila ada — dipakai menyusun tautan ke halaman terbit. */
    objekSlug: text('objek_slug', { length: 200 }),

    pelakuId: text('pelaku_id', { length: 40 }),
    pelakuNama: text('pelaku_nama', { length: 200 }),
    pelakuRole: text('pelaku_role', { length: 20 }),

    /** Keterangan tambahan yang hanya berarti untuk aksinya: nama editor yang
        ditugaskan, catatan revisi, role lama → role baru. */
    catatan: text('catatan'),

    /**
     * MILIDETIK, bukan detik — satu-satunya kolom waktu di skema ini yang begitu.
     *
     * `mode: 'timestamp'` menyimpan detik utuh, dan itu cukup di mana pun kecuali
     * di sini: dua langkah alur redaksi bisa terjadi dalam detik yang sama
     * ("setujui" lalu "terbitkan" beruntun), dan dua baris berstempel waktu
     * identik membuat ORDER BY tidak lagi punya dasar untuk mengurutkannya. Yang
     * terbaca lalu bisa berbunyi terbalik: disetujui SESUDAH diterbitkan.
     */
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index('idx_log_segmen').on(t.segmen),
    // Daftar selalu dibaca dari yang terbaru, dan pembersihan 7 hari memindai
    // kolom yang sama.
    index('idx_log_waktu').on(t.createdAt),
    index('idx_log_objek').on(t.objekId),
    check('chk_log_aksi', sql`length(trim(${t.aksi})) > 0`),
  ],
)

export type DBLog = InferSelectModel<typeof ccLog>

/** Berapa lama catatan disimpan. Lewat dari ini dibuang otomatis — lihat
    server/utils/log.ts. Angkanya di sini supaya halaman log bisa menyebutkannya
    ke master tanpa menulis ulang angka yang sama. */
export const LOG_SIMPAN_HARI = 7
