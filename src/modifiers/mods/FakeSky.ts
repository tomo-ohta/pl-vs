/**
 * FakeSky — 偽の空の天井（U20 overcastNoon / R04 dusk / E04 noonSun）。
 * params: skyPreset（'overcastNoon' | 'dusk' | 'noonSun'。表記ゆれは正規表現で吸収）, lightColor（省略時は preset から派生）,
 *         beams（既定 true。梁・桁を残す）, sunToExit（既定は E04 のみ true。太陽の方位を進行用出口の方向に固定）。
 *
 * layout フック（決定論）:
 *   - シェルの天井箔（buildShell が置いた h..h+0.2 の箔）を sky* MatId の発光面に差し替える（コライダはそのまま）。
 *   - 天井を全面の空にせず、周囲の桁（ring）と短辺方向の梁を天井の直下に残して「屋内なのに空」の違和感を出す。
 *   - 天井付近のパネル灯を取り除き、動的光は中央上 1 灯だけにする（隣室へ漏れる DirectionalLight は使わない）。
 *   - L.lighting.directional（日射。dir は光の進む向き）と skyAmbient を設定し、SurfaceLighting の焼き込み（静的な影・空色）に反映する。
 *   - L.render.sky と palette.ambient / lightColor を空の色に合わせる（Game.applyEnvironment が半球光に使う）。
 * build フック: Mid 以上の Tier で空の材質を部屋専用に複製し、雲（テクスチャ）の UV を毎秒 0.002 だけ流す（ジオメトリは触らない）。
 */
import * as THREE from 'three';
import type { Vec3 } from '../../core/types';
import { dirVec } from '../../core/types';
import { box, type Box, type MatId, type RoomLayout } from '../../generators/layout';
import type { Rect } from '../../generators/footprint';
import type { Rng } from '../../core/rng';
import type { ModifierImpl } from '../types';
import type { RoomEffect } from '../../render/RoomBuilder';
import { bool, parseColor, str } from '../util';

type Preset = 'overcast' | 'dusk' | 'noon';

interface PresetSpec {
  mat: MatId;
  lightColor: number;
  ambient: number;
  /** 日射の高度（deg）・色・強さ */
  sunAlt: number;
  sunColor: number;
  sunIntensity: number;
  skyAmbient: { color: number; intensity: number };
  /** 中央 1 灯の強さ */
  pointIntensity: number;
}

const PRESETS: Record<Preset, PresetSpec> = {
  overcast: { mat: 'skyOvercast', lightColor: 0xdfe6ee, ambient: 0x9aa2ac, sunAlt: 62, sunColor: 0xdfe6ee, sunIntensity: 0.28, skyAmbient: { color: 0xc4ccd6, intensity: 0.55 }, pointIntensity: 1.0 },
  dusk: { mat: 'skyDusk', lightColor: 0xf0a870, ambient: 0x7a5c50, sunAlt: 18, sunColor: 0xffa060, sunIntensity: 0.7, skyAmbient: { color: 0x6a5a78, intensity: 0.35 }, pointIntensity: 0.9 },
  noon: { mat: 'skyNoon', lightColor: 0xfff4dc, ambient: 0x9db4d2, sunAlt: 55, sunColor: 0xfff4dc, sunIntensity: 1.0, skyAmbient: { color: 0x9fc0e8, intensity: 0.45 }, pointIntensity: 1.3 },
};

const SKY_MATS: ReadonlySet<string> = new Set(['skyOvercast', 'skyDusk', 'skyNoon']);
const PANEL_MATS: ReadonlySet<string> = new Set(['lightPanel', 'lightWarm', 'lightOff', 'lightGreen', 'lightYellow', 'ledBlue']);

function presetOf(v: unknown): Preset {
  const s = str(v, 'overcastNoon');
  if (/dusk|sunset|evening|夕/i.test(s)) return 'dusk';
  if (/noon.*sun|sun|clear|blue|昼|晴/i.test(s)) return 'noon';
  return 'overcast';
}

/** 天井付近の薄いパネル灯（取り除く対象） */
function isCeilingPanel(b: Box, h: number): boolean {
  return !b.solid && PANEL_MATS.has(b.mat) && b.max[1] - b.min[1] < 0.12 && b.max[1] > h - 0.3;
}

/** 太陽の方位（xz 単位ベクトル。太陽のある側） */
function sunAzimuth(L: RoomLayout, rng: Rng, toExit: boolean): [number, number] {
  if (toExit) {
    const exit = L.sockets.find((s) => s.id !== 'entry' && s.type !== 'hole');
    if (exit) {
      const v = dirVec(exit.dir);
      return [v[0], v[2]];
    }
  }
  const a = rng.float(0, Math.PI * 2);
  return [Math.cos(a), Math.sin(a)];
}

/** 桁（周囲）と梁（短辺方向）。天井の直下、非ソリッド。天井穴（hole 入口）の上は避ける */
function addBeams(L: RoomLayout, rects: Rect[], holes: Vec3[], mat: MatId): void {
  const h = L.height;
  const yTop = h;
  const ringD = 0.32;
  const ringH = 0.4;
  const beamW = 0.28;
  const beamH = 0.42;
  for (const r of rects) {
    const w = r.x1 - r.x0;
    const d = r.z1 - r.z0;
    if (w < 3 || d < 3) continue;
    // 周囲の桁（壁の内側）
    L.boxes.push(box([r.x0, yTop - ringH, r.z0], [r.x1, yTop, r.z0 + ringD], mat, false));
    L.boxes.push(box([r.x0, yTop - ringH, r.z1 - ringD], [r.x1, yTop, r.z1], mat, false));
    L.boxes.push(box([r.x0, yTop - ringH, r.z0 + ringD], [r.x0 + ringD, yTop, r.z1 - ringD], mat, false));
    L.boxes.push(box([r.x1 - ringD, yTop - ringH, r.z0 + ringD], [r.x1, yTop, r.z1 - ringD], mat, false));
    // 短辺方向の梁（4.2 m 前後の等間隔）
    const alongX = w < d; // 梁は短い辺に沿って渡す
    const len = alongX ? d : w;
    const n = Math.max(1, Math.round(len / 4.2));
    for (let i = 1; i < n; i++) {
      const t = (alongX ? r.z0 : r.x0) + (len * i) / n;
      const blocked = holes.some((hp) => Math.abs((alongX ? hp[2] : hp[0]) - t) < 1.2);
      if (blocked) continue;
      if (alongX) L.boxes.push(box([r.x0 + ringD, yTop - beamH, t - beamW / 2], [r.x1 - ringD, yTop, t + beamW / 2], mat, false));
      else L.boxes.push(box([t - beamW / 2, yTop - beamH, r.z0 + ringD], [t + beamW / 2, yTop, r.z1 - ringD], mat, false));
    }
    // 大きな天井には長辺方向の中央の大梁も渡す
    if (Math.min(w, d) > 12) {
      const t = alongX ? (r.x0 + r.x1) / 2 : (r.z0 + r.z1) / 2;
      const blocked = holes.some((hp) => Math.abs((alongX ? hp[0] : hp[2]) - t) < 1.2);
      if (!blocked) {
        if (alongX) L.boxes.push(box([t - 0.25, yTop - 0.55, r.z0 + ringD], [t + 0.25, yTop, r.z1 - ringD], mat, false));
        else L.boxes.push(box([r.x0 + ringD, yTop - 0.55, t - 0.25], [r.x1 - ringD, yTop, t + 0.25], mat, false));
      }
    }
  }
}

function applyLayout(L: RoomLayout, def: { id: string }, params: Record<string, unknown>, rng: Rng): void {
  const preset = presetOf(params.skyPreset);
  const spec = PRESETS[preset];
  const lightColor = parseColor(params.lightColor, spec.lightColor);
  const h = L.height;
  const shellCount = L.shellCount ?? L.boxes.length;

  // 1) シェルの天井箔 → 空
  let replaced = 0;
  for (let i = 0; i < shellCount; i++) {
    const b = L.boxes[i];
    if (b.min[1] >= h - 0.01 && b.max[1] <= h + 0.3 && b.mat === L.palette.ceiling) {
      // ソリッドのまま材質だけ空へ（SurfaceGeometry が sky* を日射の遮蔽体から除外するので、天井コライダを落とさなくてよい。Phase 2 統合）
      L.boxes[i] = { ...b, mat: spec.mat };
      replaced++;
    }
  }
  if (replaced === 0) {
    // 天井の無いシェル（Bridge など）: footprint の上に空の箔を浮かせる（非ソリッド）
    for (const r of L.footprint) L.boxes.push(box([r.x0, h, r.z0], [r.x1, h + 0.2, r.z1], spec.mat, false));
  }

  // 2) 天井付近のパネル灯を取り除く（内装のみ。shellCount は変わらない）
  const start = L.shellCount ?? 0;
  const kept = L.boxes.slice(0, start);
  for (const b of L.boxes.slice(start)) if (!isCeilingPanel(b, h)) kept.push(b);
  L.boxes = kept;

  // 3) 桁・梁（屋内であることを主張する構造）
  if (bool(params.beams, true)) {
    const holes: Vec3[] = L.sockets.filter((s) => s.type === 'hole' && s.pos[1] > h - 0.5).map((s) => s.pos);
    const beamMat: MatId = preset === 'dusk' ? 'wallDark' : 'columnConcrete';
    addBeams(L, L.footprint, holes, beamMat);
  }

  // 4) 動的光: 中央上 1 灯
  const bx = L.bounds;
  const cx = (bx.min[0] + bx.max[0]) / 2;
  const cz = (bx.min[2] + bx.max[2]) / 2;
  const span = Math.max(bx.max[0] - bx.min[0], bx.max[2] - bx.min[2]);
  L.lights = [{ pos: [cx, h - 0.8, cz], color: lightColor, intensity: spec.pointIntensity, distance: Math.max(12, span) }];

  // 5) 日射と空の環境光（焼き込み）
  const toExit = bool(params.sunToExit, def.id === 'E04');
  const [ax, az] = sunAzimuth(L, rng, toExit);
  const alt = (spec.sunAlt * Math.PI) / 180;
  const dir: Vec3 = [-ax * Math.cos(alt), -Math.sin(alt), -az * Math.cos(alt)];
  L.lighting = {
    ...(L.lighting ?? {}),
    directional: [{ dir, color: spec.sunColor, intensity: spec.sunIntensity }],
    skyAmbient: { ...spec.skyAmbient },
  };

  // 6) 環境色
  L.render = { ...(L.render ?? {}), sky: { preset, lightColor } };
  L.palette.lightColor = lightColor;
  L.palette.ambient = spec.ambient;
}

// ---------------------------------------------------------------- build（雲の流れ）

function cloneMaterial(src: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  const m = src.clone();
  m.onBeforeCompile = src.onBeforeCompile;
  m.customProgramCacheKey = src.customProgramCacheKey;
  return m;
}

function matIdOf(m: THREE.Material): string {
  return (m.name || '').split('|')[0];
}

function buildDrift(built: import('../../render/RoomBuilder').BuiltRoom, rng: Rng): RoomEffect | null {
  const textures: THREE.Texture[] = [];
  built.group.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o instanceof THREE.InstancedMesh) return;
    const mat = o.material;
    if (!(mat instanceof THREE.MeshStandardMaterial) || !SKY_MATS.has(matIdOf(mat)) || !mat.map) return;
    const own = cloneMaterial(mat);
    // テクスチャは Source を共有した複製（GPU 転送は共有。offset だけ部屋専用）
    const tex = mat.map.clone(); // copy() が needsUpdate を立てる
    own.map = tex;
    if (own.emissiveMap) own.emissiveMap = tex;
    o.material = own;
    const d = (o.userData.disposable as (THREE.Texture | THREE.Material)[] | undefined) ?? [];
    d.push(own, tex);
    o.userData.disposable = d;
    textures.push(tex);
  });
  if (!textures.length) return null;
  const a = rng.float(0, Math.PI * 2);
  const vx = Math.cos(a) * 0.002;
  const vy = Math.sin(a) * 0.002;
  return {
    update(dt) {
      for (const t of textures) { t.offset.x += vx * dt; t.offset.y += vy * dt; }
    },
    dispose() { textures.length = 0; },
  };
}

const FakeSky: ModifierImpl = {
  id: 'FakeSky',
  defaults: { skyPreset: 'overcastNoon', beams: true },
  layout(L, p, params, rng) {
    applyLayout(L, p.def, params, rng);
  },
  build(built, _L, ctx) {
    if (ctx.tier.rtUpdateHz <= 0) return; // Low は静止
    const fx = buildDrift(built, ctx.rng);
    if (fx) built.effects.push(fx);
  },
};

export default FakeSky;
