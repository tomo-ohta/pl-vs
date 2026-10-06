/**
 * 写す物の仕掛け（段階 4・担当 sense）。どれも「肉眼では見えない物が、写した像にだけ見える」。重い描画（写真・監視映像・鏡）は画質の段で軽くする。
 *
 * - photoBooth 写真に写るもの [O08]: 入口の脇の三脚のカメラを調べると、部屋の奥を撮った写真が隣の額に出る。写真には、肉眼では見えない物が写る
 *     （隠しの扉が付いていれば、その扉が開いて光が漏れている所。無ければ、部屋の真ん中に立つ人影）。
 *     裏の振る舞い [BO06]: 写真にだけ写る扉 — 写真を撮ってから、写っていた所へ行くと壁が開く（出現型）。存在型 = 扉は壁と同じ色で最初からある
 * - cctvRoom 監視カメラの映像 [O09]: 入口の脇の机にモニター。天井の隅の監視カメラが、この部屋を映している（自分が映る）。映像は少し違う:
 *     自分の後ろに人が立っている / 奥の壁の扉が開いている。
 *     裏の振る舞い [BO07]: モニターで扉が開いているのを見つめると、その扉が本当に開く（出現型。存在型 = 扉は最初からあり、映像では開いて見える）。
 *     「自分のいない部屋」は、同じ部屋の、自分の見ていない側にした
 * - mirrorDoor 鏡の中だけの扉 [O10]: 壁一面の鏡に、向かいの壁の扉が映る（振り向くと壁しかない）。鏡を見ながら後ろ向きにその壁へ下がると、壁が開く（出現型）
 */
import { box, type Box } from '../../../world/layout.ts';
import { defineGimmick } from '../types.ts';
import { aabbJson, freeWallSpan, innerRect, wallFrame } from '../util.ts';
import { freeWalls, roomRegion, wallBox, wallPoint } from './util.ts';

defineGimmick({
  id: 'photoBooth', name: '写真に写るもの', axes: ['sight'], kinds: ['room', 'hall'], minSize: [4.5, 5.5], weight: 0.3, intensity: 0, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance,
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    const e = s.entrance!;
    const F = wallFrame(innerRect(s), e.dir);
    const eu = F.u(e.pos[0], e.pos[2]);
    const side = eu - F.u0 > F.u1 - eu ? -1 : 1;
    const tu = eu + side * 1.0, fu = eu + side * 1.75;
    if (fu < F.u0 + 0.4 || fu > F.u1 - 0.4 || F.depth < 4.5) return;
    // 写す先: 入口の向かいの壁（無ければ横の壁）
    const far = ((e.dir + 2) % 4) as 0 | 1 | 2 | 3;
    const span = freeWallSpan(s, far, 1.6, 0.8);
    const w = span && !s.openings.some((o) => o.dir === far && Math.abs((far % 2 === 0 ? o.pos[0] : o.pos[2]) - span.at) < 1.4) ? { d: far, at: span.at } : freeWalls(ctx, 1.6)[0];
    if (!w) return;
    const [tx, tz] = F.point(tu, 1.25);
    const [px, pz] = F.point(fu, 1.05);
    const [dx, dz] = wallPoint(ctx, w.d, w.at, 0);
    const B: Box[] = [];
    // 三脚（脚 3 本と台）とカメラ（調べられる箱）
    for (const [ox, oz] of [[0.18, 0], [-0.09, 0.16], [-0.09, -0.16]] as const) B.push(box([tx + ox - 0.012, y, tz + oz - 0.012], [tx + ox * 0.2 + 0.012, y + 1.3, tz + oz * 0.2 + 0.012], 'metalDark', false));
    const head = { min: [tx - 0.12, y + 1.3, tz - 0.12], max: [tx + 0.12, y + 1.5, tz + 0.12] };
    B.push(box(head.min as [number, number, number], head.max as [number, number, number], 'metalDark', false));
    // 額（写真が出る）の台
    B.push(box([px - 0.03, y, pz - 0.03], [px + 0.03, y + 1.1, pz + 0.03], 'woodPanel', false));
    const stand = box([tx - 0.25, y, tz - 0.25], [tx + 0.25, y + 1.5, tz + 0.25], 'metalDark');
    stand.kind = 'colliderOnly';
    B.push(stand);
    for (const b of B) ctx.addBox(b);
    const fl = F.point(eu, 0.6);
    const cam = ctx.addEntity('camera', { type: 'photoCam', params: { box: aabbJson(head as never), eye: [tx, y + 1.42, tz], look: [dx, y + 1.1, dz], frame: [px, y + 1.4, pz], frameLook: [fl[0], fl[1]] } });
    const front = wallPoint(ctx, w.d, w.at, 0.9);
    const zone = ctx.addEntity('there', { type: 'zoneSensor', params: { aabb: aabbJson({ min: [front[0] - 0.8, y - 0.1, front[1] - 0.8], max: [front[0] + 0.8, y + 2, front[1] + 0.8] }) } });
    const both = ctx.addEntity('found', { type: 'and', params: {}, inputs: { a: `${cam}.taken`, b: `${zone}.in` } });
    const hold = ctx.addEntity('hold', { type: 'timer', params: { onDelay: 0.6, offDelay: 0 }, inputs: { in: `${both}.out` } });
    const c = innerRect(s);
    ctx.addEntity('ghost', { type: 'senseFx', params: { fx: 'photoGhost', cam, door: [w.d, w.at, y], ghost: [(c.x0 + c.x1) / 2, y, (c.z0 + c.z1) / 2] } });
    ctx.offerSecret({ hook: 'photo.door', modes: ['present', 'appear'], weight: 1, revealOutput: `${hold}.out`, doorway: { dir: w.d, at: w.at, y, width: 1.0, height: 2.0 }, tell: '写真にだけ写る、開いた扉' });
    ctx.keepOut({ min: [Math.min(tx, px) - 0.7, y, Math.min(tz, pz) - 0.7], max: [Math.max(tx, px) + 0.7, y + 2, Math.max(tz, pz) + 0.7] });
    ctx.keepOut({ min: [front[0] - 0.9, y, front[1] - 0.9], max: [front[0] + 0.9, y + 2.5, front[1] + 0.9] });
  },
});

defineGimmick({
  id: 'cctvRoom', name: '監視カメラの映像', axes: ['sight'], kinds: ['room', 'hall'], minSize: [4.5, 5.5], weight: 0.3, intensity: 0, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance,
  build(ctx) {
    const s = ctx.slot, t = ctx.tuning;
    const y = s.cell.floorY;
    const e = s.entrance!;
    const F = wallFrame(innerRect(s), e.dir);
    const eu = F.u(e.pos[0], e.pos[2]);
    const side = eu - F.u0 > F.u1 - eu ? -1 : 1;
    // 机とモニター: 入口の壁の隣の横の壁沿い（入口の側）。モニターは部屋の奥を向く
    const mu = side < 0 ? F.u0 + 0.45 : F.u1 - 0.45, mv = 1.9;
    if (F.depth < 5 || Math.abs(mu - eu) < 1.4) return;
    const desk = F.rect(mu - 0.4, mv - 0.6, mu + 0.4, mv + 0.6);
    const B: Box[] = [box([desk.x0, y, desk.z0], [desk.x1, y + 0.74, desk.z1], 'furnitureDark')];
    // モニターの画面: 机の上、部屋の奥（入口と反対の向き）ではなく、部屋の中を向く（横の壁を背にする）
    const screenC = F.point(mu - side * 0.08, mv);
    const sc: [number, number, number] = [screenC[0], y + 1.1, screenC[1]];
    const body = F.rect(mu + side * 0.05, mv - 0.32, mu + side * 0.15, mv + 0.32);
    B.push(box([body.x0, y + 0.8, body.z0], [body.x1, y + 1.36, body.z1], 'metalDark', false));
    // 監視カメラ: 入口の壁の、机と反対の隅の天井近く
    const cu = side < 0 ? F.u1 - 0.3 : F.u0 + 0.3;
    const [cx, cz] = F.point(cu, 0.3);
    const cy = y + s.cell.height - 0.35;
    B.push(box([cx - 0.1, cy - 0.08, cz - 0.1], [cx + 0.1, cy + 0.08, cz + 0.1], 'metalDark', false));
    for (const b of B) ctx.addBox(b);
    // 映す先: 奥の壁（入口の向かい）の扉の場所
    const far = ((e.dir + 2) % 4) as 0 | 1 | 2 | 3;
    const span = freeWallSpan(s, far, 1.6, 0.8);
    const w = span ? { d: far, at: span.at } : freeWalls(ctx, 1.6).find((x) => x.d !== e.dir);
    if (!w) return;
    const [dx, dz] = wallPoint(ctx, w.d, w.at, 0);
    // 映像の中の人影: 机の前に立つ人（モニターを見ている人）のすぐ後ろ
    const ghost = F.point(mu - side * 1.3, mv + 0.2);
    // 画面の向き（部屋の中へ）: 机のある横の壁から離れる向き
    const p0 = F.point(0, 0), p1 = F.point(1, 0);
    const screenNormal = [-side * (p1[0] - p0[0]), -side * (p1[1] - p0[1])];
    const watch = ctx.addEntity('watch', { type: 'gazeSensor', params: { target: sc, deg: 12, maxDist: 4, still: false, sec: t['sense.cctv.watchSec'], region: roomRegion(s) } });
    ctx.addEntity('feed', {
      type: 'senseFx',
      params: {
        fx: 'cctv', cam: [cx, cy, cz], look: [(dx + screenC[0]) / 2, y + 0.9, (dz + screenC[1]) / 2], screen: sc, screenNormal,
        screenW: 0.56, screenH: 0.4, ghost: [ghost[0], y, ghost[1]], door: [w.d, w.at, y], watch,
      },
    });
    ctx.offerSecret({ hook: 'cctv.door', modes: ['present', 'appear'], weight: 1, revealOutput: `${watch}.done`, doorway: { dir: w.d, at: w.at, y, width: 1.0, height: 2.0 }, tell: 'モニターの中だけ開いている扉' });
    ctx.keepOut({ min: [desk.x0 - 0.9, y, desk.z0 - 0.9], max: [desk.x1 + 0.9, y + 2, desk.z1 + 0.9] });
    const front = wallPoint(ctx, w.d, w.at, 0.9);
    ctx.keepOut({ min: [front[0] - 0.9, y, front[1] - 0.9], max: [front[0] + 0.9, y + 2.5, front[1] + 0.9] });
  },
});

defineGimmick({
  id: 'mirrorDoor', name: '鏡の中だけの扉', axes: ['sight'], kinds: ['room', 'hall'], minSize: [4, 5], weight: 0.3, intensity: 0, offersSecret: true, requiresSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance,
  build(ctx) {
    const s = ctx.slot, t = ctx.tuning;
    const y = s.cell.floorY;
    // 鏡: 開口の無い壁。扉: 向かいの壁の、鏡の真向かい
    for (const m of freeWalls(ctx, 2.2)) {
      const opp = ((m.d + 2) % 4) as 0 | 1 | 2 | 3;
      const span = freeWallSpan(s, opp, 1.6, 0.8);
      if (!span) continue;
      const at = Math.min(Math.max(m.at, span.a0 + 0.8), span.a1 - 0.8);
      if (at < m.a0 + 0.9 || at > m.a1 - 0.9) continue;
      const B: Box[] = [wallBox(ctx, m.d, at, 1.0, y + 0.15, y + 2.25, 0, 0.03, 'trim')];
      for (const b of B) ctx.addBox(b);
      const [mx, mz] = wallPoint(ctx, m.d, at, 0.035);
      const mirror: [number, number, number] = [mx, y + 1.2, mz];
      const [fx, fz] = wallPoint(ctx, opp, at, 0.9);
      const zone = ctx.addEntity('near', { type: 'zoneSensor', params: { aabb: aabbJson({ min: [fx - 0.8, y - 0.1, fz - 0.8], max: [fx + 0.8, y + 2, fz + 0.8] }) } });
      const look = ctx.addEntity('look', { type: 'gazeSensor', params: { target: mirror, deg: 22, maxDist: 30, still: false, sec: 0.1, region: roomRegion(s) } });
      const both = ctx.addEntity('both', { type: 'and', params: {}, inputs: { a: `${zone}.in`, b: `${look}.gazing` } });
      const hold = ctx.addEntity('hold', { type: 'timer', params: { onDelay: t['sense.gaze.sec'] * 0.5, offDelay: 0 }, inputs: { in: `${both}.out` } });
      ctx.addEntity('mirror', { type: 'senseFx', params: { fx: 'mirror', dir: m.d, at, y, w: 1.9, h: 2.0, wall: wallPoint(ctx, m.d, at, 0)[m.d % 2 === 0 ? 1 : 0], door: [opp, at, y] } });
      ctx.offerSecret({ hook: 'mirror.door', modes: ['appear'], weight: 1, required: true, revealOutput: `${hold}.out`, doorway: { dir: opp, at, y, width: 1.0, height: 2.0 }, tell: '鏡に映る、向かいの壁の扉' });
      ctx.keepOut({ min: [fx - 0.9, y, fz - 0.9], max: [fx + 0.9, y + 2.5, fz + 0.9] });
      const [nx, nz] = wallPoint(ctx, m.d, at, 0.8);
      ctx.keepOut({ min: [nx - 1.1, y, nz - 1.1], max: [nx + 1.1, y + 2.5, nz + 1.1] });
      return;
    }
  },
});
