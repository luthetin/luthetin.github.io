import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from '@phosphor-icons/react';
import SiteFooter from './SiteFooter';

/* ----------------------------------------------------------------------------
   内容页统一外壳
   从"返回链接 + 标题 + 一行副标题"升级成真正的页头：
   - 大标题（字号差距拉开，靠尺寸差而不是加粗来建立层级）
   - 导语（统一栏宽 .measure-wide）
   - 动作区（打开在线应用 / GitHub 之类，同一意图只有一处措辞）
   - 图版位（右侧或全宽放这一页的"视觉主角"）
   - 底部内容由各页自己排（版式族见 styles.css）
   -------------------------------------------------------------------------- */

export default function DetailShell({
  backTo = '/',
  backLabel = '返回首页',
  eyebrow,
  title,
  meta,
  lead,
  actions,
  visual,
  children,
}: {
  backTo?: string;
  backLabel?: string;
  eyebrow?: string;
  title: string;
  meta?: string;
  lead?: string;
  actions?: { label: string; href: string; external?: boolean }[];
  /** 页头的视觉主角（程序页的地层线框等），传了就右侧分栏，并带框角 */
  visual?: ReactNode;
  children: ReactNode;
}) {
  const hasVisual = !!visual;

  return (
    <>
      <main className="pt-24 pb-24 md:pt-28">
        <div className="shell">
          <Link
            to={backTo}
            className="mono-label link-underline transition-colors duration-200 hover:text-accent"
          >
            {backLabel}
          </Link>

          {/* 页头要紧凑：内容页的主角是内容本身与图版，
              标题区把用户挡在屏外太久就本末倒置了 */}
          <div
            className={
              hasVisual
                ? 'mt-7 grid gap-8 lg:grid-cols-12 lg:items-end lg:gap-12'
                : 'mt-7'
            }
          >
            <div className={hasVisual ? 'lg:col-span-6' : 'max-w-[46rem]'}>
              {eyebrow ? <span className="mono-label block">{eyebrow}</span> : null}
              <h1 className="display-serif-cn mt-2.5 text-[clamp(2.25rem,6vw,4.25rem)] leading-[1.06]">
                {title}
              </h1>
              {meta ? <p className="num mt-4 text-[0.82rem] text-muted">{meta}</p> : null}
              {lead ? (
                <p className="measure-wide mt-5 text-[0.95rem] leading-[1.9] text-[#c9c9d0]">
                  {lead}
                </p>
              ) : null}
              {actions?.length ? (
                <div className="mt-6 flex flex-wrap gap-3">
                  {actions.map((a) => (
                    <a
                      key={a.href}
                      href={a.href}
                      {...(a.external
                        ? { target: '_blank', rel: 'noopener noreferrer' }
                        : {})}
                      className="btn btn-ghost"
                    >
                      {a.label}
                      <ArrowUpRight size={14} />
                    </a>
                  ))}
                </div>
              ) : null}
            </div>

            {hasVisual ? (
              <div className="lg:col-span-6">
                <div className="plate">{visual}</div>
              </div>
            ) : null}
          </div>

          <div className="mt-16 md:mt-20">{children}</div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
