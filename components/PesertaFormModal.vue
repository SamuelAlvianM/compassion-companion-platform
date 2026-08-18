<script setup lang="ts">
// Form "Tambah peserta" — untuk orang yang membooking di luar situs.
//
// Ia TIDAK menyimpan apa pun sendiri, dan itu yang membuatnya bisa dipakai dua
// tempat sekaligus: pada event tersimpan induknya mengirimkannya ke server, pada
// event baru induknya menyimpannya sebagai draf sampai "Buat event" ditekan. Kalau
// penyimpanannya ada di sini, salah satu dari keduanya pasti punya salinan formnya
// sendiri — dan aturan "email wajib, nama wajib" akan hidup di dua tempat.
//
// STATUS TIDAK DITANYAKAN. Setiap peserta yang dimasukkan dari sini mulai dari
// `baru`, sama seperti pendaftar dari halaman publik. Dimasukkan admin bukan berarti
// sudah dikonfirmasi: menghubungi orangnya, memasukkannya ke grup, memverifikasi
// pembayaran — semuanya tetap pekerjaan nyata yang belum tentu sudah dilakukan saat
// namanya dicatat, dan tab peserta sudah punya alurnya sendiri untuk memajukannya.
// Kotak pilihan di sini cuma menawarkan jalan pintas untuk melewati alur itu.
//
// Institusi juga dicabut. Kolomnya masih ada di `cc_peserta` dan masih diisi
// pendaftaran publik; yang tidak ada gunanya adalah menanyakannya di sini, pada
// orang yang sedang mencatat nama dari catatan WhatsApp.
//
// Dua jalan mengisi: mengetik sendiri, atau memilih member yang sudah punya akun.
// Yang kedua ada karena sebagian besar yang membooking di luar situs justru orang
// yang sudah lama ikut — mengetik ulang nama dan emailnya berarti satu salah ketik
// memisahkan pendaftaran ini dari akunnya, dan kolom "Member" akan berbunyi
// "Non member" untuk orang yang jelas-jelas punya akun.

const props = defineProps<{
  open: boolean
  /** Email yang sudah terpakai di event ini — bentrokan ditahan sebelum dikirim. */
  emailTerpakai?: string[]
}>()

const emit = defineEmits<{
  'update:open': [boolean]
  'simpan': [{ nama: string, email: string, noHp: string, catatan: string, status: string }]
}>()

const kosong = () => ({ nama: '', email: '', noHp: '', catatan: '' })

const form = ref(kosong())
const galat = ref('')

// ── Pilih dari member ────────────────────────────────────────────────────────
//
// USelectMenu, bukan kotak cari + daftar hasil buatan sendiri: ia sudah membawa
// kotak pencarian di dalam panelnya, penyorotan lewat papan ketik, dan penutupan
// saat diklik di luar — tiga hal yang kalau ditulis ulang di sini pasti berbeda
// perilakunya dari kotak pilihan lain di dashboard ini.
//
// Daftarnya diambil SEKALI lalu disaring di klien. Pencarian ke server per ketukan
// akan membuat panelnya berkedip tiap huruf, dan komunitas ini tidak punya jumlah
// akun yang menuntut paginasi.
const memberDipilih = ref<any>(null)

const { data: hasilMember, status: statusMember, execute: muatMember } = useFetch<any>(
  '/api/users',
  { query: { limit: 100, aktif: 'true' }, immediate: false },
)

/**
 * `label` disusun di sini, bukan lewat slot: `filterFields` menyaring berdasarkan
 * isi kolom, jadi nama DAN email harus benar-benar ada di dalam teks yang disaring.
 * Kalau emailnya cuma digambar di slot, mengetik alamat email tidak akan menemukan
 * siapa pun.
 */
const pilihanMember = computed(() =>
  (hasilMember.value?.data ?? []).map((m: any) => ({
    id: m.id,
    label: m.fullName ?? m.username ?? '',
    email: m.email ?? '',
    noHp: m.phoneNumber ?? '',
  })))

watch(memberDipilih, (m) => {
  if (!m) return
  form.value.nama = m.label
  form.value.email = m.email
  form.value.noHp = m.noHp
})

// Disusun ulang tiap modal dibuka: komponennya tetap hidup di antara pembukaan,
// jadi tanpa ini isian peserta sebelumnya masih tertinggal.
watch(() => props.open, (terbuka) => {
  if (!terbuka) return
  form.value = kosong()
  galat.value = ''
  memberDipilih.value = null
  dicoba.value = false
  // Diambil saat modal dibuka, bukan saat halaman dimuat: tab peserta jauh lebih
  // sering dilihat daripada modal ini dipakai.
  if (!hasilMember.value) muatMember()
})

const emailBersih = computed(() => form.value.email.trim().toLowerCase())

/**
 * Pemeriksaan yang bisa dijawab tanpa server. Server memeriksa hal yang sama —
 * ini kenyamanan, bukan penjagaan.
 *
 * Bentrokan email ikut diperiksa di sini karena pada event BARU tidak ada server
 * yang bisa menolaknya: drafnya belum pernah dikirim ke mana pun, dan dua baris
 * beremail sama baru akan ditolak nanti — di tengah penyimpanan, sesudah eventnya
 * terlanjur dibuat.
 */
const peringatan = computed(() => {
  const email = emailBersih.value
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return 'Format email tidak valid.'
  if (email && (props.emailTerpakai ?? []).includes(email)) {
    return 'Email ini sudah ada di daftar peserta event ini.'
  }
  return ''
})

const bisaSimpan = computed(() =>
  Boolean(form.value.nama.trim() && emailBersih.value) && !peringatan.value)

// Diikat ke variabel lokal supaya bisa dipanggil dari template: auto-import Nuxt
// bekerja pada blok script, dan yang hanya muncul di template tidak ikut terbawa.
const wajibKosong = belumDiisi

/** "Tambah peserta" sudah pernah ditekan — penanda kolom wajib menyala dari sini. */
const dicoba = ref(false)

const simpan = () => {
  dicoba.value = true
  if (!bisaSimpan.value) { galat.value = peringatan.value || 'Nama dan email wajib diisi.'; return }
  emit('simpan', {
    nama: form.value.nama.trim(),
    email: emailBersih.value,
    noHp: form.value.noHp.trim(),
    catatan: form.value.catatan.trim(),
    // Tidak diambil dari isian mana pun — lihat catatan di kepala berkas.
    status: 'baru',
  })
}

/** Dipanggil induk kalau server menolak — pesannya muncul di dalam modal, dan
    modalnya tetap terbuka supaya isian yang sudah diketik tidak hilang. */
const tolak = (pesan: string) => { galat.value = pesan }
defineExpose({ tolak })
</script>

<template>
  <!-- Ukuran judulnya diatur di app.config.ts, berlaku untuk SELURUH modal. -->
  <UModal :open="open" title="Tambah peserta" @update:open="emit('update:open', $event)">
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-cc-stone-600">
          Lewati “Pilih dari member” apabila ingin mendaftarkan peserta baru.
        </p>

        <UFormField label="Pilih dari member" hint="jika sudah punya akun">
          <USelectMenu
            v-model="memberDipilih"
            :items="pilihanMember"
            :loading="statusMember === 'pending'"
            :filter-fields="['label', 'email']"
            :search-input="{ placeholder: 'Cari nama atau email…' }"
            placeholder="Cari member yang sudah punya akun"
            icon="i-lucide-user-search"
            class="w-full"
          >
            <!-- Email ikut tergambar di tiap baris: dua orang bernama sama bukan
                 hal yang jarang, dan alamat emailnya yang membedakan. -->
            <template #item-label="{ item }">
              <span class="font-semibold text-cc-green-800">{{ item.label }}</span>
              <span class="ms-1 text-cc-stone-500">· {{ item.email }}</span>
            </template>
          </USelectMenu>
        </UFormField>

        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Nama" required :error="wajibKosong(form.nama, dicoba)">
            <UInput v-model="form.nama" class="w-full" placeholder="Nama lengkap" />
          </UFormField>
          <UFormField label="Email" required :error="wajibKosong(form.email, dicoba)">
            <UInput v-model="form.email" type="email" class="w-full" placeholder="nama@email.com" />
          </UFormField>
          <UFormField label="WhatsApp" class="sm:col-span-2">
            <UInput v-model="form.noHp" class="w-full" placeholder="08…" />
          </UFormField>
        </div>

        <UFormField label="Catatan" hint="opsional">
          <UTextarea v-model="form.catatan" :rows="2" class="w-full" placeholder="mis. bayar tunai di tempat" />
        </UFormField>

        <UAlert
          v-if="peringatan"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :description="peringatan"
        />
        <UAlert
          v-if="galat"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :description="galat"
        />
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="emit('update:open', false)">Batal</UButton>
        <UButton color="secondary" @click="simpan">Tambah peserta</UButton>
      </div>
    </template>
  </UModal>
</template>
