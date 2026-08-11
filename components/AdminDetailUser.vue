<script setup lang="ts">
// Panel detail user di samping tabel /admin/members.
//
// Berdampingan, bukan halaman terpisah: pekerjaan yang sesungguhnya di halaman ini
// adalah membanding-bandingkan akun, dan itu menuntut daftarnya tetap terlihat.
// Pindah halaman untuk tiap akun berarti kembali–maju terus-menerus, dan urutan
// serta filter daftarnya harus dibangun ulang di kepala setiap kali kembali.

const props = defineProps<{ userId: string }>()
const emit = defineEmits<{ tutup: [] }>()

const { data, status } = useFetch(() => `/api/users/${props.userId}`, {
  headers: import.meta.server ? useRequestHeaders(['cookie']) : undefined,
})

const u = computed(() => data.value?.user)

// ── Reset password ───────────────────────────────────────────────────────────
// Jalur pemulihan untuk akun yang dibuat admin: passwordnya disampaikan lewat
// WhatsApp, jadi kalau pemiliknya lupa, tidak ada siapa pun selain pengelola yang
// bisa memasangkan yang baru.
//
// Syarat yang sama ditegakkan ulang di server (wajibKelolaAkun). Yang di sini
// hanya menyembunyikan tombol yang pasti ditolak — bukan penjaganya.
const { user: aktor } = useAuth()

const bolehReset = computed(() => {
  const saya = aktor.value
  const sasaran = u.value
  if (!saya || !sasaran) return false
  if (saya.level > 2) return false
  if (saya.id === sasaran.id) return true
  if (saya.role === 'master') return true
  return saya.level < sasaran.level
})

const resetModal = ref(false)
const passwordBaru = ref('')
const lihatPassword = ref(false)
const sibukReset = ref(false)
const galatReset = ref('')
const sesudahReset = ref('')

const bukaReset = () => {
  passwordBaru.value = ''
  lihatPassword.value = true
  galatReset.value = ''
  sesudahReset.value = ''
  resetModal.value = true
}

const kirimReset = async () => {
  sibukReset.value = true
  galatReset.value = ''
  try {
    await $fetch(`/api/admin/users/${props.userId}/password`, {
      method: 'POST',
      body: { passwordBaru: passwordBaru.value },
    })
    // Passwordnya ditahan di layar setelah berhasil, bukan dikosongkan: admin harus
    // menyalinnya ke WhatsApp, dan tidak ada tempat lain untuk membacanya lagi —
    // yang tersimpan di database hanya hash-nya.
    sesudahReset.value = passwordBaru.value
  }
  catch (e: any) {
    galatReset.value = e?.data?.statusMessage ?? e?.statusMessage ?? 'Gagal mengubah password.'
  }
  finally { sibukReset.value = false }
}
const riwayat = computed(() => data.value?.riwayat ?? [])
const ringkas = computed(() => data.value?.ringkas)

const memuatAwal = computed(() => !data.value && status.value !== 'error')

const inisial = computed(() =>
  (u.value?.fullName ?? '?').split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase())

const warnaLevel = (level: number) =>
  ({ 1: 'error', 2: 'primary', 3: 'secondary', 4: 'neutral' })[level] ?? 'neutral'

const warnaStatus = (s: string) =>
  ({ konfirmasi: 'primary', proses: 'secondary', baru: 'warning', batal: 'neutral' })[s] ?? 'neutral'

const labelStatus = (s: string) =>
  ({ baru: 'Baru', proses: 'Diproses', konfirmasi: 'Terkonfirmasi', batal: 'Dibatalkan' })[s] ?? s

const tanggal = (nilai: string | null, jam = false) => nilai
  ? new Intl.DateTimeFormat('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
      ...(jam ? { hour: '2-digit', minute: '2-digit' } : {}),
      timeZone: 'Asia/Jakarta',
    }).format(new Date(nilai))
  : '—'
</script>

<template>
  <UCard :ui="{ body: 'p-5' }">
    <template #header>
      <div class="flex items-start justify-between gap-3">
        <h2 class="font-serif text-2xl text-cc-green-800">Detail user</h2>
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          icon="i-lucide-x"
          aria-label="Tutup detail"
          @click="emit('tutup')"
        />
      </div>
    </template>

    <!-- Rangka mengikuti susunan aslinya: avatar + identitas, dua blok data,
         lalu daftar keikutsertaan. -->
    <div v-if="memuatAwal" class="space-y-5" aria-hidden="true">
      <div class="flex items-center gap-4">
        <USkeleton class="size-16 shrink-0 rounded-full" />
        <div class="min-w-0 flex-1 space-y-2">
          <USkeleton class="h-5 w-44" />
          <USkeleton class="h-3 w-28" />
          <USkeleton class="h-5 w-32 rounded-full" />
        </div>
      </div>
      <div class="space-y-3">
        <USkeleton v-for="n in 5" :key="n" class="h-4 w-full" />
      </div>
    </div>

    <div v-else-if="!u" class="py-8 text-center text-sm text-cc-stone-500">
      User tidak ditemukan.
    </div>

    <div v-else class="space-y-6">
      <!-- Identitas -->
      <div class="flex items-center gap-4">
        <div class="grid size-16 shrink-0 place-items-center rounded-full bg-cc-brown-500 font-serif text-2xl text-cc-stone-50">
          {{ inisial }}
        </div>
        <!-- Dibungkus, bukan dipotong. Nama adalah hal yang dicari orang di panel
             ini; "Master Compassionate Co…" memaksa menebak akun mana yang sedang
             dibuka, dan ruang vertikal di sini justru berlimpah. -->
        <div class="min-w-0 flex-1">
          <p class="font-serif text-2xl leading-tight text-balance text-cc-green-800">{{ u.fullName }}</p>
          <p class="text-sm break-all text-cc-stone-500">@{{ u.username }}</p>
          <div class="mt-1.5 flex flex-wrap gap-1.5">
            <UBadge :color="warnaLevel(u.level)" variant="subtle" size="sm">
              {{ u.roleLabel }} · L{{ u.level }}
            </UBadge>
            <UBadge :color="u.isActive ? 'primary' : 'neutral'" :variant="u.isActive ? 'subtle' : 'outline'" size="sm">
              {{ u.isActive ? 'Aktif' : 'Nonaktif' }}
            </UBadge>
          </div>
        </div>
      </div>

      <!-- Data diri -->
      <div>
        <p class="mb-2 text-xs font-bold uppercase tracking-[.16em] text-cc-brown-500">Data diri</p>
        <dl class="divide-y divide-cc-stone-200 border-y border-cc-stone-200">
          <div class="flex gap-3 py-2 text-sm">
            <dt class="w-32 shrink-0 text-cc-stone-500">Email</dt>
            <dd class="min-w-0 flex-1 break-words text-cc-green-800">{{ u.email ?? '—' }}</dd>
          </div>
          <div class="flex gap-3 py-2 text-sm">
            <dt class="w-32 shrink-0 text-cc-stone-500">WhatsApp</dt>
            <dd class="min-w-0 flex-1 text-cc-green-800">{{ u.phoneNumber ?? '—' }}</dd>
          </div>
          <div class="flex gap-3 py-2 text-sm">
            <dt class="w-32 shrink-0 text-cc-stone-500">Wewenang</dt>
            <dd class="min-w-0 flex-1 text-cc-stone-600">{{ u.roleDeskripsi }}</dd>
          </div>
        </dl>
      </div>

      <!-- Riwayat akun -->
      <div>
        <p class="mb-2 text-xs font-bold uppercase tracking-[.16em] text-cc-brown-500">Riwayat akun</p>
        <dl class="divide-y divide-cc-stone-200 border-y border-cc-stone-200">
          <div class="flex gap-3 py-2 text-sm">
            <dt class="w-32 shrink-0 text-cc-stone-500">Terdaftar</dt>
            <dd class="min-w-0 flex-1 text-cc-green-800">{{ tanggal(u.createdAt, true) }}</dd>
          </div>
          <div class="flex gap-3 py-2 text-sm">
            <dt class="w-32 shrink-0 text-cc-stone-500">Login terakhir</dt>
            <dd class="min-w-0 flex-1 text-cc-green-800">{{ tanggal(u.lastLogin, true) }}</dd>
          </div>
        </dl>
      </div>

      <!-- Keikutsertaan -->
      <div>
        <p class="mb-2 text-xs font-bold uppercase tracking-[.16em] text-cc-brown-500">
          Keikutsertaan ({{ riwayat.length }})
        </p>

        <p v-if="!riwayat.length" class="text-sm text-cc-stone-500">
          Belum pernah mendaftar kegiatan.
        </p>

        <ul v-else class="space-y-2">
          <li
            v-for="r in riwayat.slice(0, 5)"
            :key="r.pesertaId"
            class="flex items-center gap-3 rounded-lg border border-cc-stone-200 px-3 py-2"
          >
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-cc-green-800">{{ r.judul }}</p>
              <p class="text-xs text-cc-stone-500">{{ tanggal(r.tanggalMulai) }}</p>
            </div>
            <UBadge :color="warnaStatus(r.status)" variant="subtle" size="sm" class="shrink-0">
              {{ labelStatus(r.status) }}
            </UBadge>
          </li>
        </ul>

        <p v-if="riwayat.length > 5" class="mt-2 text-xs text-cc-stone-500">
          dan {{ riwayat.length - 5 }} lainnya.
        </p>

        <p v-if="ringkas" class="mt-3 text-xs text-cc-stone-500">
          {{ ringkas.konfirmasi }} terkonfirmasi · {{ ringkas.diproses }} diproses ·
          {{ ringkas.selesai }} kegiatan sudah selesai
        </p>
      </div>

      <div class="space-y-2">
        <UButton
          :to="`/id/profil?id=${u.id}`"
          color="secondary"
          variant="outline"
          block
          trailing-icon="i-lucide-arrow-right"
        >
          Buka profil lengkap
        </UButton>

        <template v-if="bolehReset">
          <UButton
            :to="`/admin/member/${u.id}`"
            color="neutral"
            variant="outline"
            block
            icon="i-lucide-pencil"
          >
            Ubah akun
          </UButton>

          <UButton color="neutral" variant="soft" block icon="i-lucide-key-round" @click="bukaReset">
            Reset password
          </UButton>
        </template>
      </div>
    </div>

    <UModal v-model:open="resetModal" title="Reset password">
      <template #body>
        <!-- Sesudah berhasil: passwordnya diperlihatkan supaya bisa disalin ke WA. -->
        <div v-if="sesudahReset" class="space-y-3">
          <UAlert
            color="primary"
            variant="subtle"
            icon="i-lucide-check"
            :description="`Password ${u?.fullName ?? 'akun ini'} sudah diganti.`"
          />
          <div class="rounded-lg border border-cc-stone-200 bg-cc-stone-50 p-3">
            <p class="text-xs font-bold uppercase tracking-[.16em] text-cc-brown-500">Password baru</p>
            <p class="mt-1 font-mono text-lg break-all text-cc-green-800">{{ sesudahReset }}</p>
          </div>
          <p class="text-xs text-cc-stone-500">
            Salin sekarang lalu kirimkan lewat WhatsApp. Yang tersimpan di database hanya hash-nya,
            jadi setelah jendela ini ditutup password ini tidak bisa dibaca lagi dari mana pun.
          </p>
        </div>

        <div v-else class="space-y-4">
          <p class="text-sm text-cc-stone-600">
            Password lama tidak diperlukan. Pemilik akun bisa langsung masuk dengan password baru ini,
            dan sesi yang sedang berjalan di perangkatnya tidak ikut terputus.
          </p>

          <div class="rounded-lg border border-cc-stone-200 bg-cc-stone-50 p-3">
            <p class="font-semibold text-cc-green-800">{{ u?.fullName }}</p>
            <p class="text-sm text-cc-stone-500">@{{ u?.username }} · {{ u?.roleLabel }}</p>
          </div>

          <UFormField label="Password baru" hint="minimal 6 karakter" required>
            <UInput
              v-model="passwordBaru"
              :type="lihatPassword ? 'text' : 'password'"
              autocomplete="new-password"
              class="w-full"
              placeholder="Password yang akan dikirim ke pemilik akun"
              @keyup.enter="passwordBaru && kirimReset()"
            >
              <template #trailing>
                <UButton
                  color="neutral" variant="link" size="sm" tabindex="-1"
                  :icon="lihatPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                  aria-label="Tampilkan password"
                  @click="lihatPassword = !lihatPassword"
                />
              </template>
            </UInput>
          </UFormField>

          <UAlert v-if="galatReset" color="error" variant="subtle" icon="i-lucide-triangle-alert" :description="galatReset" />
        </div>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="resetModal = false">
            {{ sesudahReset ? 'Tutup' : 'Batal' }}
          </UButton>
          <UButton
            v-if="!sesudahReset"
            color="secondary"
            icon="i-lucide-key-round"
            :loading="sibukReset"
            :disabled="!passwordBaru"
            @click="kirimReset"
          >
            Ubah password
          </UButton>
        </div>
      </template>
    </UModal>
  </UCard>
</template>
