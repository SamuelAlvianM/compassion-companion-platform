<script setup lang="ts">
// Panel pendaftaran event — menempel di halaman detail, bukan di dalam modal.
//
// Satu kontainer, tiga wajah yang bergantian:
//
//   tamu    -> "Mari bergabung."  formulir nama/WhatsApp/email + persetujuan
//   akun    -> "Masuk dulu."      email + password, lalu identitasnya dipakai
//   terima  -> "Terima kasih."    setelah pendaftaran tercatat
//
// Keduanya tidak pernah tampil bersamaan. Menumpuk dua formulir sekaligus memaksa
// orang memilih sebelum membaca, dan panel yang memanjang membuat jalan utamanya —
// mendaftar tanpa akun — terlihat sama beratnya dengan pintasan.
//
// Modal dipakai untuk satu hal saja: konfirmasi terakhir. Nama dan email yang akan
// tercatat diperlihatkan sekali lagi di luar formulir, tempat orang sudah berhenti
// mengetik dan mulai membaca — yang paling sering salah adalah perangkat yang masih
// memegang akun orang lain.

interface EventRingkas {
  slug: string
  judul: string
  judulEn: string | null
  // Dipakai hanya untuk membedakan "penuh" dari "ditutup" pada pesan; angkanya
  // sendiri tidak ditampilkan.
  sisaKuota: number | null
  pendaftaranTerbuka: boolean
  sudahTerdaftar?: boolean
  /** Ditampilkan pada dua keadaan: sebagai tenggat saat masih terbuka, dan sebagai
      alasan saat sudah tertutup. */
  tutupPendaftaran?: string | null
}

const props = defineProps<{ event: EventRingkas, isEn: boolean }>()
const emit = defineEmits<{ berhasil: [] }>()

const { user, masuk, keluar } = useAuth()
const route = useRoute()
const base = computed(() => route.path.startsWith('/en') ? '/en' : '/id')

type Mode = 'tamu' | 'akun'
const mode = ref<Mode>('tamu')

const form = reactive({ nama: '', whatsapp: '', email: '', setuju: false })
const akun = reactive({ email: '', password: '' })

const konfirmasiOpen = ref(false)
const memproses = ref(false)
const memeriksa = ref(false)
const galat = ref('')
const terkirim = ref(false)

const t = computed(() => props.isEn
  ? {
      daftarEyebrow: 'Registration without an account', daftarJudul: 'Join us.',
      daftarIsi: 'Fill in the details below. An admin will contact you about payment and event coordination.',
      nama: 'Full name', namaPh: 'Your name', wa: 'WhatsApp number', email: 'Email',
      setuju: 'I agree to my data being used for event coordination.',
      kirim: 'Send registration',
      punyaAkun: 'Already have an account', daftarAkun: 'Register with an account',
      akunEyebrow: 'Registration with an account', akunJudul: 'Sign in first.',
      akunIsi: 'Enter the email and password of the account you registered with.',
      password: 'Password', periksa: 'Check account', memeriksa: 'Checking…',
      gagalPeriksa: 'Email or password is incorrect.', gagalDaftar: 'Registration failed.',
      kembaliTamu: 'Register without an account instead',
      sebagai: 'You are signed in as', daftarSekarang: 'Register now', ganti: 'Use another account',
      konfirmasiJudul: 'Confirm registration', konfirmasiIsi: 'You will be registered as:',
      cekLagi: 'Check again',
      terimaEyebrow: 'Registration received', terimaJudul: 'Thank you.',
      kembali: 'Back to events',
      sudahEyebrow: 'Registration', sudahJudul: 'You are on the list.',
      sudahIsi: 'You are already registered for this event.',
      tutupEyebrow: 'Registration', tutupJudul: 'Registration is closed.',
      penuh: 'This event is full.', ditutup: 'Registration is closed for this event.',
      wajib: 'Full name, WhatsApp number, and email are required.',
    }
  : {
      daftarEyebrow: 'Pendaftaran tanpa akun', daftarJudul: 'Mari bergabung.',
      daftarIsi: 'Isi data berikut. Admin akan menghubungi Anda untuk informasi pembayaran dan koordinasi acara.',
      nama: 'Nama lengkap', namaPh: 'Nama Anda', wa: 'Nomor WhatsApp', email: 'Email',
      setuju: 'Saya menyetujui penggunaan data untuk kebutuhan koordinasi event.',
      kirim: 'Kirim pendaftaran',
      punyaAkun: 'Sudah memiliki akun', daftarAkun: 'Daftar dengan akun',
      akunEyebrow: 'Pendaftaran dengan akun', akunJudul: 'Masuk dulu.',
      akunIsi: 'Masukkan email dan password akun yang Anda pakai mendaftar.',
      password: 'Password', periksa: 'Periksa akun', memeriksa: 'Memeriksa…',
      gagalPeriksa: 'Email atau password salah.', gagalDaftar: 'Pendaftaran gagal.',
      kembaliTamu: 'Daftar tanpa akun saja',
      sebagai: 'Anda masuk sebagai', daftarSekarang: 'Daftar Sekarang', ganti: 'Pakai akun lain',
      konfirmasiJudul: 'Konfirmasi pendaftaran', konfirmasiIsi: 'Anda akan terdaftar sebagai:',
      cekLagi: 'Cek lagi',
      terimaEyebrow: 'Pendaftaran diterima', terimaJudul: 'Terima kasih.',
      kembali: 'Kembali ke event',
      sudahEyebrow: 'Pendaftaran', sudahJudul: 'Anda sudah terdaftar.',
      sudahIsi: 'Anda sudah terdaftar di kegiatan ini.',
      tutupEyebrow: 'Pendaftaran', tutupJudul: 'Pendaftaran ditutup.',
      penuh: 'Kegiatan ini sudah penuh.', ditutup: 'Pendaftaran kegiatan ini sudah ditutup.',
      wajib: 'Nama lengkap, nomor WhatsApp, dan email wajib diisi.',
    })

/** Tenggat pendaftaran, hanya untuk event yang pendaftarannya masih terbuka. */
const tenggat = computed(() => props.event.pendaftaranTerbuka && props.event.tutupPendaftaran
  ? `${props.isEn ? 'Register before' : 'Daftar sebelum'} ${tanggalJamSingkat(props.event.tutupPendaftaran, props.isEn)}`
  : '')

const judulEvent = computed(() =>
  props.isEn ? (props.event.judulEn ?? props.event.judul) : props.event.judul)

// Sengaja tidak memakai pesan dari server: `register.post.ts` hanya punya satu
// bahasa, dan menampilkannya apa adanya membuat halaman /en berbahasa Indonesia.
const pesanTerima = computed(() => props.isEn
  ? 'We have recorded your details. An admin will contact you shortly via WhatsApp or email.'
  : 'Data Anda telah kami catat. Admin akan segera menghubungi Anda melalui WhatsApp atau email.')

/** Yang akan benar-benar tercatat — sumbernya akun bila ada sesi, formulir bila tamu. */
const calon = computed(() => user.value
  ? { nama: user.value.fullName, email: user.value.email ?? '' }
  : { nama: form.nama, email: form.email })

const bukaKonfirmasi = () => {
  galat.value = ''
  if (!user.value && (!form.nama || !form.whatsapp || !form.email)) {
    galat.value = t.value.wajib
    return
  }
  konfirmasiOpen.value = true
}

const periksaAkun = async () => {
  if (!akun.email || !akun.password) return
  galat.value = ''
  memeriksa.value = true
  try {
    // `masuk()` menerima username ATAU email — endpoint login memang menerima
    // keduanya di field yang sama. Setelah berhasil, sesi terbentuk dan panel
    // beralih sendiri ke kartu identitas; tidak langsung mendaftar.
    await masuk(akun.email, akun.password)
    akun.password = ''
  }
  catch (error: any) {
    galat.value = error?.data?.statusMessage || error?.statusMessage || t.value.gagalPeriksa
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
    const body = user.value
      ? {}
      : { nama: form.nama, email: form.email, noHp: form.whatsapp }
    await $fetch(`/api/events/${props.event.slug}/register`, { method: 'POST', body })
    konfirmasiOpen.value = false
    terkirim.value = true
    emit('berhasil')
  }
  catch (error: any) {
    galat.value = error?.data?.statusMessage || error?.statusMessage || t.value.gagalDaftar
  }
  finally {
    memproses.value = false
  }
}

const keAkun = () => { mode.value = 'akun'; galat.value = '' }
const keTamu = () => { mode.value = 'tamu'; galat.value = '' }
</script>

<template>
  <section class="registration panel">
    <!-- Sudah tercatat -->
    <div v-if="terkirim">
      <div class="eyebrow">{{ t.terimaEyebrow }}</div>
      <h2 class="section-title">{{ t.terimaJudul }}</h2>
      <p class="muted">{{ pesanTerima }}</p>
      <UButton :to="`${base}/events`" color="secondary" class="mt-4" leading-icon="i-lucide-arrow-left">
        {{ t.kembali }}
      </UButton>
    </div>

    <div v-else-if="event.sudahTerdaftar">
      <div class="eyebrow">{{ t.sudahEyebrow }}</div>
      <h2 class="section-title">{{ t.sudahJudul }}</h2>
      <p class="muted">{{ t.sudahIsi }}</p>
    </div>

    <div v-else-if="!event.pendaftaranTerbuka">
      <div class="eyebrow">{{ t.tutupEyebrow }}</div>
      <h2 class="section-title">{{ t.tutupJudul }}</h2>
      <p class="muted">{{ event.sisaKuota === 0 ? t.penuh : t.ditutup }}</p>
      <!-- Tanggalnya disebutkan supaya "sudah ditutup" bisa dicocokkan orang dengan
           ingatannya sendiri, bukan diterima begitu saja. -->
      <p v-if="event.sisaKuota !== 0 && event.tutupPendaftaran" class="mt-1 text-sm text-cc-stone-500">
        {{ isEn ? 'Closed on' : 'Ditutup pada' }} {{ tanggalJamSingkat(event.tutupPendaftaran, isEn) }}
      </p>
    </div>

    <!-- Wajah 1: sudah ada sesi -> tinggal konfirmasi -->
    <div v-else-if="user">
      <div class="eyebrow">{{ t.akunEyebrow }}</div>
      <h2 class="section-title">{{ t.daftarJudul }}</h2>

      <div class="mt-5 rounded-lg border border-cc-stone-200 bg-cc-stone-50 p-4">
        <p class="text-xs uppercase tracking-wider text-cc-stone-500">{{ t.sebagai }}</p>
        <p class="mt-1 font-semibold text-cc-green-800">{{ user.fullName }}</p>
        <p class="text-sm text-cc-stone-600">{{ user.email }}</p>
      </div>

      <UAlert v-if="galat" color="error" variant="subtle" class="mt-4" icon="i-lucide-triangle-alert" :description="galat" />

      <UButton color="secondary" size="lg" block class="mt-4" @click="bukaKonfirmasi">
        {{ t.daftarSekarang }}
      </UButton>
      <UButton color="neutral" variant="ghost" size="sm" block class="mt-2" @click="keluar()">
        {{ t.ganti }}
      </UButton>
    </div>

    <!-- Wajah 2: pendaftaran tanpa akun -->
    <div v-else-if="mode === 'tamu'">
      <div class="eyebrow">{{ t.daftarEyebrow }}</div>
      <h2 class="section-title">{{ t.daftarJudul }}</h2>
      <p class="muted">{{ t.daftarIsi }}</p>

      <p v-if="tenggat" class="mt-3 inline-flex items-center gap-1.5 rounded-full bg-cc-stone-100 px-3 py-1 text-xs font-semibold text-cc-green-800">
        <UIcon name="i-lucide-hourglass" class="size-3.5 text-cc-brown-500" />
        {{ tenggat }}
      </p>

      <UForm :state="form" class="mt-5 space-y-4" @submit="bukaKonfirmasi">
        <UFormField :label="t.nama" name="nama" required>
          <UInput v-model="form.nama" :placeholder="t.namaPh" required class="w-full" />
        </UFormField>
        <UFormField :label="t.wa" name="whatsapp" required>
          <UInput v-model="form.whatsapp" placeholder="08xx xxxx xxxx" required class="w-full" />
        </UFormField>
        <UFormField :label="t.email" name="email" required>
          <UInput v-model="form.email" type="email" placeholder="nama@email.com" required class="w-full" />
        </UFormField>

        <UCheckbox v-model="form.setuju" required :label="t.setuju" />

        <UAlert v-if="galat" color="error" variant="subtle" icon="i-lucide-triangle-alert" :description="galat" />

        <UButton type="submit" color="secondary" size="lg" block :disabled="!form.setuju">
          {{ t.kirim }}
        </UButton>
      </UForm>

      <!-- Pemisah + jalur akun, sengaja DI BAWAH tombol kirim: mendaftar tanpa akun
           tetap jalan utamanya, ini pintasan bagi yang sudah punya akun. -->
      <USeparator :label="t.punyaAkun" class="my-5" />

      <UButton
        color="neutral"
        variant="outline"
        size="lg"
        block
        class="!border-[var(--color-line)] !bg-[var(--color-line)] !text-[var(--color-primary)] hover:!bg-[var(--color-surface-alt)]"
        @click="keAkun"
      >
        {{ t.daftarAkun }}
      </UButton>
    </div>

    <!-- Wajah 3: masuk dengan akun, menggantikan isi kontainer yang sama -->
    <div v-else>
      <div class="eyebrow">{{ t.akunEyebrow }}</div>
      <h2 class="section-title">{{ t.akunJudul }}</h2>
      <p class="muted">{{ t.akunIsi }}</p>

      <div class="mt-5 space-y-4">
        <UFormField :label="t.email" required>
          <UInput v-model="akun.email" type="email" autocomplete="email" placeholder="nama@email.com" class="w-full" />
        </UFormField>
        <UFormField :label="t.password" required>
          <UInput
            v-model="akun.password"
            type="password"
            autocomplete="current-password"
            class="w-full"
            @keyup.enter="periksaAkun"
          />
        </UFormField>

        <UAlert v-if="galat" color="error" variant="subtle" icon="i-lucide-triangle-alert" :description="galat" />

        <UButton
          color="secondary"
          size="lg"
          block
          :loading="memeriksa"
          :disabled="!akun.email || !akun.password"
          @click="periksaAkun"
        >
          {{ memeriksa ? t.memeriksa : t.periksa }}
        </UButton>

        <UButton color="neutral" variant="ghost" size="sm" block @click="keTamu">
          {{ t.kembaliTamu }}
        </UButton>
      </div>
    </div>
  </section>

  <!-- Satu-satunya modal di alur ini: konfirmasi terakhir, dipakai kedua jalur. -->
  <UModal v-model:open="konfirmasiOpen" :title="t.konfirmasiJudul">
    <template #body>
      <p class="text-sm text-cc-stone-600">{{ t.konfirmasiIsi }}</p>

      <div class="mt-3 rounded-lg border border-cc-stone-200 bg-cc-stone-50 p-4">
        <p class="font-semibold text-cc-green-800">{{ calon.nama }}</p>
        <p class="text-sm text-cc-stone-600">{{ calon.email }}</p>
        <p class="mt-2 text-xs uppercase tracking-wider text-cc-stone-500">{{ judulEvent }}</p>
      </div>

      <UAlert v-if="galat" color="error" variant="subtle" class="mt-3" icon="i-lucide-triangle-alert" :description="galat" />
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" :disabled="memproses" @click="konfirmasiOpen = false">
          {{ t.cekLagi }}
        </UButton>
        <UButton color="secondary" :loading="memproses" @click="daftar">
          {{ t.daftarSekarang }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
