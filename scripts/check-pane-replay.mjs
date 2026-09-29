/* 验证：点"译文"时正文不应重播入场动效
   做法：展开→等动画结束→记录正文行透明度→点译文→每 100ms 采样一次，
   如果这些值始终为 1，说明没有重播；若中途掉到 0 再升回来，就是又播了一遍。 */

import { spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9399;
const ROOT = 'C:\\Users\\Luthetin\\Desktop\\web-v2';
const profile = `${ROOT}\\.edge-pane`;
if (existsSync(profile)) rmSync(profile, { recursive: true, force: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const child = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore', windowsHide: true });
let ws, seq = 0; const pending = new Map();
function send(m, p = {}, t = 20000) { const id = ++seq; return new Promise((res, rej) => { pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method: m, params: p })); setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('timeout ' + m)); } }, t); }); }
async function ev(e, t = 12000) { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true }, t); return r.result?.value; }

const SAMPLE = `JSON.stringify({
  lines: [...document.querySelectorAll('[data-poem][data-open="true"] [data-line]')]
    .map(el => +(+getComputedStyle(el).opacity).toFixed(2)),
  panes: [...document.querySelectorAll('[data-poem][data-open="true"] [data-pane]')]
    .map(el => +(+getComputedStyle(el).opacity).toFixed(2)),
})`;

try {
  let u = null;
  for (let i = 0; i < 60 && !u; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`); u = (await r.json()).find((t) => t.type === 'page')?.webSocketDebuggerUrl; } catch {} if (!u) await sleep(500); }
  ws = new WebSocket(u);
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); } });
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

  await send('Page.navigate', { url: 'http://localhost:4173/work/poetry' }, 25000);
  await sleep(4000);

  /* 展开第一首 */
  await ev(`(() => { const b = document.querySelector('[data-poem] button[aria-expanded]'); b.click(); return 1; })()`);
  await sleep(2600); // 等入场动效彻底结束
  const before = JSON.parse(await ev(SAMPLE));
  console.log('展开后（动画已结束）:', JSON.stringify(before));

  /* 点译文，随后密集采样 */
  await ev(`(() => {
    const item = document.querySelector('[data-poem][data-open="true"]');
    const b = [...item.querySelectorAll('button')].find(x => x.textContent.trim() === '译文');
    if (b) b.click();
    return 1;
  })()`);

  const samples = [];
  for (let i = 0; i < 8; i++) {
    samples.push(JSON.parse(await ev(SAMPLE)));
    await sleep(110);
  }

  const minLine = Math.min(...samples.flatMap((s) => s.lines));
  const lastPanes = samples[samples.length - 1].panes;
  console.log('点译文后正文行透明度最小值:', minLine);
  console.log('译文面板最后透明度:', JSON.stringify(lastPanes));

  const replay = minLine < 0.9;
  console.log(replay ? '✗ 正文又重播了一遍（透明度掉到 ' + minLine + '）' : '✓ 正文没有重播（始终为 1）');
  console.log(lastPanes.length && lastPanes.every((v) => v > 0.9) ? '✓ 译文面板正常显示' : '✗ 译文面板未显示');
  process.exitCode = replay ? 1 : 0;
} catch (e) { console.error('异常：', e.message); process.exitCode = 1; }
finally { try { ws?.close(); } catch {} child.kill(); await sleep(300); }
