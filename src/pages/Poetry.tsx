import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CaretDown } from '@phosphor-icons/react';
import DetailShell from '../components/DetailShell';
import { POEMS } from '../data/poems.js';
import { SITE_QUOTES } from '../data/quotes.js';
import { gsap, MOTION, canAnimateDecor } from '../lib/motion';

/* ----------------------------------------------------------------------------
   诗歌方向详情：一本打开的书

   设计取舍（重要）：诗的正文必须安静，华丽只放在"外壳"上。
   所以动效集中在这四处，正文本身不做逐字动画：
   1) 纸张：噪声颗粒 + 竖排界格（乌丝栏）+ 极弱氛围光 —— 解决"只有一种黑"
   2) 折叠 / 展开的排版反差：收起是 1.02rem 的灰字，展开跳成 2.5rem 大字，
      配开引号、序号、落款与印章 —— 这是整页最明显的排版事件
   3) 展开时正文逐行落字 + 译文/注释从左侧滑入
   4) 扉页：竖排发光书名 + 印章 + 年代跨度；卷次年份用大号展示体

   交互与旧站一致：选集 → 目录 → 条目就地展开（可多开）→ 译文/注释点开才显示，
   并保留 ?poem=诗名 深链。所有动效受 reduced / still / 慢设备三级降级。
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

/* 落款：从正文里取末句的头几个字，像手稿末尾的题识 */
function signOf(p: Poem) {
  const last = p.body[p.body.length - 1] ?? '';
  return last.replace(/[，。、；？！,.]/g, ' ').trim().split(/\s+/)[0]?.slice(0, 4) ?? '';
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
    /* 换句只做位移与轻微模糊，绝不动 opacity：文字不该在换句瞬间消失 */
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
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el || !open || !canAnimateDecor()) return;
    gsap.fromTo(
      el.querySelectorAll('[data-para]'),
      { y: 10, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, stagger: 0.07, ease: 'power2.out' },
    );
  }, [open]);

  return (
    <li className="border-b border-line-soft">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="group flex w-full items-center justify-between gap-4 py-4 text-left"
      >
        <span className="verse text-[1rem] transition-colors duration-200 group-hover:text-accent">
          {essay.title}
        </span>
        <span className="mono-label">{open ? '收起' : '展开'}</span>
      </button>
      {open ? (
        <div ref={bodyRef} className="measure pb-8">
          {essay.paras.map((p) => (
            <p key={p} data-para className="mb-4 text-[0.9rem] leading-[1.95] text-muted last:mb-0">
              {p}
            </p>
          ))}
          {essay.date ? <div className="mono-label mt-5">{essay.date}</div> : null}
        </div>
      ) : null}
    </li>
  );
}

/* ------------------------------------------------------------ 单首诗 */
function PoemItem({
  p,
  no,
  isOpen,
  showTrans,
  showNotes,
  onToggle,
  onTogglePanel,
}: {
  p: Poem;
  no: number;
  isOpen: boolean;
  showTrans: boolean;
  showNotes: boolean;
  onToggle: () => void;
  onTogglePanel: (kind: string) => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const hasTrans = Array.isArray(p.trans)
    ? p.trans.length > 0
    : typeof p.trans === 'string' && p.trans.length > 0;
  const transList = Array.isArray(p.trans) ? p.trans : p.trans ? [p.trans] : [];
  const sign = signOf(p);

  /* 展开：标题"涨大" + 正文逐行落字。
     标题的字号切换不能直接动画（font-size 不可动画，会逐帧重排），
     所以让标题直接渲染成大字尺寸（重排一次），再用 scale 0.66 → 1
     把它从"小字的大小"平滑涨上去——视觉上就是在变大。

     ⚠ 依赖里只能有 isOpen。以前把 showTrans / showNotes 也放进来了，
     结果每点一次"译文"就重播一遍整套入场动效（从无到有），
     看起来像是页面重新加载了一次。译文/注释的显隐另有下面那条轻动效。 */
  useEffect(() => {
    const el = bodyRef.current;
    const titleEl = titleRef.current;
    if (!isOpen) return;

    if (!canAnimateDecor() || !el) {
      if (titleEl) gsap.set(titleEl, { clearProps: 'transform,opacity' });
      return;
    }

    const tl = gsap.timeline();
    if (titleEl) {
      tl.fromTo(
        titleEl,
        { scale: 0.66, opacity: 0.35, y: 6 },
        { scale: 1, opacity: 1, y: 0, duration: 0.62, ease: 'power3.out' },
      );
    }
    tl.fromTo(
      el.querySelectorAll('[data-line]'),
      { y: 16, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, stagger: 0.05, ease: 'power2.out' },
      '-=0.34',
    ).fromTo(
      el.querySelectorAll('[data-tail]'),
      { x: -10, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.45, stagger: 0.08, ease: 'power2.out' },
      '-=0.2',
    );

    return () => {
      tl.kill();
    };
  }, [isOpen]);

  /* 译文 / 注释单独一条轻动效：只滑入自己那块，不碰整条诗。
     这样点开时是"这一段出现了"，而不是"整首诗重来一遍"。 */
  useEffect(() => {
    if (!canAnimateDecor()) return;
    const panes = bodyRef.current?.querySelectorAll('[data-pane]');
    if (!panes?.length) return;
    gsap.fromTo(
      panes,
      { y: 8, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out', overwrite: 'auto' },
    );
  }, [showTrans, showNotes]);

  return (
    <li
      data-poem={p.t}
      data-open={isOpen ? 'true' : 'false'}
      className={`poem-item scroll-mt-24 border-b ${
        isOpen ? 'border-accent-deep/35 bg-[#0b0b10]' : 'border-line-soft'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="poem-head group flex w-full items-start justify-between gap-5 py-4 text-left"
      >
        <span className="flex min-w-0 flex-1 items-start gap-4">
          <span className="poem-no pt-[0.45em]">{String(no).padStart(2, '0')}</span>
          <span ref={titleRef} className={`poem-title ${isOpen ? 'is-open' : ''}`}>
            {p.t}
          </span>
          {/* 展开时右侧出现竖排题款，像稿纸边上的小字 */}
          {isOpen ? (
            <span aria-hidden="true" className="poem-side ml-2 hidden self-stretch md:block">
              陆思鼎
            </span>
          ) : null}
        </span>

        <span className="flex shrink-0 items-center gap-2 pt-[0.55em]">
          {/* 折叠态不放"译文/注释"文字：25 首全挂一遍会变成噪音，
              这些内容展开后自然就在那里，用符号提示足够 */}
          {hasTrans || p.notes ? (
            <span
              className="hidden text-[0.6rem] tracking-[0.2em] text-line transition-colors duration-300 group-hover:text-faint sm:inline"
              aria-hidden="true"
            >
              {hasTrans ? '译' : ''}
              {hasTrans && p.notes ? '·' : ''}
              {p.notes ? '注' : ''}
            </span>
          ) : null}
          <CaretDown
            size={14}
            className={`text-faint transition-all duration-300 group-hover:text-accent ${
              isOpen ? 'rotate-180 text-accent' : ''
            }`}
          />
        </span>
      </button>

      {isOpen ? (
        <div ref={bodyRef} className="pb-9 pl-[2.6rem] pr-1">
          <div className="min-w-0">
            {p.note ? (
              <div data-tail className="mb-6 max-w-[34ch]">
                <span className="mono-label">题解</span>
                <p className="mt-2 text-[0.82rem] leading-[1.9] text-faint">{p.note}</p>
              </div>
            ) : null}

            <div className="verse measure text-[1.08rem] text-text/92">
              {p.body.map((line, i) => (
                <span key={`${line}-${i}`} data-line className="poem-line">
                  {line}
                </span>
              ))}
            </div>

            {/* 落款 + 印章 */}
            <div data-tail className="mt-6 flex items-center gap-3">
              <span className="poem-sign">{sign ? `末句 · ${sign}` : '陆思鼎'}</span>
              <span className="seal" aria-hidden="true">
                鼎
              </span>
            </div>

            {hasTrans || p.notes ? (
              <div data-tail className="mt-7 flex gap-2">
                {hasTrans ? (
                  <button
                    type="button"
                    onClick={() => onTogglePanel('trans')}
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
                    onClick={() => onTogglePanel('notes')}
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
              <div
                data-tail
                data-pane
                className="measure mt-5 border-l border-accent/40 pl-5"
              >
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
              <div
                data-tail
                data-pane
                className="measure mt-5 border-l border-accent/40 pl-5"
              >
                <p className="text-[0.86rem] leading-[1.95] text-muted">{p.notes}</p>
              </div>
            ) : null}
          </div>
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
  const pageRef = useRef<HTMLDivElement>(null);

  const b = BOOKS[book];
  const total = useMemo(
    () => BOOK_KEYS.reduce((sum, k) => sum + countPoems(BOOKS[k]), 0),
    [],
  );

  const openedCount = useMemo(
    () => b.groups.reduce((n, g) => n + g.poems.filter((p) => open[poemKey(book, p.t)]).length, 0),
    [b, book, open],
  );

  /* 换诗集时：目录整体重排，给一次轻微的落字感（不是逐条淡入那么碎） */
  useEffect(() => {
    const el = pageRef.current;
    if (!el || !canAnimateDecor()) return;
    gsap.fromTo(
      el.querySelectorAll('[data-volume]'),
      { y: 16, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.55, stagger: 0.07, ease: 'power2.out' },
    );
  }, [book]);

  /* ?poem=诗名 深链 */
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

  /* 卷次吸附：标出当前读到哪一年 */
  useEffect(() => {
    const root = listRef.current;
    if (!root) return;
    const marks = [...root.querySelectorAll('[data-year]')];
    if (!marks.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((e) => e.isIntersecting)
          .sort((x, y) => y.intersectionRatio - x.intersectionRatio)[0];
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
      {/* 纸张层：噪声颗粒 + 竖排界格。没有氛围光——
          实测那层径向光只是在暗部糊出不均匀色斑，不如干净的暗面。 */}
      <div className="paper ruled relative">

        <div ref={pageRef}>
          {/* ======================= 扉页 ======================= */}
          <section className="relative pt-14 md:pt-16">
            <div className="flex items-start justify-between gap-10">
              <div className="min-w-0">
                <div className="mono-label">诗集</div>

                {/* 大字拉引：把集名当作一句"话"来排，而不是当作小标题 */}
                <h2 className="display-serif-cn mt-5 text-[clamp(2.1rem,5.6vw,3.6rem)] leading-[1.1]">
                  《{b.name}》
                </h2>

                <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
                  <span className="verse text-[1.05rem] text-muted">陆思鼎</span>
                  <span className="seal" aria-hidden="true">
                    鼎
                  </span>
                  {years.length ? (
                    <span className="display-latin text-[1.15rem] text-accent-deep">
                      {years[0]}–{years[years.length - 1]}
                    </span>
                  ) : null}
                  <span className="mono-label">{countPoems(b)} 首</span>
                </div>

                {b.intro ? (
                  <ul className="mt-10 max-w-[34rem] border-t border-line pt-1">
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

              {/* 竖排发光书名：全站唯一使用竖排的地方，只放 2–5 字 */}
              <div
                aria-hidden="true"
                className="vertical-cn vertical-glow hidden shrink-0 select-none text-[clamp(1.7rem,3.6vw,2.6rem)] leading-none text-accent/80 md:block"
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

              {/* 连续编号 + 年份跨距：左侧一列贯穿的序号与年份，
                  每首诗一行刻度。它不是装饰——44 首的位置感靠它度量。 */}
              <div className="index-rail mt-10">
                <div className="index-rail-line" aria-hidden="true" />

                <div className="min-w-0 flex-1">
                  {b.groups.map((g) => {
                    let running = 0;
                    for (const gg of b.groups) {
                      if (gg === g) break;
                      running += gg.poems.length;
                    }

                    return (
                      <div key={g.year ?? 'ungrouped'} data-volume className="mb-11 last:mb-0">
                        {g.year ? (
                          <div
                            data-year={g.year}
                            className="volume-head scroll-mt-24 mb-2 flex items-center gap-4"
                          >
                            <span className="volume-year">{g.year}</span>
                            <span className="volume-count">{g.poems.length} 首</span>
                          </div>
                        ) : null}

                        <ul>
                          {g.poems.map((p, i) => (
                            <li key={p.t} className="flex gap-3">
                              {/* 刻度列：整十首的刻度更长，像目录的节标。
                                  这条列只放刻度，序号在诗条内部隔开一段距离，
                                  否则序号会贴在展开后的强调竖线上。 */}
                              <span
                                aria-hidden="true"
                                className="flex w-4 shrink-0 justify-end pt-[1.15rem]"
                              >
                                <span
                                  className={`index-tick ${
                                    (running + i + 1) % 10 === 0 ? 'is-decade' : 'is-plain'
                                  }`}
                                />
                              </span>
                              <div className="min-w-0 flex-1 pl-3">
                                <PoemItem
                                  p={p}
                                  no={running + i + 1}
                                  isOpen={!!open[poemKey(book, p.t)]}
                                  showTrans={!!panels[panelKey(book, p.t, 'trans')]}
                                  showNotes={!!panels[panelKey(book, p.t, 'notes')]}
                                  onToggle={() => togglePoem(p.t)}
                                  onTogglePanel={(kind) => togglePanel(p.t, kind)}
                                />
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}

                  {b.outro ? (
                    <ul className="mt-14 border-t border-line pt-2">
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
            </div>
          </div>
        </div>
      </div>
    </DetailShell>
  );
}
