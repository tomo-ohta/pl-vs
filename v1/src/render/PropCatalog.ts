/**
 * CC0 glTF プロップのカタログ（Poly Haven。public/cc0/models/index.json → tools/build-cc0-models.mjs が生成）。
 *
 * - kind（Box.kind の意味タグ）→ 候補モデル id の表 PROP_KINDS。
 * - index.json の実寸（size）・三角形数を先に読み、モデル選択（スケール判定・三角形予算）は glTF 読込前に同期で済ませる。
 * - glTF は遅延 + 非同期で読み、読込中は RoomBuilder が元の箱を描く（到着後に差し替える）。
 * - 読み込んだジオメトリは接地面（floor: 底面中心 / wall: 背面中心 / ceiling: 上面中心）を原点に正規化し、前面は +Z。
 * - 材質は glTF の MeshStandardMaterial を MaterialLibrary.adoptExternal で clone し、共有材質と同じ注入
 *   （bakedLight 属性 / colorMask / 部屋固有の霧 roomFog / 診断 uniform）と共有 envMap を持たせる。
 *   部屋別の上書き（fog / colorMask）は「glTF 材質 × externalOverridesKey」で LRU キャッシュする（materialFor）。
 * - ジオメトリ・テクスチャ・材質はカタログが保持し、部屋の dispose では破棄しない（RoomBuilder は clone したジオメトリだけ捨てる）。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { externalOverridesKey, type ExternalOverrides, type MaterialLibrary } from './MaterialLibrary';
import type { Vec3 } from '../core/types';

export type PropMount = 'floor' | 'wall' | 'ceiling';

export interface CatalogEntry {
  id: string;
  gltf: string;
  group: string;
  /** 実寸 [w, h, d]（yaw 0。wall は [壁に沿った幅, 高さ, 壁からの出]） */
  size: Vec3;
  triangles: number;
  /** 複数体入りモデルから使うノード名の正規表現 */
  part?: string;
  mount: PropMount;
}

export interface PropPart {
  geometry: THREE.BufferGeometry;
  /** 上書き無しの材質（adoptExternal 済み。上書き付きは PropCatalog.materialFor で取る） */
  material: THREE.Material;
  /** glTF の元材質（roughness 補正後。materialFor の clone 元。テクスチャの所有者） */
  source: THREE.Material;
}

export interface LoadedProp {
  entry: CatalogEntry;
  parts: PropPart[];
  /** 正規化後の実寸 */
  size: Vec3;
  triangles: number;
}

/** kind → 候補モデル（先頭ほど優先。RoomBuilder は箱に収まる候補から seed で選ぶ） */
export const PROP_KINDS: Record<string, string[]> = {
  chair: ['SchoolChair_01', 'plastic_monobloc_chair_01', 'dining_chair_02'],
  desk: ['metal_office_desk'],
  table: ['dining_table', 'modern_coffee_table_01', 'coffee_table_round_01'],
  cabinet: ['drawer_cabinet', 'modern_wooden_cabinet', 'vintage_wooden_drawer_01'],
  shelf: ['steel_frame_shelves_02', 'wooden_display_shelves_01', 'Shelf_01', 'worn_metal_rack'],
  sofa: ['sofa_02', 'modern_arm_chair_01', 'mid_century_lounge_chair'],
  plant: ['potted_plant_01', 'potted_plant_02', 'potted_plant_04', 'pachira_aquatica_01'],
  bin: ['metal_trash_can', 'trashbag'],
  extinguisher: ['korean_fire_extinguisher_01'],
  'sign.wetFloor': ['WetFloorSign_01'],
  crate: ['plastic_crate_01', 'plastic_crate_02', 'plastic_container'],
  box: ['cardboard_box_01'],
  cart: ['CoffeeCart_01', 'hand_truck'],
  laptop: ['classic_laptop'],
  papers: ['office_notepads', 'stationery_supplies', 'clipboard', 'binder_notebook'],
  clock: ['wall_clock'],
  camera: ['security_camera_01'],
  fireAlarm: ['fire_alarm'],
  tv: ['television_02', 'Television_01'],
  microwave: ['vintage_microwave'],
  ladder: ['ladder_sectioned_01', 'wooden_ladder'],
  lightFixture: ['mounted_fluorescent_lights', 'caged_hanging_light'],
  payphone: ['korean_public_payphone_01'],
  /** 駐車中の車（RoomBuilder が vehicle.id ごとに車体・窓・タイヤの箱をまとめた枠を作る。カバーを掛けた車で置き換える） */
  car: ['covered_car'],
  /** 対応モデル無し（箔のまま） */
  lockers: [],
  vending: [],
};

/**
 * 実際に置き換える kind（小物はノイズになるので大きな家具だけ。第15回で車 car・ブラウン管 tv を追加）。
 * 他の kind は PROP_KINDS に候補があっても箔のまま
 */
const REPLACED_KINDS = new Set(['chair', 'desk', 'table', 'cabinet', 'shelf', 'sofa', 'plant', 'car', 'tv']);

/** 長辺方向に複数体を並べる kind（机の列・棚・ソファ）。他は 1 箱 1 体 */
export const TILED_KINDS = new Set(['desk', 'table', 'shelf', 'cabinet', 'sofa', 'lockers']);

const MOUNT: Record<string, PropMount> = {
  wall_clock: 'wall',
  security_camera_01: 'wall',
  fire_alarm: 'wall',
  industrial_wall_lamp: 'wall',
  mounted_fluorescent_lights: 'ceiling',
  caged_hanging_light: 'ceiling',
  hanging_industrial_lamp: 'ceiling',
  ceiling_fan: 'ceiling',
};

/** 壊れた書き出し（steel_frame_shelves_01 は 11 × 21 m）などカタログから外す id */
const EXCLUDE = new Set(['steel_frame_shelves_01']);

/** 1 部屋あたりのプロップ三角形予算（high の値。Tier 別は propTriangleBudget）。超える候補は選ばない（軽い候補が無ければ箔のまま） */
export const PROP_TRIANGLE_BUDGET = 750_000;
/** Tier 別の予算（mid = スマホの既定。社員食堂の椅子 200 脚 × 3,356 三角形 = 67 万は high だけ全数が通る） */
export function propTriangleBudget(tier: 'low' | 'mid' | 'high'): number {
  return tier === 'high' ? PROP_TRIANGLE_BUDGET : tier === 'mid' ? 220_000 : 90_000;
}
/** 1 モデルの三角形上限（potted_plant_01 = 176k などは LOD / decimate 待ちで外す） */
export const PROP_MODEL_TRIANGLE_MAX = 90_000;
/** 上書き付き（fog / colorMask）プロップ材質の LRU 上限 */
const PROP_MATERIAL_VARIANTS_MAX = 128;

export class PropCatalog {
  private static _shared: PropCatalog | null = null;
  static get shared(): PropCatalog {
    if (!this._shared) this._shared = new PropCatalog();
    return this._shared;
  }

  /** `?props=0` で置換を無効化（A/B 計測用） */
  readonly enabled: boolean;
  private index: Map<string, CatalogEntry> | null = null;
  private indexPromise: Promise<void> | null = null;
  private readonly models = new Map<string, LoadedProp>();
  private readonly loading = new Map<string, Promise<LoadedProp | null>>();
  private readonly waiters = new Map<string, ((m: LoadedProp | null) => void)[]>();
  private readonly loader = new GLTFLoader();
  /** 材質の注入元（RoomBuilder が attach する。無ければ素の clone で描く = 焼き込み・霧・診断が効かない） */
  private library: MaterialLibrary | null = null;
  /** 「元材質 uuid | externalOverridesKey」→ 上書き付き材質（LRU） */
  private readonly variants = new Map<string, THREE.Material>();
  readonly errors: string[] = [];
  private readonly baseUrl: string;
  private ktx2Set = false;

  constructor(baseUrl = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/') {
    this.baseUrl = baseUrl;
    this.enabled = typeof location === 'undefined' || !/[?&]props=0(&|$)/.test(location.search);
  }

  /** 材質注入に使う MaterialLibrary を結び付ける（RoomBuilder のコンストラクタが呼ぶ。glTF 読込前に呼ぶこと） */
  attach(library: MaterialLibrary): void { this.library = library; }

  /** index.json の読込を開始（起動時に呼ぶ。最初の部屋の構築までに届けば置換が効く） */
  preload(): Promise<void> {
    if (this.indexPromise) return this.indexPromise;
    if (typeof fetch === 'undefined') { this.index = new Map(); return (this.indexPromise = Promise.resolve()); }
    this.indexPromise = fetch(`${this.baseUrl}cc0/models/index.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json: Record<string, Omit<CatalogEntry, 'id' | 'mount'>>) => {
        const map = new Map<string, CatalogEntry>();
        for (const [id, e] of Object.entries(json)) {
          if (EXCLUDE.has(id)) continue;
          if (!e.size || e.size.some((v) => !(v > 0))) continue;
          if ((e.triangles ?? 0) > PROP_MODEL_TRIANGLE_MAX) continue;
          map.set(id, { id, gltf: e.gltf, group: e.group, size: [e.size[0], e.size[1], e.size[2]], triangles: e.triangles ?? 0, part: e.part, mount: MOUNT[id] ?? 'floor' });
        }
        this.index = map;
      })
      .catch((err) => {
        this.errors.push(`index: ${String(err)}`);
        console.warn('[PropCatalog] index.json を読めません（箔のまま描きます）', err);
        this.index = new Map();
      });
    return this.indexPromise;
  }

  /** index が届いていて置換できる状態か（同期） */
  get ready(): boolean { return this.enabled && this.index !== null && this.index.size > 0; }

  entry(id: string): CatalogEntry | undefined { return this.index?.get(id); }

  /** kind の候補（index 未着なら空） */
  candidates(kind: string): CatalogEntry[] {
    if (!this.index || !REPLACED_KINDS.has(kind)) return [];
    const ids = PROP_KINDS[kind] ?? [];
    const out: CatalogEntry[] = [];
    for (const id of ids) { const e = this.index.get(id); if (e) out.push(e); }
    return out;
  }

  /** 読込済みモデル（同期。未読込なら undefined） */
  model(id: string): LoadedProp | undefined { return this.models.get(id); }

  /** 読込（重複呼び出しは同じ Promise）。失敗時は null */
  load(id: string): Promise<LoadedProp | null> {
    const cached = this.models.get(id);
    if (cached) return Promise.resolve(cached);
    let p = this.loading.get(id);
    if (p) return p;
    const entry = this.index?.get(id);
    if (!entry) return Promise.resolve(null);
    p = new Promise<LoadedProp | null>((resolve) => {
      // glTF のテクスチャは KTX2（KHR_texture_basisu。tools/build-cc0-models.mjs）。ローダーが無ければ JPEG の source を読む
      const ktx2 = this.library?.ktx2Loader;
      if (ktx2 && !this.ktx2Set) { this.loader.setKTX2Loader(ktx2); this.ktx2Set = true; }
      this.loader.load(
        `${this.baseUrl}cc0/${entry.gltf}`,
        (gltf) => {
          try {
            const m = this.normalize(entry, gltf.scene);
            this.models.set(id, m);
            resolve(m);
          } catch (err) {
            this.errors.push(`${id}: ${String(err)}`);
            console.warn(`[PropCatalog] ${id} の正規化に失敗`, err);
            resolve(null);
          }
        },
        undefined,
        (err) => {
          this.errors.push(`${id}: ${String((err as Error)?.message ?? err)}`);
          console.warn(`[PropCatalog] ${id} を読めません`, err);
          resolve(null);
        },
      );
    }).then((m) => {
      this.loading.delete(id);
      const ws = this.waiters.get(id);
      this.waiters.delete(id);
      if (ws) for (const w of ws) w(m);
      return m;
    });
    this.loading.set(id, p);
    return p;
  }

  /** 読込完了時に 1 回呼ぶ（既に読込済みなら同期で呼ぶ） */
  whenLoaded(id: string, cb: (m: LoadedProp | null) => void): void {
    const cached = this.models.get(id);
    if (cached) { cb(cached); return; }
    if (!this.waiters.has(id)) this.waiters.set(id, []);
    this.waiters.get(id)!.push(cb);
    void this.load(id);
  }

  /** ワールド変換をジオメトリに焼き、接地面を原点へ寄せる。材質は bakedLight 対応の clone */
  private normalize(entry: CatalogEntry, scene: THREE.Object3D): LoadedProp {
    scene.updateMatrixWorld(true);
    const part = entry.part ? new RegExp(entry.part) : null;
    const meshes: THREE.Mesh[] = [];
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      if (part && !part.test(o.name) && !part.test(o.parent?.name ?? '')) return;
      meshes.push(o);
    });
    if (!meshes.length) throw new Error('no mesh');
    const geos = meshes.map((m) => { const g = m.geometry.clone(); g.applyMatrix4(m.matrixWorld); return g; });
    const bounds = new THREE.Box3();
    for (const g of geos) { g.computeBoundingBox(); bounds.union(g.boundingBox!); }
    const c = bounds.getCenter(new THREE.Vector3());
    const shift = new THREE.Vector3(-c.x, -bounds.min.y, -c.z);
    if (entry.mount === 'wall') shift.set(-c.x, -c.y, -bounds.min.z);
    else if (entry.mount === 'ceiling') shift.set(-c.x, -bounds.max.y, -c.z);
    const materials = new Map<THREE.Material, { source: THREE.Material; material: THREE.Material }>();
    const parts: PropPart[] = [];
    let triangles = 0;
    meshes.forEach((m, i) => {
      const g = geos[i];
      g.translate(shift.x, shift.y, shift.z);
      // 未使用属性を落とす（InstancedMesh の clone コスト削減）
      for (const name of Object.keys(g.attributes)) if (!/^(position|normal|uv)$/.test(name)) g.deleteAttribute(name);
      g.computeBoundingBox();
      g.computeBoundingSphere();
      const src = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.Material;
      let mat = materials.get(src);
      if (!mat) { mat = this.adaptMaterial(src, entry.id); materials.set(src, mat); }
      parts.push({ geometry: g, material: mat.material, source: mat.source });
      triangles += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
    });
    const size = bounds.getSize(new THREE.Vector3());
    // Blender exports moving subparts as separate meshes; merge equal materials before instancing.
    const batches = new Map<THREE.Material, PropPart[]>();
    for (const p of parts) { const list=batches.get(p.source)??[];list.push(p);batches.set(p.source,list); }
    const compact: PropPart[]=[];
    for (const list of batches.values()) {
      if(list.length===1){compact.push(list[0]);continue;}
      const flat=list.map(p=>p.geometry.index?p.geometry.toNonIndexed():p.geometry.clone());
      const geometry=mergeGeometries(flat,false);flat.forEach(g=>g.dispose());
      if(!geometry){compact.push(...list);continue;}
      list.forEach(p=>p.geometry.dispose());geometry.computeBoundingBox();geometry.computeBoundingSphere();
      compact.push({...list[0],geometry});
    }
    return { entry, parts: compact, size: [size.x, size.y, size.z], triangles };
  }

  /**
   * glTF 材質を共有材質と同じ注入（bakedLight / colorMask / roomFog / 診断）付きにする。
   * source は glTF の材質そのもの（roughness 補正だけ施す。materialFor の clone 元）、material は上書き無しの adopt 結果
   */
  private adaptMaterial(src: THREE.Material, id: string): { source: THREE.Material; material: THREE.Material } {
    src.name = `prop/${id}/${src.name || 'material'}`;
    // 木・布の多いプロップは金属反射が強く見えやすいので roughness を少し上げる
    if (src instanceof THREE.MeshStandardMaterial && src.roughnessMap === null) src.roughness = Math.max(src.roughness, 0.5);
    return { source: src, material: this.adopt(src, undefined) };
  }

  private adopt(src: THREE.Material, overrides: ExternalOverrides | undefined): THREE.Material {
    if (this.library && src instanceof THREE.MeshStandardMaterial) {
      const m = this.library.adoptExternal(src, overrides);
      m.name = src.name;
      return m;
    }
    // MaterialLibrary 未接続 / 非 PBR 材質（KHR_materials_unlit など）は素の clone
    return src.clone();
  }

  /**
   * 部屋別上書き（fog / colorMask）付きの材質。上書きが無ければ part.material（共有）。
   * 「元材質 × 量子化キー」で LRU キャッシュし、部屋ごとに材質が増え続けないようにする（あふれた分は dispose。テクスチャは共有のまま残る）
   */
  materialFor(part: PropPart, overrides?: ExternalOverrides): THREE.Material {
    const key = externalOverridesKey(overrides);
    if (key === null || !this.library || !(part.source instanceof THREE.MeshStandardMaterial)) return part.material;
    const k = `${part.source.uuid}|${key}`;
    let m = this.variants.get(k);
    if (m) {
      this.variants.delete(k); this.variants.set(k, m); // LRU: 末尾へ
      return m;
    }
    m = this.adopt(part.source, overrides);
    m.name = `${part.source.name}|${key}`;
    this.variants.set(k, m);
    while (this.variants.size > PROP_MATERIAL_VARIANTS_MAX) {
      const [oldKey, old] = this.variants.entries().next().value as [string, THREE.Material];
      this.variants.delete(oldKey);
      old.dispose(); // GPU プログラムの参照を外すだけ（テクスチャは source が持つ）。使用中の Mesh は次の描画で再初期化される
    }
    return m;
  }

  /** 上書き付き材質の数（デバッグ表示） */
  get variantCount(): number { return this.variants.size; }

  /** 読込済みモデル数（デバッグ表示） */
  get loadedCount(): number { return this.models.size; }

  dispose(): void {
    for (const m of this.variants.values()) m.dispose();
    this.variants.clear();
    for (const m of this.models.values()) {
      for (const p of m.parts) {
        p.geometry.dispose();
        p.material.dispose();
        const mat = p.source as THREE.MeshStandardMaterial;
        for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'] as const) (mat[k] as THREE.Texture | null)?.dispose();
        mat.dispose();
      }
    }
    this.models.clear();
  }
}
