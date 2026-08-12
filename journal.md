# Journal — Compassionate Companion Website

Catatan kerja untuk project di `C:\sam\COSMOS\ccwebsite`.
Format: entri terbaru di atas. Setiap sesi kerja tambahkan satu blok.

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
