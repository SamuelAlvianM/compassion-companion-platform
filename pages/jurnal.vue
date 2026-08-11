<script setup lang="ts">
const route = useRoute()
const isEn = computed(() => route.path.startsWith('/en'))

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
      intro: 'Experiences, reflections, insights, and practices growing out of encounter and service.',
      tipe: 'Type', event: 'Event', urutkan: 'Sort', cari: 'Search journal titles or content',
      hitung: (n: number) => `${n} journal${n === 1 ? '' : 's'} found`,
      semuaEvent: 'All events', baca: 'Read more', kosong: 'No journal matches your search or filter yet.',
    }
  : {
      eyebrow: 'Jurnal', judul: 'Cerita yang menemani perjalanan.',
      intro: 'Pengalaman, refleksi, insight, dan praktik yang bertumbuh dari perjumpaan serta pelayanan.',
      tipe: 'Tipe jurnal', event: 'Nama event', urutkan: 'Urutkan', cari: 'Cari judul atau isi jurnal',
      hitung: (n: number) => `${n} jurnal ditemukan`,
      semuaEvent: 'Semua event', baca: 'Baca lebih lanjut', kosong: 'Belum ada jurnal yang sesuai dengan pencarian atau filter Anda.',
    })

const journals = [
  { type: 'sharing-journey' as JournalType, title: 'Menemukan Arah dalam Kebersamaan', excerpt: 'Ada masa ketika pertanyaan siapa saya terasa sederhana, tetapi jawabannya justru membawa saya pada perjalanan yang panjang. Di dalam kebersamaan, saya perlahan belajar mengenali arah.', contributor: 'Imanuel Ananta', role: 'Peserta rekoleksi', date: '12 Mei 2026', dateValue: '2026-05-12', event: '', path: '/id/reflection-journey' },
  { type: 'event-reflection' as JournalType, title: 'Ketika Saya Belajar Mendengarkan', excerpt: 'Saya selalu mengira pemimpin harus paling cepat memberi jawaban. Ternyata, terkadang yang dibutuhkan adalah kehadiran yang sungguh mendengarkan.', contributor: 'Nicholas', role: 'Peserta program', date: '1 Mei 2026', dateValue: '2026-05-01', event: 'Listening as Leadership', path: '/id/sharing-mendengar-dengan-hadir' },
  { type: 'event-reflection' as JournalType, title: 'Membawa Kegelisahan kepada Tuhan', excerpt: 'Dari kegelisahan itu saya belajar melihat keadaan hati saya dengan jujur dan penuh belas kasih. Saya tidak perlu segera menyelesaikan semuanya sendiri.', contributor: 'Anna', role: 'Peserta program', date: '20 Apr 2026', dateValue: '2026-04-20', event: 'Leadership with Compassion', path: '/id/sharing-menata-kegelisahan' },
  { type: 'insight' as JournalType, title: 'Kehadiran yang Membuka Ruang', excerpt: 'Mendampingi tidak selalu berarti menawarkan jawaban. Kadang, yang paling dibutuhkan seseorang adalah ruang aman untuk melihat pengalamannya sendiri.', contributor: 'Henk T. Sengkey', role: 'Leadership Coach', date: '8 Apr 2026', dateValue: '2026-04-08', event: '', path: '/id/reflection-journey' },
  { type: 'practice' as JournalType, title: 'Tiga Menit untuk Mendengarkan Diri', excerpt: 'Latihan sederhana ini dapat dilakukan sebelum rapat, pelayanan, atau percakapan penting: berhenti, bernapas, dan memberi nama pada keadaan hati.', contributor: 'Tim Compassionate Companion', role: 'Praktik mingguan', date: '28 Mar 2026', dateValue: '2026-03-28', event: '', path: '/id/reflection-journey' },
  { type: 'event-reflection' as JournalType, title: 'Berani Hadir dalam Percakapan Sulit', excerpt: 'Saya belajar bahwa keberanian bukan soal bicara paling keras, melainkan bertahan hadir ketika percakapan mulai terasa tidak nyaman.', contributor: 'Maria', role: 'Peserta program', date: '15 Mar 2026', dateValue: '2026-03-15', event: 'Listening as Leadership', path: '/id/sharing-mendengar-dengan-hadir' },
]

const eventOptions = computed(() => [
  { value: 'all', label: teks.value.semuaEvent },
  ...[...new Set(journals.filter(journal => journal.type === 'event-reflection').map(journal => journal.event))]
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
  return journals
    .filter(journal => selectedType.value === 'all' || journal.type === selectedType.value)
    .filter(journal => selectedType.value !== 'event-reflection' || selectedEvent.value === 'all' || journal.event === selectedEvent.value)
    .filter(journal => !keyword || `${journal.title} ${journal.excerpt}`.toLowerCase().includes(keyword))
    .sort((a, b) => sortOrder.value === 'newest' ? b.dateValue.localeCompare(a.dateValue) : a.dateValue.localeCompare(b.dateValue))
})

// Render bertahap. Sumbernya `filteredJournals` yang SUDAH tersaring, jadi
// pencarian & filter tetap menjangkau seluruh jurnal meski baru sebagian kartu
// yang pernah tergambar.
const { items: journalsTampil, sentinel, adaLagi, sisa, muatLagi } = useInfiniteList(filteredJournals, { awal: 9, tambah: 6 })
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
        <p class="journal-count">{{ teks.hitung(filteredJournals.length) }}</p>
        <div class="journal-grid">
          <article v-for="journal in journalsTampil" :key="journal.title" class="journal-card">
            <div class="journal-card-icon" :class="`icon-${journal.type}`" :aria-label="typeLabel(journal.type)">{{ typeIcon(journal.type) }}</div>
            <div class="journal-type">{{ typeLabel(journal.type) }}</div>
            <div v-if="journal.event" class="journal-event">{{ journal.event }}</div>
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
        <p v-if="!filteredJournals.length" class="journal-empty">{{ teks.kosong }}</p>
      </div>
    </section>
  </main>
</template>
