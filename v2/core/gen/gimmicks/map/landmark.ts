/**
 * 霧の中の塔（N05 ランドマーク）: 部屋まるごとが濃い霧（数 m 先が見えない）。背の高い仕切りと柱が立ち並び、まっすぐは進めない。
 * 出口の近くに塔が 1 本立ち、てっぺんの赤い灯りだけが霧を通して見える（明滅）。灯りを目印に歩けば出口に着く。
 *
 * - 目標: 塔（の足元の出口）へ行く / 規則: 霧の中で見えるのは塔の灯りだけ。仕切りに沿って回り込む
 * - 失敗の代償: 迷う（時間を失う）。閉じ込めない: 仕切りは置くたびに開口どうしが歩いてつながるかを確かめる
 * - 隠し（landmark.away）: 塔から離れて、霧のいちばん奥（塔から遠い壁）へ行く。
 *     存在型 = 霧に隠れた壁と同じ色の扉 / 出現型 = 塔から map.fogTower.awayM 以上離れて map.fogTower.awaySec 秒いると壁が開く
 * - 地図: 塔は地図に ▲ で出る（部品 landmark）。霧の中でも、歩いた所は地図の升目が埋まる（調べていない所の影が残る）
 * 裏のフロアは霧を調子の霧で上書きするので、表のフロアだけに置く。
 */
import { box, type Box, type WallOpening } from '../../../world/layout.ts';
import type { Rect } from '../../../world/footprint.ts';
import type { Dir } from '../../../math/vec.ts';
import { reachOpenings } from '../../reach.ts';
import { mixColor } from '../../anomaly/util.ts';
import { defineGimmick } from '../types.ts';
import { aabbJson, doorZone, freeWallSpan, frontOf, innerRect, inward } from '../util.ts';

const overlapR = (a: Rect, b: Rect, gap = 0): boolean => a.x0 < b.x1 + gap && a.x1 > b.x0 - gap && a.z0 < b.z1 + gap && a.z1 > b.z0 - gap;

defineGimmick({
  id: 'fogTower', name: '霧の中の塔', axes: ['sight'], kinds: ['hall', 'room'], minSize: [7, 8], minHeight: 3.0, weight: 2.5, intensity: 1, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance && !!s.exit,
  build(ctx) {
    const s = ctx.slot, t = ctx.tuning, cell = s.cell, y = cell.floorY;
    // 裏のフロア（id が '深さ.1' など）は霧が調子で上書きされるので置かない
    if (ctx.floor.id !== 'lab' && (ctx.floor.variant !== undefined ? ctx.floor.variant > 0 : !ctx.floor.id.endsWith('.0'))) return;
    const r = innerRect(s);
    const ex = s.exit!, en = s.entrance!;
    // 塔: 出口の前 2.6 m、横に 1.3 m ずらす（出口への道を塞がない）
    const [ix, iz] = inward(ex);
    const f = frontOf(ex, 2.6);
    const side = ctx.rng.chance(0.5) ? 1 : -1;
    const tx = Math.min(r.x1 - 0.9, Math.max(r.x0 + 0.9, f[0] + (ix === 0 ? side * 1.3 : 0)));
    const tz = Math.min(r.z1 - 0.9, Math.max(r.z0 + 0.9, f[2] + (iz === 0 ? side * 1.3 : 0)));
    const H = Math.min(6, cell.height - 0.35);
    const tower: Rect = { x0: tx - 0.32, z0: tz - 0.32, x1: tx + 0.32, z1: tz + 0.32 };
    // 隠しの壁: 開口の無い壁のうち、塔からいちばん遠い所
    let secret: { dir: Dir; at: number; front: [number, number] } | null = null;
    let best = -1;
    for (const d of [0, 1, 2, 3] as const) {
      const span = freeWallSpan(s, d, 1.8);
      if (!span) continue;
      const wx = d === 1 ? r.x1 : d === 3 ? r.x0 : span.at, wz = d === 0 ? r.z1 : d === 2 ? r.z0 : span.at;
      const dist = Math.hypot(wx - tx, wz - tz);
      if (dist > best) { best = dist; secret = { dir: d, at: span.at, front: [wx, wz] }; }
    }
    // 取っておく所: 開口の前・塔のまわり・隠しの扉の前
    const reserve: Rect[] = s.openings.map((o) => { const z = doorZone(o, y, 2.0, 0.5); return { x0: z.min[0], z0: z.min[2], x1: z.max[0], z1: z.max[2] }; });
    reserve.push({ x0: tx - 1.4, z0: tz - 1.4, x1: tx + 1.4, z1: tz + 1.4 });
    let doorOpening: WallOpening | null = null;
    if (secret) {
      const pos: [number, number, number] = secret.dir === 0 || secret.dir === 2 ? [secret.at, y, secret.dir === 0 ? r.z1 + 0.15 : r.z0 - 0.15] : [secret.dir === 1 ? r.x1 + 0.15 : r.x0 - 0.15, y, secret.at];
      doorOpening = { id: `${ctx.id}:away`, pos, dir: secret.dir, width: 1.0, height: 2.0 };
      const z = doorZone(doorOpening, y, 1.6, 0.4);
      reserve.push({ x0: z.min[0], z0: z.min[2], x1: z.max[0], z1: z.max[2] });
    }
    // 仕切りと柱（背の高い物）: 先に決める（置くたびに、開口どうし・隠しの扉の前へ歩けるかを確かめる。まだ区画には足さない）
    const towerBoxes: Box[] = [box([tower.x0, y, tower.z0], [tower.x1, y + H, tower.z1], 'metalDark'), box([tx - 0.6, y, tz - 0.6], [tx + 0.6, y + 0.12, tz + 0.6], 'columnConcrete')];
    const base = cell.boxes.length;
    cell.boxes.push(...towerBoxes);
    const area = (r.x1 - r.x0) * (r.z1 - r.z0);
    const want = Math.round((area / 10) * t['map.fogTower.pillarPer10']);
    const ph = Math.min(2.6, cell.height - 0.3);
    const placed: Rect[] = [];
    const walls: Box[] = [];
    const targets = [en, ...s.openings.filter((o) => o !== en), ...(doorOpening ? [doorOpening] : [])];
    const ok = (grid: number): boolean => { const reach = reachOpenings({ footprint: cell.footprint, floorY: y, boxes: cell.boxes }, targets, grid); return !reach || !reach.blocked.length; };
    const mats = ['wallConcrete', cell.palette.wall, 'columnConcrete'] as const;
    for (let i = 0; i < want * 10 && placed.length < want; i++) {
      let q: Rect;
      if (ctx.rng.chance(0.55)) {
        const len = ctx.rng.float(1.4, 3.2), alongX = ctx.rng.chance(0.5);
        const cx = ctx.rng.float(r.x0 + 0.7, r.x1 - 0.7), cz = ctx.rng.float(r.z0 + 0.7, r.z1 - 0.7);
        q = alongX ? { x0: cx - len / 2, z0: cz - 0.09, x1: cx + len / 2, z1: cz + 0.09 } : { x0: cx - 0.09, z0: cz - len / 2, x1: cx + 0.09, z1: cz + len / 2 };
      } else {
        const w = ctx.rng.float(0.5, 0.9);
        const cx = ctx.rng.float(r.x0 + 0.7, r.x1 - 0.7), cz = ctx.rng.float(r.z0 + 0.7, r.z1 - 0.7);
        q = { x0: cx - w / 2, z0: cz - w / 2, x1: cx + w / 2, z1: cz + w / 2 };
      }
      if (q.x0 < r.x0 + 0.05 || q.x1 > r.x1 - 0.05 || q.z0 < r.z0 + 0.05 || q.z1 > r.z1 - 0.05) continue;
      if (reserve.some((x) => overlapR(x, q)) || placed.some((x) => overlapR(x, q, 0.95))) continue;
      const b: Box = box([q.x0, y, q.z0], [q.x1, y + ph, q.z1], ctx.rng.pick(mats));
      cell.boxes.push(b);
      if (!ok(0.2)) { cell.boxes.pop(); continue; }
      placed.push(q);
      walls.push(b);
    }
    // 仕上げの確かめ（置いたあとの検査と同じ細かさ）。だめなら後から置いた物を外す
    while (walls.length && !ok(0.1)) { cell.boxes.splice(cell.boxes.indexOf(walls.pop()!), 1); placed.pop(); }
    const fine = ok(0.1);
    cell.boxes.length = base;
    if (!fine || placed.length < Math.min(4, want)) return;
    // ここから区画に足す: 塔（てっぺんに灯り。途中の踊り場の張り出しで、霧の中で近づくと形が分かる）・仕切り
    for (const b of towerBoxes) ctx.addBox(b);
    for (const hy of [H * 0.45, H * 0.8]) ctx.addBox(box([tx - 0.48, y + hy, tz - 0.48], [tx + 0.48, y + hy + 0.06, tz + 0.48], 'metal', false));
    for (const b of walls) ctx.addBox(b);
    const top: [number, number, number] = [tx, y + H + 0.16, tz];
    ctx.addEntity('beacon', { type: 'landmark', params: { pos: [...top], color: 0xff4a32, blinkSec: t['map.fogTower.blinkSec'], name: '塔' } });
    cell.lights.push({ pos: [tx, y + H - 0.2, tz], color: 0xff6048, intensity: 0.45, distance: 5 });
    // 霧（部屋の中だけ。白っぽい灰色）
    const color = mixColor(0x8e9499, cell.palette.lightColor, 0.2);
    cell.render = { ...cell.render, fog: { color, near: t['map.fogTower.fogNearM'], far: t['map.fogTower.fogFarM'] } };
    cell.palette = { ...cell.palette, fog: color };
    if (secret && doorOpening) {
      // 離れる距離: 隠しの壁の前（壁から内側 0.9 m 余り）で届く距離まで縮める（小さな部屋では awayM 離れられる所が無い）。塔の灯りとの 3 次元の距離
      const fx = secret.front[0], fz = secret.front[1];
      const reach = Math.hypot(fx - top[0], (y + 1.0) - top[1], fz - top[2]) - 1.2;
      const dist = Math.min(t['map.fogTower.awayM'], reach);
      // 4 m も離れられない部屋では、現れる隠しにしない（壁と同じ色の扉だけ）
      const modes: ('present' | 'appear')[] = dist >= 4 ? ['present', 'appear'] : ['present'];
      const away = ctx.addEntity('away', { type: 'distanceSensor', params: { target: [...top], dist, mode: 'far', sec: t['map.fogTower.awaySec'], aabb: aabbJson({ min: [r.x0, y - 0.5, r.z0], max: [r.x1, y + 2.5, r.z1] }) } });
      ctx.offerSecret({ hook: 'landmark.away', modes, weight: 1.1, revealOutput: `${away}.done`, doorway: { dir: secret.dir, at: secret.at, y, width: 1.0, height: 2.0 }, tell: '霧のいちばん奥、塔の灯りが届かない所' });
    }
    // 家具は置かない（霧と仕切りだけの部屋）
    ctx.keepOut({ min: [r.x0, y - 0.1, r.z0], max: [r.x1, y + cell.height, r.z1] });
  },
});
