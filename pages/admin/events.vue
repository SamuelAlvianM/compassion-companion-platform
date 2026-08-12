<script setup lang="ts">
// Daftar event admin — kini dari database, bukan array literal.
// Draft ikut tampil di sini (berbeda dari /api/events publik yang menyaringnya).
definePageMeta({ layout: 'admin' })

const cari = ref('')
// 'semua' sebagai sentinel: Reka UI memesan string kosong untuk keadaan "belum
// dipilih" dan melempar error kalau ada item bernilai ''.
//
// Yang disaring FASE, bukan kolom `status`. Status redaksional
// (draft/terbit/selesai/batal) sudah tidak dipasang formulir mana pun sejak fase
// dijadikan murni turunan tanggal, jadi menyaringnya hanya akan menawarkan
// pembedaan yang tidak bisa lagi dibuat siapa pun.
const fase = ref('semua')

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
    fase: fase.value === 'semua' ? undefined : fase.value,
  })),
})

const events = computed(() => data.value?.data ?? [])
const perFase = computed(() => data.value?.meta?.perFase ?? ({} as Record<string, number>))

const faseOptions = computed(() => [
  { value: 'semua', label: 'Semua fase', icon: 'i-lucide-layers' },
  { value: 'mendatang', label: 'Mendatang', icon: 'i-lucide-calendar-clock' },
  { value: 'berlangsung', label: 'Berlangsung', icon: 'i-lucide-radio' },
  { value: 'selesai', label: 'Selesai', icon: 'i-lucide-check' },
  { value: 'batal', label: 'Dibatalkan', icon: 'i-lucide-x' },
])

const ikonFase = computed(() =>
  faseOptions.value.find(o => o.value === fase.value)?.icon ?? 'i-lucide-layers')

const tanggal = (nilai: string | null) => nilai
  ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date(nilai))
  : '—'

const warnaFase = (f: string) => ({
  mendatang: 'primary', berlangsung: 'secondary', selesai: 'neutral', batal: 'error',
}[f] ?? 'neutral') as 'neutral' | 'primary' | 'secondary' | 'error'

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

// Kolom "Biaya" dan "Status" dihapus lebih dulu; sekarang delapan kolom disusutkan
// jadi lima.
//
// Delapan kolom tidak muat di layar mana pun, dan yang terdorong keluar justru
// kolom aksi di ujung kanan — tombol ubah & hapus baru terlihat setelah tabelnya
// digulir mendatar, padahal itu yang paling sering dicari orang di halaman ini.
//
// Yang digabung dipilih menurut apa yang dibaca bersamaan: lokasi menempel ke nama
// event (keduanya menjawab "event yang mana"), batas pendaftaran menempel ke
// tanggal (keduanya jadwal), dan jumlah peserta menempel ke sesi/materi (keduanya
// isi). Tidak ada informasi yang hilang — yang berubah hanya letaknya.
const columns = [
  { accessorKey: 'judul', header: 'Event' },
  { accessorKey: 'tanggalMulai', header: 'Jadwal' },
  { accessorKey: 'isi', header: 'Isi & peserta' },
  { accessorKey: 'fase', header: 'Fase' },
  { accessorKey: 'aksi', header: '' },
]
</script>

<template>
  <div class="mx-auto max-w-7xl">
    <div class="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
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
      <USelect v-model="fase" :items="faseOptions" value-key="value" :icon="ikonFase" class="w-48" />

      <!-- Hitungan per fase dipasang sebagai chip: ia menjawab "berapa yang sedang
           berjalan" tanpa perlu mengganti filter satu per satu untuk membacanya. -->
      <div class="flex flex-wrap items-center gap-1.5">
        <UBadge
          v-for="o in faseOptions.slice(1)"
          :key="o.value"
          :color="fase === o.value ? warnaFase(o.value) : 'neutral'"
          :variant="fase === o.value ? 'solid' : 'subtle'"
          size="sm"
          class="cursor-pointer rounded-full"
          @click="fase = fase === o.value ? 'semua' : o.value"
        >
          {{ o.label }} · {{ perFase[o.value] ?? 0 }}
        </UBadge>
      </div>

      <span class="ml-auto text-sm text-cc-stone-600">{{ events.length }} event</span>
    </div>

    <UCard :ui="{ body: 'p-0' }">
      <UTable
        :data="events"
        :columns="columns"
        :loading="muat === 'pending'"
        empty="Belum ada event. Klik “Event baru” untuk membuat yang pertama."
      >
        <!-- Nama event + lokasinya. Slug dibuang dari tampilan: ia hanya berarti
             saat menyusun tautan, dan barisnya menggandakan tinggi tiap baris tabel
             untuk sesuatu yang tidak dibaca sambil lalu. -->
        <template #judul-cell="{ row }">
          <NuxtLink
            :to="`/admin/event/${row.original.id}`"
            class="font-semibold text-cc-green-800 hover:text-cc-brown-500 hover:underline"
          >
            {{ row.original.judul }}
          </NuxtLink>
          <div class="flex items-center gap-1 text-xs text-cc-stone-500">
            <UIcon name="i-lucide-map-pin" class="size-3 shrink-0" />
            <span class="truncate">{{ row.original.lokasi ?? '—' }}</span>
          </div>
        </template>

        <!-- Jadwal: tanggal acara di atas, batas pendaftaran di bawahnya. Yang
             batasnya sudah lewat ditandai merah — baris seperti itu masih menerima
             klik "Ubah" tapi tidak lagi menerima pendaftar. -->
        <template #tanggalMulai-cell="{ row }">
          <div class="whitespace-nowrap text-sm">
            {{ tanggal(row.original.tanggalMulai) }}
            <template v-if="row.original.tanggalSelesai && row.original.tanggalSelesai !== row.original.tanggalMulai">
              – {{ tanggal(row.original.tanggalSelesai) }}
            </template>
            <span v-if="rentangJam(row.original)" class="text-cc-stone-500">
              · {{ rentangJam(row.original) }}
            </span>
          </div>
          <div
            class="flex items-center gap-1 text-xs whitespace-nowrap"
            :class="row.original.tutupPendaftaran && batasLewat(row.original.tutupPendaftaran)
              ? 'text-red-700'
              : 'text-cc-stone-500'"
          >
            <UIcon name="i-lucide-hourglass" class="size-3 shrink-0" />
            <span v-if="row.original.tutupPendaftaran">
              {{ tanggalJamSingkat(row.original.tutupPendaftaran) }}
            </span>
            <span v-else>Sampai acara mulai</span>
          </div>
        </template>

        <!-- Kolom ini yang memberi tahu event mana yang materinya masih kosong,
             sekaligus berapa yang sudah mendaftar. -->
        <template #isi-cell="{ row }">
          <div class="flex items-center gap-1.5">
            <UBadge color="neutral" variant="subtle" size="sm">{{ row.original.jumlahSesi }} sesi</UBadge>
            <UBadge
              :color="row.original.jumlahItem ? 'secondary' : 'neutral'"
              variant="subtle"
              size="sm"
            >
              {{ row.original.jumlahItem }} materi
            </UBadge>
          </div>
          <div class="flex items-center gap-1 text-xs text-cc-stone-500">
            <UIcon name="i-lucide-users" class="size-3 shrink-0" />
            <span class="tabular-nums">
              {{ row.original.terdaftar }}<template v-if="row.original.kuota">/{{ row.original.kuota }}</template>
            </span>
          </div>
        </template>

        <!-- Fase, bukan status: dihitung dari tanggal setiap kali dibaca, jadi tidak
             ada yang perlu diperbarui manual saat tanggalnya terlewat. -->
        <template #fase-cell="{ row }">
          <UBadge :color="warnaFase(row.original.fase)" variant="subtle" size="sm" class="rounded-full">
            {{ row.original.fase }}
          </UBadge>
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
