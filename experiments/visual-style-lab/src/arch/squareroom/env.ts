import * as THREE from 'three';
import type { PlanarReflector } from '../../render/PlanarReflector.ts';
import type { Builder, PartOptions, V3 } from '../../scenes/Builder.ts';
import type { PropMats } from '../../props/kit.ts';
import type { SceneContext } from '../../scenes/types.ts';
import type { LBox } from './author.ts';
import { subtract } from './carve.ts';
import { addOccluder } from './sight.ts';
import type { Frame } from './frame.ts';

/** 区域（水路・水庭）ごとの材質の組 */
export interface ZoneMats {
  /** 壁の打ち放し（日なたの色） */
  wall: THREE.Material;
  /** 奥まった所・張り出しの下の暗い面 */
  dark: THREE.Material;
  /** 水路の右の岸の壁（日の当たらない岸を暗くしたい区域だけ） */
  wall2?: THREE.Material;
  /** 日の当たる正面の箱（描いた光の材質） */
  sunlit?: THREE.Material;
  /** 高い所の暗い面（区域による） */
  upper?: THREE.Material;
  /** 歩廊・床の上面 */
  floor: THREE.Material;
  /** 浸水した板石（B） */
  flood?: THREE.Material;
  /** 水面（区域ごとに映り込みの強さ・色が違う） */
  water: THREE.Material;
}

export interface Env {
  ctx: SceneContext;
  b: Builder;
  refl: PlanarReflector;
  /** 光る開口の材質（fog = false で霧を掛けない: 遠くの門の光） */
  glow: (color: string, fog?: boolean) => THREE.Material;
  /** 窓の穴・縦の溝の奥（ほとんど黒い青緑） */
  voidMat: THREE.Material;
  /** 部屋・階段室・テラスの空間（世界の箱）。積んだ塊はここを抜いて置く */
  holes: { min: V3; max: V3 }[];
  /** 決まりで積んだ塊の、水路に向く面（蔦などの作り込みの手掛かり） */
  faces: { f: Frame; box: LBox; side: 'L' | 'R' }[];
  /** 小物の材質（屋外・部屋の中）。同じ色は同じ材質にまとめる */
  props: { out: PropMats; room: PropMats };
}

/**
 * 打ち放しの箱を置く。箱の上の縁の高さを uv.y（1000 + 高さ）に入れる: 材質の染みは箱の上の縁（棚・積んだ箱の継ぎ目）から垂れる。
 * 模様は uv を使わない（ワールド座標）ので、uv をこの印に使える
 */
export function cqBox(b: Builder, m: THREE.Material, min: V3, max: V3, o: PartOptions = {}): THREE.Mesh {
  const s: V3 = [Math.abs(max[0] - min[0]), Math.abs(max[1] - min[1]), Math.abs(max[2] - min[2])];
  const g = new THREE.BoxGeometry(...s);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  const top = Math.max(min[1], max[1]);
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1000 + top);
  return b.mesh(g, m, [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2], o);
}

/**
 * 箱を置く（局所の箱 → 世界）。部屋の空間（env.holes）は抜く（noCarve で抜かない: 部屋の自分の壁）。
 * 当たり判定は歩ける高さに掛かる物だけ（重さを抑える）
 */
export function place(
  env: Env,
  f: Frame,
  m: THREE.Material,
  box: LBox | { min: V3; max: V3 },
  o: { collide?: boolean; shadow?: boolean | 'cast' | 'receive'; noCarve?: boolean } = {},
): void {
  const w = f.box(box.min, box.max);
  const pieces = o.noCarve ? [w] : env.holes.reduce<{ min: V3; max: V3 }[]>((acc, h) => acc.flatMap((p) => subtract(p, h)), [w]);
  for (const p of pieces) {
    const collide = o.collide ?? p.min[1] < 4.5;
    cqBox(env.b, m, p.min, p.max, { collide, shadow: o.shadow ?? true });
    addOccluder(p.min, p.max);
  }
}

/** 水面の板（局所の長方形 → 世界。y = 水面）。映り込みの描画では隠す */
export function waterPlane(env: Env, f: Frame, m: THREE.Material, r: [number, number, number, number], y = 0): THREE.Mesh {
  const w = f.rect(r);
  const g = new THREE.PlaneGeometry(w[2] - w[0], w[3] - w[1]);
  g.rotateX(-Math.PI / 2);
  const mesh = env.b.mesh(g, m, [(w[0] + w[2]) / 2, y, (w[1] + w[3]) / 2], { shadow: 'receive' });
  return mesh;
}
