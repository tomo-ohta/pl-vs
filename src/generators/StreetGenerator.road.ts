/** RoadGraph（L15 屋内高速道路）。StreetGrid 派生の「暗いトンネル型ジャンクション」。
 *
 *  - 本線: 幅 12 m（片側 3.5 m 車線 + 2.5 m 路肩）× 長さ 70〜22 m（variant 0 = 最大）。中央分離帯（ソリッド 0.6 m × 高 0.9 m、両端 3 m は開けて回り込める）。
 *  - 分岐: 本線の側面から直交する T 字ランプ 1〜3 本（矩形連結。共有辺は footprint が自動で開く）。
 *    そのうち 1 本（variant 0〜3）は「立体ランプ」: 段 0.15 × 0.6 m の斜路で 3.6 m 上がり、踊り場の端の外壁に上階の出口ソケット
 *    （type 'ramp'、pos[1] = 3.6）を置く。歩いて全出口へ到達できる。上階の開口が天井に収まるよう部屋の高さは 6.8 m。
 *  - 出口: 本線の両端（左右の車線に 1 本ずつ）と各分岐の末端。すべて type 'ramp'（WorldManager が ramp Adapter → 部屋 を挟む既存フロー）。
 *  - 車線: 車線ごとに zones kind 'lane'（AABB + 進行ベクトル。端壁の 3 m 手前で切る）。速度は ExternalForce(conveyor) の params。
 *    左側の車線が入口から奥へ（+z）、右側が入口へ戻る（-z）。入口は左車線の側に置き、入った直後に壁へ押し戻されないようにする。
 *  - 見た目: floorAsphalt + 白線（破線）・路肩の実線、防音壁パネル、ガードレール、天井のナトリウム灯列（sodiumLight + LightSpec）、
 *    案内標識（L.signs 緑地の銘板）、路肩に停まった車。偽空は使わない（ceilingDark）。
 *  - Hole 落下先: 天井穴入口は本線の 30 % 点（左車線）に開く。床穴は出さない（車線上の穴は危険）。 */
import type { Socket, Vec3 } from '../core/types';
import { aabbFromCenter, type AABB } from '../core/aabb';
import { buildShell, footprintAABB, rect, type Rect } from './footprint';
import { clearDoorways, dropRemovedHole, labelAtEntry, makeEntry } from './common';
import { box, emptyLayout, snap, WALL_T, WIDE_W, type Box, type GenParams, type Palette, type RoomLayout, type Zone } from './layout';
import { car, railing, roadLine, stepRun } from './StreetGenerator.facade';

const LENGTHS = [70, 56, 44, 36, 28, 22];
const RW = 12.0;
const H = 6.8;
const FLOOR = 3.6;
const RAMP_W = 6.0;
const RAMP_OPEN_H = 3.4;
/** 上階（y = 3.6）の出口の開口高さ。3.6 + 2.8 < 天井 6.8 */
const UPPER_OPEN_H = 2.8;
const SODIUM = 0xffa860;

interface Branch {
  rect: Rect;
  /** +1 = 本線の東側（x > 0）、-1 = 西側 */
  side: 1 | -1;
  /** 立体ランプ（末端で 3.6 m 上がる） */
  flyover: boolean;
  z0: number;
  z1: number;
}

export function generateRoadGraph(p: GenParams): RoomLayout {
  const { rng, palette } = p;
  const vr = rng.fork(`v${p.variant}`);
  const len = p.mainRect ? p.mainRect.z1 - p.mainRect.z0 : LENGTHS[Math.min(p.variant, LENGTHS.length - 1)];
  const main = p.mainRect ? rect(p.mainRect.x0, p.mainRect.z0, p.mainRect.x1, p.mainRect.z1) : rect(-RW / 2, 0, RW / 2, len);
  const rw = main.x1 - main.x0;
  const h = H;
  const L = emptyLayout(palette);
  const pal: Palette = { ...palette, floor: 'floorAsphalt', wall: 'wallConcrete', ceiling: 'ceilingDark', door: 'doorMetal', light: 'sodiumLight', lightColor: SODIUM, lightIntensity: 1.1, ambient: 0x3a3630, fog: 0x0e0c0a };
  L.palette = pal;

  // ---- 分岐（T 字ランプ）。長さに応じて 1〜3 本。variant 0〜3 は 1 本を立体ランプにする
  const rects: Rect[] = [main];
  const branches: Branch[] = [];
  const nBranch = len >= 56 ? 3 : len >= 36 ? 2 : 1;
  const wantFlyover = p.variant <= 3 && !p.mainRect;
  const zSlots: number[] = [];
  for (let i = 0; i < nBranch; i++) zSlots.push(snap(main.z0 + len * ((i + 1) / (nBranch + 1)) + vr.float(-2, 2)));
  const flyIdx = wantFlyover ? vr.int(0, nBranch - 1) : -1;
  let lastSide: 1 | -1 = vr.pick([1, -1] as const);
  for (let i = 0; i < nBranch; i++) {
    const flyover = i === flyIdx;
    // 隣の分岐と同じ側に続けない（交互）
    const side: 1 | -1 = i === 0 ? lastSide : (-lastSide as 1 | -1);
    lastSide = side;
    const bl = flyover ? 2.0 + 14.4 + 3.0 : snap(vr.float(10, 16));
    const z0 = Math.max(main.z0 + 4, Math.min(main.z1 - 4 - RAMP_W, zSlots[i] - RAMP_W / 2));
    const z1 = z0 + RAMP_W;
    const r = side > 0 ? rect(main.x1, z0, main.x1 + bl, z1) : rect(main.x0 - bl, z0, main.x0, z1);
    rects.push(r);
    branches.push({ rect: r, side, flyover, z0, z1 });
  }
  L.footprint = rects;
  L.height = h;
  L.bounds = footprintAABB(rects, h);
  L.chunkSize = 32;
  // 歩ける階: 地上 + 立体ランプの上階（あれば）。地図の levelSpan に使う
  L.levels = branches.some((b) => b.flyover) ? 2 : 1;

  // ---- 入口（南端。左車線 x = -2 側）。ramp 型の開口は高さを 3.4 に抑える
  const { entry, ceilingHole } = makeEntry(p, main, snap(main.x0 + rw * 0.25), h);
  if (entry.type !== 'door' && entry.type !== 'hole') entry.height = Math.min(entry.height, RAMP_OPEN_H);
  let sockets: Socket[] = [entry, ...p.extraSockets];

  // ---- 出口: 本線北端（右車線 + 左車線）、各分岐の末端（立体ランプは y = 3.6）
  const exitsWanted = Math.max(2, p.exits);
  const cands: Socket[] = [];
  cands.push({ id: 'rampN0', type: 'ramp', pos: [snap(main.x1 - rw * 0.25), 0, main.z1], dir: 0, width: WIDE_W, height: RAMP_OPEN_H });
  branches.forEach((b, i) => {
    const zc = snap((b.z0 + b.z1) / 2);
    const y = b.flyover ? FLOOR : 0;
    const pos: Vec3 = b.side > 0 ? [b.rect.x1, y, zc] : [b.rect.x0, y, zc];
    cands.push({ id: `ramp${i}`, type: 'ramp', pos, dir: b.side > 0 ? 1 : 3, width: WIDE_W, height: b.flyover ? UPPER_OPEN_H : RAMP_OPEN_H });
  });
  cands.push({ id: 'rampN1', type: 'ramp', pos: [snap(main.x0 + rw * 0.25), 0, main.z1], dir: 0, width: WIDE_W, height: RAMP_OPEN_H });
  if (entry.type === 'hole') cands.push({ id: 'rampS0', type: 'ramp', pos: [snap(main.x1 - rw * 0.25), 0, main.z0], dir: 2, width: WIDE_W, height: RAMP_OPEN_H });
  // 立体ランプの出口は必ず入れる。残りは候補順（本線端 → 分岐 → 予備）
  const fly = cands.filter((s) => s.pos[1] > 0);
  const rest = cands.filter((s) => s.pos[1] === 0);
  const chosen = [...fly, ...rest.slice(0, Math.max(0, Math.max(exitsWanted, 3) - fly.length))];
  sockets.push(...chosen);
  sockets = sockets.filter((s) => !p.removedSockets.includes(s.id));
  L.sockets = sockets;
  dropRemovedHole(L, p);
  sockets = L.sockets;

  // ---- 外殻
  buildShell(L.boxes, rects, h, sockets, { floor: pal.floor, wall: pal.wall, ceiling: pal.ceiling, floorHoles: [], ceilingHoles: ceilingHole ? [ceilingHole] : [] });
  L.shellCount = L.boxes.length;
  const shellCount = L.shellCount;
  const B = L.boxes;

  // ---- 着地点の目印
  let landing: AABB | null = null;
  if (ceilingHole) {
    const cx = (ceilingHole.min[0] + ceilingHole.max[0]) / 2;
    const cz = (ceilingHole.min[2] + ceilingHole.max[2]) / 2;
    landing = aabbFromCenter(cx, 0, cz, 1.4, 1, 1.4); // 床に目印の箔は置かない（床材が変わったように見えるため）
  }

  // ---- 本線の路面標示と中央分離帯
  const cx = (main.x0 + main.x1) / 2;
  const laneIn = 0.35; // 分離帯から車線まで
  const laneOut = laneIn + 3.5; // 車線の外縁（ここから壁までが路肩）
  roadLine(B, main.z0 + 0.4, main.z1 - 0.4, cx - laneOut, true, 0.15); // 路肩の実線
  roadLine(B, main.z0 + 0.4, main.z1 - 0.4, cx + laneOut, true, 0.15);
  roadLine(B, main.z0 + 1.0, main.z1 - 1.0, cx - laneIn - 0.3, true, 0.12, 'wallWhite', 3.0); // 分離帯脇の破線
  roadLine(B, main.z0 + 1.0, main.z1 - 1.0, cx + laneIn + 0.3, true, 0.12, 'wallWhite', 3.0);
  // 立体ランプの箱は clearDoorways（上階の開口の前を空ける）の後で足す
  const deferred: Box[] = [];
  // 中央分離帯（両端 3 m は開ける。天井穴の着地点にも掛けない）
  const medianGap = (z: number) => landing !== null && z > landing.min[2] - 1 && z < landing.max[2] + 1;
  for (let z = main.z0 + 3; z < main.z1 - 3; z += 3) {
    const z1 = Math.min(main.z1 - 3, z + 3);
    if (medianGap(z) || medianGap(z1)) continue;
    B.push(box([cx - 0.3, 0, z], [cx + 0.3, 0.9, z1], 'floorConcrete'));
  }
  // 分離帯の上の反射板（黄）
  for (let z = main.z0 + 4; z < main.z1 - 3; z += 6) B.push(box([cx - 0.06, 0.9, z], [cx + 0.06, 1.15, z + 0.12], 'yellowLine', false));

  // ---- 車線ゾーン（kind 'lane'。左 = +z、右 = -z。端壁の 3 m 手前で切り、分岐の口の前は途切れさせない）
  const zones: Zone[] = [];
  const zl0 = main.z0 + 3;
  const zl1 = main.z1 - 3;
  zones.push({ kind: 'lane', aabb: { min: [cx - laneOut, 0, zl0], max: [cx - laneIn, 1.2, zl1] }, vector: [0, 0, 1], params: { lane: 0, side: 'left' } });
  zones.push({ kind: 'lane', aabb: { min: [cx + laneIn, 0, zl0], max: [cx + laneOut, 1.2, zl1] }, vector: [0, 0, -1], params: { lane: 1, side: 'right' } });

  // ---- 防音壁パネルとガードレール（本線の両側。分岐の口は開ける）
  const wallPanels = (x: number, normal: 1 | -1, z0: number, z1: number) => {
    for (let z = z0; z < z1 - 0.5; z += 4.0) {
      const zb = Math.min(z1, z + 3.9);
      const lo = normal > 0 ? x + 0.005 : x - 0.005 - 0.06;
      B.push(box([lo, 0, z], [lo + 0.06, 4.0, zb], 'wallDark', false));
      B.push(box([lo - (normal > 0 ? 0 : 0.02), 4.0, z], [lo + 0.06 + (normal > 0 ? 0.02 : 0), 4.15, zb], 'metal', false));
    }
  };
  const openZ = (side: 1 | -1) => branches.filter((b) => b.side === side).map((b) => [b.z0, b.z1] as [number, number]);
  const runs = (z0: number, z1: number, gaps: [number, number][]): [number, number][] => {
    const out: [number, number][] = [];
    let cur = z0;
    for (const [a, b] of gaps.sort((p1, p2) => p1[0] - p2[0])) {
      if (a > cur + 0.5) out.push([cur, a]);
      cur = Math.max(cur, b);
    }
    if (z1 > cur + 0.5) out.push([cur, z1]);
    return out;
  };
  const socketGaps = (dir: 1 | 3): [number, number][] => sockets.filter((s) => s.dir === dir && s.type !== 'hole').map((s) => [s.pos[2] - s.width / 2 - 0.5, s.pos[2] + s.width / 2 + 0.5]);
  for (const [a, b] of runs(main.z0 + 0.3, main.z1 - 0.3, [...openZ(1), ...socketGaps(1)])) {
    wallPanels(main.x1 - WALL_T, -1, a, b);
    railing(B, [main.x1 - WALL_T - 0.25, 0, a + 0.2], [main.x1 - WALL_T - 0.25, 0, b - 0.2], 0.75);
  }
  for (const [a, b] of runs(main.z0 + 0.3, main.z1 - 0.3, [...openZ(-1), ...socketGaps(3)])) {
    wallPanels(main.x0 + WALL_T, 1, a, b);
    railing(B, [main.x0 + WALL_T + 0.25, 0, a + 0.2], [main.x0 + WALL_T + 0.25, 0, b - 0.2], 0.75);
  }

  // ---- 天井灯列（ナトリウム）: 本線 8 m ごと 2 列、分岐 6 m ごと
  let li = 0;
  for (let z = main.z0 + 4; z < main.z1 - 2; z += 8) {
    for (const x of [cx - 2.1, cx + 2.1]) {
      B.push(box([x - 0.6, h - 0.25, z - 0.15], [x + 0.6, h - 0.05, z + 0.15], 'sodiumLight', false));
      B.push(box([x - 0.7, h - 0.3, z - 0.2], [x + 0.7, h - 0.25, z + 0.2], 'metal', false));
      if (li++ % 2 === 0) L.lights.push({ pos: [x, h - 0.9, z], color: SODIUM, intensity: 1.1, distance: 20 });
    }
  }

  // ---- 分岐ランプ
  branches.forEach((b, i) => {
    const r = b.rect;
    const zc = (b.z0 + b.z1) / 2;
    const inward = b.side > 0 ? r.x0 : r.x1; // 本線側の端
    const dirSign = b.side; // 分岐が伸びる向き
    // 車線: 分岐は 1 車線。ゾーンは口から 2 m 〜 末端 3 m 手前（立体ランプの斜路には置かない）
    if (!b.flyover) {
      const a = inward + dirSign * 2;
      const bEnd = (b.side > 0 ? r.x1 : r.x0) - dirSign * 3;
      zones.push({ kind: 'lane', aabb: { min: [Math.min(a, bEnd), 0, zc - 1.6], max: [Math.max(a, bEnd), 1.2, zc + 1.6] }, vector: [dirSign, 0, 0], params: { lane: 2 + i, speed: 3.0, side: 'branch' } });
      roadLine(B, inward + dirSign * 1.0, (b.side > 0 ? r.x1 : r.x0) - dirSign * 1.0, zc, false, 0.12, 'wallWhite', 3.0);
    }
    roadLine(B, inward + dirSign * 0.4, (b.side > 0 ? r.x1 : r.x0) - dirSign * 0.4, b.z0 + 0.6, false, 0.15);
    roadLine(B, inward + dirSign * 0.4, (b.side > 0 ? r.x1 : r.x0) - dirSign * 0.4, b.z1 - 0.6, false, 0.15);
    // 天井灯
    for (let x = inward + dirSign * 3; b.side > 0 ? x < r.x1 - 1 : x > r.x0 + 1; x += dirSign * 6) {
      B.push(box([x - 0.15, h - 0.25, zc - 0.6], [x + 0.15, h - 0.05, zc + 0.6], 'sodiumLight', false));
      if (li++ % 2 === 0) L.lights.push({ pos: [x, h - 0.9, zc], color: SODIUM, intensity: 0.9, distance: 16 });
    }
    // 立体ランプ: 口から 2 m 平坦 → 14.4 m の斜路（24 段 × 0.15） → 3 m の踊り場（y 3.6）
    if (b.flyover) {
      const s0 = inward + dirSign * 2.0;
      const s1 = s0 + dirSign * 14.4;
      const end = b.side > 0 ? r.x1 : r.x0;
      stepRun(deferred, { x0: Math.min(s0, s1), x1: Math.max(s0, s1), z0: r.z0 + WALL_T, z1: r.z1 - WALL_T, alongZ: false, rise: FLOOR, stepH: 0.15, mat: 'floorAsphalt', reverse: b.side < 0 });
      // 踊り場（末端の外壁まで。上階ソケットの直前なので clearDoorways の後で足す）
      deferred.push(box([Math.min(s1, end), -0.2, r.z0 + WALL_T], [Math.max(s1, end), FLOOR, r.z1 - WALL_T], 'floorAsphalt'));
      // 斜路の両側の手すり（踊り場の高さで水平）
      railing(B, [s0, 0.02, r.z0 + WALL_T + 0.2], [s1, 0.02, r.z0 + WALL_T + 0.2], 1.0);
      railing(B, [s0, 0.02, r.z1 - WALL_T - 0.2], [s1, 0.02, r.z1 - WALL_T - 0.2], 1.0);
      const endIn = end - dirSign * 0.35; // 外壁の内側に収める
      railing(B, [Math.min(s1, endIn), FLOOR, r.z0 + WALL_T + 0.2], [Math.max(s1, endIn), FLOOR, r.z0 + WALL_T + 0.2], 1.0);
      railing(B, [Math.min(s1, endIn), FLOOR, r.z1 - WALL_T - 0.2], [Math.max(s1, endIn), FLOOR, r.z1 - WALL_T - 0.2], 1.0);
      // 斜路の中央線（上り）: 段の上面には置かず、踊り場だけ
      roadLine(B, Math.min(s1, end) + 0.3, Math.max(s1, end) - 0.3, zc, false, 0.12, 'yellowLine');
      // 斜路上の照明
      L.lights.push({ pos: [(s0 + s1) / 2, FLOOR + 1.8, zc], color: SODIUM, intensity: 0.8, distance: 14 });
    }
    // 案内標識（分岐の口の手前、本線の車線から見える向き）: 緑地の銘板 + ガントリー
    const gz0 = b.z0 - 2.5;
    B.push(box([cx - laneOut - 0.6, 5.2, gz0 - 0.15], [cx + laneOut + 0.6, 5.4, gz0 + 0.15], 'metal', false));
    B.push(box([cx - laneOut - 0.6, 0, gz0 - 0.15], [cx - laneOut - 0.4, 5.4, gz0 + 0.15], 'metal', false));
    B.push(box([cx + laneOut + 0.4, 0, gz0 - 0.15], [cx + laneOut + 0.6, 5.4, gz0 + 0.15], 'metal', false));
    L.signs ??= [];
    if (L.signs.length < 40) {
      const arrow = b.side > 0 ? '→' : '←';
      L.signs.push({ id: `exitSign${i}`, text: `EXIT ${i + 1} ${arrow}`, sub: b.flyover ? 'RAMP ↑ 3.6 m' : `${Math.round(len - (zc - main.z0))} m`, pos: [b.side > 0 ? cx + 2.1 : cx - 2.1, 4.4, gz0], dir: 2, width: 3.0, kind: 'plate', color: 0xffffff, background: 0x1f6b3a });
    }
  });
  // 本線の行き先標識（北端手前）
  L.signs ??= [];
  L.signs.push({ text: 'THROUGH TRAFFIC ↑', sub: `${Math.round(len)} m`, pos: [cx - 2.1, 4.6, main.z1 - 6], dir: 2, width: 3.2, kind: 'plate', color: 0xffffff, background: 0x1f6b3a });
  L.signs.push({ text: '非常口 / EXIT', pos: [cx + 2.1, 3.0, main.z0 + WALL_T + 0.1], dir: 0, width: 2.0, kind: 'emissive', color: 0xffffff, background: 0x1f6b3a });

  // ---- 路肩の停車車両（車線ゾーンの外。ソケット・穴・分岐口から離す）
  const nCars = Math.min(5, Math.max(1, Math.round(len / 18)));
  for (let i = 0; i < nCars; i++) {
    const side = vr.pick([1, -1] as const);
    const x = side > 0 ? main.x1 - WALL_T - 1.2 : main.x0 + WALL_T + 1.2;
    const z = snap(vr.float(main.z0 + 6, main.z1 - 6));
    if (sockets.some((s) => Math.hypot(s.pos[0] - x, s.pos[2] - z) < 5)) continue;
    if (branches.some((b) => b.side === side && z > b.z0 - 4 && z < b.z1 + 4)) continue;
    if (landing && Math.hypot((landing.min[0] + landing.max[0]) / 2 - x, (landing.min[2] + landing.max[2]) / 2 - z) < 4) continue;
    car(B, x, z, true, vr);
  }

  L.zones = zones;
  clearDoorways(L, sockets, shellCount); // L.boxes を差し替えるので以降は L.boxes を使う
  L.boxes.push(...deferred);
  // 進行軸: 入口 → 本線北端
  const north = sockets.find((s) => s.id === 'rampN0' || s.id === 'rampN1') ?? sockets.find((s) => s.id !== 'entry' && s.type === 'ramp');
  L.path = north ? [entry.pos, [entry.pos[0], 0, (main.z0 + main.z1) / 2], north.pos] : [entry.pos, [entry.pos[0], 0, main.z1 - 2]];
  labelAtEntry(L, entry, 3.0, p.label);
  return L;
}

