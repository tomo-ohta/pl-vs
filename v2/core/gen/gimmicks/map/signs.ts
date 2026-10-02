/**
 * フロアの地図の看板と、落ちている誰かの地図（2.14）。仕掛けではなく、フロアに 1 枚ずつ置く「地図の層」。
 * フロアの生成（core/gen/floor/index.ts）が、区画の中身（家具）を置いた後に placeMapSigns を呼ぶ（壁と床の空いている所を探す）。
 * どれも当たり判定の無い板と、調べる（E / タップ）と読める部品（core/sim/parts/map の mapBoard / mapNote）。
 * 読むと、その地図の形と書き込みが自分の地図に点線で写る（client/map/scene.ts の ghostOf）。
 *
 * - N07 フロア案内図（mode 'guide'）: 入口の部屋の壁。廊下・広間・階段・出口だけを描いた案内図（部屋は扉の向こうの楽しみに残す）。
 *     一部だけ実際と違う（嘘）: 'secret' 隠し場所の所に部屋を描く（あるはずの部屋が見つからない → 隠しの手がかり）/
 *     'exit' 出口の印を別の部屋に描く / 'phantom' 無い廊下を描く / 'missing' ある廊下を描かない。重みは調整表 map.guide.lie.*
 * - N04 現在地の看板（mode 'here'）: 廊下・曲がり角・広間の壁。まわりの地図に「現在地」の赤い丸。その丸は自分のいない場所を指す。
 *     指す先は、誰かの地図が落ちている所 → 隠しのある部屋 → 遠くの部屋 の順（嘘の先に何かがある。確かめに行く楽しさ）
 * - N09 他人の地図（mapNote）: 脇道の部屋の床に落ちている、誰か（作り置きの「誰か」）の地図。誰かが歩いた範囲・歩いた跡・書き込み
 *     （出口・落ちた・ここで迷った・壁の向こうから音がする …）。書き込みの 1 つは勘違いのことがある（map.note.wrongChance）。
 *     非同期マルチプレイの下地: 書き込みの形（marks: x, z, text, kind / trail / cells / author / date）は他のプレイヤーの地図と同じにする。
 *     持ち運ぶ仕組み（carry の担当）とは後でつなぐ（いまは調べると読める）
 */
import type { Tuning } from '../../../config/tuning.ts';
import { hashAll, Rng } from '../../../math/rng.ts';
import type { Rect } from '../../../world/footprint.ts';
import { box, type Box, type EntitySpec, type Json } from '../../../world/layout.ts';
import type { PlacedAnomaly } from '../../anomaly/index.ts';
import { alongFace, freeRuns, innerFaces, type Face } from '../../dress/geom.ts';
import type { FloorGeometry, GeoCell } from '../../floor/geometry.ts';
import type { GimmickResult } from '../../floor/gimmicks.ts';
import type { FloorProfile } from '../../floor/profile.ts';
import { gimmickDef } from '../types.ts';

export interface MapSignsResult {
  guide: string | null;
  here: string[];
  note: string | null;
  /** 案内図の嘘の種類 */
  lie: string | null;
}

const center = (r: Rect): [number, number] => [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2];
const mainRect = (g: GeoCell): Rect => g.cell.footprint.reduce((a, x) => ((x.x1 - x.x0) * (x.z1 - x.z0) > (a.x1 - a.x0) * (a.z1 - a.z0) ? x : a));
const cellCenter = (g: GeoCell): [number, number] => center(mainRect(g));
const r2 = (v: number): number => Math.round(v * 100) / 100;

/** 箱が重なるか（少しでも） */
const hit = (a: Box, b: Box): boolean => a.min[0] < b.max[0] && a.max[0] > b.min[0] && a.min[1] < b.max[1] && a.max[1] > b.min[1] && a.min[2] < b.max[2] && a.max[2] > b.min[2];

interface WallSpot { f: Face; t: number; x: number; z: number }

/**
 * 区画の壁の、幅 w・高さ y0..y1 の空いている所（壁の前 0.45 m に何も無い・開口の脇を空ける）。score が小さい所から
 */
function wallSpots(g: GeoCell, w: number, y0: number, y1: number, score: (x: number, z: number) => number): WallSpot[] {
  const cell = g.cell, fy = cell.floorY;
  if (fy + y1 > fy + cell.height - 0.1) return [];
  const out: (WallSpot & { s: number })[] = [];
  for (const f of innerFaces(cell.footprint)) {
    for (const [p, q] of freeRuns(f, g.openings, 0.45)) {
      for (let t = p + w / 2 + 0.1; t <= q - w / 2 - 0.1; t += 0.25) {
        const probe = alongFace(f, t - w / 2 - 0.05, w + 0.1, 0.004, 0.45, fy + y0 - 0.05, fy + y1 + 0.05, 'void', false);
        if (cell.boxes.some((b) => hit(b, probe))) continue;
        const n = f.face + f.inward * 0.3;
        const [x, z] = f.horizontal ? [t, n] : [n, t];
        out.push({ f, t, x, z, s: score(x, z) });
      }
    }
  }
  return out.sort((a, b) => a.s - b.s);
}

/** 壁に板を掛ける（枠 + 面）。面の箱（調べる範囲）と、面の向き（室内向きの単位ベクトル）を返す */
function hangBoard(g: GeoCell, s: WallSpot, w: number, y0: number, y1: number, tag: string): { face: Box; normal: [number, number] } {
  const cell = g.cell, fy = cell.floorY;
  const frame = alongFace(s.f, s.t - w / 2, w, 0, 0.05, fy + y0, fy + y1, 'trim', false);
  const face = alongFace(s.f, s.t - w / 2 + 0.04, w - 0.08, 0.05, 0.058, fy + y0 + 0.04, fy + y1 - 0.04, 'signPlate', false);
  frame.propGroup = face.propGroup = `${cell.id}/${tag}`;
  cell.boxes.push(frame, face);
  return { face, normal: s.f.horizontal ? [0, s.f.inward] : [s.f.inward, 0] };
}

const aabbOf = (b: Box): Json => ({ min: [...b.min], max: [...b.max] });

/** 開口でつながる区画（隠し場所は入れない） */
function adjacency(geo: FloorGeometry): Map<string, { to: string; x: number; z: number }[]> {
  const secret = new Set(geo.cells.filter((g) => g.cell.role === 'secret').map((g) => g.cell.id));
  const adj = new Map<string, { to: string; x: number; z: number }[]>();
  for (const p of geo.portals) {
    if (secret.has(p.cells[0]) || secret.has(p.cells[1])) continue;
    const x = (p.aabb.min[0] + p.aabb.max[0]) / 2, z = (p.aabb.min[2] + p.aabb.max[2]) / 2;
    adj.set(p.cells[0], [...(adj.get(p.cells[0]) ?? []), { to: p.cells[1], x, z }]);
    adj.set(p.cells[1], [...(adj.get(p.cells[1]) ?? []), { to: p.cells[0], x, z }]);
  }
  return adj;
}

/** 入口から区画 to までの道（開口の真ん中の並び）と通る区画 */
function routeTo(geo: FloorGeometry, to: string): { cells: string[]; pts: [number, number][] } | null {
  const adj = adjacency(geo);
  const prev = new Map<string, { from: string; x: number; z: number } | null>([[geo.spawn.cell, null]]);
  const q = [geo.spawn.cell];
  for (let h = 0; h < q.length && !prev.has(to); h++) for (const e of adj.get(q[h]!) ?? []) if (!prev.has(e.to)) { prev.set(e.to, { from: q[h]!, x: e.x, z: e.z }); q.push(e.to); }
  if (!prev.has(to)) return null;
  const cells: string[] = [];
  const pts: [number, number][] = [];
  for (let c: string | undefined = to; c; c = prev.get(c)?.from) {
    cells.unshift(c);
    const e = prev.get(c);
    if (e) pts.unshift([e.x, e.z]);
  }
  return { cells, pts };
}

/** 仕掛けの書き込み（誰かの言葉） */
function noteFor(def: string): string {
  const axes = gimmickDef(def)?.axes ?? [];
  if (axes.includes('floor')) return '落ちた';
  if (axes.includes('move')) return '流される';
  if (axes.includes('light')) return '暗い。光について行け';
  if (axes.includes('sight')) return '見られている';
  if (axes.includes('puzzle')) return '開かない';
  if (axes.includes('sound')) return '音がする';
  return '変な部屋';
}

const AUTHORS = ['K.', 'ミナミ', '佐倉', 'T.N.', '304 号室', '名前のない人'] as const;

export function placeMapSigns(p: FloorProfile, geo: FloorGeometry, gimmicks: GimmickResult, anomalies: readonly PlacedAnomaly[], t: Tuning): MapSignsResult {
  const rng = new Rng(hashAll(p.seed, 'mapSigns'));
  const res: MapSignsResult = { guide: null, here: [], note: null, lie: null };
  const byId = new Map(geo.cells.map((g) => [g.cell.id, g]));
  const busy = new Set([...gimmicks.gimmicks.map((x) => x.cell), ...anomalies.map((a) => a.cell)]);
  const secretCells = new Set(geo.cells.filter((g) => g.cell.role === 'secret').map((g) => g.cell.id));
  const exit = geo.exits.find((x) => x.id === 'down') ?? geo.exits[0];
  const exitXZ: [number, number] | null = exit ? [r2((exit.aabb.min[0] + exit.aabb.max[0]) / 2), r2((exit.aabb.min[2] + exit.aabb.max[2]) / 2)] : null;
  const spawn = byId.get(geo.spawn.cell);
  const push = (e: EntitySpec): string => { geo.entities.push(e); return e.id; };

  // ---------------------------------------------------------------- N09 誰かの地図（先に置く: 現在地の看板が指す先）
  let noteAt: [number, number] | null = null;
  if (spawn && rng.chance(t['map.note.chance'])) {
    const rooms = rng.shuffle(geo.cells.filter((g) => g.kind === 'room' && !busy.has(g.cell.id) && !secretCells.has(g.cell.id) && g.cell.role !== 'entry' && g.cell.role !== 'exit'));
    rooms.sort((a, b) => Number(b.cell.role === 'side') - Number(a.cell.role === 'side'));
    for (const g of rooms) {
      const route = routeTo(geo, g.cell.id);
      if (!route) continue;
      const fy = g.cell.floorY;
      // 床の空いている所（壁際。0.6 m 四方に何も無い）
      let spot: [number, number] | null = null;
      for (const r of g.cell.footprint) {
        for (let i = 0; i < 24 && !spot; i++) {
          const x = rng.float(r.x0 + 0.5, r.x1 - 0.5), z = rng.float(r.z0 + 0.5, r.z1 - 0.5);
          const probe = box([x - 0.3, fy - 0.01, z - 0.3], [x + 0.3, fy + 1.0, z + 0.3], 'void', false);
          if (g.cell.boxes.some((b) => hit(b, probe) && !(b.solid && b.max[1] <= fy + 0.001))) continue;
          if (g.openings.some((o) => Math.hypot(o.pos[0] - x, o.pos[2] - z) < 1.6)) continue;
          spot = [x, z];
        }
      }
      if (!spot) continue;
      const [x, z] = spot;
      // 紙（2 枚重ねて、折った地図に見せる）
      const a = box([x - 0.15, fy + 0.002, z - 0.105], [x + 0.15, fy + 0.006, z + 0.105], 'signPlate', false);
      const b2 = box([x - 0.1, fy + 0.006, z - 0.14], [x + 0.12, fy + 0.009, z + 0.06], 'paintWhite', false);
      a.propGroup = b2.propGroup = `${g.cell.id}/mapNote`;
      g.cell.boxes.push(a, b2);
      // 誰かが描いた区画: 入口から歩いた順に（落とした部屋までの道は必ず）
      const adj = adjacency(geo);
      const want = Math.max(route.cells.length, Math.round(t['map.note.coverage'] * geo.cells.filter((c) => !secretCells.has(c.cell.id)).length));
      const drawn = new Set(route.cells);
      const q = [geo.spawn.cell];
      const seen = new Set(q);
      for (let h = 0; h < q.length && drawn.size < want; h++) {
        drawn.add(q[h]!);
        for (const e of rng.shuffle([...(adj.get(q[h]!) ?? [])])) if (!seen.has(e.to)) { seen.add(e.to); q.push(e.to); }
      }
      const marks: Json[] = [];
      const mark = (mx: number, mz: number, text: string, kind: 'note' | 'x' | 'exit'): void => { marks.push({ x: r2(mx), z: r2(mz), text, kind }); };
      // 出口（勘違いのこともある）
      const exitCell = exit ? geo.cells.find((c) => { const bb = c.cell.bounds; const ex = (exit.aabb.min[0] + exit.aabb.max[0]) / 2, ez = (exit.aabb.min[2] + exit.aabb.max[2]) / 2; return ex >= bb.min[0] && ex <= bb.max[0] && ez >= bb.min[2] && ez <= bb.max[2]; }) : undefined;
      const deadEnds = [...drawn].map((id) => byId.get(id)!).filter((c) => c.kind === 'room' && (adj.get(c.cell.id)?.length ?? 0) <= 1 && c.cell.id !== g.cell.id);
      if (deadEnds.length && rng.chance(t['map.note.wrongChance'])) { const c = cellCenter(rng.pick(deadEnds)); mark(c[0], c[1], '出口？', 'exit'); }
      else if (exitXZ && exitCell && drawn.has(exitCell.cell.id)) mark(exitXZ[0], exitXZ[1], '出口', 'exit');
      // 仕掛け・異変の部屋の言葉
      let n = 0;
      for (const gm of gimmicks.gimmicks) if (drawn.has(gm.cell) && n < 3) { const c = cellCenter(byId.get(gm.cell)!); mark(c[0], c[1], noteFor(gm.def), 'note'); n++; }
      for (const an of anomalies) if (drawn.has(an.cell) && n < 5) { const c = cellCenter(byId.get(an.cell)!); mark(c[0], c[1], `ここ、${an.name}`, 'note'); n++; }
      // 隠しの手がかり: 誰かが歩いた部屋の壁の向こうに隠し場所があれば、その壁に「音がする」
      for (const s of gimmicks.secrets) {
        if (!drawn.has(s.host)) continue;
        const portal = geo.portals.find((pp) => pp.cells.includes(s.host) && pp.cells.includes(s.cell));
        if (!portal) continue;
        mark((portal.aabb.min[0] + portal.aabb.max[0]) / 2, (portal.aabb.min[2] + portal.aabb.max[2]) / 2, '壁の向こうから音がする', 'x');
        break;
      }
      const junction = [...drawn].map((id) => byId.get(id)!).find((c) => c.kind === 'junction');
      if (junction) { const c = cellCenter(junction); mark(c[0], c[1], 'ここで迷った', 'note'); }
      mark(x, z, 'ここで落とした？', 'note');
      const trail: number[] = [r2(geo.spawn.pos[0]), r2(geo.spawn.pos[2]), ...route.pts.flatMap(([px, pz]) => [r2(px), r2(pz)]), r2(x), r2(z)];
      res.note = push({
        id: `map:note:${g.cell.id}`, type: 'mapNote', cell: g.cell.id,
        params: { mode: 'note', box: aabbOf(box([x - 0.25, fy, z - 0.25], [x + 0.25, fy + 0.12, z + 0.25], 'void', false)), author: rng.pick(AUTHORS), date: '2003.07.13', cells: [...drawn].sort(), marks, trail },
      });
      noteAt = [x, z];
      break;
    }
  }

  // ---------------------------------------------------------------- N07 入口の案内図
  if (spawn && rng.chance(t['map.guide.chance'])) {
    const sp = geo.spawn.pos;
    // 出てきたときに目に入る壁（近い・前か横。後ろの壁は振り返らないと見えないので後回し）
    const fx = -Math.sin(geo.spawn.yaw), fz = -Math.cos(geo.spawn.yaw);
    const spots = wallSpots(spawn, 1.3, 1.05, 2.0, (x, z) => Math.hypot(x - sp[0], z - sp[2]) + ((x - sp[0]) * fx + (z - sp[2]) * fz < -0.5 ? 6 : 0));
    const s = spots[0];
    if (s) {
      const board = hangBoard(spawn, s, 1.3, 1.05, 2.0, 'mapGuide');
      const shown = geo.cells.filter((c) => (c.kind !== 'room' && c.kind !== 'secret') || c.cell.id === spawn.cell.id || c.cell.role === 'exit').map((c) => c.cell.id);
      const corridors = geo.cells.filter((c) => (c.kind === 'corridor' || c.kind === 'junction') && c.cell.id !== spawn.cell.id);
      const kinds = ['secret', 'exit', 'phantom', 'missing'] as const;
      const w = (k: (typeof kinds)[number]): number => (k === 'secret' && !gimmicks.secrets.length) || ((k === 'missing' || k === 'phantom') && !corridors.length) ? 0 : t[`map.guide.lie.${k}` as const];
      let lie: { [k: string]: Json } = {};
      const kind = kinds.some((k) => w(k) > 0) ? rng.weighted(kinds, w) : null;
      if (kind === 'secret') {
        const sec = rng.pick(gimmicks.secrets);
        lie = { kind, cells: sec.cells.slice() };
      } else if (kind === 'exit') {
        // いちばん遠い部屋（本当の出口から）に出口の印
        const d = (c: GeoCell): number => { const [x, z] = cellCenter(c); return exitXZ ? Math.hypot(x - exitXZ[0], z - exitXZ[1]) : 0; };
        const far = geo.cells.filter((c) => c.kind === 'room' && c.cell.role !== 'exit' && c.cell.role !== 'entry').sort((a, b) => d(b) - d(a));
        if (far[0]) { const c = cellCenter(far[0]); lie = { kind, exit: [r2(c[0]), r2(c[1])] }; }
      } else if (kind === 'missing') {
        lie = { kind, cells: [rng.pick(corridors).cell.id] };
      } else if (kind === 'phantom') {
        // 無い廊下: 廊下の端から、何も無い方へ伸ばした帯
        const all = geo.cells.map((c) => c.cell.bounds);
        for (const c of rng.shuffle(corridors.slice())) {
          const r = mainRect(c);
          const wide = r.x1 - r.x0 >= r.z1 - r.z0;
          const cw = wide ? r.z1 - r.z0 : r.x1 - r.x0;
          const len = rng.float(5, 9);
          const cands: Rect[] = wide
            ? [{ x0: r.x1, z0: r.z0, x1: r.x1 + len, z1: r.z1 }, { x0: r.x0 - len, z0: r.z0, x1: r.x0, z1: r.z1 }, { x0: (r.x0 + r.x1) / 2 - cw / 2, z0: r.z1, x1: (r.x0 + r.x1) / 2 + cw / 2, z1: r.z1 + len }]
            : [{ x0: r.x0, z0: r.z1, x1: r.x1, z1: r.z1 + len }, { x0: r.x0, z0: r.z0 - len, x1: r.x1, z1: r.z0 }, { x0: r.x1, z0: (r.z0 + r.z1) / 2 - cw / 2, x1: r.x1 + len, z1: (r.z0 + r.z1) / 2 + cw / 2 }];
          const free = cands.find((q) => !all.some((b) => q.x0 < b.max[0] - 0.05 && q.x1 > b.min[0] + 0.05 && q.z0 < b.max[2] - 0.05 && q.z1 > b.min[2] + 0.05));
          if (free) { lie = { kind, rects: [{ x0: r2(free.x0), z0: r2(free.z0), x1: r2(free.x1), z1: r2(free.z1) }] }; break; }
        }
        if (!lie.kind) lie = { kind: 'missing', cells: [rng.pick(corridors).cell.id] };
      }
      res.lie = typeof lie.kind === 'string' ? lie.kind : null;
      res.guide = push({
        id: `map:guide:${spawn.cell.id}`, type: 'mapBoard', cell: spawn.cell.id,
        params: { mode: 'guide', box: aabbOf(board.face), normal: board.normal, cells: shown, here: [r2(s.x), r2(s.z)], ...(exitXZ ? { exit: exitXZ } : {}), lie },
      });
    }
  }

  // ---------------------------------------------------------------- N04 現在地の看板
  const hosts = rng.shuffle(geo.cells.filter((g) => (g.kind === 'corridor' || g.kind === 'junction' || g.kind === 'hall') && !busy.has(g.cell.id) && g.cell.role !== 'entry' && g.cell.role !== 'exit'));
  let chance = t['map.here.chance'];
  for (const g of hosts) {
    if (res.here.length >= t['map.here.max'] || !rng.chance(chance)) break;
    const spots = wallSpots(g, 0.9, 1.15, 1.85, () => rng.next());
    const s = spots[0];
    if (!s) continue;
    // 指す先: 誰かの地図 → 隠しのある部屋 → 遠くの部屋（看板から 6 m 以上）
    let here: [number, number] | null = noteAt;
    if (!here && gimmicks.secrets.length) { const h = byId.get(rng.pick(gimmicks.secrets).host); if (h) here = cellCenter(h); }
    if (!here) {
      const rooms = geo.cells.filter((c) => c.kind === 'room' && !secretCells.has(c.cell.id)).map((c) => cellCenter(c)).filter(([x, z]) => Math.hypot(x - s.x, z - s.z) > 6).sort((a, b) => Math.hypot(b[0] - s.x, b[1] - s.z) - Math.hypot(a[0] - s.x, a[1] - s.z));
      here = rooms[0] ?? null;
    }
    if (!here) continue;
    const radius = Math.max(t['map.here.radiusM'], Math.hypot(here[0] - s.x, here[1] - s.z) + 4);
    const cells = geo.cells.filter((c) => !secretCells.has(c.cell.id)).filter((c) => {
      const b = c.cell.bounds;
      const dx = Math.max(b.min[0] - s.x, 0, s.x - b.max[0]), dz = Math.max(b.min[2] - s.z, 0, s.z - b.max[2]);
      return Math.hypot(dx, dz) <= radius;
    }).map((c) => c.cell.id);
    const board = hangBoard(g, s, 0.9, 1.15, 1.85, `mapHere${res.here.length}`);
    res.here.push(push({
      id: `map:here:${g.cell.id}`, type: 'mapBoard', cell: g.cell.id,
      params: { mode: 'here', box: aabbOf(board.face), normal: board.normal, cells, here: [r2(here[0]), r2(here[1])], truth: [r2(s.x), r2(s.z)], center: [r2(s.x), r2(s.z)], radius: r2(radius) },
    }));
    chance *= 0.5;
  }
  return res;
}
