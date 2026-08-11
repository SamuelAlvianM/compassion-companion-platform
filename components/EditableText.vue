<script setup lang="ts">
// Teks yang bisa disunting di tempat, aktif hanya saat mode edit menyala.
//
// Saat mode edit mati, komponen ini merender slot-nya apa adanya — tidak ada
// pembungkus tambahan, tidak ada kelas ekstra. Halaman yang dilihat pengunjung
// harus sama persis dengan halaman tanpa komponen ini.

const props = defineProps<{
  /** Nilai sekarang. */
  modelValue: string | null
  /** Nama kolom, dikirim ke `simpan`. */
  field: string
  /** Label yang muncul saat menyunting. */
  label?: string
  /** Beberapa baris (deskripsi) atau satu baris (judul). */
  multiline?: boolean
  /** Penyimpan; melempar error kalau gagal. */
  simpan: (field: string, nilai: string) => Promise<void>
}>()

const emit = defineEmits<{ 'update:modelValue': [string] }>()

const { aktif } = useEditMode()

const menyunting = ref(false)
const draft = ref('')
const sibuk = ref(false)
const galat = ref('')

const mulai = () => {
  draft.value = props.modelValue ?? ''
  galat.value = ''
  menyunting.value = true
}

const batal = () => { menyunting.value = false; galat.value = '' }

const simpanSekarang = async () => {
  const nilai = draft.value.trim()
  // Tidak berubah -> tidak usah menembak server sama sekali.
  if (nilai === (props.modelValue ?? '')) { menyunting.value = false; return }

  sibuk.value = true
  galat.value = ''
  try {
    await props.simpan(props.field, nilai)
    emit('update:modelValue', nilai)
    menyunting.value = false
  }
  catch (e: any) {
    galat.value = e?.data?.statusMessage ?? e?.statusMessage ?? 'Gagal menyimpan.'
  }
  finally { sibuk.value = false }
}

// Esc membatalkan, Ctrl/Cmd+Enter menyimpan. Enter biasa dibiarkan mengetik baris
// baru pada mode multiline — memakainya untuk menyimpan akan mengejutkan.
const tombol = (e: KeyboardEvent) => {
  if (e.key === 'Escape') batal()
  else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) simpanSekarang()
  else if (e.key === 'Enter' && !props.multiline) simpanSekarang()
}
</script>

<template>
  <!-- Mode baca: slot apa adanya, tanpa pembungkus. -->
  <slot v-if="!aktif" />

  <!-- Mode edit, belum diklik: slot dibungkus penanda yang bisa diklik. -->
  <span v-else-if="!menyunting" class="editable" role="button" tabindex="0" @click="mulai" @keydown.enter="mulai">
    <slot />
    <UIcon name="i-lucide-pencil" class="editable-pen size-3.5" />
  </span>

  <!-- Sedang disunting. -->
  <!-- Penangkap tombol dipasang di pembungkus, bukan di <UInput>. Listener yang
       ditaruh langsung pada komponen Nuxt UI tidak selalu sampai ke elemen <input>
       di dalamnya; keydown yang menggelembung ke span ini selalu tertangkap. -->
  <span v-else class="editable-form" @keydown="tombol">
    <UTextarea
      v-if="multiline"
      v-model="draft"
      :rows="4"
      autofocus
      class="w-full"
      :aria-label="label ?? field"
    />
    <UInput
      v-else
      v-model="draft"
      autofocus
      class="w-full"
      :aria-label="label ?? field"
    />

    <span class="editable-actions">
      <UButton size="xs" color="secondary" :loading="sibuk" icon="i-lucide-check" @click="simpanSekarang">Simpan</UButton>
      <UButton size="xs" color="neutral" variant="ghost" @click="batal">Batal</UButton>
      <span class="editable-hint">{{ multiline ? 'Ctrl+Enter simpan · Esc batal' : 'Enter simpan · Esc batal' }}</span>
    </span>

    <span v-if="galat" class="editable-error">{{ galat }}</span>
  </span>
</template>
