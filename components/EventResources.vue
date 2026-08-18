<script setup lang="ts">
// Blok "Materi & dokumentasi" di halaman detail event — sekaligus pengelolanya.
//
// Datanya dari GET /api/events/[slug]/sesi. Aturan aksesnya ditegakkan di server —
// materi yang tidak berhak dibuka sampai ke sini tanpa `url`/`mediaId` sama sekali,
// jadi menutupnya di template bukan satu-satunya penghalang.
//
//   materi     — hanya peserta event, plus pengelola level ≤ 3
//   galeri     — terbuka untuk semua, bisa dizoom & diputar
//   referensi  — terbuka untuk semua
//
// Saat mode sunting menyala (useEditMode, level ≤ 3), blok yang sama memperoleh
// tombol tambah/ubah/hapus/geser untuk sesi maupun isinya. Dijadikan satu dengan
// tampilan bacanya, bukan panel admin terpisah: yang sedang dikerjakan pengelola
// adalah halaman ini, dan hasil suntingannya harus langsung terlihat pada susunan
// yang sesungguhnya — bukan pada daftar ringkas yang bentuknya berbeda.

import type { FotoGaleri } from './GaleriLightbox.vue'
import type { ItemTersunting } from './SesiItemModal.vue'

export type Bagian = 'materi' | 'galeri' | 'referensi'

export interface SesiItem {
  id: string
  bagian: Bagian
  jenis: string
  judul: string
  judulEn: string | null
  terkunci: boolean
  tergembok: boolean
  url: string | null
  embed: string | null
  thumbnail: string | null
  mediaId: string | null
  ukuran: number | null
  namaBerkas: string | null
}

export interface SesiPublik {
  id: string
  judul: string
  judulEn: string | null
  tanggal: string | null
  tampil: boolean
  materi: SesiItem[]
  galeri: SesiItem[]
  referensi: SesiItem[]
}

const props = defineProps<{
  sesi: SesiPublik[]
  isEn?: boolean
  masuk?: boolean
  /** Wajib untuk menambah sesi baru; tanpa ini tombolnya tidak muncul. */
  kegiatanId?: string
}>()

const emit = defineEmits<{ ubah: [] }>()

const { aktif } = useEditMode()

const teks = computed(() => props.isEn
  ? {
      eyebrow: 'Resources', judul: 'Materials & documentation',
      materi: 'Learning materials', galeri: 'Gallery', referensi: 'References',
      kunci: 'Participants only', kosong: 'No materials have been published for this session yet.',
      tolakJudul: 'Participants only',
      tolakIsi: 'Only participants of this event can open these materials.',
      tolakMasuk: 'Sign in with the account you used to register, then open this page again.',
      tolakDaftar: 'Register for this event to get access to its materials.',
      masuk: 'Sign in', tutup: 'Close', bukaBaru: 'Opens in a new tab',
      tambah: 'Add', tambahFoto: 'Add photos',
      petunjukSesi: 'Each session is one part of the event — Day 1, Day 2, and so on.',
    }
  : {
      eyebrow: 'Resources', judul: 'Materi & dokumentasi',
      materi: 'Materi Pembelajaran', galeri: 'Galeri', referensi: 'Referensi',
      kunci: 'Khusus peserta', kosong: 'Belum ada materi yang diterbitkan untuk sesi ini.',
      tolakJudul: 'Khusus peserta event',
      tolakIsi: 'Hanya peserta event yang dapat melihat materi ini.',
      tolakMasuk: 'Masuk dengan akun yang Anda pakai mendaftar, lalu buka halaman ini lagi.',
      tolakDaftar: 'Daftar ke event ini untuk mendapat akses materinya.',
      masuk: 'Masuk', tutup: 'Tutup', bukaBaru: 'Terbuka di tab baru',
      tambah: 'Tambah', tambahFoto: 'Tambah foto',
      petunjukSesi: 'Tiap sesi adalah satu bagian dari event — Day 1, Day 2, dan seterusnya.',
    })

const judulItem = (item: SesiItem) => (props.isEn ? item.judulEn ?? item.judul : item.judul)

// `value` memakai id sesi, bukan indeks: menambah atau menghapus sesi menggeser
// seluruh indeks, dan panel yang terbuka ikut melompat ke sesi lain.
const items = computed(() => props.sesi.map(s => ({
  ...s,
  value: s.id,
  label: props.isEn ? s.judulEn ?? s.judul : s.judul,
})))

const open = ref(props.sesi[0]?.id ?? '')

// ── Tampilan item ────────────────────────────────────────────────────────────
const IKON: Record<string, string> = {
  pdf: 'i-lucide-file-text',
  dokumen: 'i-lucide-file',
  video: 'i-lucide-play',
  youtube: 'i-lucide-youtube',
  gambar: 'i-lucide-image',
  tautan: 'i-lucide-link',
}
const ikon = (jenis: string) => IKON[jenis] ?? 'i-lucide-file'

const LABEL_JENIS: Record<string, string> = {
  pdf: 'PDF', dokumen: 'Dokumen', video: 'Video', youtube: 'YouTube', gambar: 'Gambar', tautan: 'Tautan',
}

const ukuranBerkas = (bytes: number | null) => {
  if (!bytes) return ''
  const satuan = ['B', 'KB', 'MB', 'GB']
  let n = bytes
  let i = 0
  while (n >= 1024 && i < satuan.length - 1) { n /= 1024; i++ }
  return `${n < 10 && i > 0 ? n.toFixed(1) : Math.round(n)} ${satuan[i]}`
}

/** Baris kedua pada kartu materi: "PDF · 250 KB". */
const metaItem = (item: SesiItem) => {
  const bagian = [LABEL_JENIS[item.jenis] ?? item.jenis]
  const ukuran = ukuranBerkas(item.ukuran)
  if (ukuran) bagian.push(ukuran)
  return bagian.join(' · ')
}

/** Domain sebagai baris kedua referensi — lebih informatif dari mengulang judul. */
const domain = (url: string | null) => {
  if (!url) return ''
  try { return new URL(url).hostname.replace(/^www\./, '') }
  catch { return url }
}

// ── Materi terkunci ──────────────────────────────────────────────────────────
const tolakOpen = ref(false)

const bukaMateri = (item: SesiItem) => {
  if (item.tergembok) { tolakOpen.value = true; return }
  // Video diputar DI HALAMAN INI, apa pun asalnya — YouTube lewat iframe, unggahan
  // lewat <video>. Sebelumnya hanya YouTube yang begitu; video unggahan dilempar ke
  // tab baru, dan di sana yang muncul pemutar telanjang milik peramban di atas latar
  // hitam, tanpa judul, tanpa jalan kembali selain menutup tabnya. Dua jenis yang
  // bagi pembacanya sama-sama "rekaman sesi" tidak boleh berperilaku berbeda.
  if (bisaDiputar(item)) { videoAktif.value = item; videoOpen.value = true; return }
  if (item.url) window.open(item.url, '_blank', 'noopener')
}

// ── Pemutar video ────────────────────────────────────────────────────────────
const videoOpen = ref(false)
const videoAktif = ref<SesiItem | null>(null)

/** Bisa diputar di dalam modal: YouTube yang punya alamat embed, atau berkas video
    yang sudah punya alamat. */
const bisaDiputar = (item: SesiItem) =>
  (item.jenis === 'youtube' && Boolean(item.embed)) || (item.jenis === 'video' && Boolean(item.url))

// Sumber dilepas saat modal ditutup. Tanpa itu <video> tetap memutar di balik
// layar — suaranya terus terdengar sesudah modalnya hilang — dan unduhannya
// berlanjut untuk video yang sudah tidak dilihat siapa pun.
watch(videoOpen, (terbuka) => { if (!terbuka) videoAktif.value = null })

// ── Galeri ───────────────────────────────────────────────────────────────────
const lightboxOpen = ref(false)
const lightboxIndeks = ref(0)
const lightboxFoto = ref<FotoGaleri[]>([])

const bukaGaleri = (sesi: SesiPublik, i: number) => {
  lightboxFoto.value = sesi.galeri.map(g => ({ id: g.id, judul: judulItem(g), url: g.thumbnail ?? g.url }))
  lightboxIndeks.value = i
  lightboxOpen.value = true
}

// ─────────────────────────────────────────────────────────────────────────────
// Mode sunting
// ─────────────────────────────────────────────────────────────────────────────

const sibuk = ref('')
const galat = ref('')

const pesan = (e: any, bawaan: string) => e?.data?.statusMessage ?? e?.statusMessage ?? bawaan

/** Bungkus tiap panggilan admin: satu penanda sibuk, satu tempat galat. */
const jalankan = async (tanda: string, aksi: () => Promise<unknown>) => {
  sibuk.value = tanda
  galat.value = ''
  try {
    await aksi()
    emit('ubah')
    return true
  }
  catch (e: any) {
    galat.value = pesan(e, 'Gagal menyimpan perubahan.')
    return false
  }
  finally { sibuk.value = '' }
}

// ── Sesi ─────────────────────────────────────────────────────────────────────
// Judul, tanggal, dan sakelar "tampil" diurus SesiPengaturan.vue — satu komponen
// per sesi, masing-masing memegang drafnya sendiri. Yang tinggal di sini hanyalah
// tindakan yang mengubah susunan daftarnya: tambah, geser, hapus.
const tambahSesi = async () => {
  if (!props.kegiatanId) return
  await jalankan('sesi-baru', async () => {
    const res = await $fetch<any>('/api/admin/sesi', {
      method: 'POST',
      body: { kegiatanId: props.kegiatanId },
    })
    // Panel langsung dibuka ke sesi yang baru: tombolnya ada di kepala blok, jauh
    // dari tempat sesi barunya muncul di dasar daftar.
    open.value = res.data.id
  })
}

const geserSesi = (s: SesiPublik, arah: 'naik' | 'turun') =>
  jalankan(`geser-${s.id}`, () => $fetch(`/api/admin/sesi/${s.id}/geser`, { method: 'POST', body: { arah } }))

const hapusSesiId = ref<string | null>(null)
const calonHapusSesi = computed(() => props.sesi.find(s => s.id === hapusSesiId.value) ?? null)

const hapusSesi = async () => {
  const id = hapusSesiId.value
  if (!id) return
  if (await jalankan(`hapus-${id}`, () => $fetch(`/api/admin/sesi/${id}`, { method: 'DELETE' }))) {
    hapusSesiId.value = null
  }
}

// ── Item ─────────────────────────────────────────────────────────────────────
const itemModal = ref(false)
const itemSesiId = ref('')
const itemBagian = ref<Bagian>('materi')
const itemDiubah = ref<ItemTersunting | null>(null)

// Galeri memakai modal unggah banyak foto; dua bagian lain tetap lewat form
// satu-item. Alasannya ada di GaleriUnggahModal.vue.
const galeriModal = ref(false)

const tambahItem = (sesiId: string, bagian: Bagian) => {
  itemSesiId.value = sesiId
  itemBagian.value = bagian
  itemDiubah.value = null
  if (bagian === 'galeri') { galeriModal.value = true; return }
  itemModal.value = true
}

const ubahItem = (sesiId: string, item: SesiItem) => {
  itemSesiId.value = sesiId
  itemBagian.value = item.bagian
  itemDiubah.value = {
    id: item.id,
    jenis: item.jenis,
    judul: item.judul,
    judulEn: item.judulEn,
    url: item.url,
    mediaId: item.mediaId,
    namaBerkas: item.namaBerkas,
    terkunci: item.terkunci,
  }
  itemModal.value = true
}

const geserItem = (item: SesiItem, arah: 'naik' | 'turun') =>
  jalankan(`geser-${item.id}`, () => $fetch(`/api/admin/sesi-item/${item.id}/geser`, { method: 'POST', body: { arah } }))

const hapusItemId = ref<string | null>(null)
const calonHapusItem = computed(() => {
  if (!hapusItemId.value) return null
  for (const s of props.sesi) {
    const cocok = [...s.materi, ...s.galeri, ...s.referensi].find(i => i.id === hapusItemId.value)
    if (cocok) return cocok
  }
  return null
})

const hapusItem = async () => {
  const id = hapusItemId.value
  if (!id) return
  if (await jalankan(`hapus-${id}`, () => $fetch(`/api/admin/sesi-item/${id}`, { method: 'DELETE' }))) {
    hapusItemId.value = null
  }
}

</script>

<template>
  <section class="resources-section">
    <div class="eyebrow">{{ teks.eyebrow }}</div>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 class="section-title inline-flex items-center gap-2">
        {{ teks.judul }}
        <UTooltip :text="teks.petunjukSesi">
          <UIcon name="i-lucide-info" class="size-5 shrink-0 text-cc-brown-500" />
        </UTooltip>
      </h2>

      <UButton
        v-if="aktif && kegiatanId"
        color="secondary"
        variant="soft"
        size="sm"
        icon="i-lucide-plus"
        :loading="sibuk === 'sesi-baru'"
        @click="tambahSesi"
      >
        Tambah sesi
      </UButton>
    </div>

    <UAlert
      v-if="aktif && galat"
      color="error"
      variant="subtle"
      class="mt-3"
      icon="i-lucide-triangle-alert"
      :description="galat"
    />

    <p v-if="aktif && !sesi.length" class="mt-4 text-sm text-cc-stone-500">
      Belum ada sesi. Tambah satu untuk mulai mengunggah materi, foto, atau referensi.
    </p>

    <UAccordion
      v-model="open"
      :items="items"
      trailing-icon="i-lucide-chevron-down"
      :ui="{
        root: 'mt-4 space-y-3',
        item: 'border border-cc-brown-300 rounded-xl bg-[#fffdfa] overflow-hidden',
        trigger: 'px-6 py-5 text-lg font-bold text-cc-stone-900',
        trailingIcon: 'size-6 text-cc-brown-500',
        body: 'px-6 pb-6',
      }"
    >
      <!-- Sesi tersembunyi ditandai di kepala panelnya. Hanya pengelola yang bisa
           melihat sesi seperti itu (server menyaringnya untuk pengunjung), jadi
           tanpa penanda ini tidak ada cara membedakannya dari sesi yang terbit. -->
      <template #default="{ item }">
        <span class="flex min-w-0 flex-1 items-center gap-2">
          <span class="break-words">{{ item.label }}</span>
          <UBadge v-if="aktif && !item.tampil" color="neutral" variant="subtle" size="sm" class="shrink-0">
            tersembunyi
          </UBadge>
        </span>
      </template>

      <template #body="{ item }">
        <SesiPengaturan
          v-if="aktif"
          :key="item.id"
          :sesi="item"
          :pertama="sesi[0]?.id === item.id"
          :terakhir="sesi[sesi.length - 1]?.id === item.id"
          :sibuk="sibuk === `geser-${item.id}`"
          @tersimpan="emit('ubah')"
          @geser="(arah: 'naik' | 'turun') => geserSesi(item, arah)"
          @hapus="hapusSesiId = item.id"
        />

        <p
          v-if="!item.materi.length && !item.galeri.length && !item.referensi.length && !aktif"
          class="text-sm text-cc-stone-500"
        >
          {{ teks.kosong }}
        </p>

        <!-- Materi pembelajaran -->
        <section v-if="item.materi.length || aktif" class="resource-group">
          <div class="resource-group-head">
            <h3>{{ teks.materi }}</h3>
            <UButton
              v-if="aktif"
              color="neutral" variant="soft" size="xs" icon="i-lucide-plus"
              @click="tambahItem(item.id, 'materi')"
            >
              {{ teks.tambah }}
            </UButton>
          </div>
          <div class="tile-grid">
            <!-- Tiap kartu dibungkus <div> supaya baris tombolnya bisa berdiri di
                 luar <button>/<a> kartunya — tombol di dalam tombol tidak sah, dan
                 klik di dalam <a> akan ikut membuka tautannya. `.tile` sudah
                 `width:100%`, jadi pembungkusnya tidak mengubah tampilan. -->
            <div v-for="materi in item.materi" :key="materi.id">
              <button
                type="button"
                class="tile"
                :class="materi.tergembok ? 'is-locked' : ''"
                @click="bukaMateri(materi)"
              >
                <span class="tile-chip"><UIcon :name="ikon(materi.jenis)" class="size-4" /></span>
                <span class="tile-text">
                  <strong :title="judulItem(materi)">{{ judulItem(materi) }}</strong>
                  <small>{{ metaItem(materi) }}</small>
                </span>
                <UTooltip v-if="materi.tergembok" :text="teks.kunci">
                  <UIcon name="i-lucide-lock" class="tile-lock size-4" />
                </UTooltip>
              </button>

              <div v-if="aktif" class="item-tools">
                <UButton
                  color="neutral" variant="ghost" size="xs" icon="i-lucide-chevron-up"
                  aria-label="Geser ke atas" :disabled="item.materi[0]?.id === materi.id"
                  :loading="sibuk === `geser-${materi.id}`" @click="geserItem(materi, 'naik')"
                />
                <UButton
                  color="neutral" variant="ghost" size="xs" icon="i-lucide-chevron-down"
                  aria-label="Geser ke bawah" :disabled="item.materi[item.materi.length - 1]?.id === materi.id"
                  :loading="sibuk === `geser-${materi.id}`" @click="geserItem(materi, 'turun')"
                />
                <UButton
                  color="neutral" variant="ghost" size="xs" icon="i-lucide-pencil"
                  aria-label="Ubah item" @click="ubahItem(item.id, materi)"
                />
                <UButton
                  color="error" variant="ghost" size="xs" icon="i-lucide-trash-2"
                  aria-label="Hapus item" @click="hapusItemId = materi.id"
                />
              </div>
            </div>
          </div>
        </section>

        <!-- Galeri -->
        <section v-if="item.galeri.length || aktif" class="resource-group">
          <div class="resource-group-head">
            <h3>{{ teks.galeri }}</h3>
            <UButton
              v-if="aktif"
              color="neutral" variant="soft" size="xs" icon="i-lucide-plus"
              @click="tambahItem(item.id, 'galeri')"
            >
              {{ teks.tambahFoto }}
            </UButton>
          </div>
          <div class="gallery-grid">
            <div v-for="(foto, i) in item.galeri" :key="foto.id">
              <button type="button" class="gallery-item" @click="bukaGaleri(item, i)">
                <img :src="foto.thumbnail ?? foto.url ?? ''" :alt="judulItem(foto)" loading="lazy">
              </button>

              <div v-if="aktif" class="item-tools">
                <UButton
                  color="neutral" variant="ghost" size="xs" icon="i-lucide-chevron-up"
                  aria-label="Geser ke atas" :disabled="item.galeri[0]?.id === foto.id"
                  :loading="sibuk === `geser-${foto.id}`" @click="geserItem(foto, 'naik')"
                />
                <UButton
                  color="neutral" variant="ghost" size="xs" icon="i-lucide-chevron-down"
                  aria-label="Geser ke bawah" :disabled="item.galeri[item.galeri.length - 1]?.id === foto.id"
                  :loading="sibuk === `geser-${foto.id}`" @click="geserItem(foto, 'turun')"
                />
                <UButton
                  color="neutral" variant="ghost" size="xs" icon="i-lucide-pencil"
                  aria-label="Ubah foto" @click="ubahItem(item.id, foto)"
                />
                <UButton
                  color="error" variant="ghost" size="xs" icon="i-lucide-trash-2"
                  aria-label="Hapus foto" @click="hapusItemId = foto.id"
                />
              </div>
            </div>
          </div>
        </section>

        <!-- Referensi -->
        <section v-if="item.referensi.length || aktif" class="resource-group">
          <div class="resource-group-head">
            <h3>{{ teks.referensi }}</h3>
            <UButton
              v-if="aktif"
              color="neutral" variant="soft" size="xs" icon="i-lucide-plus"
              @click="tambahItem(item.id, 'referensi')"
            >
              {{ teks.tambah }}
            </UButton>
          </div>
          <div class="tile-grid">
            <div v-for="ref in item.referensi" :key="ref.id">
              <a :href="ref.url ?? '#'" target="_blank" rel="noopener noreferrer" class="tile">
                <span class="tile-chip"><UIcon :name="ikon(ref.jenis)" class="size-4" /></span>
                <span class="tile-text">
                  <strong :title="judulItem(ref)">{{ judulItem(ref) }}</strong>
                  <small>{{ domain(ref.url) || metaItem(ref) }}</small>
                </span>
                <UIcon name="i-lucide-arrow-up-right" class="tile-arrow size-4" :aria-label="teks.bukaBaru" />
              </a>

              <div v-if="aktif" class="item-tools">
                <UButton
                  color="neutral" variant="ghost" size="xs" icon="i-lucide-chevron-up"
                  aria-label="Geser ke atas" :disabled="item.referensi[0]?.id === ref.id"
                  :loading="sibuk === `geser-${ref.id}`" @click="geserItem(ref, 'naik')"
                />
                <UButton
                  color="neutral" variant="ghost" size="xs" icon="i-lucide-chevron-down"
                  aria-label="Geser ke bawah" :disabled="item.referensi[item.referensi.length - 1]?.id === ref.id"
                  :loading="sibuk === `geser-${ref.id}`" @click="geserItem(ref, 'turun')"
                />
                <UButton
                  color="neutral" variant="ghost" size="xs" icon="i-lucide-pencil"
                  aria-label="Ubah referensi" @click="ubahItem(item.id, ref)"
                />
                <UButton
                  color="error" variant="ghost" size="xs" icon="i-lucide-trash-2"
                  aria-label="Hapus referensi" @click="hapusItemId = ref.id"
                />
              </div>
            </div>
          </div>
        </section>

        <!-- Tombol tambah tidak lagi berkumpul di dasar panel. Di sana ketiganya
             baru terlihat sesudah seluruh isi sesi tergulir habis, dan yang
             mencarinya harus menebak tombol mana milik bagian mana dari urutannya
             saja. Sekarang tiap bagian membawa tombolnya sendiri di kepalanya —
             bagian yang kosong pun tetap tergambar selama mode sunting menyala,
             jadi tidak ada bagian yang kehilangan jalan masuknya. -->
      </template>
    </UAccordion>

    <!-- Materi terkunci -->
    <UModal v-model:open="tolakOpen" :title="teks.tolakJudul">
      <template #body>
        <div class="flex gap-3">
          <UIcon name="i-lucide-lock" class="mt-0.5 size-5 shrink-0 text-cc-brown-500" />
          <div class="space-y-2">
            <p class="font-semibold text-cc-green-800">{{ teks.tolakIsi }}</p>
            <p class="text-sm text-cc-stone-600">{{ masuk ? teks.tolakDaftar : teks.tolakMasuk }}</p>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="tolakOpen = false">{{ teks.tutup }}</UButton>
          <UButton v-if="!masuk" :to="isEn ? '/en/login' : '/id/login'" color="primary">{{ teks.masuk }}</UButton>
        </div>
      </template>
    </UModal>

    <!-- Satu pemutar untuk dua jenis video. Bingkai, judul, dan lebarnya sama;
         yang berbeda cuma isi kotaknya — iframe untuk YouTube (`unlisted` tidak butuh
         perlakuan khusus, ia tetap bisa di-embed), <video> untuk berkas unggahan. -->
    <UModal v-model:open="videoOpen" :title="videoAktif ? judulItem(videoAktif) : ''" :ui="{ content: 'max-w-4xl' }">
      <template #body>
        <div class="aspect-video w-full overflow-hidden rounded-lg bg-black">
          <iframe
            v-if="videoAktif?.jenis === 'youtube' && videoAktif?.embed"
            :src="videoAktif.embed"
            class="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
            referrerpolicy="strict-origin-when-cross-origin"
            :title="judulItem(videoAktif)"
          />
          <!-- `controls` saja, tanpa autoplay: video rekaman sesi bisa panjang dan
               berisi suara orang, dan yang membukanya belum tentu sedang sendirian.
               `preload="metadata"` supaya durasinya terbaca tanpa mengunduh isinya. -->
          <video
            v-else-if="videoAktif?.url"
            :key="videoAktif.id"
            :src="videoAktif.url"
            class="h-full w-full"
            controls
            playsinline
            preload="metadata"
          />
        </div>
      </template>
    </UModal>

    <GaleriLightbox
      v-model:open="lightboxOpen"
      v-model:indeks="lightboxIndeks"
      :foto="lightboxFoto"
      :is-en="isEn"
    />

    <!-- Tambah / ubah item -->
    <SesiItemModal
      v-model:open="itemModal"
      :sesi-id="itemSesiId"
      :bagian="itemBagian"
      :item="itemDiubah"
      @tersimpan="emit('ubah')"
    />

    <!-- Unggah banyak foto galeri sekaligus -->
    <GaleriUnggahModal
      v-model:open="galeriModal"
      :sesi-id="itemSesiId"
      :is-en="isEn"
      @tersimpan="emit('ubah')"
    />

    <!-- Hapus sesi: isinya ikut terhapus lewat cascade di database, jadi jumlah
         itemnya disebutkan sebelum tombolnya ditekan. -->
    <UModal
      :open="hapusSesiId !== null"
      title="Hapus sesi ini?"
      @update:open="(nilai: boolean) => { if (!nilai) hapusSesiId = null }"
    >
      <template #body>
        <p class="text-sm text-cc-stone-600">
          Seluruh materi, foto galeri, dan referensi di dalamnya ikut terhapus. Tindakan ini tidak bisa dibatalkan.
        </p>
        <div v-if="calonHapusSesi" class="mt-3 rounded-lg border border-cc-stone-200 bg-cc-stone-50 p-3">
          <p class="font-semibold text-cc-green-800">{{ calonHapusSesi.judul }}</p>
          <p class="mt-1 text-sm text-cc-stone-600">
            {{ calonHapusSesi.materi.length }} materi ·
            {{ calonHapusSesi.galeri.length }} foto ·
            {{ calonHapusSesi.referensi.length }} referensi
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="hapusSesiId = null">Batal</UButton>
          <UButton
            color="error"
            icon="i-lucide-trash-2"
            :loading="sibuk === `hapus-${hapusSesiId}`"
            @click="hapusSesi"
          >
            Hapus sesi
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Hapus item -->
    <UModal
      :open="hapusItemId !== null"
      title="Hapus item ini?"
      @update:open="(nilai: boolean) => { if (!nilai) hapusItemId = null }"
    >
      <template #body>
        <p class="text-sm text-cc-stone-600">
          Item ini hilang dari halaman. Berkasnya sendiri tetap tersimpan di pustaka media.
        </p>
        <div v-if="calonHapusItem" class="mt-3 rounded-lg border border-cc-stone-200 bg-cc-stone-50 p-3">
          <p class="font-semibold text-cc-green-800">{{ calonHapusItem.judul }}</p>
          <p class="mt-1 text-sm text-cc-stone-600">{{ metaItem(calonHapusItem) }}</p>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="hapusItemId = null">Batal</UButton>
          <UButton
            color="error"
            icon="i-lucide-trash-2"
            :loading="sibuk === `hapus-${hapusItemId}`"
            @click="hapusItem"
          >
            Hapus item
          </UButton>
        </div>
      </template>
    </UModal>
  </section>
</template>
