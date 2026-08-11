// composables/useEditMode.ts
// Keadaan "sedang menyunting halaman" untuk pengelola level ≤ 3.
//
// Mode edit sengaja **tidak menyala sendiri**. Halaman publik adalah halaman yang
// dibaca pengunjung, dan pengelola paling sering membukanya untuk membaca juga —
// menyalakan kotak-kotak sunting di setiap kunjungan hanya menghalangi itu. Jadi
// ia dinyalakan lewat tombol, dan keadaannya disimpan di useState supaya bertahan
// saat berpindah antar halaman dalam satu sesi jelajah.

export const useEditMode = () => {
  const { user } = useAuth()

  const aktif = useState('edit-mode', () => false)

  /** Boleh menyunting isi halaman publik: master, admin, editor. */
  const bolehSunting = computed(() => (user.value?.level ?? 99) <= 3)

  // Kalau sesi hilang di tengah jalan (logout di tab lain, akun dinonaktifkan),
  // mode edit ikut padam — kotak sunting yang tertinggal cuma akan gagal menyimpan.
  watch(bolehSunting, (boleh) => { if (!boleh) aktif.value = false })

  return {
    aktif,
    bolehSunting,
    nyalakan: () => { if (bolehSunting.value) aktif.value = true },
    matikan: () => { aktif.value = false },
    alih: () => { if (bolehSunting.value) aktif.value = !aktif.value },
  }
}
