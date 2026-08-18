<script setup lang="ts">
definePageMeta({ layout: 'admin' })

// Dashboard = daftar pekerjaan, bukan laporan.
//
// Yang ditanyakan orang saat membukanya cuma satu: "apa yang perlu saya kerjakan
// sekarang?" Karena itu isinya tinggal angka-angka yang menuntut tindakan, dan
// tiap angka punya jalan ke tempat tindakan itu dikerjakan. Grafik telusuran
// pindah ke /admin/statistik — ia menjawab pertanyaan lain ("apa yang sedang
// terjadi dari waktu ke waktu"), dan menaruhnya di sini membuat halaman yang
// dibuka tiap pagi harus digulir melewati enam grafik dulu.
//
// SATU permintaan, bukan dua. Sebelumnya /api/admin/stats untuk kartu dan
// /api/admin/agregasi untuk grafik — padahal agregasi sudah memuat semua yang
// dibutuhkan kartu, dan lebih: hitungan per status PER EVENT, yang justru jadi isi
// panel samping.
const { data, status, error, refresh } = useFetch('/api/admin/agregasi')

const { user } = useAuth()

interface EventAgregat {
  id: string
  judul: string
  fase: string
  status: string
  tanggalMulai: string | null
  baru: number
  proses: number
  konfirmasi: number
  batal: number
  total: number
}

const events = computed(() => (data.value?.event ?? []) as EventAgregat[])
const jurnal = computed(() => data.value?.jurnal)
const member = computed(() => data.value?.member)

const waktu = (nilai: string | null) => (nilai ? new Date(nilai).getTime() : 0)

/**
 * Event yang sedang hidup: sudah terbit, dan acaranya belum lewat.
 *
 * Dua saringan yang berbeda artinya dan dua-duanya perlu — `status` menentukan
 * event itu sudah dilihat publik atau belum, `fase` menentukan waktunya sudah
 * lewat atau belum. Draft yang tanggalnya mendatang bukan event aktif; event
 * terbit yang sudah selesai juga bukan.
 *
 * Diurut dari yang paling dekat: yang menuntut pekerjaan lebih dulu adalah yang
 * acaranya paling cepat tiba, bukan yang terakhir dibuat.
 */
const eventAktif = computed(() =>
  events.value
    .filter(e => e.status === 'terbit' && (e.fase === 'berlangsung' || e.fase === 'mendatang'))
    .sort((a, b) => waktu(a.tanggalMulai) - waktu(b.tanggalMulai)),
)

const jumlahDraft = computed(() => events.value.filter(e => e.status === 'draft').length)

/** Total lintas event untuk angka besar di kartu. */
const totalBaru = computed(() => events.value.reduce((n, e) => n + e.baru, 0))
const totalProses = computed(() => events.value.reduce((n, e) => n + e.proses, 0))

// ── Panel samping ────────────────────────────────────────────────────────────
// Kartu "perlu diproses" dan "perlu dikonfirmasi" tidak langsung melompat ke satu
// event: angkanya kumpulan dari beberapa event, dan melompat berarti memilihkan
// event mana yang dikerjakan duluan. Panel memperlihatkan sebarannya dulu, lalu
// orangnya yang memilih.
//
// Slideover, bukan modal: kartu-kartu di belakangnya tetap terlihat, jadi angka di
// panel bisa dicocokkan dengan angka yang barusan diklik.
type Antrian = 'baru' | 'proses'

const panel = ref<Antrian | null>(null)

/**
 * Status pendaftaran yang dituju tiap antrian.
 *
 * Yang dibuka BUKAN status tujuannya melainkan status yang sedang menunggu
 * dikerjakan: "perlu diproses" itu orang yang masih `baru`, "perlu dikonfirmasi"
 * itu yang sudah `proses`. Chip di tab peserta memakai kunci yang sama persis,
 * jadi nilai ini dikirim apa adanya lewat query.
 */
const ANTRIAN: Record<Antrian, { judul: string, keterangan: string, kolom: 'baru' | 'proses' }> = {
  baru: {
    judul: 'Pendaftar baru, perlu diproses',
    keterangan: 'Belum dihubungi. Klik nama event untuk membuka daftarnya pada chip “Baru”.',
    kolom: 'baru',
  },
  proses: {
    judul: 'Peserta perlu dikonfirmasi',
    keterangan: 'Sudah diproses, menunggu konfirmasi. Klik nama event untuk membukanya pada chip “Diproses”.',
    kolom: 'proses',
  },
}

/** Alamat tab peserta sebuah event dengan chip status yang sudah terpilih.
    Dibaca `pages/admin/event/[id].vue` lewat query. */
const keTabPeserta = (id: string, status: string) =>
  `/admin/event/${id}?tab=peserta&status=${status}`

/** Isi panel: hanya event yang benar-benar punya antrian. Event bernilai nol cuma
    memanjangkan daftar tanpa menambah satu pun pekerjaan. */
const barisPanel = computed(() => {
  if (!panel.value) return []
  const kolom = ANTRIAN[panel.value].kolom
  return events.value
    .filter(e => e[kolom] > 0)
    .sort((a, b) => b[kolom] - a[kolom])
    .map(e => ({ id: e.id, judul: e.judul, jumlah: e[kolom], ke: keTabPeserta(e.id, kolom) }))
})

// ── Kartu ────────────────────────────────────────────────────────────────────
// Bentuknya ditulis sebagai satu tipe, bukan dibiarkan disimpulkan dari isinya:
// tiap kartu cuma memakai sebagian kolomnya (yang menuju halaman punya `ke`, yang
// membuka panel punya `antrian`), dan tanpa tipe bersama TS menyimpulkan gabungan
// yang membuat `k.ke` di template terbaca sebagai kolom yang tidak selalu ada.
interface Kartu {
  key: string
  label: string
  nilai: number
  catatan?: string
  ke?: string
  antrian?: Antrian
  mati?: boolean
}

const kartu = computed<Kartu[]>(() => [
  {
    key: 'event',
    label: 'Event Aktif',
    nilai: eventAktif.value.length,
    catatan: jumlahDraft.value ? `${jumlahDraft.value} masih draft` : 'semua sudah terbit',
    ke: '/admin/events',
  },
  {
    key: 'baru',
    label: 'Pendaftar Baru, perlu diproses',
    nilai: totalBaru.value,
    catatan: `di ${events.value.filter(e => e.baru > 0).length} event`,
    antrian: 'baru',
  },
  {
    key: 'proses',
    label: 'Peserta Perlu Dikonfirmasi',
    nilai: totalProses.value,
    catatan: `di ${events.value.filter(e => e.proses > 0).length} event`,
    antrian: 'proses',
  },
  {
    key: 'member',
    label: 'Member Aktif',
    nilai: member.value?.aktif ?? 0,
    catatan: member.value?.baruBulanIni
      ? `+${member.value.baruBulanIni} bulan ini`
      : 'belum ada akun baru bulan ini',
    ke: '/admin/members',
  },
  // Empat status alur terbit jurnal. Keempatnya kini angka sungguhan dari
  // `cc_jurnal`, dan masing-masing membuka daftarnya sendiri lewat `?status=` —
  // dua di antaranya sempat dimatikan selama statusnya belum ada.
  {
    key: 'jurnal-draft',
    label: 'Jurnal Draft',
    nilai: jurnal.value?.draft ?? 0,
    ke: '/admin/jurnal?status=draft',
  },
  {
    key: 'jurnal-review',
    label: 'Jurnal direview',
    nilai: jurnal.value?.review ?? 0,
    catatan: 'menunggu keputusan admin',
    ke: '/admin/jurnal?status=review',
  },
  {
    key: 'jurnal-revisi',
    label: 'Jurnal perlu revisi',
    nilai: jurnal.value?.revisi ?? 0,
    catatan: 'dikembalikan ke penulis',
    ke: '/admin/jurnal?status=revisi',
  },
  {
    key: 'jurnal-terbit',
    label: 'Jurnal terbit',
    nilai: jurnal.value?.published ?? 0,
    catatan: (jurnal.value?.approved ?? 0)
      ? `${jurnal.value?.approved} disetujui, menunggu diterbitkan`
      : undefined,
    ke: '/admin/jurnal?status=published',
  },
])

// ── Tabel event ──────────────────────────────────────────────────────────────
const kolomEvent = [
  { accessorKey: 'judul', header: 'Event' },
  { accessorKey: 'tanggalMulai', header: 'Tanggal' },
  { accessorKey: 'baru', header: 'Pendaftar Baru' },
  { accessorKey: 'proses', header: 'Perlu Dikonfirmasi' },
  { accessorKey: 'konfirmasi', header: 'Terkonfirmasi' },
]

/** Tanggal dalam WIB. Timestamp disimpan UTC; tanpa zona waktu, acara pukul 07.00
    pagi tampil sebagai tanggal sebelumnya bagi pembaca di Indonesia. */
const tanggal = (nilai: string | null) =>
  nilai
    ? new Intl.DateTimeFormat('id-ID', {
        day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta',
      }).format(new Date(nilai))
    : '—'

const memuatAwal = computed(() => status.value === 'pending' && !data.value)
</script>

<template>
  <div class="mx-auto max-w-6xl">
    <div class="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-xs font-bold tracking-[0.14em] text-cc-brown-500 uppercase">Admin area</p>
        <h1 class="mt-1 font-serif text-4xl break-words text-cc-green-800">
          Selamat datang, {{ user?.fullName ?? '' }}
        </h1>
        <p class="mt-1 text-sm text-cc-stone-600">Berikut aktivitas yang perlu ditindaklanjuti:</p>
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
        <UButton to="/" target="_blank" trailing-icon="i-lucide-external-link" color="neutral" variant="outline">
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
      title="Gagal memuat data dashboard"
      :description="error.message"
    />

    <UAlert
      v-else-if="data && !events.length"
      class="mb-6"
      color="warning"
      variant="subtle"
      icon="i-lucide-info"
      title="Belum ada event"
      description="Angka di halaman ini dibaca langsung dari database. Buat event pertama lewat menu Event."
    />

    <!-- Delapan kartu, dua baris. Rangka pemuatan berbentuk sama dengan kartunya
         supaya barisnya tidak melompat begitu angkanya tiba. -->
    <div v-if="memuatAwal" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
      <USkeleton v-for="n in 8" :key="n" class="h-[124px] w-full rounded-lg" />
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <AdminKartu
        v-for="k in kartu"
        :key="k.key"
        :label="k.label"
        :nilai="k.nilai"
        :catatan="k.catatan"
        :ke="k.ke"
        :mati="k.mati"
        @buka="panel = k.antrian ?? null"
      />
    </div>

    <!-- Tabel event: yang sedang berjalan dan yang akan datang saja.
         Event selesai tidak menuntut apa pun lagi, dan menaruhnya di sini membuat
         daftar yang harus dibaca tiap pagi memanjang tanpa batas. Rekapnya ada di
         /admin/statistik. -->
    <section class="mt-10">
      <div class="mb-3 flex flex-wrap items-end justify-between gap-3">
        <h2 class="font-serif text-2xl text-cc-green-800">Event Berlangsung dan Mendatang</h2>
      </div>

      <UCard :ui="{ body: 'p-0' }">
        <UTable
          :data="eventAktif"
          :columns="kolomEvent"
          :loading="memuatAwal"
          empty="Tidak ada event yang sedang berlangsung atau mendatang."
          class="overflow-x-auto"
        >
          <!-- Nama event membawa panahnya sendiri: di baris berisi empat angka yang
               juga bisa diklik, warna saja tidak cukup memberi tahu mana yang
               membuka halaman eventnya. -->
          <template #judul-cell="{ row }">
            <NuxtLink
              :to="`/admin/event/${row.original.id}`"
              class="group inline-flex items-start gap-1.5 font-semibold break-words text-cc-green-800 hover:text-cc-brown-500"
            >
              {{ row.original.judul }}
              <UIcon
                name="i-lucide-arrow-right"
                class="mt-1 size-3.5 shrink-0 text-cc-stone-400 group-hover:text-cc-brown-500"
              />
            </NuxtLink>
          </template>

          <template #tanggalMulai-cell="{ row }">
            <span class="text-sm whitespace-nowrap text-cc-stone-600">
              {{ tanggal(row.original.tanggalMulai) }}
            </span>
          </template>

          <!-- Angka nol tidak dijadikan tautan. Tidak ada yang perlu dikerjakan di
               sana, dan tautan yang membuka daftar kosong membuat orang mengira
               dirinya salah klik. -->
          <template #baru-cell="{ row }">
            <NuxtLink
              v-if="row.original.baru"
              :to="keTabPeserta(row.original.id, 'baru')"
              class="font-semibold tabular-nums text-cc-brown-500 underline-offset-4 hover:underline"
            >
              {{ row.original.baru }}
            </NuxtLink>
            <span v-else class="tabular-nums text-cc-stone-400">0</span>
          </template>

          <template #proses-cell="{ row }">
            <NuxtLink
              v-if="row.original.proses"
              :to="keTabPeserta(row.original.id, 'proses')"
              class="font-semibold tabular-nums text-cc-brown-500 underline-offset-4 hover:underline"
            >
              {{ row.original.proses }}
            </NuxtLink>
            <span v-else class="tabular-nums text-cc-stone-400">0</span>
          </template>

          <template #konfirmasi-cell="{ row }">
            <NuxtLink
              v-if="row.original.konfirmasi"
              :to="keTabPeserta(row.original.id, 'konfirmasi')"
              class="tabular-nums text-cc-green-800 underline-offset-4 hover:underline"
            >
              {{ row.original.konfirmasi }}
            </NuxtLink>
            <span v-else class="tabular-nums text-cc-stone-400">0</span>
          </template>
        </UTable>
      </UCard>
    </section>

    <!-- Panel antrian. Judul, keterangan, dan isinya ditentukan kartu yang diklik. -->
    <USlideover
      :open="Boolean(panel)"
      :title="panel ? ANTRIAN[panel].judul : ''"
      :description="panel ? ANTRIAN[panel].keterangan : ''"
      @update:open="panel = null"
    >
      <template #body>
        <p v-if="!barisPanel.length" class="text-sm text-cc-stone-500">
          Tidak ada yang menunggu. Semua pendaftar sudah ditindaklanjuti.
        </p>

        <ul v-else class="divide-y divide-cc-stone-200">
          <li v-for="b in barisPanel" :key="b.id">
            <NuxtLink
              :to="b.ke"
              class="group flex items-center justify-between gap-3 py-3 hover:text-cc-brown-500"
              @click="panel = null"
            >
              <span class="min-w-0 flex-1 text-sm font-medium break-words text-cc-green-800 group-hover:text-cc-brown-500">
                {{ b.judul }}
              </span>
              <span class="shrink-0 text-sm font-semibold tabular-nums">{{ b.jumlah }}</span>
              <UIcon name="i-lucide-arrow-right" class="size-4 shrink-0 text-cc-stone-400 group-hover:text-cc-brown-500" />
            </NuxtLink>
          </li>
        </ul>
      </template>

      <template #footer>
        <div class="flex w-full justify-end">
          <UButton color="neutral" variant="ghost" @click="panel = null">Tutup</UButton>
        </div>
      </template>
    </USlideover>
  </div>
</template>
