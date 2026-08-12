<script setup lang="ts">
// Halaman profil, berlaku untuk SEMUA role.
//
// `?id=` memungkinkan pengelola (level <= 3) membuka profil orang lain. Tanpa
// parameter itu, halaman menampilkan profil sendiri. Pembatasannya ditegakkan di
// server (server/api/users/[id].get.ts), bukan di sini.

const route = useRoute()
const isEn = computed(() => route.path.startsWith('/en'))
const localized = (path: string) => `${isEn.value ? '/en' : '/id'}${path}`

const { user: sesi, muat } = useAuth()
await muat()

if (!sesi.value) {
  await navigateTo({ path: localized('/login'), query: { redirect: route.fullPath } })
}

const targetId = computed(() => (typeof route.query.id === 'string' ? route.query.id : 'me'))
// Tanpa `await`: await membuat komponen ini suspense, sehingga saat keluar akun
// atau berpindah bahasa halaman lama sudah hilang sementara yang baru belum boleh
// tergambar. Rangkanya sekarang muncul lebih dulu.
const { data, status, refresh } = useFetch(() => `/api/users/${targetId.value}`)

const memuatAwal = computed(() => status.value === 'pending' && !data.value)

const profil = computed(() => data.value?.user)
const sendiri = computed(() => data.value?.sendiri ?? false)
const riwayat = computed(() => data.value?.riwayat ?? [])
const ringkas = computed(() => data.value?.ringkas)
const refleksi = computed(() => data.value?.refleksi ?? [])

const t = computed(() => isEn.value
  ? {
      eyebrow: 'Profile', tab1: 'Reflections', tab2: 'Event history', tab3: 'Account settings',
      username: 'Username', nama: 'Full name', email: 'Email', hp: 'WhatsApp number',
      simpan: 'Save changes', tersimpan: 'Profile updated',
      gantiPass: 'Change password', passLama: 'Current password', passBaru: 'New password',
      passUlang: 'Repeat new password', gantiTombol: 'Update password', passTersimpan: 'Password changed',
      tidakCocok: 'New passwords do not match', minimal: 'At least 6 characters',
      lupaLama: 'I forgot my current password',
      lupaLamaIsi: 'Your current password will not be asked for. Anyone using this device while you are signed in could change it, so sign out when you are done.',
      pakaiLama: 'Enter my current password instead',
      tulis: 'Write a reflection', tulisIsi: 'What did you take away?', kirim: 'Publish',
      kegiatan: 'Related event', tanpaKegiatan: 'Not tied to an event',
      visibilitas: 'Visibility', publik: 'Public', peserta: 'Participants only', pribadi: 'Private',
      ikut: 'events joined', hadir: 'attended', menunggu: 'awaiting confirmation',
      kosongRiwayat: 'No event history yet.', lihat: 'Show', sembunyikan: 'Hide',
      kembali: 'Back to member list', bergabung: 'Joined',
    }
  : {
      eyebrow: 'Profil', tab1: 'Refleksi', tab2: 'Riwayat event', tab3: 'Pengaturan akun',
      username: 'Username', nama: 'Nama lengkap', email: 'Email', hp: 'Nomor WhatsApp',
      simpan: 'Simpan perubahan', tersimpan: 'Profil diperbarui',
      gantiPass: 'Ganti password', passLama: 'Password saat ini', passBaru: 'Password baru',
      passUlang: 'Ulangi password baru', gantiTombol: 'Ubah password', passTersimpan: 'Password berhasil diubah',
      tidakCocok: 'Password baru tidak sama', minimal: 'Minimal 6 karakter',
      lupaLama: 'Saya lupa password lama',
      lupaLamaIsi: 'Password lama tidak akan ditanyakan. Siapa pun yang memakai perangkat ini selagi Anda masih masuk bisa ikut menggantinya, jadi keluar dari akun setelah selesai.',
      pakaiLama: 'Isi password lama saja',
      tulis: 'Tulis refleksi', tulisIsi: 'Apa yang Anda bawa pulang?', kirim: 'Terbitkan',
      kegiatan: 'Kegiatan terkait', tanpaKegiatan: 'Tidak terkait kegiatan',
      visibilitas: 'Visibilitas', publik: 'Publik', peserta: 'Khusus peserta', pribadi: 'Pribadi',
      ikut: 'event diikuti', hadir: 'hadir', menunggu: 'menunggu konfirmasi',
      kosongRiwayat: 'Belum ada riwayat event.', lihat: 'Tampilkan', sembunyikan: 'Sembunyikan',
      kembali: 'Kembali ke daftar member', bergabung: 'Bergabung',
    })

useSeoMeta({
  title: () => profil.value?.fullName ?? t.value.eyebrow,
  robots: 'noindex, nofollow',
})

// Urutan tab: Pengaturan → Riwayat → Refleksi.
//
// Pengaturan di depan karena itu yang dicari orang saat membuka profilnya sendiri —
// mengganti nomor WhatsApp atau password, bukan membaca ulang refleksinya.
const tab = ref('akun')
const tabs = computed(() => [
  ...(sendiri.value ? [{ value: 'akun', label: t.value.tab3, icon: 'i-lucide-settings' }] : []),
  { value: 'riwayat', label: t.value.tab2, icon: 'i-lucide-calendar-check' },
  { value: 'refleksi', label: t.value.tab1, icon: 'i-lucide-feather' },
])

// Profil orang lain tidak punya tab Pengaturan. Tanpa penggeseran ini, membukanya
// dari /admin/members mendarat pada tab yang tidak ada di bilahnya — dan formulir
// di baliknya milik akun yang sedang dibuka, bukan akun yang membukanya.
watchEffect(() => {
  if (!sendiri.value && tab.value === 'akun') tab.value = 'riwayat'
})

// ── Edit profil ──────────────────────────────────────────────────────────────
const formProfil = reactive({ fullName: '', email: '', phoneNumber: '' })
watchEffect(() => {
  if (!profil.value || !sendiri.value) return
  formProfil.fullName = profil.value.fullName
  formProfil.email = profil.value.email ?? ''
  formProfil.phoneNumber = profil.value.phoneNumber ?? ''
})

const pesanProfil = reactive({ ok: '', galat: '' })
const simpanProfil = async () => {
  pesanProfil.ok = ''
  pesanProfil.galat = ''
  try {
    await $fetch('/api/users/me', { method: 'PATCH', body: { ...formProfil } })
    pesanProfil.ok = t.value.tersimpan
    await Promise.all([refresh(), muat(true)])
  } catch (e: any) {
    pesanProfil.galat = e?.data?.statusMessage || t.value.eyebrow
  }
}

// ── Ganti password ───────────────────────────────────────────────────────────
const formPass = reactive({ passwordLama: '', passwordBaru: '', ulangi: '' })
const lihatPass = reactive({ lama: false, baru: false })
const capsPass = ref(false)
const cekCaps = (e: KeyboardEvent) => { capsPass.value = e.getModifierState?.('CapsLock') ?? false }
const pesanPass = reactive({ ok: '', galat: '' })

/**
 * Jalan keluar untuk yang benar-benar lupa password lamanya.
 *
 * Password akun di situs ini dibuatkan admin dan dikirim lewat WhatsApp, jadi lupa
 * adalah keadaan yang lazim — dan sebelum ini satu-satunya jalannya adalah minta
 * admin. Servernya menerima `passwordLama` kosong (lihat catatan panjang di
 * server/api/users/password.post.ts soal apa yang ditukar di sini).
 *
 * Sengaja dibuat pilihan yang harus diklik, bukan kolom yang boleh dikosongkan
 * begitu saja: peringatannya perlu terbaca sekali sebelum dipakai.
 */
const lupaLama = ref(false)

const gantiPassword = async () => {
  pesanPass.ok = ''
  pesanPass.galat = ''
  if (formPass.passwordBaru !== formPass.ulangi) {
    pesanPass.galat = t.value.tidakCocok
    return
  }
  try {
    await $fetch('/api/users/password', {
      method: 'POST',
      body: {
        // Dikirim sebagai string kosong saat "lupa" dipilih — server memeriksanya
        // hanya kalau ada isinya.
        passwordLama: lupaLama.value ? '' : formPass.passwordLama,
        passwordBaru: formPass.passwordBaru,
      },
    })
    pesanPass.ok = t.value.passTersimpan
    Object.assign(formPass, { passwordLama: '', passwordBaru: '', ulangi: '' })
    lupaLama.value = false
  } catch (e: any) {
    pesanPass.galat = e?.data?.statusMessage || 'Gagal'
  }
}

// ── Tulis refleksi ───────────────────────────────────────────────────────────
// Sentinel 'tanpa', bukan string kosong. Reka UI (penyokong USelect) memesan ''
// untuk keadaan "belum dipilih" dan melempar galat begitu ada item bernilai kosong —
// galat render yang menjatuhkan seluruh halaman jadi 500, bukan sekadar merusak
// select-nya. Jebakan yang sama sudah dicatat untuk filter di halaman event.
const TANPA_KEGIATAN = 'tanpa'

const formRefleksi = reactive({ isi: '', kegiatanSlug: TANPA_KEGIATAN, visibilitas: 'publik' })
const kirimRefleksi = async () => {
  if (!formRefleksi.isi.trim()) return
  await $fetch('/api/refleksi', {
    method: 'POST',
    body: {
      isi: formRefleksi.isi,
      // Sentinel diterjemahkan balik di sini; server tidak perlu tahu soal itu.
      kegiatanSlug: formRefleksi.kegiatanSlug === TANPA_KEGIATAN ? undefined : formRefleksi.kegiatanSlug,
      visibilitas: formRefleksi.visibilitas,
    },
  })
  formRefleksi.isi = ''
  await refresh()
}

const hapusRefleksi = async (id: string) => {
  await $fetch(`/api/refleksi/${id}`, { method: 'DELETE' })
  await refresh()
}

const opsiKegiatan = computed(() => [
  { value: TANPA_KEGIATAN, label: t.value.tanpaKegiatan },
  ...riwayat.value.map((r: any) => ({ value: r.slug, label: r.judul })),
])

const opsiVisibilitas = computed(() => [
  { value: 'publik', label: t.value.publik },
  { value: 'peserta', label: t.value.peserta },
  { value: 'pribadi', label: t.value.pribadi },
])

const tanggal = (nilai: string | null) => nilai
  ? new Intl.DateTimeFormat(isEn.value ? 'en-GB' : 'id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date(nilai))
  : '—'

// Status & fase pendaftaran tidak lagi ditampilkan di riwayat: yang batal sudah
// disaring di server (server/utils/riwayat.ts), sehingga setiap baris yang sampai
// ke sini berarti hal yang sama — orang ini ikut event itu.

const inisial = computed(() =>
  (profil.value?.fullName ?? '?').split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase(),
)
</script>

<template>
  <main class="event-page profil-page">
    <!-- Kelas `profil-page` memindahkan pita hijau ke .page-head supaya tingginya
         mengikuti isi. Lihat main.css.
         Komentar ini sengaja DI DALAM <main>: komentar di tingkat akar template
         terhitung sebagai node akar kedua oleh Nuxt, dan halaman multi-akar
         berhenti tergambar saat dinavigasi dari halaman lain. -->

    <div class="container">
      <!-- Rangka profil: avatar bulat + identitas + baris statistik + bilah tab,
           mengikuti tata letak yang sesungguhnya supaya tidak ada lompatan saat
           datanya datang. -->
      <div v-if="memuatAwal" class="mx-auto max-w-4xl" aria-hidden="true">
        <div class="page-head">
          <div class="flex flex-wrap items-center gap-6">
            <USkeleton class="size-24 shrink-0 rounded-full" />
            <div class="min-w-0 flex-1">
              <USkeleton class="h-3 w-20" />
              <USkeleton class="mt-3 h-9 w-64" />
              <USkeleton class="mt-3 h-4 w-32" />
              <USkeleton class="mt-3 h-6 w-40 rounded-full" />
            </div>
          </div>
          <div class="mt-6 flex gap-8">
            <div v-for="n in 3" :key="n">
              <USkeleton class="h-3 w-24" />
              <USkeleton class="mt-2 h-8 w-12" />
            </div>
          </div>
        </div>

        <USkeleton class="mb-6 h-10 w-full max-w-md" />

        <div class="grid gap-4 sm:grid-cols-3">
          <USkeleton v-for="n in 6" :key="n" class="aspect-square w-full rounded-xl" />
        </div>
      </div>

      <div v-else-if="profil" class="mx-auto max-w-4xl">
        <UButton
          v-if="!sendiri"
          to="/admin/members"
          color="secondary"
          variant="link"
          leading-icon="i-lucide-arrow-left"
          class="mb-3 -ml-2"
        >
          {{ t.kembali }}
        </UButton>

        <!-- Kepala profil, bergaya Instagram: avatar besar + statistik sebaris -->
        <div class="page-head">
          <div class="flex flex-wrap items-center gap-6">
            <div class="grid size-24 shrink-0 place-items-center rounded-full bg-cc-brown-500 font-serif text-4xl text-cc-stone-50">
              {{ inisial }}
            </div>

            <div class="min-w-0 flex-1">
              <div class="eyebrow">{{ t.eyebrow }}</div>
              <h1 class="!mb-1 !text-4xl">{{ profil.fullName }}</h1>
              <p class="!mb-0 text-sm opacity-90">@{{ profil.username }}</p>
              <!-- Role & level tidak ditampilkan. Keduanya urusan internal
                   pengelolaan akun, bukan identitas orangnya — dan halaman ini
                   dibuka pemiliknya sendiri sama seringnya dengan pengelola. -->
              <UBadge v-if="!profil.isActive" color="error" variant="subtle" size="sm" class="mt-2">
                {{ isEn ? 'Inactive' : 'Nonaktif' }}
              </UBadge>
            </div>
          </div>

          <!-- Kontak, hanya saat pengelola membuka profil orang lain.
               Pemiliknya sendiri tidak perlu diberi tahu emailnya — ia bisa
               mengubahnya di tab Pengaturan, dan mengulanginya di kepala halaman
               hanya menduakan tempat orang mencarinya. -->
          <dl v-if="!sendiri" class="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm text-cc-stone-50">
            <div v-if="profil.email" class="flex items-center gap-2">
              <UIcon name="i-lucide-mail" class="size-4 shrink-0 opacity-70" />
              <dt class="sr-only">{{ t.email }}</dt>
              <dd class="break-all">{{ profil.email }}</dd>
            </div>
            <div v-if="profil.phoneNumber" class="flex items-center gap-2">
              <UIcon name="i-lucide-phone" class="size-4 shrink-0 opacity-70" />
              <dt class="sr-only">{{ t.hp }}</dt>
              <dd>{{ profil.phoneNumber }}</dd>
            </div>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-calendar-plus" class="size-4 shrink-0 opacity-70" />
              <dt class="sr-only">{{ t.bergabung }}</dt>
              <dd class="opacity-90">{{ t.bergabung }} {{ tanggal(profil.createdAt) }}</dd>
            </div>
          </dl>

          <!-- Tiga angka ringkasan. `total` dan `hadir` kini menghitung pendaftaran
               yang tidak dibatalkan saja — yang batal sudah disaring di server. -->
          <dl v-if="ringkas" class="mt-6 flex flex-wrap gap-8 border-t border-white/20 pt-4 text-cc-stone-50">
            <div><dt class="text-xs uppercase opacity-70">{{ t.ikut }}</dt><dd class="font-serif text-3xl">{{ ringkas.total }}</dd></div>
            <div><dt class="text-xs uppercase opacity-70">{{ t.hadir }}</dt><dd class="font-serif text-3xl">{{ ringkas.hadir }}</dd></div>
            <div><dt class="text-xs uppercase opacity-70">{{ t.tab1 }}</dt><dd class="font-serif text-3xl">{{ refleksi.length }}</dd></div>
          </dl>
        </div>

        <UTabs v-model="tab" :items="tabs" :content="false" color="secondary" variant="link" class="mb-6" />

        <!-- Refleksi -->
        <div v-if="tab === 'refleksi'" class="space-y-6">
          <!-- Form "Tulis refleksi" disembunyikan sementara atas permintaan.
               Dikomentari, bukan dihapus: endpoint POST /api/refleksi, state
               `formRefleksi`, `kirimRefleksi`, dan kedua daftar opsinya masih utuh
               di <script>, jadi mengembalikannya cukup membuka blok ini.
          <UCard v-if="sendiri" :ui="{ body: 'p-5' }">
            <UForm :state="formRefleksi" class="space-y-4" @submit="kirimRefleksi">
              <UFormField :label="t.tulis" name="isi">
                <UTextarea v-model="formRefleksi.isi" :rows="4" :placeholder="t.tulisIsi" class="w-full" />
              </UFormField>
              <div class="grid gap-3 sm:grid-cols-2">
                <UFormField :label="t.kegiatan" name="kegiatanSlug" size="sm">
                  <USelect v-model="formRefleksi.kegiatanSlug" :items="opsiKegiatan" class="w-full" />
                </UFormField>
                <UFormField :label="t.visibilitas" name="visibilitas" size="sm">
                  <USelect v-model="formRefleksi.visibilitas" :items="opsiVisibilitas" class="w-full" />
                </UFormField>
              </div>
              <UButton type="submit" color="secondary" icon="i-lucide-send" :disabled="!formRefleksi.isi.trim()">
                {{ t.kirim }}
              </UButton>
            </UForm>
          </UCard>
          -->

          <RefleksiGrid
            :refleksi="refleksi"
            :is-en="isEn"
            :boleh-hapus="sendiri"
            @hapus="hapusRefleksi"
          />
        </div>

        <!-- Riwayat event -->
        <UCard v-else-if="tab === 'riwayat'" :ui="{ body: 'p-0' }">
          <div v-if="!riwayat.length" class="p-8 text-center text-sm text-cc-stone-500">
            {{ t.kosongRiwayat }}
          </div>
          <ul v-else class="divide-y divide-cc-stone-200">
            <li v-for="r in riwayat" :key="r.pesertaId" class="flex flex-wrap items-center gap-3 p-4">
              <div class="min-w-0 flex-1">
                <p class="font-semibold text-cc-green-800">{{ isEn ? (r.judulEn ?? r.judul) : r.judul }}</p>
                <p class="text-xs text-cc-stone-500">{{ tanggal(r.tanggalMulai) }} · {{ r.lokasi }}</p>
              </div>
            </li>
          </ul>
        </UCard>

        <!-- Pengaturan akun — hanya untuk profil sendiri. -->
        <div v-else-if="tab === 'akun' && sendiri" class="space-y-6">
          <UCard>
            <template #header>
              <h2 class="font-serif text-2xl text-cc-green-800">{{ t.tab3 }}</h2>
            </template>

            <UForm :state="formProfil" class="space-y-4" @submit="simpanProfil">
              <UFormField :label="t.username" name="username" :hint="isEn ? 'cannot be changed' : 'tidak bisa diubah'">
                <UInput :model-value="profil.username" disabled class="w-full" />
              </UFormField>
              <UFormField :label="t.nama" name="fullName" required>
                <UInput v-model="formProfil.fullName" required class="w-full" />
              </UFormField>
              <UFormField :label="t.email" name="email">
                <UInput v-model="formProfil.email" type="email" class="w-full" />
              </UFormField>
              <UFormField :label="t.hp" name="phoneNumber">
                <UInput v-model="formProfil.phoneNumber" placeholder="08xx xxxx xxxx" class="w-full" />
              </UFormField>

              <UAlert v-if="pesanProfil.ok" color="primary" variant="subtle" icon="i-lucide-check" :description="pesanProfil.ok" />
              <UAlert v-if="pesanProfil.galat" color="error" variant="subtle" icon="i-lucide-triangle-alert" :description="pesanProfil.galat" />

              <UButton type="submit" color="secondary" icon="i-lucide-save">{{ t.simpan }}</UButton>
            </UForm>
          </UCard>

          <UCard>
            <template #header>
              <h2 class="font-serif text-2xl text-cc-green-800">{{ t.gantiPass }}</h2>
            </template>

            <UForm :state="formPass" class="space-y-4" @submit="gantiPassword">
              <UFormField v-if="!lupaLama" :label="t.passLama" name="passwordLama" required>
                <UInput
                  v-model="formPass.passwordLama"
                  :type="lihatPass.lama ? 'text' : 'password'"
                  autocomplete="current-password"
                  required
                  class="w-full"
                  @keyup="cekCaps"
                  @blur="capsPass = false"
                >
                  <template #trailing>
                    <UButton
                      color="neutral" variant="link" size="sm" tabindex="-1"
                      :icon="lihatPass.lama ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                      :aria-label="t.passLama"
                      @click="lihatPass.lama = !lihatPass.lama"
                    />
                  </template>
                </UInput>
              </UFormField>

              <!-- Jalur "lupa password lama". Tombolnya kecil dan di bawah kolom
                   password lama, bukan di sebelahnya: yang ingat passwordnya tidak
                   perlu memutuskan apa pun, ia tinggal mengetik seperti biasa. -->
              <UButton
                v-if="!lupaLama"
                color="neutral"
                variant="link"
                size="xs"
                class="-mt-2 -ml-2"
                icon="i-lucide-help-circle"
                @click="lupaLama = true; formPass.passwordLama = ''"
              >
                {{ t.lupaLama }}
              </UButton>

              <UAlert
                v-else
                color="warning"
                variant="subtle"
                icon="i-lucide-shield-alert"
                :title="t.lupaLama"
                :description="t.lupaLamaIsi"
              >
                <template #actions>
                  <UButton color="neutral" variant="outline" size="xs" @click="lupaLama = false">
                    {{ t.pakaiLama }}
                  </UButton>
                </template>
              </UAlert>

              <UFormField :label="t.passBaru" name="passwordBaru" :hint="t.minimal" required>
                <UInput
                  v-model="formPass.passwordBaru"
                  :type="lihatPass.baru ? 'text' : 'password'"
                  autocomplete="new-password"
                  required
                  class="w-full"
                  @keyup="cekCaps"
                  @blur="capsPass = false"
                >
                  <template #trailing>
                    <UButton
                      color="neutral" variant="link" size="sm" tabindex="-1"
                      :icon="lihatPass.baru ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                      :aria-label="t.passBaru"
                      @click="lihatPass.baru = !lihatPass.baru"
                    />
                  </template>
                </UInput>
              </UFormField>

              <UFormField :label="t.passUlang" name="ulangi" required>
                <UInput
                  v-model="formPass.ulangi"
                  :type="lihatPass.baru ? 'text' : 'password'"
                  autocomplete="new-password"
                  required
                  class="w-full"
                  @keyup="cekCaps"
                  @blur="capsPass = false"
                />
              </UFormField>

              <p v-if="capsPass" class="flex items-center gap-1.5 text-xs font-semibold text-cc-brown-700" role="status">
                <UIcon name="i-lucide-arrow-big-up" class="size-4" />
                {{ isEn ? 'Caps Lock is on' : 'Caps Lock sedang aktif' }}
              </p>

              <UAlert v-if="pesanPass.ok" color="primary" variant="subtle" icon="i-lucide-check" :description="pesanPass.ok" />
              <UAlert v-if="pesanPass.galat" color="error" variant="subtle" icon="i-lucide-triangle-alert" :description="pesanPass.galat" />

              <UButton type="submit" color="secondary" icon="i-lucide-key-round">{{ t.gantiTombol }}</UButton>
            </UForm>
          </UCard>
        </div>
      </div>
    </div>
  </main>
</template>
