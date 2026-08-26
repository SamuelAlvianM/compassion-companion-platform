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
 *
 * Sumbernya sekarang raster, bukan SVG: assets/images/event-template.webp
 * (1678x937, quality 95 — ilustrasi cat air dengan lambang di kiri-atas). Berkas
 * di public/ dirender ulang darinya dengan sharp:
 *
 *   sharp('assets/images/event-template.webp')
 *     .resize(1600, 900, { fit: 'cover', position: 'center' })
 *     .webp({ quality: 76, effort: 6 })
 *     .toFile('public/images/event-template.webp')   // ~27 KB
 *
 * Rasio 16:9-nya bukan hiasan: bingkai kartu daftar event dan sampul halaman
 * detail sama-sama 16:9 (main.css `.event-page .event-card .card-image` dan
 * `.event-overview>img`), jadi `cover` tidak membuang apa pun — lambang di
 * kiri-atas dan ranting di kanan ikut terbaca di kartu, bukan cuma di detail.
 */
export const TEMPLATE_EVENT = '/images/event-template.webp'

/**
 * Sampul statis untuk event yang lahir sebelum ada unggahan gambar. Gambarnya
 * benar-benar milik acara itu, jadi tetap didahulukan atas template yang generik.
 *
 * Peta ini dan `sampulEvent()` di bawahnya duduk di satu berkas karena alasan yang
 * sama dengan TEMPLATE_EVENT: sebelum ini petanya disalin di pages/events/index.vue
 * dan pages/events/[slug].vue, dan salinannya sudah sempat berbeda — hanya berkas
 * detail yang punya `compassion-in-practice`, sehingga acara itu tampil dengan
 * template di kartu dan dengan foto di halaman detailnya.
 */
const SAMPUL_STATIS: Record<string, string> = {
  'listening-as-leadership': '/images/listening-as-leadership.webp',
  'leadership-with-compassion': '/images/leadership-with-compassion.webp',
  'compassion-in-practice': '/images/listening-as-leadership.webp',
}

/** Sampul event: unggahan dari DB, lalu gambar statis milik event itu, lalu template. */
export const sampulEvent = (slug?: string | null, cover?: string | null) =>
  cover || SAMPUL_STATIS[slug ?? ''] || TEMPLATE_EVENT
