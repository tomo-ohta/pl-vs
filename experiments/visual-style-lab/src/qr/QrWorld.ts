import * as THREE from 'three';
import type { App } from '../App.ts';
import type { PlanTourStop } from '../arch/plan.ts';
import { createStyleMaterial } from '../render/StyleMaterial.ts';
import { drawQr, encodeQr } from './qr.ts';

/**
 * ステージに置く QR コードと、割れた石板（docs/11-qr.md）。
 * - QR コード: 建築版の場面ごとに 1 か所、行き止まり・奥の壁に、落書き（スプレーの型抜き）か貼り紙で。中身は本物の QR で、
 *   次の場面（一覧の順。最後は最初へ）の URL（`arch.html?scene=…&stop=…`）。タブレットのカメラで収めてシャッターを押すと読み取り、
 *   探索と同じ電源が落ちる演出で、その URL の場所（道順の地点）へ移る
 * - 割れた石板: 隠し場所の URL（`?scene=…&at=…`）の QR を刻んだ石板が 3 つに割れ、かけらは別々の場面の隅にある（1 つの場面に 2 つ以上は置かない）。
 *   割れて QR が欠けているので読み取れない
 * 置く所は場面の道順の地点から決まりで選び（同じ場面ではいつも同じ所）、参考画像の視点からは見えない所にする
 */

export interface QrHit {
  kind: 'qr' | 'broken';
  /** 読み取った URL（qr のとき） */
  url?: string;
  /** 行き先の名前（qr のとき） */
  label?: string;
}

interface Item {
  kind: 'qr' | 'broken';
  center: THREE.Vector3;
  normal: THREE.Vector3;
  /** QR の一辺（m） */
  size: number;
  mesh: THREE.Object3D;
  url?: string;
  label?: string;
}

/** 割れた石板（1 枚・3 つのかけら）: かけらを置く場面（別々）と、刻んだ QR の隠し場所 */
const SLAB = {
  pieces: ['station', 'serverroom', 'whiteroom'] as const,
  /**
   * 隠し場所（場面と、目の位置・向き。道順にも参考画像にも無い所）: プラネタリウムのドームの下端の「輪の通路」（間取り図では入れない保守用の通路。
   * 劇場全体を見下ろす）。当たり判定の床が無いので、着く所の足元にだけ見えない床を置く（形は足さないので見た目は変わらない）
   */
  secret: { scene: 'planetarium', at: [-35.33, 16.45, -3.94, -1.92, -0.32] as [number, number, number, number, number], floor: 14.9 },
};

type V3 = [number, number, number];
/**
 * 置く所（findSpots で道順の地点から探した所。描いた形の平らな縦の壁（扉ではない・紙や落書きの全体が壁に沿う）で、前の床から 1.2〜1.7 m の高さ、前が開けていて、参考画像の視点から見えない所）。
 * qr: QR の真ん中と壁の向き（部屋の側）・corner: 割れた石板のかけらを立てかける隅（床の位置と壁の向き）
 */
const SPOTS: Record<string, { qr: { c: V3; n: V3 }; corner?: { p: V3; n: V3; side: number } }> = {
  corridor: { qr: { c: [2.1, -1.66, -24.153], n: [0, 0, 1] } },
  station: { qr: { c: [-43.936, 1.42, 24.428], n: [0, 0, -1] }, corner: { p: [-41.192, 0, 24.27], n: [0, 0, -1], side: 1 } },
  pool: { qr: { c: [9.388, 1.6, 31.5], n: [-1, 0, 0] } },
  alley: { qr: { c: [10.762, 10.92, 18.012], n: [0, 0, 1] } },
  pastel: { qr: { c: [-7.188, 1.42, -16.4], n: [1, 0, 0] } },
  waterpark: { qr: { c: [63.488, 1.42, -13.903], n: [-1, 0, 0] } },
  classroom: { qr: { c: [11.053, 12.22, 20.388], n: [0, 0, -1] } },
  serverroom: { qr: { c: [-12.612, 1.42, -15.986], n: [-1, 0, 0] }, corner: { p: [-10.83, 0, -11.65], n: [1, 0, 0], side: -1 } },
  whiteroom: { qr: { c: [2.578, 1.42, -34.947], n: [-1, 0, 0] }, corner: { p: [5.85, 0, 14.48], n: [-1, 0, 0], side: 1 } },
  squareroom: { qr: { c: [-69.9, 1.77, 15.588], n: [0, 0, -1] } },
  planetarium: { qr: { c: [-5.88, 1.42, -26.896], n: [-0.1951, 0, 0.9808] } },
};

/** 場面ごとの QR の見た目（屋外・設備の所は落書き、学校・病院・施設の中は貼り紙） */
const STYLE_OF: Record<string, 'graffiti' | 'paper'> = {
  corridor: 'paper', station: 'graffiti', pool: 'paper', alley: 'graffiti', pastel: 'paper', waterpark: 'paper',
  classroom: 'paper', serverroom: 'paper', whiteroom: 'graffiti', squareroom: 'graffiti', planetarium: 'paper',
};

/** QR・石板の材質の番号（線の検出用。作った順の番号を使わない＝場面のほかの材質の番号をずらさない） */
const QR_ID = 0.31;

const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
};

export class QrWorld {
  private items: Item[] = [];
  private readonly ray = new THREE.Raycaster();

  constructor(private readonly app: App) {}

  /** このページの URL の元（arch.html のある所） */
  private base(): string {
    return location.origin + location.pathname.replace(/[^/]*$/, '');
  }

  /** 場面の URL（道順の地点 stop へ） */
  stageUrl(scene: string, stop: number): string {
    return `${this.base()}arch.html?scene=${scene}&stop=${stop}`;
  }

  /** 隠し場所の URL */
  secretUrl(): string {
    const a = SLAB.secret.at.map((v, i) => v.toFixed(i < 3 ? 2 : 3)).join(',');
    return `${this.base()}arch.html?scene=${SLAB.secret.scene}&at=${a}`;
  }

  /** 場面を読んだ後に置く（建築版だけ） */
  place(): void {
    this.items = [];
    const app = this.app;
    const def = app.def;
    // 置かない（`?qr=0`。比べる・確かめる用）
    if (app.variant !== 'arch' || !def?.plan || new URLSearchParams(location.search).get('qr') === '0') return;
    const list = app.scenes.map((s) => s.id);
    const i = list.indexOf(def.id);
    if (i < 0) return;
    const group = new THREE.Group();
    group.name = 'qr';
    const spot = SPOTS[def.id];
    // QR コード: 次の場面へ（着く所は道順の何番目か。読み込んだ後で道順の数で割った余りにする）
    const next = list[(i + 1) % list.length];
    const nextLabel = (app.scenes[(i + 1) % list.length].label ?? next).replace(/（建築版）$/, '');
    if (spot) {
      const style = STYLE_OF[def.id] ?? 'paper';
      const url = this.stageUrl(next, Math.floor(hash(next + ':land') * 97));
      const center = new THREE.Vector3(...spot.qr.c);
      const normal = new THREE.Vector3(...spot.qr.n).normalize();
      const mesh = style === 'graffiti' ? graffiti(url, def.style, center, normal, hash(def.id)) : paper(url, def.style, center, normal, hash(def.id));
      this.matchSurface(mesh, center, normal);
      group.add(mesh);
      this.items.push({ kind: 'qr', center, normal, size: style === 'graffiti' ? 0.42 : 0.15, mesh, url, label: nextLabel });
    }
    // 割れた石板のかけら（この場面の番のかけら）
    const pi = (SLAB.pieces as readonly string[]).indexOf(def.id);
    if (pi >= 0 && spot?.corner) {
      const n = new THREE.Vector3(...spot.corner.n).normalize();
      const base = new THREE.Vector3(...spot.corner.p);
      const mesh = slabPiece(this.secretUrl(), pi, def.style, base, n, spot.corner.side, this.wallDistance(base.clone().setY(base.y + 0.3), n));
      this.matchSurface(mesh, new THREE.Vector3(...spot.corner.p).setY(spot.corner.p[1] + 0.5), n);
      group.add(mesh);
      const c = new THREE.Vector3();
      new THREE.Box3().setFromObject(mesh).getCenter(c);
      this.items.push({ kind: 'broken', center: c, normal: n, size: 0.2, mesh });
    }
    // 隠し場所の足元（見えない床）
    if (def.id === SLAB.secret.scene) {
      const [x, , z] = SLAB.secret.at;
      const f = SLAB.secret.floor;
      app.colliders.add({ x: x - 1.5, y: f - 0.3, z: z - 1.5 }, { x: x + 1.5, y: f, z: z + 1.5 });
    }
    // 映り込み（水面・床の鏡像）と日光の影に出さない層（1 番。小物と同じ）。参考画像の視点の絵を、映り込み・影を通しても変えないため
    group.traverse((o) => o.layers.set(1));
    app.scene.add(group);
  }

  /**
   * 貼った壁と同じ明るさの付き方にする。白い紙・塗料に場面の既定の落とし方を使うと、壁が明るい色のままの所で真っ黒になったり、光って見えたりするため。
   * - 壁が段落としの材質: その陰・暗部・ハイライトの割合と段落としの強さを写す
   * - 壁が場面専用の塗りの材質（駅・路地・パステルの部屋など。照明を使わず自分で色を作る）: 照明を使わない材質に替え、明るさ tone を掛ける
   * - 壁が見つからない: そのまま
   */
  private matchSurface(obj: THREE.Object3D, c: THREE.Vector3, n: THREE.Vector3, tone = 0.82): void {
    this.app.scene.updateMatrixWorld();
    this.ray.set(c.clone().addScaledVector(n, 0.3), n.clone().negate());
    this.ray.near = 0;
    this.ray.far = 0.6;
    this.ray.layers.enableAll();
    const hit = this.ray
      .intersectObjects(this.app.scene.children.filter((o) => o.name !== 'qr' && o.name !== 'sky'), true)
      .find((h) => (h.object as THREE.Mesh).isMesh && h.object.visible && !isChild(h.object, obj));
    if (!hit) return;
    const mm = (hit.object as THREE.Mesh).material;
    const wall = (Array.isArray(mm) ? mm[hit.face?.materialIndex ?? 0] : mm) as THREE.Material;
    const w = wall?.userData?.sl;
    const style = this.app.def!.style;
    const cap = (v: THREE.Vector3): THREE.Vector3 => new THREE.Vector3(Math.min(v.x, 1), Math.min(v.y, 1), Math.min(v.z, 1));
    obj.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const list = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((mat) => {
        const u = mat.userData?.sl;
        if (!u) return mat;
        if (w) {
          u.uSlRatioShade.value.copy(cap(w.uSlRatioShade.value));
          u.uSlRatioDark.value.copy(cap(w.uSlRatioDark.value));
          u.uSlRatioHi.value.copy(cap(w.uSlRatioHi.value));
          u.uSlToon.value = w.uSlToon.value;
          u.uSlBounce.value = w.uSlBounce.value;
          return mat;
        }
        const so = mat.userData.slOptions as Parameters<typeof createStyleMaterial>[1];
        const m2 = createStyleMaterial(style, { ...so, color: new THREE.Color(so.color).multiplyScalar(tone), unlit: true });
        m2.depthWrite = mat.depthWrite;
        m2.polygonOffset = mat.polygonOffset;
        m2.polygonOffsetFactor = mat.polygonOffsetFactor;
        m2.polygonOffsetUnits = mat.polygonOffsetUnits;
        mat.dispose();
        return m2;
      });
      mesh.material = Array.isArray(mesh.material) ? list : list[0];
    });
  }

  /** 点から壁の向き（-n）へ、描いた形の壁までの距離（見つからなければ 0.15） */
  private wallDistance(p: THREE.Vector3, n: THREE.Vector3): number {
    this.app.scene.updateMatrixWorld();
    this.ray.set(p.clone().addScaledVector(n, 0.6), n.clone().negate());
    this.ray.near = 0;
    this.ray.far = 1.5;
    this.ray.layers.enableAll();
    const h = this.ray
      .intersectObjects(this.app.scene.children.filter((o) => o.name !== 'qr' && o.name !== 'sky'), true)
      .find((x) => (x.object as THREE.Mesh).isMesh && x.object.visible);
    return h ? h.distance - 0.6 : 0.15;
  }

  /** 道順の地点を、行き止まり → 奥 → ほか の順に（同じ場面ではいつも同じ順） */
  private stopOrder(stops: PlanTourStop[], id: string): number[] {
    const score = (s: PlanTourStop): number => (s.label.includes('行き止まり') ? 0 : s.label.includes('奥') ? 1 : 2);
    return stops
      .map((s, i) => ({ i, k: score(s) + hash(id + i) * 0.9 }))
      .sort((a, b) => a.k - b.k)
      .map((x) => x.i);
  }

  /**
   * 参考画像の視点から見えるか（画角の中で、間に遮る物が無い）。clear は目から点までが開けているか（既定は当たり判定の壁で見る。
   * findSpots は描いた形で見る。当たり判定の無い手すりのすき間などから、遠くの QR が数画素だけ写ることがあるため）
   */
  private seenFromViews(p: THREE.Vector3, clear?: (eye: THREE.Vector3, p: THREE.Vector3) => boolean): boolean {
    const def = this.app.def;
    if (!def) return false;
    const cam = new THREE.PerspectiveCamera();
    for (const v of def.views) {
      const [w, h] = v.size ?? [1456, 816];
      cam.fov = v.fov;
      cam.aspect = w / h;
      cam.near = 0.05;
      cam.far = 500;
      cam.position.set(...v.eye);
      cam.rotation.set(v.pitch, v.yaw, v.roll ?? 0, 'YXZ');
      cam.updateMatrixWorld();
      cam.updateProjectionMatrix();
      const q = p.clone().project(cam);
      if (q.z < -1 || q.z > 1 || Math.abs(q.x) > 1.1 || Math.abs(q.y) > 1.1) continue;
      if (clear) {
        if (clear(cam.position, p)) return true;
        continue;
      }
      const dx = p.x - v.eye[0];
      const dz = p.z - v.eye[2];
      const dist = Math.hypot(dx, dz);
      if (dist < 0.1) return true;
      const free = this.app.colliders.rayXZ(v.eye[0], v.eye[2], (v.eye[1] + p.y) / 2, dx / dist, dz / dist, dist);
      if (free >= dist - 0.3) return true;
    }
    return false;
  }

  /**
   * 置く所を探す道具（開発用。ブラウザのコンソールで __lab.app.qr.findSpots()）: 道順の地点から水平に、描いた形（当たり判定ではなく）へ光線を当て、
   * 透けない平らな縦の壁（扉ではなく、QR の紙・落書きの全体が壁に沿う）で、前の床から目より少し下の高さ、前が開けていて（柱・仕切りのすき間・ガラスの向こうに入らない）、
   * 参考画像の視点から見えない所を返す。結果は SPOTS の表に写して使う（読み込みのたびには探さない）
   */
  findSpots(): { qr: { c: number[]; n: number[] } | null; corner: { p: number[]; n: number[]; side: number } | null } {
    const def = this.app.def;
    if (!def?.plan) return { qr: null, corner: null };
    const { cast, castAll } = this.probe();
    const style = STYLE_OF[def.id] ?? 'paper';
    const wallAt = (o: THREE.Vector3, d: THREE.Vector3, far: number, area?: 'paper' | 'graffiti'): { p: THREE.Vector3; n: THREE.Vector3 } | null => {
      const h = cast(o, d, far);
      if (!h?.face || isDoor(h)) return null;
      const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
      if (n.dot(d) > 0) n.negate();
      if (Math.abs(n.y) > 0.15) return null;
      n.y = 0;
      n.normalize();
      if (area && this.flushGap(cast, h.point.clone().addScaledVector(n, 0.012), n, area) > 0.006) return null;
      if (!area) {
        // 石板を立てかける壁: 0.5 m 角が同じ面か（4 隅へも光線を当てる）
        const along = new THREE.Vector3(-n.z, 0, n.x);
        for (const [a, b] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) {
          const q = h.point.clone().addScaledVector(n, 0.3).addScaledVector(along, a).add(new THREE.Vector3(0, b, 0));
          const h2 = cast(q, n.clone().negate(), 0.5);
          if (!h2 || Math.abs(h2.distance - 0.3) > 0.01 || isDoor(h2)) return null;
        }
      }
      return { p: h.point.clone(), n };
    };
    // 前が開けているか（1.3 m 手前の 3 か所の目から QR の面の 9 点が見える。柱・仕切りのすき間などに入っていない）
    const frontClear = (p: THREE.Vector3, n: THREE.Vector3): boolean => {
      const along = new THREE.Vector3(-n.z, 0, n.x);
      for (const e of [-0.4, 0, 0.4]) {
        const eye = p.clone().addScaledVector(n, 1.3).addScaledVector(along, e);
        for (const a of [-0.18, 0, 0.18]) {
          for (const b of [-0.18, 0, 0.18]) {
            const t = p.clone().addScaledVector(n, 0.02).addScaledVector(along, a).add(new THREE.Vector3(0, b, 0));
            const d = t.clone().sub(eye);
            const len = d.length();
            const h = castAll(eye, d.normalize(), len);
            if (h && h.distance < len - 0.03) return false;
          }
        }
      }
      return true;
    };
    // 参考画像の視点から、真ん中・4 隅のどれかが見えるか（描いた形で遮られるかを見る）
    const sight = (eye: THREE.Vector3, p: THREE.Vector3): boolean => {
      const d = p.clone().sub(eye);
      const len = d.length();
      const h = cast(eye, d.normalize(), len);
      return !h || h.distance >= len - 0.04;
    };
    const seen = (c: THREE.Vector3, n: THREE.Vector3, r: number): boolean => {
      const along = new THREE.Vector3(-n.z, 0, n.x);
      for (const [a, b] of [[0, 0], [-r, -r], [r, -r], [-r, r], [r, r]]) {
        const q = c.clone().addScaledVector(n, 0.02).addScaledVector(along, a).add(new THREE.Vector3(0, b, 0));
        if (this.seenFromViews(q, sight)) return true;
      }
      return false;
    };
    const stops = def.plan.tour;
    const order = this.stopOrder(stops, def.id);
    const turns = [0, Math.PI / 2, -Math.PI / 2, Math.PI];
    let qr: { c: number[]; n: number[] } | null = null;
    let corner: { p: number[]; n: number[]; side: number } | null = null;
    for (const si of order) {
      const s = stops[si];
      const floor = this.app.colliders.groundBelow(s.eye[0], s.eye[2], 0.2, s.eye[1]).y;
      const fy = Number.isFinite(floor) ? floor : s.eye[1] - 1.6;
      for (const t of turns) {
        const yaw = s.yaw + t;
        const d = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
        if (!qr) {
          const w = wallAt(new THREE.Vector3(s.eye[0], fy + 1.42, s.eye[2]), d, 7, style);
          if (w && w.p.distanceTo(new THREE.Vector3(s.eye[0], fy + 1.42, s.eye[2])) > 0.8 && this.standHeight(w.p, w.n) && frontClear(w.p, w.n)) {
            const c = w.p.clone().addScaledVector(w.n, 0.012);
            if (!seen(c, w.n, 0.3)) qr = { c: c.toArray(), n: w.n.toArray() };
          }
        }
        if (!corner && qr) {
          const w = wallAt(new THREE.Vector3(s.eye[0], fy + 0.4, s.eye[2]), d, 8);
          if (!w) continue;
          const along = new THREE.Vector3(-w.n.z, 0, w.n.x);
          for (const sgn of [1, -1]) {
            const from = w.p.clone().addScaledVector(w.n, 0.35);
            const h = cast(from, along.clone().multiplyScalar(sgn), 3.5);
            if (!h) continue;
            const pos = from.clone().addScaledVector(along, sgn * Math.max(0, h.distance - 0.32)).addScaledVector(w.n, -0.2);
            pos.y = fy;
            const qc = new THREE.Vector3(qr.c[0], qr.c[1], qr.c[2]);
            if (pos.distanceTo(qc) < 3 || seen(pos.clone().setY(fy + 0.3), w.n, 0.3)) continue;
            corner = { p: pos.toArray(), n: w.n.toArray(), side: sgn };
            break;
          }
        }
        if (qr && corner) return { qr, corner };
      }
    }
    return { qr, corner };
  }

  /** 描いた形へ光線を当てる（cast は透けない物だけ・castAll はガラスなども） */
  private probe(): { cast: Cast; castAll: Cast } {
    const opaque: THREE.Object3D[] = [];
    const all: THREE.Object3D[] = [];
    this.app.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.visible || o.name === 'sky' || isChild(o, this.app.scene.getObjectByName('qr') ?? null)) return;
      all.push(m);
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      if (!mats.some((mm) => mm.transparent || (mm as THREE.MeshStandardMaterial).opacity < 1)) opaque.push(m);
    });
    const ray = new THREE.Raycaster();
    ray.layers.enableAll();
    const mk = (list: THREE.Object3D[]): Cast => (o, d, far) => {
      ray.set(o, d);
      ray.near = 0.05;
      ray.far = far;
      return ray.intersectObjects(list, false)[0] ?? null;
    };
    return { cast: mk(opaque), castAll: mk(all) };
  }

  /**
   * QR の紙・落書きの全体が壁に沿っているか: 面の 5 × 5 点から壁へ光線を当て、置いた面（壁から 1.2 cm）からのずれのいちばん大きい値（m）。
   * 壁が無い・扉・別の向きの面に当たった点は 1 とする
   */
  private flushGap(cast: Cast, c: THREE.Vector3, n: THREE.Vector3, area: 'paper' | 'graffiti'): number {
    // 紙はテープの分、落書きは垂れの分も含め、少し大きめに見る
    const [hw, y0, y1] = area === 'graffiti' ? [0.27, -0.39, 0.27] : [0.14, -0.19, 0.2];
    const along = new THREE.Vector3(-n.z, 0, n.x);
    let worst = 0;
    for (let i = 0; i <= 4; i++) {
      for (let j = 0; j <= 4; j++) {
        const q = c.clone().addScaledVector(along, -hw + (2 * hw * i) / 4).add(new THREE.Vector3(0, y0 + ((y1 - y0) * j) / 4, 0));
        const h = cast(q.clone().addScaledVector(n, 0.2), n.clone().negate(), 0.5);
        const fn = h?.face?.normal.clone().transformDirection(h.object.matrixWorld);
        if (!h || !fn || Math.abs(fn.dot(n)) < 0.98 || isDoor(h)) return 1;
        worst = Math.max(worst, Math.abs(h.distance - 0.212));
      }
    }
    return worst;
  }

  /**
   * QR の前（0.8 m・1.2 m の立つ所）の床から QR の真ん中までの高さが、目の高さより少し下（1.2〜1.7 m）か。
   * 道順の地点の目の高さで探すと、吹き抜けの向こうの壁（床が何 m も下）や、低い通路の上（膝の高さ）に貼ってしまうため
   */
  private standHeight(c: THREE.Vector3, n: THREE.Vector3): boolean {
    for (const d of [0.8, 1.2]) {
      const p = c.clone().addScaledVector(n, d);
      const g = this.app.colliders.groundBelow(p.x, p.z, 0.25, c.y + 0.3).y;
      if (!Number.isFinite(g) || c.y - g < 1.2 || c.y - g > 1.7) return false;
    }
    return true;
  }

  /** 開発用: 置いた QR が壁に沿っているか（ずれのいちばん大きい値 m。1 は壁が無い・扉の所がある）と、前の床からの高さが合うか（__lab.app.qr.checkFlush()） */
  checkFlush(): { kind: string; gap: number; height: boolean }[] {
    const { cast } = this.probe();
    const style = STYLE_OF[this.app.def?.id ?? ''] ?? 'paper';
    return this.items
      .filter((it) => it.kind === 'qr')
      .map((it) => ({ kind: it.kind, gap: Math.round(this.flushGap(cast, it.center, it.normal, style) * 1000) / 1000, height: this.standHeight(it.center, it.normal) }));
  }

  /** 開発用: 置いた物が 1.3 m 手前の 3 か所の目から見えるか（見えた点の割合。__lab.app.qr.checkFront()） */
  checkFront(): { kind: string; seen: number }[] {
    const meshes: THREE.Object3D[] = this.app.scene.children.filter((o) => o.name !== 'qr' && o.name !== 'sky');
    this.ray.layers.enableAll();
    return this.items.map((it) => {
      const along = new THREE.Vector3(-it.normal.z, 0, it.normal.x);
      let ok = 0;
      let all = 0;
      for (const e of [-0.4, 0, 0.4]) {
        const eye = it.center.clone().addScaledVector(it.normal, 1.3).addScaledVector(along, e);
        for (const a of [-0.1, 0, 0.1]) {
          for (const b of [-0.1, 0, 0.1]) {
            const t = it.center.clone().addScaledVector(it.normal, 0.02).addScaledVector(along, a).add(new THREE.Vector3(0, b, 0));
            const d = t.clone().sub(eye);
            const len = d.length();
            this.ray.set(eye, d.normalize());
            this.ray.near = 0;
            this.ray.far = len - 0.03;
            all++;
            if (!this.ray.intersectObjects(meshes, true).some((x) => (x.object as THREE.Mesh).isMesh && x.object.visible)) ok++;
          }
        }
      }
      return { kind: it.kind, seen: Math.round((ok / all) * 100) / 100 };
    });
  }

  /**
   * 開発用: 置いた物が参考画像の視点から（描いた形のすき間からでも）見えるか（__lab.app.qr.checkViews()）。置いた物の形の頂点ごとに、
   * 各視点の目から透けない形に遮られずに届くかを見て、届いた頂点の数を返す（0 なら見えない）。画角は広めに見る（建築版の視点はレンズを上下にずらしていることがあるため）
   */
  checkViews(): { kind: string; seen: number }[] {
    const { cast } = this.probe();
    const def = this.app.def;
    if (!def) return [];
    const cam = new THREE.PerspectiveCamera();
    const v = new THREE.Vector3();
    return this.items.map((it) => {
      const pts: THREE.Vector3[] = [];
      it.mesh.updateMatrixWorld(true);
      it.mesh.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const pos = m.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i += Math.max(1, Math.floor(pos.count / 160))) pts.push(v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).clone());
      });
      let seen = 0;
      for (const view of def.views) {
        const [w, h] = view.size ?? [1456, 816];
        cam.fov = view.fov;
        cam.aspect = w / h;
        cam.near = 0.05;
        cam.far = 500;
        cam.position.set(...view.eye);
        cam.rotation.set(view.pitch, view.yaw, view.roll ?? 0, 'YXZ');
        cam.updateMatrixWorld();
        cam.updateProjectionMatrix();
        for (const p of pts) {
          const q = p.clone().project(cam);
          if (q.z < -1 || q.z > 1 || Math.abs(q.x) > 2 || Math.abs(q.y) > 2) continue;
          const d = p.clone().sub(cam.position);
          const len = d.length();
          const hit = cast(cam.position, d.normalize(), len);
          if (!hit || hit.distance >= len - 0.005) seen++;
        }
      }
      return { kind: it.kind, seen };
    });
  }

  /** シャッターを押した時: 画面の真ん中あたりに、十分な大きさで、正面寄りに、遮られずに写っている QR（なければ null） */
  scan(camera: THREE.PerspectiveCamera): QrHit | null {
    let best: { item: Item; score: number } | null = null;
    const camPos = camera.getWorldPosition(new THREE.Vector3());
    for (const it of this.items) {
      const to = camPos.clone().sub(it.center);
      const dist = to.length();
      if (dist > 7 || dist < 0.15) continue;
      if (to.clone().normalize().dot(it.normal) < 0.4) continue;
      const c = it.center.clone().project(camera);
      if (c.z < -1 || c.z > 1 || Math.abs(c.x) > 0.75 || Math.abs(c.y) > 0.75) continue;
      // 画面の上の大きさ（縦の画面に対する割合）
      const up = new THREE.Vector3(0, it.size / 2, 0);
      const a = it.center.clone().add(up).project(camera);
      const b = it.center.clone().sub(up).project(camera);
      const frac = Math.abs(a.y - b.y) / 2;
      if (frac < 0.07) continue;
      // 遮る物（場面の形）
      this.ray.set(camPos, it.center.clone().sub(camPos).normalize());
      this.ray.near = 0.05;
      this.ray.far = dist - 0.06;
      this.ray.layers.enableAll();
      const hits = this.ray.intersectObjects(this.app.scene.children.filter((o) => o.name !== 'qr' && o.name !== 'sky'), true);
      if (hits.some((h) => (h.object as THREE.Mesh).isMesh && (h.object as THREE.Mesh).visible)) continue;
      const score = Math.hypot(c.x, c.y);
      if (!best || score < best.score) best = { item: it, score };
    }
    if (!best) return null;
    return best.item.kind === 'qr' ? { kind: 'qr', url: best.item.url, label: best.item.label } : { kind: 'broken' };
  }
}

// ---------------------------------------------------------------- 見た目

/** 落書き（スプレーの型抜き）: 白く塗った下地（縁が荒い）に黒の QR、下へ垂れ */
function graffiti(url: string, style: Parameters<typeof createStyleMaterial>[0], center: THREE.Vector3, normal: THREE.Vector3, r: number): THREE.Mesh {
  const qr = encodeQr(url, 'M');
  const px = 10;
  const quiet = 3;
  const n = qr.size + quiet * 2;
  const W = n * px;
  const H = Math.round(W * 1.25);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const rnd = mulberry(Math.floor(r * 1e6));
  // 下地: 白いスプレーの四角（縁がにじむ）
  g.fillStyle = 'rgba(236, 234, 226, 0.96)';
  g.beginPath();
  const m = 6;
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const side = Math.floor(t * 4) % 4;
    const u = (t * 4) % 1;
    const j = (rnd() - 0.5) * 6;
    const pts: [number, number][] = [[m + u * (W - 2 * m), m + j], [W - m + j, m + u * (W - 2 * m)], [W - m - u * (W - 2 * m), W - m + j], [m + j, W - m - u * (W - 2 * m)]];
    const [x, y] = pts[side];
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.fill();
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(236, 234, 226, ${0.25 + rnd() * 0.35})`;
    const a = rnd() * Math.PI * 2;
    const d = W * 0.47 + rnd() * W * 0.06;
    g.beginPath();
    g.arc(W / 2 + Math.cos(a) * d, W / 2 + Math.sin(a) * d, 1 + rnd() * 2.5, 0, Math.PI * 2);
    g.fill();
  }
  // QR（型抜きの黒）
  g.fillStyle = 'rgba(18, 18, 20, 0.97)';
  for (let y = 0; y < qr.size; y++) for (let x = 0; x < qr.size; x++) if (qr.get(x, y)) g.fillRect((x + quiet) * px, (y + quiet) * px, px + 0.5, px + 0.5);
  // 垂れ
  for (let i = 0; i < 7; i++) {
    const x = (quiet + rnd() * qr.size) * px;
    const len = 20 + rnd() * (H - W - 10);
    const grad = g.createLinearGradient(0, W - quiet * px, 0, W - quiet * px + len);
    grad.addColorStop(0, 'rgba(18,18,20,0.9)');
    grad.addColorStop(1, 'rgba(18,18,20,0)');
    g.fillStyle = grad;
    g.fillRect(x, W - quiet * px - 4, 2 + rnd() * 2, len);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const size = 0.42 * (n / qr.size);
  const mat = createStyleMaterial(style, { color: 0xffffff, map: tex, transparent: true, toon: 0.6, line: 0, name: 'qr-graffiti', id: QR_ID });
  // 壁から 1.2 cm 浮かせてあるので、深度のずらしは傾きに比例しない小さな分だけ（傾きで大きくすると、斜めから見た時に手前の柱の縁から透けて写る）
  mat.depthWrite = false;
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = 0;
  mat.polygonOffsetUnits = -4;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 1.25), mat);
  mesh.position.copy(center).add(new THREE.Vector3(0, -size * 0.125, 0));
  mesh.lookAt(mesh.position.clone().add(normal));
  mesh.renderOrder = 2;
  return mesh;
}

/** 貼り紙: A5 ほどの紙に QR を刷り、上の 2 隅をテープで留める（少し反る） */
function paper(url: string, style: Parameters<typeof createStyleMaterial>[0], center: THREE.Vector3, normal: THREE.Vector3, r: number): THREE.Group {
  const qr = encodeQr(url, 'M');
  const W = 512;
  const H = 724;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f3f1ea';
  g.fillRect(0, 0, W, H);
  const qc = drawQr(qr, Math.floor(400 / (qr.size + 8)), 4, '#141416', '#f3f1ea');
  const s = qc.width;
  g.drawImage(qc, (W - s) / 2, 96);
  g.fillStyle = '#26262a';
  g.font = '600 30px "Hiragino Sans", sans-serif';
  g.textAlign = 'center';
  g.fillText('ここから', W / 2, 70);
  g.font = '22px "Hiragino Sans", sans-serif';
  g.fillStyle = '#55555c';
  g.fillText(`No.${String(Math.floor(r * 90) + 10)}`, W / 2, H - 40);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const w = 0.15 * (W / s) * ((qr.size + 8) / qr.size) * 0.98;
  const h = w * (H / W);
  const geo = new THREE.PlaneGeometry(w, h, 6, 8);
  // 下の方を少し壁から浮かせる（紙の反り）
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const v = (pos.getY(i) + h / 2) / h;
    pos.setZ(i, (1 - v) * (1 - v) * 0.012);
  }
  geo.computeVertexNormals();
  const mat = createStyleMaterial(style, { color: 0xffffff, map: tex, toon: 0.6, line: 0.4, name: 'qr-paper', id: QR_ID });
  const sheet = new THREE.Mesh(geo, mat);
  const grp = new THREE.Group();
  grp.add(sheet);
  // テープ（半透明の細い帯）
  const tapeMat = createStyleMaterial(style, { color: '#e8dfb8', transparent: true, opacity: 0.75, toon: 0.6, line: 0, name: 'qr-tape', id: QR_ID + 0.07 });
  for (const sx of [-1, 1]) {
    const tape = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.016), tapeMat);
    tape.position.set(sx * (w / 2 - 0.006), h / 2 - 0.004, 0.001);
    tape.rotation.z = sx * 0.6;
    grp.add(tape);
  }
  grp.position.copy(center);
  grp.lookAt(center.clone().add(normal));
  grp.rotateZ((r - 0.5) * 0.06);
  return grp;
}

/** 割れた石板のかけら（piece 0〜2）: 石板（0.6 × 0.42 × 0.05 m）に刻んだ QR を 3 つに割った 1 つ。壁に立てかける */
function slabPiece(url: string, piece: number, style: Parameters<typeof createStyleMaterial>[0], pos: THREE.Vector3, normal: THREE.Vector3, side: number, wallDist: number): THREE.Group {
  const SW = 0.6;
  const SH = 0.42;
  // 割れ目（上から下へ 2 本。どちらも QR の上の角の位置検出の印を横切る）
  const crackA: [number, number][] = [[0.205, SH], [0.236, 0.36], [0.21, 0.3], [0.25, 0.22], [0.228, 0.13], [0.262, 0.06], [0.24, 0]];
  const crackB: [number, number][] = [[0.405, SH], [0.372, 0.35], [0.398, 0.27], [0.36, 0.2], [0.392, 0.12], [0.37, 0]];
  const polys: [number, number][][] = [
    [[0, 0], ...crackA.slice().reverse(), [0, SH]],
    [...crackA, ...crackB.slice().reverse()],
    [...crackB, [SW, 0], [SW, SH]],
  ];
  const poly = polys[piece];
  // 割れ目のところは少し欠ける（縮める）
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
  const cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  const shrunk = poly.map(([x, y]) => [cx + (x - cx) * 0.97, cy + (y - cy) * 0.97] as [number, number]);
  const shape = new THREE.Shape(shrunk.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1 });
  // 表の模様: 石の色に、刻んだ QR（真ん中の 0.32 m 角）
  const qr = encodeQr(url, 'M');
  const T = 1024;
  const c = document.createElement('canvas');
  c.width = T;
  c.height = Math.round((T * SH) / SW);
  const g = c.getContext('2d')!;
  const rnd = mulberry(7 + piece);
  g.fillStyle = '#8e8c84';
  g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(${rnd() < 0.5 ? '60,58,54' : '190,186,176'}, ${0.08 + rnd() * 0.12})`;
    g.fillRect(rnd() * c.width, rnd() * c.height, 2 + rnd() * 9, 2 + rnd() * 9);
  }
  const qs = (0.32 / SW) * T;
  const mpx = qs / qr.size;
  const ox = (c.width - qs) / 2;
  const oy = (c.height - qs) / 2;
  g.fillStyle = '#2a2925';
  for (let y = 0; y < qr.size; y++) for (let x = 0; x < qr.size; x++) if (qr.get(x, y)) g.fillRect(ox + x * mpx, oy + y * mpx, mpx + 0.5, mpx + 0.5);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  // ExtrudeGeometry の表と裏の UV は形の座標（m）。石板の大きさで 0〜1 にする（石板の上 = キャンバスの上 = v 1）
  tex.repeat.set(1 / SW, 1 / SH);
  const face = createStyleMaterial(style, { color: 0xffffff, map: tex, toon: 0.6, name: 'qr-slab', id: QR_ID + 0.11 });
  const sideMat = createStyleMaterial(style, { color: '#7c7a73', toon: 0.6, name: 'qr-slab-side', id: QR_ID + 0.15 });
  const mesh = new THREE.Mesh(geo, [face, sideMat]);
  mesh.receiveShadow = true;
  // 形の座標（x 右・y 上・z 手前）→ 壁に立てかける: かけらの下端を床に、後ろへ 18° 倒す。かけらごとに横へずらす
  const grp = new THREE.Group();
  const pivot = new THREE.Group();
  // かけらの下端の真ん中を、立てかける所（床）に合わせる
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  mesh.position.set(-(bb.min.x + bb.max.x) / 2, -bb.min.y + 0.004, -0.025);
  pivot.add(mesh);
  pivot.rotation.x = -0.32;
  pivot.rotation.z = (piece - 1) * 0.08 * side;
  // 傾けた後のいちばん壁寄りの点が壁に触れ（2 mm 手前）、いちばん低い点が床に着くようにずらす（壁にはめり込ませない。床には 6 mm だけ沈める:
  // 下の縁が床の面にぴったりだと、遠くの視点から床と壁のすき間越しに 1 画素だけ写ることがあった）
  pivot.updateMatrix();
  mesh.updateMatrix();
  const m = pivot.matrix.clone().multiply(mesh.matrix);
  const gp = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  let minZ = Infinity;
  let minY = Infinity;
  for (let i = 0; i < gp.count; i++) {
    v.fromBufferAttribute(gp, i).applyMatrix4(m);
    minZ = Math.min(minZ, v.z);
    minY = Math.min(minY, v.y);
  }
  pivot.position.z += -(wallDist - 0.002) - minZ;
  pivot.position.y -= minY + 0.006;
  grp.add(pivot);
  grp.position.copy(pos);
  grp.lookAt(pos.clone().add(normal));
  return grp;
}

function isChild(o: THREE.Object3D, root: THREE.Object3D | null): boolean {
  if (!root) return false;
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p === root) return true;
  return false;
}

type Cast = (o: THREE.Vector3, d: THREE.Vector3, far: number) => THREE.Intersection | null;

/** 扉の面か（開いた扉の板に貼ると、正面からは出入り口の中に浮いて見える。閉じた扉もまとめて避ける） */
function isDoor(h: THREE.Intersection): boolean {
  const mm = (h.object as THREE.Mesh).material;
  const m = Array.isArray(mm) ? mm[h.face?.materialIndex ?? 0] : mm;
  if (/door/i.test(m?.name ?? '')) return true;
  for (let p: THREE.Object3D | null = h.object; p; p = p.parent) if (/door/i.test(p.name)) return true;
  return false;
}

function mulberry(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
