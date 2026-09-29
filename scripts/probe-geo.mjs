/* 精确测量内容页的关键元素几何，避免靠视觉猜 */

import { spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9371;
const ROOT = 'C:\\Users\\Luthetin\\Desktop\\web-v2';
const profile = `${ROOT}\\.edge-probe-geo`;
if (existsSync(profile)) rmSync(profile, { recursive: true, force: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const child = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore', windowsHide: true });
let ws, seq = 0; const pending = new Map();
function send(m, p = {}, t = 15000) { const id = ++seq; return new Promise((res, rej) => { pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method: m, params: p })); setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('timeout ' + m)); } }, t); }); }
async function ev(e, t = 12000) { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true }, t); return r.result?.value; }

const EXPR = `(() => {
  const q = (s) => document.querySelector(s);
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { y: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width), cx: Math.round(r.left + r.width/2), cy: Math.round(r.top + r.height/2) }; };
  const out = {};
  out.url = location.pathname;
  out.viewportH = window.innerHeight;
  out.scrollH = document.documentElement.scrollHeight;
  out.h1 = box(q('h1'));
  out.lead = box(q('main p'));
  out.plate = box(q('.plate'));
  out.aspect = box(q('.aspect-video'));
  const btn = q('.aspect-video span.rounded-full');
  out.playBtn = box(btn);
  out.playBtnParent = btn ? box(btn.parentElement) : null;
  out.gridKids = [...(q('.aspect-video')?.children || [])].map((c, i) => ({ i, cls: String(c.className).slice(0, 46), ...box(c) }));
  /* 检测 .plate / aspect-video 的圆角与尺寸规则是否生效 */
  const av = q('.aspect-video');
  if (av) { const s = getComputedStyle(av); out.avStyle = { aspectRatio: s.aspectRatio, display: s.display, h: s.height }; }
  const pl = q('.plate');
  if (pl) { const s = getComputedStyle(pl); out.plateStyle = { display: s.display, position: s.position }; }
  return JSON.stringify(out);
})()`;

try {
  let u = null;
  for (let i = 0; i < 60 && !u; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`); u = (await r.json()).find((t) => t.type === 'page')?.webSocketDebuggerUrl; } catch {} if (!u) await sleep(500); }
  ws = new WebSocket(u);
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); } });
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

  for (const p of process.argv.slice(2)) {
    console.log(`\n===== ${p} =====`);
    await send('Page.navigate', { url: 'http://localhost:4173' + p }, 20000);
    await sleep(3600);
    const raw = await ev(EXPR);
    console.log(JSON.stringify(JSON.parse(raw), null, 1));
  }
} catch (e) { console.error('异常：', e.message); }
finally { try { ws?.close(); } catch {} child.kill(); await sleep(300); }
