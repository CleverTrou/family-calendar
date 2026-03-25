#!/bin/bash
# Generate macOS .icns icons for both Family Calendar apps
# - Family Calendar.app: calendar icon
# - Stop Calendar.app: same icon with red circle/slash overlay

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

python3 - "$SCRIPT_DIR" << 'PYEOF'
import sys, struct, zlib, os, math

script_dir = sys.argv[1]

def create_calendar_png(size, add_stop_overlay=False):
    """Create a calendar icon PNG at the given size, optionally with red stop overlay."""
    pixels = bytearray(size * size * 4)

    pad = int(size * 0.08)
    left, top = pad, pad
    right, bottom = size - pad, size - pad
    w, h = right - left, bottom - top
    header_h = int(h * 0.22)
    radius = int(size * 0.12)

    # Colors
    bg = (15, 15, 20, 255)
    card = (26, 26, 36, 255)
    header = (66, 133, 244, 255)
    white = (240, 241, 245, 255)
    dot1 = (66, 133, 244, 255)
    dot2 = (233, 30, 140, 255)
    dot3 = (15, 157, 88, 255)

    def in_rounded_rect(x, y, l, t, r, b, rad):
        if x < l or x >= r or y < t or y >= b:
            return False
        for cx, cy in [(l+rad, t+rad), (r-rad, t+rad), (l+rad, b-rad), (r-rad, b-rad)]:
            if (x < l+rad or x >= r-rad) and (y < t+rad or y >= b-rad):
                if (x - cx)**2 + (y - cy)**2 > rad**2:
                    return False
        return True

    def set_pixel(x, y, color):
        if 0 <= x < size and 0 <= y < size:
            i = (y * size + x) * 4
            pixels[i:i+4] = bytes(color)

    def blend_pixel(x, y, color, alpha):
        """Alpha-blend a color onto existing pixel."""
        if 0 <= x < size and 0 <= y < size:
            i = (y * size + x) * 4
            a = alpha / 255.0
            pixels[i]   = int(pixels[i]   * (1-a) + color[0] * a)
            pixels[i+1] = int(pixels[i+1] * (1-a) + color[1] * a)
            pixels[i+2] = int(pixels[i+2] * (1-a) + color[2] * a)
            pixels[i+3] = 255

    # Draw base calendar
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

    # Event dots
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

    # Binding rings
    ring_w = max(2, int(size * 0.04))
    ring_h = max(3, int(size * 0.06))
    for rx in [left + w // 3, left + 2 * w // 3]:
        for dy in range(-ring_h // 2, ring_h // 2 + 1):
            for dx in range(-ring_w // 2, ring_w // 2 + 1):
                set_pixel(rx + dx, top - 1 + dy, white)

    # Stop overlay: red circle with diagonal slash
    if add_stop_overlay:
        red = (220, 38, 38)
        cx, cy = size // 2, size // 2
        outer_r = int(size * 0.40)
        inner_r = int(size * 0.34)
        stroke = outer_r - inner_r
        slash_half_w = max(2, int(size * 0.04))

        for y in range(size):
            for x in range(size):
                dx = x - cx
                dy = y - cy
                dist = math.sqrt(dx*dx + dy*dy)

                # Anti-aliased circle ring
                if dist >= inner_r - 1 and dist <= outer_r + 1:
                    if dist >= inner_r and dist <= outer_r:
                        blend_pixel(x, y, red, 230)
                    elif dist < inner_r:
                        aa = max(0, min(255, int((inner_r - dist) * 255)))
                        blend_pixel(x, y, red, int(230 * (1 - aa/255)))
                    else:
                        aa = max(0, min(255, int((dist - outer_r) * 255)))
                        blend_pixel(x, y, red, int(230 * (1 - aa/255)))

                # Diagonal slash (from top-left to bottom-right)
                if dist <= inner_r:
                    # Perpendicular distance from the diagonal line y=x through center
                    perp_dist = abs(dx - dy) / math.sqrt(2)
                    if perp_dist <= slash_half_w:
                        blend_pixel(x, y, red, 230)
                    elif perp_dist <= slash_half_w + 1:
                        aa = perp_dist - slash_half_w
                        blend_pixel(x, y, red, int(230 * (1 - aa)))

    # Encode as PNG
    raw = bytearray()
    for y in range(size):
        raw.append(0)
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


# Icon sizes required for .iconset
icon_sizes = {
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

# Generate both icon sets
for variant, overlay in [('AppIcon', False), ('StopIcon', True)]:
    iconset_dir = os.path.join(script_dir, f'{variant}.iconset')
    os.makedirs(iconset_dir, exist_ok=True)

    for filename, sz in icon_sizes.items():
        path = os.path.join(iconset_dir, filename)
        with open(path, 'wb') as f:
            f.write(create_calendar_png(sz, add_stop_overlay=overlay))

    label = 'stop' if overlay else 'calendar'
    print(f'  Generated {variant} ({label}) — all sizes')

print('Done generating icon sets.')
PYEOF

# Convert both iconsets to .icns
iconutil -c icns "$SCRIPT_DIR/AppIcon.iconset" \
  -o "$SCRIPT_DIR/Family Calendar.app/Contents/Resources/AppIcon.icns"
echo "Created: Family Calendar.app icon"

iconutil -c icns "$SCRIPT_DIR/StopIcon.iconset" \
  -o "$SCRIPT_DIR/Stop Calendar.app/Contents/Resources/AppIcon.icns"
echo "Created: Stop Calendar.app icon"

# Clean up
rm -rf "$SCRIPT_DIR/AppIcon.iconset" "$SCRIPT_DIR/StopIcon.iconset"
echo "All done!"
