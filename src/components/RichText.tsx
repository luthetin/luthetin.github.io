import type { ReactNode } from 'react';

/* ----------------------------------------------------------------------------
   极简内联富文本：只处理旧站里用到的两种标记
   **加粗**  → <strong>
   `代码`    → <code>
   其余一律按纯文本渲染（内容逐字来自旧站，不做任何改写）
   -------------------------------------------------------------------------- */

export default function RichText({ text, className }: { text: string; className?: string }) {
  const nodes: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith('**')) {
      nodes.push(
        <strong key={key++} className="font-semibold text-text">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      nodes.push(
        <code
          key={key++}
          className="num rounded-[var(--radius-tile)] border border-line bg-ink px-1.5 py-0.5 text-[0.86em] text-accent"
        >
          {token.slice(1, -1)}
        </code>,
      );
    }
    last = m.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));

  return <span className={className}>{nodes}</span>;
}
