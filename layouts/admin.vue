<script setup lang="ts">
const { user, keluar } = useAuth()
const route = useRoute()

// Keadaan lipat disimpan di cookie, bukan ref biasa: kalau hanya di memori, sidebar
// akan kembali terbuka setiap pindah halaman karena layout ikut dirender ulang.
const dilipat = useCookie<boolean>('cc-admin-sidebar-collapsed', { default: () => false })

/**
 * Menu kerja. Kembali jadi computed karena sekarang memang bergantung role:
 * seorang EDITOR hanya mengurus jurnal. Member, event, dan dashboard bukan
 * pekerjaannya, dan menu yang mengarah ke sana cuma menawarkan halaman yang akan
 * menolaknya.
 *
 * Menu "Statistik" dicabut atas permintaan. Halamannya sendiri masih hidup di
 * /admin/statistik dan bisa dibuka lewat alamat langsung; yang hilang cuma
 * jalannya dari sidebar.
 */
const menu = computed(() => {
  const level = user.value?.level ?? 99

  if (level === 3) {
    return [{ to: '/admin/jurnal', label: 'Jurnal', icon: 'i-lucide-notebook-pen' }]
  }

  // Log kerja hanya untuk master (level 1). Catatan itu merekam pekerjaan admin
  // dan editor, jadi menunya tidak digambar untuk mereka — dan halamannya juga
  // ditolak middleware, karena menu yang tidak digambar bukan penjaga.
  const log = level === 1
    ? [{ to: '/admin/log', label: 'Log kerja', icon: 'i-lucide-history' }]
    : []

  return [
    { to: '/admin', label: 'Dashboard', icon: 'i-lucide-layout-dashboard' },
    // Pendaftar tidak lagi jadi menu sendiri: satu pendaftaran selalu milik satu
    // event, jadi tempatnya di tab "Daftar peserta" pada event itu. Daftar lintas
    // event tanpa konteksnya tidak bisa ditindaklanjuti admin.
    { to: '/admin/members', label: 'Member', icon: 'i-lucide-users' },
    { to: '/admin/events', label: 'Event', icon: 'i-lucide-calendar-days' },
    { to: '/admin/jurnal', label: 'Jurnal', icon: 'i-lucide-notebook-pen' },
    // Contributors disembunyikan dulu — halamannya masih array literal di dalam
    // .vue dan belum menyentuh database sama sekali, jadi menu yang mengarah ke
    // sana hanya menjanjikan sesuatu yang belum ada. Halamannya sendiri tetap
    // hidup di /admin/contributors; kembalikan baris ini kalau sudah tersambung.
    // { to: '/admin/contributors', label: 'Contributors', icon: 'i-lucide-pen-line' },
    ...log,
  ]
})

// Petunjuk berisi penjelasan role & wewenang. Diletakkan di bagian bawah bersama
// "kembali ke beranda" dan "keluar" — sifatnya rujukan, bukan menu kerja harian.
// Master melihat rekap datanya langsung di dashboard; admin & editor hanya di sini.
const bolehPetunjuk = computed(() => (user.value?.level ?? 99) <= 3)

const aktif = (to: string) => to === '/admin' ? route.path === '/admin' : route.path.startsWith(to)

const logout = async () => {
  await keluar()
  await navigateTo('/id/login')
}
</script>

<template>
  <div class="admin-shell" :class="dilipat ? 'is-collapsed' : ''">
    <aside class="admin-side">
      <NuxtLink v-if="!dilipat" to="/admin" class="brand !mb-0">
        <span class="mark">CC</span>Compassionate<br>Companion
      </NuxtLink>
      <NuxtLink v-else to="/admin" class="mark mx-auto shrink-0" aria-label="Dashboard">CC</NuxtLink>


      <nav class="admin-menu" :aria-label="'Menu admin'">
        <NuxtLink
          v-for="item in menu"
          :key="item.to"
          :to="item.to"
          :class="['admin-menu-item', aktif(item.to) ? 'is-active' : '']"
          :title="dilipat ? item.label : undefined"
        >
          <UIcon :name="item.icon" class="size-[18px] shrink-0" />
          <span v-if="!dilipat">{{ item.label }}</span>
        </NuxtLink>
      </nav>

      <div class="admin-side-footer">
        <NuxtLink to="/id" class="admin-menu-item" :title="dilipat ? 'Kembali ke beranda' : undefined">
          <UIcon name="i-lucide-home" class="size-[18px] shrink-0" />
          <span v-if="!dilipat">Kembali ke beranda</span>
        </NuxtLink>

        <NuxtLink
          v-if="bolehPetunjuk"
          to="/admin/petunjuk"
          :class="['admin-menu-item', aktif('/admin/petunjuk') ? 'is-active' : '']"
          :title="dilipat ? 'Petunjuk' : undefined"
        >
          <UIcon name="i-lucide-book-open" class="size-[18px] shrink-0" />
          <span v-if="!dilipat">Petunjuk</span>
        </NuxtLink>

        <button type="button" class="admin-menu-item is-logout" :title="dilipat ? 'Keluar' : undefined" @click="logout">
          <UIcon name="i-lucide-log-out" class="size-[18px] shrink-0" />
          <span v-if="!dilipat">Keluar</span>
        </button>

        <div v-if="!dilipat && user" class="admin-side-user">
          <p class="break-words font-semibold">{{ user.fullName }}</p>
          <!-- Angka levelnya hanya untuk master. Bagi admin dan editor ia nomor
               tanpa rujukan: tidak ada layar lain yang menyebutkannya, dan yang
               benar-benar menentukan apa yang bisa dikerjakan adalah nama rolenya —
               yang sudah tertulis di sebelahnya. -->
          <p class="break-words opacity-70">
            {{ user.role }}<template v-if="user.role === 'master'"> · level {{ user.level }}</template>
          </p>
        </div>
      </div>
    </aside>

    <!-- Tombol lipat sengaja berada DI LUAR <aside>, sebagai anak langsung .admin-shell.
         Sidebar punya overflow-y:auto, dan itu ikut memotong apa pun yang keluar ke
         samping — versi sebelumnya yang ditaruh di dalam aside jadi terpotong separuh.
         Posisinya mengikuti lebar sidebar (254px / 76px) supaya selalu duduk pas di
         garis batas antara sidebar dan konten. -->
    <button
      type="button"
      class="sidebar-toggle"
      :aria-label="dilipat ? 'Buka sidebar' : 'Lipat sidebar'"
      :aria-expanded="!dilipat"
      @click="dilipat = !dilipat"
    >
      <UIcon :name="dilipat ? 'i-lucide-chevron-right' : 'i-lucide-chevron-left'" class="size-4" />
    </button>

    <main class="admin-main">
      <slot />
    </main>
  </div>
</template>
