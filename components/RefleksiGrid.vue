<script setup lang="ts">
// Kisi refleksi bergaya Instagram: kartu persegi, rapat, tanpa judul —
// yang menonjol isinya dan kegiatan asalnya.

interface Refleksi {
  id: string
  isi: string
  visibilitas: 'publik' | 'peserta' | 'pribadi'
  createdAt: string
  kegiatanSlug: string | null
  kegiatanJudul: string | null
  gambar: string | null
}

const props = defineProps<{
  refleksi: Refleksi[]
  isEn: boolean
  bolehHapus?: boolean
}>()

const emit = defineEmits<{ hapus: [string] }>()

const terbuka = ref<Refleksi | null>(null)

const t = computed(() => props.isEn
  ? { kosong: 'No reflections yet.', kosongIntro: 'Reflections written after an event will appear here.',
      pribadi: 'Private', peserta: 'Participants only', hapus: 'Delete', tutup: 'Close', pada: 'on' }
  : { kosong: 'Belum ada refleksi.', kosongIntro: 'Refleksi yang ditulis setelah kegiatan akan muncul di sini.',
      pribadi: 'Pribadi', peserta: 'Khusus peserta', hapus: 'Hapus', tutup: 'Tutup', pada: 'pada' })

const tanggal = (nilai: string) =>
  new Intl.DateTimeFormat(props.isEn ? 'en-GB' : 'id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta',
  }).format(new Date(nilai))

const lencana = (v: Refleksi['visibilitas']) =>
  v === 'pribadi' ? { label: t.value.pribadi, icon: 'i-lucide-lock' }
    : v === 'peserta' ? { label: t.value.peserta, icon: 'i-lucide-users' }
      : null
</script>

<template>
  <div>
    <div v-if="!refleksi.length" class="rounded-xl border border-dashed border-cc-stone-300 p-10 text-center">
      <UIcon name="i-lucide-feather" class="size-8 text-cc-stone-400" />
      <p class="mt-3 font-semibold text-cc-green-800">{{ t.kosong }}</p>
      <p class="mt-1 text-sm text-cc-stone-500">{{ t.kosongIntro }}</p>
    </div>

    <div v-else class="grid grid-cols-2 gap-1 sm:grid-cols-3 sm:gap-1.5">
      <button
        v-for="item in refleksi"
        :key="item.id"
        type="button"
        class="group relative aspect-square overflow-hidden rounded-sm bg-cc-stone-100 text-left transition hover:opacity-95"
        @click="terbuka = item"
      >
        <img
          v-if="item.gambar"
          :src="item.gambar"
          alt=""
          class="size-full object-cover transition duration-300 group-hover:scale-105"
        >
        <!-- Tanpa gambar: kutipan itu sendiri yang jadi visualnya. -->
        <div
          v-else
          class="flex size-full flex-col justify-between bg-gradient-to-br from-cc-green-800 to-cc-brown-600 p-4 text-cc-stone-50"
        >
          <UIcon name="i-lucide-quote" class="size-5 opacity-60" />
          <p class="line-clamp-5 font-serif text-lg leading-snug">{{ item.isi }}</p>
        </div>

        <div
          v-if="item.gambar"
          class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3"
        >
          <p class="line-clamp-2 text-xs text-white">{{ item.isi }}</p>
        </div>

        <UIcon
          v-if="lencana(item.visibilitas)"
          :name="lencana(item.visibilitas)!.icon"
          class="absolute right-2 top-2 size-4 text-white drop-shadow"
        />
      </button>
    </div>

    <!-- Detail satu refleksi -->
    <UModal
      :open="terbuka !== null"
      :title="terbuka?.kegiatanJudul ?? (isEn ? 'Reflection' : 'Refleksi')"
      :description="terbuka ? `${tanggal(terbuka.createdAt)}` : ''"
      @update:open="v => { if (!v) terbuka = null }"
    >
      <template #body>
        <div v-if="terbuka" class="space-y-4">
          <img v-if="terbuka.gambar" :src="terbuka.gambar" alt="" class="w-full rounded-lg">

          <p class="whitespace-pre-line leading-relaxed text-cc-stone-700">{{ terbuka.isi }}</p>

          <div class="flex flex-wrap items-center gap-2">
            <UBadge v-if="terbuka.kegiatanJudul" color="secondary" variant="subtle" size="sm">
              {{ terbuka.kegiatanJudul }}
            </UBadge>
            <UBadge v-if="lencana(terbuka.visibilitas)" color="neutral" variant="subtle" size="sm">
              {{ lencana(terbuka.visibilitas)!.label }}
            </UBadge>
          </div>

          <div class="flex gap-2 pt-2">
            <UButton color="neutral" variant="outline" class="flex-1" @click="terbuka = null">
              {{ t.tutup }}
            </UButton>
            <UButton
              v-if="bolehHapus"
              color="error"
              variant="soft"
              icon="i-lucide-trash-2"
              @click="emit('hapus', terbuka.id); terbuka = null"
            >
              {{ t.hapus }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
