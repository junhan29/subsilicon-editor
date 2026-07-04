const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const buildDir = __dirname;
const sizes = [16, 24, 32, 48, 64, 128, 256, 512];

const svgContent = fs.readFileSync(path.join(buildDir, 'icon.svg'), 'utf-8');

function svgToPng(svg, size) {
  const pngHeader = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
  ]);

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const crc = crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crc >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  function crc32(buf) {
    let crc = 0xffffffff;
    const table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c;
    }
    for (let i = 0; i < buf.length; i++) {
      crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return crc ^ 0xffffffff;
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const bgColor = [26, 20, 16];
  const accentStart = [245, 158, 11];
  const accentEnd = [239, 68, 68];
  const center = size / 2;

  const raw = Buffer.alloc(size * size * 4 + size);

  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const offset = y * (size * 4 + 1) + 1 + x * 4;
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const radius = size * 0.35;

      const t = Math.max(0, Math.min(1, (y / size)));
      const bgR = Math.round(26 + (42 - 26) * t);
      const bgG = Math.round(20 + (31 - 20) * t);
      const bgB = Math.round(16 + (24 - 16) * t);

      if (dist < radius) {
        const tt = Math.max(0, Math.min(1, (y / size)));
        const r = Math.round(accentStart[0] + (accentEnd[0] - accentStart[0]) * tt);
        const g = Math.round(accentStart[1] + (accentEnd[1] - accentStart[1]) * tt);
        const b = Math.round(accentStart[2] + (accentEnd[2] - accentStart[2]) * tt);
        const edge = radius - dist;
        const alpha = edge < 2 ? edge / 2 : 1;

        const s = size;
        const shapeY = y - s * 0.22;
        const shapeH = s * 0.56;
        if (shapeY > 0 && shapeY < shapeH) {
          const sy = shapeY / shapeH;
          const wave = Math.sin(sy * Math.PI) * radius * 0.3;
          const shapeX = Math.abs(dx) - wave;
          const innerR = radius * 0.55;
          if (shapeX < innerR * 0.6) {
            raw[offset] = bgR;
            raw[offset + 1] = bgG;
            raw[offset + 2] = bgB;
            raw[offset + 3] = 255;
            continue;
          }
        }

        raw[offset] = Math.round(r * alpha + bgR * (1 - alpha));
        raw[offset + 1] = Math.round(g * alpha + bgG * (1 - alpha));
        raw[offset + 2] = Math.round(b * alpha + bgB * (1 - alpha));
        raw[offset + 3] = 255;
      } else {
        raw[offset] = bgR;
        raw[offset + 1] = bgG;
        raw[offset + 2] = bgB;
        raw[offset + 3] = 255;
      }
    }
  }

  const idat = zlib.deflateSync(raw);
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    pngHeader,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', iend)
  ]);
}

function generateIco(icons) {
  const count = icons.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  let dataOffset = 6 + count * 16;
  const entries = [];
  const dataBufs = [];

  for (const icon of icons) {
    const entry = Buffer.alloc(16);
    const w = icon.size >= 256 ? 0 : icon.size;
    const h = icon.size >= 256 ? 0 : icon.size;
    entry.writeUInt8(w, 0);
    entry.writeUInt8(h, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(icon.png.length, 8);
    entry.writeUInt32LE(dataOffset, 12);
    entries.push(entry);
    dataBufs.push(icon.png);
    dataOffset += icon.png.length;
  }

  return Buffer.concat([header, ...entries, ...dataBufs]);
}

function generateIcns(icons) {
  const types = {
    16: 'icp4',
    32: 'icp5',
    64: 'icp6',
    128: 'ic07',
    256: 'ic08',
    512: 'ic09'
  };

  const chunks = [];
  for (const icon of icons) {
    const type = types[icon.size];
    if (!type) continue;
    const typeBuf = Buffer.from(type, 'ascii');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(8 + icon.png.length, 0);
    chunks.push(Buffer.concat([typeBuf, len, icon.png]));
  }

  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(8);
  header.write('icns', 0, 4, 'ascii');
  header.writeUInt32BE(8 + body.length, 4);

  return Buffer.concat([header, body]);
}

const icons = [];
for (const size of sizes) {
  const png = svgToPng(svgContent, size);
  const pngPath = path.join(buildDir, `icon-${size}.png`);
  fs.writeFileSync(pngPath, png);
  console.log(`  icon-${size}.png (${png.length} bytes)`);
  icons.push({ size, png });
}

const ico = generateIco(icons.filter(i => i.size <= 256));
fs.writeFileSync(path.join(buildDir, 'icon.ico'), ico);
console.log(`  icon.ico (${ico.length} bytes)`);

const icns = generateIcns(icons);
fs.writeFileSync(path.join(buildDir, 'icon.icns'), icns);
console.log(`  icon.icns (${icns.length} bytes)`);

const png512 = icons.find(i => i.size === 512).png;
fs.writeFileSync(path.join(buildDir, 'icon.png'), png512);
console.log(`  icon.png (${png512.length} bytes)`);

console.log('\n所有图标生成完成！');
