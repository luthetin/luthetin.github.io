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

export default function Knowledge() {
  const [picked, setPicked] = useState<KnowledgeNode | null>(null);

  /* 选中节点的邻接学科名（面板里展示） */
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
          />
        </div>

        <p className="mono-label mt-5">
          悬停看邻接 · 点击节点展开该学科的工具与内容
        </p>
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
                  {items.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => setPicked(n)}
                        className={`rounded-[var(--radius-tile)] border px-2 py-0.5 text-[0.72rem] transition-colors ${
                          picked?.id === n.id
                            ? 'border-accent text-accent'
                            : 'border-line text-faint hover:border-accent hover:text-accent'
                        }`}
                      >
                        {n.name}
                      </button>
                    </li>
                  ))}
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
