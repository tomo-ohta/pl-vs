import * as THREE from 'three';

/**
 * 断面を道筋に沿って掃く道具（スライダーの樋・筒・ダクト・プールの縁）。
 * - 道筋は点の列（Vec3）。向きは「横 = 接線 × 上、上 = 横 × 接線」（ねじれない）に、点ごとの傾き（bank, ラジアン）を足す
 * - 断面は (横, 上) の 2D の点の列。closed で輪（筒）、開いた列は樋（U 字）
 * - uv: u = 断面に沿った長さ（m）、v = 道筋に沿った長さ（m）。継ぎ目の輪・模様に使う
 */
export type P2 = [number, number];
export type P3 = [number, number, number];

export interface SweepPath {
  pts: THREE.Vector3[];
  /** 点ごとの傾き（ラジアン。正で横（+side）の側が下がる） */
  bank?: number[];
  closed?: boolean;
}

const UP = new THREE.Vector3(0, 1, 0);

/** 道筋の各点の向き（接線・横・上） */
export function frames(path: SweepPath): { t: THREE.Vector3; s: THREE.Vector3; u: THREE.Vector3 }[] {
  const n = path.pts.length;
  const out: { t: THREE.Vector3; s: THREE.Vector3; u: THREE.Vector3 }[] = [];
  for (let i = 0; i < n; i++) {
    const a = path.closed ? path.pts[(i - 1 + n) % n] : path.pts[Math.max(i - 1, 0)];
    const b = path.closed ? path.pts[(i + 1) % n] : path.pts[Math.min(i + 1, n - 1)];
    const t = b.clone().sub(a).normalize();
    let s = new THREE.Vector3().crossVectors(t, UP);
    if (s.lengthSq() < 1e-6) s = new THREE.Vector3(1, 0, 0);
    s.normalize();
    const u = new THREE.Vector3().crossVectors(s, t).normalize();
    const bk = path.bank?.[i] ?? 0;
    if (bk !== 0) {
      const q = new THREE.Quaternion().setFromAxisAngle(t, bk);
      s.applyQuaternion(q);
      u.applyQuaternion(q);
    }
    out.push({ t, s, u });
  }
  return out;
}

/**
 * 断面 prof を道筋に沿って掃く。closedProf = 断面が輪（筒）。
 * 返す形は位置・法線・uv つき（法線は計算で）
 */
export function sweep(path: SweepPath, prof: P2[], o: { closedProf?: boolean; caps?: boolean; scale?: number[]; scaleY?: number[] } = {}): THREE.BufferGeometry {
  const fr = frames(path);
  const n = path.pts.length;
  const m = prof.length;
  const pos: number[] = [];
  const uv: number[] = [];
  // 断面に沿った長さ
  const pl: number[] = [0];
  for (let j = 1; j < m; j++) pl.push(pl[j - 1] + Math.hypot(prof[j][0] - prof[j - 1][0], prof[j][1] - prof[j - 1][1]));
  let along = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0) along += path.pts[i].distanceTo(path.pts[i - 1]);
    const { s, u } = fr[i];
    const p = path.pts[i];
    const sc = o.scale?.[i] ?? 1;
    const sy = o.scaleY?.[i] ?? sc;
    for (let j = 0; j < m; j++) {
      const a = prof[j][0] * sc;
      const b = prof[j][1] * sy;
      pos.push(p.x + s.x * a + u.x * b, p.y + s.y * a + u.y * b, p.z + s.z * a + u.z * b);
      uv.push(pl[j], along);
    }
  }
  const idx: number[] = [];
  const segs = path.closed ? n : n - 1;
  const ring = o.closedProf ? m : m - 1;
  for (let i = 0; i < segs; i++) {
    const i1 = (i + 1) % n;
    for (let j = 0; j < ring; j++) {
      const j1 = (j + 1) % m;
      const a = i * m + j;
      const b = i1 * m + j;
      const c = i1 * m + j1;
      const d = i * m + j1;
      idx.push(a, d, b, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** 断面: 厚みのある U 字の樋（内側の半径 r・厚み th・縁の高さ（中心より上）lip・縁の外への返し rim） */
export function troughProfile(r: number, th: number, lip: number, n = 14, rim = 0.06): P2[] {
  const inner: P2[] = [];
  // 左の縁の上 → 底 → 右の縁の上（内側）
  inner.push([-r, lip]);
  for (let i = 0; i <= n; i++) {
    const a = Math.PI + (i / n) * Math.PI; // 180° → 360°
    inner.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  inner.push([r, lip]);
  const outer: P2[] = [];
  outer.push([r + th + rim, lip]);
  outer.push([r + th + rim, lip - th]);
  outer.push([r + th, lip - th]);
  for (let i = n; i >= 0; i--) {
    const a = Math.PI + (i / n) * Math.PI;
    outer.push([Math.cos(a) * (r + th), Math.sin(a) * (r + th)]);
  }
  outer.push([-r - th, lip - th]);
  outer.push([-r - th - rim, lip - th]);
  outer.push([-r - th - rim, lip]);
  return [...inner, ...outer];
}

/** 断面: 円（筒）。半径 r・n 分割 */
export function ringProfile(r: number, n = 16): P2[] {
  return Array.from({ length: n }, (_, i): P2 => {
    const a = (i / n) * Math.PI * 2;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
}

// ------------------------------------------------------------------ 道筋

/** 道筋の部品: 直線・螺旋 */
export type PathSeg =
  | { kind: 'line'; to: P3 }
  | {
      kind: 'helix';
      /** 中心（x, z） */
      c: [number, number];
      r: number;
      /** 回る角度（ラジアン。正 = 上から見て反時計回り（+x → -z）） */
      turn: number;
      /** 終わりの高さ */
      y1: number;
    };

/**
 * 始点と部品の列から点の列を作る（step m おき）。螺旋の始まりの角度は、今の点の中心からの向き。
 * bank: 螺旋の中では中心の側へ傾ける（樋の外側が上がる）
 */
export function buildPath(start: P3, segs: PathSeg[], step = 0.25, bankHelix = 0.35): SweepPath {
  const pts: THREE.Vector3[] = [new THREE.Vector3(...start)];
  const bank: number[] = [0];
  let cur = new THREE.Vector3(...start);
  for (const sg of segs) {
    if (sg.kind === 'line') {
      const to = new THREE.Vector3(...sg.to);
      const len = cur.distanceTo(to);
      const k = Math.max(1, Math.ceil(len / step));
      for (let i = 1; i <= k; i++) {
        pts.push(cur.clone().lerp(to, i / k));
        bank.push(0);
      }
      cur = to;
    } else {
      const a0 = Math.atan2(-(cur.z - sg.c[1]), cur.x - sg.c[0]);
      const y0 = cur.y;
      const len = Math.abs(sg.turn) * sg.r;
      const k = Math.max(2, Math.ceil(len / step));
      for (let i = 1; i <= k; i++) {
        const t = i / k;
        const a = a0 + sg.turn * t;
        pts.push(new THREE.Vector3(sg.c[0] + Math.cos(a) * sg.r, y0 + (sg.y1 - y0) * t, sg.c[1] - Math.sin(a) * sg.r));
        // 回る向きの内側へ傾ける（反時計回りなら中心は -side の側 → 外の +side を上げる = 負の傾き）
        bank.push(-Math.sign(sg.turn) * bankHelix);
      }
      cur = pts[pts.length - 1].clone();
    }
  }
  // 傾きをなめらかに（直線と螺旋の継ぎ目）
  const sm = bank.slice();
  for (let pass = 0; pass < 6; pass++) for (let i = 1; i < sm.length - 1; i++) sm[i] = (sm[i - 1] + sm[i] * 2 + sm[i + 1]) / 4;
  return { pts: smoothPts(pts, 2), bank: sm };
}

/** 点の列の角をならす（端は動かさない） */
export function smoothPts(pts: THREE.Vector3[], passes: number): THREE.Vector3[] {
  let p = pts.map((v) => v.clone());
  for (let k = 0; k < passes; k++) {
    const q = p.map((v) => v.clone());
    for (let i = 1; i < p.length - 1; i++) q[i].copy(p[i - 1]).add(p[i].clone().multiplyScalar(2)).add(p[i + 1]).multiplyScalar(0.25);
    p = q;
  }
  return p;
}

/** 道筋に沿った長さの位置 d の点と接線（継ぎ目の輪・支柱を置く） */
export function sampleAt(path: SweepPath, d: number): { p: THREE.Vector3; t: THREE.Vector3; i: number } {
  let acc = 0;
  for (let i = 1; i < path.pts.length; i++) {
    const l = path.pts[i].distanceTo(path.pts[i - 1]);
    if (acc + l >= d) {
      const t = (d - acc) / Math.max(l, 1e-6);
      return { p: path.pts[i - 1].clone().lerp(path.pts[i], t), t: path.pts[i].clone().sub(path.pts[i - 1]).normalize(), i };
    }
    acc += l;
  }
  const n = path.pts.length;
  return { p: path.pts[n - 1].clone(), t: path.pts[n - 1].clone().sub(path.pts[n - 2]).normalize(), i: n - 1 };
}

export function pathLength(path: SweepPath): number {
  let acc = 0;
  for (let i = 1; i < path.pts.length; i++) acc += path.pts[i].distanceTo(path.pts[i - 1]);
  return acc;
}

/** 閉じた輪郭（x, z の制御点）をなめらかな点の列に（プールの縁）。CatmullRom（centripetal） */
export function closedCurve(ctrl: [number, number][], y: number, n = 160): THREE.Vector3[] {
  const c = new THREE.CatmullRomCurve3(ctrl.map(([x, z]) => new THREE.Vector3(x, y, z)), true, 'centripetal');
  return c.getSpacedPoints(n).slice(0, n);
}

/** 点の列（x, z）の符号付き面積（正 = 上から見て時計回り（x 右・z 手前の図で）） */
export function signedArea(pts: THREE.Vector3[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.z - q.x * p.z;
  }
  return a / 2;
}

/** 制御点を通るなめらかな道筋（CatmullRom・centripetal）。step m おき。傾きは 0 */
export function splinePath(ctrl: P3[], step = 0.25): SweepPath {
  const c = new THREE.CatmullRomCurve3(ctrl.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  const n = Math.max(4, Math.ceil(c.getLength() / step));
  return { pts: c.getSpacedPoints(n) };
}
