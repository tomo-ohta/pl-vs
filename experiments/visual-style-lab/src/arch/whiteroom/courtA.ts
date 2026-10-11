import type * as THREE from 'three';
import { Prop, type PropMats } from '../../props/kit.ts';
import { wrSink } from './props/mats.ts';
import type { Builder } from '../../scenes/Builder.ts';
import { stairs, wallWithHoles } from '../kit.ts';
import type { Doors } from './doors.ts';
import { bx, extrudeSection } from './geo.ts';
import { buildRoom, carve, dressWalk, roomBox, type RoomKit, type RoomSpec } from './interior.ts';
import { A } from './layout.ts';
import { fitWindow, type WallFrame } from './light.ts';
import type { Mats } from './mats.ts';
import { darkDoor, drain, planter, slabBench, trough } from './props/court.ts';

/**
 * A 回廊の中庭（参考画像 0）。目の高さ 1.5 m、北（-z）へ。数は参考画像の画素から ShiftCam で求めた（docs/stages/whiteroom.md）。
 * - 西の棟（左）: 南の端は回廊の高さ 3.6 m（z -8.8 まで）、そこから 2 階建てで屋根は奥へ上がり（-14 で 6.3 m・-26 で 9.4 m）、
 *   北の棟の手前で下がる（7.75 m）。1 階は中庭へ開いた回廊（開口の上端 3.6 m・奥行き 2.5 m）。2 階に細い縦長の窓。
 *   中は 門番の部屋・通り抜け（西の前庭へ）・階段の吹き抜け・集会室、2 階は図書室（西のバルコニーから C を見下ろす = 参考画像 2）
 * - 東の棟（右）: 3 階建て（9.9 m）。1 階は壁から 0.6 m 出た袖壁と、袖壁の前の面をつなぐ帯（ひさし 3.6〜3.9 m）。
 *   袖壁の手前の側に扉（2 つは教室・工房へ開く）。ひさしの影が壁の上の方と袖壁の面に斜めに落ちる
 * - 北の棟（奥）: 3 階建て（9.8 m）。1 階の西寄りが暗いロッジア（凹み 2.2 m・天井 3.66 m）で扉 3 つ（真ん中が食堂へ）。
 *   2 階に小さな窓 2 つ。西の端に西の棟の斜めの肩（控え壁）
 * - 南の門の棟（後ろ・平屋 5.5 m）: B へ抜ける門
 */

/** 東の棟の袖壁の手前の面の z（参考画像の画素から。手前の 5 つは同じ割り付けで足した） */
export const EAST_FINS = [5.8, 2.0, -1.8, -5.6, -9.4, -12.74, -15.4, -20.4, -24.0, -28.9];
/** 西の棟の回廊の開口 [手前の z, 奥の z] */
export const WEST_OPENINGS: [number, number][] = [
  [6.6, 2.2],
  [-0.8, -5.2],
  [-7.6, -11.5],
  [-12.9, -15.39],
  [-18.31, -21.07],
  [-23.77, -26.03],
];
/** 西の棟の 2 階の細い窓の z（参考画像の 5 つ + 手前） */
const WEST_SLITS = [2.0, -2.0, -6.0, -10.0, -14.0, -18.0, -21.2, -23.6, -26.3, -28.5];
const EAST_SLITS = [4.0, 0.5, -3.0, -6.5, -10.0, -13.5, -16.5, -19.5, -22.6, -25.4, -28.1];

/** 西の棟の平屋（南の端）と 2 階建ての境の z（床の影の幅が手前で 1.2 m・奥で 2.5 m に変わる所から） */
export const WEST_STEP = -8.8;
/** 西の棟の屋根の折れ線 [z, 高さ] */
export const WEST_PROFILE: [number, number][] = [
  [A.zS, A.soffit],
  [WEST_STEP, A.soffit],
  [WEST_STEP, 5.95],
  [-14, 6.3],
  [-26, 9.4],
  [A.zN, A.westLo],
];
export function westRoofAt(z: number): number {
  const prof = WEST_PROFILE;
  for (let i = 0; i < prof.length - 1; i++) {
    const [z0, h0] = prof[i];
    const [z1, h1] = prof[i + 1];
    if (z <= z0 && z >= z1 && z0 > z1) return h0 + ((z - z0) / (z1 - z0)) * (h1 - h0);
  }
  return A.soffit;
}

/** 西の棟の屋根の線を z0 → z1（z0 > z1）でたどる（折れ点を含む） */
function roofLine(z0: number, z1: number): [number, number][] {
  const pts: [number, number][] = [[z0, westRoofAt(z0)]];
  for (const [z, h] of WEST_PROFILE) if (z < z0 - 1e-4 && z > z1 + 1e-4) pts.push([z, h]);
  pts.push([z1, westRoofAt(z1)]);
  return pts;
}

/** 西の棟の屋根の下まで届く壁（x0..x1 の厚さ、z0 > z1、下端 yb）。屋根の線に沿った断面を押し出す */
function profileWall(b: Builder, mat: THREE.Material, x0: number, x1: number, z0: number, z1: number, yb: number, top?: number): void {
  const line = roofLine(z0, z1).map(([z, h]): [number, number] => [z, top !== undefined ? Math.min(h, top) : h]);
  if (line.every(([, h]) => h <= yb + 1e-3)) return;
  const poly: [number, number][] = [[z1, yb], [z0, yb], ...line];
  extrudeSection(b, mat, 'zy', poly, x0, x1, {});
  const hmax = Math.max(...line.map(([, h]) => h));
  b.ctx.colliders.add({ x: x0, y: yb, z: z1 }, { x: x1, y: hmax, z: z0 });
}

/** 西の棟の屋根の下まで届く内装の板（面 xFace に 1 cm。z0 > z1、下端 yb、屋根の下 0.37 m まで） */
function profilePlate(b: Builder, mat: THREE.Material, xFace: number, sign: number, z0: number, z1: number, yb: number, top?: number): void {
  const line = roofLine(z0, z1).map(([z, h]): [number, number] => [z, top !== undefined ? Math.min(h - 0.37, top) : h - 0.37]);
  if (line.every(([, h]) => h <= yb + 1e-3)) return;
  const x0 = sign > 0 ? xFace : xFace - 0.01;
  extrudeSection(b, mat, 'zy', [[z1, yb], [z0, yb], ...line], x0, x0 + 0.01, {});
}

/** 西の外の面の開口（z0 > z1、高さ y0..y1） */
interface ZHole {
  z0: number;
  z1: number;
  y0: number;
  y1: number;
}

/**
 * 西の棟の屋根の下まで届く面を、開口（扉・窓）を避けて z の区間ごとに組む。piece(z0, z1, yb, top) が 1 区間の 1 段を作る
 * （壁なら profileWall、内装の板なら profilePlate）
 */
function zPieces(z0: number, z1: number, holes: ZHole[], piece: (za: number, zb: number, yb: number, top?: number) => void, yMin = 0): void {
  const cuts = new Set<number>([z0, z1]);
  for (const h of holes) {
    if (h.z0 < z0 && h.z0 > z1) cuts.add(h.z0);
    if (h.z1 < z0 && h.z1 > z1) cuts.add(h.z1);
  }
  const zs = [...cuts].sort((a, b) => b - a);
  for (let i = 0; i < zs.length - 1; i++) {
    const za = zs[i];
    const zb = zs[i + 1];
    const zm = (za + zb) / 2;
    const hs = holes.filter((h) => h.z0 > zm && h.z1 < zm).sort((a, b) => a.y0 - b.y0);
    let y = yMin;
    for (const h of hs) {
      if (h.y0 > y + 1e-3) piece(za, zb, y, h.y0);
      y = Math.max(y, h.y1);
    }
    piece(za, zb, y);
  }
}

/** 階段の吹き抜けの西の窓（前庭に面する。階段に沿って上がる）: [中心の z, 下端, 上端]（幅 0.8 m） */
const STAIR_WINDOWS: [number, number, number][] = [
  [-8.4, 1.0, 2.7],
  [-11.5, 2.0, 3.7],
  [-14.5, 3.5, 5.2],
  [-17.2, 4.7, 6.3],
];

/** 写っていない所の部屋（間取り図にも使う） */
export const A_ROOMS: RoomSpec[] = [
  {
    id: 'A-porter',
    label: '門番の部屋',
    kind: 'porter',
    court: 'A',
    rect: [-14.0, 1.0, -8.1, 7.7],
    y0: 0,
    y1: 3.6,
    noCeiling: true,
    noFloor: true,
    skip: ['w', 'e', 'n'],
    doors: [
      { side: 'e', at: 4.4, w: 1.0, h: 2.1 },
      // 回廊への受付の小窓（カウンター）
      { side: 'e', at: 2.4, w: 1.2, h: 1.0, y0: 1.0, open: true },
    ],
    windows: [{ side: 'w', at: [2.6, 6.0], w: 1.8, y0: 0.6, y1: 3.1 }],
  },
  {
    id: 'A-pass',
    label: '通り抜けの間（西の前庭へ）',
    kind: 'passage',
    court: 'A',
    rect: [-14.0, -5.0, -8.1, 0.7],
    y0: 0,
    y1: 3.6,
    noCeiling: true,
    noFloor: true,
    skip: ['w', 'e', 'n'],
    doors: [
      { side: 'e', at: -3.0, w: 1.0, h: 2.1 },
      { side: 'w', at: -3.0, w: 1.2, h: 2.4 },
    ],
    windows: [
      { side: 'w', at: [-0.9], w: 1.2, y0: 0.6, y1: 3.0 },
      { side: 'w', at: [-4.45], w: 0.6, y0: 0.6, y1: 3.0 },
    ],
  },
  {
    id: 'A-chapter',
    label: '集会室',
    kind: 'chapter',
    court: 'A',
    rect: [-14.0, -30.6, -8.1, -19.3],
    y0: 0,
    y1: 4.65,
    noCeiling: true,
    noFloor: true,
    skip: ['w', 'e', 'n'],
    doors: [
      { side: 'e', at: -20.6, w: 1.0, h: 2.1 },
      { side: 'e', at: -24.9, w: 1.0, h: 2.1, locked: true },
    ],
    windows: [{ side: 'w', at: [-22.4, -25.3, -28.2], w: 1.9, y0: 0.6, y1: 4.1 }],
  },
  {
    id: 'A-library',
    label: '図書室（2 階）',
    kind: 'library',
    court: 'A',
    rect: [-14.0, -30.6, -5.6, -17.9],
    y0: 4.9,
    y1: 7.2,
    noCeiling: true,
    noFloor: true,
    skip: ['w', 'e', 'n'],
    open: ['s'],
    doors: [{ side: 'w', at: -20.0, w: 1.2, h: 2.1, open: true }],
    windows: [{ side: 'w', at: [-22.4, -25.3, -28.2], w: 1.6, y0: 0.35, y1: 2.2 }],
  },
  {
    id: 'A-refectory',
    label: '食堂',
    kind: 'refectory',
    court: 'A',
    rect: [-4.0, -40.4, 2.6, -33.4],
    y0: 0,
    y1: 3.4,
    outer: 'loggia',
    doors: [
      { side: 's', at: -3.89, w: 0.98, h: 2.12, locked: true, color: '#1f2d2a' },
      { side: 's', at: -1.22, w: 1.02, h: 2.12, color: '#1f2d2a' },
      { side: 's', at: 1.05, w: 1.06, h: 2.12, locked: true, color: '#1f2d2a' },
    ],
    // 北の壁の高い窓の列（北向き: 日は入らず、空の明るさ。外は 0.2 m の塊）
    windows: [{ side: 'n', at: [-2.9, -1.3, 0.3, 1.9], w: 1.0, y0: 0.9, y1: 3.0, blind: true }],
  },
  {
    id: 'A-class',
    label: '教室（東の棟）',
    kind: 'classroom',
    court: 'A',
    rect: [6.25, -17.0, 11.8, -13.1],
    y0: 0,
    y1: 3.6,
    doors: [{ side: 'w', at: -14.85, w: 0.92, h: 2.08 }],
    windows: [{ side: 'e', at: [-16.1, -14.0], w: 1.1, y0: 0.9, y1: 2.9, blind: true }],
  },
  {
    id: 'A-work',
    label: '工房（東の棟）',
    kind: 'workshop',
    court: 'A',
    rect: [6.25, -22.0, 11.8, -17.3],
    y0: 0,
    y1: 3.6,
    doors: [{ side: 'w', at: -19.85, w: 0.92, h: 2.08 }],
    windows: [{ side: 'e', at: [-21.0, -18.4], w: 1.1, y0: 0.9, y1: 2.9, blind: true }],
  },
];

/** 階段（西の棟の吹き抜け。1 階 → 2 階 4.9 m） */
export const A_STAIR = { x0: -13.9, x1: -12.3, zBottom: -10.0, rise: 4.9 };

export function buildCourtA(b: Builder, m: Mats, pm: PropMats, doors: Doors): void {
  const sink = wrSink(b);
  const at = (x: number, z: number, yaw: number, seed = 1, y = 0): Prop => Prop.at(sink, pm, [x, y, z], yaw, seed);
  const kit: RoomKit = { b, m, pm, doors, sink };
  const wall = m.get('A', 'wall');
  const floor = m.get('A', 'floor');
  const apron = m.get('A', 'apron');
  const loggia = m.get('A', 'loggia');
  const slot = m.get('A', 'slot');
  const fin = m.get('A', 'fin');
  const stain = m.get('A', 'stain', { brush: false });
  const stainW = m.get('A', 'stainW', { brush: false });
  const inFloor = m.get('A', 'inFloor', { brush: 'floor' });
  const zN = A.zN;
  const zS = A.zS;
  const xW = A.xW;
  const xE = A.xE; // 東の棟の壁の面（袖壁の前は 5.36）
  const finX = 5.36;
  const room = (id: string): RoomSpec => A_ROOMS.find((r) => r.id === id)!;

  // ---- 床 ----
  bx(b, floor, xW, -0.3, zN, xE, 0, -7.3, { collide: true });
  // 手前（南）の暗い帯の舗石（参考画像の下の帯。z > -7.3）
  bx(b, apron, xW, -0.3, -7.3, xE, 0, zS, { collide: true });
  // 西の回廊の床（0.5 m 角の敷石）
  bx(b, m.get('A', 'floorWalk'), A.westPorchBack, -0.3, zN, xW, 0, zS, { collide: true });
  // ロッジアの床・門の通路の床
  bx(b, floor, -4.19, -0.3, zN - A.loggia.depth, A.loggia.x1, 0, zN, { collide: true });
  bx(b, m.get('A', 'floorPass'), -1.0, -0.3, zS, 1.2, 0, zS + 6, { collide: true });
  // 西の棟の中の床（地面の高さ）
  bx(b, inFloor, -14.3, -0.3, zN, A.westPorchBack - 0.3, 0, zS, { collide: true });

  // ---- 北の棟 ----
  const L = A.loggia;
  const lx0 = -4.19; // 西の棟の肩の東の端（ロッジアはここから見える）
  bx(b, wall, -16, 0, zN - 10, lx0, A.northH, zN, { collide: true });
  bx(b, wall, L.x1, 0, zN - 10, 18, A.northH, zN, { collide: true });
  bx(b, wall, lx0, L.h, zN - 10, L.x1, A.northH, zN, { collide: true });
  // ロッジアの奥（食堂の部屋をくり抜く）・天井
  const ref = room('A-refectory');
  carve(b, loggia, [lx0, 0, zN - 10, L.x1, L.h, zN - L.depth - 0.3], [roomBox(ref)]);
  bx(b, loggia, lx0, L.h - 0.25, zN - L.depth, L.x1, L.h, zN, {});
  buildRoom(kit, ref);
  // 2 階の小さな窓（深い抱き）
  for (const [x0, x1] of [
    [-3.24, -2.74],
    [2.3, 2.8],
  ]) {
    bx(b, slot, x0, 5.69, zN - 0.45, x1, 6.69, zN + 0.005, {});
  }

  // ---- 東の棟 ----
  // 上の階の壁（ひさしの上）・1 階（教室・工房をくり抜く）
  bx(b, wall, xE, 3.9, zN, 16, A.eastH, zS, { collide: true });
  const eRooms = [room('A-class'), room('A-work')].map((r) => ({ ...r, outer: 'fin' }));
  // 1 階の壁（ひさしの陰の暗い面。袖壁と同じ材質）
  carve(b, fin, [xE, 0, zN, 16, 3.9, zS], eRooms.map((r) => roomBox(r)));
  for (const r of eRooms) buildRoom(kit, r);
  // 袖壁の前の面をつなぐひさしの帯
  bx(b, wall, finX, 3.6, zN, xE, 3.9, zS, {});
  const openDoors = new Set([-15.4, -20.4]);
  for (const zf of EAST_FINS) {
    // 袖壁（厚さ 0.6 m）と、その手前の扉（教室・工房の 2 つは開く扉の板。ほかは鍵の掛かった扉）
    bx(b, fin, finX, 0, zf - 0.6, xE, 3.6, zf, { collide: true });
    if (!openDoors.has(zf)) darkDoor(at(xE, zf + 0.55, -Math.PI / 2, 5), 0.92, 2.08);
  }
  // 上の階の細い窓（深い抱き。日の当たる側の抱きに斜めの影）
  for (const z of EAST_SLITS) {
    bx(b, slot, xE - 0.005, 6.0, z - 0.11, xE + 0.5, 7.2, z + 0.11, {});
    // 窓の下の雨の垂れの筋（窓台から下へ細くなる暗い筋）
    bx(b, stain, xE - 0.008, 4.6, z - 0.09, xE - 0.003, 6.0, z + 0.09, {});
  }

  // ---- 西の棟 ----
  // 南の端の回廊の高さの屋根（3.6 m）と、2 階建ての屋根の板（折れ屋根の断面に沿って 0.35 m）
  bx(b, wall, -14.3, A.soffit - 0.01, WEST_STEP, xW, A.soffit + 0.35, zS, { collide: true });
  {
    const top = roofLine(WEST_STEP, zN);
    const under = [...top].reverse().map(([z, h]): [number, number] => [z, h - 0.35]);
    extrudeSection(b, wall, 'zy', [...top, ...under], -14.3, xW, {});
  }
  // 中庭の面（2 階の壁）・西の外の面（扉 2 つ: 通り抜けの外の扉・図書室のバルコニーの口）
  profileWall(b, wall, xW - 0.3, xW, WEST_STEP, zN, A.soffit);
  // 西の外の面（前庭に面する）: 扉 2 つ（通り抜けの外の扉・図書室のバルコニーの口）と、部屋と階段の窓の穴
  const westHoles: ZHole[] = [
    { z0: -2.4, z1: -3.6, y0: 0, y1: 2.4 },
    { z0: -19.4, z1: -20.6, y0: 4.9, y1: 7.0 },
    ...A_ROOMS.flatMap((r) => (r.windows ?? []).filter((w) => w.side === 'w').flatMap((w) => w.at.map((z): ZHole => ({ z0: z + w.w / 2, z1: z - w.w / 2, y0: r.y0 + w.y0, y1: r.y0 + w.y1 })))),
    ...STAIR_WINDOWS.map(([z, y0, y1]): ZHole => ({ z0: z + 0.4, z1: z - 0.4, y0, y1 })),
  ];
  zPieces(zS, zN, westHoles, (za, zb, yb, top) => profileWall(b, wall, -14.3, -14.0, za, zb, yb, top));
  // 2 階の床（図書室。中庭の面の壁の内側まで）
  bx(b, inFloor, -14.0, 4.65, zN, xW - 0.3, 4.9, -17.9, { collide: true });
  // 1 階の仕切り（通り抜けの間と階段の吹き抜けの間。ほかの仕切りは部屋の壁）
  bx(b, wall, -14.0, 0, -5.3, A.westPorchBack - 0.3, A.soffit, -5.0, { collide: true });
  // 北の端の斜めの肩（控え壁）: 西の棟の面から北の棟の面に沿って東へ 1.1 m、上は 7.75 → 4.26 m へ下がる
  extrudeSection(
    b,
    wall,
    'xy',
    [
      [xW, 0],
      [lx0, 0],
      [lx0, 4.26],
      [xW, A.westLo],
    ],
    zN,
    zN + 1.4,
    {},
  );
  b.ctx.colliders.add({ x: xW, y: 0, z: zN }, { x: lx0, y: 4.26, z: zN + 1.4 });
  // 1 階: 回廊の外の壁（開口の間）・回廊の天井
  // 開口の間の壁: 芯は暗い材質（開口の抱きの面 = 回廊の奥の暗がり）、中庭の面だけ壁の色の板
  const wallSeg = (z0: number, z1: number): void => {
    if (z0 - z1 <= 0.05) return;
    bx(b, slot, xW - 0.6, 0, z1, xW - 0.01, A.soffit, z0, { collide: true });
    bx(b, wall, xW - 0.01, 0, z1, xW, A.soffit, z0, {});
  };
  let zPrev = zS;
  for (const [z0, z1] of WEST_OPENINGS) {
    wallSeg(zPrev, z0);
    zPrev = z1;
  }
  wallSeg(zPrev, zN + 1.4);
  const back = A.westPorchBack;
  bx(b, slot, back, A.soffit - 0.2, zN, xW - 0.6, A.soffit, zS, {});
  // 回廊の奥の壁（部屋への扉の口。部屋の側の扉の板は buildRoom）
  const backDoors = [4.4, -3.0, -9.3, -20.6, -24.9, 2.4];
  wallWithHoles(
    b,
    slot,
    [back - 0.15, zN],
    [back - 0.15, zS],
    0,
    A.soffit,
    0.3,
    backDoors.map((z) => (z === 2.4 ? { at: z - zN, width: 1.2, bottom: 1.0, top: 2.0 } : { at: z - zN, width: z === -9.3 ? 1.6 : 1.0, bottom: 0, top: z === -9.3 ? 2.6 : 2.1 })),
  );
  // 回廊の梁（参考画像の視点からは開口の奥の暗がり。梁は天井の下 0.38 m。灯りは消えている = 暗いまま）
  dressWalk(kit, 'A', [back, zN + 1.4, xW - 0.6, zS], 0, A.soffit - 0.2, 'z', undefined, 'slot', false);
  // 門の通路の梁と灯り
  dressWalk(kit, 'A', [-1.0, zS, 1.2, zS + 6], 0, 2.5, 'z', undefined, 'slot');
  // 部屋（門番・通り抜け・集会室・図書室）
  for (const id of ['A-porter', 'A-pass', 'A-chapter', 'A-library']) buildRoom(kit, room(id));
  // 階段の吹き抜け（回廊から広い口で入る。階段は西の壁ぎわを北へ上る）
  stairs(b, inFloor, [(A_STAIR.x0 + A_STAIR.x1) / 2, 0, A_STAIR.zBottom], '-z', A_STAIR.rise, A_STAIR.x1 - A_STAIR.x0, { riser: 0.175, tread: 0.28 });
  // 階段の手すり壁（吹き抜けの側）と、2 階の床の縁の手すり
  for (let i = 0; i < 28; i += 4) {
    const z = A_STAIR.zBottom - i * 0.28;
    const y = (i + 1) * 0.175;
    at(A_STAIR.x1 + 0.03, z - 0.14, 0, 31 + i, y).rod('#4d5f5b', [0, 0, 0], [0, 0.95, 0], 0.018, { shadow: false });
  }
  at(A_STAIR.x1 + 0.03, 0, 0, 30).tube('#4d5f5b', [[0, 1.12, A_STAIR.zBottom], [0, A_STAIR.rise + 0.95, A_STAIR.zBottom - 7.84]], 0.022, { sharp: true });
  at(0, 0, 0, 33, 0).tube('#4d5f5b', [[A_STAIR.x1 + 0.1, 4.9 + 0.95, -17.95], [xW - 0.35, 4.9 + 0.95, -17.95]], 0.022, { sharp: true });
  for (let x = A_STAIR.x1 + 0.4; x < xW - 0.4; x += 1.2) at(x, -17.95, 0, 34, 4.9).rod('#4d5f5b', [0, 0, 0], [0, 0.95, 0], 0.016, { shadow: false });
  b.ctx.colliders.add({ x: A_STAIR.x1, y: 4.9, z: -18.05 }, { x: xW - 0.3, y: 5.9, z: -17.85 });
  // 階段の壁の手すり（西の壁に腕木で留めた鋼の管。段に沿って上がる）と、吹き抜けの東の壁の腰壁（暗い塗り）・巾木
  {
    const zTop = A_STAIR.zBottom - 28 * 0.28;
    at(0, 0, 0, 35).tube('#4d5f5b', [[-13.85, 0.9, A_STAIR.zBottom + 0.3], [-13.85, 0.9, A_STAIR.zBottom], [-13.85, A_STAIR.rise + 0.9, zTop], [-13.85, A_STAIR.rise + 0.9, zTop - 0.3]], 0.02, { sharp: true });
    for (let i = 0; i <= 6; i++) {
      const z = A_STAIR.zBottom - (i * (A_STAIR.zBottom - zTop)) / 6;
      const y = (A_STAIR.zBottom - z) / 0.28 * 0.175 + 0.9;
      at(0, 0, 0, 36 + i).rod('#4d5f5b', [-13.99, y - 0.04, z], [-13.85, y, z], 0.01, { shadow: false });
    }
    const inDado = m.get('A', 'inDado');
    const base = m.get('A', 'door', { brush: false });
    bx(b, inDado, A.westPorchBack - 0.32, 0, -19.0, A.westPorchBack - 0.31, 1.1, -10.1, {});
    bx(b, inDado, A.westPorchBack - 0.32, 0, -8.5, A.westPorchBack - 0.31, 1.1, -5.3, {});
    bx(b, base, A.westPorchBack - 0.335, 0, -19.0, A.westPorchBack - 0.31, 0.11, -10.1, {});
    bx(b, base, A.westPorchBack - 0.335, 0, -8.5, A.westPorchBack - 0.31, 0.11, -5.3, {});
  }
  b.ctx.colliders.add({ x: A_STAIR.x1 + 0.02, y: 0, z: -17.9 }, { x: A_STAIR.x1 + 0.08, y: 5.9, z: A_STAIR.zBottom });
  // 吹き抜けの灯り: 床だけ（階段の下の床の光だまり）
  // （灯りの中心は床から 1.8 m。高い位置に置くと四角の高さの重みで光だまりが消えていた）
  b.ctx.addLamp({ pos: [-10.3, 1.8, -12], radius: 2.4, intensity: 0.6, box: [-12.25, -0.1, -19.0, -8.1, 0.12, -5.3], down: true, shadow: 0.2, square: true, hard: true });
  // 吹き抜けの東の壁の、図書室の床の高さの帯（床板の小口）
  bx(b, m.get('A', 'inTrim'), A.westPorchBack - 0.34, 4.45, -19.0, A.westPorchBack - 0.31, 4.65, -10.1, {});
  // 吹き抜けの西の壁の窓（外は前庭。階段に沿って上がる）と、窓から階段・床へ落ちる日なた
  {
    const fr: WallFrame = { along: false, line: -14.15, t: 0.3, inward: 1 };
    for (const [z, y0, y1] of STAIR_WINDOWS) {
      fitWindow(kit, 'A', fr, z - 0.4, z + 0.4, y0, y1, { stain: m.get('A', 'stain', { brush: false }) });
      // 日は本物の影で窓を通り、階段の踏み面と床に落ちる（蹴上げは面の向きで暗いまま = 段の縞）
    }
  }
  // 西の棟の 2 階建ての部分の内装: 屋根の下の天井の板・西の壁と中庭側の壁の内側の板（階段の吹き抜けと図書室）
  {
    const inWall = m.get('A', 'inWall');
    const inCeil = m.get('A', 'inCeil');
    const top = roofLine(WEST_STEP, zN).map(([z, h]): [number, number] => [z, h - 0.36]);
    const under = [...top].reverse().map(([z, h]): [number, number] => [z, h - 0.02]);
    extrudeSection(b, inCeil, 'zy', [...top, ...under], -14.0, xW - 0.3, {});
    // 階段の吹き抜けの西の壁（窓を避ける）。図書室の高さ（4.9〜7.2 m）は部屋の内装の板（buildRoom）なので、その上だけ
    zPieces(-5.3, -19.4, westHoles, (za, zb, yb, top) => profilePlate(b, inWall, -14.0, 1, za, zb, yb, top));
    profilePlate(b, inWall, -14.0, 1, -19.4, -20.6, 7.2);
    profilePlate(b, inWall, -14.0, 1, -20.6, zN, 7.2);
    profilePlate(b, inWall, xW - 0.3, -1, -17.9, zN, 7.2);
    profilePlate(b, inWall, xW - 0.3, -1, WEST_STEP, -17.9, 4.65);
    // 階段の吹き抜けの東（回廊の奥の壁の内側）・北（集会室の仕切りの上の口の縁）・南（仕切り）の内装
    const plateX = (x: number, z0: number, z1: number, y0: number, y1: number): void => {
      bx(b, inWall, x, y0, z1, x + 0.01, y1, z0, {});
    };
    plateX(A.westPorchBack - 0.31, -5.3, -8.5, 0, westRoofAt(-8.5) - 0.37);
    plateX(A.westPorchBack - 0.31, -10.1, -19.0, 0, 4.65);
    plateX(A.westPorchBack - 0.31, -8.5, -10.1, 2.6, 4.65);
    bx(b, inWall, -14.0, 0, -19.0, A.westPorchBack - 0.3, 4.65, -18.99, {});
    bx(b, inWall, -14.0, 0, -5.31, A.westPorchBack - 0.3, A.soffit, -5.3, {});
    // 吹き抜けの東の上（回廊の屋根より上、図書室の床まで）の壁
    bx(b, wall, A.westPorchBack - 0.3, A.soffit, -19.0, xW - 0.3, 4.65, WEST_STEP, { collide: true });
  }
  // 折れ屋根を支える梁（3 m おき。階段の吹き抜けと図書室の上に、屋根の下面から 0.45 m 下がる打ち放しの梁）
  {
    const beam = m.get('A', 'inTrim');
    for (let z = WEST_STEP - 1.5; z > zN + 0.8; z -= 3.0) {
      const h = westRoofAt(z) - 0.37;
      bx(b, beam, -14.0, h - 0.45, z - 0.15, xW - 0.3, h + 0.05, z + 0.15, {});
    }
  }
  // 2 階の細い窓
  for (const z of WEST_SLITS) {
    if (westRoofAt(z) < 7.0) continue;
    bx(b, slot, xW - 0.5, 5.65, z - 0.11, xW + 0.005, 6.75, z + 0.11, {});
    bx(b, stainW, xW + 0.003, 4.0, z - 0.09, xW + 0.008, 5.65, z + 0.09, {});
  }

  // 西の棟の 2 階のバルコニー（C を見下ろす。参考画像 2 の視点。床 4.9 m。手すり壁は目から 1 m 先 = 画角の下の外）
  bx(b, wall, -16.5, 4.65, -21.8, -14.3, 4.9, -18.2, { collide: true });
  bx(b, wall, -16.5, 4.9, -21.8, -16.3, 5.85, -18.2, { collide: true });
  bx(b, wall, -16.5, 4.9, -21.8, -14.3, 5.85, -21.6, { collide: true });
  bx(b, wall, -16.5, 4.9, -18.4, -14.3, 5.85, -18.2, { collide: true });

  // ---- 中庭の物 ----
  // ベンチ（参考画像 0: 長さ 2.26 m・座面 0.43 m）
  slabBench(at(0, -18.6, 0), 2.26);
  // 写っていない手前（南）の側: 植木鉢・洗い場・排水の格子（参考画像の画角の外 z > -7）
  planter(at(-3.6, 5.6, 0, 41), 0.9);
  planter(at(3.9, 5.6, 0, 42), 0.9);
  trough(at(4.9, -3.0, -Math.PI / 2, 43), 1.4);
  for (const [x, z] of [
    [0.3, -3.0],
    [-3.5, 6.5],
    [3.4, -4.6],
  ])
    drain(at(x, z, 0, 44), 0.5, 0.5);

  // ---- 南の門の棟 ----
  bx(b, wall, -16, 0, zS, -1.0, 5.5, zS + 6, { collide: true });
  bx(b, wall, 1.2, 0, zS, 18, 5.5, zS + 6, { collide: true });
  bx(b, wall, -1.0, 2.5, zS, 1.2, 5.5, zS + 6, { collide: true });
  bx(b, slot, -1.0, 2.49, zS, 1.2, 2.5, zS + 6, {});
  // 門の棟の北の面（参考画像 0 の視点の後ろ）: 窓と掲示板
  for (const x of [-4.2, -2.4, 3.0, 4.6]) bx(b, slot, x - 0.35, 1.0, zS - 0.005, x + 0.35, 2.3, zS + 0.4, {});
  {
    const p = at(-3.3, zS, Math.PI, 65);
    p.box('#4a5a52', [-0.6, 1.1, 0], [0.6, 1.9, 0.03]);
    for (let i = 0; i < 4; i++) p.box(i % 2 ? '#dfe3d3' : '#c9ccb6', [-0.5 + i * 0.26, 1.25 + (i % 2) * 0.1, 0.03], [-0.32 + i * 0.26, 1.6 + (i % 2) * 0.1, 0.035], { shadow: false });
  }
}
