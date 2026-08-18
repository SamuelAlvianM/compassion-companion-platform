export default defineNuxtConfig({
  compatibilityDate: '2026-07-25',
  devtools: { enabled: true },
  // Port lokal dipatok di sini supaya `npm run dev` / `yarn dev` / `pnpm dev` sama-sama pakai 3009.
  //
  // `host` dipatok ke loopback supaya dev server TIDAK mendengarkan di 0.0.0.0.
  // Bind ke semua antarmuka berarti dua hal yang sama-sama tidak diinginkan di sini:
  // Windows memunculkan permintaan izin firewall tiap kali server dijalankan, dan
  // situs yang belum jadi ikut terbuka bagi siapa pun yang sejaringan.
  // Kalau suatu saat perlu diuji dari ponsel, jalankan sekali dengan
  // `npm run dev -- --host` — flag CLI menang atas nilai di sini.
  //
  // `localhost`, bukan `127.0.0.1` — dan itu menyelesaikan "426 Upgrade Required"
  // yang sejak Sesi 9 dikira kendala pratinjau.
  //
  // Sebabnya: dev stack Nuxt membuka DUA pendengar pada port ini. Satu untuk
  // aplikasinya (di alamat yang disebut `host` ini), satu lagi server WebSocket
  // yang mengikat `::` — wildcard IPv6, yang di Windows ikut menerima IPv4.
  // Permintaan HTTP biasa ke server WebSocket dijawab 426, dan itulah yang muncul
  // di layar.
  //
  // Pendengar beralamat spesifik menang atas wildcard, jadi alamat yang disebut di
  // sini adalah satu-satunya yang benar-benar sampai ke aplikasi. Dipilih
  // `localhost` karena itu yang diketik orang. Konsekuensinya terbalik dari
  // sebelumnya: **`http://localhost:3009` yang benar, `http://127.0.0.1:3009`
  // sekarang yang menjawab 426.**
  //
  // Dua hal sudah dicoba dan TIDAK berpengaruh, jadi tidak perlu diulang:
  // memindahkan WebSocket itu lewat `vite.server.hmr.port` (ia bukan HMR Vite),
  // dan mematikan `devtools` (bukan itu pemiliknya). Yang tersisa cuma memilih
  // keluarga alamat mana yang dilayani, dan `localhost` adalah yang diketik orang.
  devServer: { port: 3009, host: 'localhost' },
  // Satu entry saja: tailwind.css meng-import main.css sebagai layer `components`.
  // Lihat komentar di berkas itu — urutan layer menentukan siapa yang menang.
  css: ['~/assets/css/tailwind.css'],
  modules: ['@nuxtjs/i18n', '@nuxt/ui', '@nuxt/image'],

  // Situs ini hanya punya mode terang. Tanpa penguncian ini Nuxt UI bisa
  // menyalakan kelas `.dark` dan mengubah seluruh warna.
  colorMode: { preference: 'light', fallback: 'light' },

  // Font sudah dimuat manual lewat @import Google Fonts di main.css.
  // Pemetaan warna brand ada di app.config.ts — Nuxt UI membaca `ui.colors` dari sana,
  // bukan dari berkas ini.
  ui: { fonts: false },

  // Transisi halaman & layout. Kelasnya ada di assets/css/main.css dan otomatis
  // dinonaktifkan saat pengguna memilih "reduce motion" di sistemnya.
  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    layoutTransition: { name: 'layout', mode: 'out-in' },
  },

  icon: { serverBundle: { collections: ['lucide'] } },

  runtimeConfig: {
    // Kunci enkripsi cookie sesi, diisi dari env NUXT_SESSION_PASSWORD (lihat .env.example).
    // Sengaja dibiarkan kosong di sini: nilai bawaan di source code berarti setiap
    // salinan repo memakai kunci yang sama, dan siapa pun yang membacanya bisa
    // memalsukan cookie sesi siapa saja. server/utils/session.ts menolak jalan
    // kalau nilainya masih kosong.
    sessionPassword: '',
  },

  i18n: {
    defaultLocale: 'id',
    strategy: 'prefix',
    customRoutes: 'config',
    pages: {
      admin: false,
      'admin-members': false,
      'admin-events': false,
      'admin-jurnal': false,
      'admin-jurnal-id': false,
      'admin-contributors': false,
      'admin-section': false,
      'admin-event-id': false,
      'admin-member-id': false,
      'admin-petunjuk': false,
    },
    locales: [
      { code: 'id', language: 'id-ID', name: 'Indonesia' },
      { code: 'en', language: 'en-US', name: 'English' },
    ],
  },
})
