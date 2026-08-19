<script setup lang="ts">
// Tab "Daftar peserta" pada halaman event admin.
//
// Statusnya dimajukan manual, satu langkah per klik: baru -> proses -> konfirmasi.
// Tidak ada perpindahan otomatis, karena tiap langkah mewakili pekerjaan nyata
// (menghubungi orangnya, memverifikasi pembayaran) yang hanya admin yang tahu
// sudah selesai atau belum.
//
// `batal` berarti orangnya benar-benar tidak jadi ikut — bukan sekadar tertunda.
// Karena itu ia bisa dianulir: yang berubah pikiran dikembalikan ke status terakhir
// sebelum batal, bukan diulang dari awal.
//
// Bentuknya tabel, bukan kartu. Kartu masuk akal ketika tiap baris dibaca sebagai
// satu orang; yang sebenarnya dikerjakan di sini membandingkan kolom yang sama pada
// banyak orang — siapa yang belum punya akun, siapa yang belum dikonfirmasi — dan
// itu hanya terbaca kalau kolomnya sejajar.

const props = defineProps<{
  kegiatanId: string
  /**
   * Chip status yang sudah terpilih saat tab ini dibuka, dari `?status=` di alamat.
   *
   * Dipakai dashboard: yang mengklik "12 perlu dikonfirmasi" pada sebuah event
   * mendarat langsung di daftar dua belas orang itu, bukan di daftar semua
   * pendaftar yang lalu harus disaring ulang dengan tangan.
   */
  statusAwal?: string
}>()

/**
 * Terbukanya modal "Tambah peserta" dikendalikan induk.
 *
 * Tombolnya duduk di kepala kartu, sebaris dengan judul "Daftar peserta" — dan
 * kepala kartu itu milik induk. Bentuknya sama persis dengan tab peserta pada event
 * baru (PesertaDraf), supaya tombol yang sama tidak berpindah tempat hanya karena
 * eventnya sudah tersimpan.
 */
const tambahModal = defineModel<boolean>('bukaTambah', { default: false })

// Tiap status membawa ikonnya sendiri supaya chip terbaca sekilas tanpa membaca
// labelnya — lima tombol yang bentuknya identik menuntut dibaca satu per satu.
const STATUS = [
  { key: 'semua', label: 'Semua', warna: 'neutral' as const, ikon: 'i-lucide-users' },
  { key: 'baru', label: 'Perlu diproses', warna: 'warning' as const, ikon: 'i-lucide-inbox' },
  { key: 'proses', label: 'Perlu dikonfirmasi', warna: 'secondary' as const, ikon: 'i-lucide-loader' },
  { key: 'konfirmasi', label: 'Terkonfirmasi', warna: 'primary' as const, ikon: 'i-lucide-check' },
  { key: 'batal', label: 'Batal', warna: 'neutral' as const, ikon: 'i-lucide-x' },
]

/**
 * Warna chip aktif, ditulis sebagai kelas utuh — bukan disusun dari potongan
 * seperti `bg-cc-${warna}-500`. Tailwind memindai berkas sebagai teks; nama kelas
 * yang baru terbentuk saat runtime tidak pernah ikut diterbitkan, dan chipnya jadi
 * transparan tanpa satu pun galat.
 */
const warnaChip: Record<string, string> = {
  neutral: 'bg-cc-stone-700 text-white',
  warning: 'bg-cc-brown-500 text-white',
  secondary: 'bg-cc-brown-600 text-white',
  primary: 'bg-cc-green-800 text-white',
}

const warnaStatus = (s: string) => STATUS.find(x => x.key === s)?.warna ?? 'neutral'
const labelStatus = (s: string) => STATUS.find(x => x.key === s)?.label ?? s

// Nilai asing diabaikan, jatuh ke "semua": alamat yang salah ketik jangan sampai
// membuka daftar tanpa satu chip pun menyala, karena yang terlihat lalu sama
// persis dengan daftar kosong.
const tab = ref(STATUS.some(s => s.key === props.statusAwal) ? props.statusAwal! : 'semua')
const cari = ref('')
const galat = ref('')
const sibukId = ref('')

const { data, refresh, status: muatStatus } = useFetch(
  () => `/api/admin/events/${props.kegiatanId}/peserta`,
  {
    query: { status: tab, cari },
    // Cookie tidak ikut terbawa $fetch saat SSR; tanpa penerusan ini render
    // pertama selalu 401.
    headers: import.meta.server ? useRequestHeaders(['cookie']) : undefined,
  },
)

const peserta = computed(() => data.value?.data ?? [])
// Tipe kembalian ditulis di computed-nya, bukan di-cast pada cabang `??`. Kalau
// hanya cabang kanan yang dicast, hasilnya union dengan bentuk persis milik
// server — dan union itu tidak boleh diindeks dengan `string` sembarang.
const hitung = computed<Record<string, number>>(() => data.value?.meta.perStatus ?? {})

/** Rangka hanya saat belum ada data sama sekali. Berganti tab atau mengetik di
    kotak cari membiarkan baris yang sudah tergambar tetap terlihat — kalau tidak,
    tiap huruf yang diketik mengosongkan daftarnya. */
const memuatAwal = computed(() => muatStatus.value === 'pending' && !data.value)

const columns = [
  { accessorKey: 'nama', header: 'Nama' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'noHp', header: 'WhatsApp' },
  { accessorKey: 'berakun', header: 'Status member' },
  { accessorKey: 'status', header: 'Status Pendaftaran' },
  { accessorKey: 'aksi', header: 'Aksi' },
]

/** Tombol maju berikutnya, atau null kalau sudah di ujung / sudah batal. */
const langkahMaju = (status: string) =>
  ({ baru: 'Proses', proses: 'Konfirmasi' } as Record<string, string>)[status] ?? null

// Diikat ke variabel lokal supaya bisa dibaca template; auto-import Nuxt bekerja
// pada blok script, dan yang hanya muncul di template tidak dijamin ikut terbawa.
const passwordBawaan = PASSWORD_PESERTA

/** Alamat form Add Member yang sudah terisi data pendaftar ini. Passwordnya
    sendiri tidak lewat alamat halaman — yang lewat cuma penanda asalnya. */
const tautanBuatAkun = (p: any) => ({
  path: '/admin/member/new',
  query: { nama: p.nama, email: p.email, wa: p.noHp ?? '', asal: 'peserta' },
})

// ── Konfirmasi ───────────────────────────────────────────────────────────────
// Tiap perpindahan status lewat modal dulu, bukan langsung dari kliknya.
//
// Isinya bukan sekadar "yakin?": ia daftar periksa. Yang dikonfirmasi bukan
// perpindahan statusnya melainkan pekerjaan di luar layar yang seharusnya sudah
// dikerjakan sebelum status itu berpindah — menghubungi orangnya, memasukkannya ke
// grup WhatsApp, memastikan pembayarannya. Status di database cuma catatan bahwa
// semua itu sudah terjadi.
//
// Karena isinya daftar periksa dan bukan peringatan bahaya, ia bisa dimatikan.
type Aksi = 'maju' | 'batal' | 'pulihkan'

/**
 * Pesan yang sudah dimatikan, disimpan di peramban.
 *
 * Dua kunci terpisah, bukan satu: "proses" dan "konfirmasi" mengingatkan pekerjaan
 * yang berbeda, dan orang yang sudah hafal langkah proses belum tentu hafal soal
 * pembayaran. localStorage, bukan kolom di database — ini kebiasaan orang di depan
 * layar ini, bukan sifat akunnya, dan project ini belum punya satu pun kolom
 * preferensi yang bisa ditumpangi.
 */
const KUNCI_SENYAP = { proses: 'cc.peserta.senyap.proses', konfirmasi: 'cc.peserta.senyap.konfirmasi' }
const senyap = ref({ proses: false, konfirmasi: false })

onMounted(() => {
  senyap.value = {
    proses: localStorage.getItem(KUNCI_SENYAP.proses) === '1',
    konfirmasi: localStorage.getItem(KUNCI_SENYAP.konfirmasi) === '1',
  }
})

/** Dicentang di dalam modal; baru ditulis ke localStorage saat aksinya dijalankan.
    Membatalkan modal berarti tidak ada yang berubah, termasuk centang itu. */
const janganTampilkan = ref(false)

/** Pendaftar yang menunggu konfirmasi, beserta aksi yang akan dijalankan. */
const calon = ref<{ peserta: any, aksi: Aksi } | null>(null)

/** Pesan mana yang berlaku untuk satu langkah — sekaligus kunci senyapnya. */
const tahap = (p: any, aksi: Aksi): 'proses' | 'konfirmasi' | null => {
  if (aksi !== 'maju') return null
  return p.status === 'baru' ? 'proses' : 'konfirmasi'
}

const minta = (peserta: any, aksi: Aksi) => {
  galat.value = ''
  const t = tahap(peserta, aksi)

  // Pesan yang sudah dimatikan berarti langsung jalan. `batal` dan `pulihkan`
  // tidak pernah bisa dimatikan: keduanya mengubah keikutsertaan orang, bukan
  // menandai pekerjaan yang sudah selesai.
  if (t && senyap.value[t]) { jalankan({ peserta, aksi }); return }

  janganTampilkan.value = false
  calon.value = { peserta, aksi }
}

/** Isi modal, ditentukan aksi, status peserta, dan apakah ia sudah punya akun. */
const dialog = computed(() => {
  const c = calon.value
  if (!c) return null
  const nama = c.peserta.nama

  if (c.aksi === 'batal') {
    return {
      judul: 'Batalkan pendaftaran ini?',
      isi: `${nama} tidak akan terhitung sebagai peserta event ini dan hilang dari riwayat keikutsertaannya. Pembatalan masih bisa dianulir kembali ke status ${labelStatus(c.peserta.status)}.`,
      langkah: [] as string[],
      tombol: 'Batalkan pendaftaran',
      warna: 'error' as const,
      ikon: 'i-lucide-x',
      bisaDisenyapkan: false,
    }
  }

  if (c.aksi === 'pulihkan') {
    const balik = labelStatus(c.peserta.statusSebelumBatal ?? 'baru')
    return {
      judul: 'Kembalikan pendaftar ini?',
      isi: `${nama} kembali ke status ${balik} — status terakhirnya sebelum dibatalkan, bukan diulang dari awal.`,
      langkah: [],
      tombol: `Kembalikan ke ${balik}`,
      warna: 'primary' as const,
      ikon: 'i-lucide-rotate-ccw',
      bisaDisenyapkan: false,
    }
  }

  // Maju: dua tahap, dan keduanya berarti pekerjaan yang berbeda.
  if (c.peserta.status === 'baru') {
    return {
      judul: 'Proses pendaftaran ini?',
      isi: 'Pastikan Anda telah melakukan:',
      langkah: [
        'kontak peserta via WhatsApp',
        'masukkan peserta ke dalam WA Group Event',
      ],
      tombol: 'Jadikan Proses',
      warna: 'secondary' as const,
      ikon: 'i-lucide-loader',
      // Pada pendaftar tanpa akun ada satu langkah yang menuntut membuka halaman
      // lain, jadi centang "jangan tampilkan lagi" tidak ditawarkan di sana: yang
      // disembunyikan bukan pengingat melainkan satu-satunya jalan ke form itu.
      bisaDisenyapkan: Boolean(c.peserta.berakun),
    }
  }

  return {
    judul: 'Konfirmasi pendaftaran ini?',
    isi: 'Pastikan peserta telah melakukan pembayaran (jika ada) dan berhak atas materi event khusus Peserta.',
    langkah: [],
    tombol: 'Konfirmasi peserta',
    warna: 'primary' as const,
    ikon: 'i-lucide-check',
    bisaDisenyapkan: true,
  }
})

/** Menutup modal tanpa mengirim apa pun. Dipakai tombol Batal maupun klik di luar. */
const tutupDialog = () => { calon.value = null }

// ── Tambah peserta ───────────────────────────────────────────────────────────
// Untuk yang membooking di luar situs. Formnya di PesertaFormModal.vue, dipakai
// bersama halaman event baru — di sana yang sama persis disimpan sebagai draf.
const formTambah = ref<any>(null)
const menambah = ref(false)

/** Email yang sudah terpakai, supaya bentrokan tertahan sebelum dikirim. Hanya
    yang sedang terlihat — tab "Semua" tanpa pencarian memuat seluruhnya, dan
    yang lolos dari daftar ini tetap ditolak unique index di server. */
const emailTerpakai = computed(() => peserta.value.map((p: any) => String(p.email).toLowerCase()))

const simpanTambah = async (nilai: any) => {
  menambah.value = true
  galat.value = ''
  try {
    await $fetch(`/api/admin/events/${props.kegiatanId}/peserta`, { method: 'POST', body: nilai })
    tambahModal.value = false
    await refresh()
  }
  catch (e: any) {
    // Galatnya masuk ke dalam modal, bukan ke halaman di belakangnya: modalnya
    // tetap terbuka, dan isian yang sudah diketik tidak perlu diulang.
    formTambah.value?.tolak(e?.data?.statusMessage ?? e?.statusMessage ?? 'Gagal menambah peserta.')
  }
  finally { menambah.value = false }
}

const jalankan = async (paksa?: { peserta: any, aksi: Aksi }) => {
  const c = paksa ?? calon.value
  if (!c) return
  const id = c.peserta.id
  galat.value = ''
  sibukId.value = id

  // Centang disimpan sebelum permintaannya berangkat: yang dimatikan adalah
  // pesannya, dan itu keputusan yang berdiri sendiri dari berhasil-tidaknya
  // perpindahan status ini.
  const t = tahap(c.peserta, c.aksi)
  if (t && janganTampilkan.value) {
    senyap.value[t] = true
    localStorage.setItem(KUNCI_SENYAP[t], '1')
  }

  try {
    await $fetch(`/api/admin/peserta/${id}`, { method: 'PATCH', body: { aksi: c.aksi } })
    // Modal ditutup hanya sesudah permintaannya berhasil: kalau gagal, galatnya
    // muncul di dalam modal dan tombolnya bisa ditekan lagi tanpa mencari ulang
    // barisnya di daftar.
    calon.value = null
    await refresh()
  }
  catch (e: any) {
    galat.value = e?.data?.statusMessage ?? e?.statusMessage ?? 'Gagal mengubah status pendaftar.'
  }
  finally {
    sibukId.value = ''
  }
}
</script>

<template>
  <div>
    <!-- Filter status sebagai chip, bukan lima tombol persegi berjajar.
         Yang berubah bukan cuma bentuknya:
           · hitungannya menyatu di dalam chip, bukan badge terpisah yang membuat
             tiap tombol terbaca sebagai dua elemen;
           · yang tidak aktif dibuat rata dan tenang, sehingga satu yang aktif
             benar-benar menonjol — sebelumnya lima garis tepi bersaing sama kuat;
           · statusnya berwarna sendiri-sendiri, jadi warnanya ikut jadi penanda,
             bukan sekadar hiasan. -->
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <div class="flex flex-wrap items-center gap-1.5 rounded-full bg-cc-stone-100 p-1">
        <button
          v-for="s in STATUS"
          :key="s.key"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors"
          :class="tab === s.key
            ? warnaChip[s.warna]
            : 'text-cc-stone-600 hover:bg-white hover:text-cc-green-800'"
          :aria-pressed="tab === s.key"
          @click="tab = s.key"
        >
          <UIcon :name="s.ikon" class="size-3.5" />
          {{ s.label }}
          <span
            class="rounded-full px-1.5 py-0.5 text-[11px] tabular-nums"
            :class="tab === s.key ? 'bg-white/25' : 'bg-white text-cc-stone-500'"
          >
            {{ hitung[s.key] ?? 0 }}
          </span>
        </button>
      </div>

      <UInput
        v-model="cari"
        placeholder="Cari nama atau email…"
        icon="i-lucide-search"
        size="sm"
        class="ml-auto w-full sm:w-64"
      />
    </div>

    <!-- Galat saat modal terbuka ditampilkan di dalam modalnya, bukan di sini —
         di belakang lapisan gelap ia tidak akan terbaca. -->
    <UAlert v-if="galat && !calon" color="error" variant="subtle" class="mb-4" icon="i-lucide-triangle-alert" :description="galat" />

    <div v-if="memuatAwal" class="space-y-2" aria-hidden="true">
      <USkeleton v-for="n in 4" :key="n" class="h-11 w-full" />
    </div>

    <!-- `overflow-x-auto` dipasang di tabelnya sendiri, BUKAN di div pembungkus:
         di sini UTable adalah cabang `v-else` dari rangka pemuatan di atasnya, dan
         menyelipkan div di antara keduanya memutus rantai v-if — "v-else/v-else-if
         has no adjacent v-if", dan halamannya mati sebelum tergambar.

         Kenapa perlu: enam kolom dengan judul sepanjang "Status Pendaftaran"
         melewati lebar kartu pada layar sedang, dan tanpa ini yang bergeser bukan
         tabelnya melainkan seluruh halaman — judul, tab, dan sidebar ikut lari. -->
    <UTable
      v-else
      :data="peserta"
      class="w-full overflow-x-auto"
      :columns="columns"
      :empty="cari
        ? 'Tidak ada pendaftar yang cocok dengan pencarian ini.'
        : 'Belum ada pendaftar pada status ini.'"
    >
      <template #nama-cell="{ row }">
        <span class="font-semibold text-cc-green-800">{{ row.original.nama }}</span>
        <p v-if="row.original.institusi" class="text-xs text-cc-stone-500">
          {{ row.original.institusi }}
        </p>
      </template>

      <template #email-cell="{ row }">
        <span class="text-sm text-cc-stone-700">{{ row.original.email }}</span>
      </template>

      <template #noHp-cell="{ row }">
        <span class="text-sm text-cc-stone-700">{{ row.original.noHp || '—' }}</span>
      </template>

      <!-- "Member" menjawab satu pertanyaan yang menentukan pekerjaan admin:
           perlu dibuatkan akun atau tidak. -->
      <template #berakun-cell="{ row }">
        <UBadge
          :color="row.original.berakun ? 'secondary' : 'neutral'"
          variant="subtle"
          size="sm"
        >
          {{ row.original.berakun ? 'Member' : 'Non member' }}
        </UBadge>
      </template>

      <template #status-cell="{ row }">
        <UBadge :color="warnaStatus(row.original.status)" variant="subtle" size="sm">
          {{ labelStatus(row.original.status) }}
        </UBadge>
        <p v-if="row.original.status === 'batal' && row.original.statusSebelumBatal" class="text-xs text-cc-stone-500">
          dari {{ labelStatus(row.original.statusSebelumBatal) }}
        </p>
      </template>

      <template #aksi-cell="{ row }">
        <div class="flex justify-end gap-1.5">
          <template v-if="row.original.status === 'batal'">
            <UButton
              color="primary"
              variant="soft"
              size="sm"
              icon="i-lucide-rotate-ccw"
              :loading="sibukId === row.original.id"
              @click="minta(row.original, 'pulihkan')"
            >
              Kembalikan
            </UButton>
          </template>

          <template v-else>
            <UButton
              v-if="langkahMaju(row.original.status)"
              color="secondary"
              size="sm"
              trailing-icon="i-lucide-arrow-right"
              :loading="sibukId === row.original.id"
              @click="minta(row.original, 'maju')"
            >
              {{ langkahMaju(row.original.status) }}
            </UButton>

            <UButton
              color="error"
              variant="ghost"
              size="sm"
              icon="i-lucide-x"
              aria-label="Batalkan pendaftaran"
              :loading="sibukId === row.original.id"
              @click="minta(row.original, 'batal')"
            />
          </template>
        </div>
      </template>
    </UTable>

    <PesertaFormModal
      ref="formTambah"
      v-model:open="tambahModal"
      :email-terpakai="emailTerpakai"
      @simpan="simpanTambah"
    />

    <!-- Konfirmasi perpindahan status.
         `:open` + `@update:open`, bukan `v-model:open`: keadaan terbukanya turunan
         dari `calon`, dan menutup modal berarti membuang calonnya — termasuk saat
         ditutup lewat Esc atau klik di luar, yang keduanya tidak menjalankan apa pun. -->
    <UModal
      :open="calon !== null"
      :title="dialog?.judul ?? ''"
      @update:open="(nilai: boolean) => { if (!nilai) tutupDialog() }"
    >
      <template #body>
        <p class="text-sm text-cc-stone-600">{{ dialog?.isi }}</p>

        <ul v-if="dialog?.langkah.length" class="mt-2 space-y-1 text-sm text-cc-stone-700">
          <li v-for="l in dialog.langkah" :key="l" class="flex gap-2">
            <span class="text-cc-brown-500">–</span>
            <span>{{ l }}</span>
          </li>

          <!-- Langkah ketiga hanya untuk yang belum punya akun, dan ia tautan:
               "buatkan akun" adalah pekerjaan di halaman lain, jadi jalan ke sana
               harus ada di kalimat yang menyuruhnya. Nama, email, dan WhatsApp
               pendaftar ikut terbawa supaya tidak diketik ulang dari layar sebelah. -->
          <li v-if="calon && !calon.peserta.berakun" class="flex gap-2">
            <span class="text-cc-brown-500">–</span>
            <span>
              <NuxtLink
                :to="tautanBuatAkun(calon.peserta)"
                class="font-semibold text-cc-green-800 underline underline-offset-2 hover:text-cc-brown-500"
              >
                buatkan akun untuk peserta
              </NuxtLink>
              (default pass: {{ passwordBawaan }})
            </span>
          </li>
        </ul>

        <div v-if="calon" class="mt-3 rounded-lg border border-cc-stone-200 bg-cc-stone-50 p-3">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-semibold text-cc-green-800">{{ calon.peserta.nama }}</span>
            <UBadge :color="warnaStatus(calon.peserta.status)" variant="subtle" size="sm">
              {{ labelStatus(calon.peserta.status) }}
            </UBadge>
            <UBadge :color="calon.peserta.berakun ? 'secondary' : 'neutral'" variant="subtle" size="sm">
              {{ calon.peserta.berakun ? 'Member' : 'Non member' }}
            </UBadge>
          </div>
          <p class="mt-1 text-sm text-cc-stone-600">
            {{ calon.peserta.email }}<template v-if="calon.peserta.noHp"> · {{ calon.peserta.noHp }}</template>
          </p>
        </div>

        <UCheckbox
          v-if="dialog?.bisaDisenyapkan"
          v-model="janganTampilkan"
          label="Jangan tampilkan pesan ini lagi"
          class="mt-3"
        />

        <UAlert
          v-if="galat"
          color="error"
          variant="subtle"
          class="mt-3"
          icon="i-lucide-triangle-alert"
          :description="galat"
        />
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="tutupDialog">Batal</UButton>
          <UButton
            :color="dialog?.warna ?? 'primary'"
            :icon="dialog?.ikon"
            :loading="Boolean(sibukId)"
            @click="jalankan()"
          >
            {{ dialog?.tombol }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
