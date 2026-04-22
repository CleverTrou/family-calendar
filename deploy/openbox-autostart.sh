#!/bin/bash
# Openbox autostart script for kiosk mode.
# Install to: /home/<user>/.config/openbox/autostart
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

# Fetch settings once; extract both display scale and the CEC opt-in.
SETTINGS_JSON=$(curl -sf http://localhost:3000/api/settings 2>/dev/null || echo '{}')

SCALE=$(echo "$SETTINGS_JSON" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('settings',{}).get('display',{}).get('displayScale',1))
except:
    print(1)
" 2>/dev/null || echo 1)

CONTROL_TV=$(echo "$SETTINGS_JSON" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print('true' if d.get('settings',{}).get('display',{}).get('controlTvViaCec') else 'false')
except:
    print('false')
" 2>/dev/null || echo false)

# If the admin toggle is on, wake the TV and switch to the Pi's input via
# HDMI-CEC. Skipped silently if cec-ctl isn't installed (v4l-utils provides
# it; see pi-setup.sh) or if any command fails. Runs before the browser
# launch so the TV's backlight warms up while Chromium composites its
# first frame.
if [ "$CONTROL_TV" = "true" ] && command -v cec-ctl >/dev/null 2>&1; then
  cec-ctl --playback --image-view-on --to 0 >/dev/null 2>&1 || true
  cec-ctl --playback --active-source phys-addr=0.0.0.0 >/dev/null 2>&1 || true
fi

# Launch browser in kiosk mode (full-screen, no UI chrome)
# Prefer epiphany (lighter) if available; fall back to Chromium.
if command -v epiphany 2>/dev/null; then
  epiphany --private-instance --profile=/tmp/epiphany-kiosk \
    http://localhost:3000/ &
  # Wait for window, then fullscreen it via wmctrl or xdotool
  sleep 4
  if command -v xdotool &>/dev/null; then
    xdotool key super+F11 2>/dev/null || xdotool key F11 2>/dev/null || true
  fi
else
  # Chromium: "chromium-browser" (Bookworm) or "chromium" (Trixie+)
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
    --force-device-scale-factor=$SCALE \
    http://localhost:3000/ &
fi
