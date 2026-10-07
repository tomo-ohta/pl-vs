import * as THREE from 'three';
import type { Builder, V3 } from '../../scenes/Builder.ts';
import type { SceneContext } from '../../scenes/types.ts';
import { slab, stairs, wallWithHoles, type WallHole } from '../kit.ts';
import { DOORS, FLOOR2, room, STAIR, T_EXT, WINDOWS } from './layout.ts';
import { Paints, WHITE } from './paint.ts';
import { buildWindow, type RoomStyle } from './shell.ts';

/**
 * 階段室（奥のホールの西）。中壁のある折り返し階段: 1 本目は西の外壁ぎわを北へ上り、北の踊り場（2.45 m）で折り返して
 * 2 本目は南へ上り、2 階の踊り場（4.9 m）の扉（鍵）で行き止まり。2 本目と踊り場の下は物入れ（鍵）。
 * 上り口の東は奥のホールへの口（参考画像の枠の陰）と給湯室・倉庫・医局の扉の前の小さな広間。
 */
export function buildStairHall(b: Builder, ctx: SceneContext, p: Paints, st: RoomStyle, glass: THREE.Material): void {
  const r = room('STAIR');
  const [x0, z0, x1, z1] = r.rect; // -7.2, -21.0, -1.71, -15.4
  const S = STAIR;
  const XW = -4.75; // 吹き抜けの東の壁（給湯室・物入れとの境）の西の面
  const XWE = -4.6;
  const H = S.ceil;
  const wall = st.wall;
  // 段: 踏み面は床と同じ暗い灰青（雪の分布の絵で壁ぎわに白い吹きだまり）、蹴込みは淡い色、段の裏・踊り場の裏は 1 段暗い
  //（階段の下の陰）。踏み面と蹴込みが交互に暗い・明るいの縞になる
  const tread = p.get('stairTread', () => ({
    lamp: 1,
    color: { py: '#7b8e8c', pz: '#b3c1b6', nz: '#b3c1b6', px: '#a7b8b2', nx: '#a7b8b2', ny: '#7d8b86' },
    cov: p.snow,
    // 段は壁ぎわでも床ほど白くしない（吹きだまりの白だけ・量は半分）。踏み面の暗さを残す
    layers: [
      { color: '#a5b5b5', scale: 2.0, threshold: 0.74, stretch: [0.35, 4.0], detail: 0.6, only: 'floor', seed: 1 },
      { color: WHITE, scale: 1.8, threshold: 0.97, cov: 0.45, covChannel: 3, stretch: [0.35, 4.0], detail: 0.6, only: 'floor', seed: 4 },
    ],
  }));
  const nosing = p.solid('#565d60', 0.5);
  const rail = p.solid('#6f8382', 0.6);
  // 腰壁（2 本目の横・2 階の踊り場の縁）と、段に沿った腰壁の塗り（壁の腰壁の色 = 階段室の low）
  const LOW = '#7d9091';
  const lowM = p.wall({ up: LOW, low: LOW, band: 0.5 });
  const dadoM = p.solid('#99afad', 0.55);
  const holesOf = (ids: string[], from: number, dir: 1 | -1): WallHole[] =>
    ids.map((id) => {
      const d = DOORS.find((x) => x.id === id)!;
      return { at: dir * ((d.a + d.b) / 2 - from), width: d.b - d.a, bottom: d.y0, top: d.y1 };
    });
  const winHoles = (pred: (w: (typeof WINDOWS)[number]) => boolean, from: number, dir: 1 | -1): WallHole[] =>
    WINDOWS.filter((w) => w.room === 'STAIR' && pred(w)).map((w) => ({ at: dir * ((w.a + w.b) / 2 - from), width: w.b - w.a, bottom: w.y0, top: w.y1 }));

  // ---- 壁 ----
  // 西の外壁（吹き抜けの高さまで。2 階の窓）
  wallWithHoles(b, wall, [x0 - T_EXT / 2, z0 - T_EXT], [x0 - T_EXT / 2, z1 + 0.15], 0, H, T_EXT, winHoles((w) => w.wall === 'z', z0 - T_EXT, 1), { shadow: false });
  // 北の外壁（階段の側。踊り場の窓）。給湯室の側は給湯室が作る
  wallWithHoles(b, wall, [x0 - T_EXT, z0 - T_EXT / 2], [XW, z0 - T_EXT / 2], 0, H, T_EXT, winHoles((w) => w.wall === 'x' && w.b <= XW, x0 - T_EXT, 1), { shadow: false });
  // 北の外壁の給湯室の上（吹き抜けの北東の隅。縦長の窓）
  wallWithHoles(b, wall, [XW, z0 - T_EXT / 2], [x1 + 0.3, z0 - T_EXT / 2], 2.7, H, T_EXT, winHoles((w) => w.wall === 'x' && w.a >= XW, XW, 1), { shadow: false });
  // 南の壁（医局・倉庫との境の階段の側の半分）: 階段室は 1 つの吹き抜け（上り口の広間も 2 階の天井まで）
  wallWithHoles(b, wall, [x0 - T_EXT, z1 + 0.075], [x1, z1 + 0.075], 0, H, 0.15, holesOf(['W2A', 'up', 'W2B'], x0 - T_EXT, 1), { shadow: false });
  // 東（奥のホールの壁の内張り。口つき）と、奥のホールの壁より上
  const so = DOORS.find((d) => d.id === 'stairOpen')!;
  wallWithHoles(b, wall, [x1 - 0.006, z1], [x1 - 0.006, -18.05], 0, 4.45, 0.012, [{ at: z1 - (so.a + so.b) / 2, width: so.b - so.a, bottom: so.y0, top: so.y1 }], { shadow: false });
  // 内張りの面（x1 - 0.012）にそろえる（ずれると内張りの上の面が細い白い線に見えた）
  b.boxMM(wall, [x1 - 0.012, 4.45, z0 - T_EXT], [x1 + 0.3, H, z1 + 0.15], { shadow: false });
  // 給湯室の上と周り: 給湯室は吹き抜けの北東の隅の低い箱（屋根 2.95 m）。上は吹き抜けのまま、周りに腰壁
  //（広間の側は屋根の上 0.9 m、北の踊り場の側は踊り場から 1.1 m、2 本目の側は段から 0.95 m）。どれも当たり判定つき
  // 腰壁は給湯室の天井の板の縁より 3 mm 外に出す（同じ面に重なると塗りがちらつく）
  b.boxMM(lowM, [XW - 0.003, 2.7, -18.05], [x1, 3.85, -17.897], { shadow: false, collide: true });
  b.boxMM(rail, [XW - 0.003, 3.85, -18.06], [x1, 3.89, -17.887], { shadow: false });
  b.boxMM(lowM, [XW - 0.003, 2.7, z0], [XWE, S.mid + 1.1, S.landing.z1], { shadow: false, collide: true });
  for (let i = 0; i < 14; i++) {
    const za = S.f2.zBottom + i * S.tread;
    const zb = Math.min(za + S.tread, -18.05);
    if (za >= -18.05 - 1e-3) break;
    const top = S.mid + S.riser * (i + 1) + 0.95;
    b.boxMM(lowM, [XW - 0.003, 2.7, za], [XWE, top, zb], { shadow: false, collide: true });
    b.boxMM(rail, [XW - 0.01, top, za], [XWE + 0.01, top + 0.05, zb], { shadow: false });
  }
  // 給湯室の屋根の上の東の面（奥のホールの壁と天井の板の縁が同じ面に重なってちらつくので、階段室の壁で内張りする）
  b.boxMM(wall, [x1 - 0.012, 2.9, z0], [x1, 4.46, -18.05], { shadow: false });
  // 給湯室の屋根の上の面（床と同じ塗り。窓の下に雪が少し吹きだまる）
  b.boxMM(p.floor('#8fa29b'), [XW, 2.95, z0], [x1, 2.962, -18.05], { shadow: false });
  // 2 本目の東の側: 下は物入れの壁、段の横は腰壁（段に沿う）、2 階の踊り場の端も腰壁
  b.boxMM(wall, [XW, 0, -18.05], [XWE, S.mid, S.top.z0], { shadow: false, collide: true });
  for (let i = 0; i < 14; i++) {
    const za = S.f2.zBottom + i * S.tread;
    const zb = za + S.tread;
    if (zb <= -18.05 + 1e-3 || za >= S.top.z0 - 1e-3) continue;
    const top = S.mid + S.riser * (i + 1);
    b.boxMM(lowM, [XW - 0.003, S.mid, Math.max(za, -18.05)], [XWE, top + 0.95, Math.min(zb, S.top.z0)], { shadow: false, collide: true });
    b.boxMM(rail, [XW - 0.01, top + 0.95, Math.max(za, -18.05)], [XWE + 0.01, top + 1.0, Math.min(zb, S.top.z0)], { shadow: false });
  }
  b.boxMM(lowM, [XW, FLOOR2 - 0.2, S.top.z0], [XWE, FLOOR2 + 1.0, z1], { shadow: false, collide: true });
  b.boxMM(rail, [XW - 0.01, FLOOR2 + 1.0, S.top.z0], [XWE + 0.01, FLOOR2 + 1.05, z1], { shadow: false });
  // 中壁（1 本目と 2 本目の間）: 下は物入れの壁（2 本目の下の 2.45 m まで。1 本目の手すりの高さがそれより高い所は段ごとに上げる）、
  // 上は 2 本目の縁の鉄の手すり（縦の桟）。1 本目からは上の 2 本目と手すりが、2 本目からは下の 1 本目が見える吹き抜けにする
  for (let i = 0; i < 13; i++) {
    const zb = S.f1.zBottom - i * S.tread;
    const h = Math.max(S.mid, S.riser * (i + 2) + 0.85);
    b.boxMM(wall, [S.f1.x1, 0, zb - S.tread], [S.f2.x0, h, zb], { shadow: false, collide: true });
    b.boxMM(rail, [S.f1.x1 - 0.005, h, zb - S.tread], [S.f2.x0 + 0.005, h + 0.03, zb], { shadow: false });
  }
  // 物入れ（2 本目と踊り場の下）の南の壁（鍵の扉）
  const cl = DOORS.find((d) => d.id === 'closet')!;
  wallWithHoles(b, wall, [S.f2.x0, cl.line], [XW, cl.line], 0, S.mid, cl.thick, [{ at: (cl.a + cl.b) / 2 - S.f2.x0, width: cl.b - cl.a, bottom: 0, top: cl.y1 }], { shadow: false });

  // ---- 階段 ----
  const w1 = S.f1.x1 - S.f1.x0;
  const w2 = S.f2.x1 - S.f2.x0;
  stairs(b, tread, [(S.f1.x0 + S.f1.x1) / 2, 0, S.f1.zBottom], '-z', S.mid, w1, { riser: S.riser, tread: S.tread, shadow: false });
  stairs(b, tread, [(S.f2.x0 + S.f2.x1) / 2, S.mid, S.f2.zBottom], '+z', FLOOR2 - S.mid, w2, { riser: S.riser, tread: S.tread, shadow: false });
  const n = Math.round(S.mid / S.riser);
  // 段鼻（各段の手前の縁の暗い帯）
  for (let i = 0; i < n - 1; i++) {
    const y1 = S.riser * (i + 1);
    const z = S.f1.zBottom - i * S.tread;
    // 段鼻は蹴込みの面より 4 mm 出す（面が重なるとちらつく）
    b.boxMM(nosing, [S.f1.x0 + 0.02, y1 - 0.03, z - 0.04], [S.f1.x1 - 0.02, y1 + 0.004, z + 0.004], { shadow: false });
    const y2 = S.mid + S.riser * (i + 1);
    const z2 = S.f2.zBottom + i * S.tread;
    b.boxMM(nosing, [S.f2.x0 + 0.02, y2 - 0.03, z2 - 0.004], [S.f2.x1 - 0.02, y2 + 0.004, z2 + 0.04], { shadow: false });
  }
  // 踊り場（北）: 1 本目の側は下まで詰める、2 本目の側は下が物入れ
  slab(b, tread, [S.f1.x0, S.landing.z0, XW, S.landing.z1], S.mid, 0.2);
  b.boxMM(wall, [S.f1.x0, 0, S.landing.z0], [S.f1.x1, S.mid - 0.2, S.landing.z1 - 0.25], { shadow: false });
  // 2 階の踊り場（南）
  slab(b, tread, [x0, S.top.z0, XW, z1], FLOOR2, 0.2);
  // 吹き抜けの天井（上り口の広間まで）
  slab(b, st.ceil, [x0 - T_EXT, z0 - T_EXT, x1 + 0.3, z1 + 0.15], H + 0.25, 0.25, { shadow: false });

  // ---- 手すり（壁の手すり。段に沿って斜め） ----
  const ang = Math.atan2(S.riser, S.tread);
  const len = (n * S.tread) / Math.cos(ang);
  const rz1 = S.f1.zBottom - (n * S.tread) / 2;
  const ry1 = S.mid / 2 + 0.85;
  b.box(rail, [S.f1.x0 + 0.06, ry1, rz1], [0.05, 0.05, len], { rotX: ang, shadow: false });
  b.box(rail, [S.f1.x1 - 0.06, ry1, rz1], [0.05, 0.05, len], { rotX: ang, shadow: false });
  const rz2 = S.f2.zBottom + (n * S.tread) / 2;
  const ry2 = S.mid + (FLOOR2 - S.mid) / 2 + 0.85;
  b.box(rail, [S.f2.x0 + 0.04, ry2 + 0.05, rz2], [0.05, 0.05, len], { rotX: -ang, shadow: false });
  // 2 本目の西の縁: 縦の桟（踏み面 1 枚に 2 本）と、段の横の暗い帯（ささら）
  const bar = p.solid('#7d9091', 0.5);
  for (let i = 0; i < n; i++) {
    const t = S.mid + S.riser * (i + 1);
    for (const f of [0.25, 0.75]) {
      const z = S.f2.zBottom + (i + f) * S.tread;
      const yTop = S.mid + S.riser + (z - S.f2.zBottom) * (S.riser / S.tread) + 0.88;
      b.boxMM(bar, [S.f2.x0 + 0.03, t, z - 0.01], [S.f2.x0 + 0.05, yTop, z + 0.01], { shadow: false });
    }
  }
  // 当たり判定（手すりの高さの板。2 本目から 1 本目へ落ちない）
  for (let i = 0; i < n; i++) {
    const za = S.f2.zBottom + i * S.tread;
    ctx.colliders.add(new THREE.Vector3(S.f2.x0, S.mid, za), new THREE.Vector3(S.f2.x0 + 0.06, S.mid + S.riser * (i + 1) + 0.9, za + S.tread));
  }
  b.box(rail, [XW - 0.06, ry2, rz2], [0.05, 0.05, len], { rotX: -ang, shadow: false });
  // 踊り場と 2 階の踊り場の手すり（水平）
  b.boxMM(rail, [S.f1.x0 + 0.03, S.mid + 0.83, S.landing.z0 + 0.03], [XW - 0.03, S.mid + 0.88, S.landing.z0 + 0.09], { shadow: false });
  b.boxMM(rail, [S.f1.x0 + 0.03, FLOOR2 + 0.83, S.top.z0 + 0.06], [S.f1.x1, FLOOR2 + 0.88, S.top.z0 + 0.12], { shadow: false });
  // 2 階の踊り場の端（1 本目の上は吹き抜け。腰壁で落ちないように）
  b.boxMM(lowM, [S.f1.x0, FLOOR2, S.top.z0 - 0.12], [S.f1.x1, FLOOR2 + 1.0, S.top.z0], { shadow: false, collide: true });
  b.boxMM(rail, [S.f1.x0, FLOOR2 + 1.0, S.top.z0 - 0.13], [S.f1.x1, FLOOR2 + 1.04, S.top.z0 + 0.01], { shadow: false });

  // ---- 段に沿った腰壁の塗り（1 階の壁の腰壁 1.0 m と同じ高さで始まり、段の線に沿って上がる。踊り場では水平）----
  const k = S.riser / S.tread;
  const top = 0.825; // 段鼻の線からの高さ（上り口で床から 1.0 m）
  // 1 本目（北へ上がる）: 西の外壁の面と中壁の西の面
  const l1 = (z: number): number => S.riser + (S.f1.zBottom - z) * k;
  slopePlate(b, dadoM, 'x', x0, 1, S.f1.zBottom, S.landing.z1, l1(S.f1.zBottom) - 0.3, l1(S.landing.z1) - 0.3, top + 0.3);
  slopePlate(b, dadoM, 'x', S.f1.x1, -1, S.f1.zBottom, S.landing.z1, l1(S.f1.zBottom) - 0.3, l1(S.landing.z1) - 0.3, top + 0.3);
  // 北の踊り場: 西の外壁・北の外壁（窓の下は窓台まで）
  const ly = S.mid + top;
  b.boxMM(dadoM, [x0, S.mid - 0.1, S.landing.z0], [x0 + 0.008, ly, S.landing.z1], { shadow: false });
  const nw = WINDOWS.find((w) => w.room === 'STAIR' && w.wall === 'x')!;
  b.boxMM(dadoM, [x0, S.mid - 0.1, z0], [nw.a - 0.06, ly, z0 + 0.008], { shadow: false });
  b.boxMM(dadoM, [nw.a - 0.06, S.mid - 0.1, z0], [nw.b + 0.06, nw.y0 - 0.06, z0 + 0.008], { shadow: false });
  b.boxMM(dadoM, [nw.b + 0.06, S.mid - 0.1, z0], [XW, ly, z0 + 0.008], { shadow: false });
  // 2 本目（南へ上がる）: 中壁の東の面
  const l2 = (z: number): number => S.mid + S.riser + (z - S.f2.zBottom) * k;
  slopePlate(b, rail, 'x', S.f2.x0, -1, S.f2.zBottom, S.top.z0, l2(S.f2.zBottom) - S.riser - 0.32, l2(S.top.z0) - S.riser - 0.32, 0.3);
  // 2 階の踊り場: 西の外壁・南の壁（鍵の扉の所は空ける）
  const ty = FLOOR2 + top;
  b.boxMM(dadoM, [x0, FLOOR2 - 0.1, S.top.z0], [x0 + 0.008, ty, z1], { shadow: false });
  const up = DOORS.find((d) => d.id === 'up')!;
  b.boxMM(dadoM, [x0, FLOOR2 - 0.1, z1 - 0.008], [up.a - 0.06, ty, z1], { shadow: false });
  b.boxMM(dadoM, [up.b + 0.06, FLOOR2 - 0.1, z1 - 0.008], [XW, ty, z1], { shadow: false });
  // 手すりの受け金物（1.2 m おき）
  for (let i = 0; i < 3; i++) {
    const z = S.f1.zBottom - 0.6 - i * 1.2;
    const y = l1(z) + 0.85;
    b.boxMM(rail, [x0 + 0.008, y - 0.1, z - 0.02], [x0 + 0.06, y - 0.02, z + 0.02], { shadow: false });
    b.boxMM(rail, [S.f1.x1 - 0.06, y - 0.1, z - 0.02], [S.f1.x1 - 0.008, y - 0.02, z + 0.02], { shadow: false });
    const z2 = S.f2.zBottom + 0.6 + i * 1.2;
    const y2 = l2(z2) + 0.85;
    void y2;
  }
  // 2 階の床の縁の帯（床の板と梁が壁に見える所。2 階の踊り場の板と同じ高さ 4.7〜4.9 m）。踊り場の窓の上の縁と揃う
  const bandM = p.solid('#a7b8b2', 0.6);
  const by0 = FLOOR2 - 0.2;
  const by1 = FLOOR2 + 0.02;
  const e = 0.04;
  b.boxMM(bandM, [x0, by0, z0], [x0 + e, by1, S.top.z0], { shadow: false }); // 西の外壁（吹き抜けの側）
  // 北の外壁（踊り場の窓の上の縁と、給湯室の上。縦長の窓の所は空ける）
  const tw = WINDOWS.find((w) => w.room === 'STAIR' && w.wall === 'x' && w.a >= XW)!;
  b.boxMM(bandM, [x0, by0, z0], [tw.a - 0.06, by1, z0 + e], { shadow: false });
  b.boxMM(bandM, [tw.b + 0.06, by0, z0], [x1, by1, z0 + e], { shadow: false });
  b.boxMM(bandM, [x1 - 0.006 - e, by0, z0], [x1 - 0.006, by1, z1], { shadow: false }); // 東（奥のホールとの壁）
  b.boxMM(bandM, [XW, by0, z1 - e], [x1, by1, z1], { shadow: false }); // 南（医局・倉庫との壁。2 階の踊り場より東）
  // 給湯室の外の面（上り口の広間の側）に階段室の壁の内張り（給湯室の塗りと腰壁の高さがずれないように）
  const pd = DOORS.find((d) => d.id === 'pantry')!;
  wallWithHoles(b, wall, [XWE, -17.9 + 0.006], [x1, -17.9 + 0.006], 0, 2.7, 0.012, [{ at: (pd.a + pd.b) / 2 - XWE, width: pd.b - pd.a, bottom: 0, top: pd.y1 }], { shadow: false });

  // ---- 窓 ----
  for (const w of WINDOWS) if (w.room === 'STAIR') buildWindow(b, ctx, p, w, glass);
  void (null as unknown as V3);
}

/**
 * 段に沿った腰壁の塗り（傾いた帯）。x = 一定の壁の面に、z0〜z1 の間で下の縁が y0 → y1 へ上がる高さ h の板。
 * side = 板を出す向き（+1 = +x 側）。箱をずらし変形（shear）して、縦の縁が鉛直のまま傾ける
 */
function slopePlate(b: Builder, m: THREE.Material, _axis: 'x', x: number, side: 1 | -1, z0: number, z1: number, y0: number, y1: number, h: number): void {
  const len = Math.abs(z1 - z0);
  const g = new THREE.BoxGeometry(0.008, h, len);
  const k = (y1 - y0) / (z1 - z0);
  g.applyMatrix4(new THREE.Matrix4().makeShear(0, 0, 0, 0, 0, k));
  b.mesh(g, m, [x + side * 0.004, (y0 + y1) / 2 + h / 2, (z0 + z1) / 2], { shadow: false });
}
