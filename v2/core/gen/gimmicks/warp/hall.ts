/**
 * 別の空間のまっすぐな廊下（閉じた輪の廊下・遠ざかる廊下が使う）。
 *
 * 控え室の双子の部屋 R' の 3 枚目の扉から、扉の外向きにまっすぐ伸びる 1 つの区画。入口の所（startLen）・くり返し（periods × period）・
 * 奥の所（endLen）からなり、くり返しには同じ物（照明 3 m ごと・長椅子・壁を向いた椅子・掲示・飾りの扉 左右 1 枚ずつ）が並ぶ。
 * 奥の扉の先に、最初の部屋の双子 Q' を置く（Q' の 3 枚目の扉が奥の扉。向きは逆）。床・天井・壁はくり返しの切れ目で切る
 * （くり返しごとに箱の分け方と頂点の焼き込みを同じにする）
 */
import { opening } from '../../../world/build.ts';
import { DOOR_H, DOOR_W, WALL_T, type CellLayout, type MatId, type WallOpening } from '../../../world/layout.ts';
import { themePalette } from '../../../world/palettes.ts';
import { familyById } from '../../floor/themes.ts';
import type { GimmickContext } from '../types.ts';
import { attachToPod, type Anteroom, type RoomCopy } from './anteroom.ts';
import { addPocketCell, axisOf, ceilingLight, doorSpec, makeFrame, pocketCell, safePalette, splitAlong, type Frame } from './pocket.ts';

/** 区画の箱を、局所の座標で足す */
export const put = (cell: CellLayout, f: Frame, u0: number, y0: number, v0: number, u1: number, y1: number, v1: number, mat: MatId, solid = true): void => {
  cell.boxes.push(f.box(u0, y0, v0, u1, y1, v1, mat, solid));
};

/** くり返しの 1 つ分の物（u0 から 12 m）。左右の壁の内側は ±(W/2 − 壁) */
function period(cell: CellLayout, f: Frame, u0: number, P: number, W: number, H: number): void {
  const iw = W / 2 - WALL_T;
  for (let du = 1.5; du < P; du += 3) ceilingLight(cell, f, u0 + du, 0, H, true, Math.round((du - 1.5) / 3) % 2 === 0, 1, 6);
  // 長椅子（左の壁際）
  put(cell, f, u0 + 5.2, 0, iw - 0.42, u0 + 6.8, 0.4, iw, 'metalDark');
  put(cell, f, u0 + 5.2, 0.4, iw - 0.45, u0 + 6.8, 0.46, iw, 'noticeGreen');
  // 壁を向いた椅子（右の壁際。くり返すたびに同じ椅子がある）
  const cu = u0 + 6.0, cv = -iw + 0.3;
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) put(cell, f, cu + a * 0.2 - 0.02, 0, cv + b * 0.2 - 0.02, cu + a * 0.2 + 0.02, 0.45, cv + b * 0.2 + 0.02, 'metal');
  put(cell, f, cu - 0.24, 0.45, cv - 0.24, cu + 0.24, 0.5, cv + 0.24, 'plasticBlue');
  put(cell, f, cu - 0.24, 0.5, cv - 0.24, cu + 0.24, 0.95, cv - 0.2, 'plasticBlue');
  // 掲示（右の壁）と、床の線
  put(cell, f, u0 + 2.6, 1.1, -iw, u0 + 3.4, 1.9, -iw + 0.02, 'signPlate', false);
  put(cell, f, u0 + 2.7, 1.2, -iw + 0.02, u0 + 3.3, 1.5, -iw + 0.03, 'plasticRed', false);
  put(cell, f, u0, 0, -0.04, u0 + P, 0.004, 0.04, 'yellowLine', false);
}

export interface HallOptions {
  /** 入口の所・くり返しの長さと数・奥の所（m） */
  startLen: number;
  period: number;
  periods: number;
  endLen: number;
  width: number;
  height: number;
  /** 霧で何も見えなくなる距離（無ければ区画の霧なし） */
  fogFar?: number;
}

export interface Hall {
  cell: CellLayout;
  f: Frame;
  /** 廊下の長さ（R' の壁の外面から奥の壁の外面まで） */
  length: number;
  /** 奥の扉の先の双子の部屋 */
  exit: RoomCopy;
  ops: WallOpening[];
}

export function buildStraightHall(ctx: GimmickContext, ante: Anteroom, o: HallOptions, suffix = 'hall'): Hall {
  const plan = ante.plan;
  const { startLen: a0, period: P, periods: M, endLen, width: W, height: H } = o;
  const Lh = a0 + M * P + endLen;
  const R1 = ante.entry;
  const f = makeFrame(R1.podOut.pos, plan.pod.dir);
  const y = R1.cell.floorY;
  const fam = familyById(ctx.floor.family);
  const pal = safePalette({ ...themePalette(fam.corridor), fog: 0x07080a });
  const id = `${plan.host.id}~${suffix}`;
  const ops: WallOpening[] = [opening(`${id}:in`, f.p(0, 0, 0), f.dir(2), DOOR_W, DOOR_H), opening(`${id}:out`, f.p(Lh, 0, 0), f.dir(0), DOOR_W, DOOR_H)];
  // 飾りの扉（くり返しごとに左右 1 枚ずつ。開かない）
  const fakes: { u: number; v: number; side: 1 | 3; name: string }[] = [];
  for (let k = 0; k < M; k++) {
    fakes.push({ u: a0 + k * P + P / 4, v: W / 2, side: 1, name: `${suffix}.fake${k}l` });
    fakes.push({ u: a0 + k * P + (3 * P) / 4, v: -W / 2, side: 3, name: `${suffix}.fake${k}r` });
  }
  for (const fk of fakes) ops.push(opening(`${id}:${fk.name}`, f.p(fk.u, 0, fk.v), f.dir(fk.side), DOOR_W, DOOR_H));
  const cell = pocketCell({ id, pocket: ctx.id, rects: [f.rect(0, -W / 2, Lh, W / 2)], height: H, floorY: y, palette: pal, openings: ops, theme: fam.corridor, name: '廊下', materialKey: `${ctx.id}:${suffix}`, audio: fam.corridorAudio });
  if (o.fogFar) cell.render = { fog: { color: pal.fog, near: 1.5, far: o.fogFar } };
  for (const fk of fakes) {
    const pos = f.p(fk.u, 0, fk.v), dir = f.dir(fk.side), axis = axisOf(dir);
    ctx.addEntity(fk.name, { ...doorSpec(axis, axis === 'x' ? pos[0] : pos[2], axis === 'x' ? pos[2] : pos[0], y, pal.door, { locked: true, autoCloseSec: 0 }), cell: id });
  }
  // 入口の所（くり返しの外）・くり返し・奥の所
  ceilingLight(cell, f, Math.min(1.6, a0 / 2), 0, H, true, true, 0.8, 6);
  for (let k = 0; k < M; k++) period(cell, f, a0 + k * P, P, W, H);
  ceilingLight(cell, f, Lh - Math.min(2.2, endLen / 2), 0, H, true, true, 0.8, 6);
  // 奥の扉の上の非常口の灯り
  put(cell, f, Lh - WALL_T - 0.05, DOOR_H + 0.12, -0.25, Lh - WALL_T, DOOR_H + 0.26, 0.25, 'lightGreen', false);
  // 床・天井・壁をくり返しの切れ目で切る（入口の所の隠しの穴が、くり返しの壁を切らない）
  splitAlong(cell, f, Array.from({ length: M + 1 }, (_, k) => a0 + k * P));
  addPocketCell(ctx, cell, 'corridor', ops);
  attachToPod(ctx, R1, id);
  // 奥の扉の先: 最初の部屋の双子（pod を廊下の奥の扉に重ねる。向きは逆）
  const exit = ante.addCopy({ from: plan.pod.pos, to: f.p(Lh, 0, 0), q: 2 }, `${suffix}.q`);
  attachToPod(ctx, exit, id);
  return { cell, f, length: Lh, exit, ops };
}
