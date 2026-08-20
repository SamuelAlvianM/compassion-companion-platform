<script setup lang="ts">
const route = useRoute()
const isEn = computed(() => route.path.startsWith('/en'))
/** Awalan bahasa untuk tautan ke halaman baca — /id/jurnal/… atau /en/jurnal/…. */
const base = computed(() => (isEn.value ? '/en' : '/id'))

useSeoMeta({
  title: () => isEn.value ? 'Journal' : 'Jurnal',
  description: () => isEn.value
    ? 'Stories, reflections, insights, and practices growing out of encounters and service within the Compassionate Companion community.'
    : 'Cerita, refleksi, insight, dan praktik yang bertumbuh dari perjumpaan serta pelayanan di komunitas Compassionate Companion.',
})

type JournalType = 'event-reflection' | 'sharing-journey' | 'insight' | 'practice'

const selectedType = ref<'all' | JournalType>('all')
const selectedEvent = ref('all')
const search = ref('')
const sortOrder = ref<'newest' | 'oldest'>('newest')

// Label antarmuka mengikuti locale; isi jurnal tetap dalam bahasa aslinya.
const types = computed<{ value: 'all' | JournalType, label: string }[]>(() => [
  { value: 'all', label: isEn.value ? 'All types' : 'Semua tipe' },
  { value: 'event-reflection', label: 'Event Reflection' },
  { value: 'sharing-journey', label: 'Sharing Journey' },
  { value: 'insight', label: 'Insight' },
  { value: 'practice', label: 'Practice' },
])

const sortOptions = computed(() => [
  { value: 'newest', label: isEn.value ? 'Newest' : 'Terbaru' },
  { value: 'oldest', label: isEn.value ? 'Oldest' : 'Terlama' },
])

const teks = computed(() => isEn.value
  ? {
      eyebrow: 'Journal', judul: 'Stories that accompany the journey.',
      intro: 'Reflections written by event participants — experiences, perspectives, and good practices shared by our Contributors and reviewed by Editors.',
      tipe: 'Type', event: 'Event', urutkan: 'Sort', cari: 'Search journal titles or content',
      hitung: (n: number) => `${n} journal${n === 1 ? '' : 's'} found`,
      semuaEvent: 'All events', baca: 'Read more', kosong: 'No journal matches your search or filter yet.',
    }
  : {
      eyebrow: 'Jurnal', judul: 'Cerita yang menemani perjalanan.',
      intro: 'Tulisan hasil refleksi peserta acara, sharing pengalaman, pandangan, dan praktik baik dari para Kontributor dan direview oleh Editor.',
      tipe: 'Tipe jurnal', event: 'Nama event', urutkan: 'Urutkan', cari: 'Cari judul atau isi jurnal',
      hitung: (n: number) => `${n} jurnal ditemukan`,
      semuaEvent: 'Semua event', baca: 'Baca lebih lanjut', kosong: 'Belum ada jurnal yang sesuai dengan pencarian atau filter Anda.',
    })

// Daftar jurnal kini dibaca dari database lewat /api/jurnal — dulu array tetap di
// berkas ini, yang sudah menyimpang dari daftar admin di `shared/jurnal.ts`
// (judul sama, isi berbeda, dan tidak ada yang memberi tahu saat keduanya berbeda).
// Endpoint hanya mengirim yang berstatus `terbit`; draft dan yang sedang direview
// tidak pernah sampai ke sini.
//
// Tanpa `await`, seperti halaman event: dengan await, <script setup> jadi async dan
// Vue menahan seluruh komponen sampai fetch selesai — digabung pageTransition
// 'out-in', itu yang membuat layar kosong sesaat tiap berpindah bahasa.
const { data: hasil, status: muatStatus } = useFetch('/api/jurnal')

const memuatAwal = computed(() => muatStatus.value === 'pending' && !hasil.value)

/** Bentuk kartu di layar, disusun dari baris database. Nama kolomnya sengaja
    dipertahankan seperti versi statis (title/excerpt/contributor/…) supaya seluruh
    template dan CSS `.journal-card` tidak perlu ikut berubah. */
const journals = computed(() =>
  (hasil.value?.data ?? []).map(row => ({
    type: row.tipe as JournalType,
    title: (isEn.value ? (row.judulEn ?? row.judul) : row.judul) ?? '',
    excerpt: (isEn.value ? (row.ringkasanEn ?? row.ringkasan) : row.ringkasan) ?? '',
    contributor: row.kontributor,
    role: row.kontributorPeran ?? '',
    date: tanggalPanjang(row.tanggal),
    dateValue: String(row.tanggal ?? '').slice(0, 10),
    event: row.kegiatanJudul ?? '',
    slug: row.slug,
    path: `${base.value}/jurnal/${row.slug}`,
  })),
)

/** Tanggal terbit dalam WIB. Disimpan sebagai timestamp UTC; tanpa zona waktu,
    tulisan yang terbit pukul 06.00 pagi tampil bertanggal sehari sebelumnya. */
function tanggalPanjang(nilai: string | number | null) {
  if (!nilai) return ''
  return new Intl.DateTimeFormat(isEn.value ? 'en-GB' : 'id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta',
  }).format(new Date(nilai))
}

const eventOptions = computed(() => [
  { value: 'all', label: teks.value.semuaEvent },
  ...[...new Set(journals.value.filter(journal => journal.type === 'event-reflection').map(journal => journal.event))]
    .filter(Boolean)
    .map(event => ({ value: event, label: event })),
])
const typeLabel = (type: JournalType) => types.value.find(item => item.value === type)?.label ?? type
const typeIcon = (type: JournalType) => ({
  'event-reflection': '◫',
  'sharing-journey': '↝',
  insight: '✦',
  practice: '✓',
}[type])

const filteredJournals = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  return journals.value
    .filter(journal => selectedType.value === 'all' || journal.type === selectedType.value)
    .filter(journal => selectedType.value !== 'event-reflection' || selectedEvent.value === 'all' || journal.event === selectedEvent.value)
    .filter(journal => !keyword || `${journal.title} ${journal.excerpt}`.toLowerCase().includes(keyword))
    .sort((a, b) => sortOrder.value === 'newest' ? b.dateValue.localeCompare(a.dateValue) : a.dateValue.localeCompare(b.dateValue))
})

// Render bertahap. Sumbernya `filteredJournals` yang SUDAH tersaring, jadi
// pencarian & filter tetap menjangkau seluruh jurnal meski baru sebagian kartu
// yang pernah tergambar.
const { items: journalsTampil, sentinel, adaLagi, sisa, muatLagi } = useInfiniteList(filteredJournals, { awal: 9, tambah: 6 })

// ── Sorotan dari log kerja ───────────────────────────────────────────────────
//
// Log master menautkan baris "diterbitkan" ke halaman ini dengan `?sorot={slug}`.
// Yang dibutuhkan di ujung tautan itu bukan sekadar sampai ke halamannya, tapi tahu
// KARTU YANG MANA di antara belasan — jadi kartunya digulir ke tengah layar lalu
// berkedip dua kali dalam satu detik.
//
// Kedipan, bukan sorotan yang menetap: yang menetap harus dimatikan oleh sesuatu
// (klik di luar, jeda waktu, tombol tutup), dan tiap-tiapnya adalah keadaan
// tambahan yang harus diurus. Yang berkedip sekali lalu selesai tidak meninggalkan
// apa pun untuk dibersihkan.
const sorot = computed(() => String(route.query.sorot ?? ''))
const kartuSorot = ref<HTMLElement | null>(null)

const pasangKartu = (el: Element | ComponentPublicInstance | null, slug: string) => {
  if (slug === sorot.value && el instanceof HTMLElement) kartuSorot.value = el
}

// Menunggu kartunya benar-benar ada. `journalsTampil` terisi sesudah useFetch
// selesai, jadi onMounted saja akan menggulir ke elemen yang belum tergambar.
// `flush: 'post'` supaya DOM-nya sudah diperbarui saat callback berjalan.
watch(kartuSorot, (el) => {
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
}, { flush: 'post' })
</script>

<template>
  <main class="journal-page">
    <section class="journal-hero">
      <div class="container">
        <div class="eyebrow">{{ teks.eyebrow }}</div>
        <h1>{{ teks.judul }}</h1>
        <p>{{ teks.intro }}</p>

        <div class="journal-controls" role="group" :aria-label="teks.tipe">
          <div class="control-field control-type">
            <span>{{ teks.tipe }}</span>
            <USelect v-model="selectedType" :items="types" class="w-full" />
          </div>
          <div v-if="selectedType === 'event-reflection'" class="control-field control-event">
            <span>{{ teks.event }}</span>
            <USelect v-model="selectedEvent" :items="eventOptions" class="w-full" />
          </div>
          <UInput
            v-model="search"
            type="search"
            icon="i-lucide-search"
            :placeholder="teks.cari"
            class="search-field"
          />
          <div class="sort-field">
            <span>{{ teks.urutkan }}</span>
            <USelect v-model="sortOrder" :items="sortOptions" class="w-full" />
          </div>
        </div>
      </div>
    </section>

    <section class="journal-listing">
      <div class="container">
        <!-- Saat muat pertama, hitungan disembunyikan. Tanpa ini yang terbaca
             sekejap adalah "0 jurnal ditemukan" — kalimat yang artinya "tidak ada
             apa-apa di sini", padahal datanya sedang dalam perjalanan. -->
        <p v-if="memuatAwal" class="journal-count">&nbsp;</p>
        <p v-else class="journal-count">{{ teks.hitung(filteredJournals.length) }}</p>

        <div class="journal-grid">
          <article
            v-for="journal in journalsTampil"
            :key="journal.slug"
            :ref="(el) => pasangKartu(el, journal.slug)"
            class="journal-card"
            :class="journal.slug === sorot ? 'is-sorot' : ''"
          >
            <div class="journal-card-icon" :class="`icon-${journal.type}`" :aria-label="typeLabel(journal.type)">{{ typeIcon(journal.type) }}</div>
            <div class="journal-type">{{ typeLabel(journal.type) }}</div>
            <!-- Nama event DISEMBUNYIKAN sementara atas permintaan — dua baris
                 huruf kapital bertumpuk (kategori lalu nama event) terbaca berat
                 di kepala kartu. Datanya tetap utuh: `kegiatanId` tersimpan, kolom
                 pilihannya tetap ada di halaman sunting admin, dan penyaring
                 "Nama event" di atas tetap bekerja. Kembalikan barisnya begitu
                 kepala kartunya ditata ulang.
            <div v-if="journal.event" class="journal-event">{{ journal.event }}</div>
            -->
            <h2>{{ journal.title }}</h2>
            <p>{{ journal.excerpt }}</p>
            <div class="journal-meta"><strong>{{ journal.contributor }}</strong> · {{ journal.role }}<br><time :datetime="journal.dateValue">{{ journal.date }}</time></div>
            <UButton
              :to="journal.path"
              color="secondary"
              variant="solid"
              trailing-icon="i-lucide-arrow-right"
              class="mt-auto"
            >
              {{ teks.baca }}
            </UButton>
          </article>
        </div>

        <!-- Penanda kaki daftar: begitu masuk viewport, kartu berikutnya dimuat. -->
        <div v-if="adaLagi" ref="sentinel" class="journal-more">
          <UButton color="neutral" variant="link" @click="muatLagi">
            {{ isEn ? `Load ${sisa} more` : `Muat ${sisa} jurnal lagi` }}
          </UButton>
        </div>
        <p v-if="!filteredJournals.length && !memuatAwal" class="journal-empty">{{ teks.kosong }}</p>
      </div>
    </section>
  </main>
</template>
