/**
 * 骨組み → 区画（部屋・曲がり角・広間・廊下・階段）の形と、区画どうしの開口・扉（v2-plan.md 5 章の ②）。
 *
 * - 区画の中心: x = (列 − (列数−1)/2) × 間隔、z = −(行 + 0.5) × 間隔（入口が手前 +Z、奥が −Z）。階 s の床は −s × 階の高さ
 * - 部屋は区画の中に収まり、どの向きから来る廊下の帯（中心線 ± 廊下の幅/2 + 0.6 m）も含む大きさにする
 *   → 廊下は隣の区画の中心線に沿ってまっすぐ通せる（曲がりは曲がり角の区画で作る）
 * - 段差のあるつなぎは、廊下の途中に階段の区画を挟む（蹴上げ 0.17 m 以下・踏面 0.28 m）
 * - 入口の後ろに「降りてきた階段」（上は閉ざされた扉）、出口の先に「次の階へ降りる階段」（下に FloorExit）
 * 区画は、全部の開口が決まってから一度に作る（壁に開口を開けるため）。区画ごとの開口も返す（中身の配置と到達判定に使う）。
 *
 * 段階 4（フロアの形の担当）で足したこと。作りは GeoBuild（形を丸ごと作る型 shapes/*.ts も使う）:
 * - つなぎの作り（SkelLink.style）: 壁 1 枚の扉（direct）・屋外の渡り廊下 / 橋（walkway / bridge。手すり・霧）・飛び降り（drop）・
 *   一方通行の扉（oneWay）・裏の通路（staff）・狭い通路（narrow）
 * - 窓（Skeleton.windows）: 隣り合う区画の壁のガラス窓（portal 'window'。見えるが通れない）
 * - 区画の作り（SkelNode.style）: shapes/styles.ts（中庭・吹き抜け・巨大空間・入れ子・中二階・ホーム …）
 * - 階段室（kind 'well'）: 階をまたぐ折り返し階段（shapes/well.ts）。上下に重なる区画（縦に積んだビル・立体交差・中二階）
 * - 出口の数（迷路フロア）・区画ごとの系統（profile.families）・古さ（同心円）
 * - 中身を置かない範囲（keepOut）・仕掛けと異変を置かない区画（reserved）・中身を置いた後の仕上げ（afterDress。鏡写しなど）
 */
import type { Tuning } from '../../config/tuning.ts';
import type { AABB } from '../../math/aabb.ts';
import { hashAll, Rng } from '../../math/rng.ts';
import type { Dir, Vec3 } from '../../math/vec.ts';
import { doorPanel, lightPanel, makeCell, opening, portal, portalAabb, type CellOptions } from '../../world/build.ts';
import type { Rect } from '../../world/footprint.ts';
import { box, DOOR_H, DOOR_W, WALL_T, type Box, type CellLayout, type CellRole, type EntitySpec, type FloorExit, type Json, type LightingOverrides, type MatId, type Palette, type PortalSpec, type RegionAirlockCell, type RegionGateCell, type RenderOverrides, type WallOpening } from '../../world/layout.ts';
import { themePalette } from '../../world/palettes.ts';
import type { DressKind, DressRoom } from '../dress/types.ts';
import type { FloorProfile } from './profile.ts';
import { adjacency, type Skeleton, type SkelLink, type SkelNode } from './skeleton.ts';
import type { FloorFamily } from './themes.ts';
import { SHAPES } from './shapes/index.ts';
import { agedPalette, applyNodeStyles, nodeRect } from './shapes/styles.ts';
import { arcadeCorridor, arcadeJunction } from './shapes/arcade.ts';
import { buildWell } from './shapes/well.ts';
import { outdoorStraight, railingSides } from './shapes/outdoor.ts';
import { buildCrawl } from './shapes/crawl.ts';
import { mirrorFinish } from './shapes/finish.ts';
import { regionPorts } from './ports.ts';
import { FAMILIES } from './themes.ts';
import { rarityRank } from './profile.ts';

export class GenError extends Error {}

export const RISER_MAX = 0.17;
export const TREAD = 0.28;
export const snap = (v: number): number => Math.round(v * 20) / 20;
export const aabbJson = (a: AABB): Json => ({ min: [...a.min], max: [...a.max] });

export interface GeoCell {
  cell: CellLayout;
  kind: DressKind;
  openings: WallOpening[];
  /** 骨組みの区画（部屋・曲がり角・広間）。廊下・階段は -1 */
  node: number;
}

/** 中身を置いた後の仕上げ（鏡写しの家具・縮むくり返しの家具など）に渡すもの */
export interface AfterDressEnv {
  /** 区画の中身の置き方（無ければ中身なし） */
  dress?: (r: DressRoom) => void;
  /** 区画 id → 中身を置く前の cell.boxes.length（無い区画は中身を置いていない） */
  dressedFrom: ReadonlyMap<string, number>;
  /** 仕掛け・異変・隠しのある区画（写したり作り直したりしない） */
  busy: ReadonlySet<string>;
}

export interface FloorGeometry {
  cells: GeoCell[];
  portals: PortalSpec[];
  entities: EntitySpec[];
  spawn: { pos: Vec3; yaw: number; cell: string };
  exits: FloorExit[];
  /** 骨組みの区画 → 区画の id */
  nodeCell: Map<number, string>;
  corridorWidth: number;
  /** 中身（家具）を置かない範囲（区画 id → フロア座標の範囲）。形が置いた物（階段・建物・梯子段）の前を空ける */
  keepOut?: Map<string, AABB[]>;
  /** 仕掛け・異変を置かない区画（形そのものが見どころの区画: 中庭・吹き抜け・巨大空間の建物・車両 …） */
  reserved?: Set<string>;
  /**
   * 大きさ・高さを変えてはいけない区画（形の見どころが大きさそのもの: 縮むくり返しの部屋・巨大空間の中の建物）。仕掛け・異変・中身は置ける。
   * 部屋の形（core/gen/rooms）と、天井を上げる異変（vast）が掛けない（段階 4 の統合で足した）
   */
  fixedSize?: Set<string>;
  /** 中身を置いた後の仕上げ（index.ts が中身・異変の後に呼ぶ） */
  afterDress?: (env: AfterDressEnv) => void;
  /**
   * 床の下に掘れる深さ（区画 id → m）。下に別の区画がある区画（縦に積んだビルの上の階など）だけ。
   * 仕掛け（穴・溝）は、これより深く掘る物を置かない（floor/gimmicks.ts）
   */
  belowFree?: Map<string, number>;
  /** 果てしない階の区域: 境目の扉の開口と階段室（core/gen/floor/ports.ts） */
  region?: { gates: RegionGateCell[]; airlocks: RegionAirlockCell[] };
  /** 本道の終わりの区画（無ければ出口の階段 'exitStairs'） */
  mainTo?: string;
  /** 中身（家具）・仕掛け・異変・地図の看板・裏の調子を置かない区画（階段室。上下の階の写しで同じ見た目に保つ） */
  sealed?: Set<string>;
}

/** 部屋・曲がり角・広間の置き場所 */
export interface Placed {
  node: SkelNode;
  rect: Rect;
  /** 区画の床（背の高い区画は、いちばん下の階の床） */
  y: number;
  height: number;
  theme: string;
  kind: DressKind;
  cellId: string;
  /** 区画の系統 */
  fam: FloorFamily;
  /** 足跡（無ければ rect だけ。穴の開いた区画は rect から穴を引いた矩形の集まり） */
  rects?: Rect[];
  /** 区画を作るときの追加の指定（天井なし・床の穴・照明・描画・焼き込み） */
  opts?: Omit<Partial<CellOptions>, 'palette' | 'role'> & { render?: RenderOverrides; lighting?: LightingOverrides; palette?: Partial<Palette>; role?: CellRole; name?: string; audio?: string };
  /** 区画を作った後の仕上げ（箱を足す・壁を切る） */
  post?: ((cell: CellLayout) => void)[];
  /** 区画を作る直前（開口が全部そろった後）の準備（手すりの開口を足す・中の区画を決める） */
  preBuild?: ((pl: Placed) => void)[];
}

/** 廊下・階段の区画の作り方（開口が決まってから作る） */
export interface StraightSpec {
  id: string;
  axis: 'x' | 'z';
  a0: number;
  a1: number;
  center: number;
  width: number;
  /** 区画の床（階段は低い方） */
  y: number;
  height: number;
  kind: DressKind;
  role: CellRole;
  name: string;
  /** 階段: 低い端（'a0' か 'a1'）、段の始まり（低い端からの距離）、上がる高さ。tread / riser で踏面と蹴上げを変えられる */
  stairs?: { lowEnd: 'a0' | 'a1'; offset: number; rise: number; tread?: number };
  /** 飛び降りる段差: 高い端・高い床の長さ（高い端からの距離）・高さ */
  drop?: { highEnd: 'a0' | 'a1'; edge: number; rise: number };
  /** 照明の材質（無ければ廊下の色の組） */
  lightMat?: Box['mat'];
  extra?: Box[];
  /** 床の穴（天井裏の点検口） */
  floorHoles?: AABB[];
  /** 色の組・テーマ・音・素材の鍵（無ければフロアの廊下の物） */
  palette?: Palette;
  theme?: string;
  audio?: string;
  materialKey?: string;
  /** 屋外（天井なし・両脇は手すり・霧）。shapes/outdoor.ts */
  outdoor?: { rail: number; style: 'walkway' | 'bridge'; below?: 'void' | 'water'; fog?: [number, number] };
  /** 照明の明るさの倍率（古い区画・裏の通路は暗い） */
  lightMul?: number;
  /** 区画を作った後の仕上げ */
  post?: ((cell: CellLayout) => void)[];
}

/** 扉の指定（join） */
export interface DoorSpec { cell: string; mat: MatId; swing: number; hinge?: number; openSide?: number; autoCloseSec?: number; locked?: boolean; startOpen?: boolean; idSuffix?: string }

/**
 * 区画を組み立てる道具（グリッドの型と、形を丸ごと作る型 shapes/*.ts が使う）。
 * 開口を集めてから区画を作る（finish）。区画どうしの portal と扉は join で足す
 */
export class GeoBuild {
  readonly out: FloorGeometry;
  readonly openings = new Map<string, WallOpening[]>();
  readonly straights: StraightSpec[] = [];
  readonly extraBoxes = new Map<string, Box[]>();
  readonly cellsToBuild: Placed[] = [];
  readonly keepOut = new Map<string, AABB[]>();
  readonly reserved = new Set<string>();
  readonly fixedSize = new Set<string>();
  /** 区画を作った後に、区画 id で呼ぶ仕上げ（GeoCell を見る物） */
  readonly finishers: ((g: GeoBuild) => void)[] = [];
  readonly afterDress: ((env: AfterDressEnv) => void)[] = [];
  readonly fam: FloorFamily;
  readonly corridorPalette: Palette;
  readonly corrKey: string;

  readonly p: FloorProfile;
  readonly t: Tuning;
  readonly doorRng: Rng;

  constructor(p: FloorProfile, t: Tuning, doorRng: Rng, corridorWidth: number) {
    this.p = p;
    this.t = t;
    this.doorRng = doorRng;
    this.fam = p.family;
    this.corridorPalette = themePalette(p.family.corridor);
    this.corrKey = `corr:${p.id}`;
    this.out = { cells: [], portals: [], entities: [], spawn: { pos: [0, 0, 0], yaw: 0, cell: '' }, exits: [], nodeCell: new Map(), corridorWidth };
  }

  addOpening(cell: string, o: WallOpening): void { const l = this.openings.get(cell) ?? []; l.push(o); this.openings.set(cell, l); }
  addBox(cell: string, b: Box): void { const l = this.extraBoxes.get(cell) ?? []; l.push(b); this.extraBoxes.set(cell, l); }
  keep(cell: string, a: AABB): void { const l = this.keepOut.get(cell) ?? []; l.push(a); this.keepOut.set(cell, l); }

  /** 扉の部品を足す（戻り値は id） */
  door(id: string, axis: 'x' | 'z', coord: number, at: number, y: number, d: DoorSpec, width = DOOR_W, height = DOOR_H): string {
    const params: EntitySpec['params'] = { panel: aabbJson(doorPanel(axis, coord, at, width, y, height)), axis, mat: d.mat, hinge: d.hinge ?? (this.doorRng.chance(0.5) ? 1 : -1), swing: d.swing };
    if (d.openSide) params.openSide = d.openSide;
    if (d.autoCloseSec !== undefined) params.autoCloseSec = d.autoCloseSec;
    if (d.locked) params.locked = true;
    if (d.startOpen) params.startOpen = true;
    this.out.entities.push({ id, type: 'door', cell: d.cell, params });
    return id;
  }

  /** 区画 a と b の境目（軸 axis の座標 coord の壁、横の位置 at）の portal と、扉（door があれば） */
  join(a: string, b: string, axis: 'x' | 'z', coord: number, at: number, y: number, width: number, height: number, dir: Dir, door?: DoorSpec | null, kind: PortalSpec['kind'] = 'opening'): void {
    let doorId: string | undefined;
    // 同じ 2 つの区画の間に 2 つ目の開口（部屋の連なり chain の広い壁など）は、id に番号を付ける
    let n = 1;
    while (this.out.portals.some((p) => p.id === `p:${a}:${b}${n > 1 ? `:${n}` : ''}`)) n++;
    const tag = n > 1 ? `:${n}` : '';
    if (door) doorId = this.door(`door:${a}:${b}${tag}${door.idSuffix ?? ''}`, axis, coord, at, y, door, Math.min(width, DOOR_W), Math.min(height, DOOR_H));
    this.out.portals.push(portal(`p:${a}:${b}${tag}`, a, b, portalAabb(axis, coord, at, width, y, height), dir, doorId ? 'door' : kind, doorId));
  }

  /** 区画を作る（開口がそろってから finish で作る） */
  cell(pl: Placed): void { this.cellsToBuild.push(pl); }

  /** 区画（作った後） */
  geo(id: string): GeoCell | undefined { return this.out.cells.find((g) => g.cell.id === id); }

  finish(sk: Skeleton | null): FloorGeometry {
    const adj = sk ? adjacency(sk) : new Map<number, number[]>();
    const done = new Set<Placed>();
    for (const pl of this.cellsToBuild) for (const f of pl.preBuild ?? []) f(pl);
    for (const pl of this.cellsToBuild) {
      if (done.has(pl)) continue;
      done.add(pl);
      const deg = adj.get(pl.node.id)?.length ?? 0;
      const role: CellRole = pl.opts?.role ?? (!sk ? 'rest' : pl.node.id === sk.entry ? 'entry' : pl.node.id === sk.exit ? 'exit' : pl.kind === 'hall' ? 'hub' : pl.kind === 'junction' ? 'connector' : sk.main.includes(pl.node.id) ? 'gimmick' : deg <= 1 ? 'side' : 'rest');
      const famCorr = themePalette(pl.fam.corridor);
      const palette: Palette = { ...(pl.kind === 'junction' && pl.theme === pl.fam.corridor ? famCorr : themePalette(pl.theme)), ...(pl.opts?.palette ?? {}) };
      const { render, lighting, palette: _p, role: _r, name, audio, ...cellOpts } = pl.opts ?? {};
      const cell = makeCell({
        id: pl.cellId, role, rects: pl.rects ?? [pl.rect], height: pl.height, floorY: pl.y, palette, theme: pl.theme,
        name: name ?? (pl.kind === 'junction' ? '曲がり角' : pl.kind === 'hall' ? '広間' : '部屋'),
        audioPreset: audio ?? (pl.kind === 'junction' ? pl.fam.corridorAudio : pl.fam.roomAudio),
        materialKey: pl.kind === 'junction' ? (pl.fam === this.fam ? this.corrKey : `corr:${this.p.id}:${pl.fam.id}`) : `${pl.cellId}:${hashAll(this.p.seed, pl.cellId) % 7}`,
        openings: this.openings.get(pl.cellId) ?? [],
        lightSpacing: pl.kind === 'hall' ? 3.6 : 2.6,
        ...cellOpts,
      });
      if (render) cell.render = { ...render };
      if (lighting) cell.lighting = { ...lighting };
      cell.boxes.push(...(this.extraBoxes.get(pl.cellId) ?? []));
      for (const f of pl.post ?? []) f(cell);
      this.out.cells.push({ cell, kind: pl.kind, openings: this.openings.get(pl.cellId) ?? [], node: pl.node.id });
      if (sk) for (const m of sk.nodes) if (this.placedOf?.(m.id) === pl) this.out.nodeCell.set(m.id, pl.cellId);
    }
    for (const s of this.straights) {
      const cell = buildStraight(s, this.openings.get(s.id) ?? [], s.palette ?? this.corridorPalette, s.materialKey ?? this.corrKey, s.theme ?? this.fam.corridor, s.audio ?? this.fam.corridorAudio);
      cell.boxes.push(...(this.extraBoxes.get(s.id) ?? []));
      for (const f of s.post ?? []) f(cell);
      this.out.cells.push({ cell, kind: s.kind, openings: this.openings.get(s.id) ?? [], node: -1 });
    }
    for (const f of this.finishers) f(this);
    // 床の下に掘れる深さ: 足跡が重なる下の区画の天井まで
    const cells = this.out.cells.map((x) => x.cell);
    for (const a of cells) {
      let free = Infinity;
      for (const b of cells) {
        if (b === a || b.bounds.max[1] > a.floorY + 0.05) continue;
        if (!a.footprint.some((ra) => b.footprint.some((rb) => ra.x0 < rb.x1 - 0.05 && ra.x1 > rb.x0 + 0.05 && ra.z0 < rb.z1 - 0.05 && ra.z1 > rb.z0 + 0.05))) continue;
        free = Math.min(free, a.floorY - b.bounds.max[1]);
      }
      if (Number.isFinite(free)) (this.out.belowFree ??= new Map()).set(a.id, free);
    }
    // 本来の出口（次の階へ降りる階段 'down'）を先頭に（ほかの出口: 駅の車両・縦穴・迷路フロアの別の出口）
    this.out.exits.sort((a, b) => (a.id === 'down' ? 0 : 1) - (b.id === 'down' ? 0 : 1));
    if (this.keepOut.size) this.out.keepOut = this.keepOut;
    if (this.reserved.size) this.out.reserved = this.reserved;
    if (this.fixedSize.size) this.out.fixedSize = this.fixedSize;
    if (this.afterDress.length) { const list = this.afterDress.slice(); this.out.afterDress = (env) => { for (const f of list) f(env); }; }
    return this.out;
  }

  /** 骨組みの区画 → 置き場所（グリッドの型が設定する） */
  placedOf?: (node: number) => Placed | undefined;
}

/** 区域の部屋の別の系統（world.wildcardRoomChance の確率。区域の珍しさで出られる系統から） */
function wildcardFamily(p: FloorProfile, node: number, t: Tuning): FloorFamily | null {
  const r = new Rng(hashAll(p.seed, 'wild', node));
  if (!r.chance(t['world.wildcardRoomChance'])) return null;
  const pool = FAMILIES.filter((f) => f.id !== p.family.id && (!f.minRarity || rarityRank(p.rarity) >= rarityRank(f.minRarity)));
  return pool.length ? r.weighted(pool, (f) => f.weight) : null;
}

/** 区画の系統（profile.families の番号。無ければフロアの系統） */
export function famOf(p: FloorProfile, n: SkelNode): FloorFamily {
  return (n.fam !== undefined ? p.families?.[n.fam] : undefined) ?? p.family;
}

export function buildGeometry(p: FloorProfile, sk: Skeleton, rng: Rng, t: Tuning): FloorGeometry {
  const shape = SHAPES[p.pattern];
  if (shape) return shape(p, rng, t);
  const S = p.spacing;
  const LH = t['floor.levelHeightM'];
  const SH = t['structure.storyHeightM'];
  const fam = p.family;
  // 区域の原点（果てしない階の区域は階の座標で直接作る。docs/endless-world.md 4.1。フロアは 0, 0）
  const [ox, oz] = p.origin ?? [0, 0];
  const cw0 = snap(rng.float(fam.corridorWidth[0], fam.corridorWidth[1]));
  const hc0 = snap(rng.float(fam.corridorHeight[0], fam.corridorHeight[1]));
  // 地下街（F34）: どの系統でも、通路は広くて低い（真ん中に柱の列）
  // 鏡写し（F19）: 幅を 0.1 m 刻みに（半分が 0.05 m の丸めの刻みに乗り、左右の廊下が丸めでずれない）
  const cw = p.pattern === 'arcade' ? Math.max(cw0, t['structure.arcade.widthM']) : p.pattern === 'mirror' ? Math.round(cw0 * 10) / 10 : cw0;
  const hc = p.pattern === 'arcade' ? Math.min(hc0, t['structure.arcade.heightM']) : hc0;
  // 階・棟ごとの系統の廊下の幅・天井の高さ（主の系統は上の値）
  const famCw = new Map<string, { cw: number; hc: number }>([[fam.id, { cw, hc }]]);
  for (const f of p.families ?? []) if (!famCw.has(f.id)) { const r = rng.fork(`fam:${f.id}`); famCw.set(f.id, { cw: snap(r.float(f.corridorWidth[0], f.corridorWidth[1])), hc: snap(r.float(f.corridorHeight[0], f.corridorHeight[1])) }); }
  const cwOf = (f: FloorFamily): number => famCw.get(f.id)?.cw ?? cw;
  const hcOf = (f: FloorFamily): number => famCw.get(f.id)?.hc ?? hc;
  const cx = (c: number): number => ox + (c - (sk.cols - 1) / 2) * S;
  const cz = (r: number): number => oz - (r + 0.5) * S;
  const yOf = (n: SkelNode): number => n.level * LH - n.story * SH;
  const adj = adjacency(sk);
  const g = new GeoBuild(p, t, rng.fork('doors'), cw);
  const doorRng = g.doorRng;

  // ---------------------------------------------------------------- 部屋・曲がり角・広間の置き場所
  const placed = new Map<number, Placed>();
  g.placedOf = (id) => placed.get(id);
  const hallDone = new Map<number, Placed>();
  const wellDone = new Map<number, Placed>();
  const used = sk.nodes.filter((n) => n.kind !== 'none');
  const mirrorCol = (n: SkelNode): number => (sk.mirror && n.col > (sk.cols - 1) / 2 ? sk.cols - 1 - n.col : n.col);
  for (const n of used) {
    // 鏡写し: 右半分の区画は、左半分の対になる区画と同じ乱数で大きさを決め、横のずれを反転する
    const flip = sk.mirror && n.col > (sk.cols - 1) / 2 ? -1 : 1;
    const nr = rng.fork(`node${flip < 0 ? n.id - n.col + mirrorCol(n) : n.id}`);
    const x = cx(n.col), z = cz(n.row);
    const f = famOf(p, n);
    const fcw = cwOf(f), fhc = hcOf(f);
    const band = fcw / 2 + 0.6;
    if (n.kind === 'well') {
      const hit = wellDone.get(n.well ?? 0);
      if (hit) { placed.set(n.id, hit); continue; }
      const members = used.filter((m) => m.kind === 'well' && m.well === n.well);
      const top = Math.min(...members.map((m) => m.story)), bottom = Math.max(...members.map((m) => m.story));
      const pl = buildWell(g, sk, n, members, { x, z, S, SH, top, bottom, hc: fhc, rng: nr });
      wellDone.set(n.well ?? 0, pl);
      placed.set(n.id, pl);
      continue;
    }
    if (n.kind === 'hall') {
      const hit = hallDone.get(n.hall);
      if (hit) { placed.set(n.id, hit); continue; }
      const members = used.filter((m) => m.kind === 'hall' && m.hall === n.hall);
      const hs = n.style === 'full' || n.style === 'courtyard' ? S / 2 : S / 2 - 1.2;
      const rect: Rect = {
        x0: snap(Math.min(...members.map((m) => cx(m.col))) - hs), x1: snap(Math.max(...members.map((m) => cx(m.col))) + hs),
        z0: snap(Math.min(...members.map((m) => cz(m.row))) - hs), z1: snap(Math.max(...members.map((m) => cz(m.row))) + hs),
      };
      // 階をまたぐ広間（中二階）: いちばん下の階の床から、いちばん上の階の天井まで
      const lo = members.reduce((a, m) => (yOf(m) < yOf(a) ? m : a));
      const hi = members.reduce((a, m) => (yOf(m) > yOf(a) ? m : a));
      const hh = snap(nr.float(f.hallHeight[0], f.hallHeight[1]));
      const pl: Placed = { node: n, rect, y: yOf(lo), height: snap(yOf(hi) - yOf(lo) + hh), theme: nr.weighted(f.halls, ([, w]) => w)[0], kind: 'hall', cellId: `hall${n.hall}`, fam: f };
      hallDone.set(n.hall, pl);
      placed.set(n.id, pl);
      continue;
    }
    if (n.kind === 'junction') {
      const jw = n.style === 'staff' ? t['structure.staff.widthM'] : fcw;
      const h = jw / 2 + WALL_T;
      const style = n.style;
      const pl: Placed = { node: n, rect: { x0: snap(x - h), x1: snap(x + h), z0: snap(z - h), z1: snap(z + h) }, y: yOf(n), height: style === 'staff' ? t['structure.staff.heightM'] : fhc, theme: style === 'staff' ? 'CorridorService' : f.corridor, kind: 'junction', cellId: `j${n.id}`, fam: f };
      if (p.pattern === 'arcade') pl.post = [(cell) => arcadeJunction(g, cell)];
      placed.set(n.id, pl);
      continue;
    }
    const minR = Math.max(3.8, 2 * band + 0.6);
    // 段差でつなぐ型（スキップフロア・下るだけのフロア）は、部屋の間に階段・段差の収まる長さを残す
    const maxR = Math.max(minR, S - (p.pattern === 'skip' ? 6.2 : p.pattern === 'descent' ? 5.0 : 2.8));
    const w = snap(nr.float(minR, maxR)), d = snap(nr.float(minR, maxR));
    const jx = snap(nr.float(-1, 1) * Math.max(0, w / 2 - band)) * flip, jz = snap(nr.float(-1, 1) * Math.max(0, d / 2 - band));
    // 果てしない階の区域: 部屋が別の系統になることがある（docs/endless-world.md 4 章。扉を開けると急に別の施設）
    const rf = p.region && n.id !== sk.entry ? wildcardFamily(p, n.id, t) ?? f : f;
    const theme = n.id === sk.entry ? f.corridor : nr.weighted(rf.rooms, ([, wt]) => wt)[0];
    const rect: Rect = n.style === 'full' ? { x0: snap(x - S / 2), x1: snap(x + S / 2), z0: snap(z - S / 2), z1: snap(z + S / 2) } : { x0: snap(x + jx - w / 2), x1: snap(x + jx + w / 2), z0: snap(z + jz - d / 2), z1: snap(z + jz + d / 2) };
    // 鏡写し: 真ん中の列の部屋は、鏡の線（x = 0）の左右に同じ幅
    if (sk.mirror && n.col === (sk.cols - 1) / 2 && n.style !== 'full') { rect.x0 = snap(x - snap(w / 2)); rect.x1 = snap(x + snap(w / 2)); }
    const roomH = snap(nr.float(rf.roomHeight[0], rf.roomHeight[1]));
    // F25 緊張と解放: 狭い通路の間の部屋は、天井の高い広い空間
    const height = p.pattern === 'linear' && n.id !== sk.entry ? Math.max(roomH, t['structure.linear.wideHeightM']) : roomH;
    placed.set(n.id, { node: n, rect: nodeRect(n, rect, x, z, S, band, nr), y: yOf(n), height, theme, kind: 'room', cellId: `r${n.id}`, fam: rf });
  }
  // 鏡写し: 右半分の区画の置き場所を、左の対の置き場所の反転そのものにする（0.05 m の丸めの向きで左右がずれないように）
  if (sk.mirror) {
    for (const n of used) {
      if (n.col <= (sk.cols - 1) / 2) continue;
      const m = used.find((o) => o.col === sk.cols - 1 - n.col && o.row === n.row && o.story === n.story);
      const a = placed.get(n.id), b = m ? placed.get(m.id) : undefined;
      if (!a || !b || a === b || a.kind !== b.kind || a.kind === 'hall' || a.node.style !== b.node.style) continue;
      const flipR = (r: Rect): Rect => ({ x0: 2 * ox - r.x1, x1: 2 * ox - r.x0, z0: r.z0, z1: r.z1 });
      a.rect = flipR(b.rect);
      if (b.rects) a.rects = b.rects.map(flipR);
    }
    // 家具まで鏡に写す対（入口に近い順に structure.mirror.cleanPairs 組）は、仕掛け・異変を置かない（shapes/finish.ts）
    const pairs = used.filter((n) => n.col < (sk.cols - 1) / 2 && n.kind === 'room' && n.id !== sk.entry && n.id !== sk.exit)
      .map((n) => [n, used.find((o) => o.col === sk.cols - 1 - n.col && o.row === n.row && o.story === n.story)] as const)
      .filter(([n, m]) => m && m.kind === 'room' && m.id !== sk.exit && placed.get(n.id) && placed.get(m.id))
      .sort((x, y) => x[0].row - y[0].row || x[0].col - y[0].col);
    for (const [n, m] of pairs.slice(0, t['structure.mirror.cleanPairs'])) { g.reserved.add(placed.get(n.id)!.cellId); g.reserved.add(placed.get(m!.id)!.cellId); }
  }
  // 上下に重なる型: 1 つの階の区画の天井は、上の階の床より下（区画が重ならない。階をまたぐ区画は除く）
  if (sk.stories > 1) {
    for (const pl of new Set(placed.values())) {
      const spans = sk.nodes.filter((m) => placed.get(m.id) === pl).some((m) => m.story !== pl.node.story);
      // 床に沈めた水槽（0.5 m）が下の階の天井に掛からないよう、上の階の床との間を 0.8 m 空ける
      if (!spans) pl.height = Math.min(pl.height, snap(SH - 1.0));
    }
  }
  // 区画の作り（中庭・吹き抜け・巨大空間 …）: 置き場所の形・天井・中に入る区画を決める（開口はまだ）
  applyNodeStyles(g, sk, placed, { S, SH, cw, hc, cx, cz, yOf, rng: rng.fork('styles') });

  // ---------------------------------------------------------------- 廊下（つなぎごと）
  let ci = 0;
  for (const l of sk.links) {
    const A = placed.get(l.a), B = placed.get(l.b);
    if (!A || !B || A === B) continue; // 同じ広間・階段室の中
    const na = sk.nodes[l.a]!, nb = sk.nodes[l.b]!;
    const axis: 'x' | 'z' = na.row === nb.row ? 'x' : 'z';
    const aFirst = axis === 'x' ? A.rect.x1 <= B.rect.x0 + 1e-6 : A.rect.z1 <= B.rect.z0 + 1e-6;
    const [F, T] = aFirst ? [A, B] : [B, A];
    const [nF, nT] = aFirst ? [na, nb] : [nb, na];
    const yF = yOf(nF), yT = yOf(nT);
    const start = axis === 'x' ? F.rect.x1 : F.rect.z1;
    const end = axis === 'x' ? T.rect.x0 : T.rect.z0;
    const L = end - start;
    const center = axis === 'x' ? cz(na.row) : cx(na.col);
    const lf = famOf(p, nF.fam !== undefined ? nF : nT);
    const style = l.style ?? 'corridor';
    const lcw0 = l.width ?? (style === 'walkway' ? t['structure.walkway.widthM'] : style === 'bridge' ? t['structure.bridge.widthM'] : style === 'staff' ? t['structure.staff.widthM'] : cwOf(lf));
    // 階段室につながる廊下は、踊り場の奥行きより狭く（角で隣の廊下と重ならない）
    const lcw = na.kind === 'well' || nb.kind === 'well' ? Math.min(lcw0, 1.7) : lcw0;
    const lhc = l.height ?? (style === 'staff' ? t['structure.staff.heightM'] : hcOf(lf));
    const h = Math.min(lhc, F.height, T.height);
    const dirPos: Dir = axis === 'x' ? 1 : 0; // 軸の正の向き
    const dirNeg: Dir = axis === 'x' ? 3 : 2;
    // 部屋は基本的に扉の向こう（扉を開けるまで中が見えない。docs/game-design.md 2 章）。広間は一部だけ。入口・出口の部屋は扉なし
    // 段階 4: 階段室は防火扉（structure.wellDoorChance）。地下街の店は開いた店先が多い
    const doorOf = (P: Placed): boolean => P.node.kind === 'well' ? doorRng.chance(t['structure.wellDoorChance'])
      : P.node.id !== sk.entry && P.node.id !== sk.exit && (P.kind === 'room' ? doorRng.chance(p.pattern === 'arcade' ? 0.35 : t['floor.roomDoorChance']) : P.kind === 'hall' ? doorRng.chance(t['floor.hallDoorChance']) : false);
    // 壁 1 枚でつながる（区画いっぱいの部屋どうし。一方通行の扉もここ）
    if (style === 'direct' || (Math.abs(L) < 0.05 && F.node.style === 'full' && T.node.style === 'full')) {
      if (Math.abs(L) > 0.05) throw new GenError(`壁 1 枚でつなぐ区画が接していません: ${l.a}-${l.b}（${L.toFixed(2)} m）`);
      directJoin(g, F, T, axis, start, yF, center, doorOf(F) || doorOf(T), l, sk, doorRng);
      continue;
    }
    // 段階 4: 1.2 m 未満の廊下（扉の厚みほどの切れ端）は作らない（扉が 2 枚くっつく・開口の前に立てない）
    if (L < 1.2) throw new GenError(`区画が近すぎます: ${l.a}-${l.b}`);
    // 一方通行の扉: 開けられない側（from でない側）の区画の開口に扉を付け、廊下の側からだけ開く
    const oneWay = style === 'oneWay';
    const lockedSide: Placed | null = oneWay ? (placed.get(l.from ?? -1) === F ? T : F) : null;
    let doorF = lockedSide ? lockedSide === F : doorOf(F);
    let doorT = lockedSide ? lockedSide === T : doorOf(T);
    // 段階 4: 短い廊下（1.4 m 未満）の両端に扉を付けない（2 枚の扉がくっついて、片方を開けてももう片方が開かない）
    if (L < 1.4 && doorF && doorT && !lockedSide) doorT = false;
    // 裏の通路: 客用の側の端に扉（関係者以外）
    if (style === 'staff') { doorF = nF.style !== 'staff' && F.kind !== 'junction'; doorT = nT.style !== 'staff' && T.kind !== 'junction'; if (!doorF && !doorT) { if (nF.style !== 'staff') doorF = true; else if (nT.style !== 'staff') doorT = true; } }
    // 屋外の渡り廊下・橋: 扉は建物の側（部屋なら確率で）
    const roomOpening = (pl: Placed, dir: Dir, coord: number, door: boolean, y: number): WallOpening => {
      const span = axis === 'x' ? pl.rect.z1 - pl.rect.z0 : pl.rect.x1 - pl.rect.x0;
      // 曲がり角は廊下の幅いっぱい（区画の幅 = 廊下の幅 + 壁）。部屋・広間は壁の端を 0.6 m ずつ残す
      // 階段室は踊り場の奥行きに収まる幅
      const width = door ? DOOR_W : pl.node.kind === 'well' ? 1.4 : pl.kind === 'junction' ? Math.min(lcw, span - 2 * WALL_T) : Math.min(lcw, span - 1.2);
      const pos: Vec3 = axis === 'x' ? [coord, y, center] : [center, y, coord];
      return opening(`${pl.cellId}:${l.a}-${l.b}`, pos, dir, width, door ? DOOR_H : Math.min(h, pl.height - 0.2));
    };
    const oF = roomOpening(F, dirPos, start, doorF, yF);
    const oT = roomOpening(T, dirNeg, end, doorT, yT);
    g.addOpening(F.cellId, oF);
    g.addOpening(T.cellId, oT);

    // 区画に分ける（段差があれば 平ら / 階段 / 平ら）
    const segs: StraightSpec[] = [];
    const lpal = style === 'staff' ? { ...themePalette('CorridorService'), lightIntensity: themePalette('CorridorService').lightIntensity * 0.7 } : lf === fam ? undefined : themePalette(lf.corridor);
    const mk = (id: string, a0: number, a1: number, y: number, height: number, kind: DressKind, stairs?: StraightSpec['stairs']): StraightSpec => {
      const s: StraightSpec = { id, axis, a0, a1, center, width: lcw, y, height, kind, role: 'connector', name: kind === 'stairs' ? '階段' : style === 'staff' ? '裏の通路' : style === 'walkway' ? '渡り廊下' : style === 'bridge' ? '橋' : '廊下' };
      if (stairs) s.stairs = stairs;
      if (lpal) s.palette = lpal;
      if (style === 'staff') { s.theme = 'CorridorService'; s.audio = '換気・反響'; s.materialKey = `corr:${p.id}:staff`; }
      else if (lf !== fam) { s.theme = lf.corridor; s.audio = lf.corridorAudio; s.materialKey = `corr:${p.id}:${lf.id}`; }
      if (style === 'walkway' || style === 'bridge') s.outdoor = { rail: t['structure.railM'], style, ...(sk.below ? { below: sk.below } : {}), fog: [t['structure.outdoor.fogNear'], t['structure.outdoor.fogFar']] };
      const age = Math.max(nF.age ?? 0, nT.age ?? 0);
      if (age > 0) { s.lightMul = 1 - (1 - t['structure.concentric.innerLight']) * age; s.palette = agedPalette(s.palette ?? g.corridorPalette, age, t['structure.concentric.innerLight']); }
      if (p.pattern === 'arcade' && kind === 'corridor') (s.post ??= []).push((cell) => arcadeCorridor(g, cell, s));
      return s;
    };
    if (Math.abs(yF - yT) < 1e-6) segs.push(mk(`c${ci++}`, start, end, yF, h, 'corridor'));
    else if (style === 'drop') {
      // 飛び降りる段差: 高い床の端から下の床へ（上へは戻れない）。段差の手前に黄色い線
      const rise = Math.abs(yT - yF);
      if (L < 2.4) throw new GenError(`飛び降りの廊下が短すぎます: ${l.a}-${l.b}`);
      const s = mk(`d${ci++}`, start, end, Math.min(yF, yT), rise + h, 'stairs');
      s.drop = { highEnd: yF > yT ? 'a0' : 'a1', edge: snap(Math.max(1.0, L * 0.45)), rise };
      s.name = '段差';
      segs.push(s);
    } else {
      const rise = Math.abs(yT - yF);
      const n = Math.ceil(rise / RISER_MAX - 1e-9);
      const Ls = n * TREAD;
      // 段は開口から 0.8 m 以上離す（開口のすぐ先で上り始めると、上の壁（まぐさ）に頭が当たって段を登れない）
      if (L < Ls + 1.6) throw new GenError(`階段が収まりません: ${l.a}-${l.b}（${L.toFixed(2)} m < ${(Ls + 1.6).toFixed(2)} m）`);
      const flat = snap((L - Ls) / 2);
      const low = Math.min(yF, yT);
      // 低い端: F が低ければ a0 側（start）、T が低ければ a1 側（end）
      const lowEnd: 'a0' | 'a1' = yF < yT ? 'a0' : 'a1';
      // 平らな部分が長ければ廊下の区画に分ける。階段の区画の両端には 0.8 m の平らな所を含める（段の上り始めを開口から離す）。
      // 平らな部分が短い（2 m 未満）ときは階段の区画にまとめる（短い切れ端の区画を作らない）
      const PAD = 0.8;
      if (flat >= 2.0) {
        segs.push(mk(`c${ci++}`, start, snap(start + flat - PAD), yF, h, 'corridor'));
        segs.push(mk(`s${ci++}`, snap(start + flat - PAD), snap(end - flat + PAD), low, rise + h, 'stairs', { lowEnd, offset: PAD, rise }));
        segs.push(mk(`c${ci++}`, snap(end - flat + PAD), end, yT, h, 'corridor'));
      } else {
        segs.push(mk(`s${ci++}`, start, end, low, rise + h, 'stairs', { lowEnd, offset: flat, rise }));
      }
    }
    g.straights.push(...segs);
    // 区画の端の床の高さ（階段は低い端・高い端で違う）
    const endY = (s: StraightSpec, side: 'a0' | 'a1'): number => (s.stairs ? (side === s.stairs.lowEnd ? s.y : s.y + s.stairs.rise) : s.drop ? (side === s.drop.highEnd ? s.y + s.drop.rise : s.y) : s.y);
    // 廊下の両端の開口: 部屋・広間につながる端は、その部屋の開口と同じ大きさ（扉なら扉の大きさ）。廊下どうしの端は廊下の幅いっぱい。
    // 大きさが違うと、廊下の突き当たりの壁が扉より大きく開き、扉が閉じている間（向こうの区画を描かない）は扉の周りが穴に見えた
    segs.forEach((s, i) => {
      const w0 = i === 0 ? oF.width : lcw, h0 = i === 0 ? oF.height : h;
      const w1 = i === segs.length - 1 ? oT.width : lcw, h1 = i === segs.length - 1 ? oT.height : h;
      g.addOpening(s.id, opening(`${s.id}:a0`, axis === 'x' ? [s.a0, endY(s, 'a0'), center] : [center, endY(s, 'a0'), s.a0], dirNeg, w0, h0));
      g.addOpening(s.id, opening(`${s.id}:a1`, axis === 'x' ? [s.a1, endY(s, 'a1'), center] : [center, endY(s, 'a1'), s.a1], dirPos, w1, h1));
      if (s.outdoor) railingSides(s, g);
    });
    // 区画どうしの portal と扉。一方通行の扉は、開けられる側（廊下）を cells[0] にする（歩く人は cells[0] → cells[1] の向きだけ通る）
    const doorMat = (pl: Placed): MatId => (style === 'staff' ? 'doorMetal' : themePalette(pl.theme).door);
    const joinEnd = (roomPl: Placed, corr: string, roomFirst: boolean, coord: number, y: number, o: WallOpening, door: boolean, swing: number): void => {
      const locked = lockedSide === roomPl;
      const spec: DoorSpec | null = door ? { cell: roomPl.cellId, mat: doorMat(roomPl), swing } : null;
      // 一方通行: 廊下の側（部屋が手前なら座標の大きい側）にいる人だけが開けられる。portal は廊下 → 部屋の向き
      if (spec && locked) spec.openSide = roomFirst ? 1 : -1;
      if (locked) g.join(corr, roomPl.cellId, axis, coord, center, y, o.width, o.height, roomFirst ? dirNeg : dirPos, spec);
      else if (roomFirst) g.join(roomPl.cellId, corr, axis, coord, center, y, o.width, o.height, dirPos, spec);
      else g.join(corr, roomPl.cellId, axis, coord, center, y, o.width, o.height, dirPos, spec);
    };
    joinEnd(F, segs[0]!.id, true, start, yF, oF, doorF, -1);
    for (let i = 0; i + 1 < segs.length; i++) g.join(segs[i]!.id, segs[i + 1]!.id, axis, segs[i]!.a1, center, endY(segs[i]!, 'a1'), lcw, h, dirPos, null);
    joinEnd(T, segs[segs.length - 1]!.id, false, end, yT, oT, doorT, 1);
  }

  // ---------------------------------------------------------------- 窓（見えるが通れない）
  for (const w of sk.windows) {
    const A = placed.get(w.a), B = placed.get(w.b);
    if (!A || !B || A === B) continue;
    windowJoin(g, A, B, yOf(sk.nodes[w.a]!), rng.fork(`win${w.a}-${w.b}`));
  }

  // ---------------------------------------------------------------- 果てしない階の区域: 入口と出口の階段の代わりに、境目の扉までの廊下と階段室（ports.ts）
  if (p.region) {
    regionPorts(g, sk, placed, { hc, doorRng });
    for (const pl of new Set(placed.values())) g.cell(pl);
    if (sk.hatches?.length) buildCrawl(g, sk, placed, { S, cx, cz });
    if (sk.mirror) g.afterDress.push((env) => mirrorFinish(g, sk, placed, env));
    return g.finish(sk);
  }

  // ---------------------------------------------------------------- 入口の階段（降りてきた階段。上は閉ざされた扉）
  const entry = placed.get(sk.entry)!;
  entryStairs(g, entry, hc);

  // ---------------------------------------------------------------- 出口の階段（次の階へ降りる）。迷路フロアは出口が複数
  const exitOf = (node: number, id: string, exitId: string, doorId: string, to?: string): void => {
    const pl = placed.get(node)!;
    const en = sk.nodes[node]!;
    const usedDirs = new Set((adj.get(en.id) ?? []).map((m): Dir => { const o = sk.nodes[m]!; return o.col > en.col ? 1 : o.col < en.col ? 3 : o.row > en.row ? 2 : 0; }));
    // 窓・階段室の向きも使えない
    for (const w of sk.windows) if (w.a === node || w.b === node) { const o = sk.nodes[w.a === node ? w.b : w.a]!; usedDirs.add(o.col > en.col ? 1 : o.col < en.col ? 3 : o.row > en.row ? 2 : 0); }
    const cands: Dir[] = [];
    if (en.row === sk.rows - 1) cands.push(2);
    if (en.col === 0) cands.push(3);
    if (en.col === sk.cols - 1) cands.push(1);
    if (en.row === 0) cands.push(0);
    const dir = cands.find((d) => !usedDirs.has(d) && !(d === 0 && en.id === sk.entry)) ?? cands[0] ?? 2;
    exitStairs(g, pl, dir, yOf(en), hc, { id, exitId, doorId, ...(to ? { to } : {}) });
  };
  exitOf(sk.exit, 'exitStairs', 'down', 'door:exit');
  sk.extraExits.forEach((x, i) => exitOf(x.node, `exitStairs${i + 2}`, `down${i + 2}`, `door:exit${i + 2}`, x.to));

  // ---------------------------------------------------------------- 区画を作る（開口がそろってから）
  for (const pl of new Set(placed.values())) g.cell(pl);
  if (sk.hatches?.length) buildCrawl(g, sk, placed, { S, cx, cz });
  if (sk.mirror) g.afterDress.push((env) => mirrorFinish(g, sk, placed, env));
  return g.finish(sk);
}

/** 壁 1 枚でつながる区画（区画いっぱいの部屋）: 重なる辺の範囲のどこかに扉（か開口） */
function directJoin(g: GeoBuild, F: Placed, T: Placed, axis: 'x' | 'z', coord: number, y: number, center: number, wantDoor: boolean, l: SkelLink, sk: Skeleton, rng: Rng): void {
  const [lo, hi] = axis === 'x' ? [Math.max(F.rect.z0, T.rect.z0), Math.min(F.rect.z1, T.rect.z1)] : [Math.max(F.rect.x0, T.rect.x0), Math.min(F.rect.x1, T.rect.x1)];
  const m = 1.0;
  if (hi - lo < DOOR_W + 2 * m) throw new GenError(`壁 1 枚でつなぐ辺が短すぎます: ${l.a}-${l.b}`);
  // 扉の位置: 鏡写しは辺の真ん中、ほかは辺の中のどこか（くねる感じ）
  const r = new Rng(hashAll(g.p.seed, 'direct', l.a, l.b));
  const mid = Math.min(hi - m - DOOR_W / 2, Math.max(lo + m + DOOR_W / 2, center));
  const at = sk.mirror ? mid : snap(r.float(lo + m + DOOR_W / 2, hi - m - DOOR_W / 2));
  const oneWay = l.style === 'oneWay' || l.from !== undefined;
  const door = wantDoor || oneWay;
  const width = door ? DOOR_W : Math.min(2.0, hi - lo - 2 * m);
  const height = door ? DOOR_H : Math.min(2.4, F.height - 0.2, T.height - 0.2);
  const dirPos: Dir = axis === 'x' ? 1 : 0, dirNeg: Dir = axis === 'x' ? 3 : 2;
  g.addOpening(F.cellId, opening(`${F.cellId}:${l.a}-${l.b}`, axis === 'x' ? [coord, y, at] : [at, y, coord], dirPos, width, height));
  g.addOpening(T.cellId, opening(`${T.cellId}:${l.a}-${l.b}`, axis === 'x' ? [coord, y, at] : [at, y, coord], dirNeg, width, height));
  if (!door) { g.join(F.cellId, T.cellId, axis, coord, at, y, width, height, dirPos, null); return; }
  if (oneWay) {
    // 開けられる側（from）が cells[0]。扉は from の側にいる人だけが開けられる
    const fromPl = g.placedOf?.(l.from ?? -1) === T ? T : F;
    const other = fromPl === F ? T : F;
    const side = fromPl === F ? -1 : 1;
    g.join(fromPl.cellId, other.cellId, axis, coord, at, y, width, height, fromPl === F ? dirPos : dirNeg, { cell: other.cellId, mat: 'doorMetal', swing: fromPl === F ? 1 : -1, openSide: side, idSuffix: ':oneway' });
    return;
  }
  g.join(F.cellId, T.cellId, axis, coord, at, y, width, height, dirPos, { cell: rng.chance(0.5) ? F.cellId : T.cellId, mat: themePalette(T.theme).door, swing: rng.chance(0.5) ? 1 : -1 });
}

/**
 * 隣り合う区画の壁の窓（ガラス。portal 'window' で向こうが見える）。重なる辺の、開口と重ならない所に。置けなければ何もしない
 */
function windowJoin(g: GeoBuild, A: Placed, B: Placed, y: number, rng: Rng): void {
  let axis: 'x' | 'z', coord: number, lo: number, hi: number, aFirst: boolean;
  if (Math.abs(A.rect.x1 - B.rect.x0) < 0.05 || Math.abs(B.rect.x1 - A.rect.x0) < 0.05) {
    axis = 'x'; aFirst = Math.abs(A.rect.x1 - B.rect.x0) < 0.05; coord = aFirst ? A.rect.x1 : A.rect.x0;
    lo = Math.max(A.rect.z0, B.rect.z0); hi = Math.min(A.rect.z1, B.rect.z1);
  } else if (Math.abs(A.rect.z1 - B.rect.z0) < 0.05 || Math.abs(B.rect.z1 - A.rect.z0) < 0.05) {
    axis = 'z'; aFirst = Math.abs(A.rect.z1 - B.rect.z0) < 0.05; coord = aFirst ? A.rect.z1 : A.rect.z0;
    lo = Math.max(A.rect.x0, B.rect.x0); hi = Math.min(A.rect.x1, B.rect.x1);
  } else return;
  const width = Math.min(2.4, hi - lo - 2.0);
  if (width < 1.0) return;
  const sill = 0.95, height = Math.min(1.25, Math.min(A.height, B.height) - sill - 0.35);
  if (height < 0.6) return;
  const [F, T] = aFirst ? [A, B] : [B, A];
  const dirPos: Dir = axis === 'x' ? 1 : 0, dirNeg: Dir = axis === 'x' ? 3 : 2;
  const along = (o: WallOpening): number => (axis === 'x' ? o.pos[2] : o.pos[0]);
  const on = (o: WallOpening): boolean => Math.abs((axis === 'x' ? o.pos[0] : o.pos[2]) - coord) < 0.05 && (o.dir === dirPos || o.dir === dirNeg);
  const busy = [...(g.openings.get(F.cellId) ?? []), ...(g.openings.get(T.cellId) ?? [])].filter(on);
  const free = (at: number): boolean => busy.every((o) => Math.abs(along(o) - at) > o.width / 2 + width / 2 + 0.4);
  const cands: number[] = [];
  for (let at = lo + 1.0 + width / 2; at <= hi - 1.0 - width / 2 + 1e-6; at += 0.5) if (free(at)) cands.push(snap(at));
  if (!cands.length) return;
  const mid = (lo + hi) / 2;
  cands.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
  const at = cands[Math.min(cands.length - 1, rng.int(0, Math.min(2, cands.length - 1)))]!;
  const pos: Vec3 = axis === 'x' ? [coord, y, at] : [at, y, coord];
  g.addOpening(F.cellId, opening(`${F.cellId}:win:${T.cellId}`, pos, dirPos, width, height, sill));
  g.addOpening(T.cellId, opening(`${T.cellId}:win:${F.cellId}`, pos, dirNeg, width, height, sill));
  // ガラス（2 枚の壁の真ん中。当たり判定あり）と窓枠の下の桟
  const glass = axis === 'x' ? box([coord - 0.02, y + sill, at - width / 2], [coord + 0.02, y + sill + height, at + width / 2], 'glass') : box([at - width / 2, y + sill, coord - 0.02], [at + width / 2, y + sill + height, coord + 0.02], 'glass');
  g.addBox(F.cellId, glass);
  g.out.portals.push(portal(`p:${F.cellId}:${T.cellId}:win`, F.cellId, T.cellId, portalAabb(axis, coord, at, width, y + sill, height), dirPos, 'window'));
}

/** 入口の階段（降りてきた階段。上は閉ざされた扉）。出てくる位置は入口の区画の中 */
export function entryStairs(g: GeoBuild, entry: Placed, hc: number, opts: { x?: number; height?: number } = {}): void {
  const LH = g.t['floor.levelHeightM'];
  const x = opts.x ?? snap((entry.rect.x0 + entry.rect.x1) / 2);
  const z0 = entry.rect.z1;
  const rise = LH;
  const n = Math.ceil(rise / RISER_MAX - 1e-9);
  const len = snap(0.8 + n * TREAD + 1.4);
  const openH = Math.min(2.4, entry.height - 0.2, hc);
  g.straights.push({ id: 'entryStairs', axis: 'z', a0: z0, a1: z0 + len, center: x, width: 2.2, y: entry.y, height: rise + (opts.height ?? hc), kind: 'stairs', role: 'entry', name: '降りてきた階段', stairs: { lowEnd: 'a0', offset: 0.8, rise } });
  g.addOpening(entry.cellId, opening(`${entry.cellId}:entryStairs`, [x, entry.y, z0], 0, 1.6, openH));
  g.addOpening('entryStairs', opening('entryStairs:a0', [x, entry.y, z0], 2, 1.6, openH));
  g.out.portals.push(portal('p:entryStairs', entry.cellId, 'entryStairs', portalAabb('z', z0, x, 1.6, entry.y, openH), 0, 'opening'));
  // 閉ざされた扉（上の踊り場の突き当たり。開かない）
  const zEnd = z0 + len - WALL_T;
  g.out.entities.push({ id: 'door:entryBack', type: 'door', cell: 'entryStairs', params: { panel: aabbJson({ min: [x - 0.5, entry.y + rise, zEnd - 0.05], max: [x + 0.5, entry.y + rise + DOOR_H, zEnd - 0.01] }), axis: 'z', mat: g.corridorPalette.door, locked: true, autoCloseSec: 0 } });
  g.out.spawn = { pos: [x, entry.y + 0.02, snap(z0 - 1.2)], yaw: 0, cell: entry.cellId };
}

/** 出口の階段（次の階へ降りる）。区画 pl の向き dir の辺の外へ。y は出口の区画の床（背の高い区画では、出口の階の床） */
export function exitStairs(g: GeoBuild, pl: Placed, dir: Dir, y: number, hc: number, o: { id: string; exitId: string; doorId: string; to?: string; at?: number; outdoor?: boolean; doorW?: number; doorH?: number } = { id: 'exitStairs', exitId: 'down', doorId: 'door:exit' }): void {
  const LH = g.t['floor.levelHeightM'];
  const r = pl.rect;
  const rise = LH;
  const n = Math.ceil(rise / RISER_MAX - 1e-9);
  const len = snap(1.2 + n * TREAD + 1.6);
  const axis: 'x' | 'z' = dir === 0 || dir === 2 ? 'z' : 'x';
  const c = o.at ?? (axis === 'z' ? snap((r.x0 + r.x1) / 2) : snap((r.z0 + r.z1) / 2));
  const edge = dir === 0 ? r.z1 : dir === 2 ? r.z0 : dir === 1 ? r.x1 : r.x0;
  const sgn = dir === 0 || dir === 1 ? 1 : -1;
  const a0 = Math.min(edge, edge + sgn * len), a1 = Math.max(edge, edge + sgn * len);
  const low = y - rise;
  // 低い端は扉から遠い方。段は扉から 1.2 m 先から下がる → 低い端からの距離 = len − 1.2 − 段の長さ
  const lowEnd: 'a0' | 'a1' = sgn > 0 ? 'a1' : 'a0';
  const bottomLen = len - 1.2 - n * TREAD;
  const spec: StraightSpec = { id: o.id, axis, a0, a1, center: c, width: 2.2, y: low, height: rise + hc, kind: 'exit', role: 'exit', name: '下りの階段', stairs: { lowEnd, offset: bottomLen, rise }, lightMat: 'lightGreen' };
  if (o.outdoor) spec.outdoor = { rail: g.t['structure.railM'], style: 'walkway', fog: [g.t['structure.outdoor.fogNear'], g.t['structure.outdoor.fogFar']] };
  g.straights.push(spec);
  // 扉の大きさ（縮むくり返しの最後の部屋は小さい扉）
  const dw = o.doorW ?? DOOR_W, dh = o.doorH ?? DOOR_H;
  const roomSide = opening(`${pl.cellId}:${o.id}`, axis === 'z' ? [c, y, edge] : [edge, y, c], dir, dw, dh);
  g.addOpening(pl.cellId, roomSide);
  g.addOpening(o.id, opening(`${o.id}:top`, axis === 'z' ? [c, y, edge] : [edge, y, c], ((dir + 2) % 4) as Dir, dw, dh));
  if (o.outdoor) railingSides(spec, g);
  g.out.entities.push({ id: o.doorId, type: 'door', cell: pl.cellId, params: { panel: aabbJson(doorPanel(axis, edge, c, dw, y, dh)), axis, mat: 'doorMetal', hinge: 1, swing: sgn } });
  g.out.portals.push(portal(`p:${o.id}`, pl.cellId, o.id, portalAabb(axis, edge, c, dw, y, dh), dir, 'door', o.doorId));
  // 扉の上の非常口の灯り（部屋の内側の壁）
  const inner = edge - sgn * WALL_T;
  const ly = y + dh + 0.12;
  g.addBox(pl.cellId, axis === 'z'
    ? box([c - 0.25, ly, Math.min(inner, inner - sgn * 0.05)], [c + 0.25, ly + 0.14, Math.max(inner, inner - sgn * 0.05)], 'lightGreen', false)
    : box([Math.min(inner, inner - sgn * 0.05), ly, c - 0.25], [Math.max(inner, inner - sgn * 0.05), ly + 0.14, c + 0.25], 'lightGreen', false));
  // 下の踊り場の FloorExit
  const b0 = sgn > 0 ? a1 - bottomLen : a0, b1 = sgn > 0 ? a1 : a0 + bottomLen;
  const ex: FloorExit = { id: o.exitId, kind: 'stairs', aabb: axis === 'z' ? { min: [c - 1.1, low - 0.5, b0], max: [c + 1.1, low + 2, b1] } : { min: [b0, low - 0.5, c - 1.1], max: [b1, low + 2, c + 1.1] } };
  if (o.to) ex.to = { floor: o.to };
  g.out.exits.push(ex);
}

/** 廊下・階段の区画 */
export function buildStraight(s: StraightSpec, ops: WallOpening[], palette: Palette, materialKey: string, theme: string, audio: string): CellLayout {
  const rect: Rect = s.axis === 'x' ? { x0: s.a0, x1: s.a1, z0: snap(s.center - s.width / 2), z1: snap(s.center + s.width / 2) } : { x0: snap(s.center - s.width / 2), x1: snap(s.center + s.width / 2), z0: s.a0, z1: s.a1 };
  if (s.outdoor) return outdoorStraight(s, rect, ops, palette, materialKey, theme, audio);
  const cell = makeCell({ id: s.id, role: s.role, rects: [rect], height: s.height, floorY: s.y, palette, theme, name: s.name, audioPreset: audio, materialKey, openings: ops, lights: 'none', ...(s.floorHoles ? { floorHoles: s.floorHoles } : {}) });
  const len = s.a1 - s.a0;
  // 照明: 真ん中に並べる（階段は天井の高さが一定なので同じ）
  const nL = Math.max(1, Math.round(len / 2.6));
  const mul = s.lightMul ?? 1;
  for (let i = 0; i < nL; i++) {
    const at = s.a0 + (len / nL) * (i + 0.5);
    const top = s.y + s.height;
    const [lx, lz] = s.axis === 'x' ? [at, s.center] : [s.center, at];
    // 暗い区画（古い区画）は器具の一部を消す
    const off = mul < 0.999 && i % 2 === 1;
    lightPanel(cell.boxes, lx, lz, s.axis === 'x' ? 1.2 : 0.6, s.axis === 'x' ? 0.6 : 1.2, top, off ? 'lightOff' : s.lightMat ?? palette.light);
    if (!off && (i % 2 === 0 || nL === 1)) cell.lights.push({ pos: [lx, top - 0.4, lz], color: s.lightMat === 'lightGreen' ? 0xb8f0c0 : palette.lightColor, intensity: palette.lightIntensity * (s.lightMat ? 0.6 : 1) * mul, distance: 7 });
  }
  // 階段: 低い端から offset の所から段を上げ、上がりきった先は踊り場（高い床）
  if (s.stairs) {
    const { lowEnd, offset, rise } = s.stairs;
    const tread = s.stairs.tread ?? TREAD;
    const n = Math.ceil(rise / RISER_MAX - 1e-9);
    const riser = rise / n;
    const w0 = s.center - s.width / 2 + WALL_T, w1 = s.center + s.width / 2 - WALL_T;
    const at = (d: number): number => (lowEnd === 'a0' ? s.a0 + d : s.a1 - d); // 低い端からの距離 → 座標
    const slab = (d0: number, d1: number, top: number, kind: string): void => {
      const p0 = Math.min(at(d0), at(d1)), p1 = Math.max(at(d0), at(d1));
      if (p1 - p0 < 1e-3) return;
      const b = s.axis === 'x' ? box([p0, s.y, w0], [p1, top, w1], palette.floor) : box([w0, s.y, p0], [w1, top, p1], palette.floor);
      b.kind = kind;
      cell.boxes.push(b);
    };
    for (let i = 0; i < n; i++) slab(offset + i * tread, offset + (i + 1) * tread, s.y + (i + 1) * riser, 'stairStep');
    slab(offset + n * tread, len, s.y + rise, 'landing');
  }
  // 飛び降りる段差: 高い端から edge までが高い床。縁に黄色い線
  if (s.drop) {
    const { highEnd, edge, rise } = s.drop;
    const w0 = s.center - s.width / 2 + WALL_T, w1 = s.center + s.width / 2 - WALL_T;
    const p0 = highEnd === 'a0' ? s.a0 : s.a1 - edge, p1 = highEnd === 'a0' ? s.a0 + edge : s.a1;
    const b = s.axis === 'x' ? box([p0, s.y, w0], [p1, s.y + rise, w1], palette.floor) : box([w0, s.y, p0], [w1, s.y + rise, p1], palette.floor);
    b.kind = 'landing';
    cell.boxes.push(b);
    const e = highEnd === 'a0' ? p1 : p0;
    const e0 = Math.min(e, e - (highEnd === 'a0' ? 0.12 : -0.12)), e1 = Math.max(e, e - (highEnd === 'a0' ? 0.12 : -0.12));
    cell.boxes.push(s.axis === 'x' ? box([e0, s.y + rise, w0], [e1, s.y + rise + 0.005, w1], 'yellowLine', false) : box([w0, s.y + rise, e0], [w1, s.y + rise + 0.005, e1], 'yellowLine', false));
  }
  if (s.extra) cell.boxes.push(...s.extra);
  return cell;
}
