#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# deploy.sh — Deploy ccwebsite ke 104.64.212.19 (compassionate-companion.com)
#
# Jalankan dari root repo:
#   bash deploy/deploy.sh [--skip-build] [--migrasi] [--kirim-db]
#
# Yang dikirim adalah `.output` hasil `nuxt build` — bundle Nitro yang sudah
# self-contained. Server tidak menjalankan `npm install` dan tidak perlu punya
# source code. BUKAN git push.
#
#   --skip-build : pakai .output yang sudah ada (jangan build ulang)
#   --migrasi    : jalankan migrasi drizzle di server (saat skema berubah)
#   --kirim-db   : kirim isi database lokal ke server. HANYA untuk deploy
#                  pertama — menolak jalan kalau server sudah punya database,
#                  karena menimpanya berarti menghapus seluruh data produksi.
# ---------------------------------------------------------------------------

REMOTE="${REMOTE:-cc}"                 # override: REMOTE=root@104.64.212.19 bash deploy/deploy.sh
REMOTE_DIR="${REMOTE_DIR:-/root/ccwebsite}"
SHARP_VERSION="0.34.5"                 # samakan dengan versi sharp di node_modules lokal

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

SKIP_BUILD=false
MIGRASI=false
KIRIM_DB=false
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    --migrasi)    MIGRASI=true ;;
    --kirim-db)   KIRIM_DB=true ;;
    *) echo "Flag tidak dikenal: $arg" >&2; exit 1 ;;
  esac
done

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${GREEN}[deploy]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
err()  { echo -e "${RED}[error]${NC} $*"; exit 1; }

[[ -f "$SCRIPT_DIR/.env" ]] || err "deploy/.env tidak ada. Salin dari deploy/.env.example lalu isi."

# NUXT_SESSION_PASSWORD kosong = server/utils/session.ts menolak jalan. Lebih
# baik gagal di sini daripada setelah .output terkirim dan PM2 crash-loop.
# shellcheck disable=SC1091
set -a; source "$SCRIPT_DIR/.env"; set +a
[[ -n "${NUXT_SESSION_PASSWORD:-}" ]] || err "NUXT_SESSION_PASSWORD kosong di deploy/.env"
[[ ${#NUXT_SESSION_PASSWORD} -ge 32 ]] || err "NUXT_SESSION_PASSWORD harus minimal 32 karakter (sekarang ${#NUXT_SESSION_PASSWORD})."

# ============================================================
# BUILD
# ============================================================
if [[ "$SKIP_BUILD" == false ]]; then
  log "=== BUILD ==="
  ( cd "$ROOT_DIR" && npm run build ) || err "build gagal"
else
  warn "Build di-skip (--skip-build) — pakai .output yang ada."
fi
[[ -d "$ROOT_DIR/.output" ]] || err ".output tidak ada. Build dulu (jangan pakai --skip-build)."

# ============================================================
# TRANSFER .output
# ============================================================
log "=== TRANSFER ==="
log "[1/5] Kirim .output..."
# -h (dereference) WAJIB. Nitro men-dedupe beberapa paket lewat symlink ke
# node_modules/.nitro/<paket>@<versi>, dan target symlink-nya ABSOLUT — di sini
# berisi path Windows (/c/sam/COSMOS/...). Tanpa -h, tar mengirim symlink-nya
# apa adanya dan di server semuanya menggantung: app start lalu langsung mati
# dengan `Cannot find module 'entities/decode'`.
#
# .output di server dihapus dulu supaya symlink menggantung dari rilis lama
# tidak tertinggal — tar tidak menimpa symlink dengan direktori.
# Aman: seluruh data produksi ada di ~/ccwebsite/data, di luar .output.
tar czhf - -C "$ROOT_DIR" .output \
  | ssh "$REMOTE" "mkdir -p '$REMOTE_DIR' && rm -rf '$REMOTE_DIR/.output' && tar xzf - -C '$REMOTE_DIR'"

log "[2/5] Kirim ecosystem.config.cjs, .env, migrate.mjs, migrasi SQL..."
scp -q "$SCRIPT_DIR/ecosystem.config.cjs" "$REMOTE:$REMOTE_DIR/"
scp -q "$SCRIPT_DIR/.env"                 "$REMOTE:$REMOTE_DIR/"
scp -q "$SCRIPT_DIR/migrate.mjs"          "$REMOTE:$REMOTE_DIR/.output/server/"
ssh "$REMOTE" "mkdir -p '$REMOTE_DIR/server/db'"
tar czf - -C "$ROOT_DIR/server/db" migrations \
  | ssh "$REMOTE" "tar xzf - -C '$REMOTE_DIR/server/db'"

# ============================================================
# SHARP untuk linux
# ============================================================
# Nitro hanya ikut menyertakan binary sharp untuk arsitektur mesin yang
# mem-build — di sini win32-x64, dan build memang memperingatkan soal itu.
# Tanpa langkah ini @nuxt/image mati begitu ada permintaan gambar pertama.
#
# better-sqlite3 TIDAK butuh perlakuan yang sama: paketnya mengirim prebuild
# untuk semua platform sekaligus (linux-x64 sudah ikut di .output).
log "[3/5] Pasang sharp linux-x64 di server..."
ssh "$REMOTE" bash <<ENDSSH
  set -euo pipefail
  mkdir -p "$REMOTE_DIR/sharp-linux"
  cd "$REMOTE_DIR/sharp-linux"
  # Nama folder sengaja tanpa titik di depan: npm menolak nama paket yang
  # diawali titik, dan \`npm init -y\` memakai nama folder sebagai nama paket.
  [[ -f package.json ]] || npm init -y >/dev/null
  npm install --omit=dev --no-audit --no-fund "@img/sharp-linux-x64@$SHARP_VERSION" >/dev/null
  mkdir -p "$REMOTE_DIR/.output/server/node_modules/@img"
  cp -r node_modules/@img/. "$REMOTE_DIR/.output/server/node_modules/@img/"
  ls "$REMOTE_DIR/.output/server/node_modules/@img"
ENDSSH

# ============================================================
# DATABASE
# ============================================================
if [[ "$KIRIM_DB" == true ]]; then
  log "[4/5] Kirim database awal..."
  # Menolak sebelum apa pun terkirim. Database produksi memuat seluruh isi
  # situs termasuk media (disimpan sebagai BLOB di cc_media_*), jadi menimpanya
  # bukan "reset" melainkan kehilangan data yang tidak ada salinannya di repo.
  if ssh "$REMOTE" "test -f '$REMOTE_DIR/data/cc.db'"; then
    err "Server sudah punya $REMOTE_DIR/data/cc.db. --kirim-db hanya untuk deploy pertama.
     Kalau memang mau menimpanya, backup dulu di server lalu hapus berkasnya secara manual."
  fi
  ( cd "$ROOT_DIR" && node deploy/snapshot-db.mjs ) || err "snapshot database gagal"
  ssh "$REMOTE" "mkdir -p '$REMOTE_DIR/data'"
  scp -q "$SCRIPT_DIR/cc.db.snapshot" "$REMOTE:$REMOTE_DIR/data/cc.db"
  rm -f "$SCRIPT_DIR/cc.db.snapshot"
  log "    Database awal terkirim."
elif [[ "$MIGRASI" == true ]]; then
  log "[4/5] Jalankan migrasi di server..."
  ssh "$REMOTE" "cd '$REMOTE_DIR' && set -a && source .env && set +a && node .output/server/migrate.mjs"
else
  warn "[4/5] Database tidak disentuh (tambah --migrasi kalau skema berubah)."
fi

# ============================================================
# RESTART PM2
# ============================================================
log "[5/5] Restart PM2..."
ssh "$REMOTE" bash <<ENDSSH
  set -euo pipefail
  cd "$REMOTE_DIR"
  set -a; source .env; set +a
  command -v pm2 >/dev/null || npm install -g pm2
  pm2 startOrRestart ecosystem.config.cjs --env production
  pm2 save
  pm2 status
ENDSSH

# Smoke test dari sisi server: Nitro listen di loopback, jadi ini satu-satunya
# tempat yang bisa mengeceknya tanpa lewat tunnel.
#
# Dicoba berulang, bukan sekali. PM2 melaporkan "online" begitu prosesnya
# ter-spawn, sementara Nitro baru mengikat port satu-dua detik kemudian — sekali
# curl langsung sesudah restart selalu gagal walau deploy-nya sukses, dan
# kegagalan palsu seperti itu melatih orang mengabaikan hasil smoke test.
log "Cek origin di server (127.0.0.1:3010)..."
ssh "$REMOTE" bash <<'ENDSSH'
  # Yang diterima HANYA 2xx/3xx.
  #
  # Sebelumnya syaratnya "bukan 000", dan itu meloloskan deploy yang gagal: saat
  # origin belum siap, curl menulis 000 ke stdout DAN keluar dengan status bukan-nol,
  # sehingga `|| echo 000` ikut jalan dan $kode berisi "000000". Nilai itu memang
  # bukan "000", jadi penjaganya lolos, loop tunggunya putus di detik pertama, dan
  # deploy dilaporkan sukses tanpa origin pernah menjawab sekali pun.
  #
  # Mencocokkan dengan pola sukses, bukan dengan satu nilai gagal, membuat setiap
  # keadaan tak terduga jatuh ke sisi "belum siap" — termasuk 000000 itu sendiri,
  # dan termasuk 500 dari aplikasi yang start lalu mati.
  for i in $(seq 1 20); do
    kode=$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3010/ 2>/dev/null || true)
    if [[ "$kode" =~ ^[23][0-9][0-9]$ ]]; then
      echo "HTTP $kode setelah ${i}s"
      exit 0
    fi
    sleep 1
  done
  echo "TIDAK MERESPONS SEHAT setelah 20s (kode terakhir: ${kode:-kosong}) — cek: pm2 logs ccwebsite --lines 50"
  exit 1
ENDSSH

log "Deploy selesai. Cek https://compassionate-companion.com"
