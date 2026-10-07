import * as THREE from 'three';
import type { FloorPlan } from '../arch/plan.ts';
import type { Colliders } from '../core/Colliders.ts';
import type { PlanarReflector } from '../render/PlanarReflector.ts';
import type { SkyOptions } from '../render/Sky.ts';
import type { StylePreset } from '../render/Style.ts';
import type { StyleMaterialOptions } from '../render/StyleMaterial.ts';
import type { Lamp } from '../render/Lamps.ts';

/** 参考画像 1 枚に対応する視点 */
export interface ViewDef {
  /** 参考画像の名前（public/refs/<id>.jpg） */
  id: string;
  label: string;
  /** 目の位置 */
  eye: [number, number, number];
  /** 向き（ラジアン）。yaw = 0 で -Z、正で左へ回る。pitch 正で上を見る */
  yaw: number;
  pitch: number;
  roll?: number;
  /** 縦の画角（度） */
  fov: number;
  /** この視点の間だけ使う見た目の上書き（場所ごとの差。歩いても同じ区域なら維持） */
  style?: StylePreset;
}

export interface SceneContext {
  style: StylePreset;
  renderer: THREE.WebGLRenderer;
  colliders: Colliders;
  /** 場面の見た目で材質を作る */
  mat(o: StyleMaterialOptions): THREE.MeshStandardMaterial;
  /** 平面の鏡像を足す（床・水面） */
  addReflector(point: THREE.Vector3Like, normal?: THREE.Vector3Like, scale?: number): PlanarReflector;
  /** 影を升目に丸める・ずらすときの基準の平行光源 */
  setSun(light: THREE.DirectionalLight): void;
  /** 影の地図を次の描画で描き直す（staticShadows の場面で、太陽を動かしたとき） */
  updateShadows(): void;
  /**
   * 灯りの光だまりを足す（render/Lamps.ts）。照らす箱（部屋の内側）を必ず決める（壁の向こうへ漏れない）。
   * 返した Lamp の on・intensity を後で変えてよい（点滅など）
   */
  addLamp(l: Lamp): Lamp;
}

/** 区域ごとの見た目（カメラがこの箱に入ると style に切り替わる。どの区域にも入っていなければそのまま） */
export interface StyleZone {
  min: [number, number, number];
  max: [number, number, number];
  style: StylePreset;
}

export interface BuiltScene {
  root: THREE.Object3D;
  spawn: { pos: [number, number, number]; yaw: number; pitch?: number };
  /** 毎フレーム（歩いている時だけ。撮影中は呼ばれない） */
  update?(dt: number, t: number, camera: THREE.PerspectiveCamera): void;
  /**
   * 描く直前に毎回（撮影中も呼ばれる）。カメラに合わせた光・影の範囲・見えない部屋を描かない、などの準備。
   * 真上の図（--top / --plan）のときは o.map = true（部屋を間引かずに全部描く）
   */
  beforeRender?(camera: THREE.Camera, o?: { map?: boolean }): void;
  /** 区域ごとの見た目（先に書いた方が優先） */
  styleZones?: StyleZone[];
  /** 影の地図を毎フレーム描かない（動かない場面。太陽を動かしたら ctx.updateShadows()） */
  staticShadows?: boolean;
  dispose?(): void;
}

export interface SceneDef {
  id: string;
  label: string;
  /** 間取り図（建築版）。図の確かめ・ミニマップ・歩いて確かめる道順に使う */
  plan?: FloorPlan;
  style: StylePreset;
  views: ViewDef[];
  sky?: SkyOptions | false;
  build(ctx: SceneContext): BuiltScene;
}
