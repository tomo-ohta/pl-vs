import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// 謎とヒントの検証デモの開発サーバー。
// - v1 / v2 / shared のファイルは使わない（three だけリポジトリ直下の node_modules の物を使う）
// - ポートはほかの検証（5173〜5180）と別の 5181
const here = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: here('.'),
  resolve: { dedupe: ['three'] },
  server: {
    port: 5181,
    strictPort: true,
    fs: { allow: [here('../..')] },
  },
  build: { target: 'es2022' },
});
