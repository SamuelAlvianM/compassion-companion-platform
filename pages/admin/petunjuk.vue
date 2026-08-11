<script setup lang="ts">
definePageMeta({ layout: 'admin' })

// Halaman rujukan untuk seluruh pengelola (level <= 3). Berbeda dengan tabel role di
// dashboard: yang di dashboard menampilkan DATA (berapa akun per role) dan hanya untuk
// master; halaman ini menjelaskan ATURANNYA, dan boleh dibaca admin maupun editor.
const { user } = useAuth()

const roles = [
  {
    level: 1, nama: 'Master', kunci: 'master',
    ringkas: 'Akses penuh atas seluruh sistem.',
    bisa: [
      'Semua yang bisa dilakukan Admin dan Editor',
      'Mengelola akun: membuat, menonaktifkan, dan menetapkan role',
      'Melihat rekap role & jumlah akun di dashboard',
      'Membaca refleksi bertanda "pribadi" milik siapa pun',
    ],
  },
  {
    level: 2, nama: 'Admin', kunci: 'admin',
    ringkas: 'Pendataan operasional kegiatan dan peserta.',
    bisa: [
      'Membuat dan menyunting event beserta materinya',
      'Memproses pendaftar: konfirmasi, catat pembayaran, tandai kehadiran',
      'Melihat profil dan riwayat keikutsertaan semua user',
      'Membaca refleksi bertanda "pribadi"',
    ],
  },
  {
    level: 3, nama: 'Editor', kunci: 'editor',
    ringkas: 'Konten jurnal dan media.',
    bisa: [
      'Menulis, menyunting, dan menerbitkan jurnal',
      'Mengunggah serta menata media',
      'Melihat profil dan riwayat keikutsertaan user',
    ],
    tidakBisa: ['Membaca refleksi bertanda "pribadi"', 'Mengubah role akun'],
  },
  {
    level: 4, nama: 'User', kunci: 'user',
    ringkas: 'Peserta kegiatan.',
    bisa: [
      'Mendaftar event dengan satu klik',
      'Menulis refleksi dan mengatur visibilitasnya',
      'Menyunting profil dan mengganti password sendiri',
    ],
    tidakBisa: ['Membuka area admin', 'Melihat profil orang lain'],
  },
]

const alur = [
  { no: 1, judul: 'Terbitkan event', detail: 'Buat kegiatan, isi tanggal, kuota, harga, lalu ubah statusnya jadi "terbit". Hanya event terbit yang tampil di situs publik.', peran: 'Admin' },
  { no: 2, judul: 'Terima pendaftaran', detail: 'Pendaftar masuk lewat halaman event. Yang sudah punya akun cukup satu klik; tamu mengisi nama dan email.', peran: 'otomatis' },
  { no: 3, judul: 'Konfirmasi & catat pembayaran', detail: 'Buka event lalu tab "Daftar peserta". Status dimajukan manual: baru → proses → konfirmasi. Pendaftar yang memakai akun langsung masuk sebagai proses, jadi tinggal dikonfirmasi. Yang batal bisa dikembalikan ke status terakhirnya kalau berubah pikiran.', peran: 'Admin' },
  { no: 4, judul: 'Unggah materi & terbitkan jurnal', detail: 'Setelah acara: unggah dokumentasi, bagikan materi ke peserta, dan terbitkan refleksi pilihan sebagai jurnal.', peran: 'Editor' },
]

const warnaLevel = (level: number) =>
  ({ 1: 'error', 2: 'primary', 3: 'secondary', 4: 'neutral' })[level] ?? 'neutral'
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <div class="mb-8">
      <p class="text-xs font-bold uppercase tracking-[.16em] text-cc-brown-500">Referensi</p>
      <h1 class="font-serif text-5xl text-cc-green-800">Petunjuk</h1>
      <p class="mt-2 max-w-2xl text-sm text-cc-stone-600">
        Pembagian wewenang antar role dan urutan kerja pengelolaan kegiatan.
      </p>
    </div>

    <UAlert
      v-if="user"
      class="mb-8"
      color="primary"
      variant="subtle"
      icon="i-lucide-badge-check"
      :title="`Anda masuk sebagai ${user.fullName}`"
      :description="`Role ${user.role}, level ${user.level}. Angka level kecil berarti wewenang lebih besar.`"
    />

    <section class="mb-10">
      <h2 class="mb-1 font-serif text-3xl text-cc-green-800">Role & wewenang</h2>
      <p class="mb-4 text-sm text-cc-stone-600">
        Pemeriksaan hak akses memakai perbandingan
        <code class="rounded bg-cc-stone-100 px-1 py-0.5 text-xs">level &lt;= n</code>, jadi satu
        aturan otomatis mencakup semua role di atasnya.
      </p>

      <div class="space-y-3">
        <UCard v-for="r in roles" :key="r.kunci" :ui="{ body: 'p-5' }">
          <div class="flex flex-wrap items-center gap-3">
            <UBadge :color="warnaLevel(r.level)" variant="subtle">Level {{ r.level }}</UBadge>
            <h3 class="font-serif text-2xl text-cc-green-800">{{ r.nama }}</h3>
            <span class="text-xs text-cc-stone-500">{{ r.kunci }}</span>
          </div>
          <p class="mt-2 text-sm text-cc-stone-600">{{ r.ringkas }}</p>

          <ul class="mt-3 space-y-1.5">
            <li v-for="b in r.bisa" :key="b" class="flex items-start gap-2 text-sm">
              <UIcon name="i-lucide-check" class="mt-0.5 size-4 shrink-0 text-cc-green-600" />
              <span class="text-cc-stone-700">{{ b }}</span>
            </li>
            <li v-for="x in r.tidakBisa ?? []" :key="x" class="flex items-start gap-2 text-sm">
              <UIcon name="i-lucide-x" class="mt-0.5 size-4 shrink-0 text-cc-stone-400" />
              <span class="text-cc-stone-500">{{ x }}</span>
            </li>
          </ul>
        </UCard>
      </div>
    </section>

    <section>
      <h2 class="mb-4 font-serif text-3xl text-cc-green-800">Alur kerja</h2>
      <ol class="space-y-3">
        <li v-for="a in alur" :key="a.no">
          <UCard :ui="{ body: 'p-5 flex gap-4' }">
            <span class="grid size-9 shrink-0 place-items-center rounded-full bg-cc-green-800 font-serif text-lg text-cc-stone-50">
              {{ a.no }}
            </span>
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="font-serif text-xl text-cc-green-800">{{ a.judul }}</h3>
                <UBadge color="neutral" variant="subtle" size="sm">{{ a.peran }}</UBadge>
              </div>
              <p class="mt-1 text-sm leading-relaxed text-cc-stone-600">{{ a.detail }}</p>
            </div>
          </UCard>
        </li>
      </ol>
    </section>
  </div>
</template>
