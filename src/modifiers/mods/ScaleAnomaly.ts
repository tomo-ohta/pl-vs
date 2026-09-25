/**
 * ScaleAnomaly — 縮尺異常（R13 巨大児童遊園 ×3 / L17 無限団地 ×1.5 / M12 巨大Common ×4 / R16 縮尺異常オフィス perProp 0.5〜2 / L12 設備大聖堂 perProp 3〜8）。
 * params: mode('room' | 'perProp') / scale（room）/ min, max（perProp）/ smallDoor('crawl' で R16 の小型扉）。
 *
 * Three.js の Group スケールではなく layout フック（決定論の post-pass）で RoomLayout を書き換える。配置 fits() と Portal 接続に効き、
 * 「入室後に部屋が変わらない」不変条件を保つ（build / update は持たない）。
 *
 * mode 'room': footprint 矩形・height・全箱・照明（位置・distance、intensity は s² で明るさを保つ）・ゾーン・モニュメント等を原点基準で ×s し、
 *   外殻を捨てて「拡大後の矩形 + 通常寸法のソケット（位置だけ ×s）」で buildShell を再実行する → 巨大な空間に普通の扉。
 *   - 直結用の extraSockets は WorldManager が拡大後の座標で作るので位置を変えない（socketSig の安定性）。
 *   - 床穴は出さない（拡大後の穴は真下の部屋の天井穴 1.4 m と合わない）。hole 入口は天井穴 1.4 m を拡大後の位置に切り直す。
 *   - 入口ラベルは人が読む寸法のまま、ソケットからの相対位置を保って置く。
 *   - p.mainRect（grow-to-fill）は拡大後座標で保存される → 生成器が読むとさらに ×s になるが、WorldManager が fits() で検証して
 *     入らなければ取り消すので破綻はしない（成長が効きにくいだけ。生成器側で 1/s する変更は共有ファイルなので行わない）。
 * mode 'perProp': shellCount 以降の内装を、同じ xz 範囲を持つ箱をひとまとめ（机 + 天板など）にして [min, max] 倍。
 *   見えない当たり判定（kind 'colliderOnly'）は拡大しない（見た目の MonumentSpec・instances は拡大されないため。見えない壁になる）。
 *   床置きの物は、拡大前に入口から各出口まで歩けた道（walkPaths、0.5 m 格子の最短路）に掛かるなら倍率を下げる（元の大きさなら必ず空く）。
 *   床置きは底面中心基準（高さは天井 -0.3 でクランプ）、天井付きは xz のみ、それ以外は中心基準。
 *   壁からの余白は「0.9 m と元の余白の小さい方」を保ち、収まらないときは倍率を落として通路を確保する（捨てずにクランプ）。
 *   smallDoor='crawl'（R16）: 出口ソケット 1 つを CRAWL_DOOR_W×CRAWL_DOOR_H（0.7×1.2）crawl=true にして外殻を組み直す
 *   （WorldManager が crawl Adapter を挟む近道）。選ぶ id は removedSockets を含む「元の出口集合」から決めるので、扉が壁に戻されても他の扉が変わらない。
 *   巨大扉: 空いた壁面に 2.0 m × (h-0.15) の偽扉箱（doorWood + trim。開かない、コライダあり）を 1〜2 枚。
 * 両モード共通: 最後に clearDoorways で扉前を空ける。Tier 差なし（描画量は元の箱数と同じ）。
 */
import { aabbFromCenter, type AABB } from '../../core/aabb';
import { dirVec, type Socket, type Vec3 } from '../../core/types';
import type { Rng } from '../../core/rng';
import { clearDoorways } from '../../generators/common';
import { buildShell, footprintAABB, inRect, pickSpanPosition, wallSpans, type Rect } from '../../generators/footprint';
import { box, CRAWL_DOOR_H, CRAWL_DOOR_W, HOLE_SIZE, WALL_T, type Box, type RoomLayout } from '../../generators/layout';
import { particleList } from '../../generators/particles';
import type { GenParams } from '../../generators/layout';
import type { ModifierImpl, ModifierParams } from '../types';
import { num, str } from '../util';

const mul = (v: Vec3, s: number): Vec3 => [v[0] * s, v[1] * s, v[2] * s];
const scaleAABB = (a: AABB, s: number): AABB => ({ min: mul(a.min, s), max: mul(a.max, s) });

/** 外殻を組み直す（床穴なし。hole 入口なら天井穴 1.4 m） */
function rebuildShell(L: RoomLayout, rects: Rect[], h: number): number {
  const entry = L.sockets.find((s) => s.id === 'entry');
  const ceilingHoles: AABB[] = entry && entry.type === 'hole' ? [aabbFromCenter(entry.pos[0], h + 0.1, entry.pos[2], HOLE_SIZE / 2, 0.2, HOLE_SIZE / 2)] : [];
  const shell: Box[] = [];
  buildShell(shell, rects, h, L.sockets, { floor: L.palette.floor, wall: L.palette.wall, ceiling: L.palette.ceiling, floorHoles: L.holes, ceilingHoles });
  L.boxes.splice(0, L.shellCount ?? 0, ...shell);
  L.shellCount = shell.length;
  return shell.length;
}

// ---------------------------------------------------------------- mode 'room'

function scaleRoom(L: RoomLayout, p: GenParams, s: number): void {
  if (Math.abs(s - 1) < 1e-6) return;
  if (L.shellCount === undefined || L.footprint.length === 0) {
    console.warn(`[ScaleAnomaly] ${p.def.id}: shellCount / footprint が無いので room モードを適用できない`);
    return;
  }
  const extraIds = new Set(p.extraSockets.map((x) => x.id));
  const h0 = L.height;
  const h = h0 * s;

  // 足跡・高さ・bounds
  L.footprint = L.footprint.map((r) => ({ x0: r.x0 * s, z0: r.z0 * s, x1: r.x1 * s, z1: r.z1 * s }));
  L.height = h;
  L.bounds = footprintAABB(L.footprint, h);

  // ソケット: 寸法はそのまま、位置だけ ×s。床穴は出さない。直結用の extraSockets は拡大後座標で来るので触らない
  const original = L.sockets.map((x) => ({ ...x, pos: [...x.pos] as Vec3 }));
  L.sockets = L.sockets.filter((x) => !(x.type === 'hole' && x.id !== 'entry'));
  for (const x of L.sockets) {
    if (extraIds.has(x.id)) continue;
    if (x.type === 'hole') x.pos = [x.pos[0] * s, h + 0.2, x.pos[2] * s];
    else x.pos = mul(x.pos, s);
  }
  L.holes = [];

  // 箱（外殻は後で捨てる）・照明
  L.boxes = L.boxes.map((b) => ({ ...b, min: mul(b.min, s), max: mul(b.max, s) }));
  for (const l of L.lights) {
    l.pos = mul(l.pos, s);
    l.distance *= s;
    l.intensity *= s * s;
  }
  // ラベル: 人が読む寸法のまま、最も近い元ソケットからの相対位置を保つ
  for (const lb of L.labels) {
    let best: Socket | null = null;
    let bd = Infinity;
    for (const x of original) {
      if (extraIds.has(x.id)) continue;
      const d = Math.hypot(x.pos[0] - lb.pos[0], x.pos[2] - lb.pos[2]);
      if (d < bd) { bd = d; best = x; }
    }
    if (best && bd < 3) lb.pos = [best.pos[0] * s + (lb.pos[0] - best.pos[0]), lb.pos[1], best.pos[2] * s + (lb.pos[2] - best.pos[2])];
    else lb.pos = mul(lb.pos, s);
  }
  // v1.3 任意フィールド（あれば ×s）
  if (L.signs) for (const sg of L.signs) { sg.pos = mul(sg.pos, s); sg.width *= s; }
  if (L.zones) for (const z of L.zones) z.aabb = scaleAABB(z.aabb, s);
  if (L.instances) for (const inst of L.instances) { inst.size = mul(inst.size, s); for (const t of inst.transforms) t.pos = mul(t.pos, s); }
  // モニュメント（奇妙さの巨大モニュメント・乱れの物）も ×s。当たり判定（colliderOnly の箱）は上で ×s 済みなので、見た目も揃えないと見えない壁になる
  if (L.monuments) for (const m of L.monuments) {
    m.pos = mul(m.pos, s);
    m.parts = m.parts.map((pt) => ({ ...pt, pos: mul(pt.pos, s), size: mul(pt.size, s), path: pt.path?.map((v) => mul(v, s)) }));
  }
  for (const ps of particleList(L)) if (ps.aabb) ps.aabb = scaleAABB(ps.aabb, s);
  if (L.decals) for (const d of L.decals) { d.pos = mul(d.pos, s); d.size = [d.size[0] * s, d.size[1] * s]; }
  if (L.dynamics) for (const d of L.dynamics) { d.box = { ...d.box, min: mul(d.box.min, s), max: mul(d.box.max, s) }; d.motion.amplitude *= d.motion.kind === 'rotate' ? 1 : s; }
  if (L.path) L.path = L.path.map((v) => mul(v, s));
  if (L.mirrors) for (const m of L.mirrors) { m.pos = mul(m.pos, s); m.size = [m.size[0] * s, m.size[1] * s]; }
  if (L.rides) for (const r of L.rides) r.path = r.path.map((v) => mul(v, s));
  L.elevators = L.elevators.map((e) => ({ ...e, volume: scaleAABB(e.volume, s), button: mul(e.button, s) }));

  // 外殻を通常寸法の開口で組み直す
  const shellCount = rebuildShell(L, L.footprint, h);
  clearDoorways(L, L.sockets, shellCount);
}

// ---------------------------------------------------------------- mode 'perProp'

/** 歩ける道の格子（m）・人の半径（m）・当たる高さの帯（m） */
const WALK_G = 0.25;
const WALK_R = 0.36;
const WALK_Y0 = 0.35;
const WALK_Y1 = 0.85;
const VEGETATION = new Set(['plant', 'plantLeaf', 'grass', 'wheat']);

/**
 * 拡大前の配置で、入口から各出口の前まで歩ける最短の道（格子 WALK_G の中心点の列。重複なし）。
 * 当たる物: シェルを含むソリッドな箱（草木を除く。RoomBuilder と同じ）・当たる instances・足跡の外。到達できない出口は道を作らない
 */
function walkPaths(L: RoomLayout): [number, number][] {
  const entry = L.sockets.find((x) => x.id === 'entry');
  if (!entry || !L.footprint.length) return [];
  const bx0 = Math.min(...L.footprint.map((r) => r.x0)), bz0 = Math.min(...L.footprint.map((r) => r.z0));
  const bx1 = Math.max(...L.footprint.map((r) => r.x1)), bz1 = Math.max(...L.footprint.map((r) => r.z1));
  const nx = Math.ceil((bx1 - bx0) / WALK_G), nz = Math.ceil((bz1 - bz0) / WALK_G);
  const blocked = new Uint8Array(nx * nz);
  const cellX = (i: number) => bx0 + (i + 0.5) * WALK_G, cellZ = (k: number) => bz0 + (k + 0.5) * WALK_G;
  // 足跡の外・壁際（複数の矩形のつなぎ目は壁ではないので、人の周り 8 点がどれかの矩形に入れば良い）
  const inU = (x: number, z: number) => L.footprint.some((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);
  // 壁から: 壁厚 + 後で付ける巨大な偽扉の張り出し（6 cm）+ 余裕 + 人の半径
  const dd = WALL_T + 0.1 + WALK_R, dg = dd * Math.SQRT1_2;
  const ring: [number, number][] = [[0, 0], [dd, 0], [-dd, 0], [0, dd], [0, -dd], [dg, dg], [dg, -dg], [-dg, dg], [-dg, -dg]];
  for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
    const x = cellX(i), z = cellZ(k);
    if (!ring.every(([a, b]) => inU(x + a, z + b))) blocked[k * nx + i] = 1;
  }
  const mark = (x0: number, z0: number, x1: number, z1: number) => {
    const i0 = Math.max(0, Math.floor((x0 - WALK_R - bx0) / WALK_G)), i1 = Math.min(nx - 1, Math.floor((x1 + WALK_R - bx0) / WALK_G));
    const k0 = Math.max(0, Math.floor((z0 - WALK_R - bz0) / WALK_G)), k1 = Math.min(nz - 1, Math.floor((z1 + WALK_R - bz0) / WALK_G));
    for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) {
      const x = cellX(i), z = cellZ(k);
      if (x > x0 - WALK_R && x < x1 + WALK_R && z > z0 - WALK_R && z < z1 + WALK_R) blocked[k * nx + i] = 1;
    }
  };
  // シェル側の箱も見る（Mega の側廊の制御室など、内側の間仕切りはシェルに入っている。見ないと道が壁を突き抜け、実際に歩く道を守れない）。
  // 床・天井は高さの帯で外れる
  for (const b of L.boxes) if (b.solid && !VEGETATION.has(b.mat) && b.min[1] < WALK_Y1 && b.max[1] > WALK_Y0) mark(b.min[0], b.min[2], b.max[0], b.max[2]);
  for (const sp of L.instances ?? []) if (sp.solid && !VEGETATION.has(sp.mat)) for (const t of sp.transforms) {
    if (t.pos[1] > WALK_Y1) continue;
    const sc = t.scale ?? 1, c = Math.abs(Math.cos(t.yaw)), sn = Math.abs(Math.sin(t.yaw));
    const hx = ((c * sp.size[0] + sn * sp.size[2]) / 2) * sc, hz = ((sn * sp.size[0] + c * sp.size[2]) / 2) * sc;
    mark(t.pos[0] - hx, t.pos[2] - hz, t.pos[0] + hx, t.pos[2] + hz);
  }
  // 扉の 0.9 m 内側の点に近い、空いた格子
  const front = (x: Socket): number => {
    const d = dirVec(x.dir); // 扉の外向き（dir 0 = +Z）。0.9 m 内側の点から探す
    const px = x.pos[0] - d[0] * 0.9, pz = x.pos[2] - d[2] * 0.9;
    const pi = Math.floor((px - bx0) / WALK_G), pk = Math.floor((pz - bz0) / WALK_G);
    for (let r = 0; r < 6; r++) for (let dk = -r; dk <= r; dk++) for (let di = -r; di <= r; di++) {
      const i = pi + di, k = pk + dk;
      if (i >= 0 && k >= 0 && i < nx && k < nz && !blocked[k * nx + i]) return k * nx + i;
    }
    return -1;
  };
  const start = front(entry);
  if (start < 0) return [];
  const prev = new Int32Array(nx * nz).fill(-2);
  prev[start] = -1;
  const q = [start];
  for (let h = 0; h < q.length; h++) {
    const c = q[h], i = c % nx, k = (c - i) / nx;
    for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = k + dk;
      if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
      const id = b * nx + a;
      if (blocked[id] || prev[id] !== -2) continue;
      prev[id] = c;
      q.push(id);
    }
  }
  const cells = new Set<number>();
  for (const x of L.sockets) {
    if (x === entry || x.type === 'hole') continue;
    let c = front(x);
    if (c < 0 || prev[c] === -2) continue; // 拡大前から行けない出口は守りようがない
    while (c >= 0) { cells.add(c); c = prev[c]; }
  }
  return [...cells].map((c) => { const i = c % nx; return [cellX(i), cellZ((c - i) / nx)] as [number, number]; });
}

/** 見た目を持たない当たり判定の箱（見た目は MonumentSpec / instances 側にあり、perProp では拡大されない） */
const isColliderOnly = (b: Box): boolean => b.kind === 'colliderOnly';

/**
 * 同じ xz 範囲の箱をひとまとめにする（机 + 天板、什器 + 上面など）。家具の部品の組（propGroup: 椅子・ベンチ・ロッカー・自販機など）は組ごとに
 * まとめる（部品ごとに倍率が違うと、描画側が組から描き直す家具と当たり判定がずれて見えない壁が残る。L12 で椅子の背もたれが 1.8 m の見えない板になっていた）
 */
function groupByFootprint(boxes: Box[]): Box[][] {
  const map = new Map<string, Box[]>();
  const order: Box[][] = [];
  for (const b of boxes) {
    const key = b.propGroup ? `g:${b.propGroup}` : [b.min[0], b.min[2], b.max[0], b.max[2]].map((v) => v.toFixed(2)).join(',');
    let g = map.get(key);
    if (!g) { g = []; map.set(key, g); order.push(g); }
    g.push(b);
  }
  return order;
}

function rectOf(rects: Rect[], x: number, z: number): Rect {
  for (const r of rects) if (inRect(r, x, z, -0.05)) return r;
  let best = rects[0];
  let bd = Infinity;
  for (const r of rects) {
    const d = Math.hypot((r.x0 + r.x1) / 2 - x, (r.z0 + r.z1) / 2 - z);
    if (d < bd) { bd = d; best = r; }
  }
  return best;
}

function scalePerProp(L: RoomLayout, p: GenParams, params: ModifierParams, rng: Rng): void {
  if (L.shellCount === undefined || L.footprint.length === 0) {
    console.warn(`[ScaleAnomaly] ${p.def.id}: shellCount / footprint が無いので perProp モードを適用できない`);
    return;
  }
  const fmin = Math.max(0.1, num(params.min, 0.5));
  const fmax = Math.max(fmin, num(params.max, 2.0));
  const h = L.height;
  const shellCount = L.shellCount;
  const pr = rng.fork('props');
  // 拡大前に入口から各出口まで歩ける道（格子の中心点）。拡大した床置きの物はこの道に掛からないよう倍率を下げる
  const path = walkPaths(L);
  const groups = groupByFootprint(L.boxes.slice(shellCount));
  const out: Box[] = [];
  for (const g of groups) {
    const gmin: Vec3 = [Math.min(...g.map((b) => b.min[0])), Math.min(...g.map((b) => b.min[1])), Math.min(...g.map((b) => b.min[2]))];
    const gmax: Vec3 = [Math.max(...g.map((b) => b.max[0])), Math.max(...g.map((b) => b.max[1])), Math.max(...g.map((b) => b.max[2]))];
    // 天井の非ソリッド箔（パネル灯）は縮尺の対象外（照明は部屋の寸法に合わせたまま）
    if (gmin[1] > h - 0.3 && g.every((b) => !b.solid)) { out.push(...g); continue; }
    const f = pr.float(fmin, fmax);
    // 見えない当たり判定（colliderOnly: モニュメント・乱れの物・並べて描く物の外接箱）は拡大しない。見た目の側（MonumentSpec・instances）は
    // perProp で拡大されないので、箱だけ 3〜8 倍になると見えない壁になる（L12 設備大聖堂で巨大モニュメントの判定が 33 m 四方に膨らんでいた）。
    // 倍率の乱数は消費してから飛ばす（他の家具の倍率を変えない）
    if (g.every(isColliderOnly)) { out.push(...g); continue; }
    const cx = (gmin[0] + gmax[0]) / 2;
    const cz = (gmin[2] + gmax[2]) / 2;
    const r = rectOf(L.footprint, cx, cz);
    // 壁からの余白: 0.9 m と元の余白の小さい方を保つ（通路の確保。壁沿いの什器は壁沿いのまま）
    const inset = WALL_T + 0.02;
    const lim = {
      x0: r.x0 + Math.min(0.9, Math.max(inset, gmin[0] - r.x0)),
      x1: r.x1 - Math.min(0.9, Math.max(inset, r.x1 - gmax[0])),
      z0: r.z0 + Math.min(0.9, Math.max(inset, gmin[2] - r.z0)),
      z1: r.z1 - Math.min(0.9, Math.max(inset, r.z1 - gmax[2])),
    };
    const w = gmax[0] - gmin[0];
    const d = gmax[2] - gmin[2];
    const fitXZ = Math.min((lim.x1 - lim.x0) / Math.max(0.05, w), (lim.z1 - lim.z0) / Math.max(0.05, d));
    // 中心基準で xz を伸縮し、余白の限界を越えた分は内側へずらす
    const rectFor = (k: number): [number, number, number, number] => {
      const fxz = Math.max(0.1, Math.min(k, fitXZ));
      let x0 = cx - (w / 2) * fxz, x1 = cx + (w / 2) * fxz, z0 = cz - (d / 2) * fxz, z1 = cz + (d / 2) * fxz;
      if (x0 < lim.x0) { x1 += lim.x0 - x0; x0 = lim.x0; }
      if (x1 > lim.x1) { x0 -= x1 - lim.x1; x1 = lim.x1; }
      if (z0 < lim.z0) { z1 += lim.z0 - z0; z0 = lim.z0; }
      if (z1 > lim.z1) { z0 -= z1 - lim.z1; z1 = lim.z1; }
      return [x0, x1, z0, z1];
    };
    // 拡大前に歩けた道（入口→各出口。walkPaths）を新たにふさぐ床置きの物は倍率を下げる（道は拡大前の配置で空いているので、元の大きさなら必ず空く）。
    // L12 で拡大した設備どうしがすき間を埋めて 40 m 級の帯になり、壁際の出口へ行けなくなっていた
    const onFloor = gmin[1] < 0.05;
    let fu = f;
    // 床置きだけでなく、拡大で歩く高さ（WALK_Y0〜WALK_Y1）に降りてくる物も見る（中心基準の拡大で下端が下がる）
    if (fu > 1 && path.length && g.some((b) => b.solid) && (onFloor || gmin[1] - (gmax[1] - gmin[1]) * (fu - 1) / 2 < WALK_Y1)) {
      const blocks = (q: [number, number, number, number]) => path.some(([x, z]) => x > q[0] - WALK_R && x < q[1] + WALK_R && z > q[2] - WALK_R && z < q[3] + WALK_R);
      while (fu > 1 && blocks(rectFor(fu))) fu = fu * 0.8 < 1.05 ? 1 : fu * 0.8;
    }
    // 縦: 床置きは底面基準（天井 -0.3 でクランプ）、天井付きは動かさない、それ以外は中心基準
    const onCeiling = gmax[1] > h - 0.3;
    const gh = gmax[1] - gmin[1];
    let mapY: (y: number) => number;
    if (onFloor && onCeiling) mapY = (y) => y;
    else if (onCeiling) mapY = (y) => y;
    else if (onFloor) {
      const fy = Math.min(fu, Math.max(0.1, (h - 0.3) / Math.max(0.05, gh)));
      mapY = (y) => y * fy;
    } else {
      const cy = (gmin[1] + gmax[1]) / 2;
      const fy = Math.min(fu, Math.max(0.1, (h - 0.15 - cy) / Math.max(0.05, gh / 2)), Math.max(0.1, (cy - 0.05) / Math.max(0.05, gh / 2)));
      mapY = (y) => cy + (y - cy) * fy;
    }
    const [nx0, nx1, nz0, nz1] = rectFor(fu);
    const mapX = (x: number) => (w < 1e-6 ? nx0 : nx0 + ((x - gmin[0]) / w) * (nx1 - nx0));
    const mapZ = (z: number) => (d < 1e-6 ? nz0 : nz0 + ((z - gmin[2]) / d) * (nz1 - nz0));
    for (const b of g) {
      if (isColliderOnly(b)) { out.push(b); continue; }
      out.push({ ...b, min: [mapX(b.min[0]), mapY(b.min[1]), mapZ(b.min[2])], max: [mapX(b.max[0]), mapY(b.max[1]), mapZ(b.max[2])] });
    }
  }
  L.boxes = [...L.boxes.slice(0, shellCount), ...out];

  // R16: 小型扉 = 出口ソケット 1 つを 0.7×1.2 の crawl 開口に。選択は「元の出口集合」（removedSockets を含む）から決める
  let shellDirty = false;
  if (str(params.smallDoor, 'none') === 'crawl') {
    const extraIds = new Set(p.extraSockets.map((x) => x.id));
    const isExit = (id: string) => id !== 'entry' && id !== 'hole' && !extraIds.has(id) && !/^x\d+$/.test(id);
    const pool = new Set<string>();
    for (const s of L.sockets) if (s.type === 'door' && isExit(s.id)) pool.add(s.id);
    for (const id of p.removedSockets) if (isExit(id)) pool.add(id);
    const ids = [...pool].sort();
    if (ids.length > 0) {
      const chosen = rng.fork('smallDoor').pick(ids);
      const s = L.sockets.find((x) => x.id === chosen && x.type === 'door');
      if (s) {
        s.width = CRAWL_DOOR_W;
        s.height = CRAWL_DOOR_H;
        s.crawl = true;
        delete s.sill;
        shellDirty = true;
      }
    }
  }

  // 巨大扉: 空いた壁面の偽扉（開かない。コライダあり）
  const gr = rng.fork('fakeDoors');
  const giantW = 2.0;
  const giantH = Math.min(h - 0.15, 4.5);
  const spans = wallSpans(L.footprint).filter((sp) => sp.a1 - sp.a0 >= giantW + 3.0);
  const want = spans.length === 0 ? 0 : Math.min(2, Math.max(1, Math.round(spans.length / 3)));
  const placedSockets: Socket[] = [...L.sockets];
  for (let i = 0; i < want && spans.length > 0; i++) {
    const sp = gr.pick(spans);
    const t = pickSpanPosition(sp, placedSockets, giantW, gr.next(), 1.2);
    if (t === null) continue;
    const e = sp.edge;
    const inset = WALL_T;
    const th = 0.06;
    const put = (t0: number, t1: number, y0: number, y1: number, depth0: number, depth1: number, mat: Box['mat'], solid: boolean) => {
      switch (e.dir) {
        case 0: L.boxes.push(box([t0, y0, e.coord - inset - depth1], [t1, y1, e.coord - inset - depth0], mat, solid)); break;
        case 2: L.boxes.push(box([t0, y0, e.coord + inset + depth0], [t1, y1, e.coord + inset + depth1], mat, solid)); break;
        case 1: L.boxes.push(box([e.coord - inset - depth1, y0, t0], [e.coord - inset - depth0, y1, t1], mat, solid)); break;
        default: L.boxes.push(box([e.coord + inset + depth0, y0, t0], [e.coord + inset + depth1, y1, t1], mat, solid)); break;
      }
    };
    put(t - giantW / 2, t + giantW / 2, 0, giantH, 0, th, L.palette.door, true);
    put(t - giantW / 2 - 0.12, t + giantW / 2 + 0.12, giantH, giantH + 0.15, 0, th + 0.03, 'trim', false);
    put(t - giantW / 2 - 0.12, t - giantW / 2, 0, giantH, 0, th + 0.03, 'trim', false);
    put(t + giantW / 2, t + giantW / 2 + 0.12, 0, giantH, 0, th + 0.03, 'trim', false);
    // ノブ（巨大扉に合わせて高い位置）
    put(t + giantW / 2 - 0.35, t + giantW / 2 - 0.2, giantH * 0.45, giantH * 0.45 + 0.12, th, th + 0.12, 'metal', false);
    // 以降の偽扉・扉前クリアの基準にダミーソケットとして登録（位置だけ）
    const pos: Vec3 = e.dir === 0 || e.dir === 2 ? [t, 0, e.coord] : [e.coord, 0, t];
    placedSockets.push({ id: `fake${i}`, type: 'door', pos, dir: e.dir, width: giantW, height: giantH });
  }

  if (shellDirty) rebuildShell(L, L.footprint, h);
  clearDoorways(L, L.sockets, L.shellCount ?? shellCount);
}

const ScaleAnomaly: ModifierImpl = {
  id: 'ScaleAnomaly',
  defaults: { mode: 'room', scale: 1.0, min: 0.5, max: 2.0, smallDoor: 'none' },

  layout(L, p, params, rng) {
    const mode = str(params.mode, 'room');
    if (mode === 'room') scaleRoom(L, p, Math.max(0.25, num(params.scale, 1)));
    else if (mode === 'perProp') scalePerProp(L, p, params, rng);
    else console.warn(`[ScaleAnomaly] ${p.def.id}: 未知の mode '${mode}'`);
  },
};

export default ScaleAnomaly;
