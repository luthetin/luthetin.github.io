import { useRef, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react';
import AnimatedContent from './bits/AnimatedContent';
import { gsap, useGSAP, IS_FILE, MOTION, canAnimateDecor } from '../lib/motion';

/* ------------------------------------------------- 页内锚点（两种路由模式都能用）
   file:// 下用的是 HashRouter，锚点会被当成路由，所以这里统一改为
   scrollIntoView 手动滚动，并把 hash 写回地址栏（非 file 时）。 */
export function JumpLink({
  hash,
  children,
  className = '',
  onNavigate,
  ...rest
}: {
  hash: string;
  children: ReactNode;
  className?: string;
  onNavigate?: () => void;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  const id = hash.replace(/^#/, '');

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: MOTION.reduced ? 'auto' : 'smooth', block: 'start' });
    if (!IS_FILE) window.history.replaceState(null, '', `#${id}`);
    onNavigate?.();
  };

  return (
    <a href={`#${id}`} className={className} onClick={onClick} {...rest}>
      {children}
    </a>
  );
}

/* ---------------------------------------------------------------- 入场揭示 */
export function Reveal({
  children,
  delay = 0,
  distance = 28,
  className = '',
  as = 'div',
}: {
  children: ReactNode;
  delay?: number;
  distance?: number;
  className?: string;
  as?: 'div' | 'li' | 'section';
}) {
  // 非 div 的语义标签（如列表项）不能套在 AnimatedContent 的 div 外层，改为包在里层
  if (as !== 'div') {
    const Tag = as;
    return (
      <Tag className={className}>
        {MOTION.reduced ? (
          children
        ) : (
          <AnimatedContent distance={distance} duration={0.9} delay={delay} threshold={0.12} ease="power3.out">
            {children}
          </AnimatedContent>
        )}
      </Tag>
    );
  }

  if (MOTION.reduced) return <div className={className}>{children}</div>;

  return (
    <AnimatedContent
      className={className}
      distance={distance}
      duration={0.9}
      delay={delay}
      threshold={0.12}
      ease="power3.out"
    >
      {children}
    </AnimatedContent>
  );
}

/* ------------------------------------------------------------ 章节标题块 */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  id,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  id?: string;
}) {
  return (
    <div className="section-head">
      {eyebrow ? <span className="mono-label">{eyebrow}</span> : null}
      <h2 id={id} className="display text-[clamp(1.75rem,4vw,2.75rem)]">
        {title}
      </h2>
      {lead ? <p className="max-w-[38rem] text-[0.95rem] leading-relaxed text-muted">{lead}</p> : null}
    </div>
  );
}

/* -------------------------------------------------------------- 数字计数 */
export function StatNumber({ value, className = '' }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || MOTION.reduced) return;

      const counter = { v: 0 };
      const tween = gsap.to(counter, {
        v: value,
        duration: 1.5,
        ease: 'power2.out',
        onUpdate: () => {
          el.textContent = String(Math.round(counter.v));
        },
        onComplete: () => {
          /* 落定后闪一次玫瑰色：同一个机制，多一个收尾 */
          if (!canAnimateDecor()) return;
          el.classList.add('num-flash');
          window.setTimeout(() => el.classList.remove('num-flash'), 760);
        },
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      });

      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
      };
    },
    { dependencies: [value] },
  );

  return (
    <span ref={ref} className={`num ${className}`}>
      {value}
    </span>
  );
}

