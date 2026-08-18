<script setup lang="ts">
// Isi pengganti untuk tab yang ada tapi belum bisa dipakai.
//
// Dipakai tab "Daftar peserta" dan "Materi" pada event baru yang judul atau tanggal
// mulainya masih kosong. Di luar keadaan itu tabnya bekerja penuh: mengkliknya
// melahirkan eventnya lebih dulu, lalu isinya yang sesungguhnya yang tampil.
//
// Yang digambar SEBABNYA, bukan daftar kosong. "Belum ada peserta" pada event yang
// belum lahir itu keliru: yang belum ada eventnya, bukan pesertanya.
//
// Tombol kembali membawa ke tab yang bisa dikerjakan sekarang. Tanpa itu, orang
// yang mampir ke sini harus menebak sendiri bahwa jalan majunya ada di tab pertama.
defineProps<{
  ikon: string
  judul: string
  keterangan: string
}>()

defineEmits<{ kembali: [] }>()
</script>

<template>
  <div class="py-10 text-center">
    <UIcon :name="ikon" class="size-9 text-cc-stone-300" />
    <p class="mt-3 font-serif text-lg text-cc-green-800">{{ judul }}</p>
    <p class="mx-auto mt-1 max-w-md text-sm text-cc-stone-600">{{ keterangan }}</p>
    <UButton
      class="mt-4"
      color="neutral"
      variant="soft"
      size="sm"
      icon="i-lucide-arrow-left"
      @click="$emit('kembali')"
    >
      Ke Informasi utama
    </UButton>
  </div>
</template>
