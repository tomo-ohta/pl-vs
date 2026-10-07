import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, type Builder, type V3 } from '../../scenes/Builder.ts';
import type { SceneContext } from '../../scenes/types.ts';
import { instanced, strut, trs, tuftGeometry } from './kit.ts';
import { bareTree } from './site.ts';
import { A, D, FREIGHT, ROAD, SITE, TRACK, Y } from './layout.ts';
import type { Mats } from './mats.ts';
import { tileRegion } from './region.ts';
import { seen } from './seen.ts';

/**
 * 作り込みの決まり（参考画像の視点の外を、同じ程度の作り込みにする）。どこにでも同じ決まりで置き、参考画像の画角（seen.ts）の中には置かない。
 * - ホームの壁（線路側の面）: 12 m おきの退避の穴（暗い窪みと黄と黒の帯）・6 m おきの水抜きの管と、その下の水の筋・
 *   壁沿いの配線の管と受け・20 m おきの番号の札・壁の根元の草
 * - 線路の脇: 道床の肩の草の塊・100 m おきのキロポスト・ケーブルの溝（蓋つき）・ホームの端の信号の機器箱・錆びたレールと枕木の山
 * - 野原: 農道と道に沿った用水路（水面は霧の空を映す）・その脇と畑の中の茂みの塊・電柱の列・ビニールハウス・稲のはさ掛け・ポンプ小屋
 * - 遠景（霧の向こう）: 屋敷林の列・農家・倉庫・給水塔の影（地平線の影と同じ、霧を薄く掛ける材質）
 */
export function buildDressing(ctx: SceneContext, root: THREE.Object3D, mat: Mats): (cam: THREE.Vector3) => void {
  const r = rng(907);
  const walls = platformWalls(ctx, root, mat, r);
  const near = [...trackside(ctx, root, mat, r), ...fields(ctx, root, mat, r)];
  farSilhouettes(ctx, root, mat, r);
  // 近くの小物の升目の範囲（霧の中で 110 m より遠い升目は見えない: 透ける割合 7 % 未満）
  const spheres = near.map((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.computeBoundingSphere();
    return m.geometry?.boundingSphere ?? new THREE.Sphere(new THREE.Vector3(), 1e5);
  });
  return (cam) => {
    // ホームの壁の作り込みは、そのホームの上からは見えない（ホームの縁に隠れる）。上に立っているときは描かない
    for (const w of walls) {
      const on = cam.y > w.top + 0.3 && cam.x > w.rect[0] && cam.x < w.rect[2] && cam.z > w.rect[1] && cam.z < w.rect[3];
      for (const o of w.objs) o.visible = !on;
    }
    near.forEach((o, i) => {
      o.visible = spheres[i].center.distanceTo(cam) - spheres[i].radius < 110;
    });
  };
}

/**
 * 茂みの形（こぶで膨らませた多面体。根元は地面に接して少し沈む）。原点が根元、半径 1・高さ約 0.9。
 * 頂点色: 根元は暗く、上は空の光を受けて明るい（霧の中で、地面の穴ではなく丸い塊に見える）
 */
function bushGeometry(seed: number, detail = 2): THREE.BufferGeometry {
  // 同じ頂点は同じだけ動かす（割れ目が出ない）
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, detail));
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  const rr = rng(seed);
  const ph = [rr() * 6.28, rr() * 6.28, rr() * 6.28];
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const k = 0.86 + 0.12 * Math.sin(x * 3.1 + ph[0]) * Math.cos(z * 2.7 + ph[1]) + 0.08 * Math.sin(y * 4.3 + x * 2.0 + ph[2]);
    const yy = (Math.max(y, -0.4) + 0.4) * 0.64 * k;
    p.setXYZ(i, x * k, yy, z * k);
    const t = Math.min(Math.max(yy / 0.85, 0), 1);
    const c = 0.5 + 0.85 * t * t * (3 - 2 * t);
    col.set([c * 0.96, c, c * 0.98], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  // 法線は上向き寄りに（茂みは空の光を受ける。面ごとの角が目立たない）
  const n = g.getAttribute('normal') as THREE.BufferAttribute;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, n.getX(i) * 0.45, n.getY(i) * 0.45 + 0.6, n.getZ(i) * 0.45);
  return g;
}

/** ホームの線路側の壁の作り込み（壁の面 x、外向き s、長手 z0〜z1、置かない範囲 skip）。ホームごとに、作った物とホームの範囲を返す */
function platformWalls(ctx: SceneContext, root: THREE.Object3D, mat: Mats, r: () => number): { objs: THREE.Object3D[]; rect: [number, number, number, number]; top: number }[] {
  const walls: { x: number; s: 1 | -1; z0: number; z1: number; skip: [number, number][]; p: number }[] = [
    // A の西・東（B・C の所は目地の蓋の下で見えない。station-2 の画角の近くは置かない）
    { x: -A.half + 0.12, s: -1, z0: A.z0 + 1, z1: A.z1 - 1, skip: [[38, 66]], p: 0 },
    { x: A.half - 0.12, s: 1, z0: A.z0 + 1, z1: A.z1 - 1, skip: [[38, 66]], p: 0 },
    // D の西（0 番線側）・旧貨物ホームの東（7 番線側）
    { x: D.x - D.half + 0.12, s: -1, z0: D.z0 + 1, z1: D.z1 - 1, skip: [], p: 1 },
    { x: FREIGHT.x1, s: 1, z0: FREIGHT.z0 + 1, z1: FREIGHT.z1 - 1, skip: [], p: 2 },
  ];
  const plats: { objs: THREE.Object3D[]; rect: [number, number, number, number]; top: number }[] = [
    { objs: [], rect: [-A.half, A.z0, A.half, A.z1], top: Y.top },
    { objs: [], rect: [D.x - D.half, D.z0, D.x + D.half, D.z1], top: Y.top },
    { objs: [], rect: [FREIGHT.x0, FREIGHT.z0, FREIGHT.x1, FREIGHT.z1], top: Y.top },
  ];
  for (const pi of [0, 1, 2]) {
  // 升目ごとにまとめる（画角の外の升目は描かない）
  plats[pi].objs = tileRegion(ctx, root, 90, (b) => {
  for (const w of walls.filter((q) => q.p === pi)) {
    for (let za = w.z0; za < w.z1; za += 30) {
      const zb = Math.min(za + 30, w.z1);
      {
        const ok = (z: number): boolean => !w.skip.some(([a, c]) => z > a && z < c);
        const xo = w.x + w.s * 0.01;
        const tufts: THREE.Matrix4[] = [];
        // 壁沿いの配線の管（ホームの笠石の下）と受け
        const runs: [number, number][] = [];
        let rs = za;
        for (let z = za; z <= zb; z += 0.5) {
          if (!ok(z)) {
            if (z - rs > 1) runs.push([rs, z - 0.5]);
            rs = z + 0.5;
          }
        }
        if (zb - rs > 1) runs.push([rs, zb]);
        for (const [a, c] of runs) {
          b.cyl(mat.black, [xo + w.s * 0.05, -0.42, (a + c) / 2], 0.035, c - a, { axis: 'z', segments: 6, shadow: false });
          for (let z = a + 0.4; z < c; z += 2) b.box(mat.steel, [xo + w.s * 0.03, -0.42, z], [0.06, 0.1, 0.04], { shadow: false });
        }
        for (let z = Math.ceil(za / 6) * 6 + 2; z < zb; z += 6) {
          if (!ok(z)) continue;
          // 水抜きの管と、その下の水の筋（暗い細長い板）
          b.cyl(mat.black, [xo + w.s * 0.08, -0.25, z], 0.045, 0.16, { axis: 'x', segments: 8, shadow: false });
          b.box(mat.concreteDark, [xo + w.s * 0.004, -0.75, z], [0.01, 0.95, 0.14 + r() * 0.1], { shadow: false });
        }
        for (let z = Math.ceil((za - 5) / 12) * 12 + 5; z < zb - 1; z += 12) {
          if (!ok(z) || !ok(z - 1) || !ok(z + 1)) continue;
          // 退避の穴（ホームの下の暗い窪み）と、上の黄と黒の帯
          b.box(mat.black, [xo + w.s * 0.003, -0.72, z], [0.02, 0.72, 1.6], { shadow: false });
          b.box(mat.coping, [xo + w.s * 0.03, -0.34, z], [0.06, 0.06, 1.75], { shadow: false });
          for (let k = 0; k < 6; k++) b.box(k % 2 ? mat.black : mat.yellow, [xo + w.s * 0.065, -0.24, z - 0.5 + k * 0.2], [0.01, 0.1, 0.2], { shadow: false });
        }
        for (let z = Math.ceil(za / 20) * 20 + 9; z < zb; z += 20) {
          if (!ok(z)) continue;
          // 番号の札（白い板に青い帯）
          b.box(mat.signWhite, [xo + w.s * 0.012, -0.58, z], [0.02, 0.22, 0.32], { shadow: false });
          b.box(mat.roofT, [xo + w.s * 0.024, -0.5, z], [0.01, 0.06, 0.32], { shadow: false });
        }
        // 壁の根元の草（塊になって生える）
        for (let z = za; z < zb; z += 0.35) {
          if (!ok(z)) continue;
          const k = 0.5 + 0.5 * Math.sin(z * 0.37 + w.x);
          if (r() > 0.25 + k * 0.6) continue;
          const h = 0.18 + r() * 0.3 + k * 0.15;
          tufts.push(trs(xo + w.s * (0.1 + r() * 0.35), Y.ground, z + (r() - 0.5) * 0.3, r() * 6.28, h, h, h));
        }
        if (tufts.length) instanced(b.root, tuftGeometry(7, 11), mat.grass, tufts);
      }
    }
  }
  });
  }
  return plats;
}

/** 線路の脇（0・7 番線の全部と、本線・支線の画角の外） */
function trackside(ctx: SceneContext, root: THREE.Object3D, mat: Mats, r: () => number): THREE.Object3D[] {
  // 線路（x、z の範囲、ケーブルの溝を置く側）
  const lines: { x: number; z0: number; z1: number; trough: 1 | -1 | 0 }[] = [
    { x: TRACK.t0, z0: SITE.z0 + 2, z1: 44, trough: -1 },
    { x: TRACK.t7, z0: -14, z1: 60, trough: 0 },
    { x: TRACK.t1, z0: -100, z1: 42, trough: -1 },
    { x: TRACK.t2, z0: -100, z1: 42, trough: 1 },
    { x: TRACK.t3, z0: 46, z1: 104, trough: -1 },
    { x: TRACK.t6, z0: 46, z1: 104, trough: 1 },
    { x: TRACK.t4, z0: 58, z1: 104, trough: 0 },
    { x: TRACK.t5, z0: 58, z1: 104, trough: 0 },
  ];
  const tuftG = tuftGeometry(8, 21);
  const bushG = bushGeometry(5);
  // 線路の脇は全部まとめて 90 m の升目ごとに
  return tileRegion(ctx, root, 90, (b) => {
  for (const L of lines) {
    for (let za = L.z0; za < L.z1; za += 25) {
      const zb = Math.min(za + 25, L.z1);
      {
        const tufts: THREE.Matrix4[] = [];
        const bushes: THREE.Matrix4[] = [];
        // 道床の肩の草（線路の両側、塊になって）
        for (let z = za; z < zb; z += 0.45) {
          for (const s of [-1, 1]) {
            const x = L.x + s * (2.0 + r() * 0.9);
            const k = 0.5 + 0.5 * Math.sin(z * 0.23 + s * 1.7 + L.x);
            if (r() > 0.15 + k * 0.5) continue;
            const h = (0.15 + r() * 0.2 + k * 0.1) * 1.6;
            if (seen(x, z, 0.3, 2) || onPlatform(x, z)) continue;
            tufts.push(trs(x, Y.ground, z, r() * 6.28, h, h, h));
          }
        }
        // 線路の外の低い茂み（画角の外だけ）
        for (let z = za + r() * 6; z < zb; z += 7 + r() * 9) {
          const s = r() < 0.5 ? -1 : 1;
          const x = L.x + s * (3.2 + r() * 2.5);
          if (seen(x, z, 1.5, 3) || Math.abs(x) < 16.5 && Math.abs(L.x) < 16) continue;
          const n = 2 + Math.floor(r() * 4);
          for (let k = 0; k < n; k++) {
            const sc = 0.5 + r() * 0.7;
            bushes.push(trs(x + (r() - 0.5) * 2.2, Y.ground - 0.05, z + (r() - 0.5) * 2.5, r() * 6.28, sc, sc * (0.7 + r() * 0.6), sc));
          }
        }
        // キロポスト（100 m おき）
        for (let z = Math.ceil(za / 100) * 100 + 20; z < zb; z += 100) {
          const x = L.x + (L.trough || 1) * -2.5;
          if (seen(x, z, 0.3, 2)) continue;
          b.box(mat.signWhite, [x, Y.ground + 0.35, z], [0.14, 0.7, 0.14], { shadow: false });
          b.box(mat.black, [x, Y.ground + 0.55, z], [0.145, 0.12, 0.145], { shadow: false });
        }
        // ケーブルの溝（蓋つきの低いコンクリートの溝）。線路に沿って続く
        if (L.trough) {
          const x = L.x + L.trough * 2.75;
          let rs: number | null = null;
          const flush = (a: number, c: number): void => {
            if (c - a < 1) return;
            b.boxMM(mat.curb, [x - 0.18, Y.ground, a], [x + 0.18, Y.ground + 0.22, c], { shadow: false });
            for (let z = a + 0.5; z < c; z += 0.5) b.box(mat.concreteDark, [x, Y.ground + 0.222, z], [0.36, 0.004, 0.02], { shadow: false });
          };
          for (let z = za; z <= zb; z += 1) {
            const vis = seen(x, z, 0.3, 2);
            if (!vis && rs === null) rs = z;
            if ((vis || z + 1 > zb) && rs !== null) {
              flush(rs, vis ? z - 1 : zb);
              rs = null;
            }
          }
        }
        if (tufts.length) instanced(b.root, tuftG, mat.grass, tufts);
        if (bushes.length) instanced(b.root, bushG, mat.bush, bushes);
      }
    }
  }
  // 信号の機器箱（D の北端の先・旧貨物の側線の分かれ目）と、錆びたレールと枕木の山
  {
    for (const [x, z] of [[TRACK.t0 + 2.9, 0.0], [TRACK.t7 - 2.6, -12], [TRACK.t0 + 2.9, 47]] as const) {
      if (seen(x, z, 1, 2)) continue;
      b.boxMM(mat.cabinet, [x - 0.4, Y.ground, z - 0.6], [x + 0.4, Y.ground + 1.5, z + 0.6], { collide: true });
      b.boxMM(mat.housing, [x - 0.45, Y.ground + 1.5, z - 0.65], [x + 0.45, Y.ground + 1.58, z + 0.65]);
      b.box(mat.black, [x + (x > TRACK.t0 ? -0.41 : 0.41), Y.ground + 0.9, z], [0.01, 0.9, 0.5], { shadow: false });
      b.box(mat.signWhite, [x + (x > TRACK.t0 ? -0.415 : 0.415), Y.ground + 1.25, z], [0.01, 0.12, 0.3], { shadow: false });
    }
    const px = TRACK.t7 - 3.6;
    for (const z0 of [6, 22]) {
      if (seen(px, z0, 3, 2)) continue;
      for (let k = 0; k < 5; k++) b.box(mat.sleeper, [px, Y.ground + 0.07 + k * 0.14, z0 + (k % 2) * 0.1], [2.0, 0.14, 1.2 - k * 0.15], { rotY: Math.PI / 2, collide: k === 0 });
      for (let k = 0; k < 4; k++) b.box(mat.railRust, [px + 1.6 + k * 0.12, Y.ground + 0.08, z0 + 4], [0.07, 0.15, 8], { shadow: false });
      ctx.colliders.addCentered(px, Y.ground + 0.4, z0, 1.4, 0.8, 2.2);
    }
  }
  });
}

/** 野原の作り込み */
function fields(ctx: SceneContext, root: THREE.Object3D, mat: Mats, r: () => number): THREE.Object3D[] {
  // 野原の作り込みは全部まとめて 90 m の升目ごとに（材質ごとの描画の回数を減らす）
  return tileRegion(ctx, root, 90, (fb) => {
  const bushG = bushGeometry(9);
  /** 用水路（コンクリートの縁・暗い溝・水面）。along の向きに a0〜a1、横の中心 c。skip の範囲は小さな橋（板）で渡す */
  const ditch = (b: Builder, along: 'x' | 'z', a0: number, a1: number, c: number, skip: [number, number][], bushes: THREE.Matrix4[]): void => {
    const y = Y.ground;
    const seg = (s0: number, s1: number): void => {
      if (s1 - s0 < 0.5) return;
      const box = (u0: number, u1: number, y0: number, y1: number, m: THREE.Material): void => {
        if (along === 'z') b.boxMM(m, [c + u0, y0, s0], [c + u1, y1, s1], { shadow: false });
        else b.boxMM(m, [s0, y0, c + u0], [s1, y1, c + u1], { shadow: false });
      };
      box(-0.55, -0.42, y - 0.4, y + 0.06, mat.curb);
      box(0.42, 0.55, y - 0.4, y + 0.06, mat.curb);
      box(-0.42, 0.42, y - 0.45, y - 0.38, mat.concreteDark);
      box(-0.42, 0.42, y - 0.3, y - 0.27, mat.water);
    };
    const cuts = [...skip].sort((p, q) => p[0] - q[0]);
    let s = a0;
    for (const [k0, k1] of cuts) {
      seg(s, k0);
      // 小さな橋（コンクリートの板）
      if (along === 'z') b.boxMM(mat.curb, [c - 0.7, y - 0.02, k0], [c + 0.7, y + 0.1, k1], { shadow: false });
      else b.boxMM(mat.curb, [k0, y - 0.02, c - 0.7], [k1, y + 0.1, c + 0.7], { shadow: false });
      s = k1;
    }
    seg(s, a1);
    // 溝の脇の茂み（ところどころ塊で）
    for (let t = a0 + r() * 5; t < a1; t += 4 + r() * 8) {
      if (skip.some(([k0, k1]) => t > k0 - 2 && t < k1 + 2)) continue;
      const side = r() < 0.5 ? -1 : 1;
      const u = c + side * (1.0 + r() * 0.8);
      const [x, z] = along === 'z' ? [u, t] : [t, u];
      if (seen(x, z, 1.5, 3)) continue;
      const n = 1 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const sc = 0.45 + r() * 0.55;
        bushes.push(trs(x + (r() - 0.5) * 1.2, Y.ground - 0.05, z + (r() - 0.5) * 1.6, r() * 6.28, sc, sc * (0.8 + r() * 0.5), sc));
      }
    }
  };
  // 西の農道の東の溝・道の南の溝
  ((b: Builder) => {
    const bushes: THREE.Matrix4[] = [];
    ditch(b, 'z', ROAD.z1 + 2.4, 79, -92.6, [[18.5, 26], [44.5, 48.5], [59, 65.5]], bushes);
    ditch(b, 'x', SITE.x0 + 1, -77.5, ROAD.z1 + 2.4, [[-95, -93]], bushes);
    instanced(b.root, bushG, mat.bush, bushes);
  })(fb);
  // 北西の農道の東の溝
  ((b: Builder) => {
    const bushes: THREE.Matrix4[] = [];
    ditch(b, 'z', SITE.z0 + 2, ROAD.z0 - 2.4, -90.8, [[-65, -59]], bushes);
    instanced(b.root, bushG, mat.bush, bushes);
  })(fb);
  // 東の農道の東の溝
  ((b: Builder) => {
    const bushes: THREE.Matrix4[] = [];
    ditch(b, 'z', -27, 13, 33.2, [[-23.5, -16.5], [-7.2, -4.8]], bushes);
    instanced(b.root, bushG, mat.bush, bushes);
  })(fb);

  // 畑の中の茂みの塊（画角の外の野原に、群れで）。場所の範囲（x0, z0, x1, z1）
  const zones: [number, number, number, number][] = [
    [-99, -98, -76, -10],
    [-90, -98, -16, -12],
    [-99, -1, -78, 104],
    [17, -32, 39, 24],
    // 旧踏切道の南西（支線の西の野原。station-3・station-0 の画角の間）
    [-50, 55, -27, 80],
  ];
  for (const zn of zones) {
    ((b: Builder) => {
      const bushes: THREE.Matrix4[] = [];
      const area = (zn[2] - zn[0]) * (zn[3] - zn[1]);
      const groups = Math.round(area / 260);
      for (let i = 0; i < groups; i++) {
        const cx = zn[0] + r() * (zn[2] - zn[0]);
        const cz = zn[1] + r() * (zn[3] - zn[1]);
        if (seen(cx, cz, 3, 4) || blockedField(cx, cz)) continue;
        const n = 2 + Math.floor(r() * 5);
        for (let k = 0; k < n; k++) {
          const sc = 0.4 + r() * 0.6;
          const x = cx + (r() - 0.5) * 4;
          const z = cz + (r() - 0.5) * 4;
          if (blockedField(x, z)) continue;
          bushes.push(trs(x, Y.ground - 0.05, z, r() * 6.28, sc, sc * (0.6 + r() * 0.5), sc));
        }
      }
      if (bushes.length) instanced(b.root, bushG, mat.bush, bushes);
    })(fb);
  }

  // 畦（田の区切りの低い土手と草）。画角に入る所は切る
  const ridges: [number, number, number, number][] = [
    // 西の野原: 南北に 1 本、東西に 3 本
    [-86.2, 20.5, -86.2, 78],
    [-92, 28, -77.5, 28],
    [-92, 50, -77.5, 50],
    [-92, 70, -77.5, 70],
    // 北西の野原
    [-89.5, -30, -34, -30],
    [-89.5, -55, -52, -55],
    [-89.5, -80, -74, -80],
    [-70, -97, -70, -13],
    [-45, -60, -45, -13],
    // 東の野原（農道の西）
    [22, -32, 22, 23],
    [17, 0, 27.5, 0],
    [17, -18, 27.5, -18],
    // 支線の西の野原
    [-48, 58, -27, 58],
    [-48, 76, -27, 76],
    [-44, 58, -44, 80],
  ];
  ((b: Builder) => {
    const tufts: THREE.Matrix4[] = [];
    for (const [xa, za, xb, zb] of ridges) {
      const len = Math.hypot(xb - xa, zb - za);
      const n = Math.ceil(len / 1);
      let run: number | null = null;
      const flush = (t0: number, t1: number): void => {
        if (t1 - t0 < 1) return;
        const ax = xa + ((xb - xa) * t0) / len;
        const az = za + ((zb - za) * t0) / len;
        const bx = xa + ((xb - xa) * t1) / len;
        const bz = za + ((zb - za) * t1) / len;
        // 断面は台形（下 0.9 m・上 0.35 m・高さ 0.15 m）を長手に押し出す
        const sh = new THREE.Shape();
        sh.moveTo(-0.45, -0.04);
        sh.lineTo(-0.17, 0.15);
        sh.lineTo(0.17, 0.15);
        sh.lineTo(0.45, -0.04);
        sh.lineTo(-0.45, -0.04);
        const L = Math.hypot(bx - ax, bz - az);
        const g = new THREE.ExtrudeGeometry(sh, { depth: L, bevelEnabled: false });
        g.rotateY(Math.atan2(bx - ax, bz - az));
        b.mesh(g, mat.ridge, [ax, Y.ground, az], { shadow: false });
        for (let t = t0; t < t1; t += 0.4) {
          if (r() > 0.75) continue;
          const h = 0.16 + r() * 0.25;
          tufts.push(trs(xa + ((xb - xa) * t) / len + (r() - 0.5) * 0.5, Y.ground + 0.08, za + ((zb - za) * t) / len + (r() - 0.5) * 0.5, r() * 6.28, h, h, h));
        }
      };
      for (let i = 0; i <= n; i++) {
        const t = (i / n) * len;
        const x = xa + ((xb - xa) * t) / len;
        const z = za + ((zb - za) * t) / len;
        const bad = seen(x, z, 0.5, 3) || blockedField(x, z, true);
        if (!bad && run === null) run = t;
        if ((bad || i === n) && run !== null) {
          flush(run, bad ? t - 1 : t);
          run = null;
        }
      }
    }
    if (tufts.length) instanced(b.root, tuftGeometry(7, 31), mat.grass, tufts);
  })(fb);

  // 冬枯れの木（野原の中に 2〜3 本ずつ）
  ((b: Builder) => {
    for (const [x, z, n] of [[-80, 60, 3], [-60, -40, 2], [-82, -88, 3], [24, -26, 2], [-30, -20, 1]] as const) {
      for (let k = 0; k < n; k++) {
        const tx = x + (r() - 0.5) * 6;
        const tz = z + (r() - 0.5) * 6;
        if (seen(tx, tz, 3, 3) || blockedField(tx, tz)) continue;
        bareTree(b, { ...mat, wood: mat.woodP }, tx, tz, 6 + r() * 4, r);
        ctx.colliders.addCentered(tx, Y.ground + 1, tz, 0.5, 2, 0.5);
      }
    }
  })(fb);

  // 送電線（西の野原の外を南北に。鉄塔と 3 本の電線。霧の向こうの影）
  ((b: Builder) => {
    const towers: V3[] = [];
    for (const [x, z] of [[-142, -105], [-146, 40], [-150, 175]] as const) {
      if (seen(x, z, 6, 4)) continue;
      const H = 30;
      for (const dx of [-1, 1]) for (const dz of [-1, 1]) strut(b, mat.far, [x + dx * 3.2, Y.ground, z + dz * 3.2], [x + dx * 0.7, Y.ground + H, z + dz * 0.7], 0.22, 0.22);
      for (let y = 3; y < H - 1; y += 3.2) {
        const w = 6.4 - (y / H) * 5.0;
        b.box(mat.far, [x, Y.ground + y, z], [w, 0.12, 0.12], { shadow: false });
        b.box(mat.far, [x, Y.ground + y, z], [0.12, 0.12, w], { shadow: false });
        strut(b, mat.far, [x - w / 2, Y.ground + y, z + w / 2], [x + w / 2 - 0.3, Y.ground + y + 3, z + w / 2 - 0.3], 0.08, 0.08);
      }
      for (const [y, w] of [[H - 6, 11], [H - 2.5, 8]] as const) b.box(mat.far, [x, Y.ground + y, z], [w, 0.5, 0.6], { shadow: false });
      towers.push([x, Y.ground + H - 6.5, z]);
    }
    for (let i = 0; i + 1 < towers.length; i++) {
      for (const [d, y] of [[-5, 0], [5, 0], [0, 3.5]] as const) {
        const a = new THREE.Vector3(towers[i][0] + d, towers[i][1] + y, towers[i][2]);
        const c = new THREE.Vector3(towers[i + 1][0] + d, towers[i + 1][1] + y, towers[i + 1][2]);
        const m = a.clone().lerp(c, 0.5);
        m.y -= 6;
        b.mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, m, c), 16, 0.05, 3, false), mat.far, [0, 0, 0], { shadow: false });
      }
    }
  })(fb);

  // 北西の農道の電柱の列（28 m おき）と電線
  ((b: Builder) => {
    const pts: V3[] = [];
    for (let z = ROAD.z0 - 6; z > SITE.z0; z -= 28) {
      const x = -91.6 + 2.0;
      b.cyl(mat.poleConc, [x, Y.ground + 4.75, z], 0.13, 9.5, { radiusTop: 0.09, segments: 8 });
      b.box(mat.steel, [x, Y.ground + 9.1, z], [1.6, 0.08, 0.08]);
      for (const d of [-0.6, 0, 0.6]) b.cyl(mat.board, [x + d, Y.ground + 9.2, z], 0.04, 0.12, { segments: 6 });
      ctx.colliders.addCentered(x, Y.ground + 1.5, z, 0.3, 3, 0.3);
      pts.push([x, Y.ground + 9.2, z]);
    }
    for (let i = 0; i + 1 < pts.length; i++) {
      for (const d of [-0.6, 0.6]) {
        const a = new THREE.Vector3(pts[i][0] + d, pts[i][1], pts[i][2]);
        const c = new THREE.Vector3(pts[i + 1][0] + d, pts[i + 1][1], pts[i + 1][2]);
        const m = a.clone().lerp(c, 0.5);
        m.y -= 0.4;
        b.mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, m, c), 8, 0.012, 3, false), mat.wire, [0, 0, 0], { shadow: false });
      }
    }
  })(fb);

  // ビニールハウス（西の野原。アーチの管と、破れかけた半透明の膜）
  ((b: Builder) => {
    const cx = -84;
    const z0 = 1;
    const z1 = 19;
    const R = 2.6;
    for (let z = z0; z <= z1 + 0.01; z += 1.5) {
      const curve = new THREE.EllipseCurve(0, 0, R, R * 0.95, 0, Math.PI, false, 0);
      const pts = curve.getPoints(14).map((p) => new THREE.Vector3(cx + p.x, Y.ground + p.y, z));
      b.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.025, 4, false), mat.steel, [0, 0, 0], { shadow: false });
    }
    for (const a of [0.35, 1.0, 1.57, 2.14, 2.79]) {
      const x = cx + Math.cos(a) * R;
      const y = Y.ground + Math.sin(a) * R * 0.95;
      b.boxMM(mat.steel, [x - 0.02, y - 0.02, z0], [x + 0.02, y + 0.02, z1], { shadow: false });
    }
    // 膜（屋根の半分ずつ、端は少し欠ける）
    const film = new THREE.CylinderGeometry(R, R, z1 - z0 - 1.5, 18, 1, true, -Math.PI / 2, Math.PI);
    film.rotateX(Math.PI / 2);
    film.scale(1, 0.95, 1);
    b.mesh(film, mat.film, [cx, Y.ground, (z0 + z1) / 2 + 0.4], { shadow: false });
    ctx.colliders.add({ x: cx - R, y: Y.ground, z: z0 }, { x: cx + R, y: Y.ground + 2.4, z: z1 });
    // ポンプ小屋（溝の分かれ目）
    b.boxMM(mat.curb, [-90.4, Y.ground, 0.2], [-88.4, Y.ground + 1.9, 2.0], { collide: true });
    b.boxMM(mat.rust, [-90.6, Y.ground + 1.9, 0.0], [-88.2, Y.ground + 2.0, 2.2]);
    b.box(mat.doorLeaf, [-88.38, Y.ground + 0.8, 1.1], [0.04, 1.5, 0.8]);
    b.cyl(mat.steel, [-91.2, Y.ground + 0.3, 1.1], 0.08, 1.6, { axis: 'x', segments: 8 });
  })(fb);

  // 支線の西の野原の農作業小屋（トタンの片流れ屋根）
  ((b: Builder) => {
    const x = -38;
    const z = 67;
    if (seen(x, z, 4, 1.5)) return;
    b.boxMM(mat.tin, [x - 2, Y.ground, z - 3], [x + 2, Y.ground + 2.5, z + 3], { collide: true });
    b.box(mat.rust, [x, Y.ground + 2.75, z], [4.6, 0.1, 6.6], { rotZ: 0.12 });
    b.box(mat.black, [x + 2.01, Y.ground + 1.0, z + 1.0], [0.05, 2.0, 1.6], { shadow: false });
    for (let k = 0; k < 3; k++) b.cyl(mat.signWhite, [x + 3.2, Y.ground + 0.55, z - 2 + k * 1.3], 0.55, 1.0, { axis: 'z', segments: 14, collide: true });
  })(fb);

  // 稲のはさ掛け（東の畑。木の柱と横木に、乾かす稲の束）
  ((b: Builder) => {
    const x = 35;
    for (const [za, zb] of [[-15, -8.5], [-3.5, 3]] as const) {
      for (let z = za; z <= zb + 0.01; z += 1.3) {
        strut(b, mat.woodP, [x - 0.35, Y.ground, z], [x, Y.ground + 2.3, z], 0.08, 0.08);
        strut(b, mat.woodP, [x + 0.35, Y.ground, z], [x, Y.ground + 2.3, z], 0.08, 0.08);
      }
      for (const y of [1.1, 1.6, 2.1]) {
        b.boxMM(mat.woodP, [x - 0.04, Y.ground + y - 0.03, za], [x + 0.04, Y.ground + y + 0.03, zb], { shadow: false });
        // 稲の束（横木に掛けて両側へ垂れる。上が細く下が広がる）
        for (let z = za + 0.12; z < zb; z += 0.19) {
          for (const sd of [-1, 1]) {
            const g = new THREE.CylinderGeometry(0.035, 0.09 + r() * 0.03, 0.5, 5, 1);
            g.rotateX((r() - 0.5) * 0.15);
            g.rotateZ(sd * (0.22 + r() * 0.08));
            b.mesh(g, mat.straw, [x + sd * 0.07, Y.ground + y - 0.24, z], { shadow: false });
          }
        }
      }
      ctx.colliders.add({ x: x - 0.5, y: Y.ground, z: za }, { x: x + 0.5, y: Y.ground + 2.3, z: zb });
    }
  })(fb);
  });
}

/** ホームの上・中か（草を置かない） */
function onPlatform(x: number, z: number): boolean {
  const ps: [number, number, number, number][] = [
    [-A.half - 0.1, A.z0, A.half + 0.1, A.z1],
    [D.x - D.half - 0.1, D.z0, D.x + D.half + 0.1, D.z1],
    [-10.6, 45.2, 10.6, 57.6],
    [FREIGHT.x0, FREIGHT.z0, FREIGHT.x1 + 0.1, FREIGHT.z1],
  ];
  return ps.some((q) => x > q[0] && x < q[2] && z > q[1] && z < q[3]);
}

/** 野原の中で茂みを置かない所（道・線路・建物・小屋・農道）。low = 低い物（畦）は農道の脇の溝までは置ける */
function blockedField(x: number, z: number, low = false): boolean {
  if (low) {
    const lo: [number, number, number, number][] = [
      [-16.5, -200, 16.5, 200],
      [-200, ROAD.z0 - 2, -40, ROAD.z1 + 3],
      [TRACK.t7 - 3, -200, TRACK.t0 + 3, 200],
      [FREIGHT.x0 - 6, FREIGHT.z0 - 2, FREIGHT.x1, FREIGHT.z1 + 4],
      [-99, -200, -91.4, 200],
      [-87.5, -1, -80, 20],
      [27, -30, 34, 16],
      [-93, 44, -90, 48],
      [-86, 34, -80, 41],
      [-92, 59, -86, 65],
      [-92.3, -65, -85, -59],
      [-41, 63, -34, 71],
    ];
    return lo.some((q) => x > q[0] && x < q[2] && z > q[1] && z < q[3]);
  }
  const no: [number, number, number, number][] = [
    [-16.5, -200, 16.5, 200],
    [-200, ROAD.z0 - 2, -40, ROAD.z1 + 3],
    [TRACK.t7 - 3, -200, TRACK.t0 + 3, 200],
    [FREIGHT.x0 - 6, FREIGHT.z0 - 2, FREIGHT.x1, FREIGHT.z1 + 4],
    [-99, -200, -89.5, 200],
    [-87.5, -1, -80, 20],
    [27, -30, 34, 16],
    [32, -22, 38.5, -18],
    [-93, 18, -88, 26],
    [-94, 59, -86, 65],
    [-93, 44, -90, 48],
    [-86, 34, -80, 41],
  ];
  return no.some((q) => x > q[0] && x < q[2] && z > q[1] && z < q[3]);
}

/** 遠景（霧の向こうの影）: 画角の外の向き（西・北西・北東・南西・南東）に、屋敷林・農家・倉庫・給水塔 */
function farSilhouettes(ctx: SceneContext, root: THREE.Object3D, mat: Mats, r: () => number): void {
  // 遠くの林は粗い形で足りる（霧で輪郭しか見えない）
  const bushG = bushGeometry(13, 1);
  const house = (b: Builder, x: number, z: number, w: number, d: number, h: number, rot: number): void => {
    b.box(mat.farHaze, [x, Y.ground + h / 2, z], [w, h, d], { rotY: rot, shadow: false });
    const roof = new THREE.CylinderGeometry(0.01, Math.hypot(w, d) * 0.55, h * 0.7, 4, 1);
    roof.rotateY(Math.PI / 4);
    roof.scale(w / Math.hypot(w, d) * 1.45, 1, d / Math.hypot(w, d) * 1.45);
    b.mesh(roof, mat.farHaze, [x, Y.ground + h + h * 0.35, z], { rotY: rot, shadow: false });
  };
  const sites: { x: number; z: number; kind: 'farm' | 'grove' | 'shed' | 'tower' }[] = [
    { x: -175, z: -45, kind: 'farm' },
    { x: -168, z: 35, kind: 'farm' },
    { x: -190, z: 0, kind: 'grove' },
    { x: -185, z: 70, kind: 'grove' },
    { x: -160, z: -120, kind: 'shed' },
    { x: -200, z: -90, kind: 'grove' },
    { x: 160, z: -110, kind: 'farm' },
    { x: 190, z: -70, kind: 'grove' },
    { x: -150, z: 150, kind: 'farm' },
    { x: -200, z: 120, kind: 'tower' },
    { x: 150, z: 170, kind: 'shed' },
    { x: 200, z: 140, kind: 'grove' },
  ];
  // 遠景は 400 m の升目でまとめる（どれも画角の外。描画の回数を減らす）
  tileRegion(ctx, root, 400, (b) => {
  for (const s of sites) {
    if (seen(s.x, s.z, 25, 5)) continue;
    {
      const bushes: THREE.Matrix4[] = [];
      const grove = (cx: number, cz: number, len: number, rot: number): void => {
        const ux = Math.cos(rot);
        const uz = Math.sin(rot);
        for (let t = -len / 2; t < len / 2; t += 2.5 + r() * 2) {
          const sc = 3 + r() * 3.5;
          bushes.push(trs(cx + ux * t + (r() - 0.5) * 4, Y.ground - 0.3, cz + uz * t + (r() - 0.5) * 4, r() * 6.28, sc, sc * (1.3 + r() * 1.2), sc));
        }
      };
      const rot = (r() - 0.5) * 0.6;
      if (s.kind === 'farm') {
        house(b, s.x, s.z, 12, 9, 4.5, rot);
        house(b, s.x + 14, s.z + 6, 8, 6, 3.2, rot + 0.1);
        grove(s.x - 4, s.z - 12, 34, rot);
        grove(s.x - 16, s.z, 22, rot + Math.PI / 2);
      } else if (s.kind === 'grove') {
        grove(s.x, s.z, 50 + r() * 30, rot + (r() < 0.5 ? Math.PI / 2 : 0));
      } else if (s.kind === 'shed') {
        b.box(mat.farHaze, [s.x, Y.ground + 3.5, s.z], [36, 7, 14], { rotY: rot, shadow: false });
        grove(s.x + 25, s.z, 20, rot);
      } else {
        for (const dx of [-1.5, 1.5]) for (const dz of [-1.5, 1.5]) strut(b, mat.farHaze, [s.x + dx * 1.4, Y.ground, s.z + dz * 1.4], [s.x + dx, Y.ground + 14, s.z + dz], 0.3, 0.3);
        b.cyl(mat.farHaze, [s.x, Y.ground + 16, s.z], 3.2, 4.5, { segments: 12 });
        grove(s.x + 10, s.z + 8, 26, rot);
      }
      if (bushes.length) instanced(b.root, bushG, mat.farHaze, bushes);
    }
  }
  });
}
