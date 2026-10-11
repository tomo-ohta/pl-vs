import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { rng, type Builder, type V3 } from '../scenes/Builder.ts';
import type { SceneContext } from '../scenes/types.ts';

/**
 * 小物を作り込む道具（どの場所でも同じ道具で作る）。
 *
 * - 形: 角の丸い箱・円柱・回転体（輪郭を回す）・押し出し（輪郭を厚みへ）・管（折れ線・曲線）・楕円体・輪。three の形をそのまま使う
 * - 色: 物の関数は「色（sRGB の 16 進）と種類（ふつう・光る・ガラス）」で頼み、場所ごとの材質の作り方（PropMats）が
 *   その場所の絵柄の材質（色彩設計の段落とし・面ごとの塗り・駅の材質）にする。同じ色は同じ材質なので、Builder が材質ごとにまとめて描く
 * - 座標: 物ごとの局所の座標。原点は床の上の物の中心、+y が上、**正面が +z**、背が -z（プールの Frame と同じ約束）。
 *   yaw は Y 軸回りの回転（Object3D.rotation.y と同じ向き）
 * - 当たり判定: collide で局所の箱を渡す（回っていれば外接箱）
 *
 * 作り方の決まり（docs/08-props.md）: 実寸・主な部位・厚み・面取りをそろえ、近く（1.5 m）で見て「何か分かる」形にする。
 * 模様の細かさは場所の絵柄に合わせる（平らな色面の絵柄に細かすぎる物を置かない）。見本帳（props.html）で 3 つの距離から確かめる。
 */

export type PropKind = 'solid' | 'glow' | 'glass';

/** 場所ごとの材質の作り方。色（sRGB の 16 進）と種類から、その場所の材質を返す（同じ引数には同じ材質を返すこと） */
export interface PropMats {
  get(color: string, kind?: PropKind): THREE.Material;
}

/** 形の出し先（場面の Builder など） */
export interface PropSink {
  /** 場面の座標の形（変形済み）を足す */
  add(geo: THREE.BufferGeometry, mat: THREE.Material, shadow: boolean | 'cast' | 'receive'): void;
  /** 場面の座標の当たり判定の箱 */
  collide(min: V3, max: V3): void;
}

/** Builder へ出す（材質ごとにまとめて描かれる） */
export function builderSink(b: Builder, ctx: SceneContext): PropSink {
  return {
    add: (geo, mat, shadow) => {
      b.mesh(geo, mat, [0, 0, 0], { shadow });
    },
    collide: (min, max) => {
      ctx.colliders.add({ x: min[0], y: min[1], z: min[2] }, { x: max[0], y: max[1], z: max[2] });
    },
  };
}

/** 色彩設計の材質（ctx.mat）で作る、既定の材質の作り方。段の色は場面の既定の変え方 */
export function styleMats(ctx: SceneContext, o: { glassOpacity?: number; line?: number; noise?: [number, number] } = {}): PropMats {
  const cache = new Map<string, THREE.Material>();
  return {
    get(color, kind = 'solid') {
      const key = `${kind}:${color}`;
      let m = cache.get(key);
      if (!m) {
        if (kind === 'glow') m = ctx.mat({ color, unlit: true, line: 0.2, name: `prop-glow-${color}` });
        else if (kind === 'glass') m = ctx.mat({ color, transparent: true, opacity: o.glassOpacity ?? 0.35, depthWrite: false, line: 0.3, name: `prop-glass-${color}` });
        // 段の境目のノイズは弱く（丸い面・面取りで段の境目がまだらにちぎれないように。小物は平らな色の面で見せる）
        // 影の升目・縁のちぎれ（shadowQuant）は使わない: 小さな面・面取りでは調べる位置がはみ出して、煙のような汚れになる
        else m = ctx.mat({ color, line: o.line ?? 1, noise: o.noise ?? [0, 1], shadowQuant: false, name: `prop-${color}` });
        cache.set(key, m);
      }
      return m;
    },
  };
}

export interface PartOpts {
  kind?: PropKind;
  /** 影（既定 true = 落とす・受ける） */
  shadow?: boolean | 'cast' | 'receive';
  /** この部品の外接箱を当たり判定にする */
  collide?: boolean;
}

export type V2 = [number, number];
type Axis = 'x' | 'y' | 'z';

const _v = new THREE.Vector3();

/**
 * 1 つの物の局所の座標系。部品を置く・小さな座標系（sub）を作る。
 * 乱数 r は物ごとに決まる（同じ種なら同じ形）
 */
export class Prop {
  readonly r: () => number;
  constructor(
    readonly sink: PropSink,
    readonly mats: PropMats,
    readonly m: THREE.Matrix4,
    seed = 1,
  ) {
    this.r = rng(seed);
  }

  /** 場面の位置・向きに物を置く */
  static at(sink: PropSink, mats: PropMats, pos: V3, yaw = 0, seed = 1): Prop {
    const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(pos[0], pos[1], pos[2]);
    return new Prop(sink, mats, m, seed);
  }

  /** 局所の座標系の中の小さな座標系（位置・Y 軸回りの回転・ほかの軸の回転） */
  sub(pos: V3, yaw = 0, o: { pitch?: number; roll?: number; scale?: number } = {}): Prop {
    const local = new THREE.Matrix4().compose(
      new THREE.Vector3(...pos),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(o.pitch ?? 0, yaw, o.roll ?? 0, 'YXZ')),
      new THREE.Vector3(o.scale ?? 1, o.scale ?? 1, o.scale ?? 1),
    );
    const p = new Prop(this.sink, this.mats, this.m.clone().multiply(local));
    (p as { r: () => number }).r = this.r;
    return p;
  }

  /** 同じ位置・向きで、材質の作り方だけ替える（自販機の中の商品など、明るさの違う部品） */
  withMats(mats: PropMats): Prop {
    const p = new Prop(this.sink, mats, this.m.clone());
    (p as { r: () => number }).r = this.r;
    return p;
  }

  /** 当たり判定を出さない（場所が自分で当たり判定を作るとき: 回した枠に沿った判定など） */
  noCollide(): Prop {
    const p = new Prop({ add: (g, m, s) => this.sink.add(g, m, s), collide: () => {} }, this.mats, this.m.clone());
    (p as { r: () => number }).r = this.r;
    return p;
  }

  /** 局所の点 → 場面の点 */
  w(p: V3): V3 {
    _v.set(p[0], p[1], p[2]).applyMatrix4(this.m);
    return [_v.x, _v.y, _v.z];
  }

  /** 形を置く（geo は局所の座標。この関数が持つ） */
  put(geo: THREE.BufferGeometry, color: string, o: PartOpts = {}): void {
    geo.applyMatrix4(this.m);
    if (!geo.getAttribute('normal')) geo.computeVertexNormals();
    if (!geo.getAttribute('uv')) {
      const n = geo.getAttribute('position').count;
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    }
    this.sink.add(geo, this.mats.get(color, o.kind ?? 'solid'), o.shadow ?? true);
    if (o.collide) {
      geo.computeBoundingBox();
      const bb = geo.boundingBox!;
      this.sink.collide([bb.min.x, bb.min.y, bb.min.z], [bb.max.x, bb.max.y, bb.max.z]);
    }
  }

  /** 局所の箱を当たり判定にする（回っていれば外接箱） */
  collide(min: V3, max: V3): void {
    const bb = new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max)).applyMatrix4(this.m);
    this.sink.collide([bb.min.x, bb.min.y, bb.min.z], [bb.max.x, bb.max.y, bb.max.z]);
  }

  // ---------------------------------------------------------------- 形

  /** 箱（角の座標）。r > 0 で角を丸める（面取り。r は寸法の半分まで） */
  box(color: string, min: V3, max: V3, o: PartOpts & { r?: number; seg?: number } = {}): void {
    const s: V3 = [Math.abs(max[0] - min[0]), Math.abs(max[1] - min[1]), Math.abs(max[2] - min[2])];
    const c: V3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    const r = Math.min(o.r ?? 0, s[0] / 2 - 1e-4, s[1] / 2 - 1e-4, s[2] / 2 - 1e-4);
    // 丸みの分け方: 小さな丸み（1.5 cm 未満）は 1（面取り。三角形 約 110）、大きな丸みは 2（約 300）
    const seg = o.seg ?? (r < 0.015 ? 1 : 2);
    const g = r > 0.001 ? new RoundedBoxGeometry(s[0], s[1], s[2], seg, r) : new THREE.BoxGeometry(s[0], s[1], s[2]);
    g.translate(c[0], c[1], c[2]);
    this.put(g, color, o);
  }

  /** 円柱（中心・半径・長さ・軸）。radiusTop で円錐台、open で蓋なし */
  cyl(color: string, center: V3, radius: number, length: number, o: PartOpts & { axis?: Axis; radiusTop?: number; seg?: number; open?: boolean } = {}): void {
    const g = new THREE.CylinderGeometry(o.radiusTop ?? radius, radius, length, o.seg ?? 16, 1, o.open ?? false);
    orient(g, o.axis ?? 'y');
    g.translate(center[0], center[1], center[2]);
    this.put(g, color, o);
  }

  /**
   * 回転体: 輪郭 [半径, 高さ] を軸のまわりに回す（瓶・鉢・ごみ箱・消火器・タイヤ）。base は軸の上の基準点。
   * 輪郭は下から上へ。半径 0 の点で閉じる
   */
  lathe(color: string, profile: V2[], base: V3, o: PartOpts & { axis?: Axis; seg?: number; phi?: [number, number] } = {}): void {
    const g = new THREE.LatheGeometry(
      profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0), y)),
      o.seg ?? 20,
      o.phi?.[0] ?? 0,
      o.phi?.[1] ?? Math.PI * 2,
    );
    orient(g, o.axis ?? 'y');
    g.translate(base[0], base[1], base[2]);
    this.put(g, color, o);
  }

  /**
   * 押し出し: 平面の輪郭（反時計回り）を、残りの軸の向きへ from から to まで押し出す。
   * plane = 'zy'（横から見た輪郭。x の向きへ押し出す。車の胴）・'xy'（正面の輪郭。z へ）・'xz'（上から見た輪郭。y へ）。
   * bevel で縁を丸める。holes は抜く穴（時計回り）
   */
  extrude(color: string, outline: V2[], plane: 'zy' | 'xy' | 'xz', from: number, to: number, o: PartOpts & { bevel?: number; holes?: V2[][]; curveSeg?: number } = {}): void {
    // 縁の丸み（bevel）は輪郭を外へ広げるので、先に同じだけ内へ寄せて、できあがりを渡した輪郭の大きさにする
    const bv0 = o.bevel ?? 0;
    const shapePts = bv0 > 0 ? insetPolygon(outline, bv0) : outline;
    const shape = new THREE.Shape(shapePts.map(([a, b]) => new THREE.Vector2(a, b)));
    for (const h of o.holes ?? []) shape.holes.push(new THREE.Path(h.map(([a, b]) => new THREE.Vector2(a, b))));
    const bv = o.bevel ?? 0;
    const depth = Math.max(Math.abs(to - from) - bv * 2, 0.001);
    const g = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: bv > 0,
      bevelThickness: bv,
      bevelSize: bv,
      bevelSegments: 2,
      curveSegments: o.curveSeg ?? 8,
    });
    // ExtrudeGeometry は xy の輪郭を z へ押し出す（z = -bv .. depth + bv）
    g.translate(0, 0, Math.min(from, to) + bv);
    if (plane === 'zy') {
      // 輪郭 (a, b) = (z, y)、押し出し = x
      g.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1));
    } else if (plane === 'xz') {
      // 輪郭 (a, b) = (x, z)、押し出し = y
      g.applyMatrix4(new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1));
    }
    // 鏡写しになった変換は面の向きを直す（法線は変換で正しく写るのでそのまま。縁の丸みのなめらかな法線を残す）
    if (plane !== 'xy') flipWinding(g);
    this.put(g, color, o);
  }

  /** 管: 点を通る管（sharp = 折れ線の角はそのまま。既定は曲線） */
  tube(color: string, pts: V3[], radius: number, o: PartOpts & { seg?: number; radial?: number; sharp?: boolean } = {}): void {
    if (o.sharp) {
      for (let i = 0; i + 1 < pts.length; i++) this.rod(color, pts[i], pts[i + 1], radius, o);
      // 継ぎ目の玉（細い管は粗く）
      for (let i = 1; i + 1 < pts.length; i++) this.ball(color, pts[i], radius, { ...o, seg: radius < 0.02 ? 6 : 8 });
      return;
    }
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'centripetal', 0.3);
    const g = new THREE.TubeGeometry(curve, o.seg ?? Math.max(8, pts.length * 6), radius, o.radial ?? 8, false);
    this.put(g, color, o);
  }

  /**
   * 曲げた管: 折れ線の角を半径 bendR で丸めて 1 本の管にする（手すり・はしご・パイプの椅子の脚）。
   * 角の丸みは折れ線の両側の辺の長さの半分まで
   */
  bend(color: string, pts: V3[], radius: number, bendR: number, o: PartOpts & { radial?: number } = {}): void {
    if (pts.length < 3 || bendR <= 0) {
      this.tube(color, pts, radius, { ...o, sharp: true });
      return;
    }
    const path = new THREE.CurvePath<THREE.Vector3>();
    const v = pts.map((p) => new THREE.Vector3(...p));
    let start = v[0].clone();
    for (let i = 1; i < v.length - 1; i++) {
      const a = v[i - 1];
      const b = v[i];
      const c = v[i + 1];
      const r = Math.min(bendR, a.distanceTo(b) / 2, b.distanceTo(c) / 2);
      const p0 = b.clone().add(a.clone().sub(b).setLength(r));
      const p1 = b.clone().add(c.clone().sub(b).setLength(r));
      path.add(new THREE.LineCurve3(start, p0));
      path.add(new THREE.QuadraticBezierCurve3(p0, b, p1));
      start = p1;
    }
    path.add(new THREE.LineCurve3(start, v[v.length - 1]));
    const g = new THREE.TubeGeometry(path as unknown as THREE.Curve<THREE.Vector3>, Math.max(12, pts.length * 8), radius, o.radial ?? 8, false);
    this.put(g, color, o);
  }

  /** 2 点を結ぶ棒（円柱） */
  rod(color: string, a: V3, b: V3, radius: number, o: PartOpts & { radial?: number } = {}): void {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const len = va.distanceTo(vb);
    if (len < 1e-5) return;
    const g = new THREE.CylinderGeometry(radius, radius, len, o.radial ?? 8, 1, false);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
    g.applyQuaternion(q);
    g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    this.put(g, color, o);
  }

  /** 楕円体 */
  ball(color: string, center: V3, radius: number | V3, o: PartOpts & { seg?: number } = {}): void {
    const r: V3 = typeof radius === 'number' ? [radius, radius, radius] : radius;
    const g = new THREE.SphereGeometry(1, o.seg ?? 12, Math.max(6, Math.round((o.seg ?? 12) * 0.6)));
    g.scale(r[0], r[1], r[2]);
    g.translate(center[0], center[1], center[2]);
    this.put(g, color, o);
  }

  /** 輪（タイヤ・浮き輪・取っ手）。axis は輪の穴の向き */
  torus(color: string, center: V3, radius: number, tube: number, o: PartOpts & { axis?: Axis; seg?: number; arc?: number; radial?: number } = {}): void {
    const g = new THREE.TorusGeometry(radius, tube, o.radial ?? 8, o.seg ?? 24, o.arc ?? Math.PI * 2);
    // TorusGeometry の穴は z 向き
    if ((o.axis ?? 'z') === 'x') g.rotateY(Math.PI / 2);
    if (o.axis === 'y') g.rotateX(Math.PI / 2);
    g.translate(center[0], center[1], center[2]);
    this.put(g, color, o);
  }

  /** 板（両面。ラベル・ガラス・紙）。facing は表の向き */
  plate(color: string, center: V3, w: number, h: number, facing: '+x' | '-x' | '+y' | '-y' | '+z' | '-z', o: PartOpts = {}): void {
    const g = new THREE.PlaneGeometry(w, h);
    if (facing === '+x') g.rotateY(Math.PI / 2);
    if (facing === '-x') g.rotateY(-Math.PI / 2);
    if (facing === '+y') g.rotateX(-Math.PI / 2);
    if (facing === '-y') g.rotateX(Math.PI / 2);
    if (facing === '-z') g.rotateY(Math.PI);
    g.translate(center[0], center[1], center[2]);
    this.put(g, color, { shadow: 'receive', ...o });
  }
}

/** 多角形を内へ d だけ寄せる（各頂点を、隣の 2 辺の内向きの法線の向きへ。鋭い角は寄せすぎないように上限） */
function insetPolygon(pts: V2[], d: number): V2[] {
  const n = pts.length;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % n];
    area += x0 * y1 - x1 * y0;
  }
  const ccw = area > 0;
  const out: V2[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const e1: V2 = [p1[0] - p0[0], p1[1] - p0[1]];
    const e2: V2 = [p2[0] - p1[0], p2[1] - p1[1]];
    const l1 = Math.hypot(e1[0], e1[1]) || 1;
    const l2 = Math.hypot(e2[0], e2[1]) || 1;
    // 内向きの法線（反時計回りなら左）
    const s = ccw ? 1 : -1;
    const n1: V2 = [(-e1[1] / l1) * s, (e1[0] / l1) * s];
    const n2: V2 = [(-e2[1] / l2) * s, (e2[0] / l2) * s];
    const sum: V2 = [n1[0] + n2[0], n1[1] + n2[1]];
    const k = Math.min(1 / Math.max(1 + n1[0] * n2[0] + n1[1] * n2[1], 0.25), 3);
    out.push([p1[0] + sum[0] * d * k, p1[1] + sum[1] * d * k]);
  }
  return out;
}

function orient(g: THREE.BufferGeometry, axis: Axis): void {
  if (axis === 'x') g.rotateZ(-Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
}

function flipWinding(g: THREE.BufferGeometry): void {
  const idx = g.getIndex();
  if (idx) {
    const a = idx.array as Uint16Array | Uint32Array;
    for (let i = 0; i < a.length; i += 3) {
      const t = a[i + 1];
      a[i + 1] = a[i + 2];
      a[i + 2] = t;
    }
    idx.needsUpdate = true;
    return;
  }
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const swap = (attr: THREE.BufferAttribute | undefined): void => {
    if (!attr) return;
    const n = attr.itemSize;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < attr.count; i += 3) {
      for (let k = 0; k < n; k++) {
        const t = arr[(i + 1) * n + k];
        arr[(i + 1) * n + k] = arr[(i + 2) * n + k];
        arr[(i + 2) * n + k] = t;
      }
    }
    attr.needsUpdate = true;
  };
  swap(pos);
  swap(g.getAttribute('uv') as THREE.BufferAttribute | undefined);
}

/** 角の丸い長方形の輪郭（中心 (cx, cy)・幅 w・高さ h・角の半径 r。反時計回り。extrude の輪郭に） */
export function roundRect(cx: number, cy: number, w: number, h: number, r: number, n = 4): V2[] {
  const rr = Math.min(r, w / 2, h / 2);
  const out: V2[] = [];
  const corner = (x: number, y: number, a0: number): void => {
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * (Math.PI / 2);
      out.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
    }
  };
  corner(cx + w / 2 - rr, cy - h / 2 + rr, -Math.PI / 2);
  corner(cx + w / 2 - rr, cy + h / 2 - rr, 0);
  corner(cx - w / 2 + rr, cy + h / 2 - rr, Math.PI / 2);
  corner(cx - w / 2 + rr, cy - h / 2 + rr, Math.PI);
  return out;
}

/** 弧の点（中心 c・半径 r・角度 a0 → a1、n 分割。輪郭を組み立てる） */
export function arcPts(c: V2, r: number, a0: number, a1: number, n: number): V2[] {
  return Array.from({ length: n + 1 }, (_, i): V2 => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r];
  });
}

/** 楕円の輪郭（中心 (cx, cy)・半径 rx, ry。反時計回り） */
export function ellipse(cx: number, cy: number, rx: number, ry: number, n = 20): V2[] {
  return Array.from({ length: n }, (_, i): V2 => {
    const a = (i / n) * Math.PI * 2;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
  });
}

/** 色を少し変える（同じ物のばらつき）。k = -1..1 で暗く..明るく */
export function shade(hex: string, k: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l + k * 0.12, 0, 1));
  return `#${c.getHexString()}`;
}

/** 物の一覧（見本帳と、場所ごとの置き換えに使う） */
export interface PropEntry {
  id: string;
  label: string;
  /** 物の外形のおよその寸法 [幅, 高さ, 奥行き]（見本帳の並べ方・撮る距離） */
  size: V3;
  build(p: Prop): void;
}
