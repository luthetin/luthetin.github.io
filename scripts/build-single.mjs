// 把 dist 打包结果内联成一个可双击打开的单文件 HTML（file:// 下也能跑，含 hash 路由）
// 用途：1) 给用户一个离线预览件  2) 让截图工具能渲染核验
import fs from 'node:fs';
import path from 'node:path';

const DIST = 'C:/Users/Luthetin/Desktop/web-v2/dist';
const args = process.argv.slice(2);
const out = args[0];
const route = args[1] ?? '/';
if (!out) throw new Error('用法: node build-single.mjs <输出html> [route]');

let html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');

/* ---------- 1) CSS 内联（并把字体文件转成 data URI） ---------- */
const cssLinkRe = /<link rel="stylesheet"[^>]*?href="\.?\/?(assets\/[^"]+\.css)"[^>]*?>/;
const cssMatch = html.match(cssLinkRe);
if (!cssMatch) throw new Error('未找到 CSS 引用');
let css = fs.readFileSync(path.join(DIST, cssMatch[1]), 'utf8');
// CSS 里的字体路径是相对 CSS 文件自身目录（dist/assets/）而不是 dist/
const cssDir = path.dirname(path.join(DIST, cssMatch[1]));

let fontCount = 0;
css = css.replace(/url\((["']?)([^"')]+\.(?:woff2|woff))\1\)/g, (full, _q, rel) => {
  // base 是 '/' 时这里形如 /assets/xxx.woff2（相对 dist 根）；
  // 若改成相对写法则是相对 CSS 文件自身目录（dist/assets/），两种都兜住。
  const clean = rel.replace(/^\.?\//, '');
  const p = [path.join(DIST, clean), path.join(cssDir, clean)].find((x) => fs.existsSync(x));
  if (!p) return full;
  fontCount++;
  const mime = p.endsWith('.woff2') ? 'font/woff2' : 'font/woff';
  return `url(data:${mime};base64,${fs.readFileSync(p).toString('base64')})`;
});

html = html.replace(cssLinkRe, () => `<style>\n${css}\n</style>`);

/* ---------- 2) JS 内联 ---------- */
// 用“精确串”而不是宽泛字符类来定位，避免匹配跨过标签边界
// （Node 的报错信息里会出现 <script ...></script> 这种片段，宽泛正则会误吞）
const scriptTagRe = /<script type="module"(?:\s[^>]*?)?\ssrc="\.?\/?(assets\/[^"]+\.js)"(?:\s[^>]*?)?><\/script>/g;
const jsTags = [...html.matchAll(scriptTagRe)];
if (!jsTags.length) throw new Error('未找到 JS 引用');
const entry = jsTags[jsTags.length - 1][1]; // 入口在最后
if (jsTags.length > 1) console.log(`提示：发现 ${jsTags.length} 个 module 引用，取入口 ${entry}`);
let js = fs.readFileSync(path.join(DIST, entry), 'utf8');
// 内联进 <script> 前必须把闭合序列转义，否则浏览器会提前结束脚本块
js = js.split('</script').join('<\\/script');

/* ---------- 3) 照片内联
   bundle 里对照片的引用形式随 base 变化：
     base './' 时是 './hero.jpg'；base '/' 时是 '/hero.jpg'；
     某些写法还会保留字面量 './hero.jpg'。
   三种都替换掉，离线件才真正自包含。 */
const img = fs.readFileSync(path.join(DIST, 'hero.jpg'));
const imgUri = `data:image/jpeg;base64,${img.toString('base64')}`;
const before = js;
for (const ref of ['"/hero.jpg"', "'/hero.jpg'", '`/hero.jpg`', '"./hero.jpg"', "'./hero.jpg'", '`./hero.jpg`']) {
  js = js.split(ref).join(`"${imgUri}"`);
}
const imgPatched = js !== before;
if (!imgPatched) js = js.split('hero.jpg').join(imgUri);

/* ---------- 4) 指定初始路由（用于逐页截图） ---------- */
const routeScript = route === '/' ? '' : `<script>location.hash='#${route}'</script>\n`;
// --still：强制走"减弱动效"分支，所有内容直接落定，便于静态核验与截图
const still = args.includes('--still');
const stillScript = still
  ? `<script>(function(){var o=window.matchMedia.bind(window);window.matchMedia=function(q){return /prefers-reduced-motion/.test(q)?{matches:true,media:q,addEventListener:function(){},removeEventListener:function(){},addListener:function(){},removeListener:function(){},onchange:null,dispatchEvent:function(){return false;}}:o(q);};})();</script>\n`
  : '';

/* ⚠ 必须用函数式 replace：bundle 里含有 $& / $` / $' 这类序列，
   字符串替换会把它们当成"替换模式"展开，从而把被匹配的 <script> 标签插进产物里。
   同理，HTML 里若出现 $$ 也要避免字符串替换。 */
html = html.replace(scriptTagRe, () => `${stillScript}${routeScript}<script type="module">\n${js}\n</script>`);
html = html.replace(/<link rel="modulepreload"[^>]*>\s*/g, '');

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html, 'utf8');
console.log(
  `${path.basename(out).padEnd(16)} route=${route.padEnd(14)} ${Math.round(html.length / 1024)}KB  内联字体=${fontCount} 照片内联=${imgPatched ? '替换字面量' : '全局替换'}`,
);
