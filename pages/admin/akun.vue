<script setup lang="ts">
definePageMeta({ layout: 'admin' })

// Pengaturan akun sendiri, untuk pengelola.
//
// Halaman /profil milik peserta tidak dipakai di sini, dan itu disengaja: isinya
// riwayat event yang diikuti dan jurnal yang ditulisnya — dua hal yang tidak
// dimiliki akun pengelola, sehingga yang tergambar baginya cuma kerangka kosong.
// Yang benar-benar ia butuhkan cuma dua: membetulkan data dirinya, dan mengganti
// password.
//
// Endpointnya memakai yang sudah ada (/api/users/me, /api/users/password) —
// keduanya bekerja pada akun yang sedang masuk, apa pun perannya, jadi tidak ada
// jalur admin tersendiri yang perlu dibuat dan dijaga terpisah.

const { muat } = useAuth()
const toast = useToast()

const headerSSR = () => (import.meta.server ? useRequestHeaders(['cookie']) : undefined)

const { data, refresh } = await useFetch('/api/users/me', { headers: headerSSR() })

const form = reactive({ fullName: '', email: '', phoneNumber: '' })

/** Isi ulang formulir dari data server. Dipanggil saat muat pertama dan sesudah
    menyimpan, supaya yang tergambar selalu yang benar-benar tersimpan — bukan apa
    yang sempat diketik lalu ditolak validasi. */
const isiForm = () => {
  // `/api/users/me` mengembalikan profil lengkap ({ user, riwayat, refleksi, … }),
  // bukan pembungkus { data } seperti endpoint admin. Yang dipakai halaman ini
  // cuma bagian `user`-nya.
  const u = data.value?.user
  form.fullName = u?.fullName ?? ''
  form.email = u?.email ?? ''
  form.phoneNumber = u?.phoneNumber ?? ''
}
isiForm()
watch(data, isiForm)

const akun = computed(() => data.value?.user)

const galat = ref('')
const sibuk = ref(false)

const pesan = (e: unknown, bawaan: string) =>
  (e as { data?: { statusMessage?: string }, statusMessage?: string })?.data?.statusMessage
  ?? (e as { statusMessage?: string })?.statusMessage
  ?? bawaan

const simpan = async () => {
  galat.value = ''
  if (!form.fullName.trim()) {
    galat.value = 'Nama lengkap wajib diisi.'
    return
  }
  sibuk.value = true
  try {
    await $fetch('/api/users/me', { method: 'PATCH', body: { ...form } })
    await refresh()
    // Sesi ikut dimuat ulang: nama yang tergambar di kaki sidebar datang dari
    // sana, dan tanpa ini ia masih menampilkan nama lama sampai halaman disegarkan.
    await muat()
    toast.add({ title: 'Data diri tersimpan', icon: 'i-lucide-check', color: 'primary' })
  } catch (e: unknown) {
    galat.value = pesan(e, 'Gagal menyimpan data diri.')
  } finally {
    sibuk.value = false
  }
}

// ── Password ─────────────────────────────────────────────────────────────────

const pw = reactive({ lama: '', baru: '', ulang: '' })
const lihatPw = ref(false)
const galatPw = ref('')
const sibukPw = ref(false)

const gantiPassword = async () => {
  galatPw.value = ''
  if (pw.baru.length < 8) {
    galatPw.value = 'Password baru minimal 8 karakter.'
    return
  }
  // Diperiksa di sini, bukan di server: mengetik ulang adalah alat bantu layar
  // untuk menangkap salah ketik, dan server tidak perlu tahu ada dua kotak.
  if (pw.baru !== pw.ulang) {
    galatPw.value = 'Ketikan ulang password tidak sama.'
    return
  }
  sibukPw.value = true
  try {
    await $fetch('/api/users/password', {
      method: 'POST',
      body: { passwordLama: pw.lama || undefined, passwordBaru: pw.baru },
    })
    pw.lama = ''
    pw.baru = ''
    pw.ulang = ''
    toast.add({ title: 'Password berhasil diganti', icon: 'i-lucide-check', color: 'primary' })
  } catch (e: unknown) {
    galatPw.value = pesan(e, 'Gagal mengganti password.')
  } finally {
    sibukPw.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <div class="mb-6">
      <p class="text-xs font-bold tracking-[0.14em] text-cc-brown-500 uppercase">Akun saya</p>
      <h1 class="mt-1 font-serif text-4xl text-cc-green-800">Pengaturan akun</h1>
      <p class="mt-1 text-sm text-cc-stone-600">
        Data diri dan password akun Anda sendiri.
      </p>
    </div>

    <UCard class="mb-6">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="font-serif text-2xl text-cc-green-800">Data diri</h2>
          <!-- Username dan role ditampilkan, bukan disembunyikan, tapi juga bukan
               sebagai isian. Keduanya memang tidak bisa diubah sendiri: username
               dipakai untuk masuk, dan role menentukan wewenang — yang mengubahnya
               master, lewat halaman member. Menyembunyikannya cuma membuat orang
               bertanya-tanya di mana melihatnya. -->
          <div class="flex flex-wrap items-center gap-2 text-xs text-cc-stone-500">
            <span class="rounded-full bg-cc-stone-100 px-2.5 py-1">
              Username: <strong class="text-cc-stone-700">{{ akun?.username }}</strong>
            </span>
            <span class="rounded-full bg-cc-stone-100 px-2.5 py-1">
              Role: <strong class="text-cc-stone-700">{{ akun?.roleLabel ?? akun?.role }}</strong>
            </span>
          </div>
        </div>
      </template>

      <UAlert v-if="galat" class="mb-4" color="error" variant="subtle" :description="galat" />

      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Nama lengkap" required class="sm:col-span-2">
          <UInput v-model="form.fullName" placeholder="Nama lengkap Anda" class="w-full" />
        </UFormField>

        <UFormField label="Email">
          <UInput v-model="form.email" type="email" placeholder="nama@contoh.id" class="w-full" />
        </UFormField>

        <UFormField label="Nomor WhatsApp">
          <UInput v-model="form.phoneNumber" placeholder="08xx xxxx xxxx" class="w-full" />
        </UFormField>
      </div>

      <template #footer>
        <div class="flex justify-end">
          <UButton color="secondary" icon="i-lucide-save" :loading="sibuk" @click="simpan">
            Simpan perubahan
          </UButton>
        </div>
      </template>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-serif text-2xl text-cc-green-800">Ganti password</h2>
      </template>

      <UAlert v-if="galatPw" class="mb-4" color="error" variant="subtle" :description="galatPw" />

      <div class="grid gap-4 sm:grid-cols-2">
        <!-- Password lama OPSIONAL — lihat alasannya di
             server/api/users/password.post.ts. Ditandai apa adanya di layar, bukan
             dibiarkan tampak wajib lalu menolak orang yang memang tidak
             mengingatnya. -->
        <UFormField label="Password lama" class="sm:col-span-2">
          <UInput
            v-model="pw.lama"
            :type="lihatPw ? 'text' : 'password'"
            placeholder="Kosongkan bila lupa"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Password baru" required>
          <UInput
            v-model="pw.baru"
            :type="lihatPw ? 'text' : 'password'"
            placeholder="Minimal 8 karakter"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Ketik ulang password baru" required>
          <UInput
            v-model="pw.ulang"
            :type="lihatPw ? 'text' : 'password'"
            placeholder="Ulangi password baru"
            class="w-full"
          />
        </UFormField>
      </div>

      <div class="mt-3">
        <UCheckbox v-model="lihatPw" label="Tampilkan password" />
      </div>

      <template #footer>
        <div class="flex justify-end">
          <UButton
            color="secondary"
            icon="i-lucide-key-round"
            :loading="sibukPw"
            :disabled="!pw.baru || !pw.ulang"
            @click="gantiPassword"
          >
            Ganti password
          </UButton>
        </div>
      </template>
    </UCard>
  </div>
</template>
