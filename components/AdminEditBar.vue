<script setup lang="ts">
// Bilah melayang untuk pengelola di halaman publik: nyalakan/matikan mode sunting,
// dan lompat ke form admin lengkap untuk hal-hal yang tidak muat disunting di
// tempat (tanggal, kuota, harga, status, sesi & materi).
//
// Tidak dirender sama sekali bagi pengunjung — bukan disembunyikan lewat CSS.

const props = defineProps<{ adminPath?: string }>()
const { aktif, bolehSunting, alih } = useEditMode()
</script>

<template>
  <ClientOnly>
    <div v-if="bolehSunting" class="edit-bar" :class="aktif ? 'is-on' : ''">
      <UIcon :name="aktif ? 'i-lucide-pencil-line' : 'i-lucide-eye'" class="size-4 shrink-0" />
      <span class="edit-bar-label">{{ aktif ? 'Mode sunting' : 'Mode baca' }}</span>

      <USwitch :model-value="aktif" aria-label="Nyalakan mode sunting" @update:model-value="alih" />

      <UButton
        v-if="props.adminPath"
        :to="props.adminPath"
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-settings"
      >
        Pengaturan lengkap
      </UButton>
    </div>
  </ClientOnly>
</template>
