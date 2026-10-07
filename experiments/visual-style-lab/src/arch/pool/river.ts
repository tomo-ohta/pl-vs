import type * as THREE from 'three';
import type { Kit } from '../../scenes/pool/kit.ts';
import type { SceneContext } from '../../scenes/types.ts';
import { dTunnel } from './hallD.ts';
import { CAVE, HALL } from './layout.ts';

/**
 * 洞窟の水路: D の中央の深い水路 → 北のトンネル → 北で西へ曲がる横の水路 → C の洞窟の口 → C の深いプール。
 * 暗い（照明なしの暗い青緑の壁と天井）。足の着かない深さ（1.6 m）で、泳いで通る。小さな灯りが点々と。
 * 参考画像では pool-3 の突き当たりの暗いアーチと、pool-2 の右奥の暗い口として写る（中は見えない）。
 */
export function buildCave(k: Kit, ctx: SceneContext): void {
  const m = ctx.mat;
  const dark = m({ name: 'cave-wall', color: '#174b58', unlit: true, noFog: true, tiles: { size: 0.5, line: 0.012, color: '#214b54' } });
  const lamp = m({ name: 'cave-lamp', color: '#9fd0c8', unlit: true, line: 0.1 });
  const t = dTunnel();
  const [ox, oz] = HALL.D.o;
  const H = Math.min(t.top, 3.6);
  const DEPTH = -1.6;
  // D の元の版のトンネルは D の区域の z -40 まで（場面 z = oz - 40）。その先から北の横の水路まで
  const zT = oz - 40;
  const [cx0, cx1] = CAVE.crossX;
  const [cz0, cz1] = CAVE.crossZ;
  const [mx0, mx1] = CAVE.mouthX;
  // 水
  k.basin(t.x0, cz0, t.x1, zT + 0.5, DEPTH);
  k.basin(cx0, cz0, cx1, cz1, DEPTH);
  k.basin(mx0, cz1, mx1, CAVE.mouthZ[1], DEPTH);
  // トンネルの続き（北へ）: 両側の壁・天井
  k.box(dark, [t.x0 - 0.5, -2, cz1], [t.x0, H, zT], { collide: true });
  k.box(dark, [t.x1, -2, cz0 - 0.5], [t.x1 + 0.5, H, zT], { collide: true });
  k.box(dark, [t.x0 - 0.5, H, cz0 - 0.5], [t.x1 + 0.5, H + 0.5, zT]);
  // 北の横の水路: 北の壁・南の壁（トンネルと C の口の所は開ける）・天井
  k.box(dark, [cx0 - 0.5, -2, cz0 - 0.5], [t.x1 + 0.5, H, cz0], { collide: true });
  k.box(dark, [mx1, -2, cz1], [t.x0 - 0.5, H, cz1 + 0.5], { collide: true });
  k.box(dark, [cx0 - 0.5, -2, cz0], [cx0, H, cz1 + 0.5], { collide: true });
  k.box(dark, [cx0 - 0.5, H, cz0 - 0.5], [t.x1 + 0.5, H + 0.5, cz1 + 0.5]);
  // C の口（横の水路から南へ。C の北の壁まで）
  k.box(dark, [mx0 - 0.5, -2, cz1 + 0.5], [mx0, H, CAVE.mouthZ[1]], { collide: true });
  k.box(dark, [mx1, -2, cz1 + 0.5], [mx1 + 0.5, H, CAVE.mouthZ[1]], { collide: true });
  k.box(dark, [mx0 - 0.5, H, cz1], [mx1 + 0.5, H + 0.5, CAVE.mouthZ[1]]);
  // 壁ぞいのつかまる手すり（水面の少し上）
  const rail = m({ name: 'cave-rail', color: '#8fb3b0', unlit: true, line: 0.2 });
  k.b.boxMM(rail, [t.x0 - 0.06, 0.32, cz1], [t.x0, 0.36, zT], { shadow: false });
  k.b.boxMM(rail, [t.x1, 0.32, cz0], [t.x1 + 0.06, 0.36, zT], { shadow: false });
  k.b.boxMM(rail, [cx0, 0.32, cz0], [t.x1, 0.36, cz0 + 0.06], { shadow: false });
  k.b.boxMM(rail, [mx1, 0.32, cz1 - 0.06], [t.x0, 0.36, cz1], { shadow: false });
  // 点々と灯り（天井の小さな光）
  const lights: [number, number][] = [];
  for (let z = zT; z > cz0 + 1; z -= 4) lights.push([(t.x0 + t.x1) / 2, z]);
  for (let x = t.x0 - 2; x > cx0 + 1; x -= 4.5) lights.push([x, (cz0 + cz1) / 2]);
  for (const [x, z] of lights) k.b.boxMM(lamp, [x - 0.15, H - 0.04, z - 0.15], [x + 0.15, H, z + 0.15], { shadow: false });
  void ox;
}

/**
 * 洞窟の水路の中の作り込み（中にいる時だけ描く。参考画像の視点からは暗いトンネルのまま）。
 * 暗い青緑のタイルの内張り・4 m おきの段々のアーチの肋（D のトンネルの口と同じ段々）・壁の灯り（光だまり。照らすのは水路の中だけ）・
 * 水際の濃い帯。灯りは人が入ると点く（人感センサーの灯り）として読む。
 */
export function buildCaveInside(k: Kit, ctx: SceneContext): void {
  const m = ctx.mat;
  const b = k.b;
  // 灯りの近くだけ明るい青緑（ハイライトの段）、ほかは暗い青緑。日なたの段は陰と同じ色（日は届かない）
  const tile = m({ name: 'cave-tile', color: '#3d7a78', shade: '#1d4d57', dark: '#173f48', hi: '#a6e0d4', tiles: { size: 0.25, line: 0.014, color: '#1b4650', jitter: 0.05 }, flecks: { scale: 4, density: 0.05, color: '#16404a', length: 0.06, width: 0.14 } });
  const rib = m({ name: 'cave-rib', color: '#46827f', shade: '#245760', dark: '#1d4b54', hi: '#b2e6da', tiles: { size: 0.5, line: 0.014, color: '#1f4d56', jitter: 0.04 } });
  const band = m({ name: 'cave-band', color: '#2b6466', shade: '#1a4a52', dark: '#163f47', hi: '#5fa69e', tiles: { size: 0.125, line: 0.008, color: '#173f47' } });
  const lens = m({ name: 'cave-lens', color: '#d9f3ea', unlit: true, line: 0.2 });
  const body = m({ name: 'cave-body', color: '#1b3f45', unlit: true });
  const t = dTunnel();
  const H = Math.min(t.top, 3.6);
  const cx0 = CAVE.crossX[0];
  const [cz0, cz1] = CAVE.crossZ;
  const mx1 = CAVE.mouthX[1];
  const Y0 = -1.6;
  const L = 0.06;
  const zMouth = -64;
  const bx = (mat: THREE.Material, a: [number, number, number], c: [number, number, number], sh: boolean | 'receive' = 'receive'): void => {
    b.boxMM(mat, [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.min(a[2], c[2])], [Math.max(a[0], c[0]), Math.max(a[1], c[1]), Math.max(a[2], c[2])], { shadow: sh });
  };
  // 内張り（壁・天井）と水際の帯
  const wallX = (x: number, sg: number, z0: number, z1: number): void => {
    bx(tile, [x, Y0, z0], [x + sg * L, H, z1]);
    bx(band, [x, -0.25, z0], [x + sg * (L + 0.03), 0.45, z1]);
  };
  const wallZ = (z: number, sg: number, x0: number, x1: number): void => {
    bx(tile, [x0, Y0, z], [x1, H, z + sg * L]);
    bx(band, [x0, -0.25, z], [x1, 0.45, z + sg * (L + 0.03)]);
  };
  wallX(t.x0, 1, cz1, zMouth);
  wallX(t.x1, -1, cz0, zMouth);
  bx(tile, [t.x0, H - L, cz1], [t.x1, H, zMouth]);
  wallZ(cz0, 1, cx0, t.x1);
  wallZ(cz1, -1, mx1, t.x0);
  wallX(cx0, 1, cz0, cz1);
  bx(tile, [cx0, H - L, cz0], [t.x1, H, cz1]);
  // 段々の肋（壁の柱型 → 2 段の持ち送り → 天井の帯）
  const ribZ = (z: number): void => {
    for (const [x, sg] of [[t.x0, 1], [t.x1, -1]] as [number, number][]) {
      bx(rib, [x, Y0, z - 0.25], [x + sg * 0.25, H - 0.5, z + 0.25]);
      bx(rib, [x, H - 0.5, z - 0.25], [x + sg * 0.5, H - 0.25, z + 0.25]);
      bx(rib, [x, H - 0.25, z - 0.25], [x + sg * 0.75, H, z + 0.25]);
    }
    bx(rib, [t.x0, H - 0.14, z - 0.25], [t.x1, H, z + 0.25]);
  };
  const ribX = (x: number, south: boolean): void => {
    for (const [z, sg] of [[cz0, 1], [cz1, -1]] as [number, number][]) {
      if (sg < 0 && !south) continue;
      bx(rib, [x - 0.25, Y0, z], [x + 0.25, H - 0.5, z + sg * 0.25]);
      bx(rib, [x - 0.25, H - 0.5, z], [x + 0.25, H - 0.25, z + sg * 0.5]);
      bx(rib, [x - 0.25, H - 0.25, z], [x + 0.25, H, z + sg * 0.75]);
    }
    bx(rib, [x - 0.25, H - 0.14, cz0], [x + 0.25, H, cz1]);
  };
  // 灯り（壁の小さな箱と、光だまり。照らすのは水路の箱の中だけ）
  const tunnelBox: [number, number, number, number, number, number] = [t.x0 - 0.1, Y0, cz1 - 0.1, t.x1 + 0.1, H + 0.1, zMouth + 0.5];
  const crossBox: [number, number, number, number, number, number] = [cx0 - 0.1, Y0, cz0 - 0.1, t.x1 + 0.1, H + 0.1, cz1 + 1.1];
  const sconce = (x: number, z: number, nx: number, nz: number, box: [number, number, number, number, number, number]): void => {
    const y = 1.35;
    const w = nx !== 0 ? [0.1, 0.34] : [0.34, 0.1];
    bx(body, [x - w[0] + nx * 0.0, y - 0.12, z - w[1]], [x + w[0] + nx * 0.16, y + 0.12, z + w[1]], false);
    bx(lens, [x + nx * 0.16 - (nz ? 0.28 : 0.005), y - 0.08, z + nz * 0.16 - (nx ? 0.28 : 0.005)], [x + nx * 0.17 + (nz ? 0.28 : 0.005), y + 0.08, z + nz * 0.17 + (nx ? 0.28 : 0.005)], false);
    // 四角い硬い縁の光だまり（壁に縦長の明るい面。縁は升目に沿って段になる）
    ctx.addLamp({ pos: [x + nx * 0.9, y + 0.3, z + nz * 0.9], radius: 2.6, intensity: 1.3, color: '#cfeee6', box, shadow: 0, square: true, hard: true });
  };
  let side = 0;
  for (let z = zMouth - 2; z > cz1 + 0.6; z -= 4) {
    ribZ(z);
    if (side++ % 2) sconce(t.x1 - 0.25, z + 2, -1, 0, tunnelBox);
    else sconce(t.x0 + 0.25, z + 2, 1, 0, tunnelBox);
  }
  for (let x = t.x0 - 2; x > cx0 + 1; x -= 4) {
    const south = x > mx1 + 0.5;
    ribX(x, south);
    sconce(x + 2, cz0 + 0.25, 0, 1, crossBox);
  }
}
