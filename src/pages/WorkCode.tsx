import { ArrowUpRight } from '@phosphor-icons/react';
import DetailShell from '../components/DetailShell';
import FieldDiagram from '../components/FieldDiagram';
import RichText from '../components/RichText';
import StrataBlock from '../components/StrataBlock';
import { Reveal } from '../components/ui';
import details from '../data/details.json';

/* ----------------------------------------------------------------------------
   程序方向详情：两个开源项目的技术案例

   版式族（一页里同族最多两次，避免"整页一种排版"）：
   - 页头：大标题 + 导语 + 动作区 + 右侧地层线框图版（视觉主角）
   - 项目：大序号 + 分隔线（不用卡片容器，卡片只在需要抬升层级时才用）
   - 正文：统一中文栏宽 .measure-wide
   - 示意：全宽图版 .plate（把最费解的一段变成图）
   - 条目：左竖线 .rule-item（技术文档式，取代卡片堆叠）
   -------------------------------------------------------------------------- */

type Project = {
  slug: string;
  name: string;
  meta: string;
  lead: string[];
  sections: { heading: string; items: string[] }[];
  tags: string[];
  links: { label: string; href: string }[];
};

const projects = (details as { code: { projects: Project[] } }).code.projects;

/* 把「它在解决什么问题 / 它长什么样 / 技术」三组做不同的版式处理，
   否则三组长得一模一样，读者会失去位置感。 */
const SECTION_STYLE: Record<string, { cols: 1 | 2; family: 'rule' | 'plain' }> = {
  它在解决什么问题: { cols: 1, family: 'rule' },
  它长什么样: { cols: 2, family: 'plain' },
  技术: { cols: 2, family: 'plain' },
};

export default function WorkCode() {
  /* 页头导语取第一个项目的首段，作为整个方向的总述 */
  const headLead = projects[0]?.lead[0] ?? '';

  return (
    <DetailShell
      backTo="/#work"
      backLabel="返回作品"
      eyebrow="方向 01"
      title="程序"
      meta={`${projects.length} 个开源项目 · MIT · 前后端全自研`}
      lead={headLead.replace(/\*\*/g, '')}
      actions={projects
        .flatMap((p) => p.links)
        .slice(0, 2)
        .map((l) => ({ label: l.label, href: l.href, external: true }))}
      visual={
        <>
          <StrataBlock height={340} />
          <div className="flex items-center justify-between border-t border-line px-4 py-3">
            <span className="plate-caption">STRATA · 张量积网格 + 高度场</span>
            <span className="plate-caption text-accent">实时绘制</span>
          </div>
        </>
      }
    >
      <div className="flex flex-col gap-28 md:gap-32">
        {projects.map((p, i) => (
          <article key={p.slug}>
            {/* 项目头：大序号 + 分隔线，不用卡片 */}
            <Reveal>
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-3 border-t border-accent-deep/40 pt-8">
                <span className="display-latin text-[clamp(2.5rem,6vw,4rem)] leading-none text-accent-deep">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h2 className="display-serif-cn text-[clamp(1.75rem,4vw,2.75rem)]">{p.name}</h2>
                <span className="mono-label inline-flex items-center gap-1.5 whitespace-nowrap text-teal">
                  <span className="dot-live" aria-hidden="true" />
                  MIT
                </span>
              </div>
              <p className="num mt-5 text-[0.8rem] text-muted">{p.meta}</p>
            </Reveal>

            {/* 导语：首段已作为全页导语出现在页头，这里不再重复。
                只把后续段落放进来，并把那段"起因很简单"做成大字拉引。 */}
            {p.lead[1] ? (
              <Reveal>
                <p className="pull-quote measure-wide mt-10 border-l-2 border-accent pl-6 text-[clamp(1.15rem,2.4vw,1.6rem)] text-text">
                  <RichText text={p.lead[1]} />
                </p>
              </Reveal>
            ) : null}

            {/* 分组：按 SECTION_STYLE 走不同版式 */}
            <div className="mt-16 flex flex-col gap-14">
              {p.sections.map((s) => {
                const style = SECTION_STYLE[s.heading] ?? { cols: 2 as const, family: 'plain' as const };
                const isTwo = style.cols === 2;

                return (
                  <Reveal key={s.heading}>
                    <div className="scroll-mt-24 border-t border-line pt-6">
                      <h3 className="mono-label text-accent">{s.heading}</h3>
                      <ul
                        className={
                          isTwo
                            ? 'mt-6 grid gap-x-12 gap-y-7 md:grid-cols-2'
                            : 'mt-6 flex flex-col gap-7'
                        }
                      >
                        {s.items.map((item) => (
                          <li
                            key={item}
                            className={
                              style.family === 'rule'
                                ? 'rule-item measure-wide text-[0.88rem] leading-[1.9] text-[#c9c9d0]'
                                : 'text-[0.86rem] leading-[1.85] text-muted'
                            }
                          >
                            <RichText text={item} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Reveal>
                );
              })}
            </div>

            {/* 交线连续性示意图：只挂在讲到这条规则的项目下面 */}
            {p.slug === 'geostructure-builder' ? (
              <Reveal>
                <figure className="mt-16">
                  <div className="plate overflow-hidden">
                    <FieldDiagram className="w-full" />
                  </div>
                  <figcaption className="plate-caption mt-4">
                    图 1 · 「连续的有符号场」如何让透明边界精确落在两条界面的交线上
                  </figcaption>
                </figure>
              </Reveal>
            ) : null}

            {/* 标签：技术栈，保持小而密 */}
            <ul className="mt-14 flex scroll-mt-24 flex-wrap gap-2">
              {p.tags.map((t) => (
                <li
                  key={t}
                  className="rounded-[var(--radius-tile)] border border-line px-2.5 py-1 text-[0.72rem] text-faint"
                >
                  {t}
                </li>
              ))}
            </ul>

            <div className="mt-9 flex flex-wrap gap-3">
              {p.links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost"
                >
                  {l.label}
                  <ArrowUpRight size={14} />
                </a>
              ))}
            </div>
          </article>
        ))}
      </div>
    </DetailShell>
  );
}
