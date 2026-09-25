/** 全体マップ（3D）。踏破済みフロアの 2D 平面図を縦に積み、フロアをまたぐ接続（穴・階段・エレベーター）を線で結ぶ。
 *  部屋は footprint の各矩形を板として並べ、多層部屋（mapCell.levelSpan）は占めるフロア分の厚みにする。
 *  実際の高さは反映しない。回転・拡大縮小は OrbitControls。
 *
 *  第21回（数十階で表示が崩れる件）:
 *   - 原因: フロア間隔が一定（最大 14 セル）で、40 階なら高さ 560 セル → カメラが遠平面（500）の外に出て何も映らなかった。
 *     フロアごとのラベル（画面上で一定サイズ）が数十枚重なり地図が読めなかった。
 *   - 間隔は「注目フロア（focus）の前後は広く、遠いほど詰める」アコーディオン。全体の高さは平面の大きさの数倍までに収める。
 *   - フロアが FULL_DETAIL_MAX を超えると、注目フロアの ±DETAIL_RANGE と現在フロアだけ部屋を色分けで描き、他は 1 枚にまとめた薄い簡略表示。
 *   - 階の表示は平面図から離した縦の「目盛り軸」に置く。ラベルは 1 / 5 / 10 階ごとに間引き（現在・注目フロアは必ず）、
 *     画面上で重なるものは毎フレーム隠す。遠平面はカメラ距離に合わせて広げる。
 *
 *  統合担当向け: 呼び出し方
 *   - show(world, currentRoomId, player, opts?) の opts に
 *       rotation?: number          MapRotation（ラジアン。Minimap と同じ向き＝上から見て時計回り正）
 *       hiddenRoomIds?: Set<string> MapErase（描かない）
 *       focusLevel?: number         注目フロア（省略時は現在フロア）
 *   - setRotation(rad): 表示中に角度だけ更新（内容は作り直さない。毎フレーム呼んでよい）。
 *   - resize(): キャンバスの表示サイズが変わったとき（MapPanel が呼ぶ）。 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RARITY_COLOR, ROOM_BY_ID } from '../data';
import { CELL } from '../map/GridProjector';
import type { Portal, RoomInstance } from '../core/types';
import type { WorldManager } from '../world/WorldManager';
import { floorLabel, footprintCellsOf, glyphOf, isHiddenRoom, levelOf, levelSpanOfNode, roomsOnLevel, visitedLevels } from './Minimap';

const ROOM_T = 0.22; // 部屋の板の厚み（セル単位）
/** これより多いフロアは簡略表示を使う */
const FULL_DETAIL_MAX = 16;
/** 注目フロアから何階までを詳しく描くか */
const DETAIL_RANGE = 2;

export interface Map3DOptions {
  /** MapRotation（ラジアン。Minimap.drawMap の rotation と同じ向き） */
  rotation?: number;
  /** MapErase: 描かない部屋 */
  hiddenRoomIds?: Set<string>;
  /** 注目フロア（間隔を広げ、詳しく描き、カメラを向ける）。省略時は現在フロア */
  focusLevel?: number;
}

/** 階のラベルを出す間隔（1 / 5 / 10 階ごと） */
export function labelStep(span: number): number {
  return span <= 12 ? 1 : span <= 60 ? 5 : 10;
}

/** その階にラベルを出すか（5 階ごとなら 1F・5F・10F…と B5F・B10F…） */
export function labeledLevel(level: number, step: number): boolean {
  if (step <= 1) return true;
  if (level === 0) return true;
  const n = level >= 0 ? level + 1 : -level;
  return n % step === 0;
}

interface AxisLabel { sprite: THREE.Sprite; priority: number }

export class Map3D {
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(48, 640 / 420, 0.1, 500);
  private controls: OrbitControls | null = null;
  private content = new THREE.Group();
  private readonly disposables: { dispose(): void }[] = [];
  private labels: AxisLabel[] = [];
  private rotation = 0;
  active = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.scene.background = new THREE.Color(0x07080c);
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
    this.resize();
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = true;
  }

  /** キャンバスの表示サイズに描画バッファを合わせる */
  resize(): void {
    if (!this.renderer) return;
    const w = Math.max(1, Math.round(this.canvas.clientWidth || this.canvas.width));
    const h = Math.max(1, Math.round(this.canvas.clientHeight || this.canvas.height));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
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
    const curLevel = currentRoomId ? levelOf(world, currentRoomId) : levels[0];
    const focus = opts?.focusLevel !== undefined && levels.includes(opts.focusLevel) ? opts.focusLevel : levels.includes(curLevel) ? curLevel : levels[0];

    // 全フロアの外接矩形（セル）
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (const lv of levels) for (const n of roomsOnLevel(world, lv, hidden)) {
      const c = n.mapCell!;
      minX = Math.min(minX, c.gx); minZ = Math.min(minZ, c.gy);
      maxX = Math.max(maxX, c.gx + c.w); maxZ = Math.max(maxZ, c.gy + c.h);
    }
    const extent = Math.max(maxX - minX, maxZ - minZ, 4);
    const lo = levels[0], hi = levels[levels.length - 1];
    const span = hi - lo + 1;
    // 間隔: 注目の前後は wide、他は tight（全体の高さを平面の大きさの約 2 倍か 48 セルまでに収める）
    const wide = Math.min(14, Math.max(4, extent * 0.3));
    const cap = Math.max(extent * 2, 48);
    const nWide = Math.min(span - 1, DETAIL_RANGE * 2);
    const tight = span - 1 - nWide > 0 ? Math.min(wide, Math.max(0.5, (cap - nWide * wide) / (span - 1 - nWide))) : wide;
    const ys = new Map<number, number>();
    let y = 0;
    for (let l = lo; l <= hi; l++) {
      ys.set(l, y);
      const nearFocus = Math.abs(l - focus) < DETAIL_RANGE || Math.abs(l + 1 - focus) < DETAIL_RANGE;
      y += nearFocus ? wide : tight;
    }
    const yFocus = ys.get(focus) ?? 0;
    // 注目フロアを y = 0 に（踏破範囲の外 = 多層部屋の上端は詰めた間隔で延ばす）
    const yOf = (level: number) => (ys.get(level) ?? (level > hi ? (ys.get(hi) ?? 0) + (level - hi) * tight : (ys.get(lo) ?? 0) - (lo - level) * tight)) - yFocus;
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    const simplified = levels.length > FULL_DETAIL_MAX;
    const detailed = (lv: number) => !simplified || Math.abs(lv - focus) <= DETAIL_RANGE || lv === curLevel;

    // フロアごとの下地と部屋
    for (const lv of levels) {
      const rooms = roomsOnLevel(world, lv, hidden);
      let fx0 = Infinity, fz0 = Infinity, fx1 = -Infinity, fz1 = -Infinity;
      for (const n of rooms) {
        const c = n.mapCell!;
        fx0 = Math.min(fx0, c.gx); fz0 = Math.min(fz0, c.gy);
        fx1 = Math.max(fx1, c.gx + c.w); fz1 = Math.max(fz1, c.gy + c.h);
      }
      const isFocus = lv === focus;
      const pad = 1;
      const base = new THREE.Mesh(
        new THREE.PlaneGeometry(fx1 - fx0 + pad * 2, fz1 - fz0 + pad * 2),
        new THREE.MeshBasicMaterial({ color: isFocus ? 0x2a2418 : 0x141821, transparent: true, opacity: isFocus ? 0.75 : detailed(lv) ? 0.5 : 0.28, side: THREE.DoubleSide, depthWrite: false }),
      );
      base.rotation.x = -Math.PI / 2;
      base.position.set((fx0 + fx1) / 2 - cx, yOf(lv) - ROOM_T, (fz0 + fz1) / 2 - cz);
      this.add(base);
      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(base.geometry),
        new THREE.LineBasicMaterial({ color: isFocus ? 0xf2c14e : 0x323846, transparent: true, opacity: isFocus ? 0.9 : detailed(lv) ? 0.8 : 0.35 }),
      );
      edge.rotation.copy(base.rotation); edge.position.copy(base.position);
      this.add(edge);

      if (!detailed(lv)) {
        // 簡略表示: そのフロアの部屋を 1 つのジオメトリにまとめ、薄い単色で
        const geos: THREE.BufferGeometry[] = [];
        for (const n of rooms) {
          if (levelOf(world, n.roomId) !== lv) continue;
          for (const r of footprintCellsOf(world, n)) {
            const g = new THREE.BoxGeometry(Math.max(0.3, r.w - 0.12), ROOM_T * 0.6, Math.max(0.3, r.h - 0.12));
            g.translate(r.gx + r.w / 2 - cx, yOf(lv), r.gy + r.h / 2 - cz);
            geos.push(g);
          }
        }
        if (geos.length) {
          const merged = mergeGeometries(geos, false);
          for (const g of geos) g.dispose();
          if (merged) this.add(new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ color: 0x5a6070, transparent: true, opacity: 0.45 })));
        }
        continue;
      }
      for (const n of rooms) {
        // 多層部屋は基準フロアで 1 回だけ、占めるフロア分の厚みで描く
        if (levelOf(world, n.roomId) !== lv) continue;
        const spanN = levelSpanOfNode(n);
        const thick = ROOM_T + Math.max(0, yOf(lv + spanN - 1) - yOf(lv));
        const def = ROOM_BY_ID.get(n.definitionId);
        const isCurrent = n.roomId === currentRoomId;
        const color = n.isAdapter ? '#788296' : def ? RARITY_COLOR[def.rarity] : '#969696';
        const mat = new THREE.MeshLambertMaterial({ color, transparent: true, opacity: isCurrent ? 1 : spanN > 1 ? 0.6 : 0.85 });
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

    // フロアをまたぐ接続（穴・階段・ランプ・エレベーター・乗車・Seam）。簡略表示では詳しく描くフロアに関わる線だけ
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
        if (simplified && !detailed(lv) && !detailed(lt)) continue;
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

    // 階の目盛り軸（平面図から離して左に立てる）。目盛りは踏破した階ごと、ラベルは間引き
    const axisX = minX - cx - 3.2, axisZ = maxZ - cz + 1.5;
    const step = labelStep(span);
    const pts: THREE.Vector3[] = [new THREE.Vector3(axisX, yOf(lo), axisZ), new THREE.Vector3(axisX, yOf(hi), axisZ)];
    this.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x4a5162 })));
    const ticks: THREE.Vector3[] = [];
    for (const lv of levels) {
      const long = labeledLevel(lv, step) || lv === focus || lv === curLevel;
      const w = long ? 0.9 : 0.45;
      ticks.push(new THREE.Vector3(axisX, yOf(lv), axisZ), new THREE.Vector3(axisX + w, yOf(lv), axisZ));
      // 目盛りから平面図の角へ細い導線（どのフロアの目盛りか分かるように。注目フロアだけ）
      if (lv === focus) {
        const guide = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(axisX + w, yOf(lv), axisZ), new THREE.Vector3(minX - cx - 1, yOf(lv), axisZ)]);
        this.add(new THREE.Line(guide, new THREE.LineDashedMaterial({ color: 0xf2c14e, dashSize: 0.3, gapSize: 0.25 })).computeLineDistances());
      }
      if (long) {
        const priority = lv === curLevel ? 3 : lv === focus ? 2 : 1;
        const sp = this.label(floorLabel(lv), axisX - 0.3, yOf(lv), axisZ, lv === curLevel ? 'cur' : lv === focus ? 'focus' : 'plain');
        this.add(sp);
        this.labels.push({ sprite: sp, priority });
      }
    }
    this.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ticks), new THREE.LineBasicMaterial({ color: 0x6a7284 })));

    // プレイヤー
    if (currentRoomId) {
      const lv = levelOf(world, currentRoomId);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 12), new THREE.MeshBasicMaterial({ color: 0xf2c14e }));
      const holder = new THREE.Group();
      holder.position.set(player.x / CELL - cx, yOf(lv) + 0.55, player.z / CELL - cz);
      cone.rotation.x = -Math.PI / 2; // 先端を -Z（yaw 0 の正面）へ
      holder.rotation.y = -player.yaw;
      holder.add(cone);
      this.add(holder);
    }

    // カメラ: 注目フロアとその前後が入る距離（全体は引けば見える）。遠平面は最大距離に合わせる
    const localSpan = Math.max(0, Math.min(yOf(hi), wide * DETAIL_RANGE) - Math.max(yOf(lo), -wide * DETAIL_RANGE));
    const radius = Math.max(extent, localSpan) * 0.75 + 3;
    const total = yOf(hi) - yOf(lo);
    this.controls!.target.set(0, 0, 0);
    this.camera.position.set(radius * 0.9, radius * 0.8, radius * 1.1);
    this.controls!.minDistance = 2;
    this.controls!.maxDistance = Math.max(radius * 4, total * 1.6 + extent);
    this.camera.near = 0.1;
    this.camera.far = Math.max(500, this.controls!.maxDistance * 2 + total);
    this.camera.updateProjectionMatrix();
    this.controls!.update();
    this.active = true;
    this.render();
  }

  hide(): void { this.active = false; }

  /** 毎フレーム呼ぶ（active のときだけ描く） */
  update(): void {
    if (!this.active || !this.renderer) return;
    this.controls?.update();
    this.cullLabels();
    this.render();
  }

  /** 画面上で重なるラベルを隠す（優先度の高い順に置き、18 px 以内に既に置いたものがあれば隠す） */
  private cullLabels(): void {
    if (!this.labels.length) return;
    const h = this.canvas.clientHeight || this.canvas.height;
    const placed: number[] = [];
    const v = new THREE.Vector3();
    const order = [...this.labels].sort((a, b) => b.priority - a.priority);
    for (const l of order) {
      l.sprite.getWorldPosition(v).project(this.camera);
      const sy = (-v.y * 0.5 + 0.5) * h;
      const clash = v.z > 1 || placed.some((p) => Math.abs(p - sy) < 18);
      l.sprite.visible = !clash;
      if (!clash) placed.push(sy);
    }
  }

  private render(): void {
    if (!this.renderer) return;
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

  /** 目盛り軸のラベル（右寄せ。画面上で一定サイズ） */
  private label(text: string, x: number, y: number, z: number, kind: 'cur' | 'focus' | 'plain'): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 160; canvas.height = 48;
    const ctx = canvas.getContext('2d')!;
    ctx.font = '600 30px ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const t = kind === 'cur' ? `● ${text}` : text;
    ctx.fillStyle = kind === 'plain' ? 'rgba(200,205,215,0.8)' : '#f2c14e';
    ctx.fillText(t, 152, 25);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, sizeAttenuation: false, transparent: true });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(0.16, 0.048, 1);
    sp.center.set(1, 0.5); // 右端を目盛りに合わせる
    sp.position.set(x, y, z);
    sp.renderOrder = 10;
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
    this.labels = [];
    this.content = new THREE.Group();
    this.content.rotation.y = -this.rotation;
    this.scene.add(this.content);
  }
}
