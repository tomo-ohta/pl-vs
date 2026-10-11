import * as THREE from 'three';
import { Builder } from '../../scenes/Builder.ts';
import type { BuiltScene, SceneContext } from '../../scenes/types.ts';
import { buildBasin } from './basin.ts';
import { A, buildA } from './canalA.ts';
import { buildB } from './canalB.ts';
import { C, buildC } from './canalC.ts';
import { buildD } from './canalD.ts';
import type { Env, ZoneMats } from './env.ts';
import { VIEWS, WATER } from './layout.ts';
import { gateHarbour, gateTunnel } from './gates.ts';
import { concrete, floodPath, glow, water, type ConcreteOpts, type WaterOpts } from './mats.ts';
import { buildRooms, roomHoles } from './rooms.ts';
import { dressAll } from './dress.ts';
import { buildOutside, gateSight } from './outside.ts';
import { clearOccluders } from './sight.ts';
import { skyNotches } from './notches.ts';
import { sqPropMats } from './props/mats.ts';

/**
 * 立方体の大広間と水路を組み立てる。
 * 光: 南南東の高さ 35° の日（影は動かない場面なので一度だけ描く）+ 空の半球光。谷の底ほど暗いのは材質（高さで間接光を減らす）。
 * 区域（水路 A〜D・水庭）ごとに材質の色と水面の映り込みを変える（参考画像ごとの色調の違い）
 */
export function buildSquareroom(ctx: SceneContext): BuiltScene {
  const b = new Builder(ctx);
  clearOccluders();
  const refl = ctx.addReflector({ x: 0, y: WATER, z: 0 }, undefined, 0.5);
  const glows = new Map<string, THREE.Material>();
  const waters: THREE.Material[] = [];
  const mkWater = (o: WaterOpts): THREE.Material => {
    const m = water(ctx, refl, o);
    waters.push(m);
    return m;
  };
  const env: Env = {
    ctx,
    b,
    refl,
    glow: (c, fog = true) => {
      const k = `${c}|${fog}`;
      let m = glows.get(k);
      if (!m) glows.set(k, (m = glow(ctx, c, `glow-${k}`, { fog })));
      return m;
    },
    holes: [...roomHoles(), ...skyNotches()],
    faces: [],
    props: { out: sqPropMats(ctx), room: sqPropMats(ctx, { amb: 0.22 }) },
    voidMat: ctx.mat({ color: '#13212a', toon: 0, line: 0.3, name: 'void' }),
  };

  // ---------------- 光 ----------------
  const hemi = new THREE.HemisphereLight('#dfeef0', '#4a5d62', Math.PI * 0.75);
  b.root.add(hemi);
  const sun = new THREE.DirectionalLight('#fff1dc', Math.PI * 3.0);
  // 真南・高さ 35°: 南を向く面（A の北の岸・C の低い箱の正面）と上を向く面だけに日が当たる。東西を向く壁（B・C の両岸）は日陰
  sun.position.set(0, 57 * 3, 82 * 3);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera;
  sc.left = -170;
  sc.right = 170;
  sc.top = 170;
  sc.bottom = -170;
  sc.near = 1;
  sc.far = 600;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.22;
  b.root.add(sun, sun.target);
  ctx.setSun(sun);

  // ---------------- 材質（区域ごと） ----------------
  const zone = (name: string, wall: Omit<ConcreteOpts, 'name'>, dark: Omit<ConcreteOpts, 'name'>, floor: Omit<ConcreteOpts, 'name'>, w: Omit<WaterOpts, 'name'>): ZoneMats => ({
    wall: concrete(ctx, { under: 0.4, ...wall, name: `${name}-wall` }),
    dark: concrete(ctx, { ...dark, name: `${name}-dark` }),
    floor: concrete(ctx, { ...floor, name: `${name}-floor` }),
    water: mkWater({ ...w, name: `${name}-water` }),
  });
  const mB = zone(
    'B',
    { color: '#5598b0', axis: 'z', axisDark: 0.3, aoMin: 0.75, ao: [0, 24], amb: 1.25 },
    { color: '#2d4c58', axis: 'z', axisDark: 0.6, aoMin: 0.75, ao: [0, 24], amb: 1.25 },
    { color: '#8fb6ba', amb: 1.25 },
    { color: '#18282e', tint: '#d6e4e6', ripple: 4.5, aniso: [0.3, 2.6], distort: 0.07, strength: 1.0, fresnel: 0.25, boost: 1.0 },
  );
  mB.flood = floodPath(ctx, refl, { color: '#6f9198', wetColor: '#22363d', name: 'B-flood' });
  const mA = zone(
    'A',
    { color: '#7a8e8d', axis: 'x', axisDark: 0.35, aoMin: 0.55, ao: [0, 26], amb: 1.4, haze: [10, 36, 0.6, 0.02] },
    { color: '#34505a', axis: 'x', axisDark: 0.75, aoMin: 0.6, ao: [0, 26], amb: 1.1, under: 1.0, haze: [10, 36, 0.6, 0.02] },
    { color: '#7a989a', amb: 0.7 },
    { color: '#0f1d21', tint: '#b8c8c6', ripple: 7.0, distort: 0.012, strength: 0.95, fresnel: 0.35 },
  );
  mA.wall2 = concrete(ctx, { color: '#5f7676', name: 'A-wall2', axis: 'x', axisDark: 0.4, aoMin: 0.5, ao: [0, 26], amb: 0.85, haze: [10, 36, 0.6, 0.02] });
  const mC2 = concrete(ctx, { color: '#3f6f7e', name: 'C-wall2', axis: 'z', axisDark: 0.6, aoMin: 0.5, ao: [0, 26], amb: 0.9, haze: [10, 40, 0.6, 0.015] });
  const mC = zone(
    'C',
    { color: '#7b9696', axis: 'z', axisDark: 0.6, aoMin: 0.5, ao: [0, 26], moss: 0.5, mossColor: '#5d6e45', mossTop: 5, amb: 0.5, haze: [10, 40, 0.6, 0.015] },
    { color: '#3d5b60', axis: 'z', axisDark: 0.7, aoMin: 0.5, ao: [0, 26], amb: 1.0, under: 1.0, haze: [8, 34, 0.8, 0.02] },
    { color: '#86a29c', amb: 0.7 },
    { color: '#16262c', tint: '#c4d4d0', ripple: 6.0, distort: 0.014, strength: 0.95, fresnel: 0.45 },
  );
  mC.wall2 = mC2;
  mC.upper = concrete(ctx, { color: '#4f6866', name: 'C-upper', axis: 'z', axisDark: 0.7, aoMin: 0.5, ao: [0, 26], amb: 0.55, under: 0.8, haze: [14, 44, 0.6, 0.015] });
  mC.sunlit = concrete(ctx, { color: '#919a90', name: 'C-sunlit', axis: 'z', axisDark: 1, aoMin: 0.5, ao: [0, 26], moss: 0.9, mossColor: '#4f5c44', mossTop: 4.5, streak: 1.0, streakDark: 0.7, drip: 0.9, amb: 0.5, sunFace: { dir: [0, 0, 1], gain: 17, color: '#fbf0dc' } });
  const mD = zone(
    'D',
    { color: '#4a7e98', axis: 'x', axisDark: 0.6, aoMin: 0.45, ao: [0, 30], amb: 1.5, haze: [8, 36, 0.75, 0.025] },
    { color: '#1f3542', axis: 'x', axisDark: 0.7, aoMin: 0.45, ao: [0, 30], amb: 1.0 },
    { color: '#3e6575', amb: 0.9 },
    { color: '#0d1820', tint: '#a8c0c6', ripple: 5.5, distort: 0.03, strength: 0.95, fresnel: 0.4 },
  );
  mD.wall2 = concrete(ctx, { color: '#456f84', name: 'D-wall2', axis: 'x', axisDark: 0.6, aoMin: 0.45, ao: [0, 30], amb: 0.95, under: 0.4, haze: [8, 36, 0.6, 0.025] });
  const mBasin = zone(
    'basin',
    { color: '#6a95a0', aoMin: 0.5, ao: [0, 34], amb: 0.7, haze: [8, 32, 0.6, 0.02] },
    { color: '#2a434c', aoMin: 0.5, ao: [0, 34], amb: 0.7, haze: [8, 32, 0.6, 0.02] },
    { color: '#7fa0a2', amb: 0.7 },
    { color: '#13222a', tint: '#b7c8ca', ripple: 4.0, distort: 0.012, strength: 0.95, fresnel: 0.35 },
  );

  // 同じ面に重なる面（水路の端と水庭の壁・明るい壁と奥まった壁）がちらつかないように、材質ごとに深度を少しずつ奥へずらす
  // （Apple の GPU は同じ深さの面の勝ち負けを 32 画素の升目ごとに決めるので、升目の模様に見える）
  const po = (m: THREE.Material | undefined, k: number): void => {
    if (!m || k <= 0) return;
    m.polygonOffset = true;
    m.polygonOffsetFactor = k;
    m.polygonOffsetUnits = k * 2;
  };
  // 水路どうしは同じ面を持たないので同じ値。水庭は水路より奥・部屋はいちばん奥
  for (const z of [mB, mA, mC, mD]) {
    po(z.wall2, 1);
    po(z.upper, 1);
    po(z.dark, 2);
  }
  po(mBasin.wall, 3);
  po(mBasin.dark, 4);
  po(mBasin.floor, 1);

  buildB(env, mB);
  const a = buildA(env, mA);
  const c = buildC(env, mC);
  buildD(env, mD);
  // 門の抜けの中（リブ・灯りの列・縁の段・水門の枠）と、門の外の岸壁と杭の束（参考画像の視点からは見えない所だけ）
  const sight = gateSight();
  const gA = { f: a.frame, view: VIEWS.v2, ez: A.endZ, depth: 4, x0: A.gate[0], x1: A.gate[1], h: A.gate[2], wd: A.gateWd, sh: A.gateSh, wall: mA.wall, dark: mA.dark, seed: 81 };
  const gC = { f: c.frame, view: VIEWS.v3, ez: C.endZ, depth: 6, x0: C.gate[0], x1: C.gate[1], h: C.gate[2], wd: C.gateWd, sh: C.gateSh, wall: mC.wall, dark: mC.dark, seed: 82 };
  gateTunnel(env, gA);
  gateTunnel(env, gC);
  gateHarbour(env, { ...gA, through: sight, span: 10 });
  gateHarbour(env, { ...gC, through: sight, span: 14 });
  buildBasin(env, mBasin);
  // 箱の中の部屋（空の光は届かない: 間接光は小さく、灯りの光だまりで照らす）
  const mRoom = {
    wall: concrete(ctx, { color: '#7a9aa2', name: 'room-wall', aoMin: 1, amb: 0.15, streak: 0.3, under: 2.2 }),
    floor: concrete(ctx, { color: '#7d9696', name: 'room-floor', aoMin: 1, amb: 0.15, streak: 0 }),
    dark: concrete(ctx, { color: '#33494f', name: 'room-dark', aoMin: 1, amb: 0.15 }),
  };
  po(mRoom.wall, 5);
  po(mRoom.floor, 5);
  po(mRoom.dark, 5);
  // 屋上テラスの床と手すり壁は屋外の打ち放し（水庭の壁と同じ色。近くで見るので高い所の霞は掛けない）
  const tWall = concrete(ctx, { color: '#6a95a0', name: 'terrace-wall', aoMin: 0.5, ao: [0, 34], amb: 0.7 });
  buildRooms(env, mRoom, { wall: tWall, floor: mBasin.floor, dark: mBasin.dark });

  // 写っていない所の作り込み（小物・灯り・蔦・部屋の中の物）
  dressAll(env, env.props.out, env.props.room, mBasin.floor);

  // 外の湖（門の外。深い。歩けない）
  const lake = mkWater({ name: 'lake', color: '#1d2e33', tint: '#c8d6d6', ripple: 3.0, distort: 0.01, strength: 1.0, fresnel: 0.3 });
  buildOutside(env, lake, concrete(ctx, { color: '#8fa3a0', name: 'terrace', amb: 1.1, streak: 0.2 }), concrete(ctx, { color: '#5f7f86', name: 'far', amb: 1.0 }), mBasin.dark);

  b.finalize();
  // 映り込みの描画では水面を隠す（まとめた後のメッシュ）
  refl.hide.length = 0;
  b.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && waters.includes(m.material as THREE.Material)) refl.hide.push(m);
  });

  return {
    root: b.root,
    spawn: { pos: [-9, 0.35, 16], yaw: 0 },
    staticShadows: true,
  };
}
