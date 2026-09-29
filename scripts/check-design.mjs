/* 设计升级后的专项验证：
   1) 统计数字必须是最终值（不能被入场动效截断）
   2) ?still=1 必须真的关掉装饰动效，且内容全部可见
   3) 手机端版式与首屏高度
   4) 中文字体是否落到了衬线（宋体栈） */

import { spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9355;
const ROOT = 'C:\\Users\\Luthetin\\Desktop\\web-v2';
const profile = `${ROOT}\\.edge-profile-verify`;
const BASE = 'http://localhost:4173';
if (existsSync(profile)) rmSync(profile, { recursive: true, force: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const child = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore', windowsHide: true });

let ws, seq = 0; const pending = new Map();
function send(m, p = {}, t = 20000) { const id = ++seq; return new Promise((res, rej) => { pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method: m, params: p })); setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('timeout ' + m)); } }, t); }); }
async function ev(e, t = 15000) { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true }, t); return r.result?.value; }

const results = [];
function check(name, pass, detail = '') { results.push(pass); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  → ' + detail : ''}`); }

try {
  let u = null;
  for (let i = 0; i < 60 && !u; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`); u = (await r.json()).find(t => t.type === 'page')?.webSocketDebuggerUrl; } catch {} if (!u) await sleep(500); }
  ws = new WebSocket(u);
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); } });
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  /* ---------- 1) 统计数字（正常动效，等计数跑完） ---------- */
  /* ?noperf=1 跳过帧率探测：无头软件渲染一定被判定为慢设备，
     那样就看不到装饰动效了。探测逻辑本身另测。 */
  await send('Page.navigate', { url: BASE + '/?noperf=1' }, 20000);
  await sleep(5500);
  await ev(`document.getElementById('experience').scrollIntoView(); 1`);
  await sleep(3500); // 计数 1.5s + 余量
  const nums = await ev(`JSON.stringify([...document.querySelectorAll('#experience .num')].map(e => e.textContent.trim()).filter(t => /^\\d+$/.test(t)))`);
  const parsed = JSON.parse(nums);
  check('统计数字为最终值', JSON.stringify(parsed) === JSON.stringify(['44', '2', '232', '6']), nums);

  /* 衬线字体是否生效（标题应落到 Noto Serif SC 而不是黑体） */
  const fonts = await ev(`JSON.stringify({
    hero: getComputedStyle(document.querySelector('.display-serif-cn')).fontFamily.split(',')[0],
    verse: getComputedStyle(document.querySelector('.verse') || document.body).fontFamily.split(',')[0],
    body: getComputedStyle(document.body).fontFamily.split(',')[0],
  })`);
  const f = JSON.parse(fonts);
  check('首屏标题为中文衬线', /Noto Serif SC/i.test(f.hero), f.hero);
  check('正文仍为无衬线（不进正文）', /Geist|PingFang/i.test(f.body), f.body);

  /* 装饰动效确实存在（极光层挂上了动画） */
  const anim = await ev(`(() => {
    const i = document.querySelector('.aurora i');
    if (!i) return 'no-aurora';
    const s = getComputedStyle(i);
    return s.animationName + ' / ' + s.animationDuration;
  })()`);
  check('极光动画在跑（非静态模式）', /aurora-drift/.test(anim), anim);

  /* ---------- 2) ?still=1 ---------- */
  await send('Page.navigate', { url: BASE + '/?still=1' }, 20000);
  await sleep(4000);
  const still = await ev(`JSON.stringify({
    htmlClass: document.documentElement.className,
    auroraAnim: (() => { const i = document.querySelector('.aurora i'); return i ? getComputedStyle(i).animationName : 'none'; })(),
    sweepAnim: getComputedStyle(document.querySelector('.sweep-layer'), '::after').animationName,
    heroVisible: (() => { const h = document.querySelector('.display-serif-cn'); return h ? h.getBoundingClientRect().height > 20 : false; })(),
    subOpacity: getComputedStyle(document.querySelector('[data-hero-sub]')).opacity,
    allVisible: [...document.querySelectorAll('#experience, #work, #advantages, #contact, h1, h2')].every(e => e.getBoundingClientRect().height > 0),
    toggleLink: !!document.body.textContent.match(/动效已关/),
  })`);
  const s = JSON.parse(still);
  check('still 模式标记正确', /still-mode/.test(s.htmlClass), s.htmlClass);
  check('still 模式关掉极光动画', s.auroraAnim === 'none', s.auroraAnim);
  check('still 模式关掉扫光', s.sweepAnim === 'none', s.sweepAnim);
  check('still 模式内容仍全部可见', s.heroVisible && s.allVisible && parseFloat(s.subOpacity) > 0.9, `副文 opacity=${s.subOpacity}`);
  check('页脚显示"动效已关"入口', s.toggleLink === true, String(s.toggleLink));

  /* ---------- 2b) 离开 ?still=1 后必须自动恢复动效 ----------
     这一步专门抓"只挂类不摘类"的 bug：SPA 客户端跳转不会重载页面，
     如果类没被移除，用户会被永久锁死在静态模式里。 */
  await send('Page.navigate', { url: BASE + '/?noperf=1' }, 20000);
  await sleep(4500);
  const back = await ev(`JSON.stringify({
    cls: document.documentElement.className,
    auroraAnim: (() => { const i = document.querySelector('.aurora i'); return i ? getComputedStyle(i).animationName : 'none'; })(),
    sweepAnim: getComputedStyle(document.querySelector('.sweep-layer'), '::after').animationName,
  })`);
  const bk = JSON.parse(back);
  check('离开 still 后 still-mode 已移除', !/still-mode/.test(bk.cls), bk.cls);
  check('离开 still 后极光恢复动画', /aurora-drift/.test(bk.auroraAnim), bk.auroraAnim);
  check('离开 still 后扫光恢复', /sweep/.test(bk.sweepAnim), bk.sweepAnim);

  /* ---------- 3) 手机端 ---------- */
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Page.navigate', { url: BASE + '/' }, 20000);
  await sleep(5000);
  const mob = await ev(`JSON.stringify({
    scrollH: document.documentElement.scrollHeight,
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    sections: document.querySelectorAll('section').length,
    heroH: document.querySelector('section').getBoundingClientRect().height,
    headlineSize: parseFloat(getComputedStyle(document.querySelector('.display-serif-cn')).fontSize),
    heroFits: (() => {
      const h = document.querySelector('.display-serif-cn');
      const r = h.getBoundingClientRect();
      return { lines: Math.round(r.height / parseFloat(getComputedStyle(h).lineHeight)), bottom: Math.round(r.bottom) };
    })(),
  })`);
  const mo = JSON.parse(mob);
  check('手机端无横向溢出', mo.scrollW <= mo.clientW + 1, `scrollW=${mo.scrollW} clientW=${mo.clientW}`);
  check('手机端首屏为一屏', mo.heroH <= 844 + 2 && mo.heroH >= 600, `heroH=${Math.round(mo.heroH)}`);
  check('手机端标题字号合理', mo.headlineSize >= 40 && mo.headlineSize <= 60, `${mo.headlineSize}px`);
  check('手机端标题不超过 2 行', mo.heroFits.lines <= 2, `${mo.heroFits.lines} 行`);

  const failed = results.filter((x) => !x).length;
  console.log(`\n合计 ${results.length} 项，失败 ${failed} 项`);
} catch (e) { console.error('验证异常：', e.message); process.exitCode = 1; }
finally { try { ws?.close(); } catch {} child.kill(); await sleep(300); }
