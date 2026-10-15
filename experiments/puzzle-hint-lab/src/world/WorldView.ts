/**
 * 100 部屋の 3D（簡易）: 床・壁・天井・扉の枠・部屋番号の札・天井の灯り・部屋の状態の帯・手がかりの札・ボタンの台。
 * 動かない物は材質ごとに 1 つの形にまとめる（描く回数を減らす）。当たり判定の箱と、座標 → 部屋の表も作る。
 *
 * 見た目: 明るい灰色の試験室。壁は部屋ごとにわずかに色味を変える。天井の近くを一周する細い帯が部屋の状態
 * （未制圧 = 白い光・制圧 = 橙）。扉の上の札は行き先の部屋番号
 */
import * as THREE from 'three';
import {
  CLUE_WIDTH,
  doorSide,
  doorU,
  wallPoint,
  type Clue,
  type ColorKey,
  type WallMount,
} from '../gen/puzzles.ts';
import { CEIL_H, SIDES, WALL_T, fmtId, type Rect, type Side } from '../gen/types.ts';
import type { World } from '../gen/world.ts';
import { GlyphAtlas, type Glyph } from './Glyphs.ts';
import { MeshBuilder, rgba, shade, type RGBA, type UvRect, type V3 } from './MeshBuilder.ts';

export const COLOR_HEX: Record<ColorKey, number> = {
  red: 0xe0453c,
  blue: 0x2f6fe8,
  green: 0x2fb35a,
  yellow: 0xf2c63a,
  white: 0xf3f3ec,
  purple: 0x9452cc,
};

/** 扉の開口の高さ（m） */
export const DOOR_H = 2.16;
const JAMB = 0.04;

const C = {
  wall: rgba(0xc9ced6),
  base: rgba(0x3a3f47),
  jamb: rgba(0x4b525c),
  plate: rgba(0x1d222a),
  ceiling: rgba(0xb2b7bf),
  light: rgba(0xf4f8ff),
  stripIdle: rgba(0x8fd6ee),
  stripSolved: rgba(0xff9a3c),
  plateText: rgba(0x7fe9ff),
  label: rgba(0x9fe8ff, 0.95),
  ink: rgba(0xf2f4f6),
  floorId: rgba(0xffffff, 0.16),
};
export const STRIP_IDLE = shade(C.stripIdle, 0.75);
export const STRIP_SOLVED = C.stripSolved;

/** 壁を向いて右（u の増える向き） */
export function wallRight(side: Side): V3 {
  switch (side) {
    case 'N':
      return [1, 0, 0];
    case 'S':
      return [-1, 0, 0];
    case 'E':
      return [0, 0, 1];
    case 'W':
      return [0, 0, -1];
  }
}

/** 壁に付ける物の向き（局所の +z が部屋の内側、+x が壁を向いて右） */
export const wallYaw = (side: Side): number => ({ N: 0, S: Math.PI, E: -Math.PI / 2, W: Math.PI / 2 })[side];

export interface Aabb {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

/** 壁の上の点（u, y）から off m 手前の点と、右・上・手前の向き */
export function wallFrame(rect: Rect, side: Side, u: number, y: number, off: number): { c: V3; R: V3; U: V3; N: V3 } {
  const p = wallPoint(rect, side, u);
  return { c: [p.x + p.nx * off, y, p.z + p.nz * off], R: wallRight(side), U: [0, 1, 0], N: [p.nx, 0, p.nz] };
}

/** 真ん中 c・右 R・上 U・表 N の四角 */
function quadAt(b: MeshBuilder, c: V3, R: V3, U: V3, N: V3, w: number, h: number, color: RGBA, uv?: UvRect): void {
  const p = (sx: number, sy: number): V3 => [
    c[0] + (R[0] * sx * w) / 2 + (U[0] * sy * h) / 2,
    c[1] + (R[1] * sx * w) / 2 + (U[1] * sy * h) / 2,
    c[2] + (R[2] * sx * w) / 2 + (U[2] * sy * h) / 2,
  ];
  b.quad(p(-1, -1), p(1, -1), p(1, 1), p(-1, 1), N, color, uv);
}

/** 等幅の文字列を、真ん中 c から右 R へ並べる（文字の高さ h） */
function monoText(b: MeshBuilder, atlas: GlyphAtlas, text: string, c: V3, R: V3, U: V3, N: V3, h: number, color: RGBA): void {
  const cw = h * atlas.monoAspect;
  const run = atlas.monoRun(text);
  const start = -(run.length * cw) / 2 + cw / 2;
  run.forEach((g, i) => {
    if (!g) return;
    const k = start + i * cw;
    quadAt(b, [c[0] + R[0] * k, c[1] + R[1] * k, c[2] + R[2] * k], R, U, N, cw, h, color, g.uv);
  });
}

function glyphQuad(b: MeshBuilder, g: Glyph, c: V3, R: V3, U: V3, N: V3, h: number, color: RGBA): void {
  quadAt(b, c, R, U, N, h * g.aspect, h, color, g.uv);
}

/** 部屋ごとの壁の色味（わずかに違える） */
function roomTint(i: number): RGBA {
  const c = new THREE.Color().setHSL(((i * 0.618034) % 1 + 1) % 1, 0.1, 0.8);
  const base = new THREE.Color(0xc9ced6).lerp(c, 0.55);
  return [base.r, base.g, base.b, 1];
}

/** 床の升目（1 m） */
function floorTexture(): THREE.CanvasTexture {
  const s = 256;
  const cv = document.createElement('canvas');
  cv.width = s;
  cv.height = s;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#868c95';
  g.fillRect(0, 0, s, s);
  // わずかなむら
  const img = g.getImageData(0, 0, s, s);
  let seed = 7;
  const rnd = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < img.data.length; i += 4) {
    const k = (rnd() - 0.5) * 7;
    img.data[i] += k;
    img.data[i + 1] += k;
    img.data[i + 2] += k;
  }
  g.putImageData(img, 0, 0);
  g.fillStyle = 'rgba(40, 46, 54, 0.45)';
  g.fillRect(0, 0, s, 2);
  g.fillRect(0, 0, 2, s);
  g.fillStyle = 'rgba(255, 255, 255, 0.07)';
  g.fillRect(0, 2, s, 1);
  g.fillRect(2, 0, 1, s);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export class WorldView {
  readonly group = new THREE.Group();
  readonly atlas: GlyphAtlas;
  /** 壁・扉の枠の当たり判定（床の上の 2 次元の箱） */
  readonly boxes: Aabb[] = [];
  private readonly cells = new Map<number, number[]>();
  private readonly roomGrid: Int16Array;
  private readonly gx0: number;
  private readonly gz0: number;
  private readonly gw: number;
  private readonly gd: number;
  private readonly strips: THREE.BufferGeometry;
  private readonly stripRanges: [number, number][] = [];
  private readonly world: World;

  constructor(world: World) {
    this.world = world;
    const words = new Set<string>();
    for (const p of world.puzzles) for (const c of p.clues) if (c.kind === 'words') c.words.forEach((w) => words.add(w));
    this.atlas = new GlyphAtlas(words);

    const walls = new MeshBuilder();
    const floors = new MeshBuilder();
    const ceilings = new MeshBuilder();
    const lights = new MeshBuilder();
    const strips = new MeshBuilder();
    const unlit = new MeshBuilder();
    const text = new MeshBuilder();

    world.rooms.forEach((room) => {
      const r = room.rect;
      const x0 = r.x;
      const z0 = r.z;
      const x1 = r.x + r.w;
      const z1 = r.z + r.d;
      // 床（uv は m。升目の絵をくり返す）・天井
      floors.quad([x0, 0, z1], [x1, 0, z1], [x1, 0, z0], [x0, 0, z0], [0, 1, 0], rgba(0xffffff), [x0, -z1, x1, -z0]);
      ceilings.quad([x0, CEIL_H, z0], [x1, CEIL_H, z0], [x1, CEIL_H, z1], [x0, CEIL_H, z1], [0, -1, 0], C.ceiling);
      // 天井の灯り（4 m ほどおき）
      const nx = Math.max(1, Math.round(r.w / 4));
      const nz = Math.max(1, Math.round(r.d / 4));
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < nz; j++) {
          const cx = x0 + ((i + 0.5) * r.w) / nx;
          const cz = z0 + ((j + 0.5) * r.d) / nz;
          const [hw, hd] = r.w >= r.d ? [0.6, 0.25] : [0.25, 0.6];
          lights.quad([cx - hw, CEIL_H - 0.01, cz - hd], [cx + hw, CEIL_H - 0.01, cz - hd], [cx + hw, CEIL_H - 0.01, cz + hd], [cx - hw, CEIL_H - 0.01, cz + hd], [0, -1, 0], C.light);
        }
      }
      // 壁（扉の所は開ける）・幅木・状態の帯
      const tint = roomTint(room.index);
      const from = strips.vertexCount;
      for (const side of SIDES) this.buildWall(walls, strips, room.index, r, side, tint);
      this.stripRanges.push([from, strips.vertexCount]);
      // 床の部屋番号
      const h = Math.min(1.1, 0.16 * Math.min(r.w, r.d));
      monoText(text, this.atlas, room.label, [x0 + r.w / 2, 0.006, z0 + r.d / 2], [1, 0, 0], [0, 0, -1], [0, 1, 0], h, C.floorId);
    });

    // 扉の枠・行き先の札（両側）
    for (const d of world.doors) this.buildDoor(walls, text, d);

    // 手がかり・ボタンの台
    for (const p of world.puzzles) {
      for (const c of p.clues) this.buildClue(walls, unlit, text, c);
      for (const b of p.buttons) {
        const rect = world.rooms[b.mount.room].rect;
        const f = (dy: number, off: number) => wallFrame(rect, b.mount.side, b.mount.u, b.mount.y + dy, off);
        this.wallBox(walls, b.mount, 0.26, 0.26, 0.025, C.plate);
        if (b.pips > 0) {
          this.wallBox(walls, { ...b.mount, y: b.mount.y + 0.21 }, 0.2, 0.08, 0.012, C.plate);
          for (let k = 0; k < b.pips; k++) {
            const { c, R, U, N } = f(0.21, 0.014);
            const o = (k - (b.pips - 1) / 2) * 0.052;
            glyphQuad(text, this.atlas.dot, [c[0] + R[0] * o, c[1], c[2] + R[2] * o], R, U, N, 0.036, C.ink);
          }
        }
        if (b.symbol) {
          this.wallBox(walls, { ...b.mount, y: b.mount.y + 0.22 }, 0.14, 0.14, 0.012, C.plate);
          const { c, R, U, N } = f(0.22, 0.014);
          glyphQuad(text, this.atlas.symbol(b.symbol), c, R, U, N, 0.11, C.ink);
        }
        if (b.blink > 0) this.wallBox(walls, { ...b.mount, y: b.mount.y + 0.21 }, 0.11, 0.11, 0.012, C.plate);
      }
    }

    const floorMat = new THREE.MeshLambertMaterial({ map: floorTexture() });
    const wallMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const add = (g: THREE.BufferGeometry, m: THREE.Material, order = 0): THREE.Mesh => {
      const mesh = new THREE.Mesh(g, m);
      mesh.renderOrder = order;
      mesh.matrixAutoUpdate = false;
      this.group.add(mesh);
      return mesh;
    };
    add(floors.build(), floorMat);
    add(walls.build(), wallMat);
    // 天井は下を向くので半球の光の暗い側だけを受ける。少し自ら光らせて持ち上げる
    add(ceilings.build(), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x50555d }));
    add(lights.build(), new THREE.MeshBasicMaterial({ vertexColors: true }));
    this.strips = strips.build();
    add(this.strips, new THREE.MeshBasicMaterial({ vertexColors: true }));
    add(unlit.build(), new THREE.MeshBasicMaterial({ vertexColors: true }));
    add(
      text.build(),
      new THREE.MeshBasicMaterial({ map: this.atlas.texture, vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      2,
    );

    // 座標 → 部屋（1 m の升目）
    const b = world.bounds;
    this.gx0 = b.x0;
    this.gz0 = b.z0;
    this.gw = b.x1 - b.x0;
    this.gd = b.z1 - b.z0;
    this.roomGrid = new Int16Array(this.gw * this.gd).fill(-1);
    world.rooms.forEach((room) => {
      const r = room.rect;
      for (let x = r.x; x < r.x + r.w; x++) for (let z = r.z; z < r.z + r.d; z++) this.roomGrid[(z - this.gz0) * this.gw + (x - this.gx0)] = room.index;
    });
    // 当たり判定の箱を 4 m の升目に振り分ける
    this.boxes.forEach((bx, i) => {
      for (let cx = Math.floor(bx.x0 / 4); cx <= Math.floor(bx.x1 / 4); cx++) {
        for (let cz = Math.floor(bx.z0 / 4); cz <= Math.floor(bx.z1 / 4); cz++) {
          const k = cellKey(cx, cz);
          if (!this.cells.has(k)) this.cells.set(k, []);
          this.cells.get(k)!.push(i);
        }
      }
    });
  }

  /** 1 つの壁（扉の所を開けた区間ごとの箱）・扉の上の壁・幅木・状態の帯 */
  private buildWall(walls: MeshBuilder, strips: MeshBuilder, index: number, r: Rect, side: Side, tint: RGBA): void {
    const along = side === 'N' || side === 'S';
    const a0 = along ? r.x : r.z;
    const a1 = along ? r.x + r.w : r.z + r.d;
    // 壁の厚みの範囲（部屋の内側に WALL_T）
    const [t0, t1] = (() => {
      switch (side) {
        case 'N':
          return [r.z, r.z + WALL_T];
        case 'S':
          return [r.z + r.d - WALL_T, r.z + r.d];
        case 'E':
          return [r.x + r.w - WALL_T, r.x + r.w];
        case 'W':
          return [r.x, r.x + WALL_T];
      }
    })();
    const openings = this.world.rooms[index].doors
      .map((di) => this.world.doors[di])
      .filter((d) => doorSide(r, d) === side)
      .map((d) => [d.c - d.width / 2, d.c + d.width / 2] as [number, number])
      .sort((p, q) => p[0] - q[0]);
    // 内側の面と、区間の端（扉の脇）の面だけ描く
    const inner = { N: 4, S: 8, E: 2, W: 1 }[side];
    const ends = along ? 1 | 2 : 4 | 8;
    const bottom = shade(tint, 0.8);
    const box = (s0: number, s1: number, y0: number, y1: number, cb: RGBA, ct: RGBA, faces: number, solid: boolean): void => {
      const [x0, x1, z0, z1] = along ? [s0, s1, t0, t1] : [t0, t1, s0, s1];
      walls.box(x0, y0, z0, x1, y1, z1, cb, ct, faces);
      if (solid) this.boxes.push({ x0, z0, x1, z1 });
    };
    let s = a0;
    for (const [o0, o1] of openings) {
      if (o0 > s) box(s, o0, 0, CEIL_H, bottom, tint, inner | ends, true);
      // 扉の上の壁
      box(o0, o1, DOOR_H, CEIL_H, shade(tint, 0.93), tint, inner | 32, false);
      s = o1;
    }
    if (a1 > s) box(s, a1, 0, CEIL_H, bottom, tint, inner | ends, true);
    // 幅木（扉の所は切る）と、天井の近くを一周する状態の帯（扉の上も通る）
    const nIn = { N: 1, S: -1, E: -1, W: 1 }[side];
    const face = { N: t1, S: t0, E: t0, W: t1 }[side];
    s = a0;
    const skirt = (s0: number, s1: number): void => {
      const [x0, x1, z0, z1] = along ? [s0, s1, Math.min(face, face + nIn * 0.012), Math.max(face, face + nIn * 0.012)] : [Math.min(face, face + nIn * 0.012), Math.max(face, face + nIn * 0.012), s0, s1];
      walls.box(x0, 0, z0, x1, 0.1, z1, C.base, C.base, inner | 16 | ends);
    };
    for (const [o0, o1] of openings) {
      if (o0 - JAMB > s) skirt(s, o0 - JAMB);
      s = o1 + JAMB;
    }
    if (a1 > s) skirt(s, a1);
    const off = face + nIn * 0.004;
    const [y0, y1] = [2.74, 2.78];
    const n: V3 = along ? [0, 0, nIn] : [nIn, 0, 0];
    const p = (a: number, y: number): V3 => (along ? [a, y, off] : [off, y, a]);
    // 表が内側を向くように、壁を向いて左から右へ
    const [l, rr] = side === 'N' || side === 'E' ? [a0 + WALL_T, a1 - WALL_T] : [a1 - WALL_T, a0 + WALL_T];
    strips.quad(p(l, y0), p(rr, y0), p(rr, y1), p(l, y1), n, STRIP_IDLE);
  }

  /** 扉の枠（両側の柱・上の枠）と、両側の行き先の札 */
  private buildDoor(walls: MeshBuilder, text: MeshBuilder, d: World['doors'][number]): void {
    const half = d.width / 2;
    const depth = WALL_T + 0.03;
    const [o0, o1] = [d.c - half, d.c + half];
    const jamb = (s0: number, s1: number, y0: number, y1: number): void => {
      const [x0, x1, z0, z1] = d.vertical ? [d.at - depth, d.at + depth, s0, s1] : [s0, s1, d.at - depth, d.at + depth];
      walls.box(x0, y0, z0, x1, y1, z1, C.jamb, C.jamb);
      if (y0 === 0) this.boxes.push({ x0, z0, x1, z1 });
    };
    jamb(o0 - JAMB, o0 + JAMB, 0, DOOR_H + 0.08);
    jamb(o1 - JAMB, o1 + JAMB, 0, DOOR_H + 0.08);
    jamb(o0 - JAMB, o1 + JAMB, DOOR_H, DOOR_H + 0.08);
    for (const [here, there] of [
      [d.a, d.b],
      [d.b, d.a],
    ]) {
      const rect = this.world.rooms[here].rect;
      const side = doorSide(rect, d);
      const mount: WallMount = { room: here, side, u: doorU(rect, side, d), y: 2.45 };
      this.wallBox(walls, mount, 0.62, 0.17, 0.02, C.plate);
      const f = wallFrame(rect, side, mount.u, mount.y, 0.022);
      monoText(text, this.atlas, `ROOM ${fmtId(this.world.rooms[there].id)}`, f.c, f.R, f.U, f.N, 0.085, C.plateText);
    }
  }

  /** 手がかりの札（台・色・文字・記号）と、どの部屋の物かを示す部屋番号 */
  private buildClue(walls: MeshBuilder, unlit: MeshBuilder, text: MeshBuilder, clue: Clue): void {
    const m = clue.mount;
    const rect = this.world.rooms[m.room].rect;
    const f = (dy: number, du = 0, off = 0.032) => wallFrame(rect, m.side, m.u + du, m.y + dy, off);
    let h = 0;
    switch (clue.kind) {
      case 'stripes': {
        const n = clue.colors.length;
        h = 0.62;
        this.wallBox(walls, m, CLUE_WIDTH.stripes(n) - 0.14, h, 0.03, C.plate);
        clue.colors.forEach((col, k) => {
          const g = f(0, (k - (n - 1) / 2) * 0.2);
          quadAt(unlit, g.c, g.R, g.U, g.N, 0.15, 0.5, rgba(COLOR_HEX[col]));
        });
        break;
      }
      case 'symbols': {
        const n = clue.symbols.length;
        h = n * 0.15 + 0.12;
        this.wallBox(walls, m, 0.4, h, 0.03, C.plate);
        clue.symbols.forEach((s, k) => {
          const g = f(((n - 1) / 2 - k) * 0.15);
          glyphQuad(text, this.atlas.symbol(s), g.c, g.R, g.U, g.N, 0.11, C.ink);
        });
        break;
      }
      case 'words': {
        const n = clue.words.length;
        h = n * 0.15 + 0.12;
        this.wallBox(walls, m, 0.72, h, 0.03, C.plate);
        clue.words.forEach((word, k) => {
          const g = f(((n - 1) / 2 - k) * 0.15);
          glyphQuad(text, this.atlas.word(word), g.c, g.R, g.U, g.N, 0.1, C.ink);
        });
        break;
      }
      case 'lights': {
        h = 0.34;
        this.wallBox(walls, m, 0.34, h, 0.04, C.plate);
        break;
      }
      case 'legend': {
        const n = clue.rows.length;
        h = n * 0.15 + 0.12;
        this.wallBox(walls, m, 0.62, h, 0.03, C.plate);
        clue.rows.forEach((row, k) => {
          const dy = ((n - 1) / 2 - k) * 0.15;
          const s = f(dy, -0.14);
          glyphQuad(text, this.atlas.symbol(row.symbol), s.c, s.R, s.U, s.N, 0.1, C.ink);
          const a = f(dy, 0.0);
          monoText(text, this.atlas, '-', a.c, a.R, a.U, a.N, 0.08, shade(C.ink, 0.7));
          const c = f(dy, 0.15);
          quadAt(unlit, c.c, c.R, c.U, c.N, 0.16, 0.09, rgba(COLOR_HEX[row.color]));
        });
        break;
      }
    }
    // どの部屋の手がかりか
    const g = wallFrame(rect, m.side, m.u, m.y + h / 2 + 0.07, 0.006);
    monoText(text, this.atlas, `ROOM ${fmtId(this.world.rooms[clue.forRoom].id)}`, g.c, g.R, g.U, g.N, 0.07, C.label);
  }

  /** 壁に付く箱（幅 w・高さ h・厚み depth。壁の面から手前へ） */
  wallBox(b: MeshBuilder, m: WallMount, w: number, h: number, depth: number, color: RGBA): void {
    const rect = this.world.rooms[m.room].rect;
    const p = wallPoint(rect, m.side, m.u);
    const along = m.side === 'N' || m.side === 'S';
    const cx = p.x + (p.nx * depth) / 2;
    const cz = p.z + (p.nz * depth) / 2;
    const [hx, hz] = along ? [w / 2, depth / 2] : [depth / 2, w / 2];
    b.box(cx - hx, m.y - h / 2, cz - hz, cx + hx, m.y + h / 2, cz + hz, shade(color, 0.92), color);
  }

  /** 座標の部屋（無ければ -1） */
  roomAt(x: number, z: number): number {
    const ix = Math.floor(x) - this.gx0;
    const iz = Math.floor(z) - this.gz0;
    if (ix < 0 || iz < 0 || ix >= this.gw || iz >= this.gd) return -1;
    return this.roomGrid[iz * this.gw + ix];
  }

  /** 点の近く（半径 r）の当たり判定の箱 */
  nearBoxes(x: number, z: number, r: number, out: Aabb[] = []): Aabb[] {
    out.length = 0;
    const seen = new Set<number>();
    for (let cx = Math.floor((x - r) / 4); cx <= Math.floor((x + r) / 4); cx++) {
      for (let cz = Math.floor((z - r) / 4); cz <= Math.floor((z + r) / 4); cz++) {
        for (const i of this.cells.get(cellKey(cx, cz)) ?? []) {
          if (seen.has(i)) continue;
          seen.add(i);
          out.push(this.boxes[i]);
        }
      }
    }
    return out;
  }

  /** 部屋の状態の帯の色（制圧で橙） */
  setRoomSolved(room: number, solved: boolean): void {
    const [from, to] = this.stripRanges[room];
    MeshBuilder.recolor(this.strips, from, to, solved ? STRIP_SOLVED : STRIP_IDLE);
  }
}

const cellKey = (cx: number, cz: number): number => (cx + 4096) * 8192 + (cz + 4096);
