<script setup lang="ts">
definePageMeta({ layout: 'admin' })

// Log kerja — MASTER SAJA. Penjaganya di middleware/admin.global.ts dan di
// endpointnya; halaman ini menganggap dirinya sudah dilindungi keduanya.
//
// Dikelompokkan PER OBJEK, bukan sebagai satu garis waktu panjang.
//
// Alasannya cara orang membacanya: pertanyaan yang membawa master ke sini hampir
// selalu tentang satu tulisan atau satu akun ("yang kemarin itu sudah sampai
// mana?"), bukan tentang jam berapa saja ada yang bekerja. Satu daftar berurut
// waktu menyelipkan enam langkah sebuah jurnal di antara langkah-langkah tiga
// jurnal lain, dan yang sebenarnya dicari harus dipungut satu-satu dari
// tumpukan. Kartu per objek menaruh perjalanan itu utuh di satu tempat; garis
// waktunya tetap ada, hanya pindah ke dalam kartunya dan baru terbuka saat
// diklik.

const segmen = ref<'jurnal' | 'event' | 'member'>('jurnal')

// ── Penyaring ────────────────────────────────────────────────────────────────
//
// Ketiganya dikirim ke server, bukan disaring di klien. Alasannya bukan jumlah
// data melainkan keutuhan kartu: penyaringnya bekerja pada tingkat OBJEK — sebuah
// jurnal yang salah satu langkahnya cocok akan tampil dengan SELURUH riwayatnya,
// bukan dengan langkah yang cocok saja. Aturan itu hidup di endpointnya (lihat
// komentarnya di sana), dan menyalinnya ke sini berarti dua tempat yang bisa
// menyimpang.
const cari = ref('')
const aksiPilihan = ref('semua')
const pelakuPilihan = ref('semua')
const hari = ref(7)

const { data, status: muatStatus, refresh } = useFetch('/api/admin/log', {
  query: { segmen, cari, aksi: aksiPilihan, pelaku: pelakuPilihan, hari },
  headers: import.meta.server ? useRequestHeaders(['cookie']) : undefined,
})

const adaFilter = computed(() =>
  Boolean(cari.value.trim()) || aksiPilihan.value !== 'semua' || pelakuPilihan.value !== 'semua' || hari.value !== 7,
)

const resetFilter = () => {
  cari.value = ''
  aksiPilihan.value = 'semua'
  pelakuPilihan.value = 'semua'
  hari.value = 7
}

const aksiOptions = computed(() => [
  { value: 'semua', label: 'Semua tindakan' },
  ...(data.value?.meta.aksiTersedia ?? []),
])

const pelakuOptions = computed(() => [
  { value: 'semua', label: 'Semua orang' },
  ...(data.value?.meta.pelakuTersedia ?? []),
])

const RENTANG = [
  { value: 7, label: '7 hari' },
  { value: 3, label: '3 hari' },
  { value: 1, label: '24 jam' },
]

const objekTampil = computed(() => data.value?.meta.objekTampil ?? 0)
const objekTotal = computed(() => data.value?.meta.objekTotal ?? 0)

const baris = computed(() => data.value?.data ?? [])
const hitung = computed<Record<string, number>>(() => data.value?.meta.perSegmen ?? {})
const simpanHari = computed(() => data.value?.meta.simpanHari ?? 7)
const memuatAwal = computed(() => muatStatus.value === 'pending' && !data.value)

const SEGMEN = [
  { key: 'jurnal', label: 'Jurnal', icon: 'i-lucide-notebook-pen' },
  { key: 'event', label: 'Event', icon: 'i-lucide-calendar-days' },
  { key: 'member', label: 'Member', icon: 'i-lucide-users' },
] as const

type Baris = (typeof baris)['value'][number]

/**
 * Kelompok = satu objek beserta seluruh jejaknya.
 *
 * Kuncinya `objekId`, dengan `objekLabel` sebagai cadangan — baris pendaftaran
 * tamu tidak punya id akun, dan tanpa cadangan itu semuanya akan menggumpal jadi
 * satu kelompok bernama "null".
 *
 * Urutan kelompok mengikuti kejadian TERBARU di dalamnya, bukan yang terlama:
 * yang baru saja bergerak itulah yang sedang diurus orang.
 */
interface Kelompok {
  kunci: string
  objekId: string | null
  label: string
  tautan: string | null
  jejak: Baris[]
  terakhir: Baris
}

const kelompok = computed<Kelompok[]>(() => {
  const peta = new Map<string, Kelompok>()

  for (const row of baris.value) {
    const kunci = row.objekId ?? `label:${row.objekLabel ?? '—'}`
    const ada = peta.get(kunci)
    if (ada) {
      ada.jejak.push(row)
      // Tautan diambil dari baris paling berarti yang punya: baris "dihapus"
      // sengaja tidak bertautan, dan kelompok yang barisnya kebetulan dimulai
      // dari situ akan jadi kelompok yang tidak bisa dibuka sama sekali.
      if (!ada.tautan && row.tautan) ada.tautan = row.tautan
      continue
    }
    peta.set(kunci, {
      kunci,
      objekId: row.objekId,
      label: row.objekLabel ?? '(tanpa nama)',
      tautan: row.tautan,
      jejak: [row],
      terakhir: row,
    })
  }

  return [...peta.values()]
})

// Kelompok yang sedang terbuka. Set, bukan satu id: membandingkan dua jurnal
// berarti membuka keduanya, dan accordion yang menutup sendiri memaksa mengingat
// isi yang barusan tertutup.
const terbuka = ref<Set<string>>(new Set())

const alih = (kunci: string) => {
  const salinan = new Set(terbuka.value)
  salinan.has(kunci) ? salinan.delete(kunci) : salinan.add(kunci)
  terbuka.value = salinan
}

// Berganti segmen menutup semuanya. Kunci kelompok tidak pernah bentrok antar
// segmen, tapi membiarkan sisa keadaan lama berarti tab baru kadang terbuka
// sebagian tanpa sebab yang bisa dijelaskan orang yang melihatnya.
watch(segmen, () => {
  terbuka.value = new Set()
  // Penyaringnya ikut direset. Pilihan "tindakan" dan "orang" disusun dari isi
  // segmen yang sedang dibuka, jadi nilai yang terbawa dari tab sebelumnya bisa
  // menjadi pilihan yang tidak ada di daftarnya — dan yang tergambar adalah
  // daftar kosong tanpa sebab yang terbaca.
  resetFilter()
})

/**
 * Warna dan ikon mengikuti ARTI kejadiannya, bukan segmennya.
 *
 * Yang dicari mata saat menyusuri log ada dua: apa yang sudah selesai (terbit,
 * disetujui) dan apa yang mundur (revisi, dihapus). Mewarnai per segmen tidak
 * menolong — segmennya sudah dipilih lewat tab di atas.
 */
const nada = (aksi: string): 'terbit' | 'maju' | 'mundur' | 'hapus' | 'netral' => {
  if (aksi.endsWith('diterbitkan')) return 'terbit'
  if (aksi.endsWith('disetujui')) return 'maju'
  if (aksi.endsWith('diminta-revisi') || aksi.endsWith('ditarik-dari-publik')) return 'mundur'
  if (aksi.endsWith('dihapus')) return 'hapus'
  return 'netral'
}

const IKON: Record<string, string> = {
  terbit: 'i-lucide-badge-check',
  maju: 'i-lucide-thumbs-up',
  mundur: 'i-lucide-corner-up-left',
  hapus: 'i-lucide-trash-2',
  netral: 'i-lucide-circle-dot',
}

const WARNA: Record<string, string> = {
  terbit: 'bg-cc-green-800 text-white',
  maju: 'bg-cc-green-600 text-white',
  mundur: 'bg-cc-brown-500 text-white',
  hapus: 'bg-cc-stone-700 text-white',
  netral: 'bg-cc-stone-200 text-cc-stone-600',
}

const WARNA_PITA: Record<string, string> = {
  terbit: 'bg-cc-green-800/10 text-cc-green-800',
  maju: 'bg-cc-green-600/10 text-cc-green-800',
  mundur: 'bg-cc-brown-500/12 text-cc-brown-600',
  hapus: 'bg-cc-stone-200 text-cc-stone-700',
  netral: 'bg-cc-stone-100 text-cc-stone-600',
}

/** Waktu lengkap sampai menit. Log tanpa jam tidak bisa menjawab "yang mana yang
    lebih dulu" saat beberapa kejadian jatuh di hari yang sama — dan itu justru
    pertanyaan yang membuat orang membuka halaman ini. */
const waktu = (nilai: string | number | null) =>
  nilai
    ? new Intl.DateTimeFormat('id-ID', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
      }).format(new Date(nilai))
    : '—'

/**
 * "3 jam lalu" di samping tanggal penuhnya, bukan menggantikannya: yang pertama
 * menjawab "baru saja atau lama?", yang kedua menjawab "tepatnya kapan?".
 *
 * Dikosongkan sampai komponennya terpasang di browser. Nilainya diturunkan dari
 * `Date.now()`, dan HTML yang dirender server selalu beberapa ratus milidetik —
 * kadang beberapa menit — lebih tua daripada yang dihitung ulang klien saat
 * hidrasi. Selisih itu membuat Vue melaporkan hydration mismatch dan menggambar
 * ulang cabangnya. Tanggal penuh di sebelahnya tidak bergantung waktu sekarang,
 * jadi tidak ada informasi yang benar-benar hilang selama satu tick itu.
 */
const terpasang = ref(false)
onMounted(() => { terpasang.value = true })

const jarak = (nilai: string | number | null) => {
  if (!nilai || !terpasang.value) return ''
  const detik = Math.floor((Date.now() - new Date(nilai).getTime()) / 1000)
  if (detik < 60) return 'baru saja'
  if (detik < 3600) return `${Math.floor(detik / 60)} menit lalu`
  if (detik < 86400) return `${Math.floor(detik / 3600)} jam lalu`
  return `${Math.floor(detik / 86400)} hari lalu`
}

// ── Penghapusan ──────────────────────────────────────────────────────────────

const toast = useToast()
const sedangHapus = ref<string | null>(null)
const konfirmasiKosongkan = ref(false)
const konfirmasiRiwayat = ref<Kelompok | null>(null)

const pesanGalat = (e: unknown) =>
  (e as { statusMessage?: string })?.statusMessage ?? 'Gagal menghapus catatan'

const hapusSatu = async (id: string) => {
  sedangHapus.value = id
  try {
    await $fetch(`/api/admin/log/${id}`, { method: 'DELETE' })
    await refresh()
  } catch (e: unknown) {
    toast.add({ title: pesanGalat(e), color: 'error' })
  } finally {
    sedangHapus.value = null
  }
}

/** Seluruh riwayat satu objek, dalam satu permintaan. Barisnya bisa belasan, dan
    belasan DELETE untuk satu klik adalah cara penghapusan bisa berhasil setengah. */
const hapusRiwayat = async (k: Kelompok) => {
  try {
    const hasil = await $fetch('/api/admin/log', {
      method: 'DELETE',
      query: { segmen: segmen.value, objekId: k.objekId },
    })
    konfirmasiRiwayat.value = null
    toast.add({ title: hasil.message, color: 'success' })
    await refresh()
  } catch (e: unknown) {
    toast.add({ title: pesanGalat(e), color: 'error' })
  }
}

const kosongkanSegmen = async () => {
  try {
    const hasil = await $fetch('/api/admin/log', {
      method: 'DELETE',
      query: { segmen: segmen.value },
    })
    konfirmasiKosongkan.value = false
    toast.add({ title: hasil.message, color: 'success' })
    await refresh()
  } catch (e: unknown) {
    toast.add({ title: pesanGalat(e), color: 'error' })
  }
}

const labelSegmen = computed(() => SEGMEN.find(s => s.key === segmen.value)?.label ?? segmen.value)
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-xs font-bold tracking-[0.14em] text-cc-brown-500 uppercase">Master area</p>
        <h1 class="mt-1 font-serif text-4xl text-cc-green-800">Log kerja</h1>
        <p class="mt-1 max-w-3xl text-sm text-cc-stone-600">
          Siapa mengerjakan apa, dan kapan. Klik satu baris untuk membuka perjalanannya.
          Hanya perpindahan yang berarti yang dicatat — menyimpan draf berkali-kali tidak masuk ke sini.
          Catatan lebih tua dari <strong>{{ simpanHari }} hari</strong> dihapus otomatis.
        </p>
      </div>
      <UButton
        color="neutral"
        variant="subtle"
        icon="i-lucide-eraser"
        class="shrink-0"
        :disabled="!baris.length"
        @click="konfirmasiKosongkan = true"
      >
        Kosongkan {{ labelSegmen.toLowerCase() }}
      </UButton>
    </div>

    <div
      role="group"
      aria-label="Segmen log"
      class="mb-5 flex flex-wrap items-center gap-1.5 rounded-full bg-cc-stone-100 p-1"
    >
      <button
        v-for="s in SEGMEN"
        :key="s.key"
        type="button"
        class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors"
        :class="segmen === s.key ? 'bg-cc-green-800 text-white' : 'text-cc-stone-600 hover:bg-white hover:text-cc-green-800'"
        :aria-pressed="segmen === s.key"
        @click="segmen = s.key"
      >
        <UIcon :name="s.icon" class="size-4" />
        {{ s.label }}
        <span
          class="rounded-full px-1.5 py-0.5 text-[11px] tabular-nums"
          :class="segmen === s.key ? 'bg-white/25' : 'bg-white text-cc-stone-500'"
        >
          {{ hitung[s.key] ?? 0 }}
        </span>
      </button>
    </div>

    <!-- Baris penyaring. Kotak cari diberi porsi terbesar karena itu yang paling
         sering dipakai: yang dicari orang hampir selalu sebuah nama. -->
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <UInput
        v-model="cari"
        icon="i-lucide-search"
        placeholder="Cari judul, nama, atau catatan…"
        class="min-w-0 flex-1 basis-64"
      />
      <USelect v-model="aksiPilihan" :items="aksiOptions" value-key="value" class="w-48 shrink-0" />
      <USelect v-model="pelakuPilihan" :items="pelakuOptions" value-key="value" class="w-44 shrink-0" />
      <USelect v-model="hari" :items="RENTANG" value-key="value" class="w-28 shrink-0" />
      <UButton
        v-if="adaFilter"
        color="neutral"
        variant="ghost"
        icon="i-lucide-x"
        :aria-label="'Hapus penyaring'"
        @click="resetFilter"
      >
        Reset
      </UButton>
    </div>

    <!-- Hitungannya menyebut DUA angka, bukan satu. "3 ditemukan" tidak memberi
         tahu dari berapa, dan tanpa itu tidak ada cara tahu apakah saringannya
         terlalu sempit atau memang segitu isinya. -->
    <p v-if="adaFilter && !memuatAwal" class="mb-3 text-sm text-cc-stone-600">
      {{ objekTampil }} dari {{ objekTotal }} ditemukan
      <span class="text-cc-stone-400">· riwayatnya ditampilkan utuh, bukan hanya langkah yang cocok</span>
    </p>

    <div v-if="memuatAwal" class="space-y-2" aria-hidden="true">
      <USkeleton v-for="n in 5" :key="n" class="h-20 w-full" />
    </div>

    <UCard v-else-if="!kelompok.length" :ui="{ body: 'py-12 text-center' }">
      <UIcon :name="adaFilter ? 'i-lucide-search-x' : 'i-lucide-history'" class="mx-auto size-8 text-cc-stone-300" />
      <!-- Dua kalimat yang berbeda, karena artinya berbeda: "belum ada apa-apa"
           menyuruh orang menunggu, "tidak ada yang cocok" menyuruh orang mengubah
           pencariannya. Satu kalimat untuk keduanya membuat separuhnya salah. -->
      <p v-if="adaFilter" class="mt-3 text-sm text-cc-stone-500">
        Tidak ada yang cocok dengan pencarian atau penyaring Anda.
      </p>
      <p v-else class="mt-3 text-sm text-cc-stone-500">
        Belum ada catatan pada segmen {{ labelSegmen.toLowerCase() }} dalam {{ simpanHari }} hari terakhir.
      </p>
      <UButton v-if="adaFilter" class="mt-4" color="neutral" variant="subtle" @click="resetFilter">
        Hapus penyaring
      </UButton>
    </UCard>

    <div v-else class="space-y-3">
      <section
        v-for="k in kelompok"
        :key="k.kunci"
        class="overflow-hidden rounded-xl border border-cc-stone-200 bg-white"
        :class="terbuka.has(k.kunci) ? 'border-cc-green-600' : ''"
      >
        <!-- Kepala kartu: nama objeknya, keadaan terakhirnya, dan berapa langkah
             yang tersimpan. Seluruh kepala jadi tombol — sasaran klik selebar
             kartu jauh lebih mudah dikenai daripada satu ikon panah di ujung. -->
        <button
          type="button"
          class="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-cc-stone-50"
          :aria-expanded="terbuka.has(k.kunci)"
          @click="alih(k.kunci)"
        >
          <UIcon
            name="i-lucide-chevron-right"
            class="mt-1 size-5 shrink-0 text-cc-stone-400 transition-transform"
            :class="terbuka.has(k.kunci) ? 'rotate-90' : ''"
          />

          <div class="min-w-0 flex-1">
            <h2 class="font-serif text-xl break-words text-cc-green-800">{{ k.label }}</h2>
            <div class="mt-1.5 flex flex-wrap items-center gap-2">
              <span
                class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold"
                :class="WARNA_PITA[nada(k.terakhir.aksi)]"
              >
                <UIcon :name="IKON[nada(k.terakhir.aksi)]" class="size-3.5" />
                {{ k.terakhir.aksiLabel }}
              </span>
              <span class="text-xs text-cc-stone-500">
                oleh <strong class="text-cc-stone-700">{{ k.terakhir.pelakuNama ?? 'tamu' }}</strong>
                <span v-if="terpasang">· {{ jarak(k.terakhir.createdAt) }}</span>
              </span>
            </div>
          </div>

          <span class="shrink-0 rounded-full bg-cc-stone-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-cc-stone-600">
            {{ k.jejak.length }} langkah
          </span>
        </button>

        <!-- Isi kartu: garis waktunya, dari yang terbaru ke terlama. -->
        <div v-if="terbuka.has(k.kunci)" class="border-t border-cc-stone-200 bg-cc-stone-50/60 px-4 py-4">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <UButton
              v-if="k.tautan"
              :to="k.tautan"
              color="secondary"
              variant="subtle"
              size="xs"
              trailing-icon="i-lucide-arrow-up-right"
            >
              Buka halamannya
            </UButton>
            <span v-else class="text-xs text-cc-stone-400">Objeknya sudah tidak ada — tidak ada halaman yang bisa dibuka.</span>

            <UButton
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-trash-2"
              :disabled="!k.objekId"
              @click="konfirmasiRiwayat = k"
            >
              Hapus riwayat ini
            </UButton>
          </div>

          <ol class="relative space-y-2 border-l-2 border-cc-stone-200 pl-6">
            <li v-for="row in k.jejak" :key="row.id" class="relative">
              <!-- Bulatan penanda duduk DI ATAS garis, bukan di sampingnya: garis
                   waktu yang titiknya meleset dari garisnya terbaca sebagai dua
                   elemen yang tidak berhubungan. -->
              <span
                class="absolute top-3.5 -left-[1.9rem] flex size-6 items-center justify-center rounded-full ring-4 ring-cc-stone-50"
                :class="WARNA[nada(row.aksi)]"
              >
                <UIcon :name="IKON[nada(row.aksi)]" class="size-3.5" />
              </span>

              <div class="group rounded-lg border border-cc-stone-200 bg-white p-3">
                <div class="flex flex-wrap items-start justify-between gap-2">
                  <div class="min-w-0">
                    <p class="text-sm font-semibold text-cc-green-800">{{ row.aksiLabel }}</p>
                    <p v-if="row.catatan" class="mt-1 text-xs break-words text-cc-stone-500 italic">
                      &ldquo;{{ row.catatan }}&rdquo;
                    </p>
                    <p class="mt-1.5 text-xs text-cc-stone-500">
                      oleh
                      <strong class="text-cc-stone-700">{{ row.pelakuNama ?? 'tamu' }}</strong>
                      <span v-if="row.pelakuRole" class="text-cc-stone-400"> · {{ row.pelakuRole }}</span>
                    </p>
                  </div>

                  <div class="flex shrink-0 items-center gap-2">
                    <div class="text-right">
                      <p class="text-xs whitespace-nowrap text-cc-stone-600">{{ waktu(row.createdAt) }}</p>
                      <p class="text-[11px] whitespace-nowrap text-cc-stone-400">{{ jarak(row.createdAt) }}</p>
                    </div>
                    <!-- Tombol hapus per langkah muncul saat barisnya disentuh.
                         Selalu terlihat berarti puluhan ikon hapus menuntut
                         perhatian di halaman yang gunanya membaca. -->
                    <UButton
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      icon="i-lucide-x"
                      :loading="sedangHapus === row.id"
                      class="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      :aria-label="`Hapus catatan ${row.aksiLabel}`"
                      @click="hapusSatu(row.id)"
                    />
                  </div>
                </div>
              </div>
            </li>
          </ol>
        </div>
      </section>
    </div>

    <UModal :open="!!konfirmasiRiwayat" title="Hapus riwayat ini?" @update:open="konfirmasiRiwayat = null">
      <template #body>
        <p class="text-sm text-cc-stone-600">
          Seluruh {{ konfirmasiRiwayat?.jejak.length }} langkah untuk
          <strong>{{ konfirmasiRiwayat?.label }}</strong> akan dihapus permanen.
          {{ labelSegmen }} itu sendiri tidak ikut terhapus — yang hilang catatannya saja.
        </p>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="konfirmasiRiwayat = null">Batal</UButton>
          <UButton
            color="error"
            icon="i-lucide-trash-2"
            @click="konfirmasiRiwayat && hapusRiwayat(konfirmasiRiwayat)"
          >
            Hapus riwayat
          </UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="konfirmasiKosongkan" title="Kosongkan log?">
      <template #body>
        <p class="text-sm text-cc-stone-600">
          Seluruh catatan segmen <strong>{{ labelSegmen }}</strong> ({{ hitung[segmen] ?? 0 }} baris)
          akan dihapus permanen. Segmen lain tidak ikut terhapus.
        </p>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="konfirmasiKosongkan = false">Batal</UButton>
          <UButton color="error" icon="i-lucide-trash-2" @click="kosongkanSegmen">Hapus semua</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
