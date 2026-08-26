<script setup lang="ts">
const route = useRoute();
const base = computed(() => (route.path.startsWith("/en") ? "/en" : "/id"));
const isEn = computed(() => base.value === "/en");

useSeoMeta({
  title: () => (isEn.value ? "Events" : "Event"),
  description: () =>
    isEn.value
      ? "Workshops, learning programs, and practicums on compassionate leadership — upcoming, ongoing, and past gatherings."
      : "Lokakarya, program pembelajaran, dan practicum kepemimpinan penuh belas kasih — event mendatang, sedang berlangsung, dan yang telah selesai.",
});

// ── Filter ───────────────────────────────────────────────────────────────────
// Fase dulunya dropdown; sekarang chip berjajar, bentuk yang sama dengan penyaring
// status di dashboard (tab peserta, daftar event). Alasannya sama seperti di sana:
// tiga fase itu saling meniadakan dan jumlahnya sedikit, jadi menyembunyikannya di
// balik dropdown menukar satu klik jadi dua tanpa menghemat apa pun — sementara
// jumlah per fase yang menyatu di dalam chip hanya bisa terbaca kalau semuanya
// tampak sekaligus.
//
// Nilai "semua" tetap dipakai sebagai sentinel, bukan string kosong.
const fase = ref("semua");

// Ikonnya sama persis dengan ikon badge fase di kartu, supaya pilihan filter dan
// penanda di kartu terbaca sebagai satu hal yang sama. Disimpan tapi belum
// digambar — barisnya di template masih dikomentari, tinggal dibuka kalau chip
// polos ternyata kurang terbaca.
const FASE_TAB = computed(() => [
  {
    key: "semua",
    label: isEn.value ? "All" : "Semua",
    warna: "neutral",
    ikon: "i-lucide-layers",
  },
  {
    key: "berlangsung",
    label: isEn.value ? "Ongoing" : "Berlangsung",
    warna: "secondary",
    ikon: "i-lucide-radio",
  },
  {
    key: "mendatang",
    label: isEn.value ? "Upcoming" : "Mendatang",
    warna: "primary",
    ikon: "i-lucide-calendar-clock",
  },
  {
    key: "selesai",
    label: isEn.value ? "Completed" : "Selesai",
    warna: "stone",
    ikon: "i-lucide-check",
  },
]);

/**
 * Warna chip yang sedang aktif, ditulis sebagai kelas utuh — bukan disusun dari
 * potongan seperti `bg-cc-${warna}-500`. Tailwind memindai berkas sebagai teks;
 * nama kelas yang baru terbentuk saat runtime tidak pernah ikut diterbitkan, dan
 * chipnya jadi transparan tanpa satu pun galat.
 */
const warnaChip: Record<string, string> = {
  neutral: "bg-cc-stone-700 text-white",
  secondary: "bg-cc-brown-600 text-white",
  primary: "bg-cc-green-800 text-white",
  stone: "bg-cc-stone-500 text-white",
};

// Pencarian disaring di klien, bukan lewat query API: daftar event sebuah
// komunitas berukuran puluhan, bukan ribuan, jadi satu perjalanan ke server per
// ketikan hanya menambah jeda tanpa menambah ketepatan.
const cari = ref("");

// ── Urutan ───────────────────────────────────────────────────────────────────
// Diurutkan di klien dengan alasan yang sama seperti pencarian: seluruh daftar
// sudah ada di tangan, jadi mengurutkannya di server berarti satu perjalanan
// tambahan untuk pekerjaan yang di sini memakan waktu tidak terukur.
//
// `terbaru` bukan sekadar bawaan melainkan urutan yang memang dikirim server
// (`desc(tanggalMulai)`); menaruhnya lebih dulu membuat pilihan awal tidak
// mengubah apa pun.
//
// Namanya dulu "Terdekat dulu"/"Terjauh dulu" dan artinya terbalik dari yang
// sekarang: yang terdekat itu tanggal paling awal, yaitu event paling lama.
// Penggantian namanya karena itu ikut menukar arah urutnya, bukan cuma teksnya.
//
// Empat pilihan, bukan enam. "Terbaru ditambahkan" dan "Batas daftar terdekat"
// dicabut atas permintaan: keduanya mengurutkan menurut hal yang tidak terbaca di
// kartu — tanggal baris itu dibuat, dan tenggat yang hanya sebagian event punya —
// sehingga hasilnya tampak acak bagi yang memilihnya.
const urutan = ref("terbaru");

const urutanOptions = computed(() => [
  {
    value: "terbaru",
    label: isEn.value ? "Newest" : "Terbaru",
    icon: "i-lucide-arrow-down-wide-narrow",
  },
  {
    value: "terlama",
    label: isEn.value ? "Oldest" : "Terlama",
    icon: "i-lucide-arrow-up-narrow-wide",
  },
  {
    value: "az",
    label: isEn.value ? "Title A–Z" : "Judul A–Z",
    icon: "i-lucide-arrow-down-a-z",
  },
  {
    value: "za",
    label: isEn.value ? "Title Z–A" : "Judul Z–A",
    icon: "i-lucide-arrow-up-a-z",
  },
]);

const ikonUrutan = computed(
  () =>
    urutanOptions.value.find((o) => o.value === urutan.value)?.icon ??
    "i-lucide-arrow-down-wide-narrow",
);

// Penyaring tanggal dicabut atas permintaan. Tiga kontrol yang tersisa — cari,
// kategori, urutan — sudah menjawab pertanyaan yang sama untuk daftar sepanjang
// belasan event, sementara kalendernya menuntut satu keputusan lagi yang hampir
// selalu menghasilkan daftar kosong. Parameter `dari` di GET /api/events masih
// diterima server; yang hilang hanya pemakainya di sini.

// Fase tidak lagi dikirim sebagai query. Sejak angkanya digambar di dalam chip,
// daftar yang dipegang halaman harus memuat SEMUA fase — kalau server sudah
// menyaringnya, tiga chip lain langsung jadi (0) begitu satu chip ditekan. Satu
// pengambilan untuk seumur halaman, penyaringannya di klien seperti pencarian dan
// urutan; alasannya pun sama: daftarnya puluhan, bukan ribuan.
//
// Sengaja TANPA `await`. Dengan await, <script setup> jadi async dan Vue menahan
// seluruh komponen sampai fetch selesai; digabung pageTransition mode 'out-in',
// halaman lama keluar dulu lalu yang baru ditahan — itu yang membuat layar kosong
// beberapa saat saat berpindah bahasa atau keluar akun. Tanpa await, kerangka
// halaman langsung tergambar dan hanya isinya yang dirangkai.
const { data, status } = useFetch("/api/events");

/** Muat pertama: belum ada data sama sekali. Muat ulang karena filter tidak
    dihitung di sini — kartu yang sudah ada lebih baik tetap terlihat. */
const memuatAwal = computed(() => status.value === "pending" && !data.value);

const semuaEvent = computed(() => data.value?.data ?? []);

/** Hasil pencarian saja, fasenya belum disaring. Dipisah karena angka di chip
    dihitung dari sini: mengetik "listening" harus ikut menurunkan angka tiap fase,
    tapi menekan chip tidak boleh mengubah angka chip lain. */
const hasilCari = computed(() => {
  const kata = cari.value.trim().toLowerCase();
  if (!kata) return semuaEvent.value;
  return semuaEvent.value.filter((e: any) =>
    [e.judul, e.judulEn, e.deskripsi, e.deskripsiEn, e.lokasi].some((nilai) =>
      String(nilai ?? "")
        .toLowerCase()
        .includes(kata),
    ),
  );
});

/** Angka di dalam chip. `meta.perFase` dari server tidak dipakai lagi: ia tidak
    tahu apa yang sedang diketik di kotak cari. "Semua" sengaja dihitung dari
    panjang daftar, bukan dari penjumlahan ketiga fase — event berstatus `batal`
    ikut tampil di halaman ini tapi tidak punya chip sendiri, dan penjumlahan
    ketiganya akan meleset sebanyak itu. */
const hitungFase = computed<Record<string, number>>(() => {
  const hasil: Record<string, number> = {
    semua: hasilCari.value.length,
    mendatang: 0,
    berlangsung: 0,
    selesai: 0,
  };
  for (const e of hasilCari.value as any[]) {
    if (e.fase in hasil) hasil[e.fase] = (hasil[e.fase] ?? 0) + 1;
  }
  return hasil;
});

const tersaring = computed(() =>
  fase.value === "semua"
    ? hasilCari.value
    : hasilCari.value.filter((e: any) => e.fase === fase.value),
);

const waktuDari = (nilai: string | null) =>
  nilai ? new Date(nilai).getTime() : 0;

/** Judul menurut bahasa yang sedang dibuka — mengurutkan /en menurut judul
    Indonesia akan menghasilkan abjad yang tidak terbaca di layar. */
const judulUrut = (e: any) =>
  String((isEn.value ? (e.judulEn ?? e.judul) : e.judul) ?? "");

const events = computed(() => {
  const daftar = [...tersaring.value];
  switch (urutan.value) {
    case "terlama":
      return daftar.sort(
        (a, b) => waktuDari(a.tanggalMulai) - waktuDari(b.tanggalMulai),
      );
    case "az":
      return daftar.sort((a, b) =>
        judulUrut(a).localeCompare(judulUrut(b), isEn.value ? "en" : "id"),
      );
    case "za":
      return daftar.sort((a, b) =>
        judulUrut(b).localeCompare(judulUrut(a), isEn.value ? "en" : "id"),
      );
    default:
      return daftar.sort(
        (a, b) => waktuDari(b.tanggalMulai) - waktuDari(a.tanggalMulai),
      );
  }
});

// Render bertahap. `events` sudah tersaring, jadi pencarian tetap menjangkau
// seluruh data meski baru sebagian kartu yang tergambar.
const {
  items: eventsTampil,
  sentinel,
  adaLagi,
  sisa,
  muatLagi,
} = useInfiniteList(events, { awal: 9, tambah: 6 });

const adaFilter = computed(
  () =>
    fase.value !== "semua" ||
    Boolean(cari.value.trim()) ||
    urutan.value !== "terbaru",
);

const resetFilter = () => {
  fase.value = "semua";
  cari.value = "";
  urutan.value = "terbaru";
};

/**
 * Penyaring di layar sempit tinggal di BILAH BAWAH, bukan di atas daftar.
 *
 * Ditaruh di atas, ia memakan sekitar sepertiga layar pertama: chip, kotak cari,
 * dan kotak urutan berdiri di antara judul halaman dan kartu event pertama —
 * sehingga yang dilihat orang saat halaman terbuka adalah alat untuk menyaring,
 * bukan hal yang mau disaringnya. Di bawah, layar pertama langsung berisi
 * eventnya, dan penyaringnya justru lebih dekat ke jempol.
 *
 * Polanya sama dengan bilah alamat Safari dan Chrome ponsel sekarang: satu bilah
 * tipis yang menempel di bawah, dan yang lebih rinci terbuka sebagai lembar.
 *
 * Hanya `sm` ke bawah. Di layar lebar barisnya kembali ke atas daftar, tempat ia
 * tidak menutupi apa pun dan tetikus tidak punya "jempol" yang perlu didekati.
 */
const lembarFilter = ref(false);
/**
 * Menandai <body> selama halaman ini terbuka, supaya CSS bisa memberi ruang di
 * UJUNG halaman untuk bilah penyaring yang `fixed`.
 *
 * Ruang itu tidak bisa lagi berupa elemen kosong di dalam <main>: footer berdiri
 * SESUDAH <main>, dan bilah yang melayang menutupi baris terakhirnya. Nuxt melepas
 * kelas ini sendiri saat berpindah halaman, jadi halaman lain tidak ikut berpadding.
 */
useHead({ bodyAttrs: { class: 'ada-filter-bar' } })


/** Label fase yang sedang aktif, untuk dibaca di bilah bawah tanpa membukanya. */
const labelFaseAktif = computed(
  () => FASE_TAB.value.find(f => f.key === fase.value)?.label ?? "",
);

/** Berapa penyaring yang sedang menyala — digambar sebagai angka kecil di tombol
    filter, supaya keadaan tersaring terbaca tanpa membuka lembarnya. */
const jumlahFilterAktif = computed(
  () =>
    (fase.value !== "semua" ? 1 : 0) + (urutan.value !== "terbaru" ? 1 : 0),
);

// ── Tampilan ─────────────────────────────────────────────────────────────────
// Semua badge dibuat `solid` karena kini duduk di atas gambar sampul — varian
// `subtle` yang transparan jadi tidak terbaca di sana.
const badge = (f: string) =>
  ({
    mendatang: {
      color: "primary" as const,
      variant: "solid" as const,
      icon: "i-lucide-calendar-clock",
      label: isEn.value ? "Upcoming" : "Mendatang",
    },
    berlangsung: {
      color: "secondary" as const,
      variant: "solid" as const,
      icon: "i-lucide-radio",
      label: isEn.value ? "Ongoing" : "Berlangsung",
    },
    selesai: {
      color: "neutral" as const,
      variant: "solid" as const,
      icon: "i-lucide-check",
      label: isEn.value ? "Completed" : "Selesai",
    },
    batal: {
      color: "error" as const,
      variant: "solid" as const,
      icon: "i-lucide-x",
      label: isEn.value ? "Cancelled" : "Dibatalkan",
    },
  })[f] ?? {
    color: "neutral" as const,
    variant: "solid" as const,
    icon: "i-lucide-circle",
    label: f,
  };

/** Sampul: dari DB bila ada, kalau tidak gambar statis milik event itu, kalau tidak
    template. Aturannya tinggal di utils/mediaHelper.ts supaya kartu di sini dan
    halaman detail tidak pernah menampilkan gambar yang berbeda. */
const sampul = (e: { slug: string; cover?: string | null }) =>
  sampulEvent(e.slug, e.cover);

// Tanggal disimpan sebagai timestamp UTC; tampilkan dalam WIB supaya tidak
// bergeser sehari bagi pembaca di Indonesia.
const tanggal = (nilai: string | null, panjang = false) => {
  if (!nilai) return "";
  return new Intl.DateTimeFormat(isEn.value ? "en-GB" : "id-ID", {
    day: "numeric",
    month: panjang ? "long" : "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(nilai));
};

/** Apakah dua timestamp jatuh pada hari yang sama menurut WIB. */
const hariSama = (a: string | null, b: string | null) => {
  if (!a || !b) return true;
  const ymd = (n: string) =>
    new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Asia/Jakarta",
    }).format(new Date(n));
  return ymd(a) === ymd(b);
};

/**
 * Baris tanggal pada kartu.
 *
 * Event sehari  -> tanggal + jam. Tanggal selesainya sama dengan tanggal mulai,
 *                  jadi mengulanginya tidak menambah apa pun; jamnya justru yang
 *                  menentukan apakah orang bisa ikut.
 * Event berhari -> rentang tanggal. Di sini jam per hari belum tentu seragam,
 *                  sehingga satu jam tunggal malah menyesatkan; rinciannya ada
 *                  di halaman detail.
 */
const barisTanggal = (e: any) => {
  if (!hariSama(e.tanggalMulai, e.tanggalSelesai)) {
    return `${tanggal(e.tanggalMulai)} – ${tanggal(e.tanggalSelesai)}`;
  }
  const tgl = tanggal(e.tanggalMulai, true);
  const jam = rentangJam(e, isEn.value);
  return jam ? `${tgl} · ${jam}` : tgl;
};

/**
 * Baris batas pendaftaran pada kartu.
 *
 * Hanya digambar untuk event yang belum lewat: pada event yang sudah selesai,
 * "pendaftaran ditutup" mengulang apa yang sudah dikatakan badge di sampulnya.
 */
const batasDaftar = (e: any) =>
  e.fase === "selesai" || e.fase === "batal"
    ? ""
    : labelBatasDaftar(e, isEn.value);

const t = computed(() =>
  isEn.value
    ? {
        eyebrow: "Programs & gatherings",
        judul: "Compassionate Companion Events",
        intro:
          "A space for learning, reflection, and encounter for those who are sent.",
        filterCari: "Search events…",
        filterKategori: "Category",
        filterUrutan: "Sort events",
        reset: "Reset",
        // Jumlah hasil tidak lagi ditulis terpisah: angka di dalam chip yang
        // sedang aktif sudah menyebutkannya, dan ikut menyusut saat mengetik di
        // kotak cari.
        kosong: "No event matches this filter.",
        semua: "Showing all events",
        detail: "Event details",
        lokasi: "Location",
      }
    : {
        eyebrow: "Program & Perjumpaan",
        judul: "Event Compassionate Companion",
        intro: "Ruang belajar, refleksi, dan perjumpaan bagi para utusan.",
        filterCari: "Cari event…",
        filterKategori: "Kategori",
        filterUrutan: "Urutkan event",
        reset: "Reset",
        kosong: "Tidak ada event yang cocok dengan filter ini.",
        semua: "Menampilkan semua event",
        detail: "Detail event",
        lokasi: "Lokasi",
      },
);
</script>

<template>
  <main class="event-page">
    <div class="container">
      <div class="page-head">
        <div class="eyebrow">{{ t.eyebrow }}</div>
        <h1>{{ t.judul }}</h1>
        <p>{{ t.intro }}</p>
      </div>

      <!-- Filter: chip kategori (+ tombol reset) di kiri, cari + urutan di kanan.
           Bentuk chipnya mengikuti penyaring status di dashboard:
             · hitungannya menyatu di dalam chip, bukan badge terpisah yang membuat
               tiap tombol terbaca sebagai dua elemen;
             · yang tidak aktif dibuat rata dan tenang, sehingga satu yang aktif
               benar-benar menonjol;
             · tiap fase berwarna sendiri, warna yang sama dengan badge di sampul
               kartu — jadi warnanya ikut jadi penanda, bukan hiasan.
           `justify-between` baru berlaku saat muat; pada layar sempit keduanya
           menumpuk dan masing-masing memakai lebar penuh. -->
      <!-- Baris penyaring atas: `sm` ke atas saja. Di ponsel ia pindah ke bilah
           bawah — lihat blok di bawah daftar. -->
      <div
        class="event-filter mb-7 hidden flex-wrap items-center justify-between gap-3 sm:flex"
      >
        <!-- `w-full` di layar sempit supaya kisi chipnya berakhir di tepi yang sama
             dengan kotak cari di bawahnya.

             Reset dicabut sama sekali di bawah `sm` (lihat tombolnya di bawah), jadi
             tidak ada lagi yang perlu dilipat ke baris kedua di sini. Di layar sempit
             ia memang tidak punya tempat yang enak: `invisible` menyisakan lubang
             75px, sementara `hidden` yang muncul-hilang menggeser kisinya tiap kali
             filter menyala. Yang hilang bukan kemampuannya — menekan "Semua" dan
             mengosongkan kotak cari melakukan hal yang sama. -->
        <div class="flex w-full min-w-0 items-center gap-1 sm:w-auto">
          <!-- `role=group` + labelnya: empat tombol berjajar tanpa itu terbaca satu
               per satu oleh pembaca layar, tanpa keterangan bahwa keempatnya satu
               pilihan yang sama. -->
          <!-- Di layar sempit keempatnya jadi kisi 2x2, bukan barisan yang
               melipat. `flex-wrap` di dalam wadah `rounded-full` membuat wadahnya
               ikut memanjang ke bawah, dan yang tergambar bukan deretan chip
               melainkan satu gumpalan bulat besar setinggi empat baris dengan chip
               menempel di kirinya.

               Kisi dipilih, bukan gulir horizontal: keempat labelnya berjumlah
               sekitar 390px, cukup lewat sedikit dari lebar layar 375px — jadi
               menggulirnya cuma menyembunyikan satu pilihan tanpa menghemat apa
               pun, sementara kisi memperlihatkan semuanya sekaligus.

               UKURANNYA DIKUNCI SATU SAMA LAIN, dan itu yang membuat versi
               sebelumnya terlihat asal:

               · `gap-1` = `p-1`. Jarak antar-chip sama dengan jarak chip ke tepi
                 wadahnya, jadi "nat" di antara keempatnya selebar bingkai yang
                 mengelilinginya — bukan dua ukuran berbeda yang kebetulan
                 berdekatan.
               · radius KONSENTRIS: wadah `rounded-2xl` (16px), padding 4px, jadi
                 chipnya `rounded-xl` (12px) = 16 − 4. Sebelumnya chipnya
                 `rounded-full`, dan pil di dalam kotak bersudut tumpul tidak pernah
                 sejajar di pojok — lengkung chip memotong lengkung wadahnya, dan
                 selisih itu persis yang terbaca sebagai "tidak sinkron".

               Dari `sm` ke atas keduanya kembali ke bentuk pil berjajar, tempat
               `rounded-full` justru yang benar karena chipnya tidak lagi menempati
               pojok wadah. -->
          <div
            role="group"
            :aria-label="t.filterKategori"
            class="grid w-full grid-cols-2 gap-1 rounded-2xl bg-cc-stone-100 p-1 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-1.5 sm:rounded-full"
          >
            <!-- Yang TIDAK aktif pun punya bidangnya sendiri di layar sempit
                 (`bg-white`). Sebelumnya hanya chip aktif yang berlatar dan tiga
                 sisanya mengambang sebagai teks di atas beige — sebuah kisi 2x2
                 yang isinya satu kotak dan tiga label, bukan empat pilihan setara.
                 Dengan ubin, keempatnya terbaca sebagai satu kendali bersegmen, dan
                 yang aktif menonjol karena WARNANYA — bukan karena cuma dia yang
                 punya bentuk.

                 Di `sm` ke atas dikembalikan transparan: di sana bentuknya deretan
                 pil, dan empat pil putih berderet justru menghapus kesan satu
                 kelompok yang dibingkai bersama.

                 Lencana angkanya ikut bertukar (`bg-cc-stone-100` di bawah `sm`):
                 lencana putih di atas ubin putih hilang sama sekali. -->
            <button
              v-for="f in FASE_TAB"
              :key="f.key"
              type="button"
              class="inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors sm:w-auto sm:rounded-full sm:py-1.5"
              :class="
                fase === f.key
                  ? warnaChip[f.warna]
                  : 'bg-white text-cc-stone-600 hover:text-cc-green-800 sm:bg-transparent sm:hover:bg-white'
              "
              :aria-pressed="fase === f.key"
              @click="fase = f.key"
            >
              <!-- Ikon ditahan dulu atas permintaan; datanya sudah ada di
                   FASE_TAB, jadi menyalakannya cukup membuka baris ini. -->
              <!-- <UIcon :name="f.ikon" class="size-3.5" /> -->
              {{ f.label }}
              <span
                class="rounded-full px-1.5 py-0.5 text-[11px] tabular-nums"
                :class="
                  fase === f.key
                    ? 'bg-white/25'
                    : 'bg-cc-stone-100 text-cc-stone-500 sm:bg-white'
                "
              >
                {{ hitungFase[f.key] ?? 0 }}
              </span>
            </button>
          </div>

          <!-- Reset duduk di samping kategori, bukan di ujung kanan bersama cari
               dan urutan. Ia menghapus ketiganya sekaligus — termasuk kata yang
               sedang diketik dan urutan yang dipilih — jadi menempelkannya pada
               salah satu kotak di kanan membuatnya terbaca seperti milik kotak itu
               saja. Di sebelah chip ia berdiri sebagai "kembalikan penyaringnya",
               dan tempatnya tidak berpindah dari mana pun asal filternya menyala.

               Selalu digambar, disembunyikan dengan `invisible` saat tidak ada yang
               bisa direset — bukan `v-if`. Dengan v-if tombolnya lahir dan mati
               mengikuti filter, dan tempat yang ia rebut/lepaskan itulah yang
               melipat seluruh baris begitu satu kategori dipilih. Tempatnya kini
               tetap; yang berubah hanya terlihat atau tidak.

               Tulisannya dipertahankan, bukan ikon telanjang: ikon panah melingkar
               sendirian bisa terbaca sebagai "muat ulang". Ruangnya diambil dari
               kotak cari yang dibatasi `lg:max-w-96` — di layar selebar itu kotak
               cari yang memanjang sampai 470px cuma ruang kosong. -->
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-rotate-ccw"
            :class="adaFilter ? '' : 'invisible pointer-events-none'"
            :ui="{ base: 'event-reset hidden shrink-0 rounded-full px-2 sm:inline-flex' }"
            @click="resetFilter"
          >
            {{ t.reset }}
          </UButton>
        </div>

        <!-- Urutan duduk sebaris dengan pencarian, bukan di atas daftar: keduanya
             mengubah apa yang terlihat, dan memisahkannya membuat orang mencari
             sortir di tempat yang salah.

             Tiga hal yang membuat baris ini berhenti terlipat setengah:
             · `flex-nowrap` di dalam — keduanya satu kesatuan, jadi yang pindah
               baris seluruh kelompok, bukan kotak urutan sendirian di bawah kotak
               cari;
             · `flex-1 basis-80` — di layar lebar ia mengisi sisa ruang dan isinya
               dirapatkan ke kanan; begitu sisa ruangnya kurang dari 320px ia turun
               satu baris penuh, yang terbaca sebagai susunan dua baris yang
               disengaja, bukan barisan yang kepotong;
             · kotak carinya `flex-1 min-w-0`, bukan lebar mati — ia menyusut lebih
               dulu sebelum apa pun terdorong turun, dan saat turun ke baris
               keduanya ia memanjang sampai tepi supaya tidak ada ruang kosong yang
               menganga. Batasnya (`lg:max-w-96`) hanya berlaku di layar lebar,
               tempat ia justru kelewat panjang; di bawah itu ia tetap bebas
               memanjang. -->
        <!-- `flex-nowrap` hanya dari `sm` ke atas. Di bawah itu ia menahan kotak
             cari dan kotak urutan tetap sebaris pada layar 375px: urutan lebarnya
             mati 160px, jadi yang tersisa untuk kotak cari cuma sekitar 175px —
             cukup untuk memotong "Cari event" jadi "Cari ever". Ditumpuk, keduanya
             dapat lebar penuh. -->
        <div
          class="flex min-w-0 flex-1 basis-80 flex-wrap items-center justify-end gap-2 sm:flex-nowrap"
        >
          <UInput
            v-model="cari"
            icon="i-lucide-search"
            :placeholder="t.filterCari"
            class="min-w-0 flex-1 lg:max-w-96"
            :ui="{ base: 'rounded-full' }"
          >
            <template v-if="cari" #trailing>
              <UButton
                color="secondary"
                variant="link"
                size="sm"
                icon="i-lucide-x"
                class="text-cc-brown-500 hover:text-cc-brown-600"
                :aria-label="isEn ? 'Clear search' : 'Kosongkan pencarian'"
                @click="cari = ''"
              />
            </template>
          </UInput>

          <USelect
            v-model="urutan"
            :items="urutanOptions"
            value-key="value"
            :icon="ikonUrutan"
            :aria-label="t.filterUrutan"
            class="w-full shrink-0 sm:w-40"
            :ui="{ base: 'rounded-full' }"
          />
        </div>
      </div>

      <!-- Daftar event. Rangka hanya dipasang saat belum ada data sama sekali;
           saat menyaring, kartu yang sudah tergambar dibiarkan tetap terlihat
           supaya menyaring tidak terasa seperti memuat ulang halaman. -->
      <SkeletonKartuEvent v-if="memuatAwal" :jumlah="6" />

      <UAlert
        v-else-if="!events.length"
        color="neutral"
        variant="subtle"
        icon="i-lucide-calendar-off"
        :description="t.kosong"
      />

      <!-- Kartu memakai .card/.card-image/.card-body dari main.css seperti semula:
           sampul menempel penuh ke tepi kartu. Bingkainya 16:9 (lihat main.css
           `.event-page .event-card .card-image`), rasio yang sama dengan sampul
           unggahan dan template bawaan, jadi gambarnya tampil utuh tanpa terpotong. UCard
           membungkus isinya dengan padding sendiri, sehingga sampul jadi terbingkai
           dan kartunya memanjang. -->
      <div v-else class="cards">
        <article
          v-for="(e, i) in eventsTampil"
          :key="e.id"
          class="card event-card"
          :style="{ animationDelay: `${Math.min(i, 8) * 60}ms` }"
        >
          <!-- Sampul + badge fase di pojok kanan atasnya -->
          <div
            class="card-image"
            :style="{ backgroundImage: `url('${sampul(e)}')` }"
          >
            <UBadge
              :color="badge(e.fase).color"
              :variant="badge(e.fase).variant"
              :icon="badge(e.fase).icon"
              size="sm"
              class="event-badge"
            >
              {{ badge(e.fase).label }}
            </UBadge>
          </div>

          <div class="card-body">
            <div class="event-meta">{{ barisTanggal(e) }}</div>

            <h3>{{ isEn ? (e.judulEn ?? e.judul) : e.judul }}</h3>

            <p class="muted">
              {{ isEn ? (e.deskripsiEn ?? e.deskripsi) : e.deskripsi }}
            </p>

            <!-- Biaya dan sisa kursi sengaja tidak ada di kartu. Keduanya angka yang
                 berubah dan menuntut keputusan, sementara kartu ini hanya perlu
                 membuat orang membuka halaman detail — di sanalah keputusan diambil. -->
            <div class="event-line">
              <UIcon
                :name="e.daring ? 'i-lucide-video' : 'i-lucide-map-pin'"
                class="size-4 shrink-0 text-cc-brown-500"
              />
              <span class="event-lokasi">{{ e.lokasi }}</span>
            </div>

            <!-- Batas pendaftaran. Ditandai merah begitu terlewat: yang berubah
                 bukan cuma kalimatnya melainkan artinya — tombol "Detail event"
                 di bawahnya tidak lagi menuju formulir yang bisa diisi. -->
            <div
              v-if="batasDaftar(e)"
              class="event-line"
              :class="
                e.tutupPendaftaran && batasLewat(e.tutupPendaftaran)
                  ? 'event-line-tutup'
                  : ''
              "
            >
              <UIcon
                :name="
                  e.tutupPendaftaran && batasLewat(e.tutupPendaftaran)
                    ? 'i-lucide-lock'
                    : 'i-lucide-hourglass'
                "
                class="size-4 shrink-0 text-cc-brown-500"
              />
              <span>{{ batasDaftar(e) }}</span>
            </div>

            <!-- Event yang sudah selesai tidak menawarkan aksi apa pun — badge di
                 sampul sudah mengatakannya, jadi tombol "Selesai" yang mati di
                 samping "Detail event" cuma mengulang tanpa bisa diklik. -->
            <!-- Satu tombol saja. Pendaftaran dipindah ke halaman detail event
                 supaya orang membaca isinya dulu sebelum memutuskan ikut. -->
            <div class="event-actions">
              <UButton
                :to="`${base}/events/${e.slug}`"
                color="secondary"
                size="sm"
                class="flex-1 justify-center"
                trailing-icon="i-lucide-arrow-right"
              >
                {{ t.detail }}
              </UButton>
            </div>
          </div>
        </article>
      </div>

      <!-- Penanda kaki daftar: dimuat sendiri saat masuk viewport, tapi tetap bisa
           diklik — pengamat viewport tidak berjalan di lingkungan tanpa render, dan
           tombol nyata juga bisa dicapai lewat papan tik. -->
      <div v-if="adaLagi" ref="sentinel" class="mt-8 flex justify-center">
        <UButton color="neutral" variant="link" @click="muatLagi">
          {{ isEn ? `Load ${sisa} more` : `Muat ${sisa} event lagi` }}
        </UButton>
      </div>
    </div>

    <!-- ── Bilah penyaring bawah (ponsel) ───────────────────────────────────────
         Kotak cari langsung bisa diketik di bilahnya — itu yang paling sering
         dipakai, dan menyembunyikannya di balik satu ketukan cuma menambah langkah.
         Fase dan urutan pindah ke lembar, karena keduanya berupa pilihan yang butuh
         ruang untuk dibaca.

         `sticky bottom-0`, bukan `fixed`: ia ikut arus halaman, jadi tidak menutupi
         apa pun saat papan ketik terbuka dan tidak perlu menghitung ulang tinggi
         layar yang berubah-ubah di ponsel. -->
    <div class="filter-bar fixed inset-x-0 bottom-0 z-40 px-4 py-2.5 sm:hidden">
      <div class="flex items-center gap-2">
        <UInput
          v-model="cari"
          icon="i-lucide-search"
          :placeholder="t.filterCari"
          class="min-w-0 flex-1"
          :ui="{ base: 'rounded-full' }"
        >
          <!-- Tombol kosongkan ditulis sendiri, bukan mengandalkan `type="search"`.
               Silang bawaan peramban digambar WebKit dengan warnanya sendiri (biru
               sistem), tidak bisa diwarnai, dan tidak muncul sama sekali di sebagian
               peramban lain — jadi tombolnya ada atau tidak tergantung yang membuka,
               bukan tergantung rancangan. -->
          <template v-if="cari" #trailing>
            <UButton
              color="secondary"
              variant="link"
              size="sm"
              icon="i-lucide-x"
              class="text-cc-brown-500 hover:text-cc-brown-600"
              :aria-label="isEn ? 'Clear search' : 'Kosongkan pencarian'"
              @click="cari = ''"
            />
          </template>
        </UInput>

        <!-- Angka kecil di tombolnya memberi tahu ada penyaring yang menyala tanpa
             perlu membuka lembarnya — tanpa itu, daftar yang tersaring terlihat
             sama saja dengan daftar yang pendek. -->
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-sliders-horizontal"
          size="lg"
          class="relative shrink-0 rounded-full bg-white/10 text-white hover:bg-white/20"
          :aria-label="t.filterKategori"
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

      <!-- Baris ringkasan dicabut: bilahnya jadi dua tingkat dan terasa tinggi untuk
           sesuatu yang menempel permanen di bawah layar. Keadaan tersaring tetap
           terbaca dari angka kecil pada tombol filter, dan jumlah hasilnya sudah
           tertulis di atas daftar. -->

    </div>

    <!-- Lembar penyaring. Dari bawah, sejajar dengan bilah yang membukanya.

         TANPA tombol "terapkan". Pilihannya berlaku seketika dan lembarnya menutup
         sendiri — baik saat sebuah fase ditekan maupun saat urutan diganti. Tombol
         terapkan hanya masuk akal kalau sebuah lembar mengumpulkan beberapa isian
         yang baru berarti bersama-sama; di sini tiap pilihan berdiri sendiri dan
         hasilnya langsung terlihat di daftar yang ada di belakangnya, jadi tombol
         itu cuma satu ketukan tambahan untuk sesuatu yang sudah terjadi. -->
    <USlideover
      v-model:open="lembarFilter"
      side="bottom"
      :title="isEn ? 'Filter & sort' : 'Saring & urutkan'"
    >
      <template #body>
        <div
          role="group"
          :aria-label="t.filterKategori"
          class="grid grid-cols-2 gap-2"
        >
          <button
            v-for="f in FASE_TAB"
            :key="f.key"
            type="button"
            class="flex items-center justify-between gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition-colors"
            :class="
              fase === f.key
                ? 'border-cc-green-800 bg-cc-green-800 text-white'
                : 'border-cc-stone-200 bg-white text-cc-stone-600'
            "
            :aria-pressed="fase === f.key"
            @click="fase = f.key; lembarFilter = false"
          >
            {{ f.label }}
            <span
              class="rounded-full px-1.5 py-0.5 text-[11px] tabular-nums"
              :class="fase === f.key ? 'bg-white/25' : 'bg-cc-stone-100 text-cc-stone-500'"
            >
              {{ hitungFase[f.key] ?? 0 }}
            </span>
          </button>
        </div>

        <div class="mt-4">
          <p class="mb-1.5 text-xs font-semibold text-cc-stone-500">
            {{ t.filterUrutan }}
          </p>
          <USelect
            v-model="urutan"
            :items="urutanOptions"
            value-key="value"
            :icon="ikonUrutan"
            :aria-label="t.filterUrutan"
            class="w-full"
            @update:model-value="lembarFilter = false"
          />
        </div>
      </template>
    </USlideover>
  </main>
</template>
