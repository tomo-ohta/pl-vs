/**
 * FloorLayout → three.js（v1 の RoomBuilder の作り直し。継承計画 3 章の C 区分）。
 *
 * 箱 1 つずつの扱いは v1 と同じ流れ: surfaceBox（面取り・UV）→ 表面の質感の座標（attachSurfaceAppearance）→
 * 焼き込み陰影（SurfaceLighting.bake → 頂点属性 bakedLight）→ 材質ごとに結合 → MaterialLibrary.forRoom の材質。
 *
 * v2 で足したもの:
 * - 区画（cell）ごとに Group を分ける（cell and portal の描画で、見えない区画を丸ごと隠すため）
 * - 出現型の隠し: revealGroup の箱は別のメッシュにして最初は隠す / concealGroup の箱は現れたら隠す
 * - 部品で入切する照明（lamp）: 発光パネル（Box.kind 'lamp:<id>'）は「点灯」と「消灯」の 2 つのメッシュを持って切り替え、
 *   焼き込み陰影は「その照明なし」と「あり」の 2 通りを焼いて、照明の明るさに合わせて混ぜる
 * - 材質のシェーダは「メッシュの座標の y = 0 が床」を前提にする（水深・汚れ層の高さ）。区画の Group を床の高さ（floorY）に置き、
 *   ジオメトリは焼き込みの後で -floorY ずらす（v1 の部屋のローカル座標と同じ）
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { AABB } from '../../core/math/aabb.ts';
import { hashAll } from '../../core/math/rng.ts';
import type { Box, CellLayout, FloorLayout, LightSpec, MatId } from '../../core/world/layout.ts';
import { materialOverridesFor, SURFACES, type MaterialLibrary } from '../render/MaterialLibrary.ts';
import { appearanceSeed, attachSurfaceAppearance } from '../render/SurfaceAppearance.ts';
import { SurfaceLighting, surfaceBox } from '../render/SurfaceGeometry.ts';
import { attachWindowRoom, WINDOW_ROOM_MATS } from '../render/WindowRoom.ts';
import { OUTSIDE_VIEW_MAT } from '../render/OutsideView.ts';
import type { LitLayout } from '../render/litLayout.ts';

/** v1 と同じ: 拡散は材質側で抑えるので、点光源は鏡面反射担当として強めに戻す */
export const DYNAMIC_LIGHT_SCALE = 3.0;

export interface ManagedLight {
  spec: LightSpec;
  cell: string;
  /** spec.intensity × DYNAMIC_LIGHT_SCALE */
  base: number;
}

/** 焼き込み陰影を混ぜるメッシュ: 全部の照明ありの値と、照明ごとの「その照明なし」の値 */
interface BlendMesh { mesh: THREE.Mesh; on: Float32Array; offs: { lamp: string; off: Float32Array }[] }

export interface BuiltCell {
  id: string;
  layout: CellLayout;
  group: THREE.Group;
  bounds: AABB;
  /** 出現型の隠し: 現れたら見せる / 現れたら隠す */
  reveal: Map<string, THREE.Mesh[]>;
  conceal: Map<string, THREE.Mesh[]>;
  /** 部品で入切する照明の発光パネル */
  lampPanels: Map<string, { on: THREE.Mesh[]; off: THREE.Mesh[] }>;
  /** 照明で焼き込み陰影を混ぜるメッシュ */
  blend: BlendMesh[];
  /** この区画に効く照明（lamp id） */
  lamps: string[];
  /** 焼き込み陰影（動く物の明るさを測るのに使う）。offs は照明ごとの「その照明なし」 */
  lighting: { on: SurfaceLighting; offs: Map<string, SurfaceLighting> };
  triangles: number;
}

export interface BuiltFloor {
  floor: FloorLayout;
  root: THREE.Group;
  cells: Map<string, BuiltCell>;
  lights: ManagedLight[];
  dispose(): void;
}

const SKIP_KINDS = new Set(['colliderOnly', 'emitOnly']);

export class FloorBuilder {
  private readonly materials: MaterialLibrary;

  constructor(materials: MaterialLibrary) {
    this.materials = materials;
  }

  build(floor: FloorLayout): BuiltFloor {
    const root = new THREE.Group();
    root.name = `floor:${floor.id}`;
    const cells = new Map<string, BuiltCell>();
    const lights: ManagedLight[] = [];
    const disposables: THREE.BufferGeometry[] = [];
    // 広い開口（扉のない opening）でつながる隣の区画: その照明も焼き込みの光源にする（境目で明るさが切れないように）
    const neighbors = new Map<string, CellLayout[]>();
    for (const pt of floor.portals) {
      if (pt.kind !== 'opening') continue;
      const [a, b] = pt.cells.map((id) => floor.cells.find((c) => c.id === id));
      if (!a || !b) continue;
      neighbors.set(a.id, [...(neighbors.get(a.id) ?? []), b]);
      neighbors.set(b.id, [...(neighbors.get(b.id) ?? []), a]);
    }
    for (const cell of floor.cells) {
      const built = this.buildCell(floor, cell, disposables, neighbors.get(cell.id) ?? []);
      cells.set(cell.id, built);
      root.add(built.group);
      for (const l of cell.lights) lights.push({ spec: l, cell: cell.id, base: l.intensity * DYNAMIC_LIGHT_SCALE });
    }
    return {
      floor,
      root,
      cells,
      lights,
      dispose: () => {
        root.removeFromParent();
        for (const g of disposables) g.dispose();
        for (const c of floor.cells) this.materials.releaseRoom(c.materialKey ?? c.id);
      },
    };
  }

  private buildCell(floor: FloorLayout, cell: CellLayout, disposables: THREE.BufferGeometry[], neighbors: CellLayout[]): BuiltCell {
    const group = new THREE.Group();
    group.name = `cell:${cell.id}`;
    const fy = cell.floorY;
    group.position.y = fy;
    const matKey = cell.materialKey ?? cell.id;
    const cellSeed = hashAll(floor.seed, 'cell', matKey);
    const drawn = cell.boxes.filter((b) => !SKIP_KINDS.has(b.kind ?? '') && b.max[0] - b.min[0] > 1e-4 && b.max[1] - b.min[1] > 1e-4 && b.max[2] - b.min[2] > 1e-4);
    // 隣の区画の照明器具（描かない。光源としてだけ焼き込みに入れる。遮蔽には使わない）
    const borrowed: Box[] = [];
    const borrowedLights: LightSpec[] = [];
    for (const n of neighbors) {
      for (const b of n.boxes) if (SURFACES[b.mat]?.emission && !b.revealGroup && b.max[1] - b.min[1] < 0.1) borrowed.push({ ...b, solid: false });
      borrowedLights.push(...n.lights);
    }
    const lampIds = new Set<string>();
    for (const b of [...drawn, ...borrowed]) if (b.kind?.startsWith('lamp:')) lampIds.add(b.kind.slice(5));
    for (const l of [...cell.lights, ...borrowedLights]) if (l.lampId) lampIds.add(l.lampId);

    // 焼き込み: 全部の照明あり（on）と、lamp ごとに「その照明なし」（off）
    const lit = (boxes: Box[], lightsIn: LightSpec[]): LitLayout => ({ bounds: cell.bounds, footprint: cell.footprint, height: cell.height, boxes, lights: lightsIn, palette: cell.palette, ...(cell.lighting ? { lighting: cell.lighting } : {}) });
    const all = [...drawn, ...borrowed];
    const allLights = [...cell.lights, ...borrowedLights];
    const bakeOn = new SurfaceLighting(lit(all, allLights));
    const bakeOff = new Map<string, SurfaceLighting>();
    for (const id of lampIds) {
      const boxes = all.map((b) => (b.kind === `lamp:${id}` ? { ...b, mat: 'lightOff' as MatId } : b));
      bakeOff.set(id, new SurfaceLighting(lit(boxes, allLights.filter((l) => l.lampId !== id))));
    }
    const lampList = [...lampIds];

    // 箱 → ジオメトリ（区分 bucket と材質ごとに結合する）
    const buckets = new Map<string, { mat: MatId; geos: THREE.BufferGeometry[]; kind: string; group: string }>();
    const put = (key: string, mat: MatId, kind: string, grp: string, g: THREE.BufferGeometry): void => {
      let b = buckets.get(key);
      if (!b) buckets.set(key, (b = { mat, geos: [], kind, group: grp }));
      b.geos.push(g);
    };
    let triangles = 0;
    for (const b of drawn) {
      const lamp = b.kind?.startsWith('lamp:') ? b.kind.slice(5) : null;
      const variants: { mat: MatId; kind: string; grp: string }[] = lamp
        ? [{ mat: b.mat, kind: 'lampOn', grp: lamp }, { mat: 'lightOff', kind: 'lampOff', grp: lamp }]
        : b.revealGroup ? [{ mat: b.mat, kind: 'reveal', grp: b.revealGroup }]
          : b.concealGroup ? [{ mat: b.mat, kind: 'conceal', grp: b.concealGroup }]
            : [{ mat: b.mat, kind: 'static', grp: '' }];
      for (const v of variants) {
        const box: Box = v.mat === b.mat ? b : { ...b, mat: v.mat };
        let g = surfaceBox(box);
        attachSurfaceAppearance(g, appearanceSeed(floor.seed, matKey, box.mat));
        if (WINDOW_ROOM_MATS.has(box.mat) || box.mat === OUTSIDE_VIEW_MAT) attachWindowRoom(g, box.min, box.max);
        bakeOn.bake(g, box);
        // 照明ごとの「なし」の焼き込みを別の属性に（結合のため全部の箱に同じ属性を付ける）
        for (const id of lampList) {
          const tmp = g.clone();
          bakeOff.get(id)!.bake(tmp, box);
          g.setAttribute(`bakedOff_${id}`, tmp.getAttribute('bakedLight'));
          tmp.dispose();
        }
        if (g.index) { const flat = g.toNonIndexed(); g.dispose(); g = flat; }
        if (fy !== 0) g.translate(0, -fy, 0);
        triangles += g.getAttribute('position').count / 3;
        put(`${v.kind}|${v.grp}|${v.mat}`, v.mat, v.kind, v.grp, g);
      }
    }

    const built: BuiltCell = { id: cell.id, layout: cell, group, bounds: cell.bounds, reveal: new Map(), conceal: new Map(), lampPanels: new Map(), blend: [], lamps: lampList, lighting: { on: bakeOn, offs: bakeOff }, triangles };
    for (const [key, b] of buckets) {
      const merged = b.geos.length === 1 ? b.geos[0]! : mergeGeometries(b.geos, false);
      if (!merged) { console.warn(`[FloorBuilder] 結合に失敗: ${cell.id} ${key}`); continue; }
      if (b.geos.length > 1) for (const g of b.geos) g.dispose();
      disposables.push(merged);
      const mat = this.materials.forRoom(b.mat, { roomId: matKey, seed: cellSeed, palette: cell.palette, height: cell.height, overrides: materialOverridesFor(cell.render, cell.palette) });
      const mesh = new THREE.Mesh(merged, mat);
      mesh.name = `${cell.id}:${key}`;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      group.add(mesh);
      // 照明の混ぜ合わせ
      const onAttr = merged.getAttribute('bakedLight') as THREE.BufferAttribute | undefined;
      if (lampList.length && onAttr) {
        const offs: BlendMesh['offs'] = [];
        for (const id of lampList) {
          const offAttr = merged.getAttribute(`bakedOff_${id}`) as THREE.BufferAttribute | undefined;
          if (!offAttr) continue;
          offs.push({ lamp: id, off: (offAttr.array as Float32Array).slice() });
          merged.deleteAttribute(`bakedOff_${id}`);
        }
        built.blend.push({ mesh, on: (onAttr.array as Float32Array).slice(), offs });
      }
      if (b.kind === 'reveal') { mesh.visible = false; push(built.reveal, b.group, mesh); }
      else if (b.kind === 'conceal') push(built.conceal, b.group, mesh);
      else if (b.kind === 'lampOn' || b.kind === 'lampOff') {
        const e = built.lampPanels.get(b.group) ?? { on: [], off: [] };
        (b.kind === 'lampOn' ? e.on : e.off).push(mesh);
        built.lampPanels.set(b.group, e);
      }
    }
    return built;
  }
}

function push<K, V>(m: Map<K, V[]>, k: K, v: V): void {
  const list = m.get(k);
  if (list) list.push(v);
  else m.set(k, [v]);
}

/**
 * 照明の明るさ（lamp id → 0..1）を、発光パネルの切替と焼き込み陰影の混ぜ合わせに写す。
 * 陰影 = 全部あり − Σ（1 − 明るさ）×（全部あり − その照明なし）
 */
export function applyLampLevels(cell: BuiltCell, levelOf: (lampId: string) => number): void {
  for (const [id, panels] of cell.lampPanels) {
    const lv = levelOf(id);
    for (const m of panels.on) m.visible = lv >= 0.5;
    for (const m of panels.off) m.visible = lv < 0.5;
  }
  for (const b of cell.blend) {
    const attr = b.mesh.geometry.getAttribute('bakedLight') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    arr.set(b.on);
    for (const o of b.offs) {
      const k = 1 - levelOf(o.lamp);
      if (k <= 0) continue;
      for (let i = 0; i < arr.length; i++) arr[i] = arr[i]! - k * (b.on[i]! - o.off[i]!);
    }
    attr.needsUpdate = true;
  }
}

/** 区画の焼き込み陰影の、点 at での明るさ（照明の入切を反映）。動く物の頂点の明るさに使う */
export function sampleCellLight(cell: BuiltCell, at: [number, number, number], levelOf: (lampId: string) => number): [number, number, number] {
  const on = cell.lighting.on.sample(at);
  const out: [number, number, number] = [on[0], on[1], on[2]];
  for (const [id, off] of cell.lighting.offs) {
    const k = 1 - levelOf(id);
    if (k <= 0) continue;
    const o = off.sample(at);
    for (let i = 0; i < 3; i++) out[i] = out[i]! - k * (on[i]! - o[i]!);
  }
  return out;
}

/** 点を含む区画（無ければ null） */
export function cellAt(built: BuiltFloor, at: readonly [number, number, number]): BuiltCell | null {
  let best: BuiltCell | null = null;
  for (const c of built.cells.values()) {
    const b = c.bounds;
    if (at[0] < b.min[0] || at[0] > b.max[0] || at[2] < b.min[2] || at[2] > b.max[2] || at[1] < b.min[1] - 2 || at[1] > b.max[1] + 0.5) continue;
    // 重なるときは小さい区画（中に入っている方）
    if (!best || (b.max[0] - b.min[0]) * (b.max[2] - b.min[2]) < (best.bounds.max[0] - best.bounds.min[0]) * (best.bounds.max[2] - best.bounds.min[2])) best = c;
  }
  return best;
}
