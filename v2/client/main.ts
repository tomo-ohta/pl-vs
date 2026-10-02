/**
 * v2 の起動: 世界の seed と深さからフロアを作って遊ぶ（core/gen/floor）。
 * - URL: `?seed=` 世界の seed / `?depth=` 始める深さ / `?variant=1` 裏のフロアから始める / `?tune=キー=値,…` 調整表の上書き /
 *   `?nolock=1` Pointer Lock を使わない（自動テスト向け）
 * - `?lab=1` 段階 1 の実験場（core/lab/lab.ts） / `?nodress=1` 区画の中身（家具）を置かない
 * - `?showcase=1` / `?showcase=2` 見本のフロア: 段階 3 の仕掛け 14 種を 1 つずつ・隠しを全部付けたフロア（2 は隠しの型が逆）。
 *   G で次の仕掛けの入口へ移る（Shift+G で前へ）。`?dev=1` なら、ふつうのフロアでも G が使える
 * - `?try=id,id` 指定した仕掛け・異変だけを置いた見本のフロア / `?group=<担当>` 担当（core/gen/catalog）の仕掛け・異変を全部置いた見本
 * - 地図と図鑑（client/map/MapController）: M キー / 地図ボタンでメニューの地図のタブ。フロアを読むたびに setFloor
 * - 開発用: window.game（ClientGame）。ペインが隠れて rAF が止まるときは game.stepOnce() で 1 tick ずつ進める
 */
import './ui/style.css';
import { makeTuning, parseTuneParam, tuningVersion } from '../core/config/tuning.ts';
import { labFloor } from '../core/lab/lab.ts';
import { dressCell } from '../core/gen/dress/index.ts';
import { generateFloorReport, type GenReport } from '../core/gen/floor/index.ts';
import type { TourStop } from '../core/gen/floor/gimmicks.ts';
import { showcaseFloor } from '../core/gen/floor/showcase.ts';
import { RARE_DEFS } from '../core/gen/secrets/index.ts';
import { CATALOG_BY_WS } from '../core/gen/catalog/index.ts';
import type { FloorLayout } from '../core/world/layout.ts';
import { ClientGame } from './game/ClientGame.ts';
import { codexDefs } from './map/codexDefs.ts';
import { MapController } from './map/MapController.ts';
import { mountUi } from './ui/dom.ts';
import { RecOverlay } from './ui/RecOverlay.ts';
import { SettingsPanel } from './ui/SettingsPanel.ts';

const params = new URLSearchParams(location.search);
const { tuning, errors } = makeTuning(parseTuneParam(params.get('tune')));
if (errors.length) console.warn('[tune]', errors.join(' / '));
const seed = Number(params.get('seed') ?? 1) >>> 0 || 1;
const useLab = params.has('lab');
const showcase = Math.max(0, Number(params.get('showcase') ?? 0) | 0);
// 見本に置く仕掛け・異変を選ぶ（?try= / ?group=）
const tryIds = [...new Set([
  ...(params.get('try') ?? '').split(',').map((x) => x.trim()).filter(Boolean),
  ...(CATALOG_BY_WS[params.get('group') ?? ''] ?? []).flatMap((e) => e.impl.filter((m) => m.kind === 'gimmick' || m.kind === 'anomaly').map((m) => m.id)),
  // 部屋の形（core/gen/rooms。台帳の kind 'room'）
  ...(CATALOG_BY_WS[params.get('group') ?? ''] ?? []).flatMap((e) => e.impl.filter((m) => m.kind === 'room' && e.status === 'done').map((m) => m.id)),
])];
const devTour = showcase > 0 || tryIds.length > 0 || params.has('dev');
let depth = Math.max(0, Number(params.get('depth') ?? 0) | 0);

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ui = mountUi(document.body);
const game = new ClientGame({ canvas, ui, tuning });
const rec = new RecOverlay(ui.recParent);
new SettingsPanel(game.settings, { slot: ui.settingsSlot });
// REC 表示は遊んでいる間だけ（一時停止の画面の下に透けないように。v1 と同じ）
const syncRec = (): void => rec.setVisible(game.settings.data.recOverlay && !game.paused);
syncRec();
game.settings.onChange(syncRec);
// 地図と図鑑（小さな地図・メニューの地図と図鑑のタブ・調査率・壁の地図を写す）
const maps = new MapController({ game, ui, tuning, defs: codexDefs() });
game.onFrame = (input, dt) => maps.frame(input, dt);

ui.pause.title.textContent = useLab ? 'LIMINAL v2 — 実験場' : showcase || tryIds.length ? 'LIMINAL v2 — 見本のフロア' : 'LIMINAL v2';
if (devTour) {
  const p = document.createElement('p');
  p.innerHTML = '<b class="mono">G</b>次の仕掛けの入口へ移る（Shift+G で前へ）';
  ui.pause.help.append(p);
}
ui.pause.resumeLabel.textContent = '始める';
ui.setPauseVisible(true);
ui.pause.resume.addEventListener('click', () => {
  ui.setPauseVisible(false);
  ui.pause.resumeLabel.textContent = '再開';
  void game.resume();
});

/** 深さ depth（・版 variant）のフロアを作る（seed は世界の seed。見本は最初のフロアだけ） */
let variant = Math.max(0, Number(params.get('variant') ?? 0) | 0);
let tour: { stop: TourStop; text: string }[] = [];
let tourAt = -1;
/** 最後に作ったフロアの生成の報告（地図と図鑑が仕掛け・異変・隠しの場所を知るのに使う。実験場は null） */
let lastReport: GenReport | null = null;
function makeFloor(d: number, v = 0): FloorLayout {
  lastReport = null;
  if (useLab) return labFloor(seed, tuningVersion(tuning));
  // 中身（家具）: ?nodress=1 で置かない（確認用）
  const dress = params.has('nodress') ? undefined : dressCell;
  const first = d === 0 && v === 0 && !moved;
  const r = tryIds.length && first ? showcaseFloor(tuning, { ids: tryIds, flip: showcase === 2, dress })
    : showcase && first ? showcaseFloor(tuning, { flip: showcase === 2, dress }) : generateFloorReport({ world: seed, depth: d, variant: v }, tuning, { dress });
  console.info(`[gen] ${r.floor.id} ${r.profile.rarity} ${r.profile.family.name}/${r.profile.pattern} ${r.profile.cols}×${r.profile.rows} 区画 ${r.floor.cells.length} 箱 ${r.floor.cells.reduce((a, c) => a + c.boxes.length, 0)}${r.tone ? ` 裏の調子 ${r.tone}` : ''} 作り直し ${r.attempts - 1} ${r.ms} ms`, r.issues);
  lastReport = r;
  tour = tourOf(r);
  tourAt = -1;
  if (devTour) console.table(tour.map((x) => ({ 場所: x.text, 区画: x.stop.cell })));
  return r.floor;
}

const MODE_JA = { present: '存在型（最初からある）', appear: '出現型（条件で現れる）' } as const;
const DEST_JA: Record<string, string> = { rareRoom: 'レア部屋', passageRare: '隠し通路の先にレア部屋', loop: '隠し通路で別の部屋へ抜ける', floorLink: '下のフロアへの穴', bFloor: '裏のフロアへの穴' };
/** 見て回る順と、その場所の隠し（型と行き先） */
function tourOf(r: GenReport): { stop: TourStop; text: string }[] {
  const g = r.gimmicks;
  if (!g) return [];
  return g.tour.map((stop, i) => {
    const sec = g.secrets.filter((s) => s.host === stop.cell);
    const rareName = (k?: string): string => (k ? `（${RARE_DEFS.find((d) => d.id === k)?.name ?? k}）` : '');
    const tail = sec.length ? ` — 隠し: ${sec.map((s) => `${MODE_JA[s.mode]}・${DEST_JA[s.dest] ?? s.dest}${rareName(s.rare)}`).join(' / ')}` : '';
    return { stop, text: `${i + 1}/${g.tour.length} ${stop.label}${tail}` };
  });
}

// 見本のフロアのワープ（G / Shift+G）。案内は 6 秒で消す
let hintTimer = 0;
if (devTour) {
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyG' || e.repeat || game.paused || !tour.length) return;
    tourAt = (tourAt + (e.shiftKey ? -1 : 1) + tour.length) % tour.length;
    const { stop, text } = tour[tourAt]!;
    game.teleport(stop.pos, stop.yaw);
    ui.setHint(text);
    clearTimeout(hintTimer);
    hintTimer = window.setTimeout(() => ui.setHint(''), 6000);
  });
}

// 暗転（フロアの移動）
const fade = document.createElement('div');
fade.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity .5s;z-index:50';
document.body.appendChild(fade);
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
let moving = false;
let moved = false;
game.onFloorExit = (_exit, _kind, to): void => {
  if (moving || useLab) return;
  moving = true;
  void (async () => {
    fade.style.opacity = '1';
    await sleep(550);
    // 行き先: 隠しの穴は 'depth.variant'（別のフロア・裏のフロア）、ふつうの出口は 1 つ下の表のフロア
    const m = to ? /^(\d+)\.(\d+)$/.exec(to) : null;
    if (m) { depth = Number(m[1]); variant = Number(m[2]); } else { depth++; variant = 0; }
    moved = true;
    const t0 = performance.now();
    await game.loadFloor(makeFloor(depth, variant));
    if (game.sim) maps.setFloor(game.sim.floor, lastReport, { world: seed, depth, variant });
    console.info(`[floor] B${depth + 1}F${variant ? `（裏 ${variant}）` : ''} 読み込み ${(performance.now() - t0).toFixed(0)} ms`);
    fade.style.opacity = '0';
    moving = false;
  })();
};

const t0 = performance.now();
await game.loadFloor(makeFloor(depth, variant));
if (game.sim) maps.setFloor(game.sim.floor, lastReport, { world: seed, depth, variant });
console.info(`[floor] 読み込み ${(performance.now() - t0).toFixed(0)} ms`);
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
// 開発用: 地図と図鑑（window.maps.map が自分の地図）
(window as unknown as { maps: MapController }).maps = maps;
