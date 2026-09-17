/** MegaHall（巨大床 + 柱グリッド + 環境要素）。L02 室内海洋 / L03 倉庫内麦畑 / L12 設備大聖堂。
 *  - L02 'sea': 高い暗い天井 + 疎らな杭柱 + 桟橋の浮橋（低い木デッキ島）+ 出口の水門枠。水面と入口〜出口の桟橋は ShallowWater Modifier が張る。
 *  - L03 'field': xl（200 m 級）の倉庫。農道格子（薄い舗装帯）+ 畑区画（低い草の箔。麦は InstanceOvergrowth）+ 倉庫柱 + 高所灯 + 出口へ延びる農道。
 *  - L12 'nave': 身廊（2 列の角柱）+ 側廊の制御室 + 歩ける配管橋（両端に階段）+ 装飾の配管橋 + 巨大設備（小道具は ScaleAnomaly perProp が 3〜8 倍）。
 *  同名部屋でも variant（寸法・入口位置）と seed で柱間隔・区画・設備配置が変わる。 */
import type { Dir } from '../core/types';
import type { Rng } from '../core/rng';
import { inner, rect, rectArea, type Rect } from './footprint';
import { bonusExits, box, snap, WIDE_W, type GenParams, type MatId, type RoomLayout } from './layout';
import {
  blocked, columnGrid, commitShell, createCtx, dims, entryShift, finish, floorSheet, furnishIslands, furnishPerimeter, furnishRows, hangingLights, inwardOf, mergeExtraSockets, partition, rail,
  remaining, reserve, sizeIdxOf, slab, stairs, themeZone, type MegaCtx,
} from './MegaStructureGenerator.common';

type HallKind = 'sea' | 'field' | 'nave' | 'columnField';

function kindOf(p: GenParams, vr: Rng): HallKind {
  switch (p.def.id) {
    case 'L02': return 'sea';
    case 'L03': return 'field';
    case 'L12': return 'nave';
    default: return vr.chance(0.5) ? 'columnField' : 'nave';
  }
}

export function generateMegaHall(p: GenParams): RoomLayout {
  const vr = p.rng.fork(`v${p.variant}`);
  const kind = kindOf(p, vr);
  const xl = p.def.layoutHints.includes('xl');
  const sizeIdx = sizeIdxOf(p.variant);

  // 寸法（長辺 = SIZE_SCALE、xl は 1.25 倍）。nave は長辺を進行方向（z）に取る
  let w: number;
  let d: number;
  if (kind === 'nave') {
    const dm = dims(p.variant, vr, 0.36);
    w = dm.d;
    d = dm.w;
  } else {
    // xl（L03）は 180 m 基準（jitter +10% でも長辺 ≤ 198 m。性能予算「部屋の幅・奥行 ≤ 200 m」に収める）
    const dm = dims(p.variant, vr, kind === 'field' ? 0.6 : 0.65, xl ? [180, 150, 120, 90, 70][sizeIdx] : undefined);
    if (vr.chance(0.5)) { w = dm.w; d = dm.d; } else { w = dm.d; d = dm.w; }
  }
  const h = kind === 'nave' ? snap(vr.float(14, 18)) : kind === 'sea' ? snap(vr.float(10, 13)) : Math.min(14, snap(9 + Math.max(w, d) / 20));
  const shift = entryShift(p.variant, w);
  const main = p.mainRect ? rect(p.mainRect.x0, p.mainRect.z0, p.mainRect.x1, p.mainRect.z1) : rect(-w / 2 - shift, 0, w / 2 - shift, d);
  const rects: Rect[] = [main];
  const area = rectArea(main);
  const exits = Math.min(6, Math.max(2, Math.max(p.exits, p.def.minExits) + bonusExits(area)));

  const palette: Partial<RoomLayout['palette']> =
    kind === 'sea' ? { floor: 'floorConcrete', wall: 'wallConcrete', ceiling: 'ceilingDark', door: 'doorMetal', light: 'lightWarm', lightColor: 0xffd9a0, ambient: 0x4a5060, fog: 0x070a12 }
    : kind === 'field' ? { floor: 'floorConcrete', wall: 'wallConcrete', ceiling: 'ceilingDark', door: 'doorMetal', ambient: 0x8a8a78 }
    : kind === 'nave' ? { floor: 'floorConcrete', wall: 'wallConcrete', ceiling: 'ceilingDark', door: 'doorMetal', light: 'lightPanel', lightColor: 0xe9f0ff, ambient: 0x40444c, fog: 0x05060a }
    : { floor: 'floorConcrete', wall: 'wallConcrete', ceiling: 'ceilingDark', door: 'doorMetal' };

  const { c, entry, ceilingHole } = createCtx(p, vr, {
    rects, main, h, levels: 1, groundExits: exits,
    exitWidth: kind === 'sea' || kind === 'field' ? WIDE_W : undefined,
    exitHeight: kind === 'sea' || kind === 'field' ? 2.6 : undefined,
    holeChance: 0.25, palette,
  });

  // ---- 構造（シェル側）。直結ソケットはここで合流
  mergeExtraSockets(c);
  let nave: NaveInfo | null = null;
  switch (kind) {
    case 'sea': structureSea(c); break;
    case 'field': structureField(c); break;
    case 'nave': nave = structureNave(c); break;
    default: columnGrid(c, main, vr.chance(0.5) ? 9 : 10.5, 0.7, 'columnConcrete'); break;
  }
  const shellCount = commitShell(c, ceilingHole);

  // ---- 内装（小道具。Modifier の対象）
  switch (kind) {
    case 'sea': furnishSea(c); break;
    case 'field': furnishField(c); break;
    case 'nave': furnishNave(c, nave!); break;
    default: {
      themeZone(c, main, '大ホール', 'hall');
      furnishIslands(c, main, Math.round(area / 400), ['furnitureDark', 'boxCardboard'], [1.2, 3], [0.6, 1.4], vr);
      hangingLights(c, rects, h - 1.5, 12, c.L.palette.light, c.L.palette.lightColor, 1.0, vr, 5, 0.15);
    }
  }

  return finish(c, entry, shellCount, { chunkSize: xl ? 32 : 28, labelWidth: 3.2 });
}

// ---------------------------------------------------------------- L02 室内海洋

function structureSea(c: MegaCtx): void {
  const { main, vr } = c;
  // 杭柱（疎ら。14〜18 m 格子）
  columnGrid(c, main, snap(vr.float(14, 18)), 0.6, 'columnConcrete', c.h, 3);
  // 出口の水門枠（門柱 + 梁。歩行を妨げない非ソリッド）。入口側にも
  for (const s of c.sockets) {
    if (s.type === 'hole') continue;
    const inward = inwardOf(s.dir);
    const side: [number, number] = s.dir === 0 || s.dir === 2 ? [1, 0] : [0, 1];
    const off = s.width / 2 + 0.8;
    const gateH = Math.min(c.h - 1, 6.5);
    for (const sg of [-1, 1]) {
      const px = s.pos[0] + inward[0] * 1.6 + side[0] * off * sg;
      const pz = s.pos[2] + inward[1] * 1.6 + side[1] * off * sg;
      c.structure.push(box([px - 0.25, 0, pz - 0.25], [px + 0.25, gateH, pz + 0.25], 'metal', false));
    }
    const lx0 = s.pos[0] + inward[0] * 1.6 - side[0] * (off + 0.25);
    const lx1 = s.pos[0] + inward[0] * 1.6 + side[0] * (off + 0.25);
    const lz0 = s.pos[2] + inward[1] * 1.6 - side[1] * (off + 0.25);
    const lz1 = s.pos[2] + inward[1] * 1.6 + side[1] * (off + 0.25);
    c.structure.push(box([Math.min(lx0, lx1) - (side[0] ? 0 : 0.25), gateH - 0.6, Math.min(lz0, lz1) - (side[1] ? 0 : 0.25)], [Math.max(lx0, lx1) + (side[0] ? 0 : 0.25), gateH, Math.max(lz0, lz1) + (side[1] ? 0 : 0.25)], 'metal', false));
    // 水門のサイン
    (c.L.signs ??= []).push({ text: s.id === 'entry' ? 'GATE 0' : `GATE ${s.id.replace(/\D/g, '') || '1'}`, pos: [s.pos[0] + inward[0] * 1.6, gateH - 0.3, s.pos[2] + inward[1] * 1.6], dir: ((s.dir + 2) % 4) as Dir, width: 1.6, kind: 'emissive', color: 0xffe0a0 });
  }
}

function furnishSea(c: MegaCtx): void {
  const { main, vr, L } = c;
  const d = main.z1 - main.z0;
  // ゾーン: 桟橋区（入口側）/ 外海 / 水門区（奥）
  themeZone(c, rect(main.x0, main.z0, main.x1, main.z0 + d * 0.3), '桟橋区', 'harbor');
  themeZone(c, rect(main.x0, main.z0 + d * 0.3, main.x1, main.z0 + d * 0.72), '外海', 'sea');
  themeZone(c, rect(main.x0, main.z0 + d * 0.72, main.x1, main.z1), '水門区', 'gate');
  // 浮橋（低い木デッキの島。0.3 m で登れる。ShallowWater の桟橋と重なるものは Modifier 側が取り除く）
  const area = rectArea(main);
  const n = Math.round(area / 900) + 4;
  for (let i = 0, tries = 0; i < n && tries < n * 5; tries++) {
    const w = vr.float(3, 6);
    const dd = vr.float(3, 7);
    const ir = inner(main, 4);
    const x = snap(vr.float(ir.x0 + w / 2, ir.x1 - w / 2));
    const z = snap(vr.float(ir.z0 + dd / 2, ir.z1 - dd / 2));
    const r = rect(x - w / 2, z - dd / 2, x + w / 2, z + dd / 2);
    if (blocked(c, r, 0, 1.5, 1.5)) continue;
    if (remaining(c) < 60) break;
    L.boxes.push(box([r.x0, 0, r.z0], [r.x1, 0.3, r.z1], 'floorWood'));
    // 係船柱
    for (const [px, pz] of [[r.x0 + 0.3, r.z0 + 0.3], [r.x1 - 0.3, r.z1 - 0.3]]) {
      L.boxes.push(box([px - 0.12, 0.3, pz - 0.12], [px + 0.12, 1.2, pz + 0.12], 'furnitureDark'));
    }
    if (vr.chance(0.5)) L.boxes.push(box([r.x0 + 0.6, 0.3, r.z0 + 0.6], [r.x0 + 1.6, 1.1, r.z0 + 1.4], 'boxCardboard'));
    i++;
  }
  // 浮標（水面に浮く小箱。非ソリッド）
  const buoys = Math.round(area / 500);
  for (let i = 0; i < buoys; i++) {
    const ir = inner(main, 3);
    const x = vr.float(ir.x0, ir.x1);
    const z = vr.float(ir.z0, ir.z1);
    if (blocked(c, rect(x - 0.4, z - 0.4, x + 0.4, z + 0.4), 0, 1.2, 0.5)) continue;
    L.boxes.push(box([x - 0.35, 0.35, z - 0.35], [x + 0.35, 0.95, z + 0.35], vr.chance(0.5) ? 'yellowLine' : 'carPaint', false));
  }
  // 薄明の吊り灯（暖色、疎ら、消灯多め）
  hangingLights(c, [main], c.h - 3.5, 16, 'lightWarm', 0xffd9a0, 0.9, vr, 3, 0.3, 1.0);
}

// ---------------------------------------------------------------- L03 倉庫内麦畑

function structureField(c: MegaCtx): void {
  const { main, vr } = c;
  // 倉庫柱（12 m 格子）
  columnGrid(c, main, snap(vr.float(11, 13)), 0.6, 'columnConcrete', c.h, 4);
  // 高所の梁（装飾。非ソリッド）: 短手方向に 12 m ごと
  const alongX = main.x1 - main.x0 >= main.z1 - main.z0;
  const len = alongX ? main.x1 - main.x0 : main.z1 - main.z0;
  const nBeam = Math.floor(len / 12);
  for (let i = 1; i < nBeam; i++) {
    const t = (alongX ? main.x0 : main.z0) + (len * i) / nBeam;
    if (alongX) c.structure.push(box([t - 0.3, c.h - 1.0, main.z0 + 0.2], [t + 0.3, c.h - 0.2, main.z1 - 0.2], 'metal', false));
    else c.structure.push(box([main.x0 + 0.2, c.h - 1.0, t - 0.3], [main.x1 - 0.2, c.h - 0.2, t + 0.3], 'metal', false));
  }
}

function furnishField(c: MegaCtx): void {
  const { main, vr, L } = c;
  const ir = inner(main, 2.5);
  const pitch = snap(vr.float(14, 18));
  const roadW = 3.0;
  // 農道格子（薄い舗装帯）: 内側矩形を pitch で割る
  const nx = Math.max(1, Math.round((ir.x1 - ir.x0) / pitch));
  const nz = Math.max(1, Math.round((ir.z1 - ir.z0) / pitch));
  const xs: number[] = [];
  const zs: number[] = [];
  for (let i = 1; i < nx; i++) xs.push(snap(ir.x0 + ((ir.x1 - ir.x0) * i) / nx));
  for (let j = 1; j < nz; j++) zs.push(snap(ir.z0 + ((ir.z1 - ir.z0) * j) / nz));
  for (const x of xs) floorSheet(c, rect(x - roadW / 2, ir.z0, x + roadW / 2, ir.z1), 'floorConcrete', 0.03);
  for (const z of zs) floorSheet(c, rect(ir.x0, z - roadW / 2, ir.x1, z + roadW / 2), 'floorConcrete', 0.03);
  // 外周の農道（壁沿い 2.5 m）
  floorSheet(c, rect(main.x0 + 0.15, main.z0 + 0.15, main.x1 - 0.15, ir.z0), 'floorConcrete', 0.03);
  floorSheet(c, rect(main.x0 + 0.15, ir.z1, main.x1 - 0.15, main.z1 - 0.15), 'floorConcrete', 0.03);
  floorSheet(c, rect(main.x0 + 0.15, ir.z0, ir.x0, ir.z1), 'floorConcrete', 0.03);
  floorSheet(c, rect(ir.x1, ir.z0, main.x1 - 0.15, ir.z1), 'floorConcrete', 0.03);
  // 出口から最寄りの農道へ延びる帯
  for (const s of c.sockets) {
    if (s.type === 'hole') continue;
    const inward = inwardOf(s.dir);
    const target = s.dir === 0 || s.dir === 2 ? (s.dir === 2 ? ir.z0 : ir.z1) : (s.dir === 3 ? ir.x0 : ir.x1);
    const from = s.dir === 0 || s.dir === 2 ? s.pos[2] : s.pos[0];
    const a0 = Math.min(from, target);
    const a1 = Math.max(from, target);
    void inward;
    if (s.dir === 0 || s.dir === 2) floorSheet(c, rect(s.pos[0] - 1.5, a0, s.pos[0] + 1.5, a1), 'floorConcrete', 0.035);
    else floorSheet(c, rect(a0, s.pos[2] - 1.5, a1, s.pos[2] + 1.5), 'floorConcrete', 0.035);
  }
  // 畑区画（低い草の箔。麦のインスタンスは InstanceOvergrowth）+ ゾーン（4 象限）
  const xb = [ir.x0, ...xs, ir.x1];
  const zb = [ir.z0, ...zs, ir.z1];
  for (let i = 0; i < xb.length - 1; i++) {
    for (let j = 0; j < zb.length - 1; j++) {
      const r = rect(xb[i] + (i === 0 ? 0 : roadW / 2) + 0.3, zb[j] + (j === 0 ? 0 : roadW / 2) + 0.3, xb[i + 1] - (i === xb.length - 2 ? 0 : roadW / 2) - 0.3, zb[j + 1] - (j === zb.length - 2 ? 0 : roadW / 2) - 0.3);
      if (r.x1 - r.x0 < 3 || r.z1 - r.z0 < 3) continue;
      if (remaining(c) < 60) break;
      L.boxes.push(box([r.x0, 0.005, r.z0], [r.x1, 0.28, r.z1], 'grass', false));
    }
  }
  const cx = (main.x0 + main.x1) / 2;
  const cz = (main.z0 + main.z1) / 2;
  themeZone(c, rect(main.x0, main.z0, cx, cz), '南西の畑', 'field');
  themeZone(c, rect(cx, main.z0, main.x1, cz), '南東の畑', 'field');
  themeZone(c, rect(main.x0, cz, cx, main.z1), '北西の畑', 'field');
  themeZone(c, rect(cx, cz, main.x1, main.z1), '北東の畑', 'field');
  // 倉庫の名残り: 壁沿いのパレット山（低い箱）と農機（暗い箱）
  furnishPerimeter(c, main, [true, true, true, true], 1.2, 1.1, 'boxCardboard', vr, 0.75);
  furnishIslands(c, main, Math.round(rectArea(main) / 1500), ['furnitureDark', 'metal'], [1.5, 3.5], [1.0, 1.8], vr, 4);
  // 高所灯（高天井の白色。everyNth 6）
  hangingLights(c, [main], c.h - 1.2, 12, 'lightPanel', 0xf2f4ff, 1.0, vr, 6, 0.12, 1.6);
}

// ---------------------------------------------------------------- L12 設備大聖堂

interface NaveInfo {
  ctrlRooms: Rect[];
  naveHalf: number;
}

function structureNave(c: MegaCtx): NaveInfo {
  const { main, vr, h } = c;
  const w = main.x1 - main.x0;
  const cx = (main.x0 + main.x1) / 2;
  const naveHalf = Math.min(8, Math.max(5, w * 0.2));
  const pitch = snap(vr.float(7, 9));
  // 身廊の 2 列の角柱（1.2 m）
  for (let z = main.z0 + pitch; z < main.z1 - 2; z += pitch) {
    for (const sx of [-1, 1]) {
      const x = cx + sx * naveHalf;
      const r = rect(x - 0.6, z - 0.6, x + 0.6, z + 0.6);
      if (blocked(c, r, 0, h, 0.6)) continue;
      c.structure.push(box([r.x0, 0, r.z0], [r.x1, h, r.z1], 'columnConcrete'));
      // 柱に沿う縦配管
      c.structure.push(box([x + sx * 0.75, 0, z - 0.3], [x + sx * 1.05, h - 1, z + 0.3], 'metal', false));
    }
  }
  // 側廊の制御室（間仕切り小部屋。身廊側に扉開口）: 12 m ごと、左右交互
  const roomD = 6;
  const roomW = Math.min(5, Math.max(3.5, (w / 2 - naveHalf) * 0.55));
  let side = vr.chance(0.5) ? -1 : 1;
  const ctrlRooms: Rect[] = [];
  for (let z = main.z0 + 8; z + roomD < main.z1 - 6; z += 12) {
    const wallX = side < 0 ? main.x0 : main.x1;
    const x0 = side < 0 ? wallX + 0.15 : wallX - 0.15 - roomW;
    const x1 = x0 + roomW;
    const r = rect(x0, z, x1, z + roomD);
    if (!blocked(c, r, 0, 3.2, 0.8)) {
      // 身廊側の壁（扉開口 1.2 m）と前後の壁
      const faceX = side < 0 ? x1 : x0;
      partition(c, 'z', faceX, z, z + roomD, 3.0, 'wallConcrete', [[z + roomD / 2 - 0.6, z + roomD / 2 + 0.6]]);
      partition(c, 'x', z, Math.min(x0, x1), Math.max(x0, x1), 3.0, 'wallConcrete', []);
      partition(c, 'x', z + roomD, Math.min(x0, x1), Math.max(x0, x1), 3.0, 'wallConcrete', []);
      // 天板（屋根）
      c.structure.push(box([x0, 3.0, z], [x1, 3.15, z + roomD], 'metal'));
      ctrlRooms.push(r);
    }
    side = -side;
  }
  c.L.zones ??= [];
  // 歩ける配管橋（身廊を横断。両端の側廊に階段）: 部屋の中央付近
  const zb = snap(main.z0 + (main.z1 - main.z0) * vr.float(0.45, 0.6));
  const bridgeHalf = 1.2;
  const landW = 2.4;
  const ok = [-1, 1].every((sx) => {
    const lx0 = cx + sx * (naveHalf + 1.0) - (sx < 0 ? landW : 0);
    const lr = rect(lx0, zb - bridgeHalf, lx0 + landW, zb + bridgeHalf);
    const sr = rect(lx0 + (sx < 0 ? landW - 1.5 : 0), zb - bridgeHalf - 6.3, lx0 + (sx < 0 ? landW : 1.5), zb - bridgeHalf);
    return !blocked(c, lr, 0, 6, 0.6) && !blocked(c, sr, 0, 6, 0.6) && lr.x0 > main.x0 + 1 && lr.x1 < main.x1 - 1;
  });
  if (ok) {
    for (const sx of [-1, 1]) {
      const lx0 = cx + sx * (naveHalf + 1.0) - (sx < 0 ? landW : 0);
      const lr = rect(lx0, zb - bridgeHalf, lx0 + landW, zb + bridgeHalf);
      slab(c.structure, lr, 3.6, 'metal');
      // 階段（z 方向に上って踊り場へ）
      const strip: [number, number] = sx < 0 ? [lx0 + landW - 1.5, lx0 + landW] : [lx0, lx0 + 1.5];
      const foot = stairs(c.structure, 'z', zb - bridgeHalf - 6, zb - bridgeHalf, strip, 0, 3.6, 'metal');
      reserve(c, rect(foot.x0 - 0.5, foot.z0 - 1.2, foot.x1 + 0.5, foot.z1), 0, 6.5);
      reserve(c, rect(lr.x0 - 0.3, lr.z0 - 0.3, lr.x1 + 0.3, lr.z1 + 0.3), 0, 6.5);
      // 踊り場の手すり（橋側・階段側以外）
      rail(c.structure, lr.x0, lr.z1, lr.x1, lr.z1, 3.6);
      const outerX = sx < 0 ? lr.x0 : lr.x1;
      rail(c.structure, outerX, lr.z0, outerX, lr.z1, 3.6);
      rail(c.structure, sx < 0 ? lr.x0 : lr.x0 + 1.5, lr.z0, sx < 0 ? lr.x1 - 1.5 : lr.x1, lr.z0, 3.6);
      // 階段の吹抜側パラペット
      const parX = sx < 0 ? strip[0] : strip[1];
      for (let i = 0; i < 20; i++) {
        const z0 = zb - bridgeHalf - 6 + i * 0.3;
        c.structure.push(box([parX - 0.04, 0.18 * (i + 1), z0], [parX + 0.04, 0.18 * (i + 1) + 0.95, z0 + 0.3], 'metal', false));
      }
    }
    const bx0 = cx - naveHalf - 1.0;
    const bx1 = cx + naveHalf + 1.0;
    const br = rect(bx0, zb - bridgeHalf, bx1, zb + bridgeHalf);
    slab(c.structure, br, 3.6, 'metal');
    rail(c.structure, bx0, br.z0, bx1, br.z0, 3.6);
    rail(c.structure, bx0, br.z1, bx1, br.z1, 3.6);
    // 橋の下は 3.4 m 空くので歩ける。橋の直下に背の高い設備を置かないよう予約（高さ 2.5 以上）
    reserve(c, br, 2.5, 3.7);
    // 橋に沿う配管
    c.structure.push(box([bx0, 4.7, zb - 0.5], [bx1, 5.2, zb], 'metal', false));
    c.L.zones.push({ kind: 'theme', aabb: { min: [bx0, 3.4, br.z0], max: [bx1, 6.0, br.z1] }, params: { name: '配管橋', preset: 'bridge' } });
  }
  // 装飾の配管橋（高所。非ソリッド）
  for (let z = main.z0 + 10; z < main.z1 - 6; z += 16) {
    if (Math.abs(z - zb) < 6) continue;
    const y = vr.pick([6.5, 8, 9.5]);
    c.structure.push(box([main.x0 + 1, y, z - 0.5], [main.x1 - 1, y + 0.7, z + 0.5], 'metal', false));
    c.structure.push(box([main.x0 + 1, y + 0.7, z - 0.7], [main.x1 - 1, y + 1.6, z - 0.62], 'metal', false));
  }
  // 側廊の壁沿いの太い配管（装飾）
  for (const sx of [-1, 1]) {
    const x = sx < 0 ? main.x0 + 0.5 : main.x1 - 0.5;
    c.structure.push(box([x - 0.3, 4.0, main.z0 + 0.5], [x + 0.3, 4.6, main.z1 - 0.5], 'metal', false));
    c.structure.push(box([x - 0.2, 5.2, main.z0 + 0.5], [x + 0.2, 5.6, main.z1 - 0.5], 'metal', false));
  }
  // ゾーン: 身廊 / 西側廊 / 東側廊
  themeZone(c, rect(cx - naveHalf, main.z0, cx + naveHalf, main.z1), '身廊', 'nave');
  themeZone(c, rect(main.x0, main.z0, cx - naveHalf, main.z1), '西側廊', 'aisle');
  themeZone(c, rect(cx + naveHalf, main.z0, main.x1, main.z1), '東側廊', 'aisle');
  // 制御室の中身は内装側（furnishNave）で置く
  return { ctrlRooms, naveHalf };
}

function furnishNave(c: MegaCtx, info: NaveInfo): void {
  const { main, vr, L, h } = c;
  const cx = (main.x0 + main.x1) / 2;
  const { naveHalf, ctrlRooms } = info;
  // 制御室のコンソール（暗い台 + 青い発光帯）
  for (const r of ctrlRooms) {
    const wallSide = (r.x0 + r.x1) / 2 < cx ? r.x0 : r.x1 - 0.7;
    const cr = rect(wallSide, r.z0 + 0.6, wallSide + 0.7, r.z1 - 0.6);
    if (blocked(c, cr, 0, 1.2, 0.1)) continue;
    L.boxes.push(box([cr.x0, 0, cr.z0], [cr.x1, 0.9, cr.z1], 'furnitureDark'));
    L.boxes.push(box([cr.x0 + 0.05, 0.9, cr.z0 + 0.1], [cr.x1 - 0.05, 0.93, cr.z1 - 0.1], 'ledBlue', false));
    L.lights.push({ pos: [(r.x0 + r.x1) / 2, 2.6, (r.z0 + r.z1) / 2], color: 0x9fc8ff, intensity: 0.6, distance: 7 });
    L.boxes.push(box([r.x0 + 0.5, 2.9, r.z0 + 0.5], [r.x1 - 0.5, 2.95, r.z1 - 0.5], 'lightPanel', false));
  }
  // 巨大設備（素の寸法。ScaleAnomaly perProp が 3〜8 倍にする）: 身廊中央 4 m は空け、柱列の内外に置く
  const mats: MatId[] = ['metal', 'furnitureDark', 'doorMetal'];
  const n = Math.round(rectArea(main) / 260);
  for (let i = 0, tries = 0; i < n && tries < n * 6; tries++) {
    const inAisle = vr.chance(0.55);
    const sx = vr.chance(0.5) ? -1 : 1;
    const x = inAisle ? cx + sx * vr.float(naveHalf + 2.5, main.x1 - cx - 2.5) : cx + sx * vr.float(3.0, naveHalf - 1.5);
    const z = vr.float(main.z0 + 4, main.z1 - 4);
    const w = vr.float(0.8, 1.6);
    const dd = vr.float(0.8, 1.6);
    const hh = vr.float(0.9, 2.2);
    const r = rect(x - w / 2, z - dd / 2, x + w / 2, z + dd / 2);
    if (r.x0 < main.x0 + 1 || r.x1 > main.x1 - 1) continue;
    if (blocked(c, r, 0, hh, 1.0)) continue;
    if (remaining(c) < 60) break;
    const mat = vr.pick(mats);
    L.boxes.push(box([r.x0, 0, r.z0], [r.x1, hh, r.z1], mat));
    if (vr.chance(0.6)) L.boxes.push(box([r.x0 + w * 0.3, hh, r.z0 + dd * 0.3], [r.x1 - w * 0.3, hh + 0.4, r.z1 - dd * 0.3], 'metal'));
    i++;
  }
  // 側廊の壁沿いの盤・ダクト（低い列）
  furnishRows(c, rect(main.x0, main.z0, cx - naveHalf - 1, main.z1), { spacing: 9, depth: 0.6, height: 1.8, mat: 'furnitureDark', gapEvery: 5, margin: 1.2, axis: 'z' });
  furnishRows(c, rect(cx + naveHalf + 1, main.z0, main.x1, main.z1), { spacing: 9, depth: 0.6, height: 1.8, mat: 'furnitureDark', gapEvery: 5, margin: 1.2, axis: 'z' });
  // 高コントラスト照明: 高所の強いパネルは少数、大半は消灯
  hangingLights(c, [rect(cx - naveHalf, main.z0, cx + naveHalf, main.z1)], h - 1.0, 10, 'lightPanel', 0xe9f0ff, 1.6, vr, 2, 0.55, 1.4);
  hangingLights(c, [rect(main.x0, main.z0, cx - naveHalf, main.z1), rect(cx + naveHalf, main.z0, main.x1, main.z1)], 6.0, 12, 'lightWarm', 0xffc890, 0.7, vr, 4, 0.5, 0.8);
}
