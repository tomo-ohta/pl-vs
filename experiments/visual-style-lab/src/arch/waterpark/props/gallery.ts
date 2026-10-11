import type { GallerySpec } from '../../../props/gallery.ts';
import type { Prop, PropEntry } from '../../../props/kit.ts';
import { floatRack, kickboardPile, lockerBank, loungerStack, lounger, poolShower, rescueBoard, ringBuoyPost, showerStall, signPost, slideBoard, slideGate, vanity, wallClock, wpBench, wpBin, wpExtinguisherBox, wpLadder, wpLifeguard, wpPlant, wpVending } from './items.ts';
import { WC, wpPropMats } from './mats.ts';

/**
 * ウォーターパークの小物の見本帳（props.html の waterpark）。場面で使う小物を全部、この場所の材質で並べる。
 * 壁に付ける物は後ろに小さな壁、プールのはしごはプールの縁の段を置いて見せる
 */
const wall = (p: Prop, w: number, h = 2.6): void => p.box(WC.pale, [-w / 2, 0, -0.12], [w / 2, h, 0]);
const edge = (p: Prop, w: number, h: number): void => p.box(WC.pale, [-w / 2, 0, -0.9], [w / 2, h, 0]);

export function gallery(): GallerySpec {
  const entries: PropEntry[] = [
    { id: 'shower', label: 'プールサイドのシャワー柱', size: [0.9, 2.45, 0.9], build: (p) => poolShower(p) },
    { id: 'sign', label: '案内の標識', size: [0.9, 2.3, 0.3], build: (p) => signPost(p, 1) },
    { id: 'gate', label: 'スライダーの出発の門', size: [1.3, 1.65, 0.7], build: (p) => slideGate(p) },
    { id: 'float-rack', label: '浮き輪の台', size: [1.5, 1.0, 0.7], build: (p) => floatRack(p) },
    { id: 'ring-post', label: '救命浮環の柱', size: [0.7, 1.5, 0.5], build: (p) => ringBuoyPost(p) },
    { id: 'slide-board', label: 'スライダーの案内板', size: [1.2, 1.9, 0.2], build: (p) => slideBoard(p) },
    { id: 'guard', label: '監視台', size: [1.0, 2.35, 1.1], build: (p) => wpLifeguard(p) },
    { id: 'ladder', label: 'プールのはしご', size: [1.2, 1.95, 0.9], build: (p) => { edge(p, 1.2, 1.0); wpLadder(p.sub([0, 1.0, 0]), 1.0); } },
    { id: 'lounger', label: '寝椅子', size: [0.7, 0.8, 1.95], build: (p) => lounger(p, { color: WC.white }) },
    { id: 'lounger-stack', label: '重ねた寝椅子', size: [0.7, 0.8, 1.95], build: (p) => loungerStack(p) },
    { id: 'bench', label: 'プールサイドのベンチ', size: [1.8, 0.45, 0.45], build: (p) => wpBench(p) },
    { id: 'vending', label: '自動販売機', size: [1.0, 1.85, 0.75], build: (p) => wpVending(p) },
    { id: 'bin', label: '分別のごみ箱', size: [1.1, 0.9, 0.45], build: (p) => wpBin(p) },
    { id: 'plant', label: '鉢植え（細い葉）', size: [0.8, 1.3, 0.8], build: (p) => wpPlant(p) },
    { id: 'extinguisher', label: '消火器の箱（壁付け）', size: [0.5, 2.0, 0.3], build: (p) => { wall(p, 0.8, 2.0); wpExtinguisherBox(p); } },
    { id: 'kickboards', label: 'ビート板の山', size: [0.3, 0.4, 0.45], build: (p) => kickboardPile(p, 12, [WC.yellow, WC.blue]) },
    { id: 'rescue-board', label: '救命具の板', size: [1.1, 2.2, 0.3], build: (p) => { wall(p, 1.1); rescueBoard(p); } },
    { id: 'clock', label: '壁の時計', size: [0.7, 2.6, 0.2], build: (p) => { wall(p, 0.7, 2.7); wallClock(p, 2.2, 0.3); } },
    { id: 'lockers', label: 'コインロッカー', size: [2.0, 1.8, 0.5], build: (p) => lockerBank(p, { n: 5, rows: 3, color: WC.blue }) },
    { id: 'shower-stall', label: 'シャワーの仕切り', size: [1.0, 2.1, 1.0], build: (p) => { wall(p, 1.2, 2.4); showerStall(p, 1.0, 0.0, true, true); } },
    { id: 'vanity', label: '化粧台', size: [2.4, 2.0, 0.6], build: (p) => { wall(p, 2.6, 2.4); vanity(p, 2.4); } },
  ];
  return { label: 'ウォーターパーク', styleFrom: 'waterpark', mats: (ctx) => wpPropMats(ctx), entries, floor: '#4f86ac', wall: '#b4c8d6' };
}
