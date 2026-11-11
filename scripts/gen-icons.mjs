// Basit PNG ikon üretici (bağımlılıksız, zlib)
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // filtre satırı başına 0
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function drawIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;

  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    buf[i] = r;
    buf[i + 1] = g;
    buf[i + 2] = b;
    buf[i + 3] = a;
  };

  // Arka plan (yuvarlatılmış köşe hissi: sadece kare, tarayıcı maskeler)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      set(x, y, 13, 17, 23);
    }
  }

  const R1 = size * 0.32; // dış çember
  const R2 = size * 0.22; // iç halka
  const R3 = size * 0.09; // göbek

  // Dişler (4 yön)
  const teeth = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
    [-0.7, -0.7],
    [0.7, -0.7],
    [-0.7, 0.7],
    [0.7, 0.7],
  ];
  for (const [dx, dy] of teeth) {
    const tw = size * 0.06;
    const len = size * 0.14;
    for (let t = 0; t < len * 2; t++) {
      const frac = t / (len * 2);
      const px = cx + dx * (R1 + frac * len) - dy * tw * 0.4;
      const py = cy + dy * (R1 + frac * len) + dx * tw * 0.4;
      for (let w = -tw; w <= tw; w++) {
        set(Math.round(px - dy * w), Math.round(py + dx * w), 240, 136, 62);
      }
    }
  }

  // Çemberler
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= R1 && d >= R2) set(x, y, 88, 166, 255);
      if (d <= R3) set(x, y, 88, 166, 255);
      if (d <= R3 * 0.45) set(x, y, 13, 17, 23);
    }
  }

  return encodePNG(size, size, buf);
}

const outDir = path.resolve('public/icons');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'icon-192.png'), drawIcon(192));
fs.writeFileSync(path.join(outDir, 'icon-512.png'), drawIcon(512));
console.log('Icons written:', fs.readdirSync(outDir));
