/**
 * 参考画像の視点の画角（真上から見た扇形）。建築版で足す小物・遠景は、この中に置かない（plan.ts の notes の決まり。
 * 上屋の下から見ると霧の中の物も暗い影に見えるので、遠くでも置かない）。
 * 目の位置・向き（前の向き）・横の半分の画角の tan（縦の画角 × 16:9 から求めた値）。
 */
interface Cone {
  x: number;
  z: number;
  fx: number;
  fz: number;
  k: number;
}

const CONES: Cone[] = [
  // station-0: D の上屋の下から南
  { x: -62, z: 29.3, fx: 0, fz: 1, k: 0.44 },
  // station-1: 大屋根の下から北
  { x: 0, z: 0, fx: 0, fz: -1, k: 0.9 },
  // station-2: 旧踏切道の行き止まりから東
  { x: -23.7, z: 51.4, fx: 1, fz: 0, k: 0.52 },
  // station-3: 中央柱の上屋から南
  { x: 0, z: 12, fx: 0, fz: 1, k: 0.52 },
];

/**
 * 点 (x, z)（半径 r の物）が、どれかの視点の画角に入るか。
 * margin = 画角の縁の外側の余裕（m）。目より後ろは入らない
 */
export function seen(x: number, z: number, r = 0.5, margin = 1.5): boolean {
  for (const c of CONES) {
    const dx = x - c.x;
    const dz = z - c.z;
    const fwd = dx * c.fx + dz * c.fz;
    if (fwd < -r) continue;
    const side = Math.abs(dx * -c.fz + dz * c.fx);
    if (side - r - margin < Math.max(fwd, 0) * c.k) return true;
  }
  return false;
}

/** 線分 a → b のどこかが画角に入るか（step m おきに調べる） */
export function seenSeg(ax: number, az: number, bx: number, bz: number, r = 0.5, margin = 1.5, step = 2): boolean {
  const len = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.ceil(len / step));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (seen(ax + (bx - ax) * t, az + (bz - az) * t, r, margin)) return true;
  }
  return false;
}
