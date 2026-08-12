<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const route = useRoute()
const names: Record<string, string> = {
  events: 'Kelola Event',
  members: 'Member',
  materials: 'Materi Pelatihan',
  insights: 'Artikel & Sharing',
}
const title = computed(() => names[String(route.params.section)] ?? 'Admin')
</script>

<template>
  <div class="mx-auto max-w-6xl">
    <div class="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="font-serif text-5xl text-cc-green-800">{{ title }}</h1>
      </div>
      <UButton color="secondary" size="lg" icon="i-lucide-plus" class="shrink-0">Tambah baru</UButton>
    </div>

    <UCard>
      <template #header>
        <h3 class="font-serif text-2xl text-cc-green-800">Tampilan POC</h3>
      </template>
      <p class="text-sm text-cc-stone-600">
        Pada tahap berikutnya, halaman ini akan mengelola data sebenarnya. Untuk sekarang, ia
        memperlihatkan struktur dan pengalaman kerja admin.
      </p>
      <div class="mt-5 rounded-lg bg-cc-green-800 p-6 text-cc-stone-50">
        <p class="text-xs font-bold uppercase tracking-[.16em] text-cc-brown-300">Contoh pengelolaan</p>
        <h2 class="mt-1 font-serif text-3xl">Semua konten terhubung dengan event.</h2>
        <p class="mt-2 text-sm opacity-90">
          Admin dapat menentukan materi publik, materi peserta, dokumentasi, dan terjemahan
          setiap konten.
        </p>
      </div>
    </UCard>
  </div>
</template>
