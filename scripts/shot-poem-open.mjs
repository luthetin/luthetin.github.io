/* 展开一首诗并截图，用于审阅"折叠小字 → 展开大字"的排版事件与落字动画 */

import { spawn } from 'node:child_process';
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9395;
const ROOT = 'C:\\Users\\Luthetin\\Desktop\\web-v2';
const profile = `${ROOT}\\.edge-open`;
const OUT = `${ROOT}\\.shots-open`;
const BASE = 'http://localhost:4173';
if (existsSync(profile)) rmSync(profile, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const child = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore', windowsHide: true });
let ws, seq = 0; const pending = new Map();
function send(m, p = {}, t = 25000) { const id = ++seq; return new Promise((res, rej) => { pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method: m, params: p })); setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('timeout ' + m)); } }, t); }); }
async function ev(e, t = 12000) { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true }, t); return r.result?.value; }
const shoot = async (f) => { const r = await send('Page.captureScreenshot', { format: 'png', fromSurface: true }, 25000); writeFileSync(`${OUT}/${f}`, Buffer.from(r.data, 'base64')); };

const HOW_MANY = Number(process.argv[2] || 2);
const W = Number(process.argv[3] || 1440);
const H = Number(process.argv[4] || 1000);

try {
  let u = null;
  for (let i = 0; i < 60 && !u; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`); u = (await r.json()).find((t) => t.type === 'page')?.webSocketDebuggerUrl; } catch {} if (!u) await sleep(500); }
  ws = new WebSocket(u);
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); } });
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < 700 });

  await send('Page.navigate', { url: BASE + '/work/poetry' }, 25000);
  await sleep(4000);

  /* 展开前先拍一张折叠态，作为对比 */
  await ev(`document.querySelector('[data-poem]').scrollIntoView({block:'start'}); 1`);
  await sleep(900);
  await shoot(`poetry-${W}-collapsed.png`);

  for (let i = 0; i < HOW_MANY; i++) {
    await ev(`(() => {
      const items = [...document.querySelectorAll('[data-poem]')];
      const el = items[${i}];
      if (!el) return 'none';
      const b = el.querySelector('button[aria-expanded]');
      if (b && b.getAttribute('aria-expanded') !== 'true') b.click();
      return el.getAttribute('data-poem');
    })()`);
    await sleep(2200); // 等落字动画跑完
    const title = await ev(`(() => {
      const items = [...document.querySelectorAll('[data-poem]')];
      const el = items[${i}];
      return el ? el.getAttribute('data-poem') : null;
    })()`);
    await ev(`(() => {
      const items = [...document.querySelectorAll('[data-poem]')];
      const el = items[${i}];
      if (el) el.scrollIntoView({block:'start'});
      return 1;
    })()`);
    await sleep(700);
    await shoot(`poetry-${W}-open-${i}.png`);
    console.log(`已展开并截图：${title}`);
  }
} catch (e) { console.error('异常：', e.message); }
finally { try { ws?.close(); } catch {} child.kill(); await sleep(300); }
