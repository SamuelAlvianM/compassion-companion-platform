<script setup lang="ts">
// Rangka kartu event selama data dimuat.
//
// Bentuknya sengaja meniru `.card` yang sesungguhnya — sampul 16:9 (rasio yang
// sama dengan `.event-page .event-card .card-image` di main.css), satu
// baris meta, judul dua baris, deskripsi tiga baris, satu tombol. Rangka yang
// ukurannya meleset justru menambah kedipan: begitu data datang, tata letaknya
// melompat. Yang ingin dihilangkan adalah lompatannya, bukan sekadar layar kosong.

withDefaults(defineProps<{ jumlah?: number }>(), { jumlah: 6 })
</script>

<template>
  <div class="cards">
    <article v-for="n in jumlah" :key="n" class="card" aria-hidden="true">
      <USkeleton class="aspect-[16/9] w-full rounded-none" />

      <div class="card-body">
        <USkeleton class="h-3 w-32" />
        <USkeleton class="mt-3 h-6 w-4/5" />
        <div class="mt-3 space-y-2">
          <USkeleton class="h-3 w-full" />
          <USkeleton class="h-3 w-11/12" />
          <USkeleton class="h-3 w-2/3" />
        </div>
        <USkeleton class="mt-4 h-4 w-1/2" />
        <USkeleton class="mt-4 h-9 w-full rounded-md" />
      </div>
    </article>
  </div>
</template>
