/* 纯 ESM 配置，不 import 任何带原生模块的包：
   Vite 8 用 rolldown 打包 TS 配置文件，会把 Tailwind 的 .node 原生绑定当文本读而报错，
   所以这里用 .mjs 且零 import，Tailwind 交给 postcss.config.mjs 处理。 */
export default {
  /* '/' 而不是 './'：BrowserRouter 下详情页地址是 /work/code，
     相对路径会被解析成 /work/assets/... 从而 404 白屏。
     图片仍用 './hero.jpg' 这类写死的相对路径，file:// 直接打开也能取到。 */
  base: '/',
  server: { port: 5273, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: { outDir: 'dist', assetsInlineLimit: 0 },
  // 不装 @vitejs/plugin-react，JSX 交给 esbuild 的自动运行时（生产构建与预览足够）
  esbuild: { jsx: 'automatic', jsxImportSource: 'react' },
};
