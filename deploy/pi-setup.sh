#!/bin/bash
# ─────────────────────────────────────────────────────────
# Raspberry Pi 5 setup script for Family Calendar Display
# ─────────────────────────────────────────────────────────
#
# Run this on a fresh Raspberry Pi OS Lite (64-bit Bookworm):
#
#   curl -fsSL https://raw.githubusercontent.com/CleverTrou/family-calendar/main/deploy/pi-setup.sh | sudo bash
#
# Or if you've already cloned the repo:
#
#   sudo ./deploy/pi-setup.sh
#
# After running, edit .env with your credentials and reboot.

set -euo pipefail

# ── 0. Detect current user (the one who ran sudo) ─────
PI_USER="${SUDO_USER:-$(logname 2>/dev/null || echo pi)}"
PI_HOME=$(eval echo "~$PI_USER")
REPO_DIR="$PI_HOME/family-calendar"
REPO_URL="https://github.com/CleverTrou/family-calendar.git"

echo "═══ Family Calendar Pi Setup ═══"
echo ""
echo "  User:  $PI_USER"
echo "  Home:  $PI_HOME"
echo "  Repo:  $REPO_DIR"
echo ""

# ── 1. System updates ──────────────────────────────────
echo "→ Updating system packages..."
apt update && apt upgrade -y

# ── 2. Display stack (minimal X11 + Chromium) ──────────
echo "→ Installing display stack..."
apt install -y \
  chromium-browser \
  xserver-xorg \
  x11-xserver-utils \
  xinit \
  openbox \
  unclutter \
  lightdm \
  git \
  curl

# ── 3. Node.js 20 LTS ─────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "→ Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi
echo "  Node.js $(node --version) installed"

# ── 4. Clone or update the repo ───────────────────────
if [ -d "$REPO_DIR/.git" ]; then
  echo "→ Updating existing repo..."
  cd "$REPO_DIR"
  sudo -u "$PI_USER" git pull --ff-only
else
  echo "→ Cloning family-calendar repo..."
  sudo -u "$PI_USER" git clone "$REPO_URL" "$REPO_DIR"
  cd "$REPO_DIR"
fi

# ── 5. Install npm dependencies ───────────────────────
echo "→ Installing npm dependencies..."
cd "$REPO_DIR"
sudo -u "$PI_USER" npm install --production

# ── 6. Create .env from template if it doesn't exist ──
if [ ! -f "$REPO_DIR/.env" ]; then
  echo "→ Creating .env from template..."
  sudo -u "$PI_USER" cp "$REPO_DIR/.env.example" "$REPO_DIR/.env"
  echo "  ⚠  Edit $REPO_DIR/.env with your credentials before rebooting!"
fi

# ── 7. LightDM auto-login ─────────────────────────────
echo "→ Configuring auto-login for $PI_USER..."
cat > /etc/lightdm/lightdm.conf << LIGHTDM
[Seat:*]
autologin-user=$PI_USER
autologin-session=openbox
user-session=openbox
LIGHTDM

# ── 8. Openbox kiosk autostart ────────────────────────
echo "→ Setting up Openbox autostart..."
AUTOSTART_DIR="$PI_HOME/.config/openbox"
mkdir -p "$AUTOSTART_DIR"
cp "$REPO_DIR/deploy/openbox-autostart.sh" "$AUTOSTART_DIR/autostart"
chmod +x "$AUTOSTART_DIR/autostart"
chown -R "$PI_USER:$PI_USER" "$AUTOSTART_DIR"

# ── 9. systemd services ───────────────────────────────
echo "→ Installing systemd services..."

# Generate family-calendar.service with correct paths
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

[Install]
WantedBy=multi-user.target
SERVICE

# Generate display-agent.service with correct paths
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

# ── 10. Start the backend now ─────────────────────────
echo "→ Starting family-calendar service..."
systemctl start family-calendar

echo ""
echo "═══ Setup Complete! ═══"
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
echo "  curl http://localhost:3000/api/health    # Health check"
echo ""
