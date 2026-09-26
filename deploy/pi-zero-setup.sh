#!/bin/bash
# ─────────────────────────────────────────────────────────
# Raspberry Pi Zero 2 W / Pi 3B+ setup script
# ─────────────────────────────────────────────────────────
#
# Optimized for low-RAM boards (512MB–1GB). Key differences
# from pi-setup.sh:
#   - Uses epiphany (GNOME Web) instead of Chromium (~150MB less RAM)
#   - Enables LIGHTWEIGHT_MODE for longer sync/poll intervals
#   - Configures 256MB swap to prevent OOM
#   - Installs Node.js 24 LTS on 64-bit OS, Debian's security-patched
#     Node.js 20 on 32-bit trixie (NodeSource has no maintained armhf build;
#     32-bit bookworm's nodejs is too old, so the script stops there)
#
# Requirements:
#   - Raspberry Pi Zero 2 W, Pi 3B/3B+, or Pi 4 (1GB)
#   - Raspberry Pi OS Lite, 64-bit recommended (32-bit only on a trixie-based image)
#
# Run on a fresh install:
#
#   curl -fsSL https://raw.githubusercontent.com/CleverTrou/family-calendar/main/deploy/pi-zero-setup.sh | sudo bash
#
# Or if you've already cloned the repo:
#
#   sudo ./deploy/pi-zero-setup.sh
#
# After running, edit .env with your credentials and reboot.

set -euo pipefail

# ── 0. Detect current user (the one who ran sudo) ─────
PI_USER="${SUDO_USER:-$(logname 2>/dev/null || echo pi)}"
PI_HOME=$(eval echo "~$PI_USER")
REPO_DIR="$PI_HOME/family-calendar"
REPO_URL="https://github.com/CleverTrou/family-calendar.git"

echo "═══ Family Calendar Pi Zero/3 Setup ═══"
echo ""
echo "  User:  $PI_USER"
echo "  Home:  $PI_HOME"
echo "  Repo:  $REPO_DIR"
echo ""

# ── 1. System updates ──────────────────────────────────
echo "→ Updating system packages..."
apt update && apt upgrade -y

# ── 2. Swap file (critical for 512MB boards) ──────────
SWAP_FILE="/var/swap"
SWAP_SIZE=256  # MB
if [ ! -f "$SWAP_FILE" ] || [ "$(stat -c%s "$SWAP_FILE" 2>/dev/null || echo 0)" -lt $((SWAP_SIZE * 1024 * 1024)) ]; then
  echo "→ Configuring ${SWAP_SIZE}MB swap..."
  # Disable existing swap first
  swapoff "$SWAP_FILE" 2>/dev/null || true
  dd if=/dev/zero of="$SWAP_FILE" bs=1M count=$SWAP_SIZE status=none
  chmod 600 "$SWAP_FILE"
  mkswap "$SWAP_FILE" >/dev/null
  swapon "$SWAP_FILE"
  # Persist across reboots
  if ! grep -q "$SWAP_FILE" /etc/fstab; then
    echo "$SWAP_FILE none swap sw 0 0" >> /etc/fstab
  fi
  echo "  Swap active: ${SWAP_SIZE}MB"
else
  echo "  Swap already configured"
fi

# Lower swappiness — only use swap under real pressure
sysctl vm.swappiness=10 >/dev/null
grep -q "vm.swappiness" /etc/sysctl.conf 2>/dev/null || echo "vm.swappiness=10" >> /etc/sysctl.conf

# ── 3. Display stack (lightweight: epiphany instead of Chromium) ──
echo "→ Installing display stack (lightweight)..."

# Prefer epiphany (GNOME Web) — much lower memory than Chromium.
# Falls back to Chromium if epiphany isn't available.
BROWSER_PKG="epiphany-browser"
if ! apt-cache policy "$BROWSER_PKG" 2>/dev/null | grep -q "Candidate:" || \
   apt-cache policy "$BROWSER_PKG" 2>/dev/null | grep -q "Candidate: (none)"; then
  # Fall back to Chromium
  BROWSER_PKG="chromium"
  if apt-cache policy chromium-browser 2>/dev/null | grep -q "Candidate:" && \
     ! apt-cache policy chromium-browser 2>/dev/null | grep -q "Candidate: (none)"; then
    BROWSER_PKG="chromium-browser"
  fi
fi
echo "  Using browser package: $BROWSER_PKG"

apt install -y \
  "$BROWSER_PKG" \
  xserver-xorg \
  x11-xserver-utils \
  xinit \
  openbox \
  unclutter \
  lightdm \
  git \
  curl

# ── 4. Node.js ────────────────────────────────────────
MIN_NODE=20.18.1   # node-cron >=20, undici >=20.18.1
if ! command -v node &>/dev/null; then
  # 64-bit: NodeSource's Node 24 LTS (supported to April 2028). 32-bit (armhf):
  # NodeSource never built 24 and stopped updating 22 at 22.15, so use Debian's
  # own nodejs instead. Debian backports security fixes, and unattended-upgrades
  # applies them automatically, but only trixie (13) ships a new enough one:
  # bookworm's is 18.19. Check the candidate *before* installing it.
  ARCH=$(dpkg --print-architecture)
  NODE_PKGS=nodejs   # NodeSource's nodejs bundles npm
  if [ "$ARCH" = "arm64" ] || [ "$ARCH" = "amd64" ]; then
    echo "→ Installing Node.js 24 LTS from NodeSource ($ARCH)..."
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  else
    CANDIDATE=$(apt-cache policy nodejs | awk '/Candidate:/ {print $2}')
    if [ -z "$CANDIDATE" ] || [ "$CANDIDATE" = "(none)" ] \
       || ! dpkg --compare-versions "$CANDIDATE" ge "$MIN_NODE"; then
      echo "ERROR: $ARCH has no maintained NodeSource build, and Debian's nodejs here" >&2
      echo "  (${CANDIDATE:-none}) is older than this app's minimum, $MIN_NODE." >&2
      echo "  Use Raspberry Pi OS Lite (64-bit), or a 32-bit image based on Debian 13 (trixie)." >&2
      exit 1
    fi
    echo "→ Installing Debian's Node.js $CANDIDATE ($ARCH has no maintained NodeSource build)..."
    NODE_PKGS="nodejs npm"   # Debian packages npm separately
  fi
  apt install -y $NODE_PKGS
fi
NODE_VERSION=$(node -p process.versions.node)
if ! dpkg --compare-versions "$NODE_VERSION" ge "$MIN_NODE"; then
  # An existing install is left alone above, so it can be too old.
  echo "ERROR: Node.js $NODE_VERSION is below this app's minimum, $MIN_NODE." >&2
  echo "  Remove it (sudo apt remove nodejs) and re-run this script." >&2
  exit 1
fi
NODE_VER=$(node --version)
echo "  Node.js $NODE_VER installed"

# ── 5. Clone or update the repo ───────────────────────
if [ -d "$REPO_DIR/.git" ]; then
  echo "→ Updating existing repo..."
  cd "$REPO_DIR"
  sudo -u "$PI_USER" git pull --ff-only
else
  echo "→ Cloning family-calendar repo..."
  sudo -u "$PI_USER" git clone "$REPO_URL" "$REPO_DIR"
  cd "$REPO_DIR"
fi

# ── 6. Install npm dependencies ───────────────────────
echo "→ Installing npm dependencies..."
cd "$REPO_DIR"
sudo -u "$PI_USER" npm ci --omit=dev   # lockfile-exact; --production is deprecated

# ── 7. Create .env from template if it doesn't exist ──
if [ ! -f "$REPO_DIR/.env" ]; then
  echo "→ Creating .env from template..."
  sudo -u "$PI_USER" cp "$REPO_DIR/.env.example" "$REPO_DIR/.env"
  echo "  ⚠  Edit $REPO_DIR/.env with your credentials before rebooting!"
fi

# Enable lightweight mode for low-RAM boards
if ! grep -q "LIGHTWEIGHT_MODE" "$REPO_DIR/.env"; then
  echo "" >> "$REPO_DIR/.env"
  echo "# Lightweight mode for Pi Zero 2 W / Pi 3 (longer sync intervals, less RAM)" >> "$REPO_DIR/.env"
  echo "LIGHTWEIGHT_MODE=true" >> "$REPO_DIR/.env"
fi

# ── 8. LightDM auto-login ─────────────────────────────
echo "→ Configuring auto-login for $PI_USER..."
cat > /etc/lightdm/lightdm.conf << LIGHTDM
[Seat:*]
autologin-user=$PI_USER
autologin-session=openbox
user-session=openbox
LIGHTDM

# ── 9. Openbox kiosk autostart ────────────────────────
echo "→ Setting up Openbox autostart..."
AUTOSTART_DIR="$PI_HOME/.config/openbox"
mkdir -p "$AUTOSTART_DIR"
cp "$REPO_DIR/deploy/openbox-autostart.sh" "$AUTOSTART_DIR/autostart"
chmod +x "$AUTOSTART_DIR/autostart"
chown -R "$PI_USER:$PI_USER" "$AUTOSTART_DIR"

# ── 10. systemd services ──────────────────────────────
echo "→ Installing systemd services..."

cat > /etc/systemd/system/family-calendar.service << SERVICE
[Unit]
Description=Family Calendar server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$PI_USER
WorkingDirectory=$REPO_DIR
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
# Limit Node.js heap for low-memory boards
# Cap the young generation too: on Node 22+ the old-space cap alone still
# allows a 320 MB heap, because V8 sizes the semi-spaces much larger by default.
# With both caps the limit is ~152 MB, and RSS measured ~30 MB lower.
Environment="NODE_OPTIONS=--max-old-space-size=128 --max-semi-space-size=8"

[Install]
WantedBy=multi-user.target
SERVICE

cat > /etc/systemd/system/display-agent.service << AGENT
[Unit]
Description=Family Calendar display schedule agent
After=network-online.target family-calendar.service
Wants=network-online.target

[Service]
Type=simple
User=$PI_USER
Environment=DISPLAY=:0
ExecStart=$REPO_DIR/deploy/display-agent.sh http://localhost:3000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
AGENT

systemctl daemon-reload
systemctl enable family-calendar
systemctl enable display-agent

# Remove old static timers if they exist
systemctl disable --now display-on.timer 2>/dev/null || true
systemctl disable --now display-off.timer 2>/dev/null || true

# ── 11. Start the backend now ─────────────────────────
echo "→ Starting family-calendar service..."
systemctl start family-calendar

echo ""
echo "═══ Setup Complete! ═══"
echo ""
echo "Optimized for low-memory Raspberry Pi boards."
echo "LIGHTWEIGHT_MODE is enabled (15-min sync, reduced polling)."
echo ""
echo "Next steps:"
echo "  1. Edit $REPO_DIR/.env with your credentials"
echo "     (or use the GUI at http://$(hostname -I | awk '{print $1}'):3000/admin)"
echo "  2. Reboot: sudo reboot"
echo "  3. The calendar display should appear automatically"
echo ""
echo "Useful commands:"
echo "  sudo systemctl status family-calendar   # Check backend"
echo "  sudo systemctl status display-agent     # Check display schedule"
echo "  sudo journalctl -u family-calendar -f   # View logs"
echo "  free -h                                 # Check memory usage"
echo ""
