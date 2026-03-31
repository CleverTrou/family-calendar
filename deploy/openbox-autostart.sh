#!/bin/bash
# Openbox autostart script for kiosk mode.
# Install to: /home/trevor/.config/openbox/autostart
#
# This is launched by LightDM after auto-login → Openbox session.

# Disable screen saver and DPMS power management
xset s off
xset s noblank
xset -dpms

# Hide mouse cursor after 3 seconds of inactivity
unclutter -idle 3 -root &

# Wait for the Node.js backend to be ready
sleep 8

# Launch Chromium in kiosk mode (full-screen, no UI chrome)
# Binary name: "chromium-browser" (Bookworm) or "chromium" (Trixie+)
CHROMIUM=$(command -v chromium-browser 2>/dev/null || command -v chromium)
$CHROMIUM \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-component-update \
  --check-for-update-interval=31536000 \
  --disable-features=TranslateUI \
  --no-first-run \
  --start-fullscreen \
  --autoplay-policy=no-user-gesture-required \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  http://localhost:3000/ &
