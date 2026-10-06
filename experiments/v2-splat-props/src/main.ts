/**
 * 検証の入口: v2 の小物（家具・設備）だけをスプラットにして、v2 をそのまま起動する。
 *
 * - v2 のファイルは変えない。v2 の FloorBuilder をこのページの中でだけ包み（manager.ts）、それから v2 の client/main.ts を読む
 * - URL: `?splat=0` スプラットにしない（同じサーバーで素の v2 と見比べる）/ `?radius=18` 変える半径（m）/ `?texel=0.01` 細かい粒（m）/
 *   `?gloss=1` つやの強さ / `?rough=1` 粗さの倍率 / `?sh=3` SH の段数 / `?budget=2500000` 粒の合計の上限 / `?leaves=0` 植物の葉を箱のままにする。v2 の指定（`?seed=` `?floor=1` `?showcase=1` `?nolock=1` など）もそのまま効く
 * - 開発用: window.splatProps（SplatPropManager）。v2 の window.game・window.session もそのまま
 */
import { SplatPropManager, type GameLike } from './manager.ts';
import { mountPanel } from './panel.ts';

const params = new URLSearchParams(location.search);
const enabled = params.get('splat') !== '0';
const num = (k: string, fallback: number): number => (params.has(k) && Number.isFinite(Number(params.get(k))) ? Number(params.get(k)) : fallback);

// スマホ・タブレットは粒の合計と半径を小さく（メモリと描画の重さ）
const touch = matchMedia('(pointer: coarse)').matches;
const mgr = new SplatPropManager({ radius: num('radius', touch ? 12 : 18), texel: num('texel', touch ? 0.015 : 0.01), budget: num('budget', touch ? 800_000 : 2_500_000) });
mgr.settings.sh.gloss = num('gloss', 1);
mgr.settings.sh.roughScale = num('rough', 1);
mgr.settings.sh.degree = Math.max(0, Math.min(3, num('sh', 3) | 0));
mgr.settings.face.foliage = params.get('leaves') !== '0';
if (enabled) mgr.install();

// v2 をそのまま起動（ClientGame を作り、最初の区域を読み始める）
await import('../../../v2/client/main.ts');

const game = (window as unknown as { game: GameLike }).game;
if (enabled) {
  mgr.attach(game);
  mountPanel(mgr);
}
(window as unknown as { splatProps: SplatPropManager }).splatProps = mgr;
