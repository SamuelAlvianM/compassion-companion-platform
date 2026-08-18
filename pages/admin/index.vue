<script setup lang="ts">
definePageMeta({ layout: 'admin' })

// Halaman admin pertama yang mengambil data sungguhan dari database, bukan angka
// yang ditulis di template. Angka nol berarti tabelnya memang masih kosong.
const { data: stats, status, error, refresh } = useFetch('/api/admin/stats')

const { user } = useAuth()
const hanyaMaster = computed(() => user.value?.level === 1)

const ringkasan = computed(() => [
  {
    label: 'Event terbit',
    nilai: stats.value?.kegiatan.perStatus.terbit ?? 0,
    catatan: `${stats.value?.kegiatan.perStatus.draft ?? 0} masih draft`,
    icon: 'i-lucide-calendar-days',
    ke: '/admin/events',
  },
  {
    label: 'Pendaftar belum dikonfirmasi',
    nilai: (stats.value?.peserta.perStatus.baru ?? 0) + (stats.value?.peserta.perStatus.proses ?? 0),
    catatan: `${stats.value?.peserta.total ?? 0} pendaftar total`,
    icon: 'i-lucide-user-plus',
    ke: '/admin/events',
  },
  {
    label: 'Akun terdaftar',
    nilai: stats.value?.user.total ?? 0,
    catatan: stats.value?.user.perRole
      ? `${stats.value.user.perRole.user ?? 0} di antaranya peserta`
      : 'termasuk pengelola',
    icon: 'i-lucide-users',
    ke: '/admin/members',
  },
  {
    label: 'Berkas media',
    nilai: stats.value?.media.total ?? 0,
    catatan: 'gambar, video, dokumen',
    icon: 'i-lucide-image',
    ke: '/admin/jurnal',
  },
])

const roleColumns = [
  { accessorKey: 'level', header: 'Level' },
  { accessorKey: 'label', header: 'Role' },
  { accessorKey: 'jumlah', header: 'Akun' },
  { accessorKey: 'deskripsi', header: 'Wewenang' },
]

/** Level kecil = wewenang besar, jadi warnanya menurun seiring naiknya angka. */
const warnaLevel = (level: number) =>
  ({ 1: 'error', 2: 'primary', 3: 'secondary', 4: 'neutral' })[level] ?? 'neutral'
</script>

<template>
  <div class="mx-auto max-w-6xl">
    <div class="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="font-serif text-5xl text-cc-green-800">Dashboard</h1>
        <p class="mt-2 max-w-2xl text-sm text-cc-stone-600">
          Ringkasan data dan alur kerja pengelolaan Compassionate Companion.
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <UButton
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="subtle"
          :loading="status === 'pending'"
          @click="refresh()"
        >
          Muat ulang
        </UButton>
        <UButton to="/" target="_blank" trailing-icon="i-lucide-external-link" color="primary" variant="solid">
          Lihat website
        </UButton>
      </div>
    </div>

    <UAlert
      v-if="error"
      class="mb-6"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Gagal memuat statistik"
      :description="error.message"
    />

    <UAlert
      v-else-if="stats && stats.kegiatan.total === 0"
      class="mb-6"
      color="warning"
      variant="subtle"
      icon="i-lucide-info"
      title="Database masih kosong"
      description="Angka di halaman ini dibaca langsung dari database, jadi sebagian besar masih nol. Halaman admin lain (Event, Member, Jurnal) belum tersambung dan masih menampilkan data contoh."
    />

    <!-- Ringkasan angka -->
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <UCard v-for="item in ringkasan" :key="item.label" :ui="{ body: 'p-5' }">
        <NuxtLink :to="item.ke" class="block">
          <div class="flex items-start justify-between gap-3">
            <span class="text-sm font-medium text-cc-stone-600">{{ item.label }}</span>
            <UIcon :name="item.icon" class="size-5 shrink-0 text-cc-brown-500" />
          </div>
          <p class="mt-3 font-serif text-5xl leading-none text-cc-green-800">{{ item.nilai }}</p>
          <p class="mt-2 text-xs text-cc-stone-500">{{ item.catatan }}</p>
        </NuxtLink>
      </UCard>
    </div>

    <!-- Agregasi menggantikan blok "Alur kerja".
         Alur kerja itu empat kartu berisi kalimat tetap — isinya sama persis
         apa pun keadaan datanya, dan satu-satunya angka di tiap kartu sudah ada
         di baris ringkasan tepat di atasnya. Yang menggantikannya menjawab
         pertanyaan yang benar-benar dibawa orang ke dashboard: event mana yang
         pendaftarnya menumpuk belum dikonfirmasi, bulan mana yang sepi, dan
         dokumentasi event mana yang masih kosong. -->
    <div class="mt-10">
      <AdminAgregasi />
    </div>

    <!-- Role & wewenang — khusus master.
         Admin dan editor tidak melihat rekap akun ini; penjelasan aturannya
         tetap terbuka bagi mereka lewat menu Petunjuk di sidebar. -->
    <section v-if="hanyaMaster" class="mt-10">
      <h2 class="font-serif text-3xl text-cc-green-800">Role & wewenang</h2>
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

    <!-- Kotak "Bingung siapa boleh apa?" dihapus. Ia menempati satu blok penuh di
         dasar halaman hanya untuk mengulang tautan yang sudah berdiri sendiri di
         sidebar sebagai menu Petunjuk — dan tidak pernah berubah isinya. -->
  </div>
</template>
