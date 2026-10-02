/**
 * v2 の起動: 世界の seed と深さからフロアを作って遊ぶ（core/gen/floor）。
 * - URL: `?seed=` 世界の seed / `?depth=` 始める深さ / `?variant=1` 裏のフロアから始める / `?tune=キー=値,…` 調整表の上書き /
 *   `?nolock=1` Pointer Lock を使わない（自動テスト向け）
 * - `?lab=1` 段階 1 の実験場（core/lab/lab.ts） / `?nodress=1` 区画の中身（家具）を置かない
 * - `?showcase=1` / `?showcase=2` 見本のフロア: 段階 3 の仕掛け 14 種を 1 つずつ・隠しを全部付けたフロア（2 は隠しの型が逆）。
 *   G で次の仕掛けの入口へ移る（Shift+G で前へ）。`?dev=1` なら、ふつうのフロアでも G が使える
 * - `?try=id,id` 指定した仕掛け・異変だけを置いた見本のフロア / `?group=<担当>` 担当（core/gen/catalog）の仕掛け・異変を全部置いた見本
 * - 地図と図鑑（client/map/MapController）: M キー / 地図ボタンでメニューの地図のタブ。フロアを読むたびに setFloor
 * - `?shape=<型>` フロアの形の型を決めて作る（どのフロアも。core/gen/floor/themes.ts の PatternId。例: spiral・tower・station）
 * - 駅の車両（F35）で次のフロアへ着いたときは、次のフロアの車両の中（trainRide の params.arrive）に出る
 * - 開発用: window.game（ClientGame）。ペインが隠れて rAF が止まるときは game.stepOnce() で 1 tick ずつ進める
 * - 果てしない階（docs/endless-world.md）: ふつうに遊ぶときは、階が無限の平面（区域を流し込む）。見本・実験場・?shape=・?floor=1 は今までのフロア
 */
import './ui/style.css';
import { makeTuning, parseTuneParam, tuningVersion } from '../core/config/tuning.ts';
import { labFloor } from '../core/lab/lab.ts';
import { dressCell } from '../core/gen/dress/index.ts';
import { generateFloorReport, type GenReport } from '../core/gen/floor/index.ts';
import { floorLoopTarget, loopSpawn } from '../core/gen/gimmicks/warp/floorLoop.ts';
import type { TourStop } from '../core/gen/floor/gimmicks.ts';
import { showcaseFloor } from '../core/gen/floor/showcase.ts';
import type { PatternId } from '../core/gen/floor/themes.ts';
import { RARE_DEFS } from '../core/gen/secrets/index.ts';
import { CATALOG_BY_WS } from '../core/gen/catalog/index.ts';
import type { FloorLayout } from '../core/world/layout.ts';
import { ClientGame } from './game/ClientGame.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import { downSlot, WorldPlanner } from '../core/gen/world/plan.ts';
import { WorldSession } from '../core/stream/session.ts';
import { WorkerSource } from './world/WorkerSource.ts';
import { restoreRegionCarry, saveRegionCarry, watchRegionCarry } from './game/carryStore.ts';
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
// フロアの形の型（段階 4 のフロアの形の担当が足した）
const shapeParam = (params.get('shape') || undefined) as PatternId | undefined;
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
function makeFloor(d: number, v = 0, arrival?: 'lift'): FloorLayout {
  lastReport = null;
  if (useLab) return labFloor(seed, tuningVersion(tuning));
  // 中身（家具）: ?nodress=1 で置かない（確認用）
  const dress = params.has('nodress') ? undefined : dressCell;
  const first = d === 0 && v === 0 && !moved;
  const r = tryIds.length && first ? showcaseFloor(tuning, { ids: tryIds, flip: showcase === 2, dress })
    : showcase && first ? showcaseFloor(tuning, { flip: showcase === 2, dress }) : generateFloorReport({ world: seed, depth: d, variant: v }, tuning, { dress, ...(shapeParam ? { shape: shapeParam } : {}), ...(arrival ? { arrival } : {}) });
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
/** 置いた物が残る（I09）の保存の鍵: 世界の seed・フロアの id・調整表の版。見本・実験場のフロアは残さない（同じ id でも中身が違う） */
const saveKeyOf = (f: FloorLayout): string | undefined => useLab || ((showcase || tryIds.length) && !moved) ? undefined : `${seed}:${f.id}:${tuningVersion(tuning)}`;
/** 前の階に戻る輪を通った階（同じ階からは 1 回だけ） */
const loopedFrom = new Set<number>();
game.onFloorExit = (_exit, _kind, to): void => {
  if (moving || useLab) return;
  moving = true;
  void (async () => {
    fade.style.opacity = '1';
    await sleep(550);
    // 行き先: 隠しの穴は 'depth.variant'（別のフロア・裏のフロア）、ふつうの出口は 1 つ下の表のフロア
    const m = to ? /^(\d+)\.(\d+)$/.exec(to) : null;
    // 前の階に戻る輪（F30。段階 4 warp で足した）: ふつうの出口が前の階へ戻ることがある（同じ階からは 1 回だけ）。着くのは別の入口
    // 駅の車両（F35）で降りたときは戻らない（駅の線が続く）
    const back = !m && _exit !== 'train' && !loopedFrom.has(depth) ? floorLoopTarget(seed, depth, tuning) : null;
    if (back !== null) loopedFrom.add(depth);
    if (m) { depth = Number(m[1]); variant = Number(m[2]); } else if (back !== null) { depth = back; variant = 0; } else { depth++; variant = 0; }
    moved = true;
    const t0 = performance.now();
    // エレベーター（liftCabin）で移った: 次のフロアの入口をかごにして、かごの中から始める
    const byLift = _kind === 'elevator';
    const next = makeFloor(depth, variant, byLift ? 'lift' : undefined);
    if (back !== null) next.spawn = loopSpawn(next, seed);
    await game.loadFloor(next, { saveKey: saveKeyOf(next) });
    if (game.sim) maps.setFloor(game.sim.floor, lastReport, { world: seed, depth, variant });
    // 駅の車両で着いた: 次のフロアにも車両があれば、その中に出る（扉が閉まった車両の中から、着いて扉が開く）
    if (_exit === 'train') {
      const arrive = next.entities.find((e) => e.type === 'trainRide')?.params.arrive as { pos?: number[]; yaw?: number } | undefined;
      if (arrive?.pos) game.teleport([arrive.pos[0]!, arrive.pos[1]!, arrive.pos[2]!], arrive.yaw ?? 0);
    }
    if (byLift) game.audio.elevator('bell');
    console.info(`[floor] B${depth + 1}F${variant ? `（裏 ${variant}）` : ''} 読み込み ${(performance.now() - t0).toFixed(0)} ms`);
    fade.style.opacity = '0';
    moving = false;
  })();
};

const t0 = performance.now();
// 果てしない階（ふつうに遊ぶとき）。見本・実験場・型を決めて作る・?floor=1 は今までのフロア
const worldMode = !useLab && !showcase && !tryIds.length && !shapeParam && !params.has('floor');
if (worldMode) {
  const R = await loadRapier();
  const source = new WorkerSource(tuning, { dress: !params.has('nodress') });
  const planner = new WorldPlanner(tuning);
  const story = { world: seed, depth, variant: 0 };
  const [sx, sz] = downSlot(seed, depth - 1, 0, 0);
  await source.prefetch(planner.at(story, sx, sz));
  // 置いた物が残る（I09）: 区域ごとに保存する（区域を入れた直後に戻し、外す直前と置くたびに書く）
  const carryKey = (story: { depth: number; variant: number }, rid: string): string => `${seed}:${story.depth}.${story.variant}:${rid}:${tuningVersion(tuning)}`;
  const session = new WorldSession(seed, depth, {
    tuning, source, physics: () => new PhysicsWorld(R, 1 / tuning['physics.tickHz']), ready: (w) => game.storyReady(w),
    regionAdded: (w, id, L) => restoreRegionCarry(w.sim, L, carryKey(w.story, id)),
    regionRemoving: (w, id, L) => saveRegionCarry(w.sim, L, carryKey(w.story, id)),
  });
  watchRegionCarry(() => game.sim, (L) => carryKey(game.session!.active.story, L.region!.id), (f) => { game.eventTaps.add(f); return () => game.eventTaps.delete(f); });
  game.startWorld(session);
  // 地図と調査率は区域ごと（区域 ≒ 今までのフロア）。区域が替わったら地図を替える
  let regionAt = '';
  const syncRegion = (): void => {
    const sim = game.sim, s = game.session;
    if (!sim || !s) return;
    const p = sim.players[0]!;
    const plan = s.active.planAt(p.pos[0], p.pos[2]);
    const key = `${s.storyId}:${plan.id}`;
    if (key === regionAt) return;
    const L = s.active.regionLayout(plan.id);
    if (!L) return;
    regionAt = key;
    depth = s.active.story.depth;
    variant = s.active.story.variant;
    maps.setFloor(L, null, { world: seed, depth, variant, region: plan.id, name: L.region?.name ?? '' });
  };
  syncRegion();
  const frame0 = game.onFrame;
  game.onFrame = (input, dt) => { syncRegion(); frame0?.(input, dt); };
  game.onStoryChange = (c) => console.info(`[階] B${c.from.depth + 1}F → B${c.to.depth + 1}F（${c.seamless ? `階段室 ${c.airlock}` : '暗転'}）`);
  // 階段室でない出口（隠しの穴・縦穴・エレベーターの仕掛け・迷路フロアの別の出口）: 暗転して、行き先の階の同じ位置に近い部屋へ
  game.onFloorExit = (_exit, kind, to): void => {
    if (moving) return;
    moving = true;
    void (async () => {
      const s = game.session!, p = game.sim!.players[0]!;
      const m = to ? /^(-?\d+)\.(\d+)$/.exec(to) : null;
      const target = m ? { world: seed, depth: Number(m[1]), variant: Number(m[2]) } : { world: seed, depth: s.active.story.depth + 1, variant: 0 };
      const x = p.pos[0], z = p.pos[2];
      fade.style.opacity = '1';
      const t1 = performance.now();
      await sleep(450);
      for (let i = 0; i < 400 && !s.prepareGoto(target, x, z); i++) await sleep(50);
      for (let i = 0; i < 400 && !s.commitGoto(); i++) await sleep(30);
      if (kind === 'elevator') game.audio.elevator('bell');
      console.info(`[階] 暗転して B${target.depth + 1}F${target.variant ? '（裏）' : ''} へ ${(performance.now() - t1).toFixed(0)} ms`);
      fade.style.opacity = '0';
      moving = false;
    })();
  };
  (window as unknown as { session: WorldSession }).session = session;
} else {
  const first = makeFloor(depth, variant);
  await game.loadFloor(first, { saveKey: saveKeyOf(first) });
  if (game.sim) maps.setFloor(game.sim.floor, lastReport, { world: seed, depth, variant });
}
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
