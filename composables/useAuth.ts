// composables/useAuth.ts
// Keadaan sesi di sisi klien.
//
// Memakai useState supaya hasil pemanggilan /api/auth/me dibagi ke seluruh komponen
// dan ikut terbawa dari server ke klien saat hidrasi — tanpa itu, setiap komponen
// yang butuh tahu "siapa yang login" akan memanggil endpoint yang sama berulang kali.

import type { UserRole } from '../server/db/schema/users'

export interface AuthUser {
  id: string
  username: string
  fullName: string
  email: string | null
  role: UserRole
  level: 1 | 2 | 3 | 4
}

export const useAuth = () => {
  const user = useState<AuthUser | null>('auth-user', () => null)
  const sudahDimuat = useState('auth-loaded', () => false)

  const muat = async (paksa = false) => {
    if (sudahDimuat.value && !paksa) return user.value
    // Saat SSR, $fetch tidak membawa cookie browser secara otomatis — tanpa
    // penerusan ini, pemeriksaan sesi di middleware selalu menganggap tamu.
    const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
    const { user: hasil } = await $fetch<{ user: AuthUser | null }>('/api/auth/me', { headers })
    user.value = hasil
    sudahDimuat.value = true
    return user.value
  }

  const masuk = async (username: string, password: string) => {
    const hasil = await $fetch<{ data: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: { username, password },
    })
    await muat(true)
    return hasil.data
  }

  const keluar = async () => {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
    sudahDimuat.value = true
  }

  return {
    user,
    sudahLogin: computed(() => user.value !== null),
    /** Level kecil = wewenang besar; `minimal` diberi sebagai level angka. */
    punyaLevel: (minimal: number) => (user.value?.level ?? 99) <= minimal,
    muat,
    masuk,
    keluar,
  }
}
