<script setup lang="ts">
const route = useRoute()
const isEn = computed(() => route.path.startsWith('/en'))
const switchPath = computed(() => isEn.value ? route.path.replace(/^\/en(?=\/|$)/, '/id') : route.path.replace(/^\/id(?=\/|$)/, '/en'))
const localized = (path: string) => `${isEn.value ? '/en' : '/id'}${path === '/' ? '' : path}`

const { user, muat, keluar } = useAuth()
await muat()

// Level <= 3 (master, admin, editor) punya pintu masuk ke area admin.
const bolehKeAdmin = computed(() => (user.value?.level ?? 99) <= 3)

// Dua kelompok: tujuan di atas, "keluar" dipisah di bawah. Menaruh keluar
// bersebelahan dengan menu biasa membuatnya mudah tertekan saat yang dituju
// sebenarnya profil.
const menuAkun = computed(() => [
  [
    // "Profil saya" hanya untuk peserta. Halaman itu menampilkan riwayat event
    // yang diikuti dan jurnal yang ditulisnya — dua hal yang tidak dimiliki akun
    // pengelola, sehingga yang tergambar baginya cuma kerangka kosong. Data
    // dirinya sendiri diurus di /admin/akun.
    ...(bolehKeAdmin.value
      ? [{ label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/admin' }]
      : [{ label: isEn.value ? 'My profile' : 'Profil saya', icon: 'i-lucide-user-round', to: localized('/profil') }]),
  ],
  [
    { label: isEn.value ? 'Sign out' : 'Keluar', icon: 'i-lucide-log-out', onSelect: async () => { await keluar(); await navigateTo(localized('/')) } },
  ],
])

/**
 * Tautan navigasi, ditulis sekali.
 *
 * Sebelumnya ketiganya ditulis langsung di dalam <nav class="links">, dan di layar
 * sempit seluruh <nav> itu di-`display:none` TANPA pengganti — bersama tombol
 * Masuk, yang juga disembunyikan CSS. Akibatnya di ponsel situs ini tidak punya
 * satu pun jalan ke Tentang, Event, Jurnal, atau halaman masuk: yang tersisa di
 * kepala halaman cuma logo dan pengalih bahasa.
 *
 * Sekarang daftarnya jadi data supaya bilah desktop dan laci ponsel membaca sumber
 * yang sama. Dua salinan tautan navigasi adalah cara salah satunya nanti tertinggal
 * saat menu keempat ditambahkan.
 */
const tautanNav = computed(() => [
  { to: `${localized('/')}#about`, label: isEn.value ? 'About' : 'Tentang' },
  { to: localized('/events'), label: isEn.value ? 'Events' : 'Event' },
  { to: localized('/jurnal'), label: isEn.value ? 'Journal' : 'Jurnal' },
])

const menuMobile = ref(false)

// Ditutup saat berpindah halaman. Tanpa ini laci tetap menutupi halaman yang
// barusan dituju — dan tautan "#about" bahkan tidak mengubah komponennya, jadi
// tidak ada apa pun yang menutupnya dengan sendirinya.
watch(() => route.fullPath, () => { menuMobile.value = false })

const keluarDariLaci = async () => {
  menuMobile.value = false
  await keluar()
  await navigateTo(localized('/'))
}
</script>
<template>
    <div>
        <header class="site-header">
            <div class="container nav">
                <NuxtLink :to="localized('/')" class="brand"><span class="mark">CC</span>Compassionate<br>Companion
                </NuxtLink>
                <nav class="links">
                    <NuxtLink v-for="t in tautanNav" :key="t.to" :to="t.to">{{ t.label }}</NuxtLink>
                </nav>
                <div class="nav-actions">
                    <NuxtLink class="lang" :to="switchPath">{{ isEn ? 'ID' : 'EN' }}</NuxtLink>

                    <UDropdownMenu v-if="user" :items="menuAkun">
                        <button class="btn" type="button">
                            <UIcon name="i-lucide-user-round" class="size-4" />
                            {{ user.fullName.split(' ')[0] }}
                        </button>
                    </UDropdownMenu>
                    <NuxtLink v-else class="btn" :to="localized('/login')">{{ isEn ? 'Login' : 'Masuk' }}</NuxtLink>

                    <!-- Tombol laci: hanya di layar sempit, tepat pada lebar yang
                         sama dengan tempat .links dan .btn disembunyikan CSS. -->
                    <UButton
                        class="nav-burger text-white hover:bg-white/10"
                        color="neutral"
                        variant="ghost"
                        icon="i-lucide-menu"
                        size="lg"
                        :aria-label="isEn ? 'Open menu' : 'Buka menu'"
                        @click="menuMobile = true"
                    />
                </div>
            </div>
        </header>

        <!-- Laci navigasi ponsel. Isinya SAMA dengan bilah desktop — tautan yang
             sama dari `tautanNav`, plus dua hal yang di layar lebar duduk di
             kanan: pengalih bahasa dan pintu masuk akun. -->
        <USlideover
            v-model:open="menuMobile"
            :title="isEn ? 'Menu' : 'Menu'"
            side="right"
        >
            <template #body>
                <nav class="flex flex-col gap-1" :aria-label="isEn ? 'Site menu' : 'Menu situs'">
                    <NuxtLink
                        v-for="t in tautanNav"
                        :key="t.to"
                        :to="t.to"
                        class="rounded-md px-3 py-3 text-base font-medium text-cc-green-800 hover:bg-cc-stone-100"
                        @click="menuMobile = false"
                    >
                        {{ t.label }}
                    </NuxtLink>
                </nav>

                <!-- Pengalih bahasa TIDAK diulang di sini. Ia tetap tergambar di
                     kepala halaman, tepat di kiri tombol menu, pada semua lebar
                     layar — jadi menyalinnya ke dalam laci berarti dua tombol untuk
                     satu tindakan, dan yang di laci justru lebih jauh dijangkau. -->
                <div class="mt-4 space-y-1 border-t border-cc-stone-200 pt-4">
                    <template v-if="user">
                        <NuxtLink
                            :to="bolehKeAdmin ? '/admin' : localized('/profil')"
                            class="flex items-center gap-3 rounded-md px-3 py-3 text-base font-medium text-cc-stone-700 hover:bg-cc-stone-100"
                            @click="menuMobile = false"
                        >
                            <UIcon
                                :name="bolehKeAdmin ? 'i-lucide-layout-dashboard' : 'i-lucide-user-round'"
                                class="size-[18px] shrink-0"
                            />
                            {{ bolehKeAdmin ? 'Dashboard' : (isEn ? 'My profile' : 'Profil saya') }}
                        </NuxtLink>
                        <button
                            type="button"
                            class="flex w-full items-center gap-3 rounded-md px-3 py-3 text-base font-medium text-cc-brown-600 hover:bg-cc-stone-100"
                            @click="keluarDariLaci"
                        >
                            <UIcon name="i-lucide-log-out" class="size-[18px] shrink-0" />
                            {{ isEn ? 'Sign out' : 'Keluar' }}
                        </button>
                    </template>

                    <NuxtLink
                        v-else
                        :to="localized('/login')"
                        class="flex items-center gap-3 rounded-md px-3 py-3 text-base font-medium text-cc-stone-700 hover:bg-cc-stone-100"
                        @click="menuMobile = false"
                    >
                        <UIcon name="i-lucide-log-in" class="size-[18px] shrink-0" />
                        {{ isEn ? 'Login' : 'Masuk' }}
                    </NuxtLink>
                </div>
            </template>
        </USlideover>

        <slot />
        <footer class="footer">
            <div class="container footer-contact">
                <NuxtLink :to="localized('/')" class="footer-brand">
                    <span class="mark">CC</span>
                    <span>Compassionate
                        Companion</span>
                    
                    </NuxtLink><a href="mailto:compassionate.journey@ignatianway.id">
                        <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
	<path d="M0 0h24v24H0z" fill="none" />
	<path fill="currentColor" d="M4 20q-.825 0-1.412-.587T2 18V6q0-.825.588-1.412T4 4h16q.825 0 1.413.588T22 6v12q0 .825-.587 1.413T20 20zm8-7L4 8v10h16V8zm0-2l8-5H4zM4 8V6v12z" />
</svg>

                    <span>compassionate.journey@ignatianway.id</span></a
                    ><a href="https://wa.me/6281234567890"
                    target="_blank"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
	<path d="M0 0h24v24H0z" fill="none" />
	<path fill="currentColor" d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2c-5.46 0-9.91 4.45-9.91 9.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21c5.46 0 9.91-4.45 9.91-9.91c0-2.65-1.03-5.14-2.9-7.01m-7.01 15.24c-1.48 0-2.93-.4-4.2-1.15l-.3-.18l-3.12.82l.83-3.04l-.2-.31a8.26 8.26 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24c2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c.02 4.54-3.68 8.23-8.22 8.23m4.52-6.16c-.25-.12-1.47-.72-1.69-.81c-.23-.08-.39-.12-.56.12c-.17.25-.64.81-.78.97c-.14.17-.29.19-.54.06c-.25-.12-1.05-.39-1.99-1.23c-.74-.66-1.23-1.47-1.38-1.72c-.14-.25-.02-.38.11-.51c.11-.11.25-.29.37-.43s.17-.25.25-.41c.08-.17.04-.31-.02-.43s-.56-1.34-.76-1.84c-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31c-.22.25-.86.85-.86 2.07s.89 2.4 1.01 2.56c.12.17 1.75 2.67 4.23 3.74c.59.26 1.05.41 1.41.52c.59.19 1.13.16 1.56.1c.48-.07 1.47-.6 1.67-1.18c.21-.58.21-1.07.14-1.18s-.22-.16-.47-.28" />
</svg>
 <span>+6281234567890</span></a>
                    <a
                    href="https://instagram.com/Compassionate-Companion" target="_blank">
                    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
	<path d="M0 0h24v24H0z" fill="none" />
	<path fill="currentColor" d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4zm9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8A1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5a5 5 0 0 1-5 5a5 5 0 0 1-5-5a5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3a3 3 0 0 0 3 3a3 3 0 0 0 3-3a3 3 0 0 0-3-3" />
</svg>
<span>@Compassionate-Companion</span></a>
            </div>
        </footer>
    </div>
</template>
