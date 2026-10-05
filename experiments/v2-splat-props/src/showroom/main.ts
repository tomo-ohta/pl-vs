/**
 * スプラットの見本の部屋（入口: index.html）。
 *
 * - v2 の起動（client/main.ts）をそのまま使う。v2 の実験場（?lab=1。生成の世界を作らず、決めたフロアを読む）で起動し、
 *   読み込んだら見本の部屋のフロア（layout.ts）に読み替える。v2 のファイルは変えない
 * - 部屋の壁・床・家具は v2 と同じ箱と材質・焼き込み照明。「スプラットにする物」だけを形の関数で粒にする（light.ts）
 * - P: スプラット → 同じ形のメッシュ → v2 の箱（v2 がいま置く箱の作り）→ … の順に切り替える / N・B: 次・前の展示物の前へ移る
 * - `?rooms=service,carry` 作る部屋を絞る（確かめるとき用）/ `?nolock=1` v2 の Pointer Lock を使わない
 * - 開発用: window.showroom（展示物・部屋の粒・切り替え）。v2 の window.game・window.maps もそのまま
 */
import * as THREE from 'three';
import { SparkRenderer } from '@sparkjsdev/spark';
import { excludeFromOverridePasses } from '../../../../v2/client/render/OverridePassExclusion.ts';
import { buildShape } from '../../../../v2/client/views/carry/items.ts';
import { Parts } from '../../../../v2/client/views/carry/common.ts';
import type { ViewContext } from '../../../../v2/client/views/views.ts';
import type { BuiltFloor } from '../../../../v2/client/world/FloorBuilder.ts';
import type { MaterialLibrary } from '../../../../v2/client/render/MaterialLibrary.ts';
import type { CellLayout, FloorLayout } from '../../../../v2/core/world/layout.ts';
import { DEFAULT_SH_PARAMS, type ShParams } from '../sh.ts';
import { ShPool } from '../shPool.ts';
import { depthProxyMaterial, SplatLighting } from '../splatMaterial.ts';
import { buildShowroom, ROOM_NAMES, type Exhibit } from './layout.ts';
import { buildRoom, reshadeRoom, type BuildContext, type EnvSource, type RoomSplats } from './light.ts';
import { mountShowroomPanel } from './panel.ts';
import { MODES, type Mode } from './modes.ts';

interface ShowGame {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  materials: MaterialLibrary;
  readonly built: BuiltFloor | null;
  readonly sim: { floor: FloorLayout } | null;
  loadFloor(floor: FloorLayout, opts?: { saveKey?: string }): Promise<void>;
  teleport(pos: readonly [number, number, number], yaw: number): void;
}


export interface RoomState {
  id: string;
  name: string;
  state: 'waiting' | 'building' | 'ready' | 'failed';
  step: string;
  splats?: RoomSplats;
  error?: string;
}

/** 見本の部屋の状態（パネルが読む） */
export class ShowroomController {
  mode: Mode = 'splat';
  readonly params: ShParams = { ...DEFAULT_SH_PARAMS };
  readonly rooms = new Map<string, RoomState>();
  readonly exhibits: Exhibit[];
  /** 展示物ごとの v2 の箱・深さの代役のメッシュ */
  private readonly cmp = new Map<string, THREE.Mesh[]>();
  private readonly proxy = new Map<string, THREE.Mesh[]>();
  /** 持てる物の展示の v2 の見た目（v2 の buildShape で作った物） */
  private readonly v2obj = new Map<string, THREE.Object3D[]>();
  private readonly lighting = new SplatLighting();
  private readonly ctx: BuildContext;
  private readonly game: ShowGame;
  private readonly floor: FloorLayout;
  readonly spark: SparkRenderer;
  tourAt = -1;
  fps = 0;
  onChange: (() => void) | null = null;

  constructor(game: ShowGame, floor: FloorLayout, exhibits: Exhibit[]) {
    this.game = game;
    this.floor = floor;
    this.exhibits = exhibits;
    const touch = matchMedia('(pointer: coarse)').matches;
    if (touch) this.params.dirCount = 32;
    this.spark = new SparkRenderer({ renderer: game.renderer, accumExtSplats: true, enable2DGS: true });
    this.spark.name = 'splat-showroom:spark';
    game.scene.add(this.spark);
    // GTAO（法線・深度）などの scene.overrideMaterial で描く補助パスには入れない（深さは代役の箱が書く）
    excludeFromOverridePasses(this.spark);
    this.ctx = { renderer: game.renderer, pool: new ShPool(), lighting: this.lighting, params: this.params, env: this.findEnv(), materials: game.materials };
    for (const c of floor.cells) this.rooms.set(c.id, { id: c.id, name: ROOM_NAMES[c.id] ?? c.id, state: 'waiting', step: '' });
    this.collectMeshes();
    this.buildV2Shapes();
    this.apply();
    let last = 0;
    const loop = (now: number): void => {
      requestAnimationFrame(loop);
      if (last) { const dt = now - last; if (dt > 0 && dt < 1000) this.fps = this.fps ? this.fps * 0.9 + (1000 / dt) * 0.1 : 1000 / dt; }
      last = now;
      this.lighting.update(game, this.params.gloss, this.params.roughScale);
    };
    requestAnimationFrame(loop);
  }

  /** v2 の材質の環境マップ（部屋の映り込み）。強さは v2 の材質の envMapIntensity の中央値 */
  private findEnv(): EnvSource | null {
    let texture: THREE.Texture | null = null;
    const ks: number[] = [];
    for (const c of this.game.built?.cells.values() ?? []) {
      c.group.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (!m || Array.isArray(m) || !m.envMap || m.envMap.mapping !== THREE.CubeUVReflectionMapping) return;
        texture ??= m.envMap;
        ks.push(m.envMapIntensity);
      });
    }
    if (!texture || !ks.length) return null;
    ks.sort((a, b) => a - b);
    return { texture, intensity: ks[ks.length >> 1]! };
  }

  /** 区画の「出現型の隠し」の印から、v2 の箱（cmp:）と深さの代役（proxy:）のメッシュを受け取る（v2 の出現の処理には渡さない） */
  private collectMeshes(): void {
    for (const c of this.game.built?.cells.values() ?? []) {
      for (const [key, list] of [...c.reveal]) {
        const m = /^(cmp|proxy):(.+)$/.exec(key);
        if (!m) continue;
        c.reveal.delete(key);
        const map = m[1] === 'cmp' ? this.cmp : this.proxy;
        map.set(m[2]!, [...(map.get(m[2]!) ?? []), ...list]);
        if (m[1] === 'proxy') for (const mesh of list) mesh.material = depthProxyMaterial();
      }
    }
  }

  /** 持てる物の展示の v2 の見た目（v2 の buildShape。明るさは v2 の動く物と同じく区画の陰影の 1 点） */
  private buildV2Shapes(): void {
    const ctx = { materials: this.game.materials } as unknown as ViewContext;
    for (const e of this.exhibits) {
      if (!e.v2Shapes?.length) continue;
      const list: THREE.Object3D[] = [];
      const built = this.game.built?.cells.get(e.room);
      for (const s of e.v2Shapes) {
        const P = new Parts(ctx);
        buildShape(P, s.kind, s.half, s.mat, s.params, 0);
        const g = P.group;
        g.position.set(s.at[0], s.at[1], s.at[2]);
        g.rotation.y = s.yaw;
        const water = g.getObjectByName('water');
        if (water) water.position.y = -s.half[1] + 0.02 + Number(s.params.fill ?? 0) * s.half[1] * 1.7;
        const rgb = built?.lighting.on.sample([s.at[0], s.at[1], s.at[2]]) ?? [0.6, 0.6, 0.6];
        P.relight([rgb[0], rgb[1], rgb[2]]);
        (built?.group ?? this.game.scene).add(g);
        list.push(g);
      }
      this.v2obj.set(e.id, list);
    }
  }

  private neighbors(cell: CellLayout): CellLayout[] {
    const out: CellLayout[] = [];
    for (const p of this.floor.portals) {
      if (p.kind !== 'opening' || !p.cells.includes(cell.id)) continue;
      const other = this.floor.cells.find((c) => c.id === (p.cells[0] === cell.id ? p.cells[1] : p.cells[0]));
      if (other) out.push(other);
    }
    return out;
  }

  /** 部屋を順に粒にする（近い部屋から） */
  async buildAll(order: string[]): Promise<void> {
    for (const id of order) {
      const cell = this.floor.cells.find((c) => c.id === id);
      const st = this.rooms.get(id);
      if (!cell || !st) continue;
      st.state = 'building';
      this.onChange?.();
      try {
        const list = this.exhibits.filter((e) => e.room === id);
        const r = await buildRoom(this.ctx, cell, this.neighbors(cell), list, (msg) => { st.step = msg; this.onChange?.(); });
        this.attachMesh(id, r.mesh);
        if (r.meshes) this.attachMesh(id, r.meshes.group);
        st.splats = r;
        st.state = 'ready';
        st.step = '';
        const m = r.meshes;
        console.info(`[showroom] ${st.name}: 展示物 ${list.length}・粒 ${r.batch.n.toLocaleString()}（つやあり ${r.glossy.toLocaleString()}）・形 ${r.ms.gen.toFixed(0)} ms（うちメッシュの曲面 ${r.ms.meshGen.toFixed(0)} ms）・焼き込み ${r.ms.bake.toFixed(0)} ms・SH ${r.ms.sh.toFixed(0)} ms・計 ${r.ms.total.toFixed(0)} ms`
          + (m ? ` / メッシュ 三角形 ${m.triangles.toLocaleString()}・頂点 ${m.vertices.toLocaleString()}・テクスチャ ${m.pages.map((p) => `${p.w}×${p.h}`).join(' + ')}・${m.ms.toFixed(0)} ms` : ' / メッシュ 失敗'));
      } catch (e) {
        console.error('[showroom] 粒にできなかった', id, e);
        st.state = 'failed';
        st.error = String((e as Error)?.message ?? e);
      }
      this.apply();
      this.onChange?.();
    }
  }

  private attachMesh(room: string, mesh: THREE.Object3D): void {
    const group = this.game.built?.cells.get(room)?.group;
    (group ?? this.game.scene).add(mesh);
  }

  /** つや・粗さ・SH の段数を変えた: SH だけ計算し直す */
  async reshade(): Promise<void> {
    for (const st of this.rooms.values()) {
      const r = st.splats;
      if (!r) continue;
      const old = r.mesh;
      r.mesh = await reshadeRoom(this.ctx, r);
      this.attachMesh(st.id, r.mesh);
      old.removeFromParent();
      old.dispose();
    }
    this.apply();
    this.onChange?.();
  }

  setMode(mode: Mode): void {
    this.mode = mode;
    this.apply();
    this.onChange?.();
  }

  /** P: 次の表示へ */
  cycle(step = 1): void {
    this.setMode(MODES[(MODES.indexOf(this.mode) + step + MODES.length) % MODES.length]!);
  }

  /**
   * 見せ方: スプラット = 粒（と深さの代役）、メッシュ = 同じ形のメッシュ、v2 = v2 の箱。
   * まだ作れていない部屋（作れなかった部屋）は v2 の箱
   */
  private apply(): void {
    for (const e of this.exhibits) {
      const r = this.rooms.get(e.room);
      const ready = r?.state === 'ready';
      const splat = this.mode === 'splat' && ready;
      const mesh = this.mode === 'mesh' && ready && !!r?.splats?.meshes;
      for (const m of this.cmp.get(e.id) ?? []) m.visible = !splat && !mesh;
      for (const o of this.v2obj.get(e.id) ?? []) o.visible = !splat && !mesh;
      for (const m of this.proxy.get(e.id) ?? []) m.visible = splat;
    }
    for (const st of this.rooms.values()) {
      if (!st.splats) continue;
      st.splats.mesh.visible = this.mode === 'splat';
      if (st.splats.meshes) st.splats.meshes.group.visible = this.mode === 'mesh';
    }
  }

  /** 展示物の前へ移る（見る点の方を向く） */
  goTo(index: number): void {
    const n = this.exhibits.length;
    this.tourAt = ((index % n) + n) % n;
    const e = this.exhibits[this.tourAt]!;
    const [x, , z] = e.view.pos;
    const t = e.view.target;
    const dx = t[0] - x, dz = t[2] - z, dy = t[1] - 1.6;
    const yaw = Math.atan2(-dx, -dz);
    const pitch = Math.atan2(dy, Math.hypot(dx, dz));
    this.game.teleport([x, 0.02, z], yaw);
    const g = this.game as unknown as { yaw: number; pitch: number };
    g.yaw = yaw;
    g.pitch = Math.max(-1.2, Math.min(1.2, pitch));
    this.onChange?.();
  }

  /** 展示物の粒の数 */
  splatsOf(e: Exhibit): number {
    const r = this.rooms.get(e.room)?.splats?.ranges.get(e.id);
    return r ? r[1] - r[0] : 0;
  }

  /** 展示物の同じ形のメッシュの三角形の数 */
  trianglesOf(e: Exhibit): number {
    return this.rooms.get(e.room)?.splats?.meshes?.trianglesOf.get(e.id) ?? 0;
  }
}

// ---------------------------------------------------------------- 起動

// v2 を実験場の指定で起動する（生成の世界を作らない）
const url = new URL(location.href);
if (!url.searchParams.has('lab')) {
  url.searchParams.set('lab', '1');
  history.replaceState(history.state, '', url);
}
await import('../../../../v2/client/main.ts');

const w = window as unknown as { game: ShowGame; maps: { setFloor(f: FloorLayout, r: null, m: { world: number; depth: number; variant: number; name?: string }): void }; showroom: ShowroomController };
const game = w.game;
const { floor, exhibits } = buildShowroom();
await game.loadFloor(floor);
if (game.sim) w.maps.setFloor(game.sim.floor, null, { world: 1, depth: 0, variant: 0, name: 'スプラットの見本' });

const show = new ShowroomController(game, floor, exhibits);
w.showroom = show;
mountShowroomPanel(show);
// ?rooms=service,carry で作る部屋を絞る（確かめるとき用。他の部屋は v2 の箱のまま）
const only = url.searchParams.get('rooms')?.split(',').filter(Boolean);
void show.buildAll(['hall', 'library', 'store', 'bedroom', 'restroom', 'service', 'carry'].filter((id) => !only || only.includes(id)));
