/**
 * 歩いて届くか（近似）: 入口の前から床の高さの各扉の前まで、プレイヤーの当たり判定（半幅 0.35 m の四角柱）で歩けるか。
 *
 * - 格子（既定 0.1 m。セル数が多い部屋は粗くする）のセル中心にプレイヤーの中心を置けるかを見て、4 近傍で塗りつぶす。
 * - 高さ: セルごとに「立つ高さ」を持つ（床 0 + プレイヤーの四角に掛かる接地した箱の上面の最大）。隣のセルへは 0.35 m
 *   （PLAYER.step）まで登れ、降りるのは何 m でもよい。浮いた箱（底が 0.05 m より上）は低い物から順に、立つ高さ + 0.35 m
 *   以下なら踏み台、立つ高さに底が乗っていれば台の続き、しゃがみの高さ 0.85 m（PLAYER.crouchHeight）より下に底があれば
 *   塞がり、それより上なら頭上として無視する。桟橋（縁 0.3 → デッキ 0.6）や段床は登れ、机・棚は越えられない。
 * - 箱 = シェルを含むソリッド箱（床板を除く）と solid な instances。草木は通り抜けるので除く。外周は footprint の内側 0.15 m（壁厚）。
 * - instances の当たり判定は RoomBuilder と同じく pos.y を底とする（pos.y .. pos.y + size.y × scale、yaw を含む AABB）。
 * - 見ない物: 跳び乗り・乗り物・可動壁（dynamics）・床より下の窪み・高い位置の扉（sill > 0.35 / pos.y > 0.5）。
 *   ロールする部屋（E03）は箱が描画時に回るので扱わない（null）。
 * 使う所: 奇妙さ（oddity）が扉への道を塞いだら取り消す判定と、tools/seam-stats.mjs の --reach。
 */
import type { Socket } from '../core/types';
import type { MatId, RoomLayout } from './layout';

const PASSABLE: ReadonlySet<MatId> = new Set<MatId>(['plant', 'plantLeaf', 'grass', 'wheat']);
/** プレイヤーの半幅（PLAYER.radius） */
const R = 0.35;
/** 段差として登れる高さ（PLAYER.step） */
const STEP = 0.35;
/** しゃがんでくぐれる高さ（PLAYER.crouchHeight） */
const CROUCH = 0.85;
/** 外壁の厚み（footprint の内側） */
const WALL = 0.15;
const MAX_CELLS = 600_000;
/** これより低い所に底がある箱は床に置かれている（接地） */
const GROUNDED = 0.05;
/** 接地した箱の上面がこれより高ければ、上に立つことは考えずに塞がりとする（壁・柱・棚） */
const TOO_TALL = 2.5;
/** 塗りの作業領域（呼ぶたびに確保しない） */
let STATE = new Uint8Array(0);
let QUEUE = new Int32Array(0);
let GROUND = new Float32Array(0);

export interface ReachResult {
  /** 見た扉（entry 以外・床の高さ） */
  doors: Socket[];
  /** 入口から届かない扉の id */
  blocked: string[];
  /** 格子の間隔（m） */
  grid: number;
}

/** 外周の格子（footprint だけで決まる）。奇妙さの取り消し判定は同じ部屋で何度も呼ぶので、足跡の座標ごとに数個だけ覚えておく */
const WALL_CACHE = new Map<string, Uint8Array>();

/**
 * 外周で塞がるセル: プレイヤーの四角を壁厚だけ広げた四角の角・辺の中点 9 点が、それぞれ足跡（矩形の和）に入っていなければ塞がる
 * （複数の矩形のつなぎ目は壁ではないので、矩形ごとに縮めずに点ごとに見る）。足跡はセル中心で一度だけ塗る
 */
function wallMask(L: RoomLayout, bx0: number, bz0: number, G: number, nx: number, nz: number): Uint8Array {
  const key = `${G}|${L.footprint.map((r) => `${r.x0},${r.z0},${r.x1},${r.z1}`).join(';')}`;
  const hit = WALL_CACHE.get(key);
  if (hit) return hit;
  const ins = new Uint8Array(nx * nz);
  for (const r of L.footprint) {
    const i0 = Math.max(0, Math.ceil((r.x0 - bx0) / G - 0.5)), i1 = Math.min(nx - 1, Math.floor((r.x1 - bx0) / G - 0.5));
    const k0 = Math.max(0, Math.ceil((r.z0 - bz0) / G - 0.5)), k1 = Math.min(nz - 1, Math.floor((r.z1 - bz0) / G - 0.5));
    for (let k = k0; k <= k1; k++) ins.fill(1, k * nx + i0, k * nx + i1 + 1);
  }
  const d = Math.ceil((R + WALL) / G - 1e-9);
  const out = new Uint8Array(nx * nz);
  for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
    const c = k * nx + i;
    const ok = i >= d && k >= d && i < nx - d && k < nz - d
      && ins[c] && ins[c + d] && ins[c - d] && ins[c + d * nx] && ins[c - d * nx]
      && ins[c + d * nx + d] && ins[c + d * nx - d] && ins[c - d * nx + d] && ins[c - d * nx - d];
    if (!ok) out[c] = 1;
  }
  if (WALL_CACHE.size >= 8) WALL_CACHE.delete(WALL_CACHE.keys().next().value as string);
  WALL_CACHE.set(key, out);
  return out;
}

/** 床の高さの扉か（段差を越えずに歩いて入れる開口） */
function floorDoor(s: Socket): boolean {
  return s.type === 'door' && s.pos[1] < 0.5 && (s.sill ?? 0) <= STEP;
}

/**
 * 入口から床の高さの各扉の前まで歩けるか。入口が無い・床の高さに無い・footprint が無い・ロールする部屋は null。
 * grid を省くと 0.1 m（セル数が MAX_CELLS を超える部屋は粗くする）。only を渡すとその id の扉だけを見る（全部に届いた所で塗りを止める）
 */
export function reachDoors(L: RoomLayout, grid?: number, only?: readonly string[]): ReachResult | null {
  const entry = L.sockets.find((s) => s.id === 'entry');
  if (!entry || !floorDoor(entry) || !L.footprint.length || L.roll) return null;
  const doors = L.sockets.filter((s) => s !== entry && floorDoor(s) && (!only || only.includes(s.id)));
  if (!doors.length) return { doors, blocked: [], grid: grid ?? 0.1 };
  const bx0 = Math.min(...L.footprint.map((r) => r.x0)), bz0 = Math.min(...L.footprint.map((r) => r.z0));
  const bx1 = Math.max(...L.footprint.map((r) => r.x1)), bz1 = Math.max(...L.footprint.map((r) => r.z1));
  let G = grid ?? 0.1;
  while (((bx1 - bx0) / G) * ((bz1 - bz0) / G) > MAX_CELLS) G *= 1.5;
  const nx = Math.ceil((bx1 - bx0) / G), nz = Math.ceil((bz1 - bz0) / G);
  // 0 = 空き / 1 = 塞がる / 2 = 届いた。外周の帯（壁厚 + 半幅）は必ず塞がるので、塗りで添字が格子の外に出ない
  const n = nx * nz;
  if (STATE.length < n) { STATE = new Uint8Array(n); QUEUE = new Int32Array(n); }
  const blocked = STATE, q = QUEUE;
  blocked.set(wallMask(L, bx0, bz0, G, nx, nz));
  if (GROUND.length < n) GROUND = new Float32Array(n);
  const ground = GROUND;
  ground.fill(0, 0, n);
  // プレイヤーの中心がこの範囲にあると四角が箱に掛かるセル（Minkowski 和。セル中心が開区間 (x0 - R, x1 + R) に入る添字）
  const span = (a0: number, a1: number, o: number, m: number): [number, number] =>
    [Math.max(0, Math.floor((a0 - R - o) / G - 0.5) + 1), Math.min(m - 1, Math.ceil((a1 + R - o) / G - 0.5) - 1)];
  // mode 0: 立つ高さを y1 まで上げる / 1: 塞ぐ / 2: 浮いた箱（踏み台・台の続き・くぐれない・頭上）
  const cover = (x0: number, z0: number, x1: number, z1: number, mode: 0 | 1 | 2, y0: number, y1: number) => {
    const [i0, i1] = span(x0, x1, bx0, nx), [k0, k1] = span(z0, z1, bz0, nz);
    for (let k = k0; k <= k1; k++) {
      for (let c = k * nx + i0, e = k * nx + i1; c <= e; c++) {
        if (mode === 0) { if (ground[c] < y1) ground[c] = y1; continue; }
        if (mode === 1) { blocked[c] = 1; continue; }
        const g = ground[c];
        if (y1 <= g + STEP || y0 <= g + GROUNDED) { if (g < y1) ground[c] = y1; } // 踏み台 / 台の続き
        else if (y0 < g + CROUCH) blocked[c] = 1; // くぐれない
      }
    }
  };
  // 当たる物: [x0, z0, x1, z1, 底, 上面]。接地した物は上面で立つ高さを上げ、浮いた物は後で低い順に見る。
  // 立つ高さは TOO_TALL を超えないので、底が TOO_TALL + CROUCH より上の物（天井・上階の床板）はどこでも頭上
  const floating: [number, number, number, number, number, number][] = [];
  const add = (x0: number, z0: number, x1: number, z1: number, y0: number, y1: number) => {
    if (y1 <= 0.02 || y0 >= TOO_TALL + CROUCH) return; // 床板・頭上
    if (y0 > GROUNDED) { floating.push([x0, z0, x1, z1, y0, y1]); return; }
    cover(x0, z0, x1, z1, y1 > TOO_TALL ? 1 : 0, y0, y1);
  };
  for (const b of L.boxes) if (b.solid && !PASSABLE.has(b.mat)) add(b.min[0], b.min[2], b.max[0], b.max[2], b.min[1], b.max[1]);
  for (const sp of L.instances ?? []) {
    if (!sp.solid || PASSABLE.has(sp.mat)) continue;
    for (const t of sp.transforms) {
      const s = t.scale ?? 1;
      const c = Math.abs(Math.cos(t.yaw)), sn = Math.abs(Math.sin(t.yaw));
      const hx = ((c * sp.size[0] + sn * sp.size[2]) / 2) * s, hz = ((sn * sp.size[0] + c * sp.size[2]) / 2) * s;
      add(t.pos[0] - hx, t.pos[2] - hz, t.pos[0] + hx, t.pos[2] + hz, t.pos[1], t.pos[1] + sp.size[1] * s);
    }
  }
  floating.sort((a, b) => a[4] - b[4]);
  for (const [x0, z0, x1, z1, y0, y1] of floating) cover(x0, z0, x1, z1, 2, y0, y1);
  // 扉の前（内側 0.9 m）に最も近い空きセル（1.0 m 以内）
  const reachR = Math.ceil(1.0 / G);
  const front = (s: Socket): number => {
    const d = [[0, 1], [1, 0], [0, -1], [-1, 0]][s.dir] ?? [0, 0];
    const pi = Math.floor((s.pos[0] - d[0] * 0.9 - bx0) / G), pk = Math.floor((s.pos[2] - d[1] * 0.9 - bz0) / G);
    for (let r = 0; r <= reachR; r++) for (let dk = -r; dk <= r; dk++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dk)) !== r) continue;
      const i = pi + di, k = pk + dk;
      if (i >= 0 && k >= 0 && i < nx && k < nz && !blocked[k * nx + i]) return k * nx + i;
    }
    return -1;
  };
  const st = front(entry);
  if (st < 0) return { doors, blocked: doors.map((s) => s.id), grid: G };
  const targets = doors.map(front);
  // 扉の前のセルは 3（空き + 目印）。全部に届いたら塗りを止める
  let left = 0;
  for (const f of targets) if (f >= 0 && blocked[f] === 0) { blocked[f] = 3; left++; }
  let qn = 0;
  if (blocked[st] === 3) left--;
  blocked[st] = 2; q[qn++] = st;
  let top = 0;
  const visit = (j: number) => {
    const v = blocked[j];
    if (v === 1 || v === 2 || ground[j] > top + STEP + 1e-3) return;
    if (v === 3) left--;
    blocked[j] = 2; q[qn++] = j;
  };
  for (let h = 0; h < qn && left > 0; h++) {
    const c = q[h];
    top = ground[c];
    visit(c - 1); visit(c + 1); visit(c - nx); visit(c + nx);
  }
  LAST = { nx, nz, G, bx0, bz0, targets, start: st };
  return { doors, blocked: doors.filter((_, j) => targets[j] < 0 || blocked[targets[j]] !== 2).map((s) => s.id), grid: G };
}

let LAST: { nx: number; nz: number; G: number; bx0: number; bz0: number; targets: number[]; start: number } | null = null;

/** 調査用: 直前の reachDoors の格子（state 0 空き / 1 塞がる / 2 届いた / 3 届かなかった扉の前、ground 立つ高さ） */
export function lastReachGrid(): { nx: number; nz: number; G: number; bx0: number; bz0: number; targets: number[]; start: number; state: Uint8Array; ground: Float32Array } | null {
  if (!LAST) return null;
  const n = LAST.nx * LAST.nz;
  return { ...LAST, state: STATE.slice(0, n), ground: GROUND.slice(0, n) };
}
