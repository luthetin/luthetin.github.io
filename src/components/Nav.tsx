import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { List, X } from '@phosphor-icons/react';
import { NAV, SITE } from '../data/site';
import { JumpLink } from './ui';
import { gsap, useGSAP, ScrollTrigger, MOTION } from '../lib/motion';

/* ----------------------------------------------------------------------------
   顶部导航：桌面单行、高度 64px；移动端全屏菜单
   当前所在板块用 IntersectionObserver 标记（不监听 window scroll 事件）
   -------------------------------------------------------------------------- */

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string>('');
  const barRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const onHome = pathname === '/';

  /* 滚过首屏后给导航加一条发丝线 + 提高不透明度 */
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const st = ScrollTrigger.create({
      start: 'top -72',
      end: 99999,
      onToggle: (self) => el.classList.toggle('is-stuck', self.isActive),
    });
    return () => st.kill();
  }, []);

  /* 滚动定位当前板块 */
  useEffect(() => {
    if (!onHome) {
      setCurrent('');
      return;
    }
    const targets = NAV.map((n) => document.querySelector(n.hash)).filter(Boolean) as Element[];
    if (!targets.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setCurrent('#' + visible.target.id);
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: [0, 0.2, 0.5] },
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, [onHome, pathname]);

  /* 移动端菜单：逐条错峰入场 */
  useGSAP(
    () => {
      const panel = panelRef.current;
      if (!panel || !open || MOTION.reduced) return;
      gsap.fromTo(
        panel.querySelectorAll('[data-menu-item]'),
        { y: 22, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, stagger: 0.06, ease: 'power3.out' },
      );
    },
    { dependencies: [open], scope: panelRef },
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <header
      ref={barRef}
      className="fixed inset-x-0 top-0 z-50 border-b border-transparent transition-colors duration-300 [&.is-stuck]:border-line [&.is-stuck]:glass"
    >
      <nav className="shell flex h-16 items-center justify-between" aria-label="主导航">
        <Link to="/" className="flex items-baseline gap-2.5" onClick={() => setOpen(false)}>
          <span className="text-[0.95rem] font-semibold tracking-[0.14em]">{SITE.name}</span>
          <span className="mono-label hidden sm:inline">陆思鼎</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {NAV.map((item) =>
            onHome ? (
              <JumpLink
                key={item.hash}
                hash={item.hash}
                aria-current={current === item.hash ? 'true' : undefined}
                className={`text-[0.85rem] tracking-wide transition-colors duration-200 ${
                  current === item.hash ? 'text-text' : 'text-muted hover:text-accent'
                }`}
              >
                {item.label}
              </JumpLink>
            ) : (
              <Link
                key={item.hash}
                to={`/${item.hash}`}
                className="text-[0.85rem] tracking-wide text-muted transition-colors duration-200 hover:text-accent"
              >
                {item.label}
              </Link>
            ),
          )}
          {onHome ? (
            <JumpLink hash="#contact" className="btn btn-primary !px-5 !py-2.5 !text-[0.8125rem]">
              联系我
            </JumpLink>
          ) : (
            <Link to="/#contact" className="btn btn-primary !px-5 !py-2.5 !text-[0.8125rem]">
              联系我
            </Link>
          )}
        </div>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center border border-line text-text transition-colors duration-200 hover:border-accent hover:text-accent md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? '关闭菜单' : '打开菜单'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={18} /> : <List size={18} />}
        </button>
      </nav>

      {open ? (
        <div
          id="mobile-menu"
          ref={panelRef}
          className="glass fixed inset-x-0 top-16 bottom-0 z-40 flex flex-col justify-between border-t border-line px-5 pt-8 pb-10 md:hidden"
        >
          <div className="flex flex-col">
            {NAV.map((item) =>
              onHome ? (
                <JumpLink
                  key={item.hash}
                  hash={item.hash}
                  data-menu-item
                  onNavigate={() => setOpen(false)}
                  className="flex items-baseline justify-between border-b border-line-soft py-5 text-2xl font-semibold"
                >
                  {item.label}
                  <span className="mono-label">{item.hash.replace('#', '')}</span>
                </JumpLink>
              ) : (
                <Link
                  key={item.hash}
                  to={`/${item.hash}`}
                  data-menu-item
                  onClick={() => setOpen(false)}
                  className="flex items-baseline justify-between border-b border-line-soft py-5 text-2xl font-semibold"
                >
                  {item.label}
                  <span className="mono-label">{item.hash.replace('#', '')}</span>
                </Link>
              ),
            )}
          </div>
          {onHome ? (
            <JumpLink
              hash="#contact"
              data-menu-item
              onNavigate={() => setOpen(false)}
              className="btn btn-primary w-full justify-center"
            >
              联系我
            </JumpLink>
          ) : (
            <Link
              to="/#contact"
              data-menu-item
              onClick={() => setOpen(false)}
              className="btn btn-primary w-full justify-center"
            >
              联系我
            </Link>
          )}
        </div>
      ) : null}
    </header>
  );
}
