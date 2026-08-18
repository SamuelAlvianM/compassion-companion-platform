<script setup lang="ts">
// Baris pengaturan satu sesi (judul, tampil) — dipakai di panel sesi halaman
// detail event maupun di tab "Materi" pada /admin/event/[id].
//
// Tanggal sesi dicabut. Sesi adalah partisi sebuah event — "Day 1", "Sesi pagi",
// atau per topik — dan tanggalnya sudah ditentukan tanggal eventnya sendiri.
// Kolomnya menuntut diisi tanpa menentukan apa pun, dan yang diisi asal justru
// bisa berselisih dengan jadwal event di sebelahnya. Kolom `tanggal` di `cc_sesi`
// dibiarkan tetap ada; yang dicabut isiannya.
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
  /**
   * Kunci tindakan yang sedang jalan, dari induk. Dipakai memilih tombol MANA yang
   * berputar — `sibuk` saja hanya bisa mematikan semuanya sekaligus, dan panel yang
   * seluruh tombolnya berputar tidak memberi tahu apa yang sedang dikerjakan.
   */
  aksiSibuk?: string
  /**
   * Sesi ini belum punya baris di database — ia draf di halaman "Event baru".
   *
   * Dalam mode ini tidak ada permintaan apa pun: perubahan dikembalikan ke induk
   * lewat `ubah`, dan induk yang menyimpannya sekali saat "Buat event" ditekan.
   * Penanda simpan pun ikut diam — tidak ada yang sedang disimpan, dan lingkaran
   * berputar yang tidak mewakili pekerjaan apa pun cuma berbohong dengan sopan.
   */
  lokal?: boolean
  /**
   * Nomor urut sesi. Diberikan hanya oleh tab Materi di dashboard.
   *
   * Kehadirannya mengganti bentuk komponen: kepala bernomor — lingkaran hijau,
   * judul sesi, sakelar Tampil, dan tombol geser/hapus — digambar di SATU baris di
   * sini, bukan di induknya. Sebelumnya induk menggambar barisnya sendiri dan
   * komponen ini menaruh sakelar serta tombolnya di dua baris lagi di bawah, jadi
   * satu sesi memakan empat baris untuk memuat tiga hal.
   *
   * Tanpa `nomor` (penyuntingan di halaman event publik) bentuknya tidak berubah:
   * di sana tidak ada nomor urut yang terbaca, dan judulnya sudah tergambar sebagai
   * judul sesi di halaman itu sendiri.
   */
  nomor?: number
}>()

const emit = defineEmits<{
  tersimpan: []
  geser: ['naik' | 'turun']
  hapus: []
  ubah: [{ judul: string, judulEn: string, tampil: boolean }]
}>()

const dari = (s: SesiPublik) => ({
  judul: s.judul,
  judulEn: s.judulEn ?? '',
  tampil: s.tampil,
})

const draf = ref(dari(props.sesi))

const sama = (a: ReturnType<typeof dari>, b: ReturnType<typeof dari>) =>
  a.judul === b.judul && a.judulEn === b.judulEn && a.tampil === b.tampil

// Draf disusun ulang setiap barisnya berganti — termasuk sesudah disimpan, ketika
// induk memuat ulang datanya. Yang sedang diketik tidak hilang karena `sesi` hanya
// berubah kalau nilainya di server memang berbeda.
watch(() => props.sesi, (baru) => {
  const segar = dari(baru)
  if (!sama(segar, draf.value)) draf.value = segar
})

type Keadaan = 'diam' | 'menunggu' | 'menyimpan' | 'tersimpan' | 'gagal'
const keadaan = ref<Keadaan>('diam')
const toast = useToast()
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
        tampil: draf.value.tampil,
      },
    })
    keadaan.value = 'tersimpan'
    // Kabar berhasil lewat toast, bukan teks yang menetap di sebelah isian:
    // begitu isiannya disunting lagi, "Tersimpan" di situ sudah bohong.
    toast.add({ title: 'Tersimpan', icon: 'i-lucide-check', color: 'primary', duration: 1000 })
    emit('tersimpan')
  }
  catch (e: any) {
    keadaan.value = 'gagal'
    galat.value = e?.data?.statusMessage ?? e?.statusMessage ?? 'Gagal menyimpan sesi.'
  }
}

watch(draf, (nilai) => {
  if (sama(nilai, dari(props.sesi))) return
  // Draf event baru: tidak ada yang dikirim ke mana pun, cukup dikembalikan ke
  // induk. Tanpa jeda 800 ms pula — jeda itu ada untuk menahan permintaan jaringan,
  // dan menahan penulisan ke sebuah objek di memori tidak menghemat apa-apa.
  if (props.lokal) { emit('ubah', { ...nilai }); return }
  clearTimeout(timer)
  keadaan.value = 'menunggu'
  timer = setTimeout(simpan, 800)
}, { deep: true })

// Perubahan yang masih menunggu jedanya harus tetap tersimpan saat panelnya
// ditutup — menutup accordion atau berpindah tab membuang komponen ini, dan
// bersamanya timer yang belum sempat berbunyi.
onBeforeUnmount(() => {
  if (props.lokal || keadaan.value !== 'menunggu') return
  clearTimeout(timer)
  simpan()
})

// Penandanya pindah ke IndikatorSimpan — bentuk yang sama dengan autosave form
// event, supaya "sedang menyimpan" tidak punya dua wajah dalam satu halaman.
</script>

<template>
  <!-- Putih, bukan krem: di tab Materi kotak sesinya sendiri sudah krem, dan dua
       lapis krem membuat pengaturannya lebur ke dalam latarnya. Di halaman publik
       latarnya #fffdfa, jadi putih + garis tepi tetap terbaca sebagai kotak sendiri. -->
  <div :class="nomor === undefined ? 'mb-5 rounded-lg border border-cc-stone-300 bg-white p-3' : 'mb-3'">
    <!-- Kepala bernomor: seluruh kendali sesi dalam satu baris. Judulnya diambil
         dari draf, bukan dari `sesi` — mengetik di kotak judul di bawah harus
         langsung terbaca di sini, bukan menunggu 800 ms sampai tersimpan. -->
    <div
      v-if="nomor !== undefined"
      class="mb-3 flex flex-wrap items-center gap-2 border-b border-cc-stone-300 pb-3"
    >
      <span class="grid size-7 shrink-0 place-items-center rounded-full bg-cc-green-800 font-serif text-sm text-cc-stone-50">
        {{ nomor }}
      </span>
      <span class="min-w-0 flex-1 break-words font-serif text-xl text-cc-green-800">
        {{ draf.judul || 'Sesi tanpa judul' }}
      </span>

      <IndikatorSimpan :keadaan="keadaan" ringkas />

      <!-- Sakelarnya berdiri di baris ini, bukan di antara kotak isian: yang
           diputuskan di sini bukan isi sesinya melainkan apakah ia terbit — sejenis
           dengan geser dan hapus di sebelahnya. -->
      <USwitch v-model="draf.tampil" label="Tampil" class="shrink-0" />

      <UButton
        color="neutral" variant="ghost" size="xs" icon="i-lucide-chevron-up"
        aria-label="Geser sesi ke atas"
        :loading="aksiSibuk === `geser-sesi-${sesi.id}-naik`"
        :disabled="pertama || sibuk" @click="emit('geser', 'naik')"
      />
      <UButton
        color="neutral" variant="ghost" size="xs" icon="i-lucide-chevron-down"
        aria-label="Geser sesi ke bawah"
        :loading="aksiSibuk === `geser-sesi-${sesi.id}-turun`"
        :disabled="terakhir || sibuk" @click="emit('geser', 'turun')"
      />
      <UButton
        color="error" variant="ghost" size="xs" icon="i-lucide-trash-2"
        aria-label="Hapus sesi"
        :loading="aksiSibuk === `hapus-sesi-${sesi.id}`"
        :disabled="sibuk" @click="emit('hapus')"
      />
    </div>

    <div
      class="grid items-end gap-3"
      :class="nomor === undefined ? 'md:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_auto]' : 'md:grid-cols-2'"
    >
      <UFormField label="Judul sesi" size="sm">
        <UInput v-model="draf.judul" class="w-full" />
      </UFormField>
      <UFormField label="Judul (EN)" size="sm" hint="opsional">
        <UInput v-model="draf.judulEn" class="w-full" />
      </UFormField>
      <UTooltip v-if="nomor === undefined" text="Sembunyikan sesi ini dari halaman publik tanpa menghapus isinya">
        <USwitch v-model="draf.tampil" label="Tampil" />
      </UTooltip>
    </div>

    <!-- Baris tombol lama, hanya untuk penyuntingan di halaman publik; pada tab
         Materi semuanya sudah pindah ke kepala bernomor di atas. -->
    <div v-if="nomor === undefined" class="mt-3 flex flex-wrap items-center gap-1.5">
      <!-- Penanda keadaan menggantikan tombol simpan. Ia harus ada: tanpa umpan
           balik apa pun, autosave tidak bisa dibedakan dari tidak menyimpan. -->
      <IndikatorSimpan :keadaan="keadaan" />

      <span class="flex-1" />

      <UButton
        color="neutral" variant="ghost" size="xs" icon="i-lucide-chevron-up"
        aria-label="Geser sesi ke atas"
        :loading="aksiSibuk === `geser-sesi-${sesi.id}-naik`"
        :disabled="pertama || sibuk" @click="emit('geser', 'naik')"
      />
      <UButton
        color="neutral" variant="ghost" size="xs" icon="i-lucide-chevron-down"
        aria-label="Geser sesi ke bawah"
        :loading="aksiSibuk === `geser-sesi-${sesi.id}-turun`"
        :disabled="terakhir || sibuk" @click="emit('geser', 'turun')"
      />
      <UButton
        color="error" variant="ghost" size="xs" icon="i-lucide-trash-2"
        aria-label="Hapus sesi"
        :loading="aksiSibuk === `hapus-sesi-${sesi.id}`"
        :disabled="sibuk" @click="emit('hapus')"
      />
    </div>

    <p v-if="galat" class="editable-error">{{ galat }}</p>
  </div>
</template>
