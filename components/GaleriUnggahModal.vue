<script setup lang="ts">
// Unggah banyak foto sekaligus ke galeri sebuah sesi, dengan penyuntingan per foto.
//
// Kenapa jalur sendiri, bukan SesiItemModal yang dipakai bagian lain: galeri satu
// sesi biasanya belasan foto dari acara yang sama. Lewat form satu-item, itu berarti
// membuka modal, memilih berkas, menulis judul, menyimpan — belasan kali, dengan
// jawaban yang sama setiap kalinya. Di sini semuanya dipilih sekali, lalu yang perlu
// disunting saja yang disentuh.
//
// Foto diunggah SATU PER SATU meski endpoint media menerima banyak berkas dalam satu
// permintaan. Dua alasannya nyata: unggahan sepuluh foto ponsel bisa puluhan MB dan
// satu permintaan sebesar itu lebih mudah putus di tengah, dan kegagalan pada foto
// keenam tidak boleh membatalkan lima yang sudah berhasil — yang gagal tetap ada di
// daftar berikut sebabnya, sisanya sudah masuk.

import { potongGambar, potonganBaru, type PotonganGambar } from '../utils/potongGambar'

const props = defineProps<{
  open: boolean
  sesiId: string
  isEn?: boolean
}>()

const emit = defineEmits<{ 'update:open': [boolean], 'tersimpan': [] }>()

interface Entri {
  key: string
  berkas: File
  url: string
  judul: string
  judulEn: string
  potongan: PotonganGambar
  keadaan: 'siap' | 'unggah' | 'selesai' | 'gagal'
  galat: string
}

const daftar = ref<Entri[]>([])
const aktifKey = ref('')
const sibuk = ref(false)
const galatUmum = ref('')

const t = computed(() => props.isEn
  ? {
      judul: 'Add photos to the gallery',
      keterangan: 'Select several photos at once. Crop and rotate the ones that need it — the rest upload as they are.',
      pilih: 'Choose photos', tambahLagi: 'Add more', kosong: 'No photos selected yet.',
      unggah: 'Upload', batal: 'Cancel', hapus: 'Remove from list',
      terlalu: 'is larger than 10 MB and was skipped.',
      bukanGambar: 'is not an image and was skipped.',
      sedang: 'Uploading', selesai: 'Uploaded',
    }
  : {
      judul: 'Tambah foto ke galeri',
      keterangan: 'Pilih beberapa foto sekaligus. Potong dan putar yang perlu saja — sisanya terunggah apa adanya.',
      pilih: 'Pilih foto', tambahLagi: 'Tambah lagi', kosong: 'Belum ada foto yang dipilih.',
      unggah: 'Unggah', batal: 'Batal', hapus: 'Buang dari daftar',
      terlalu: 'lebih dari 10 MB dan dilewati.',
      bukanGambar: 'bukan gambar dan dilewati.',
      sedang: 'Mengunggah', selesai: 'Terunggah',
    })

// Cermin MEDIA_LIMITS.gambar di server/utils/media-services.ts. Diperiksa di sini
// supaya berkas kebesaran ditolak sebelum menghabiskan waktu unggah, bukan sesudah.
const BATAS = 10 * 1024 * 1024

const aktif = computed(() => daftar.value.find(e => e.key === aktifKey.value) ?? null)

/** Nama berkas tanpa ekstensi sebagai keterangan awal — lebih sering benar daripada
    kosong, dan tetap gampang diganti. */
const judulDari = (nama: string) => nama.replace(/\.[^./\\]+$/, '').replace(/[_-]+/g, ' ').trim()

const tambahBerkas = (files: FileList | null) => {
  galatUmum.value = ''
  const ditolak: string[] = []

  for (const berkas of Array.from(files ?? [])) {
    if (!berkas.type.startsWith('image/')) { ditolak.push(`${berkas.name} ${t.value.bukanGambar}`); continue }
    if (berkas.size > BATAS) { ditolak.push(`${berkas.name} ${t.value.terlalu}`); continue }

    daftar.value.push({
      key: `${berkas.name}-${berkas.size}-${berkas.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      berkas,
      url: URL.createObjectURL(berkas),
      judul: judulDari(berkas.name),
      judulEn: '',
      potongan: potonganBaru(),
      keadaan: 'siap',
      galat: '',
    })
  }

  if (ditolak.length) galatUmum.value = ditolak.join(' ')
  if (!aktifKey.value && daftar.value.length) aktifKey.value = daftar.value[0]!.key
}

const berkasInput = useTemplateRef<HTMLInputElement>('berkasInput')
const bukaPemilih = () => berkasInput.value?.click()

// ── Ganti gambar satu entri ──────────────────────────────────────────────────
// Berkasnya diganti sementara judul dan posisinya di daftar dipertahankan: yang
// biasanya terjadi adalah salah memilih di antara dua foto yang mirip, bukan
// berubah pikiran tentang keterangannya.
const gantiInput = useTemplateRef<HTMLInputElement>('gantiInput')
const mintaGanti = () => gantiInput.value?.click()

const lakukanGanti = (files: FileList | null) => {
  const berkas = files?.[0]
  const entri = aktif.value
  if (!berkas || !entri) return
  if (!berkas.type.startsWith('image/') || berkas.size > BATAS) {
    galatUmum.value = `${berkas.name} ${berkas.size > BATAS ? t.value.terlalu : t.value.bukanGambar}`
    return
  }
  URL.revokeObjectURL(entri.url)
  entri.berkas = berkas
  entri.url = URL.createObjectURL(berkas)
  // Potongan lama tidak berlaku untuk gambar lain: ia dalam piksel sumber, dan
  // gambar baru hampir pasti berukuran berbeda.
  entri.potongan = potonganBaru()
  entri.keadaan = 'siap'
  entri.galat = ''
}

const buang = (key: string) => {
  const i = daftar.value.findIndex(e => e.key === key)
  if (i === -1) return
  URL.revokeObjectURL(daftar.value[i]!.url)
  daftar.value.splice(i, 1)
  if (aktifKey.value === key) aktifKey.value = daftar.value[0]?.key ?? ''
}

// Object URL tidak dilepas browser sendiri; tanpa ini, memilih ratusan foto dalam
// satu sesi kerja menahan semuanya di memori sampai halamannya ditutup.
const bersihkan = () => {
  for (const e of daftar.value) URL.revokeObjectURL(e.url)
  daftar.value = []
  aktifKey.value = ''
  galatUmum.value = ''
}

watch(() => props.open, (terbuka) => { if (!terbuka) bersihkan() })
onBeforeUnmount(bersihkan)

// ── Unggah ───────────────────────────────────────────────────────────────────
const belumSelesai = computed(() => daftar.value.filter(e => e.keadaan !== 'selesai'))

const unggah = async () => {
  if (!belumSelesai.value.length) return
  sibuk.value = true
  galatUmum.value = ''
  let berhasil = 0

  for (const entri of belumSelesai.value) {
    entri.keadaan = 'unggah'
    entri.galat = ''
    try {
      // Potongan diterapkan di sini, tepat sebelum unggah — bukan saat disunting.
      // Menyimpan hasilnya lebih awal berarti tiap tarikan sudut menghasilkan satu
      // berkas baru di memori, dan semuanya terbuang begitu sudutnya digeser lagi.
      const siap = await potongGambar(entri.berkas, entri.url, entri.potongan)

      const fd = new FormData()
      fd.append('file', siap)
      fd.append('hanyaKind', 'gambar')
      fd.append('altText', entri.judul)
      const naik = await $fetch<any>('/api/media/upload', { method: 'POST', body: fd })

      await $fetch('/api/admin/sesi-item', {
        method: 'POST',
        body: {
          sesiId: props.sesiId,
          bagian: 'galeri',
          jenis: 'gambar',
          judul: entri.judul || siap.name,
          judulEn: entri.judulEn || null,
          mediaId: naik.data[0].id,
        },
      })

      entri.keadaan = 'selesai'
      berhasil++
    }
    catch (e: any) {
      entri.keadaan = 'gagal'
      entri.galat = e?.data?.statusMessage ?? e?.statusMessage ?? e?.message ?? 'Gagal mengunggah.'
    }
  }

  sibuk.value = false

  // Induk diberi tahu begitu ADA yang berhasil, meski sebagian gagal — foto yang
  // sudah masuk harus langsung terlihat di daftar sesi.
  if (berhasil) emit('tersimpan')
  if (!daftar.value.some(e => e.keadaan === 'gagal')) emit('update:open', false)
}

const penandaKeadaan = (e: Entri) => ({
  siap: '', unggah: 'i-lucide-loader', selesai: 'i-lucide-check', gagal: 'i-lucide-triangle-alert',
}[e.keadaan])
</script>

<template>
  <UModal
    :open="open"
    :title="t.judul"
    :description="t.keterangan"
    :ui="{ content: 'max-w-4xl' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <input
        ref="berkasInput"
        type="file"
        accept="image/*"
        multiple
        class="hidden"
        @change="tambahBerkas(($event.target as HTMLInputElement).files); ($event.target as HTMLInputElement).value = ''"
      >
      <input
        ref="gantiInput"
        type="file"
        accept="image/*"
        class="hidden"
        @change="lakukanGanti(($event.target as HTMLInputElement).files); ($event.target as HTMLInputElement).value = ''"
      >

      <UAlert
        v-if="galatUmum"
        color="warning"
        variant="subtle"
        class="mb-4"
        icon="i-lucide-triangle-alert"
        :description="galatUmum"
      />

      <!-- Keadaan kosong: satu tombol besar, bukan kotak berkas kecil di pojok.
           Memilih foto adalah satu-satunya hal yang bisa dilakukan di sini. -->
      <button
        v-if="!daftar.length"
        type="button"
        class="grid w-full place-items-center gap-2 rounded-xl border-2 border-dashed border-cc-stone-300 py-14 transition-colors hover:border-cc-brown-400 hover:bg-cc-stone-50"
        @click="bukaPemilih"
      >
        <UIcon name="i-lucide-image-plus" class="size-8 text-cc-brown-500" />
        <span class="font-semibold text-cc-green-800">{{ t.pilih }}</span>
        <span class="text-xs text-cc-stone-500">JPG · PNG · WebP · maks 10 MB per foto</span>
      </button>

      <div v-else class="space-y-4">
        <!-- Pita cuplikan. Urutannya urutan unggah, dan yang sedang disunting
             ditandai — dengan belasan foto, tanpa penanda itu mustahil tahu mana
             yang sedang tampil di panggung. -->
        <div class="flex gap-2 overflow-x-auto pb-1">
          <button
            v-for="e in daftar"
            :key="e.key"
            type="button"
            class="relative size-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all"
            :class="e.key === aktifKey ? 'border-cc-brown-500 ring-2 ring-cc-brown-500/25' : 'border-cc-stone-200 hover:border-cc-brown-300'"
            @click="aktifKey = e.key"
          >
            <img :src="e.url" alt="" class="size-full object-cover">
            <span
              v-if="penandaKeadaan(e)"
              class="absolute inset-0 grid place-items-center bg-black/50"
            >
              <UIcon
                :name="penandaKeadaan(e)"
                class="size-5 text-white"
                :class="e.keadaan === 'unggah' ? 'animate-spin' : ''"
              />
            </span>
          </button>

          <button
            type="button"
            class="grid size-16 shrink-0 place-items-center rounded-lg border-2 border-dashed border-cc-stone-300 text-cc-stone-500 transition-colors hover:border-cc-brown-400 hover:text-cc-brown-500"
            :aria-label="t.tambahLagi"
            @click="bukaPemilih"
          >
            <UIcon name="i-lucide-plus" class="size-5" />
          </button>
        </div>

        <template v-if="aktif">
          <GambarEditor
            :key="aktif.key"
            v-model="aktif.potongan"
            :sumber="aktif.url"
            :is-en="isEn"
            @ganti="mintaGanti"
          />

          <!-- Tidak ada isian keterangan. Galeri adalah foto dokumentasi: yang
               dilihat orang fotonya, dan keterangan yang diketik untuk belasan foto
               sekaligus hampir selalu berakhir sebagai pengulangan nama berkas.
               `judul` tetap diisi dari nama berkasnya di balik layar — ia jadi
               teks alternatif gambar, dan kolomnya wajib di server. -->
          <div class="flex items-center justify-between gap-2">
            <p v-if="aktif.galat" class="text-xs text-red-700">{{ aktif.galat }}</p>
            <span v-else class="text-xs text-cc-stone-500">{{ aktif.berkas.name }}</span>
            <UButton color="error" variant="ghost" size="xs" icon="i-lucide-trash-2" @click="buang(aktif.key)">
              {{ t.hapus }}
            </UButton>
          </div>
        </template>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-between gap-2">
        <span class="text-xs text-cc-stone-500">
          <template v-if="daftar.length">
            {{ daftar.length }} foto · {{ daftar.filter(e => e.keadaan === 'selesai').length }} {{ t.selesai.toLowerCase() }}
          </template>
          <template v-else>{{ t.kosong }}</template>
        </span>
        <div class="flex gap-2">
          <UButton color="neutral" variant="ghost" :disabled="sibuk" @click="emit('update:open', false)">
            {{ t.batal }}
          </UButton>
          <UButton
            color="secondary"
            icon="i-lucide-upload"
            :loading="sibuk"
            :disabled="!belumSelesai.length"
            @click="unggah"
          >
            {{ t.unggah }} {{ belumSelesai.length || '' }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
