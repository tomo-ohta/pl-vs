/**
 * 屋外の区画の作り（分棟の渡り廊下 F02・島と橋 F16・屋上 F33・中庭 F05）。
 *
 * - 天井なし。両脇の壁は手すりの高さ（structure.railM）までの胸壁で、上は開いている（壁の開口の sill を使う）。
 *   跳んだ足の高さ（約 0.9 m）より高いので越えられない（落ちない）
 * - 霧（区画の render.fog）: 渡り廊下・屋上は明るい灰色の霧（外は何も見えない）。奈落の橋は暗い霧
 * - 照明: 天井の器具の代わりに、胸壁の上の街灯（数 m ごとに左右交互）
 * - 下（橋の下の水・地面・奈落）: フロアに 1 つの「下」の区画（below）を作り、橋から窓の portal でつなぐ（橋が見えると下も描く）
 */
import { hashAll } from '../../../math/rng.ts';
import type { Dir } from '../../../math/vec.ts';
import { makeCell, opening, portal } from '../../../world/build.ts';
import type { Rect } from '../../../world/footprint.ts';
import { box, WALL_T, type Box, type CellLayout, type LightingOverrides, type MatId, type Palette, type RenderOverrides, type WallOpening } from '../../../world/layout.ts';
import type { GeoBuild, StraightSpec } from '../geometry.ts';

/** 屋外の霧と焼き込みの空の光 */
export function outdoorEnv(kind: 'day' | 'void' | 'water', near = 3, far = 26): { render: RenderOverrides; lighting: LightingOverrides; ambient: number; fog: number } {
  if (kind === 'day') {
    return {
      render: { fog: { color: 0xb9bec4, near, far } },
      lighting: { skyAmbient: { color: 0xc9d0d8, intensity: 0.75 }, directional: [{ dir: [-0.3, -1, -0.45], color: 0xf2efe6, intensity: 0.35 }] },
      ambient: 0xaab0b8, fog: 0xb9bec4,
    };
  }
  if (kind === 'water') {
    return {
      render: { fog: { color: 0x0a1416, near: 4, far: 36 } },
      lighting: { skyAmbient: { color: 0x2a3a40, intensity: 0.35 } },
      ambient: 0x1c2a2e, fog: 0x0a1416,
    };
  }
  return {
    render: { fog: { color: 0x030305, near: 4, far: 32 } },
    lighting: { skyAmbient: { color: 0x14161c, intensity: 0.3 } },
    ambient: 0x101218, fog: 0x030305,
  };
}

/**
 * 区画の辺のうち、開口の無い所を手すりの胸壁にする開口を足す（区画を作る前に呼ぶ）。
 * rects の外周の辺ごとに、既にある開口と重ならない区間を開口（sill = rail・上まで）にする。y は区画の床
 */
export function addRailings(g: GeoBuild, cellId: string, rects: Rect[], y: number, height: number, rail: number, skip: (dir: Dir, at: number) => boolean = () => false): void {
  const ops = g.openings.get(cellId) ?? [];
  for (const r of rects) {
    const edges: { dir: Dir; coord: number; a0: number; a1: number }[] = [
      { dir: 0, coord: r.z1, a0: r.x0, a1: r.x1 }, { dir: 2, coord: r.z0, a0: r.x0, a1: r.x1 },
      { dir: 1, coord: r.x1, a0: r.z0, a1: r.z1 }, { dir: 3, coord: r.x0, a0: r.z0, a1: r.z1 },
    ];
    for (const e of edges) {
      // ほかの矩形と接している辺（同じ区画の続き）は壁ではない
      if (rects.some((o) => o !== r && touches(o, e))) continue;
      const along = (o: WallOpening): number => (e.dir === 0 || e.dir === 2 ? o.pos[0] : o.pos[2]);
      const busy = ops.filter((o) => o.dir === e.dir && Math.abs((e.dir === 0 || e.dir === 2 ? o.pos[2] : o.pos[0]) - e.coord) < 0.05)
        .map((o) => [along(o) - o.width / 2 - 0.3, along(o) + o.width / 2 + 0.3] as [number, number]).sort((p, q) => p[0] - q[0]);
      let cur = e.a0 + 0.3;
      const free: [number, number][] = [];
      for (const [p, q] of busy) { if (p > cur + 0.4) free.push([cur, p]); cur = Math.max(cur, q); }
      if (e.a1 - 0.3 > cur + 0.4) free.push([cur, e.a1 - 0.3]);
      for (const [p, q] of free) {
        const at = (p + q) / 2;
        if (skip(e.dir, at)) continue;
        const pos: [number, number, number] = e.dir === 0 || e.dir === 2 ? [at, y, e.coord] : [e.coord, y, at];
        const o = opening(`${cellId}:rail:${e.dir}:${at.toFixed(2)}`, pos, e.dir, q - p, height - rail + 0.5, rail);
        g.addOpening(cellId, o);
        ops.push(o);
      }
    }
  }
}

function touches(o: Rect, e: { dir: Dir; coord: number; a0: number; a1: number }): boolean {
  const E = 0.02;
  switch (e.dir) {
    case 0: return Math.abs(o.z0 - e.coord) < E && o.x0 < e.a1 - E && o.x1 > e.a0 + E;
    case 2: return Math.abs(o.z1 - e.coord) < E && o.x0 < e.a1 - E && o.x1 > e.a0 + E;
    case 1: return Math.abs(o.x0 - e.coord) < E && o.z0 < e.a1 - E && o.z1 > e.a0 + E;
    default: return Math.abs(o.x1 - e.coord) < E && o.z0 < e.a1 - E && o.z1 > e.a0 + E;
  }
}

/** 廊下の区画（StraightSpec）の両脇を手すりにする開口（区画を作る前） */
export function railingSides(s: StraightSpec, g: GeoBuild): void {
  const rail = s.outdoor?.rail ?? g.t['structure.railM'];
  const len = s.a1 - s.a0;
  if (len < 1.2) return;
  const at = (s.a0 + s.a1) / 2;
  // 段のある区画は、高い端でも手すりの高さが残るように
  const sill = rail + (s.stairs?.rise ?? s.drop?.rise ?? 0);
  for (const side of [-1, 1]) {
    const c = s.center + (side * s.width) / 2;
    const dir: Dir = s.axis === 'x' ? (side > 0 ? 0 : 2) : (side > 0 ? 1 : 3);
    g.addOpening(s.id, opening(`${s.id}:rail${side}`, s.axis === 'x' ? [at, s.y, c] : [c, s.y, at], dir, len - 0.5, s.height - sill + 0.5, sill));
  }
}

/** 屋外の廊下・橋・外の階段の区画（天井なし・胸壁・街灯・霧） */
export function outdoorStraight(s: StraightSpec, rect: Rect, ops: WallOpening[], basePalette: Palette, materialKey: string, theme: string, audio: string): CellLayout {
  const bridge = s.outdoor?.style === 'bridge';
  const env = outdoorEnv(bridge ? (s.outdoor?.below === 'water' ? 'water' : 'void') : 'day', s.outdoor?.fog?.[0], s.outdoor?.fog?.[1]);
  const palette: Palette = { ...basePalette, floor: bridge ? 'metalDark' : 'floorConcrete', wall: bridge ? 'metal' : 'wallConcrete', ambient: env.ambient, fog: env.fog };
  const cell = makeCell({ id: s.id, role: s.role, rects: [rect], height: s.height, floorY: s.y, palette, theme, name: s.name, audioPreset: bridge ? '低いハム' : '換気・遠い車道音', materialKey: `${materialKey}:out`, openings: ops, lights: 'none', noCeiling: true });
  cell.render = { ...env.render };
  cell.lighting = { ...env.lighting };
  void audio;
  // 胸壁の上の笠木（手すり）
  const rail = s.outdoor?.rail ?? 1.1;
  const len = s.a1 - s.a0;
  for (const side of [-1, 1]) {
    const c = s.center + (side * s.width) / 2 - side * WALL_T / 2;
    const y = s.y + rail + (s.stairs?.rise ?? s.drop?.rise ?? 0);
    cell.boxes.push(s.axis === 'x' ? box([s.a0 + 0.25, y, c - 0.06], [s.a1 - 0.25, y + 0.05, c + 0.06], 'metal', false) : box([c - 0.06, y, s.a0 + 0.25], [c + 0.06, y + 0.05, s.a1 - 0.25], 'metal', false));
  }
  // 街灯: 4 m ごとに左右交互
  const n = Math.max(1, Math.round(len / 4.5));
  for (let i = 0; i < n; i++) {
    const at = s.a0 + (len / n) * (i + 0.5);
    const side = i % 2 === 0 ? 1 : -1;
    const c = s.center + side * (s.width / 2 - WALL_T / 2);
    const top = s.y + 2.5;
    lampPost(cell.boxes, s.axis === 'x' ? at : c, s.axis === 'x' ? c : at, s.y + rail, top, bridge ? 'lightWarm' : 'lightPanel');
    cell.lights.push({ pos: s.axis === 'x' ? [at, top - 0.15, s.center] : [s.center, top - 0.15, at], color: bridge ? 0xffc890 : 0xe8eef8, intensity: bridge ? 0.55 : 0.4, distance: 7 });
  }
  // 階段（外の非常階段）: 段は buildStraight と同じ（浮いた鉄の段）
  if (s.stairs) {
    const { lowEnd, offset, rise } = s.stairs;
    const steps = Math.ceil(rise / 0.17 - 1e-9);
    const riser = rise / steps;
    const w0 = s.center - s.width / 2 + WALL_T, w1 = s.center + s.width / 2 - WALL_T;
    const atD = (d: number): number => (lowEnd === 'a0' ? s.a0 + d : s.a1 - d);
    const slab = (d0: number, d1: number, top: number, kind: string): void => {
      const p0 = Math.min(atD(d0), atD(d1)), p1 = Math.max(atD(d0), atD(d1));
      if (p1 - p0 < 1e-3) return;
      const b: Box = s.axis === 'x' ? box([p0, s.y, w0], [p1, top, w1], 'metalDark') : box([w0, s.y, p0], [w1, top, p1], 'metalDark');
      b.kind = kind;
      cell.boxes.push(b);
    };
    for (let i = 0; i < steps; i++) slab(offset + i * 0.28, offset + (i + 1) * 0.28, s.y + (i + 1) * riser, 'stairStep');
    slab(offset + steps * 0.28, len, s.y + rise, 'landing');
  }
  void hashAll;
  return cell;
}

/** 街灯（細い柱 + 灯り）。x, z は柱の位置、y0 は柱の足元 */
export function lampPost(out: Box[], x: number, z: number, y0: number, top: number, mat: MatId): void {
  out.push(box([x - 0.04, y0, z - 0.04], [x + 0.04, top, z + 0.04], 'metalDark', false));
  out.push(box([x - 0.16, top - 0.1, z - 0.16], [x + 0.16, top, z + 0.16], mat, false));
}

/**
 * フロアの「下」の区画（橋の下の水・奈落・地面）: 区画の足跡の外形の下に、水面か地面の板を 1 枚。portal で橋とつなぐ（finisher）。
 * 区画の中身は置かない（keepOut で全部）・仕掛けと異変も置かない（reserved）
 */
export function addBelow(g: GeoBuild, kind: 'void' | 'water' | 'ground', depth: number, from: (id: string) => boolean): void {
  g.finishers.push((gb) => {
    const cells = gb.out.cells.map((x) => x.cell);
    const x0 = Math.min(...cells.map((c) => c.bounds.min[0])) - 12, x1 = Math.max(...cells.map((c) => c.bounds.max[0])) + 12;
    const z0 = Math.min(...cells.map((c) => c.bounds.min[2])) - 12, z1 = Math.max(...cells.map((c) => c.bounds.max[2])) + 12;
    const yTop = Math.min(...cells.map((c) => c.floorY)) - depth;
    const env = outdoorEnv(kind === 'ground' ? 'day' : kind, gb.t['structure.outdoor.fogNear'], gb.t['structure.outdoor.fogFar']);
    const pal: Palette = { floor: kind === 'water' ? 'water' : kind === 'ground' ? 'grass' : 'void', wall: 'void', ceiling: 'void', door: 'doorMetal', light: 'lightOff', lightColor: 0x808890, lightIntensity: 0.2, ambient: env.ambient, fog: env.fog };
    const rect: Rect = { x0, z0, x1, z1 };
    const cell: CellLayout = {
      id: 'below', role: 'connector', bounds: { min: [x0, yTop - 0.4, z0], max: [x1, yTop + 0.2, z1] }, footprint: [rect], height: 0.2, floorY: yTop,
      palette: pal, boxes: [], lights: [], zones: [], name: kind === 'water' ? '水面' : kind === 'ground' ? '地面' : '奈落', theme: 'Bridge', audioPreset: '低いハム', render: { ...env.render }, lighting: { ...env.lighting },
    };
    if (kind !== 'void') cell.boxes.push(box([x0, yTop - 0.3, z0], [x1, yTop, z1], pal.floor, false));
    gb.out.cells.push({ cell, kind: 'junction', openings: [], node: -1 });
    gb.keep('below', { min: [x0, yTop - 1, z0], max: [x1, yTop + 1, z1] });
    gb.reserved.add('below');
    // 橋・島から下が見える（窓の portal。通れない）
    for (const gc of gb.out.cells) {
      if (gc.cell.id === 'below' || !from(gc.cell.id)) continue;
      const b = gc.cell.bounds;
      gb.out.portals.push(portal(`p:${gc.cell.id}:below`, gc.cell.id, 'below', { min: [b.min[0], b.min[1], b.min[2]], max: [b.max[0], b.min[1] + 0.3, b.max[2]] }, 0, 'window'));
    }
  });
}
