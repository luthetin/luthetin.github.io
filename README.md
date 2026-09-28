# luthetin.github.io

个人作品集：独立开发者 / AI 设计师 / 自媒体博主 / 诗人 —— 周新旭（陆思鼎）。

线上地址：<https://luthetin.github.io/>

## 这个仓库里是什么

仓库根目录是 **构建产物**，不是源码。源码在本地 `Desktop/web-v2`（React 19 + Vite 8 + Tailwind v4 + GSAP）。

```
index.html        首页（单页应用入口）
404.html          SPA 深链回退（GitHub Pages 用 404.html 接住 /work/* 这类直达地址）
assets/           打包后的 JS / CSS / 自托管字体（Geist、JetBrains Mono）
hero.jpg          首屏与个人经历用的照片（同时作为 og:image）
media/            首屏视频位：放入 hero.mp4 后自动播放，缺失时用 hero.jpg 当海报
poetry.html       旧地址 → 200 跳转页（保留，避免别人收藏的老链接失效）
projects.html     旧地址 → 200 跳转页
explore-hub.html  旧地址 → 200 跳转页
geostructure-builder.html  旧地址 → 200 跳转页
```

## 页面

| 地址 | 内容 |
| --- | --- |
| `/` | 首页：全屏 Hero、个人经历、精选项目、个人优势、整屏收尾联系 |
| `/work/code` | 程序：GeoStructure Builder、探索台 |
| `/work/media` | 自媒体：B 站词牌科普与创作入门 |
| `/work/poetry` | 诗歌：《春潋集》25 首、《行吟集》19 首，含序、跋、译文与注释 |

## 怎么更新内容

改文案要改源码（`web-v2/src`），再构建并同步到本仓库：

```bash
cd Desktop/web-v2
npm run build          # 产出 dist/
npm run deploy:go      # 同步到 Desktop/web，自动 git add
cd Desktop/web
git commit -m "更新内容"
git push
```

## 旧版站点

旧版（纯静态 HTML）完整保留在 `classic-site` 分支，本地也有一份备份：

```bash
git checkout classic-site   # 看旧版
git checkout main           # 回到线上版本
```
