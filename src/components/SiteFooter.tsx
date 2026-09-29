import { SITE } from '../data/site';

/* 详情页的紧凑页脚（首页的收尾整屏已包含完整联系信息） */
export default function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line py-10">
      <div className="shell flex flex-col gap-4 text-[0.78rem] text-faint sm:flex-row sm:items-center sm:justify-between">
        <span>
          {SITE.name} · 笔名 {SITE.penName} · 最后更新于 {SITE.updated}
        </span>
        <span className="flex flex-wrap gap-x-6 gap-y-2">
          <a className="link-underline hover:text-text" href={`mailto:${SITE.email}`}>
            {SITE.email}
          </a>
          <a
            className="link-underline hover:text-text"
            href={SITE.github}
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          <a
            className="link-underline hover:text-text"
            href={SITE.bilibili}
            target="_blank"
            rel="noopener noreferrer"
          >
            哔哩哔哩
          </a>
        </span>
      </div>
    </footer>
  );
}
