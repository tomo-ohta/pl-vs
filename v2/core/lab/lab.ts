/**
 * 実験場のフロア（段階 1 の確認用。手で組んだ固定の配置）。部品の基本の組み合わせを 1 か所で試す。
 *
 *   入口の廊下 ──扉（調べると開く）── 前の広間 ─┬─ ボタンで開く扉 ── 小部屋
 *                                            │  （広い開口）
 *                                        奥の広間 ─ 隠し部屋（傾く床の上の物を大量にどかすと、壁が消える）
 *
 * - 前の広間: 昇降台（乗ると運ばれる）、立ち止まると奥の照明がつく床の印、動く歩道（押し流すゾーン）
 * - 奥の広間: 傾く床（立ち位置の方へ傾く）と 30 個の物（西の端にまとめて置く）。西の端の物が 35% を下回ると隠し部屋の壁が消える（出現型）
 * 座標: 入口が z = 0、奥へ -Z。床は y = 0。
 */
import type { AABB } from '../math/aabb.ts';
import { aabbUnion } from '../math/aabb.ts';
import { makeCell, opening, portal, portalAabb, doorPanel } from '../world/build.ts';
import { box, WALL_T, type Box, type EntitySpec, type FloorLayout, type Json } from '../world/layout.ts';
import { themePalette } from '../world/palettes.ts';

const aabbJson = (a: AABB): Json => ({ min: [...a.min], max: [...a.max] });

export function labFloor(seed = 1, tuningVersion = 'default'): FloorLayout {
  // ---------------------------------------------------------------- 区画
  const entry = makeCell({
    id: 'entry', role: 'entry', name: '入口の廊下', theme: 'CorridorOffice', audioPreset: '空調ハム・PCファン残響',
    rects: [{ x0: -1.5, z0: -10, x1: 1.5, z1: 0 }], height: 2.7, palette: themePalette('CorridorOffice'),
    openings: [opening('d1', [0, 0, -10], 2)],
  });
  const hallA = makeCell({
    id: 'hallA', role: 'hub', name: '前の広間', theme: 'LargeRoom', audioPreset: '空調・微かなBGM', materialKey: 'hall',
    rects: [{ x0: -8, z0: -18, x1: 8, z1: -10 }], height: 3.2, palette: themePalette('LargeRoom'),
    openings: [opening('d1', [0, 0, -10], 0), opening('d2', [8, 0, -17], 1), opening('ab', [0, 0, -18], 2, 15.4, 3.2)],
  });
  const hallB = makeCell({
    id: 'hallB', role: 'gimmick', name: '奥の広間', theme: 'LargeRoom', audioPreset: '空調・微かなBGM', materialKey: 'hall',
    rects: [{ x0: -8, z0: -26, x1: 8, z1: -18 }], height: 3.2, palette: themePalette('LargeRoom'),
    openings: [opening('ab', [0, 0, -18], 0, 15.4, 3.2), opening('sx', [-8, 0, -21], 3)],
    floorHoles: [{ min: [-7, -1, -24], max: [-1, 0, -19] }],
    lampId: 'lampB',
  });
  const side = makeCell({
    id: 'side', role: 'side', name: '小部屋', theme: 'SmallRoom', audioPreset: '空調',
    rects: [{ x0: 8, z0: -20, x1: 14, z1: -14 }], height: 2.7, palette: themePalette('SmallRoom'),
    openings: [opening('d2', [8, 0, -17], 3)],
  });
  const secretPalette = { ...themePalette('Gallery'), light: 'lightWarm' as const, lightColor: 0xffd29a, lightIntensity: 0.8 };
  const secret = makeCell({
    id: 'secret', role: 'secret', name: '隠し部屋', theme: 'Gallery', audioPreset: '空調',
    rects: [{ x0: -14, z0: -24, x1: -8, z1: -18 }], height: 2.6, palette: secretPalette,
    openings: [opening('sx', [-8, 0, -21], 1)],
  });

  // 隠し部屋の壁（現れたら消える = 行き止まりの壁が開く）。両側の壁の開口を塞ぐ
  for (const [cell, x0, x1] of [[hallB, -8, -8 + WALL_T], [secret, -8 - WALL_T, -8]] as const) {
    const b: Box = box([x0, 0, -21.5], [x1, 2.1, -20.5], cell.palette.wall);
    b.concealGroup = 'secretWall';
    cell.boxes.push(b);
  }

  // 傾く床の穴（深さ 1.2 m）: 底と側壁（物が床下へ抜けないように）
  const pit = { x0: -7, z0: -24, x1: -1, z1: -19 };
  hallB.boxes.push(box([pit.x0, -1.4, pit.z0], [pit.x1, -1.2, pit.z1], 'floorConcrete'));
  hallB.boxes.push(box([pit.x0 - 0.2, -1.4, pit.z0], [pit.x0, -0.2, pit.z1], 'wallConcrete'));
  hallB.boxes.push(box([pit.x1, -1.4, pit.z0], [pit.x1 + 0.2, -0.2, pit.z1], 'wallConcrete'));
  hallB.boxes.push(box([pit.x0 - 0.2, -1.4, pit.z0 - 0.2], [pit.x1 + 0.2, -0.2, pit.z0], 'wallConcrete'));
  hallB.boxes.push(box([pit.x0 - 0.2, -1.4, pit.z1], [pit.x1 + 0.2, -0.2, pit.z1 + 0.2], 'wallConcrete'));

  // 立ち止まる床の印（光る四角。見た目だけ）
  const pad: AABB = { min: [-1, 0, -16.6], max: [1, 0.012, -14.6] };
  const padBox = box(pad.min, pad.max, 'yellowLine', false);
  padBox.kind = 'pad';
  hallA.boxes.push(padBox);

  // 動く歩道の帯（見た目だけ。押す力は forceZone）
  const belt: AABB = { min: [4.6, 0, -25.6], max: [6.6, 0.02, -10.4] };
  const beltBox = box(belt.min, belt.max, 'rubber', false);
  beltBox.kind = 'belt';
  hallA.boxes.push(beltBox);

  // 小部屋の中の印（ボタンの扉の先に何かがある感じ）
  side.boxes.push(box([12.6, 0, -19.6], [13.6, 1.8, -18.4], 'lockerGreen'));
  // 隠し部屋の中: 台の上の小さな物
  secret.boxes.push(box([-12, 0, -21.6], [-10.8, 0.9, -20.4], 'marbleWhite'));
  secret.boxes.push(box([-11.55, 0.9, -21.15], [-11.25, 1.35, -20.85], 'goldTrim', false));

  // ---------------------------------------------------------------- 部品
  const entities: EntitySpec[] = [
    // 扉 1: 調べると開く（4 秒で自動で閉まる）
    { id: 'door1', type: 'door', cell: 'entry', params: { panel: aabbJson(doorPanel('z', -10, 0, 1.0, 0, 2.1)), axis: 'z', mat: entry.palette.door } },
    // ボタン → 扉 2
    { id: 'button1', type: 'button', cell: 'hallA', params: { box: aabbJson({ min: [7.79, 1.05, -15.95], max: [7.85, 1.3, -15.7] }), mat: 'plasticRed' } },
    { id: 'door2', type: 'door', cell: 'hallA', params: { panel: aabbJson(doorPanel('x', 8, -17, 1.0, 0, 2.1)), axis: 'x', mat: hallA.palette.door }, inputs: { open: 'button1.on' } },
    // 立ち止まる床の印 → 奥の広間の照明
    { id: 'pad1', type: 'dwellSensor', cell: 'hallA', params: { aabb: aabbJson({ min: [pad.min[0], -0.1, pad.min[2]], max: [pad.max[0], 1.5, pad.max[2]] }), sec: 1.5, still: true } },
    { id: 'lampB', type: 'lamp', cell: 'hallB', params: { on: false, rate: 2.5 }, inputs: { on: 'pad1.done' } },
    // 昇降台（乗ると運ばれる）
    { id: 'lift1', type: 'mover', cell: 'hallA', params: { box: aabbJson({ min: [2, 0, -16], max: [4, 0.15, -14] }), mat: 'metal', points: [[0, 0, 0], [0, 1.3, 0]], speed: 0.45, mode: 'pingpong' } },
    // 動く歩道
    { id: 'walk1', type: 'forceZone', cell: 'hallA', params: { aabb: aabbJson({ min: [belt.min[0], -0.1, belt.min[2]], max: [belt.max[0], 0.6, belt.max[2]] }), vector: [0, 0, -1], speed: 1.3, visual: 'belt' } },
    // 傾く床と箱
    { id: 'tilt1', type: 'tiltFloor', cell: 'hallB', params: { rect: { ...pit }, y: 0, thickness: 0.2, maxDeg: 14, rateDeg: 7, returnDeg: 2, mat: 'floorWood', friction: 0.12 } },
    // 物は床の西の端にまとめて置く。西の端（pileArea）から 65% 以上どかすと隠し部屋の壁が消える
    { id: 'pile1', type: 'propPile', cell: 'hallB', params: { region: aabbJson({ min: [pit.x0 + 0.3, 0.05, pit.z0 + 0.4], max: [pit.x0 + 2.4, 1.4, pit.z1 - 0.4] }), count: 30, size: [0.3, 0.5], mats: ['boxCardboard', 'furnitureLight', 'plasticBlue'], density: 220, friction: 0.12, ballRatio: 0.3 } },
    { id: 'count1', type: 'countSensor', cell: 'hallB', params: { aabb: aabbJson({ min: [pit.x0, -0.7, pit.z0], max: [pit.x0 + 2.6, 3, pit.z1] }), of: 'pile1', belowRatio: 0.35 } },
    { id: 'reveal1', type: 'reveal', cell: 'hallB', params: { group: 'secretWall', pos: [-8, 1, -21], style: 'slideOpen' }, inputs: { show: 'count1.below' } },
    { id: 'lampSecret', type: 'lamp', cell: 'secret', params: { on: false, rate: 1.5 }, inputs: { on: 'reveal1.shown' } },
    // 穴に落ちたら傾く床の手前へ戻す
    { id: 'pitBack', type: 'respawnZone', cell: 'hallB', params: { aabb: aabbJson({ min: [pit.x0, -1.4, pit.z0], max: [pit.x1, -0.75, pit.z1] }), to: [-4, 0.05, -17.5], toYaw: Math.PI } },
  ];
  // 隠し部屋の照明は lampSecret で入切
  for (const l of secret.lights) l.lampId = 'lampSecret';
  for (const b of secret.boxes) if (b.mat === secretPalette.light) b.kind = 'lamp:lampSecret';

  const cells = [entry, hallA, hallB, side, secret];
  const bounds = cells.map((c) => c.bounds).reduce((a, b) => aabbUnion(a, b));
  return {
    id: 'lab',
    seed,
    genVersion: 'lab-1',
    tuningVersion,
    bounds: { min: [bounds.min[0], -1.6, bounds.min[2]], max: bounds.max },
    cells,
    portals: [
      portal('p-d1', 'entry', 'hallA', portalAabb('z', -10, 0, 1.0, 0, 2.1), 2, 'door', 'door1'),
      portal('p-d2', 'hallA', 'side', portalAabb('x', 8, -17, 1.0, 0, 2.1), 1, 'door', 'door2'),
      portal('p-ab', 'hallA', 'hallB', portalAabb('z', -18, 0, 15.4, 0, 3.2), 2, 'opening'),
      portal('p-sx', 'hallB', 'secret', portalAabb('x', -8, -21, 1.0, 0, 2.1), 3, 'opening'),
    ],
    entities,
    surfaces: [],
    spawn: { pos: [0, 0.02, -1.5], yaw: 0, cell: 'entry' },
    exits: [],
    fog: { color: 0x0b0d14, near: 8, far: 46 },
  };
}
