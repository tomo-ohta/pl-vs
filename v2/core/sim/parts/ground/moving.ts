/**
 * 動く床の部品（回る円盤 G19・動く床タイル G18）。
 *
 * - turntable: 軸 center のまわりを回る橋（長さ len・幅 wid・上面が床の高さ）。pause 秒止まっては turn 秒で 90° 回る（dir の向き。時刻から決まる）。
 *     止まっている間は 1 つの箱、回っている間は小さな箱の並び（向きの変わる板を軸に沿った箱で近似）で当たり判定。乗っている人（真ん中の下が
 *     穴の上の橋）を回す。出力 angle・paused・alignX / alignZ（その向きで止まっていて、まだ need 秒より長く止まっている）・
 *     fullTurn（誰かが乗ったまま 1 周した。一度入ったら戻らない）
 * - slideTiles: 升目（cols × rows・大きさ cell）の床板。空いた升目へ、隣の床板が moveSec 秒で滑る（pauseSec 秒おき。乱数は部品の乱数）。
 *     人の近く（1.4 m）の床板は動かさない（乗っている床板は人を乗せたまま動かしてよい）。人が乗っている間は、その人の升目から両岸
 *     （行 0 の手前・行 rows-1 の奥）へ床板がつながる動きだけを選ぶ。出力 connected（両岸がつながっている）・moving
 */
import type { AABB } from '../../../math/aabb.ts';
import type { Json } from '../../../world/layout.ts';
import { definePart, pNum, pVec } from '../../part.ts';

// ---------------------------------------------------------------- 動く床タイル

interface SlideState { occ: number[]; mv: number[]; t: number; wait: number; [k: string]: Json | undefined }

const GAP = 0.03;

/** 升目 j の床板の矩形（間の隙間を空ける）。from → to へ k だけ進んだ位置 */
function tileRect(cells: number[][], from: number, to: number, k: number): AABB {
  const a = cells[from]!, b = cells[to]!;
  const dx = ((b[0]! + b[2]!) - (a[0]! + a[2]!)) / 2 * k, dz = ((b[1]! + b[3]!) - (a[1]! + a[3]!)) / 2 * k;
  return { min: [a[0]! + GAP + dx, 0, a[1]! + GAP + dz], max: [a[2]! - GAP + dx, 0, a[3]! - GAP + dz] };
}

/** 升目の点 (x, z) を含む升目（無ければ -1）。pad だけ広げて見る */
function cellsNear(cells: number[][], x: number, z: number, pad: number): number[] {
  const out: number[] = [];
  cells.forEach((c, j) => { if (x > c[0]! - pad && x < c[2]! + pad && z > c[1]! - pad && z < c[3]! + pad) out.push(j); });
  return out;
}

/** 升目 starts から床板でたどれる岸（1 = 手前・2 = 奥のビット） */
function banksFrom(occ: readonly number[], cols: number, rows: number, starts: number[]): number {
  const seen = new Set<number>();
  const q: number[] = [];
  for (const j of starts) if (occ[j]! >= 0 && !seen.has(j)) { seen.add(j); q.push(j); }
  let banks = 0;
  for (let h = 0; h < q.length; h++) {
    const j = q[h]!, ci = j % cols, rk = Math.floor(j / cols);
    if (rk === 0) banks |= 1;
    if (rk === rows - 1) banks |= 2;
    for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const ni = ci + di, nk = rk + dk;
      if (ni < 0 || nk < 0 || ni >= cols || nk >= rows) continue;
      const n = nk * cols + ni;
      if (occ[n]! >= 0 && !seen.has(n)) { seen.add(n); q.push(n); }
    }
  }
  return banks;
}

definePart<SlideState>({
  type: 'slideTiles',
  outputs: ['connected', 'moving'],
  init(ctx) {
    const occ = [...((ctx.spec.params.occ as number[] | undefined) ?? [])];
    const cells = (ctx.spec.params.cells as number[][] | undefined) ?? [];
    const y = pNum(ctx.spec, 'y', 0);
    occ.forEach((id, j) => { if (id >= 0) { const r = tileRect(cells, j, j, 0); ctx.setCollider(`t${id}`, { min: [r.min[0], y - 0.15, r.min[2]], max: [r.max[0], y, r.max[2]] }); } });
    return { occ, mv: [], t: 0, wait: pNum(ctx.spec, 'pauseSec', 0.6) };
  },
  step(s, ctx) {
    const cells = (ctx.spec.params.cells as number[][] | undefined) ?? [];
    const cols = pNum(ctx.spec, 'cols', 3), rows = pNum(ctx.spec, 'rows', 3);
    const y = pNum(ctx.spec, 'y', 0);
    const moveSec = pNum(ctx.spec, 'moveSec', 1), near = pNum(ctx.spec, 'near', 2);
    const bx0 = Math.min(...cells.map((c) => c[0]!)), bz0 = Math.min(...cells.map((c) => c[1]!)), bx1 = Math.max(...cells.map((c) => c[2]!)), bz1 = Math.max(...cells.map((c) => c[3]!));
    // 動いている床板
    if (s.mv.length) {
      const [id, from, to] = s.mv as [number, number, number];
      const prev = tileRect(cells, from, to, s.t);
      s.t = Math.min(1, s.t + ctx.dt / moveSec);
      const k = s.t * s.t * (3 - 2 * s.t), kp = Math.max(0, s.t - ctx.dt / moveSec);
      const r = tileRect(cells, from, to, k);
      const rp = tileRect(cells, from, to, kp * kp * (3 - 2 * kp));
      ctx.setCollider(`t${id}`, { min: [r.min[0], y - 0.15, r.min[2]], max: [r.max[0], y, r.max[2]] });
      // 乗っている人を運ぶ
      const vx = (r.min[0] - rp.min[0]) / ctx.dt, vz = (r.min[2] - rp.min[2]) / ctx.dt;
      for (const p of ctx.players) if (Math.abs(p.pos[1] - y) < 0.2 && p.pos[0] > prev.min[0] && p.pos[0] < prev.max[0] && p.pos[2] > prev.min[2] && p.pos[2] < prev.max[2]) p.carry = [vx, 0, vz];
      if (s.t >= 1) { s.mv = []; s.t = 0; s.wait = pNum(ctx.spec, 'pauseSec', 0.6); ctx.cue('slide.stop', [(r.min[0] + r.max[0]) / 2, y, (r.min[2] + r.max[2]) / 2]); }
    } else {
      s.wait -= ctx.dt;
      if (s.wait <= 0) {
        // 次に滑る床板: 空いた升目の隣の床板。人の近くの床板は動かさない（乗っている床板は動かしてよい）。
        // 升目の近くにいる人の、たどれる岸が減らない動きだけ
        const near0 = ctx.players.filter((p) => p.pos[0] > bx0 - 1.2 && p.pos[0] < bx1 + 1.2 && p.pos[2] > bz0 - 1.2 && p.pos[2] < bz1 + 1.2 && p.pos[1] > y - 0.5);
        const onBank = (p: (typeof near0)[number]): number => {
          if (cellsNear(cells, p.pos[0], p.pos[2], 0).length) return 0;
          // 手前の岸 = 行 0 の側
          const c0 = cells[0]!, cl = cells[(rows - 1) * cols]!;
          const d0 = Math.hypot(p.pos[0] - (c0[0]! + c0[2]!) / 2, p.pos[2] - (c0[1]! + c0[3]!) / 2), d1 = Math.hypot(p.pos[0] - (cl[0]! + cl[2]!) / 2, p.pos[2] - (cl[1]! + cl[3]!) / 2);
          return d0 < d1 ? 1 : 2;
        };
        const reach = (occ: readonly number[], p: (typeof near0)[number], rideFrom = -1, rideTo = -1): number => {
          let starts = cellsNear(cells, p.pos[0], p.pos[2], 0.5);
          if (rideFrom >= 0 && cellsNear(cells, p.pos[0], p.pos[2], 0).includes(rideFrom)) starts = [rideTo];
          return banksFrom(occ, cols, rows, starts) | onBank(p);
        };
        const cands: [number, number][] = [];
        s.occ.forEach((id, h) => {
          if (id !== -1) return;
          const ci = h % cols, rk = Math.floor(h / cols);
          for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            const ni = ci + di, nk = rk + dk;
            if (ni < 0 || nk < 0 || ni >= cols || nk >= rows) continue;
            const a = nk * cols + ni;
            if (s.occ[a]! < 0) continue;
            const ca = cells[a]!;
            const close = ctx.players.some((p) => {
              const inside = p.pos[0] > ca[0]! && p.pos[0] < ca[2]! && p.pos[2] > ca[1]! && p.pos[2] < ca[3]!;
              const dx = Math.max(ca[0]! - p.pos[0], 0, p.pos[0] - ca[2]!), dz = Math.max(ca[1]! - p.pos[2], 0, p.pos[2] - ca[3]!);
              return !inside && Math.hypot(dx, dz) < near;
            });
            if (close) continue;
            const after = [...s.occ];
            after[h] = after[a]!;
            after[a] = -1;
            if (near0.some((p) => (reach(s.occ, p) & ~reach(after, p, a, h)) !== 0)) continue;
            cands.push([a, h]);
          }
        });
        if (cands.length) {
          const [a, h] = cands[Math.min(cands.length - 1, Math.floor(ctx.random() * cands.length))]!;
          const id = s.occ[a]!;
          s.occ[h] = id;
          s.occ[a] = -1;
          s.mv = [id, a, h];
          s.t = 0;
          const c = cells[a]!;
          ctx.cue('slide.move', [(c[0]! + c[2]!) / 2, y, (c[1]! + c[3]!) / 2]);
        } else s.wait = 0.25;
      }
    }
    // つながり: 止まっている床板だけで両岸がつながるか
    const stable = s.mv.length ? s.occ.map((v, j) => (j === s.mv[1] || j === s.mv[2] ? -1 : v)) : s.occ;
    const starts = [...Array(cols).keys()];
    ctx.output('connected', (banksFrom(stable, cols, rows, starts) & 2) && starts.some((j) => stable[j]! >= 0) ? 1 : 0);
    ctx.output('moving', s.mv.length ? 1 : 0);
  },
});

// ---------------------------------------------------------------- 回る橋

interface TurnState { prev: number; acc: number[]; full: number; wasPaused: number; [k: string]: Json | undefined }

/** 時刻 time の橋の向き（ラジアン）と、止まっているか・止まっている残りの秒 */
export function turnAngle(time: number, c: { pause: number; turn: number; dir: number; offset: number; start: number }): { angle: number; paused: boolean; left: number; axis: number } {
  const period = c.pause + c.turn;
  const x = Math.max(0, time + c.offset);
  const k = Math.floor(x / period);
  const tau = x - k * period;
  const q = Math.PI / 2;
  if (tau < c.pause) {
    const a = c.start * q + c.dir * k * q;
    return { angle: a, paused: true, left: c.pause - tau, axis: (((c.start + k) % 2) + 2) % 2 };
  }
  const f = (tau - c.pause) / c.turn;
  const e = f * f * (3 - 2 * f);
  return { angle: c.start * q + c.dir * (k + e) * q, paused: false, left: 0, axis: -1 };
}

definePart<TurnState>({
  type: 'turntable',
  outputs: ['angle', 'paused', 'alignX', 'alignZ', 'fullTurn'],
  init: () => ({ prev: Number.NaN, acc: [], full: 0, wasPaused: 1 }),
  step(s, ctx) {
    const c3 = pVec(ctx.spec, 'center');
    const len = pNum(ctx.spec, 'len', 5), wid = pNum(ctx.spec, 'wid', 1.4);
    const cfg = { pause: pNum(ctx.spec, 'pause', 4.5), turn: pNum(ctx.spec, 'turn', 5), dir: pNum(ctx.spec, 'dir', 1), offset: pNum(ctx.spec, 'offset', 0), start: pNum(ctx.spec, 'start', 0) };
    const now = turnAngle(ctx.time, cfg);
    const prev = Number.isNaN(s.prev) ? now.angle : s.prev;
    const dA = now.angle - prev;
    s.prev = now.angle;
    const y = c3[1];
    const cx = c3[0], cz = c3[2];
    const ux = Math.cos(now.angle), uz = Math.sin(now.angle);
    // 当たり判定: 止まっていれば 1 つの箱、回っていれば小さな箱の並び
    if (now.paused) {
      const hx = Math.abs(ux) * len / 2 + Math.abs(uz) * wid / 2, hz = Math.abs(uz) * len / 2 + Math.abs(ux) * wid / 2;
      ctx.setCollider('deck', { min: [cx - hx, y - 0.2, cz - hz], max: [cx + hx, y, cz + hz] });
    } else ctx.setCollider('deck', null);
    const n = Math.ceil(len / 0.4) + 1;
    for (let i = 0; i < n; i++) for (let j = -1; j <= 1; j++) {
      const key = `p${i}_${j}`;
      if (now.paused) { ctx.setCollider(key, null); continue; }
      const a = -len / 2 + 0.25 + (i * (len - 0.5)) / (n - 1), b = j * 0.45;
      const px = cx + ux * a - uz * b, pz = cz + uz * a + ux * b;
      const box: AABB = { min: [px - 0.25, y - 0.2, pz - 0.25], max: [px + 0.25, y, pz + 0.25] };
      ctx.setCollider(key, box);
    }
    // 乗っている人を回す（真ん中の下が、穴の上の橋の範囲）
    const radius = pNum(ctx.spec, 'radius', len / 2 - 0.4) + 0.05;
    const cosd = Math.cos(dA), sind = Math.sin(dA);
    ctx.players.forEach((p, i) => {
      const rx = p.pos[0] - cx, rz = p.pos[2] - cz;
      const along = rx * ux + rz * uz, across = -rx * uz + rz * ux;
      const on = Math.abs(p.pos[1] - y) < 0.2 && Math.abs(along) <= len / 2 && Math.abs(across) <= wid / 2 + 0.05 && Math.hypot(rx, rz) <= radius;
      if (on && dA !== 0) {
        const nx = rx * cosd - rz * sind, nz = rx * sind + rz * cosd;
        p.carry = [(nx - rx) / ctx.dt, 0, (nz - rz) / ctx.dt];
      }
      // 乗ったまま回った角度（降りたら 0 から）
      s.acc[i] = on ? (s.acc[i] ?? 0) + dA : 0;
      if (Math.abs(s.acc[i]!) >= Math.PI * 2 - 1e-3 && !s.full) { s.full = 1; ctx.cue('turn.full', [cx, y + 1, cz]); }
    });
    if (now.paused && !s.wasPaused) ctx.cue('turn.stop', [cx, y, cz]);
    if (!now.paused && s.wasPaused) ctx.cue('turn.start', [cx, y, cz]);
    s.wasPaused = now.paused ? 1 : 0;
    const need = pNum(ctx.spec, 'need', 2.4);
    ctx.output('angle', now.angle);
    ctx.output('paused', now.paused ? 1 : 0);
    ctx.output('alignX', now.paused && now.axis === 0 && now.left >= need ? 1 : 0);
    ctx.output('alignZ', now.paused && now.axis === 1 && now.left >= need ? 1 : 0);
    ctx.output('fullTurn', s.full);
  },
});
