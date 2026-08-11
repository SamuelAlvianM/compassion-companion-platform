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

const STATUS = [
  { key: 'semua', label: 'Semua', warna: 'neutral' as const },
  { key: 'baru', label: 'Baru', warna: 'warning' as const },
  { key: 'proses', label: 'Proses', warna: 'secondary' as const },
  { key: 'konfirmasi', label: 'Konfirmasi', warna: 'primary' as const },
  { key: 'batal', label: 'Batal', warna: 'neutral' as const },
]

const warnaStatus = (s: string) => STATUS.find(x => x.key === s)?.warna ?? 'neutral'
const labelStatus = (s: string) => STATUS.find(x => x.key === s)?.label ?? s

const tab = ref('semua')
const cari = ref('')
const galat = ref('')
const sibukId = ref('')

const { data, refresh, status: muatStatus } = await useFetch(
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

const tanggal = (nilai: string | null) => nilai
  ? new Intl.DateTimeFormat('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(nilai))
  : '—'

/** Tombol maju berikutnya, atau null kalau sudah di ujung / sudah batal. */
const langkahMaju = (status: string) =>
  ({ baru: 'Proses', proses: 'Konfirmasi' } as Record<string, string>)[status] ?? null

const jalankan = async (id: string, aksi: 'maju' | 'batal' | 'pulihkan') => {
  galat.value = ''
  sibukId.value = id
  try {
    await $fetch(`/api/admin/peserta/${id}`, { method: 'PATCH', body: { aksi } })
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
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <UButton
        v-for="s in STATUS"
        :key="s.key"
        :color="tab === s.key ? 'primary' : 'neutral'"
        :variant="tab === s.key ? 'solid' : 'outline'"
        size="sm"
        @click="tab = s.key"
      >
        {{ s.label }}
        <UBadge :color="tab === s.key ? 'neutral' : 'neutral'" variant="subtle" size="sm" class="ml-1">
          {{ hitung[s.key] ?? 0 }}
        </UBadge>
      </UButton>

      <UInput
        v-model="cari"
        placeholder="Cari nama atau email…"
        icon="i-lucide-search"
        size="sm"
        class="ml-auto w-full sm:w-64"
      />
    </div>

    <UAlert v-if="galat" color="error" variant="subtle" class="mb-4" icon="i-lucide-triangle-alert" :description="galat" />

    <div v-if="muatStatus === 'pending'" class="py-10 text-center text-sm text-cc-stone-500">
      Memuat…
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
              @click="jalankan(p.id, 'pulihkan')"
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
              @click="jalankan(p.id, 'maju')"
            >
              {{ langkahMaju(p.status) }}
            </UButton>

            <UButton
              color="error"
              variant="ghost"
              size="sm"
              icon="i-lucide-x"
              :loading="sibukId === p.id"
              @click="jalankan(p.id, 'batal')"
            >
              Batal
            </UButton>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
