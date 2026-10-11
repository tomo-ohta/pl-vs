import * as THREE from 'three';
import { Builder } from '../scenes/Builder.ts';
import type { SceneDef, ViewDef } from '../scenes/types.ts';
import { Doors } from './classroom/doors.ts';
import { BALC, CAM0, CAM1, CH, CORR, DOORS, ESC, EYE0, EYE1, FACADE, FL, ROOM_D, STAIR, T_EXT, XN, Z_EAST } from './classroom/layout.ts';
import { createBubbles } from './classroom/bubbles.ts';
import { Foam, foamMat } from './classroom/foam.ts';
import { createStreaks, streakQuad } from './classroom/streaks.ts';
import { Shafts } from './classroom/shafts.ts';
import { Mats } from './classroom/mats.ts';
import { buildView0 } from './classroom/view0.ts';
import { buildView1 } from './classroom/view1.ts';
import { buildLevel, type Env, type LevelMats } from './classroom/shell.ts';
import { corridorDress, corridorWall, door, floorBand, NORTH_SPEC, northSpans, northWindows } from './classroom/building.ts';
import { buildBalconies, buildWcTower } from './classroom/stairs.ts';
import { buildMainStair } from './classroom/stairwell.ts';
import { buildExterior } from './classroom/exterior.ts';
import { furnishRooms } from './classroom/rooms.ts';
import { classroomPlan } from './classroom/plan.ts';
import { buildOutside, createSky, SUN_DIR } from './classroom/outside.ts';
import { DEEP, SHALLOW } from './classroom/look.ts';

/**
 * 海の見える教室（建築版）。離島の岬の先、崖の上に建つ分校の 3 階建ての校舎（片廊下型。間取り図は classroom/plan.ts、寸法は classroom/layout.ts、
 * 判断の記録と数値は docs/stages/classroom.md）。
 * 参考画像 classroom-0 = 2 階の西の端の小さな教室、classroom-1 = 3 階の西の端の教室（どちらも窓の壁に沿って西を見る）。
 * 見た目は色彩設計の段落とし（階ごとに青 / 青緑の色の表と霧）。窓の外の海・岩・空は自前のシェーダー（outside.ts）、
 * 2 階の窓の泡と氷の殻（foam.ts）、3 階のガラスの垂れた筋（streaks.ts）、浮かぶ泡（bubbles.ts）、窓からの光の帯（shafts.ts）。
 * 階段室は stairwell.ts、廊下は building.ts、写っていない部屋は rooms.ts（部屋の種類ごとの決まり）。
 * 日は南（方位 80°・高さ 40°）。影は動かないので影の地図は描き直さない（見える階が変わった時だけ）。
 */
const views: ViewDef[] = [
  { id: 'classroom-0', label: '2 階の小さな教室（窓に沿って西を見る）', eye: EYE0, yaw: CAM0.yaw, pitch: CAM0.pitch, fov: CAM0.fov, style: DEEP },
  { id: 'classroom-1', label: '3 階の教室（窓に沿って西を見る）', eye: EYE1, yaw: CAM1.yaw, pitch: CAM1.pitch, fov: CAM1.fov, style: SHALLOW },
];

/** 参考画像の視点の画面に入るか（泡の縦の線: 箱の下・中・上の 3 点のどれか） */
function seenFromViews(x: number, z: number, y0: number, y1: number): boolean {
  for (const c of [CAM0, CAM1]) {
    for (const y of [y0, (y0 + y1) / 2, y1]) {
      const p = c.proj([x, y, z]);
      if (p && p[0] > -60 && p[0] < 1516 && p[1] > -60 && p[1] < 876) return true;
    }
  }
  return false;
}

/** 階の廊下まわり（教室と廊下の間の壁・扉・北の窓・廊下の作り込み） */
function finishLevel(env: Env, lm: LevelMats, level: 2 | 3): void {
  corridorWall(env, lm, level);
  for (const d of DOORS[level]) if (d.wall === 'mat' || d.wall === 'e' || (d.wall === 'w' && d.at > CORR[0])) door(env, lm, level, d);
  northWindows(env, lm, level);
  floorBand(env, lm, level);
  corridorDress(env, lm, level);
}

export const classroom: SceneDef = {
  id: 'classroom',
  label: '海の見える教室（classroom）',
  style: DEEP,
  plan: classroomPlan,
  views,
  sky: false,
  build(ctx) {
    const mats = new Mats(ctx);
    // 階ごとの Builder・扉（見えない階を描かない）と、共通（階段室・バルコニー・外）
    const b2 = new Builder(ctx);
    const b3 = new Builder(ctx);
    const bc = new Builder(ctx);
    // 共通の部分は場所ごとに分ける（まとめた形の包み球が小さくなり、画面の外は描かない）: 階段室・西のバルコニーと避難階段・外
    const bs = new Builder(ctx);
    const bb = new Builder(ctx);
    const doors2 = new Doors(ctx);
    const doors3 = new Doors(ctx);
    const doorsC = new Doors(ctx);
    const env2: Env = { ctx, mats, doors: doors2, b: b2 };
    const env3: Env = { ctx, mats, doors: doors3, b: b3 };
    const envC: Env = { ctx, mats, doors: doorsC, b: bc };
    const envS: Env = { ctx, mats, doors: doorsC, b: bs };
    const envB: Env = { ctx, mats, doors: doorsC, b: bb };
    // 3 階の窓: ガラスの垂れた筋（区画ごとに升目を選ぶ）
    const st = createStreaks(ctx);
    const f3 = FACADE[3];
    let cell = 11;
    // 窓から差し込む光の筋（区画ごと。光の進む向き = 日の向きの逆）
    const sh2 = new Shafts();
    const sh3 = new Shafts();
    const lightDir = SUN_DIR.clone().multiplyScalar(-1);
    const lm3 = buildLevel(env3, 3, (za, zb, n) => {
      sh3.window(-0.12, za, zb, FL[2] + f3.sill, FL[2] + f3.head, lightDir, 4.2, n);
      const cuts = [za, ...(f3.split && f3.split.length === n - 1 ? f3.split.map((sp) => za + (zb - za) * sp) : Array.from({ length: n - 1 }, (_, k) => za + ((k + 1) * (zb - za)) / n)), zb];
      for (let k = 0; k < n; k++) {
        const c = (cuts[k] + cuts[k + 1]) / 2;
        const w = cuts[k + 1] - cuts[k];
        const fl = FL[2];
        b3.mesh(streakQuad(-0.105, fl + (f3.sill + f3.head) / 2, c, w - 0.02, f3.head - f3.sill, cell++ % 16, (cell * 7) % 3 === 0), st.mat, [0, 0, 0], { shadow: true, layer: 1 });
        b3.mesh(streakQuad(-0.105, fl + (f3.transom[0] + f3.transom[1]) / 2, c, w - 0.02, f3.transom[1] - f3.transom[0], (cell * 5 + 3) % 16, false), st.mat, [0, 0, 0], { shadow: true, layer: 1 });
      }
    });
    buildView1(env3, lm3);
    finishLevel(env3, lm3, 3);
    // 2 階の窓: 泡と氷柱（西の端ほど多い）
    const foam = new Foam();
    let fs = 0;
    const lm2 = buildLevel(env2, 2, (za, zb) => {
      foam.bay(FL[1], FACADE[2], za, zb, Math.max(0.35, 1 - za / 30), 900 + fs++);
      sh2.window(-0.12, za, zb, FL[1] + FACADE[2].sill, FL[1] + FACADE[2].head, lightDir, 3.6, 2);
    });
    buildView0(env2, lm2);
    finishLevel(env2, lm2, 2);
    // 北の窓（廊下）も同じ決まり: 2 階は泡と氷柱、3 階はガラスの筋
    const mirror = XN + T_EXT / 2 - 0.12;
    for (const [za, zb] of northSpans()) {
      foam.bay(FL[1], NORTH_SPEC, za, zb, 0.5, 950 + fs++, mirror);
      for (const [a, c] of [[za + 0.04, (za + zb) / 2 - 0.02], [(za + zb) / 2 + 0.02, zb - 0.04]]) {
        b3.mesh(streakQuad(XN + T_EXT / 2 - 0.012, FL[2] + 1.55, (a + c) / 2, c - a, 1.26, cell++ % 16, (cell * 3) % 2 === 0), st.mat, [0, 0, 0], { shadow: true, layer: 1 });
      }
    }
    furnishRooms(env2, 2);
    furnishRooms(env3, 3);
    // 泡（決まり: 2 階は 1 m² あたり 15・3 階は 4。窓ぎわに寄る。階段室・バルコニー・建物の外の空気にも）
    const area = (x0: number, z0: number, x1: number, z1: number): number => (x1 - x0) * (z1 - z0);
    const bub2 = createBubbles([
      { box: [0.05, FL[1] + 0.1, 0.1, ROOM_D - 0.1, FL[1] + CH - 0.1, Z_EAST - 0.1], count: Math.round(15 * area(0, 0, ROOM_D, Z_EAST)), size: [0.008, 0.05], window: 0.6 },
      { box: [CORR[0] + 0.1, FL[1] + 0.1, 0.1, CORR[1] - 0.1, FL[1] + CH - 0.1, Z_EAST - 0.1], count: Math.round(12 * area(CORR[0], 0, CORR[1], Z_EAST)), size: [0.008, 0.04] },
    ], 3);
    const bub3 = createBubbles([
      { box: [0.05, FL[2] + 0.1, 0.1, ROOM_D - 0.1, FL[2] + CH - 0.1, Z_EAST - 0.1], count: Math.round(4 * area(0, 0, ROOM_D, Z_EAST)), size: [0.006, 0.03], window: 0.5 },
      { box: [CORR[0] + 0.1, FL[2] + 0.1, 0.1, CORR[1] - 0.1, FL[2] + CH - 0.1, Z_EAST - 0.1], count: Math.round(9 * area(CORR[0], 0, CORR[1], Z_EAST)), size: [0.006, 0.035] },
    ], 4);
    const bubC = createBubbles([
      { box: [STAIR[0] + 0.1, 0.1, STAIR[1] + 0.1, STAIR[2] - 0.1, FL[3] + 2.4, STAIR[3] - 0.1], count: 1800, size: [0.008, 0.045] },
      { box: [BALC[0], FL[1] + 0.1, ESC[1], BALC[2], FL[3], BALC[3] - 0.05], count: 2400, size: [0.012, 0.07] },
      { box: [-4.8, FL[1], -6, -0.4, FL[3] + 3, Z_EAST], count: 1500, size: [0.012, 0.07] },
      // 決まり（どこも同じ水の中）: 建物の西（岬の先・バルコニーと避難階段のまわり）と北（廊下の窓・階段室の窓の外）の空気にも、
      // 南の外と同じくらいの密度（1 m³ あたり 約 1）で泡。参考画像の視点の画面に入る所には置かない（視点の見た目を変えない）
      { box: [-0.3, FL[1] - 1, -14, XN + T_EXT + 4, FL[3] + 3, -1.45], count: 2500, size: [0.012, 0.07], exclude: seenFromViews },
      { box: [XN + T_EXT + 0.1, FL[1] - 1, -1.4, XN + 12, FL[3] + 3, Z_EAST + 2], count: 3500, size: [0.012, 0.07], exclude: seenFromViews },
      // 階段室は廊下と同じ密度に（1 m³ あたり 約 9）
      { box: [STAIR[0] + 0.1, 0.1, STAIR[1] + 0.1, STAIR[2] - 0.1, FL[3] + 2.4, STAIR[3] - 0.1], count: 1200, size: [0.008, 0.045] },
    ], 5);
    const foamObj = foam.build(foamMat(mats, 'deep'));
    // 階段室（窓台の泡は共通の Foam。階段室・外からはどの階でも見える）
    const foamC = new Foam();
    buildMainStair(envS, { foam: foamC, streaks: st });
    const foamCObj = foamC.build(foamMat(mats, 'deep'));
    buildWcTower(envC);
    buildBalconies(envB);
    buildExterior(bc, mats);
    const out = new THREE.Group();
    buildOutside(out);
    out.add(createSky());
    const sun = new THREE.DirectionalLight(0xffffff, Math.PI * 1.2);
    sun.target.position.set(3, 5, 12);
    sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 120 });
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.02;
    const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, Math.PI);
    hemi.color.setRGB(0.42, 0.42, 0.42);
    hemi.groundColor.setRGB(0.12, 0.12, 0.12);
    ctx.setSun(sun);
    for (const b of [b2, b3, bc, bs, bb]) b.finalize();
    const lv2 = new THREE.Group();
    lv2.add(b2.root, doors2.root, bub2.mesh, foamObj, sh2.build('#3f88b0', 0.08));
    const lv3 = new THREE.Group();
    lv3.add(b3.root, doors3.root, bub3.mesh, sh3.build('#2fb4bc', 0.2));
    const root = new THREE.Group();
    root.add(sun, sun.target, hemi, lv2, lv3, bc.root, bs.root, bb.root, doorsC.root, out, bubC.mesh, foamCObj);
    // 見えない階を描かない: 目が建物の中（階段室・バルコニー・外を除く）なら、その階だけ。影の地図は描き直す
    let shown = '';
    const cull = (p: THREE.Vector3, all: boolean): void => {
      const inside = p.x > -0.1 && p.x < XN + 0.1 && p.z > -0.1 && p.z < Z_EAST + 0.1;
      const want = all || !inside ? 'all' : p.y < FL[2] ? '2' : '3';
      if (want === shown) return;
      shown = want;
      lv2.visible = want !== '3';
      lv3.visible = want !== '2';
      ctx.updateShadows();
    };
    return {
      root,
      spawn: { pos: [EYE0[0], FL[1], EYE0[2]], yaw: CAM0.yaw },
      staticShadows: true,
      update(dt, t, camera) {
        for (const d of [doors2, doors3, doorsC]) d.update(dt, camera.position);
        for (const bb of [bub2, bub3, bubC]) bb.tick(t);
      },
      beforeRender(camera, o) {
        cull(camera.position, !!o?.map);
      },
      styleZones: [
        { min: [-20, FL[2] - 0.5, -20], max: [40, 40, 60], style: SHALLOW },
        { min: [-20, -20, -20], max: [40, FL[2] - 0.5, 60], style: DEEP },
      ],
    };
  },
};

