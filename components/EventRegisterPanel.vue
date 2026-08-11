<script setup lang="ts">
// Panel pendaftaran event — menempel di halaman detail, bukan di dalam modal.
//
// Kedua jalur pendaftaran berdiri di halaman yang sama dan terlihat sekaligus:
//
//   tanpa akun  -> formulir nama/email/no HP/institusi
//   dengan akun -> email + password, lalu identitasnya dipakai mengisi sendiri
//
// Modal dipakai HANYA untuk konfirmasi terakhir. Alasannya: mendaftar adalah
// tindakan yang tidak bisa dibatalkan sendiri oleh pendaftar, jadi nama dan email
// yang akan tercatat harus diperlihatkan sekali lagi di luar formulir — tempat
// orang sudah berhenti mengetik dan mulai membaca. Yang paling sering salah adalah
// perangkat yang masih memegang akun orang lain, dan itu hanya ketahuan kalau
// namanya diperlihatkan sebelum tombol terakhir.

interface EventRingkas {
  slug: string
  judul: string
  judulEn: string | null
  harga: number
  sisaKuota: number | null
  pendaftaranTerbuka: boolean
  sudahTerdaftar?: boolean
  fase?: string
}

const props = defineProps<{ event: EventRingkas, isEn: boolean }>()
const emit = defineEmits<{ berhasil: [] }>()

const { user, masuk, keluar } = useAuth()

const form = reactive({ nama: '', email: '', noHp: '', institusi: '' })
const cepat = reactive({ email: '', password: '' })

const konfirmasiOpen = ref(false)
const memproses = ref(false)
const memeriksa = ref(false)
const galat = ref('')
const galatPeriksa = ref('')
const sukses = ref('')

const t = computed(() => props.isEn
  ? {
      eyebrow: 'Registration', biaya: 'Fee', kuota: 'Seats',
      takTerbatas: 'No seat limit', sisa: (n: number) => `${n} left`, gratis: 'Free',
      sudah: 'You are already registered for this event.',
      penuh: 'This event is full.', ditutup: 'Registration is closed for this event.',
      nama: 'Full name', email: 'Email', noHp: 'WhatsApp number', institusi: 'Institution',
      opsional: 'optional', kirim: 'Send registration',
      cepatJudul: 'Already have an account?',
      cepatIntro: 'Enter your email and password — we will fill in the rest.',
      password: 'Password', periksa: 'Check account', memeriksa: 'Checking…',
      gagalPeriksa: 'Email or password is incorrect.',
      sebagai: 'You are signed in as', daftarSekarang: 'Register now', ganti: 'Use another account',
      konfirmasiJudul: 'Confirm registration',
      konfirmasiIntro: 'Please check the details below before we record your registration.',
      acara: 'Event', cekLagi: 'Check again', kirimAkhir: 'Register now',
      memprosesLabel: 'Sending…', gagal: 'Registration failed',
      wajib: 'Full name and email are required.',
    }
  : {
      eyebrow: 'Pendaftaran', biaya: 'Biaya', kuota: 'Kuota',
      takTerbatas: 'Tanpa batas', sisa: (n: number) => `sisa ${n}`, gratis: 'Gratis',
      sudah: 'Anda sudah terdaftar di kegiatan ini.',
      penuh: 'Kegiatan ini sudah penuh.', ditutup: 'Pendaftaran kegiatan ini sudah ditutup.',
      nama: 'Nama lengkap', email: 'Email', noHp: 'Nomor WhatsApp', institusi: 'Institusi',
      opsional: 'opsional', kirim: 'Kirim pendaftaran',
      cepatJudul: 'Sudah punya akun?',
      cepatIntro: 'Masukkan email dan password — sisanya kami isikan.',
      password: 'Password', periksa: 'Periksa akun', memeriksa: 'Memeriksa…',
      gagalPeriksa: 'Email atau password salah.',
      sebagai: 'Anda masuk sebagai', daftarSekarang: 'Daftar sekarang', ganti: 'Pakai akun lain',
      konfirmasiJudul: 'Konfirmasi pendaftaran',
      konfirmasiIntro: 'Periksa kembali data di bawah ini sebelum pendaftaran kami catat.',
      acara: 'Kegiatan', cekLagi: 'Cek lagi', kirimAkhir: 'Daftar sekarang',
      memprosesLabel: 'Mengirim…', gagal: 'Pendaftaran gagal',
      wajib: 'Nama lengkap dan email wajib diisi.',
    })

const judulEvent = computed(() =>
  props.isEn ? (props.event.judulEn ?? props.event.judul) : props.event.judul)

const rupiah = (n: number) => n === 0
  ? t.value.gratis
  : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

/** Yang akan benar-benar tercatat — sumbernya akun bila ada sesi, formulir bila tamu. */
const calon = computed(() => user.value
  ? { nama: user.value.fullName, email: user.value.email ?? '', dariAkun: true }
  : { nama: form.nama, email: form.email, dariAkun: false })

const bukaKonfirmasi = () => {
  galat.value = ''
  if (!calon.value.nama || !calon.value.email) {
    galat.value = t.value.wajib
    return
  }
  konfirmasiOpen.value = true
}

const periksaAkun = async () => {
  if (!cepat.email || !cepat.password) return
  galatPeriksa.value = ''
  memeriksa.value = true
  try {
    // `masuk()` menerima username ATAU email — endpoint login memang menerima
    // keduanya di field yang sama. Setelah berhasil, sesi terbentuk dan panel
    // beralih sendiri ke kartu identitas; tidak langsung mendaftar.
    await masuk(cepat.email, cepat.password)
    cepat.password = ''
  }
  catch (error: any) {
    galatPeriksa.value = error?.data?.statusMessage || error?.statusMessage || t.value.gagalPeriksa
  }
  finally {
    memeriksa.value = false
  }
}

const daftar = async () => {
  galat.value = ''
  memproses.value = true
  try {
    // Saat sudah login, body sengaja dibiarkan kosong — server yang mengambil
    // nama & email dari sesi, jadi data peserta tidak bisa dipalsukan dari klien.
    const body = user.value ? {} : { ...form }
    const hasil = await $fetch<{ message: string }>(`/api/events/${props.event.slug}/register`, {
      method: 'POST',
      body,
    })
    konfirmasiOpen.value = false
    sukses.value = hasil.message
    emit('berhasil')
  }
  catch (error: any) {
    galat.value = error?.data?.statusMessage || error?.statusMessage || t.value.gagal
  }
  finally {
    memproses.value = false
  }
}
</script>

<template>
  <section class="registration panel">
    <div class="eyebrow">{{ t.eyebrow }}</div>

    <dl class="mb-4">
      <div class="flex justify-between border-b border-cc-stone-200 py-2 text-sm">
        <dt class="text-cc-stone-600">{{ t.biaya }}</dt>
        <dd class="font-semibold text-cc-green-800">{{ rupiah(event.harga) }}</dd>
      </div>
      <div class="flex justify-between py-2 text-sm">
        <dt class="text-cc-stone-600">{{ t.kuota }}</dt>
        <dd>{{ event.sisaKuota === null ? t.takTerbatas : t.sisa(event.sisaKuota) }}</dd>
      </div>
    </dl>

    <UAlert
      v-if="sukses"
      color="primary"
      variant="subtle"
      icon="i-lucide-circle-check"
      :description="sukses"
    />

    <UAlert
      v-else-if="event.sudahTerdaftar"
      color="primary"
      variant="subtle"
      icon="i-lucide-circle-check"
      :description="t.sudah"
    />

    <UAlert
      v-else-if="!event.pendaftaranTerbuka"
      color="warning"
      variant="subtle"
      icon="i-lucide-info"
      :description="event.sisaKuota === 0 ? t.penuh : t.ditutup"
    />

    <!-- Jalur 1: sudah ada sesi -> tinggal konfirmasi -->
    <div v-else-if="user" class="space-y-4">
      <div class="rounded-lg border border-cc-stone-200 bg-cc-stone-50 p-4">
        <p class="text-xs uppercase tracking-wider text-cc-stone-500">{{ t.sebagai }}</p>
        <p class="mt-1 font-semibold text-cc-green-800">{{ user.fullName }}</p>
        <p class="text-sm text-cc-stone-600">{{ user.email }}</p>
      </div>

      <UAlert v-if="galat" color="error" variant="subtle" icon="i-lucide-triangle-alert" :description="galat" />

      <UButton color="secondary" size="lg" block @click="bukaKonfirmasi">
        {{ t.daftarSekarang }}
      </UButton>

      <UButton color="neutral" variant="ghost" size="sm" block @click="keluar()">
        {{ t.ganti }}
      </UButton>
    </div>

    <!-- Jalur 2: tanpa akun -> formulir, dengan pintasan akun di bawahnya -->
    <template v-else>
      <UForm :state="form" class="space-y-4" @submit="bukaKonfirmasi">
        <UFormField :label="t.nama" name="nama" required>
          <UInput v-model="form.nama" required class="w-full" />
        </UFormField>
        <UFormField :label="t.email" name="email" required>
          <UInput v-model="form.email" type="email" required class="w-full" />
        </UFormField>
        <UFormField :label="t.noHp" name="noHp" :hint="t.opsional">
          <UInput v-model="form.noHp" placeholder="08xx xxxx xxxx" class="w-full" />
        </UFormField>
        <UFormField :label="t.institusi" name="institusi" :hint="t.opsional">
          <UInput v-model="form.institusi" class="w-full" />
        </UFormField>

        <UAlert v-if="galat" color="error" variant="subtle" icon="i-lucide-triangle-alert" :description="galat" />

        <UButton type="submit" color="secondary" size="lg" block>
          {{ t.kirim }}
        </UButton>
      </UForm>

      <!-- Sengaja DI BAWAH tombol kirim: mendaftar tanpa akun tetap jalan utamanya,
           ini pintasan bagi yang sudah punya akun. -->
      <div class="mt-5 space-y-3 rounded-lg border border-cc-brown-200 bg-cc-brown-50 p-4">
        <div>
          <p class="text-sm font-semibold text-cc-green-800">{{ t.cepatJudul }}</p>
          <p class="text-xs text-cc-stone-600">{{ t.cepatIntro }}</p>
        </div>

        <UFormField :label="t.email" size="sm">
          <UInput v-model="cepat.email" type="email" autocomplete="email" class="w-full" />
        </UFormField>
        <UFormField :label="t.password" size="sm">
          <UInput
            v-model="cepat.password"
            type="password"
            autocomplete="current-password"
            class="w-full"
            @keyup.enter="periksaAkun"
          />
        </UFormField>

        <UAlert v-if="galatPeriksa" color="error" variant="subtle" icon="i-lucide-triangle-alert" :description="galatPeriksa" />

        <UButton
          color="neutral"
          variant="outline"
          block
          :loading="memeriksa"
          :disabled="!cepat.email || !cepat.password"
          @click="periksaAkun"
        >
          {{ memeriksa ? t.memeriksa : t.periksa }}
        </UButton>
      </div>
    </template>
  </section>

  <!-- Satu-satunya modal di alur ini: konfirmasi terakhir, dipakai kedua jalur. -->
  <UModal v-model:open="konfirmasiOpen" :title="t.konfirmasiJudul" :description="t.konfirmasiIntro">
    <template #body>
      <div class="space-y-4">
        <dl class="divide-y divide-cc-stone-200 rounded-lg border border-cc-stone-200 bg-cc-stone-50 px-4">
          <div class="py-3">
            <dt class="text-xs uppercase tracking-wider text-cc-stone-500">{{ t.acara }}</dt>
            <dd class="mt-1 font-semibold text-cc-green-800">{{ judulEvent }}</dd>
          </div>
          <div class="py-3">
            <dt class="text-xs uppercase tracking-wider text-cc-stone-500">{{ t.nama }}</dt>
            <dd class="mt-1 font-semibold text-cc-green-800">{{ calon.nama }}</dd>
          </div>
          <div class="py-3">
            <dt class="text-xs uppercase tracking-wider text-cc-stone-500">{{ t.email }}</dt>
            <dd class="mt-1 text-sm text-cc-stone-600">{{ calon.email }}</dd>
          </div>
          <div class="flex items-center justify-between py-3">
            <dt class="text-xs uppercase tracking-wider text-cc-stone-500">{{ t.biaya }}</dt>
            <dd class="font-semibold text-cc-green-800">{{ rupiah(event.harga) }}</dd>
          </div>
        </dl>

        <UAlert v-if="galat" color="error" variant="subtle" icon="i-lucide-triangle-alert" :description="galat" />
      </div>
    </template>

    <template #footer>
      <div class="flex w-full gap-3">
        <UButton
          color="neutral"
          variant="outline"
          class="flex-1 justify-center"
          :disabled="memproses"
          @click="konfirmasiOpen = false"
        >
          {{ t.cekLagi }}
        </UButton>
        <UButton
          color="secondary"
          class="flex-1 justify-center"
          :loading="memproses"
          @click="daftar"
        >
          {{ memproses ? t.memprosesLabel : t.kirimAkhir }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
