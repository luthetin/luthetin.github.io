/* ============================================================================
   站点内容（全部来自旧站真实内容，未改写文案）
   - 身份、导航、联系方式
   - 三个方向（首页大卡片）
   - 个人数据（真实数字，非凑整）
   - 个人优势（从已发布内容中归纳，未虚构）
   ========================================================================= */

export const SITE = {
  name: '周新旭',
  penName: '陆思鼎',
  roles: ['独立开发者', 'AI 设计师', '自媒体博主', '诗人'],
  headline: '写代码，也写诗',
  subtext: '手写 WebGL 的地质建模工具，两本诗集，44 首诗词。做能用的东西，也做想写的东西。',
  email: 'luthetin@163.com',
  github: 'https://github.com/luthetin',
  bilibili: 'https://space.bilibili.com/431689962',
  updated: '2026 年 9 月',
} as const;

export type NavItem = { label: string; hash: string };

export const NAV: NavItem[] = [
  { label: '经历', hash: '#experience' },
  { label: '作品', hash: '#work' },
  { label: '优势', hash: '#advantages' },
  { label: '联系', hash: '#contact' },
];

/** 联系方式（一处定义，导航 / 首屏 / 收尾 / 页脚共用；同一个意图只有一个措辞） */
export const CONTACTS = [
  { label: SITE.email, href: `mailto:${SITE.email}`, icon: 'mail' as const },
  { label: 'GitHub', href: SITE.github, icon: 'github' as const },
  { label: '哔哩哔哩', href: SITE.bilibili, icon: 'bilibili' as const },
];

/** 个人数据：均可在已发布内容中查证 */
export const STATS = [
  { value: 44, unit: '首', label: '诗词收录', note: '《春潋集》25 首 + 《行吟集》19 首' },
  { value: 2, unit: '个', label: '开源项目', note: '探索台 · GeoStructure Builder，MIT' },
  { value: 232, unit: '项', label: '数值断言', note: 'GeoStructure Builder 在 Node 里逐点核对' },
  { value: 6, unit: '个', label: 'AI 工具接口', note: '探索台为 AI 注册的工具，一句话操作工作台' },
];

export type Direction = {
  id: 'code' | 'media' | 'poetry';
  index: string;
  title: string;
  to: string;
  line: string;
  desc: string;
  tags: string[];
  visual: 'veil' | 'wave' | 'grain';
};

/** 精选项目：三个方向，一个方向一张大卡片（3 个内容 → 3 个格子，无空格子） */
export const DIRECTIONS: Direction[] = [
  {
    id: 'code',
    index: '01',
    title: '程序',
    to: '/work/code',
    line: '探索台 · GeoStructure Builder',
    desc: '挂在 DeepSeek Harness 上的个人工作台（记账、计划、日历、课程、AI 规划），以及一个给构造地质学做的地层建模工具。都已开源。',
    tags: ['Node.js', 'Cordis', '手写 WebGL', '零依赖', 'MIT'],
    visual: 'veil',
  },
  {
    id: 'media',
    index: '02',
    title: '自媒体',
    to: '/work/media',
    line: '在 B 站做视频，介绍词牌名',
    desc: '有【词牌介绍】、【新手向创作教程】等栏目。',
    tags: ['词牌介绍', '新手向创作教程', 'B 站'],
    visual: 'wave',
  },
  {
    id: 'poetry',
    index: '03',
    title: '诗歌',
    to: '/work/poetry',
    line: '两本诗集，44 首诗词',
    desc: '《行吟集》《春潋集》收录高中至今的诗词，含序、跋与白话译文。',
    tags: ['春潋集 25 首', '行吟集 19 首', '序 · 跋 · 译文'],
    visual: 'grain',
  },
];

/** 个人优势：每一条都能在上述项目与作品中找到对应事实 */
export const ADVANTAGES = [
  {
    index: '01',
    title: '前后端全自研',
    desc: '探索台从接口到界面一手写完：方向、记账、计划、日历、课程、报表，多个数据源共用同一份聚合实现。',
    proof: '探索台 · Explore Hub',
  },
  {
    index: '02',
    title: '零依赖的图形与交互',
    desc: '手写 WebGL 与张量积样条，网格编辑、剖面裁切、触屏手势全部自己实现，不用图形库也能跑。',
    proof: 'GeoStructure Builder',
  },
  {
    index: '03',
    title: '可验证的工程习惯',
    desc: '用假 WebGL 上下文与假 DOM 把程序在 Node 里跑起来逐点核对，232 项断言全部通过，踩过的坑都写进 README。',
    proof: '232 项数值断言',
  },
  {
    index: '04',
    title: '跨学科的落地能力',
    desc: '把构造地质学的建模需求翻译成能用的工具：沉积次序、露头带、等高线，术语与实现都对齐专业语境。',
    proof: '构造地质学建模',
  },
  {
    index: '05',
    title: '内容表达与精校',
    desc: '两本诗集自写序跋、逐首注释并补白话译文；B 站做词牌科普与创作教程，把格律讲成人话。',
    proof: '《春潋集》《行吟集》',
  },
];

/** 旧站地址 → 新结构（预览版即带上重定向，避免以后上线掉链） */
export const LEGACY_REDIRECTS: Record<string, string> = {
  '/index.html': '/',
  '/projects.html': '/work',
  '/poetry.html': '/work/poetry',
  '/explore-hub.html': '/work/code',
  '/geostructure-builder.html': '/work/code',
};
