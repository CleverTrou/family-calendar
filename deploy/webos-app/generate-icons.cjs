// Generate minimal PNG icons for webOS app
const zlib = require('zlib');
const fs = require('fs');

function createPNG(size, bgR, bgG, bgB) {
  const pixels = Buffer.alloc(size * size * 4);
  const center = size / 2;
  const iconSize = size * 0.6;
  const left = Math.floor(center - iconSize / 2);
  const right = Math.floor(center + iconSize / 2);
  const top = Math.floor(center - iconSize / 2);
  const bottom = Math.floor(center + iconSize / 2);
  const headerH = Math.floor(iconSize * 0.25);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      pixels[i] = bgR; pixels[i + 1] = bgG; pixels[i + 2] = bgB; pixels[i + 3] = 255;

      if (x >= left && x < right && y >= top && y < bottom) {
        if (y < top + headerH) {
          pixels[i] = 66; pixels[i + 1] = 133; pixels[i + 2] = 244;
        } else {
          pixels[i] = 240; pixels[i + 1] = 241; pixels[i + 2] = 245;
        }

        const bodyTop = top + headerH + 4;
        const bodyH = bottom - bodyTop - 4;
        const bodyW = right - left - 8;
        const bx = x - left - 4;
        const by = y - bodyTop;
        if (by > 0 && by < bodyH) {
          const cellW = bodyW / 3;
          const cellH = bodyH / 3;
          const cx = bx % cellW;
          const cy = by % cellH;
          const dotSize = Math.max(2, Math.floor(size * 0.04));
          if (cx > cellW / 2 - dotSize && cx < cellW / 2 + dotSize &&
            cy > cellH / 2 - dotSize && cy < cellH / 2 + dotSize) {
            pixels[i] = 55; pixels[i + 1] = 65; pixels[i + 2] = 81;
          }
        }
      }
    }
  }

  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  const deflated = zlib.deflateSync(raw);
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeB = Buffer.from(type);
    const crcData = Buffer.concat([typeB, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(crcData) >>> 0);
    return Buffer.concat([len, typeB, data, crc]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflated), chunk('IEND', Buffer.alloc(0))]);
}

fs.writeFileSync(__dirname + '/icon80.png', createPNG(80, 15, 15, 20));
fs.writeFileSync(__dirname + '/icon130.png', createPNG(130, 15, 15, 20));
console.log('Icons created: icon80.png, icon130.png');
