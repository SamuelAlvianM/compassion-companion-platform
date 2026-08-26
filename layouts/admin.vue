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

  // Pengaturan akun ada untuk SEMUA pengelola, termasuk editor. Ia mengurus data
  // dirinya sendiri, bukan pekerjaan redaksi — jadi ia ikut di kedua daftar.
  const akun = { to: '/admin/akun', label: 'Pengaturan akun', icon: 'i-lucide-user-cog' }

  if (level === 3) {
    return [
      { to: '/admin/jurnal', label: 'Jurnal', icon: 'i-lucide-notebook-pen' },
      akun,
    ]
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
    akun,
  ]
})

// Petunjuk berisi penjelasan role & wewenang — sifatnya rujukan, bukan menu kerja
// harian. Menunya sedang DISEMBUNYIKAN (lihat blok yang dikomentari di template);
// nilai ini sengaja dipertahankan supaya mengembalikannya cukup dengan membuka
// komentar itu, tanpa perlu menulis ulang syaratnya.
const bolehPetunjuk = computed(() => (user.value?.level ?? 99) <= 3)

const aktif = (to: string) => to === '/admin' ? route.path === '/admin' : route.path.startsWith(to)

/**
 * Menu di layar sempit: laci, bukan sidebar yang diciutkan.
 *
 * Sebelumnya sidebar diubah jadi bilah ikon horizontal lewat CSS. Dua hal salah
 * dengannya. Yang terlihat: itemnya berakhir 24x18px — `box-sizing: border-box`
 * membuat padding 12px kiri-kanan memakan habis lebar track `max-content`, dan
 * ikon 18px-nya tergencet jadi nol. Yang lebih mendasar: bilah itu MEMBUANG
 * labelnya, jadi seandainya pun tergambar benar, yang tersisa enam ikon tanpa
 * nama — dan "Member" versus "Pengaturan akun" bukan pasangan yang bisa ditebak
 * dari gambar.
 *
 * Laci menyimpan labelnya. Ia juga tidak memakan tinggi layar saat tertutup, yang
 * penting di halaman admin: isinya tabel dan formulir panjang, dan setiap piksel
 * yang dipakai navigasi permanen adalah piksel yang tidak dipakai pekerjaannya.
 */
const menuMobile = ref(false)

// Ditutup begitu berpindah halaman. Laci yang tetap terbuka di atas halaman baru
// menutupi hal yang barusan diminta orangnya.
watch(() => route.path, () => { menuMobile.value = false })

const logout = async () => {
  menuMobile.value = false
  await keluar()
  await navigateTo('/id/login')
}
</script>

<template>
  <div class="admin-shell" :class="dilipat ? 'is-collapsed' : ''">
    <!-- Bilah atas khusus layar sempit. Sidebar di sebelah disembunyikan CSS pada
         lebar yang sama (lihat blok .admin-shell di main.css), jadi hanya satu dari
         keduanya yang pernah tergambar. -->
    <div class="admin-topbar md:hidden">
      <NuxtLink to="/id" class="brand !mb-0 !text-[17px]">
        <span class="mark !size-8 !text-sm">CC</span>Compassionate<br>Companion
      </NuxtLink>

      <UButton
        color="neutral"
        variant="ghost"
        icon="i-lucide-menu"
        size="lg"
        aria-label="Buka menu admin"
        class="text-white hover:bg-white/10"
        @click="menuMobile = true"
      />
    </div>

    <!-- Laci menu. `title` diisi supaya pembaca layar mengumumkan apa yang terbuka;
         tanpa itu ia cuma "dialog". -->
    <USlideover
      v-model:open="menuMobile"
      title="Menu admin"
      :description="user?.fullName ?? undefined"
      side="left"
    >
      <template #body>
        <nav class="flex flex-col gap-1" aria-label="Menu admin">
          <NuxtLink
            v-for="item in menu"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-cc-stone-700 hover:bg-cc-stone-100"
            :class="aktif(item.to) ? 'bg-cc-green-50 text-cc-green-800' : ''"
          >
            <UIcon :name="item.icon" class="size-[18px] shrink-0" />
            {{ item.label }}
          </NuxtLink>
        </nav>

        <div class="mt-4 border-t border-cc-stone-200 pt-4">
          <button
            type="button"
            class="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-cc-brown-600 hover:bg-cc-stone-100"
            @click="logout"
          >
            <UIcon name="i-lucide-log-out" class="size-[18px] shrink-0" />
            Keluar
          </button>

          <p v-if="user" class="px-3 pt-3 text-xs text-cc-stone-500">
            <span class="block font-semibold text-cc-stone-700">{{ user.fullName }}</span>
            {{ user.role }}<template v-if="user.role === 'master'"> · level {{ user.level }}</template>
          </p>
        </div>
      </template>
    </USlideover>

    <aside class="admin-side">
      <!-- Logo menuju HALAMAN UTAMA situs, bukan dashboard. Itu yang biasa
           dilakukan logo di mana pun, dan sejak "Kembali ke beranda" dicabut dari
           kaki sidebar, inilah satu-satunya jalan pulang dari area admin. -->
      <NuxtLink v-if="!dilipat" to="/id" class="brand !mb-0">
        <span class="mark">CC</span>Compassionate<br>Companion
      </NuxtLink>
      <NuxtLink v-else to="/id" class="mark mx-auto shrink-0" aria-label="Halaman utama">CC</NuxtLink>


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
        <!-- "Kembali ke beranda" dicabut atas permintaan; jalannya pindah ke
             logo di kepala sidebar. -->

        <!-- Petunjuk DISEMBUNYIKAN sementara, atas permintaan. Halamannya sendiri
             tetap hidup di /admin/petunjuk dan tetap bisa dibuka lewat alamat
             langsung; yang dicabut cuma jalannya dari sidebar. `bolehPetunjuk` di
             <script> sengaja dibiarkan supaya blok ini bisa dikembalikan dengan
             menghapus dua baris komentar ini saja.
        <NuxtLink
          v-if="bolehPetunjuk"
          to="/admin/petunjuk"
          :class="['admin-menu-item', aktif('/admin/petunjuk') ? 'is-active' : '']"
          :title="dilipat ? 'Petunjuk' : undefined"
        >
          <UIcon name="i-lucide-book-open" class="size-[18px] shrink-0" />
          <span v-if="!dilipat">Petunjuk</span>
        </NuxtLink>
        -->

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
