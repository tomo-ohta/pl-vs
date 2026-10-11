import type * as THREE from 'three';
import type { SceneContext } from '../../scenes/types.ts';
import { marbleTexture, type HallMats } from './hall.ts';
import type { SeatMats } from './seats.ts';

/**
 * 大ドームの材質（半写実: toon 0 の色彩設計の材質。照明はドームの光（上からの平行光と半球光）・照明の輪のスポット・灯りの光だまり）。
 * 色は参考画像から拾った色（--sample）に、照明の当たり方を見て合わせた値（docs/stages/planetarium.md の色の表）
 */
export const PAL = {
  floor: '#133242',
  floorJoint: '#16303d',
  tread: '#1c3a48',
  riser: '#071319',
  stage: '#6aa9bf',
  stageEdge: '#0a1c26',
  walk: '#10222c',
  wall: '#2a4a58',
  pier: '#33586a',
  slab: '#3a6274',
  rail: '#08161e',
  ceiling: '#081822',
  house: '#5a8fa2',
  console: '#0a1820',
  nosing: '#1a3644',
  // ドラムのまわりの建物（回廊・玄関ホール）
  oFloor: '#21404f',
  oJoint: '#4d7183',
  oWall: '#4a7386',
  oWallDark: '#17303d',
  oTrim: '#5b8597',
  oCeil: '#10222c',
  oGlass: '#0b2333',
  rib: '#0b2a38',
  bracket: '#051a25',
  bleachSeat: '#5b98ad',
  seatFabric: '#101c25',
  seatShell: '#0a141b',
  tablet: '#46687a',
};

export interface PlMats extends HallMats {
  dress: { frame: THREE.Material; pier: THREE.Material; window: THREE.Material; plateGlow: THREE.Material };
  outer: {
    cove: THREE.Material;
    floor: THREE.Material;
    joint: THREE.Material;
    wall: THREE.Material;
    wallDark: THREE.Material;
    trim: THREE.Material;
    ceiling: THREE.Material;
    rail: THREE.Material;
    glass: THREE.Material;
    door: THREE.Material;
  };
  rib: THREE.Material;
  bracket: THREE.Material;
  bleachSeat: THREE.Material;
  house: THREE.Material;
  console: THREE.Material;
  seat: SeatMats;
}

export function makeMats(ctx: SceneContext): PlMats {
  const m = (name: string, color: string, o: Partial<Parameters<SceneContext['mat']>[0]> = {}): THREE.Material =>
    ctx.mat({ color, toon: 0, roughness: 0.9, line: 0, name, ...o });
  return {
    floor: m('floor', PAL.floor, { roughness: 0.55, tiles: { size: 2.4, line: 0.025, color: PAL.floorJoint, jitter: 0.12 } }),
    tread: m('tread', PAL.tread),
    riser: m('riser', PAL.riser),
    stage: m('stage', PAL.stage, { roughness: 0.3, map: marbleTexture() }),
    stageEdge: m('stage-edge', PAL.stageEdge),
    walk: m('walk', PAL.walk),
    // ドラムの壁: 吸音の縦格子（幅 15 cm の板と溝）
    wall: m('wall', PAL.wall, { tiles: { size: [0.15, 1.8], line: 0.022, color: '#132b37', jitter: 0.14 } }),
    pier: m('pier', PAL.pier),
    slab: m('slab', PAL.slab),
    rail: m('rail', PAL.rail, { roughness: 0.5 }),
    ceiling: m('ceiling', PAL.ceiling),
    house: m('house', PAL.house),
    console: m('console', PAL.console, { roughness: 0.6 }),
    nosing: m('nosing', PAL.nosing, { roughness: 0.5 }),
    rib: m('rib', PAL.rib),
    bracket: m('bracket', PAL.bracket),
    bleachSeat: m('bleach-seat', PAL.bleachSeat),
    dress: {
      frame: m('frame', '#0d171d', { roughness: 0.5 }),
      pier: m('o-pier', '#35596a'),
      window: m('night-window', '#071a28', { roughness: 0.08, metalness: 0.3 }),
      plateGlow: ctx.mat({ color: '#000000', unlit: true, emissive: '#bfe8ff', emissiveIntensity: 1.6, toon: 0, line: 0, name: 'door-plate' }),
    },
    outer: {
      cove: ctx.mat({ color: '#000000', unlit: true, emissive: '#8fd4f0', emissiveIntensity: 1.4, toon: 0, line: 0, name: 'cove' }),
      // 玄関ホールの床: 石の板（四角い部屋なので升目の向きはホールの壁に沿う）。回廊の床は輪に沿って割った板（foyer.ts）
      floor: m('o-floor', PAL.oFloor, { roughness: 0.35, tiles: { size: [1.2, 0.6], line: 0.012, color: PAL.oJoint, jitter: 0.08 } }),
      joint: m('o-joint', '#3a5d6e', { roughness: 0.8 }),
      // 回廊の壁: 吸音の木の縦格子（幅 10 cm の板と細い溝。板ごとに明るさが少し違う）
      wall: m('o-wall', PAL.oWall, { tiles: { size: [0.1, 2.4], line: 0.016, color: '#18323f', jitter: 0.16 } }),
      wallDark: m('o-wall-dark', PAL.oWallDark),
      trim: m('o-trim', PAL.oTrim, { roughness: 0.6 }),
      ceiling: m('o-ceil', PAL.oCeil),
      rail: m('o-rail', PAL.rail, { roughness: 0.4 }),
      glass: m('o-glass', PAL.oGlass, { roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.7 }),
      door: m('o-door', '#1a2f3b', { roughness: 0.5 }),
    },
    seat: {
      cap: m('seat-cap', '#2a4f5e', { roughness: 0.3 }),
      fabric: m('seat-fabric', PAL.seatFabric, { roughness: 0.55 }),
      shell: m('seat-shell', PAL.seatShell, { roughness: 0.35 }),
      tablet: m('seat-tablet', PAL.tablet, { roughness: 0.5 }),
    },
  };
}
