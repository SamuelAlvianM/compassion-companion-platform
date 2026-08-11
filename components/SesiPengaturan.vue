<script setup lang="ts">
// Baris pengaturan satu sesi (judul, tanggal, tampil) di dalam panel sesi pada
// halaman detail event — hanya tergambar saat mode sunting menyala.
//
// Komponen sendiri, bukan blok di dalam EventResources: drafnya milik satu sesi,
// dan menyimpannya di induk berarti sebuah peta `Record<id, draf>` yang harus
// dijaga tetap selaras dengan daftar sesi setiap kali datanya dimuat ulang.
// Dengan satu komponen per sesi, drafnya hidup dan mati bersama sesinya sendiri —
// Vue yang mengurus pembuatan dan pembuangannya lewat `:key`.

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

// Draf disusun ulang setiap barisnya berganti — termasuk sesudah disimpan, ketika
// induk memuat ulang datanya. Yang sedang diketik tidak hilang karena `sesi` hanya
// berubah kalau nilainya di server memang berbeda.
watch(() => props.sesi, (baru) => { draf.value = dari(baru) })

const berubah = computed(() => {
  const asli = dari(props.sesi)
  return draf.value.judul !== asli.judul
    || draf.value.judulEn !== asli.judulEn
    || draf.value.tanggalYmd !== asli.tanggalYmd
    || draf.value.tampil !== asli.tampil
})

const menyimpan = ref(false)
const galat = ref('')

const simpan = async () => {
  menyimpan.value = true
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
    emit('tersimpan')
  }
  catch (e: any) {
    galat.value = e?.data?.statusMessage ?? e?.statusMessage ?? 'Gagal menyimpan sesi.'
  }
  finally { menyimpan.value = false }
}
</script>

<template>
  <div class="mb-5 rounded-lg border border-cc-stone-200 bg-cc-stone-50 p-3">
    <div class="grid items-end gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)_auto]">
      <UFormField label="Judul sesi" size="sm">
        <UInput v-model="draf.judul" class="w-full" />
      </UFormField>
      <UFormField label="Judul (EN)" size="sm" hint="opsional">
        <UInput v-model="draf.judulEn" class="w-full" />
      </UFormField>
      <UFormField label="Tanggal" size="sm">
        <UInput v-model="draf.tanggalYmd" type="date" class="w-full" />
      </UFormField>
      <UTooltip text="Sembunyikan sesi ini dari halaman publik tanpa menghapus isinya">
        <USwitch v-model="draf.tampil" label="Tampil" />
      </UTooltip>
    </div>

    <div class="mt-3 flex flex-wrap items-center gap-1.5">
      <UButton
        color="secondary"
        size="xs"
        icon="i-lucide-save"
        :disabled="!berubah"
        :loading="menyimpan"
        @click="simpan"
      >
        Simpan sesi
      </UButton>

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
