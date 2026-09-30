/* ============================================================================
   知识谱系 · 学习状态

   三种状态：已学习 / 学习中 / 未学习。

   ── 怎么改 ─────────────────────────────────────────────────────────────
   1) 默认值就在下面的 DEFAULT_STATE，52 门学科逐一列出（按大类分组）。
      它是"起点"而不是精确事实：哪一门不对，直接改这一行的值。
   2) 页面上也能改：点开一个节点，在面板里切换状态，存在 localStorage，
      只影响这台浏览器，不动仓库里的默认值。
   3) 页面上的修改会覆盖默认值；想恢复默认，清掉浏览器 localStorage 里的
      `kg-state-v1` 即可。

   ── 为什么不用颜色区分三态 ───────────────────────────────────────────────
   站点规范要求"每个辅色只绑一个语义位置"（accent 只用于强调）。
   三态各占一色会直接破坏这条克制感，也对色觉障碍不友好。
   所以用**几何 + 明度**编码，三者共用同一个语义色：
     已学习  圆 + 圈          ← 最"实"，有边界
     学习中  圆               ← 正在成形
     未学习  圆（灰、暗）      ← 还没开始
   节点始终是实心的（明确要求）。未学习的"灰"是把门类色压向灰并调暗，
   不是降透明度 —— 降透明度会透出后面的连线、也丢掉门类色相。
   ========================================================================= */

export type KnowledgeState = 'learned' | 'studying' | 'todo';

export const STATE_META: Record<
  KnowledgeState,
  {
    label: string;
    /** 外环半径 = 节点半径 + ringGap；null 表示不画外环 */
    ringGap: number | null;
    ringWidth: number;
    /**
     * 颜色向"灰"压的比例（0 = 保留门类色，1 = 全灰）。
     * 未学习用这个变暗/变灰，而不是降透明度 ——
     * 降透明度会透出后面的连线、显脏，也丢掉门类色相。
     */
    greyMix: number;
    /** 变暗系数：数值越低越暗 */
    darken: number;
  }
> = {
  /* 已学习：圆 + 圈（圈在圆外一点点，干净的一圈） */
  learned: { label: '已学习', ringGap: 4, ringWidth: 1.6, greyMix: 0, darken: 1 },
  /* 学习中：只有圆 */
  studying: { label: '学习中', ringGap: null, ringWidth: 0, greyMix: 0, darken: 1 },
  /* 未学习：圆，但灰且暗 */
  todo: { label: '未学习', ringGap: null, ringWidth: 0, greyMix: 0.78, darken: 0.62 },
};

/** 展示顺序：学习进度由高到低 */
export const STATE_ORDER: KnowledgeState[] = ['learned', 'studying', 'todo'];

/* ----------------------------------------------------------------------------
   默认状态
   依据：大二地球物理（A+ 班）。课内已覆盖的数学与基础物理按"已学习"，
   正在自学/在学中的按"学习中"，考研方向（理论经济学/哲学）与研究生阶段
   才会碰的按"未学习"。**这是起点，不是精确事实 —— 请按实际情况改。**
   -------------------------------------------------------------------------- */
const DEFAULT_STATE: Record<string, KnowledgeState> = {
  /* ── 数学 ── 课内已修 */
  'linear-algebra': 'learned',
  'math-analysis': 'learned',
  'ode-pde': 'learned',
  complex: 'learned',
  probability: 'learned',
  statistics: 'learned',
  numerical: 'learned',
  /* 数学 ── 在学 / 待修 */
  'real-func': 'studying',
  stochastic: 'studying',
  diffgeom: 'todo',
  topology: 'todo',

  /* ── 物理学 ── 课内已修 */
  'classical-mech': 'learned',
  electrodynamics: 'learned',
  /* 物理学 ── 在学 / 后续 */
  statphys: 'studying',
  relativity: 'todo',
  quantum: 'todo',
  qft: 'todo',

  /* ── 计算与智能 ── 自学为主 */
  dsa: 'learned',
  ml: 'studying',
  cv: 'studying',
  signal: 'studying',
  pattern: 'todo',

  /* ── 优化与控制 ── */
  optimization: 'studying',
  control: 'todo',

  /* ── 形式逻辑 ── 数理逻辑基础课内接触过，其余未系统学 */
  mathlogic: 'studying',
  propositional: 'studying',
  firstorder: 'todo',
  modeltheory: 'todo',
  recursion: 'todo',
  prooftheory: 'todo',
  modal: 'todo',

  /* ── 集合论 / 离散与结构 ── */
  settheory: 'studying',
  discrete: 'learned',
  graph: 'studying',
  combinatorics: 'studying',
  information: 'todo',

  /* ── 经济与管理 ── 考研方向 */
  micro: 'todo',
  macro: 'todo',
  econometrics: 'todo',
  game: 'todo',
  or: 'todo',

  /* ── 哲学 ── 考研方向，尚未系统读 */
  german: 'todo',
  marx: 'todo',
  phenomenology: 'todo',
  existential: 'todo',
  structuralism: 'todo',
  poststructural: 'todo',
  psychoanalysis: 'todo',
  contemp: 'todo',
  c19: 'todo',

  /* ── 符号与语言 ── */
  langphil: 'todo',
  semiotics: 'todo',
};

const KEY = 'kg-state-v1';

/** 读取本机的覆盖（id -> state） */
export function loadOverrides(): Record<string, KnowledgeState> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw) as Record<string, KnowledgeState>;
    const out: Record<string, KnowledgeState> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v === 'learned' || v === 'studying' || v === 'todo') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveOverrides(map: Record<string, KnowledgeState>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* 隐私模式等场景写不了，忽略即可 */
  }
}

/** 默认状态表（不含本机覆盖） */
export function defaultStateMap(): Record<string, KnowledgeState> {
  return { ...DEFAULT_STATE };
}

/** 是否有默认值缺失（自检用：52 门都该有明确状态） */
export function missingDefaults(ids: string[]): string[] {
  return ids.filter((id) => !(id in DEFAULT_STATE));
}
