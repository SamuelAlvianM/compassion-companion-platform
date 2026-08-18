<script setup lang="ts">
// Sunting satu foto galeri yang sudah terunggah: putar & potong, lalu simpan.
//
// Sebelumnya pensil pada foto galeri membuka SesiItemModal — form satu-item yang
// isinya "pilih berkas pengganti". Itu menjawab pertanyaan lain: yang biasanya
// ingin dilakukan orang pada foto yang sudah masuk bukan menggantinya dengan foto
// lain, melainkan meluruskan yang miring dan membuang tepi yang tidak perlu.
//
// Hasil potongan diunggah sebagai media BARU, lalu `mediaId` item diarahkan ke
// sana. Menimpa berkas lama akan mengubah foto yang mungkin sudah dipakai di
// tempat lain, dan alamat media di situs ini dicache selamanya
// (`Cache-Control: immutable`) — berkas yang isinya berubah di alamat yang sama
// tidak akan pernah tergambar ulang di browser yang sudah pernah membukanya.

import { potongGambar, potonganBaru, type PotonganGambar } from '../utils/potongGambar'

const props = defineProps<{
  open: boolean
  /** Item galeri yang sedang disunting. */
  item: { id: string, judul: string, url: string | null, thumbnail: string | null } | null
  isEn?: boolean
  /** Item ini masih draf di halaman "Event baru" — potongannya naik, barisnya belum. */
  lokal?: boolean
}>()

const emit = defineEmits<{
  'update:open': [boolean]
  'tersimpan': []
  /** Mode lokal: potongan yang sudah naik, untuk dipasang induk pada drafnya. */
  'draf': [{ mediaId: string, url: string }]
}>()

const t = computed(() => props.isEn
  ? { judul: 'Edit photo', simpan: 'Save photo', batal: 'Cancel', gagal: 'The photo could not be saved.', muat: 'Loading the photo…' }
  : { judul: 'Sunting foto', simpan: 'Simpan foto', batal: 'Batal', gagal: 'Foto gagal disimpan.', muat: 'Memuat foto…' })

const potongan = ref<PotonganGambar>(potonganBaru())
const sumber = ref('')
const berkas = ref<File | null>(null)
const sibuk = ref(false)
const memuat = ref(false)
const galat = ref('')

const lepasSumber = () => {
  if (sumber.value) URL.revokeObjectURL(sumber.value)
  sumber.value = ''
}

/**
 * Foto yang sudah terunggah diambil kembali sebagai `File`.
 *
 * `potongGambar` menerima `File` karena ia mempertahankan nama dan jenis berkas
 * asalnya — PNG tetap PNG, dan transparansinya tidak berubah jadi hitam pekat.
 * Alamatnya se-origin dengan halaman ini, jadi kanvasnya tidak ternoda dan
 * `toBlob` tetap boleh dipanggil.
 */
const muatFoto = async () => {
  const alamat = props.item?.url ?? props.item?.thumbnail
  if (!alamat) return
  memuat.value = true
  galat.value = ''
  try {
    const res = await fetch(alamat)
    const blob = await res.blob()
    const nama = alamat.split('/').pop() || 'foto.jpg'
    berkas.value = new File([blob], nama, { type: blob.type || 'image/jpeg' })
    lepasSumber()
    sumber.value = URL.createObjectURL(berkas.value)
    potongan.value = potonganBaru()
  }
  catch {
    galat.value = t.value.gagal
  }
  finally { memuat.value = false }
}

watch(() => props.open, (terbuka) => {
  if (terbuka) muatFoto()
  else { lepasSumber(); berkas.value = null }
})

const simpan = async () => {
  if (!berkas.value || !props.item) return
  sibuk.value = true
  galat.value = ''
  try {
    const siap = await potongGambar(berkas.value, sumber.value, potongan.value)

    const fd = new FormData()
    fd.append('file', siap)
    fd.append('hanyaKind', 'gambar')
    fd.append('altText', props.item.judul)
    const naik = await $fetch<any>('/api/media/upload', { method: 'POST', body: fd })

    if (props.lokal) {
      emit('draf', { mediaId: naik.data[0].id, url: naik.data[0].publicUrl ?? '' })
      emit('update:open', false)
      return
    }

    await $fetch(`/api/admin/sesi-item/${props.item.id}`, {
      method: 'PATCH',
      body: { jenis: 'gambar', judul: props.item.judul, mediaId: naik.data[0].id, url: null },
    })

    emit('tersimpan')
    emit('update:open', false)
  }
  catch (e: any) {
    galat.value = e?.data?.statusMessage ?? e?.statusMessage ?? t.value.gagal
  }
  finally { sibuk.value = false }
}
</script>

<template>
  <UModal
    :open="open"
    :title="t.judul"
    :ui="{ content: 'max-w-3xl' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <p v-if="memuat" class="py-8 text-center text-sm text-cc-stone-500">{{ t.muat }}</p>
      <GambarEditor
        v-else-if="sumber"
        v-model="potongan"
        :sumber="sumber"
        :is-en="isEn"
        tanpa-ganti
      />
      <UAlert v-if="galat" color="error" variant="subtle" class="mt-3" icon="i-lucide-triangle-alert" :description="galat" />
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="emit('update:open', false)">{{ t.batal }}</UButton>
        <UButton color="secondary" :loading="sibuk" :disabled="!sumber" @click="simpan">{{ t.simpan }}</UButton>
      </div>
    </template>
  </UModal>
</template>
