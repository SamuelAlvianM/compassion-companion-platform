#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# tunnel-setup.sh — Buat Cloudflare Tunnel untuk compassionate-companion.com.
#
# Jalankan SEKALI dari MESIN LOKAL (bukan di server), setelah:
#   1. `cloudflared tunnel login` sukses (~/.cloudflared/cert.pem ada), dan
#   2. `bash /root/server-setup.sh` sudah jalan di server.
#
#   bash deploy/tunnel-setup.sh
#
# Kenapa tunnel dibuat dari lokal, bukan di server: pembuatan tunnel dan
# penulisan DNS butuh cert.pem — kredensial tingkat akun yang bisa menyentuh
# seluruh zona. Yang perlu ada di server hanya credentials JSON milik satu
# tunnel ini. cert.pem tidak pernah ikut tersalin ke sana.
# ---------------------------------------------------------------------------

NAMA_TUNNEL="${NAMA_TUNNEL:-ccwebsite}"
DOMAIN="${DOMAIN:-compassionate-companion.com}"
REMOTE="${REMOTE:-cc}"
PORT_APP="${PORT_APP:-3010}"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${GREEN}[tunnel]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
err()  { echo -e "${RED}[error]${NC} $*"; exit 1; }

CERT="$HOME/.cloudflared/cert.pem"
[[ -f "$CERT" ]] || err "$CERT tidak ada. Jalankan dulu: cloudflared tunnel login"

# ── Buat tunnel (kalau belum ada) ────────────────────────────────────────────
# node dipakai untuk membaca JSON-nya, bukan grep: nama tunnel bisa jadi
# substring nama tunnel lain, dan yang dicari di sini kecocokan persis.
cari_uuid() {
  cloudflared tunnel list --output json 2>/dev/null \
    | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const t=(JSON.parse(s||'[]')).find(x=>x.name===process.argv[1]);if(t)console.log(t.id)})" "$NAMA_TUNNEL"
}

UUID="$(cari_uuid)"
if [[ -n "$UUID" ]]; then
  warn "Tunnel '$NAMA_TUNNEL' sudah ada — dipakai ulang."
else
  log "Buat tunnel '$NAMA_TUNNEL'..."
  cloudflared tunnel create "$NAMA_TUNNEL"
  UUID="$(cari_uuid)"
fi
[[ -n "$UUID" ]] || err "UUID tunnel tidak ketemu."
log "UUID: $UUID"

KREDENSIAL="$HOME/.cloudflared/$UUID.json"
[[ -f "$KREDENSIAL" ]] || err "Kredensial $KREDENSIAL tidak ada."

# ── DNS ──────────────────────────────────────────────────────────────────────
# CNAME <UUID>.cfargotunnel.com, proxied. Tidak ada A record ke 104.64.212.19:
# IP origin tidak pernah muncul di DNS publik.
log "Arahkan DNS $DOMAIN dan www.$DOMAIN ke tunnel..."
cloudflared tunnel route dns --overwrite-dns "$NAMA_TUNNEL" "$DOMAIN"
cloudflared tunnel route dns --overwrite-dns "$NAMA_TUNNEL" "www.$DOMAIN"

# ── Kirim kredensial + config ke server ──────────────────────────────────────
log "Kirim kredensial tunnel ke server..."
ssh "$REMOTE" "mkdir -p /etc/cloudflared && chmod 700 /etc/cloudflared"
scp -q "$KREDENSIAL" "$REMOTE:/etc/cloudflared/$UUID.json"
ssh "$REMOTE" "chmod 600 /etc/cloudflared/$UUID.json"

log "Tulis /etc/cloudflared/config.yml..."
ssh "$REMOTE" "cat > /etc/cloudflared/config.yml" <<ENDCONF
tunnel: $UUID
credentials-file: /etc/cloudflared/$UUID.json

ingress:
  - hostname: $DOMAIN
    service: http://127.0.0.1:$PORT_APP
  - hostname: www.$DOMAIN
    service: http://127.0.0.1:$PORT_APP
  # Aturan terakhir wajib ada dan wajib tanpa hostname: apa pun yang tidak
  # cocok di atas ditolak di sini, bukan diteruskan ke aplikasi.
  - service: http_status:404
ENDCONF

log "Pasang cloudflared sebagai service systemd..."
ssh "$REMOTE" bash <<'ENDSSH'
  set -euo pipefail
  # `service install` gagal kalau service-nya sudah terpasang; hapus dulu supaya
  # skrip ini aman dijalankan ulang.
  cloudflared service uninstall >/dev/null 2>&1 || true
  cloudflared service install
  systemctl enable --now cloudflared
  sleep 3
  systemctl is-active cloudflared
  journalctl -u cloudflared -n 15 --no-pager
ENDSSH

log "Selesai. Tunggu DNS menyebar, lalu cek https://$DOMAIN"
