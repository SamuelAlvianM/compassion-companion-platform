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

const props = defineProps<{ kegiatanId: string }>()

// Tiap status membawa ikonnya sendiri supaya chip terbaca sekilas tanpa membaca
// labelnya — lima tombol yang bentuknya identik menuntut dibaca satu per satu.
const STATUS = [
  { key: 'semua', label: 'Semua', warna: 'neutral' as const, ikon: 'i-lucide-users' },
  { key: 'baru', label: 'Baru', warna: 'warning' as const, ikon: 'i-lucide-inbox' },
  { key: 'proses', label: 'Proses', warna: 'secondary' as const, ikon: 'i-lucide-loader' },
  { key: 'konfirmasi', label: 'Konfirmasi', warna: 'primary' as const, ikon: 'i-lucide-check' },
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

const tab = ref('semua')
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
const hitung = computed(() => data.value?.meta.perStatus ?? ({} as Record<string, number>))

/** Rangka hanya saat belum ada data sama sekali. Berganti tab atau mengetik di
    kotak cari membiarkan baris yang sudah tergambar tetap terlihat — kalau tidak,
    tiap huruf yang diketik mengosongkan daftarnya. */
const memuatAwal = computed(() => muatStatus.value === 'pending' && !data.value)

const tanggal = (nilai: string | null) => nilai
  ? new Intl.DateTimeFormat('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(nilai))
  : '—'

/** Tombol maju berikutnya, atau null kalau sudah di ujung / sudah batal. */
const langkahMaju = (status: string) =>
  ({ baru: 'Proses', proses: 'Konfirmasi' } as Record<string, string>)[status] ?? null

// ── Konfirmasi ───────────────────────────────────────────────────────────────
// Tiap perpindahan status lewat modal dulu, bukan langsung dari kliknya.
//
// Alasannya bukan seragam demi seragam: keempat tombolnya duduk berdempetan di
// ujung baris yang bentuknya identik, dan daftarnya bergeser sendiri tiap kali
// datanya dimuat ulang — salah baris adalah kesalahan yang mudah terjadi dan tidak
// punya jejak. Modalnya menyebut NAMA orangnya, jadi yang dikonfirmasi bukan
// "tindakan ini" melainkan "tindakan ini pada orang ini".
type Aksi = 'maju' | 'batal' | 'pulihkan'

/** Pendaftar yang menunggu konfirmasi, beserta aksi yang akan dijalankan. */
const calon = ref<{ peserta: any, aksi: Aksi } | null>(null)

const minta = (peserta: any, aksi: Aksi) => {
  galat.value = ''
  calon.value = { peserta, aksi }
}

/** Isi modal, ditentukan aksi dan status peserta saat ini. */
const dialog = computed(() => {
  const c = calon.value
  if (!c) return null
  const nama = c.peserta.nama

  if (c.aksi === 'batal') {
    return {
      judul: 'Batalkan pendaftaran ini?',
      isi: `${nama} tidak akan terhitung sebagai peserta event ini dan hilang dari riwayat keikutsertaannya. Pembatalan masih bisa dianulir kembali ke status ${labelStatus(c.peserta.status)}.`,
      tombol: 'Batalkan pendaftaran',
      warna: 'error' as const,
      ikon: 'i-lucide-x',
    }
  }

  if (c.aksi === 'pulihkan') {
    const balik = labelStatus(c.peserta.statusSebelumBatal ?? 'baru')
    return {
      judul: 'Kembalikan pendaftar ini?',
      isi: `${nama} kembali ke status ${balik} — status terakhirnya sebelum dibatalkan, bukan diulang dari awal.`,
      tombol: `Kembalikan ke ${balik}`,
      warna: 'primary' as const,
      ikon: 'i-lucide-rotate-ccw',
    }
  }

  // Maju: dua tahap, dan keduanya berarti pekerjaan yang berbeda.
  if (c.peserta.status === 'baru') {
    return {
      judul: 'Proses pendaftaran ini?',
      isi: `Tandai pendaftaran ${nama} sedang diproses — sudah dihubungi dan menunggu pembayaran atau kelengkapan lain. Belum berarti ia terdaftar sebagai peserta.`,
      tombol: 'Jadikan Proses',
      warna: 'secondary' as const,
      ikon: 'i-lucide-loader',
    }
  }

  return {
    judul: 'Konfirmasi pendaftaran ini?',
    isi: `${nama} resmi terdaftar sebagai peserta event ini. Pastikan pembayaran dan kelengkapannya sudah diverifikasi — ini langkah terakhir.`,
    tombol: 'Konfirmasi peserta',
    warna: 'primary' as const,
    ikon: 'i-lucide-check',
  }
})

/** Menutup modal tanpa mengirim apa pun. Dipakai tombol Batal maupun klik di luar. */
const tutupDialog = () => { calon.value = null }

const jalankan = async () => {
  const c = calon.value
  if (!c) return
  const id = c.peserta.id
  galat.value = ''
  sibukId.value = id
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
      <div
        v-for="n in 4"
        :key="n"
        class="flex items-center gap-3 rounded-xl border border-cc-stone-200 p-3"
      >
        <div class="min-w-0 flex-1 space-y-2">
          <USkeleton class="h-4 w-48" />
          <USkeleton class="h-3 w-64" />
          <USkeleton class="h-3 w-40" />
        </div>
        <USkeleton class="h-8 w-28 shrink-0 rounded-md" />
      </div>
    </div>

    <div v-else-if="!peserta.length" class="py-10 text-center text-sm text-cc-stone-500">
      {{ cari ? 'Tidak ada pendaftar yang cocok dengan pencarian ini.' : 'Belum ada pendaftar pada status ini.' }}
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="p in peserta"
        :key="p.id"
        class="flex flex-wrap items-center gap-3 rounded-xl border border-cc-stone-200 p-3"
      >
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="truncate font-semibold text-cc-green-800">{{ p.nama }}</span>
            <UBadge :color="warnaStatus(p.status)" variant="subtle" size="sm">
              {{ labelStatus(p.status) }}
            </UBadge>
            <UTooltip
              v-if="p.berakun"
              text="Mendaftar memakai akun — nama dan emailnya diambil dari akun yang sudah terverifikasi, jadi langsung masuk sebagai proses."
            >
              <UBadge color="secondary" variant="soft" size="sm" icon="i-lucide-user-check">Akun</UBadge>
            </UTooltip>
          </div>
          <p class="truncate text-sm text-cc-stone-600">
            {{ p.email }}<template v-if="p.noHp"> · {{ p.noHp }}</template>
            <template v-if="p.institusi"> · {{ p.institusi }}</template>
          </p>
          <p class="text-xs text-cc-stone-500">
            Terdaftar {{ tanggal(p.terdaftarPada) }}
            <template v-if="p.status === 'batal' && p.statusSebelumBatal">
              · dibatalkan dari {{ labelStatus(p.statusSebelumBatal) }}
            </template>
          </p>
        </div>

        <div class="flex shrink-0 gap-2">
          <template v-if="p.status === 'batal'">
            <UButton
              color="primary"
              variant="soft"
              size="sm"
              icon="i-lucide-rotate-ccw"
              :loading="sibukId === p.id"
              @click="minta(p, 'pulihkan')"
            >
              Kembalikan ke {{ labelStatus(p.statusSebelumBatal ?? 'baru') }}
            </UButton>
          </template>

          <template v-else>
            <UButton
              v-if="langkahMaju(p.status)"
              color="secondary"
              size="sm"
              trailing-icon="i-lucide-arrow-right"
              :loading="sibukId === p.id"
              @click="minta(p, 'maju')"
            >
              {{ langkahMaju(p.status) }}
            </UButton>

            <UButton
              color="error"
              variant="ghost"
              size="sm"
              icon="i-lucide-x"
              :loading="sibukId === p.id"
              @click="minta(p, 'batal')"
            >
              Batal
            </UButton>
          </template>
        </div>
      </div>
    </div>

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

        <div v-if="calon" class="mt-3 rounded-lg border border-cc-stone-200 bg-cc-stone-50 p-3">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-semibold text-cc-green-800">{{ calon.peserta.nama }}</span>
            <UBadge :color="warnaStatus(calon.peserta.status)" variant="subtle" size="sm">
              {{ labelStatus(calon.peserta.status) }}
            </UBadge>
          </div>
          <p class="mt-1 text-sm text-cc-stone-600">
            {{ calon.peserta.email }}<template v-if="calon.peserta.noHp"> · {{ calon.peserta.noHp }}</template>
          </p>
        </div>

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
            @click="jalankan"
          >
            {{ dialog?.tombol }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
