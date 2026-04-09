#!/bin/bash
# Package the Tizen app into a .wgt file.
# Usage: ./package.sh
#
# This creates a .wgt file (a ZIP archive) that can be installed on
# Samsung TVs using the Tizen CLI or Tizen Studio.
#
# For sideloading to your own TV in developer mode, no signing is needed.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

WGT_NAME="FamilyCalendar.wgt"

# Check that SERVER_URL has been configured
if grep -q 'SERVER_IP' index.html; then
  echo ""
  echo "WARNING: You need to set your server IP first!"
  echo ""
  echo "  Edit index.html and replace SERVER_IP with your server's local IP."
  echo "  Example: var SERVER_URL = 'http://192.168.1.100:3000';"
  echo ""
  read -p "Continue anyway? (y/N) " confirm
  if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    exit 1
  fi
fi

# Remove old package if present
rm -f "$WGT_NAME"

# Package as .wgt (ZIP archive with specific files)
zip -r "$WGT_NAME" \
  config.xml \
  index.html \
  icon.png \
  -x "*.sh" "*.md" ".*"

echo ""
echo "Packaged: $WGT_NAME"
echo ""
echo "Install with Tizen CLI:"
echo "  tizen install -n $WGT_NAME -t <your-tv-name>"
echo ""
echo "Or install with sdb:"
echo "  sdb install $WGT_NAME"
