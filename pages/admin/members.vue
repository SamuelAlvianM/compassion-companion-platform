<script setup lang="ts">
definePageMeta({ layout: 'admin' })

// Daftar user sungguhan dari database. Endpoint-nya sudah membatasi ke level <= 3,
// dan middleware admin.global.ts sudah menahan halaman ini lebih dulu.
const q = ref('')
const role = ref<string | undefined>(undefined)
const aktif = ref<string | undefined>(undefined)

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

const query = computed(() => ({
  q: qDebounced.value || undefined,
  role: role.value || undefined,
  aktif: aktif.value || undefined,
}))

const { data, status } = useFetch('/api/users', { query })

const users = computed(() => data.value?.data ?? [])
const roleOptions = computed(() => [
  { value: '', label: 'Semua role' },
  ...(data.value?.opsi.roles ?? []),
])
const aktifOptions = [
  { value: '', label: 'Semua status' },
  { value: 'true', label: 'Aktif' },
  { value: 'false', label: 'Nonaktif' },
]

const adaFilter = computed(() => Boolean(q.value || role.value || aktif.value))
const reset = () => { q.value = ''; role.value = undefined; aktif.value = undefined }

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
  <div class="mx-auto max-w-6xl">
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

    <UCard :ui="{ body: 'p-0' }">
      <UTable
        :data="users"
        :columns="columns"
        :loading="status === 'pending'"
        empty="Tidak ada user yang cocok."
      >
        <template #fullName-cell="{ row }">
          <NuxtLink
            :to="`/id/profil?id=${row.original.id}`"
            class="font-semibold text-cc-green-800 hover:text-cc-brown-500 hover:underline"
          >
            {{ row.original.fullName }}
          </NuxtLink>
          <br>
          <span class="text-xs text-cc-stone-500">@{{ row.original.username }}</span>
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
            :to="`/id/profil?id=${row.original.id}`"
            color="secondary"
            variant="ghost"
            size="sm"
            icon="i-lucide-eye"
          >
            Profil
          </UButton>
        </template>
      </UTable>
    </UCard>

    <p v-if="data" class="mt-3 text-xs text-cc-stone-500">
      {{ users.length }} dari {{ data.meta.total }} akun.
    </p>
  </div>
</template>
