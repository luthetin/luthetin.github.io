import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CaretDown } from '@phosphor-icons/react';
import DetailShell from '../components/DetailShell';
import { POEMS } from '../data/poems.js';
import { SITE_QUOTES } from '../data/quotes.js';
import { gsap, MOTION } from '../lib/motion';

/* ----------------------------------------------------------------------------
   诗歌方向详情：一本打开的书

   三个关键改动（之前是一张平铺列表，44 首读起来没有位置感）：
   1) 扉页：竖排书名 + 署名 + 年代跨度 + 序文。竖排只用在书名这类 2–5 字短元素上，
      正文保持横排（整首诗竖排会明显降低阅读体验）。
   2) 卷次：年份从灰色小字升级为「卷首」分隔，右侧标该年首数；左侧吸附显示当前卷。
   3) 位置感：左侧卷次刻度随滚动点亮，并显示「已展开几首」的微弱进度。

   交互与旧站一致：选集 → 目录 → 条目就地展开（可多开）→ 译文/注释点开才显示，
   并保留从首页佳句跳过来的 ?poem=诗名 深链。
   -------------------------------------------------------------------------- */

type Poem = {
  t: string;
  note?: string;
  trans?: string[] | string;
  notes?: string;
  body: string[];
};
type Essay = { title: string; date?: string; paras: string[] };
type Group = { year?: string; poems: Poem[] };
type Book = { name: string; intro?: Essay; outro?: Essay; groups: Group[] };

const BOOKS = POEMS as Record<string, Book>;
const BOOK_KEYS = ['chunlian', 'xingyin'] as const;
type BookKey = (typeof BOOK_KEYS)[number];

const poemKey = (b: BookKey, t: string) => `${b}:${t}`;
const panelKey = (b: BookKey, t: string, kind: string) => `${b}:${t}:${kind}`;
const norm = (s: string) => s.replace(/\s/g, '');

function countPoems(b: Book) {
  return b.groups.reduce((sum, g) => sum + g.poems.length, 0);
}

/* ------------------------------------------------------------- 佳句轮播 */
function QuoteStrip() {
  const [i, setI] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const quotes = SITE_QUOTES as { text: string; attr: string }[];

  useEffect(() => {
    if (MOTION.reduced || quotes.length < 2) return;
    const id = window.setInterval(() => setI((v) => (v + 1) % quotes.length), 6500);
    return () => window.clearInterval(id);
  }, [quotes.length]);

  useEffect(() => {
    const el = ref.current;
    if (!el || MOTION.reduced) return;
    /* 换句时只做位移与轻微模糊，绝不动 opacity：
       文字一旦被压到 0，在换句的瞬间就是"内容消失了"。 */
    gsap.fromTo(
      el,
      { y: 10, filter: 'blur(3px)' },
      { y: 0, filter: 'blur(0px)', duration: 0.6, ease: 'power2.out', clearProps: 'filter' },
    );
  }, [i]);

  const q = quotes[i];
  if (!q) return null;

  return (
    <div ref={ref} className="verse mt-6 text-[0.95rem] text-muted">
      <span>{q.text}</span>
      <span className="mt-2 block text-[0.78rem] text-accent">{q.attr}</span>
    </div>
  );
}

/* --------------------------------------------------------------- 序 / 跋 */
function EssayBlock({ essay, open, onToggle }: { essay: Essay; open: boolean; onToggle: () => void }) {
  return (
    <li className="border-b border-line-soft">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 py-4 text-left"
      >
        <span className="verse text-[1rem] transition-colors duration-200 hover:text-accent">
          {essay.title}
        </span>
        <span className="mono-label">{open ? '收起' : '展开'}</span>
      </button>
      {open ? (
        <div className="measure pb-8">
          {essay.paras.map((p) => (
            <p key={p} className="mb-4 text-[0.9rem] leading-[1.95] text-muted last:mb-0">
              {p}
            </p>
          ))}
          {essay.date ? <div className="mono-label mt-5">{essay.date}</div> : null}
        </div>
      ) : null}
    </li>
  );
}

/* ------------------------------------------------------------------ 正文 */
export default function Poetry() {
  const [book, setBook] = useState<BookKey>('chunlian');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [panels, setPanels] = useState<Record<string, boolean>>({});
  const [activeYear, setActiveYear] = useState<string | null>(null);
  const [params] = useSearchParams();
  const listRef = useRef<HTMLDivElement>(null);

  const b = BOOKS[book];
  const total = useMemo(
    () => BOOK_KEYS.reduce((sum, k) => sum + countPoems(BOOKS[k]), 0),
    [],
  );

  /* 已展开几首：给读者一个"我读到哪了"的微弱进度感，不做存档、不做强制 */
  const openedCount = useMemo(
    () => b.groups.reduce((n, g) => n + g.poems.filter((p) => open[poemKey(book, p.t)]).length, 0),
    [b, book, open],
  );

  /* ?poem=诗名 深链：自动选中诗集并展开该首 */
  useEffect(() => {
    const target = params.get('poem');
    if (!target) return;
    for (const k of BOOK_KEYS) {
      for (const g of BOOKS[k].groups) {
        for (const p of g.poems) {
          if (norm(p.t) === norm(target)) {
            setBook(k);
            setOpen((m) => ({ ...m, [poemKey(k, p.t)]: true }));
            window.setTimeout(() => {
              document
                .querySelector(`[data-poem="${CSS.escape(p.t)}"]`)
                ?.scrollIntoView({ behavior: MOTION.reduced ? 'auto' : 'smooth', block: 'center' });
            }, 140);
            return;
          }
        }
      }
    }
    const name = target.replace(/[序跋]/g, '');
    const hit = BOOK_KEYS.find((k) => BOOKS[k].name.includes(name));
    if (hit) setBook(hit);
  }, [params]);

  /* 卷次吸附：滚动时标出当前读到哪一年。用 IntersectionObserver，
     不监听 window scroll（页面本身不能逐帧算）。 */
  useEffect(() => {
    const root = listRef.current;
    if (!root) return;
    const marks = [...root.querySelectorAll('[data-year]')];
    if (!marks.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b2) => b2.intersectionRatio - a.intersectionRatio)[0];
        if (hit) setActiveYear(hit.target.getAttribute('data-year'));
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: [0, 1] },
    );
    marks.forEach((m) => io.observe(m));
    return () => io.disconnect();
  }, [book]);

  const jumpToYear = useCallback((year: string) => {
    const el = listRef.current?.querySelector(`[data-year="${CSS.escape(year)}"]`);
    el?.scrollIntoView({ behavior: MOTION.reduced ? 'auto' : 'smooth', block: 'start' });
  }, []);

  const togglePoem = (t: string) =>
    setOpen((m) => ({ ...m, [poemKey(book, t)]: !m[poemKey(book, t)] }));

  const togglePanel = (t: string, kind: string) =>
    setPanels((m) => ({ ...m, [panelKey(book, t, kind)]: !m[panelKey(book, t, kind)] }));

  const years = b.groups.map((g) => g.year).filter(Boolean) as string[];

  return (
    <DetailShell
      backTo="/#work"
      backLabel="返回作品"
      eyebrow="方向 03"
      title="诗歌"
      meta={`《春潋集》${countPoems(BOOKS.chunlian)} 首 · 《行吟集》${countPoems(BOOKS.xingyin)} 首 · 合计 ${total} 首 · 含序、跋与白话译文`}
    >
      {/* ======================= 扉页 ======================= */}
      <section className="relative border-t border-line pt-14 md:pt-20">
        <div className="flex items-start justify-between gap-8">
          <div className="min-w-0">
            <div className="mono-label">诗集</div>
            <h2 className="display-serif-cn mt-4 text-[clamp(1.9rem,5vw,3rem)]">
              《{b.name}》
            </h2>
            <p className="verse mt-5 text-[1.05rem] text-muted">
              陆思鼎
              <span className="mx-3 text-line">|</span>
              {years.length ? `${years[0]}–${years[years.length - 1]}` : ''}
              <span className="mx-3 text-line">|</span>
              {countPoems(b)} 首
            </p>

            {b.intro ? (
              <ul className="mt-8 max-w-[34rem]">
                <EssayBlock
                  essay={b.intro}
                  open={!!open[poemKey(book, b.intro.title)]}
                  onToggle={() =>
                    setOpen((m) => ({
                      ...m,
                      [poemKey(book, b.intro!.title)]: !m[poemKey(book, b.intro!.title)],
                    }))
                  }
                />
              </ul>
            ) : null}
          </div>

          {/* 竖排书名：全站唯一使用竖排的地方。
              只放 2–5 字，避免长竖排在字体差异下失控。 */}
          <div
            aria-hidden="true"
            className="vertical-cn hidden shrink-0 select-none text-[clamp(1.6rem,3.4vw,2.4rem)] leading-none text-accent-deep/70 md:block"
          >
            {b.name}
          </div>
        </div>
      </section>

      {/* ======================= 选集 + 目录 ======================= */}
      <div className="mt-20 grid gap-14 lg:grid-cols-12 lg:gap-16">
        {/* 左：选集、卷次刻度、佳句 */}
        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-28">
            <div className="flex flex-col gap-3">
              {BOOK_KEYS.map((k) => {
                const active = k === book;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setBook(k)}
                    aria-pressed={active}
                    className={`flex items-baseline justify-between border px-4 py-3.5 text-left transition-colors duration-200 ${
                      active
                        ? 'border-accent bg-ink text-accent'
                        : 'border-line text-text hover:border-accent/50 hover:text-accent'
                    }`}
                  >
                    <span className="verse text-[1.05rem]">《{BOOKS[k].name}》</span>
                    <span className="mono-label">{countPoems(BOOKS[k])} 首</span>
                  </button>
                );
              })}
            </div>

            {/* 卷次刻度：当前读到哪一年，一眼能看见 */}
            {years.length ? (
              <div className="mt-10 border-t border-line pt-6">
                <div className="flex items-baseline justify-between">
                  <span className="mono-label">卷次</span>
                  <span className="mono-label">
                    已展开 {openedCount} / {countPoems(b)}
                  </span>
                </div>
                <ul className="mt-4 flex flex-col gap-1">
                  {years.map((y) => {
                    const on = activeYear === y;
                    const n = b.groups.find((g) => g.year === y)?.poems.length ?? 0;
                    return (
                      <li key={y}>
                        <button
                          type="button"
                          onClick={() => jumpToYear(y)}
                          className={`flex w-full items-center gap-3 py-1.5 text-left transition-colors duration-200 ${
                            on ? 'text-accent' : 'text-faint hover:text-muted'
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`h-px transition-all duration-300 ${
                              on ? 'w-6 bg-accent' : 'w-3 bg-line'
                            }`}
                          />
                          <span className="num text-[0.78rem]">{y}</span>
                          <span className="num ml-auto text-[0.72rem]">{n} 首</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            <div className="mt-10 border-t border-line pt-6">
              <span className="mono-label">佳句</span>
              <QuoteStrip />
            </div>
          </div>
        </aside>

        {/* 右：卷次与正文 */}
        <div className="lg:col-span-8" ref={listRef}>
          <div className="flex items-baseline justify-between border-b border-line pb-4">
            <h2 className="verse text-xl">《{b.name}》目录</h2>
            <span className="mono-label">{countPoems(b)} 首</span>
          </div>

          <ul className="mt-8 flex flex-col gap-10">
            {b.groups.map((g) => (
              <li key={g.year ?? 'ungrouped'}>
                {g.year ? (
                  /* 卷首：年份从灰色小字升级为卷次分隔 */
                  <div data-year={g.year} className="volume-rule scroll-mt-24 pb-1">
                    <span>{g.year}</span>
                    <span className="text-faint">{g.poems.length} 首</span>
                  </div>
                ) : null}

                <ul className="mt-2">
                  {g.poems.map((p) => {
                    const isOpen = !!open[poemKey(book, p.t)];
                    const hasTrans = Array.isArray(p.trans)
                      ? p.trans.length > 0
                      : typeof p.trans === 'string' && p.trans.length > 0;
                    const showTrans = !!panels[panelKey(book, p.t, 'trans')];
                    const showNotes = !!panels[panelKey(book, p.t, 'notes')];
                    const transList = Array.isArray(p.trans) ? p.trans : p.trans ? [p.trans] : [];

                    return (
                      <li key={p.t} data-poem={p.t} className="scroll-mt-24 border-b border-line-soft">
                        <button
                          type="button"
                          onClick={() => togglePoem(p.t)}
                          aria-expanded={isOpen}
                          className="group flex w-full items-center justify-between gap-4 py-4 text-left"
                        >
                          <span className="verse text-[1.05rem] transition-colors duration-200 group-hover:text-accent">
                            {p.t}
                          </span>
                          <CaretDown
                            size={14}
                            className={`shrink-0 text-faint transition-transform duration-300 group-hover:text-accent ${
                              isOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </button>

                        {isOpen ? (
                          <div className="measure pb-9">
                            {p.note ? (
                              <p className="mb-6 text-[0.82rem] leading-[1.9] text-faint">{p.note}</p>
                            ) : null}

                            <div className="verse text-[1.08rem] leading-[2.05] text-text/92">
                              {p.body.map((line, i) => (
                                <span key={`${line}-${i}`} className="block">
                                  {line}
                                </span>
                              ))}
                            </div>

                            {hasTrans || p.notes ? (
                              <div className="mt-7 flex gap-2">
                                {hasTrans ? (
                                  <button
                                    type="button"
                                    onClick={() => togglePanel(p.t, 'trans')}
                                    aria-expanded={showTrans}
                                    className={`rounded-[var(--radius-tile)] border px-3 py-1.5 text-[0.78rem] transition-colors duration-200 ${
                                      showTrans
                                        ? 'border-accent text-accent'
                                        : 'border-line text-muted hover:border-accent/50 hover:text-accent'
                                    }`}
                                  >
                                    译文
                                  </button>
                                ) : null}
                                {p.notes ? (
                                  <button
                                    type="button"
                                    onClick={() => togglePanel(p.t, 'notes')}
                                    aria-expanded={showNotes}
                                    className={`rounded-[var(--radius-tile)] border px-3 py-1.5 text-[0.78rem] transition-colors duration-200 ${
                                      showNotes
                                        ? 'border-accent text-accent'
                                        : 'border-line text-muted hover:border-accent/50 hover:text-accent'
                                    }`}
                                  >
                                    注释
                                  </button>
                                ) : null}
                              </div>
                            ) : null}

                            {showTrans && transList.length ? (
                              <div className="measure mt-5 border-l border-accent/40 pl-5">
                                {transList.map((seg, i) => (
                                  <p
                                    key={`${seg}-${i}`}
                                    className="mb-3 text-[0.86rem] leading-[1.95] text-muted last:mb-0"
                                  >
                                    {seg}
                                  </p>
                                ))}
                              </div>
                            ) : null}

                            {showNotes && p.notes ? (
                              <div className="measure mt-5 border-l border-accent/40 pl-5">
                                <p className="text-[0.86rem] leading-[1.95] text-muted">{p.notes}</p>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>

          {b.outro ? (
            <ul className="mt-12 border-t border-line pt-2">
              <EssayBlock
                essay={b.outro}
                open={!!open[poemKey(book, b.outro.title)]}
                onToggle={() =>
                  setOpen((m) => ({
                    ...m,
                    [poemKey(book, b.outro!.title)]: !m[poemKey(book, b.outro!.title)],
                  }))
                }
              />
            </ul>
          ) : null}
        </div>
      </div>
    </DetailShell>
  );
}
