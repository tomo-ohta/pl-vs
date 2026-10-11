import * as THREE from 'three';
import type { FloorPlan, PlanTourStop } from '../arch/plan.ts';
import { ARCH_SCENES } from '../arch/index.ts';
import { Builder, type V3 } from '../scenes/Builder.ts';
import type { SceneEntry } from '../scenes/index.ts';
import type { SceneContext, SceneDef } from '../scenes/types.ts';
import { builderSink, Prop, styleMats, type PropEntry, type PropMats } from './kit.ts';
import { COMMON_PROPS } from './lib/index.ts';

/**
 * 小物の見本帳（props.html）。小物を 1 列に並べ、物ごとに「近く（1.5 m 前後・斜め前）」「4 m（正面寄り）」から撮る。
 * - common: どの場所でも使う小物（src/props/lib）。病院の廊下の見た目で
 * - 場所ごと: src/arch/<場所>/props/gallery.ts が { mats, entries, style? } を出す（その場所の材質・見た目で、その場所で使う物）
 * 撮る: node tools/capture.mjs --page props.html --tour <見本帳の id>（-tour.jpg に物ごとの 2 枚が並ぶ）
 */

export interface GallerySpec {
  label: string;
  /** 見た目（霧・段・線・後処理）をこの建築版の場面から借りる */
  styleFrom: string;
  /** この場所の材質の作り方（省略時は色彩設計の材質） */
  mats?: (ctx: SceneContext) => PropMats;
  entries: PropEntry[];
  /** 床・壁の色 */
  floor?: string;
  wall?: string;
  /** 物を作る前の準備（場所の照明・空気の uniform を入れる など。見本帳には場所の照明が無いので） */
  setup?: (ctx: SceneContext) => void;
}

const LOCATION_GALLERIES = import.meta.glob<{ gallery: () => GallerySpec }>('../arch/*/props/gallery.ts');

export const GALLERY_SCENES: SceneEntry[] = [
  { id: 'common', label: '共通の小物', load: async () => galleryScene('common', { label: '共通の小物', styleFrom: 'corridor', entries: COMMON_PROPS }) },
  ...Object.keys(LOCATION_GALLERIES).map((path) => {
    const id = path.split('/')[2];
    return {
      id,
      label: `${id} の小物`,
      load: async () => galleryScene(id, (await LOCATION_GALLERIES[path]()).gallery()),
    } satisfies SceneEntry;
  }),
];

async function galleryScene(id: string, spec: GallerySpec): Promise<SceneDef> {
  const from = ARCH_SCENES.find((s) => s.id === spec.styleFrom) ?? ARCH_SCENES[0];
  const base = await from.load();
  // 霧は見本帳では弱く（物の形を見る）
  const style = structuredClone(base.style);
  style.fog.density *= 0.15;
  style.shadowQuant = 0;
  // 並べ方: x の向きに 1 列。物の間は幅 + 1.6 m
  const xs: number[] = [];
  let x = 0;
  for (const e of spec.entries) {
    xs.push(x + e.size[0] / 2);
    x += e.size[0] + 1.6;
  }
  const tour: PlanTourStop[] = [];
  spec.entries.forEach((e, i) => {
    const [w, h, d] = e.size;
    const r = Math.max(w, h * 0.8, d) * 0.9 + 0.9;
    const cy = Math.min(h * 0.6, 1.2);
    // 近く: 斜め前（右 35°）から、物の高さの 6 割を見る
    const a = 0.6;
    const ex = xs[i] + Math.sin(a) * r;
    const ez = Math.cos(a) * r;
    const ey = Math.max(0.9, Math.min(1.6, h + 0.3));
    tour.push({ label: `${e.label}（近く）`, eye: [ex, ey, ez], yaw: Math.atan2(ex - xs[i], ez), pitch: Math.atan2(cy - ey, r), fov: 50 });
    // 4 m: 正面寄り（左 15°）
    const b = -0.26;
    const R = Math.max(4, r * 1.8);
    const fx = xs[i] + Math.sin(b) * R;
    const fz = Math.cos(b) * R;
    tour.push({ label: `${e.label}（${R.toFixed(0)} m）`, eye: [fx, 1.6, fz], yaw: Math.atan2(fx - xs[i], fz), pitch: Math.atan2(cy - 1.6, R), fov: 50 });
  });
  const plan: FloorPlan = {
    id: `gallery-${id}`,
    title: `小物の見本帳（${spec.label}）`,
    typology: '小物を並べて近くから確かめる見本帳',
    spaces: [{ id: 'hall', label: '見本帳', kind: 'hall', rect: [-4, -6, x + 4, 12], floor: 0, ceiling: 8 }],
    openings: [],
    tour,
    notes: [],
  };
  return {
    id,
    label: `小物の見本帳: ${spec.label}`,
    plan,
    style,
    views: [],
    sky: false,
    build(ctx: SceneContext) {
      const b = new Builder(ctx);
      spec.setup?.(ctx);
      const mats = spec.mats ? spec.mats(ctx) : styleMats(ctx);
      const floor = mats.get(spec.floor ?? '#9db0a8');
      const wall = mats.get(spec.wall ?? '#c9d6cf');
      b.boxMM(floor, [-6, -0.2, -8], [x + 6, 0, 14], { collide: true, shadow: 'receive' });
      b.boxMM(wall, [-6, 0, -8.2], [x + 6, 6, -8], { shadow: 'receive' });
      const sink = builderSink(b, ctx);
      spec.entries.forEach((e, i) => e.build(Prop.at(sink, mats, [xs[i], 0, 0], 0, 1000 + i * 17)));
      b.finalize();
      // 光: 斜め上の日 + 空の明るさ（場所の照明ではなく、形が分かる中立の光）
      const sun = new THREE.DirectionalLight(0xffffff, Math.PI * 0.9);
      sun.position.set(x / 2 + 8, 14, 10);
      sun.target.position.set(x / 2, 0, 0);
      sun.castShadow = true;
      sun.shadow.mapSize.set(4096, 4096);
      const half = Math.max(12, x / 2 + 6);
      Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 1, far: 60 });
      sun.shadow.camera.updateProjectionMatrix();
      sun.shadow.bias = -0.0003;
      sun.shadow.normalBias = 0.02;
      b.root.add(sun, sun.target, new THREE.HemisphereLight(0xffffff, 0x9aa8a2, Math.PI * 0.55));
      ctx.setSun(sun);
      const first: V3 = tour[0]?.eye ?? [0, 1.6, 4];
      return { root: b.root, spawn: { pos: [first[0], 0, first[2]], yaw: tour[0]?.yaw ?? 0 }, staticShadows: true };
    },
  };
}
