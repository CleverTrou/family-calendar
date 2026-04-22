#!/bin/bash
# display-agent.sh — Polls the Family Calendar server for screen on/off status.
#
# Replaces the static display-on.timer and display-off.timer with a single
# service that reacts to schedule changes from the admin GUI in real time.
#
# Usage: ./display-agent.sh [server-url]
#   server-url defaults to http://localhost:3000
#
# Install as systemd service:
#   sudo cp deploy/display-agent.service /etc/systemd/system/
#   sudo systemctl daemon-reload
#   sudo systemctl enable --now display-agent

SERVER_URL="${1:-http://localhost:3000}"
POLL_INTERVAL=30      # seconds between polls
DISPLAY_ENV=":0"      # X display
LAST_STATE=""         # tracks current screen state to avoid redundant xset calls

echo "[display-agent] Polling ${SERVER_URL}/api/display/status every ${POLL_INTERVAL}s"

# Send an HDMI-CEC command to the TV when the user has opted in to TV control.
# Silently skipped if cec-ctl isn't installed or the CEC adapter is missing.
# Arg 1: "wake" (turn TV on + switch input) or "sleep" (put TV in standby).
send_cec() {
  [ "$CONTROL_TV" = "true" ] || return 0
  command -v cec-ctl >/dev/null 2>&1 || return 0
  case "$1" in
    wake)
      # --playback announces the Pi as a Playback Device on the CEC bus.
      # --image-view-on wakes a TV in standby; --active-source asks the TV
      # to switch its displayed input to ours (physical address auto-discovered).
      cec-ctl --playback --image-view-on --to 0 >/dev/null 2>&1 || true
      cec-ctl --playback --active-source phys-addr=0.0.0.0 >/dev/null 2>&1 || true
      ;;
    sleep)
      cec-ctl --playback --standby --to 0 >/dev/null 2>&1 || true
      ;;
  esac
}

while true; do
  # Fetch display status from server
  RESPONSE=$(curl -sf --max-time 5 "${SERVER_URL}/api/display/status" 2>/dev/null)

  if [ $? -ne 0 ] || [ -z "$RESPONSE" ]; then
    # Server unreachable — don't change screen state, just wait
    sleep "$POLL_INTERVAL"
    continue
  fi

  # Parse the screenOn boolean and CEC opt-in (simple grep, no jq dependency needed)
  SCREEN_ON=$(echo "$RESPONSE" | grep -o '"screenOn":[a-z]*' | cut -d: -f2)
  CONTROL_TV=$(echo "$RESPONSE" | grep -o '"controlTvViaCec":[a-z]*' | cut -d: -f2)

  if [ "$SCREEN_ON" = "true" ] && [ "$LAST_STATE" != "on" ]; then
    echo "[display-agent] Screen ON"
    DISPLAY=$DISPLAY_ENV xset dpms force on 2>/dev/null
    send_cec wake
    LAST_STATE="on"
  elif [ "$SCREEN_ON" = "false" ] && [ "$LAST_STATE" != "off" ]; then
    echo "[display-agent] Screen OFF"
    DISPLAY=$DISPLAY_ENV xset dpms force off 2>/dev/null
    send_cec sleep
    LAST_STATE="off"
  fi

  sleep "$POLL_INTERVAL"
done
