import { Prop, type PropEntry, type PropMats } from '../../../props/kit.ts';
import { bench, bicycle, extinguisher, trashBin } from '../../../props/lib/index.ts';
import type { GallerySpec } from '../../../props/gallery.ts';
import { resetPaintCache } from '../paint.ts';
import { alleyMats, resetAlleyPropCache, type AlleyLight } from './mats.ts';
import { BIKE_COLORS, VENDING } from './place.ts';
import {
  bookStack,
  ceilingTv,
  cleaningCabinet,
  cleaningTools,
  cubbyLocker,
  duckboard,
  gymBag,
  lectern,
  pencilCase,
  schoolBag,
  schoolChair,
  schoolDesk,
  slipperRack,
  steelLocker,
  umbrellaStand,
  wallClock,
  wallSpeaker,
} from './school.ts';
import { acUnit, bikeRack, canBin, cubicle, drinkVending, drum, faucet, garbageBag, handCart, hoseReel, meterBox, palletStack, parkBench, wheelbarrow } from './yard.ts';

/**
 * 校舎の間の通路の小物の見本帳（props.html の alley）。場所で使う小物を全部並べる（共通の小物はこの場所の色で）。
 * 材質は場所と同じ作り方（alleyMats）。室内の物は灯りの室内の段、屋外の物は陰の屋外の段で見る（日なたの物は場所で lit に替わる）
 */

let mats: Record<AlleyLight, PropMats> | null = null;

/** 見本帳の物を、その物の置かれる光の材質で作る */
function lit(light: AlleyLight, f: (p: Prop) => void): (p: Prop) => void {
  return (p) => f(new Prop(p.sink, mats?.[light] ?? p.mats, p.m, 7));
}

const room = (f: (p: Prop) => void): ((p: Prop) => void) => lit('room', f);
const out = (f: (p: Prop) => void): ((p: Prop) => void) => lit('shade', f);

const ENTRIES: PropEntry[] = [
  // ---- 教室
  { id: 'desk', label: '生徒の机と椅子', size: [0.6, 0.8, 1.0], build: room((p) => { schoolDesk(p.sub([0, 0, -0.2])); schoolChair(p.sub([0, 0, 0.32], Math.PI)); bookStack(p.sub([-0.1, 0.71, -0.2], 0.1), 3); pencilCase(p.sub([0.15, 0.71, -0.15], -0.3), '#3f6f9a'); schoolBag(p.sub([0.36, 0.02, -0.15], Math.PI / 2, { roll: 0.05 }), '#253246'); }) },
  { id: 'lectern', label: '教卓', size: [1.06, 1.1, 0.66], build: room((p) => lectern(p)) },
  { id: 'cubby', label: '教室の後ろのロッカー', size: [2.72, 1.05, 0.45], build: room((p) => cubbyLocker(p, { cols: 4 })) },
  { id: 'clock', label: '掛け時計・放送のスピーカー・テレビ', size: [1.6, 2.4, 0.3], build: room((p) => { wallClock(p.sub([-0.6, 1.9, 0])); wallSpeaker(p.sub([-0.1, 1.9, 0])); ceilingTv(p.sub([0.55, 1.6, 0.12]), { drop: 0.3 }); }) },
  { id: 'cabinet', label: '掃除用具入れ', size: [0.7, 1.8, 0.5], build: room((p) => cleaningCabinet(p)) },
  { id: 'gymbag', label: '体操着の袋・かばん', size: [0.8, 1.1, 0.3], build: room((p) => { gymBag(p.sub([-0.2, 1.05, 0]), '#2f4f7a'); gymBag(p.sub([0.1, 1.05, 0]), '#6a3a40'); schoolBag(p.sub([0.3, 0, 0], 0.2), '#2e2f33'); }) },
  // ---- 廊下
  { id: 'locker', label: '廊下のスチールロッカー', size: [1.54, 1.0, 0.36], build: room((p) => steelLocker(p, { cols: 4 })) },
  { id: 'slippers', label: '来客用のスリッパの棚', size: [1.4, 1.1, 0.4], build: room((p) => slipperRack(p)) },
  { id: 'duckboard', label: '簀の子', size: [1.1, 0.05, 1.2], build: room((p) => duckboard(p)) },
  { id: 'umbrella', label: '傘立て', size: [0.6, 0.9, 0.3], build: room((p) => umbrellaStand(p, { fill: 0.7 })) },
  { id: 'clean', label: '掃除用具（ほうき・モップ・バケツ）', size: [0.8, 1.3, 0.4], build: room((p) => cleaningTools(p)) },
  { id: 'bins-corr', label: '分別のごみ箱（廊下）', size: [1.1, 0.9, 0.45], build: room((p) => trashBin(p, { kind: 'recycle', body: '#c4c9bf', lid: '#4f8a6a' })) },
  { id: 'ext', label: '消火器', size: [0.3, 0.65, 0.3], build: room((p) => extinguisher(p, { red: '#c8463e' })) },
  // ---- 中庭・自販機の前
  { id: 'vending', label: '飲料の自動販売機', size: [1.0, 1.85, 0.75], build: out((p) => drinkVending(p, { ...VENDING[0], inner: mats?.lit })) },
  { id: 'vending2', label: '飲料の自動販売機（赤）', size: [1.0, 1.85, 0.75], build: out((p) => drinkVending(p, { ...VENDING[1], inner: mats?.lit })) },
  { id: 'canbin', label: '空き缶・ペットボトルの回収箱', size: [1.1, 0.9, 0.4], build: out((p) => { canBin(p.sub([-0.28, 0, 0])); canBin(p.sub([0.28, 0, 0]), { body: '#e0e2da', band: '#3f78b0' }); }) },
  { id: 'bench-slat', label: 'ベンチ（背なし）', size: [1.05, 0.45, 0.45], build: out((p) => bench(p, { w: 1.05, seat: '#a08460', frame: '#5a625e' })) },
  { id: 'parkbench', label: 'ベンチ（背もたれ）', size: [1.8, 0.85, 0.6], build: out((p) => parkBench(p)) },
  { id: 'bin', label: 'ごみ箱（中庭）', size: [0.45, 0.75, 0.45], build: out((p) => trashBin(p, { body: '#5f7a6a', lid: '#3a4a44' })) },
  { id: 'cart', label: '台車', size: [0.6, 0.92, 0.95], build: out((p) => handCart(p)) },
  { id: 'umbrella-big', label: '傘立て（昇降口・本館の入口）', size: [0.7, 0.9, 0.3], build: out((p) => umbrellaStand(p, { w: 0.7, d: 0.3, h: 0.55, nx: 5, fill: 0.5 })) },
  { id: 'faucet', label: '水飲み場の蛇口・散水栓', size: [0.5, 1.0, 0.2], build: out((p) => { faucet(p.sub([-0.15, 0.95, 0]), { up: true, riser: 0.13 }); faucet(p.sub([0.15, 0.7, 0])); }) },
  // ---- 駐輪場
  { id: 'bicycle', label: '自転車（ママチャリ）', size: [0.7, 1.1, 1.8], build: out((p) => bicycle(p, { frame: BIKE_COLORS[0], basket: '#8e9994' })) },
  { id: 'rack', label: '駐輪ラックと自転車', size: [1.8, 1.1, 1.8], build: out((p) => { bikeRack(p.sub([0, 0, -0.55]), { n: 3 }); for (let i = 0; i < 3; i++) bicycle(p.sub([-0.6 + i * 0.6, 0, 0.2], Math.PI), { frame: BIKE_COLORS[(i * 2) % BIKE_COLORS.length], basket: '#8e9994' }); }) },
  // ---- 裏庭・倉庫のまわり・壁ぞい
  { id: 'drum', label: 'ドラム缶', size: [0.6, 0.9, 0.6], build: out((p) => drum(p)) },
  { id: 'pallet', label: 'パレットと袋・段ボール', size: [1.1, 0.7, 1.1], build: out((p) => palletStack(p, { base: 1, load: 'sacks' })) },
  { id: 'pallet-box', label: 'パレットと段ボール', size: [1.1, 1.0, 1.1], build: out((p) => palletStack(p, { base: 1, load: 'boxes' })) },
  { id: 'wheelbarrow', label: '一輪車', size: [0.7, 0.65, 1.7], build: out((p) => wheelbarrow(p)) },
  { id: 'garbage', label: 'ごみ袋', size: [1.0, 0.55, 0.5], build: out((p) => { garbageBag(p.sub([-0.25, 0, 0], 0.3)); garbageBag(p.sub([0.25, 0, 0.05], -0.8), '#c9d6e0'); }) },
  { id: 'hose', label: 'ホースの巻き取り', size: [0.6, 0.72, 0.45], build: out((p) => hoseReel(p)) },
  { id: 'cubicle', label: 'キュービクル（受電設備）', size: [3.3, 2.3, 1.4], build: out((p) => cubicle(p)) },
  { id: 'ac', label: 'エアコンの室外機（置き台・壁の金物）', size: [2.0, 1.6, 0.45], build: out((p) => { acUnit(p.sub([-0.5, 0, 0]), { stand: 0.2, up: 0.8 }); acUnit(p.sub([0.55, 0.9, 0]), { bracket: true, up: 0.4, sx: -1 }); }) },
  { id: 'meter', label: '電力量計', size: [0.3, 1.6, 0.15], build: out((p) => meterBox(p.sub([0, 1.0, 0]))) },
];

export function gallery(): GallerySpec {
  return {
    label: '校舎の間の通路',
    styleFrom: 'alley',
    mats: () => {
      resetPaintCache();
      resetAlleyPropCache();
      mats = { shade: alleyMats({ light: 'shade', fog: 0.3 }), room: alleyMats({ light: 'room', fog: 0.3 }), lit: alleyMats({ light: 'lit', fog: 0.3 }) };
      return mats.shade;
    },
    entries: ENTRIES,
    floor: '#5a5f5c',
    wall: '#8a8f8a',
  };
}
