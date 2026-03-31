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

while true; do
  # Fetch display status from server
  RESPONSE=$(curl -sf --max-time 5 "${SERVER_URL}/api/display/status" 2>/dev/null)

  if [ $? -ne 0 ] || [ -z "$RESPONSE" ]; then
    # Server unreachable — don't change screen state, just wait
    sleep "$POLL_INTERVAL"
    continue
  fi

  # Parse the screenOn boolean (simple grep, no jq dependency needed)
  SCREEN_ON=$(echo "$RESPONSE" | grep -o '"screenOn":[a-z]*' | cut -d: -f2)

  if [ "$SCREEN_ON" = "true" ] && [ "$LAST_STATE" != "on" ]; then
    echo "[display-agent] Screen ON"
    DISPLAY=$DISPLAY_ENV xset dpms force on 2>/dev/null
    LAST_STATE="on"
  elif [ "$SCREEN_ON" = "false" ] && [ "$LAST_STATE" != "off" ]; then
    echo "[display-agent] Screen OFF"
    DISPLAY=$DISPLAY_ENV xset dpms force off 2>/dev/null
    LAST_STATE="off"
  fi

  sleep "$POLL_INTERVAL"
done
