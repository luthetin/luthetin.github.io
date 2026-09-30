import { Link } from 'react-router-dom';
import { ArrowUpRight } from '@phosphor-icons/react';
import KnowledgeGraph from '../components/KnowledgeGraph';
import { Reveal, SectionHeading } from '../components/ui';
import { KNOWLEDGE_META, NODES, CAT_META } from '../data/knowledge';
import { defaultStateMap } from '../data/knowledge-state';

/* ----------------------------------------------------------------------------
   知识谱系（首页模块）

   位置：精选项目 与 个人优势 之间。
   这里放的是"看"的版本 —— 图不可交互（不响应悬停与点击），整块是一个链接，
   点进 /work/knowledge 才是能用的版本。

   版式：左侧文案（标题 + 说明 + 三个数字），右侧整幅图。
   与上下的 bento 卡片、优势列表都不是同一族版式，避免"每段长得一样"。
   -------------------------------------------------------------------------- */

export default function Knowledge() {
  const cats = Object.keys(CAT_META).length;
  /* 首页是只读预览，用仓库里的默认状态（页面上改过的存在本机，不带到这里） */
  const state = defaultStateMap();

  return (
    <section id="knowledge" className="border-t border-line py-24 md:py-32">
      <div className="shell">
        <Reveal>
          <SectionHeading
            title="知识谱系"
            lead="把想学的学科画成一张关系图：它是我的学习路线，也是我对这些领域彼此关系的判断。"
          />
        </Reveal>

        <Reveal delay={0.08}>
          <Link
            to="/work/knowledge"
            className="group mt-12 grid gap-8 lg:grid-cols-12 lg:items-center lg:gap-14"
          >
            {/* 左：文字 */}
            <div className="lg:col-span-4">
              <div className="flex items-baseline gap-3">
                <span className="mono-label">04 / 知识谱系</span>
              </div>

              <p className="measure mt-5 text-[0.95rem] leading-[1.9] text-[#c9c9d0]">
                一门学科一个节点，有联系就连一条线，连线越多节点越大。
                <span className="text-muted">
                  {' '}
                  连得最多的是「{KNOWLEDGE_META.topNode}」，{KNOWLEDGE_META.topDeg} 条。
                </span>
              </p>

              <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
                <div>
                  <dt className="mono-label">学科</dt>
                  <dd className="display mt-1 text-3xl">{KNOWLEDGE_META.nodes}</dd>
                </div>
                <div>
                  <dt className="mono-label">关联</dt>
                  <dd className="display mt-1 text-3xl">{KNOWLEDGE_META.links}</dd>
                </div>
                <div>
                  <dt className="mono-label">门类</dt>
                  <dd className="display mt-1 text-3xl">{cats}</dd>
                </div>
              </dl>

              <span className="mt-8 inline-flex items-center gap-2 text-sm text-accent">
                展开完整关系图
                <ArrowUpRight
                  size={16}
                  className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                />
              </span>
            </div>

            {/* 右：图（静态预览，整块可点） */}
            <div className="lg:col-span-8">
              <div className="plate overflow-hidden transition-colors duration-500 group-hover:border-accent/40">
                <div className="relative aspect-[1138/724] w-full">
                  <KnowledgeGraph variant="preview" className="absolute inset-0" state={state} />
                </div>
              </div>
              <p className="mono-label mt-3">
                {NODES.length} 个节点 · 点此进入可交互版本
              </p>
            </div>
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
