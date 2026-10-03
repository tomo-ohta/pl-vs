/**
 * 深い溝・穴を渡る部屋（4 種）。部屋の形は pit.ts（崩れる床・細い梁の網と同じ）: 部屋の床ほぼ全体が深い穴で、開口の前だけ固い床。
 * 穴は底の見えない落ちる穴（14 章）: 落ちたら 1 つ下の階へ。隠し: 運よく下の細い足場に落ちれば、その先の壁の扉（存在型）
 *
 * - trapdoorFloor 抜ける床 [M43]: 床一面の床板。しゃがみ歩きより速く動くと軋んで、すぐ蝶番で開いて下へ落ちる。跳んで着地しても、
 *     上で立ち止まっても開く: しゃがんで、止まらずに渡る（崩れる床 crumbleFloor の逆: こちらは「急ぐと落ちる」）。
 *     ふつうに歩くと落ちる。入口の床の脇に「静かに」の札
 * - ghostBridge 見えない足場 [M44]: 見えない足場（描かない当たり判定）が曲がりくねって向こう岸へ続く。足場の上にだけ埃が積もっている。
 *     行き止まりの枝もある
 * - swayBridge 吊り橋 [M15]: 細い吊り橋。歩くと横に揺れ、揺れは速く歩くほど大きい（走ると振り落とされる）。立ち止まると収まる
 * - pendulumHall 振り子の通路 [QR M39]: 溝を渡る橋の上を、天井から下がった大きな板が横に揺れる。当たると橋の外へ弾かれる。
 *     隠し（出現型 pendulum.ride）: 振り子の板に跳び乗ってしばらく乗っていると、溝の底の扉が開く
 *     （本来の案は「振り子の届く高い棚」。隠し扉の高さ 2.1 m が天井に収まらないので、溝の底の扉にした）
 */
import type { Rect } from '../../../world/footprint.ts';
import { box, kinded } from '../../../world/layout.ts';
import { carveMaze, edgeKey, gridNeighbors, mazePath } from '../maze.ts';
import { addSoffit, buildPit, farSideSecret, pitSecret, planPit, type PitPlan } from '../pit.ts';
import { defineGimmick, type GimmickContext } from '../types.ts';
import { fillRects } from '../util.ts';
import { stripsFits } from './common.ts';
import { botHint, type BotStepSpec } from '../ground/common.ts';


/** 穴の部屋の共通: 計画・穴・底の隠し */
function chasm(ctx: GimmickContext, strips: boolean, hook: string, tell: string): PitPlan | null {
  const plan = planPit(ctx, { depth: ctx.tuning['move.chasm.depthM'], strips, preferAlongEntry: !strips, drop: true });
  if (!plan) return null;
  buildPit(ctx, plan);
  const offer = pitSecret(ctx, plan, hook, tell);
  if (offer) ctx.offerSecret(offer);
  return plan;
}

/**
 * 矩形 r の縁のうち、部屋の壁（hole の縁）にも、ほかの固い床（solid）にも接していない所に、手すり（高さ 0.95 m の当たる箱）
 */
function railAround(ctx: GimmickContext, r: Rect, solid: Rect[], hole: Rect): void {
  const y = ctx.slot.cell.floorY;
  const e = 0.02, T = 0.06;
  const edges: { x0: number; z0: number; x1: number; z1: number }[] = [
    { x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z0 + T }, { x0: r.x0, z0: r.z1 - T, x1: r.x1, z1: r.z1 },
    { x0: r.x0, z0: r.z0, x1: r.x0 + T, z1: r.z1 }, { x0: r.x1 - T, z0: r.z0, x1: r.x1, z1: r.z1 },
  ];
  const onWall = [Math.abs(r.z0 - hole.z0) < e, Math.abs(r.z1 - hole.z1) < e, Math.abs(r.x0 - hole.x0) < e, Math.abs(r.x1 - hole.x1) < e];
  edges.forEach((g, i) => {
    if (onWall[i]) return;
    // ほかの固い床に接する所は開ける（入口の床から階段へ下りる口）
    const touching = solid.filter((q) => q.x0 < g.x1 + e && q.x1 > g.x0 - e && q.z0 < g.z1 + e && q.z1 > g.z0 - e);
    const along = i < 2 ? 'x' : 'z';
    let segs: [number, number][] = [along === 'x' ? [g.x0, g.x1] : [g.z0, g.z1]];
    for (const q of touching) {
      // 固い床の角から 0.45 m は開ける（角すれすれを回る道で、手すりの端に体が掛からない）
      const [a, b] = along === 'x' ? [q.x0 - 0.45, q.x1 + 0.45] : [q.z0 - 0.45, q.z1 + 0.45];
      segs = segs.flatMap(([p, s]) => (b <= p || a >= s ? [[p, s] as [number, number]] : [[p, Math.max(p, a)], [Math.min(s, b), s]] as [number, number][])).filter(([p, s]) => s - p > 0.1);
    }
    for (const [p, s] of segs) {
      const b = along === 'x' ? box([p, y, g.z0], [s, y + 0.95, g.z1], 'metalDark') : box([g.x0, y, p], [g.x1, y + 0.95, s], 'metalDark');
      ctx.addBox(b);
    }
  });
}

/** 橋を渡す横の位置: 階段（plan.lane）から離れた所の真ん中。橋の幅 w + 両側の余裕 side が取れなければ null */
function bridgeU(plan: PitPlan, w: number, side: number): { u: number; lo: number; hi: number } | null {
  const F = plan.frame;
  const lu = [F.u(plan.lane.x0, plan.lane.z0), F.u(plan.lane.x1, plan.lane.z1)].sort((a, b) => a - b) as [number, number];
  const laneLow = lu[0] <= F.u0 + 0.01;
  const lo = laneLow ? lu[1] + 0.3 : F.u0, hi = laneLow ? F.u1 : lu[0] - 0.3;
  if (hi - lo < w + 2 * side) return null;
  return { u: (lo + hi) / 2, lo, hi };
}

defineGimmick({
  id: 'trapdoorFloor', name: '抜ける床', axes: ['floor', 'move'], kinds: ['room', 'hall'], minSize: [4.8, 6], minHeight: 2.4, weight: 0.8, intensity: 2, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance && !!s.exit,
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const y = s.cell.floorY;
    const plan = chasm(ctx, false, 'trap.fall', '床板の継ぎ目の下から、かすかに風が上がってくる');
    if (!plan) return;
    // 床板: 穴の上の空いた所を、大きさ tileM の升目に切る。普通の床と同じ材質（継ぎ目だけが違う）
    const M = t['move.chasm.tileM'];
    const gap = 0.025;
    let i = 0;
    for (const r of fillRects(plan.hole, plan.solidTop)) {
      const nx = Math.max(1, Math.round((r.x1 - r.x0) / M)), nz = Math.max(1, Math.round((r.z1 - r.z0) / M));
      for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) {
        const x0 = r.x0 + ((r.x1 - r.x0) * a) / nx, x1 = r.x0 + ((r.x1 - r.x0) * (a + 1)) / nx;
        const z0 = r.z0 + ((r.z1 - r.z0) * b) / nz, z1 = r.z0 + ((r.z1 - r.z0) * (b + 1)) / nz;
        ctx.addEntity(`t${i++}`, { type: 'trapTile', params: { box: { min: [x0 + gap, y - 0.1, z0 + gap], max: [x1 - gap, y, z1 - gap] }, mat: s.cell.palette.floor, speed: t['move.chasm.trapSpeed'], creakSec: t['move.chasm.trapCreakSec'], stillSec: t['move.chasm.trapStillSec'], openSec: t['move.chasm.trapOpenSec'], hinge: (a + b) % 2 } });
      }
    }
    // 到達判定では床板を床として扱う（ゆっくりなら上を歩ける）
    for (const r of fillRects(plan.hole, plan.solidTop)) ctx.reachAssist(box([r.x0, y - 0.1, r.z0], [r.x1, y, r.z1], s.cell.palette.floor));
    // 戻る階段の手すり: 床板と接する縁（階段の口へ床板から落ちず、入口の床から下りる）
    if (!plan.drop) railAround(ctx, plan.lane, plan.solidTop.filter((r) => r !== plan.lane), plan.hole);
    const F = plan.frame;
    // 歩く人（試験）: 入口の床の縁から、しゃがんでまっすぐ出口の床の縁へ（出口が横の壁なら、角で曲がる）
    {
      const landD = t['gimmick.pit.landingM'];
      const P = (u: number, v: number): [number, number, number] => { const [x, z] = F.point(u, v); return [x, y, z]; };
      const ex = s.exit!.pos, en = s.entrance!.pos;
      const eu0 = F.u(en[0], en[2]);
      const xu = F.u(ex[0], ex[2]), xv = F.v(ex[0], ex[2]);
      const opposite = xv > F.depth - 0.5;
      // 出口の床の縁の点（向かいの壁: 出口の床の手前 / 横の壁: 出口の前の床の縁）
      const path: [number, number, number][] = opposite
        ? [P(eu0, landD - 0.3), P(eu0, landD + 0.1), P(xu, F.depth - landD - 0.1), P(xu, F.depth - landD + 0.3)]
        : (() => { const side = xu < (F.u0 + F.u1) / 2 ? F.u0 + landD : F.u1 - landD, out = xu < (F.u0 + F.u1) / 2 ? side - 0.4 : side + 0.4; return [P(eu0, landD - 0.3), P(eu0, landD + 0.1), P(eu0, xv), P(side, xv), P(out, xv)]; })();
      const cross = (pts: [number, number, number][]): BotStepSpec[] => pts.map((p, k) => (k === 0 ? { at: p } : { at: p, through: true }));
      ctx.addEntity('route', { type: 'constant', params: { value: 0, bot: [botHint(cross(path), { enterAt: [en[0], en[2]], exitAt: [ex[0], ex[2]] }), botHint(cross(path.slice().reverse()), { enterAt: [ex[0], ex[2]], exitAt: [en[0], en[2]] })] } });
    }
    // 「静かに」の札（入口の床の脇の壁）
    const e = plan.entry;
    const eu = [F.u(e.x0, e.z0), F.u(e.x1, e.z1)].sort((p, q) => p - q) as [number, number];
    const signU = (eu[0] + eu[1]) / 2 + (eu[1] - eu[0]) * 0.32;
    const sr = F.rect(signU - 0.22, 0, signU + 0.22, 0.03);
    ctx.addBox(kinded([sr.x0, y + 1.45, sr.z0], [sr.x1, y + 1.75, sr.z1], 'signPlate', 'sign:noRunning', false));
    ctx.keepOut({ min: [plan.hole.x0, y - plan.depth, plan.hole.z0], max: [plan.hole.x1, y + 3, plan.hole.z1] });
  },
});

defineGimmick({
  id: 'ghostBridge', name: '見えない足場', axes: ['floor', 'sight'], kinds: ['room', 'hall'], minSize: [4.8, 6.4], minHeight: 2.4, weight: 1.1, intensity: 2, offersSecret: true, onMainPath: true,
  fits: stripsFits,
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const y = s.cell.floorY;
    const plan = planPit(ctx, { depth: t['move.chasm.depthM'], strips: true, drop: true });
    if (!plan) return;
    const F = plan.frame;
    const landD = t['gimmick.pit.landingM'];
    const C = t['move.chasm.ghostCellM'];
    // 足場の格子: 階段の列を除いた横の範囲 × 入口の床と出口の床の間
    const lu = [F.u(plan.lane.x0, plan.lane.z0), F.u(plan.lane.x1, plan.lane.z1)].sort((a, b) => a - b) as [number, number];
    const u0 = lu[0] <= F.u0 + 0.01 ? lu[1] + 0.35 : F.u0, u1 = lu[0] <= F.u0 + 0.01 ? F.u1 : lu[0] - 0.35;
    const v0 = landD, v1 = F.depth - landD;
    const nx = Math.floor((u1 - u0) / C), nz = Math.floor((v1 - v0) / C);
    if (nx < 2 || nz < 2) return;
    const ou = u0 + (u1 - u0 - nx * C) / 2, ov = v0 + (v1 - v0 - nz * C) / 2;
    const rng = ctx.rng.fork('ghost');
    const start = rng.int(0, nx - 1), goal = (nz - 1) * nx + rng.int(0, nx - 1);
    const open = carveMaze(nx, nz, start, rng);
    const route = mazePath(nx, nz, open, start, goal);
    if (!route) return;
    // 道 + 行き止まりの枝を少し（道の升目から 1〜2 升）
    const cells = new Set(route);
    for (const c of rng.shuffle([...route])) {
      if (cells.size >= route.length + Math.max(2, Math.round(route.length * 0.3))) break;
      let cur = c;
      for (let k = 0; k < 2; k++) {
        const next = gridNeighbors(nx, nz, cur).filter((m) => open.has(edgeKey(cur, m)) && !cells.has(m));
        if (!next.length) break;
        cur = rng.pick(next);
        cells.add(cur);
      }
    }
    buildPit(ctx, plan);
    // 入口の床から最初の升、最後の升から出口の床までは床の縁がそのまま続く（升目の端を床の縁まで延ばす）
    const rects: Rect[] = [];
    for (const c of cells) {
      const i = c % nx, k = Math.floor(c / nx);
      const va = k === 0 ? landD - 0.05 : ov + k * C, vb = k === nz - 1 ? F.depth - landD + 0.05 : ov + (k + 1) * C;
      const r = F.rect(ou + i * C, va, ou + (i + 1) * C, vb);
      rects.push(r);
      ctx.addBox(kinded([r.x0, y - 0.12, r.z0], [r.x1, y, r.z1], s.cell.palette.floor, 'colliderOnly', true));
    }
    ctx.addEntity('dust', { type: 'dustCover', params: { rects: rects.map((r) => ({ x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z1 })), y, seed: ctx.rng.int(1, 1e6) } });
    const offer = pitSecret(ctx, plan, 'ghost.fall', '埃の積もった足場の下だけ、底の灯りがぼやける');
    if (offer) ctx.offerSecret(offer);
    ctx.keepOut({ min: [plan.hole.x0, y - plan.depth, plan.hole.z0], max: [plan.hole.x1, y + 3, plan.hole.z1] });
  },
});

defineGimmick({
  id: 'swayBridge', name: '吊り橋', axes: ['floor', 'body'], kinds: ['room', 'hall'], minSize: [4.2, 6.4], minHeight: 2.4, weight: 1.1, intensity: 2, offersSecret: true, onMainPath: true,
  fits: stripsFits,
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const y = s.cell.floorY;
    const plan = planPit(ctx, { depth: t['move.chasm.depthM'], strips: true, drop: true });
    if (!plan) return;
    const F = plan.frame;
    const landD = t['gimmick.pit.landingM'];
    const w = t['move.chasm.bridgeW'];
    const b = bridgeU(plan, w, 0.5);
    if (!b) return;
    buildPit(ctx, plan);
    const r = F.rect(b.u - w / 2, landD, b.u + w / 2, F.depth - landD);
    const alongX = Math.abs(r.x1 - r.x0) > Math.abs(r.z1 - r.z0);
    ctx.addEntity('bridge', { type: 'swayBridge', params: { rect: { x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z1 }, y, axis: alongX ? 0 : 2, gain: t['move.chasm.swayGain'], maxDeg: t['move.chasm.swayMaxDeg'], push: t['move.chasm.swayPush'], mat: 'floorWood' } });
    ctx.reachAssist(box([r.x0, y - 0.1, r.z0], [r.x1, y, r.z1], 'floorWood'));
    // 両岸の柱（綱を張る）
    for (const v of [landD - 0.12, F.depth - landD + 0.12]) for (const side of [-1, 1]) {
      const u = b.u + side * (w / 2 + 0.06);
      const p = F.rect(u - 0.06, v - 0.06, u + 0.06, v + 0.06);
      ctx.addBox(box([p.x0, y, p.z0], [p.x1, y + 1.15, p.z1], 'woodPanel', true));
    }
    const offer = pitSecret(ctx, plan, 'sway.fall', '橋の下の底に、落ちた人の靴が片方');
    if (offer) ctx.offerSecret(offer);
    ctx.keepOut({ min: [plan.hole.x0, y - plan.depth, plan.hole.z0], max: [plan.hole.x1, y + 3, plan.hole.z1] });
  },
});

defineGimmick({
  id: 'pendulumHall', name: '振り子の通路', axes: ['floor', 'move'], kinds: ['room', 'hall'], minSize: [5.3, 6.6], minHeight: 2.6, weight: 1.2, intensity: 2, offersSecret: true, onMainPath: true,
  fits: stripsFits,
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const y = s.cell.floorY;
    // 固い床どうしが跳んで届くなら、振り子の払う所の外にだけ低い下がり壁（払う所を跳ぶ人は振り子に払われる）
    const plan = planPit(ctx, { depth: t['move.chasm.depthM'], strips: true, drop: true, soffit: 'manual' });
    if (!plan) return;
    const F = plan.frame;
    const landD = t['gimmick.pit.landingM'];
    const w = t['move.chasm.walkW'];
    const bobHalf = [0.14, 0.5, 0.48];
    // 振り子が橋を端から端まで払い、階段や壁に届かない幅
    const need = w / 2 + 0.4 + bobHalf[2]!;
    const b = bridgeU(plan, w, need + bobHalf[2]! + 0.1 - w / 2);
    if (!b) return;
    const reach = Math.min(b.u - b.lo, b.hi - b.u) - bobHalf[2]! - 0.1;
    if (reach < need) return;
    const L0 = landD, L1 = F.depth - landD;
    const pitch = t['move.chasm.pendulumPitch'];
    const count = Math.floor((L1 - L0 - 0.8) / pitch);
    if (count < 1) return;
    buildPit(ctx, plan);
    // 橋（固い）
    const br = F.rect(b.u - w / 2, L0, b.u + w / 2, L1);
    // 細い橋（体の真ん中が上にあるときだけ乗れる。振り子に押されると落ちる）
    const bridge = box([br.x0, y - 0.18, br.z0], [br.x1, y, br.z1], 'metal');
    bridge.narrow = true;
    ctx.addBox(bridge);
    const h = s.cell.height;
    const pivotY = y + h - 0.08;
    const bobY = 0.95; // 一番下での板の真ん中（橋の上から）
    const len = pivotY - (y + bobY);
    const amp = Math.asin(Math.min(0.95, reach / len));
    if (plan.soffit === 'manual') {
      const sweep = len * Math.sin(amp) + bobHalf[2]! + 0.1;
      addSoffit(ctx, plan.hole, F.rect(b.u - sweep, -1, b.u + sweep, F.depth + 1));
    }
    const swing = (() => { const a = F.point(0, 0), c = F.point(1, 0); return [c[0] - a[0], 0, c[1] - a[1]]; })();
    const along = (() => { const a = F.point(0, 0), c = F.point(0, 1); return [c[0] - a[0], 0, c[1] - a[1]]; })();
    const half = [Math.abs(swing[0]!) * bobHalf[2]! + Math.abs(along[0]!) * bobHalf[0]!, bobHalf[1]!, Math.abs(swing[2]!) * bobHalf[2]! + Math.abs(along[2]!) * bobHalf[0]!];
    const start = L0 + (L1 - L0 - (count - 1) * pitch) / 2;
    const period = t['move.chasm.pendulumPeriod'];
    const ids: string[] = [];
    for (let k = 0; k < count; k++) {
      const v = start + k * pitch;
      const pv = F.point(b.u, v);
      ids.push(ctx.addEntity(`p${k}`, { type: 'pendulum', params: { pivot: [pv[0], pivotY, pv[1]], swing, len, amp, period: period * ctx.rng.float(0.9, 1.1), phase: (k * Math.PI * 2) / 3 + ctx.rng.float(-0.4, 0.4), half, knock: 1.5, lift: 2.6, mat: 'metalDark' } }));
      // 天井の軸受け
      const c = F.rect(b.u - 0.2, v - 0.2, b.u + 0.2, v + 0.2);
      ctx.addBox(box([c.x0, pivotY - 0.06, c.z0], [c.x1, y + h, c.z1], 'metalDark', false));
    }
    // 隠し（出現型）: 振り子の板の上にしばらく乗っている。板に立ったまま振れの端まで行っても頭が天井につかえない高さの部屋だけ
    const topAtEnd = pivotY - len * Math.cos(amp) + bobHalf[1]!;
    if (topAtEnd + 1.75 <= y + h - 0.05) {
      const rideOr = ctx.addEntity('rideAny', { type: 'or', params: {}, inputs: Object.fromEntries(ids.slice(0, 8).map((id, i) => [String.fromCharCode(97 + i), `${id}.ride`])) });
      const rode = ctx.addEntity('rode', { type: 'timer', params: { onDelay: t['move.chasm.rideSec'], offDelay: 0 }, inputs: { in: `${rideOr}.out` } });
      const hold = ctx.addEntity('rodeLatch', { type: 'latch', params: {}, inputs: { set: `${rode}.out` } });
      // 落ちる穴では、出口の床の横の壁の扉（渡った先。振り子に乗ると現れる）
      const bottom = plan.drop ? farSideSecret(plan, 'pendulum.ride', '振り子の板の上に、誰かの足跡') : pitSecret(ctx, plan, 'pendulum.ride', '振り子の板の上に、誰かの足跡');
      if (bottom) ctx.offerSecret({ ...bottom, modes: ['appear'], revealOutput: `${hold}.out` });
    }
    const fall = pitSecret(ctx, plan, 'fall.below', '橋の下から聞こえる環境音・底の灯り');
    if (fall) ctx.offerSecret({ ...fall, weight: 0.8 });
    ctx.keepOut({ min: [plan.hole.x0, y - plan.depth, plan.hole.z0], max: [plan.hole.x1, y + 3, plan.hole.z1] });
  },
});
