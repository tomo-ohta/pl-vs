/**
 * 距離を飛び越える扉（lightFrame: W03・BX03）。部品は warpGate（面をくぐると移す）と warpPortal（枠の向こうを描く板）。
 *
 * 遊び方: 部屋の真ん中に、白く光る枠が 1 つだけ立っている。枠の中には、この部屋ではない夕暮れの展望室（大きな窓・長椅子）が見える。
 * くぐると展望室に出る（振り返ると、枠の向こうに元の部屋）。もう一度くぐれば戻る。
 * BX03: 枠の裏へ回ると、裏からは別の所（白い短い廊下）が見えることがある。裏からくぐると、その廊下の突き当たりの壁が開いて隠し部屋へ。
 * 閉じ込めない: 枠はどちらの側からもいつでもくぐって戻れる（展望室・廊下の枠も同じ）。
 *
 * 作り: 展望室と廊下は部屋の真上の別の空間（向きはそのまま。枠の真ん中どうしを平行に移す）。枠の向こうは窓・枠の描画（client/world/Portals.ts）
 */
import { WARP_TUNING } from '../../../config/tuning/warp.ts';
import { rotQ, type Dir, type Vec3 } from '../../../math/vec.ts';
import { themePalette } from '../../../world/palettes.ts';
import { box, type Json, type Palette } from '../../../world/layout.ts';
import { xInverse, xJson, type Xform } from '../../../sim/parts/warp/util.ts';
import { defineGimmick, type GimmickContext } from '../types.ts';
import { doorZone, innerRect } from '../util.ts';
import { addPocketCell, canPocket, ceilingLight, isBSide, makeFrame, nextPocketRise, pocketCell, type Frame } from './pocket.ts';

const FW = 1.2, FH = 2.2, POST = 0.1;

/** 枠（光る柱 2 本と上の梁）を、局所の座標 f（u = くぐる向き）の u = 0 に立てる */
function frameBoxes(f: Frame): ReturnType<Frame['box']>[] {
  return [
    f.box(-0.06, 0, -FW / 2 - POST, 0.06, FH + POST, -FW / 2, 'lightPanel', true),
    f.box(-0.06, 0, FW / 2, 0.06, FH + POST, FW / 2 + POST, 'lightPanel', true),
    f.box(-0.06, FH, -FW / 2, 0.06, FH + POST, FW / 2, 'lightPanel', false),
  ];
}

/** くぐる面の範囲（warpGate の box）: 枠の中・面の前後 0.3 m */
const gateBox = (f: Frame): Json => { const a = f.aabb(-0.3, -0.3, -FW / 2, 0.3, FH, FW / 2); return { min: [...a.min], max: [...a.max] }; };

function lounge(ctx: GimmickContext, f: Frame, id: string, H: number): void {
  // 夕暮れの展望室: 奥行き（くぐる向き）6 m・幅 7.2 m。枠は奥行きの 1/3 の所。くぐる向きの奥と左右に大きな窓、窓の前に長椅子
  const pal: Palette = { ...themePalette('Gallery'), floor: 'floorWood', wall: 'wallDark', ceiling: 'ceilingDark', light: 'lightWarm', lightColor: 0xffc58a, lightIntensity: 0.7 } as Palette;
  const u0 = -2.0, u1 = 4.0, v0 = -3.6, v1 = 3.6;
  const cell = pocketCell({ id, pocket: ctx.id, rects: [f.rect(u0, v0, u1, v1)], height: H, floorY: f.o[1], palette: pal, openings: [], theme: 'Gallery', name: '展望室', audio: '静かな空調' });
  ceilingLight(cell, f, 0.0, 0, H, false, true, 0.6, 6);
  ceilingLight(cell, f, 2.6, 0, H, false, true, 0.6, 6);
  const B = cell.boxes;
  // 窓（奥の壁・左右の壁の奥寄り）: 夕空の板と窓枠
  const win = (a: ReturnType<Frame['aabb']>): void => { B.push(box(a.min, a.max, 'skyDusk', false)); };
  win(f.aabb(u1 - 0.17, 0.8, -2.6, u1 - 0.155, 2.5, 2.6));
  win(f.aabb(1.0, 0.8, v1 - 0.17, 3.6, 2.5, v1 - 0.155));
  win(f.aabb(1.0, 0.8, v0 + 0.155, 3.6, 2.5, v0 + 0.17));
  for (const vv of [-2.6, -0.87, 0.87, 2.6]) B.push(f.box(u1 - 0.2, 0.8, vv - 0.04, u1 - 0.15, 2.5, vv + 0.04, 'trim', false));
  B.push(f.box(u1 - 0.22, 0.75, -2.65, u1 - 0.15, 0.8, 2.65, 'trim', false));
  // 長椅子（窓の前・窓を向く）
  for (const vv of [-1.4, 1.4]) {
    B.push(f.box(u1 - 1.6, 0.42, vv - 0.9, u1 - 1.15, 0.47, vv + 0.9, 'woodPanel', true));
    B.push(f.box(u1 - 1.55, 0, vv - 0.85, u1 - 1.2, 0.42, vv - 0.75, 'metalDark', false));
    B.push(f.box(u1 - 1.55, 0, vv + 0.75, u1 - 1.2, 0.42, vv + 0.85, 'metalDark', false));
  }
  // 鉢植え（手前の隅）
  B.push(f.box(u0 + 0.35, 0, v0 + 0.35, u0 + 0.85, 0.5, v0 + 0.85, 'furnitureDark', true));
  B.push(f.box(u0 + 0.25, 0.5, v0 + 0.25, u0 + 0.95, 1.5, v0 + 0.95, 'plantLeaf', false));
  B.push(...frameBoxes(f));
  addPocketCell(ctx, cell, 'room', []);
}

function corridor(ctx: GimmickContext, f: Frame, id: string, H: number): string {
  // 白い短い廊下（くぐる向き = u。枠は u = 0、突き当たりは u = 3.8）。突き当たりの壁に隠しの扉
  const pal: Palette = { ...themePalette('GenericCorridor'), floor: 'floorLino', wall: 'wallWhite', ceiling: 'ceilingWhite', light: 'lightPanel', lightColor: 0xf0f4ff, lightIntensity: 1.0 } as Palette;
  const cell = pocketCell({ id, pocket: ctx.id, rects: [f.rect(-1.4, -1.2, 3.8, 1.2)], height: H, floorY: f.o[1], palette: pal, openings: [], theme: 'GenericCorridor', name: '白い廊下' });
  ceilingLight(cell, f, 1.4, 0, H, true, true, 0.8, 5);
  cell.boxes.push(...frameBoxes(f));
  addPocketCell(ctx, cell, 'corridor', []);
  return cell.id;
}

defineGimmick({
  id: 'lightFrame', name: '距離を飛び越える扉', axes: ['move', 'sight'], kinds: ['room'], minSize: [5.0, 5.5], minHeight: 2.5, weight: WARP_TUNING['warp.lightFrame.weight'].default, intensity: 1,
  offersSecret: true, onMainPath: true,
  fits: (s) => s.cell.footprint.length === 1,
  build(ctx) {
    if (!canPocket(ctx) || isBSide(ctx)) return;
    const s = ctx.slot;
    const r = innerRect(s);
    const y = s.cell.floorY;
    const H = Math.min(s.cell.height, 3.0);
    // 枠の置き場所: 部屋の真ん中の近く。くぐる向き（u）の前後 1.6 m・横 0.6 m が空いていて、開口の前（1.4 m）に掛からない
    const zones = s.openings.map((o) => doorZone(o, y, 1.4, 0.4));
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    let pick: { c: Vec3; d: Dir } | null = null;
    const dirs: Dir[] = (r.x1 - r.x0) >= (r.z1 - r.z0) ? [1, 0] : [0, 1];
    for (const off of [0, 0.8, -0.8, 1.6, -1.6]) {
      for (const d of dirs) {
        const along = d === 1 ? [off, 0] : [0, off];
        const c: Vec3 = [cx + along[0]!, y, cz + along[1]!];
        const f = makeFrame(c, d);
        const need = f.aabb(-1.6, 0, -FW / 2 - POST - 0.6, 1.6, 2.5, FW / 2 + POST + 0.6);
        if (need.min[0] < r.x0 || need.max[0] > r.x1 || need.min[2] < r.z0 || need.max[2] > r.z1) continue;
        if (zones.some((z) => need.min[0] < z.max[0] && need.max[0] > z.min[0] && need.min[2] < z.max[2] && need.max[2] > z.min[2])) continue;
        if (s.cell.boxes.some((b) => b.solid && b.min[1] < y + 2.3 && b.max[1] > y + 0.05 && b.min[0] < need.max[0] && b.max[0] > need.min[0] && b.min[2] < need.max[2] && b.max[2] > need.min[2])) continue;
        pick = { c, d };
        break;
      }
      if (pick) break;
    }
    if (!pick) return;
    const ts = pick.d;
    const fS = makeFrame(pick.c, ts);
    for (const b of frameBoxes(fS)) ctx.addBox(b);
    const keep = fS.aabb(-1.6, -0.1, -FW / 2 - 0.7, 1.6, 3, FW / 2 + 0.7);
    ctx.keepOut({ min: [...keep.min], max: [...keep.max] });
    // 展望室（真上の別の空間）・白い廊下（展望室の横）
    const rise = nextPocketRise(ctx);
    const lat = rotQ([0, 0, 1], ((ts + 1) % 4) as Dir);
    const cD: Vec3 = [pick.c[0], y + rise, pick.c[2]];
    const cE: Vec3 = [pick.c[0] + lat[0] * 14, y + rise, pick.c[2] + lat[2] * 14];
    const fD = makeFrame(cD, ts);
    const fE = makeFrame(cE, ((ts + 2) % 4) as Dir);
    const D = `${s.cell.id}~view`, E = `${s.cell.id}~white`;
    lounge(ctx, fD, D, H);
    corridor(ctx, fE, E, H);
    const xSD: Xform = { from: [...pick.c], to: cD, q: 0 };
    const xSE: Xform = { from: [...pick.c], to: cE, q: 0 };
    const back = ((ts + 2) % 4) as Dir;
    // 面をくぐる部品: 表 S → 展望室・展望室 → S の表・（隠しがあれば）裏 S → 廊下・廊下 → S の裏
    const gSB = `${ctx.id}.gSB`;
    ctx.addEntity('gSF', { type: 'warpGate', params: { box: gateBox(fS), dir: ts, xform: xJson(xSD) } });
    ctx.addEntity('gDB', { type: 'warpGate', cell: D, params: { box: gateBox(fD), dir: back, xform: xJson(xInverse(xSD)) } });
    ctx.addEntity('gSB', { type: 'warpGate', params: { box: gateBox(fS), dir: back, xform: xJson(xSE), needs: `${gSB}.count` } });
    ctx.addEntity('gEB', { type: 'warpGate', cell: E, params: { box: gateBox(fE), dir: ts, xform: xJson(xInverse(xSE)), needs: `${gSB}.count` } });
    // 枠の向こうを描く板（表・裏。展望室と廊下の側は、くぐって出た側から振り返ったときに見える面）
    const mid = (c: Vec3): number[] => [c[0], c[1] + FH / 2, c[2]];
    ctx.addEntity('pSF', { type: 'warpPortal', params: { center: mid(pick.c), dir: back, w: FW, h: FH, xform: xJson(xSD) } });
    ctx.addEntity('pDB', { type: 'warpPortal', cell: D, params: { center: mid(cD), dir: ts, w: FW, h: FH, xform: xJson(xInverse(xSD)) } });
    ctx.addEntity('pSB', { type: 'warpPortal', params: { center: mid(pick.c), dir: ts, w: FW, h: FH, xform: xJson(xSE), needs: `${gSB}.count` } });
    ctx.addEntity('pEB', { type: 'warpPortal', cell: E, params: { center: mid(cE), dir: back, w: FW, h: FH, xform: xJson(xInverse(xSE)), needs: `${gSB}.count` } });
    // BX03: 廊下の突き当たりの壁の隠しの扉（出現型。裏からくぐった tick に開く）
    const end = fE.p(3.8, 0, 0);
    const ed = fE.dir(0);
    ctx.offerSecret({ hook: 'frame.back', modes: ['appear'], weight: ctx.tuning['warp.lightFrame.secretWeight'], revealOutput: `${gSB}.count`, cell: E, doorway: { dir: ed, at: ed === 0 || ed === 2 ? end[0] : end[2], y: y + rise, width: 1.0, height: 2.0 }, tell: '光の枠の裏から' });
    // 歩く人の道順（くぐる手前 0.25 m に着いたら、くぐる向きへ歩く）
    const u = rotQ([0, 0, 1], ts);
    const at = (c: Vec3, k: number): number[] => [c[0] - u[0] * 0.25 * k, c[1], c[2] - u[2] * 0.25 * k];
    const links: Json[] = [
      { from: s.cell.id, to: D, at: at(pick.c, 1), push: [u[0], u[2]] },
      { from: D, to: s.cell.id, at: at(cD, -1), push: [-u[0], -u[2]] },
    ];
    // 隠しの廊下への道（隠しが付いたときだけ歩く人が使う。付いていなければ廊下は道順に出てこない）
    links.push({ from: s.cell.id, to: E, at: at(pick.c, -1), push: [-u[0], -u[2]] }, { from: E, to: s.cell.id, at: at(cE, 1), push: [u[0], u[2]] });
    ctx.addEntity('links', { type: 'warpLinks', params: { warpLinks: links } });
  },
});
