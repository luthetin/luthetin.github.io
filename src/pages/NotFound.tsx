import { Link } from 'react-router-dom';
import SiteFooter from '../components/SiteFooter';

export default function NotFound() {
  return (
    <>
      <main className="flex min-h-screen-safe items-center pt-24">
        <div className="shell">
          <span className="mono-label">404</span>
          <h1 className="display mt-6 max-w-[22rem] text-[clamp(1.75rem,5vw,3rem)]">
            这页没找到
          </h1>
          <p className="mt-5 max-w-[32rem] text-[0.92rem] leading-relaxed text-muted">
            地址可能写错了，或者这个页面已经换了位置。下面几个入口都还在。
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link to="/" className="btn btn-primary">
              回首页
            </Link>
            <Link to="/work/poetry" className="btn btn-ghost">
              看诗集
            </Link>
            <Link to="/work/code" className="btn btn-ghost">
              看项目
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
