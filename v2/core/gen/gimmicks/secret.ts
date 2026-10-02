/**
 * 隠し発見を差し出す仕掛け（段階 3 の 4 種。v2-plan.md 4.5 のご提示の 4 つ）。
 * - tiltRoom 傾く床: 部屋の床ほぼ全体が傾く板。開口の無い壁の前に物を積み、その後ろに隠し部屋の入口。
 *     存在型 = 入口は最初からあって物に隠れている / 出現型 = 物の 70% をどかすと壁が消える
 * - narrowPath 細い道: 部屋を横切る深い溝（2.2 m）を細い梁で渡る。落ちると溝の底。底の横の壁に隠し部屋の入口（存在型）。
 *     溝の中の階段で入口側へ戻れる（閉じ込めない）
 * - guideLight 導く光: 暗い部屋。光が入口から出口まで先導する。光を無視して離れていると扉が現れる（出現型）/
 *     光の避ける暗がりに入口がある（存在型）
 * - puzzleRoom 謎のパズル: 行き止まりの部屋。色の付いたボタン 3 つを、壁の色の並び（手がかり）の順に押すと扉が現れる（出現型・必ず付ける）
 */
import type { Dir } from '../../math/vec.ts';
import type { Rect } from '../../world/footprint.ts';
import { box, type Box, type MatId } from '../../world/layout.ts';
import { defineGimmick, type GimmickContext } from './types.ts';
import { aabbJson, cutFloorSlab, doorZone, freeWallSpan, frontOf, innerRect, pitBoxes, rectD, rectW } from './util.ts';

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

defineGimmick({
  id: 'narrowPath', name: '細い道', axes: ['floor', 'body'], kinds: ['room', 'hall'], minSize: [4, 7], weight: 1, intensity: 2, offersSecret: true, onMainPath: true,
  // 入口と出口が向かい合っている（梁が本道を渡る）
  fits: (s) => !!s.entrance && !!s.exit && (s.entrance.dir + 2) % 4 === s.exit.dir,
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    // 軸は入口の壁に垂直（入口から奥へ）。入口と出口が斜めにずれていても、溝は入口と出口の間を横切る
    const e0 = s.entrance!;
    const axis: 'x' | 'z' = e0.dir === 0 || e0.dir === 2 ? 'z' : 'x';
    const sign: 1 | -1 = e0.dir === 0 || e0.dir === 1 ? -1 : 1;
    const r = innerRect(s);
    const len = axis === 'x' ? rectW(r) : rectD(r);
    const L = Math.min(5.0, len - 2 * 1.4 - 0.2);
    if (L < 3.9) return;
    const depth = 2.2;
    const mid = axis === 'x' ? (r.x0 + r.x1) / 2 : (r.z0 + r.z1) / 2;
    const hole: Rect = axis === 'x' ? { x0: snap(mid - L / 2), x1: snap(mid + L / 2), z0: r.z0, z1: r.z1 } : { x0: r.x0, x1: r.x1, z0: snap(mid - L / 2), z1: snap(mid + L / 2) };
    // 溝は部屋の端から端まで横切る。横の壁の開口（広間の 3 つ目・4 つ目の出入り口）の前が溝にならないこと（出た途端に落ちない）
    const h0 = axis === 'x' ? hole.x0 : hole.z0, h1 = axis === 'x' ? hole.x1 : hole.z1;
    for (const o of s.openings) {
      if (o.dir % 2 === e0.dir % 2) continue;
      const at = axis === 'x' ? o.pos[0] : o.pos[2];
      if (at + o.width / 2 + 0.8 > h0 && at - o.width / 2 - 0.8 < h1) return;
    }
    cutFloorSlab(s, hole);
    for (const b of pitBoxes(s, hole, depth)) ctx.addBox(b);
    // 梁: 入口の位置の延長線（幅 0.5 m）
    const e = s.entrance!;
    const across = axis === 'x' ? e.pos[2] : e.pos[0];
    const bw = ctx.rng.float(0.42, 0.6) / 2;
    ctx.addBox(axis === 'x' ? box([hole.x0, y - 0.15, across - bw], [hole.x1, y, across + bw], 'metal') : box([across - bw, y - 0.15, hole.z0], [across + bw, y, hole.z1], 'metal'));
    // 溝から戻る階段: 梁と反対側の壁沿いに、入口側へ上がる
    const lo = axis === 'x' ? hole.z0 : hole.x0, hi = axis === 'x' ? hole.z1 : hole.x1;
    const stairSide = Math.abs(across - lo) > Math.abs(across - hi) ? 'lo' : 'hi';
    const c0 = stairSide === 'lo' ? lo + 0.15 : hi - 1.05, c1 = c0 + 0.9;
    const steps = Math.ceil(depth / 0.17);
    const tread = (L - 0.3) / steps;
    for (let i = 0; i < steps; i++) {
      const top = y - depth + (i + 1) * (depth / steps);
      // 入口側（-sign）が高い
      const a1 = sign > 0 ? (axis === 'x' ? hole.x0 : hole.z0) + 0.15 + (steps - i) * tread : (axis === 'x' ? hole.x1 : hole.z1) - 0.15 - (steps - i) * tread;
      const a0 = sign > 0 ? (axis === 'x' ? hole.x0 : hole.z0) + 0.15 + (steps - i - 1) * tread : (axis === 'x' ? hole.x1 : hole.z1) - 0.15 - (steps - i - 1) * tread;
      const [s0, s1] = [Math.min(a0, a1), Math.max(a0, a1)];
      ctx.addBox(axis === 'x' ? box([s0, y - depth, c0], [s1, top, c1], s.cell.palette.floor) : box([c0, y - depth, s0], [c1, top, s1], s.cell.palette.floor));
    }
    // 落ちた先の灯り（底をぼんやり照らす）
    const bx = axis === 'x' ? mid : (lo + hi) / 2, bz = axis === 'x' ? (lo + hi) / 2 : mid;
    s.cell.lights.push({ pos: [bx, y - depth + 1.4, bz], color: 0xbfd0e0, intensity: 0.35, distance: 6 });
    // 隠しの入口: 階段と反対の横の壁の底（存在型）
    const secretSide: Dir = axis === 'x' ? (stairSide === 'lo' ? 0 : 2) : (stairSide === 'lo' ? 1 : 3);
    ctx.offerSecret({ hook: 'fall.below', modes: ['present'], weight: 1.2, doorway: { dir: secretSide, at: mid, y: y - depth, width: 1.0, height: 2.0 }, tell: '下から聞こえる音・底の灯り' });
    ctx.keepOut({ min: [hole.x0 - 0.2, y - depth, hole.z0], max: [hole.x1 + 0.2, y + 3, hole.z1] });
  },
});

defineGimmick({
  id: 'guideLight', name: '導く光', axes: ['light'], kinds: ['room', 'hall'], minSize: [5, 6], weight: 1, intensity: 1, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance && !!s.exit,
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    darken(ctx);
    const a = frontOf(s.entrance!, 1.2), b = frontOf(s.exit!, 1.0);
    // 隠しの壁: 入口・出口の無い壁。光はその壁から離れた側を回る
    const walls = ([0, 1, 2, 3] as const).filter((d) => d !== s.entrance!.dir && d !== s.exit!.dir && freeWallSpan(s, d, 1.6));
    const wd = walls.length ? ctx.rng.pick(walls) : null;
    const r = innerRect(s, 0.8);
    const mx = (a[0] + b[0]) / 2, mz = (a[2] + b[2]) / 2;
    // 隠しの壁から離れる向きへずらした中間点
    const off = wd === null ? [0, 0] : ([[0, -1], [-1, 0], [0, 1], [1, 0]] as const)[wd]!;
    const w: [number, number, number] = [Math.min(r.x1, Math.max(r.x0, mx + off[0]! * 1.5)), y, Math.min(r.z1, Math.max(r.z0, mz + off[1]! * 1.5))];
    const guide = ctx.addEntity('light', { type: 'guideLight', params: { points: [[a[0], y + 1.3, a[2]], [w[0], y + 1.5, w[2]], [b[0], y + 1.3, b[2]]], speed: ctx.rng.float(0.9, 1.3), lead: 3.0, waitDist: 6, startZone: aabbJson(doorZone(s.entrance!, y, 1.8, 0.5)), color: 0xfff1d0 } });
    if (wd !== null) {
      const span = freeWallSpan(s, wd, 1.6)!;
      const dist = ctx.addEntity('ignore', { type: 'distanceSensor', params: { entity: guide, dist: 5.5, sec: 5, aabb: aabbJson({ min: [r.x0, y - 0.5, r.z0], max: [r.x1, y + 3, r.z1] }) } });
      ctx.offerSecret({ hook: 'light.ignore', modes: ['appear', 'present'], weight: 1, revealOutput: `${dist}.done`, doorway: { dir: wd, at: span.at, y, width: 1.0, height: 2.0 }, tell: '光が一瞬そちらを避ける' });
    }
  },
});

defineGimmick({
  id: 'puzzleRoom', name: '謎のパズル', axes: ['puzzle'], kinds: ['room'], minSize: [3.8, 3.8], weight: 0.8, intensity: 1, offersSecret: true, onMainPath: false, requiresSecret: true,
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
