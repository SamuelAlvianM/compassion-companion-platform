<script setup lang="ts">
// Form member: buat baru dan ubah yang sudah ada.
//
// Situs ini tidak punya pendaftaran mandiri — setiap akun dibuat di halaman ini,
// dan passwordnya disampaikan ke pemiliknya lewat WhatsApp. Karena itu password
// ditampilkan terang-terangan saat dibuat (admin harus bisa menyalinnya) dan tidak
// pernah bisa dibaca lagi sesudahnya; yang tersimpan di database hanya hash-nya.
//
// Add dan Edit sengaja berbentuk sama persis, termasuk kolom passwordnya. Yang
// dulu memisahkan keduanya adalah modal "Ganti password" yang hanya ada di mode
// ubah — satu kemampuan yang sama, disembunyikan di balik bentuk yang berbeda.
definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const id = computed(() => String(route.params.id))
const baru = computed(() => id.value === 'new')

const { user: aktor } = useAuth()

// Tanpa `username`. Akun di sini masuk memakai emailnya; username tetap ada di
// database (dipakai tautan lama dan pencarian), tapi diisi server dari email —
// bukan hal yang perlu diketik ulang oleh siapa pun.
const form = reactive({
  fullName: '',
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

/**
 * Id akun yang baru saja dibuat di layar ini.
 *
 * `simpan()` mengganti alamat halaman jadi `/admin/member/<id>` sesudah membuat
 * akun, tapi yang tergambar tetap form "Add Member" yang sama — instance
 * halamannya tidak berganti, karena password yang baru dibuat harus tetap
 * terbaca di layar dan itu hanya bisa kalau tampilannya tidak dimuat ulang.
 *
 * Akibatnya tombol "Buat akun" masih bisa ditekan sekali lagi. Menekannya dengan
 * email yang sama cuma menghasilkan galat, tapi menekannya sesudah emailnya
 * diperbaiki akan membuat akun **kedua** sementara alamat halaman menunjuk yang
 * pertama. Karena itu tombolnya dimatikan begitu satu akun lahir, dan jalan
 * lanjutannya ditulis terang-terangan sebagai tautan.
 */
const dibuatId = ref('')

const muat = async () => {
  if (baru.value) return
  // Saat SSR, $fetch tidak ikut membawa cookie browser — tanpa penerusan ini
  // endpoint admin menjawab 401 pada render pertama.
  const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
  const res = await $fetch<any>(`/api/users/${id.value}`, { headers })
  const u = res.user
  Object.assign(form, {
    fullName: u.fullName ?? '',
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
    { value: 'master', label: 'Master', level: 1 },
    { value: 'admin', label: 'Admin', level: 2 },
    { value: 'editor', label: 'Editor', level: 3 },
    { value: 'user', label: 'User', level: 4 },
  ]
  const saya = aktor.value
  // Tanpa aktor yang diketahui, master tetap disembunyikan. Sebelumnya daftar
  // penuhlah yang dipakai selagi sesi belum termuat, sehingga "Master" sempat
  // terlihat sekejap oleh admin biasa pada setiap muat halaman.
  if (!saya) return semua.filter(r => r.value !== 'master')
  if (saya.role === 'master') return semua
  return semua.filter(r => r.level > saya.level)
})

const pesan = (e: any, bawaan: string) => e?.data?.statusMessage ?? e?.statusMessage ?? bawaan

/**
 * Satu tombol simpan untuk kedua mode.
 *
 * Pada mode ubah itu berarti dua permintaan, karena password memang endpoint
 * tersendiri (`…/password`) yang menghash dan mencatatnya terpisah dari kolom
 * biasa. Urutannya data dulu, password sesudahnya: kalau yang kedua gagal,
 * perubahan nama/role tetap tersimpan dan pesannya harus mengatakan justru itu —
 * "tersimpan, kecuali passwordnya" lebih berguna daripada satu galat yang
 * membuat orang menebak bagian mana yang tidak jadi.
 *
 * Kolom password kosong berarti "jangan diubah", bukan "kosongkan passwordnya".
 */
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
      dibuatId.value = res.data.id
      sukses.value = `Akun ${res.data.email ?? res.data.username} dibuat. Kirimkan passwordnya lewat WhatsApp sekarang — ia tidak bisa dibaca lagi setelah halaman ini ditinggalkan.`
      return
    }

    const { password, ...tanpaPassword } = form
    await $fetch(`/api/admin/users/${id.value}`, { method: 'PATCH', body: tanpaPassword })

    if (password) {
      try {
        await $fetch(`/api/admin/users/${id.value}/password`, {
          method: 'POST',
          body: { passwordBaru: password },
        })
        sukses.value = 'Perubahan tersimpan. Password baru sudah dipasang — kirimkan lewat WhatsApp sekarang, ia tidak bisa dibaca lagi setelah halaman ini ditinggalkan.'
      }
      catch (e: any) {
        galat.value = pesan(e, 'Password gagal diganti.') + ' Perubahan data lainnya tetap tersimpan.'
        return
      }
    }
    else {
      sukses.value = 'Perubahan tersimpan.'
    }

    // Password sengaja tidak ikut dimuat ulang dari server (tidak ada yang bisa
    // dibaca), jadi kolomnya dikosongkan supaya menekan simpan sekali lagi tidak
    // memasang ulang password yang sama.
    await muat()
  }
  catch (e: any) { galat.value = pesan(e, 'Gagal menyimpan akun.') }
  finally { sibuk.value = false }
}

/** Acak, mudah dibaca lewat telepon: tanpa huruf/angka yang gampang tertukar. */
const ABJAD = 'abcdefghjkmnpqrstuvwxyz23456789'
const acakPassword = () => {
  form.password = Array.from(crypto.getRandomValues(new Uint32Array(10)))
    .map(n => ABJAD[n % ABJAD.length])
    .join('')
  lihatPassword.value = true
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
      Kembali ke Member
    </UButton>

    <div class="mb-7">
      <h1 class="font-serif text-5xl text-cc-green-800">{{ baru ? 'Add Member' : 'Edit Member' }}</h1>
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

        <UFormField label="Email" name="email" description="Dipakai untuk masuk ke situs.">
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

        <!-- Kolom yang sama di kedua mode. Pada mode ubah ia boleh dikosongkan;
             yang lama tidak pernah bisa dibaca lagi dari mana pun, jadi tidak ada
             yang bisa ditampilkan di sini selain kosong. -->
        <UFormField
          label="Password"
          name="password"
          :hint="baru ? 'minimal 6 karakter' : 'kosongkan bila tidak diganti'"
          :required="baru"
          :description="baru ? undefined : 'Password lama tidak diperlukan. Sesi pemilik akun yang sedang berjalan tidak ikut terputus.'"
        >
          <UInput
            v-model="form.password"
            :type="lihatPassword ? 'text' : 'password'"
            autocomplete="new-password"
            :placeholder="baru ? 'Password yang akan dikirim lewat WhatsApp' : 'Password baru'"
            :required="baru"
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

        <UButton
          color="neutral" variant="soft" size="xs" icon="i-lucide-dices"
          :disabled="Boolean(dibuatId)"
          @click="acakPassword"
        >
          Buatkan password acak
        </UButton>

        <div class="flex flex-wrap items-center gap-3 pt-2">
          <UButton
            type="submit"
            color="secondary"
            size="lg"
            icon="i-lucide-save"
            :loading="sibuk"
            :disabled="Boolean(dibuatId)"
          >
            {{ baru ? 'Buat akun' : 'Simpan perubahan' }}
          </UButton>

          <!-- Muncul hanya sesudah satu akun lahir di layar ini. Tautan biasa,
               bukan tombol: yang dituju halaman ubah akun itu, dimuat dari awal
               sehingga isiannya datang dari database, bukan dari sisa form ini. -->
          <UButton
            v-if="dibuatId"
            :to="`/admin/member/${dibuatId}`"
            external
            color="neutral"
            variant="outline"
            icon="i-lucide-pencil"
          >
            Lanjut ubah akun ini
          </UButton>
        </div>
      </UForm>
    </UCard>
  </div>
</template>
