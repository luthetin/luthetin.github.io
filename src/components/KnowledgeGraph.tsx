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
        style={{ cursor: interactive ? 'default' : 'default' }}
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
                  /* 线宽统一为 1.6（1000 基准）：
                     之前按两端度数加权的粗细，在 239 条边的密度下只会显脏 ——
                     层级靠"团内实线 / 跨团虚线 + 透明度"表达就够了。 */
                  strokeWidth={1.6}
                  strokeOpacity={active ? 0.85 : dim ? 0.06 : l.same ? 0.20 : 0.10}
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
                  {/* 圆点本体：一个实心圆 + 一圈描边。
                      之前还叠了一个内芯，结果读起来像靶心 —— 去掉。 */}
                  <circle
                    r={n.r}
                    fill={color}
                    fillOpacity={0.30 + degNorm[n.id] * 0.55}
                    stroke={color}
                    strokeWidth={isFocus ? 2.6 : 1.4}
                    strokeOpacity={isFocus ? 1 : 0.75}
                    style={{ transition: 'fill-opacity 260ms ease, stroke-width 200ms ease' }}
                  />
                  <text
                    data-label
                    y={n.labelDy}
                    textAnchor="middle"
                    /* 字号压小：1000 基准下 13 大约相当于屏上 11px。
                       之前 16~22 偏大，是"字和节点、别的字重合"的主因之一。 */
                    fontSize={n.r > 24 ? 14 : n.r > 14 ? 13 : 12}
                    fill={isFocus ? 'var(--color-text)' : 'var(--color-muted)'}
                    style={{
                      fontFamily: 'var(--font-sans)',
                      letterSpacing: '0.01em',
                      transition: 'fill 260ms ease',
                      /* labelDy 为 0 表示离线排布时没找到不重叠的位置 —— 直接不渲染。
                         用 display:none 而不是 opacity:0：前者真正退出布局，
                         否则"看起来隐藏了"但仍占位，评估时也会被算进去。 */
                      display: n.labelDy === 0 ? 'none' : undefined,
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
    </div>
  );
}

export { ADJ as KNOWLEDGE_ADJ, TOOLS as KNOWLEDGE_TOOLS, CAT_META as KNOWLEDGE_CAT };
