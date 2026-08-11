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

const geserSesi = async (s: any, arah: 'naik' | 'turun') => {
  galat.value = ''
  try {
    await $fetch(`/api/admin/sesi/${s.id}/geser`, { method: 'POST', body: { arah } })
    await muat()
  }
  catch (e: any) { galat.value = pesan(e, 'Gagal menggeser sesi.') }
}

// ── Item sesi ────────────────────────────────────────────────────────────────
// Formnya tinggal di components/SesiItemModal.vue, dipakai bersama penyuntingan di
// tempat pada halaman event publik. Aturan bentuk form — jenis apa untuk bagian
// mana, mana yang butuh berkas, kapan sakelar "khusus peserta" muncul — hanya ada
// di satu tempat, jadi keduanya tidak bisa menyimpang.
const itemModal = ref(false)
const itemSesiId = ref('')
const itemBagian = ref<'materi' | 'galeri' | 'referensi'>('materi')
const itemDiubah = ref<any>(null)

const bukaItem = (sesiId: string, bagian: 'materi' | 'galeri' | 'referensi') => {
  itemSesiId.value = sesiId
  itemBagian.value = bagian
  itemDiubah.value = null
  galat.value = ''
  itemModal.value = true
}

const bukaUbahItem = (sesiId: string, item: any) => {
  itemSesiId.value = sesiId
  itemBagian.value = item.bagian
  itemDiubah.value = item
  galat.value = ''
  itemModal.value = true
}

const geserItem = async (itemId: string, arah: 'naik' | 'turun') => {
  galat.value = ''
  try {
    await $fetch(`/api/admin/sesi-item/${itemId}/geser`, { method: 'POST', body: { arah } })
    await muat()
  }
  catch (e: any) { galat.value = pesan(e, 'Gagal menggeser item.') }
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

/**
 * Tiga tab. Pembagiannya mengikuti tiga pekerjaan yang berbeda waktunya:
 * menyiapkan event (sebelum), mengurus pendaftar (selama pendaftaran dibuka),
 * dan mengunggah materi (setelah acara). Menumpuk ketiganya dalam satu halaman
 * panjang membuat pekerjaan yang sedang tidak dilakukan ikut menghalangi layar.
 *
 * Tab peserta & materi butuh kegiatanId, jadi keduanya tidak ada pada event baru.
 */
const tabs = computed(() => baru.value
  ? [{ value: 'info', label: 'Informasi utama', icon: 'i-lucide-file-text' }]
  : [
      { value: 'info', label: 'Informasi utama', icon: 'i-lucide-file-text' },
      { value: 'peserta', label: 'Daftar peserta', icon: 'i-lucide-users' },
      { value: 'materi', label: 'Materi', icon: 'i-lucide-folder-open' },
    ])

const tabAktif = ref('info')

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
      <!-- Tombol simpan hanya milik tab identitas. Di tab peserta & materi setiap
           tindakan menyimpan dirinya sendiri, jadi tombol ini di sana hanya akan
           menyarankan ada perubahan yang belum tersimpan padahal tidak ada. -->
      <UButton
        v-if="tabAktif === 'info'"
        color="secondary"
        size="lg"
        icon="i-lucide-save"
        :loading="sibuk"
        @click="simpan"
      >
        {{ baru ? 'Buat event' : 'Simpan perubahan' }}
      </UButton>
    </div>

    <UTabs
      v-if="!baru"
      v-model="tabAktif"
      :items="tabs"
      :content="false"
      color="secondary"
      variant="link"
      class="mb-6"
    />

    <UAlert v-if="galat" color="error" variant="subtle" class="mb-4" icon="i-lucide-triangle-alert" :description="galat" />
    <UAlert v-if="sukses" color="primary" variant="subtle" class="mb-4" icon="i-lucide-check" :description="sukses" />

    <!-- Identitas event -->
    <UCard v-if="tabAktif === 'info'" class="mb-6">
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

    <!-- Daftar peserta -->
    <UCard v-else-if="tabAktif === 'peserta'">
      <template #header>
        <h2 class="inline-flex items-center gap-2 font-serif text-2xl text-cc-green-800">
          Daftar peserta
          <UTooltip text="Status dimajukan manual satu langkah per klik: baru → proses → konfirmasi. Pendaftar bisa dibatalkan dari status mana pun, dan pembatalan bisa dianulir kembali ke status terakhirnya.">
            <UIcon name="i-lucide-info" class="size-5 text-cc-brown-500" />
          </UTooltip>
        </h2>
      </template>

      <AdminPesertaTab :kegiatan-id="id" />
    </UCard>

    <!-- Sesi & materi -->
    <UCard v-else-if="tabAktif === 'materi'">
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
            <UButton
              color="neutral" variant="ghost" size="sm" icon="i-lucide-chevron-up"
              aria-label="Geser sesi ke atas" :disabled="sesi[0]?.id === s.id" @click="geserSesi(s, 'naik')"
            />
            <UButton
              color="neutral" variant="ghost" size="sm" icon="i-lucide-chevron-down"
              aria-label="Geser sesi ke bawah" :disabled="sesi[sesi.length - 1]?.id === s.id" @click="geserSesi(s, 'turun')"
            />
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
                v-for="(item, i) in s[b.key]"
                :key="item.id"
                class="flex items-center gap-1 rounded border border-cc-stone-200 bg-white px-2 py-1.5 text-xs"
              >
                <UIcon v-if="item.terkunci" name="i-lucide-lock" class="size-3 shrink-0 text-cc-stone-400" />
                <span class="min-w-0 flex-1 truncate" :title="item.judul">{{ item.judul }}</span>
                <UButton
                  color="neutral" variant="ghost" size="xs" icon="i-lucide-chevron-up"
                  aria-label="Geser ke atas" :disabled="i === 0" @click="geserItem(item.id, 'naik')"
                />
                <UButton
                  color="neutral" variant="ghost" size="xs" icon="i-lucide-chevron-down"
                  aria-label="Geser ke bawah" :disabled="i === s[b.key].length - 1" @click="geserItem(item.id, 'turun')"
                />
                <UButton
                  color="neutral" variant="ghost" size="xs" icon="i-lucide-pencil"
                  aria-label="Ubah item" @click="bukaUbahItem(s.id, item)"
                />
                <UButton
                  color="error" variant="ghost" size="xs" icon="i-lucide-x"
                  aria-label="Hapus item" @click="hapusItem(item.id)"
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

    <!-- Sengaja di luar rantai v-if/v-else-if tab: pada event baru satu-satunya tab
         yang ada adalah "info", jadi keterangan ini harus menemani tab itu, bukan
         menjadi cabang terakhir yang tidak pernah tercapai. -->
    <UAlert
      v-if="baru"
      color="neutral"
      variant="subtle"
      icon="i-lucide-info"
      title="Peserta & materi tersedia setelah event tersimpan"
      description="Simpan event ini dulu. Server akan langsung membuatkan satu sesi sebagai titik mulai, lalu tab Daftar peserta dan Materi ikut terbuka."
    />

    <!-- Tambah / ubah item -->
    <SesiItemModal
      v-model:open="itemModal"
      :sesi-id="itemSesiId"
      :bagian="itemBagian"
      :item="itemDiubah"
      @tersimpan="muat()"
    />
  </div>
</template>
