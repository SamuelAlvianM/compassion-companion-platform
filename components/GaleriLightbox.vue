<script setup lang="ts">
// Penampil foto galeri: zoom, geser, dan putar.
//
// Transform-nya satu string `translate → scale → rotate`, bukan tiga properti CSS
// terpisah, karena urutan transform menentukan hasilnya: memutar dulu lalu menggeser
// akan menggeser sepanjang sumbu yang ikut miring.

export interface FotoGaleri {
  id: string
  judul: string
  url: string | null
}

const props = defineProps<{ foto: FotoGaleri[], isEn?: boolean }>()
const open = defineModel<boolean>('open', { required: true })
const indeks = defineModel<number>('indeks', { default: 0 })

const skala = ref(1)
const putaran = ref(0)
const geser = ref({ x: 0, y: 0 })

const aktif = computed(() => props.foto[indeks.value] ?? null)

const teks = computed(() => props.isEn
  ? { zoomIn: 'Zoom in', zoomOut: 'Zoom out', putar: 'Rotate', reset: 'Reset view', tutup: 'Close', sebelum: 'Previous photo', sesudah: 'Next photo' }
  : { zoomIn: 'Perbesar', zoomOut: 'Perkecil', putar: 'Putar', reset: 'Kembalikan tampilan', tutup: 'Tutup', sebelum: 'Foto sebelumnya', sesudah: 'Foto berikutnya' })

const reset = () => {
  skala.value = 1
  putaran.value = 0
  geser.value = { x: 0, y: 0 }
}

// Setiap ganti foto tampilannya dikembalikan — kalau tidak, foto berikutnya muncul
// dalam keadaan ter-zoom dan terputar mengikuti foto sebelumnya.
watch(indeks, reset)
watch(open, (nilai) => { if (nilai) reset() })

const zoom = (delta: number) => {
  skala.value = Math.min(6, Math.max(0.5, Number((skala.value + delta).toFixed(2))))
  if (skala.value <= 1) geser.value = { x: 0, y: 0 }
}

const putar = (arah: number) => { putaran.value = (putaran.value + arah * 90) % 360 }

const pindah = (arah: number) => {
  if (!props.foto.length) return
  indeks.value = (indeks.value + arah + props.foto.length) % props.foto.length
}

const gaya = computed(() => ({
  transform: `translate(${geser.value.x}px, ${geser.value.y}px) scale(${skala.value}) rotate(${putaran.value}deg)`,
  cursor: skala.value > 1 ? (menyeret.value ? 'grabbing' : 'grab') : 'default',
}))

// Geser hanya masuk akal saat gambar lebih besar dari bingkainya.
const menyeret = ref(false)
const awal = ref({ x: 0, y: 0 })

const mulaiSeret = (e: PointerEvent) => {
  if (skala.value <= 1) return
  menyeret.value = true
  awal.value = { x: e.clientX - geser.value.x, y: e.clientY - geser.value.y }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

const seret = (e: PointerEvent) => {
  if (!menyeret.value) return
  geser.value = { x: e.clientX - awal.value.x, y: e.clientY - awal.value.y }
}

const selesaiSeret = () => { menyeret.value = false }

const roda = (e: WheelEvent) => {
  e.preventDefault()
  zoom(e.deltaY < 0 ? 0.2 : -0.2)
}

// Pintasan papan tik dipasang di kontainer modal, bukan window, supaya tidak
// menyerobot tombol panah saat lightbox tertutup.
const tombol = (e: KeyboardEvent) => {
  if (e.key === 'ArrowRight') pindah(1)
  else if (e.key === 'ArrowLeft') pindah(-1)
  else if (e.key === '+' || e.key === '=') zoom(0.2)
  else if (e.key === '-') zoom(-0.2)
  else if (e.key.toLowerCase() === 'r') putar(1)
  else if (e.key === '0') reset()
}
</script>

<template>
  <UModal
    v-model:open="open"
    fullscreen
    :ui="{ content: 'bg-cc-stone-950/95', body: 'p-0' }"
  >
    <template #content>
      <div
        class="relative flex h-full w-full flex-col outline-none"
        tabindex="-1"
        @keydown="tombol"
      >
        <!-- Bilah kendali -->
        <div class="flex items-center gap-1 border-b border-white/10 px-3 py-2 text-white">
          <span class="mr-2 min-w-0 truncate text-sm">{{ aktif?.judul }}</span>
          <span class="text-xs text-white/50">{{ indeks + 1 }} / {{ foto.length }}</span>

          <div class="ml-auto flex items-center gap-1">
            <UTooltip :text="teks.zoomOut">
              <UButton color="neutral" variant="ghost" icon="i-lucide-zoom-out" :aria-label="teks.zoomOut" @click="zoom(-0.2)" />
            </UTooltip>
            <span class="w-12 text-center text-xs tabular-nums text-white/70">{{ Math.round(skala * 100) }}%</span>
            <UTooltip :text="teks.zoomIn">
              <UButton color="neutral" variant="ghost" icon="i-lucide-zoom-in" :aria-label="teks.zoomIn" @click="zoom(0.2)" />
            </UTooltip>
            <UTooltip :text="teks.putar">
              <UButton color="neutral" variant="ghost" icon="i-lucide-rotate-cw" :aria-label="teks.putar" @click="putar(1)" />
            </UTooltip>
            <UTooltip :text="teks.reset">
              <UButton color="neutral" variant="ghost" icon="i-lucide-refresh-ccw" :aria-label="teks.reset" @click="reset" />
            </UTooltip>
            <UTooltip :text="teks.tutup">
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" :aria-label="teks.tutup" @click="open = false" />
            </UTooltip>
          </div>
        </div>

        <!-- Panggung -->
        <div
          class="relative flex-1 overflow-hidden"
          @wheel="roda"
          @pointerdown="mulaiSeret"
          @pointermove="seret"
          @pointerup="selesaiSeret"
          @pointercancel="selesaiSeret"
        >
          <img
            v-if="aktif?.url"
            :src="aktif.url"
            :alt="aktif.judul"
            class="absolute inset-0 m-auto max-h-full max-w-full select-none object-contain transition-transform duration-150"
            :style="gaya"
            draggable="false"
          >

          <template v-if="foto.length > 1">
            <UButton
              color="neutral"
              variant="solid"
              icon="i-lucide-chevron-left"
              class="absolute left-4 top-1/2 -translate-y-1/2"
              :aria-label="teks.sebelum"
              @click="pindah(-1)"
            />
            <UButton
              color="neutral"
              variant="solid"
              icon="i-lucide-chevron-right"
              class="absolute right-4 top-1/2 -translate-y-1/2"
              :aria-label="teks.sesudah"
              @click="pindah(1)"
            />
          </template>
        </div>
      </div>
    </template>
  </UModal>
</template>
