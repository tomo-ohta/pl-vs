import type { GallerySpec } from '../../../props/gallery.ts';
import type { Prop, PropEntry } from '../../../props/kit.ts';
import { Paints } from '../paint.ts';
import { bracketLamp, cupboard, darkCabinet, extinguisher, fridge, gasStove, pendant, sinkCounter } from './kitchen.ts';
import { bench, clock, magazineRack, payPhone, plant, shoeRack, slipperStand, stove, umbrellaStand, waterDispenser } from './lobby.ts';
import { pastelMats } from './mats.ts';
import { cart, centrifuge, cup, exam, glassCabinet, ivPole, microscope, mopSink, oxygen, scale, screen, squatToilet, treatBed, tubeRack, urinal, viewer, washBasin, wheelchair } from './medical.ts';
import { bookcase, coatStand, desk, deskTop, dispensingTable, drawerCabinet, lowCabinet, lowTable, safe, sofa, stool, swivelChair, wasteBin, woodChair } from './office.ts';
import { boxes, cones, ladder, shelfUnit } from './storage.ts';

/**
 * 淡色の廊下（建築版）の小物の見本帳（props.html）。この場所で使う物を全部、この場所の材質（面ごとの平らな色）で並べる。
 * 壁に付ける物（時計・電話の棚・洗面台・シャウカステン・小便器・便器の水槽）は後ろに壁の板を立てる。
 * 撮る: node tools/capture.mjs --page props.html --tour pastel
 */

/** 壁に付ける物の後ろの板（場面の壁の色） */
function backWall(p: Prop, w: number, h: number): void {
  p.box('#b5c5bb', [-w / 2, 0, -0.06], [w / 2, h, 0]);
}

const entries: PropEntry[] = [
  { id: 'bench', label: '待合の長椅子', size: [1.85, 0.86, 0.5], build: (p) => bench(p, 1.8) },
  { id: 'stove', label: '石油ストーブと囲い・やかん', size: [1.15, 0.8, 1.15], build: (p) => stove(p) },
  { id: 'shoe-rack', label: '下足箱（スリッパ・靴）', size: [2.4, 0.87, 0.38], build: (p) => shoeRack(p, 2.4, 0.85, 0.36, 0.5) },
  { id: 'slipper-stand', label: 'スリッパ立て', size: [0.62, 0.93, 0.3], build: (p) => slipperStand(p, 0.6, 6) },
  { id: 'umbrella', label: '傘立て', size: [0.3, 0.95, 0.3], build: (p) => umbrellaStand(p, 3) },
  { id: 'magazine', label: '雑誌の棚', size: [0.8, 1.1, 0.3], build: (p) => magazineRack(p, 0.8) },
  {
    id: 'clock',
    label: '掛け時計（丸・柱時計）',
    size: [0.9, 2.2, 0.15],
    build: (p) => {
      backWall(p, 0.9, 2.2);
      clock(p.sub([-0.22, 0, 0]), 1.75, 'round');
      clock(p.sub([0.2, 0, 0]), 1.55, 'pendulum');
    },
  },
  {
    id: 'phone',
    label: '公衆電話と壁の棚',
    size: [0.7, 1.45, 0.3],
    build: (p) => {
      backWall(p.sub([0, 0, -0.145]), 0.8, 1.6);
      payPhone(p);
    },
  },
  { id: 'water', label: '瓶の冷水機', size: [0.45, 1.5, 0.42], build: (p) => waterDispenser(p) },
  { id: 'plant', label: '鉢植え（枯れかけたゴムの木）', size: [0.6, 1.15, 0.6], build: (p) => plant(p, 1.15) },
  {
    id: 'extinguisher',
    label: '消火器と札',
    size: [0.35, 1.4, 0.35],
    build: (p) => {
      backWall(p, 0.5, 1.5);
      extinguisher(p);
    },
  },
  {
    id: 'desk',
    label: '事務机・机の上・回転椅子・黒電話',
    size: [1.35, 1.0, 1.3],
    build: (p) => {
      desk(p, 1.3, 0.65);
      deskTop(p.sub([0, 0.72, 0]), 1.3, 0.65, { lamp: true, chart: true, phone: true });
      swivelChair(p.sub([0.15, 0, 0.75], Math.PI + 0.25));
    },
  },
  {
    id: 'table',
    label: '4 本脚の机と木の椅子',
    size: [0.9, 0.9, 1.4],
    build: (p) => {
      desk(p, 0.8, 0.6, { drawers: false, top: '#e4e8da' });
      woodChair(p.sub([-0.1, 0, 0.55], Math.PI + 0.2));
      woodChair(p.sub([0.15, 0, -0.55], 0.15));
    },
  },
  { id: 'stool', label: '丸椅子', size: [0.42, 0.5, 0.42], build: (p) => stool(p) },
  { id: 'drawer-cab', label: '薬の引き出しの棚', size: [1.8, 1.85, 0.45], build: (p) => drawerCabinet(p, 1.8, 1.8, 0.42) },
  { id: 'glass-cab', label: 'ガラス戸の薬品棚', size: [0.92, 1.85, 0.42], build: (p) => glassCabinet(p, { content: 'medicine' }) },
  { id: 'instr-cab', label: 'ガラス戸の器械棚', size: [0.92, 1.85, 0.42], build: (p) => glassCabinet(p, { content: 'instruments' }) },
  { id: 'cupboard', label: '食器棚', size: [0.94, 1.83, 0.45], build: (p) => cupboard(p, 0.9, 1.8) },
  { id: 'shelf-charts', label: '棚（カルテ・文書の箱）', size: [0.9, 2.3, 0.45], build: (p) => shelfUnit(p, 0.9, 2.1, 0.45, ['charts', 'charts', 'archive', 'charts'], { top: true }) },
  { id: 'shelf-boxes', label: '棚（段ボール・物品の箱）', size: [0.9, 2.3, 0.45], build: (p) => shelfUnit(p, 0.9, 2.1, 0.45, ['cardboard', 'supplies', 'archive', 'cardboard'], { top: true }) },
  { id: 'shelf-files', label: '棚（ファイル・カルテ）', size: [0.9, 1.8, 0.4], build: (p) => shelfUnit(p, 0.9, 1.8, 0.4, ['archive', 'binders', 'charts']) },
  { id: 'shelf-bottles', label: '棚（薬の瓶）', size: [0.9, 1.9, 0.4], build: (p) => shelfUnit(p, 0.9, 1.9, 0.4, ['supplies', 'bottles', 'bottles', 'bottles'], { frame: '#e4e8da' }) },
  { id: 'shelf-treat', label: '棚（リネン・物品・瓶）', size: [0.9, 1.9, 0.4], build: (p) => shelfUnit(p, 0.9, 1.9, 0.4, ['linen', 'supplies', 'bottles', 'supplies'], { frame: '#e4e8da' }) },
  { id: 'shelf-lab', label: '棚（試薬の瓶）', size: [1.0, 1.9, 0.35], build: (p) => shelfUnit(p, 1.0, 1.9, 0.35, ['supplies', 'reagents', 'reagents', 'bottles'], { frame: '#e4e8da' }) },
  { id: 'bookcase', label: '本棚', size: [0.92, 1.92, 0.36], build: (p) => bookcase(p, 0.9, 1.9, 0.35) },
  { id: 'dispensing', label: '調剤台（天秤・乳鉢・薬包紙）', size: [1.65, 1.1, 0.8], build: (p) => dispensingTable(p, 1.6, 0.75) },
  { id: 'safe', label: '金庫', size: [0.6, 0.98, 0.6], build: (p) => safe(p) },
  { id: 'low-cab', label: '引き戸の低い棚', size: [1.6, 1.0, 0.46], build: (p) => lowCabinet(p, 1.6, 0.85, 0.45) },
  { id: 'dark-cab', label: '暗い低い棚', size: [0.87, 1.2, 0.5], build: (p) => darkCabinet(p, 0.8, 1.0, 0.45) },
  { id: 'sofa', label: '応接のソファ', size: [1.4, 0.8, 0.8], build: (p) => sofa(p, 1.4) },
  { id: 'low-table', label: '応接の低い机', size: [1.0, 0.45, 0.55], build: (p) => lowTable(p, 1.0, 0.55) },
  { id: 'coat', label: 'コート掛けと白衣', size: [0.6, 1.8, 0.6], build: (p) => coatStand(p) },
  { id: 'bin', label: '屑かご', size: [0.3, 0.32, 0.3], build: (p) => wasteBin(p) },
  { id: 'exam', label: '診察台と踏み台', size: [1.8, 0.75, 1.0], build: (p) => exam(p, 1.8) },
  { id: 'screen', label: '衝立（3 枚）', size: [1.7, 1.65, 0.4], build: (p) => screen(p, 3, 0.55, 1.65) },
  {
    id: 'basin',
    label: '陶器の洗面台・鏡',
    size: [0.95, 1.65, 0.45],
    build: (p) => {
      backWall(p.sub([0, 0, -0.21]), 1.0, 1.8);
      washBasin(p, 0.55);
    },
  },
  {
    id: 'viewer',
    label: 'シャウカステン',
    size: [0.9, 1.8, 0.12],
    build: (p) => {
      backWall(p, 1.0, 1.9);
      viewer(p, 0.9, 1.5);
    },
  },
  { id: 'scale', label: '体重計と身長計', size: [0.45, 2.0, 0.5], build: (p) => scale(p) },
  { id: 'bed', label: '処置台とカーテン', size: [1.6, 2.4, 2.5], build: (p) => treatBed(p, 2.6) },
  { id: 'iv', label: '点滴台', size: [0.52, 2.0, 0.52], build: (p) => ivPole(p) },
  { id: 'cart', label: '処置のワゴン', size: [0.7, 1.08, 0.45], build: (p) => cart(p) },
  { id: 'oxygen', label: '酸素ボンベと台車', size: [0.4, 1.22, 0.35], build: (p) => oxygen(p) },
  { id: 'wheelchair', label: 'たたんだ車椅子', size: [0.4, 0.95, 0.85], build: (p) => wheelchair(p) },
  {
    id: 'lab',
    label: '検査の作業台（顕微鏡・遠心機・試験管）',
    size: [2.0, 1.1, 0.6],
    build: (p) => {
      sinkCounter(p, 2.0, { upper: false, sinkAt: 0.6 });
      microscope(p.sub([-0.65, 0.85, 0.0], 0.3));
      centrifuge(p.sub([-0.1, 0.85, 0.0]));
      tubeRack(p.sub([0.6, 0.85, 0.2]));
      for (let i = 0; i < 3; i++) cup(p.sub([-0.85 + i * 0.09, 0.85, 0.22]));
    },
  },
  { id: 'counter-pantry', label: '流し台とガス台・やかん', size: [2.0, 1.1, 0.62], build: (p) => sinkCounter(p, 2.0, { stove: true, upper: false, sinkAt: -0.45 }) },
  { id: 'counter-treat', label: '流し台と吊り戸棚', size: [1.6, 2.15, 0.62], build: (p) => sinkCounter(p, 1.6, { upper: true, sinkAt: -0.3 }) },
  { id: 'gas', label: 'ガス台', size: [0.6, 0.15, 0.42], build: (p) => gasStove(p.sub([0, 0.0, 0])) },
  { id: 'fridge', label: '冷蔵庫', size: [0.6, 1.4, 0.63], build: (p) => fridge(p, 1.4, 0.6) },
  {
    id: 'urinal',
    label: '朝顔形の小便器',
    size: [0.4, 1.5, 0.4],
    build: (p) => {
      backWall(p, 0.6, 1.8);
      urinal(p);
    },
  },
  {
    id: 'toilet',
    label: '和式の便器と高い水槽',
    size: [1.0, 2.0, 1.45],
    build: (p) => {
      backWall(p.sub([0, 0, -0.725]), 1.0, 2.1);
      squatToilet(p, 1.45, 1.0);
    },
  },
  {
    id: 'mop-sink',
    label: '掃除の流し・モップ・バケツ',
    size: [1.1, 1.4, 0.5],
    build: (p) => {
      backWall(p.sub([0, 0, 0]), 1.2, 1.6);
      mopSink(p);
    },
  },
  { id: 'boxes', label: '積んだ段ボール', size: [0.7, 1.0, 0.6], build: (p) => boxes(p, 3) },
  { id: 'ladder', label: '脚立', size: [0.5, 1.55, 0.6], build: (p) => ladder(p, 1.5) },
  { id: 'cones', label: 'コーンと横の棒・札', size: [1.4, 0.7, 0.35], build: (p) => cones(p, 1.1) },
  { id: 'pendant', label: '吊り下げの灯り', size: [0.45, 2.6, 0.45], build: (p) => pendant(p, 2.6, 0.9) },
  {
    id: 'bracket',
    label: '壁の腕木の灯り',
    size: [0.4, 2.2, 0.3],
    build: (p) => {
      backWall(p, 0.5, 2.2);
      bracketLamp(p, 1.9);
    },
  },
];

export function gallery(): GallerySpec {
  return {
    label: '淡色の廊下（昭和の診療所）',
    styleFrom: 'pastel',
    mats: () => pastelMats(new Paints()),
    entries,
    floor: '#768987',
    wall: '#b5c5bb',
  };
}
