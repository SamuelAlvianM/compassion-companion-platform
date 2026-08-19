// server/db/schema/users.ts
import { relations, type InferSelectModel } from 'drizzle-orm'
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'
import { generateCcId } from '../../utils/randomId'

/** SQLite tidak punya tipe enum; drizzle memetakan ini ke TEXT + union type di TS.
 *  Urutan array = urutan wewenang, dari yang paling tinggi. */
export const USER_ROLES = ['master', 'admin', 'editor', 'user'] as const
export type UserRole = (typeof USER_ROLES)[number]

/** Level wewenang: ANGKA KECIL = WEWENANG BESAR.
 *
 *  Dipakai untuk perbandingan `level <= n`, jadi satu pemeriksaan bisa mencakup
 *  "role ini ke atas" tanpa perlu mendaftar setiap role satu per satu.
 *
 *  Sengaja diturunkan dari role (bukan disimpan sebagai kolom) supaya tidak ada
 *  dua sumber kebenaran yang bisa berbeda isi. */
export const ROLE_LEVELS: Record<UserRole, 1 | 2 | 3 | 4> = {
  master: 1,
  admin: 2,
  editor: 3,
  user: 4,
}

export const ROLE_LABELS: Record<UserRole, string> = {
  master: 'Master',
  admin: 'Admin',
  editor: 'Editor',
  user: 'User',
}

/** Ringkasan tugas tiap role — dipakai di dashboard admin agar pembagian kerja terbaca. */
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  master: 'Akses penuh, termasuk mengelola akun dan menetapkan role.',
  admin: 'Pendataan operasional: event, pendaftar, peserta, dan transaksi.',
  editor: 'Memeriksa jurnal yang ditugaskan kepadanya: menyetujui, atau mengembalikan untuk revisi beserta catatannya.',
  user: 'Peserta: mendaftar event dan membuka materi yang menjadi haknya.',
}

export const levelOf = (role: UserRole) => ROLE_LEVELS[role]

/** True bila `role` setara atau lebih tinggi daripada `minimal`. */
export const hasAtLeast = (role: UserRole, minimal: UserRole) =>
  ROLE_LEVELS[role] <= ROLE_LEVELS[minimal]

export const ccUser = sqliteTable(
  'cc_user',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateCcId('ccu')),

    username: text('username', { length: 100 }).notNull().unique(),
    /** Selalu simpan hash, jangan plaintext. */
    password: text('password', { length: 255 }).notNull(),
    fullName: text('full_name', { length: 200 }).notNull(),
    email: text('email', { length: 255 }).unique(),
    role: text('role', { enum: USER_ROLES }).notNull().default('user'),
    phoneNumber: text('phone_number', { length: 20 }),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),

    /**
     * Izin menulis jurnal, diberikan admin per orang — bukan turunan role.
     *
     * Menulis jurnal bukan hal yang otomatis melekat pada semua member: yang boleh
     * menulis adalah mereka yang memang diminta atau mengajukan diri, dan admin
     * yang membukanya. Selama tertutup, tombol "Tulis jurnal" tidak digambar sama
     * sekali di halaman member — bukan digambar lalu ditolak saat diklik.
     *
     * Tidak berlaku bagi editor ke atas: wewenang mereka sudah datang dari role.
     */
    bolehTulisJurnal: integer('boleh_tulis_jurnal', { mode: 'boolean' }).notNull().default(false),

    /** FK dideklarasikan longgar (tanpa .references) untuk menghindari import melingkar dengan media. */
    avatarMediaId: text('avatar_media_id'),

    lastLogin: integer('last_login', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
  },
  (t) => [index('idx_user_role').on(t.role), index('idx_user_email').on(t.email)],
)

export const ccUserRelations = relations(ccUser, ({ many }) => ({
  pesertaEntries: many(ccPeserta),
  transaksi: many(ccTransaksiMaster),
}))

export type DBUser = InferSelectModel<typeof ccUser>
/** Bentuk aman untuk dikirim ke client — password tidak pernah ikut. */
export type SafeUser = Omit<DBUser, 'password'>

// Import di bawah untuk menghindari circular-import di runtime ESM.
import { ccPeserta } from './peserta'
import { ccTransaksiMaster } from './transaksi'
