/**
 * ScaleAnomaly — 縮尺異常（R13 巨大児童遊園 ×3 / L17 無限団地 ×1.5 / M12 巨大Common ×4 / R16 縮尺異常オフィス perProp 0.5〜2 / L12 設備大聖堂 perProp 3〜8）。
 * params: mode('room' | 'perProp') / scale（room）/ min, max（perProp）/ smallDoor('crawl' で R16 の小型扉）。
 *
 * Three.js の Group スケールではなく layout フック（決定論の post-pass）で RoomLayout を書き換える。配置 fits() と Portal 接続に効き、
 * 「入室後に部屋が変わらない」不変条件を保つ（build / update は持たない）。
 *
 * mode 'room': footprint 矩形・height・全箱・照明（位置・distance、intensity は s² で明るさを保つ）・ゾーン等を原点基準で ×s し、
 *   外殻を捨てて「拡大後の矩形 + 通常寸法のソケット（位置だけ ×s）」で buildShell を再実行する → 巨大な空間に普通の扉。
 *   - 直結用の extraSockets は WorldManager が拡大後の座標で作るので位置を変えない（socketSig の安定性）。
 *   - 床穴は出さない（拡大後の穴は真下の部屋の天井穴 1.4 m と合わない）。hole 入口は天井穴 1.4 m を拡大後の位置に切り直す。
 *   - 入口ラベルは人が読む寸法のまま、ソケットからの相対位置を保って置く。
 *   - p.mainRect（grow-to-fill）は拡大後座標で保存される → 生成器が読むとさらに ×s になるが、WorldManager が fits() で検証して
 *     入らなければ取り消すので破綻はしない（成長が効きにくいだけ。生成器側で 1/s する変更は共有ファイルなので行わない）。
 * mode 'perProp': shellCount 以降の内装を、同じ xz 範囲を持つ箱をひとまとめ（机 + 天板など）にして [min, max] 倍。
 *   床置きは底面中心基準（高さは天井 -0.3 でクランプ）、天井付きは xz のみ、それ以外は中心基準。
 *   壁からの余白は「0.9 m と元の余白の小さい方」を保ち、収まらないときは倍率を落として通路を確保する（捨てずにクランプ）。
 *   smallDoor='crawl'（R16）: 出口ソケット 1 つを CRAWL_DOOR_W×CRAWL_DOOR_H（0.7×1.2）crawl=true にして外殻を組み直す
 *   （WorldManager が crawl Adapter を挟む近道）。選ぶ id は removedSockets を含む「元の出口集合」から決めるので、扉が壁に戻されても他の扉が変わらない。
 *   巨大扉: 空いた壁面に 2.0 m × (h-0.15) の偽扉箱（doorWood + trim。開かない、コライダあり）を 1〜2 枚。
 * 両モード共通: 最後に clearDoorways で扉前を空ける。Tier 差なし（描画量は元の箱数と同じ）。
 */
import { aabbFromCenter, type AABB } from '../../core/aabb';
import type { Socket, Vec3 } from '../../core/types';
import type { Rng } from '../../core/rng';
import { clearDoorways } from '../../generators/common';
import { buildShell, footprintAABB, inRect, pickSpanPosition, wallSpans, type Rect } from '../../generators/footprint';
import { box, CRAWL_DOOR_H, CRAWL_DOOR_W, HOLE_SIZE, WALL_T, type Box, type RoomLayout } from '../../generators/layout';
import type { GenParams } from '../../generators/layout';
import type { ModifierImpl, ModifierParams } from '../types';
import { num, str } from '../util';

const mul = (v: Vec3, s: number): Vec3 => [v[0] * s, v[1] * s, v[2] * s];
const scaleAABB = (a: AABB, s: number): AABB => ({ min: mul(a.min, s), max: mul(a.max, s) });

/** 外殻を組み直す（床穴なし。hole 入口なら天井穴 1.4 m） */
function rebuildShell(L: RoomLayout, rects: Rect[], h: number): number {
  const entry = L.sockets.find((s) => s.id === 'entry');
  const ceilingHoles: AABB[] = entry && entry.type === 'hole' ? [aabbFromCenter(entry.pos[0], h + 0.1, entry.pos[2], HOLE_SIZE / 2, 0.2, HOLE_SIZE / 2)] : [];
  const shell: Box[] = [];
  buildShell(shell, rects, h, L.sockets, { floor: L.palette.floor, wall: L.palette.wall, ceiling: L.palette.ceiling, floorHoles: L.holes, ceilingHoles });
  L.boxes.splice(0, L.shellCount ?? 0, ...shell);
  L.shellCount = shell.length;
  return shell.length;
}

// ---------------------------------------------------------------- mode 'room'

function scaleRoom(L: RoomLayout, p: GenParams, s: number): void {
  if (Math.abs(s - 1) < 1e-6) return;
  if (L.shellCount === undefined || L.footprint.length === 0) {
    console.warn(`[ScaleAnomaly] ${p.def.id}: shellCount / footprint が無いので room モードを適用できない`);
    return;
  }
  const extraIds = new Set(p.extraSockets.map((x) => x.id));
  const h0 = L.height;
  const h = h0 * s;

  // 足跡・高さ・bounds
  L.footprint = L.footprint.map((r) => ({ x0: r.x0 * s, z0: r.z0 * s, x1: r.x1 * s, z1: r.z1 * s }));
  L.height = h;
  L.bounds = footprintAABB(L.footprint, h);

  // ソケット: 寸法はそのまま、位置だけ ×s。床穴は出さない。直結用の extraSockets は拡大後座標で来るので触らない
  const original = L.sockets.map((x) => ({ ...x, pos: [...x.pos] as Vec3 }));
  L.sockets = L.sockets.filter((x) => !(x.type === 'hole' && x.id !== 'entry'));
  for (const x of L.sockets) {
    if (extraIds.has(x.id)) continue;
    if (x.type === 'hole') x.pos = [x.pos[0] * s, h + 0.2, x.pos[2] * s];
    else x.pos = mul(x.pos, s);
  }
  L.holes = [];

  // 箱（外殻は後で捨てる）・照明
  L.boxes = L.boxes.map((b) => ({ ...b, min: mul(b.min, s), max: mul(b.max, s) }));
  for (const l of L.lights) {
    l.pos = mul(l.pos, s);
    l.distance *= s;
    l.intensity *= s * s;
  }
  // ラベル: 人が読む寸法のまま、最も近い元ソケットからの相対位置を保つ
  for (const lb of L.labels) {
    let best: Socket | null = null;
    let bd = Infinity;
    for (const x of original) {
      if (extraIds.has(x.id)) continue;
      const d = Math.hypot(x.pos[0] - lb.pos[0], x.pos[2] - lb.pos[2]);
      if (d < bd) { bd = d; best = x; }
    }
    if (best && bd < 3) lb.pos = [best.pos[0] * s + (lb.pos[0] - best.pos[0]), lb.pos[1], best.pos[2] * s + (lb.pos[2] - best.pos[2])];
    else lb.pos = mul(lb.pos, s);
  }
  // v1.3 任意フィールド（あれば ×s）
  if (L.signs) for (const sg of L.signs) { sg.pos = mul(sg.pos, s); sg.width *= s; }
  if (L.zones) for (const z of L.zones) z.aabb = scaleAABB(z.aabb, s);
  if (L.instances) for (const inst of L.instances) { inst.size = mul(inst.size, s); for (const t of inst.transforms) t.pos = mul(t.pos, s); }
  if (L.particles?.aabb) L.particles.aabb = scaleAABB(L.particles.aabb, s);
  if (L.decals) for (const d of L.decals) { d.pos = mul(d.pos, s); d.size = [d.size[0] * s, d.size[1] * s]; }
  if (L.dynamics) for (const d of L.dynamics) { d.box = { ...d.box, min: mul(d.box.min, s), max: mul(d.box.max, s) }; d.motion.amplitude *= d.motion.kind === 'rotate' ? 1 : s; }
  if (L.path) L.path = L.path.map((v) => mul(v, s));
  if (L.mirrors) for (const m of L.mirrors) { m.pos = mul(m.pos, s); m.size = [m.size[0] * s, m.size[1] * s]; }
  if (L.rides) for (const r of L.rides) r.path = r.path.map((v) => mul(v, s));
  L.elevators = L.elevators.map((e) => ({ ...e, volume: scaleAABB(e.volume, s), button: mul(e.button, s) }));

  // 外殻を通常寸法の開口で組み直す
  const shellCount = rebuildShell(L, L.footprint, h);
  clearDoorways(L, L.sockets, shellCount);
}

// ---------------------------------------------------------------- mode 'perProp'

/** 同じ xz 範囲の箱をひとまとめにする（机 + 天板、什器 + 上面など） */
function groupByFootprint(boxes: Box[]): Box[][] {
  const map = new Map<string, Box[]>();
  const order: Box[][] = [];
  for (const b of boxes) {
    const key = [b.min[0], b.min[2], b.max[0], b.max[2]].map((v) => v.toFixed(2)).join(',');
    let g = map.get(key);
    if (!g) { g = []; map.set(key, g); order.push(g); }
    g.push(b);
  }
  return order;
}

function rectOf(rects: Rect[], x: number, z: number): Rect {
  for (const r of rects) if (inRect(r, x, z, -0.05)) return r;
  let best = rects[0];
  let bd = Infinity;
  for (const r of rects) {
    const d = Math.hypot((r.x0 + r.x1) / 2 - x, (r.z0 + r.z1) / 2 - z);
    if (d < bd) { bd = d; best = r; }
  }
  return best;
}

function scalePerProp(L: RoomLayout, p: GenParams, params: ModifierParams, rng: Rng): void {
  if (L.shellCount === undefined || L.footprint.length === 0) {
    console.warn(`[ScaleAnomaly] ${p.def.id}: shellCount / footprint が無いので perProp モードを適用できない`);
    return;
  }
  const fmin = Math.max(0.1, num(params.min, 0.5));
  const fmax = Math.max(fmin, num(params.max, 2.0));
  const h = L.height;
  const shellCount = L.shellCount;
  const pr = rng.fork('props');
  const groups = groupByFootprint(L.boxes.slice(shellCount));
  const out: Box[] = [];
  for (const g of groups) {
    const gmin: Vec3 = [Math.min(...g.map((b) => b.min[0])), Math.min(...g.map((b) => b.min[1])), Math.min(...g.map((b) => b.min[2]))];
    const gmax: Vec3 = [Math.max(...g.map((b) => b.max[0])), Math.max(...g.map((b) => b.max[1])), Math.max(...g.map((b) => b.max[2]))];
    // 天井の非ソリッド箔（パネル灯）は縮尺の対象外（照明は部屋の寸法に合わせたまま）
    if (gmin[1] > h - 0.3 && g.every((b) => !b.solid)) { out.push(...g); continue; }
    const f = pr.float(fmin, fmax);
    const cx = (gmin[0] + gmax[0]) / 2;
    const cz = (gmin[2] + gmax[2]) / 2;
    const r = rectOf(L.footprint, cx, cz);
    // 壁からの余白: 0.9 m と元の余白の小さい方を保つ（通路の確保。壁沿いの什器は壁沿いのまま）
    const inset = WALL_T + 0.02;
    const lim = {
      x0: r.x0 + Math.min(0.9, Math.max(inset, gmin[0] - r.x0)),
      x1: r.x1 - Math.min(0.9, Math.max(inset, r.x1 - gmax[0])),
      z0: r.z0 + Math.min(0.9, Math.max(inset, gmin[2] - r.z0)),
      z1: r.z1 - Math.min(0.9, Math.max(inset, r.z1 - gmax[2])),
    };
    const w = gmax[0] - gmin[0];
    const d = gmax[2] - gmin[2];
    const fitXZ = Math.min((lim.x1 - lim.x0) / Math.max(0.05, w), (lim.z1 - lim.z0) / Math.max(0.05, d));
    const fxz = Math.max(0.1, Math.min(f, fitXZ));
    // 縦: 床置きは底面基準（天井 -0.3 でクランプ）、天井付きは動かさない、それ以外は中心基準
    const onFloor = gmin[1] < 0.05;
    const onCeiling = gmax[1] > h - 0.3;
    const gh = gmax[1] - gmin[1];
    let mapY: (y: number) => number;
    if (onFloor && onCeiling) mapY = (y) => y;
    else if (onCeiling) mapY = (y) => y;
    else if (onFloor) {
      const fy = Math.min(f, Math.max(0.1, (h - 0.3) / Math.max(0.05, gh)));
      mapY = (y) => y * fy;
    } else {
      const cy = (gmin[1] + gmax[1]) / 2;
      const fy = Math.min(f, Math.max(0.1, (h - 0.15 - cy) / Math.max(0.05, gh / 2)), Math.max(0.1, (cy - 0.05) / Math.max(0.05, gh / 2)));
      mapY = (y) => cy + (y - cy) * fy;
    }
    // 中心基準で xz を伸縮し、余白の限界を越えた分は内側へずらす
    let nx0 = cx - (w / 2) * fxz;
    let nx1 = cx + (w / 2) * fxz;
    let nz0 = cz - (d / 2) * fxz;
    let nz1 = cz + (d / 2) * fxz;
    if (nx0 < lim.x0) { nx1 += lim.x0 - nx0; nx0 = lim.x0; }
    if (nx1 > lim.x1) { nx0 -= nx1 - lim.x1; nx1 = lim.x1; }
    if (nz0 < lim.z0) { nz1 += lim.z0 - nz0; nz0 = lim.z0; }
    if (nz1 > lim.z1) { nz0 -= nz1 - lim.z1; nz1 = lim.z1; }
    const mapX = (x: number) => (w < 1e-6 ? nx0 : nx0 + ((x - gmin[0]) / w) * (nx1 - nx0));
    const mapZ = (z: number) => (d < 1e-6 ? nz0 : nz0 + ((z - gmin[2]) / d) * (nz1 - nz0));
    for (const b of g) {
      out.push({ ...b, min: [mapX(b.min[0]), mapY(b.min[1]), mapZ(b.min[2])], max: [mapX(b.max[0]), mapY(b.max[1]), mapZ(b.max[2])] });
    }
  }
  L.boxes = [...L.boxes.slice(0, shellCount), ...out];

  // R16: 小型扉 = 出口ソケット 1 つを 0.7×1.2 の crawl 開口に。選択は「元の出口集合」（removedSockets を含む）から決める
  let shellDirty = false;
  if (str(params.smallDoor, 'none') === 'crawl') {
    const extraIds = new Set(p.extraSockets.map((x) => x.id));
    const isExit = (id: string) => id !== 'entry' && id !== 'hole' && !extraIds.has(id) && !/^x\d+$/.test(id);
    const pool = new Set<string>();
    for (const s of L.sockets) if (s.type === 'door' && isExit(s.id)) pool.add(s.id);
    for (const id of p.removedSockets) if (isExit(id)) pool.add(id);
    const ids = [...pool].sort();
    if (ids.length > 0) {
      const chosen = rng.fork('smallDoor').pick(ids);
      const s = L.sockets.find((x) => x.id === chosen && x.type === 'door');
      if (s) {
        s.width = CRAWL_DOOR_W;
        s.height = CRAWL_DOOR_H;
        s.crawl = true;
        delete s.sill;
        shellDirty = true;
      }
    }
  }

  // 巨大扉: 空いた壁面の偽扉（開かない。コライダあり）
  const gr = rng.fork('fakeDoors');
  const giantW = 2.0;
  const giantH = Math.min(h - 0.15, 4.5);
  const spans = wallSpans(L.footprint).filter((sp) => sp.a1 - sp.a0 >= giantW + 3.0);
  const want = spans.length === 0 ? 0 : Math.min(2, Math.max(1, Math.round(spans.length / 3)));
  const placedSockets: Socket[] = [...L.sockets];
  for (let i = 0; i < want && spans.length > 0; i++) {
    const sp = gr.pick(spans);
    const t = pickSpanPosition(sp, placedSockets, giantW, gr.next(), 1.2);
    if (t === null) continue;
    const e = sp.edge;
    const inset = WALL_T;
    const th = 0.06;
    const put = (t0: number, t1: number, y0: number, y1: number, depth0: number, depth1: number, mat: Box['mat'], solid: boolean) => {
      switch (e.dir) {
        case 0: L.boxes.push(box([t0, y0, e.coord - inset - depth1], [t1, y1, e.coord - inset - depth0], mat, solid)); break;
        case 2: L.boxes.push(box([t0, y0, e.coord + inset + depth0], [t1, y1, e.coord + inset + depth1], mat, solid)); break;
        case 1: L.boxes.push(box([e.coord - inset - depth1, y0, t0], [e.coord - inset - depth0, y1, t1], mat, solid)); break;
        default: L.boxes.push(box([e.coord + inset + depth0, y0, t0], [e.coord + inset + depth1, y1, t1], mat, solid)); break;
      }
    };
    put(t - giantW / 2, t + giantW / 2, 0, giantH, 0, th, L.palette.door, true);
    put(t - giantW / 2 - 0.12, t + giantW / 2 + 0.12, giantH, giantH + 0.15, 0, th + 0.03, 'trim', false);
    put(t - giantW / 2 - 0.12, t - giantW / 2, 0, giantH, 0, th + 0.03, 'trim', false);
    put(t + giantW / 2, t + giantW / 2 + 0.12, 0, giantH, 0, th + 0.03, 'trim', false);
    // ノブ（巨大扉に合わせて高い位置）
    put(t + giantW / 2 - 0.35, t + giantW / 2 - 0.2, giantH * 0.45, giantH * 0.45 + 0.12, th, th + 0.12, 'metal', false);
    // 以降の偽扉・扉前クリアの基準にダミーソケットとして登録（位置だけ）
    const pos: Vec3 = e.dir === 0 || e.dir === 2 ? [t, 0, e.coord] : [e.coord, 0, t];
    placedSockets.push({ id: `fake${i}`, type: 'door', pos, dir: e.dir, width: giantW, height: giantH });
  }

  if (shellDirty) rebuildShell(L, L.footprint, h);
  clearDoorways(L, L.sockets, L.shellCount ?? shellCount);
}

const ScaleAnomaly: ModifierImpl = {
  id: 'ScaleAnomaly',
  defaults: { mode: 'room', scale: 1.0, min: 0.5, max: 2.0, smallDoor: 'none' },

  layout(L, p, params, rng) {
    const mode = str(params.mode, 'room');
    if (mode === 'room') scaleRoom(L, p, Math.max(0.25, num(params.scale, 1)));
    else if (mode === 'perProp') scalePerProp(L, p, params, rng);
    else console.warn(`[ScaleAnomaly] ${p.def.id}: 未知の mode '${mode}'`);
  },
};

export default ScaleAnomaly;
