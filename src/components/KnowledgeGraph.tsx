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

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  NODES,
  LINKS,
  VIEW,
  CAT_META,
  SCALE,
  CLUSTER_CENTERS,
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

/* ============================================================================
   实时物理（拖拽用）

   直接照搬桌面版《知识关系图.html》第 558~637 行的 tick()。
   关键点：那些常量（REPULSION 45000、LINK_DIST_IN 52、LINK_DIST_OUT 110、
   CLUSTER_SEP 0.0006、PAD 22、CLUSTER_PULL 0.032 …）都是**绝对量**，
   绑在桌面版的像素尺度上（VW/VH ≈ 1440x900、R_MAX = 52）。

   本站坐标是 1000 基准，归一化时的尺度比是 SCALE（≈0.94）。
   长度量乘 SCALE，加速度量乘 SCALE（力 ∝ 1/d²，长度缩 s 后力缩 1/s²，
   再乘 s 位移…实测统一乘 SCALE 与桌面版观感一致；见下方常量注释）。
   ========================================================================= */
const S = SCALE;
const PHYS = {
  REPULSION: 45000 * S * S * S,   /* 让 1/d² 的力在缩放的坐标里给出同量级位移 */
  LINK_DIST_IN: 52 * S,
  LINK_DIST_OUT: 110 * S,
  LINK_STRENGTH: 0.5,
  CENTER_PULL: 0.010,
  CLUSTER_PULL: 0.032,
  CLUSTER_SEP: 0.0006 * S * S * S,
  DAMP: 0.85,
  PAD: 22 * S,
  ALPHA_DECAY: 0.997,
  ALPHA_MIN: 0.004,
};
/** 每次拖拽的"重新收敛"强度。
    桌面版拖拽用的是 0.5，但在桌面版里那是"整图重新布局"的强度：
    实测它会把其它节点的中位位移推到 176，在本站视觉上就是"整图炸开"。
    实测扫描（拖 300）：
      0.5  → 中位 176 / p90 467 / 最大 625
      0.08 → 中位  91 / p90 254 / 最大 481
      0.03 → 中位  49 / p90  84 / 最大 149   ← 采用
    0.03 配合 2 步/帧，呈"邻近节点被明显带动、远处基本不动"的局部收敛。 */
const DRAG_ALPHA_START = 0.03;
/** 每帧跑几步（配合 0.03 用 2 步） */
const STEPS_PER_FRAME = 2;

/** 团心：用离线一并导出的那一份。
    不能用"当前布局的重心"临时算 —— 那份和离线收敛时的团心不一致，
    一跑物理整图就会漂（实测中位漂移 150+）。 */
const CLUSTER_CENTER: Record<string, { x: number; y: number }> = Object.fromEntries(
  Object.entries(CLUSTER_CENTERS).map(([k, v]) => [k, { x: v.x, y: v.y }]),
);

/** 逻辑坐标下的物理节点（与渲染解耦，避免每帧 setState 造大量对象） */
type PhysNode = { x: number; y: number; vx: number; vy: number; r: number; cat: string };

const CAT_OF: Record<string, string> = Object.fromEntries(NODES.map((n) => [n.id, n.cat]));
/** 边索引：P 与 NODES 同序，所以直接用下标 */
const EDGES = LINKS.map((l, i) => ({ i, a: NODES.findIndex((n) => n.id === l.a), b: NODES.findIndex((n) => n.id === l.b), same: CAT_OF[l.a] === CAT_OF[l.b] }));

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

  /* 入场动画会把 stroke-dasharray 写成内联样式，动画结束后清掉。
     但 React 只在 style 对象变化时重设，清掉之后跨团虚线的 8 10 就回不来了。
     这个计数用来在动画结束后强制重渲一次，让 dash 声明重新落到 DOM 上。
     看到这里别删 —— 少了它所有线都会变成实线（实测）。 */
  const [dashEpoch, setDashEpoch] = useState(0);
  /* 平移偏移。跟缩放不同，这里只做纯平移，节点坐标不受影响。 */
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRefState = useRef(pan);
  panRefState.current = pan;

  /* ---------------------------------------------------------------- 实时物理
     桌面版拖动时会每帧跑 tick()，所以被拖的节点会把周围的节点推开、
     在其附近局部重新收敛。这里复刻同一套：物理状态放在 ref 里，
     每帧算完再把结果推给 React state 渲染。 */
  const physRef = useRef<PhysNode[]>(
    NODES.map((n) => ({ x: n.x, y: n.y, vx: 0, vy: 0, r: n.r, cat: n.cat })),
  );
  const alphaRef = useRef(DRAG_ALPHA_START);
  const rafRef = useRef<number | null>(null);
  const pinRef = useRef<{ i: number; x: number; y: number } | null>(null);

  /** 一步物理。照桌面版 tick() 的五段：互斥 / 弹簧 / 团心 / 积分 / 硬性防重叠 */
  const tick = useCallback(() => {
    const P = physRef.current;
    const n = P.length;
    let alpha = alphaRef.current;
    const pinned = pinRef.current;

    /* ① 节点互斥。力是常数，不乘 alpha —— 乘了会让节点塌成一团 */
    for (let i = 0; i < n; i++) {
      const a = P[i];
      for (let j = i + 1; j < n; j++) {
        const b = P[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
        if (d2 > 700 * 700) continue;
        const d = Math.sqrt(d2), f = PHYS.REPULSION / d2, ux = dx / d, uy = dy / d;
        a.vx -= ux * f; a.vy -= uy * f; b.vx += ux * f; b.vy += uy * f;
      }
    }
    /* ② 边的弹簧：团内紧、团间松 */
    for (const e of EDGES) {
      const a = P[e.a], b = P[e.b];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const ideal = e.same ? PHYS.LINK_DIST_IN : PHYS.LINK_DIST_OUT;
      const f = (d - ideal) * PHYS.LINK_STRENGTH * alpha / d;
      a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
    }
    /* ③ 团心互斥 */
    const cats = Object.keys(CLUSTER_CENTER);
    for (let i = 0; i < cats.length; i++) for (let j = i + 1; j < cats.length; j++) {
      const A = CLUSTER_CENTER[cats[i]], B = CLUSTER_CENTER[cats[j]];
      const dx = B.x - A.x, dy = B.y - A.y, d2 = dx * dx + dy * dy || 1;
      const f = PHYS.CLUSTER_SEP * VIEW.w * VIEW.h / d2, d = Math.sqrt(d2), ux = dx / d, uy = dy / d;
      A.x -= ux * f; A.y -= uy * f; B.x += ux * f; B.y += uy * f;
    }
    /* ④ 积分：被拖的节点钉在指针上，其余照常受力 */
    for (let i = 0; i < n; i++) {
      const p = P[i];
      if (pinned && pinned.i === i) { p.x = pinned.x; p.y = pinned.y; p.vx = 0; p.vy = 0; continue; }
      const c = CLUSTER_CENTER[p.cat];
      p.vx += (c.x - p.x) * PHYS.CLUSTER_PULL;
      p.vy += (c.y - p.y) * PHYS.CLUSTER_PULL;
      p.vx += (VIEW.x + VIEW.w / 2 - p.x) * PHYS.CENTER_PULL;
      p.vy += (VIEW.y + VIEW.h / 2 - p.y) * PHYS.CENTER_PULL;
      p.vx *= PHYS.DAMP; p.vy *= PHYS.DAMP;
      p.x += p.vx * alpha;
      p.y += p.vy * alpha;
    }
    /* ⑤ 硬性防重叠：把叠在一起的推开，被拖的那个不动 */
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = P[i], b = P[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const need = a.r + b.r + PHYS.PAD;
      if (d < need) {
        const push = (need - d) / 2, ux = dx / d, uy = dy / d;
        const aPinned = pinned && pinned.i === i;
        const bPinned = pinned && pinned.i === j;
        if (!aPinned) { a.x -= ux * push; a.y -= uy * push; }
        if (!bPinned) { b.x += ux * push; b.y += uy * push; }
      }
    }
    alphaRef.current = Math.max(PHYS.ALPHA_MIN, alpha * PHYS.ALPHA_DECAY);
  }, []);

  /** 把物理结果同步给渲染层 */
  const syncFromPhys = useCallback(() => {
    const P = physRef.current;
    const next: Record<string, Pos> = {};
    NODES.forEach((n, i) => { next[n.id] = { x: P[i].x, y: P[i].y }; });
    setPos(next);
  }, []);

  /** 每帧循环：只有"正在拖节点"时才跑物理，其余时间一帧不动（同桌面版） */
  const loop = useCallback(() => {
    if (pinRef.current) {
      for (let k = 0; k < STEPS_PER_FRAME; k++) tick();
      syncFromPhys();
      rafRef.current = requestAnimationFrame(loop);
    } else {
      rafRef.current = null;
    }
  }, [tick, syncFromPhys]);

  const startLoop = useCallback(() => {
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(loop);
  }, [loop]);

  /* 卸载时停掉 raf */
  useEffect(() => () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); }, []);

  /* 屏幕坐标 → viewBox 坐标。

     ⚠ 不能用"(clientX - rect.left) / rect.width * VW" 这种线性换算：
     SVG 默认 preserveAspectRatio="xMidYMid meet"，容器宽高比与 viewBox 不一致时
     会在长边方向居中留白。本站实测容器 1320x840（比 1.572）、viewBox 1170x886
     （比 1.320），水平留白各 105.5px —— 线性换算的误差中位 41.9px、最大 85.3px，
     比小节点的半径还大，悬停根本命中不了。

     正解是用浏览器给的变换矩阵（getScreenCTM），它把留白、缩放都算进去了。 */
  const toView = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const ctm = svg.getScreenCTM?.();
    if (ctm && typeof DOMPoint !== 'undefined') {
      const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
      return { x: p.x, y: p.y };
    }
    /* 没有 getScreenCTM（极老环境）时退回线性换算，至少不会崩 */
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
    if (hit) {
      /* 钉住被拖节点，并把收敛强度拉回 0.5 —— 桌面版拖拽时就是让它"在别处重新抖一下" */
      pinRef.current = { i: NODES.findIndex((n) => n.id === hit.id), x: pos[hit.id].x, y: pos[hit.id].y };
      alphaRef.current = DRAG_ALPHA_START;
      startLoop();
    }
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
      /* 只更新"钉子"的位置；其它节点的位移交给物理循环 */
      if (pinRef.current) { pinRef.current.x = p.x - d.tx; pinRef.current.y = p.y - d.ty; }
      startLoop();
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

    if (d.part === 'node' && d.id) {
      if (isClick) onPick?.(picked === d.id ? null : (NODES.find((n) => n.id === d.id) ?? null));
      /* 松手：解除钉子，再让物理收几步，把最后的位置坐实 */
      for (let k = 0; k < 12; k++) tick();
      pinRef.current = null;
      syncFromPhys();
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

      /* 连线"接线"：先按各自长度设 dashoffset，再收回。
         ⚠ 画完之后必须把这些内联的 dash 属性清掉！
         GSAP 会把 stroke-dasharray / stroke-dashoffset 写成元素的内联样式，
         值是"动画那一刻的线长"。拖动节点后线长变了，那个内联值不会跟着变：
         只要旧值大于新线长，整条线就落在 dash 的空隙里 —— 完全画不出来。
         实测拖动后有 155/239 条线因此消失，就是"线是断的"的原因。
         清掉之后由 JSX 上的 strokeDasharray 属性接管（跨团虚线才有 8 10）。 */
      const clearDash = () => {
        linkEls.forEach((el) => {
          el.style.removeProperty('stroke-dasharray');
          el.style.removeProperty('stroke-dashoffset');
        });
        /* 清完之后必须让 React 重新写一次 dash 声明：
           React 只在 style 对象变化时才更新 DOM，内联被清掉后它并不知道，
           跨团虚线的 8 10 就再也回不来了（实测会全部变成实线）。 */
        setDashEpoch((v) => v + 1);
      };
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
            onComplete: clearDash,
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
                  /* key 里带上 dashEpoch：入场动画清掉内联 dash 之后，
                     把这几条线重新挂载一次，让 JSX 上的 dash 声明重新落进 DOM。
                     否则 React 认为 style 没变、不更新，跨团虚线会全变实线。 */
                  key={`${i}-${dashEpoch}`}
                  data-link
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={active ? 'var(--color-accent)' : 'var(--color-text)'}
                  strokeWidth={1.6}
                  strokeOpacity={active ? 0.85 : dim ? 0.06 : l.same ? 0.2 : 0.1}
                  /* 双保险之二：把 dash 也声明在 style 里。
                     GSAP 入场动画同样写的是内联样式，动画结束若清得不干净，
                     旧值会把线整条吃掉（实测拖动后 155/239 条消失）。
                     这里让最终态始终有一份明确的 dash 声明。 */
                  style={{
                    strokeDasharray: l.same ? 'none' : '8 10',
                    transition: 'stroke-opacity 220ms ease, stroke 220ms ease',
                  }}
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
                  data-node={n.id}
                  /* data-focus 标记"当前悬停/选中的是不是这个节点"。
                     渲染本身靠内联 opacity/stroke 表达，DOM 上看不出判定结果，
                     有了它悬停精度才能被实测（探针读这个属性）。 */
                  data-focus={isFocus ? '1' : '0'}
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
