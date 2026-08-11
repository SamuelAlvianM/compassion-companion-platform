<script setup lang="ts">
const sent = ref(false)
const route = useRoute()
const eventsPath = computed(() => route.path.startsWith('/en') ? '/en/events' : '/id/events')
const isEn = computed(() => route.path.startsWith('/en'))

useSeoMeta({
  title: 'Leadership with Compassion',
  description: () => isEn.value
    ? 'A one-day workshop in Jakarta, 12 August 2026, on growing into leadership that is present and compassionate. Registration open without an account.'
    : 'Lokakarya satu hari di Jakarta, 12 Agustus 2026, untuk bertumbuh dalam kepemimpinan yang hadir dan penuh kasih. Pendaftaran terbuka tanpa akun.',
})

const SLUG = 'leadership-with-compassion'
const form = reactive({ nama: '', whatsapp: '', email: '', setuju: false })

// Panel kanan punya dua wajah: formulir tamu (bawaan) dan formulir akun. Yang
// kedua menggantikan isi kontainer yang sama, bukan membuka modal — supaya orang
// tidak kehilangan konteks halaman event yang sedang dibacanya.
const mode = ref<'tamu' | 'akun'>('tamu')
const akun = reactive({ email: '', password: '' })

const { user, masuk, keluar } = useAuth()
const memproses = ref(false)
const memeriksa = ref(false)
const galat = ref('')
const konfirmasi = ref(false)

const pesan = (e: any, bawaan: string) =>
  e?.data?.statusMessage || e?.statusMessage || bawaan

/** Langkah 1: pastikan dulu akunnya benar, tampilkan nama & emailnya. */
const periksaAkun = async () => {
  if (!akun.email || !akun.password) return
  galat.value = ''
  memeriksa.value = true
  try {
    await masuk(akun.email, akun.password)
    akun.password = ''
    konfirmasi.value = true
  }
  catch (e: any) { galat.value = pesan(e, teks.value.gagalPeriksa) }
  finally { memeriksa.value = false }
}

/** "Cek lagi" — keluar dari sesi supaya akun lain bisa dicoba. */
const cekLagi = async () => {
  konfirmasi.value = false
  await keluar()
  akun.password = ''
}

/** Langkah 2: daftar. Body kosong — server mengambil identitas dari sesi. */
const daftarDenganAkun = async () => {
  galat.value = ''
  memproses.value = true
  try {
    await $fetch(`/api/events/${SLUG}/register`, { method: 'POST', body: {} })
    konfirmasi.value = false
    sent.value = true
  }
  catch (e: any) { galat.value = pesan(e, teks.value.gagalDaftar) }
  finally { memproses.value = false }
}

/** Pendaftaran tamu — kini benar-benar tersimpan, tidak lagi berhenti di state lokal. */
const kirimTamu = async () => {
  galat.value = ''
  memproses.value = true
  try {
    await $fetch(`/api/events/${SLUG}/register`, {
      method: 'POST',
      body: { nama: form.nama, email: form.email, noHp: form.whatsapp },
    })
    sent.value = true
  }
  catch (e: any) { galat.value = pesan(e, teks.value.gagalDaftar) }
  finally { memproses.value = false }
}

const teks = computed(() => isEn.value
  ? {
      breadcrumb: 'Events', fase: 'Upcoming', eyebrow: '12 August 2026 · Jakarta',
      intro: 'A one-day workshop for growing into leadership that is present and full of care.',
      infoJudul: 'Event information', tanggal: 'Date', waktu: 'Time', lokasi: 'Location',
      tanggalNilai: 'Wednesday, 12 August 2026', waktuNilai: '09.00 – 16.30 WIB',
      lokasiNilai: 'Jakarta · St. Ignatius Retreat House',
      ajakan: 'Finding a more present way to lead.',
      ajakanIsi: 'Through reflection, dialogue, and practical exercises, participants develop a compassionate presence to accompany others more wisely amid change.',
      daftarEyebrow: 'Register without an account', daftarJudul: 'Join us.',
      daftarIsi: 'Fill in the details below. An admin will contact you about payment and event coordination.',
      nama: 'Full name', namaPh: 'Your name', wa: 'WhatsApp number', email: 'Email',
      setuju: 'I agree to my data being used for event coordination.',
      kirim: 'Send registration',
      punyaAkun: 'Already have an account', daftarAkun: 'Register with your account',
      akunEyebrow: 'Register with an account', akunJudul: 'Sign in first.',
      akunIsi: 'Enter the email and password of the account you registered with.',
      password: 'Password', periksa: 'Check account', memeriksa: 'Checking…',
      gagalPeriksa: 'Email or password is incorrect.', gagalDaftar: 'Registration failed.',
      kembaliTamu: 'Register without an account instead',
      konfirmasiJudul: 'Confirm registration', konfirmasiIsi: 'You will be registered as:',
      cekLagi: 'Check again', daftarSekarang: 'Register now',
      terimaEyebrow: 'Registration received', terimaJudul: 'Thank you.',
      terimaIsi: 'We have recorded your details. An admin will contact you shortly via WhatsApp or email.',
      kembali: 'Back to events',
    }
  : {
      breadcrumb: 'Events', fase: 'Mendatang', eyebrow: '12 Agustus 2026 · Jakarta',
      intro: 'Lokakarya satu hari untuk bertumbuh dalam kepemimpinan yang hadir dan penuh kasih.',
      infoJudul: 'Informasi acara', tanggal: 'Tanggal', waktu: 'Waktu', lokasi: 'Lokasi',
      tanggalNilai: 'Rabu, 12 Agustus 2026', waktuNilai: '09.00 – 16.30 WIB',
      lokasiNilai: 'Jakarta · Rumah Retret St. Ignatius',
      ajakan: 'Menemukan cara memimpin yang lebih hadir.',
      ajakanIsi: 'Melalui refleksi, dialog, dan latihan praktis, peserta diajak mengembangkan kehadiran yang penuh belas kasih untuk mendampingi orang lain dengan lebih bijaksana di tengah perubahan.',
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
      konfirmasiJudul: 'Konfirmasi pendaftaran', konfirmasiIsi: 'Anda akan terdaftar sebagai:',
      cekLagi: 'Cek lagi', daftarSekarang: 'Daftar Sekarang',
      terimaEyebrow: 'Pendaftaran diterima', terimaJudul: 'Terima kasih.',
      terimaIsi: 'Data Anda telah kami catat. Admin akan segera menghubungi Anda melalui WhatsApp atau email.',
      kembali: 'Kembali ke event',
    })
</script>

<template>
  <main class="event-page">
    <div class="container">
      <div class="page-head">
        <nav class="breadcrumb">
          <NuxtLink :to="eventsPath">{{ teks.breadcrumb }}</NuxtLink><span>›</span><span>{{ teks.fase }}</span>
        </nav>
        <div class="eyebrow">{{ teks.eyebrow }}</div>
        <h1>Leadership with Compassion</h1>
        <p>{{ teks.intro }}</p>
      </div>

      <div class="event-detail-grid">
        <section class="event-overview">
          <img src="/images/leadership-with-compassion.png" alt="Leadership with Compassion">
          <div class="event-information panel">
            <div class="eyebrow">{{ teks.infoJudul }}</div>
            <dl>
              <div><dt>{{ teks.tanggal }}</dt><dd>{{ teks.tanggalNilai }}</dd></div>
              <div><dt>{{ teks.waktu }}</dt><dd>{{ teks.waktuNilai }}</dd></div>
              <div><dt>{{ teks.lokasi }}</dt><dd>{{ teks.lokasiNilai }}</dd></div>
            </dl>
            <h2>{{ teks.ajakan }}</h2>
            <p class="muted">{{ teks.ajakanIsi }}</p>
          </div>
        </section>

        <section class="registration panel">
          <!-- Wajah 1: pendaftaran tamu -->
          <div v-if="!sent && mode === 'tamu'">
            <div class="eyebrow">{{ teks.daftarEyebrow }}</div>
            <h2 class="section-title">{{ teks.daftarJudul }}</h2>
            <p class="muted">{{ teks.daftarIsi }}</p>

            <UForm :state="form" class="mt-5 space-y-4" @submit="kirimTamu">
              <UFormField :label="teks.nama" name="nama" required>
                <UInput v-model="form.nama" :placeholder="teks.namaPh" required class="w-full" />
              </UFormField>
              <UFormField :label="teks.wa" name="whatsapp" required>
                <UInput v-model="form.whatsapp" placeholder="08xx xxxx xxxx" required class="w-full" />
              </UFormField>
              <UFormField :label="teks.email" name="email" required>
                <UInput v-model="form.email" type="email" placeholder="nama@email.com" required class="w-full" />
              </UFormField>
              <UCheckbox v-model="form.setuju" required :label="teks.setuju" />

              <UAlert v-if="galat" color="error" variant="subtle" icon="i-lucide-triangle-alert" :description="galat" />

              <UButton type="submit" color="secondary" size="lg" block :loading="memproses" :disabled="!form.setuju">
                {{ teks.kirim }}
              </UButton>
            </UForm>

            <!-- Pemisah + jalur akun, di bawah tombol kirim -->
            <USeparator :label="teks.punyaAkun" class="my-5" />

            <UButton color="neutral" variant="outline" size="lg" block @click="mode = 'akun'; galat = ''">
              {{ teks.daftarAkun }}
            </UButton>
          </div>

          <!-- Wajah 2: masuk dengan akun, menggantikan isi kontainer yang sama -->
          <div v-else-if="!sent && mode === 'akun'">
            <div class="eyebrow">{{ teks.akunEyebrow }}</div>
            <h2 class="section-title">{{ teks.akunJudul }}</h2>
            <p class="muted">{{ teks.akunIsi }}</p>

            <div class="mt-5 space-y-4">
              <UFormField :label="teks.email" required>
                <UInput v-model="akun.email" type="email" autocomplete="email" placeholder="nama@email.com" class="w-full" />
              </UFormField>
              <UFormField :label="teks.password" required>
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
                {{ memeriksa ? teks.memeriksa : teks.periksa }}
              </UButton>

              <UButton color="neutral" variant="ghost" size="sm" block @click="mode = 'tamu'; galat = ''">
                {{ teks.kembaliTamu }}
              </UButton>
            </div>
          </div>

          <div v-else>
            <div class="eyebrow">{{ teks.terimaEyebrow }}</div>
            <h2 class="section-title">{{ teks.terimaJudul }}</h2>
            <p class="muted">{{ teks.terimaIsi }}</p>
            <UButton :to="eventsPath" color="secondary" class="mt-4" leading-icon="i-lucide-arrow-left">
              {{ teks.kembali }}
            </UButton>
          </div>
        </section>
      </div>
    </div>

    <!-- Konfirmasi: siapa yang akan tercatat. Dua langkah, bukan langsung daftar,
         supaya orang sempat melihat kalau perangkatnya masih memegang akun lain. -->
    <UModal v-model:open="konfirmasi" :title="teks.konfirmasiJudul">
      <template #body>
        <p class="text-sm text-cc-stone-600">{{ teks.konfirmasiIsi }}</p>
        <div class="mt-3 rounded-lg border border-cc-stone-200 bg-cc-stone-50 p-4">
          <p class="font-semibold text-cc-green-800">{{ user?.fullName }}</p>
          <p class="text-sm text-cc-stone-600">{{ user?.email }}</p>
        </div>
        <UAlert v-if="galat" color="error" variant="subtle" class="mt-3" icon="i-lucide-triangle-alert" :description="galat" />
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="outline" @click="cekLagi">{{ teks.cekLagi }}</UButton>
          <UButton color="secondary" :loading="memproses" @click="daftarDenganAkun">{{ teks.daftarSekarang }}</UButton>
        </div>
      </template>
    </UModal>
  </main>
</template>
