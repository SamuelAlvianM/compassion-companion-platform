// server/utils/password.ts
// Hashing password memakai scrypt bawaan node:crypto.
//
// Kenapa scrypt dan bukan bcrypt/argon2: keduanya paket native yang perlu dikompilasi
// saat install, sementara scrypt sudah ada di Node dan memang dirancang sebagai KDF
// untuk password (lambat + boros memori, jadi mahal untuk diserang brute force).
//
// Format simpan:  scrypt$N$r$p$<salt-hex>$<hash-hex>
// Parameternya ikut disimpan supaya password lama tetap bisa diverifikasi kalau
// suatu saat biayanya dinaikkan.

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>

const PARAMS = { N: 16384, r: 8, p: 1 }
const KEY_LENGTH = 64
const SALT_LENGTH = 16

export const hashPassword = async (plain: string) => {
  const salt = randomBytes(SALT_LENGTH)
  const derived = await scryptAsync(plain, salt, KEY_LENGTH, PARAMS)
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString('hex')}$${derived.toString('hex')}`
}

/** Verifikasi password. Mengembalikan false (bukan melempar) untuk hash yang rusak. */
export const verifyPassword = async (plain: string, stored: string) => {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false

  const [, N, r, p, saltHex, hashHex] = parts
  const expected = Buffer.from(hashHex!, 'hex')

  let derived: Buffer
  try {
    derived = await scryptAsync(plain, Buffer.from(saltHex!, 'hex'), expected.length, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
    })
  } catch {
    return false
  }

  // Perbandingan waktu-tetap: mencegah kebocoran informasi lewat selisih waktu respons.
  return derived.length === expected.length && timingSafeEqual(derived, expected)
}
