<script setup lang="ts">
// Daftar event admin — kini dari database, bukan array literal.
// Draft ikut tampil di sini (berbeda dari /api/events publik yang menyaringnya).
definePageMeta({ layout: 'admin' })

const cari = ref('')
// 'semua' sebagai sentinel: Reka UI memesan string kosong untuk keadaan "belum
// dipilih" dan melempar error kalau ada item bernilai ''.
const status = ref('semua')

// Pencarian di-debounce supaya tiap ketikan tidak jadi satu permintaan.
// Ditulis manual, mengikuti pola yang sama di pages/admin/members.vue — VueUse
// tidak terpasang sebagai modul Nuxt di project ini, jadi refDebounced tidak
// tersedia lewat auto-import.
const cariDebounce = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
watch(cari, (nilai) => {
  clearTimeout(timer)
  timer = setTimeout(() => { cariDebounce.value = nilai }, 300)
})

const { data, status: muat, refresh } = useFetch('/api/admin/events', {
  query: computed(() => ({
    cari: cariDebounce.value || undefined,
    status: status.value === 'semua' ? undefined : status.value,
  })),
})

const events = computed(() => data.value?.data ?? [])

const statusOptions = [
  { value: 'semua', label: 'Semua status' },
  { value: 'draft', label: 'Draft' },
  { value: 'terbit', label: 'Terbit' },
  { value: 'selesai', label: 'Selesai' },
  { value: 'batal', label: 'Batal' },
]

const tanggal = (nilai: string | null) => nilai
  ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date(nilai))
  : '—'

const rupiah = (n: number) => n === 0
  ? 'Gratis'
  : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

const warnaStatus = (s: string) => ({
  draft: 'neutral', terbit: 'primary', selesai: 'secondary', batal: 'error',
}[s] ?? 'neutral') as 'neutral' | 'primary' | 'secondary' | 'error'

// ── Hapus ────────────────────────────────────────────────────────────────────
const hapusTarget = ref<{ id: string, judul: string } | null>(null)
const galat = ref('')
const sibuk = ref(false)

const hapus = async () => {
  if (!hapusTarget.value) return
  sibuk.value = true
  galat.value = ''
  try {
    await $fetch(`/api/admin/events/${hapusTarget.value.id}`, { method: 'DELETE' })
    hapusTarget.value = null
    await refresh()
  }
  catch (e: any) {
    // Server menolak menghapus event yang sudah punya peserta; pesannya
    // ditampilkan apa adanya karena ia sudah menjelaskan jalan keluarnya.
    galat.value = e?.data?.statusMessage ?? e?.statusMessage ?? 'Gagal menghapus event.'
  }
  finally {
    sibuk.value = false
  }
}

const columns = [
  { accessorKey: 'judul', header: 'Nama Event' },
  { accessorKey: 'tanggalMulai', header: 'Tanggal' },
  { accessorKey: 'lokasi', header: 'Lokasi' },
  { accessorKey: 'isi', header: 'Sesi & materi' },
  { accessorKey: 'terdaftar', header: 'Peserta' },
  { accessorKey: 'harga', header: 'Biaya' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'aksi', header: '' },
]
</script>

<template>
  <div class="mx-auto max-w-7xl">
    <div class="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-xs font-bold uppercase tracking-[.16em] text-cc-brown-500">Program</p>
        <h1 class="font-serif text-5xl text-cc-green-800">Event</h1>
        <p class="mt-2 text-sm text-cc-stone-600">Kelola program, peserta, materi, dan dokumentasi.</p>
      </div>
      <UButton to="/admin/event/new" color="secondary" size="lg" icon="i-lucide-plus" class="shrink-0">
        Event baru
      </UButton>
    </div>

    <div class="mb-4 flex flex-wrap items-center gap-3">
      <UInput
        v-model="cari"
        icon="i-lucide-search"
        placeholder="Cari judul atau slug…"
        class="w-72"
      />
      <USelect v-model="status" :items="statusOptions" value-key="value" class="w-48" />
      <span class="ml-auto text-sm text-cc-stone-600">{{ events.length }} event</span>
    </div>

    <UCard :ui="{ body: 'p-0' }">
      <UTable
        :data="events"
        :columns="columns"
        :loading="muat === 'pending'"
        empty="Belum ada event. Klik “Event baru” untuk membuat yang pertama."
      >
        <template #judul-cell="{ row }">
          <NuxtLink
            :to="`/admin/event/${row.original.id}`"
            class="font-semibold text-cc-green-800 hover:text-cc-brown-500 hover:underline"
          >
            {{ row.original.judul }}
          </NuxtLink>
          <div class="text-xs text-cc-stone-500">/{{ row.original.slug }}</div>
        </template>

        <template #tanggalMulai-cell="{ row }">
          <span class="whitespace-nowrap">{{ tanggal(row.original.tanggalMulai) }}</span>
        </template>

        <template #lokasi-cell="{ row }">
          <span class="text-sm text-cc-stone-600">{{ row.original.lokasi ?? '—' }}</span>
        </template>

        <!-- Kolom ini yang memberi tahu event mana yang materinya masih kosong. -->
        <template #isi-cell="{ row }">
          <div class="flex items-center gap-1.5 text-sm">
            <UBadge color="neutral" variant="subtle" size="sm">{{ row.original.jumlahSesi }} sesi</UBadge>
            <UBadge
              :color="row.original.jumlahItem ? 'secondary' : 'neutral'"
              variant="subtle"
              size="sm"
            >
              {{ row.original.jumlahItem }} materi
            </UBadge>
          </div>
        </template>

        <template #terdaftar-cell="{ row }">
          <span class="tabular-nums">
            {{ row.original.terdaftar }}<span v-if="row.original.kuota" class="text-cc-stone-400">/{{ row.original.kuota }}</span>
          </span>
        </template>

        <template #harga-cell="{ row }">
          <span class="whitespace-nowrap text-sm">{{ rupiah(row.original.harga) }}</span>
        </template>

        <template #status-cell="{ row }">
          <div class="flex flex-col gap-1">
            <UBadge :color="warnaStatus(row.original.status)" variant="subtle" size="sm">
              {{ row.original.status }}
            </UBadge>
            <span class="text-[11px] uppercase tracking-wide text-cc-stone-400">{{ row.original.fase }}</span>
          </div>
        </template>

        <template #aksi-cell="{ row }">
          <div class="flex justify-end gap-1">
            <UTooltip text="Ubah event & materi">
              <UButton
                :to="`/admin/event/${row.original.id}`"
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-pencil"
                aria-label="Ubah"
              />
            </UTooltip>
            <UTooltip text="Hapus event">
              <UButton
                color="error"
                variant="ghost"
                size="sm"
                icon="i-lucide-trash-2"
                aria-label="Hapus"
                @click="hapusTarget = { id: row.original.id, judul: row.original.judul }; galat = ''"
              />
            </UTooltip>
          </div>
        </template>
      </UTable>
    </UCard>

    <UModal :open="Boolean(hapusTarget)" title="Hapus event" @update:open="hapusTarget = null">
      <template #body>
        <p class="text-sm text-cc-stone-700">
          Hapus <strong>{{ hapusTarget?.judul }}</strong>? Seluruh sesi dan materinya ikut terhapus.
          Berkas di pustaka media tetap tersimpan.
        </p>
        <UAlert v-if="galat" color="error" variant="subtle" class="mt-3" :description="galat" />
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="hapusTarget = null">Batal</UButton>
          <UButton color="error" :loading="sibuk" @click="hapus">Hapus</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
