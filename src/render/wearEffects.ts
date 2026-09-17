/**
 * 全部屋共通の低確率の破れ・ランタイム側（担当 W）。RoomBuilder.build の末尾で呼ばれ、レイアウト側（src/generators/wear.ts）が
 * 決定論で決めた `layout.wear` を Three.js に反映する。
 *
 *   flicker   切れかけの蛍光灯: 対象の発光箔（lightYellow・kind 'wear.flicker'。部屋で唯一の lightYellow なので材質別の結合メッシュが
 *             その箔だけになる）を built.group から探し、材質を部屋専用に複製して emissiveIntensity を揺らす。対応する PointLight は
 *             userData.baseIntensity（LightBudget が毎フレーム intensity をこれへ寄せる）を揺らし、暗くなる方向だけ intensity を即時に
 *             下げる（上げる方向は予算の補間に任せる = 予算のフェードアウトを妨げない）。数秒おきの短い減光・瞬断、ときどき連続の
 *             チラつき、稀に 0.3〜1.2 秒の消灯。位相は Math.random（決定論の対象外）。Tier の flicker=false（Low）では何もしない。
 *   signTilt  案内板の Mesh を面の法線まわりに 2〜4° 回す（一度だけ。RoomEffect は作らない）。
 *   その他（lightOff / ceilingMissing / ceilingStain）はレイアウト側の箔だけで完結する。
 */
import * as THREE from 'three';
import type { QualityTier, RoomDefinition, RoomInstance } from '../core/types';
import type { RoomLayout } from '../generators/layout';
import { wearOf, type WearPlan } from '../generators/wear';
import type { MaterialLibrary } from './MaterialLibrary';
import type { BuiltRoom, RoomEffect } from './RoomBuilder';

export interface WearEffectContext {
  node: RoomInstance;
  definition: RoomDefinition | null;
  tier: QualityTier;
  materials: MaterialLibrary;
}

export function applyWearEffects(built: BuiltRoom, layout: RoomLayout, ctx: WearEffectContext): void {
  const wear = wearOf(layout);
  if (!wear) return;
  try {
    if (wear.kind === 'signTilt') applySignTilt(built, layout, wear);
    else if (wear.kind === 'ceilingMissing') blackenHole(built, wear);
    else if (wear.kind === 'flicker' && ctx.tier.flicker) {
      const fx = buildFlicker(built, layout, wear);
      if (fx) built.effects.push(fx);
    }
  } catch (err) {
    console.warn(`[wear] ${built.roomId} ${wear.kind} failed`, err);
  }
}

// ---------------------------------------------------------------- signTilt

function applySignTilt(built: BuiltRoom, layout: RoomLayout, wear: WearPlan): void {
  const idx = wear.signIndex ?? -1;
  const spec = layout.signs?.[idx];
  if (!spec) return;
  // RoomBuilder はアトラス上限（48 枚）を超えたサインを作らないので、spec の同一性で探す
  const sign = built.signs.find((s) => s.spec === spec) ?? built.signs[idx];
  if (!sign || sign.spec.width !== spec.width) return;
  sign.mesh.rotateZ(THREE.MathUtils.degToRad(wear.tiltDeg ?? 3));
}

// ---------------------------------------------------------------- ceilingMissing

/**
 * 欠けた天井板の穴（'void' 箔）を真っ黒にする。MeshStandardMaterial の非金属は F0 = 4% の鏡面反射が固定で、隣のトロファーの
 * PointLight（0.5〜1 m）を受けると黒い箔でも灰色に浮く。金属 1.0 + 黒（鏡面色 = 拡散色 = 黒）+ envMap 0 にした部屋専用の複製に差し替える
 * （部屋の 'void' 結合メッシュのうち、穴の箔を含むものだけ）
 */
function blackenHole(built: BuiltRoom, wear: WearPlan): void {
  const [px, , pz] = wear.pos;
  built.group.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o instanceof THREE.InstancedMesh) return;
    const mat = o.material;
    if (!(mat instanceof THREE.MeshStandardMaterial) || !/^void(\||$)/.test(mat.name)) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    if (!bb || bb.min.x > px + 0.4 || bb.max.x < px - 0.4 || bb.min.z > pz + 0.4 || bb.max.z < pz - 0.4) return;
    const own = cloneMaterial(mat);
    own.color.setHex(0x000000);
    own.metalness = 1;
    own.roughness = 1;
    own.envMapIntensity = 0;
    o.material = own;
    const d = (o.userData.disposable as (THREE.Texture | THREE.Material)[] | undefined) ?? [];
    d.push(own);
    o.userData.disposable = d;
  });
}

// ---------------------------------------------------------------- flicker

/** 部屋専用の材質複製（共有材質・variant を汚さない）。onBeforeCompile / customProgramCacheKey は clone() が写さないので付け直す */
function cloneMaterial(src: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  const m = src.clone();
  m.onBeforeCompile = src.onBeforeCompile;
  m.customProgramCacheKey = src.customProgramCacheKey;
  return m;
}

/** 対象箔だけを含む結合メッシュを探す（ジオメトリの AABB が箔 + 6 cm に収まる発光材質の Mesh） */
function findPanelMesh(built: BuiltRoom, layout: RoomLayout, wear: WearPlan): THREE.Mesh | null {
  const b = layout.boxes[wear.boxIndex ?? -1];
  if (!b || b.kind !== 'wear.flicker') return null;
  const target = new THREE.Box3(new THREE.Vector3(...b.min).addScalar(-0.06), new THREE.Vector3(...b.max).addScalar(0.06));
  let found: THREE.Mesh | null = null;
  built.group.traverse((o) => {
    if (found || !(o instanceof THREE.Mesh) || o instanceof THREE.InstancedMesh) return;
    const mat = o.material;
    if (!(mat instanceof THREE.MeshStandardMaterial) || mat.emissiveIntensity <= 0) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    if (bb && !bb.isEmpty() && target.containsBox(bb)) found = o;
  });
  return found;
}

/** 切れかけの蛍光灯の明るさ係数（0.03〜1.15）。steady → burst（連続チラつき）/ dropout（消灯）→ steady */
class FlickerDriver {
  private t = 0;
  private mode: 'steady' | 'burst' | 'dropout' = 'steady';
  private left = rand(1.0, 3.0);
  private blinks = 0;
  private on = true;
  private level = 0.92;
  private hum = rand(17, 29);

  update(dt: number): number {
    dt = Math.min(dt, 0.1);
    this.t += dt;
    this.left -= dt;
    switch (this.mode) {
      case 'steady': {
        // 少し暗い定常（古い管）に細かなうねり
        this.level = 0.9 + 0.035 * Math.sin(this.t * this.hum) + 0.02 * Math.sin(this.t * 3.1);
        if (this.left <= 0) {
          const r = Math.random();
          if (r < 0.55) this.startBurst(2 + Math.floor(Math.random() * 6));
          else if (r < 0.8) { this.mode = 'dropout'; this.left = rand(0.25, 1.2); this.level = rand(0.03, 0.08); }
          else this.startBurst(1);
        }
        break;
      }
      case 'burst': {
        if (this.left <= 0) {
          if (this.on) {
            // 点 → 消
            this.on = false;
            this.level = rand(0.05, 0.3);
            this.left = rand(0.03, 0.12);
          } else {
            // 消 → 点（再点灯の瞬間は少し明るい）
            this.on = true;
            this.blinks--;
            this.level = rand(1.0, 1.15);
            this.left = rand(0.04, 0.16);
            if (this.blinks <= 0) { this.mode = 'steady'; this.left = rand(1.5, 6.0); }
          }
        }
        break;
      }
      case 'dropout': {
        this.level = rand(0.03, 0.08);
        if (this.left <= 0) {
          if (Math.random() < 0.6) this.startBurst(2 + Math.floor(Math.random() * 3));
          else { this.mode = 'steady'; this.left = rand(2.0, 6.0); }
        }
        break;
      }
    }
    return this.level;
  }

  private startBurst(n: number): void {
    this.mode = 'burst';
    this.blinks = n;
    this.on = true;
    this.left = 0;
  }
}

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

function buildFlicker(built: BuiltRoom, layout: RoomLayout, wear: WearPlan): RoomEffect | null {
  const mesh = findPanelMesh(built, layout, wear);
  let panel: { m: THREE.MeshStandardMaterial; base: number } | null = null;
  if (mesh) {
    const own = cloneMaterial(mesh.material as THREE.MeshStandardMaterial);
    mesh.material = own;
    const d = (mesh.userData.disposable as (THREE.Texture | THREE.Material)[] | undefined) ?? [];
    d.push(own);
    mesh.userData.disposable = d;
    panel = { m: own, base: own.emissiveIntensity };
  }
  // 点光源: レイアウトの lights と built.lights は同じ順序。位置でも確認する
  let light: THREE.PointLight | null = null;
  const li = wear.lightIndex ?? -1;
  const spec = layout.lights[li];
  const cand = built.lights[li];
  if (spec && cand instanceof THREE.PointLight && !layout.roll) {
    const dx = cand.position.x - spec.pos[0], dz = cand.position.z - spec.pos[2];
    if (Math.hypot(dx, dz) < 0.05) light = cand;
  }
  if (!panel && !light) return null;
  const lightBase = light ? Number(light.userData.baseIntensity ?? light.intensity) : 0;
  if (light) light.userData.wearBase = lightBase;
  const driver = new FlickerDriver();
  const lightScale = wear.shared ? 0.5 : 1;
  return {
    update(dt) {
      const k = driver.update(dt);
      if (panel) panel.m.emissiveIntensity = panel.base * k;
      if (light) {
        const target = lightBase * (1 - lightScale + lightScale * k);
        light.userData.baseIntensity = target;
        // 暗くなる方向だけ即時に反映（LightBudget のフェードアウトを止めない）。明るくなる方向は予算の補間（約 0.13 s）に任せる
        if (light.visible && light.intensity > target) light.intensity = target;
      }
    },
    dispose() {
      if (light) light.userData.baseIntensity = lightBase;
      if (panel) panel.m.emissiveIntensity = panel.base;
    },
  };
}
