<script setup lang="ts">
const route = useRoute();
const isEn = computed(() => route.path.startsWith("/en"));
/** Awalan bahasa untuk tautan ke halaman baca — /id/jurnal/… atau /en/jurnal/…. */
const base = computed(() => (isEn.value ? "/en" : "/id"));

useSeoMeta({
  title: () => (isEn.value ? "Journal" : "Jurnal"),
  description: () =>
    isEn.value
      ? "Stories, reflections, insights, and practices growing out of encounters and service within the Compassionate Companion community."
      : "Cerita, refleksi, insight, dan praktik yang bertumbuh dari perjumpaan serta pelayanan di komunitas Compassionate Companion.",
});

type JournalType =
  | "event-reflection"
  | "sharing-journey"
  | "insight"
  | "practice";

/** Bentuk satu opsi tipe di chip filter. Dideklarasikan sebagai interface
    terpisah — BUKAN ditulis langsung sebagai argumen generic di
    `computed<...>()` — karena bentuk object literal di dalam `<...>` itu yang
    membuat parser salah membaca `<` sebagai operator pembanding alih-alih
    pembuka generic, dan menghasilkan galat
    "Operator '>' cannot be applied to types 'never[]' and '() => ...'". */
interface TipeOption {
  value: "all" | JournalType;
  label: string;
  warna: string;
}

interface SortOption {
  value: "newest" | "oldest";
  label: string;
  icon: string;
}

const selectedType = ref<"all" | JournalType>("all");
const selectedEvent = ref("all");
const search = ref("");
const sortOrder = ref<"newest" | "oldest">("newest");

/** Penyaring ponsel tinggal di bilah bawah; lihat catatan di halaman event. */
const lembarFilter = ref(false);

/** Berapa penyaring yang menyala — angka kecil di tombol filter, supaya keadaan
    tersaring terbaca tanpa membuka lembarnya. Pencarian tidak dihitung: kata yang
    sedang diketik sudah terlihat di kotaknya sendiri. */
const jumlahFilterAktif = computed(
  () =>
    (selectedType.value !== "all" ? 1 : 0) +
    (selectedEvent.value !== "all" ? 1 : 0) +
    (sortOrder.value !== "newest" ? 1 : 0),
);

/** Warna tiap chip tipe — ditulis utuh, bukan disusun dari potongan seperti
    `bg-cc-${warna}-500`. Tailwind memindai berkas sebagai teks; kelas yang baru
    terbentuk saat runtime tidak pernah ikut diterbitkan. Warnanya disamakan
    dengan warna ikon tipe di kartu, supaya chip di sini dan penanda di kartu
    terbaca sebagai satu hal yang sama. */
const warnaChip: Record<string, string> = {
  neutral: "bg-cc-stone-700 text-white",
  secondary: "bg-cc-brown-600 text-white",
  primary: "bg-cc-green-800 text-white",
  accent: "bg-cc-green-600 text-white",
  stone: "bg-cc-stone-500 text-white",
};

// Label antarmuka mengikuti locale; isi jurnal tetap dalam bahasa aslinya.
const types = computed(() => {
  const list: TipeOption[] = [
    { value: "all", label: isEn.value ? "All" : "Semua", warna: "neutral" },
    {
      value: "event-reflection",
      label: "Event Reflection",
      warna: "secondary",
    },
    { value: "sharing-journey", label: "Sharing Journey", warna: "primary" },
    { value: "insight", label: "Insight", warna: "accent" },
    { value: "practice", label: "Practice", warna: "stone" },
  ];
  return list;
});

const sortOptions = computed(() => {
  const list: SortOption[] = [
    {
      value: "newest",
      label: isEn.value ? "Newest" : "Terbaru",
      icon: "i-lucide-arrow-down-wide-narrow",
    },
    {
      value: "oldest",
      label: isEn.value ? "Oldest" : "Terlama",
      icon: "i-lucide-arrow-up-narrow-wide",
    },
  ];
  return list;
});

const ikonUrutan = computed(
  () =>
    sortOptions.value.find((o) => o.value === sortOrder.value)?.icon ??
    "i-lucide-arrow-down-wide-narrow",
);

const teks = computed(() =>
  isEn.value
    ? {
        eyebrow: "Journal",
        judul: "Stories that accompany the journey.",
        intro:
          "Reflections written by event participants — experiences, perspectives, and good practices shared by our Contributors and reviewed by Editors.",
        tipe: "Type",
        event: "Event",
        urutkan: "Sort",
        cari: "Search journal titles or content",
        semuaEvent: "All events",
        baca: "Read more",
        kosong: "No journal matches your search or filter yet.",
        reset: "Reset",
      }
    : {
        eyebrow: "Jurnal",
        judul: "Cerita yang menemani perjalanan.",
        intro:
          "Tulisan hasil refleksi peserta acara, sharing pengalaman, pandangan, dan praktik baik dari para Kontributor dan direview oleh Editor.",
        tipe: "Tipe jurnal",
        event: "Nama event",
        urutkan: "Urutkan",
        cari: "Cari judul atau isi jurnal",
        semuaEvent: "Semua event",
        baca: "Baca lebih lanjut",
        kosong:
          "Belum ada jurnal yang sesuai dengan pencarian atau filter Anda.",
        reset: "Reset",
      },
);

// Daftar jurnal kini dibaca dari database lewat /api/jurnal — dulu array tetap di
// berkas ini, yang sudah menyimpang dari daftar admin di `shared/jurnal.ts`
// (judul sama, isi berbeda, dan tidak ada yang memberi tahu saat keduanya berbeda).
// Endpoint hanya mengirim yang berstatus `terbit`; draft dan yang sedang direview
// tidak pernah sampai ke sini.
//
// Tanpa `await`, seperti halaman event: dengan await, <script setup> jadi async dan
// Vue menahan seluruh komponen sampai fetch selesai — digabung pageTransition
// 'out-in', itu yang membuat layar kosong sesaat tiap berpindah bahasa.
const { data: hasil, status: muatStatus } = useFetch("/api/jurnal");

const memuatAwal = computed(
  () => muatStatus.value === "pending" && !hasil.value,
);

/** Bentuk kartu di layar, disusun dari baris database. Nama kolomnya sengaja
    dipertahankan seperti versi statis (title/excerpt/contributor/…) supaya seluruh
    template dan CSS `.journal-card` tidak perlu ikut berubah. */
const journals = computed(() =>
  (hasil.value?.data ?? []).map((row) => ({
    type: row.tipe as JournalType,
    title: (isEn.value ? (row.judulEn ?? row.judul) : row.judul) ?? "",
    excerpt:
      (isEn.value ? (row.ringkasanEn ?? row.ringkasan) : row.ringkasan) ?? "",
    contributor: row.kontributor,
    role: row.kontributorPeran ?? "",
    date: tanggalPanjang(row.tanggal),
    dateValue: String(row.tanggal ?? "").slice(0, 10),
    event: row.kegiatanJudul ?? "",
    slug: row.slug,
    path: `${base.value}/jurnal/${row.slug}`,
  })),
);

/** Tanggal terbit dalam WIB. Disimpan sebagai timestamp UTC; tanpa zona waktu,
    tulisan yang terbit pukul 06.00 pagi tampil bertanggal sehari sebelumnya. */
function tanggalPanjang(nilai: string | number | null) {
  if (!nilai) return "";
  return new Intl.DateTimeFormat(isEn.value ? "en-GB" : "id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(nilai));
}

const eventOptions = computed(() => [
  { value: "all", label: teks.value.semuaEvent },
  ...[
    ...new Set(
      journals.value
        .filter((journal) => journal.type === "event-reflection")
        .map((journal) => journal.event),
    ),
  ]
    .filter(Boolean)
    .map((event) => ({ value: event, label: event })),
]);

const typeLabel = (type: JournalType) =>
  types.value.find((item) => item.value === type)?.label ?? type;
const typeIcon = (type: JournalType) =>
  ({
    "event-reflection": "◫",
    "sharing-journey": "↝",
    insight: "✦",
    practice: "✓",
  })[type];

/** Hasil pencarian saja, tipe belum disaring. Dipisah karena angka di tiap chip
    dihitung dari sini: mengetik kata kunci ikut menurunkan angka semua chip,
    tapi menekan satu chip tidak mengubah angka chip lain — pola yang sama
    dengan `hasilCari`/`hitungFase` di halaman event. */
const hasilCari = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  if (!keyword) return journals.value;
  return journals.value.filter((journal) =>
    `${journal.title} ${journal.excerpt}`.toLowerCase().includes(keyword),
  );
});

/** Angka di dalam tiap chip tipe. */
const hitungTipe = computed<Record<string, number>>(() => {
  const hasilHitung: Record<string, number> = { all: hasilCari.value.length };
  for (const t of types.value) {
    if (t.value === "all") continue;
    hasilHitung[t.value] = hasilCari.value.filter(
      (journal) => journal.type === t.value,
    ).length;
  }
  return hasilHitung;
});

const filteredJournals = computed(() =>
  hasilCari.value
    .filter(
      (journal) =>
        selectedType.value === "all" || journal.type === selectedType.value,
    )
    .filter(
      (journal) =>
        selectedType.value !== "event-reflection" ||
        selectedEvent.value === "all" ||
        journal.event === selectedEvent.value,
    )
    .sort((a, b) =>
      sortOrder.value === "newest"
        ? b.dateValue.localeCompare(a.dateValue)
        : a.dateValue.localeCompare(b.dateValue),
    ),
);

const adaFilter = computed(
  () =>
    selectedType.value !== "all" ||
    selectedEvent.value !== "all" ||
    Boolean(search.value.trim()) ||
    sortOrder.value !== "newest",
);

const resetFilter = () => {
  selectedType.value = "all";
  selectedEvent.value = "all";
  search.value = "";
  sortOrder.value = "newest";
};

// Render bertahap. Sumbernya `filteredJournals` yang SUDAH tersaring, jadi
// pencarian & filter tetap menjangkau seluruh jurnal meski baru sebagian kartu
// yang pernah tergambar.
const {
  items: journalsTampil,
  sentinel,
  adaLagi,
  sisa,
  muatLagi,
} = useInfiniteList(filteredJournals, { awal: 9, tambah: 6 });

// ── Sorotan dari log kerja ───────────────────────────────────────────────────
//
// Log master menautkan baris "diterbitkan" ke halaman ini dengan `?sorot={slug}`.
// Yang dibutuhkan di ujung tautan itu bukan sekadar sampai ke halamannya, tapi tahu
// KARTU YANG MANA di antara belasan — jadi kartunya digulir ke tengah layar lalu
// berkedip dua kali dalam satu detik.
//
// Kedipan, bukan sorotan yang menetap: yang menetap harus dimatikan oleh sesuatu
// (klik di luar, jeda waktu, tombol tutup), dan tiap-tiapnya adalah keadaan
// tambahan yang harus diurus. Yang berkedip sekali lalu selesai tidak meninggalkan
// apa pun untuk dibersihkan.
const sorot = computed(() => String(route.query.sorot ?? ""));
const kartuSorot = ref<HTMLElement | null>(null);

const pasangKartu = (
  el: Element | ComponentPublicInstance | null,
  slug: string,
) => {
  if (slug === sorot.value && el instanceof HTMLElement) kartuSorot.value = el;
};

// Menunggu kartunya benar-benar ada. `journalsTampil` terisi sesudah useFetch
// selesai, jadi onMounted saja akan menggulir ke elemen yang belum tergambar.
// `flush: 'post'` supaya DOM-nya sudah diperbarui saat callback berjalan.
watch(
  kartuSorot,
  (el) => {
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  },
  { flush: "post" },
);
</script>

<template>
  <!-- Susunannya kini sama persis dengan halaman event: SATU `.container` yang
       mengalir dari kepala halaman sampai kaki daftar, di atas satu latar yang
       berganti warna di tengah jalan.

       Sebelumnya halaman ini dua bagian bertumpuk — `.journal-hero` hijau setinggi
       300px lalu `.journal-listing` krem — dan keduanya berhenti tepat di garis
       yang sama. Yang tergambar adalah dua blok yang bersinggungan, bukan satu
       halaman: tidak ada satu pun elemen yang menyeberangi garis warnanya, jadi
       garis itu terbaca sebagai jahitan.

       Di halaman event garisnya tidak dijaga oleh siapa pun — ia cuma titik henti
       pada gradien `.event-page`, dan baris kartu pertama kebetulan menabraknya.
       Tabrakan itu yang membuat kedua warnanya terbaca sebagai satu bidang dengan
       pita di atasnya, bukan dua bagian yang ditempel. Halaman ini sekarang
       memakai mekanisme yang sama — lihat `.journal-page` di main.css, yang
       meminjam deklarasi `.event-page` alih-alih menyalin nilainya. -->
  <main class="journal-page">
    <div class="container">
      <div class="page-head">
        <div class="eyebrow">{{ teks.eyebrow }}</div>
        <h1>{{ teks.judul }}</h1>
        <p>{{ teks.intro }}</p>
      </div>

      <!-- Bilah penyaring (ponsel). Bentuk, warna, dan perilakunya sama persis
           dengan halaman event: menempel di bawah navbar, bukan melayang di
           kaki layar.

           Tanpa `mt`: jaraknya dari kepala halaman diatur `margin-bottom` pada
           `.page-head`, satu tempat yang sama dengan halaman event. Di ponsel
           margin itu nol supaya bilah hijaunya menempel langsung pada pita
           kepala dan keduanya terbaca sebagai satu blok. -->
      <div class="filter-bar sticky z-30 mb-3 px-4 py-2 sm:hidden">
        <div class="flex items-center gap-2">
          <UInput
            v-model="search"
            icon="i-lucide-search"
            :placeholder="teks.cari"
            class="min-w-0 flex-1"
            :ui="{ base: 'rounded-full' }"
          >
            <template v-if="search" #trailing>
              <UButton
                color="secondary"
                variant="link"
                size="sm"
                icon="i-lucide-x"
                class="text-cc-brown-500 hover:text-cc-brown-600"
                :aria-label="isEn ? 'Clear search' : 'Kosongkan pencarian'"
                @click="search = ''"
              />
            </template>
          </UInput>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-sliders-horizontal"
            size="lg"
            class="relative shrink-0 rounded-full bg-white/10 text-white hover:bg-white/20"
            :aria-label="teks.tipe"
            @click="lembarFilter = true"
          >
            <span
              v-if="jumlahFilterAktif"
              class="absolute -end-1 -top-1 grid size-4 place-items-center rounded-full bg-cc-brown-500 text-[10px] font-bold text-white"
            >
              {{ jumlahFilterAktif }}
            </span>
          </UButton>
        </div>
      </div>

      <!-- Baris filter desktop: chip tipe (+ reset) di kiri, event + cari +
           urutan di kanan. Bentuknya mengikuti penyaring fase di halaman
           event — lihat catatan lengkap di sana. `sm` ke atas saja; di ponsel
           pindah ke bilah bawah dan lembar filter. -->
      <div
        class="journal-filter mb-7 hidden flex-wrap items-center justify-between gap-3 sm:flex"
      >
        <div class="flex w-full min-w-0 items-center gap-1 sm:w-auto">
          <div
            role="group"
            :aria-label="teks.tipe"
            class="grid w-full grid-cols-2 gap-1 rounded-2xl bg-cc-stone-100 p-1 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-1.5 sm:rounded-full"
          >
            <button
              v-for="ti in types"
              :key="ti.value"
              type="button"
              class="inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors sm:w-auto sm:rounded-full sm:py-1.5"
              :class="
                selectedType === ti.value
                  ? warnaChip[ti.warna]
                  : 'bg-white text-cc-stone-600 hover:text-cc-green-800 sm:bg-transparent sm:hover:bg-white'
              "
              :aria-pressed="selectedType === ti.value"
              @click="selectedType = ti.value"
            >
              {{ ti.label }}
              <span
                class="rounded-full px-1.5 py-0.5 text-[11px] tabular-nums"
                :class="
                  selectedType === ti.value
                    ? 'bg-white/25'
                    : 'bg-cc-stone-100 text-cc-stone-500 sm:bg-white'
                "
              >
                {{ hitungTipe[ti.value] ?? 0 }}
              </span>
            </button>
          </div>

          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-rotate-ccw"
            :class="adaFilter ? '' : 'invisible pointer-events-none'"
            :ui="{
              base: 'event-reset hidden shrink-0 rounded-full px-2 sm:inline-flex',
            }"
            @click="resetFilter"
          >
            {{ teks.reset }}
          </UButton>
        </div>

        <!-- `justify-end`, sama dengan halaman event — bukan `justify-start`.
             Kelompok ini `flex-1`, jadi ia selalu selebar sisa baris; dengan
             `start` isinya menempel pada chip di kirinya dan menyisakan lubang
             di tepi kanan yang lebarnya berubah-ubah mengikuti jumlah chip yang
             sedang tergambar. Dengan `end` tepi kanan kotak urutan selalu
             sejajar dengan tepi kanan kartu di bawahnya. -->
        <!-- TANPA `min-w-0`, dan itu yang sebenarnya membuat barisnya turun.

             `min-w-0` pada kelompok flex menghapus lantai `min-width: auto`
             bawaannya — lantai yang nilainya sama dengan lebar min-content isinya.
             Tanpa lantai itu, pemutus baris melihat kelompok ini masih "muat" pada
             `basis-80` (320px) berapa pun lebar isi sebenarnya, jadi ia tidak
             pernah dipindah ke baris kedua; yang terjadi isinya meluber keluar
             kotaknya sendiri. Percobaan pertama cuma memberi lantai pada kotak
             carinya, dan hasilnya persis itu: ketiga kotak berjumlah 528px di dalam
             wadah selebar 426px.

             Halaman event menyimpan `min-w-0` dan itu benar di sana — dua kotak,
             tidak pernah melewati sisa ruangnya, dan lantai min-content justru
             akan menurunkan barisnya lebih awal dari yang perlu. -->
        <div
          class="flex flex-1 basis-80 flex-wrap items-center justify-end gap-2 sm:flex-nowrap"
        >
          <!-- Event hanya berarti saat tipenya refleksi event. -->
          <USelect
            v-if="selectedType === 'event-reflection'"
            v-model="selectedEvent"
            :items="eventOptions"
            value-key="value"
            :aria-label="teks.event"
            class="w-full shrink-0 sm:w-44"
            :ui="{ base: 'rounded-full' }"
          />

          <!-- `sm:min-w-48`, dan halaman event tidak punya ini.

               Di sana baris kanannya cuma dua kotak (cari + urutan), jadi
               `min-w-0` benar: kotak cari boleh menyusut lebih dulu sebelum apa
               pun terdorong turun. Di sini ada kotak KETIGA yang muncul begitu
               kategorinya "Refleksi Event", dan chip kirinya lima, bukan empat.

               Diukur pada 1280px: kelompok kiri 722px, jadi yang tersisa untuk
               kelompok kanan 426px — dan `min-w-0` membiarkan kotak cari menyerap
               seluruh kekurangannya sendirian, menyusut sampai 74px. Yang tergambar
               bukan kotak cari melainkan tulisan "Cari" yang terpotong di dalam
               kapsul selebar tombol.

               Dengan lantai 192px, lebar minimum kelompok kanan (176+192+160+16 =
               544px) melewati sisa ruangnya, jadi `flex-wrap` di baris induk
               menurunkannya satu baris penuh — persis susunan dua baris yang sudah
               dijelaskan di catatan halaman event, dan yang di sana memang tidak
               pernah terpicu karena kotaknya cuma dua. -->
          <UInput
            v-model="search"
            icon="i-lucide-search"
            :placeholder="teks.cari"
            class="min-w-0 flex-1 sm:min-w-48 lg:max-w-96"
            :ui="{ base: 'rounded-full' }"
          >
            <template v-if="search" #trailing>
              <UButton
                color="secondary"
                variant="link"
                size="sm"
                icon="i-lucide-x"
                class="text-cc-brown-500 hover:text-cc-brown-600"
                :aria-label="isEn ? 'Clear search' : 'Kosongkan pencarian'"
                @click="search = ''"
              />
            </template>
          </UInput>

          <USelect
            v-model="sortOrder"
            :items="sortOptions"
            value-key="value"
            :icon="ikonUrutan"
            :aria-label="teks.urutkan"
            class="w-full shrink-0 sm:w-40"
            :ui="{ base: 'rounded-full' }"
          />
        </div>
      </div>

      <!-- Baris "N jurnal ditemukan" DICABUT, dan itu bukan sekadar mengejar
           kemiripan dengan halaman event.

           Angkanya sudah ada di dalam chip yang sedang aktif: `hitungTipe`
           dihitung dari `hasilCari` — daftar yang SUDAH disaring kata pencarian —
           jadi chip "Semua 8" dan kalimat "8 jurnal ditemukan" selalu menyebut
           bilangan yang sama. Yang kedua cuma mengulanginya satu baris di bawah.

           Yang membuatnya harus dicabut, bukan sekadar boleh: barisnya berdiri
           tepat di sekitar titik henti 300px, dan sisi mana ia mendarat berubah
           mengikuti lebar layar — judul yang membungkus dua baris menggesernya
           dari hijau ke krem. Satu warna teks tidak bisa benar di kedua latar itu:
           putih hilang di krem, abu-abu hilang di hijau. Barisnya bukan salah
           warna, ia berada di tempat yang tidak punya latar tetap.

           Yang hilang hanya satu keadaan: saat kategorinya "Refleksi Event" DAN
           sebuah event dipilih, chip masih menyebut jumlah seluruh refleksi event,
           bukan jumlah untuk event itu saja. Kalau itu perlu terbaca, tempatnya di
           dalam chip — bukan baris terpisah yang mengambang di batas warna. -->
      <div class="journal-grid">
        <article
          v-for="journal in journalsTampil"
          :key="journal.slug"
          :ref="(el) => pasangKartu(el, journal.slug)"
          class="journal-card"
          :class="journal.slug === sorot ? 'is-sorot' : ''"
        >
          <div
            class="journal-card-icon"
            :class="`icon-${journal.type}`"
            :aria-label="typeLabel(journal.type)"
          >
            {{ typeIcon(journal.type) }}
          </div>
          <div class="journal-type">{{ typeLabel(journal.type) }}</div>
          <!-- Nama event DISEMBUNYIKAN sementara atas permintaan — dua baris
               huruf kapital bertumpuk (kategori lalu nama event) terbaca berat
               di kepala kartu. Datanya tetap utuh: `kegiatanId` tersimpan, kolom
               pilihannya tetap ada di halaman sunting admin, dan penyaring
               "Nama event" di atas tetap bekerja. Kembalikan barisnya begitu
               kepala kartunya ditata ulang.
          <div v-if="journal.event" class="journal-event">{{ journal.event }}</div>
          -->
          <h2>{{ journal.title }}</h2>
          <p>{{ journal.excerpt }}</p>
          <div class="journal-meta">
            <strong>{{ journal.contributor }}</strong> · {{ journal.role
            }}<br /><time :datetime="journal.dateValue">{{
              journal.date
            }}</time>
          </div>
          <UButton
            :to="journal.path"
            color="secondary"
            variant="solid"
            trailing-icon="i-lucide-arrow-right"
            class="mt-auto"
          >
            {{ teks.baca }}
          </UButton>
        </article>
      </div>

      <!-- Penanda kaki daftar: begitu masuk viewport, kartu berikutnya dimuat. -->
      <div v-if="adaLagi" ref="sentinel" class="journal-more">
        <UButton color="neutral" variant="link" @click="muatLagi">
          {{ isEn ? `Load ${sisa} more` : `Muat ${sisa} jurnal lagi` }}
        </UButton>
      </div>
      <p v-if="!filteredJournals.length && !memuatAwal" class="journal-empty">
        {{ teks.kosong }}
      </p>
    </div>

    <!-- Lembar penyaring. Tanpa tombol terapkan: tiap pilihan berlaku seketika dan
         lembarnya menutup sendiri. -->
    <USlideover
      v-model:open="lembarFilter"
      side="bottom"
      :title="isEn ? 'Filter & sort' : 'Saring & urutkan'"
    >
      <template #body>
        <div class="space-y-4">
          <div>
            <p class="mb-1.5 text-xs font-semibold text-cc-stone-500">
              {{ teks.tipe }}
            </p>
            <div
              role="group"
              :aria-label="teks.tipe"
              class="grid grid-cols-2 gap-2"
            >
              <button
                v-for="ti in types"
                :key="ti.value"
                type="button"
                class="flex items-center justify-between gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition-colors"
                :class="
                  selectedType === ti.value
                    ? 'border-cc-green-800 bg-cc-green-800 text-white'
                    : 'border-cc-stone-200 bg-white text-cc-stone-600'
                "
                :aria-pressed="selectedType === ti.value"
                @click="
                  selectedType = ti.value;
                  lembarFilter = false;
                "
              >
                {{ ti.label }}
                <span
                  class="rounded-full px-1.5 py-0.5 text-[11px] tabular-nums"
                  :class="
                    selectedType === ti.value
                      ? 'bg-white/25'
                      : 'bg-cc-stone-100 text-cc-stone-500'
                  "
                >
                  {{ hitungTipe[ti.value] ?? 0 }}
                </span>
              </button>
            </div>
          </div>

          <!-- Pemilih event hanya berarti saat kategorinya refleksi event; di luar
               itu ia menawarkan penyaringan yang tidak menyaring apa pun. -->
          <div v-if="selectedType === 'event-reflection'">
            <p class="mb-1.5 text-xs font-semibold text-cc-stone-500">
              {{ teks.event }}
            </p>
            <USelect
              v-model="selectedEvent"
              :items="eventOptions"
              value-key="value"
              class="w-full"
              @update:model-value="lembarFilter = false"
            />
          </div>

          <div>
            <p class="mb-1.5 text-xs font-semibold text-cc-stone-500">
              {{ teks.urutkan }}
            </p>
            <USelect
              v-model="sortOrder"
              :items="sortOptions"
              value-key="value"
              :icon="ikonUrutan"
              class="w-full"
              @update:model-value="lembarFilter = false"
            />
          </div>
        </div>
      </template>
    </USlideover>
  </main>
</template>
