import { useEffect } from 'react';
import {
  BrowserRouter,
  HashRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import Nav from './components/Nav';
import { LEGACY_REDIRECTS } from './data/site';
import { MOTION, startPerfProbe } from './lib/motion';
import Home from './pages/Home';
import Knowledge from './pages/Knowledge';
import NotFound from './pages/NotFound';
import Poetry from './pages/Poetry';
import WorkCode from './pages/WorkCode';
import WorkMedia from './pages/WorkMedia';

/* ----------------------------------------------------------------------------
   路由：首页 + 三个方向详情页 + 旧地址重定向 + 404
   用 BrowserRouter（锚点语义正确）；用 file:// 直接打开构建产物做快速核对时，
   自动切到 HashRouter，否则没有服务端回退会一律落到 404。
   上线到 GitHub Pages 时需要有 404.html 作为 SPA 回退，或改挂自定义域名。
   -------------------------------------------------------------------------- */

const Router =
  typeof window !== 'undefined' && window.location.protocol === 'file:' ? HashRouter : BrowserRouter;

function ScrollManager() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    /* 只把「真正的页内锚点」交给 querySelector。
       hash 也可能是 "#/work/poetry" 这种路由形式（旧地址跳转页会用到），
       直接丢给 querySelector 会抛 SyntaxError。 */
    const anchor = /^#[A-Za-z][\w-]*$/.test(hash) ? hash : '';
    if (anchor) {
      const el = document.getElementById(anchor.slice(1));
      if (!el) return;
      const id = window.setTimeout(
        () => el.scrollIntoView({ behavior: 'smooth', block: 'start' }),
        80,
      );
      return () => window.clearTimeout(id);
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname, hash]);

  return null;
}

/* ----------------------------------------------------------------------------
   深链回退：把 ?p= 还原成真实地址
   GitHub Pages 是静态托管，直接访问 /work/xxx 会落到 404.html；
   那段脚本把原始地址塞进 ?p= 并改成 /?p=...。
   这里必须"同步、在 Router 挂载之前"还原：
   BrowserRouter 初始化时读的是 location.pathname，晚一步就来不及，
   路由会先按 "/" 命中首页 —— 那样带 ? 参数的深链会被静默吞掉。
   用 replaceState 而不是 pushState：不额外多一条历史记录。
   -------------------------------------------------------------------------- */
const RESTORED = (() => {
  if (typeof window === 'undefined') return null;
  const { pathname, search, hash } = window.location;
  if (pathname !== '/') return null;
  const p = new URLSearchParams(search).get('p');
  if (!p || !p.startsWith('/')) return null;
  try {
    window.history.replaceState(null, '', p);
    return p;
  } catch {
    return null;
  }
})();

/* 在模块级还原了地址后，Router 若仍停在旧位置就再同步一次（兜底，不产生历史记录） */
function RestorePath() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!RESTORED) return;
    if (pathname === '/') window.history.replaceState(null, '', RESTORED);
  }, [pathname]);
  return null;
}

export default function App() {
  /* 装饰性动效的总开关：
     - js-anim 表示"JS 已经接管"——只有它存在时待入场元素才隐藏，
       否则呈现的是静态可见版本（内容永不消失）
     - still-mode 跟随当前地址实时同步：?still=1 打开、离开该地址就移除。
       只挂不加会把用户永久锁在静态模式里（客户端跳转不会重载页面）。
     - 首帧掉帧（低端设备）时 startPerfProbe 会自动补上 is-slow-device */
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('js-anim');

    const sync = () => {
      const still =
        MOTION.reduced ||
        new URLSearchParams(window.location.search).get('still') === '1';
      root.classList.toggle('still-mode', still);
    };

    sync();
    startPerfProbe();

    /* 站内是 SPA，地址变了要重新判定一次 */
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  /* 路由切换后也重新同步一次（?still=1 ↔ / 之间的客户端跳转不会触发 popstate） */
  function StillSync() {
    const { search } = useLocation();
    useEffect(() => {
      const root = document.documentElement;
      const still =
        MOTION.reduced || new URLSearchParams(search).get('still') === '1';
      root.classList.toggle('still-mode', still);
    }, [search]);
    return null;
  }

  return (
    <Router>
      <RestorePath />
      <StillSync />
      <ScrollManager />

      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:border focus:border-accent focus:bg-void focus:px-4 focus:py-2 focus:text-sm focus:text-accent"
      >
        跳到正文
      </a>

      <Nav />

      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/work" element={<Navigate to="/#work" replace />} />
          <Route path="/work/code" element={<WorkCode />} />
          <Route path="/work/media" element={<WorkMedia />} />
          <Route path="/work/poetry" element={<Poetry />} />
          <Route path="/work/knowledge" element={<Knowledge />} />
          {Object.entries(LEGACY_REDIRECTS).map(([from, to]) => (
            <Route key={from} path={from} element={<Navigate to={to} replace />} />
          ))}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </Router>
  );
}
