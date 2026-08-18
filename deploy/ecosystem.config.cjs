// Konfigurasi PM2 untuk compassionate-companion.com di 104.64.212.19.
//
// Secret dibaca dari process.env — di-source dari deploy/.env oleh deploy.sh.
// JANGAN hardcode nilai asli di sini: berkas ini ikut ke git.
//
// cwd sengaja ~/ccwebsite, bukan ~/ccwebsite/.output. server/db/index.ts
// me-resolve DATABASE_URL terhadap process.cwd(), jadi `./data/cc.db` menunjuk
// ke ~/ccwebsite/data/cc.db — di luar .output/ yang ditimpa tiap rilis.
//
// PORT 3010 hanya didengarkan di loopback (HOST 127.0.0.1). Yang menghadap
// publik adalah cloudflared, bukan Nitro — lihat deploy/DEPLOY.md bagian tunnel.
module.exports = {
  apps: [
    {
      name: 'ccwebsite',
      script: '.output/server/index.mjs',
      cwd: '/root/ccwebsite',
      instances: 1,
      exec_mode: 'fork',
      // SQLite better-sqlite3 memegang satu berkas dengan kunci tingkat proses.
      // Cluster mode / instances > 1 berarti beberapa proses menulis ke berkas
      // yang sama — WAL memang mengizinkan, tapi tidak ada alasan mengambil
      // risikonya untuk situs sekecil ini.
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3010,
        HOST: '127.0.0.1',
        DATABASE_URL: process.env.DATABASE_URL || './data/cc.db',
        NUXT_SESSION_PASSWORD: process.env.NUXT_SESSION_PASSWORD,
        // Ikut masuk ke hash yang membedakan pengunjung. Boleh kosong — kodenya
        // jatuh ke nilai acak per proses — tapi kalau kosong, hitungan "berapa
        // orang" terpecah setiap kali PM2 me-restart app di tengah hari.
        NUXT_KUNJUNGAN_SECRET: process.env.NUXT_KUNJUNGAN_SECRET,
      },
    },
  ],
}
