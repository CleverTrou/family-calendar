#!/bin/bash
# ─────────────────────────────────────────────────────────
# Raspberry Pi 5 setup script for Family Calendar Display
# ─────────────────────────────────────────────────────────
#
# Run this ONCE on a fresh Raspberry Pi OS Lite (64-bit Bookworm):
#   chmod +x deploy/pi-setup.sh
#   sudo ./deploy/pi-setup.sh
#
# After running, reboot the Pi and the calendar should auto-start.

set -euo pipefail

echo "═══ Family Calendar Pi Setup ═══"
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
echo "→ Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
echo "  Node.js $(node --version) installed"

# ── 4. LightDM auto-login ─────────────────────────────
echo "→ Configuring auto-login..."
cat > /etc/lightdm/lightdm.conf << 'LIGHTDM'
[Seat:*]
autologin-user=trevor
autologin-session=openbox
user-session=openbox
LIGHTDM

# ── 5. Openbox kiosk autostart ────────────────────────
echo "→ Setting up Openbox autostart..."
AUTOSTART_DIR="/home/trevor/.config/openbox"
mkdir -p "$AUTOSTART_DIR"
cp /home/trevor/family-calendar/deploy/openbox-autostart.sh "$AUTOSTART_DIR/autostart"
chmod +x "$AUTOSTART_DIR/autostart"
chown -R trevor:trevor "$AUTOSTART_DIR"

# ── 6. Install npm dependencies ───────────────────────
echo "→ Installing npm dependencies..."
cd /home/trevor/family-calendar
sudo -u trevor npm install --production

# ── 7. systemd services ───────────────────────────────
echo "→ Installing systemd services..."
cp deploy/family-calendar.service /etc/systemd/system/
cp deploy/display-off.service /etc/systemd/system/
cp deploy/display-off.timer /etc/systemd/system/
cp deploy/display-on.service /etc/systemd/system/
cp deploy/display-on.timer /etc/systemd/system/

systemctl daemon-reload
systemctl enable family-calendar
systemctl enable display-off.timer
systemctl enable display-on.timer

# ── 8. Start the backend now ──────────────────────────
echo "→ Starting family-calendar service..."
systemctl start family-calendar

echo ""
echo "═══ Setup Complete! ═══"
echo ""
echo "Next steps:"
echo "  1. Edit /home/trevor/family-calendar/.env with your credentials"
echo "  2. Reboot: sudo reboot"
echo "  3. The calendar display should appear automatically"
echo ""
echo "Useful commands:"
echo "  sudo systemctl status family-calendar   # Check backend"
echo "  sudo journalctl -u family-calendar -f   # View logs"
echo "  curl http://localhost:3000/api/health    # Health check"
echo ""
