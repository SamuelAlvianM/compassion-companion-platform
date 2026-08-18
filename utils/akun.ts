// utils/akun.ts
// Tetapan kecil seputar akun yang dipakai lebih dari satu layar.

import type { BadgeProps } from '@nuxt/ui'

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

/**
 * Warna badge untuk level role. Ditulis sekali di sini karena tiga layar
 * memakainya (dashboard, daftar member, petunjuk) dan salinan yang berbeda warna
 * berarti role yang sama tampil beda di dua halaman.
 *
 * Tipe kembaliannya diambil dari `BadgeProps` supaya nilainya benar-benar salah
 * satu warna yang dikenal Nuxt UI. Tanpa itu ia cuma `string`, dan `<UBadge>`
 * menolaknya — hurufnya bisa salah ketik tanpa ada yang memberitahu.
 */
export const warnaLevel = (level: number): BadgeProps['color'] =>
  ({ 1: 'error', 2: 'primary', 3: 'secondary', 4: 'neutral' } as const)[
    level as 1 | 2 | 3 | 4
  ] ?? 'neutral'
