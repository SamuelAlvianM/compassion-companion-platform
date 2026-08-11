<script setup lang="ts">
// Pemilih berkas dari pustaka media.
//
// Sebelumnya ini panel yang mekar di dalam SesiItemModal: satu kisi tiga kolom yang
// menyelip di antara isian form, dengan tombolnya sendiri untuk menutup. Dua
// masalahnya nyata, bukan selera:
//
//   1. Ia mendorong tombol Simpan keluar dari layar. Formnya sudah setinggi modal,
//      dan menambahkan kisi bergulir di tengahnya berarti tombol terakhir hanya bisa
//      dicapai setelah menggulir melewati pustaka.
//   2. Tidak ada cara mencari. Pustaka tumbuh setiap unggahan; memilih berkas
//      berarti menggulir kisi 24 petak sambil membaca nama yang terpotong.
//
// Sebagai modal sendiri, ia memakai seluruh lebar layar, punya kotak pencarian, dan
// menutup dirinya begitu satu berkas dipilih — form di baliknya tidak berubah bentuk
// sama sekali.

const props = defineProps<{
  open: boolean
  /** Batasi ke satu jenis, mis. 'gambar' untuk galeri. */
  hanyaKind?: 'gambar' | 'video' | 'etc'
  /** Yang sedang terpasang, untuk ditandai di kisi. */
  terpilihId?: string | null
}>()

const emit = defineEmits<{
  'update:open': [boolean]
  'pilih': [{ id: string, originalName: string, publicUrl: string, kind: string }]
}>()

const cari = ref('')
const cariDebounce = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
watch(cari, (nilai) => {
  clearTimeout(timer)
  timer = setTimeout(() => { cariDebounce.value = nilai }, 300)
})

// Dimuat malas: daftarnya baru diambil saat modalnya benar-benar dibuka, supaya
// membuka form untuk menempel satu tautan tidak ikut menarik seluruh pustaka.
const { data, status, refresh } = useFetch<any>('/api/media', {
  query: computed(() => ({
    limit: 60,
    cari: cariDebounce.value || undefined,
    kind: props.hanyaKind || undefined,
  })),
  immediate: false,
  watch: false,
})

watch([() => props.open, cariDebounce], ([terbuka]) => {
  if (terbuka) refresh()
})

const berkas = computed(() => data.value?.data ?? [])

const ukuranBerkas = (bytes: number) => {
  const satuan = ['B', 'KB', 'MB', 'GB']
  let n = bytes
  let i = 0
  while (n >= 1024 && i < satuan.length - 1) { n /= 1024; i++ }
  return `${n < 10 && i > 0 ? n.toFixed(1) : Math.round(n)} ${satuan[i]}`
}

const pilih = (m: any) => {
  emit('pilih', m)
  emit('update:open', false)
}
</script>

<template>
  <UModal
    :open="open"
    title="Pustaka media"
    description="Pilih berkas yang sudah pernah diunggah — tanpa menggandakannya."
    :ui="{ content: 'max-w-3xl' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <UInput
        v-model="cari"
        icon="i-lucide-search"
        placeholder="Cari nama berkas…"
        class="mb-4 w-full"
      />

      <div v-if="status === 'pending'" class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <USkeleton v-for="n in 8" :key="n" class="aspect-square w-full rounded-lg" />
      </div>

      <div v-else-if="!berkas.length" class="py-10 text-center">
        <UIcon name="i-lucide-folder-open" class="size-8 text-cc-stone-300" />
        <p class="mt-2 text-sm text-cc-stone-500">
          {{ cari ? 'Tidak ada berkas yang cocok dengan pencarian ini.' : 'Pustaka media masih kosong.' }}
        </p>
      </div>

      <!-- Kisi, bukan tabel: yang dicari orang di sini adalah berkasnya, dan untuk
           gambar itu berarti melihatnya. -->
      <div v-else class="grid max-h-[55vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-4">
        <button
          v-for="m in berkas"
          :key="m.id"
          type="button"
          class="group overflow-hidden rounded-lg border-2 bg-white text-left transition-all hover:shadow-sm"
          :class="terpilihId === m.id
            ? 'border-cc-brown-500 ring-2 ring-cc-brown-500/20'
            : 'border-cc-stone-200 hover:border-cc-brown-300'"
          @click="pilih(m)"
        >
          <div class="relative">
            <img
              v-if="m.kind === 'gambar'"
              :src="m.publicUrl"
              :alt="m.originalName"
              class="aspect-square w-full object-cover"
              loading="lazy"
            >
            <div v-else class="grid aspect-square w-full place-items-center bg-cc-stone-100">
              <UIcon
                :name="m.kind === 'video' ? 'i-lucide-play' : 'i-lucide-file'"
                class="size-7 text-cc-stone-400"
              />
            </div>

            <span
              v-if="terpilihId === m.id"
              class="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-cc-brown-500 text-white"
            >
              <UIcon name="i-lucide-check" class="size-3" />
            </span>
          </div>

          <div class="p-2">
            <p class="truncate text-xs font-semibold text-cc-green-800" :title="m.originalName">
              {{ m.originalName }}
            </p>
            <p class="text-[11px] text-cc-stone-500">{{ ukuranBerkas(m.fileSize) }}</p>
          </div>
        </button>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-between">
        <span class="text-xs text-cc-stone-500">Klik satu berkas untuk memilihnya.</span>
        <UButton color="neutral" variant="ghost" @click="emit('update:open', false)">Tutup</UButton>
      </div>
    </template>
  </UModal>
</template>
