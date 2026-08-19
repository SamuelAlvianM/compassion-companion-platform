<script setup lang="ts">
definePageMeta({ layout: 'admin' })

// Daftar jurnal — kini dari database, bukan lagi array tetap di `shared/jurnal.ts`.
//
// Penyaring statusnya berbentuk chip, sama seperti tab peserta di halaman event:
// empat status ini adalah alur kerja, dan alur kerja perlu terlihat sekaligus —
// berapa yang menunggu direview jauh lebih penting daripada bisa disembunyikan di
// balik dropdown.

const route = useRoute()

/** Status awal boleh ditentukan dari luar lewat `?status=`. Dipakai kartu jurnal
    di dashboard: "Jurnal direview 3" mendarat langsung pada ketiganya. */
const tab = ref(String(route.query.status ?? 'semua'))
const cari = ref('')
const tipe = ref('semua')

const { data, status: muatStatus, refresh } = useFetch('/api/admin/jurnal', {
  query: { status: tab, cari, tipe },
  // Cookie tidak ikut terbawa $fetch saat SSR; tanpa penerusan ini render pertama
  // selalu 401.
  headers: import.meta.server ? useRequestHeaders(['cookie']) : undefined,
})

const { user } = useAuth()
const level = computed(() => user.value?.level ?? 99)
const jurnal = computed(() => data.value?.data ?? [])
const tugasSaya = computed(() => data.value?.meta.tugasSaya ?? 0)
const hitung = computed<Record<string, number>>(() => data.value?.meta.perStatus ?? {})

/** Rangka hanya saat belum ada data sama sekali — berganti chip atau mengetik di
    kotak cari membiarkan baris yang sudah tergambar tetap terlihat. */
const memuatAwal = computed(() => muatStatus.value === 'pending' && !data.value)

// Lima status alur persetujuan. Urutannya mengikuti urutan pekerjaannya, bukan
// abjad: itu yang membuat baris chip terbaca sebagai perjalanan sebuah tulisan.
const STATUS = [
  { key: 'semua', label: 'Semua', warna: 'neutral' },
  { key: 'draft', label: 'Draft', warna: 'neutral' },
  { key: 'review', label: 'Minta direview', warna: 'warning' },
  { key: 'revisi', label: 'Minta direvisi', warna: 'secondary' },
  { key: 'approved', label: 'Disetujui', warna: 'accent' },
  { key: 'published', label: 'Terbit', warna: 'primary' },
]

/** Kelas ditulis utuh, bukan disusun saat runtime: Tailwind memindai berkas sebagai
    teks, dan `bg-cc-${warna}-500` tidak pernah ikut diterbitkan. */
const warnaChip: Record<string, string> = {
  neutral: 'bg-cc-stone-700 text-white',
  warning: 'bg-cc-brown-500 text-white',
  secondary: 'bg-cc-brown-600 text-white',
  accent: 'bg-cc-green-600 text-white',
  primary: 'bg-cc-green-800 text-white',
}

const warnaBadge: Record<string, 'neutral' | 'warning' | 'secondary' | 'primary'> = {
  draft: 'neutral',
  review: 'warning',
  revisi: 'secondary',
  approved: 'primary',
  published: 'primary',
}

const labelStatus = (s: string) => STATUS.find(x => x.key === s)?.label ?? s

const tipeOptions = [
  { value: 'semua', label: 'Semua tipe' },
  { value: 'event-reflection', label: 'Event Reflection' },
  { value: 'sharing-journey', label: 'Sharing Journey' },
  { value: 'insight', label: 'Insight' },
  { value: 'practice', label: 'Practice' },
]

const labelTipe = (t: string) => tipeOptions.find(o => o.value === t)?.label ?? t

/**
 * Lebar kolom ditetapkan, dan tabelnya TIDAK bisa digeser ke samping.
 *
 * Sebelumnya tabelnya dibungkus `overflow-x-auto`: begitu isinya melebihi lebar
 * layar, kolom "Diperbarui" dan "Editor" terdorong keluar dan hanya bisa dilihat
 * dengan menggeser — dan pada tabel yang barisnya panjang, menggeser berarti
 * kehilangan kolom judul yang jadi patokan sedang membaca baris yang mana.
 *
 * Sekarang lebarnya dipatok dalam persen dan teksnya dibiarkan turun ke baris
 * berikutnya. Barisnya jadi lebih tinggi — itu memang konsekuensinya, dan itu
 * pilihan yang lebih baik: tinggi bisa dibaca sambil menggulir ke bawah, yang
 * memang sudah dilakukan orang; lebar yang terpotong tidak bisa dibaca sama
 * sekali tanpa tindakan tambahan.
 *
 * Persentasenya dijumlahkan sampai 100. Judul mendapat porsi terbesar karena ia
 * yang paling sering panjang dan paling dibutuhkan utuh.
 */
const LEBAR: Record<string, string> = {
  judul: 'w-[32%]',
  // Status paling sempit: isinya satu badge pendek yang panjangnya tetap. Porsi
  // yang lebih besar cuma menghasilkan ruang kosong di sebelah kanannya, dan
  // ruang kosong itu memisahkan Status dari Penulis sejauh mata harus melompat.
  status: 'w-[10%]',
  tipe: 'w-[14%]',
  kontributor: 'w-[16%]',
  editorNama: 'w-[16%]',
  updatedAt: 'w-[12%]',
}

const kolomUi = (key: string) => ({
  meta: {
    class: {
      th: `${LEBAR[key]} px-2 py-2 align-bottom whitespace-normal`,
      td: 'px-2 py-2.5 align-top whitespace-normal break-words',
    },
  },
})

const columns = computed(() => [
  { accessorKey: 'judul', header: 'Judul', ...kolomUi('judul') },
  { accessorKey: 'tipe', header: 'Kategori', ...kolomUi('tipe') },
  { accessorKey: 'status', header: 'Status', ...kolomUi('status') },
  { accessorKey: 'kontributor', header: 'Penulis', ...kolomUi('kontributor') },
  // Kolom editor hanya berarti bagi yang bisa menugaskan atau yang sedang mencari
  // bagiannya sendiri; keduanya level <= 3, yaitu semua yang bisa membuka halaman
  // ini. Tetap dibuat computed karena isinya berbeda untuk admin dan editor.
  { accessorKey: 'editorNama', header: 'Editor', ...kolomUi('editorNama') },
  { accessorKey: 'updatedAt', header: 'Diperbarui', ...kolomUi('updatedAt') },
])

const tanggal = (nilai: string | number | null) =>
  nilai
    ? new Intl.DateTimeFormat('id-ID', {
        day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta',
      }).format(new Date(nilai))
    : '—'

// Halaman ini bisa dibuka lewat tautan dashboard yang membawa ?status=; kalau
// chipnya lalu diganti dengan tangan, alamatnya ikut dirapikan supaya menyegarkan
// halaman tidak melompat kembali ke status yang tadi.
const router = useRouter()
watch(tab, (nilai) => {
  router.replace({ query: nilai === 'semua' ? {} : { status: nilai } })
})
</script>

<template>
  <!-- Lebih lebar daripada halaman admin lain (max-w-6xl). Tabel ini punya enam
       kolom, dan sejak ia tidak lagi bisa digeser ke samping, lebar wadah itulah
       satu-satunya yang menentukan berapa banyak teks yang harus menekuk. -->
  <div class="mx-auto max-w-[92rem]">
    <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-xs font-bold tracking-[0.14em] text-cc-brown-500 uppercase">Admin area</p>
        <h1 class="mt-1 font-serif text-4xl text-cc-green-800">Jurnal</h1>
        <p class="mt-1 max-w-3xl text-sm text-cc-stone-600">
          Cerita peserta, sharing pengalaman, insight, dan praktik baik. Yang mereview
          editor yang ditugaskan; yang menerbitkan admin.
        </p>
        <p v-if="level === 3" class="mt-1 text-sm font-semibold text-cc-green-800">
          {{ tugasSaya }} jurnal jadi tugas Anda.
        </p>
      </div>
      <!-- Editor tidak membuat jurnal baru dari sini: pekerjaannya memeriksa
           tulisan yang masuk, bukan menambah antrean sendiri. -->
      <UButton v-if="level <= 2" to="/admin/jurnal/new" color="secondary" icon="i-lucide-plus" class="shrink-0">
        Tambah jurnal
      </UButton>
    </div>

    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div
        role="group"
        aria-label="Status jurnal"
        class="flex flex-wrap items-center gap-1.5 rounded-full bg-cc-stone-100 p-1"
      >
        <button
          v-for="s in STATUS"
          :key="s.key"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors"
          :class="tab === s.key ? warnaChip[s.warna] : 'text-cc-stone-600 hover:bg-white hover:text-cc-green-800'"
          :aria-pressed="tab === s.key"
          @click="tab = s.key"
        >
          {{ s.label }}
          <span
            class="rounded-full px-1.5 py-0.5 text-[11px] tabular-nums"
            :class="tab === s.key ? 'bg-white/25' : 'bg-white text-cc-stone-500'"
          >
            {{ hitung[s.key] ?? 0 }}
          </span>
        </button>
      </div>

      <div class="flex min-w-0 flex-1 basis-80 flex-nowrap items-center justify-end gap-2">
        <UInput
          v-model="cari"
          icon="i-lucide-search"
          placeholder="Cari judul atau penulis…"
          class="min-w-0 flex-1 lg:max-w-72"
        />
        <USelect v-model="tipe" :items="tipeOptions" value-key="value" class="w-44 shrink-0" />
      </div>
    </div>

    <div v-if="memuatAwal" class="space-y-2" aria-hidden="true">
      <USkeleton v-for="n in 5" :key="n" class="h-11 w-full" />
    </div>

    <UCard v-else :ui="{ body: 'p-0' }">
      <UTable
        :data="jurnal"
        :columns="columns"
        empty="Belum ada jurnal pada status ini."
        :ui="{ base: 'w-full table-fixed' }"
      >
        <template #judul-cell="{ row }">
          <NuxtLink
            :to="`/admin/jurnal/${row.original.id}`"
            class="font-semibold break-words text-cc-green-800 hover:text-cc-brown-500 hover:underline"
          >
            {{ row.original.judul }}
          </NuxtLink>
          <!-- Event yang direfleksikan ikut di baris judul, bukan kolom sendiri:
               hanya tipe event-reflection yang punya, dan satu kolom yang tiga
               perempatnya kosong cuma memakan lebar. -->
          <p v-if="row.original.kegiatanJudul" class="mt-0.5 text-xs break-words text-cc-stone-500">
            {{ row.original.kegiatanJudul }}
          </p>
        </template>

        <!-- Kategori boleh kosong sampai admin menentukannya — tulisan titipan
             member lahir tanpa kategori. Ditandai, bukan dibiarkan kosong: ia
             syarat terbit, dan yang kosong begitu saja terbaca sebagai "tidak
             perlu diisi". -->
        <template #tipe-cell="{ row }">
          <span v-if="row.original.tipe" class="text-sm break-words text-cc-stone-600">
            {{ labelTipe(row.original.tipe) }}
          </span>
          <UBadge v-else color="warning" variant="subtle" size="sm">Belum ada kategori</UBadge>
        </template>

        <template #editorNama-cell="{ row }">
          <span v-if="row.original.editorNama" class="text-sm break-words">
            {{ row.original.editorNama }}
            <span v-if="row.original.editorId === user?.id" class="text-xs text-cc-green-800">(Anda)</span>
          </span>
          <span v-else class="text-sm text-cc-stone-400">belum ditugaskan</span>
        </template>

        <template #status-cell="{ row }">
          <div class="flex items-center gap-2">
            <UBadge :color="warnaBadge[row.original.status]" variant="subtle" size="sm">
              {{ labelStatus(row.original.status) }}
            </UBadge>
            <!-- Penanda catatan revisi. Tanpa ini, "perlu revisi" di daftar tidak
                 memberi tahu apakah alasannya sudah ditulis atau belum. -->
            <UTooltip v-if="row.original.catatanRevisi" :text="row.original.catatanRevisi">
              <UIcon name="i-lucide-message-square-warning" class="size-4 text-cc-brown-500" />
            </UTooltip>
          </div>
        </template>

        <template #kontributor-cell="{ row }">
          <span class="text-sm break-words">{{ row.original.kontributor }}</span>
        </template>

        <template #updatedAt-cell="{ row }">
          <span class="text-sm text-cc-stone-600">{{ tanggal(row.original.updatedAt) }}</span>
        </template>
      </UTable>
    </UCard>
  </div>
</template>
