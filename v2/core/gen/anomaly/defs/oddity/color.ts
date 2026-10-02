/**
 * 色の異変（段階 4・oddity）: 色が抜ける（X07。1 つの色だけが部屋から消える）・単色の部屋（X08。黒一色 / 1 色だけの部屋）。
 * 白一色の部屋は既存の色の異変（tint の white）。画面の色（部屋にいる間だけ）は描画の fx 'grade'。
 */
import { box, PASSABLE_VEGETATION, type Box, type MatId } from '../../../../world/layout.ts';
import { extinguisher } from '../../../dress/decor.ts';
import { plant } from '../../../dress/props.ts';
import { defineAnomaly } from '../../types.ts';
import { doorFronts, hitsAny, interiorSolids, KEEP_COLOR } from '../../util.ts';
import { addGroup, blockedAt, facesOf, freeSpans, gridPoints, lift, roomFx } from './common.ts';

/** 色相ごとの、その色の材質と、色が抜けた後の灰色の材質 */
const HUES = {
  red: { hue: 0.0, mats: ['plasticRed', 'neonRed', 'seatRed', 'redShutter', 'carpetPattern', 'floorCarpetRed', 'upholstery', 'wallBrick'] as MatId[] },
  green: { hue: 0.33, mats: ['plantLeaf', 'plant', 'grass', 'lockerGreen', 'wallGreen', 'noticeGreen', 'chalkboard', 'lightGreen', 'signEmissive'] as MatId[] },
  blue: { hue: 0.61, mats: ['plasticBlue', 'seatBlue', 'lockerBlue', 'ledBlue', 'neonBlue', 'aquariumBlue'] as MatId[] },
} as const;

/** 色の抜けた材質（床・壁は打ち放し、光る物は白い灯り、ほかは灰色の塗装） */
function greyOf(m: MatId): MatId {
  if (m.startsWith('floor') || m === 'carpetPattern' || m === 'grass') return 'floorConcrete';
  if (m.startsWith('wall') || m === 'redShutter') return 'wallConcrete';
  if (m === 'neonRed' || m === 'lightGreen' || m === 'ledBlue' || m === 'neonBlue' || m === 'signEmissive' || m === 'aquariumBlue') return 'lightPanel';
  if (m === 'plantLeaf' || m === 'plant') return 'metalDark';
  return 'shelfMetal';
}

/**
 * 色が抜ける: 部屋から 1 つの色（赤・緑・青のどれか）だけが消えている。赤いはずの消火器・赤い椅子、緑の鉢植え・非常口の灯り、
 * 青いはずの物が、どれも灰色。扉を開けると「赤い物が全部灰色」と分かり、中に入ると目に映る物からもその色が抜ける（画面の色）
 */
defineAnomaly({
  id: 'missingColor', name: '色が抜ける', weight: 0.75, intensity: 0, kinds: ['room', 'hall'], minSize: [3, 3.6], minHeight: 2.3,
  post(ctx) {
    const cell = ctx.cell, fy = cell.floorY;
    const key = ctx.rng.pick(['red', 'green', 'blue'] as const);
    const H = HUES[key];
    ctx.memo.hue = key;
    // その色だとすぐ分かる物を足す: 赤は消火器、緑は鉢植え、青は青いごみ箱
    const solids = interiorSolids(cell);
    const doors = doorFronts(cell, ctx.geo.openings, 1.4, 0.35);
    const B: Box[] = [];
    let n = 0;
    if (key === 'red') {
      for (const f of facesOf(ctx)) for (const [p, q] of freeSpans(ctx, f, 0.6)) {
        if (n >= 4 || q - p < 0.8) continue;
        const D: Box[] = [];
        extinguisher(D, f, (p + q) / 2);
        lift(D, fy);
        if (D.some((b) => solids.some((s) => s.min[0] < b.max[0] && s.max[0] > b.min[0] && s.min[2] < b.max[2] && s.max[2] > b.min[2] && s.min[1] < b.max[1]))) continue;
        B.push(...D);
        n++;
      }
    } else {
      for (const [x, z] of ctx.rng.shuffle(gridPoints(ctx, 1.1, 0.5))) {
        if (n >= 5) break;
        if (blockedAt(solids, x, z, 0.4) || hitsAny(doors, { min: [x - 0.3, fy, z - 0.3], max: [x + 0.3, fy + 1, z + 0.3] })) continue;
        const D: Box[] = [];
        if (key === 'green') plant(D, x, z, 0.45, 1.1, 'furnitureDark');
        else D.push(box([x - 0.18, 0, z - 0.18], [x + 0.18, 0.6, z + 0.18], 'plasticBlue', true), box([x - 0.19, 0.56, z - 0.19], [x + 0.19, 0.6, z + 0.19], 'plasticBlue', false));
        lift(D, fy);
        // 鉢植え・ごみ箱は当たる（置いて通り道が塞がるなら置かない）
        addGroup(ctx, D, `hue${n}`);
        if (!ctx.reachOk()) { const set = new Set(D); ctx.removeBoxes((b) => set.has(b)); continue; }
        solids.push(...D.filter((b) => b.solid));
        n++;
      }
    }
    if (B.length) addGroup(ctx, B, 'hueProps');
    // 部屋の中のその色の材質を、色の抜けた灰色に
    const set = new Set<MatId>(H.mats);
    let swapped = 0;
    // 通り抜けられる草木は、材質を変えても通り抜けられるまま（当たる箱にしない）
    for (const b of cell.boxes) if (set.has(b.mat)) { if (PASSABLE_VEGETATION.has(b.mat)) b.solid = false; b.mat = greyOf(b.mat); swapped++; }
    if (set.has(cell.palette.floor)) cell.palette = { ...cell.palette, floor: greyOf(cell.palette.floor) };
    if (set.has(cell.palette.wall)) cell.palette = { ...cell.palette, wall: greyOf(cell.palette.wall) };
    if (swapped < 3) return false;
    roomFx(ctx, { kind: 'grade', grade: { hueKill: { hue: H.hue, width: 0.1, amount: 1 } } });
    return true;
  },
});

/** 単色の部屋の色（colorMask と画面の色） */
const TINTS: [number, number, number][] = [[1, 0.42, 0.48], [0.45, 0.68, 1], [0.5, 1, 0.58], [1, 0.86, 0.38]];

/**
 * 単色の部屋: 黒一色（床・壁・天井・家具が艶のある黒。照明の映り込みで形だけが見える）か、1 色だけの部屋（全部が 1 つの色の無地）。
 * 中に入ると画面もその色だけになる。白一色は既存の色の異変（tint）
 */
defineAnomaly({
  id: 'mono', name: '単色の部屋', weight: 0.6, intensity: 1, kinds: ['room', 'hall'],
  post(ctx) {
    const cell = ctx.cell;
    const black = ctx.rng.chance(ctx.tuning['anomaly.mono.black']);
    ctx.memo.kind = black ? 'black' : 'single';
    if (black) {
      for (const b of cell.boxes) if (!KEEP_COLOR.has(b.mat)) { if (PASSABLE_VEGETATION.has(b.mat)) b.solid = false; b.mat = 'screenDark'; }
      cell.palette = { ...cell.palette, floor: 'screenDark', wall: 'screenDark', ceiling: 'screenDark', ambient: 0x101012, lightColor: 0xffffff };
      roomFx(ctx, { kind: 'grade', grade: { saturation: 0, contrast: 1.15 } });
      return true;
    }
    const tint = ctx.rng.pick(TINTS);
    for (const b of cell.boxes) if (!KEEP_COLOR.has(b.mat)) { if (PASSABLE_VEGETATION.has(b.mat)) b.solid = false; b.mat = 'untextured'; }
    cell.palette = { ...cell.palette, floor: 'untextured', wall: 'untextured', ceiling: 'untextured', lightColor: 0xffffff, ambient: 0x9a9a9a };
    cell.render = { ...cell.render, style: 'untextured', colorMask: tint };
    const color = (Math.round(tint[0] * 255) << 16) | (Math.round(tint[1] * 255) << 8) | Math.round(tint[2] * 255);
    roomFx(ctx, { kind: 'grade', grade: { mono: { color, amount: 0.85 } } });
    return true;
  },
});
