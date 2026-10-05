/**
 * v2 の世界の小物を形の関数のメッシュに差し替えて遊ぶ（world.html）。v2 のファイルは変えない。
 *
 * - 置いてある小物（植物・棚の中身・寝具・洗面器・便器・流し台・壁の時計など）: worldProps.ts（v2 の FloorBuilder を包む）
 * - 持てる物（荷物・バケツ・電球・玉・ピン・ぬいぐるみなど）: carryView.ts（v2 の描画の登録を上書き）
 * - P: 形の関数 ↔ v2 の箱 / URL: `?detail=1.5` 細かさの倍率（大きいほど粗い。既定 1.5）、v2 の指定（`?seed=` `?nolock=1` など）もそのまま
 * - 開発用: window.procedural（ProceduralProps）。v2 の window.game もそのまま
 */
import { detail } from '../showroom/surfel.ts';
import { ProceduralProps, type GameLike } from './worldProps.ts';
import { carryStats, installCarryViews } from './carryView.ts';
import { mountWorldPanel } from './panel.ts';

const params = new URLSearchParams(location.search);
const num = (k: string, fallback: number): number => (params.has(k) && Number.isFinite(Number(params.get(k))) ? Number(params.get(k)) : fallback);
detail.spacingScale = Math.max(0.5, Math.min(4, num('detail', 1.5)));

const mgr = new ProceduralProps();
mgr.install();
let game: GameLike | null = null;
installCarryViews(mgr, () => game?.renderer ?? (window as unknown as { game?: GameLike }).game?.renderer ?? null);

await import('../../../../v2/client/main.ts');

game = (window as unknown as { game: GameLike }).game;
mgr.attach(game);
mountWorldPanel(mgr);
(window as unknown as { procedural: ProceduralProps & { carry: typeof carryStats } }).procedural = Object.assign(mgr, { carry: carryStats });
