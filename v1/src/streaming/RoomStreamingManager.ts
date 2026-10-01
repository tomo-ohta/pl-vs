/**
 * 現在 Room + 1 hop を 3D 化し、それ以外を dispose する。扉の自動閉扉もここで駆動する。
 *
 * v1.3: BuiltRoom.chunks（巨大部屋のチャンク表示切替）/ effects（Modifier のランタイム効果）/ dynamicColliders（可動要素）を扱う。
 * - `setTier(tier)`: Game.setTier から。RoomBuilder の Tier（instances 個数・particles 上限・decals）を切り替える
 * - `updateChunks(cameraPos, maxDist)`: 毎フレーム。多チャンク部屋だけ距離で chunk.group.visible を切り替える
 * - `updateEffects(dt, ctxOf)`: 毎フレーム。可視部屋の effects を更新する（ctxOf は部屋ごとの RuntimeContext を返す）
 * - `updateDoors(dt, now, playerPos, onDoorClosed?)`: 扉が閉じ切ったフレームに 1 回だけ通知（閉扉音）
 * - `colliders(ids)`: 静的コライダ + 閉じた扉 + solid な dynamicColliders
 * - dispose は RoomBuilder.dispose が effects.dispose も行う
 */
import * as THREE from 'three';
import { updateLightBudget, ShadowSlots, type ShadowSlotEntry } from '../render/LightBudget';
import type { AABB } from '../core/aabb';
import { QUALITY_TIERS, type QualityTier, type Vec3 } from '../core/types';
import type { MatId } from '../generators/layout';
import { RoomBuilder, type BuiltRoom, type DoorObject, type RoomBuildJob } from '../render/RoomBuilder';
import { L2_FLAGS } from '../render/MaterialLibrary';
import type { RuntimeContext } from '../modifiers/types';
import type { WorldManager } from '../world/WorldManager';

export type DoorClosedCallback = (roomId: string, portalId: string, center: Vec3, doorMat: MatId) => void;

export class RoomStreamingManager {
  readonly built = new Map<string, BuiltRoom>();
  /** このフレームで扉の状態が変わった（可視性の再計算用） */
  doorsChanged = false;
  private readonly colliderCache: AABB[] = [];
  /**
   * 可視 PointLight の本数を Tier の上限で一定に保つダミー（intensity 0、遠方）。
   * three.js は可視ライト数（numPointLights）をプログラムキーに含めるため、本数が変わるたびに画面内の全材質を再コンパイルする。
   * 実ライトが不足する分をダミーで埋めて、構成の変化を Tier 変更時の 1 回だけにする
   */
  private readonly padLights: THREE.PointLight[] = [];
  /**
   * 影スロット: 可視 PointLight のうちプレイヤーに近い tier.shadowLights 灯だけ castShadow（V04 手順 7 の影版。
   * 距離のヒステリシス + 保持時間 + shadow.intensity のフェードで受け渡し、影を落とす本数は途中で増えない）。
   * three.js は numPointLightShadows もプログラムキーに含めるので、本数はダミーで Tier の値に固定する（padVisibleLights）
   */
  private readonly shadowSlots = new ShadowSlots<THREE.PointLight>({ hysteresis: 0.6, holdSec: 0.4, fadeSec: 0.35 });
  private shadowMapSize = 0;

  constructor(private readonly scene: THREE.Scene, private readonly builder: RoomBuilder, private readonly world: WorldManager) {}

  /** 影を落としている実ライトの数（デバッグ HUD） */
  get shadowCount(): number { return this.shadowSlots.holders.length; }

  /** 構築した部屋の累計（同期 + 後回し）。部屋切り替えの計測（Game.switchProfiler）が読む */
  buildCount = 0;
  /** 後回し構築のうち複数フレームに分割したものの累計 */
  splitBuildCount = 0;

  /** 品質 Tier の変更（構築済みの部屋は変わらない。次に build される部屋から効く） */
  setTier(tier: QualityTier): void {
    this.builder.setTier(tier);
  }

  ensure(roomId: string): BuiltRoom | null {
    let b = this.built.get(roomId);
    if (b) return b;
    const node = this.world.graph.get(roomId);
    if (!node.placement) return null;
    // 分割構築の途中なら残りを一気に進める（作り直さない）
    if (this.job && this.job.roomId === roomId) {
      const job = this.job;
      this.job = null;
      b = job.run();
      if (job.frames > 1) this.splitBuildCount++;
    } else {
      b = this.builder.build(node, this.world.layoutFor(node));
    }
    this.adopt(b);
    return b;
  }

  /** 構築した部屋を scene と built に入れ、シェーダの非同期コンパイル待ちにする */
  private adopt(b: BuiltRoom): void {
    this.scene.add(b.group);
    this.scene.add(b.doorGroup);
    this.built.set(b.roomId, b);
    this.adoptedAt.set(b.roomId, performance.now());
    this.compiled.delete(b.roomId);
    this.uncompiled.push(b);
    this.buildCount++;
  }

  /** 後回しで構築する部屋（閉じた扉の先など、いま見えない隣接部屋）。入室時のフリーズを分散させる */
  private readonly pending: string[] = [];
  /** 分割構築の途中の部屋（担当 L2。1 つだけ。buildPending が毎フレーム進める） */
  private job: RoomBuildJob | null = null;
  /** 構築済みでまだシェーダをコンパイルしていない部屋 */
  private readonly uncompiled: BuiltRoom[] = [];
  /** 非同期コンパイルが終わった部屋（isCompiled）。初めて見える瞬間の同期コンパイル待ちを避けるため、Game は扉の保留と表示に使う */
  private readonly compiled = new Set<string>();
  private readonly adoptedAt = new Map<string, number>();
  /** コンパイルが終わった部屋が増えた（Game が updateVisibility をやり直す）。consumeCompiled で読むと false に戻る */
  private compiledChanged = false;
  /** コンパイル完了を待つ上限（ms）。KHR_parallel_shader_compile の無い環境・コンテキスト喪失でも部屋が出なくならないように */
  static COMPILE_WAIT_MAX_MS = 2000;

  /** 部屋のシェーダの非同期コンパイルが終わったか（または待ちの上限を過ぎたか）。未構築なら false */
  isCompiled(roomId: string): boolean {
    if (!this.built.has(roomId)) return false;
    if (this.compiled.has(roomId)) return true;
    const at = this.adoptedAt.get(roomId);
    return at === undefined || performance.now() - at > RoomStreamingManager.COMPILE_WAIT_MAX_MS;
  }

  consumeCompiled(): boolean {
    const c = this.compiledChanged;
    this.compiledChanged = false;
    return c;
  }
  /**
   * 後回し構築に 1 フレームで使う時間（ms）。分割構築はこの予算で中断し次のフレームに続ける（箱 1,900 個の食堂 = 660 ms が
   * 約 30 フレームに分かれる）。見えている部屋の同期構築（ensure）には効かない
   */
  static BUILD_BUDGET_MS = 24;

  enqueue(roomId: string): void {
    if (this.built.has(roomId) || this.pending.includes(roomId) || this.job?.roomId === roomId) return;
    this.pending.push(roomId);
  }

  /**
   * 後回し構築の先頭へ回す（扉を開ける直前・見えるようになった部屋）。構築済み・分割構築の途中なら何もしない
   * （途中の部屋は次のフレームで続きから進む）
   */
  prioritize(roomId: string): void {
    if (this.built.has(roomId) || this.job?.roomId === roomId) return;
    const i = this.pending.indexOf(roomId);
    if (i >= 0) this.pending.splice(i, 1);
    this.pending.unshift(roomId);
  }

  /** 構築済みか、分割構築の途中・後回しの待ちにあるか */
  isBuiltOrQueued(roomId: string): boolean {
    return this.built.has(roomId) || this.job?.roomId === roomId || this.pending.includes(roomId);
  }

  /** keep に無い保留を取り消す（分割構築の途中も捨てる） */
  dropPending(keep: Set<string>): void {
    for (let i = this.pending.length - 1; i >= 0; i--) if (!keep.has(this.pending[i])) this.pending.splice(i, 1);
    if (this.job && !keep.has(this.job.roomId)) this.cancelJob();
  }

  get pendingCount(): number { return this.pending.length + (this.job ? 1 : 0); }

  /** 構築待ち（後回し + 分割構築の途中）の部屋 id。Game.enterRoom が frozen（新しい開口を追加しない部屋）に含める */
  get pendingIds(): string[] { return this.job ? [...this.pending, this.job.roomId] : [...this.pending]; }

  /** 分割構築の途中の部屋 id（デバッグ表示） */
  get buildingRoomId(): string | null { return this.job?.roomId ?? null; }

  private cancelJob(): void {
    if (!this.job) return;
    this.job.cancel();
    this.job = null;
  }

  /**
   * 保留中の部屋を budgetMs の範囲で構築する。分割構築（L2_FLAGS.split）では大きな部屋を複数フレームに分けて進め、
   * 予算を過ぎたら次の中断点で戻る（従来は最低 1 部屋を一気に構築していた）。構築を完了した数を返す
   */
  buildPending(budgetMs: number): number {
    const deadline = performance.now() + budgetMs;
    let n = 0;
    for (;;) {
      if (!this.job) {
        let id: string | undefined;
        while ((id = this.pending.shift()) !== undefined) {
          if (this.built.has(id)) continue;
          const node = this.world.graph.nodes.get(id);
          if (!node?.placement) continue;
          break;
        }
        if (id === undefined) break;
        if (!L2_FLAGS.split) {
          this.ensure(id);
          n++;
          if (performance.now() >= deadline) break;
          continue;
        }
        const node = this.world.graph.get(id);
        this.job = this.builder.beginBuild(node, this.world.layoutFor(node));
      }
      if (!this.job.step(deadline)) break; // 予算切れ。次のフレームで続ける
      const job = this.job;
      this.job = null;
      const b = job.built;
      if (!b) continue;
      if (job.frames > 1) this.splitBuildCount++;
      if (this.built.has(b.roomId)) { this.builder.dispose(b); continue; } // 途中で同期構築された（起きない想定）
      this.adopt(b);
      n++;
      if (performance.now() >= deadline) break;
    }
    return n;
  }

  /**
   * 新しく構築した部屋の材質シェーダを非同期にコンパイルする（KHR_parallel_shader_compile）。
   * 呼ばないと、扉を開けて部屋が初めて画面に入った瞬間に数十〜数百 ms のコンパイル停止が起きる。
   * renderer.compile は traverseVisible なので、非表示の部屋は一時的に表示状態にして走らせる。
   * 実際の描画と同じプログラムにするため（担当 L2。docs/perf-room-switch.md）:
   * - renderTarget: EffectComposer 使用時は RenderPass が RenderTarget へ描くので、トーンマップ無し・線形出力のプログラムになる。
   *   compile を RenderTarget を束縛したまま走らせないと、直接描画用（AgX・sRGB）の別プログラムを作るだけで初回描画の停止は残る
   * - 部屋のライトは compile の間だけ非表示にする（compile は targetScene と対象の両方を辿るので、可視ライトが二重に数えられ
   *   numPointLights / numPointLightShadows が実描画と食い違う）
   */
  precompile(renderer: THREE.WebGLRenderer, camera: THREE.Camera, renderTarget: THREE.WebGLRenderTarget | null = null, tier: QualityTier = QUALITY_TIERS.high): void {
    if (!this.uncompiled.length) return;
    const list = this.uncompiled.splice(0, this.uncompiled.length);
    this.compileWith(renderer, renderTarget, tier, () => {
      for (const b of list) {
        if (!this.built.has(b.roomId)) continue;
        const vis = [b.group.visible, b.doorGroup.visible];
        b.group.visible = true;
        b.doorGroup.visible = true;
        try {
          const done = Promise.allSettled([renderer.compileAsync(b.group, camera, this.scene), renderer.compileAsync(b.doorGroup, camera, this.scene)]);
          void done.then(() => {
            if (this.built.get(b.roomId) !== b) return; // 途中で作り直された / 捨てられた
            this.compiled.add(b.roomId);
            this.compiledChanged = true;
          });
        } catch {
          this.compiled.add(b.roomId); // WebGL コンテキスト喪失など。待たない
        }
        b.group.visible = vis[0];
        b.doorGroup.visible = vis[1];
      }
    });
  }

  /**
   * compile の間だけ、描画条件を実描画の定常状態に固定して fn を走らせる（Game.precompileAhead と precompile が使う）:
   * - renderTarget（composer 使用時）を束縛（トーンマップ無し・線形出力のプログラムになる）
   * - 部屋の実ライトを全て非表示にし、ダミーライトを tier.maxLights 本（castShadow は先頭 tier.shadowLights 本）だけ表示する。
   *   compile は scene と対象の両方を traverseVisible するので実ライトが二重に数えられること、影スロットの受け渡し中は
   *   castShadow のライトが 0 本になる瞬間があること、newWorld 直後はダミーがまだ無いことから、そのまま compile すると
   *   numPointLights / numPointLightShadows の違う無駄なプログラムになる
   */
  compileWith(renderer: THREE.WebGLRenderer, renderTarget: THREE.WebGLRenderTarget | null, tier: QualityTier, fn: () => void): void {
    const prevTarget = renderer.getRenderTarget();
    if (renderTarget) renderer.setRenderTarget(renderTarget);
    this.ensurePadLights(tier.maxLights);
    const saved: [THREE.Light, boolean][] = [];
    for (const b of this.built.values()) for (const l of b.lights) { saved.push([l, l.visible]); l.visible = false; }
    const pads = this.padLights.map((l) => [l.visible, l.castShadow] as [boolean, boolean]);
    this.padLights.forEach((l, i) => { l.visible = i < tier.maxLights; l.castShadow = i < tier.shadowLights; });
    try {
      fn();
    } finally {
      for (const [l, v] of saved) l.visible = v;
      this.padLights.forEach((l, i) => { l.visible = pads[i][0]; l.castShadow = pads[i][1]; });
      if (renderTarget) renderer.setRenderTarget(prevTarget);
    }
  }

  /** 部屋を捨てる前に: 影スロットから外して影マップを解放する */
  private forgetRoom(b: BuiltRoom): void {
    for (const l of b.lights) if ((l as THREE.PointLight).isPointLight) this.shadowSlots.forget(l as THREE.PointLight, releaseShadowMap);
  }

  /** 最後に keep に入っていた時刻（LRU 用） */
  private readonly lastUsed = new Map<string, number>();
  private tick = 0;
  /** keep 外の部屋をこの数・三角形数まで保持する（隣接を行き来したときの再構築 = 数百 ms のフリーズを避ける） */
  static PARK_MAX_ROOMS = 8;
  static PARK_MAX_TRIANGLES = 2_000_000;

  /**
   * keep に無い部屋は即 dispose せず、非表示のまま予算内で保持する（updateVisibility が見えない部屋を隠す）。
   * 予算を超えた分だけ、最後に使われたのが古い順に dispose する
   */
  disposeExcept(keep: Set<string>): void {
    this.tick++;
    for (const id of keep) if (this.built.has(id)) this.lastUsed.set(id, this.tick);
    const parked = [...this.built].filter(([id]) => !keep.has(id)).sort((a, b) => (this.lastUsed.get(a[0]) ?? 0) - (this.lastUsed.get(b[0]) ?? 0));
    let count = parked.length;
    let tris = parked.reduce((n, [, b]) => n + b.triangles, 0);
    for (const [id, b] of parked) {
      if (count <= RoomStreamingManager.PARK_MAX_ROOMS && tris <= RoomStreamingManager.PARK_MAX_TRIANGLES) break;
      this.evict(id);
      count--;
      tris -= b.triangles;
    }
  }

  /** 部屋を即 dispose する（レイアウトが変わった保持中の部屋など） */
  evict(roomId: string): void {
    if (this.job?.roomId === roomId) this.cancelJob();
    const b = this.built.get(roomId);
    if (!b) return;
    this.forgetRoom(b);
    this.builder.dispose(b);
    this.built.delete(roomId);
    this.lastUsed.delete(roomId);
    const i = this.uncompiled.indexOf(b);
    if (i >= 0) this.uncompiled.splice(i, 1);
  }

  /** レイアウトが変わった部屋を作り直す */
  rebuild(roomId: string): void {
    if (this.job?.roomId === roomId) this.cancelJob();
    const b = this.built.get(roomId);
    if (!b) return;
    this.forgetRoom(b);
    this.builder.dispose(b);
    this.built.delete(roomId);
    this.ensure(roomId);
  }

  /** 対象部屋群のコライダ（閉じた扉・solid な可動要素を含む） */
  colliders(roomIds: Iterable<string>): AABB[] {
    this.colliderCache.length = 0;
    for (const id of roomIds) {
      const b = this.built.get(id);
      if (!b) continue;
      for (const c of b.colliders) this.colliderCache.push(c);
      for (const d of b.doors.values()) {
        if (d.portal.isReturn && d.portal.targetRoomId && this.built.has(d.portal.targetRoomId)) continue;
        if (d.angle < 0.5) this.colliderCache.push(d.collider);
      }
      for (const dc of b.dynamicColliders) if (dc.solid) this.colliderCache.push(dc.aabb);
    }
    return this.colliderCache;
  }

  allDoors(): DoorObject[] {
    const out: DoorObject[] = [];
    for (const b of this.built.values()) for (const d of b.doors.values()) out.push(d);
    return out;
  }

  /** インタラクト対象（保持中の非表示部屋は除く） */
  interactables(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const b of this.built.values()) if (b.group.visible) out.push(...b.interactables);
    return out;
  }

  /** 部屋のゾーン（ワールド AABB）。無ければ空配列 */
  zonesOf(roomId: string): BuiltRoom['zones'] {
    return this.built.get(roomId)?.zones ?? [];
  }

  /** 扉アニメーションと自動閉扉。戻り値は自動で閉じた（開閉状態が変わった）扉の数。onDoorClosed は角度が 0 に到達したフレームで 1 回 */
  updateDoors(dt: number, now: number, playerPos: THREE.Vector3, onDoorClosed?: DoorClosedCallback): number {
    let closed = 0;
    this.doorsChanged = false;
    for (const d of this.allDoors()) {
      const p = d.portal;
      if (p.isReturn) {
        // 戻り側パネルは所有側の開閉状態に追従するだけ
        const owner = p.targetRoomId ? this.world.graph.nodes.get(p.targetRoomId) : undefined;
        const target = owner ? (this.world.portalOpen(owner, p) ? 1 : 0) : 0;
        if (d.angle !== target) {
          this.doorsChanged = true;
          d.angle += Math.sign(target - d.angle) * Math.min(Math.abs(target - d.angle), dt * 2.2);
          d.pivot.rotation.y = -d.angle * (Math.PI / 2) * 0.95;
        }
        continue;
      }
      if (p.open && p.passedAt !== undefined && now - p.passedAt > p.closeDelaySec) {
        const dist = Math.hypot(playerPos.x - d.center[0], playerPos.z - d.center[2]);
        if (dist > 1.2) {
          p.open = false;
          p.passedAt = undefined;
          closed++;
        }
      }
      const target = p.open ? 1 : 0;
      if (d.angle !== target) {
        this.doorsChanged = true;
        const before = d.angle;
        d.angle += Math.sign(target - d.angle) * Math.min(Math.abs(target - d.angle), dt * 2.2);
        d.pivot.rotation.y = -d.angle * (Math.PI / 2) * 0.95;
        if (before > 0 && d.angle === 0 && onDoorClosed) {
          const owner = this.ownerOf(d);
          onDoorClosed(owner, p.portalId, d.center, this.built.get(owner)?.layout.palette.door ?? 'doorWood');
        }
      }
    }
    return closed;
  }

  /** DoorObject を所有する部屋 id（doorGroup 名 '<roomId>/doors' から） */
  private ownerOf(d: DoorObject): string {
    const name = d.root.parent?.name ?? '';
    const i = name.indexOf('/doors');
    return i > 0 ? name.slice(0, i) : '';
  }

  /** 巨大部屋のチャンク表示切替（1 チャンクの部屋は何もしない）。maxDist は Tier の fogFar + chunkSize 程度 */
  updateChunks(cameraPos: THREE.Vector3, maxDist: number): void {
    for (const b of this.built.values()) {
      if (!b.group.visible || b.chunks.length <= 1) continue;
      RoomBuilder.updateChunkVisibility(b, cameraPos, maxDist + (b.layout.chunkSize ?? 28));
    }
  }

  /** Modifier のランタイム効果（BuiltRoom.effects）を可視部屋について更新する */
  updateEffects(dt: number, ctxOf: (roomId: string, built: BuiltRoom) => RuntimeContext | null): void {
    for (const [id, b] of this.built) {
      if (!b.group.visible || b.effects.length === 0) continue;
      const ctx = ctxOf(id, b);
      if (!ctx) continue;
      for (const e of b.effects) {
        try {
          e.update(dt, ctx);
        } catch (err) {
          console.warn(`[effects] ${id} update failed`, err);
        }
      }
    }
  }

  /**
   * 現在部屋を中心に、近いライトから tier.maxLights 個だけ点灯（非表示チャンク内のライトは候補から外す）。
   * 点灯中の PointLight のうち近い tier.shadowLights 灯に影スロットを割り当てる
   */
  updateLights(playerPos: THREE.Vector3, tier: QualityTier, dt = 1 / 60): void {
    const all: { light: THREE.PointLight | THREE.SpotLight; d: number }[] = [];
    const wp = new THREE.Vector3();
    for (const b of this.built.values()) {
      if (!b.group.visible) { for (const l of b.lights) { l.visible = false; l.intensity = 0; } continue; }
      for (const l of b.lights) {
        if (b.chunks.length > 1 && l.parent && l.parent !== b.group && !l.parent.visible) { l.visible = false; l.intensity = 0; continue; }
        l.getWorldPosition(wp);
        all.push({ light: l, d: wp.distanceToSquared(playerPos) });
      }
    }
    const desired = updateLightBudget(all, tier.maxLights, dt);
    let visible = 0;
    const shadowEntries: ShadowSlotEntry<THREE.PointLight>[] = [];
    for (const e of all) {
      if (!e.light.visible) continue;
      visible++;
      if ((e.light as THREE.PointLight).isPointLight) shadowEntries.push({ light: e.light as THREE.PointLight, d: e.d, lit: desired.has(e.light) });
    }
    this.shadowMapSize = tier.shadowMapSize;
    this.shadowSlots.update(shadowEntries, tier.shadowLights, dt, (l) => this.setupShadow(l), releaseShadowMap);
    this.padVisibleLights(visible, tier.maxLights, this.shadowSlots.holders.length, tier.shadowLights, shadowEntries.map((e) => e.light));
  }

  /** 影スロットを得たライトの影パラメータ（castShadow を立てる直前） */
  private setupShadow(l: THREE.PointLight): void {
    const s = l.shadow;
    const size = Math.max(64, this.shadowMapSize);
    // three.js は PointLight のキューブ影マップの寸法変更を追わないので、Tier が変わっていたら捨てて作り直させる
    if (s.map && s.mapSize.x !== size) releaseShadowMap(l);
    s.mapSize.set(size, size);
    s.camera.near = 0.3; // far は three が light.distance に合わせる（PointLightShadow）
    s.camera.updateProjectionMatrix();
    s.bias = -0.004;
    s.normalBias = 0.04;
    s.radius = 1.5;
    s.autoUpdate = true;
  }

  /**
   * 可視ライト数が limit に満たない分をダミーで埋める（limit を超えるダミーは作らない）。
   * 影を落とす本数も shadowLimit に固定する: 実ライトの影が不足する分はダミーに castShadow を立てる
   * （16 px のキューブ影マップを最初の 1 回だけ描き、以後は更新しない。intensity 0 なので寄与は無い）
   */
  private padVisibleLights(realVisible: number, limit: number, realShadow: number, shadowLimit: number, realPoints: THREE.PointLight[] = []): void {
    this.ensurePadLights(limit);
    const need = Math.max(0, limit - realVisible);
    const needShadow = Math.max(0, Math.min(need, shadowLimit - realShadow));
    for (let i = 0; i < this.padLights.length; i++) {
      this.padLights[i].visible = i < need;
      this.padLights[i].castShadow = i < needShadow;
    }
    // 実ライトで本数の上限が埋まっていて影スロットが空いている（受け渡しの途中・影の候補が遠い）と、ダミーで影の本数を補えず
    // numPointLightShadows が 1 → 0 に変わり、見えている全材質のプログラムが作り直される（1 回 90〜250 ms の停止）。
    // その間だけ、影を持たない可視の実ライトに影の濃さ 0 の castShadow を貸して本数を保つ（見た目は変わらない）
    let deficit = shadowLimit - realShadow - needShadow;
    const holders = this.shadowSlots.holders;
    const next = new Set<THREE.PointLight>();
    if (deficit > 0) {
      // 借りているライトを先に使い続ける（毎フレームの付け外しと影マップの作り直しを避ける）
      const order = [...realPoints.filter((l) => this.borrowedShadow.has(l)), ...realPoints.filter((l) => !this.borrowedShadow.has(l))];
      for (const l of order) {
        if (deficit <= 0) break;
        if (holders.includes(l) || (l.castShadow && !this.borrowedShadow.has(l))) continue;
        if (!this.borrowedShadow.has(l)) this.setupShadow(l);
        l.shadow.intensity = 0;
        l.castShadow = true;
        next.add(l);
        deficit--;
      }
    }
    for (const l of this.borrowedShadow) {
      if (next.has(l) || holders.includes(l)) continue; // 影スロットを得たライトは LightBudget に任せる
      l.castShadow = false;
      releaseShadowMap(l);
    }
    this.borrowedShadow = next;
  }

  /** padVisibleLights が影の本数を保つために castShadow を貸している実ライト */
  private borrowedShadow = new Set<THREE.PointLight>();

  /** ダミーライトを limit 本まで作る（scene に入れる） */
  private ensurePadLights(limit: number): void {
    while (this.padLights.length < limit) {
      const l = new THREE.PointLight(0xffffff, 0, 0.01, 2);
      l.position.set(0, -1e4, 0);
      l.visible = false;
      l.matrixAutoUpdate = false;
      l.updateMatrix();
      l.shadow.mapSize.set(16, 16);
      l.shadow.autoUpdate = false;
      l.shadow.needsUpdate = true;
      this.scene.add(l);
      this.padLights.push(l);
    }
  }

  stats(): { rooms: number; triangles: number; chunks: number; effects: number; pending: number; building: string | null } {
    let t = 0;
    let c = 0;
    let e = 0;
    for (const b of this.built.values()) { t += b.triangles; c += b.chunks.length; e += b.effects.length; }
    return { rooms: this.built.size, triangles: t, chunks: c, effects: e, pending: this.pending.length, building: this.job?.roomId ?? null };
  }

  clear(): void {
    this.pending.length = 0;
    this.cancelJob();
    this.uncompiled.length = 0;
    for (const b of this.built.values()) { this.forgetRoom(b); this.builder.dispose(b); }
    this.built.clear();
    this.shadowSlots.clear(releaseShadowMap);
    // ダミーライトも scene から外す（newWorld / loadWorld で Manager が作り直されるため、残すと可視本数が上限を超える）
    for (const l of this.padLights) { releaseShadowMap(l); this.scene.remove(l); }
    this.padLights.length = 0;
  }
}

/** 影マップ（キューブ RT + 深度テクスチャ）を解放する。RoomBuilder.dispose は light.shadow.map を見ないのでここで捨てる */
function releaseShadowMap(l: THREE.PointLight): void {
  const m = l.shadow.map;
  if (!m) return;
  m.depthTexture?.dispose();
  m.dispose();
  l.shadow.map = null;
}
