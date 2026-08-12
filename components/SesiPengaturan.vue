<script setup lang="ts">
// Baris pengaturan satu sesi (judul, tanggal) — dipakai di panel sesi halaman
// detail event maupun di tab "Materi" pada /admin/event/[id].
//
// Komponen sendiri, bukan blok di dalam induknya: drafnya milik satu sesi, dan
// menyimpannya di induk berarti sebuah peta `Record<id, draf>` yang harus dijaga
// tetap selaras dengan daftar sesi setiap kali datanya dimuat ulang. Dengan satu
// komponen per sesi, drafnya hidup dan mati bersama sesinya sendiri — Vue yang
// mengurus pembuatan dan pembuangannya lewat `:key`.
//
// TIDAK ADA TOMBOL SIMPAN. Perubahan disimpan sendiri 800 ms setelah pengetikan
// berhenti. Alasannya: tiap tindakan lain di panel ini — tambah item, geser, hapus
// — sudah menyimpan dirinya sendiri seketika, sehingga satu-satunya kotak yang
// menuntut tombol justru yang paling mudah terlupakan. Judul sesi yang diketik lalu
// ditinggalkan hilang tanpa tanda apa pun.
//
// Jeda 800 ms, bukan menyimpan tiap ketukan: menyimpan per huruf berarti satu
// permintaan per karakter, dan tiap balasan memicu induk memuat ulang daftarnya.

import type { SesiPublik } from './EventResources.vue'

const props = defineProps<{
  sesi: SesiPublik
  /** Untuk menonaktifkan tombol geser di ujung daftar. */
  pertama?: boolean
  terakhir?: boolean
  /** Ada tindakan lain yang sedang berjalan di panel ini. */
  sibuk?: boolean
}>()

const emit = defineEmits<{ tersimpan: [], geser: ['naik' | 'turun'], hapus: [] }>()

/** Timestamp → 'YYYY-MM-DD' dalam WIB, supaya tanggalnya tidak mundur sehari. */
const keYmd = (nilai: string | null) => nilai
  ? new Intl.DateTimeFormat('en-CA', {
      year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Jakarta',
    }).format(new Date(nilai))
  : ''

const dari = (s: SesiPublik) => ({
  judul: s.judul,
  judulEn: s.judulEn ?? '',
  tanggalYmd: keYmd(s.tanggal),
  tampil: s.tampil,
})

const draf = ref(dari(props.sesi))

const sama = (a: ReturnType<typeof dari>, b: ReturnType<typeof dari>) =>
  a.judul === b.judul && a.judulEn === b.judulEn
  && a.tanggalYmd === b.tanggalYmd && a.tampil === b.tampil

// Draf disusun ulang setiap barisnya berganti — termasuk sesudah disimpan, ketika
// induk memuat ulang datanya. Yang sedang diketik tidak hilang karena `sesi` hanya
// berubah kalau nilainya di server memang berbeda.
watch(() => props.sesi, (baru) => {
  const segar = dari(baru)
  if (!sama(segar, draf.value)) draf.value = segar
})

type Keadaan = 'diam' | 'menunggu' | 'menyimpan' | 'tersimpan' | 'gagal'
const keadaan = ref<Keadaan>('diam')
const galat = ref('')

let timer: ReturnType<typeof setTimeout> | undefined

const simpan = async () => {
  // Judul kosong ditolak server. Menahannya di sini bukan sekadar menghemat satu
  // permintaan: dengan autosave, galat itu akan muncul di tengah pengetikan —
  // tepat saat orang baru menghapus judul lama untuk menggantinya.
  if (!draf.value.judul.trim()) {
    keadaan.value = 'gagal'
    galat.value = 'Judul sesi tidak boleh kosong.'
    return
  }

  keadaan.value = 'menyimpan'
  galat.value = ''
  try {
    await $fetch(`/api/admin/sesi/${props.sesi.id}`, {
      method: 'PATCH',
      body: {
        judul: draf.value.judul,
        judulEn: draf.value.judulEn,
        tanggal: draf.value.tanggalYmd || null,
        tampil: draf.value.tampil,
      },
    })
    keadaan.value = 'tersimpan'
    emit('tersimpan')
  }
  catch (e: any) {
    keadaan.value = 'gagal'
    galat.value = e?.data?.statusMessage ?? e?.statusMessage ?? 'Gagal menyimpan sesi.'
  }
}

watch(draf, (nilai) => {
  if (sama(nilai, dari(props.sesi))) return
  clearTimeout(timer)
  keadaan.value = 'menunggu'
  timer = setTimeout(simpan, 800)
}, { deep: true })

// Perubahan yang masih menunggu jedanya harus tetap tersimpan saat panelnya
// ditutup — menutup accordion atau berpindah tab membuang komponen ini, dan
// bersamanya timer yang belum sempat berbunyi.
onBeforeUnmount(() => {
  if (keadaan.value !== 'menunggu') return
  clearTimeout(timer)
  simpan()
})

const penanda = computed(() => ({
  diam: { teks: '', ikon: '' },
  menunggu: { teks: 'Menyimpan…', ikon: 'i-lucide-ellipsis' },
  menyimpan: { teks: 'Menyimpan…', ikon: 'i-lucide-loader' },
  tersimpan: { teks: 'Tersimpan', ikon: 'i-lucide-check' },
  gagal: { teks: 'Gagal', ikon: 'i-lucide-triangle-alert' },
}[keadaan.value]))
</script>

<template>
  <!-- Putih, bukan krem: di tab Materi kotak sesinya sendiri sudah krem, dan dua
       lapis krem membuat pengaturannya lebur ke dalam latarnya. Di halaman publik
       latarnya #fffdfa, jadi putih + garis tepi tetap terbaca sebagai kotak sendiri. -->
  <div class="mb-5 rounded-lg border border-cc-stone-300 bg-white p-3">
    <div class="grid items-end gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)_auto]">
      <UFormField label="Judul sesi" size="sm">
        <UInput v-model="draf.judul" class="w-full" />
      </UFormField>
      <UFormField label="Judul (EN)" size="sm" hint="opsional">
        <UInput v-model="draf.judulEn" class="w-full" />
      </UFormField>
      <UFormField label="Tanggal sesi" size="sm">
        <UInput v-model="draf.tanggalYmd" type="date" class="w-full" />
      </UFormField>
      <UTooltip text="Sembunyikan sesi ini dari halaman publik tanpa menghapus isinya">
        <USwitch v-model="draf.tampil" label="Tampil" />
      </UTooltip>
    </div>

    <div class="mt-3 flex flex-wrap items-center gap-1.5">
      <!-- Penanda keadaan menggantikan tombol simpan. Ia harus ada: tanpa umpan
           balik apa pun, autosave tidak bisa dibedakan dari tidak menyimpan. -->
      <span
        v-if="penanda.teks"
        class="inline-flex items-center gap-1 text-xs"
        :class="keadaan === 'gagal' ? 'text-red-700' : keadaan === 'tersimpan' ? 'text-cc-green-800' : 'text-cc-stone-500'"
      >
        <UIcon :name="penanda.ikon" class="size-3.5" :class="keadaan === 'menyimpan' ? 'animate-spin' : ''" />
        {{ penanda.teks }}
      </span>

      <span class="flex-1" />

      <UButton
        color="neutral" variant="ghost" size="xs" icon="i-lucide-chevron-up"
        aria-label="Geser sesi ke atas" :disabled="pertama || sibuk" @click="emit('geser', 'naik')"
      />
      <UButton
        color="neutral" variant="ghost" size="xs" icon="i-lucide-chevron-down"
        aria-label="Geser sesi ke bawah" :disabled="terakhir || sibuk" @click="emit('geser', 'turun')"
      />
      <UButton
        color="error" variant="ghost" size="xs" icon="i-lucide-trash-2"
        aria-label="Hapus sesi" @click="emit('hapus')"
      />
    </div>

    <p v-if="galat" class="editable-error">{{ galat }}</p>
  </div>
</template>
