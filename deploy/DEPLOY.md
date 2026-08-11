# Panduan Deploy — Compassionate Companion

| | |
|---|---|
| Domain | `compassionate-companion.com` (+ `www`) |
| Server | `104.64.212.19`, user `root`, alias SSH `cc` |
| Direktori | `/root/ccwebsite` |
| Port aplikasi | `3010`, **hanya di `127.0.0.1`** |
| Publik lewat | Cloudflare Tunnel (`cloudflared`), **bukan** nginx |
| Database | SQLite satu berkas: `/root/ccwebsite/data/cc.db` |
| Proses | PM2, app `ccwebsite`, systemd startup |

Deploy mengirim `.output` hasil `nuxt build` lewat SSH — **bukan git push**.
Server tidak menjalankan `npm install` dan tidak menyimpan source code.

---

## Bentuk yang dideploy

`nuxt build` menghasilkan `.output` yang self-contained: Nitro sudah membundel
dependensi, termasuk `better-sqlite3` dan `drizzle-orm` di
`.output/server/node_modules`. Karena itu server cukup menerima folder itu lalu
`pm2 restart`.

Dua dependensi native, dua nasib berbeda:

- **better-sqlite3** — aman. Paketnya membawa prebuild untuk semua platform
  sekaligus (`linux-x64` sudah ikut walau build-nya di Windows).
- **sharp** — tidak aman. Nitro hanya ikut menyertakan binary untuk arsitektur
  mesin yang mem-build, dan build memang memperingatkan
  `sharp binaries have been included for win32-x64`. `deploy.sh` menambalnya
  dengan memasang `@img/sharp-linux-x64` **di server** lalu menyalinnya ke
  `.output/server/node_modules/@img/`. Tanpa itu `@nuxt/image` mati pada
  permintaan gambar pertama.

Kalau versi `sharp` di `package.json` naik, ubah juga `SHARP_VERSION` di
`deploy/deploy.sh`.

### `tar -h` bukan opsional

Nitro men-dedupe sebagian paket lewat symlink ke
`node_modules/.nitro/<paket>@<versi>`, dan **target symlink-nya absolut** —
di-build di Windows berarti isinya `/c/sam/COSMOS/ccwebsite/...`. Tanpa `-h`
(dereference), `tar` mengirim symlink apa adanya dan di server ketiganya
(`entities`, `css-tree`, `mdn-data`) menggantung. Gejalanya app start lalu
langsung mati:

```
Error: Cannot find module 'entities/decode'
```

`deploy.sh` juga `rm -rf .output` di server sebelum extract, karena `tar` tidak
menimpa symlink lama dengan direktori. Aman — seluruh data produksi ada di
`~/ccwebsite/data`, di luar `.output`.

## Kenapa cwd PM2 bukan `.output`

`server/db/index.ts` me-resolve `DATABASE_URL` terhadap `process.cwd()`. PM2
dijalankan dengan `cwd: /root/ccwebsite`, jadi `./data/cc.db` menunjuk ke
`/root/ccwebsite/data/cc.db` — **di luar** `.output/` yang ditimpa setiap rilis.
Kalau database ada di dalam `.output`, deploy berikutnya akan menghapusnya.

---

## 1. Rahasia produksi (WAJIB, sekali)

```bash
cp deploy/.env.example deploy/.env
```

Isi `NUXT_SESSION_PASSWORD` dengan nilai acak baru — **jangan** menyalin dari
`.env` pengembangan:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`server/utils/session.ts` menolak jalan kalau kosong, dan `deploy.sh` memeriksa
panjangnya sebelum mengirim apa pun.

## 2. Akses SSH (sekali)

Kunci yang dipakai: **`~/.ssh/id_rsa`** (RSA 3072, `Viole@MSI`,
`SHA256:GbwRHpj1rdt1RyBYq4xip2IoGzcyJw5HFaO7NEvdIc4`). Pasang ke server:

```bash
ssh-copy-id -i ~/.ssh/id_rsa.pub root@104.64.212.19
```

Blok `Host cc` sudah ada di `~/.ssh/config`. Uji:

```bash
ssh cc 'hostname && uname -a'
```

## 3. Bootstrap server (sekali)

Memasang Node 22, PM2 (+ systemd), cloudflared, dan ufw (hanya SSH terbuka):

```bash
scp deploy/server-setup.sh cc:/root/ && ssh cc 'bash /root/server-setup.sh'
```

## 4. Deploy pertama

```bash
bash deploy/deploy.sh --kirim-db
```

`--kirim-db` mengangkut isi database lokal ke server. Itu memang cara konten
sampai ke produksi: **media disimpan sebagai BLOB di dalam SQLite**
(`cc_media_gambar`/`_video`/`_etc`), bukan sebagai berkas di `public/`, jadi
tidak ada folder upload yang perlu di-rsync — database adalah seluruh isi situs.

Yang dikirim bukan `cp data/cc.db` melainkan hasil `VACUUM INTO`
(`deploy/snapshot-db.mjs`). Database jalan dalam mode WAL: tulisan terbaru ada di
`cc.db-wal` dan belum tentu sudah masuk ke `cc.db`. Menyalin `cc.db` mentah
berarti mengirim database yang kehilangan perubahan terakhir, tanpa error.

`--kirim-db` **menolak jalan kalau server sudah punya `data/cc.db`**. Menimpanya
bukan "reset" melainkan menghapus data yang tidak punya salinan di repo.

## 5. Tunnel + DNS (sekali)

```bash
cloudflared tunnel login          # sudah dilakukan → ~/.cloudflared/cert.pem
bash deploy/tunnel-setup.sh
```

Membuat tunnel `ccwebsite`, menulis CNAME `compassionate-companion.com` dan
`www` ke `<uuid>.cfargotunnel.com` (proxied), mengirim credentials JSON ke
`/etc/cloudflared/`, lalu memasang service systemd.

**Tidak ada A record ke `104.64.212.19`.** IP origin tidak pernah muncul di DNS
publik, dan port 80/443 di server tetap tertutup — cloudflared yang membuka
koneksi keluar ke Cloudflare, bukan sebaliknya.

`cert.pem` (kredensial tingkat akun, bisa menyentuh seluruh zona) tetap di mesin
lokal. Yang ada di server hanya credentials satu tunnel ini.

---

## Deploy rutin

```bash
bash deploy/deploy.sh
```

Build → kirim `.output` → tambal sharp → restart PM2. Database tidak disentuh.

**Saat skema berubah** (ada berkas baru di `server/db/migrations/`):

```bash
bash deploy/deploy.sh --migrasi
```

Migrasi dijalankan `deploy/migrate.mjs` di server, memakai `drizzle-orm`
runtime migrator — bukan `drizzle-kit push`. Migrator runtime hanya menjalankan
`.sql` yang sudah ada dan mencatatnya di `__drizzle_migrations`; ia tidak pernah
membandingkan skema lalu bertanya interaktif seperti `push`, yang tanpa TTY bisa
gagal diam-diam.

Alur normal saat mengubah skema:

```bash
npm run db:generate          # bikin .sql baru di server/db/migrations
git add server/db/migrations && git commit
bash deploy/deploy.sh --migrasi
```

Flag lain: `--skip-build` (pakai `.output` yang ada).

---

## Backup

Seluruh situs ada di satu berkas. Ambil snapshot yang sudah menyertakan WAL:

```bash
ssh cc "cd /root/ccwebsite && sqlite3 data/cc.db \"VACUUM INTO '/root/backup-\$(date +%F).db'\""
scp cc:/root/backup-*.db ./backup/
```

Kalau `sqlite3` belum ada: `ssh cc 'apt-get install -y sqlite3'`.

Lakukan **sebelum** setiap `--migrasi`. Migrasi SQLite yang mengubah tabel tidak
punya rollback otomatis.

## Smoke test pasca-deploy

- [ ] `ssh cc 'pm2 status'` → `ccwebsite` **online**, restart tidak naik terus
- [ ] `ssh cc 'systemctl is-active cloudflared'` → `active`
- [ ] `ssh cc 'curl -sI http://127.0.0.1:3010/'` → `302` ke `/id`
- [ ] `https://compassionate-companion.com` → redirect ke `/id`, halaman tampil
- [ ] `/en` tampil, ganti bahasa tidak mengosongkan konten
- [ ] Satu halaman event terbuka, gambarnya muncul (bukti sharp + media BLOB oke)
- [ ] Login master → `/admin` → daftar member tampil
- [ ] Unggah satu gambar di admin → muncul → masih ada setelah deploy berikutnya

## Kalau bermasalah

```bash
ssh cc 'pm2 logs ccwebsite --lines 50'          # error aplikasi
ssh cc 'journalctl -u cloudflared -n 50'        # tunnel
ssh cc 'ls .output/server/node_modules/@img'    # harus ada sharp-linux-x64
```

Gejala yang sudah bisa ditebak sebabnya:

| Gejala | Sebab |
|---|---|
| PM2 crash-loop saat start | `NUXT_SESSION_PASSWORD` kosong/tidak ter-source |
| `Cannot find module 'entities/decode'` | `.output` dikirim tanpa `tar -h` — symlink Nitro menggantung |
| `SQLITE_CANTOPEN` | cwd PM2 salah, atau `data/` tidak ada |
| Gambar 500, halaman lain normal | sharp linux belum tersalin |
| `502` dari Cloudflare | app mati, atau port di `config.yml` ≠ 3010 |
| Data hilang setelah deploy | database ada di dalam `.output` — pindahkan keluar |

### Catatan mesin lokal

`curl` di Git Bash mesin ini gagal TLS untuk **semua** situs:

```
error setting certificate verify locations: CAfile: C:\Program Files\PostgreSQL\16\bin
```

Ada env var (`CURL_CA_BUNDLE`/`SSL_CERT_FILE`) yang menunjuk ke folder bin
PostgreSQL. Itu masalah mesin lokal, **bukan** server — mudah disalahartikan
sebagai sertifikat produksi yang rusak. Uji domain dari server saja:

```bash
ssh cc 'curl -sSI https://compassionate-companion.com/id'
```

## Checklist

- [ ] `deploy/.env` terisi, `NUXT_SESSION_PASSWORD` ≥ 32 karakter & beda dari dev
- [ ] `ssh cc` jalan tanpa password
- [ ] `server-setup.sh` sukses (node 22, pm2, cloudflared, ufw hanya SSH)
- [ ] `deploy.sh --kirim-db` sukses
- [ ] `tunnel-setup.sh` sukses, `cloudflared` active
- [ ] Smoke test lolos
- [ ] Backup pertama diambil
