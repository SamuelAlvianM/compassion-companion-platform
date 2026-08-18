<script setup lang="ts">
// Daftar tulisan milik member sendiri.
//
// Bukan bagian dashboard: member tidak pernah masuk ke /admin. Ini halaman biasa
// di situs publik, hanya saja isinya miliknya sendiri.
//
// Yang TIDAK ada di sini, dan itu disengaja: nama editor yang menangani, dan
// status "disetujui". Bagi yang menulis, keadaan tulisannya cuma tiga — sedang
// digarap, sedang diperiksa orang, atau sudah terbit — dan siapa yang memeriksa
// bukan urusan yang membuatnya menulis lebih baik.

const route = useRoute()
const isEn = computed(() => route.path.startsWith('/en'))
const base = computed(() => (isEn.value ? '/en' : '/id'))

// Judul halaman dipasang SEBELUM `await` pertama. Komposabel yang butuh konteks
// komponen (useHead/useSeoMeta) kehilangan konteks itu begitu setup pernah
// tertahan sekali, dan halamannya jatuh dengan
// "useHead() was called without provide context".
//
// Judulnya ditulis langsung, tidak lewat `t` di bawah: `t` baru lahir setelah
// baris ini, dan memanggilnya di sini berarti membacanya sebelum ada.
useSeoMeta({
  title: () => (isEn.value ? 'My journal' : 'Jurnal saya'),
  robots: 'noindex',
})

const { user, muat: muatAuth } = useAuth()
await muatAuth()

// Halaman milik pribadi: tamu diantar ke login, membawa alamat tujuannya.
if (!user.value) {
  await navigateTo(`${base.value}/login?redirect=${encodeURIComponent(route.path)}`)
}

const bolehMenulis = computed(() => Boolean(user.value?.bolehTulisJurnal) || (user.value?.level ?? 9) <= 3)

const { data, status, refresh } = await useFetch('/api/jurnal-saya', {
  headers: import.meta.server ? useRequestHeaders(['cookie']) : undefined,
})

const daftar = computed(() => data.value?.data ?? [])
const memuat = computed(() => status.value === 'pending' && !data.value)

/** Label status untuk PENULIS — bukan label redaksi. "Direview" dan "disetujui"
    sama artinya baginya: sedang di tangan orang lain, tidak ada yang perlu
    dikerjakan. */
const LABEL: Record<string, { teks: string, warna: 'neutral' | 'warning' | 'secondary' | 'primary' }> = {
  draft: { teks: isEn.value ? 'Draft' : 'Draf', warna: 'neutral' },
  review: { teks: isEn.value ? 'Being reviewed' : 'Sedang diperiksa', warna: 'warning' },
  approved: { teks: isEn.value ? 'Being reviewed' : 'Sedang diperiksa', warna: 'warning' },
  revisi: { teks: isEn.value ? 'Needs revision' : 'Perlu direvisi', warna: 'secondary' },
  published: { teks: isEn.value ? 'Published' : 'Sudah terbit', warna: 'primary' },
}

const sibuk = ref(false)
const galat = ref('')

const tulisBaru = async () => {
  sibuk.value = true
  galat.value = ''
  try {
    const { data: baru } = await $fetch<{ data: any }>('/api/jurnal-saya', {
      method: 'POST',
      body: { judul: isEn.value ? 'Untitled' : 'Tanpa judul' },
    })
    await navigateTo(`${base.value}/jurnal-saya/${baru.id}`)
  }
  catch (e: any) {
    galat.value = e?.data?.statusMessage || e?.message || 'Gagal membuat tulisan baru.'
    sibuk.value = false
  }
}

const tanggal = (nilai: string | number | null) =>
  nilai
    ? new Intl.DateTimeFormat(isEn.value ? 'en-GB' : 'id-ID', {
        day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta',
      }).format(new Date(nilai))
    : '—'

const t = computed(() => isEn.value
  ? {
      eyebrow: 'My writing', judul: 'My journal',
      intro: 'Your own writing — drafts, pieces being reviewed, and what has been published.',
      tulis: 'Write a journal', kosong: 'You have not written anything yet.',
      tertutup: 'Writing access has not been opened for your account yet. Ask an admin if you would like to contribute.',
      diperbarui: 'Updated', buka: 'Open',
    }
  : {
      eyebrow: 'Tulisan saya', judul: 'Jurnal saya',
      intro: 'Tulisan Anda sendiri — draf, yang sedang diperiksa, dan yang sudah terbit.',
      tulis: 'Tulis jurnal', kosong: 'Anda belum menulis apa pun.',
      tertutup: 'Akses menulis belum dibuka untuk akun Anda. Hubungi admin bila ingin ikut menulis.',
      diperbarui: 'Diperbarui', buka: 'Buka',
    })

</script>

<template>
  <main class="event-page">
    <div class="container">
      <div class="page-head">
        <div class="eyebrow">{{ t.eyebrow }}</div>
        <h1>{{ t.judul }}</h1>
        <p>{{ t.intro }}</p>
      </div>

      <UAlert
        v-if="galat"
        class="mb-4"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :description="galat"
      />

      <!-- Tombolnya hanya digambar bila aksesnya memang dibuka. Yang tertutup
           membaca kalimat penjelas, bukan tombol yang menolak saat ditekan. -->
      <div class="mb-6">
        <UButton
          v-if="bolehMenulis"
          color="secondary"
          icon="i-lucide-pen-line"
          :loading="sibuk"
          @click="tulisBaru"
        >
          {{ t.tulis }}
        </UButton>

        <UAlert
          v-else
          color="neutral"
          variant="subtle"
          icon="i-lucide-lock"
          :description="t.tertutup"
        />
      </div>

      <div v-if="memuat" class="space-y-3" aria-hidden="true">
        <USkeleton v-for="n in 3" :key="n" class="h-16 w-full rounded-lg" />
      </div>

      <p v-else-if="!daftar.length" class="text-cc-stone-600">{{ t.kosong }}</p>

      <ul v-else class="space-y-3">
        <li
          v-for="j in daftar"
          :key="j.id"
          class="rounded-lg border border-cc-stone-200 bg-white p-4"
        >
          <NuxtLink
            :to="`${base}/jurnal-saya/${j.id}`"
            class="flex flex-wrap items-center justify-between gap-3"
          >
            <div class="min-w-0">
              <p class="font-serif text-xl break-words text-cc-green-800">{{ j.judul }}</p>
              <p class="mt-0.5 text-xs text-cc-stone-500">
                {{ t.diperbarui }} {{ tanggal(j.updatedAt) }}
              </p>
            </div>

            <div class="flex shrink-0 items-center gap-2">
              <UBadge :color="LABEL[j.status]?.warna ?? 'neutral'" variant="subtle" size="sm">
                {{ LABEL[j.status]?.teks ?? j.status }}
              </UBadge>
              <UIcon name="i-lucide-arrow-right" class="size-4 text-cc-stone-400" />
            </div>
          </NuxtLink>

          <!-- Catatan revisi ikut di daftar, bukan cuma di dalam halaman tulisnya:
               inilah satu-satunya baris yang menuntut tindakan, dan menyembunyikannya
               satu klik lebih dalam membuatnya terlewat. -->
          <p
            v-if="j.status === 'revisi' && j.catatanRevisi"
            class="mt-3 rounded-md bg-cc-stone-50 p-3 text-sm break-words text-cc-stone-700"
          >
            {{ j.catatanRevisi }}
          </p>
        </li>
      </ul>
    </div>
  </main>
</template>
