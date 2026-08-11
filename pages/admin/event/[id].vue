<script setup lang="ts">
// Form event admin: identitas event + pengelola sesi & materi.
//
// Satu halaman menangani "baru" dan "ubah". Bedanya hanya di `baru`: blok sesi
// disembunyikan sampai eventnya tersimpan — sesi butuh kegiatanId, dan membiarkan
// orang menyusun sesi yang belum punya induk hanya akan hilang saat halaman ditutup.
definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const id = computed(() => String(route.params.id))
const baru = computed(() => id.value === 'new')

const kosong = () => ({
  judul: '', judulEn: '', deskripsi: '', deskripsiEn: '',
  lokasi: '', tautanDaring: '',
  tanggalMulai: '', tanggalSelesai: '', tutupPendaftaran: '',
  kuota: '' as string | number, harga: 0,
  status: 'draft', coverMediaId: '',
})

const form = ref(kosong())
const sesi = ref<any[]>([])
const galat = ref('')
const sukses = ref('')
const sibuk = ref(false)

// Timestamp dari API → 'YYYY-MM-DD', dibaca dalam WIB supaya tanggalnya tidak
// mundur sehari (bug yang sama pernah muncul di halaman event publik).
const keYmd = (nilai: string | null) => {
  if (!nilai) return ''
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Jakarta',
  }).format(new Date(nilai))
}

const muat = async () => {
  if (baru.value) { form.value = kosong(); sesi.value = []; return }
  // Saat SSR, $fetch tidak ikut membawa cookie browser — tanpa penerusan ini,
  // endpoint admin selalu menjawab 401 pada render pertama.
  const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
  const res = await $fetch<any>(`/api/admin/events/${id.value}`, { headers })
  const d = res.data
  form.value = {
    judul: d.judul ?? '', judulEn: d.judulEn ?? '',
    deskripsi: d.deskripsi ?? '', deskripsiEn: d.deskripsiEn ?? '',
    lokasi: d.lokasi ?? '', tautanDaring: d.tautanDaring ?? '',
    tanggalMulai: keYmd(d.tanggalMulai), tanggalSelesai: keYmd(d.tanggalSelesai),
    tutupPendaftaran: keYmd(d.tutupPendaftaran),
    kuota: d.kuota ?? '', harga: d.harga ?? 0,
    status: d.status ?? 'draft', coverMediaId: d.coverMediaId ?? '',
  }
  // `tanggalYmd` ditambahkan sebagai field terpisah supaya <input type="date">
  // punya sesuatu yang bisa di-v-model tanpa merusak `tanggal` asli dari server.
  sesi.value = (res.sesi ?? []).map((s: any) => ({ ...s, tanggalYmd: keYmd(s.tanggal) }))
}

await muat()
watch(id, muat)

const pesan = (e: any, bawaan: string) =>
  e?.data?.statusMessage ?? e?.statusMessage ?? bawaan

const simpan = async () => {
  sibuk.value = true
  galat.value = ''
  sukses.value = ''
  try {
    if (baru.value) {
      const res = await $fetch<any>('/api/admin/events', { method: 'POST', body: form.value })
      // Berpindah ke halaman ubah supaya blok sesi langsung bisa dipakai — event
      // baru sudah dibekali satu sesi oleh server.
      await router.replace(`/admin/event/${res.data.id}`)
    }
    else {
      await $fetch(`/api/admin/events/${id.value}`, { method: 'PATCH', body: form.value })
      sukses.value = 'Perubahan tersimpan.'
      await muat()
    }
  }
  catch (e: any) { galat.value = pesan(e, 'Gagal menyimpan event.') }
  finally { sibuk.value = false }
}

// ── Sesi ─────────────────────────────────────────────────────────────────────
const tambahSesi = async () => {
  galat.value = ''
  try {
    await $fetch('/api/admin/sesi', { method: 'POST', body: { kegiatanId: id.value } })
    await muat()
  }
  catch (e: any) { galat.value = pesan(e, 'Gagal menambah sesi.') }
}

const simpanSesi = async (s: any) => {
  galat.value = ''
  try {
    await $fetch(`/api/admin/sesi/${s.id}`, {
      method: 'PATCH',
      body: { judul: s.judul, judulEn: s.judulEn, tanggal: s.tanggalYmd || null, tampil: s.tampil },
    })
    sukses.value = 'Sesi tersimpan.'
  }
  catch (e: any) { galat.value = pesan(e, 'Gagal menyimpan sesi.') }
}

const hapusSesi = async (s: any) => {
  galat.value = ''
  try {
    await $fetch(`/api/admin/sesi/${s.id}`, { method: 'DELETE' })
    await muat()
  }
  catch (e: any) { galat.value = pesan(e, 'Gagal menghapus sesi.') }
}

// ── Item sesi ────────────────────────────────────────────────────────────────
const itemModal = ref(false)
const itemSesiId = ref('')
const itemForm = ref({ bagian: 'materi', jenis: 'pdf', judul: '', judulEn: '', url: '', mediaId: '', terkunci: true })
const berkas = ref<File | null>(null)

const bukaItem = (sesiId: string, bagian: string) => {
  itemSesiId.value = sesiId
  itemForm.value = {
    bagian,
    jenis: bagian === 'galeri' ? 'gambar' : bagian === 'referensi' ? 'tautan' : 'pdf',
    judul: '', judulEn: '', url: '', mediaId: '',
    terkunci: bagian === 'materi',
  }
  berkas.value = null
  galat.value = ''
  itemModal.value = true
}

const jenisOptions = computed(() => {
  if (itemForm.value.bagian === 'galeri') return [{ value: 'gambar', label: 'Gambar' }]
  if (itemForm.value.bagian === 'referensi') {
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
const pakaiBerkas = computed(() => ['pdf', 'dokumen', 'video', 'gambar'].includes(itemForm.value.jenis))

// Angka-angka ini cermin MEDIA_LIMITS di server/utils/media-services.ts —
// ditampilkan supaya batasnya diketahui sebelum unggahan gagal, bukan sesudah.
const batasBerkas = computed(() => {
  if (itemForm.value.jenis === 'gambar') return '10 MB'
  if (itemForm.value.jenis === 'video') return '100 MB'
  return '25 MB'
})

const simpanItem = async () => {
  sibuk.value = true
  galat.value = ''
  try {
    let mediaId = itemForm.value.mediaId

    // Berkas diunggah lebih dulu ke pustaka media, baru itemnya dibuat menunjuk
    // ke sana — supaya satu berkas bisa dipakai ulang di sesi lain.
    if (pakaiBerkas.value && berkas.value) {
      const fd = new FormData()
      fd.append('file', berkas.value)
      const naik = await $fetch<any>('/api/media/upload', { method: 'POST', body: fd })
      mediaId = naik.data[0].id
      if (!itemForm.value.judul) itemForm.value.judul = berkas.value.name
    }

    await $fetch('/api/admin/sesi-item', {
      method: 'POST',
      body: {
        ...itemForm.value,
        sesiId: itemSesiId.value,
        mediaId: mediaId || null,
        url: itemForm.value.url || null,
      },
    })
    itemModal.value = false
    await muat()
  }
  catch (e: any) { galat.value = pesan(e, 'Gagal menambah item.') }
  finally { sibuk.value = false }
}

const hapusItem = async (itemId: string) => {
  galat.value = ''
  try {
    await $fetch(`/api/admin/sesi-item/${itemId}`, { method: 'DELETE' })
    await muat()
  }
  catch (e: any) { galat.value = pesan(e, 'Gagal menghapus item.') }
}

const statusOptions = [
  { value: 'draft', label: 'Draft — belum tampil di halaman publik' },
  { value: 'terbit', label: 'Terbit — tampil dan bisa didaftari' },
  { value: 'selesai', label: 'Selesai — ditutup lebih awal' },
  { value: 'batal', label: 'Batal' },
]

const BAGIAN = [
  { key: 'materi', label: 'Materi Pembelajaran', ikon: 'i-lucide-file-text', petunjuk: 'Slide, rekaman, worksheet. Terkunci secara bawaan — hanya peserta event dan pengelola yang bisa membukanya.' },
  { key: 'galeri', label: 'Galeri', ikon: 'i-lucide-images', petunjuk: 'Foto dokumentasi. Terbuka untuk semua pengunjung; bisa dizoom dan diputar.' },
  { key: 'referensi', label: 'Referensi', ikon: 'i-lucide-link', petunjuk: 'Bacaan atau tautan lanjutan. Selalu terbuka untuk semua.' },
] as const
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <UButton to="/admin/events" color="neutral" variant="ghost" size="sm" icon="i-lucide-arrow-left" class="-ml-2 mb-1">
          Kembali ke daftar event
        </UButton>
        <h1 class="font-serif text-5xl text-cc-green-800">{{ baru ? 'Event baru' : form.judul || 'Ubah event' }}</h1>
      </div>
      <UButton color="secondary" size="lg" icon="i-lucide-save" :loading="sibuk" @click="simpan">
        {{ baru ? 'Buat event' : 'Simpan perubahan' }}
      </UButton>
    </div>

    <UAlert v-if="galat" color="error" variant="subtle" class="mb-4" icon="i-lucide-triangle-alert" :description="galat" />
    <UAlert v-if="sukses" color="primary" variant="subtle" class="mb-4" icon="i-lucide-check" :description="sukses" />

    <!-- Identitas event -->
    <UCard class="mb-6">
      <template #header>
        <h2 class="font-serif text-2xl text-cc-green-800">Identitas event</h2>
      </template>

      <div class="grid gap-4 md:grid-cols-2">
        <UFormField label="Judul (ID)" required>
          <UInput v-model="form.judul" class="w-full" placeholder="Leadership with Compassion" />
        </UFormField>
        <UFormField label="Judul (EN)" hint="opsional">
          <UInput v-model="form.judulEn" class="w-full" />
        </UFormField>

        <UFormField label="Deskripsi (ID)" class="md:col-span-2">
          <UTextarea v-model="form.deskripsi" :rows="3" class="w-full" />
        </UFormField>
        <UFormField label="Deskripsi (EN)" class="md:col-span-2" hint="opsional">
          <UTextarea v-model="form.deskripsiEn" :rows="3" class="w-full" />
        </UFormField>

        <UFormField label="Lokasi">
          <UInput v-model="form.lokasi" class="w-full" placeholder="Jakarta · Rumah Retret St. Ignatius" />
        </UFormField>
        <UFormField label="Tautan daring">
          <template #hint>
            <UTooltip text="Diisi berarti event ini daring — kartunya memakai ikon video, bukan pin lokasi.">
              <UIcon name="i-lucide-info" class="size-4 text-cc-brown-500" />
            </UTooltip>
          </template>
          <UInput v-model="form.tautanDaring" class="w-full" placeholder="https://zoom.us/j/…" />
        </UFormField>

        <UFormField label="Tanggal mulai" required>
          <UInput v-model="form.tanggalMulai" type="date" class="w-full" />
        </UFormField>
        <UFormField label="Tanggal selesai" hint="opsional">
          <UInput v-model="form.tanggalSelesai" type="date" class="w-full" />
        </UFormField>

        <UFormField label="Tutup pendaftaran">
          <template #hint>
            <UTooltip text="Kosongkan agar pendaftaran terbuka sampai event dimulai.">
              <UIcon name="i-lucide-info" class="size-4 text-cc-brown-500" />
            </UTooltip>
          </template>
          <UInput v-model="form.tutupPendaftaran" type="date" class="w-full" />
        </UFormField>
        <UFormField label="Kuota">
          <template #hint>
            <UTooltip text="Kosongkan untuk tanpa batas peserta.">
              <UIcon name="i-lucide-info" class="size-4 text-cc-brown-500" />
            </UTooltip>
          </template>
          <UInput v-model="form.kuota" type="number" min="1" class="w-full" placeholder="Tanpa batas" />
        </UFormField>

        <UFormField label="Harga (Rp)" hint="0 = gratis">
          <UInput v-model.number="form.harga" type="number" min="0" class="w-full" />
        </UFormField>
        <UFormField label="Status">
          <USelect v-model="form.status" :items="statusOptions" value-key="value" class="w-full" />
        </UFormField>
      </div>
    </UCard>

    <!-- Sesi & materi -->
    <UCard v-if="!baru">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="inline-flex items-center gap-2 font-serif text-2xl text-cc-green-800">
              Sesi & materi
              <UTooltip text="Sesi = partisi event. Satu event boleh dibagi jadi berapa pun sesi — Day 1, Day 2, atau per topik. Tiap sesi punya materi, galeri, dan referensinya sendiri.">
                <UIcon name="i-lucide-info" class="size-5 text-cc-brown-500" />
              </UTooltip>
            </h2>
            <p class="mt-1 text-sm text-cc-stone-600">
              {{ sesi.length }} sesi. Event baru otomatis dibekali satu sesi; tambah sendiri sesuai kebutuhan.
            </p>
          </div>
          <UButton color="secondary" variant="soft" icon="i-lucide-plus" @click="tambahSesi">
            Tambah sesi
          </UButton>
        </div>
      </template>

      <div v-if="!sesi.length" class="py-6 text-center text-sm text-cc-stone-500">
        Belum ada sesi.
      </div>

      <div v-for="s in sesi" :key="s.id" class="mb-4 rounded-xl border border-cc-stone-200 p-4 last:mb-0">
        <div class="mb-4 grid items-end gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto_auto]">
          <UFormField label="Judul sesi" size="sm">
            <UInput v-model="s.judul" class="w-full" />
          </UFormField>
          <UFormField label="Tanggal" size="sm">
            <UInput v-model="s.tanggalYmd" type="date" class="w-full" />
          </UFormField>
          <UTooltip text="Sembunyikan sesi ini dari halaman publik tanpa menghapus isinya">
            <USwitch v-model="s.tampil" label="Tampil" />
          </UTooltip>
          <div class="flex gap-1">
            <UButton color="neutral" variant="outline" size="sm" icon="i-lucide-save" aria-label="Simpan sesi" @click="simpanSesi(s)" />
            <UButton color="error" variant="ghost" size="sm" icon="i-lucide-trash-2" aria-label="Hapus sesi" @click="hapusSesi(s)" />
          </div>
        </div>

        <div class="grid gap-4 lg:grid-cols-3">
          <div v-for="b in BAGIAN" :key="b.key" class="rounded-lg bg-cc-stone-50 p-3">
            <div class="mb-2 flex items-center gap-1.5">
              <UIcon :name="b.ikon" class="size-4 text-cc-brown-500" />
              <span class="text-sm font-semibold text-cc-green-800">{{ b.label }}</span>
              <UTooltip :text="b.petunjuk">
                <UIcon name="i-lucide-info" class="size-3.5 text-cc-stone-400" />
              </UTooltip>
              <UBadge color="neutral" variant="subtle" size="sm" class="ml-auto">{{ s[b.key].length }}</UBadge>
            </div>

            <ul class="mb-2 space-y-1">
              <li
                v-for="item in s[b.key]"
                :key="item.id"
                class="flex items-center gap-2 rounded border border-cc-stone-200 bg-white px-2 py-1.5 text-xs"
              >
                <UIcon v-if="item.terkunci" name="i-lucide-lock" class="size-3 shrink-0 text-cc-stone-400" />
                <span class="min-w-0 flex-1 truncate" :title="item.judul">{{ item.judul }}</span>
                <UButton
                  color="error"
                  variant="ghost"
                  size="xs"
                  icon="i-lucide-x"
                  aria-label="Hapus item"
                  @click="hapusItem(item.id)"
                />
              </li>
            </ul>

            <UButton color="neutral" variant="soft" size="xs" icon="i-lucide-plus" block @click="bukaItem(s.id, b.key)">
              Tambah
            </UButton>
          </div>
        </div>
      </div>
    </UCard>

    <UAlert
      v-else
      color="neutral"
      variant="subtle"
      icon="i-lucide-info"
      title="Sesi dibuat setelah event tersimpan"
      description="Simpan event ini dulu. Server akan langsung membuatkan satu sesi sebagai titik mulai, lalu Anda bisa menambah sesi sebanyak yang dibutuhkan."
    />

    <!-- Tambah item -->
    <UModal v-model:open="itemModal" title="Tambah item">
      <template #body>
        <div class="space-y-4">
          <UFormField label="Jenis">
            <USelect v-model="itemForm.jenis" :items="jenisOptions" value-key="value" class="w-full" />
          </UFormField>

          <UFormField label="Judul" :required="!pakaiBerkas">
            <UInput
              v-model="itemForm.judul"
              class="w-full"
              :placeholder="pakaiBerkas ? 'Kosongkan untuk memakai nama berkas' : ''"
            />
          </UFormField>

          <UFormField v-if="pakaiBerkas" label="Berkas" :hint="`maksimal ${batasBerkas}`">
            <UInput
              type="file"
              class="w-full"
              @change="berkas = ($event.target as HTMLInputElement).files?.[0] ?? null"
            />
          </UFormField>

          <UFormField
            v-else
            :label="itemForm.jenis === 'youtube' ? 'Tautan YouTube' : 'Alamat tautan'"
            required
          >
            <template #hint>
              <UTooltip
                v-if="itemForm.jenis === 'youtube'"
                text="Video unlisted boleh — ia tetap bisa di-embed selama izin embed tidak dimatikan di YouTube. Video privat tidak bisa."
              >
                <UIcon name="i-lucide-info" class="size-4 text-cc-brown-500" />
              </UTooltip>
            </template>
            <UInput
              v-model="itemForm.url"
              class="w-full"
              :placeholder="itemForm.jenis === 'youtube' ? 'https://youtu.be/… atau youtube.com/watch?v=…' : 'https://…'"
            />
          </UFormField>

          <UFormField v-if="itemForm.bagian === 'materi'" help="Matikan hanya jika materi ini boleh dibuka siapa saja, misalnya silabus.">
            <USwitch v-model="itemForm.terkunci" label="Khusus peserta event" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="itemModal = false">Batal</UButton>
          <UButton color="secondary" :loading="sibuk" @click="simpanItem">Tambah</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
