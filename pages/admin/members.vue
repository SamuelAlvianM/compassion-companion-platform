<script setup lang="ts">
definePageMeta({ layout: "admin" });

// Daftar member sungguhan dari database. Endpoint-nya sudah membatasi ke level <= 3,
// dan middleware admin.global.ts sudah menahan halaman ini lebih dulu.
// Sentinel 'semua', bukan string kosong. Reka UI (penyokong USelect) memesan ''
// untuk keadaan "belum dipilih" dan melempar galat render begitu ada item bernilai
// kosong — dan galat itu menjatuhkan seluruh halaman jadi 500, bukan cuma
// select-nya. Pola yang sama dipakai filter di halaman event dan form refleksi.
const SEMUA = "semua";

/**
 * Akun yang baru dibuat di /admin/member/new, dititipkan lewat state.
 *
 * Halaman itu kini kembali ke sini sesudah menyimpan — sama seperti mode ubah.
 * Yang tidak boleh ikut hilang cuma passwordnya: ia hanya bisa dibaca sekali, dan
 * seluruh alur akun di situs ini bergantung padanya sampai di WhatsApp pemiliknya.
 *
 * Dibaca sekali lalu dibuang: menyegarkan halaman tidak boleh menampilkan password
 * lagi, dan yang sudah dikirim tidak perlu menetap di layar orang lain.
 */
const akunBaru = useState<{
  nama: string;
  email: string;
  noHp: string;
  password: string;
} | null>("akun-baru-dibuat", () => null);

const kabarAkun = ref(akunBaru.value);
akunBaru.value = null;

/** Pesan WhatsApp yang sudah tersusun — tinggal ditekan. Nomor dinormalkan ke
    bentuk internasional; `wa.me` menolak yang berawalan 0. */
const tautanWa = computed(() => {
  const k = kabarAkun.value;
  if (!k?.noHp) return "";
  const nomor = k.noHp.replace(/\D/g, "").replace(/^0/, "62");
  const teks =
    `Halo ${k.nama}, akun Anda di Compassionate Companion sudah dibuat.\n\n` +
    `Email: ${k.email}\nPassword: ${k.password}\n\n` +
    "Silakan masuk dan ganti passwordnya setelah login.";
  return `https://wa.me/${nomor}?text=${encodeURIComponent(teks)}`;
});

const q = ref("");
const role = ref(SEMUA);
const aktif = ref(SEMUA);

// Ketikan tidak langsung memicu request; jeda singkat mencegah satu panggilan
// per huruf saat mengetik kata pencarian. Ditulis manual karena VueUse tidak
// ter-auto-import di project ini.
const qDebounced = ref("");
let timer: ReturnType<typeof setTimeout> | undefined;
watch(q, (nilai) => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    qDebounced.value = nilai;
  }, 300);
});
onScopeDispose(() => clearTimeout(timer));

// Sentinel diterjemahkan balik jadi "tidak menyaring"; server tidak perlu tahu.
const query = computed(() => ({
  q: qDebounced.value || undefined,
  role: role.value === SEMUA ? undefined : role.value,
  aktif: aktif.value === SEMUA ? undefined : aktif.value,
}));

const { data, status } = useFetch("/api/users", { query });

const users = computed(() => data.value?.data ?? []);
const roleOptions = computed(() => [
  { value: SEMUA, label: "Semua role" },
  ...(data.value?.opsi.roles ?? []),
]);
const aktifOptions = [
  { value: SEMUA, label: "Semua status" },
  { value: "true", label: "Aktif" },
  { value: "false", label: "Nonaktif" },
];

const adaFilter = computed(
  () => Boolean(q.value) || role.value !== SEMUA || aktif.value !== SEMUA,
);
const reset = () => {
  q.value = "";
  role.value = SEMUA;
  aktif.value = SEMUA;
};

// Kolom "Terakhir masuk" dicabut atas permintaan: satu tanggal di dalam daftar
// tidak menjawab pertanyaan apa pun yang bisa ditindaklanjuti di sini. Kalau
// riwayat masuk dibutuhkan, tempatnya menu log tersendiri. `lastLogin` masih
// dikirim GET /api/users; yang hilang cuma pemakainya.
const columns = [
  { accessorKey: "fullName", header: "Nama" },
  { accessorKey: "role", header: "Role" },
  { accessorKey: "email", header: "Email" },
  { accessorKey: "jumlahKegiatan", header: "Event diikuti" },
  { accessorKey: "aksi", header: "" },
];
</script>

<template>
  <div class="mx-auto max-w-6xl">
    <!-- Panel detail di samping tabel dicabut: memilih satu member sekarang berarti
         pergi ke halamannya — profil lengkap untuk melihat, form untuk mengubah.
         Komentar ditaruh DI DALAM elemen akar — komentar di tingkat akar template
         membuat halaman terhitung multi-akar, dan halaman multi-akar berhenti
         tergambar saat dinavigasi dari halaman lain. -->

    <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="font-serif text-5xl text-cc-green-800">Member</h1>
        <p class="mt-2 text-sm text-cc-stone-600">
          Semua akun beserta role dan riwayat keikutsertaannya.
        </p>
      </div>
      <UButton
        to="/admin/member/new"
        color="secondary"
        size="lg"
        icon="i-lucide-user-plus"
        class="shrink-0"
      >
        Tambah Member
      </UButton>
    </div>

    <!-- Kabar akun baru, berikut passwordnya.
         Ia menetap sampai ditutup, bukan lewat sebagai toast: passwordnya hanya
         bisa dibaca sekali, dan kabar yang menghilang sendiri setelah tiga detik
         adalah tempat paling buruk untuk menaruhnya. Tombol WhatsApp-nya membawa
         pesan yang sudah tersusun, jadi tidak ada yang perlu disalin dengan tangan —
         di situlah salah ketik satu huruf berakhir jadi "kok tidak bisa login". -->
    <UAlert
      v-if="kabarAkun"
      color="primary"
      variant="subtle"
      class="mb-6"
      icon="i-lucide-user-check"
      :title="`Akun ${kabarAkun.nama} dibuat`"
      :close="true"
      @update:open="kabarAkun = null"
    >
      <template #description>
        <p>Berikan password ini kepada pemiliknya.</p>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <code
            class="rounded bg-white px-2 py-1 font-mono text-sm text-cc-green-800 ring-1 ring-cc-stone-200"
          >
            {{ kabarAkun.password }}
          </code>
          <UButton
            v-if="tautanWa"
            :to="tautanWa"
            target="_blank"
            external
            color="primary"
            variant="soft"
            size="sm"
            icon="i-lucide-message-circle"
          >
            Kirim lewat WhatsApp
          </UButton>
        </div>
      </template>
    </UAlert>

    <div
      class="mb-6 grid gap-3 rounded-lg border border-cc-green-800 bg-cc-stone-50 p-3 sm:grid-cols-[1fr_200px_170px_auto] sm:items-end"
    >
      <UFormField label="Cari" size="sm">
        <UInput
          v-model="q"
          icon="i-lucide-search"
          placeholder="Nama atau email"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Role" size="sm">
        <USelect v-model="role" :items="roleOptions" class="w-full" />
      </UFormField>
      <UFormField label="Status" size="sm">
        <USelect v-model="aktif" :items="aktifOptions" class="w-full" />
      </UFormField>
      <UButton
        color="neutral"
        variant="ghost"
        icon="i-lucide-rotate-ccw"
        :disabled="!adaFilter"
        @click="reset"
      >
        Reset
      </UButton>
    </div>

    <!-- Tabel dari `md` ke atas saja. Lima kolom di layar 375px menyisakan kolom
         Email dan tombol aksi di luar pandangan — dan tombol aksi itulah yang
         paling sering dituju dari halaman ini. -->
    <UCard :ui="{ body: 'p-0' }" class="hidden md:block">
      <UTable
        :data="users"
        :columns="columns"
        :loading="status === 'pending'"
        empty="Tidak ada member yang cocok."
      >
        <template #fullName-cell="{ row }">
          <NuxtLink
            :to="`/admin/member/${row.original.id}`"
            class="group inline-flex items-start gap-1.5 font-semibold break-words text-cc-green-800 hover:text-cc-brown-500"
          >
            {{ row.original.fullName }}
          </NuxtLink>
        </template>

        <!-- Nama rolenya saja. Angka level hanya berarti bagi yang hafal tabel
             wewenang, dan tabel itu sendiri sudah tidak ada di dashboard. -->
        <template #role-cell="{ row }">
          <UBadge
            :color="warnaLevel(row.original.level)"
            variant="subtle"
            size="sm"
          >
            {{ row.original.roleLabel }}
          </UBadge>
          <UBadge
            v-if="!row.original.isActive"
            color="neutral"
            variant="outline"
            size="sm"
            class="ml-1"
          >
            nonaktif
          </UBadge>
        </template>

        <template #jumlahKegiatan-cell="{ row }">
          <span class="tabular-nums">{{ row.original.jumlahKegiatan }}</span>
        </template>

        <!-- Dua tujuan, dua ikon: mata membuka profil lengkapnya sebagaimana
             dilihat orang lain, pensil membuka formnya. Keduanya butuh aria-label
             sendiri — tanpa teks di dalam tombol, keduanya terbaca sebagai tombol
             tanpa nama. -->
        <template #aksi-cell="{ row }">
          <div class="flex justify-end gap-1">
            <UButton
              :to="`/profil?id=${row.original.id}`"
              color="neutral"
              variant="ghost"
              size="sm"
              icon="i-lucide-eye"
              :aria-label="`Lihat profil ${row.original.fullName}`"
            />
            <UButton
              :to="`/admin/member/${row.original.id}`"
              color="secondary"
              variant="ghost"
              size="sm"
              icon="i-lucide-pencil"
              :aria-label="`Ubah akun ${row.original.fullName}`"
            />
          </div>
        </template>
      </UTable>
    </UCard>

    <!-- Bentuk layar sempit: satu kartu per akun. Emailnya dapat barisnya sendiri
         dan boleh memotong diri (`truncate`) — di tabel ia memaksa seluruh baris
         melebar, di kartu ia cukup menyusut. -->
    <div class="space-y-3 md:hidden">
      <p v-if="status === 'pending'" class="text-sm text-cc-stone-500">
        Memuat…
      </p>

      <p
        v-else-if="!users.length"
        class="rounded-lg border border-cc-stone-200 bg-white p-4 text-sm text-cc-stone-500"
      >
        Tidak ada member yang cocok.
      </p>

      <div
        v-for="u in users"
        :key="u.id"
        class="rounded-lg border border-cc-stone-200 bg-white p-4"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="font-semibold break-words text-cc-green-800">
              {{ u.fullName }}
            </p>
            <p v-if="u.email" class="mt-0.5 truncate text-sm text-cc-stone-500">
              {{ u.email }}
            </p>
          </div>

          <!-- Tombolnya tetap di kanan atas, sejajar dengan tabel — yang berubah
               cuma barisnya, bukan tempat orang mencarinya. -->
          <div class="flex shrink-0 gap-1">
            <UButton
              :to="`/profil?id=${u.id}`"
              color="neutral"
              variant="ghost"
              size="sm"
              icon="i-lucide-eye"
              :aria-label="`Lihat profil ${u.fullName}`"
            />
            <UButton
              :to="`/admin/member/${u.id}`"
              color="secondary"
              variant="ghost"
              size="sm"
              icon="i-lucide-pencil"
              :aria-label="`Ubah akun ${u.fullName}`"
            />
          </div>
        </div>

        <div
          class="mt-3 flex flex-wrap items-center gap-1.5 border-t border-cc-stone-100 pt-3"
        >
          <UBadge :color="warnaLevel(u.level)" variant="subtle" size="sm">{{
            u.roleLabel
          }}</UBadge>
          <UBadge v-if="!u.isActive" color="neutral" variant="outline" size="sm"
            >nonaktif</UBadge
          >
          <span class="ml-auto text-xs text-cc-stone-500">
            {{ u.jumlahKegiatan }} event diikuti
          </span>
        </div>
      </div>
    </div>

    <p v-if="data" class="mt-3 text-xs text-cc-stone-500">
      {{ users.length }} dari {{ data.meta.total }} akun.
    </p>
  </div>
</template>
