/**
 * 担当 sense の描画の共通の道具: 光る板（加算合成の箱の集まり）・光の筋・画面の前に貼る幕（暗転・閃光・水中）・
 * プレイヤーがいる区画・画質の段（重い描画を軽くする）。
 */
import * as THREE from 'three';
import type { Sim } from '../../../core/sim/sim.ts';
import type { MatId } from '../../../core/world/layout.ts';
import { surfaceBox } from '../../render/SurfaceGeometry.ts';
import { cellAt, sampleCellLight } from '../../world/FloorBuilder.ts';
import type { ViewContext } from '../views.ts';

/**
 * 部屋の材質で描く物（家具の材質・焼き込み陰影の明るさの頂点属性付き）。parts に箱を足し、build で Group にまとめる。
 * 明るさは置いた区画の陰影を測って一色に塗る（relight を時々呼ぶ。照明の入切に追従する）
 */
export class LitParts {
  readonly group = new THREE.Group();
  private readonly geos: THREE.BufferGeometry[] = [];
  private readonly ctx: ViewContext;
  constructor(ctx: ViewContext) { this.ctx = ctx; }

  /** 原点中心の大きさ size の箱を、group の座標 at に置く */
  box(size: [number, number, number], at: [number, number, number], mat: MatId): THREE.Mesh {
    const g = surfaceBox({ min: [-size[0] / 2, -size[1] / 2, -size[2] / 2], max: [size[0] / 2, size[1] / 2, size[2] / 2], mat, solid: false });
    if (!g.getAttribute('bakedLight')) g.setAttribute('bakedLight', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 3).fill(0.3), 3));
    this.geos.push(g);
    const m = new THREE.Mesh(g, this.ctx.materials.get(mat));
    m.position.set(...at);
    this.group.add(m);
    return m;
  }

  /** 球（頭など） */
  sphere(r: number, at: [number, number, number], mat: MatId): THREE.Mesh {
    const g = new THREE.SphereGeometry(r, 18, 14);
    g.setAttribute('bakedLight', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 3).fill(0.3), 3));
    this.geos.push(g);
    const m = new THREE.Mesh(g, this.ctx.materials.get(mat));
    m.position.set(...at);
    this.group.add(m);
    return m;
  }

  /** 円柱（半径 r・高さ h。軸は y）。時計の文字盤など */
  cylinder(r: number, h: number, at: [number, number, number], mat: MatId, segments = 32): THREE.Mesh {
    const g = new THREE.CylinderGeometry(r, r, h, segments);
    g.setAttribute('bakedLight', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 3).fill(0.3), 3));
    this.geos.push(g);
    const m = new THREE.Mesh(g, this.ctx.materials.get(mat));
    m.position.set(...at);
    this.group.add(m);
    return m;
  }

  /** フロア座標の点 at の陰影で、全部の頂点の明るさを塗る */
  relight(at: [number, number, number]): void {
    const cell = cellAt(this.ctx.built, at);
    const c = cell ? sampleCellLight(cell, at, this.ctx.levelOf) : [0.2, 0.2, 0.2];
    for (const g of this.geos) {
      const attr = g.getAttribute('bakedLight') as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) { arr[i] = c[0]!; arr[i + 1] = c[1]!; arr[i + 2] = c[2]!; }
      attr.needsUpdate = true;
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    for (const g of this.geos) g.dispose();
  }
}

/** 区画の部品の id（区画の部品のうち種類 type のもの） */
export function entityOf(ctx: ViewContext, cell: string | undefined, type: string): string | null {
  return ctx.sim.floor.entities.find((e) => e.cell === cell && e.type === type)?.id ?? null;
}

/** 点 (x, z) の近く（0.7 m）に扉の部品があるか（隠しの扉が付いたか） */
export function doorNear(ctx: ViewContext, x: number, z: number, r = 0.7): boolean {
  return ctx.sim.floor.entities.some((e) => {
    if (e.type !== 'door') return false;
    const pn = e.params.panel as { min: number[]; max: number[] } | undefined;
    return !!pn && Math.hypot((pn.min[0]! + pn.max[0]!) / 2 - x, (pn.min[2]! + pn.max[2]!) / 2 - z) < r;
  });
}

/** 部品の cue（シミュレーションのイベント）を受け取る。戻り値でやめる */
export function onCue(ctx: ViewContext, id: string, f: (name: string, e: { pos?: number[]; data?: { [k: string]: unknown } }) => void): () => void {
  return ctx.onEvent?.((e) => { if (e.type === 'cue' && e.entity === id) f(String(e.data?.name ?? ''), e); }) ?? (() => {});
}

/** 描く層: 画面の幕（画面のカメラだけ）・写した像にだけ写る物（写真・監視カメラ・鏡のカメラだけ） */
export const LAYER_SCREEN = 5;
export const LAYER_IMAGE = 3;

/** 光る物の材質（加算合成。照明に依らず光って見える。暗い部屋で光の床・光の筋に使う） */
export function glowMaterial(color: number, opacity = 1): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: true, side: THREE.DoubleSide });
}

/** 箱の集まり（InstancedMesh。箱ごとの位置・大きさ・明るさ）。rects は [x0, z0, x1, z1]、y0..y1 */
export class GlowBoxes {
  readonly mesh: THREE.InstancedMesh;
  private readonly geo = new THREE.BoxGeometry(1, 1, 1);
  private readonly mat: THREE.MeshBasicMaterial;
  private readonly base: THREE.Color;
  private readonly tmp = new THREE.Color();
  readonly level: Float32Array;

  constructor(root: THREE.Object3D, rects: readonly number[][], y0: number, y1: number, color: number, inset = 0.03) {
    this.mat = glowMaterial(0xffffff);
    this.base = new THREE.Color(color);
    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, Math.max(1, rects.length));
    this.mesh.count = rects.length;
    this.mesh.frustumCulled = false;
    this.level = new Float32Array(rects.length);
    const m = new THREE.Matrix4();
    rects.forEach((r, i) => {
      const w = Math.max(0.02, r[2]! - r[0]! - 2 * inset), d = Math.max(0.02, r[3]! - r[1]! - 2 * inset);
      m.makeScale(w, y1 - y0, d);
      m.setPosition((r[0]! + r[2]!) / 2, (y0 + y1) / 2, (r[1]! + r[3]!) / 2);
      this.mesh.setMatrixAt(i, m);
      this.mesh.setColorAt(i, this.tmp.setRGB(0, 0, 0));
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    root.add(this.mesh);
  }

  /** 箱 i の明るさ（0..1。加算なので 0 で見えない） */
  set(i: number, v: number): void {
    this.level[i] = v;
    this.mesh.setColorAt(i, this.tmp.copy(this.base).multiplyScalar(Math.max(0, v)));
  }

  commit(): void {
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.geo.dispose();
    this.mat.dispose();
  }
}

/** プレイヤー（1 人目）の足元が区画 cell の中か */
export function playerInCell(ctx: ViewContext, cell: string | undefined): boolean {
  if (!cell) return false;
  const c = ctx.sim.floor.cells.find((x) => x.id === cell);
  const p = ctx.sim.players[0];
  if (!c || !p) return false;
  const b = c.bounds;
  return p.pos[0] >= b.min[0] && p.pos[0] <= b.max[0] && p.pos[2] >= b.min[2] && p.pos[2] <= b.max[2] && p.pos[1] >= b.min[1] - 3 && p.pos[1] <= b.max[1];
}

/** シミュレーションの時刻（秒） */
export const simTime = (sim: Sim): number => sim.tick * sim.dt;

/**
 * 画面の前に貼る幕（カメラの子の板。暗転・閃光・水中の色）。opacity 0 で描かない。
 * 撮像の効果（PostFX）の前に描かれる（場面の一部なので、撮像のノイズ・にじみが上に乗る）
 */
export class ScreenVeil {
  private readonly mesh: THREE.Mesh;
  private readonly mat: THREE.MeshBasicMaterial;
  constructor(ctx: ViewContext, color: number, additive = false) {
    this.mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false, ...(additive ? { blending: THREE.AdditiveBlending } : {}) });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), this.mat);
    this.mesh.position.set(0, 0, -0.1);
    this.mesh.renderOrder = 9999;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    // 幕は画面のカメラだけが描く（写真・監視カメラ・鏡のカメラには写らない）
    this.mesh.layers.set(LAYER_SCREEN);
    ctx.camera?.layers.enable(LAYER_SCREEN);
    (ctx.camera ?? ctx.root).add(this.mesh);
  }
  set(opacity: number, color?: number): void {
    this.mat.opacity = Math.max(0, Math.min(1, opacity));
    if (color !== undefined) this.mat.color.setHex(color);
    this.mesh.visible = this.mat.opacity > 0.002;
  }
  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
