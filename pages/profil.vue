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
const { data, refresh } = await useFetch(() => `/api/users/${targetId.value}`)

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
      tidakCocok: 'New passwords do not match', minimal: 'At least 8 characters',
      tulis: 'Write a reflection', tulisIsi: 'What did you take away?', kirim: 'Publish',
      kegiatan: 'Related event', tanpaKegiatan: 'Not tied to an event',
      visibilitas: 'Visibility', publik: 'Public', peserta: 'Participants only', pribadi: 'Private',
      ikut: 'events joined', hadir: 'attended', menunggu: 'awaiting confirmation',
      kosongRiwayat: 'No event history yet.', lihat: 'Show', sembunyikan: 'Hide',
      kembali: 'Back to user list', bergabung: 'Joined',
    }
  : {
      eyebrow: 'Profil', tab1: 'Refleksi', tab2: 'Riwayat event', tab3: 'Pengaturan akun',
      username: 'Username', nama: 'Nama lengkap', email: 'Email', hp: 'Nomor WhatsApp',
      simpan: 'Simpan perubahan', tersimpan: 'Profil diperbarui',
      gantiPass: 'Ganti password', passLama: 'Password saat ini', passBaru: 'Password baru',
      passUlang: 'Ulangi password baru', gantiTombol: 'Ubah password', passTersimpan: 'Password berhasil diubah',
      tidakCocok: 'Password baru tidak sama', minimal: 'Minimal 8 karakter',
      tulis: 'Tulis refleksi', tulisIsi: 'Apa yang Anda bawa pulang?', kirim: 'Terbitkan',
      kegiatan: 'Kegiatan terkait', tanpaKegiatan: 'Tidak terkait kegiatan',
      visibilitas: 'Visibilitas', publik: 'Publik', peserta: 'Khusus peserta', pribadi: 'Pribadi',
      ikut: 'event diikuti', hadir: 'hadir', menunggu: 'menunggu konfirmasi',
      kosongRiwayat: 'Belum ada riwayat event.', lihat: 'Tampilkan', sembunyikan: 'Sembunyikan',
      kembali: 'Kembali ke daftar user', bergabung: 'Bergabung',
    })

useSeoMeta({
  title: () => profil.value?.fullName ?? t.value.eyebrow,
  robots: 'noindex, nofollow',
})

const tab = ref('refleksi')
const tabs = computed(() => [
  { value: 'refleksi', label: t.value.tab1, icon: 'i-lucide-feather' },
  { value: 'riwayat', label: t.value.tab2, icon: 'i-lucide-calendar-check' },
  ...(sendiri.value ? [{ value: 'akun', label: t.value.tab3, icon: 'i-lucide-settings' }] : []),
])

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
      body: { passwordLama: formPass.passwordLama, passwordBaru: formPass.passwordBaru },
    })
    pesanPass.ok = t.value.passTersimpan
    Object.assign(formPass, { passwordLama: '', passwordBaru: '', ulangi: '' })
  } catch (e: any) {
    pesanPass.galat = e?.data?.statusMessage || 'Gagal'
  }
}

// ── Tulis refleksi ───────────────────────────────────────────────────────────
const formRefleksi = reactive({ isi: '', kegiatanSlug: '', visibilitas: 'publik' })
const kirimRefleksi = async () => {
  if (!formRefleksi.isi.trim()) return
  await $fetch('/api/refleksi', {
    method: 'POST',
    body: {
      isi: formRefleksi.isi,
      kegiatanSlug: formRefleksi.kegiatanSlug || undefined,
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
  { value: '', label: t.value.tanpaKegiatan },
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

const warnaStatus = (s: string) =>
  ({ hadir: 'primary', terkonfirmasi: 'secondary', menunggu: 'warning', batal: 'neutral' })[s] ?? 'neutral'

const inisial = computed(() =>
  (profil.value?.fullName ?? '?').split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase(),
)
</script>

<template>
  <main class="event-page">
    <div class="container">
      <div v-if="profil" class="mx-auto max-w-4xl">
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
              <h1 class="!text-4xl">{{ profil.fullName }}</h1>
              <p class="!mb-2 opacity-90">@{{ profil.username }}</p>
              <div class="flex flex-wrap items-center gap-2">
                <UBadge color="secondary" variant="solid" size="sm">
                  {{ profil.roleLabel }} · level {{ profil.level }}
                </UBadge>
                <UBadge v-if="!profil.isActive" color="error" variant="subtle" size="sm">
                  {{ isEn ? 'Inactive' : 'Nonaktif' }}
                </UBadge>
              </div>
            </div>
          </div>

          <dl v-if="ringkas" class="mt-6 flex flex-wrap gap-8 border-t border-white/20 pt-4 text-cc-stone-50">
            <div><dt class="text-xs uppercase opacity-70">{{ t.ikut }}</dt><dd class="font-serif text-3xl">{{ ringkas.total }}</dd></div>
            <div><dt class="text-xs uppercase opacity-70">{{ t.hadir }}</dt><dd class="font-serif text-3xl">{{ ringkas.hadir }}</dd></div>
            <div><dt class="text-xs uppercase opacity-70">{{ t.tab1 }}</dt><dd class="font-serif text-3xl">{{ refleksi.length }}</dd></div>
          </dl>
        </div>

        <UTabs v-model="tab" :items="tabs" :content="false" color="secondary" variant="link" class="mb-6" />

        <!-- Refleksi -->
        <div v-if="tab === 'refleksi'" class="space-y-6">
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
              <UBadge :color="warnaStatus(r.status)" variant="subtle" size="sm">{{ r.status }}</UBadge>
              <UBadge color="neutral" variant="outline" size="sm">{{ r.fase }}</UBadge>
            </li>
          </ul>
        </UCard>

        <!-- Pengaturan akun -->
        <div v-else class="space-y-6">
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
              <UFormField :label="t.passLama" name="passwordLama" required>
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
