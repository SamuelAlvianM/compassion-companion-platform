<script setup lang="ts">
import type { DateValue } from '@internationalized/date'

const route = useRoute()
const base = computed(() => route.path.startsWith('/en') ? '/en' : '/id')
const isEn = computed(() => base.value === '/en')

useSeoMeta({
  title: () => isEn.value ? 'Events' : 'Event',
  description: () => isEn.value
    ? 'Workshops, learning programs, and practicums on compassionate leadership — upcoming, ongoing, and past gatherings.'
    : 'Lokakarya, program pembelajaran, dan practicum kepemimpinan penuh belas kasih — event mendatang, sedang berlangsung, dan yang telah selesai.',
})

// ── Filter ───────────────────────────────────────────────────────────────────
// Fase dulunya tab; sekarang jadi filter agar bisa dipakai bersamaan dengan
// rentang tanggal, dan agar seluruh event tetap terlihat saat filter kosong.
// Satu dropdown kategori, bukan pilihan ganda: tiga fase itu saling meniadakan
// dalam pemakaian nyata — orang mencari "yang mendatang", bukan "mendatang ATAU
// yang sudah selesai".
// Nilai "semua" dipakai sebagai sentinel, bukan string kosong: Reka UI (penyokong
// USelect) memesan '' untuk keadaan "belum dipilih" dan melempar error kalau ada
// item yang nilainya kosong.
const fase = ref('semua')

// Ikonnya sama persis dengan ikon badge fase di kartu, supaya pilihan di dropdown
// dan penanda di kartu terbaca sebagai satu hal yang sama.
const faseOptions = computed(() => [
  { value: 'semua', label: isEn.value ? 'All events' : 'Semua event', icon: 'i-lucide-layers' },
  { value: 'mendatang', label: isEn.value ? 'Upcoming' : 'Mendatang', icon: 'i-lucide-calendar-clock' },
  { value: 'berlangsung', label: isEn.value ? 'Ongoing' : 'Berlangsung', icon: 'i-lucide-radio' },
  { value: 'selesai', label: isEn.value ? 'Completed' : 'Selesai', icon: 'i-lucide-check' },
])

/** Ikon yang tampil di tombol dropdown, mengikuti pilihan yang sedang aktif. */
const ikonFase = computed(() =>
  faseOptions.value.find(o => o.value === fase.value)?.icon ?? 'i-lucide-layers')

// Pencarian disaring di klien, bukan lewat query API: daftar event sebuah
// komunitas berukuran puluhan, bukan ribuan, jadi satu perjalanan ke server per
// ketikan hanya menambah jeda tanpa menambah ketepatan.
const cari = ref('')

// Satu tanggal, bukan rentang. Artinya "mulai dari tanggal ini" — bukan "tepat di
// tanggal ini", yang untuk daftar sepanjang belasan event hampir selalu kosong.
//
// UCalendar dipakai alih-alih <input type="date">: tampilan input native
// ditentukan browser sehingga tidak bisa diselaraskan dengan palet situs.
// DateValue-nya bebas zona waktu, jadi tidak ada pergeseran hari saat jadi string.
const tanggalPilih = shallowRef<DateValue | undefined>(undefined)

const keYmd = (d: DateValue | null | undefined) =>
  d ? `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}` : ''

const dari = computed(() => keYmd(tanggalPilih.value))

// Kalender ditutup begitu tanggal dipilih. Dengan satu tanggal (bukan rentang)
// tidak ada langkah kedua yang perlu ditunggu, jadi membiarkannya terbuka hanya
// menuntut satu klik tambahan untuk menutupnya.
const kalenderOpen = ref(false)
watch(tanggalPilih, () => { kalenderOpen.value = false })

const query = computed(() => ({
  fase: fase.value === 'semua' ? [] : [fase.value],
  dari: dari.value || undefined,
}))

// Sengaja TANPA `await`. Dengan await, <script setup> jadi async dan Vue menahan
// seluruh komponen sampai fetch selesai; digabung pageTransition mode 'out-in',
// halaman lama keluar dulu lalu yang baru ditahan — itu yang membuat layar kosong
// beberapa saat saat berpindah bahasa atau keluar akun. Tanpa await, kerangka
// halaman langsung tergambar dan hanya isinya yang dirangkai.
const { data, status } = useFetch('/api/events', { query })

/** Muat pertama: belum ada data sama sekali. Muat ulang karena filter tidak
    dihitung di sini — kartu yang sudah ada lebih baik tetap terlihat. */
const memuatAwal = computed(() => status.value === 'pending' && !data.value)

const semuaEvent = computed(() => data.value?.data ?? [])
const perFase = computed(() => data.value?.meta.perFase ?? {})

const events = computed(() => {
  const kata = cari.value.trim().toLowerCase()
  if (!kata) return semuaEvent.value
  return semuaEvent.value.filter((e: any) => [e.judul, e.judulEn, e.deskripsi, e.deskripsiEn, e.lokasi]
    .some(nilai => String(nilai ?? '').toLowerCase().includes(kata)))
})

// Render bertahap. `events` sudah tersaring, jadi pencarian tetap menjangkau
// seluruh data meski baru sebagian kartu yang tergambar.
const { items: eventsTampil, sentinel, adaLagi, sisa, muatLagi } = useInfiniteList(events, { awal: 9, tambah: 6 })

const adaFilter = computed(() => fase.value !== 'semua' || Boolean(cari.value.trim()) || Boolean(dari.value))

const resetFilter = () => {
  fase.value = 'semua'
  cari.value = ''
  tanggalPilih.value = undefined
}

// ── Tampilan ─────────────────────────────────────────────────────────────────
// Semua badge dibuat `solid` karena kini duduk di atas gambar sampul — varian
// `subtle` yang transparan jadi tidak terbaca di sana.
const badge = (f: string) => ({
  mendatang: { color: 'primary' as const, variant: 'solid' as const, icon: 'i-lucide-calendar-clock', label: isEn.value ? 'Upcoming' : 'Mendatang' },
  berlangsung: { color: 'secondary' as const, variant: 'solid' as const, icon: 'i-lucide-radio', label: isEn.value ? 'Ongoing' : 'Berlangsung' },
  selesai: { color: 'neutral' as const, variant: 'solid' as const, icon: 'i-lucide-check', label: isEn.value ? 'Completed' : 'Selesai' },
  batal: { color: 'error' as const, variant: 'solid' as const, icon: 'i-lucide-x', label: isEn.value ? 'Cancelled' : 'Dibatalkan' },
}[f] ?? { color: 'neutral' as const, variant: 'solid' as const, icon: 'i-lucide-circle', label: f })

/** Sampul: dari DB bila ada, kalau tidak jatuh ke gambar statis milik event itu. */
const SAMPUL: Record<string, string> = {
  'listening-as-leadership': '/images/listening-as-leadership.png',
  'leadership-with-compassion': '/images/leadership-with-compassion.png',
}
const sampul = (e: { slug: string, cover?: string | null }) =>
  e.cover || SAMPUL[e.slug] || '/images/event-gallery-placeholder.png'

// Tanggal disimpan sebagai timestamp UTC; tampilkan dalam WIB supaya tidak
// bergeser sehari bagi pembaca di Indonesia.
const tanggal = (nilai: string | null, panjang = false) => {
  if (!nilai) return ''
  return new Intl.DateTimeFormat(isEn.value ? 'en-GB' : 'id-ID', {
    day: 'numeric',
    month: panjang ? 'long' : 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(nilai))
}

// Label tombol tanggal; kosong berarti belum ada tanggal yang dipilih.
const labelRentang = computed(() => dari.value ? tanggal(dari.value) : '')

/** Apakah dua timestamp jatuh pada hari yang sama menurut WIB. */
const hariSama = (a: string | null, b: string | null) => {
  if (!a || !b) return true
  const ymd = (n: string) => new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Jakarta',
  }).format(new Date(n))
  return ymd(a) === ymd(b)
}

/**
 * Baris tanggal pada kartu.
 *
 * Event sehari  -> tanggal + jam. Tanggal selesainya sama dengan tanggal mulai,
 *                  jadi mengulanginya tidak menambah apa pun; jamnya justru yang
 *                  menentukan apakah orang bisa ikut.
 * Event berhari -> rentang tanggal. Di sini jam per hari belum tentu seragam,
 *                  sehingga satu jam tunggal malah menyesatkan; rinciannya ada
 *                  di halaman detail.
 */
const barisTanggal = (e: { tanggalMulai: string, tanggalSelesai: string | null, waktu: string | null }) => {
  if (!hariSama(e.tanggalMulai, e.tanggalSelesai)) {
    return `${tanggal(e.tanggalMulai)} – ${tanggal(e.tanggalSelesai)}`
  }
  const tgl = tanggal(e.tanggalMulai, true)
  return e.waktu ? `${tgl} · ${e.waktu}` : tgl
}

const t = computed(() => isEn.value
  ? {
      eyebrow: 'Programs & gatherings', judul: 'Compassionate Companion Events',
      intro: 'A space for learning, reflection, and encounter for those who are sent.',
      filterCari: 'Search events…', filterKategori: 'Category',
      filterTanggal: 'Any date', filterTanggalAria: 'Show events starting from a date',
      reset: 'Reset', hitung: (n: number) => `${n} event${n === 1 ? '' : 's'}`,
      kosong: 'No event matches this filter.', semua: 'Showing all events',
      detail: 'Event details', lokasi: 'Location',
    }
  : {
      eyebrow: 'Program & Perjumpaan', judul: 'Event Compassionate Companion',
      intro: 'Ruang belajar, refleksi, dan perjumpaan bagi para utusan.',
      filterCari: 'Cari event…', filterKategori: 'Kategori',
      filterTanggal: 'Semua tanggal', filterTanggalAria: 'Tampilkan event mulai dari tanggal tertentu',
      reset: 'Reset', hitung: (n: number) => `${n} event`,
      kosong: 'Tidak ada event yang cocok dengan filter ini.', semua: 'Menampilkan semua event',
      detail: 'Detail event', lokasi: 'Lokasi',
    })
</script>

<template>
  <main class="event-page">
    <div class="container">
      <div class="page-head">
        <div class="eyebrow">{{ t.eyebrow }}</div>
        <h1>{{ t.judul }}</h1>
        <p>{{ t.intro }}</p>
      </div>

      <!-- Filter: satu kotak pencarian + satu dropdown kategori. -->
      <div class="event-filter mb-7 flex flex-wrap items-center gap-3">
        <UInput
          v-model="cari"
          icon="i-lucide-search"
          :placeholder="t.filterCari"
          class="w-full sm:w-72"
          :ui="{ base: 'rounded-full' }"
        />

        <USelect
          v-model="fase"
          :items="faseOptions"
          value-key="value"
          :icon="ikonFase"
          :aria-label="t.filterKategori"
          class="w-52"
          :ui="{ base: 'rounded-full' }"
        />

        <UPopover v-model:open="kalenderOpen" :ui="{ content: 'p-0' }">
          <!-- Varian dibiarkan tetap `outline` walau tanggal sudah dipilih: labelnya
               sudah berubah jadi "Mulai …" dan tombol reset ikut muncul, jadi tidak
               perlu warna solid yang membuatnya menonjol sendiri di antara dua
               kontrol lain. `text-dimmed` menyamakan ikonnya dengan ikon search dan
               kategori. -->
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-calendar-range"
            :ui="{ base: 'rounded-full px-3.5', leadingIcon: 'text-dimmed' }"
            :aria-label="t.filterTanggalAria"
          >
            {{ labelRentang ? `${isEn ? 'From' : 'Mulai'} ${labelRentang}` : t.filterTanggal }}
          </UButton>

          <template #content>
            <UCalendar v-model="tanggalPilih" class="p-2" :locale="isEn ? 'en-GB' : 'id-ID'" />
          </template>
        </UPopover>

        <UButton
          v-if="adaFilter"
          color="neutral"
          variant="link"
          icon="i-lucide-rotate-ccw"
          :ui="{ base: 'event-reset px-2' }"
          @click="resetFilter"
        >
          {{ t.reset }}
        </UButton>

        <!-- Hitungan hanya muncul saat filter aktif; tanpa filter, "menampilkan
             semua event" cuma mengulang apa yang sudah terlihat. -->
        <span v-if="adaFilter" class="ml-auto text-sm text-cc-stone-600">
          {{ t.hitung(events.length) }}
        </span>
      </div>

      <!-- Daftar event. Rangka hanya dipasang saat belum ada data sama sekali;
           saat menyaring, kartu yang sudah tergambar dibiarkan tetap terlihat
           supaya menyaring tidak terasa seperti memuat ulang halaman. -->
      <SkeletonKartuEvent v-if="memuatAwal" :jumlah="6" />

      <UAlert
        v-else-if="!events.length"
        color="neutral"
        variant="subtle"
        icon="i-lucide-calendar-off"
        :description="t.kosong"
      />

      <!-- Kartu memakai .card/.card-image/.card-body dari main.css seperti semula:
           sampul menempel penuh ke tepi kartu dan tingginya tetap 176px. UCard
           membungkus isinya dengan padding sendiri, sehingga sampul jadi terbingkai
           dan kartunya memanjang. -->
      <div v-else class="cards">
        <article
          v-for="(e, i) in eventsTampil"
          :key="e.id"
          class="card event-card"
          :style="{ animationDelay: `${Math.min(i, 8) * 60}ms` }"
        >
          <!-- Sampul + badge fase di pojok kanan atasnya -->
          <div class="card-image" :style="{ backgroundImage: `url('${sampul(e)}')` }">
            <UBadge
              :color="badge(e.fase).color"
              :variant="badge(e.fase).variant"
              :icon="badge(e.fase).icon"
              size="sm"
              class="event-badge"
            >
              {{ badge(e.fase).label }}
            </UBadge>
          </div>

          <div class="card-body">
            <div class="event-meta">{{ barisTanggal(e) }}</div>

            <h3>{{ isEn ? (e.judulEn ?? e.judul) : e.judul }}</h3>

            <p class="muted">{{ isEn ? (e.deskripsiEn ?? e.deskripsi) : e.deskripsi }}</p>

            <!-- Biaya dan sisa kursi sengaja tidak ada di kartu. Keduanya angka yang
                 berubah dan menuntut keputusan, sementara kartu ini hanya perlu
                 membuat orang membuka halaman detail — di sanalah keputusan diambil. -->
            <div class="event-line">
              <UIcon :name="e.daring ? 'i-lucide-video' : 'i-lucide-map-pin'" class="size-4 shrink-0 text-cc-brown-500" />
              <span class="event-lokasi">{{ e.lokasi }}</span>
            </div>

            <!-- Event yang sudah selesai tidak menawarkan aksi apa pun — badge di
                 sampul sudah mengatakannya, jadi tombol "Selesai" yang mati di
                 samping "Detail event" cuma mengulang tanpa bisa diklik. -->
            <!-- Satu tombol saja. Pendaftaran dipindah ke halaman detail event
                 supaya orang membaca isinya dulu sebelum memutuskan ikut. -->
            <div class="event-actions">
              <UButton
                :to="`${base}/events/${e.slug}`"
                color="secondary"
                size="sm"
                class="flex-1 justify-center"
                trailing-icon="i-lucide-arrow-right"
              >
                {{ t.detail }}
              </UButton>
            </div>
          </div>
        </article>
      </div>

      <!-- Penanda kaki daftar: dimuat sendiri saat masuk viewport, tapi tetap bisa
           diklik — pengamat viewport tidak berjalan di lingkungan tanpa render, dan
           tombol nyata juga bisa dicapai lewat papan tik. -->
      <div v-if="adaLagi" ref="sentinel" class="mt-8 flex justify-center">
        <UButton color="neutral" variant="link" @click="muatLagi">
          {{ isEn ? `Load ${sisa} more` : `Muat ${sisa} event lagi` }}
        </UButton>
      </div>
    </div>

  </main>
</template>
