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
  // Disetujui berdiri sebagai kartunya sendiri, bukan lagi sebagai catatan kecil di
  // bawah "Jurnal terbit". Ini SATU-SATUNYA angka jurnal yang menuntut tindakan
  // admin secara khusus — editor sudah selesai membacanya, dan yang ditunggu
  // tinggal keputusan kapan terbit. Sebagai catatan di kartu lain ia terbaca
  // sebagai keterangan tentang yang sudah terbit, padahal artinya kebalikannya:
  // yang BELUM terbit dan sedang menunggu.
  //
  // Ditaruh sebelum "Jurnal terbit" supaya keempat kartunya terbaca menurut alurnya
  // sendiri — draft, direview, perlu revisi, disetujui, terbit.
  {
    key: 'jurnal-approved',
    label: 'Jurnal disetujui',
    nilai: jurnal.value?.approved ?? 0,
    catatan: 'menunggu diterbitkan',
    ke: '/admin/jurnal?status=approved',
  },
  {
    key: 'jurnal-terbit',
    label: 'Jurnal terbit',
    nilai: jurnal.value?.published ?? 0,
    ke: '/admin/jurnal?status=published',
  },
])

/**
 * Kartunya dipecah jadi dua baris: empat kartu operasional di atas, lima kartu
 * jurnal di bawah.
 *
 * Sebelumnya kesembilannya berbagi satu kisi empat kolom, sehingga barisnya jatuh
 * 4 + 4 + 1 dan satu kartu berdiri sendirian di baris ketiga — melebar penuh tanpa
 * alasan, seolah ia yang paling penting.
 *
 * Pemisahnya bukan sekadar demi kerapian: keempat kartu atas berbicara tentang
 * event dan orang, kelima kartu bawah tentang naskah. Itu dua pekerjaan berbeda
 * yang dipegang orang berbeda pula, dan kisi yang berbeda lebar membuat batas
 * antarkeduanya terbaca tanpa perlu satu judul tambahan.
 *
 * Pengelompokannya dibaca dari awalan `jurnal-` pada `key`. Kartu baru yang tidak
 * berawalan itu jatuh ke baris atas — pilihan yang aman: salah tempat masih
 * tergambar, sementara daftar kunci terpisah yang tertinggal akan membuat kartunya
 * hilang sama sekali.
 */
const kartuOperasional = computed(() => kartu.value.filter(k => !k.key.startsWith('jurnal-')))
const kartuJurnal = computed(() => kartu.value.filter(k => k.key.startsWith('jurnal-')))

// ── Tabel event ──────────────────────────────────────────────────────────────
const kolomEvent = [
  { accessorKey: 'judul', header: 'Event' },
  { accessorKey: 'tanggalMulai', header: 'Tanggal' },
  // "Perlu Diproses", bukan "Pendaftar Baru". Kolom sebelahnya sudah berbunyi
  // "Perlu Dikonfirmasi", jadi yang tergambar sebelumnya adalah satu baris berisi
  // sebuah KEADAAN di sebelah sebuah PEKERJAAN — dan hanya satu dari keduanya yang
  // memberi tahu apa yang harus dilakukan orang yang membacanya. Nama yang sama
  // sudah dipakai chip di tab peserta.
  { accessorKey: 'baru', header: 'Perlu Diproses' },
  { accessorKey: 'proses', header: 'Perlu Dikonfirmasi' },
  { accessorKey: 'konfirmasi', header: 'Terkonfirmasi' },
]

/**
 * Tiga kolom angka, untuk kartu versi ponsel.
 *
 * Disaring DARI `kolomEvent`, bukan ditulis ulang. Labelnya sudah pernah berubah
 * sekali ("Pendaftar Baru" jadi "Perlu Diproses"), dan daftar kedua yang berdiri
 * sendiri berarti perubahan berikutnya hanya mendarat di salah satu bentuk — kepala
 * tabel di layar lebar berkata lain daripada kartu di layar sempit, untuk angka
 * yang sama persis.
 */
const ANGKA_EVENT = kolomEvent
  .filter(k => k.accessorKey !== 'judul' && k.accessorKey !== 'tanggalMulai')
  .map(k => ({ kolom: k.accessorKey as 'baru' | 'proses' | 'konfirmasi', label: k.header }))

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

    <!-- Rangka pemuatan berbentuk sama dengan kartunya supaya barisnya tidak
         melompat begitu angkanya tiba.
         Jumlahnya dihitung dari daftar kartunya, bukan ditulis sebagai angka:
         angka yang disalin di sini sudah pernah tertinggal sekali saat kartunya
         bertambah, dan ketika tertinggal ia menghasilkan persis lompatan yang
         seharusnya dicegahnya. `kartu` sudah berisi penuh selama memuat — yang
         belum ada baru nilainya, bukan barisnya. -->
    <template v-if="memuatAwal">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
        <USkeleton v-for="n in kartuOperasional.length" :key="n" class="h-[124px] w-full rounded-lg" />
      </div>
      <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5" aria-hidden="true">
        <USkeleton v-for="n in kartuJurnal.length" :key="n" class="h-[124px] w-full rounded-lg" />
      </div>
    </template>

    <template v-else>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminKartu
          v-for="k in kartuOperasional"
          :key="k.key"
          :label="k.label"
          :nilai="k.nilai"
          :catatan="k.catatan"
          :ke="k.ke"
          :mati="k.mati"
          @buka="panel = k.antrian ?? null"
        />
      </div>

      <!-- Baris jurnal: lima kolom, jadi tiap kartunya lebih ramping daripada baris
           di atasnya. Perbedaan lebar itu sendiri yang memisahkan kedua kelompok. -->
      <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <AdminKartu
          v-for="k in kartuJurnal"
          :key="k.key"
          :label="k.label"
          :nilai="k.nilai"
          :catatan="k.catatan"
          :ke="k.ke"
          :mati="k.mati"
          @buka="panel = k.antrian ?? null"
        />
      </div>
    </template>

    <!-- Tabel event: yang sedang berjalan dan yang akan datang saja.
         Event selesai tidak menuntut apa pun lagi, dan menaruhnya di sini membuat
         daftar yang harus dibaca tiap pagi memanjang tanpa batas. Rekapnya ada di
         /admin/statistik. -->
    <section class="mt-10">
      <div class="mb-3 flex flex-wrap items-end justify-between gap-3">
        <h2 class="font-serif text-2xl text-cc-green-800">Event Berlangsung dan Mendatang</h2>
      </div>

      <!-- Tabel hanya dari `md` ke atas. Lima kolom pada layar 375px berarti
           membaca sambil menggeser ke samping, dan kolom yang paling sering
           dibutuhkan — tiga angka antrean — justru yang paling kanan, yaitu yang
           paling dulu hilang dari pandangan. Penggantinya kartu per baris di bawah. -->
      <UCard :ui="{ body: 'p-0' }" class="hidden md:block">
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

      <!-- Bentuk layar sempit: satu kartu per event, bukan tabel yang dipersempit.
           Ketiga angkanya berdiri sebagai kolom sejajar dengan labelnya sendiri —
           di tabel, label itu ada di kepala tabel yang tergulir keluar layar
           bersama angkanya. -->
      <div class="space-y-3 md:hidden">
        <p v-if="memuatAwal" class="text-sm text-cc-stone-500">Memuat…</p>

        <p v-else-if="!eventAktif.length" class="rounded-lg border border-cc-stone-200 bg-white p-4 text-sm text-cc-stone-500">
          Tidak ada event yang sedang berlangsung atau mendatang.
        </p>

        <div
          v-for="e in eventAktif"
          :key="e.id"
          class="rounded-lg border border-cc-stone-200 bg-white p-4"
        >
          <NuxtLink
            :to="`/admin/event/${e.id}`"
            class="flex items-start gap-1.5 font-semibold break-words text-cc-green-800"
          >
            {{ e.judul }}
            <UIcon name="i-lucide-arrow-right" class="mt-1 size-3.5 shrink-0 text-cc-stone-400" />
          </NuxtLink>

          <p class="mt-1 text-sm text-cc-stone-600">{{ tanggal(e.tanggalMulai) }}</p>

          <dl class="mt-3 grid grid-cols-3 gap-2 border-t border-cc-stone-100 pt-3 text-center">
            <div v-for="k in ANGKA_EVENT" :key="k.kolom">
              <dt class="text-[11px] leading-tight text-cc-stone-500">{{ k.label }}</dt>
              <dd class="mt-0.5">
                <NuxtLink
                  v-if="e[k.kolom]"
                  :to="keTabPeserta(e.id, k.kolom)"
                  class="font-semibold tabular-nums underline-offset-4"
                  :class="k.kolom === 'konfirmasi' ? 'text-cc-green-800' : 'text-cc-brown-500'"
                >
                  {{ e[k.kolom] }}
                </NuxtLink>
                <span v-else class="tabular-nums text-cc-stone-400">0</span>
              </dd>
            </div>
          </dl>
        </div>
      </div>
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
