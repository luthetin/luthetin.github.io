import { useEffect, useRef } from 'react';
import { MOTION } from '../lib/motion';

/* ----------------------------------------------------------------------------
   0/1 字符雨（程序卡片背景）

   与全站其他视觉一致的几点：
   - 零依赖，手绘 canvas；连续值不进 React state
   - 逐列下落，每列有随机速度与错峰起点，越往下越暗（头部字符最亮）
   - 系统减弱动效 / ?still=1 / 首帧掉帧 → 只画一帧静态图，不启动循环
   - 离开视口即停（IntersectionObserver）

   颜色取站点令牌：主色玫瑰 + 少量冰蓝（ice 是"程序"这个方向的专属辅色），
   所以雨点在这张卡上是"暗玫瑰里的冷色电流"，而不是通用的黑客绿。
   -------------------------------------------------------------------------- */

const STREAMS = [
  { color: '224, 112, 143', weight: 0.72 }, // accent 玫瑰
  { color: '127, 168, 216', weight: 0.28 }, // ice 冰蓝
];

const CHARS = '01';

export default function Rain({
  className = '',
  fontSize = 13,
  speed = 1,
  opacity = 1,
}: {
  className?: string;
  fontSize?: number;
  /** 整体速度倍数，越大越快 */
  speed?: number;
  /** 画布整体透明度（叠加层用得到） */
  opacity?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const decorative = !MOTION.reduced && !MOTION.still;

    let w = 0;
    let h = 0;
    let cols = 0;
    let drops: number[] = [];
    let speeds: number[] = [];
    let tints: number[] = [];
    let dpr = 1;

    const setup = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 1.5); // 字符雨是纹理，不需要高 DPR
      w = Math.max(rect.width, 1);
      h = Math.max(rect.height, 1);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `${fontSize}px "JetBrains Mono", ui-monospace, monospace`;
      ctx.textBaseline = 'top';

      cols = Math.max(1, Math.floor(w / (fontSize * 1.5)));
      drops = [];
      speeds = [];
      tints = [];
      for (let i = 0; i < cols; i++) {
        // 初始位置随机散布：否则第一帧所有列会齐刷刷从顶端开始
        drops[i] = Math.random() * (h / fontSize);
        speeds[i] = 0.4 + Math.random() * 0.85;
        tints[i] = Math.random() < STREAMS[0].weight ? 0 : 1;
      }
    };
    setup();
    window.addEventListener('resize', setup);

    /* 列距与行距决定"是雨还是散点"：
       1.25 倍字号的列距 + 1.8 倍字号的行距，拖尾 10 格，
       这样每列会连成一条能辨认的字符链，而不是零散的点。 */
    const colW = fontSize * 1.25;
    const rowH = fontSize * 1.8;
    const TAIL = 10;

    const stamp = (x: number, y: number, color: string, alpha: number) => {
      ctx.fillStyle = `rgba(${color},${alpha.toFixed(3)})`;
      ctx.fillText(CHARS[(Math.random() * CHARS.length) | 0], x, y);
    };

    /* 一帧静态图：降级模式用，也作为循环的第一帧 */
    const paintStatic = () => {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < cols; i++) {
        const x = i * colW;
        const color = STREAMS[tints[i]].color;
        for (let k = 0; k < 5; k++) {
          const y = (drops[i] - k) * rowH;
          if (y < -rowH || y > h) continue;
          stamp(x, y, color, k === 0 ? 0.55 : 0.3 / (k + 1));
        }
      }
    };

    if (!decorative) {
      paintStatic();
      return () => window.removeEventListener('resize', setup);
    }

    let raf = 0;
    let visible = true;
    let last = 0;

    const draw = (now: number) => {
      // 用真实帧间隔推进，掉帧时不会突然变慢
      const dt = last ? Math.min((now - last) / 16.67, 3) : 1;
      last = now;

      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < cols; i++) {
        const x = i * colW;
        const color = STREAMS[tints[i]].color;
        const base = drops[i];

        for (let k = 0; k < TAIL; k++) {
          const y = (base - k) * rowH;
          if (y < -rowH) continue;
          if (y > h) break;
          // 头部最亮，往上衰减；尾部仍有微弱痕迹，链条才连续
          const alpha = k === 0 ? 0.7 : 0.34 / (k * 0.42 + 1);
          stamp(x, y, color, alpha);
        }

        drops[i] += speeds[i] * dt;
        if ((base - TAIL) * rowH > h) {
          drops[i] = -Math.random() * 8;
          speeds[i] = 0.4 + Math.random() * 0.85;
          tints[i] = Math.random() < STREAMS[0].weight ? 0 : 1;
        }
      }
      if (visible && !MOTION.slow) raf = requestAnimationFrame(draw);
      else raf = 0;
    };

    const start = () => {
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(draw);
      }
    };
    start();

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !MOTION.slow) start();
    }, { threshold: 0 });
    io.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('resize', setup);
    };
  }, [fontSize, speed]);

  return <canvas ref={ref} className={className} style={{ opacity }} aria-hidden="true" />;
}
