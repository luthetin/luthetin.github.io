import { useRef } from 'react';
import { EnvelopeSimple, GithubLogo, MonitorPlay } from '@phosphor-icons/react';
import { Reveal, SectionHeading, StatNumber } from '../components/ui';
import { CONTACTS, SITE, STATS } from '../data/site';
import { gsap, useGSAP, MOTION } from '../lib/motion';

const ICONS = {
  mail: EnvelopeSimple,
  github: GithubLogo,
  bilibili: MonitorPlay,
} as const;

/* ----------------------------------------------------------------------------
   个人经历：非对称分栏（左人像 / 右文字 + 联系 + 数据）
   数据用文字排版呈现，不套卡片
   -------------------------------------------------------------------------- */

export default function Experience() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (MOTION.reduced) return;
      gsap.fromTo(
        '[data-portrait]',
        { yPercent: -5 },
        {
          yPercent: 5,
          ease: 'none',
          scrollTrigger: {
            trigger: root.current,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        },
      );
    },
    { scope: root },
  );

  return (
    <section id="experience" ref={root} className="border-t border-line py-24 md:py-32">
      <div className="shell grid gap-12 lg:grid-cols-12 lg:gap-16">
        <Reveal className="lg:col-span-5">
          <figure className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-tile)] border border-line">
            <img
              data-portrait
              src="/hero.jpg"
              alt="周新旭"
              loading="lazy"
              /* 与首屏同一套暗调处理，避免这一块比整页亮一档而显得突兀 */
              style={{ filter: 'saturate(.72) contrast(1.04) brightness(.86)' }}
              className="absolute inset-[-6%] h-[112%] w-full object-cover object-[center_22%] will-change-transform"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(to top, rgba(8,8,10,.92) 2%, rgba(8,8,10,.18) 46%, rgba(224,112,143,.14) 100%)',
              }}
            />
          </figure>
        </Reveal>

        <div className="lg:col-span-7">
          <Reveal>
            <SectionHeading
              title="个人经历"
              lead="写代码，也写诗。下面是我在做的事、能联系到我的方式，以及一些查得到的数字。"
            />
          </Reveal>

          <Reveal delay={0.06}>
            <div className="prose-cjk mt-8 max-w-[40rem]">
              <p>
                我是周新旭，笔名陆思鼎。高中三年到现在的诗词收进《春潋集》与《行吟集》；在 B
                站讲词牌与创作入门；独立做了两个开源项目：挂在 DeepSeek Harness 上的个人工作台「探索台」，和给构造地质学用的地层建模工具 GeoStructure Builder。
              </p>
              <p>
                做东西的习惯是先把规则想清楚，再用能验证的方式落地：GeoStructure
                Builder 的数学、规则、几何、交互都写了数值断言，232 项在 Node 里逐点核对；诗集的注释与译文同样逐首精校。
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <ul className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
              {CONTACTS.map((c) => {
                const Icon = ICONS[c.icon];
                return (
                  <li key={c.label}>
                    <a
                      href={c.href}
                      {...(c.href.startsWith('http')
                        ? { target: '_blank', rel: 'noopener noreferrer' }
                        : {})}
                      className="link-underline inline-flex items-center gap-2 text-sm text-text transition-colors duration-200 hover:text-accent"
                    >
                      <Icon size={16} />
                      {c.label}
                    </a>
                  </li>
                );
              })}
              {/* 状态点：teal 在全站只出现在这一处，用来表示"两个项目都已开源、可查证" */}
              <li className="inline-flex items-center gap-2 whitespace-nowrap text-sm text-muted">
                <span className="dot-live" aria-hidden="true" />
                两个项目均已开源
              </li>
            </ul>
          </Reveal>

          <div className="mt-14 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
            {STATS.map((s, i) => (
              <Reveal key={s.label} delay={0.04 * i}>
                <div className="border-t border-line pt-5">
                  <div className="flex items-baseline gap-1">
                    <StatNumber value={s.value} className="text-3xl font-semibold md:text-4xl" />
                    <span className="text-sm text-accent">{s.unit}</span>
                  </div>
                  <div className="mt-2 text-sm text-text">{s.label}</div>
                  <p className="mt-1.5 text-[0.78rem] leading-relaxed text-faint">{s.note}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
