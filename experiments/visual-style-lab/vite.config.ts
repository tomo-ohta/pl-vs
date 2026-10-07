import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// 参考画像の見た目を再現するテストステージの開発サーバー。
// - v1 / v2 / shared のファイルは使わない（three だけリポジトリ直下の node_modules の物を使う）
// - ポートは v2（5174）・v2-splat-props（5175）と別の 5176
const here = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: here('.'),
  publicDir: here('./public/'),
  resolve: { dedupe: ['three'] },
  server: {
    port: 5176,
    strictPort: true,
    fs: { allow: [here('../..')] },
  },
  build: {
    target: 'es2022',
    // 元の版（index.html）と建築版（arch.html）の 2 ページ
    rollupOptions: { input: { main: here('./index.html'), arch: here('./arch.html') } },
  },
});
