import { useRef } from 'react';
import { gsap, useGSAP, MOTION } from '../lib/motion';

/* ----------------------------------------------------------------------------
   逐字入场的大标题
   中文按字拆很自然（比按词拆更稳），用遮罩上浮 + 轻微 3D 翻转做出"落字"感
   减弱动效 / 无 JS 时：文字直接是最终状态
   -------------------------------------------------------------------------- */

export default function KineticHeadline({
  text,
  className = '',
  delay = 0.15,
  as: Tag = 'h1',
}: {
  text: string;
  className?: string;
  delay?: number;
  as?: 'h1' | 'h2';
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const chars = Array.from(text);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const targets = el.querySelectorAll('[data-ch]');
      if (MOTION.reduced) {
        gsap.set(targets, { opacity: 1, yPercent: 0, rotateX: 0, filter: 'none' });
        return;
      }
      /* 落字 + 模糊消散：模糊用 filter 而不是改字号，所以不触发重排 */
      gsap.fromTo(
        targets,
        { yPercent: 118, opacity: 0, rotateX: -62, filter: 'blur(9px)' },
        {
          yPercent: 0,
          opacity: 1,
          rotateX: 0,
          filter: 'blur(0px)',
          duration: 1.15,
          ease: 'power4.out',
          stagger: 0.05,
          delay,
        },
      );
    },
    { scope: ref, dependencies: [text] },
  );

  return (
    <Tag
      ref={ref}
      className={className}
      style={{ perspective: '700px' }}
      aria-label={text}
    >
      {chars.map((ch, i) => (
        <span
          key={`${ch}-${i}`}
          aria-hidden="true"
          className="-mb-[0.16em] inline-block overflow-hidden pb-[0.16em] align-bottom"
        >
          <span
            data-ch
            className={`inline-block ${ch === '，' || ch === '。' ? 'text-accent' : ''}`}
            style={{ transformOrigin: '50% 100%' }}
          >
            {ch}
          </span>
        </span>
      ))}
    </Tag>
  );
}
