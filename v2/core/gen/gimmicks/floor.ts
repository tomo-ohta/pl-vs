/**
 * 床の仕掛け（3 種）。どれも閉じ込めない: 落ちた先から歩いて戻れる。
 * - crumbleFloor 崩れる床 [QR][WS G02]: 部屋の床全部が深い穴（約 2.8 m）の上の床板。乗り続けると揺れて落ちる（しばらくで戻る）。
 *     落ちたら穴の底の階段で入口の床へ戻ってやり直し。隠し: 穴の底の壁の扉（crumble.fall・存在型）
 * - bouncePad 弾む床 [QR][WS M04]: 高い棚の手前の弾む床。跳ねて棚に乗れる（棚の上に小さな物）
 * - appearPath 立ち止まると見える道 [WS G08]: 深い溝（2 m）を渡る見えない橋。光の四角で 1.5 秒止まると現れる。落ちたら階段で戻る
 */
import { box, type Box } from '../../world/layout.ts';
import type { Rect } from '../../world/footprint.ts';
import { defineGimmick } from './types.ts';
import { buildPit, pitInner, pitSecret, pitShell, planPit } from './pit.ts';
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
    const plan = planPit(ctx, { depth: t['gimmick.crumble.depthM'], preferAlongEntry: true });
    if (!plan) return;
    buildPit(ctx, plan);
    const pieces = tileGrid(plan.hole, plan.solidTop, t['gimmick.crumble.tileM']);
    const floorMat = s.cell.palette.floor;
    const mat = ctx.rng.pick((['floorTile', 'floorLino', 'floorWood', 'floorCarpetGrey'] as const).filter((m) => m !== floorMat));
    // 崩れない床板: 固い床・ほかの崩れない床板に接しない所から選ぶ
    const safe = new Set<number>();
    const want = Math.floor(pieces.length * t['gimmick.crumble.safeRatio']);
    for (const i of ctx.rng.shuffle([...pieces.keys()])) {
      if (safe.size >= want) break;
      const r = pieces[i]!;
      if (plan.solidTop.some((q) => rectGap(q, r) < 0.05) || [...safe].some((j) => rectGap(pieces[j]!, r) < 0.05)) continue;
      safe.add(i);
    }
    // 床板の隙間（下の暗い穴が見える。普通の床ではないと一目で分かる）
    const gi = t['gimmick.crumble.gapM'] / 2;
    pieces.forEach((r, i) => {
      const b = { min: [r.x0 + gi, y - 0.12, r.z0 + gi], max: [r.x1 - gi, y, r.z1 - gi] };
      if (safe.has(i)) { ctx.addBox(box(b.min as [number, number, number], b.max as [number, number, number], floorMat)); return; }
      ctx.addEntity(`t${i}`, { type: 'crumbleTile', params: { box: b, mat, standSec: t['gimmick.crumble.standSec'] * ctx.rng.float(0.85, 1.25), shakeSec: t['gimmick.crumble.shakeSec'] * ctx.rng.float(0.8, 1.3), respawnSec: t['gimmick.crumble.respawnSec'] } });
    });
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
  id: 'appearPath', name: '立ち止まると見える道', axes: ['time', 'sight'], kinds: ['room', 'hall'], minSize: [5, 7], weight: 0.7, intensity: 2, onMainPath: false,
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
    ctx.keepOut({ min: [hole.x0 - 0.2, y - depth, hole.z0 - 0.2], max: [hole.x1 + 0.2, y + 3, hole.z1 + 0.2] });
    ctx.keepOut({ min: [px - 1, y, pz - 1], max: [px + 1, y + 3, pz + 1] });
  },
});
