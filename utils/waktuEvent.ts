// utils/waktuEvent.ts
// Pemformat jam & batas pendaftaran, dipakai bersama kartu event, halaman detail,
// dan tabel admin.
//
// Ditaruh di `utils/` (auto-import Nuxt) supaya ketiganya memakai bentuk yang sama.
// Sebelum ini tiap halaman menyusun sendiri barisnya, dan itulah sebabnya kartu dan
// halaman detail sempat menampilkan tanggal dengan gaya berbeda.
//
// Semua tampilan waktu memakai zona **Asia/Jakarta** secara eksplisit. Tanpa itu,
// timestamp dibaca dalam zona mesin yang merender — dan sejak situs ini di-SSR di
// server yang berjalan UTC, tanggalnya akan mundur sehari bagi pembaca di Indonesia.

const TZ = 'Asia/Jakarta'

/** `HH:MM` → `HH.MM` (gaya penulisan jam Indonesia). */
const gayaJam = (jam: string) => jam.replace(':', '.')

/**
 * Baris jam sebuah event.
 *
 * `waktu` adalah kolom teks bebas lama ("09.00 – 16.30 WIB"); ia hanya dipakai
 * kalau kedua kolom jam masih kosong, yaitu untuk event yang dibuat sebelum
 * timepicker ada.
 */
export const rentangJam = (
  e: { jamMulai?: string | null, jamSelesai?: string | null, waktu?: string | null },
  isEn = false,
) => {
  if (e.jamMulai && e.jamSelesai) return `${gayaJam(e.jamMulai)} – ${gayaJam(e.jamSelesai)} WIB`
  if (e.jamMulai) return `${isEn ? 'From' : 'Mulai'} ${gayaJam(e.jamMulai)} WIB`
  return e.waktu ?? ''
}

/** "12 Agustus 2026" / "12 August 2026". */
export const tanggalPanjang = (nilai: string | Date | null, isEn = false) => {
  if (!nilai) return ''
  return new Intl.DateTimeFormat(isEn ? 'en-GB' : 'id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ,
  }).format(new Date(nilai))
}

/** "12 Agu 2026, 17.00" — untuk batas pendaftaran, yang jamnya ikut menentukan. */
export const tanggalJamSingkat = (nilai: string | Date | null, isEn = false) => {
  if (!nilai) return ''
  const tanggal = new Intl.DateTimeFormat(isEn ? 'en-GB' : 'id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ,
  }).format(new Date(nilai))
  const jam = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ,
  }).format(new Date(nilai))
  return `${tanggal}, ${gayaJam(jam)} WIB`
}

/** Sudah lewatkah batas pendaftarannya? */
export const batasLewat = (tutupPendaftaran: string | Date | null, sekarang = new Date()) =>
  Boolean(tutupPendaftaran) && new Date(tutupPendaftaran!).getTime() < sekarang.getTime()

/**
 * Kalimat pendek untuk kartu event.
 *
 * Sengaja membedakan "ditutup" dari "belum dibuka informasinya": event tanpa batas
 * pendaftaran tidak menampilkan baris ini sama sekali, bukan menampilkan "—".
 * Baris kosong lebih jujur daripada tanda hubung yang tampak seperti data hilang.
 */
export const labelBatasDaftar = (
  e: { tutupPendaftaran?: string | Date | null },
  isEn = false,
  sekarang = new Date(),
) => {
  if (!e.tutupPendaftaran) return ''
  if (batasLewat(e.tutupPendaftaran, sekarang)) {
    return isEn ? 'Registration closed' : 'Pendaftaran ditutup'
  }
  return `${isEn ? 'Register until' : 'Daftar s.d.'} ${tanggalJamSingkat(e.tutupPendaftaran, isEn)}`
}
