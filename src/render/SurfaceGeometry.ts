import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { bevelRadius, chamferBoxGeometry } from './ChamferBox';
import type { Box, LightingOverrides, MatId, RoomLayout } from '../generators/layout';
import { inFootprint } from '../generators/footprint';
import { SURFACES } from './MaterialLibrary';
import { writeSurfaceCoordinates } from './SurfaceAppearance';
import {
  F_CX, F_R, FIXTURE_STRIDE, LIGHT_TUNING, OCC_AO, OCC_SHADOW,
  beamDistribution, bounceScale, bounceWeight, buildFixtureSamples, fixtureHalo, fixtureIrradiance, fixtureIsNear, fixtureSampleGrid, hemiWeight,
  type BakeRequest,
} from './lightmap.worker';

/** Original collision boxes are untouched. Only the render mesh receives bevels.
 *  opts.legacy: 面取り・テッセレーション無し（RenderStyle legacy） */
export { isBevelMat, setBevelQuality, bevelRadius, type BevelQuality } from './ChamferBox';

export function surfaceBox(b: Box, opts?: { legacy?: boolean }): THREE.BufferGeometry {
  const size = b.max.map((v, i) => v - b.min[i]);
  const r = opts?.legacy ? 0 : bevelRadius(b.mat, size);
  const g = r > 0
    ? b.mat === 'carPaint' || b.mat === 'carGlass'
      // 車体は大きな丸みを分割無しの RoundedBox のまま（carGlass は下で台形に絞る）
      ? new RoundedBoxGeometry(size[0], size[1], size[2], 1, r)
      : chamferBoxGeometry(size[0], size[1], size[2], r)
    : opts?.legacy
      ? new THREE.BoxGeometry(size[0], size[1], size[2])
      : new THREE.BoxGeometry(size[0], size[1], size[2], Math.max(1, Math.min(40, Math.ceil(size[0] / 1.25))), Math.max(1, Math.min(40, Math.ceil(size[1] / 1.25))), Math.max(1, Math.min(40, Math.ceil(size[2] / 1.25))));
  if (b.mat === 'carGlass') {
    const a = g.getAttribute('position');
    for (let i = 0; i < a.count; i++) {
      const t = Math.max(0, (a.getY(i) / size[1]) + .5);
      a.setX(i, a.getX(i) * (1 - .17 * t)); a.setZ(i, a.getZ(i) * (1 - .2 * t));
    }
    g.computeVertexNormals();
  }
  g.translate(...b.max.map((v, i) => (v + b.min[i]) / 2) as [number, number, number]);
  if (!opts?.legacy) writeSurfaceCoordinates(g, SURFACES[b.mat].meters, b.mat);
  else applyMetricUV(g, b.mat);
  return g;
}

export function applyMetricUV(g: THREE.BufferGeometry, id: MatId): void {
  const pos = g.getAttribute('position'), normal = g.getAttribute('normal');
  const uv = new Float32Array(pos.count * 2);
  const scale = SURFACES[id].meters;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = Math.abs(normal.getX(i)), ny = Math.abs(normal.getY(i)), nz = Math.abs(normal.getZ(i));
    const u = ny >= nx && ny >= nz ? x : nx > nz ? z : x;
    const v = ny >= nx && ny >= nz ? z : y;
    uv[i * 2] = u / scale; uv[i * 2 + 1] = v / scale;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

interface Directional { dir: THREE.Vector3; color: THREE.Color; power: number; }

export interface SurfaceLightingOptions extends LightingOverrides {
  /** E03 ロール済みレイアウト: 薄いパネルの向きが縦になるので、発光箱は中心 1 点の全方向放射にする */
  roll?: boolean;
  /** 遠方の遮蔽体を捨てる近傍半径（m）。巨大部屋でのコスト抑制。既定 LIGHT_TUNING.range（14） */
  emitterRange?: number;
}

/** 焼き込みの遮蔽判定に使う箱: 最小辺 8 cm 以上かつ体積 0.05 m³ 以上（壁・床・ロッカー・棚の本体・柱など） */
export function isOccluder(b: Box): boolean {
  const sx = b.max[0] - b.min[0], sy = b.max[1] - b.min[1], sz = b.max[2] - b.min[2];
  return Math.min(sx, sy, sz) >= 0.08 && sx * sy * sz >= 0.05;
}

/** 大きな箱の頂点焼き込みで遮蔽に使う箱: 壁・柱・床・天井、または体積 0.4 m³ 以上（ロッカー・棚・自販機） */
function isLargeOccluder(b: Box): boolean {
  if (!isOccluder(b)) return false;
  const sx = b.max[0] - b.min[0], sy = b.max[1] - b.min[1], sz = b.max[2] - b.min[2];
  return sx * sy * sz >= 0.4 || /^(wall|column|floor|ceiling)/.test(b.mat);
}

/**
 * Static, deterministic approximation of area illumination and contact occlusion.
 * Evaluated once per generated mesh, never per frame. It is not path-traced GI.
 *
 * v1.3 写実化（担当 L1）: 器具（発光箔）を面光源として扱い、配光・距離減衰・器具まわりの滲み・反射光の広がりを
 * `lightmap.worker.ts` の共有カーネルで計算する。同じカーネルを Worker がテクセル単位で使うので、ライトマップ到着前後の
 * 平均的な明るさが一致する。ここ（頂点焼き込み）は AO を持たず、代わりに近傍の接触陰影を使う。
 * - 全器具を 1×1〜4×2 点でサンプル（近い / 大きい器具だけ。遠い器具は中心 1 点）。遮蔽判定は器具ごとに 1 本
 * - 環境光 = palette.ambient × ambientScale × S(反射光の広がり) × 上向き重み。器具から遠い突き当たりは bounceFloor 倍まで沈む
 * - 滲み（halo）は頂点密度が足りる小さな箱（器具の金属トレイなど）だけ。天井スラブは Worker のテクセルが担う
 * v1.3: 平行光（FakeSky の日射）、空の環境光、遮蔽判定のオン/オフ（InvertedShadow）、面発光箱（areaEmitters）、ロール対応。
 */
export class SurfaceLighting {
  /** packed 器具（lightmap.worker の FIXTURE_STRIDE）。Worker への転送にも使う */
  readonly fixtures: Float32Array;
  private readonly samples: Float32Array;
  private readonly sampleOffset: Int32Array;
  private readonly directionals: Directional[];
  /** 遮蔽体（solid な箱 + 見た目用の細部。ガラス・水・空・デカールを除く） */
  readonly blockers: Box[];
  private readonly ambient: THREE.Color;
  private readonly skyAmbient: THREE.Color | null;
  private readonly occlusion: boolean;
  private readonly range2: number;
  /** 8 m 格子の遮蔽体インデックス（巨大部屋の近傍参照用）。セル → blockers の添字 */
  private grid = new Map<string, number[]>();
  private stamp: Uint32Array = new Uint32Array(0);
  private stampId = 0;
  private static readonly CELL = 8;

  constructor(private layout: RoomLayout, _refined = false, opts: SurfaceLightingOptions = layout.lighting ?? {}) {
    this.fixtures = buildFixtures(layout, !!opts.roll, !!opts.areaEmitters);
    // 頂点焼き込みの面サンプルは 2×2 まで（頂点間隔 1.25 m ではそれ以上の差が出ない。4×2 は Worker のテクセルで使う）
    const s = buildFixtureSamples(this.fixtures, 2);
    this.samples = s.samples;
    this.sampleOffset = s.offset;
    this.directionals = (opts.directional ?? []).map((d) => ({ dir: new THREE.Vector3(...d.dir).normalize(), color: new THREE.Color(d.color), power: d.intensity }));
    // 見た目用の細部（机の天板・棚板・柱）も遮蔽に含める（V04 手順 3）。光の遮蔽には isOccluder で更に絞る
    this.blockers = layout.boxes.filter((b) => (b.solid || (!SURFACES[b.mat].emission && b.max[1] - b.min[1] > .025)) && b.mat !== 'glass' && b.mat !== 'water' && b.mat !== 'waterShallow' && b.mat !== 'waterWall' && b.mat !== 'waterFilm' && !/^sky/.test(b.mat) && !SURFACES[b.mat].decal);
    this.ambient = new THREE.Color(layout.palette.ambient);
    this.skyAmbient = opts.skyAmbient ? new THREE.Color(opts.skyAmbient.color).multiplyScalar(opts.skyAmbient.intensity) : null;
    this.occlusion = opts.occlusion ?? true;
    const range = opts.emitterRange ?? LIGHT_TUNING.range;
    this.range2 = range * range;
    if (this.blockers.length > 400) this.buildGrid();
  }

  private buildGrid(): void {
    const c = SurfaceLighting.CELL;
    this.blockers.forEach((b, i) => {
      const x0 = Math.floor(b.min[0] / c), x1 = Math.floor(b.max[0] / c);
      const z0 = Math.floor(b.min[2] / c), z1 = Math.floor(b.max[2] / c);
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
        const k = `${x},${z}`;
        let arr = this.grid.get(k);
        if (!arr) this.grid.set(k, arr = []);
        arr.push(i);
      }
    });
    this.stamp = new Uint32Array(this.blockers.length);
  }

  /** own の近傍（xz で extent + 1 m 以内）にある遮蔽体（接触陰影と、頂点焼き込みの近傍遮蔽判定用）。
   *  頂点焼き込みの遮蔽体は箱の近傍だけ（従来どおり。遠方まで含めると駐車場 381 箱で 36 → 190 ms）。
   *  外殻・大きな家具は Worker のテクセル焼き込みが線分全域の遮蔽体で置き換える */
  private nearbyBlockers(own: Box | undefined, c: THREE.Vector3, extent: number): Box[] {
    const r = extent + 1;
    const x0 = c.x - r, x1 = c.x + r, z0 = c.z - r, z1 = c.z + r;
    if (this.grid.size) {
      const cell = SurfaceLighting.CELL;
      const id = ++this.stampId;
      const out: Box[] = [];
      for (let x = Math.floor(x0 / cell); x <= Math.floor(x1 / cell); x++) {
        for (let z = Math.floor(z0 / cell); z <= Math.floor(z1 / cell); z++) {
          const arr = this.grid.get(`${x},${z}`);
          if (!arr) continue;
          for (const i of arr) {
            if (this.stamp[i] === id) continue;
            this.stamp[i] = id;
            const b = this.blockers[i];
            if (b !== own && x1 > b.min[0] && x0 < b.max[0] && z1 > b.min[2] && z0 < b.max[2]) out.push(b);
          }
        }
      }
      return out;
    }
    return this.blockers.filter((b) => b !== own && x1 > b.min[0] && x0 < b.max[0] && z1 > b.min[2] && z0 < b.max[2]);
  }

  bake(g: THREE.BufferGeometry, own?: Box): void {
    const p = g.getAttribute('position'), n = g.getAttribute('normal');
    const out = new Float32Array(p.count * 3);
    const pt = new THREE.Vector3(), norm = new THREE.Vector3();
    const far = new THREE.Vector3(), fpos = new THREE.Vector3();
    const fx = this.fixtures;
    const T = LIGHT_TUNING;
    // Box-local shortlist keeps work bounded in large warehouses.
    const c = own ? new THREE.Vector3(...own.min.map((v, i) => (v + own.max[i]) / 2) as [number, number, number]) : new THREE.Vector3();
    const extent = own ? Math.hypot(...own.max.map((v, i) => v - own.min[i])) / 2 : 10;
    const blockersAll = this.nearbyBlockers(own, c, extent);
    // 光を遮る判定は「ある程度の体積を持つ箱」だけ（机の天板・椅子の座面・棚板・脚のような薄い/細い部品は無視）。
    // 食堂・倉庫では家具の部品が数千個あり、全部を総当たりすると 1 部屋の焼き込みに数秒かかる。
    // 大きな箱（外殻・長机。頂点ごとに遮蔽レイを飛ばす）は更に「壁・柱・体積 0.4 m³ 以上」だけを相手にする
    // （床の頂点 × 器具 50 台 × 椅子 2,000 脚の総当たりを避ける。椅子の影は Worker のテクセルが出す）
    const perBox = !!own && extent < 1.2;
    const blockers = blockersAll.filter(perBox ? isOccluder : isLargeOccluder);
    // 接触陰影（0.45 m 以内）に効く遮蔽体は箱の近傍だけ。大きな箱（床・天井・壁）の頂点は 1.25 m 間隔なので、
    // 椅子の脚のような小部品との接触は表せない → 壁・柱・大きな家具だけを相手にする（食堂 3,000 箱で 150 ms → 15 ms）
    const cr = extent + 0.5;
    const contactBlockers = (perBox ? blockersAll : blockers).filter((b) => b.min[0] < c.x + cr && b.max[0] > c.x - cr && b.min[1] < c.y + cr && b.max[1] > c.y - cr && b.min[2] < c.z + cr && b.max[2] > c.z - cr);
    // 箱ごとの器具の絞り込み（箱の中心から届く範囲だけ）。
    // 小さな箱（対角 1.2 m 未満: 段ボール・椅子・棚の段など）は遮蔽判定を頂点ごとでなく箱の中心で 1 回だけ行う
    // （箱 2000 個の倉庫で焼き込みが 0.8 s → 数十 ms。見た目の差は小箱内の遮蔽の濃淡だけ）
    const reach = Math.sqrt(this.range2) + extent;
    const nf = fx.length / FIXTURE_STRIDE;
    const list: number[] = [];
    for (let k = 0; k < nf; k++) {
      const o = k * FIXTURE_STRIDE;
      if (!own || fpos.set(fx[o + F_CX], fx[o + F_CX + 1], fx[o + F_CX + 2]).distanceToSquared(c) <= reach * reach) list.push(k);
    }
    // 滲み（器具の縁の 0.4 m 勾配）は頂点密度が足りる小さな箱だけ。大きな面（天井スラブ）は Worker のテクセルが担う
    const withHalo = !!own && extent < 1.0;
    const occlCache = perBox && this.occlusion ? list.map((k) => { const o = k * FIXTURE_STRIDE; fpos.set(fx[o + F_CX], fx[o + F_CX + 1], fx[o + F_CX + 2]); return blockers.some((b) => segmentHits(c, fpos, b)); }) : null;
    const dirCache = perBox && this.occlusion ? this.directionals.map((d) => { far.copy(c).addScaledVector(d.dir, -40); return blockers.some((b) => segmentHits(c, far, b)); }) : null;
    const amb = this.ambient, sky = this.skyAmbient;
    // 小さな箱（対角 1.2 m 未満: 椀・椅子の部品・棚の荷物）は距離依存の項（配光・減衰・遮蔽・反射光）を箱の中心で 1 回だけ評価し、
    // 頂点では法線との内積だけ掛ける（食堂 3,500 箱・器具 50 台で焼き込みを従来と同程度の時間に保つ）
    const fast = perBox;
    /** 箱の中心の方向で内積を取る（対角 0.6 m 未満）。0.6〜1.2 m は頂点ごとの方向を使う */
    const centerDir = !!own && extent < 0.6;
    const fk = fast ? new Float32Array(list.length * 5) : null; // K, dir xyz, haloPossible
    let Bc = 0;
    if (fast && fk) {
      for (let li = 0; li < list.length; li++) {
        const k = list[li];
        const o = k * FIXTURE_STRIDE;
        const dx = fx[o + F_CX] - c.x, dy = fx[o + F_CX + 1] - c.y, dz = fx[o + F_CX + 2] - c.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > this.range2) continue;
        const occluded = occlCache ? occlCache[li] : false;
        Bc += bounceWeight(fx, k, c.x, c.y, c.z) * (occluded ? T.occludedBounce : 1);
        const d = Math.sqrt(Math.max(1e-4, d2));
        const beam = fx[o + 13];
        const src = beam === 0 ? 1 : beamDistribution(beam, -(dx * fx[o + 6] + dy * fx[o + 7] + dz * fx[o + 8]) / d);
        const win = 1 - d2 / this.range2;
        fk[li * 5] = fx[o + 12] * src * win * win / (T.falloffC + d2) * (occluded ? T.occludedDirect : 1);
        fk[li * 5 + 1] = dx / d; fk[li * 5 + 2] = dy / d; fk[li * 5 + 3] = dz / d;
        // 滲みが届き得るか（発光面から天井側 haloBand + 箱の半径以内）
        const sN = -(dx * fx[o + 6] + dy * fx[o + 7] + dz * fx[o + 8]);
        fk[li * 5 + 4] = withHalo && beam !== 0 && sN < 0.03 + extent && sN > -(T.haloBand + extent) && d < T.haloCutoff + extent + 1 ? 1 : 0;
      }
    }
    for (let i = 0; i < p.count; i++) {
      norm.set(n.getX(i), n.getY(i), n.getZ(i));
      pt.set(p.getX(i), p.getY(i), p.getZ(i)).addScaledVector(norm, .035);
      let contact = 1;
      for (const b of contactBlockers) {
        const dx = Math.max(b.min[0] - pt.x, 0, pt.x - b.max[0]);
        const dy = Math.max(b.min[1] - pt.y, 0, pt.y - b.max[1]);
        const dz = Math.max(b.min[2] - pt.z, 0, pt.z - b.max[2]);
        const d = Math.hypot(dx, dy, dz);
        if (d < .45) contact = Math.min(contact, .48 + .52 * Math.min(1, d / .45));
      }
      let dr = 0, dg = 0, db = 0, B = 0;
      if (fk) {
        B = Bc;
        for (let li = 0; li < list.length; li++) {
          const K = fk[li * 5];
          if (K <= 0) continue;
          const o = list[li] * FIXTURE_STRIDE;
          let lambert: number;
          if (centerDir) lambert = fk[li * 5 + 1] * norm.x + fk[li * 5 + 2] * norm.y + fk[li * 5 + 3] * norm.z;
          else {
            const ddx = fx[o + F_CX] - pt.x, ddy = fx[o + F_CX + 1] - pt.y, ddz = fx[o + F_CX + 2] - pt.z;
            lambert = (ddx * norm.x + ddy * norm.y + ddz * norm.z) / Math.sqrt(Math.max(1e-4, ddx * ddx + ddy * ddy + ddz * ddz));
          }
          let e = K * Math.max(0, lambert);
          if (fk[li * 5 + 4]) e += fixtureHalo(fx, list[li], pt.x, pt.y, pt.z, norm.x, norm.y, norm.z);
          if (e > 0) { dr += fx[o + F_R] * e; dg += fx[o + F_R + 1] * e; db += fx[o + F_R + 2] * e; }
        }
      } else for (let li = 0; li < list.length; li++) {
        const k = list[li];
        const o = k * FIXTURE_STRIDE;
        const cx = fx[o + F_CX], cy = fx[o + F_CX + 1], cz = fx[o + F_CX + 2];
        const ddx = cx - pt.x, ddy = cy - pt.y, ddz = cz - pt.z;
        if (ddx * ddx + ddy * ddy + ddz * ddz > this.range2) continue;
        const bw = bounceWeight(fx, k, pt.x, pt.y, pt.z);
        const near = fixtureIsNear(fx, k, pt.x, pt.y, pt.z);
        const E = fixtureIrradiance(fx, k, this.samples, this.sampleOffset, pt.x, pt.y, pt.z, norm.x, norm.y, norm.z, near);
        const halo = withHalo ? fixtureHalo(fx, k, pt.x, pt.y, pt.z, norm.x, norm.y, norm.z) : 0;
        // 遮蔽判定は直接光が当たる組だけ（小箱はキャッシュ済みなので常に使う）。反射光の遮蔽は同じ結果を流用する
        let occluded = false;
        if (this.occlusion) {
          if (occlCache) occluded = occlCache[li];
          else if (E > 0) { fpos.set(cx, cy, cz); occluded = blockers.some((b) => segmentHits(pt, fpos, b)); }
        }
        B += bw * (occluded ? T.occludedBounce : 1);
        const e = E * (occluded ? T.occludedDirect : 1) + halo;
        if (e > 0) { dr += fx[o + F_R] * e; dg += fx[o + F_R + 1] * e; db += fx[o + F_R + 2] * e; }
      }
      const ambK = T.ambientScale * bounceScale(B) * hemiWeight(norm.y);
      let r = amb.r * ambK + dr, gg = amb.g * ambK + dg, bl = amb.b * ambK + db;
      if (sky) {
        const up = .5 + .5 * norm.y; // 上向きの面ほど空の色を受ける
        r += sky.r * up; gg += sky.g * up; bl += sky.b * up;
      }
      // 平行光（距離無限。遮蔽判定は 40 m 先の点まで）
      for (let k = 0; k < this.directionals.length; k++) {
        const d = this.directionals[k];
        const lambert = Math.max(0, -(d.dir.x * norm.x + d.dir.y * norm.y + d.dir.z * norm.z));
        if (lambert < .01) continue;
        let occluded = false;
        if (this.occlusion) {
          if (dirCache) occluded = dirCache[k];
          else { far.copy(pt).addScaledVector(d.dir, -40); occluded = blockers.some((b) => segmentHits(pt, far, b)); }
        }
        const irradiance = d.power * lambert * (occluded ? .08 : 1);
        r += d.color.r * irradiance; gg += d.color.g * irradiance; bl += d.color.b * irradiance;
      }
      // Soft floor/wall contact, continuous across tessellated shell segments.
      const floor = Math.max(0, pt.y - this.layout.bounds.min[1] - .2);
      if (Math.abs(norm.y) < .4) contact *= .78 + .22 * Math.min(1, floor / .35);
      out[i * 3] = r * contact; out[i * 3 + 1] = gg * contact; out[i * 3 + 2] = bl * contact;
    }
    g.setAttribute('bakedLight', new THREE.BufferAttribute(out, 3));
  }

  /** 焼き込み無しの一定値（InstancedMesh / 動く箱用）: 環境光 + 近い器具の寄与を 1 点で評価（遮蔽なし、上向き面の 0.6 倍） */
  sample(at: [number, number, number]): [number, number, number] {
    const fx = this.fixtures;
    const nf = fx.length / FIXTURE_STRIDE;
    let dr = 0, dg = 0, db = 0, B = 0;
    for (let k = 0; k < nf; k++) {
      const o = k * FIXTURE_STRIDE;
      const dx = fx[o + F_CX] - at[0], dy = fx[o + F_CX + 1] - at[1], dz = fx[o + F_CX + 2] - at[2];
      if (dx * dx + dy * dy + dz * dz > this.range2) continue;
      B += bounceWeight(fx, k, at[0], at[1], at[2]);
      const e = .6 * fixtureIrradiance(fx, k, this.samples, this.sampleOffset, at[0], at[1], at[2], 0, 1, 0, false);
      if (e > 0) { dr += fx[o + F_R] * e; dg += fx[o + F_R + 1] * e; db += fx[o + F_R + 2] * e; }
    }
    const ambK = LIGHT_TUNING.ambientScale * bounceScale(B) * .85;
    const color = this.ambient.clone().multiplyScalar(ambK);
    color.r += dr; color.g += dg; color.b += db;
    if (this.skyAmbient) color.add(this.skyAmbient.clone().multiplyScalar(.75));
    for (const d of this.directionals) { color.r += d.color.r * d.power * .5; color.g += d.color.g * d.power * .5; color.b += d.color.b * d.power * .5; }
    return [color.r, color.g, color.b];
  }

  /** Worker（テクセル焼き込み）へ渡す照明データ（面矩形以外）。配列はコピーなので転送してよい */
  payload(): Omit<BakeRequest, 'type' | 'id' | 'width' | 'height' | 'faces' | 'aoRays'> {
    const occluders = new Float32Array(this.blockers.length * 6);
    const flags = new Uint8Array(this.blockers.length);
    this.blockers.forEach((b, i) => {
      occluders[i * 6] = b.min[0]; occluders[i * 6 + 1] = b.min[1]; occluders[i * 6 + 2] = b.min[2];
      occluders[i * 6 + 3] = b.max[0]; occluders[i * 6 + 4] = b.max[1]; occluders[i * 6 + 5] = b.max[2];
      const minSide = Math.min(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]);
      flags[i] = (isOccluder(b) ? OCC_SHADOW : 0) | (minSide >= 0.02 ? OCC_AO : 0);
    });
    const directionals = new Float32Array(this.directionals.length * 7);
    this.directionals.forEach((d, i) => {
      directionals[i * 7] = d.dir.x; directionals[i * 7 + 1] = d.dir.y; directionals[i * 7 + 2] = d.dir.z;
      directionals[i * 7 + 3] = d.color.r; directionals[i * 7 + 4] = d.color.g; directionals[i * 7 + 5] = d.color.b; directionals[i * 7 + 6] = d.power;
    });
    const b = this.layout.bounds;
    return {
      fixtures: this.fixtures.slice(),
      occluders, occluderFlags: flags, directionals,
      ambient: [this.ambient.r, this.ambient.g, this.ambient.b],
      skyAmbient: this.skyAmbient ? [this.skyAmbient.r, this.skyAmbient.g, this.skyAmbient.b] : null,
      occlusion: this.occlusion,
      bounds: [b.min[0], b.min[1], b.min[2], b.max[0], b.max[1], b.max[2]],
    };
  }
}

/**
 * レイアウトの発光箔 → packed 器具。
 * - 薄い水平パネル（高さ < .3、最小辺が y）: 下向き（床から 0.6 m 未満なら上向き）の面光源。細長い（アスペクト ≥ 5）管は wide 配光、それ以外は tight
 * - 薄い垂直プレート（最小辺 < .1、高さ < .6。壁灯・非常口サイン）: 室内側に向いた wide 配光の面光源
 * - それ以外の発光箱（筐体・窓・スクリーン）は areaEmitters のときだけ中心 1 点の全方向放射
 * - ロール（E03）は全て中心 1 点の全方向放射
 * - 発光箱が無ければ layout.lights を全方向放射の点光源として使う
 */
/**
 * 見た目だけ光る発光箔か（担当 P3）。`kind === 'glowOnly'` または `kind` が `glow:` で始まる箔は器具（面光源）に数えない。
 * emissive はそのまま描かれる。M11 の扉灯 122 枚のように、器具に数えると焼き込みが重くなる装飾の発光体に付ける。
 * 器具の収集は buildFixtures だけなので、頂点焼き込み（SurfaceLighting.bake / sample）と Worker（packed 器具を受け取る）は自動的に同じ判定になる
 */
export function isGlowOnly(b: Box): boolean {
  const k = b.kind;
  return k === 'glowOnly' || (typeof k === 'string' && k.startsWith('glow:'));
}

/** 色温度（palette.lightColor）を掛ける発光材質（器具の管・パネル・LED・ナトリウム灯）。スクリーン・サイン・窓は対象外 */
export function isLightFixtureMat(mat: MatId): boolean {
  return /^light(Panel|Warm|Cool|Yellow|Green)$/.test(mat) || mat === 'ledBlue' || mat === 'sodiumLight';
}

function buildFixtures(layout: RoomLayout, roll: boolean, areaEmitters: boolean): Float32Array {
  const out: number[] = [];
  const bounds = layout.bounds;
  const center = [(bounds.min[0] + bounds.max[0]) / 2, (bounds.min[2] + bounds.max[2]) / 2];
  const push = (cx: number, cy: number, cz: number, hx: number, hy: number, hz: number, nx: number, ny: number, nz: number, color: THREE.Color, power: number, beam: number) => {
    const half = [hx, hy, hz].sort((a, b) => b - a);
    // 面積の小さい発光体（モニター・扉灯・小さな壁灯 < smallEmitterArea）は中心 1 点（fixtureIsNear も同じ閾値で false を返す）
    const small = 4 * half[0] * half[1] < LIGHT_TUNING.smallEmitterArea;
    const [nu, nv] = beam === 0 || small ? [1, 1] : fixtureSampleGrid(half[0], half[1]);
    out.push(cx, cy, cz, hx, hy, hz, nx, ny, nz, color.r, color.g, color.b, power * LIGHT_TUNING.powerScale, beam, nu, nv);
  };
  // 器具の光の色 = 材質色 × 色温度（P1 の palette.lightColor。generateLayout の先頭で決まり、Modifier が上書きする部屋もある。
  // kelvinToLightColor が白バランス済みなのでそのまま掛ける）。スクリーン・サイン・窓などの発光体は材質色のまま。
  // Worker へはこの packed 器具（色込み）がそのまま渡るので、頂点焼き込みとライトマップは同じ色になる。
  // 区画ごとに器具色を差し替える Modifier（EraPreset / ZoneThemeShuffle の recolorLights）の区画別の色は未対応（palette は部屋に 1 つ）
  const tint = new THREE.Color(layout.palette?.lightColor ?? 0xffffff);
  for (const b of layout.boxes) {
    const s = SURFACES[b.mat];
    if (!s.emission || isGlowOnly(b)) continue;
    const size = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
    const c = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
    const color = new THREE.Color(s.color);
    if (isLightFixtureMat(b.mat)) color.multiply(tint);
    const emis = (s.emission ?? 2.5) / 2.5;
    let thin = 0;
    if (size[1] <= size[0] && size[1] <= size[2]) thin = 1; else if (size[0] <= size[2]) thin = 0; else thin = 2;
    if (roll) {
      if (Math.min(...size) < .3) push(c[0], c[1], c[2], 0, 0, 0, 0, 0, 0, color, 7 * Math.min(1.6, Math.max(.35, areaOfLargestFace(b))) * emis, 0);
      else if (areaEmitters) push(c[0], c[1], c[2], 0, 0, 0, 0, 0, 0, color, 4 * Math.min(1.6, Math.max(.3, Math.sqrt(size[0] * size[1] + size[1] * size[2] + size[0] * size[2]))), 0);
      continue;
    }
    if (thin === 1 && size[1] < .3) {
      // 水平パネル: 下向き（床近くの帯は上向き）
      const sign = c[1] - bounds.min[1] > .8 ? -1 : 1;
      const area = size[0] * size[2];
      const aspect = Math.max(size[0], size[2]) / Math.max(.01, Math.min(size[0], size[2]));
      const beam = aspect >= 5 ? 1 : 2;
      const y = (sign < 0 ? b.min[1] : b.max[1]) + sign * .03;
      push(c[0], y, c[2], size[0] / 2, 0, size[2] / 2, 0, sign, 0, color, 7 * Math.min(1.6, Math.max(.35, area)) * emis, beam);
    } else if (thin !== 1 && size[thin] < .1 && size[1] < .6) {
      // 壁のプレート（壁灯・非常口サイン）: 室内側へ wide 配光
      const other = thin === 0 ? 2 : 0;
      const area = size[other] * size[1];
      let sign = 1;
      const probe = (sg: number) => { const q = [c[0], c[2]]; q[thin === 0 ? 0 : 1] += sg * .3; return inFootprint(layout.footprint, q[0], q[1]); };
      if (probe(1) && !probe(-1)) sign = 1;
      else if (probe(-1) && !probe(1)) sign = -1;
      else sign = (thin === 0 ? center[0] - c[0] : center[1] - c[2]) >= 0 ? 1 : -1;
      const pos = [c[0], c[1], c[2]];
      pos[thin] = (sign > 0 ? b.max[thin] : b.min[thin]) + sign * .03;
      const n = [0, 0, 0]; n[thin] = sign;
      const h = [size[0] / 2, size[1] / 2, size[2] / 2]; h[thin] = 0;
      push(pos[0], pos[1], pos[2], h[0], h[1], h[2], n[0], n[1], n[2], color, 7 * Math.min(1.6, Math.max(.06, area)) * emis, 1);
    } else if (areaEmitters) {
      push(c[0], c[1], c[2], 0, 0, 0, 0, 0, 0, color, 4 * Math.min(1.6, Math.max(.3, Math.sqrt(size[0] * size[1] + size[1] * size[2] + size[0] * size[2]))), 0);
    }
  }
  if (!out.length) {
    for (const l of layout.lights) {
      const color = new THREE.Color(l.color);
      push(l.pos[0], l.pos[1], l.pos[2], 0, 0, 0, 0, 0, 0, color, l.intensity * 7, 0);
    }
  }
  return new Float32Array(out);
}

function areaOfLargestFace(b: Box): number {
  const s = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
  return Math.max(s[0] * s[1], s[1] * s[2], s[0] * s[2]);
}

function segmentHits(a: THREE.Vector3, end: THREE.Vector3, b: Box): boolean {
  let lo = .015, hi = .985;
  const origin = [a.x, a.y, a.z], target = [end.x, end.y, end.z];
  for (let k = 0; k < 3; k++) {
    const d = target[k] - origin[k];
    if (Math.abs(d) < 1e-7) { if (origin[k] < b.min[k] || origin[k] > b.max[k]) return false; }
    else {
      const t0 = (b.min[k] - origin[k]) / d, t1 = (b.max[k] - origin[k]) / d;
      lo = Math.max(lo, Math.min(t0, t1)); hi = Math.min(hi, Math.max(t0, t1));
      if (hi <= lo) return false;
    }
  }
  return true;
}
