/**
 * 寄せ集めの区域（v1 風。docs/endless-world.md 4 章・V2-12）: 区域の矩形をいくつもの部屋に切り分け、部屋ごとに全部の系統から
 * テーマ・天井の高さを引く。部屋どうしは壁 1 枚の扉（ときどき開口）で直接つながるので、扉を開けるたびに雰囲気も大きさも変わる。
 *
 * - 切り分け: 長い辺を切ることをくり返す（大きい部屋をそのまま残す・細長い通路を切り出すこともある）。境目の扉の位置は切らない
 * - 部屋の種類: 広い部屋は広間（天井が高い）、細長い所は通路、ほかは部屋。小部屋から 40 m の広間まで
 * - 通路: まっすぐ・L 字・T 字・十字（world.patch.corridorMaxM より長い矩形は先に切り分ける。端から端までの長い通路ばかりにしない）
 * - 部屋ごとの系統は、壁を接する部屋と違う物を引く。暗い・まぶしい・天井の高い・低い部屋もある
 * - つなぎ: 壁を接する部屋どうしの木（入口から全部へ行ける）+ 確率で足す扉 + 行き止まりの部屋に足す扉。開口は同じ系統の部屋どうしだけ
 * - 境目の扉: 区域の辺の上の部屋の壁に直接（廊下を挟まない）
 * - 階段室: 部屋の角を切り取って置く（残りは L 字の部屋）。扉は残りの部屋へ
 */
import type { Tuning } from '../../../config/tuning.ts';
import { hashAll, Rng } from '../../../math/rng.ts';
import { rotQ, type Dir, type Vec3 } from '../../../math/vec.ts';
import { opening } from '../../../world/build.ts';
import type { Rect } from '../../../world/footprint.ts';
import { DOOR_H, DOOR_W, WALL_T, type RegionAirlockCell, type RegionGateCell } from '../../../world/layout.ts';
import { themePalette } from '../../../world/palettes.ts';
import { airlockAnchor, airlockShape, airlockSpawn, hostFront, placeAirlock } from '../../world/airlock.ts';
import { placeLanding, placeOpenHoles } from '../../world/landing.ts';
import { GenError, GeoBuild, snap, type FloorGeometry, type Placed } from '../geometry.ts';
import { rarityRank, type FloorProfile } from '../profile.ts';
import type { SkelNode } from '../skeleton.ts';
import { FAMILIES, type FloorFamily } from '../themes.ts';

const node = (id: number): SkelNode => ({ id, col: 0, row: 0, kind: 'room', level: 0, hall: -1, story: 0 });

type LeafKind = 'room' | 'hall' | 'corridor';

/** 部屋の大きさの目安（切り出す辺の m。x と z で別に引く）と重み: 小部屋から大部屋まで。64 m 角の升目に 30 部屋ほど */
const PATCH_SIZES: [number, number][] = [[6, 0.8], [8, 1.5], [10, 3], [12, 3], [15, 3], [19, 2], [24, 1], [30, 0.5]];
interface Leaf { rects: Rect[]; kind: LeafKind; module?: boolean }

const area = (r: Rect): number => (r.x1 - r.x0) * (r.z1 - r.z0);

export function buildPatchwork(p: FloorProfile, rng: Rng, t: Tuning): FloorGeometry {
  const reg = p.region;
  if (!reg) throw new GenError('寄せ集めは区域だけで作れます');
  const g = new GeoBuild(p, t, rng.fork('doors'), 2.4);
  const minM = t['world.patch.minM'], hallM = t['world.patch.hallM'];
  const gateClear = DOOR_W / 2 + 1.1;
  // 切る線が境目の扉に掛からないか（x = c の線は +Z・−Z の辺の扉、z = c の線は +X・−X の辺の扉）
  const cutOk = (axis: 'x' | 'z', c: number): boolean => reg.gates.every((gt) => (axis === 'x' ? gt.side % 2 === 0 : gt.side % 2 === 1) ? Math.abs(gt.at - c) >= gateClear : true);

  // ---------------------------------------------------------------- 切り分け
  const leaves: Leaf[] = [];
  const sr = rng.fork('split');
  // 軸ごとに「その向きの大きさ」の目安を決めて切り出す（tx・tz は決まった向きの目安。null はまだ）。
  // 部屋の大きさは x と z でそれぞれ目安の分布に従う（小さい目安ばかりが勝って小部屋だらけにならない）
  const pickSize = (): number => sr.weighted(PATCH_SIZES, ([, w]) => w)[0];
  const leafKind = (r: Rect): LeafKind => (Math.min(r.x1 - r.x0, r.z1 - r.z0) >= hallM ? 'hall' : 'room');
  const split = (r: Rect, tx: number | null, tz: number | null, depth: number): void => {
    const w = r.x1 - r.x0, d = r.z1 - r.z0;
    const long = Math.max(w, d), short = Math.min(w, d);
    // 大きい部屋をそのまま残す（v1 の広間・駐車場・巨大空間）
    if (depth > 0 && short >= hallM && long <= 40 && sr.chance(t['world.patch.keepBig'])) { leaves.push({ rects: [r], kind: 'hall' }); return; }
    const ax = tx ?? pickSize(), az = tz ?? pickSize();
    // 細長すぎる部屋（長い辺が短い辺の world.patch.maxAspect 倍より長い）は、長い向きにもう一度切る（廊下のような部屋ばかりにしない）
    const thin = long >= 2 * minM + 2 && long > short * t['world.patch.maxAspect'];
    const doneX = (w <= ax * 1.3 || w < 2 * minM) && !(thin && w >= d), doneZ = (d <= az * 1.3 || d < 2 * minM) && !(thin && d > w);
    if (doneX && doneZ) { leaves.push({ rects: [r], kind: leafKind(r) }); return; }
    // 切る向き: 決まっていない向き（両方なら長い方）
    const along: 'x' | 'z' = doneX ? 'z' : doneZ ? 'x' : w >= d ? 'x' : 'z';
    const len = along === 'x' ? w : d, other = along === 'x' ? d : w;
    // 通路を切り出す（まっすぐ・L 字の曲がり角・T 字の分かれ道・十字路）。長すぎる矩形（world.patch.corridorMaxM より長い）は
    // 先に切り分けてから、小さくなった所で通路にする（区域の端から端まで続く長い通路ばかりにしない）
    if (len >= 12 && len <= t['world.patch.corridorMaxM'] && other >= 2 * minM + 2.4 && sr.chance(t['world.patch.corridor']) && carveCorridor(r, along, depth)) return;
    // 端から、目安の大きさの部屋の列を切り出す（境目の扉の位置を避ける）。切り出した側はその向きが決まり、残りは引き直す
    const lo = along === 'x' ? r.x0 : r.z0, hi = along === 'x' ? r.x1 : r.z1;
    const tgt0 = along === 'x' ? ax : az;
    const tgt = thin && (along === 'x') === (w >= d) ? Math.min(tgt0, long / 2) : tgt0;
    for (let k = 0; k < 8; k++) {
      const piece = tgt * sr.float(0.85, 1.15);
      const fromLo = sr.chance(0.5);
      const c = snap(fromLo ? lo + piece : hi - piece);
      if (c < lo + minM || c > hi - minM || !cutOk(along, c)) continue;
      const a: Rect = along === 'x' ? { ...r, x1: c } : { ...r, z1: c };
      const b: Rect = along === 'x' ? { ...r, x0: c } : { ...r, z0: c };
      const [cut, rest] = fromLo ? [a, b] : [b, a];
      if (along === 'x') { split(cut, tgt, tz, depth + 1); split(rest, null, tz, depth + 1); }
      else { split(cut, tx, tgt, depth + 1); split(rest, tx, null, depth + 1); }
      return;
    }
    leaves.push({ rects: [r], kind: leafKind(r) });
  };
  /** 通路の形を切り出す（u は長い向き、v は短い向き）。切り出せたら残りの矩形を分けて true */
  function carveCorridor(r: Rect, along: 'x' | 'z', depth: number): boolean {
    const U0 = along === 'x' ? r.x0 : r.z0, U1 = along === 'x' ? r.x1 : r.z1, V0 = along === 'x' ? r.z0 : r.x0, V1 = along === 'x' ? r.z1 : r.x1;
    const R = (u0: number, u1: number, v0: number, v1: number): Rect => (along === 'x' ? { x0: u0, x1: u1, z0: v0, z1: v1 } : { x0: v0, x1: v1, z0: u0, z1: u1 });
    const cutV: 'x' | 'z' = along === 'x' ? 'z' : 'x', cutU: 'x' | 'z' = along;
    const shapes: ['I' | 'L' | 'T' | 'X', number][] = [['I', t['world.patch.shape.straight']], ['L', t['world.patch.shape.bend']], ['T', t['world.patch.shape.branch']], ['X', t['world.patch.shape.cross']]];
    const shape = sr.weighted(shapes, ([, w]) => w)[0];
    const cw = snap(sr.float(2.2, 3.2));
    for (let k = 0; k < 8; k++) {
      const c0 = snap(sr.float(V0 + minM, V1 - minM - cw)), c1 = snap(c0 + cw);
      if (c0 < V0 + minM - 1e-6 || c1 > V1 - minM + 1e-6 || !cutOk(cutV, c0) || !cutOk(cutV, c1)) continue;
      const pieces: Rect[] = [];
      let corr: Rect[];
      if (shape === 'I') {
        corr = [R(U0, U1, c0, c1)];
        pieces.push(R(U0, U1, V0, c0), R(U0, U1, c1, V1));
      } else {
        const uk = snap(sr.float(U0 + minM, U1 - minM - cw)), uk1 = snap(uk + cw);
        if (uk < U0 + minM - 1e-6 || uk1 > U1 - minM + 1e-6 || !cutOk(cutU, uk) || !cutOk(cutU, uk1)) continue;
        // 縦の脚の向き（v の大きい側か小さい側）。S は脚の側の帯、O は反対の帯、E は横の脚と S を合わせた帯
        const up = sr.chance(0.5);
        const S: [number, number] = up ? [c1, V1] : [V0, c0], O: [number, number] = up ? [V0, c0] : [c1, V1], E: [number, number] = up ? [c0, V1] : [V0, c1];
        if (shape === 'L') {
          const fromLo = sr.chance(0.5);
          corr = [fromLo ? R(U0, uk1, c0, c1) : R(uk, U1, c0, c1), R(uk, uk1, S[0], S[1])];
          pieces.push(R(U0, U1, O[0], O[1]));
          if (fromLo) pieces.push(R(U0, uk, S[0], S[1]), R(uk1, U1, E[0], E[1]));
          else pieces.push(R(U0, uk, E[0], E[1]), R(uk1, U1, S[0], S[1]));
        } else if (shape === 'T') {
          corr = [R(U0, U1, c0, c1), R(uk, uk1, S[0], S[1])];
          pieces.push(R(U0, U1, O[0], O[1]), R(U0, uk, S[0], S[1]), R(uk1, U1, S[0], S[1]));
        } else {
          corr = [R(U0, U1, c0, c1), R(uk, uk1, S[0], S[1]), R(uk, uk1, O[0], O[1])];
          pieces.push(R(U0, uk, S[0], S[1]), R(uk1, U1, S[0], S[1]), R(U0, uk, O[0], O[1]), R(uk1, U1, O[0], O[1]));
        }
      }
      leaves.push({ rects: corr, kind: 'corridor' });
      for (const pc of pieces) split(pc, null, null, depth + 1);
      return true;
    }
    return false;
  }
  split({ ...reg.rect }, null, null, 0);

  // ---------------------------------------------------------------- 階段室（部屋の角を切り取る。残りは L 字の部屋）
  const airlocks: RegionAirlockCell[] = [];
  const sealed = new Set<string>();
  const carved: { leaf: Leaf; module: Rect; door: Vec3; side: Dir; aIndex: number }[] = [];
  const ar = rng.fork('airlocks');
  reg.airlocks.forEach((a, ai) => {
    const shape = airlockShape(a.id, t, a.kind);
    const W = shape.width, L = shape.length;
    const sc = [(a.slot[0] + 0.5) * reg.slotM, (a.slot[1] + 0.5) * reg.slotM];
    const inSlot = (lf: Leaf): boolean => { const r = lf.rects[0]!; return sc[0]! >= r.x0 - reg.slotM / 2 && sc[0]! <= r.x1 + reg.slotM / 2 && sc[1]! >= r.z0 - reg.slotM / 2 && sc[1]! <= r.z1 + reg.slotM / 2; };
    const cands = ar.shuffle(leaves.filter((lf) => !lf.module && lf.rects.length === 1 && lf.kind !== 'corridor' && Math.min(lf.rects[0]!.x1 - lf.rects[0]!.x0, lf.rects[0]!.z1 - lf.rects[0]!.z0) >= W + minM && Math.max(lf.rects[0]!.x1 - lf.rects[0]!.x0, lf.rects[0]!.z1 - lf.rects[0]!.z0) >= L + 2.2));
    cands.sort((x, y) => Number(inSlot(y)) - Number(inSlot(x)));
    for (const lf of cands) {
      const r = lf.rects[0]!;
      // 長い辺に沿って、角に。階段室の扉は残りの側（長い辺の内側の向き）
      const alongZ = r.z1 - r.z0 >= r.x1 - r.x0;
      const opts: { m: Rect; rest: Rect[]; door: Vec3; side: Dir }[] = [];
      for (const lowA of [true, false]) for (const lowB of [true, false]) {
        if (alongZ) {
          const x0 = lowA ? r.x0 : snap(r.x1 - W), z0 = lowB ? r.z0 : snap(r.z1 - L);
          const m: Rect = { x0, x1: snap(x0 + W), z0, z1: snap(z0 + L) };
          const strip: Rect = lowB ? { x0: m.x0, x1: m.x1, z0: m.z1, z1: r.z1 } : { x0: m.x0, x1: m.x1, z0: r.z0, z1: m.z0 };
          const big: Rect = lowA ? { ...r, x0: m.x1 } : { ...r, x1: m.x0 };
          opts.push({ m, rest: [big, strip], door: [snap((m.x0 + m.x1) / 2), 0, lowB ? m.z1 : m.z0], side: lowB ? 2 : 0 });
        } else {
          const z0 = lowA ? r.z0 : snap(r.z1 - W), x0 = lowB ? r.x0 : snap(r.x1 - L);
          const m: Rect = { x0, x1: snap(x0 + L), z0, z1: snap(z0 + W) };
          const strip: Rect = lowB ? { x0: m.x1, x1: r.x1, z0: m.z0, z1: m.z1 } : { x0: r.x0, x1: m.x0, z0: m.z0, z1: m.z1 };
          const big: Rect = lowA ? { ...r, z0: m.z1 } : { ...r, z1: m.z0 };
          opts.push({ m, rest: [big, strip], door: [lowB ? m.x1 : m.x0, 0, snap((m.z0 + m.z1) / 2)], side: lowB ? 3 : 1 });
        }
      }
      // 区域の辺の上で境目の扉に掛かる角は使わない
      const onGate = (m: Rect): boolean => reg.gates.some((gt) => {
        const R = reg.rect;
        const edge = gt.side === 0 ? m.z1 === R.z1 : gt.side === 2 ? m.z0 === R.z0 : gt.side === 1 ? m.x1 === R.x1 : m.x0 === R.x0;
        if (!edge) return false;
        const [lo, hi] = gt.side % 2 === 0 ? [m.x0, m.x1] : [m.z0, m.z1];
        return gt.at > lo - gateClear && gt.at < hi + gateClear;
      });
      const pick = ar.shuffle(opts).find((o) => !onGate(o.m) && o.rest.every((x) => x.x1 - x.x0 > 0.5 && x.z1 - x.z0 > 0.5));
      if (!pick) continue;
      lf.rects = pick.rest;
      const ml: Leaf = { rects: [pick.m], kind: 'room', module: true };
      leaves.push(ml);
      carved.push({ leaf: lf, module: pick.m, door: pick.door, side: pick.side, aIndex: ai });
      return;
    }
    throw new GenError(`寄せ集めに階段室を置けません: ${a.id}`);
  });

  // ---------------------------------------------------------------- 部屋（区画）を決める
  const fr = rng.fork('themes');
  const pool = FAMILIES.filter((f) => !f.minRarity || rarityRank(p.rarity) >= rarityRank(f.minRarity));
  const placedOf = new Map<Leaf, Placed>();
  // 壁を接する部屋どうし（扉が付けられる長さ）。隣の部屋と同じ系統を引かない（扉を開けるたびに雰囲気が変わる）
  const touch = (A: Leaf, B: Leaf): boolean => A.rects.some((ra) => B.rects.some((rb) => {
    const xs = Math.min(ra.x1, rb.x1) - Math.max(ra.x0, rb.x0), zs = Math.min(ra.z1, rb.z1) - Math.max(ra.z0, rb.z0);
    return (Math.abs(ra.x1 - rb.x0) < 0.01 || Math.abs(ra.x0 - rb.x1) < 0.01) ? zs >= DOOR_W + 0.6 : (Math.abs(ra.z1 - rb.z0) < 0.01 || Math.abs(ra.z0 - rb.z1) < 0.01) ? xs >= DOOR_W + 0.6 : false;
  }));
  let ri = 0;
  for (const lf of leaves) {
    if (lf.module) continue;
    const big = lf.rects.reduce((a, b) => (area(b) > area(a) ? b : a));
    const near = new Set([...placedOf].filter(([o]) => touch(lf, o)).map(([, pl]) => pl.fam.id));
    let fam: FloorFamily = fr.weighted(pool, (f) => f.weight);
    for (let k = 0; k < 6 && near.has(fam.id); k++) fam = fr.weighted(pool, (f) => f.weight);
    const theme = lf.kind === 'corridor' ? fam.corridor : lf.kind === 'hall' ? fr.weighted(fam.halls, ([, w]) => w)[0] : fr.weighted(fam.rooms, ([, w]) => w)[0];
    const hr = lf.kind === 'corridor' ? fam.corridorHeight : lf.kind === 'hall' ? fam.hallHeight : fam.roomHeight;
    let height = snap(fr.float(hr[0], hr[1]) + (lf.kind === 'hall' ? Math.min(3, (Math.min(big.x1 - big.x0, big.z1 - big.z0) - hallM) * 0.15) : 0));
    // 部屋ごとの調子（v1 のように、扉の向こうが急に暗い・まぶしい・天井が高い・低い）
    const roll = fr.float(0, 1), hroll = fr.float(0, 1);
    let lightMul = 1;
    if (lf.kind !== 'corridor') {
      if (roll < t['world.patch.dimChance']) lightMul = fr.float(0.3, 0.55);
      else if (roll < t['world.patch.dimChance'] + t['world.patch.brightChance']) lightMul = fr.float(1.25, 1.6);
      if (hroll < t['world.patch.tallChance']) height = snap(height + fr.float(1.5, 3.5));
      else if (lf.kind === 'room' && hroll < t['world.patch.tallChance'] + t['world.patch.lowChance']) height = snap(fr.float(2.3, 2.5));
    }
    const id = `p${ri++}`;
    const pl: Placed = {
      node: node(ri), rect: { x0: Math.min(...lf.rects.map((x) => x.x0)), x1: Math.max(...lf.rects.map((x) => x.x1)), z0: Math.min(...lf.rects.map((x) => x.z0)), z1: Math.max(...lf.rects.map((x) => x.z1)) },
      ...(lf.rects.length > 1 ? { rects: lf.rects.map((x) => ({ ...x })) } : {}),
      y: 0, height: Math.max(2.4, height), theme, kind: lf.kind, cellId: id, fam,
      opts: {
        name: lf.kind === 'corridor' ? '廊下' : lf.kind === 'hall' ? '広間' : '部屋', role: lf.kind === 'corridor' ? 'connector' : lf.kind === 'hall' ? 'hub' : 'rest', audio: lf.kind === 'corridor' ? fam.corridorAudio : fam.roomAudio,
        ...(lightMul !== 1 ? { palette: { lightIntensity: themePalette(theme).lightIntensity * lightMul } } : {}),
      },
    };
    placedOf.set(lf, pl);
    g.cell(pl);
  }

  // ---------------------------------------------------------------- つなぎ（壁を接する部屋どうし）
  interface Edge { a: Placed; b: Placed; axis: 'x' | 'z'; coord: number; lo: number; hi: number; dir: Dir }
  const rooms = [...placedOf.values()];
  const edges: Edge[] = [];
  const rectsOf = (pl: Placed): Rect[] => pl.rects ?? [pl.rect];
  for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++) {
    const A = rooms[i]!, B = rooms[j]!;
    let best: Edge | null = null;
    for (const ra of rectsOf(A)) for (const rb of rectsOf(B)) {
      for (const [axis, ca, cb, dir] of [['x', ra.x1, rb.x0, 1], ['x', ra.x0, rb.x1, 3], ['z', ra.z1, rb.z0, 0], ['z', ra.z0, rb.z1, 2]] as const) {
        if (Math.abs(ca - cb) > 0.01) continue;
        const lo = axis === 'x' ? Math.max(ra.z0, rb.z0) : Math.max(ra.x0, rb.x0);
        const hi = axis === 'x' ? Math.min(ra.z1, rb.z1) : Math.min(ra.x1, rb.x1);
        if (hi - lo < DOOR_W + 1.8 && !(hi - lo >= DOOR_W + 0.6 && (A.kind === 'corridor' || B.kind === 'corridor'))) continue;
        if (!best || hi - lo > best.hi - best.lo) best = { a: A, b: B, axis, coord: ca, lo, hi, dir };
      }
    }
    if (best) edges.push(best);
  }
  // 木（ランダムな順に、まだつながっていない組をつなぐ）+ ループ
  const cr = rng.fork('joins');
  const parent = new Map<Placed, Placed>(rooms.map((x) => [x, x]));
  const find = (x: Placed): Placed => { while (parent.get(x) !== x) x = parent.get(x)!; return x; };
  const chosen: Edge[] = [];
  for (const e of cr.shuffle(edges.slice())) {
    const ra = find(e.a), rb = find(e.b);
    if (ra !== rb) { parent.set(ra, rb); chosen.push(e); }
    else if (cr.chance(t['world.patch.loops'])) chosen.push(e);
  }
  if (new Set(rooms.map(find)).size > 1) throw new GenError('寄せ集めの部屋がつながりません');
  // 行き止まりを減らす: 扉が 1 つだけの部屋に、まだ使っていない隣の部屋への扉を足す（同じ所を行き来させない）
  const deg = new Map<Placed, number>(rooms.map((x) => [x, 0]));
  for (const e of chosen) { deg.set(e.a, deg.get(e.a)! + 1); deg.set(e.b, deg.get(e.b)! + 1); }
  const used = new Set(chosen);
  for (const pl of rooms) {
    if (deg.get(pl)! >= 2 || !cr.chance(t['world.patch.deadEndFix'])) continue;
    const extra = edges.filter((e) => !used.has(e) && (e.a === pl || e.b === pl)).sort((x, y) => deg.get(x.a === pl ? x.b : x.a)! - deg.get(y.a === pl ? y.b : y.a)!)[0];
    if (!extra) continue;
    used.add(extra);
    chosen.push(extra);
    deg.set(extra.a, deg.get(extra.a)! + 1); deg.set(extra.b, deg.get(extra.b)! + 1);
  }
  for (const e of chosen) {
    // 開口（扉なし）は同じ系統の部屋どうしだけ（雰囲気が違えば扉。geometry.ts の moodDoors も同じ決まり）
    const open = !(e.a.kind === 'corridor' && e.b.kind === 'corridor') && e.a.fam === e.b.fam && cr.chance(t['world.patch.openChance']);
    const width = open ? snap(Math.min(3.0, e.hi - e.lo - 1.8, Math.max(1.4, (e.hi - e.lo) * 0.3))) : DOOR_W;
    const height = open ? snap(Math.min(2.6, e.a.height - 0.2, e.b.height - 0.2)) : DOOR_H;
    const m = Math.min(0.9, (e.hi - e.lo - width) / 2 - 0.05);
    const at = snap(cr.float(e.lo + m + width / 2, e.hi - m - width / 2));
    const pos: Vec3 = e.axis === 'x' ? [e.coord, 0, at] : [at, 0, e.coord];
    const back = ((e.dir + 2) % 4) as Dir;
    g.addOpening(e.a.cellId, opening(`${e.a.cellId}:${e.b.cellId}`, pos, e.dir, width, height));
    g.addOpening(e.b.cellId, opening(`${e.b.cellId}:${e.a.cellId}`, pos, back, width, height));
    const host = cr.chance(0.5) ? e.a : e.b;
    g.join(e.a.cellId, e.b.cellId, e.axis, e.coord, at, 0, width, height, e.dir, open ? null : { cell: host.cellId, mat: themePalette(host.theme).door, swing: cr.chance(0.5) ? 1 : -1 });
  }

  // ---------------------------------------------------------------- 階段室を置く
  for (const c of carved) {
    const a = reg.airlocks[c.aIndex]!;
    const host = placedOf.get(c.leaf)!;
    const shape = airlockShape(a.id, t, a.kind);
    const anchor = airlockAnchor(a.role, c.door, c.side, shape);
    const cellId = `air${c.aIndex}`;
    const pa = placeAirlock(a.id, a.role, cellId, host.cellId, anchor, shape, a.to, t['world.airlock.closeSec'], t);
    g.addOpening(host.cellId, pa.hostOpening);
    g.out.portals.push(pa.portal);
    g.out.entities.push(...pa.entities, ...pa.hostEntities);
    g.keep(host.cellId, hostFront(pa.hostOpening));
    if (pa.exit) g.out.exits.push(pa.exit);
    g.finishers.push((gb) => gb.out.cells.push({ cell: pa.cell, kind: 'stairs', openings: pa.openings, node: -1 }));
    sealed.add(cellId);
    g.reserved.add(cellId);
    airlocks.push({ id: a.id, kind: a.kind, role: a.role, cell: cellId, anchor: pa.anchor, live: pa.live, sealed: pa.sealed, to: a.to, ...(pa.car ? { car: pa.car } : {}) });
  }

  // ---------------------------------------------------------------- 境目の扉（区域の辺の上の部屋の壁に直接）
  const gates: RegionGateCell[] = [];
  reg.gates.forEach((gt, gi) => {
    const d = gt.side, B = gt.line, u = gt.at;
    const host = rooms.find((pl) => rectsOf(pl).some((r) => {
      const on = d === 0 ? Math.abs(r.z1 - B) < 0.01 : d === 2 ? Math.abs(r.z0 - B) < 0.01 : d === 1 ? Math.abs(r.x1 - B) < 0.01 : Math.abs(r.x0 - B) < 0.01;
      const [lo, hi] = d % 2 === 0 ? [r.x0, r.x1] : [r.z0, r.z1];
      return on && u >= lo + DOOR_W / 2 + WALL_T + 0.05 && u <= hi - DOOR_W / 2 - WALL_T - 0.05;
    }));
    if (!host) throw new GenError(`寄せ集めの境目の扉の部屋がありません: ${gt.id}`);
    const o = opening(`gate${gi}`, d % 2 === 0 ? [u, 0, B] : [B, 0, u], d, DOOR_W, DOOR_H);
    g.addOpening(host.cellId, o);
    gates.push({ id: gt.id, cell: host.cellId, opening: o });
  });

  // ---------------------------------------------------------------- 出てくる位置
  const up = airlocks.find((a) => a.role === 'up' && a.kind !== 'lift') ?? airlocks.find((a) => a.role === 'up');
  if (up) g.out.spawn = airlockSpawn(up, t);
  else if (gates.length) {
    const o = gates[0]!.opening, v = rotQ([0, 0, 1], o.dir);
    g.out.spawn = { pos: [snap(o.pos[0] - v[0] * 1.2), 0.02, snap(o.pos[2] - v[2] * 1.2)], yaw: Math.atan2(v[0], v[2]), cell: gates[0]!.cell };
  } else {
    const r0 = rooms[0]!;
    g.out.spawn = { pos: [snap((r0.rect.x0 + r0.rect.x1) / 2), 0.02, snap((r0.rect.z0 + r0.rect.z1) / 2)], yaw: 0, cell: r0.cellId };
  }
  const down = airlocks.find((a) => a.role === 'down');
  // 隠しの穴から落ちてくる人が着く部屋（天井の穴と縦穴）
  const landings = placeLanding(g, rooms, t);
  placeOpenHoles(g, rooms, t);
  const out = g.finish(null);
  if (down) out.mainTo = down.cell;
  out.region = { gates, airlocks, ...(landings.length ? { landings } : {}) };
  out.sealed = sealed;
  void hashAll;
  return out;
}
