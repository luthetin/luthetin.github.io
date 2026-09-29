/* 线上验收：在真实 https://luthetin.github.io 上跑一遍关键路径 */

import { spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9342;
const ROOT = 'C:\\Users\\Luthetin\\Desktop\\web-v2';
const profile = `${ROOT}\\.edge-profile-live`;
const BASE = process.argv[2] || 'https://luthetin.github.io';
if (existsSync(profile)) rmSync(profile, { recursive: true, force: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const child = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore', windowsHide: true });

let ws, seq = 0; const pending = new Map(); const logs = [];
function send(m, p = {}, t = 25000) { const id = ++seq; return new Promise((res, rej) => { pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method: m, params: p })); setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('timeout ' + m)); } }, t); }); }
async function ev(e) { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true }); return r.result?.value; }

const results = [];
function check(name, pass, detail = '') { results.push({ name, pass }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  → ' + detail : ''}`); }

const probe = `JSON.stringify({
  path: location.pathname + location.search + location.hash,
  sections: document.querySelectorAll('section').length,
  h: document.documentElement.scrollHeight,
  h1: (document.querySelector('h1,.display')?.textContent || '').replace(/\\s+/g,''),
  brokenImgs: [...document.querySelectorAll('img')].filter(i => i.complete && i.naturalWidth === 0).length,
  title: document.title,
})`;

const IGNORE = /hero\.mp4$/;
/* GitHub Pages 是纯静态托管：/work/xxx 这种直达地址的 HTTP 状态码必然是 404
   （内容由 404.html 提供，再由应用把地址还原成 /work/xxx）。
   浏览器控制台会照实记录一条 404，这属于该托管方式的固有成本，不算缺陷。 */
const EXPECTED_404 = /(Failed to load resource.*404.*)(\/work\/[a-z]+|hero\.mp4)/;

try {
  let u = null;
  for (let i = 0; i < 60 && !u; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`); u = (await r.json()).find(t => t.type === 'page')?.webSocketDebuggerUrl; } catch {} if (!u) await sleep(500); }
  ws = new WebSocket(u);
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); return; }
    if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + m.params.exceptionDetails.text);
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
      const text = m.params.entry.text + ' ' + (m.params.entry.url || '');
      if (IGNORE.test(text) || EXPECTED_404.test(text)) return;
      logs.push('ERR ' + text);
    }
  });
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  /* 首页 */
  logs.length = 0;
  await send('Page.navigate', { url: BASE + '/' }, 30000);
  await sleep(5000);
  let r = JSON.parse(await ev(probe));
  check('线上首页渲染', r.sections >= 5 && r.h > 3000, `sections=${r.sections} scrollH=${r.h}`);
  check('线上首页标题', r.h1 === '写代码，也写诗', r.h1);
  check('线上首页无坏图', r.brokenImgs === 0, `坏图 ${r.brokenImgs}`);
  check('线上首页无 JS 报错', logs.length === 0, logs.slice(0, 2).join(' | ') || '(无)');

  /* 深链 */
  for (const [label, p, h1, poems] of [
    ['程序', '/work/code', '程序', 0],
    ['诗歌', '/work/poetry', '诗歌', 25],
    ['自媒体', '/work/media', '自媒体', 0],
  ]) {
    logs.length = 0;
    await send('Page.navigate', { url: BASE + p }, 30000);
    await sleep(4200);
    const d = JSON.parse(await ev(probe));
    check(`线上深链 ${p} 渲染`, d.h1 === h1 && d.h > 900 && d.brokenImgs === 0, `h1=${d.h1} h=${d.h} 坏图=${d.brokenImgs}`);
    check(`线上深链 ${p} 地址干净`, d.path === p, `实际 ${d.path}`);
    if (poems) {
      const n = await ev(`document.querySelectorAll('[data-poem]').length`);
      check(`线上 ${p} 诗条 ${poems} 条`, n === poems, `${n} 条`);
    }
    check(`线上 ${p} 无报错`, logs.length === 0, logs.slice(0, 2).join(' | ') || '(无)');
  }

  /* 旧地址跳转 */
  for (const [from, want] of [['/poetry.html', '/#/work/poetry'], ['/explore-hub.html', '/#/work/code'], ['/geostructure-builder.html', '/#/work/code'], ['/projects.html', '/']]) {
    await send('Page.navigate', { url: BASE + from }, 30000);
    await sleep(3800);
    const d = JSON.parse(await ev(probe));
    check(`线上旧地址 ${from} → ${want}`, d.path === want, `实际 ${d.path} h=${d.h}`);
  }

  /* 独立应用不能被误伤 */
  for (const app of ['/geostructure-builder/']) {
    await send('Page.navigate', { url: BASE + app }, 30000);
    await sleep(3500);
    const d = JSON.parse(await ev(probe));
    check(`线上独立应用 ${app} 仍在`, d.h > 200 && !/404/.test(d.title), `title=${d.title} h=${d.h}`);
  }

  /* 移动端 */
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Page.navigate', { url: BASE + '/' }, 30000);
  await sleep(4200);
  r = JSON.parse(await ev(probe));
  check('线上手机端首页', r.sections >= 5 && r.h > 3000, `sections=${r.sections} scrollH=${r.h}`);

  const failed = results.filter((x) => !x.pass);
  console.log(`\n合计 ${results.length} 项，失败 ${failed.length} 项`);
  if (failed.length) console.log('失败项：' + failed.map((f) => f.name).join('; '));
} catch (e) { console.error('线上验收异常：', e.message); process.exitCode = 1; }
finally { try { ws?.close(); } catch {} child.kill(); await sleep(300); }
