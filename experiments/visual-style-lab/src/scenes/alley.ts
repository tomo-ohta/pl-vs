import * as THREE from 'three';
import { DEFAULT_STYLE, makeStyle } from '../render/Style.ts';
import { createFacadeMaterial, FacadePainter, refCamera, type FacadeTile, type P2 } from './alley/facade.ts';
import { paintLeft, paintRight } from './alley/layout.ts';
import { createLeafMaterial, leafCluster, makeLeafTexture, makeTreeTexture } from './alley/foliage.ts';
import { makeFarFacade } from './alley/textures.ts';
import { Builder, rng, type V3 } from './Builder.ts';
import { createPaint, makeCoverage, type PaintOptions } from '../render/PaintMaterial.ts';
import type { SceneDef } from './types.ts';

/**
 * 校舎の間の通路（alley-0）。暗い青緑のセル調。両側に鉄骨の大きな窓の並ぶ校舎、窓には木の葉と明るい建物が映る。
 * 突き当たりに低い建物と明るい緑の木、その奥に白く霞んだ高い建物。
 * 照明は使わず、面ごとの色を直接塗る（pastel/paint.ts）。
 * 校舎の壁面（窓・腰壁・柱・映り込み・葉の影）は、壁の平面に描いた絵を貼る（alley/facade.ts・配置は alley/layout.ts）。
 * 座標: 目の位置が x = 0・z = 0、奥が -Z。床 y = 0。
 * 右の校舎の壁は x = 2.5 で通路と平行。左の校舎の壁は奥ほど通路に寄る（参考画像の消失点に合わせた）。
 */
const style = makeStyle(DEFAULT_STYLE, {
  name: 'alley',
  background: '#0c1d23',
  fog: { horizon: '#3d7d7f', zenith: '#5a9893', ground: '#3d7d7f', density: 0.045, heightFalloff: 0, baseHeight: 0, start: 22, max: 0.9, steps: 0 },
  post: {
    bloom: { strength: 0, threshold: 1.0, radius: 0.6 },
    diffusion: { amount: 0.08, threshold: 0.75, radius: 0.6 },
    lines: { enabled: false, color: '#06141a', width: 1, depth: 0.1, normal: 0.6, id: 0, breakup: 0.3, fadeFar: 30, opacity: 0.8 },
    kuwahara: { enabled: false, radius: 3, sharpness: 8, aniso: 1 },
    grade: { exposure: 1, lift: 0, gamma: 1, gain: 1, saturation: 1, hue: 0, tint: [0, 0], posterize: 0, vignette: 0, grain: 0 },
  },
});

/** 左の校舎の壁の線: x = L0 + LK・d（d = -z） */
const L0 = -7.73;
const LK = 0.198;
const L_ANG = Math.atan(LK);

export const alley: SceneDef = {
  id: 'alley',
  label: '校舎の間の通路',
  style,
  sky: {},
  views: [{ id: 'alley-0', label: '通路の手前から奥を見る', eye: [0, 1.6, 0], yaw: -0.0167, pitch: 0.0984, fov: 48.8 }],
  build(ctx) {
    const b = new Builder(ctx);
    const P = (o: PaintOptions): THREE.ShaderMaterial => createPaint(o);
    const box = (m: THREE.Material, min: V3, max: V3, collide = false): THREE.Mesh => b.boxMM(m, min, max, { collide, shadow: false });
    // 左の校舎の座標（lx: 壁から通路へ、y、lz: 壁に沿って奥へ負）
    const lm = new THREE.Matrix4().makeRotationY(-L_ANG).setPosition(L0, 0, 0);
    const boxL = (m: THREE.Material, min: V3, max: V3): void => {
      const g = new THREE.BoxGeometry(Math.abs(max[0] - min[0]), Math.abs(max[1] - min[1]), Math.abs(max[2] - min[2]));
      g.translate((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
      g.applyMatrix4(lm);
      b.mesh(g, m, [0, 0, 0], { shadow: false });
    };
    const r = rng(3);

    const pole = P({ color: '#2d5257', fog: 0.5 });

    // ---------- 床 ----------
    const covRect: [number, number, number, number] = [-3, 2, 3, -40];
    const cov = makeCoverage(covRect, 16, [
      // 日の差し込み（右の歩道。木の葉の影でちぎれる）
      { ch: 0, seg: [1.15, -8.3, 1.15, -9.9], w: 0.5, soft: 0.12 },
      { ch: 0, seg: [1.38, -4.7, 1.38, -5.45], w: 0.22, soft: 0.12 },
      { ch: 0, seg: [1.45, -14.6, 1.45, -15.5], w: 0.18, soft: 0.1 },
      { ch: 0, seg: [1.5, -29.5, 2.4, -29.5], w: 0.5, soft: 0.2 },
    ]);
    const sunLayer = { color: '#3b7378', scale: 3.0, threshold: 1.0, cov: 0.6, stretch: [1, 1] as [number, number], detail: 0.6, only: 'floor' as const, seed: 1 };
    const floor = P({ color: '#0e222b' });
    box(floor, [-12, -0.2, 10], [12, 0, -60], true);
    // 右の歩道（敷石の升目。日なただけ目地が見える）
    const walk = P({
      color: '#0f2530',
      cov: { texture: cov, rect: covRect },
      layers: [sunLayer],
      grid: { layer: 0, size: [0.62, 0.62], width: 0.035, color: '#1f474e' },
    });
    box(walk, [0.85, 0, 10], [2.5, 0.005, -34]);
    // 白線（左の線は薄い。歩道の中に白い線）
    const lineMat = P({ color: '#132a34' });
    box(lineMat, [-0.4, 0, 10], [-0.33, 0.012, -33.4]);
    const walkLine = P({ color: '#10262f', cov: { texture: cov, rect: covRect }, layers: [{ ...sunLayer, color: '#a6d6d0' }] });
    box(walkLine, [1.29, 0.005, 10], [1.34, 0.008, -34]);
    // 排水の蓋
    const lid = P({ color: '#1d3a44' });
    box(lid, [-1.45, 0, -5.12], [-1.15, 0.012, -5.3]);
    box(lid, [-1.1, 0, -4.96], [-0.82, 0.012, -5.1]);

    // ---------- 壁面の絵（左右の校舎）----------
    // 壁は 1 枚の平面に、窓・腰壁・柱・映り込み・葉の影を描いた絵を貼る（alley/facade.ts・layout.ts）
    const cam = refCamera(alley.views[0]);
    const lerpRoof = (pts: P2[], u: number): number => {
      if (u <= pts[0][0]) return 30;
      for (let i = 1; i < pts.length; i++) if (u <= pts[i][0]) return pts[i - 1][1] + ((pts[i][1] - pts[i - 1][1]) * (u - pts[i - 1][0])) / (pts[i][0] - pts[i - 1][0]);
      return pts[pts.length - 1][1];
    };
    const facade = (fp: FacadePainter, roofScreen: P2[], cornerX: number, tiles: FacadeTile[], fog: number): ((u: number) => number) => {
      // 屋根の線（画面の点 → 壁の座標）。手前は画面の外なので高さ 30 m まで
      const roof = roofScreen.map(([x, y]) => fp.s2f(x, y));
      const first = roof[0];
      const corner = fp.s2f(cornerX, 600)[0];
      fp.clearF([[first[0], first[1]], ...roof.slice(1), [corner, roof[roof.length - 1][1]], [corner, 40], [first[0], 40]]);
      fp.clearF([[first[0] - 60, 30], [first[0], 30], [first[0], 40], [first[0] - 60, 40]]);
      fp.clearF([[corner, -1], [corner + 40, -1], [corner + 40, 40], [corner, 40]]);
      for (const t of tiles) b.mesh(fp.plane(t), createFacadeMaterial(fp.raster(t), fog), [0, 0, 0], { shadow: false });
      return (u: number) => Math.min(30, lerpRoof([[first[0] - 0.01, 30], ...roof], u));
    };
    const rightFP = new FacadePainter({ origin: [2.5, 0, 0], tangent: [0, 0, -1], normal: [-1, 0, 0] }, cam, 11);
    paintRight(rightFP);
    const rRoof = facade(
      rightFP,
      [
        [813, -20],
        [811, 0],
        [800, 100],
        [790, 200],
        [777, 300],
      ],
      777,
      [
        { u: [-6, 1], y: [0, 21], ppm: 20 },
        { u: [1, 5], y: [0, 6], ppm: 200 },
        { u: [1, 5], y: [6, 21], ppm: 40 },
        { u: [5, 9], y: [0, 21], ppm: 100 },
        { u: [9, 16], y: [0, 21], ppm: 56 },
        { u: [16, 36], y: [0, 21], ppm: 32 },
      ],
      1,
    );
    const RZ1 = -35; // 右の校舎の奥の端
    const rHeight = (z: number): number => rRoof(-z);
    // 壁の奥の箱（屋根の線より少し低く）
    const rBody = P({ color: { nx: '#122a34', pz: '#10242c', ny: '#0d1f26', py: '#2f5b5f' } });
    for (let z = 10; z > RZ1 + 1e-3; z -= 0.7) box(rBody, [2.52, 0, z], [12, rHeight(z - 0.7) - 0.3, Math.max(z - 0.7, RZ1)], true);
    // その先: 少し引っ込んだ明るい壁（日の当たる別棟）
    const rBack = P({ color: { nx: '#214d58', pz: '#1c4450' }, fog: 0.4 });
    box(rBack, [3.3, 0, RZ1], [12, 9, -45], true);
    // 配管・室外機（奥の壁。日の当たる明るい色）
    const pipe = P({ color: { nx: '#4f8984', px: '#4f8984', pz: '#3f7774', nz: '#3f7774' }, fog: 0.5 });
    for (const [z, y0] of [
      [-31.5, 4],
      [-27.6, 6],
      [-24.0, 7],
    ] as const)
      box(pipe, [2.36, y0, z - 0.05], [2.46, rHeight(z) + 0.3, z + 0.05]);
    const acu = P({ color: { nx: '#5d9890', pz: '#4f8984', py: '#6aa49a', ny: '#3a6c6c', nz: '#3f7774' }, fog: 0.5 });
    for (const [z, y, x0] of [
      [-20.2, 11.65, 1.75],
      [-26.0, 11.85, 1.85],
      [-28.6, 8.3, 1.9],
    ] as const)
      box(acu, [x0, y, z + 0.45], [2.5, y + 0.6, z - 0.45]);
    // 屋上の柱（右の屋根の線の上）
    for (const z of [-25.5, -29, -32.5]) {
      const H0 = rHeight(z);
      box(pole, [2.4, H0 - 0.3, z - 0.03], [2.46, H0 + 2.2, z + 0.03]);
      box(pole, [2.4, H0 + 1.6, z - 0.35], [2.46, H0 + 1.64, z + 0.35]);
    }

    // 右の足元: 低い台（上の縁が明るい）と、黄色い札の付いた小さな配電箱
    const plinth = P({ color: { nx: '#0f272f', py: '#163039', pz: '#122c35', nz: '#0e2129' }, fog: 0.6 });
    box(plinth, [2.05, 0, -3.5], [2.5, 0.85, -16], true);
    // 台の縁（明るい細い線）
    box(P({ color: '#2f5c62', fog: 0.6 }), [2.04, 0.83, -4.6], [2.07, 0.86, -7.0]);
    const cab = P({ color: { nx: '#122c35', pz: '#15313a', py: '#24505a', nz: '#0e2129' }, fog: 0.5 });
    const tag = P({ color: '#a8812f' });
    for (const [x0, z0, z1, h] of [
      [1.92, -4.85, -5.45, 0.55],
      [1.95, -5.6, -6.6, 0.58],
      [1.95, -11.3, -12.1, 0.7],
    ] as const) {
      box(cab, [x0, 0, z0], [2.05, h, z1], true);
      box(tag, [x0 - 0.005, h * 0.55, z0 - 0.06], [x0, h * 0.55 + 0.16, z0 - 0.13]);
    }
    // 台の前の暗い茂み（台の奥を隠す）
    const midBush = createLeafMaterial(makeLeafTexture(37, { clumps: 34, leaf: 7, litSide: 0.9, fill: 1.6 }), '#0a1d24', '#10272e', 1, { fog: 0.3, cardEdge: 0.5 });
    (midBush.uniforms.uMap.value as THREE.Texture).wrapS = (midBush.uniforms.uMap.value as THREE.Texture).wrapT = THREE.RepeatWrapping;
    b.mesh(leafCluster([1.85, 0.55, -8.8], [1.0, 1.2, 4.4], 12, 43, Math.PI / 2, 1.2), midBush, [0, 0, 0], { shadow: false });
    // 右の手前の暗い茂み（画面の右下を覆う）
    const nearBush = createLeafMaterial(makeLeafTexture(31, { clumps: 34, leaf: 7, litSide: 0.8, fill: 1.6 }), '#0a1c22', '#122a31', 1, { fog: 0, cardEdge: 0.5 });
    (nearBush.uniforms.uMap.value as THREE.Texture).wrapS = (nearBush.uniforms.uMap.value as THREE.Texture).wrapT = THREE.RepeatWrapping;
    b.mesh(leafCluster([2.1, 0.5, -3.6], [1.0, 1.1, 1.2], 10, 41, Math.PI / 2, 1.2), nearBush, [0, 0, 0], { shadow: false });
    b.mesh(leafCluster([2.0, 0.5, -2.3], [1.2, 1.1, 1.4], 8, 42, 0.3, 1.2), nearBush, [0, 0, 0], { shadow: false });
    box(P({ color: '#0a1c22' }), [2.3, 0, -1.5], [2.5, 0.75, -4.4]);

    // ---------- 左の校舎（奥ほど通路に寄る壁）----------
    const LZ0 = 8;
    const LZ1 = -33.6; // 角
    const LCOS = 1 / Math.hypot(1, LK);
    const leftFP = new FacadePainter({ origin: [L0, 0, 0], tangent: [LK, 0, -1], normal: [1, 0, LK] }, cam, 5);
    paintLeft(leftFP);
    const lRoof = facade(
      leftFP,
      [
        [600, -60],
        [625, 0],
        [650, 100],
        [668, 190],
        [684, 270],
      ],
      684,
      [
        { u: [-12, 5.5], y: [0, 26], ppm: 20 },
        { u: [5.5, 12], y: [0, 26], ppm: 96 },
        { u: [12, 20], y: [0, 26], ppm: 64 },
        { u: [20, 36], y: [0, 26], ppm: 40 },
      ],
      1,
    );
    // u（壁に沿った距離）での屋根の高さ
    const lHeight = (lz: number): number => lRoof(-lz);
    const lBody = P({ color: { px: '#17343c', pz: '#0f232b', nz: '#183844', py: '#2a5257' } });
    const LSTEP = 0.7;
    for (let lz = LZ0; lz > LZ1 + 1e-3; lz -= LSTEP) boxL(lBody, [-6, 0, lz], [-0.05, lHeight(lz - LSTEP) - 0.3, Math.max(lz - LSTEP, LZ1)]);
    // 当たり判定: 壁に沿って小さな箱を並べる
    for (let d = -8; d < 34; d += 1) {
      const x = L0 + LK * d;
      ctx.colliders.add({ x: x - 1.2, y: 0, z: -d }, { x: x + 0.1, y: 24, z: -d - 1 });
    }
    // 配管・アンテナ（奥の左の壁）
    // 屋上の柱・アンテナ（明るい建物を背に細いシルエット）
    for (const [d, h] of [
      [20, 3.2],
      [23.5, 2.6],
      [26.5, 3.4],
      [29.5, 2.4],
      [32.5, 2.8],
    ] as const) {
      const x = L0 + LK * d + 0.25;
      const H0 = lHeight(-d / LCOS) - 0.1;
      box(pole, [x - 0.04, H0 - 0.5, -d - 0.04], [x + 0.04, H0 + h, -d + 0.04]);
      box(pole, [x - 0.04, H0 + h * 0.7, -d - 0.45], [x + 0.04, H0 + h * 0.7 + 0.05, -d + 0.45]);
      box(pole, [x - 0.04, H0 + h * 0.4, -d - 0.3], [x + 0.04, H0 + h * 0.4 + 0.05, -d + 0.3]);
    }
    for (const [d, y] of [
      [26, 7.6],
      [30, 9.0],
    ] as const) {
      const x = L0 + LK * d;
      box(acu, [x, y, -d], [x + 0.55, y + 0.6, -d - 0.8]);
    }

    // ---------- 突き当たり ----------
    // 低い建物（突き当たりの手前。屋根 2.4 m）
    // 低い建物（門のような暗い箱。上の段は少し明るい）
    const low = P({ color: { pz: '#235264', nx: '#1d4757', px: '#1d4757', py: '#2a5b6a' }, band: { y: 2.4, color: { pz: '#204d5e' } }, fog: 0.35 });
    box(low, [-2.0, 0, -35.5], [3.2, 3.6, -40], true);
    // 上の窓の列（少し明るいガラスと桟）
    box(P({ color: '#2f6a74', fog: 0.35 }), [-2.0, 3.05, -35.49], [3.2, 3.45, -35.5]);
    for (let x = -1.8; x < 3.2; x += 0.62) box(P({ color: '#3f7f86', fog: 0.35 }), [x, 3.05, -35.485], [x + 0.05, 3.45, -35.49]);
    const door = P({ color: '#1a4152', fog: 0.35 });
    box(door, [0.85, 0, -35.48], [2.15, 1.95, -35.5]);

    // 明るい木（絵に描いた冠を 2 枚の板に）
    const treeTex = makeTreeTexture(11, ['#37736f', '#4c9286', '#5ba791'], { clumps: 80, leaf: 6 });
    const treeMat = createLeafMaterial(treeTex, 0, 0, 1, { fog: 0.25, grad: [3, 7, 0.15], direct: true });
    b.mesh(new THREE.PlaneGeometry(7.4, 7.6), treeMat, [0.9, 6.3, -41], { shadow: false });
    b.mesh(new THREE.PlaneGeometry(6.6, 6.0).rotateY(0.25), treeMat, [0.3, 4.6, -41.8], { shadow: false });
    // 明るい建物の左下を斜めに隠す手前の屋根
    const roofTri = new THREE.BufferGeometry();
    roofTri.setAttribute('position', new THREE.Float32BufferAttribute([-2.5, 8.9, -43, 0.35, 8.9, -43, -2.5, 13.4, -43], 3));
    roofTri.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    roofTri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
    b.mesh(roofTri, P({ color: '#5a8d8a', fog: 0.1 }), [0, 0, 0], { shadow: false });
    box(P({ color: '#4f8584', fog: 0.15 }), [-2.5, 2.4, -42.9], [0.35, 8.9, -43]);

    // 奥の明るい高い建物
    const farTex = makeFarFacade(24, 46, {
      storey: 3.6, glass: [1.9, 3.3], mullion: 1.25, top: '#b9e9d1', bottom: '#9fd0bb', glassTop: '#cbfae4', glassBottom: '#b5e6cf', frame: '#9fcdb9',
    });
    const far = P({ color: { pz: '#b4e4cc', nx: '#d6fce7', px: '#d6fce7' }, map: farTex, mapFace: 'pz', fog: 0 });
    box(far, [-2.2, 0, -57], [21.8, 46, -70]);
    box(P({ color: '#d6fce7' }), [-2.2, 10, -56.9], [-1.85, 46, -57]);
    // その左の明るい建物（左の校舎の屋根の上に見える）
    box(far, [-30, 0, -50], [-2.2, 40, -70]);
    // ---------- 茂み（手前の左右）----------
    const bushTex = makeLeafTexture(21, { clumps: 30, leaf: 6, litSide: 0.7, fill: 1.4 });
    bushTex.wrapS = bushTex.wrapT = THREE.RepeatWrapping;
    const bushMat = createLeafMaterial(bushTex, '#081a1e', '#10272c', 1, { cardEdge: 0.5 });
    // 左の手前の植え込み（画面の左下を覆う）と、壁の足元の生け垣
    b.mesh(leafCluster([-2.6, 0.38, -4.4], [2.6, 0.78, 1.0], 12, 77, 0, 1.3), bushMat, [0, 0, 0], { shadow: false });
    b.mesh(leafCluster([-4.6, 0.36, -5.2], [2.8, 0.75, 1.2], 12, 78, 0.3, 1.3), bushMat, [0, 0, 0], { shadow: false });
    b.mesh(leafCluster([-6.2, 0.3, -6.4], [2.4, 0.65, 1.4], 8, 79, 0.5, 1.3), bushMat, [0, 0, 0], { shadow: false });
    for (let d = 6.5; d < 20; d += 1.3) {
      const x = L0 + LK * d + 0.45;
      const h = 0.16 + r() * 0.08;
      b.mesh(leafCluster([x, h * 0.45, -d], [1.8, h * 1.1, 0.8], 3, 100 + d * 10, Math.PI / 2 - L_ANG), bushMat, [0, 0, 0], { shadow: false });
    }


    // 通路の手前の端（振り返ったとき用の塀と当たり判定）
    box(P({ color: { nz: '#10262e', pz: '#10262e', py: '#1c3d48' } }), [-6, 0, 9.6], [3, 2.2, 10], true);

    b.finalize();
    return { root: b.root, spawn: { pos: [0, 0, 0], yaw: -0.0167 } };
  },
};
