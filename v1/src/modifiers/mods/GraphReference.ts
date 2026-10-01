/**
 * GraphReference — グラフ上の他ノードの定義を額縁写真として展示する（E14 予測写真室 / L16 空間博物館 / M16 没部屋博物館）。
 * params: mode('past' | 'adjacent'), count。
 *
 * 展示内容（グラフ状態に依存するので onNodeCreated で node.state.modifierState.GraphReference に固定し、再生成・ロード後も同じ）:
 *   past（L16）    : world.graph.visitLog を新しい順に走査し、アダプタ以外で相異なる definitionId を count 件（足りない分は空の額縁）。
 *   adjacent（E14）: ノード生成時は Portal が無いので、最初に可視になったフレーム（RoomEffect.update）で node.portals の targetRoomId
 *                    （Adapter は先の部屋まで辿る）から count 件を確定して保存する（1 hop で確定済み = 予測ではない）。施錠 / 行き先無しは黒い写真。
 *                    未確定の Seam 先があるうちは保存せず 2 秒ごとに再解決する。
 *   unlisted（M16）: params.mode より接続ルール「通常生成から除外されたテンプレ候補」を優先し、ROOMS のうち discoveredIds に無い定義から
 *                    node.seed 由来の乱数で count 件。名札は定義名のみ（ID・レア度は出さない）。
 * 表示:
 *   layout: 外壁の壁面スロット（ソケット・内装を避ける）に 額縁箱（trim）+ 名札 L.signs（id 'gr:<i>'、SignAtlas 1 枚 = 16 セル以内）。
 *   build : 写真面（1 部屋 1 枚の CanvasTexture に全展示の縮小図を詰める）を額縁の中に置き、RoomEffect が最初の update で
 *           展示内容を解決 → 縮小図（対象 layout の footprint シルエット + レア度色の枠）を描き、built.updateSign で名札を差し替える。
 * ジオメトリは layout で確定。build/update はテクスチャと名札文字だけを変える。
 */
import * as THREE from 'three';
import type { ModifierImpl, RuntimeContext } from '../types';
import type { BuiltRoom, RoomEffect } from '../../render/RoomBuilder';
import type { Rarity, RoomDefinition, RoomInstance, Vec3 } from '../../core/types';
import { Rng, hashString } from '../../core/rng';
import type { WorldManager } from '../../world/WorldManager';
import { isImplemented, RARITY_COLOR, ROOM_BY_ID, ROOMS, TEMPLATE_BY_ID } from '../../data';
import type { GenParams, RoomLayout, SignSpec } from '../../generators/layout';
import type { Rect } from '../../generators/footprint';
import { paletteFor } from '../../generators/presets';
import { generateRoom } from '../../generators/RoomGenerator';
import { generateCorridor } from '../../generators/CorridorGenerator';
import { generateParking } from '../../generators/ParkingGenerator';
import { generateVertical } from '../../generators/VerticalGenerator';
import { generateGrid } from '../../generators/GridGenerator';
import { generateAtrium } from '../../generators/AtriumGenerator';
import { num, str } from '../util';
import { frameBoxes, wallSlots, yawOf } from './GraphReference.wall';

const ID = 'GraphReference';
const SIGN_PREFIX = 'gr:';
const SIGN_W = 0.9;
const SIGN_H = SIGN_W / 4;
const SIGN_Y = 1.1;
const PHOTO_W = 1.2;
const PHOTO_H = 0.9;
const PHOTO_Y = SIGN_Y + SIGN_H / 2 + 0.12 + PHOTO_H / 2;
const FRAME_T = 0.05;
const FRAME_D = 0.04;
/** 縮小図のセル（4:3） */
const CELL_W = 256;
const CELL_H = 192;

type Mode = 'past' | 'adjacent' | 'unlisted';

/** JSON 化可能な展示 1 件 */
interface Exhibit {
  /** null なら空の額縁 */
  defId: string | null;
  name: string;
  sub?: string;
  /** unlisted では出さない */
  rarity?: Rarity;
  /** 対象レイアウトの footprint（[x0, z0, x1, z1]） */
  footprint?: [number, number, number, number][];
  roomId?: string;
  /** 施錠 / 行き先無し（黒い写真） */
  locked?: boolean;
  /** Seam など先が未確定（'？'） */
  unknown?: boolean;
}

interface GRState {
  mode: Mode;
  count: number;
  /** null = 未確定（adjacent は最初の可視フレームで確定） */
  exhibits: Exhibit[] | null;
}

function effectiveMode(def: RoomDefinition, params: Record<string, unknown>): Mode {
  if (def.id === 'M16' || /除外/.test(def.connectionRule ?? '')) return 'unlisted';
  return str(params.mode, 'past') === 'adjacent' ? 'adjacent' : 'past';
}

function countOf(params: Record<string, unknown>): number {
  return Math.max(1, Math.min(16, Math.round(num(params.count, 4))));
}

function stateOf(node: RoomInstance): GRState | null {
  const s = node.state.modifierState?.[ID] as GRState | undefined;
  return s && typeof s === 'object' && typeof s.mode === 'string' ? s : null;
}

function saveState(node: RoomInstance, s: GRState): void {
  if (!node.state.modifierState) node.state.modifierState = {};
  node.state.modifierState[ID] = s;
}

function roundRects(rects: readonly Rect[]): [number, number, number, number][] {
  const r1 = (v: number) => Math.round(v * 10) / 10;
  return rects.map((r) => [r1(r.x0), r1(r.z0), r1(r.x1), r1(r.z1)]);
}

function exhibitOfDef(d: RoomDefinition, footprint: Rect[], o: { roomId?: string; hideRarity?: boolean }): Exhibit {
  const e: Exhibit = { defId: d.id, name: d.name, footprint: roundRects(footprint) };
  if (!o.hideRarity) {
    e.rarity = d.rarity;
    e.sub = d.category;
  }
  if (o.roomId) e.roomId = o.roomId;
  return e;
}

const EMPTY: Exhibit = { defId: null, name: '—' };

function padTo(list: Exhibit[], count: number): Exhibit[] {
  const out = list.slice(0, count);
  while (out.length < count) out.push({ ...EMPTY });
  return out;
}

// ---------------------------------------------------------------- 展示内容の決定

/** past: 訪問ログの新しい順に相異なる定義 */
function pastExhibits(world: WorldManager, self: RoomDefinition, count: number): Exhibit[] {
  const g = world.graph;
  const order = g.visitLog.length ? [...g.visitLog].reverse() : [...g.nodes.values()].filter((n) => n.visited).map((n) => n.roomId).reverse();
  const seen = new Set<string>();
  const out: Exhibit[] = [];
  for (const id of order) {
    const n = g.nodes.get(id);
    if (!n || n.isAdapter || n.definitionId === self.id || seen.has(n.definitionId)) continue;
    const d = ROOM_BY_ID.get(n.definitionId);
    if (!d) continue;
    seen.add(n.definitionId);
    let fp: Rect[] = [];
    try { fp = world.layoutFor(n).footprint; } catch { /* 生成できなければシルエット無し */ }
    out.push(exhibitOfDef(d, fp, { roomId: n.roomId }));
    if (out.length >= count) break;
  }
  return padTo(out, count);
}

/** 定義の素のレイアウト footprint（Modifier 適用前。ノードは作らない）。M16 の未発見定義の縮小図用 */
export function rawFootprintOf(def: RoomDefinition, seed: number): Rect[] {
  const fallback = !isImplemented(def);
  const template = (fallback ? TEMPLATE_BY_ID.get('LargeRoom') : TEMPLATE_BY_ID.get(def.baseTemplate)) ?? TEMPLATE_BY_ID.get('LargeRoom')!;
  const p: GenParams = {
    def, template, rng: new Rng(seed).fork('layout'), entry: { type: 'door', width: 1 }, exits: Math.max(1, def.minExits), variant: 0,
    palette: paletteFor(def, template, fallback), allowHole: false, extraSockets: [], removedSockets: [],
  };
  try {
    let L: RoomLayout;
    if (fallback) L = generateRoom(p);
    else {
      switch (def.generator) {
        case 'CorridorGenerator': L = generateCorridor(p); break;
        case 'ParkingGenerator': L = generateParking(p); break;
        case 'VerticalGenerator': L = generateVertical(p); break;
        case 'GridGenerator': L = generateGrid(p); break;
        case 'AtriumGenerator': L = generateAtrium(p); break;
        default: L = generateRoom(p); break;
      }
    }
    return L.footprint;
  } catch {
    return [];
  }
}

/** unlisted: 未発見の定義から seed で選ぶ（名札は定義名のみ） */
function unlistedExhibits(world: WorldManager, node: RoomInstance, self: RoomDefinition, count: number): Exhibit[] {
  const rng = new Rng(node.seed).fork(`mod:${ID}`);
  const pool = ROOMS.filter((d) => d.id !== self.id && !world.graph.discoveredIds.has(d.id));
  const picked = rng.shuffle([...pool]).slice(0, count);
  return padTo(picked.map((d) => exhibitOfDef(d, rawFootprintOf(d, hashString(`${ID}:${d.id}:${node.seed}`)), { hideRarity: true })), count);
}

/** adjacent: node.portals の行き先（Adapter は先の部屋まで辿る）。final=false なら未確定の先がある */
function adjacentExhibits(world: WorldManager, node: RoomInstance, count: number): { exhibits: Exhibit[]; final: boolean } {
  const g = world.graph;
  const out: Exhibit[] = [];
  let final = true;
  for (const p of node.portals) {
    if (p.isReturn) continue;
    if (out.length >= count) break;
    if (!p.targetRoomId) {
      if (p.locked) out.push({ defId: null, name: '—', locked: true });
      else if (p.seam || p.ride || p.far) out.push({ defId: null, name: '？', unknown: true });
      else { out.push({ defId: null, name: '…', unknown: true }); final = false; }
      continue;
    }
    let target = g.nodes.get(p.targetRoomId);
    let guard = 0;
    while (target && target.isAdapter && guard++ < 4) {
      const fwd = target.portals.find((q) => !q.isReturn && q.targetRoomId);
      target = fwd?.targetRoomId ? g.nodes.get(fwd.targetRoomId) : undefined;
    }
    if (!target || target.isAdapter) {
      out.push({ defId: null, name: '…', unknown: true });
      final = false;
      continue;
    }
    const d = ROOM_BY_ID.get(target.definitionId);
    if (!d) { out.push({ ...EMPTY }); continue; }
    let fp: Rect[] = [];
    try { fp = world.layoutFor(target).footprint; } catch { /* 無ければシルエット無し */ }
    const e = exhibitOfDef(d, fp, { roomId: target.roomId });
    if (p.locked) e.locked = true;
    out.push(e);
  }
  return { exhibits: padTo(out, count), final };
}

// ---------------------------------------------------------------- 縮小図の描画

function drawCell(ctx: CanvasRenderingContext2D, x: number, y: number, e: Exhibit, mode: Mode): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, CELL_W, CELL_H);
  ctx.clip();
  const locked = !!e.locked;
  const empty = e.defId === null && !locked;
  const border = locked ? '#000000' : empty ? '#3a3d44' : e.rarity ? RARITY_COLOR[e.rarity] : '#8a8f99';
  ctx.fillStyle = locked ? '#050505' : '#1a1c22';
  ctx.fillRect(x, y, CELL_W, CELL_H);
  ctx.lineWidth = 10;
  ctx.strokeStyle = border;
  ctx.strokeRect(x + 5, y + 5, CELL_W - 10, CELL_H - 10);
  if (locked) {
    ctx.restore();
    return;
  }
  if (empty || e.unknown) {
    ctx.fillStyle = '#5a5f6a';
    ctx.font = 'bold 72px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(e.unknown ? '？' : '—', x + CELL_W / 2, y + CELL_H / 2);
    ctx.restore();
    return;
  }
  const fp = e.footprint ?? [];
  if (fp.length) {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const [a, b, c, d] of fp) { x0 = Math.min(x0, a); z0 = Math.min(z0, b); x1 = Math.max(x1, c); z1 = Math.max(z1, d); }
    const pad = 26;
    const s = Math.min((CELL_W - pad * 2) / Math.max(0.5, x1 - x0), (CELL_H - pad * 2) / Math.max(0.5, z1 - z0));
    const ox = x + CELL_W / 2 - ((x0 + x1) / 2) * s;
    const oy = y + CELL_H / 2 + ((z0 + z1) / 2) * s; // z は画面上向き
    ctx.fillStyle = mode === 'unlisted' ? '#9a9a96' : '#d8d4c8';
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    for (const [a, b, c, d] of fp) {
      const px = ox + a * s, py = oy - d * s, pw = (c - a) * s, ph = (d - b) * s;
      ctx.fillRect(px, py, Math.max(2, pw), Math.max(2, ph));
    }
    for (const [a, b, c, d] of fp) ctx.strokeRect(ox + a * s, oy - d * s, (c - a) * s, (d - b) * s);
    // 縮尺（10 m の目盛）
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillRect(x + 14, y + CELL_H - 18, Math.min(CELL_W - 28, 10 * s), 3);
  } else {
    ctx.fillStyle = '#5a5f6a';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('▭', x + CELL_W / 2, y + CELL_H / 2);
  }
  if (e.rarity && mode !== 'unlisted') {
    ctx.fillStyle = RARITY_COLOR[e.rarity];
    ctx.beginPath();
    ctx.arc(x + CELL_W - 22, y + 22, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- build / effect

interface Photo { mesh: THREE.Mesh; index: number }

class ExhibitEffect implements RoomEffect {
  private applied = false;
  private lastTry = -Infinity;
  constructor(
    private readonly built: BuiltRoom,
    private readonly canvas: HTMLCanvasElement,
    private readonly texture: THREE.CanvasTexture,
    private readonly photos: Photo[],
    private readonly params: Record<string, unknown>,
  ) {}

  update(_dt: number, ctx: RuntimeContext): void {
    if (this.applied || !ctx.def) return;
    if (ctx.now - this.lastTry < 2) return;
    this.lastTry = ctx.now;
    const node = ctx.node;
    const mode = effectiveMode(ctx.def, this.params);
    const count = countOf(this.params);
    let st = stateOf(node);
    if (!st || st.exhibits === null) {
      if (mode === 'adjacent') {
        const r = adjacentExhibits(ctx.world, node, count);
        if (r.final) saveState(node, { mode, count, exhibits: r.exhibits });
        st = { mode, count, exhibits: r.exhibits };
        this.apply(st, mode);
        if (r.final) this.applied = true;
        return;
      }
      // 古いノード（modifierState 無し）: いま決めて保存する
      const exhibits = mode === 'unlisted' ? unlistedExhibits(ctx.world, node, ctx.def, count) : pastExhibits(ctx.world, ctx.def, count);
      st = { mode, count, exhibits };
      saveState(node, st);
    }
    this.apply(st, mode);
    this.applied = true;
  }

  private apply(st: GRState, mode: Mode): void {
    const ctx2d = this.canvas.getContext('2d');
    if (!ctx2d) return;
    const cols = Math.max(1, Math.round(this.canvas.width / CELL_W));
    const list = st.exhibits ?? [];
    for (const ph of this.photos) {
      const e = list[ph.index] ?? EMPTY;
      const cx = (ph.index % cols) * CELL_W;
      const cy = Math.floor(ph.index / cols) * CELL_H;
      drawCell(ctx2d, cx, cy, e, mode);
      const sub = e.locked ? '' : (e.sub ?? '');
      this.built.updateSign(`${SIGN_PREFIX}${ph.index}`, e.locked ? '—' : e.name, sub);
    }
    this.texture.needsUpdate = true;
  }

  dispose(): void { /* テクスチャ・材質は Mesh の userData.disposable 経由で RoomBuilder.dispose が解放する */ }
}

const GraphReference: ModifierImpl = {
  id: ID,
  defaults: { mode: 'past', count: 4 },

  onNodeCreated(node, def, params, world) {
    if (stateOf(node)) return;
    const mode = effectiveMode(def, params);
    const count = countOf(params);
    let exhibits: Exhibit[] | null = null;
    if (mode === 'past') exhibits = pastExhibits(world, def, count);
    else if (mode === 'unlisted') exhibits = unlistedExhibits(world, node, def, count);
    saveState(node, { mode, count, exhibits });
  },

  layout(L, _p, params) {
    const count = countOf(params);
    const slots = wallSlots(L, { width: PHOTO_W + 0.3, height: PHOTO_H + SIGN_H + 0.5, y: (PHOTO_Y + SIGN_Y) / 2, spacing: 2.4, max: count, socketClearance: 0.8 });
    if (!slots.length) return;
    if (!L.signs) L.signs = [];
    slots.forEach((s, i) => {
      const photoPos: Vec3 = [s.pos[0], PHOTO_Y, s.pos[2]];
      L.boxes.push(...frameBoxes(photoPos, s.dir, PHOTO_W, PHOTO_H, FRAME_T, FRAME_D, 'trim'));
      const sign: SignSpec = { id: `${SIGN_PREFIX}${i}`, text: '…', pos: [s.pos[0], SIGN_Y, s.pos[2]], dir: s.dir, width: SIGN_W, kind: 'plate' };
      L.signs!.push(sign);
    });
  },

  build(built, L, ctx) {
    const anchors = (L.signs ?? []).filter((s) => s.id?.startsWith(SIGN_PREFIX));
    if (!anchors.length) return;
    const n = anchors.length;
    const cols = Math.min(4, n);
    const rows = Math.ceil(n / cols);
    const canvas = document.createElement('canvas');
    canvas.width = cols * CELL_W;
    canvas.height = rows * CELL_H;
    const g2 = canvas.getContext('2d');
    if (g2) { g2.fillStyle = '#1a1c22'; g2.fillRect(0, 0, canvas.width, canvas.height); }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const legacy = L.render?.style === 'legacy';
    if (legacy) { texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter; texture.generateMipmaps = false; }
    const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.6, metalness: 0.05 });
    const photos: Photo[] = [];
    anchors.forEach((a, i) => {
      const idx = parseInt(a.id!.slice(SIGN_PREFIX.length), 10);
      const index = Number.isFinite(idx) ? idx : i;
      const geo = new THREE.PlaneGeometry(PHOTO_W - 0.02, PHOTO_H - 0.02);
      const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
      const col = index % cols, row = Math.floor(index / cols);
      const u0 = col / cols, u1 = (col + 1) / cols;
      const v1 = 1 - row / rows, v0 = 1 - (row + 1) / rows;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * (u1 - u0), v0 + uv.getY(k) * (v1 - v0));
      uv.needsUpdate = true;
      const mesh = new THREE.Mesh(geo, material);
      const dx = a.dir === 1 ? 1 : a.dir === 3 ? -1 : 0;
      const dz = a.dir === 0 ? 1 : a.dir === 2 ? -1 : 0;
      const off = FRAME_D * 0.5;
      mesh.position.set(a.pos[0] + dx * off, PHOTO_Y, a.pos[2] + dz * off);
      mesh.rotation.y = yawOf(a.dir);
      mesh.name = `GraphReference/photo${index}`;
      if (i === 0) mesh.userData.disposable = [texture, material];
      built.group.add(mesh);
      photos.push({ mesh, index });
    });
    built.effects.push(new ExhibitEffect(built, canvas, texture, photos, ctx.params));
  },
};

export default GraphReference;
