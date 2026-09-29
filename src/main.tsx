import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

/* 字体自托管（不用 <link> 引 Google Fonts）：
   Geist Variable 负责拉丁与数字，JetBrains Mono 负责等宽标签与数据 */
import '@fontsource-variable/geist';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';

import './styles.css';
import App from './App';

/* ----------------------------------------------------------------------------
   GitHub Pages 深链还原
   Pages 是纯静态托管：直接访问 /work/poetry 会命中 404.html（状态码 404）。
   404.html 里的兜底脚本把原始地址暂存到 ?p=，这里在 React 挂载前把它还原回去，
   于是地址栏保持干净的 /work/poetry，前端路由也能正确匹配。

   安全：只接受站内相对路径（必须以 / 开头、不能是 //，且不含协议），
   避免被构造成跳转到外部域名的开放重定向。
   -------------------------------------------------------------------------- */
function restoreDeepLink() {
  const sp = new URLSearchParams(window.location.search);
  const raw = sp.get('p');
  if (!raw) return;

  const decoded = raw;
  const isInternal = /^\/[A-Za-z0-9\-._~/]*$/.test(decoded) && !decoded.startsWith('//');
  if (isInternal) {
    window.history.replaceState(null, '', decoded);
  } else {
    sp.delete('p');
    const qs = sp.toString();
    window.history.replaceState(null, '', '/' + (qs ? '?' + qs : ''));
  }
}

restoreDeepLink();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
