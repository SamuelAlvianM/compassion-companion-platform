<script setup lang="ts">
// Editor satu gambar: putar, potong, zoom, geser, pratinjau.
//
// Zoom dan geser sengaja TIDAK memengaruhi hasil. Keduanya alat lihat — untuk
// memeriksa apakah bagian yang dipotong benar-benar tajam dan tidak memotong wajah
// orang — sementara kotak potongnya sendiri tersimpan dalam piksel sumber (lihat
// utils/potongGambar.ts). Membuat zoom ikut menentukan hasil membuat berkas
// keluarannya bergantung pada lebar jendela browser saat itu.
//
// Putaran mengembalikan potongan ke seluruh gambar. Memetakan kotak potong lama ke
// ruang yang sudah diputar sebenarnya bisa dihitung, tapi hasilnya membingungkan:
// setelah memutar 90°, kotak yang tadi "kepala orangnya" mendarat di tempat yang
// sama sekali lain, dan orang harus membetulkannya lagi dari nol. Mengembalikannya
// ke penuh setidaknya jujur tentang itu.

import { ukuranTerputar, type PotonganGambar } from '../utils/potongGambar'

const props = defineProps<{
  /** Object URL gambar yang sedang disunting. */
  sumber: string
  isEn?: boolean
  /**
   * Rasio yang tidak bisa diubah, mis. 16/9 untuk sampul event.
   *
   * Dipakai saat gambarnya menempati bingkai yang ukurannya sudah ditentukan
   * halaman tujuannya. Di situ "bebas" bukan kebebasan melainkan jebakan: apa pun
   * yang dipilih tetap akan dipotong ulang oleh CSS, dan yang hilang justru bagian
   * yang barusan dipilih dengan susah payah.
   */
  rasioTetap?: number | null
  /** Tombol "Ganti gambar" disembunyikan bila penggantinya diurus induk. */
  tanpaGanti?: boolean
}>()

const nilai = defineModel<PotonganGambar>({ required: true })

const emit = defineEmits<{ ganti: [] }>()

const t = computed(() => props.isEn
  ? {
      kiri: 'Rotate left', kanan: 'Rotate right', zoomIn: 'Zoom in', zoomOut: 'Zoom out',
      reset: 'Reset crop', ganti: 'Replace image', rasio: 'Ratio', bebas: 'Free',
      petunjuk: 'Drag the corners to crop. Zoom and drag only change what you see.',
      pratinjau: 'Preview', sunting: 'Edit',
    }
  : {
      kiri: 'Putar kiri', kanan: 'Putar kanan', zoomIn: 'Perbesar', zoomOut: 'Perkecil',
      reset: 'Kembalikan potongan', ganti: 'Ganti gambar', rasio: 'Rasio', bebas: 'Bebas',
      petunjuk: 'Tarik sudutnya untuk memotong. Zoom dan geser hanya mengubah tampilan.',
      pratinjau: 'Pratinjau', sunting: 'Sunting',
    })

const RASIO = [
  { nilai: null, label: () => t.value.bebas },
  { nilai: 1, label: () => '1:1' },
  { nilai: 4 / 3, label: () => '4:3' },
  { nilai: 3 / 4, label: () => '3:4' },
  { nilai: 16 / 9, label: () => '16:9' },
]

// ── Muat gambar ──────────────────────────────────────────────────────────────
const panggung = useTemplateRef<HTMLElement>('panggung')
const ukuranPanggung = ref({ w: 0, h: 0 })

const terputar = computed(() => nilai.value.natural
  ? ukuranTerputar(nilai.value.natural, nilai.value.putaran)
  : { w: 0, h: 0 })

/** Skala dasar agar seluruh gambar muat di panggung. Dipisah dari `zoom` supaya
    zoom selalu berarti "berapa kali dari tampilan pas", bukan angka mutlak. */
const pas = computed(() => {
  const { w, h } = terputar.value
  const { w: pw, h: ph } = ukuranPanggung.value
  if (!w || !h || !pw || !ph) return 1
  return Math.min(pw / w, ph / h)
})

const tampil = computed(() => pas.value * nilai.value.zoom)

const ukurPanggung = () => {
  if (!panggung.value) return
  ukuranPanggung.value = {
    w: panggung.value.clientWidth,
    h: panggung.value.clientHeight,
  }
}

/** Potongan penuh — dipakai saat gambar baru dimuat, diputar, atau direset. */
const potonganPenuh = () => {
  const { w, h } = terputar.value
  return { x: 0, y: 0, w, h }
}

const muat = () => {
  const img = new Image()
  img.onload = () => {
    nilai.value = {
      ...nilai.value,
      natural: { w: img.naturalWidth, h: img.naturalHeight },
      // Potongan hanya disusun ulang kalau memang belum ada. Gambar yang sudah
      // pernah dipotong lalu dibuka lagi harus kembali dengan kotaknya utuh.
      crop: nilai.value.crop.w ? nilai.value.crop : { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight },
    }
    // Kotak awal langsung mengikuti rasio yang dikunci; tanpa ini gambar terbuka
    // dengan potongan penuh yang bentuknya sudah pasti salah.
    if (props.rasioTetap && !nilai.value.rasio) nextTick(() => pakaiRasio(props.rasioTetap!))
    nextTick(ukurPanggung)
  }
  img.src = props.sumber
}

onMounted(() => {
  ukurPanggung()
  window.addEventListener('resize', ukurPanggung)
  muat()
})
onBeforeUnmount(() => window.removeEventListener('resize', ukurPanggung))
watch(() => props.sumber, muat)

// ── Putar, zoom, reset ───────────────────────────────────────────────────────
const putar = (arah: 1 | -1) => {
  const baru = (((nilai.value.putaran + arah * 90) % 360) + 360) % 360 as 0 | 90 | 180 | 270
  nilai.value = { ...nilai.value, putaran: baru, crop: { x: 0, y: 0, w: 0, h: 0 } }
  nextTick(() => { nilai.value = { ...nilai.value, crop: potonganPenuh() } })
}

const zoom = (delta: number) => {
  const z = Math.min(5, Math.max(1, Number((nilai.value.zoom + delta).toFixed(2))))
  nilai.value = { ...nilai.value, zoom: z, ...(z === 1 ? { panX: 0, panY: 0 } : {}) }
}

const resetPotongan = () => {
  // Rasio terkunci tidak ikut direset — kalau ikut, satu klik "kembalikan
  // potongan" akan melepas kunci yang justru jadi alasan editor ini dibuka.
  if (props.rasioTetap) { pakaiRasio(props.rasioTetap); return }
  nilai.value = { ...nilai.value, crop: potonganPenuh(), rasio: null }
}

const pakaiRasio = (r: number | null) => {
  nilai.value = { ...nilai.value, rasio: r }
  if (r === null) return
  // Kotak baru dibuat sebesar-besarnya di tengah gambar, bukan diperas dari kotak
  // yang sekarang: memaksa rasio pada kotak sempit menghasilkan potongan
  // seujung kuku yang lalu harus dibesarkan manual dari nol.
  const { w, h } = terputar.value
  let cw = w
  let ch = cw / r
  if (ch > h) { ch = h; cw = ch * r }
  nilai.value = {
    ...nilai.value,
    crop: { x: (w - cw) / 2, y: (h - ch) / 2, w: cw, h: ch },
  }
}

// ── Geser tampilan ───────────────────────────────────────────────────────────
const menggeser = ref(false)
const awalGeser = ref({ x: 0, y: 0 })

const mulaiGeser = (e: PointerEvent) => {
  if (nilai.value.zoom <= 1) return
  menggeser.value = true
  awalGeser.value = { x: e.clientX - nilai.value.panX, y: e.clientY - nilai.value.panY }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

const geser = (e: PointerEvent) => {
  if (!menggeser.value) return
  nilai.value = {
    ...nilai.value,
    panX: e.clientX - awalGeser.value.x,
    panY: e.clientY - awalGeser.value.y,
  }
}

const selesaiGeser = () => { menggeser.value = false }

const roda = (e: WheelEvent) => {
  e.preventDefault()
  zoom(e.deltaY < 0 ? 0.2 : -0.2)
}

// ── Kotak potong ─────────────────────────────────────────────────────────────
type Pegangan = 'pindah' | 'kiri-atas' | 'kanan-atas' | 'kiri-bawah' | 'kanan-bawah'

const menarik = ref<Pegangan | null>(null)
const awalTarik = ref({ x: 0, y: 0, crop: { x: 0, y: 0, w: 0, h: 0 } })

const MIN = 24 // piksel sumber; di bawah ini potongannya tidak lagi berguna

const mulaiTarik = (e: PointerEvent, pegangan: Pegangan) => {
  e.stopPropagation()
  menarik.value = pegangan
  awalTarik.value = { x: e.clientX, y: e.clientY, crop: { ...nilai.value.crop } }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

const tarik = (e: PointerEvent) => {
  if (!menarik.value) return
  // Selisih layar dibagi skala tampilan → selisih dalam piksel sumber. Ini
  // satu-satunya tempat kedua sistem koordinat itu bertemu.
  const dx = (e.clientX - awalTarik.value.x) / tampil.value
  const dy = (e.clientY - awalTarik.value.y) / tampil.value
  const batas = terputar.value
  const asal = awalTarik.value.crop

  if (menarik.value === 'pindah') {
    nilai.value = {
      ...nilai.value,
      crop: {
        ...asal,
        x: Math.min(Math.max(0, asal.x + dx), batas.w - asal.w),
        y: Math.min(Math.max(0, asal.y + dy), batas.h - asal.h),
      },
    }
    return
  }

  const kiri = menarik.value.startsWith('kiri')
  const atas = menarik.value.endsWith('atas')

  // Sudut yang BERSEBERANGAN dengan yang ditarik tetap diam — itu yang membuat
  // menarik terasa seperti menarik sudut, bukan menggeser seluruh kotak.
  const jangkarX = kiri ? asal.x + asal.w : asal.x
  const jangkarY = atas ? asal.y + asal.h : asal.y

  let w = Math.max(MIN, kiri ? asal.w - dx : asal.w + dx)
  let h = Math.max(MIN, atas ? asal.h - dy : asal.h + dy)

  if (nilai.value.rasio) {
    // Dengan rasio terkunci, sisi yang lebih banyak bergerak yang memimpin —
    // kalau tidak, menarik ke samping terasa macet pada rasio tinggi.
    if (Math.abs(dx) > Math.abs(dy)) h = w / nilai.value.rasio
    else w = h * nilai.value.rasio
  }

  // Dijepit ke tepi gambar. Dengan rasio terkunci kedua sisi dijepit bersamaan,
  // supaya menyentuh tepi tidak diam-diam mengubah rasionya.
  w = Math.min(w, kiri ? jangkarX : batas.w - jangkarX)
  h = Math.min(h, atas ? jangkarY : batas.h - jangkarY)
  if (nilai.value.rasio) {
    if (w / nilai.value.rasio > h) w = h * nilai.value.rasio
    else h = w / nilai.value.rasio
  }

  nilai.value = {
    ...nilai.value,
    crop: {
      x: kiri ? jangkarX - w : jangkarX,
      y: atas ? jangkarY - h : jangkarY,
      w,
      h,
    },
  }
}

const selesaiTarik = () => { menarik.value = null }

// ── Gaya ─────────────────────────────────────────────────────────────────────
const gayaKanvas = computed(() => ({
  width: `${terputar.value.w * tampil.value}px`,
  height: `${terputar.value.h * tampil.value}px`,
  transform: `translate(${nilai.value.panX}px, ${nilai.value.panY}px)`,
}))

const gayaGambar = computed(() => {
  const n = nilai.value.natural
  if (!n) return {}
  return {
    width: `${n.w * tampil.value}px`,
    height: `${n.h * tampil.value}px`,
    transform: `translate(-50%, -50%) rotate(${nilai.value.putaran}deg)`,
  }
})

const gayaPotongan = computed(() => ({
  left: `${nilai.value.crop.x * tampil.value}px`,
  top: `${nilai.value.crop.y * tampil.value}px`,
  width: `${nilai.value.crop.w * tampil.value}px`,
  height: `${nilai.value.crop.h * tampil.value}px`,
}))

const ukuranHasil = computed(() =>
  `${Math.round(nilai.value.crop.w)} × ${Math.round(nilai.value.crop.h)} px`)

const SUDUT: { pegangan: Pegangan, kelas: string, kursor: string }[] = [
  { pegangan: 'kiri-atas', kelas: '-left-1.5 -top-1.5', kursor: 'nwse-resize' },
  { pegangan: 'kanan-atas', kelas: '-right-1.5 -top-1.5', kursor: 'nesw-resize' },
  { pegangan: 'kiri-bawah', kelas: '-left-1.5 -bottom-1.5', kursor: 'nesw-resize' },
  { pegangan: 'kanan-bawah', kelas: '-right-1.5 -bottom-1.5', kursor: 'nwse-resize' },
]
</script>

<template>
  <div>
    <!-- Bilah kendali -->
    <div class="mb-2 flex flex-wrap items-center gap-1">
      <UTooltip :text="t.kiri">
        <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-rotate-ccw" :aria-label="t.kiri" @click="putar(-1)" />
      </UTooltip>
      <UTooltip :text="t.kanan">
        <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-rotate-cw" :aria-label="t.kanan" @click="putar(1)" />
      </UTooltip>

      <span class="mx-1 h-5 w-px bg-cc-stone-200" />

      <UTooltip :text="t.zoomOut">
        <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-zoom-out" :aria-label="t.zoomOut" @click="zoom(-0.2)" />
      </UTooltip>
      <span class="w-12 text-center text-xs tabular-nums text-cc-stone-500">
        {{ Math.round(nilai.zoom * 100) }}%
      </span>
      <UTooltip :text="t.zoomIn">
        <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-zoom-in" :aria-label="t.zoomIn" @click="zoom(0.2)" />
      </UTooltip>

      <span class="mx-1 h-5 w-px bg-cc-stone-200" />

      <span class="text-xs text-cc-stone-500">{{ t.rasio }}</span>
      <span v-if="rasioTetap" class="rounded-full bg-cc-green-800 px-2 py-1 text-xs font-semibold text-white">
        {{ Math.round(rasioTetap * 100) / 100 }}:1
      </span>
      <button
        v-for="r in (rasioTetap ? [] : RASIO)"
        :key="String(r.nilai)"
        type="button"
        class="rounded-full px-2 py-1 text-xs font-semibold transition-colors"
        :class="nilai.rasio === r.nilai
          ? 'bg-cc-green-800 text-white'
          : 'text-cc-stone-600 hover:bg-cc-stone-100'"
        @click="pakaiRasio(r.nilai)"
      >
        {{ r.label() }}
      </button>

      <span class="ml-auto flex items-center gap-1">
        <UButton color="neutral" variant="ghost" size="xs" icon="i-lucide-refresh-ccw" @click="resetPotongan">
          {{ t.reset }}
        </UButton>
        <UButton v-if="!tanpaGanti" color="neutral" variant="ghost" size="xs" icon="i-lucide-image-plus" @click="emit('ganti')">
          {{ t.ganti }}
        </UButton>
      </span>
    </div>

    <!-- Panggung. Latar kotak-kotak supaya bagian transparan PNG terlihat sebagai
         transparan, bukan sebagai putih yang kebetulan sama dengan latar modal. -->
    <div
      ref="panggung"
      class="relative h-[340px] w-full overflow-hidden rounded-lg bg-[repeating-conic-gradient(#e9e4dc_0_25%,#f7f4ef_0_50%)] bg-[length:18px_18px]"
      :style="{ cursor: nilai.zoom > 1 ? (menggeser ? 'grabbing' : 'grab') : 'default' }"
      @wheel="roda"
      @pointerdown="mulaiGeser"
      @pointermove="(e: PointerEvent) => { geser(e); tarik(e) }"
      @pointerup="() => { selesaiGeser(); selesaiTarik() }"
      @pointercancel="() => { selesaiGeser(); selesaiTarik() }"
    >
      <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div class="relative" :style="gayaKanvas">
          <img
            :src="sumber"
            alt=""
            class="absolute left-1/2 top-1/2 max-w-none select-none"
            :style="gayaGambar"
            draggable="false"
          >

          <!-- Peredup di luar potongan: yang dibuang harus terlihat dibuang, bukan
               sekadar berada di luar sebuah garis tipis. -->
          <div v-if="nilai.crop.w" class="pointer-events-none absolute inset-0 bg-black/45" />

          <div
            v-if="nilai.crop.w"
            class="absolute cursor-move outline outline-2 outline-white"
            :style="gayaPotongan"
            @pointerdown="(e: PointerEvent) => mulaiTarik(e, 'pindah')"
          >
            <!-- Bagian dalam potongan dibersihkan dari peredup dengan menampilkan
                 ulang gambarnya, bukan dengan lubang di lapisan gelap: `clip-path`
                 pada peredup akan ikut memotong pegangan sudutnya. -->
            <div class="absolute inset-0 overflow-hidden">
              <img
                :src="sumber"
                alt=""
                class="absolute max-w-none select-none"
                :style="{
                  ...gayaGambar,
                  left: `${(terputar.w / 2 - nilai.crop.x) * tampil}px`,
                  top: `${(terputar.h / 2 - nilai.crop.y) * tampil}px`,
                }"
                draggable="false"
              >
            </div>

            <!-- Garis sepertiga, penanda komposisi yang lazim di pemotong foto -->
            <div class="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
              <span v-for="n in 9" :key="n" class="border border-white/25" />
            </div>

            <span
              v-for="s in SUDUT"
              :key="s.pegangan"
              class="absolute size-3 rounded-full border-2 border-cc-green-800 bg-white"
              :class="s.kelas"
              :style="{ cursor: s.kursor }"
              @pointerdown="(e: PointerEvent) => mulaiTarik(e, s.pegangan)"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-cc-stone-500">
      <span>{{ t.petunjuk }}</span>
      <span class="tabular-nums">{{ ukuranHasil }}</span>
    </div>
  </div>
</template>
