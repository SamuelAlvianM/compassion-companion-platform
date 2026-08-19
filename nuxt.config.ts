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

  /**
   * Tiptap & ProseMirror harus dimuat SATU KALI saja.
   *
   * Editor jurnal memakai Tiptap dari dua arah: lewat `UEditor` milik Nuxt UI, dan
   * lewat ekstensi gambar buatan sendiri (utils/tiptap-gambar.ts) yang mengimpor
   * `@tiptap/core` langsung. Kalau sampai ada dua salinan modul yang dimuat,
   * masing-masing punya penghitung kunci plugin sendiri, lalu keduanya
   * mendaftarkan plugin bernama sama ke editor yang sama. Gejalanya galat yang
   * tidak menyebut tiptap sama sekali:
   *
   *     Adding different instances of a keyed plugin (plugin$)
   *
   * Yang menyembuhkannya ada di `vite.optimizeDeps` di bawah — lihat penjelasan
   * panjangnya di sana. `dedupe` dipertahankan sebagai pagar kedua: ia yang
   * menjaga resolusi tetap satu kalau suatu saat ada paket yang lolos dari daftar
   * pra-paket.
   *
   * Yang sudah DICOBA dan DICABUT lagi, supaya tidak dipasang ulang percuma:
   * `build: { transpile: [/^@tiptap\//, /^prosemirror-/] }`. Alasannya waktu itu
   * masuk akal — memaksa Vite ikut memaketkan tiptap di sisi server, supaya jalur
   * SSR dan jalur klien berakhir di modul yang sama. Ternyata tidak menyentuh
   * apa pun: `UEditor` tidak dirender di server sama sekali (HTML dari SSR cuma
   * berisi `<!--v-if-->` di tempat editornya), jadi tidak pernah ada editor di
   * sisi server yang bisa kena galat ini. Galatnya sejak awal terjadi di peramban.
   */
  vite: {
    resolve: {
      dedupe: [
        '@tiptap/core',
        '@tiptap/vue-3',
        '@tiptap/pm',
        'prosemirror-state',
        'prosemirror-view',
        'prosemirror-model',
        'prosemirror-transform',
      ],
    },
    /**
     * SELURUH keluarga tiptap/prosemirror dipaketkan-awal, bukan cuma dua paket.
     *
     * Ini bagian yang selama ini kurang. `@tiptap/core` dan `@tiptap/vue-3`
     * memang sudah ada di sini, tapi `UEditor` milik Nuxt UI memakai belasan
     * paket lain — starter-kit, extension-*, dan yang paling menentukan
     * `@tiptap/pm/state`. Yang tidak disebut di sini tidak ikut dipaketkan, jadi
     * Vite menyajikannya apa adanya dari `node_modules`, dan `prosemirror-state`
     * yang dimuatnya adalah modul yang BERBEDA dari salinan yang sudah terjahit
     * ke dalam bundel `@tiptap/core`.
     *
     * Kenapa itu berakhir jadi galat yang tidak menyebut tiptap sama sekali:
     * `prosemirror-state` menomori plugin tanpa kunci lewat penghitung di lingkup
     * modul (`createKey`) — plugin pertama selalu bernama `plugin$`. Dua salinan
     * modul berarti dua penghitung, dua-duanya mulai dari nol, dan dua plugin
     * berbeda sama-sama mengaku `plugin$`. Begitu keduanya masuk ke satu editor:
     *
     *     Adding different instances of a keyed plugin (plugin$)
     *
     * Nama `plugin$` itu sendiri petunjuknya: akhiran tanpa angka berarti
     * "yang pertama", dan tidak mungkin ada dua yang pertama dalam satu modul.
     *
     * Karena semuanya didaftarkan di sini, esbuild memaketkannya dalam SATU
     * jalan sekaligus dan `prosemirror-state` jatuh ke chunk bersama — satu modul,
     * satu penghitung. Efek sampingnya juga hilang: tidak ada lagi paket yang baru
     * ketahuan di tengah jalan, jadi Vite berhenti memuat ulang halaman diam-diam
     * ("new dependencies optimized") tepat saat editornya sedang dipasang.
     *
     * Daftarnya panjang dan memang mengikuti isi Nuxt UI. Kalau suatu saat
     * `UEditor` menambah ekstensi baru dan galat yang sama muncul lagi, cara
     * memutakhirkannya:
     *
     *     grep -rho "@tiptap/[a-z0-9/-]*" node_modules/@nuxt/ui/dist/runtime | sort -u
     */
    optimizeDeps: {
      include: [
        '@tiptap/core',
        '@tiptap/vue-3',
        '@tiptap/vue-3/menus',
        '@tiptap/starter-kit',
        '@tiptap/suggestion',
        '@tiptap/markdown',
        '@tiptap/extension-bubble-menu',
        '@tiptap/extension-code',
        '@tiptap/extension-drag-handle-vue-3',
        '@tiptap/extension-floating-menu',
        '@tiptap/extension-horizontal-rule',
        '@tiptap/extension-image',
        '@tiptap/extension-mention',
        '@tiptap/extension-placeholder',
        '@tiptap/pm/commands',
        '@tiptap/pm/dropcursor',
        '@tiptap/pm/gapcursor',
        '@tiptap/pm/history',
        '@tiptap/pm/inputrules',
        '@tiptap/pm/keymap',
        '@tiptap/pm/model',
        '@tiptap/pm/schema-list',
        '@tiptap/pm/state',
        '@tiptap/pm/tables',
        '@tiptap/pm/transform',
        '@tiptap/pm/view',
        // Bukan tiptap, tapi masalahnya sama: dua paket ini juga baru ketahuan
        // saat halaman berjalan, dan penemuan itulah yang memicu muat-ulang
        // diam-diam. Disebut di sini supaya dev server menyala dengan semuanya
        // sudah siap. Daftar ini bukan tebakan — dev server mencetaknya sendiri
        // ("Vite discovered new dependencies at runtime") begitu ada yang tersisa.
        '@vue/devtools-core',
        '@vue/devtools-kit',
      ],
    },
  },

  /**
   * Tiga artikel jurnal yang dulu berupa halaman .vue tersendiri. Isinya sekarang
   * ada di database (server/db/seed-jurnal.ts) dan dibaca di /jurnal/[slug].
   *
   * Dialihkan, bukan dihapus begitu saja: alamat-alamat ini sudah pernah tampil di
   * halaman /jurnal selama berbulan-bulan dan bisa saja sudah dibagikan atau
   * diindeks. 301, bukan 302 — perpindahannya permanen, dan itu yang membuat mesin
   * pencari memindahkan peringkat halaman lamanya ke alamat baru.
   */
  routeRules: Object.fromEntries(
    ['id', 'en'].flatMap(bahasa => ([
      [`/${bahasa}/reflection-journey`, { redirect: { to: `/${bahasa}/jurnal/menemukan-arah-dalam-kebersamaan`, statusCode: 301 as const } }],
      [`/${bahasa}/sharing-mendengar-dengan-hadir`, { redirect: { to: `/${bahasa}/jurnal/ketika-saya-belajar-mendengarkan`, statusCode: 301 as const } }],
      [`/${bahasa}/sharing-menata-kegelisahan`, { redirect: { to: `/${bahasa}/jurnal/membawa-kegelisahan-kepada-tuhan`, statusCode: 301 as const } }],
    ])),
  ),

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
      'admin-statistik': false,
      'admin-contributors': false,
      'admin-section': false,
      'admin-event-id': false,
      'admin-member-id': false,
      'admin-petunjuk': false,
      // Halaman admin baru WAJIB didaftarkan di sini. Tanpa barisnya, i18n
      // memasang awalan locale dan rutenya jadi /id/admin/… — alamat /admin/…
      // yang sebenarnya lalu jatuh ke penangkap /admin/[section] dan yang tampil
      // adalah halaman POC lama, tanpa galat apa pun yang memberi tahu.
      'admin-log': false,
      'admin-akun': false,
    },
    locales: [
      { code: 'id', language: 'id-ID', name: 'Indonesia' },
      { code: 'en', language: 'en-US', name: 'English' },
    ],
  },
})
