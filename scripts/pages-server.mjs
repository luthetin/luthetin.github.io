/* 本地静态服务器，尽量模拟 GitHub Pages 的行为：
   - / 与目录 → 该目录的 index.html
   - 存在的文件 → 直接返回
   - 不存在的路径 → 返回 404.html（状态码 404，和 GitHub Pages 一致）
   用于在推送前验证仓库根目录这套产物真的能跑通。 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'C:\\Users\\Luthetin\\Desktop\\web';
const PORT = Number(process.argv[2] || 4180);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.md': 'text/markdown; charset=utf-8',
};

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    urlPath = '/';
  }
  const send = (status, file) => {
    const body = fs.readFileSync(file);
    res.writeHead(status, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'no-store',
    });
    res.end(body);
  };

  let target = path.join(ROOT, urlPath);
  // 防目录穿越
  if (!path.resolve(target).startsWith(path.resolve(ROOT))) {
    res.writeHead(403).end('forbidden');
    return;
  }

  const log = (status, note) => console.log(`${String(status).padEnd(3)} ${req.url.padEnd(34)} ${note}`);

  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    const idx = path.join(target, 'index.html');
    if (fs.existsSync(idx)) {
      send(200, idx);
      log(200, '目录 → index.html');
      return;
    }
  }
  if (fs.existsSync(target) && fs.statSync(target).isFile()) {
    send(200, target);
    log(200, '文件');
    return;
  }
  // 无扩展名的路径也尝试 .html（GitHub Pages 会做这个映射）
  if (!path.extname(target) && fs.existsSync(target + '.html')) {
    send(200, target + '.html');
    log(200, '.html 映射');
    return;
  }
  const nf = path.join(ROOT, '404.html');
  if (fs.existsSync(nf)) {
    send(404, nf);
    log(404, '→ 404.html（SPA 回退）');
  } else {
    res.writeHead(404).end('not found');
    log(404, '无 404.html');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`静态服务器（模拟 GitHub Pages）→ http://127.0.0.1:${PORT}/`);
  console.log(`根目录：${ROOT}\n`);
});
