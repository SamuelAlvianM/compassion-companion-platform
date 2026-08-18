<script setup lang="ts">
// Satu kotak gambar di dalam formulir: pratinjau, pilih berkas, potong, unggah.
//
// Dibuat sebagai komponen karena tiga tempat memintanya dengan bentuk yang sama —
// thumbnail event, gambar utama event, dan penggantian foto galeri — dan di
// ketiganya urutan kerjanya identik: pilih berkas → potong ke rasio bingkainya →
// unggah ke pustaka media → simpan `mediaId`-nya.
//
// Yang diunggah adalah HASIL POTONGAN, bukan berkas aslinya. Menyimpan yang asli
// lalu memotongnya dengan CSS berarti pengunjung mengunduh foto ponsel 4 MB untuk
// melihat kartu selebar 320px, dan potongan yang dipilih admin tidak pernah
// benar-benar mengikat.

import { potongGambar, potonganBaru, type PotonganGambar } from '../utils/potongGambar'

const props = withDefaults(defineProps<{
  /** Alamat gambar yang sekarang terpasang; null berarti belum ada. */
  url?: string | null
  label: string
  /** Keterangan pendek di bawah label — ukuran yang diharapkan, misalnya. */
  petunjuk?: string
  /** Rasio bingkai tujuannya. Potongan dikunci ke sini. */
  rasio: number
  /** Lebar pratinjau dalam piksel; tingginya turunan rasio. */
  lebarPratinjau?: number
  /** Menggambar bintang wajib di sebelah label — penegakannya di induk. */
  wajib?: boolean
  /**
   * Nyalakan penanda "belum diisi": bingkai merah + kalimatnya.
   *
   * Terpisah dari `wajib` karena keduanya menjawab pertanyaan berbeda. `wajib`
   * menjawab "kolom ini harus diisi?" dan berlaku sejak formulir dibuka; ini
   * menjawab "sudah ketahuan belum diisi?", dan induknya baru menyalakannya sesudah
   * tombol simpan ditekan.
   */
  tandaGalat?: boolean
  isEn?: boolean
}>(), {
  url: null,
  lebarPratinjau: 220,
})

const emit = defineEmits<{
  /** mediaId hasil unggahan, beserta alamatnya untuk pratinjau. */
  terpasang: [{ mediaId: string, url: string }]
  dilepas: []
}>()

const t = computed(() => props.isEn
  ? {
      pilih: 'Upload image', ganti: 'Replace', lepas: 'Remove', kosong: 'No image yet',
      simpan: 'Use this crop', batal: 'Cancel', judul: 'Crop the image',
      bukanGambar: 'That file is not an image.',
      terlalu: 'The image is larger than 10 MB.',
      gagal: 'The image failed to upload.',
    }
  : {
      pilih: 'Unggah gambar', ganti: 'Ganti', lepas: 'Lepas', kosong: 'Belum ada gambar',
      simpan: 'Pakai potongan ini', batal: 'Batal', judul: 'Potong gambar',
      bukanGambar: 'Berkas itu bukan gambar.',
      terlalu: 'Ukuran gambar melebihi 10 MB.',
      gagal: 'Gambar gagal diunggah.',
    })

// Cermin MEDIA_LIMITS.gambar di server/utils/media-services.ts. Diperiksa di sini
// supaya berkas yang pasti ditolak tidak perlu naik dulu sampai habis.
const BATAS = 10 * 1024 * 1024

const berkasInput = useTemplateRef<HTMLInputElement>('berkasInput')
const berkas = ref<File | null>(null)
const sumber = ref('')
const potongan = ref<PotonganGambar>(potonganBaru())
const modal = ref(false)
const sibuk = ref(false)
const galat = ref('')

const tinggiPratinjau = computed(() => Math.round(props.lebarPratinjau / props.rasio))

// Diikat ke variabel lokal supaya bisa dibaca template: auto-import Nuxt bekerja
// pada blok script, dan yang hanya muncul di template tidak ikut terbawa.
const pesanWajib = PESAN_WAJIB

const lepasSumber = () => {
  if (sumber.value) URL.revokeObjectURL(sumber.value)
  sumber.value = ''
}

const pilihBerkas = (e: Event) => {
  const f = (e.target as HTMLInputElement).files?.[0]
  // Nilai input dikosongkan supaya memilih berkas yang SAMA dua kali tetap
  // memicu `change` — tanpa ini, membatalkan lalu memilih ulang tidak melakukan apa pun.
  ;(e.target as HTMLInputElement).value = ''
  if (!f) return

  galat.value = ''
  if (!f.type.startsWith('image/')) { galat.value = t.value.bukanGambar; return }
  if (f.size > BATAS) { galat.value = t.value.terlalu; return }

  lepasSumber()
  berkas.value = f
  sumber.value = URL.createObjectURL(f)
  potongan.value = potonganBaru()
  modal.value = true
}

const simpan = async () => {
  if (!berkas.value) return
  sibuk.value = true
  galat.value = ''
  try {
    const siap = await potongGambar(berkas.value, sumber.value, potongan.value)
    const fd = new FormData()
    fd.append('file', siap)
    fd.append('hanyaKind', 'gambar')
    fd.append('altText', props.label)
    const naik = await $fetch<any>('/api/media/upload', { method: 'POST', body: fd })
    emit('terpasang', { mediaId: naik.data[0].id, url: naik.data[0].publicUrl })
    modal.value = false
    lepasSumber()
    berkas.value = null
  }
  catch (e: any) {
    galat.value = e?.data?.statusMessage ?? e?.statusMessage ?? t.value.gagal
  }
  finally { sibuk.value = false }
}

const batal = () => {
  modal.value = false
  lepasSumber()
  berkas.value = null
}

onBeforeUnmount(lepasSumber)
</script>

<template>
  <div>
    <!-- Bintangnya ditulis dengan warna dan bentuk yang sama seperti `required`
         milik UFormField di kolom-kolom di atasnya — kolom wajib tidak boleh punya
         dua penanda berbeda dalam satu formulir. -->
    <p class="text-sm font-medium text-cc-stone-700">
      {{ label }}<span v-if="wajib" class="text-error ms-0.5" aria-hidden="true">*</span>
    </p>
    <p v-if="petunjuk" class="text-xs text-cc-stone-500">{{ petunjuk }}</p>

    <div class="mt-2 flex flex-wrap items-start gap-3">
      <!-- Bingkainya yang menyala merah saat wajib tapi masih kosong. Kolom ini
           tidak punya kotak isian yang bisa diberi bingkai galat seperti UFormField
           di atasnya, jadi pratinjaunya yang mengambil peran itu. -->
      <div
        class="shrink-0 overflow-hidden rounded-lg border bg-cc-stone-100"
        :class="tandaGalat ? 'border-error' : 'border-cc-stone-200'"
        :style="{ width: `${lebarPratinjau}px`, height: `${tinggiPratinjau}px` }"
      >
        <img v-if="url" :src="url" :alt="label" class="size-full object-cover">
        <div v-else class="grid size-full place-items-center text-center">
          <span class="text-xs text-cc-stone-500">{{ t.kosong }}</span>
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <UButton
          color="neutral"
          variant="outline"
          size="sm"
          icon="i-lucide-image-plus"
          @click="berkasInput?.click()"
        >
          {{ url ? t.ganti : t.pilih }}
        </UButton>
        <UButton
          v-if="url"
          color="error"
          variant="ghost"
          size="sm"
          icon="i-lucide-x"
          @click="emit('dilepas')"
        >
          {{ t.lepas }}
        </UButton>
      </div>
    </div>

    <input
      ref="berkasInput"
      type="file"
      accept="image/*"
      class="hidden"
      @change="pilihBerkas"
    >

    <p v-if="galat && !modal" class="mt-1.5 text-xs text-red-700">{{ galat }}</p>
    <p v-else-if="tandaGalat" class="mt-1.5 text-xs text-error">{{ pesanWajib }}</p>

    <UModal v-model:open="modal" :title="t.judul" :ui="{ content: 'max-w-3xl' }">
      <template #body>
        <GambarEditor
          v-if="sumber"
          v-model="potongan"
          :sumber="sumber"
          :is-en="isEn"
          :rasio-tetap="rasio"
          tanpa-ganti
        />
        <UAlert v-if="galat" color="error" variant="subtle" class="mt-3" icon="i-lucide-triangle-alert" :description="galat" />
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="batal">{{ t.batal }}</UButton>
          <UButton color="secondary" :loading="sibuk" @click="simpan">{{ t.simpan }}</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
