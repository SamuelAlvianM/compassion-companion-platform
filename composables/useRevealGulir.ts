// composables/useRevealGulir.ts
// Isi halaman muncul saat digulir: naik sedikit sambil memudar masuk, satu per satu.
// Geraknya digerakkan anime.js v4; kapan ia berangkat ditentukan berkas ini.
//
// ── Kenapa anime.js, bukan @keyframes seperti .event-card ────────────────────
// Kartu event memakai animasi CSS dengan `animation-delay` yang dihitung di markup.
// Cara itu cukup untuk satu daftar seragam, tapi tidak untuk halaman ini: tiap bagian
// punya jumlah elemen berbeda, dan semuanya harus MULAI SAAT BAGIANNYA TERLIHAT —
// bukan saat halaman dimuat. `animation-delay` tidak tahu apa-apa soal gulir, jadi
// bagian paling bawah akan selesai beranimasi jauh sebelum ada yang melihatnya.
//
// ── Pemicunya sapuan sendiri, bukan onScroll() maupun IntersectionObserver ───
// Dua percobaan sebelumnya gagal, dan keduanya gagal dengan cara yang sama: ada isi
// halaman yang tinggal tak terlihat SELAMANYA. Keduanya dicatat di sini supaya tidak
// dipasang ulang.
//
//   1. `autoplay: onScroll({...})` milik anime.js — rusak di tab latar.
//      anime.js menjeda engine-nya saat `document.hidden` (dan itu benar; peramban
//      juga menghentikan rAF untuk dokumen tersembunyi). Yang salah adalah
//      sesudahnya: observer yang dibuat selagi engine terjeda tidak menyala lagi
//      ketika tabnya dibuka. Diukur di halaman ini — `document.hidden` berubah jadi
//      `false`, seluruh `[data-reveal]` tetap `opacity: 0`. Untuk yang membuka
//      beranda lewat klik-tengah atau "buka di tab baru", yang tersaji halaman kosong.
//
//   2. IntersectionObserver — rusak saat gulirnya melompat.
//      IO hanya mengirim laporan ketika keadaan potong-memotongnya BERUBAH dari
//      catatan terakhirnya. Kalau satu lompatan (tautan jangkar, tombol End,
//      pemulihan posisi gulir, atau gulir cepat selagi tab tersembunyi sehingga
//      laporannya tertahan) memindahkan elemen dari "di bawah layar" langsung ke
//      "di atas layar", keadaannya tidak pernah berubah — dua-duanya "tidak
//      berpotongan" — dan tidak ada laporan yang dikirim sama sekali. Diukur: kartu
//      program dan foto profil tinggal `opacity: 0`, permanen.
//
// Yang dipakai sekarang adalah sapuan `getBoundingClientRect()` pada peristiwa gulir,
// ubah-ukuran, dan ubah-visibilitas. Ia tidak punya "catatan keadaan terakhir" yang
// bisa meleset: tiap sapuan membaca posisi yang sebenarnya saat itu juga. Biayanya
// kecil dan berbatas — 22 elemen di halaman ini, hanya kelompok yang belum berangkat
// yang diperiksa, penanganannya dibatasi satu kali per bingkai lewat rAF, dan seluruh
// pendengarnya DILEPAS begitu kelompok terakhir berangkat. Setelah halaman terbuka
// penuh, tidak ada satu pun kode reveal yang masih berjalan.
//
// ── Pagar: jangan sampai isinya hilang permanen ──────────────────────────────
// Yang menyembunyikan BUKAN `[data-reveal]` sendirian melainkan
// `html.js-reveal [data-reveal]:not(.is-terlihat)`. Kelas `js-reveal` dipasang skrip
// sebaris di <head> (lihat `app.head.script` di nuxt.config.ts), jadi tanpa JavaScript
// tidak ada yang pernah tersembunyi; dan kalau anime.js gagal dimuat, kelas itu
// dicabut sehingga halaman langsung tampil utuh.

type OpsiReveal = {
  /** Jarak naik, dalam piksel. Harus sama dengan nilai di main.css. */
  jarak?: number;
  /** Jeda antar-elemen dalam satu kelompok, dalam milidetik. */
  jeda?: number;
  /**
   * Ambang masuk sebagai pecahan tinggi layar. 0.88 = elemen dianggap masuk saat
   * tepi atasnya melewati 88% tinggi layar: sudah masuk pandangan tapi belum di
   * tengah, jadi geraknya selesai kira-kira saat mata sampai ke sana.
   */
  ambang?: number;
};

/**
 * Memasang reveal untuk seluruh `[data-reveal]` di dalam `akar`.
 *
 * Elemen dikelompokkan lewat nilai atributnya: semua `data-reveal="program"` bergerak
 * sebagai satu rombongan dengan jeda berurutan, dan rombongan itu berangkat begitu
 * ANGGOTA MANA PUN darinya masuk viewport — bukan hanya anggota pertama. Bedanya
 * terasa saat halaman dibuka lewat tautan jangkar (`#about`): yang tampil pertama
 * bisa saja anggota ketiga, dan menunggu anggota pertama berarti rombongan itu tidak
 * pernah berangkat.
 *
 * Pengelompokannya ada di markup, bukan daftar selektor di berkas ini, supaya
 * menambah bagian baru di halaman cukup menulis satu atribut.
 */
export const useRevealGulir = (
  akar: Ref<HTMLElement | null>,
  opsi: OpsiReveal = {},
) => {
  const jarak = opsi.jarak ?? 26;
  const jeda = opsi.jeda ?? 90;
  const ambang = opsi.ambang ?? 0.88;

  let lepaskan: (() => void) | undefined;

  const bukaSemua = () => {
    if (import.meta.client) {
      document.documentElement.classList.remove("js-reveal");
    }
  };

  onMounted(async () => {
    // Hormati preferensi sistem. Dicek di sini, bukan cuma lewat media query CSS:
    // media query hanya bisa memendekkan durasinya jadi 0.01ms, sementara yang benar
    // adalah tidak pernah menyembunyikan apa pun sejak awal.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      bukaSemua();
      return;
    }

    const semua = akar.value
      ? [...akar.value.querySelectorAll<HTMLElement>("[data-reveal]")]
      : [];
    if (!semua.length) {
      bukaSemua();
      return;
    }

    // Jaring pengaman selama modulnya diunduh: kalau 3 detik berlalu dan anime.js
    // belum juga siap, halaman ditampilkan apa adanya.
    const pengaman = window.setTimeout(bukaSemua, 3000);

    let anime: typeof import("animejs");
    try {
      anime = await import("animejs");
    } catch {
      // Chunk-nya gagal diunduh (jaringan putus, berkas hilang setelah rilis baru).
      bukaSemua();
      return;
    } finally {
      window.clearTimeout(pengaman);
    }

    // Komponennya sudah dilepas selagi impornya berjalan.
    if (!akar.value) return;

    const { animate, stagger } = anime;

    // Kelompokkan menurut nilai atributnya; urutan DOM dipertahankan.
    const kelompok = new Map<string, HTMLElement[]>();
    for (const el of semua) {
      const nama = el.dataset.reveal || "bawaan";
      const daftar = kelompok.get(nama);
      if (daftar) daftar.push(el);
      else kelompok.set(nama, [el]);
    }

    /**
     * Tampilkan tanpa animasi.
     *
     * `is-terlihat` bukan sekadar penanda: ia yang membuat aturan penyembunyi di
     * main.css berhenti cocok (selektornya `:not(.is-terlihat)`). Sesudah itu tidak
     * ada aturan mana pun yang menyatakan `transform` untuk elemen ini, sehingga
     * `.card:hover` bebas memilikinya.
     */
    const tampilkanSaja = (anggota: HTMLElement[]) => {
      for (const el of anggota) el.classList.add("is-terlihat");
    };

    /** Klaim satu kelompok; `null` kalau sudah pernah berangkat. */
    const klaim = (nama: string) => {
      const anggota = kelompok.get(nama);
      if (!anggota) return null;
      kelompok.delete(nama);
      if (!kelompok.size) lepaskan?.();
      return anggota;
    };

    const berangkat = (nama: string) => {
      const anggota = klaim(nama);
      if (!anggota) return;

      // Tab sedang di latar: peramban tidak menjalankan rAF, jadi animasinya akan
      // menggantung di bingkai pertama sampai tabnya dibuka — dan pada saat itu
      // geraknya sudah tidak berarti apa-apa. Ditampilkan begitu saja.
      if (document.hidden) {
        tampilkanSaja(anggota);
        return;
      }

      animate(anggota, {
        opacity: [0, 1],
        translateY: [jarak, 0],
        duration: 720,
        delay: stagger(jeda),
        // `out(3)`, bukan pegas atau elastis: situs ini bernada tenang, dan pantulan
        // sekecil apa pun membuat teks terbaca "melompat" alih-alih "muncul".
        ease: "out(3)",

        /**
         * INI BAGIAN YANG TIDAK BOLEH DIHAPUS.
         *
         * anime.js menulis hasilnya sebagai inline style. Tanpa pembersihan di sini,
         * elemen membawa `style="opacity:1; transform:translateY(0px)"` selamanya —
         * dan inline style mengalahkan aturan stylesheet mana pun tanpa `!important`.
         * Akibatnya `.card:hover { transform: translateY(-3px) }` di main.css berhenti
         * bekerja: kartunya diam saat disentuh, tanpa apa pun yang menunjukkan
         * sebabnya. Kartu program dan kartu refleksi dua-duanya ada di daftar hover
         * itu, jadi dua bagian halaman kehilangan hover-nya sekaligus.
         *
         * Urutannya penting: `is-terlihat` dipasang LEBIH DULU, karena kelas itu yang
         * mematikan aturan penyembunyi. Kalau inline style dicabut sebelum kelasnya
         * terpasang, aturan itu masih berlaku dan elemennya berkedip hilang.
         *
         * Dicabut per-properti, bukan lewat `utils.cleanInlineStyles`. Fungsi itu
         * membandingkan nilai inline dengan nilai dari stylesheet dan hanya mencabut
         * yang sama persis — sementara di sini yang dibandingkan `translateY(0px)`
         * dengan `none`, dua penulisan untuk hal yang sama yang belum tentu dianggap
         * cocok. Dua nama properti ini sudah pasti karena kita sendiri yang
         * menganimasikannya di atas.
         */
        onComplete: () => {
          tampilkanSaja(anggota);
          for (const el of anggota) {
            el.style.removeProperty("opacity");
            el.style.removeProperty("transform");
            if (!el.getAttribute("style")) el.removeAttribute("style");
          }
        },
      });
    };

    /**
     * Periksa seluruh kelompok yang belum berangkat terhadap posisi layar SAAT INI.
     *
     * Tidak menyimpan keadaan sebelumnya, dan itu yang membuatnya tahan terhadap gulir
     * yang melompat: berapa pun jauhnya halaman berpindah dalam satu langkah, sapuan
     * berikutnya membaca posisi yang sebenarnya.
     */
    const sapu = () => {
      const batas = window.innerHeight * ambang;

      for (const [nama, anggota] of [...kelompok]) {
        let masuk = false;
        let terlewat = true;

        for (const el of anggota) {
          const b = el.getBoundingClientRect();
          if (b.bottom > 0) terlewat = false;
          if (b.top < batas && b.bottom > 0) masuk = true;
        }

        // "Masuk" menang atas "terlewat". Satu kelompok bisa punya anggota yang sudah
        // lewat ke atas dan anggota yang justru sedang dipandang; kalau "terlewat"
        // yang dipakai, yang sedang dipandang ikut muncul tanpa animasi.
        if (masuk) berangkat(nama);
        else if (terlewat) tampilkanSaja(klaim(nama) ?? []);
      }
    };

    // rAF menahan agar satu bingkai hanya disapu sekali, berapa pun banyaknya
    // peristiwa gulir yang datang di antaranya.
    let terjadwal = false;
    const jadwalkan = () => {
      if (terjadwal) return;
      terjadwal = true;
      requestAnimationFrame(() => {
        terjadwal = false;
        sapu();
      });
    };

    /**
     * Saat tab dibuka kembali, sapu LANGSUNG — tidak lewat rAF.
     *
     * rAF justru yang berhenti selama tabnya di latar, jadi gulir yang terjadi di sana
     * meninggalkan satu panggilan `jadwalkan` yang menyala tapi tidak pernah sampai ke
     * `sapu`. Menyalurkan peristiwa ini lewat rAF berarti menitipkan pemulihannya pada
     * mekanisme yang sedang bermasalah. `terjadwal` ikut dikembalikan supaya
     * penjadwalan yang tertahan tadi tidak memblokir gulir berikutnya.
     *
     * Ini peristiwa langka — tidak ada yang perlu diredam.
     */
    const saatVisibilitasBerubah = () => {
      if (document.hidden) return;
      terjadwal = false;
      sapu();
    };

    const pasif = { passive: true } as const;
    window.addEventListener("scroll", jadwalkan, pasif);
    window.addEventListener("resize", jadwalkan, pasif);
    document.addEventListener("visibilitychange", saatVisibilitasBerubah);

    lepaskan = () => {
      window.removeEventListener("scroll", jadwalkan);
      window.removeEventListener("resize", jadwalkan);
      document.removeEventListener("visibilitychange", saatVisibilitasBerubah);
      lepaskan = undefined;
    };

    sapu();
  });

  onBeforeUnmount(() => {
    lepaskan?.();
    // `js-reveal` tidak berbahaya di halaman lain (tidak ada `[data-reveal]` di sana),
    // tapi dikembalikan supaya keadaannya bersih saat berpindah halaman.
    bukaSemua();
  });
};
