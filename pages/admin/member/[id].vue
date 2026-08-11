<script setup lang="ts">
// Form akun: buat baru dan ubah yang sudah ada.
//
// Situs ini tidak punya pendaftaran mandiri — setiap akun dibuat di halaman ini,
// dan passwordnya disampaikan ke pemiliknya lewat WhatsApp. Karena itu password
// ditampilkan terang-terangan saat dibuat (admin harus bisa menyalinnya) dan tidak
// pernah bisa dibaca lagi sesudahnya; yang tersimpan di database hanya hash-nya.
definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const id = computed(() => String(route.params.id))
const baru = computed(() => id.value === 'new')

const { user: aktor } = useAuth()

const form = reactive({
  fullName: '',
  username: '',
  email: '',
  phoneNumber: '',
  role: 'user',
  isActive: true,
  password: '',
})

const lihatPassword = ref(true)
const sibuk = ref(false)
const galat = ref('')
const sukses = ref('')

const muat = async () => {
  if (baru.value) return
  // Saat SSR, $fetch tidak ikut membawa cookie browser — tanpa penerusan ini
  // endpoint admin menjawab 401 pada render pertama.
  const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
  const res = await $fetch<any>(`/api/users/${id.value}`, { headers })
  const u = res.user
  Object.assign(form, {
    fullName: u.fullName ?? '',
    username: u.username ?? '',
    email: u.email ?? '',
    phoneNumber: u.phoneNumber ?? '',
    role: u.role ?? 'user',
    isActive: u.isActive ?? true,
    password: '',
  })
}

await muat()
watch(id, muat)

/**
 * Role yang boleh dipilih: hanya yang wewenangnya di bawah aktor, kecuali master
 * yang boleh menetapkan apa saja.
 *
 * Aturan yang sama ditegakkan di server (wajibKelolaAkun) — daftar yang dipersempit
 * di sini cuma mencegah orang memilih sesuatu yang pasti ditolak.
 */
const roleOptions = computed(() => {
  const semua = [
    { value: 'master', label: 'Master — level 1', level: 1 },
    { value: 'admin', label: 'Admin — level 2', level: 2 },
    { value: 'editor', label: 'Editor — level 3', level: 3 },
    { value: 'user', label: 'User — level 4', level: 4 },
  ]
  const saya = aktor.value
  if (!saya || saya.role === 'master') return semua
  return semua.filter(r => r.level > saya.level)
})

const pesan = (e: any, bawaan: string) => e?.data?.statusMessage ?? e?.statusMessage ?? bawaan

const simpan = async () => {
  sibuk.value = true
  galat.value = ''
  sukses.value = ''
  try {
    if (baru.value) {
      const res = await $fetch<any>('/api/admin/users', {
        method: 'POST',
        body: { ...form },
      })
      // Pindah ke halaman ubah supaya alamatnya tidak lagi `/new` — menekan segar
      // di situ akan membuat akun kedua.
      await router.replace(`/admin/member/${res.data.id}`)
      sukses.value = `Akun @${res.data.username} dibuat. Kirimkan passwordnya lewat WhatsApp sekarang — ia tidak bisa dibaca lagi setelah halaman ini ditinggalkan.`
    }
    else {
      const { password: _abaikan, ...tanpaPassword } = form
      await $fetch(`/api/admin/users/${id.value}`, { method: 'PATCH', body: tanpaPassword })
      sukses.value = 'Perubahan tersimpan.'
      await muat()
    }
  }
  catch (e: any) { galat.value = pesan(e, 'Gagal menyimpan akun.') }
  finally { sibuk.value = false }
}

// ── Ganti password akun ini ──────────────────────────────────────────────────
// Jalur terpisah dari tombol simpan: menyimpan perubahan nama tidak boleh pernah
// ikut mengganti password tanpa diminta.
const resetModal = ref(false)
const passwordBaru = ref('')
const sibukReset = ref(false)
const galatReset = ref('')
const sesudahReset = ref('')

const bukaReset = () => {
  passwordBaru.value = ''
  galatReset.value = ''
  sesudahReset.value = ''
  resetModal.value = true
}

const kirimReset = async () => {
  sibukReset.value = true
  galatReset.value = ''
  try {
    await $fetch(`/api/admin/users/${id.value}/password`, {
      method: 'POST',
      body: { passwordBaru: passwordBaru.value },
    })
    sesudahReset.value = passwordBaru.value
  }
  catch (e: any) { galatReset.value = pesan(e, 'Gagal mengubah password.') }
  finally { sibukReset.value = false }
}

/** Acak, mudah dibaca lewat telepon: tanpa huruf/angka yang gampang tertukar. */
const ABJAD = 'abcdefghjkmnpqrstuvwxyz23456789'
const acakPassword = () => {
  const nilai = Array.from(crypto.getRandomValues(new Uint32Array(10)))
    .map(n => ABJAD[n % ABJAD.length])
    .join('')
  if (baru.value) { form.password = nilai; lihatPassword.value = true }
  else passwordBaru.value = nilai
}
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <UButton
      to="/admin/members"
      color="secondary"
      variant="link"
      leading-icon="i-lucide-arrow-left"
      class="mb-4 -ml-2"
    >
      Kembali ke User
    </UButton>

    <div class="mb-7">
      <p class="text-xs font-bold uppercase tracking-[.16em] text-cc-brown-500">Administrasi</p>
      <h1 class="font-serif text-5xl text-cc-green-800">{{ baru ? 'Akun baru' : form.fullName || 'Ubah akun' }}</h1>
      <p class="mt-2 text-sm text-cc-stone-600">
        Tidak ada pendaftaran mandiri di situs ini. Semua akun dibuat di sini, lalu passwordnya
        dikirimkan ke pemiliknya lewat WhatsApp.
      </p>
    </div>

    <UAlert v-if="galat" color="error" variant="subtle" class="mb-4" icon="i-lucide-triangle-alert" :description="galat" />
    <UAlert v-if="sukses" color="primary" variant="subtle" class="mb-4" icon="i-lucide-check" :description="sukses" />

    <UCard>
      <UForm :state="form" class="space-y-5" @submit="simpan">
        <UFormField label="Nama lengkap" name="fullName" required>
          <UInput v-model="form.fullName" placeholder="Nama pemilik akun" required class="w-full" />
        </UFormField>

        <UFormField
          label="Username"
          name="username"
          :hint="baru ? 'kosongkan untuk menyusun dari email' : undefined"
        >
          <template #description>
            <span class="text-xs text-cc-stone-500">
              Bisa dipakai untuk masuk, sama seperti email. Bentrokan diselesaikan sendiri
              dengan akhiran angka.
            </span>
          </template>
          <UInput v-model="form.username" placeholder="mis. maria.santoso" class="w-full" />
        </UFormField>

        <UFormField label="Email" name="email">
          <UInput v-model="form.email" type="email" placeholder="nama@email.com" class="w-full" />
        </UFormField>

        <UFormField label="Nomor WhatsApp" name="phoneNumber">
          <UInput v-model="form.phoneNumber" placeholder="08xx xxxx xxxx" class="w-full" />
        </UFormField>

        <UFormField label="Role" name="role" description="Menentukan halaman apa saja yang bisa dibuka.">
          <USelect v-model="form.role" :items="roleOptions" value-key="value" class="w-full" />
        </UFormField>

        <UFormField v-if="!baru" name="isActive" description="Akun nonaktif langsung kehilangan akses, tanpa menunggu sesinya kedaluwarsa.">
          <USwitch v-model="form.isActive" label="Akun aktif" />
        </UFormField>

        <!-- Password hanya diminta saat membuat akun. Untuk akun yang sudah ada,
             penggantiannya lewat tombol tersendiri di bawah. -->
        <UFormField v-if="baru" label="Password" name="password" hint="minimal 6 karakter" required>
          <UInput
            v-model="form.password"
            :type="lihatPassword ? 'text' : 'password'"
            autocomplete="new-password"
            placeholder="Password yang akan dikirim lewat WhatsApp"
            required
            class="w-full"
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

        <UButton v-if="baru" color="neutral" variant="soft" size="xs" icon="i-lucide-dices" @click="acakPassword">
          Buatkan password acak
        </UButton>

        <div class="flex flex-wrap items-center gap-3 pt-2">
          <UButton type="submit" color="secondary" size="lg" icon="i-lucide-save" :loading="sibuk">
            {{ baru ? 'Buat akun' : 'Simpan perubahan' }}
          </UButton>

          <UButton v-if="!baru" color="neutral" variant="outline" icon="i-lucide-key-round" @click="bukaReset">
            Ganti password
          </UButton>
        </div>
      </UForm>
    </UCard>

    <UModal v-model:open="resetModal" title="Ganti password akun ini">
      <template #body>
        <div v-if="sesudahReset" class="space-y-3">
          <UAlert color="primary" variant="subtle" icon="i-lucide-check" description="Password sudah diganti." />
          <div class="rounded-lg border border-cc-stone-200 bg-cc-stone-50 p-3">
            <p class="text-xs font-bold uppercase tracking-[.16em] text-cc-brown-500">Password baru</p>
            <p class="mt-1 font-mono text-lg break-all text-cc-green-800">{{ sesudahReset }}</p>
          </div>
          <p class="text-xs text-cc-stone-500">
            Salin sekarang lalu kirimkan lewat WhatsApp. Setelah jendela ini ditutup, password ini
            tidak bisa dibaca lagi dari mana pun.
          </p>
        </div>

        <div v-else class="space-y-4">
          <p class="text-sm text-cc-stone-600">
            Password lama tidak diperlukan. Sesi pemilik akun yang sedang berjalan tidak ikut terputus.
          </p>
          <UFormField label="Password baru" hint="minimal 6 karakter" required>
            <UInput
              v-model="passwordBaru"
              type="text"
              autocomplete="new-password"
              class="w-full"
              @keyup.enter="passwordBaru && kirimReset()"
            />
          </UFormField>
          <UButton color="neutral" variant="soft" size="xs" icon="i-lucide-dices" @click="acakPassword">
            Buatkan password acak
          </UButton>
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
  </div>
</template>
