/**
 * MirrorOffset — 鏡のずれる洗面所（U09）。params: offset（m。鏡像の横ずれ）, delay（s。鏡像の遅れ）。
 *
 * RenderTarget を使わない鏡。Restroom（footprint = 1 矩形）を中央で 2 分し、入口側を「実側」、奥側を「鏡像側」にする。
 *  - layout（決定論）:
 *      鏡像側にあった内装・天井灯を捨て、実側の内装（家具・天井パネル・追加した洗面カウンター）を鏡面で反転した
 *      非ソリッドの箱として鏡像側に置く。反転コピーは offset だけ鏡面に沿ってずらす（鏡像のずれ）。
 *      実側の扉（entry / exit）は鏡像側の壁に「疑似扉」（パネル + 枠。接続は作らない = 鏡内だけに存在するヒント）として写す。
 *      鏡面は部屋の中ほどに立つ 1 枚のスラブ（腰壁 0.9 m / ガラス帯 / 上帯。全てソリッド）。footprint・bounds・ソケットは変えない。
 *      鏡面の位置は中央を優先し、ソケット（穴を含む）が実側に収まらなければ実側を広げる（鏡像側が浅くなり反射は壁で切れる）。
 *      鏡像側の壁にソケットがある / 実側 1.8 m・鏡像側 1.0 m の奥行きが確保できないときは鏡を作らない（L.mirrors は空）。
 *  - build: PlayerProxy の delay 秒前の姿勢（Low Tier は現在姿勢）を鏡面で反転 + offset ずらしした位置に、見えるカプセルを置く RoomEffect。
 *      ジオメトリは追加せず位置・可視性だけ動かす。
 */
import * as THREE from 'three';
import type { Dir, Socket, Vec3 } from '../../core/types';
import { toLocal } from '../../core/types';
import { inRect, type Rect } from '../../generators/footprint';
import { box, WALL_T, type Box, type LabelSpec, type LightSpec, type MirrorSpec } from '../../generators/layout';
import { PLAYER } from '../../player/PlayerController';
import type { RoomEffect } from '../../render/RoomBuilder';
import type { ModifierImpl } from '../types';
import { num } from '../util';

/** 鏡面（軸並行の平面）。realSign < 0 なら m より小さい側が実側 */
interface Plane {
  axis: 'x' | 'z';
  m: number;
  realSign: -1 | 1;
}

/** 候補の鏡面（奥行き付き） */
interface Candidate extends Plane {
  realDepth: number;
  mirrorDepth: number;
}

/** 側壁のソケットと鏡面の最小距離（m）。扉の空け（幅/2 + 0.3）がスラブに掛からない値 */
const MARGIN = 1.0;
/** 実側の最小奥行き（m。カウンター 0.55 + 立てる床） */
const MIN_REAL = 1.8;
/** 鏡像側の最小奥行き（m。これより浅い鏡は作らない） */
const MIN_MIRROR = 1.0;
/** 側壁の扉前の空け（clearDoorways の 1.8 m + 余白）。カウンターはこの範囲を避ける */
const DOOR_CLEAR = 1.9;
/** スラブの半厚 */
const SLAB_HALF = 0.06;
const COUNTER_D = 0.55;
const COUNTER_H = 0.85;
const GLASS_Y0 = 0.9;

function across(pl: Plane, v: Vec3): number {
  return pl.axis === 'z' ? v[2] : v[0];
}

/** 実側の深さ（正なら実側、負なら鏡像側） */
function realDepth(pl: Plane, v: Vec3): number {
  return pl.realSign < 0 ? pl.m - across(pl, v) : across(pl, v) - pl.m;
}

/** 鏡面で反転し、鏡面に沿って shift だけずらす */
function reflectPoint(pl: Plane, v: Vec3, shift: number): Vec3 {
  return pl.axis === 'z' ? [v[0] + shift, v[1], 2 * pl.m - v[2]] : [2 * pl.m - v[0], v[1], v[2] + shift];
}

function reflectDir(pl: Plane, d: Dir): Dir {
  if (pl.axis === 'z') return d === 0 ? 2 : d === 2 ? 0 : d;
  return d === 1 ? 3 : d === 3 ? 1 : d;
}

/** 鏡面が向く方向（実側を向く） */
function facingDir(pl: Plane): Dir {
  if (pl.axis === 'z') return pl.realSign < 0 ? 2 : 0;
  return pl.realSign < 0 ? 3 : 1;
}

function planeFromSpec(spec: MirrorSpec): Plane {
  switch (spec.dir) {
    case 2: return { axis: 'z', m: spec.pos[2], realSign: -1 };
    case 0: return { axis: 'z', m: spec.pos[2], realSign: 1 };
    case 3: return { axis: 'x', m: spec.pos[0], realSign: -1 };
    default: return { axis: 'x', m: spec.pos[0], realSign: 1 };
  }
}

/** 箱を x/z の矩形で切る（y はそのまま）。空になれば null */
function clipBox(b: Box, r: Rect): Box | null {
  const x0 = Math.max(b.min[0], r.x0);
  const x1 = Math.min(b.max[0], r.x1);
  const z0 = Math.max(b.min[2], r.z0);
  const z1 = Math.min(b.max[2], r.z1);
  if (x1 - x0 < 0.01 || z1 - z0 < 0.01) return null;
  return { min: [x0, b.min[1], z0], max: [x1, b.max[1], z1], mat: b.mat, solid: b.solid };
}

function reflectBox(pl: Plane, b: Box, shift: number): Box {
  return box(reflectPoint(pl, b.min, shift), reflectPoint(pl, b.max, shift), b.mat, false);
}

/** 候補の鏡面。鏡像側の壁にソケットが無く、全ソケットが実側に（余白付きで）収まる位置を探す。
 *  中央（正確な鏡像）を優先し、届かなければ実側を広げて鏡像側を浅くする（反射は鏡像側の壁で切れる） */
function findPlane(r: Rect, sockets: Socket[], axis: 'x' | 'z', realSign: -1 | 1): Candidate | null {
  const lo = axis === 'z' ? r.z0 : r.x0;
  const hi = axis === 'z' ? r.z1 : r.x1;
  const total = hi - lo;
  const mirrorWall = axis === 'z' ? (realSign < 0 ? 0 : 2) : realSign < 0 ? 1 : 3;
  let minReal = MIN_REAL;
  for (const s of sockets) {
    if (s.type !== 'hole' && s.dir === mirrorWall) return null;
    const a = axis === 'z' ? s.pos[2] : s.pos[0];
    const fromLo = realSign < 0 ? a - lo : hi - a;
    const need = s.type === 'hole' ? s.width / 2 + 0.8 : MARGIN;
    minReal = Math.max(minReal, fromLo + need);
  }
  if (minReal > total - MIN_MIRROR) return null;
  const realDepth = Math.max(minReal, total / 2);
  const m = realSign < 0 ? lo + realDepth : hi - realDepth;
  return { axis, m, realSign, realDepth, mirrorDepth: total - realDepth };
}

/** 疑似扉（パネル + 枠）。壁の内面に貼る箱（ローカル、実側の扉位置）。反転して鏡像側の壁に置く */
function doorBoxes(s: Socket, doorMat: Box['mat']): Box[] {
  const out: Box[] = [];
  const sill = s.sill ?? 0;
  const y0 = s.pos[1] + sill;
  const y1 = y0 + s.height + 0.04;
  const hw = s.width / 2 + 0.03;
  const t = 0.065;
  // 壁の内面（外面から WALL_T）〜 少し内側
  const d0 = WALL_T;
  const dPanel = WALL_T + 0.06;
  const dFrame = WALL_T + 0.04;
  // 壁に沿った軸 a、法線軸 n（内向き）
  const put = (a0: number, a1: number, yA: number, yB: number, n0: number, n1: number, mat: Box['mat']) => {
    const inward = s.dir === 0 ? -1 : s.dir === 2 ? 1 : s.dir === 1 ? -1 : 1;
    if (s.dir === 0 || s.dir === 2) {
      const z0 = s.pos[2] + inward * n0;
      const z1 = s.pos[2] + inward * n1;
      out.push(box([s.pos[0] + a0, yA, z0], [s.pos[0] + a1, yB, z1], mat, false));
    } else {
      const x0 = s.pos[0] + inward * n0;
      const x1 = s.pos[0] + inward * n1;
      out.push(box([x0, yA, s.pos[2] + a0], [x1, yB, s.pos[2] + a1], mat, false));
    }
  };
  put(-hw, hw, y0, y1, d0, dPanel, doorMat);
  put(-hw - t, -hw + 0.02, y0, y1 + t, d0, dFrame, 'trim');
  put(hw - 0.02, hw + t, y0, y1 + t, d0, dFrame, 'trim');
  put(-hw + 0.02, hw - 0.02, y1 - 0.02, y1 + t, d0, dFrame, 'trim');
  return out;
}

const MirrorOffset: ModifierImpl = {
  id: 'MirrorOffset',
  defaults: { offset: 0.3, delay: 0.5 },

  layout(L, _p, params, rng) {
    L.mirrors = [];
    if (L.footprint.length !== 1 || L.shellCount === undefined) return;
    const r = L.footprint[0];
    const h = L.height;
    const offset = Math.max(0, num(params.offset, 0.3));
    const delay = Math.max(0, num(params.delay, 0.5));

    // 鏡面の候補: 入口正面（z 軸。入口は z0 の壁）を優先、次に左右（x 軸。鏡像側が深い方、同じなら乱数）
    const zPlane = findPlane(r, L.sockets, 'z', -1);
    const xNeg = findPlane(r, L.sockets, 'x', -1);
    const xPos = findPlane(r, L.sockets, 'x', 1);
    let pl: Candidate | null = zPlane;
    if (!pl) {
      if (xNeg && xPos) pl = Math.abs(xNeg.mirrorDepth - xPos.mirrorDepth) < 0.01 ? (rng.chance(0.5) ? xNeg : xPos) : xNeg.mirrorDepth > xPos.mirrorDepth ? xNeg : xPos;
      else pl = xNeg ?? xPos;
    }
    const shift = (rng.chance(0.5) ? 1 : -1) * offset;
    if (!pl) return;

    const inner: Rect = { x0: r.x0 + WALL_T, z0: r.z0 + WALL_T, x1: r.x1 - WALL_T, z1: r.z1 - WALL_T };
    // 実側 / 鏡像側の内側矩形（スラブを除く）
    const realRegion: Rect = { ...inner };
    const mirrorRegion: Rect = { ...inner };
    if (pl.axis === 'z') {
      if (pl.realSign < 0) { realRegion.z1 = pl.m - SLAB_HALF; mirrorRegion.z0 = pl.m + SLAB_HALF; }
      else { realRegion.z0 = pl.m + SLAB_HALF; mirrorRegion.z1 = pl.m - SLAB_HALF; }
    } else {
      if (pl.realSign < 0) { realRegion.x1 = pl.m - SLAB_HALF; mirrorRegion.x0 = pl.m + SLAB_HALF; }
      else { realRegion.x0 = pl.m + SLAB_HALF; mirrorRegion.x1 = pl.m - SLAB_HALF; }
    }

    // 1) 内装を実側だけ残す（鏡面をまたぐ箱は切る）
    const shell = L.boxes.slice(0, L.shellCount);
    const kept: Box[] = [];
    for (const b of L.boxes.slice(L.shellCount)) {
      const c = clipBox(b, realRegion);
      if (c) kept.push(c);
    }

    // 2) 洗面カウンター（実側、鏡面の手前）。鏡面に近い側壁の扉の前は空ける
    let cA0 = (pl.axis === 'z' ? inner.x0 : inner.z0) + 0.3;
    let cA1 = (pl.axis === 'z' ? inner.x1 : inner.z1) - 0.3;
    for (const s of L.sockets) {
      if (s.type === 'hole' || realDepth(pl, s.pos) > DOOR_CLEAR + COUNTER_D) continue;
      const sideLo = pl.axis === 'z' ? 3 : 2; // 沿い軸の小さい側の壁
      const sideHi = pl.axis === 'z' ? 1 : 0;
      if (s.dir === sideLo) cA0 = Math.max(cA0, (pl.axis === 'z' ? r.x0 : r.z0) + DOOR_CLEAR);
      if (s.dir === sideHi) cA1 = Math.min(cA1, (pl.axis === 'z' ? r.x1 : r.z1) - DOOR_CLEAR);
    }
    const cN0 = pl.realSign < 0 ? pl.m - SLAB_HALF - COUNTER_D : pl.m + SLAB_HALF;
    const cN1 = cN0 + COUNTER_D;
    if (cA1 - cA0 > 0.6) {
      kept.push(pl.axis === 'z'
        ? box([cA0, 0, cN0], [cA1, COUNTER_H, cN1], 'furnitureLight')
        : box([cN0, 0, cA0], [cN1, COUNTER_H, cA1], 'furnitureLight'));
    }

    // 3) 実側内装の鏡像（非ソリッド、offset ずらし、鏡像側の内側で切る）
    const mirrored: Box[] = [];
    for (const b of kept) {
      const c = clipBox(reflectBox(pl, b, shift), mirrorRegion);
      if (c) mirrored.push(c);
    }
    // 4) 疑似扉（鏡像側の壁。ずらさない = 壁に貼り付いたまま）。
    //    鏡像側が浅くて奥壁の扉の鏡像が収まらないときは、鏡像側の壁（実際の奥壁）に同じ扉を置く（鏡の中にだけ存在する扉）
    const mirrorWall = facingDir(pl) === 2 ? 0 : facingDir(pl) === 0 ? 2 : facingDir(pl) === 3 ? 1 : 3;
    const backWall = facingDir(pl);
    for (const s of L.sockets) {
      if (s.type !== 'door') continue;
      let placed = 0;
      for (const b of doorBoxes(s, L.palette.door)) {
        const c = clipBox(reflectBox(pl, b, 0), mirrorRegion);
        if (c) { mirrored.push(c); placed++; }
      }
      if (placed > 0) continue;
      let virtual: Socket | null = null;
      if (s.dir === backWall) {
        // 奥壁の扉 → 鏡像側の壁の同じ位置
        const wallAt = pl.axis === 'z' ? (pl.realSign < 0 ? r.z1 : r.z0) : pl.realSign < 0 ? r.x1 : r.x0;
        const pos: Vec3 = pl.axis === 'z' ? [s.pos[0], s.pos[1], wallAt] : [wallAt, s.pos[1], s.pos[2]];
        virtual = { ...s, id: `${s.id}:mirror`, pos, dir: mirrorWall };
      } else if (pl.mirrorDepth >= s.width + 0.7) {
        // 側壁の扉 → 同じ側壁の鏡像側、奥に寄せて収める
        const depth = pl.mirrorDepth - s.width / 2 - 0.35;
        const a = pl.m - pl.realSign * depth;
        const pos: Vec3 = pl.axis === 'z' ? [s.pos[0], s.pos[1], a] : [a, s.pos[1], s.pos[2]];
        virtual = { ...s, id: `${s.id}:mirror`, pos };
      }
      if (!virtual) continue;
      for (const b of doorBoxes(virtual, L.palette.door)) {
        const c = clipBox(b, mirrorRegion);
        if (c) mirrored.push(c);
      }
    }
    // 5) スラブ（腰壁 / ガラス / 上帯。全てソリッド = 鏡は通れない）
    const gTop = Math.min(2.2, h - 0.3);
    const sA0 = pl.axis === 'z' ? inner.x0 : inner.z0;
    const sA1 = pl.axis === 'z' ? inner.x1 : inner.z1;
    const slab = (y0: number, y1: number, mat: Box['mat']) => (pl!.axis === 'z'
      ? box([sA0, y0, pl!.m - SLAB_HALF], [sA1, y1, pl!.m + SLAB_HALF], mat)
      : box([pl!.m - SLAB_HALF, y0, sA0], [pl!.m + SLAB_HALF, y1, sA1], mat));
    // 鏡は全幅の暗いガラス帯ではなく、枡（stainless）付きの長方形パネル（幅 0.7 m・1.0 m ピッチ。カウンターがあればその範囲、無ければ全幅）。
    // パネルの間と上下は壁。斜めから見たときに帯全体が歪んだ平行四辺形に見える問題への対処（2026-09-17）
    const slabA = (a0: number, a1: number, y0: number, y1: number, mat: Box['mat'], solid = true) => (pl!.axis === 'z'
      ? box([a0, y0, pl!.m - SLAB_HALF], [a1, y1, pl!.m + SLAB_HALF], mat, solid)
      : box([pl!.m - SLAB_HALF, y0, a0], [pl!.m + SLAB_HALF, y1, a1], mat, solid));
    const y0m = GLASS_Y0 + 0.15;
    const y1m = Math.max(y0m + 0.6, gTop - 0.2);
    const slabs: Box[] = [slab(0, y0m, L.palette.wall), slab(y1m, h, L.palette.wall)];
    const hasCounter = cA1 - cA0 > 0.6;
    const mA0 = (hasCounter ? cA0 : sA0) + 0.25;
    const mA1 = (hasCounter ? cA1 : sA1) - 0.25;
    const PW = 0.7, PITCH = 1.0;
    const count = Math.max(1, Math.floor((mA1 - mA0 + (PITCH - PW)) / PITCH));
    const total = count * PITCH - (PITCH - PW);
    const panels: [number, number][] = [];
    for (let i = 0, a = (mA0 + mA1) / 2 - total / 2; i < count; i++, a += PITCH) panels.push([a, a + PW]);
    let prev = sA0;
    for (const [p0, p1] of panels) {
      if (p0 - prev > 0.005) slabs.push(slabA(prev, p0, y0m, y1m, L.palette.wall));
      prev = p1;
    }
    if (sA1 - prev > 0.005) slabs.push(slabA(prev, sA1, y0m, y1m, L.palette.wall));
    // 実側の面に枡（3 cm・2 cm 出す。非ソリッド）
    const faceN = pl.realSign < 0 ? pl.m - SLAB_HALF : pl.m + SLAB_HALF;
    const frameN0 = pl.realSign < 0 ? faceN - 0.02 : faceN;
    const frameN1 = pl.realSign < 0 ? faceN : faceN + 0.02;
    const frame = (a0: number, a1: number, y0: number, y1: number) => (pl!.axis === 'z'
      ? box([a0, y0, frameN0], [a1, y1, frameN1], 'stainless', false)
      : box([frameN0, y0, a0], [frameN1, y1, a1], 'stainless', false));
    // 鏡像側の面にも同じ枡（鏡の中に枡が映っているように見える。offset ぶんずらすと枡だけが二重に見えるのでずらさない）
    const faceM = pl.realSign < 0 ? pl.m + SLAB_HALF : pl.m - SLAB_HALF;
    const mN0 = pl.realSign < 0 ? faceM : faceM - 0.02;
    const mN1 = pl.realSign < 0 ? faceM + 0.02 : faceM;
    const frameM = (a0: number, a1: number, y0: number, y1: number) => (pl!.axis === 'z'
      ? box([a0, y0, mN0], [a1, y1, mN1], 'stainless', false)
      : box([mN0, y0, a0], [mN1, y1, a1], 'stainless', false));
    for (const [p0, p1] of panels) {
      slabs.push(slabA(p0, p1, y0m, y1m, 'glass'));
      for (const fr of [frame, frameM]) {
        slabs.push(fr(p0 - 0.03, p1 + 0.03, y0m - 0.03, y0m));
        slabs.push(fr(p0 - 0.03, p1 + 0.03, y1m, y1m + 0.03));
        slabs.push(fr(p0 - 0.03, p0, y0m, y1m));
        slabs.push(fr(p1, p1 + 0.03, y0m, y1m));
      }
    }

    L.boxes = [...shell, ...kept, ...slabs, ...mirrored];

    // 6) 照明: 鏡像側の灯を捨て、実側の灯を反転して置く。どちらかの側に灯が無ければ（グリッドの 1/3 だけが PointLight）その側の中央に 1 灯
    const realLights: LightSpec[] = L.lights.filter((l) => realDepth(pl!, l.pos) > 0);
    const proto = L.lights[0];
    if (realLights.length === 0 && proto) realLights.push({ ...proto, pos: [(realRegion.x0 + realRegion.x1) / 2, proto.pos[1], (realRegion.z0 + realRegion.z1) / 2] });
    const mirroredLights: LightSpec[] = [];
    for (const l of realLights) {
      const p = reflectPoint(pl, l.pos, shift);
      if (inRect(mirrorRegion, p[0], p[2])) mirroredLights.push({ ...l, pos: p });
    }
    if (mirroredLights.length === 0 && realLights.length > 0) {
      const l = realLights[0];
      mirroredLights.push({ ...l, pos: [(mirrorRegion.x0 + mirrorRegion.x1) / 2, l.pos[1], (mirrorRegion.z0 + mirrorRegion.z1) / 2] });
    }
    L.lights = [...realLights, ...mirroredLights];

    // 7) ラベル（入口の部屋名）の鏡像。文字はそのまま（鏡の中で読めてしまう違和感）
    const labels: LabelSpec[] = [];
    for (const lb of L.labels) {
      if (realDepth(pl, lb.pos) <= 0) continue;
      const p = reflectPoint(pl, lb.pos, 0);
      if (inRect(mirrorRegion, p[0], p[2], -0.05)) labels.push({ ...lb, pos: p, dir: reflectDir(pl, lb.dir) });
    }
    L.labels = [...L.labels.filter((lb) => realDepth(pl!, lb.pos) > 0), ...labels];

    // 8) 鏡面の記録（build が読む）。offset は符号付き（鏡面に沿ったずれの向き）
    const center: Vec3 = pl.axis === 'z' ? [(sA0 + sA1) / 2, h / 2, pl.m] : [pl.m, h / 2, (sA0 + sA1) / 2];
    L.mirrors = [{ id: 'mirror', pos: center, dir: facingDir(pl), size: [sA1 - sA0, gTop - GLASS_Y0], offset: shift, delaySec: delay }];
  },

  build(built, L, ctx) {
    const spec = L.mirrors?.[0];
    const placement = ctx.node.placement;
    const r = L.footprint[0];
    if (!spec || !placement || !r) return;
    const pl = planeFromSpec(spec);
    const shift = spec.offset ?? 0;
    const delay = spec.delaySec ?? 0.5;
    const yawBase = (placement.yawQ * Math.PI) / 2;

    // 見えるカプセル（PlayerProxy と同寸。足元原点）
    const geo = new THREE.CapsuleGeometry(PLAYER.radius, PLAYER.height - PLAYER.radius * 2, 4, 8);
    geo.translate(0, PLAYER.height / 2, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x1a1b22, roughness: 0.85, metalness: 0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'MirrorOffset/proxy';
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.userData.disposable = [mat];
    built.group.add(mesh);

    const effect: RoomEffect = {
      update(_dt, rc) {
        const useDelay = rc.tier.id !== 'low' && delay > 0;
        const pose = useDelay ? rc.game?.proxy.history.poseAt(delay) ?? null : null;
        const pos = pose ? pose.pos : rc.player.pos;
        const yaw = pose ? pose.yaw : rc.player.yaw;
        const crouch = pose ? pose.crouching : rc.player.crouching;
        const lp = toLocal(placement, pos);
        // 実側の内部に居るときだけ映す
        if (!inRect(r, lp[0], lp[2], 0.1) || realDepth(pl, lp) < 0.15 || lp[1] < -0.5 || lp[1] > L.height) {
          mesh.visible = false;
          return;
        }
        const rp = reflectPoint(pl, lp, shift);
        const ly = yaw - yawBase;
        const ry = pl.axis === 'z' ? Math.PI - ly : -ly;
        mesh.position.set(rp[0], rp[1], rp[2]);
        mesh.rotation.set(0, ry, 0);
        mesh.scale.set(1, crouch ? PLAYER.crouchHeight / PLAYER.height : 1, 1);
        mesh.visible = true;
      },
      dispose() { /* mesh は RoomBuilder.dispose の traverse で解放（geometry + userData.disposable） */ },
    };
    built.effects.push(effect);
  },
};

export default MirrorOffset;
