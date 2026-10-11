import type { GallerySpec } from '../../../props/gallery.ts';
import type { Prop, PropEntry } from '../../../props/kit.ts';
import { poolBench, poolBin, poolChair, poolCooler, poolExtinguisher, poolPlant, poolTicket, poolVending } from './common.ts';
import { aedBox, aidBed, backboard, cubicle, desk, frontDesk, fridge, gates, handDryer, kitchenette, lockerBank, saunaHeater, saunaThermometer, shoeLockerBank, showerStall, snackItems, sofa, spinner, table, vanity, washbasin, weighScale } from './furniture.ts';
import { chemTank, controlPanel, filterTank, heatExchanger, panelTank, poolCleaner, pump, ropeReel, stackedChairs, woodFence } from './equipment.ts';
import { boardCart, drum, firstAidBox, jerrycan, kickboardPile, pail, poolShelf, pullBuoy } from './gear.ts';
import { galleryMats, PC } from './mats.ts';
import { backstrokeFlags, laneRope, lifeguardChair, lounger, parasol, poolLadder, rescueBoard, rescueTube, ringBuoy, stairRail, startBlock, wallClock } from './poolside.ts';

/**
 * プールの小物の見本帳（props.html の pool）。場面で使う小物を全部、プールの材質で並べる。
 * 壁に付ける物は後ろに小さな壁、はしご・スタート台はプールの縁の段を置いて見せる
 */

/** 後ろの小さな壁（壁に付ける物の見本） */
const wall = (p: Prop, w: number, h = 2.4): void => p.box(PC.white, [-w / 2, 0, -0.12], [w / 2, h, 0]);
/** プールの縁の段（はしご・スタート台。上面 y = h、縁は z = 0） */
const edge = (p: Prop, w: number, h: number): void => p.box(PC.pale, [-w / 2, 0, -0.9], [w / 2, h, 0]);

export function gallery(): GallerySpec {
  const entries: PropEntry[] = [
    // ---- 共通の小物（プールの色） ----
    { id: 'vending', label: '飲料の自動販売機', size: [1.0, 1.85, 0.75], build: (p) => poolVending(p, 'drink') },
    { id: 'vending-water', label: '水の自動販売機', size: [1.0, 1.85, 0.75], build: (p) => poolVending(p, 'water') },
    { id: 'ticket', label: '券売機', size: [0.62, 1.6, 0.6], build: (p) => poolTicket(p) },
    { id: 'cooler', label: '冷水機', size: [0.42, 1.02, 0.42], build: (p) => poolCooler(p) },
    { id: 'bench-deck', label: 'プールサイドのベンチ', size: [2.4, 0.45, 0.45], build: (p) => poolBench(p, 'deck', 2.4) },
    { id: 'bench-wood', label: '更衣室のベンチ', size: [2.4, 0.45, 0.45], build: (p) => poolBench(p, 'wood', 2.4) },
    { id: 'bench-seats', label: '待合いの椅子', size: [2.0, 0.9, 0.55], build: (p) => poolBench(p, 'seats', 2.0) },
    { id: 'chair', label: '椅子（積み重ね）', size: [0.5, 0.9, 0.5], build: (p) => poolChair(p) },
    { id: 'chair-office', label: '事務椅子', size: [0.6, 1.1, 0.6], build: (p) => poolChair(p, 'office') },
    { id: 'plant', label: '鉢植え', size: [0.6, 1.2, 0.6], build: (p) => poolPlant(p, 1.2) },
    { id: 'plant-palm', label: '鉢植え（細い葉）', size: [0.8, 1.3, 0.8], build: (p) => poolPlant(p, 1.3, 'palm') },
    { id: 'bin', label: 'ごみ箱', size: [0.45, 0.75, 0.45], build: (p) => poolBin(p) },
    { id: 'recycle', label: '分別のごみ箱', size: [1.1, 0.9, 0.45], build: (p) => poolBin(p, 'recycle') },
    { id: 'extinguisher', label: '消火器', size: [0.3, 0.65, 0.3], build: (p) => poolExtinguisher(p) },
    // ---- プールサイド ----
    { id: 'guard-chair', label: '監視台', size: [1.0, 2.35, 1.1], build: (p) => lifeguardChair(p) },
    { id: 'ladder', label: 'プールのはしご', size: [1.2, 1.95, 0.9], build: (p) => { edge(p, 1.2, 1.0); poolLadder(p.sub([0, 1.0, 0]), 1.0); } },
    { id: 'stair-rail', label: '入水の階段の手すり', size: [1.0, 1.95, 1.4], build: (p) => { edge(p, 1.0, 0.75); stairRail(p.sub([0, 0.75, 0]), 1.0, 0.75); } },
    { id: 'start-block', label: 'スタート台', size: [1.0, 1.4, 0.9], build: (p) => { edge(p, 1.0, 0.6); startBlock(p.sub([0, 0.6, 0])); } },
    { id: 'rescue-board', label: '救命具の板', size: [1.1, 2.2, 0.3], build: (p) => { wall(p, 1.1); rescueBoard(p); } },
    { id: 'clock', label: '壁の時計', size: [0.7, 2.6, 0.2], build: (p) => { wall(p, 0.7, 2.7); wallClock(p, 2.2, 0.3); } },
    { id: 'pace-clock', label: 'ペースクロック', size: [1.3, 2.6, 0.2], build: (p) => { wall(p, 1.3, 2.7); wallClock(p, 1.9, 0.55, { pace: true }); } },
    { id: 'lane-rope', label: 'コースロープ（3 m）', size: [3.0, 0.3, 0.2], build: (p) => laneRope(p.sub([0, 0.06, 0]), 3.0) },
    { id: 'flags', label: '背泳ぎの旗（3 m）', size: [3.2, 1.9, 0.2], build: (p) => backstrokeFlags(p, 3.0) },
    { id: 'lounger', label: '寝椅子', size: [0.7, 0.8, 1.95], build: (p) => lounger(p) },
    { id: 'lounger-stack', label: '重ねた寝椅子', size: [0.7, 0.8, 1.95], build: (p) => { for (let i = 0; i < 5; i++) lounger(p.sub([0, i * 0.075, 0]), { flat: true }); } },
    { id: 'parasol', label: '閉じたパラソル', size: [0.6, 2.6, 0.6], build: (p) => parasol(p) },
    // ---- 用具 ----
    { id: 'kickboards', label: 'ビート板の山', size: [0.3, 0.4, 0.45], build: (p) => kickboardPile(p, 12, [PC.yellow, PC.blue]) },
    { id: 'pull-buoy', label: 'プルブイ', size: [0.25, 0.12, 0.25], build: (p) => pullBuoy(p, PC.yellow, PC.blue) },
    { id: 'rescue-tube', label: 'レスキューチューブ', size: [1.0, 0.1, 0.2], build: (p) => rescueTube(p) },
    { id: 'ring-buoy', label: '救命浮環', size: [0.8, 0.8, 0.2], build: (p) => ringBuoy(p.sub([0, 0.4, 0])) },
    { id: 'jerrycan', label: '薬品のポリ缶', size: [0.3, 0.45, 0.2], build: (p) => jerrycan(p, PC.white) },
    { id: 'pail', label: 'ペール缶', size: [0.32, 0.38, 0.32], build: (p) => pail(p, PC.blue) },
    { id: 'drum', label: 'ポリドラム', size: [0.4, 0.62, 0.4], build: (p) => drum(p, PC.blue) },
    { id: 'aid-box', label: '救急箱', size: [0.34, 0.22, 0.22], build: (p) => firstAidBox(p) },
    { id: 'shelf-gear', label: '棚（ビート板・プルブイ・チューブ）', size: [1.2, 1.8, 0.45], build: (p) => poolShelf(p, { w: 1.2, h: 1.8, load: ['boards', 'buoys', 'tubes', 'boards'] }) },
    { id: 'shelf-chem', label: '棚（薬品・ペール缶）', size: [1.2, 1.8, 0.5], build: (p) => poolShelf(p, { w: 1.2, h: 1.8, d: 0.5, levels: 4, load: ['pails', 'jugs', 'bottles'] }) },
    { id: 'shelf-aid', label: '棚（救急箱・タオル）', size: [0.9, 1.8, 0.45], build: (p) => poolShelf(p, { w: 0.9, h: 1.8, load: ['towels', 'aid', 'bins', 'linen'] }) },
    { id: 'shelf-office', label: '棚（ファイル・紙・段ボール）', size: [1.2, 1.9, 0.45], build: (p) => poolShelf(p, { w: 1.2, h: 1.9, frame: PC.metal, load: ['cardboard', 'binders', 'binders', 'paper'] }) },
    { id: 'board-cart', label: '台車とビート板', size: [1.25, 1.0, 0.85], build: (p) => boardCart(p) },
    // ---- 部屋の家具と設備 ----
    { id: 'lockers', label: 'ロッカー', size: [1.6, 1.8, 0.5], build: (p) => lockerBank(p, { n: 4, rows: 3 }) },
    { id: 'coin-lockers', label: 'コインロッカー', size: [1.2, 1.6, 0.5], build: (p) => lockerBank(p, { n: 3, rows: 4, h: 1.6, keys: 0.9 }) },
    { id: 'shoe-lockers', label: '下足箱', size: [1.2, 1.35, 0.4], build: (p) => shoeLockerBank(p, { n: 4, rows: 4 }) },
    { id: 'vanity', label: '化粧台', size: [2.0, 1.9, 1.1], build: (p) => { wall(p.sub([0, 0, -0.26]), 2.0); vanity(p, 2.0); } },
    { id: 'washbasin', label: '洗面台', size: [0.6, 1.8, 0.5], build: (p) => { wall(p.sub([0, 0, -0.25]), 0.7); washbasin(p); } },
    { id: 'cubicle', label: '便所の個室', size: [1.1, 2.1, 1.45], build: (p) => { wall(p.sub([0, 0, -0.7]), 1.1); cubicle(p.sub([0, 0, 0.7]), 1.0, 1.4, true); } },
    { id: 'shower', label: 'シャワーの仕切り', size: [1.0, 2.15, 0.9], build: (p) => { wall(p.sub([0, 0, -0.45]), 1.1); showerStall(p.sub([0, 0, 0.45]), 1.0, 0.9, true, true); } },
    { id: 'hand-dryer', label: '手の乾燥機', size: [0.35, 1.7, 0.25], build: (p) => { wall(p, 0.5); handDryer(p); } },
    { id: 'scale', label: '体重計', size: [0.4, 1.2, 0.45], build: (p) => weighScale(p) },
    { id: 'spinner', label: '水着の脱水機', size: [0.5, 0.95, 0.6], build: (p) => spinner(p) },
    { id: 'desk', label: '事務机と椅子', size: [1.4, 1.2, 1.4], build: (p) => { desk(p.sub([0, 0, -0.3]), 1.4, { screen: true }); poolChair(p.sub([0.1, 0, 0.35], Math.PI), 'office'); } },
    { id: 'table', label: 'テーブルと椅子', size: [1.2, 0.9, 1.9], build: (p) => { table(p, 1.2, 0.8); for (const dz of [-0.65, 0.65]) poolChair(p.sub([0, 0, dz], dz < 0 ? 0 : Math.PI), 'stack', PC.teal); } },
    { id: 'sofa', label: 'ソファ', size: [2.2, 0.85, 0.8], build: (p) => sofa(p, 2.2) },
    { id: 'aid-bed', label: '救護のベッド', size: [0.8, 0.75, 2.1], build: (p) => aidBed(p) },
    { id: 'backboard', label: '背板（担架）', size: [0.45, 1.86, 0.35], build: (p) => { wall(p, 0.6); backboard(p); } },
    { id: 'kitchenette', label: '流し台', size: [2.4, 2.2, 0.62], build: (p) => { wall(p.sub([0, 0, -0.3]), 2.4); kitchenette(p, 2.4); } },
    { id: 'fridge', label: '冷蔵庫', size: [0.6, 1.75, 0.7], build: (p) => fridge(p) },
    { id: 'front-desk', label: '受付の台', size: [3.1, 1.2, 1.1], build: (p) => frontDesk(p, 3.0) },
    { id: 'gates', label: '入場ゲート', size: [2.0, 1.0, 1.25], build: (p) => gates(p, 2, 0.9) },
    { id: 'aed', label: 'AED の箱', size: [0.45, 1.8, 0.25], build: (p) => { wall(p, 0.6); aedBox(p); } },
    { id: 'sauna-heater', label: '採暖室の暖房器と柵', size: [1.4, 1.05, 1.2], build: (p) => { saunaHeater(p.sub([0, 0, -0.2])); woodFence(p.sub([0, 0, 0.45]), 1.4); } },
    { id: 'thermometer', label: '採暖室の温度計', size: [0.3, 2.0, 0.1], build: (p) => { wall(p, 0.4); saunaThermometer(p); } },
    // ---- 機械室・倉庫 ----
    { id: 'filter', label: 'ろ過装置', size: [1.8, 3.2, 2.2], build: (p) => filterTank(p, 0.9, 2.0) },
    { id: 'pump', label: 'ポンプ', size: [1.6, 1.4, 0.85], build: (p) => pump(p) },
    { id: 'panel', label: '制御盤', size: [0.9, 2.05, 0.45], build: (p) => controlPanel(p) },
    { id: 'chem-tank', label: '薬品の槽', size: [1.0, 1.5, 1.0], build: (p) => chemTank(p) },
    { id: 'heat-exchanger', label: '熱交換器', size: [2.6, 1.7, 1.0], build: (p) => heatExchanger(p) },
    { id: 'rope-reel', label: 'コースロープの巻き取り台', size: [2.0, 1.2, 1.0], build: (p) => ropeReel(p) },
    { id: 'cleaner', label: 'プールの掃除機', size: [0.8, 1.05, 0.75], build: (p) => poolCleaner(p) },
    { id: 'chairs-stack', label: '重ねた椅子', size: [0.5, 1.2, 0.6], build: (p) => stackedChairs(p) },
    { id: 'panel-tank', label: '受水槽（パネル水槽）', size: [4.8, 3.4, 4.0], build: (p) => panelTank(p, 4.4, 3.2, 2.0) },
    { id: 'snack', label: '軽食のカウンターの上', size: [4.2, 1.5, 0.7], build: (p) => { p.box(PC.white, [-2.4, 0, -0.3], [2.4, 1.0, 0.3]); p.box(PC.teal, [-2.45, 1.0, -0.35], [2.45, 1.05, 0.35]); snackItems(p); } },
  ];
  return { label: 'プール', styleFrom: 'pool', mats: galleryMats, entries, floor: PC.pale, wall: PC.white };
}
