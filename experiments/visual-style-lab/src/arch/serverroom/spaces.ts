import * as THREE from 'three';
import { Prop, type PropSink } from '../../props/kit.ts';
import { chair, extinguisher, pottedPlant, steelShelf, trashBin, boxPile, bench } from '../../props/lib/index.ts';
import { rng, type Builder } from '../../scenes/Builder.ts';
import type { SceneContext } from '../../scenes/types.ts';
import { slab, stairs, wallWithHoles } from '../kit.ts';
import { BAY_Y, CATWALK_Y, DOORS, LANDING_Y, SPACES, type DoorDef, type SpaceDef } from './layout.ts';
import { PAL, type VcMats } from './mats.ts';
import { ladderX, ladderZ, rod } from './overhead.ts';
import { crah, batteryRack, eyewash, insulatedPipe, switchboard, upsCabinet } from './props/power.ts';
import {
  wallClock,
  wallScreen,
  cardReader,
  cctvDome,
  cone,
  crashCart,
  cylinderBank,
  exitSign,
  hydrantBox,
  nocDesk,
  pallet,
  serverBox,
  serverLift,
  tileLifter,
  videoWall,
  workbench,
} from './props/facility.ts';
import { serverRack, type RackMats } from './rack.ts';
import { batteryCabinet, lockerBank, palletRack, palletWrapper, pump, rollCage, wrapLoad } from './props/storage.ts';
import { boxTruck } from './props/vehicles.ts';
import { ledDot } from './props/equipment.ts';
import { vendingMachine } from '../../props/lib/index.ts';
import { dressCeiling, dressWall, hatch, roomWalls, type SignSink, type WallKind } from './dress.ts';
import type { SignAtlas, SignId } from './signs.ts';

/**
 * サーバー室の外の部屋（廊下・機械室・開梱室・荷捌き場・監視室・階段・空調機械室）の床・天井・照明・小物。
 * 部屋の種類ごとの「置く物の決まり」で置く（docs/07: 写っていない所も参考画像と同じ作り込み）。
 * 光は本物の器具の下に灯り（ctx.addLamp、照らす箱 = 部屋の内側）。
 */

export interface SpaceEnv {
  ctx: SceneContext;
  vc: VcMats;
  rack: Omit<RackMats, 'b'>;
  signs: SignAtlas;
  signMat: THREE.Material;
  /** 穴あきの床の板（吹き出し。透明の地に切れ込みの図柄） */
  grille: THREE.Material;
  mats: Record<'corrFloor' | 'corrBorder' | 'epoxy' | 'carpet' | 'concrete' | 'ceilGrid' | 'ceilDark' | 'grating' | 'tileFloor' | 'corrugated' | 'acoustic' | 'dado' | 'panel' | 'beam', THREE.Material>;
  /** 部屋ごとの場面の口（灯りを部屋ごとに数えて、見えない部屋の灯りを消すため） */
  ctxFor?: (id: string) => SceneContext;
}

/** 表示板を壁に貼る（中心・幅・高さ・向き） */
export function sign(b: Builder, env: SpaceEnv, id: SignId, c: [number, number, number], w: number, h: number, facing: '+x' | '-x' | '+z' | '-z'): void {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = env.signs.uv(id);
  const a = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < a.count; i++) a.setXY(i, uv[0] + (uv[2] - uv[0]) * a.getX(i), uv[1] + (uv[3] - uv[1]) * a.getY(i));
  if (facing === '-z') g.rotateY(Math.PI);
  if (facing === '+x') g.rotateY(Math.PI / 2);
  if (facing === '-x') g.rotateY(-Math.PI / 2);
  g.translate(c[0], c[1], c[2]);
  b.mesh(g, env.signMat, [0, 0, 0], { shadow: false });
}

/** 穴あきの床の板（0.6 m 角の升目に合わせる。映り込みには出さない層） */
function grilleTile(b: Builder, env: SpaceEnv, x: number, z: number, y = 0.004): void {
  const g = new THREE.PlaneGeometry(0.56, 0.56);
  g.rotateX(-Math.PI / 2);
  g.translate(x, y, z);
  b.mesh(g, env.grille, [0, 0, 0], { shadow: false, layer: 1 });
}

/**
 * エレベーターの乗り場の枠（ステンレスの三方枠・上の階の表示・到着の灯・呼びボタン）。p は扉の中心の床・+z が乗り場の側、w は扉の幅
 */
function liftPortal(p: Prop, w: number, h: number): void {
  const st = '#a9cfd6';
  p.box(st, [-w / 2 - 0.14, 0, 0], [-w / 2, h + 0.02, 0.05], { shadow: false });
  p.box(st, [w / 2, 0, 0], [w / 2 + 0.14, h + 0.02, 0.05], { shadow: false });
  p.box(st, [-w / 2 - 0.14, h, 0], [w / 2 + 0.14, h + 0.3, 0.05], { shadow: false });
  p.box('#16303a', [-0.25, h + 0.06, 0.05], [0.25, h + 0.24, 0.056], { shadow: false });
  for (let k = 0; k < 6; k++) p.box(k === 3 ? PAL.ledAmber : '#3a5560', [-0.21 + k * 0.075, h + 0.12, 0.056], [-0.16 + k * 0.075, h + 0.18, 0.06], { kind: k === 3 ? 'glow' : 'solid', shadow: false });
  for (const s of [-1, 1]) p.box('#cfe6ea', [s * 0.35 - 0.05, h + 0.1, 0.05], [s * 0.35 + 0.05, h + 0.2, 0.06], { kind: 'glow', shadow: false });
  // 敷居（床の金属の帯）
  p.box('#8fb8c2', [-w / 2, 0, -0.02], [w / 2, 0.006, 0.08], { shadow: false });
  const bx = w / 2 + 0.3;
  p.box(st, [bx - 0.06, 1.0, 0], [bx + 0.06, 1.3, 0.02], { r: 0.006, shadow: false });
  p.box(PAL.ledAmber, [bx - 0.02, 1.2, 0.02], [bx + 0.02, 1.24, 0.024], { kind: 'glow', shadow: false });
  p.box('#16303a', [bx - 0.02, 1.08, 0.02], [bx + 0.02, 1.12, 0.024], { shadow: false });
}

/** 細長い照明器具（天井に付く）と光だまり */
function fixture(env: SpaceEnv, p: Prop, x: number, y: number, z: number, along: 'x' | 'z', len: number, box: [number, number, number, number], intensity = 0.4, radius = 3.0, lamp = true): void {
  const hl = len / 2;
  const [sx, sz] = along === 'x' ? [hl, 0.08] : [0.08, hl];
  p.box('#9fc7d0', [x - sx - 0.02, y - 0.06, z - sz - 0.02], [x + sx + 0.02, y, z + sz + 0.02], { shadow: false });
  p.box(PAL.lamp, [x - sx, y - 0.07, z - sz + 0.03], [x + sx, y - 0.06, z + sz - 0.03], { kind: 'glow', shadow: false });
  // 器具の下の四角い光だまり（参考画像の明るい床・暗い隅）。照らす箱は部屋の内側。間の器具は光だまりを持たない（灯りの数を抑える）
  if (lamp) env.ctx.addLamp({ pos: [x, y - 0.4, z], radius, intensity: intensity * 2.5, box: [box[0], y - 6, box[1], box[2], y, box[3]], down: true, square: true, hard: true });
}

/** 扉の横のカードの読み取り機・扉の上の室名の札（廊下の側） */
function doorDress(b: Builder, env: SpaceEnv, P: (pos: [number, number, number], yaw?: number) => Prop, d: DoorDef, id: SignId | null, side: 1 | -1): void {
  // side: 廊下の側の法線の向き（x の壁なら z の +1 / -1）
  if (d.wall !== 'x') return;
  const z = d.line + side * 0.101;
  const yaw = side > 0 ? 0 : Math.PI;
  if (d.state === 'auto') cardReader(P([d.b + 0.28, 0, z], yaw));
  if (id) sign(b, env, id, [(d.a + d.b) / 2, d.y0 + d.h + 0.3, z + side * 0.002], 0.44, 0.22, side > 0 ? '+z' : '-z');
}

export function buildSpaces(env: SpaceEnv, builders: (id: string) => Builder): THREE.Mesh[] {
  const { vc, mats } = env;
  const floors: THREE.Mesh[] = [];
  const R = rng(4242);
  for (const s of SPACES) {
    if (s.kind === 'server' || s.kind === 'lift') continue;
    const b = builders(s.id);
    const sink: PropSink = vc.sink(b);
    const P = (pos: [number, number, number], yaw = 0): Prop => Prop.at(sink, vc, pos, yaw, Math.floor(R() * 1e6));
    const [x0, z0, x1, z1] = s.rect;
    const box = s.rect;
    // 床: 廊下はビニルのタイル、電源の部屋は二重床の板、監視室はタイルカーペット、荷捌き場はコンクリート、ほかは塗り床
    const tiled = s.kind === 'ups' || s.kind === 'battery' || s.kind === 'elec' || s.kind === 'staging';
    const fm = s.kind === 'corridor' || s.kind === 'stair' ? mats.corrFloor : s.kind === 'noc' ? mats.carpet : s.kind === 'dock' ? mats.concrete : tiled ? mats.tileFloor : mats.epoxy;
    const cm = s.kind === 'noc' ? mats.ceilGrid : mats.ceilDark;
    if (s.kind === 'dock') {
      // 荷捌き場: 西の低い床（トラック）と東の荷台の高さの床
      floors.push(slab(b, fm, [x0, z0, -16.0, z1], BAY_Y, 0.3, { shadow: 'receive' }));
      floors.push(slab(b, fm, [-16.0, z0, x1, z1], 0, 1.4, { shadow: 'receive' }));
      slab(b, cm, [x0, z0, x1, z1], s.ceil + 0.2, 0.2, { shadow: false });
    } else if (s.kind === 'corridor' || s.kind === 'stair') {
      // 廊下と階段のホール: 真ん中のタイルと、壁ぎわの濃い色のタイルの帯（0.3 m。見切りの帯。ホールは 4 辺）
      const bw = 0.3;
      if (s.kind === 'corridor') {
        floors.push(slab(b, fm, [x0, z0 + bw, x1, z1 - bw], 0, 0.3, { shadow: 'receive' }));
      } else {
        floors.push(slab(b, fm, [x0 + bw, z0 + bw, x1 - bw, z1 - bw], 0, 0.3, { shadow: 'receive' }));
        floors.push(slab(b, mats.corrBorder, [x0, z0 + bw, x0 + bw, z1 - bw], 0, 0.3, { shadow: 'receive' }));
        floors.push(slab(b, mats.corrBorder, [x1 - bw, z0 + bw, x1, z1 - bw], 0, 0.3, { shadow: 'receive' }));
      }
      floors.push(slab(b, mats.corrBorder, [x0, z0, x1, z0 + bw], 0, 0.3, { shadow: 'receive' }));
      floors.push(slab(b, mats.corrBorder, [x0, z1 - bw, x1, z1], 0, 0.3, { shadow: 'receive' }));
      slab(b, cm, [x0, z0, x1, z1], s.ceil + 0.2, 0.2, { shadow: false });
    } else {
      floors.push(slab(b, fm, [x0, z0, x1, z1], 0, 0.3, { shadow: 'receive' }));
      slab(b, cm, [x0, z0, x1, z1], s.ceil + 0.2, 0.2, { shadow: false });
    }
    dress(s, b, env.ctxFor ? { ...env, ctx: env.ctxFor(s.id) } : env, P, box);
    // 壁と天井の作り込み（部屋の種類ごとの決まり）
    const wk: Record<string, WallKind> = { corridor: 'corridor', noc: 'office', staging: 'office', dock: 'dock', stair: 'stair' };
    const kind = wk[s.kind] ?? 'plant';
    const p0 = P([0, 0, 0]);
    // 壁: 腰の帯は金属の板（材質の筋）・札は図柄・板の継ぎ目の押さえ（波板・羽板の内張りの部屋は内張りの形がそのまま継ぎ目）
    const signs: SignSink = { b, mat: env.signMat, atlas: env.signs };
    const lined = s.kind === 'dock' || s.kind === 'stair' || s.kind === 'ahu' || s.kind === 'noc' || s.kind === 'staging';
    const wo = { b, dadoMat: mats.dado, signs, noJoints: lined, girts: lined && s.kind !== 'noc' ? { from: 2.6, step: 1.5 } : undefined };
    if (s.kind === 'dock') {
      for (const seg of roomWalls([-16.0, z0, x1, z1], 0, s.ceil, ['w'])) dressWall(p0, seg, 'dock', wo);
      for (const seg of roomWalls([x0, z0, -16.0, z1], BAY_Y, s.ceil - BAY_Y, ['e'])) dressWall(p0, seg, 'dock', wo);
    } else {
      for (const seg of roomWalls(s.rect, 0, s.ceil)) dressWall(p0, seg, kind, { ...wo, tray: kind === 'plant' || kind === 'dock' });
    }
    if (s.kind !== 'noc') dressCeiling(p0, s.rect, 0, s.ceil, { duct: s.kind !== 'stair' && s.kind !== 'corridor', trays: s.kind !== 'stair' });
    // 背の高い部屋（荷捌き場・階段・空調機械室）の壁の上は波形の鋼板の内張り（縦の筋）
    if (s.kind === 'dock' || s.kind === 'stair' || s.kind === 'ahu' || s.kind === 'noc' || s.kind === 'staging') {
      const y0 = s.kind === 'dock' ? 1.2 : 1.19;
      const lm = s.kind === 'noc' ? mats.acoustic : mats.corrugated;
      const [x0, z0, x1, z1] = s.rect;
      const t = 0.03;
      // 扉の所は開ける（内張りの板を扉の上だけにする）
      const sideHoles = (line: number, wall: 'x' | 'z', lo: number): { at: number; width: number; bottom: number; top: number }[] =>
        DOORS.filter((d) => d.wall === wall && Math.abs(d.line - line) < 0.06 && Math.abs(d.y0) < 1.5).map((d) => ({ at: (d.a + d.b) / 2 - lo, width: d.b - d.a + 0.12, bottom: 0, top: d.y0 + d.h + 0.06 }));
      wallWithHoles(b, lm, [x0, z0 + t / 2], [x1, z0 + t / 2], y0, s.ceil, t, sideHoles(z0 - 0.1, 'x', x0), { collide: false, shadow: false });
      wallWithHoles(b, lm, [x0, z1 - t / 2], [x1, z1 - t / 2], y0, s.ceil, t, sideHoles(z1 + 0.1, 'x', x0), { collide: false, shadow: false });
      wallWithHoles(b, lm, [x0 + t / 2, z0], [x0 + t / 2, z1], y0, s.ceil, t, sideHoles(x0 - 0.1, 'z', z0), { collide: false, shadow: false });
      wallWithHoles(b, lm, [x1 - t / 2, z0], [x1 - t / 2, z1], y0, s.ceil, t, sideHoles(x1 + 0.1, 'z', z0), { collide: false, shadow: false });
    }
    // 構造の梁と柱型（天井を見せる部屋。約 4.8 m おきに部屋を横切る梁と、その両端の壁の柱型。扉の所には柱型を置かない）
    if (s.kind !== 'noc') structure(b, mats.beam, mats.dado, p0, s.rect, s.kind === 'dock' ? BAY_Y : 0, s.ceil);
    // 階段の上の踊り場の壁（上の階の高さ）も作り込む
    if (s.kind === 'stair') for (const seg of roomWalls([16.05, 7.6, 19.3, 8.6], LANDING_Y * 2, 2.6, ['w', 'n'], 0.03)) dressWall(p0, seg, 'stair', { signs, noJoints: true });
  }
  // 廊下の側の扉まわり（読み取り機・室名の札）
  {
    const b = builders('CORR');
    const sink = vc.sink(b);
    const P = (pos: [number, number, number], yaw = 0): Prop => Prop.at(sink, vc, pos, yaw, Math.floor(R() * 1e6));
    const ids: Record<string, SignId> = { dA: 'A', dB: 'B', dC: 'C', nGas: 'GAS', nUps: 'UPS', nBat: 'BAT', nElec: 'ELEC', cStg: 'STG', cNoc: 'NOC', nLift: 'LIFT' };
    for (const d of DOORS) {
      if (d.line === -12.1 && d.wall === 'x') doorDress(b, env, P, d, ids[d.id] ?? null, -1);
      if (d.line === -14.7 && d.wall === 'x') doorDress(b, env, P, d, ids[d.id] ?? null, 1);
    }
    // 荷物用エレベーターの乗り場の枠と呼びボタン・階の表示
    liftPortal(P([-19.8, 0, -14.58], 0), 1.6, 2.4);
  }
  return floors;
}

function dress(s: SpaceDef, b: Builder, env: SpaceEnv, P: (pos: [number, number, number], yaw?: number) => Prop, box: [number, number, number, number]): void {
  const [x0, z0, x1, z1] = s.rect;
  const p0 = P([0, 0, 0]);
  const ctx = env.ctx;
  switch (s.kind) {
    case 'corridor': {
      const zc = (z0 + z1) / 2;
      // 廊下の器具（1.6 m おき。光だまりは 1 つおき）
      let fi = 0;
      for (let x = x0 + 1.6; x < x1 - 1; x += 1.6) fixture(env, p0, x, s.ceil, zc, 'x', 1.2, box, 0.4, 2.6, fi++ % 2 === 0);
      // 壁の保護の手すり（腰の高さの横の板。扉の所は切る）
      for (const [line, side] of [
        [-12.2, -1],
        [-14.6, 1],
      ] as const) {
        const ds = DOORS.filter((d) => d.wall === 'x' && Math.abs(d.line - (line - side * 0.1)) < 0.05).sort((a, c) => a.a - c.a);
        let x = x0 + 0.3;
        for (const d of [...ds, { a: x1 - 0.3, b: x1 } as DoorDef]) {
          const xa = x;
          const xb = d.a - 0.15;
          if (xb - xa > 0.4) {
            p0.box('#86bfcc', [xa, 0.82, line + side * 0.0], [xb, 0.97, line + side * 0.035], { r: 0.008, shadow: false });
            p0.box(PAL.steelDark, [xa, 0.1, line], [xb, 0.14, line + side * 0.012], { shadow: false });
          }
          x = d.b + 0.15;
        }
      }
      // 消火栓の箱・避難経路図・監視カメラ・非常口の誘導灯・台車・ごみ箱
      for (const x of [-17.0, -10.2, 1.0, 10.6]) hydrantBox(P([x, 0, -14.6], 0));
      sign(b, env, 'MAP', [6.2, 1.5, -14.595], 0.6, 0.42, '+z');
      for (const x of [-16, -2.5, 12]) cctvDome(P([x, s.ceil, zc]));
      exitSign(P([-21.39, 2.35, -13.4], Math.PI / 2));
      exitSign(P([19.39, 2.35, -13.4], -Math.PI / 2));
      crashCart(P([1.9, 0, -12.62], Math.PI));
      trashBin(P([16.2, 0, -12.5], Math.PI), { body: '#5a93a3', lid: '#2f6474' });
      extinguisher(P([-3.0, 0, -14.42], 0), { stand: true, red: '#c0505a' });
      extinguisher(P([9.0, 0, -14.42], 0), { stand: true, red: '#c0505a' });
      break;
    }
    case 'gas': {
      cylinderBank(P([-15.4, 0, -20.6], 0), { n: 8 });
      // 起動の制御盤・放出の表示灯・天井の噴射ノズルの配管
      const cp = P([-12.75, 0, -17.2], -Math.PI / 2);
      // 制御盤（灰色の盤・赤い手動起動の箱と表示灯）
      cp.box('#9fbcc6', [-0.3, 1.0, -0.15], [0.3, 1.8, 0.0], { r: 0.01 });
      cp.box('#86a6b0', [-0.27, 1.03, 0.0], [0.27, 1.77, 0.005], { shadow: false });
      cp.box('#c0505a', [-0.12, 1.06, 0.005], [0.12, 1.26, 0.04], { r: 0.008, shadow: false });
      for (let k = 0; k < 4; k++) ledDot(cp, -0.18 + k * 0.12, 1.6, 0.005, k === 3 ? PAL.ledRed : PAL.ledGreen, 0.015);
      cp.box(PAL.paper, [-0.2, 1.3, 0.005], [0.2, 1.45, 0.008], { shadow: false });
      for (let x = x0 + 0.8; x < x1; x += 1.4) {
        // 放出の配管（亜鉛めっきの鋼管・1.6 m ごとの赤い識別の帯）と噴射ヘッド
        p0.rod('#8fa6ae', [x, s.ceil - 0.25, z0 + 0.5], [x, s.ceil - 0.25, z1 - 0.5], 0.025, { radial: 8, shadow: false });
        for (let z = z0 + 1.2; z < z1 - 0.5; z += 1.6) {
          p0.cyl('#c8d8dc', [x, s.ceil - 0.33, z], 0.035, 0.12, { seg: 10, shadow: false });
          p0.cyl('#b4565c', [x, s.ceil - 0.25, z + 0.4], 0.028, 0.08, { axis: 'z', seg: 8, shadow: false });
        }
      }
      cylinderBank(P([-17.6, 0, -18.0], Math.PI / 2), { n: 5 });
      for (const z of [-19.5, -16.6]) fixture(env, p0, (x0 + x1) / 2, s.ceil, z, 'x', 1.2, box, 0.4, 3.2);
      sign(b, env, 'GASW', [-13.5, 1.6, -14.81], 0.44, 0.22, '-z');
      // 扉の上の放出表示灯（赤く光る箱）と音響の警報（ホーン）・手動起動の箱の札
      {
        // 放出していないときは消えている（白い面に赤い文字の帯）
        const gl = P([-15.15, 2.35, -14.8], Math.PI);
        gl.box('#2a4a58', [-0.3, 0, 0], [0.3, 0.2, 0.08], { r: 0.008, shadow: false });
        gl.box('#d8e4e6', [-0.27, 0.03, 0.08], [0.27, 0.17, 0.084], { shadow: false });
        gl.box('#b8505a', [-0.2, 0.08, 0.084], [0.2, 0.12, 0.086], { shadow: false });
        const hn = P([-14.2, 2.4, -14.8], Math.PI);
        hn.box('#c8d8dc', [-0.1, -0.1, 0], [0.1, 0.1, 0.05], { r: 0.008, shadow: false });
        hn.cyl('#2a4a58', [0, 0, 0.1], 0.09, 0.1, { axis: 'z', radiusTop: 0.05, seg: 14, shadow: false });
      }
      sign(b, env, 'FIRE', [-16.8, 1.6, -14.81], 0.44, 0.22, '-z');
      // 床の黄色い線（ボンベの前）
      p0.box(PAL.yellow, [x0 + 0.4, 0.002, -19.9], [x1 - 0.4, 0.006, -19.84], { shadow: false });
      hatch(p0, x0 + 1.5, -20.2, x1 - 1.0, -19.95);
      break;
    }
    case 'ups': {
      // 北の壁ぎわの列（南向き）と中ほどの列（北向き）。東の壁ぎわに分電盤
      for (let x = x0 + 0.8; x < x1 - 1.0; x += 0.8) {
        const k = Math.round((x - x0) / 0.8);
        if (k % 4 === 3) batteryCabinet(P([x, 0, -20.05], 0), { w: 0.78 });
        else upsCabinet(P([x, 0, -20.05], 0), { screen: k % 3 === 1 });
      }
      for (let x = x0 + 1.4; x < x0 + 8.6; x += 0.8) upsCabinet(P([x, 0, -17.0], Math.PI), { screen: Math.round((x - x0) / 0.8) % 3 === 0 });
      for (let z = -20.0; z < -15.6; z += 0.95) switchboard(P([x1 - 0.85, 0, z + 0.45], -Math.PI / 2), { w: 0.9, meters: 2 });
      ladderX(p0, -18.5, 2.75, x0 + 0.2, x1 - 0.2, 0.5);
      ladderX(p0, -16.0, 2.75, x0 + 0.2, x1 - 0.2, 0.5);
      for (let x = x0 + 1; x < x1; x += 2) {
        rod(p0, x, -18.25, 2.75, s.ceil + 0.2);
        rod(p0, x, -16.25, 2.75, s.ceil + 0.2);
      }
      for (let x = x0 + 1.4; x < x1; x += 2.8) fixture(env, p0, x, s.ceil, -17.5, 'z', 1.2, box, 0.45, 3.2);
      sign(b, env, 'VOLT', [x0 + 0.002, 1.6, -16.0], 0.44, 0.22, '+x');
      // 盤の列の前の吹き出しの床の板（二重床の冷気を盤の吸い込みへ。0.6 m の升目に合わせて 1 枚おき）と、通り道の黄色い線
      for (let x = -12.0 + 0.3; x < x1 - 1.6; x += 1.2) grilleTile(b, env, x, -18.9);
      for (let x = -11.4 + 0.3; x < x0 + 8.6; x += 1.2) grilleTile(b, env, x, -17.7);
      p0.box(PAL.yellow, [x0 + 0.5, 0.002, -18.5], [x1 - 1.5, 0.006, -18.44], { shadow: false });
      hatch(p0, x0 + 0.5, -19.85, x1 - 1.5, -19.65);
      hatch(p0, x0 + 1.0, -17.3, x0 + 8.6, -17.1);
      break;
    }
    case 'battery': {
      for (const z of [-20.2, -18.4, -16.6]) for (let x = 0.3; x < 7.4; x += 2.45) batteryRack(P([x + 1.2, 0, z + 0.03], 0), { len: 2.4 });
      eyewash(P([8.15, 0, -15.6], -Math.PI / 2));
      sign(b, env, 'EYE', [8.395, 1.95, -15.6], 0.36, 0.18, '-x');
      sign(b, env, 'FIRE', [-0.995, 1.6, -17.8], 0.44, 0.22, '+x');
      for (const z of [-19.3, -17.5, -15.7]) fixture(env, p0, 3.7, s.ceil, z, 'x', 1.2, box, 0.4, 3.2);
      // こぼれ止めの箱（黄色い箱と蓋）
      const k = P([-0.4, 0, -15.4], Math.PI / 2);
      k.box(PAL.yellow, [-0.3, 0, -0.2], [0.3, 0.45, 0.2], { r: 0.02 });
      k.box('#b8a34a', [-0.31, 0.45, -0.21], [0.31, 0.5, 0.21], { r: 0.01 });
      break;
    }
    case 'elec': {
      for (let x = x0 + 0.9; x < x1 - 0.5; x += 0.9) switchboard(P([x, 0, -20.2], 0), { meters: 1 + (Math.round(x * 3) % 3) });
      for (let x = x0 + 1.4; x < x0 + 7.0; x += 0.9) switchboard(P([x, 0, -16.9], Math.PI), { meters: 2 });
      // 床のケーブルピットの蓋（縞鋼板）
      for (let x = x0 + 0.6; x < x1 - 0.6; x += 1.0) p0.box('#6f98a4', [x, 0.0, -19.35], [x + 0.97, 0.012, -18.85], { shadow: false });
      hatch(p0, x0 + 0.6, -20.0, x1 - 0.6, -19.8);
      hatch(p0, x0 + 1.0, -17.0, x0 + 7.4, -16.8);
      for (let x = x0 + 1.4; x < x1; x += 2.8) fixture(env, p0, x, s.ceil, -18.5, 'z', 1.2, box, 0.45, 3.2);
      sign(b, env, 'VOLT', [x1 - 0.002, 1.6, -18.0], 0.44, 0.22, '-x');
      break;
    }
    case 'staging': {
      for (let i = 0; i < 4; i++) steelShelf(P([x0 + 0.25, 0, -11.0 + i * 1.3], Math.PI / 2), { w: 1.2, h: 2.0, d: 0.5, load: ['cardboard', 'bins', 'cardboard', 'cardboard', 'bins'], frame: '#8fb8c2', colors: ['#9a8a6c', '#a8977a', '#8f8064'] });
      workbench(P([-17.2, 0, -7.6], 0));
      workbench(P([-17.2, 0, -5.0], Math.PI));
      // パレットの上のサーバーの箱
      for (const [x, z, n] of [
        [-14.2, -10.6, 3],
        [-14.2, -9.2, 2],
        [-19.6, -3.4, 4],
      ] as [number, number, number][]) {
        const q = P([x, 0, z], R2(x * 7 + z));
        pallet(q);
        // 入ってきたままのラップで巻いた荷（開梱の前）と、ほどいた箱の山
        if (n === 4) wrapLoad(q, n);
        else for (let k = 0; k < n; k++) serverBox(q.sub([0, 0.14 + k * 0.29, 0], k % 2 ? 0.04 : -0.03));
      }
      serverLift(P([-12.2, 0, -6.4], -Math.PI / 2));
      // 梱包をほどいたラック（台の上・まだ扉が無い）と、外した木の枠
      serverRack(P([-14.6, 0.14, -5.0], Math.PI / 2), { ...env.rack, b }, { design: 13, door: 'none', h: 2.0, d: 1.0, collide: true, sides: true });
      pallet(P([-15.1, 0, -5.0], 0));
      boxPile(P([-20.6, 0, -6.0], 0.2), { n: 5, colors: ['#9a8a6c', '#a8977a'] });
      trashBin(P([-12.0, 0, -11.4], 0), { kind: 'recycle', body: '#5a93a3' });
      // 東の壁ぎわ: 組み立て中のラック 3 本（扉なし・機器と LED）
      for (let k = 0; k < 3; k++) serverRack(P([-12.45, 0, -10.6 + k * 0.62], -Math.PI / 2), { ...env.rack, b }, { design: (k * 5 + 2) % 16, door: 'none', h: 2.0, d: 1.0, back: false, collide: true, sides: k === 0 || k === 2 });
      // 南の壁ぎわ（西）: パレットラック
      palletRack(P([-19.6, 0, -2.25], Math.PI), { w: 2.7, levels: 3, h: 2.9 });
      for (const z of [-10, -6.5, -3.5]) for (const x of [-18.8, -14.0]) fixture(env, p0, x, s.ceil, z, 'x', 1.2, box, 0.42, 3.4);
      break;
    }
    case 'dock': {
      // 荷台の高さの床の縁（黄色い帯）・車止めのゴム・渡り板・低い床へ下りる階段
      p0.box(PAL.yellow, [-16.0, 0, z0 + 0.2], [-15.85, 0.004, z1 - 0.2], { shadow: false });
      hatch(p0, -15.85, z0 + 0.2, -15.5, z1 - 0.2);
      for (let z = z0 + 1.6; z < z1 - 1; z += 2.0) p0.box(PAL.black, [-16.12, BAY_Y + 0.6, z - 0.2], [-16.0, BAY_Y + 1.0, z + 0.2], { r: 0.02 });
      stairs(b, env.mats.concrete, [-17.9, BAY_Y, -1.75 + 0.6], '+x', -BAY_Y, 1.1, { tread: 0.3 });
      nosings(p0, [-17.9, BAY_Y, -1.75 + 0.6], '+x', -BAY_Y, 1.1, 0.3);
      // 階段の手すり
      p0.bend(PAL.yellow, [[-17.9, BAY_Y + 0.9, -0.55], [-16.1, 0.9, -0.55]], 0.02, 0.05, { shadow: false });
      // パレットと箱・パレットの運ぶ台車・車輪止め・柱の保護
      for (const [x, z, n] of [
        [-13.2, 0.5, 3],
        [-13.2, 6.8, 2],
        [-19.0, 1.5, 0],
      ] as [number, number, number][]) {
        const y = x < -16 ? BAY_Y : 0;
        const q = P([x, y, z], 0);
        pallet(q);
        for (let k = 0; k < n; k++) serverBox(q.sub([0, 0.14 + k * 0.29, 0], k * 0.05));
      }
      palletJack(P([-14.6, 0, 6.8], -Math.PI / 2));
      // ラップの巻き機（回る台の上に巻いた荷）。出荷の前に荷をフィルムで巻く所
      palletWrapper(P([-14.1, 0, 5.0], -Math.PI / 2));
      // 東の壁ぎわのパレットラック 2 台・カゴ台車・低い床のトラック
      for (const z of [0.0, 2.85]) palletRack(P([-12.45, 0, z], -Math.PI / 2), { w: 2.7, levels: 3, h: 3.4 });
      for (const [x, z, yw] of [
        [-14.6, 7.7, 0.1],
        [-13.7, 7.9, -0.15],
        [-13.9, -1.05, 0.3],
      ] as [number, number, number][])
        rollCage(P([x, 0, z], yw));
      // 2 t のアルミバン（南のシャッターから入って、荷台の高さの床の縁に横付け。前は北）
      boxTruck(P([-17.3, BAY_Y, 4.3], Math.PI));
      for (const x of [-20.6, -17.4]) p0.cyl(PAL.yellow, [x, BAY_Y + 0.5, 8.2], 0.08, 1.0, { seg: 12 });
      // 高天井の器具: 届く距離は床まで（低い床 -1.1 m まで 5.3 m）。床に器具ごとの四角い光だまり
      for (let z = 0.5; z < z1; z += 3.0) for (const x of [-18.6, -13.6]) fixture(env, p0, x, s.ceil, z, 'x', 1.4, [x0, z0, x1, z1], 0.4, 5.6);
      sign(b, env, 'DOCK', [-11.305, 2.2, -1.0], 0.5, 0.25, '-x');
      break;
    }
    case 'noc': {
      videoWall(P([x1 - 0.02, 0, -8.0], -Math.PI / 2), { cols: 3, rows: 2 });
      // 画面の上の世界の時計・西と南の壁の画面・状態の表示灯
      for (let k = 0; k < 4; k++) wallClock(P([x1 - 0.03, 2.48, -9.6 + k * 1.05], -Math.PI / 2), 0.13);
      for (const z of [-10.8, -8.6, -6.4]) wallScreen(P([x0 + 0.04, 1.75, z], Math.PI / 2), { w: 1.1 });
      // 南の壁の画面（階段のホールへの扉 x 12〜13 を避ける）
      for (const x of [14.3, 16.1, 17.9]) wallScreen(P([x, 1.75, z1 - 0.04], Math.PI), { w: 1.1, tone: '#1f6a86' });
      for (let k = 0; k < 3; k++) {
        const t = P([x1 - 0.25, 0, -11.6 + k * 0.08], 0);
        t.cyl(PAL.steelDark, [0, 1.0, 0], 0.012, 2.0, { seg: 6, shadow: false });
      }
      const tw = P([x1 - 0.25, 2.0, -11.5], 0);
      for (const [y, c] of [
        [0.0, PAL.ledGreen],
        [0.08, PAL.ledAmber],
        [0.16, PAL.ledRed],
      ] as [number, string][])
        tw.cyl(c, [0, y, 0], 0.04, 0.07, { seg: 12, kind: 'glow', shadow: false });
      for (const x of [16.6, 14.2])
        for (const z of [-9.3, -7.5, -5.7]) {
          nocDesk(P([x, 0, z], -Math.PI / 2), { w: 1.6 });
          chair(P([x - 0.75, 0, z + 0.1], -Math.PI / 2 + (R2(x + z) - 0.5) * 0.6), { kind: 'office', seat: '#1d4a5c', frame: '#2b3f46', base: '#1a2a30' });
        }
      // 天井の格子に入る 0.6 m 角の光る板（1.2 m おき。光だまりは 2.4 m おき）と、間の煙感知器・スピーカー
      for (let x = 12.4; x < x1; x += 1.2)
        for (const z of [-10.5, -9.0, -7.5, -6.25, -5.0]) {
          const main = Math.round((x - 12.4) / 1.2) % 2 === 0 && (z === -10.5 || z === -7.5 || z === -5.0);
          const gx = Math.round(x / 0.6) * 0.6 + 0.3;
          const gz = Math.round(z / 0.6) * 0.6 + 0.3;
          p0.box('#9fc7d0', [gx - 0.3, s.ceil - 0.02, gz - 0.3], [gx + 0.3, s.ceil, gz + 0.3], { shadow: false });
          p0.box(PAL.lamp, [gx - 0.27, s.ceil - 0.025, gz - 0.27], [gx + 0.27, s.ceil - 0.02, gz + 0.27], { kind: 'glow', shadow: false });
          if (main) env.ctx.addLamp({ pos: [gx, s.ceil - 0.4, gz], radius: 2.6, intensity: 0.38 * 2.5, box: [box[0], s.ceil - 6, box[1], box[2], s.ceil, box[3]], down: true, square: true, hard: true });
          else if (z === -9.0 || z === -6.25) {
            p0.cyl('#d8eef0', [gx + 0.6, s.ceil - 0.025, gz], 0.06, 0.05, { seg: 14, shadow: false });
            p0.cyl('#c8d8dc', [gx - 0.6, s.ceil - 0.01, gz], 0.1, 0.02, { seg: 16, shadow: false });
            p0.cyl('#5a7a86', [gx - 0.6, s.ceil - 0.022, gz], 0.07, 0.004, { seg: 16, shadow: false });
          }
        }
      pottedPlant(P([11.7, 0, -11.5], 0), { pot: '#cfe6ea', leaf: '#3f8f7a' });
      // 北の壁ぎわの通信ラック 4 本（ガラス扉・LED）
      for (let k = 0; k < 4; k++) serverRack(P([15.6 + k * 0.62, 0, -10.85], 0), { ...env.rack, b }, { design: (k * 3 + 1) % 16, h: 2.0, d: 1.0, streak: k % 4, collide: true, sides: k === 0 || k === 3 });
      steelShelf(P([11.45, 0, -5.4], Math.PI / 2), { w: 1.0, h: 1.8, d: 0.4, load: ['binders', 'binders', 'paper', 'bins'], frame: '#8fb8c2', colors: ['#2f6f86', '#4f9fb5', '#d8eef0'] });
      break;
    }
    case 'stair': {
      // U 字の階段: 1 本目（東・北へ上る）→ 踊り場 → 2 本目（南へ上る）→ 上の階の扉
      const w1 = 1.55;
      const r1 = stairs(b, env.mats.concrete, [18.5, 0, 7.6], '-z', LANDING_Y, w1, { tread: 0.28 });
      slab(b, env.mats.concrete, [16.05, r1.top[2] - 1.7, 19.3, r1.top[2]], LANDING_Y, 0.25);
      stairs(b, env.mats.concrete, [16.85, LANDING_Y, r1.top[2]], '+z', LANDING_Y, w1, { tread: 0.28 });
      nosings(p0, [18.5, 0, 7.6], '-z', LANDING_Y, w1, 0.28);
      nosings(p0, [16.85, LANDING_Y, r1.top[2]], '+z', LANDING_Y, w1, 0.28);
      slab(b, env.mats.concrete, [16.05, 7.6, 19.3, 8.6], LANDING_Y * 2, 0.25);
      // 2 本の間の壁（手すりの壁）と手すり
      b.boxMM(env.mats.panel, [17.62, 0, r1.top[2]], [17.72, LANDING_Y * 2 + 1.0, 7.6], { collide: true });
      // 間の壁の両面の手すり（段の勾配に沿う・受けの金物）と、腰の帯・壁の階の札
      p0.bend('#9fc7d0', [[17.77, 0.9, 7.6], [17.77, LANDING_Y + 0.9, r1.top[2]]], 0.022, 0.05, { shadow: false });
      p0.bend('#9fc7d0', [[17.57, LANDING_Y + 0.9, r1.top[2]], [17.57, LANDING_Y * 2 + 0.9, 7.6]], 0.022, 0.05, { shadow: false });
      for (let k = 1; k < 5; k++) {
        const t = k / 5;
        const z = 7.6 + (r1.top[2] - 7.6) * t;
        p0.box(PAL.steelDark, [17.72, 0.8 + LANDING_Y * t, z - 0.015], [17.77, 0.88 + LANDING_Y * t, z + 0.015], { shadow: false });
        const z2 = r1.top[2] + (7.6 - r1.top[2]) * t;
        p0.box(PAL.steelDark, [17.57, LANDING_Y + 0.8 + LANDING_Y * t, z2 - 0.015], [17.62, LANDING_Y + 0.88 + LANDING_Y * t, z2 + 0.015], { shadow: false });
      }
      for (const [x0w, x1w] of [[17.72, 17.735], [17.605, 17.62]] as [number, number][]) {
        p0.box('#174a5e', [x0w, LANDING_Y * 2 + 0.05, r1.top[2]], [x1w, LANDING_Y * 2 + 1.0, 7.6], { shadow: false });
        p0.box('#174a5e', [x0w, 0.0, r1.top[2]], [x1w, 0.12, 7.6], { shadow: false });
      }
      p0.box('#d8eef0', [17.6, 3.2, 4.6], [17.605, 3.6, 5.2], { shadow: false });
      p0.box('#14404e', [17.598, 3.3, 4.75], [17.6, 3.5, 5.05], { shadow: false });
      p0.bend('#9fc7d0', [[19.3 - 0.05, 0.9, 7.6], [19.3 - 0.05, LANDING_Y + 0.9, r1.top[2]]], 0.022, 0.05, { shadow: false });
      p0.bend('#9fc7d0', [[16.1, LANDING_Y + 0.9, r1.top[2]], [16.1, LANDING_Y * 2 + 0.9, 7.6]], 0.022, 0.05, { shadow: false });
      for (const [x, z] of [
        [16.1, 7.6],
        [16.1, r1.top[2]],
      ])
        p0.box('#9fc7d0', [x - 0.02, 0, z - 0.02], [x + 0.02, LANDING_Y * 2 + 0.9, z + 0.02], { shadow: false });
      // 2 本目の外側の側桁（段の勾配に沿う暗い鋼の溝形）と手すりの縦の子（0.15 m おき）・踊り場の縁の梁と子
      {
        const za = r1.top[2];
        const zb = 7.6;
        const slope = (z: number): number => LANDING_Y + ((z - za) / (zb - za)) * LANDING_Y;
        p0.extrude('#2a5a6c', [[za, LANDING_Y - 0.3], [zb, LANDING_Y * 2 - 0.3], [zb, LANDING_Y * 2 + 0.05], [za, LANDING_Y + 0.05]], 'zy', 16.02, 16.08, { shadow: false });
        for (let z = za + 0.1; z < zb - 0.05; z += 0.15) {
          const y = slope(z) + 0.02;
          p0.box('#9fc7d0', [16.09, y, z - 0.01], [16.11, y + 0.86, z + 0.01], { shadow: false });
        }
        p0.box('#2a5a6c', [16.02, LANDING_Y - 0.4, za - 1.7], [19.3, LANDING_Y - 0.25, za - 1.62], { shadow: false });
        p0.box('#2a5a6c', [16.02, LANDING_Y - 0.4, za - 1.7], [16.1, LANDING_Y - 0.25, za], { shadow: false });
        for (let z = za - 1.6; z < za; z += 0.15) p0.box('#9fc7d0', [16.09, LANDING_Y, z - 0.01], [16.11, LANDING_Y + 0.9, z + 0.01], { shadow: false });
        p0.box('#9fc7d0', [16.08, LANDING_Y + 0.88, za - 1.7], [16.12, LANDING_Y + 0.92, za], { shadow: false });
        // 2 本目の下の物入れ（踊り場の下を囲う壁と点検の扉）
        b.boxMM(env.mats.panel, [16.08, 0, za - 1.68], [16.14, LANDING_Y - 0.25, za + 1.4], { collide: true });
        b.boxMM(env.mats.panel, [16.08, 0, za - 1.74], [19.3, LANDING_Y - 0.25, za - 1.68], { collide: true });
        const sd = P([16.06, 0, za - 0.3], -Math.PI / 2);
        sd.box('#2f6f86', [-0.4, 0.0, -0.01], [0.4, 1.9, 0.02], { shadow: false });
        sd.box(PAL.steel, [0.28, 0.95, 0.02], [0.32, 1.1, 0.04], { shadow: false });
        sd.box(PAL.paper, [-0.15, 1.6, 0.02], [0.15, 1.68, 0.024], { shadow: false });
      }
      sign(b, env, 'UP', [19.395, LANDING_Y * 2 + 2.45, 8.1], 0.36, 0.18, '-x');
      // 階の大きな数字（壁の塗り）・壁の手すり・消火栓の箱・掲示
      sign(b, env, 'UP', [11.205, 3.4, 4.0], 1.6, 0.8, '+x');
      p0.box('#9fc7d0', [11.22, 0.88, -3.6], [11.26, 0.92, 8.4], { shadow: false });
      for (let z = -3.4; z < 8.4; z += 1.2) p0.box(PAL.steelDark, [11.2, 0.82, z], [11.26, 0.9, z + 0.03], { shadow: false });
      hydrantBox(P([12.6, 0, 8.58], Math.PI));
      for (const x of [13.6, 15.0]) wallScreen(P([x, 1.7, 8.56], Math.PI), { w: 0.9, tone: '#1f6a86' });
      exitSign(P([19.39, LANDING_Y * 2 + 2.3, 8.1], -Math.PI / 2));
      // 人の乗るエレベーター 2 基の乗り場の枠・表示・呼びボタン
      liftPortal(P([19.37, 0, 1.2], -Math.PI / 2), 1.2, 2.2);
      liftPortal(P([19.37, 0, -1.0], -Math.PI / 2), 1.2, 2.2);
      // 北の壁の高い所の階の数字（壁の塗りの札）
      sign(b, env, 'UP', [15.2, 3.6, -3.765], 1.4, 0.7, '+z');
      bench(P([12.0, 0, 1.0], Math.PI / 2), { kind: 'seats', w: 1.8, seat: '#2f6f86', frame: '#8fb8c2' });
      lockerBank(P([11.75, 0, -2.0], Math.PI / 2), { cols: 4 });
      vendingMachine(P([11.7, 0, 5.4], Math.PI / 2), { body: '#d8e8ea', accent: '#2f7a96', lit: '#e8f8fa' });
      vendingMachine(P([11.7, 0, 6.8 + 0.6], Math.PI / 2), { body: '#2f5f74', accent: '#5fd0e8', lit: '#e8f8fa', goods: 'snack' });
      pottedPlant(P([11.8, 0, 3.4], 0), { pot: '#cfe6ea', leaf: '#3f8f7a' });
      extinguisher(P([11.45, 0, -2.6], Math.PI / 2), { stand: true, red: '#c0505a' });
      // 吹き抜けの器具は床まで届く距離（6 m の天井から床の光だまり）
      for (const z of [-2.0, 1.5]) fixture(env, p0, 14.0, s.ceil, z, 'x', 1.2, box, 0.4, 7.0);
      fixture(env, p0, 17.6, s.ceil, 5.0, 'x', 1.2, box, 0.45, 6.0);
      // 吹き抜けの高い所: 連結送水管（赤い立て管と各階の放水口の箱）・排煙の窓の羽根・壁の照明・上の横のダクト
      p0.cyl('#b4565c', [15.85, s.ceil / 2, 8.45], 0.06, s.ceil, { seg: 12, shadow: false });
      for (const y of [1.0, LANDING_Y * 2 + 1.0]) {
        const hb = P([15.4, y, 8.58], Math.PI);
        hb.box(PAL.red, [-0.3, -0.35, -0.02], [0.3, 0.35, 0.16], { r: 0.01 });
        hb.box('#9e3f47', [-0.27, -0.32, 0.16], [0.27, 0.32, 0.166], { shadow: false });
        hb.box(PAL.paper, [-0.18, 0.18, 0.166], [0.18, 0.26, 0.17], { shadow: false });
        hb.box(PAL.steel, [0.18, -0.05, 0.166], [0.21, 0.08, 0.19], { shadow: false });
      }
      for (let y = 0.5; y < s.ceil; y += 1.6) p0.box(PAL.steelDark, [15.75, y, 8.38], [15.95, y + 0.04, 8.6], { shadow: false });
      {
        // 排煙の窓（西の壁の高い所・横の羽根）と開ける手動の箱
        const lv = P([11.22, 4.2, 0.6], Math.PI / 2);
        lv.box('#2a6a80', [-1.0, 0, 0], [1.0, 1.0, 0.05], { shadow: false });
        lv.box('#173f50', [-0.95, 0.05, 0.05], [0.95, 0.95, 0.052], { shadow: false });
        for (let k = 0; k < 11; k++) lv.box('#5f9fb2', [-0.95, 0.07 + k * 0.08, 0.05], [0.95, 0.11 + k * 0.08, 0.08], { shadow: false });
        const op = P([11.22, 0, -0.3], Math.PI / 2);
        op.box('#c8d8dc', [-0.12, 1.3, 0], [0.12, 1.6, 0.06], { r: 0.008, shadow: false });
        op.box(PAL.red, [-0.08, 1.4, 0.06], [0.08, 1.5, 0.065], { shadow: false });
        op.box(PAL.steelDark, [-0.008, 1.6, 0.02], [0.008, 4.2, 0.036], { shadow: false });
      }
      // 壁の高い所の照明（吹き抜けの壁を上から照らす）
      for (const z of [-1.5, 3.0]) {
        const wl = P([11.22, 4.0, z], Math.PI / 2);
        wl.box('#2a4a58', [-0.25, 0, 0], [0.25, 0.12, 0.2], { r: 0.01, shadow: false });
        wl.box(PAL.lamp, [-0.22, -0.005, 0.02], [0.22, 0.0, 0.18], { kind: 'glow', shadow: false });
      }
      // 北の壁の上の横のダクトと吊り・南の壁の上の電線管
      p0.box('#2f6f86', [11.3, 5.0, -3.75], [19.3, 5.45, -3.15], { r: 0.01, shadow: false });
      for (let x = 12.2; x < 19.3; x += 1.2) p0.box('#3d8098', [x, 4.99, -3.76], [x + 0.04, 5.46, -3.14], { shadow: false });
      for (let x = 12.0; x < 19.3; x += 2.4) p0.box(PAL.steelDark, [x, 5.45, -3.5], [x + 0.03, s.ceil, -3.47], { shadow: false });
      // 外壁の高い所の型板ガラスの窓（東 = 階段の上の横長の窓、南 = 吹き抜けの高窓）。外は見えない曇りガラスで、光る面と桟・無目・額縁
      const win = (q: Prop, w: number, h: number, cols: number): void => {
        q.box('#1d3c48', [-w / 2 - 0.06, -0.06, 0], [w / 2 + 0.06, h + 0.06, 0.06], { shadow: false });
        q.box('#7fc4d2', [-w / 2, 0, 0.061], [w / 2, h, 0.063], { kind: 'glow', shadow: false });
        for (let c = 1; c < cols; c++) q.box('#2a4a58', [-w / 2 + (c * w) / cols - 0.025, 0, 0.063], [-w / 2 + (c * w) / cols + 0.025, h, 0.09], { shadow: false });
        q.box('#2a4a58', [-w / 2, h * 0.55 - 0.025, 0.063], [w / 2, h * 0.55 + 0.025, 0.09], { shadow: false });
        q.box('#8fb8c2', [-w / 2 - 0.08, -0.09, 0], [w / 2 + 0.08, -0.05, 0.16], { shadow: false });
        // 開ける窓の取っ手（下の段の桟ごと）
        for (let c = 0; c < cols; c++) q.box(PAL.steel, [-w / 2 + ((c + 0.5) * w) / cols - 0.03, h * 0.3, 0.063], [-w / 2 + ((c + 0.5) * w) / cols + 0.03, h * 0.3 + 0.02, 0.08], { shadow: false });
      };
      win(P([19.36, 3.1, 5.0], -Math.PI / 2), 4.2, 1.2, 6);
      win(P([13.9, 3.7, 8.56], Math.PI), 3.6, 1.0, 5);
      // 窓からの明かり（階段と踊り場に落ちる四角い光だまり）
      ctx.addLamp({ pos: [17.8, 3.6, 5.0], radius: 3.2, intensity: 0.45, box: [16.0, -0.1, 2.3, 19.35, 6.0, 7.6], square: true });
      // フロアの案内（北の壁）・AED の箱・傘立て・ごみ箱
      {
        const dir = P([16.2, 0, -3.78], 0);
        dir.box('#2a4a58', [-0.65, 1.1, 0], [0.65, 2.0, 0.03], { r: 0.006, shadow: false });
        dir.box('#d8eef0', [-0.62, 1.13, 0.03], [0.62, 1.97, 0.033], { shadow: false });
        for (let k = 0; k < 6; k++) {
          dir.box(k % 2 ? '#2f7a96' : '#3c9a6c', [-0.55, 1.82 - k * 0.12, 0.033], [-0.42, 1.88 - k * 0.12, 0.036], { shadow: false });
          dir.box('#4a6a78', [-0.36, 1.83 - k * 0.12, 0.033], [0.1 + (k % 3) * 0.1, 1.86 - k * 0.12, 0.036], { shadow: false });
        }
        const aed = P([11.22, 0, 2.4], Math.PI / 2);
        aed.box('#e8f2f2', [-0.22, 1.0, 0], [0.22, 1.45, 0.16], { r: 0.012 });
        aed.box(PAL.green, [-0.2, 1.33, 0.16], [0.2, 1.43, 0.164], { shadow: false });
        aed.box('#c84a50', [-0.06, 1.12, 0.16], [0.06, 1.24, 0.164], { shadow: false });
        aed.box('#c84a50', [-0.15, 1.6, 0], [0.15, 1.75, 0.008], { shadow: false });
        trashBin(P([18.8, 0, -3.3], 0), { kind: 'recycle', body: '#5a93a3' });
        const um = P([18.9, 0, -2.7], 0);
        um.box('#8fb8c2', [-0.25, 0, -0.12], [0.25, 0.55, 0.12], { r: 0.01 });
        for (let k = 0; k < 5; k++) um.box('#2a4a58', [-0.2 + k * 0.1, 0.55, -0.08], [-0.18 + k * 0.1, 0.62, 0.08], { shadow: false });
      }
      break;
    }
    case 'ahu': {
      for (const x of [-7.6, -5.4, -0.6, 1.6, 4.4, 6.8]) crah(P([x, 0, 5.1], 0));
      // 冷水の配管（南の壁ぎわ・2 本）と支え
      insulatedPipe(p0, [x0, 4.45, 8.2], [x1, 4.45, 8.2], 0.14);
      insulatedPipe(p0, [x0, 4.8, 7.85], [x1, 4.8, 7.85], 0.12, '#93c0c9');
      for (let x = x0 + 1; x < x1; x += 2.2) {
        p0.box(PAL.steelDark, [x - 0.03, 4.2, 7.5], [x + 0.03, s.ceil + 0.2, 8.5], { shadow: false });
        p0.box(PAL.steelDark, [x - 0.03, 4.2, 7.5], [x + 0.03, 4.26, 8.5], { shadow: false });
      }
      // 中 2 階の点検通路（縞鋼板の床・手すり・柱）と、東の端の階段
      slab(b, env.mats.grating, [-10.6, 7.4, 7.1, 8.55], CATWALK_Y, 0.08);
      for (let x = -10.5; x < 6.95; x += 0.12) p0.box('#5d8d99', [x, CATWALK_Y - 0.08, 7.42], [x + 0.03, CATWALK_Y - 0.002, 8.52], { shadow: false });
      for (let x = -10.4; x <= 6.9; x += 2.1) {
        p0.box('#7fb0bd', [x - 0.04, 0, 7.4], [x + 0.04, CATWALK_Y - 0.08, 7.48]);
        p0.box('#9fc7d0', [x - 0.02, CATWALK_Y, 7.42], [x + 0.02, CATWALK_Y + 1.1, 7.46], { shadow: false });
      }
      p0.box('#9fc7d0', [-10.6, CATWALK_Y + 1.06, 7.41], [6.9, CATWALK_Y + 1.1, 7.47], { shadow: false });
      p0.box('#9fc7d0', [-10.6, CATWALK_Y + 0.55, 7.42], [6.9, CATWALK_Y + 0.58, 7.46], { shadow: false });
      p0.box(PAL.yellow, [-10.6, CATWALK_Y, 7.40], [6.9, CATWALK_Y + 0.1, 7.43], { shadow: false });
      env.ctx.colliders.add({ x: -10.6, y: CATWALK_Y, z: 7.38 }, { x: 6.9, y: CATWALK_Y + 1.1, z: 7.44 });
      stairs(b, env.mats.grating, [10.85, 0, 8.0], '-x', CATWALK_Y, 1.0, { tread: 0.27 });
      nosings(p0, [10.85, 0, 8.0], '-x', CATWALK_Y, 1.0, 0.27);
      p0.bend('#9fc7d0', [[10.85, 0.9, 7.45], [6.9, CATWALK_Y + 0.9, 7.45]], 0.02, 0.05, { shadow: false });
      // 器具の列（1.6 m おき。光だまりは 1 つおき）と、点検通路の上の 2 列目
      for (let x = x0 + 1.5; x < x1; x += 1.6) {
        fixture(env, p0, x, s.ceil, 5.8, 'x', 1.4, box, 0.42, 6.0, Math.round((x - x0 - 1.5) / 1.6) % 2 === 0);
        fixture(env, p0, x, s.ceil, 7.0, 'x', 1.4, box, 0.42, 6.0, false);
      }
      sign(b, env, 'AHU', [-10.895, 2.3, 6.1], 0.44, 0.22, '+x');
      // 点検通路の下のポンプの列（冷水）
      for (const x of [-9.2, -6.0, -2.9, 0.3, 3.4]) pump(P([x, 0, 8.05], 0));
      break;
    }
    default:
      break;
  }
  void ladderZ;
  void tileLifter;
  void cone;
}

/**
 * 梁と柱型（部屋の短い向きに梁を渡し、両端の壁に柱型）。柱型には壁と同じ腰の板を巻き、角の保護の金物（ステンレスの L 字）・
 * 巾木・見切り・柱の番号の札を付ける（柱型が無地の箱にならないように）
 */
function structure(b: Builder, mat: THREE.Material, dado: THREE.Material, p: Prop, rect: [number, number, number, number], y0: number, ceil: number): void {
  const [x0, z0, x1, z1] = rect;
  const alongX = x1 - x0 >= z1 - z0;
  const a0 = alongX ? x0 : z0;
  const a1 = alongX ? x1 : z1;
  const c0 = alongX ? z0 : x0;
  const c1 = alongX ? z1 : x1;
  const n = Math.max(1, Math.round((a1 - a0) / 4.8));
  const step = (a1 - a0) / n;
  const doorNear = (u: number, c: number): boolean =>
    DOORS.some((d) => {
      const wallX = alongX ? 'x' : 'z';
      if (d.wall !== wallX) return false;
      if (Math.abs(d.line - c) > 0.25) return false;
      return u > d.a - 0.6 && u < d.b + 0.6;
    });
  // 場面の座標の箱（u = 部屋の長い向き・v = 短い向き・h = 高さ）
  const at = (u0: number, u1: number, v0: number, v1: number, h0: number, h1: number): [[number, number, number], [number, number, number]] =>
    alongX ? [[Math.min(u0, u1), h0, Math.min(v0, v1)], [Math.max(u0, u1), h1, Math.max(v0, v1)]] : [[Math.min(v0, v1), h0, Math.min(u0, u1)], [Math.max(v0, v1), h1, Math.max(u0, u1)]];
  for (let k = 1; k < n; k++) {
    const u = a0 + k * step;
    const bw = 0.4;
    const by0 = ceil - 0.55;
    if (alongX) b.boxMM(mat, [u - bw / 2, by0, c0], [u + bw / 2, ceil + 0.2, c1], { shadow: false });
    else b.boxMM(mat, [c0, by0, u - bw / 2], [c1, ceil + 0.2, u + bw / 2], { shadow: false });
    for (const [c, sgn] of [
      [c0, 1],
      [c1, -1],
    ] as [number, number][]) {
      if (doorNear(u, c - sgn * 0.1)) continue;
      const d0 = c;
      const d1 = c + sgn * 0.22;
      if (alongX) b.boxMM(mat, [u - 0.3, y0, Math.min(d0, d1)], [u + 0.3, ceil, Math.max(d0, d1)], { collide: true, shadow: false });
      else b.boxMM(mat, [Math.min(d0, d1), y0, u - 0.3], [Math.max(d0, d1), ceil, u + 0.3], { collide: true, shadow: false });
      const [m0, m1] = at(u - 0.31, u + 0.31, d0, d1 + sgn * 0.01, y0 + 0.1, y0 + 1.15);
      b.boxMM(dado, m0, m1, { shadow: false });
      const [k0, k1] = at(u - 0.312, u + 0.312, d0, d1 + sgn * 0.016, y0, y0 + 0.1);
      p.box('#0f2f3c', k0, k1, { shadow: false });
      const [t0, t1] = at(u - 0.312, u + 0.312, d0, d1 + sgn * 0.016, y0 + 1.15, y0 + 1.18);
      p.box('#3d8aa4', t0, t1, { shadow: false });
      for (const e of [-1, 1]) {
        const [g0, g1] = at(u + e * 0.3 - 0.026, u + e * 0.3 + 0.026, d1 - sgn * 0.03, d1 + sgn * 0.018, y0 + 0.1, y0 + 1.4);
        p.box('#a9cfd6', g0, g1, { shadow: false });
      }
      const [l0, l1] = at(u - 0.1, u + 0.1, d1, d1 + sgn * 0.006, y0 + 1.75, y0 + 1.87);
      p.box(PAL.paper, l0, l1, { shadow: false });
      const [n0, n1] = at(u - 0.06, u + 0.06, d1, d1 + sgn * 0.008, y0 + 1.79, y0 + 1.83);
      p.box('#14303c', n0, n1, { shadow: false });
    }
  }
}

/** 階段の段鼻の滑り止め（段ごとの黄色い帯と暗い溝）。stairs() と同じ段の割り付け（1 段 0.17 m 前後・踏み面 tread） */
function nosings(p: Prop, from: [number, number, number], dir: '+x' | '-x' | '+z' | '-z', rise: number, width: number, tread: number): void {
  const n = Math.max(1, Math.round(rise / 0.17));
  const rh = rise / n;
  const sx = dir === '+x' ? 1 : dir === '-x' ? -1 : 0;
  const sz = dir === '+z' ? 1 : dir === '-z' ? -1 : 0;
  const hw = width / 2 - 0.05;
  const strip = (a0: number, a1: number, y: number, col: string): void => {
    if (sx !== 0) p.box(col, [Math.min(from[0] + sx * a0, from[0] + sx * a1), y, from[2] - hw], [Math.max(from[0] + sx * a0, from[0] + sx * a1), y + 0.004, from[2] + hw], { shadow: false });
    else p.box(col, [from[0] - hw, y, Math.min(from[2] + sz * a0, from[2] + sz * a1)], [from[0] + hw, y + 0.004, Math.max(from[2] + sz * a0, from[2] + sz * a1)], { shadow: false });
  };
  for (let i = 0; i < n; i++) {
    const y = from[1] + (i + 1) * rh;
    const a = i * tread;
    strip(a + 0.01, a + 0.06, y, PAL.yellow);
    strip(a + 0.065, a + 0.08, y, '#1a2a30');
  }
}

function R2(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** パレットを運ぶ手押しの台車（ハンドル・2 本のフォーク・車輪） */
export function palletJack(p: Prop): void {
  for (const x of [-0.2, 0.2]) {
    p.box('#c4643c', [x - 0.08, 0.04, -1.1], [x + 0.08, 0.09, 0.0], { r: 0.01 });
    p.cyl(PAL.black, [x, 0.035, -1.0], 0.035, 0.08, { axis: 'x', seg: 10, shadow: false });
  }
  p.box('#c4643c', [-0.28, 0.04, 0.0], [0.28, 0.3, 0.25], { r: 0.02 });
  p.cyl(PAL.black, [0, 0.08, 0.15], 0.08, 0.1, { axis: 'x', seg: 12, shadow: false });
  p.bend('#c4643c', [[0, 0.3, 0.15], [0, 0.8, 0.45], [0, 1.15, 0.6]], 0.02, 0.1, { shadow: false });
  p.bend(PAL.black, [[-0.15, 1.15, 0.6], [0.15, 1.15, 0.6]], 0.018, 0.02, { shadow: false });
}
