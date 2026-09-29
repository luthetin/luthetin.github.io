/* 正常动效模式下的检查：入场动效跑完后是否有元素被卡在透明态（会被 GSAP fromTo 留在 opacity:0） */

import { spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9339;
const ROOT = 'C:\\Users\\Luthetin\\Desktop\\web-v2';
const profile = `${ROOT}\\.edge-profile-motion`;
if (existsSync(profile)) rmSync(profile, { recursive: true, force: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const child = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore', windowsHide: true });
let ws, seq = 0; const pending = new Map();
function send(m, p = {}, t = 20000) { const id = ++seq; return new Promise((res, rej) => { pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method: m, params: p })); setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('timeout ' + m)); } }, t); }); }
async function ev(e) { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true }); return r.result?.value; }

const audit = `(() => {
  const bad = [];
  const walk = (el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    // 可见区域内、有尺寸、却几乎完全透明的元素 = 被入场动效卡住
    if (r.width > 40 && r.height > 12 && parseFloat(s.opacity) < 0.06 && s.visibility !== 'hidden' && el.tagName !== 'VIDEO') {
      bad.push({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 70), op: s.opacity, y: Math.round(r.top + window.scrollY) });
    }
    for (const c of el.children) walk(c);
  };
  walk(document.body);
  return JSON.stringify({ bad: bad.slice(0, 12), count: bad.length, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches });
})()`;

try {
  let u = null;
  for (let i = 0; i < 60 && !u; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`); u = (await r.json()).find(t => t.type === 'page')?.webSocketDebuggerUrl; } catch {} if (!u) await sleep(500); }
  ws = new WebSocket(u);
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); } });
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  for (const [name, url] of [['home', 'http://localhost:4173/'], ['code', 'http://localhost:4173/work/code'], ['poetry', 'http://localhost:4173/work/poetry']]) {
    await send('Page.navigate', { url }, 15000);
    await sleep(3600); // 让入场动效跑完
    const a = JSON.parse(await ev(audit));
    console.log(`${name.padEnd(7)} 减弱动效=${a.reduced}  首屏后仍在透明态的元素: ${a.count}`);
    a.bad.forEach((b) => console.log(`   - <${b.tag}> ${b.cls} opacity=${b.op} y=${b.y}`));
  }

  // 滚到页面底部，再检查一次（滚动触发的揭示动效）
  await ev(`window.scrollTo(0, document.body.scrollHeight); 1`);
  await sleep(3000);
  const a2 = JSON.parse(await ev(audit));
  console.log(`\n滚到底后仍在透明态的元素: ${a2.count}`);
  a2.bad.forEach((b) => console.log(`   - <${b.tag}> ${b.cls} opacity=${b.op} y=${b.y}`));
} catch (e) { console.error('异常:', e.message); } finally { try { ws?.close(); } catch {} child.kill(); await sleep(300); }
