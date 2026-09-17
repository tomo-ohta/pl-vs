/** グリッド地図（D6）。1 フロア分だけを描く。
 *  部屋は footprint（矩形の集合）を実形で描き、mapCell（外接矩形）は位置決め・フィット計算・互換のために使う。
 *  グリフ: 穴 ▼ / 階段・ランプ ↕ / 乗車（train・boat・ride）▣ / crawl（低い開口）は下半分だけの矩形 /
 *  street・gate は太い扉印 / water は波線 / Seam・far・投影不能は「？」/ 施錠は赤 / 開いた扉は黄。
 *  Legendary の巨大部屋は layout.zones を薄い内訳線で描く（zones があるときだけ）。
 *
 *  統合担当向け: 呼び出し方
 *   - drawMap(canvas, world, currentRoomId, player, view): 既存どおり。view に省略可能フィールドを足した。
 *       view.rotation?: number          MapRotation（ラジアン。画面上で時計回り正。degToRad(90) で変換）。
 *                                       ミニマップは中心（プレイヤー）回り、全体 2D はフィット中心回りに回す。フロア名は回らない。
 *       view.hiddenRoomIds?: Set<string> MapErase（描かない。発見数は変えない）。mapCell.hidden=true でも同じく隠す。
 *                                       現在部屋が隠し対象なら破線の外形とプレイヤー矢印だけ描く。
 *   - roomsOnLevel(world, level, hidden?) / visitedLevels(world, hidden?) は levelSpan（多層部屋）を含めて判定する。
 *   - footprintCellsOf(world, node) は footprint のセル矩形を roomId ごとにキャッシュして返す
 *     （layout / placement の参照が変われば再計算。layout は決定論なので visited 後は不変）。 */
import { RARITY_COLOR, ROOM_BY_ID } from '../data';
import type { AABB } from '../core/aabb';
import { CELL, FLOOR_H, footprintToCells, levelOfY, rectToCellsExact, rotatedBounds, type CellRect } from '../map/GridProjector';
import type { Placement, Portal, RoomInstance } from '../core/types';
import type { RoomLayout, Zone } from '../generators/layout';
import type { WorldManager } from '../world/WorldManager';

export { FLOOR_H };

export interface MapView {
  /** 中心にするワールド座標（ミニマップ）。null なら全体をフィット */
  center: [number, number] | null;
  pxPerCell: number;
  /** 描くフロア（level） */
  level: number;
  /** 左上にフロア名を描く */
  label?: boolean;
  /** MapRotation: 地図全体を中心回りに回す角（ラジアン。画面上で時計回り正）。省略・0 で従来どおり */
  rotation?: number;
  /** MapErase: 描かない部屋。発見数は変えない */
  hiddenRoomIds?: Set<string>;
}

/** ゾーン内訳線のセル矩形（丸めない） */
export interface ZoneCell extends CellRect {
  kind: Zone['kind'];
  /** ゾーンが属するフロア（部屋の基準階からの相対。aabb.min.y から求める） */
  level: number;
}

/** 部屋のフロア番号（床の高さ / 階高 を丸めたもの）。開始部屋が 0 */
export function levelOf(world: WorldManager, roomId: string): number {
  const b = world.worldBounds.get(roomId);
  if (b) return levelOfY(b.min[1]);
  return world.graph.nodes.get(roomId)?.mapCell?.level ?? 0;
}

/** 多層部屋が占めるフロア数（既定 1） */
export function levelSpanOfNode(n: RoomInstance): number {
  return Math.max(1, n.mapCell?.levelSpan ?? 1);
}

/** 部屋が level フロアにかかるか（多層部屋は levelSpan の範囲すべて） */
export function coversLevel(world: WorldManager, n: RoomInstance, level: number): boolean {
  const base = levelOf(world, n.roomId);
  return level >= base && level < base + levelSpanOfNode(n);
}

/** MapErase の判定（view の hidden 集合、または mapCell.hidden） */
export function isHiddenRoom(n: RoomInstance, hidden?: Set<string>): boolean {
  return (hidden?.has(n.roomId) ?? false) || (n.mapCell?.hidden ?? false);
}

/** 表示用フロア名。開始フロアを 1F、下は B1F, B2F… */
export function floorLabel(level: number): string {
  return level >= 0 ? `${level + 1}F` : `B${-level}F`;
}

/** 1 部屋以上踏破済みのフロア（昇順）。多層部屋は占める全フロアを含む。hidden の部屋だけのフロアは除く */
export function visitedLevels(world: WorldManager, hidden?: Set<string>): number[] {
  const set = new Set<number>();
  for (const n of world.graph.nodes.values()) {
    if (!(n.visited && n.placement && n.mapCell)) continue;
    if (isHiddenRoom(n, hidden)) continue;
    const base = levelOf(world, n.roomId);
    const span = levelSpanOfNode(n);
    for (let i = 0; i < span; i++) set.add(base + i);
  }
  return [...set].sort((a, b) => a - b);
}

/** 描画対象（訪問済み・配置済み・指定フロアにかかる）。未踏の隣接部屋は描かない。hidden を渡すとその部屋も除く */
export function roomsOnLevel(world: WorldManager, level: number, hidden?: Set<string>): RoomInstance[] {
  return [...world.graph.nodes.values()].filter(
    (n) => n.mapCell && n.placement && n.visited && coversLevel(world, n, level) && !isHiddenRoom(n, hidden),
  );
}

// ------------------------------------------------------------ footprint キャッシュ
interface FpEntry {
  layout: RoomLayout;
  placement: Placement;
  cells: CellRect[];
  zones: ZoneCell[];
}
const fpCaches = new WeakMap<WorldManager, Map<string, FpEntry>>();

function fpEntry(world: WorldManager, n: RoomInstance): FpEntry | null {
  if (!n.placement) return null;
  let cache = fpCaches.get(world);
  if (!cache) { cache = new Map(); fpCaches.set(world, cache); }
  const layout = world.layoutFor(n);
  const hit = cache.get(n.roomId);
  if (hit && hit.layout === layout && hit.placement === n.placement) return hit;
  const entry: FpEntry = {
    layout,
    placement: n.placement,
    cells: footprintToCells(layout.footprint, n.placement, n.mapCell),
    zones: zoneCells(layout, n.placement),
  };
  cache.set(n.roomId, entry);
  return entry;
}

/** layout.zones（ローカル AABB）を内訳線用のセル矩形へ。物理専用（friction / force）は見えないので描かない */
function zoneCells(layout: RoomLayout, p: Placement): ZoneCell[] {
  const zones = layout.zones;
  if (!zones || !zones.length) return [];
  const out: ZoneCell[] = [];
  for (const z of zones) {
    if (z.kind === 'friction' || z.kind === 'force') continue;
    const a: AABB = z.aabb;
    const c = rectToCellsExact({ x0: a.min[0], z0: a.min[2], x1: a.max[0], z1: a.max[2] }, p);
    if (c.w < 0.25 || c.h < 0.25) continue;
    // 多層部屋では aabb の床高さから相対階を出す（基準階の zone は 0）
    const level = levelOfY(p.position[1] + a.min[1]) - levelOfY(p.position[1]);
    out.push({ ...c, kind: z.kind, level });
  }
  return out;
}

/** footprint のセル矩形（キャッシュ）。footprint が空（Adapter など）なら mapCell 1 枚 */
export function footprintCellsOf(world: WorldManager, n: RoomInstance): CellRect[] {
  const e = fpEntry(world, n);
  if (e && e.cells.length) return e.cells;
  const c = n.mapCell;
  return c ? [{ gx: c.gx, gy: c.gy, w: c.w, h: c.h }] : [];
}

/** ゾーン内訳線（Legendary 巨大部屋）。level は部屋の基準フロアからの相対階 */
export function zoneCellsOf(world: WorldManager, n: RoomInstance): ZoneCell[] {
  return fpEntry(world, n)?.zones ?? [];
}

// ------------------------------------------------------------ グリフ
export type Glyph = 'hole' | 'unknown' | 'ride' | 'stairs' | 'crawl' | 'gate' | 'water' | 'door';

/** Portal の地図記号を決める（描画順の判定と同じ。Map3D も共用） */
export function glyphOf(p: Portal): Glyph {
  if (p.type === 'hole') return 'hole';
  if (p.ride || p.type === 'train' || p.type === 'boat') return 'ride';
  if (!p.projected || p.seam || p.far) return 'unknown';
  if (p.type === 'stairs' || p.type === 'ramp' || p.type === 'escalator' || p.type === 'ladder') return 'stairs';
  if (p.crawl) return 'crawl';
  if (p.type === 'street' || p.type === 'gate') return 'gate';
  if (p.type === 'water') return 'water';
  return 'door';
}

const BG = '#0b0d14';

export function drawMap(canvas: HTMLCanvasElement, world: WorldManager, currentRoomId: string | null, player: { x: number; z: number; yaw: number }, view: MapView): void {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  const rot = view.rotation ?? 0;
  const hidden = view.hiddenRoomIds;
  // 隠し部屋でも現在部屋だけは破線の外形を描く（中にいる間だけ）。現在部屋は最後に描いて白い外形線が隣室に隠れないようにする
  const nodes = roomsOnLevel(world, view.level)
    .filter((n) => !isHiddenRoom(n, hidden) || n.roomId === currentRoomId)
    .sort((a, b) => Number(a.roomId === currentRoomId) - Number(b.roomId === currentRoomId));
  const playerHere = currentRoomId !== null && levelOf(world, currentRoomId) === view.level;

  let scale = view.pxPerCell;
  let ox: number;
  let oy: number;
  let pivotX = W / 2;
  let pivotY = H / 2;
  if (view.center) {
    ox = W / 2 - (view.center[0] / CELL) * scale;
    oy = H / 2 - (view.center[1] / CELL) * scale;
  } else {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      if (isHiddenRoom(n, hidden)) continue;
      const c = n.mapCell!;
      minX = Math.min(minX, c.gx); minY = Math.min(minY, c.gy);
      maxX = Math.max(maxX, c.gx + c.w); maxY = Math.max(maxY, c.gy + c.h);
    }
    if (!isFinite(minX)) { if (view.label) drawLabel(ctx, floorLabel(view.level)); return; }
    const pad = 2;
    // 回転すると外接範囲が広がるので、回した後の範囲でフィットさせる
    const rb = rotatedBounds(minX - pad, minY - pad, maxX + pad, maxY + pad, rot);
    scale = Math.max(2, Math.min((W - 20) / (rb.maxX - rb.minX), (H - 20) / (rb.maxY - rb.minY)));
    ox = W / 2 - ((minX + maxX) / 2) * scale;
    oy = H / 2 - ((minY + maxY) / 2) * scale;
    pivotX = W / 2;
    pivotY = H / 2;
  }
  const toPx = (gx: number, gy: number): [number, number] => [ox + gx * scale, oy + gy * scale];

  ctx.save();
  if (rot !== 0) {
    ctx.translate(pivotX, pivotY);
    ctx.rotate(rot);
    ctx.translate(-pivotX, -pivotY);
  }

  // 部屋（footprint の各矩形）。外形線を先に描き、その上に不透明で塗ると矩形同士の継ぎ目の線が消える
  for (const n of nodes) {
    const c = n.mapCell!;
    const def = ROOM_BY_ID.get(n.definitionId);
    const isCurrent = n.roomId === currentRoomId;
    const isHidden = isHiddenRoom(n, hidden);
    const upper = levelOf(world, n.roomId) !== view.level; // 多層部屋の非基準階は薄く
    const rects = footprintCellsOf(world, n);
    const alpha = isCurrent ? 0.9 : upper ? 0.3 : 0.55;
    const fill = n.isAdapter ? blend('#788296', upper ? 0.28 : 0.5) : def ? blend(RARITY_COLOR[def.rarity], alpha) : blend('#969696', alpha);
    ctx.strokeStyle = isCurrent ? '#ffffff' : c.projected ? 'rgba(255,255,255,0.35)' : 'rgba(255,120,120,0.6)';
    ctx.lineWidth = isCurrent ? 4 : 2;
    if (!c.projected || isHidden) ctx.setLineDash([3, 3]);
    for (const r of rects) {
      const [x, y] = toPx(r.gx, r.gy);
      ctx.strokeRect(x, y, r.w * scale, r.h * scale);
    }
    ctx.setLineDash([]);
    if (isHidden) continue;
    ctx.fillStyle = fill;
    for (const r of rects) {
      const [x, y] = toPx(r.gx, r.gy);
      ctx.fillRect(x, y, Math.max(2, r.w * scale), Math.max(2, r.h * scale));
    }
    // Legendary 巨大部屋の内訳線（zones があるときだけ・十分な縮尺のときだけ）
    if (scale >= 4) {
      const relLevel = view.level - levelOf(world, n.roomId);
      const zones = zoneCellsOf(world, n);
      if (zones.length) {
        ctx.lineWidth = 1;
        for (const z of zones) {
          if (z.level !== relLevel) continue;
          ctx.strokeStyle = z.kind === 'water' ? 'rgba(127,208,255,0.35)' : 'rgba(255,255,255,0.18)';
          const [x, y] = toPx(z.gx, z.gy);
          ctx.strokeRect(x + 0.5, y + 0.5, z.w * scale - 1, z.h * scale - 1);
        }
      }
    }
  }

  // 扉・穴・階段・乗車・「？」
  for (const n of nodes) {
    if (isHiddenRoom(n, hidden)) continue;
    const span = levelSpanOfNode(n);
    for (const p of n.portals) {
      if (p.isReturn || !p.targetRoomId) {
        if (!(p.type === 'hole' && !p.isReturn)) continue; // 蓋をした穴も描く
      }
      let pos: [number, number, number];
      try { pos = world.socketWorld(n, p.socketId).pos; } catch { continue; }
      // 多層部屋の扉はソケットの高さの階にだけ描く
      if (span > 1 && levelOfY(pos[1]) !== view.level) continue;
      const [x, y] = toPx(pos[0] / CELL, pos[2] / CELL);
      const g = glyphOf(p);
      const open = world.portalOpen(n, p);
      const doorColor = p.locked ? '#ff6b6b' : open ? '#ffe28a' : '#cfd6e4';
      switch (g) {
        case 'hole': {
          // 床穴: 黒丸 + ▼（片方向・下のフロアへ）
          ctx.fillStyle = p.locked ? 'rgba(120,120,120,0.9)' : '#111';
          ctx.beginPath();
          ctx.arc(x, y, Math.max(3, scale * 0.45), 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = p.locked ? '#888' : '#ff8a80';
          ctx.lineWidth = 1;
          ctx.stroke();
          if (!p.locked && scale >= 5) glyphText(ctx, '▼', x, y + scale * 0.4, `bold ${Math.max(8, scale * 1.1)}px sans-serif`, '#ff8a80', rot);
          break;
        }
        case 'ride':
          // 乗車（電車・船）: 電車印 ▣（行き先は乗るまで不定なので Seam でも「？」にしない）
          glyphText(ctx, '▣', x, y + scale * 0.45, `bold ${Math.max(10, scale * 1.3)}px sans-serif`, p.locked ? '#ff6b6b' : '#b57bff', rot);
          break;
        case 'unknown':
          glyphText(ctx, '?', x, y + scale * 0.5, `bold ${Math.max(10, scale * 1.4)}px sans-serif`, '#ff8a80', rot);
          break;
        case 'stairs':
          ctx.fillStyle = '#ffe28a';
          ctx.fillRect(x - 2, y - 2, 4, 4);
          if (scale >= 6) glyphText(ctx, '↕', x + 3 + scale * 0.3, y + 3, `${Math.max(8, scale * 0.9)}px sans-serif`, '#ffe28a', rot);
          break;
        case 'crawl':
          // 低い開口: 扉印の下半分だけ（上半分は縁だけ）
          ctx.fillStyle = doorColor;
          ctx.fillRect(x - 2.5, y, 5, 2.5);
          ctx.strokeStyle = doorColor;
          ctx.lineWidth = 1;
          ctx.strokeRect(x - 2.5, y - 2.5, 5, 5);
          break;
        case 'gate':
          // 幅広ゲート（street / gate）: 太い扉印
          ctx.fillStyle = doorColor;
          ctx.fillRect(x - 4, y - 3, 8, 6);
          break;
        case 'water':
          drawWave(ctx, x, y, Math.max(8, scale * 1.2), p.locked ? '#ff6b6b' : '#7fd0ff');
          break;
        default:
          ctx.fillStyle = doorColor;
          ctx.fillRect(x - 2, y - 2, 4, 4);
      }
    }
  }

  // プレイヤー（このフロアにいるときだけ）。回転の内側で描くので地図との相対関係は保たれる
  if (playerHere) {
    const [px, py] = toPx(player.x / CELL, player.z / CELL);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-player.yaw);
    ctx.fillStyle = '#f2c14e';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 5);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
  if (view.label) drawLabel(ctx, floorLabel(view.level));
}

/** 文字グリフを地図の回転に対して正立で描く */
function glyphText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, font: string, color: string, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  if (rot !== 0) ctx.rotate(-rot);
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** 波線（water Portal） */
function drawWave(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const n = 3;
  const seg = w / n;
  const amp = Math.max(1.5, w * 0.18);
  ctx.moveTo(x - w / 2, y);
  for (let i = 0; i < n; i++) {
    const sx = x - w / 2 + seg * i;
    ctx.quadraticCurveTo(sx + seg / 2, y + (i % 2 === 0 ? -amp : amp) * 2, sx + seg, y);
  }
  ctx.stroke();
}

function drawLabel(ctx: CanvasRenderingContext2D, text: string): void {
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const w = ctx.measureText(text).width + 12;
  ctx.fillStyle = 'rgba(10,12,18,0.75)';
  ctx.fillRect(6, 6, w, 22);
  ctx.fillStyle = '#f2c14e';
  ctx.fillText(text, 12, 10);
  ctx.textBaseline = 'alphabetic';
}

/** 背景色に alpha で重ねた結果の不透明色（矩形同士の継ぎ目に線が出ないように不透明で塗る） */
function blend(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const br = parseInt(BG.slice(1, 3), 16);
  const bg = parseInt(BG.slice(3, 5), 16);
  const bb = parseInt(BG.slice(5, 7), 16);
  const mix = (c: number, bc: number) => Math.round(bc + (c - bc) * a);
  return `rgb(${mix(r, br)},${mix(g, bg)},${mix(b, bb)})`;
}
