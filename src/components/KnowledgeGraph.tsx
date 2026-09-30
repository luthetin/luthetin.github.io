/* ============================================================================
   知识谱系 · 力导向关联图（React 版）

   与桌面版《知识关系图.html》的关系：
   - 数据同源；坐标在构建时离线算好（见 data/knowledge.ts），页面不做物理模拟
   - 渲染层完全重写：配色改用站点语义色（不再十色彩虹），字体、圆角、发丝线全部对齐站点令牌

   动效设计（每条都有理由；受 MOTION 三级降级控制）
   1. 节点从团心向外"炸开"就位        → 交代"这些学科本来是一团，被关系撑开了"
   2. 连线从起点生长到终点（dashoffset）→ 视觉上"接线"，比淡入更像关系被建立
   3. 标签在节点就位后浮现            → 先看结构，再读名字，避免一开始满屏文字
   4. 高连通节点极慢呼吸光晕          → 标记"枢纽"，同时是静止页面上的唯一活物
   5. 悬停高亮邻接 / 点击展开面板      → 反馈与状态迁移
   ========================================================================= */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  NODES,
  LINKS,
  TOOLS,
  CAT_META,
  VIEW,
  type KnowledgeLink,
  type KnowledgeNode,
} from '../data/knowledge';
import { gsap, useGSAP, ScrollTrigger, MOTION, canAnimateDecor, canAnimateBase } from '../lib/motion';

/* 语义色 → 站点令牌。不用十色彩虹，靠色相家族分组 */
const COLOR_VAR: Record<string, string> = {
  accent: 'var(--color-accent)',
  ice: 'var(--color-ice)',
  teal: 'var(--color-teal)',
  amber: 'var(--color-amber)',
  iris: 'var(--color-iris)',
};

type Props = {
  /** preview：首页静态版（只有入场与呼吸，不响应鼠标）；full：详情页可交互 */
  variant?: 'preview' | 'full';
  className?: string;
  /** 点击节点时回调（full 版用） */
  onPick?: (node: KnowledgeNode | null) => void;
  /** 当前选中的节点 id（full 版受控） */
  picked?: string | null;
};

const VW = VIEW.w;
const VH = VIEW.h;
/* 所有视觉常量原本按 0..1 尺度写，这里统一折算到 1000 基准 */
const U = 1000 / VIEW.w;

/** 节点 id → 邻接 id 集合 */
const ADJ: Record<string, Set<string>> = (() => {
  const m: Record<string, Set<string>> = {};
  for (const n of NODES) m[n.id] = new Set();
  for (const l of LINKS) {
    m[l.a].add(l.b);
    m[l.b].add(l.a);
  }
  return m;
})();

export default function KnowledgeGraph({ variant = 'preview', className = '', onPick, picked = null }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const panRef = useRef<SVGGElement>(null);
  const [hover, setHover] = useState<string | null>(null);

  /* 高亮的对象：悬停优先，其次选中 */
  const focusId = hover ?? picked;

  /* 度数归一化，用于节点视觉权重（0..1） */
  const degNorm = useMemo(() => {
    const max = Math.max(...NODES.map((n) => n.deg));
    const min = Math.min(...NODES.map((n) => n.deg));
    const m: Record<string, number> = {};
    for (const n of NODES) m[n.id] = (n.deg - min) / (max - min || 1);
    return m;
  }, []);

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

      /* 0) 整片从"失焦"浮现 —— 比单纯淡入更有进入感 */
      tl.fromTo(
        svg,
        { opacity: 0, filter: 'blur(10px)' },
        { opacity: 1, filter: 'blur(0px)', duration: 0.85 },
      );

      /* 1) 连线"接线"：先给每根线算好长度，再用 dashoffset 收回 */
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
            /* 从中心枢纽向外扩散地接线 */
            stagger: { each: 0.004, from: 'center', grid: 'auto' },
          },
          0.1,
        );
      }

      /* 2) 节点从团心炸开就位：位移 + 半径弹出，带一点回弹 */
      const nodeState = new Map<SVGGElement, { x: number; y: number }>();
      for (const n of NODES) nodeState.set(null as never, { x: 0, y: 0 });
      tl.fromTo(
        nodeEls,
        {
          scale: 0,
          opacity: 0,
          transformOrigin: 'center center',
        },
        {
          scale: 1,
          opacity: 1,
          duration: 0.7,
          ease: 'back.out(1.7)',
          stagger: { each: 0.012, from: 'random' },
        },
        0.25,
      );

      /* 3) 标签最后浮现：先看结构，再读名字 */
      tl.fromTo(
        labelEls,
        { opacity: 0, y: -4 },
        { opacity: 1, y: 0, duration: 0.5, stagger: { each: 0.008, from: 'start' } },
        '-=0.35',
      );

      /* 4) 枢纽呼吸（仅装饰层，且只在没有交互聚焦时保持低调） */
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

  /* ------------------------------------------------------- full 版：缩放与平移 */
  const viewRef = useRef({ zoom: 1, x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null);

  const applyView = useCallback(() => {
    const g = panRef.current;
    if (!g) return;
    const { zoom, x, y } = viewRef.current;
    g.setAttribute('transform', `translate(${x} ${y}) scale(${zoom})`);
  }, []);

  const resetView = useCallback(() => {
    viewRef.current = { zoom: 1, x: 0, y: 0 };
    applyView();
  }, [applyView]);

  const zoomBy = useCallback(
    (k: number, cx = VIEW.x + VW / 2, cy = VIEW.y + VH / 2) => {
      const v = viewRef.current;
      const next = Math.min(4, Math.max(0.6, v.zoom * k));
      /* 以光标/中心为锚点缩放 */
      v.x = cx - (cx - v.x) * (next / v.zoom);
      v.y = cy - (cy - v.y) * (next / v.zoom);
      v.zoom = next;
      applyView();
    },
    [applyView],
  );

  /* 把屏幕坐标换算成 viewBox 坐标（viewBox 是等比缩放的，所以只需线性换算） */
  const toView = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * VW, y: ((clientY - r.top) / r.height) * VH };
  }, []);

  /* 拖动平移（仅 full 版） */
  const onPointerDown = (e: React.PointerEvent) => {
    if (variant !== 'full') return;
    dragRef.current = { x: e.clientX, y: e.clientY, px: viewRef.current.x, py: viewRef.current.y, moved: false };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (variant !== 'full' || !dragRef.current) return;
    const d = dragRef.current;
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const kx = VW / r.width;
    const ky = VH / r.height;
    const dx = (e.clientX - d.x) * kx;
    const dy = (e.clientY - d.y) * ky;
    if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 4) d.moved = true;
    viewRef.current.x = d.px + dx;
    viewRef.current.y = d.py + dy;
    applyView();
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const onWheel = (e: React.WheelEvent) => {
    if (variant !== 'full') return;
    const p = toView(e.clientX, e.clientY);
    /* wheel 只用于缩放，缩放锁定在 viewBox 内 */
    zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, p.x, p.y);
  };

  /* 高亮状态：非邻接的一切都退到背景 */
  const isDim = (id: string) => {
    if (!focusId) return false;
    if (id === focusId) return false;
    return !ADJ[focusId]?.has(id);
  };
  const linkActive = (l: KnowledgeLink) => focusId !== null && (l.a === focusId || l.b === focusId);
  const linkDim = (l: KnowledgeLink) => focusId !== null && !linkActive(l);

  const interactive = variant === 'full';

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
        onPointerLeave={onPointerUp}
        onWheel={onWheel}
        style={{ cursor: interactive ? 'grab' : 'default', touchAction: interactive ? 'none' : undefined }}
      >
        <defs>
          {/* 枢纽的柔光：不用滤镜，用径向渐变叠加，更省 */}
          <radialGradient id="kg-hub" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.35" />
            <stop offset="70%" stopColor="var(--color-accent)" stopOpacity="0.06" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="kg-vignette" cx="50%" cy="46%" r="62%">
            <stop offset="55%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.55" />
          </radialGradient>
        </defs>

        <g ref={panRef}>
          {/* ---- 连线：团内实线承担结构，跨团虚线退到背景 ---- */}
          <g>
            {LINKS.map((l, i) => {
              const a = NODES.find((n) => n.id === l.a)!;
              const b = NODES.find((n) => n.id === l.b)!;
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
                  strokeWidth={(l.same ? 2.2 : 1.2) + l.w * (l.same ? 1.8 : 1.1)}
                  strokeOpacity={active ? 0.85 : dim ? 0.06 : l.same ? 0.16 : 0.075}
                  strokeDasharray={l.same ? undefined : '8 10'}
                  style={{ transition: 'stroke-opacity 260ms ease, stroke 260ms ease' }}
                />
              );
            })}
          </g>

          {/* ---- 节点 ---- */}
          <g>
            {NODES.map((n) => {
              const cat = CAT_META[n.cat];
              const color = COLOR_VAR[cat.color];
              const dim = isDim(n.id);
              const isFocus = n.id === focusId;
              const isHub = n.deg >= 15;
              return (
                <g
                  key={n.id}
                  data-node
                  transform={`translate(${n.x} ${n.y})`}
                  style={{
                    opacity: dim ? 0.14 : 1,
                    transition: 'opacity 260ms ease',
                    cursor: interactive ? 'pointer' : 'default',
                  }}
                  onPointerEnter={interactive ? () => setHover(n.id) : undefined}
                  onPointerLeave={interactive ? () => setHover(null) : undefined}
                  onClick={
                    interactive
                      ? (ev) => {
                          ev.stopPropagation();
                          if (dragRef.current?.moved) return; /* 拖拽不算点击 */
                          onPick?.(isFocus ? null : n);
                        }
                      : undefined
                  }
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
                  {/* 选中时的外环 */}
                  {isFocus ? (
                    <circle
                      r={n.r + 12}
                      fill="none"
                      stroke="var(--color-accent)"
                      strokeWidth={3}
                      opacity={0.9}
                    />
                  ) : null}
                  <circle
                    r={n.r}
                    fill={color}
                    fillOpacity={0.16 + degNorm[n.id] * 0.62}
                    stroke={color}
                    strokeWidth={2.2 + degNorm[n.id] * 2.2}
                    style={{ transition: 'fill-opacity 260ms ease' }}
                  />
                  {/* 内芯：让大节点有"实心感"，小点仍是小点 */}
                  <circle r={Math.max(0.9, n.r * 0.3)} fill={color} fillOpacity={0.85} />
                  <text
                    data-label
                    y={n.r + 26}
                    textAnchor="middle"
                    fontSize={n.r > 24 ? 22 : n.r > 14 ? 19 : 16}
                    fill={isFocus ? 'var(--color-text)' : 'var(--color-muted)'}
                    style={{
                      fontFamily: 'var(--font-sans)',
                      letterSpacing: '0.01em',
                      transition: 'fill 260ms ease',
                    }}
                  >
                    {n.name}
                  </text>
                </g>
              );
            })}
          </g>

          {/* 四周压暗，让中心的团自然成为焦点 */}
          <rect
            x={0}
            y={0}
            width={VW}
            height={VH}
            fill="url(#kg-vignette)"
            style={{ pointerEvents: 'none', mixBlendMode: 'multiply' }}
          />
        </g>
      </svg>

      {/* full 版：缩放控件 */}
      {interactive ? (
        <div className="pointer-events-auto absolute right-3 bottom-3 flex gap-2">
          <button
            type="button"
            onClick={() => zoomBy(1.25)}
            className="btn btn-ghost !px-2.5 !py-1.5 !text-[0.72rem]"
            aria-label="放大"
          >
            ＋
          </button>
          <button
            type="button"
            onClick={() => zoomBy(1 / 1.25)}
            className="btn btn-ghost !px-2.5 !py-1.5 !text-[0.72rem]"
            aria-label="缩小"
          >
            －
          </button>
          <button
            type="button"
            onClick={resetView}
            className="btn btn-ghost !px-2.5 !py-1.5 !text-[0.72rem]"
          >
            复位
          </button>
        </div>
      ) : null}
    </div>
  );
}

export { ADJ as KNOWLEDGE_ADJ, TOOLS as KNOWLEDGE_TOOLS, CAT_META as KNOWLEDGE_CAT };
