/**
 * 一方通行の歩道迷路（beltMaze）[WS M01 の作り直し]: 部屋いっぱいに、柵で仕切った動く歩道の帯を碁盤の目に敷く。
 *
 * - 碁盤の交点が「乗り換えの床」（止まっている床。ここで次の帯を選ぶ）、交点の間が「帯」（一方向に流れる）、
 *   升目の中と使わない辺は柵（跳んでも越えられない高さ）。開口の前は必ず乗り換えの床（扉を開ける間に流されない奥行き）
 * - 帯はダッシュより速い（調整表 gimmick.belt.speed > 5.5 m/s）ので逆には進めない。帯の上の力は跳んでいる間も効く
 *   （帯の範囲を上へ 2.2 m 取る）ので、跳んで逆らうこともできない
 * - 正しい道順は入口の床から出口の床まで。道順の外へ出る帯（間違い）は、どれを選んでも入口の床へ流れ戻る木になっている。
 *   どの床からも入口・出口へ行ける（強連結。閉じ込めない）
 * - 隠し: 道順から遠い壁際の行き止まりの床の壁に扉（存在型 = 最初からある / 出現型 = その床へ流れ込む帯に逆らって歩き続けると現れる）
 */
import type { Dir } from '../../math/vec.ts';
import { PLAYER } from '../../sim/player.ts';
import { box, DOOR_W, type WallOpening } from '../../world/layout.ts';
import { arcKey, beltNet, edgeKey, gridNeighbors, stronglyConnected } from './maze.ts';
import { defineGimmick } from './types.ts';
import { aabbJson, innerRect, padLines, type Span } from './util.ts';

defineGimmick({
  id: 'beltMaze', name: '一方通行の歩道迷路', axes: ['move'], kinds: ['room', 'hall'], minSize: [5.0, 6.6], weight: 1.4, intensity: 2, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance && !!s.exit,
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const y = s.cell.floorY;
    const r = innerRect(s);
    const P = t['gimmick.belt.padM'], PD = t['gimmick.belt.doorPadM'];
    // 開口の前の床（扉の幅 + 両側 0.3 m）を交点の列に必ず含める
    const reqX: Span[] = [], reqZ: Span[] = [];
    for (const o of s.openings) {
      const wallC = o.dir === 0 ? s.rect.z1 : o.dir === 2 ? s.rect.z0 : o.dir === 1 ? s.rect.x1 : s.rect.x0;
      if (Math.abs((o.dir % 2 === 0 ? o.pos[2] : o.pos[0]) - wallC) > 0.3) return;
      const at = o.dir % 2 === 0 ? o.pos[0] : o.pos[2];
      (o.dir % 2 === 0 ? reqX : reqZ).push({ lo: at - o.width / 2 - 0.3, hi: at + o.width / 2 + 0.3 });
    }
    const door = (d: Dir): boolean => s.openings.some((o) => o.dir === d);
    const lines = { pad: P, gapMin: 1.0, gapTarget: t['gimmick.belt.lenM'], gapMax: 3.6 };
    const X = padLines(r.x0, r.x1, reqX, { ...lines, edge: [door(3) ? PD : P, door(1) ? PD : P] });
    const Z = padLines(r.z0, r.z1, reqZ, { ...lines, edge: [door(2) ? PD : P, door(0) ? PD : P] });
    if (!X || !Z || X.length < 2 || Z.length < 2 || X.length * Z.length < 6) return;
    const nx = X.length, nz = Z.length;
    const spanOf = (sp: Span[], v: number): number => sp.findIndex((q) => v >= q.lo - 1e-6 && v <= q.hi + 1e-6);
    const nodeOf = (o: WallOpening): number => {
      if (o.dir % 2 === 0) { const i = spanOf(X, o.pos[0]); return i < 0 ? -1 : (o.dir === 0 ? nz - 1 : 0) * nx + i; }
      const k = spanOf(Z, o.pos[2]);
      return k < 0 ? -1 : k * nx + (o.dir === 1 ? nx - 1 : 0);
    };
    const doorNodes = s.openings.map(nodeOf);
    if (doorNodes.some((c) => c < 0)) return;
    const E = nodeOf(s.entrance!), G = nodeOf(s.exit!);
    if (E === G) return;
    const net = beltNet(nx, nz, E, G, ctx.rng.fork('net'), { blockChance: t['gimmick.belt.blockChance'], minChoices: nx * nz >= 12 ? 2 : 1 });
    if (!net) return;
    const { arcs, route, blocked } = net;
    const all = [...Array(nx * nz).keys()];
    const padRect = (c: number): { x0: number; x1: number; z0: number; z1: number } => { const i = c % nx, k = Math.floor(c / nx); return { x0: X[i]!.lo, x1: X[i]!.hi, z0: Z[k]!.lo, z1: Z[k]!.hi }; };
    /** 隣り合う交点 a, b の間（帯・柵の場所） */
    const between = (a: number, b: number): { x0: number; x1: number; z0: number; z1: number } => {
      const pa = padRect(a), pb = padRect(b);
      return Math.floor(a / nx) === Math.floor(b / nx)
        ? { x0: Math.min(pa.x1, pb.x1), x1: Math.max(pa.x0, pb.x0), z0: pa.z0, z1: pa.z1 }
        : { x0: pa.x0, x1: pa.x1, z0: Math.min(pa.z1, pb.z1), z1: Math.max(pa.z0, pb.z0) };
    };
    // 隠しの行き止まり: 壁際の床（開口の床・道順を除く）で、道順から遠いもの。流れ込む帯 1 本・流れ出る帯 1 本にする
    const onRoute = new Set(route);
    const dist = new Int32Array(nx * nz).fill(-1);
    const q = [...route];
    for (const c of route) dist[c] = 0;
    for (let h = 0; h < q.length; h++) for (const m of gridNeighbors(nx, nz, q[h]!)) if (dist[m]! < 0) { dist[m] = dist[q[h]!]! + 1; q.push(m); }
    let secret: { cell: number; dir: Dir; at: number; inArc: string } | null = null;
    const cands = ctx.rng.shuffle(all.filter((c) => !onRoute.has(c) && !doorNodes.includes(c))).sort((a, b) => dist[b]! - dist[a]!);
    for (const c of cands) {
      const i = c % nx, k = Math.floor(c / nx);
      const pr = padRect(c);
      const walls: [Dir, number, number][] = [];
      if (k === nz - 1) walls.push([0, (pr.x0 + pr.x1) / 2, pr.x1 - pr.x0]);
      if (k === 0) walls.push([2, (pr.x0 + pr.x1) / 2, pr.x1 - pr.x0]);
      if (i === nx - 1) walls.push([1, (pr.z0 + pr.z1) / 2, pr.z1 - pr.z0]);
      if (i === 0) walls.push([3, (pr.z0 + pr.z1) / 2, pr.z1 - pr.z0]);
      const wall = walls.find(([dir, at, w]) => w >= DOOR_W + 0.2 && !s.openings.some((o) => o.dir === dir && Math.abs((dir % 2 === 0 ? o.pos[0] : o.pos[2]) - at) < o.width / 2 + DOOR_W / 2 + 0.6));
      if (!wall) continue;
      // 流れ込む帯・流れ出る帯を 1 本ずつ残し、ほかは柵で塞ぐ（塞いでも閉じ込めないときだけ）
      const ins = [...arcs].filter((a) => a.endsWith(`>${c}`)), outs = [...arcs].filter((a) => a.startsWith(`${c}>`));
      if (!ins.length || !outs.length) continue;
      const keepIn = ins[0]!, keepOut = outs[0]!;
      const trial = new Set(arcs);
      for (const a of [...ins, ...outs]) if (a !== keepIn && a !== keepOut) trial.delete(a);
      if (!stronglyConnected(nx * nz, trial, all)) continue;
      for (const a of [...ins, ...outs]) if (a !== keepIn && a !== keepOut) { arcs.delete(a); const [p, m] = a.split('>').map(Number) as [number, number]; blocked.add(edgeKey(p, m)); }
      secret = { cell: c, dir: wall[0], at: wall[1], inArc: keepIn };
      break;
    }
    // 帯（流れる向きの矢印は描画 views の forceZone 'belt'）。範囲は跳んだ高さまで（跳んで逆らえない）
    const speed = Math.max(t['gimmick.belt.speed'], PLAYER.dash + 0.3);
    for (const a of arcs) {
      const [p, m] = a.split('>').map(Number) as [number, number];
      const rr = between(p, m);
      const pc = padRect(p), mc = padRect(m);
      const vec: [number, number, number] = Math.floor(p / nx) === Math.floor(m / nx) ? [Math.sign(mc.x0 - pc.x0), 0, 0] : [0, 0, Math.sign(mc.z0 - pc.z0)];
      const b = ctx.addBox(box([rr.x0, y, rr.z0], [rr.x1, y + 0.03, rr.z1], 'rubber', false));
      b.kind = 'belt';
      ctx.addEntity(`belt${p}_${m}`, { type: 'forceZone', params: { aabb: aabbJson({ min: [rr.x0, y - 0.1, rr.z0], max: [rr.x1, y + 2.2, rr.z1] }), vector: vec, speed, visual: 'belt' } });
    }
    // 柵: 升目の中と、塞いだ辺（跳んでも越えられない高さ。上に手すり）
    const railH = Math.max(t['gimmick.belt.railH'], 0.95);
    const railMat = ctx.rng.pick(['furnitureDark', 'shelfMetal', 'metalDark'] as const);
    const rail = (x0: number, z0: number, x1: number, z1: number): void => {
      if (x1 - x0 < 1e-3 || z1 - z0 < 1e-3) return;
      ctx.addBox(box([x0, y, z0], [x1, y + railH - 0.05, z1], railMat));
      ctx.addBox(box([x0, y + railH - 0.05, z0], [x1, y + railH, z1], 'rubber'));
    };
    for (let k = 0; k + 1 < nz; k++) for (let i = 0; i + 1 < nx; i++) rail(X[i]!.hi, Z[k]!.hi, X[i + 1]!.lo, Z[k + 1]!.lo);
    for (const c of all) for (const m of gridNeighbors(nx, nz, c)) {
      if (m < c || arcs.has(arcKey(c, m)) || arcs.has(arcKey(m, c))) continue;
      const rr = between(c, m);
      rail(rr.x0, rr.z0, rr.x1, rr.z1);
    }
    if (secret) {
      // 出現型: 行き止まりの床へ流れ込む帯の、床の側の端（0.8 m）に逆らって居続ける（流れに乗って通り過ぎるだけでは 0.15 秒ほど）
      const [p, m] = secret.inArc.split('>').map(Number) as [number, number];
      const rr = between(p, m);
      const pc = padRect(secret.cell);
      const near = Math.floor(p / nx) === Math.floor(m / nx)
        ? (pc.x0 > rr.x0 ? { x0: Math.max(rr.x0, rr.x1 - 0.8), x1: rr.x1 } : { x0: rr.x0, x1: Math.min(rr.x1, rr.x0 + 0.8) })
        : null;
      const nearZ = near ? null : (pc.z0 > rr.z0 ? { z0: Math.max(rr.z0, rr.z1 - 0.8), z1: rr.z1 } : { z0: rr.z0, z1: Math.min(rr.z1, rr.z0 + 0.8) });
      const fx0 = near ? near.x0 : rr.x0, fx1 = near ? near.x1 : rr.x1, fz0 = nearZ ? nearZ.z0 : rr.z0, fz1 = nearZ ? nearZ.z1 : rr.z1;
      const fight = ctx.addEntity('fight', { type: 'dwellSensor', params: { aabb: aabbJson({ min: [fx0, y - 0.1, fz0], max: [fx1, y + 1.0, fz1] }), sec: t['gimmick.belt.fightSec'], still: false, keepProgress: true } });
      ctx.offerSecret({ hook: 'belt.deadEnd', modes: ['present', 'appear'], weight: 1.1, revealOutput: `${fight}.done`, doorway: { dir: secret.dir, at: secret.at, y, width: 1.0, height: 2.0 }, tell: '行き止まりの床だけ、帯の音が遠い' });
    }
    ctx.keepOut({ min: [r.x0, y - 0.1, r.z0], max: [r.x1, y + 3, r.z1] });
  },
});
