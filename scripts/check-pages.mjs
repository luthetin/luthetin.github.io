/* 验证"GitHub Pages 上的仓库根目录"这套产物：
   首页、深链（走 404 回退）、旧地址跳转页，以及页面内的实际渲染与报错。 */

import { spawn } from 'node:child_process';
import { existsSync, rmSync, mkdirSync } from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9341;
const ROOT = 'C:\\Users\\Luthetin\\Desktop\\web-v2';
const profile = `${ROOT}\\.edge-profile-pages`;
const OUT = `${ROOT}\\.shots-pages`;
const BASE = process.argv[2] || 'http://127.0.0.1:4180';
if (existsSync(profile)) rmSync(profile, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const child = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore', windowsHide: true });

let ws, seq = 0; const pending = new Map(); const logs = [];
function send(m, p = {}, t = 20000) { const id = ++seq; return new Promise((res, rej) => { pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method: m, params: p })); setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('timeout ' + m)); } }, t); }); }
async function ev(e) { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true }); return r.result?.value; }

const results = [];
function check(name, pass, detail = '') { results.push(pass); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  → ' + detail : ''}`); }

const probe = `JSON.stringify({
  url: location.href,
  path: location.pathname + location.hash,
  sections: document.querySelectorAll('section').length,
  h: document.documentElement.scrollHeight,
  h1: (document.querySelector('h1,.display')?.textContent || '').replace(/\\s+/g,''),
  brokenImgs: [...document.querySelectorAll('img')].filter(i => i.complete && i.naturalWidth === 0).length,
  canvases: document.querySelectorAll('canvas').length,
})`;

try {
  let u = null;
  for (let i = 0; i < 60 && !u; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`); u = (await r.json()).find(t => t.type === 'page')?.webSocketDebuggerUrl; } catch {} if (!u) await sleep(500); }
  ws = new WebSocket(u);
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); return; }
    if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + m.params.exceptionDetails.text + ' :: ' + (m.params.exceptionDetails.exception?.description || '').split('\n')[0]);
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') logs.push('ERR ' + m.params.entry.text + ' ' + (m.params.entry.url || ''));
  });
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  /* 1) 首页 */
  logs.length = 0;
  await send('Page.navigate', { url: BASE + '/' }, 20000);
  await sleep(3500);
  let r = JSON.parse(await ev(probe));
  check('首页渲染', r.sections >= 5 && r.h > 3000, `sections=${r.sections} scrollH=${r.h}`);
  check('首页大标题', r.h1 === '写代码，也写诗', r.h1);
  check('首页照片加载', r.brokenImgs === 0, `坏图 ${r.brokenImgs}`);
  check('首页无报错', logs.length === 0, logs.slice(0, 3).join(' | ') || '(无)');

  /* 2) 详情页直链（走 404.html 回退，与 GitHub Pages 行为一致） */
  for (const [name, p, expectPoems] of [['程序', '/work/code', 0], ['诗歌', '/work/poetry', 25], ['自媒体', '/work/media', 0]]) {
    logs.length = 0;
    await send('Page.navigate', { url: BASE + p }, 20000);
    await sleep(3200);
    const d = JSON.parse(await ev(probe));
    const ok = d.h > 900 && d.sections === 0 && d.h1 && d.brokenImgs === 0;
    check(`深链 ${p} 经 404 回退后渲染`, !!ok, `h=${d.h} h1=${d.h1} 坏图=${d.brokenImgs}`);
    /* 404.html 里的兜底脚本应当把地址恢复成原始深链 */
    check(`深链 ${p} 地址已恢复成原始路径`, d.path === p, `实际 ${d.path}`);
    if (expectPoems) {
      const n = await ev(`document.querySelectorAll('[data-poem]').length`);
      check(`深链 ${p} 诗条数量`, n === expectPoems, `${n} 条`);
    }
    if (logs.length) console.log('    报错：' + logs.slice(0, 2).join(' | '));
  }

  /* 3) 旧地址跳转页 */
  for (const [from, want] of [['/poetry.html', '/#/work/poetry'], ['/explore-hub.html', '/#/work/code'], ['/geostructure-builder.html', '/#/work/code'], ['/projects.html', '/']]) {
    await send('Page.navigate', { url: BASE + from }, 20000);
    await sleep(3000);
    const d = JSON.parse(await ev(probe));
    check(`旧地址 ${from} 跳到 ${want}`, d.path === want || (want === '/' && d.path === '/'), `实际 ${d.path} h=${d.h}`);
  }

  /* 4) 旧站首页应当已经是新站（不该还能看到旧站的 hero 结构） */
  await send('Page.navigate', { url: BASE + '/' }, 20000);
  await sleep(3000);
  const legacyGone = await ev(`document.querySelectorAll('link[href*="assets/css/style.css"], script[src*="assets/js/main.js"]').length`);
  check('旧站资源已不被引用', legacyGone === 0, `引用数 ${legacyGone}`);

  console.log(`\n合计 ${results.length} 项，失败 ${results.filter(x => !x).length} 项`);
} catch (e) { console.error('验证异常：', e.message); process.exitCode = 1; }
finally { try { ws?.close(); } catch {} child.kill(); await sleep(300); }
