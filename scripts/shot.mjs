/* ----------------------------------------------------------------------------
   Edge(Chromium) 无头驱动：用 CDP 精确测量页面并出图
   用法：node scripts/shot.mjs <outDir> [--full] [--w 1440] [--h 900] [--url ...] [--still]
   产出：<页名>-<宽>.png / <页名>-<宽>-fullpage.png / measure.json
   -------------------------------------------------------------------------- */

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9333;
const ROOT = 'C:\\Users\\Luthetin\\Desktop\\web-v2';

const argv = process.argv.slice(2);
const outDir = path.resolve(argv[0] || path.join(ROOT, '.shots'));
const arg = (n, d) => {
  const i = argv.indexOf('--' + n);
  return i >= 0 ? argv[i + 1] : d;
};
const flag = (n) => argv.includes('--' + n);

const BASE = arg('url', 'http://localhost:4173');
const WIDTHS = (arg('w', '1440')).split(',').map(Number);
const HEIGHT = Number(arg('h', 900));
const STILL = flag('still');
/** --nofreeze：不冻结 canvas（想看到 canvas 绘制的内容时必须用，代价是截图慢很多） */
const NOFREEZE = flag('nofreeze');
const ONLY = arg('only', '');
/** --crops 0,1600,3200 → 在整页图上按这些 y 起点再切几张 1600px 高的分段图（便于逐段核对） */
const CROPS = arg('crops', '')
  .split(',')
  .filter(Boolean)
  .map(Number);
const CROP_H = Number(arg('cropH', 1600));

const PAGES = [
  { name: 'home', url: '/' },
  { name: 'code', url: '/work/code' },
  { name: 'media', url: '/work/media' },
  { name: 'poetry', url: '/work/poetry' },
];

mkdirSync(outDir, { recursive: true });

const profile = path.join(ROOT, '.edge-profile');
if (existsSync(profile)) rmSync(profile, { recursive: true, force: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ 启动 */
const child = spawn(
  EDGE,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-sync',
    '--hide-scrollbars',
    '--force-color-profile=srgb',
    '--use-angle=swiftshader', // 无 GPU 环境下让 WebGL 也能起来
    '--enable-unsafe-swiftshader',
    'about:blank',
  ],
  { stdio: 'ignore', windowsHide: true },
);

let ws = null;
let seq = 0;
const pending = new Map();
const events = [];

function send(method, params = {}, timeout = 20000) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error('timeout: ' + method));
      }
    }, timeout);
  });
}

/** 等一个 CDP 事件（带超时，超时不算失败） */
function once(method, timeout = 8000) {
  return new Promise((resolve) => {
    const t = setTimeout(() => {
      const i = events.indexOf(h);
      if (i >= 0) events.splice(i, 1);
      resolve(false);
    }, timeout);
    const h = (msg) => {
      clearTimeout(t);
      const i = events.indexOf(h);
      if (i >= 0) events.splice(i, 1);
      resolve(true);
    };
    h.method = method;
    events.push(h);
  });
}

async function waitForEndpoint() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await r.json();
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      /* 端口还没起来 */
    }
    await sleep(500);
  }
  throw new Error('Edge 调试端口未就绪');
}

const MEASURE = `(() => {
  const de = document.documentElement;
  const out = {
    title: document.title,
    scrollH: de.scrollHeight,
    clientH: de.clientHeight,
    scrollW: de.scrollWidth,
    clientW: de.clientWidth,
    bodyChildren: [...document.body.children].map(el => ({
      tag: el.tagName.toLowerCase(),
      cls: (el.className && el.className.toString().slice(0, 70)) || '',
      h: Math.round(el.getBoundingClientRect().height),
    })),
    tall: [...document.querySelectorAll('*')]
      .map(el => ({ el, r: el.getBoundingClientRect() }))
      .filter(x => x.r.height > 1400)
      .slice(0, 14)
      .map(x => ({
        tag: x.el.tagName.toLowerCase(),
        id: x.el.id || '',
        cls: (x.el.className && x.el.className.toString().slice(0, 90)) || '',
        h: Math.round(x.r.height),
        w: Math.round(x.r.width),
      })),
    sections: [...document.querySelectorAll('section, main > *, header')].map(el => ({
      tag: el.tagName.toLowerCase(),
      id: el.id || '',
      h: Math.round(el.getBoundingClientRect().height),
      top: Math.round(el.getBoundingClientRect().top + window.scrollY),
    })),
    canvases: [...document.querySelectorAll('canvas')].map(c => ({ w: c.width, h: c.height })),
    brokenImgs: [...document.querySelectorAll('img')].filter(i => i.complete && i.naturalWidth === 0).map(i => i.currentSrc || i.src),
  };
  return JSON.stringify(out);
})()`;

/* ------------------------------------------------------------------ 主流程 */
let exitCode = 0;
try {
  const url = await waitForEndpoint();
  ws = new WebSocket(url);
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
      return;
    }
    if (msg.method) {
      for (const h of [...events]) {
        if (h.method === msg.method) h(msg.params);
      }
    }
  });
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });

  await send('Page.enable');
  await send('Runtime.enable');

  const targets = PAGES.filter((p) => !ONLY || p.name === ONLY);
  const report = {};

  for (const w of WIDTHS) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: w,
      height: HEIGHT,
      deviceScaleFactor: 1,
      mobile: w < 700,
    });

    for (const page of targets) {
      const target = BASE + page.url;
      try {
        await send('Page.navigate', { url: target }, 15000);
      } catch (e) {
        console.log(`${page.name}@${w}: navigate 超时（${e.message}），继续`);
      }
      /* 不用 loadEventFired：首屏有常驻动画与一个必然 404 的视频位，
         load 事件不一定按时到。改为轮询"内容真的渲染出来了"。 */
      for (let i = 0; i < 40; i++) {
        await sleep(300);
        try {
          const r = await send(
            'Runtime.evaluate',
            {
              expression: `!!document.querySelector('main section, main article, #root > *')`,
              returnByValue: true,
            },
            4000,
          );
          if (r.result.value === true) break;
        } catch {
          /* 页面还在忙，继续等 */
        }
      }
      await sleep(STILL ? 3600 : 3200);

      /* 冻结绘制：常驻动画与 canvas 会让软件渲染的合成器很难拿到稳定帧
         （实测截图要 8-10 秒，容易顶到超时）。冻结只发生在拍摄的一瞬间，
         拍完立刻恢复，所以不影响页面本身。
         - CSS 动画：暂停
         - canvas：换成 1x1 的同尺寸占位（保留布局），停止重绘 */
      const freezeExpr = `(() => {
        let s = document.getElementById('__freeze');
        if (!s) {
          s = document.createElement('style');
          s.id = '__freeze';
          s.textContent = '*,*::before,*::after{animation-play-state:paused !important;transition:none !important}';
          document.head.appendChild(s);
        }
        const cv = [...document.querySelectorAll('canvas')];
        cv.forEach((c) => {
          if (c.dataset.frozen) return;
          c.dataset.frozen = '1';
          /* 只隐藏、不改尺寸：改 width/height 会清空画布内容，
             恢复后就是一张空白图；隐藏只是让合成器不再处理它。 */
          c.style.visibility = 'hidden';
        });
        return 1;
      })()`;
      const thawExpr = `(() => {
        document.querySelectorAll('canvas[data-frozen]').forEach((c) => {
          c.style.visibility = '';
          delete c.dataset.frozen;
        });
        return 1;
      })()`;
      const setFreeze = async (on) => {
        if (NOFREEZE) return;
        try {
          await send('Runtime.evaluate', { expression: on ? freezeExpr : thawExpr }, 8000);
        } catch {
          /* 忽略 */
        }
      };
      await setFreeze(true);

      if (STILL) {
        // 把所有入场动效直接推到落定状态（不动源文件）
        try {
          await send(
            'Runtime.evaluate',
            {
              expression: `(() => {
            document.querySelectorAll('*').forEach(el => {
              // 跳过 .num：那里是 GSAP 计数动画在写 textContent，
              // 强行置 1 会把数字截断成动画中途的值（例如 44 变成 35）。
              if (el.classList && el.classList.contains('num')) return;
              const s = getComputedStyle(el);
              if (parseFloat(s.opacity) < 0.99 && el.getBoundingClientRect().height > 0) el.style.opacity = '1';
              if (s.transform && s.transform !== 'none') el.style.transform = 'none';
            });
            window.scrollTo(0, 0);
            return 1;
          })()`,
            },
            8000,
          );
        } catch {
          /* 忽略 */
        }
        await sleep(900);
      }

      const m = await send(
        'Runtime.evaluate',
        { expression: MEASURE, returnByValue: true },
        15000,
      );
      const data = JSON.parse(m.result.value);
      report[`${page.name}@${w}`] = data;

      /* 视口图。
         注意：这台机器上 captureBeyondViewport / clip 会让渲染进程直接卡死
         （连 Runtime.evaluate 都会跟着超时），所以整页与分段一律改成
         「滚动 + 视口截图」，只用最朴素的 fromSurface 捕获。 */
      const shoot = async (file) => {
        const r = await send('Page.captureScreenshot', { format: 'png', fromSurface: true }, 20000);
        writeFileSync(path.join(outDir, file), Buffer.from(r.data, 'base64'));
      };

      await send('Runtime.evaluate', { expression: 'window.scrollTo(0,0); 1' }, 8000).catch(() => {});
      await sleep(500);
      await shoot(`${page.name}-${w}.png`);

      /* 按视口高度逐屏滚动，拍下整页。
         用视口高度而不是更小的步长：一屏一张，张数等于页数，快且不重不漏。 */
      const viewportH = await send(
        'Runtime.evaluate',
        { expression: 'window.innerHeight', returnByValue: true },
        8000,
      ).then((r) => r.result.value).catch(() => HEIGHT);

      const total = data.scrollH;
      const shots = Math.max(1, Math.ceil(total / viewportH));
      let ok = 0;
      for (let i = 0; i < shots; i++) {
        const y = Math.min(i * viewportH, Math.max(0, total - viewportH));
        try {
          await send('Runtime.evaluate', { expression: `window.scrollTo(0, ${y}); 1`, returnByValue: true }, 8000);
          await sleep(i === 0 ? 300 : 750); // 给 ScrollTrigger 留出触发时间
          await shoot(`${page.name}-${w}-p${String(i).padStart(2, '0')}.png`);
          ok++;
        } catch (e) {
          console.log(`${page.name}@${w}: 第 ${i} 屏失败（${e.message}）`);
          break;
        }
      }
      console.log(`${page.name}@${w}: scrollH=${total} 视口高=${viewportH} 共 ${shots} 屏，成功 ${ok} 屏`);
      await setFreeze(false);
      await send('Runtime.evaluate', { expression: 'window.scrollTo(0,0); 1' }, 8000).catch(() => {});

      // 每页都落盘一次测量结果，避免中途失败丢数据
      writeFileSync(path.join(outDir, 'measure.json'), JSON.stringify(report, null, 2));
    }
  }

  writeFileSync(path.join(outDir, 'measure.json'), JSON.stringify(report, null, 2));
  console.log('measure.json 已写出：' + path.join(outDir, 'measure.json'));
} catch (e) {
  console.error('shot.mjs 失败：', e.message);
  exitCode = 1;
} finally {
  try {
    ws?.close();
  } catch {}
  child.kill();
  await sleep(400);
}

process.exit(exitCode);
