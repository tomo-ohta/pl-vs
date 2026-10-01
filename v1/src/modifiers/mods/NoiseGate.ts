/**
 * NoiseGate — 音声認証扉（E17）。3 扉構成: 静（still）/ 歩（walk）/ 走（dash）の 1 帯 1 扉。
 * params: thresholds（帯の一覧。既定 ['still','walk','dash']）/ useMic（既定 true）/ levels（帯の境界 0..1。既定 [0.22, 0.55]）/ holdSec（帯が下がるときの保持秒。既定 0.4）。
 *
 * layout フック（決定論）: 生成器の出口扉（exit*）と床穴を捨て、入口の対面の壁（無ければ側壁）に gate0..2 を 1.5 m 間隔で並べて外殻を組み直す。
 *   帯の並びは rng で並び替え、各扉の上にサイン（🔈 静 / 🔉 歩 / 🔊 走 + 音量バー）を置く。サイン id は `ng:<socketId>:<band>` で、
 *   帯の割当はレイアウトから復元できる（bandsOf）。扉脇に音量メーター（id 'ng:meter'、emissive）。
 * onConnect: 帯ごとに接続先の傾向を変える（still → 小部屋 smallOnly / walk → 廊下優先 / dash → 部屋型優先 = 「音量帯により接続先カテゴリ変更」）。
 *   このとき帯の割当を node.state.modifierState.NoiseGate.bands に保存する（onEnter でも保存。canOpen はレイアウト → 保存値の順で参照）。
 * update（E17 が現在部屋または可視のとき毎フレーム）: プレイヤー位置の差分から移動ランク（still / walk / dash / jump・着地）を作り
 *   ctx.audio.loudnessLevel(rank, jumped) に渡す（マイクが有効ならマイク音量、無ければ移動由来の疑似音量。0..1）。
 *   levels で 3 帯に量子化し、上がる方向は即時、下がる方向は holdSec 保持（ダッシュ直後に E を押す猶予）。メーターの文字を Tier 別レート（low 4 Hz / それ以外 10 Hz）で更新。
 * canOpen: gate* の扉だけ判定。現在の帯と扉の帯が一致すれば ok、違えば { ok: false, hint: 'この扉は音に反応しない…' }。
 * マイク要求: useMic のとき、E17 の扉に対する最初の「操作」で ctx.audio.requestMic() を呼ぶ（非同期。結果を待たず代替値で判定は続く）。
 *   canOpen は HUD ヒント（毎フレーム 1 回）と操作（interactRay）の両方から呼ばれ区別できないので、update の間に canOpen が 2 回以上呼ばれたフレーム
 *   （= ヒント + 操作）を「操作」とみなす。拒否 / 非 HTTPS / 未対応なら以後は要求しない。結果は localStorage に保存しない（セッション内のみ）。
 *   E17 を出るときマイクを止める（次の E17 でまた要求。ブラウザが許可を記憶していればダイアログは出ない）。
 * Tier: 寸法・抽選・判定は変えず、メーターの更新レートだけ落とす。
 */
import { aabbFromCenter, type AABB } from '../../core/aabb';
import type { Dir, RoomInstance, Socket, Vec3 } from '../../core/types';
import { addDir, dirVec } from '../../core/types';
import { clearDoorways } from '../../generators/common';
import { across, along, buildShell, socketOnSpan, wallSpans, type Rect, type WallSpan } from '../../generators/footprint';
import { DOOR_H, DOOR_W, HOLE_SIZE, WALL_T, type Box, type GenParams, type RoomLayout, type SignSpec } from '../../generators/layout';
import type { Rng } from '../../core/rng';
import type { CanOpenResult, ModifierImpl, ModifierParams, RuntimeContext } from '../types';
import { bool, num } from '../util';

export const NOISE_GATE_ID = 'NoiseGate';
export type Band = 'still' | 'walk' | 'dash';
export const BANDS: readonly Band[] = ['still', 'walk', 'dash'];
const BAND_RANK: Record<Band, number> = { still: 0, walk: 1, dash: 2 };
const BAND_LABEL: Record<Band, string> = { still: '静', walk: '歩', dash: '走' };
const BAND_ICON: Record<Band, string> = { still: '🔈', walk: '🔉', dash: '🔊' };
const BAND_BARS: Record<Band, string> = { still: '▮▯▯', walk: '▮▮▯', dash: '▮▮▮' };
export const GATE_PREFIX = 'gate';
const SIGN_PREFIX = 'ng:';
export const METER_SIGN_ID = 'ng:meter';
const GATE_GAP = 1.5;
const GATE_MARGIN = 1.0;

export interface NoiseGateState {
  bands: Record<string, Band>;
}

function isBand(v: unknown): v is Band {
  return v === 'still' || v === 'walk' || v === 'dash';
}

function parseBands(v: unknown): Band[] {
  const out: Band[] = [];
  if (Array.isArray(v)) for (const x of v) if (isBand(x) && !out.includes(x)) out.push(x);
  return out.length > 0 ? out : [...BANDS];
}

export function isGateSocket(id: string): boolean {
  return id.startsWith(GATE_PREFIX);
}

/** レイアウトのサイン id（ng:<socketId>:<band>）から扉ごとの帯を復元する */
export function bandsOf(L: RoomLayout): Record<string, Band> {
  const out: Record<string, Band> = {};
  for (const s of L.signs ?? []) {
    if (!s.id || !s.id.startsWith(SIGN_PREFIX) || s.id === METER_SIGN_ID) continue;
    const parts = s.id.split(':');
    if (parts.length === 3 && isBand(parts[2])) out[parts[1]] = parts[2];
  }
  return out;
}

export function readState(node: RoomInstance | null | undefined): NoiseGateState | null {
  const s = node?.state?.modifierState?.[NOISE_GATE_ID] as NoiseGateState | undefined;
  return s && s.bands && typeof s.bands === 'object' ? s : null;
}

function saveBands(node: RoomInstance, bands: Record<string, Band>): void {
  if (Object.keys(bands).length === 0) return;
  if (!node.state.modifierState) node.state.modifierState = {};
  node.state.modifierState[NOISE_GATE_ID] = { bands: { ...bands } } satisfies NoiseGateState;
}

function bandFor(ctx: RuntimeContext, socketId: string): Band | null {
  return bandsOf(ctx.layout)[socketId] ?? readState(ctx.node)?.bands[socketId] ?? null;
}

// ---------------------------------------------------------------- layout

/** 壁面ソケットの内側に貼るサイン（壁の内面 + 1 cm、室内向き）。offsetAlong は壁に沿ったずらし */
function wallSign(id: string, wallPos: Vec3, wallDir: Dir, y: number, width: number, text: string, sub: string | undefined, kind: SignSpec['kind'], offsetAlong = 0): SignSpec {
  const inward = dirVec(addDir(wallDir, 2));
  const alongV = dirVec(addDir(wallDir, 1));
  const d = WALL_T + 0.01;
  return {
    id, text, sub, kind, width,
    pos: [wallPos[0] + inward[0] * d + alongV[0] * offsetAlong, y, wallPos[2] + inward[2] * d + alongV[2] * offsetAlong],
    dir: addDir(wallDir, 2),
  };
}

interface GatePos { span: WallSpan; t: number }

/** 入口の対面の壁（無ければ側壁）に n 枚の扉を等間隔で置く。足跡と入口だけから決めるので再生成で動かない */
function placeGates(rects: Rect[], entry: Socket | undefined, n: number): GatePos[] {
  const entryDir: Dir | -1 = entry && entry.type !== 'hole' ? entry.dir : -1;
  const opposite = entryDir === -1 ? -1 : addDir(entryDir, 2);
  const spans = wallSpans(rects).filter((sp) => sp.edge.dir !== entryDir && sp.a1 - sp.a0 >= DOOR_W + 2 * GATE_MARGIN);
  const rank = (d: Dir) => (d === opposite ? 0 : 1);
  spans.sort((a, b) => rank(a.edge.dir) - rank(b.edge.dir) || (b.a1 - b.a0) - (a.a1 - a.a0) || a.edge.dir - b.edge.dir || a.edge.coord - b.edge.coord || a.a0 - b.a0);
  const out: GatePos[] = [];
  let remaining = n;
  const step = DOOR_W + GATE_GAP;
  for (const sp of spans) {
    if (remaining <= 0) break;
    const lo = sp.a0 + GATE_MARGIN + DOOR_W / 2;
    const hi = sp.a1 - GATE_MARGIN - DOOR_W / 2;
    if (hi < lo) continue;
    let k = Math.min(remaining, Math.floor((hi - lo) / step + 1e-6) + 1);
    // 中央揃え・0.5 m グリッド・等間隔（step）。範囲を出る分は詰めるか枚数を減らす
    const mid = (sp.a0 + sp.a1) / 2;
    let start = Math.round((mid - ((k - 1) * step) / 2) * 2) / 2;
    if (start < lo) start = Math.ceil(lo * 2) / 2;
    while (k > 0 && start + (k - 1) * step > hi + 1e-6) k--;
    for (let i = 0; i < k; i++) {
      const t = start + i * step;
      // 入口と同じ壁は除外済みだが、hole 入口で全壁が候補のときの念のための重なり回避
      if (entry && entry.type !== 'hole' && entry.dir === sp.edge.dir && Math.abs(across(entry.dir, entry.pos[0], entry.pos[2]) - sp.edge.coord) < 0.05 && Math.abs(along(entry.dir, entry.pos[0], entry.pos[2]) - t) < (entry.width + DOOR_W) / 2 + 0.4) continue;
      out.push({ span: sp, t });
      remaining--;
    }
  }
  return out;
}

function socketWallPos(s: Socket): Vec3 {
  return [s.pos[0], 0, s.pos[2]];
}

/** 音量メーターの置き場所: 同じ壁の gate0 と gate1 の間 → gate0 の脇 → gate0 の上 */
function meterSign(gates: { socket: Socket; span: WallSpan }[], h: number): SignSpec | null {
  if (gates.length === 0) return null;
  const width = 1.2;
  const g0 = gates[0];
  const d = g0.socket.dir;
  const t0 = along(d, g0.socket.pos[0], g0.socket.pos[2]);
  const at = (t: number, y: number, w = width): SignSpec => {
    const pos: Vec3 = d === 0 || d === 2 ? [t, 0, g0.span.edge.coord] : [g0.span.edge.coord, 0, t];
    return wallSign(METER_SIGN_ID, pos, d, y, w, '▯▯▯▯▯▯▯▯', 'LEVEL', 'emissive');
  };
  const g1 = gates.find((g, i) => i > 0 && g.span === g0.span);
  if (g1) {
    const t1 = along(d, g1.socket.pos[0], g1.socket.pos[2]);
    const gap = Math.abs(t1 - t0) - DOOR_W;
    if (gap >= 1.0) return at((t0 + t1) / 2, 1.75, Math.min(width, gap - 0.2));
  }
  const side = DOOR_W / 2 + 0.2 + width / 2;
  if (t0 - side - width / 2 >= g0.span.a0 + 0.2) return at(t0 - side, 1.75);
  if (t0 + side + width / 2 <= g0.span.a1 - 0.2) return at(t0 + side, 1.75);
  return at(t0, Math.min(h - 0.2, DOOR_H + 0.75), 0.9);
}

function layoutGates(L: RoomLayout, p: GenParams, params: ModifierParams, rng: Rng): void {
  if (L.shellCount === undefined || L.footprint.length === 0) {
    console.warn(`[${NOISE_GATE_ID}] ${p.def.id}: shellCount / footprint が無いので 3 扉を組めない`);
    return;
  }
  const bands = parseBands(params.thresholds);
  const extraIds = new Set(p.extraSockets.map((x) => x.id));
  const entry = L.sockets.find((s) => s.id === 'entry');
  const h = L.height;
  // 生成器の出口扉と床穴を捨てる（進行は 3 扉に限定。穴は音の判定を迂回するので出さない）
  const kept = L.sockets.filter((s) => s.id === 'entry' || extraIds.has(s.id));
  L.holes = [];
  // 帯の並び（左 → 右）
  const order = rng.shuffle([...bands]);
  const placed = placeGates(L.footprint, entry, order.length);
  if (placed.length === 0) {
    console.warn(`[${NOISE_GATE_ID}] ${p.def.id}: 扉を置ける壁が無い`);
    return;
  }
  const sockets: Socket[] = [...kept];
  const signs: SignSpec[] = [];
  const gates: { socket: Socket; span: WallSpan }[] = [];
  const signY = Math.min(h - 0.2, DOOR_H + 0.35);
  placed.forEach((g, i) => {
    const id = `${GATE_PREFIX}${i}`;
    const band = order[i];
    const s = socketOnSpan(id, 'door', g.span, g.t, DOOR_W, DOOR_H);
    if (p.removedSockets.includes(id)) return;
    sockets.push(s);
    gates.push({ socket: s, span: g.span });
    signs.push(wallSign(`${SIGN_PREFIX}${id}:${band}`, socketWallPos(s), s.dir, signY, 0.9, `${BAND_ICON[band]} ${BAND_LABEL[band]}`, BAND_BARS[band], 'plate'));
  });
  const meter = meterSign(gates, h);
  if (meter) signs.push(meter);
  L.sockets = sockets;

  // 外殻を組み直す（床穴なし。hole 入口なら天井穴）
  const ceilingHoles: AABB[] = entry && entry.type === 'hole' ? [aabbFromCenter(entry.pos[0], h + 0.1, entry.pos[2], HOLE_SIZE / 2, 0.2, HOLE_SIZE / 2)] : [];
  const shell: Box[] = [];
  buildShell(shell, L.footprint, h, L.sockets, { floor: L.palette.floor, wall: L.palette.wall, ceiling: L.palette.ceiling, floorHoles: [], ceilingHoles });
  L.boxes.splice(0, L.shellCount, ...shell);
  L.shellCount = shell.length;
  L.signs = [...(L.signs ?? []), ...signs];
  if (entry && entry.type !== 'hole' && gates.length > 0) {
    const g = gates[Math.floor(gates.length / 2)].socket;
    L.path = [[entry.pos[0], 0, entry.pos[2]], [g.pos[0], 0, g.pos[2]]];
  }
  clearDoorways(L, L.sockets, L.shellCount);
}

// ---------------------------------------------------------------- runtime

type MoveRank = 'still' | 'walk' | 'dash' | 'jump';

interface RoomRuntime {
  lastPos: Vec3 | null;
  prevVy: number;
  /** 疑似音量（ctx.audio が無いときの代替） */
  pseudo: number;
  level: number;
  band: Band;
  pending: Band;
  pendingSince: number;
  /** 前回の update からの canOpen 呼び出し回数（ヒント 1 回 + 操作 1 回 = 2 で「操作」。ctx.interacting が来ない環境向けの代替判定） */
  canOpenCalls: number;
  /** Game が canOpen に ctx.interacting を渡してきたことがある（以後は回数の代替判定を使わない） */
  interactingSeen: boolean;
  /** 前回の update から「操作」の canOpen があった */
  interacted: boolean;
  meterAt: number;
  meterText: string;
}

const runtime = new Map<string, RoomRuntime>();
function rtOf(roomId: string): RoomRuntime {
  let r = runtime.get(roomId);
  if (!r) {
    r = { lastPos: null, prevVy: 0, pseudo: 0, level: 0, band: 'still', pending: 'still', pendingSince: 0, canOpenCalls: 0, interactingSeen: false, interacted: false, meterAt: 0, meterText: '' };
    runtime.set(roomId, r);
  }
  return r;
}

/** マイクの要求状態（セッション内のみ。localStorage には保存しない） */
const mic = { requested: false, active: false, giveUp: false };

function requestMic(ctx: RuntimeContext): void {
  if (mic.requested || mic.giveUp || !ctx.audio) return;
  mic.requested = true;
  const audio = ctx.audio;
  audio.requestMic().then(
    (ok) => {
      mic.active = ok;
      if (!ok) {
        mic.giveUp = true;
        ctx.hud.hint('マイクは使えない。足音の大きさで判定する');
      } else {
        ctx.hud.hint('マイクが有効になった。声の大きさで扉が選べる');
      }
    },
    () => {
      mic.giveUp = true;
      mic.active = false;
    },
  );
}

function releaseMic(ctx: RuntimeContext): void {
  if (!mic.active) return;
  ctx.audio?.loudness.releaseMic();
  mic.active = false;
  mic.requested = false;
}

function quantize(level: number, levels: [number, number]): Band {
  return level >= levels[1] ? 'dash' : level >= levels[0] ? 'walk' : 'still';
}

function levelsOf(params: ModifierParams): [number, number] {
  const v = params.levels;
  if (Array.isArray(v) && v.length >= 2 && typeof v[0] === 'number' && typeof v[1] === 'number') {
    const a = Math.min(Math.max(0.02, v[0]), 0.98);
    return [a, Math.min(Math.max(a + 0.02, v[1]), 0.99)];
  }
  return [0.22, 0.55];
}

function meterText(level: number, band: Band): string {
  const n = Math.max(0, Math.min(8, Math.round(level * 8)));
  return `${'▮'.repeat(n)}${'▯'.repeat(8 - n)} ${BAND_LABEL[band]}`;
}

const NoiseGate: ModifierImpl = {
  id: NOISE_GATE_ID,
  defaults: { thresholds: ['still', 'walk', 'dash'], useMic: true, levels: [0.22, 0.55], holdSec: 0.4 },

  layout(L, p, params, rng) {
    layoutGates(L, p, params, rng);
  },

  onNodeCreated(node) {
    if (!node.state.modifierState) node.state.modifierState = {};
    if (!readState(node)) node.state.modifierState[NOISE_GATE_ID] = { bands: {} } satisfies NoiseGateState;
  },

  onConnect(ctx) {
    const bands = bandsOf(ctx.world.layoutFor(ctx.node));
    saveBands(ctx.node, bands);
    const band = bands[ctx.portal.socketId];
    if (!band) return;
    // 音量帯により接続先カテゴリ変更: 静 → 小部屋 / 歩 → 廊下 / 走 → 大きめの部屋型
    if (band === 'still') return { smallOnly: true };
    if (band === 'walk') return { prefer: ['corridor'] };
    return { prefer: ['room'] };
  },

  onEnter(ctx) {
    saveBands(ctx.node, bandsOf(ctx.layout));
    const rt = rtOf(ctx.node.roomId);
    rt.lastPos = null;
    rt.canOpenCalls = 0;
  },

  onExit(ctx) {
    releaseMic(ctx);
  },

  update(dt, ctx, params) {
    const rt = rtOf(ctx.node.roomId);
    // 直前のフレームで扉が「操作」された（Game の ctx.interacting。無い環境ではヒント + 操作で canOpen が 2 回）→ 初回だけマイクを要求
    const interacted = rt.interacted || (!rt.interactingSeen && rt.canOpenCalls >= 2);
    if (interacted && bool(params.useMic, true)) requestMic(ctx);
    rt.interacted = false;
    rt.canOpenCalls = 0;

    // 移動ランク（位置差分から。テレポートは無視）
    const pos: Vec3 = [ctx.player.pos[0], ctx.player.pos[1], ctx.player.pos[2]];
    let rank: MoveRank = 'still';
    let jumped = false;
    if (rt.lastPos && dt > 1e-4) {
      const dx = pos[0] - rt.lastPos[0];
      const dz = pos[2] - rt.lastPos[2];
      const dy = pos[1] - rt.lastPos[1];
      const dist = Math.hypot(dx, dy, dz);
      if (dist < 6) {
        const hs = Math.hypot(dx, dz) / dt;
        const vy = dy / dt;
        rank = hs < 0.3 ? 'still' : hs < 4.25 ? 'walk' : 'dash';
        if (vy > 1.0 && rank !== 'dash') rank = 'jump';
        if (rt.prevVy < -2.0 && vy > -0.5) jumped = true;
        rt.prevVy = vy;
      } else {
        rt.prevVy = 0;
      }
    }
    rt.lastPos = pos;

    // 音量（マイク or 移動代替）。ctx.audio が無い環境では同じ規則の疑似音量
    let level: number;
    if (ctx.audio) {
      level = ctx.audio.loudnessLevel(rank, jumped);
    } else {
      const base = rank === 'dash' ? 0.7 : rank === 'walk' ? 0.35 : rank === 'jump' ? 0.5 : 0;
      rt.pseudo = Math.max(0, rt.pseudo - dt * 1.5);
      if (jumped) rt.pseudo = 1;
      rt.pseudo = Math.max(rt.pseudo, base);
      level = rt.pseudo;
    }
    rt.level = level;

    // 帯: 上がる方向は即時、下がる方向は holdSec 保持
    const nb = quantize(level, levelsOf(params));
    if (nb !== rt.pending) {
      rt.pending = nb;
      rt.pendingSince = ctx.now;
    }
    if (BAND_RANK[nb] > BAND_RANK[rt.band]) rt.band = nb;
    else if (nb !== rt.band && ctx.now - rt.pendingSince >= Math.max(0, num(params.holdSec, 0.4))) rt.band = nb;

    // メーター（Tier 別レート）
    if (ctx.built) {
      const hz = ctx.tier.id === 'low' ? 4 : 10;
      if (ctx.now - rt.meterAt >= 1 / hz) {
        rt.meterAt = ctx.now;
        const text = meterText(level, rt.band);
        if (text !== rt.meterText) {
          rt.meterText = text;
          ctx.built.updateSign(METER_SIGN_ID, text, mic.active ? 'MIC' : 'LEVEL');
        }
      }
    }
  },

  canOpen(portal, ctx): CanOpenResult | void {
    if (!isGateSocket(portal.socketId)) return;
    const rt = rtOf(ctx.node.roomId);
    rt.canOpenCalls++;
    if (ctx.interacting !== undefined) rt.interactingSeen = true;
    if (ctx.interacting) rt.interacted = true;
    const need = bandFor(ctx, portal.socketId);
    if (!need) return;
    if (rt.band === need) return { ok: true };
    return { ok: false, hint: `この扉は音に反応しない… いまの音は「${BAND_LABEL[rt.band]}」だ` };
  },
};

export default NoiseGate;
