<script setup lang="ts">
// Halaman baca satu jurnal.
//
// Menggantikan tiga halaman .vue yang isinya ditulis tangan
// (reflection-journey, sharing-mendengar-dengan-hadir, sharing-menata-kegelisahan).
// Tulisannya sudah dipindah ke database lewat server/db/seed-jurnal.ts, dan alamat
// lamanya dialihkan ke sini — lihat middleware/jurnal-lama.global.ts.

const route = useRoute()
const isEn = computed(() => route.path.startsWith('/en'))
const base = computed(() => (isEn.value ? '/en' : '/id'))
const slug = computed(() => String(route.params.slug))

// Sengaja TANPA `await`, sama seperti halaman detail event.
//
// Dengan await, <script setup> jadi async dan komponennya ditahan Suspense sampai
// fetch selesai. Digabung `pageTransition` mode 'out-in', halaman lama sudah keluar
// sementara yang baru belum boleh masuk — dan berpindah dari daftar jurnal ke satu
// tulisan berhenti menggambar apa pun: alamat dan judul tab berganti, isinya tidak
// pernah muncul. Isi halaman tetap ada di HTML hasil SSR; Nuxt menunggu data
// asinkronnya sebelum mengirim, tanpa perlu setup-nya ditahan.
//
// Aturan kedua yang ikut terjaga karenanya: `useSeoMeta` di bawah tidak lagi
// berdiri sesudah sebuah await, jadi konteks komponennya utuh.
const { data, status, error } = useFetch(() => `/api/jurnal/${slug.value}`)

const jurnal = computed(() => data.value?.data)

/** Judul & isi mengikuti bahasa halaman, dengan aslinya sebagai cadangan.
    Versi Inggris opsional: jurnal ditulis kontributor dalam satu bahasa, dan
    menunggu terjemahan berarti menunda tulisannya terbit. */
const judul = computed(() =>
  (isEn.value ? (jurnal.value?.judulEn ?? jurnal.value?.judul) : jurnal.value?.judul) ?? '')
const isi = computed(() =>
  (isEn.value ? (jurnal.value?.isiEn ?? jurnal.value?.isi) : jurnal.value?.isi) ?? '')
const ringkasan = computed(() =>
  (isEn.value ? (jurnal.value?.ringkasanEn ?? jurnal.value?.ringkasan) : jurnal.value?.ringkasan) ?? '')

const TIPE_LABEL: Record<string, string> = {
  'event-reflection': 'Event Reflection',
  'sharing-journey': 'Sharing Journey',
  insight: 'Insight',
  practice: 'Practice',
}

/** Baris kecil di atas judul: tipe, dan event yang direfleksikan bila ada. */
const eyebrow = computed(() => {
  const j = jurnal.value
  if (!j) return ''
  // Kategori boleh kosong di database (ditentukan admin sebelum terbit); di sini
  // ia praktis selalu ada, karena tanpa kategori tulisannya tidak bisa terbit.
  const tipe = j.tipe ? (TIPE_LABEL[j.tipe] ?? j.tipe) : ''
  const acara = j.kegiatan ? (isEn.value ? (j.kegiatan.judulEn ?? j.kegiatan.judul) : j.kegiatan.judul) : ''
  if (!tipe) return acara
  return acara ? `${tipe} · ${acara}` : tipe
})

const tanggal = computed(() => {
  const nilai = jurnal.value?.tanggal
  if (!nilai) return ''
  return new Intl.DateTimeFormat(isEn.value ? 'en-GB' : 'id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta',
  }).format(new Date(nilai))
})

/** Inisial untuk lingkaran kontributor — maksimal dua huruf, seperti kartu profil. */
const inisial = computed(() =>
  (jurnal.value?.kontributor ?? '?')
    .split(/\s+/)
    .slice(0, 2)
    .map(k => k.charAt(0).toUpperCase())
    .join(''))

useSeoMeta({
  title: () => judul.value,
  description: () => ringkasan.value,
})

// Jurnal yang tidak ada (atau belum terbit) dijawab 404 oleh endpoint. Dinaikkan
// jadi halaman 404 sungguhan, bukan halaman kosong berjudul kosong.
//
// Lewat `watch` dengan `immediate`, bukan pemeriksaan sekali jalan: tanpa await,
// galatnya baru tiba beberapa saat sesudah setup selesai.
watch(error, (e) => {
  if (!e) return
  showError(createError({
    statusCode: 404,
    statusMessage: isEn.value ? 'Journal not found' : 'Jurnal tidak ditemukan',
    fatal: true,
  }))
}, { immediate: true })

const t = computed(() => isEn.value
  ? { jurnal: 'Journal', detail: 'Detail', kontributor: 'Author', kembali: 'Back to journal', event: 'Read the event' }
  : { jurnal: 'Jurnal', detail: 'Detail', kontributor: 'Penulis', kembali: 'Kembali ke jurnal', event: 'Lihat eventnya' })
</script>

<template>
  <main class="event-page">
    <article class="container article">
      <div class="page-head">
        <nav class="breadcrumb">
          <NuxtLink :to="`${base}/jurnal`">{{ t.jurnal }}</NuxtLink><span>&rsaquo;</span><span>{{ t.detail }}</span>
        </nav>

        <template v-if="status === 'pending' && !jurnal">
          <USkeleton class="h-4 w-40" />
          <USkeleton class="mt-4 h-10 w-3/4" />
          <USkeleton class="mt-3 h-4 w-2/3" />
        </template>

        <template v-else>
          <div class="eyebrow">{{ eyebrow }}</div>
          <h1>{{ judul }}</h1>
          <p v-if="ringkasan">{{ ringkasan }}</p>
        </template>
      </div>

      <!-- Sampul hanya digambar bila memang ada. Kotak abu-abu bertuliskan "tanpa
           gambar" cuma menambah tinggi halaman sebelum kalimat pertama. -->
      <img
        v-if="jurnal?.coverUrl"
        :src="jurnal.coverUrl"
        :alt="judul"
        class="mb-6 max-h-[420px] w-full rounded-lg object-cover"
      >

      <section class="article-body panel">
        <div v-if="status === 'pending' && !jurnal" class="space-y-3" aria-hidden="true">
          <USkeleton v-for="n in 6" :key="n" class="h-4 w-full" />
        </div>

        <!-- `v-html` aman di sini karena isinya sudah disaring di server sebelum
             disimpan (server/utils/html.ts): daftar putih tag, skema tautan
             dibatasi, dan seluruh tautan keluar dipasangi rel="noopener". -->
        <div v-else-if="isi" v-html="isi" />

        <p v-else class="muted">
          {{ isEn ? 'This journal has no content yet.' : 'Jurnal ini belum memiliki isi.' }}
        </p>
      </section>

      <section v-if="jurnal" class="contributor panel">
        <div class="avatar">{{ inisial }}</div>
        <div>
          <div class="eyebrow">{{ t.kontributor }}</div>
          <h3>{{ jurnal.kontributor }}</h3>
          <p v-if="jurnal.kontributorPeran" class="muted">{{ jurnal.kontributorPeran }}</p>
          <p class="muted">
            <time :datetime="String(jurnal.tanggal ?? '')">{{ tanggal }}</time>
          </p>
        </div>
      </section>

      <div class="mt-8 flex flex-wrap gap-3">
        <UButton :to="`${base}/jurnal`" color="neutral" variant="subtle" icon="i-lucide-arrow-left">
          {{ t.kembali }}
        </UButton>
        <UButton
          v-if="jurnal?.kegiatan"
          :to="`${base}/events/${jurnal.kegiatan.slug}`"
          color="secondary"
          trailing-icon="i-lucide-arrow-right"
        >
          {{ t.event }}
        </UButton>
      </div>
    </article>
  </main>
</template>
