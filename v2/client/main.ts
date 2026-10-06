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
 * - 作り込む小物（client/props）: `?props=0` で箱のまま。`?dev=1` などの見本では P で 形の関数の物 ↔ 箱 を切り替える（見比べ）
 * - 果てしない階（docs/endless-world.md）: ふつうに遊ぶときは、階が無限の平面（区域を流し込む）。見本・実験場・?shape=・?floor=1 は今までのフロア
 * - ルーム ID（docs/endless-world.md 15 章）: `?id=1234` でその部屋から始める（無い番号なら「通信エラー」→ トップページ）。
 *   部屋を移るたびにアドレスとタブの名前を `?id=…`・`Room …` に書き換える。始める場所の指定（id・depth・variant・見本・実験場・型・?floor=1）が
 *   無ければトップページ（仮。ルーム ID を入れる・ランダムな部屋・はじめから）
 * - タブレット（client/tablet）: Tab（スマホは端末ボタン）で出す・しまう。カメラ・探索（番号の部屋へ移る。電源が落ちる演出）・
 *   マップ・SNS（準備中）・ギャラリー・設定（メニュー）
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
import { IS_MOBILE } from './device.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import { START_SLOT, WorldPlanner, type StoryKey } from '../core/gen/world/plan.ts';
import { cellIndexAt, decodeRoomId, isRoomCell, roomCellOk, roomIdOf } from '../core/gen/world/roomId.ts';
import { WorldSession, type SessionOptions } from '../core/stream/session.ts';
import { WorkerSource } from './world/WorkerSource.ts';
import { restoreRegionCarry, saveRegionCarry, watchRegionCarry } from './game/carryStore.ts';
import { codexDefs } from './map/codexDefs.ts';
import { MapController } from './map/MapController.ts';
import { mountUi } from './ui/dom.ts';
import { RecOverlay } from './ui/RecOverlay.ts';
import { showConnectionError } from './ui/ConnectionError.ts';
import { showTopPage } from './ui/TopPage.ts';
import { RoomAddress, roomTitle, roomUrl, topUrl } from './game/roomAddress.ts';
import { TabletController, type TabletHooks } from './tablet/TabletController.ts';
import { PowerFx } from './ui/PowerFx.ts';
import { SettingsPanel } from './ui/SettingsPanel.ts';

const params = new URLSearchParams(location.search);
// スマホは持つ区域を減らす（果てしない階。URL の ?tune= が優先）
const { tuning, errors } = makeTuning({ ...(IS_MOBILE ? { 'world.maxRegions': 4, 'world.unload.gateM': 56 } : {}), ...parseTuneParam(params.get('tune')) });
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
const game = new ClientGame({ canvas, ui, tuning, props: params.get('props') !== '0' });
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
// メニューの「再開」。始めるときはメニューを出さない（読み込みの間は LOADING、終わったら電源が入って一人称の画面から。下の「遊び始める」）
ui.pause.resume.addEventListener('click', () => {
  ui.setPauseVisible(false);
  void game.resume();
});
// 始めるまで入力を止める（トップページ・読み込みの間の操作がゲームに渡らないように。Pointer Lock が外れてもメニューを開かない）
game.input.enabled = false;
// 音はユーザー操作の中でしか鳴らし始められない: 最初の操作（トップページのボタン・クリック・タップ・キー）で解錠する
const GESTURES = ['pointerdown', 'touchend', 'click', 'keydown'] as const;
const firstGesture = (): void => {
  game.audio.unlock();
  for (const ev of GESTURES) removeEventListener(ev, firstGesture, true);
};
for (const ev of GESTURES) addEventListener(ev, firstGesture, true);
// 電源が落ちる・入る演出（始める前の読み込み・タブレットの「探索」で部屋を移るとき）
const power = new PowerFx(canvas, () => game.audio.sfxInput);

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

// 作り込む小物の見比べ（P: 形の関数の物 ↔ 箱）。見本・?dev=1 のときだけ
if (devTour) {
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyP' || e.repeat || game.paused) return;
    game.props.setEnabled(!game.props.isEnabled);
    ui.setHint(game.props.isEnabled ? '小物: 形の関数の物' : '小物: 箱（いままでの作り）');
    clearTimeout(hintTimer);
    hintTimer = window.setTimeout(() => ui.setHint(''), 3000);
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

// 果てしない階（ふつうに遊ぶとき）。見本・実験場・型を決めて作る・?floor=1 は今までのフロア
const worldMode = !useLab && !showcase && !tryIds.length && !shapeParam && !params.has('floor');
/** 今いる部屋のルーム ID（果てしない階。番号の無い所に入っても前の部屋のまま） */
let currentRoomId: number | null = null;
/** タブレットの「探索」: 番号の部屋があるか・その部屋へ移る（果てしない階で入れる） */
let roomCheck: TabletHooks['checkRoom'] = async () => false;
let roomWarp: TabletHooks['warp'] = async () => false;
const worldSource = worldMode ? new WorkerSource(tuning, { dress: !params.has('nodress') }) : null;
const planner = new WorldPlanner(tuning);

/** ランダムな部屋の番号（深さ 0〜9 の表の階・出発点から 6 升目までの区域の、隠し場所でない部屋。区域を作って選ぶ） */
async function randomRoom(): Promise<number | null> {
  for (let i = 0; i < 6; i++) {
    const story: StoryKey = { world: seed, depth: Math.floor(Math.random() * 10), variant: 0 };
    const plan = planner.at(story, Math.floor(Math.random() * 13) - 6, Math.floor(Math.random() * 13) - 6);
    const L = await worldSource!.prefetch(plan);
    if (!L) continue;
    const secret = new Set((L.region?.contents?.secrets ?? []).flatMap((x) => x.cells));
    const ok = L.cells.map((c, k) => ({ c, k })).filter(({ c }) => isRoomCell(L, c) && c.role !== 'secret' && !secret.has(c.id));
    if (!ok.length) continue;
    const id = roomIdOf(seed, L, story, ok[Math.floor(Math.random() * ok.length)]!.k);
    if (id !== null) return id;
  }
  return null;
}

/** 無い部屋: 「通信エラー」を出してトップページへ（このページはここで止める） */
async function roomNotFound(id: string): Promise<never> {
  ui.setPauseVisible(false);
  await showConnectionError(id);
  location.replace(topUrl());
  return new Promise<never>(() => {});
}

// 始める場所の指定が無ければトップページ
let startId = worldMode ? params.get('id') : null;
const startGiven = ['id', 'depth', 'variant', 'lab', 'showcase', 'try', 'group', 'shape', 'floor'].some((k) => params.has(k));
if (worldMode && !startGiven) {
  const choice = await showTopPage({
    seed, randomRoom,
    // 押した操作の中で音の解錠と Pointer Lock を取っておく（読み込みが終わったら、すぐ視点を動かして遊べる）
    onChoose: () => { game.audio.unlock(); void game.input.requestLock(); },
    onCancel: () => game.input.exitLock(),
  });
  if (choice.kind === 'id') {
    startId = choice.id;
    history.replaceState(history.state, '', roomUrl(startId));
    document.title = roomTitle(startId);
  }
}

// 読み込みの間は真っ暗で LOADING（終わったら電源が入り、一人称の画面から始まる）
power.dark(startId !== null ? `ROOM ${startId}` : useLab ? '' : `B${depth + 1}F`);
const t0 = performance.now();
if (worldMode) {
  const R = await loadRapier();
  const source = worldSource!;
  // ルーム ID の部屋から: 番号 → 部屋の場所 → 区域を作って、その区画があるか確かめる
  let start: SessionOptions['start'];
  if (startId !== null) {
    const ref = decodeRoomId(seed, startId);
    if (!ref) await roomNotFound(startId);
    const st: StoryKey = { world: seed, depth: ref!.depth, variant: ref!.variant };
    const plan = planner.at(st, ref!.cx, ref!.cz);
    const L = await source.prefetch(plan);
    if (!L || !roomCellOk(L, ref!)) await roomNotFound(startId);
    start = { story: st, plan, cell: L!.cells[ref!.cell]!.id };
    depth = st.depth;
    variant = st.variant;
    document.title = roomTitle(startId);
  } else {
    const [sx, sz] = START_SLOT;
    await source.prefetch(planner.at({ world: seed, depth, variant: 0 }, sx, sz));
  }
  // 置いた物が残る（I09）: 区域ごとに保存する（区域を入れた直後に戻し、外す直前と置くたびに書く）
  const carryKey = (story: { depth: number; variant: number }, rid: string): string => `${seed}:${story.depth}.${story.variant}:${rid}:${tuningVersion(tuning)}`;
  const session = new WorldSession(seed, depth, {
    tuning, source, physics: () => new PhysicsWorld(R, 1 / tuning['physics.tickHz']), ready: (w, id) => game.regionReady(w, id), ...(start ? { start } : {}),
    regionAdded: (w, id, L) => restoreRegionCarry(w.sim, L, carryKey(w.story, id)),
    regionRemoving: (w, id, L) => saveRegionCarry(w.sim, L, carryKey(w.story, id)),
  });
  watchRegionCarry(() => game.sim, (L) => carryKey(game.session!.active.story, L.region!.id), (f) => { game.eventTaps.add(f); return () => game.eventTaps.delete(f); });
  game.startWorld(session);
  // 調査率は区域ごと（区域 ≒ 今までのフロア）。地図は階の区域を全部つないで描く（区域が替わっても消えない。MapController.setRegion）
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
    maps.setRegion(L, null, { world: seed, depth, variant, region: plan.id, name: L.region?.name ?? '' });
  };
  syncRegion();
  // ルーム ID: 番号の違う部屋に入ったら、アドレスとタブの名前を書き換える（階段室・エレベーターのかご・別の空間は番号なし: そのまま）
  const address = new RoomAddress({ current: startId !== null ? Number(startId) : null });
  const syncRoom = (): void => {
    const sim = game.sim, s = game.session;
    if (!sim || !s) return;
    const p = sim.players[0]!;
    const plan = s.active.planAt(p.pos[0], p.pos[2]);
    const L = s.active.regionLayout(plan.id);
    if (!L) return;
    const id = roomIdOf(seed, L, s.active.story, cellIndexAt(L, p.pos));
    if (id !== null) { address.set(id); currentRoomId = id; }
  };
  if (startId !== null) currentRoomId = Number(startId);
  // タブレットの「探索」: 番号 → 部屋の場所 → 区域を作って区画があるか
  const roomTarget = async (id: number): Promise<{ story: StoryKey; plan: ReturnType<WorldPlanner['at']>; cell: string } | null> => {
    const ref = decodeRoomId(seed, id);
    if (!ref) return null;
    const st: StoryKey = { world: seed, depth: ref.depth, variant: ref.variant };
    const plan = planner.at(st, ref.cx, ref.cz);
    const L = await source.prefetch(plan);
    return L && roomCellOk(L, ref) ? { story: st, plan, cell: L.cells[ref.cell]!.id } : null;
  };
  roomCheck = async (id) => (await roomTarget(id)) !== null;
  // 番号の部屋へ移る: 電源が落ちる → 移る先を作る（LOADING）→ 電源が入って、その部屋の開口の内側に立つ
  roomWarp = async (id, onDark) => {
    if (moving) return false;
    const target = await roomTarget(id);
    if (!target || moving) return false;
    moving = true;
    game.input.enabled = false;
    let ok = false;
    try {
      const t1 = performance.now();
      await power.off(`ROOM ${id}`);
      onDark();
      const s = game.session!;
      for (let i = 0; i < 200 && !(ok = s.prepareGotoRoom(target.story, target.plan, target.cell)); i++) await sleep(50);
      if (ok) { ok = false; for (let i = 0; i < 600 && !(ok = s.commitGoto()); i++) await sleep(30); }
      // LOADING を少しは見せる
      const rest = 1500 - (performance.now() - t1);
      if (rest > 0) await sleep(rest);
      if (ok) currentRoomId = id;
      console.info(`[探索] ROOM ${id} へ${ok ? '' : '移れず'} ${(performance.now() - t1).toFixed(0)} ms`);
      await power.on();
    } finally {
      game.input.enabled = !game.paused;
      moving = false;
    }
    return ok;
  };
  const frame0 = game.onFrame;
  game.onFrame = (input, dt) => { syncRegion(); syncRoom(); frame0?.(input, dt); };
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
// タブレット（Tab / 端末ボタン）
const tablet = new TabletController(game, {
  seed,
  roomId: () => currentRoomId,
  placeLabel: () => `B${depth + 1}F${variant ? ' 裏' : ''}`,
  roomsAvailable: () => !!game.session,
  checkRoom: (id) => roomCheck(id),
  warp: (id, onDark) => roomWarp(id, onDark),
  maps,
});
// 遊び始める: メニューを出さずに、電源が入って一人称の画面から
game.begin();
game.start();
void power.on().then(() => {
  // Pointer Lock をまだ取れていない（アドレスから直接開いた・読み込みの間に Esc）: 最初のクリックで取る（InputController）。それまで案内を出す
  const inp = game.input;
  if (inp.mode !== 'pc' || !inp.useLock || inp.locked) return;
  ui.setHint('クリックで視点を動かせます');
  const locked = (): void => {
    if (!document.pointerLockElement) return;
    ui.setHint('');
    document.removeEventListener('pointerlockchange', locked);
  };
  document.addEventListener('pointerlockchange', locked);
});
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
(window as unknown as { tablet: TabletController }).tablet = tablet;
// 開発用: 地図と図鑑（window.maps.map が自分の地図）
(window as unknown as { maps: MapController }).maps = maps;
