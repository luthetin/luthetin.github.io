import { Reveal, SectionHeading } from '../components/ui';
import { ADVANTAGES } from '../data/site';

/* ----------------------------------------------------------------------------
   个人优势：5 行规格式排版（与卡片区形成不同的版式族）
   每行 hover 时顶部划出一根强调色细线
   -------------------------------------------------------------------------- */

export default function Advantages() {
  return (
    <section id="advantages" className="border-t border-line py-24 md:py-32">
      <div className="shell">
        <Reveal>
          <SectionHeading
            eyebrow="能力"
            title="个人优势"
            lead="这几条不是形容词，是我在做的东西里能对得上的事实。"
          />
        </Reveal>

        <ul className="mt-14 border-t border-line">
          {ADVANTAGES.map((a, i) => (
            <Reveal as="li" key={a.index} delay={0.04 * i}>
              <div className="adv-row group grid gap-3 border-b border-line py-8 md:grid-cols-12 md:items-baseline md:gap-8 md:py-10">
                <span className="mono-label md:col-span-1">{a.index}</span>
                <h3 className="text-xl font-semibold transition-colors duration-300 group-hover:text-accent md:col-span-4 md:text-2xl">
                  {a.title}
                </h3>
                <p className="text-[0.9rem] leading-relaxed text-muted md:col-span-5">{a.desc}</p>
                <span className="mono-label md:col-span-2 md:text-right">{a.proof}</span>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
