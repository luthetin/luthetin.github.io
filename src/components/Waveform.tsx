import { useEffect, useRef } from 'react';
import { Play } from '@phosphor-icons/react';

/* ----------------------------------------------------------------------------
   自媒体方向的视觉：词牌吟诵般的声波条
   自绘 canvas（零依赖），离屏暂停，系统减弱动效时静止
   -------------------------------------------------------------------------- */

export default function Waveform({
  className = '',
  overlay = true,
}: {
  className?: string;
  /** 是否叠一个居中的播放按钮。卡片里声波只有 ~90px 高，按钮会压在下边界上，
      而且卡片右上角已经有箭头表示可点，所以卡片关掉它，详情页保留。 */
  overlay?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = Math.max(rect.width, 1);
      h = Math.max(rect.height, 1);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const BARS = 56;
    let t = 0;
    let raf = 0;
    let visible = true;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const gap = 3;
      const bw = Math.max((w - gap * (BARS - 1)) / BARS, 1);
      const mid = h / 2;

      for (let i = 0; i < BARS; i++) {
        const phase = (i / BARS) * Math.PI * 2;
        const wave =
          Math.sin(phase * 1.6 + t * 1.1) * 0.42 +
          Math.sin(phase * 3.1 - t * 0.7) * 0.26 +
          Math.sin(phase * 0.7 + t * 1.9) * 0.18;
        const amp = Math.abs(wave) * (mid * 0.86) + 3;
        const x = i * (bw + gap);
        const shade = 0.24 + Math.abs(wave) * 0.5;
        ctx.fillStyle = `rgba(224, 112, 143, ${shade.toFixed(3)})`;
        ctx.fillRect(x, mid - amp, bw, amp * 2);
      }
      if (!calm) t += 0.016;
    };

    const loop = () => {
      if (visible) draw();
      raf = requestAnimationFrame(loop);
    };
    draw();
    if (!calm) raf = requestAnimationFrame(loop);

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
      },
      { threshold: 0 },
    );
    io.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className={`relative ${className}`}>
      <canvas ref={ref} className="h-full w-full" aria-hidden="true" />
      {overlay ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-void/70 text-accent backdrop-blur-sm transition-colors duration-300 group-hover:border-accent">
            <Play size={18} weight="fill" />
          </span>
        </div>
      ) : null}
    </div>
  );
}
