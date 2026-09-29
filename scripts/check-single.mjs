/* 校验离线单文件预览件：file:// 下能否渲染、路由能否切换、字体是否真的生效 */

import { spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9337;
const ROOT = 'C:\\Users\\Luthetin\\Desktop\\web-v2';
const profile = `${ROOT}\\.edge-profile-file`;
const FILE = `file:///${ROOT.replace(/\\/g, '/')}/预览版-双击打开.html`;
if (existsSync(profile)) rmSync(profile, { recursive: true, force: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const child = spawn(
  EDGE,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--hide-scrollbars',
    '--force-prefers-reduced-motion',
    '--allow-file-access-from-files',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    'about:blank',
  ],
  { stdio: 'ignore', windowsHide: true },
);

let ws;
let seq = 0;
const pending = new Map();
const logs = [];
function send(method, params = {}, timeout = 15000) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error('timeout ' + method));
      }
    }, timeout);
  });
}
async function ev(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
}
const ok = [];
function check(name, pass, detail = '') {
  ok.push(pass);
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  → ' + detail : ''}`);
}

try {
  let wsUrl = null;
  for (let i = 0; i < 60 && !wsUrl; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await r.json();
      wsUrl = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
    } catch {}
    if (!wsUrl) await sleep(500);
  }
  if (!wsUrl) throw new Error('端口未就绪');

  ws = new WebSocket(wsUrl);
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? reject(new Error(m.error.message)) : resolve(m.result);
      return;
    }
    if (m.method === 'Runtime.exceptionThrown')
      logs.push('[exception] ' + m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception?.description || ''));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error')
      logs.push('[log.error] ' + m.params.entry.text);
  });
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  await send('Page.navigate', { url: FILE }, 20000);
  await sleep(4000);

  const home = await ev(`JSON.stringify({
    protocol: location.protocol,
    router: location.hash,
    h: document.documentElement.scrollHeight,
    sections: document.querySelectorAll('section').length,
    h1: document.querySelector('h1, .display')?.textContent?.replace(/\s+/g,'') ?? '',
    font: getComputedStyle(document.body).fontFamily,
    geistLoaded: document.fonts ? [...document.fonts].some(f => /Geist/i.test(f.family) && f.status === 'loaded') : null,
    imgOk: (() => { const i = document.querySelector('img'); return i ? i.complete && i.naturalWidth > 0 : null; })(),
    extRes: performance.getEntriesByType('resource').filter(r => !r.name.startsWith('data:')).map(r => r.name).slice(0, 8),
  })`);
  const H = JSON.parse(home);
  check('file:// 下首页渲染出内容', H.h > 3000 && H.sections >= 5, `scrollH=${H.h} sections=${H.sections}`);
  check('大标题渲染正确', H.h1 === '写代码，也写诗', H.h1);
  check('Geist 字体已加载', H.geistLoaded === true, H.font.slice(0, 40));
  check('照片内联可显示', H.imgOk === true, String(H.imgOk));
  check('无外部资源请求（完全离线）', H.extRes.length === 0, H.extRes.join(', ') || '(无)');

  // hash 路由切到详情页
  await ev(`location.hash = '#/work/poetry'; 1`);
  await sleep(2500);
  const poetry = await ev(`JSON.stringify({
    hash: location.hash,
    h: document.documentElement.scrollHeight,
    poems: document.querySelectorAll('[data-poem]').length,
  })`);
  const P = JSON.parse(poetry);
  check('离线件里路由能切到诗歌页', P.poems === 25 && P.h > 1500, `hash=${P.hash} 诗=${P.poems} h=${P.h}`);

  // 展开一首
  await ev(`document.querySelector('[data-poem] button[aria-expanded]').click(); 1`);
  await sleep(600);
  const opened = await ev(`document.querySelector('[data-poem] button[aria-expanded]').getAttribute('aria-expanded')`);
  check('离线件里诗条能展开', opened === 'true', String(opened));

  check('离线运行期间无 JS 报错', logs.length === 0, logs.slice(0, 3).join(' | ') || '(无)');

  console.log(`\n合计 ${ok.length} 项，失败 ${ok.filter((x) => !x).length} 项`);
} catch (e) {
  console.error('离线件校验异常：', e.message);
  process.exitCode = 1;
} finally {
  try {
    ws?.close();
  } catch {}
  child.kill();
  await sleep(400);
}
