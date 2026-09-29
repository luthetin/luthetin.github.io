/* 交互自测：在真实浏览器里点一遍关键交互，回报 DOM 变化。
   覆盖：诗展开 / 译文 / 注释 / 目录切换 / 移动端菜单 / 导航锚点 / 返回链接 */

import { spawn } from 'node:child_process';
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9336;
const ROOT = 'C:\\Users\\Luthetin\\Desktop\\web-v2';
const profile = `${ROOT}\\.edge-profile-test`;
const outDir = `${ROOT}\\.shots-test`;
if (existsSync(profile)) rmSync(profile, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

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
    '--force-prefers-reduced-motion', // 关掉入场动效，避免测量受动画中间态干扰
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    'about:blank',
  ],
  { stdio: 'ignore', windowsHide: true },
);

let ws;
let seq = 0;
const pending = new Map();
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
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
}

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  → ' + detail : ''}`);
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
    }
  });
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });

  await send('Page.enable');
  await send('Runtime.enable');

  /* ---------------------------------------------------- 桌面：诗歌页交互 */
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send('Page.navigate', { url: 'http://localhost:4173/work/poetry' }, 15000);
  await sleep(3000);

  const poemCount = await ev(`document.querySelectorAll('[data-poem]').length`);
  const bookTotals = await ev(`(() => {
    const btns = [...document.querySelectorAll('button')].filter(b => /《.+集》/.test(b.textContent) && /首/.test(b.textContent));
    return btns.map(b => b.textContent.replace(/\\s+/g, ' ').trim());
  })()`);
  check(
    '诗歌条目渲染（默认《春潋集》25 首）',
    poemCount === 25 && bookTotals.length === 2,
    `${poemCount} 条；选集：${bookTotals.join(' / ')}`,
  );

  const firstTitle = await ev(
    `document.querySelector('[data-poem] button[aria-expanded]')?.textContent?.trim() || ''`,
  );
  check('存在可展开的诗条', !!firstTitle, firstTitle);

  // 点开第一首
  await ev(`document.querySelector('[data-poem] button[aria-expanded]').click(); 1`);
  await sleep(700);
  const opened = await ev(
    `(() => { const p = document.querySelector('[data-poem]'); return { expanded: p.querySelector('button[aria-expanded]')?.getAttribute('aria-expanded'), text: (p.innerText||'').length }; })()`,
  );
  check('点开后展开', opened.expanded === 'true', `内容长度 ${opened.text}`);

  // 译文 / 注释按钮
  const toggles = await ev(`(() => {
    const p = document.querySelector('[data-poem]');
    const btns = [...p.querySelectorAll('button')].map(b => b.textContent.trim());
    return btns;
  })()`);
  check('展开后出现译文/注释按钮', toggles.some((t) => t.includes('译文')), toggles.join(' | '));

  const yw = await ev(`(() => {
    const p = document.querySelector('[data-poem]');
    const b = [...p.querySelectorAll('button')].find(x => x.textContent.includes('译文'));
    if (!b) return null;
    const before = (p.innerText||'').length;
    b.click();
    return before;
  })()`);
  await sleep(600);
  const afterYw = await ev(`(document.querySelector('[data-poem]').innerText||'').length`);
  check('译文按钮真的有内容出现', yw !== null && afterYw > yw, `${yw} → ${afterYw} 字符`);

  // 目录切换
  const bookSwitch = await ev(`(() => {
    const btns = [...document.querySelectorAll('button')].filter(b => /《.+集》/.test(b.textContent));
    if (btns.length < 2) return 'only ' + btns.length;
    btns[1].click();
    return btns.length;
  })()`);
  await sleep(700);
  const heading = await ev(`document.querySelector('h2, h3')?.textContent || ''`);
  const dirTitle = await ev(`(() => {
    const el = [...document.querySelectorAll('*')].find(e => e.children.length===0 && /《.+集》目录/.test(e.textContent));
    return el ? el.textContent.trim() : '';
  })()`);
  check('目录可切到另一本诗集', /行吟集/.test(dirTitle), `当前目录：${dirTitle} (按钮数 ${bookSwitch})`);

  /* ---------------------------------------------------- 桌面：导航锚点 */
  await send('Page.navigate', { url: 'http://localhost:4173/' }, 15000);
  await sleep(3000);
  const beforeY = await ev('window.scrollY');
  await ev(`(() => { const a = [...document.querySelectorAll('a')].find(x => x.textContent.trim() === '作品'); a.click(); return 1; })()`);
  await sleep(1400);
  const afterY = await ev('window.scrollY');
  check('导航“作品”能滚到精选项目', afterY > beforeY + 200, `scrollY ${beforeY} → ${afterY}`);

  const workTop = await ev(`document.getElementById('work')?.getBoundingClientRect().top ?? -999`);
  check('滚动位置落在作品区', Math.abs(workTop) < 180, `#work top=${Math.round(workTop)}`);

  /* ---------------------------------------------------- 详情页返回 */
  await send('Page.navigate', { url: 'http://localhost:4173/work/code' }, 15000);
  await sleep(2500);
  const back = await ev(`(() => {
    const a = [...document.querySelectorAll('a')].find(x => x.textContent.includes('返回作品'));
    return a ? a.getAttribute('href') : null;
  })()`);
  check('详情页有返回入口', !!back, String(back));

  const gh = await ev(`(() => {
    const a = [...document.querySelectorAll('a[href^="http"]')].map(x => x.href);
    return { count: a.length, sample: a.slice(0, 3) };
  })()`);
  check('详情页外链存在且为绝对地址', gh.count > 0 && gh.sample.every((h) => h.startsWith('http')), `${gh.count} 个：${gh.sample.join(', ')}`);

  /* ---------------------------------------------------- 移动端菜单 */
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await send('Page.navigate', { url: 'http://localhost:4173/' }, 15000);
  await sleep(2500);
  const menuBefore = await ev(`document.getElementById('mobile-menu') ? 1 : 0`);
  await ev(`document.querySelector('header button[aria-controls="mobile-menu"]').click(); 1`);
  await sleep(800);
  const menuOpen = await ev(`(() => {
    const m = document.getElementById('mobile-menu');
    if (!m) return { open: false };
    const items = [...m.querySelectorAll('[data-menu-item]')];
    const rect = m.getBoundingClientRect();
    return { open: true, items: items.length, h: Math.round(rect.height), body: document.body.style.overflow,
             opacities: items.map(i => getComputedStyle(i).opacity) };
  })()`);
  check('移动端能打开菜单', menuBefore === 0 && menuOpen.open === true, JSON.stringify(menuOpen));

  // 菜单里点“联系”
  await ev(`(() => { const m = document.getElementById('mobile-menu'); const a = [...m.querySelectorAll('a')].find(x => x.textContent.includes('联系')); a.click(); return 1; })()`);
  await sleep(1400);
  const afterMenu = await ev(`({ menu: !!document.getElementById('mobile-menu'), y: window.scrollY, body: document.body.style.overflow })`);
  check('菜单点“联系”后自动关闭并滚动', afterMenu.menu === false && afterMenu.y > 500, JSON.stringify(afterMenu));

  writeFileSync(`${outDir}/interaction.json`, JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.ok);
  console.log(`\n合计 ${results.length} 项，失败 ${failed.length} 项`);
} catch (e) {
  console.error('交互自测异常：', e.message);
  process.exitCode = 1;
} finally {
  try {
    ws?.close();
  } catch {}
  child.kill();
  await sleep(400);
}
