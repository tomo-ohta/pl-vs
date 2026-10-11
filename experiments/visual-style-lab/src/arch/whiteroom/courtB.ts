import { Prop, type PropMats } from '../../props/kit.ts';
import { wrSink } from './props/mats.ts';
import type { Builder } from '../../scenes/Builder.ts';
import { stairs } from '../kit.ts';
import type { Doors } from './doors.ts';
import { fbox } from './geo.ts';
import { buildRoom, carve, doorLeaf, roomHoles, type RoomKit, type RoomSpec } from './interior.ts';
import { darkDoor, drain, louverDoor, parkBench, planter } from './props/court.ts';
import { B, FB } from './layout.ts';
import type { Mats } from './mats.ts';

/**
 * B 庇の中庭（参考画像 1）。南の棟の 2 階のバルコニー（目 6.0 m）から北（-z）へ見下ろす。数は「視点の座標」（X 右・d 奥）。
 * - 東西の 2 階建ての棟（6.6 m）。1 階の中庭側に庇が 3 組（手前: 上面 3.47 m・厚い、中: 3.2 m・薄い、奥: 突き当たりの角の薄い庇）。
 *   日はほぼ真上なので、庇の影は庇の真下の床に落ち、庇の下の壁と扉はいつも陰（暗い青緑）
 * - 庇の奥の端に袖壁、庇の間に低い壁の塊と細い縦の窓
 * - 2 階の壁に細い縦長の窓（深い抱き）
 * - 突き当たり = 門の棟の南の面（5.5 m）。真ん中の暗い口が A への門、両側に換気の格子の付いた白い扉
 */

/** 庇: side（-1 = 西）、先端の X、奥行き d0..d1、上面の高さ、厚さ */
export const CANOPIES = [
  { side: -1, tip: -3.2, d0: 12.5, d1: 17.1, top: 3.47, t: 0.15 },
  { side: 1, tip: 3.5, d0: 12.4, d1: 17.06, top: 3.47, t: 0.15 },
  { side: -1, tip: -3.3, d0: 24.2, d1: 29.4, top: 3.21, t: 0.16 },
  { side: 1, tip: 3.6, d0: 24.6, d1: 31.4, top: 3.23, t: 0.16 },
  { side: -1, tip: -2.6, d0: 32.4, d1: 37.4, top: 3.45, t: 0.12 },
  { side: 1, tip: 3.4, d0: 32.4, d1: 37.4, top: 3.45, t: 0.12 },
];

/** 写っていない所の部屋（場面の座標。間取り図にも使う） */
export const B_ROOMS: RoomSpec[] = [
  {
    id: 'B-stair',
    label: '南の棟の階段室',
    kind: 'stair',
    court: 'B',
    rect: [-8.0, 52.1, -4.6, 61.5],
    y0: 0,
    y1: 8.3,
    doors: [
      { side: 'n', at: -5.7, w: 1.0, h: 2.2 },
      { side: 'e', at: 60.75, w: 1.0, h: 2.1, y0: 4.4, open: true },
    ],
    // 南の外の壁の縦長の窓（1 階と踊り場）と、踊り場の上の光の筒
    windows: [
      { side: 's', at: [-6.3], w: 0.8, y0: 1.0, y1: 3.4 },
      { side: 's', at: [-6.3], w: 0.8, y0: 5.4, y1: 7.6 },
    ],
    roofLights: { at: [[-5.4, 58.2]], size: 1.0, top: 8.6 },
  },
  {
    id: 'B-room',
    label: '南の棟の 2 階の談話室（北のバルコニー = 参考画像 1 の視点）',
    kind: 'library',
    court: 'B',
    rect: [-4.3, 52.1, 4.0, 61.5],
    y0: 4.4,
    y1: 8.3,
    skip: ['w'],
    doors: [
      { side: 'n', at: -0.4, w: 1.4, h: 2.3, open: true },
      { side: 'w', at: 60.75, w: 1.0, h: 2.1, open: true },
    ],
    windows: [{ side: 's', at: [-2.6, 2.4], w: 1.1, y0: 0.9, y1: 2.9 }],
    roofLights: { at: [[-2.0, 55.2], [2.0, 55.2], [0.0, 58.4]], size: 1.1, top: 8.6 },
  },
  {
    id: 'B-work',
    label: '工房（西の棟・庇の下の扉）',
    kind: 'workshop',
    court: 'B',
    rect: [-16.1, 32.6, -6.8, 39.2],
    y0: 0,
    y1: 3.0,
    doors: [{ side: 'e', at: 35.8, w: 0.92, h: 2.42 }],
    // 西の棟の外の面（敷地の外）に窓。日はほぼ真上なので空の明るさだけ
    windows: [{ side: 'w', at: [33.9, 36.0, 38.0], w: 1.2, y0: 0.9, y1: 2.6 }],
    // 2 階建ての棟の 1 階なので、上の階を抜ける光の筒（屋根の上面 6.6 m まで）
    roofLights: { at: [[-9.9, 34.4], [-9.9, 37.5]], size: 1.1, top: 6.6 },
  },
  {
    id: 'B-class',
    label: '教室（東の棟・庇の下の扉）',
    kind: 'classroom',
    court: 'B',
    rect: [6.3, 34.8, 15.3, 41.4],
    y0: 0,
    y1: 3.0,
    doors: [{ side: 'w', at: 38.25, w: 0.92, h: 2.38 }],
    windows: [{ side: 'e', at: [36.1, 38.2, 40.3], w: 1.2, y0: 0.9, y1: 2.6 }],
    roofLights: { at: [[9.6, 36.6], [9.6, 39.7]], size: 1.1, top: 6.6 },
  },
];

export function buildCourtB(b: Builder, m: Mats, pm: PropMats, doors: Doors): void {
  const sink = wrSink(b);
  const kit: RoomKit = { b, m, pm, doors, sink };
  const room = (id: string): RoomSpec => B_ROOMS.find((r) => r.id === id)!;
  /** 視点の座標（X, d）に小物を置く。yaw は場面の向き */
  const at = (X: number, d: number, yaw: number, seed = 1, h = 0): Prop => Prop.at(sink, pm, [FB.o[0] + X, h, FB.o[1] - d], yaw, seed);
  const wallW = m.get('B', 'wallW');
  const wallE = m.get('B', 'wall');
  const under = m.get('B', 'under');
  const canopy = m.get('B', 'canopy');
  const floor = m.get('B', 'floor');
  const back = m.get('B', 'back');
  const gate = m.get('B', 'gate');
  const slot = m.get('B', 'slot');
  const stain = m.get('B', 'stain', { brush: false });
  const F = FB;
  const xL = B.xL;
  const xR = B.xR;

  // 床
  fbox(b, F, floor, xL, -0.3, B.dSouth, xR, 0, B.dBack, { collide: true });
  // 東西の棟（1 階・2 階。工房・教室をくり抜く）
  const wx0 = FB.o[0];
  const wz = (d: number): number => FB.o[1] - d;
  carve(b, wallW, [-16 + wx0, 0, wz(B.dBack), xL + wx0, B.wallH, wz(B.dSouth)], roomHoles(room('B-work')));
  carve(b, wallE, [xR + wx0, 0, wz(B.dBack), 16 + wx0, B.wallH, wz(B.dSouth)], roomHoles(room('B-class')));
  buildRoom(kit, room('B-work'));
  buildRoom(kit, room('B-class'));
  // 開く扉（工房・教室）の前は庇の下の暗い面を切る
  const realDoors = [
    { side: -1, d: 15.6, w: 0.92, h: 2.42 },
    { side: 1, d: 13.15, w: 0.92, h: 2.38 },
  ];

  for (const c of CANOPIES) {
    const wx = c.side < 0 ? xL : xR;
    const x0 = Math.min(wx, c.tip);
    const x1 = Math.max(wx, c.tip);
    // 庇の板
    fbox(b, F, canopy, x0, c.top - c.t, c.d0, x1, c.top, c.d1, { collide: true });
    // 庇の下の壁（いつも陰の暗い青緑の面を壁の前に 1 cm。開く扉の口は切る。突き当たりの角の薄い庇の下は明るいまま）
    const ux = wx - c.side * 0.01;
    if (c.d0 > 30) continue;
    let d = c.d0;
    for (const r of realDoors.filter((q) => q.side === c.side && q.d > c.d0 && q.d < c.d1)) {
      fbox(b, F, under, Math.min(wx, ux), 0, d, Math.max(wx, ux), c.top - c.t, r.d - r.w / 2, {});
      fbox(b, F, under, Math.min(wx, ux), r.h, r.d - r.w / 2, Math.max(wx, ux), c.top - c.t, r.d + r.w / 2, {});
      d = r.d + r.w / 2;
    }
    fbox(b, F, under, Math.min(wx, ux), 0, d, Math.max(wx, ux), c.top - c.t, c.d1, {});
    // 奥の端の袖壁（手前の 2 組だけ。壁から 1.0 m）
    if (c.d0 < 20) {
      const fx = wx - c.side * 1.0;
      fbox(b, F, c.side < 0 ? wallW : wallE, Math.min(wx, fx), 0, c.d1, Math.max(wx, fx), c.top - c.t, c.d1 + 0.5, { collide: true });
    }
  }
  // 中の庇の手前の暗い凹み（参考画像の庇の下の暗い帯は庇より手前まで続く）
  fbox(b, F, under, xL, 0, 21.1, xL + 0.01, 3.0, 24.2, {});
  fbox(b, F, under, xR - 0.01, 0, 20.6, xR, 3.0, 24.6, {});
  // 庇の下の扉（西: 手前の庇の下に 2 つ、東: 2 つ、中の庇の下に 1 つずつ）
  const doorAt = (side: number, d0: number, d1: number, h: number): void => {
    const wx = side < 0 ? xL : xR;
    darkDoor(at(wx, (d0 + d1) / 2, side < 0 ? Math.PI / 2 : -Math.PI / 2, 11), d1 - d0 - 0.08, h - 0.04, { panels: 2 });
  };
  doorAt(-1, 12.6, 13.6, 2.5);
  // （西の 15.1〜16.1 と東の 12.7〜13.6 は工房・教室の開く扉。buildRoom が扉の板を作る）
  doorAt(1, 15.1, 16.0, 2.42);
  doorAt(-1, 26.0, 26.9, 2.2);
  doorAt(1, 27.5, 28.4, 2.2);
  // 庇の間の低い壁の塊（西 d 22・東 d 33.5）
  fbox(b, F, wallW, xL, 0, 21.4, -4.4, 1.9, 22.0, { collide: true });
  fbox(b, F, wallE, 5.6, 0, 33.0, xR, 1.96, 33.5, { collide: true });
  // 庇の間の細い縦の窓（西の 1 階）
  fbox(b, F, slot, xL - 0.3, 0.2, 21.3, xL + 0.005, 1.45, 21.7, {});

  // 2 階の細い縦長の窓（深い抱き。参考画像の画素から: 高さ 4.1〜4.7 m・幅 0.16 m）と、庇の奥の端の上の小さな窓（3.25〜3.8 m）
  const slits: [number, number[]][] = [
    [-1, [3.5, 5.5, 7.5, 9.5, 11.5, 13.5, 15.5, 17.6, 21.7, 25.6, 29.0, 32.5, 35.5]],
    [1, [3.5, 5.5, 7.5, 9.5, 11.5, 13.5, 15.3, 17.3, 20.5, 25.7, 28.5, 31.5, 34.5]],
  ];
  for (const [side, ds] of slits) {
    const wx = side < 0 ? xL : xR;
    for (const d of ds) {
      fbox(b, F, slot, wx - side * 0.005, 4.1, d - 0.08, wx + side * 0.5, 4.7, d + 0.08, {});
      // 窓の下の雨の垂れの筋（庇より上の壁に）
      fbox(b, F, stain, wx - side * 0.008, 3.6, d - 0.06, wx - side * 0.003, 4.1, d + 0.06, {});
    }
    fbox(b, F, slot, wx - side * 0.005, 3.25, 18.7 - 0.08, wx + side * 0.5, 3.8, 18.7 + 0.08, {});
  }

  // 突き当たり（門の棟の南の面）の塗り（門の棟の箱は courtA。B の側の面だけ B の色）
  fbox(b, F, back, -16, 2.39, B.dBack - 0.01, 16, B.backH, B.dBack, {});
  fbox(b, F, back, -16, 0, B.dBack - 0.01, -0.99 + 0.4, 2.39, B.dBack, {});
  fbox(b, F, back, 1.2 + 0.4, 0, B.dBack - 0.01, 16, 2.39, B.dBack, {});
  // 突き当たり（門の棟の南の面）: 門の口（中ほどに暗い青緑の両開きの門扉。近づくと開く）と白い扉（換気の格子）
  void gate;
  for (const [x, sw] of [
    [-1.0, -1],
    [1.2, 1],
  ] as const) {
    const leafW = 1.1;
    const leaf = doorLeaf(pm, leafW, 2.38, '#5b7f79');
    // 左の板は吊り元 x = -1.0 から +x へ、右の板は x = 1.2 から -x へ（yaw π で向きを返す）
    doors.add({ leaf, pivot: [x, 0.01, 11.0], yaw: sw < 0 ? 0 : Math.PI, swing: sw < 0 ? -1.45 : 1.45, radius: 2.4 });
  }
  louverDoor(at((-3.44 - 2.51) / 2 + 0.4, B.dBack, 0, 13), 0.83, 2.39);
  louverDoor(at((2.7 + 3.6) / 2 + 0.4, B.dBack, 0, 14), 0.83, 2.39);
  // 中庭のベンチ（参考画像 1: 長さ 1.63 m・背もたれ・肘掛け）
  parkBench(at(-2.42 + 0.4, 17.5, 0, 15), 1.63);

  // 南の棟（視点の棟。階段室と 2 階の談話室をくり抜く）とバルコニー（床 4.4 m・手すり壁は目から 0.8 m 先。参考画像の画角の下の外）
  carve(b, wallE, [-16 + wx0, 0, wz(B.dSouth), 16 + wx0, 8.6, wz(B.dSouth - 10)], [...roomHoles(room('B-stair')), ...roomHoles(room('B-room'))]);
  buildRoom(kit, room('B-stair'));
  buildRoom(kit, room('B-room'));
  // 階段（階段室の西の壁ぎわを南へ上る。1 段 0.176 m・踏み面 0.28 m・25 段）と 2 階の踊り場
  const inFloor = m.get('B', 'inFloor', { brush: 'floor' });
  stairs(b, inFloor, [-7.1, 0, 53.0], '+z', B.floor2, 1.7, { riser: 0.176, tread: 0.28 });
  fbox(b, F, inFloor, -8.0 - wx0, B.floor2 - 0.3, wz(61.5), -4.6 - wx0, B.floor2, wz(60.0), { collide: true });
  b.ctx.colliders.add({ x: -6.22, y: 0, z: 53.0 }, { x: -6.18, y: B.floor2 + 1.0, z: 60.0 });
  Prop.at(sink, pm, [-6.2, 0, 0], 0, 3).tube('#59696a', [[0, 1.0, 53.0], [0, B.floor2 + 1.0, 60.0]], 0.02, { sharp: true });
  // 南の棟の北の面の窓（1 階の縦長の窓・2 階の細い窓。参考画像の視点の後ろ）
  for (const X of [-4.5, -2.6, 2.4, 4.4]) fbox(b, F, slot, X - 0.35, 0.9, B.dSouth - 0.4, X + 0.35, 2.4, B.dSouth + 0.005, {});
  for (const X of [-5.6, -3.2, 2.8, 5.0]) fbox(b, F, slot, X - 0.09, B.floor2 + 0.8, B.dSouth - 0.4, X + 0.09, B.floor2 + 2.1, B.dSouth + 0.005, {});
  fbox(b, F, wallE, -2.0, B.floor2 - 0.25, B.dSouth, 2.0, B.floor2, 1.0, { collide: true });
  fbox(b, F, wallE, -2.0, B.floor2, 0.8, 2.0, B.floor2 + 1.0, 1.0, { collide: true });
  fbox(b, F, wallE, -2.0, B.floor2, B.dSouth, -1.85, B.floor2 + 1.0, 0.8, { collide: true });
  // 南の端の植木鉢と排水の格子（視点の真下。画角の外）
  planter(at(-4.5, 2.0, 0, 61), 0.9);
  planter(at(4.6, 2.0, 0, 62), 0.9);
  drain(at(0.3, 4.0, 0, 63), 0.5, 0.5);
  fbox(b, F, wallE, 1.85, B.floor2, B.dSouth, 2.0, B.floor2 + 1.0, 0.8, { collide: true });
}
