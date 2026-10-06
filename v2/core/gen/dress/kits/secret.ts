/**
 * 隠し部屋の中身: 物は少なく、少しだけ特別に見せる（台座の上に 1 つだけの物 / ぽつんと 1 脚の椅子 / 卓と灯り /
 * 奥の壁のベッド / 何も無い壁を向いた椅子の列 / 小さな祭壇のような戸棚）。施設の種類で椅子と材質を変える
 */
import type { Dir } from '../../../math/vec.ts';
import type { Box, MatId } from '../../../world/layout.ts';
import { build, placeNear, type DressCtx } from '../ctx.ts';
import { addDecor, board, sconce } from '../decor.ts';
import { chair } from '../furniture.ts';
import { facePoint, type Face } from '../geom.ts';
import { bed, cabinet, lamp, lowTable, officeChair, plinth, schoolChair } from '../props.ts';
import { entrance, faceOf, longestRun, mainFaces, mainRect, onSomeWall, oppositeFace, skirting } from './common.ts';

/** 隠し部屋の椅子・材質の系統 */
export type SecretStyle = 'office' | 'school' | 'hotel' | 'hospital' | 'service' | 'home' | 'plain';

/** 施設に合う椅子 */
function seat(B: Box[], style: SecretStyle, x: number, z: number, facing: Dir): void {
  if (style === 'office') officeChair(B, x, z, facing, 'seatBlue');
  else if (style === 'school') schoolChair(B, x, z, facing);
  else chair(B, x, z, facing, style === 'hotel' ? 'upholstery' : style === 'hospital' ? 'paintWhite' : style === 'service' ? 'metalDark' : 'furnitureDark');
}

export function secretRoom(c: DressCtx, style: SecretStyle): void {
  skirting(c, style === 'service' ? 'metalDark' : 'trim');
  const r = mainRect(c);
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  const ef = faceOf(c, entrance(c));
  // 入口の方を向く向き（入口の面の外向き）と、奥の壁
  const toEntrance: Dir = ef ? ef.dir : c.rng.pick([0, 1, 2, 3] as Dir[]);
  const far: Face | null = (ef && oppositeFace(c, ef)) ?? mainFaces(c, () => true, r)[0] ?? null;
  const type = c.rng.weighted(['plinth', 'chair', 'table', 'bed', 'row', 'altar'] as const, (k) => ({ plinth: 3, chair: 3, table: 2, bed: 1, row: 1, altar: 1.5 })[k]);
  const glow = c.rng.pick<MatId>(['goldTrim', 'screenLcd', 'plasticRed', 'lightWarm', 'aquariumBlue', 'marbleWhite']);
  switch (type) {
    case 'plinth':
      placeNear(c, cx, cz, (B, x, z) => plinth(B, x, z, 0.55, 1.0, 'marbleWhite', glow, c.rng.float(0.2, 0.3)), 0.3, 1.5);
      break;
    case 'chair': {
      // 部屋の真ん中に 1 脚。入口を向くか、壁を向く
      const facing: Dir = c.rng.chance(0.6) ? toEntrance : (((toEntrance + 2) % 4) as Dir);
      placeNear(c, cx, cz, (B, x, z) => seat(B, style, x, z, facing), 0.3, 1.5);
      break;
    }
    case 'table':
      placeNear(c, cx, cz, (B, x, z) => {
        lowTable(B, x, z, 0.7, 0.7, 0.72, style === 'home' || style === 'hotel' ? 'furnitureDark' : 'furnitureLight');
        lamp(B, x, z, 0.72);
        const [dx, dz] = toEntrance === 0 ? [0, -0.7] : toEntrance === 2 ? [0, 0.7] : toEntrance === 1 ? [-0.7, 0] : [0.7, 0];
        seat(B, style, x + dx, z + dz, toEntrance);
      }, 0.3, 1.5);
      break;
    case 'bed':
      if (far) {
        const run = longestRun(c, far, 0.6);
        if (run && run[1] - run[0] >= 1.4) build(c, (B) => bed(B, far, (run[0] + run[1]) / 2 - 0.5, 1.0, 2.0, 'metal', 'whiteFabric', c.standoff));
      }
      break;
    case 'row': {
      // 奥の壁を向いた椅子の列（3〜5 脚）
      if (!far) break;
      const n = c.rng.int(3, 5);
      const run = longestRun(c, far, 0.6);
      if (!run || run[1] - run[0] < n * 0.6) break;
      const m = (run[0] + run[1]) / 2;
      build(c, (B) => {
        for (let k = 0; k < n; k++) {
          const [x, z] = facePoint(far, m + (k - (n - 1) / 2) * 0.6, Math.min(2.2, c.standoff + 1.6));
          seat(B, style, x, z, far.dir);
        }
      });
      break;
    }
    case 'altar':
      if (far) onSomeWall(c, 1.0, (B, f, at) => {
        cabinet(B, f, at, 1.0, 0.4, 0.8, 'furnitureDark', c.standoff);
        const [x, z] = facePoint(f, at + 0.5, c.standoff + 0.2);
        lamp(B, x - 0.3, z, 0.8);
        B.push({ min: [x - 0.08, 0.8, z - 0.08], max: [x + 0.08, 1.02, z + 0.08], mat: glow, solid: false });
      }, { faces: [far] });
      break;
  }
  // 選んだ物が置けなかったら、真ん中の近くに椅子を 1 脚
  if (!c.units.some((u) => u.solid)) placeNear(c, cx, cz, (B, x, z) => seat(B, style, x, z, toEntrance), 0.3, 2.0);
  // 壁に 1 枚だけ（額か灯り）
  if (c.rng.chance(0.5)) {
    for (const f of c.rng.shuffle(c.faces.filter((g) => g !== ef))) {
      const run = longestRun(c, f, 0.6);
      if (!run || run[1] - run[0] < 1.0) continue;
      const B: Box[] = [];
      const t = (run[0] + run[1]) / 2;
      if (c.rng.chance(0.6)) board(B, f, t, 0.6, 1.3, 1.85, c.rng.pick<MatId>(['wallDark', 'skyDusk', 'chalkboard', 'seatRed']), 'goldTrim');
      else sconce(B, f, t, Math.min(c.h - 0.4, 1.7));
      if (addDecor(c, B)) break;
    }
  }
}
