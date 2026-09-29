'use client';

import React, { useEffect, useRef, type ReactNode } from 'react';

/* ----------------------------------------------------------------------------
   改造自 react-bits 的 Magnet
   同样去掉 useState：位移直接写 transform，且只在指针设备上启用，
   触屏与"减弱动效"下保持静止。
   -------------------------------------------------------------------------- */

interface MagnetProps {
  children: ReactNode;
  padding?: number;
  magnetStrength?: number;
  className?: string;
  innerClassName?: string;
}

const Magnet: React.FC<MagnetProps> = ({
  children,
  padding = 90,
  magnetStrength = 3.2,
  className = '',
  innerClassName = '',
}) => {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = outer.current;
    const box = inner.current;
    if (!el || !box) return;

    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || calm) return;

    let raf = 0;
    let tx = 0;
    let ty = 0;

    const apply = () => {
      box.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
      raf = 0;
    };

    const onMove = (e: MouseEvent) => {
      const { left, top, width, height } = el.getBoundingClientRect();
      const cx = left + width / 2;
      const cy = top + height / 2;
      const near =
        Math.abs(cx - e.clientX) < width / 2 + padding &&
        Math.abs(cy - e.clientY) < height / 2 + padding;
      tx = near ? (e.clientX - cx) / magnetStrength : 0;
      ty = near ? (e.clientY - cy) / magnetStrength : 0;
      box.style.transition = near ? 'transform 260ms ease-out' : 'transform 520ms ease-in-out';
      if (!raf) raf = requestAnimationFrame(apply);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [padding, magnetStrength]);

  return (
    <div ref={outer} className={`relative inline-block ${className}`}>
      <div ref={inner} className={innerClassName} style={{ willChange: 'transform' }}>
        {children}
      </div>
    </div>
  );
};

export default Magnet;
