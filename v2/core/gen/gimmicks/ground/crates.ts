/**
 * 箱の橋（crateBridge）[QR G07 の作り直し]: 部屋を横切る溝（幅 2 升・深さは箱の高さ）を、箱を押し込んで埋めて渡る。
 *
 * - 手前は升目の床（柱がいくつか）に箱が 2〜3 個。調べると（E / タップ）押した人から離れる向きへ 1 升動く。溝へ押すと落ちて床になる。
 *   同じ列に 2 つ落とせば渡れる（1 つ目の上を押して 2 つ目を奥の升へ）。押し方を間違えて動かせなくなったら、入口の横のボタンで箱が戻る
 * - 溝の上は下がり天井（走って跳んでも溝を越えられない）。溝に落ちたら端の段で手前へ上がる（向こう岸へは上がれない）
 * - 出口の側から来た人: 向こう岸のボタンで、溝を渡す板が伸びる（帰り道）
 * - 行き止まりの部屋では、向こう岸の奥の壁に隠しの扉（crate.across: 存在型 / 出現型 = 溝を渡ると現れる）
 * 解けることは生成のときに確かめる（升目の上の幅優先。押す回数 ground.crate.minPush 以上）。歩く人には解き方の手順を渡す
 * （案は「箱に触れると溝に橋が架かる」。触れるだけでは遊びにならないので、箱を押して溝を埋める小さなパズルにした）
 */
import type { Dir } from '../../../math/vec.ts';
import { box, type Json } from '../../../world/layout.ts';
import { defineGimmick } from '../types.ts';
import { aabbJson } from '../util.ts';
import { botHint, enterAt, entranceFrame, onRectWall, snap, soffit, type BotStepSpec } from './common.ts';
import { cutFloorSlab } from '../util.ts';

/** 升目の盤（手前の nb 行 + 溝の 2 行）。'.' 床 / '#' 柱・段 / 'o' 溝 / 'x' 人は通れるが箱を置かない（溝の段の出口） */
interface Board { nu: number; nb: number; cells: string[]; crates: number[]; start: number }

/** 押す手順: 立つ升・押す箱の升 */
interface Push { stand: number; crate: number }

/** 幅優先で解く（箱は区別しない）。戻り値は押す手順（解けなければ null） */
export function solveCrates(b: Board, maxStates = 60000): Push[] | null {
  const W = b.nu, H = b.nb + 2;
  const at = (i: number): string => b.cells[i] ?? '#';
  const key = (p: number, cr: number[], fill: number[]): string => `${p}|${[...cr].sort((x, y) => x - y).join(',')}|${[...fill].sort((x, y) => x - y).join(',')}`;
  type St = { p: number; cr: number[]; fill: number[]; prev: string | null; push: Push | null };
  const seen = new Map<string, St>();
  const s0: St = { p: b.start, cr: [...b.crates], fill: [], prev: null, push: null };
  const k0 = key(s0.p, s0.cr, s0.fill);
  seen.set(k0, s0);
  const q = [k0];
  const nb = (c: number): number[] => { const i = c % W, k = (c - i) / W; return [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([di, dk]) => (i + di! < 0 || i + di! >= W || k + dk! < 0 || k + dk! >= H ? -1 : c + di! + dk! * W)); };
  const walkable = (c: number, cr: number[], fill: number[]): boolean => c >= 0 && !cr.includes(c) && (at(c) === '.' || at(c) === 'x' || (at(c) === 'o' && fill.includes(c)));
  for (let h = 0; h < q.length && seen.size < maxStates; h++) {
    const st = seen.get(q[h]!)!;
    // 渡れた: 溝の 2 行の同じ列が埋まった
    for (let i = 0; i < W; i++) if (st.fill.includes(b.nb * W + i) && st.fill.includes((b.nb + 1) * W + i)) {
      const out: Push[] = [];
      for (let s: St | undefined = st; s && s.push; s = s.prev ? seen.get(s.prev) : undefined) out.unshift(s.push);
      return out;
    }
    // 人が歩いて行ける升（箱は動かさない）
    const reach = new Set([st.p]);
    const rq = [st.p];
    for (let r = 0; r < rq.length; r++) for (const n of nb(rq[r]!)) if (!reach.has(n) && walkable(n, st.cr, st.fill)) { reach.add(n); rq.push(n); }
    for (const c of st.cr) {
      const ci = c % W, ck = (c - ci) / W;
      for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const si = ci - di, sk = ck - dk, ti = ci + di, tk = ck + dk;
        if (si < 0 || si >= W || sk < 0 || sk >= H || ti < 0 || ti >= W || tk < 0 || tk >= H) continue;
        const sc = si + sk * W, tc = ti + tk * W;
        if (!reach.has(sc)) continue;
        const ch = at(tc);
        if (ch === '#' || ch === 'x' || st.cr.includes(tc)) continue;
        const cr = st.cr.filter((x) => x !== c);
        const fill = [...st.fill];
        if (ch === 'o' && !fill.includes(tc)) fill.push(tc); else cr.push(tc);
        const nk = key(c, cr, fill);
        if (seen.has(nk)) continue;
        seen.set(nk, { p: c, cr, fill, prev: q[h]!, push: { stand: sc, crate: c } });
        q.push(nk);
      }
    }
  }
  return null;
}

defineGimmick({
  id: 'crateBridge', name: '箱の橋', axes: ['floor', 'puzzle'], kinds: ['room', 'hall'], minSize: [4.4, 6.2], minHeight: 2.4, weight: 0.7, intensity: 1, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance && (s.openings.length === 1 || (!!s.exit && s.exit.dir === (s.entrance.dir + 2) % 4)),
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const y = s.cell.floorY;
    const ent = s.entrance!;
    const ex = s.openings.length === 1 ? null : s.exit!;
    if (!s.openings.every((o) => onRectWall(s, o))) return;
    const F = entranceFrame(s);
    const c = t['ground.crate.cellM'];
    const nb = 2;
    const nu = Math.min(7, Math.floor((F.u1 - F.u0 - 0.1) / c));
    if (nu < 4) return;
    const uG0 = snap((F.u0 + F.u1) / 2 - (nu * c) / 2);
    const vG0 = 0.1;
    const vt0 = vG0 + nb * c, vt1 = vt0 + 2 * c;
    if (F.depth - vt1 < (ex ? 1.6 : 1.3)) return;
    for (const o of s.openings) if (o !== ent && o !== ex && F.v(o.pos[0], o.pos[2]) > vt0 - 1.3) return;
    const W = nu, H = nb + 2;
    const cellAt = (a: number, b: number): number => a + b * W;
    const center = (cc: number): [number, number] => F.point(uG0 + ((cc % W) + 0.5) * c, vG0 + (Math.floor(cc / W) + 0.5) * c);
    // 入口の列（入口の前の升は空ける）
    const ua = F.u(ent.pos[0], ent.pos[2]);
    const aEnt = Math.min(W - 1, Math.max(0, Math.floor((ua - uG0) / c)));
    // 溝の段（手前の溝の行の端の列。向こう岸へは上がれない）
    const stairCol = aEnt < W / 2 ? W - 1 : 0;
    // 盤を作って解く（柱・箱の置き方を何度か試す）
    let board: Board | null = null, sol: Push[] | null = null;
    const rng = ctx.rng.fork('crates');
    for (let tr = 0; tr < 40 && !sol; tr++) {
      const r = rng.fork(tr);
      const cells: string[] = [];
      for (let b = 0; b < H; b++) for (let a = 0; a < W; a++) cells.push(b >= nb ? (a === stairCol ? '#' : 'o') : b === nb - 1 && a === stairCol ? 'x' : '.');
      // 入口の前（入口の列と両隣の、いちばん手前の行）には柱も箱も置かない
      const free = (cc: number): boolean => cells[cc] === '.' && !(Math.floor(cc / W) === 0 && Math.abs((cc % W) - aEnt) <= 1);
      // 柱 1〜2 本
      const nP = r.int(1, 2);
      for (let k = 0; k < nP; k++) { const cc = cellAt(r.int(0, W - 1), r.int(0, nb - 1)); if (free(cc)) cells[cc] = '#'; }
      const nC = r.chance(0.5) ? 3 : 2;
      const crates: number[] = [];
      for (let k = 0; k < 30 && crates.length < nC; k++) { const cc = cellAt(r.int(0, W - 1), r.int(0, nb - 1)); if (free(cc) && !crates.includes(cc)) crates.push(cc); }
      if (crates.length < 2) continue;
      // 溝の段の出口（'x'）から入口の前まで、最初の置き方で箱を押さずに歩ける（溝に落ちた人が、戻すボタンで箱を戻せば必ず出られる）
      const seen = new Set([cellAt(stairCol, nb - 1)]);
      const qq = [...seen];
      for (let h2 = 0; h2 < qq.length; h2++) {
        const cc = qq[h2]!, a = cc % W, b = Math.floor(cc / W);
        for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const na = a + da, nb2 = b + db;
          if (na < 0 || na >= W || nb2 < 0 || nb2 >= nb) continue;
          const n = cellAt(na, nb2);
          if (seen.has(n) || cells[n] === '#' || crates.includes(n)) continue;
          seen.add(n); qq.push(n);
        }
      }
      if (!seen.has(cellAt(aEnt, 0))) continue;
      const bd: Board = { nu: W, nb, cells, crates, start: cellAt(aEnt, 0) };
      const res = solveCrates(bd);
      if (res && res.length >= t['ground.crate.minPush'] && res.length <= t['ground.crate.maxPush']) { board = bd; sol = res; }
    }
    if (!board || !sol) return;
    // 溝: 2 行を壁から壁まで（深さは箱の高さ + 5 cm）
    const h = t['ground.crate.heightM'];
    const depth = h + 0.05;
    const hole = F.rect(F.u0, vt0, F.u1, vt1);
    cutFloorSlab(s, hole);
    s.cell.bounds.min[1] = Math.min(s.cell.bounds.min[1], y - depth - 0.2);
    ctx.addBox(box([hole.x0, y - depth - 0.2, hole.z0], [hole.x1, y - depth, hole.z1], s.cell.palette.floor));
    // 溝の手前と向こうの壁（床板の下。向こうの壁の上には、帰り道の板が滑り出る隙間）
    {
      const rn = F.rect(F.u0, vt0 - 0.15, F.u1, vt0), rf = F.rect(F.u0, vt1, F.u1, vt1 + 0.15);
      ctx.addBox(box([rn.x0, y - depth - 0.2, rn.z0], [rn.x1, y - 0.2, rn.z1], s.cell.palette.wall));
      ctx.addBox(box([rf.x0, y - depth - 0.2, rf.z0], [rf.x1, y - 0.34, rf.z1], s.cell.palette.wall));
    }
    // 溝の段: 手前の溝の行の端の升を 2 段（向こう岸の縁は 0.6 m 上なので上がれない）
    {
      const a0 = uG0 + stairCol * c, a1 = a0 + c;
      const r1 = F.rect(stairCol === 0 ? F.u0 : a0, vt0, stairCol === 0 ? a1 : F.u1, vt0 + c / 2);
      const r2 = F.rect(stairCol === 0 ? F.u0 : a0, vt0 + c / 2, stairCol === 0 ? a1 : F.u1, vt0 + c);
      ctx.addBox(box([r1.x0, y - depth, r1.z0], [r1.x1, y - 0.32, r1.z1], s.cell.palette.floor));
      ctx.addBox(box([r2.x0, y - depth, r2.z0], [r2.x1, y - 0.64, r2.z1], s.cell.palette.floor));
      // 段の向こうの溝の行（箱の入らない升）は、向こう岸の縁を高い壁にしておく（段から向こう岸へ上がれない）
      const r3 = F.rect(stairCol === 0 ? F.u0 : a0, vt0 + c, stairCol === 0 ? a1 : F.u1, vt1);
      ctx.addBox(box([r3.x0, y - depth, r3.z0], [r3.x1, y - 0.64, r3.z1], s.cell.palette.wall));
    }
    // 溝の横の端（盤の外の細い所）は箱が入らないので、段より低い所まで埋める
    for (const [u0, u1] of [[F.u0, uG0], [uG0 + W * c, F.u1]] as const) {
      if (u1 - u0 < 0.02) continue;
      const r = F.rect(u0, vt0, u1, vt1);
      ctx.addBox(box([r.x0, y - depth, r.z0], [r.x1, y - 0.64, r.z1], s.cell.palette.wall));
    }
    // 下がり天井（溝と縁の 0.8 m）
    soffit(ctx, F.rect(F.u0, vt0 - 0.8, F.u1, vt1 + 0.8), t['ground.crate.soffitM']);
    // 柱
    board.cells.forEach((ch, cc) => {
      if (ch !== '#' || Math.floor(cc / W) >= nb) return;
      const [x, z] = center(cc);
      ctx.addBox(box([x - c / 2 + 0.05, y, z - c / 2 + 0.05], [x + c / 2 - 0.05, y + s.cell.height, z + c / 2 - 0.05], 'columnConcrete'));
    });
    // 升目は世界の座標の向きで部品に渡す（x0, z0 は盤の矩形の角）
    const gr = F.rect(uG0, vG0, uG0 + W * c, vG0 + H * c);
    const alongX = F.d % 2 === 0;
    const nx = alongX ? W : H, nz = alongX ? H : W;
    const rows: string[] = [];
    const worldToCell = (i: number, k: number): number => {
      const x = gr.x0 + (i + 0.5) * c, z = gr.z0 + (k + 0.5) * c;
      const a = Math.floor((F.u(x, z) - uG0) / c), b = Math.floor((F.v(x, z) - vG0) / c);
      return cellAt(a, b);
    };
    for (let k = 0; k < nz; k++) { let row = ''; for (let i = 0; i < nx; i++) row += board.cells[worldToCell(i, k)]; rows.push(row); }
    const worldIK = (cc: number): [number, number] => { const [x, z] = center(cc); return [Math.floor((x - gr.x0) / c), Math.floor((z - gr.z0) / c)]; };
    const grid = { x0: gr.x0, z0: gr.z0, c, rows };
    const ids = board.crates.map((_, i) => `${ctx.id}.crate${i}`);
    // 戻すボタン（入口の横の壁）
    const reset = ctx.addEntity('reset', { type: 'button', params: { box: (() => { const p = F.point(Math.min(F.u1 - 0.3, Math.max(F.u0 + 0.3, ua + (ua < (F.u0 + F.u1) / 2 ? 1.0 : -1.0))), 0.04); return aabbJson({ min: [p[0] - 0.1, y + 1.05, p[1] - 0.1], max: [p[0] + 0.1, y + 1.3, p[1] + 0.1] }); })(), mat: 'plasticYellow' } });
    // 溝の段の出口の横の壁にも（溝に落ちて、箱で囲まれた人が戻せるように）
    const sw = stairCol === 0 ? F.u0 : F.u1;
    const sp = F.point(sw + (stairCol === 0 ? 0.04 : -0.04), vt0 - c / 2);
    const reset2 = ctx.addEntity('reset2', { type: 'button', params: { box: aabbJson({ min: [sp[0] - 0.1, y + 1.05, sp[1] - 0.1], max: [sp[0] + 0.1, y + 1.3, sp[1] + 0.1] }), mat: 'plasticYellow' } });
    // 段の出口の升（箱を置かない）の床の印
    { const [mx, mz] = center(cellAt(stairCol, nb - 1)); ctx.addBox(box([mx - c / 2 + 0.08, y, mz - c / 2 + 0.08], [mx + c / 2 - 0.08, y + 0.006, mz + c / 2 - 0.08], 'yellowLine', false)); }
    const mat = ctx.rng.pick(['boxCardboard', 'woodPanel', 'lockerBlue'] as const);
    board.crates.forEach((cc, i) => ctx.addEntity(`crate${i}`, { type: 'crate', params: { grid, start: worldIK(cc), half: c / 2 - 0.06, h, y, peers: ids, mat }, inputs: { reset: { from: [`${reset}.pressed`, `${reset2}.pressed`] } } }));
    // 渡れた（どれかの列の溝の 2 升に箱が落ちた）: 部品の出力から作る論理
    const crossed = ctx.addEntity('crossedZone', { type: 'zoneSensor', params: { aabb: (() => { const r = F.rect(F.u0, vt1 + 0.2, F.u1, Math.min(F.depth, vt1 + 1.4)); return aabbJson({ min: [r.x0, y - 0.1, r.z0], max: [r.x1, y + 2, r.z1] }); })() } });
    const crossedLatch = ctx.addEntity('crossed', { type: 'latch', params: {}, inputs: { set: `${crossed}.in` } });
    // 歩く人: 解き方の手順（立つ升へ歩き、箱を調べて押す）
    const sim = { cr: [...board.crates] };
    const steps: BotStepSpec[] = sol.map((p) => {
      const [sx, sz] = center(p.stand), [bx, bz] = center(p.crate);
      const di = p.crate - p.stand;
      sim.cr = sim.cr.map((x) => (x === p.crate ? p.crate + di : x));
      return { at: [sx, y, sz], look: [bx, y + h * 0.6, bz], wait: 0.6 };
    });
    const hints: Json[] = [botHint(steps, { enterAt: enterAt(ent), doneIf: `${crossedLatch}.out` })];
    // 帰り道: 向こう岸のボタンで、溝を渡す板が伸びる（出口のある部屋だけ）
    if (ex) {
      const ue = F.u(ex.pos[0], ex.pos[2]);
      const ap = Math.min(W - 1, Math.max(0, Math.floor((ue - uG0) / c)));
      const col = ap === stairCol ? (stairCol === 0 ? 1 : W - 2) : ap;
      const u0 = uG0 + col * c + 0.08, u1 = uG0 + (col + 1) * c - 0.08;
      // 板は向こう岸の床の下にしまってあり、溝の上へ滑り出てから床の高さへ上がる
      const plate = F.rect(u0, vt1, u1, vt1 + 2 * c);
      const [dx, dz] = (() => { const a = F.point(0, 0), b = F.point(0, -2 * c); return [b[0] - a[0], b[1] - a[1]]; })();
      // ボタン: 向こう岸の、溝の縁から 0.5 m の柱の上（溝の手前からは届かない）
      const bu = Math.min(Math.max(u1 + 0.45, F.u0 + 0.3), F.u1 - 0.3);
      const btnP = F.point(bu, vt1 + 0.95);
      ctx.addBox(box([btnP[0] - 0.08, y, btnP[1] - 0.08], [btnP[0] + 0.08, y + 0.95, btnP[1] + 0.08], 'metalDark'));
      const btn = ctx.addEntity('plankButton', { type: 'button', params: { box: aabbJson({ min: [btnP[0] - 0.11, y + 0.95, btnP[1] - 0.11], max: [btnP[0] + 0.11, y + 1.12, btnP[1] + 0.11] }), mat: 'plasticRed', range: 1.6, solid: true } });
      const latch = ctx.addEntity('plankOut', { type: 'latch', params: {}, inputs: { set: `${btn}.pressed` } });
      const plank = ctx.addEntity('plank', { type: 'mover', params: { box: aabbJson({ min: [plate.x0, y - 0.32, plate.z0], max: [plate.x1, y - 0.24, plate.z1] }), mat: 'metal', points: [[0, 0, 0], [dx, 0, dz], [dx, 0.32, dz]], speed: 0.9, carry: false }, inputs: { target: `${latch}.out` } });
      const stand = F.point(bu, vt1 + 1.75);
      hints.push(botHint([{ at: [stand[0], y, stand[1]], look: [btnP[0], y + 1.04, btnP[1]], wait: 4 }], { enterAt: enterAt(ex), doneIf: `${plank}.t` }));
    }
    // 行き止まり: 向こう岸の奥の壁に隠し
    if (!ex) {
      const fd = ((F.d + 2) % 4) as Dir;
      const p = F.point(uG0 + (W * c) / 2, F.depth);
      ctx.offerSecret({ hook: 'crate.across', modes: ['present', 'appear'], weight: 1.1, revealOutput: `${crossedLatch}.out`, doorway: { dir: fd, at: fd % 2 === 0 ? p[0] : p[1], y, width: 1.0, height: 2.0 }, tell: '溝の向こうの壁の継ぎ目から、細い風' });
    }
    ctx.addEntity('hints', { type: 'constant', params: { value: 0, bot: hints } });
    const keep = F.rect(F.u0, 0, F.u1, F.depth);
    ctx.keepOut({ min: [keep.x0, y - 2, keep.z0], max: [keep.x1, y + 3, keep.z1] });
  },
});
