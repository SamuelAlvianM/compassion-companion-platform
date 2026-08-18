<script setup lang="ts">
// Bagian agregasi dashboard admin.
//
// Tanpa judul bagian dan tanpa kalimat pengantar: ia berdiri langsung di bawah
// baris ringkasan dashboard, dan satu judul "Agregasi" hanya menamai bentuk
// datanya — bukan menjawab apa pun yang dibawa orang ke halaman ini.
//
// Aturan yang dipegang: TIDAK ADA ANGKA YANG BUNTU. Tiap kartu dan tiap batang
// yang punya baris pembentuk bisa diklik, dan kliknya membuka daftar itu beserta
// tautan ke tempat barisnya bisa dibuka. Grafik yang cuma bisa dipandang memaksa
// orang menebak lalu memverifikasi sendiri di halaman lain.

interface EventAgregat {
  id: string
  judul: string
  fase: string
  kuota: number | null
  total: number
  terpakai: number
  baru: number
  proses: number
  konfirmasi: number
  batal: number
  sesi: number
  materi: number
  galeri: number
  referensi: number
}

interface Berkas {
  jumlah: number
  bytes: number
  daftar: { id: string, nama: string, mime: string, bytes: number, url: string }[]
}

const { data, status, error, refresh } = useFetch('/api/admin/agregasi')

defineExpose({ refresh })

const events = computed(() => (data.value?.event ?? []) as EventAgregat[])
const bulan = computed(() => data.value?.bulan ?? [])
const kunjungan = computed(() => data.value?.kunjungan ?? [])
const eventPer = computed(() => data.value?.eventPer)
const jurnal = computed(() => data.value?.jurnal)
const member = computed(() => data.value?.member)
const video = computed(() => (data.value?.video ?? { jumlah: 0, bytes: 0, daftar: [] }) as Berkas)
const dokumen = computed(() => (data.value?.dokumen ?? { jumlah: 0, bytes: 0, daftar: [] }) as Berkas)
const ringkas = computed(() => data.value?.ringkas)

/** Judul event dipangkas untuk sumbu grafik: judul penuh tetap muncul di tooltip
    dan di panel detail, tapi sebagai label sumbu ia menghabiskan lebar yang
    seharusnya jadi tinggi batang. */
const pendek = (teks: string, batas = 22) =>
  teks.length > batas ? `${teks.slice(0, batas - 1)}…` : teks

const ukuran = (bytes: number) => bytes >= 1048576
  ? `${(bytes / 1048576).toFixed(1)} MB`
  : `${Math.max(1, Math.round(bytes / 1024))} KB`

const WARNA_STATUS: Record<string, string> = {
  baru: '#E1B032',
  proses: '#AC8158',
  konfirmasi: '#2B4028',
  batal: '#b9b2a6',
}

// ── Panel detail ─────────────────────────────────────────────────────────────
interface BarisDetail { label: string, nilai: string | number, ke?: string, luar?: string }

const detail = ref<{
  judul: string
  keterangan: string
  baris: BarisDetail[]
  aksi?: { label: string, ke: string }
} | null>(null)

const bukaEvent = (id: string) => {
  const e = events.value.find(x => x.id === id)
  if (!e) return
  detail.value = {
    judul: e.judul,
    keterangan: `Fase ${e.fase} · ${e.sesi} sesi · ${e.kuota ? `kuota ${e.kuota}` : 'tanpa kuota'}`,
    baris: [
      { label: 'Pendaftar baru', nilai: e.baru },
      { label: 'Sedang diproses', nilai: e.proses },
      { label: 'Terkonfirmasi', nilai: e.konfirmasi },
      { label: 'Dibatalkan', nilai: e.batal },
      { label: 'Kursi terpakai', nilai: e.kuota ? `${e.terpakai} dari ${e.kuota}` : e.terpakai },
    ],
    aksi: { label: 'Buka event ini', ke: `/admin/event/${e.id}` },
  }
}

const bukaBulan = (kunci: string) => {
  const b = bulan.value.find(x => x.kunci === kunci)
  if (!b) return
  detail.value = {
    judul: `Pendaftaran ${b.label}`,
    keterangan: b.total
      ? `${b.total} pendaftaran masuk pada bulan ini, tersebar di ${b.perEvent.length} event.`
      : 'Tidak ada pendaftaran yang masuk pada bulan ini.',
    baris: b.perEvent.map(e => ({
      label: e.judul,
      nilai: `${e.jumlah} pendaftar`,
      ke: `/admin/event/${e.id}`,
    })),
  }
}

const bukaEmberEvent = (kunci: string) => {
  const g = (eventPer.value?.[satuan.value] ?? []).find(x => x.kunci === kunci)
  if (!g) return
  detail.value = {
    judul: `Event · ${g.label}`,
    keterangan: `${g.jumlah} event dimulai pada periode ini.`,
    baris: g.isi.map(e => ({
      label: e.judul,
      nilai: `${e.jumlah} pendaftar`,
      ke: `/admin/event/${e.id}`,
    })),
  }
}

/** Daftar berkas — video maupun dokumen. Tiap baris membuka berkasnya sendiri di
    tab baru; itu satu-satunya "detail" yang berarti untuk sebuah berkas. */
const bukaBerkas = (jenis: 'video' | 'dokumen') => {
  const b = jenis === 'video' ? video.value : dokumen.value
  detail.value = {
    judul: jenis === 'video' ? 'Video tersimpan' : 'Dokumen tersimpan',
    keterangan: b.jumlah
      ? `${b.jumlah} berkas · ${ukuran(b.bytes)} total. Klik satu baris untuk membukanya.`
      : 'Belum ada berkas jenis ini di pustaka media.',
    baris: b.daftar.map(m => ({ label: m.nama, nilai: ukuran(m.bytes), luar: m.url })),
  }
}

const bukaJurnal = () => {
  const j = jurnal.value
  if (!j) return
  detail.value = {
    judul: 'Jurnal yang sudah dibuat',
    keterangan: `${j.total} jurnal · ${j.terbit} terbit, ${j.draft} draft.`,
    baris: j.daftar.map(x => ({
      label: x.judul,
      nilai: x.status === 'Published' ? 'Terbit' : 'Draft',
      ke: `/admin/jurnal/${x.id}`,
    })),
    aksi: { label: 'Buka daftar jurnal', ke: '/admin/jurnal' },
  }
}

const bukaOrangIkut = () => {
  detail.value = {
    judul: 'Orang yang mengikuti event',
    keterangan: 'Dihitung per orang, bukan per pendaftaran — satu orang yang ikut tiga event tetap satu. Yang dibatalkan tidak dihitung.',
    baris: events.value
      .filter(e => e.terpakai > 0)
      .map(e => ({ label: e.judul, nilai: `${e.terpakai} peserta`, ke: `/admin/event/${e.id}` })),
  }
}

/**
 * Pembuat penangan klik untuk titik Highcharts.
 *
 * Ditulis `function`, bukan panah: Highcharts memanggilnya dengan `this` berisi
 * titik yang diklik, dan panah tidak punya `this` sendiri untuk diikat.
 */
const klikTitik = (buka: (kunci: string) => void) => ({
  click(this: any) {
    const kunci = this.options?.custom?.kunci
    if (kunci) buka(kunci)
  },
})

// ── Kartu angka ──────────────────────────────────────────────────────────────
// Urutannya mengikuti urutan yang diminta peninjau, bukan urutan alfabet atau
// besar-kecil angkanya.
const kartu = computed(() => {
  const r = ringkas.value
  if (!r) return []
  return [
    {
      kunci: 'kunjungan',
      label: 'Kunjungan website',
      // Angka besarnya berapa KALI halaman dibuka; kalimat di bawahnya berapa
      // ORANG. Keduanya dihitung terpisah di server — yang kedua dari sidik harian
      // yang tidak menyimpan apa pun tentang orangnya.
      nilai: r.kunjunganTotal,
      catatan: `${r.orangTotal} orang mengunjungi website kita`,
      ikon: 'i-lucide-globe',
    },
    {
      kunci: 'ikut',
      label: 'Orang mengikuti event',
      nilai: r.ikutEvent,
      catatan: `${r.ikutEventKonfirmasi} sudah terkonfirmasi · ${r.pendaftaranIkut} pendaftaran`,
      ikon: 'i-lucide-user-round-check',
      klik: bukaOrangIkut,
    },
    {
      kunci: 'member',
      label: 'Member',
      nilai: member.value?.total ?? 0,
      catatan: `${member.value?.aktif ?? 0} akun aktif`,
      ikon: 'i-lucide-users',
      ke: '/admin/members',
    },
    {
      kunci: 'jurnal',
      label: 'Jurnal dibuat',
      nilai: jurnal.value?.total ?? 0,
      catatan: `${jurnal.value?.terbit ?? 0} terbit · ${jurnal.value?.draft ?? 0} draft`,
      ikon: 'i-lucide-notebook-pen',
      klik: bukaJurnal,
    },
    {
      kunci: 'video',
      label: 'Video',
      nilai: video.value.jumlah,
      catatan: video.value.jumlah ? `${ukuran(video.value.bytes)} tersimpan` : 'Belum ada video',
      ikon: 'i-lucide-play',
      klik: () => bukaBerkas('video'),
    },
    {
      kunci: 'dokumen',
      label: 'Dokumen',
      nilai: dokumen.value.jumlah,
      catatan: dokumen.value.jumlah ? `${ukuran(dokumen.value.bytes)} tersimpan` : 'Belum ada dokumen',
      ikon: 'i-lucide-file-text',
      klik: () => bukaBerkas('dokumen'),
    },
  ]
})

// ── Opsi grafik ──────────────────────────────────────────────────────────────
// Semua `computed`: begitu `refresh()` membawa data baru, opsinya tersusun ulang
// dan pembungkusnya memanggil chart.update().

const opsiKunjungan = computed(() => ({
  chart: { type: 'areaspline' },
  xAxis: { categories: kunjungan.value.map(k => k.label), labels: { style: { fontSize: '11px' } } },
  yAxis: { allowDecimals: false, title: { text: 'Kunjungan' } },
  plotOptions: { areaspline: { fillOpacity: 0.18, marker: { enabled: true, radius: 4 } } },
  // Dua deret, karena keduanya dibaca bersamaan: jarak antara keduanya yang
  // memberi tahu apakah satu orang membuka banyak halaman atau banyak orang
  // membuka satu halaman.
  series: [
    { name: 'Halaman dibuka', color: '#AC8158', data: kunjungan.value.map(k => k.total) },
    { name: 'Orang', color: '#2B4028', data: kunjungan.value.map(k => k.orang) },
  ],
}))

const opsiBulan = computed(() => ({
  chart: { type: 'areaspline' },
  xAxis: { categories: bulan.value.map(b => b.label), labels: { style: { fontSize: '11px' } } },
  yAxis: { allowDecimals: false, title: { text: 'Pendaftaran' } },
  legend: { enabled: false },
  plotOptions: {
    areaspline: {
      fillOpacity: 0.18,
      marker: { enabled: true, radius: 4 },
      cursor: 'pointer',
      point: { events: klikTitik(bukaBulan) },
    },
  },
  series: [{
    name: 'Pendaftaran',
    color: '#AC8158',
    data: bulan.value.map(b => ({ y: b.total, custom: { kunci: b.kunci } })),
  }],
}))

const opsiPendaftar = computed(() => ({
  chart: { type: 'column' },
  xAxis: {
    categories: events.value.map(e => pendek(e.judul)),
    labels: { style: { fontSize: '11px' } },
  },
  yAxis: { allowDecimals: false, title: { text: 'Pendaftar' } },
  plotOptions: {
    column: {
      stacking: 'normal' as const,
      borderRadius: 3,
      cursor: 'pointer',
      point: { events: klikTitik(bukaEvent) },
    },
  },
  tooltip: { shared: false, headerFormat: '<b>{point.key}</b><br>' },
  series: (['konfirmasi', 'proses', 'baru', 'batal'] as const).map(s => ({
    name: { konfirmasi: 'Terkonfirmasi', proses: 'Diproses', baru: 'Baru', batal: 'Batal' }[s],
    color: WARNA_STATUS[s],
    data: events.value.map(e => ({ y: e[s], custom: { kunci: e.id } })),
  })),
}))

/** Satuan waktu untuk hitungan event. Tiga tombol, bukan tiga grafik: pertanyaannya
    satu ("berapa event"), yang berganti cuma lebar embernya. */
const satuan = ref<'bulan' | 'minggu' | 'tahun'>('bulan')

const SATUAN = [
  { value: 'bulan' as const, label: 'Bulan' },
  { value: 'minggu' as const, label: 'Minggu' },
  { value: 'tahun' as const, label: 'Tahun' },
]

const emberEvent = computed(() => eventPer.value?.[satuan.value] ?? [])

const opsiEventPer = computed(() => ({
  chart: { type: 'column' },
  xAxis: { categories: emberEvent.value.map(g => g.label), labels: { style: { fontSize: '11px' } } },
  yAxis: { allowDecimals: false, title: { text: 'Event' } },
  legend: { enabled: false },
  plotOptions: {
    column: {
      borderRadius: 3,
      cursor: 'pointer',
      point: { events: klikTitik(bukaEmberEvent) },
    },
  },
  series: [{
    name: 'Event',
    color: '#687064',
    data: emberEvent.value.map(g => ({ y: g.jumlah, custom: { kunci: g.kunci } })),
  }],
}))

const kosong = computed(() => !events.value.length)

const tinggiPendaftar = computed(() => Math.max(280, events.value.length * 46 + 120))
</script>

<template>
  <section>
    <div class="mb-4 flex justify-end">
      <UButton
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="subtle"
        size="sm"
        :loading="status === 'pending'"
        @click="refresh()"
      >
        Hitung ulang
      </UButton>
    </div>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Gagal memuat agregasi"
      :description="error.message"
    />

    <template v-else>
      <!-- Enam angka kunci. Yang punya baris pembentuk bisa diklik; yang tidak
           (kunjungan halaman) sengaja tidak diberi kursor pointer, supaya tidak
           menjanjikan detail yang memang tidak ada. -->
      <div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <component
          :is="k.ke ? 'NuxtLink' : (k.klik ? 'button' : 'div')"
          v-for="k in kartu"
          :key="k.kunci"
          :to="k.ke"
          :type="k.klik ? 'button' : undefined"
          class="rounded-xl border border-cc-stone-200 bg-white p-4 text-left transition-colors"
          :class="(k.ke || k.klik) ? 'hover:border-cc-brown-400' : ''"
          @click="k.klik?.()"
        >
          <div class="flex items-start justify-between gap-2">
            <p class="text-xs font-semibold uppercase tracking-wider text-cc-stone-500">{{ k.label }}</p>
            <UIcon :name="k.ikon" class="size-4 shrink-0 text-cc-brown-500" />
          </div>
          <p class="mt-1 font-serif text-4xl leading-none text-cc-green-800">{{ k.nilai }}</p>
          <p class="mt-2 text-xs text-cc-stone-500">{{ k.catatan }}</p>
        </component>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <UCard :ui="{ body: 'p-4' }">
          <h3 class="font-serif text-xl text-cc-green-800">Kunjungan website per bulan</h3>
          <p class="mb-2 text-xs text-cc-stone-500">
            Orang dibedakan tanpa menyimpan apa pun tentang dirinya; yang datang di dua hari berbeda terhitung dua.
          </p>
          <GrafikHighcharts :options="opsiKunjungan" :tinggi="300" />
        </UCard>

        <UCard :ui="{ body: 'p-4' }">
          <h3 class="font-serif text-xl text-cc-green-800">Pendaftar per bulan</h3>
          <p class="mb-2 text-xs text-cc-stone-500">Dua belas bulan terakhir, waktu Jakarta. Klik titiknya untuk rincian per event.</p>
          <GrafikHighcharts :options="opsiBulan" :tinggi="300" />
        </UCard>

        <UCard :ui="{ body: 'p-4' }" class="lg:col-span-2">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 class="font-serif text-xl text-cc-green-800">Jumlah event</h3>
              <p class="mb-2 text-xs text-cc-stone-500">
                Dikelompokkan menurut tanggal mulai acaranya. Periode tanpa event tidak digambar.
              </p>
            </div>
            <div class="flex gap-1 rounded-full bg-cc-stone-100 p-1">
              <button
                v-for="s in SATUAN"
                :key="s.value"
                type="button"
                class="rounded-full px-3 py-1 text-xs font-semibold transition-colors"
                :class="satuan === s.value ? 'bg-cc-green-800 text-white' : 'text-cc-stone-600 hover:bg-white'"
                :aria-pressed="satuan === s.value"
                @click="satuan = s.value"
              >
                {{ s.label }}
              </button>
            </div>
          </div>
          <GrafikHighcharts :options="opsiEventPer" :tinggi="300" />
        </UCard>

        <UCard v-if="!kosong" :ui="{ body: 'p-4' }" class="lg:col-span-2">
          <h3 class="font-serif text-xl text-cc-green-800">Event dan pesertanya</h3>
          <p class="mb-2 text-xs text-cc-stone-500">
            Batang yang tinggi tapi hijaunya tipis berarti banyak yang mendaftar dan sedikit yang sudah dikonfirmasi.
          </p>
          <GrafikHighcharts :options="opsiPendaftar" :tinggi="tinggiPendaftar" />
        </UCard>
      </div>
    </template>

    <!-- Panel detail: satu tempat untuk semua angka, isinya ditentukan yang diklik.
         Slideover, bukan modal — ia tidak menutup grafik yang barusan diklik, jadi
         angka di panel bisa dicocokkan dengan bentuk di belakangnya. -->
    <USlideover
      :open="Boolean(detail)"
      :title="detail?.judul ?? ''"
      :description="detail?.keterangan"
      @update:open="detail = null"
    >
      <template #body>
        <p v-if="!detail?.baris.length" class="text-sm text-cc-stone-500">
          Tidak ada baris yang menyusun angka ini.
        </p>

        <ul v-else class="divide-y divide-cc-stone-200">
          <li v-for="b in detail.baris" :key="b.label" class="flex items-center justify-between gap-3 py-2.5">
            <NuxtLink
              v-if="b.ke"
              :to="b.ke"
              class="min-w-0 flex-1 break-words text-sm font-medium text-cc-green-800 hover:text-cc-brown-500 hover:underline"
              @click="detail = null"
            >
              {{ b.label }}
            </NuxtLink>
            <!-- Berkas dibuka di tab baru: panel ini biasanya dipakai sambil
                 memeriksa beberapa berkas berturut-turut, dan berpindah halaman
                 akan menutupnya setiap kali. -->
            <a
              v-else-if="b.luar"
              :href="b.luar"
              target="_blank"
              rel="noopener"
              class="min-w-0 flex-1 break-words text-sm font-medium text-cc-green-800 hover:text-cc-brown-500 hover:underline"
            >
              {{ b.label }}
            </a>
            <span v-else class="min-w-0 flex-1 break-words text-sm text-cc-stone-600">{{ b.label }}</span>
            <span class="shrink-0 text-sm font-semibold tabular-nums text-cc-green-800">{{ b.nilai }}</span>
          </li>
        </ul>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="detail = null">Tutup</UButton>
          <UButton
            v-if="detail?.aksi"
            :to="detail.aksi.ke"
            color="secondary"
            trailing-icon="i-lucide-arrow-right"
            @click="detail = null"
          >
            {{ detail.aksi.label }}
          </UButton>
        </div>
      </template>
    </USlideover>
  </section>
</template>
