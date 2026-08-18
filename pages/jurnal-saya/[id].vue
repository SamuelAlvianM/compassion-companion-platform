<script setup lang="ts">
// Halaman tulis milik member.
//
// Sengaja sesempit ini: JUDUL dan ISI, tidak lebih. Kategori, event terkait,
// gambar sampul, dan ringkasan ditentukan admin — istilah redaksional itu bukan
// urusan yang menulis, dan yang menerbitkan tetap admin.
//
// Yang juga tidak ada di sini: nama editor yang memeriksa. Penulis melihat
// keadaannya ("sedang diperiksa", "perlu direvisi") dan catatannya, bukan siapa
// yang menuliskan catatan itu.

const route = useRoute()
const router = useRouter()
const toast = useToast()

const isEn = computed(() => route.path.startsWith('/en'))
const base = computed(() => (isEn.value ? '/en' : '/id'))
const id = computed(() => String(route.params.id))

const judul = ref('')

// Judul halaman dipasang SEBELUM `await` pertama. Komposabel berkonteks komponen
// (useHead/useSeoMeta) kehilangan konteksnya begitu setup pernah tertahan sekali,
// dan halamannya jatuh dengan "useHead() was called without provide context".
// Karena itu `judul` pun dideklarasikan di atas sini, supaya judul tab ikut
// berubah begitu tulisannya termuat.
useSeoMeta({
  title: () => judul.value || (isEn.value ? 'My journal' : 'Jurnal saya'),
  robots: 'noindex',
})

const { user, muat: muatAuth } = useAuth()
await muatAuth()
if (!user.value) {
  await navigateTo(`${base.value}/login?redirect=${encodeURIComponent(route.path)}`)
}

const isi = ref('')
const statusTulisan = ref<'draft' | 'review' | 'revisi' | 'approved' | 'published'>('draft')
const catatanRevisi = ref<string | null>(null)
const slug = ref('')
const bolehSunting = ref(true)
const galat = ref('')
const sibuk = ref(false)

const pesan = (e: any, bawaan: string) =>
  e?.data?.statusMessage || e?.statusMessage || e?.message || bawaan

// ── Simpan otomatis ──────────────────────────────────────────────────────────
// Jeda 800 ms sesudah mengetik berhenti. Untuk tulisan panjang ini bukan
// kenyamanan melainkan pengaman — tidak ada tombol "simpan" yang bisa lupa ditekan
// sebelum menutup tab.
//
// Berdiri di atas `muat()` karena `muat()` memanggil `sidik()` — dan ia dijalankan
// sebelum baris-baris di bawahnya sempat hidup.
const sidik = () => JSON.stringify({ judul: judul.value.trim(), isi: isi.value })
const tersimpan = ref('')
const keadaanSimpan = ref<'diam' | 'menunggu' | 'menyimpan' | 'tersimpan' | 'gagal'>('diam')
let timer: ReturnType<typeof setTimeout> | undefined

const muat = async () => {
  try {
    const { data } = await $fetch<{ data: any }>(`/api/jurnal-saya/${id.value}`, {
      headers: import.meta.server ? useRequestHeaders(['cookie']) : undefined,
    })
    judul.value = data.judul ?? ''
    isi.value = data.isi ?? ''
    statusTulisan.value = data.status
    catatanRevisi.value = data.catatanRevisi
    slug.value = data.slug
    bolehSunting.value = data.bolehSunting
    tersimpan.value = sidik()
  }
  catch (e: any) {
    galat.value = pesan(e, 'Tulisan tidak ditemukan.')
  }
}

await muat()


const simpanSekarang = async () => {
  if (!bolehSunting.value) return
  if (!judul.value.trim()) { keadaanSimpan.value = 'diam'; return }
  if (sidik() === tersimpan.value) { keadaanSimpan.value = 'diam'; return }

  const dikirim = sidik()
  keadaanSimpan.value = 'menyimpan'
  galat.value = ''
  try {
    await $fetch(`/api/jurnal-saya/${id.value}`, {
      method: 'PATCH',
      body: { judul: judul.value.trim(), isi: isi.value },
    })
    tersimpan.value = dikirim
    keadaanSimpan.value = 'tersimpan'
  }
  catch (e: any) {
    keadaanSimpan.value = 'gagal'
    galat.value = pesan(e, 'Gagal menyimpan tulisan.')
  }
}

watch([judul, isi], () => {
  if (!bolehSunting.value) return
  clearTimeout(timer)
  keadaanSimpan.value = 'menunggu'
  timer = setTimeout(simpanSekarang, 800)
})

onBeforeUnmount(() => clearTimeout(timer))

// ── Kirim ────────────────────────────────────────────────────────────────────
const modalKirim = ref(false)

const kirim = async () => {
  galat.value = ''
  sibuk.value = true
  try {
    clearTimeout(timer)
    const { data } = await $fetch<{ data: any }>(`/api/jurnal-saya/${id.value}`, {
      method: 'PATCH',
      body: { judul: judul.value.trim(), isi: isi.value, status: 'review' },
    })
    statusTulisan.value = data.status
    catatanRevisi.value = data.catatanRevisi ?? null
    bolehSunting.value = false
    modalKirim.value = false
    tersimpan.value = sidik()
    keadaanSimpan.value = 'tersimpan'
    toast.add({
      title: isEn.value ? 'Sent for review' : 'Tulisan sudah dikirim',
      description: isEn.value
        ? 'You will see a note here if any revision is needed.'
        : 'Kalau ada yang perlu direvisi, catatannya akan muncul di halaman ini.',
      icon: 'i-lucide-check',
      color: 'primary',
    })
  }
  catch (e: any) {
    galat.value = pesan(e, 'Gagal mengirim tulisan.')
  }
  finally { sibuk.value = false }
}

const t = computed(() => isEn.value
  ? {
      kembali: 'My journal', kirim: 'Send for review', kirimUlang: 'Send the revision',
      judulLabel: 'Title', isiLabel: 'Write your journal here:',
      catatan: 'Revision note', diperiksa: 'Being reviewed',
      diperiksaIsi: 'Your journal is being reviewed by the editorial team. Please wait for the next update.',
      terbit: 'Published', terbitIsi: 'This piece is live on the journal page.',
      lihat: 'Read it', konfirmasi: 'Send this writing?',
      konfirmasiIsi: 'While it is being reviewed you cannot edit it. It comes back to you if a revision is needed.',
      batal: 'Not yet', kosong: 'Write something first before sending.',
    }
  : {
      kembali: 'Jurnal saya', kirim: 'Kirim untuk diperiksa', kirimUlang: 'Kirim hasil revisi',
      judulLabel: 'Judul', isiLabel: 'Tuliskan jurnal Anda di sini:',
      catatan: 'Catatan revisi', diperiksa: 'Sedang diperiksa',
      diperiksaIsi: 'Jurnal Anda sedang diperiksa oleh tim Editor. Mohon menunggu update selanjutnya.',
      terbit: 'Sudah terbit', terbitIsi: 'Tulisan ini sudah tampil di halaman jurnal.',
      lihat: 'Lihat tulisannya', konfirmasi: 'Kirim tulisan ini?',
      konfirmasiIsi: 'Selama diperiksa, tulisannya belum bisa disunting. Kalau ada yang perlu diperbaiki, ia kembali kepada Anda.',
      batal: 'Belum', kosong: 'Tulis dulu isinya sebelum dikirim.',
    })


const siapDikirim = computed(() => Boolean(judul.value.trim()) && Boolean(isi.value?.replace(/<[^>]*>/g, '').trim()))
</script>

<template>
  <main class="event-page">
    <div class="container" style="max-width: 860px">
      <div class="page-head">
        <NuxtLink :to="`${base}/jurnal-saya`" class="text-sm text-cc-stone-600 hover:text-cc-brown-500">
          &larr; {{ t.kembali }}
        </NuxtLink>
      </div>

      <UAlert
        v-if="galat"
        class="mb-4"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :description="galat"
      />

      <!-- Catatan revisi: hal pertama yang perlu dibaca saat tulisan dikembalikan,
           jadi ia duduk di paling atas. -->
      <UAlert
        v-if="statusTulisan === 'revisi' && catatanRevisi"
        class="mb-4"
        color="warning"
        variant="subtle"
        icon="i-lucide-message-square-warning"
        :title="t.catatan"
        :description="catatanRevisi"
      />

      <UAlert
        v-else-if="statusTulisan === 'review' || statusTulisan === 'approved'"
        class="mb-4"
        color="neutral"
        variant="subtle"
        icon="i-lucide-hourglass"
        :title="t.diperiksa"
        :description="t.diperiksaIsi"
      />

      <UAlert
        v-else-if="statusTulisan === 'published'"
        class="mb-4"
        color="primary"
        variant="subtle"
        icon="i-lucide-check"
        :title="t.terbit"
        :description="t.terbitIsi"
        :actions="[{ label: t.lihat, to: `${base}/jurnal/${slug}`, color: 'primary', variant: 'link' }]"
      />

      <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div class="min-w-0 flex-1">
          <label class="mb-1 block text-sm font-medium text-cc-stone-600">{{ t.judulLabel }}</label>
          <UInput
            v-model="judul"
            :disabled="!bolehSunting"
            size="xl"
            :ui="{ base: 'font-serif text-2xl' }"
            class="w-full"
          />
        </div>

        <div class="flex shrink-0 items-center gap-3">
          <IndikatorSimpan v-if="bolehSunting" :keadaan="keadaanSimpan" :is-en="isEn" />
          <UButton
            v-if="bolehSunting"
            color="secondary"
            icon="i-lucide-send"
            :disabled="!siapDikirim"
            @click="modalKirim = true"
          >
            {{ statusTulisan === 'revisi' ? t.kirimUlang : t.kirim }}
          </UButton>
        </div>
      </div>

      <p v-if="bolehSunting && !siapDikirim" class="mb-2 text-xs text-cc-stone-500">{{ t.kosong }}</p>

      <label class="mb-1 block text-sm font-medium text-cc-stone-600">{{ t.isiLabel }}</label>
      <JurnalEditor
        v-model="isi"
        :terkunci="!bolehSunting"
        :placeholder="isEn ? 'Start writing here…' : 'Mulai menulis di sini…'"
        class="mb-10"
      />

      <UModal v-model:open="modalKirim" :title="t.konfirmasi">
        <template #body>
          <p class="text-sm text-cc-stone-600">{{ t.konfirmasiIsi }}</p>
        </template>
        <template #footer>
          <div class="flex w-full justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="modalKirim = false">{{ t.batal }}</UButton>
            <UButton color="secondary" icon="i-lucide-send" :loading="sibuk" @click="kirim">
              {{ statusTulisan === 'revisi' ? t.kirimUlang : t.kirim }}
            </UButton>
          </div>
        </template>
      </UModal>
    </div>
  </main>
</template>
