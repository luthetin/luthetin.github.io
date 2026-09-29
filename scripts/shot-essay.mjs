/* 截取序与跋展开后的样子 */

import { spawn } from 'node:child_process';
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9403;
const ROOT = 'C:\\Users\\Luthetin\\Desktop\\web-v2';
const profile = `${ROOT}\\.edge-essay`;
const OUT = `${ROOT}\\.shots-essay`;
if (existsSync(profile)) rmSync(profile, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const child = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore', windowsHide: true });
let ws, seq = 0; const pending = new Map();
function send(m, p = {}, t = 25000) { const id = ++seq; return new Promise((res, rej) => { pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method: m, params: p })); setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('timeout ' + m)); } }, t); }); }
async function ev(e, t = 12000) { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true }, t); return r.result?.value; }
const shoot = async (f) => { const r = await send('Page.captureScreenshot', { format: 'png', fromSurface: true }, 25000); writeFileSync(`${OUT}/${f}`, Buffer.from(r.data, 'base64')); console.log('已截图', f); };

const W = Number(process.argv[2] || 1440);
const H = Number(process.argv[3] || 1100);

try {
  let u = null;
  for (let i = 0; i < 60 && !u; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`); u = (await r.json()).find((t) => t.type === 'page')?.webSocketDebuggerUrl; } catch {} if (!u) await sleep(500); }
  ws = new WebSocket(u);
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); } });
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < 700 });
  await send('Page.navigate', { url: 'http://localhost:4173/work/poetry' }, 25000);
  await sleep(4200);

  /* 展开序：点标题含"春潋集序"的按钮 */
  await ev(`(() => {
    const b = [...document.querySelectorAll('main button')].find(x => (x.textContent||'').includes('春潋集序'));
    if (b) b.click();
    return 1;
  })()`);
  await sleep(1800);
  await ev(`(() => {
    const li = [...document.querySelectorAll('main li')].find(x => x.textContent.includes('春潋集序'));
    if (li) li.scrollIntoView({ block: 'center' });
    return 1;
  })()`);
  await sleep(600);
  await shoot(`essay-${W}-intro.png`);

  /* 展开跋 */
  await ev(`(() => {
    const b = [...document.querySelectorAll('main button')].find(x => (x.textContent||'').trim().startsWith('跋'));
    if (b) b.click();
    return 1;
  })()`);
  await sleep(1800);
  await ev(`(() => {
    const li = [...document.querySelectorAll('main li')].find(x => /^跋/.test((x.textContent||'').trim()));
    if (li) li.scrollIntoView({ block: 'center' });
    return 1;
  })()`);
  await sleep(600);
  await shoot(`essay-${W}-outro.png`);
} catch (e) { console.error('异常：', e.message); }
finally { try { ws?.close(); } catch {} child.kill(); await sleep(300); }
