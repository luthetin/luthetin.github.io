/* ----------------------------------------------------------------------------
   部署：把 web-v2 的生产构建产物发布到 luthetin.github.io 仓库根目录
   根目录彻底替换旧站（旧文件先备份到工作区外的 web-classic-backup）

   用法：
     node scripts/deploy.mjs                          # 预演，只打印将要做什么
     node scripts/deploy.mjs --apply                  # 真正执行（改仓库文件 + git add）
     node scripts/deploy.mjs --apply --commit         # 额外提交（不推送）
     node scripts/deploy.mjs --apply --commit --push  # 提交并推送

   注意：旧站与新站的构建产物都叫 assets/。
   新产物直接放在 assets/ 根下，旧站在 assets/css、assets/js 里。
   所以清理旧文件只能删这两个子目录，绝不能整目录删 assets。
   -------------------------------------------------------------------------- */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REPO = 'C:\\Users\\Luthetin\\Desktop\\web';
const DIST = 'C:\\Users\\Luthetin\\Desktop\\web-v2\\dist';
const BACKUP = 'C:\\Users\\Luthetin\\Desktop\\web-classic-backup';

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const COMMIT = argv.includes('--commit');
const PUSH = argv.includes('--push');

/* 旧站的散文件（与 classic-site 分支一致） */
const LEGACY_FILES = [
  'index.html',
  'poetry.html',
  'projects.html',
  'explore-hub.html',
  'geostructure-builder.html',
  'hero.jpg',
  'README.md',
  '自己改文字说明书.md',
];
/* 删除时只动这两个旧子目录（新产物在 assets/ 根下，必须保留） */
const LEGACY_DIRS = ['assets/css', 'assets/js'];
/* 备份时整目录收走，保证备份是一份完整的旧站 */
const LEGACY_BACKUP_DIRS = ['assets'];

/* 旧地址 → 新地址：留一个 200 跳转页，老链接与外部引用不会直接撞 404
   目标写成「/ + hash 路由」：GitHub Pages 上 / 必定命中，
   比直接跳 /work/poetry 更稳（后者要先吃一次 404.html 回退）。 */
const REDIRECTS = {
  'poetry.html': '/#/work/poetry',
  'projects.html': '/',
  'explore-hub.html': '/#/work/code',
  'geostructure-builder.html': '/#/work/code',
};

const log = (s = '') => console.log(s);

/* 部署时重写的 README（旧 README 描述的是已经删掉的旧结构） */
const README_MD = [
  '# luthetin.github.io',
  '',
  '个人作品集：独立开发者 / AI 设计师 / 自媒体博主 / 诗人 —— 周新旭（陆思鼎）。',
  '',
  '线上地址：<https://luthetin.github.io/>',
  '',
  '## 这个仓库里是什么',
  '',
  '仓库根目录是 **构建产物**，不是源码。源码在本地 `Desktop/web-v2`（React 19 + Vite 8 + Tailwind v4 + GSAP）。',
  '',
  '```',
  'index.html        首页（单页应用入口）',
  '404.html          SPA 深链回退（GitHub Pages 用 404.html 接住 /work/* 这类直达地址）',
  'assets/           打包后的 JS / CSS / 自托管字体（Geist、JetBrains Mono）',
  'hero.jpg          首屏与个人经历用的照片（同时作为 og:image）',
  'media/            首屏视频位：放入 hero.mp4 后自动播放，缺失时用 hero.jpg 当海报',
  'poetry.html       旧地址 → 200 跳转页（保留，避免别人收藏的老链接失效）',
  'projects.html     旧地址 → 200 跳转页',
  'explore-hub.html  旧地址 → 200 跳转页',
  'geostructure-builder.html  旧地址 → 200 跳转页',
  '```',
  '',
  '## 页面',
  '',
  '| 地址 | 内容 |',
  '| --- | --- |',
  '| `/` | 首页：全屏 Hero、个人经历、精选项目、个人优势、整屏收尾联系 |',
  '| `/work/code` | 程序：GeoStructure Builder、探索台 |',
  '| `/work/media` | 自媒体：B 站词牌科普与创作入门 |',
  '| `/work/poetry` | 诗歌：《春潋集》25 首、《行吟集》19 首，含序、跋、译文与注释 |',
  '',
  '## 怎么更新内容',
  '',
  '改文案要改源码（`web-v2/src`），再构建并同步到本仓库：',
  '',
  '```bash',
  'cd Desktop/web-v2',
  'npm run build          # 产出 dist/',
  'npm run deploy:go      # 同步到 Desktop/web，自动 git add',
  'cd Desktop/web',
  'git commit -m "更新内容"',
  'git push',
  '```',
  '',
  '## 旧版站点',
  '',
  '旧版（纯静态 HTML）完整保留在 `classic-site` 分支，本地也有一份备份：',
  '',
  '```bash',
  'git checkout classic-site   # 看旧版',
  'git checkout main           # 回到线上版本',
  '```',
  '',
].join('\n');
const run = (args, cwd = REPO) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function walk(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p, base) : [path.relative(base, p)];
  });
}
const sizeOf = (dir, files) =>
  Math.round(files.reduce((s, f) => s + fs.statSync(path.join(dir, f)).size, 0) / 1024);

/* ------------------------------------------------------------ 0) 前置检查 */
if (!fs.existsSync(path.join(REPO, '.git'))) throw new Error(`不是 git 仓库：${REPO}`);
if (!fs.existsSync(path.join(DIST, 'index.html')))
  throw new Error(`没有构建产物：${DIST}\\index.html（先跑 npm run build）`);

const branch = run(['rev-parse', '--abbrev-ref', 'HEAD']);
const distFiles = walk(DIST);
const backupTarget = path.join(BACKUP, new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));

log(`仓库         ${REPO}`);
log(`当前分支     ${branch}`);
log(`工作区状态   ${run(['status', '--porcelain']) || '干净'}`);
log(`构建产物     ${distFiles.length} 个文件，${sizeOf(DIST, distFiles)}KB`);
log('');

/* ------------------------------------------------------------ 1) 备份 */
log(`【1】旧站备份 → ${backupTarget}`);
for (const f of LEGACY_FILES) {
  const src = path.join(REPO, f);
  if (fs.existsSync(src)) log(`     ${f}  ${fs.statSync(src).size}B`);
}
for (const d of LEGACY_BACKUP_DIRS) {
  const src = path.join(REPO, d);
  if (fs.existsSync(src)) log(`     ${d}\\  ${walk(src).length} 个文件`);
}

/* ------------------------------------------------------------ 2) 发布 */
log('');
log('【2】复制构建产物到仓库根目录');
log('     index.html, 404.html, hero.jpg, README.md, assets/*, media/*');
log(`     共 ${distFiles.length} 个文件，${sizeOf(DIST, distFiles)}KB`);

/* ------------------------------------------------------------ 3) 清理旧站 */
log('');
log('【3】删除旧站文件（保留 assets/ 下的新产物）');
for (const f of LEGACY_FILES) if (fs.existsSync(path.join(REPO, f))) log(`     删除 ${f}`);
for (const d of LEGACY_DIRS) if (fs.existsSync(path.join(REPO, d))) log(`     删除 ${d}\\`);

/* ------------------------------------------------------------ 4) 跳转页 */
log('');
log('【4】为旧地址写 200 跳转页');
for (const [from, to] of Object.entries(REDIRECTS)) log(`     ${from} → ${to}`);
log('【4b】写入 404.html（SPA 深链回退）');
log('【4c】重写 README.md（旧的描述的是已删除的旧结构）');

if (!APPLY) {
  log('');
  log('这是预演（没有改动任何文件）。确认无误后加 --apply 执行。');
  process.exit(0);
}

/* ============================== 真正执行 ============================== */
log('');
log('=== 开始执行 ===');

/* 1) 备份整份旧站 */
fs.mkdirSync(backupTarget, { recursive: true });
for (const f of LEGACY_FILES) {
  const src = path.join(REPO, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(backupTarget, f));
}
for (const d of LEGACY_BACKUP_DIRS) {
  const src = path.join(REPO, d);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(backupTarget, d), { recursive: true });
}
log(`✓ 旧站已备份到 ${backupTarget}`);

/* 2) 先删旧站文件与旧子目录，再复制产物。
   顺序不能反：index.html 与 hero.jpg 在新旧站里同名，
   先复制再删除会把刚发布的新文件一起删掉。 */
for (const f of LEGACY_FILES) fs.rmSync(path.join(REPO, f), { force: true });
for (const d of LEGACY_DIRS) fs.rmSync(path.join(REPO, d), { recursive: true, force: true });
log('✓ 旧站文件已删除');

/* 3) 复制产物（先删后拷，同名文件是新站的） */
for (const rel of distFiles) {
  const target = path.join(REPO, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(DIST, rel), target);
}
const visible = distFiles.filter((rel) => fs.existsSync(path.join(REPO, rel))).length;
log(`✓ 已复制 ${distFiles.length} 个构建产物文件（校验可见 ${visible}/${distFiles.length}）`);

/* 3.5) SPA 深链回退。
   GitHub Pages 对 /work/poetry 这类直达地址会返回 404.html 且状态码是 404。
   把地址原样交给前端路由（history.replaceState 不会多留一条历史记录），
   这样用户看到的是正确页面，地址栏也保持干净的 /work/poetry。 */
const SPA_MARKER = '<div id="root"></div>';
const spaFallbackScript = `<script>
  /* 404.html 专用：让 /work/xxx 这类深链落到前端路由上 */
  (function () {
    var l = location;
    var path = l.pathname + l.search + l.hash;
    if (l.pathname !== '/' && !/\\.[a-z0-9]+$/i.test(l.pathname)) {
      history.replaceState(null, '', '/?p=' + encodeURIComponent(path));
    }
  })();
</script>`;
const distIndex = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
if (!distIndex.includes(SPA_MARKER)) {
  throw new Error(`构建产物里找不到 ${SPA_MARKER}，无法生成 404.html`);
}
fs.writeFileSync(
  path.join(REPO, '404.html'),
  distIndex.replace(SPA_MARKER, SPA_MARKER + '\n' + spaFallbackScript),
  'utf8',
);
log('✓ 已写入 404.html（SPA 深链回退，保留原始地址）');

/* 4) 旧地址跳转页 */
for (const [from, to] of Object.entries(REDIRECTS)) {
  const page = [
    '<!DOCTYPE html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="UTF-8">',
    '<title>页面已迁移 · 周新旭</title>',
    `<link rel="canonical" href="https://luthetin.github.io/${to.replace(/^\//, '')}">`,
    `<meta http-equiv="refresh" content="0; url=${to}">`,
    `<script>location.replace(${JSON.stringify(to)});</script>`,
    '</head>',
    '<body>',
    `<p>这个页面已经并入新版站点，正在跳转。若没有自动跳转，请点 <a href="${to}">这里</a>。</p>`,
    '</body>',
    '</html>',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(REPO, from), page, 'utf8');
}
log(`✓ 已写入 ${Object.keys(REDIRECTS).length} 个跳转页`);

/* 5) 清理 assets/ 里非本次产物的历史文件 */
const assetDir = path.join(REPO, 'assets');
const keptAssets = new Set(
  distFiles
    .filter((f) => f.replace(/\\/g, '/').startsWith('assets/'))
    .map((f) => path.basename(f)),
);
const removedAssets = [];
if (fs.existsSync(assetDir)) {
  for (const name of fs.readdirSync(assetDir)) {
    if (!keptAssets.has(name)) {
      fs.rmSync(path.join(assetDir, name), { recursive: true, force: true });
      removedAssets.push(name);
    }
  }
}
log(
  `✓ 清理 assets/ 历史文件 ${removedAssets.length} 个` +
    (removedAssets.length ? '：' + removedAssets.slice(0, 6).join(', ') : ''),
);

/* 6) 重写 README（旧 README 描述的是已经删掉的旧结构） */
fs.writeFileSync(path.join(REPO, 'README.md'), README_MD, 'utf8');
log('✓ 已重写 README.md');

/* 7) 部署后自检：不比对"文件名是否还在"（index.html / hero.jpg 新旧同名，
      删完就该由新产物顶上来），而是校验真实结果 */
const problems = [];

/* 7a) 新站关键文件 */
for (const f of ['index.html', '404.html', 'hero.jpg', 'README.md']) {
  if (!fs.existsSync(path.join(REPO, f))) problems.push(`缺文件 ${f}`);
}

/* 7b) index.html 引用的 JS/CSS 必须真的在 assets/ 里 */
const assetNames = fs.readdirSync(assetDir);
const jsBundle = assetNames.find((n) => /^index-.*\.js$/.test(n));
const cssBundle = assetNames.find((n) => /^index-.*\.css$/.test(n));
const indexHtml = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
if (!jsBundle) problems.push('assets/ 里没有 JS 入口');
if (!cssBundle) problems.push('assets/ 里没有 CSS 入口');
if (jsBundle && !indexHtml.includes(jsBundle)) problems.push('index.html 未引用当前 JS 入口');
if (cssBundle && !indexHtml.includes(cssBundle)) problems.push('index.html 未引用当前 CSS 入口');

/* 7c) index.html 必须是新站（旧站的首页带着 assets/css/style.css） */
if (indexHtml.includes('assets/css/style.css')) problems.push('index.html 还是旧站首页');

/* 7d) 旧站那两个子目录必须已经不在 */
for (const d of LEGACY_DIRS) {
  if (fs.existsSync(path.join(REPO, d))) problems.push(`旧目录仍在 ${d}`);
}

/* 7e) 旧地址必须是跳转页（而不是残留的旧内容） */
for (const [from, to] of Object.entries(REDIRECTS)) {
  const p = path.join(REPO, from);
  if (!fs.existsSync(p)) {
    problems.push(`跳转页缺失 ${from}`);
    continue;
  }
  const html = fs.readFileSync(p, 'utf8');
  if (!html.includes(to) || !html.includes('location.replace')) {
    problems.push(`${from} 不是跳转页`);
  }
}

/* 7f) 404.html 必须与新站首页同源（否则深链回退会加载到旧站） */
const notFound = fs.readFileSync(path.join(REPO, '404.html'), 'utf8');
if (!jsBundle || !notFound.includes(jsBundle)) problems.push('404.html 未引用新站的 JS 入口');

const fonts = assetNames.filter((n) => /\.woff2?$/.test(n)).length;
log(
  `✓ 自检：assets/ 共 ${assetNames.length} 项（字体 ${fonts}）；JS=${jsBundle ?? '缺失'}；` +
    `CSS=${cssBundle ?? '缺失'}；跳转页 ${Object.keys(REDIRECTS).length - problems.filter((p) => p.includes('跳转页') || p.includes('不是跳转页')).length}/${Object.keys(REDIRECTS).length}`,
);
if (problems.length) {
  log('✗ 自检未通过，已中止，未执行 git add：');
  for (const p of problems) log('   - ' + p);
  process.exit(1);
}
log('✓ 自检全部通过');

/* 7) git add + 汇报 */
run(['add', '-A']);
log('✓ git add -A 完成');
log('');
log('=== git status ===');
log(run(['status', '--short']));
log('');
log('=== git diff --cached --stat ===');
log(run(['diff', '--cached', '--stat']));

if (COMMIT) {
  const msg = [
    '重构为 React + Vite 暗色作品集：根目录替换旧站，旧地址留 200 跳转',
    '',
    '- 首页：全屏 Hero（照片位 + WebGL 幕布 + 动效标题）、个人经历、精选项目、个人优势、整屏收尾联系',
    '- 详情页：/work/code（GeoStructure Builder + 探索台）、/work/media、/work/poetry（44 首完整阅读器）',
    '- 内容逐字沿用旧站文案；旧站完整保留在 classic-site 分支',
    '- 404.html 兜 SPA 深链；poetry/projects/explore-hub/geostructure-builder.html 改为 200 跳转页',
  ].join('\n');
  log('');
  log('=== git commit ===');
  log(run(['commit', '-m', msg]));
}

if (PUSH) {
  log('');
  log('=== git push ===');
  try {
    log(run(['push', '-u', 'origin', branch]));
    log('✓ 已推送');
  } catch (e) {
    log('✗ 推送失败：' + (e.stderr || e.stdout || e.message));
    process.exitCode = 1;
  }
}
