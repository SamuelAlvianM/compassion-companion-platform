<script setup lang="ts">
// Kisi refleksi, memakai KELAS KARTU YANG SAMA dengan halaman /id/jurnal
// (`.journal-grid`, `.journal-card`, dan turunannya di assets/css/main.css).
//
// Bukan kelas baru yang meniru tampilannya: dua kumpulan aturan yang berusaha
// terlihat sama akan menyimpang pada perubahan pertama yang cuma disentuh salah
// satunya. Kalau kartu jurnal dirapikan nanti, kartu di halaman profil ikut
// rapi tanpa ada yang perlu mengingatnya.
//
// Bentuk sebelumnya kisi persegi rapat bergaya Instagram. Diganti atas permintaan:
// halaman profil dan halaman jurnal kini terbaca sebagai satu situs yang sama.
//
// Yang dipetakan ke slot kartu jurnal:
//   .journal-type   -> label visibilitas (Pribadi / Khusus peserta / Publik)
//   .journal-event  -> nama kegiatan asalnya
//   h2              -> isi refleksinya; ia memang tidak punya judul, dan kalimat
//                      pertamanya itulah yang orang baca lebih dulu
//   .journal-meta   -> tanggalnya

interface Refleksi {
  id: string
  isi: string
  visibilitas: 'publik' | 'peserta' | 'pribadi'
  createdAt: string
  kegiatanSlug: string | null
  kegiatanJudul: string | null
  gambar: string | null
}

const props = defineProps<{
  refleksi: Refleksi[]
  isEn: boolean
  bolehHapus?: boolean
}>()

const emit = defineEmits<{ hapus: [string] }>()

const terbuka = ref<Refleksi | null>(null)

const t = computed(() => props.isEn
  ? { kosong: 'No reflections yet.', kosongIntro: 'Reflections written after an event will appear here.',
      pribadi: 'Private', peserta: 'Participants only', hapus: 'Delete', tutup: 'Close', pada: 'on',
      baca: 'Read more' }
  : { kosong: 'Belum ada refleksi.', kosongIntro: 'Refleksi yang ditulis setelah kegiatan akan muncul di sini.',
      pribadi: 'Pribadi', peserta: 'Khusus peserta', hapus: 'Hapus', tutup: 'Tutup', pada: 'pada',
      baca: 'Baca lebih lanjut' })

const tanggal = (nilai: string) =>
  new Intl.DateTimeFormat(props.isEn ? 'en-GB' : 'id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta',
  }).format(new Date(nilai))

const lencana = (v: Refleksi['visibilitas']) =>
  v === 'pribadi' ? { label: t.value.pribadi, icon: 'i-lucide-lock' }
    : v === 'peserta' ? { label: t.value.peserta, icon: 'i-lucide-users' }
      : null

/** Label tipe di kepala kartu. Refleksi publik tetap diberi label, bukan
    dikosongkan — slot itu selalu terisi di kartu jurnal, dan satu kartu yang
    kehilangan barisnya akan berbeda tinggi dari tetangganya. */
const labelTipe = (v: Refleksi['visibilitas']) =>
  lencana(v)?.label ?? (props.isEn ? 'Public' : 'Publik')

/** Ikon bulat di pojok kanan atas, sepadan dengan ikon tipe di kartu jurnal.
    Di sini ia sekaligus menggantikan gembok yang dulu melayang di atas gambar. */
const ikonTipe = (v: Refleksi['visibilitas']) =>
  lencana(v)?.icon ?? 'i-lucide-quote'
</script>

<template>
  <div>
    <div v-if="!refleksi.length" class="rounded-xl border border-dashed border-cc-stone-300 p-10 text-center">
      <UIcon name="i-lucide-feather" class="size-8 text-cc-stone-400" />
      <p class="mt-3 font-semibold text-cc-green-800">{{ t.kosong }}</p>
      <p class="mt-1 text-sm text-cc-stone-500">{{ t.kosongIntro }}</p>
    </div>

    <div v-else class="journal-grid">
      <article v-for="item in refleksi" :key="item.id" class="journal-card">
        <div class="journal-card-icon" :aria-label="labelTipe(item.visibilitas)">
          <UIcon :name="ikonTipe(item.visibilitas)" class="size-4" />
        </div>

        <!-- Gambar, kalau ada. Ditarik keluar dari padding kartunya supaya rata
             tepi seperti sampul artikel, bukan foto yang mengambang di dalam kotak. -->
        <img
          v-if="item.gambar"
          :src="item.gambar"
          alt=""
          class="refleksi-gambar"
        >

        <div class="journal-type">{{ labelTipe(item.visibilitas) }}</div>
        <div v-if="item.kegiatanJudul" class="journal-event">{{ item.kegiatanJudul }}</div>

        <h2 class="refleksi-kutipan">{{ item.isi }}</h2>

        <div class="journal-meta">
          <time :datetime="item.createdAt">{{ tanggal(item.createdAt) }}</time>
        </div>

        <UButton
          color="secondary"
          variant="solid"
          trailing-icon="i-lucide-arrow-right"
          class="mt-auto"
          @click="terbuka = item"
        >
          {{ t.baca }}
        </UButton>
      </article>
    </div>

    <!-- Detail satu refleksi -->
    <UModal
      :open="terbuka !== null"
      :title="terbuka?.kegiatanJudul ?? (isEn ? 'Reflection' : 'Refleksi')"
      :description="terbuka ? `${tanggal(terbuka.createdAt)}` : ''"
      @update:open="v => { if (!v) terbuka = null }"
    >
      <template #body>
        <div v-if="terbuka" class="space-y-4">
          <img v-if="terbuka.gambar" :src="terbuka.gambar" alt="" class="w-full rounded-lg">

          <p class="whitespace-pre-line leading-relaxed text-cc-stone-700">{{ terbuka.isi }}</p>

          <div class="flex flex-wrap items-center gap-2">
            <UBadge v-if="terbuka.kegiatanJudul" color="secondary" variant="subtle" size="sm">
              {{ terbuka.kegiatanJudul }}
            </UBadge>
            <UBadge v-if="lencana(terbuka.visibilitas)" color="neutral" variant="subtle" size="sm">
              {{ lencana(terbuka.visibilitas)!.label }}
            </UBadge>
          </div>

          <div class="flex gap-2 pt-2">
            <UButton color="neutral" variant="outline" class="flex-1" @click="terbuka = null">
              {{ t.tutup }}
            </UButton>
            <UButton
              v-if="bolehHapus"
              color="error"
              variant="soft"
              icon="i-lucide-trash-2"
              @click="emit('hapus', terbuka.id); terbuka = null"
            >
              {{ t.hapus }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
/* Dua aturan ini SATU-SATUNYA yang ditulis di sini; sisa tampilannya datang dari
   `.journal-card` di main.css. Keduanya menangani hal yang tidak dipunyai kartu
   jurnal: refleksi tidak punya judul dan ringkasan terpisah, jadi isinya sendiri
   yang menempati slot judul — dan tanpa batas baris, satu refleksi panjang akan
   membuat kartunya jauh lebih tinggi daripada tetangganya di baris yang sama. */
.refleksi-kutipan {
  display: -webkit-box;
  -webkit-line-clamp: 5;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Ditarik keluar dari padding kartu (24px 26px di main.css) supaya rata tepi. */
.refleksi-gambar {
  margin: -24px -26px 0;
  width: calc(100% + 52px);
  max-width: none;
  height: 180px;
  object-fit: cover;
  border-radius: 7px 7px 0 0;
}
</style>
