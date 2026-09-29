import { Component, type ReactNode } from 'react';

/* ----------------------------------------------------------------------------
   WebGL 视觉层兜底
   无头浏览器、老设备或禁用显卡加速时，ogl 创建上下文会抛错；
   没有错误边界的话会把整棵 React 树带崩，这里降级成一层静态渐变。
   -------------------------------------------------------------------------- */

type Props = { children: ReactNode; fallbackClassName?: string };
type State = { failed: boolean };

export default class SafeVisual extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch() {
    // 静默降级：视觉层失败不影响页面其余部分
  }

  render() {
    if (this.state.failed) {
      return (
        <div
          aria-hidden="true"
          className={this.props.fallbackClassName ?? 'h-full w-full'}
          style={{
            background:
              'radial-gradient(120% 80% at 70% 20%, rgba(224,112,143,.20), transparent 60%), linear-gradient(160deg, #16121a, #08080a 70%)',
          }}
        />
      );
    }
    return this.props.children;
  }
}
