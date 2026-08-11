# Journal — Compassionate Companion Website

Catatan kerja untuk project di `C:\sam\COSMOS\ccwebsite`.
Format: entri terbaru di atas. Setiap sesi kerja tambahkan satu blok.

---

## 2026-08-11 — Sesi 6: Penyuntingan di tempat, konten event masuk database

### Tiga halaman hardcoded dilebur jadi satu

`leadership-with-compassion.vue`, `listening-as-leadership.vue`, dan
`compassion-in-practice.vue` teksnya ditulis tetap di dalam `.vue` — itu sebabnya
halamannya tidak bisa disunting: tidak ada baris database untuk disimpan.

Isinya dipindahkan ke `cc_kegiatan` lewat migrasi `0003_konten-event` yang menambah
`waktu`, `ajakan`/`ajakanEn`, `ajakanIsi`/`ajakanIsiEn`, dan `testimoni`. Ketiga
berkasnya dipindah ke `.arsip/`, dan `pages/events/[slug].vue` kini melayani semua
event.

`waktu` sengaja **teks**, bukan timestamp: banyak acara berupa rangkaian sesi dengan
jeda, dan menyimpannya sebagai waktu tunggal memaksa penyederhanaan yang keliru.
`testimoni` disimpan JSON karena jumlahnya bebas dan tidak pernah dicari, disaring,
atau dihubungkan ke tabel lain — tabel sendiri hanya menambah join tanpa menambah
kemampuan.

### Penyuntingan di tempat

Tiga bagian: `useEditMode()` (keadaan, dibatasi level ≤ 3), `<EditableText>` (teks
yang bisa diklik), `<AdminEditBar>` (bilah melayang).

**Mode edit tidak menyala sendiri.** Halaman publik adalah halaman yang dibaca, dan
pengelola paling sering membukanya untuk membaca juga — kotak sunting di setiap
kunjungan hanya menghalangi itu. Saat mode mati, `<EditableText>` merender slotnya
**apa adanya**, tanpa pembungkus dan tanpa kelas tambahan: yang dilihat pengunjung
harus sama persis dengan halaman tanpa komponen ini.

Kolom yang disunting mengikuti bahasa yang sedang dibuka — menyunting judul di `/en`
mengubah `judul_en`, bukan menimpa judul Indonesia.

Bilahnya dibungkus `<ClientOnly>` dan `v-if="bolehSunting"`: bagi pengunjung ia tidak
pernah ada di DOM, bukan disembunyikan lewat CSS.

### Tiga bug yang ketahuan saat diuji

**1. PATCH selalu harus lengkap.** `bacaKegiatan` mengembalikan `null` untuk apa pun
yang tidak ada di body, jadi mengirim satu kolom akan mengosongkan seluruh sisanya.
Diperbaiki dengan menumpuk body **di atas** baris yang sudah ada sebelum divalidasi.

**2. Kolom baru diabaikan diam-diam.** Kolom sudah ada di skema dan sudah terisi,
tapi `bacaKegiatan` belum mengenalnya — PATCH `waktu` mengembalikan 200 tanpa
mengubah apa pun. Pengingat bahwa menambah kolom butuh tiga tempat: skema, migrasi,
**dan validator**.

**3. Kuota berupa angka selalu terbuang.** Pemeriksaan "kosong" memakai
`teks(kuotaMentah) !== ''`, sementara `teks()` mengembalikan `''` untuk apa pun yang
bukan string. Akibatnya `kuota: 35` dari JSON — bentuk normalnya — selalu jadi
"tanpa batas". Ini yang paling berbahaya dari ketiganya: tidak ada galat, event
hanya diam-diam kehilangan batas pesertanya.

**Listener pada komponen Nuxt UI tidak selalu sampai ke `<input>` di dalamnya.**
`@keydown` pada `<UInput>` tidak terpicu; dipindah ke span pembungkus, tempat event
yang menggelembung selalu tertangkap.

### Yang dikerjakan sesi ini

- [x] Migrasi `0003_konten-event`: `waktu`, `ajakan*`, `ajakanIsi*`, `testimoni`
- [x] Isi tiga halaman hardcoded dipindahkan ke database
- [x] `pages/events/[slug].vue` melayani semua event; tiga berkas lama ke `.arsip/`
- [x] `useEditMode` + `EditableText` + `AdminEditBar`
- [x] Enam kolom bisa disunting di halaman: judul, deskripsi, waktu, lokasi, ajakan, isi ajakan
- [x] PATCH parsial; kuota angka; kolom konten baru dikenali validator
- [x] Infinite scroll di event & jurnal (9 awal, +6), penyaringan tetap menyeluruh
- [x] Filter tanggal jadi satu tanggal, kalender menutup saat dipilih
- [x] Ikon search/kategori/tanggal disamakan; reset jadi warna huruf saja
- [x] Diuji: sunting `waktu` lewat UI tersimpan ke DB, kolom lain utuh, testimoni
      tetap terbaca, dan mode baca tidak menyisakan penanda apa pun

### Catatan / risiko

**Testimoni belum bisa disunting** — ia tampil dari database tapi belum punya
antarmuka tambah/hapus.

**Halaman publik lain belum editable.** Baru halaman detail event. `index.vue`,
`insights.vue`, dan halaman sharing masih teks tetap di `.vue`; itu butuh pola
`page` → `section` → `static_content` seperti di website-cosmos.

**`.arsip/` masih menyimpan tiga berkas lama** — aman dihapus setelah Anda yakin
tidak ada isi yang tertinggal.

---

## 2026-08-11 — Sesi 5: Sesi & materi event berbasis database, CRUD admin

### Model data: dua tabel, bukan empat

`cc_sesi` (partisi event: Day 1, Day 2, …) → `cc_sesi_item`.

Materi pembelajaran, galeri, dan referensi ditampung **satu tabel** dengan kolom
pembeda `bagian`, bukan tiga tabel terpisah. Ketiganya berbentuk sama — judul,
jenis, berkas atau tautan, urutan — sehingga memisahkannya berarti tiga migrasi,
tiga set endpoint, dan tiga logika urutan yang identik. Polanya dipinjam dari
`cfsme_page_section` di website-cosmos: satu tabel item berurutan, jenisnya
ditentukan kolom.

Migrasi `0002_sesi`. `CHECK` menolak item tanpa berkas **maupun** tautan — baris
seperti itu tidak bisa dibuka sama sekali, dan menolaknya di database berarti form
mana pun tidak bisa membuatnya.

### Aturan akses materi

| Bagian | Siapa yang boleh | Ditegakkan di |
|---|---|---|
| materi | peserta event + pengelola level ≤ 3 | server: `url`/`mediaId` **dibuang** dari payload |
| galeri | semua | — |
| referensi | semua | — |

Yang penting: materi terkunci **tetap terkirim judulnya** tapi tanpa jalan ke
berkasnya. Pengunjung tahu materinya ada — itu yang membuat ajakan mendaftar masuk
akal — sementara tautannya tidak bisa dibaca dari devtools. Kliknya memunculkan
"Hanya peserta event yang dapat melihat materi ini."

`terkunci` default **true** untuk materi; pengelola bisa mematikannya per item
untuk hal yang memang publik, mis. silabus.

Peserta dicocokkan lewat **email**, bukan userId: `cc_peserta` menyimpan snapshot
email dan boleh berdiri tanpa akun (pendaftaran tamu).

### YouTube unlisted

`idYoutube()` menguraikan watch?v=, youtu.be/, /embed/, /shorts/, /live/, lalu
memvalidasi ID-nya 11 karakter URL-safe — tanpa itu, potongan path acak bisa ikut
disuntikkan ke `src` iframe. Embed memakai domain **nocookie**.

Unlisted tidak butuh perlakuan khusus: ia punya ID biasa dan tetap bisa di-embed.
Yang tidak bisa adalah video privat.

### Galeri: zoom, geser, putar

`components/GaleriLightbox.vue`. Transformnya satu string `translate → scale →
rotate`, bukan tiga properti terpisah — urutan transform menentukan hasilnya, dan
memutar dulu lalu menggeser akan menggeser sepanjang sumbu yang ikut miring.
Tampilan direset tiap ganti foto, kalau tidak foto berikutnya muncul dalam keadaan
ter-zoom mengikuti foto sebelumnya.

### Desain: dari ikon telanjang ke chip

`.material-tile` memakai ikon 32–42px polos di samping teks, sehingga ikonnya lebih
berat dari judulnya. `.reference-link` mendorong panah dengan `margin-left:auto`,
jadi judul panjang membungkus dua baris sementara panahnya melayang sendirian di
ujung — persis yang terlihat pada "The Art of Listening by Simon Sinek".

Diganti `.tile`: chip 28px berlatar brand, judul dipotong satu baris (judul penuh
di atribut `title`), baris kedua untuk metadata atau domain, panah menempel di
ujung baris pertama. Semua kartu jadi setinggi sama (terukur 55px).

### Pendaftaran: dua langkah, bukan satu

Tombol daftar dicabut dari kartu daftar event — sekarang **hanya "Detail event"**,
supaya orang membaca isinya dulu.

Di panel kanan halaman detail, di bawah "Kirim pendaftaran": separator "Sudah
memiliki akun" → tombol "Daftar dengan akun" → isi kontainer berganti jadi form
email/password → "Periksa akun" → **popup konfirmasi berisi nama & email** →
"Cek lagi" atau "Daftar Sekarang".

Dua langkah, bukan langsung mendaftar setelah password benar: yang paling sering
salah adalah perangkat yang masih memegang akun orang lain, dan itu hanya ketahuan
kalau namanya diperlihatkan sebelum tombol terakhir.

Sekalian: submit panel ini dulu berhenti di `sent = true` (state lokal). Sekarang
benar-benar menulis ke `POST /api/events/[slug]/register`.

### Endpoint media akhirnya dilindungi

Tiga endpoint yang selama ini terbuka kini memakai `wajibRole(event, 'editor')`:
`GET /api/media`, `POST /api/media/upload`, `DELETE /api/media/[id]`.

`GET /api/storage/**` sengaja **tetap publik** — `<img>` di halaman umum tidak
membawa sesi, dan nama berkasnya sudah mengandung ID acak.

### Halaman detail generik

`pages/events/[slug].vue`. Nuxt memenangkan rute statis atas rute dinamis, jadi tiga
halaman event lama tetap dipakai; berkas ini melayani sisanya — termasuk setiap
event baru dari /admin. Tanpa ini, kartu yang kini semuanya menunjuk ke "Detail
event" akan 404 untuk dua event hasil seed.

### Temuan

**`<UApp>` wajib ada di app.vue.** `<UTooltip>` melempar "Injection
TooltipProviderContext not found" saat SSR tanpa pembungkus itu.

**Reka UI menolak `<SelectItem value="">`.** String kosong dipesan untuk keadaan
"belum dipilih". Opsi "Semua" memakai sentinel `'semua'`, diterjemahkan saat query.

**$fetch tidak membawa cookie saat SSR.** Halaman `/admin/event/[id]` selalu 401 di
render pertama sampai `useRequestHeaders(['cookie'])` diteruskan — jebakan yang sama
sudah dicatat di `composables/useAuth.ts`.

**Escape CSS `\00b7` menghasilkan byte NUL** di berkas, yang tampil sebagai `?b7` di
halaman. Pemisahnya dibuang.

### Yang dikerjakan sesi ini

- [x] `cc_sesi` + `cc_sesi_item` + migrasi `0002_sesi`
- [x] `GET /api/events/[slug]/sesi` & `/detail` (publik), 9 endpoint admin CRUD
- [x] Materi terkunci disaring di server; galeri & referensi terbuka
- [x] Popup "Hanya peserta event yang dapat melihat materi ini"
- [x] Lightbox galeri: zoom, geser, putar, navigasi ±, pintasan papan tik
- [x] YouTube unlisted → iframe nocookie; URL divalidasi di server
- [x] Desain chip untuk materi & referensi + tooltip petunjuk
- [x] `/admin/events` berbasis DB dengan pencarian, filter status, hapus berpengaman
- [x] `/admin/event/[id]`: form event + tambah/hapus sesi + tambah/hapus item + unggah berkas
- [x] Event baru otomatis dibekali satu sesi (dalam satu transaksi)
- [x] Endpoint media dilindungi `wajibRole('editor')`
- [x] Kartu event: hanya tombol "Detail event"; filter jadi cari + dropdown + rentang tanggal
- [x] Panel pendaftaran: separator + jalur akun + popup konfirmasi; submit benar-benar tersimpan
- [x] `pages/events/[slug].vue` generik
- [x] Diuji: tolak URL YouTube salah, urutan sesi MAX+1, cascade hapus, tamu 401
      di `/api/media`, `/api/media/upload`, `/api/admin/events`, dan 3/4 materi tergembok

### Catatan / risiko

**Belum ada di admin:** ubah item yang sudah dibuat (baru tambah & hapus), pengurutan
ulang sesi lewat seret, dan pemilih dari pustaka media (setiap unggahan selalu berkas
baru). `PATCH /api/admin/sesi-item/[id]` sudah ada, UI-nya belum.

**Tiga halaman event lama masih hardcoded** teks & jadwalnya; hanya blok materinya
yang kini dari database.

**Kredensial dev masih di source code** dan **belum ada pendaftaran akun mandiri** —
keduanya masih terbuka dari Sesi 3.

---

## 2026-08-11 — Sesi 4: Perapian halaman event & tombol lipat sidebar

### Filter event: dari panel jadi satu baris

Panel filter sebelumnya sebuah `UCard` dua tingkat — tiga field bertingkat di atas,
pintasan fase di bawah — untuk mengendalikan dua hal saja. Sekarang satu baris:
chip fase (dengan hitungan di sisi kanan label) + satu tombol rentang tanggal + reset.
Reset hanya muncul saat ada filter aktif, bukan tampil terus dalam keadaan `disabled`.

Warna chip aktif dipindah dari `secondary` (cokelat) ke `primary` (hijau) supaya
sejalan dengan badge `mendatang` dan tidak menabrak aksen emas di sekitarnya.

### Datepicker: `<input type="date">` → `UCalendar`

Tampilan `input type="date"` ditentukan browser, jadi tidak bisa diselaraskan dengan
palet situs — itu yang bikin bagian tanggal terlihat asing. Diganti `UPopover` +
`UCalendar range`.

`UCalendar` bekerja dengan `DateValue` dari `@internationalized/date`, yang **bebas
zona waktu**. Kebetulan ini menutup celah yang sama dengan bug "tanggal bergeser
sehari" di Sesi 3: `keYmd()` menyusun `YYYY-MM-DD` dari `d.year/month/day` langsung,
tanpa pernah melewati `Date` atau `toISOString()`.

Nilai kosong memakai `undefined`, bukan `null` — Reka UI (penyokong `UCalendar`)
memperlakukan `null` sebagai nilai, bukan sebagai "belum dipilih".

`@internationalized/date` **tidak ada di `package.json`**; ia transitif dari `@nuxt/ui`.
Impornya mengikuti dokumentasi Nuxt UI dan berjalan, tapi ini ketergantungan tak
tercatat — layak dipromosikan jadi dependency eksplisit saat lockfile dirapikan.

### Kartu event — kembali ke `.card` bespoke

Percobaan pertama membungkus kartu dengan `UCard` dan `<img>`. Hasilnya salah dua hal
sekaligus: `UCard` memberi padding sendiri pada isinya sehingga sampul jadi
**terbingkai**, bukan menempel ke tepi, dan tinggi kartu melar ke ~570px.

Kartu dikembalikan ke `.card` / `.card-image` / `.card-body` — kelas yang sama dengan
kartu event di beranda. Sampul kembali jadi `background-image` pada `.card-image`
(tinggi tetap 176px, penuh ke tepi), dan tinggi kartu turun ke ~416px. Yang ikut
memendekkan: `<dl>` dua baris (lokasi di satu baris, biaya + sisa kuota di baris lain)
dirapatkan jadi satu baris `.event-line`.

Pelajarannya: untuk elemen yang identitas visualnya sudah dipegang `main.css`,
membungkusnya dengan komponen Nuxt UI justru menambah lapisan yang harus dilawan.
Pembagian di design.md §8 berlaku — Nuxt UI untuk **kontrol**, CSS bespoke untuk
**identitas** — dan kartu event masuk kelompok kedua.

- **Sampul kembali.** `GET /api/events` kini mengirim `cover` (dari `coverMediaId`).
  Diambil lewat query terpisah, bukan join: `coverMediaId` sengaja tanpa
  `.references()` sehingga barisnya tidak dijamin ada. Kalau kosong, halaman jatuh ke
  gambar statis per slug, lalu ke `event-gallery-placeholder.png`. Nilainya dipasang
  sebagai `style` inline agar menang atas aturan gradien `.card-image` di `main.css`.
- **Badge fase pindah ke pojok kanan atas sampul.** Semua varian jadi `solid` —
  `subtle` yang transparan tidak terbaca di atas gambar.
- **Satu tanggal saja.** Rentang `12 Agu – 14 Agu` diganti tanggal mulai dalam format
  panjang; rentang penuh tetap ada di halaman detail. `rentangTanggal()` dihapus.

### Perlakuan event yang sudah selesai

Dua hal dicabut, keduanya karena mengulang informasi yang sudah ada:

1. **`opacity-75 saturate-50` dihapus.** Meredupkan seluruh kartu ikut meredupkan
   sampulnya — dokumentasi event yang sudah lewat justru bagian yang ingin dilihat.
2. **Tombol "Selesai" yang mati dihapus.** Ia duduk di samping "Detail event" tanpa
   bisa diklik, sementara badge di sampul sudah menyatakan hal yang sama. Kartu event
   selesai kini hanya menawarkan "Detail event".

Sekalian: label "Daftar 1x klik" beserta ikon petirnya diganti "Daftar" saja. Beda
alur (1 klik vs formulir) tetap ada di modal, tapi tidak perlu diumumkan di tombol.

### Animasi

Kartu masuk dengan naik-memudar 14px/0.42s, berurutan lewat `animation-delay` inline
(60ms per kartu, dibatasi 8 kartu supaya kartu terakhir tidak menunggu lama). Hover
mengangkat kartu 4px sekaligus memperbesar sampulnya 1.05 — satu gerakan searah, bukan
dua efek yang bersaing. Semua dimatikan pada `prefers-reduced-motion: reduce`.

### Tombol lipat sidebar

Efek "timbul" tombol bulat itu dibangun dari bibir gelap (`0 2px 0 #16220f`) dan
bayangan (`0 4px 9px #00000047`). Di atas sidebar hijau tua, keduanya terbaca sebagai
noda hitam mengelilingi lingkaran, bukan sebagai kedalaman. Diganti rata: latar
`--color-primary`, garis rambut putih transparan, `box-shadow: none`. Hover menyalakan
tepi emas, tekan mengecilkan tombol.

### Yang dikerjakan sesi ini

- [x] Filter event jadi satu baris chip + popover tanggal + reset kondisional
- [x] `UCalendar` menggantikan dua `<input type="date">`
- [x] `cover` di `GET /api/events` + sampul pada kartu (dengan fallback berlapis)
- [x] Kartu kembali ke `.card`/`.card-image`/`.card-body`: sampul penuh ke tepi,
      tinggi kartu ~570px → ~416px
- [x] Badge fase di pojok kanan atas sampul, semua `solid`
- [x] Satu tanggal per kartu
- [x] Event selesai: peredupan dicabut, tombol "Selesai" yang mati dihapus
- [x] "Daftar 1x klik" + ikon → "Daftar"
- [x] Animasi masuk berurutan + hover, hormat `prefers-reduced-motion`
- [x] Tombol lipat sidebar admin dibuat rata, tanpa bayangan hitam
- [x] Diuji di `/id/events` dan `/en/events`: rentang 12 Agu–5 Sep menyisakan 1 event,
      hitungan per fase ikut menyesuaikan, tanpa error konsol

### Catatan / risiko

Seluruh butir terbuka dari Sesi 3 **masih terbuka**: kredensial dev di source code,
belum ada pendaftaran akun mandiri, unggah gambar refleksi belum tersambung, dan
endpoint media masih tanpa `wajibRole()`.

---

## 2026-08-11 — Sesi 3: Autentikasi, halaman event berbasis data, profil & refleksi

### Tujuan
Menjadikan halaman event membaca data sungguhan lengkap dengan filter dan badge,
membangun autentikasi agar pendaftaran satu klik dan pengamanan `/admin` jadi nyata,
lalu menambah profil user beserta refleksi.

### Autentikasi

Sesi memakai cookie terenkripsi (`useSession` bawaan h3) — tanpa tabel sesi.
Isinya minimal: id, username, nama, role. Kuncinya dari `runtimeConfig.sessionPassword`,
**wajib** diganti lewat env `NUXT_SESSION_PASSWORD` sebelum keluar dari mesin dev.

`userSaatIni()` memverifikasi ulang ke database setiap permintaan, bukan percaya isi
cookie: akun yang dinonaktifkan atau rolenya diturunkan langsung kehilangan akses
tanpa menunggu cookie kedaluwarsa.

Endpoint: `POST /api/auth/login` (boleh username **atau** email), `logout`, `me`.
Pesan galat login sengaja sama untuk "user tidak ada" dan "password salah" agar tidak
membocorkan username mana yang terdaftar.

### Pengamanan `/admin` — dua lapis

| Lapis | Berkas | Menahan |
|---|---|---|
| Halaman | `middleware/admin.global.ts` | Ketik URL manual; berjalan saat SSR jadi tertahan sebelum HTML dikirim |
| API | `wajibRole()` di tiap handler | Panggilan langsung ke `/api/admin/**` |

Middleware dibuat **global**, bukan dipasang per halaman, supaya halaman admin baru
otomatis ikut terlindungi tanpa perlu ingat menambah `middleware:` di definePageMeta.

Hasil uji: tamu → redirect ke `/id/login?redirect=/admin`, API 401. User level 4 →
ditolak ke beranda, API 403. Editor/admin/master → lolos, API 200.

### Halaman event

Berhenti memakai array literal; kini dari `GET /api/events`.

**Fase bukan kolom.** `status` di DB adalah keadaan redaksional
(draft/terbit/selesai/batal), sementara fase (mendatang/berlangsung/selesai)
**diturunkan dari tanggal saat dibaca**. Kalau fase disimpan, ia basi begitu
tanggalnya lewat dan butuh cron untuk memutakhirkan.

- Tab diganti filter (bisa pilih lebih dari satu fase) + rentang tanggal
- Semua event tampil sekaligus, tidak lagi tersembunyi di balik tab
- Badge per fase; yang `selesai` diredam (`opacity-75 saturate-50`)
- Kartu menampilkan lokasi, biaya, sisa kuota

### Pendaftaran satu klik

`POST /api/events/[slug]/register`. Saat sudah masuk, body dikirim **kosong** — server
yang mengambil nama & email dari sesi, sehingga data peserta tidak bisa dipalsukan
dari klien. Tamu tetap bisa mendaftar lewat formulir di modal yang sama.

Semua pemeriksaan di server: fase, batas pendaftaran, kuota, dan duplikat (lewat
unique index `uq_peserta_kegiatan_email`). Tombol yang dinonaktifkan hanya kenyamanan.
API juga mengembalikan `sudahTerdaftar` supaya tombol tidak menawarkan pendaftaran
yang pasti ditolak.

### Profil & refleksi

Tabel baru `cc_refleksi` (migrasi `0001_refleksi`) dengan visibilitas
publik/peserta/pribadi. Refleksi ditulis peserta sendiri — berbeda dari jurnal yang
ditulis & dikurasi editor.

- `/id/profil` untuk **semua role**: identitas, riwayat event, refleksi, pengaturan akun
- Refleksi tampil sebagai kisi bergaya Instagram; yang tanpa gambar memakai kutipannya
  sendiri sebagai visual
- Ubah profil + ganti password (password lama tetap diminta, supaya perangkat yang
  tertinggal dalam keadaan masuk tidak bisa dipakai mengunci pemiliknya keluar)
- `/admin/members` jadi daftar user sungguhan dengan pencarian (debounce 300ms) + filter role & status
- Level 1–3 bisa membuka profil orang lain; refleksi `pribadi` hanya untuk penulis dan level ≤ 2

Login: tombol lihat password + deteksi Caps Lock (hanya bisa dideteksi dari event
keyboard — tidak ada API untuk menanyakan keadaannya, jadi peringatan baru muncul
setelah tombol pertama ditekan).

### Area admin

- Sidebar bisa dilipat (254px ↔ 76px). Keadaannya disimpan di **cookie**, bukan ref:
  kalau di memori, sidebar kembali terbuka setiap pindah halaman
- Ikon Lucide di setiap menu, tombol lipat berupa panah mengambang di tepi sidebar
- Ditambah: Kembali ke beranda, Petunjuk, Keluar, dan identitas user di kaki sidebar
- Di layar ≤760px sidebar jadi bilah atas berisi ikon — sebelumnya menu ini
  `display:none` tanpa pengganti, jadi navigasi admin hilang sama sekali
- **Rekap role & wewenang kini khusus master.** Disaring di server, bukan cuma `v-if`:
  kalau hanya disembunyikan di template, datanya tetap terkirim ke browser
  admin/editor dan terbaca dari devtools. Admin & editor mendapat halaman
  `/admin/petunjuk` yang menjelaskan aturannya tanpa rekap akun

### Temuan saat pengujian

**`user123` hanya 7 karakter**, di bawah minimum 8 yang sempat saya tetapkan untuk
ganti password — akibatnya password itu tidak bisa dipasang ulang lewat form sendiri.
Minimum diturunkan ke 6 agar kredensial yang sudah ditentukan tetap berlaku.
Naikkan ke 12 begitu kredensial produksi ditetapkan.

**`/api/users/me` sempat 400.** Karena `me.patch.ts` sudah mendaftarkan
`/api/users/me` sebagai rute statis, permintaan GET ke path itu tidak lagi mengisi
router param `id` di `[id].get.ts`. Diselesaikan dengan `me.get.ts` eksplisit dan
logika bersama di `server/utils/profil.ts`.

**Tanggal bergeser sehari.** Kegiatan di-seed dengan offset `+07:00`; menampilkannya
lewat `toISOString()` menghasilkan tanggal UTC yang mundur sehari. Semua tampilan
tanggal kini memakai `Intl.DateTimeFormat` dengan `timeZone: 'Asia/Jakarta'`.

### Yang dikerjakan sesi ini

- [x] Sesi cookie + `login`/`logout`/`me`, boleh masuk pakai username atau email
- [x] `middleware/admin.global.ts` + `wajibRole()` di endpoint admin
- [x] Halaman `/id/login` & `/en/login`; tombol navbar "Masuk" mengarah ke sana
- [x] Navbar menampilkan nama + menu akun saat sudah masuk
- [x] Seed 5 kegiatan; `GET /api/events` dengan filter fase & rentang tanggal
- [x] Halaman event: semua data, badge fase, filter, sisa kuota
- [x] `POST /api/events/[slug]/register` + modal pendaftaran (1 klik / tamu)
- [x] Tabel `cc_refleksi` + migrasi + API tulis/hapus
- [x] `/id/profil` untuk semua role + kisi refleksi bergaya Instagram
- [x] Ubah profil, ganti password, lihat password, deteksi Caps Lock
- [x] `/admin/members` berbasis DB dengan pencarian + filter
- [x] Sidebar admin: collapsible, ikon, logout, beranda, petunjuk
- [x] `/admin/petunjuk`; rekap role dibatasi untuk master
- [x] Verifikasi 23 rute — semuanya 200

### Catatan / risiko

**Kredensial dev ada di source code.** `server/db/seed.ts` dan
`runtimeConfig.sessionPassword` keduanya berisi nilai yang bisa dibaca siapa pun yang
membuka repo. Wajib diganti sebelum situs dipakai sungguhan.

**Belum ada pendaftaran akun mandiri.** Akun hanya lahir dari seeder; halaman
`/admin/member/new` masih mockup dan belum menulis ke database.

**Halaman detail event masih hardcoded.** Tiga event punya halaman sendiri dengan teks
tetap; dua event baru hasil seed hanya bisa didaftari lewat modal di daftar event.

**Unggah gambar refleksi belum tersambung.** Kolom `mediaId` sudah ada dan API media
sudah jalan, tapi form refleksi belum punya pemilih berkas.

Backlog Sesi 1 yang **masih terbuka**: `--port/`, `.output/` stale, `.gitignore`,
`tsconfig.json`, `pnpm-workspace.yaml` rusak, dua lockfile, 6 vulnerability npm,
`landing-page-full.png` di root.

---

## 2026-08-11 — Sesi 2: Role, dashboard, animasi & migrasi ke Nuxt UI

### Tujuan
Menetapkan sistem role berjenjang, membuat seeder, memperjelas alur dashboard,
menambah animasi transisi, dan memindahkan seluruh kontrol antarmuka ke Nuxt UI.

### Role & autentikasi

Role ditetapkan empat tingkat, **angka kecil = wewenang besar**:

| Level | Role | Tugas |
|---|---|---|
| 1 | master | Akses penuh, termasuk mengelola akun & menetapkan role |
| 2 | admin | Pendataan operasional: event, pendaftar, peserta, transaksi |
| 3 | editor | Menulis & menerbitkan jurnal, mengelola media |
| 4 | user | Peserta: mendaftar event, membuka materi haknya |

Level **diturunkan dari role** (`ROLE_LEVELS` di `server/db/schema/users.ts`), bukan
disimpan sebagai kolom, supaya tidak ada dua sumber kebenaran. Helper `hasAtLeast()`
memakai perbandingan `level <= n` agar satu aturan mencakup "role ini ke atas".

Menambah `editor` **tidak butuh migrasi**: `text({ enum })` di drizzle hanya
menghasilkan union type di TS; di SQLite kolomnya tetap TEXT polos tanpa CHECK.

### Seeder

`server/db/seed.ts` dibuat (sebelumnya `db:seed` menunjuk berkas yang tidak ada).
Sifatnya idempoten — dicocokkan lewat `username`, yang sudah ada diperbarui.

Password di-hash dengan **scrypt dari `node:crypto`**, bukan bcrypt/argon2, supaya
tidak menambah dependensi native. Format simpan `scrypt$N$r$p$salt$hash` — parameter
ikut disimpan agar hash lama tetap terverifikasi kalau biayanya dinaikkan nanti.
Verifikasi memakai `timingSafeEqual`.

Hasil: 4 akun (master/admin/editor/user). Kredensialnya kredensial pengembangan.

### Dashboard

- Endpoint baru `GET /api/admin/stats` — hitungan nyata dari database
  (user per role, kegiatan per status, peserta per status, transaksi, media).
- `pages/admin/index.vue` ditulis ulang: **halaman admin pertama yang membaca data
  sungguhan**, bukan angka di template.
- Alurnya dibuat eksplisit dalam 4 langkah: terbitkan event → terima pendaftaran →
  konfirmasi & catat pembayaran → unggah materi & terbitkan jurnal. Tiap langkah
  menunjukkan angkanya sendiri dan menandai apakah sudah ada isinya.
- Tabel role menampilkan level, jumlah akun, dan wewenang.

### Animasi

`app.pageTransition` + `layoutTransition` di nuxt.config, kelasnya di main.css.
Gerakan sengaja kecil (8px, 0.28s) mengikuti nada situs. Ditambah transisi hover
untuk kartu dan tombol. Seluruhnya dimatikan pada `prefers-reduced-motion: reduce`.

### Migrasi ke Nuxt UI

Seluruh kontrol antarmuka dipindah ke komponen Nuxt UI. **Nol `<select>`,
`<input>`, `<textarea>`, dan `<table>` native tersisa** di `pages/`, `layouts/`,
dan `components/`.

Tiga temuan yang memakan waktu:

1. **`ui.colors` harus di `app.config.ts`, bukan `nuxt.config.ts`.** Ditaruh di
   nuxt.config akan diabaikan diam-diam — komponen tetap hijau default Nuxt UI.

2. **Ramp warna wajib `@theme static`.** Tailwind v4 hanya menerbitkan nilai `@theme`
   yang dipakai suatu utility class. Nuxt UI merujuk ramp lewat CSS
   (`--ui-color-primary-300: var(--color-cc-green-300)`), dan rujukan itu tidak
   terhitung sebagai pemakaian. Dengan `@theme` biasa hanya shade yang kebetulan
   dipakai di template yang muncul — sisanya kosong, tombol primary jadi transparan.

3. **CSS lama harus dihapus, bukan ditimpa.** Selektor seperti
   `.journal-controls input` dan `.registration input` berspesifisitas (0,1,1),
   sementara utility Nuxt UI (0,1,0) — dan keduanya di layer `utilities` yang sama.
   Aturan lama selalu menang. Yang dihapus: `.tabs button`, `.registration input/label`,
   `.journal-controls select/input`, `.search-icon`, `.resource-toggle`.

Efek samping yang perlu diperbaiki: `.card:nth-child(2) .card-image.listening-image`
bergantung pada posisi kartu, padahal halaman event kini menampilkan satu kartu per
tab. Diubah jadi `.card .card-image.listening-image` (spesifisitas tetap 0,3,0 supaya
menang lewat urutan sumber atas aturan gradien).

### Yang dikerjakan sesi ini

- [x] Navbar: tombol "Ikut Event" → "Masuk"/"Login" (lebih kecil), font menu 13→14px
- [x] Favicon `public/favicon.svg` + fondasi SEO di `app.vue` (lang, title template,
      OG/Twitter, canonical, hreflang id/en/x-default, noindex untuk `/admin`)
- [x] `useSeoMeta` dwibahasa di 10 halaman publik
- [x] Role 4 tingkat + `ROLE_LEVELS`/`hasAtLeast`
- [x] `server/utils/password.ts` (scrypt) + `server/db/seed.ts`
- [x] `GET /api/admin/stats` + dashboard berbasis data nyata
- [x] Transisi halaman/layout + hover, hormat `prefers-reduced-motion`
- [x] Migrasi seluruh kontrol ke Nuxt UI (13 halaman + 1 komponen baru)
- [x] `components/EventResources.vue` — folder `components/` akhirnya dibuat;
      markup materi yang tadinya disalin di 2 halaman jadi satu komponen
- [x] Hex hardcoded di halaman admin (`[#2B4028]` dsb) diganti kelas token `cc-*`
- [x] Verifikasi 24 rute — semuanya 200, tanpa error render

### Catatan / risiko

**Belum ada autentikasi.** Role sudah ada di database, tapi belum menentukan apa pun
saat halaman dibuka. `/admin` dan `/api/admin/stats` masih terbuka bagi siapa saja
yang tahu URL-nya. Tombol "Masuk" di navbar sementara diarahkan ke `/admin`.

**Halaman admin selain dashboard masih mockup.** Event, Member, Jurnal, Pendaftar
sudah memakai komponen Nuxt UI, tapi datanya masih array literal di `.vue`.

**Dwibahasa masih jauh dari selesai.** Yang sudah: navigasi, metadata, kontrol
jurnal, halaman event, formulir pendaftaran. Yang belum: badan teks `pages/index.vue`,
`insights.vue`, dan seluruh halaman admin (admin memang di luar sistem locale).

Backlog dari Sesi 1 yang **masih terbuka**: `--port/`, `.output/` stale, `.gitignore`,
`tsconfig.json`, `pnpm-workspace.yaml` rusak, dua lockfile, 6 vulnerability npm,
`landing-page-full.png` di root.

---

## 2026-08-10 — Sesi 1: Audit stack & setup lokal

### Tujuan
Memetakan teknologi apa yang benar-benar terpasang, memverifikasi asumsi awal,
menentukan package manager, dan mengunci port dev lokal di **3009**.

### Hasil verifikasi asumsi

| Asumsi awal | Kenyataan | Catatan |
|---|---|---|
| Nuxt 4 | ✅ **Benar** | `nuxt ^4.1.0`, ter-resolve ke **4.5.0** |
| Nuxt UI | ❌ **Tidak terpasang sama sekali** | Bukan "belum semuanya" — memang tidak ada di `package.json` |
| Drizzle / Prisma sebagai ORM | ❌ **Tidak ada ORM, tidak ada database** | Semua data hardcoded di dalam `.vue` |
| Monorepo | ❌ **Bukan monorepo** | Ada `pnpm-workspace.yaml` tapi tanpa key `packages:` |
| TypeScript | ⚠️ **Sebagian** | Pakai `lang="ts"`, tapi tidak ada `tsconfig.json` & tidak ada script typecheck |
| Tailwind bawaan | ⚠️ **Terpasang tapi tidak dipakai** | Modul ada, tapi 0 directive & 0 utility class |

### Stack sebenarnya

**Dependencies (hanya 4 paket):**
- `nuxt` ^4.1.0 → 4.5.0
- `@nuxtjs/i18n` ^10.2.0 → 10.5.0
- `@nuxt/image` 2.0.0 (pinned)
- `@nuxtjs/tailwindcss` ^6.14.0 (devDependency)

**Package manager: pnpm.**
Bukti: ada `pnpm-lock.yaml` (lockfileVersion 9.0) + folder `.pnpm-store`.
Tidak ada `package-lock.json` maupun `yarn.lock`.
Versi tersedia di mesin ini: node v25.2.0, npm 11.6.2, pnpm 10.33.2, yarn 1.22.22.

### Temuan penting

1. **Belum pernah di-install di folder ini.** `node_modules/` tidak ada sama sekali.

2. **Project ini hasil pindahan.** `.nuxt/nuxt.json` masih menyimpan rootDir lama:
   `C:/Users/lucuh/OneDrive/Documents/Codex Projects/CompassionateCompanion`.
   Artinya folder `.nuxt/` dan `.output/` yang ada sekarang **stale** — sisa build
   dari mesin/lokasi lain, bukan hasil build di sini.

3. **Struktur folder masih gaya Nuxt 3, bukan Nuxt 4.**
   `app.vue`, `pages/`, `layouts/`, `middleware/` ada di root, bukan di dalam `app/`.
   Nuxt 4 masih mendukung ini (backward compat), tapi bukan layout default v4.

4. **Tailwind praktis mati.**
   - Tidak ada `tailwind.config.ts/js`
   - `assets/css/main.css` tidak punya satu pun `@tailwind` / `@apply`
   - Template tidak memakai utility class Tailwind sama sekali
   - Styling nyata = **~1050 baris CSS tulis tangan** di `assets/css/main.css`,
     pakai CSS custom properties (`--color-primary`, `--color-accent`, dst.)

5. **i18n hanya dipakai untuk prefix route, bukan untuk translasi.**
   - `strategy: 'prefix'` → semua halaman publik jadi `/id/...` dan `/en/...`
   - Tidak ada folder `i18n/` atau `locales/`, tidak ada file pesan
   - `$t()` / `useI18n()` **tidak dipakai di satu file pun**
   - Bilingual dikerjakan manual lewat ternary di template:
     `{{ isEn ? 'About' : 'Tentang' }}` (lihat `layouts/default.vue`)

6. **Tidak ada backend.**
   - `server/` isinya cuma 1 file: `server/middleware/locale-redirect.ts` (redirect legacy → `/id`)
   - Tidak ada `server/api/`
   - Tidak ada `useFetch` / `useAsyncData` / `$fetch` di seluruh `pages/`
   - Halaman admin (`pages/admin/*`) = **mockup statis**, angkanya di-hardcode
   - Data jurnal = array literal di dalam `pages/jurnal.vue`

7. **Folder sampah `--port` di root.**
   Berisi `.nuxt/` + `node_modules/.cache/` lengkap. Ini artefak dari perintah
   yang salah ketik (kemungkinan `nuxt dev --port` tanpa nilai, atau shell yang
   memperlakukan `--port` sebagai nama direktori). Aman dihapus — **belum dihapus,
   menunggu konfirmasi.**

8. **Lain-lain:**
   - `pnpm-workspace.yaml` isinya rusak/placeholder:
     `allowBuilds: esbuild: set this to true or false` — key-nya juga salah,
     pnpm 10 memakai `onlyBuiltDependencies`
   - Tidak ada `.gitignore`, bukan git repository
   - `landing-page-full.png` (336 KB) nyangkut di root project

### Struktur halaman

```
pages/
├── index.vue                          landing page
├── events.vue                         daftar event
├── events/
│   ├── compassion-in-practice.vue
│   ├── leadership-with-compassion.vue
│   └── listening-as-leadership.vue
├── jurnal.vue                         listing + filter/search/sort (client-side)
├── insights.vue
├── reflection-journey.vue
├── sharing-menata-kegelisahan.vue
├── sharing-mendengar-dengan-hadir.vue
└── admin/                             mockup statis, dikecualikan dari i18n
    ├── index.vue  ├── events.vue     ├── members.vue
    ├── jurnal.vue ├── contributors.vue ├── registrations.vue
    ├── [section].vue
    └── event/[id].vue, jurnal/[id].vue, member/[id].vue
```

Layout: `default.vue` (header + footer publik) dan `admin.vue` (sidebar).

### Yang dikerjakan sesi ini

- [x] Audit menyeluruh isi folder & verifikasi 6 asumsi awal
- [x] Kunci port dev di **3009** lewat `devServer: { port: 3009 }` di `nuxt.config.ts`
      → dipilih di nuxt.config (bukan flag CLI) supaya `npm run dev`, `yarn dev`,
      dan `pnpm dev` semuanya konsisten 3009 tanpa perlu mengingat flag
- [x] `npm install` → **berhasil**, 891 packages, 3 menit, exit 0
- [x] `yarn dev` → **berhasil**, jalan di `http://localhost:3009`
- [x] Verifikasi route lewat curl
- [x] Buat `journal.md` ini

### Hasil verifikasi runtime

Dev server naik dengan: Nuxt 4.4.5, Nitro 2.13.4, Vite 7.3.6, Vue 3.5.41.

| Route | Hasil |
|---|---|
| `/` | 302 → `/id` (server middleware bekerja) |
| `/id` | 200, 11325 bytes |
| `/en` | 200, 11327 bytes |
| `/id/jurnal` | 200, 10463 bytes |
| `/admin` | 200, 4392 bytes (tidak kena prefix locale, sesuai config) |

### Catatan / risiko

**Campur package manager — dan drift-nya sudah terbukti.**
Repo ini lockfile-nya pnpm, tapi sesi ini pakai `npm install` + `yarn dev`.
npm mengabaikan `pnpm-lock.yaml` dan resolve ulang dari range di `package.json`,
lalu membuat `package-lock.json` baru. Hasil nyatanya:

| Paket | Versi di `pnpm-lock.yaml` | Versi hasil `npm install` |
|---|---|---|
| nuxt | 4.5.0 | **4.4.5** |
| vite | 8.1.5 | **7.3.6** |

Jadi yang jalan sekarang **bukan** dependency tree yang pernah dites sebelumnya.
Untuk sekarang tidak masalah (semua route 200), tapi kalau nanti muncul bug aneh,
ini kandidat penyebab pertama yang harus dicek.

`yarn dev` sendiri aman — yarn 1 cuma menjalankan script `dev`, tidak menyentuh
resolusi dependency.

Sepenuhnya reversible: hapus `node_modules/` + `package-lock.json`, lalu
`pnpm install` kalau mau balik ke lockfile asli.

Rekomendasi ke depan: **pilih satu PM** dan konsisten. Kalau mau ikut lockfile yang
sudah ada, pakai pnpm. Kalau mau pindah ke npm, hapus `pnpm-lock.yaml` dan
`.pnpm-store` agar tidak membingungkan.

**Security & deprecation dari npm install:**
- 6 vulnerabilities (1 low, 1 moderate, 4 high) — **belum di-fix**.
  `npm audit fix --force` sengaja tidak dijalankan karena bisa naik major version
  dan merusak build. Perlu keputusan manual.
- `vue-i18n@10.0.8` deprecated — v9 & v10 sudah tidak didukung, disarankan ke v11
- Deprecated lain: `inflight@1.0.6`, `glob@7.2.3`, `glob@10.5.0`, `@koa/router@12.0.2`
  (semuanya transitive, bukan dependency langsung)

### Backlog / kandidat pekerjaan berikutnya

- [ ] Hapus folder sampah `--port/` (menunggu konfirmasi)
- [ ] Hapus `.nuxt/` dan `.output/` yang stale dari mesin lama
- [ ] Tambah `.gitignore` (`node_modules`, `.nuxt`, `.output`, `.pnpm-store`, `--port`, `dev.log`)
- [ ] Putuskan 6 vulnerabilities dari npm audit (4 high) mau diapakan
- [ ] `dev.log` di root dibuat saat sesi ini untuk menangkap output dev server —
      hapus kalau tidak dipakai lagi
- [ ] Putuskan nasib Tailwind: benar-benar dipakai, atau dicopot dari dependencies
- [ ] Putuskan nasib Nuxt UI: pasang beneran, atau tidak sama sekali
- [ ] Kalau admin mau fungsional → butuh keputusan DB + ORM (Drizzle/Prisma) +
      `server/api/`, karena sekarang belum ada apa-apa
- [ ] Pindahkan teks bilingual ke file locale i18n, ganti ternary `isEn ? ... : ...`
- [ ] Tambah `typescript` + `vue-tsc` + script `typecheck` kalau mau TS beneran
- [ ] Perbaiki atau hapus `pnpm-workspace.yaml` yang isinya placeholder rusak
- [ ] Pindahkan `landing-page-full.png` keluar dari root

---
