<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const type = ref('all')
const query = ref('')
const order = ref<'newest' | 'oldest'>('newest')

const typeOptions = [
  { value: 'all', label: 'Semua Tipe' },
  { value: 'Event Reflection', label: 'Event Reflection' },
  { value: 'Sharing Journey', label: 'Sharing Journey' },
  { value: 'Insight', label: 'Insight' },
  { value: 'Practice', label: 'Practice' },
]

const orderOptions = [
  { value: 'newest', label: 'Terbaru' },
  { value: 'oldest', label: 'Terlama' },
]

const journals = [
  { id: 'menemukan-arah', title: 'Menemukan Arah dalam Kebersamaan', status: 'Published', type: 'Sharing Journey', contributor: 'Imanuel Ananta', created: '31 Mar 2026', updated: '12 Mei 2026', date: '2026-05-12' },
  { id: 'belajar-mendengarkan', title: 'Ketika Saya Belajar Mendengarkan', status: 'Published', type: 'Event Reflection', contributor: 'Nicholas', created: '1 Mei 2026', updated: '1 Mei 2026', date: '2026-05-01' },
  { id: 'membawa-kegelisahan', title: 'Membawa Kegelisahan kepada Tuhan', status: 'Published', type: 'Event Reflection', contributor: 'Anna', created: '20 Apr 2026', updated: '20 Apr 2026', date: '2026-04-20' },
  { id: 'kehadiran-membuka-ruang', title: 'Kehadiran yang Membuka Ruang', status: 'Published', type: 'Insight', contributor: 'Henk T. Sengkey', created: '8 Apr 2026', updated: '8 Apr 2026', date: '2026-04-08' },
  { id: 'tiga-menit', title: 'Tiga Menit untuk Mendengarkan Diri', status: 'Published', type: 'Practice', contributor: 'Tim Compassionate Companion', created: '28 Mar 2026', updated: '28 Mar 2026', date: '2026-03-28' },
  { id: 'mendampingi-lansia', title: 'Tips Mendampingi Lansia yang Susah Diatur', status: 'Draft', type: 'Practice', contributor: 'Maria', created: '21 Mar 2026', updated: '21 Mar 2026', date: '2026-03-21' },
]

const visibleJournals = computed(() => {
  const keyword = query.value.toLowerCase().trim()
  return journals
    .filter(journal => type.value === 'all' || journal.type === type.value)
    .filter(journal => !keyword || `${journal.title} ${journal.contributor}`.toLowerCase().includes(keyword))
    .sort((a, b) => order.value === 'newest' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date))
})

const columns = [
  { accessorKey: 'title', header: 'Judul' },
  { accessorKey: 'type', header: 'Tipe Jurnal' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'contributor', header: 'Kontributor' },
  { accessorKey: 'created', header: 'Tgl Dibuat' },
  { accessorKey: 'updated', header: 'Tgl Diperbarui' },
]
</script>

<template>
  <div class="mx-auto max-w-6xl">
    <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="font-serif text-5xl text-cc-green-800">Jurnal</h1>
        <p class="mt-2 max-w-3xl text-sm text-cc-stone-600">
          Kelola cerita peserta, sharing pengalaman, sharing pengetahuan, dan praktik baik
          dari perjalanan spiritual kepemimpinan.
        </p>
      </div>
      <UButton to="/admin/jurnal/new" color="secondary" size="lg" icon="i-lucide-plus" class="shrink-0">
        Add Jurnal
      </UButton>
    </div>

    <div class="mb-6 grid gap-3 rounded-lg border border-cc-green-800 bg-cc-stone-50 p-3 sm:grid-cols-[220px_1fr_200px]">
      <UFormField label="Tipe Jurnal" size="sm">
        <USelect v-model="type" :items="typeOptions" class="w-full" />
      </UFormField>
      <UFormField label="Cari" size="sm">
        <UInput v-model="query" icon="i-lucide-search" placeholder="Cari judul atau kontributor" class="w-full" />
      </UFormField>
      <UFormField label="Urutkan" size="sm">
        <USelect v-model="order" :items="orderOptions" class="w-full" />
      </UFormField>
    </div>

    <UCard :ui="{ body: 'p-0' }">
      <UTable :data="visibleJournals" :columns="columns" empty="Tidak ada jurnal yang cocok.">
        <template #title-cell="{ row }">
          <NuxtLink
            :to="`/admin/jurnal/${row.original.id}`"
            class="font-semibold text-cc-green-800 hover:text-cc-brown-500 hover:underline"
          >
            {{ row.original.title }}
          </NuxtLink>
        </template>
        <template #status-cell="{ row }">
          <UBadge
            :color="row.original.status === 'Published' ? 'primary' : 'neutral'"
            variant="subtle"
            size="sm"
          >
            {{ row.original.status }}
          </UBadge>
        </template>
      </UTable>
    </UCard>
  </div>
</template>
