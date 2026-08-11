<script setup lang="ts">
definePageMeta({ layout: 'admin' })

// Halaman admin pertama yang mengambil data sungguhan dari database, bukan angka
// yang ditulis di template. Angka nol berarti tabelnya memang masih kosong.
const { data: stats, status, error, refresh } = await useFetch('/api/admin/stats')

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
    label: 'Pendaftar menunggu',
    nilai: stats.value?.peserta.perStatus.menunggu ?? 0,
    catatan: `${stats.value?.peserta.total ?? 0} pendaftar total`,
    icon: 'i-lucide-user-plus',
    ke: '/admin/registrations',
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

/** Alur kerja admin dari kiri ke kanan. `selesai` menentukan warna & ikon langkah. */
const alur = computed(() => {
  const s = stats.value
  const event = s?.kegiatan.perStatus.terbit ?? 0
  const daftar = s?.peserta.total ?? 0
  const konfirmasi = s?.peserta.perStatus.terkonfirmasi ?? 0
  const media = s?.media.total ?? 0

  return [
    {
      no: 1,
      judul: 'Terbitkan event',
      detail: 'Buat kegiatan, tetapkan tanggal, kuota, dan harga, lalu ubah statusnya jadi terbit.',
      angka: `${event} terbit`,
      selesai: event > 0,
      aksi: { label: 'Kelola event', ke: '/admin/events' },
    },
    {
      no: 2,
      judul: 'Terima pendaftaran',
      detail: 'Pendaftar masuk dari halaman event publik, termasuk yang mendaftar tanpa akun.',
      angka: `${daftar} pendaftar`,
      selesai: daftar > 0,
      aksi: { label: 'Lihat pendaftar', ke: '/admin/registrations' },
    },
    {
      no: 3,
      judul: 'Konfirmasi & catat pembayaran',
      detail: 'Periksa bukti transfer, ubah status peserta, lalu tandai transaksi lunas.',
      angka: `${konfirmasi} terkonfirmasi`,
      selesai: konfirmasi > 0,
      aksi: { label: 'Proses pendaftar', ke: '/admin/registrations' },
    },
    {
      no: 4,
      judul: 'Unggah materi & terbitkan jurnal',
      detail: 'Setelah acara: unggah dokumentasi, bagikan materi ke peserta, terbitkan refleksi.',
      angka: `${media} berkas`,
      selesai: media > 0,
      aksi: { label: 'Kelola jurnal', ke: '/admin/jurnal' },
    },
  ]
})

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
        <p class="text-xs font-bold uppercase tracking-[.16em] text-cc-brown-500">Admin area</p>
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

    <!-- Alur kerja -->
    <section class="mt-10">
      <h2 class="font-serif text-3xl text-cc-green-800">Alur kerja</h2>
      <p class="mt-1 mb-4 text-sm text-cc-stone-600">
        Empat langkah dari membuat event sampai menerbitkan dokumentasinya.
      </p>

      <div class="grid gap-4 lg:grid-cols-4">
        <UCard
          v-for="(langkah, index) in alur"
          :key="langkah.no"
          class="relative"
          :ui="{ body: 'p-5 flex flex-col h-full' }"
        >
          <!-- Panah penghubung, hanya muncul saat keempat kartu sejajar. -->
          <UIcon
            v-if="index < alur.length - 1"
            name="i-lucide-chevron-right"
            class="absolute top-1/2 -right-3 z-10 hidden size-6 -translate-y-1/2 text-cc-stone-300 lg:block"
          />

          <div class="flex items-center gap-2">
            <UBadge
              :color="langkah.selesai ? 'primary' : 'neutral'"
              :variant="langkah.selesai ? 'solid' : 'subtle'"
              size="sm"
            >
              Langkah {{ langkah.no }}
            </UBadge>
            <UIcon
              v-if="langkah.selesai"
              name="i-lucide-circle-check"
              class="size-4 text-cc-green-600"
            />
          </div>

          <h3 class="mt-3 font-serif text-2xl leading-tight text-cc-green-800">{{ langkah.judul }}</h3>
          <p class="mt-2 flex-1 text-sm leading-relaxed text-cc-stone-600">{{ langkah.detail }}</p>

          <p class="mt-3 text-xs font-semibold uppercase tracking-wider text-cc-brown-500">
            {{ langkah.angka }}
          </p>
          <UButton
            :to="langkah.aksi.ke"
            color="neutral"
            variant="outline"
            size="sm"
            block
            class="mt-3"
            trailing-icon="i-lucide-arrow-right"
          >
            {{ langkah.aksi.label }}
          </UButton>
        </UCard>
      </div>
    </section>

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

    <!-- Pengganti bagi admin & editor: aturannya tetap bisa dibaca, tanpa rekap akun. -->
    <UAlert
      v-else
      class="mt-10"
      color="neutral"
      variant="subtle"
      icon="i-lucide-book-open"
      title="Bingung siapa boleh apa?"
      description="Pembagian wewenang antar role dan urutan kerja pengelolaan ada di halaman Petunjuk."
      :actions="[{ label: 'Buka Petunjuk', color: 'secondary', variant: 'soft', to: '/admin/petunjuk' }]"
    />
  </div>
</template>
