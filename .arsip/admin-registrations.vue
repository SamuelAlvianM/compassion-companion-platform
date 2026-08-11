<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const pendaftar = [
  { id: 'andreas', nama: 'Andreas Pratama', email: 'andreas@email.com', event: 'Leadership with Compassion', wa: '0812 3456 7890', status: 'Menunggu pembayaran', aksi: 'Konfirmasi' },
  { id: 'clara', nama: 'Clara Wijaya', email: 'clara@email.com', event: 'Leadership with Compassion', wa: '0813 8888 4433', status: 'Baru', aksi: 'Tinjau' },
]

const columns = [
  { accessorKey: 'nama', header: 'Nama' },
  { accessorKey: 'event', header: 'Event' },
  { accessorKey: 'wa', header: 'WhatsApp' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'aksi', header: 'Aksi' },
]

const warnaStatus = (status: string) => (status === 'Baru' ? 'info' : 'warning')
</script>

<template>
  <div class="mx-auto max-w-6xl">
    <div class="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-xs font-bold uppercase tracking-[.16em] text-cc-brown-500">Event</p>
        <h1 class="font-serif text-5xl text-cc-green-800">Pendaftar</h1>
        <p class="mt-2 text-sm text-cc-stone-600">
          Periksa data peserta, status pembayaran, lalu tetapkan mereka sebagai peserta event.
        </p>
      </div>
      <UButton color="neutral" variant="outline" size="lg" icon="i-lucide-download" class="shrink-0">
        Ekspor daftar
      </UButton>
    </div>

    <UAlert
      class="mb-6"
      color="warning"
      variant="subtle"
      icon="i-lucide-info"
      title="Data contoh"
      description="Tabel ini belum tersambung ke tabel cc_peserta. Angka sebenarnya bisa dilihat di dashboard."
    />

    <UCard :ui="{ body: 'p-0' }">
      <UTable :data="pendaftar" :columns="columns" empty="Belum ada pendaftar.">
        <template #nama-cell="{ row }">
          <span class="font-semibold text-cc-green-800">{{ row.original.nama }}</span>
          <br>
          <span class="text-xs text-cc-stone-500">{{ row.original.email }}</span>
        </template>
        <template #status-cell="{ row }">
          <UBadge :color="warnaStatus(row.original.status)" variant="subtle" size="sm">
            {{ row.original.status }}
          </UBadge>
        </template>
        <template #aksi-cell="{ row }">
          <UButton color="secondary" variant="soft" size="sm">{{ row.original.aksi }}</UButton>
        </template>
      </UTable>
    </UCard>
  </div>
</template>
