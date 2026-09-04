<script setup lang="ts">
// Satu kartu angka di dashboard.
//
// Tiga kelakuan, satu bentuk:
//   `ke`    -> NuxtLink, pindah halaman
//   tanpa keduanya + `mati` -> <div> biasa, tidak bisa diklik
//   selain itu -> <button>, induknya yang menentukan apa yang terjadi (membuka
//                 panel samping)
//
// Elemennya benar-benar berganti, bukan sekadar berganti kelas: tautan yang
// digambar sebagai <div> tidak bisa dibuka di tab baru dan tidak terbaca sebagai
// tautan oleh pembaca layar, sementara tombol yang digambar sebagai <a> menjanjikan
// perpindahan halaman yang tidak pernah terjadi.

defineProps<{
  label: string;
  nilai: number | string;
  /** Baris kecil di bawah angka. Kosongkan kalau tidak ada yang perlu dikatakan. */
  catatan?: string;
  ikon?: string;
  ke?: string;
  /** Angkanya ada tapi belum bisa ditelusuri — kartunya tetap digambar, tenang. */
  mati?: boolean;
}>();

const emit = defineEmits<{ (e: "buka"): void }>();

// Diselesaikan di script, bukan dipanggil di dalam `:is`: auto-import Nuxt bekerja
// pada blok script — `resolveComponent` yang ditulis langsung di ekspresi template
// tidak dijamin terbawa.
const NuxtLink = resolveComponent("NuxtLink");
</script>

<template>
  <component
    :is="ke ? NuxtLink : mati ? 'div' : 'button'"
    :to="ke"
    :type="!ke && !mati ? 'button' : undefined"
    class="group block w-full rounded-lg border border-cc-stone-200 bg-white p-5 text-left transition-colors"
    :class="
      mati
        ? 'opacity-60'
        : 'hover:border-cc-brown-400 hover:bg-cc-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cc-green-800'
    "
    @click="!ke && !mati ? emit('buka') : undefined"
  >
    <div class="flex items-start justify-between gap-3">
      <span class="text-sm font-medium break-words text-cc-stone-600">{{
        label
      }}</span>

      <!-- Penanda "bisa diklik". Ikon panah, bukan ikon hiasan yang menggambarkan
           isinya: yang perlu diketahui sekilas bukan bahwa kartu ini tentang
           peserta, melainkan bahwa menekannya membawa ke suatu tempat. -->
      <!-- menghapus i-lucide-arrow-right i-lucide-panel-right-open-->
      <UIcon
        v-if="!mati"
        :name="ke ? '' : ''"
        class="size-4 shrink-0 text-cc-stone-400 transition-colors group-hover:text-cc-brown-500"
      />
      <UIcon
        v-else-if="ikon"
        :name="ikon"
        class="size-4 shrink-0 text-cc-stone-300"
      />
    </div>

    <!-- Hijau tua, bukan cokelat brand: angka inilah yang dibaca lebih dulu di
         seluruh halaman, dan `cc-brown-500` (#ac8158) di atas kartu putih terlalu
         dekat dengan warna label di sebelahnya — yang paling penting jadi yang
         paling samar. Cokelat tetap dipakai untuk angka yang bisa diklik di dalam
         tabel, tempat ia justru menandai "ini tautan". -->
    <p
      class="mt-3 font-serif text-4xl leading-none text-cc-green-800 tabular-nums"
    >
      {{ nilai }}
    </p>

    <p v-if="catatan" class="mt-2 text-xs text-cc-stone-500">{{ catatan }}</p>
  </component>
</template>
