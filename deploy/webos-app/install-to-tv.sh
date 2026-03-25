#!/bin/bash
# Install the Family Calendar app to an LG webOS TV
# Bypasses ares-cli's buggy SSH handling by using system SSH directly.
#
# Usage: ./install-to-tv.sh [TV_IP]
# Default TV IP: YOUR_TV_IP

set -e

TV_IP="${1:-YOUR_TV_IP}"
TV_PORT=9922
TV_USER=prisoner
SSH_KEY="$HOME/.ssh/lgtv_webos"
SSH_OPTS="-o StrictHostKeyChecking=no -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedAlgorithms=+ssh-rsa"
IPK_NAME="com.clevertrou.familycalendar_1.0.0_all.ipk"
APP_ID="com.clevertrou.familycalendar"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IPK_PATH="$SCRIPT_DIR/$IPK_NAME"

ssh_cmd() {
    ssh -i "$SSH_KEY" -p "$TV_PORT" $SSH_OPTS "$TV_USER@$TV_IP" "$@"
}

scp_cmd() {
    scp -i "$SSH_KEY" -P "$TV_PORT" $SSH_OPTS "$@"
}

# Check prerequisites
if [ ! -f "$SSH_KEY" ]; then
    echo "ERROR: SSH key not found at $SSH_KEY"
    echo "Run: ares-novacom --device lgtv --getkey"
    exit 1
fi

# Package the app if .ipk doesn't exist or is older than source files
if [ ! -f "$IPK_PATH" ] || [ "$SCRIPT_DIR/appinfo.json" -nt "$IPK_PATH" ] || [ "$SCRIPT_DIR/index.html" -nt "$IPK_PATH" ]; then
    echo "==> Packaging app..."
    cd "$SCRIPT_DIR"
    # Use ares-package if available (it works fine, only install/launch are buggy)
    if command -v ares-package &> /dev/null; then
        ares-package .
    else
        echo "ERROR: ares-package not found. Install: npm install -g @webos-tools/cli"
        exit 1
    fi
fi

echo "==> Checking connection to TV at $TV_IP..."
if ! ssh_cmd "echo ok" > /dev/null 2>&1; then
    echo "ERROR: Cannot connect to TV at $TV_IP:$TV_PORT"
    echo "Make sure:"
    echo "  1. TV is on and Developer Mode app is open"
    echo "  2. Key Server is enabled in Developer Mode app"
    echo "  3. IP address is correct (check Developer Mode app)"
    exit 1
fi
echo "    Connected!"

echo "==> Uploading $IPK_NAME..."
scp_cmd "$IPK_PATH" "$TV_USER@$TV_IP:/tmp/$IPK_NAME"

echo "==> Installing app..."
ssh_cmd "luna-send -n 1 -f luna://com.webos.appInstallService/dev/install '{\"id\":\"$APP_ID\",\"ipkUrl\":\"/tmp/$IPK_NAME\",\"subscribe\":true}'" 2>&1 | head -5

# Wait a moment for installation
sleep 2

echo "==> Launching app..."
ssh_cmd "luna-send -n 1 -f luna://com.webos.applicationManager/launch '{\"id\":\"$APP_ID\"}'" 2>&1

echo ""
echo "Done! Family Calendar should now be visible on your TV."
echo "To close: ssh -i $SSH_KEY -p $TV_PORT $SSH_OPTS $TV_USER@$TV_IP \"luna-send -n 1 luna://com.webos.applicationManager/close '{\\\"id\\\":\\\"$APP_ID\\\"}'\""
