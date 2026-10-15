import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// Minimal pure Node.js PNG encoder without external native dependencies
function createPng(width: number, height: number, getPixel: (x: number, y: number) => [number, number, number, number]): Buffer {
  // Signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // 8-bit depth
  ihdr.writeUInt8(6, 9); // RGBA color type
  ihdr.writeUInt8(0, 10); // deflate
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // no interlace

  const ihdrChunk = createChunk('IHDR', ihdr);

  // Raw image data with filter byte 0 at start of each scanline
  const scanlineLength = width * 4 + 1;
  const rawData = Buffer.alloc(height * scanlineLength);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y);
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(calculateCrc(crcData), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

// CRC32 table & calculation
const crcTable: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1);
    } else {
      c = c >>> 1;
    }
  }
  crcTable[n] = c;
}

function calculateCrc(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Draw sand background (#EFEBE4 = 239, 235, 228) and charcoal 'c' glyph (#262523 = 38, 37, 35)
function drawCrumbsIcon(size: number): Buffer {
  const bgR = 239, bgG = 235, bgB = 228;
  const fgR = 38, fgG = 37, fgB = 35;

  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size * 0.38;
  const rInner = size * 0.22;
  const cornerR = size * 0.2; // rounded square container

  return createPng(size, size, (x, y) => {
    // Check if inside rounded square container
    const dxCorner = Math.max(0, Math.abs(x - cx) - (size / 2 - cornerR));
    const dyCorner = Math.max(0, Math.abs(y - cy) - (size / 2 - cornerR));
    const distCorner = Math.sqrt(dxCorner * dxCorner + dyCorner * dyCorner);
    if (distCorner > cornerR) {
      return [0, 0, 0, 0]; // Transparent outside icon bounds
    }

    // Geometry of lowercase 'c'
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx); // radians -pi to pi

    // Check if point falls within circular ring of 'c'
    // 'c' opens to the right between -35 deg and +35 deg
    const openAngle = (38 * Math.PI) / 180;
    const isInRing = dist >= rInner && dist <= rOuter;
    const isInCutout = angle > -openAngle && angle < openAngle;

    // Small rounded terminals on the 'c' tips
    const tipX = cx + ((rInner + rOuter) / 2) * Math.cos(openAngle);
    const tipYTop = cy - ((rInner + rOuter) / 2) * Math.sin(openAngle);
    const tipYBottom = cy + ((rInner + rOuter) / 2) * Math.sin(openAngle);
    const tipRadius = (rOuter - rInner) / 2;

    const distTopTip = Math.sqrt((x - tipX) ** 2 + (y - tipYTop) ** 2);
    const distBottomTip = Math.sqrt((x - tipX) ** 2 + (y - tipYBottom) ** 2);

    const isTip = distTopTip <= tipRadius || distBottomTip <= tipRadius;

    if ((isInRing && !isInCutout) || isTip) {
      return [fgR, fgG, fgB, 255];
    }

    return [bgR, bgG, bgB, 255];
  });
}

const outDir = path.resolve(process.cwd(), 'extension/icons');
const publicDir = path.resolve(process.cwd(), 'public');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(publicDir, { recursive: true });

for (const size of [16, 32, 48, 128, 192, 512]) {
  const icon = drawCrumbsIcon(size);
  const outPath = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(outPath, icon);
  fs.writeFileSync(path.join(publicDir, `icon-${size}.png`), icon);
  console.log(`Generated ${size}x${size} icon (${icon.length} bytes)`);
}
