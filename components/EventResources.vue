<script setup lang="ts">
// Blok "Materi & dokumentasi" di halaman detail event.
//
// Datanya dari GET /api/events/[slug]/sesi. Aturan aksesnya ditegakkan di server —
// materi yang tidak berhak dibuka sampai ke sini tanpa `url`/`mediaId` sama sekali,
// jadi menutupnya di template bukan satu-satunya penghalang.
//
//   materi     — hanya peserta event, plus pengelola level ≤ 3
//   galeri     — terbuka untuk semua, bisa dizoom & diputar
//   referensi  — terbuka untuk semua

import type { FotoGaleri } from './GaleriLightbox.vue'

export interface SesiItem {
  id: string
  jenis: string
  judul: string
  judulEn: string | null
  terkunci: boolean
  tergembok: boolean
  url: string | null
  embed: string | null
  thumbnail: string | null
  ukuran: number | null
  namaBerkas: string | null
}

export interface SesiPublik {
  id: string
  judul: string
  judulEn: string | null
  tanggal: string | null
  materi: SesiItem[]
  galeri: SesiItem[]
  referensi: SesiItem[]
}

const props = defineProps<{ sesi: SesiPublik[], isEn?: boolean, masuk?: boolean }>()

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
      petunjukSesi: 'Tiap sesi adalah satu bagian dari event — Day 1, Day 2, dan seterusnya.',
    })

const judulItem = (item: SesiItem) => (props.isEn ? item.judulEn ?? item.judul : item.judul)

const items = computed(() => props.sesi.map((s, i) => ({
  ...s,
  value: String(i),
  label: props.isEn ? s.judulEn ?? s.judul : s.judul,
})))

const open = ref('0')

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
  if (item.jenis === 'youtube' && item.embed) { videoOpen.value = true; videoAktif.value = item; return }
  if (item.url) window.open(item.url, '_blank', 'noopener')
}

// ── Video YouTube ────────────────────────────────────────────────────────────
const videoOpen = ref(false)
const videoAktif = ref<SesiItem | null>(null)

// ── Galeri ───────────────────────────────────────────────────────────────────
const lightboxOpen = ref(false)
const lightboxIndeks = ref(0)
const lightboxFoto = ref<FotoGaleri[]>([])

const bukaGaleri = (sesi: SesiPublik, i: number) => {
  lightboxFoto.value = sesi.galeri.map(g => ({ id: g.id, judul: judulItem(g), url: g.thumbnail ?? g.url }))
  lightboxIndeks.value = i
  lightboxOpen.value = true
}
</script>

<template>
  <section class="resources-section">
    <div class="eyebrow">{{ teks.eyebrow }}</div>
    <h2 class="section-title inline-flex items-center gap-2">
      {{ teks.judul }}
      <UTooltip :text="teks.petunjukSesi">
        <UIcon name="i-lucide-info" class="size-5 shrink-0 text-cc-brown-500" />
      </UTooltip>
    </h2>

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
      <template #body="{ item }">
        <p v-if="!item.materi.length && !item.galeri.length && !item.referensi.length" class="text-sm text-cc-stone-500">
          {{ teks.kosong }}
        </p>

        <!-- Materi pembelajaran -->
        <section v-if="item.materi.length" class="resource-group">
          <h3>{{ teks.materi }}</h3>
          <div class="tile-grid">
            <button
              v-for="materi in item.materi"
              :key="materi.id"
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
          </div>
        </section>

        <!-- Galeri -->
        <section v-if="item.galeri.length" class="resource-group">
          <h3>{{ teks.galeri }}</h3>
          <div class="gallery-grid">
            <button
              v-for="(foto, i) in item.galeri"
              :key="foto.id"
              type="button"
              class="gallery-item"
              @click="bukaGaleri(item, i)"
            >
              <img :src="foto.thumbnail ?? foto.url ?? ''" :alt="judulItem(foto)" loading="lazy">
            </button>
          </div>
        </section>

        <!-- Referensi -->
        <section v-if="item.referensi.length" class="resource-group">
          <h3>{{ teks.referensi }}</h3>
          <div class="tile-grid">
            <a
              v-for="ref in item.referensi"
              :key="ref.id"
              :href="ref.url ?? '#'"
              target="_blank"
              rel="noopener noreferrer"
              class="tile"
            >
              <span class="tile-chip"><UIcon :name="ikon(ref.jenis)" class="size-4" /></span>
              <span class="tile-text">
                <strong :title="judulItem(ref)">{{ judulItem(ref) }}</strong>
                <small>{{ domain(ref.url) || metaItem(ref) }}</small>
              </span>
              <UIcon name="i-lucide-arrow-up-right" class="tile-arrow size-4" :aria-label="teks.bukaBaru" />
            </a>
          </div>
        </section>
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

    <!-- Pemutar YouTube; `unlisted` tidak butuh perlakuan khusus, ia tetap bisa di-embed -->
    <UModal v-model:open="videoOpen" :title="videoAktif ? judulItem(videoAktif) : ''" :ui="{ content: 'max-w-4xl' }">
      <template #body>
        <div class="aspect-video w-full overflow-hidden rounded-lg bg-black">
          <iframe
            v-if="videoAktif?.embed"
            :src="videoAktif.embed"
            class="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
            referrerpolicy="strict-origin-when-cross-origin"
            :title="judulItem(videoAktif)"
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
  </section>
</template>
