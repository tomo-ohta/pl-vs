/**
 * v2 の起動。いまは段階 1 の実験場（core/lab/lab.ts）を読み込む。
 * - URL: `?seed=` 世界の seed / `?tune=キー=値,…` 調整表の上書き / `?nolock=1` Pointer Lock を使わない（自動テスト向け）
 * - 開発用: window.game（ClientGame）。ペインが隠れて rAF が止まるときは game.stepOnce() で 1 tick ずつ進める
 */
import './ui/style.css';
import { makeTuning, parseTuneParam, tuningVersion } from '../core/config/tuning.ts';
import { labFloor } from '../core/lab/lab.ts';
import { ClientGame } from './game/ClientGame.ts';
import { mountUi } from './ui/dom.ts';
import { RecOverlay } from './ui/RecOverlay.ts';
import { SettingsPanel } from './ui/SettingsPanel.ts';

const params = new URLSearchParams(location.search);
const { tuning, errors } = makeTuning(parseTuneParam(params.get('tune')));
if (errors.length) console.warn('[tune]', errors.join(' / '));
const seed = Number(params.get('seed') ?? 1) >>> 0 || 1;

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ui = mountUi(document.body);
const game = new ClientGame({ canvas, ui, tuning });
const rec = new RecOverlay(ui.recParent);
new SettingsPanel(game.settings, { slot: ui.settingsSlot });
// REC 表示は遊んでいる間だけ（一時停止の画面の下に透けないように。v1 と同じ）
const syncRec = (): void => rec.setVisible(game.settings.data.recOverlay && !game.paused);
syncRec();
game.settings.onChange(syncRec);

ui.pause.title.textContent = 'LIMINAL v2 — 実験場';
ui.pause.resumeLabel.textContent = '始める';
ui.setPauseVisible(true);
ui.pause.resume.addEventListener('click', () => {
  ui.setPauseVisible(false);
  ui.pause.resumeLabel.textContent = '再開';
  void game.resume();
});

await game.loadFloor(labFloor(seed, tuningVersion(tuning)));
game.start();
// REC の時刻（一時停止中は止める）
let last = performance.now();
const tickRec = (now: number): void => {
  rec.update(game.paused ? 0 : (now - last) / 1000);
  syncRec();
  last = now;
  requestAnimationFrame(tickRec);
};
requestAnimationFrame(tickRec);

(window as unknown as { game: ClientGame }).game = game;
