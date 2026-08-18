<script setup lang="ts">
definePageMeta({ layout: 'admin' })

// Grafik telusuran yang dulu duduk di dashboard.
//
// Dipisah karena keduanya menjawab pertanyaan yang berbeda waktunya: dashboard
// dibuka tiap pagi untuk tahu apa yang harus dikerjakan hari ini, halaman ini
// dibuka sesekali untuk tahu apa yang sedang terjadi dari waktu ke waktu. Selama
// keduanya satu halaman, yang dibaca tiap hari harus digulir melewati yang dibaca
// sebulan sekali.
//
// Isinya tidak berubah sedikit pun — AdminAgregasi dipindah utuh, termasuk seluruh
// telusurannya.

const { user } = useAuth()
const hanyaMaster = computed(() => user.value?.level === 1)

// Rekap role ikut pindah ke sini, dan tetap master-only. Ia rekap keadaan, bukan
// daftar pekerjaan — tidak ada yang bisa ditindaklanjuti dari tabel itu.
// `/api/admin/stats` sudah menyaring `roles` di server bagi yang bukan master.
const { data: stats, status } = useFetch('/api/admin/stats')

const roleColumns = [
  { accessorKey: 'level', header: 'Level' },
  { accessorKey: 'label', header: 'Role' },
  { accessorKey: 'jumlah', header: 'Akun' },
  { accessorKey: 'deskripsi', header: 'Wewenang' },
]
</script>

<template>
  <div class="mx-auto max-w-6xl">
    <div class="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-xs font-bold tracking-[0.14em] text-cc-brown-500 uppercase">Admin area</p>
        <h1 class="mt-1 font-serif text-4xl text-cc-green-800">Statistik</h1>
        <p class="mt-1 max-w-2xl text-sm text-cc-stone-600">
          Sebaran pendaftar, kapasitas, kunjungan, dan isi dokumentasi. Tiap angka bisa
          diklik untuk melihat baris pembentuknya.
        </p>
      </div>

      <UButton
        to="/admin"
        color="neutral"
        variant="subtle"
        icon="i-lucide-arrow-left"
      >
        Dashboard
      </UButton>
    </div>

    <AdminAgregasi />

    <!-- Role & wewenang — khusus master.
         Admin dan editor tidak melihat rekap akun ini; penjelasan aturannya tetap
         terbuka bagi mereka lewat menu Petunjuk di sidebar. -->
    <section v-if="hanyaMaster" class="mt-10">
      <h2 class="font-serif text-3xl text-cc-green-800">Role &amp; wewenang</h2>
      <p class="mt-1 mb-4 text-sm text-cc-stone-600">
        Angka level kecil berarti wewenang lebih besar. Pemeriksaan hak akses memakai
        perbandingan <code class="rounded bg-cc-stone-100 px-1 py-0.5 text-xs">level &lt;= n</code>,
        jadi satu aturan bisa mencakup satu role ke atas sekaligus.
      </p>

      <UCard :ui="{ body: 'p-0' }">
        <UTable
          :data="stats?.roles ?? []"
          :columns="roleColumns"
          :loading="status === 'pending'"
          empty="Belum ada akun. Jalankan npm run db:seed."
        >
          <template #level-cell="{ row }">
            <UBadge :color="warnaLevel(row.original.level)" variant="subtle" size="sm">
              Level {{ row.original.level }}
            </UBadge>
          </template>
          <template #label-cell="{ row }">
            <span class="font-semibold text-cc-green-800">{{ row.original.label }}</span>
            <span class="ml-2 text-xs text-cc-stone-500">{{ row.original.role }}</span>
          </template>
          <template #jumlah-cell="{ row }">
            <span class="tabular-nums">{{ row.original.jumlah }}</span>
          </template>
        </UTable>
      </UCard>
    </section>
  </div>
</template>
