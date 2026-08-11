// server/utils/sesi.ts
// Helper untuk sesi kegiatan: embed YouTube dan hak akses materi terkunci.

import { and, eq, ne } from 'drizzle-orm'
import { db } from '../db'
import { ccPeserta, hasAtLeast } from '../db/schema'
import type { SessionUser } from './session'

/**
 * Ambil ID video dari segala bentuk URL YouTube yang lazim ditempel orang:
 * watch?v=, youtu.be/, /embed/, /shorts/, /live/.
 *
 * Video **unlisted** tidak butuh perlakuan khusus — ia tetap punya ID biasa dan
 * tetap bisa di-embed selama pemiliknya tidak mematikan izin embed. Yang tidak
 * bisa di-embed adalah video privat, dan itu memang tidak seharusnya dipakai.
 */
export const idYoutube = (url: string): string | null => {
  if (!url) return null
  try {
    const u = new URL(url.trim())
    const host = u.hostname.replace(/^www\./, '')

    if (host === 'youtu.be') return bersihkanId(u.pathname.slice(1))
    if (!host.endsWith('youtube.com') && !host.endsWith('youtube-nocookie.com')) return null

    const v = u.searchParams.get('v')
    if (v) return bersihkanId(v)

    const m = u.pathname.match(/^\/(embed|shorts|live|v)\/([^/?#]+)/)
    return m ? bersihkanId(m[2]) : null
  }
  catch {
    return null
  }
}

// ID YouTube selalu 11 karakter dari alfabet URL-safe. Memvalidasinya di sini
// mencegah potongan path acak ikut disuntikkan ke src iframe.
const bersihkanId = (raw: string) => {
  const id = raw.split(/[?&#]/)[0]
  return /^[\w-]{11}$/.test(id) ? id : null
}

/**
 * URL untuk <iframe>. Memakai domain nocookie supaya YouTube tidak menanam
 * cookie pelacak sebelum videonya benar-benar diputar.
 */
export const embedYoutube = (url: string): string | null => {
  const id = idYoutube(url)
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : null
}

/** Thumbnail statis; dipakai sebagai pratinjau sebelum iframe dimuat. */
export const thumbnailYoutube = (url: string): string | null => {
  const id = idYoutube(url)
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null
}

/**
 * Boleh membuka materi terkunci milik sebuah kegiatan?
 *
 * Dua jalan: peserta kegiatan itu sendiri (pendaftarannya belum dibatalkan), atau
 * pengelola level ≤ 3 (editor ke atas) yang memang mengurus materinya.
 *
 * Dicocokkan lewat email karena `cc_peserta` menyimpan snapshot email pendaftar
 * dan boleh berdiri tanpa `userId` — pendaftaran tamu tidak punya akun.
 */
export const bolehBukaMateri = async (
  user: SessionUser | null,
  kegiatanId: string,
): Promise<boolean> => {
  if (!user) return false
  if (hasAtLeast(user.role, 'editor')) return true
  if (!user.email) return false

  const baris = db
    .select({ id: ccPeserta.id })
    .from(ccPeserta)
    .where(and(
      eq(ccPeserta.kegiatanId, kegiatanId),
      eq(ccPeserta.email, user.email),
      ne(ccPeserta.status, 'batal'),
    ))
    .get()

  return Boolean(baris)
}
