/**
 * DuplicateNumber — 扉ごとの部屋番号サインを重複 / 欠番させる（U02 客室階 / U16 駐車場 / R20 トランクルーム）。
 * params: mode('duplicate' | 'skipAndDuplicate')、duplicateRate（既定 0.5。skipAndDuplicate では 0.2）、skipRate（既定 0.2。skipAndDuplicate のみ）。
 *
 * layout フックの決定論 post-pass（乱数は渡された rng のみ。番号は seed から再生成するので保存しない）。サインは L.signs（SignAtlas）の
 * 'plate' で、RoomBuilder が部屋あたり 48 枚まで描く。HUD・地図・接続には影響しない（サインだけが嘘をつく）。
 *  - hotel（CorridorHotel ほか既定）: 実扉（door ソケット。entry を含む）と偽扉（decorate の扉パネル箔 = palette.door の非 solid 薄箱）を
 *    入口からの距離順に連番（階 × 100 + n。階は rng）し、duplicateRate の割合で他の扉の番号に置換。entry 以外の実扉が 2 枚以上あれば
 *    必ず 1 組を同番号にする（接続ルール「同一番号の扉 2 つが別部屋へ接続」）。1 枚なら偽扉 1 枚にその番号を写す。
 *    銘板は扉の脇（右側優先）、高さ 1.9 m、幅 0.48 m（高さ 0.12 m）。
 *  - parking（ParkingGenerator）: 柱（columnConcrete の全高ソリッド）を「入口 → ランプ出口」軸への射影順に区画コード（B3-01, 02, 04, 04, 06 …）で
 *    番号付けし、skipRate で欠番・duplicateRate で重複。黄帯（0.9 m）の上、高さ 1.15 m の黄色い銘板を軸に垂直な 2 面へ貼る。
 *  - storage（doorMetal の非 solid 箱を扉と見なす。PropRepetition storageDoor の扉板、無ければ GridGenerator の doorMetal 詰め物）:
 *    列（面の座標）→ 通路順にユニット番号（A-101 …）を振り、duplicateRate で他ユニットの番号に置換。番号は全扉に振るが、
 *    サインは入口に近い 48 枚だけ（RoomBuilder のアトラス上限）。
 */
import type { Dir, Socket, Vec3 } from '../../core/types';
import type { Rng } from '../../core/rng';
import type { Box, RoomLayout, SignSpec } from '../../generators/layout';
import type { ModifierImpl } from '../types';
import { num, str } from '../util';
import {
  centerOf, dist2D, entrySocket, exitSockets, insideWall, interiorSolids, isZWall, MAX_SIGNS, outerPosAt, pushSigns, signBesideSocket, sizeOf, wallSign,
} from './FakeSignage.common';

const PLATE_W = 0.48;
const PLATE_Y = 1.9;
const SIGN_PREFIX = 'dn:';

type Mode = 'duplicate' | 'skipAndDuplicate';

interface NumberedDoor {
  /** 壁外面の床位置（実扉はソケット、偽扉は箔の壁側） */
  pos: Vec3;
  /** 外向き */
  dir: Dir;
  socket?: Socket;
  real: boolean;
  num: number;
}

// ---------------------------------------------------------------- hotel（U02 ほか既定）

/** 偽扉の箔（CorridorGenerator.decorate の wallBand: palette.door の非 solid、高 2.05、厚 ≤ 0.05）を壁外面の位置へ写す */
function fakeDoorsOf(L: RoomLayout): { pos: Vec3; dir: Dir }[] {
  const out: { pos: Vec3; dir: Dir }[] = [];
  for (const b of L.boxes.slice(L.shellCount ?? 0)) {
    if (b.solid || b.mat !== L.palette.door) continue;
    const [sx, sy, sz] = sizeOf(b);
    if (sy < 1.9 || sy > 2.2 || Math.min(sx, sz) > 0.06 || Math.max(sx, sz) < 0.7 || Math.max(sx, sz) > 1.2) continue;
    const c = centerOf(b);
    const thinX = sx < sz;
    // 近い足跡の辺（0.4 m 以内）から外向きを決める
    let best: { dir: Dir; coord: number; d: number } | null = null;
    for (const r of L.footprint) {
      const cands: { dir: Dir; coord: number }[] = thinX ? [{ dir: 1, coord: r.x1 }, { dir: 3, coord: r.x0 }] : [{ dir: 0, coord: r.z1 }, { dir: 2, coord: r.z0 }];
      for (const k of cands) {
        const d = Math.abs((thinX ? c[0] : c[2]) - k.coord);
        if (d < 0.4 && (!best || d < best.d)) best = { ...k, d };
      }
    }
    if (!best) continue;
    out.push({ pos: outerPosAt(best.dir, best.coord, thinX ? c[2] : c[0]), dir: best.dir });
  }
  return out;
}

function applyHotel(L: RoomLayout, rng: Rng, dupRate: number): void {
  const entry = entrySocket(L);
  const doors: NumberedDoor[] = [];
  for (const s of L.sockets) {
    if (s.type !== 'door') continue;
    doors.push({ pos: s.pos, dir: s.dir, socket: s, real: true, num: 0 });
  }
  for (const f of fakeDoorsOf(L)) doors.push({ pos: f.pos, dir: f.dir, real: false, num: 0 });
  if (doors.length === 0) return;
  const origin = entry?.pos ?? doors[0].pos;
  doors.sort((a, b) => dist2D(a.pos, origin) - dist2D(b.pos, origin) || a.pos[0] - b.pos[0] || a.pos[2] - b.pos[2]);
  const floor = rng.int(2, 9);
  doors.forEach((d, i) => { d.num = floor * 100 + i + 1; });
  const original = doors.map((d) => d.num);
  // 重複: duplicateRate の割合で他の扉の（元の）番号に置換
  for (let i = 0; i < doors.length; i++) {
    if (doors.length < 2 || !rng.chance(dupRate)) continue;
    let j = rng.int(0, doors.length - 2);
    if (j >= i) j++;
    doors[i].num = original[j];
  }
  // 接続ルール: entry 以外の実扉 2 枚以上なら必ず 1 組を同番号に。1 枚なら偽扉へ写す
  const reals = doors.filter((d) => d.real && d.socket?.id !== 'entry');
  if (reals.length >= 2) {
    if (!reals.some((a) => reals.some((b) => a !== b && a.num === b.num))) {
      const a = rng.int(0, reals.length - 1);
      let b = rng.int(0, reals.length - 2);
      if (b >= a) b++;
      reals[b].num = reals[a].num;
    }
  } else if (reals.length === 1) {
    const fakes = doors.filter((d) => !d.real);
    if (fakes.length && !fakes.some((f) => f.num === reals[0].num)) rng.pick(fakes).num = reals[0].num;
  }
  const signs: SignSpec[] = [];
  doors.forEach((d, i) => {
    const text = String(d.num);
    const id = `${SIGN_PREFIX}${i}`;
    const spec = d.socket
      ? signBesideSocket(L, d.socket, PLATE_W, PLATE_Y, text, { id })
      : signBesideFake(L, d, text, id);
    if (spec) signs.push(spec);
  });
  pushSigns(L, signs);
}

/** 偽扉の脇（右側）の銘板。偽扉の幅は 0.9 として扉パネルと重ならない位置に置く */
function signBesideFake(L: RoomLayout, d: NumberedDoor, text: string, id: string): SignSpec {
  const fake: Socket = { id: '_fake', type: 'door', pos: d.pos, dir: d.dir, width: 0.9, height: 2.05 };
  return signBesideSocket(L, fake, PLATE_W, PLATE_Y, text, { id }) ?? wallSign(d.pos, d.dir, PLATE_Y + 0.35, PLATE_W, text, { id });
}

// ---------------------------------------------------------------- parking（U16）

function applyParking(L: RoomLayout, rng: Rng, dupRate: number, skipRate: number): void {
  const h = L.height;
  const columns = interiorSolids(L).filter((b) => {
    if (b.mat !== 'columnConcrete') return false;
    const [sx, sy, sz] = sizeOf(b);
    return sy >= h - 0.15 && sx <= 0.9 && sz <= 0.9;
  });
  if (columns.length === 0) return;
  const entry = entrySocket(L);
  const exits = exitSockets(L);
  const ramp = exits.find((s) => s.type === 'ramp') ?? exits[0];
  const from: Vec3 = entry?.pos ?? [0, 0, 0];
  const to: Vec3 = ramp?.pos ?? centerOf(L.bounds);
  let ux = to[0] - from[0];
  let uz = to[2] - from[2];
  const len = Math.hypot(ux, uz) || 1;
  ux /= len;
  uz /= len;
  // 軸に垂直な 2 面（軸の支配的な成分の向き）
  const faceAxisX = Math.abs(ux) >= Math.abs(uz);
  const ordered = columns
    .map((b) => { const c = centerOf(b); return { b, c, t: c[0] * ux + c[2] * uz }; })
    .sort((a, b) => a.t - b.t || a.c[0] - b.c[0] || a.c[2] - b.c[2]);
  const zone = `B${rng.int(1, 4)}`;
  let n = 1;
  const codes: string[] = [];
  let prev: string | null = null;
  let prevDup = false;
  for (let i = 0; i < ordered.length; i++) {
    if (rng.chance(skipRate)) n++; // 欠番
    let code = `${zone}-${String(n).padStart(2, '0')}`;
    // 重複（直前の番号を繰り返す。3 連続はしない）
    const dup: boolean = prev !== null && !prevDup && rng.chance(dupRate);
    if (dup) code = prev!;
    else n++;
    codes.push(code);
    prev = code;
    prevDup = dup;
  }
  const signs: SignSpec[] = [];
  const faces: Dir[] = faceAxisX ? [1, 3] : [0, 2];
  for (let i = 0; i < ordered.length; i++) {
    const { b, c } = ordered[i];
    const [sx, , sz] = sizeOf(b);
    for (const f of faces) {
      // 柱の面の外側 FACE_OFFSET。表面は f の向き
      const half = isZWall(f) ? sz / 2 : sx / 2;
      const pos = insideWall([c[0], 0, c[2]], f, -(half + 0.012));
      signs.push({ id: `${SIGN_PREFIX}${i}:${f}`, text: codes[i], pos: [pos[0], 1.15, pos[2]], dir: f, width: 0.56, kind: 'plate', color: 0x101010, background: 0xd9b52e });
    }
  }
  // 軸の手前（入口側）の柱から順に入れ、アトラス上限を超える遠い柱の面は落とす（pushSigns が切る）
  pushSigns(L, signs);
}

// ---------------------------------------------------------------- storage（R20）

interface StorageDoor {
  b: Box;
  c: Vec3;
  /** 表面（通路側）が向く方向 */
  face: Dir;
  /** 列の座標（面の法線軸）と通路沿いの座標 */
  row: number;
  t: number;
}

function storageDoorsOf(L: RoomLayout): StorageDoor[] {
  const interior = L.boxes.slice(L.shellCount ?? 0);
  const solids = interior.filter((b) => b.solid);
  const foils = interior.filter((b) => !b.solid && b.mat === 'doorMetal');
  // PropRepetition の扉板（高さ ≥ 1.6）があればそれだけ、無ければ詰め物（腰〜胸の高さの小箱）を扉と見なす
  let doors = foils.filter((b) => sizeOf(b)[1] >= 1.6);
  if (doors.length === 0) doors = foils.filter((b) => b.min[1] >= 0.9 && b.min[1] <= 2.0);
  const inSolid = (p: Vec3) => solids.some((s) => p[0] > s.min[0] && p[0] < s.max[0] && p[1] > s.min[1] && p[1] < s.max[1] && p[2] > s.min[2] && p[2] < s.max[2]);
  const out: StorageDoor[] = [];
  for (const b of doors) {
    const [sx, , sz] = sizeOf(b);
    const c = centerOf(b);
    const thinX = sx < sz;
    const probe = 0.3;
    // 棚ブロック（solid）がある側の反対が通路
    const plusBlocked = inSolid(thinX ? [c[0] + probe, c[1], c[2]] : [c[0], c[1], c[2] + probe]);
    const minusBlocked = inSolid(thinX ? [c[0] - probe, c[1], c[2]] : [c[0], c[1], c[2] - probe]);
    let face: Dir;
    if (plusBlocked && !minusBlocked) face = thinX ? 3 : 2;
    else if (minusBlocked && !plusBlocked) face = thinX ? 1 : 0;
    else face = thinX ? 1 : 0;
    out.push({ b, c, face, row: Math.round((thinX ? c[0] : c[2]) * 2) / 2, t: thinX ? c[2] : c[0] });
  }
  return out;
}

function applyStorage(L: RoomLayout, rng: Rng, dupRate: number): boolean {
  const doors = storageDoorsOf(L);
  if (doors.length === 0) return false;
  doors.sort((a, b) => a.row - b.row || a.face - b.face || a.t - b.t);
  // 列（row + face）ごとに A / B / C …、列内は 101 から
  const codes: string[] = [];
  let rowKey = '';
  let rowIdx = -1;
  let k = 0;
  for (const d of doors) {
    const key = `${d.row}:${d.face}`;
    if (key !== rowKey) { rowKey = key; rowIdx++; k = 0; }
    codes.push(`${String.fromCharCode(65 + (rowIdx % 26))}-${(rowIdx % 9 + 1) * 100 + 1 + k}`);
    k++;
  }
  const original = [...codes];
  for (let i = 0; i < doors.length; i++) {
    if (doors.length < 2 || !rng.chance(dupRate)) continue;
    let j = rng.int(0, doors.length - 2);
    if (j >= i) j++;
    codes[i] = original[j];
  }
  // サインは入口に近い順に上限まで
  const entry = entrySocket(L);
  const origin = entry?.pos ?? [0, 0, 0];
  const order = doors.map((_, i) => i).sort((a, b) => dist2D(doors[a].c, origin) - dist2D(doors[b].c, origin) || a - b);
  const signs: SignSpec[] = [];
  for (const i of order.slice(0, MAX_SIGNS)) {
    const d = doors[i];
    const [sx, sy, sz] = sizeOf(d.b);
    const w = isZWall(d.face) ? sx : sz;
    const big = sy >= 1.6;
    // 番号板は 0.7 m（文字高 ≈ 0.12 m。0.5 m では 2.5 m 先から判読できなかった）。狭い詰め物は幅の 8 割まで
    const plateW = big ? Math.min(0.7, w * 0.8) : Math.min(0.7, w * 0.8);
    // 扉板の面の 0.012 手前。大きな扉は左上寄り、詰め物は面の中央
    const front = insideWall([d.c[0], 0, d.c[2]], d.face, -((isZWall(d.face) ? sz : sx) / 2 + 0.012));
    const shift = big ? -(w / 2 - plateW / 2 - 0.15) : 0;
    const pos: Vec3 = isZWall(d.face) ? [front[0] + shift * (d.face === 0 ? -1 : 1), 0, front[2]] : [front[0], 0, front[2] + shift * (d.face === 1 ? 1 : -1)];
    const y = big ? Math.min(d.b.max[1] - 0.25, 1.95) : d.c[1];
    signs.push({ id: `${SIGN_PREFIX}${i}`, text: codes[i], pos: [pos[0], y, pos[2]], dir: d.face, width: plateW, kind: 'plate' });
  }
  pushSigns(L, signs);
  return true;
}

// ---------------------------------------------------------------- Modifier

const DuplicateNumber: ModifierImpl = {
  id: 'DuplicateNumber',
  // duplicateRate の既定は mode で変わる（duplicate 0.5 / skipAndDuplicate 0.2）ので defaults には置かない
  defaults: { mode: 'duplicate', skipRate: 0.2 },
  layout(L, p, params, rng) {
    const mode: Mode = str(params.mode, 'duplicate') === 'skipAndDuplicate' ? 'skipAndDuplicate' : 'duplicate';
    const dupRate = Math.min(1, Math.max(0, num(params.duplicateRate, mode === 'skipAndDuplicate' ? 0.2 : 0.5)));
    const skipRate = mode === 'skipAndDuplicate' ? Math.min(1, Math.max(0, num(params.skipRate, 0.2))) : 0;
    const tid = p.template.id;
    if (p.def.generator === 'ParkingGenerator' && tid === 'ParkingGrid') {
      applyParking(L, rng, dupRate, skipRate);
      return;
    }
    if (tid === 'StorageGrid' || tid === 'WarehouseGrid') {
      if (applyStorage(L, rng, dupRate)) return;
    }
    applyHotel(L, rng, dupRate);
  },
};

export default DuplicateNumber;
