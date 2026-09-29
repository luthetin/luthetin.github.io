/* 把分屏截图纵向拼成一整张长图（纯 Node 实现，不依赖图像库）。
   输入：shot.mjs 产出的 <name>-<w>-p00.png、p01.png …（同宽同高）
   输出：<outPath> */

import fs from 'node:fs';
import zlib from 'node:zlib';

function decodePng(file) {
  const buf = fs.readFileSync(file);
  let pos = 8;
  let w = 0, h = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (bitDepth !== 8) throw new Error('仅支持 8bit，实际 ' + bitDepth);
  const ch = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (!ch) throw new Error('仅支持 RGB/RGBA，colorType=' + colorType);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(w * h * ch);
  let prev = Buffer.alloc(stride);
  let rp = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[rp++];
    const line = Buffer.from(raw.subarray(rp, rp + stride));
    rp += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? line[x - ch] : 0;
      const b = prev[x];
      const c = x >= ch ? prev[x - ch] : 0;
      if (f === 1) line[x] = (line[x] + a) & 255;
      else if (f === 2) line[x] = (line[x] + b) & 255;
      else if (f === 3) line[x] = (line[x] + ((a + b) >> 1)) & 255;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        line[x] = (line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    }
    line.copy(out, y * stride);
    prev = line;
  }
  return { w, h, ch, data: out };
}

function encodePng(w, h, ch, data) {
  const stride = w * ch;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = ch === 4 ? 6 : 2;
  const chunk = (type, body) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length, 0);
    const t = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.concat([t, body]);
    let c = ~0;
    for (let i = 0; i < crcBuf.length; i++) {
      c ^= crcBuf[i];
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE((~c) >>> 0, 0);
    return Buffer.concat([len, t, body, crc]);
  };
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** 拼接：tiles 为按顺序的纵向分屏；overlap 为相邻屏的重叠像素（默认 0） */
export function stitch(tiles, outPath, overlap = 0) {
  const imgs = tiles.map(decodePng);
  const w = imgs[0].w;
  const ch = imgs[0].ch;
  if (imgs.some((i) => i.w !== w || i.ch !== ch)) throw new Error('分屏尺寸不一致');
  const totalH = imgs.reduce((s, i, idx) => s + i.h - (idx ? overlap : 0), 0);
  const out = Buffer.alloc(w * totalH * ch);
  let y = 0;
  for (let idx = 0; idx < imgs.length; idx++) {
    const img = imgs[idx];
    const start = idx === 0 ? 0 : overlap;
    const rows = img.h - start;
    img.data.copy(out, y * w * ch, start * w * ch, img.h * w * ch);
    y += rows;
  }
  fs.writeFileSync(outPath, encodePng(w, totalH, ch, out));
  return { w, h: totalH, tiles: imgs.length };
}

/* 命令行：node stitch-png.mjs <out.png> <tile1> <tile2> ... */
if (process.argv[1] && process.argv[1].endsWith('stitch-png.mjs')) {
  const [, , outPath, ...tilePaths] = process.argv;
  const r = stitch(tilePaths, outPath);
  console.log(`拼接完成 ${r.w}x${r.h}（${r.tiles} 屏）→ ${outPath}`);
}
