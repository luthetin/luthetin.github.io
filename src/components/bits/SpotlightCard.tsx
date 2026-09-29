'use client';

import React, { useEffect, useRef } from 'react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { canAnimateDecor } from '../../lib/motion';

/* ----------------------------------------------------------------------------
   改造自 react-bits 的 SpotlightCard
   1) 原实现用 useState 存鼠标坐标，每次 mousemove 都触发 React 重渲染；
      这里改成 ref 直改 CSS 变量，不产生任何 re-render（连续值不进 state）。
   2) 新增"描边点亮"：进入视口时描边从 line 亮到 accent-deep，只播一次。
      用一层绝对定位的覆盖层做动画，不动卡片本身的 border，避免和布局打架。
   -------------------------------------------------------------------------- */

interface SpotlightCardProps extends React.PropsWithChildren {
  className?: string;
  spotlightColor?: string;
  /** 关掉描边点亮（例如同类卡片已经在其它地方点过） */
  noLighting?: boolean;
}

const SpotlightCard: React.FC<SpotlightCardProps> = ({
  children,
  className = '',
  spotlightColor = 'rgba(224, 112, 143, 0.16)',
  noLighting = false,
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const lightRef = useRef<HTMLDivElement>(null);

  const move = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = divRef.current;
    const glow = glowRef.current;
    if (!el || !glow) return;
    const rect = el.getBoundingClientRect();
    glow.style.setProperty('--x', `${e.clientX - rect.left}px`);
    glow.style.setProperty('--y', `${e.clientY - rect.top}px`);
  };

  const enter = () => {
    if (glowRef.current) glowRef.current.style.opacity = '1';
  };
  const leave = () => {
    if (glowRef.current) glowRef.current.style.opacity = '0';
  };

  /* 描边点亮：一次性滚动触发，低端设备 / 静态模式下直接显示为常亮态 */
  useEffect(() => {
    const el = divRef.current;
    const light = lightRef.current;
    if (!el || !light || noLighting) return;

    if (!canAnimateDecor()) {
      light.style.opacity = '0.75';
      return;
    }

    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top 86%',
      once: true,
      onEnter: () => light.classList.add('is-lit'),
    });
    return () => st.kill();
  }, [noLighting]);

  return (
    <div
      ref={divRef}
      onMouseMove={move}
      onMouseEnter={enter}
      onMouseLeave={leave}
      onFocus={enter}
      onBlur={leave}
      style={{ ['--spot' as string]: spotlightColor }}
      className={`group relative overflow-hidden rounded-[var(--radius-tile)] border border-line bg-surface ${className}`}
    >
      <div
        ref={glowRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 ease-out"
        style={{
          background:
            'radial-gradient(520px circle at var(--x, 50%) var(--y, 50%), var(--spot), transparent 72%)',
        }}
      />
      {noLighting ? null : (
        <div ref={lightRef} aria-hidden="true" className="card-lighting" />
      )}
      {children}
    </div>
  );
};

export default SpotlightCard;
