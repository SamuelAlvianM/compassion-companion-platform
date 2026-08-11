<script setup lang="ts">
definePageMeta({ layout: 'admin' })

// Daftar user sungguhan dari database. Endpoint-nya sudah membatasi ke level <= 3,
// dan middleware admin.global.ts sudah menahan halaman ini lebih dulu.
// Sentinel 'semua', bukan string kosong. Reka UI (penyokong USelect) memesan ''
// untuk keadaan "belum dipilih" dan melempar galat render begitu ada item bernilai
// kosong — dan galat itu menjatuhkan seluruh halaman jadi 500, bukan cuma
// select-nya. Pola yang sama dipakai filter di halaman event dan form refleksi.
const SEMUA = 'semua'

const q = ref('')
const role = ref(SEMUA)
const aktif = ref(SEMUA)

// Ketikan tidak langsung memicu request; jeda singkat mencegah satu panggilan
// per huruf saat mengetik kata pencarian. Ditulis manual karena VueUse tidak
// ter-auto-import di project ini.
const qDebounced = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
watch(q, (nilai) => {
  clearTimeout(timer)
  timer = setTimeout(() => { qDebounced.value = nilai }, 300)
})
onScopeDispose(() => clearTimeout(timer))

// Sentinel diterjemahkan balik jadi "tidak menyaring"; server tidak perlu tahu.
const query = computed(() => ({
  q: qDebounced.value || undefined,
  role: role.value === SEMUA ? undefined : role.value,
  aktif: aktif.value === SEMUA ? undefined : aktif.value,
}))

const { data, status } = useFetch('/api/users', { query })

const users = computed(() => data.value?.data ?? [])
const roleOptions = computed(() => [
  { value: SEMUA, label: 'Semua role' },
  ...(data.value?.opsi.roles ?? []),
])
const aktifOptions = [
  { value: SEMUA, label: 'Semua status' },
  { value: 'true', label: 'Aktif' },
  { value: 'false', label: 'Nonaktif' },
]

const adaFilter = computed(() => Boolean(q.value) || role.value !== SEMUA || aktif.value !== SEMUA)
const reset = () => { q.value = ''; role.value = SEMUA; aktif.value = SEMUA }

/**
 * User yang sedang dibuka di panel kanan. Null berarti panel tertutup dan tabel
 * memakai lebar penuh.
 *
 * Disimpan sebagai id, bukan salinan barisnya: panel mengambil datanya sendiri
 * (riwayat keikutsertaan tidak ikut di payload daftar), dan menyalin baris hanya
 * akan membuat dua sumber yang bisa berbeda setelah daftarnya dimuat ulang.
 */
const terpilihId = ref<string | null>(null)

const pilih = (id: string) => {
  // Klik pada baris yang sama menutup panelnya — sama seperti menekan tombol X.
  terpilihId.value = terpilihId.value === id ? null : id
}

// Kalau user yang sedang dibuka tersaring keluar oleh filter, panelnya ikut
// ditutup; membiarkannya terbuka menunjukkan detail baris yang tidak ada di tabel.
watch(users, (daftar) => {
  if (terpilihId.value && !daftar.some((u: any) => u.id === terpilihId.value)) {
    terpilihId.value = null
  }
})

const columns = [
  { accessorKey: 'fullName', header: 'Nama' },
  { accessorKey: 'role', header: 'Role' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'jumlahKegiatan', header: 'Event diikuti' },
  { accessorKey: 'lastLogin', header: 'Terakhir masuk' },
  { accessorKey: 'aksi', header: '' },
]

const warnaLevel = (level: number) =>
  ({ 1: 'error', 2: 'primary', 3: 'secondary', 4: 'neutral' })[level] ?? 'neutral'

const tanggal = (nilai: string | null) => nilai
  ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date(nilai))
  : '—'
</script>

<template>
  <!-- Lebar ikut melebar saat panel terbuka: dua kolom di dalam max-w-6xl membuat
       tabelnya terlalu sempit untuk enam kolomnya. -->
  <div class="mx-auto" :class="terpilihId ? 'max-w-[1400px]' : 'max-w-6xl'">
    <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-xs font-bold uppercase tracking-[.16em] text-cc-brown-500">Administrasi</p>
        <h1 class="font-serif text-5xl text-cc-green-800">User</h1>
        <p class="mt-2 text-sm text-cc-stone-600">
          Semua akun beserta role dan riwayat keikutsertaannya.
        </p>
      </div>
      <UButton to="/admin/member/new" color="secondary" size="lg" icon="i-lucide-user-plus" class="shrink-0">
        Add User
      </UButton>
    </div>

    <div class="mb-6 grid gap-3 rounded-lg border border-cc-green-800 bg-cc-stone-50 p-3 sm:grid-cols-[1fr_200px_170px_auto] sm:items-end">
      <UFormField label="Cari" size="sm">
        <UInput v-model="q" icon="i-lucide-search" placeholder="Nama, username, atau email" class="w-full" />
      </UFormField>
      <UFormField label="Role" size="sm">
        <USelect v-model="role" :items="roleOptions" class="w-full" />
      </UFormField>
      <UFormField label="Status" size="sm">
        <USelect v-model="aktif" :items="aktifOptions" class="w-full" />
      </UFormField>
      <UButton color="neutral" variant="ghost" icon="i-lucide-rotate-ccw" :disabled="!adaFilter" @click="reset">
        Reset
      </UButton>
    </div>

    <!-- Tabel menyusut jadi separuh begitu satu user dibuka; panel detailnya
         mengisi separuh sisanya. Di layar sempit keduanya bertumpuk, karena dua
         kolom pada lebar segitu membuat tabelnya tidak terbaca. -->
    <div
      class="grid items-start gap-5"
      :class="terpilihId ? 'lg:grid-cols-2' : 'grid-cols-1'"
    >
      <UCard :ui="{ body: 'p-0' }">
        <UTable
          :data="users"
          :columns="columns"
          :loading="status === 'pending'"
          empty="Tidak ada user yang cocok."
          class="cursor-pointer"
          @select="(row: any) => pilih(row.original.id)"
        >
          <!-- Baris yang sedang dibuka ditandai lewat garis emas di tepi kiri sel
               pertama. Nuxt UI tidak menyediakan kait untuk memberi atribut pada
               <tr>, jadi penandanya dipasang di sel, bukan di barisnya. -->
          <template #fullName-cell="{ row }">
            <div
              class="-my-2 border-l-2 py-2 pl-3 transition-colors"
              :class="row.original.id === terpilihId ? 'border-cc-brown-500' : 'border-transparent'"
            >
              <span class="font-semibold text-cc-green-800">{{ row.original.fullName }}</span>
              <br>
              <span class="text-xs text-cc-stone-500">@{{ row.original.username }}</span>
            </div>
          </template>

          <template #role-cell="{ row }">
            <UBadge :color="warnaLevel(row.original.level)" variant="subtle" size="sm">
              {{ row.original.roleLabel }} · L{{ row.original.level }}
            </UBadge>
            <UBadge v-if="!row.original.isActive" color="neutral" variant="outline" size="sm" class="ml-1">
              nonaktif
            </UBadge>
          </template>

          <template #jumlahKegiatan-cell="{ row }">
            <span class="tabular-nums">{{ row.original.jumlahKegiatan }}</span>
          </template>

          <template #lastLogin-cell="{ row }">
            <span class="text-sm text-cc-stone-600">{{ tanggal(row.original.lastLogin) }}</span>
          </template>

          <template #aksi-cell="{ row }">
            <UButton
              :color="row.original.id === terpilihId ? 'secondary' : 'neutral'"
              :variant="row.original.id === terpilihId ? 'soft' : 'ghost'"
              size="sm"
              trailing-icon="i-lucide-chevron-right"
              @click="pilih(row.original.id)"
            >
              Detail
            </UButton>
          </template>
        </UTable>
      </UCard>

      <AdminDetailUser
        v-if="terpilihId"
        :key="terpilihId"
        :user-id="terpilihId"
        @tutup="terpilihId = null"
      />
    </div>

    <p v-if="data" class="mt-3 text-xs text-cc-stone-500">
      {{ users.length }} dari {{ data.meta.total }} akun.
    </p>
  </div>
</template>
