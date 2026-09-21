/** 単室系。矩形 + 翼（L / T 字）の足跡、面積に応じた内装パターン。派生テンプレートはサイズ帯とパターンの差分。
 *  未実装 Generator の代替（fallback）にも使う。 */
import type { Socket } from '../core/types';
import { aabbFromCenter } from '../core/aabb';
import { buildShell, footprintAABB, rect, rectArea, type Rect } from './footprint';
import {
  clearDoorways, dropRemovedHole, furnishGeneric, labelAtEntry, lightGrid, makeEntry, patternColumns, patternIslands, patternPartitions, patternPerimeter, patternRows, placeExits, placeHole, wallBands,
  type FurnishCtx,
} from './common';
import { box, bonusExits, emptyLayout, kinded, snap, WALL_T, type Box, type GenParams, type MatId, type Palette, type RoomLayout } from './layout';
import type { Rng } from '../core/rng';
import type { Dir } from '../core/types';
import type { AABB } from '../core/aabb';
import {
  bench, booths, chair, counter, doorZones, freeRuns, hitsZone, innerFaces, insideRects, lineFace, linkedSeats, lockersAlong, longTable, signAt, signOnWall, sinkRow, tubePair, urinalRow, vending, washer,
  windowGlazing, windowSocket,
  type Face, type WindowOpening,
} from './furniture';

type Family = 'large' | 'medium' | 'small';

const SIZES: Record<Family, [number, number][]> = {
  large: [[28, 34], [24, 28], [20, 22], [16, 18], [13, 14], [10, 11], [8, 9], [6, 7]],
  medium: [[16, 18], [13, 14], [11, 12], [9, 10], [7.5, 8], [6, 6.5], [5, 5.5], [4.5, 5]],
  small: [[9, 10], [7.5, 8], [6.5, 7], [5.5, 6], [5, 5], [4.5, 4.5], [4, 4], [3.5, 4]],
};

function familyOf(tid: string): Family {
  if (tid === 'SmallRoom' || tid === 'Restroom') return 'small';
  if (tid === 'Classroom' || tid === 'LockerRoom' || tid === 'RetailRoom') return 'medium';
  return 'large';
}

export function generateRoom(p: GenParams): RoomLayout {
  const { rng, template } = p;
  const tid = template.id;
  // 更衣室は参考画像どおり「白い壁 + 下部タイル + 緑のロッカー」。presets は共有ファイルなのでここで壁だけ差し替える
  const palette: Palette = tid === 'LockerRoom' ? { ...p.palette, wall: 'wallWhite' } : /食堂|待合室/.test(p.def.category) ? { ...p.palette, floor: 'floorLino' } : p.palette;
  const L = emptyLayout(palette);
  const fam = familyOf(tid);
  const sizes = SIZES[fam];

  // 共有乱数
  const jitter = rng.float(0.92, 1.08);
  const wingSide = rng.pick([1, 3, 0] as const);

  // バリアント: サイズ（大→小）× 入口位置（中央 / 左 / 右）
  const sizeIdx = Math.floor(p.variant / 3) % sizes.length;
  const offIdx = p.variant % 3;
  const vr = rng.fork(`v${p.variant}`);
  const [bw, bd] = sizes[sizeIdx];
  let w = bw * jitter;
  let d = bd * vr.float(0.92, 1.1);
  if (vr.chance(0.5)) [w, d] = [d, w];
  w = Math.round(w * 2) / 2;
  d = Math.round(d * 2) / 2;
  const h = fam === 'small' ? 2.6 : fam === 'medium' ? 3.0 : tid === 'Theater' ? 6.0 : Math.min(5.0, 3.0 + Math.max(0, (w * d - 100) / 250));

  // 足跡: 主矩形 + 翼
  const off = snap([0, -0.5, 0.5][offIdx] * (w / 2 - 1.5));
  const main = p.mainRect ? rect(p.mainRect.x0, p.mainRect.z0, p.mainRect.x1, p.mainRect.z1) : rect(-w / 2 - off, 0, w / 2 - off, d);
  const rects: Rect[] = [main];
  if (!p.mainRect && fam !== 'small' && sizeIdx <= 4 && w > 8 && d > 8 && vr.chance(0.45) && tid !== 'Theater') {
    const wingW = snap(Math.min(12, Math.max(4, w * vr.float(0.35, 0.6))));
    const wingD = snap(Math.min(14, Math.max(4, d * vr.float(0.35, 0.7))));
    const wz = snap(vr.float(0, Math.max(0, d - wingD - 2)));
    if (wingSide === 1) rects.push(rect(main.x1, d - wingD - wz, main.x1 + wingW, d));
    else if (wingSide === 3) rects.push(rect(main.x0 - wingW, d - wingD - wz, main.x0, d));
    else rects.push(rect(main.x0 + snap((w - wingW) / 2), d, main.x0 + snap((w - wingW) / 2) + wingW, d + wingD));
  }
  L.footprint = rects;
  L.height = h;
  L.bounds = footprintAABB(rects, h);
  const area = rects.reduce((a, r) => a + rectArea(r), 0);

  // 入口・出口
  const { entry, ceilingHole } = makeEntry(p, main, 0, h);
  let sockets: Socket[] = [entry, ...p.extraSockets];
  const exits = Math.min(5, Math.max(1, p.exits) + bonusExits(area));
  sockets.push(...placeExits(rects, sockets, vr, { count: exits, minGap: 2.6 }));
  sockets = sockets.filter((s) => !p.removedSockets.includes(s.id));
  // 床穴（判定・配置は専用 fork。holeLocal の有無で主乱数列 vr の消費量が変わり、家具・消灯パターンがずれるのを防ぐ）
  let landing = ceilingHole;
  const hr = vr.fork('hole');
  const wantHole = p.allowHole && area > 60 && hr.chance(0.22);
  if (p.holeLocal || wantHole) {
    const hole = placeHole(rects, sockets, hr, p.holeLocal);
    if (hole) {
      L.holes.push(hole.hole);
      sockets.push(hole.socket);
    }
  }
  L.sockets = sockets;
  dropRemovedHole(L, p);
  sockets = L.sockets;

  // 窓（食堂）: シェルの壁を実際に抜く。擬似ソケットは buildShell にだけ渡す（L.sockets には入れない）
  const kind = refKind(tid, p);
  const windows: WindowOpening[] = kind === 'cafeteria' ? cafeteriaWindows(rects, sockets, h) : [];
  buildShell(L.boxes, rects, h, [...sockets, ...windows.map((o, i) => windowSocket(o, `win${i}`))], {
    floor: palette.floor, wall: palette.wall, ceiling: palette.ceiling, floorHoles: L.holes, ceilingHoles: ceilingHole ? [ceilingHole] : [],
  });
  if (ceilingHole) {
    // 着地点（家具を置かない範囲）。床に目印の箔は置かない（床材が変わったように見えるため）
    const c = ceilingHole;
    landing = aabbFromCenter((c.min[0] + c.max[0]) / 2, 0, (c.min[2] + c.max[2]) / 2, 1.2, 1, 1.2);
  }

  // 内装（扉前は最後に空ける）
  const shellCount = L.boxes.length;
  L.shellCount = shellCount;
  const ctx: FurnishCtx = { L, rects, h, rng: vr, keep: sockets, landing };
  const lit = furnish(ctx, tid, area, w, d, p, kind, windows);
  clearDoorways(L, sockets, shellCount);

  // 照明（テンプレート固有の器具列を置いた場合はグリッドを使わない）
  const dim = /一部消灯|低照度|暗/.test(p.def.lightingPreset) ? 0.35 : 0.04;
  if (!lit) lightGrid(L, rects, h, fam === 'small' ? 3 : 4.5, dim, vr, palette.light, palette.lightColor, palette.lightIntensity, area > 200 ? 4 : 3);

  labelAtEntry(L, entry, 2.4, p.label);
  return L;
}

/** 参考画像に対応する部屋の種類（rooms.json の name / category / template から判定） */
function refKind(tid: string, p: GenParams): 'cafeteria' | 'waiting' | 'breakroom' | 'laundry' | 'locker' | 'restroom' | null {
  if (/食堂/.test(p.def.category)) return 'cafeteria';
  if (/待合室/.test(p.def.category)) return 'waiting';
  if (tid === 'SmallRoom' && /休憩室/.test(p.def.name)) return 'breakroom';
  if (tid === 'RetailRoom' && /ランドリー/.test(p.def.name)) return 'laundry';
  if (tid === 'LockerRoom') return 'locker';
  if (tid === 'Restroom') return 'restroom';
  return null;
}

/** 食堂の窓帯: 入口の反対の長辺（面 dir 0、横長なら dir 1）の空き区間に 1.0〜2.4 m の開口。シェルの前に決める（壁を抜くため） */
function cafeteriaWindows(rects: Rect[], sockets: Socket[], h: number): WindowOpening[] {
  const r = rects[0];
  const alongX = r.x1 - r.x0 >= r.z1 - r.z0;
  const onMain = (f: Face) => (f.horizontal ? Math.abs(f.coord - r.z0) < 0.01 || Math.abs(f.coord - r.z1) < 0.01 : Math.abs(f.coord - r.x0) < 0.01 || Math.abs(f.coord - r.x1) < 0.01);
  const cands = innerFaces(rects).filter((f) => onMain(f) && f.horizontal === alongX && f.dir !== 2).sort((a, b) => (b.a1 - b.a0) - (a.a1 - a.a0));
  const face = cands.find((f) => f.dir === (alongX ? 0 : 1)) ?? cands[0];
  if (!face) return [];
  const y0 = 1.0, y1 = Math.min(h - 0.5, 2.4);
  const out: WindowOpening[] = [];
  for (const [a0, a1] of freeRuns(face, sockets, 0.7)) {
    if (a1 - a0 - 0.8 >= 0.8) out.push({ face, a0: a0 + 0.4, a1: a1 - 0.4, y0, y1 });
  }
  return out;
}

/** 内装。戻り値 true = 照明もここで置いた（lightGrid を使わない） */
function furnish(c: FurnishCtx, tid: string, area: number, w: number, d: number, p: GenParams, kind: ReturnType<typeof refKind>, windows: WindowOpening[]): boolean {
  const B = c.L.boxes;
  const r = c.rects[0];
  // 参考画像のテンプレート: 専用 fork（'ref'）で配置し、主乱数列 vr は消費しない
  if (kind) {
    const rr = c.rng.fork('ref');
    const R: RefCtx = { c, rr, B, faces: innerFaces(c.rects), zones: doorZones(c.keep, c.landing), sockets: c.keep, windows };
    switch (kind) {
      case 'cafeteria': furnishCafeteria(R); return false;
      case 'waiting': furnishWaiting(R); return false;
      case 'breakroom': furnishBreakroom(R); return false;
      case 'laundry': furnishLaundry(R); return false;
      case 'locker': return furnishLocker(R, p);
      case 'restroom': furnishRestroom(R); return false;
    }
  }
  switch (tid) {
    case 'Classroom':
      patternRows(c, { spacing: 1.7, depth: 0.5, height: 0.72, mat: 'furnitureLight', gapEvery: 4.5, margin: 1.6, kind: 'desk' });
      B.push(box([r.x0 + 1, 0.9, r.z1 - 0.2], [r.x1 - 1, 2.1, r.z1 - 0.17], 'wallGreen', false));
      break;
    case 'OfficeGrid':
      if (area > 150) patternColumns(c, 8);
      patternRows(c, { spacing: 3.4, depth: 1.5, height: 0.75, mat: 'furnitureLight', gapEvery: 6, top: 'furnitureDark', kind: 'desk' });
      if (area > 200 && c.rng.chance(0.5)) patternPartitions(c, 1, 1.4, 'wallWhite');
      break;
    case 'Theater': {
      const ir = { x0: r.x0 + 1.5, z0: r.z0 + 3, x1: r.x1 - 1.5, z1: r.z1 - 3 };
      // 座席列。幅 12 m 以上は中央通路 1.4 m で 2 ブロックに分ける
      const seatSpans: [number, number][] = ir.x1 - ir.x0 >= 12 ? [[ir.x0, (ir.x0 + ir.x1) / 2 - 0.7], [(ir.x0 + ir.x1) / 2 + 0.7, ir.x1]] : [[ir.x0, ir.x1]];
      // スクリーンは入口の反対側（北壁 z1）。後列（入口側）ほど高い
      for (let z = ir.z0; z < ir.z1; z += 1.1) {
        // 後列（入口側）ほど高い段床。入口は床レベルなので最大 0.9 m（3 段）に抑え、入口から座席列越しにスクリーンが見えるようにする
        const rise = Math.floor((((ir.z1 - z) / (ir.z1 - ir.z0)) * 1.0) / 0.3) * 0.3;
        for (const [sx0, sx1] of seatSpans) {
          // 段床（ライザー）: 列ごとに床から rise までを埋める（座席が宙に浮かない。床材はカーペット）。段差 0.3 m の階段状
          if (rise > 0.01) B.push(box([sx0, 0, z], [sx1, rise, Math.min(z + 1.1, ir.z1)], c.L.palette.floor));
          B.push(box([sx0, rise, z], [sx1, rise + 0.3, z + 0.5], 'furnitureDark'));
          B.push(box([sx0, rise + 0.3, z + 0.3], [sx1, rise + 0.9, z + 0.5], 'furnitureDark'));
        }
        // 側通路の階段: 段床の高さが変わる列で、側通路（両側 1.5 m）に 0.15 m × 2 段の踏み段を置く（段床の 0.3 m を歩いて登れる）。
        // 段床と同じ高さの踏み面が通路側へ続くので、通路は段床に合わせて階段状になる
        const prevRise = Math.floor((((ir.z1 - (z + 1.1)) / (ir.z1 - ir.z0)) * 1.0) / 0.3) * 0.3;
        if (rise > 0.01) {
          for (const [ax0, ax1] of [[r.x0 + WALL_T, ir.x0], [ir.x1, r.x1 - WALL_T]] as [number, number][]) {
            const zEnd = Math.min(z + 1.1, ir.z1);
            // 列の奥（スクリーン側）0.35 m は 1 段低い踏み段、残りは段床と同じ高さ
            if (rise - prevRise > 0.01) {
              B.push(box([ax0, 0, zEnd - 0.35], [ax1, rise - 0.15, zEnd], c.L.palette.floor));
              B.push(box([ax0, 0, z], [ax1, rise, zEnd - 0.35], c.L.palette.floor));
            } else {
              B.push(box([ax0, 0, z], [ax1, rise, zEnd], c.L.palette.floor));
            }
          }
        }
      }
      // スクリーンは 16:9（PastWindow の 256×144 RT と同じ比率。全幅だと映像が横に伸びる）。幅は室内幅 − 2 と 16 m の小さい方、高さは天井 − 1.5 m まで。
      // 周りは暗幕（furnitureDark の箔）で全幅を覆う
      let sw = Math.min((r.x1 - r.x0) - 2, 16);
      let sh = (sw * 9) / 16;
      if (sh > c.h - 1.5) { sh = c.h - 1.5; sw = (sh * 16) / 9; }
      const scx = (r.x0 + r.x1) / 2;
      // 北壁の開口（出口・直結ソケット）を避けて暗幕とスクリーンを分割する（扉を箔で塞がない）
      const openings = c.keep
        .filter((s) => s.type !== 'hole' && Math.abs(s.pos[2] - r.z1) < 0.3)
        .map((s) => [s.pos[0] - s.width / 2 - 0.3, s.pos[0] + s.width / 2 + 0.3] as [number, number]);
      const cut = (x0: number, x1: number): [number, number][] => {
        let segs: [number, number][] = [[x0, x1]];
        for (const [a, b] of openings) {
          segs = segs.flatMap(([s0, s1]) => (b <= s0 || a >= s1 ? [[s0, s1]] : [[s0, Math.min(s1, a)], [Math.max(s0, b), s1]]) as [number, number][]);
          segs = segs.filter(([s0, s1]) => s1 - s0 > 0.2);
        }
        return segs;
      };
      for (const [s0, s1] of cut(r.x0 + 0.5, r.x1 - 0.5)) B.push(box([s0, 0.3, r.z1 - 0.3], [s1, c.h - 0.5, r.z1 - 0.25], 'furnitureDark', false));
      // スクリーンは開口と重なる場合、最も広い区間に収める（幅 3 m 未満なら置かない）
      const screenSeg = cut(scx - sw / 2, scx + sw / 2).sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0];
      if (screenSeg && screenSeg[1] - screenSeg[0] >= 3) {
        const w2 = screenSeg[1] - screenSeg[0];
        const h2 = Math.min(sh, (w2 * 9) / 16);
        B.push(box([screenSeg[0], 1.0, r.z1 - 0.36], [screenSeg[1], 1.0 + h2, r.z1 - 0.3], 'wallWhite', false));
      }
      break;
    }
    case 'Gallery':
      patternPartitions(c, area > 250 ? 3 : 2, 2.4, 'wallWhite');
      patternIslands(c, 1 / 60, ['furnitureLight']);
      break;
    case 'RetailRoom':
      patternRows(c, { spacing: 2.4, depth: 0.9, height: 1.5, mat: 'shelfMetal', gapEvery: 5, margin: 1.6, kind: 'shelf' });
      B.push(kinded([r.x1 - 2.2, 0, r.z0 + 1.4], [r.x1 - 0.5, 1.0, r.z0 + 2.2], 'furnitureDark', 'cabinet'));
      break;
    case 'PlayArea':
      patternIslands(c, 1 / 22, ['furnitureLight', 'yellowLine', 'furnitureDark']);
      break;
    case 'OrganicZone':
      patternIslands(c, 1 / 18, ['plant'], 'plant');
      if (area > 150) patternPartitions(c, 2, 1.6, 'plant');
      break;
    case 'SmallRoom':
      if (/自販機/.test(p.def.category)) {
        B.push(kinded([r.x1 - 1.1, 0, r.z0 + 1.0], [r.x1 - 0.2, 1.9, r.z0 + 2.0], 'furnitureDark', 'vending'));
        B.push(box([r.x1 - 1.12, 0.5, r.z0 + 1.1], [r.x1 - 1.1, 1.7, r.z0 + 1.9], 'lightPanel', false));
      } else if (c.rng.chance(0.7)) {
        patternIslands(c, 1 / 14);
      }
      break;
    case 'GenericRoom':
      furnishGeneric(c, area, 'plain');
      break;
    default:
      furnishGeneric(c, area, c.rng.pick(['plain', 'office', 'retail', 'soft']));
      if (p.def.layoutHints.includes('denseOcclusion')) patternPartitions(c, 2, 1.8, 'furnitureDark');
      if (p.def.layoutHints.includes('landmark')) {
        const cx = (r.x0 + r.x1) / 2;
        const cz = (r.z0 + r.z1) / 2;
        B.push(box([cx - 1.2, 0, cz - 1.2], [cx + 1.2, Math.min(c.h - 0.5, 3.0), cz + 1.2], 'furnitureLight'));
      }
      break;
  }
  void w;
  void d;
  patternPerimeterMaybe(c, tid);
  return false;
}

function patternPerimeterMaybe(c: FurnishCtx, tid: string): void {
  if (tid === 'RetailRoom' && c.rng.chance(0.6)) patternPerimeter(c, 0.5, 1.8, 'shelfMetal', 0.5, 'shelf');
}


// ---------------------------------------------------------------- 参考画像テンプレート（docs/reference-common-analysis.md 表の 9〜11・14〜16）

interface RefCtx {
  c: FurnishCtx;
  rr: Rng;
  B: Box[];
  faces: Face[];
  zones: AABB[];
  sockets: FurnishCtx['keep'];
  /** シェルで抜いた窓の開口（食堂）。ガラス・夜景・枠はここで埋める */
  windows: WindowOpening[];
}

/** 主矩形の長軸が x か */
function longAxisX(R: RefCtx): boolean {
  const r = R.c.rects[0];
  return r.x1 - r.x0 >= r.z1 - r.z0;
}

/** 主矩形の面のうち、条件に合う面を長い順に */
function facesOf(R: RefCtx, pred: (f: Face) => boolean): Face[] {
  const r = R.c.rects[0];
  return R.faces
    .filter((f) => pred(f) && (f.horizontal ? Math.abs(f.coord - r.z0) < 0.01 || Math.abs(f.coord - r.z1) < 0.01 : Math.abs(f.coord - r.x0) < 0.01 || Math.abs(f.coord - r.x1) < 0.01))
    .sort((a, b) => (b.a1 - b.a0) - (a.a1 - a.a0));
}

/** 箱の集合を、どれも禁止領域・足跡外に掛からなければ追加する */
function placeUnit(R: RefCtx, build: (B: Box[]) => void, margin = WALL_T_MARGIN): boolean {
  const tmp: Box[] = [];
  build(tmp);
  for (const b of tmp) {
    if (!b.solid) continue;
    if (hitsZone(R.zones, b) || !insideRects(R.c.rects, b, margin)) return false;
    // 既存のソリッド内装と重ならない
    for (let i = R.c.L.shellCount ?? 0; i < R.B.length; i++) {
      const o = R.B[i];
      if (o.solid && o.min[0] < b.max[0] && o.max[0] > b.min[0] && o.min[1] < b.max[1] && o.max[1] > b.min[1] && o.min[2] < b.max[2] && o.max[2] > b.min[2]) return false;
    }
  }
  R.B.push(...tmp);
  return true;
}
const WALL_T_MARGIN = 0.14;

/** 社員食堂（C09）: 長机 + 椰子・書類などの小物は無し。列間 2.7 m（椅子込み 1.75 + 通路 0.95）、机間 0.9 m（独立した 4 人掛けに見える）、両側に椅子。
 *  壁沿いに自販機・返却台、長辺に窓帯（シェルで抜いた開口 + 夜景）、標語サイン */
function furnishCafeteria(R: RefCtx): void {
  const { c, B, rr } = R;
  const r = c.rects[0];
  const alongX = longAxisX(R);
  const m = 2.1;
  const ir = { x0: r.x0 + m, z0: r.z0 + m, x1: r.x1 - m, z1: r.z1 - m };
  const shortLen = alongX ? ir.z1 - ir.z0 : ir.x1 - ir.x0;
  const longLen = alongX ? ir.x1 - ir.x0 : ir.z1 - ir.z0;
  const rowPitch = 2.7;
  const rows = Math.max(1, Math.floor((shortLen - 1.75) / rowPitch) + 1);
  const rowStart = (alongX ? ir.z0 : ir.x0) + (shortLen - (rows - 1) * rowPitch) / 2;
  const gap = 0.9; // 机間（0.3 では連結カウンターに見えた）
  const unit = 1.8 + gap;
  const per = Math.max(1, Math.floor((longLen + gap) / unit));
  const colStart = (alongX ? ir.x0 : ir.z0) + (longLen - per * unit + gap) / 2 + 0.9;
  const mid = (alongX ? ir.x0 + ir.x1 : ir.z0 + ir.z1) / 2;
  const crossAisle = longLen > 11;
  for (let i = 0; i < rows; i++) {
    const a = rowStart + i * rowPitch;
    for (let j = 0; j < per; j++) {
      const l = colStart + j * unit;
      if (crossAisle && Math.abs(l - mid) < 1.4) continue;
      const cx = alongX ? l : a;
      const cz = alongX ? a : l;
      const ok = placeUnit(R, (T) => longTable(T, cx, cz, alongX));
      if (!ok) continue;
      for (const side of [-1, 1]) {
        for (const k of [-0.45, 0.45]) {
          if (rr.chance(0.08)) continue; // 抜けた席（引かれた椅子は作らない）
          const off = 0.375 + 0.05 + 0.225;
          const px = alongX ? cx + k : cx + side * off;
          const pz = alongX ? cz + side * off : cz + k;
          const facing: Dir = alongX ? (side > 0 ? 2 : 0) : (side > 0 ? 3 : 1);
          placeUnit(R, (T) => chair(T, px, pz, facing));
        }
      }
    }
  }
  // 短辺の壁: 自販機 2〜3 台（最長の空き区間）と返却台（反対の短辺）
  const shortFaces = facesOf(R, (f) => f.horizontal !== alongX);
  const vendFace = shortFaces[0];
  let signFace: Face | null = null;
  if (vendFace) {
    const runs = freeRuns(vendFace, R.sockets, 1.0).sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]));
    if (runs[0] && runs[0][1] - runs[0][0] >= 2.0) {
      const [a0, a1] = runs[0];
      const n = Math.min(3, Math.floor((a1 - a0 - 0.4) / 1.0));
      const start = (a0 + a1) / 2 - (n * 1.0 - 0.1) / 2;
      let placedAny = false;
      for (let k = 0; k < n; k++) placedAny = placeUnit(R, (T) => vending(T, vendFace, start + k * 1.0, k === 1 ? 'lightWarm' : 'lightPanel')) || placedAny;
      if (placedAny) {
        signFace = vendFace;
        signAt(c.L, vendFace, (a0 + a1) / 2, Math.min(c.h - 0.45, 2.35), 2.4, '食でつながる、今日もいい一日を。');
      }
    }
  }
  const counterFace = shortFaces.find((f) => f !== vendFace) ?? null;
  if (counterFace) {
    const runs = freeRuns(counterFace, R.sockets, 1.0).sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]));
    if (runs[0] && runs[0][1] - runs[0][0] >= 2.0) {
      const len = Math.min(3.6, runs[0][1] - runs[0][0] - 0.4);
      const at = (runs[0][0] + runs[0][1]) / 2 - len / 2;
      if (placeUnit(R, (T) => counter(T, counterFace, at, len, 0.6, 0.9, 'shelfMetal', 'metal'))) {
        // 返却口: カウンター上の壁に暗い開口（厨房側）と食器の棚板
        B.push(alongFaceMat(counterFace, at + 0.2, len - 0.4, 0.0, 0.012, 0.95, 1.75, 'void', false));
        B.push(alongFaceMat(counterFace, at + 0.2, len - 0.4, 0.0, 0.5, 0.93, 0.95, 'metal', false));
      }
    }
  }
  // 長辺（入口の反対側）の窓: 開口はシェルで抜いてある（cafeteriaWindows）。ガラス・夜景・枠を埋める
  for (const o of R.windows) windowGlazing(B, o);
  if (!signFace) signOnWall(c.L, R.faces, R.sockets, '食でつながる、今日もいい一日を。', { y: Math.min(c.h - 0.45, 2.3), width: 2.4, prefer: [1, 3, 2] });
}

/** 市役所待合室（C10 / U06）: 連結椅子（青）を 3〜4 列、奥に受付カウンター + 番号表示器、側壁に標語 */
function furnishWaiting(R: RefCtx): void {
  const { c } = R;
  const r = c.rects[0];
  // カウンターは北辺（入口の反対）
  const north = facesOf(R, (f) => f.dir === 0)[0];
  let counterDepth = 0;
  if (north) {
    const runs = freeRuns(north, R.sockets, 1.0).sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]));
    if (runs[0] && runs[0][1] - runs[0][0] >= 2.4) {
      const len = Math.min(7.2, runs[0][1] - runs[0][0] - 0.6);
      const at = (runs[0][0] + runs[0][1]) / 2 - len / 2;
      if (placeUnit(R, (T) => counter(T, north, at, len, 0.75, 1.05, 'furnitureLight', 'furnitureDark'))) {
        counterDepth = 0.8;
        // 窓口のガラス衝立（窓口ごと）と番号表示器（赤い数字の発光板）
        const n = Math.max(1, Math.floor(len / 1.8));
        for (let k = 0; k < n; k++) {
          const a = at + (len / n) * k + 0.15;
          R.B.push(alongFaceMat(north, a, len / n - 0.3, 0.05, 0.07, 1.05, 1.95, 'glass', false));
        }
        signAt(c.L, north, at + len / 2, Math.min(c.h - 0.4, 2.35), 0.9, '128', { kind: 'emissive', color: 0xff5a40, background: 0x121212, id: 'waitNumber' });
      }
    }
  }
  // 椅子列: 北（窓口）を向く。列は x 方向、ピッチ 1.6 m。窓口側から詰めて並べ、入口側を空ける（大部屋では最大 10 列）
  const m = 1.6;
  const x0 = r.x0 + m, x1 = r.x1 - m;
  const z0 = r.z0 + m + 1.2, z1 = r.z1 - m - counterDepth - 1.6;
  const pitch = 1.6;
  const rows = Math.min(10, Math.max(1, Math.floor((z1 - z0) / pitch) + 1));
  const benchLen = 2.0; // 4 席
  const groups = Math.max(1, Math.floor((x1 - x0 + 0.7) / (benchLen + 0.7)));
  const gx0 = (x0 + x1) / 2 - (groups * (benchLen + 0.7) - 0.7) / 2 + benchLen / 2;
  const zStart = z1 - (rows - 1) * pitch;
  for (let i = 0; i < rows; i++) {
    for (let g = 0; g < groups; g++) {
      // 中央に 1.4 m の通路（グループ数が偶数なら中央の切れ目がそのまま通路）
      const cx = gx0 + g * (benchLen + 0.7);
      const cz = zStart + i * pitch;
      placeUnit(R, (T) => linkedSeats(T, cx, cz, 4, 0));
    }
  }
  signOnWall(c.L, R.faces, R.sockets, 'くらしを支えるまちの窓口', { y: Math.min(c.h - 0.45, 2.2), width: 2.2, prefer: [1, 3] });
}

/** オフィス休憩室（C14）: 流し台カウンター + 冷蔵庫、角机 + 青椅子 4 脚、標語。小物は置かない */
function furnishBreakroom(R: RefCtx): void {
  const { c } = R;
  const r = c.rects[0];
  const side = facesOf(R, (f) => !f.horizontal)[0];
  if (side) {
    const runs = freeRuns(side, R.sockets, 1.0).sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]));
    if (runs[0] && runs[0][1] - runs[0][0] >= 1.8) {
      const [a0, a1] = runs[0];
      const len = Math.min(2.4, a1 - a0 - 0.9);
      const at = a0 + 0.1;
      if (placeUnit(R, (T) => counter(T, side, at, len, 0.6, 0.85, 'furnitureLight', 'metal'))) {
        // 流し（天板の凹み相当の暗い矩形）と上の吊り戸棚
        R.B.push(alongFaceMat(side, at + len - 0.85, 0.6, 0.12, 0.5, 0.85, 0.86, 'metalDark', false));
        R.B.push(alongFaceMat(side, at, len, 0.0, 0.35, 1.5, 2.2, 'furnitureLight', false));
      }
      // 冷蔵庫 0.7 × 0.7 × 1.8（白）
      placeUnit(R, (T) => {
        // 白い筐体。shelfMetal の背の高いスラブは描画側で「棚」に置き換わるので doorMetal を使う
        T.push(alongFaceMat(side, at + len + 0.1, 0.7, 0.03, 0.73, 0, 1.8, 'doorMetal', true));
        T.push(alongFaceMat(side, at + len + 0.1, 0.7, 0.73, 0.735, 0.68, 0.7, 'metalDark', false));
        T.push(alongFaceMat(side, at + len + 0.1 + 0.6, 0.03, 0.73, 0.75, 0.75, 1.6, 'metalDark', false));
      });
    }
  }
  // 角机 0.9 × 0.9 + 椅子 4 脚（中央）
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2 + 0.3;
  if (placeUnit(R, (T) => {
    T.push(box([cx - 0.45, 0.69, cz - 0.45], [cx + 0.45, 0.72, cz + 0.45], 'furnitureLight'));
    T.push(box([cx - 0.04, 0, cz - 0.04], [cx + 0.04, 0.69, cz + 0.04], 'metalDark'));
    T.push(box([cx - 0.3, 0, cz - 0.3], [cx + 0.3, 0.03, cz + 0.3], 'metalDark', false));
  })) {
    placeUnit(R, (T) => chair(T, cx, cz - 0.75, 0));
    placeUnit(R, (T) => chair(T, cx, cz + 0.75, 2));
    placeUnit(R, (T) => chair(T, cx - 0.75, cz, 1));
    placeUnit(R, (T) => chair(T, cx + 0.75, cz, 3));
  }
  signOnWall(c.L, R.faces, R.sockets, '整理整頓', { y: Math.min(c.h - 0.4, 1.9), width: 1.0, prefer: [0, 1, 3] });
}

function alongFaceMat(f: Face, at: number, len: number, d0: number, d1: number, y0: number, y1: number, mat: MatId, solid: boolean): Box {
  const n0 = f.face + f.inward * d0, n1 = f.face + f.inward * d1;
  return f.horizontal
    ? box([at, y0, Math.min(n0, n1)], [at + len, y1, Math.max(n0, n1)], mat, solid)
    : box([Math.min(n0, n1), y0, at], [Math.max(n0, n1), y1, at + len], mat, solid);
}

/** コインランドリー（C15）: 両側の長辺に洗濯機 / 乾燥機（2 段）の列、中央に折り畳み台、案内サイン */
function furnishLaundry(R: RefCtx): void {
  const { c, B } = R;
  const r = c.rects[0];
  // 列は入口（南辺）から奥へ向ける（更衣室と同じ）。横長のときだけ x 方向
  const alongX = (r.x1 - r.x0) > (r.z1 - r.z0) * 1.4;
  const longFaces = facesOf(R, (f) => f.horizontal === alongX);
  longFaces.forEach((f, idx) => {
    for (const [a0, a1] of freeRuns(f, R.sockets, 1.0)) {
      const n = Math.floor((a1 - a0 - 0.2) / 0.62);
      if (n <= 0) continue;
      const start = (a0 + a1) / 2 - (n * 0.62 - 0.02) / 2;
      for (let k = 0; k < n; k++) placeUnit(R, (T) => washer(T, f, start + k * 0.62, idx === 1 || k % 3 === 2));
    }
  });
  // 広い部屋: 背中合わせの洗濯機の島（奥行 0.66 × 2）を通路 3.2 m 以上で並べ、通路の中央に折り畳み台を置く
  const shortLen = alongX ? r.z1 - r.z0 : r.x1 - r.x0;
  const inS0 = (alongX ? r.z0 : r.x0) + WALL_T + 0.66, inS1 = (alongX ? r.z1 : r.x1) - WALL_T - 0.66;
  const aisleMin = 3.2, islandD = 1.32;
  const islands = Math.max(0, Math.floor((inS1 - inS0 - aisleMin) / (islandD + aisleMin)));
  const aisleW = (inS1 - inS0 - islands * islandD) / (islands + 1);
  // 島の入口側は 4.0 m 空ける（入口正面に島の妻面が来ても距離を保つ。店の前室の感じ）
  const l0 = (alongX ? r.x0 : r.z0) + WALL_T + (alongX ? 2.0 : 4.0), l1 = (alongX ? r.x1 : r.z1) - WALL_T - 2.0;
  const aisleCenters: number[] = [];
  for (let i = 0; i < islands; i++) {
    const center = inS0 + aisleW * (i + 1) + islandD * i + islandD / 2;
    for (const inward of [1, -1] as const) {
      const f = lineFace(alongX, center, inward, l0, l1);
      const n = Math.floor((l1 - l0 - 0.2) / 0.62);
      const start = (l0 + l1) / 2 - (n * 0.62 - 0.02) / 2;
      for (let k = 0; k < n; k++) placeUnit(R, (T) => washer(T, f, start + k * 0.62, k % 4 === 1));
    }
  }
  for (let i = 0; i <= islands; i++) aisleCenters.push(inS0 + aisleW * i + islandD * i + aisleW / 2);
  if (shortLen - 0.3 >= 0.66 * 2 + 1.2 * 2 + 0.8) {
    const longLen = l1 - l0;
    const n = Math.max(1, Math.floor((longLen + 0.6) / 2.6));
    const start = (l0 + l1) / 2 - (n * 2.6 - 0.6) / 2 + 1.0;
    for (const a of aisleCenters) {
      for (let k = 0; k < n; k++) {
        const l = start + k * 2.6;
        placeUnit(R, (T) => longTable(T, alongX ? l : a, alongX ? a : l, alongX, 2.0, 0.8, 0.78));
      }
    }
  }
  void B;
  signOnWall(c.L, R.faces, R.sockets, 'COIN LAUNDRY 24h', { y: Math.min(c.h - 0.4, 2.3), width: 1.6, prefer: [0, 1, 3] });
}

/** 体育館更衣室（C11 / U13）: 両側の壁に緑のロッカー列、広い部屋は背中合わせのロッカー島、通路中央に木のベンチ、腰壁タイル 1.2 m、露出蛍光管ペアの列 */
function furnishLocker(R: RefCtx, p: GenParams): boolean {
  const { c, B, rr } = R;
  const L = c.L;
  const r = c.rects[0];
  // 島と通路は入口（南辺）から奥へ向ける（入口から通路を見通す）。幅が奥行きの 1.4 倍を超える横長のときだけ x 方向
  const alongX = (r.x1 - r.x0) > (r.z1 - r.z0) * 1.4;
  // タイル腰壁 + 見切り（ロッカーはこの帯の手前 0.02 から立てる）
  wallBands(L, c.rects, R.sockets, [{ y0: 0, y1: 1.2, mat: 'floorTile', depth: 0.02 }, { y0: 1.2, y1: 1.24, mat: 'trim', depth: 0.03 }]);
  // 長軸に平行な壁の面にロッカー（翼の面も含む）
  for (const f of R.faces.filter((f) => f.horizontal === alongX)) {
    for (const [a0, a1] of freeRuns(f, R.sockets, 1.0)) lockersAlong(B, f, a0 + 0.1, a1 - 0.1, R.zones, c.rects, 0.02);
  }
  // 島（背中合わせ）: 短辺方向の内法から壁ロッカー 0.52 × 2 を引き、通路 2.8 以上を保って何列置けるか
  const inS0 = (alongX ? r.z0 : r.x0) + WALL_T + 0.52;
  const inS1 = (alongX ? r.z1 : r.x1) - WALL_T - 0.52;
  const avail = inS1 - inS0;
  const aisleMin = 2.8;
  const islands = Math.max(0, Math.floor((avail - aisleMin) / (1.0 + aisleMin)));
  const aisleW = (avail - islands * 1.0) / (islands + 1);
  // 島の端: 入口（南辺 z0）側は 3.2 m 空けて入口正面に島の妻面が来ないようにする。他端は 1.8 m
  const l0 = (alongX ? r.x0 : r.z0) + WALL_T + (alongX ? 1.8 : 3.2);
  const l1 = (alongX ? r.x1 : r.z1) - WALL_T - 1.8;
  const aisleCenters: number[] = [];
  for (let i = 0; i < islands; i++) {
    const center = inS0 + aisleW * (i + 1) + 1.0 * i + 0.5;
    for (const inward of [1, -1] as const) {
      const f = lineFace(alongX, center, inward, l0, l1);
      lockersAlong(B, f, l0, l1, R.zones, c.rects, 0);
    }
  }
  for (let i = 0; i <= islands; i++) aisleCenters.push(inS0 + aisleW * i + 1.0 * i + aisleW / 2);
  // ベンチ（通路中央。1.8 m の節、端 1.5 m は空ける）
  for (const a of aisleCenters) {
    const b0 = l0 + 0.3, b1 = l1 - 0.3;
    const seg = 1.8, gap = 0.4;
    const n = Math.max(0, Math.floor((b1 - b0 + gap) / (seg + gap)));
    const start = (b0 + b1) / 2 - (n * (seg + gap) - gap) / 2 + seg / 2;
    for (let k = 0; k < n; k++) {
      const l = start + k * (seg + gap);
      placeUnit(R, (T) => bench(T, alongX, alongX ? l : a, alongX ? a : l, seg));
    }
  }
  // 露出蛍光管ペア: 各通路の中心線に 3.0 m ピッチ
  const dim = /一部消灯|低照度|暗/.test(p.def.lightingPreset) ? 0.35 : 0.06;
  let i = 0;
  for (const a of aisleCenters) {
    const s0 = (alongX ? r.x0 : r.z0) + 1.5, s1 = (alongX ? r.x1 : r.z1) - 1.5;
    const n = Math.max(1, Math.round((s1 - s0) / 3.0));
    for (let k = 0; k < n; k++) {
      const l = s0 + ((s1 - s0) * (k + 0.5)) / n;
      const x = alongX ? l : a, z = alongX ? a : l;
      const off = rr.chance(dim);
      tubePair(B, x, z, alongX, c.h, off ? 'lightOff' : p.palette.light);
      if (!off && i % 2 === 0) L.lights.push({ pos: [x, c.h - 0.4, z], color: p.palette.lightColor, intensity: p.palette.lightIntensity, distance: 7.5 });
      i++;
    }
  }
  signOnWall(L, R.faces, R.sockets, '清潔にご利用ください', { y: Math.min(c.h - 0.4, 2.3), width: 1.4, prefer: alongX ? [1, 3, 0] : [0, 2, 1] });
  return true;
}

/** 公衆トイレ（C16 / U09）: 奥の壁に個室ブース列（ベージュ扉、床から 15 cm 浮く）、側壁に洗面器の列 + 鏡、注意書き */
function furnishRestroom(R: RefCtx): void {
  const { c, B } = R;
  const r = c.rects[0];
  // ブースは入口から見て奥（北）の面。無理なら最長の側面
  const cands = [...facesOf(R, (f) => f.dir === 0), ...facesOf(R, (f) => !f.horizontal)];
  let boothFace: Face | null = null;
  outer: for (const f of cands) {
    const runs = freeRuns(f, R.sockets, 1.0).sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]));
    if (!runs[0] || runs[0][1] - runs[0][0] < 1.9) continue;
    const [a0, a1] = runs[0];
    // 室数を減らしながら、中央 → 奥端（入口から遠い側）→ 手前端 の順に試す（扉前の領域に掛かる分だけ諦める）
    for (let n = Math.floor((a1 - a0 - 0.1) / 0.9); n >= 2; n--) {
      for (const start of [(a0 + a1) / 2 - (n * 0.9) / 2, a1 - 0.05 - n * 0.9, a0 + 0.05]) {
        if (placeUnit(R, (T) => booths(T, f, start, n))) { boothFace = f; break outer; }
      }
    }
  }
  // 洗面器はブースと直交する側面（ブースの前 1.2 m は空ける）
  const sinkFaces = facesOf(R, (f) => f !== boothFace && (boothFace ? f.horizontal !== boothFace.horizontal : !f.horizontal));
  let sinkFace: Face | null = null;
  for (const f of sinkFaces) {
    let done = false;
    for (const [a0, a1] of freeRuns(f, R.sockets, 1.0)) {
      for (let n = Math.min(6, Math.floor((a1 - a0 - 0.2) / 0.75)); n >= 1 && !done; n--) {
        for (const start of [(a0 + a1) / 2 - (n * 0.75) / 2, a1 - 0.1 - n * 0.75, a0 + 0.1]) {
          if (placeUnit(R, (T) => sinkRow(T, f, start, n))) { done = true; sinkFace = f; break; }
        }
      }
      if (done) break;
    }
    if (done) break;
  }
  // 小便器 3〜4 台: ブース・洗面器と別の面（洗面器の向かい側を優先）。置けなければ 3 台まで減らす
  const urinalFaces = facesOf(R, (f) => f !== boothFace && f !== sinkFace).sort((a, b) => Number(!!sinkFace && b.horizontal === sinkFace.horizontal) - Number(!!sinkFace && a.horizontal === sinkFace.horizontal));
  outerU: for (const f of urinalFaces) {
    for (const [a0, a1] of freeRuns(f, R.sockets, 1.0)) {
      for (let n = Math.min(4, Math.floor((a1 - a0 - 0.2) / 0.75)); n >= 3; n--) {
        for (const start of [(a0 + a1) / 2 - (n * 0.75) / 2, a1 - 0.1 - n * 0.75, a0 + 0.1]) {
          if (placeUnit(R, (T) => urinalRow(T, f, start, n))) break outerU;
        }
      }
    }
  }
  void B;
  void r;
  signOnWall(c.L, R.faces, R.sockets, 'きれいにご利用ください', { y: Math.min(c.h - 0.35, 2.0), width: 1.2, prefer: [2, 1, 3] });
}
