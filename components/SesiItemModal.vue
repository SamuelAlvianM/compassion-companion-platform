<script setup lang="ts">
// Form satu item sesi (materi / galeri / referensi) — dipakai untuk menambah
// maupun mengubah.
//
// Satu komponen untuk keduanya, bukan dua: aturan yang menentukan bentuk form —
// jenis apa yang boleh untuk bagian ini, jenis mana yang butuh berkas dan mana yang
// butuh tautan, kapan sakelar "khusus peserta" muncul — sama persis. Memisahkannya
// berarti aturan itu ditulis dua kali, dan yang satu pasti tertinggal.
//
// Berkas punya dua jalan:
//   1. unggah baru — berkas dari komputer, masuk ke pustaka media
//   2. biarkan     — hanya saat mengubah; berkas lama dipertahankan
//
// "Pilih dari pustaka" dicabut. Ia menawarkan pemakaian ulang berkas yang dalam
// praktiknya tidak pernah terjadi — materi sebuah event adalah rekaman dan slide
// event itu sendiri — sementara kisi berisi seluruh berkas yang pernah diunggah
// membuat orang memilih berkas milik event lain tanpa sadar.

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
  /**
   * Sesinya belum ada di database — ini draf di halaman "Event baru".
   *
   * Berkasnya TETAP diunggah: `mediaId` hanya bisa lahir dari unggahan, dan
   * menahan berkas di memori sampai tombol "Buat event" ditekan berarti belasan foto
   * ponsel duduk di RAM tab yang sama sekali tidak menjanjikan akan tetap terbuka.
   * Yang ditahan cuma ITEM-nya — barisnya baru ditulis bersama seluruh event.
   */
  lokal?: boolean
}>()

const emit = defineEmits<{
  'update:open': [boolean]
  'tersimpan': []
  /** Mode lokal: isian yang sudah jadi, untuk disimpan induk nanti. */
  'draf': [Record<string, any>]
}>()

const mengubah = computed(() => Boolean(props.item))

const form = ref({ jenis: 'pdf', judul: '', judulEn: '', url: '', mediaId: '', terkunci: true })
const berkasInput = useTemplateRef<HTMLInputElement>('berkasInput')
const berkas = ref<File | null>(null)

/**
 * Kemajuan unggahan, 0–100; `null` berarti tidak sedang mengunggah.
 *
 * Ada karena rekaman sesi bisa puluhan MB: dengan koneksi rumahan itu beberapa menit,
 * dan sebelum ini satu-satunya tanda bahwa sesuatu sedang berjalan adalah lingkaran
 * berputar di tombol — bentuk yang sama persis dengan menyimpan tautan YouTube yang
 * selesai dalam sekejap. Yang menunggu tidak punya cara tahu apakah unggahannya
 * berjalan, apalagi kapan selesai.
 */
const progres = ref<number | null>(null)

/**
 * Byte sudah habis terkirim, tinggal menunggu server.
 *
 * Keadaan ini butuh bentuknya sendiri. Yang tersisa sesudah 100% bukan pengiriman
 * melainkan pekerjaan server — menguraikan multipart, menulis blob puluhan MB ke
 * SQLite — dan lamanya tidak bisa diketahui dari sisi ini sama sekali. Menampilkan
 * angka untuk sesuatu yang tidak terukur berarti angka yang diam, dan angka yang
 * diam di ujung terbaca sebagai macet.
 *
 * Jadi persentasenya diganti bar tak-tentu yang terus bergerak: ia tidak menjanjikan
 * kapan selesai, ia cuma menyatakan masih berjalan — dan itu memang seluruh yang
 * diketahui.
 */
const menunggguServer = computed(() => progres.value === 100)
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
  progres.value = null

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

/**
 * Jenis yang ditawarkan tiap bagian.
 *
 * Bagian "materi" dipersempit jadi tiga — PDF, video unggahan, YouTube. Yang
 * dibuang (Word/Excel/PPT, gambar, tautan web) bukan jenis yang tidak bisa
 * ditampung, melainkan jenis yang tidak bisa DIBUKA di halaman event: dokumen
 * Office terunduh alih-alih terbaca, gambar tunggal sebenarnya galeri, dan tautan
 * web sebenarnya referensi. Menawarkannya di sini cuma memindahkan isi ke bagian
 * yang salah.
 *
 * Item lama yang jenisnya sudah tidak ditawarkan tetap muncul di daftarnya sendiri
 * agar bisa dibaca dan dihapus — lihat `jenisTersedia`.
 */
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
    { value: 'video', label: 'Video (unggah)' },
    { value: 'youtube', label: 'YouTube (boleh unlisted)' },
  ]
})

/**
 * Daftar yang benar-benar dipasang ke USelect.
 *
 * Item lama bisa berjenis `dokumen`, `gambar`, atau `tautan` di bagian materi —
 * jenis yang tidak lagi ditawarkan. Tanpa penambahan ini, membukanya menghasilkan
 * kotak pilihan kosong, dan menyimpannya akan diam-diam mengganti jenisnya.
 */
const LABEL_LAMA: Record<string, string> = {
  dokumen: 'Dokumen (jenis lama)',
  gambar: 'Gambar (jenis lama)',
  tautan: 'Tautan web (jenis lama)',
  pdf: 'PDF',
  video: 'Video (unggah)',
  youtube: 'YouTube',
}

const jenisTersedia = computed(() => {
  const daftar = jenisOptions.value
  if (!form.value.jenis || daftar.some(o => o.value === form.value.jenis)) return daftar
  return [...daftar, { value: form.value.jenis, label: LABEL_LAMA[form.value.jenis] ?? form.value.jenis }]
})

/** Jenis yang isinya berupa berkas unggahan, bukan tautan luar. */
const pakaiBerkas = computed(() => ['pdf', 'dokumen', 'video', 'gambar'].includes(form.value.jenis))

// Cermin MEDIA_LIMITS di server/utils/media-services.ts. Bukan cuma disebutkan:
// nilainya juga dipakai menolak berkas sebelum ia naik (lihat `pilihBerkas`).
// Menyebut batas tanpa menegakkannya berarti unggahan 300 MB tetap berjalan
// beberapa menit hanya untuk dijawab 413 di ujungnya.
const BATAS_BYTE = computed(() => {
  if (form.value.jenis === 'gambar') return 10 * 1024 * 1024
  if (form.value.jenis === 'video') return 100 * 1024 * 1024
  return 25 * 1024 * 1024
})

const batasBerkas = computed(() => `${Math.round(BATAS_BYTE.value / 1024 / 1024)} MB`)

/** Dialog berkas hanya menawarkan jenis yang sedang dipilih. */
const terimaBerkas = computed(() => ({
  pdf: 'application/pdf,.pdf',
  video: 'video/*',
  gambar: 'image/*',
  dokumen: '.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv',
}[form.value.jenis] ?? ''))

const megabyte = (byte: number) => `${(byte / 1024 / 1024).toFixed(1)} MB`

const pilihBerkas = (e: Event) => {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0] ?? null
  galat.value = ''
  // Nilai input dikosongkan supaya memilih berkas yang SAMA dua kali tetap memicu
  // `change` — tanpa ini, membatalkan lalu memilih ulang tidak melakukan apa pun.
  // Berkasnya sendiri sudah dipegang `berkas`, jadi tidak ada yang hilang.
  input.value = ''

  if (f && f.size > BATAS_BYTE.value) {
    // Berkasnya dilepas, bukan sekadar ditandai: kalau ia tetap menempel, tombol
    // "Tambah" akan mengirimnya juga.
    berkas.value = null
    galat.value = `Ukuran berkas ${megabyte(f.size)} melebihi batas ${batasBerkas.value}. Pilih berkas yang lebih kecil.`
    return
  }

  berkas.value = f
  form.value.mediaId = ''
}

/** Berkas yang sudah menempel pada item ini (saat mengubah), untuk ditampilkan. */
const berkasLama = computed(() =>
  mengubah.value && props.item?.mediaId ? props.item.namaBerkas ?? props.item.mediaId : '')

/** Berkas yang akan tersimpan: unggahan baru, atau yang sudah menempel. */
const namaPilihan = computed(() => {
  if (berkas.value) return berkas.value.name
  return form.value.mediaId ? berkasLama.value : ''
})

// ── Simpan ───────────────────────────────────────────────────────────────────
const pesan = (e: any, bawaan: string) => e?.data?.statusMessage ?? e?.statusMessage ?? bawaan

const simpan = async () => {
  sibuk.value = true
  galat.value = ''
  try {
    let mediaId = form.value.mediaId
    /** Alamat berkas yang baru naik — hanya dipakai mode lokal, untuk pratinjau. */
    let mediaUrl = ''

    // Berkas diunggah lebih dulu ke pustaka media, baru itemnya menunjuk ke sana —
    // supaya satu berkas bisa dipakai ulang di sesi lain tanpa diunggah dua kali.
    if (pakaiBerkas.value && berkas.value) {
      progres.value = 0
      const naik = await unggahMedia(berkas.value, { onProgres: (p) => { progres.value = p } })
      mediaId = naik.id
      mediaUrl = naik.publicUrl ?? ''
      if (!form.value.judul) form.value.judul = berkas.value.name
    }

    // Jaring pengaman untuk galeri, yang tidak punya isian judul sama sekali:
    // memilih berkas dari pustaka atau mengunggah baru sudah mengisinya, tapi
    // mengubah foto lama yang judulnya pernah dikosongkan tidak melewati keduanya —
    // dan server menolak judul kosong.
    if (props.bagian === 'galeri' && !form.value.judul.trim()) {
      form.value.judul = namaPilihan.value || 'Foto'
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

    // Mode lokal: tidak ada yang dikirim. Yang dibawa pulang bukan cuma `body` —
    // induk juga butuh alamat berkasnya untuk menggambar cuplikan galeri, dan nama
    // berkasnya supaya membuka item ini lagi tidak berbunyi "belum ada berkas".
    if (props.lokal) {
      emit('draf', {
        ...body,
        bagian: props.bagian,
        namaBerkas: berkas.value?.name ?? props.item?.namaBerkas ?? null,
        // Kosong berarti "tidak ada berkas baru" — induk mempertahankan cuplikan
        // yang sudah ada, bukan menghapusnya jadi kotak abu-abu.
        mediaUrl,
      })
      emit('update:open', false)
      return
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
  finally { sibuk.value = false; progres.value = null }
}
</script>

<template>
  <UModal
    :open="open"
    :title="bagian === 'galeri'
      ? (mengubah ? 'Ganti foto' : 'Tambah foto')
      : (mengubah ? 'Ubah item' : 'Tambah item')"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4">
        <!-- Galeri tidak punya isian apa pun selain gambarnya.
             Jenisnya cuma satu ("Gambar"), sehingga pilihan berisi satu pilihan;
             dan judul foto dokumentasi hampir selalu berakhir sebagai pengulangan
             nama berkas. Yang tersisa: berkasnya. `judul` tetap terisi di balik
             layar dari nama berkas — ia jadi teks alternatif gambar, dan server
             mewajibkannya. -->
        <template v-if="bagian !== 'galeri'">
          <UFormField label="Jenis">
            <USelect v-model="form.jenis" :items="jenisTersedia" value-key="value" class="w-full" />
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
        </template>

        <template v-if="pakaiBerkas">
          <!-- `accept` mengikuti jenis yang dipilih: memilih PDF berarti dialog
               berkasnya hanya menawarkan PDF. Batasnya ditegakkan di `pilihBerkas`,
               bukan cuma disebut di sini. -->
          <UFormField label="Berkas" :hint="`maksimal ${batasBerkas}`">
            <!-- Tombol, bukan `<input type=file>` telanjang.
                 Kotak berkas bawaan digambar peramban sendiri: "Choose File / No
                 file chosen" dengan huruf, tinggi, dan sudut yang tidak mengikuti
                 satu pun isian lain di formulir ini — persoalan yang sama dengan
                 `input type=date` yang dicabut di Sesi 12. Inputnya tetap ada,
                 disembunyikan, dan tombol ini yang mengkliknya.

                 Selebar satu baris penuh: ia berdiri di kolomnya sendiri, dan tombol
                 sempit di kiri menyisakan ruang kosong yang membuat kolom ini terbaca
                 setengah jadi. -->
            <input
              ref="berkasInput"
              type="file"
              class="hidden"
              :accept="terimaBerkas"
              @change="pilihBerkas"
            >
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-paperclip"
              class="w-full justify-start"
              @click="berkasInput?.click()"
            >
              {{ berkas ? 'Ganti berkas' : 'Pilih berkas' }}
            </UButton>
          </UFormField>

          <!-- Bar kemajuan menggantikan baris nama berkas selama unggahan berjalan.
               Keduanya menempati tempat yang sama, jadi tidak ada yang bergeser saat
               unggahan mulai — yang berubah cuma isinya: dari "akan diunggah" jadi
               "sedang, sekian persen". -->
          <div
            v-if="progres !== null"
            class="rounded-lg border border-cc-stone-200 bg-cc-stone-50 px-3 py-2"
          >
            <div class="mb-1.5 flex items-center justify-between gap-2 text-xs">
              <span class="min-w-0 break-words text-cc-stone-700">
                <strong class="font-semibold">
                  {{ menunggguServer ? 'Menyimpan di server:' : 'Mengunggah:' }}
                </strong>
                {{ namaPilihan }}
              </span>
              <!-- Persentase menghilang begitu pengirimannya habis; yang tersisa
                   bukan lagi sesuatu yang bisa dihitung. -->
              <span v-if="!menunggguServer" class="shrink-0 font-semibold tabular-nums text-cc-green-800">
                {{ progres }}%
              </span>
              <span v-else class="shrink-0 text-cc-stone-500">sebentar lagi</span>
            </div>
            <!-- Digambar sendiri, bukan UProgress: yang dibutuhkan cuma satu batang
                 yang lebarnya mengikuti angka, dan transisinya dibuat 150 ms supaya
                 lompatan antar laporan tidak terbaca sebagai kedipan. -->
            <div class="h-1.5 w-full overflow-hidden rounded-full bg-cc-stone-200">
              <div
                v-if="!menunggguServer"
                class="h-full rounded-full bg-cc-green-800 transition-[width] duration-150 ease-linear"
                :style="{ width: `${progres}%` }"
              />
              <!-- Tak-tentu: potongan yang menyapu bolak-balik. Ia sengaja TIDAK
                   penuh — bar penuh yang diam adalah bentuk yang sama dengan
                   "selesai", dan ini belum selesai. -->
              <div v-else class="h-full w-1/3 rounded-full bg-cc-green-800 animate-sapu" />
            </div>
          </div>

          <!-- Yang akan tersimpan disebutkan sekali, apa pun jalannya. -->
          <div
            v-else-if="namaPilihan"
            class="flex items-center gap-2 rounded-lg border border-cc-stone-200 bg-cc-stone-50 px-3 py-2"
          >
            <UIcon
              :name="berkas ? 'i-lucide-upload' : 'i-lucide-paperclip'"
              class="size-4 shrink-0 text-cc-brown-500"
            />
            <span class="min-w-0 flex-1 break-words text-xs text-cc-stone-700" :title="namaPilihan">
              <strong class="font-semibold">{{ berkas ? 'Akan diunggah:' : 'Terpasang:' }}</strong>
              {{ namaPilihan }}
            </span>
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
