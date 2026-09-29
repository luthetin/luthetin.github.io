# web-v2 · 个人作品集（源码）

周新旭（陆思鼎）个人作品集的**源码工程**。构建产物发布到 `C:\Users\Luthetin\Desktop\web`，
即 GitHub Pages 站点 <https://luthetin.github.io/>。

技术栈：React 19 + Vite 8 + Tailwind v4 + GSAP（ScrollTrigger / SplitText）+ ogl（WebGL）。
零后端，纯静态。

## 常用命令

```bash
npm run dev          # 开发服务器 http://localhost:5273
npm run build        # 生产构建 → dist/
npm run preview      # 预览 dist/ http://localhost:4173

npm run single       # 打包成单文件 预览版-双击打开.html（离线可双击打开）
npm run shots        # 用无头 Edge 出整页/分段截图到 .shots-final/

npm run test:ui      # 交互自测（诗展开、译文、目录切换、移动端菜单、导航锚点）
npm run test:motion  # 动效审计（入场动效跑完后是否还有元素卡在透明态）
npm run test:single  # 离线单文件校验（file:// 能否渲染、是否零外部请求）
node scripts/check-pages.mjs   # 本地模拟 GitHub Pages，验收仓库根目录那套产物
node scripts/check-live.mjs    # 线上验收（直接打 https://luthetin.github.io）

npm run deploy       # 部署预演（只打印将要做什么，不改文件）
npm run deploy:go    # 同步构建产物到 Desktop/web 并 git add（不提交/不推送）
```

部署三步走：

```bash
npm run build
npm run deploy:go
cd ../web && git commit -m "更新内容" && git push
```

## 目录

```
src/
  main.tsx              入口；含 GitHub Pages 深链还原（?p= → 干净地址）
  App.tsx               路由（首页 + 三个方向详情页 + 旧地址重定向 + 404）
  styles.css            设计令牌与基础样式（暗色 + 单一深玫瑰强调色，全站 2px 直角）
  data/
    site.ts             身份、导航、联系方式、数字、三个方向、个人优势
    details.json        两个程序项目的正文（逐字来自旧站）
    poems.js            44 首诗词（来自旧站 assets/js/poems.js）
    quotes.js           25 句佳句（来自旧站）
  components/           Nav / KineticHeadline / Waveform / SafeVisual / ui / RichText …
  sections/             Hero / Experience / Work / Advantages
  pages/                Home / WorkCode / WorkMedia / Poetry / NotFound
  lib/motion.ts         GSAP 插件注册、MOTION 总开关、IS_FILE 判断
scripts/                出图、自测、单文件打包、部署
public/
  hero.jpg              首屏与个人经历的照片（同时作为 og:image）
  media/                首屏视频位（放入 hero.mp4 即自动播放）
```

## 三件与设计约定有关的事

1. **手机端安全高度**：整屏区块一律用 `min-h-screen-safe`（即 `100dvh`），不用 `100vh`。
2. **连续值不进 React state**：鼠标位置、滚动进度这类每帧变化的值全部走 ref 直改样式
   （见 `components/bits/SpotlightCard.tsx`、`Magnet.tsx` 对 react-bits 原实现的改造）。
3. **减弱动效**：所有入场动效都读 `MOTION.reduced`，系统开启"减弱动效"时直接落定。

## 字体

| 角色 | 字体 | 用在哪 |
| --- | --- | --- |
| 界面 / 中文正文 | Geist Variable + PingFang SC | 导航、正文、按钮 |
| 中文展示标题 | **Noto Serif SC** | 首屏大标题、收尾页标题（与之搭配的不再是黑体） |
| 英文展示 | **Bodoni MT**（`.display-latin`） | 英文大标题与巨大数字，didone 高对比衬线 |
| 等宽 / 数据 | JetBrains Mono | 序号、数字、技术标签 |
| 诗文 | Noto Serif SC | 诗句、诗集名、佳句 |

两个展示衬线都取自**系统已装字体**，不额外加载字体文件。英文 didone 与中文宋体必须成对使用：
只换英文会让中英两套气质分裂。

## 调试开关（排查版式与动效用）

| 参数 | 作用 |
| --- | --- |
| `?still=1` | 一键关掉装饰动效（极光 / 扫光 / 呼吸光晕 / 描边点亮），只留基础淡入。页脚也有入口，离开该地址会自动恢复 |
| `?noperf=1` | 跳过帧率探测，用于截图与自动化测试里观察完整动效 |
| `?noaurora=1` | 整层关掉极光，用于判断画面色偏来自极光还是照片本身 |

## 装饰动效的三级降级

极光、扫光、呼吸光晕、卡片描边点亮都属于"锦上添花"，因此有三道闸门：

1. `prefers-reduced-motion: reduce`（系统级）
2. `?still=1`（用户手动）
3. **首帧掉帧自动降级**：预热 2.6 秒后再采样 45 帧，平均低于 34fps 才判定为慢设备
   （在刚加载的那几十帧采样会把正常设备误判成慢设备）

任何一级触发，内容都保持完全可见，只是不再有装饰动效。

## 旧版站点

旧版（纯静态 HTML）在 `Desktop/web` 仓库的 `classic-site` 分支，
本地备份在 `Desktop/web-classic-backup/<时间戳>/`。
