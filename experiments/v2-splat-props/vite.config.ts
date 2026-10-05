import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// v2 のソースを「読むだけ」で使う検証用の開発サーバー。
// - v2 の index.html / vite.config.ts は使わない（ここが root。v2 のファイルは一切書き換えない）
// - 素材は v2 と同じ shared/public を publicDir にする（素材の場所・中身は v2 と同じ）
// - three は v2 と同じもの（リポジトリ直下の node_modules）を 1 つだけ使う（Spark も同じ three を使うように dedupe）
// - ポートは v2（5174）と別の 5175。公開元が違うので、ブラウザの保存領域（liminal2.*）も v2 と混ざらない
const here = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: here('.'),
  publicDir: here('../../shared/public/'),
  resolve: { dedupe: ['three'] },
  server: {
    port: 5175,
    strictPort: true,
    // v2 / shared のファイルを /@fs/ で配る（リポジトリ直下まで許可）
    fs: { allow: [here('../..')] },
  },
  build: { target: 'es2022' },
});
