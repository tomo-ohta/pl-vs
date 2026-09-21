/**
 * 家具の専用形状（見た目だけ）。V05 第 2 段。
 *
 * Generator の家具ヘルパ（generators/furniture.ts / CorridorGenerator の bench）が付けた表示用タグ
 * （Box.propGroup = 1 台分のグループ、Box.kind = 種類）を読み、箔の集合を「座面・背・脚」「扉・通気口・取っ手」などの
 * 軸平行な箱の組に描き替える。RoomBuilder は箱しか受け取らないので、傾いた背や円柱の脚はまだ出せない
 * （docs/visual-requests.md の「B → RoomBuilder」参照）。
 *
 * 不変条件:
 *  - 当たり判定は Generator の箱（solid）のまま。ここで出す箱は全て非ソリッド。
 *  - 乱数を使わない（同じレイアウト → 同じ形状）。レイアウトの箱は書き換えない（skip に入れて描かないだけ）。
 *  - 置き換えたグループの元の箔は残さない（重ね描きしない）。グループが欠けていたら（Modifier が本体を捨てた等）元の箔をそのまま描く。
 *  - 三角形は 1 台 400 以下（箱 1 個 = 12、面取り材質で最小辺 8 cm 超の箱 = 108）。
 */
import type { Vec3 } from '../../core/types';
import { box, type Box, type MatId } from '../../generators/layout';

type V2 = readonly [number, number];
const size = (b: Box, k: number): number => b.max[k] - b.min[k];
const mid = (b: Box, k: number): number => (b.min[k] + b.max[k]) / 2;
const nb = (min: Vec3, max: Vec3, mat: MatId): Box => box(min, max, mat, false);

function envelope(bs: Box[]): Box {
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const b of bs) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], b.min[k]); max[k] = Math.max(max[k], b.max[k]); }
  return { min, max, mat: bs[0].mat, solid: false };
}

/** 局所座標 (u: 向き f の前方, v: 右手) から軸平行の箱を作る。f は軸平行の単位ベクトル */
function frame(cx: number, cz: number, f: V2) {
  const r: V2 = [-f[1], f[0]];
  return (u0: number, u1: number, v0: number, v1: number, y0: number, y1: number, mat: MatId): Box =>
    nb([cx + u0 * f[0] + v0 * r[0], y0, cz + u0 * f[1] + v0 * r[1]], [cx + u1 * f[0] + v1 * r[0], y1, cz + u1 * f[1] + v1 * r[1]], mat);
}

/**
 * 前面 F（軸 k の座標、sign 側が外）を基準に、辺に沿った範囲 [a0, a1]・前面からの出 [d0, d1]（正 = 外へ）・高さ [y0, y1] の箱を作る
 */
export function facePlanes(k: 0 | 2, sign: 1 | -1, F: number) {
  const a = k === 0 ? 2 : 0;
  return (a0: number, a1: number, d0: number, d1: number, y0: number, y1: number, mat: MatId): Box => {
    const min: Vec3 = [0, y0, 0], max: Vec3 = [0, y1, 0];
    min[a] = a0; max[a] = a1; min[k] = F + sign * d0; max[k] = F + sign * d1;
    return nb(min, max, mat);
  };
}

/** 座（seat）から見て背（back）が有る側の反対 = 座った人の向き。軸に丸める */
function facingFrom(seat: Box, back: Box): V2 | null {
  const dx = mid(back, 0) - mid(seat, 0), dz = mid(back, 2) - mid(seat, 2);
  if (Math.max(Math.abs(dx), Math.abs(dz)) < 1e-3) return null;
  return Math.abs(dx) > Math.abs(dz) ? [dx > 0 ? -1 : 1, 0] : [0, dz > 0 ? -1 : 1];
}

// ---------------------------------------------------------------- 椅子

/**
 * 椅子: 薄い座面（合板の厚み）+ 側の座枠 2 本 + 鋼管の脚 4 本（後脚は背の支柱まで通す）+ 支柱の前面に付く背板。
 * W = 座の幅（向きと直交）、D = 座の奥行き。8 箱 = 96 三角形（前後の座枠は座面の陰で読めず、C09 の 435 脚で部屋合計が 1.3 倍を超えたので省いた）
 */
function chairShape(out: Box[], cx: number, cz: number, f: V2, W: number, D: number, seatY: number, backY: number, floorY: number, seatMat: MatId, frameMat: MatId): void {
  const P = frame(cx, cz, f);
  const leg = 0.022, inset = 0.05, panT = 0.035;
  const uF = D / 2 - inset - leg / 2, uR = -uF;
  const vs = W / 2 - inset - leg / 2;
  for (const s of [-1, 1]) {
    out.push(P(uF - leg / 2, uF + leg / 2, s * vs - leg / 2, s * vs + leg / 2, floorY, seatY - panT, frameMat));
    out.push(P(uR - leg / 2, uR + leg / 2, s * vs - leg / 2, s * vs + leg / 2, floorY, backY - 0.015, frameMat));
  }
  out.push(P(-D / 2, D / 2, -W / 2, W / 2, seatY - panT, seatY, seatMat));
  const railY0 = seatY - panT - 0.025, railY1 = seatY - panT;
  for (const s of [-1, 1]) out.push(P(uR, uF, s * vs - 0.008, s * vs + 0.008, railY0, railY1, frameMat));
  const slabH = Math.min(0.22, (backY - seatY) * 0.55);
  out.push(P(uR + leg / 2, uR + leg / 2 + 0.03, -W / 2 + 0.01, W / 2 - 0.01, backY - 0.02 - slabH, backY - 0.02, seatMat));
}

/** furniture.chair のグループ（座 kind 'chair' + 背 + 脚 4 本） */
function chairGroup(members: Box[], out: Box[]): boolean {
  const seat = members.find((m) => m.kind === 'chair');
  if (!seat) return false;
  const back = members.find((m) => m !== seat && m.mat === seat.mat && m.max[1] > seat.max[1] + 0.1);
  if (!back) return false;
  const f = facingFrom(seat, back);
  if (!f) return false;
  const env = envelope(members);
  const W = f[0] !== 0 ? size(seat, 2) : size(seat, 0);
  const D = f[0] !== 0 ? size(seat, 0) : size(seat, 2);
  chairShape(out, mid(seat, 0), mid(seat, 2), f, W, D, seat.max[1], back.max[1], env.min[1], seat.mat, 'metalDark');
  return true;
}

/** 1 箱の椅子（common.furnishCafeteriaProps の kind 'chair'、0.6 × 0.9 × 0.6）: 最寄りの机へ向ける。無ければ部屋の中心 */
function singleChair(b: Box, tables: Box[], center: V2, out: Box[]): void {
  const cx = mid(b, 0), cz = mid(b, 2);
  let f: V2 | null = null;
  let best = 1.3;
  for (const t of tables) {
    const tx = Math.max(t.min[0], Math.min(t.max[0], cx)), tz = Math.max(t.min[2], Math.min(t.max[2], cz));
    const d = Math.hypot(tx - cx, tz - cz);
    if (d < best) { best = d; f = Math.abs(tx - cx) > Math.abs(tz - cz) ? [tx > cx ? 1 : -1, 0] : [0, tz > cz ? 1 : -1]; }
  }
  if (!f) { const dx = center[0] - cx, dz = center[1] - cz; f = Math.abs(dx) > Math.abs(dz) ? [dx > 0 ? 1 : -1, 0] : [0, dz > 0 ? 1 : -1]; }
  const w = size(b, 0), d = size(b, 2), h = size(b, 1);
  const W = (f[0] !== 0 ? d : w) * 0.8, D = (f[0] !== 0 ? w : d) * 0.8;
  const seatY = b.min[1] + Math.min(0.45, h * 0.5);
  chairShape(out, cx, cz, f, W, D, seatY, b.max[1], b.min[1], b.mat, 'metalDark');
}

// ---------------------------------------------------------------- 連結椅子（待合）

/**
 * 連結椅子: 座の直下を通る 1 本の梁 + 両端の板脚 + 席ごとに分かれた座（隙間 3 cm）と背のパッド + 背の支柱。
 * L = 列の長さ、D = 奥行き、n = 席数。4 席で 15 箱 = 180 三角形
 * （座の受け金具と足元の板は C10 の 120 列で部屋合計が 1.4 倍になったので省いた。梁を座に接触させて隙間を消している）
 */
function seatsShape(out: Box[], cx: number, cz: number, f: V2, L: number, D: number, n: number, seatTop: number, backTop: number, floorY: number, seatMat: MatId, frameMat: MatId): void {
  const P = frame(cx, cz, f);
  const pitch = L / n, panT = 0.05;
  out.push(P(-0.03, 0.03, -L / 2 + 0.05, L / 2 - 0.05, seatTop - panT - 0.05, seatTop - panT, frameMat));
  for (const s of [-1, 1]) {
    const v = s * (L / 2 - 0.14);
    out.push(P(-D / 2 + 0.04, D / 2 - 0.04, v - 0.02, v + 0.02, floorY, seatTop - panT - 0.05, frameMat));
  }
  const padH = Math.min(0.3, (backTop - seatTop) * 0.75);
  for (let k = 0; k < n; k++) {
    const vc = -L / 2 + pitch * (k + 0.5), v0 = vc - pitch / 2 + 0.015, v1 = vc + pitch / 2 - 0.015;
    out.push(P(-D / 2 + 0.06, D / 2, v0, v1, seatTop - panT, seatTop, seatMat));
    out.push(P(-D / 2, -D / 2 + 0.05, v0, v1, backTop - padH, backTop, seatMat));
    out.push(P(-D / 2 + 0.01, -D / 2 + 0.05, vc - 0.02, vc + 0.02, seatTop - 0.02, backTop - padH + 0.01, frameMat));
  }
}

/** furniture.linkedSeats（座 n 枚 + 背 n 枚 + 梁 + 脚 2）と CorridorGenerator.bench（座板 + 背板 + 脚板）の両方を受ける */
function seatsGroup(members: Box[], out: Box[]): boolean {
  const seatMat = members.find((m) => m.mat !== 'metalDark' && m.mat !== 'metal')?.mat;
  if (!seatMat) return false;
  const pans = members.filter((m) => m.mat === seatMat && size(m, 1) <= 0.12);
  const backs = members.filter((m) => m.mat === seatMat && size(m, 1) > 0.12);
  if (!pans.length || !backs.length) return false;
  const env = envelope(members);
  const rowAxis = size(env, 0) >= size(env, 2) ? 0 : 2;
  const f = facingFrom(envelope(pans), envelope(backs));
  if (!f || (rowAxis === 0 ? f[0] !== 0 : f[1] !== 0)) return false;
  const L = size(env, rowAxis), D = size(env, rowAxis === 0 ? 2 : 0);
  const n = Math.max(1, Math.round(L / 0.5));
  const seatTop = Math.max(...pans.map((m) => m.max[1])), backTop = Math.max(...backs.map((m) => m.max[1]));
  seatsShape(out, mid(env, 0), mid(env, 2), f, L, D, n, seatTop, backTop, env.min[1], seatMat, 'metalDark');
  return true;
}

// ---------------------------------------------------------------- 木のベンチ（更衣室）

/** furniture.bench: 天板 1 枚 → 板 3 枚（隙間 2 cm）、脚 → 鋼管の支柱 2 本（板の裏まで）+ 長手の貫。1.8 m（脚 3 組）で 10 箱 = 120 三角形 */
function benchGroup(members: Box[], out: Box[]): boolean {
  const top = members.find((m) => m.kind === 'bench');
  if (!top) return false;
  const legs = members.filter((m) => m !== top);
  if (!legs.length) return false;
  const rowAxis = size(top, 0) >= size(top, 2) ? 0 : 2;
  const f: V2 = rowAxis === 0 ? [1, 0] : [0, 1];
  const P = frame(mid(top, 0), mid(top, 2), f);
  const L = size(top, rowAxis), Wd = size(top, rowAxis === 0 ? 2 : 0), floorY = envelope(members).min[1];
  const slatW = (Wd - 0.04) / 3;
  for (let i = 0; i < 3; i++) {
    const v0 = -Wd / 2 + i * (slatW + 0.02);
    out.push(P(-L / 2, L / 2, v0, v0 + slatW, top.max[1] - 0.04, top.max[1], top.mat));
  }
  const us = legs.map((m) => mid(m, rowAxis) - mid(top, rowAxis)).sort((p, q) => p - q);
  const post = 0.025, vp = Wd / 2 - 0.04;
  for (const uc of us) for (const s of [-1, 1]) out.push(P(uc - post / 2, uc + post / 2, s * vp - post / 2, s * vp + post / 2, floorY, top.max[1] - 0.04, 'metalDark'));
  if (us.length >= 2) out.push(P(us[0], us[us.length - 1], -0.015, 0.015, floorY + 0.12, floorY + 0.15, 'metalDark'));
  return true;
}

// ---------------------------------------------------------------- ロッカー列

/**
 * furniture.lockerBank: 本体 1 箱（kind 'lockers'）+ 前面の薄箔（溝・通気口・取っ手）。前面は薄箔が本体からはみ出す側。
 * 描き替え: 前面を 1.2 cm 引いた本体 + 目地の底（暗い前板）+ 台輪 + 天端 + 扉ごとの独立したパネル（目地 1.4 cm が実際の凹み）
 * + 通気口 2 本 × 上下 + 取っ手（座板 + 縦のつまみ）。扉 1 枚 7 箱 = 84 三角形、列あたり + 4 箱
 * （通気口 3 本 × 上下では C11 の約 480 扉で部屋合計が 1.44 倍になったので 2 本 × 上下に減らした）
 */
function lockerGroup(members: Box[], out: Box[]): boolean {
  const body = members.find((m) => m.kind === 'lockers');
  if (!body) return false;
  let k: 0 | 2 | null = null, sign: 1 | -1 = 1;
  for (const m of members) {
    if (m === body) continue;
    for (const ax of [0, 2] as const) {
      if (m.max[ax] > body.max[ax] + 1e-4) { k = ax; sign = 1; break; }
      if (m.min[ax] < body.min[ax] - 1e-4) { k = ax; sign = -1; break; }
    }
    if (k !== null) break;
  }
  if (k === null) return false;
  const a = k === 0 ? 2 : 0;
  const F = sign > 0 ? body.max[k] : body.min[k];
  const S = facePlanes(k, sign, F);
  const A0 = body.min[a], A1 = body.max[a], W = A1 - A0, Dp = size(body, k), y0 = body.min[1], H = body.max[1];
  const n = Math.max(1, Math.round(W / 0.4)), doorW = W / n;
  out.push(S(A0, A1, -Dp, -0.012, y0, H, body.mat));
  out.push(S(A0, A1, -0.012, -0.008, y0 + 0.08, H - 0.03, 'metalDark'));
  out.push(S(A0, A1, -0.012, 0.004, y0, y0 + 0.08, 'metalDark'));
  out.push(S(A0, A1, -Dp, 0.002, H - 0.03, H, body.mat));
  const hy = Math.min(H - 0.3, y0 + 0.98);
  for (let i = 0; i < n; i++) {
    const d0 = A0 + i * doorW, d1 = d0 + doorW, c = (d0 + d1) / 2;
    out.push(S(d0 + 0.007, d1 - 0.007, -0.008, 0.002, y0 + 0.09, H - 0.04, body.mat));
    for (const y of [y0 + 0.3, y0 + 0.37, H - 0.42, H - 0.35]) out.push(S(c - 0.09, c + 0.09, -0.003, 0.003, y, y + 0.024, 'metalDark'));
    const hc = c + Math.min(0.11, doorW * 0.28);
    out.push(S(hc - 0.022, hc + 0.022, 0.002, 0.006, hy - 0.03, hy + 0.15, 'metal'));
    out.push(S(hc - 0.008, hc + 0.008, 0.006, 0.022, hy - 0.005, hy + 0.115, 'metalDark'));
  }
  return true;
}

// ---------------------------------------------------------------- 自販機（1 箱の kind 'vending'）

/** RoomGenerator SmallRoom / U04 の 1 箱の自販機: 部屋の中心を向く面に商品窓（暗い艶ガラス）・取り出し口・コイン投入部。前面に発光箔が付いていれば窓は省く */
function singleVending(b: Box, boxes: Box[], center: V2, out: Box[]): void {
  const dx = center[0] - mid(b, 0), dz = center[1] - mid(b, 2);
  const k: 0 | 2 = Math.abs(dx) >= Math.abs(dz) ? 0 : 2;
  const sign: 1 | -1 = (k === 0 ? dx : dz) >= 0 ? 1 : -1;
  const a = k === 0 ? 2 : 0;
  const F = sign > 0 ? b.max[k] : b.min[k];
  const S = facePlanes(k, sign, F);
  const c = mid(b, a), W = size(b, a), y0 = b.min[1], H = b.max[1];
  const hasGlow = boxes.some((o) => o !== b && /^light/.test(o.mat) && Math.abs((sign > 0 ? o.min[k] : o.max[k]) - F) < 0.03 && o.min[1] < H && o.max[1] > y0 && o.min[a] < b.max[a] && o.max[a] > b.min[a]);
  if (!hasGlow) {
    out.push(S(c - W / 2 + 0.08, c + W / 2 - 0.08, 0, 0.012, y0 + 0.8, H - 0.15, 'carGlass'));
    out.push(S(c + W / 2 - 0.2, c + W / 2 - 0.09, 0, 0.015, y0 + 1.0, y0 + 1.35, 'metal'));
  }
  out.push(S(c - 0.25, c + 0.25, 0, 0.01, y0 + 0.18, y0 + 0.42, 'metalDark'));
}

// ---------------------------------------------------------------- 机上のモニター（LCD / CRT）

/**
 * 机の上の薄い画面箔（screenDark / screenLcd。厚 6 cm 以下、幅 0.25〜0.8、高 0.15〜0.6、机の天板の上）に枡（ベゼル）を付ける。
 * 画面の背に furniture* の筐体箔（高 0.25〜0.5）が接していれば CRT: 筐体を段付き（前枡 → 胴 → 後部）に描き替える。無ければ薄い背面カバー（LCD）。
 * 正面は「机の中心線から外側」（座る側）。壁のパネルは机が無いので対象外
 */
function monitors(boxes: Box[], out: Box[], skip: Set<Box>): void {
  const supports = boxes.filter((b) => b.min[1] < 0.05 && size(b, 1) > 0.6 && size(b, 1) < 0.95 && (/^furniture/.test(b.mat) || b.kind === 'desk' || b.kind === 'table') && Math.max(size(b, 0), size(b, 2)) > 0.8);
  if (!supports.length) return;
  const housings = boxes.filter((b) => !b.solid && /^furniture/.test(b.mat) && size(b, 1) >= 0.25 && size(b, 1) <= 0.5 && b.min[1] > 0.6);
  for (const b of boxes) {
    if (b.solid || (b.mat !== 'screenDark' && b.mat !== 'screenLcd')) continue;
    const k: 0 | 2 = size(b, 0) < size(b, 2) ? 0 : 2, a = k === 0 ? 2 : 0;
    const t = size(b, k), w = size(b, a), h = size(b, 1);
    if (t > 0.06 || w < 0.25 || w > 0.8 || h < 0.15 || h > 0.6 || b.min[1] < 0.6 || b.min[1] > 2) continue;
    const cx = mid(b, 0), cz = mid(b, 2);
    const sup = supports.find((s) => cx > s.min[0] && cx < s.max[0] && cz > s.min[2] && cz < s.max[2] && s.max[1] > b.min[1] - 0.3 && s.max[1] < b.min[1] + 0.01);
    if (!sup) continue;
    const dir = mid(b, k) - mid(sup, k);
    if (Math.abs(dir) < 1e-3) continue;
    const sign: 1 | -1 = dir > 0 ? 1 : -1;
    const F = sign > 0 ? b.max[k] : b.min[k], Bk = sign > 0 ? b.min[k] : b.max[k];
    const S = facePlanes(k, sign, F);
    const bz = 0.012;
    out.push(S(b.min[a] - bz, b.max[a] + bz, -t - 0.003, 0.003, b.min[1] - bz, b.min[1], 'metalDark'));
    out.push(S(b.min[a] - bz, b.max[a] + bz, -t - 0.003, 0.003, b.max[1], b.max[1] + bz, 'metalDark'));
    out.push(S(b.min[a] - bz, b.min[a], -t - 0.003, 0.003, b.min[1], b.max[1], 'metalDark'));
    out.push(S(b.max[a], b.max[a] + bz, -t - 0.003, 0.003, b.min[1], b.max[1], 'metalDark'));
    const body = housings.find((m) => m !== b && Math.abs((sign > 0 ? m.max[k] : m.min[k]) - Bk) < 0.02 && m.min[a] < b.min[a] + 0.01 && m.max[a] > b.max[a] - 0.01 && m.min[1] < b.min[1] + 0.01 && m.max[1] > b.max[1] - 0.01);
    if (body) {
      skip.add(body);
      const depth = size(body, k), ca = mid(body, a), W = size(body, a), H = size(body, 1), y0 = body.min[1];
      const Sb = facePlanes(k, sign, sign > 0 ? body.max[k] : body.min[k]);
      const d1 = Math.min(depth, 0.07), d2 = Math.min(depth, d1 + 0.13);
      out.push(Sb(ca - W / 2, ca + W / 2, -d1, 0, y0, y0 + H, body.mat));
      if (d2 > d1 + 0.01) out.push(Sb(ca - W * 0.46, ca + W * 0.46, -d2, -d1, y0 + H * 0.06, y0 + H * 0.96, body.mat));
      if (depth > d2 + 0.02) out.push(Sb(ca - W * 0.4, ca + W * 0.4, -depth, -d2, y0 + H * 0.1, y0 + H * 0.9, body.mat));
    } else {
      out.push(S(b.min[a] + 0.02, b.max[a] - 0.02, -t - 0.028, -t - 0.003, b.min[1] + 0.02, b.max[1] - 0.02, 'metalDark'));
    }
  }
}

// ---------------------------------------------------------------- 入口

/**
 * タグ付きの家具を専用形状に描き替える。out に表示用の箱を足し、置き換えた元の箱を skip に入れる（呼び出し側は skip の箱を描かない）。
 * center は部屋の中心（x, z）。向きが読めない 1 箱家具の向きに使う
 */
export function furnitureDetails(boxes: Box[], center: V2, out: Box[], skip: Set<Box>): void {
  const groups = new Map<string, Box[]>();
  for (const b of boxes) if (b.propGroup) { const list = groups.get(b.propGroup) ?? []; list.push(b); groups.set(b.propGroup, list); }
  for (const members of groups.values()) {
    const kind = members.find((m) => m.kind)?.kind;
    let ok = false;
    switch (kind) {
      case 'chair': ok = chairGroup(members, out); break;
      case 'linkedSeats': ok = seatsGroup(members, out); break;
      case 'bench': ok = benchGroup(members, out); break;
      case 'lockers': ok = lockerGroup(members, out); break;
      default: break; // vending / decorDoor / plant（鉢は RoomBuilder が扱う）: タグのみ。元の箔をそのまま描く
    }
    if (ok) for (const m of members) skip.add(m);
  }
  const tables = boxes.filter((b) => b.kind === 'table' || b.kind === 'desk');
  for (const b of boxes) {
    if (b.propGroup || !b.solid) continue;
    if (b.kind === 'chair') { singleChair(b, tables, center, out); skip.add(b); }
    else if (b.kind === 'vending') singleVending(b, boxes, center, out);
  }
  monitors(boxes, out, skip);
}
