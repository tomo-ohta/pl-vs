import * as THREE from 'three';
import type { Builder } from '../../scenes/Builder.ts';
import { Frame, type Mats } from './frame.ts';
import { HALL_DOORS, ROOMS, type DoorDef, type RoomDef } from './layout.ts';
import { pierSpans, roomFrame } from './roomarch.ts';
import {
  aed,
  aidBed,
  backboard,
  bench,
  bin,
  chair,
  chemTank,
  clock,
  cubicle,
  decal,
  desk,
  exitSign,
  extinguisher,
  filterTank,
  fountain,
  frontDesk,
  gates,
  lockers,
  panel,
  pipeRun,
  plant,
  pump,
  rescueBoard,
  scale,
  shelf,
  shoeLockers,
  showerStall,
  sofa,
  table,
  ticketMachine,
  vanity,
  vending,
  wallNotice,
  washbasin,
  type Dress,
} from './props.ts';

/**
 * 部屋の種類ごとの「置く物の決まり」。どの部屋も同じ描き方（白いタイル・淡い青緑・記号的な小物）で、
 * 壁ぞいの空いた所へ順に置き（扉の前は空ける）、真ん中に島（背中合わせのロッカー・テーブル）を置く。
 * Frame の向き: 壁の内側の面に沿って、正面 +z が部屋の内側。
 */
type Side = 'n' | 's' | 'w' | 'e';

/** 部屋の辺に沿う座標系（原点 = 辺の始点の床、局所 +x = 辺に沿う向き、+z = 部屋の内側） */
export function sideFrame(b: Builder, r: RoomDef, side: Side): { f: Frame; len: number; t: (world: number) => number } {
  const [x0, z0, x1, z1] = r.rect;
  const y = r.floor;
  if (side === 'n') return { f: new Frame(b, [x0, y, z0], 0), len: x1 - x0, t: (w) => w - x0 };
  if (side === 's') return { f: new Frame(b, [x1, y, z1], 2), len: x1 - x0, t: (w) => x1 - w };
  if (side === 'w') return { f: new Frame(b, [x0, y, z1], 1), len: z1 - z0, t: (w) => z1 - w };
  return { f: new Frame(b, [x1, y, z0], 3), len: z1 - z0, t: (w) => w - z0 };
}

/** 辺の上で扉・窓のある範囲（辺の座標 t。前後に clear m 空ける） */
function blocked(r: RoomDef, side: Side, t: (w: number) => number, clear: number): [number, number][] {
  // この辺の壁の線にある扉（隣の部屋の扉も。間仕切りの厚さ 0.25 m の向こう側の辺も同じ線）
  const along = side === 'n' || side === 's';
  const line = side === 'n' ? r.rect[1] : side === 's' ? r.rect[3] : side === 'w' ? r.rect[0] : r.rect[2];
  const [lo, hi] = along ? [r.rect[0], r.rect[2]] : [r.rect[1], r.rect[3]];
  const out: [number, number][] = [];
  const add = (a: number, b: number): void => {
    if (b < lo || a > hi) return;
    const ta = t(a);
    const tb = t(b);
    out.push([Math.min(ta, tb) - clear, Math.max(ta, tb) + clear]);
  };
  for (const o of ROOMS) {
    for (const d of o.doors) {
      const dAlong = d.side === 'n' || d.side === 's';
      if (dAlong !== along) continue;
      const dl = d.side === 'n' ? o.rect[1] : d.side === 's' ? o.rect[3] : d.side === 'w' ? o.rect[0] : o.rect[2];
      if (Math.abs(dl - line) > 1.05 || Math.abs(o.floor - r.floor) > 1) continue;
      add(d.a, d.b);
    }
  }
  for (const h of HALL_DOORS) {
    if ((h.wall === 'x') !== along) continue;
    const hl = along ? h.at[1] : h.at[0];
    if (Math.abs(hl - line) > 1.05) continue;
    const m = along ? h.at[0] : h.at[1];
    add(m - h.width / 2, m + h.width / 2);
  }
  // 壁の柱型（roomarch.ts）
  for (const [a, b] of pierSpans(r, side)) {
    const ta = t(a);
    const tb = t(b);
    out.push([Math.min(ta, tb) - 0.05, Math.max(ta, tb) + 0.05]);
  }
  return out;
}

/**
 * 壁ぞいに物を順に置く。items は幅と置く関数（局所の座標系 f は中心が物の中心・背が壁）。
 * 扉の前・角（corner m）は空ける。置けた数を返す
 */
export function along(b: Builder, r: RoomDef, side: Side, items: { w: number; put: (f: Frame) => void }[], o: { corner?: number; clear?: number; gap?: number; from?: number; to?: number; depth?: number } = {}): number {
  const { f, len, t } = sideFrame(b, r, side);
  const bl = blocked(r, side, t, o.clear ?? 0.6);
  let x = o.from ?? o.corner ?? 0.3;
  const end = o.to ?? len - (o.corner ?? 0.3);
  let n = 0;
  for (const it of items) {
    let placed = false;
    while (x + it.w <= end) {
      const hit = bl.find(([a, c]) => x + it.w > a && x < c);
      if (hit) {
        x = hit[1];
        continue;
      }
      it.put(f.sub(x + it.w / 2, o.depth ?? 0, 0));
      x += it.w + (o.gap ?? 0);
      placed = true;
      n++;
      break;
    }
    if (!placed) break;
  }
  return n;
}

/** 扉の真ん中の、壁の内側の座標系（扉の上の表示を置く） */
function overDoor(b: Builder, r: RoomDef, dd: DoorDef): Frame {
  const { f, t } = sideFrame(b, r, dd.side);
  return f.sub(t((dd.a + dd.b) / 2), 0);
}

/** 部屋の中の座標系（局所 = 場面の向き。原点は部屋の床の (x, z)） */
function at(b: Builder, r: RoomDef, x: number, z: number, k = 0): Frame {
  return new Frame(b, [x, r.floor, z], k);
}

export interface FurnishMats {
  wood: THREE.Material;
  sauna: THREE.Material;
  plantWall: THREE.Material;
  plantFloor: THREE.Material;
  mat: THREE.Material;
  carpet: THREE.Material;
}

export function furnishMats(m: Mats): FurnishMats {
  return {
    wood: m.get({ name: 'f-wood', color: '#d8c7a2', shade: '#b9a684', dark: '#9c8a6c', hi: '#e2d3b2', tiles: { size: [0.09, 2.4], line: 0.006, color: '#b5a07c' } }),
    sauna: m.get({ name: 'f-sauna', color: '#c9bc9c', shade: '#ada283', dark: '#8f866c', hi: '#d5caad', tiles: { size: [2.4, 0.09], line: 0.006, color: '#a68e68' } }),
    plantWall: m.get({ name: 'f-plantWall', color: '#d3dcd6', shade: '#b4c2ba', dark: '#94a69c', hi: '#dde4df' }),
    plantFloor: m.get({ name: 'f-plantFloor', color: '#c9d8cf', shade: '#3f6b67', dark: '#335c59', hi: '#d5e1da', tiles: { size: 0.6, line: 0.014, color: '#a9bcb0' } }),
    mat: m.flat('#6f9a95', '#5a827d'),
    carpet: m.flat('#9cb8b0', '#83a199'),
  };
}

/** 部屋に物を置く（種類ごと） */
export function furnishRoom(b: Builder, d: Dress, fm: FurnishMats, r: RoomDef): void {
  const [x0, z0, x1, z1] = r.rect;
  const W = x1 - x0;
  const D = z1 - z0;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const lock = (n: number, rows = 3, h = 1.8) => ({ w: n * 0.4, put: (f: Frame) => lockers(d, f, n, rows, Math.floor(d.r() * 400) + 1, 0.4, h) });
  const notices = (side: Side, list: { w: number; put: (f: Frame) => void }[], from = 0.4) => along(b, r, side, list, { from, gap: 0.3, clear: 0.4 });
  const nt = (seed: number) => ({ w: 0.6, put: (f: Frame) => wallNotice(d, f, d.signs.notice(seed), 0.55, 0.73, 1.55) });
  const ct = (seed: number, kind: 'dive' | 'run' | 'general' = 'general') => ({ w: 0.5, put: (f: Frame) => wallNotice(d, f, d.signs.caution(seed, kind), 0.45, 0.56, 1.55) });

  switch (r.kind) {
    case 'changing': {
      // 壁ぞいにロッカー、真ん中に背中合わせのロッカーとベンチの島。奥の壁に化粧台・脱水機・体重計
      along(b, r, 'w', [lock(6, 3), lock(6, 3), lock(6, 3), lock(6, 3), lock(6, 3)], { corner: 0.4, gap: 0.0 });
      along(b, r, 'e', [lock(6, 3), lock(6, 3), lock(6, 3), lock(6, 3), lock(6, 3)], { corner: 0.4, gap: 0.0 });
      along(b, r, 'n', [{ w: 4.0, put: (f) => vanity(d, f, 4.0) }, { w: 0.7, put: (f) => scale(d, f.sub(0, 0.6)) }, { w: 0.9, put: (f) => spinner(d, f) }, { w: 0.6, put: (f) => fountain(d, f.sub(0, 0.25)) }], { corner: 0.6, gap: 0.4 });
      for (const zc of [cz - D * 0.22, cz + D * 0.18]) {
        const f = at(b, r, cx, zc, 0);
        // 背中合わせ（扉は外向き）
        lockers(d, f.sub(0, 0.5, 0), 8, 3, Math.floor(d.r() * 400) + 1, 0.4, 1.5);
        lockers(d, f.sub(0, -0.5, 2), 8, 3, Math.floor(d.r() * 400) + 1, 0.4, 1.5);
        bench(d, f.sub(0, 1.25, 0), 2.6, 0.38);
        bench(d, f.sub(0, -1.25, 0), 2.6, 0.38);
        // 島の両端と上はタイル張りの塊（端は青緑の帯）
        for (const sx of [-1, 1]) {
          f.box(d.p.whiteTile, [sx * 1.6, 0, -0.55], [sx * 1.85, 1.62, 0.55], { shadow: true, collide: true });
          f.box(d.p.teal, [sx * 1.6, 0, -0.56], [sx * 1.86, 0.16, 0.56], { shadow: true });
        }
        f.box(d.p.whiteTile, [-1.85, 1.5, -0.55], [1.85, 1.62, 0.55], { shadow: true });
      }
      // 床の敷物（水着の水を受ける）
      at(b, r, cx, cz, 0).box(fm.mat, [-1.2, 0.0, -D * 0.42], [1.2, 0.012, D * 0.42], { shadow: 'receive' });
      notices('s', [nt(r.id.length * 7 + 1), ct(r.id.length * 7 + 2), nt(r.id.length * 7 + 3)], 3.2);
      clock(d, sideFrame(b, r, 's').f.sub(W / 2 + 2.5, 0), 2.35, 0.22);
      if (r.doors[0]) exitSign(d, overDoor(b, r, r.doors[0]), 2.45);
      break;
    }
    case 'shower': {
      // 通過式: 両側の壁にシャワーのブース、真ん中が通路。床の排水の溝
      for (const side of ['w', 'e'] as Side[]) {
        const n = Math.floor((D - 0.8) / 1.0);
        along(b, r, side, Array.from({ length: n }, (_, i) => ({ w: 1.0, put: (f: Frame) => showerStall(d, f.sub(0, 0.85), 1.0, 0.85, i === 0, true) })), { corner: 0.4, gap: 0 });
      }
      at(b, r, cx, cz, 0).box(d.p.dark, [-0.12, 0.0, -D / 2 + 0.3], [0.12, 0.008, D / 2 - 0.3], { shadow: 'receive' });
      for (let z = -D / 2 + 0.5; z < D / 2 - 0.3; z += 0.08) at(b, r, cx, cz, 0).box(d.p.steel, [-0.12, 0.008, z - 0.012], [0.12, 0.012, z + 0.012], { shadow: 'receive' });
      decal(sideFrame(b, r, 's').f.sub(W / 2 - 2.6, 0), d.signs.label('シャワーを浴びてから'), [0, 2.2, 0.01], 1.6, 0.4);
      break;
    }
    case 'guard': {
      // プールを見る窓の前に机と端末・無線、壁に救助の道具・AED・掲示
      along(b, r, 'n', [{ w: 3.0, put: (f) => { desk(d, f.sub(-0.75, 0.4), 1.4); desk(d, f.sub(0.75, 0.4), 1.4); } }, { w: 3.0, put: (f) => { desk(d, f.sub(-0.75, 0.4), 1.4); desk(d, f.sub(0.75, 0.4), 1.4); } }], { from: 1.4, gap: 1.0 });
      along(b, r, 'w', [{ w: 0.8, put: (f) => backboard(d, f) }, { w: 1.0, put: (f) => rescueBoard(d, f) }, { w: 0.6, put: (f) => aed(d, f) }, { w: 1.2, put: (f) => shelf(d, f.sub(0, 0.5), 1.1, 1.9, 0.5, 'float') }], { corner: 0.5, gap: 0.3 });
      along(b, r, 's', [lock(5, 2), { w: 1.6, put: (f) => wallNotice(d, f, d.signs.board(61), 1.5, 0.95, 1.6) }, { w: 1.3, put: (f) => shelf(d, f.sub(0, 0.45), 1.2, 1.8, 0.45, 'mixed') }], { corner: 0.5, gap: 0.4 });
      table(d, at(b, r, x0 + W * 0.65, cz + 1.0, 0), 1.6, 0.8);
      for (const dx of [-0.5, 0.5]) chair(d, at(b, r, x0 + W * 0.65 + dx, cz + 1.75, 2));
      clock(d, sideFrame(b, r, 'e').f.sub(D / 2, 0), 2.3, 0.22);
      break;
    }
    case 'staff': {
      along(b, r, 'w', [lock(5, 2), lock(5, 2), lock(5, 2)], { corner: 0.5 });
      along(b, r, 'n', [{ w: 2.4, put: (f) => kitchenette(d, f, 2.4) }, { w: 0.7, put: (f) => fridge(d, f) }, { w: 1.0, put: (f) => vending(d, f.sub(0, 0.35), 'water') }], { corner: 0.6, gap: 0.3 });
      along(b, r, 'e', [{ w: 2.2, put: (f) => sofa(d, f.sub(0, 0.45), 2.0) }, { w: 1.6, put: (f) => wallNotice(d, f, d.signs.board(62), 1.5, 0.95, 1.6) }], { corner: 1.0, gap: 0.8 });
      const t = at(b, r, cx, cz, 0);
      table(d, t, 2.0, 0.9);
      for (const dx of [-0.6, 0.6]) {
        chair(d, t.sub(dx, -0.75, 0));
        chair(d, t.sub(dx, 0.75, 2));
      }
      clock(d, sideFrame(b, r, 's').f.sub(W * 0.3, 0), 2.3, 0.22);
      break;
    }
    case 'lobby': {
      if (r.id === 'entrance') {
        // 入口: 下足箱・券売機・受付の窓口（北の事務室）・入場ゲート（西の通路の口）・ベンチ・自販機・案内図
        along(b, r, 'e', [{ w: 3.0, put: (f) => shoeLockers(d, f, 10, 6, 1) }, { w: 3.0, put: (f) => shoeLockers(d, f, 10, 6, 61) }, { w: 3.0, put: (f) => shoeLockers(d, f, 10, 6, 121) }], { from: 2.4, gap: 0.2 });
        along(b, r, 's', [{ w: 3.0, put: (f) => shoeLockers(d, f, 10, 6, 181) }, { w: 3.0, put: (f) => shoeLockers(d, f, 10, 6, 241) }], { from: 0.6, gap: 0.3 });
        along(b, r, 'n', [{ w: 1.0, put: (f) => ticketMachine(d, f.sub(0, 0.35)) }, { w: 1.0, put: (f) => ticketMachine(d, f.sub(0, 0.35)) }], { from: 0.6, gap: 0.3, clear: 0.2 });
        frontDesk(d, at(b, r, (25 + 31) / 2, z0 + 0.6, 0), 6.0);
        along(b, r, 'n', [{ w: 1.0, put: (f) => vending(d, f.sub(0, 0.35), 'drink') }, { w: 1.0, put: (f) => vending(d, f.sub(0, 0.35), 'water') }, { w: 1.6, put: (f) => wallNotice(d, f, d.signs.map(71), 1.5, 1.12, 1.7) }], { from: 11.0, gap: 0.3 });
        gates(d, at(b, r, x0 + 1.6, 35.5, 1), 2, 0.9);
        for (const z of [29.5, 32.5]) bench(d, at(b, r, cx + 2.0, z, 0), 2.4, 0.42);
        plant(d, at(b, r, x1 - 0.6, z1 - 3.0, 0), 1.2);
        plant(d, at(b, r, x0 + 0.7, z1 - 0.7, 0), 1.2);
        decal(sideFrame(b, r, 'w').f.sub(D - 4.6, 0), d.signs.label('更衣室', '←'), [0, 2.6, 0.01], 1.4, 0.35);
        decal(sideFrame(b, r, 'n').f.sub(5.5, 0), d.signs.label('受付'), [0, 2.4, 0.01], 1.0, 0.25);
        exitSign(d, overDoor(b, r, r.doors[0]), 2.6);
        clock(d, sideFrame(b, r, 'n').f.sub(9.5, 0), 2.9, 0.28);
      } else {
        // 休憩コーナー: ベンチ・自販機・給水器・コインロッカー・植木・案内・時計
        along(b, r, 'w', [lock(6, 4, 1.6), { w: 1.0, put: (f) => vending(d, f.sub(0, 0.35), 'drink') }, { w: 1.0, put: (f) => vending(d, f.sub(0, 0.35), 'water') }, { w: 0.6, put: (f) => fountain(d, f.sub(0, 0.2)) }], { corner: 0.4, gap: 0.3 });
        for (const z of [cz - 2.5, cz + 1.0]) {
          bench(d, at(b, r, cx + 1.5, z, 0), 2.6, 0.42);
          bench(d, at(b, r, cx + 1.5, z + 1.1, 0), 2.6, 0.42);
        }
        plant(d, at(b, r, x1 - 0.7, z1 - 0.7, 0), 1.1);
        plant(d, at(b, r, x1 - 0.7, z0 + 0.7, 0), 1.1);
        notices('n', [{ w: 1.6, put: (f) => wallNotice(d, f, d.signs.map(72), 1.5, 1.12, 1.7) }, nt(73), ct(74)], 4.0);
        clock(d, sideFrame(b, r, 's').f.sub(W * 0.3, 0), 2.6, 0.25);
        along(b, r, 's', [{ w: 0.5, put: (f) => extinguisher(d, f.sub(0, 0.2)) }, { w: 0.6, put: (f) => bin(d, f.sub(0, 0.3)) }], { from: 0.5, gap: 0.4 });
      }
      break;
    }
    case 'office': {
      along(b, r, 'n', [{ w: 1.3, put: (f) => shelf(d, f.sub(0, 0.45), 1.2, 1.9, 0.45, 'box') }, { w: 1.3, put: (f) => shelf(d, f.sub(0, 0.45), 1.2, 1.9, 0.45, 'box') }, { w: 1.6, put: (f) => wallNotice(d, f, d.signs.board(81), 1.5, 0.95, 1.6) }, { w: 1.3, put: (f) => shelf(d, f.sub(0, 0.45), 1.2, 1.9, 0.45, 'box') }], { corner: 0.4, gap: 0.3 });
      for (const dx of [-2.6, 0, 2.6]) for (const dz of [-1.6, 1.0]) desk(d, at(b, r, cx + dx, cz + dz, dz < 0 ? 0 : 2), 1.4);
      along(b, r, 'w', [{ w: 1.0, put: (f) => panel(d, f, 0.9) }, { w: 0.6, put: (f) => extinguisher(d, f.sub(0, 0.2)) }], { corner: 1.0, gap: 0.6 });
      clock(d, sideFrame(b, r, 'e').f.sub(D / 2, 0), 2.3, 0.22);
      break;
    }
    case 'store': {
      along(b, r, 'n', [{ w: 2.0, put: (f) => shelf(d, f.sub(0, 0.55), 1.9, 2.1, 0.55, 'float') }, { w: 2.0, put: (f) => shelf(d, f.sub(0, 0.55), 1.9, 2.1, 0.55, 'float') }, { w: 2.0, put: (f) => shelf(d, f.sub(0, 0.55), 1.9, 2.1, 0.55, 'mixed') }, { w: 2.0, put: (f) => shelf(d, f.sub(0, 0.55), 1.9, 2.1, 0.55, 'box') }, { w: 2.0, put: (f) => shelf(d, f.sub(0, 0.55), 1.9, 2.1, 0.55, 'mixed') }], { corner: 0.4, gap: 0.2 });
      along(b, r, 'w', [{ w: 2.0, put: (f) => ropeReel(d, f.sub(0, 0.9)) }, { w: 2.0, put: (f) => ropeReel(d, f.sub(0, 0.9)) }], { corner: 0.5, gap: 0.3 });
      along(b, r, 'e', [{ w: 1.2, put: (f) => cleaner(d, f.sub(0, 0.6)) }, { w: 1.2, put: (f) => stackedChairs(d, f.sub(0, 0.4)) }, { w: 1.2, put: (f) => stackedChairs(d, f.sub(0, 0.4)) }], { corner: 0.5, gap: 0.3 });
      // 真ん中: 台車に積んだビート板・浮きの山（2 列）と、コースロープの巻き取り台
      for (const [dx, dz] of [[-1.6, -1.0], [1.6, -1.0], [-1.6, 1.4]] as [number, number][]) {
        const t = at(b, r, cx + dx, cz + dz, 0);
        t.box(d.p.steel, [-0.6, 0.08, -0.45], [0.6, 0.14, 0.45], { shadow: true, collide: true });
        for (const wx of [-0.5, 0.5]) for (const wz of [-0.35, 0.35]) t.cyl(d.p.dark, [wx, 0.05, wz], 0.05, 0.04, { axis: 'x', segments: 8 });
        let y = 0.14;
        for (let i = 0; i < 9; i++) {
          const mat = i % 3 === 0 ? d.p.float : i % 3 === 1 ? d.p.teal : d.p.white;
          const h = 0.035 + d.r() * 0.01;
          const o = (d.r() - 0.5) * 0.06;
          t.box(mat, [-0.5 + o, y, -0.33 - o], [0.5 + o, y + h, 0.33 - o], { shadow: true });
          y += h + 0.004;
        }
      }
      ropeReel(d, at(b, r, cx + 1.6, cz + 1.6, 0));
      break;
    }
    case 'plant': {
      if (r.closed) break;
      // 床と壁を機械室の色に（塗装の床・灰色の壁）
      at(b, r, cx, cz, 0).box(fm.plantFloor, [-W / 2, 0, -D / 2], [W / 2, 0.01, D / 2], { shadow: 'receive' });
      // ろ過装置 3 基（北）・ポンプ 4 台（真ん中）・薬品の槽・制御盤（西の壁）・配管（天井の近く）
      const tanks: [number, number][] = [[x0 + 4, z0 + 4], [x0 + 9, z0 + 4], [x0 + 14, z0 + 4], [x0 + 19, z0 + 4], [x0 + 24, z0 + 4]];
      // 受水槽（パネルの升目の箱・はしご）
      const wt = at(b, r, x0 + 20.5, z0 + 11.5, 0);
      wt.box(d.p.white, [-2.2, 0.3, -1.6], [2.2, 2.7, 1.6], { shadow: true, collide: true });
      for (let x = -2.0; x < 2.2; x += 0.5) wt.box(d.p.pale, [x - 0.015, 0.3, 1.6], [x + 0.015, 2.7, 1.62], { shadow: false });
      for (let y = 0.8; y < 2.7; y += 0.5) wt.box(d.p.pale, [-2.2, y - 0.015, 1.6], [2.2, y + 0.015, 1.62], { shadow: false });
      wt.box(d.p.floorDark, [-2.4, 0, -1.8], [2.4, 0.3, 1.8], { shadow: true, collide: true });
      for (let y = 0.4; y < 2.8; y += 0.3) wt.box(d.p.steel, [2.2, y - 0.015, -0.3], [2.45, y + 0.015, 0.3], { shadow: true });
      for (const z of [-0.3, 0.3]) wt.box(d.p.steel, [2.42, 0.3, z - 0.02], [2.46, 2.9, z + 0.02], { shadow: true });
      for (const [x, z] of tanks) filterTank(d, at(b, r, x, z, 0), 1.3, 2.2);
      for (let i = 0; i < 4; i++) pump(d, at(b, r, x0 + 4 + i * 3.2, z0 + 11, 0));
      for (let i = 0; i < 2; i++) chemTank(d, at(b, r, x1 - 2.0 - i * 1.4, z1 - 3.0, 2));
      along(b, r, 'w', [{ w: 1.0, put: (f) => panel(d, f, 0.9) }, { w: 1.0, put: (f) => panel(d, f, 0.9) }, { w: 1.0, put: (f) => panel(d, f, 0.9) }, { w: 1.0, put: (f) => panel(d, f, 0.9) }], { from: 9.0, gap: 0.1 });
      along(b, r, 'e', [{ w: 3.0, put: (f) => heatExchanger(d, f.sub(0, 0.8)) }, { w: 2.2, put: (f) => shelf(d, f.sub(0, 0.5), 2.0, 2.0, 0.5, 'box') }], { corner: 3.0, gap: 1.0 });
      const pf = at(b, r, 0, 0, 0);
      // 配管は梁の下を通す
      const yP = (roomFrame(r)?.bottom ?? r.ceil) - 0.32;
      for (const [x, z] of tanks) pipeRun(d, pf, [[x, 2.9, z], [x, yP, z], [x, yP, z0 + 8], [x0 + 4 + 3.2 * Math.round((x - x0 - 4) / 3.2), yP, z0 + 8], [x0 + 4 + 3.2 * Math.round((x - x0 - 4) / 3.2), 1.25, z0 + 11]], 0.1, d.p.pipeBlue);
      pipeRun(d, pf, [[x0 + 1.0, yP - 0.4, z0 + 7.0], [x1 - 1.0, yP - 0.4, z0 + 7.0]], 0.14);
      pipeRun(d, pf, [[x0 + 1.0, yP - 0.75, z0 + 14.0], [x1 - 1.0, yP - 0.75, z0 + 14.0]], 0.12, d.p.pipeBlue);
      for (let i = 0; i < 4; i++) pipeRun(d, pf, [[x0 + 4 + i * 3.2 + 0.32, 1.32, z0 + 11], [x0 + 4 + i * 3.2 + 0.32, yP - 0.75, z0 + 11], [x0 + 4 + i * 3.2 + 0.32, yP - 0.75, z0 + 14]], 0.08);
      extinguisher(d, at(b, r, x0 + 1.0, z1 - 1.0, 0));
      decal(sideFrame(b, r, 'w').f.sub(D - 3.6, 0), d.signs.label('機械室'), [0, 2.5, 0.01], 1.0, 0.25);
      along(b, r, 'w', [ct(91), nt(92)], { from: D - 6.5, gap: 0.3, clear: 0.2 });
      break;
    }
    case 'toilet': {
      const n = Math.floor((W - 1.0) / 1.0);
      along(b, r, 'n', Array.from({ length: Math.min(n, 5) }, (_, i) => ({ w: 1.0, put: (f: Frame) => cubicle(d, f.sub(0, 1.4), 1.0, 1.4, i === 0) })), { corner: 0.6, gap: 0 });
      const ws = r.doors[0]?.side === 's' ? 'e' : 's';
      along(b, r, ws, [{ w: 0.7, put: (f) => washbasin(d, f.sub(0, 0.45)) }, { w: 0.7, put: (f) => washbasin(d, f.sub(0, 0.45)) }, { w: 0.6, put: (f) => handDryer(d, f) }], { corner: 0.6, gap: 0.2 });
      break;
    }
    case 'sauna': {
      // 採暖室: タイル張りの段々の腰掛け（白いタイルの塊を 2 段に積む。縁は青緑のタイル）・暖房器と柵・温度計・時計。
      // 参考画像の「タイルの塊の段々」と同じ言葉で作る（木の内張りは使わない）
      const f = at(b, r, 0, 0, 0);
      const xa = x0 + 0.05;
      const xb = x1 - 1.9;
      const tier = (xl: number, xr: number, za: number, zb: number, h: number): void => {
        f.box(d.p.whiteTile, [xl, 0, za], [xr, h - 0.06, zb], { shadow: true, collide: true });
        f.box(d.p.teal, [xl - (xl > xa ? 0.03 : 0), h - 0.06, za - 0.03], [xr, h, zb], { shadow: true, collide: true });
      };
      tier(xa, xb, z1 - 1.05, z1 - 0.05, 0.45);
      tier(xa, xb, z1 - 0.55, z1 - 0.05, 0.9);
      // 西の壁ぞいの低い段（L 字に回す）
      tier(xa, xa + 0.9, z0 + 0.4, z1 - 1.05, 0.45);
      // 段の切れ目（タイルの塊の継ぎ目に見える縦の溝）
      for (let x = xa + 2.0; x < xb - 0.5; x += 2.0) f.box(d.p.tealDark, [x - 0.02, 0.0, z1 - 1.06], [x + 0.02, 0.44, z1 - 1.04], { shadow: false });
      // 暖房器（暗い箱）と柵
      f.box(d.p.dark, [x1 - 1.4, 0, z1 - 1.1], [x1 - 0.4, 0.75, z1 - 0.3], { shadow: true, collide: true });
      for (let i = 0; i < 6; i++) f.box(d.p.steel, [x1 - 1.35 + i * 0.17, 0.75, z1 - 1.05], [x1 - 1.25 + i * 0.17, 0.85, z1 - 0.35], { shadow: true });
      for (let x = x1 - 1.7; x <= x1 - 0.1; x += 0.2) f.box(d.p.steel, [x - 0.02, 0, z1 - 1.5], [x + 0.02, 1.0, z1 - 1.46], { shadow: true });
      f.box(d.p.steel, [x1 - 1.72, 0.96, z1 - 1.52], [x1 - 0.08, 1.0, z1 - 1.44], { shadow: true });
      // 温度計・時計・注意
      f.box(d.p.white, [x1 - 0.6, 1.5, z0 + 0.02], [x1 - 0.4, 1.9, z0 + 0.06], { shadow: false });
      f.box(d.p.red, [x1 - 0.51, 1.55, z0 + 0.06], [x1 - 0.49, 1.85, z0 + 0.07], { shadow: false });
      clock(d, sideFrame(b, r, 'n').f.sub(W / 2 + 2.0, 0.06), 1.9, 0.16);
      along(b, r, 'n', [ct(141), nt(142)], { from: 1.0, gap: 0.3, clear: 0.3 });
      break;
    }
    case 'aid': {
      aidBed(d, at(b, r, x0 + 1.2, cz, 1));
      along(b, r, 'e', [{ w: 1.0, put: (f) => shelf(d, f.sub(0, 0.45), 0.9, 1.8, 0.45, 'box') }], { corner: 0.4 });
      along(b, r, 'n', [{ w: 1.6, put: (f) => desk(d, f.sub(0, 0.4), 1.4) }, { w: 0.7, put: (f) => washbasin(d, f) }, { w: 0.6, put: (f) => aed(d, f) }], { corner: 0.4, gap: 0.3 });
      along(b, r, 's', [{ w: 0.8, put: (f) => backboard(d, f) }, { w: 0.6, put: (f) => wallNotice(d, f, d.signs.notice(101), 0.55, 0.73, 1.55) }], { corner: 0.5, gap: 0.3 });
      break;
    }
    case 'corridor': {
      if (r.id === 'hallway') {
        notices('n', [nt(111), ct(112, 'run'), nt(113), { w: 1.6, put: (f) => wallNotice(d, f, d.signs.board(114), 1.5, 0.95, 1.6) }], 6.0);
        decal(sideFrame(b, r, 'n').f.sub(3.0, 0), d.signs.label('男子更衣室'), [0, 2.4, 0.01], 1.3, 0.32);
        decal(sideFrame(b, r, 'n').f.sub(20.5, 0), d.signs.label('女子更衣室'), [0, 2.4, 0.01], 1.3, 0.32);
        decal(sideFrame(b, r, 'n').f.sub(13.0, 0), d.signs.label('スタッフ室', '←'), [0, 2.4, 0.01], 1.3, 0.32);
        extinguisher(d, at(b, r, x0 + 0.5, z1 - 0.4, 0));
        along(b, r, 's', [{ w: 2.6, put: (f) => bench(d, f.sub(0, 0.3), 2.4, 0.4) }, { w: 2.6, put: (f) => bench(d, f.sub(0, 0.3), 2.4, 0.4) }], { from: 8.0, gap: 6.0 });
      } else {
        extinguisher(d, at(b, r, x0 + 0.4, z0 + 1.0, 0));
        notices('w', [nt(121), { w: 1.6, put: (f) => wallNotice(d, f, d.signs.map(122), 1.5, 1.12, 1.7) }], 4.0);
      }
      break;
    }
    case 'lounge': {
      // 2 階の休憩ラウンジ: 軽食の売り場（カウンター）・テーブルと椅子・ソファ・自販機・北の窓
      const f = at(b, r, 0, 0, 0);
      f.box(d.p.white, [x1 - 7.0, 0, z0 + 1.0], [x1 - 1.0, 1.0, z0 + 1.6], { shadow: true, collide: true });
      f.box(d.p.teal, [x1 - 7.05, 1.0, z0 + 0.95], [x1 - 0.95, 1.05, z0 + 1.65], { shadow: true });
      f.box(d.p.pale, [x1 - 7.0, 0, z0 + 0.05], [x1 - 1.0, 0.9, z0 + 0.6], { shadow: true, collide: true });
      decal(sideFrame(b, r, 'n').f.sub(W - 4.0, 0), d.signs.label('軽食'), [0, 2.6, 0.01], 1.2, 0.3);
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 3; j++) {
          const t = at(b, r, x0 + 4.0 + i * 3.6, z0 + 5.0 + j * 3.4, 0);
          table(d, t, 1.2, 0.8);
          for (const dz of [-0.65, 0.65]) chair(d, t.sub(0, dz, dz < 0 ? 0 : 2));
        }
      along(b, r, 's', [{ w: 2.4, put: (f2) => sofa(d, f2.sub(0, 0.45), 2.2) }, { w: 2.4, put: (f2) => sofa(d, f2.sub(0, 0.45), 2.2) }, { w: 1.0, put: (f2) => vending(d, f2.sub(0, 0.35), 'drink') }, { w: 1.0, put: (f2) => vending(d, f2.sub(0, 0.35), 'water') }], { from: 1.0, gap: 0.6 });
      plant(d, at(b, r, x0 + 0.8, z1 - 0.8, 0), 1.2);
      plant(d, at(b, r, x1 - 0.8, z1 - 0.8, 0), 1.2);
      clock(d, sideFrame(b, r, 'w').f.sub(D / 2 - 2.0, 0), 3.0, 0.3);
      for (const dd of r.doors) exitSign(d, overDoor(b, r, dd), 2.7);
      break;
    }
  }
}

// ---------------------------------------------------------------- 部屋だけの物

/** 水着の脱水機（白い円筒の箱・ふた） */
function spinner(d: Dress, f: Frame): void {
  f.box(d.p.white, [-0.3, 0, -0.55], [0.3, 0.85, -0.05], { shadow: true, collide: true });
  f.cyl(d.p.metal, [0, 0.86, -0.3], 0.2, 0.02, { segments: 16 });
  f.box(d.p.dark, [-0.08, 0.6, -0.05], [0.08, 0.7, -0.04], { shadow: false });
}

/** 流しと電子レンジ・ポットの台 */
function kitchenette(d: Dress, f: Frame, w: number): void {
  f.box(d.p.white, [-w / 2, 0, -0.6], [w / 2, 0.85, 0], { shadow: true, collide: true });
  f.box(d.p.chrome, [-0.5, 0.86, -0.5], [0.0, 0.88, -0.1], { shadow: false });
  f.box(d.p.white, [0.3, 0.86, -0.55], [0.8, 1.15, -0.2], { shadow: true });
  f.box(d.p.dark, [0.35, 0.92, -0.2], [0.65, 1.1, -0.19], { shadow: false });
  f.box(d.p.pale, [-w / 2, 1.5, -0.35], [w / 2, 2.2, 0], { shadow: true });
}

/** 冷蔵庫 */
function fridge(d: Dress, f: Frame): void {
  f.box(d.p.white, [-0.3, 0, -0.65], [0.3, 1.75, 0], { shadow: true, collide: true });
  f.box(d.p.metal, [0.22, 0.9, 0], [0.25, 1.4, 0.03], { shadow: false });
}

/** 手を乾かす機械 */
function handDryer(d: Dress, f: Frame): void {
  f.box(d.p.white, [-0.15, 1.0, -0.2], [0.15, 1.5, 0], { shadow: true });
  f.box(d.p.dark, [-0.12, 1.02, -0.18], [0.12, 1.06, -0.02], { shadow: false });
}

/** コースロープの巻き取り台（大きな筒に巻いたロープ） */
function ropeReel(d: Dress, f: Frame): void {
  for (const x of [-0.8, 0.8]) f.box(d.p.steel, [x - 0.04, 0, -0.5], [x + 0.04, 1.0, 0.5], { shadow: true, collide: true });
  f.cyl(d.p.rope, [0, 0.75, 0], 0.32, 1.5, { axis: 'x', segments: 18 });
  f.cyl(d.p.ropeRed, [-0.6, 0.75, 0], 0.33, 0.2, { axis: 'x', segments: 18 });
  f.cyl(d.p.ropeRed, [0.6, 0.75, 0], 0.33, 0.2, { axis: 'x', segments: 18 });
  for (const x of [-0.8, 0.8]) for (const z of [-0.45, 0.45]) f.cyl(d.p.dark, [x, 0.06, z], 0.06, 0.05, { axis: 'x', segments: 10 });
}

/** プール清掃機（水中掃除機の箱とホース） */
function cleaner(d: Dress, f: Frame): void {
  f.box(d.p.teal, [-0.35, 0, -0.3], [0.35, 0.4, 0.3], { shadow: true, collide: true });
  f.cyl(d.p.dark, [0, 0.55, 0], 0.25, 0.25, { axis: 'z', segments: 16 });
}

/** 重ねた椅子 */
function stackedChairs(d: Dress, f: Frame): void {
  for (let i = 0; i < 6; i++) f.box(d.p.pale, [-0.22, 0.43 + i * 0.07, -0.2], [0.22, 0.47 + i * 0.07, 0.22], { shadow: true });
  for (const x of [-0.2, 0.2]) f.box(d.p.metal, [x - 0.012, 0, -0.18], [x + 0.012, 0.85, -0.16], { shadow: true });
  f.box(d.p.pale, [-0.2, 0.85, -0.22], [0.2, 1.2, -0.19], { shadow: true });
}

/** 熱交換器（横長の胴と管） */
function heatExchanger(d: Dress, f: Frame): void {
  f.cyl(d.p.metal, [0, 0.9, 0], 0.45, 2.6, { axis: 'x', segments: 18 });
  for (const x of [-1.0, 1.0]) f.box(d.p.steel, [x - 0.1, 0, -0.35], [x + 0.1, 0.5, 0.35], { shadow: true, collide: true });
  f.cyl(d.p.pipeBlue, [-0.8, 1.6, 0], 0.08, 0.6, { segments: 10 });
  f.cyl(d.p.pipe, [0.8, 1.6, 0], 0.08, 0.6, { segments: 10 });
}

/**
 * 床に置いた物の下の深い影（描いた接地の影）。部屋の天井の影で日なたが無い所でも、物の足元に深い青緑の帯を引く。
 * 部屋の物（b.root の中で、床から立ち上がる小さめの物）の足元の外形を少し広げて床に貼る
 */
export function contactShadows(b: Builder, r: RoomDef, mat: THREE.Material): void {
  const y0 = r.floor;
  const boxes: THREE.Box3[] = [];
  b.root.updateMatrixWorld(true);
  for (const ob of b.root.children) {
    const mesh = ob as THREE.Mesh;
    if (!mesh.isMesh || mesh.name.startsWith('gobo')) continue;
    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
    const sx = bb.max.x - bb.min.x;
    const sz = bb.max.z - bb.min.z;
    // 床から 0.6 m 以内に下端があり、0.25 m より高く立ち上がる、4 m より小さい物
    if (bb.min.y > y0 + 0.6 || bb.max.y < y0 + 0.25 || bb.min.y < y0 - 0.05 || Math.max(sx, sz) > 4.2 || Math.min(sx, sz) < 0.015) continue;
    if (bb.max.y > r.ceil - 0.2) continue;
    boxes.push(bb);
  }
  const [x0, z0, x1, z1] = r.rect;
  for (const bb of boxes) {
    const m = 0.07;
    const a = new THREE.Vector3(Math.max(x0, bb.min.x - m), y0 + 0.002, Math.max(z0, bb.min.z - m));
    const c = new THREE.Vector3(Math.min(x1, bb.max.x + m), y0 + 0.006, Math.min(z1, bb.max.z + m));
    if (c.x - a.x < 0.02 || c.z - a.z < 0.02) continue;
    b.boxMM(mat, [a.x, a.y, a.z], [c.x, c.y, c.z], { shadow: false });
  }
}
