// server/utils/validasi-user.ts
// Pembacaan & validasi body untuk pembuatan dan pengubahan akun oleh pengelola.
//
// Akun di situs ini tidak pernah dibuat sendiri oleh pemakainya — semuanya
// didaftarkan admin, dan passwordnya disampaikan lewat WhatsApp. Karena itu
// tidak ada verifikasi email, tidak ada tautan aktivasi, dan `username`
// disusun dari email kalau tidak diisi: satu hal lebih sedikit yang harus
// diketik admin, sementara pemakainya tetap bisa masuk memakai emailnya.
//
// Sejak form member kehilangan kolom username, "tidak diisi" jadi keadaan yang
// normal, bukan kekecualian: yang dipakai **alamat email utuh**, bukan bagian
// depannya. Alasannya satu-satunya identitas yang diketahui pemilik akun adalah
// emailnya — kalau username diturunkan jadi `maria` dari `maria@…`, layar admin
// menampilkan nama yang tidak pernah diberitahukan kepada siapa pun.

import { and, eq, ne } from 'drizzle-orm'
import { db } from '../db'
import { ccUser, USER_ROLES, type UserRole } from '../db/schema'
import { slugify } from './randomId'

const teks = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const teksAtauNull = (v: unknown) => {
  const s = teks(v)
  return s === '' ? null : s
}

const salah = (pesan: string) => createError({ statusCode: 400, statusMessage: pesan })

export interface BodyUser {
  username: string
  fullName: string
  email: string | null
  phoneNumber: string | null
  role: UserRole
  isActive: boolean
}

/** Email diperiksa seadanya: ada @, ada titik sesudahnya, tanpa spasi. */
const emailWajar = (nilai: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nilai)

/**
 * Username unik. Bentrokan diselesaikan dengan akhiran angka, bukan ditolak —
 * dua orang bernama sama di satu paroki bukan hal aneh, dan menolak pendaftaran
 * karena itu memaksa admin mengarang nama yang tidak dipakai siapa pun.
 */
export const usernameUnik = (dasar: string, abaikanId?: string, apaAdanya = false) => {
  // `apaAdanya` melewati slugify: dipakai saat dasarnya alamat email, yang justru
  // akan kehilangan `@` dan titiknya kalau ikut dirapikan.
  const awal = (apaAdanya ? dasar.trim().toLowerCase() : slugify(dasar)) || 'user'
  let kandidat = awal
  for (let i = 2; i < 200; i++) {
    const ada = db
      .select({ id: ccUser.id })
      .from(ccUser)
      .where(abaikanId
        ? and(eq(ccUser.username, kandidat), ne(ccUser.id, abaikanId))
        : eq(ccUser.username, kandidat))
      .get()
    if (!ada) return kandidat
    kandidat = `${awal}${i}`
  }
  throw salah('Tidak bisa menyusun username unik dari nama itu')
}

export interface OpsiBacaUser {
  /** Baris yang sedang diubah, supaya keunikan tidak bentrok dengan dirinya sendiri. */
  abaikanId?: string
  /**
   * Username yang sekarang terpasang. Kalau diberikan dan body tidak menyebut
   * username, nilai ini dipakai apa adanya — TIDAK dijalankan ulang lewat
   * `usernameUnik`. Menjalankannya ulang berarti username yang sudah ada akan ikut
   * di-slugify tiap kali akun disimpan, dan orang yang login memakai username
   * bisa kehilangan cara masuknya hanya karena namanya diperbaiki ejaannya.
   */
  usernameSekarang?: string
}

export const bacaUser = (body: Record<string, unknown>, opsi: OpsiBacaUser = {}): BodyUser => {
  const { abaikanId, usernameSekarang } = opsi
  const fullName = teks(body.fullName)
  if (!fullName) throw salah('Nama lengkap wajib diisi')

  const email = teksAtauNull(body.email)?.toLowerCase() ?? null
  if (email && !emailWajar(email)) throw salah('Format email tidak dikenali')

  // Email dipakai untuk masuk (lihat /api/auth/login) dan untuk mencocokkan
  // pendaftaran tamu ke akun, jadi bentroknya harus ditolak — bukan diberi akhiran
  // angka seperti username.
  if (email) {
    const dipakai = db
      .select({ id: ccUser.id })
      .from(ccUser)
      .where(abaikanId ? and(eq(ccUser.email, email), ne(ccUser.id, abaikanId)) : eq(ccUser.email, email))
      .get()
    if (dipakai) throw salah('Email itu sudah dipakai akun lain')
  }

  const role = teks(body.role) || 'user'
  if (!USER_ROLES.includes(role as UserRole)) throw salah(`Role tidak dikenal: ${role}`)

  // Username bawaan = alamat email utuh; tanpa email, disusun dari namanya. Yang
  // dikirim eksplisit tetap menang, dan akun yang sudah ada mempertahankan
  // usernamenya (lihat OpsiBacaUser.usernameSekarang) — termasuk saat emailnya
  // diperbaiki, supaya tidak ada yang kehilangan cara masuknya di tengah jalan.
  const usernameDiminta = teks(body.username)
  const username = usernameDiminta
    ? usernameUnik(usernameDiminta, abaikanId)
    : usernameSekarang ?? (email
        ? usernameUnik(email, abaikanId, true)
        : usernameUnik(fullName, abaikanId))

  return {
    username,
    fullName,
    email,
    phoneNumber: teksAtauNull(body.phoneNumber),
    role: role as UserRole,
    isActive: body.isActive === undefined ? true : Boolean(body.isActive),
  }
}
