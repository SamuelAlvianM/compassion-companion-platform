# Journal — Compassionate Companion Website

Catatan kerja untuk project di `C:\sam\COSMOS\ccwebsite`.
Format: entri terbaru di atas. Setiap sesi kerja tambahkan satu blok.

---

## 2026-08-14 — Sesi 13: Formulir tambah event berhenti jadi setengah formulir

Revisi tinjauan 14 Agu. Yang menyatukannya: **halaman "Event baru" berhenti jadi
versi pincang dari halaman ubah.** Ketiga tabnya ada, ketiganya bisa diisi, dan
tidak ada satu baris pun yang masuk database sampai "Buat event" ditekan.

### Tanggal selesai yang tertinggal di belakang tanggal mulai

Bug yang dilaporkan langsung: pilih 4 Agu (tanggal selesai ikut terisi 4 Agu), lalu
betulkan tanggal mulai jadi 14 Agu — selesai tetap 4 Agu, dan formulir berdiri
dengan event yang berakhir sepuluh hari sebelum ia mulai.

Sebabnya satu baris di `watch`: `if (!mulai || sebelumnya) return`. Ia sengaja
hanya mengisi **sekali**, untuk melindungi event berhari-hari dari disingkat jadi
sehari tiap tanggal mulainya dibetulkan (catatan Sesi 12). Perlindungannya benar,
cakupannya yang kurang. Sekarang tiga aturan:

| Keadaan tanggal selesai | Yang terjadi saat tanggal mulai berubah |
|---|---|
| kosong | ikut tanggal mulai |
| sama dengan tanggal mulai **yang lama** | ikut terus — itu event sehari, selesainya cuma cerminan |
| dipilih sendiri, dan mulai baru melewatinya | **digeser sejauh yang sama**, durasinya utuh |
| dipilih sendiri, masih di belakang mulai | tidak disentuh |

Terbukti di browser: 4 → 14 membawa selesai ke 14; event 14–17 yang mulainya
dipindah ke 20 jadi **20–23**, bukan 20–20. `geserYmd()` lewat `Date.UTC`, bukan
`new Date()` — jalur yang sama yang dulu memundurkan tanggal sehari.

### Draf: tiga tab, nol permintaan, satu tombol

Percobaan pertama sesi ini keliru arah: klik pada tab peserta/materi **melahirkan**
eventnya lebih dulu supaya tabnya bisa dipakai. Ditolak, dan alasannya benar —
keluar dari tab pertama jadi tindakan yang akibatnya jauh lebih besar dari yang
terlihat, dan yang cuma mau *melihat* tab sebelah sudah terlanjur menerbitkan
sesuatu.

Jadi drafnya ditahan di halaman. `sesi` yang sama dipakai untuk dua-duanya, cuma
dengan id `tmp-…` pada mode baru, sehingga seluruh template tidak perlu tahu
bedanya. Empat komponen dapat prop `lokal` yang membuatnya **mengembalikan** draf
alih-alih menyimpan sendiri: `SesiPengaturan` (lewat `ubah`), `SesiItemModal`,
`GaleriUnggahModal`, dan `GaleriCropModal` (lewat `draf`).

`buatEvent()` menulis semuanya berurutan — kegiatan → sesi → item → peserta —
karena sesi butuh `kegiatanId` dan item butuh `sesiId`; tidak ada jalan serentak.
Urutan tampilnya aman: `urutan` dihitung server dari MAX yang sudah ada, jadi
mengirim satu per satu sesuai urutan draf sudah cukup. Sesi bawaan yang dibuatkan
server dipakai ulang untuk draf pertama — kalau tidak, event berdraf satu sesi
lahir dengan dua.

**Berkas adalah pengecualian yang tidak bisa dihindari.** `mediaId` hanya lahir
dari unggahan, jadi berkas naik saat dipilih. Kalau event batal dibuat, yang
tertinggal berkas tanpa pemakai di pustaka — bukan event setengah jadi. Menahan
belasan foto ponsel di memori sampai tombol ditekan adalah taruhan yang lebih buruk.

### Peserta bisa dimasukkan tangan — endpoint yang selama ini tidak ada

Asumsi awal saya salah dan sempat disampaikan sebagai fakta: "peserta tidak pernah
dibuat dari dashboard". Benar untuk kode yang ada, keliru sebagai keputusan produk —
sebagian orang membooking lewat WhatsApp atau di tempat, dan menyuruh mereka
mendaftar ulang lewat halaman publik berarti mengulang pekerjaan yang sudah selesai.

`POST /api/admin/events/[id]/peserta`. Sengaja lebih longgar dari pendaftaran
publik: fase dan pendaftaran tertutup tidak diperiksa (pencatatan susulan justru
paling sering terjadi sesudah pendaftaran ditutup), kuota tidak menolak (admin yang
menambahkan orang ke-31 tahu betul ia yang ke-31). Yang tetap ketat: unique
`(kegiatan_id, email)` dan format emailnya.

Emailnya dicocokkan ke `cc_user` supaya `userId` ikut terisi — tanpa itu orang yang
jelas punya akun muncul sebagai "Non member", lalu ada yang membuatkannya akun kedua.

Formnya (`PesertaFormModal`) menyempit sampai tinggal yang benar-benar ditanyakan:

- **Pilih dari member** — `USelectMenu` dengan pencarian bawaannya, bukan kotak cari
  + daftar hasil buatan sendiri. Yang didapat gratis: navigasi papan ketik, penutupan
  saat diklik di luar, dan bentuk yang sama dengan kotak pilihan lain di dashboard.
  Daftarnya diambil sekali saat modal dibuka lalu disaring di klien; komunitas ini
  tidak punya jumlah akun yang menuntut paginasi. `filterFields: ['label', 'email']` —
  emailnya harus benar-benar ada di data yang disaring, kalau cuma digambar di slot,
  mengetik alamat email tidak menemukan siapa pun.
- **Institusi dicabut.** Kolomnya masih ada di `cc_peserta` dan masih diisi pendaftaran
  publik; yang tidak ada gunanya adalah menanyakannya pada orang yang sedang mencatat
  nama dari catatan WhatsApp.
- **Status tidak ditanyakan** — selalu `baru`, sama seperti pendaftar publik. Versi
  pertama menawarkan tiga pilihan dengan `konfirmasi` sebagai bawaan; itu keliru.
  "Proses" dan "konfirmasi" mewakili pekerjaan nyata (menghubungi, memasukkan ke grup,
  memverifikasi pembayaran), dan tab peserta sudah punya alur untuk memajukannya.
  Kotak pilihan di form cuma menawarkan jalan pintas melewati alur itu.

### Penanda kolom wajib, dan kenapa ia menunggu

`utils/wajib.ts` — satu `belumDiisi(nilai, aktif)` untuk seluruh dashboard, keluarannya
`string | undefined` supaya langsung masuk prop `error` milik `UFormField`. Dipakai
form event, member, jurnal, dan modal peserta.

Versi pertama menyalakannya sejak formulir dibuka. Diperbaiki: **baru menyala sesudah
tombol simpan ditekan.** Formulir kosong yang langsung merah di mana-mana berhenti
dibaca sebagai penanda, dan yang benar-benar terlewat nanti tenggelam di antaranya.

Dua konsekuensi yang harus diikuti, dan keduanya sempat menggigit:

- **Tombol simpan tidak boleh mati saat isian belum lengkap.** Kalau mati, tidak ada
  yang bisa ditekan untuk memunculkan penandanya. Ia tetap hidup; menekannya
  memindahkan halaman ke tab yang bermasalah dan menyalakan kolomnya.
- **Atribut `required` bawaan HTML harus dicabut dari `<UInput>`.** Ia membatalkan
  submit sebelum satu baris pun kode kita jalan, jadi penandanya tidak pernah sempat
  menyala — yang muncul cuma balon peramban yang bentuknya bukan bentuk aplikasi ini.
  `required` di `UFormField` tetap ada; itu yang menggambar bintangnya.

`GambarField` dapat dua prop terpisah: `wajib` (bintang, sejak awal) dan `tandaGalat`
(bingkai merah + "Belum diisi", sesudah ditekan). Gambar event kini **wajib saat
membuat** — tidak ditegakkan pada mode ubah, karena event lama tanpa gambar akan
membuat autosave menolak setiap perbaikan salah ketik yang tidak ada hubungannya.

### Teks kepotong diganti teks membungkus

`truncate` dicabut dari sepuluh tempat, diganti `break-words`. Nama panjang di
sidebar admin, judul sesi, judul materi, nama berkas, baris pemilih member, label di
`AdminAgregasi` — semuanya dulu berakhir dengan "…" yang menyembunyikan justru bagian
yang membedakan satu baris dari baris lain. Kotaknya tumbuh sedikit; yang dibaca orang
tidak lagi hilang.

`line-clamp` di `RefleksiGrid` **dibiarkan** — itu kutipan refleksi di kartu berukuran
tetap, bukan identitas yang harus terbaca utuh.

### Sisanya, yang kecil-kecil

- Kepala sesi jadi **satu baris**: lingkaran bernomor, judul, penanda simpan, sakelar
  Tampil, geser, hapus. Sebelumnya empat baris untuk tiga hal — kepalanya digambar
  induk, sakelarnya di tengah kotak isian, tombolnya di baris ketiga. Sekarang
  `SesiPengaturan` menggambarnya sendiri bila diberi prop `nomor`; tanpa `nomor`
  (penyuntingan di halaman event publik) bentuknya tidak berubah.
- **Animasi saat urutan berubah** — `TransitionGroup name="urut"` di daftar sesi,
  daftar item, dan pita galeri. `-leave-active { position: absolute }` wajib ada:
  tanpa itu baris yang dihapus tetap memakan tempatnya sampai animasinya habis, dan
  sisanya melompat dua kali.
- Deskripsi ID & EN jadi **satu baris** dengan `autoresize` (maks 6). Kotak setinggi
  tiga baris menjanjikan karangan panjang untuk kalimat pengantar kartu.
- Batas akhir pendaftaran: tanggal dan jam dipisah **"–"**. Dua kotak bersebelahan
  tanpa penghubung terbaca sebagai dua isian yang berdiri sendiri.
- "Kuota" → **"Kuota peserta"**. Kolom tabel peserta: "Member" → "Status member",
  "Pendaftaran" → "Status Pendaftaran", dan kolom tombol yang dulu tanpa judul kini
  "Aksi".
- Tombol "Tambah peserta" naik ke baris judul kartunya — di event baru maupun event
  tersimpan, supaya tombol yang sama tidak berpindah tempat hanya karena eventnya
  sudah punya baris di database. Judul modalnya diperbesar ke `font-serif text-2xl`;
  ukuran bawaan `UModal` setara teks biasa, sehingga satu-satunya yang membedakan
  judul dari kalimat di bawahnya cuma tebalnya.
- **Kotak berkas di form materi jadi tombol** selebar satu baris penuh. `<input
  type=file>` digambar peramban sendiri — "Choose File / No file chosen" dengan huruf,
  tinggi, dan sudut yang tidak mengikuti satu pun isian lain di formulir itu. Persoalan
  yang sama dengan `input type=date` yang dicabut di Sesi 12; jalan keluarnya juga
  sama: inputnya disembunyikan, tombol yang mengkliknya.
- **Tooltip `i` dicabut** dari kepala tab peserta, kepala "Sesi & materi", dan ketiga
  bagian (materi/galeri/referensi). `petunjuk` di `BAGIAN` ikut dibuang — keterangan
  yang tidak digambar di mana pun cuma menunggu dipakai lagi oleh yang mengira ia
  masih tampil.

### Video unggahan berhenti jadi warga kelas dua

Dua hal yang membuatnya berperilaku beda dari YouTube, padahal bagi pembacanya
keduanya sama-sama "rekaman sesi".

**Diputar di halaman, bukan dilempar ke tab baru.** `bukaMateri()` dulu hanya
menahan YouTube; video unggahan jatuh ke `window.open()`, dan di tab itu yang muncul
pemutar telanjang milik peramban di atas latar hitam — tanpa judul, tanpa jalan
kembali selain menutup tabnya. Sekarang satu modal untuk dua jenis: bingkai, judul,
dan lebarnya sama, yang berbeda cuma isinya (`<iframe>` atau `<video>`). Sumbernya
dilepas saat modal ditutup, kalau tidak `<video>` terus memutar di balik layar dan
suaranya tetap terdengar sesudah modalnya hilang.

**Server sekarang melayani `Range`.** Ini yang membuat videonya benar-benar bisa
dipakai: tanpa permintaan sebagian, menggeser ke menit ke-10 berarti mengunduh
sembilan menit pertama dulu, dan Safari menolak memutar sama sekali. Rekaman satu jam
praktis mati. `[...path].get.ts` kini menjawab 206 dengan `Content-Range`, mengumumkan
`Accept-Ranges: bytes` untuk semua berkas (peramban tidak bertanya dulu — ia mengirim
`Range` kalau tahu itu didukung), dan menjawab 416 beserta ukuran sebenarnya untuk
jangkauan di luar berkas. Dibuktikan di peramban: `bytes=1000-1999` → **206,
`bytes 1000-1999/34763941`**, dan menggeser video 74 detik ke detik ke-60 mendarat
tepat dengan `readyState` 4.

### Unggahan besar akhirnya punya angka

`utils/unggah.ts` — `unggahMedia(berkas, { onProgres })`, dipakai form materi.

**XMLHttpRequest, bukan `$fetch`**, dan itu bukan kemunduran: `fetch` tidak punya cara
melaporkan berapa banyak yang sudah terkirim (request body streaming ada di
spesifikasi tapi belum bisa diandalkan lintas peramban), sementara
`xhr.upload.onprogress` tidak punya pengganti yang setara. XHR di sini API bawaan
peramban — bukan dependensi baru, bukan dari Nuxt UI. Yang dibungkus cuma satu
permintaan; sisanya tetap `$fetch`.

Rekaman sesi bisa puluhan MB — beberapa menit pada koneksi rumahan. Sebelum ini
satu-satunya tandanya lingkaran berputar di tombol, bentuk yang sama persis dengan
menyimpan tautan YouTube yang selesai dalam sekejap.

Satu keputusan kecil yang menentukan: **`onprogress` tidak pernah dilaporkan sebagai
100.** Ia menghitung byte yang TERKIRIM, bukan yang sudah diterima dan disimpan;
antara byte terakhir berangkat dan balasan server tiba masih ada jeda yang pada
berkas besar terasa penuh beberapa detik. "100%" yang menetap di situ terbaca sebagai
macet. Angkanya ditahan di 99, dan 100 dipasang pemakainya sesudah promise selesai —
dengan label yang ikut berganti dari "Mengunggah" jadi "Menyimpan".

### Judul modal diatur sekali untuk semua

`app.config.ts` → `ui.modal.slots.title`. Serif, 16px, tanpa penebalan. Bawaan Nuxt UI
`font-semibold` tanpa serif, sehingga yang membedakan judul dari kalimat di bawahnya
cuma tebalnya.

Ditaruh di app config, bukan `:ui="{ title: … }"` di tiap UModal: modal tersebar di
sebelas berkas, dan menempelkan kelas yang sama di sebelas tempat berarti yang
berikutnya dibuat pasti terlewat — lalu ada satu modal berjudul lain sendiri di antara
sepuluh. Percobaan pertama memakai `text-2xl` dan serif tebal; itu terbaca sebagai
judul halaman, bukan judul kotak dialog.

### Satu baris CSS yang menahan seluruh kerangka admin

Judul kolom yang lebih panjang ("Status member", "Status Pendaftaran") membuat tabel
peserta melebihi lebar kartu — dan yang bergeser ternyata **bukan tabelnya melainkan
seluruh halaman**: judul, tab, dan sidebar ikut lari ke kiri, tombol "Tambah peserta"
hilang di luar layar.

Sebabnya bukan tabelnya. `.admin-shell` adalah grid `254px 1fr`, dan item grid punya
`min-width: auto` — kolom `1fr` menolak menyusut di bawah lebar min-content isinya.
`overflow-x-auto` pada tabelnya tidak menolong sama sekali selama kolom induknya
masih boleh melebar. Yang memperbaiki satu baris di `.admin-main`: **`min-width: 0`**.
Sesudah itu yang menggulir elemen yang memang punya overflow-nya sendiri.

Percobaan pertama saya justru merusak halamannya: `<div class="overflow-x-auto">`
disisipkan sebagai pembungkus UTable — padahal UTable di sana cabang `v-else` dari
rangka pemuatan di atasnya. "v-else/v-else-if has no adjacent v-if", dan halaman admin
mati sebelum tergambar. Pembungkus tidak boleh berdiri di antara dua cabang v-if.

### Angka level tidak lagi diperlihatkan

Sidebar dan halaman Petunjuk menampilkan "level 2" kepada admin dan editor. Bagi
mereka itu nomor tanpa rujukan: tidak ada layar lain yang menyebutkannya, dan yang
benar-benar menentukan apa yang bisa dikerjakan adalah nama rolenya — yang sudah
tertulis di sebelahnya. Sekarang hanya master yang melihat angkanya, badge "Level n",
dan kalimat yang menjelaskan perbandingan `level <= n`; sisanya membaca "Tiap role
mencakup wewenang role di bawahnya." Rekap role di `/admin` sudah master-only sejak
Sesi 11, jadi tidak perlu disentuh.

### Bukti dari database

| Uji | Hasil |
|---|---|
| `cck-SpGPsVgL` | peserta "User Percobaan" status `baru`, `user_id` tertaut, cover tersimpan |
| `cck-mGGrKAB4` | referensi "Template refleksi harian" masuk ke sesi 1, `urutan` 0 |

Keenam kegiatan uji (empat di antaranya duplikat hasil reload HMR) **sudah dihapus**
beserta sesi, item, dan pesertanya; lima kegiatan asli utuh. Salinan database sebelum
penghapusan ditaruh di scratchpad sesi ini, bukan di dalam repo.

### Simpan member berakhir di daftarnya

Add dan Edit Member kini sama-sama kembali ke `/admin/members` sesudah menyimpan.
Sebelumnya hanya Edit yang begitu; Add tinggal di formulir karena passwordnya harus
tetap terbaca, dan yang membuat tiga akun berturut-turut menekan "Kembali" sendiri
tiap kali.

Passwordnya tidak ikut hilang: ia dititipkan lewat `useState`, **bukan query di
alamat** — password tidak boleh mampir ke riwayat peramban atau apa pun yang menyalin
URL. Daftar member menampilkannya dalam pita yang menetap sampai ditutup (bukan toast
yang lewat tiga detik), berikut tombol WhatsApp berisi pesan yang sudah tersusun.
Dibaca sekali lalu dibuang, jadi menyegarkan halaman tidak memunculkannya lagi.

**Password tidak bisa dilihat ulang, dan itu bukan kekurangan yang bisa ditambal.**
Ditanyakan sesi ini: "bukain hash-nya lalu hash lagi, tidak bisa?" Tidak — scrypt
bukan enkripsi, tidak ada kunci untuk membukanya; yang tersimpan cuma 64 byte hasil
akhir, dan huruf aslinya tidak ada di dalamnya dalam bentuk apa pun. Login bekerja
dengan MENGHITUNG ULANG hash dari yang diketik lalu membandingkannya. Aplikasi lain
pun tidak menampilkan ulang — mereka menggantinya. Yang ditawarkan sebagai gantinya
(tombol "buat & kirim ulang password", digerbangi password admin) belum jadi
dikerjakan; alur reset lewat Edit Member yang sudah ada dianggap cukup.

### Deploy

Dikirim ke `compassionate-companion.com` (rsync `.output` + restart PM2), **tanpa**
`--migrasi` dan **tanpa** `--kirim-db`: ketiga migrasi (0006–0008) sudah ada di server,
sesi ini tidak mengubah skema, dan produksi memegang 4 kegiatan, 5 peserta, 6 akun
yang tidak boleh tertimpa.

Pemeriksaan origin bawaan deploy.sh menjawab `HTTP 000000` — **salah alarm**: ia
menembak satu detik sesudah PM2 restart, sebelum Nitro sempat mendengarkan. Dicek
ulang beberapa detik kemudian: `/` → 302, `/id` → 200.

Bukti build barunya yang jalan, bukan yang lama: permintaan `Range: bytes=0-99` ke
sebuah berkas di produksi dijawab **206 `bytes 0-77/78`** — handler yang ditulis hari
ini, sekaligus membuktikan pemotongan jangkauannya benar pada berkas yang lebih kecil
dari yang diminta.

### Yang tertinggal

- Kalau POST peserta gagal di tengah `buatEvent()` (email bentrok antar draf),
  eventnya sudah tersimpan lengkap dan halaman sudah pindah ke mode ubah — yang perlu
  diulang cuma baris peserta itu. Disengaja: peserta ditulis paling akhir justru
  supaya kegagalan di situ tidak menyeret apa pun.
- `EventRegisterPanel` (form pendaftaran publik) belum memakai `belumDiisi`. Ia
  formulir untuk pengunjung, bukan admin, dan penanda yang menyala di sana menuntut
  keputusan tersendiri.
- **Bar progres unggahan belum pernah terlihat bergerak.** Di localhost unggahan
  selesai terlalu cepat; yang terverifikasi jalur kodenya dan tampilannya, bukan
  angkanya berjalan. Butuh video puluhan MB dari koneksi sungguhan untuk memastikan.
- `[Icon] failed to load icon lucide:*` memenuhi log PM2 di server. Bukan hal baru dan
  tidak menjatuhkan apa pun — ikonnya tetap tergambar di klien — tapi log jadi sulit
  dibaca, dan sebabnya (koleksi ikon tidak ikut terbundel untuk sisi server) belum
  ditelusuri.
- `data/cc.db` lokal kini **73 MB**, 69 MB di antaranya blob video. Tidak
  memperlambat query mana pun, tapi memperlambat tiap penyalinan dan pencadangan —
  dan akan terus tumbuh tiap video diunggah. Produksi masih 16 MB.

### Kecelakaan yang perlu dicatat

`pages/admin/member/[id].vue` sempat **terhapus isinya**. Skrip Python yang dipakai
menyunting gagal sesudah `open(p, 'w')` mengosongkan berkasnya — 279 baris jadi nol.
Pemulihan lewat `git checkout HEAD` memperburuk: berkas itu punya perubahan yang belum
di-commit dari sesi sebelumnya, dan checkout ikut membuangnya.

Yang menyelamatkan: **source map di `node_modules/.cache/nuxt/`**. Vite menyimpan
sumber asli tiap modul di `sourcesContent`, jadi versi 311 baris bisa diambil utuh
dari sana. Pelajarannya dua, dan keduanya sudah berlaku sejak saat itu: sunting berkas
dengan alat sunting, bukan skrip yang membuka berkas dalam mode tulis; dan jangan
sekali-kali `git checkout HEAD --` pada berkas yang statusnya `M` tanpa tahu apa yang
sedang dibuang.

---

## 2026-08-13 — Sesi 12: Formulir berhenti minta ditekan

Menutup task yang disiapkan di awal sesi ini (revisi tinjauan 13 Agu). Dua puluh
tiga butir; semuanya dikerjakan. Yang menyatukan sebagian besarnya satu kalimat:
**isian di dashboard berhenti punya bentuknya sendiri-sendiri.**

### Kotak tanggal akhirnya sewarna dengan yang lain

`<input type="date">` dicabut dari empat tempat, digantikan **`TanggalPicker`** —
`UPopover` + `UCalendar`, pasangan `WaktuPicker` yang sudah ada sejak Sesi 9.
Tampilan `input type="date"` ditentukan browser, jadi ia berdiri sebagai satu-
satunya kotak berbeda wajah di tengah formulir yang seluruh isiannya sudah seragam.

Polanya pernah ada di project ini (filter tanggal halaman event, Sesi 4) lalu
hilang bersama filternya di Sesi 10. Kali ini ia komponen, bukan salinan di tiap
formulir. Dua jebakan lama yang sudah tercatat dan tetap berlaku: nilai kosong
harus `undefined` bukan `null` (Reka UI membaca `null` sebagai nilai), dan
`YYYY-MM-DD` disusun dari `year/month/day` langsung — tidak lewat `Date` maupun
`toISOString()`, jalur yang dulu memundurkan tanggal sehari.

`@internationalized/date` **dipromosikan jadi dependency eksplisit** di
`package.json`. Ia sudah dipakai sejak Sesi 4 sebagai paket transitif `@nuxt/ui`;
sekarang ada berkas yang mengimpornya langsung, jadi menggantungkannya pada pohon
dependensi orang lain tidak lagi pantas.

### Tombol simpan di form event dicabut, kecuali satu

Tab identitas event kini menyimpan sendiri 800 ms sesudah pengetikan berhenti —
pola yang sama dengan `SesiPengaturan` di tab sebelah. Yang berbeda cuma kabarnya:
di sana ada baris "menyimpan…/tersimpan" yang menetap, di sini **toast satu detik**.
Baris menetap masuk akal untuk satu baris pengaturan; di formulir sepanjang ini ia
jadi teks yang berkedip di sudut mata tiap satu huruf diketik.

**Tombol "Buat event" tetap ada pada event baru**, dan itu bukan kelalaian: event
baru belum punya baris di database, jadi autosave berarti POST pertama terjadi
tanpa ditekan siapa pun — pada formulir yang judulnya masih kosong dan pasti
ditolak server. Sesudah eventnya lahir, halaman berpindah ke `/admin/event/<id>`
dan autosave mengambil alih.

Dua hal yang menahan autosave dari menuliskan sampah:

- **`tersimpan`, sidik isian yang terakhir diketahui sudah tersimpan.** Tanpa itu
  `muat()` — yang mengganti seluruh `form` dengan isi dari server — terbaca oleh
  pengamat sebagai perubahan, lalu menuliskan balik persis apa yang barusan dibaca.
  Menambah satu sesi pun akan memicu PATCH kegiatan yang tidak diminta siapa pun.
- **`peringatan` menahan pengiriman.** Isian yang belum sah tidak dikirim; pesannya
  sudah tergambar di layar, dan mengirimnya cuma menukar pesan itu dengan galat
  server yang berbunyi sama.

Galat **tidak** lewat toast. Yang gagal harus tetap terbaca sesudah beberapa detik
berlalu, jadi ia mengendap di `UAlert` di kepala halaman.

### Dua gambar, dua bingkai, dua berkas

`coverMediaId` sudah hidup di form sejak lama tapi **tidak punya satu pun isian di
layar** — satu-satunya jalan memasangnya adalah lewat database. Sekarang ada dua:
**gambar utama** (16:9, sampul halaman detail) dan **thumbnail** (4:3, kartu daftar).

Kolom baru `thumbnail_media_id` di `cc_kegiatan` (migrasi `0006`), bukan satu
berkas untuk keduanya: bingkainya berbeda bentuk, dan memakai satu foto untuk
keduanya berarti salah satu selalu terpotong di tempat yang salah — biasanya tepat
pada wajah orang. Thumbnail kosong berarti kartunya jatuh kembali ke gambar utama,
jadi tidak ada event yang mendadak kehilangan sampul.

Alatnya tidak ditulis ulang: **`GambarField`** membungkus `GambarEditor` +
`potongGambar` yang sudah dipakai unggahan galeri massal. `GambarEditor` dapat dua
prop baru — `rasioTetap` (mengunci rasio; pada bingkai yang ukurannya sudah
ditentukan, "bebas" bukan kebebasan melainkan jebakan) dan `tanpaGanti`.

Yang diunggah **hasil potongannya**, bukan berkas aslinya. Menyimpan yang asli lalu
memotongnya dengan CSS berarti pengunjung mengunduh foto ponsel 4 MB untuk melihat
kartu selebar 320px.

### PDF & video yang tidak bisa dibuka — sebabnya satu baris di server

`sesi-payload.ts` mengirim `url: row.url`, dan **`row.url` selalu null untuk item
berjenis berkas**: `SesiItemModal` menyimpan `url: null` bila jenisnya memakai
unggahan. Alamat berkasnya ada, tapi ditaruh di `thumbnail`. Di klien
`bukaMateri()` berbunyi `if (item.url) window.open(...)` — jadi klik pada PDF dan
video **tidak melakukan apa pun, tanpa satu pun galat**.

Sekarang `row.url ?? media?.url`. Dibuktikan dengan satu baris media + item
sementara yang disisipkan langsung ke `data/cc.db`: endpoint publik menjawab
`url: /api/storage/uploads/…/ccm-UJICOBA.pdf`, dan alamat itu menjawab **200
`application/pdf`**. Kedua baris uji dihapus lagi sesudahnya.

Perlu diketahui: seluruh materi di database sekarang masih memakai URL contoh
(`https://example.org/modul.pdf`) dari seed. Itu **juga** tidak bisa dibuka, dan
sebabnya berbeda — alamatnya memang tidak ada. Yang diperbaiki sesi ini jalur
berkas yang sungguh-sungguh diunggah.

### Materi: tiga jenis, dan saringan yang benar-benar menyaring

Bagian materi kini menawarkan **PDF, video unggahan, YouTube** saja. Yang dibuang
(Word/Excel/PPT, gambar, tautan web) bukan jenis yang tidak bisa ditampung
melainkan jenis yang tidak bisa **dibuka** di halaman event: dokumen Office
terunduh alih-alih terbaca, gambar tunggal sebenarnya galeri, tautan web sebenarnya
referensi.

Item lama berjenis yang sudah tidak ditawarkan **tetap muncul di kotak pilihannya
sendiri** (`jenisTersedia`, berlabel "jenis lama"). Tanpa itu, membuka item lama
menghasilkan `USelect` kosong dan menyimpannya akan diam-diam mengganti jenisnya.

Dua hal yang dulu cuma disebutkan kini ditegakkan: **`accept`** mengikuti jenis
yang dipilih (memilih PDF berarti dialog berkasnya hanya menawarkan PDF), dan
**batas ukuran menolak berkasnya sebelum ia naik** — berkas dilepas dari input,
bukan sekadar ditandai, karena kalau tetap menempel tombol "Tambah" akan
mengirimnya juga. Menyebut batas tanpa menegakkannya berarti unggahan 300 MB
berjalan beberapa menit hanya untuk dijawab 413 di ujungnya.

**"Pilih dari pustaka" dicabut**, dan `PustakaMediaModal.vue` **dihapus** — bukan
ditinggal menggantung; ia tidak punya pemakai lain. Endpoint `/api/media` yang
melayaninya dibiarkan.

### Galeri: pensil yang akhirnya memotong

Tombol sunting & hapus pindah ke **pojok kanan atas fotonya** sebagai overlay.
Keduanya bekerja pada gambar itu sendiri; berbaris di bawah bersama tombol geser,
"hapus" duduk sejauh satu piksel dari "geser kanan". Yang tinggal di bawah cuma
urutan.

Pensilnya kini membuka **`GaleriCropModal`** — putar & potong foto yang sudah
terunggah — bukan form "pilih berkas pengganti" seperti sebelumnya. Itu menjawab
pertanyaan yang salah: yang biasanya ingin dilakukan orang pada foto yang sudah
masuk bukan menggantinya, melainkan meluruskan yang miring.

Hasilnya diunggah sebagai media **baru**, lalu `mediaId` item diarahkan ke sana.
Menimpa berkas lama akan mengubah foto yang mungkin dipakai di tempat lain — dan
alamat media di situs ini dicache `immutable`, sehingga berkas yang isinya berubah
di alamat yang sama tidak akan pernah tergambar ulang di browser yang sudah pernah
membukanya.

### Peserta: tabel, dan modal yang jadi daftar periksa

Kartu → **tabel enam kolom**: nama, email, WhatsApp, member, pendaftaran, aksi.
Kartu masuk akal ketika tiap baris dibaca sebagai satu orang; yang sebenarnya
dikerjakan di sini membandingkan kolom yang sama pada banyak orang — siapa yang
belum punya akun, siapa yang belum dikonfirmasi — dan itu hanya terbaca kalau
kolomnya sejajar.

**"Status member" sebelumnya salah.** `berakun` adalah `Boolean(userId)`, dan
`userId` hanya terisi bila orangnya mendaftar sambil sudah masuk. Peserta yang
dibuatkan akun oleh admin sesudah mendaftar tetap terbaca "belum punya akun"
selamanya — persis kebalikan dari apa yang baru saja dikerjakan admin. Sekarang
emailnya ikut dicocokkan ke `cc_user`.

Isi modal berubah dari "yakin?" jadi **daftar periksa**: yang dikonfirmasi bukan
perpindahan statusnya melainkan pekerjaan di luar layar yang seharusnya sudah
dikerjakan — menghubungi orangnya, memasukkannya ke grup WhatsApp, memastikan
pembayarannya. Karena isinya daftar periksa dan bukan peringatan bahaya, ia bisa
dimatikan lewat centang **"Jangan tampilkan pesan ini lagi"**.

Keputusan-keputusan kecil di sekitar centang itu:

- **`localStorage`, dua kunci terpisah.** Proses dan konfirmasi mengingatkan
  pekerjaan yang berbeda; yang hafal langkah proses belum tentu hafal soal
  pembayaran. Disimpan di peramban karena ini kebiasaan orang di depan layar,
  bukan sifat akunnya — dan project ini belum punya satu pun kolom preferensi.
- **`batal` dan `pulihkan` tidak pernah bisa dimatikan.** Keduanya mengubah
  keikutsertaan orang, bukan menandai pekerjaan yang sudah selesai.
- **Pendaftar non-member tidak ditawari centang.** Di sana ada langkah ketiga yang
  berupa tautan ke form Add Member; mematikan pesannya berarti mematikan
  satu-satunya jalan ke form itu.
- Centang baru ditulis saat aksinya dijalankan. Membatalkan modal berarti tidak
  ada yang berubah, termasuk centangnya.

Tautan "buatkan akun untuk peserta" membawa **nama, email, dan WhatsApp** pendaftar
sebagai query, jadi tidak perlu diketik ulang dari layar sebelah. Passwordnya
sendiri **tidak** lewat alamat halaman — yang lewat cuma penanda `asal=peserta`,
dan form mengisinya dari tetapan `PASSWORD_PESERTA` di `utils/akun.ts`. Angka yang
tertulis di modal dan angka yang benar-benar terpasang datang dari satu tempat.

### Daftar event: lima kolom jadi empat, dan urutan yang akhirnya jalan

**Urutannya memang belum pernah jalan.** `urutan` dideklarasikan dan kotaknya
tergambar, tapi nilainya tidak pernah dibaca siapa pun — tiap pilihan mengubah
tulisan di kotaknya sendiri dan tidak lebih. Sekarang diurutkan di klien: daftar
ini tidak berpaginasi, seluruh barisnya memang sudah di tangan. A–Z lewat
`localeCompare('id')`, bukan `<` — yang terakhir mengurutkan menurut kode karakter,
sehingga "wawancara" mendarat sebelum "Zoom" tapi sesudah "Bengkel".

Penyusutan Sesi 10 menggabungkan kolom tanpa membuang isinya: lima kolom itu masih
memuat tujuh angka per baris dan barisnya tiga tingkat tinggi. Yang benar-benar
ditanyakan orang pada daftar ini cuma dua — event yang mana, dan mana yang menuntut
dikerjakan sekarang. Sisanya satu klik dari sini, dalam bentuk yang bisa langsung
disunting.

Penanda pendaftar belum terkonfirmasi membawa **angkanya sendiri**; ikon telanjang
cuma menyuruh membuka eventnya untuk tahu seberapa mendesak. Dihitung di SQL yang
sama dengan jumlah peserta (`status in ('baru','proses')`).

### Waktu event yang tidak pernah diisi siapa pun

Yang tampil di halaman publik datang dari kolom lama `waktu` — teks bebas seperti
`"16.00 WIB (hari 1) – 12.00 WIB (hari 3)"` — yang dipakai `rentangJam()` sebagai
cadangan saat kedua kolom jam kosong. Kelima baris di `data/cc.db` memang begitu:
`waktu` terisi dari seed, `jam_mulai`/`jam_selesai` null. Tidak ada satu pun form
yang bisa menyunting `waktu`, jadi yang tampil tidak bisa dibetulkan dari layar
mana pun.

Cadangannya dicabut, kolomnya dikosongkan di database, dan `waktu` berhenti dikirim
kedua endpoint publik. Halaman detail sekarang menggambar **—**. Kolomnya sendiri
dibiarkan ada; menghapusnya menuntut migrasi yang tidak sebanding.

### Sisanya

- **"Area admin" → "Dashboard"** di menu profil, satu kata untuk kedua bahasa.
- **Tanggal sesi dicabut.** Sesi adalah partisi sebuah event dan tanggalnya sudah
  ditentukan tanggal eventnya; kolomnya menuntut diisi tanpa menentukan apa pun,
  dan yang diisi asal justru bisa berselisih dengan jadwal di sebelahnya. Kolom
  `tanggal` di `cc_sesi` dibiarkan — tidak ada halaman yang menggambarnya.
- **Tanggal selesai mengikuti tanggal mulai, sekali.** Kalau ia terus mengikuti,
  event tiga hari akan disingkat jadi sehari tiap kali tanggal mulainya
  dibetulkan — dan itu baru terlihat setelah kartunya terbit.
- **Batas pendaftaran tidak boleh melewati tanggal mulai**, ditegakkan di kalender
  (`maksimal`), di `peringatan`, dan di `validasi-event.ts`. Dibandingkan sebagai
  hari, bukan sebagai saat: batas "23.55 di hari acara" itu sah dan lazim.
- **Empat tooltip `i` dicabut** dari form event (tautan daring, jam mulai, batas
  akhir, kuota). Yang di kepala tab peserta & sesi tinggal — keduanya menjelaskan
  alur kerja, bukan satu kolom isian.
- **Member, mode ubah: simpan lalu kembali ke daftar.** Mode buat tetap tinggal —
  pesan suksesnya memuat peringatan bahwa passwordnya tidak bisa dibaca lagi, dan
  pergi ke daftar akan membawa peringatan itu pergi bersama halamannya. Kabar
  "tersimpan" pindah ke toast, yang ikut berpindah bersama halaman.
- **Sakelar akun aktif pindah ke paling bawah**, sesudah password, berbunyi "Akun
  non aktif akan kehilangan akses untuk login." Menonaktifkan akun bukan bagian
  dari mengisi datanya melainkan keputusan tersendiri.
- **Keterangan di bawah judul field dibuang** di form member (Email, Role,
  isActive, Password mode ubah).

### Lingkaran hijau untuk tiap penyimpanan

Diminta menyusul: tiap penyimpanan harus terlihat sedang berjalan. Tombol yang
punya `:loading` sudah membawa lingkarannya sendiri; yang tidak punya tombol —
autosave, dan tindakan yang menyimpan seketika — sebelumnya cuma menghasilkan
kabar sesudah semuanya selesai.

**`IndikatorSimpan`** menyatukan bentuknya: cincin berputar yang digambar sendiri
(`border-2 border-current border-t-transparent`, bukan ikon — cincin yang satu
sisinya transparan terbaca "sedang berjalan" tanpa perlu menebak arah putarannya)
dalam **hijau situs**, `cc-green-800`. Hanya 'gagal' yang keluar dari hijau: ia
menuntut dibaca, bukan diikuti. Ia menggantikan penanda teks di `SesiPengaturan`,
sehingga "sedang menyimpan" tidak lagi punya dua wajah dalam satu halaman.

Pada form event ia berdiri **di tempat tombol simpan dulu berada** — mata yang
mencari "sudah tersimpan belum" mendarat di tempat yang sama seperti sebelumnya.
`menunggu` menyala sejak ketikan berhenti, bukan sejak permintaannya berangkat:
jeda 800 ms itu bagian dari penyimpanan bagi yang menatap layar.

Tindakan sesi & item (tambah, geser, hapus) dulu **tidak punya umpan balik sama
sekali**, padahal masing-masing memuat ulang seluruh halaman event sesudahnya.
Sekarang lewat `jalankanAksi(kunci, kerja, pesanGagal)` dengan satu `aksiSibuk`
berisi **kunci** tindakan yang sedang jalan — bukan satu boolean. Dengan boolean,
menggeser satu foto akan membuat seluruh tombol di panel berputar sekaligus, dan
yang mana yang sedang dikerjakan justru jadi tidak terbaca. `SesiPengaturan` dapat
prop `aksiSibuk` untuk alasan yang sama.

### "426 Upgrade Required" akhirnya punya sebab

Tiga sesi menutup catatannya dengan keluhan yang sama: `localhost:3009` menjawab
**426 Upgrade Required** sementara `127.0.0.1:3009` menjawab 200, dan itu dikira
kendala pratinjau.

Sebabnya bukan pratinjau. Dev stack Nuxt membuka **dua pendengar** pada port yang
sama: aplikasinya di alamat yang disebut `devServer.host`, dan sebuah server
**WebSocket** yang mengikat `::` — wildcard IPv6, yang di Windows ikut menerima
IPv4. Permintaan HTTP biasa ke server WebSocket dijawab 426; itu bunyi protokolnya,
bukan galat. Pendengar beralamat spesifik menang atas wildcard, jadi **hanya satu
keluarga alamat yang benar-benar sampai ke aplikasi** — yang lain mendarat di
WebSocket.

`devServer.host` diubah `127.0.0.1` → **`localhost`**, karena itu yang diketik
orang. Konsekuensinya terbalik dari sebelumnya dan perlu diingat: sekarang
**`http://localhost:3009` yang benar, `http://127.0.0.1:3009` yang menjawab 426.**
Keduanya tetap loopback, jadi niat semula (tidak mendengarkan di 0.0.0.0, tidak
memicu izin firewall) tidak berubah.

Dua hal sudah dicoba dan tidak berpengaruh, jadi tidak perlu diulang: memindahkan
WebSocket itu lewat `vite.server.hmr.port` (ia bukan HMR Vite) dan mematikan
`devtools` (bukan itu pemiliknya). Siapa pemilik pendengar `::` itu belum
ditelusuri sampai tuntas.

### Dashboard: sembilan angka, dan satu yang harus dibuat dulu

Bagian agregasi diganti isinya mengikuti daftar peninjau. Judul "Agregasi" dan
kalimat pengantarnya dicabut: keduanya menamai bentuk datanya, bukan menjawab apa
pun yang dibawa orang ke halaman ini.

Delapan dari sembilan angka sudah ada sumbernya. Satu tidak: **jumlah pengunjung
web** — tidak ada satu pun penghitung kunjungan di project ini. Jadi dibuat.

**Penghitung kunjungan, tanpa data pribadi.** Dua tabel: `cc_kunjungan` (satu
angka per hari, berapa kali halaman dibuka) dan `cc_pengunjung` (satu baris per
orang per hari). Orang dibedakan lewat hash dari IP + user-agent + **tanggal** +
rahasia server. Tanggal ikut masuk ke dalam hash-nya dengan sengaja: itu membuat
sidik orang yang sama berbeda tiap hari, sehingga tidak ada yang bisa dilacak dari
satu hari ke hari berikutnya — bahkan oleh pemilik databasenya. Rahasianya
mencegah hash dicocokkan balik ke IP yang ditebak satu per satu.

Konsekuensinya jujur dan tertulis di layar: **satu orang yang datang tiga hari
terhitung tiga.** Yang dijawab "berapa orang datang hari itu", bukan "berapa orang
yang pernah datang".

Middleware-nya menyaring keras — bukan `/api`, bukan `/_nuxt`, bukan `/admin`,
bukan apa pun yang punya ekstensi berkas. Tanpa itu satu kali buka halaman
terhitung puluhan kali. Kegagalan menulis ditelan diam-diam: penghitung statistik
tidak boleh menjatuhkan halaman.

**Jurnal pindah ke `shared/jurnal.ts`.** Daftarnya masih data tetap (jurnal belum
punya CRUD), tapi sekarang punya dua pembaca — layar `/admin/jurnal` dan agregasi.
Dua salinan akan menyimpang begitu salah satunya disunting, tanpa galat apa pun.

Yang tergambar sekarang: enam kartu angka (kunjungan website, orang mengikuti
event, member, jurnal dibuat, video, dokumen) dan empat grafik (kunjungan per
bulan, pendaftar per bulan, jumlah event dengan sakelar bulan/minggu/tahun, event
dan pesertanya). Kartu video, dokumen, jurnal, dan "orang mengikuti event" membuka
daftar pembentuknya; kartu member menuju halamannya.

Beberapa keputusan kecil yang menempel di angkanya:

- **"Orang mengikuti event" dihitung per ORANG**, dibedakan lewat email — satu
  orang yang ikut tiga event tetap satu. Yang `batal` tidak dihitung.
- **Event dikelompokkan menurut tanggal mulai acaranya**, bukan tanggal barisnya
  dibuat. Periode tanpa event tidak digambar: minggu-minggu kosong sepanjang
  setahun membuat tiap batang setipis garis.
- **Member menyaring master**, mengikuti aturan `/admin/members` — kalau tidak,
  angka dashboard tidak akan pernah cocok dengan jumlah baris yang bisa dilihat.

### Penanda simpan: yang berlangsung saja

Putaran kedua atas permintaan peninjau. `IndikatorSimpan` sekarang **hanya
menggambar keadaan yang sedang berlangsung** — lingkaran berputar hijau. Keadaan
"tersimpan" dan "gagal" dicabut dari halaman.

Alasannya bukan sekadar selera: penanda hasil yang menetap di tengah formulir
menumpuk jadi kabar lama yang tidak pernah dibaca lagi. Begitu satu isian
disunting, "Tersimpan" di sebelahnya sudah bohong. Hasil disampaikan **toast**
(untuk yang berhasil) dan `UAlert` di kepala halaman (untuk yang gagal). Toast
lewat, alert menetap — dan itu memang beda bobotnya.

Toast dipindahkan ke **kanan atas** (`<UApp :toaster="{ position: 'top-right' }">`).
Di dashboard, kabar "tersimpan" datang dari isian yang sedang dipandang di bagian
atas layar; di sudut bawah ia lewat di luar arah pandang. `SesiPengaturan` ikut
memakai toast, karena penanda teksnya baru saja dicabut.

### Yang dikerjakan sesi ini

- [x] Agregasi dashboard: judul & pengantar dicabut, isinya jadi enam kartu +
      empat grafik mengikuti sembilan poin tinjauan
- [x] `cc_kunjungan` + `cc_pengunjung` + middleware penghitung (migrasi 0007, 0008)
- [x] `shared/jurnal.ts` — satu sumber untuk layar jurnal & agregasi
- [x] `IndikatorSimpan` hanya menggambar "sedang menyimpan"; toast pindah ke
      kanan atas; `SesiPengaturan` ikut memakai toast
- [x] `components/IndikatorSimpan.vue` baru (cincin hijau); dipakai autosave form
      event & `SesiPengaturan`
- [x] `jalankanAksi` + `aksiSibuk` — tambah/geser/hapus sesi & item akhirnya punya
      penanda per tombol
- [x] `devServer.host` → `localhost`; sebab 426 dicatat
- [x] `components/TanggalPicker.vue` baru; `<input type="date">` dicabut dari form
      event, `SesiPengaturan`, dan `EventJadwal`
- [x] `@internationalized/date` jadi dependency eksplisit
- [x] Autosave + toast 1 detik di tab identitas event; tombol simpan tinggal di
      mode buat; `tersimpan` menahan tulis-balik sesudah `muat()`
- [x] Kolom `thumbnail_media_id` + migrasi `0006`; dibaca/ditulis GET, PATCH,
      `validasi-event`, dan endpoint events publik (kartu memakai thumbnail dulu)
- [x] `components/GambarField.vue` baru; `GambarEditor` dapat `rasioTetap` &
      `tanpaGanti`
- [x] `sesi-payload`: `row.url ?? media?.url` — PDF & video unggahan bisa dibuka
- [x] Jenis materi jadi pdf/video/youtube; `jenisTersedia` menampung jenis lama
- [x] `accept` per jenis + penolakan ukuran sebelum unggah di `SesiItemModal`
- [x] "Pilih dari pustaka" dicabut; `PustakaMediaModal.vue` dihapus
- [x] Tombol galeri pindah ke pojok foto; `components/GaleriCropModal.vue` baru
- [x] `AdminPesertaTab` jadi tabel enam kolom; modal jadi daftar periksa dengan
      centang senyap (localStorage, dua kunci) dan tautan buat-akun terisi
- [x] `berakun` dicocokkan ke `cc_user` lewat email
- [x] `utils/akun.ts` (`PASSWORD_PESERTA`) + prefill form Add Member dari query
- [x] Urutan `/admin/events` tersambung (4 pilihan, `localeCompare('id')`); tabel
      jadi 4 kolom; penanda `belumKonfirmasi` berangka
- [x] `rentangJam` berhenti memakai `waktu`; kolomnya dikosongkan di `data/cc.db`;
      `waktu` berhenti dikirim endpoint publik
- [x] Batas pendaftaran ≤ tanggal mulai (kalender, peringatan, server)
- [x] Tanggal sesi dicabut; tanggal selesai ikut tanggal mulai sekali
- [x] Menu profil: "Dashboard"; form member: kembali ke daftar, sakelar pindah,
      keterangan field dibuang
- [x] Diuji: `nuxt build` sukses (48,1 MB); typecheck 29 galat — 27 baseline
      Sesi 11 + 2 dari pekerjaan Highcharts yang belum di-commit, nol tambahan;
      halaman event publik menggambar "—"; berkas unggahan dibuktikan terbuka
      (200 `application/pdf`) lewat baris uji yang lalu dihapus

### Deploy ke produksi

`bash deploy/deploy.sh --migrasi`, didahului snapshot database produksi
(`backup/backup-pra-sesi12-2026-08-13-2245.db`, 18,6 MB) — dokumen deploy
menegaskan itu sebelum tiap migrasi, dan migrasi SQLite tidak punya rollback.

**Build gagal pada percobaan pertama**, dan sebabnya layak diingat:
`import { JURNAL } from '../../../shared/jurnal'` bekerja di dev tapi runtuh di
`nuxt build` — `Could not resolve "../shared/jurnal.ts"`. Rollup me-resolve dari
berkas hasil bundel, yang letaknya bukan lagi di `pages/`. Jalurnya diganti alias
**`#shared/jurnal`** di kedua pemakainya. Dev server tidak akan pernah
memperlihatkan kesalahan ini.

Tiga migrasi jalan bersih di server (0006, 0007, 0008 → 14 tabel). Smoke test
lolos: PM2 online, origin `127.0.0.1:3010` menjawab 302 ke `/id`, domain
menjawab HTTP/2 200, `cloudflared` active, media BLOB terlayani
(`200 image/png` — bukti tambalan sharp linux masih utuh), dan log aplikasi
bersih.

Yang dibuktikan di produksi, bukan cuma di lokal:

| Yang diperiksa | Hasil |
|---|---|
| Kolom `thumbnail_media_id` | ada di `cc_kegiatan` |
| `cc_kunjungan` & `cc_pengunjung` | tercipta, dan langsung terisi (7 kunjungan, 1 orang) |
| Baris "Waktu" halaman event | `—`, walau kolom `waktu` di 3 baris produksi masih terisi |

Kolom `waktu` di produksi **tidak dikosongkan** — di lokal ia dikosongkan, di
produksi tidak perlu: cadangannya sudah dicabut dari `rentangJam()`, jadi isinya
tidak lagi sampai ke layar mana pun. Membersihkannya bisa menunggu.

`NUXT_KUNJUNGAN_SECRET` diisi di `deploy/.env` (tidak ikut git) dan diteruskan
lewat `ecosystem.config.cjs`. Tanpa itu hitungan orang terpecah tiap PM2 restart.

### Catatan / risiko

**Belum ada satu pun commit.** Seluruh sesi ini masih berupa perubahan di pohon
kerja, sementara produksi sudah menjalankannya — deploy mengirim `.output`, bukan
git. Selama itu belum di-commit, tidak ada satu pun titik yang bisa dijadikan
acuan kalau harus mundur.

**Layar admin belum disaksikan sesi ini.** Rute admin 302 tanpa sesi, dan
memasukkan password bukan sesuatu yang boleh saya lakukan. Yang belum pernah
tergambar di layar: tabel peserta enam kolom, modal daftar periksa, dua kotak
gambar dan pemotongnya, toast autosave, `TanggalPicker`, tabel event empat kolom,
dan tombol galeri di pojok foto. Semuanya lolos build & typecheck, tapi itu bukan
hal yang sama.

**`nuxt build` menimpa `.nuxt` milik server dev yang sedang jalan.** Terjadi sesi
ini: bundel klien server di port 3009 jadi basi (`entry.js` 404) sementara SSR
tetap benar. Jangan menjalankan `build`/`prepare` selagi `dev` hidup — atau
jalankan ulang `dev` sesudahnya.

**"Kadang tidak bisa disimpan, sepertinya corrupt" belum ketemu.** Tidak
direproduksi, jadi tidak ditebak-tebak perbaikannya. Yang dicurigai tetap sama:
seluruh berkas dibaca ke memori sebagai satu Buffer (`readMultipartFormData`) lalu
disimpan sebagai blob SQLite, dan tidak ada batas ukuran badan permintaan yang
disetel di mana pun. Penolakan ukuran di sisi klien yang ditambahkan sesi ini
menutup pemicu yang paling mungkin — unggahan melebihi batas yang dulu tetap
berangkat — tapi itu bukan bukti bahwa sebabnya memang itu.

**Angka kunjungan mulai dari nol hari ini.** Penghitungnya baru ada sejak sesi
ini (13 Agu 2026), jadi grafik dua belas bulan hanya berisi satu titik yang tidak
nol. Tidak ada cara mengisi mundur — data itu memang belum pernah dikumpulkan.

**Rahasia sidik pengunjung belum dipasang di `.env`.** Tanpa
`NUXT_KUNJUNGAN_SECRET`, middleware memakai nilai acak yang lahir bersama proses
— artinya hitungan orang bisa terpecah setelah server dijalankan ulang di tengah
hari (satu orang terhitung dua). Layak diisi sebelum dipakai sungguhan.

**Seed masih menulis `waktu`.** `server/db/seed.ts` tetap memasang teks jam bebas.
Kolomnya sudah tidak dibaca siapa pun, jadi tidak berbahaya — tapi `db:seed` pada
database kosong akan mengisinya lagi.

**Item materi berjenis lama masih ada di database.** Yang berjenis `dokumen`,
`gambar`, atau `tautan` di bagian materi tetap tergambar dan bisa dihapus, tapi
tidak bisa dibuat lagi. Tidak ada migrasi yang memindahkannya ke bagian yang benar.

---

## 2026-08-12 — Sesi 11: Halaman member berhenti jadi tempat membaca

Menutup task yang disiapkan di akhir Sesi 10 (tinjauan pukul 13.22 & 13.26).
Semua yang diminta dikerjakan; yang menuntut keputusan ditanyakan lebih dulu dan
jawabannya dicatat di bawah masing-masing.

### Eyebrow dicabut dari dashboard

Delapan halaman kehilangan baris kecil huruf besar di atas judulnya —
"Administrasi", "Program", "Konten", "Admin area", "Referensi", "Jurnal". Di situs
publik penanda itu menempatkan halaman dalam rangkaiannya; di dashboard sidebar
sudah melakukannya, dan yang tersisa cuma baris yang dibaca tanpa menjawab apa pun.

Kelas yang sama (`text-xs font-bold uppercase tracking-[.16em]`) **tetap dipakai**
sebagai label bagian di dalam kartu — "Password baru" di form member, dan blok
contoh di `/admin/[section]`. Yang dicabut hanya yang berdiri tepat di atas `<h1>`
halaman. Pada `jurnal/[id].vue` `mt-1` di judulnya ikut dibuang bersama eyebrow-nya,
kalau tidak judulnya menggantung setengah baris dari tombol kembali.

### Daftar member: memilih berarti pergi, bukan membentang

Judul jadi **Member**, tombolnya **Add Member**, dan form di baliknya **Add Member
/ Edit Member**. Aturannya disebut peninjau sendiri: judul halaman mengikuti nama
tombol yang membawanya ke sana.

Yang lebih dari penggantian kata: **panel detail di samping tabel dicabut
seluruhnya.** Tombol "Detail" diganti dua ikon — mata membuka `/profil?id=<id>`,
pensil membuka `/admin/member/<id>`. Alasan panel itu ada (Sesi sebelumnya:
"pekerjaan di halaman ini adalah membanding-bandingkan akun") ternyata tidak
terbukti: yang dilakukan orang di sini melihat satu akun lalu mengubahnya, dan
panel sempit itu memuat versi setengah dari halaman profil yang sudah ada.

Ikutannya: `components/AdminDetailUser.vue` **dihapus**, bukan ditinggal
menggantung. Di dalamnya ada jalur reset password — diperiksa dulu, dan jalur yang
sama sudah ada di form member, jadi tidak ada kemampuan yang hilang.

Kolom **"Terakhir masuk" dibuang**. Satu tanggal di dalam daftar tidak bisa
ditindaklanjuti dari sana; kalau riwayat masuk dibutuhkan, tempatnya menu log
tersendiri. `lastLogin` masih dikirim `GET /api/users` — yang hilang pemakainya.

Dua tombol ikon berarti dua tombol tanpa teks, jadi keduanya diberi `aria-label`
yang menyebut **nama orangnya** ("Ubah akun Maria Santoso"), bukan sekadar "Ubah".
Baris `@username` di bawah nama ikut dilepas: sejak username jadi email, ia hanya
mengulang kolom Email di sebelahnya.

### Form member: add dan edit jadi satu bentuk

Satu berkas sudah menangani keduanya sejak Sesi 7, tapi bentuknya berbeda —
password di mode edit bersembunyi di balik tombol dan `UModal`. Sekarang kolomnya
ada di tempat yang sama pada kedua mode, dan **satu tombol simpan** mengurus
keduanya (dipilih peninjau ketika ditanya).

Pada mode edit itu berarti **dua permintaan**, karena password memang endpoint
tersendiri: `PATCH /api/admin/users/[id]` dulu, `POST …/password` sesudahnya dan
hanya bila kolomnya terisi. Urutannya menentukan bunyi galatnya — kalau yang kedua
gagal, perubahan nama/role sudah tersimpan, dan pesannya mengatakan justru itu.
Satu galat datar akan membuat orang menebak bagian mana yang tidak jadi.

Kolom password kosong berarti **"jangan diubah"**, bukan "kosongkan passwordnya".

### Username = email, dan itu menyentuh server

Kolom Username dicabut dari form. Yang dijawab peninjau saat ditanya: tidak ada
username di halaman member, masuknya pakai email saja.

`bacaUser()` sudah menyusun username sendiri saat body tidak menyebutnya, tapi dari
**bagian depan** email (`maria@…` → `maria`). Itu diubah jadi **alamat email utuh**:
satu-satunya identitas yang pernah diberitahukan ke pemilik akun adalah emailnya,
dan username turunan hanya akan jadi nama yang tidak dikenali siapa pun di layar
admin. `usernameUnik()` dapat parameter ketiga `apaAdanya` yang melewati `slugify` —
tanpa itu `@` dan titiknya justru dirapikan hilang.

Akun yang sudah ada **tidak ikut berubah**: `usernameSekarang` di jalur PATCH
mempertahankan username lama apa adanya, termasuk saat emailnya diperbaiki. Login
menerima keduanya, jadi tidak ada yang kehilangan cara masuknya di tengah jalan.

### Urutan event: nama baru yang membalik arahnya

`Terdekat dulu` / `Terjauh dulu` → **`Terbaru` / `Terlama`** (EN: `Newest` /
`Oldest`).

Ini bukan penggantian teks belaka. "Terdekat" adalah tanggal paling awal — yaitu
event **paling lama**. Kalau hanya labelnya yang ditukar, tiap pilihan akan
melakukan kebalikan dari namanya.

Bawaannya jadi **Terbaru** (tanggal terbaru di depan, atas permintaan), dan karena
itu `orderBy` di `GET /api/events` ikut dibalik jadi `desc(tanggalMulai)`. Kalau
tidak, susunan yang datang dari server berbeda dari pilihan yang tertulis di
tombolnya, dan daftarnya akan bergeser sendiri sesaat setelah kartu pertama
tergambar. Endpoint itu cuma punya satu pemakai (`pages/events/index.vue`), jadi
pembalikannya tidak menyentuh halaman lain.

### Tombol "Buat akun" yang masih bisa ditekan dua kali

Ketemu saat menguji di browser, dan sudah ada sejak sebelum sesi ini.

Sesudah akun dibuat, `simpan()` mengganti alamat halaman jadi
`/admin/member/<id>` — tapi yang tergambar **tetap form Add Member yang sama**.
Instance halamannya tidak berganti; itu memang harus begitu, karena password yang
baru dibuat hanya bisa dibaca selama tampilannya tidak dimuat ulang. Yang tidak
disadari sebelumnya: tombol "Buat akun" ikut tinggal di sana dan masih hidup.

Menekannya lagi dengan email yang sama cuma menghasilkan galat "Email itu sudah
dipakai akun lain". Yang berbahaya kalau emailnya diperbaiki dulu lalu ditekan:
lahir **akun kedua**, sementara alamat halaman menunjuk yang pertama.

Sekarang tombol simpan dan "Buatkan password acak" mati begitu satu akun lahir,
dan muncul tautan **"Lanjut ubah akun ini"** ke halaman ubahnya — dimuat dari awal
sebagai tautan biasa, supaya isiannya datang dari database dan bukan dari sisa
form yang sudah dipakai.

### Yang dikerjakan sesi ini

- [x] Eyebrow dicabut di `admin/index`, `[section]`, `events`, `members`,
      `member/[id]`, `petunjuk`, `contributors`, `jurnal/index`, `jurnal/[id]`
- [x] `/admin/members`: judul Member, tombol Add Member, kolom "Terakhir masuk"
      dihapus, panel detail + `terpilihId` dicabut, aksi jadi ikon mata & pensil
- [x] `components/AdminDetailUser.vue` dihapus
- [x] Form member: Add/Edit Member, tanpa username, password inline di kedua mode,
      satu tombol simpan (PATCH lalu POST password bila terisi)
- [x] `usernameUnik(..., apaAdanya)` + username bawaan = alamat email utuh
- [x] Urutan event Terbaru/Terlama beserta arah urutnya; `desc(tanggalMulai)` di
      `GET /api/events`
- [x] Tombol kembali di profil orang lain → "Kembali ke daftar member" /
      "Back to member list"
- [x] Tombol simpan mati sesudah akun dibuat + tautan "Lanjut ubah akun ini"
- [x] Diuji: urutan Terbaru & Terlama disaksikan di browser (5 kartu, dua arah),
      label EN "Newest", 6 rute (200/302 sesuai penjagaan), typecheck 27 galat —
      di bawah baseline 30, nol tambahan

### Halaman admin akhirnya dilihat langsung

Tiga sesi berturut-turut menutup catatannya dengan "halaman admin belum pernah
disaksikan". Sesi ini tidak.

Yang dibuktikan di browser dengan sesi admin sungguhan:

| Yang diuji | Hasil |
|---|---|
| `/admin/members` | judul Member, tombol Add Member, lima kolom, tanpa eyebrow |
| Kolom aksi | ikon mata & pensil, `aria-label` menyebut nama orangnya |
| Mata | `/id/profil?id=…` — mendarat di tab **Riwayat event**, baris kontak utuh |
| Pensil | `/admin/member/<id>` → **Edit Member**, isian terisi, password kosong |
| Add Member | tanpa kolom username, password wajib, "Buatkan password acak" jalan |
| Buat akun | `POST /api/admin/users` 200; `username` di database = **alamat email utuh** |
| Simpan pada mode ubah | `PATCH` lalu `POST …/password` — dua-duanya 200, satu tombol |
| Pesan sesudahnya | "Perubahan tersimpan. Password baru sudah dipasang …", kolom password dikosongkan |
| Sesudah akun dibuat | tombol simpan mati, tautan "Lanjut ubah akun ini" muncul |

Dua akun uji dibuat lewat form sungguhan lalu **barisnya dihapus langsung dari
`data/cc.db`** — tidak ada endpoint hapus user, jadi tidak ada jalan lain
membersihkannya. `cc_user` kembali 4 baris seperti semula.

Yang membuatnya bisa dilihat kali ini: pratinjau diarahkan ke **`127.0.0.1:3009`**,
bukan `localhost:3009`. Nama yang kedua itulah yang selama ini menjawab
**426 Upgrade Required** — dev server memang hanya mengikat loopback IPv4
(`devServer.host = '127.0.0.1'`, Sesi 7), sementara `localhost` di mesin ini
lebih dulu terselesaikan ke IPv6. Layak diingat sesi berikutnya.

### Catatan / risiko

**Peringatan router yang tidak berbahaya.** Log SSR memuat
`[VUE_ROUTER_R0004] No match found for location with path "/id/admin/members"` saat
halaman profil dirender. Itu i18n mencoba melokalkan tautan kembali ke daftar
member; `href` yang benar-benar tergambar tetap `/admin/members`, dan tombolnya
berfungsi. Sudah ada sebelum sesi ini.

**Username akun lama tidak diseragamkan.** Setelah sesi ini ada dua bentuk hidup
berdampingan: akun lama dengan username turunan (`maria.santoso`) dan akun baru
dengan alamat email utuh. Keduanya bisa dipakai masuk. Menyeragamkannya berarti
menulis ulang username akun yang mungkin masih dipakai orang untuk masuk — tidak
dikerjakan tanpa diminta.

**Bawaan `GET /api/events` berubah arah.** Kalau suatu saat ada pemakai kedua
endpoint itu, ia akan menerima urutan menurun — bukan menaik seperti dulu.

### Task berikutnya: revisi tinjauan 13 Agu — dashboard event, peserta, materi

Belum dikerjakan; ini catatan persiapannya. Empat kelompok, dan yang menyatukan
tiga di antaranya satu kalimat: **isian di dashboard harus berbentuk sama dengan
isian lain di situs ini.** Tanggal masih `<input type="date">` bawaan browser
sementara jam sudah punya `WaktuPicker`; form event masih punya tombol simpan
sementara sesi di sebelahnya sudah menyimpan sendiri; peserta masih kartu
sementara member sudah tabel.

#### Keadaan pohon kerja saat task ini ditulis

Ada perubahan **belum di-commit** yang menyentuh berkas yang sama dengan task ini:
`pages/admin/events.vue`, `pages/admin/index.vue`, `pages/events/index.vue`, plus
tiga berkas baru (`components/AdminAgregasi.vue`, `components/GrafikHighcharts.vue`,
`server/api/admin/agregasi.get.ts`) dan `highcharts` di `package.json`. Dari
situlah kotak urutan di `/admin/events` berasal. Periksa dulu sebelum menyunting —
jangan sampai pekerjaan yang belum tercatat itu tertimpa.

#### 1. `/admin/events` — urutan yang belum tersambung, tabel yang terlalu penuh

**Urutannya memang belum jalan.** `urutan` dideklarasikan di `events.vue:101` dan
kotaknya tergambar di `:353`, tapi nilainya tidak pernah dipakai: `events`
(`:40`) mengembalikan `data.value.data` apa adanya, dan `useFetch` (`:33`) tidak
mengirimkannya sebagai query. Server pun tidak menerimanya —
`server/api/admin/events/index.get.ts:32` mengunci `orderBy(desc(tanggalMulai))`.

Daftar ini **tidak berpaginasi** (seluruh baris dikirim sekaligus), jadi urutkan
di klien: satu `computed` di atas `events`, persis seperti `switch` di
`pages/events/index.vue:144–155` yang sudah bekerja untuk keempat pilihan yang
sama. A–Z lewat `localeCompare('id')`, bukan `<` — tanpa itu judul berawalan
huruf besar/kecil terurut menurut kode karakter.

**Tabelnya disederhanakan.** Lima kolom sekarang (`:143–149`) memuat tujuh angka:
judul + lokasi, tanggal mulai + selesai + jam + batas pendaftaran, sesi + materi +
terdaftar/kuota, fase, aksi. Yang perlu dijawab daftar ini cuma "event mana" dan
"mana yang menuntut dikerjakan" — sisanya ada di halaman eventnya.

**Penanda peserta belum terkonfirmasi.** `terdaftar` di endpoint (`:69`) menghitung
semua yang bukan `batal`, jadi belum bisa membedakan yang menunggu. Tambahkan satu
hitungan lagi di query peserta (`:33–38`) — `status in ('baru','proses')` — lalu
ikon orang merah muncul hanya bila angkanya > 0, dengan tooltip yang menyebut
angkanya. Ikon tanpa angka menyuruh orang membuka eventnya hanya untuk tahu
apakah perlu dibuka.

#### 2. Form event: bentuk isian, autosave, dan dua gambar

Add dan edit **sudah satu berkas** (`pages/admin/event/[id].vue`, `baru = id ===
'new'`). Yang membedakan cuma tab: pada event baru hanya "Informasi utama" yang
ada (`:232–238`), karena peserta & materi butuh `kegiatanId`. Peninjau menyebut
itu boleh tetap begitu — jadi yang dikerjakan bukan menyamakan tabnya, melainkan
menyamakan **isian di dalamnya** dengan sisa situs.

**Datepicker.** Ini menyentuh lebih dari satu berkas dan sebaiknya jadi satu
komponen `TanggalPicker`, sejajar `WaktuPicker`:

| Berkas | Baris | Kolom |
|---|---|---|
| `pages/admin/event/[id].vue` | 320, 326 | tanggal mulai, tanggal selesai |
| `pages/admin/event/[id].vue` | 359 | tanggal batas pendaftaran |
| `components/SesiPengaturan.vue` | 136 | tanggal sesi (lihat §4 — mungkin dicabut) |
| `components/EventJadwal.vue` | 191 | batas pendaftaran, mode sunting di halaman publik |

Polanya sudah pernah ada di project ini: `UPopover` + `UCalendar`, dipakai filter
tanggal halaman event sampai dicabut di Sesi 10 — catatannya di Sesi 4
("Datepicker: `<input type=date>` → `UCalendar`"). Dua jebakan yang sudah tercatat
di sana dan masih berlaku: `UCalendar` memakai `DateValue` dari
`@internationalized/date` (transitif dari `@nuxt/ui`, **belum** ada di
`package.json` — pantas dipromosikan sekalian), dan kosong harus `undefined`
bukan `null`, karena Reka UI membaca `null` sebagai nilai. `keYmd()` disusun dari
`d.year/month/day` langsung, jangan lewat `Date` — di situlah bug "tanggal mundur
sehari" dulu lahir.

**Tanggal selesai mengikuti tanggal mulai.** Isi otomatis saat tanggal mulai
diketik **pertama kali** dan kolom selesai masih kosong; sesudah itu tidak lagi —
`watch` yang menimpa terus akan membatalkan event tiga hari setiap tanggal
mulainya dibetulkan. Hint `"boleh sama dengan tanggal mulai"` (`:322`) dibuang.

**Batas pendaftaran tidak boleh mendahului tanggal mulai.** Sekarang tidak ada
yang mencegahnya, di klien maupun di server. Pasang `max` pada picker-nya,
tambahkan satu kalimat di `peringatan` (`:98–107`, tempat dua aturan sejenis sudah
tinggal), dan tegakkan ulang di `server/utils/validasi-event.ts` — atribut picker
tidak berlaku bagi permintaan yang datang bukan dari form ini.

**Autosave, tombol simpan dicabut.** Polanya sudah ada di `SesiPengaturan.vue`:
jeda 800 ms setelah pengetikan berhenti (`:102`), perbandingan draf lama vs baru
supaya tidak menyimpan yang tidak berubah (`:51`). Yang diminta berbeda di
tampilannya — **bukan** teks "menyimpan…/tersimpan" seperti di sana, melainkan
toast sekejap (±1 detik). Tiga hal yang menuntut keputusan sebelum ditulis:

- **Event baru belum punya baris di database.** Autosave berarti POST pertama
  terjadi tanpa ditekan siapa pun, dan judul kosong akan ditolak server. Usul:
  pada mode `baru` tombol "Buat event" **tetap ada**, dan autosave baru menyala
  setelah eventnya lahir. Itu juga yang membuat pindahnya ke `/admin/event/<id>`
  tetap punya pemicu yang jelas.
- **Galat autosave tidak boleh jadi toast yang lewat begitu saja.** Yang gagal
  harus tetap terbaca sesudah toast-nya hilang — `UAlert` di `:283` sudah ada,
  pakai itu untuk gagal, toast hanya untuk berhasil.
- `useToast()` dari Nuxt UI belum dipakai di mana pun dalam project ini; ini
  pemakaian pertamanya.

**Tooltip `i` dicabut** di empat kolom: tautan daring (`:310–315`), jam mulai
(`:336–341`), batas akhir pendaftaran (`:352–357`), kuota (`:364–369`). Bukan
tooltip: yang di kepala tab peserta (`:389`) dan sesi (`:405`) — keduanya
menjelaskan alur kerja, bukan satu kolom isian.

**Thumbnail & gambar utama.** `coverMediaId` sudah hidup di form (`:32`, `:76`)
tapi **tidak punya satu pun isian di layar** — jalan satu-satunya memasangnya
sekarang lewat database. Yang diminta dua gambar, dan database baru punya satu
kolom, jadi ini menyentuh skema: tambah `thumbnail_media_id` di `cc_kegiatan` +
migrasi `0006_*.sql` (`npm run db:generate`), lalu ikutkan di
`server/api/admin/events/[id].patch.ts:48` dan di kedua endpoint baca.

Alat potongnya sudah ada dan tidak perlu ditulis ulang: `GambarEditor.vue`
(putar/potong/zoom, rasio terkunci) + `utils/potongGambar.ts`, dipakai
`GaleriUnggahModal.vue`. Kunci rasionya per peran — sampul kartu event dirender
setinggi 176px dengan `background-image` (lihat Sesi 4), jadi rasio lebar untuk
gambar utama dan kotak untuk thumbnail; ukuran pastinya disepakati saat
dikerjakan.

#### 3. Tab peserta: tabel, dan modal yang menyebut pekerjaannya

**Kartu → tabel** (`components/AdminPesertaTab.vue:232–301`). Enam kolom: nama,
email, WA (`noHp`), status member, status pendaftaran, aksi. Chip filter di
`:176–198` tetap — ia menjawab pertanyaan lain.

**"Status member" belum benar-benar ada.** Yang dikirim server adalah `berakun`
(`peserta.get.ts:76`), dan itu `Boolean(userId)` — true hanya bila orangnya
mendaftar **sambil sudah masuk**. Peserta yang dibuatkan akun oleh admin sesudah
mendaftar akan tetap terbaca "non member", padahal akunnya ada — dan justru itu
yang menentukan modal mana yang muncul di §berikut. Yang benar: cocokkan
`ccPeserta.email` ke `cc_user` di endpoint yang sama, satu `leftJoin`.

**Modal per aksi.** Modalnya sudah ada (`:308–351`) dengan isi yang ditentukan
`dialog` (`:94–138`); yang berubah isinya, dan salah satunya bercabang menurut
status member:

- **Proses, non member** — daftar tiga langkah, dan baris ketiga ("buatkan akun
  untuk peserta, default pass: 123456") **bisa diklik** ke form add member. Perlu
  diputuskan: tautannya membawa nama/email/WA peserta lewat query supaya formnya
  sudah terisi (`/admin/member/new?nama=…&email=…`), atau polos. Yang pertama
  jauh lebih berguna dan `pages/admin/member/[id].vue` tinggal membaca
  `route.query` saat `baru`. Perlu diputuskan juga apakah membuka form itu
  meninggalkan halaman event — kalau ya, statusnya belum sempat dimajukan.
- **Proses, member** — dua langkah + checkbox "Jangan tampilkan pesan ini lagi".
- **Konfirmasi** — kalimat pembayaran & hak atas materi + checkbox yang sama.

Checkbox itu perlu tempat menyimpan. Usul: `localStorage`, dua kunci terpisah
(proses dan konfirmasi punya arti berbeda, mematikan yang satu tidak boleh ikut
mematikan yang lain). Kalau disimpan per akun di database, ia jadi kolom
preferensi pertama di project ini — layak ditanyakan lebih dulu. Yang penting:
saat pesannya dimatikan, aksi tetap harus punya cara dibatalkan — jangan sampai
satu klik langsung mengubah status tanpa jalan mundur (`pulihkan` sudah ada untuk
`batal`, tapi tidak ada yang memundurkan `proses` → `baru`).

Semua kalimat baru butuh versi EN — lihat syarat dwibahasa; `AdminPesertaTab`
sekarang **belum** punya `isEn` sama sekali, tidak seperti komponen event lain.

#### 4. Materi: jenis yang disempitkan, berkas yang tidak bisa dibuka

**Bug: berkas unggahan memang tidak bisa dibuka, dan sebabnya di server.**
`server/utils/sesi-payload.ts:102` mengirim `url: gembok ? null : row.url` — dan
`row.url` **selalu null untuk item berjenis berkas**, karena `SesiItemModal`
menyimpan `url: null` bila `pakaiBerkas` (`SesiItemModal.vue:164–165`). Alamat
berkasnya ada, tapi ditaruh di `thumbnail` (`sesi-payload.ts:104`,
`media?.url`). Di klien, `bukaMateri()` (`EventResources.vue:145`) berbunyi
`if (item.url) window.open(...)` — jadi klik pada PDF dan video **tidak melakukan
apa pun**, tanpa galat. Perbaikannya di server, satu baris: `row.url ?? media?.url`.
Endpoint `/api/storage/[...path]` sendiri sudah benar (PDF & video inline,
`Content-Disposition` di `:33–36`).

**"Kadang tidak bisa disimpan, sepertinya corrupt" — belum ketemu, ini yang
dicurigai.** Seluruh berkas dibaca ke memori sebagai satu Buffer
(`readMultipartFormData`, `upload.post.ts:20`) lalu disimpan sebagai blob SQLite;
video 100 MB melewati jalur itu utuh. Batas ukuran badan permintaan tidak disetel
di mana pun (`nuxt.config.ts` tidak punya blok `nitro`), jadi yang berlaku bawaan
Nitro — dan kegagalannya bisa muncul sebagai permintaan yang putus, bukan sebagai
galat yang terbaca. Reproduksi dulu dengan satu video besar sambil membaca log
dev sebelum menulis perbaikan apa pun; jangan menebak.

**Jenis materi jadi tiga**: `pdf`, `video (unggah)`, `youtube`
(`SesiItemModal.vue:82–89`). Yang dibuang: dokumen Word/Excel/PPT, gambar, tautan
web. Perhatikan — daftar itu **hanya untuk bagian "materi"**; `referensi`
(`:75–81`) tetap butuh tautan web dan `galeri` tetap gambar. Item lama berjenis
yang dihapus masih ada di database: pastikan yang sudah tersimpan tetap tergambar
dan bisa dihapus, jangan sampai `USelect` kosong menolak menyimpan barisnya.

**Saringan berkas mengikuti jenis.** `<UInput type="file">` di `:227–231` tidak
punya `accept` sama sekali, jadi dialog berkas menawarkan segalanya. Petakan
jenis → `accept` (`application/pdf`, `video/*`).

**Batas ukuran ditegakkan sebelum unggah.** `batasBerkas` (`:97–101`) hanya
*menyebutkan* batasnya; yang melebihi tetap terkirim lalu ditolak server 413
setelah seluruh berkasnya naik. Periksa `berkas.size` di `@change` dan tolak di
situ, dengan pesan yang menyebut ukuran berkasnya **dan** batasnya. Angkanya
harus tetap cermin `MEDIA_LIMITS` (`server/utils/media-services.ts:19–23`).

**"Pilih dari pustaka" dicabut** (`:232–240`). Ikut terbawa: `pustakaTerbuka`,
`namaDariPustaka`, `pilihDariPustaka`, `<PustakaMediaModal>` di `:293–298`, dan
`namaPilihan` (`:124–128`) yang tinggal punya dua cabang. `PustakaMediaModal.vue`
sendiri **jangan dihapus** sebelum dipastikan tidak ada pemakai lain.

**Tanggal sesi dicabut** — `SesiPengaturan.vue:136` beserta `tanggalYmd` di draf
(`:43`, `:51`, `:85`) dan pemetaan di `[id].vue:80`. Kolom `tanggal` di `cc_sesi`
dibiarkan; yang dicabut isiannya. Periksa dulu apakah halaman event publik
menggambar tanggal sesi di suatu tempat — kalau ya, ia akan jadi baris kosong.

**Galeri.** Tombol hapus dan ubah pindah ke **pojok kanan atas gambarnya** sebagai
overlay (`pages/admin/event/[id].vue:521–538`; sekarang keempat tombol berbaris di
bawah foto). Tombol geser kiri/kanan tetap di bawah — keduanya soal urutan, bukan
soal foto itu sendiri. Pensilnya harus membuka **editor potong**, bukan
`SesiItemModal` seperti sekarang (`bukaUbahItem`, `:198–204`): pakai `GambarEditor`
yang sama dengan `GaleriUnggahModal`, dan hasil potongannya diunggah sebagai media
baru lalu `mediaId` item ditunjuk ulang lewat PATCH.

#### 5. Yang berdiri sendiri

- **`layouts/default.vue:20`** — "Area admin" / "Admin area" jadi **"Dashboard"**
  di menu profil. Satu kata untuk kedua bahasa.
- **Waktu event yang tidak pernah diisi admin.** Yang tampil di halaman publik
  datang dari kolom lama `waktu` — teks bebas seperti
  `"16.00 WIB (hari 1) – 12.00 WIB (hari 3)"` — yang dipakai `rentangJam()`
  sebagai cadangan saat `jamMulai`/`jamSelesai` kosong
  (`utils/waktuEvent.ts:31`). Keempat baris di `data/cc.db` memang begitu:
  `waktu` terisi dari seed, `jam_mulai`/`jam_selesai` **null**. Tidak ada satu pun
  form yang bisa menyunting `waktu`, jadi yang tampil tidak bisa dibetulkan
  siapa pun dari layar mana pun. Buang cadangannya (baris itu jadi `return ''`),
  sehingga `EventJadwal.vue:46` menggambar `—`; kosongkan juga kolomnya di
  database supaya tidak ada yang menghidupkannya lagi tanpa sengaja. Kolomnya
  sendiri boleh tetap ada — menghapusnya menuntut migrasi yang tidak sebanding.
- **Member: simpan lalu kembali ke daftar.** `pages/admin/member/[id].vue:111–156`.
  **Ini bertabrakan dengan Sesi 11**: pada mode add, `sukses` menyuruh mengirim
  passwordnya lewat WhatsApp sekarang juga karena tidak bisa dibaca lagi, dan
  tautan "Lanjut ubah akun ini" (`:265–274`) sengaja ditaruh di situ. Pergi ke
  daftar berarti pesan itu hilang bersama halamannya. Usul: **mode edit** kembali
  ke daftar (tidak ada yang hilang di sana), **mode add** tetap tinggal — atau
  passwordnya ikut ditampilkan sekali lagi di daftar, yang jelas lebih buruk.
  Perlu diputuskan peninjau.
- **Sakelar akun aktif pindah ke paling bawah**, sesudah password
  (`:209–211` → sesudah `:248`), dengan bunyi **"Akun non aktif akan kehilangan
  akses untuk login."**
- **Keterangan di bawah field dibuang**: `description` di `:197` (Email), `:205`
  (Role), `:209` (isActive — diganti wording di atas), `:221` (Password mode
  edit). `hint` di `:219` bukan keterangan di bawah judul; ia menempel di kanan
  label dan boleh tinggal.

#### Yang perlu diperiksa setelah dikerjakan

- Autosave tidak boleh menyimpan pada saat form baru selesai dimuat — `muat()`
  mengganti seluruh `form`, dan `watch` yang polos akan membaca itu sebagai
  perubahan lalu menulis balik apa yang baru saja dibaca.
- Empat pilihan urutan di `/admin/events` disaksikan langsung, dua arah masing-
  masing — ini persis kesalahan Sesi 11 (label tertukar arah) pada halaman lain.
- PDF dan video yang diunggah benar-benar terbuka dari halaman event publik,
  sebagai peserta maupun sebagai pengelola.
- Peserta non-member vs member membuka modal yang berbeda, sesudah akunnya
  dibuatkan admin (itu kasus yang sekarang salah).
- Teks EN untuk setiap kalimat baru — modal peserta, toast, wording sakelar akun.
- Typecheck: baseline 27 galat lama (Sesi 11), nol tambahan.
- Pratinjau lewat **`127.0.0.1:3009`**, bukan `localhost:3009` (Sesi 11).

---

## 2026-08-12 — Sesi 10: Revisi tinjauan — yang dicabut lebih banyak dari yang ditambah

Dua belas revisi dari tinjauan setelah Sesi 9. Hampir semuanya membuang sesuatu,
dan itu polanya sendiri: yang ditinjau bukan fitur yang kurang melainkan penanda
yang menuntut dibaca tanpa menjawab apa pun.

### Penyaring tanggal & dua urutan dicabut

Kalender di halaman event hilang, begitu juga "Terbaru ditambahkan" dan "Batas
daftar terdekat". Ketiganya mengurutkan atau menyaring menurut hal yang **tidak
tertulis di kartu** — tanggal baris itu dibuat, dan tenggat yang hanya sebagian
event punya — sehingga hasilnya terbaca acak oleh yang memilihnya. Penanganan
`null` khusus untuk "batas terdekat" (Sesi 9) ikut terbuang bersamanya.

Parameter `dari` di `GET /api/events` **tidak dihapus**: server tetap menerimanya,
yang hilang hanya pemakainya di klien.

### Badge yang dibuang, dan satu yang berubah arti

Badge level (`Master · L1`, `· level 1`) dicabut dari tabel user, panel detail,
dan halaman profil. Angkanya cuma berarti bagi yang hafal tabel role — dan tabel
itu sendiri sudah master-only sejak Sesi 7.

Yang lebih dari sekadar tampilan: **badge status di riwayat event**. Membuangnya
membuat daftar itu tidak bisa lagi membedakan "ikut" dari "batal", jadi
pembuangannya menuntut penyaringan datanya. `riwayatKegiatan()` sekarang menolak
baris `batal` di SQL — riwayat menjawab "event apa yang pernah diikuti", dan yang
dibatalkan justru berarti tidak diikuti.

Efek yang perlu diketahui: `ringkas.total` di halaman profil ikut mengecil, karena
ia menghitung baris yang sama. Yang batal tetap utuh di tab "Daftar peserta" event
yang bersangkutan — di sanalah pembatalan diurus dan bisa dianulir.

### Master hilang dari daftar, bukan cuma dari labelnya

Akun master disaring **di SQL** (`server/api/users/index.get.ts`), bukan di klien.
Daftarnya berpaginasi: menyaring sesudah datanya sampai akan meninggalkan halaman
yang isinya berkurang tanpa sebab, sementara `meta.total` tetap menghitungnya.
Barisnya yang disembunyikan, bukan labelnya — dengan begitu pencarian nama pun
tidak bisa membuktikan akun itu ada.

Opsi role ikut kehilangan master di tiga tempat: filter daftar user, pilihan role
di form akun, dan tabel role di halaman Petunjuk. Di form akun ada jebakan kecil
yang ikut ditutup: daftar penuh dipakai selama `aktor` masih null, sehingga
"Master" sempat terlihat sekejap oleh admin biasa pada tiap muat halaman.

### Konfirmasi tiap tahap pendaftar

Empat tombol berdempetan di ujung baris yang bentuknya identik, pada daftar yang
bergeser sendiri tiap kali dimuat ulang — salah baris adalah kesalahan yang mudah
terjadi dan tidak punya jejak. Sekarang semuanya lewat modal, dan modalnya
menyebut **nama orangnya**: yang dikonfirmasi bukan "tindakan ini" melainkan
"tindakan ini pada orang ini".

Isi modalnya berbeda per tahap, karena tahapnya memang berbeda arti — "proses"
berarti sudah dihubungi, "konfirmasi" berarti resmi terdaftar. Modal **tidak
ditutup saat gagal**: galatnya muncul di dalamnya, jadi tombolnya bisa ditekan
lagi tanpa mencari ulang barisnya. Galat tingkat daftar disembunyikan selama modal
terbuka — di belakang lapisan gelap ia tidak akan terbaca.

### Sakelar "Tampil" kembali, dan warnanya dibalik

Sakelar yang dicabut dari tab Materi di Sesi 9 dikembalikan. Alasan pencabutannya
— "di dashboard orang menyiapkan isi, bukan mengatur apa yang terbit" — ternyata
memisahkan dua pekerjaan yang sebenarnya satu. Prop `tanpaTampil` dihapus
seluruhnya, bukan disetel false: tidak ada lagi yang memakainya.

Batas antar sesi juga tidak terasa. Sebabnya: seluruh isi berlatar krem di dalam
bingkai putih, sehingga yang terbaca satu kolom panjang berisi bagian yang seragam.
Sekarang dibalik — **kotak sesi krem, isi tiap bagian putih**. `SesiPengaturan`
ikut jadi putih, kalau tidak ia lebur ke latar sesinya.

### Sisanya

- Eyebrow "Testimoni peserta" → "Refleksi event" / "Event reflection".
- Urutan tab profil jadi **Pengaturan · Riwayat · Refleksi**. Tab Pengaturan tidak
  ada pada profil orang lain, jadi ditambahkan penggeseran ke "Riwayat" — tanpa itu
  membuka profil dari `/admin/members` mendarat pada tab yang tidak ada di bilahnya,
  dan formulir di baliknya milik akun yang sedang dibuka.
- Garis pemisah di panel detail user dibuang; tiga baris pendek tidak butuh
  pembagi, dan garisnya justru memotong panel sempit itu jadi potongan kecil.
- Halaman profil orang lain dapat baris kontak (email, WhatsApp, tanggal bergabung).
  Sebelumnya pengelola yang membukanya tidak melihat satu pun data itu — tab
  Pengaturan yang memuatnya hanya ada untuk pemiliknya sendiri.

### Putaran kedua: dua tombol bernama sama, dan delapan kolom yang tidak muat

**Daftar dengan akun butuh tiga klik dan dua tombol berbunyi sama.** Setelah
"Periksa akun" berhasil, panel beralih ke kartu "Anda masuk sebagai …" yang
tombolnya berbunyi *Daftar Sekarang* — dan modal di baliknya berbunyi persis sama.
Orang menekan yang pertama lalu mengira sudah terdaftar. Sekarang login langsung
membuka konfirmasinya; tombolnya berbunyi "Masuk & lanjut daftar", jadi apa yang
akan terjadi tertulis di tombolnya sendiri.

Kolomnya juga salah tipe: `type="email"` sementara endpoint login menerima username
juga. Username tanpa @ ditolak browser sebagai "alamat tidak sah" padahal isinya
benar. Labelnya kini "Email atau username", tipenya teks.

**Refleksi event hanya pada event yang sudah selesai.** Panel itu berisi apa yang
dikatakan orang sesudah mengikutinya; pada event mendatang ia menjanjikan sesuatu
yang belum ada, pada yang sedang berlangsung ia mendahului acaranya sendiri. Ikut
disembunyikan dari mode sunting — tidak ada yang bisa ditulis sebelum eventnya usai.

**Delapan kolom di `/admin/events` jadi lima.** Yang terdorong keluar layar justru
kolom aksi di ujung kanan: tombol ubah & hapus baru terlihat setelah tabelnya
digulir mendatar. Penggabungannya mengikuti apa yang dibaca bersamaan — lokasi ke
nama event, batas pendaftaran ke tanggal, jumlah peserta ke sesi/materi. Slug
dibuang dari tampilan: ia hanya berarti saat menyusun tautan.

**Tombol "Tambah" pindah ke kepala tiap bagian.** Sebelumnya ketiganya berkumpul di
dasar panel sesi, tempat mereka baru terlihat sesudah seluruh isi tergulir habis —
dan tombol mana milik bagian mana hanya bisa ditebak dari urutannya.

**Sesi diberi nomor.** Di tab Materi, dua sesi berturut-turut terbaca sebagai satu
kolom panjang berisi bagian yang seragam; yang membedakannya cuma judul di dalam
kotak isian, dan kotak isian tidak terbaca sebagai judul. Sekarang tiap sesi
dibuka kepala bernomor dengan judulnya sebagai teks — nomornya urutan tampil,
karena itu yang dipakai orang saat menyebut "sesi kedua".

### Galeri: fotonya yang jadi isi, bukan namanya

Ini menutup task lanjutan yang ditolak saat tinjauan Sesi 9.

Daftar galeri di tab Materi berhenti jadi baris teks berjudul. Sekarang **pita
cuplikan mendatar** — foto 128×96 bergulir dalam satu baris, dengan tombol geser
kiri/kanan, ganti, dan hapus di bawah masing-masing. Bergulir mendatar dan bukan
membungkus, supaya urutannya terbaca sebagai urutan, persis seperti saat fotonya
diunggah.

Menyusul itu, **seluruh isian judul dicabut dari jalur galeri** — di modal unggah
massal maupun di form satu-item. Alasannya sama di kedua tempat: yang dilihat orang
fotonya, dan keterangan yang diketik untuk belasan foto sekaligus hampir selalu
berakhir sebagai pengulangan nama berkas. Form galeri kini berisi satu hal: gambarnya.

`judul` **tetap diisi di balik layar** dari nama berkas. Ia bukan hiasan: server
mewajibkan kolom itu (`bacaItem` menolak judul kosong), dan nilainya dipakai sebagai
teks alternatif gambar. Yang hilang cuma isiannya, bukan datanya. Ada jaring
pengaman di `SesiItemModal` untuk foto lama yang judulnya pernah kosong — tanpa itu
menyimpannya akan ditolak server oleh kolom yang tidak ada di layar mana pun.

Judul foto ikut dilepas dari bilah lightbox: tanpa isian judul, yang tersimpan di
sana selalu nama berkas, dan "Screenshot 2026 04 07 092118" bukan keterangan.

Kisi galeri di halaman publik dilonggarkan: empat kolom berjarak 18px membuat foto
berhimpitan dan tiap fotonya terlalu kecil untuk dikenali isinya — padahal
mengenali isi itulah satu-satunya guna kisi itu. Kini tiga kolom, jarak 24px,
bingkai membulat. Satu jebakan urutan CSS ikut ditutup: aturan 1 kolom untuk layar
≤480px ada **lebih awal** di berkas daripada aturan 2 kolom yang baru, dan pada
spesifisitas yang sama yang belakangan menang — jadi aturan 480px ditulis ulang
sesudahnya.

### Yang dikerjakan sesi ini

- [x] Filter tanggal + urutan "terbaru"/"batas" dicabut dari `pages/events/index.vue`
- [x] `EventTestimoni` eyebrow → Refleksi event / Event reflection
- [x] Urutan tab profil + penggeseran tab untuk profil orang lain
- [x] Modal konfirmasi tiap aksi di `AdminPesertaTab` (proses, konfirmasi, batal, pulihkan)
- [x] `tanpaTampil` dihapus; sakelar Tampil kembali di tab Materi
- [x] Kotak sesi krem + isi bagian putih; `SesiPengaturan` jadi putih
- [x] Garis `divide-y`/`border-y` di `AdminDetailUser` dibuang
- [x] Badge level & badge status riwayat dicabut di profil, panel detail, tabel user
- [x] `riwayatKegiatan()` menolak baris `batal` di SQL
- [x] Master disaring dari `GET /api/users`, opsi filter, form akun, halaman Petunjuk
- [x] Baris kontak di kepala profil orang lain
- [x] Login panel pendaftaran langsung membuka konfirmasi; kolom jadi
      "Email atau username" bertipe teks
- [x] `EventTestimoni` hanya digambar saat `fase === 'selesai'`
- [x] `/admin/events`: 8 kolom → 5, aksi tidak lagi terdorong keluar layar
- [x] Tombol "Tambah" pindah ke kepala tiap bagian di `EventResources`
- [x] Kepala sesi bernomor di tab Materi
- [x] Galeri jadi pita cuplikan mendatar di tab Materi
- [x] Isian judul dicabut dari `GaleriUnggahModal` & `SesiItemModal` (galeri saja);
      judul tetap terisi dari nama berkas untuk teks alternatif
- [x] Judul foto dilepas dari bilah `GaleriLightbox`
- [x] `.gallery-grid` 3 kolom + jarak 24px + bingkai membulat; urutan aturan
      media query ≤480px dibetulkan
- [x] Diuji: 7 rute (200 / 302 sesuai penjagaan), penanda filter & eyebrow
      diperiksa di HTML hasil SSR, typecheck 30 galat — di bawah baseline 33,
      nol tambahan; `nuxt build` sukses dua kali (47,6 MB)

### Catatan / risiko

**Halaman admin belum dilihat langsung.** Pratinjau dalam aplikasi masih menjawab
**426 Upgrade Required** untuk setiap permintaan ke `localhost:3009` — kendala yang
sama seperti Sesi 9, dan `curl` ke URL yang sama tetap menjawab 200. Rute admin
sendiri 302 tanpa sesi, jadi yang belum pernah disaksikan di layar: **modal
konfirmasi pendaftar, kotak sesi krem bernomor, pita galeri mendatar, tabel event
lima kolom, dan panel detail user tanpa garis.** Semuanya perubahan tampilan;
jalur datanya tidak berubah kecuali penyaringan `batal` di riwayat.

Yang paling layak dicoba manual lebih dulu: **pita galeri** (apakah lebar 128px
cukup dan tombolnya tidak berdesakan) dan **alur daftar dengan akun** — yang
terakhir menyentuh urutan tampil panel, jadi salahnya akan berupa modal yang
terbuka di atas panel yang keburu berganti wajah, bukan galat.

**Kolom `status` peserta tidak berubah.** Yang batal tetap tersimpan lengkap
beserta `statusSebelumBatal` — yang berubah hanya siapa yang melihatnya.

### Task berikutnya: revisi tinjauan 12 Agu 13.22 — halaman member & urutan event

Dua pesan tinjauan (13.22 & 13.26). Belum dikerjakan; ini catatan persiapannya.
Polanya satu: **judul halaman harus menyebut hal yang sama dengan tombolnya**, dan
daftar member berhenti jadi tempat membaca detail — ia jadi tempat memilih lalu
pergi.

#### 1. Eyebrow dicabut dari seluruh dashboard admin

"Administrasi", "Program", "Konten", "Admin area", "Referensi", "Jurnal" — teks
kecil huruf besar di atas judul halaman. Di situs publik ia menempatkan halaman
dalam rangkaiannya; di dashboard, sidebar sudah melakukan itu dan penandanya
tinggal jadi baris yang dibaca tanpa menjawab apa pun.

Yang tersentuh (`text-xs font-bold uppercase tracking-[.16em]` tepat di atas `<h1>`):

| Berkas | Baris | Teks |
|---|---|---|
| `pages/admin/index.vue` | 106 | Admin area |
| `pages/admin/events.vue` | 104 | Program |
| `pages/admin/members.vue` | 100 | Administrasi |
| `pages/admin/member/[id].vue` | 158 | Administrasi |
| `pages/admin/petunjuk.vue` | 78 | Referensi |
| `pages/admin/contributors.vue` | 21 | Konten |
| `pages/admin/jurnal/index.vue` | 52 | Konten |
| `pages/admin/jurnal/[id].vue` | 68 | Jurnal |
| `pages/admin/[section].vue` | 18, 33 | Admin area / Contoh pengelolaan |

**Bukan** eyebrow, jangan ikut dibuang: kelas yang sama dipakai sebagai **label
bagian di dalam kartu** — "Password baru" (`member/[id].vue:248`,
`AdminDetailUser.vue:256`) dan "Data diri"/"Riwayat akun" (`AdminDetailUser.vue`).
Yang dicabut hanya yang berdiri tepat di atas `<h1>` halaman.

#### 2. `/admin/members`: judul, tombol, kolom, aksi

- **Judul `User` → `Member`**, tombol **`Add User` → `Add Member`**, dan tombol
  kembali di form (`Kembali ke User`) ikut. Alasannya yang disebut peninjau:
  halaman berikutnya akan bernama ADD MEMBER / EDIT MEMBER, jadi judul daftarnya
  harus kata yang sama.
- **Kolom "Terakhir masuk" dihapus** (`lastLogin`, `members.vue:78` + template
  `#lastLogin-cell` + helper `tanggal()` yang mungkin jadi tak terpakai). Kalau
  log dibutuhkan nanti, menu log tersendiri — bukan satu kolom di daftar ini.
  `lastLogin` tetap dikirim `GET /api/users`; yang dicabut pemakainya.
- **Tombol "Detail" diganti dua ikon**: mata (pratinjau) dan pensil (ubah).
- **Mata → `/profil?id=<id>`.** Halaman profil sudah menerima `?id=`
  (`pages/profil.vue:19`, `targetId`), dan Sesi 10 sudah menambahkan baris kontak
  serta penggeseran tab untuk profil orang lain — jadi tujuannya sudah siap
  dipakai apa adanya.
- **Pensil → `/admin/member/<id>`** (form yang sudah ada).
- **Panel detail kanan dicabut seluruhnya**: `terpilihId`, `pilih()`, `watch`
  penutup panel, kelas lebar bersyarat (`max-w-[1400px]` / `lg:grid-cols-2`),
  penanda garis emas di sel nama, dan `@select` pada `<UTable>`. Tabelnya kembali
  satu kolom `max-w-6xl`.
- **`components/AdminDetailUser.vue` jadi tanpa pemakai** — `members.vue:189`
  satu-satunya. Hapus berkasnya, jangan ditinggal menggantung. Perhatikan: di
  dalamnya ada jalur **reset password** (`bolehReset` + modal). Jalur yang sama
  sudah ada di `pages/admin/member/[id].vue` (tombol "Ganti password"), jadi tidak
  ada kemampuan yang hilang — tapi pastikan itu dulu sebelum menghapus.

#### 3. Form member: add dan edit harus sama persis

Satu berkas sudah menangani keduanya (`pages/admin/member/[id].vue`, `baru =
id === 'new'`), tapi bentuknya belum sama:

- **Password pindah ke dalam form pada mode edit.** Sekarang mode edit
  menyembunyikan field password (`v-if="baru"`) dan menaruh penggantiannya di
  balik tombol + `UModal`. Yang diminta: field password langsung di form, sama
  seperti mode buat. Endpointnya berbeda dan itu tidak berubah —
  `POST /api/admin/users` membawa password saat membuat,
  `POST /api/admin/users/[id]/password` untuk mengganti. Yang perlu diputuskan:
  pada mode edit, apakah "Simpan perubahan" mengirim **dua** permintaan (PATCH
  data + POST password bila kolomnya terisi), atau password punya tombolnya
  sendiri di tempat. Yang pertama lebih dekat ke "sama persis dengan form add";
  kalau dipilih, kolom kosong harus berarti "jangan ubah password", dan
  kegagalan salah satu permintaan harus terbaca jelas milik yang mana.
- **Field Username dicabut dari kedua mode.** `username = email`. Server sudah
  siap: `bacaUser()` menyusun username dari bagian depan email saat body tidak
  menyebutnya, dan pada PATCH `usernameSekarang` membuat username lama
  dipertahankan apa adanya. **Perlu diputuskan**: "username = email saja" apakah
  berarti kolom `username` diisi **alamat email utuh**, atau cukup dibiarkan
  turunan otomatis yang sekarang (bagian depan email). Login sudah menerima
  keduanya (email maupun username), jadi keduanya jalan — bedanya cuma apa yang
  tampil sebagai `@handle` di tabel member.
- Judul halaman ikut aturan tombol: **Add Member / Edit Member**.

#### 4. `/pages/events/index.vue`: dua label urutan

`Terdekat dulu` / `Terjauh dulu` → **`Terbaru` / `Terlama`** (EN: `Newest` /
`Oldest`).

**Ini bukan penggantian teks belaka — artinya terbalik.** `terdekat` sekarang
menaik menurut `tanggalMulai` (event paling awal di atas), dan itu **sama dengan
"Terlama"**. `terjauh` menurun = **"Terbaru"**. Kalau hanya labelnya yang ditukar,
tiap pilihan akan melakukan kebalikan dari namanya.

Yang ikut terbawa: `urutan` bawaan `'terdekat'` (baris 54), pemeriksaan
`adaFilter` dan `resetFilter` (121, 126–127), dan `switch` di `events` (102–114).
Bawaan server tetap `asc(tanggalMulai)`
(`server/api/events/index.get.ts:48`) — kalau bawaan klien jadi "Terbaru",
urutannya tidak lagi cocok dengan yang datang dari server, jadi pilihan awal akan
mengubah susunan. Lebih aman: **biarkan "Terlama" sebagai bawaan** (perilaku
tidak berubah, hanya namanya), atau ubah `orderBy` server sekalian.

#### Yang perlu diperiksa setelah dikerjakan

- Kolom `aksi` tanpa teks: dua tombol ikon harus punya `aria-label` sendiri, kalau
  tidak keduanya jadi tombol tanpa nama bagi pembaca layar.
- Klik pada ikon di dalam baris tabel: `@select` dicabut, jadi tidak ada lagi
  klik-baris yang perlu ditahan `@click.stop` — pastikan tidak ada sisa.
- `/profil?id=<id>` dibuka dari daftar mendarat di tab **Riwayat** (penggeseran
  Sesi 10), bukan tab Pengaturan yang tidak ada di profil orang lain.
- Typecheck: baseline 30 galat lama (Sesi 10), nol tambahan.

---

## 2026-08-12 — Sesi 9: Jadwal event berjam, status dicabut, editor galeri

### Status redaksional dicabut — dan itu memang membuang sesuatu

Sesi 3 memisahkan dua hal yang mudah tertukar: `status` (kolom, ditentukan admin)
dan **fase** (turunan tanggal). Sesi ini mencabut yang pertama dari seluruh
antarmuka. Fase kini satu-satunya keadaan yang dilihat siapa pun, dan ia selalu
benar tanpa ada yang perlu memutakhirkannya.

Yang hilang bersamanya: **draft**. Tidak ada lagi cara menyembunyikan event yang
belum siap dari halaman publik. Migrasi `0005` menerbitkan lima baris `draft` yang
tertinggal, karena baris seperti itu tidak akan pernah tampil sementara formulir
yang bisa menerbitkannya sudah tidak ada — dibiarkan, ia jadi data yang tak
terjangkau. Kalau "simpan dulu, terbitkan nanti" ternyata dibutuhkan, kembalikan
sebagai satu sakelar "Tampilkan di publik", bukan sebagai empat pilihan status.

Kolomnya sendiri **tidak dihapus**: `batal` masih dihormati `faseKegiatan()`, dan
menghapus kolom di SQLite menuntut menulis ulang seluruh tabel.

Harga ikut dicabut dari tabel dan formulir dengan alasan berbeda: pembayaran diurus
admin lewat WhatsApp, jadi angkanya tidak pernah menentukan apa pun di situs.
Kolomnya tetap ada (default 0) untuk transaksi yang dicatat terpisah.

### Jam disimpan terpisah dari tanggal — bukan digabung jadi satu timestamp

Migrasi `0005` menambah `jam_mulai` dan `jam_selesai` (`HH:MM`, menit kelipatan 5).

Godaan pertamanya adalah menggabungkan jam ke `tanggal_mulai` yang sudah berupa
timestamp. Itu akan merusak permintaan yang justru jadi alasan pekerjaan ini:
*"kalau tanggal hari ini, ya berlangsung."* `faseKegiatan()` menganggap kegiatan
berlangsung sepanjang **hari** `tanggalMulai`; begitu jam ikut masuk, event jam
14.00 tercatat "mendatang" sepanjang pagi di hari-H.

`waktu` — teks bebas "09.00 – 16.30 WIB" dari Sesi 6 — **tidak dihapus**. Ia masih
memuat isi lima event lama dan kini jadi cadangan tampilan selama kedua kolom jam
kosong (`rentangJam()` di `utils/waktuEvent.ts`). Dua sumber untuk satu hal memang
utang; yang dihindari adalah menulis ulang isi lima event dalam migrasi yang tidak
bisa membaca maksudnya.

`tutup_pendaftaran` sudah timestamp sejak awal, jadi jam batas pendaftaran tidak
butuh kolom baru — hanya UI yang mengisinya.

### `keTanggal()` dan zona waktu yang baru berbahaya di produksi

Bentuk `YYYY-MM-DDTHH:MM` (yang dikirim formulir batas pendaftaran) kini ditambahi
`+07:00` secara eksplisit. Tanpa itu `new Date()` memakai zona **mesin yang
membaca**. Di mesin pengembangan ini kebetulan WIB, jadi salahnya tidak pernah
terlihat; di server produksi yang berjalan UTC, setiap batas pendaftaran bergeser
tujuh jam tanpa satu pun galat.

### Aturan jam: hanya berlaku untuk event sehari

`jamSelesai <= jamMulai` ditolak — tapi **hanya** kalau tanggal mulai dan selesai
jatuh di hari yang sama. Pada event berhari-hari, "selesai 09.00" sesudah "mulai
16.00" justru normal: keduanya jam pada hari yang berbeda. Tanggal selesai boleh
**sama** dengan tanggal mulai; yang ditolak hanya yang mundur.

Diuji lewat API: menit 09:03 ditolak, tanggal selesai mundur ditolak, jam selesai
lebih awal **lolos** pada event dua hari lalu **ditolak** begitu keduanya disamakan.

### `WaktuPicker` — dua kolom, bukan 288 pilihan

`<input type="time">` ditolak karena dua hal: tampilannya ditentukan browser
(alasan yang sama yang memindahkan filter tanggal ke `UCalendar` di Sesi 4), dan
kelipatan lima menit tidak bisa ditegakkan dengan cara yang terlihat — atribut
`step` hanya memvalidasi, orang tetap bisa mengetik 09:03 lalu menerima galat.

Satu daftar berisi 288 kombinasi juga ditolak: mencari 16.45 di dalamnya berarti
menggulir jauh. Yang dipakai dua kolom bergulir, dan pilihan yang aktif digulirkan
ke tengah saat dibuka. Prop `minimal` membuat jam yang mendahului jam mulai mati
di tempat — bukan menerima klik lalu menolak.

Kelipatan lima tetap **diperiksa ulang di server**: nilai yang tidak lewat form
akan membuat halaman menampilkan jam yang tidak pernah bisa dipilih ulang oleh
pemiliknya sendiri.

### Halaman event: enam urutan, semuanya di klien

Diurutkan di klien dengan alasan yang sama seperti pencarian sejak Sesi 6 — daftar
event komunitas berukuran puluhan, dan seluruhnya sudah ada di tangan.

Satu yang tidak sepele: **"batas daftar terdekat" harus menaruh event tanpa batas
di belakang.** Tanpa penanganan khusus `null` jadi 0 dan justru merebut posisi
teratas — persis kebalikan dari yang dicari orang saat memilih urutan itu.

Kartu event dapat baris batas pendaftaran, dan barisnya berubah merah begitu
terlewat. Event yang sudah `selesai`/`batal` tidak menampilkannya sama sekali: di
sana "pendaftaran ditutup" cuma mengulang badge di sampulnya.

### Batas pendaftaran bisa disunting di halaman, tapi bukan lewat `EditableText`

`<EditableText>` menyunting satu kolom teks bebas. Jam `HH:MM` berkelipatan lima
dan tanggal+jam yang harus jadi satu timestamp bukan itu — dibiarkan diketik
bebas, server menolak apa yang tampak sah di layar dan pengetiknya tidak tahu
bentuk mana yang benar.

`EventJadwal.vue` menggantikan dua baris `<dl>` di panel "Informasi acara". Mode
bacanya sama persis dengan baris lain; mode suntingnya memakai `WaktuPicker` dan
menyimpan **jam acara dan batas pendaftaran dalam satu PATCH** — keduanya menjawab
pertanyaan yang sama, dan menyimpannya terpisah membuat setengah jadwal tersimpan
sementara setengah lagi tidak.

### Tab materi: autosave, dan tiga bagian jadi tiga baris

Tombol "Simpan sesi" dan sakelar "Tampil" dicabut dari tab Materi.

Autosave-nya bukan kenyamanan melainkan perbaikan ketidakkonsistenan: setiap
tindakan lain di panel itu — tambah item, geser, hapus — sudah menyimpan dirinya
sendiri seketika, sehingga satu-satunya kotak yang menuntut tombol justru yang
paling mudah terlupakan. Judul sesi yang diketik lalu ditinggalkan hilang tanpa
tanda apa pun.

Jedanya 800 ms setelah pengetikan berhenti, bukan per ketukan: satu permintaan per
huruf berarti tiap balasan memicu induk memuat ulang daftarnya. Yang masih
menunggu jedanya ikut disimpan di `onBeforeUnmount` — menutup panel atau berpindah
tab membuang komponennya bersama timer yang belum berbunyi. Judul kosong ditahan
di klien, karena dengan autosave galat itu akan muncul tepat saat orang baru
menghapus judul lama untuk menggantinya.

`SesiPengaturan.vue` kini dipakai **dua tempat** — tab admin dan penyuntingan di
halaman publik — dengan prop `tanpaTampil` untuk yang pertama. Sakelar "Tampil"
sengaja ditinggalkan di halaman publik: di sana pengelola melihat langsung apa yang
hilang saat dimatikan, yang di dalam formulir admin hanya berupa kata tanpa akibat
terlihat.

Materi/galeri/referensi berhenti jadi tiga kolom sempit. Judul materi hampir selalu
panjang ("Rekaman sesi 2 — mendengarkan tanpa menilai"), dan di kolom selebar
sepertiga layar semuanya terpotong jadi potongan yang tidak bisa dibedakan satu
sama lain. Sekarang tiga baris penuh, dan baris galeri membawa cuplikan fotonya.

### Pustaka media pindah ke modalnya sendiri

Panel yang mekar di dalam `SesiItemModal` punya dua masalah yang bukan selera: ia
mendorong tombol Simpan keluar dari layar (form sudah setinggi modal), dan tidak
punya cara mencari — pustaka tumbuh tiap unggahan, dan memilih berarti menggulir
kisi 24 petak sambil membaca nama yang terpotong.

`PustakaMediaModal.vue` memakai lebar penuh, punya kotak pencarian (`?cari=`
ditambahkan ke `GET /api/media`, disaring di **SQL** karena daftarnya berpaginasi —
menyaring di klien hanya menyaring satu halaman), dan menutup diri begitu satu
berkas dipilih.

### Editor galeri: potongan disimpan dalam piksel sumber

Ini bagian yang paling mudah dibuat salah. Percobaan pertama menyimpan transform
tampilan (geser, skala, putar) lalu menghitung ulang potongannya dari ukuran
panggung saat diekspor. Akibatnya hasil potongan **bergantung pada lebar jendela
browser saat tombol ditekan**: panggung yang lebih sempit menghasilkan berkas yang
lebih kecil, dan potongan yang tersimpan tidak bisa diperlihatkan ulang di layar
berukuran lain.

Yang dipakai: potongan disimpan dalam **piksel sumber setelah diputar**. Zoom dan
geser jadi murni alat lihat — mengubahnya tidak mengubah hasil sama sekali — dan
keluarannya selalu setajam aslinya. Satu-satunya tempat kedua sistem koordinat
bertemu adalah pembagian selisih layar dengan skala tampilan saat sudut ditarik.

Rincian yang layak dicatat:

- **Memutar mengembalikan potongan ke penuh.** Memetakannya ke ruang baru bisa
  dihitung, tapi hasilnya membingungkan: setelah 90°, kotak yang tadi "kepala
  orangnya" mendarat di tempat lain dan harus dibetulkan dari nol.
- **PNG dan WebP dipertahankan; sisanya jadi JPEG.** Bukan soal mutu — PNG
  satu-satunya yang menyimpan transparansi, dan memaksanya jadi JPEG mengubah latar
  tembus pandang jadi hitam pekat. Yang jadi JPEG diberi latar putih lebih dulu.
- **Berkas yang tidak berubah dikembalikan apa adanya**, melewatkan canvas: untuk
  JPEG, pengodean ulang selalu menurunkan mutu meski gambarnya sama persis.
- **Potongan diterapkan tepat sebelum unggah**, bukan saat disunting — kalau tidak,
  tiap tarikan sudut menghasilkan satu berkas baru di memori.
- **Object URL dilepas manual.** Browser tidak melakukannya sendiri; tanpa itu,
  memilih ratusan foto dalam satu sesi kerja menahan semuanya sampai halaman
  ditutup.

`GaleriUnggahModal.vue` mengunggah foto **satu per satu** meski endpoint media
menerima banyak berkas sekaligus. Unggahan sepuluh foto ponsel bisa puluhan MB dan
satu permintaan sebesar itu lebih mudah putus di tengah; lebih penting lagi,
kegagalan pada foto keenam tidak boleh membatalkan lima yang sudah berhasil.

Bagian galeri di **kedua** tempat (tab admin dan penyuntingan halaman publik) kini
membuka modal ini; materi dan referensi tetap lewat form satu-item, dan form itu
tetap dipakai untuk **mengubah** foto yang sudah ada — di sana yang diubah biasanya
keterangannya, bukan berkasnya.

### Filter pendaftar jadi chip

Lima tombol persegi berjajar diganti satu kelompok chip di dalam bantalan. Yang
berubah bukan cuma bentuknya: hitungannya menyatu ke dalam chip (sebelumnya badge
terpisah yang membuat tiap tombol terbaca sebagai dua elemen), yang tidak aktif
dibuat rata dan tenang sehingga satu yang aktif benar-benar menonjol, dan tiap
status punya ikon serta warnanya sendiri.

Warnanya ditulis sebagai **kelas utuh** dalam sebuah peta, bukan disusun dari
potongan seperti `bg-cc-${warna}-500`. Tailwind memindai berkas sebagai teks; nama
kelas yang baru terbentuk saat runtime tidak pernah ikut diterbitkan, dan chipnya
jadi transparan tanpa satu pun galat.

### Contributors disembunyikan dari sidebar

Atas permintaan. Halamannya masih array literal di dalam `.vue` dan belum menyentuh
database, jadi menu yang mengarah ke sana menjanjikan sesuatu yang belum ada.
Barisnya dikomentari di `layouts/admin.vue`, halamannya sendiri tetap hidup di
`/admin/contributors`.

### Yang dikerjakan sesi ini

- [x] Migrasi `0005_jam-kegiatan`: `jam_mulai`, `jam_selesai`, `draft` → `terbit`
- [x] `keJam()` + aturan jam sehari + `keTanggal()` sadar zona untuk bentuk `T HH:MM`
- [x] `utils/waktuEvent.ts` — pemformat jam & batas dipakai kartu, detail, tabel admin
- [x] `components/WaktuPicker.vue` (dua kolom, menit per 5, prop `minimal`)
- [x] Halaman event: 6 pilihan urutan + baris batas pendaftaran di kartu
- [x] `EventJadwal.vue` — jam & batas bisa disunting di halaman detail
- [x] Panel pendaftaran menyebut tenggat (terbuka) dan tanggal penutupan (tertutup)
- [x] `/admin/events`: kolom Biaya & Status dihapus, filter jadi fase + chip hitungan,
      kolom "Batas daftar" ditambah
- [x] `/admin/event/[id]`: harga & status dicabut, jam mulai/selesai, batas
      tanggal+jam, peringatan sebelum simpan
- [x] Tab materi autosave, tanpa tombol simpan & sakelar tampil; tiga bagian jadi
      tiga baris penuh dengan cuplikan galeri
- [x] `PustakaMediaModal.vue` + `?cari=` di `GET /api/media`
- [x] `GambarEditor.vue` + `utils/potongGambar.ts` + `GaleriUnggahModal.vue`
- [x] Chip filter pendaftar; Contributors disembunyikan dari sidebar
- [x] Diuji: 5 aturan validasi lewat API, `meta.perFase` tetap utuh saat difilter,
      buat event tanpa status/harga → `terbit`/0, unggah galeri + buat item,
      pencarian pustaka, 6 rute SSR 200 tanpa penanda galat, typecheck kembali
      persis ke baseline (33 galat lama, nol tambahan)

### Task lanjutan: daftar galeri di tab materi masih salah bentuk

Ditolak saat ditinjau (12 Agu, setelah deploy). Yang dibuat sesi ini menyamakan
galeri dengan materi dan referensi: baris teks berjudul, dengan cuplikan 32px di
kirinya. Untuk daftar foto itu keliru — **fotonya sendiri yang jadi isi**, bukan
namanya. Cuplikan seukuran itu tidak membantu siapa pun mengenali foto mana yang
sedang dilihat.

Yang diminta:

- **Gambar penuh, tersusun satu baris** (pita cuplikan), bukan daftar baris teks.
- **Bisa diklik untuk fokus** — tampilan detail dengan zoom in / zoom out.
- Di tampilan fokus itu: **ganti gambar** dan **hapus**.
- **Judul saja** sebagai isian; tidak perlu field lain.
- **Gambar diambil dari media saja** — pemilih "pustaka media" tidak perlu ada di
  jalur galeri.

Catatan untuk yang mengerjakan: bahan-bahannya sudah ada dan tinggal disusun ulang,
bukan dibuat dari nol. `GaleriLightbox.vue` sudah punya zoom/geser/putar dan
navigasi antarfoto; `GambarEditor.vue` sudah punya zoom + ganti gambar;
`GaleriUnggahModal.vue` sudah punya pita cuplikan satu baris yang bentuknya persis
seperti yang diminta. Yang belum ada: pita itu dipakai sebagai **daftar galeri di
tab materi** (bukan hanya di modal unggah), dan tampilan fokusnya membawa tombol
ganti + hapus.

Perlu diputuskan saat mengerjakan: apakah "ganti gambar" di sana mengunggah berkas
baru lalu mem-PATCH `mediaId` item itu, atau membuat item baru dan membuang yang
lama. Yang pertama mempertahankan urutan dan judulnya — kemungkinan besar itu yang
diharapkan, karena mengganti foto biasanya berarti "yang ini salah", bukan "yang
ini tidak jadi ada".

### Catatan / risiko

**Draft benar-benar hilang.** Lihat bagian pertama. Ini pelonggaran yang disengaja
dan disetujui, bukan kelalaian.

**Daftar galeri di tab materi ditolak saat ditinjau** — lihat bagian di atas. Yang
sudah live sekarang bentuknya belum benar.

**Dua sumber untuk jam acara.** `waktu` (teks bebas) dan `jamMulai`/`jamSelesai`
hidup berdampingan; yang kedua menang bila terisi. Lima event lama masih memakai
yang pertama. Membereskannya berarti menyalin isi `waktu` ke kolom jam secara
manual per event — tidak bisa ditebak mesin karena bentuk teksnya berbeda-beda
("16.00 WIB (hari 1) – …").

**Editor galeri belum diuji di browser sungguhan.** Pratinjau dalam aplikasi
menjawab **426 Upgrade Required** untuk setiap permintaan ke `localhost:3009` —
termasuk PNG statis — sementara `curl` ke URL yang sama menjawab 200. Itu proxy
pratinjaunya, bukan aplikasinya (satu tangkapan layar pertama sempat berhasil
sebelum macet). Jalur datanya sudah diuji lewat API sampai item galeri benar-benar
terbentuk, tapi **penarikan sudut, putaran, dan hasil `canvas.toBlob` belum pernah
disaksikan.** Ini yang paling perlu dicoba manual sebelum dipakai sungguhan.

**Menghapus sesi dari tab materi masih tanpa konfirmasi** — perilaku lama yang
ikut terbawa. Penyuntingan di halaman publik sudah punya dialognya.

**`harga` masih dikirim API dan masih ada di skema**, hanya tidak lagi bisa diisi.
Kalau pembayaran suatu saat masuk ke situs, kolomnya sudah siap.

---

## 2026-08-11 — Sesi 8: Deployment ke compassionate-companion.com — LIVE

Tidak ada perubahan fitur. Sesi ini membangun jalur rilis ke server
`104.64.212.19` dan **menjalankannya sampai situs hidup** di
`https://compassionate-companion.com`. Polanya mengikuti `deploy/` milik
orbita-platform: kirim `.output` lewat SSH lalu restart PM2 — **bukan** git
push, dan server tidak menjalankan `npm install`.

Server: Ubuntu 24.04.4, x86_64, **1 vCPU / 961 MB RAM**, 20 GB kosong, swap 496 MB
sudah ada. Spesifikasi itu ikut membenarkan keputusan build di lokal: mesin
sekecil ini tidak nyaman menjalankan `nuxt build` (di lokal saja hasilnya 48 MB).

Berkas baru semuanya di `deploy/`: `deploy.sh`, `server-setup.sh`,
`tunnel-setup.sh`, `ecosystem.config.cjs`, `migrate.mjs`, `snapshot-db.mjs`,
`.env.example`, dan `DEPLOY.md` sebagai panduannya.

### Build produksi pertama — dan satu peringatan yang bukan sekadar peringatan

`npm run build` sukses (48 MB, 19,8 MB gzip), tapi menutupnya dengan:

> `sharp binaries have been included in your build for win32-x64`

Itu bukan catatan informatif. Nitro hanya menyertakan binary native untuk
arsitektur mesin yang mem-build, dan mesin ini Windows sementara servernya
Linux. Kalau `.output` dikirim apa adanya, `@nuxt/image` mati pada permintaan
gambar pertama — sisa situsnya tetap normal, jadi gejalanya muncul belakangan
dan tidak jelas asalnya.

Dua dependensi native, dan ternyata nasibnya beda:

| Paket | Isi `.output` | Kesimpulan |
|---|---|---|
| better-sqlite3 | `prebuilds/` berisi 8 platform, **linux-x64 ikut** | aman apa adanya |
| sharp | hanya `@img/sharp-win32-x64` | harus ditambal |

`deploy.sh` menambal yang kedua dengan memasang `@img/sharp-linux-x64` **di
server** lalu menyalin isinya ke `.output/server/node_modules/@img/`. Dipasang di
server, bukan diunduh lintas-platform dari lokal, supaya npm yang menentukan
binary mana yang cocok — bukan tebakan skrip ini.

`SHARP_VERSION` di `deploy.sh` dipatok ke `0.34.5` mengikuti versi lokal. Ini
memang tempat yang bisa basi diam-diam saat sharp naik versi; dicatat di
`DEPLOY.md` supaya tidak jadi kejutan.

### Database: satu berkas yang isinya seluruh situs

Media di project ini disimpan sebagai BLOB di dalam SQLite (`cc_media_gambar`,
`_video`, `_etc`), bukan sebagai berkas di `public/`. Konsekuensinya
menyenangkan sekaligus berbahaya: tidak ada folder upload yang perlu di-rsync —
`data/cc.db` **adalah** seluruh isi situs — tapi juga tidak ada satu pun
salinannya di repo.

Karena itu:

- **cwd PM2 = `/root/ccwebsite`, bukan `.output/`.** `server/db/index.ts`
  me-resolve `DATABASE_URL` terhadap `process.cwd()`. Kalau cwd-nya di dalam
  `.output`, database produksi akan terhapus oleh deploy berikutnya yang menimpa
  folder itu. Ini satu baris di `ecosystem.config.cjs` yang menentukan data
  hilang atau tidak.
- **`--kirim-db` menolak jalan kalau server sudah punya `data/cc.db`**, dan
  memeriksanya *sebelum* apa pun terkirim. Menimpanya bukan "reset" melainkan
  kehilangan permanen.
- **Yang dikirim bukan `cp cc.db`.** Database jalan dalam mode WAL; saat ini
  `cc.db` 262 KB dan `cc.db-wal` 120 KB. Menyalin `cc.db` mentah berarti
  mengirim database yang kehilangan perubahan terakhir, tanpa error apa pun.
  `snapshot-db.mjs` pakai `VACUUM INTO` — satu berkas utuh yang sudah menyertakan
  WAL, tanpa mengunci database sumber. Diuji: hasilnya 249 KB, `cc_user=4`,
  `cc_kegiatan=5`. Skripnya berhenti kalau `cc_user` nol, karena database tanpa
  akun berarti server yang mustahil dimasuki.

### Migrasi: runtime migrator, bukan `drizzle-kit push`

`data/cc.db` lokal sudah punya `__drizzle_migrations`, jadi riwayatnya terlacak
dan migrator runtime bisa melanjutkan dari sana.

`deploy/migrate.mjs` memakai `drizzle-orm/better-sqlite3/migrator`, bukan
`drizzle-kit`. Migrator runtime hanya menjalankan `.sql` yang sudah ada lalu
mencatatnya; ia tidak pernah membandingkan skema lalu bertanya interaktif
seperti `push`. Di orbita hal itu diakali dengan `ssh -t` supaya ada TTY —
di sini masalahnya dihindari, bukan diakali. Server juga jadi tidak perlu punya
`drizzle-kit`: `better-sqlite3` dan `drizzle-orm` sudah ada di `.output`, jadi
`migrate.mjs` dititipkan ke `.output/server/` agar ter-resolve dari sana.

### Cloudflare Tunnel, bukan nginx

Orbita mengandalkan TLS yang diterminasi upstream ke origin `:3500` yang
terbuka. Di sini dipilih tunnel: `cloudflared` di server membuka koneksi
**keluar** ke Cloudflare, jadi tidak ada port masuk yang perlu dibuka untuk web
sama sekali. `ufw` hanya mengizinkan SSH, dan Nitro mendengarkan
`127.0.0.1:3010` — bukan `0.0.0.0`.

DNS-nya CNAME ke `<uuid>.cfargotunnel.com`, **tanpa A record**. IP origin
`104.64.212.19` tidak pernah muncul di DNS publik.

`cloudflared tunnel login` sudah dijalankan; `~/.cloudflared/cert.pem` ada.
`tunnel-setup.sh` sengaja dijalankan dari mesin lokal: pembuatan tunnel dan
penulisan DNS butuh `cert.pem`, kredensial tingkat akun yang bisa menyentuh
seluruh zona. Yang disalin ke server hanya credentials JSON milik satu tunnel
ini — `cert.pem` tidak pernah ikut.

### SSH

Kunci yang dipakai `~/.ssh/id_rsa` (RSA 3072, `Viole@MSI`,
`SHA256:GbwRHpj1rdt1RyBYq4xip2IoGzcyJw5HFaO7NEvdIc4`) — satu-satunya kunci RSA
yang ada; dua lainnya ed25519 dan milik project lain. Alias `Host cc`
ditambahkan ke `~/.ssh/config` dengan `IdentitiesOnly yes`, supaya SSH tidak
menawarkan ketiga kunci berurutan dan kena batas percobaan autentikasi.

### Dua kegagalan nyata saat deploy pertama

Skripnya lolos `bash -n` dan uji lokal, lalu tetap gagal dua kali di server.
Keduanya tidak mungkin ketahuan tanpa benar-benar menjalankannya.

**1. `npm init -y` menolak folder berawalan titik.** Langkah penambal sharp
memasang paketnya di `$REMOTE_DIR/.sharp-linux`, dan `npm init -y` memakai nama
folder sebagai nama paket: `Invalid name: ".sharp-linux"`. Foldernya diganti
jadi `sharp-linux`.

**2. Nitro membuat symlink dengan target absolut — dan targetnya path Windows.**
Ini yang mahal. Tiga paket (`entities`, `css-tree`, `mdn-data`) tidak disalin
utuh ke `.output/server/node_modules` melainkan di-symlink ke
`node_modules/.nitro/<paket>@<versi>`, dengan target **absolut**:

```
entities -> /c/sam/COSMOS/ccwebsite/.output/server/node_modules/.nitro/entities@7.0.1
```

`tar` mengirimkannya apa adanya, jadi di server ketiganya menggantung. App
start, PM2 melaporkan `online`, lalu prosesnya mati:

```
Error: Cannot find module 'entities/decode'
```

Perbaikannya `tar czhf` — `-h` mendereferensi symlink sehingga isinya yang
terkirim. `.output` di server juga dihapus dulu sebelum extract, karena `tar`
tidak menimpa symlink lama dengan direktori.

Yang perlu diingat dari kejadian ini: **PM2 `online` bukan berarti aplikasi
hidup.** Statusnya diberikan begitu proses ter-spawn; crash sesudahnya baru
terlihat di `pm2 logs`. Smoke test yang membaca status PM2 saja akan lulus di
sini padahal situsnya mati total.

### Smoke test deploy sempat memberi kegagalan palsu

Versi pertama `deploy.sh` menutup dengan satu `curl` tepat setelah restart, dan
selalu melaporkan `Failed to connect` — Nitro baru mengikat port satu-dua detik
setelah PM2 bilang `online`. Kegagalan palsu semacam itu melatih orang
mengabaikan hasil smoke test, jadi diganti percobaan berulang sampai 15 detik.
Sekarang jawabannya `HTTP 302 setelah 1s`.

### Verifikasi

Diuji dari server (bukan dari lokal — lihat catatan curl di bawah):

| Yang diuji | Hasil |
|---|---|
| `/` | 302 → `/id` |
| `/id`, `/en`, `/id/jurnal` | 200 (20.4 KB / 20.3 KB / 27.7 KB) |
| `/admin` tanpa sesi | 302 → `/id/login?redirect=/admin` |
| `www.compassionate-companion.com` | 200 |
| Sertifikat | Google Trust Services WE1, berlaku s.d. 8 Nov 2026 |
| `/api/events` | 200, data dari SQLite yang diangkut |
| IPX resize + WebP | 200 `image/webp` — **sharp linux jalan** |
| `pm2 status` | online, restart 1 (crash pertama itu) |
| Port publik di server | hanya `127.0.0.1:3010`; ufw cuma SSH |
| DNS | CNAME proxied; `104.64.212.19` **tidak muncul** |
| Browser | semua request 200, tidak ada error konsol |

**Uji yang paling penting: data selamat.** Setelah satu deploy penuh yang
`rm -rf .output`, isi database tidak berubah — `cc_user` 4, `cc_kegiatan` 5,
`cc_sesi` 9, `cc_media` 1, `cc_refleksi` 2, `cc_peserta` 1. Keputusan menaruh
`data/` di luar `.output` terbukti benar, bukan cuma masuk akal di atas kertas.

Autostart setelah reboot: `pm2-root` dan `cloudflared` dua-duanya `enabled`, dan
`dump.pm2` sudah memuat `cwd`, `PORT`, `DATABASE_URL`, serta session password
(64 karakter) — jadi `pm2 resurrect` punya semua yang dibutuhkan. **Belum diuji
dengan reboot sungguhan.**

### Temuan yang bukan masalah deployment

`pm2 logs` memuat `[Icon] failed to load icon 'lucide:lock'` dan sekawan.
Ditelusuri sampai tuntas dan hasilnya: **bukan** akibat deployment, dan **tidak**
terlihat pengguna.

- Koleksi lucide sebenarnya lengkap di bundle — `.output/server/chunks/_/icons.mjs`
  berisi 1836 ikon, termasuk semua yang "gagal".
- `.output` yang sama dijalankan di Windows lokal memunculkan peringatan yang
  persis sama. Jadi ini sifat build-nya, bukan servernya.
- Di browser, kelima ikon tergambar normal 16×16 dengan data URI. Endpoint
  `/api/_nuxt_icon/lucide.json` menjawab 200 dengan body ikon asli — klien yang
  menyelesaikannya setelah SSR menyerah.

Kosmetik, tapi tetap layak dibereskan supaya log error tidak berisik oleh hal
yang tidak perlu.

### Catatan / risiko

- **`curl` di Git Bash mesin ini rusak untuk semua situs**, bukan cuma domain
  ini: ada env var yang menunjuk `CAfile: C:\Program Files\PostgreSQL\16\bin`,
  sehingga setiap HTTPS gagal dengan `error setting certificate verify
  locations`. Sempat terbaca seolah sertifikat produksi bermasalah, padahal
  sertifikatnya baik-baik saja. Uji domain dari server saja.
- **Reboot belum pernah diuji.** Konfigurasinya sudah benar di atas kertas;
  buktinya belum ada.
- **`SHARP_VERSION` dipatok manual di `deploy.sh`** (`0.34.5`). Ini akan basi
  diam-diam saat sharp naik versi.
- **Backup belum otomatis.** `DEPLOY.md` menaruhnya sebagai langkah manual
  sebelum tiap `--migrasi`. Untuk situs yang seluruh isinya satu berkas, cron
  harian yang menyalin keluar server layak menyusul — sekarang jadi mendesak
  karena `data/cc.db` di server sudah jadi satu-satunya salinan yang hidup.
- **6 vulnerabilities dari Sesi 1 masih belum diputuskan** — sekarang bukan lagi
  soal teoretis: kodenya sudah menghadap publik.
- **RAM 961 MB dengan 1 vCPU.** Aplikasinya duduk di ~90 MB, jadi lapang untuk
  sekarang, tapi tidak ada ruang untuk menjalankan build di server.

---

## 2026-08-11 — Sesi 7: Testimoni & sesi bisa disunting, pemulihan password

### Isi tiga halaman lama akhirnya masuk seed

Sesi 6 memindahkan **kolomnya** ke database, tapi tidak isinya: `waktu`, `ajakan*`,
`ajakanIsi*`, dan `testimoni` tidak pernah ditulis seeder, jadi database yang baru
di-seed memuat halaman detail yang setengah jadi — dan blok testimoni tidak pernah
muncul sama sekali karena dijaga `v-if="testimoni.length"`.

Isinya diangkat dari tiga berkas di `.arsip/` ke `server/db/seed.ts`. Testimoni hanya
diberikan ke `listening-as-leadership`, satu-satunya yang halaman lamanya memang
punya; empat event lain dibiarkan kosong karena mengarang kesaksian untuk acara yang
belum berjalan berarti menaruh testimoni palsu di halaman publik.

### Testimoni

`components/EventTestimoni.vue` — satu komponen untuk mode baca dan mode sunting,
bukan dua. Markup yang dibaca pengunjung dan yang disunting pengelola harus sama
persis, dan itu paling mudah dijamin kalau keduanya memang blok yang sama.

Setiap tindakan mengirim **seluruh daftar**, bukan satu barisnya: testimoni adalah
satu kolom JSON tanpa id per baris, jadi tidak ada yang bisa di-PATCH sepotong.
Urutannya digeser dengan tombol naik/turun — posisinya adalah indeks di dalam larik,
bukan kolom tersendiri.

Panel testimoni aslinya `height:530px` + `position:sticky`. Benar untuk daftar yang
hanya dibaca, tapi begitu ada kotak isian di dalamnya tombol Simpan terpotong dan
tidak bisa dicapai. Kelas `is-editing` melepas keduanya.

### Sesi bisa disunting di halaman event

Blok "Materi & dokumentasi" yang sama kini memperoleh tambah/ubah/hapus/geser untuk
sesi maupun isinya — termasuk **ubah item yang sudah dibuat**, yang endpointnya
(`PATCH /api/admin/sesi-item/[id]`) sudah ada sejak Sesi 5 tapi tidak pernah punya
antarmuka.

Formnya `components/SesiItemModal.vue`, dipakai bersama oleh penyuntingan di tempat
**dan** halaman `/admin/event/[id]` — yang sebelumnya punya salinan formnya sendiri.
Aturan bentuk form (jenis apa untuk bagian mana, mana yang butuh berkas, kapan
sakelar "khusus peserta" muncul) sekarang hanya ada di satu tempat.

Pemilih dari pustaka media ikut ditambahkan di form itu; sebelumnya setiap unggahan
selalu berkas baru.

**Baris pengaturan sesi jadi komponennya sendiri** (`SesiPengaturan.vue`) setelah
percobaan pertama menyimpannya sebagai `Record<id, draf>` di induk. Peta seperti itu
harus dijaga tetap selaras dengan daftar sesi setiap kali datanya dimuat ulang;
dengan satu komponen per sesi, drafnya hidup dan mati bersama sesinya lewat `:key`.

**Geser dibuat endpoint sendiri** (`POST …/geser`), bukan PATCH `urutan`. Klien jadi
tidak perlu tahu angka urutan tetangganya, dan pertukarannya dihitung dari keadaan
database saat itu juga. Yang ditulis bukan tukar dua nilai melainkan seluruh daftar
dinormalkan jadi 0..n-1: `urutan` tidak dijamin rapat maupun unik, dan pada dua baris
bernilai sama menukar nilainya tidak mengubah apa pun — tombolnya tampak rusak tanpa
galat sama sekali.

`GET /api/events/[slug]/sesi` kini mengirim sesi `tampil = false` **kepada pengelola**.
Tanpa itu, sesi yang baru saja disembunyikan lenyap dari layar dan tidak ada jalan
menampilkannya lagi selain lewat form admin.

### Pemulihan password

Akun di situs ini tidak pernah dibuat sendiri oleh pemakainya — semuanya didaftarkan
admin, passwordnya dikirim lewat WhatsApp. Artinya "lupa password lama" bukan kejadian
langka melainkan keadaan normal, sementara satu-satunya jalan keluar sebelum ini
adalah menghubungi admin yang juga tidak punya cara memasangkan yang baru.

Dua jalur:

| Jalur | Endpoint | Password lama |
|---|---|---|
| Pengelola memasangkan untuk orang lain | `POST /api/admin/users/[id]/password` | tidak pernah diminta |
| Ganti password sendiri | `POST /api/users/password` | **opsional** |

Yang kedua **melonggarkan perlindungan yang sebelumnya ada**, dan itu perlu tercatat:
password lama dulu diminta supaya perangkat yang tertinggal dalam keadaan masuk tidak
bisa dipakai orang lain mengunci pemiliknya keluar. Sekarang yang menjaga tinggal
sesinya sendiri. Ditukar secara sadar dengan alasan di paragraf atas; kalau situs ini
suatu saat dipakai di perangkat bersama, kembalikan kewajibannya dan sandarkan
pemulihan pada jalur admin yang sudah ada.

Yang diisi tetap diperiksa — menerimanya diam-diam akan membuat orang mengira password
lamanya benar padahal salah ketik.

**Penjagaan wewenang** ada di `server/utils/wewenang-akun.ts`: pengelola hanya boleh
menyentuh akun yang wewenangnya **benar-benar lebih rendah**, bukan setara. Dua admin
yang bisa saling mereset password berarti masing-masing memegang akun yang lain.
Master dikecualikan — tanpa itu master yang lupa passwordnya tidak bisa dipulihkan
siapa pun. Aturan yang sama dipakai tiga endpoint sekaligus, karena satu saja yang
lupa memeriksanya sudah cukup membuka jalan naik pangkat.

### `/admin/member/new` berhenti jadi mockup

Reset password butuh akun yang bisa dibuat, dan formnya masih menampilkan badge
"Tersimpan (mockup)" tanpa pernah menyentuh database. Kini `POST /api/admin/users` +
`PATCH /api/admin/users/[id]`, dengan username disusun otomatis dari email kalau
dikosongkan dan bentrokan diselesaikan lewat akhiran angka. Email bentrok **ditolak**,
bukan diberi akhiran: ia dipakai untuk masuk dan untuk mencocokkan pendaftaran tamu ke
akun.

Password akun baru ditampilkan terang-terangan — admin harus menyalinnya ke WhatsApp,
dan sesudah halaman ditinggalkan tidak ada tempat lain untuk membacanya.

### Dev server tidak lagi mendengarkan di 0.0.0.0

`devServer.host` dipatok ke `127.0.0.1`. Bind ke semua antarmuka memunculkan permintaan
izin firewall tiap kali server dijalankan, sekaligus membuka situs yang belum jadi bagi
siapa pun yang sejaringan. Untuk menguji dari ponsel: `npm run dev -- --host` sekali —
flag CLI menang atas nilai di config.

### Yang dikerjakan sesi ini

- [x] `waktu`, `ajakan*`, `ajakanIsi*`, `testimoni` masuk `seed.ts` dari `.arsip/`
- [x] `EventTestimoni.vue`: tambah, ubah, hapus, geser; baris kosong dibuang server
- [x] `EventResources.vue` jadi penyunting sesi sekaligus tampilan bacanya
- [x] `SesiItemModal.vue` dipakai bersama halaman publik & `/admin/event/[id]`
- [x] Ubah item yang sudah dibuat + pemilih pustaka media
- [x] `POST /api/admin/sesi/[id]/geser` & `…/sesi-item/[id]/geser`, urutan dinormalkan
- [x] Sesi tersembunyi terkirim ke pengelola, tetap disaring untuk pengunjung
- [x] `POST /api/admin/users/[id]/password` + `wewenang-akun.ts`
- [x] `passwordLama` jadi opsional + pilihan "Saya lupa password lama" di profil
- [x] `POST`/`PATCH /api/admin/users`; `/admin/member/[id]` menulis ke database
- [x] `devServer.host = 127.0.0.1`
- [x] Diuji: typecheck kembali persis ke baseline (33 galat lama, nol tambahan);
      28 pemeriksaan API; alur browser sungguhan (Chromium) untuk sunting di tempat,
      testimoni, sesi, dan pembuatan akun; mode baca tidak menyisakan satu pun
      penanda sunting di HTML pengunjung

### Catatan / risiko

**Ganti password sendiri tanpa password lama adalah pelonggaran yang disengaja.**
Lihat tabel di atas dan catatan panjang di `server/api/users/password.post.ts`.

**Sesi tidak dicabut setelah password direset.** Sesi disimpan di cookie terenkripsi,
bukan di tabel, jadi tidak ada daftar yang bisa dicabut. Perangkat yang sudah masuk
tetap masuk sampai cookienya kedaluwarsa.

**Menyeret untuk mengurutkan masih belum ada** — yang tersedia tombol naik/turun.
Untuk daftar sependek ini cukup, dan tombol tetap bisa dipakai lewat papan tik.

**Halaman publik selain detail event masih teks tetap di `.vue`** — sesuai permintaan,
tidak dikerjakan sesi ini.

**`.arsip/` masih berisi lima berkas.** Isinya sudah pindah ke database; lihat
pembahasan di bawah entri ini sebelum menghapusnya.

**Backlog Sesi 1 yang masih terbuka:** `.gitignore` sudah ada, `--port/` sudah tidak
ada di repo ini, tapi `tsconfig.json` masih belum ada (sehingga `npm run typecheck`
gagal dan harus dijalankan lewat `npx vue-tsc -p .nuxt/tsconfig.json`), dua lockfile
masih berdampingan, dan 33 galat tipe lama belum disentuh.

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
