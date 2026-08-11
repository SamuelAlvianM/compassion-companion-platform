<script setup lang="ts">
// Panel testimoni di halaman detail event, sekaligus penyuntingnya.
//
// Satu komponen untuk mode baca dan mode sunting, bukan dua: markup yang dibaca
// pengunjung dan markup yang disunting pengelola harus persis sama, dan itu paling
// mudah dijamin kalau keduanya memang satu blok yang sama. Saat mode sunting mati,
// yang tergambar sama dengan panel testimoni sebelum komponen ini ada.
//
// Testimoni disimpan sebagai satu kolom JSON (lihat cc_kegiatan.testimoni), jadi
// setiap tindakan — tambah, ubah, hapus, geser — mengirim SELURUH daftar yang baru,
// bukan satu barisnya. Tidak ada id per testimoni yang bisa dijadikan sasaran PATCH.

export interface Testimoni {
  nama: string
  teks: string
}

const props = defineProps<{
  daftar: Testimoni[]
  isEn?: boolean
  /** Penyimpan; menerima daftar utuh yang baru. Melempar error kalau gagal. */
  simpan: (daftar: Testimoni[]) => Promise<void>
}>()

const { aktif } = useEditMode()

const t = computed(() => props.isEn
  ? {
      eyebrow: 'Participant testimonies', judul: 'What they said',
      tambah: 'Add testimony', nama: 'Name', teks: 'Testimony',
      namaPh: 'Participant name', teksPh: 'What did they say?',
      simpanTombol: 'Save', batal: 'Cancel', ubah: 'Edit', hapus: 'Delete',
      naik: 'Move up', turun: 'Move down',
      hapusJudul: 'Delete this testimony?',
      hapusIsi: 'It will disappear from the public page right away. This cannot be undone.',
      kosong: 'No testimonies yet. Only you can see this panel while edit mode is on.',
      wajib: 'Fill in the name or the testimony.',
    }
  : {
      eyebrow: 'Testimoni peserta', judul: 'Apa kata mereka',
      tambah: 'Tambah testimoni', nama: 'Nama', teks: 'Testimoni',
      namaPh: 'Nama peserta', teksPh: 'Apa yang ia katakan?',
      simpanTombol: 'Simpan', batal: 'Batal', ubah: 'Ubah', hapus: 'Hapus',
      naik: 'Geser ke atas', turun: 'Geser ke bawah',
      hapusJudul: 'Hapus testimoni ini?',
      hapusIsi: 'Ia langsung hilang dari halaman publik. Tindakan ini tidak bisa dibatalkan.',
      kosong: 'Belum ada testimoni. Panel ini hanya terlihat oleh Anda selama mode sunting menyala.',
      wajib: 'Isi nama atau isi testimoninya.',
    })

// Panel tetap muncul saat daftarnya kosong TAPI mode sunting menyala — tanpa itu
// tidak ada tempat untuk menekan "Tambah testimoni" pada event yang belum punya satu pun.
const tampil = computed(() => props.daftar.length > 0 || aktif.value)

// ── Menyunting satu baris ────────────────────────────────────────────────────
/** Indeks yang sedang disunting; -1 berarti sedang menambah baru; null berarti tidak ada. */
const indeks = ref<number | null>(null)
const draft = ref<Testimoni>({ nama: '', teks: '' })
const sibuk = ref(false)
const galat = ref('')

const mulaiTambah = () => {
  indeks.value = -1
  draft.value = { nama: '', teks: '' }
  galat.value = ''
}

const mulaiUbah = (i: number) => {
  indeks.value = i
  draft.value = { ...props.daftar[i]! }
  galat.value = ''
}

const batal = () => { indeks.value = null; galat.value = '' }

/** Kirim daftar baru; kembalikan true kalau tersimpan. */
const kirim = async (daftar: Testimoni[]) => {
  sibuk.value = true
  galat.value = ''
  try {
    await props.simpan(daftar)
    return true
  }
  catch (e: any) {
    galat.value = e?.data?.statusMessage ?? e?.statusMessage ?? 'Gagal menyimpan.'
    return false
  }
  finally { sibuk.value = false }
}

const simpanDraft = async () => {
  const bersih = { nama: draft.value.nama.trim(), teks: draft.value.teks.trim() }
  // Keduanya kosong berarti baris mati — server juga membuangnya, jadi ditolak di
  // sini supaya orang tidak menekan Simpan lalu mengira testimoninya hilang.
  if (!bersih.nama && !bersih.teks) { galat.value = t.value.wajib; return }

  const baru = [...props.daftar]
  if (indeks.value === -1) baru.push(bersih)
  else if (indeks.value !== null) baru[indeks.value] = bersih

  if (await kirim(baru)) indeks.value = null
}

// ── Hapus ────────────────────────────────────────────────────────────────────
// Dikonfirmasi lewat modal, bukan langsung: satu-satunya salinan testimoni ada di
// kolom JSON ini, jadi kliknya tidak punya jalan pulang.
const hapusIndeks = ref<number | null>(null)
const calonHapus = computed(() => hapusIndeks.value === null ? null : props.daftar[hapusIndeks.value] ?? null)

const hapusSekarang = async () => {
  if (hapusIndeks.value === null) return
  const baru = props.daftar.filter((_, i) => i !== hapusIndeks.value)
  if (await kirim(baru)) hapusIndeks.value = null
}

// ── Urutan ───────────────────────────────────────────────────────────────────
// Tombol naik/turun, bukan seret: urutannya tidak punya kolom sendiri (ia posisi di
// dalam larik JSON), dan dua tombol sudah cukup untuk daftar sependek ini —
// sekaligus tetap bisa dipakai lewat papan tik.
const geser = async (i: number, arah: -1 | 1) => {
  const tujuan = i + arah
  if (tujuan < 0 || tujuan >= props.daftar.length) return
  const baru = [...props.daftar]
  ;[baru[i], baru[tujuan]] = [baru[tujuan]!, baru[i]!]
  await kirim(baru)
}
</script>

<template>
  <!-- `is-editing` melepas tinggi tetap 530px + posisi sticky panel ini. Keduanya
       benar untuk daftar yang hanya dibaca, tapi begitu ada kotak isian di dalamnya
       formnya terpotong dan tidak bisa digulir ke tombol Simpan. -->
  <aside v-if="tampil" class="testimonials panel mt-5" :class="aktif ? 'is-editing' : ''">
    <div class="eyebrow">{{ t.eyebrow }}</div>
    <h2 class="section-title">{{ t.judul }}</h2>

    <div v-if="daftar.length" class="testimonial-list">
      <div v-for="(k, i) in daftar" :key="i" class="comment">
        <!-- Mode baca: sama persis dengan panel sebelum komponen ini ada. -->
        <template v-if="!aktif || indeks !== i">
          <strong>{{ k.nama }}</strong>
          <p>“{{ k.teks }}”</p>

          <div v-if="aktif" class="testimonial-actions">
            <UButton
              size="xs" color="neutral" variant="ghost" icon="i-lucide-chevron-up"
              :aria-label="t.naik" :disabled="i === 0 || sibuk" @click="geser(i, -1)"
            />
            <UButton
              size="xs" color="neutral" variant="ghost" icon="i-lucide-chevron-down"
              :aria-label="t.turun" :disabled="i === daftar.length - 1 || sibuk" @click="geser(i, 1)"
            />
            <UButton
              size="xs" color="neutral" variant="ghost" icon="i-lucide-pencil"
              :aria-label="t.ubah" @click="mulaiUbah(i)"
            />
            <UButton
              size="xs" color="error" variant="ghost" icon="i-lucide-trash-2"
              :aria-label="t.hapus" @click="hapusIndeks = i"
            />
          </div>
        </template>

        <!-- Baris ini sedang disunting. -->
        <div v-else class="testimonial-form">
          <UInput v-model="draft.nama" :placeholder="t.namaPh" :aria-label="t.nama" class="w-full" />
          <UTextarea v-model="draft.teks" :rows="3" :placeholder="t.teksPh" :aria-label="t.teks" class="w-full" />
          <div class="flex flex-wrap items-center gap-2">
            <UButton size="xs" color="secondary" icon="i-lucide-check" :loading="sibuk" @click="simpanDraft">
              {{ t.simpanTombol }}
            </UButton>
            <UButton size="xs" color="neutral" variant="ghost" @click="batal">{{ t.batal }}</UButton>
          </div>
          <p v-if="galat" class="editable-error">{{ galat }}</p>
        </div>
      </div>
    </div>

    <!-- Baris baru: kotaknya sendiri, di bawah daftar. -->
    <div v-if="aktif && indeks === -1" class="comment mt-3">
      <div class="testimonial-form">
        <UInput v-model="draft.nama" :placeholder="t.namaPh" :aria-label="t.nama" class="w-full" />
        <UTextarea v-model="draft.teks" :rows="3" :placeholder="t.teksPh" :aria-label="t.teks" class="w-full" />
        <div class="flex flex-wrap items-center gap-2">
          <UButton size="xs" color="secondary" icon="i-lucide-check" :loading="sibuk" @click="simpanDraft">
            {{ t.simpanTombol }}
          </UButton>
          <UButton size="xs" color="neutral" variant="ghost" @click="batal">{{ t.batal }}</UButton>
        </div>
        <p v-if="galat" class="editable-error">{{ galat }}</p>
      </div>
    </div>

    <template v-if="aktif">
      <p v-if="!daftar.length" class="mt-3 text-sm text-cc-stone-500">{{ t.kosong }}</p>

      <UButton
        v-if="indeks === null"
        class="mt-4"
        size="sm"
        color="secondary"
        variant="soft"
        icon="i-lucide-plus"
        block
        @click="mulaiTambah"
      >
        {{ t.tambah }}
      </UButton>

      <!-- Galat dari geser/hapus muncul di luar form, karena keduanya tidak punya form. -->
      <p v-if="galat && indeks === null" class="editable-error mt-2">{{ galat }}</p>
    </template>

    <!-- `:open` + `@update:open`, bukan `v-model:open`: v-model butuh sesuatu yang
         bisa ditulisi, sementara keadaan terbuka di sini adalah turunan dari
         `hapusIndeks`. Menutup modal berarti mengosongkan indeksnya. -->
    <UModal
      :open="hapusIndeks !== null"
      :title="t.hapusJudul"
      @update:open="(nilai: boolean) => { if (!nilai) hapusIndeks = null }"
    >
      <template #body>
        <p class="text-sm text-cc-stone-600">{{ t.hapusIsi }}</p>
        <div v-if="calonHapus" class="mt-3 rounded-lg border border-cc-stone-200 bg-cc-stone-50 p-3">
          <p class="font-semibold text-cc-green-800">{{ calonHapus.nama }}</p>
          <p class="mt-1 text-sm text-cc-stone-600">“{{ calonHapus.teks }}”</p>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="hapusIndeks = null">{{ t.batal }}</UButton>
          <UButton color="error" :loading="sibuk" icon="i-lucide-trash-2" @click="hapusSekarang">{{ t.hapus }}</UButton>
        </div>
      </template>
    </UModal>
  </aside>
</template>
