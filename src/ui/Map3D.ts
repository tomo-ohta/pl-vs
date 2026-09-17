/** 全体マップ（3D）。踏破済みフロアの 2D 平面図を一定間隔で縦に積み、フロアをまたぐ接続（穴・階段・エレベーター）を線で結ぶ。
 *  部屋は footprint の各矩形を板として並べ、多層部屋（mapCell.levelSpan）は占めるフロア分の厚みにする。
 *  実際の高さは反映しない。回転・拡大縮小は OrbitControls。
 *
 *  統合担当向け: 呼び出し方
 *   - show(world, currentRoomId, player, opts?) の opts に
 *       rotation?: number          MapRotation（ラジアン。Minimap と同じ向き＝上から見て時計回り正）
 *       hiddenRoomIds?: Set<string> MapErase（描かない）
 *   - setRotation(rad): 表示中に角度だけ更新（内容は作り直さない。毎フレーム呼んでよい）。 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RARITY_COLOR, ROOM_BY_ID } from '../data';
import { CELL } from '../map/GridProjector';
import type { Portal, RoomInstance } from '../core/types';
import type { WorldManager } from '../world/WorldManager';
import { floorLabel, footprintCellsOf, glyphOf, isHiddenRoom, levelOf, levelSpanOfNode, roomsOnLevel, visitedLevels } from './Minimap';

const ROOM_T = 0.22; // 部屋の板の厚み（セル単位）

export interface Map3DOptions {
  /** MapRotation（ラジアン。Minimap.drawMap の rotation と同じ向き） */
  rotation?: number;
  /** MapErase: 描かない部屋 */
  hiddenRoomIds?: Set<string>;
}

export class Map3D {
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(48, 640 / 420, 0.1, 500);
  private controls: OrbitControls | null = null;
  private content = new THREE.Group();
  private readonly disposables: { dispose(): void }[] = [];
  private rotation = 0;
  active = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.scene.background = new THREE.Color(0x0b0d14);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x404860, 1.6));
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(3, 8, 5);
    this.scene.add(dir);
    this.scene.add(this.content);
  }

  private ensureRenderer(): void {
    if (this.renderer) return;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(this.canvas.width, this.canvas.height, false);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = true;
  }

  /** MapRotation の角度だけ更新（内容は作り直さない） */
  setRotation(rad: number): void {
    this.rotation = rad;
    // Canvas 2D の時計回り正（y 下向き）に合わせる: 上から見下ろすと +x 右・+z 下なので rotation.y は逆符号
    this.content.rotation.y = -rad;
  }

  /** 内容を作り直して表示を始める */
  show(world: WorldManager, currentRoomId: string | null, player: { x: number; z: number; yaw: number }, opts?: Map3DOptions): void {
    this.ensureRenderer();
    this.clear();
    const hidden = opts?.hiddenRoomIds;
    this.setRotation(opts?.rotation ?? this.rotation);
    const levels = visitedLevels(world, hidden);
    if (!levels.length) { this.active = true; this.render(); return; }

    // 全フロアの外接矩形（セル）
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (const lv of levels) for (const n of roomsOnLevel(world, lv, hidden)) {
      const c = n.mapCell!;
      minX = Math.min(minX, c.gx); minZ = Math.min(minZ, c.gy);
      maxX = Math.max(maxX, c.gx + c.w); maxZ = Math.max(maxZ, c.gy + c.h);
    }
    const extent = Math.max(maxX - minX, maxZ - minZ, 4);
    const spacing = Math.min(14, Math.max(4, extent * 0.3)); // フロア間隔（一定）
    const yOf = (level: number) => level * spacing;
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    const curLevel = currentRoomId ? levelOf(world, currentRoomId) : NaN;

    // フロアごとの下地と部屋
    for (const lv of levels) {
      const rooms = roomsOnLevel(world, lv, hidden);
      let fx0 = Infinity, fz0 = Infinity, fx1 = -Infinity, fz1 = -Infinity;
      for (const n of rooms) {
        const c = n.mapCell!;
        fx0 = Math.min(fx0, c.gx); fz0 = Math.min(fz0, c.gy);
        fx1 = Math.max(fx1, c.gx + c.w); fz1 = Math.max(fz1, c.gy + c.h);
      }
      const pad = 1;
      const base = new THREE.Mesh(
        new THREE.PlaneGeometry(fx1 - fx0 + pad * 2, fz1 - fz0 + pad * 2),
        new THREE.MeshBasicMaterial({ color: 0x1a1f2c, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
      );
      base.rotation.x = -Math.PI / 2;
      base.position.set((fx0 + fx1) / 2 - cx, yOf(lv) - ROOM_T, (fz0 + fz1) / 2 - cz);
      this.add(base);
      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(base.geometry),
        new THREE.LineBasicMaterial({ color: 0x3a4054 }),
      );
      edge.rotation.copy(base.rotation); edge.position.copy(base.position);
      this.add(edge);
      this.add(this.label(floorLabel(lv), fx0 - cx - pad + 0.2, yOf(lv) + 0.6, fz0 - cz - pad + 0.2, lv === curLevel));

      for (const n of rooms) {
        // 多層部屋は基準フロアで 1 回だけ、占めるフロア分の厚みで描く
        if (levelOf(world, n.roomId) !== lv) continue;
        const span = levelSpanOfNode(n);
        const thick = ROOM_T + (span - 1) * spacing;
        const def = ROOM_BY_ID.get(n.definitionId);
        const isCurrent = n.roomId === currentRoomId;
        const color = n.isAdapter ? '#788296' : def ? RARITY_COLOR[def.rarity] : '#969696';
        const mat = new THREE.MeshLambertMaterial({ color, transparent: true, opacity: isCurrent ? 1 : span > 1 ? 0.6 : 0.85 });
        for (const r of footprintCellsOf(world, n)) {
          const geo = new THREE.BoxGeometry(Math.max(0.3, r.w - 0.12), thick, Math.max(0.3, r.h - 0.12));
          const m = new THREE.Mesh(geo, mat);
          m.position.set(r.gx + r.w / 2 - cx, yOf(lv) + (thick - ROOM_T) / 2, r.gy + r.h / 2 - cz);
          this.add(m);
          if (isCurrent) {
            const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xffffff }));
            e.position.copy(m.position);
            this.add(e);
          }
        }
      }
    }

    // フロアをまたぐ接続（穴・階段・ランプ・エレベーター・乗車・Seam）
    const drawnLevels = new Set(levels);
    const seen = new Set<string>();
    for (const lv of levels) for (const n of roomsOnLevel(world, lv, hidden)) {
      if (levelOf(world, n.roomId) !== lv) continue;
      for (const p of n.portals) {
        if (!p.targetRoomId || !world.graph.has(p.targetRoomId)) continue;
        const t = world.graph.get(p.targetRoomId);
        if (!t.visited || !t.placement || !t.mapCell || isHiddenRoom(t, hidden)) continue;
        const lt = levelOf(world, t.roomId);
        if (lt === lv || !drawnLevels.has(lt)) continue;
        const key = [n.roomId, t.roomId].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        const a = this.portalPoint(world, n, p, cx, cz, yOf(lv));
        const b = this.portalPoint(world, t, this.counterpart(t, p), cx, cz, yOf(lt));
        const g = glyphOf(p);
        const color = g === 'hole' ? 0xff8a80 : g === 'ride' || p.type === 'elevator' || p.seam ? 0xb57bff : 0xffe28a;
        const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
        const mat = p.seam ? new THREE.LineDashedMaterial({ color, dashSize: 0.35, gapSize: 0.2 }) : new THREE.LineBasicMaterial({ color });
        const line = new THREE.Line(geo, mat);
        if (p.seam) line.computeLineDistances();
        this.add(line);
        for (const pt of [a, b]) {
          const s = g === 'ride'
            ? new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshBasicMaterial({ color }))
            : new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color }));
          s.position.copy(pt);
          this.add(s);
        }
      }
    }

    // プレイヤー
    if (currentRoomId) {
      const lv = levelOf(world, currentRoomId);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 12), new THREE.MeshBasicMaterial({ color: 0xf2c14e }));
      cone.position.set(player.x / CELL - cx, yOf(lv) + 0.55, player.z / CELL - cz);
      cone.rotation.x = -Math.PI / 2; // 先端を -Z（yaw 0 の正面）へ
      const holder = new THREE.Group();
      holder.position.copy(cone.position);
      cone.position.set(0, 0, 0);
      holder.rotation.y = -player.yaw;
      holder.add(cone);
      this.add(holder);
    }

    // カメラ: 全体が入る距離に置く
    const ySpan = (levels[levels.length - 1] - levels[0]) * spacing;
    const radius = Math.max(extent, ySpan) * 0.75 + 3;
    const midY = (yOf(levels[0]) + yOf(levels[levels.length - 1])) / 2;
    this.controls!.target.set(0, midY, 0);
    this.camera.position.set(radius * 0.9, midY + radius * 0.8, radius * 1.1);
    this.controls!.minDistance = 2;
    this.controls!.maxDistance = radius * 4;
    this.controls!.update();
    this.active = true;
    this.render();
  }

  hide(): void { this.active = false; }

  /** 毎フレーム呼ぶ（active のときだけ描く） */
  update(): void {
    if (!this.active || !this.renderer) return;
    this.controls?.update();
    this.render();
  }

  private render(): void {
    if (!this.renderer) return;
    this.camera.aspect = this.canvas.width / this.canvas.height;
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
  }

  private counterpart(target: RoomInstance, p: Portal): Portal | null {
    return target.portals.find((x) => x.portalId === p.targetPortalId) ?? target.portals.find((x) => x.targetRoomId && x.targetPortalId === p.portalId) ?? null;
  }

  private portalPoint(world: WorldManager, n: RoomInstance, p: Portal | null, cx: number, cz: number, y: number): THREE.Vector3 {
    if (p) {
      try {
        const { pos } = world.socketWorld(n, p.socketId);
        return new THREE.Vector3(pos[0] / CELL - cx, y, pos[2] / CELL - cz);
      } catch { /* socket が無ければ部屋中心 */ }
    }
    const c = n.mapCell!;
    return new THREE.Vector3(c.gx + c.w / 2 - cx, y, c.gy + c.h / 2 - cz);
  }

  private label(text: string, x: number, y: number, z: number, highlight: boolean): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(10,12,18,0.8)';
    ctx.fillRect(0, 0, 128, 64);
    ctx.fillStyle = highlight ? '#f2c14e' : '#e6e8ee';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 34);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    // 画面上で一定サイズ（拡大縮小でラベルが巨大化しない）
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, sizeAttenuation: false });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(0.14, 0.07, 1);
    sp.position.set(x, y, z);
    this.disposables.push(tex);
    return sp;
  }

  private add(o: THREE.Object3D): void {
    this.content.add(o);
    const anyO = o as THREE.Mesh;
    if (anyO.geometry) this.disposables.push(anyO.geometry);
    if (anyO.material) this.disposables.push(anyO.material as THREE.Material);
  }

  private clear(): void {
    this.content.removeFromParent();
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
    this.content = new THREE.Group();
    this.content.rotation.y = -this.rotation;
    this.scene.add(this.content);
  }
}
