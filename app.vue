<script setup lang="ts">
// Metadata dasar untuk seluruh situs. Halaman boleh menimpanya lewat useSeoMeta
// sendiri; yang ada di sini berlaku sebagai nilai bawaan.
//
// Semua teks di sini dwibahasa, mengikuti aturan yang sama dengan template:
// locale ditentukan dari awalan path (/id atau /en).
const route = useRoute()
const url = useRequestURL()

const isEn = computed(() => route.path.startsWith('/en'))
const isAdmin = computed(() => route.path.startsWith('/admin'))

/** Path tanpa awalan locale, dipakai untuk menyusun tautan alternatif id/en. */
const barePath = computed(() => route.path.replace(/^\/(id|en)(?=\/|$)/, ''))
const absolute = (path: string) => new URL(path, url.origin).href

const site = computed(() =>
  isEn.value
    ? {
        title: 'Cultivating the Compassionate Companion',
        description:
          'A learning and accompaniment community forming leaders rooted in Ignatian spirituality and Cura Personalis — care for the whole person. Programs, practicums, and reflections for Church and lay leaders.',
      }
    : {
        title: 'Cultivating the Compassionate Companion',
        description:
          'Komunitas pembelajaran dan pendampingan yang mengembangkan kepemimpinan berakar pada Spiritualitas Ignasian dan Cura Personalis — kepedulian terhadap pribadi secara utuh. Program, practicum, dan refleksi bagi pemimpin Gereja dan awam.',
      },
)

const ogImage = absolute('/images/about-compassionate-companion.webp')

// Dibungkus computed supaya canonical & hreflang ikut berubah saat navigasi
// sisi klien — setup app.vue hanya berjalan sekali seumur aplikasi.
useHead(
  computed(() => ({
    htmlAttrs: { lang: isEn.value ? 'en-US' : 'id-ID' },
    titleTemplate: (title?: string) =>
      title ? `${title} · Compassionate Companion` : site.value.title,
    link: [
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      // Situs dwibahasa: mesin pencari perlu tahu kedua versi ada dan saling padan.
      // Area admin tidak diberi canonical/alternate karena memang tidak diindeks.
      ...(isAdmin.value
        ? []
        : [
            { rel: 'canonical', href: absolute(route.path) },
            { rel: 'alternate', hreflang: 'id-ID', href: absolute(`/id${barePath.value}`) },
            { rel: 'alternate', hreflang: 'en-US', href: absolute(`/en${barePath.value}`) },
            { rel: 'alternate', hreflang: 'x-default', href: absolute(`/id${barePath.value}`) },
          ]),
    ],
  })),
)

useSeoMeta({
  description: () => site.value.description,
  robots: () => (isAdmin.value ? 'noindex, nofollow' : 'index, follow'),
  ogSiteName: 'Compassionate Companion',
  ogType: 'website',
  ogLocale: () => (isEn.value ? 'en_US' : 'id_ID'),
  ogLocaleAlternate: () => (isEn.value ? 'id_ID' : 'en_US'),
  ogTitle: () => site.value.title,
  ogDescription: () => site.value.description,
  ogUrl: () => absolute(route.path),
  ogImage,
  twitterCard: 'summary_large_image',
  twitterTitle: () => site.value.title,
  twitterDescription: () => site.value.description,
  twitterImage: ogImage,
})
</script>

<template>
  <!-- <UApp> menyediakan konteks untuk tooltip, modal, dan toast Nuxt UI. Tanpa
       pembungkus ini, <UTooltip> melempar "Injection TooltipProviderContext not
       found" saat SSR — komponen overlay-nya butuh provider di akar aplikasi. -->
  <!-- Toast di KANAN ATAS, bukan bawaan kanan bawah. Di dashboard, kabar
       "tersimpan" datang dari isian yang sedang dipandang di bagian atas layar;
       muncul di sudut bawah, ia lewat di luar arah pandang dan tidak terbaca
       sebelum menghilang. -->
  <UApp :toaster="{ position: 'top-right' }">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
