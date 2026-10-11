import * as THREE from 'three';
import type { PlanarReflector } from '../../render/PlanarReflector.ts';
import type { SceneContext } from '../../scenes/types.ts';
import { cloudsFrom, type CloudBlob, type SkyCeilingOptions } from './ceiling.ts';
import type { ShiftCam } from './cam.ts';
import { CAM_A, type HallAMats } from './hallA.ts';
import { CAM_B, type HallBMats } from './hallB.ts';
import { CAM_C, type HallCMats } from './hallC.ts';
import { CAM_D, type HallDMats } from './hallD.ts';
import { HALL, hallRectW } from './layout.ts';
import { glow, semi, waterMat, wetFloor } from './mats.ts';
import { glowDecalMat } from './hallkit.ts';
import { monoPal, slideTone, slideVariant, type SlidePal } from './slides.ts';

/**
 * 広間ごとの色の表と天井の絵（参考画像から --sample で拾った色・視点のカメラで測った雲の位置）。
 * sky: 天井の絵の設定、mats: 広間の材質（ctx.mat）
 */

/** 1 色のスライダーの表（2 つ目の部品は外の面だけわずかに違う色） */
export function mono2(ctx: SceneContext, name: string, out: string, inner: string, hi: string, out2: string): SlidePal {
  const a = slideTone(ctx, name, out, inner, hi);
  return monoPal(a, slideVariant(ctx, a, `${name}2`, out2));
}

/**
 * 視点から見えない天井の残りを雲で埋める（空の絵の天井は全体が空と雲。参考画像に写る所の雲は blobs で、
 * それ以外を 7 × 6 m の升目に乱数でずらした雲の塊で）。塊の中心と四方の端のどれかが視点の画角（余白 100 画素）に入れば置かない
 */
function fillClouds(cam: ShiftCam, id: keyof typeof HALL, seed: number): CloudBlob[] {
  const [x0, z0, x1, z1] = hallRectW(id);
  const y = HALL[id].ceil;
  let t = seed * 7919 + 13;
  const rnd = (): number => ((t = (t * 16807) % 2147483647) / 2147483647);
  const out: CloudBlob[] = [];
  for (let z = z0 + 3; z < z1 - 1; z += 6) {
    for (let x = x0 + 3; x < x1 - 1; x += 7) {
      const cx = x + (rnd() - 0.5) * 3.0;
      const cz = z + (rnd() - 0.5) * 2.4;
      const rx = 2.0 + rnd() * 1.6;
      const rz = rx * (0.6 + rnd() * 0.3);
      const pts: [number, number, number][] = [[cx, y, cz], [cx - rx, y, cz], [cx + rx, y, cz], [cx, y, cz - rz], [cx, y, cz + rz]];
      const seen = pts.some((p) => {
        const q = cam.proj(p);
        return !!q && q[0] > -100 && q[0] < 1332 && q[1] > -100 && q[1] < 1028;
      });
      if (seen) continue;
      out.push({ x: cx, z: cz, rx, rz, k: rnd() < 0.3 ? 0.7 : 1 });
    }
  }
  return out;
}

// ------------------------------------------------------------------ A（waterpark-0）: 青い夜・白と青灰の雲
export function skyA(): SkyCeilingOptions {
  return {
    base: '#023759',
    edge: '#0b4462',
    lit: '#80b2d4',
    mid: '#4c88b2',
    shade: '#2a648c',
    rim: '#b4d4e8',
    light: [-0.15, 1],
    elev: 0.3,
    absorb: 0.25,
    soft: 0.8,
    puff: 1.35,
    center: [0, -12],
    radius: 26,
    breakUp: 0.12,
    blobs: cloudsFrom(CAM_A, HALL.A.ceil, [
      [260, 80, 190, 110],
      [250, 200, 80, 55, 0.85],
      [400, 150, 60, 55, 0.85],
      [775, 125, 105, 60],
      [745, 215, 165, 48],
      [620, 258, 140, 34],
      [865, 200, 55, 25, 0.8],
      [450, 232, 32, 24, 0.8],
      [742, 42, 38, 24, 0.8],
      [1075, 32, 38, 14, 0.7],
      [1190, 18, 55, 22, 0.8],
      [610, 133, 25, 8, 0.6],
      [480, 300, 80, 14, 0.6],
      [790, 302, 100, 12, 0.6],
    ]),
    extra: fillClouds(CAM_A, 'A', 1),
  };
}

export function matsA(ctx: SceneContext, refl: PlanarReflector, sky: THREE.Material): HallAMats & { floorMat: THREE.Material; waterMat: THREE.Material } {
  const water = waterMat(ctx, refl, { color: '#165a82', refl: 0.8, fresnel: 0.3, distort: 0.004, tint: '#d8eaf6', streak: 0.06, name: 'A-water' });
  const floor = wetFloor(ctx, refl, { color: '#3474a0', tile: 0.3, grout: '#5f96bc', groutW: 0.012, refl: 0.55, fresnel: 0.5, key: 0, keySoft: 0.12, streak: 0.36, distort: 0.002, name: 'A-floor' });
  // 色は参考画像から拾った「見える色」（環境光は白で、上向きの面 = この色。下向きの面は地の色で暗く）。暖かい灯りは描いた光だまりと灯り
  return {
    floorMat: floor,
    waterMat: water,
    floor,
    wall: semi(ctx, '#4a86a6', { tiles: { size: 0.3, line: 0.016, color: '#2f6484', jitter: 0.16 }, name: 'A-wall' }),
    wallBand: semi(ctx, '#2f6a92'),
    ceilDark: semi(ctx, '#0b2c40', { name: 'A-ceil' }),
    sky,
    col: semi(ctx, '#5a94b6', { tiles: { size: 0.3, line: 0.016, color: '#2f6a8e', jitter: 0.35 }, name: 'A-col' }),
    galleryFace: semi(ctx, '#4a88ae', { name: 'A-galface' }),
    galleryUnder: semi(ctx, '#356e92', { name: 'A-galunder' }),
    rail: semi(ctx, '#6f94ae', { metalness: 0.2, roughness: 0.5 }),
    duct: semi(ctx, '#4a85a6', { metalness: 0.3, roughness: 0.35, name: 'A-duct' }),
    ductBand: semi(ctx, '#33688a'),
    // スライダー: 桃色と水色はそれぞれ 1 色（成形の部品ごとにわずかに色が違う 2 つを交互に）
    pink: mono2(ctx, 'A-pink', '#c27c72', '#e3a596', '#ffd8cc', '#b9746b'),
    white: mono2(ctx, 'A-white', '#4f8fb8', '#86b8d6', '#e4f2ff', '#4a88b0'),
    steel: semi(ctx, '#5a86a2', { metalness: 0.3, roughness: 0.5 }),
    stair: semi(ctx, '#2f6684', { name: 'A-stair' }),
    stairLit: semi(ctx, '#b07e5e', { name: 'A-stairLit' }),
    lampBody: semi(ctx, '#2a3c48'),
    lampLit: glow(ctx, '#ffd2a8', 8),
    lampGlow: glow(ctx, '#ffe4d6', 4.0),
    winLit: glow(ctx, '#d8c0b4', 0.9),
    mint: mono2(ctx, 'A-mint', '#6aa8b4', '#8cc2cc', '#dcf6ff', '#64a0ac'),
    tubeIn: semi(ctx, '#1c2e3c'),
    glowWall: glowDecalMat(ctx, '#ffa888', 0.85),
    glowFloor: glowDecalMat(ctx, '#ff9a7c', 0.28),
    pool: { coping: semi(ctx, '#6f8ca6', { name: 'A-coping' }), wall: semi(ctx, '#2f74a0'), water },
  };
}

// ------------------------------------------------------------------ B（waterpark-1）: 青緑の空・桃色に照らされた雲
export function skyB(): SkyCeilingOptions {
  return {
    base: '#1b4652',
    edge: '#2b5868',
    lit: '#f6eef0',
    mid: '#c4c8d8',
    shade: '#6a88aa',
    rim: '#ffe6ea',
    light: [-0.4, 0.92],
    elev: 0.3,
    center: [-30, -14],
    radius: 30,
    wisps: 0.25,
    blobs: cloudsFrom(CAM_B, HALL.B.ceil, [
      [850, 140, 130, 80],
      [600, 140, 110, 50],
      [1000, 40, 150, 45, 0.85],
      [700, 280, 160, 30, 0.7],
      [900, 330, 140, 25, 0.6],
      [550, 380, 60, 15, 0.6],
      [1100, 230, 80, 30, 0.7],
    ]),
    extra: fillClouds(CAM_B, 'B', 2),
  };
}

export function matsB(ctx: SceneContext, refl: PlanarReflector, sky: THREE.Material): HallBMats & { floorMat: THREE.Material[]; waterMat: THREE.Material[] } {
  const water = waterMat(ctx, refl, { color: '#1e504e', refl: 0.65, fresnel: 0.35, distort: 0.005, tint: '#b8d8d6', streak: 0.04, name: 'B-water' });
  const shallow = waterMat(ctx, refl, { color: '#86b6ae', refl: 0.45, fresnel: 0.4, distort: 0.0018, tint: '#ffe8ec', streak: 0.04, name: 'B-shallow' });
  const floor = wetFloor(ctx, refl, { color: '#7896a4', tile: 0.3, grout: '#56707e', refl: 0.5, fresnel: 0.45, key: 0.1, keySoft: 0.2, streak: 0.16, name: 'B-floor' });
  const walk = wetFloor(ctx, refl, { color: '#7c9cb2', tile: [0.6, 0.3], grout: '#5a7890', refl: 0.5, fresnel: 0.45, key: 0.1, keySoft: 0.2, streak: 0.16, name: 'B-walk' });
  return {
    floorMat: [floor, walk],
    waterMat: [water, shallow],
    floor,
    walk,
    wall: semi(ctx, '#80aab6', { tiles: { size: [0.6, 0.3], line: 0.016, color: '#5f8792', jitter: 0.14 }, roughness: 0.3, name: 'B-wall' }),
    soffit: semi(ctx, '#a6cad6', { tiles: { size: 0.6, line: 0.016, color: '#7fa2ae', jitter: 0.08 }, roughness: 0.25, name: 'B-soffit' }),
    door: semi(ctx, '#2f4448', { name: 'B-door' }),
    sky,
    eastWall: semi(ctx, '#598898', { tiles: { size: [0.6, 0.3], line: 0.016, color: '#3f6a78', jitter: 0.18 }, name: 'B-east' }),
    teal: semi(ctx, '#3f6056', { roughness: 0.35, name: 'B-teal' }),
    pale: semi(ctx, '#8fb4b8', { roughness: 0.35, name: 'B-pale' }),
    duct: semi(ctx, '#7f9a9a', { metalness: 0.3, roughness: 0.35, name: 'B-duct' }),
    ductBand: semi(ctx, '#5d7676'),
    // スライダー: 桃色の筒・白灰の筒・外が桃色で内が白の開いた螺旋（どれも 1 色。部品ごとにわずかに違う 2 つを交互に）
    pink: mono2(ctx, 'B-pink', '#f0b0a6', '#ffdcd2', '#ffe4dc', '#e6a499'),
    pinkWhite: mono2(ctx, 'B-pinkW', '#f0b0a6', '#f4e2e6', '#fff4f6', '#e6a499'),
    tubeIn: semi(ctx, '#2a1a14', { name: 'B-tubeIn' }),
    white: mono2(ctx, 'B-white', '#d8c8d0', '#f4e2e6', '#fff4f6', '#cdbdc6'),
    steel: semi(ctx, '#5f7d7a', { metalness: 0.3, roughness: 0.5 }),
    rail: semi(ctx, '#a9b7b5', { metalness: 0.2, roughness: 0.5 }),
    lampBody: semi(ctx, '#3b4a4c'),
    lampLit: glow(ctx, '#fff1e4', 7),
    glowFloor: glowDecalMat(ctx, '#ffb4b8', 0.45),
    pool: { coping: semi(ctx, '#7f9497', { name: 'B-coping' }), wall: semi(ctx, '#2c5f5b'), water },
    shallow: { coping: semi(ctx, '#8e9ea2', { name: 'B-coping2' }), wall: semi(ctx, '#6e9a96'), water: shallow },
  };
}

// ------------------------------------------------------------------ C（waterpark-2）: 濃紺の空・白灰の積雲・桃色の灯り
export function skyC(): SkyCeilingOptions {
  return {
    base: '#033a5a',
    edge: '#0d4668',
    lit: '#d0dee8',
    mid: '#8ba3b5',
    shade: '#4c6c86',
    rim: '#e8f0f4',
    absorb: 0.5,
    soft: 0.7,
    light: [0, 1],
    elev: 0.3,
    center: [25.5, -12],
    radius: 22,
    breakUp: 0.25,
    puff: 1.25,
    blobs: cloudsFrom(CAM_C, HALL.C.ceil, [
      [420, 130, 215, 150],
      [1050, 100, 190, 125],
      [820, 190, 110, 70, 0.85],
      [780, 360, 120, 60],
      [560, 335, 40, 18, 0.7],
      [920, 380, 70, 30, 0.8],
    ], 600),
    extra: fillClouds(CAM_C, 'C', 3),
  };
}

export function matsC(ctx: SceneContext, refl: PlanarReflector, sky: THREE.Material): HallCMats & { floorMat: THREE.Material[]; waterMat: THREE.Material[] } {
  const water = waterMat(ctx, refl, { color: '#2b6f93', refl: 0.75, fresnel: 0.3, distort: 0.0018, tint: '#ffe0e8', streak: 0.04, name: 'C-water' });
  const low = waterMat(ctx, refl, { color: '#0b4b52', refl: 0.5, fresnel: 0.3, distort: 0.0018, tint: '#bfe8ee', streak: 0.04, name: 'C-low' });
  const floor = wetFloor(ctx, refl, { color: '#b8a2b2', tile: 0.3, grout: '#8d7c8c', refl: 0.4, fresnel: 0.5, key: 0.45, keySoft: 0.4, streak: 0.1, name: 'C-floor' });
  return {
    floorMat: [floor],
    waterMat: [water, low],
    floor,
    deck: semi(ctx, '#b49a96', { tiles: { size: [0.12, 2.0], line: 0.013, color: '#8a7470', jitter: 0.05 }, name: 'C-deck' }),
    wall: semi(ctx, '#7f9aa6', { tiles: { size: 0.25, line: 0.016, color: '#5f7f8c', jitter: 0.16 }, name: 'C-wall' }),
    backWall: semi(ctx, '#2f5f6e', { tiles: { size: 0.4, line: 0.016, color: '#22505e', jitter: 0.1 }, name: 'C-back' }),
    sky,
    beam: semi(ctx, '#123f5c', { name: 'C-beam' }),
    col: semi(ctx, '#7aa6b8', { tiles: { size: 0.25, line: 0.016, color: '#5a8597', jitter: 0.15 }, name: 'C-col' }),
    stairFace: semi(ctx, '#4f8494', { tiles: { size: 0.15, line: 0.013, color: '#3a6a78', jitter: 0.05 }, name: 'C-stairface' }),
    stairTread: semi(ctx, '#9bb2bc', { name: 'C-tread' }),
    deckTile: semi(ctx, '#a8b8c4', { tiles: { size: 0.3, line: 0.016, color: '#7c8e9c', jitter: 0.1 }, name: 'C-deckTile' }),
    nose: semi(ctx, '#e4ecf0', { name: 'C-nose' }),
    riser: semi(ctx, '#5f7c8a', { name: 'C-riser' }),
    rail: semi(ctx, '#e4cfd2', { metalness: 0.2, roughness: 0.5 }),
    duct: semi(ctx, '#2c5a76', { metalness: 0.2, roughness: 0.5, name: 'C-duct' }),
    ductBand: semi(ctx, '#21495f'),
    // スライダー: 桃色とミント（1 本ずつ 1 色。部品ごとにわずかに違う 2 つを交互に）
    pink: mono2(ctx, 'C-pink', '#d79a9c', '#ebbcc0', '#ffe0e0', '#cd9093'),
    mint: mono2(ctx, 'C-mint', '#86b8b8', '#a9d2cf', '#e0fff8', '#7eb0b0'),
    tubeIn: semi(ctx, '#203236'),
    steel: semi(ctx, '#8aa3ac', { metalness: 0.3, roughness: 0.5 }),
    lampBody: semi(ctx, '#2c3a40'),
    lampLit: glow(ctx, '#ffe3d2', 8),
    pool: { coping: semi(ctx, '#9db0bd', { name: 'C-coping' }), wall: semi(ctx, '#3a7e98'), water },
    low: { coping: semi(ctx, '#7aa0a8', { name: 'C-lowcoping' }), wall: semi(ctx, '#2f6a70', { tiles: { size: 0.15, line: 0.013, color: '#24585e', jitter: 0.06 } }), water: low },
  };
}

// ------------------------------------------------------------------ D（waterpark-3）: 夕焼けの桃色の雲・桃色の床
export function skyD(): SkyCeilingOptions {
  return {
    base: '#06323f',
    edge: '#173f52',
    // 雲の中の明暗は参考画像の筆の雲のように柔らかく（陰を明るめに。濃い陰と明るい頭の硬い境が出ないように）
    lit: '#e0a292',
    mid: '#9c727a',
    shade: '#5a4e5e',
    rim: '#f0bcaa',
    light: [0, 1],
    elev: 0.3,
    absorb: 0.35,
    soft: 1.0,
    center: [52.5, -12],
    radius: 24,
    stars: 0.05,
    wisps: 0.35,
    blobs: cloudsFrom(CAM_D, HALL.D.ceil, [
      [400, 135, 170, 65],
      [900, 50, 230, 60],
      [700, 200, 110, 28],
      [960, 165, 105, 40, 0.85],
      [1180, 120, 60, 30, 0.8],
      [560, 250, 70, 14, 0.7],
      [1040, 215, 70, 20, 0.7],
      [290, 225, 80, 18, 0.7],
      [480, 60, 60, 25, 0.7],
      [1000, 285, 160, 26, 0.65],
      [850, 335, 130, 16, 0.6],
      [610, 335, 90, 14, 0.6],
      [1160, 320, 90, 18, 0.6],
    ], 500),
    extra: fillClouds(CAM_D, 'D', 4),
  };
}

export function matsD(ctx: SceneContext, refl: PlanarReflector, sky: THREE.Material): HallDMats & { floorMat: THREE.Material[]; waterMat: THREE.Material[] } {
  const water = waterMat(ctx, refl, { color: '#2f7480', refl: 0.6, fresnel: 0.3, distort: 0.006, tint: '#ffe0d8', name: 'D-water' });
  // 床: 長方形のタイルの馬目地。目地は細く、タイルより少しだけ暗い（参考画像の床は目地より灯りの映り込みが強い）
  const floor = wetFloor(ctx, refl, { color: '#e0968a', tile: [0.3, 0.15], grout: '#c27e72', groutW: 0.008, jitter: 0.05, bond: true, refl: 0.75, fresnel: 0.6, key: 0.12, keySoft: 0.15, streak: 0.26, name: 'D-floor' });
  return {
    floorMat: [floor],
    waterMat: [water],
    floor,
    wall: semi(ctx, '#2f5a6c', { tiles: { size: 0.25, line: 0.016, color: '#22485a', jitter: 0.18 }, name: 'D-wall' }),
    sky,
    col: semi(ctx, '#4f7a96', { tiles: { size: 0.2, line: 0.013, color: '#3a627c', jitter: 0.2 }, name: 'D-col' }),
    soffit: semi(ctx, '#1c4440', { roughness: 0.4, name: 'D-soffit' }),
    stairTread: semi(ctx, '#c49684', { name: 'D-tread' }),
    nose: semi(ctx, '#f4d0c0', { name: 'D-nose' }),
    riser: semi(ctx, '#7a5248', { name: 'D-riser' }),
    globe: glow(ctx, '#fff0dc', 1.1),
    stairFace: semi(ctx, '#7a8c94', { tiles: { size: 0.2, line: 0.013, color: '#5c6c74', jitter: 0.06 }, name: 'D-stairface' }),
    rail: semi(ctx, '#e8c8b8', { metalness: 0.2, roughness: 0.5 }),
    ...slidesD(ctx),
    // 奥の観覧の段（参考画像 3 の中ほど左: 青いタイル #427696・明るい上の面 #768aa9・茶色のタイル #a26255・暗い扉 #37332a）
    standFace: semi(ctx, '#4a7c9c', { tiles: { size: 0.2, line: 0.012, color: '#3a6888', jitter: 0.08 }, name: 'D-standFace' }),
    standTop: semi(ctx, '#7e90ae', { tiles: { size: 0.3, line: 0.012, color: '#6a7c9a', jitter: 0.05 }, name: 'D-standTop' }),
    brick: semi(ctx, '#a8685a', { tiles: { size: 0.2, line: 0.014, color: '#7e4c40', jitter: 0.08 }, name: 'D-brick' }),
    door: semi(ctx, '#2c3434', { name: 'D-door' }),
    // 右の端: 白と青のタイルの柱型（#a8b8c8）・階段の腰壁（灯りに照らされた明るい桃色がかったタイル #ad9282）
    colLight: semi(ctx, '#a6b6c6', { tiles: { size: 0.2, line: 0.012, color: '#7d92a6', jitter: 0.12 }, name: 'D-colLight' }),
    parapet: semi(ctx, '#b49686', { tiles: { size: [0.6, 0.3], line: 0.03, color: '#7a6054', jitter: 0.08 }, name: 'D-parapet' }),
    tubeIn: semi(ctx, '#2a2026'),
    steel: semi(ctx, '#6b7f88', { metalness: 0.3, roughness: 0.5 }),
    lampBody: semi(ctx, '#2a3438'),
    lampLit: glow(ctx, '#fff0dc', 8),
    starLit: glow(ctx, '#fff2e0', 2.4),
    lampGlow: glow(ctx, '#fff0e4', 3.0),
    // 段の外の壁は灯りの反対側で暗い茶（参考画像の手前の縁）、笠木は明るい
    pool: { coping: semi(ctx, '#6e5248', { tiles: { size: 0.25, line: 0.01, color: '#62483f', jitter: 0.06 }, name: 'D-coping' }), copingTop: semi(ctx, '#e0aa98', { tiles: { size: [0.3, 0.25], line: 0.01, color: '#c8968a', jitter: 0.04 }, name: 'D-copingTop' }), wall: semi(ctx, '#2f6a74'), water },
  };
}

/**
 * D のスライダー: 桃色とミントの部品をつないだ物（参考画像 3 の幅広の樋・筒）。部品ごとに 1 色、桃色 6 割・ミント 4 割で
 * ほぼ交互（時々 2 つ続く）。幅広の樋は区間ごとに側壁の板が床の板と違う色になる。筒の終わりの部品はミント。
 * 色は参考画像 3 の樋と筒から（--sample: 桃色の日なた #eda99f・#db8b83、陰 #ac6b62、ミントの日なた #99b4b8・#90aaa3、陰 #547878）
 */
function slidesD(ctx: SceneContext): { mix: SlidePal; tubes: SlidePal } {
  const pink = slideTone(ctx, 'D-pink', '#e0948a', '#eea89c', '#ffe4dc');
  const mint = slideTone(ctx, 'D-mint', '#86aaa8', '#a0c0bc', '#dcfff8');
  return {
    mix: { tones: [pink, mint], share: 0.6, walls: 0.45 },
    tubes: { tones: [pink, mint], share: 0.6, cap: 1 },
  };
}

// ------------------------------------------------------------------ 通路・観覧通路の天井（細長い空の帯）
export function skyStrip(r: [number, number, number, number], seed: number): SkyCeilingOptions {
  const blobs = [];
  let t = seed * 7.3;
  // 細長い所は長い向きに、四角い所は升目に、雲を並べる
  const wide = r[2] - r[0] >= r[3] - r[1];
  const L = wide ? r[2] - r[0] : r[3] - r[1];
  const Wd = wide ? r[3] - r[1] : r[2] - r[0];
  // 雲の塊は 4.5 m おき・幅 3.5 m ごとの列（天井の空の絵が暗い一様な面にならないように）
  const rows = Math.max(1, Math.round(Wd / 3.5));
  for (let j = 0; j < rows; j++) {
    for (let a = 2 + j * 1.7; a < L - 1.5; a += 4.5) {
      t = (t * 9301 + 49297) % 233280;
      const u = t / 233280;
      const along = a + u * 3;
      const across = ((j + 0.5) / rows) * Wd + (u - 0.5) * 1.6;
      const x = wide ? r[0] + along : r[0] + across;
      const z = wide ? r[1] + across : r[1] + along;
      const rr = Math.min(1.7 + u * 1.3, Wd / rows / 2 + 0.6);
      blobs.push({ x, z, rx: rr, rz: rr * 0.7, k: u < 0.3 ? 0.7 : 1 });
    }
  }
  return {
    base: '#0a3a58',
    edge: '#123f5a',
    lit: '#8cbad8',
    mid: '#4485b0',
    shade: '#1a557e',
    rim: '#b4d4e8',
    light: [0, 1],
    elev: 0.3,
    absorb: 0.4,
    center: [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2],
    radius: 60,
    seed,
    blobs,
  };
}
