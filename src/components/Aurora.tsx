import { MOTION } from '../lib/motion';

/* ----------------------------------------------------------------------------
   极光底层：几团极慢漂移的软光（玫瑰 / 鸢尾 / 琥珀），给首屏制造"照片在发光"。

   实现取舍（这里踩过坑）：
   - 不用 canvas 逐帧重绘：全屏 canvas + 屏幕混合，在软件渲染（无头 / 低端设备）
     下会让合成器永远拿不到稳定帧，截图与滚动都被拖垮。
   - 不用大尺寸 filter: blur(90px)：模糊半径和元素面积都超大，是帧率杀手。
   - 只用「径向渐变 + transform 漂移」：软边完全由渐变自己给，动画只动 transform，
     全程 GPU 合成，不触发重绘。
   - 减弱动效 / ?still=1 / 慢设备：动画暂停，静态渐变仍在，画面不会变空。
   -------------------------------------------------------------------------- */

type Blob = {
  key: string;
  cls: string;
  style: React.CSSProperties;
  dur: string;
  delay: string;
};

/* 光团要「大而暗」：小而亮会出现一个能被眼睛定位的色斑，
   而环境光应该是"整个画面有一点色温"，找不到具体来源才对。 */
const BLOBS: Blob[] = [
  {
    key: 'rose',
    cls: 'aurora-rose',
    style: { left: '-42%', bottom: '-52%', width: '112vmax', height: '112vmax' },
    dur: '30s',
    delay: '0s',
  },
  {
    key: 'iris',
    cls: 'aurora-iris',
    style: { right: '-46%', top: '-48%', width: '104vmax', height: '104vmax' },
    dur: '38s',
    delay: '-9s',
  },
  {
    key: 'amber',
    cls: 'aurora-amber',
    style: { left: '22%', top: '18%', width: '72vmax', height: '72vmax' },
    dur: '46s',
    delay: '-18s',
  },
];

export default function Aurora({ className = '' }: { className?: string }) {
  /* 静态模式：不挂动画、不加 will-change，只留渐变 */
  const staticMode = MOTION.reduced || MOTION.still;

  /* 调试开关：?noaurora=1 直接关掉整层，用来判断画面上的色偏到底来自极光还是来自照片本身 */
  const disabled =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('noaurora') === '1';
  if (disabled) return null;

  return (
    <div
      aria-hidden="true"
      className={`aurora ${staticMode ? 'aurora-static' : ''} ${className}`}
    >
      {BLOBS.map((b) => (
        <i
          key={b.key}
          className={b.cls}
          style={{ ...b.style, animationDuration: b.dur, animationDelay: b.delay }}
        />
      ))}
    </div>
  );
}
