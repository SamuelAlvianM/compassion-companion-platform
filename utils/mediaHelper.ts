// utils/mediaHelper.ts
// Helper sisi klien, auto-import oleh Nuxt. Mengikuti app/utils/mediaHelper.ts di website-cosmos.

/** Buang awalan "/storage/" dari storageKey supaya bisa ditempel ke /api/storage/. */
export const cleanStorageKey = (key?: string | null) => {
  if (!key) return ''
  return key.trim().replace(/^(\/)?storage\//, '')
}

/** storageKey -> URL siap pakai untuk <img src> / <a href>. */
export const getStorageUrl = (key?: string | null) => {
  if (!key) return '/images/event-gallery-placeholder.webp' // fallback
  // Sudah berupa URL penuh atau path publik biasa — pakai apa adanya.
  if (/^https?:\/\//.test(key) || key.startsWith('/images/') || key.startsWith('/api/storage/')) {
    return key
  }
  return `/api/storage/${cleanStorageKey(key)}`
}

/** Ukuran file yang enak dibaca, mis. 1.4 MB */
export const formatFileSize = (bytes?: number | null) => {
  if (!bytes || bytes < 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / Math.pow(1024, i)
  return `${i === 0 ? value : value.toFixed(1)} ${units[i]}`
}

/**
 * Template sampul event — dipakai saat pengelola tidak mengunggah gambar apa pun.
 *
 * Berdiri sebagai konstanta bersama, bukan string yang ditulis ulang di tiap
 * halaman, karena kartu daftar event dan halaman detail HARUS menampilkan gambar
 * yang sama. Kalau alamatnya ditulis dua kali, satu di antaranya pasti tertinggal
 * saat berkasnya diganti — dan gejalanya bukan error, melainkan satu acara yang
 * punya dua wajah berbeda tergantung dari mana ia dibuka.
 *
 * Berkasnya 1600x900, rasio yang sama dengan yang dikunci saat mengunggah, jadi
 * event yang bergambar dan yang tidak menempati bingkai yang persis sama.
 * Sumbernya di assets/images/event-template.svg — sunting di sana lalu render ulang.
 */
export const TEMPLATE_EVENT = '/images/event-template.webp'
