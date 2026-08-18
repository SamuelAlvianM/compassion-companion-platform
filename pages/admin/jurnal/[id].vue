<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const route = useRoute()
const isNew = computed(() => route.params.id === 'new')

const form = reactive({
  title: '',
  journalType: '',
  eventName: '',
  contributorType: 'member' as 'member' | 'non-member',
  contributor: '',
})

const content = ref('')
const saved = ref(false)
const validationError = ref('')
const editor = ref<HTMLElement | null>(null)

const journalTypeOptions = [
  { value: 'event-reflection', label: 'Event Reflection' },
  { value: 'sharing-journey', label: 'Sharing Journey' },
  { value: 'insight', label: 'Insight' },
  { value: 'practice', label: 'Practice' },
]

const contributorTypeOptions = [
  { value: 'member', label: 'Member' },
  { value: 'non-member', label: 'Non Member' },
]

const members = ['Maria Santoso', 'Andreas Pratama', 'Clara Wijaya', 'Nicholas', 'Anna']
const events = ['Listening as Leadership', 'Leadership with Compassion', 'Compassion in Practice']

// Toolbar editor masih memakai document.execCommand — cukup untuk mockup, dan tetap
// perlu diganti editor sungguhan (mis. Tiptap) sebelum dipakai menulis konten nyata.
function format(command: string, value?: string) {
  editor.value?.focus()
  document.execCommand(command, false, value)
}

function updateContent(event: Event) {
  content.value = (event.target as HTMLElement).innerHTML
}

// Diikat ke variabel lokal supaya bisa dipanggil dari template: auto-import Nuxt
// bekerja pada blok script, dan yang hanya muncul di template tidak ikut terbawa.
const wajibKosong = belumDiisi

/** Tombol simpan sudah pernah ditekan — penanda kolom wajib menyala dari sini,
    bukan sejak formulir dibuka. */
const dicoba = ref(false)

function saveJournal() {
  dicoba.value = true
  validationError.value = ''

  // Kolom wajib diperiksa di sini juga, bukan hanya lewat atribut `required`:
  // yang menyala di kolomnya menunjukkan MANA yang kurang, dan kalimat di sini
  // menjelaskan kenapa tombolnya tidak melakukan apa-apa.
  const kurang = [
    ['Judul Jurnal', form.title],
    ['Tipe Jurnal', form.journalType],
    ['Nama Kontributor', form.contributor],
    ...(form.journalType === 'event-reflection' ? [['Nama Event', form.eventName]] : []),
  ].filter(([, nilai]) => kosongkah(nilai)).map(([label]) => label)

  if (kurang.length) {
    validationError.value = `Masih kosong: ${kurang.join(', ')}.`
    return
  }
  if (!content.value.trim()) {
    validationError.value = 'Konten jurnal perlu diisi terlebih dahulu.'
    return
  }
  saved.value = true
}
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <UButton
      to="/admin/jurnal"
      color="secondary"
      variant="link"
      leading-icon="i-lucide-arrow-left"
      class="mb-4 -ml-2"
    >
      Kembali ke Jurnal
    </UButton>

    <h1 class="font-serif text-5xl text-cc-green-800">
      {{ isNew ? 'Add Jurnal' : 'Edit Jurnal' }}
    </h1>

    <UCard class="mt-5" :ui="{ body: 'p-8' }">
      <UForm :state="form" class="space-y-6" @submit="saveJournal">
        <UFormField label="Judul Jurnal" name="title" required :error="wajibKosong(form.title, dicoba)">
          <UInput v-model="form.title" placeholder="Masukkan judul jurnal" class="w-full" />
        </UFormField>

        <div class="grid gap-6 sm:grid-cols-2">
          <UFormField label="Tipe Jurnal" name="journalType" required :error="wajibKosong(form.journalType, dicoba)">
            <USelect
              v-model="form.journalType"
              :items="journalTypeOptions"
              placeholder="Pilih tipe jurnal"
              class="w-full"
            />
          </UFormField>
          <UFormField
            v-if="form.journalType === 'event-reflection'"
            label="Nama Event"
            name="eventName"
            required
            :error="wajibKosong(form.eventName, dicoba)"
          >
            <USelect v-model="form.eventName" :items="events" placeholder="Pilih event" class="w-full" />
          </UFormField>
        </div>

        <UFormField label="Konten" name="content">
          <div class="overflow-hidden rounded-lg border border-cc-stone-200 bg-white">
            <div class="flex gap-1 border-b border-cc-stone-200 bg-cc-stone-50 p-2">
              <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-bold" aria-label="Bold" @click="format('bold')" />
              <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-italic" aria-label="Italic" @click="format('italic')" />
              <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-heading-2" aria-label="Heading" @click="format('formatBlock', 'h2')" />
              <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-list" aria-label="Daftar" @click="format('insertUnorderedList')" />
              <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-quote" aria-label="Kutipan" @click="format('formatBlock', 'blockquote')" />
            </div>
            <div
              ref="editor"
              contenteditable="true"
              class="min-h-56 p-4 text-base leading-7 outline-none"
              data-placeholder="Tulis isi jurnal di sini..."
              @input="updateContent"
            />
          </div>
        </UFormField>

        <div class="grid gap-6 sm:grid-cols-2">
          <UFormField label="Tipe Kontributor" name="contributorType">
            <URadioGroup
              v-model="form.contributorType"
              :items="contributorTypeOptions"
              orientation="horizontal"
            />
          </UFormField>
          <UFormField label="Nama Kontributor" name="contributor" required :error="wajibKosong(form.contributor, dicoba)">
            <USelect
              v-if="form.contributorType === 'member'"
              v-model="form.contributor"
              :items="members"
              placeholder="Pilih member"
              class="w-full"
            />
            <UInput
              v-else
              v-model="form.contributor"
              placeholder="Nama kontributor non member"
              class="w-full"
            />
          </UFormField>
        </div>

        <UAlert
          v-if="validationError"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :description="validationError"
        />
        <UAlert
          v-if="saved"
          color="primary"
          variant="subtle"
          icon="i-lucide-check"
          description="Jurnal berhasil disimpan sebagai draft (mockup)."
        />

        <UButton type="submit" color="secondary" size="lg" icon="i-lucide-save">Simpan</UButton>
      </UForm>
    </UCard>
  </div>
</template>

<style scoped>
[contenteditable]:empty:before {
  content: attr(data-placeholder);
  color: #94a3b8;
  pointer-events: none;
}
</style>
