import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from '@phosphor-icons/react';
import DetailShell from '../components/DetailShell';
import KnowledgeGraph from '../components/KnowledgeGraph';
import {
  NODES,
  LINKS,
  TOOLS,
  CAT_META,
  KNOWLEDGE_META,
  type KnowledgeNode,
  type KnowledgeCat,
} from '../data/knowledge';
import {
  STATE_META,
  STATE_ORDER,
  loadOverrides,
  saveOverrides,
  defaultStateMap,
  type KnowledgeState,
} from '../data/knowledge-state';

/* ============================================================================
   知识谱系 /knowledge

   为什么要单独做一页：
   首页那张图是"看"的，这一页是"用"的 —— 52 门学科在首页缩到看不清标签，
   而这里可以悬停看邻接、点开看每门学科的工具与内容、还能缩放平移。

   版式沿用站内 DetailShell，但页头不放图版（图本身就是内容主体，放进页头会压太小）。
   ========================================================================= */

/** 门类顺序：按节点数从多到少，让含金量高的门类排在前面 */
const CAT_ORDER: KnowledgeCat[] = (() => {
  const count: Record<string, number> = {};
  for (const n of NODES) count[n.cat] = (count[n.cat] ?? 0) + 1;
  return (Object.keys(CAT_META) as KnowledgeCat[]).sort((a, b) => count[b] - count[a]);
})();

const CAT_COLOR: Record<string, string> = {
  accent: 'var(--color-accent)',
  ice: 'var(--color-ice)',
  teal: 'var(--color-teal)',
  amber: 'var(--color-amber)',
  iris: 'var(--color-iris)',
};

/* ----------------------------------------------------------------------------
   学习状态图例
   三种状态不用颜色区分（站点的辅色各绑一个语义位置，占满了），
   而是"圆 / 圆+圈 / 灰暗的圆"，所以图例用同样的画法 —— 与图上节点同源。
   图例用中性的灰玫瑰做示意色：真实节点带各自门类的色相，
   但"灰暗程度"的关系是一致的，看一次就能对上号。
   -------------------------------------------------------------------------- */
const LEGEND_BASE = '#e0708f';   // = --color-accent
const LEGEND_GREY = '#8b8b93';   // = --color-muted
function legendColor(greyMix: number, darken: number) {
  const hex2rgb = (h: string) => {
    const v = h.replace('#', '');
    return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
  };
  const a = hex2rgb(LEGEND_BASE), b = hex2rgb(LEGEND_GREY);
  const m = a.map((v, i) => v + (b[i] - v) * greyMix);
  return '#' + m.map((x) => Math.max(0, Math.min(255, Math.round(x * darken))).toString(16).padStart(2, '0')).join('');
}

function StateLegend({ counts }: { counts: Record<KnowledgeState, number> }) {
  return (
    <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
      {STATE_ORDER.map((s) => {
        const m = STATE_META[s];
        const r = 9;
        const ring = m.ringGap == null ? null : r + m.ringGap;
        const c = legendColor(m.greyMix, m.darken);
        return (
          <span key={s} className="inline-flex items-center gap-2.5">
            <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true" className="shrink-0">
              <g transform="translate(20 20)">
                {ring != null ? (
                  <circle r={ring} fill="none" stroke={c} strokeWidth={m.ringWidth} strokeOpacity={0.95} />
                ) : null}
                <circle r={r} fill={c} fillOpacity={1} />
              </g>
            </svg>
            <span className="text-[0.82rem] text-muted">
              {m.label}
              <span className="num ml-1.5 text-faint">{counts[s]}</span>
            </span>
          </span>
        );
      })}
    </div>
  );
}

export default function Knowledge() {
  const [picked, setPicked] = useState<KnowledgeNode | null>(null);

  /* 学习状态：默认值来自 data/knowledge-state.ts，页面上的修改存 localStorage，
     只影响这台浏览器（不动仓库里的默认值）。 */
  const [state, setState] = useState<Record<string, KnowledgeState>>(() => ({
    ...defaultStateMap(),
    ...loadOverrides(),
  }));

  const setOne = (id: string, next: KnowledgeState) => {
    setState((prev) => {
      const merged = { ...prev, [id]: next };
      saveOverrides(merged);
      return merged;
    });
  };

  /* 三态计数 */
  const counts = useMemo(() => {
    const c: Record<KnowledgeState, number> = { learned: 0, studying: 0, todo: 0 };
    for (const n of NODES) c[state[n.id] ?? 'todo']++;
    return c;
  }, [state]);

  /* 选中节点的邻接学科 */
  const neighbours = useMemo(() => {
    if (!picked) return [];
    return LINKS.filter((l) => l.a === picked.id || l.b === picked.id)
      .map((l) => (l.a === picked.id ? l.b : l.a))
      .map((id) => NODES.find((n) => n.id === id))
      .filter(Boolean) as KnowledgeNode[];
  }, [picked]);

  const rows = picked ? TOOLS[picked.id] ?? [] : [];

  return (
    <DetailShell
      backTo="/"
      backLabel="返回首页"
      eyebrow="知识谱系"
      title="52 门学科，239 条关联"
      meta={`${KNOWLEDGE_META.clusters} 个门类 · 连接最多的是「${KNOWLEDGE_META.topNode}」（${KNOWLEDGE_META.topDeg} 条）`}
      lead="一门知识是一个节点，两门有联系就连一条线。连线越多，节点越大。这不是装饰图：它按我实际整理的学科关系排布，用来回答一个问题 —— 我想学的这些东西，彼此是怎么长在一起的。"
    >
      {/* ---------------------------------------------------------- 主图
          这里刻意不再套一层带边框的容器：
          页面本身已经有 .plate 的门形框，图再套一层就成了"画中画的窗口"，
          观感上像是嵌了个 iframe。直接铺在页面上更干净。 */}
      <section>
        <div className="w-full">
          <KnowledgeGraph
            variant="full"
            className="aspect-[1138/724] w-full"
            picked={picked?.id ?? null}
            onPick={(n) => setPicked(n)}
            state={state}
          />
        </div>

        {/* 图例：与图上节点用同一套几何，看一次就能对上号 */}
        <div className="mt-7 border-t border-line-soft pt-5">
          <StateLegend counts={counts} />
          <p className="mono-label mt-4">
            悬停看邻接 · 点击节点展开该学科的工具与内容 · 拖动节点看关系如何牵动
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------- 选中面板 */}
      <section className="mt-14">
        {picked ? (
          <div className="grid gap-8 border-t border-line pt-8 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-4">
              <span className="mono-label">{CAT_META[picked.cat].label}</span>
              <h2 className="display-serif-cn mt-2 text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.12]">
                {picked.name}
              </h2>
              <p className="num mt-3 text-[0.82rem] text-muted">
                {picked.deg} 条关联 · 半径 {picked.r.toFixed(1)}
              </p>

              {/* 学习状态：默认值是起点，这里可以直接改（存本机） */}
              <div className="mt-6">
                <div className="mono-label">学习状态</div>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {STATE_ORDER.map((s) => {
                    const cur = (state[picked.id] ?? 'todo') === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={cur}
                        onClick={() => setOne(picked.id, s)}
                        className={`rounded-[var(--radius-tile)] border px-3 py-1 text-[0.78rem] transition-colors ${
                          cur
                            ? 'border-accent bg-accent/10 text-accent'
                            : 'border-line text-faint hover:border-accent hover:text-accent'
                        }`}
                      >
                        {STATE_META[s].label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2.5 text-[0.72rem] leading-relaxed text-faint">
                  改的是本机记录，不动仓库里的默认值。
                </p>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {neighbours.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setPicked(n)}
                    className="rounded-[var(--radius-tile)] border border-line px-2.5 py-1 text-[0.72rem] text-faint transition-colors hover:border-accent hover:text-accent"
                  >
                    {n.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-8">
              {rows.length ? (
                <div className="border-t border-line-soft">
                  {rows.map(([tool, content]) => (
                    <div key={tool} className="rule-item grid gap-2 py-4 md:grid-cols-[10rem_1fr] md:gap-6">
                      <span className="text-[0.88rem] font-medium text-text">{tool}</span>
                      <span className="text-[0.86rem] leading-[1.85] text-muted">{content}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[0.9rem] text-muted">这门学科还没有整理工具与内容。</p>
              )}
            </div>
          </div>
        ) : (
          <div className="border-t border-line pt-8">
            <p className="measure-wide text-[0.95rem] leading-[1.9] text-muted">
              点图上的任意节点，这里会展开那门学科的工具与内容。
            </p>
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------- 门类索引 */}
      <section className="mt-20">
        <h2 className="section-head">门类</h2>
        <div className="mt-8 grid gap-x-10 gap-y-6 md:grid-cols-2 lg:grid-cols-3">
          {CAT_ORDER.map((cat) => {
            const items = NODES.filter((n) => n.cat === cat).sort((a, b) => b.deg - a.deg);
            return (
              <div key={cat}>
                <div className="flex items-baseline gap-3">
                  <span
                    aria-hidden="true"
                    className="inline-block size-2 rounded-full"
                    style={{ background: CAT_COLOR[CAT_META[cat].color] }}
                  />
                  <span className="text-[0.92rem] font-medium">{CAT_META[cat].label}</span>
                  <span className="mono-label">{items.length}</span>
                </div>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {items.map((n) => {
                    const s = state[n.id] ?? 'todo';
                    const m = STATE_META[s];
                    /* 状态点：与图上同一套几何（外环距离 + 饱和度） */
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => setPicked(n)}
                          title={m.label}
                          className={`inline-flex items-center gap-1.5 rounded-[var(--radius-tile)] border px-2 py-0.5 text-[0.72rem] transition-colors ${
                            picked?.id === n.id
                              ? 'border-accent text-accent'
                              : 'border-line text-faint hover:border-accent hover:text-accent'
                          }`}
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className="shrink-0">
                            {/* 三态：已学习 = 圆 + 圈；学习中 = 圆；未学习 = 圆但更暗（opacity 压低示意"灰"） */}
                            <g transform="translate(7 7)" opacity={m.greyMix > 0 ? 0.42 : 1}>
                              {m.ringGap != null ? (
                                <circle
                                  r="4.2"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth={1.1}
                                  strokeOpacity={0.95}
                                />
                              ) : null}
                              <circle r="3.6" fill="currentColor" />
                            </g>
                          </svg>
                          {n.name}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------------------------------------------------------- 姊妹文档 */}
      <section className="mt-20 border-t border-line pt-8">
        <h2 className="section-head">相关</h2>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/work/code" className="btn btn-ghost">
            程序与项目
            <ArrowUpRight size={14} />
          </Link>
          <Link to="/work/poetry" className="btn btn-ghost">
            两本诗集
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </section>
    </DetailShell>
  );
}
