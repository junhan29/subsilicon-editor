const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const buildDir = __dirname;
const sizes = [16, 24, 32, 48, 64, 128, 256, 512];
const svgPath = path.join(buildDir, 'icon.svg');

if (!fs.existsSync(svgPath)) {
  console.error('icon.svg not found');
  process.exit(1);
}

console.log('Generating PNG icons from SVG...');

for (const size of sizes) {
  const out = path.join(buildDir, `icon-${size}.png`);
  try {
    execSync(`npx -y svgexport@latest "${svgPath}" "${out}" ${size}:${size}`, {
      stdio: 'pipe',
      timeout: 30000,
    });
    console.log(`  icon-${size}.png`);
  } catch (e) {
    console.error(`  icon-${size}.png FAILED:`, e.message);
  }
}

// Main icon.png = 512px
fs.copyFileSync(path.join(buildDir, 'icon-512.png'), path.join(buildDir, 'icon.png'));

// ICO: embed PNGs
const icoSizes = [16, 24, 32, 48, 64, 128, 256];
const icoPngs = icoSizes.map(s => ({
  size: s,
  data: fs.readFileSync(path.join(buildDir, `icon-${s}.png`)),
}));

const icoHeader = Buffer.alloc(6);
icoHeader.writeUInt16LE(0, 0);
icoHeader.writeUInt16LE(1, 2);
icoHeader.writeUInt16LE(icoPngs.length, 4);

let dataOffset = 6 + icoPngs.length * 16;
const entries = [];
const dataBufs = [];

for (const png of icoPngs) {
  const entry = Buffer.alloc(16);
  entry.writeUInt8(png.size >= 256 ? 0 : png.size, 0);
  entry.writeUInt8(png.size >= 256 ? 0 : png.size, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.data.length, 8);
  entry.writeUInt32LE(dataOffset, 12);
  entries.push(entry);
  dataBufs.push(png.data);
  dataOffset += png.data.length;
}

const ico = Buffer.concat([icoHeader, ...entries, ...dataBufs]);
fs.writeFileSync(path.join(buildDir, 'icon.ico'), ico);
console.log(`  icon.ico (${ico.length} bytes)`);

// ICNS: embed PNGs
const icnsTypes = { 16: 'icp4', 32: 'icp5', 64: 'icp6', 128: 'ic07', 256: 'ic08', 512: 'ic09' };
const icnsChunks = [];

for (const [sizeStr, type] of Object.entries(icnsTypes)) {
  const size = parseInt(sizeStr);
  const png = fs.readFileSync(path.join(buildDir, `icon-${size}.png`));
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(8 + png.length, 0);
  icnsChunks.push(Buffer.concat([typeBuf, len, png]));
}

const icnsBody = Buffer.concat(icnsChunks);
const icnsHeader = Buffer.alloc(8);
icnsHeader.write('icns', 0, 4, 'ascii');
icnsHeader.writeUInt32BE(8 + icnsBody.length, 4);
const icns = Buffer.concat([icnsHeader, icnsBody]);
fs.writeFileSync(path.join(buildDir, 'icon.icns'), icns);
console.log(`  icon.icns (${icns.length} bytes)`);

console.log('\nAll icons regenerated from SVG!');
