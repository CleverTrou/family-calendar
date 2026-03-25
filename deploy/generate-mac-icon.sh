#!/bin/bash
# Generate a macOS .icns icon for the Family Calendar app
# Uses a temporary HTML file rendered via screencapture + sips

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ICONSET_DIR="$SCRIPT_DIR/AppIcon.iconset"
ICNS_FILE="$SCRIPT_DIR/Family Calendar.app/Contents/Resources/AppIcon.icns"

mkdir -p "$ICONSET_DIR"

# Create a simple calendar icon as SVG, convert via macOS tools
# We'll use Python to generate a PNG since it's available on macOS
python3 - "$ICONSET_DIR" << 'PYEOF'
import sys, struct, zlib, os

out_dir = sys.argv[1]

def create_png(size):
    """Create a calendar icon PNG at the given size."""
    pixels = bytearray(size * size * 4)

    pad = int(size * 0.08)
    left, top = pad, pad
    right, bottom = size - pad, size - pad
    w, h = right - left, bottom - top
    header_h = int(h * 0.22)
    radius = int(size * 0.12)

    # Colors
    bg = (15, 15, 20, 255)        # dark background
    card = (26, 26, 36, 255)      # card bg
    header = (66, 133, 244, 255)  # blue header
    white = (240, 241, 245, 255)  # text/grid
    dot1 = (66, 133, 244, 255)    # blue dot
    dot2 = (233, 30, 140, 255)    # pink dot
    dot3 = (15, 157, 88, 255)     # green dot

    def in_rounded_rect(x, y, l, t, r, b, rad):
        if x < l or x >= r or y < t or y >= b:
            return False
        # Check corners
        for cx, cy in [(l+rad, t+rad), (r-rad, t+rad), (l+rad, b-rad), (r-rad, b-rad)]:
            if (x < l+rad or x >= r-rad) and (y < t+rad or y >= b-rad):
                if (x - cx)**2 + (y - cy)**2 > rad**2:
                    return False
        return True

    def set_pixel(x, y, color):
        if 0 <= x < size and 0 <= y < size:
            i = (y * size + x) * 4
            pixels[i:i+4] = bytes(color)

    for y in range(size):
        for x in range(size):
            i = (y * size + x) * 4

            if in_rounded_rect(x, y, left, top, right, bottom, radius):
                if y < top + header_h:
                    pixels[i:i+4] = bytes(header)
                else:
                    pixels[i:i+4] = bytes(card)
            else:
                pixels[i:i+4] = bytes(bg)

    # Draw calendar grid lines and event dots in the body
    body_top = top + header_h
    body_h = bottom - body_top
    body_w = right - left
    cols, rows = 3, 3
    cell_w = body_w // cols
    cell_h = body_h // rows
    dot_r = max(2, int(size * 0.045))

    dots = [dot1, dot2, dot3, dot1, dot3, dot2, dot2, dot1, dot3]

    for row in range(rows):
        for col in range(cols):
            cx = left + col * cell_w + cell_w // 2
            cy = body_top + row * cell_h + cell_h // 2
            color = dots[row * cols + col]

            for dy in range(-dot_r, dot_r + 1):
                for dx in range(-dot_r, dot_r + 1):
                    if dx*dx + dy*dy <= dot_r*dot_r:
                        set_pixel(cx + dx, cy + dy, color)

    # Draw two small "binding rings" at the top
    ring_w = max(2, int(size * 0.04))
    ring_h = max(3, int(size * 0.06))
    for rx in [left + w // 3, left + 2 * w // 3]:
        for dy in range(-ring_h // 2, ring_h // 2 + 1):
            for dx in range(-ring_w // 2, ring_w // 2 + 1):
                set_pixel(rx + dx, top - 1 + dy, white)

    # Encode as PNG
    raw = bytearray()
    for y in range(size):
        raw.append(0)  # filter: none
        raw.extend(pixels[y * size * 4:(y + 1) * size * 4])

    compressed = zlib.compress(bytes(raw))

    def png_chunk(chunk_type, data):
        chunk = chunk_type + data
        return struct.pack('>I', len(data)) + chunk + struct.pack('>I', zlib.crc32(chunk) & 0xffffffff)

    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)

    png = b'\x89PNG\r\n\x1a\n'
    png += png_chunk(b'IHDR', ihdr)
    png += png_chunk(b'IDAT', compressed)
    png += png_chunk(b'IEND', b'')

    return png

# Generate all required sizes for .iconset
sizes = {
    'icon_16x16.png': 16,
    'icon_16x16@2x.png': 32,
    'icon_32x32.png': 32,
    'icon_32x32@2x.png': 64,
    'icon_128x128.png': 128,
    'icon_128x128@2x.png': 256,
    'icon_256x256.png': 256,
    'icon_256x256@2x.png': 512,
    'icon_512x512.png': 512,
    'icon_512x512@2x.png': 1024,
}

for filename, sz in sizes.items():
    path = os.path.join(out_dir, filename)
    with open(path, 'wb') as f:
        f.write(create_png(sz))
    print(f'  Created {filename} ({sz}x{sz})')

print('All icon sizes generated.')
PYEOF

# Convert iconset to .icns
iconutil -c icns "$ICONSET_DIR" -o "$ICNS_FILE"
echo "Created: $ICNS_FILE"

# Clean up
rm -rf "$ICONSET_DIR"
echo "Done!"
