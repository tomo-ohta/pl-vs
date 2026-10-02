/**
 * シミュレーション本体: 1 フロアを固定 tick で進める（v2-plan.md 6.3・継承計画 2 章）。
 *
 * 1 tick の順番:
 *   1. 調べる操作（E / タップ）を、視線の先の部品に当てる
 *   2. 部品の step（配線の順。感じる部品は前の tick のプレイヤーを見る）
 *   3. プレイヤーの移動（静的な箱 + 部品が置いた動く箱・ゾーン・面）
 *   4. 物理（プレイヤーの箱を合わせてから 1 step）→ 部品の post（剛体の位置を状態に写す）
 *   5. 落下の戻し・フロアの出口
 * 起きたことは events に溜まり、クライアントが drainEvents() で受け取って音と演出にする。
 *
 * 状態（プレイヤー・部品の状態と出力・現れた隠し）は JSON にできる値だけで、snapshot() でまとめて取り出せる。
 * 決定論: 乱数は seed と部品 id と tick から作る（Math.random を使わない）。
 */
import { aabbExpand, rayAabb, type AABB } from '../math/aabb.ts';
import { hashAll, Rng } from '../math/rng.ts';
import type { Vec3 } from '../math/vec.ts';
import type { Tuning } from '../config/tuning.ts';
import type { PhysicsWorld } from '../physics/world.ts';
import { PASSABLE_VEGETATION, type EntitySpec, type FloorExit, type FloorLayout, type InputWire, type SupportSurface, type Zone } from '../world/layout.ts';
import { ColliderIndex } from './collision.ts';
import { partDef, type PartContext, type PartDef, type PartState } from './part.ts';
import { createPlayer, PLAYER, playerEye, playerHeight, playerLook, stepPlayer, type PlayerWorld } from './player.ts';
import type { InputCommand, PlayerState, SimEvent } from './types.ts';
import { IDLE_COMMAND } from './types.ts';

interface WireRef { entity: string; port: string }
interface InputBinding { refs: WireRef[]; invert: boolean }

/**
 * 区域（果てしない階。docs/endless-world.md 5.1）: Sim に入れた layout ごとの持ち物。外すときに全部外す。
 * フロア（フロア単位の生成）は 1 つの区域（id は ''）として入る
 */
interface RegionRuntime {
  id: string;
  layout: FloorLayout;
  statics: AABB[];
  zones: Zone[];
  /** 見え隠れの組 */
  groups: string[];
  /** 部品（配線の順） */
  entities: EntityRuntime[];
}

interface EntityRuntime {
  region: RegionRuntime;
  spec: EntitySpec;
  def: PartDef;
  state: PartState;
  out: Record<string, number>;
  inputs: Map<string, InputBinding>;
  interact: { aabb: AABB; range: number } | null;
  randomCounter: number;
}

export interface SimOptions {
  tuning: Tuning;
  /** 剛体を使う部品があるときに渡す（無ければ物理なし。剛体を使う部品があると例外） */
  physics?: PhysicsWorld | null;
  /** プレイヤーの id（既定 1 人 'p1'） */
  playerIds?: string[];
}

export interface SimSnapshot {
  tick: number;
  players: PlayerState[];
  entities: { [id: string]: { state: PartState; out: Record<string, number> } };
  revealed: string[];
}

/** 世界が持つ部品（境目の扉）の入れ物の区域 id */
export const WORLD_REGION = '@world';

/** 調べる操作が届く既定の距離（m） */
const INTERACT_RANGE = 2.6;
/** この高さまで落ちたら戻す（フロアの下端から） */
const KILL_DEPTH = 15;

export class Sim implements PlayerWorld {
  readonly floor: FloorLayout;
  readonly tuning: Tuning;
  readonly dt: number;
  readonly physics: PhysicsWorld | null;
  readonly colliders = new ColliderIndex();
  readonly players: PlayerState[];
  tick = 0;

  private readonly regions = new Map<string, RegionRuntime>();
  /** 全部の区域の静的なゾーン・面・出口（区域の出し入れで作り直す） */
  private staticZones: Zone[] = [];
  private staticSurfaces: SupportSurface[] = [];
  private exits: FloorExit[] = [];
  private killY = -Infinity;
  private readonly dynamicZones = new Map<string, Zone>();
  private readonly dynamicSurfaces = new Map<string, SupportSurface>();
  private readonly entities = new Map<string, EntityRuntime>();
  private order: EntityRuntime[] = [];
  private readonly revealedGroups = new Set<string>();
  private readonly revealBoxes = new Map<string, AABB[]>();
  private readonly concealBoxes = new Map<string, AABB[]>();
  private readonly exitInside = new Set<string>();
  private events: SimEvent[] = [];
  private cmds: InputCommand[] = [];

  constructor(floor: FloorLayout, opts: SimOptions) {
    this.floor = floor;
    this.tuning = opts.tuning;
    this.dt = 1 / opts.tuning['physics.tickHz'];
    this.physics = opts.physics ?? null;
    const ids = opts.playerIds ?? ['p1'];
    this.players = ids.map((id) => createPlayer(id, floor.spawn.pos, floor.spawn.yaw));

    this.addRegionRuntime(floor.region?.id ?? '', floor);
    this.reindex();
  }

  // ---------------------------------------------------------------- 区域（果てしない階。docs/endless-world.md 5.1）
  /**
   * 区域を入れる（id を付け替えた layout。core/gen/world/namespace.ts）。当たり判定・ゾーン・見え隠れ・部品・物理の静的な箱を足し、
   * 部品を配線の順に初期化する。配線はその区域の中か、入っている部品（境目の扉）へ。tick の間に呼ぶこと
   */
  addRegion(layout: FloorLayout): void {
    const id = layout.region?.id;
    if (!id) throw new Error('区域の情報（region）の無い layout です');
    if (this.regions.has(id)) throw new Error(`区域がもう入っています: ${id}`);
    this.addRegionRuntime(id, layout);
    this.reindex();
  }

  /**
   * 区域を外す。プレイヤーが持っている物・乗っている物がその区域にあれば外さない（false）。
   * 部品の状態は捨てる（置いた物の位置の保存は carry の保存で）
   */
  removeRegion(id: string): boolean {
    const rr = this.regions.get(id);
    if (!rr) return true;
    const eids = new Set(rr.entities.map((e) => e.spec.id));
    if (this.players.some((p) => (p.holding && eids.has(p.holding)) || (p.ride && eids.has(p.ride)))) return false;
    for (const b of rr.statics) this.colliders.removeStatic(b);
    for (const eid of eids) {
      this.colliders.removeDynamicPrefix(`${eid}:`);
      for (const k of [...this.dynamicZones.keys()]) if (k.startsWith(`${eid}:`)) this.dynamicZones.delete(k);
      for (const k of [...this.dynamicSurfaces.keys()]) if (k.startsWith(`${eid}:`)) this.dynamicSurfaces.delete(k);
      this.entities.delete(eid);
    }
    for (const g of rr.groups) {
      this.colliders.removeDynamicPrefix(`conceal:${g}:`);
      this.colliders.removeDynamicPrefix(`reveal:${g}:`);
      this.revealedGroups.delete(g);
      this.revealBoxes.delete(g);
      this.concealBoxes.delete(g);
    }
    this.order = this.order.filter((rt) => rt.region !== rr);
    this.physics?.removeOwned(id);
    const exitIds = new Set(rr.layout.exits.map((x) => x.id));
    for (const k of [...this.exitInside]) if (exitIds.has(k.slice(k.indexOf(':') + 1))) this.exitInside.delete(k);
    for (const p of this.players) {
      if (p.interactedId && eids.has(p.interactedId)) p.interactedId = null;
      if (p.surfaceId && [...eids].some((e) => p.surfaceId!.startsWith(`${e}:`))) p.surfaceId = null;
    }
    this.regions.delete(id);
    this.reindex();
    return true;
  }

  /** 入っている区域の id（世界の部品の入れ物 '@world' は除く） */
  regionIds(): string[] {
    return [...this.regions.keys()].filter((k) => k !== WORLD_REGION);
  }

  /**
   * 世界が持つ部品（境目の扉。どの区域にも属さない）を足す。配線は持たない物だけ。
   * 部品の区画（spec.cell）は描画の区画を指すだけ（区域が外れたら付け替える）
   */
  addWorldEntity(spec: EntitySpec): void {
    let rr = this.regions.get(WORLD_REGION);
    if (!rr) {
      const layout: FloorLayout = { ...this.floor, id: WORLD_REGION, cells: [], portals: [], entities: [], surfaces: [], exits: [] };
      rr = { id: WORLD_REGION, layout, statics: [], zones: [], groups: [], entities: [] };
      this.regions.set(WORLD_REGION, rr);
    }
    const def = partDef(spec.type);
    if (!def) throw new Error(`未登録の部品の種類です: ${spec.type}（${spec.id}）`);
    if (this.entities.has(spec.id)) throw new Error(`部品の id が重複しています: ${spec.id}`);
    const out: Record<string, number> = {};
    for (const o of def.outputs ?? []) out[o] = 0;
    const rt: EntityRuntime = { region: rr, spec, def, state: {}, out, inputs: parseInputs(spec), interact: null, randomCounter: 0 };
    if (rt.inputs.size) throw new Error(`世界の部品は配線を持てません: ${spec.id}`);
    this.entities.set(spec.id, rt);
    rr.entities.push(rt);
    this.order.push(rt);
    rt.state = def.init(this.contextFor(rt));
  }

  /** 世界が持つ部品を外す */
  removeWorldEntity(id: string): void {
    const rt = this.entities.get(id);
    if (!rt || rt.region.id !== WORLD_REGION) return;
    this.colliders.removeDynamicPrefix(`${id}:`);
    for (const k of [...this.dynamicZones.keys()]) if (k.startsWith(`${id}:`)) this.dynamicZones.delete(k);
    this.entities.delete(id);
    rt.region.entities = rt.region.entities.filter((x) => x !== rt);
    this.order = this.order.filter((x) => x !== rt);
    for (const p of this.players) if (p.interactedId === id) p.interactedId = null;
  }

  /** 区域の layout（入っていなければ null） */
  regionLayout(id: string): FloorLayout | null {
    return this.regions.get(id)?.layout ?? null;
  }

  /** 出口（入っている区域の。id で） */
  exitById(id: string): FloorExit | null {
    return this.exits.find((x) => x.id === id) ?? null;
  }

  /** 部品の設定（書き換えると次の tick から効く。境目の扉の錠など、世界が持つ部品に使う） */
  entitySpec(id: string): EntitySpec | null {
    return this.entities.get(id)?.spec ?? null;
  }

  /** 部品のいる区域の layout */
  layoutOf(entityId: string): FloorLayout | null {
    return this.entities.get(entityId)?.region.layout ?? null;
  }

  private addRegionRuntime(id: string, layout: FloorLayout): void {
    const rr: RegionRuntime = { id, layout, statics: [], zones: [], groups: [], entities: [] };
    this.regions.set(id, rr);
    const groups = new Set<string>();
    // 静的な当たり判定とゾーン
    for (const cell of layout.cells) {
      for (const b of cell.boxes) {
        if (b.revealGroup) {
          groups.add(b.revealGroup);
          if (b.solid && !PASSABLE_VEGETATION.has(b.mat)) {
            const list = this.revealBoxes.get(b.revealGroup) ?? [];
            list.push({ min: [...b.min], max: [...b.max] });
            this.revealBoxes.set(b.revealGroup, list);
          }
          continue;
        }
        if (!b.solid || PASSABLE_VEGETATION.has(b.mat) || b.kind === 'emitOnly') continue;
        if (b.concealGroup) {
          // 現れたら消える箱は動く当たり判定に置き、reveal で外す
          groups.add(b.concealGroup);
          const list = this.concealBoxes.get(b.concealGroup) ?? [];
          list.push({ min: [...b.min], max: [...b.max] });
          this.concealBoxes.set(b.concealGroup, list);
          continue;
        }
        const a: AABB = { min: [...b.min], max: [...b.max] };
        this.colliders.addStatic(a);
        rr.statics.push(a);
      }
      for (const z of cell.zones) rr.zones.push(z);
    }
    rr.groups = [...groups];
    for (const g of rr.groups) (this.concealBoxes.get(g) ?? []).forEach((b, i) => this.colliders.setDynamic(`conceal:${g}:${i}`, b));

    // 部品: 配線の順（入力の元が先）に並べる。循環は宣言順のまま（前の tick の値を読む）
    const added: EntityRuntime[] = [];
    for (const spec of layout.entities) {
      const def = partDef(spec.type);
      if (!def) throw new Error(`未登録の部品の種類です: ${spec.type}（${spec.id}）`);
      if (def.physics && !this.physics) throw new Error(`部品 ${spec.id}（${spec.type}）は物理を使いますが、PhysicsWorld が渡されていません`);
      if (this.entities.has(spec.id)) throw new Error(`部品の id が重複しています: ${spec.id}`);
      const out: Record<string, number> = {};
      for (const o of def.outputs ?? []) out[o] = 0;
      const rt: EntityRuntime = { region: rr, spec, def, state: {}, out, inputs: parseInputs(spec), interact: null, randomCounter: 0 };
      this.entities.set(spec.id, rt);
      added.push(rt);
    }
    for (const rt of added) {
      for (const [name, b] of rt.inputs) {
        for (const r of b.refs) {
          const src = this.entities.get(r.entity);
          if (!src) throw new Error(`${rt.spec.id}.${name}: 配線先の部品がありません: ${r.entity}`);
          if (src.def.outputs && !src.def.outputs.includes(r.port)) throw new Error(`${rt.spec.id}.${name}: ${r.entity}（${src.def.type}）に出力 ${r.port} がありません`);
        }
      }
    }
    rr.entities = topoOrder(added);
    this.order.push(...rr.entities);
    if (this.physics) this.physics.owner = id;
    for (const rt of rr.entities) rt.state = rt.def.init(this.contextFor(rt));
    // 物理: 剛体を使う区画の静的な箱を入れる
    if (this.physics) { this.addPhysicsStatics(rr); this.physics.owner = null; }
  }

  /** 全部の区域のゾーン・面・出口・落下の高さを作り直す */
  private reindex(): void {
    const rs = [...this.regions.values()];
    this.staticZones = rs.flatMap((r) => r.zones);
    this.staticSurfaces = rs.flatMap((r) => r.layout.surfaces);
    this.exits = rs.flatMap((r) => r.layout.exits);
    const lows = rs.filter((r) => r.layout.cells.length).map((r) => r.layout.bounds.min[1]);
    this.killY = (lows.length ? Math.min(...lows) : this.floor.bounds.min[1]) - KILL_DEPTH;
  }

  // ---------------------------------------------------------------- PlayerWorld
  get zones(): Iterable<Zone> {
    return this.dynamicZones.size ? [...this.staticZones, ...this.dynamicZones.values()] : this.staticZones;
  }

  get surfaces(): Iterable<SupportSurface> {
    return this.dynamicSurfaces.size ? [...this.staticSurfaces, ...this.dynamicSurfaces.values()] : this.staticSurfaces;
  }

  // ---------------------------------------------------------------- 進める
  /** 1 tick 進める。cmds はプレイヤーの順（足りなければ何もしない操作） */
  step(cmds: readonly InputCommand[]): void {
    this.tick++;
    this.cmds = this.players.map((p, i) => cmds[i] ?? { ...IDLE_COMMAND, yaw: p.yaw, pitch: p.pitch });

    // 1. 調べる操作
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i]!;
      const c = this.cmds[i]!;
      p.interactedId = c.interact ? this.pickInteractable(p, c.interact.yaw, c.interact.pitch) : null;
      p.flashlight = !!c.flashlight;
      p.dropPressed = !!c.drop;
      p.voice = c.voice ?? -1;
      if (c.interact && p.interactedId) this.events.push({ type: 'interact', tick: this.tick, player: p.id, entity: p.interactedId });
    }

    // 2. 部品（乗っている物の速度は部品が毎 tick 入れ直す）
    for (const p of this.players) p.carry = [0, 0, 0];
    for (const rt of this.order) { if (this.physics) this.physics.owner = rt.region.id; rt.def.step?.(rt.state, this.contextFor(rt)); }
    if (this.physics) this.physics.owner = null;

    // 3. プレイヤー
    for (let i = 0; i < this.players.length; i++) stepPlayer(this.players[i]!, this.cmds[i]!, this, this.dt, this.tick, this.events);

    // 4. 物理
    if (this.physics) {
      const p0 = this.players[0];
      if (p0) this.physics.setPlayer(p0.pos, PLAYER.radius, playerHeight(p0));
      this.physics.step();
      for (const rt of this.order) { this.physics.owner = rt.region.id; rt.def.post?.(rt.state, this.contextFor(rt)); }
      this.physics.owner = null;
    }

    // 5. 落下・出口
    for (const p of this.players) {
      if (p.pos[1] < this.killY) this.respawnPlayer(p, null, 'fall');
      for (const ex of this.exits) {
        const key = `${p.id}:${ex.id}`;
        const inside = p.pos[0] >= ex.aabb.min[0] && p.pos[0] <= ex.aabb.max[0] && p.pos[1] + 0.1 >= ex.aabb.min[1] && p.pos[1] <= ex.aabb.max[1] && p.pos[2] >= ex.aabb.min[2] && p.pos[2] <= ex.aabb.max[2];
        if (inside && !this.exitInside.has(key)) {
          this.exitInside.add(key);
          this.events.push({ type: 'floor.exit', tick: this.tick, player: p.id, data: { exit: ex.id, kind: ex.kind } });
        } else if (!inside) this.exitInside.delete(key);
      }
    }
  }

  /** 溜まったイベントを取り出す（取り出したら空になる） */
  drainEvents(): SimEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  // ---------------------------------------------------------------- 読み出し（クライアント・検査用）
  stateOf(id: string): Readonly<PartState> | null {
    return this.entities.get(id)?.state ?? null;
  }

  outputOf(id: string, port: string): number {
    return this.entities.get(id)?.out[port] ?? 0;
  }

  entityIds(): string[] {
    return this.order.map((r) => r.spec.id);
  }

  isRevealed(group: string): boolean {
    return this.revealedGroups.has(group);
  }

  /** 今いちばん近くで調べられる部品（画面の照準の表示用。操作はしない） */
  focusedInteractable(player = this.players[0]): string | null {
    return player ? this.pickInteractable(player, player.yaw, player.pitch) : null;
  }

  snapshot(): SimSnapshot {
    const entities: SimSnapshot['entities'] = {};
    for (const [id, rt] of this.entities) entities[id] = { state: clone(rt.state), out: { ...rt.out } };
    return { tick: this.tick, players: clone(this.players), entities, revealed: [...this.revealedGroups].sort() };
  }

  /** 状態のハッシュ（決定論の検査用） */
  stateHash(): string {
    const s = this.snapshot();
    return hashAll(JSON.stringify(s, (_k, v) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v))).toString(16);
  }

  // ---------------------------------------------------------------- 内部
  private contextFor(rt: EntityRuntime): PartContext {
    const sim = this;
    const id = rt.spec.id;
    return {
      tick: this.tick,
      dt: this.dt,
      time: this.tick * this.dt,
      id,
      spec: rt.spec,
      floor: rt.region.layout,
      tuning: this.tuning,
      players: this.players,
      physics: this.physics,
      input(name, fallback = 0) {
        const b = rt.inputs.get(name);
        if (!b) return fallback;
        let v = 0;
        for (const r of b.refs) v = Math.max(v, sim.entities.get(r.entity)?.out[r.port] ?? 0);
        return b.invert ? 1 - Math.min(1, Math.max(0, v)) : v;
      },
      wired(name) {
        return rt.inputs.has(name);
      },
      output(name, value) {
        rt.out[name] = Number.isFinite(value) ? value : 0;
      },
      interactedBy() {
        return sim.players.find((p) => p.interactedId === id) ?? null;
      },
      setCollider(key, aabb) {
        sim.colliders.setDynamic(`${id}:${key}`, aabb);
      },
      setZone(key, zone) {
        if (zone) sim.dynamicZones.set(`${id}:${key}`, zone);
        else sim.dynamicZones.delete(`${id}:${key}`);
      },
      setSurface(key, surface) {
        if (surface) sim.dynamicSurfaces.set(`${id}:${key}`, surface);
        else sim.dynamicSurfaces.delete(`${id}:${key}`);
      },
      setInteractable(aabb, range = INTERACT_RANGE) {
        rt.interact = aabb ? { aabb, range } : null;
      },
      reveal(group) {
        sim.revealGroup(group, id);
      },
      revealed(group) {
        return sim.revealedGroups.has(group);
      },
      cue(name, pos, data) {
        const e: SimEvent = { type: 'cue', tick: sim.tick, entity: id, data: { name, ...(data ?? {}) } };
        if (pos) e.pos = [...pos];
        sim.events.push(e);
      },
      random() {
        return hashAll(rt.region.layout.seed, id, sim.tick, rt.randomCounter++) / 4294967296;
      },
      rng() {
        return new Rng(hashAll(rt.region.layout.seed, 'part', id));
      },
      stateOf(other) {
        return sim.entities.get(other)?.state ?? null;
      },
      respawn(player, at) {
        sim.respawnPlayer(player, at ?? null, id);
      },
      warp(player, pos, yaw, seamless = true) {
        sim.warpPlayer(player, pos, yaw ?? player.yaw, seamless, id);
      },
      setRespawn(player, at) {
        player.respawn = { pos: [...at.pos], yaw: at.yaw };
      },
      colliders: this.colliders,
      sightClear(from, to) {
        return sim.sightClear(from, to);
      },
    };
  }

  private revealGroup(group: string, by: string): void {
    if (this.revealedGroups.has(group)) return;
    this.revealedGroups.add(group);
    (this.revealBoxes.get(group) ?? []).forEach((b, i) => this.colliders.setDynamic(`reveal:${group}:${i}`, b));
    (this.concealBoxes.get(group) ?? []).forEach((_b, i) => this.colliders.setDynamic(`conceal:${group}:${i}`, null));
    this.events.push({ type: 'reveal', tick: this.tick, entity: by, data: { group } });
  }

  /** 点 from から to まで当たり判定の箱に遮られないか（0.2 m 刻み。終わりの 0.35 m は見ない。warp の「見ていない間に作り替える」に使う） */
  sightClear(from: Vec3, to: Vec3): boolean {
    const d = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
    if (d < 0.4) return true;
    const n = Math.ceil((d - 0.35) / 0.2);
    for (let i = 1; i <= n; i++) {
      const k = Math.min(d - 0.35, i * 0.2) / d;
      if (this.colliders.pointBlocked(from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k, from[2] + (to[2] - from[2]) * k)) return false;
    }
    return true;
  }

  /** 開発用: プレイヤーを pos へ移す（向き yaw）。イベントは player.respawn（cause 'teleport'） */
  teleport(index: number, pos: Vec3, yaw: number): void {
    const p = this.players[index];
    if (p) this.respawnPlayer(p, { pos, yaw }, 'teleport');
  }

  /**
   * プレイヤーを pos へ移す（くり返す廊下・離れた部屋へつながる扉）。seamless なら速度と視線の上下を保ち、
   * クライアントはカメラを同じだけずらして継ぎ目を見せない（同じ形の所どうしで移すこと）。イベントは player.respawn（cause 'warp'）
   */
  warpPlayer(p: PlayerState, pos: Vec3, yaw: number, seamless: boolean, by: string): void {
    const delta: Vec3 = [pos[0] - p.pos[0], pos[1] - p.pos[1], pos[2] - p.pos[2]];
    const dYaw = yaw - p.yaw;
    p.pos = [...pos];
    if (!seamless) { p.vel = [0, 0, 0]; p.pitch = 0; p.onGround = false; }
    else if (Math.abs(dYaw) > 1e-9) {
      // 向きを回すときは速度も回す
      const c = Math.cos(-dYaw), s = Math.sin(-dYaw);
      p.vel = [p.vel[0] * c - p.vel[2] * s, p.vel[1], p.vel[0] * s + p.vel[2] * c];
    }
    p.yaw = yaw;
    p.surfaceId = null;
    // この tick の操作の視線も同じだけ回す（部品の後にプレイヤーが動くので、操作の視線で向きが戻らないように。warp で足した）
    const pi = this.players.indexOf(p);
    const cmd = this.cmds[pi];
    if (cmd && Math.abs(dYaw) > 1e-9) this.cmds[pi] = { ...cmd, yaw: cmd.yaw + dYaw };
    this.events.push({ type: 'player.respawn', tick: this.tick, player: p.id, pos: [...pos], entity: by, data: { cause: 'warp', yaw, seamless, dx: delta[0], dy: delta[1], dz: delta[2], dYaw } });
  }

  private respawnPlayer(p: PlayerState, at: { pos: Vec3; yaw: number } | null, cause: string): void {
    const to = at ?? p.respawn;
    p.pos = [...to.pos];
    p.vel = [0, 0, 0];
    p.yaw = to.yaw;
    p.pitch = 0;
    p.onGround = false;
    p.surfaceId = null;
    this.events.push({ type: 'player.respawn', tick: this.tick, player: p.id, pos: [...to.pos], data: { cause, yaw: to.yaw } });
  }

  /** 視線の先の、いちばん近い調べられる部品。手前に壁があれば当たらない */
  private pickInteractable(p: PlayerState, yaw: number, pitch: number): string | null {
    // 目と視線は重力の向き（壁・天井を歩いている）と身体の大きさを含む（段階 4・移動と身体）
    const eye: Vec3 = playerEye(p);
    const dir = playerLook(p, yaw, pitch);
    let best: { id: string; t: number } | null = null;
    for (const rt of this.order) {
      if (!rt.interact) continue;
      const t = rayAabb(eye, dir, aabbExpand(rt.interact.aabb, 0.05), rt.interact.range);
      if (t !== null && (!best || t < best.t)) best = { id: rt.spec.id, t };
    }
    if (!best) return null;
    // 遮るもの（静的な箱）。調べる対象自身に重なる箱は除く
    const target = this.entities.get(best.id)!.interact!.aabb;
    const end: Vec3 = [eye[0] + dir[0] * best.t, eye[1] + dir[1] * best.t, eye[2] + dir[2] * best.t];
    const blockers = this.colliders.query(Math.min(eye[0], end[0]), Math.min(eye[1], end[1]), Math.min(eye[2], end[2]), Math.max(eye[0], end[0]), Math.max(eye[1], end[1]), Math.max(eye[2], end[2]));
    for (const b of blockers) {
      if (b.min[0] < target.max[0] && b.max[0] > target.min[0] && b.min[1] < target.max[1] && b.max[1] > target.min[1] && b.min[2] < target.max[2] && b.max[2] > target.min[2]) continue;
      const t = rayAabb(eye, dir, b, best.t);
      if (t !== null && t < best.t - 0.05) return null;
    }
    return best.id;
  }

  /**
   * 剛体を使う部品のある区画と、その隣の区画（開口でつながる）の静的な箱（床・壁・家具）を物理に入れる。
   * 隣も入れるのは、扉から押し出された物が隣の廊下の床を抜けて落ちないように
   */
  private addPhysicsStatics(rr: RegionRuntime): void {
    const cells = new Set<string>();
    for (const rt of rr.entities) if (rt.def.physics) cells.add(rt.spec.cell ?? '*');
    if (!cells.size) return;
    for (const p of rr.layout.portals) {
      if (cells.has(p.cells[0])) cells.add(p.cells[1]);
      else if (cells.has(p.cells[1])) cells.add(p.cells[0]);
    }
    for (const cell of rr.layout.cells) {
      if (!cells.has('*') && !cells.has(cell.id)) continue;
      for (const b of cell.boxes) {
        if (!b.solid || b.revealGroup || b.concealGroup || PASSABLE_VEGETATION.has(b.mat) || b.kind === 'emitOnly') continue;
        this.physics!.addStaticBox(b);
      }
    }
  }
}

function parseInputs(spec: EntitySpec): Map<string, InputBinding> {
  const out = new Map<string, InputBinding>();
  for (const [name, w] of Object.entries(spec.inputs ?? {})) out.set(name, parseWire(spec.id, name, w));
  return out;
}

function parseWire(id: string, name: string, w: InputWire): InputBinding {
  const from = typeof w === 'string' ? [w] : Array.isArray(w.from) ? w.from : [w.from];
  const invert = typeof w === 'string' ? false : !!w.invert;
  const refs = from.map((r) => {
    const i = r.lastIndexOf('.');
    if (i <= 0) throw new Error(`${id}.${name}: 配線は「部品ID.出力名」で書きます（${r}）`);
    return { entity: r.slice(0, i), port: r.slice(i + 1) };
  });
  return { refs, invert };
}

/** 入力の元が先に来る順（Kahn 法）。循環に入ったものは宣言順で後ろに付ける */
function topoOrder(list: EntityRuntime[]): EntityRuntime[] {
  const byId = new Map(list.map((r) => [r.spec.id, r]));
  const indeg = new Map<string, number>();
  const users = new Map<string, string[]>();
  for (const r of list) {
    const deps = new Set<string>();
    for (const b of r.inputs.values()) for (const ref of b.refs) if (ref.entity !== r.spec.id) deps.add(ref.entity);
    indeg.set(r.spec.id, deps.size);
    for (const d of deps) users.set(d, [...(users.get(d) ?? []), r.spec.id]);
  }
  const out: EntityRuntime[] = [];
  const queue = list.filter((r) => indeg.get(r.spec.id) === 0).map((r) => r.spec.id);
  const done = new Set<string>();
  while (queue.length) {
    const id = queue.shift()!;
    if (done.has(id)) continue;
    done.add(id);
    out.push(byId.get(id)!);
    for (const u of users.get(id) ?? []) {
      const n = (indeg.get(u) ?? 0) - 1;
      indeg.set(u, n);
      if (n === 0) queue.push(u);
    }
  }
  for (const r of list) if (!done.has(r.spec.id)) out.push(r);
  return out;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
