<script setup lang="ts">
// Modal pendaftaran event.
//
// Dua jalur, sesuai keadaan sesi:
//   sudah login -> tidak ada formulir. Data diambil dari akun, cukup satu klik.
//   tamu        -> formulir nama/email/no HP, dengan tawaran masuk untuk mempercepat.

interface EventRingkas {
  slug: string
  judul: string
  judulEn: string | null
  tanggalMulai: string
  harga: number
  sisaKuota: number | null
  pendaftaranTerbuka: boolean
}

const props = defineProps<{ event: EventRingkas | null, isEn: boolean }>()
const emit = defineEmits<{ 'update:open': [boolean], berhasil: [] }>()
const open = defineModel<boolean>('open', { default: false })

const { user, masuk, keluar } = useAuth()
const route = useRoute()

const form = reactive({ nama: '', email: '', noHp: '', institusi: '', catatan: '' })
const memproses = ref(false)
const galat = ref('')
const sukses = ref('')

const t = computed(() => props.isEn
  ? {
      judul: 'Register for this event', satuKlik: 'One-click registration',
      sebagai: 'You are signed in as', konfirmasi: 'Confirm registration',
      tamuJudul: 'Register as a guest', tamuIntro: 'Fill in your details below.',
      punyaAkun: 'Have an account? Sign in to register in one click.', masuk: 'Sign in',
      nama: 'Full name', email: 'Email', noHp: 'WhatsApp number', institusi: 'Institution',
      catatan: 'Notes', opsional: 'optional', kirim: 'Send registration',
      memproses: 'Sending…', gagal: 'Registration failed', tutup: 'Close', gratis: 'Free',
      penuh: 'This event is full.', ditutup: 'Registration is closed for this event.',
      cepatJudul: 'Already have an account?',
      cepatIntro: 'Enter your email and password — we will fill in the rest.',
      password: 'Password', periksa: 'Check account', memeriksa: 'Checking…',
      gagalPeriksa: 'Email or password is incorrect.',
      terperiksa: 'Account found', daftarSekarang: 'Register now', ganti: 'Use another account',
    }
  : {
      judul: 'Daftar event ini', satuKlik: 'Pendaftaran satu klik',
      sebagai: 'Anda masuk sebagai', konfirmasi: 'Konfirmasi pendaftaran',
      tamuJudul: 'Daftar sebagai tamu', tamuIntro: 'Isi data Anda di bawah ini.',
      punyaAkun: 'Sudah punya akun? Masuk untuk mendaftar cukup satu klik.', masuk: 'Masuk',
      nama: 'Nama lengkap', email: 'Email', noHp: 'Nomor WhatsApp', institusi: 'Institusi',
      catatan: 'Catatan', opsional: 'opsional', kirim: 'Kirim pendaftaran',
      memproses: 'Mengirim…', gagal: 'Pendaftaran gagal', tutup: 'Tutup', gratis: 'Gratis',
      penuh: 'Kegiatan ini sudah penuh.', ditutup: 'Pendaftaran kegiatan ini sudah ditutup.',
      cepatJudul: 'Sudah punya akun?',
      cepatIntro: 'Masukkan email dan password — sisanya kami isikan.',
      password: 'Password', periksa: 'Periksa akun', memeriksa: 'Memeriksa…',
      gagalPeriksa: 'Email atau password salah.',
      terperiksa: 'Akun ditemukan', daftarSekarang: 'Daftar sekarang', ganti: 'Pakai akun lain',
    })

const judulEvent = computed(() =>
  props.isEn ? (props.event?.judulEn ?? props.event?.judul ?? '') : (props.event?.judul ?? ''),
)

const rupiah = (n: number) =>
  n === 0 ? t.value.gratis : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

// Setiap kali modal dibuka untuk event lain, kembalikan ke keadaan bersih.
watch(open, (terbuka) => {
  if (!terbuka) return
  galat.value = ''
  sukses.value = ''
  Object.assign(form, { nama: '', email: '', noHp: '', institusi: '', catatan: '' })
  Object.assign(cepat, { email: '', password: '' })
  galatPeriksa.value = ''
})

// ── Jalur cepat: masuk dari dalam modal ──────────────────────────────────────
// Alurnya sengaja dua langkah: periksa dulu, lalu daftar. Langsung mendaftar
// setelah password benar akan membuat orang mendaftar tanpa sempat melihat nama
// dan email siapa yang akan tercatat — dan itu yang paling sering salah, mis.
// saat memakai akun pasangan atau rekan kerja di perangkat yang sama.
const cepat = reactive({ email: '', password: '' })
const memeriksa = ref(false)
const galatPeriksa = ref('')

const periksaAkun = async () => {
  if (!cepat.email || !cepat.password) return
  galatPeriksa.value = ''
  memeriksa.value = true
  try {
    // `masuk()` menerima username ATAU email — endpoint login memang menerima
    // keduanya di field yang sama.
    await masuk(cepat.email, cepat.password)
    // Sesi kini terbentuk; useAuth().user terisi dan template beralih sendiri ke
    // kartu konfirmasi berisi nama & email pemilik akun.
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
  if (!props.event) return
  galat.value = ''
  memproses.value = true
  try {
    // Saat sudah login, body sengaja dibiarkan kosong — server yang mengambil
    // nama & email dari akun, jadi data peserta tidak bisa dipalsukan dari klien.
    const body = user.value ? {} : { ...form }
    const hasil = await $fetch<{ message: string }>(`/api/events/${props.event.slug}/register`, {
      method: 'POST',
      body,
    })
    sukses.value = hasil.message
    emit('berhasil')
  } catch (error: any) {
    galat.value = error?.data?.statusMessage || error?.statusMessage || t.value.gagal
  } finally {
    memproses.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="t.judul" :description="judulEvent">
    <template #body>
      <div v-if="!event" />

      <div v-else-if="sukses" class="space-y-4">
        <UAlert color="primary" variant="subtle" icon="i-lucide-circle-check" :description="sukses" />
        <UButton color="neutral" variant="outline" block @click="open = false">{{ t.tutup }}</UButton>
      </div>

      <div v-else-if="!event.pendaftaranTerbuka" class="space-y-4">
        <UAlert
          color="warning"
          variant="subtle"
          icon="i-lucide-info"
          :description="event.sisaKuota === 0 ? t.penuh : t.ditutup"
        />
        <UButton color="neutral" variant="outline" block @click="open = false">{{ t.tutup }}</UButton>
      </div>

      <!-- Jalur 1: sudah login -> satu klik -->
      <div v-else-if="user" class="space-y-4">
        <UBadge color="primary" variant="subtle">{{ t.terperiksa }}</UBadge>

        <div class="rounded-lg border border-cc-stone-200 bg-cc-stone-50 p-4">
          <p class="text-xs uppercase tracking-wider text-cc-stone-500">{{ t.sebagai }}</p>
          <p class="mt-1 font-semibold text-cc-green-800">{{ user.fullName }}</p>
          <p class="text-sm text-cc-stone-600">{{ user.email }}</p>
        </div>

        <div class="flex items-center justify-between text-sm">
          <span class="text-cc-stone-600">{{ isEn ? 'Fee' : 'Biaya' }}</span>
          <strong class="text-cc-green-800">{{ rupiah(event.harga) }}</strong>
        </div>

        <UAlert v-if="galat" color="error" variant="subtle" icon="i-lucide-triangle-alert" :description="galat" />

        <UButton
          color="secondary"
          size="lg"
          block
          :loading="memproses"
          @click="daftar"
        >
          {{ memproses ? t.memproses : t.daftarSekarang }}
        </UButton>

        <UButton color="neutral" variant="ghost" size="sm" block @click="keluar()">
          {{ t.ganti }}
        </UButton>
      </div>

      <!-- Jalur 2: tamu -> formulir -->
      <div v-else class="space-y-4">
        <UForm :state="form" class="space-y-4" @submit="daftar">
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

          <div class="flex items-center justify-between text-sm">
            <span class="text-cc-stone-600">{{ isEn ? 'Fee' : 'Biaya' }}</span>
            <strong class="text-cc-green-800">{{ rupiah(event.harga) }}</strong>
          </div>

          <UAlert v-if="galat" color="error" variant="subtle" icon="i-lucide-triangle-alert" :description="galat" />

          <UButton type="submit" color="secondary" size="lg" block :loading="memproses">
            {{ memproses ? t.memproses : t.kirim }}
          </UButton>
        </UForm>

        <!-- Jalur cepat, sengaja DI BAWAH tombol kirim: pendaftaran tamu tetap
             jalan utamanya, ini pintasan bagi yang sudah punya akun. -->
        <div class="space-y-3 rounded-lg border border-cc-brown-200 bg-cc-brown-50 p-4">
          <div>
            <p class="text-sm font-semibold text-cc-green-800">{{ t.cepatJudul }}</p>
            <p class="text-xs text-cc-stone-600">{{ t.cepatIntro }}</p>
          </div>

          <UFormField :label="t.email" size="sm">
            <UInput v-model="cepat.email" type="email" autocomplete="email" class="w-full" />
          </UFormField>
          <UFormField :label="t.password" size="sm">
            <UInput v-model="cepat.password" type="password" autocomplete="current-password" class="w-full" @keyup.enter="periksaAkun" />
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
      </div>
    </template>
  </UModal>
</template>
