import * as THREE from 'three';
import type { GallerySpec } from '../../../props/gallery.ts';
import type { Prop, PropEntry } from '../../../props/kit.ts';
import type { Builder, V3 } from '../../../scenes/Builder.ts';
import { seatRow, slatBench, twinSeat } from '../furniture.ts';
import { stationMat } from '../mat.ts';
import { bicycle, car, chair, extinguisher, keiTruck, pottedPlant, steelShelf, trashBin, vendingMachine } from '../../../props/lib/index.ts';
import { stationPropMats } from './mats.ts';
import { Looks } from '../looks.ts';
import { LOOKS } from '../looks-data.ts';
import { acUnit, coinLocker, hydrantBox, phoneBooth, postBox, signalCabinet, ticketGate, ticketVendor } from './machines.ts';
import { bale, barricade, cone, drum, handcart, palletStack, parcelPallet, sackPallet, sleeperPile } from './goods.ts';
import { officeDesk, pamphletRack, planter } from './furnish.ts';
import { STATION_COLORS as C } from './colors.ts';

/** Builder で置く駅のもとからの家具（ベンチ）を、見本帳の物の座標へ出す（mesh(geo, mat, pos) だけを使う関数用） */
function viaBuilder(p: Prop, fn: (b: Builder) => void): void {
  const fake = {
    mesh(geo: THREE.BufferGeometry, mat: THREE.Material, pos: V3) {
      geo.translate(pos[0], pos[1], pos[2]);
      geo.applyMatrix4(p.m);
      if (!geo.getAttribute('uv')) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.getAttribute('position').count * 2), 2));
      p.sink.add(geo, mat, true);
      return null;
    },
  } as unknown as Builder;
  fn(fake);
}
let benchMats: Record<'t' | 'd' | 'b' | 'steel' | 'frameD', THREE.Material> | null = null;
/** ベンチの材質（mats.ts の makeMats と同じ値。見本帳のためだけに作る） */
function bm(): NonNullable<typeof benchMats> {
  benchMats ??= {
    t: stationMat({ color: '#1e4450', side: THREE.DoubleSide, sheen: 0.6 }),
    d: stationMat({ color: '#2a6670', emissive: '#0a3c44', emissiveIntensity: 1, side: THREE.DoubleSide, sheen: 0.3 }),
    b: stationMat({ color: '#123238', sheen: 0.2 }),
    steel: stationMat({ color: '#3d6e7c' }),
    frameD: stationMat({ color: '#2a6670', emissive: '#0a3c44', emissiveIntensity: 1 }),
  };
  return benchMats;
}

/**
 * 駅の小物の見本帳（props.html の station）。駅で使う小物を全部、駅の材質（mats.ts）で並べる。
 * 共通の小物（src/props/lib）は駅で渡す色で、駅だけの物（props/*.ts）はそのまま
 */
export const STATION_PROPS: PropEntry[] = [
  // もとからの家具（形は作り込み済み。そのまま使う）
  { id: 'seat-row', label: '樹脂の座席の列（A・待合室・広場）', size: [2.3, 0.9, 0.6], build: (p) => viaBuilder(p, (b) => seatRow(b, bm().t, bm().steel, [0, 0, 0], Math.PI, 4, 0.57)) },
  { id: 'twin-seat', label: '2 人掛けの座席（D）', size: [1.3, 0.9, 0.6], build: (p) => viaBuilder(p, (b) => twinSeat(b, bm().d, bm().frameD, [0, 0, 0], Math.PI)) },
  { id: 'slat-bench', label: '板のベンチ（B・C）', size: [1.7, 0.95, 0.7], build: (p) => viaBuilder(p, (b) => slatBench(b, bm().b, bm().b, [0, 0, 0], Math.PI, 1.7)) },
  // 駅の小物（作り込み）
  { id: 'gate', label: '自動改札機', size: [0.3, 1.05, 1.42], build: (p) => ticketGate(p) },
  { id: 'ticket', label: '壁の券売機', size: [0.86, 1.78, 0.6], build: (p) => ticketVendor(p, C.ticket) },
  { id: 'locker', label: 'コインロッカー（4 列）', size: [2.42, 1.97, 0.55], build: (p) => coinLocker(p, C.locker) },
  { id: 'vending-in', label: '自動販売機（待合室）', size: [1.0, 1.85, 0.75], build: (p) => vendingMachine(p, C.vendingWhite) },
  { id: 'vending-red', label: '自動販売機（広場・赤）', size: [1.0, 1.85, 0.75], build: (p) => vendingMachine(p, C.vendingRed) },
  { id: 'bins', label: '分別のくず入れ', size: [1.1, 0.9, 0.45], build: (p) => trashBin(p, C.bins) },
  { id: 'hydrant', label: '屋内消火栓の箱', size: [0.7, 1.6, 0.2], build: (p) => hydrantBox(p) },
  { id: 'extinguisher', label: '消火器', size: [0.3, 0.65, 0.3], build: (p) => extinguisher(p) },
  { id: 'plant', label: '鉢植え（待合室）', size: [0.6, 1.1, 0.6], build: (p) => pottedPlant(p, C.plant) },
  { id: 'rack', label: 'パンフレットの棚', size: [0.82, 1.45, 0.3], build: (p) => pamphletRack(p) },
  { id: 'desk', label: '事務机', size: [1.6, 1.15, 0.8], build: (p) => officeDesk(p, { w: 1.6, d: 0.8 }) },
  { id: 'chair', label: '事務椅子', size: [0.6, 1.1, 0.6], build: (p) => chair(p, C.officeChair) },
  { id: 'shelf', label: 'スチール棚（事務室）', size: [1.2, 1.8, 0.45], build: (p) => steelShelf(p, C.officeShelf) },
  { id: 'planter', label: '角のプランター', size: [0.62, 0.8, 0.47], build: (p) => planter(p) },
  { id: 'phone', label: '電話ボックス', size: [1.0, 2.5, 1.0], build: (p) => phoneBooth(p) },
  { id: 'post', label: '丸型ポスト', size: [0.52, 1.34, 0.52], build: (p) => postBox(p) },
  { id: 'ac', label: 'エアコンの室外機', size: [0.95, 0.66, 0.32], build: (p) => acUnit(p) },
  { id: 'car', label: '軽自動車（白のワゴン）', size: [1.5, 1.7, 3.4], build: (p) => car(p, C.carWhite) },
  { id: 'car-hatch', label: '軽自動車（低い型）', size: [1.5, 1.55, 3.4], build: (p) => car(p, C.carHatch) },
  { id: 'car-navy', label: '軽自動車（紺のワゴン）', size: [1.5, 1.7, 3.4], build: (p) => car(p, C.carNavy) },
  { id: 'truck', label: '軽トラック', size: [1.5, 1.9, 3.4], build: (p) => keiTruck(p, C.truck) },
  { id: 'bicycle', label: '自転車', size: [0.7, 1.1, 1.8], build: (p) => bicycle(p, C.bikeSilver) },
  { id: 'bicycle-2', label: '自転車（色違い）', size: [0.7, 1.1, 1.8], build: (p) => bicycle(p, C.bikeRed) },
  { id: 'cabinet', label: '信号の機器箱', size: [1.36, 1.85, 1.2], build: (p) => signalCabinet(p) },
  { id: 'drum', label: 'ドラム缶', size: [0.6, 0.88, 0.6], build: (p) => drum(p, { color: C.drums[0] }) },
  { id: 'drum-lying', label: 'ドラム缶（寝かせた）', size: [0.6, 0.6, 0.9], build: (p) => drum(p, { color: C.drums[2], lying: true }) },
  { id: 'sacks', label: 'パレットの米袋', size: [1.12, 0.85, 1.12], build: (p) => sackPallet(p) },
  { id: 'parcels', label: 'パレットの段ボール', size: [1.12, 1.05, 1.12], build: (p) => parcelPallet(p) },
  { id: 'pallets', label: '空のパレットの山', size: [1.15, 0.9, 1.15], build: (p) => palletStack(p) },
  { id: 'handcart', label: 'リヤカー', size: [1.0, 0.9, 2.0], build: (p) => handcart(p) },
  { id: 'cone', label: 'カラーコーン', size: [0.4, 0.7, 0.4], build: (p) => cone(p) },
  { id: 'barricade', label: 'A 形のバリケード', size: [1.2, 0.8, 0.6], build: (p) => barricade(p) },
  { id: 'bale', label: 'ロールベール', size: [1.2, 1.2, 1.2], build: (p) => bale(p) },
  { id: 'sleepers', label: '外した枕木の山', size: [1.3, 0.75, 2.2], build: (p) => sleeperPile(p, { rails: 0 }) },
];

export function gallery(): GallerySpec {
  return {
    label: '霧の駅',
    styleFrom: 'station',
    mats: () => {
      // 見本帳には駅の空気（霧の色・空の明るさ・照り返し）が無いので、屋根の無い視点（station-2: 旧踏切道）の値を入れる
      new Looks(LOOKS).apply(-23.7, 51.4);
      return stationPropMats();
    },
    entries: STATION_PROPS,
    floor: '#4a5c5a',
    wall: '#9fb0aa',
  };
}
