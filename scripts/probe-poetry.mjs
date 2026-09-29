/* 检查诗歌页：序到底渲染了没有、跋的现状、以及"末句"落款的实现 */

import { spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9401;
const ROOT = 'C:\\Users\\Luthetin\\Desktop\\web-v2';
const profile = `${ROOT}\\.edge-probe-poetry`;
if (existsSync(profile)) rmSync(profile, { recursive: true, force: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const child = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore', windowsHide: true });
let ws, seq = 0; const pending = new Map();
function send(m, p = {}, t = 20000) { const id = ++seq; return new Promise((res, rej) => { pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method: m, params: p })); setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('timeout ' + m)); } }, t); }); }
async function ev(e, t = 12000) { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true }, t); return r.result?.value; }

try {
  let u = null;
  for (let i = 0; i < 60 && !u; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`); u = (await r.json()).find((t) => t.type === 'page')?.webSocketDebuggerUrl; } catch {} if (!u) await sleep(500); }
  ws = new WebSocket(u);
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); } });
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://localhost:4173/work/poetry' }, 25000);
  await sleep(4200);

  const info = await ev(`(() => {
    const all = [...document.querySelectorAll('main *')];
    const findText = (t) => all.filter(e => e.children.length === 0 && (e.textContent || '').trim() === t);
    const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { y: Math.round(r.top + scrollY), h: Math.round(r.height), w: Math.round(r.width) }; };
    const intro = findText('春潋集序');
    const outro = findText('跋');
    /* 落款实现：每首展开后那条"末句 · X" */
    const signs = [...document.querySelectorAll('.poem-sign')].map(e => e.textContent.trim());
    return JSON.stringify({
      introFound: intro.length,
      introBox: box(intro[0]),
      outroFound: outro.length,
      outroBox: box(outro[0]),
      /* 序的段落是否真的在 DOM 里（未展开时应该只有标题按钮） */
      introParas: [...document.querySelectorAll('main ul')].map(u => u.querySelectorAll('li').length).slice(0, 6),
      signCount: signs.length,
      signSamples: signs.slice(0, 3),
      /* 序所在容器的结构 */
      introParentTag: intro[0] ? intro[0].closest('li') ? 'li' : intro[0].parentElement.tagName : null,
    }, null, 1);
  })()`);
  console.log('折叠态:', info);

  /* 点开序，看看段落是否出现 */
  await ev(`(() => {
    const all = [...document.querySelectorAll('main button')];
    const b = all.find(x => (x.textContent || '').includes('春潋集序'));
    if (b) b.click();
    return b ? 'clicked' : 'not-found';
  })()`);
  await sleep(900);
  const after = await ev(`(() => {
    const li = [...document.querySelectorAll('main li')].find(x => x.textContent.includes('春潋集序'));
    return JSON.stringify({
      paras: li ? li.querySelectorAll('p').length : 0,
      date: li ? (li.querySelector('.mono-label:last-child')?.textContent || '') : '',
      firstPara: li ? (li.querySelector('p')?.textContent || '').slice(0, 60) : '',
      innerTag: li ? li.parentElement.tagName : null,
    }, null, 1);
  })()`);
  console.log('展开序之后:', after);
} catch (e) { console.error('异常：', e.message); }
finally { try { ws?.close(); } catch {} child.kill(); await sleep(300); }
