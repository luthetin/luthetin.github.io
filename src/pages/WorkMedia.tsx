import { ArrowUpRight, Play } from '@phosphor-icons/react';
import DetailShell from '../components/DetailShell';
import RichText from '../components/RichText';
import Waveform from '../components/Waveform';
import { Reveal } from '../components/ui';
import details from '../data/details.json';

/* ----------------------------------------------------------------------------
   自媒体方向详情：频道主页

   这一页之前最薄（1385px、只有一段话加一张声波占位图），核心问题是
   「读者看不到任何内容」。改造思路：
   - 16:9 主推框：不放假截图（假截图是明确禁止的偷懒做法），
     而是用「词牌大字排版」做成一个真实的"封面位"——它本身就是内容
   - 原始 quote 提升为大字拉引（原来只是普通段落，浪费了一句好文案）
   - 三个栏目做成有编号的条目，而不是三张一样的卡
   - 声波从"占 224px 的 hero 装饰"降级为"音频身份条"，挪到栏目区旁边做点缀
   - 一个明确的动作：去频道
   -------------------------------------------------------------------------- */

const media = (
  details as {
    media: {
      heading: string;
      quote: string;
      points: string[];
      links: { label: string; href: string }[];
    };
  }
).media;

const channel = media.links[0];

/* 栏目：来自真实的"在做的方向"，不是编的 */
const COLUMNS = [
  {
    index: '01',
    key: '词牌介绍',
    d: '一支词牌一支词牌地讲：来历、句式、平仄与代表作品。',
    tags: ['来历', '句式', '平仄', '代表作'],
  },
  {
    index: '02',
    key: '新手向创作教程',
    d: '从零写第一首：怎么定调、怎么落韵、怎么改到通顺。',
    tags: ['定调', '落韵', '修改'],
  },
  {
    index: '03',
    key: '诗集精校记录',
    d: '把《春潋集》《行吟集》的注释与译文过程讲成可复用的方法。',
    tags: ['注释', '译文', '方法'],
  },
];

/* 主推框上轮播的词牌名（真实词牌，取自诗集中的作品） */
const TUNE_TITLES = ['念奴娇', '鹊桥仙', '青玉案', '临江仙', '八声甘州', '沁园春'];

export default function WorkMedia() {
  return (
    <DetailShell
      backTo="/#work"
      backLabel="返回作品"
      eyebrow="方向 02"
      title={media.heading}
      meta="B 站 · 词牌科普与创作入门"
      lead="在 B 站做视频，介绍词牌名。一支词牌一支词牌地讲清楚它的来历、句式与平仄，也讲怎么从零写出一首能读的词。"
      actions={channel ? [{ label: channel.label, href: channel.href, external: true }] : undefined}
    >
      {/* ---------------- 主推视频位（16:9） ---------------- */}
      <Reveal>
        <a
          href={channel?.href}
          target="_blank"
          rel="noopener noreferrer"
          className="plate group block overflow-hidden"
        >
          <div
            className="relative aspect-video w-full overflow-hidden"
            style={{
              background:
                'radial-gradient(120% 100% at 18% 12%, rgba(224,112,143,.20), transparent 58%),' +
                'radial-gradient(110% 95% at 88% 88%, rgba(154,131,216,.16), transparent 60%)',
            }}
          >
            {/* 背景：词牌名竖排铺满，做成"封面"而不是"假截图"。
                只在中屏以上出现（窄屏 16:9 太矮，竖排字会被压得过小）；
                字号按容器高度封顶，避免字被裁掉。 */}
            <div
              aria-hidden="true"
              className="absolute inset-0 hidden grid-cols-6 items-center gap-x-10 px-14 md:grid"
            >
              {TUNE_TITLES.map((t) => (
                <span
                  key={t}
                  className="vertical-cn justify-self-center text-[clamp(1.1rem,2.3vw,2rem)] text-text/25 transition-colors duration-500 group-hover:text-accent/45"
                >
                  {t}
                </span>
              ))}
            </div>

            {/* 中央：播放按钮 + 一句"去看"的说明（不假装这里能播） */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
              <span className="flex h-16 w-16 items-center justify-center rounded-full border border-accent/50 bg-void/60 text-accent backdrop-blur-sm transition-transform duration-300 group-hover:scale-105 group-hover:border-accent md:h-20 md:w-20">
                <Play size={22} weight="fill" />
              </span>
              <span className="mono-label text-muted transition-colors duration-300 group-hover:text-accent">
                在哔哩哔哩观看
              </span>
            </div>

            <span className="plate-caption absolute bottom-4 left-4">BILIBILI · 词牌科普</span>
          </div>
        </a>
      </Reveal>

      {/* ---------------- 大字拉引：原 quote ---------------- */}
      <Reveal delay={0.06}>
        <p className="pull-quote measure mt-16 text-[clamp(1.5rem,4vw,2.6rem)] text-text md:mt-20">
          {media.quote}
        </p>
      </Reveal>

      {media.points.length ? (
        <Reveal delay={0.08}>
          <p className="measure mt-7 text-[0.92rem] leading-[1.95] text-muted">
            <RichText text={media.points[0]} />
          </p>
        </Reveal>
      ) : null}

      {/* ---------------- 栏目 ---------------- */}
      <div className="mt-24">
        <div className="mono-label text-accent">在做的事</div>

        <ul className="mt-8 flex flex-col">
          {COLUMNS.map((c, i) => (
            <Reveal as="li" key={c.key} delay={0.05 * i}>
              <div className="group grid gap-4 border-t border-line py-8 md:grid-cols-12 md:items-start md:gap-8">
                <span className="display-latin text-[1.6rem] leading-none text-accent-deep md:col-span-1">
                  {c.index}
                </span>
                <h2 className="text-xl font-semibold transition-colors duration-300 group-hover:text-accent md:col-span-4 md:text-2xl">
                  {c.key}
                </h2>
                <p className="text-[0.9rem] leading-[1.9] text-muted md:col-span-5">{c.d}</p>
                <ul className="flex flex-wrap gap-1.5 md:col-span-2 md:justify-end">
                  {c.tags.map((t) => (
                    <li
                      key={t}
                      className="rounded-[var(--radius-tile)] border border-line px-2 py-0.5 text-[0.68rem] text-faint"
                    >
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>

      {/* ---------------- 音频身份条 + 动作 ---------------- */}
      <Reveal>
        <div className="mt-16 grid gap-8 border-t border-line pt-8 md:grid-cols-12 md:items-center">
          <div className="md:col-span-5">
            <div className="h-14 overflow-hidden opacity-70">
              <Waveform className="h-full w-full" overlay={false} />
            </div>
            <p className="plate-caption mt-3">每期片头的声波气质</p>
          </div>

          <div className="flex flex-wrap items-center gap-4 md:col-span-7 md:justify-end">
            <span className="mono-label inline-flex items-center gap-2">
              <span className="dot-live" aria-hidden="true" />
              2026 年持续更新
            </span>
            {channel ? (
              <a
                href={channel.href}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                {channel.label}
                <ArrowUpRight size={14} />
              </a>
            ) : null}
          </div>
        </div>
      </Reveal>
    </DetailShell>
  );
}
