import type { Prop, PropEntry } from '../../../props/kit.ts';
import type { GallerySpec } from '../../../props/gallery.ts';
import { bench, chair, extinguisher, pottedPlant } from '../../../props/lib/furniture.ts';
import { vendingMachine, waterCooler } from '../../../props/lib/machines.ts';
import {
  basket, bathStool, bathTub, bedsideCabinet, bucketMop, changingTable, coat, examCouch, handDryer, foldedChair, fridge, hospitalBed, locker, microwave, mug, overbedTable, paddedBench, pcSet, printer,
  roundStool, showerSet, sofa, stackChair, table, toiletBowl, toteBag, tvStand, washbasin,
} from './furniture.ts';
import { WARD, WardMats } from './mats.ts';
import {
  bedpanWasher, floorScale, hamper, ivStand, linenCart, medCart, monitorCart, oxygenCart, pedalBin, portableUnit, sanitizerStand, sluiceSink, stretcher, vitalMonitor,
  walker, wasteBox, wheelchair,
} from './medical.ts';
import { parcelPile, wallShelfItems, wardShelf } from './storage.ts';
import { commonOpts } from './place.ts';

/**
 * 病棟の小物の見本帳（props.html の corridor）。病棟で使う小物を全部、病棟の材質（色見本の図柄 + 紙の材質）で並べる。
 * 撮る: node tools/capture.mjs --page props.html --tour corridor
 */

/** 見本帳の物（出し先が Builder のまま）を病棟の材質の出し先に包む */
const W = (p: Prop): Prop => (p.mats as WardMats).wrap(p);

const E = (id: string, label: string, size: [number, number, number], build: (p: Prop) => void): PropEntry => ({ id, label, size, build: (p) => build(W(p)) });

export function gallery(): GallerySpec {
  const c = commonOpts;
  return {
    label: '病院の病棟',
    styleFrom: 'corridor',
    mats: (ctx) => new WardMats(ctx),
    floor: '#c9cfb5',
    wall: '#c6d4b0',
    entries: [
      E('bed', '病院のベッド', [1.0, 1.1, 2.1], (p) => hospitalBed(p, { blanket: WARD.sea })),
      E('bedside', '床頭台（テレビ・引き出し・冷蔵庫）', [0.5, 1.15, 0.5], (p) => bedsideCabinet(p)),
      E('overbed', 'オーバーベッドテーブル', [0.9, 0.82, 0.5], (p) => overbedTable(p)),
      E('locker', 'ロッカー（1 段・2 段）', [1.0, 1.8, 0.55], (p) => {
        locker(p.sub([-0.25, 0, 0]), { w: 0.48 });
        locker(p.sub([0.25, 0, 0]), { w: 0.48, tiers: 2 });
      }),
      E('fridge', '冷蔵庫', [0.6, 1.7, 0.66], (p) => fridge(p)),
      E('kitchen', '電子レンジと電気ポット（机の上）', [1.2, 1.0, 0.6], (p) => {
        table(p, 1.2, 0.6, 0.72, WARD.white);
        microwave(p.sub([-0.2, 0, -0.05]), 0.72);
        mug(p.sub([0.45, 0.72, 0.18]), WARD.red);
      }),
      E('sofa', 'ソファ', [1.6, 0.85, 0.8], (p) => sofa(p, 1.6, WARD.sea)),
      E('tv', 'テレビ台とテレビ', [1.4, 1.32, 0.45], (p) => tvStand(p)),
      E('basin', '壁掛けの洗面台', [0.6, 1.62, 0.45], (p) => washbasin(p)),
      E('toilet', '便器（手すり・紙）', [0.9, 1.35, 0.7], (p) => toiletBowl(p)),
      E('stool', '丸椅子', [0.42, 0.5, 0.42], (p) => roundStool(p)),
      E('bathstool', '風呂の椅子', [0.42, 0.35, 0.36], (p) => bathStool(p)),
      E('folded', 'たたんだパイプ椅子', [0.45, 0.85, 0.1], (p) => foldedChair(p.sub([0, 0, 0], 0, { pitch: -0.12 }))),
      E('coats', 'コート掛けと上着・エプロン', [1.2, 1.7, 0.2], (p) => {
        p.box(WARD.pale, [-0.6, 1.6, -0.1], [0.6, 1.7, -0.075], { r: 0.01 });
        coat(p.sub([-0.35, 1.64, -0.075]), 0.95, WARD.sea);
        coat(p.sub([0.0, 1.64, -0.075]), 0.8, WARD.white);
        coat(p.sub([0.35, 1.64, -0.075]), 0.85, WARD.cream, 'apron');
      }),
      E('table', '机と椅子', [1.4, 0.9, 1.4], (p) => {
        table(p, 1.2, 0.75, 0.72, WARD.white);
        stackChair(p.sub([-0.3, 0, 0.55], Math.PI));
        stackChair(p.sub([0.3, 0, -0.55]));
      }),
      E('desk', '端末の机（画面・キーボード・プリンター・事務椅子）', [1.4, 1.1, 1.2], (p) => {
        table(p, 1.4, 0.6, 0.72, WARD.white);
        pcSet(p.sub([-0.3, 0, -0.05]), 0.72, 0.5);
        printer(p.sub([0.42, 0, 0]), 0.72);
        chair(p.sub([-0.3, 0, 0.7], Math.PI), c.officeChair());
      }),
      E('basket', '脱衣のかご', [0.4, 0.25, 0.35], (p) => basket(p, 0.36, 0.22, 0.33, WARD.green)),
      E('bags', '手さげの袋', [0.4, 0.3, 0.2], (p) => toteBag(p, WARD.teal)),
      E('bucket', 'バケツとモップ', [0.4, 1.4, 0.4], (p) => bucketMop(p)),
      E('cart', '処置カート', [0.7, 1.15, 0.55], (p) => medCart(p, { body: WARD.green })),
      E('cart-er', '救急カート', [0.75, 1.2, 0.6], (p) => medCart(p, { body: WARD.red, front: '#d97f80', kind: 'emergency', w: 0.72 })),
      E('cart-rec', 'カルテのカート', [0.7, 1.25, 0.55], (p) => medCart(p, { body: WARD.teal, front: '#7f9fa0', kind: 'records' })),
      E('stretcher', 'ストレッチャー', [0.75, 1.25, 2.0], (p) => stretcher(p)),
      E('wheelchair', '車椅子', [0.66, 0.95, 0.9], (p) => wheelchair(p)),
      E('iv', '点滴の柱（輸液ポンプ）', [0.55, 2.0, 0.55], (p) => ivStand(p, { bags: 2, pump: true })),
      E('monitor', '患者のモニター（腕の台）', [0.45, 1.45, 0.3], (p) => {
        p.box(WARD.grey, [-0.025, 0, -0.18], [0.025, 1.12, -0.13], { r: 0.008 });
        p.box(WARD.pale, [-0.22, 1.1, -0.18], [0.22, 1.12, 0.06], { r: 0.006 });
        vitalMonitor(p.sub([0, 1.12, 0.03]), 0.38);
      }),
      E('walker', '歩行器', [0.6, 0.9, 0.55], (p) => walker(p)),
      E('oxygen', '酸素の筒の台車', [0.9, 1.05, 0.4], (p) => oxygenCart(p)),
      E('hamper', 'リネンの袋の台車', [0.6, 0.95, 0.6], (p) => hamper(p)),
      E('linencart', 'リネンのカート', [1.0, 1.2, 0.62], (p) => linenCart(p)),
      E('waste', '感染性の廃棄物の箱', [0.42, 0.48, 0.4], (p) => wasteBox(p)),
      E('pedalbin', '足踏みのごみ箱', [0.36, 0.6, 0.4], (p) => pedalBin(p, { lid: WARD.red })),
      E('sluice', '汚物流し', [0.75, 1.95, 0.62], (p) => sluiceSink(p)),
      E('washer', 'ベッドパンの洗浄器', [0.6, 1.9, 0.62], (p) => bedpanWasher(p)),
      E('scale', '体重計', [0.4, 0.1, 0.4], (p) => floorScale(p)),
      E('sanitizer', '手指の消毒液の台', [0.35, 1.25, 0.35], (p) => sanitizerStand(p)),
      E('portable', '床の機械（吸引器）', [0.32, 0.4, 0.24], (p) => portableUnit(p)),
      E('moncart', 'モニターの台車', [1.0, 1.8, 0.5], (p) => monitorCart(p)),
      E('shelf-supply', '棚（医療材料の箱・点滴の袋）', [1.5, 1.95, 0.5], (p) => wardShelf(p, { w: 1.5, h: 1.95, d: 0.5, load: ['supply', 'ivbags', 'supply', 'bottles'] })),
      E('shelf-linen', '棚（リネン）', [1.5, 1.95, 0.5], (p) => wardShelf(p, { w: 1.5, h: 1.95, d: 0.5, load: 'linen' })),
      E('shelf-equip', '棚（器材庫: 取り混ぜ・機器）', [1.8, 1.9, 0.5], (p) => wardShelf(p, { w: 1.8, h: 1.9, d: 0.5, load: ['cardboard', 'mixed', 'devices', 'mixed'] })),
      E('shelf-files', '棚（カルテ・ファイル）', [1.2, 1.9, 0.4], (p) => wardShelf(p, { w: 1.2, h: 1.9, d: 0.4, load: ['binders', 'binders', 'paper', 'binders'] })),
      E('wallshelf', '壁の棚（手袋の箱・瓶）', [0.9, 1.8, 0.3], (p) => {
        p.box(WARD.white, [-0.45, 1.475, -0.15], [0.45, 1.5, 0.1], { r: 0.006 });
        wallShelfItems(p.sub([0, 1.5, -0.02]), 0.88, 0.22);
      }),
      E('parcels', '積んだ荷（段ボール・材料の箱）', [0.6, 1.0, 0.5], (p) => parcelPile(p, { n: 3 })),
      E('vending', '飲料の自動販売機', [1.0, 1.85, 0.75], (p) => vendingMachine(p, c.vending())),
      E('cooler', '冷水機', [0.42, 1.02, 0.42], (p) => waterCooler(p, c.cooler())),
      E('plant', '鉢植え', [0.6, 1.1, 0.6], (p) => pottedPlant(p, c.plant())),
      E('bench', '待合いの椅子', [1.8, 0.9, 0.55], (p) => bench(p, c.seats(1.8))),
      E('bench-plain', '長椅子（脱衣室・更衣室）', [1.4, 0.45, 0.4], (p) => paddedBench(p, 1.4)),
      E('couch', '処置台', [1.95, 0.8, 0.7], (p) => examCouch(p, 1.9, 0.7, 0.62)),
      E('bath', '機械浴（昇降の柱・担架の台）', [2.3, 1.2, 0.9], (p) => bathTub(p.sub([-0.2, 0, 0]), 1.9, { machine: true })),
      E('tub', '浴槽', [1.4, 0.9, 0.9], (p) => bathTub(p, 1.4)),
      E('wallfix', '壁の設備（おむつ交換台・手を乾かす機械・紙タオル）', [1.8, 1.6, 0.25], (p) => {
        p.box('#c6d4b0', [-0.95, 0, -0.03], [0.95, 1.7, 0], { r: 0.005 });
        changingTable(p.sub([-0.45, 0, 0]));
        handDryer(p, 0.25);
      }),
      E('shower', '洗い場の水栓・シャワー・鏡（壁）と風呂の椅子', [0.8, 1.9, 0.4], (p) => {
        p.box('#c6d4b0', [-0.4, 0, -0.03], [0.4, 1.95, 0], { r: 0.005 });
        showerSet(p);
        bathStool(p.sub([0, 0, 0.35]));
      }),
      E('extinguisher', '消火器', [0.3, 0.65, 0.3], (p) => extinguisher(p, c.extinguisher())),
    ],
  };
}
