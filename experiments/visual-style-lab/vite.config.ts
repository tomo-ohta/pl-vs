import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';

// 参考画像の見た目を再現するテストステージの開発サーバー。
// - v1 / v2 / shared のファイルは変えない。v2 のカメラ効果（VHS）とタブレットは複製せずに読み込む（three はリポジトリ直下の node_modules の物）
// - ポートは v2（5174）・v2-splat-props（5175）と別の 5176
const here = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

/**
 * v2 のファイルが読む client/env.ts を、このステージの物（src/tablet/env.ts）に差し替える。
 * 保存先の名前（STORAGE_PREFIX）だけ違い、タブレットの写真・SNS をゲームと分ける（同じ公開元の GitHub Pages で混ざらない）
 */
function labEnv(): Plugin {
  const v2Env = here('../../v2/client/env.ts');
  const labEnvFile = here('./src/tablet/env.ts');
  return {
    name: 'lab-env',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!source.endsWith('env.ts') || !importer) return null;
      const r = await this.resolve(source, importer, { ...options, skipSelf: true });
      return r && r.id.split('?')[0] === v2Env ? labEnvFile : null;
    },
  };
}

export default defineConfig({
  plugins: [labEnv()],
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
    // 元の版（index.html）・建築版（arch.html）・小物の見本帳（props.html）の 3 ページ
    rollupOptions: { input: { main: here('./index.html'), arch: here('./arch.html'), props: here('./props.html') } },
  },
});
