import { PropCatalog } from './render/PropCatalog';
import { Game } from './game/Game';
import { SaveManager } from './save/SaveManager';

const canvas = document.getElementById('game') as HTMLCanvasElement;
// Game のコンストラクタで Settings（音量・視点感度・Tier）を localStorage から復元し、AudioEngine / SettingsPanel を作る
const game = new Game(canvas);

// Keep the start overlay inert until all shared surfaces are resident.
const start = document.getElementById('start')!;
start.style.pointerEvents = 'none';
const startHint = start.querySelector('.panel > p');
if (startHint) startHint.textContent = '素材を読み込んでいます…';
// 開始クリック（ユーザージェスチャ）で AudioContext を作る。Game.onStartClick でも unlock するが、
// pointerdown の時点でも呼んでおくと iOS Safari で確実に running になる（unlock は何度呼んでも安全）
start.addEventListener('pointerdown', () => game.audio.unlock(), { passive: true });
await Promise.all([game.materials.ready, PropCatalog.shared.preload()]);

// 起動時: セーブがあればロード、無ければ新規（URL ?seed=123 で固定可）
// CC0 テクスチャは「使う部屋を組んだ時点」で読み始めるので、世界を作るのは開始を押せるようにする前。
const params = new URLSearchParams(location.search);
const seedParam = params.get('seed');
if (seedParam) {
  game.newWorld(Number(seedParam) >>> 0 || 1);
} else if (SaveManager.has() && !params.has('new')) {
  if (!game.loadWorld()) game.newWorld();
} else {
  game.newWorld();
}

// 最初の部屋が要るテクスチャだけ待つ（2 hop 先の先読みは待たない）
await game.materials.imagesReady();
start.style.pointerEvents = '';
if (startHint) startHint.textContent = game.materials.errors.length ? '一部の素材を読み込めませんでした。再読み込みしてください。' : 'クリックまたはタップで開始';

game.start();

// デバッグ用に公開（game.audio.debug() / game.world.log / game.step(1/60) / game.devInput）
(window as unknown as { game: Game }).game = game;
