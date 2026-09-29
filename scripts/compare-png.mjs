/* 逐像素比对两张截图，量化"极光到底带偏了多少颜色" */

import fs from 'node:fs';
import zlib from 'node:zlib';

/* 极简 PNG 解码：只处理我们自己的截图（8bit, 非隔行, RGB/RGBA） */
function decodePng(file) {
  const buf = fs.readFileSync(file);
  let pos = 8;
  let w = 0;
  let h = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (bitDepth !== 8) throw new Error('只支持 8bit：' + bitDepth);
  const ch = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (!ch) throw new Error('只支持 RGB/RGBA：colorType=' + colorType);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(w * h * ch);
  let prev = Buffer.alloc(stride);
  let rp = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[rp++];
    const line = Buffer.from(raw.subarray(rp, rp + stride));
    rp += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? line[x - ch] : 0;
      const b = prev[x];
      const c = x >= ch ? prev[x - ch] : 0;
      if (filter === 1) line[x] = (line[x] + a) & 255;
      else if (filter === 2) line[x] = (line[x] + b) & 255;
      else if (filter === 3) line[x] = (line[x] + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        line[x] = (line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    }
    line.copy(out, y * stride);
    prev = line;
  }
  return { w, h, ch, data: out };
}

const A = decodePng(process.argv[2]);
const B = decodePng(process.argv[3]);
if (A.w !== B.w || A.h !== B.h) throw new Error('尺寸不一致');

let changed = 0;
let maxDelta = 0;
let sumDelta = 0;
const samples = [];
for (let i = 0; i < A.data.length; i += A.ch) {
  const d =
    Math.abs(A.data[i] - B.data[i]) +
    Math.abs(A.data[i + 1] - B.data[i + 1]) +
    Math.abs(A.data[i + 2] - B.data[i + 2]);
  if (d > 3) changed++;
  sumDelta += d;
  if (d > maxDelta) maxDelta = d;
}
const total = (A.data.length / A.ch) | 0;

/* 报告几个关键区域的平均色（左上天空 / 中部人脸 / 左下文案区） */
function region(img, x0, y0, x1, y1) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * img.w + x) * img.ch;
      r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; n++;
    }
  }
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

const regions = {
  '左上天空/花': [40, 40, 300, 200],
  '中部人脸': [600, 300, 800, 430],
  '左下文案区': [60, 600, 400, 700],
  '整幅': [0, 0, A.w, A.h],
};
console.log(`尺寸 ${A.w}x${A.h}`);
console.log(`像素总数 ${total}`);
console.log(`差异>3 的像素 ${changed}（${((changed / total) * 100).toFixed(2)}%）`);
console.log(`平均通道差 ${(sumDelta / total).toFixed(2)} / 最大通道差 ${maxDelta}`);
console.log('\n区域平均色  A=带极光   B=无极光');
for (const [name, r] of Object.entries(regions)) {
  const a = region(A, ...r);
  const b = region(B, ...r);
  const d = a.map((v, i) => v - b[i]);
  console.log(`  ${name.padEnd(12)} A rgb(${a.join(',')})  B rgb(${b.join(',')})  差 rgb(${d.join(',')})`);
}
