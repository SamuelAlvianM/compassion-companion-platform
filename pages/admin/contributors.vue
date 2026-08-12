<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const contributors = [
  { id: 'imanuel', nama: 'Imanuel Ananta', kontak: 'imanuel@example.com', profil: 'Penulis refleksi komunitas muda', artikel: 1, status: 'Aktif' },
  { id: 'henk', nama: 'Henk T. Sengkey', kontak: 'Coach & facilitator', profil: 'Leadership coach & facilitator', artikel: 3, status: 'Aktif' },
]

const columns = [
  { accessorKey: 'nama', header: 'Contributor' },
  { accessorKey: 'profil', header: 'Profil singkat' },
  { accessorKey: 'artikel', header: 'Artikel' },
  { accessorKey: 'status', header: 'Status' },
]
</script>

<template>
  <div class="mx-auto max-w-6xl">
    <div class="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="font-serif text-5xl text-cc-green-800">Contributors</h1>
        <p class="mt-2 max-w-3xl text-sm text-cc-stone-600">
          Satu artikel dapat memiliki satu atau beberapa contributor. Profil ini akan tampil
          pada detail artikel.
        </p>
      </div>
      <UButton color="secondary" size="lg" icon="i-lucide-plus" class="shrink-0">
        Tambah contributor
      </UButton>
    </div>

    <UCard :ui="{ body: 'p-0' }">
      <UTable :data="contributors" :columns="columns" empty="Belum ada contributor.">
        <template #nama-cell="{ row }">
          <span class="font-semibold text-cc-green-800">{{ row.original.nama }}</span>
          <br>
          <span class="text-xs text-cc-stone-500">{{ row.original.kontak }}</span>
        </template>
        <template #artikel-cell="{ row }">
          <span class="tabular-nums">{{ row.original.artikel }}</span>
        </template>
        <template #status-cell="{ row }">
          <UBadge color="primary" variant="subtle" size="sm">{{ row.original.status }}</UBadge>
        </template>
      </UTable>
    </UCard>
  </div>
</template>
