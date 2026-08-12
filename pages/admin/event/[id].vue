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

// Harga dan status sengaja tidak ada di sini.
//
// Harga: event komunitas ini tidak menagih lewat situs — pembayaran diurus admin
// lewat WhatsApp — jadi angka di formulir hanya menuntut diisi tanpa menentukan
// apa pun. Kolomnya masih ada di database (default 0) untuk transaksi yang dicatat
// terpisah.
//
// Status: fase kini murni turunan tanggal (server/utils/kegiatan.ts), jadi
// "mendatang / berlangsung / selesai" tidak lagi bisa berselisih dengan
// kalendernya. Server memasang `terbit` untuk setiap kegiatan yang disimpan dari
// sini — lihat catatan di bacaKegiatan().
const kosong = () => ({
  judul: '', judulEn: '', deskripsi: '', deskripsiEn: '',
  lokasi: '', tautanDaring: '',
  tanggalMulai: '', tanggalSelesai: '',
  jamMulai: '', jamSelesai: '',
  tutupTanggal: '', tutupJam: '23:55',
  kuota: '' as string | number,
  coverMediaId: '',
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

/** Timestamp → `HH:MM` WIB, dibulatkan ke bawah ke kelipatan 5 menit supaya nilai
    lama tetap bisa diperlihatkan kembali oleh WaktuPicker. */
const keJamWib = (nilai: string | null) => {
  if (!nilai) return ''
  const [h, m] = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta',
  }).format(new Date(nilai)).split(':')
  return `${h}:${String(Math.floor(Number(m) / 5) * 5).padStart(2, '0')}`
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
    jamMulai: d.jamMulai ?? '', jamSelesai: d.jamSelesai ?? '',
    tutupTanggal: keYmd(d.tutupPendaftaran),
    tutupJam: keJamWib(d.tutupPendaftaran) || '23:55',
    kuota: d.kuota ?? '',
    coverMediaId: d.coverMediaId ?? '',
  }
  // `tanggalYmd` ditambahkan sebagai field terpisah supaya <input type="date">
  // punya sesuatu yang bisa di-v-model tanpa merusak `tanggal` asli dari server.
  sesi.value = (res.sesi ?? []).map((s: any) => ({ ...s, tanggalYmd: keYmd(s.tanggal) }))
}

await muat()
watch(id, muat)

const pesan = (e: any, bawaan: string) =>
  e?.data?.statusMessage ?? e?.statusMessage ?? bawaan

/** Event sehari — hanya di situ urutan jam bisa dibandingkan. Pada event
    berhari-hari, "selesai 09.00" setelah "mulai 16.00" justru normal. */
const sehari = computed(() =>
  !form.value.tanggalSelesai || form.value.tanggalSelesai === form.value.tanggalMulai)

/**
 * Pemeriksaan yang bisa dijawab tanpa server, ditampilkan sebelum tombol simpan
 * ditekan. Server tetap memeriksa hal yang sama — ini kenyamanan, bukan penjagaan.
 */
const peringatan = computed(() => {
  if (form.value.tanggalSelesai && form.value.tanggalSelesai < form.value.tanggalMulai) {
    return 'Tanggal selesai tidak boleh mendahului tanggal mulai.'
  }
  if (sehari.value && form.value.jamMulai && form.value.jamSelesai
    && form.value.jamSelesai <= form.value.jamMulai) {
    return 'Jam selesai harus setelah jam mulai.'
  }
  return ''
})

/** Body yang dikirim ke API: dua kotak batas pendaftaran dilebur jadi satu nilai,
    dan kolom bantu (`tutupTanggal`, `tutupJam`) tidak ikut terkirim. */
const payload = () => {
  const { tutupTanggal, tutupJam, ...sisa } = form.value
  return {
    ...sisa,
    // Jam tanpa tanggal bukan batas apa pun, jadi tanggal yang menentukan ada
    // tidaknya nilai ini.
    tutupPendaftaran: tutupTanggal ? `${tutupTanggal}T${tutupJam || '23:55'}` : null,
  }
}

const simpan = async () => {
  if (peringatan.value) { galat.value = peringatan.value; return }
  sibuk.value = true
  galat.value = ''
  sukses.value = ''
  try {
    if (baru.value) {
      const res = await $fetch<any>('/api/admin/events', { method: 'POST', body: payload() })
      // Berpindah ke halaman ubah supaya blok sesi langsung bisa dipakai — event
      // baru sudah dibekali satu sesi oleh server.
      await router.replace(`/admin/event/${res.data.id}`)
    }
    else {
      await $fetch(`/api/admin/events/${id.value}`, { method: 'PATCH', body: payload() })
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

// `simpanSesi` dihapus bersama tombolnya: SesiPengaturan.vue kini menyimpan
// sendiri 800 ms setelah pengetikan berhenti.

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

// Galeri punya jalannya sendiri: belasan foto dari acara yang sama, dipilih
// sekaligus lalu dipotong seperlunya. Form satu-item tetap dipakai untuk MENGUBAH
// foto yang sudah ada — di sana yang diubah biasanya keterangannya, bukan berkasnya.
const galeriModal = ref(false)

const bukaItem = (sesiId: string, bagian: 'materi' | 'galeri' | 'referensi') => {
  itemSesiId.value = sesiId
  itemBagian.value = bagian
  itemDiubah.value = null
  galat.value = ''
  if (bagian === 'galeri') { galeriModal.value = true; return }
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
        <UFormField label="Tanggal selesai" hint="boleh sama dengan tanggal mulai">
          <!-- `min` menutup kesalahan yang paling sering: memilih tanggal mundur.
               Aturannya tetap diperiksa ulang di `peringatan` dan di server, karena
               atribut ini tidak berlaku bagi tanggal yang diketik langsung. -->
          <UInput
            v-model="form.tanggalSelesai"
            type="date"
            :min="form.tanggalMulai || undefined"
            class="w-full"
          />
        </UFormField>

        <!-- Jam acara. Terutama berarti untuk event sehari, yang tanggal selesainya
             tidak menambah informasi apa pun — jamnya yang menentukan. -->
        <UFormField label="Jam mulai">
          <template #hint>
            <UTooltip text="Menit tersedia per 5 menit. Kosongkan bila jamnya belum pasti.">
              <UIcon name="i-lucide-info" class="size-4 text-cc-brown-500" />
            </UTooltip>
          </template>
          <WaktuPicker v-model="form.jamMulai" placeholder="Belum ditentukan" />
        </UFormField>
        <UFormField label="Jam selesai">
          <WaktuPicker
            v-model="form.jamSelesai"
            placeholder="Belum ditentukan"
            :minimal="sehari ? form.jamMulai : null"
          />
        </UFormField>

        <UFormField label="Batas akhir pendaftaran" class="md:col-span-2">
          <template #hint>
            <UTooltip text="Kosongkan tanggalnya agar pendaftaran terbuka sampai event dimulai.">
              <UIcon name="i-lucide-info" class="size-4 text-cc-brown-500" />
            </UTooltip>
          </template>
          <div class="grid gap-3 sm:grid-cols-2">
            <UInput v-model="form.tutupTanggal" type="date" class="w-full" />
            <WaktuPicker v-model="form.tutupJam" :disabled="!form.tutupTanggal" />
          </div>
        </UFormField>

        <UFormField label="Kuota">
          <template #hint>
            <UTooltip text="Kosongkan untuk tanpa batas peserta.">
              <UIcon name="i-lucide-info" class="size-4 text-cc-brown-500" />
            </UTooltip>
          </template>
          <UInput v-model="form.kuota" type="number" min="1" class="w-full" placeholder="Tanpa batas" />
        </UFormField>
      </div>

      <UAlert
        v-if="peringatan"
        color="warning"
        variant="subtle"
        class="mt-4"
        icon="i-lucide-triangle-alert"
        :description="peringatan"
      />
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

      <!-- Satu kotak = satu sesi, dan kotaknya krem. Sebelumnya seluruh isinya
           berlatar krem di dalam bingkai putih, sehingga batas antar sesi praktis
           tidak terlihat pada event yang punya beberapa sesi — yang terbaca cuma
           satu kolom panjang berisi bagian-bagian yang seragam. Sekarang
           kebalikannya: latar sesi krem, isi tiap bagian putih. -->
      <div
        v-for="(s, iSesi) in sesi"
        :key="s.id"
        class="mb-6 rounded-xl border border-cc-brown-300 bg-cc-stone-50 p-4 last:mb-0"
      >
        <!-- Kepala bernomor. Tanpa ini dua sesi berturut-turut terbaca sebagai satu
             kolom panjang berisi bagian yang seragam — yang membedakannya cuma
             judul di dalam kotak isian, dan kotak isian tidak terbaca sebagai
             judul. Nomornya urutan tampil, bukan id: itu yang dipakai orang saat
             menyebut "sesi kedua". -->
        <div class="mb-3 flex flex-wrap items-center gap-2 border-b border-cc-stone-300 pb-3">
          <span class="grid size-7 shrink-0 place-items-center rounded-full bg-cc-green-800 font-serif text-sm text-cc-stone-50">
            {{ iSesi + 1 }}
          </span>
          <span class="min-w-0 truncate font-serif text-xl text-cc-green-800">
            {{ s.judul || 'Sesi tanpa judul' }}
          </span>
          <UBadge v-if="!s.tampil" color="neutral" variant="subtle" size="sm" class="shrink-0">
            tersembunyi
          </UBadge>
        </div>

        <!-- Judul & tanggal sesi menyimpan dirinya sendiri; komponen yang sama
             dipakai penyuntingan di halaman event publik. Sakelar "Tampil" ikut
             ditampilkan di sini: menyiapkan isi dan memutuskan apa yang terbit
             ternyata pekerjaan yang sama, dan tanpa sakelarnya tidak ada tempat
             lain di dashboard untuk menyembunyikan sesi yang belum siap. -->
        <SesiPengaturan
          :key="s.id"
          :sesi="s"
          :pertama="sesi[0]?.id === s.id"
          :terakhir="sesi[sesi.length - 1]?.id === s.id"
          @tersimpan="muat()"
          @geser="(arah: 'naik' | 'turun') => geserSesi(s, arah)"
          @hapus="hapusSesi(s)"
        />

        <!-- Tiga bagian jadi tiga baris penuh, bukan tiga kolom sempit. Judul
             materi hampir selalu panjang ("Rekaman sesi 2 — mendengarkan tanpa
             menilai"), dan di kolom selebar sepertiga layar semuanya terpotong jadi
             potongan yang tidak bisa dibedakan satu sama lain. -->
        <div class="space-y-3">
          <div v-for="b in BAGIAN" :key="b.key" class="rounded-lg border border-cc-stone-200 bg-white p-3">
            <div class="mb-2 flex items-center gap-1.5">
              <UIcon :name="b.ikon" class="size-4 text-cc-brown-500" />
              <span class="text-sm font-semibold text-cc-green-800">{{ b.label }}</span>
              <UTooltip :text="b.petunjuk">
                <UIcon name="i-lucide-info" class="size-3.5 text-cc-stone-400" />
              </UTooltip>
              <UBadge color="neutral" variant="subtle" size="sm" class="rounded-full">{{ s[b.key].length }}</UBadge>

              <UButton
                class="ml-auto"
                color="neutral"
                variant="soft"
                size="xs"
                icon="i-lucide-plus"
                @click="bukaItem(s.id, b.key)"
              >
                {{ b.key === 'galeri' ? 'Tambah foto' : 'Tambah' }}
              </UButton>
            </div>

            <p v-if="!s[b.key].length" class="py-1 text-xs text-cc-stone-500">
              Belum ada isi.
            </p>

            <!-- Galeri: pita cuplikan mendatar, bukan daftar baris berjudul.
                 Pada daftar foto, FOTONYA yang jadi isi — namanya
                 ("Screenshot 2026 04 07 092118") tidak membantu siapa pun mengenali
                 mana yang sedang dilihat, dan cuplikan 32px di sampingnya sama saja.
                 Bergulir mendatar, bukan membungkus: satu baris membuat urutannya
                 terbaca sebagai urutan, persis seperti saat fotonya diunggah. -->
            <div v-else-if="b.key === 'galeri'" class="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
              <figure
                v-for="(item, i) in s[b.key]"
                :key="item.id"
                class="w-32 shrink-0"
              >
                <img
                  v-if="item.thumbnail || item.url"
                  :src="item.thumbnail ?? item.url"
                  :alt="item.judul"
                  class="h-24 w-32 rounded-lg border border-cc-stone-200 bg-cc-stone-100 object-cover"
                  loading="lazy"
                >
                <div v-else class="grid h-24 w-32 place-items-center rounded-lg border border-cc-stone-200 bg-cc-stone-100">
                  <UIcon name="i-lucide-image-off" class="size-5 text-cc-stone-400" />
                </div>

                <!-- Tanpa keterangan di bawah foto: yang membedakan satu foto dari
                     yang lain adalah gambarnya, dan nama berkas di sana justru
                     menyita ruang yang bisa dipakai fotonya. -->
                <div class="mt-1 flex items-center">
                  <UButton
                    color="neutral" variant="ghost" size="xs" icon="i-lucide-chevron-left"
                    aria-label="Geser ke kiri" :disabled="i === 0" @click="geserItem(item.id, 'naik')"
                  />
                  <UButton
                    color="neutral" variant="ghost" size="xs" icon="i-lucide-chevron-right"
                    aria-label="Geser ke kanan" :disabled="i === s[b.key].length - 1" @click="geserItem(item.id, 'turun')"
                  />
                  <UButton
                    color="neutral" variant="ghost" size="xs" icon="i-lucide-pencil"
                    aria-label="Ubah foto" @click="bukaUbahItem(s.id, item)"
                  />
                  <UButton
                    color="error" variant="ghost" size="xs" icon="i-lucide-x"
                    aria-label="Hapus foto" @click="hapusItem(item.id)"
                  />
                </div>
              </figure>
            </div>

            <ul v-else class="space-y-1">
              <li
                v-for="(item, i) in s[b.key]"
                :key="item.id"
                class="flex items-center gap-2 rounded border border-cc-stone-200 bg-white px-2 py-1.5 text-xs"
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

    <!-- Unggah banyak foto galeri sekaligus -->
    <GaleriUnggahModal
      v-model:open="galeriModal"
      :sesi-id="itemSesiId"
      @tersimpan="muat()"
    />
  </div>
</template>
