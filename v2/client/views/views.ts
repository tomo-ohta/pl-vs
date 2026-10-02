/**
 * 部品の見た目（view）。シミュレーションの部品の状態（PartState）を読んで、毎フレーム three.js の物を動かす。
 * 部品の種類ごとに createView を登録する。見た目の無い部品（感じる部品・判断の部品）は登録しない。
 *
 * 動く物には焼き込み陰影が無いので、置かれた区画の陰影をその位置で測って頂点の明るさ（bakedLight）に写す（浮いて見えないように）。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { aabbCenter, type AABB } from '../../core/math/aabb.ts';
import type { PartState } from '../../core/sim/part.ts';
import type { Sim } from '../../core/sim/sim.ts';
import type { EntitySpec, Json, MatId } from '../../core/world/layout.ts';
import type { MaterialLibrary } from '../render/MaterialLibrary.ts';
import { surfaceBox } from '../render/SurfaceGeometry.ts';
import { cellAt, sampleCellLight, type BuiltFloor } from '../world/FloorBuilder.ts';

export interface ViewContext {
  root: THREE.Group;
  materials: MaterialLibrary;
  built: BuiltFloor;
  sim: Sim;
  /** 照明の明るさ（lamp id → 0..1） */
  levelOf(lampId: string): number;
}

export interface EntityView {
  update(state: Readonly<PartState>, dt: number): void;
  dispose(): void;
}

type Factory = (spec: EntitySpec, ctx: ViewContext) => EntityView | null;
const FACTORIES = new Map<string, Factory>();

export function defineView(type: string, f: Factory): void {
  FACTORIES.set(type, f);
}

export function createView(spec: EntitySpec, ctx: ViewContext): EntityView | null {
  return FACTORIES.get(spec.type)?.(spec, ctx) ?? null;
}

// ---------------------------------------------------------------- 補助
function aabbOf(v: Json | undefined): AABB {
  const o = v as { min: number[]; max: number[] };
  return { min: [o.min[0]!, o.min[1]!, o.min[2]!], max: [o.max[0]!, o.max[1]!, o.max[2]!] };
}

/** 箱のジオメトリ（原点中心）と頂点の明るさ */
function boxGeometry(size: [number, number, number], mat: MatId): THREE.BufferGeometry {
  const g = surfaceBox({ min: [-size[0] / 2, -size[1] / 2, -size[2] / 2], max: [size[0] / 2, size[1] / 2, size[2] / 2], mat, solid: false });
  if (!g.getAttribute('bakedLight')) g.setAttribute('bakedLight', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 3), 3));
  return g;
}

/** 単位の大きさの棚（-0.5..0.5）: 幅の向きの両端の側板・天板・底板・棚板 2 枚・真ん中の背板（向こうが透けない）。wideX: 幅が x の向き */
function shelfGeometry(mat: MatId, wideX: boolean): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const add = (c: [number, number, number], size: [number, number, number]): void => {
    const g = boxGeometry(wideX ? size : [size[2], size[1], size[0]], mat);
    g.translate(...(wideX ? c : [c[2], c[1], c[0]] as [number, number, number]));
    parts.push(g);
  };
  const t = 0.06;
  add([-0.5 + t / 2, 0, 0], [t, 1, 1]);
  add([0.5 - t / 2, 0, 0], [t, 1, 1]);
  for (const y of SHELF_BOARDS) add([0, y, 0], [1 - 2 * t, 0.04, 0.96]);
  add([0, 0, 0], [1 - 2 * t, 0.98, 0.03]);
  const merged = mergeGeometries(parts, false);
  for (const g of parts) g.dispose();
  return merged ?? boxGeometry([1, 1, 1], mat);
}

/** 棚板の高さ（単位の大きさ。下から） */
const SHELF_BOARDS = [-0.5 + 0.02, -0.18, 0.15, 0.5 - 0.02];

/** 棚の中身（単位の大きさ）: 各段の前後に、大きさの揃わない箱を詰める（決まった並び。棚の寸法で引き伸ばされる） */
function shelfFillGeometry(mat: MatId, wideX: boolean): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  let k = 7;
  const rnd = (): number => { k = (k * 16807) % 2147483647; return k / 2147483647; };
  for (let i = 0; i + 1 < SHELF_BOARDS.length; i++) {
    const y0 = SHELF_BOARDS[i]! + 0.02, room = SHELF_BOARDS[i + 1]! - 0.02 - y0;
    for (const side of [-1, 1]) {
      let x = -0.44;
      while (x < 0.4) {
        const w = Math.min(0.44 - x, 0.12 + rnd() * 0.16);
        const h = room * (0.62 + rnd() * 0.33);
        const d = 0.3 + rnd() * 0.12;
        const z0 = side > 0 ? 0.02 : -0.02 - d;
        const size: [number, number, number] = [w - 0.01, h, d];
        const c: [number, number, number] = [x + w / 2, y0 + h / 2, z0 + d / 2];
        const g = boxGeometry(wideX ? size : [size[2], size[1], size[0]], mat);
        g.translate(...(wideX ? c : [c[2], c[1], c[0]] as [number, number, number]));
        parts.push(g);
        x += w;
      }
    }
  }
  const merged = mergeGeometries(parts, false);
  for (const g of parts) g.dispose();
  return merged ?? boxGeometry([0.1, 0.1, 0.1], mat);
}

/** ジオメトリの bakedLight を一色に（区画の陰影をその位置で測った値） */
function setBaked(g: THREE.BufferGeometry, rgb: [number, number, number]): void {
  const attr = g.getAttribute('bakedLight') as THREE.BufferAttribute;
  const arr = attr.array as Float32Array;
  for (let i = 0; i < arr.length; i += 3) { arr[i] = rgb[0]; arr[i + 1] = rgb[1]; arr[i + 2] = rgb[2]; }
  attr.needsUpdate = true;
}

function lightAt(ctx: ViewContext, at: [number, number, number]): [number, number, number] {
  const cell = cellAt(ctx.built, at);
  return cell ? sampleCellLight(cell, at, ctx.levelOf) : [0.2, 0.2, 0.2];
}

// ---------------------------------------------------------------- 扉
defineView('door', (spec, ctx) => {
  const panel = aabbOf(spec.params.panel);
  const axis = spec.params.axis === 'x' ? 'x' : 'z';
  const mat = (spec.params.mat as MatId | undefined) ?? 'doorWood';
  const size: [number, number, number] = [panel.max[0] - panel.min[0], panel.max[1] - panel.min[1], panel.max[2] - panel.min[2]];
  // 板は開口より 3 cm ずつ大きく（隙間から向こうが見えない。v1 と同じ）。厚さ 5 cm
  const W = (axis === 'z' ? size[0] : size[2]) + 0.06;
  const H = size[1] + 0.03;
  const T = 0.05;
  const hingeSign = spec.params.hinge === 1 ? 1 : -1;
  // 蝶番: 'z' の扉（x に沿う板）は x の端、'x' の扉は z の端。板は蝶番から -hingeSign の向きへ伸びる
  const pivot = new THREE.Group();
  if (axis === 'z') pivot.position.set(hingeSign < 0 ? panel.min[0] - 0.03 : panel.max[0] + 0.03, panel.min[1], (panel.min[2] + panel.max[2]) / 2);
  else pivot.position.set((panel.min[0] + panel.max[0]) / 2, panel.min[1], hingeSign < 0 ? panel.min[2] - 0.03 : panel.max[2] + 0.03);
  const along = (d: number, up: number, out: number): [number, number, number] => (axis === 'z' ? [-hingeSign * d, up, out] : [out, up, -hingeSign * d]);
  const light = lightAt(ctx, aabbCenter(panel));
  const geos: THREE.BufferGeometry[] = [];
  const g = boxGeometry(axis === 'z' ? [W, H, T] : [T, H, W], mat);
  setBaked(g, light);
  geos.push(g);
  const mesh = new THREE.Mesh(g, ctx.materials.get(mat));
  mesh.position.set(...along(W / 2, H / 2, 0));
  pivot.add(mesh);
  // ノブ（レバー）: 戸先から 12 cm・床から 1.0 m（低い扉は高さの半分）。両面に出す（v1 と同じ寸法）
  const metal = ctx.materials.get('metal');
  const knobD = W - 0.12, knobY = Math.min(1.0, H * 0.5);
  const spindle = new THREE.CylinderGeometry(0.022, 0.022, T + 0.07, 10);
  const lever = new THREE.CylinderGeometry(0.014, 0.014, 0.13, 10);
  for (const cg of [spindle, lever]) {
    cg.setAttribute('bakedLight', new THREE.BufferAttribute(new Float32Array(cg.getAttribute('position').count * 3), 3));
    setBaked(cg, light);
    geos.push(cg);
  }
  const sp = new THREE.Mesh(spindle, metal);
  // 軸は板を貫く向き（'z' の扉は z、'x' の扉は x）
  if (axis === 'z') sp.rotation.x = Math.PI / 2; else sp.rotation.z = Math.PI / 2;
  sp.position.set(...along(knobD, knobY, 0));
  pivot.add(sp);
  for (const face of [-1, 1]) {
    const lv = new THREE.Mesh(lever, metal);
    // レバーは板に沿って蝶番の方へ向く
    if (axis === 'z') lv.rotation.z = Math.PI / 2; else lv.rotation.x = Math.PI / 2;
    lv.position.set(...along(knobD - 0.05, knobY, face * (T / 2 + 0.035)));
    pivot.add(lv);
  }
  ctx.root.add(pivot);
  const swing = typeof spec.params.swing === 'number' ? spec.params.swing : 1;
  return {
    update(s) {
      const a = typeof s.angle === 'number' ? s.angle : 0;
      // 開く角度 95°（ease）
      const e = a * a * (3 - 2 * a);
      pivot.rotation.y = -hingeSign * swing * e * (95 * Math.PI / 180);
    },
    dispose() { pivot.removeFromParent(); for (const x of geos) x.dispose(); },
  };
});

// ---------------------------------------------------------------- ボタン
defineView('button', (spec, ctx) => {
  const b = aabbOf(spec.params.box);
  const mat = (spec.params.mat as MatId | undefined) ?? 'plasticRed';
  const size: [number, number, number] = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
  const g = boxGeometry(size, mat);
  const off = ctx.materials.get(mat);
  const on = ctx.materials.get('lightGreen');
  const mesh = new THREE.Mesh(g, off);
  mesh.position.set(...aabbCenter(b));
  ctx.root.add(mesh);
  setBaked(g, lightAt(ctx, aabbCenter(b)));
  return {
    update(s) { mesh.material = s.on ? on : off; },
    dispose() { mesh.removeFromParent(); g.dispose(); },
  };
});

// ---------------------------------------------------------------- 動く床
defineView('mover', (spec, ctx) => {
  const b = aabbOf(spec.params.box);
  const mat = (spec.params.mat as MatId | undefined) ?? 'metal';
  const size: [number, number, number] = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
  const g = boxGeometry(size, mat);
  const mesh = new THREE.Mesh(g, ctx.materials.get(mat));
  const c = aabbCenter(b);
  ctx.root.add(mesh);
  let t = 0;
  return {
    update(s, dt) {
      const p = (s.pos as number[] | undefined) ?? [0, 0, 0];
      mesh.position.set(c[0] + p[0]!, c[1] + p[1]!, c[2] + p[2]!);
      t -= dt;
      if (t <= 0) { t = 0.25; setBaked(g, lightAt(ctx, [mesh.position.x, mesh.position.y + 0.3, mesh.position.z])); }
    },
    dispose() { mesh.removeFromParent(); g.dispose(); },
  };
});

// ---------------------------------------------------------------- 傾く床
defineView('tiltFloor', (spec, ctx) => {
  const r = spec.params.rect as { x0: number; z0: number; x1: number; z1: number };
  const th = typeof spec.params.thickness === 'number' ? spec.params.thickness : 0.2;
  const mat = (spec.params.mat as MatId | undefined) ?? 'floorWood';
  const size: [number, number, number] = [Math.abs(r.x1 - r.x0), th, Math.abs(r.z1 - r.z0)];
  const g = boxGeometry(size, mat);
  const mesh = new THREE.Mesh(g, ctx.materials.get(mat));
  ctx.root.add(mesh);
  setBaked(g, lightAt(ctx, [(r.x0 + r.x1) / 2, 0.3, (r.z0 + r.z1) / 2]));
  return {
    update(s) {
      const c = s.center as number[] | undefined;
      const q = s.rot as number[] | undefined;
      if (c) mesh.position.set(c[0]!, c[1]!, c[2]!);
      if (q) mesh.quaternion.set(q[0]!, q[1]!, q[2]!, q[3]!);
    },
    dispose() { mesh.removeFromParent(); g.dispose(); },
  };
});

// ---------------------------------------------------------------- 転がる物
defineView('propPile', (_spec, ctx) => {
  // 材質 × 形（箱 / 球）ごとの InstancedMesh。数・寸法は最初の状態で決まる
  const groups = new Map<string, { mesh: THREE.InstancedMesh; index: number[] }>();
  const unitBox = new Map<MatId, THREE.BufferGeometry>();
  const sphere = new THREE.SphereGeometry(0.5, 20, 14);
  let made = false;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const sc = new THREE.Vector3();
  let lightTimer = 0;
  const make = (s: Readonly<PartState>): void => {
    const mats = s.mats as string[];
    const kinds = s.kinds as string[];
    const half = s.half as number[];
    const order = new Map<string, number[]>();
    const put = (key: string, i: number): void => {
      const list = order.get(key) ?? [];
      list.push(i);
      order.set(key, list);
    };
    mats.forEach((m, i) => {
      const wide = half[i * 3]! >= half[i * 3 + 2]! ? 'X' : 'Z';
      const shape = kinds[i] === 'ball' ? 'ball' : kinds[i] === 'shelf' ? `shelf${wide}` : 'box';
      put(`${m}|${shape}`, i);
      // 棚には中身（箱）を詰める（同じ姿勢で描く別の InstancedMesh）
      if (kinds[i] === 'shelf') put(`boxCardboard|fill${wide}`, i);
    });
    for (const [key, index] of order) {
      const [mat, shape] = key.split('|') as [MatId, string];
      let geo: THREE.BufferGeometry;
      if (shape === 'ball') geo = sphere;
      else if (shape === 'shelfX' || shape === 'shelfZ') geo = shelfGeometry(mat, shape === 'shelfX');
      else if (shape === 'fillX' || shape === 'fillZ') geo = shelfFillGeometry(mat, shape === 'fillX');
      else {
        geo = unitBox.get(mat) ?? boxGeometry([1, 1, 1], mat);
        unitBox.set(mat, geo);
      }
      const g = geo.clone();
      if (shape !== 'ball' && shape !== 'box') geo.dispose();
      g.deleteAttribute('bakedLight');
      g.setAttribute('bakedLight', new THREE.InstancedBufferAttribute(new Float32Array(index.length * 3).fill(0.2), 3));
      const mesh = new THREE.InstancedMesh(g, ctx.materials.get(mat), index.length);
      mesh.frustumCulled = false;
      ctx.root.add(mesh);
      groups.set(key, { mesh, index });
    }
    made = true;
  };
  return {
    update(s, dt) {
      if (!made) make(s);
      const poses = s.poses as number[];
      const half = s.half as number[];
      lightTimer -= dt;
      const relight = lightTimer <= 0;
      if (relight) lightTimer = 0.3;
      for (const { mesh, index } of groups.values()) {
        const baked = mesh.geometry.getAttribute('bakedLight') as THREE.InstancedBufferAttribute;
        index.forEach((i, k) => {
          const o = i * 7;
          p.set(poses[o]!, poses[o + 1]!, poses[o + 2]!);
          q.set(poses[o + 3]!, poses[o + 4]!, poses[o + 5]!, poses[o + 6]!);
          sc.set(half[i * 3]! * 2, half[i * 3 + 1]! * 2, half[i * 3 + 2]! * 2);
          m4.compose(p, q, sc);
          mesh.setMatrixAt(k, m4);
          if (relight) {
            const c = lightAt(ctx, [p.x, p.y + 0.2, p.z]);
            baked.setXYZ(k, c[0], c[1], c[2]);
          }
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (relight) baked.needsUpdate = true;
      }
    },
    dispose() {
      for (const { mesh } of groups.values()) { mesh.removeFromParent(); mesh.geometry.dispose(); }
      for (const g of unitBox.values()) g.dispose();
      sphere.dispose();
    },
  };
});

// ---------------------------------------------------------------- 崩れる床
defineView('crumbleTile', (spec, ctx) => {
  const b = aabbOf(spec.params.box);
  const mat = (spec.params.mat as MatId | undefined) ?? 'floorTile';
  const size: [number, number, number] = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
  const g = boxGeometry(size, mat);
  const mesh = new THREE.Mesh(g, ctx.materials.get(mat));
  const c = aabbCenter(b);
  mesh.position.set(...c);
  ctx.root.add(mesh);
  setBaked(g, lightAt(ctx, [c[0], c[1] + 0.3, c[2]]));
  let t = 0;
  return {
    update(s, dt) {
      t += dt;
      const phase = s.phase as number;
      if (phase === 1) {
        // 揺れ（だんだん強く）
        const k = Math.min(1, (s.t as number) / 0.9);
        mesh.position.set(c[0] + Math.sin(t * 61) * 0.012 * k, c[1] + Math.sin(t * 47) * 0.008 * k, c[2] + Math.cos(t * 53) * 0.012 * k);
        mesh.visible = true;
      } else if (phase === 2) {
        const d = s.drop as number;
        mesh.position.set(c[0], c[1] - d * d * 0.5, c[2]);
        mesh.rotation.set(d * 0.4, 0, d * 0.25);
        mesh.visible = d < 4;
      } else {
        mesh.position.set(...c);
        mesh.rotation.set(0, 0, 0);
        mesh.visible = true;
      }
    },
    dispose() { mesh.removeFromParent(); g.dispose(); },
  };
});

// ---------------------------------------------------------------- 視線のマネキン
defineView('mannequin', (_spec, ctx) => {
  const mat = ctx.materials.get('marbleWhite');
  const group = new THREE.Group();
  const parts: THREE.BufferGeometry[] = [];
  const add = (size: [number, number, number], at: [number, number, number]): void => {
    const g = boxGeometry(size, 'marbleWhite');
    parts.push(g);
    const m = new THREE.Mesh(g, mat);
    m.position.set(...at);
    group.add(m);
  };
  // 胴・腰・脚・腕（箱）と頭（球）。高さ 1.75 m
  add([0.38, 0.55, 0.22], [0, 1.22, 0]);
  add([0.34, 0.2, 0.2], [0, 0.88, 0]);
  add([0.13, 0.78, 0.14], [-0.09, 0.39, 0]);
  add([0.13, 0.78, 0.14], [0.09, 0.39, 0]);
  add([0.1, 0.62, 0.1], [-0.26, 1.18, 0]);
  add([0.1, 0.62, 0.1], [0.26, 1.18, 0]);
  add([0.08, 0.12, 0.08], [0, 1.54, 0]);
  const head = new THREE.SphereGeometry(0.12, 18, 14);
  head.setAttribute('bakedLight', new THREE.BufferAttribute(new Float32Array(head.getAttribute('position').count * 3), 3));
  parts.push(head);
  const hm = new THREE.Mesh(head, mat);
  hm.position.set(0, 1.68, 0);
  group.add(hm);
  ctx.root.add(group);
  let relight = 0;
  return {
    update(s, dt) {
      const p = s.pos as number[];
      group.position.set(p[0]!, p[1]!, p[2]!);
      group.rotation.y = s.yaw as number;
      relight -= dt;
      if (relight <= 0) {
        relight = 0.3;
        const c = lightAt(ctx, [p[0]!, p[1]! + 1.2, p[2]!]);
        for (const g of parts) setBaked(g, c);
      }
    },
    dispose() { group.removeFromParent(); for (const g of parts) g.dispose(); },
  };
});

// ---------------------------------------------------------------- 導く光（光る球 + 点光源）
defineView('guideLight', (spec, ctx) => {
  const color = typeof spec.params.color === 'number' ? spec.params.color : 0xfff1d0;
  const geo = new THREE.SphereGeometry(0.1, 16, 12);
  const orb = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, fog: true }));
  const light = new THREE.PointLight(color, 2.2, 7, 2);
  orb.add(light);
  ctx.root.add(orb);
  let t = 0;
  return {
    update(s, dt) {
      t += dt;
      const p = s.pos as number[];
      orb.position.set(p[0]!, p[1]! + Math.sin(t * 2.1) * 0.05, p[2]!);
      light.intensity = 2.0 + Math.sin(t * 7.3) * 0.15;
    },
    dispose() { orb.removeFromParent(); geo.dispose(); (orb.material as THREE.Material).dispose(); },
  };
});
