// utils/wajib.ts
// Penanda kolom wajib yang masih kosong.
//
// Satu berkas untuk seluruh dashboard — form event, member, jurnal, dan modal
// peserta memakainya. Kalau tiap form menulis penandanya sendiri, "belum diisi"
// akan punya tiga wajah berbeda dalam satu aplikasi, dan yang paling sering
// terjadi: sebagian form lupa punya penanda sama sekali, lalu tombol simpannya
// mati tanpa ada yang tahu kolom mana penyebabnya.
//
// Bentuk keluarannya sengaja `string | undefined`, bukan boolean: itu tepat bentuk
// yang diminta prop `error` milik UFormField, jadi pemakaiannya satu baris —
//
//   <UFormField label="Judul" required :error="belumDiisi(form.judul)">
//
// dan penandanya memakai bingkai merah bawaan Nuxt UI, bukan kelas buatan sendiri
// yang harus dijaga tetap seragam dengan sisa formulir.
//
// PENANDANYA BARU MENYALA SESUDAH TOMBOL SIMPAN DITEKAN, lewat argumen `aktif`
// yang tiap formulir isi dengan flag "sudah pernah dicoba simpan". Menyalakannya
// sejak awal berarti formulir kosong yang baru dibuka langsung merah di mana-mana —
// penanda yang muncul sebelum ada yang salah dilakukan berhenti dibaca sebagai
// penanda, dan yang benar-benar terlewat nanti tenggelam di antaranya.
//
// Konsekuensinya tombol simpan TIDAK boleh mati saat isian belum lengkap: kalau
// mati, tidak ada yang bisa ditekan untuk memunculkan penandanya. Ia tetap bisa
// ditekan, dan tekanan itu yang menunjukkan kolom mana yang kurang.

export const PESAN_WAJIB = 'Belum diisi'

/** Kosong menurut formulir: string kosong/spasi, null, undefined, larik kosong. */
export const kosongkah = (nilai: unknown): boolean => {
  if (nilai === null || nilai === undefined) return true
  if (typeof nilai === 'string') return nilai.trim() === ''
  if (Array.isArray(nilai)) return nilai.length === 0
  return false
}

/**
 * Pesan untuk `:error` UFormField — `undefined` bila sudah terisi.
 *
 * `aktif` untuk kolom yang wajibnya bersyarat, mis. password yang hanya wajib
 * pada akun baru: `belumDiisi(form.password, baru)`.
 */
export const belumDiisi = (nilai: unknown, aktif = true): string | undefined =>
  (aktif && kosongkah(nilai)) ? PESAN_WAJIB : undefined
