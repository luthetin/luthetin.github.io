import { Link } from 'react-router-dom';
import { ArrowUpRight } from '@phosphor-icons/react';
import SpotlightCard from '../components/bits/SpotlightCard';
import Rain from '../components/Rain';
import Waveform from '../components/Waveform';
import { Reveal, SectionHeading } from '../components/ui';
import { DIRECTIONS, type Direction } from '../data/site';
import { POEMS } from '../data/poems.js';

/* ----------------------------------------------------------------------------
   精选项目：三个方向 → 三张大卡片（1 张大 + 2 张叠放的非对称 bento）
   每张卡片的视觉都从内容本身长出来，不是通用的装饰图
   -------------------------------------------------------------------------- */

/** 诗集标题（用于诗歌卡片上缓慢流动的诗题） */
const VERSE_TITLES: string[] = (() => {
  const book = (POEMS as Record<string, { groups: { poems: { t: string }[] }[] }>).chunlian;
  return book.groups.flatMap((g) => g.poems.map((p) => p.t)).slice(0, 12);
})();

function CardVisual({ kind }: { kind: Direction['visual'] }) {
  /* 三种视觉都只占卡片下半部，并且只作为"纹理"存在：
     上面有渐变遮罩淡出，透明度压得低，卡片文案所在的中上部保持干净。
     位置统一用 bottom-0 / h-[Npx]，大屏小屏都不会跑到文字底下去。 */
  if (kind === 'wave') {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[92px] overflow-hidden opacity-[0.55] [mask-image:linear-gradient(to_bottom,transparent,#000_38%)]"
      >
        <Waveform className="h-full w-full" overlay={false} />
      </div>
    );
  }

  if (kind === 'grain') {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-[210px] overflow-hidden opacity-[0.34] [mask-image:linear-gradient(to_left,transparent,#000_34%),linear-gradient(to_bottom,transparent,#000_12%,#000_88%,transparent)] [mask-composite:intersect] [-webkit-mask-composite:source-in]"
      >
        {/* 诗题贯满卡片右侧一整列、右对齐，像竖排诗稿的右缘 */}
        <div className="verse-marquee flex flex-col items-end gap-5 pr-6 pb-5 text-right text-[0.95rem] text-accent-deep">
          {[...VERSE_TITLES, ...VERSE_TITLES].map((t, i) => (
            <span key={`${t}-${i}`} className="whitespace-nowrap">
              {t}
            </span>
          ))}
        </div>
      </div>
    );
  }

  // 程序：0/1 字符雨铺满整张卡片（取代原来的扫描网格）
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.6] [mask-image:radial-gradient(130%_115%_at_72%_14%,#000_24%,transparent_82%)]"
    >
      <Rain className="h-full w-full" fontSize={12} />
    </div>
  );
}

function DirectionCard({ d, className = '' }: { d: Direction; className?: string }) {
  return (
    <SpotlightCard className={`h-full ${className}`}>
      <Link
        to={d.to}
        className="relative flex h-full min-h-[21rem] flex-col justify-between p-6 pb-8 md:p-8 md:pb-10"
      >
        <CardVisual kind={d.visual} />

        <div className="relative z-10 flex items-center justify-between">
          <span className="mono-label">{d.index}</span>
          <ArrowUpRight
            size={18}
            className="text-muted transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent"
          />
        </div>

        <div className="relative z-10 mt-16">
          <h3 className="display text-3xl md:text-4xl">{d.title}</h3>
          <p className="mt-3 text-sm text-accent">{d.line}</p>
          <p className="mt-4 max-w-[30rem] text-[0.9rem] leading-relaxed text-muted">{d.desc}</p>
          <ul className="mt-6 flex flex-wrap gap-2 pb-6">
            {d.tags.map((t) => (
              <li
                key={t}
                className="rounded-[var(--radius-tile)] border border-line px-2.5 py-1 text-[0.72rem] text-faint"
              >
                {t}
              </li>
            ))}
          </ul>
        </div>
      </Link>
    </SpotlightCard>
  );
}

export default function Work() {
  return (
    <section id="work" className="border-t border-line py-24 md:py-32">
      <div className="shell">
        <Reveal>
          <SectionHeading
            title="精选项目"
            lead="三个方向，三张卡片。每张点进去是完整介绍。"
          />
        </Reveal>

        <div className="mt-14 grid gap-4 lg:h-[38rem] lg:grid-cols-12 lg:grid-rows-2">
          <Reveal className="lg:col-span-7 lg:row-span-2">
            <DirectionCard d={DIRECTIONS[0]} />
          </Reveal>
          <Reveal delay={0.08} className="lg:col-span-5">
            <DirectionCard d={DIRECTIONS[1]} />
          </Reveal>
          <Reveal delay={0.16} className="lg:col-span-5">
            <DirectionCard d={DIRECTIONS[2]} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
