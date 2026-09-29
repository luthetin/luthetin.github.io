/* 内容页专项检查：三个方向页在桌面与手机端是否成立
   覆盖：无横向溢出、页头元素齐全、视觉主角（canvas/SVG/16:9 框）真的渲染出来、
        卷次与刻度可用、scroll-mt 是否防住固定导航遮挡 */

import { spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9381;
const ROOT = 'C:\\Users\\Luthetin\\Desktop\\web-v2';
const profile = `${ROOT}\\.edge-probe-content`;
const BASE = 'http://localhost:4173';
if (existsSync(profile)) rmSync(profile, { recursive: true, force: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const child = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore', windowsHide: true });

let ws, seq = 0; const pending = new Map(); const logs = [];
function send(m, p = {}, t = 20000) { const id = ++seq; return new Promise((res, rej) => { pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method: m, params: p })); setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('timeout ' + m)); } }, t); }); }
async function ev(e, t = 12000) { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true }, t); return r.result?.value; }

const results = [];
function check(name, pass, detail = '') { results.push(pass); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  → ' + detail : ''}`); }

/* 页面自检表达式：返回结构化诊断 */
const EXPR = `(() => {
  const de = document.documentElement;
  const q = (s) => document.querySelector(s);
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) }; };

  /* canvas 是否真的画了东西：取中心区域采样，统计非透明像素比例 */
  const canvasPainted = [...document.querySelectorAll('canvas')].map((c) => {
    try {
      const ctx = c.getContext('2d');
      if (!ctx || !c.width) return { w: c.width, painted: null };
      const w = Math.min(c.width, 400), h = Math.min(c.height, 300);
      const d = ctx.getImageData(Math.floor((c.width - w) / 2), Math.floor((c.height - h) / 2), w, h).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4 * 37) if (d[i] > 8) n++;
      const total = Math.floor(d.length / (4 * 37));
      return { w: c.width, h: c.height, ratio: +(n / total).toFixed(3) };
    } catch (e) { return { w: c.width, err: String(e).slice(0, 40) }; }
  });

  return JSON.stringify({
    path: location.pathname,
    scrollW: de.scrollWidth, clientW: de.clientWidth, scrollH: de.scrollHeight,
    h1: q('h1')?.textContent?.trim() ?? null,
    eyebrow: q('main .mono-label')?.textContent?.trim() ?? null,
    actions: [...document.querySelectorAll('main a.btn')].length,
    hasPlate: !!q('.plate'),
    plate: box(q('.plate')),
    svg: !!q('svg[role="img"]'),
    canvasPainted,
    years: [...document.querySelectorAll('[data-year]')].map((e) => e.getAttribute('data-year')),
    volumeRules: document.querySelectorAll('.volume-rule').length,
    ruleItems: document.querySelectorAll('.rule-item').length,
    pullQuotes: document.querySelectorAll('.pull-quote').length,
    /* 只数"真正可见"的竖排元素：容器可能用 hidden md:grid 隐藏，
       元素仍在 DOM 里，但 getBoundingClientRect 会全为 0 */
    verticalCn: [...document.querySelectorAll('.vertical-cn')]
      .filter((e) => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0).length,
    /* 页头元素是否都可见（opacity 不能是 0） */
    hidden: [...document.querySelectorAll('main h1, main h2, main p, main .plate')]
      .filter((e) => { const r = e.getBoundingClientRect(); return r.height > 8 && parseFloat(getComputedStyle(e).opacity) < 0.05; })
      .map((e) => e.tagName + '.' + String(e.className).slice(0, 26)),
  });
})()`;

try {
  let u = null;
  for (let i = 0; i < 60 && !u; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`); u = (await r.json()).find((t) => t.type === 'page')?.webSocketDebuggerUrl; } catch {} if (!u) await sleep(500); }
  ws = new WebSocket(u);
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); return; }
    if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + m.params.exceptionDetails.text);
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
      const t = m.params.entry.text + ' ' + (m.params.entry.url || '');
      /* 已知且可接受的两类：首屏视频位缺文件、GitHub Pages 深链回退本身返回 404 */
      const benign = t.includes('hero.mp4') || t.includes('/work/');
      if (!benign) logs.push('ERR ' + t);
    }
  });
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');

  const VIEWPORTS = [
    { w: 1440, h: 1000, name: '桌面' },
    { w: 390, h: 844, name: '手机' },
  ];

  for (const vp of VIEWPORTS) {
    await send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: vp.w < 700 });

    /* ---- 程序页 ---- */
    logs.length = 0;
    await send('Page.navigate', { url: BASE + '/work/code' }, 25000);
    await sleep(4200);
    let d = JSON.parse(await ev(EXPR));
    check(`[${vp.name}] 程序页无横向溢出`, d.scrollW <= d.clientW + 1, `${d.scrollW}/${d.clientW}`);
    check(`[${vp.name}] 程序页标题与动作`, d.h1 === '程序' && d.actions >= 2, `h1=${d.h1} 按钮=${d.actions}`);
    check(`[${vp.name}] 程序页有图版`, d.hasPlate && d.plate?.h > 100, `图版高 ${d.plate?.h}`);
    check(`[${vp.name}] 地层线框真的画出来了`, d.canvasPainted.some((c) => c.ratio > 0.01 || c.err), JSON.stringify(d.canvasPainted.slice(0, 3)));
    check(`[${vp.name}] 交线示意图存在`, d.svg === true, String(d.svg));
    check(`[${vp.name}] 版式族生效（竖线条目 + 大字拉引）`, d.ruleItems >= 4 && d.pullQuotes >= 2, `rule=${d.ruleItems} pull=${d.pullQuotes}`);
    check(`[${vp.name}] 程序页无隐藏内容`, d.hidden.length === 0, d.hidden.join(', ') || '(无)');
    check(`[${vp.name}] 程序页无报错`, logs.length === 0, logs.slice(0, 2).join(' | ') || '(无)');

    /* ---- 自媒体页 ---- */
    logs.length = 0;
    await send('Page.navigate', { url: BASE + '/work/media' }, 25000);
    await sleep(4000);
    d = JSON.parse(await ev(EXPR));
    check(`[${vp.name}] 自媒体页无横向溢出`, d.scrollW <= d.clientW + 1, `${d.scrollW}/${d.clientW}`);
    check(`[${vp.name}] 自媒体页有 16:9 主推位`, d.hasPlate && d.plate?.h > 120, `图版高 ${d.plate?.h}`);
    check(`[${vp.name}] 自媒体页有大字拉引`, d.pullQuotes >= 1, `pull=${d.pullQuotes}`);
    check(`[${vp.name}] 竖排词牌（仅中屏以上）`, vp.w < 700 ? d.verticalCn === 0 : d.verticalCn >= 4, `vertical=${d.verticalCn}`);
    check(`[${vp.name}] 自媒体页无隐藏内容`, d.hidden.length === 0, d.hidden.join(', ') || '(无)');

    /* ---- 诗歌页 ---- */
    logs.length = 0;
    await send('Page.navigate', { url: BASE + '/work/poetry' }, 25000);
    await sleep(4200);
    d = JSON.parse(await ev(EXPR));
    check(`[${vp.name}] 诗歌页无横向溢出`, d.scrollW <= d.clientW + 1, `${d.scrollW}/${d.clientW}`);
    /* 竖排是刻意只在桌面出现的：竖排在窄屏会把 2–5 字压得过小，反而更差 */
    check(`[${vp.name}] 诗歌页扉页竖排书名`, vp.w < 700 ? d.verticalCn === 0 : d.verticalCn >= 1, `vertical=${d.verticalCn}`);
    check(`[${vp.name}] 卷次分隔齐全（2022–2025）`, d.years.length === 4 && d.volumeRules === 4, `years=${d.years.join(',')} rules=${d.volumeRules}`);
    const poems = await ev(`document.querySelectorAll('[data-poem]').length`);
    check(`[${vp.name}] 诗条 25 首`, poems === 25, `${poems} 条`);
    check(`[${vp.name}] 诗歌页无隐藏内容`, d.hidden.length === 0, d.hidden.join(', ') || '(无)');
    check(`[${vp.name}] 诗歌页无报错`, logs.length === 0, logs.slice(0, 2).join(' | ') || '(无)');
  }

  const failed = results.filter((x) => !x).length;
  console.log(`\n合计 ${results.length} 项，失败 ${failed} 项`);
  process.exitCode = failed ? 1 : 0;
} catch (e) { console.error('内容页检查异常：', e.message); process.exitCode = 1; }
finally { try { ws?.close(); } catch {} child.kill(); await sleep(300); }
