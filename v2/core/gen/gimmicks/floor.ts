/**
 * 床の仕掛け（3 種）。どれも閉じ込めない: 落ちた先から歩いて戻れる。
 * - crumbleFloor 崩れる床 [QR][WS G02]: 部屋の床全部が、底の見えない落ちる穴（14 章）の上の床板。本当の道は曲がりくねった 1 本だけで、
 *     ほかの床板はひびの入った見せかけ（乗るとすぐ抜ける）か、抜けている。道の床板も、乗ると少しで揺れて落ちる（離れても止まらない。
 *     来た道は崩れていく）。止まると落ちるので、道を見極めながら急ぐ。落ちたら 1 つ下の階へ。隠し: 下の細い足場の先（crumble.fall）
 * - bouncePad 弾む床 [QR][WS M04]: 高い棚の手前の弾む床。跳ねて棚に乗れる（棚の上に小さな物）
 * - appearPath 立ち止まると見える道 [WS G08]: 深い溝（2 m）を渡る見えない橋。光の四角で 1.5 秒止まると現れる。落ちたら階段で戻る
 */
import type { Dir } from '../../math/vec.ts';
import { box, type Box } from '../../world/layout.ts';
import type { Rect } from '../../world/footprint.ts';
import { defineGimmick } from './types.ts';
import { buildPit, pitInner, pitSecret, pitShell, planPit } from './pit.ts';
import { botHint } from './ground/common.ts';
import { aabbJson, cutFloorSlab, hitsDoorZones, innerRect, mainAxis, rectD, rectGap, rectW } from './util.ts';

const snap = (v: number): number => Math.round(v * 20) / 20;

/**
 * 床板の並び: area から holes を除いた所を、大きさ tile の升目で敷く（holes の縁で切る。minPiece より細い切れ端は隣と合わせる）
 */
function tileGrid(area: Rect, holes: readonly Rect[], tile: number, minPiece = 0.3): Rect[] {
  const lines = (a0: number, a1: number, edges: number[]): number[] => {
    // 必ず残す線（area の端・holes の縁）と、升目の線（近すぎれば捨てる）
    const must = [...new Set([a0, a1, ...edges.filter((v) => v > a0 + 1e-6 && v < a1 - 1e-6)])].sort((p, q) => p - q);
    const out: number[] = [];
    for (let i = 0; i + 1 < must.length; i++) {
      const p = must[i]!, q = must[i + 1]!;
      out.push(p);
      const n = Math.max(1, Math.round((q - p) / tile));
      for (let k = 1; k < n; k++) out.push(p + ((q - p) * k) / n);
    }
    out.push(a1);
    return out.filter((v, i, arr) => i === 0 || v - arr[i - 1]! > Math.min(minPiece, 0.05) - 1e-9);
  };
  const xs = lines(area.x0, area.x1, holes.flatMap((h) => [h.x0, h.x1]));
  const zs = lines(area.z0, area.z1, holes.flatMap((h) => [h.z0, h.z1]));
  const out: Rect[] = [];
  for (let k = 0; k + 1 < zs.length; k++) for (let i = 0; i + 1 < xs.length; i++) {
    const r: Rect = { x0: xs[i]!, x1: xs[i + 1]!, z0: zs[k]!, z1: zs[k + 1]! };
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    if (holes.some((h) => cx > h.x0 && cx < h.x1 && cz > h.z0 && cz < h.z1)) continue;
    out.push(r);
  }
  return out;
}

/**
 * 崩れる床: 部屋の床全部（開口の前の固い床を除く）が深い穴（gimmick.crumble.depthM）の上の床板。乗り続けると揺れて落ち、しばらくで戻る。
 * 止まらずに渡れば落ちない（歩いて 1 枚あたり約 0.33 秒、揺れ始めるまで約 0.4 秒）。落ちたら穴の底の階段で入口の床へ戻ってやり直し。
 * 崩れない床板が少しだけある（入口の床と同じ材質。並べて道にはしない）。隠し: 穴の底の壁の扉（落ちた人だけが見つける）
 */
defineGimmick({
  id: 'crumbleFloor', name: '崩れる床', axes: ['floor'], kinds: ['room', 'hall'], minSize: [4.8, 6], minHeight: 2.4, weight: 1.4, intensity: 2, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance && !!s.exit,
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const y = s.cell.floorY;
    const plan = planPit(ctx, { depth: t['gimmick.crumble.depthM'], preferAlongEntry: true, drop: true });
    if (!plan || !plan.exit) return;
    const pieces = tileGrid(plan.hole, plan.solidTop, t['gimmick.crumble.tileM']);
    // 床板のつながり（辺を 0.3 m 以上接する）と、入口の床・出口の床に接する床板
    const touch = (a: Rect, b: Rect): boolean => rectGap(a, b) < 0.02 && (Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0.3 || Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > 0.3);
    const adj = pieces.map((a, i) => pieces.map((b, j) => (i !== j && touch(a, b) ? j : -1)).filter((j) => j >= 0));
    const starts = pieces.map((r, i) => (touch(r, plan.entry) ? i : -1)).filter((i) => i >= 0);
    const goals = new Set(pieces.map((r, i) => (touch(r, plan.exit!) ? i : -1)).filter((i) => i >= 0));
    if (!starts.length || !goals.size) return;
    // 本当の道: 床板の迷路（深さ優先で掘った木）の、入口の床から出口の床までの道（曲がりくねる）。まっすぐな道の 1.4 倍以上の長さ
    const F = plan.frame;
    const straight = Math.max(1, Math.round((F.depth - 2 * t['gimmick.pit.landingM']) / t['gimmick.crumble.tileM']));
    let route: number[] | null = null;
    for (let k = 0; k < 12 && !route; k++) {
      const r = ctx.rng.fork(`route${k}`);
      const s0 = r.pick(starts);
      const prev = new Map<number, number>([[s0, -1]]);
      const stack = [s0];
      while (stack.length) {
        const a = stack[stack.length - 1]!;
        const next = r.shuffle(adj[a]!.filter((b) => !prev.has(b)));
        if (!next.length || goals.has(a)) { stack.pop(); continue; }
        prev.set(next[0]!, a);
        stack.push(next[0]!);
      }
      const reach = [...goals].filter((g) => prev.has(g));
      if (!reach.length) continue;
      const g = r.pick(reach);
      const path: number[] = [];
      for (let c = g; c >= 0; c = prev.get(c)!) path.unshift(c);
      if (path.length >= straight * 1.4 || k === 11) route = path;
    }
    if (!route) return;
    buildPit(ctx, plan);
    const floorMat = s.cell.palette.floor;
    const mat = ctx.rng.pick((['floorTile', 'floorLino', 'floorWood', 'floorCarpetGrey'] as const).filter((m) => m !== floorMat));
    const onRoute = new Set(route);
    // 一息つける床（崩れない）: 道の真ん中あたりの 1 枚（確率で）
    const rest = ctx.rng.chance(t['gimmick.crumble.restChance']) && route.length >= 6 ? route[Math.floor(route.length / 2)]! : -1;
    // 床板の隙間（下の暗い穴が見える。普通の床ではないと一目で分かる）
    const gi = t['gimmick.crumble.gapM'] / 2;
    pieces.forEach((r, i) => {
      const b = { min: [r.x0 + gi, y - 0.12, r.z0 + gi], max: [r.x1 - gi, y, r.z1 - gi] };
      if (i === rest) { ctx.addBox(box(b.min as [number, number, number], b.max as [number, number, number], floorMat)); return; }
      if (onRoute.has(i)) {
        ctx.addEntity(`t${i}`, { type: 'crumbleTile', params: { box: b, mat, latch: true, standSec: t['gimmick.crumble.standSec'] * ctx.rng.float(0.9, 1.15), shakeSec: t['gimmick.crumble.shakeSec'] * ctx.rng.float(0.9, 1.2), respawnSec: t['gimmick.crumble.respawnSec'] } });
        return;
      }
      // 見せかけ（ひび。乗るとすぐ抜ける）か、抜けている
      if (!ctx.rng.chance(t['gimmick.crumble.decoyChance'])) return;
      ctx.addEntity(`t${i}`, { type: 'crumbleTile', params: { box: b, mat, latch: true, crack: true, standSec: 0.04, shakeSec: 0.12, respawnSec: t['gimmick.crumble.respawnSec'] } });
    });
    // 歩く人（試験）: 道の床板の真ん中を順に（入口から / 出口から）。始めと終わりは、固い床の上の、最初（最後）の床板の真正面の点
    // （固い床から斜めに入ると、2 枚目の床板を先に踏んでしまう）
    const front = (tile: Rect, land: Rect): [number, number, number] => {
      const cx = (tile.x0 + tile.x1) / 2, cz = (tile.z0 + tile.z1) / 2;
      const x = Math.min(land.x1 - 0.35, Math.max(land.x0 + 0.35, cx)), z = Math.min(land.z1 - 0.35, Math.max(land.z0 + 0.35, cz));
      return [x, y, z];
    };
    const pts = [front(pieces[route[0]!]!, plan.entry), ...route.map((i) => { const r = pieces[i]!; return [(r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2] as [number, number, number]; }), front(pieces[route[route.length - 1]!]!, plan.exit)];
    const ec = plan.landings.find((l) => l.o === s.entrance)!.o.pos, xc = plan.landings.find((l) => l.o === s.exit)!.o.pos;
    ctx.addEntity('route', { type: 'constant', params: { value: 0, bot: [
      botHint(pts.map((at) => ({ at })), { enterAt: [ec[0], ec[2]], exitAt: [xc[0], xc[2]] }),
      botHint([...pts].reverse().map((at) => ({ at })), { enterAt: [xc[0], xc[2]], exitAt: [ec[0], ec[2]] }),
    ] } });
    const offer = pitSecret(ctx, plan, 'crumble.fall', '床板の隙間から下の灯りが見える');
    if (offer) ctx.offerSecret(offer);
    ctx.keepOut({ min: [plan.hole.x0, y - plan.depth, plan.hole.z0], max: [plan.hole.x1, y + 3, plan.hole.z1] });
  },
});

defineGimmick({
  id: 'bouncePad', name: '弾む床', axes: ['body', 'move'], kinds: ['hall', 'room'], minSize: [5, 5], minHeight: 3.6, weight: 0.6, intensity: 1, onMainPath: true,
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    const r = innerRect(s);
    // 棚: 開口の無い壁に沿って（高さ 2.2〜2.6 m、奥行き 1.4 m、長さ 3 m）
    const walls = ([0, 1, 2, 3] as const).filter((d) => !s.openings.some((o) => o.dir === d));
    if (!walls.length) return;
    const d = ctx.rng.pick(walls);
    const ledgeY = y + Math.min(s.cell.height - 1.9, ctx.rng.float(2.2, 2.6));
    if (ledgeY - y < 1.8) return;
    const len = Math.min(3.2, (d === 0 || d === 2 ? rectW(r) : rectD(r)) - 0.6);
    const depth = 1.4;
    const c = d === 0 || d === 2 ? (r.x0 + r.x1) / 2 : (r.z0 + r.z1) / 2;
    const wall = d === 0 ? r.z1 : d === 2 ? r.z0 : d === 1 ? r.x1 : r.x0;
    const sg = d === 0 || d === 1 ? -1 : 1; // 内向き
    const w0 = Math.min(wall, wall + sg * depth), w1 = Math.max(wall, wall + sg * depth);
    ctx.addBox(d === 0 || d === 2 ? box([c - len / 2, ledgeY - 0.15, w0], [c + len / 2, ledgeY, w1], 'metal') : box([w0, ledgeY - 0.15, c - len / 2], [w1, ledgeY, c + len / 2], 'metal'));
    // 棚の上の小さな物（見つけた印）
    const tx = d === 0 || d === 2 ? c : (w0 + w1) / 2, tz = d === 0 || d === 2 ? (w0 + w1) / 2 : c;
    ctx.addBox(box([tx - 0.12, ledgeY, tz - 0.12], [tx + 0.12, ledgeY + 0.3, tz + 0.12], 'goldTrim', false));
    // 弾む床: 棚の手前 1.4 m
    const px = d === 0 || d === 2 ? c : (d === 1 ? w0 - 1.4 : w1 + 1.4), pz = d === 0 || d === 2 ? (d === 0 ? w0 - 1.4 : w1 + 1.4) : c;
    const pad: Box = box([px - 0.6, y, pz - 0.6], [px + 0.6, y + 0.08, pz + 0.6], 'plasticYellow', false);
    pad.kind = 'bouncePad';
    ctx.addBox(pad);
    const v = Math.sqrt(2 * 9.8 * (ledgeY - y + 0.7));
    ctx.addEntity('pad', { type: 'bouncePad', params: { aabb: aabbJson({ min: [px - 0.6, y - 0.1, pz - 0.6], max: [px + 0.6, y + 0.4, pz + 0.6] }), speed: v } });
    ctx.keepOut({ min: [px - 1.2, y, pz - 1.2], max: [px + 1.2, y + 3, pz + 1.2] });
  },
});

defineGimmick({
  id: 'appearPath', name: '立ち止まると見える道', axes: ['time', 'sight'], kinds: ['room', 'hall'], minSize: [5, 7], minHeight: 2.4, weight: 0.7, intensity: 2, offersSecret: true, requiresSecret: true, onMainPath: false,
  // 溝で部屋が二つに分かれるので、開口が 1 つの行き止まりの部屋だけ（溝の向こうに開口があると、橋が現れるまで行けない）
  fits: (s) => s.openings.length === 1,
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    const { axis } = mainAxis(s);
    const r = innerRect(s);
    // 溝: 入口から遠い半分を横切る（入口の前は空ける）。幅 2.2 m
    const ent = s.entrance;
    const far = ent ? (axis === 'x' ? (ent.pos[0] < (r.x0 + r.x1) / 2 ? 1 : -1) : (ent.pos[2] < (r.z0 + r.z1) / 2 ? 1 : -1)) : 1;
    const mid = axis === 'x' ? (r.x0 + r.x1) / 2 + far * rectW(r) * 0.12 : (r.z0 + r.z1) / 2 + far * rectD(r) * 0.12;
    const gap = 2.2;
    const hole: Rect = axis === 'x' ? { x0: snap(mid - gap / 2), x1: snap(mid + gap / 2), z0: r.z0, z1: r.z1 } : { x0: r.x0, x1: r.x1, z0: snap(mid - gap / 2), z1: snap(mid + gap / 2) };
    if (hitsDoorZones(s, hole, 1.35)) return;
    const depth = 2.0;
    cutFloorSlab(s, hole);
    pitShell(ctx, hole, depth);
    // 溝から戻る階段: 入口側の溝の縁に沿って（幅 1.0 m）、部屋の端の壁から溝の真ん中の方へ下りる。上の端は入口側の床へ上がる。
    // 下の端の先は溝の底が空いている（以前は溝の全幅に段を並べて端の壁から上っていたので、底から見ると一段目が壁際にあって
    // 上れず、上の段は溝を渡る橋になっていた）
    const nearLo = far > 0; // 入口側は溝の低い座標の側（溝は入口から遠い側へずらしてある）
    const inner = pitInner(ctx, hole);
    const riseMax = ctx.tuning['gimmick.pit.stairRise'], tread = ctx.tuning['gimmick.pit.stairTread'];
    const n = Math.max(1, Math.ceil(depth / riseMax) - 1);
    const rise = depth / (n + 1);
    const laneW = 1.0;
    const lane0 = axis === 'x' ? (nearLo ? inner.x0 : inner.x1 - laneW) : (nearLo ? inner.z0 : inner.z1 - laneW);
    const a0 = axis === 'x' ? inner.z0 : inner.x0;
    for (let i = 0; i < n; i++) {
      const top = y - rise * (i + 1);
      const s0 = a0 + i * tread, s1 = a0 + (i + 1) * tread;
      ctx.addBox(axis === 'x' ? box([lane0, y - depth, s0], [lane0 + laneW, top, s1], s.cell.palette.floor) : box([s0, y - depth, lane0], [s1, top, lane0 + laneW], s.cell.palette.floor));
    }
    // 見えない橋（出現型の箱）: 溝の真ん中を幅 1.0 m で渡す
    const group = `${ctx.id}.bridge`;
    const cc = axis === 'x' ? (r.z0 + r.z1) / 2 : (r.x0 + r.x1) / 2;
    const bridge: Box = axis === 'x' ? box([hole.x0, y - 0.1, cc - 0.5], [hole.x1, y, cc + 0.5], 'glass') : box([cc - 0.5, y - 0.1, hole.z0], [cc + 0.5, y, hole.z1], 'glass');
    bridge.revealGroup = group;
    ctx.addBox(bridge);
    // 光の四角（溝の手前 1.4 m）
    const near = axis === 'x' ? mid - far * (gap / 2 + 1.4) : mid - far * (gap / 2 + 1.4);
    const px = axis === 'x' ? near : cc, pz = axis === 'x' ? cc : near;
    const pad: Box = box([px - 0.5, y, pz - 0.5], [px + 0.5, y + 0.012, pz + 0.5], 'screenGlow', false);
    pad.kind = 'pad';
    ctx.addBox(pad);
    const dwell = ctx.addEntity('pad', { type: 'dwellSensor', params: { aabb: aabbJson({ min: [px - 0.5, y - 0.1, pz - 0.5], max: [px + 0.5, y + 1.5, pz + 0.5] }), sec: 1.5, still: true } });
    ctx.addEntity('reveal', { type: 'reveal', params: { group, pos: [axis === 'x' ? mid : cc, y, axis === 'x' ? cc : mid], style: 'fadeIn' }, inputs: { show: `${dwell}.done` } });
    // 溝の上の低い下がり壁（跳んで渡れない。橋を出して歩いて渡る）
    const ceil = y + s.cell.height;
    if (ceil - (y + 2.05) > 0.1) ctx.addBox(axis === 'x' ? box([hole.x0 - 0.4, y + 2.05, r.z0], [hole.x1 + 0.4, ceil, r.z1], s.cell.palette.wall) : box([r.x0, y + 2.05, hole.z0 - 0.4], [r.x1, ceil, hole.z1 + 0.4], s.cell.palette.wall));
    // ご褒美: 溝の向こうの壁の扉（渡った人だけが行ける。必ず付ける）
    const farDir: Dir = axis === 'x' ? (far > 0 ? 1 : 3) : (far > 0 ? 0 : 2);
    ctx.offerSecret({ hook: 'appear.beyond', modes: ['present'], weight: 1.2, required: true, doorway: { dir: farDir, at: cc, y, width: 1.0, height: 2.0 }, tell: '溝の向こうの壁に、扉の形のすすけた跡' });
    ctx.keepOut({ min: [hole.x0 - 0.2, y - depth, hole.z0 - 0.2], max: [hole.x1 + 0.2, y + 3, hole.z1 + 0.2] });
    ctx.keepOut({ min: [px - 1, y, pz - 1], max: [px + 1, y + 3, pz + 1] });
    // 段階 4 で足した: 階段の上の端から入口側の床へ上がる所（部屋の端の壁際）に物を置かない（壁付けの物で上り口が塞がれる）
    const e0 = nearLo ? (axis === 'x' ? hole.x0 : hole.z0) - 1.0 : (axis === 'x' ? hole.x1 : hole.z1), e1 = e0 + 1.0;
    ctx.keepOut(axis === 'x' ? { min: [e0, y, a0 - 0.2], max: [e1, y + 3, a0 + 2 * tread + 0.4] } : { min: [a0 - 0.2, y, e0], max: [a0 + 2 * tread + 0.4, y + 3, e1] });
  },
});
