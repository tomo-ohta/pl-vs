import { rng, type Builder, type V3 } from '../../scenes/Builder.ts';
import type { SceneContext } from '../../scenes/types.ts';
import { DOORS, FLOOR2, room, ROOMS, STAIR, WINDOWS, type Rect, type RoomDef, type Side } from './layout.ts';
import type { Paints } from './paint.ts';
import * as P from './props.ts';
import { C, Fr, Posters } from './props.ts';
import { LINING, sideSpecs } from './shell.ts';
import { pastelPlan } from './plan.ts';
import { pilasterRects, structOf } from './trim.ts';

/**
 * 部屋の種類ごとの「置く物の決まり」（淡色の廊下の建築版）。どの部屋も参考画像と同じ描き方（面ごとの平らな色・線なし）で、
 * 色は参考画像の色の表（props.ts の C）から。物は壁ぞいの空いた所へ順に置き（Placer）、扉の前・窓口の前は空け、
 * 窓の前には窓台より低い物だけを置く。天井には参考画像と同じ小さな白い灯り。
 */

type Run = { side: Side; a: number; b: number; y0: number; y1?: number };

/** 壁ぞいに物を置く道具（場面の座標。扉の前を空け、もう置いた物を避ける） */
class Placer {
  readonly used: Rect[] = [];
  readonly wins: Run[] = [];
  readonly hung: Run[] = [];
  /** 床から天井までふさがっている所（柱型） */
  readonly full: Run[] = [];
  /** 柱型の足元（中の見える棚だけが避ける） */
  readonly pils: Rect[] = [];
  constructor(
    readonly r: RoomDef,
    readonly b: Builder,
    readonly p: Paints,
  ) {
    const [x0, z0, x1, z1] = r.rect;
    for (const d of DOORS) {
      if (!d.rooms.includes(r.id)) continue;
      const side = sideOf(r, d.wall, d.line);
      if (!side) continue;
      const depth = d.kind === 'pass' ? 0.75 : Math.max(1.15, d.b - d.a + 0.15);
      const a = d.a - 0.12;
      const c = d.b + 0.12;
      const rect: Rect =
        side === 'n' ? [a, z0, c, z0 + depth] : side === 's' ? [a, z1 - depth, c, z1] : side === 'w' ? [x0, a, x0 + depth, c] : [x1 - depth, a, x1, c];
      this.used.push(rect);
      if (d.kind !== 'pass') this.hung.push({ side, a: d.a - 0.15, b: d.b + 0.15, y0: 0 });
      else this.hung.push({ side, a: d.a - 0.1, b: d.b + 0.1, y0: d.y0 });
    }
    for (const w of WINDOWS) {
      if (w.room !== r.id) continue;
      const side = sideOf(r, w.wall, w.line);
      if (side) this.wins.push({ side, a: w.a - 0.05, b: w.b + 0.05, y0: w.y0 });
    }
    // 待合の北の壁のうち参考画像に写る所（x -3.25〜2.88）には何も掛けない
    if (r.id === 'LOBBY') this.full.push({ side: 'n', a: -3.6, b: 3.4, y0: 0 });
    // 柱型: 背のある家具は柱型の前に置いてよい（柱型は家具の中に隠れ、上だけ見える。家具の置き方を元のままにする）。
    // 中の見える棚（open）と壁に掛ける物は柱型を避ける
    for (const q of pilasterRects(r)) {
      this.pils.push(q);
      for (const s of ['n', 's', 'w', 'e'] as Side[]) {
        const touch = s === 'n' ? q[1] <= z0 + 0.05 : s === 's' ? q[3] >= z1 - 0.05 : s === 'w' ? q[0] <= x0 + 0.05 : q[2] >= x1 - 0.05;
        if (touch) this.full.push({ side: s, a: s === 'n' || s === 's' ? q[0] : q[1], b: s === 'n' || s === 's' ? q[2] : q[3], y0: 0 });
      }
    }
  }
  private hits(q: Rect, list: Rect[] = this.used): boolean {
    return list.some((u) => q[2] > u[0] + 1e-3 && q[0] < u[2] - 1e-3 && q[3] > u[1] + 1e-3 && q[1] < u[3] - 1e-3);
  }
  block(q: Rect): void {
    this.used.push(q);
  }
  frame(side: Side, u: number, w: number, dp: number): { x: number; z: number; yaw: number; q: Rect } {
    const [x0, z0, x1, z1] = this.r.rect;
    const m = 0.02;
    if (side === 'n') return { x: u, z: z0 + m + dp / 2, yaw: 0, q: [u - w / 2, z0, u + w / 2, z0 + m + dp] };
    if (side === 's') return { x: u, z: z1 - m - dp / 2, yaw: Math.PI, q: [u - w / 2, z1 - m - dp, u + w / 2, z1] };
    if (side === 'w') return { x: x0 + m + dp / 2, z: u, yaw: Math.PI / 2, q: [x0, u - w / 2, x0 + m + dp, u + w / 2] };
    return { x: x1 - m - dp / 2, z: u, yaw: -Math.PI / 2, q: [x1 - m - dp, u - w / 2, x1, u + w / 2] };
  }
  /** 壁ぞい（背を壁に）。h は高さ（窓の前に置けるか） */
  wall(side: Side, w: number, dp: number, h: number, o: { start?: number; reverse?: boolean; gap?: number; open?: boolean } = {}): Fr | null {
    const [x0, z0, x1, z1] = this.r.rect;
    const lo = side === 'n' || side === 's' ? x0 : z0;
    const hi = side === 'n' || side === 's' ? x1 : z1;
    const L = hi - lo;
    const gap = o.gap ?? 0.05;
    for (let t = (o.start ?? 0) * L; t + w <= L + 1e-6; t += 0.05) {
      const u = o.reverse ? hi - t - w / 2 : lo + t + w / 2;
      const fr = this.frame(side, u, w, dp);
      const g: Rect = [fr.q[0] - gap, fr.q[1] - gap, fr.q[2] + gap, fr.q[3] + gap];
      if (this.hits(g)) continue;
      if (o.open && this.hits(fr.q, this.pils)) continue;
      if (this.wins.some((k) => k.side === side && h > k.y0 - 0.03 && u + w / 2 > k.a && u - w / 2 < k.b)) continue;
      this.used.push(fr.q);
      if (h > 1.0) this.hung.push({ side, a: u - w / 2, b: u + w / 2, y0: 0 });
      return new Fr(this.b, this.p, fr.x, fr.z, fr.yaw);
    }
    return null;
  }
  /** 壁に掛ける物（床を使わない。高い物・窓・扉を避ける）。原点は壁の面の上 */
  onWall(side: Side, w: number, y0: number, y1: number, o: { start?: number; reverse?: boolean } = {}): Fr | null {
    const [x0, z0, x1, z1] = this.r.rect;
    const lo = side === 'n' || side === 's' ? x0 : z0;
    const hi = side === 'n' || side === 's' ? x1 : z1;
    const L = hi - lo;
    for (let t = (o.start ?? 0) * L + 0.1; t + w <= L - 0.1 + 1e-6; t += 0.05) {
      const u = o.reverse ? hi - t - w / 2 : lo + t + w / 2;
      const clash = (k: Run): boolean => k.side === side && u + w / 2 > k.a && u - w / 2 < k.b && y0 < (k.y0 > 0 ? 3.5 : 2.3) && y1 > k.y0;
      if (this.hung.some(clash) || this.wins.some((k) => k.side === side && u + w / 2 > k.a && u - w / 2 < k.b)) continue;
      if (this.full.some((k) => k.side === side && u + w / 2 > k.a && u - w / 2 < k.b)) continue;
      this.hung.push({ side, a: u - w / 2, b: u + w / 2, y0 });
      const fr = this.frame(side, u, w, 0);
      return new Fr(this.b, this.p, fr.x, fr.z, fr.yaw);
    }
    return null;
  }
  /** 部屋の範囲の辺から壁の面までの距離（参考画像の区画・待合に接する辺は内張りの厚さ） */
  faceOff(side: Side): number {
    return sideSpecs(this.r)[side].t > 0 ? 0 : LINING;
  }
  /**
   * 壁の決まった所（辺に沿った座標 u・高さ y0〜y1）に小さな物を掛ける。扉・窓・柱型・掛けた物・背の高い家具を避ける。
   * 原点は壁の面（1 mm 手前）。空いていなければ null
   */
  tryAt(side: Side, u: number, w: number, y0: number, y1: number): Fr | null {
    const [x0, z0, x1, z1] = this.r.rect;
    const lo = side === 'n' || side === 's' ? x0 : z0;
    const hi = side === 'n' || side === 's' ? x1 : z1;
    if (u - w / 2 < lo + 0.08 || u + w / 2 > hi - 0.08) return null;
    const ov = (k: Run): boolean => k.side === side && u + w / 2 > k.a && u - w / 2 < k.b;
    const clash = (k: Run): boolean => ov(k) && (k.y1 !== undefined ? y0 < k.y1 + 0.05 && y1 > k.y0 - 0.05 : y0 < (k.y0 > 0 ? 3.5 : 2.3) && y1 > k.y0);
    if (this.hung.some(clash) || this.full.some(ov)) return null;
    // 窓: 窓台より下（コンセント）だけ
    if (this.wins.some((k) => ov(k) && y1 > k.y0 - 0.12)) return null;
    this.hung.push({ side, a: u - w / 2, b: u + w / 2, y0, y1 });
    const fr = this.frame(side, u, w, 0);
    return new Fr(this.b, this.p, fr.x, fr.z, fr.yaw).sub(0, this.faceOff(side) + 0.001 - 0.02);
  }
  /** 部屋の中ほどに置く（hw・hd は半分の大きさ。yaw が ±π/2 なら入れ替えて測る） */
  at(x: number, z: number, yaw: number, hw: number, hd: number): Fr | null {
    const sw = Math.abs(Math.sin(yaw)) > 0.7;
    const q: Rect = sw ? [x - hd, z - hw, x + hd, z + hw] : [x - hw, z - hd, x + hw, z + hd];
    if (this.hits(q)) return null;
    this.used.push(q);
    return new Fr(this.b, this.p, x, z, yaw);
  }
}

function sideOf(r: RoomDef, wall: 'x' | 'z', line: number): Side | null {
  const [x0, z0, x1, z1] = r.rect;
  if (wall === 'x') {
    if (Math.abs(line - z0) < 0.5) return 'n';
    if (Math.abs(line - z1) < 0.5) return 's';
  } else {
    if (Math.abs(line - x0) < 0.5) return 'w';
    if (Math.abs(line - x1) < 0.5) return 'e';
  }
  return null;
}

// ---------------------------------------------------------------- 灯りの光だまり（ctx.addLamp）

/** 参考画像の視点に写る所（灯りの光が届いてはいけない箱）: 待合の北の壁の前と、廊下・奥のホール */
const VIEW_GUARD: [number, number, number, number, number, number][] = [
  [-3.45, -0.1, -4.8, 3.35, 4.6, -2.95],
  [-2.25, -0.1, -21.4, 2.35, 4.6, -4.18],
];

let CTX: SceneContext | null = null;

/**
 * 灯りを足す。照らす箱は部屋の内側（壁の向こうへ漏れない）。箱が参考画像に写る所と重なる部屋（待合）では、
 * 光がそこへ届かないように半径を縮める（届く所が残らないなら足さない）
 */
function addLight(r: RoomDef, pos: V3, radius: number, intensity: number, down: boolean, box?: [number, number, number, number, number, number]): void {
  if (!CTX) return;
  const [x0, z0, x1, z1] = r.rect;
  const bx = box ?? [x0 - 0.005, -0.05, z0 - 0.005, x1 + 0.005, r.ceil + 0.05, z1 + 0.005];
  let R = radius;
  for (const g of VIEW_GUARD) {
    const hit = bx[0] < g[3] && bx[3] > g[0] && bx[1] < g[4] && bx[4] > g[1] && bx[2] < g[5] && bx[5] > g[2];
    if (!hit) continue;
    const dx = Math.max(g[0] - pos[0], 0, pos[0] - g[3]);
    const dy = Math.max(g[1] - pos[1], 0, pos[1] - g[4]);
    const dz = Math.max(g[2] - pos[2], 0, pos[2] - g[5]);
    R = Math.min(R, Math.hypot(dx, dy, dz) - 0.15);
  }
  if (R < 1.2) return;
  CTX.addLamp({ pos, radius: R, intensity, down, box: bx, shadow: 0 });
}

/**
 * 天井の灯り: 梁の間の区画（trim.ts の bays）の真ん中に、短い向きに across 個ずつ（梁と重ならない）。
 * 光だまり（ctx.addLamp）は付けない: 強くすると壁に光の筋が出て参考画像の平らな色面から外れ、弱いと見えないのに重さだけ増えた。
 * 光の言葉は窓の前の床の光だまり（windowLights）と、窓の向きで決める壁の明るさ（shell.ts の windowLight）で出す
 */
function lamps(b: Builder, p: Paints, r: RoomDef, across: number, alongX = true, h = r.ceil): void {
  const s = structOf(r);
  const [x0, z0, x1, z1] = r.rect;
  for (const [u0, u1] of s.bays) {
    const u = (u0 + u1) / 2;
    for (let j = 0; j < across; j++) {
      const v = s.long === 'x' ? z0 + ((j + 0.5) * (z1 - z0)) / across : x0 + ((j + 0.5) * (x1 - x0)) / across;
      const [x, z] = s.long === 'x' ? [u, v] : [v, u];
      P.ceilingLamp(new Fr(b, p, x, z, alongX ? 0 : Math.PI / 2), h, 0.9, 0.1);
    }
  }
}

/**
 * 窓の光: 窓台の少し上・部屋の内へ 0.3 m の所から（窓のまわりの壁・窓の前の床が 1 段明るい。外は雪の白）。
 * 半径を小さめ・強さを大きめにして、光だまりの縁（ちぎれた縁）が減衰の急な所に来るようにする（弱い光を広く当てると縁がもやになる）
 */
function windowLights(r: RoomDef): void {
  // 床だけを照らす（照らす箱を床の高さに絞る）: 窓の前の床に、縁のちぎれた明るい四角に近い光だまり。壁は平らな塗りのまま
  //（壁まで照らすと、窓のまわりに光のもやと筋が出て参考画像の平らな色面から外れた）
  const [x0, z0, x1, z1] = r.rect;
  for (const w of WINDOWS) {
    if (w.room !== r.id || w.y0 > 2.0) continue;
    const m = (w.a + w.b) / 2;
    const inn = w.line - w.out * (w.thick / 2 + 0.7);
    const pos: V3 = w.wall === 'x' ? [m, 1.1, inn] : [inn, 1.1, m];
    addLight(r, pos, 1.55 + (w.b - w.a) * 0.18, w.broken ? 0.55 : 0.45, false, [x0 - 0.005, -0.05, z0 - 0.005, x1 + 0.005, 0.012, z1 + 0.005]);
  }
}

/** 暗い低い棚を 1 つ（長い壁から順に、窓の前と扉の前は避ける） */
function darkCab(pl: Placer, rnd: () => number): void {
  const [x0, z0, x1, z1] = pl.r.rect;
  const len = (s: Side): number => (s === 'n' || s === 's' ? x1 - x0 : z1 - z0);
  const sides = (['n', 's', 'w', 'e'] as Side[]).filter((s) => !(pl.r.id === 'LOBBY' && s === 'n')).sort((a, b) => len(b) - len(a));
  const w = pl.r.kind === 'pantry' ? 0.6 : 0.8;
  // 道順の止まり所（目の真下）には置かない（後から足す物なので、止まり所をふさいで歩いて届かなくならないように）
  const stops: Rect[] = pastelPlan.tour.filter((t) => t.eye[1] < 3).map((t) => [t.eye[0] - 0.7, t.eye[2] - 0.7, t.eye[0] + 0.7, t.eye[2] + 0.7] as Rect);
  pl.used.push(...stops);
  try {
    for (const s of sides) {
      const f = pl.wall(s, w, 0.45, 1.05, { start: 0.15 + rnd() * 0.3 }) ?? pl.wall(s, w, 0.45, 1.05);
      if (f) {
        P.darkCabinet(f, w, 1.0, 0.45, Math.floor(rnd() * 99));
        return;
      }
    }
  } finally {
    for (const q of stops) pl.used.splice(pl.used.indexOf(q), 1);
  }
}

// ---------------------------------------------------------------- 壁の小さな器具（どの部屋にも同じ決まり）

/**
 * 参考画像の右の塊（幅 3 m）には、スイッチの板 2・コンセント 1・掲示 1・高い所の板 1 がある。同じ密度で:
 * - 扉の横（戸先の側、枠から 0.26 m）にスイッチの板。部屋に 1 つはその上に器具の板（2.45 m）
 * - 足元のコンセント（壁ぞいに 3〜3.8 m おき。窓の下にも）
 * - 長い壁 2 面の高い所（2.7 m）に小さな灰色の板、窓の無い壁の天井近くに換気口
 * 扉・窓・柱型・背の高い家具・掛けた物は避ける
 */
function fixtures(pl: Placer, rnd: () => number): void {
  const r = pl.r;
  let first = true;
  for (const d of DOORS) {
    if (!d.rooms.includes(r.id) || d.kind === 'pass' || d.y0 > 0.5) continue;
    const side = sideOf(r, d.wall, d.line);
    if (!side) continue;
    const pref = d.kind === 'swing' && d.hinge === 'b' ? [d.a - 0.26, d.b + 0.26] : [d.b + 0.26, d.a - 0.26];
    for (const u of pref) {
      const f = pl.tryAt(side, u, 0.14, 1.2, 1.45);
      if (!f) continue;
      P.switchPlate(f, 1.22, rnd() < 0.5 ? 2 : 1);
      if (first) {
        const g = pl.tryAt(side, u, 0.16, 2.42, 2.7);
        if (g) P.slotPlate(g, 2.44);
        first = false;
      }
      break;
    }
  }
  const [x0, z0, x1, z1] = r.rect;
  const span = (s: Side): [number, number] => (s === 'n' || s === 's' ? [x0, x1] : [z0, z1]);
  for (const s of ['n', 's', 'w', 'e'] as Side[]) {
    const [lo, hi] = span(s);
    for (let u = lo + 0.6 + rnd() * 0.8; u < hi - 0.4; u += 3.0 + rnd() * 0.8) {
      const f = pl.tryAt(s, u, 0.13, 0.2, 0.4);
      if (f) P.socket(f, 0.21);
    }
  }
  const sides = (['n', 's', 'w', 'e'] as Side[]).sort((a, b) => span(b)[1] - span(b)[0] - (span(a)[1] - span(a)[0]));
  for (const s of sides.slice(0, 2)) {
    const [lo, hi] = span(s);
    for (const t of [0.5, 0.36, 0.64, 0.22, 0.78]) {
      const f = pl.tryAt(s, lo + (hi - lo) * t + (rnd() - 0.5) * 0.3, 0.21, 2.64, 2.86);
      if (f) {
        P.highPlate(f, 2.66);
        break;
      }
    }
  }
  const noWin = sides.find((s) => !pl.wins.some((k) => k.side === s));
  if (noWin && r.ceil > 2.95) {
    const [lo, hi] = span(noWin);
    for (const t of [0.5, 0.3, 0.7]) {
      const f = pl.tryAt(noWin, lo + (hi - lo) * t, 0.32, r.ceil - 1.0, r.ceil - 0.74);
      if (f) {
        P.highPlate(f, r.ceil - 0.98, 0.3, 0.22, true);
        break;
      }
    }
  }
}

/** 掲示を何枚か（壁の空いた所） */
function posters(pl: Placer, post: Posters, side: Side, n: number, seed: number, y = 1.55): void {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const w = 0.32 + r() * 0.18;
    const h = w * (1.2 + r() * 0.3);
    const f = pl.onWall(side, w + 0.12, y - h / 2, y + h / 2, { start: r() * 0.5 });
    if (!f) continue;
    const c = f.w([0, y + (r() - 0.5) * 0.1, 0.006]);
    const dir = side === 'n' ? 'pz' : side === 's' ? 'nz' : side === 'w' ? 'px' : 'nx';
    post.put(pl.b, Math.floor(r() * 100), dir, c, w, h);
  }
}

export function furnishAll(ctx: SceneContext, p: Paints, bOf: (k: string) => Builder): void {
  CTX = ctx;
  const post = new Posters(p);
  for (const r of ROOMS) {
    if (r.view) continue;
    const b = bOf(r.id);
    const pl = new Placer(r, b, p);
    const rnd = rng(1000 + ROOMS.indexOf(r) * 37);
    switch (r.kind) {
      case 'lobby':
        lobby(pl, post, rnd);
        break;
      case 'vest':
        P.mat(new Fr(b, p, 0, 3.4, 0), 1.6, 0.9, C.darker);
        P.umbrellaStand(new Fr(b, p, 1.15, 4.6, Math.PI), 3);
        P.ceilingLamp(new Fr(b, p, 0, 3.9, 0), r.ceil, 0.4, 0.4);
        P.drift(new Fr(b, p, 0.7, 4.55, 0.1), 1.0, 0.6, 0.16);
        break;
      case 'office':
        office(pl, post, rnd);
        break;
      case 'doctor':
        doctor(pl, post, rnd);
        break;
      case 'store':
        store(pl, rnd);
        break;
      case 'consult':
        consult(pl, post, rnd);
        break;
      case 'treat':
        treat(pl, post, rnd);
        break;
      case 'lab':
        lab(pl, post, rnd);
        break;
      case 'toilet':
        toilet(pl, rnd);
        break;
      case 'stair':
        stair(pl, post, rnd);
        break;
      case 'pantry':
        pantry(pl, post, rnd);
        break;
      case 'porch':
        P.shoeRack(new Fr(b, p, -1.27, -22.25, Math.PI / 2), 1.6, 0.9, 0.38, 0.5, 5);
        // 下駄箱の上の掲示板と、扉の横の掛け金物（職員の通り道の決まり）
        P.noticeBoard(new Fr(b, p, -1.499, -22.3, Math.PI / 2), 1.1, 0.62, 1.25, 3);
        P.hooks(new Fr(b, p, -0.9, -23.199, 0), 0.6, 1.62, 3);
        // 外の扉に貼った紙（「施錠中」の知らせ）と、扉の横の外灯のスイッチ
        new Fr(b, p, -0.12, -23.19, 0).box(C.paper, [-0.14, 1.02, 0.03], [0.14, 1.26, 0.034]);
        new Fr(b, p, -0.12, -23.19, 0).box('#b8c3bb', [-0.1, 1.18, 0.034], [0.1, 1.2, 0.036]);
        new Fr(b, p, -0.12, -23.19, 0).box('#b8c3bb', [-0.1, 1.12, 0.034], [0.06, 1.135, 0.036]);
        P.umbrellaStand(new Fr(b, p, 1.2, -21.65, -Math.PI / 2), 2);
        P.mopSink(new Fr(b, p, 1.48, -22.9, -Math.PI / 2));
        P.mat(new Fr(b, p, 0, -21.85, 0), 1.2, 0.7, C.darker);
        P.drift(new Fr(b, p, 0.1, -22.85, 0.15), 1.6, 0.6, 0.2);
        P.ceilingLamp(new Fr(b, p, 0, -22.2, 0), r.ceil, 0.35, 0.35);
        posters(pl, post, 'e', 1, 77, 1.6);
        break;
    }
    // 暗い低い棚（参考画像の右の暗い棚。部屋に 1 つ、窓の無い長い壁の空いた所）
    if (['lobby', 'office', 'doctor', 'store', 'consult', 'treat', 'lab', 'pantry'].includes(r.kind)) darkCab(pl, rnd);
    // 壁の小さな器具（階段室は stair() で）・窓の光
    if (r.kind !== 'stair') fixtures(pl, rnd);
    windowLights(r);
  }
  hiddenViewWalls(bOf('viewHidden'), p, post);
}

/**
 * 参考画像の区画（廊下・奥のホール）のうち、参考画像の目から見えない壁（柱型・枠の陰）にも同じ決まりの器具を付ける。
 * どれも壁の面に貼る薄い物（出っ張らない）で、目からの見通しの比（|x| / |z|）が陰の線より外にある所だけ:
 * - 廊下の東の凹み（x = 1.82）: 診察室・処置室の引き戸の横のスイッチと、凹みの奥の掲示・コンセント
 * - 奥のホールの東（x = 1.43, z -15.4〜-19.5）: 便所の扉の横のスイッチ・掲示・コンセント
 */
function hiddenViewWalls(b: Builder, p: Paints, post: Posters): void {
  const E = (x: number, z: number): Fr => new Fr(b, p, x, z, -Math.PI / 2);
  // 廊下の東の凹み（陰: 手前のクリームの柱で z -5.1〜-7.87、柱型 A で -7.8〜-10.59、柱型 B で -11.0〜-15.05）
  const X = 1.819;
  P.switchPlate(E(X, -6.66), 1.22, 2);
  P.socket(E(X, -6.9), 0.21);
  post.put(b, 5, 'nx', [X - 0.002, 1.55, -7.05], 0.36, 0.48);
  P.switchPlate(E(X, -7.96), 1.22, 1);
  P.slotPlate(E(X, -7.98), 2.44);
  post.put(b, 8, 'nx', [X - 0.002, 1.6, -10.0], 0.38, 0.52);
  P.socket(E(X, -9.9), 0.21);
  P.switchPlate(E(X, -11.14), 1.22, 2);
  post.put(b, 14, 'nx', [X - 0.002, 1.5, -13.3], 0.42, 0.56);
  P.socket(E(X, -13.9), 0.21);
  P.highPlate(E(X, -13.2), 2.66);
  // 奥のホールの東（陰: 枠 2 の右の柱で z -15.4〜-19.5。窓口の台は参考画像に写るので避ける）
  const X2 = 1.429;
  P.switchPlate(E(X2, -17.94), 1.22, 1);
  post.put(b, 16, 'nx', [X2 - 0.002, 1.55, -15.95], 0.38, 0.5);
  P.socket(E(X2, -16.2), 0.21);
  P.socket(E(X2, -19.35), 0.21);
}

// ---------------------------------------------------------------- 部屋ごと

function lobby(pl: Placer, post: Posters, rnd: () => number): void {
  const { b, p } = pl;
  const r = pl.r;
  // 参考画像の画角（目から北の壁の塊まで）と廊下・風除室への通り道は空ける
  pl.block([-3.6, -4.2, 3.2, -2.0]);
  pl.block([-1.9, -2.0, 1.9, 2.6]);
  // 長椅子: 西は受付の窓口を向く 3 列、東は東の壁ぎわとストーブの周り
  for (const z of [-1.3, 0.1, 1.5]) for (const x of [-6.0, -3.85]) {
    const f = pl.at(x, z, Math.PI, 0.95, 0.3);
    if (f) P.bench(f, 1.8);
  }
  const s1 = pl.wall('e', 1.8, 0.45, 0.9, { start: 0.0 });
  if (s1) P.bench(s1, 1.8);
  const st = pl.at(4.0, 0.6, 0, 0.6, 0.6);
  if (st) P.stove(st);
  const s2 = pl.at(4.0, -1.0, 0, 0.95, 0.3);
  if (s2) P.bench(s2, 1.8);
  const s3 = pl.at(2.75, 0.9, -Math.PI / 2, 0.75, 0.3);
  if (s3) P.bench(s3, 1.4);
  // 下足箱（南の壁の窓の下に低い物）・スリッパ立て・傘立て
  for (const [side, w, o] of [['s', 2.4, { start: 0.02 }], ['s', 2.4, { reverse: true, start: 0.02 }]] as const) {
    const f = pl.wall(side, w, 0.36, 0.85, o);
    if (f) P.shoeRack(f, w, 0.85, 0.36, 0.45, Math.floor(rnd() * 99));
  }
  const ss = pl.at(-2.4, 2.25, Math.PI, 0.35, 0.12);
  if (ss) P.slipperStand(ss, 0.6, 6);
  const us = pl.at(2.25, 2.3, Math.PI, 0.22, 0.14);
  if (us) P.umbrellaStand(us, 3);
  // 雑誌の棚・植木・給水機・公衆電話（西と東の壁）
  const mr = pl.wall('w', 0.8, 0.3, 1.1, { start: 0.0 });
  if (mr) P.magazineRack(mr, 0.8);
  for (const [side, o] of [['w', { reverse: true }], ['e', { reverse: true }]] as const) {
    const f = pl.wall(side, 0.45, 0.45, 1.2, o);
    if (f) P.plant(f, 1.1 + rnd() * 0.3);
  }
  const wc = pl.wall('e', 0.36, 0.36, 1.3, { start: 0.45 });
  if (wc) P.waterCooler(wc);
  const ph = pl.wall('e', 0.6, 0.25, 1.2, { start: 0.6 });
  if (ph) P.phone(ph);
  // 時計（受付の窓口の上）・掲示（東の塊・南の壁）・灯り
  P.clock(new Fr(b, p, -5.0, -4.18, 0), 3.3);
  for (let i = 0; i < 4; i++) post.put(b, 3 + i, 'pz', [3.6 + i * 0.75, 1.75 + (i % 2) * 0.12, -4.272], 0.5, 0.65);
  post.put(b, 9, 'pz', [-6.9, 2.3, -4.172], 0.4, 0.5);
  posters(pl, post, 's', 2, 11, 2.2);
  posters(pl, post, 'w', 1, 12, 1.9);
  P.extinguisher(new Fr(b, p, 6.9, -4.28, 0));
  lamps(b, p, r, 2);
}

function office(pl: Placer, post: Posters, rnd: () => number): void {
  const { b, p, r } = pl;
  // 窓口の内側の台と椅子（南の壁）
  for (const [x, w] of [[-6.42, 1.0], [-4.85, 1.5]] as const) {
    const f = new Fr(b, p, x, -4.46 - 0.35, Math.PI);
    P.desk(f, w, 0.6, { drawers: false });
    P.deskTop(f, w, 0.72, Math.floor(rnd() * 99), false);
    P.officeChair(f.sub(0, 0.65, Math.PI + (rnd() - 0.5) * 0.4));
    pl.block([x - w / 2, -5.6, x + w / 2, -4.46]);
  }
  P.deskPhone(new Fr(b, p, -4.3, -4.75, Math.PI), 0.72);
  // 薬の引き出しの棚・薬品棚（東の壁 = 廊下の壁）
  const dc = pl.wall('e', 1.8, 0.42, 1.8, { start: 0.05 });
  if (dc) P.drawerCabinet(dc, 1.8, 1.8, 0.42);
  const gc = pl.wall('e', 0.9, 0.4, 1.85, { start: 0.05 });
  if (gc) P.glassCabinet(gc, 0.9, 1.85, 0.4, 3);
  const sh = pl.wall('e', 0.9, 0.4, 1.9, { open: true });
  if (sh) P.shelf(sh, 0.9, 1.9, 0.4, 'bottle', 4, C.enamel);
  // 調剤台（中ほど）
  const dt = pl.at(-4.6, -7.4, 0, 0.85, 0.42);
  if (dt) P.dispensingTable(dt, 1.6, 0.75);
  // 金庫・書類の棚（北の壁）・低い棚（西の窓の下）
  const sf = pl.wall('n', 0.65, 0.6, 0.8, { start: 0.25 });
  if (sf) P.safe(sf);
  const fc = pl.wall('n', 0.9, 0.45, 1.8, { start: 0.3, open: true });
  if (fc) P.shelf(fc, 0.9, 1.8, 0.4, 'file', 6);
  const lc = pl.wall('w', 1.6, 0.45, 0.85);
  if (lc) P.lowCabinet(lc, 1.6, 0.85, 0.45);
  const bn = pl.wall('w', 0.3, 0.3, 0.4, { reverse: true });
  if (bn) P.bin(bn);
  P.clock(new Fr(b, p, -4.6, -9.75, 0), 2.5);
  posters(pl, post, 'n', 2, 21, 1.6);
  posters(pl, post, 'w', 1, 22, 2.1);
  lamps(b, p, r, 2);
}

function doctor(pl: Placer, post: Posters, rnd: () => number): void {
  const { b, p, r } = pl;
  // 窓ぎわの机（西の窓の下）と椅子
  const dk = pl.wall('w', 1.3, 0.7, 0.75, { start: 0.3 });
  if (dk) {
    P.desk(dk, 1.3, 0.7);
    P.deskTop(dk, 1.3, 0.72, 5, true);
    P.officeChair(dk.sub(0.1, 0.7, Math.PI + 0.3));
  }
  // 応接のソファと低い机
  const so = pl.wall('e', 1.4, 0.75, 0.8, { start: 0.25 });
  if (so) {
    P.sofa(so, 1.4);
    const lt = pl.at(so.x - 1.0, so.z, Math.PI / 2, 0.55, 0.3);
    if (lt) P.lowTable(lt, 1.0, 0.55);
  }
  const bk = pl.wall('e', 0.9, 0.35, 1.9, { open: true });
  if (bk) P.shelf(bk, 0.9, 1.9, 0.35, 'book', 8, C.wood);
  const bk2 = pl.wall('e', 0.9, 0.35, 1.9, { open: true });
  if (bk2) P.shelf(bk2, 0.9, 1.9, 0.35, 'book', 9, C.wood);
  const sk = pl.wall('n', 0.5, 0.42, 1.6, { start: 0.0 });
  if (sk) P.sink(sk, 0.5);
  const cs = pl.at(r.rect[0] + 0.35, r.rect[3] - 0.45, 0, 0.25, 0.25);
  if (cs) P.coatStand(cs);
  const bn = pl.wall('w', 0.3, 0.3, 0.4, { reverse: true });
  if (bn) P.bin(bn, C.wood);
  P.clock(new Fr(b, p, -5.9, -15.1, 0), 2.6);
  posters(pl, post, 'e', 1, 31, 2.3);
  lamps(b, p, r, 1);
  void rnd;
}

function store(pl: Placer, rnd: () => number): void {
  const { b, p, r } = pl;
  // 両側の壁に金属の棚（カルテ・箱）
  for (const side of ['w', 'e'] as const)
    for (let i = 0; i < 4; i++) {
      const f = pl.wall(side, 0.9, 0.45, 2.1, { open: true });
      if (f) P.shelf(f, 0.9, 2.1, 0.45, i % 2 ? 'file' : 'box', Math.floor(rnd() * 999));
    }
  const wc = pl.at(-3.3, -12.5, 0.4, 0.35, 0.35);
  if (wc) P.wheelchair(wc);
  const ld = pl.at(-3.0, -11.3, -0.2, 0.3, 0.25);
  if (ld) P.ladder(ld, 1.5);
  for (const [x, z] of [[-3.6, -13.9], [-2.8, -10.9]]) {
    const f = pl.at(x, z, rnd() * 0.5, 0.3, 0.25);
    if (f) P.boxes(f, 2 + Math.floor(rnd() * 2), Math.floor(rnd() * 99));
  }
  lamps(b, p, r, 1, false);
}

function consult(pl: Placer, post: Posters, rnd: () => number): void {
  const { b, p, r } = pl;
  // 机（東の窓の下）・医者の椅子・患者の丸椅子
  const dk = pl.wall('e', 1.3, 0.65, 0.75);
  if (dk) {
    P.desk(dk, 1.3, 0.65);
    P.deskTop(dk, 1.3, 0.72, Math.floor(rnd() * 99), true);
    P.officeChair(dk.sub(0.15, 0.7, Math.PI + 0.25));
    P.stool(dk.sub(-0.75, 0.75, 0));
  }
  // 診察台と踏み台・衝立
  const side = r.id === 'E1' ? 's' : 'n';
  const ex = pl.wall(side, 1.9, 0.65, 0.7, { start: 0.12 });
  if (ex) {
    P.exam(ex, 1.8);
    const sc = pl.at(ex.x + (ex.x > 4.5 ? -1.35 : 1.35), ex.z + (side === 's' ? -0.55 : 0.55), Math.PI / 2, 0.85, 0.15);
    if (sc) P.screen(sc, 3, 0.55, 1.65);
  }
  // ガラス戸の薬品棚・流し・シャウカステン・体重計・屑かご
  const gc = pl.wall(side === 's' ? 'n' : 's', 0.9, 0.4, 1.85, { start: 0.1 });
  if (gc) P.glassCabinet(gc, 0.9, 1.85, 0.4, Math.floor(rnd() * 99));
  const sk = pl.wall('w', 0.5, 0.42, 1.6) ?? pl.wall(side === 's' ? 'n' : 's', 0.5, 0.42, 1.6);
  if (sk) P.sink(sk, 0.5);
  const vw = pl.onWall(side === 's' ? 'n' : 's', 1.0, 1.2, 1.8, { reverse: true });
  if (vw) P.viewer(vw, 0.9, 1.5);
  const scl = pl.wall(side === 's' ? 'n' : 's', 0.45, 0.45, 1.42);
  if (scl) P.scale(scl);
  const bn = pl.wall('e', 0.3, 0.3, 0.4, { reverse: true });
  if (bn) P.bin(bn);
  posters(pl, post, 'w', 1, 41 + Math.floor(rnd() * 9), 1.6);
  lamps(b, p, r, 1);
}

function treat(pl: Placer, post: Posters, rnd: () => number): void {
  const { b, p, r } = pl;
  // 処置台 2 台（頭を東の壁に。カーテンレール）
  for (const z of [-14.4, -12.6]) {
    const f = pl.at(6.15, z, -Math.PI / 2, 0.45, 1.0);
    if (f) P.treatBed(f, r.ceil);
  }
  const ic = pl.wall('w', 0.9, 0.4, 1.85);
  if (ic) P.glassCabinet(ic, 0.9, 1.85, 0.4, 13);
  const sc = pl.wall('n', 1.6, 0.6, 0.85, { start: 0.0 });
  if (sc) P.sinkCounter(sc, 1.6, { upper: true, sinkAt: -0.3 });
  const sh = pl.wall('s', 0.9, 0.4, 1.9, { start: 0.05, open: true });
  if (sh) P.shelf(sh, 0.9, 1.9, 0.4, 'mixed', 17, C.enamel);
  const ct = pl.at(4.4, -13.6, 0.3, 0.35, 0.3);
  if (ct) P.cart(ct, 0.6, 0.45, 0.9);
  const iv = pl.at(5.0, -12.0, 0, 0.25, 0.25);
  if (iv) P.ivPole(iv);
  const ox = pl.wall('s', 0.3, 0.3, 1.3, { reverse: true });
  if (ox) P.oxygen(ox);
  const bn = pl.wall('w', 0.3, 0.3, 0.4, { reverse: true });
  if (bn) P.bin(bn);
  const st = pl.at(3.8, -12.3, 0, 0.2, 0.2);
  if (st) P.stool(st, C.enamel);
  posters(pl, post, 'w', 1, 51, 1.7);
  lamps(b, p, r, 2);
  void rnd;
}

function lab(pl: Placer, post: Posters, rnd: () => number): void {
  const { b, p, r } = pl;
  // 作業台（北の壁 = 便所との境・東の窓の下）と流し
  const n1 = pl.wall('n', 3.2, 0.6, 0.85, { start: 0.18 });
  if (n1) {
    P.sinkCounter(n1, 3.2, { upper: false, sinkAt: 1.1 });
    P.microscope(n1.sub(-0.9, 0, 0), 0.85);
    P.centrifuge(n1.sub(-0.2, 0, 0), 0.85);
    P.tubeRack(n1.sub(0.4, 0.05, 0), 0.85);
  }
  const e1 = pl.wall('e', 1.4, 0.6, 0.85, { start: 0.05 });
  if (e1) {
    P.sinkCounter(e1, 1.4, { upper: false, sinkAt: 0.3 });
    P.tubeRack(e1.sub(-0.3, 0.0, 0), 0.85);
  }
  // 冷蔵庫・試薬棚（南の壁）・丸椅子
  const fr = pl.wall('s', 0.6, 0.6, 1.4, { start: 0.0 });
  if (fr) P.fridge(fr, 1.4, 0.6);
  const sh = pl.wall('s', 1.0, 0.35, 1.9, { open: true });
  if (sh) P.shelf(sh, 1.0, 1.9, 0.35, 'bottle', 61, C.enamel);
  const st = pl.at(4.0, -16.7, 0, 0.2, 0.2);
  if (st) P.stool(st, C.enamel);
  // 窓口の台の上の検体のコップ
  const f = new Fr(b, p, 1.86, -17.15, Math.PI / 2);
  for (let i = 0; i < 3; i++) f.cyl('#e5ece0', [-0.3 + i * 0.2, 1.0, 0], 0.035, 0.1, { segments: 8 });
  posters(pl, post, 's', 1, 63, 1.7);
  lamps(b, p, r, 1, true, r.ceil);
  void rnd;
}

function toilet(pl: Placer, rnd: () => number): void {
  const { b, p, r } = pl;
  // 個室 3（北の壁ぎわ）
  const w = 1.0;
  const dp = 1.45;
  for (let i = 0; i < 3; i++) {
    const x = 3.25 + i * w;
    P.stall(new Fr(b, p, x + w / 2, r.rect[1] + dp / 2, 0), w, dp, [0.1, 0.8, 0.35][i], i === 2);
  }
  // 小便器（東の壁）・手洗い（西の壁、扉の北）・掃除の流し（南の壁）
  for (const z of [-19.2, -19.9]) P.urinal(new Fr(b, p, 7.2, z, -Math.PI / 2));
  // 小便器の間と端の仕切り板（セージの板）と、上の洗浄の管
  for (const z of [-18.85, -19.55, -20.25]) new Fr(b, p, 7.2, z, -Math.PI / 2).box(p.wall({ up: '#c9d4c6', low: '#8fa29b', band: 0.95 }), [-0.015, 0.35, 0], [0.015, 1.55, 0.42]);
  new Fr(b, p, 7.2, -19.55, -Math.PI / 2).box(C.metal, [-0.75, 1.62, 0.02], [0.75, 1.65, 0.05]);
  pl.block([2.9, -21.0, 6.6, -19.5]);
  for (const z of [-20.55, -19.95]) {
    const f = pl.at(1.745 + 0.21, z, Math.PI / 2, 0.27, 0.21);
    if (f) P.sink(f, 0.5);
  }
  const ms = pl.wall('s', 1.0, 0.5, 1.4, { start: 0.3 });
  if (ms) P.mopSink(ms.sub(-0.2, -0.22, 0));
  // 採尿の小窓の下の台（コップ）
  const pf = new Fr(b, p, 6.4, -18.05, Math.PI);
  for (let i = 0; i < 3; i++) pf.cyl('#e5ece0', [-0.12 + i * 0.12, 1.045, 0.09], 0.03, 0.09, { segments: 8 });
  P.ceilingLamp(new Fr(b, p, 4.5, -19.0, 0), r.ceil, 0.9, 0.1);
  P.ceilingLamp(new Fr(b, p, 2.6, -19.5, Math.PI / 2), r.ceil, 0.6, 0.1);
  void rnd;
}

function stair(pl: Placer, post: Posters, rnd: () => number): void {
  const { b, p, r } = pl;
  // 上り口: 消火器・案内の札・長椅子（広間）
  P.extinguisher(new Fr(b, p, -1.722, -17.75, -Math.PI / 2));
  P.bench(new Fr(b, p, -2.45, -17.9 + 0.26, 0), 0.9);
  post.put(b, 13, 'pz', [-2.6, 1.8, -17.895], 0.45, 0.55);
  // 階段の下の物入れの前（2 階の踊り場の下）: 段ボール・屋内消火栓・階の案内
  P.boxes(new Fr(b, p, -6.92, -15.68, 0.1), 2, 7);
  P.hoseCabinet(new Fr(b, p, -2.25, -15.4, Math.PI));
  post.put(b, 18, 'nz', [-4.25, 1.75, -15.405], 0.5, 0.65);
  P.pendant(new Fr(b, p, -3.2, -16.7, 0), STAIR.ceil, 2.2);
  // 2 階の踊り場: 鍵の扉の前の柵と札
  P.cones(new Fr(b, p, -6.5, -15.85, 0, FLOOR2), 1.1);
  post.put(b, 2, 'nz', [-5.3, FLOOR2 + 1.5, -15.405], 0.4, 0.5);
  // 踊り場（北）: 割れた窓の下の雪と枯れた植木
  P.drift(new Fr(b, p, -5.9, -20.75, 0.1, STAIR.mid), 1.6, 0.45, 0.14);
  P.plant(new Fr(b, p, -6.95, -20.75, 0, STAIR.mid), 1.0);
  // 階の案内（踊り場の壁）
  post.put(b, 19, 'px', [-7.195, STAIR.mid + 1.6, -20.4], 0.35, 0.45);
  // 階段の壁の灯り（1 本目の西の壁と 2 本目の上の壁の腕木の灯り）と、上り口の階の札
  for (const [x, z, y, yaw] of [[-7.2, -18.3, 3.6, Math.PI / 2], [-7.2, -16.9, 6.6, Math.PI / 2]] as const) {
    const f = new Fr(b, p, x, z, yaw);
    f.box(C.metal, [-0.04, y - 0.05, 0], [0.04, y + 0.05, 0.12]);
    f.box(C.enamel, [-0.13, y - 0.16, 0.08], [0.13, y - 0.04, 0.22]);
    f.box(p.glow('#f4f6e4'), [-0.11, y - 0.165, 0.1], [0.11, y - 0.155, 0.2]);
  }
  // 中壁の 1 本目の側の掲示（足元の注意）
  post.put(b, 6, 'nx', [-6.003, 1.95, -17.2], 0.3, 0.38);
  new Fr(b, p, -7.199, -16.75, Math.PI / 2).box('#e5ece0', [-0.16, 1.55, 0], [0.16, 1.85, 0.01]);
  new Fr(b, p, -7.199, -16.75, Math.PI / 2).box('#8f9e98', [-0.08, 1.64, 0.01], [0.08, 1.76, 0.012]);
  // 灯り（吹き抜けの天井・広間の天井・踊り場の壁の灯り）
  P.pendant(new Fr(b, p, -5.95, -18.0, 0), STAIR.ceil, 1.4);
  new Fr(b, p, -5.95, -21.0, 0).box(p.glow('#f4f6e4'), [-0.15, STAIR.mid + 2.35, 0], [0.15, STAIR.mid + 2.45, 0.05]);
  // ---- 壁の小さな器具（どの部屋とも同じ決まり。階段の横は段が埋まるので、広間と踊り場の壁に手で置く）----
  // 広間: 階段室の口の北（東の壁）・医局の扉の横（南の壁）・給湯室の扉の横（給湯室の外の面）
  const E = (z: number, y = 0): Fr => new Fr(b, p, -1.723, z, -Math.PI / 2, y);
  const S = (x: number, y = 0): Fr => new Fr(b, p, x, -15.401, Math.PI, y);
  const N = (x: number, y = 0): Fr => new Fr(b, p, x, -17.893, 0, y);
  P.switchPlate(E(-17.38), 1.22, 2);
  P.slotPlate(E(-17.38), 2.44);
  P.socket(E(-17.45), 0.21);
  P.switchPlate(S(-4.69), 1.22, 1);
  P.socket(S(-3.95), 0.21);
  P.highPlate(S(-3.28), 3.35, 0.3, 0.22, true);
  P.switchPlate(N(-2.74), 1.22, 1);
  P.socket(N(-1.98), 0.21);
  P.highPlate(N(-4.2), 2.2);
  // 広間の西（2 本目の下の物入れの壁の東の面）: 掲示板・コンセント・案内の板
  const Wl = (z: number, y = 0): Fr => new Fr(b, p, -4.599, z, Math.PI / 2, y);
  P.noticeBoard(Wl(-17.25), 1.0, 0.6, 1.2, 9);
  P.socket(Wl(-16.85), 0.21);
  P.highPlate(Wl(-17.25), 2.05);
  // 2 階の踊り場: 鍵の扉の横のスイッチ・上の板
  P.switchPlate(S(-5.79, FLOOR2), 1.22, 2);
  P.highPlate(S(-5.3, FLOOR2), 2.62);
  P.socket(new Fr(b, p, -7.199, -15.9, Math.PI / 2, FLOOR2), 0.21);
  // ---- 窓の光だまり（床だけ）: 北の踊り場の床と、吹き抜けの北東の隅の縦長の窓の下の給湯室の屋根 ----
  addLight(r, [-5.95, STAIR.mid + 1.1, -20.3], 1.9, 0.9, false, [-7.205, STAIR.mid - 0.05, -21.005, -4.75, STAIR.mid + 0.012, -19.795]);
  addLight(r, [-3.15, 2.95 + 1.1, -20.4], 1.9, 0.7, false, [-4.75, 2.9, -21.005, -1.725, 2.975, -18.05]);
  void rnd;
  void room;
}

function pantry(pl: Placer, post: Posters, rnd: () => number): void {
  const { b, p, r } = pl;
  const sc = pl.wall('n', 2.0, 0.6, 0.85, { start: 0.1 });
  if (sc) P.sinkCounter(sc, 2.0, { stove: true, upper: false, sinkAt: -0.45 });
  const cb = pl.wall('w', 0.9, 0.42, 1.83, { start: 0.05 });
  if (cb) P.cupboard(cb, 0.9, 1.8);
  const fr = pl.wall('w', 0.6, 0.6, 1.3);
  if (fr) P.fridge(fr, 1.3, 0.6);
  const tb = pl.at(-2.8, -19.4, 0, 0.45, 0.35);
  if (tb) {
    P.desk(tb, 0.8, 0.6, { drawers: false, top: C.enamel });
    P.chair(tb.sub(-0.1, 0.55, Math.PI + 0.2));
    P.chair(tb.sub(0.15, -0.55, 0.15));
    tb.cyl(C.enamel, [0.15, 0.78, 0.05], 0.04, 0.09, { segments: 8 });
  }
  const bn = pl.wall('e', 0.3, 0.3, 0.4, { reverse: true });
  if (bn) P.bin(bn);
  posters(pl, post, 'e', 1, 71, 1.5);
  P.clock(new Fr(b, p, -1.722, -19.5, -Math.PI / 2), 2.2);
  lamps(b, p, r, 1);
  void rnd;
}
