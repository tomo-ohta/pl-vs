import * as THREE from 'three';
import { paint } from './paint.ts';
import type { PaintOptions } from '../../render/PaintMaterial.ts';
import { createLeafMaterial, leafCluster, makeLeafTexture } from '../../scenes/alley/foliage.ts';
import { rng, type Builder, type V3 } from '../../scenes/Builder.ts';
import type { Doors } from './doors.ts';
import { buildFacade, evenMull, type Opening } from './facade.ts';
import { LocalFrame } from './frame.ts';
import { createGlass, GLASS_MODE, ROOM } from './glass.ts';
import { BIKES, COURT, EAST, LANE, MAIN, WALKWAY, WEST, wpos, type WingFrame } from './layout.ts';
import { facadeMat } from './mats.ts';
import { bike } from './north.ts';
import { buildTree } from './tree.ts';
import { apartment, house } from './town.ts';
import { COURT_RECT, groundSun, sunLayer } from './sun.ts';
import { contact, notice, streakMat } from './dress.ts';

/**
 * 通路の南の端: 中庭（木・花壇・ベンチ・水飲み場）・渡り廊下（屋根だけの通路）・本館の北の面（廊下側）・
 * 東棟の外階段（屋外避難階段）・自動販売機・駐輪場（西棟と車路の間の三角の土地）・中庭の東のフェンス（向こうは校庭）・
 * 西棟の裏の細い土地（教室の窓から見える）。
 */

const P = (o: PaintOptions): THREE.ShaderMaterial => paint(o);

export function buildSouth(b: Builder, doors: Doors): void {
  const box = (m: THREE.Material, min: V3, max: V3, collide = false): THREE.Mesh => b.boxMM(m, min, max, { collide, shadow: false });
  const r = rng(29);
  const [cx0, cx1] = COURT.x;
  const cz1 = COURT.z[1];

  // ---------------------------------------------------------------- 中庭の地面
  // 舗装（コンクリートの平板。日の当たる所は明るい）と、木の下の土
  // 日なた（光線で調べた形。木の下は木漏れ日、建物・渡り廊下の屋根の影）。日なただけ敷石の目地が見える（参考画像の歩道と同じ）
  const sunCov = { texture: groundSun(COURT_RECT, 4), rect: COURT_RECT };
  const sunL = sunLayer;
  const pave = P({
    color: { py: '#0f242b', side: '#0d2027' },
    cov: sunCov,
    layers: [{ color: '#14303a', scale: 0.3, threshold: 0.6, only: 'floor', detail: 0.4, seed: 3 }, sunL('#386b6f', 4)],
    grid: { layer: 1, size: [0.6, 0.6], width: 0.03, color: '#27535c' },
  });
  box(pave, [cx0, -0.2, LANE.z0], [cx1, 0, cz1], true);
  // 西棟の南の端の前（斜めの壁ぞい）
  const ws = wpos(WEST, WEST.u0, 0);
  const wsW = wpos(WEST, WEST.u0, -WEST.depth);
  box(pave, [cx0, -0.2, wsW[1] - 0.3], [ws[0] + 0.5, 0, LANE.z0], true);
  // 植え込みの土と縁石（木の下）
  const soil = P({ color: { py: '#0c1e22', side: '#132a30' }, cov: sunCov, layers: [{ color: '#10262b', scale: 1.2, threshold: 0.55, only: 'floor' }, sunL('#27535c', 6)] });
  const curb = P({ color: { py: '#24444a', side: '#1a3439' }, cov: sunCov, layers: [sunL('#5f9790', 8)] });
  const beds: [number, number, number, number][] = [
    [-19, 24, -9, 33],
    [5, 24.5, 12.5, 33.5],
    [-7.5, 34.5, -2.4, 38],
  ];
  for (const [x0, z0, x1, z1] of beds) {
    box(curb, [x0, 0, z0], [x1, 0.18, z1], true);
    box(soil, [x0 + 0.12, 0.18, z0 + 0.12], [x1 - 0.12, 0.2, z1 - 0.12]);
  }
  // 木（ケヤキ 2 本・クスノキ 1 本）
  buildTree(b, { x: -14, z: 28.5, crownY: 8.5, rx: 4.6, ry: 4.4, trunk: 4.6, r: 0.3, cards: 54, seed: 31, colors: ['#21494a', '#2e5f5b', '#3d7769'], fog: 0.8, grad: [4, 12, 0.35] });
  buildTree(b, { x: 8.8, z: 29, crownY: 7.6, rx: 3.9, ry: 3.9, trunk: 4.0, r: 0.27, cards: 46, seed: 37, colors: ['#21494a', '#2e5f5b', '#3d7769'], fog: 0.8, grad: [4, 11, 0.35] });
  buildTree(b, { x: -5.0, z: 36.2, crownY: 5.4, rx: 2.6, ry: 2.4, trunk: 2.9, r: 0.18, cards: 30, seed: 41, colors: ['#1f4547', '#2b5a57', '#3a7266'], fog: 0.8, grad: [3, 8, 0.35] });
  // 低い植え込み（花壇の縁）
  const shrubTex = makeLeafTexture(57, { clumps: 30, leaf: 6, litSide: 0.7, fill: 1.4 });
  shrubTex.wrapS = shrubTex.wrapT = THREE.RepeatWrapping;
  const shrub = createLeafMaterial(shrubTex, '#0b1f23', '#18383b', 1, { cardEdge: 0.5, fog: 0.8 });
  for (const [x0, z0, x1, z1] of beds) {
    for (let x = x0 + 0.8; x < x1 - 0.5; x += 1.6) {
      b.mesh(leafCluster([x, 0.55, z0 + 0.5], [1.6, 0.7, 0.7], 4, 300 + x * 3 + z0, 0, 1.2), shrub, [0, 0, 0], { shadow: false });
      b.mesh(leafCluster([x, 0.55, z1 - 0.5], [1.6, 0.7, 0.7], 4, 400 + x * 3 + z1, 0, 1.2), shrub, [0, 0, 0], { shadow: false });
    }
  }
  // ベンチ（木の下・花壇の縁）
  const benchWood = P({ color: { py: '#3a6a68', side: '#2c5452', ny: '#1a3436' } });
  const benchLeg = P({ color: { side: '#173238', py: '#1f4046' } });
  const bench = (x: number, z: number, yaw: number): void => {
    const parts: [THREE.BufferGeometry, THREE.Material][] = [
      [new THREE.BoxGeometry(1.8, 0.05, 0.42).translate(0, 0.42, 0), benchWood],
      [new THREE.BoxGeometry(1.8, 0.3, 0.04).translate(0, 0.7, -0.2).rotateX(0), benchWood],
      [new THREE.BoxGeometry(0.06, 0.42, 0.4).translate(-0.75, 0.21, 0), benchLeg],
      [new THREE.BoxGeometry(0.06, 0.42, 0.4).translate(0.75, 0.21, 0), benchLeg],
      [new THREE.BoxGeometry(0.05, 0.35, 0.05).translate(-0.75, 0.6, -0.2), benchLeg],
      [new THREE.BoxGeometry(0.05, 0.35, 0.05).translate(0.75, 0.6, -0.2), benchLeg],
    ];
    for (const [geo, m] of parts) {
      geo.rotateY(yaw);
      geo.translate(x, 0, z);
      b.mesh(geo, m, [0, 0, 0], { shadow: false });
    }
    const c = Math.abs(Math.cos(yaw)) > 0.5;
    contact(b, x - (c ? 0.9 : 0.21), z - (c ? 0.21 : 0.9), x + (c ? 0.9 : 0.21), z + (c ? 0.21 : 0.9), 0.1, 0.004);
    b.ctx.colliders.add({ x: x - (c ? 0.9 : 0.22), y: 0, z: z - (c ? 0.22 : 0.9) }, { x: x + (c ? 0.9 : 0.22), y: 0.45, z: z + (c ? 0.22 : 0.9) });
  };
  bench(-14, 23.3, Math.PI);
  bench(-11, 23.3, Math.PI);
  bench(8.8, 23.8, Math.PI);
  bench(-1.6 - 1.4, 30, Math.PI / 2);
  // 水飲み場（タイル張りの流しに蛇口が 6 つ。15 cm 角のタイルの目地）
  const conc = P({ color: { py: '#2a4c52', side: '#1f3d43', ny: '#132a2f' }, layers: [{ color: { py: '#2a4c52', side: '#1f3d43' }, scale: 1, threshold: -2, only: 'all' }], grid: { layer: 0, size: [0.15, 0.15], width: 0.012, color: '#132a2f' } });
  box(conc, [-8.2, 0, 20.4], [-4.2, 0.72, 21.1], true);
  contact(b, -8.2, 20.4, -4.2, 21.1, 0.15);
  box(P({ color: { py: '#0f2328' } }), [-8.05, 0.72, 20.5], [-4.35, 0.73, 21.0]);
  box(conc, [-8.2, 0.72, 20.95], [-4.2, 0.82, 21.1]);
  const tap = P({ color: { side: '#41706c', py: '#4f7f7a' } });
  for (let i = 0; i < 6; i++) {
    const x = -7.85 + i * 0.66;
    box(tap, [x - 0.012, 0.82, 21.0], [x + 0.012, 1.0, 21.025]);
    box(tap, [x - 0.012, 0.975, 20.88], [x + 0.012, 1.0, 21.025]);
    box(tap, [x - 0.03, 0.96, 20.98], [x + 0.03, 0.99, 21.0]);
  }
  // マンホールの蓋・本館の前の側溝（格子の蓋）
  const lid = P({ color: { py: '#1d3a42', side: '#16303a' } });
  for (const [x, z] of [[-10, 36.5], [6, 22], [-18, 20.5]]) b.cyl(lid, [x, 0.005, z], 0.32, 0.012, { segments: 18, shadow: false });
  box(P({ color: { py: '#0c1d24' } }), [cx0 + 0.3, 0, MAIN.z[0] - 0.55], [cx1, 0.006, MAIN.z[0] - 0.3]);
  for (let x = cx0 + 0.5; x < cx1; x += 0.6) box(P({ color: { py: '#1a343c' } }), [x, 0.006, MAIN.z[0] - 0.55], [x + 0.03, 0.008, MAIN.z[0] - 0.3]);
  // 時計の柱（中庭の真ん中）
  b.cyl(P({ color: { side: '#1f3f45', py: '#2a5056' } }), [-3.4, 1.7, 26], 0.07, 3.4, { segments: 10, collide: true, shadow: false });
  contact(b, -3.5, 25.9, -3.3, 26.1, 0.12);
  b.cyl(P({ color: { side: '#24484e', py: '#2f565c', pz: '#c6e8d8', nz: '#c6e8d8' } }), [-3.4, 3.55, 26], 0.33, 0.12, { axis: 'z', segments: 24, shadow: false });

  // ---------------------------------------------------------------- 渡り廊下（屋根だけの通路。通路の口から本館の入口まで、西棟の入口へも）
  const [wx0, wx1] = WALKWAY.x;
  const H = WALKWAY.h;
  const col = P({ color: { side: '#1d3f46', py: '#2a5057' } });
  // 屋根の下の面は波板の筋（屋根の長い向きに沿う）
  const deck = P({ color: { py: '#24454c', ny: '#1a3a40', side: '#20434a' }, layers: [{ color: { ny: '#1c3d43' }, scale: 1, threshold: -2, only: 'ceil' }], grid: { layer: 0, size: [0.16, 100], width: 0.03, color: '#14303a' } });
  const deckB = P({ color: { py: '#24454c', ny: '#1a3a40', side: '#20434a' }, layers: [{ color: { ny: '#1c3d43' }, scale: 1, threshold: -2, only: 'ceil' }], grid: { layer: 0, size: [100, 0.16], width: 0.03, color: '#14303a' } });
  const wz0 = LANE.z0 + 0.4;
  const wz1 = WALKWAY.z[1];
  const walkFloor = P({ color: { py: '#11282f', side: '#0f242b' }, cov: sunCov, layers: [sunL('#386b6f', 9)], grid: { layer: 0, size: [0.3, 0.3], width: 0.015, color: '#27535c' } });
  box(walkFloor, [wx0, 0, wz0], [wx1, 0.03, wz1], true);
  for (let z = wz0 + 0.3; z < wz1; z += 3.6) {
    for (const x of [wx0 + 0.1, wx1 - 0.1]) {
      box(col, [x - 0.06, 0, z - 0.06], [x + 0.06, H, z + 0.06], true);
      contact(b, x - 0.06, z - 0.06, x + 0.06, z + 0.06, 0.1, 0.034);
    }
  }
  box(deck, [wx0 - 0.3, H, wz0], [wx1 + 0.3, H + 0.16, wz1]);
  // 屋根の下の梁（柱ごと）と、天井の照明（消えている）
  for (let z = wz0 + 0.3; z < wz1; z += 3.6) box(col, [wx0 - 0.25, H - 0.18, z - 0.05], [wx1 + 0.25, H, z + 0.05]);
  box(col, [wx0 + 0.04, H - 0.14, wz0], [wx0 + 0.14, H, wz1]);
  box(col, [wx1 - 0.14, H - 0.14, wz0], [wx1 - 0.04, H, wz1]);
  box(col, [(wx0 + wx1) / 2 - 0.55, H - 0.07, wz0], [(wx0 + wx1) / 2 - 0.5, H, wz1]);
  box(col, [(wx0 + wx1) / 2 + 0.5, H - 0.07, wz0], [(wx0 + wx1) / 2 + 0.55, H, wz1]);
  // 渡り廊下の照明（夕方なので点いている。床に光だまり。照らす箱は渡り廊下の床の上だけ）
  const wLamp = P({ color: { ny: '#d9f4e8', side: '#9fc8b8' }, fog: 0.4, lamp: 0 });
  for (let z = wz0 + 2.1; z < wz1; z += 7.2) {
    box(wLamp, [(wx0 + wx1) / 2 - 0.08, H - 0.06, z - 0.6], [(wx0 + wx1) / 2 + 0.08, H, z + 0.6]);
    b.ctx.addLamp({ pos: [(wx0 + wx1) / 2, 2.0, z], radius: 2.9, intensity: 1.4, color: '#e6fff4', down: true, shadow: 0, box: [wx0, -0.1, wz0, wx1, H, wz1] });
  }
  // 自動販売機の前の明るさ
  b.ctx.addLamp({ pos: [4.2, 1.1, 19.0], radius: 2.0, intensity: 0.9, color: '#e8fff6', shadow: 0, box: [2.6, -0.1, 18.7, 5.8, 2.4, 20.6] });
  // 屋根の縁（鼻隠し）と樋・たて樋
  box(P({ color: { side: '#2a5057', py: '#2f575e' } }), [wx0 - 0.32, H + 0.1, wz0], [wx0 - 0.28, H + 0.3, wz1]);
  box(P({ color: { side: '#2a5057', py: '#2f575e' } }), [wx1 + 0.28, H + 0.1, wz0], [wx1 + 0.32, H + 0.3, wz1]);
  b.cyl(col, [wx1 + 0.2, H / 2, wz0 + 0.3], 0.045, H, { segments: 8, shadow: false });
  // 西棟の入口への枝（中庭の北の縁に沿って）
  const bx1 = wx0;
  const bx0 = -15.5;
  const bz0 = 18.6;
  const bz1 = 21.2;
  box(walkFloor, [bx0, 0, bz0], [bx1, 0.03, bz1], true);
  for (let x = bx1 - 3.0; x > bx0; x -= 3.6) for (const z of [bz0 + 0.12, bz1 - 0.12]) box(col, [x - 0.06, 0, z - 0.06], [x + 0.06, H, z + 0.06], true);
  box(deckB, [bx0, H, bz0 - 0.3], [bx1, H + 0.16, bz1 + 0.3]);
  // 枝の屋根の下: 母屋（細い梁）・照明・行き先の札
  for (const z of [bz0 + 0.6, (bz0 + bz1) / 2, bz1 - 0.6]) box(col, [bx0, H - 0.08, z - 0.03], [bx1, H, z + 0.03]);
  for (const x of [bx1 - 4.5, bx1 - 11.7]) box(P({ color: { ny: '#6f9a90', side: '#3f6a66' } }), [x - 0.6, H - 0.06, (bz0 + bz1) / 2 - 0.08], [x + 0.6, H - 0.0, (bz0 + bz1) / 2 + 0.08]);
  box(col, [bx0 + 1.6, H - 0.55, (bz0 + bz1) / 2 - 0.01], [bx0 + 1.62, H, (bz0 + bz1) / 2 + 0.01]);
  box(P({ color: { side: '#5f9790' } }), [bx0 + 1.58, H - 0.85, (bz0 + bz1) / 2 - 0.45], [bx0 + 1.64, H - 0.55, (bz0 + bz1) / 2 + 0.45]);
  {
    // 行き先の札（両面）
    const sf = new LocalFrame({ origin: [bx0 + 1.61, (bz0 + bz1) / 2], tangent: [0, -1], normal: [1, 0] } as WingFrame);
    notice(b, sf, 'w', 0.032, -0.42, 0.42, H - 0.82, H - 0.58, 1, 25, 1);
    notice(b, sf, 'w', -0.032, -0.42, 0.42, H - 0.82, H - 0.58, -1, 26, 1);
  }
  // 案内の札（渡り廊下の柱）
  box(P({ color: { side: '#3a6a6a', px: '#6a9a90', nx: '#6a9a90' } }), [wx1 - 0.18, 1.9, 24.0], [wx1 - 0.14, 2.2, 24.7]);

  // ---------------------------------------------------------------- 本館の北の面（廊下側。4 階建て）
  const mFr = new LocalFrame({ origin: [MAIN.x[0], MAIN.z[0]], tangent: [1, 0], normal: [0, -1] });
  const mOps: Opening[] = [];
  const mLen = MAIN.x[1] - MAIN.x[0];
  const entryU = (wx0 + wx1) / 2 - MAIN.x[0];
  for (let u = 0.5; u < mLen - 4; u += 4.5) {
    const a = u + 0.35;
    const c = u + 4.5 - 0.35;
    for (let f = 0; f < MAIN.fl.length; f++) {
      if (f === 0 && Math.abs((a + c) / 2 - entryU) < 3) continue;
      const fl = MAIN.fl[f];
      mOps.push({ u0: a, u1: c, y0: fl + 0.9, y1: fl + 2.75, mull: evenMull(a, c, 4), trans: [fl + 2.2], cell: [a - 4, c + 4, fl, fl + 3.0], room: [2.8, ROOM.corridor, 200 + f * 13 + u, GLASS_MODE.mapped] });
    }
  }
  // 入口（ガラスの両開きの戸と袖のガラス。鍵）
  mOps.push({ u0: entryU - 2.0, u1: entryU + 2.0, y0: 0.05, y1: 2.6, mull: [entryU - 1.0, entryU, entryU + 1.0], trans: [2.15], noSill: true, cell: [entryU - 4, entryU + 4, 0, 3.4], room: [6, ROOM.office, 9, GLASS_MODE.mapped] });
  const mGlass = createGlass(mFr, { glassW: -0.1, opposite: { w: 22, top: 17, base: 0, pitch: 3.6, sill: 1.2, head: 3.9, treeTop: 12, trees: 1 }, k0: 0.25 }, { win: '#21474e', win2: '#3f7074' });
  mGlass.transparent = false;
  const mWall = facadeMat(mFr, { colors: { front: '#173740', side: '#122c33', top: '#21434a', bottom: '#0e2127', back: '#1f3d44' }, hi: { front: '#1c3f47', side: '#15323a', top: '#264c53' }, grad: [2, 12], grid: { size: [1.8, 0.9], width: 0.014, faces: [0], jitter: 0.07, mul: 0.8 } });
  buildFacade(
    b,
    {
      fr: mFr,
      u0: 0,
      u1: mLen,
      bottom: -0.2,
      thick: 0.3,
      glassW: -0.1,
      top: () => MAIN.parapet,
      openings: mOps,
      belts: MAIN.fl.slice(1),
      streaks: streakMat(),
      seed: 6,
      piers: Array.from({ length: Math.floor((mLen - 1) / 4.5) + 1 }, (_, i) => ({ u: 0.5 + i * 4.5, width: 0.4, out: 0.08, y0: -0.2 })),
      collideTo: 4,
      coping: true,
    },
    {
      wall: mWall,
      pier: facadeMat(mFr, { colors: { front: '#13303a', side: '#0f262d', top: '#1c3a41' } }),
      frame: facadeMat(mFr, { colors: { front: '#0e2026', side: '#16313a', top: '#1d3d44' } }),
      sill: facadeMat(mFr, { colors: { front: '#183740', top: '#2a5056', side: '#132c33' } }),
      glass: mGlass,
      coping: facadeMat(mFr, { colors: { front: '#1a363d', top: '#2a5257', side: '#16303a' } }),
    },
  );
  // 入口の庇と、上の時計・校章の板
  box(P({ color: { py: '#2a5056', ny: '#1c3c42', side: '#21444b' } }), [MAIN.x[0] + entryU - 2.6, 2.95, MAIN.z[0] - 1.6], [MAIN.x[0] + entryU + 2.6, 3.15, MAIN.z[0]]);
  b.cyl(P({ color: { nz: '#c6e8d8', side: '#24484e' } }), [MAIN.x[0] + entryU, 13.2, MAIN.z[0] - 0.05], 0.55, 0.08, { axis: 'z', segments: 28, shadow: false });
  // 本館の入口の戸（ガラス。鍵）: 当たり判定（閉じたまま）
  b.ctx.colliders.add({ x: MAIN.x[0] + entryU - 2.0, y: 0, z: MAIN.z[0] - 0.12 }, { x: MAIN.x[0] + entryU + 2.0, y: 2.6, z: MAIN.z[0] + 0.1 });
  // 下駄箱の見える入口の奥（ガラス越し）は窓の中の部屋で描く。屋根・奥の箱
  box(P({ color: { py: '#24454c', side: '#1a3a40' }, fog: 0.8 }), [MAIN.x[0], 0, MAIN.z[0] + 0.3], [MAIN.x[1], MAIN.parapet - 0.9, MAIN.z[1]], false);
  // 傘立て・マット（入口の前）
  box(P({ color: { py: '#173a3c', side: '#132f31' } }), [MAIN.x[0] + entryU - 1.5, 0, MAIN.z[0] - 1.3], [MAIN.x[0] + entryU + 1.5, 0.02, MAIN.z[0] - 0.2]);
  for (const s of [-1, 1]) box(P({ color: { side: '#2f5a5e', py: '#3a666a' } }), [MAIN.x[0] + entryU + s * 2.3 - 0.35, 0, MAIN.z[0] - 0.5], [MAIN.x[0] + entryU + s * 2.3 + 0.35, 0.55, MAIN.z[0] - 0.2], true);

  // ---------------------------------------------------------------- 自動販売機（東棟の南の壁ぞい。渡り廊下の東）
  contact(b, 2.6, 18.0, 5.15, 18.72, 0.15);
  vending(b, [3.2, 0, EAST.u0 * -1], '#b9e8d2', '#386b6f');
  vending(b, [4.2, 0, EAST.u0 * -1], '#b9e8d2', '#27535c');
  // 自販機の横のベンチ（背なし）と、もう 1 つの回収箱
  {
    const seatM = P({ color: { py: '#386b6f', side: '#27535c', ny: '#18363f' } });
    const legM = P({ color: { side: '#1b3b44', py: '#27535c' } });
    for (let i = 0; i < 4; i++) box(seatM, [5.35 + i * 0.26, 0.42, 18.15], [5.58 + i * 0.26, 0.45, 18.55]);
    for (const x of [5.45, 6.3]) box(legM, [x - 0.03, 0, 18.18], [x + 0.03, 0.42, 18.52]);
    box(legM, [5.35, 0.36, 18.33], [6.4, 0.39, 18.37]);
    contact(b, 5.35, 18.15, 6.4, 18.55, 0.08);
    b.ctx.colliders.add({ x: 5.35, y: 0, z: 18.15 }, { x: 6.4, y: 0.45, z: 18.55 });
    box(P({ color: { side: '#27535c', py: '#386b6f', pz: '#1f454d' } }), [2.0, 0, 18.05], [2.5, 0.85, 18.45], true);
    box(P({ color: { pz: '#0d2026' } }), [2.15, 0.62, 18.451], [2.35, 0.72, 18.452]);
    contact(b, 2.0, 18.05, 3.1, 18.45, 0.08);
  }
  // 空き缶・ペットボトルの回収箱
  box(P({ color: { side: '#3f7a80', py: '#4c878c', pz: '#3a7076' } }), [2.6, 0, 18.05], [3.1, 0.85, 18.45], true);
  box(P({ color: { pz: '#0d2026' } }), [2.75, 0.62, 18.451], [2.95, 0.72, 18.452]);

  // ---------------------------------------------------------------- 東棟の外階段（屋外避難階段。各階の非常口へ。扉は鍵）
  fireStair(b);
  // 各階の非常口の扉（鉄の扉・鍵）
  for (let f = 0; f < EAST.fl.length; f++) {
    const y = f === 0 ? 0 : EAST.fl[f];
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.0, 0.05).translate(0.5, 1.0, 0), P({ color: { pz: '#1f444c', side: '#183a41' } }));
    leaf.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.05).translate(0.88, 1.0, 0.04), P({ color: '#4a7a7c' })));
    // 非常口の表示（緑の灯り）
    leaf.add(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.13, 0.02).translate(0.5, 2.25, -0.02), P({ color: '#5fd3a4', noFog: false })));
    doors.add({ leaf, pivot: [EAST.origin[0] + 8.6, y, 18.03 + 0.12], yaw: 0, swing: 1.4, locked: true });
  }

  // ---------------------------------------------------------------- 駐輪場（西棟と車路の間）
  buildBikeShed(b, r);

  // ---------------------------------------------------------------- 中庭の東のフェンス（向こうは校庭）・西の塀
  const fpost = P({ color: { side: '#1c3d45', py: '#2a5057' }, fog: 0.8 });
  const fmesh = P({ color: { side: '#1d4049' }, fog: 0.8, side: THREE.DoubleSide });
  const fx = cx1;
  const fence = (z0: number, z1: number): void => {
    for (let z = z0; z <= z1 + 1e-3; z += 2) box(fpost, [fx - 0.03, 0, z - 0.03], [fx + 0.03, 1.9, z + 0.03]);
    box(fpost, [fx - 0.03, 1.86, z0], [fx + 0.03, 1.92, z1]);
    for (let z = z0 + 0.12; z < z1; z += 0.25) box(fmesh, [fx - 0.008, 0.05, z - 0.008], [fx + 0.008, 1.86, z + 0.008]);
    for (let y = 0.4; y < 1.86; y += 0.4) box(fmesh, [fx - 0.008, y - 0.008, z0], [fx + 0.008, y + 0.008, z1]);
    b.ctx.colliders.add({ x: fx - 0.1, y: 0, z: z0 }, { x: fx + 0.1, y: 2, z: z1 });
  };
  fence(LANE.z0, 28);
  fence(31, cz1);
  // 門扉（校庭へ。鍵）
  const gate = P({ color: { side: '#21474f', py: '#2c565d' }, fog: 0.8 });
  for (let z = 28; z < 31; z += 0.14) box(gate, [fx - 0.025, 0.08, z], [fx + 0.025, 1.5, z + 0.03]);
  box(gate, [fx - 0.04, 1.45, 28], [fx + 0.04, 1.52, 31]);
  box(gate, [fx - 0.04, 0.06, 28], [fx + 0.04, 0.12, 31]);
  b.ctx.colliders.add({ x: fx - 0.1, y: 0, z: 28 }, { x: fx + 0.1, y: 1.6, z: 31 });
  // 校庭（入れない。土の広場・バックネット・遠くの木）
  const gRect: [number, number, number, number] = [cx1 + 0.2, -40, 90, 60];
  const ground = P({ color: { py: '#1b3b44' }, cov: { texture: groundSun(gRect, 1), rect: gRect }, layers: [{ color: '#1f454d', scale: 0.12, threshold: 0.55, only: 'floor' }, sunLayer('#386b6f', 22)], fog: 1 });
  box(ground, [cx1 + 0.2, -0.25, -40], [90, -0.05, 60]);
  // バックネット（柱 3 本と金網）・サッカーのゴール・遠くの体育館
  const net = P({ color: { side: '#2a4f50', py: '#33595a' }, fog: 1 });
  const bx = 44;
  for (const z of [16, 21, 26]) b.cyl(net, [bx, 4.5, z], 0.1, 9, { segments: 8, shadow: false });
  for (let y = 0.6; y < 9; y += 0.5) box(net, [bx - 0.01, y, 16], [bx + 0.01, y + 0.02, 26]);
  for (let z = 16; z < 26; z += 0.5) box(net, [bx - 0.01, 0, z], [bx + 0.01, 9, z + 0.02]);
  for (const z of [-20, 10]) {
    box(net, [60, 0, z - 3.6], [60.1, 2.44, z - 3.5]);
    box(net, [60, 0, z + 3.5], [60.1, 2.44, z + 3.6]);
    box(net, [60, 2.34, z - 3.6], [60.1, 2.44, z + 3.6]);
    box(net, [61.5, 0, z - 3.6], [61.6, 0.1, z + 3.6]);
  }
  box(P({ color: { nx: '#2f5a5a', side: '#2a5252', py: '#356262' }, fog: 1 }), [68, 0, -10], [92, 13, 30]);
  box(P({ color: { side: '#2c5555', py: '#336060' }, fog: 1 }), [68, 13, -10], [92, 15.5, 30]);
  const farTree = createLeafMaterial(makeLeafTexture(77, { clumps: 30, leaf: 7, litSide: 0.6, fill: 1.4 }), '#1f4446', '#2c5856', 1, { cardEdge: 0.5, fog: 1 });
  (farTree.uniforms.uMap.value as THREE.Texture).wrapS = (farTree.uniforms.uMap.value as THREE.Texture).wrapT = THREE.RepeatWrapping;
  for (let z = -30; z < 55; z += 7) b.mesh(leafCluster([82, 4, z], [3, 7, 6], 6, 500 + z, Math.PI / 2, 2), farTree, [0, 0, 0], { shadow: false });
  // 西の塀（ブロック塀。中庭の西の端）
  const block = P({ color: { side: '#183338', py: '#22424a' }, layers: [{ color: '#183338', scale: 1, threshold: -2, only: 'wall' }], grid: { layer: 0, size: [0.4, 0.2], width: 0.012, color: '#142b30' } });
  box(block, [cx0 - 0.2, 0, wsW[1] - 0.3], [cx0, 2.0, cz1], true);
  box(block, [cx0, 0, wsW[1] - 0.3], [wsW[0], 2.0, wsW[1] - 0.1], true);
  // 塀の向こうの家（2 階建て）とアパート
  house(b, cx0 - 11, 17, cx0 - 2.5, 25, 6.2, 2, 301);
  house(b, cx0 - 11, 27, cx0 - 2.5, 34, 5.8, 2, 302);
  apartment(b, cx0 - 11, 36, cx0 - 2.5, 46, 10.5, 3, 303);
  // 塀ぞいの低い植え込み
  for (let z = 22; z < cz1 - 1; z += 1.5) b.mesh(leafCluster([cx0 + 0.6, 0.5, z], [0.9, 0.9, 1.5], 4, 600 + z, Math.PI / 2, 1.2), shrub, [0, 0, 0], { shadow: false });

  // ---------------------------------------------------------------- 西棟の裏の細い土地（入れない。教室の窓から見える）
  westStrip(b, r);
}

/** 自動販売機（前が光る。商品見本の段・取り出し口） */
function vending(b: Builder, at: V3, face: string, body: string): void {
  const [x, , z] = at;
  const box = (m: THREE.Material, min: V3, max: V3, collide = false): void => {
    b.boxMM(m, min, max, { collide, shadow: false });
  };
  const bodyM = P({ color: { side: body, py: body, pz: body }, fog: 0.8 });
  box(bodyM, [x, 0, z], [x + 0.95, 1.83, z + 0.72], true);
  const panel = P({ color: { pz: face }, fog: 0.6 });
  box(panel, [x + 0.07, 0.95, z + 0.72], [x + 0.88, 1.75, z + 0.725]);
  // 商品見本（3 段）
  const cols = ['#8f7a70', '#5f8a9a', '#a8a07a', '#5f9790', '#8a7a80', '#b9e8d2'];
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 6; i++) {
      const cx = x + 0.13 + i * 0.125;
      const cy = 1.04 + row * 0.24;
      box(P({ color: cols[(i + row * 2) % cols.length], fog: 0.6 }), [cx, cy, z + 0.726], [cx + 0.07, cy + 0.14, z + 0.73]);
      box(P({ color: '#2f5f63', fog: 0.6 }), [cx, cy - 0.04, z + 0.726], [cx + 0.07, cy - 0.02, z + 0.73]);
    }
  }
  box(P({ color: { pz: '#0e2228' }, fog: 0.8 }), [x + 0.15, 0.18, z + 0.72], [x + 0.8, 0.42, z + 0.73]);
  box(P({ color: { pz: '#3a6a72' }, fog: 0.8 }), [x + 0.66, 0.6, z + 0.72], [x + 0.84, 0.85, z + 0.73]);
  // 前の面の帯（銘柄の帯・お金の口とボタンの列・取り出し口の縁）と、横の面の広告
  box(P({ color: { pz: '#27535c' }, fog: 0.8 }), [x + 0.04, 1.77, z + 0.72], [x + 0.91, 1.81, z + 0.728]);
  box(P({ color: { pz: '#1f454d' }, fog: 0.8 }), [x + 0.04, 0.88, z + 0.72], [x + 0.91, 0.92, z + 0.728]);
  for (let i = 0; i < 4; i++) box(P({ color: { pz: '#b9e8d2' }, fog: 0.8, lamp: 0 }), [x + 0.7, 0.64 + i * 0.05, z + 0.731], [x + 0.8, 0.66 + i * 0.05, z + 0.734]);
  box(P({ color: { pz: '#386b6f' }, fog: 0.8 }), [x + 0.12, 0.43, z + 0.72], [x + 0.83, 0.46, z + 0.735]);
  const fr = new LocalFrame({ origin: [x, z + 0.72], tangent: [0, -1], normal: [-1, 0] } as WingFrame);
  notice(b, fr, 'w', 0.002, 0.08, 0.64, 0.95, 1.7, 1, 17 + Math.floor((x * 7) % 6), 0.8);
}

/** 東棟の南の端の外階段（鉄骨の折り返し階段。踏み板・ささら桁・手すり。段は当たり判定の薄い板） */
function fireStair(b: Builder): void {
  const steel = P({ color: { side: '#1d3f46', py: '#2a5359', ny: '#173339' } });
  const tread = P({ color: { py: '#2f5a60', side: '#21454b', ny: '#183539' } });
  const rail = P({ color: { side: '#2a5359', py: '#355f64' } });
  const x0 = EAST.origin[0];
  const zW = 18.0; // 壁の面
  const box = (m: THREE.Material, min: V3, max: V3): void => {
    b.boxMM(m, min, max, { shadow: false });
  };
  const col = b.ctx.colliders;
  const landing = (xa: number, xb: number, za: number, zb: number, y: number): void => {
    box(tread, [xa, y - 0.08, za], [xb, y, zb]);
    col.add({ x: xa, y: y - 0.08, z: za }, { x: xb, y, z: zb });
    // 手すり（外側）
    box(rail, [xa, y + 1.05, zb - 0.04], [xb, y + 1.1, zb]);
    for (let x = xa; x <= xb + 1e-3; x += 0.6) box(rail, [x - 0.015, y, zb - 0.03], [x + 0.015, y + 1.05, zb - 0.01]);
  };
  // 段: (xa → xb の向きに上がる) z の帯、下の高さ y0 から rise
  const flight = (xa: number, xb: number, za: number, zb: number, y0: number, rise: number, railSide: 'out' | 'in'): void => {
    const n = Math.round(rise / 0.17);
    const rh = rise / n;
    const run = (xb - xa) / n;
    for (let i = 0; i < n; i++) {
      const xs = xa + run * i;
      const xe = xa + run * (i + 1);
      const y = y0 + rh * (i + 1);
      box(tread, [Math.min(xs, xe), y - 0.04, za + 0.05], [Math.max(xs, xe), y, zb - 0.05]);
      col.add({ x: Math.min(xs, xe), y: y - 0.04, z: za }, { x: Math.max(xs, xe), y, z: zb });
    }
    // ささら桁（斜めの板）
    const len = Math.hypot(xb - xa, rise);
    for (const z of [za + 0.03, zb - 0.03]) {
      const g = new THREE.BoxGeometry(len, 0.22, 0.03);
      g.rotateZ(Math.atan2(rise, xb - xa));
      g.translate((xa + xb) / 2, y0 + rise / 2 - 0.08, z);
      b.mesh(g, steel, [0, 0, 0], { shadow: false });
    }
    // 手すり
    const rz = railSide === 'out' ? zb - 0.02 : za + 0.02;
    const g = new THREE.BoxGeometry(len, 0.05, 0.04);
    g.rotateZ(Math.atan2(rise, xb - xa));
    g.translate((xa + xb) / 2, y0 + rise / 2 + 0.95, rz);
    b.mesh(g, rail, [0, 0, 0], { shadow: false });
    for (let k = 0; k <= 3; k++) {
      const t = k / 3;
      box(rail, [xa + (xb - xa) * t - 0.015, y0 + rise * t, rz - 0.015], [xa + (xb - xa) * t + 0.015, y0 + rise * t + 0.95, rz + 0.015]);
    }
  };
  const LX0 = x0 + 8.1; // 踊り場（扉の前）
  const LX1 = x0 + 10.1;
  const MX0 = x0 + 4.1; // 中間の踊り場
  const MX1 = x0 + 5.3;
  const zIn0 = zW + 0.05;
  const zIn1 = zW + 1.25;
  const zOut0 = zW + 1.3;
  const zOut1 = zW + 2.5;
  // 1 階の扉の前（地面）から 2 階へ: 外側の帯を西から東へ
  const fl = EAST.fl;
  flight(MX1 - 1.4, LX0, zOut0, zOut1, 0, fl[1], 'out');
  for (let f = 1; f < fl.length; f++) {
    landing(LX0, LX1, zIn0, zOut1, fl[f]);
    if (f === fl.length - 1) break;
    const mid = fl[f] + (fl[f + 1] - fl[f]) / 2;
    flight(LX0, MX1, zIn0, zIn1, fl[f], mid - fl[f], 'in');
    landing(MX0, MX1, zIn0, zOut1, mid);
    flight(MX1, LX0, zOut0, zOut1, mid, fl[f + 1] - mid, 'out');
  }
  // 開いた縁の手すり（踊り場の東の縁・中間の踊り場の西の縁）
  const top = fl[fl.length - 1];
  for (let f = 1; f < fl.length; f++) {
    const y = fl[f];
    box(rail, [LX1 - 0.04, y + 1.05, zIn0], [LX1, y + 1.1, zOut1]);
    for (let z = zIn0 + 0.3; z < zOut1; z += 0.6) box(rail, [LX1 - 0.03, y, z - 0.015], [LX1 - 0.01, y + 1.05, z + 0.015]);
    if (f < fl.length - 1) {
      const mid = fl[f] + (fl[f + 1] - fl[f]) / 2;
      box(rail, [MX0, mid + 1.05, zIn0], [MX0 + 0.04, mid + 1.1, zOut1]);
      box(rail, [MX0, mid + 1.05, zOut1 - 0.04], [MX1, mid + 1.1, zOut1]);
      for (let z = zIn0 + 0.3; z < zOut1; z += 0.6) box(rail, [MX0 + 0.01, mid, z - 0.015], [MX0 + 0.03, mid + 1.05, z + 0.015]);
    }
  }
  // 当たり判定: 手すりの所は越えられない（踊り場・段から外へ落ちたり、上り下りの段の間を渡ったりしない）。
  // 手すりは細いので、外の縁と上り下りの段の間（ささら桁）は踊り場の高さから上を板の壁にする
  col.add({ x: MX0, y: 1.0, z: zOut1 - 0.02 }, { x: LX1, y: top + 1.6, z: zOut1 + 0.04 });
  col.add({ x: LX1 - 0.02, y: 1.0, z: zIn0 }, { x: LX1 + 0.04, y: top + 1.6, z: zOut1 + 0.04 });
  col.add({ x: MX0 - 0.04, y: 3.0, z: zIn0 }, { x: MX0 + 0.02, y: top + 1.6, z: zOut1 + 0.04 });
  col.add({ x: MX1, y: 0, z: zIn1 }, { x: LX0, y: top + 1.6, z: zOut0 });
  // 柱（四隅）と壁へのつなぎ
  for (const [x, z] of [[LX1, zOut1], [MX0, zOut1], [LX1, zIn0 + 0.05], [MX0, zIn0 + 0.05]]) {
    box(steel, [x - 0.06, -0.1, z - 0.06], [x + 0.06, fl[fl.length - 1] + 1.1, z + 0.06]);
    col.add({ x: x - 0.08, y: 0, z: z - 0.08 }, { x: x + 0.08, y: 2.2, z: z + 0.08 });
  }
  // 地面の上り口の囲い（1 階の扉は地面の高さ）
  box(tread, [LX0, -0.02, zIn0], [LX1, 0.0, zIn1]);
}

/** 駐輪場（片流れの屋根・柱・ラックと自転車） */
function buildBikeShed(b: Builder, r: () => number): void {
  const [x0, x1] = BIKES.x;
  const [z0, z1] = BIKES.z;
  const post = P({ color: { side: '#1f4047', py: '#2b5157' } });
  // 波板の屋根（下の面にも波の筋）
  const roof = P({ color: { py: '#2b4f55', ny: '#1c3b41', side: '#24474d' }, side: THREE.DoubleSide, layers: [{ color: { ny: '#1c3b41' }, scale: 1, threshold: -2, only: 'ceil' }], grid: { layer: 0, size: [100, 0.16], width: 0.035, color: '#122a31' } });
  const box = (m: THREE.Material, min: V3, max: V3, collide = false): void => {
    b.boxMM(m, min, max, { collide, shadow: false });
  };
  // 柱（車路の側に 1 列、壁の側に 1 列）
  for (let z = z0 + 0.2; z < z1; z += 2.6) {
    box(post, [x1 - 0.12, 0, z - 0.05], [x1 - 0.02, 2.55, z + 0.05], true);
    box(post, [x0 + 0.02, 0, z - 0.05], [x0 + 0.12, 2.2, z + 0.05], true);
  }
  // 片流れの屋根（波板）
  const len = Math.hypot(x1 - x0 + 0.6, 0.35);
  const g = new THREE.BoxGeometry(len, 0.04, z1 - z0 + 0.4);
  g.rotateZ(Math.atan2(0.35, x1 - x0 + 0.6));
  g.translate((x0 + x1) / 2, 2.4, (z0 + z1) / 2);
  b.mesh(g, roof, [0, 0, 0], { shadow: false });
  // 波の筋
  for (let z = z0 - 0.1; z < z1 + 0.2; z += 0.25) {
    const s = new THREE.BoxGeometry(len, 0.02, 0.03);
    s.rotateZ(Math.atan2(0.35, x1 - x0 + 0.6));
    s.translate((x0 + x1) / 2, 2.43, z);
    b.mesh(s, roof, [0, 0, 0], { shadow: false });
  }
  // ラック（前輪を差す金物）と自転車（東向き）
  const rack = P({ color: { side: '#2a5257', py: '#35616a' } });
  contact(b, x1 - 2.1, z0 + 0.3, x1 - 0.9, z1 - 0.3, 0.05);
  box(rack, [x1 - 1.0, 0, z0 + 0.3], [x1 - 0.95, 0.35, z1 - 0.3]);
  const colors = ['#2a5560', '#3a6a64', '#1f4a55', '#4a6f6a', '#2f5a6a', '#506e6a'];
  for (let z = z0 + 0.5; z < z1 - 0.3; z += 0.62) {
    if (r() < 0.22) continue;
    bike(b, [x1 - 1.5 + (r() - 0.5) * 0.1, 0, z], Math.PI + (r() - 0.5) * 0.1, colors[Math.floor(r() * colors.length)]);
  }
  // 屋根の下の照明（点いている。床に光だまり）
  for (const z of [z0 + 3.4, z1 - 3.4]) {
    box(P({ color: { ny: '#d9f4e8', side: '#9fc8b8' }, fog: 0.4, lamp: 0 }), [(x0 + x1) / 2 - 0.6, 2.25, z - 0.07], [(x0 + x1) / 2 + 0.6, 2.32, z + 0.07]);
    b.ctx.addLamp({ pos: [(x0 + x1) / 2, 1.7, z], radius: 2.6, intensity: 1.3, color: '#e6fff4', down: true, shadow: 0, box: [x0, -0.1, z0, x1 - 0.02, 2.5, z1] });
  }
  // 駐輪場の床（コンクリートの土間。目地）
  box(P({ color: { py: '#15303a', side: '#122a31' }, layers: [{ color: '#15303a', scale: 1, threshold: -2, only: 'floor' }], grid: { layer: 0, size: [1.4, 1.3], width: 0.02, color: '#0f262d' } }), [x0, 0, z0 - 0.2], [x1, 0.01, z1 + 0.2]);
  // 駐輪場の地面の線と番号の札
  for (let z = z0; z <= z1; z += 2.6) box(P({ color: '#2a5056' }), [x0, 0.01, z - 0.03], [x1, 0.014, z + 0.03]);
  box(P({ color: { side: '#3a6a6a', px: '#5f8f86' } }), [x1 - 0.02, 1.9, z0 + 0.8], [x1, 2.2, z0 + 1.6]);
}

/** 西棟の裏の細い土地（砂利・低い木・ブロック塀・向こうの家） */
function westStrip(b: Builder, r: () => number): void {
  const box = (m: THREE.Material, min: V3, max: V3, collide = false): void => {
    b.boxMM(m, min, max, { collide, shadow: false });
  };
  const gravel = P({ color: { py: '#18333a' }, layers: [{ color: '#20414a', scale: 2.2, threshold: 0.55, only: 'floor', detail: 0.8 }] });
  const block = P({ color: { side: '#1d3a40', py: '#26474e' }, layers: [{ color: '#1d3a40', scale: 1, threshold: -2, only: 'wall' }], grid: { layer: 0, size: [0.4, 0.2], width: 0.012, color: '#183238' }, fog: 0.6 });
  const shrubTex = makeLeafTexture(83, { clumps: 30, leaf: 6, litSide: 0.7, fill: 1.4 });
  shrubTex.wrapS = shrubTex.wrapT = THREE.RepeatWrapping;
  const tree = createLeafMaterial(shrubTex, '#1a3b3d', '#2f5c58', 1, { cardEdge: 0.5, fog: 0.6 });
  const trunk = P({ color: { side: '#173238', py: '#1f3d42' }, fog: 0.6 });
  for (let u = WEST.u0; u < WEST.u1; u += 2) {
    const a = wpos(WEST, u, -WEST.depth);
    const c = wpos(WEST, u + 2, -WEST.depth - 4.5);
    box(gravel, [Math.min(a[0], c[0]), -0.2, Math.min(a[1], c[1])], [Math.max(a[0], c[0]), 0, Math.max(a[1], c[1])], true);
    // 塀（境界: 壁から 4 m）
    const w0 = wpos(WEST, u, -WEST.depth - 4.0);
    const w1 = wpos(WEST, u + 2, -WEST.depth - 4.3);
    box(block, [Math.min(w0[0], w1[0]), 0, Math.min(w0[1], w1[1])], [Math.max(w0[0], w1[0]), 2.0, Math.max(w0[1], w1[1])], true);
    if (r() < 0.6) {
      const t = wpos(WEST, u + 1, -WEST.depth - 2.8);
      const h = 1.6 + r() * 0.8;
      b.cyl(trunk, [t[0], h / 2, t[1]], 0.07, h, { segments: 6, shadow: false });
      b.mesh(leafCluster([t[0], h + 0.6, t[1]], [1.8, 1.8, 1.6], 5, 700 + u * 3, r() * 3, 1.4), tree, [0, 0, 0], { shadow: false });
    }
  }
  // 塀の向こうの家（2 階建て。切妻の屋根）
  for (let u = WEST.u0 + 2; u < WEST.u1 - 4; u += 9.5) {
    const c = wpos(WEST, u + 3.5, -WEST.depth - 10);
    const w = 7 + r() * 2;
    const h = 5.6 + r() * 1.2;
    if (r() < 0.25) apartment(b, c[0] - 4, c[1] - w / 2, c[0] + 4, c[1] + w / 2, h + 3, 3, 320 + Math.floor(u), 0.6);
    else house(b, c[0] - 4, c[1] - w / 2, c[0] + 4, c[1] + w / 2, h, 2, 320 + Math.floor(u), 0.6);
  }
}
