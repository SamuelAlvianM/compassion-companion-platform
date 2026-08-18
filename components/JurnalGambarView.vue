<script setup lang="ts">
// Tampilan sebuah gambar di dalam editor jurnal (NodeView untuk `gambarJurnal`).
//
// Yang digambar di sini persis bentuknya di halaman publik — gambar, lalu
// keterangan kecil di bawahnya — supaya penulis tidak perlu menerbitkan dulu untuk
// tahu hasilnya. Yang hanya ada di editor: gagang penarik lebar di tepi kanan dan
// tiga tombol perataan, dan keduanya baru muncul saat gambarnya dipilih.

// `nodeViewProps` dipakai apa adanya, bukan daftar prop tulisan sendiri: Tiptap
// mengirim lebih dari yang dipakai di sini (view, getPos, decorations…), dan
// komponen yang hanya mendeklarasikan sebagiannya tidak cocok dengan tipe
// `NodeViewProps` yang diminta VueNodeViewRenderer.
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'

const props = defineProps(nodeViewProps)

const attrs = computed(() => props.node.attrs as {
  src: string
  alt: string
  caption: string
  align: 'kiri' | 'tengah' | 'kanan'
  lebar: number
})

const bisaDisunting = computed(() => props.editor?.isEditable !== false)

const PERATAAN = [
  { nilai: 'kiri', ikon: 'i-lucide-align-left', label: 'Rata kiri' },
  { nilai: 'tengah', ikon: 'i-lucide-align-center', label: 'Rata tengah' },
  { nilai: 'kanan', ikon: 'i-lucide-align-right', label: 'Rata kanan' },
] as const

/** Kelas perataan ditulis utuh — Tailwind memindai berkas sebagai teks, jadi nama
    kelas yang baru tersusun saat runtime tidak pernah ikut diterbitkan. */
const kelasPerataan: Record<string, string> = {
  kiri: 'mr-auto ml-0',
  tengah: 'mx-auto',
  kanan: 'ml-auto mr-0',
}

// ── Menarik lebar ────────────────────────────────────────────────────────────
// Persentase, bukan piksel: tulisan dibaca di layar selebar 1200px maupun di
// ponsel, dan gambar 640px yang dipatok akan menjebol bingkai yang lebih sempit.
const wadah = ref<HTMLElement | null>(null)
const menarik = ref(false)

/**
 * Empat gagang di sudut, bukan satu di tepi kanan.
 *
 * Yang di tepi kanan tadi berupa pil hijau tipis: ia hilang di atas gambar gelap,
 * dan tidak ada yang menduga gambar itu bisa ditarik. Empat kotak putih bergaris
 * tua di sudut adalah bentuk yang sudah dikenal semua orang dari aplikasi gambar
 * mana pun — dan karena ada di empat sudut, ia terbaca sebagai bingkai.
 *
 * Sudut mana pun mengubah hal yang sama (lebar; tingginya ikut rasio), cuma arah
 * hitungannya yang berbeda: yang di kiri diukur mundur dari tepi kanan, yang di
 * kanan diukur maju dari tepi kiri.
 */
const SUDUT = [
  { nama: 'kiri-atas', kelas: '-top-1.5 -left-1.5 cursor-nwse-resize', dariKanan: true },
  { nama: 'kanan-atas', kelas: '-top-1.5 -right-1.5 cursor-nesw-resize', dariKanan: false },
  { nama: 'kiri-bawah', kelas: '-bottom-1.5 -left-1.5 cursor-nesw-resize', dariKanan: true },
  { nama: 'kanan-bawah', kelas: '-right-1.5 -bottom-1.5 cursor-nwse-resize', dariKanan: false },
] as const

const mulaiTarik = (e: PointerEvent, dariKanan = false) => {
  if (!bisaDisunting.value) return
  e.preventDefault()

  const induk = wadah.value?.parentElement
  if (!induk) return

  const lebarInduk = induk.getBoundingClientRect().width
  const kotak = wadah.value!.getBoundingClientRect()
  const kiri = kotak.left
  const kanan = kotak.right
  menarik.value = true

  const gerak = (ev: PointerEvent) => {
    // Dijadikan persen dari lebar tulisan, lalu dibulatkan ke kelipatan 5 supaya
    // berhenti di angka yang rapi — 73% dan 75% tidak berbeda di mata, tapi hanya
    // satu yang enak dibaca di dalam HTML tersimpan.
    const lebarPx = dariKanan ? kanan - ev.clientX : ev.clientX - kiri
    const persen = Math.round((lebarPx / lebarInduk) * 100 / 5) * 5
    props.updateAttributes({ lebar: Math.min(100, Math.max(25, persen)) })
  }

  const lepas = () => {
    menarik.value = false
    window.removeEventListener('pointermove', gerak)
    window.removeEventListener('pointerup', lepas)
  }

  window.addEventListener('pointermove', gerak)
  window.addEventListener('pointerup', lepas)
}

// ── Memotong ─────────────────────────────────────────────────────────────────
// Memakai `GaleriCropModal` yang sudah ada — pemotong yang sama dengan galeri
// event, lengkap dengan putar dan pratinjau. Mode `lokal`: potongannya diunggah
// sebagai media baru lalu alamatnya dikembalikan, tanpa menyentuh baris galeri
// mana pun. Gambar aslinya tetap utuh di pustaka; yang berubah hanya yang dipakai
// tulisan ini.
const modalPotong = ref(false)

const itemPotong = computed(() => ({
  id: 'jurnal-gambar',
  judul: props.node.attrs.caption || props.node.attrs.alt || 'Gambar jurnal',
  url: props.node.attrs.src as string,
  thumbnail: null,
}))

const dariPotongan = ({ url }: { mediaId: string, url: string }) => {
  props.updateAttributes({ src: url })
  modalPotong.value = false
}
</script>

<template>
  <NodeViewWrapper
    class="jurnal-gambar my-5"
    :data-align="attrs.align"
    :class="selected ? 'is-selected' : ''"
  >
    <figure
      ref="wadah"
      class="relative"
      :class="kelasPerataan[attrs.align]"
      :style="{ width: `${attrs.lebar}%` }"
    >
      <img
        :src="attrs.src"
        :alt="attrs.alt || attrs.caption"
        class="block w-full rounded-md"
        :class="selected ? 'ring-2 ring-cc-green-800 ring-offset-2' : ''"
        draggable="false"
      >

      <!-- Gagang di empat sudut. Putih bergaris tua supaya tetap terlihat di atas
           gambar terang maupun gelap — yang sebelumnya hijau tipis di tepi kanan
           praktis tidak terlihat di atas foto gelap. -->
      <button
        v-for="sd in SUDUT"
        v-show="bisaDisunting && selected"
        :key="sd.nama"
        type="button"
        class="absolute size-3.5 rounded-[3px] border-2 border-cc-green-800 bg-white shadow-sm transition-transform hover:scale-125"
        :class="[sd.kelas, menarik ? 'scale-125' : '']"
        aria-label="Tarik untuk mengubah ukuran gambar"
        @pointerdown="mulaiTarik($event, sd.dariKanan)"
      />

      <!-- Keterangan gambar. Kotak isian tanpa bingkai: bentuknya sama dengan
           hasil akhirnya, jadi yang mengetik langsung melihat bagaimana ia terbaca
           di halaman publik. -->
      <figcaption class="mt-2 text-center">
        <input
          :value="attrs.caption"
          :readonly="!bisaDisunting"
          type="text"
          placeholder="Tulis keterangan gambar…"
          class="w-full border-0 bg-transparent text-center text-sm text-cc-stone-600 italic outline-none placeholder:text-cc-stone-400 focus:ring-0"
          @input="updateAttributes({ caption: ($event.target as HTMLInputElement).value })"
          @keydown.enter.prevent
        >
      </figcaption>

      <!-- Perkakas gambar, muncul hanya saat dipilih. Melayang di atas gambarnya,
           bukan di bawah keterangan: yang diaturnya gambar, dan jarak antara
           tombol dan yang diubahnya adalah yang membuat hubungannya terbaca. -->
      <div
        v-if="bisaDisunting && selected"
        class="absolute top-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-white/95 p-1 shadow-md ring-1 ring-cc-stone-200"
      >
        <UTooltip v-for="p in PERATAAN" :key="p.nilai" :text="p.label">
          <UButton
            :icon="p.ikon"
            size="xs"
            :color="attrs.align === p.nilai ? 'primary' : 'neutral'"
            :variant="attrs.align === p.nilai ? 'soft' : 'ghost'"
            :aria-label="p.label"
            @click="updateAttributes({ align: p.nilai })"
          />
        </UTooltip>

        <div class="mx-0.5 h-4 w-px bg-cc-stone-200" />

        <UTooltip text="Potong gambar">
          <UButton
            icon="i-lucide-crop"
            size="xs"
            color="neutral"
            variant="ghost"
            aria-label="Potong gambar"
            @click="modalPotong = true"
          />
        </UTooltip>

        <UTooltip text="Lebar penuh">
          <UButton
            icon="i-lucide-maximize-2"
            size="xs"
            color="neutral"
            variant="ghost"
            aria-label="Lebar penuh"
            @click="updateAttributes({ lebar: 100 })"
          />
        </UTooltip>

        <UTooltip text="Hapus gambar">
          <UButton
            icon="i-lucide-trash-2"
            size="xs"
            color="error"
            variant="ghost"
            aria-label="Hapus gambar"
            @click="deleteNode()"
          />
        </UTooltip>
      </div>
    </figure>

    <!-- Pemotong. `lokal`: hasil potongannya diunggah sebagai media baru dan
         alamatnya dikembalikan ke sini, tanpa mengubah baris galeri mana pun. -->
    <GaleriCropModal
      v-model:open="modalPotong"
      :item="itemPotong"
      lokal
      @draf="dariPotongan"
    />
  </NodeViewWrapper>
</template>
