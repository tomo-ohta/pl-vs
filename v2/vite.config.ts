import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// GitHub Pages などサブパス配信時は BASE_PATH=/pl-vs/v2/ を渡す（既定 '/'）
const base = process.env.BASE_PATH ?? '/';
const sharedPublic = fileURLToPath(new URL('../shared/public/', import.meta.url));

export default defineConfig(({ command }) => ({
  base,
  // 素材は v1 / v2 共通の shared/public。本番で VITE_ASSET_BASE（例: /pl-vs/）を指定したときは素材を複写せず、そこから読む
  publicDir: command === 'serve' || !process.env.VITE_ASSET_BASE ? sharedPublic : false,
  server: { port: 5174, strictPort: false },
  build: { target: 'es2022', sourcemap: false },
}));
