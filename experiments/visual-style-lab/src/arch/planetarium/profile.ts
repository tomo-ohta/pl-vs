import { DOME, DRUM_R, FLOOR, STAGE, TIERS, type TierDef } from './layout.ts';

/**
 * 床の高さ（平土間・舞台・段床）。形・当たり判定・光の筋の霧の切り取りが同じ値を使う。
 * 角度 a は舞台の中心から見て -Z（北・奥）が 0、+X（東・右）が正（ラジアン、-π〜π）。半径 r も舞台の中心から。
 * 段床は舞台の中心のまわりの輪で、上の回廊の高さまで上がり、その先（壁ぎわ）は平ら。
 */

export function polar(x: number, z: number): { r: number; a: number } {
  return { r: Math.hypot(x, z), a: Math.atan2(x, -z) };
}

/** ドラムの壁の内側か（水平の距離） */
export function inDrum(x: number, z: number, pad = 0): boolean {
  return Math.hypot(x - DOME.cx, z - DOME.cz) <= DRUM_R + pad;
}

/** 舞台の中心から向き a へ進んでドラムの壁に当たる半径 */
export function rWall(a: number): number {
  const ux = Math.sin(a);
  const uz = -Math.cos(a);
  const uc = ux * DOME.cx + uz * DOME.cz;
  const c2 = DOME.cx * DOME.cx + DOME.cz * DOME.cz - DRUM_R * DRUM_R;
  return uc + Math.sqrt(Math.max(uc * uc - c2, 0));
}

export interface TierRow {
  /** 段床の始まりからの距離（手前・奥）と踏み面の高さ */
  d0: number;
  d1: number;
  y: number;
}

/** 段床の段の表（始まりからの距離）。横の通路の段は広い。最後の段は上の回廊の高さで、奥は壁まで */
export function tierRows(def: TierDef): TierRow[] {
  const rows: TierRow[] = [];
  let d = 0;
  let y = 0;
  while (y < def.top - 1e-6) {
    y = Math.min(def.top, y + def.rise);
    const w = def.cross && Math.abs(y - def.cross.y) < 1e-6 ? def.cross.w : def.tread;
    rows.push({ d0: d, d1: y >= def.top - 1e-6 ? 1e3 : d + w, y });
    d += w;
  }
  return rows;
}
export const BACK_ROWS = tierRows(TIERS.back);
export const WEST_ROWS = tierRows(TIERS.west);

/** 向き a の段床（無ければ null）と、その始まりの半径 */
export function tierAt(a: number): { rows: TierRow[]; start: number; def: TierDef } | null {
  if (a >= TIERS.back.a0 && a <= TIERS.back.a1) return { rows: BACK_ROWS, start: TIERS.back.r0, def: TIERS.back };
  if (a >= TIERS.west.a0 && a < TIERS.west.a1) return { rows: WEST_ROWS, start: rWall(a) - TIERS.west.depth, def: TIERS.west };
  return null;
}

/** 段床の始まりの半径（段床の無い向きは Infinity） */
export function tierStart(a: number): number {
  return tierAt(a)?.start ?? Infinity;
}

/** 平土間・段床の高さ（舞台は STAGE.top） */
export function floorY(x: number, z: number): number {
  const { r, a } = polar(x, z);
  if (r <= STAGE.r) return STAGE.top;
  if (r < FLOOR.r0) return 0;
  const t = tierAt(a);
  if (!t || r < t.start) return 0;
  const d = r - t.start;
  for (const rw of t.rows) if (d < rw.d1) return rw.y;
  return t.def.top;
}

/** 光の筋の霧を床・段床で切るための GLSL（floorY と同じ） */
export function floorGlsl(): string {
  const f = (v: number): string => v.toFixed(4);
  const arr = (rows: TierRow[]): string => rows.map((r) => `vec2(${f(r.d1)}, ${f(r.y)})`).join(', ');
  return /* glsl */ `
const vec2 PL_BACK[${BACK_ROWS.length}] = vec2[](${arr(BACK_ROWS)});
const vec2 PL_WEST[${WEST_ROWS.length}] = vec2[](${arr(WEST_ROWS)});
float pl_rWall(float a) {
  vec2 u = vec2(sin(a), -cos(a));
  vec2 C = vec2(${f(DOME.cx)}, ${f(DOME.cz)});
  float uc = dot(u, C);
  float c2 = dot(C, C) - ${f(DRUM_R * DRUM_R)};
  return uc + sqrt(max(uc * uc - c2, 0.0));
}
float pl_floorY(vec2 xz) {
  float r = length(xz);
  if (r <= ${f(STAGE.r)}) return ${f(STAGE.top)};
  if (r < ${f(FLOOR.r0)}) return 0.0;
  float a = atan(xz.x, -xz.y);
  if (a >= ${f(TIERS.back.a0)} && a <= ${f(TIERS.back.a1)}) {
    float d = r - ${f(TIERS.back.r0)};
    if (d < 0.0) return 0.0;
    for (int i = 0; i < ${BACK_ROWS.length}; i++) if (d < PL_BACK[i].x) return PL_BACK[i].y;
    return ${f(TIERS.back.top)};
  }
  if (a >= ${f(TIERS.west.a0)} && a < ${f(TIERS.west.a1)}) {
    float d = r - (pl_rWall(a) - ${f(TIERS.west.depth)});
    if (d < 0.0) return 0.0;
    for (int i = 0; i < ${WEST_ROWS.length}; i++) if (d < PL_WEST[i].x) return PL_WEST[i].y;
    return ${f(TIERS.west.top)};
  }
  return 0.0;
}
`;
}
