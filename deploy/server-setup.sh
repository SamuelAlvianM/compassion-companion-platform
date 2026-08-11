#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# server-setup.sh — Penyiapan SEKALI SAJA di 104.64.212.19.
#
# Dijalankan DI SERVER, bukan di mesin lokal:
#   scp deploy/server-setup.sh cc:/root/
#   ssh cc 'bash /root/server-setup.sh'
#
# Memasang: Node.js 22 LTS, PM2 (+ systemd startup), cloudflared.
# Idempoten — aman dijalankan ulang.
#
# TIDAK memasang nginx dan TIDAK membuka port 80/443. Yang menghadap publik
# adalah cloudflared; Nitro hanya mendengarkan 127.0.0.1:3010.
# ---------------------------------------------------------------------------

GREEN='\033[0;32m'; NC='\033[0m'
log() { echo -e "${GREEN}[setup]${NC} $*"; }

log "Update indeks paket..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg lsb-release ufw

# ── Node.js 22 LTS ───────────────────────────────────────────────────────────
# Node 22 dipilih supaya cocok dengan `engines` Nuxt 4 dan prebuild
# better-sqlite3 (NODE_MODULE_VERSION 127) yang ikut di .output.
if ! command -v node >/dev/null || [[ "$(node -v | cut -d. -f1)" != "v22" ]]; then
  log "Pasang Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi
log "node $(node -v) / npm $(npm -v)"

# ── PM2 ──────────────────────────────────────────────────────────────────────
if ! command -v pm2 >/dev/null; then
  log "Pasang PM2..."
  npm install -g pm2 >/dev/null
fi
log "Daftarkan PM2 ke systemd (app hidup lagi setelah reboot)..."
pm2 startup systemd -u root --hp /root >/dev/null || true

# ── cloudflared ──────────────────────────────────────────────────────────────
if ! command -v cloudflared >/dev/null; then
  log "Pasang cloudflared..."
  mkdir -p --mode=0755 /usr/share/keyrings
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
    | tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
  echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" \
    > /etc/apt/sources.list.d/cloudflared.list
  apt-get update -qq
  apt-get install -y -qq cloudflared
fi
log "cloudflared $(cloudflared --version 2>&1 | head -1)"

# ── Firewall ─────────────────────────────────────────────────────────────────
# cloudflared membuka koneksi KELUAR ke Cloudflare, jadi tidak ada port masuk
# yang perlu dibuka untuk web. Hanya SSH.
log "Firewall: izinkan SSH saja..."
ufw allow OpenSSH >/dev/null
ufw --force enable >/dev/null
ufw status verbose

log "Selesai. Lanjut: buat tunnel dari mesin lokal (deploy/tunnel-setup.sh)."
