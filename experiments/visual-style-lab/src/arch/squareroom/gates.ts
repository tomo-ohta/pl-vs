import type * as THREE from 'three';
import type { V3 } from '../../scenes/Builder.ts';
import { rng } from '../../scenes/Builder.ts';
import { builderSink, Prop } from '../../props/kit.ts';
import { cqBox, type Env } from './env.ts';
import type { Frame } from './frame.ts';
import { BED, WALK, type ViewSpec, localCam } from './layout.ts';
import { pipeRailing } from './props/fixtures.ts';
import { SC } from './props/mats.ts';
import { bollard, bulkheadLamp } from './props/wall.ts';
import { chippedBlock } from './props/water.ts';

/**
 * 門の抜け（A の開口・C の門）の決まり: 正面の枠（厚さ 0.6 m）の奥は、左右へ wd・上へ sh だけ広い水門の抜けにする。
 * 参考画像の視点（正面の遠く）からは枠の陰で見えない所にだけ形を置く（枠の内側の縁を通る視線より外・上）:
 * - 天井のリブ（0.6 m ごと）と、両側の壁の灯りの列（灯りの光だまり）
 * - 両側の水路の縁の段（歩廊の高さ 0.3 m → 0.05 m → 水）
 * - 外の端の水門の枠（両側の溝形の鋼の縦の枠・上へ巻き上げた扉の板・巻き上げの輪）
 * 外: 門の外の壁ぎわに高い岸壁（歩廊より 1.1 m 高い: 上れない）と係船柱・灯りの柱、湖の中に係船の杭の束。
 * 参考画像の視点から門の開口を通して見える所（視線の円錐の中）には置かない
 */
export interface GateSpec {
  f: Frame;
  view: ViewSpec;
  /** 正面の壁の面 z・抜けの奥行き・開口の x 範囲・開口の上端 */
  ez: number;
  depth: number;
  x0: number;
  x1: number;
  h: number;
  /** 抜けの広がり（左右・上） */
  wd: number;
  sh: number;
  wall: THREE.Material;
  dark: THREE.Material;
  seed: number;
}

/** 正面の壁と抜けの箱（局所）。canalA・canalC の正面の壁の代わりに使う */
export function gateWalls(o: { ez: number; depth: number; x0: number; x1: number; h: number; wd: number; sh: number; xl: number; xr: number; top: number; lintelTop?: number; y0: number }): { min: V3; max: V3 }[] {
  const rz = o.ez - 0.6;
  const back = o.ez - o.depth;
  const lt = o.lintelTop ?? o.top;
  return [
    { min: [o.xl, o.y0, back], max: [o.x0 - o.wd, o.top, rz] },
    { min: [o.xl, o.y0, rz], max: [o.x0, o.top, o.ez] },
    { min: [o.x1 + o.wd, o.y0, back], max: [o.xr, o.top, rz] },
    { min: [o.x1, o.y0, rz], max: [o.xr, o.top, o.ez] },
    { min: [o.x0, o.h, rz], max: [o.x1, lt, o.ez] },
    { min: [o.x0 - o.wd, o.h + o.sh, back], max: [o.x1 + o.wd, Math.max(lt, o.h + o.sh + 0.8), rz] },
  ];
}

export function gateTunnel(env: Env, o: GateSpec): void {
  const { f } = o;
  const sink = builderSink(env.b, env.ctx);
  const mats = env.props.out;
  let seed = o.seed * 100;
  const rz = o.ez - 0.6;
  const back = o.ez - o.depth;
  const xa = o.x0 - o.wd;
  const xb = o.x1 + o.wd;
  const top = o.h + o.sh;
  const box = (min: V3, max: V3, m: THREE.Material, collide = false): void => {
    const w = f.box(min, max);
    cqBox(env.b, m, w.min, w.max, { collide, shadow: true });
  };
  // 枠の内側の縁を通る視線（参考画像の目から）: 抜けの奥の端で見える x の範囲と高さ
  const eye = localCam(o.view).eye;
  const k = (back - eye[2]) / (rz - eye[2]);
  const visL = eye[0] + (o.x0 - eye[0]) * k;
  const visR = eye[0] + (o.x1 - eye[0]) * k;
  const visTop = eye[1] + (o.h - eye[1]) * k;
  // ---- 天井のリブ（0.6 m ごと。見える高さより上）
  const ribBot = Math.max(visTop + 0.12, top - 0.4);
  for (let z = rz - 0.35; z > back + 0.2; z -= 0.6) box([xa, ribBot, z - 0.09], [xb, top, z + 0.09], o.wall);
  // ---- 両側の縁の段（見える x より外）
  for (const side of [-1, 1]) {
    const wallX = side < 0 ? xa : xb;
    const lim = side < 0 ? visL - 0.05 : visR + 0.05;
    // 壁ぎわの歩ける縁（0.3 m）と、その内の一段（0.05 m）。どちらも見える x より外
    const ledge = lim + side * 0.3;
    const [l0, l1] = side < 0 ? [wallX, ledge] : [ledge, wallX];
    box([l0, BED - 0.3, back], [l1, WALK, rz], o.wall, true);
    const [s0, s1] = side < 0 ? [ledge, lim] : [lim, ledge];
    box([s0, BED - 0.3, back + 0.3], [s1, WALK - 0.25, rz - 0.3], o.wall, true);
    // 縁の手すり（水の側）
    const rp = f.p(ledge + side * 0.08, WALK, (back + rz) / 2);
    pipeRailing(Prop.at(sink, mats, rp, f.yawW(Math.PI / 2), seed++), rz - back - 0.6, 0.95);
    // 壁の灯りの列（1.2 m ごと）と光だまり（抜けの中だけ）
    for (let z = rz - 0.6; z > back + 0.4; z -= 1.2) {
      const p = f.p(wallX, 0, z);
      bulkheadLamp(Prop.at(sink, mats, p, f.yawW((-side * Math.PI) / 2), seed++), Math.min(top - 0.6, 2.6));
    }
    const lb = f.box([Math.min(wallX, ledge), BED, back], [Math.max(wallX, ledge), top, rz]);
    env.ctx.addLamp({ pos: f.p(wallX - side * 0.3, Math.min(top - 0.6, 2.6), (back + rz) / 2), radius: Math.max(3.2, (rz - back) * 0.7), intensity: 1.2, color: '#f0e4c4', box: [...lb.min, ...lb.max], shadow: 0 });
    // 水門の溝形の縦の枠（外の端）と、壁の巻き上げの輪
    const gx = side < 0 ? xa : xb;
    box([Math.min(gx, gx - side * 0.25), BED - 0.3, back + 0.15], [Math.max(gx, gx - side * 0.25), top, back + 0.45], o.dark);
    const hp = f.p(gx, 0, back + 0.9);
    const hw = Prop.at(sink, mats, hp, f.yawW((-side * Math.PI) / 2), seed++);
    hw.torus(SC.steelDark, [0, 1.6, 0.18], 0.24, 0.02, { axis: 'z', seg: 20, radial: 5 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI;
      hw.rod(SC.steelDark, [Math.cos(a) * 0.24, 1.6 + Math.sin(a) * 0.24, 0.18], [-Math.cos(a) * 0.24, 1.6 - Math.sin(a) * 0.24, 0.18], 0.01, { shadow: 'receive' });
    }
    hw.box(SC.steel, [-0.08, 1.45, 0], [0.08, 1.75, 0.16], { r: 0.01 });
  }
  // 巻き上げた水門の扉の板（見える高さより上。鋼の板に横の補強）
  box([xa, ribBot - 0.02, back + 0.2], [xb, top, back + 0.4], o.dark);
}

/**
 * 門の外の岸壁と湖の杭の束（外の壁の面 z = back から外へ）。岸壁は歩廊より 1.1 m 高い（抜けの縁の段から上れない）。
 * through(min, max) = 参考画像の視点から門の開口を通して見えるか（世界の箱）
 */
export function gateHarbour(env: Env, o: GateSpec & { through: (min: V3, max: V3) => boolean; span: number }): void {
  const { f } = o;
  const sink = builderSink(env.b, env.ctx);
  const mats = env.props.out;
  const r = rng(o.seed * 7 + 3);
  let seed = o.seed * 100 + 50;
  const back = o.ez - o.depth;
  const qTop = WALK + 1.1;
  const qd = 2.6;
  const ok = (min: V3, max: V3): boolean => {
    const w = f.box(min, max);
    return !o.through(w.min, w.max);
  };
  for (const side of [-1, 1]) {
    const xIn = side < 0 ? o.x0 - o.wd - 0.6 : o.x1 + o.wd + 0.6;
    const xOut = xIn + side * o.span;
    const [qa, qb] = side < 0 ? [xOut, xIn] : [xIn, xOut];
    const qmin: V3 = [qa, BED - 1.5, back - qd];
    const qmax: V3 = [qb, qTop, back];
    if (!ok(qmin, qmax)) continue;
    const w = f.box(qmin, qmax);
    cqBox(env.b, o.wall, w.min, w.max, { collide: true, shadow: true });
    // 岸壁の縁の笠石（少し出る）と、係船柱・灯りの柱
    const cw = f.box([qa, qTop - 0.15, back - qd - 0.15], [qb, qTop, back - qd + 0.25]);
    cqBox(env.b, o.wall, cw.min, cw.max, { shadow: true });
    for (let x = xIn + side * 1.5; side < 0 ? x > xOut + 1 : x < xOut - 1; x += side * 4.5) {
      bollard(Prop.at(sink, mats, f.p(x, qTop, back - qd + 0.4), 0, seed++));
    }
    const lp = Prop.at(sink, mats, f.p(xIn + side * 3.2, qTop, back - 1.2), 0, seed++);
    lp.cyl(SC.steelDark, [0, 0.15, 0], 0.12, 0.3, { seg: 10 });
    lp.rod(SC.steelDark, [0, 0.3, 0], [0, 4.2, 0], 0.06, { radial: 10 });
    lp.rod(SC.steelDark, [0, 4.1, 0], [0, 4.25, -0.7], 0.035, { radial: 6, shadow: 'receive' });
    lp.box(SC.paint, [-0.18, 4.05, -0.95], [0.18, 4.2, -0.55], { r: 0.02, shadow: 'receive' });
    lp.box('#e9ecd6', [-0.14, 4.02, -0.92], [0.14, 4.05, -0.58], { kind: 'glow', shadow: false });
  }
  // 湖の中の係船の杭の束（3〜5 本を鎖で束ねる）と、浮きの塊
  let n = 0;
  for (let i = 0; i < 40 && n < 6; i++) {
    const side = r() < 0.5 ? -1 : 1;
    const x = (side < 0 ? o.x0 - 4 : o.x1 + 4) + side * r() * 14;
    const z = back - 6 - r() * 22;
    if (!ok([x - 1, BED - 1, z - 1], [x + 1, 2.6, z + 1])) continue;
    n++;
    const p = Prop.at(sink, mats, f.p(x, -2, z), r() * 6, seed++);
    const m = 3 + Math.floor(r() * 3);
    for (let j = 0; j < m; j++) {
      const a = (j / m) * Math.PI * 2;
      const h = 3.6 + r() * 1.4;
      p.cyl(SC.woodDark, [Math.cos(a) * 0.32, h / 2, Math.sin(a) * 0.32], 0.16, h, { seg: 8 });
      p.cyl(SC.wood, [Math.cos(a) * 0.32, h + 0.01, Math.sin(a) * 0.32], 0.15, 0.02, { seg: 8, shadow: 'receive' });
    }
    p.cyl(SC.wood, [0, 3.1, 0], 0.16, 4.2, { seg: 8 });
    for (const y of [2.4, 3.3]) p.torus(SC.rust, [0, y, 0], 0.5, 0.03, { axis: 'y', seg: 18, radial: 5, shadow: 'receive' });
  }
  for (let i = 0, k = 0; i < 30 && k < 5; i++) {
    const side = r() < 0.5 ? -1 : 1;
    const x = (side < 0 ? o.x0 - 3 : o.x1 + 3) + side * r() * 12;
    const z = back - 3 - r() * 14;
    const s = 1.2 + r() * 1.8;
    if (!ok([x - s, -1, z - s], [x + s, 1, z + s])) continue;
    k++;
    chippedBlock(Prop.at(sink, mats, f.p(x, -0.9, z), r() * 6, seed++), s, 1.1 + r() * 0.5, s * (0.7 + r() * 0.5), { moss: 0.6, waterline: 0.9, color: SC.concDark });
  }
}
