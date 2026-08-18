<script setup lang="ts">
// Pembungkus tipis Highcharts untuk Vue.
//
// Highcharts dimuat lewat `import()` DI DALAM onMounted, bukan import biasa di
// kepala berkas. Dua alasannya:
//
//   1. Ia menyentuh `document` saat menggambar. Kalau ikut ter-bundle ke jalur
//      render server, halamannya gagal di SSR sebelum sempat sampai ke browser.
//   2. Berkasnya ratusan kilobyte dan hanya dipakai satu halaman. Dengan dynamic
//      import, yang membuka halaman admin lain tidak ikut mengunduhnya.
//
// Grafiknya TIDAK digambar ulang dari nol saat datanya berubah — `chart.update()`
// yang dipakai, supaya animasi transisinya jalan dan posisi gulir tidak melompat.

import type { Chart, Options } from 'highcharts'

const props = defineProps<{
  options: Options
  tinggi?: number
}>()

const wadah = useTemplateRef<HTMLDivElement>('wadah')
const siap = ref(false)
let chart: Chart | null = null

/** Palet & tipografi brand, dipasang sekali untuk seluruh grafik di halaman.
    Nilainya menyalin --color-* di assets/css/main.css; Highcharts menggambar ke
    SVG dan tidak bisa membaca variabel CSS untuk warna deret. */
const tema: Options = {
  colors: ['#2B4028', '#AC8158', '#E1B032', '#687064', '#7E9A76', '#C7A17A'],
  chart: {
    backgroundColor: 'transparent',
    style: { fontFamily: '"DM Sans", sans-serif' },
    spacing: [8, 8, 8, 8],
  },
  title: { text: undefined },
  credits: { enabled: false },
  legend: { itemStyle: { color: '#687064', fontWeight: '500' } },
  xAxis: {
    labels: { style: { color: '#687064' } },
    lineColor: '#e4d7c6',
    tickColor: '#e4d7c6',
  },
  yAxis: {
    title: { text: undefined },
    labels: { style: { color: '#687064' } },
    gridLineColor: '#e4d7c6',
  },
  tooltip: {
    backgroundColor: '#FBF4EB',
    borderColor: '#e4d7c6',
    style: { color: '#151515' },
  },
}

onMounted(async () => {
  const Highcharts = (await import('highcharts')).default
  Highcharts.setOptions(tema)
  chart = Highcharts.chart(wadah.value!, props.options)
  siap.value = true
})

watch(
  () => props.options,
  (baru) => {
    // `true, true` — gambar ulang sekaligus buang deret lama yang tidak ada di
    // opsi baru. Tanpa argumen kedua, deret yang hilang dari data tetap tertinggal
    // di grafik sebagai sisa yang tidak pernah diperbarui lagi.
    chart?.update(baru, true, true)
  },
  { deep: true },
)

onBeforeUnmount(() => {
  chart?.destroy()
  chart = null
})
</script>

<template>
  <div class="relative">
    <div ref="wadah" :style="{ height: `${tinggi ?? 320}px` }" />

    <!-- Rangka selama berkas Highcharts masih diunduh. Tingginya sama persis
         dengan grafiknya, jadi isi di bawahnya tidak melompat saat siap. -->
    <div
      v-if="!siap"
      class="absolute inset-0 grid animate-pulse place-items-center rounded-lg bg-cc-stone-100/60"
    >
      <UIcon name="i-lucide-loader" class="size-5 animate-spin text-cc-brown-500" />
    </div>
  </div>
</template>
