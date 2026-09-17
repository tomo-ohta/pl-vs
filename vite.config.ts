import { defineConfig } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// GitHub Pages などサブパス配信時は BASE_PATH=/repo-name/ を渡す（既定 '/'）
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [{
    name: 'local-visual-baselines',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__visual-baseline', async (req, res) => {
        // Local development UI only. No arbitrary path or overwrite is accepted.
        if (req.method !== 'POST' || !req.headers.origin || new URL(req.headers.origin).host !== req.headers.host) {
          res.statusCode = 403; res.end(); return;
        }
        try {
          let body = '';
          for await (const chunk of req) { body += chunk; if (body.length > 8_000_000) throw new Error('Payload too large'); }
          const { image, metadata, stage } = JSON.parse(body);
          if (!['before', 'after'].includes(stage) || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(image)) throw new Error('Invalid baseline');
          const dir = fileURLToPath(new URL('./docs/visual-baselines/', import.meta.url));
          await mkdir(dir, { recursive: true });
          const name = `${stage}-${Date.now()}`;
          await writeFile(`${dir}${name}.png`, Buffer.from(image.split(',')[1], 'base64'), { flag: 'wx' });
          await writeFile(`${dir}${name}.json`, JSON.stringify(metadata, null, 2), { flag: 'wx' });
          res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ path: `docs/visual-baselines/${name}` }));
        } catch (e) { res.statusCode = 400; res.end(String(e)); }
      });
    },
  }],
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    target: 'es2022',
    // 公開ビルドにソースマップを含めない（開発は vite dev の inline map で足りる）
    sourcemap: false,
  },
});
