/* ============================================================================
   动效层：GSAP 插件在此统一注册，业务组件只 import 这里
   规则
   - 全站只用 GSAP（不混 Motion / Three，避免抢帧）
   - 连续值（鼠标位置、滚动进度）一律走 ref 直改样式，不进 React state
   - 所有入场动效都尊重 prefers-reduced-motion
   - 装饰性动效（极光 / 扫光 / 呼吸光晕 / 描边点亮）额外受 still 与 fps 降级控制
   ========================================================================= */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);

gsap.defaults({ ease: 'power3.out', duration: 0.8 });

/** 是否应当降级为静态（系统开启"减弱动效"） */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** ?still=1 → 一键关掉装饰性动效，只留基础淡入（方便对比"太闹"和"刚好"） */
const STILL = (() => {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('still') === '1';
  } catch {
    return false;
  }
})();

/** 是否以 file:// 直接打开（单文件离线预览件就是这种情况） */
export const IS_FILE =
  typeof window !== 'undefined' && window.location.protocol === 'file:';

/** 站点动效总开关：在 App 挂载时读一次 */
export const MOTION = {
  /** 系统级减弱动效 */
  reduced: prefersReducedMotion(),
  /** 用户手动关掉装饰动效 */
  still: STILL,
  /** 首帧掉帧检测结果（低端设备自动降级装饰动效） */
  slow: false,
};

/** 基础入场动效是否可用（内容必须能看到，所以只受 reduced 控制） */
export const canAnimateBase = () => !MOTION.reduced;

/** 装饰性动效是否可用（极光 / 扫光 / 呼吸光晕 / 描边点亮） */
export const canAnimateDecor = () => !MOTION.reduced && !MOTION.still && !MOTION.slow;

/* ----------------------------------------------------------------------------
   性能降级探测：装饰动效是锦上添花，低端设备上宁可不播。

   两个关键取舍：
   1) 必须等"预热"结束再测。页面刚加载的前几十帧受解析、解码、字体加载影响，
      一定偏慢；在那里采样会把本来没问题的机器误判成慢设备。
   2) 用平均帧间隔而不是"最慢的一帧"：偶发一次掉帧不代表设备不行。
   -------------------------------------------------------------------------- */
const WARMUP_MS = 2600;
const SAMPLE_FRAMES = 45;
const SLOW_FPS = 34;

export function startPerfProbe(onSlow?: () => void) {
  if (typeof window === 'undefined' || MOTION.slow) return;
  if (!canAnimateDecor()) return;

  /* ?noperf=1：跳过探测，用于截图与自动化测试里观察完整动效 */
  try {
    if (new URLSearchParams(window.location.search).get('noperf') === '1') return;
  } catch {
    /* 忽略 */
  }

  let frames = 0;
  let start = 0;
  let warmed = false;
  let warmStart = 0;

  const tick = (now: number) => {
    if (!warmed) {
      if (!warmStart) warmStart = now;
      if (now - warmStart < WARMUP_MS) {
        requestAnimationFrame(tick);
        return;
      }
      warmed = true;
      start = now;
      requestAnimationFrame(tick);
      return;
    }

    frames++;
    if (frames >= SAMPLE_FRAMES) {
      const fps = (frames * 1000) / (now - start);
      if (fps < SLOW_FPS) {
        MOTION.slow = true;
        document.documentElement.classList.add('is-slow-device');
        onSlow?.();
      }
      return;
    }
    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

export { gsap, ScrollTrigger, SplitText, useGSAP };
