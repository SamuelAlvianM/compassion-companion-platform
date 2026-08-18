<script setup lang="ts">
// Penanda "sedang menyimpan" untuk tempat-tempat yang TIDAK punya tombol simpan.
//
// Tombol yang punya `:loading` sudah membawa lingkaran berputarnya sendiri; yang
// tidak punya tombol — autosave — sebelumnya cuma menghasilkan kabar sesudah
// semuanya selesai. Di antara ketikan terakhir dan kabar itu ada satu jeda yang
// tidak dijelaskan apa pun, dan jeda tanpa penjelasan terbaca sebagai "tidak
// tersimpan".
//
// HANYA MENGGAMBAR YANG SEDANG BERLANGSUNG. Keadaan "tersimpan" dan "gagal"
// sengaja tidak punya bentuk di sini: hasilnya disampaikan toast (untuk yang
// berhasil) dan UAlert di kepala halaman (untuk yang gagal). Penanda hasil yang
// menetap di tengah formulir menumpuk jadi kabar lama yang tidak pernah dibaca
// lagi — begitu satu isian disunting, "Tersimpan" di sebelahnya sudah bohong.
//
// Satu warna saja: hijau situs (cc-green-800). Menyimpan bukan peringatan dan
// bukan kabar gembira — ia pekerjaan biasa yang sedang berlangsung.

const props = withDefaults(defineProps<{
  /** Selain 'menunggu' dan 'menyimpan', tidak ada yang digambar. */
  keadaan?: 'diam' | 'menunggu' | 'menyimpan' | 'tersimpan' | 'gagal'
  isEn?: boolean
  /** Sembunyikan teksnya, sisakan lingkarannya saja. */
  ringkas?: boolean
}>(), {
  keadaan: 'diam',
})

const teks = computed(() => props.isEn ? 'Saving…' : 'Menyimpan…')

const berputar = computed(() => props.keadaan === 'menunggu' || props.keadaan === 'menyimpan')
</script>

<template>
  <span
    v-if="berputar"
    class="inline-flex items-center gap-1.5 text-xs font-semibold text-cc-green-800"
    role="status"
    :aria-label="teks"
  >
    <!-- Lingkaran berputar digambar sendiri, bukan ikon: cincin yang salah satu
         sisinya transparan membaca "sedang berjalan" tanpa perlu menebak arah
         putarannya, dan ia tetap bulat pada ukuran sekecil ini. -->
    <span
      class="size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
      aria-hidden="true"
    />
    <span v-if="!ringkas">{{ teks }}</span>
  </span>
</template>
