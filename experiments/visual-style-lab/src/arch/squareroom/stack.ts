import type { ViewCam } from '../../core/ViewCam.ts';
import { rng } from '../../scenes/Builder.ts';
import type { LBox } from './author.ts';

/**
 * 積み上げた立方体の壁を決まりで作る（写っていない所・視点の画角の外・上の方）。
 * 参考画像の語彙: 幅 3.6〜10.8 m・高さ 3.6〜10.8 m の打ち放しの箱が、面の位置を 0.9〜3.6 m ずつずらして積まれる。
 * 低い所（歩廊の上 4.5 m まで）は前へ出ない（人が通る）。高い所は 1.8〜5.4 m 張り出す（下は暗い）。
 * 箱と箱の間に細い縦の溝（暗い）、所々に小さな窓（奥まった暗い穴・灯りのともる窓）。
 * 局所の座標（水路の目が原点・-z が奥）で、壁の面は x = X。左の壁（L）は +x を向く。
 */
export interface WallSpec {
  side: 'L' | 'R';
  X: number;
  z0: number;
  z1: number;
  yBase: number;
  top: number;
  seed: number;
  /** 手で置いた塊（ここには積まない） */
  avoid?: LBox[];
  /** この視点から見える所には積まない（参考画像の画角の中は手で置いた塊だけにする） */
  hide?: ViewCam[];
  /** 見えても、目からこの距離より遠い塊は積む（霞む奥の壁の情報量。参考画像の奥も箱が積み重なって霞む） */
  hideNear?: number;
  /** 張り出しの最大（m）と、張り出してよい高さ */
  maxOut?: number;
  clearUnder?: number;
  /** 窓の割合 */
  windows?: number;
  /** 塊の奥行き（面から奥へ） */
  depth?: number;
}

export interface WallOut {
  blocks: LBox[];
  /** 小さな窓（奥まった暗い穴）。kind 'lit' は灯りのともる窓 */
  windows: LBox[];
}

const pick = <T>(r: () => number, arr: [T, number][]): T => {
  let t = r() * arr.reduce((s, a) => s + a[1], 0);
  for (const [v, w] of arr) {
    t -= w;
    if (t <= 0) return v;
  }
  return arr[arr.length - 1][0];
};

function overlap(a: LBox, b: LBox, pad = 0.01): boolean {
  for (let i = 0; i < 3; i++) if (a.max[i] <= b.min[i] + pad || a.min[i] >= b.max[i] - pad) return false;
  return true;
}

/** 箱が視点の画角の中に見えるか（8 隅と面の中心のどれかが画面の中） */
export function visibleIn(cam: ViewCam, bx: LBox, margin = 40): boolean {
  const xs = [bx.min[0], bx.max[0]];
  const ys = [bx.min[1], bx.max[1]];
  const zs = [bx.min[2], bx.max[2]];
  const pts: [number, number, number][] = [];
  for (const x of xs) for (const y of ys) for (const z of zs) pts.push([x, y, z]);
  pts.push([(xs[0] + xs[1]) / 2, (ys[0] + ys[1]) / 2, (zs[0] + zs[1]) / 2]);
  let anyFront = false;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    const q = cam.proj(p);
    if (!q) continue;
    anyFront = true;
    minX = Math.min(minX, q[0]);
    maxX = Math.max(maxX, q[0]);
    minY = Math.min(minY, q[1]);
    maxY = Math.max(maxY, q[1]);
  }
  if (!anyFront) return false;
  return maxX > -margin && minX < cam.imgW + margin && maxY > -margin && minY < cam.imgH + margin;
}

export function stackWall(o: WallSpec): WallOut {
  const r = rng(o.seed);
  const s = o.side === 'L' ? 1 : -1; // 水路の向き（+x へ出るのが左の壁）
  const depth = o.depth ?? 9;
  const maxOut = o.maxOut ?? 4.5;
  const clear = o.clearUnder ?? 4.5;
  const blocks: LBox[] = [];
  const windows: LBox[] = [];
  const near = o.hideNear ?? Infinity;
  const dist = (c: ViewCam, bx: LBox): number => {
    let d = 0;
    for (let i = 0; i < 3; i++) d += Math.max(bx.min[i] - c.eye[i], 0, c.eye[i] - bx.max[i]) ** 2;
    return Math.sqrt(d);
  };
  const hidden = (bx: LBox): boolean => (o.hide ?? []).some((c) => visibleIn(c, bx) && dist(c, bx) < near);
  const blocked = (bx: LBox): boolean => (o.avoid ?? []).some((a) => overlap(a, bx));
  // 面の位置 f（水路の向きへの出）から、箱の x 範囲
  const xr = (f: number, d = depth): [number, number] => {
    const face = o.X + s * f;
    const back = o.X - s * d;
    return [Math.min(face, back), Math.max(face, back)];
  };
  let z = o.z0;
  while (z < o.z1 - 0.5) {
    const w = Math.min(pick(r, [[3.6, 3], [5.4, 3], [7.2, 2], [9, 1]]), o.z1 - z);
    const za = z;
    const zb = z + w;
    z = zb;
    // 箱と箱の間の細い溝（奥まる）
    const gap = r() < 0.3 ? 0.4 + r() * 0.8 : 0;
    let y = o.yBase;
    let prevOff = 0;
    while (y < o.top - 0.5) {
      const low = y < clear;
      const h = Math.min(pick(r, low ? [[3.6, 3], [4.5, 2], [5.4, 2], [7.2, 1]] : [[3.6, 2], [5.4, 3], [7.2, 3], [10.8, 2]]), o.top - y + (r() < 0.5 ? 3.6 : 0));
      let off: number;
      if (low) off = pick(r, [[0, 4], [-0.9, 2], [-1.8, 2], [-3.6, 1]]);
      else off = pick(r, [[0, 3], [-0.9, 2], [-1.8, 2], [-3.6, 1], [1.8, 2], [3.6, 1.5], [Math.min(5.4, maxOut), 0.8]]);
      off = Math.min(off, low ? 0 : maxOut);
      // 張り出しが続きすぎない（下の箱より 3.6 m 以上は出さない）
      if (off - prevOff > 3.6) off = prevOff + 3.6;
      const [x0, x1] = xr(off);
      // 箱と箱の継ぎ目は 0.14 m の目地（奥の暗い詰め物が細い影の線に見える）
      const seam = y + h < o.top - 0.5 ? 0.14 : 0;
      const bx: LBox = { min: [x0, y, za + gap / 2], max: [x1, y + h - seam, zb - gap / 2] };
      if (!blocked(bx) && !hidden(bx)) {
        blocks.push(bx);
        // 窓: 面に奥まった暗い穴（幅 0.9〜1.8・高さ 1.2〜2.7）。所々に灯り。同じ窓を 2〜3 つ並べる（住戸の窓の列）。
        // 窓の無い面には、縦の細い溝（排水の溝・目地）か、浅く奥まった面（型枠の割付けの段）を付ける
        const face = o.X + s * off;
        const slab = (d0: number, d1: number): [number, number] => [Math.min(face + s * d0, face - s * d1), Math.max(face + s * d0, face - s * d1)];
        if (r() < (o.windows ?? 0.7) && h >= 3.6 && w >= 3.0) {
          const ww = pick(r, [[0.9, 2], [1.2, 2], [1.8, 1]]);
          const wh = pick(r, [[1.2, 1], [1.8, 2], [2.7, 1]]);
          const n = Math.max(1, Math.min(pick(r, [[1, 2], [2, 2], [3, 1]]), Math.floor((w - 1.2) / (ww + 0.9))));
          const span = n * ww + (n - 1) * 0.9;
          const wz0 = za + 0.6 + r() * Math.max(0.1, w - span - 1.2);
          // 背の高い箱は 3.6 m ごとに窓の列を重ねる（住戸の階）
          const rows = Math.max(1, Math.floor(h / 3.6));
          const lit = r() < 0.35;
          for (let row = 0; row < rows; row++) {
            if (row > 0 && r() < 0.35) continue;
            const wy = y + row * 3.6 + 0.6 + (row === 0 ? r() * Math.max(0.1, Math.min(h, 3.6) - wh - 1.2) : 0.3);
            if (wy + wh > y + h - 0.3) break;
            for (let i = 0; i < n; i++) {
              const wz = wz0 + i * (ww + 0.9);
              const wx = slab(0.03, 0.3);
              windows.push({ min: [wx[0], wy, wz], max: [wx[1], wy + wh, wz + ww], kind: lit && (i === 0 || r() < 0.6) ? 'lit' : 'dark' });
              // 窓台（窓の下の水切り。面から 0.12 m 出る）
              const sx = slab(0.12, 0.2);
              blocks.push({ min: [sx[0], wy - 0.12, wz - 0.1], max: [sx[1], wy, wz + ww + 0.1] });
            }
          }
        } else if (r() < 0.5 && h >= 3.0) {
          // 縦の細い溝（幅 0.12〜0.25 m・箱の高さいっぱい。暗い）
          const gz = za + 0.6 + r() * Math.max(0.1, w - 1.2);
          const gw = 0.12 + r() * 0.13;
          const gx = slab(0.02, 0.15);
          windows.push({ min: [gx[0], y + 0.1, gz], max: [gx[1], y + h - 0.2, gz + gw], kind: 'dark' });
        }
      }
      prevOff = off;
      y += h;
    }
  }
  return { blocks, windows };
}

/**
 * 正面の壁（目の方 +z を向く面。水路の突き当たり）を決まりで積む。stackWall の x と z を入れ替えて使う
 * （面の位置 Z・壁に沿った x の範囲）。避ける箱・隠す視点は局所の座標のまま渡す
 */
export function stackEnd(o: Omit<WallSpec, 'side' | 'X' | 'z0' | 'z1'> & { Z: number; x0: number; x1: number }): WallOut {
  const swap = (b: LBox): LBox => ({ min: [b.min[2], b.min[1], b.min[0]], max: [b.max[2], b.max[1], b.max[0]], kind: b.kind });
  const out = stackWall({
    ...o,
    side: 'L',
    X: o.Z,
    z0: o.x0,
    z1: o.x1,
    avoid: (o.avoid ?? []).map(swap),
    hide: undefined,
  });
  // 隠す視点は入れ替えた後の箱で調べる
  const near = o.hideNear ?? Infinity;
  const keep = (b: LBox): boolean =>
    !(o.hide ?? []).some((c) => {
      if (!visibleIn(c, b)) return false;
      let d = 0;
      for (let i = 0; i < 3; i++) d += Math.max(b.min[i] - c.eye[i], 0, c.eye[i] - b.max[i]) ** 2;
      return Math.sqrt(d) < near;
    });
  return { blocks: out.blocks.map(swap).filter(keep), windows: out.windows.map(swap).filter(keep) };
}
