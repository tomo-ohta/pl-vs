/**
 * SelfMap — 壁面の大きな箔に現在の地図（訪問済み部屋のフロア図）を描く（M01 地図室）。
 * params: scale（px / セル。既定 24。1024 px 幅の箔で約 42 セル ≒ 170 m 分）。
 *
 * layout: 入口から最も遠い外壁（ソケット・内装を避ける）に 額縁（trim）+ 暗い裏地の箔 + 名札 L.signs（id 'sm:title:<幅>'）を置き、
 *         その前に机（ソリッド。扉前ゾーン・内装と干渉しなければ）を置く。壁が狭ければ箔の幅を 3.0 → 2.4 → 1.8 m と縮める。
 * build : 箔の位置に CanvasTexture の平面 Mesh を置き、RoomEffect が 1 秒ごと（low Tier は 2 秒）に src/ui/Minimap.drawMap で
 *         「この部屋のフロア・この部屋を中心」に再描画する。HUD のミニマップと同じ描画規則（footprint 実形・グリフ・施錠赤）に加え、
 *         未訪問だが物理配置済みの隣接部屋（訪問済み部屋の 1 hop 先）を破線の外形で重ね描きする（= 「隠し接続の示唆」。この部屋だけの情報）。
 *         MapErase / MapRotation の表示状態（mapView）は反映しない（壁の地図は素の現在グラフ）。
 * テクスチャ更新のみでジオメトリは変えない。canvas は Tier で 1024 / 768 / 512 px 幅。
 */
import * as THREE from 'three';
import type { ModifierImpl, RuntimeContext } from '../types';
import type { RoomEffect } from '../../render/RoomBuilder';
import { toWorld, type Vec3 } from '../../core/types';
import { box, type SignSpec } from '../../generators/layout';
import { CELL } from '../../map/GridProjector';
import { coversLevel, drawMap, footprintCellsOf, levelOf } from '../../ui/Minimap';
import { num } from '../util';
import { blocksDoorway, aabbOverlaps, foilBox, frameBoxes, offsetFromWall, wallSlots, yawOf } from './GraphReference.wall';

const ID = 'SelfMap';
const SIGN_PREFIX = 'sm:title:';
const SIGN_W = 0.9;
const SIGN_H = SIGN_W / 4;
const SIGN_Y = 0.55;
const PANEL_ASPECT = 1024 / 580;
const FRAME_T = 0.06;
const FRAME_D = 0.05;

function panelGeom(width: number, roomH: number): { w: number; h: number; y: number } {
  const maxH = roomH - (SIGN_Y + SIGN_H / 2 + 0.1) - 0.15;
  const h = Math.min(width / PANEL_ASPECT, maxH);
  const y = SIGN_Y + SIGN_H / 2 + 0.1 + h / 2;
  return { w: width, h, y };
}

class MapEffect implements RoomEffect {
  private acc = Infinity;
  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly texture: THREE.CanvasTexture,
    private readonly pxPerCell: number,
    private readonly intervalSec: number,
  ) {}

  update(dt: number, ctx: RuntimeContext): void {
    this.acc += dt;
    if (this.acc < this.intervalSec) return;
    this.acc = 0;
    const world = ctx.world;
    const node = ctx.node;
    const p = node.placement;
    if (!p) return;
    const b = ctx.layout.bounds;
    const c = toWorld(p, [(b.min[0] + b.max[0]) / 2, 0, (b.min[2] + b.max[2]) / 2]);
    const level = levelOf(world, node.roomId);
    const current = ctx.game?.currentRoomId ?? null;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const scale = this.pxPerCell;
    drawMap(this.canvas, world, current, { x: ctx.player.pos[0], z: ctx.player.pos[2], yaw: ctx.player.yaw }, { center: [c[0], c[2]], pxPerCell: scale, level, label: true });
    // 隠し接続の示唆: 未訪問だが配置済みで、訪問済み部屋と Portal で結ばれている部屋を破線で
    const g2 = this.canvas.getContext('2d');
    if (g2) {
      const ox = W / 2 - (c[0] / CELL) * scale;
      const oy = H / 2 - (c[2] / CELL) * scale;
      g2.save();
      g2.setLineDash([4, 4]);
      g2.lineWidth = 1.5;
      for (const n of world.graph.nodes.values()) {
        if (n.visited || !n.placement || !n.mapCell) continue;
        if (!coversLevel(world, n, level)) continue;
        const linked = n.portals.some((q) => q.targetRoomId && world.graph.nodes.get(q.targetRoomId)?.visited);
        if (!linked) continue;
        g2.strokeStyle = n.isAdapter ? 'rgba(160,170,190,0.45)' : 'rgba(255,255,255,0.55)';
        for (const r of footprintCellsOf(world, n)) g2.strokeRect(ox + r.gx * scale, oy + r.gy * scale, r.w * scale, r.h * scale);
      }
      g2.restore();
    }
    this.texture.needsUpdate = true;
  }

  dispose(): void { /* テクスチャ・材質は Mesh の userData.disposable 経由で解放 */ }
}

const SelfMap: ModifierImpl = {
  id: ID,
  defaults: { scale: 24 },

  layout(L) {
    for (const width of [3.0, 2.4, 1.8]) {
      const pg = panelGeom(width, L.height);
      if (pg.h < 0.8) continue;
      const slot = wallSlots(L, { width: width + 0.2, height: pg.h + SIGN_H + 0.4, y: (pg.y + SIGN_Y) / 2, orderFromEntry: false, max: 1, socketClearance: 0.6, depth: 1.2 })[0];
      if (!slot) continue;
      const panelPos: Vec3 = [slot.pos[0], pg.y, slot.pos[2]];
      L.boxes.push(...frameBoxes(panelPos, slot.dir, pg.w, pg.h, FRAME_T, FRAME_D, 'trim'));
      L.boxes.push(foilBox(panelPos, slot.dir, pg.w, pg.h, 0.01, 'furnitureDark', 0));
      if (!L.signs) L.signs = [];
      const sign: SignSpec = { id: `${SIGN_PREFIX}${width}`, text: '現在地図', sub: 'YOU ARE HERE', pos: [slot.pos[0], SIGN_Y, slot.pos[2]], dir: slot.dir, width: SIGN_W, kind: 'plate' };
      L.signs.push(sign);
      // 机（箔の前 0.25 m。扉前・内装・足跡外なら置かない）
      const deskW = Math.min(1.8, pg.w - 0.4);
      const dc = offsetFromWall(slot.pos, slot.dir, 0.25 + 0.3);
      const hx = slot.dir === 0 || slot.dir === 2 ? deskW / 2 : 0.3;
      const hz = slot.dir === 0 || slot.dir === 2 ? 0.3 : deskW / 2;
      const desk = box([dc[0] - hx, 0, dc[2] - hz], [dc[0] + hx, 0.75, dc[2] + hz], 'furnitureDark');
      const solids = L.boxes.slice(L.shellCount ?? 0).filter((bx) => bx.solid);
      const inside = L.footprint.some((r) => desk.min[0] >= r.x0 + 0.15 && desk.max[0] <= r.x1 - 0.15 && desk.min[2] >= r.z0 + 0.15 && desk.max[2] <= r.z1 - 0.15);
      if (inside && !blocksDoorway(desk, L.sockets) && !solids.some((s) => aabbOverlaps(s, desk))) {
        L.boxes.push(desk);
        // 机上の小さな読書灯（発光箔）
        L.boxes.push(box([dc[0] - 0.08, 0.75, dc[2] - 0.08], [dc[0] + 0.08, 0.79, dc[2] + 0.08], 'lightWarm', false));
      }
      return;
    }
  },

  build(built, L, ctx) {
    const anchor = (L.signs ?? []).find((s) => s.id?.startsWith(SIGN_PREFIX));
    if (!anchor) return;
    const width = parseFloat(anchor.id!.slice(SIGN_PREFIX.length));
    const pg = panelGeom(Number.isFinite(width) ? width : 3.0, L.height);
    const px = ctx.tier.id === 'high' ? 1024 : ctx.tier.id === 'mid' ? 768 : 512;
    const canvas = document.createElement('canvas');
    canvas.width = px;
    canvas.height = Math.round(px / PANEL_ASPECT);
    const g2 = canvas.getContext('2d');
    if (g2) { g2.fillStyle = '#0b0d14'; g2.fillRect(0, 0, canvas.width, canvas.height); }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(pg.w - 0.02, pg.h - 0.02), material);
    const pos = offsetFromWall([anchor.pos[0], pg.y, anchor.pos[2]], anchor.dir, 0.012);
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.rotation.y = yawOf(anchor.dir);
    mesh.name = 'SelfMap/panel';
    mesh.userData.disposable = [texture, material];
    built.group.add(mesh);
    const pxPerCell = Math.max(4, num(ctx.params.scale, 24)) * (px / 1024);
    built.effects.push(new MapEffect(canvas, texture, pxPerCell, ctx.tier.id === 'low' ? 2 : 1));
  },
};

export default SelfMap;
