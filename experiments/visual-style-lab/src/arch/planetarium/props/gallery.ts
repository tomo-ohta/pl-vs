import * as THREE from 'three';
import type { GallerySpec } from '../../../props/gallery.ts';
import type { Prop, PropEntry } from '../../../props/kit.ts';
import { bench, extinguisher, pottedPlant, steelShelf, trashBin } from '../../../props/lib/index.ts';
import { seatParts } from '../seats.ts';
import { domePropMats } from './mats.ts';
import { brochureRack, ceilingLight, displayCase, globeExhibit, infoKiosk, pendantLamp, shopShelf, stanchion, ticketCounter, wallSconce } from './lobby.ts';
import { doorHeader, doorLeaf, exitSign, hangingPlanet, lockers, orrery, seatAlcove, wallVitrine } from './foyer.ts';
import { aisleLamp, consoleDesk, equipmentRack, lectern, signStand, speaker, starProjector } from './stage.ts';

/**
 * プラネタリウム（大ドーム劇場）の小物の見本帳（props.html の planetarium）。場面で使う小物を全部、
 * 大ドームの材質の作り方（props/mats.ts: 半写実・色を大ドームの色の表へ寄せる）で並べる。
 * 客席の椅子は場面では InstancedMesh で置く形（seats.ts の seatParts）を、そのまま 1 席ずつ出す
 */

/** 客席の椅子（劇場の椅子・机つき）を 1 席。seatParts の形を見本帳の物の座標へ */
function seat(p: Prop, tablet: boolean, n = 1): void {
  const parts = seatParts(tablet);
  const cols: [THREE.BufferGeometry | undefined, string][] = [
    [parts.fabric, '#101c25'],
    [parts.shell, '#0a141b'],
    [parts.cap, '#3f6f82'],
    [parts.tablet, '#46687a'],
  ];
  for (let i = 0; i < n; i++) {
    const s = p.sub([(i - (n - 1) / 2) * 0.6, 0, 0]);
    for (const [g, c] of cols) {
      if (!g) continue;
      const gg = g.clone();
      gg.applyMatrix4(s.m);
      if (!gg.getAttribute('uv')) gg.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(gg.getAttribute('position').count * 2), 2));
      s.sink.add(gg, s.mats.get(c), true);
    }
  }
}

export const PLANETARIUM_PROPS: PropEntry[] = [
  { id: 'seat-row', label: '劇場の椅子（3 席。下ろした座面・背・肘掛け・背の笠木）', size: [1.8, 1.05, 0.7], build: (p) => seat(p, false, 3) },
  { id: 'seat-tablet', label: '机つきの椅子（2 席。右に畳んだ机）', size: [1.3, 1.05, 0.7], build: (p) => seat(p, true, 2) },
  { id: 'console', label: '操作卓（化粧板・斜めの操作面・画面・卓上灯・ガラスの陳列ケース・マイク）', size: [3.8, 1.7, 1.1], build: (p) => consoleDesk(p) },
  { id: 'rack', label: '機材の棚（2 本並び・前板・灯り・つまみ）', size: [1.3, 2.0, 0.9], build: (p) => equipmentRack(p) },
  { id: 'projector', label: '星の投影機（2 つの星の球・惑星の籠・台座）', size: [3.6, 3.4, 2.0], build: (p) => starProjector(p) },
  { id: 'lectern', label: '演台', size: [0.75, 1.3, 0.65], build: (p) => lectern(p) },
  { id: 'speaker', label: 'スピーカー', size: [0.6, 1.0, 0.65], build: (p) => speaker(p) },
  { id: 'aisle-lamp', label: '通路の足もとの灯り（低い柱）', size: [0.25, 0.8, 0.25], build: (p) => aisleLamp(p) },
  { id: 'sign', label: '自立の案内の板', size: [0.7, 1.4, 0.4], build: (p) => signStand(p) },
  { id: 'case-meteorite', label: '展示のケース（隕石）', size: [1.2, 1.45, 0.6], build: (p) => displayCase(p, 'meteorite') },
  { id: 'case-telescope', label: '展示のケース（望遠鏡の模型）', size: [1.2, 1.45, 0.6], build: (p) => displayCase(p, 'telescope') },
  { id: 'case-planet', label: '展示のケース（惑星の模型）', size: [1.2, 1.45, 0.6], build: (p) => displayCase(p, 'planet') },
  { id: 'globe', label: '地球儀の展示（直径 1.6 m）', size: [2.1, 2.9, 2.1], build: (p) => globeExhibit(p) },
  { id: 'ticket', label: '券売所のカウンター（ガラスの仕切り・画面・光る看板）', size: [4.4, 3.6, 0.9], build: (p) => ticketCounter(p, 4.2) },
  { id: 'kiosk', label: '案内の端末', size: [0.6, 1.2, 0.5], build: (p) => infoKiosk(p) },
  {
    id: 'ceiling-light',
    label: '天井の丸い灯り（下から見る）',
    size: [0.4, 2.6, 0.4],
    build: (p) => {
      // 見本帳では天井の板に付けて見せる
      p.box('#10222c', [-0.5, 2.6, -0.5], [0.5, 2.65, 0.5]);
      ceilingLight(p.sub([0, 2.6, 0]));
    },
  },
  { id: 'sconce', label: '壁付けの縦長の灯り', size: [0.3, 2.2, 0.2], build: (p) => {
    p.box('#2a4c5e', [-0.4, 0, -0.1], [0.4, 2.4, 0]);
    wallSconce(p.sub([0, 1.6, 0]));
  } },
  { id: 'pendant', label: '吊った丸い灯り', size: [0.5, 3.2, 0.5], build: (p) => {
    p.box('#10222c', [-0.4, 3.2, -0.4], [0.4, 3.25, 0.4]);
    pendantLamp(p.sub([0, 3.2, 0]), 1.6);
  } },
  { id: 'bench', label: '長椅子（回廊）', size: [1.8, 0.5, 0.45], build: (p) => bench(p, { w: 1.8, kind: 'locker', seat: '#3a4c56', frame: '#1c272e' }) },
  { id: 'bench-seats', label: '待合いの椅子（玄関ホール）', size: [2.4, 0.9, 0.6], build: (p) => bench(p, { w: 2.4, kind: 'seats', seat: '#3a5664', frame: '#1c272e', n: 5 }) },
  { id: 'shelf', label: '道具の棚（前室）', size: [1.8, 2.0, 0.5], build: (p) => steelShelf(p, { w: 1.8, h: 2.0, d: 0.5, frame: '#3a4a52', load: ['bins', 'cardboard', 'mixed', 'bins'], colors: ['#2e3d45', '#4a5a62', '#6b5a45'] }) },
  { id: 'plant', label: '鉢植え', size: [0.6, 1.4, 0.6], build: (p) => pottedPlant(p, { pot: '#2f3e46', leaf: '#3f6a5c', h: 1.4 }) },
  { id: 'bin', label: 'くず入れ', size: [0.4, 0.8, 0.4], build: (p) => trashBin(p, { kind: 'round', body: '#2b3a42', lid: '#1a242a' }) },
  { id: 'extinguisher', label: '消火器', size: [0.3, 0.65, 0.3], build: (p) => extinguisher(p) },
  // 回廊（ホワイエ）の作り付けと展示（3 回目の直し）
  { id: 'orrery', label: 'オーラリー（太陽系の模型。丸い台・太陽・腕・8 つの惑星・軌道の輪）', size: [1.8, 2.0, 1.8], build: (p) => orrery(p) },
  { id: 'hanging-planet', label: '吊った惑星の模型（環つき）', size: [0.8, 1.6, 0.8], build: (p) => {
    p.box('#10222c', [-0.4, 1.6, -0.4], [0.4, 1.65, 0.4]);
    hangingPlanet(p.sub([0, 1.6, 0]), 0.9, 0.28, '#dcc898', true);
  } },
  { id: 'lockers', label: 'コインロッカー（扉 1 枚ずつ・鍵・番号の札・料金の板）', size: [1.9, 1.85, 0.5], build: (p) => lockers(p.sub([0, 0, 0.25]), 5, 4) },
  { id: 'alcove', label: '作り付けの長椅子の小部屋（袖の板・棚の光・クッション・読書灯）', size: [2.5, 2.2, 0.75], build: (p) => seatAlcove(p.sub([0, 0, 0.36]), 2.4) },
  { id: 'door-leaf', label: '扉の板（框組み・押し板・取っ手の棒・蹴り板・蝶番）', size: [1.0, 2.45, 0.1], build: (p) => doorLeaf(p, 0.98, 2.42, true) },
  { id: 'door-header', label: '出入口の上の案内の箱（光る題と番号）と誘導灯', size: [2.7, 0.6, 0.15], build: (p) => {
    doorHeader(p.sub([0, 1.6, 0]), 2.7, 3);
    exitSign(p.sub([1.0, 2.35, 0]));
  } },
  { id: 'vitrine', label: '壁の陳列棚（中から照らす・棚板 2 段・隕石のかけらと小さな模型）', size: [0.9, 1.3, 0.2], build: (p) => {
    p.box('#23404f', [-0.6, 0, -0.04], [0.6, 2.4, 0]);
    wallVitrine(p.sub([0, 1.0, 0]), 0.8, 1.15);
  } },
  { id: 'brochure', label: '案内の冊子の立て', size: [0.6, 1.5, 0.36], build: (p) => brochureRack(p.sub([0, 0, 0.1])) },
  { id: 'stanchion', label: '列の仕切り（ベルトの付いた支柱 2 本）', size: [1.3, 1.0, 0.3], build: (p) => {
    stanchion(p.sub([-0.6, 0, 0]), 1.2);
    stanchion(p.sub([0.6, 0, 0]), 0);
  } },
  { id: 'shop-a', label: '売店の棚（地球儀・望遠鏡の箱・本・星図・ぬいぐるみ）', size: [1.8, 1.95, 0.45], build: (p) => shopShelf(p.sub([0, 0, 0.22]), 1.8, 0) },
  { id: 'shop-b', label: '売店の棚（並びの違う段）', size: [1.8, 1.95, 0.45], build: (p) => shopShelf(p.sub([0, 0, 0.22]), 1.8, 2) },
];

export function gallery(): GallerySpec {
  return {
    label: 'プラネタリウム',
    styleFrom: 'planetarium',
    mats: (ctx) => domePropMats(ctx),
    entries: PLANETARIUM_PROPS,
    floor: '#21404f',
    wall: '#4a7386',
  };
}
