<script setup lang="ts">
// Form satu item sesi (materi / galeri / referensi) — dipakai untuk menambah
// maupun mengubah.
//
// Satu komponen untuk keduanya, bukan dua: aturan yang menentukan bentuk form —
// jenis apa yang boleh untuk bagian ini, jenis mana yang butuh berkas dan mana yang
// butuh tautan, kapan sakelar "khusus peserta" muncul — sama persis. Memisahkannya
// berarti aturan itu ditulis dua kali, dan yang satu pasti tertinggal.
//
// Berkas punya tiga jalan, dan ketiganya perlu ada:
//   1. unggah baru        — berkas dari komputer, masuk ke pustaka media
//   2. pilih dari pustaka — berkas yang sudah pernah diunggah, tanpa menggandakannya
//   3. biarkan            — hanya saat mengubah; berkas lama dipertahankan

export interface ItemTersunting {
  id: string
  jenis: string
  judul: string
  judulEn: string | null
  url: string | null
  mediaId: string | null
  namaBerkas: string | null
  terkunci: boolean
}

const props = defineProps<{
  open: boolean
  sesiId: string
  bagian: 'materi' | 'galeri' | 'referensi'
  /** Item yang sedang diubah; null berarti menambah baru. */
  item?: ItemTersunting | null
}>()

const emit = defineEmits<{ 'update:open': [boolean], 'tersimpan': [] }>()

const mengubah = computed(() => Boolean(props.item))

const form = ref({ jenis: 'pdf', judul: '', judulEn: '', url: '', mediaId: '', terkunci: true })
const berkas = ref<File | null>(null)
const sibuk = ref(false)
const galat = ref('')

/** Jenis bawaan tiap bagian — pilihan yang paling sering dipakai di sana. */
const jenisBawaan = (bagian: string) =>
  bagian === 'galeri' ? 'gambar' : bagian === 'referensi' ? 'tautan' : 'pdf'

// Form disusun ulang setiap modal dibuka, bukan sekali saat komponen dibuat:
// komponennya tetap hidup di antara pembukaan, jadi tanpa ini isian item
// sebelumnya masih tertinggal saat modal dibuka untuk item lain.
watch(() => props.open, (terbuka) => {
  if (!terbuka) return
  galat.value = ''
  berkas.value = null
  pustakaTerbuka.value = false

  form.value = props.item
    ? {
        jenis: props.item.jenis,
        judul: props.item.judul,
        judulEn: props.item.judulEn ?? '',
        url: props.item.url ?? '',
        mediaId: props.item.mediaId ?? '',
        terkunci: props.item.terkunci,
      }
    : {
        jenis: jenisBawaan(props.bagian),
        judul: '', judulEn: '', url: '', mediaId: '',
        terkunci: props.bagian === 'materi',
      }
}, { immediate: true })

const jenisOptions = computed(() => {
  if (props.bagian === 'galeri') return [{ value: 'gambar', label: 'Gambar' }]
  if (props.bagian === 'referensi') {
    return [
      { value: 'tautan', label: 'Tautan web' },
      { value: 'youtube', label: 'YouTube' },
      { value: 'pdf', label: 'PDF (unggah)' },
    ]
  }
  return [
    { value: 'pdf', label: 'PDF' },
    { value: 'dokumen', label: 'Dokumen (Word/Excel/PPT)' },
    { value: 'video', label: 'Video (unggah)' },
    { value: 'youtube', label: 'YouTube (boleh unlisted)' },
    { value: 'gambar', label: 'Gambar' },
    { value: 'tautan', label: 'Tautan web' },
  ]
})

/** Jenis yang isinya berupa berkas unggahan, bukan tautan luar. */
const pakaiBerkas = computed(() => ['pdf', 'dokumen', 'video', 'gambar'].includes(form.value.jenis))

// Cermin MEDIA_LIMITS di server/utils/media-services.ts — ditampilkan supaya
// batasnya diketahui sebelum unggahan gagal, bukan sesudah.
const batasBerkas = computed(() => {
  if (form.value.jenis === 'gambar') return '10 MB'
  if (form.value.jenis === 'video') return '100 MB'
  return '25 MB'
})

/** Berkas yang sudah menempel pada item ini (saat mengubah), untuk ditampilkan. */
const berkasLama = computed(() =>
  mengubah.value && props.item?.mediaId ? props.item.namaBerkas ?? props.item.mediaId : '')

// ── Pustaka media ────────────────────────────────────────────────────────────
// Dimuat malas: daftarnya hanya diambil kalau panelnya benar-benar dibuka, supaya
// membuka form untuk menempel satu tautan tidak ikut menarik seluruh pustaka.
const pustakaTerbuka = ref(false)
const { data: pustaka, status: statusPustaka, refresh: muatPustaka } = useFetch('/api/media', {
  query: { limit: 24 },
  immediate: false,
  watch: false,
})

const bukaPustaka = async () => {
  pustakaTerbuka.value = true
  if (!pustaka.value) await muatPustaka()
}

const pilihDariPustaka = (media: { id: string, originalName: string }) => {
  form.value.mediaId = media.id
  berkas.value = null
  if (!form.value.judul) form.value.judul = media.originalName
  pustakaTerbuka.value = false
}

/** Nama berkas pilihan dari pustaka, untuk ditampilkan setelah dipilih. */
const namaPilihan = computed(() => {
  if (berkas.value) return berkas.value.name
  if (!form.value.mediaId) return ''
  const dari = (pustaka.value?.data ?? []).find((m: any) => m.id === form.value.mediaId)
  return dari?.originalName ?? berkasLama.value
})

const ukuranBerkas = (bytes: number) => {
  const satuan = ['B', 'KB', 'MB', 'GB']
  let n = bytes
  let i = 0
  while (n >= 1024 && i < satuan.length - 1) { n /= 1024; i++ }
  return `${n < 10 && i > 0 ? n.toFixed(1) : Math.round(n)} ${satuan[i]}`
}

// ── Simpan ───────────────────────────────────────────────────────────────────
const pesan = (e: any, bawaan: string) => e?.data?.statusMessage ?? e?.statusMessage ?? bawaan

const simpan = async () => {
  sibuk.value = true
  galat.value = ''
  try {
    let mediaId = form.value.mediaId

    // Berkas diunggah lebih dulu ke pustaka media, baru itemnya menunjuk ke sana —
    // supaya satu berkas bisa dipakai ulang di sesi lain tanpa diunggah dua kali.
    if (pakaiBerkas.value && berkas.value) {
      const fd = new FormData()
      fd.append('file', berkas.value)
      const naik = await $fetch<any>('/api/media/upload', { method: 'POST', body: fd })
      mediaId = naik.data[0].id
      if (!form.value.judul) form.value.judul = berkas.value.name
    }

    const body = {
      jenis: form.value.jenis,
      judul: form.value.judul,
      judulEn: form.value.judulEn,
      // Jenis berkas dan jenis tautan saling meniadakan: menyisakan sisa dari jenis
      // sebelumnya membuat item yang tautannya menunjuk ke satu hal sementara
      // berkasnya ke hal lain, dan mana yang menang tidak pernah jelas.
      mediaId: pakaiBerkas.value ? (mediaId || null) : null,
      url: pakaiBerkas.value ? null : (form.value.url || null),
      terkunci: form.value.terkunci,
    }

    if (mengubah.value) {
      await $fetch(`/api/admin/sesi-item/${props.item!.id}`, { method: 'PATCH', body })
    }
    else {
      await $fetch('/api/admin/sesi-item', {
        method: 'POST',
        body: { ...body, sesiId: props.sesiId, bagian: props.bagian },
      })
    }

    emit('tersimpan')
    emit('update:open', false)
  }
  catch (e: any) { galat.value = pesan(e, 'Gagal menyimpan item.') }
  finally { sibuk.value = false }
}
</script>

<template>
  <UModal
    :open="open"
    :title="mengubah ? 'Ubah item' : 'Tambah item'"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField label="Jenis">
          <USelect v-model="form.jenis" :items="jenisOptions" value-key="value" class="w-full" />
        </UFormField>

        <UFormField label="Judul" :required="!pakaiBerkas">
          <UInput
            v-model="form.judul"
            class="w-full"
            :placeholder="pakaiBerkas ? 'Kosongkan untuk memakai nama berkas' : ''"
          />
        </UFormField>

        <UFormField label="Judul (EN)" hint="opsional">
          <UInput v-model="form.judulEn" class="w-full" />
        </UFormField>

        <template v-if="pakaiBerkas">
          <UFormField label="Berkas" :hint="`maksimal ${batasBerkas}`">
            <UInput
              type="file"
              class="w-full"
              @change="berkas = ($event.target as HTMLInputElement).files?.[0] ?? null; form.mediaId = ''"
            />
          </UFormField>

          <div class="flex flex-wrap items-center gap-2">
            <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-folder-open" @click="bukaPustaka">
              Pilih dari pustaka media
            </UButton>
            <span v-if="namaPilihan" class="min-w-0 flex-1 truncate text-xs text-cc-stone-600" :title="namaPilihan">
              {{ berkas ? 'Akan diunggah:' : 'Terpasang:' }} {{ namaPilihan }}
            </span>
          </div>

          <!-- Pustaka media: kisi kecil, bukan tabel. Yang dicari orang di sini
               adalah berkasnya, dan untuk gambar itu berarti melihatnya. -->
          <div v-if="pustakaTerbuka" class="rounded-lg border border-cc-stone-200 bg-cc-stone-50 p-3">
            <div v-if="statusPustaka === 'pending'" class="grid grid-cols-3 gap-2">
              <USkeleton v-for="n in 6" :key="n" class="aspect-square w-full rounded" />
            </div>

            <p v-else-if="!pustaka?.data?.length" class="py-4 text-center text-xs text-cc-stone-500">
              Pustaka media masih kosong.
            </p>

            <div v-else class="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto">
              <button
                v-for="m in pustaka.data"
                :key="m.id"
                type="button"
                class="overflow-hidden rounded border text-left transition-colors"
                :class="form.mediaId === m.id ? 'border-cc-brown-500 bg-white' : 'border-cc-stone-200 bg-white hover:border-cc-brown-300'"
                @click="pilihDariPustaka(m)"
              >
                <img
                  v-if="m.kind === 'gambar'"
                  :src="m.publicUrl"
                  :alt="m.originalName"
                  class="aspect-square w-full object-cover"
                  loading="lazy"
                >
                <div v-else class="grid aspect-square w-full place-items-center bg-cc-stone-100">
                  <UIcon name="i-lucide-file" class="size-6 text-cc-stone-400" />
                </div>
                <div class="p-1.5">
                  <p class="truncate text-[11px] font-semibold text-cc-green-800" :title="m.originalName">
                    {{ m.originalName }}
                  </p>
                  <p class="text-[10px] text-cc-stone-500">{{ ukuranBerkas(m.fileSize) }}</p>
                </div>
              </button>
            </div>

            <UButton class="mt-2" size="xs" color="neutral" variant="ghost" block @click="pustakaTerbuka = false">
              Tutup pustaka
            </UButton>
          </div>

          <p v-if="mengubah && berkasLama && !berkas" class="text-xs text-cc-stone-500">
            Biarkan kosong untuk mempertahankan berkas yang sekarang.
          </p>
        </template>

        <UFormField
          v-else
          :label="form.jenis === 'youtube' ? 'Tautan YouTube' : 'Alamat tautan'"
          required
        >
          <template #hint>
            <UTooltip
              v-if="form.jenis === 'youtube'"
              text="Video unlisted boleh — ia tetap bisa di-embed selama izin embed tidak dimatikan di YouTube. Video privat tidak bisa."
            >
              <UIcon name="i-lucide-info" class="size-4 text-cc-brown-500" />
            </UTooltip>
          </template>
          <UInput
            v-model="form.url"
            class="w-full"
            :placeholder="form.jenis === 'youtube' ? 'https://youtu.be/… atau youtube.com/watch?v=…' : 'https://…'"
          />
        </UFormField>

        <UFormField v-if="bagian === 'materi'" help="Matikan hanya jika materi ini boleh dibuka siapa saja, misalnya silabus.">
          <USwitch v-model="form.terkunci" label="Khusus peserta event" />
        </UFormField>

        <UAlert v-if="galat" color="error" variant="subtle" icon="i-lucide-triangle-alert" :description="galat" />
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="emit('update:open', false)">Batal</UButton>
        <UButton color="secondary" :loading="sibuk" @click="simpan">
          {{ mengubah ? 'Simpan perubahan' : 'Tambah' }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
