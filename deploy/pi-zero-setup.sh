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
#   - Installs Node.js 18 LTS (works on armv7l/aarch64)
#
# Requirements:
#   - Raspberry Pi Zero 2 W, Pi 3B/3B+, or Pi 4 (1GB)
#   - Raspberry Pi OS Lite (64-bit recommended, 32-bit OK for Pi 3)
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

# ── 4. Node.js 18 LTS ─────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "→ Installing Node.js 18 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  apt install -y nodejs
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
sudo -u "$PI_USER" npm install --production

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
Environment=NODE_OPTIONS=--max-old-space-size=128

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
