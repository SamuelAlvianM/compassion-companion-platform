<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { masuk, muat, user } = useAuth()

const isEn = computed(() => route.path.startsWith('/en'))
const localized = (path: string) => `${isEn.value ? '/en' : '/id'}${path}`

const teks = computed(() => isEn.value
  ? {
      eyebrow: 'Sign in', judul: 'Welcome back.',
      intro: 'Sign in to register for events in one click and open participant materials.',
      username: 'Username or email', usernamePh: 'username or email',
      password: 'Password', passwordPh: 'Your password',
      lihat: 'Show password', sembunyikan: 'Hide password',
      capsLock: 'Caps Lock is on',
      kirim: 'Sign in', memproses: 'Signing in…',
      kembali: 'Back to home', gagal: 'Sign-in failed',
      sudah: 'You are already signed in as',
      keluarDulu: 'Go to dashboard',
    }
  : {
      eyebrow: 'Masuk', judul: 'Selamat datang kembali.',
      intro: 'Masuk untuk mendaftar event dengan satu klik dan membuka materi peserta.',
      username: 'Username atau email', usernamePh: 'username atau email',
      password: 'Password', passwordPh: 'Password Anda',
      lihat: 'Tampilkan password', sembunyikan: 'Sembunyikan password',
      capsLock: 'Caps Lock sedang aktif',
      kirim: 'Masuk', memproses: 'Sedang masuk…',
      kembali: 'Kembali ke beranda', gagal: 'Gagal masuk',
      sudah: 'Anda sudah masuk sebagai',
      keluarDulu: 'Ke dashboard',
    })

useSeoMeta({
  title: () => (isEn.value ? 'Sign in' : 'Masuk'),
  description: () => teks.value.intro,
  robots: 'noindex, nofollow',
})

const form = reactive({ username: '', password: '' })
const memproses = ref(false)
const galat = ref('')
const lihatPassword = ref(false)

// Caps Lock hanya bisa dideteksi dari event keyboard — tidak ada API untuk
// menanyakan keadaannya. Karena itu peringatan baru muncul setelah tombol pertama
// ditekan, dan dibersihkan saat field kehilangan fokus.
const capsLock = ref(false)
const cekCapsLock = (e: KeyboardEvent) => {
  capsLock.value = e.getModifierState?.('CapsLock') ?? false
}

await muat()

/** Ke mana diarahkan setelah berhasil masuk. */
const tujuan = computed(() => {
  const redirect = route.query.redirect
  if (typeof redirect === 'string' && redirect.startsWith('/')) return redirect
  return null
})

const kirim = async () => {
  galat.value = ''
  memproses.value = true
  try {
    const hasil = await masuk(form.username, form.password)
    // Staf (level <= 3) diarahkan ke area admin; peserta biasa kembali ke beranda.
    const bawaan = hasil.role === 'user' ? localized('/') : '/admin'
    await router.push(tujuan.value ?? bawaan)
  } catch (error: any) {
    galat.value = error?.data?.statusMessage || error?.statusMessage || teks.value.gagal
  } finally {
    memproses.value = false
  }
}
</script>

<template>
  <main class="event-page">
    <div class="container">
      <div class="mx-auto max-w-md">
        <div class="page-head">
          <div class="eyebrow">{{ teks.eyebrow }}</div>
          <h1>{{ teks.judul }}</h1>
          <p>{{ teks.intro }}</p>
        </div>

        <UCard :ui="{ body: 'p-7' }">
          <div v-if="user" class="space-y-4">
            <p class="text-sm text-cc-stone-600">
              {{ teks.sudah }} <strong class="text-cc-green-800">{{ user.fullName }}</strong>
              <UBadge class="ml-2" color="secondary" variant="subtle" size="sm">{{ user.role }}</UBadge>
            </p>
            <UButton
              :to="user.role === 'user' ? localized('/events') : '/admin'"
              color="secondary"
              block
              size="lg"
            >
              {{ user.role === 'user' ? (isEn ? 'Browse events' : 'Lihat event') : teks.keluarDulu }}
            </UButton>
          </div>

          <UForm v-else :state="form" class="space-y-5" @submit="kirim">
            <UFormField :label="teks.username" name="username" required>
              <UInput
                v-model="form.username"
                :placeholder="teks.usernamePh"
                autocomplete="username"
                required
                class="w-full"
              />
            </UFormField>

            <UFormField :label="teks.password" name="password" required>
              <UInput
                v-model="form.password"
                :type="lihatPassword ? 'text' : 'password'"
                :placeholder="teks.passwordPh"
                autocomplete="current-password"
                required
                class="w-full"
                :ui="{ trailing: 'pe-1' }"
                @keyup="cekCapsLock"
                @keydown="cekCapsLock"
                @blur="capsLock = false"
              >
                <template #trailing>
                  <UButton
                    color="neutral"
                    variant="link"
                    size="sm"
                    :icon="lihatPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                    :aria-label="lihatPassword ? teks.sembunyikan : teks.lihat"
                    :aria-pressed="lihatPassword"
                    tabindex="-1"
                    @click="lihatPassword = !lihatPassword"
                  />
                </template>
              </UInput>

              <p
                v-if="capsLock"
                class="mt-2 flex items-center gap-1.5 text-xs font-semibold text-cc-brown-700"
                role="status"
              >
                <UIcon name="i-lucide-arrow-big-up" class="size-4" />
                {{ teks.capsLock }}
              </p>
            </UFormField>

            <UAlert
              v-if="galat"
              color="error"
              variant="subtle"
              icon="i-lucide-triangle-alert"
              :title="teks.gagal"
              :description="galat"
            />

            <UButton
              type="submit"
              color="secondary"
              size="lg"
              block
              :loading="memproses"
              icon="i-lucide-log-in"
            >
              {{ memproses ? teks.memproses : teks.kirim }}
            </UButton>
          </UForm>
        </UCard>

        <UButton
          :to="localized('/')"
          color="neutral"
          variant="link"
          leading-icon="i-lucide-arrow-left"
          class="mt-4"
        >
          {{ teks.kembali }}
        </UButton>
      </div>
    </div>
  </main>
</template>
