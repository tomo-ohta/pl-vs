import type { PropEntry } from '../kit.ts';
import { bench, chair, extinguisher, pottedPlant, trashBin } from './furniture.ts';
import { ticketMachine, vendingMachine, waterCooler } from './machines.ts';
import { boxPile, steelShelf } from './storage.ts';
import { bicycle, car, keiTruck } from './vehicles.ts';

export * from './furniture.ts';
export * from './machines.ts';
export * from './storage.ts';
export * from './vehicles.ts';

/** どの場所でも使う小物（見本帳 common に並ぶ）。色は既定の色。場所ではその場所の色を渡す */
export const COMMON_PROPS: PropEntry[] = [
  { id: 'vending', label: '飲料の自動販売機', size: [1.0, 1.85, 0.75], build: (p) => vendingMachine(p) },
  { id: 'vending-snack', label: 'お菓子の自動販売機', size: [1.0, 1.85, 0.75], build: (p) => vendingMachine(p, { body: '#2f4a4c', accent: '#d9a43a', goods: 'snack' }) },
  { id: 'ticket', label: '券売機', size: [0.62, 1.6, 0.6], build: (p) => ticketMachine(p) },
  { id: 'cooler', label: '冷水機', size: [0.42, 1.02, 0.42], build: (p) => waterCooler(p) },
  { id: 'car', label: '軽自動車（ワゴン）', size: [1.5, 1.7, 3.4], build: (p) => car(p, { body: '#e7ebe6' }) },
  { id: 'car-hatch', label: '軽自動車（低い型）', size: [1.5, 1.55, 3.4], build: (p) => car(p, { type: 'hatch', body: '#9fb7c0' }) },
  { id: 'truck', label: '軽トラック', size: [1.5, 1.9, 3.4], build: (p) => keiTruck(p) },
  { id: 'bicycle', label: '自転車', size: [0.7, 1.1, 1.8], build: (p) => bicycle(p) },
  { id: 'shelf-store', label: '棚（段ボール・収納箱）', size: [1.2, 1.8, 0.45], build: (p) => steelShelf(p, { load: ['cardboard', 'bins', 'cardboard', 'cardboard'] }) },
  { id: 'shelf-office', label: '棚（ファイル・紙・瓶）', size: [1.2, 1.8, 0.45], build: (p) => steelShelf(p, { load: ['paper', 'binders', 'binders', 'bottles'] }) },
  { id: 'shelf-linen', label: '棚（リネン・タオル）', size: [1.2, 1.8, 0.45], build: (p) => steelShelf(p, { load: 'linen' }) },
  { id: 'boxes', label: '積んだ段ボール', size: [0.7, 1.0, 0.6], build: (p) => boxPile(p) },
  { id: 'bench-slat', label: 'ベンチ（板）', size: [1.8, 0.45, 0.45], build: (p) => bench(p) },
  { id: 'bench-seats', label: '待合いの椅子', size: [2.0, 0.9, 0.55], build: (p) => bench(p, { kind: 'seats', w: 2.0 }) },
  { id: 'chair-stack', label: '椅子（積み重ね）', size: [0.5, 0.9, 0.5], build: (p) => chair(p) },
  { id: 'chair-office', label: '事務椅子', size: [0.6, 1.1, 0.6], build: (p) => chair(p, { kind: 'office' }) },
  { id: 'plant', label: '鉢植え', size: [0.6, 1.1, 0.6], build: (p) => pottedPlant(p) },
  { id: 'bin', label: 'ごみ箱', size: [0.45, 0.75, 0.45], build: (p) => trashBin(p) },
  { id: 'recycle', label: '分別のごみ箱', size: [1.1, 0.9, 0.45], build: (p) => trashBin(p, { kind: 'recycle' }) },
  { id: 'extinguisher', label: '消火器', size: [0.3, 0.65, 0.3], build: (p) => extinguisher(p) },
];
