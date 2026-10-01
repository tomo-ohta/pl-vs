/**
 * InvertedShadow — 逆影広間（E06）。params: mode（'towardLight' のみ。既定）。
 *
 * 影が光源側へ落ちる。動的影は使わず、ブロブ影デカール（'shadowDecal' の薄い箔）を「光源へ向かう方向」へずらして置く。
 *  - layout（決定論）:
 *      天井灯グリッドを消灯パネル（lightOff）にし、進行用出口の反対側寄り・中央上に 1 灯だけ置く
 *      （PointLight 高強度 palette.lightIntensity × 1.6 × 部屋の大きさ補正 + 大きな発光パネル）。逆影はすべて出口の逆を指す。
 *      内装（柱・家具・間仕切り。shellCount 以降のソリッド箱）の足元に、光源側へ箱の高さ × 0.6 だけ伸びる黒い箔を
 *      L.boxes に直接入れる（Tier の decals に依らず全 Tier で出す。RoomBuilder が材質ごとに 1 mesh へ結合する）。
 *      L.lighting.occlusion = false で SurfaceLighting の焼き込み影（正しい向き）を作らない。ambient を少し落として単一光を際立たせる。
 *  - build: プレイヤーの足元のブロブ（CircleGeometry + shadowDecal 共有材質）を RoomEffect が毎フレーム光源側へずらして置く。
 */
import * as THREE from 'three';
import type { Vec3 } from '../../core/types';
import { toLocal } from '../../core/types';
import { inFootprint, inner, rectArea, type Rect } from '../../generators/footprint';
import { box, lightPanel, type Box, type LightingOverrides } from '../../generators/layout';
import { SURFACES } from '../../render/MaterialLibrary';
import type { RoomEffect } from '../../render/RoomBuilder';
import type { ModifierImpl } from '../types';
import { progressAxis } from '../util';

/** 影の伸び = 箱の高さ × SHADOW_K */
const SHADOW_K = 0.6;
const DECAL_Y0 = 0.003;
const DECAL_T = 0.004;
/** 天井の消灯扱いにする薄い発光パネル */
const PANEL_RE = /^(lightPanel|lightWarm|lightGreen|lightYellow)$/;

/** 光源の床位置（x, z）: 部屋の中心から進行用出口の反対側へ 25% ずらし、footprint の内側に収める */
function lightFloorPos(rects: Rect[], bounds: { min: Vec3; max: Vec3 }, axis: { from: Vec3; to: Vec3 } | null): [number, number] {
  const cx = (bounds.min[0] + bounds.max[0]) / 2;
  const cz = (bounds.min[2] + bounds.max[2]) / 2;
  let px = cx;
  let pz = cz;
  if (axis) {
    const dx = axis.to[0] - axis.from[0];
    const dz = axis.to[2] - axis.from[2];
    const len = Math.hypot(dx, dz);
    if (len > 0.5) {
      const ux = dx / len;
      const uz = dz / len;
      const extent = Math.abs(ux) * (bounds.max[0] - bounds.min[0]) + Math.abs(uz) * (bounds.max[2] - bounds.min[2]);
      px = cx - ux * extent * 0.25;
      pz = cz - uz * extent * 0.25;
    }
  }
  if (inFootprint(rects, px, pz, 1.5)) return [px, pz];
  if (inFootprint(rects, cx, cz, 1.5)) return [cx, cz];
  // L 字などで中心が外に出るときは最大矩形の中心
  const big = rects.reduce((a, r) => (rectArea(r) > rectArea(a) ? r : a), rects[0]);
  return [(big.x0 + big.x1) / 2, (big.z0 + big.z1) / 2];
}

/** 箱の足元に置く逆影（光源側へ伸びる軸並行の箔） */
function shadowBox(b: Box, lx: number, lz: number, clip: Rect): Box | null {
  const cx = (b.min[0] + b.max[0]) / 2;
  const cz = (b.min[2] + b.max[2]) / 2;
  const bh = b.max[1] - b.min[1];
  const dx = lx - cx;
  const dz = lz - cz;
  const dist = Math.hypot(dx, dz);
  let sx = 0;
  let sz = 0;
  if (dist > 0.3) {
    const shift = Math.max(0, Math.min(bh * SHADOW_K, dist - 0.4));
    sx = (dx / dist) * shift;
    sz = (dz / dist) * shift;
  }
  const pad = 0.12;
  const x0 = Math.max(clip.x0, b.min[0] - pad + Math.min(0, sx));
  const x1 = Math.min(clip.x1, b.max[0] + pad + Math.max(0, sx));
  const z0 = Math.max(clip.z0, b.min[2] - pad + Math.min(0, sz));
  const z1 = Math.min(clip.z1, b.max[2] + pad + Math.max(0, sz));
  if (x1 - x0 < 0.05 || z1 - z0 < 0.05) return null;
  return box([x0, b.min[1] + DECAL_Y0, z0], [x1, b.min[1] + DECAL_Y0 + DECAL_T, z1], 'shadowDecal', false);
}

const InvertedShadow: ModifierImpl = {
  id: 'InvertedShadow',
  defaults: { mode: 'towardLight' },

  layout(L, _p, _params, _rng) {
    if (L.footprint.length === 0 || L.shellCount === undefined) return;
    const h = L.height;
    const pal = L.palette;

    // 1) 単一光源: 進行用出口の反対側寄り
    const [lx, lz] = lightFloorPos(L.footprint, L.bounds, progressAxis(L));
    const bw = L.bounds.max[0] - L.bounds.min[0];
    const bd = L.bounds.max[2] - L.bounds.min[2];
    const diag = Math.hypot(bw, bd);
    const boost = Math.max(1, Math.min(4, diag / 10));
    L.lights = [{ pos: [lx, h - 0.35, lz], color: pal.lightColor, intensity: pal.lightIntensity * 1.6 * boost, distance: diag * 1.5 }];

    // 2) 天井灯グリッドを消灯パネルにする（発光体は中央の大パネル 1 枚だけ → 焼き込みも単一光になる）。大パネルと重なる既存パネルは捨てる
    const shellBoxes = L.boxes.slice(0, L.shellCount);
    const interior: Box[] = [];
    for (const b of L.boxes.slice(L.shellCount)) {
      const thinPanel = !b.solid && b.max[1] - b.min[1] < 0.12 && b.min[1] > h - 0.3 && /^light/.test(b.mat);
      if (!thinPanel) { interior.push(b); continue; }
      if (b.max[0] > lx - 0.9 && b.min[0] < lx + 0.9 && b.max[2] > lz - 0.9 && b.min[2] < lz + 0.9) continue;
      interior.push(PANEL_RE.test(b.mat) ? { ...b, mat: 'lightOff' } : b);
    }
    L.boxes = [...shellBoxes, ...interior];
    lightPanel(L.boxes, lx, lz, 1.6, 1.6, h, pal.light);

    // 3) 逆影デカール（柱・家具・間仕切り。壁・扉は shellCount 以前なので対象外）
    const clip: Rect = L.footprint.length === 1 ? inner(L.footprint[0]) : { x0: L.bounds.min[0], z0: L.bounds.min[2], x1: L.bounds.max[0], z1: L.bounds.max[2] };
    const decals: Box[] = [];
    for (const b of L.boxes.slice(L.shellCount)) {
      if (!b.solid || b.min[1] > 0.1 || b.max[1] - b.min[1] < 0.3) continue;
      if (b.mat === 'glass' || SURFACES[b.mat].decal || SURFACES[b.mat].emission) continue;
      const d = shadowBox(b, lx, lz, clip);
      if (d) decals.push(d);
    }
    L.boxes.push(...decals);

    // 4) 焼き込みの遮蔽判定オフ（正しい向きの影を作らない）。ambient を落として単一光を際立たせる
    const lighting: LightingOverrides = { ...(L.lighting ?? {}), occlusion: false };
    L.lighting = lighting;
    const amb = new THREE.Color(pal.ambient).multiplyScalar(0.7);
    L.palette = { ...pal, ambient: amb.getHex() };
  },

  build(built, L, ctx) {
    const light = L.lights[0];
    const placement = ctx.node.placement;
    if (!light || !placement) return;
    // 足元のブロブ（半径 0.5 の円。x 方向に伸ばして光源へ向ける）
    const geo = new THREE.CircleGeometry(0.5, 20);
    geo.rotateX(-Math.PI / 2);
    geo.setAttribute('bakedLight', new THREE.Float32BufferAttribute(new Float32Array(geo.getAttribute('position').count * 3), 3));
    const mesh = new THREE.Mesh(geo, ctx.materials.get('shadowDecal'));
    mesh.name = 'InvertedShadow/playerBlob';
    mesh.visible = false;
    mesh.frustumCulled = false;
    built.group.add(mesh);
    const lx = light.pos[0];
    const lz = light.pos[2];
    const rects = L.footprint;

    const effect: RoomEffect = {
      update(_dt, rc) {
        const lp = toLocal(placement, rc.player.pos);
        if (!inFootprint(rects, lp[0], lp[2], 0.1) || lp[1] < -0.5 || lp[1] > L.height - 1.0) {
          mesh.visible = false;
          return;
        }
        const dx = lx - lp[0];
        const dz = lz - lp[2];
        const dist = Math.hypot(dx, dz);
        const ux = dist > 0.2 ? dx / dist : 0;
        const uz = dist > 0.2 ? dz / dist : 0;
        const height = rc.player.crouching ? 0.85 : 1.7;
        const shift = Math.max(0, Math.min(height * SHADOW_K, dist - 0.3));
        // 足元から光源側へ shift だけ伸びる楕円（中心は半分の位置）
        mesh.position.set(lp[0] + ux * shift * 0.5, lp[1] + DECAL_Y0 + 0.002, lp[2] + uz * shift * 0.5);
        mesh.rotation.set(0, Math.atan2(-uz, ux), 0);
        mesh.scale.set(0.8 + shift, 1, 0.7);
        mesh.visible = true;
      },
      dispose() { /* mesh は RoomBuilder.dispose の traverse で解放。材質は共有（dispose しない） */ },
    };
    built.effects.push(effect);
  },
};

export default InvertedShadow;
