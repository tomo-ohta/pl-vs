/**
 * 隠し発見を差し出す仕掛け（6 種）。どれも部屋まるごとが 1 つの遊び（docs/game-design.md 4 章）。
 * - tiltRoom 傾く床: 部屋の床ほぼ全体が傾く板。開口の無い壁の前に物を積み、その後ろに隠し部屋の入口。
 *     存在型 = 入口は最初からあって物に隠れている / 出現型 = 物の 70% をどかすと壁が消える
 * - narrowPath 細い道: 部屋を横切る深い溝を、入口の延長線の細い梁で渡る。落ちると溝の底。溝の中の階段で入口側へ戻る。
 *     隠し: 溝の底の横の壁（fall.below・存在型）
 * - beamNetwork 細い梁の網: 細長い部屋の床全部が深い溝。分かれ目の足場と細い梁の網（行き止まりあり）を渡る。
 *     落ちたら溝の底の階段で入口の床へ戻ってやり直し。隠し: 溝の底の壁（fall.below・存在型）
 * - guideLight 導く光の迷路: 部屋いっぱいの暗い迷路（天井までの仕切り）。光が正しい道を先導する（遅れる・外れると待つ）。
 *     隠し: 光の道から遠い行き止まりの奥（light.ignore。存在型 = 最初からある / 出現型 = 光を無視し続けると現れる）
 * - puzzleRoom 謎のパズル: 行き止まりの部屋。色の付いたボタン 3 つを、壁の色の並び（手がかり）の順に押すと扉が現れる（出現型・必ず付ける）
 * （崩れる床 crumbleFloor は floor.ts、一方通行の歩道迷路 beltMaze は belts.ts。どちらも隠しを差し出す）
 */
import type { Dir } from '../../math/vec.ts';
import type { Rect } from '../../world/footprint.ts';
import { box, DOOR_W, type Box, type MatId } from '../../world/layout.ts';
import { carveMaze, edgeKey, mazePath, openDegree, treeDistance } from './maze.ts';
import { defineGimmick, type GimmickContext } from './types.ts';
import { buildPit, pitInner, pitSecret, pitShell, planPit } from './pit.ts';
import { aabbJson, cutFloorSlab, doorZone, freeWallSpan, frontOf, innerRect, padLines, pitBoxes, rectD, rectW, unreachableSpot } from './util.ts';

const snap = (v: number): number => Math.round(v * 20) / 20;

/** 壁 d の、壁に沿った座標 at・高さ y0..y1 の位置に、壁から内側へ出る薄い箱（ボタン・手がかりの板） */
function onWall(ctx: GimmickContext, d: Dir, at: number, half: number, y0: number, y1: number, depth: number, mat: MatId, solid = false): Box {
  const r = innerRect(ctx.slot);
  const wall = d === 0 ? r.z1 : d === 2 ? r.z0 : d === 1 ? r.x1 : r.x0;
  const sg = d === 0 || d === 1 ? -1 : 1;
  const w0 = Math.min(wall, wall + sg * depth), w1 = Math.max(wall, wall + sg * depth);
  return d === 0 || d === 2 ? box([at - half, y0, w0], [at + half, y1, w1], mat, solid) : box([w0, y0, at - half], [w1, y1, at + half], mat, solid);
}

/** 部屋の照明を消えたままにする */
function darken(ctx: GimmickContext): string {
  const s = ctx.slot;
  const dark = ctx.addEntity('dark', { type: 'lamp', params: { on: false } });
  for (const b of s.cell.boxes) if (b.mat === s.cell.palette.light && !b.solid && b.max[1] - b.min[1] < 0.06) b.kind = `lamp:${dark}`;
  for (const l of s.cell.lights) l.lampId = dark;
  return dark;
}

defineGimmick({
  id: 'tiltRoom', name: '傾く床', axes: ['floor'], kinds: ['room', 'hall'], minSize: [6, 6], weight: 1, intensity: 2, physics: true, offersSecret: true, onMainPath: true,
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    const r0 = innerRect(s);
    // 開口のある壁の側は 1.35 m 空ける（扉の前は普通の床）
    const side = (d: Dir): number => (s.openings.some((o) => o.dir === d) ? 1.35 : 0.05);
    const hole: Rect = { x0: snap(r0.x0 + side(3)), x1: snap(r0.x1 - side(1)), z0: snap(r0.z0 + side(2)), z1: snap(r0.z1 - side(0)) };
    if (rectW(hole) < 4 || rectD(hole) < 4) return;
    // 隠しの壁: 開口の無い壁のうち、穴が壁まで届いている側。入口と直角の壁を選ぶ（入口から出口へまっすぐ歩くだけでは物がどかない。
    // 反対側の壁際へ行って立ち続けると、床がそちらへ傾いて物が滑る）
    const walls = ([0, 1, 2, 3] as const).filter((d) => side(d) < 0.1);
    if (!walls.length) return;
    const across = walls.filter((d) => !s.entrance || d % 2 !== s.entrance.dir % 2);
    const wd = ctx.rng.pick(across.length ? across : walls);
    const span = freeWallSpan(s, wd, 2.6, 0.5);
    if (!span) return;
    cutFloorSlab(s, hole);
    for (const b of pitBoxes(s, hole, 1.2)) ctx.addBox(b);
    const plate: Rect = { x0: hole.x0 + 0.17, x1: hole.x1 - 0.17, z0: hole.z0 + 0.17, z1: hole.z1 - 0.17 };
    // 到達判定では傾く床を平らな床として扱う（傾いても上を歩ける）
    ctx.reachAssist(box([plate.x0, y - 0.2, plate.z0], [plate.x1, y, plate.z1], s.cell.palette.floor));
    // 立てる範囲は穴の壁の内側いっぱい（板との隙間から落ちない）
    const walk: Rect = { x0: hole.x0 + 0.15, x1: hole.x1 - 0.15, z0: hole.z0 + 0.15, z1: hole.z1 - 0.15 };
    // 傾きの最大: 開口の前の普通の床と、板の縁の段差が 0.33 m を超えない（傾いても段を越えて出入りできる）。
    // 浅い傾きでも物が滑るよう、物と板の摩擦は小さく
    const halfMax = Math.max(rectW(walk), rectD(walk)) / 2;
    const maxDeg = Math.min(11, (Math.atan(0.33 / halfMax) * 180) / Math.PI);
    // 物が滑り出す傾き: 最大の slideAt 倍（少し寄っただけでは滑らず、端に立ち続けると滑る）。摩擦は板と物で同じ値（Rapier は平均を使う）
    const mu = Math.tan((ctx.tuning['gimmick.tilt.slideAt'] * maxDeg * Math.PI) / 180);
    ctx.addEntity('plate', { type: 'tiltFloor', params: { rect: { ...plate }, walkRect: { ...walk }, y, thickness: 0.2, maxDeg, rateDeg: 4, returnDeg: 2, mat: ctx.rng.pick(['floorWood', 'floorLino', 'floorTile'] as const), friction: mu } });
    // 万一、板の下に落ちたら入口の前へ
    const back = s.entrance ? frontOf(s.entrance, 0.8) : [(hole.x0 + hole.x1) / 2, y, hole.z0 - 0.8];
    ctx.addEntity('pitBack', { type: 'respawnZone', params: { aabb: aabbJson({ min: [hole.x0, y - 1.25, hole.z0], max: [hole.x1, y - 0.7, hole.z1] }), to: [back[0]!, y + 0.05, back[2]!], toYaw: 0 } });
    // 物の山: 隠しの壁の前（幅 2.4 m・奥行き 1.6 m）。壁際には背の高い棚を 2 つ（入口の上まで隠す。傾けると滑ってどく）
    const at = Math.min(Math.max(span.at, span.a0 + 1.3), span.a1 - 1.3);
    const wall = wd === 0 ? plate.z1 : wd === 2 ? plate.z0 : wd === 1 ? plate.x1 : plate.x0;
    const sg = wd === 0 || wd === 1 ? -1 : 1;
    const along = (a0: number, a1: number, n0: number, n1: number, y0: number, y1: number): { min: number[]; max: number[] } => {
      const w0 = Math.min(wall + sg * n0, wall + sg * n1), w1 = Math.max(wall + sg * n0, wall + sg * n1);
      return wd === 0 || wd === 2 ? { min: [a0, y0, w0], max: [a1, y1, w1] } : { min: [w0, y0, a0], max: [w1, y1, a1] };
    };
    const shelfMat = ctx.rng.pick(['furnitureDark', 'shelfMetal', 'woodPanel'] as const);
    ctx.addEntity('screen', { type: 'propPile', params: { items: [{ ...along(at - 1.08, at - 0.04, 0.06, 0.56, y + 0.02, y + 2.12), mat: shelfMat, kind: 'shelf' }, { ...along(at + 0.04, at + 1.08, 0.06, 0.56, y + 0.02, y + 2.12), mat: shelfMat, kind: 'shelf' }], density: 160, friction: mu } });
    const pileR = along(at - 1.2, at + 1.2, 0.62, 1.7, y + 0.05, y + 1.3);
    const pile = ctx.addEntity('pile', { type: 'propPile', params: { region: { min: pileR.min, max: pileR.max }, count: ctx.rng.int(14, 20), size: [0.32, 0.55], mats: ['boxCardboard', 'furnitureLight', 'plasticBlue', 'boxCardboard'], density: 200, friction: mu, ballRatio: 0.3, layers: 2 } });
    // ほかの所にも少し（転がして遊べる）
    ctx.addEntity('scatter', { type: 'propPile', params: { region: aabbJson({ min: [plate.x0 + 0.5, y + 0.05, plate.z0 + 0.5], max: [plate.x1 - 0.5, y + 0.6, plate.z1 - 0.5] }), count: ctx.rng.int(5, 9), size: [0.25, 0.4], mats: ['boxCardboard', 'plasticRed'], density: 200, friction: mu, ballRatio: 0.5, layers: 1 } });
    const near = along(at - 1.2, at + 1.2, 0, 1.7, y - 0.6, y + 2.5);
    const count = ctx.addEntity('count', { type: 'countSensor', params: { aabb: near, of: pile, belowRatio: 0.3 } });
    ctx.offerSecret({ hook: 'tilt.clearProps', modes: ['present', 'appear'], weight: 1.2, revealOutput: `${count}.below`, doorway: { dir: wd, at, y, width: 1.0, height: 2.0 }, floorY: y - 0.3, tell: '物の隙間から漏れる光' });
    ctx.keepOut({ min: [hole.x0, y - 1.2, hole.z0], max: [hole.x1, y + 3, hole.z1] });
  },
});

/**
 * 細い道: 部屋を横切る深い溝（gimmick.narrow.depthM）を、入口の延長線の細い梁で渡る。落ちると溝の底。
 * 溝の中の階段で入口側へ戻る（閉じ込めない）。階段の下の端の先は 0.9 m 空ける（以前は溝の端まで段が並び、
 * 一段目が奥の壁に突き当たって体が乗れず、底から上れなかった）。溝の両端の壁は部屋の壁の厚みの中（壁沿いの縁を歩いて渡れない）。
 * 隠し: 階段と反対の横の壁の底（fall.below・存在型）
 */
defineGimmick({
  id: 'narrowPath', name: '細い道', axes: ['floor', 'body'], kinds: ['room', 'hall'], minSize: [4, 7], weight: 1.2, intensity: 2, offersSecret: true, onMainPath: true,
  // 入口と出口が向かい合っている（梁が本道を渡る）
  fits: (s) => !!s.entrance && !!s.exit && (s.entrance.dir + 2) % 4 === s.exit.dir,
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const y = s.cell.floorY;
    // 軸は入口の壁に垂直（入口から奥へ）。入口と出口が斜めにずれていても、溝は入口と出口の間を横切る
    const e0 = s.entrance!;
    const axis: 'x' | 'z' = e0.dir === 0 || e0.dir === 2 ? 'z' : 'x';
    // 入口から奥へ進む向き（開口の dir は外向き）
    const sign: 1 | -1 = e0.dir === 0 || e0.dir === 1 ? -1 : 1;
    const r = innerRect(s);
    const len = axis === 'x' ? rectW(r) : rectD(r);
    const L = Math.min(6.0, len - 2 * 1.4);
    if (L < 3.9) return;
    const depth = t['gimmick.narrow.depthM'];
    const mid = axis === 'x' ? (r.x0 + r.x1) / 2 : (r.z0 + r.z1) / 2;
    const hole: Rect = axis === 'x' ? { x0: snap(mid - L / 2), x1: snap(mid + L / 2), z0: r.z0, z1: r.z1 } : { x0: r.x0, x1: r.x1, z0: snap(mid - L / 2), z1: snap(mid + L / 2) };
    // 溝は部屋の端から端まで横切る。横の壁の開口（広間の 3 つ目・4 つ目の出入り口）の前が溝にならないこと（出た途端に落ちない）
    const h0 = axis === 'x' ? hole.x0 : hole.z0, h1 = axis === 'x' ? hole.x1 : hole.z1;
    for (const o of s.openings) {
      if (o.dir % 2 === e0.dir % 2) continue;
      const at = axis === 'x' ? o.pos[0] : o.pos[2];
      if (at + o.width / 2 + 0.8 > h0 && at - o.width / 2 - 0.8 < h1) return;
    }
    // 階段: 段数 n（n + 1 回の段差で床へ上がる）。踏み面は溝の長さから、下の端の先に 0.9 m 残して決める
    const inner = pitInner(ctx, hole);
    const a0 = axis === 'x' ? inner.x0 : inner.z0, a1 = axis === 'x' ? inner.x1 : inner.z1;
    const n = Math.max(1, Math.ceil(depth / t['gimmick.pit.stairRise']) - 1);
    const rise = depth / (n + 1);
    const tread = Math.min(t['gimmick.pit.stairTread'] * 1.4, (a1 - a0 - 0.9) / n);
    if (tread < 0.22) return;
    cutFloorSlab(s, hole);
    pitShell(ctx, hole, depth);
    // 梁: 入口の位置の延長線（幅 0.42〜0.6 m）
    const across = axis === 'x' ? e0.pos[2] : e0.pos[0];
    const bw = ctx.rng.float(0.42, 0.6) / 2;
    ctx.addBox(axis === 'x' ? box([hole.x0, y - 0.15, across - bw], [hole.x1, y, across + bw], 'metal') : box([across - bw, y - 0.15, hole.z0], [across + bw, y, hole.z1], 'metal'));
    // 溝から戻る階段: 梁から遠い横の壁沿い（幅 1.0 m）に、入口側の縁へ上がる。上の段（j = 0）が入口側
    const lo = axis === 'x' ? inner.z0 : inner.x0, hi = axis === 'x' ? inner.z1 : inner.x1;
    const stairSide = Math.abs(across - lo) > Math.abs(across - hi) ? 'lo' : 'hi';
    const c0 = stairSide === 'lo' ? lo : hi - 1.0, c1 = c0 + 1.0;
    const top0 = sign > 0 ? a0 : a1; // 入口側の溝の内側の縁
    for (let j = 0; j < n; j++) {
      const p = top0 + sign * j * tread, q = top0 + sign * (j + 1) * tread;
      const [s0, s1] = [Math.min(p, q), Math.max(p, q)];
      ctx.addBox(axis === 'x' ? box([s0, y - depth, c0], [s1, y - rise * (j + 1), c1], s.cell.palette.floor) : box([c0, y - depth, s0], [c1, y - rise * (j + 1), s1], s.cell.palette.floor));
    }
    // 落ちた先の灯り（底をぼんやり照らす）
    const bx = axis === 'x' ? mid : (lo + hi) / 2, bz = axis === 'x' ? (lo + hi) / 2 : mid;
    s.cell.lights.push({ pos: [bx, y - depth + 1.6, bz], color: 0xbfd0e0, intensity: 0.35, distance: 6 });
    // 隠しの入口: 階段と反対の横の壁の底（存在型）
    const secretSide: Dir = axis === 'x' ? (stairSide === 'lo' ? 0 : 2) : (stairSide === 'lo' ? 1 : 3);
    ctx.offerSecret({ hook: 'fall.below', modes: ['present'], weight: 1.2, doorway: { dir: secretSide, at: mid, y: y - depth, width: 1.0, height: 2.0 }, tell: '下から聞こえる音・底の灯り' });
    // 溝の両側 1.2 m にも家具を置かない（階段の上の端から床へ出る所を塞がない）
    ctx.keepOut(axis === 'x' ? { min: [hole.x0 - 1.2, y - depth, hole.z0], max: [hole.x1 + 1.2, y + 3, hole.z1] } : { min: [hole.x0, y - depth, hole.z0 - 1.2], max: [hole.x1, y + 3, hole.z1 + 1.2] });
  },
});

/**
 * 細い梁の網: 細長い部屋の床全部が深い溝。入口の壁・出口の壁沿いだけ固い床（端から端まで）。
 * 溝の上に分かれ目の足場（細い柱で支える）を碁盤の目に並べ、細い梁でつなぐ。梁は木の形（どの足場へも道は 1 本。
 * 行き止まりがある）に、回り道を少し足す。入口の床から出る梁・出口の床へ渡る梁はそれぞれ 1 本だけ。
 * 落ちたら溝の底の階段（入口の壁の隣の壁沿い）で入口の床へ戻ってやり直し。隠し: 溝の底の壁の扉（fall.below・存在型）
 */
defineGimmick({
  id: 'beamNetwork', name: '細い梁の網', axes: ['floor', 'body'], kinds: ['room', 'hall'], minSize: [5.6, 7.4], weight: 1.2, intensity: 2, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance && !!s.exit && (s.entrance.dir + 2) % 4 === s.exit.dir,
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const y = s.cell.floorY;
    const depth = t['gimmick.narrow.depthM'];
    const plan = planPit(ctx, { depth, strips: true });
    if (!plan) return;
    const F = plan.frame;
    const landD = t['gimmick.pit.landingM'];
    const P = t['gimmick.beams.platformM'];
    const lines = { pad: P, gapMin: 1.0, gapTarget: t['gimmick.beams.gapM'], gapMax: 2.8 };
    // 足場の列（u）: 階段の幅（+0.5 m）を除く
    const lu = [F.u(plan.lane.x0, plan.lane.z0), F.u(plan.lane.x1, plan.lane.z1)].sort((a, b) => a - b) as [number, number];
    const uA = lu[0] <= F.u0 + 0.01 ? lu[1] + 0.5 : F.u0, uB = lu[1] >= F.u1 - 0.01 ? lu[0] - 0.5 : F.u1;
    const cols = padLines(uA, uB, [], lines);
    // 足場の行（v）: 入口・出口の床を両端の足場とみなす。横の壁の開口の前の床へ梁を渡せるよう、その高さに行を通す
    const side = plan.landings.filter((l) => l.o !== s.entrance && l.o !== s.exit);
    const sideReq = side.map((l) => { const v = (F.v(l.rect.x0, l.rect.z0) + F.v(l.rect.x1, l.rect.z1)) / 2; return { lo: v - P / 2, hi: v + P / 2 }; });
    const rows = padLines(0, F.depth, sideReq, { ...lines, edge: [landD, landD] });
    if (!cols || !rows || rows.length < 3) return;
    const R = rows.length - 2, C = cols.length;
    // 網に見えるのは足場が 3 つ以上（2 つでは細い道と同じ）
    if (R * C < 3 || (rows[0]!.hi - landD) > 0.01 || (F.depth - rows[rows.length - 1]!.lo - landD) > 0.01) return;
    // 節: 0 = 入口の床、1 = 出口の床、2.. = 足場（行 r = 1..R、列 c）、その後に横の開口の床
    const E = 0, X = 1;
    const pid = (r: number, c: number): number => 2 + (r - 1) * C + c;
    const N = 2 + R * C + side.length;
    const rectOf: Rect[] = [];
    rectOf[E] = plan.entry; rectOf[X] = plan.exit!;
    for (let r = 1; r <= R; r++) for (let c = 0; c < C; c++) rectOf[pid(r, c)] = F.rect(cols[c]!.lo, rows[r]!.lo, cols[c]!.hi, rows[r]!.hi);
    // 横の開口の床: 同じ行の、壁に近い方の端の足場へつなぐ
    const adj = new Map<number, number[]>();
    const link = (a: number, b: number): void => { adj.set(a, [...(adj.get(a) ?? []), b]); adj.set(b, [...(adj.get(b) ?? []), a]); };
    for (let r = 1; r <= R; r++) for (let c = 0; c < C; c++) { if (c + 1 < C) link(pid(r, c), pid(r, c + 1)); if (r + 1 <= R) link(pid(r, c), pid(r + 1, c)); }
    const ce = ctx.rng.int(0, C - 1), cx = ctx.rng.int(0, C - 1);
    link(E, pid(1, ce)); link(X, pid(R, cx));
    for (let j = 0; j < side.length; j++) {
      const l = side[j]!;
      const v = (F.v(l.rect.x0, l.rect.z0) + F.v(l.rect.x1, l.rect.z1)) / 2;
      const r = rows.findIndex((q, i) => i > 0 && i < rows.length - 1 && v >= q.lo - 1e-6 && v <= q.hi + 1e-6);
      if (r < 0) return;
      const lu0 = Math.min(F.u(l.rect.x0, l.rect.z0), F.u(l.rect.x1, l.rect.z1));
      rectOf[2 + R * C + j] = l.rect;
      link(2 + R * C + j, pid(r, lu0 > (F.u0 + F.u1) / 2 ? C - 1 : 0));
    }
    // 梁: 深さ優先で掘った木（入口の床から）＋回り道を少し
    const tree = new Set<string>();
    const seen = new Uint8Array(N);
    const stack = [E];
    seen[E] = 1;
    const rng = ctx.rng.fork('beams');
    while (stack.length) {
      const a = stack[stack.length - 1]!;
      const next = rng.shuffle((adj.get(a) ?? []).filter((b) => !seen[b] && !(b === X && a !== pid(R, cx))));
      // 出口の床は木の葉にする（出口の床から先へは掘らない）
      if (a === X || !next.length) { stack.pop(); continue; }
      const b = next[0]!;
      seen[b] = 1;
      tree.add(edgeKey(a, b));
      stack.push(b);
    }
    if (!seen[X] || [...seen].some((v) => !v)) return;
    for (let r = 1; r <= R; r++) for (let c = 0; c < C; c++) for (const b of adj.get(pid(r, c)) ?? []) {
      if (b < 2 || b > 1 + R * C || b < pid(r, c) || tree.has(edgeKey(pid(r, c), b))) continue;
      if (rng.chance(t['gimmick.beams.loopChance'])) tree.add(edgeKey(pid(r, c), b));
    }
    // 行き止まり（梁が 1 本だけの足場）があること
    const deg = (a: number): number => (adj.get(a) ?? []).filter((b) => tree.has(edgeKey(a, b))).length;
    const dead = [...Array(R * C).keys()].map((i) => 2 + i).filter((a) => deg(a) === 1);
    if (!dead.length) return;
    // 柱（足場の真ん中の下）。底がつながっているかをもう一度確かめる
    const posts: Rect[] = [];
    for (let i = 0; i < R * C; i++) {
      const q = rectOf[2 + i]!;
      const cxp = (q.x0 + q.x1) / 2, czp = (q.z0 + q.z1) / 2;
      posts.push({ x0: cxp - 0.12, x1: cxp + 0.12, z0: czp - 0.12, z1: czp + 0.12 });
    }
    if (unreachableSpot(plan.hole, [...plan.bottomBlocks, ...posts], plan.foot) !== null) return;
    buildPit(ctx, plan);
    plan.bottomBlocks.push(...posts);
    const bw = t['gimmick.beams.widthM'];
    const platMat = ctx.rng.pick(['metal', 'stainless', 'woodPanel'] as const);
    for (let i = 0; i < R * C; i++) {
      const q = rectOf[2 + i]!;
      ctx.addBox(box([q.x0, y - 0.15, q.z0], [q.x1, y, q.z1], platMat));
      const pr = posts[i]!;
      ctx.addBox(box([pr.x0, y - depth, pr.z0], [pr.x1, y - 0.15, pr.z1], 'metalDark'));
    }
    // 梁: 2 つの節の向かい合う縁の間。横の位置は、足場の側の真ん中（入口・出口・横の床は足場に合わせる）
    for (const k of tree) {
      const [a, b] = k.split('-').map(Number) as [number, number];
      const plat = a >= 2 && a < 2 + R * C ? a : b;
      const other = plat === a ? b : a;
      const pa = rectOf[plat]!, pb = rectOf[other]!;
      const ua = [F.u(pa.x0, pa.z0), F.u(pa.x1, pa.z1)].sort((p, q) => p - q), va = [F.v(pa.x0, pa.z0), F.v(pa.x1, pa.z1)].sort((p, q) => p - q);
      const ub = [F.u(pb.x0, pb.z0), F.u(pb.x1, pb.z1)].sort((p, q) => p - q), vb = [F.v(pb.x0, pb.z0), F.v(pb.x1, pb.z1)].sort((p, q) => p - q);
      // 向かい合う向き: v で離れていれば v に沿う梁、u で離れていれば u に沿う梁
      const alongV = vb[0]! >= va[1]! - 1e-6 || va[0]! >= vb[1]! - 1e-6;
      let beam: Rect;
      if (alongV) {
        const uc = (ua[0]! + ua[1]!) / 2;
        const [v0, v1] = vb[0]! >= va[1]! - 1e-6 ? [va[1]!, vb[0]!] : [vb[1]!, va[0]!];
        beam = F.rect(uc - bw / 2, v0, uc + bw / 2, v1);
      } else {
        const vc = other >= 2 + R * C ? Math.min(Math.max((vb[0]! + vb[1]!) / 2, va[0]! + bw / 2), va[1]! - bw / 2) : (va[0]! + va[1]!) / 2;
        const [u0, u1] = ub[0]! >= ua[1]! - 1e-6 ? [ua[1]!, ub[0]!] : [ub[1]!, ua[0]!];
        beam = F.rect(u0, vc - bw / 2, u1, vc + bw / 2);
      }
      ctx.addBox(box([beam.x0, y - 0.12, beam.z0], [beam.x1, y, beam.z1], 'metal'));
    }
    const offer = pitSecret(ctx, plan, 'fall.below', '溝の底から聞こえる水の音・底の灯り');
    if (offer) ctx.offerSecret(offer);
    ctx.keepOut({ min: [plan.hole.x0, y - depth, plan.hole.z0], max: [plan.hole.x1, y + 3, plan.hole.z1] });
  },
});

/** 迷路の升目の数（長さ len を、1 マスが 1.6〜2.3 m に収まるように cellM 前後で割る） */
export function mazeCount(len: number, cellM: number): number {
  let n = Math.max(2, Math.round(len / cellM));
  while (n > 2 && len / n < 1.6) n--;
  while (len / n > 2.3) n++;
  return n;
}

/**
 * 導く光の迷路: 部屋いっぱいの暗い迷路（天井までの仕切り）。光が入口から出口まで正しい道を先導する（遅れる・道を外れると待つ）。
 * 迷路は深さ優先で掘った完全迷路（行き止まりがある）。開口の前の升目どうしはつないでおく（扉の前を塞がない）。
 * 隠し: 光の道から離れた行き止まりの奥の壁（存在型 = 最初から壁と同じ色の扉 / 出現型 = 光を待たせ続けると現れる）
 */
defineGimmick({
  id: 'guideLight', name: '導く光の迷路', axes: ['light'], kinds: ['room', 'hall'], minSize: [4.6, 5.2], weight: 0.5, intensity: 1, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance && !!s.exit,
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const y = s.cell.floorY;
    const r = innerRect(s);
    const W = rectW(r), D = rectD(r);
    const nx = mazeCount(W, t['gimmick.maze.cellM']), nz = mazeCount(D, t['gimmick.maze.cellM']);
    if (nx * nz < 6) return;
    const cw = W / nx, cd = D / nz;
    const cellOf = (x: number, z: number): number => Math.min(nz - 1, Math.max(0, Math.floor((z - r.z0) / cd))) * nx + Math.min(nx - 1, Math.max(0, Math.floor((x - r.x0) / cw)));
    const center = (c: number): [number, number] => [r.x0 + ((c % nx) + 0.5) * cw, r.z0 + (Math.floor(c / nx) + 0.5) * cd];
    // 開口の前の升目（扉の幅 + 両側 0.35 m に掛かる壁際の升目）。主の矩形の壁に無い開口があれば諦める
    const regions: number[][] = [];
    for (const o of s.openings) {
      const wallC = o.dir === 0 ? s.rect.z1 : o.dir === 2 ? s.rect.z0 : o.dir === 1 ? s.rect.x1 : s.rect.x0;
      if (Math.abs((o.dir % 2 === 0 ? o.pos[2] : o.pos[0]) - wallC) > 0.3) return;
      const at = o.dir % 2 === 0 ? o.pos[0] : o.pos[2];
      const hw = o.width / 2 + 0.35;
      const cells: number[] = [];
      if (o.dir % 2 === 0) {
        const k = o.dir === 0 ? nz - 1 : 0;
        for (let i = 0; i < nx; i++) if (r.x0 + i * cw < at + hw && r.x0 + (i + 1) * cw > at - hw) cells.push(k * nx + i);
      } else {
        const i = o.dir === 1 ? nx - 1 : 0;
        for (let k = 0; k < nz; k++) if (r.z0 + k * cd < at + hw && r.z0 + (k + 1) * cd > at - hw) cells.push(k * nx + i);
      }
      regions.push(cells);
    }
    const doorCells = new Set(regions.flat());
    const a = frontOf(s.entrance!, 0.9), b = frontOf(s.exit!, 0.9);
    const start = cellOf(a[0], a[2]), goal = cellOf(b[0], b[2]);
    if (start === goal) return;
    // 迷路を掘る。行き止まり（光の道の外）があり、隠しを置ける行き止まりがある掘り方を選ぶ（何度か試す）
    type Plan = { open: Set<string>; path: number[]; dead: number[]; secret: { cell: number; dir: Dir; at: number } | null };
    let plan: Plan | null = null;
    for (let tr = 0; tr < 12 && !(plan && plan.secret); tr++) {
      const open = carveMaze(nx, nz, start, ctx.rng.fork(`maze${tr}`));
      for (const cells of regions) for (let j = 1; j < cells.length; j++) open.add(edgeKey(cells[j - 1]!, cells[j]!));
      const path = mazePath(nx, nz, open, start, goal);
      if (!path) continue;
      const onPath = new Set(path);
      const dead = [...Array(nx * nz).keys()].filter((c) => !onPath.has(c) && !doorCells.has(c) && openDegree(nx, nz, open, c) === 1);
      if (!dead.length) continue;
      // 隠しの行き止まり: 壁際（開口から離れた壁）で、光の道からいちばん遠いもの
      const far = treeDistance(nx, nz, open, path);
      let secret: Plan['secret'] = null, best = -1;
      for (const c of dead) {
        const i = c % nx, k = Math.floor(c / nx);
        const [x, z] = center(c);
        const walls: [Dir, number][] = [];
        if (k === nz - 1) walls.push([0, x]);
        if (k === 0) walls.push([2, x]);
        if (i === nx - 1) walls.push([1, z]);
        if (i === 0) walls.push([3, z]);
        for (const [dir, at] of walls) {
          if (s.openings.some((o) => o.dir === dir && Math.abs((dir % 2 === 0 ? o.pos[0] : o.pos[2]) - at) < o.width / 2 + DOOR_W / 2 + 0.6)) continue;
          if (far[c]! > best) { best = far[c]!; secret = { cell: c, dir, at }; }
        }
      }
      if (!plan || (secret && !plan.secret)) plan = { open, path, dead, secret };
    }
    if (!plan) return;
    const { open, path } = plan;
    // 仕切り（天井まで。厚さ 0.1 m）: 閉じた辺を、同じ線の上で続くものはまとめて 1 枚に
    const T = 0.1;
    const H = s.cell.height;
    const walls: Box[] = [];
    const mat = s.cell.palette.wall;
    for (let i = 1; i < nx; i++) {
      const x = r.x0 + i * cw;
      let k0 = -1;
      for (let k = 0; k <= nz; k++) {
        const closed = k < nz && !open.has(edgeKey(k * nx + i - 1, k * nx + i));
        if (closed && k0 < 0) k0 = k;
        if (!closed && k0 >= 0) { walls.push(box([x - T / 2, y, Math.max(r.z0, r.z0 + k0 * cd - T / 2)], [x + T / 2, y + H, Math.min(r.z1, r.z0 + k * cd + T / 2)], mat)); k0 = -1; }
      }
    }
    for (let k = 1; k < nz; k++) {
      const z = r.z0 + k * cd;
      let i0 = -1;
      for (let i = 0; i <= nx; i++) {
        const closed = i < nx && !open.has(edgeKey((k - 1) * nx + i, k * nx + i));
        if (closed && i0 < 0) i0 = i;
        if (!closed && i0 >= 0) { walls.push(box([Math.max(r.x0, r.x0 + i0 * cw - T / 2), y, z - T / 2], [Math.min(r.x1, r.x0 + i * cw + T / 2), y + H, z + T / 2], mat)); i0 = -1; }
      }
    }
    // 仕切りに掛かる天井の照明パネルは外す（残りは消えたまま）
    ctx.removeBoxes((bx) => !bx.solid && bx.mat === s.cell.palette.light && walls.some((w) => bx.min[0] < w.max[0] && bx.max[0] > w.min[0] && bx.min[2] < w.max[2] && bx.max[2] > w.min[2]));
    for (const w of walls) ctx.addBox(w);
    darken(ctx);
    // 光の道: 入口の前 → 升目の中心 → 出口の前（向きの変わる所だけ）
    const raw: [number, number][] = [[a[0], a[2]], ...path.map(center), [b[0], b[2]]];
    const pts: [number, number][] = [];
    for (let j = 0; j < raw.length; j++) {
      const p = raw[j]!, q = pts[pts.length - 1], n = raw[j + 1];
      if (q && Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.05) continue;
      if (q && n && Math.abs((p[0] - q[0]) * (n[1] - p[1]) - (p[1] - q[1]) * (n[0] - p[0])) < 1e-6 && (p[0] - q[0]) * (n[0] - p[0]) + (p[1] - q[1]) * (n[1] - p[1]) > 0) continue;
      pts.push(p);
    }
    const guide = ctx.addEntity('light', {
      type: 'guideLight',
      params: {
        points: pts.map(([x, z]) => [x, y + 1.35, z]), speed: t['gimmick.maze.lightSpeed'], lead: t['gimmick.maze.lead'], waitDist: t['gimmick.maze.waitDist'],
        follow: 'path', onPath: Math.min(cw, cd) / 2 + 0.05, startZone: aabbJson(doorZone(s.entrance!, y, 1.8, 0.5)), color: 0xfff1d0, range: t['gimmick.maze.lightRange'],
        region: aabbJson({ min: [r.x0, y - 0.5, r.z0], max: [r.x1, y + 2.5, r.z1] }),
      },
    });
    if (plan.secret) {
      // 出現型: 光を無視し続ける（迷路の中で道を外れる・遅れる）と現れる
      const ignore = ctx.addEntity('ignore', { type: 'timer', params: { onDelay: t['gimmick.maze.ignoreSec'], offDelay: 0 }, inputs: { in: `${guide}.lost` } });
      ctx.offerSecret({ hook: 'light.ignore', modes: ['present', 'appear'], weight: 1.1, revealOutput: `${ignore}.out`, doorway: { dir: plan.secret.dir, at: plan.secret.at, y, width: 1.0, height: 2.0 }, tell: '光の届かない行き止まりの奥から、細い風' });
    }
    ctx.keepOut({ min: [r.x0, y - 0.1, r.z0], max: [r.x1, y + H, r.z1] });
  },
});

defineGimmick({
  id: 'puzzleRoom', name: '謎のパズル', axes: ['puzzle'], kinds: ['room'], minSize: [3.8, 3.8], weight: 0.65, intensity: 1, offersSecret: true, onMainPath: false, requiresSecret: true,
  fits: (s) => s.openings.length === 1,
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    const ent = s.openings[0]!;
    // 隠しの扉の壁（入口の向かい）→ 手がかり・ボタンの壁（残り）
    const opp = ((ent.dir + 2) % 4) as Dir;
    const doorSpan = freeWallSpan(s, opp, 1.4);
    if (!doorSpan) return;
    const others = ([0, 1, 2, 3] as const).filter((d) => d !== opp);
    const colors: MatId[] = ['neonRed', 'lightGreen', 'neonBlue'];
    const order = ctx.rng.shuffle([0, 1, 2]);
    // 手がかり: 隠しの扉の壁の上の方に、色の四角を順番に（左から右）
    for (let i = 0; i < 3; i++) {
      const at = doorSpan.at + (i - 1) * 0.35;
      ctx.addBox(onWall(ctx, opp, at, 0.12, y + 2.0, y + 2.24, 0.03, colors[order[i]!]!));
    }
    // ボタン: ほかの壁に 1 つずつ（色の灯りを上に）
    const buttons: string[] = [];
    for (let c = 0; c < 3; c++) {
      const d = others[c % others.length]!;
      const span = freeWallSpan(s, d, 0.8);
      if (!span) return;
      const at = others.length < 3 && c >= others.length ? span.a0 + 0.5 : span.at + (others.length < 3 ? (c % 2 ? 0.6 : -0.6) : 0);
      const bx = onWall(ctx, d, at, 0.12, y + 1.05, y + 1.3, 0.07, 'metalDark');
      buttons[c] = ctx.addEntity(`button${c}`, { type: 'button', params: { box: aabbJson({ min: bx.min, max: bx.max }), mat: 'metalDark' } });
      ctx.addBox(onWall(ctx, d, at, 0.1, y + 1.45, y + 1.6, 0.02, colors[c]!));
    }
    // 手がかりの順に押す
    const inputs: { [k: string]: string } = {};
    for (let i = 0; i < 3; i++) inputs[`s${i + 1}`] = `${buttons[order[i]!]}.pressed`;
    const seq = ctx.addEntity('sequence', { type: 'sequence', params: { count: 3, resetOnWrong: true }, inputs });
    ctx.offerSecret({ hook: 'puzzle.sequence', modes: ['appear'], weight: 1, required: true, revealOutput: `${seq}.done`, doorway: { dir: opp, at: doorSpan.at, y, width: 1.0, height: 2.0 }, tell: '壁の継ぎ目のずれ' });
  },
});
