import { useEffect } from 'react';
import { EnvelopeSimple, GithubLogo, MonitorPlay } from '@phosphor-icons/react';
import Grainient from './bits/Grainient';
import Magnet from './bits/Magnet';
import SafeVisual from './SafeVisual';
import KineticHeadline from './KineticHeadline';
import { CONTACTS, SITE } from '../data/site';
import { MOTION } from '../lib/motion';

const ICONS = { mail: EnvelopeSimple, github: GithubLogo, bilibili: MonitorPlay } as const;

/* ----------------------------------------------------------------------------
   整屏收尾：联系
   巨幅邮箱 + 磁吸按钮 + 联系方式 + 页脚信息（更新日期与访客统计，逻辑同旧站）
   -------------------------------------------------------------------------- */

export default function Closing() {
  /* 访客统计只在 http(s) 下加载，本地 file:// 打开不会卡住 */
  useEffect(() => {
    if (typeof location === 'undefined' || !location.protocol.startsWith('http')) return;
    const s = document.createElement('script');
    s.src = '//busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js';
    s.async = true;
    document.body.appendChild(s);
    return () => {
      s.remove();
    };
  }, []);

  return (
    <section
      id="contact"
      className="relative flex min-h-screen-safe flex-col justify-between overflow-hidden border-t border-line pt-28 pb-8"
    >
      <div aria-hidden="true" className="absolute inset-0 -z-10 opacity-[0.45]">
        <SafeVisual>
          <Grainient
            color1="#2b1019"
            color2="#0a0a12"
            color3="#7c3049"
            timeSpeed={0.18}
            grainAmount={0.09}
            grainScale={1.4}
            zoom={1.5}
            warpStrength={0.5}
            warpFrequency={1.6}
            noiseScale={1.7}
            saturation={0.95}
            contrast={1.06}
          />
        </SafeVisual>
      </div>
      {/* 鸢尾色光晕：iris 唯一出场的地方，与玫瑰形成"暖冷收束" */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(80% 62% at 50% 46%, rgba(224,112,143,.2), transparent 62%),' +
            'radial-gradient(70% 58% at 12% 84%, rgba(154,131,216,.18), transparent 66%),' +
            'radial-gradient(60% 50% at 90% 14%, rgba(224,167,88,.08), transparent 68%)',
        }}
      />
      <div className="depth absolute inset-0 -z-20" aria-hidden="true" />
      <div className="grain absolute inset-0 -z-10" aria-hidden="true" />

      <div className="shell flex flex-1 flex-col items-center justify-center text-center">
        <KineticHeadline
          as="h2"
          text="有想法，就聊聊"
          className="display text-[clamp(2.25rem,7vw,5rem)] text-text text-glow"
          delay={0.1}
        />

        <a
          href={`mailto:${SITE.email}`}
          className="link-underline mt-10 block text-[clamp(1.125rem,3.4vw,2.125rem)] text-accent transition-colors duration-200 hover:text-text"
        >
          {SITE.email}
        </a>

        <div className="mt-12">
          <Magnet magnetStrength={3.6}>
            <a
              href={`mailto:${SITE.email}`}
              className="btn btn-primary btn-glow !px-8 !py-4 !text-[0.95rem]"
            >
              联系我
            </a>
          </Magnet>
        </div>

        <ul className="mt-16 flex flex-wrap items-center justify-center gap-x-9 gap-y-4">
          {CONTACTS.map((c) => {
            const Icon = ICONS[c.icon];
            return (
              <li key={c.label}>
                <a
                  href={c.href}
                  {...(c.href.startsWith('http')
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                  className="link-underline inline-flex items-center gap-2 text-sm text-muted transition-colors duration-200 hover:text-text"
                >
                  <Icon size={16} />
                  {c.label}
                </a>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="shell mt-16 flex flex-col gap-3 border-t border-line pt-6 text-[0.78rem] text-faint sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-3">
          <span>
            {SITE.name} · 笔名 {SITE.penName}
          </span>
          {/* 动效开关：?still=1 一键关掉极光 / 扫光 / 呼吸光晕，方便对比"太闹"和"刚好" */}
          {MOTION.still ? (
            <a href="./" className="link-underline text-accent">
              动效已关 · 恢复
            </a>
          ) : (
            <a href="?still=1" className="link-underline hover:text-muted">
              停止动效
            </a>
          )}
        </span>
        <span className="num">
          最后更新于 {SITE.updated}
          {' · '}
          本站访客 <span id="busuanzi_value_site_uv">—</span> 人
        </span>
      </div>
    </section>
  );
}
