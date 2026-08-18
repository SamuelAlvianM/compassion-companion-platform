// utils/akun.ts
// Tetapan kecil seputar akun yang dipakai lebih dari satu layar.

/**
 * Password bawaan untuk akun yang dibuatkan admin bagi peserta event.
 *
 * Disebut di dua tempat — modal "Proses" pada tab peserta (yang menyuruh admin
 * membuatkan akunnya) dan form Add Member yang mendarat dari tautan itu. Ditulis
 * sekali di sini supaya angka yang tertulis di layar tidak pernah berbeda dari
 * angka yang benar-benar terpasang.
 *
 * Enam karakter — persis batas minimum yang ditegakkan server.
 */
export const PASSWORD_PESERTA = '123456'
