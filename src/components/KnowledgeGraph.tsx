/* ============================================================================
   知识谱系 · 力导向关联图（React 版）

   布局与交互全部照桌面版《知识关系图.html》的做法来：
   - 坐标离线算好（见 data/knowledge.ts），页面不做物理模拟
   - 标签无条件放在节点正下方：dy = 半径 + 12，水平居中
   - 拖拽：按住节点拖那个节点；按住空白平移画布
   - 点击判定优先看 pointerup 的命中目标是不是节点本身，而不是只看位移
     （拖完节点后位移必然很大，纯阈值会把点击误判成拖拽）
   - 不做滚轮缩放

   只有渲染层是重写的：配色换成站点语义色（否则浅色配色在深色站里会割裂），
   动效走 GSAP 并受 MOTION 三级降级控制。
   ========================================================================= */

import { useCallback, useRef, useState } from 'react';
import {
  NODES,
  LINKS,
  VIEW,
  CAT_META,
  type KnowledgeLink,
  type KnowledgeNode,
} from '../data/knowledge';
import { gsap, useGSAP, ScrollTrigger, canAnimateDecor, canAnimateBase } from '../lib/motion';

/* 语义色 → 站点令牌。不用十色彩虹，靠色相家族分组 */
const COLOR_VAR: Record<string, string> = {
  accent: 'var(--color-accent)',
  ice: 'var(--color-ice)',
  teal: 'var(--color-teal)',
  amber: 'var(--color-amber)',
  iris: 'var(--color-iris)',
};

const VW = VIEW.w;
const VH = VIEW.h;

/** 画布内的位置，可被拖动改变 */
type Pos = { x: number; y: number };

/** 节点 id → 邻接集合 */
const ADJ: Record<string, Set<string>> = (() => {
  const m: Record<string, Set<string>> = {};
  for (const n of NODES) m[n.id] = new Set();
  for (const l of LINKS) {
    m[l.a].add(l.b);
    m[l.b].add(l.a);
  }
  return m;
})();

/** 节点 id → 半径（命中检测要用） */
const R_OF: Record<string, number> = Object.fromEntries(NODES.map((n) => [n.id, n.r]));

/** 门类 → 语义色（拍平，省掉每帧查表） */
const CAT_COLOR_OF: Record<string, string> = Object.fromEntries(
  Object.entries(CAT_META).map(([k, v]) => [k, v.color]),
);

type Props = {
  /** preview：首页静态版（只有入场与呼吸）；full：详情页可拖拽可点击 */
  variant?: 'preview' | 'full';
  className?: string;
  onPick?: (node: KnowledgeNode | null) => void;
  picked?: string | null;
};

export default function KnowledgeGraph({
  variant = 'preview',
  className = '',
  onPick,
  picked = null,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const panRef = useRef<SVGGElement>(null);
  const [hover, setHover] = useState<string | null>(null);

  /* 节点位置。初始值来自离线数据；拖动后只改这里，数据文件不动。 */
  const [pos, setPos] = useState<Record<string, Pos>>(() =>
    Object.fromEntries(NODES.map((n) => [n.id, { x: n.x, y: n.y }])),
  );

  /* 悬停优先，其次选中 */
  const focusId = hover ?? picked;
  const interactive = variant === 'full';

  /* 拖动状态。用 ref，避免每次 pointermove 都触发额外渲染。 */
  const dragRef = useRef<{
    part: 'node' | 'pan';
    id?: string;
    x: number;
    y: number;
    tx: number;
    ty: number;
    moved: boolean;
    downX: number;
    downY: number;
  } | null>(null);
  /* 平移偏移。跟缩放不同，这里只做纯平移，节点坐标不受影响。 */
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRefState = useRef(pan);
  panRefState.current = pan;

  /* 屏幕坐标 → viewBox 坐标 */
  const toView = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    return {
      x: VIEW.x + ((clientX - r.left) / r.width) * VW,
      y: VIEW.y + ((clientY - r.top) / r.height) * VH,
    };
  }, []);

  /* 命中检测：从"最上层"（数组末尾、也是最小的点）往回找，与桌面版一致 */
  const hitTest = useCallback(
    (clientX: number, clientY: number) => {
      const p = toView(clientX, clientY);
      /* 平移偏移要减掉，否则平移后点不中 */
      const wx = p.x - panRefState.current.x;
      const wy = p.y - panRefState.current.y;
      for (let i = NODES.length - 1; i >= 0; i--) {
        const n = NODES[i];
        const q = pos[n.id];
        const rr = R_OF[n.id] + 4;
        if ((wx - q.x) ** 2 + (wy - q.y) ** 2 <= rr * rr) return n;
      }
      return null;
    },
    [pos, toView],
  );

  /* ------------------------------------------------------------ 指针交互 */
  const onPointerDown = (e: React.PointerEvent) => {
    if (!interactive) return;
    const hit = hitTest(e.clientX, e.clientY);
    /* downX/downY 必须在这里初始化：只靠 pointermove 更新的话，
       "按下即抬起"（触屏轻点、辅助输入）会把点击误判成拖拽。 */
    dragRef.current = {
      part: hit ? 'node' : 'pan',
      id: hit?.id,
      x: hit ? pos[hit.id].x : 0,
      y: hit ? pos[hit.id].y : 0,
      tx: panRefState.current.x,
      ty: panRefState.current.y,
      moved: false,
      downX: e.clientX,
      downY: e.clientY,
    };
    try {
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* 合成事件没有真实 pointerId 时会抛，忽略即可 */
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!interactive) return;
    const d = dragRef.current;
    if (!d) {
      /* 没有按下时做悬停探测 */
      const hit = hitTest(e.clientX, e.clientY);
      setHover(hit ? hit.id : null);
      return;
    }
    const p = toView(e.clientX, e.clientY);
    if (d.part === 'node' && d.id) {
      d.moved = true;
      const wx = p.x - d.tx;
      const wy = p.y - d.ty;
      setPos((prev) => ({ ...prev, [d.id!]: { x: wx, y: wy } }));
    } else {
      d.moved = true;
      setPan({ x: d.tx + (e.clientX - d.downX), y: d.ty + (e.clientY - d.downY) });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!interactive) return;
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;

    /* 点击判定照桌面版：优先看 pointerup 的命中目标是不是节点本身，
       这比纯位移阈值稳 —— 拖完节点后位移必然很大，阈值法会把点击吃掉。 */
    const hitTarget = !!(e.target as Element)?.closest?.('[data-node]');
    const dist = Math.hypot(e.clientX - d.downX, e.clientY - d.downY);
    const isClick = (hitTarget || dist <= 6) && dist <= 10;

    if (d.part === 'node' && d.id && isClick) {
      onPick?.(picked === d.id ? null : (NODES.find((n) => n.id === d.id) ?? null));
    } else if (d.part === 'pan' && isClick) {
      onPick?.(null); /* 点空白 → 关面板 */
    }
  };

  /* ---------------------------------------------------------------- 入场动效 */
  useGSAP(
    () => {
      const root = rootRef.current;
      const svg = svgRef.current;
      if (!root || !svg) return;

      const nodeEls = gsap.utils.toArray<SVGGElement>('[data-node]', root);
      const linkEls = gsap.utils.toArray<SVGLineElement>('[data-link]', root);
      const labelEls = gsap.utils.toArray<SVGTextElement>('[data-label]', root);
      const hubEls = gsap.utils.toArray<SVGCircleElement>('[data-hub]', root);

      /* 减弱动效 / ?still=1：直接给最终态，不播 */
      if (!canAnimateBase()) {
        gsap.set([...nodeEls, ...labelEls], { opacity: 1 });
        gsap.set(linkEls, { strokeDasharray: 'none', strokeDashoffset: 0 });
        return;
      }

      const tl = gsap.timeline({
        scrollTrigger: { trigger: root, start: 'top 78%', once: true },
        defaults: { ease: 'power3.out' },
      });

      /* 整片从"失焦"浮现 —— 比单纯淡入更有进入感 */
      tl.fromTo(svg, { opacity: 0, filter: 'blur(10px)' }, { opacity: 1, filter: 'blur(0px)', duration: 0.85 });

      /* 连线"接线"：先按各自长度设 dashoffset，再收回 */
      if (canAnimateDecor()) {
        linkEls.forEach((el) => {
          const len = el.getTotalLength ? el.getTotalLength() : 100;
          gsap.set(el, { strokeDasharray: len, strokeDashoffset: len });
        });
        tl.to(
          linkEls,
          {
            strokeDashoffset: 0,
            duration: 1.15,
            ease: 'power2.inOut',
            stagger: { each: 0.004, from: 'center', grid: 'auto' },
          },
          0.1,
        );
      }

      /* 节点从团心炸开就位 */
      tl.fromTo(
        nodeEls,
        { scale: 0, opacity: 0, transformOrigin: 'center center' },
        { scale: 1, opacity: 1, duration: 0.7, ease: 'back.out(1.7)', stagger: { each: 0.012, from: 'random' } },
        0.25,
      );

      /* 标签最后浮现：先看结构，再读名字 */
      tl.fromTo(
        labelEls,
        { opacity: 0, y: -4 },
        { opacity: 1, y: 0, duration: 0.5, stagger: { each: 0.008, from: 'start' } },
        '-=0.35',
      );

      /* 枢纽呼吸光晕 */
      if (canAnimateDecor() && hubEls.length) {
        hubEls.forEach((el, i) => {
          gsap.to(el, {
            scale: 1.06,
            opacity: 0.5,
            duration: 2.6 + i * 0.4,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
            transformOrigin: 'center center',
            delay: 1.4 + i * 0.3,
          });
        });
      }

      return () => {
        ScrollTrigger.getAll().forEach((st) => {
          if (st.trigger === root) st.kill();
        });
      };
    },
    { scope: rootRef, dependencies: [variant] },
  );

  /* -------------------------------------------------------------- 高亮状态 */
  const isDim = (id: string) => {
    if (!focusId) return false;
    if (id === focusId) return false;
    return !ADJ[focusId]?.has(id);
  };
  const linkActive = (l: KnowledgeLink) => focusId !== null && (l.a === focusId || l.b === focusId);
  const linkDim = (l: KnowledgeLink) => focusId !== null && !linkActive(l);

  return (
    <div
      ref={rootRef}
      className={`relative ${className}`}
      /* preview 版整体不可交互：只作视觉，点整张卡进详情页 */
      style={interactive ? undefined : { pointerEvents: 'none' }}
    >
      <svg
        ref={svgRef}
        viewBox={`${VIEW.x} ${VIEW.y} ${VW} ${VH}`}
        className="h-full w-full"
        role={interactive ? 'application' : 'img'}
        aria-label={`知识谱系：${NODES.length} 门学科、${LINKS.length} 条关联`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setHover(null)}
        style={{
          cursor: interactive ? 'grab' : 'default',
          touchAction: interactive ? 'none' : undefined,
          userSelect: 'none',
        }}
      >
        <defs>
          {/* 枢纽柔光：用径向渐变叠加，比滤镜省 */}
          <radialGradient id="kg-hub" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.35" />
            <stop offset="70%" stopColor="var(--color-accent)" stopOpacity="0.06" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <g ref={panRef} data-pan transform={`translate(${pan.x} ${pan.y})`}>
          {/* ---- 连线：团内实线承担结构，跨团虚线退到背景 ---- */}
          <g>
            {LINKS.map((l, i) => {
              const a = pos[l.a];
              const b = pos[l.b];
              const active = linkActive(l);
              const dim = linkDim(l);
              return (
                <line
                  key={i}
                  data-link
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={active ? 'var(--color-accent)' : 'var(--color-text)'}
                  strokeWidth={1.6}
                  strokeOpacity={active ? 0.85 : dim ? 0.06 : l.same ? 0.2 : 0.1}
                  strokeDasharray={l.same ? undefined : '8 10'}
                  style={{ transition: 'stroke-opacity 220ms ease, stroke 220ms ease' }}
                />
              );
            })}
          </g>

          {/* ---- 节点：实心圆 + 正下方的标签 ---- */}
          <g>
            {NODES.map((n) => {
              const color = COLOR_VAR[CAT_COLOR_OF[n.cat]];
              const dim = isDim(n.id);
              const isFocus = n.id === focusId;
              const isHub = n.deg >= 15;
              const q = pos[n.id];
              return (
                <g
                  key={n.id}
                  data-node
                  transform={`translate(${q.x} ${q.y})`}
                  style={{
                    opacity: dim ? 0.12 : 1,
                    transition: 'opacity 220ms ease',
                    cursor: interactive ? 'pointer' : 'default',
                  }}
                >
                  {/* 枢纽柔光（呼吸层） */}
                  {isHub && canAnimateDecor() ? (
                    <circle
                      data-hub
                      r={n.r * 2.6}
                      fill="url(#kg-hub)"
                      opacity={0.34}
                      style={{ mixBlendMode: 'screen' }}
                    />
                  ) : null}
                  {/* 选中时的一圈细环（fill 保持实心，不加半透明填充） */}
                  {isFocus ? (
                    <circle
                      r={n.r + 6}
                      fill="none"
                      stroke={color}
                      strokeWidth={1.6}
                      opacity={0.9}
                      style={{ pointerEvents: 'none' }}
                    />
                  ) : null}
                  <circle r={n.r} fill={color} fillOpacity={1} />
                  {/* 标签：一律在节点正下方（dy = 半径 + 12），与桌面版一致。
                      不做翻转、不做水平偏移 —— 用户明确要求"所有文字在节点下方"。 */}
                  <text
                    data-label
                    y={n.r + 12}
                    textAnchor="middle"
                    fontSize={n.r > 17 ? 12.5 : n.r > 10 ? 11 : 10}
                    fill={isFocus ? 'var(--color-text)' : 'var(--color-muted)'}
                    style={{
                      fontFamily: 'var(--font-sans)',
                      letterSpacing: '0.01em',
                      transition: 'fill 220ms ease',
                      /* 文字不参与命中，拖拽与点击都由圆来接收 */
                      pointerEvents: 'none',
                    }}
                  >
                    {n.name}
                  </text>
                </g>
              );
            })}
          </g>
        </g>
      </svg>
    </div>
  );
}
