<script setup lang="ts">
// Daftar peserta pada event yang BELUM dibuat.
//
// Berkas sendiri, bukan mode di dalam AdminPesertaTab. Yang dikerjakan di sana —
// menyaring per status, mencari, memajukan status satu langkah, membatalkan lalu
// menganulir — semuanya berlaku pada baris yang sudah ada di database dan punya
// riwayat. Di sini belum ada satu pun baris: yang bisa dilakukan cuma menambah dan
// membuang, dan lima chip penyaring di atas daftar berisi tiga orang cuma
// menirukan bentuk tanpa isinya.
//
// Yang tetap sama bentuknya: formnya (PesertaFormModal) dan kolom tabelnya. Orang
// yang mengisi keduanya tidak sedang mengerjakan dua hal berbeda.

const daftar = defineModel<any[]>({ default: () => [] })

/**
 * Terbukanya modal tambah dikendalikan induk.
 *
 * Tombolnya duduk di kepala kartu, di baris yang sama dengan judul "Daftar
 * peserta" — dan kepala kartu itu milik induk, bukan komponen ini. Yang dipindah
 * cuma tombolnya; formnya tetap di sini bersama daftar yang diisinya.
 */
const tambahModal = defineModel<boolean>('bukaTambah', { default: false })

const STATUS_LABEL: Record<string, string> = {
  baru: 'Baru', proses: 'Proses', konfirmasi: 'Konfirmasi', batal: 'Batal',
}
const STATUS_WARNA: Record<string, 'neutral' | 'warning' | 'secondary' | 'primary'> = {
  baru: 'warning', proses: 'secondary', konfirmasi: 'primary', batal: 'neutral',
}

const emailTerpakai = computed(() => daftar.value.map(p => String(p.email).toLowerCase()))

const columns = [
  { accessorKey: 'nama', header: 'Nama' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'noHp', header: 'WhatsApp' },
  { accessorKey: 'status', header: 'Status Pendaftaran' },
  { accessorKey: 'aksi', header: 'Aksi' },
]

// Id sementara hanya untuk `:key` tabel dan tombol buang; ia tidak pernah dikirim.
let nomor = 0

const tambah = (nilai: any) => {
  daftar.value = [...daftar.value, { ...nilai, id: `tmp-p-${++nomor}` }]
  tambahModal.value = false
}

const buang = (id: string) => {
  daftar.value = daftar.value.filter(p => p.id !== id)
}
</script>

<template>
  <div>
    <!-- Tombol "Tambah peserta" tinggal di kepala kartu milik induk, sebaris dengan
         judulnya. Yang tersisa di sini tabelnya dan form yang mengisinya. -->
    <!-- Menggulir di dalam kotaknya sendiri: judul kolom sepanjang "Status
         Pendaftaran" melewati lebar kartu pada layar sedang, dan tanpa ini yang
         bergeser bukan tabelnya melainkan seluruh halaman. Kelasnya di UTable, bukan
         di div pembungkus — sama seperti di AdminPesertaTab, di mana pembungkus
         justru memutus rantai v-if di sana. -->
    <UTable
      :data="daftar"
      class="w-full overflow-x-auto"
      :columns="columns"
      empty="Belum ada peserta yang dimasukkan. Pendaftar dari halaman event masuk sendiri setelah event terbit."
    >
      <template #nama-cell="{ row }">
        <span class="font-semibold text-cc-green-800">{{ row.original.nama }}</span>
      </template>

      <template #email-cell="{ row }">
        <span class="text-sm text-cc-stone-700">{{ row.original.email }}</span>
      </template>

      <template #noHp-cell="{ row }">
        <span class="text-sm text-cc-stone-700">{{ row.original.noHp || '—' }}</span>
      </template>

      <template #status-cell="{ row }">
        <UBadge :color="STATUS_WARNA[row.original.status] ?? 'neutral'" variant="subtle" size="sm">
          {{ STATUS_LABEL[row.original.status] ?? row.original.status }}
        </UBadge>
      </template>

      <template #aksi-cell="{ row }">
        <div class="flex justify-end">
          <UButton
            color="error"
            variant="ghost"
            size="sm"
            icon="i-lucide-x"
            aria-label="Buang dari daftar"
            @click="buang(row.original.id)"
          />
        </div>
      </template>
    </UTable>

    <PesertaFormModal
      v-model:open="tambahModal"
      :email-terpakai="emailTerpakai"
      @simpan="tambah"
    />
  </div>
</template>
