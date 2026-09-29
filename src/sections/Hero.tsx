import { useRef } from 'react';
import Aurora from '../components/Aurora';
import DarkVeil from '../components/bits/DarkVeil';
import KineticHeadline from '../components/KineticHeadline';
import SafeVisual from '../components/SafeVisual';
import { JumpLink } from '../components/ui';
import { SITE } from '../data/site';
import { gsap, useGSAP, MOTION, IS_FILE, canAnimateDecor } from '../lib/motion';

/* ----------------------------------------------------------------------------
   全屏首屏
   层级（从后到前）：纵深底 → 极光 → 视频/照片 → 压暗渐变 + 双色径向
                    → 技术网格 → 颗粒 → 文案
   动效：极光漂移、逐字落字含模糊消散、标题缓慢扫光、按钮呼吸光晕、
        照片/网格/极光三层视差
   文案元素严格 4 个：眉标、大标题、一句话、按钮组
   -------------------------------------------------------------------------- */

export default function Hero() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (MOTION.reduced) return;

      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.fromTo(
        '[data-hero-media]',
        { scale: 1.09, opacity: 0 },
        { scale: 1, opacity: 1, duration: 2.1, ease: 'power2.out' },
      )
        .fromTo('[data-hero-eyebrow]', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.7 }, 0.25)
        .fromTo('[data-hero-sub]', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.8 }, 0.9)
        .fromTo(
          '[data-hero-cta]',
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: 0.7, stagger: 0.1 },
          1.05,
        );

      /* 三层视差：照片 / 网格 / 极光各走不同速率，画面才有纵深 */
      gsap.to('[data-hero-media]', {
        yPercent: 10,
        ease: 'none',
        scrollTrigger: {
          trigger: root.current,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      });

      if (canAnimateDecor()) {
        gsap.to('[data-hero-grid]', {
          yPercent: -7,
          ease: 'none',
          scrollTrigger: { trigger: root.current, start: 'top top', end: 'bottom top', scrub: true },
        });
        gsap.to('[data-hero-aurora]', {
          yPercent: -3,
          ease: 'none',
          scrollTrigger: { trigger: root.current, start: 'top top', end: 'bottom top', scrub: true },
        });
      }

      // 文案随首屏离开轻微上移并淡出
      gsap.to('[data-hero-copy]', {
        y: -44,
        opacity: 0.15,
        ease: 'none',
        scrollTrigger: {
          trigger: root.current,
          start: 'bottom 88%',
          end: 'bottom 42%',
          scrub: true,
        },
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="relative flex min-h-screen-safe items-end overflow-hidden pt-24 pb-16 md:pb-20">
      <div className="depth absolute inset-0 -z-20" aria-hidden="true" />

      {/* 极光垫在照片之后：只在画面边缘形成一圈隐约的光晕，
         不直接压在照片上——压在照片上会把樱花的粉色染成紫雾，那是"浑"不是"华丽"。 */}
      <div data-hero-aurora className="absolute inset-0 -z-20">
        <Aurora />
      </div>

      {/* 视频 / 照片层：统一做一层暗调处理，让亮色照片也落在暗色体系里 */}
      <div data-hero-media className="absolute inset-0 -z-10 will-change-transform">
        <video
          className="h-full w-full object-cover object-[center_28%]"
          style={{ filter: 'saturate(.66) contrast(1.06) brightness(.74)' }}
          poster="/hero.jpg"
          /* 离线单文件预览件里没有 hero.mp4，不挂 src 就不会产生一次 404 请求 */
          src={IS_FILE ? undefined : '/media/hero.mp4'}
          autoPlay={!MOTION.reduced}
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        />
        <div className="absolute inset-0" style={{ mixBlendMode: 'screen', opacity: 0.5 }}>
          <SafeVisual fallbackClassName="h-full w-full bg-transparent">
            <DarkVeil hueShift={-18} noiseIntensity={0.055} scanlineIntensity={0.12} speed={0.32} scanlineFrequency={1.6} warpAmount={0.06} resolutionScale={0.85} />
          </SafeVisual>
        </div>
      </div>

      {/* 压暗与色彩倾向：玫瑰为主，鸢尾只补一点点，避免把樱花照染成紫雾 */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background:
            'linear-gradient(to top, #08080a 8%, rgba(8,8,10,.9) 36%, rgba(8,8,10,.5) 64%, rgba(8,8,10,.7) 100%),' +
            'radial-gradient(115% 88% at 74% 22%, rgba(224,112,143,.18), transparent 60%),' +
            'radial-gradient(90% 70% at 12% 82%, rgba(154,131,216,.08), transparent 62%)',
        }}
      />
      <div data-hero-grid className="tech-grid absolute inset-0 -z-10" aria-hidden="true" />
      <div className="grain absolute inset-0 -z-10" aria-hidden="true" />

      <div data-hero-copy className="shell relative w-full">
        <span data-hero-eyebrow className="mono-label js-fade block">
          {SITE.roles.join('  /  ')}
        </span>

        {/* 中文用宋体（与英文 didone 同一气质），外层的 sweep-layer 是缓慢扫过的高光 */}
        <div className="sweep-layer mt-6">
          <KineticHeadline
            text={SITE.headline}
            className="display-serif-cn text-[clamp(2.75rem,10vw,7rem)] text-text text-glow"
          />
        </div>

        <p data-hero-sub className="js-fade mt-6 max-w-[34rem] text-[0.95rem] leading-relaxed text-muted md:text-base">
          {SITE.subtext}
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-3">
          <JumpLink data-hero-cta hash="#contact" className="btn btn-primary btn-glow">
            联系我
          </JumpLink>
          <JumpLink data-hero-cta hash="#work" className="btn btn-ghost">
            看作品
          </JumpLink>
        </div>
      </div>
    </section>
  );
}
