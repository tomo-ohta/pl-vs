import { Prop, type PropMats } from '../../props/kit.ts';
import { wrSink } from './props/mats.ts';
import type { Builder } from '../../scenes/Builder.ts';
import { stairs, wallWithHoles, type WallHole } from '../kit.ts';
import type { Doors } from './doors.ts';
import { bx } from './geo.ts';
import { buildRoom, carve, doorLeaf, dressWalk, roomHoles, type RoomKit, type RoomSpec } from './interior.ts';
import { bucketBroom, crateStack, darkDoor, downpipe, drain, elecBox, planter, slabBench, trough, wallLamp, wheelbarrow, window } from './props/court.ts';
import { CW } from './layout.ts';
import type { Mats } from './mats.ts';
import type { Later } from './seen.ts';

/**
 * C 沈んだ中庭（参考画像 2）。A の西の棟の 2 階のバルコニー（目 6.5 m）から西（-x）へ見下ろす。場面の座標（layout.ts の CW）。
 * - 手前（東）: 門の壁（高さ 3.6 m・厚さ 1.6 m。上は歩けるテラス。外の面は北向きの陰で苔むして暗い。下に門の口 3 つ）
 * - 南（参考画像の左）・北（右）・西（奥）: 平屋の回廊（3.6 m。屋上がテラス 4.5〜5 m 幅）。中庭の面に長く低い開口（上端 2 m・奥は暗い回廊）、扉・窓・灯り。
 *   西の回廊は柱 2 本のロッジア、左の端に段の台
 * - その外: 回廊の上に 2 階のある棟（7.6 m）。テラスに扉と窓
 * - 中庭: ベンチ 1 つ、北の開口の前に長い低いコンクリートの台
 */

/** 写っていない所の部屋（間取り図にも使う） */
export const C_ROOMS: RoomSpec[] = [
  {
    id: 'C-upper',
    label: '南の棟の 2 階の寝室（テラスの扉）',
    kind: 'cell',
    court: 'C',
    rect: [-52.0, -8.9, -43.0, -1.0],
    y0: 3.6,
    y1: 7.3,
    doors: [
      { side: 'n', at: -47.475, w: 1.0, h: 2.05 },
      { side: 'n', at: -50.445, w: 0.97, h: 0.9, y0: 1.2, open: true },
      { side: 'n', at: -43.8, w: 0.9, h: 0.9, y0: 1.2, open: true },
    ],
    // 南の外の壁の窓（日が入る。外の 0.7 m の塊を抜けて敷地の外へ）
    windows: [{ side: 's', at: [-50.6, -47.5, -44.4], w: 1.6, y0: 0.8, y1: 2.8 }],
  },
];
/** 前庭の階段（門の壁の外の面ぞいに南へ上り、門の壁の上のテラスへ） */
export const C_STAIR = { x0: -23.3, x1: -21.9, zBottom: -25.5, rise: 3.6 };
/** 前庭（A の西の棟と C の門の壁の間）。南の端は C の南の棟の東の端（x -30）まで広がる */
export const FORECOURT = { x0: CW.wallOut, x1: -14.3, z0: -33.0, z1: 2.0, xNorth: CW.outE };

export function buildCourtC(b: Builder, m: Mats, pm: PropMats, doors: Doors, later: Later): void {
  const sink = wrSink(b);
  const kit: RoomKit = { b, m, pm, doors, sink };
  const at = (x: number, z: number, yaw: number, seed = 1, y = 0): Prop => Prop.at(sink, pm, [x, y, z], yaw, seed);
  const wall = m.get('C', 'wall');
  const floor = m.get('C', 'floor');
  const terrace = m.get('C', 'terrace');
  const gateWall = m.get('C', 'gateWall');
  const deep = m.get('C', 'deep');
  const door = m.get('C', 'door');
  const win = m.get('C', 'window');
  const gateDoor = m.get('C', 'gate', { brush: false });
  const loggia = m.get('C', 'loggia');
  const wallW = m.get('C', 'wallW');
  const H = CW.podH;
  const T = 0.3; // テラスの板の厚さ

  // ---- 床（中庭・回廊の床・前庭） ----
  bx(b, floor, CW.podW, -0.3, CW.podS, CW.wallIn, 0, CW.podN, { collide: true });
  bx(b, floor, CW.wallIn, -0.3, FORECOURT.z0, FORECOURT.x1, 0, CW.podN, { collide: true });
  bx(b, floor, FORECOURT.xNorth, -0.3, CW.podN, FORECOURT.x1, 0, FORECOURT.z1, { collide: true });
  // 前庭の囲い（南・北の塀と、南の外への門（鍵））
  bx(b, gateWall, FORECOURT.xNorth - 0.3, 0, FORECOURT.z1, -21.0, 4.0, FORECOURT.z1 + 0.4, { collide: true });
  bx(b, gateWall, -18.4, 0, FORECOURT.z1, FORECOURT.x1, 4.0, FORECOURT.z1 + 0.4, { collide: true });
  bx(b, gateWall, -21.0, 2.9, FORECOURT.z1, -18.4, 4.0, FORECOURT.z1 + 0.4, { collide: true });
  bx(b, gateWall, FORECOURT.xNorth - 0.4, 0, CW.outN, FORECOURT.xNorth, 4.0, FORECOURT.z1, { collide: true });
  bx(b, gateWall, CW.wallIn, 0, FORECOURT.z0 - 0.4, FORECOURT.x1, 4.0, FORECOURT.z0, { collide: true });
  {
    const leaf = doorLeaf(pm, 2.6, 2.85, '#3a4f4b');
    doors.add({ leaf, pivot: [-21.0, 0.01, FORECOURT.z1 + 0.2], yaw: 0, swing: 1.2, locked: true });
  }
  // 前庭の階段（門の壁の外の面ぞいに北へ上る。画角 2 の外 z < -24）と上の踊り場
  stairs(b, terrace, [(C_STAIR.x0 + C_STAIR.x1) / 2, 0, C_STAIR.zBottom], '-z', C_STAIR.rise, C_STAIR.x1 - C_STAIR.x0, { riser: 0.18, tread: 0.28 });
  bx(b, terrace, CW.wallOut, H - 0.3, FORECOURT.z0, C_STAIR.x1, H, C_STAIR.zBottom - 5.6, { collide: true });
  b.ctx.colliders.add({ x: C_STAIR.x1, y: 0, z: FORECOURT.z0 }, { x: C_STAIR.x1 + 0.06, y: H + 1.0, z: C_STAIR.zBottom });
  Prop.at(sink, pm, [C_STAIR.x1 + 0.03, 0, 0], 0, 2).tube('#4d5f5b', [[0, 1.0, C_STAIR.zBottom], [0, H + 1.0, C_STAIR.zBottom - 5.6], [0, H + 1.0, FORECOURT.z0]], 0.022, { sharp: true });

  // ---- 門の壁（東）: 外の面は暗い材質、上はテラス。門の口 3 つ（上端 2.75 m・細いひさし） ----
  const gates: WallHole[] = [
    { at: -16.3 - CW.podS, width: 1.3, bottom: 0, top: 2.78 },
    { at: (-19.57 - 21.26) / 2 - CW.podS, width: 1.69, bottom: 0, top: 2.73 },
    { at: (-21.51 - 22.3) / 2 - CW.podS, width: 0.79, bottom: 0, top: 2.7 },
  ];
  // 壁は z の小さい方（南）から北へ。開口の at は南の端からの距離
  const gw = (CW.wallOut + CW.wallIn) / 2;
  wallWithHoles(b, gateWall, [gw, CW.podS], [gw, CW.podN], 0, H, CW.wallOut - CW.wallIn, gates);
  // 上のテラスの面（外の面は壁の暗い色のまま上の縁まで）
  bx(b, terrace, CW.wallIn, H, CW.podS, CW.wallOut - 0.02, H + 0.015, CW.podN, {});
  // 門の口の上の細いひさし
  for (const g of gates) {
    const zc = CW.podS + g.at;
    bx(b, gateWall, CW.wallOut, g.top, zc - g.width / 2 - 0.15, CW.wallOut + 0.16, g.top + 0.08, zc + g.width / 2 + 0.15, {});
  }
  // 門の口の扉（暗い鉄の扉。口の中に 0.5 m 引っ込める）
  for (const g of gates) {
    const zc = CW.podS + g.at;
    // 口の中の鉄の扉（近づくと開く。広い口は両開き）。閉じた扉は口の中に 0.5 m 引っ込める（参考画像 2 の暗い口）
    const x = CW.wallOut - 0.525;
    const leaves = g.width > 1.2 ? 2 : 1;
    const lw = g.width / leaves;
    for (let i = 0; i < leaves; i++) {
      const z0 = zc - g.width / 2 + i * lw;
      // 局所の +x を場面の +z に（yaw -π/2）。2 枚目は吊り元を奥の端に（yaw π/2 で -z へ伸ばす）
      if (i === 0) doors.add({ leaf: doorLeaf(pm, lw, g.top - 0.02, '#141d1f'), pivot: [x, 0.01, z0], yaw: -Math.PI / 2, swing: 1.4, radius: 2.0 });
      else doors.add({ leaf: doorLeaf(pm, lw, g.top - 0.02, '#141d1f'), pivot: [x, 0.01, z0 + lw], yaw: Math.PI / 2, swing: -1.4, radius: 2.0 });
    }
    void gateDoor;
  }
  // 中庭側の面（日の当たる淡い面）: 壁の中の面に 1 cm の板
  // （外の面だけ暗くするため、壁の箱は暗い材質で作り、中の面に淡い面を重ねる）
  {
    let z = CW.podS;
    const sorted = [...gates].sort((p, q) => p.at - q.at);
    for (const g of sorted) {
      const z0 = CW.podS + g.at - g.width / 2;
      if (z0 - z > 0.02) bx(b, wall, CW.wallIn - 0.01, 0, z, CW.wallIn, H - T, z0, {});
      bx(b, wall, CW.wallIn - 0.01, g.top, z0, CW.wallIn, H - T, z0 + g.width, {});
      z = z0 + g.width;
    }
    bx(b, wall, CW.wallIn - 0.01, 0, z, CW.wallIn, H - T, CW.podN, {});
  }

  // ---- 回廊（北・南・西） ----
  // 中庭側の壁（厚さ 0.4）と長く低い開口・扉・窓
  const t = 0.4;
  // 南の回廊（参考画像の左。中庭の面 z = -13.7、向きは北）。壁は x の小さい方（西）から東へ
  const northHoles: WallHole[] = [
    { at: -55.6 - CW.x0, width: 8.45, bottom: 0, top: 1.9 }, // 西寄りの長い開口（-55.6〜-47.15）
    { at: -39.48 - CW.x0, width: 1.02, bottom: 0, top: 2.45 }, // 扉
    { at: -42.87 - CW.x0, width: 1.96, bottom: 0.95, top: 2.21 }, // 窓
    { at: -31.5 - CW.x0, width: 8.9, bottom: 0, top: 1.96 }, // 東寄りの長い開口（-35.95〜-27.05）
  ].map((h) => ({ ...h, at: h.at + h.width * 0 }));
  // at は西の端（x0）からの開口の中心: 長い開口は [x0 + at - w/2, x0 + at + w/2]
  northHoles[0].at = (-55.6 + -47.15) / 2 - CW.x0;
  northHoles[3].at = (-35.95 + -27.05) / 2 - CW.x0;
  wallWithHoles(b, wall, [CW.x0, CW.zN + t / 2], [CW.wallIn, CW.zN + t / 2], 0, H - T, t, northHoles);
  // 北の回廊（参考画像の右。中庭の面 z = -27.9、向きは南）
  const southHoles: WallHole[] = [
    { at: (-50.07 + -39.84) / 2 - CW.x0, width: 10.23, bottom: 0, top: 2.0 },
    { at: (-36.73 + -27.1) / 2 - CW.x0, width: 9.63, bottom: 0, top: 1.92 },
  ];
  wallWithHoles(b, wall, [CW.x0, CW.zS - t / 2], [CW.wallIn, CW.zS - t / 2], 0, H - T, t, southHoles);
  // 西の回廊（中庭の面 x = -56.0、向きは東）: 柱 2 本のロッジア（上端 2.15 m）
  bx(b, wallW, CW.x0 - t, 2.15, CW.zS, CW.x0, H - T, CW.zN, { collide: true });
  for (const [z0, z1] of [
    [-21.08, -19.73],
    [-27.9, -26.41],
  ]) {
    bx(b, wallW, CW.x0 - t, 0, z0, CW.x0, 2.15, z1, { collide: true });
  }
  // ロッジアの左の端の段の台
  bx(b, wall, CW.x0 - 1.4, 0, -15.42, CW.x0 - 0.1, 0.44, -13.87, { collide: true });

  // 回廊の中（暗い）: 奥の壁・天井。回廊の幅 3 m、その外は外の棟の 1 階
  const walkN = CW.zN + t + CW.walk;
  const walkS = CW.zS - t - CW.walk;
  const walkW = CW.x0 - t - CW.walk;
  // 南（walkN は z の大きい側 = 南の回廊の奥の壁）
  bx(b, deep, CW.podW, 0, walkN, CW.wallIn, H - T, walkN + 0.3, { collide: true });
  bx(b, deep, CW.podW, H - T - 0.02, CW.zN + t, CW.wallIn, H - T, walkN, {});
  // 北
  bx(b, deep, CW.podW, 0, walkS - 0.3, CW.wallIn, H - T, walkS, { collide: true });
  bx(b, deep, CW.podW, H - T - 0.02, walkS, CW.wallIn, H - T, CW.zS - t, {});
  // 西（ロッジアの奥: 青緑の暗がり）
  bx(b, loggia, walkW - 0.3, 0, walkS, walkW, H - T, walkN, { collide: true });
  bx(b, loggia, walkW, H - T - 0.02, walkS, CW.x0 - t, H - T, walkN, {});
  // 回廊の床（屋根の下で日の入らない暗い床）
  const floorDeep = m.get('C', 'floorDeep');
  bx(b, floorDeep, CW.podW, 0, CW.zN + t, CW.wallIn, 0.01, walkN, {});
  bx(b, floorDeep, CW.podW, 0, walkS, CW.wallIn, 0.01, CW.zS - t, {});
  bx(b, loggia, walkW, 0, walkS, CW.x0 - t, 0.01, walkN, {});
  // 回廊の梁と灯り・奥の壁の腕木の灯り
  dressWalk(kit, 'C', [CW.podW + 0.3, CW.zN + t, CW.wallIn, walkN], 0, H - T, 'x', undefined, 'deep');
  dressWalk(kit, 'C', [CW.podW + 0.3, walkS, CW.wallIn, CW.zS - t], 0, H - T, 'x', undefined, 'deep');
  dressWalk(kit, 'C', [walkW, walkS, CW.x0 - t, walkN], 0, H - T, 'z', undefined, 'loggia');
  // 回廊の奥の壁ぎわの長い腰掛け（開口の無い壁の後ろ。参考画像 2 の視点から開口越しに見えない所）
  for (const x of [-42.0]) slabBench(at(x, walkN - 0.3, Math.PI, 71), 2.2, { legs: 'slab', dark: '#3d4f49', top: '#566b63' });
  for (const x of [-38.3, -53.0]) slabBench(at(x, walkS + 0.3, 0, 72), 2.0, { legs: 'slab', dark: '#3d4f49', top: '#566b63' });
  // 回廊の奥の壁の扉（外の棟の 1 階の部屋へ）
  for (const x of [-52, -44, -36, -29]) {
    bx(b, door, x - 0.5, 0, walkN - 0.02, x + 0.5, 2.1, walkN, {});
    bx(b, door, x - 0.5, 0, walkS, x + 0.5, 2.1, walkS + 0.02, {});
  }
  // 回廊の外（外の棟の 1 階。回廊の奥の壁の向こう）は塊（中は作らない部屋）
  bx(b, wall, CW.podW, 0, walkN + 0.3, CW.wallIn, H, CW.podN, { collide: true });
  bx(b, wall, CW.podW, 0, CW.podS, CW.wallIn, H, walkS - 0.3, { collide: true });
  bx(b, wall, CW.podW, 0, walkS, walkW - 0.3, H, walkN, { collide: true });

  // テラス（回廊の屋上）
  bx(b, terrace, CW.x0 - t - CW.walk - 0.3, H - T, CW.zN, CW.wallIn, H, CW.podN, { collide: true });
  bx(b, terrace, CW.x0 - t - CW.walk - 0.3, H - T, CW.podS, CW.wallIn, H, CW.zS, { collide: true });
  bx(b, terrace, CW.podW, H - T, CW.zS, CW.x0, H, CW.zN, { collide: true });

  // ---- 外の棟（2 階建て 7.6 m。テラスの上に 2 階） ----
  // 南の棟（北の面 z = -9.2）: 2 階の寝室をくり抜く
  const upper = C_ROOMS[0];
  carve(b, wall, [CW.outW, 0, CW.podN, CW.outE, CW.outH, CW.outN], roomHoles(upper));
  buildRoom(kit, upper);
  // 北の棟（南の面 z = -32.9）。東の端は門の壁の外の面まで（前庭の北の端を閉じる）
  bx(b, wall, CW.outW, 0, CW.outS, CW.wallOut, CW.outH, CW.podS, { collide: true });
  // 西の棟（東の面 x = -61。逆光の陰の面）
  bx(b, wallW, CW.outW, 0, CW.podS, CW.podW, CW.outH, CW.podN, { collide: true });

  // テラスに面した扉と窓（参考画像 2 の画素から。扉 2 m、窓 4.8〜5.7 m）
  // 窓・扉: 壁の面から枠を少し出し、その奥に暗いガラス・扉の板（小物）
  const stain = m.get('C', 'stain', { brush: false });
  const opening = (cx: number, cz: number, yaw: number, w: number, y0: number, y1: number, kind: 'door' | 'win', seed: number): void => {
    const p = at(cx, cz, yaw, seed, y0);
    if (kind === 'door') darkDoor(p.sub([0, 0, 0.035]), w - 0.1, y1 - y0 - 0.06, { panels: 2, color: '#56706a' });
    else {
      window(p.sub([0, 0, 0.085]), w, y1 - y0, { depth: 0.07, bars: seed % 5 === 0 ? 3 : 0 });
      // 窓台の下の雨の垂れ（参考画像の視点から見えない窓だけ）。壁の面から 2〜5 mm 手前の細い板 2 段
      const c = Math.cos(yaw);
      const s = Math.sin(yaw);
      const wp = (u: number, y: number, d: number): [number, number, number] => [cx + c * u + s * d, y, cz - s * u + c * d];
      const yLow = y0 < H + 0.5 ? 0.05 : Math.max(H + 0.02, y0 - 2.2);
      const a0 = wp(-w * 0.38, Math.max(yLow, y0 - 1.3), 0.002);
      const a1 = wp(w * 0.38, y0 - 0.05, 0.005);
      const b0 = wp(-w * 0.2, yLow, 0.002);
      const b1 = wp(w * 0.15, Math.max(yLow, y0 - 1.3), 0.005);
      later.addBox([Math.min(a0[0], a1[0], b0[0]), yLow, Math.min(a0[2], a1[2], b0[2])], [Math.max(a0[0], a1[0], b1[0]), y0, Math.max(a0[2], a1[2], b1[2])], () => {
        bx(b, stain, Math.min(a0[0], a1[0]), a0[1], Math.min(a0[2], a1[2]), Math.max(a0[0], a1[0]), a1[1], Math.max(a0[2], a1[2]), { shadow: false });
        if (b1[1] - b0[1] > 0.1) bx(b, stain, Math.min(b0[0], b1[0]), b0[1], Math.min(b0[2], b1[2]), Math.max(b0[0], b1[0]), b1[1], Math.max(b0[2], b1[2]), { shadow: false });
      });
    }
  };
  const facadeN = (x0: number, x1: number, y0: number, y1: number, mat: unknown = win): void => {
    opening((x0 + x1) / 2, CW.podN, Math.PI, Math.abs(x1 - x0), y0, y1, mat === door ? 'door' : 'win', Math.round(-x0 * 7));
  };
  const facadeS = (x0: number, x1: number, y0: number, y1: number, mat: unknown = win): void => {
    opening((x0 + x1) / 2, CW.podS, 0, Math.abs(x1 - x0), y0, y1, mat === door ? 'door' : 'win', Math.round(-x0 * 7));
  };
  const facadeW = (z0: number, z1: number, y0: number, y1: number, mat: unknown = win): void => {
    opening(CW.podW, (z0 + z1) / 2, Math.PI / 2, Math.abs(z1 - z0), y0, y1, mat === door ? 'door' : 'win', Math.round(-z0 * 7));
  };
  // 南の棟（-48.06〜-46.89 の扉は寝室へ開く扉。buildRoom が扉の板を作る）
  facadeN(-56.58, -55.19, H, 5.71, door);
  for (const [x0, x1] of [
    [-41.43, -40.39],
    [-44.27, -43.3],
    [-50.93, -49.96],
    [-53.54, -52.68],
    [-60.26, -59.43],
    [-37.5, -36.6],
    [-33.8, -32.9],
  ])
    facadeN(x0, x1, 4.8, 5.7);
  // 北の棟
  facadeS(-48.73, -47.69, H, 5.66, door);
  for (const [x0, x1] of [
    [-45.11, -44.45],
    [-42.61, -41.95],
    [-39.57, -38.9],
    [-60.55, -59.5],
    [-57.61, -56.41],
    [-35.5, -34.6],
    [-32.2, -31.3],
  ])
    facadeS(x0, x1, 4.56, 5.6);
  // 西の棟
  facadeW(-16.27, -15.07, H, 5.59, door);
  facadeW(-27.2, -25.96, H, 5.58, door);
  for (const [z0, z1] of [
    [-17.72, -17.12],
    [-21.37, -20.67],
    [-24.58, -23.51],
    [-12.0, -11.2],
    [-30.8, -30.0],
  ])
    facadeW(z0, z1, 4.68, 5.59);

  // 窓の並び（参考画像の窓のある所のほかも、テラスに面した 2 階の面に 3.4 m おき。参考画像の窓・扉の近くは空ける）
  {
    const taken: { f: string; u: number }[] = [
      ...[-47.475, -55.885, -40.91, -43.785, -50.445, -53.11, -59.845, -37.05, -33.35].map((u) => ({ f: 'N', u })),
      ...[-48.21, -44.78, -42.28, -39.235, -60.025, -57.01, -35.05, -31.75].map((u) => ({ f: 'S', u })),
      ...[-15.67, -26.58, -17.42, -21.02, -24.045, -11.6, -30.4].map((u) => ({ f: 'W', u })),
    ];
    const free = (f: string, u: number): boolean => !taken.some((t) => t.f === f && Math.abs(t.u - u) < 1.6);
    for (let x = -60.0; x < -30.5; x += 3.4) {
      if (free('N', x)) facadeN(x - 0.45, x + 0.45, 4.8, 5.7);
      if (free('S', x + 1.7)) facadeS(x + 1.25, x + 2.15, 4.56, 5.6);
    }
    for (let z = -31.5; z < -10; z += 3.4) if (free('W', z)) facadeW(z - 0.4, z + 0.4, 4.68, 5.59);
    // 北の棟の東の端の面（x = -23.36。前庭の北の端・門の壁の上のテラスから見える）と、南の棟の東の端の面（x = -30）
    // （面は東 = +x を向くので、小物の正面 +z を +x へ = yaw π/2。3 回目の直しで向きを直した: 前は壁の中を向いて見えなかった）
    for (const z of [-34.5, -37.5, -40.5]) {
      opening(CW.wallOut, z, Math.PI / 2, 0.9, 4.7, 5.6, 'win', Math.round(-z * 5));
      opening(CW.wallOut, z, Math.PI / 2, 0.8, 1.1, 2.2, 'win', Math.round(-z * 5) + 1);
    }
    // 南の棟の東の端の面（前庭に面する）: 2 階と 1 階の窓・1 階の扉（鍵）・竪樋・壁の灯り
    for (const z of [-7.5, -4.5, -1.5]) opening(CW.outE, z, Math.PI / 2, 0.9, 4.7, 5.6, 'win', Math.round(-z * 5) + 2);
    for (const z of [-7.5, -1.5]) opening(CW.outE, z, Math.PI / 2, 0.9, 1.0, 2.2, 'win', Math.round(-z * 5) + 3);
    darkDoor(at(CW.outE, -4.5, Math.PI / 2, 81), 1.0, 2.1, { panels: 2, color: '#56706a' });
    wallLamp(at(CW.outE, -4.5, Math.PI / 2, 82, 2.6));
    downpipe(at(CW.outE, -8.7, Math.PI / 2, 83), 0, CW.outH - 0.1);
    drain(at(CW.outE + 0.35, -8.7, 0, 84), 0.4, 0.4);
  }

  // ---- 前庭の物: 植木鉢・ベンチ・洗い場・門の壁の灯り・西の棟の雨どい ----
  for (const z of [-28.0, -14.5, -6.0, -1.0]) planter(at(-15.0, z, 0, Math.round(-z * 3)), 0.9);
  slabBench(at(-15.0, -10.5, -Math.PI / 2, 51), 2.0, { legs: 'post' });
  trough(at(-14.65, -26.5, -Math.PI / 2, 52), 1.3);
  for (const z of [-12.0, -15.5, -24.8]) wallLamp(at(CW.wallOut, z, -Math.PI / 2, 53, 2.6));
  for (const z of [-8.0, -16.0, -24.0, -30.0]) {
    const p = at(-14.3, z, -Math.PI / 2, 54);
    p.rod('#7c938a', [0, 0.05, 0.08], [0, 7.0, 0.08], 0.045);
    p.box('#7c938a', [-0.08, 0, 0.0], [0.08, 0.12, 0.25], { shadow: false });
  }
  // 前庭の物置きの一角（北の端）: 積んだ木箱・手押し車・ほうきとバケツ
  crateStack(at(-16.2, -31.4, 0, 58), 3);
  wheelbarrow(at(-17.6, -31.9, 0.4, 59));
  bucketBroom(at(-15.0, -32.2, 0, 60));
  drain(at(-19.0, -12.0, 0, 55), 0.5, 0.5);
  drain(at(-19.0, -27.0, 0, 56), 0.5, 0.5);

  // ---- 中庭の物: ベンチ（参考画像 2: 1.75 m・中庭の幅の向き）・灯り・配電の箱（北の回廊の面） ----
  slabBench(at(-47.0, -17.83, Math.PI / 2, 21), 1.75, { legs: 'post' });
  wallLamp(at(-36.54, CW.zN, Math.PI, 22, 2.64));
  wallLamp(at(CW.x0, -14.88, Math.PI / 2, 23, 2.0 + 0.0));
  wallLamp(at(CW.x0, -24.0, Math.PI / 2, 24, 2.0));
  elecBox(at(-39.64, CW.zS, 0, 25));
  // ---- 北の開口の前の長い低いコンクリートの台 ----
  bx(b, terrace, -37.7, 0, -27.9, -34.6, 0.55, -26.2, { collide: true });
}
