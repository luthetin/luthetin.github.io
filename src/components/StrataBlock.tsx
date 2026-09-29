import { useEffect, useRef } from 'react';
import { MOTION } from '../lib/motion';

/* ----------------------------------------------------------------------------
   地层块线框（程序页的视觉主角）

   这不是截图，也不是装饰插画：它是把 GeoStructure Builder 的核心几何
   用同一套数学重画了一遍——张量积网格 + 高度场 → 多层界面 → 旋转投影。
   所以它同时证明了三件事：这个人会写 WebGL / 会做几何、模型长什么样、
   这一页不是模板。

   实现取舍：
   - 用 2D canvas 手写投影，不引 three.js（与"零依赖"的项目气质一致）
   - 只画线框 + 等高线，不填充面：暗底上线框比实体更容易看清结构
   - 每帧只清屏重绘点线，不做像素级运算，成本远低于 WebGL
   - 减弱动效 / ?still=1 / 慢设备 → 只画一帧静态角度
   -------------------------------------------------------------------------- */

type V3 = { x: number; y: number; z: number };

export default function StrataBlock({
  className = '',
  /** 网格分辨率（每边的格数） */
  grid = 7,
  /** 地层数 */
  layers = 5,
  /** 自转速度（弧度/秒） */
  spin = 0.14,
  height = 300,
}: {
  className?: string;
  grid?: number;
  layers?: number;
  spin?: number;
  height?: number;
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
    let raf = 0;
    let angle = 0.5;
    let last = 0;
    let visible = true;

    /* 高度场：两个错开的正弦叠加，做出"有起伏但不规则"的地形。
       与控制点插值的直觉一致：格点可导、连续、无锯齿。 */
    const H = (i: number, j: number, g: number) => {
      const u = i / g;
      const v = j / g;
      return (
        0.34 * Math.sin(u * Math.PI * 1.35 + 0.7) * Math.cos(v * Math.PI * 1.1 - 0.3) +
        0.18 * Math.sin((u + v) * Math.PI * 0.9) +
        0.08 * Math.cos(u * Math.PI * 3.1 - v * Math.PI * 2.2)
      );
    };

    const setup = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(rect.width, 1);
      h = Math.max(rect.height, 1);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    setup();
    window.addEventListener('resize', setup);

    /* 等距投影 + 绕竖轴旋转。深度用于决定线段明暗。 */
    const project = (p: V3, ca: number, sa: number, scale: number, ox: number, oy: number) => {
      const rx = p.x * ca - p.z * sa;
      const rz = p.x * sa + p.z * ca;
      const tilt = 0.62; // 俯角
      const sx = rx * scale;
      const sy = (p.y * Math.cos(tilt) - rz * Math.sin(tilt)) * scale;
      return { x: ox + sx, y: oy + sy, depth: rz };
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      const scale = Math.min(w / 2.9, h / 1.75);
      const ox = w / 2;
      const oy = h * 0.6;
      const ca = Math.cos(angle);
      const sa = Math.sin(angle);

      /* 世界坐标：x/z 在 [-1,1]，y 向上。整块高 layers * gap */
      const gap = 0.26;
      const half = 1;

      const P = (x: number, y: number, z: number) => project({ x, y, z }, ca, sa, scale, ox, oy);

      /* ---- 底座：一块平板，给出"方块"的落地感 ---- */
      const baseY = -0.32;
      const corners: V3[] = [
        { x: -half, y: baseY, z: -half },
        { x: half, y: baseY, z: -half },
        { x: half, y: baseY, z: half },
        { x: -half, y: baseY, z: half },
      ];
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(127, 168, 216, 0.16)'; // ice：程序方向的辅色
      ctx.beginPath();
      corners.forEach((c, i) => {
        const p = P(c.x, c.y, c.z);
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.stroke();

      /* ---- 每一层：顶面网格 + 等高线 ---- */
      for (let L = 0; L < layers; L++) {
        // 越靠上的层越亮；最上面一层是"地表"
        const t = L / Math.max(layers - 1, 1);
        const baseAlpha = 0.16 + t * 0.32;
        const isTop = L === layers - 1;
        const offsetY = L * gap;

        // 顶面网格线
        ctx.strokeStyle = isTop
          ? `rgba(224, 112, 143, ${(0.34 + 0.2 * t).toFixed(3)})` // 地表用玫瑰
          : `rgba(127, 168, 216, ${baseAlpha.toFixed(3)})`;
        ctx.lineWidth = isTop ? 1.25 : 0.8;

        // 两个方向的网格线
        for (let i = 0; i <= grid; i++) {
          ctx.beginPath();
          for (let j = 0; j <= grid; j++) {
            const x = (i / grid) * 2 - 1;
            const z = (j / grid) * 2 - 1;
            const y = H(i, j, grid) * (isTop ? 1 : 0.55) + offsetY;
            const p = P(x, y, z);
            j === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
          }
          ctx.stroke();
        }
        for (let j = 0; j <= grid; j++) {
          ctx.beginPath();
          for (let i = 0; i <= grid; i++) {
            const x = (i / grid) * 2 - 1;
            const z = (j / grid) * 2 - 1;
            const y = H(i, j, grid) * (isTop ? 1 : 0.55) + offsetY;
            const p = P(x, y, z);
            i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
          }
          ctx.stroke();
        }

        /* 等高线：只画在最高次序的界面（与项目实际行为一致），
           沿等高线方向连线，做出地图式标注的暗示。 */
        if (isTop) {
          ctx.strokeStyle = 'rgba(224, 167, 88, 0.42)'; // amber：图表标注系
          ctx.lineWidth = 0.9;
          const levels = [-0.12, 0.02, 0.16, 0.3];
          for (const lv of levels) {
            for (let j = 0; j < grid; j++) {
              for (let i = 0; i < grid; i++) {
                const h00 = H(i, j, grid);
                const h10 = H(i + 1, j, grid);
                const h01 = H(i, j + 1, grid);
                // 只在格子内部粗略判断是否跨过该等高值，画一小段
                const mn = Math.min(h00, h10, h01);
                const mx = Math.max(h00, h10, h01);
                if (lv < mn || lv > mx) continue;
                const x = ((i + 0.5) / grid) * 2 - 1;
                const z = ((j + 0.5) / grid) * 2 - 1;
                const p1 = P(x - 0.05, lv + offsetY, z);
                const p2 = P(x + 0.05, lv + offsetY, z + 0.06);
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
              }
            }
          }
        }

        /* 四角立柱：把层与层连成"实体"，否则看起来是浮空的纸片 */
        if (L < layers - 1) {
          ctx.strokeStyle = 'rgba(127, 168, 216, 0.12)';
          ctx.lineWidth = 0.7;
          for (const c of [
            [-half, -half],
            [half, -half],
            [half, half],
            [-half, half],
          ]) {
            const a = P(c[0], offsetY, c[1]);
            const b = P(c[0], offsetY + gap, c[1]);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
    };

    if (!decorative) {
      draw();
      return () => window.removeEventListener('resize', setup);
    }

    const loop = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      angle += spin * dt;
      draw();
      if (visible && !MOTION.slow) raf = requestAnimationFrame(loop);
      else raf = 0;
    };
    raf = requestAnimationFrame(loop);

    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        if (visible && !MOTION.slow && !raf) {
          last = 0;
          raf = requestAnimationFrame(loop);
        }
      },
      { threshold: 0 },
    );
    io.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('resize', setup);
    };
  }, [grid, layers, spin]);

  return (
    <canvas
      ref={ref}
      className={className}
      style={{ height, display: 'block', width: '100%' }}
      aria-hidden="true"
    />
  );
}
