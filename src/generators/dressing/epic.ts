/**
 * Epic の部屋別ドレッシング（担当 E）。定義 ID で分岐し、参考画像の要点（docs/reference-rarities-analysis.md の EPIC 表）を足す。
 * 実装した要素・見えたもの・保留とその理由は docs/reference-epic.md。
 *
 * 位置づけ: generateLayout で Generator の直後・Modifier の layout フックの前に呼ばれる（dressing/index.ts）。
 *  - 乱数は渡された rng（p.rng.fork('dress')）だけ。footprint・ソケット・扉前 1.6 m（doorZones）・動線 1.2 m は変えない。
 *  - 予算: 部屋あたり 箱 +300 / 三角形 +40k / ライト +2。反復物は L.instances（E06 の市松）。サインは Modifier の分を残して 40 枚まで。
 *  - Modifier が出す演出（FakeSky の空、InvertedShadow の単一光、WaterWall の水面、VehicleRide の車両、PastWindow の窓、
 *    GraphReference の額、FakeSignage / NoiseGate のサイン、MovingWalls のパネル、TemperatureField の照明色、ColorMissing のマスク）
 *    とは重複させず、空間の印象を決める大物・サイン・光だけを補う。Modifier が後から読む値（palette.ceiling の天井箔 = FakeSky、
 *    shellCount、L.lights）は壊さない。
 *  - Modifier と表示を揃えるために、その Modifier が使う乱数列（p.rng.fork('mod:<Id>') の先頭）を読むだけの箇所がある
 *    （E02 の年代、E15 の階数 n、E19 の温度勾配の向き）。fork は状態を進めないので他の乱数列には影響しない。
 *  - E08 は NonEuclideanVolume が L.boxes を丸ごと組み直すため保留（docs/reference-epic.md）。E05 / E10 は欠番。
 *
 * 検証用: globalThis.__epicDressingOff が true のときは何もしない（ブラウザで構築時間・箱数の増分を比べるためのスイッチ。通常は未定義）。
 */
import type { Rng } from '../../core/rng';
import type { Dir, Socket, Vec3 } from '../../core/types';
import type { AABB } from '../../core/aabb';
import { along, across, wallSpans, type Rect, type WallSpan } from '../footprint';
import { alongFace, chair, doorZones, freeRuns, hitsZone, innerFaces, insideRects, lineFace, longTable, signAt, signOnWall, type Face } from '../furniture';
import { box, DOOR_W, WALL_T, type Box, type GenParams, type InstanceSpec, type LightSpec, type MatId, type RoomLayout, type SignSpec } from '../layout';

/** 部屋あたりの追加予算（docs/reference-rarities-analysis.md「軽量化の規則」） */
const MAX_BOXES = 300;
const MAX_LIGHTS = 2;
/** SignAtlas は 48 枚。Modifier（FakeSignage / NoiseGate / GraphReference / ObservationRewire）の分を残す */
const MAX_SIGNS = 40;
const WARM = 0xffd9a0;

export function dressEpic(L: RoomLayout, p: GenParams, rng: Rng): void {
  if ((globalThis as { __epicDressingOff?: boolean }).__epicDressingOff) return;
  if (L.footprint.length === 0 && p.def.generator !== 'VerticalGenerator') return;
  const ctx = makeCtx(L, p, rng);
  switch (p.def.id) {
    case 'E01': dressE01(ctx); break;
    case 'E02': dressE02(ctx); break;
    case 'E03': dressE03(ctx); break;
    case 'E04': dressE04(ctx); break;
    case 'E06': dressE06(ctx); break;
    case 'E07': dressE07(ctx); break;
    case 'E08': break; // 保留: NonEuclideanVolume が殻 / 内部の両方で L.boxes を組み直す（docs/reference-epic.md）
    case 'E09': dressE09(ctx); break;
    case 'E11': dressE11(ctx); break;
    case 'E12': dressE12(ctx); break;
    case 'E13': dressE13(ctx); break;
    case 'E14': dressE14(ctx); break;
    case 'E15': dressE15(ctx); break;
    case 'E16': dressE16(ctx); break;
    case 'E17': dressE17(ctx); break;
    case 'E18': dressE18(ctx); break;
    case 'E19': dressE19(ctx); break;
    case 'E20': dressE20(ctx); break;
    default: break;
  }
}

// ---------------------------------------------------------------- 共通

interface Ctx {
  L: RoomLayout;
  p: GenParams;
  rng: Rng;
  h: number;
  /** footprint（無い VerticalCore は bounds から内法の矩形を 1 つ作る） */
  rects: Rect[];
  /** 外壁の室内面（footprint から。VerticalCore は空） */
  faces: Face[];
  /** 扉前 1.8 m × 幅（+0.6）・穴・着地点の禁止領域 */
  zones: AABB[];
  /** insideRects の壁厚マージン（VerticalCore は壁が矩形の外側にあるので 0） */
  margin: number;
  added: number;
  lightsAdded: number;
  signsAdded: number;
}

function makeCtx(L: RoomLayout, p: GenParams, rng: Rng): Ctx {
  const vertical = L.footprint.length === 0;
  const b = L.bounds;
  // VerticalCore は footprint を持たず、壁は矩形の外側にある。bounds.max.x は籠の分だけ広いので x は対称（−hw..hw）で取る
  const rects: Rect[] = vertical ? [{ x0: b.min[0] + WALL_T, z0: b.min[2] + WALL_T, x1: -(b.min[0] + WALL_T), z1: b.max[2] - WALL_T }] : L.footprint;
  return {
    L, p, rng, h: L.height, rects,
    faces: vertical ? [] : innerFaces(L.footprint),
    zones: doorZones(L.sockets, null, 0.1),
    margin: vertical ? 0 : WALL_T - 0.001,
    added: 0, lightsAdded: 0, signsAdded: 0,
  };
}

function interiorStart(L: RoomLayout): number {
  return L.shellCount ?? 0;
}

function interiorSolids(L: RoomLayout): Box[] {
  return L.boxes.slice(interiorStart(L)).filter((b) => b.solid);
}

function overlaps(a: AABB, b: AABB, pad = 0): boolean {
  return a.min[0] < b.max[0] + pad && a.max[0] > b.min[0] - pad && a.min[1] < b.max[1] + pad && a.max[1] > b.min[1] - pad && a.min[2] < b.max[2] + pad && a.max[2] > b.min[2] - pad;
}

/** 非ソリッドの箔を予算内で追加する。追加できたら true */
function push(ctx: Ctx, ...boxes: Box[]): boolean {
  if (ctx.added + boxes.length > MAX_BOXES) return false;
  ctx.L.boxes.push(...boxes);
  ctx.added += boxes.length;
  return true;
}

/** ソリッドの置き場として使えるか: 足跡の内側、扉前・穴に掛からない、既存の内装ソリッドと重ならない */
function canPlace(ctx: Ctx, b: Box, gap = 0.02): boolean {
  if (!insideRects(ctx.rects, b, ctx.margin)) return false;
  if (hitsZone(ctx.zones, b)) return false;
  if (ctx.L.holes.some((hh) => overlaps({ min: [hh.min[0], -1, hh.min[2]], max: [hh.max[0], 3, hh.max[2]] }, b, 0.6))) return false;
  return !interiorSolids(ctx.L).some((o) => overlaps(o, b, gap));
}

/** 箔の集合を「ソリッドが全て置ける」ときだけ追加する（RoomGenerator.placeUnit と同じ規則） */
function placeUnit(ctx: Ctx, boxes: Box[], gap = 0.02): boolean {
  for (const b of boxes) if (b.solid && !canPlace(ctx, b, gap)) return false;
  return push(ctx, ...boxes);
}

function addLight(ctx: Ctx, l: LightSpec): void {
  if (ctx.lightsAdded >= MAX_LIGHTS) return;
  ctx.L.lights.push(l);
  ctx.lightsAdded++;
}

function signCount(L: RoomLayout): number {
  return L.signs?.length ?? 0;
}

/** 面 f の位置 at にサインを 1 枚（furniture.signAt）。上限を超えるときは置かない */
function sign(ctx: Ctx, f: Face, at: number, y: number, width: number, text: string, o: Parameters<typeof signAt>[6] = {}): boolean {
  if (signCount(ctx.L) >= MAX_SIGNS) return false;
  signAt(ctx.L, f, at, y, width, text, o);
  ctx.signsAdded++;
  return true;
}

/** 面 f の [t − hw, t + hw] が開口（ソケット ± pad）を避けた区間に収まるか */
function runHas(f: Face, sockets: Socket[], t: number, hw: number, pad: number): boolean {
  return freeRuns(f, sockets, pad).some(([a, b]) => t - hw >= a - 1e-6 && t + hw <= b + 1e-6);
}

/** wallSpans → Face（furniture.innerFaces と同じ写像。矩形との対応を残す） */
function faceOfSpan(s: WallSpan): Face {
  const d = s.edge.dir;
  const inward: 1 | -1 = d === 0 || d === 1 ? -1 : 1;
  return { dir: d, horizontal: d === 0 || d === 2, face: s.edge.coord + inward * WALL_T, inward, a0: s.a0, a1: s.a1, coord: s.edge.coord };
}

/** 面 f 上の点（at: 辺に沿った座標、d: 室内面からの距離） */
function pointOn(f: Face, at: number, y: number, d: number): Vec3 {
  const n = f.face + f.inward * d;
  return f.horizontal ? [at, y, n] : [n, y, at];
}

/** 壁灯: lightWarm の小箱（CorridorHotel の壁灯と同じ 0.14 × 0.22 × 0.08）。壁のプレートとして焼き込みの光源になる */
function lamp(f: Face, t: number, y = 1.7, inset = 0.03, mat: MatId = 'lightWarm'): Box {
  return alongFace(f, t - 0.07, 0.14, inset, inset + 0.08, y - 0.11, y + 0.11, mat, false);
}

/** 装飾扉（開かない）: CorridorGenerator.decorDoor と同じ寸法（枡 + 5 cm 浮かせた扉箔 + レバー） */
function decorDoor(f: Face, t: number, mat: MatId, frameMat: MatId = 'trim', dw = 0.9, dh = 2.05): Box[] {
  return [
    alongFace(f, t - dw / 2 - 0.065, dw + 0.13, 0, 0.05, 0, dh + 0.065, frameMat, false),
    alongFace(f, t - dw / 2, dw, 0.05, 0.08, 0.01, dh, mat, false),
    alongFace(f, t + dw / 2 - 0.16, 0.11, 0.08, 0.13, 0.99, 1.02, 'metal', false),
  ];
}

/** 額装（枡 + 暗い画像箔）。枡をソリッドにすると Modifier の壁スロット探索（wallSlots はソリッドだけを避ける）が重ならない */
function picture(f: Face, t: number, y: number, w: number, hgt: number, img: MatId, solidFrame = true): Box[] {
  return [
    alongFace(f, t - w / 2 - 0.05, w + 0.1, 0, 0.035, y - hgt / 2 - 0.05, y + hgt / 2 + 0.05, 'trim', solidFrame),
    alongFace(f, t - w / 2, w, 0.035, 0.045, y - hgt / 2, y + hgt / 2, img, false),
  ];
}

/** 非常口灯: 緑に発光する箔（焼き込みの光源）+ その上の emissive サイン「非常口」 */
function exitLight(ctx: Ctx, f: Face, t: number, y: number): boolean {
  if (signCount(ctx.L) >= MAX_SIGNS) return false;
  if (!push(ctx, alongFace(f, t - 0.25, 0.5, 0, 0.04, y - 0.08, y + 0.08, 'signEmissive', false))) return false;
  return sign(ctx, f, t, y, 0.5, '非常口', { kind: 'emissive', offset: 0.052 });
}

// ---------------------------------------------------------------- 廊下のセグメント（CorridorGenerator の矩形列）

interface Seg {
  rect: Rect;
  heading: Dir;
  left: Face[];
  right: Face[];
}

/** 進行方向: 最初の矩形は長い辺（+Z 優先）、以降は前の矩形の中心からの向き（GravityAxis.segmentsOf と同じ） */
function corridorSegs(ctx: Ctx): Seg[] {
  const rects = ctx.rects;
  const spans = wallSpans(rects);
  const out: Seg[] = [];
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    let heading: Dir;
    if (i === 0) heading = r.z1 - r.z0 >= r.x1 - r.x0 ? 0 : 1;
    else {
      const q = rects[i - 1];
      const dx = (r.x0 + r.x1 - q.x0 - q.x1) / 2;
      const dz = (r.z0 + r.z1 - q.z0 - q.z1) / 2;
      heading = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 1 : 3) : dz > 0 ? 0 : 2;
    }
    const leftDir = ((heading + 1) % 4) as Dir;
    const rightDir = ((heading + 3) % 4) as Dir;
    const mine = spans.filter((s) => s.edge.rect === r);
    out.push({
      rect: r, heading,
      left: mine.filter((s) => s.edge.dir === leftDir).map(faceOfSpan),
      right: mine.filter((s) => s.edge.dir === rightDir).map(faceOfSpan),
    });
  }
  return out;
}

interface DoorPlate {
  face: Face;
  t: number;
  box: Box;
}

/** Generator が置いた装飾扉の扉箔（palette.door、0.01〜2.05 m、厚 3 cm）と、それが貼られている面 */
function doorPlates(ctx: Ctx, faces: Face[]): DoorPlate[] {
  const L = ctx.L;
  const out: DoorPlate[] = [];
  for (const b of L.boxes.slice(interiorStart(L))) {
    if (b.solid || b.mat !== L.palette.door) continue;
    if (Math.abs(b.min[1] - 0.01) > 0.005 || Math.abs(b.max[1] - 2.05) > 0.01) continue;
    const sx = b.max[0] - b.min[0];
    const sz = b.max[2] - b.min[2];
    const thinX = sx < sz;
    if (Math.abs(Math.min(sx, sz) - 0.03) > 0.005) continue;
    const cx = (b.min[0] + b.max[0]) / 2;
    const cz = (b.min[2] + b.max[2]) / 2;
    const t = thinX ? cz : cx;
    // 水平な面（z = face）の扉は z 方向に薄い（thinX = false）。面から 12 cm 以内、辺の範囲内
    const face = faces.find((f) => f.horizontal !== thinX && Math.abs((f.horizontal ? cz : cx) - f.face) < 0.12 && t >= f.a0 - 0.01 && t <= f.a1 + 0.01);
    if (face) out.push({ face, t, box: b });
  }
  return out;
}

/** 面の集合から、t を含む面 */
function faceAt(faces: Face[], t: number, hw: number): Face | undefined {
  return faces.find((f) => t - hw >= f.a0 - 1e-6 && t + hw <= f.a1 + 1e-6);
}

/** Generator の装飾扉（片側）を反対側の壁へ写し、向かい合う「同じ扉のペア」にする。戻り値はペアの位置 */
function mirrorDoors(ctx: Ctx, segs: Seg[]): { seg: Seg; t: number }[] {
  const L = ctx.L;
  const all = segs.flatMap((s) => [...s.left, ...s.right]);
  const plates = doorPlates(ctx, all);
  const pairs: { seg: Seg; t: number }[] = [];
  for (const pl of plates) {
    const seg = segs.find((s) => s.left.includes(pl.face) || s.right.includes(pl.face));
    if (!seg) continue;
    const opposite = seg.left.includes(pl.face) ? seg.right : seg.left;
    const of = faceAt(opposite, pl.t, 0.55);
    if (!of) continue;
    if (!runHas(of, L.sockets, pl.t, 0.55, 1.6)) continue;
    if (plates.some((q) => q.face === of && Math.abs(q.t - pl.t) < 1.3)) { pairs.push({ seg, t: pl.t }); continue; }
    if (!push(ctx, ...decorDoor(of, pl.t, L.palette.door))) break;
    pairs.push({ seg, t: pl.t });
  }
  return pairs;
}

function setWetness(L: RoomLayout, w: number): void {
  L.render = { ...(L.render ?? {}), wetness: Math.max(L.render?.wetness ?? 0, w) };
}

/** 天井付近の薄いパネル灯を暖色にし、点光源・パレットの色も揃える（E12 暖白色） */
function warmLights(L: RoomLayout): void {
  const h = L.height;
  for (let i = interiorStart(L); i < L.boxes.length; i++) {
    const b = L.boxes[i];
    if (!b.solid && b.mat === 'lightPanel' && b.max[1] - b.min[1] < 0.12 && b.max[1] > h - 0.3) L.boxes[i] = { ...b, mat: 'lightWarm' };
  }
  for (const l of L.lights) l.color = WARM;
  L.palette.light = 'lightWarm';
  L.palette.lightColor = WARM;
}

/** 内装のうち keep が false の箱を捨てる（シェルは触らない） */
function removeInterior(L: RoomLayout, keep: (b: Box) => boolean): void {
  const start = interiorStart(L);
  const head = L.boxes.slice(0, start);
  const tail = L.boxes.slice(start).filter(keep);
  L.boxes = head.concat(tail);
}

// ---------------------------------------------------------------- E01 閉ループ廊下 / E07 観測依存廊下

/**
 * 両側に同じ扉のペア、扉と扉の間に非常口灯、艶床。
 * 扉の位置は CorridorGenerator（GenericCorridor は左側だけ 4.0 m ピッチ・隅 1.2 m・開口 ± 1.6 m を避ける）の slots と同じ規則で
 * 左の壁ごとに求め、同じ位置に右側の扉を足す（既存の左扉とぴたり向かい合う）。非常口灯は各ペアの中間に両側とも
 */
function dressE01(ctx: Ctx): void {
  const { L } = ctx;
  const segs = corridorSegs(ctx);
  const plates = doorPlates(ctx, segs.flatMap((s) => [...s.left, ...s.right]));
  const y = Math.min(ctx.h - 0.25, 2.38);
  const pitch = 4.0, halfW = 0.55, margin = 1.2;
  let lights = 0;
  for (const seg of segs) {
    for (const lf of seg.left) {
      const usable = lf.a1 - lf.a0 - 2 * (margin + halfW);
      if (usable < 0) continue;
      const n = Math.floor(usable / pitch) + 1;
      const start = lf.a0 + margin + halfW + (usable - (n - 1) * pitch) / 2;
      const ts: number[] = [];
      for (let k = 0; k < n; k++) {
        const t = start + k * pitch;
        if (!runHas(lf, L.sockets, t, halfW, 1.6)) continue;
        ts.push(t);
        // 左に Generator の扉が無い位置（他テンプレート）には左も足す
        if (!plates.some((pl) => pl.face === lf && Math.abs(pl.t - t) < 1.3)) push(ctx, ...decorDoor(lf, t, L.palette.door));
        const rf = faceAt(seg.right, t, halfW);
        if (!rf || !runHas(rf, L.sockets, t, halfW, 1.6)) continue;
        if (plates.some((pl) => pl.face === rf && Math.abs(pl.t - t) < 1.3)) continue;
        push(ctx, ...decorDoor(rf, t, L.palette.door));
      }
      for (let i = 0; i + 1 < ts.length && lights < 8; i++) {
        const mid = (ts[i] + ts[i + 1]) / 2;
        for (const side of [seg.left, seg.right]) {
          const f = faceAt(side, mid, 0.3);
          if (!f || !runHas(f, L.sockets, mid, 0.3, 0.6)) continue;
          if (exitLight(ctx, f, mid, y)) lights++;
        }
      }
    }
  }
  setWetness(L, 0.25);
}

/** 見た目は普通の廊下が正解。扉列だけ両側に揃え、床を少し艶にする */
function dressE07(ctx: Ctx): void {
  mirrorDoors(ctx, corridorSegs(ctx));
  setWetness(ctx.L, 0.18);
}

// ---------------------------------------------------------------- E02 年代階段（VerticalCore + EraPreset）

/** 年代 → 壁の帯の色（黄 / 赤紫 / 青。2010 年代以降はステンレス） */
const ERA_BAND: Record<string, MatId> = {
  '1960s': 'plasticYellow', '1970s': 'plasticYellow', '1980s': 'carpetPattern', '1990s': 'carpetPattern',
  '2000s': 'plasticBlue', '2010s': 'stainless', '2020s': 'stainless',
};

/** EraPreset（applyByLevel）が選ぶ年代を同じ乱数列で読む: eras から levels 個をシャッフルで選び、年代順に並べる */
function eraPickOf(p: GenParams, levels: number): string[] {
  const ref = p.def.modifiers.find((m) => m.id === 'EraPreset');
  const raw = ref?.params?.eras;
  const eras = (Array.isArray(raw) ? raw.filter((e): e is string => typeof e === 'string' && /\d{4}/.test(e)) : []);
  const list = eras.length ? eras : ['1970s', '1990s', '2010s'];
  const er = p.rng.fork('mod:EraPreset');
  const idx = list.map((_, i) => i);
  er.shuffle(idx);
  const chosen = idx.slice(0, Math.min(levels, list.length)).sort((a, b) => a - b).map((i) => list[i]);
  chosen.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  while (chosen.length < levels) chosen.push(chosen[chosen.length - 1] ?? list[0]);
  return chosen;
}

function yearOf(era: string): string {
  return /(\d{4})/.exec(era)?.[1] ?? era;
}

/** VerticalCore の壁面: 6 × 8 m、壁は矩形の外側。face は室内面、inward は室内向き */
function verticalWalls(ctx: Ctx): { px: Face; nz: Face; pz: Face; nx: Face } {
  const r = ctx.rects[0];
  return {
    px: lineFace(false, r.x1, -1, r.z0, r.z1),
    nx: lineFace(false, r.x0, 1, r.z0, r.z1),
    nz: lineFace(true, r.z0, 1, r.x0, r.x1),
    pz: lineFace(true, r.z1, -1, r.x0, r.x1),
  };
}

function dressE02(ctx: Ctx): void {
  const { L } = ctx;
  if (L.footprint.length > 0 || L.height < 7) return;
  const FLOOR_H = 3.6;
  const levels = Math.max(1, Math.round(L.height / FLOOR_H));
  const eras = eraPickOf(ctx.p, levels);
  const W = verticalWalls(ctx);
  const socketsAt = (level: number) => L.sockets.filter((s) => Math.round(s.pos[1] / FLOOR_H) === level);
  for (let level = 0; level < levels; level++) {
    const y0 = level * FLOOR_H;
    const mat = ERA_BAND[eras[level]] ?? 'plasticYellow';
    const socks = socketsAt(level);
    // 壁色の帯（1.1〜1.3 m）: 階段側（-X）以外の 3 面。開口 ± 0.3 は避ける
    for (const f of [W.px, W.nz, W.pz]) {
      for (const [a, b] of freeRuns(f, socks, 0.3)) {
        if (b - a < 0.4) continue;
        push(ctx, alongFace(f, a + 0.05, b - a - 0.1, 0.004, 0.02, y0 + 1.1, y0 + 1.3, mat, false));
      }
    }
    // 年代サイン（+Z 壁。入口から正面 / 踊り場から右手）と壁灯 2 つ
    const t = 1.5;
    if (runHas(W.pz, socks, t, 0.65, 0.3)) {
      sign(ctx, W.pz, t, y0 + 2.0, 1.1, yearOf(eras[level]), { kind: 'plate' });
      push(ctx, lamp(W.pz, t - 1.1, y0 + 1.95), lamp(W.pz, t + 1.1, y0 + 1.95));
    }
  }
  // 階段の壁（-X）の中ほど: 上下の年代
  if (levels >= 2) {
    sign(ctx, W.nx, -0.6, FLOOR_H, 0.9, `↑ ${yearOf(eras[1])}`, { kind: 'plate', sub: `↓ ${yearOf(eras[0])}` });
    addLight(ctx, { pos: [-1.8, FLOOR_H - 0.2, -0.6], color: WARM, intensity: 0.45, distance: 7 });
  }
}

// ---------------------------------------------------------------- E03 横向きホテル（GravityAxis のロール後に壁面下部へ来る壁灯）

/** GravityAxis.segmentsOf と同じ断面情報 */
interface RollSeg { rect: Rect; axis: 'x' | 'z'; ex: number; ez: number; pc: number; wi: number; a0: number; a1: number }

function rollSegs(rects: Rect[]): RollSeg[] {
  const out: RollSeg[] = [];
  const cx = (r: Rect) => (r.x0 + r.x1) / 2;
  const cz = (r: Rect) => (r.z0 + r.z1) / 2;
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    let heading: Dir;
    if (i === 0) heading = r.z1 - r.z0 >= r.x1 - r.x0 ? 0 : 1;
    else {
      const q = rects[i - 1];
      const dx = cx(r) - cx(q);
      const dz = cz(r) - cz(q);
      heading = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 1 : 3) : dz > 0 ? 0 : 2;
    }
    const axis: 'x' | 'z' = heading === 0 || heading === 2 ? 'z' : 'x';
    const w = axis === 'z' ? r.x1 - r.x0 : r.z1 - r.z0;
    out.push({
      rect: r, axis, ex: heading === 0 ? 1 : heading === 2 ? -1 : 0, ez: heading === 3 ? 1 : heading === 1 ? -1 : 0,
      pc: axis === 'z' ? cx(r) : cz(r), wi: Math.max(0.6, w - 2 * WALL_T), a0: axis === 'z' ? r.z0 : r.x0, a1: axis === 'z' ? r.z1 : r.x1,
    });
  }
  return out;
}

/**
 * 回転後に「壁面の下部（高さ yf）」へ来る壁灯を、回転前の座標で置く。
 * GravityAxis は断面を（内法幅 → h、高さ → 内法幅）に伸縮してから進行軸まわりに 90° 回す。最終座標 (xf, yf) の逆写像は
 *   e 軸の偏差 a = (yf − h/2)·(wi/h)、旧 y = 0（旧床 → 最終 +e 側の壁）または h（旧天井 → 最終 −e 側の壁）
 * で、最終の張り出し 0.08 は旧 y 方向の厚み 0.08·h/wi、最終の高さ 0.22 は e 方向の幅 0.22·wi/h になる。
 */
function dressE03(ctx: Ctx): void {
  const { L, h } = ctx;
  if (!ctx.p.def.modifiers.some((m) => m.id === 'GravityAxis')) return;
  const yf = 0.55;
  for (const seg of rollSegs(ctx.rects)) {
    const ky = seg.wi / h;
    const a = (yf - h / 2) * ky;
    const hw = 0.11 * ky;
    const thick = 0.08 / ky;
    const len = seg.a1 - seg.a0;
    const n = Math.max(1, Math.floor((len - 3.0) / 3.0) + 1);
    const start = seg.a0 + (len - (n - 1) * 3.0) / 2;
    for (let k = 0; k < n; k++) {
      const t = start + k * 3.0;
      // 同じセグメントの開口（スロットになる扉・入口）から 1.6 m 離す
      const near = L.sockets.some((s) => s.type !== 'hole' && Math.abs((seg.axis === 'z' ? s.pos[2] : s.pos[0]) - t) < 1.6 && (seg.axis === 'z' ? s.pos[0] >= seg.rect.x0 - 0.2 && s.pos[0] <= seg.rect.x1 + 0.2 : s.pos[2] >= seg.rect.z0 - 0.2 && s.pos[2] <= seg.rect.z1 + 0.2));
      if (near) continue;
      const e0 = seg.pc + (seg.axis === 'z' ? seg.ex : seg.ez) * (a - hw);
      const e1 = seg.pc + (seg.axis === 'z' ? seg.ex : seg.ez) * (a + hw);
      const mk = (y0: number, y1: number): Box => seg.axis === 'z'
        ? box([Math.min(e0, e1), y0, t - 0.07], [Math.max(e0, e1), y1, t + 0.07], 'lightWarm', false)
        : box([t - 0.07, y0, Math.min(e0, e1)], [t + 0.07, y1, Math.max(e0, e1)], 'lightWarm', false);
      if (!push(ctx, mk(0, thick), mk(h - thick, h))) return;
    }
  }
}

// ---------------------------------------------------------------- E04 地下の昼光室（LargeRoom + FakeSky noonSun + LightingPhase daylight）

/**
 * コンクリートの箱に四角い天窓。天井の中央だけを palette.ceiling のまま残し（FakeSky が空の箔 = skyNoon に差し替える）、周囲を
 * コンクリートの天井にする。FakeSky の全面の空箔は「palette.ceiling の箔が 1 つも無いとき」だけ足されるので、ここでは重複しない。
 * 日射の方位・強さは FakeSky（sunToExit）→ LightingPhase（低い暖色）が最終的に決める。
 */
function dressE04(ctx: Ctx): void {
  const { L, h } = ctx;
  const r = ctx.rects[0];
  // 1) 家具を捨てて空にする（柱と天井の器具は残す。器具は FakeSky / LightingPhase が消灯にする）
  removeInterior(L, (b) => !b.solid || b.mat === 'columnConcrete');
  // 2) コンクリートの外殻
  const start = interiorStart(L);
  for (let i = 0; i < start; i++) {
    const b = L.boxes[i];
    if (b.mat === L.palette.wall) L.boxes[i] = { ...b, mat: 'wallConcrete' };
    else if (b.mat === L.palette.floor) L.boxes[i] = { ...b, mat: 'floorConcrete' };
  }
  L.palette.wall = 'wallConcrete';
  L.palette.floor = 'floorConcrete';
  // 3) 天窓: 主矩形をちょうど覆う天井箔 1 枚を「周囲のコンクリート 4 枚 + 中央の palette.ceiling」に割る
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  const s = Math.max(2.4, Math.min(6.0, Math.min(w, d) * 0.32));
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;
  const ci = L.boxes.findIndex((b, i) => i < start && b.mat === L.palette.ceiling && b.min[1] >= h - 0.01 && b.max[1] <= h + 0.3
    && Math.abs(b.min[0] - r.x0) < 0.01 && Math.abs(b.max[0] - r.x1) < 0.01 && Math.abs(b.min[2] - r.z0) < 0.01 && Math.abs(b.max[2] - r.z1) < 0.01);
  let skylight = false;
  if (ci >= 0) {
    const c = L.boxes[ci];
    const y0 = c.min[1];
    const y1 = c.max[1];
    const cm: MatId = 'wallConcrete';
    const x0 = cx - s / 2, x1 = cx + s / 2, z0 = cz - s / 2, z1 = cz + s / 2;
    const pieces: Box[] = [
      box([r.x0, y0, r.z0], [r.x1, y1, z0], cm),
      box([r.x0, y0, z1], [r.x1, y1, r.z1], cm),
      box([r.x0, y0, z0], [x0, y1, z1], cm),
      box([x1, y0, z0], [r.x1, y1, z1], cm),
      box([x0, y0, z0], [x1, y1, z1], L.palette.ceiling),
    ];
    L.boxes.splice(ci, 1, ...pieces);
    L.shellCount = (L.shellCount ?? 0) + pieces.length - 1;
    skylight = true;
    // 開口の縁の梁（天井直下、開口の外側へ 0.3 m）
    const bw = 0.3, bh = 0.35;
    push(ctx,
      box([x0 - bw, h - bh, z0 - bw], [x1 + bw, h, z0], 'columnConcrete', false),
      box([x0 - bw, h - bh, z1], [x1 + bw, h, z1 + bw], 'columnConcrete', false),
      box([x0 - bw, h - bh, z0], [x0, h, z1], 'columnConcrete', false),
      box([x1, h - bh, z0], [x1 + bw, h, z1], 'columnConcrete', false),
    );
  }
  // 翼の天井はコンクリート（天窓は主矩形だけ）
  for (let i = 0; i < interiorStart(L); i++) {
    const b = L.boxes[i];
    if (skylight && b.mat === L.palette.ceiling && b.min[1] >= h - 0.01 && b.max[1] <= h + 0.3 && !(b.min[0] >= cx - s / 2 - 0.01 && b.max[0] <= cx + s / 2 + 0.01)) L.boxes[i] = { ...b, mat: 'wallConcrete' };
  }
  // 4) 天窓の真下に小さな木（プランター + 幹 + 葉の球）。中心が塞がっていれば少しずらす
  const top = Math.min(h - 0.4, 3.2);
  for (const [ox, oz] of [[0, 0], [1.6, 0], [-1.6, 0], [0, 1.6], [0, -1.6]] as [number, number][]) {
    const tx = cx + ox, tz = cz + oz;
    const ok = placeUnit(ctx, [
      box([tx - 0.7, 0, tz - 0.7], [tx + 0.7, 0.45, tz + 0.7], 'columnConcrete', true),
      box([tx - 0.6, 0.45, tz - 0.6], [tx + 0.6, 0.47, tz + 0.6], 'chalkboard', false),
      // プランターの中の小さな上向き灯（葉の裏を照らす。床近くの水平パネルは焼き込みで上向きの光源になる）
      box([tx - 0.14, 0.47, tz + 0.28], [tx + 0.14, 0.5, tz + 0.5], 'lightPanel', false),
      box([tx - 0.08, 0.45, tz - 0.08], [tx + 0.08, top - 1.1, tz + 0.08], 'trim', true),
      box([tx - 0.9, top - 1.5, tz - 0.9], [tx + 0.9, top, tz + 0.9], 'plant', false),
      box([tx - 0.15, top - 1.2, tz + 0.35], [tx + 0.95, top - 0.35, tz + 1.35], 'plant', false),
      box([tx - 1.3, top - 1.05, tz - 0.9], [tx - 0.2, top - 0.25, tz + 0.1], 'plant', false),
    ], 0.3);
    if (ok) break;
  }
  // 5) 日射と空の環境光（FakeSky / LightingPhase が方位・色を上書きする。Modifier が外れたときの既定）
  L.lighting = {
    ...(L.lighting ?? {}),
    directional: L.lighting?.directional ?? [{ dir: [-0.45, -0.8, -0.4], color: 0xffffff, intensity: 1.1 }],
    skyAmbient: L.lighting?.skyAmbient ?? { color: 0x9fc0e8, intensity: 0.45 },
  };
}

// ---------------------------------------------------------------- E06 逆影広間（LargeRoom + InvertedShadow）

/** 柱の列、胸像、市松の床、床際の光の帯。単一光と逆影は InvertedShadow が置く（L.lights はそちらが置き換える） */
function dressE06(ctx: Ctx): void {
  const { L, h } = ctx;
  const r = ctx.rects[0];
  removeInterior(L, (b) => !b.solid || b.mat === 'columnConcrete');
  // 市松: 床を明るい大理石にし、黒い正方形（screenDark）をインスタンスで敷く
  const start = interiorStart(L);
  for (let i = 0; i < start; i++) {
    const b = L.boxes[i];
    if (b.mat === L.palette.floor) L.boxes[i] = { ...b, mat: 'marbleFloor' };
  }
  L.palette.floor = 'marbleFloor';
  const tile = 1.2;
  const ox = r.x0 + WALL_T, oz = r.z0 + WALL_T;
  const nx = Math.floor((r.x1 - r.x0 - 2 * WALL_T) / tile);
  const nz = Math.floor((r.z1 - r.z0 - 2 * WALL_T) / tile);
  const transforms: InstanceSpec['transforms'] = [];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      if ((i + j) % 2 !== 0) continue;
      const x = ox + (i + 0.5) * tile;
      const z = oz + (j + 0.5) * tile;
      if (L.holes.some((hh) => x > hh.min[0] - 0.8 && x < hh.max[0] + 0.8 && z > hh.min[2] - 0.8 && z < hh.max[2] + 0.8)) continue;
      transforms.push({ pos: [x, 0.0015, z], yaw: 0 });
    }
  }
  if (transforms.length) (L.instances ??= []).push({ mat: 'screenDark', size: [tile - 0.01, 0.004, tile - 0.01], transforms, solid: false });
  // 柱の列（長軸に沿って 2 列、4 m ピッチ）
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  const alongX = w >= d;
  const longLen = alongX ? w : d;
  const shortLen = alongX ? d : w;
  const long0 = alongX ? r.x0 : r.z0;
  const short0 = alongX ? r.z0 : r.x0;
  const rows = shortLen >= 8.5 ? [short0 + 2.8, short0 + shortLen - 2.8] : [];
  const n = Math.max(1, Math.floor((longLen - 6.0) / 4.0) + 1);
  const startL = long0 + (longLen - (n - 1) * 4.0) / 2;
  for (const s of rows) {
    for (let k = 0; k < n; k++) {
      const l = startL + k * 4.0;
      const x = alongX ? l : s, z = alongX ? s : l;
      placeUnit(ctx, [box([x - 0.28, 0, z - 0.28], [x + 0.28, h, z + 0.28], 'columnConcrete', true)], 0.6);
    }
  }
  // 胸像（白い台座 + 肩 + 頭）: 長い壁の空き区間に 4 m ピッチ、柱の間
  const longFaces = ctx.faces.filter((f) => f.horizontal === alongX);
  let busts = 0;
  for (const f of longFaces) {
    for (const [a, b] of freeRuns(f, L.sockets, 1.0)) {
      const m = Math.floor((b - a - 1.0) / 4.0);
      if (m <= 0) continue;
      const st = (a + b) / 2 - ((m - 1) * 4.0) / 2;
      for (let k = 0; k < m && busts < 10; k++) {
        const t = st + k * 4.0;
        if (placeUnit(ctx, [
          alongFace(f, t - 0.2, 0.4, 0.3, 0.7, 0, 1.15, 'marbleWhite', true),
          alongFace(f, t - 0.25, 0.5, 0.34, 0.66, 1.15, 1.31, 'marbleWhite', false),
          alongFace(f, t - 0.13, 0.26, 0.39, 0.61, 1.31, 1.6, 'marbleWhite', false),
        ], 0.3)) busts++;
      }
    }
  }
  // 床際の光の帯（床上 5 cm。buildFixtures は床近くの水平パネルを上向きの光源にする）
  let strips = 0;
  for (const f of ctx.faces) {
    for (const [a, b] of freeRuns(f, L.sockets, 0.6)) {
      let t = a + 0.2;
      while (t + 1.0 < b - 0.2 && strips < 24) {
        const len = Math.min(6.0, b - 0.2 - t);
        push(ctx, alongFace(f, t, len, 0.03, 0.11, 0.05, 0.11, 'lightPanel', false));
        strips++;
        t += len + 0.15;
      }
    }
  }
}

// ---------------------------------------------------------------- E09 垂直水面オフィス（OfficeGrid + WaterWall）

/**
 * 机の上にモニター（画面は箔。点いた画面 screenGlow は焼き込みの光源になり机と床に青白を落とす。1 枚おきに消えた画面 screenDark。
 * 台座は InstancedMesh）。水壁は WaterWall に任せ、床は濡れで反射させる。画面は 32 枚まで（発光体 16。焼き込みは発光体の数に
 * 比例して重くなるので、構築時間 +30% 以内に収める）
 */
function dressE09(ctx: Ctx): void {
  const { L } = ctx;
  const desks = L.boxes.slice(interiorStart(L)).filter((b) => b.solid && b.kind === 'desk' && b.max[1] - b.min[1] > 0.6 && b.max[1] - b.min[1] < 0.9);
  const exits = L.sockets.filter((s) => s.id !== 'entry' && s.type !== 'hole');
  const stands: InstanceSpec['transforms'] = [];
  let monitors = 0;
  for (const dsk of desks) {
    const sx = dsk.max[0] - dsk.min[0];
    const sz = dsk.max[2] - dsk.min[2];
    const alongX = sx >= sz;
    const len = alongX ? sx : sz;
    const depth = alongX ? sz : sx;
    if (len < 1.4 || depth < 1.0) continue;
    const top = dsk.max[1] + 0.04; // patternRows の天板箔（4 cm）の上
    const c = alongX ? (dsk.min[2] + dsk.max[2]) / 2 : (dsk.min[0] + dsk.max[0]) / 2;
    const pitch = 1.6;
    const n = Math.floor((len - 0.6) / pitch);
    const st = (alongX ? dsk.min[0] : dsk.min[2]) + (len - (n - 1) * pitch) / 2;
    for (let k = 0; k < n && monitors < 32; k++) {
      const l = st + k * pitch;
      for (const side of [-1, 1]) {
        if (monitors >= 32) break;
        const off = c + side * 0.22;
        const px = alongX ? l : off, pz = alongX ? off : l;
        // WaterWall が水壁の前 1.6 m のソリッドを捨てるので、出口の近くの机には置かない（宙に浮くモニターを避ける）
        if (exits.some((s) => Math.hypot(s.pos[0] - px, s.pos[2] - pz) < 2.9)) continue;
        // 画面は机の外側（座る側）を向く: 中心線から side 側へ 0.22 ずれた位置に厚 2.5 cm の箔
        const face = off + side * 0.02;
        const mat: MatId = monitors % 2 === 0 ? 'screenLcd' : 'screenDark';
        const screen = alongX ? box([px - 0.26, top + 0.1, Math.min(face, face + side * 0.025)], [px + 0.26, top + 0.42, Math.max(face, face + side * 0.025)], mat, false)
          : box([Math.min(face, face + side * 0.025), top + 0.1, pz - 0.26], [Math.max(face, face + side * 0.025), top + 0.42, pz + 0.26], mat, false);
        if (!push(ctx, screen)) return;
        stands.push({ pos: [px, top, pz], yaw: alongX ? 0 : Math.PI / 2 });
        monitors++;
      }
    }
  }
  if (stands.length) (L.instances ??= []).push({ mat: 'metalDark', size: [0.08, 0.1, 0.16], transforms: stands, solid: false });
  setWetness(L, 0.3);
}

// ---------------------------------------------------------------- E11 線路のないホーム（Terminal + VehicleRide）

/**
 * コンコースの長い壁沿い（柱の列の内側）に浮いた電車（白い車体 2 両 + 窓帯 + 扉 + 前照灯）。扉・点灯した窓・黄色の点字帯・
 * ホーム端の白線・「つぎが まいります」の吊り看板はコンコース側（壁の反対）に向ける = コンコースがホーム
 */
function dressE11(ctx: Ctx): void {
  const { L, h } = ctx;
  const r = ctx.rects[0];
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  if (Math.min(w, d) < 11 || Math.max(w, d) < 18) return;
  const alongZ = d >= w;
  // 長い壁のうち、開口を避けた最長の区間を持つ面
  const longFaces = ctx.faces.filter((f) => f.horizontal !== alongZ && (f.horizontal ? Math.abs(f.coord - r.z0) < 0.01 || Math.abs(f.coord - r.z1) < 0.01 : Math.abs(f.coord - r.x0) < 0.01 || Math.abs(f.coord - r.x1) < 0.01));
  let best: { f: Face; a0: number; a1: number } | null = null;
  for (const f of longFaces) {
    for (const [a, b] of freeRuns(f, L.sockets, 2.0)) {
      const lo = Math.max(a, (f.horizontal ? r.x0 : r.z0) + 3.0);
      const hi = Math.min(b, (f.horizontal ? r.x1 : r.z1) - 3.0);
      if (hi - lo > (best ? best.a1 - best.a0 : 0)) best = { f, a0: lo, a1: hi };
    }
  }
  if (!best || best.a1 - best.a0 < 14) return;
  const f = best.f;
  const carLen = 12.0, gap = 0.5;
  const cars = Math.max(1, Math.min(2, Math.floor((best.a1 - best.a0 - 2 + gap) / (carLen + gap))));
  const len = cars * carLen + (cars - 1) * gap;
  const at = (best.a0 + best.a1) / 2 - len / 2;
  // 車両の帯（室内面から v0..v0+2.6）。柱の列（2.5 m）の内側に置き、掛かる座席列は捨てる。柱に掛かるなら 1 m 内側へ
  let v0 = 3.6;
  const strip = (v: number): Box => alongFace(f, at - 0.3, len + 0.6, v - 0.3, v + 2.9, 0, 3.2, 'void', false);
  const columnsHit = (b: Box) => interiorSolids(L).some((o) => o.mat === 'columnConcrete' && overlaps(o, b));
  if (columnsHit(strip(v0))) v0 += 1.0;
  if (columnsHit(strip(v0))) return;
  {
    const bb = strip(v0);
    if (hitsZone(ctx.zones, bb)) return;
    removeInterior(L, (b) => !b.solid || b.mat === 'columnConcrete' || !overlaps(b, bb, 0.35));
  }
  const entry = L.sockets.find((s) => s.id === 'entry');
  const headAtStart = !entry || Math.abs(along(f.dir, entry.pos[0], entry.pos[2]) - at) <= Math.abs(along(f.dir, entry.pos[0], entry.pos[2]) - (at + len));
  const boxes: Box[] = [];
  const pv = v0 + 2.6; // ホーム側（コンコース側）の車体面
  // 車体の下の暗い影（線路は無い。浮いているように見せる）
  boxes.push(alongFace(f, at - 0.3, len + 0.6, v0 - 0.25, pv + 0.25, 0.001, 0.005, 'void', false));
  for (let c = 0; c < cars; c++) {
    const u0 = at + c * (carLen + gap);
    boxes.push(alongFace(f, u0, carLen, v0, pv, 0.35, 2.95, 'paintWhite', true));
    boxes.push(alongFace(f, u0 + 0.1, carLen - 0.2, v0 + 0.15, pv - 0.15, 2.95, 3.08, 'metalDark', false));
    boxes.push(alongFace(f, u0 + 0.4, carLen - 0.8, v0 - 0.012, v0, 1.4, 2.3, 'screenDark', false));
    // ホーム側の窓は点灯（車内の明かり。焼き込みでホームに暖色が落ちる）
    boxes.push(alongFace(f, u0 + 0.4, carLen - 0.8, pv, pv + 0.012, 1.4, 2.3, 'windowLit', false));
    for (const du of [1.5, 6.0, 10.5]) boxes.push(alongFace(f, u0 + du - 0.65, 1.3, pv + 0.006, pv + 0.02, 0.4, 2.35, 'stainless', false));
    if (c > 0) boxes.push(alongFace(f, u0 - gap, gap, v0 + 1.05, v0 + 1.55, 0.7, 1.3, 'metalDark', false));
  }
  // 前照灯（入口側の端）と尾灯
  const head = headAtStart ? at : at + len;
  const tail = headAtStart ? at + len : at;
  const hs = headAtStart ? -1 : 1;
  const ts = -hs;
  boxes.push(alongFace(f, head + Math.min(0, hs * 0.03), 0.03, v0 + 0.4, v0 + 0.72, 0.95, 1.15, 'lightWarm', false));
  boxes.push(alongFace(f, head + Math.min(0, hs * 0.03), 0.03, v0 + 1.88, v0 + 2.2, 0.95, 1.15, 'lightWarm', false));
  boxes.push(alongFace(f, head + Math.min(0, hs * 0.015), 0.015, v0 + 0.5, v0 + 2.1, 1.5, 2.3, 'screenDark', false));
  boxes.push(alongFace(f, tail + Math.min(0, ts * 0.03), 0.03, v0 + 0.45, v0 + 0.65, 1.0, 1.12, 'neonRed', false));
  boxes.push(alongFace(f, tail + Math.min(0, ts * 0.03), 0.03, v0 + 1.95, v0 + 2.15, 1.0, 1.12, 'neonRed', false));
  // ホーム端の白線と黄色の点字帯（コンコース側）
  boxes.push(alongFace(f, at - 1.0, len + 2.0, pv + 0.06, pv + 0.14, 0.0, 0.006, 'signPlate', false));
  boxes.push(alongFace(f, at - 1.0, len + 2.0, pv + 0.5, pv + 0.8, 0.0, 0.007, 'yellowLine', false));
  if (!placeUnit(ctx, boxes, 0.1)) return;
  // 吊り看板「つぎが まいります」（ホームの上、進行方向の両面）。柱・座席に当たる位置は 1.5 m ずらす
  const boardY0 = 3.3, boardY1 = 3.8;
  for (const du of [0, 1.5, -1.5, 3.0, -3.0]) {
    const u = at + len / 2 + du;
    const board = alongFace(f, u - 0.03, 0.06, pv + 1.0, pv + 2.6, boardY0, boardY1, 'screenDark', false);
    if (interiorSolids(L).some((o) => overlaps(o, board, 0.1))) continue;
    const rods = [alongFace(f, u - 0.015, 0.03, pv + 1.25, pv + 1.29, boardY1, h, 'metalDark', false), alongFace(f, u - 0.015, 0.03, pv + 2.31, pv + 2.35, boardY1, h, 'metalDark', false)];
    if (!push(ctx, board, ...rods)) break;
    const y = (boardY0 + boardY1) / 2;
    const v = pv + 1.8;
    const dirs: Dir[] = f.horizontal ? [1, 3] : [0, 2];
    for (const dir of dirs) {
      if (signCount(L) >= MAX_SIGNS) break;
      const o = dir === 1 || dir === 0 ? 0.042 : -0.042;
      const pos: Vec3 = f.horizontal ? [u + o, y, f.face + f.inward * v] : [f.face + f.inward * v, y, u + o];
      const spec: SignSpec = { text: 'つぎが まいります', sub: 'The next train is arriving', pos, dir, width: 1.4, kind: 'emissive', color: 0xffa040, background: 0x0b0b0b };
      (L.signs ??= []).push(spec);
      ctx.signsAdded++;
    }
    break;
  }
  const lp = pointOn(f, head + hs * 1.0, 1.3, v0 + 1.3);
  addLight(ctx, { pos: lp, color: 0xffd29a, intensity: 0.7, distance: 9 });
}

// ---------------------------------------------------------------- E12 過去窓回廊（GenericCorridor + PastWindow）

/** 窓は PastWindow が出す。ここは暖色の照明、右側の壁に額 2〜3 枚と壁灯 */
function dressE12(ctx: Ctx): void {
  const { L } = ctx;
  warmLights(L);
  const segs = corridorSegs(ctx);
  // Generator の装飾扉の箔をソリッドに（PastWindow の壁スロット探索はソリッドだけを避けるので、窓が扉に重ならない）
  for (const pl of doorPlates(ctx, segs.flatMap((s) => [...s.left, ...s.right]))) if (!hitsZone(ctx.zones, pl.box)) pl.box.solid = true;
  let pictures = 0;
  let lit = false;
  for (const seg of segs) {
    for (const f of seg.right) {
      const len = f.a1 - f.a0;
      if (len < 5) continue;
      const fr = len >= 10 ? [0.25, 0.5, 0.75] : [0.3, 0.7];
      for (const k of fr) {
        if (pictures >= 3) break;
        const t = f.a0 + len * k;
        if (!runHas(f, L.sockets, t, 0.55, 0.8)) continue;
        const pic = picture(f, t, 1.5, 0.9, 0.7, 'screenDark', true);
        if (!placeUnit(ctx, pic)) continue;
        pictures++;
        if (runHas(f, L.sockets, t + 0.85, 0.1, 0.6)) push(ctx, lamp(f, t + 0.85, 1.85));
        if (!lit) {
          addLight(ctx, { pos: pointOn(f, t + 0.85, 1.9, 0.5), color: WARM, intensity: 0.4, distance: 5 });
          lit = true;
        }
      }
    }
  }
}

// ---------------------------------------------------------------- E13 遠ざかる廊下（GenericCorridor 直線 + DynamicLength）

/** 壁灯の反復（扉と扉の中間に左右交互。60 m の直線で 10 前後）。長さの体感は DynamicLength に任せる */
function dressE13(ctx: Ctx): void {
  const { L } = ctx;
  const segs = corridorSegs(ctx);
  const plates = doorPlates(ctx, segs.flatMap((s) => [...s.left, ...s.right]));
  for (const seg of segs) {
    const ts = plates.filter((pl) => seg.left.includes(pl.face) || seg.right.includes(pl.face)).map((pl) => pl.t).sort((a, b) => a - b);
    const mids: number[] = [];
    if (ts.length >= 2) for (let i = 0; i + 1 < ts.length; i++) mids.push((ts[i] + ts[i + 1]) / 2);
    else {
      const a0 = seg.heading === 0 || seg.heading === 2 ? seg.rect.z0 : seg.rect.x0;
      const a1 = seg.heading === 0 || seg.heading === 2 ? seg.rect.z1 : seg.rect.x1;
      for (let t = a0 + 2.0; t < a1 - 1.5; t += 4.0) mids.push(t);
    }
    mids.forEach((t, i) => {
      const f = faceAt(i % 2 === 0 ? seg.left : seg.right, t, 0.1);
      if (!f || !runHas(f, L.sockets, t, 0.1, 1.6)) return;
      push(ctx, alongFace(f, t - 0.07, 0.14, 0.02, 0.08, 1.64, 1.86, 'lightWarm', false));
    });
  }
}

// ---------------------------------------------------------------- E14 予測写真室（Gallery + GraphReference adjacent 4）

/** 額の列（短い壁に 2 段。GraphReference は最長の壁を使うので重ならない）、机 + バンカーズランプ + 椅子 */
function dressE14(ctx: Ctx): void {
  const { L, h } = ctx;
  const r = ctx.rects[0];
  const alongX = r.x1 - r.x0 >= r.z1 - r.z0;
  // 額: 長軸に直交する壁（短い壁）
  const shortFaces = ctx.faces.filter((f) => f.horizontal !== alongX);
  const rowsY = h >= 2.9 ? [1.2, 1.85] : [1.5];
  let frames = 0;
  for (const f of shortFaces) {
    for (const [a, b] of freeRuns(f, L.sockets, 0.8)) {
      const n = Math.floor((b - a - 0.4) / 1.0);
      if (n <= 0) continue;
      const st = (a + b) / 2 - ((n - 1) * 1.0) / 2;
      for (let k = 0; k < n && frames < 12; k++) {
        const t = st + k * 1.0;
        for (const y of rowsY) {
          if (frames >= 12) break;
          if (placeUnit(ctx, picture(f, t, y, 0.7, 0.5, 'screenDark', true))) frames++;
        }
      }
    }
  }
  // 机（長机 1.5 × 0.75）+ 椅子 + ランプ。中央付近で置ける場所を探す
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;
  const cands: [number, number][] = [[cx, cz + (r.z1 - r.z0) * 0.15], [cx, cz], [cx + 2.5, cz], [cx - 2.5, cz], [cx, cz - (r.z1 - r.z0) * 0.15]];
  for (const [x, z] of cands) {
    const T: Box[] = [];
    longTable(T, x, z, true, 1.5, 0.75, 0.74);
    // バンカーズランプ: 台座 + 支柱 + 緑の笠の代わりに暖色の発光笠（下向きの光源になる）
    T.push(box([x + 0.45, 0.74, z - 0.08], [x + 0.61, 0.76, z + 0.08], 'metalDark', false));
    T.push(box([x + 0.52, 0.76, z - 0.012], [x + 0.545, 1.06, z + 0.012], 'metalDark', false));
    T.push(box([x + 0.4, 1.02, z - 0.11], [x + 0.66, 1.15, z + 0.11], 'lightWarm', false));
    if (!placeUnit(ctx, T, 0.3)) continue;
    placeUnit(ctx, (() => { const C: Box[] = []; chair(C, x - 0.2, z - 0.75, 0); return C; })(), 0.05);
    addLight(ctx, { pos: [x + 0.53, 1.35, z], color: WARM, intensity: 0.5, distance: 5 });
    break;
  }
}

// ---------------------------------------------------------------- E15 小数階フロア（VerticalCore + FakeSignage fractional）

/**
 * +X 壁の下階にエレベーター扉を 3 枚（本物 1 + ステンレスの装飾扉 2）。上の階数表示は FakeSignage と同じ乱数列で読んだ n を使い
 * 「n」「n.1」「n.11」（FakeSignage の LED「n.111」は籠の扉の脇 y 2.0、階数札は各扉の脇 y 1.9 なので位置は重ならない）
 */
function dressE15(ctx: Ctx): void {
  const { L } = ctx;
  if (L.footprint.length > 0) return;
  const W = verticalWalls(ctx);
  const f = W.px;
  const lower = L.sockets.filter((s) => s.pos[1] < 1.0);
  const elev = lower.find((s) => s.type === 'elevator' && s.dir === f.dir);
  const n = ctx.p.rng.fork('mod:FakeSignage').int(2, 9);
  const labels = [`${n}`, `${n}.1`, `${n}.11`];
  const doors: { t: number; real: boolean }[] = [];
  if (elev) doors.push({ t: along(elev.dir, elev.pos[0], elev.pos[2]), real: true });
  for (const t of [-0.4, -2.4]) {
    if (!runHas(f, lower, t, 0.7, 0.3)) continue;
    doors.push({ t, real: false });
  }
  doors.forEach((dr, i) => {
    const label = labels[Math.min(i, labels.length - 1)];
    if (!dr.real) {
      if (!push(ctx,
        alongFace(f, dr.t - 0.66, 1.32, 0, 0.02, 0, 2.3, 'trim', false),
        alongFace(f, dr.t - 0.6, 0.59, 0.02, 0.05, 0.005, 2.2, 'stainless', false),
        alongFace(f, dr.t + 0.01, 0.59, 0.02, 0.05, 0.005, 2.2, 'stainless', false),
        alongFace(f, dr.t - 0.012, 0.024, 0.02, 0.056, 0.005, 2.2, 'metalDark', false),
        alongFace(f, dr.t + 0.74, 0.1, 0, 0.018, 1.05, 1.25, 'metalDark', false),
      )) return;
    }
    push(ctx, alongFace(f, dr.t - 0.5, 1.0, 0, 0.06, 2.32, 2.37, 'lightWarm', false));
    sign(ctx, f, dr.t, 2.55, 0.5, label, { kind: 'clock', color: 0xff8a3a });
  });
  if (doors.length) addLight(ctx, { pos: pointOn(f, -1.4, 2.3, 0.6), color: WARM, intensity: 0.5, distance: 6 });
}

// ---------------------------------------------------------------- E16 虚偽案内区域（GenericCorridor + FakeSignage misleading）

/** 矛盾する案内板 2 枚（壁付きの銘板）。FakeSignage の吊り案内板（各セグメント中央の天井）・偽扉（壁の中央）とは位置を分ける */
function dressE16(ctx: Ctx): void {
  const { L } = ctx;
  const texts: [string, string][] = [['こちらが出口 →', '（行き止まりです）'], ['← こちらは出口', '（まだ先にあります）']];
  let k = 0;
  for (const seg of corridorSegs(ctx)) {
    for (const f of [...seg.right, ...seg.left]) {
      const len = f.a1 - f.a0;
      if (len < 6) continue;
      const mid = (f.a0 + f.a1) / 2;
      for (const fr of [0.3, 0.7]) {
        if (k >= texts.length) return;
        const t = f.a0 + len * fr;
        if (Math.abs(t - mid) < 1.4 || !runHas(f, L.sockets, t, 0.8, 0.6)) continue;
        // 扉の箔に重ねない
        const bb = alongFace(f, t - 0.75, 1.5, 0, 0.05, 1.4, 1.9, 'trim', false);
        if (L.boxes.slice(interiorStart(L)).some((b) => overlaps(b, bb, 0.05))) continue;
        if (!sign(ctx, f, t, 1.65, 1.4, texts[k][0], { kind: 'plate', sub: texts[k][1] })) return;
        k++;
      }
    }
  }
}

// ---------------------------------------------------------------- E17 音声認証扉（GenericRoom + NoiseGate）

const GATE_GAP = 1.5;
const GATE_MARGIN = 1.0;

/** NoiseGate.placeGates と同じ規則で 3 扉の位置を求める（footprint と入口だけで決まる） */
function gatePositions(rects: Rect[], entry: Socket | undefined, n: number): { span: WallSpan; t: number }[] {
  const entryDir: Dir | -1 = entry && entry.type !== 'hole' ? entry.dir : -1;
  const opposite = entryDir === -1 ? -1 : ((entryDir + 2) % 4);
  const spans = wallSpans(rects).filter((sp) => sp.edge.dir !== entryDir && sp.a1 - sp.a0 >= DOOR_W + 2 * GATE_MARGIN);
  const rank = (d: Dir) => (d === opposite ? 0 : 1);
  spans.sort((a, b) => rank(a.edge.dir) - rank(b.edge.dir) || (b.a1 - b.a0) - (a.a1 - a.a0) || a.edge.dir - b.edge.dir || a.edge.coord - b.edge.coord || a.a0 - b.a0);
  const out: { span: WallSpan; t: number }[] = [];
  let remaining = n;
  const step = DOOR_W + GATE_GAP;
  for (const sp of spans) {
    if (remaining <= 0) break;
    const lo = sp.a0 + GATE_MARGIN + DOOR_W / 2;
    const hi = sp.a1 - GATE_MARGIN - DOOR_W / 2;
    if (hi < lo) continue;
    let k = Math.min(remaining, Math.floor((hi - lo) / step + 1e-6) + 1);
    const mid = (sp.a0 + sp.a1) / 2;
    let start = Math.round((mid - ((k - 1) * step) / 2) * 2) / 2;
    if (start < lo) start = Math.ceil(lo * 2) / 2;
    while (k > 0 && start + (k - 1) * step > hi + 1e-6) k--;
    for (let i = 0; i < k; i++) {
      const t = start + i * step;
      if (entry && entry.type !== 'hole' && entry.dir === sp.edge.dir && Math.abs(across(entry.dir, entry.pos[0], entry.pos[2]) - sp.edge.coord) < 0.05 && Math.abs(along(entry.dir, entry.pos[0], entry.pos[2]) - t) < (entry.width + DOOR_W) / 2 + 0.4) continue;
      out.push({ span: sp, t });
      remaining--;
    }
  }
  return out;
}

/** 扉脇の音声検知パネル（screenDark + neonBlue の波形）と「小声 → 図書室 / 通常 → オフィス / 大声 → 屋上」の銘板 */
function dressE17(ctx: Ctx): void {
  const { L, rng } = ctx;
  const ref = L.footprint.length ? ctx.p.def.modifiers.find((m) => m.id === 'NoiseGate') : undefined;
  if (!ref) return;
  const raw = ref.params?.thresholds;
  const n = Array.isArray(raw) && raw.length > 0 ? Math.min(3, raw.length) : 3;
  const entry = L.sockets.find((s) => s.id === 'entry');
  const gates = gatePositions(ctx.rects, entry, n);
  let gateFace: Face | null = null;
  for (const [i, g] of gates.entries()) {
    // NoiseGate と同じく、行き先を置けず壁へ戻した扉（removedSockets）にはパネルを付けない
    if (ctx.p.removedSockets.includes(`gate${i}`)) continue;
    const f = faceOfSpan(g.span);
    gateFace = f;
    const t0 = g.t + DOOR_W / 2 + 0.14;
    const boxes: Box[] = [alongFace(f, t0, 0.3, 0, 0.03, 1.02, 1.46, 'screenDark', false)];
    // 波形: 5 本の細い発光バー（中央が高い）
    const heights = [0.07, 0.15, 0.24, 0.13, 0.06].map((v) => v * rng.float(0.8, 1.2));
    heights.forEach((hh, i) => boxes.push(alongFace(f, t0 + 0.05 + i * 0.05, 0.02, 0.03, 0.045, 1.24 - hh / 2, 1.24 + hh / 2, 'neonBlue', false)));
    boxes.push(alongFace(f, t0 + 0.24, 0.03, 0.03, 0.045, 1.4, 1.43, 'neonBlue', false));
    if (!push(ctx, ...boxes)) return;
  }
  // 銘板は扉の壁と直交する壁（NoiseGate のメーターは扉の壁 y 1.75）
  const prefer: Dir[] = gateFace ? ([((gateFace.dir + 1) % 4) as Dir, ((gateFace.dir + 3) % 4) as Dir, ((gateFace.dir + 2) % 4) as Dir]) : [1, 3, 2];
  if (signCount(L) < MAX_SIGNS && signOnWall(L, ctx.faces, L.sockets, '小声 → 図書室 ／ 通常 → オフィス', { y: Math.min(ctx.h - 0.4, 1.7), width: 1.7, prefer, kind: 'plate', sub: '大声 → 屋上' })) ctx.signsAdded++;
}

// ---------------------------------------------------------------- E18 動く壁紙区画（CorridorHotel + MovingWalls lining）

/** 右側の壁にも壁灯、中央にランナーカーペット。壁紙のうねりは MovingWalls（張り出し 0.14 の手前を滑る）に任せる */
function dressE18(ctx: Ctx): void {
  const { L } = ctx;
  const segs = corridorSegs(ctx);
  const plates = doorPlates(ctx, segs.flatMap((s) => [...s.left, ...s.right]));
  for (const seg of segs) {
    for (const f of seg.right) {
      const ts = plates.filter((pl) => pl.face === f).map((pl) => pl.t).sort((a, b) => a - b);
      ts.forEach((t, i) => {
        if (i % 2 !== 0) return;
        const lt = t + 0.45 + 0.065 + 0.43;
        if (!runHas(f, L.sockets, lt, 0.1, 1.0)) return;
        push(ctx, alongFace(f, lt - 0.07, 0.14, 0.03, 0.11, 1.6, 1.82, 'lightWarm', false));
      });
    }
    // ランナー（1.2 m 幅の模様カーペット）。床穴は避ける
    const r = seg.rect;
    const alongZ = seg.heading === 0 || seg.heading === 2;
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    let parts: [number, number][] = [alongZ ? [r.z0 + 0.6, r.z1 - 0.6] : [r.x0 + 0.6, r.x1 - 0.6]];
    for (const hh of L.holes) {
      const lo = alongZ ? hh.min[2] - 0.3 : hh.min[0] - 0.3, hi = alongZ ? hh.max[2] + 0.3 : hh.max[0] + 0.3;
      parts = parts.flatMap(([a, b]): [number, number][] => (b <= lo || a >= hi ? [[a, b]] : [[a, Math.min(b, lo)], [Math.max(a, hi), b]])).filter(([a, b]) => b - a > 0.5);
    }
    for (const [a, b] of parts) push(ctx, alongZ ? box([cx - 0.6, 0.001, a], [cx + 0.6, 0.009, b], 'carpetPattern', false) : box([a, 0.001, cz - 0.6], [b, 0.009, cz + 0.6], 'carpetPattern', false));
  }
}

// ---------------------------------------------------------------- E19 温度座標迷宮（MazeGrid + TemperatureField）

/** TemperatureField.buildField と同じ場（ノイズ無し）: 入口からの距離 − 最寄り出口への距離を 0..1 に正規化 */
function warmthField(L: RoomLayout, hotExit: boolean, cell: number): (x: number, z: number) => number {
  const b = L.bounds;
  const nx = Math.max(1, Math.ceil((b.max[0] - b.min[0]) / cell));
  const nz = Math.max(1, Math.ceil((b.max[2] - b.min[2]) / cell));
  const entry = L.sockets.find((s) => s.id === 'entry');
  const exits = L.sockets.filter((s) => s.id !== 'entry' && s.type !== 'hole');
  const from: Vec3 = entry?.pos ?? [b.min[0], 0, b.min[2]];
  const to: Vec3[] = exits.length ? exits.map((s) => s.pos) : [[(b.min[0] + b.max[0]) / 2, 0, b.max[2]]];
  const phi = (x: number, z: number) => {
    const dEntry = Math.hypot(x - from[0], z - from[2]);
    let dExit = Infinity;
    for (const t of to) dExit = Math.min(dExit, Math.hypot(x - t[0], z - t[2]));
    return dEntry - dExit;
  };
  let lo = Infinity, hi = -Infinity;
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
    const v = phi(b.min[0] + (ix + 0.5) * cell, b.min[2] + (iz + 0.5) * cell);
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  const span = hi - lo > 1e-6 ? hi - lo : 1;
  return (x, z) => {
    const ix = Math.min(nx - 1, Math.max(0, Math.floor((x - b.min[0]) / cell)));
    const iz = Math.min(nz - 1, Math.max(0, Math.floor((z - b.min[2]) / cell)));
    const v = phi(b.min[0] + (ix + 0.5) * cell, b.min[2] + (iz + 0.5) * cell);
    const t = (v - lo) / span;
    return hotExit ? t : 1 - t;
  };
}

/** 外壁の上部に温度で色分けした発光帯（寒い側 neonBlue / 暖かい側 neonRed）と、最も寒い / 暖かい壁に温度表示 */
function dressE19(ctx: Ctx): void {
  const { L, h } = ctx;
  const ref = ctx.p.def.modifiers.find((m) => m.id === 'TemperatureField');
  if (!ref) return;
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const cell = Math.max(1, num(ref.params?.cell, 2));
  const cold = num(ref.params?.cold, 8);
  const hot = Math.max(cold + 1, num(ref.params?.hot, 30));
  const hotExit = ctx.p.rng.fork('mod:TemperatureField').chance(0.65);
  const warmth = warmthField(L, hotExit, cell);
  const y0 = Math.min(h - 0.5, 2.46);
  const samples: { f: Face; t: number; w: number }[] = [];
  for (const f of ctx.faces) {
    if (f.a1 - f.a0 < 1.5) continue;
    let a = f.a0 + 0.1;
    const end = f.a1 - 0.1;
    let cur: { start: number; mat: MatId } | null = null;
    while (a < end - 0.05) {
      const step = Math.min(1.0, end - a);
      const q = pointOn(f, a + step / 2, 0, 0.6);
      const wv = warmth(q[0], q[2]);
      const mat: MatId = wv >= 0.5 ? 'neonRed' : 'neonBlue';
      samples.push({ f, t: a + step / 2, w: wv });
      if (cur && cur.mat !== mat) {
        push(ctx, alongFace(f, cur.start, a - cur.start, 0.02, 0.08, y0, y0 + 0.12, cur.mat, false));
        cur = null;
      }
      if (!cur) cur = { start: a, mat };
      a += step;
    }
    if (cur) push(ctx, alongFace(f, cur.start, end - cur.start, 0.02, 0.08, y0, y0 + 0.12, cur.mat, false));
  }
  // 温度表示: 最も寒い / 暖かい壁の位置（開口に掛かる位置は次の候補へ）
  const yS = Math.min(h - 0.2, y0 + 0.34);
  const ok = (q: { f: Face; t: number }) => runHas(q.f, L.sockets, q.t, 0.4, 0.2);
  const coldest = [...samples].sort((a, b) => a.w - b.w).find(ok);
  const hottest = [...samples].sort((a, b) => b.w - a.w).find((q) => q !== coldest && ok(q));
  if (coldest) sign(ctx, coldest.f, coldest.t, yS, 0.7, `${Math.round(cold)}℃`, { kind: 'clock', color: 0x9fc8ff });
  if (hottest) sign(ctx, hottest.f, hottest.t, yS, 0.7, `${Math.round(hot)}℃`, { kind: 'clock', color: 0xff6a5a });
}

// ---------------------------------------------------------------- E20 色欠損フロア（GenericRoom + ColorMissing）

/** 欠損するチャンネル（rooms.json の params。mask があれば 0 の成分） */
function missingChannel(p: GenParams): 'red' | 'green' | 'blue' {
  const ref = p.def.modifiers.find((m) => m.id === 'ColorMissing');
  const mask = ref?.params?.mask;
  if (Array.isArray(mask) && mask.length === 3) {
    const i = mask.findIndex((v) => typeof v === 'number' && v <= 0.01);
    if (i === 1) return 'green';
    if (i === 2) return 'blue';
    if (i === 0) return 'red';
  }
  const ch = typeof ref?.params?.channel === 'string' ? ref.params.channel.toLowerCase() : 'red';
  return ch === 'green' ? 'green' : ch === 'blue' ? 'blue' : 'red';
}

/**
 * 待合室: 欠損しない色の椅子と灰の椅子の列（行ごとに交互）、「◯のない世界」の銘板。欠損色（既定 red）の箔は置かない。
 * 座面と背は InstancedMesh（solid = 各インスタンスが当たり判定）、梁と脚は箔。大部屋でも椅子の列で埋まる
 */
function dressE20(ctx: Ctx): void {
  const { L } = ctx;
  const r = ctx.rects[0];
  const ch = missingChannel(ctx.p);
  const colored: MatId = ch === 'blue' ? 'plasticYellow' : ch === 'red' ? 'plasticBlue' : 'plasticRed';
  const grey: MatId = 'doorMetal';
  const name = ch === 'blue' ? '青' : ch === 'red' ? '赤' : '緑';
  removeInterior(L, (b) => !b.solid || b.mat === 'columnConcrete' || b.mat === 'plant');
  // 椅子列（北 = 入口の反対を向く）: 行ピッチ 1.6、4 席 2.0 m のグループを 0.7 m 空けて並べる
  const m = 1.6;
  const x0 = r.x0 + m, x1 = r.x1 - m;
  const z0 = r.z0 + m + 1.2, z1 = r.z1 - m - 1.0;
  const rows = Math.min(8, Math.max(0, Math.floor((z1 - z0) / 1.6) + 1));
  const groups = Math.min(6, Math.max(0, Math.floor((x1 - x0 + 0.7) / 2.7)));
  const gx0 = (x0 + x1) / 2 - (groups * 2.7 - 0.7) / 2 + 1.0;
  const zStart = z1 - (rows - 1) * 1.6;
  const s = 0.225;
  const seats: Record<'c' | 'g', InstanceSpec['transforms']> = { c: [], g: [] };
  const backs: Record<'c' | 'g', InstanceSpec['transforms']> = { c: [], g: [] };
  for (let i = 0; i < rows; i++) {
    for (let g = 0; g < groups; g++) {
      const cx = gx0 + g * 2.7, cz = zStart + i * 1.6;
      const key: 'c' | 'g' = i % 2 === 0 ? 'c' : 'g';
      // グループ全体の当たり判定で置き場を確かめる（扉前・柱・穴）
      const hull = box([cx - 1.0, 0, cz - s], [cx + 1.0, 0.85, cz + s], 'metalDark', true);
      if (!canPlace(ctx, hull, 0.05)) continue;
      const frame: Box[] = [box([cx - 0.95, 0.33, cz - 0.03], [cx + 0.95, 0.38, cz + 0.03], 'metalDark', false)];
      for (const e of [-1, 1]) {
        const t = e * 0.88;
        frame.push(box([cx + t - 0.02, 0, cz - s + 0.02], [cx + t + 0.02, 0.33, cz + s - 0.02], 'metalDark', false));
      }
      if (!push(ctx, ...frame)) break;
      for (let k = 0; k < 4; k++) {
        const ux = cx - 1.0 + 0.25 + k * 0.5;
        seats[key].push({ pos: [ux, 0.38, cz], yaw: 0 });
        backs[key].push({ pos: [ux, 0.45, cz - s + 0.03], yaw: 0 });
      }
    }
  }
  for (const [key, mat] of [['c', colored], ['g', grey]] as ['c' | 'g', MatId][]) {
    if (!seats[key].length) continue;
    (L.instances ??= []).push({ mat, size: [0.45, 0.07, 0.45], transforms: seats[key], solid: true });
    L.instances.push({ mat, size: [0.45, 0.4, 0.06], transforms: backs[key], solid: true });
  }
  if (signCount(L) < MAX_SIGNS && signOnWall(L, ctx.faces, L.sockets, `${name}のない世界`, { y: Math.min(ctx.h - 0.45, 1.95), width: 2.0, prefer: [1, 3, 0], kind: 'plate', sub: `このフロアには${name}という色が存在しません` })) ctx.signsAdded++;
}
