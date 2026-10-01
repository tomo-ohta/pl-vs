/**
 * FakeSignage — 接続先とサイン表示を別抽選する（U04 / U05 / U06 / U17 / R10 / E15 / E16）。
 * params: mode('misleading' | 'blank' | 'fixedTime' | 'fractional')、target、truthRatio（misleading。既定 0.5）、time（fixedTime。既定 '3:17'）、
 *         fakeDoor（exitSign。既定 true。false なら EXIT サインの下に偽扉を置かず、サインが何も無い壁を指す = U05「出口の無い非常口」）。
 *
 * サインは L.signs（SignAtlas。部屋あたり 48 枚）。任意文字列の CanvasTexture は R10 の案内板 1 枚と U06 の文字盤だけ。
 * ジオメトリは layout フックで確定し、build / update は Mesh の追加（構築時 1 回）と回転・テクスチャ更新だけ。
 *  - misleading / exitSign（U05）: 廊下の end ソケットを末端セグメントの側壁へ移してシェルを組み直し、元の末端壁に
 *    EXIT サイン（発光）+ 開かない偽扉（箔 + 枡。fakeDoor=false なら省く）を置く。末端へ向かう天井の「↑ EXIT」も偽。移せなければ空き壁に置く（サインは常に壁を指す）。
 *  - misleading / flightBoard（R10）: ゲートカウンター上の発光パネルに GATE A / B / C …（出口順）。コンコース中央に両面の出発案内板
 *    （行先は truthRatio で実接続先の部屋名、残りは無関係な部屋名。便名は全て架空。FakeSignage.build が描く）。
 *  - misleading 既定（E16）: 各セグメント中央の天井に両面の案内板（→ 出口 / ← 階段 / ↑ EV）。矢印は truthRatio の確率で実出口の向き、
 *    それ以外は壁・戻り方向。虚偽の横矢印が指す壁には偽扉を足す。
 *  - blank / productLabel（U04）: 自販機を 2〜4 台に増やし、前面に白無地の商品ラベル格子（箔）と空白の価格帯・銘板サイン。
 *  - blank / nameTag（U17）: ブース列（背板 + 机）を作り、机に空白の名札、背板に無地バナー。純装飾。
 *  - fixedTime（U06）: デジタル時計サイン 2〜4 枚（全て time）+ アナログ時計 1 枚（文字盤は build、秒針だけ回る）。解錠イベントは無し（v1.3 D25）。
 *  - fractional（E15）: 階数表示。下階 n.1F / 上階 n.11F / エレベーター n.111（n は rng）。HUD・地図のフロア表記は変えない。
 */
import type { Rng } from '../../core/rng';
import { addDir, dirVec, type Dir, type Vec3 } from '../../core/types';
import type { AABB } from '../../core/aabb';
import { across, along, buildShell, spanForSocket, wallSpans, type Rect } from '../../generators/footprint';
import { box, snap, WALL_T, type Box, type GenParams, type MatId, type RoomLayout, type SignSpec } from '../../generators/layout';
import type { ModifierImpl } from '../types';
import { bool, num, str } from '../util';
import {
  blankWallSlots, canPlaceSolid, centerOf, dominantDir, dist2D, entrySocket, exitSockets, fakeDoorBoxes, innerBand, insideWall, interiorSolids,
  isZWall, opposite, outerPosAt, overlapsAABB, pushSigns, signBesideSocket, sizeOf, socketOnWallNear, wallSign,
} from './FakeSignage.common';
import { addAnalogClocks, addFlightBoards, ANALOG_BACK, ANALOG_BACK_T, BOARD_H, BOARD_T, BOARD_W, fillFlightBoards } from './FakeSignage.build';

function parseTime(v: unknown): { hour: number; minute: number; text: string } {
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(str(v, '3:17'));
  const hour = m ? Math.min(23, +m[1]) : 3;
  const minute = m ? Math.min(59, +m[2]) : 17;
  return { hour, minute, text: `${hour}:${String(minute).padStart(2, '0')}` };
}

// ---------------------------------------------------------------- blank / productLabel（U04）

interface Vending { body: Box; face: Dir }

function findVending(L: RoomLayout): Vending[] {
  const interior = L.boxes.slice(L.shellCount ?? 0);
  const out: Vending[] = [];
  for (const b of interior) {
    if (!b.solid || b.mat !== 'furnitureDark') continue;
    const [sx, sy, sz] = sizeOf(b);
    if (sy < 1.7 || sy > 2.1 || Math.min(sx, sz) < 0.7 || Math.max(sx, sz) > 1.2) continue;
    // 前面の発光箔（lightPanel）が接している側
    const face = interior.find((f) => !f.solid && f.mat === 'lightPanel' && f.max[1] < sy && (
      (Math.abs(f.max[0] - b.min[0]) < 0.03 && f.min[2] >= b.min[2] - 0.01 && f.max[2] <= b.max[2] + 0.01) ||
      (Math.abs(f.min[0] - b.max[0]) < 0.03 && f.min[2] >= b.min[2] - 0.01 && f.max[2] <= b.max[2] + 0.01) ||
      (Math.abs(f.max[2] - b.min[2]) < 0.03 && f.min[0] >= b.min[0] - 0.01 && f.max[0] <= b.max[0] + 0.01) ||
      (Math.abs(f.min[2] - b.max[2]) < 0.03 && f.min[0] >= b.min[0] - 0.01 && f.max[0] <= b.max[0] + 0.01)));
    if (!face) continue;
    const fc = centerOf(face);
    const bc = centerOf(b);
    out.push({ body: b, face: dominantDir(bc, fc) });
  }
  return out;
}

/** 本体 body の面 face の手前 out に、面に沿った相対座標 t0..t1（面の中心基準）× y0..y1 の薄板 */
function faceBox(body: Box, face: Dir, t0: number, t1: number, y0: number, y1: number, out: number, thick: number, mat: MatId): Box {
  const c = centerOf(body);
  const n = dirVec(face);
  const [sx, , sz] = sizeOf(body);
  const half = isZWall(face) ? sz / 2 : sx / 2;
  const lo = (isZWall(face) ? c[2] : c[0]) + (n[0] + n[2]) * (half + out);
  const hi = lo + (n[0] + n[2]) * thick;
  return isZWall(face) ? box([c[0] + t0, y0, lo], [c[0] + t1, y1, hi], mat, false) : box([lo, y0, c[2] + t0], [hi, y1, c[2] + t1], mat, false);
}

function shiftBox(b: Box, dx: number, dz: number): Box {
  return { ...b, min: [b.min[0] + dx, b.min[1], b.min[2] + dz], max: [b.max[0] + dx, b.max[1], b.max[2] + dz] };
}

function blankProductLabels(L: RoomLayout, rng: Rng): void {
  let machines = findVending(L);
  const interior = L.boxes.slice(L.shellCount ?? 0);
  if (machines.length === 0) {
    // 自販機が無い（代替部屋など）: 空き壁に 2 台
    for (const slot of blankWallSlots(L, { width: 1.0, height: 1.9, y: 0.95, clearance: 0.5, depth: 1.0, spacing: 1.6 }).slice(0, 2)) {
      // kind 'vending' を付ける（描画側 ApplianceFromBoxes が自販機の形に置き換える。無いと暗い箱 + 発光箔のまま描かれていた）
      const body: Box = { ...innerBand(slot.pos, slot.dir, -0.45, 0.45, 0, 1.9, 0, 0.9, 'furnitureDark', true), kind: 'vending' };
      if (!canPlaceSolid(L, body)) continue;
      const face = opposite(slot.dir);
      L.boxes.push(body);
      L.boxes.push(faceBox(body, face, -0.4, 0.4, 0.5, 1.7, 0, 0.02, 'lightPanel'));
      machines.push({ body, face });
    }
  } else {
    // 元の 1 台を壁沿いに 1〜3 台複製する（前面が同じ向き、面に沿って 1.1 m ピッチ）
    const src = machines[0];
    const faceFoil = interior.find((f) => !f.solid && f.mat === 'lightPanel' && overlapsAABB(f, src.body, 0.03));
    const extra = rng.int(1, 3);
    const alongZ = !isZWall(src.face);
    const solids = interiorSolids(L);
    let placed = 0;
    for (const k of [1, 2, 3, -1, -2, -3]) {
      if (placed >= extra) break;
      const dx = alongZ ? 0 : 1.1 * k;
      const dz = alongZ ? 1.1 * k : 0;
      const body = shiftBox(src.body, dx, dz);
      if (!canPlaceSolid(L, body, solids, 0.05)) continue;
      L.boxes.push(body);
      solids.push(body);
      if (faceFoil) L.boxes.push(shiftBox(faceFoil, dx, dz));
      machines.push({ body, face: src.face });
      placed++;
    }
  }
  const signs: SignSpec[] = [];
  machines.forEach((m, i) => {
    const [sx, sy, sz] = sizeOf(m.body);
    const w = isZWall(m.face) ? sx : sz;
    // 商品ラベル格子 4 × 5（白無地の小板）。前面箔（厚 0.02）の手前
    const cols = 4;
    const rows = 5;
    const lw = Math.min(0.14, (w - 0.2) / cols - 0.03);
    for (let cx = 0; cx < cols; cx++) {
      for (let ry = 0; ry < rows; ry++) {
        const t = -(w - 0.2) / 2 + ((cx + 0.5) * (w - 0.2)) / cols;
        const y = 0.62 + ry * 0.21;
        L.boxes.push(faceBox(m.body, m.face, t - lw / 2, t + lw / 2, y, y + 0.08, 0.024, 0.006, 'signPlate'));
      }
    }
    // 価格帯（空白）と銘板（空白）
    const c = centerOf(m.body);
    const n = dirVec(m.face);
    const half = isZWall(m.face) ? sz / 2 : sx / 2;
    const front: Vec3 = [c[0] + n[0] * (half + 0.034), 0, c[2] + n[2] * (half + 0.034)];
    signs.push({ id: `fs:price:${i}`, text: '', pos: [front[0], 0.38, front[2]], dir: m.face, width: Math.min(0.7, w - 0.2), kind: 'plate' });
    signs.push({ id: `fs:brand:${i}`, text: '', pos: [front[0], Math.min(sy - 0.1, 1.82), front[2]], dir: m.face, width: Math.min(0.7, w - 0.2), kind: 'plate', background: 0xd8dcd6 });
  });
  pushSigns(L, signs);
}

// ---------------------------------------------------------------- blank / nameTag（U17）

function blankNameTags(L: RoomLayout, rng: Rng): void {
  const r = L.footprint[0];
  if (!r) return;
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  if (Math.min(w, d) < 7) return;
  const alongX = w >= d;
  const solids = interiorSolids(L);
  const pitch = 3.4;
  const signs: SignSpec[] = [];
  let booths = 0;
  const lines = rng.shuffle([0.28, 0.72]);
  for (const frac of lines) {
    if (booths >= 12) break;
    // ブースは中央の通路を向く
    const facing: Dir = alongX ? (frac < 0.5 ? 0 : 2) : (frac < 0.5 ? 1 : 3);
    const cross = alongX ? r.z0 + d * frac : r.x0 + w * frac;
    const len = alongX ? w : d;
    const n = Math.max(1, Math.floor((len - 3) / pitch));
    const start = (alongX ? r.x0 : r.z0) + (len - (n - 1) * pitch) / 2;
    const nv = dirVec(facing);
    for (let i = 0; i < n && booths < 12; i++) {
      const a = start + i * pitch;
      const cx = alongX ? a : cross;
      const cz = alongX ? cross : a;
      // 背板（2.4 × 2.2 × 0.08）は通路の反対側 0.45、机（1.6 × 0.75 × 0.6）は通路側 0.35
      const px = cx - nv[0] * 0.45;
      const pz = cz - nv[2] * 0.45;
      const panel = alongX
        ? box([px - 1.2, 0, pz - 0.04], [px + 1.2, 2.2, pz + 0.04], 'wallWhite')
        : box([px - 0.04, 0, pz - 1.2], [px + 0.04, 2.2, pz + 1.2], 'wallWhite');
      const dx = cx + nv[0] * 0.35;
      const dz = cz + nv[2] * 0.35;
      const desk = alongX
        ? box([dx - 0.8, 0, dz - 0.3], [dx + 0.8, 0.75, dz + 0.3], 'furnitureLight')
        : box([dx - 0.3, 0, dz - 0.8], [dx + 0.3, 0.75, dz + 0.8], 'furnitureLight');
      const union: AABB = { min: [Math.min(panel.min[0], desk.min[0]), 0, Math.min(panel.min[2], desk.min[2])], max: [Math.max(panel.max[0], desk.max[0]), 2.2, Math.max(panel.max[2], desk.max[2])] };
      if (!canPlaceSolid(L, union, solids, 0.3)) continue;
      L.boxes.push(panel, desk);
      solids.push(panel, desk);
      // 机の天板（明るい箔）と空白の名札、背板の無地バナー
      L.boxes.push({ ...desk, min: [desk.min[0], 0.75, desk.min[2]], max: [desk.max[0], 0.78, desk.max[2]], mat: 'furnitureDark', solid: false });
      const deskFront: Vec3 = [dx + nv[0] * (0.3 + 0.012), 0.5, dz + nv[2] * (0.3 + 0.012)];
      signs.push({ id: `fs:tag:${booths}`, text: '', pos: deskFront, dir: facing, width: 0.32, kind: 'plate' });
      const panelFront: Vec3 = [px + nv[0] * (0.04 + 0.012), 1.9, pz + nv[2] * (0.04 + 0.012)];
      signs.push({ id: `fs:banner:${booths}`, text: '', pos: panelFront, dir: facing, width: 1.8, kind: 'plate', background: 0xe6e2d8 });
      booths++;
    }
  }
  pushSigns(L, signs);
}

// ---------------------------------------------------------------- misleading / exitSign（U05）

/** シェル（先頭 shellCount 個）を現在の L.sockets で組み直す（ソケットを動かした後に呼ぶ） */
function rebuildShell(L: RoomLayout): void {
  const n = L.shellCount ?? 0;
  const hasCeiling = L.boxes.slice(0, n).some((b) => b.solid && b.min[1] >= L.height - 0.01 && b.max[1] <= L.height + 0.3);
  const out: Box[] = [];
  buildShell(out, L.footprint, L.height, L.sockets, { floor: L.palette.floor, wall: L.palette.wall, ceiling: L.palette.ceiling, floorHoles: L.holes, noCeiling: !hasCeiling });
  L.boxes.splice(0, n, ...out);
  L.shellCount = out.length;
}

/** 座標が大きい側が外（dir 0 / 1）なら +1 */
function outwardSign(d: Dir): number {
  return d === 0 || d === 1 ? 1 : -1;
}

function fakeExit(L: RoomLayout, p: GenParams, rng: Rng, fakeDoor: boolean): void {
  const end = L.sockets.find((s) => s.id === 'end' && s.type === 'door');
  const doorMat = L.palette.door;
  let target: { pos: Vec3; dir: Dir; rect: Rect | null } | null = null;
  if (end && p.template.id !== 'Bridge' && L.footprint.length) {
    const spans = wallSpans(L.footprint);
    const lastRect = spanForSocket(spans, end)?.edge.rect ?? null;
    if (lastRect) {
      const endCoord = across(end.dir, end.pos[0], end.pos[2]);
      const w = end.width;
      const sides = rng.shuffle([addDir(end.dir, 1), addDir(end.dir, 3)]);
      let moved: { pos: Vec3; dir: Dir } | null = null;
      outer: for (const sd of sides) {
        for (const off of [1.6, 2.6, 3.6, 4.6]) {
          const t = snap(endCoord - outwardSign(end.dir) * off);
          const span = spans.find((sp) => sp.edge.rect === lastRect && sp.edge.dir === sd && t - w / 2 >= sp.a0 + 0.6 && t + w / 2 <= sp.a1 - 0.6);
          if (!span) continue;
          if (socketOnWallNear(L.sockets, sd, span.edge.coord, t, w / 2 + 0.5, end)) continue;
          moved = { pos: outerPosAt(sd, span.edge.coord, t), dir: sd };
          break outer;
        }
      }
      if (moved) {
        target = { pos: end.pos, dir: end.dir, rect: lastRect };
        end.pos = moved.pos;
        end.dir = moved.dir;
        rebuildShell(L);
      }
    }
  }
  if (!target) {
    // 動かせない（end が無い / 塞がれた / Bridge）: 入口から最も遠い空き壁に置く（サインは壁を指す）
    const entry = entrySocket(L);
    const slots = blankWallSlots(L, { width: 1.1, height: 2.3, y: 1.2, clearance: 0.8, depth: 1.2, spacing: 1.0 });
    if (slots.length === 0) return;
    const far = slots.reduce((best, s) => (!entry || dist2D(s.pos, entry.pos) > dist2D(best.pos, entry.pos) ? s : best), slots[0]);
    target = { pos: far.pos, dir: far.dir, rect: null };
  }
  // （偽扉 +）EXIT サイン + 緑の非常灯。fakeDoor=false（U05）ではサインだけが何も無い壁を指す
  if (fakeDoor) L.boxes.push(...fakeDoorBoxes(target.pos, target.dir, doorMat));
  const signs: SignSpec[] = [wallSign(target.pos, target.dir, Math.min(L.height - 0.2, 2.42), 0.72, 'EXIT', { id: 'fs:exit', sub: '非常口', kind: 'emissive' })];
  const inner = insideWall(target.pos, target.dir, WALL_T + 0.3);
  L.lights.push({ pos: [inner[0], Math.min(L.height - 0.3, 2.3), inner[2]], color: 0x4cff80, intensity: 0.35, distance: 5 });
  // 末端セグメント中央の天井に「↑ EXIT」（末端へ歩く人を向く）
  if (target.rect) {
    const r = target.rect;
    const c: Vec3 = [(r.x0 + r.x1) / 2, L.height - 0.42, (r.z0 + r.z1) / 2];
    signs.push({ id: 'fs:exit:ahead', text: '↑ EXIT', sub: '非常口', pos: c, dir: opposite(target.dir), width: 0.9, kind: 'emissive' });
  }
  pushSigns(L, signs);
}

// ---------------------------------------------------------------- misleading 既定（E16）: 案内板

const WORDS = ['出口', '階段', '非常口', 'EV'];

function directionSigns(L: RoomLayout, rng: Rng, truthRatio: number): void {
  const exits = exitSockets(L);
  const signs: SignSpec[] = [];
  let fakeDoors = 0;
  const doorMat = L.palette.door;
  L.footprint.forEach((r, ri) => {
    const w = r.x1 - r.x0;
    const d = r.z1 - r.z0;
    if (Math.max(w, d) < 5) return;
    const c: Vec3 = [(r.x0 + r.x1) / 2, L.height - 0.42, (r.z0 + r.z1) / 2];
    // 長軸に沿った両面（見る人の進行方向 v を向く面 = opposite(v)）
    const axisDirs: Dir[] = w >= d ? [1, 3] : [0, 2];
    axisDirs.forEach((v, k) => {
      const face = opposite(v);
      const arrows: { key: string; dir: Dir; glyph: string }[] = [
        { key: 'ahead', dir: v, glyph: '↑' },
        { key: 'left', dir: addDir(v, 1), glyph: '←' },
        { key: 'right', dir: addDir(v, 3), glyph: '→' },
      ];
      // 真: その向きが支配的な出口がある（横は同じセグメント内の側壁扉だけ）
      const truthful = arrows.filter((a) => exits.some((s) => {
        if (dominantDir(c, s.pos) !== a.dir) return false;
        if (a.key === 'ahead') return true;
        const inSeg = s.pos[0] >= r.x0 - 0.2 && s.pos[0] <= r.x1 + 0.2 && s.pos[2] >= r.z0 - 0.2 && s.pos[2] <= r.z1 + 0.2;
        return inSeg && dist2D(c, s.pos) < Math.max(w, d) / 2 + 1;
      }));
      const lies = arrows.filter((a) => !truthful.includes(a));
      const pool = rng.chance(truthRatio) && truthful.length ? truthful : (lies.length ? lies : arrows);
      const pick = rng.pick(pool);
      const word = rng.pick(WORDS);
      signs.push({ id: `fs:dir:${ri}:${k}`, text: `${pick.glyph} ${word}`, pos: c, dir: face, width: 1.0, kind: 'emissive' });
      // 虚偽の横矢印が指す壁には偽扉（説得力）。ソケットの無い壁区間だけ
      if (pick.key !== 'ahead' && !truthful.includes(pick) && fakeDoors < 3) {
        const wallDir = pick.dir;
        const coord = wallDir === 0 ? r.z1 : wallDir === 2 ? r.z0 : wallDir === 1 ? r.x1 : r.x0;
        const t = isZWall(wallDir) ? c[0] : c[2];
        const span = wallSpans(L.footprint).find((sp) => sp.edge.rect === r && sp.edge.dir === wallDir && t - 0.6 >= sp.a0 + 0.3 && t + 0.6 <= sp.a1 - 0.3);
        if (span && !socketOnWallNear(L.sockets, wallDir, coord, t, 1.4)) {
          L.boxes.push(...fakeDoorBoxes(outerPosAt(wallDir, coord, t), wallDir, doorMat));
          fakeDoors++;
        }
      }
    });
  });
  pushSigns(L, signs);
}

// ---------------------------------------------------------------- misleading / flightBoard（R10）

/** ゲートカウンター上の発光パネル（AtriumGenerator Terminal: lightPanel 2.4 × 0.8、y 2.6〜3.4） */
function counterPanels(L: RoomLayout): Box[] {
  return L.boxes.slice(L.shellCount ?? 0).filter((b) => {
    if (b.solid || b.mat !== 'lightPanel') return false;
    const [sx, sy, sz] = sizeOf(b);
    return Math.abs(b.min[1] - 2.6) < 0.05 && Math.abs(sy - 0.8) < 0.05 && Math.min(sx, sz) < 0.2 && Math.max(sx, sz) > 1.5;
  }).sort((a, b) => a.min[0] - b.min[0] || a.min[2] - b.min[2]);
}

function flightBoardLayout(L: RoomLayout): number {
  const panels = counterPanels(L);
  const signs: SignSpec[] = [];
  const letters = 'ABCDEFGH';
  panels.forEach((b, i) => {
    const c = centerOf(b);
    const [sx, , sz] = sizeOf(b);
    // パネルの面は薄い軸。部屋の中心側を向く
    const thinX = sx < sz;
    const bc = centerOf(L.bounds);
    const face: Dir = thinX ? (bc[0] < c[0] ? 3 : 1) : (bc[2] < c[2] ? 2 : 0);
    const n = dirVec(face);
    const half = Math.min(sx, sz) / 2;
    signs.push({
      id: `fs:gate:${i}`, text: `GATE ${letters[i % letters.length]}`, pos: [c[0] + n[0] * (half + 0.012), c[1], c[2] + n[2] * (half + 0.012)], dir: face,
      width: Math.min(1.8, Math.max(sx, sz) - 0.3), kind: 'emissive', color: 0xfff0c0, background: 0x14213a,
    });
  });
  // 出発案内板のスタンド（コンコース中央付近。支柱 solid + 両面の裏板 + 上の見出しサイン）
  const r = L.footprint[0];
  if (r) {
    const w = r.x1 - r.x0;
    const d = r.z1 - r.z0;
    const alongZ = d >= w;
    const solids = interiorSolids(L);
    const cx0 = (r.x0 + r.x1) / 2;
    const cz0 = (r.z0 + r.z1) / 2;
    // 中央から長軸・短軸方向に少しずつずらして、座席列・柱に掛からない置き場を探す（決定論の順）
    const candidates: [number, number][] = [];
    for (const a of [0, 1.5, -1.5, 3, -3, 4.5, -4.5, 6, -6]) for (const c of [0, 1.2, -1.2, 2.4, -2.4]) candidates.push(alongZ ? [c, a] : [a, c]);
    // 板の面は長軸に垂直（歩いてくる人に正対）。長軸が z なら板は x 方向に伸びる
    const boardAlongX = alongZ;
    for (const [ox, oz] of candidates) {
      const cx = cx0 + ox;
      const cz = cz0 + oz;
      const hx = boardAlongX ? BOARD_W / 2 : BOARD_T / 2;
      const hz = boardAlongX ? BOARD_T / 2 : BOARD_W / 2;
      const post = box([cx - 0.12, 0, cz - 0.12], [cx + 0.12, 2.3, cz + 0.12], 'furnitureDark');
      const stand: AABB = { min: [cx - hx - 0.2, 0, cz - hz - 0.2], max: [cx + hx + 0.2, 3.5, cz + hz + 0.2] };
      if (!canPlaceSolid(L, stand, solids, 0.25)) continue;
      L.boxes.push(post);
      L.boxes.push(box([cx - hx, 2.3, cz - hz], [cx + hx, 2.3 + BOARD_H, cz + hz], 'furnitureDark', false));
      const faces: Dir[] = boardAlongX ? [0, 2] : [1, 3];
      faces.forEach((f, k) => {
        const n = dirVec(f);
        signs.push({ id: `fs:board:${k}`, text: '出発 DEPARTURES', pos: [cx + n[0] * (BOARD_T / 2 + 0.012), 2.3 + BOARD_H + 0.16, cz + n[2] * (BOARD_T / 2 + 0.012)], dir: f, width: BOARD_W - 0.2, kind: 'emissive', color: 0xffc040, background: 0x101010 });
      });
      break;
    }
  }
  pushSigns(L, signs);
  return panels.length;
}

// ---------------------------------------------------------------- fixedTime（U06）

function fixedClocks(L: RoomLayout, rng: Rng, time: { hour: number; minute: number; text: string }): void {
  const digital = blankWallSlots(L, { width: 0.7, height: 0.25, y: 2.15, clearance: 0.5, depth: 0.4, spacing: 2.5 });
  const count = Math.min(digital.length, rng.int(2, 4));
  const picked = rng.shuffle([...digital]).slice(0, count);
  const signs: SignSpec[] = picked.map((s, i) => ({ id: `fs:clock:${i}`, ...wallSign(s.pos, s.dir, 2.15, 0.7, time.text, { kind: 'clock' }) }));
  // アナログ時計: 別の空き壁（デジタルと 1.5 m 以上離す）。裏板だけ layout に置き、文字盤・秒針は build が足す
  const analog = blankWallSlots(L, { width: ANALOG_BACK + 0.2, height: ANALOG_BACK + 0.2, y: 2.0, clearance: 0.5, depth: 0.5, spacing: 1.7 })
    .filter((s) => picked.every((q) => dist2D(s.pos, q.pos) > 1.5));
  if (analog.length) {
    const s = rng.pick(analog);
    L.boxes.push(innerBand(s.pos, s.dir, -ANALOG_BACK / 2, ANALOG_BACK / 2, 2.0 - ANALOG_BACK / 2, 2.0 + ANALOG_BACK / 2, 0.005, ANALOG_BACK_T, 'furnitureDark'));
  }
  pushSigns(L, signs);
}

// ---------------------------------------------------------------- fractional（E15）

function fractionalFloors(L: RoomLayout, p: GenParams, rng: Rng): void {
  const n = rng.int(2, 9);
  const lower = `${n}.1F`;
  const upper = `${n}.11F`;
  const signs: SignSpec[] = [];
  const entry = entrySocket(L);
  const push = (s: SignSpec | null) => { if (s) signs.push(s); };
  if (p.def.generator !== 'VerticalGenerator' || p.template.id !== 'VerticalCore') {
    if (entry && entry.type !== 'hole') push(signBesideSocket(L, entry, 0.5, 1.9, lower, { id: 'fs:floor:entry' }));
    pushSigns(L, signs);
    return;
  }
  for (const s of L.sockets) {
    if (s.type === 'hole') continue;
    if (s.type === 'elevator') {
      // 籠の扉脇の LED 階数表示（外壁の内面）
      const t = along(s.dir, s.pos[0], s.pos[2]) - (s.width / 2 + 0.45);
      const coord = across(s.dir, s.pos[0], s.pos[2]);
      push(wallSign(outerPosAt(s.dir, coord, t), s.dir, 2.0, 0.6, `${n}.111`, { id: 'fs:floor:elev', kind: 'clock' }));
      continue;
    }
    const isUpper = s.pos[1] > 1.0;
    push(signBesideSocket(L, s, 0.5, s.pos[1] + 1.9, isUpper ? upper : lower, { id: `fs:floor:${s.id}` }));
  }
  // 階段の壁（-X 側、階段の途中）に上下の階数
  const b = L.bounds;
  const wallX = b.min[0] + WALL_T;
  const zMid = (b.min[2] + b.max[2]) / 2;
  signs.push({ id: 'fs:floor:stair', text: `↑ ${upper}`, sub: `↓ ${lower}`, pos: [wallX + 0.012, 2.6, zMid], dir: 1, width: 0.7, kind: 'plate' });
  pushSigns(L, signs);
}

// ---------------------------------------------------------------- blank 既定

function blankExisting(L: RoomLayout): void {
  for (const s of L.signs ?? []) { s.text = ''; s.sub = undefined; }
}

// ---------------------------------------------------------------- Modifier

const FakeSignage: ModifierImpl = {
  id: 'FakeSignage',
  defaults: { mode: 'misleading', truthRatio: 0.5, time: '3:17', fakeDoor: true },
  layout(L, p, params, rng) {
    const mode = str(params.mode, 'misleading');
    const target = str(params.target, '');
    const truthRatio = Math.min(1, Math.max(0, num(params.truthRatio, 0.5)));
    switch (mode) {
      case 'blank':
        if (target === 'productLabel') blankProductLabels(L, rng);
        else if (target === 'nameTag') blankNameTags(L, rng);
        else blankExisting(L);
        break;
      case 'fixedTime':
        fixedClocks(L, rng, parseTime(params.time));
        break;
      case 'fractional':
        fractionalFloors(L, p, rng);
        break;
      default:
        if (target === 'exitSign') fakeExit(L, p, rng, bool(params.fakeDoor, true));
        else if (target === 'flightBoard') flightBoardLayout(L);
        else directionSigns(L, rng, truthRatio);
        break;
    }
  },
  build(built, L, ctx) {
    const mode = str(ctx.params.mode, 'misleading');
    const target = str(ctx.params.target, '');
    if (mode === 'fixedTime') {
      const fx = addAnalogClocks(built, L, parseTime(ctx.params.time));
      if (fx) built.effects.push(fx);
    } else if (mode === 'misleading' && target === 'flightBoard') {
      addFlightBoards(built, L, Math.max(1, counterPanels(L).length));
    }
  },
  update(_dt, ctx, params) {
    if (str(params.mode, 'misleading') === 'misleading' && str(params.target, '') === 'flightBoard') {
      fillFlightBoards(ctx, Math.min(1, Math.max(0, num(params.truthRatio, 0.5))));
    }
  },
};

export default FakeSignage;
