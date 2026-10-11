import type { Prop, V2 } from '../../../props/kit.ts';
import type { V3 } from '../../../scenes/Builder.ts';
import { roundRect } from '../../../props/kit.ts';
import { bench, extinguisher, pottedPlant, trashBin, vendingMachine } from '../../../props/lib/index.ts';
import { lockerBank, showerStall, vanity } from '../../pool/props/furniture.ts';
import { kickboardPile } from '../../pool/props/gear.ts';
import { lifeguardChair, lounger, poolLadder, ringBuoy, rescueBoard, wallClock } from '../../pool/props/poolside.ts';
import { WC, WG } from './mats.ts';

/**
 * ウォーターパークの小物。正面 +z・床 y = 0（src/props/kit.ts の約束）。
 * 共通の小物（src/props/lib）とプールの小物（src/arch/pool/props）は、この場所の色（WC）で呼ぶ。
 * この場所だけの物: プールサイドのシャワー柱・案内の標識・スライダーの出発の門・浮き輪の台・救命浮環の柱・スライダーの案内板
 */
export { lifeguardChair, lounger, poolLadder, ringBuoy, rescueBoard, wallClock, lockerBank, showerStall, vanity, kickboardPile };

/** 自動販売機（夜のプールの白と青） */
export function wpVending(p: Prop): void {
  vendingMachine(p, { body: WC.white, accent: WC.blue, lit: WG.lamp, goodsColors: [WC.red, WC.blue, WC.white, WC.yellow, WC.mint, WC.pink, WC.navy], cold: WG.blue, hot: WG.red });
}

/** プールサイドのベンチ（青の板・ステンレスの脚） */
export function wpBench(p: Prop, w = 1.8): void {
  bench(p, { kind: 'slat', w, seat: WC.blue, frame: WC.chrome });
}

export function wpBin(p: Prop): void {
  trashBin(p, { kind: 'recycle', body: WC.white, lid: WC.blue });
}

export function wpPlant(p: Prop): void {
  pottedPlant(p, { h: 1.3, kind: 'palm', pot: WC.white, leaf: WC.leaf });
}

export function wpExtinguisher(p: Prop): void {
  extinguisher(p);
}

/** 重ねた寝椅子 */
export function loungerStack(p: Prop, n = 5): void {
  for (let i = 0; i < n; i++) lounger(p.sub([0, i * 0.075, 0]), { flat: true, color: WC.white });
}

/**
 * プールサイドのシャワー柱（立ったまま浴びるシャワー）: 床の排水の升・太い柱・上の曲がった腕とシャワーの頭・押しボタン・足洗いの蛇口
 */
export function poolShower(p: Prop): void {
  // 床の排水の升（格子）
  p.box(WC.steel, [-0.45, 0, -0.45], [0.45, 0.012, 0.45], { shadow: 'receive' });
  for (let i = -3; i <= 3; i++) p.box(WC.ink, [i * 0.11 - 0.012, 0.012, -0.4], [i * 0.11 + 0.012, 0.016, 0.4], { shadow: false });
  // 柱（台座つき）
  p.cyl(WC.chrome, [0, 0.03, -0.35], 0.09, 0.06, { seg: 16 });
  p.cyl(WC.chrome, [0, 1.15, -0.35], 0.045, 2.3, { seg: 14 });
  // 上の腕（曲げた管）とシャワーの頭
  p.bend(WC.chrome, [[0, 2.28, -0.35], [0, 2.4, -0.35], [0, 2.4, 0.05], [0, 2.3, 0.12]], 0.03, 0.1);
  p.cyl(WC.chrome, [0, 2.26, 0.13], 0.11, 0.04, { seg: 20 });
  p.cyl(WC.mist, [0, 2.238, 0.13], 0.09, 0.006, { seg: 20, shadow: false });
  // 押しボタン（青）と札
  p.box(WC.chrome, [-0.05, 1.18, -0.3], [0.05, 1.32, -0.27], { r: 0.01 });
  p.cyl(WC.blue, [0, 1.25, -0.265], 0.028, 0.02, { axis: 'z', seg: 12, shadow: false });
  p.box(WC.white, [-0.09, 1.42, -0.305], [0.09, 1.58, -0.298], { shadow: false });
  p.box(WC.blue, [-0.09, 1.54, -0.298], [0.09, 1.58, -0.296], { shadow: false });
  // 足洗いの低い蛇口
  p.bend(WC.chrome, [[0, 0.45, -0.32], [0, 0.45, -0.18], [0, 0.38, -0.14]], 0.016, 0.04);
  p.collide([-0.1, 0, -0.45], [0.1, 2.4, -0.25]);
}

/** 案内の標識（柱と、矢印とスライダーの絵の板）。dir = 矢印の向き（1 右・-1 左） */
export function signPost(p: Prop, dir = 1, color: string = WC.navy): void {
  p.cyl(WC.steel, [0, 1.15, 0], 0.035, 2.3, { seg: 10 });
  p.cyl(WC.steel, [0, 0.02, 0], 0.16, 0.04, { seg: 14 });
  // 板（角の丸い・厚み）
  p.extrude(color, roundRect(0, 2.05, 0.9, 0.45, 0.04), 'xy', 0.04, 0.075, { bevel: 0.006 });
  // 矢印（白）
  const s = dir;
  const arrow: V2[] = [[-0.2 * s, 1.99], [0.02 * s, 1.99], [0.02 * s, 1.93], [0.16 * s, 2.05], [0.02 * s, 2.17], [0.02 * s, 2.11], [-0.2 * s, 2.11]];
  p.extrude(WC.white, s > 0 ? arrow : arrow.slice().reverse(), 'xy', 0.075, 0.082);
  // スライダーの絵（桃色の曲線の帯と人の頭）
  p.tube(WC.pink, [[-0.38 * s, 2.2], [-0.33 * s, 2.0], [-0.27 * s, 2.12], [-0.22 * s, 1.92]].map(([x, y]): V3 => [x, y, 0.08]), 0.018, { seg: 16, radial: 5, shadow: false });
  p.ball(WC.white, [-0.36 * s, 2.24, 0.082], 0.025, { shadow: false });
  // 下の札（黄・注意）
  p.box(WC.yellow, [-0.25, 1.62, 0.04], [0.25, 1.74, 0.06], { r: 0.008 });
  p.box(WC.ink, [-0.2, 1.665, 0.06], [0.2, 1.695, 0.063], { shadow: false });
  p.collide([-0.45, 0, -0.05], [0.45, 2.3, 0.1]);
}

/** スライダーの出発の門: 2 本の柱と腰の高さの棒、赤と緑の信号の箱、床の「待て」の印、手すり */
export function slideGate(p: Prop, w = 1.2): void {
  for (const x of [-w / 2, w / 2]) {
    p.box(WC.steel, [x - 0.04, 0, -0.04], [x + 0.04, 1.4, 0.04], { r: 0.01 });
    p.cyl(WC.ink, [x, 0.01, 0], 0.07, 0.02, { seg: 10 });
  }
  // 腰の棒（黄と黒の縞）
  for (let i = 0; i < 6; i++) {
    const x0 = -w / 2 + 0.05 + (i * (w - 0.1)) / 6;
    const x1 = -w / 2 + 0.05 + ((i + 1) * (w - 0.1)) / 6;
    p.box(i % 2 ? WC.ink : WC.yellow, [x0, 0.88, -0.025], [x1, 0.94, 0.025]);
  }
  // 上の信号の箱
  p.box(WC.ink, [-0.16, 1.4, -0.08], [0.16, 1.62, 0.06], { r: 0.02 });
  p.box(WC.steel, [-w / 2, 1.4, -0.03], [w / 2, 1.44, 0.03]);
  p.cyl(WG.red, [-0.07, 1.51, 0.062], 0.045, 0.01, { axis: 'z', seg: 14, kind: 'glow', shadow: false });
  p.cyl(WC.teal, [0.07, 1.51, 0.062], 0.045, 0.01, { axis: 'z', seg: 14, shadow: false });
  // 床の待ち位置の印（黄の線）
  p.box(WC.yellow, [-w / 2, 0, 0.5], [w / 2, 0.006, 0.56], { shadow: false });
  p.collide([-w / 2 - 0.05, 0, -0.05], [w / 2 + 0.05, 1.62, 0.07]);
}

/** 浮き輪の台（ステンレスの枠と、色の違う浮き輪を縦に並べる） */
export function floatRack(p: Prop, n = 5): void {
  const W = 1.4;
  for (const x of [-W / 2, W / 2]) {
    p.box(WC.chrome, [x - 0.025, 0, -0.3], [x + 0.025, 1.0, -0.25]);
    p.box(WC.chrome, [x - 0.025, 0, 0.25], [x + 0.025, 1.0, 0.3]);
    p.box(WC.chrome, [x - 0.025, 0.05, -0.3], [x + 0.025, 0.09, 0.3]);
    p.cyl(WC.rubber, [x, 0.02, -0.27], 0.035, 0.04, { seg: 8 });
    p.cyl(WC.rubber, [x, 0.02, 0.27], 0.035, 0.04, { seg: 8 });
  }
  p.box(WC.chrome, [-W / 2, 0.95, -0.025], [W / 2, 0.98, 0.025]);
  p.box(WC.chrome, [-W / 2, 0.12, -0.3], [W / 2, 0.15, 0.3]);
  const cols = [WC.pink, WC.mint, WC.yellow, WC.blue, WC.white, WC.pink, WC.mint];
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + 0.2 + (i * (W - 0.4)) / Math.max(n - 1, 1);
    const tilt = (p.r() - 0.5) * 0.12;
    p.sub([x, 0.52, 0], Math.PI / 2, { roll: tilt }).torus(cols[i % cols.length], [0, 0, 0], 0.34, 0.11, { axis: 'z', seg: 22, radial: 10 });
  }
  p.collide([-W / 2 - 0.03, 0, -0.32], [W / 2 + 0.03, 1.0, 0.32]);
}

/** 救命浮環の柱（細い柱の上の掛け具・浮環・巻いたロープ） */
export function ringBuoyPost(p: Prop): void {
  p.cyl(WC.chrome, [0, 0.75, 0], 0.03, 1.5, { seg: 10 });
  p.cyl(WC.steel, [0, 0.015, 0], 0.12, 0.03, { seg: 12 });
  p.box(WC.chrome, [-0.04, 1.42, 0], [0.04, 1.46, 0.12]);
  ringBuoy(p.sub([0, 1.1, 0.14]));
  p.collide([-0.35, 0, -0.05], [0.35, 1.5, 0.3]);
}

/** スライダーの案内板（立て看板: 枠と、3 本のスライダーの色の帯と注意の札） */
export function slideBoard(p: Prop): void {
  for (const x of [-0.55, 0.55]) p.box(WC.steel, [x - 0.03, 0, -0.03], [x + 0.03, 1.9, 0.03]);
  p.extrude(WC.white, roundRect(0, 1.35, 1.2, 0.9, 0.03), 'xy', 0.03, 0.06, { bevel: 0.005 });
  p.box(WC.navy, [-0.56, 1.66, 0.06], [0.56, 1.76, 0.063], { shadow: false });
  const bands: [string, number][] = [[WC.pink, 1.52], [WC.mint, 1.36], [WC.blue, 1.2]];
  for (const [c, y] of bands) {
    p.box(c, [-0.5, y - 0.05, 0.06], [-0.32, y + 0.05, 0.064], { shadow: false });
    for (let i = 0; i < 4; i++) p.box(WC.mist, [-0.26 + i * 0.18, y - 0.012, 0.06], [-0.12 + i * 0.18, y + 0.012, 0.063], { shadow: false });
  }
  p.box(WC.yellow, [-0.5, 0.96, 0.06], [0.5, 1.04, 0.064], { shadow: false });
  p.collide([-0.6, 0, -0.04], [0.6, 1.9, 0.07]);
}

/** 監視台（プールの小物を、この場所の色で） */
export function wpLifeguard(p: Prop): void {
  lifeguardChair(p, { h: 1.75 });
}

/** プールの入水の階段（はしご）。背 -z がプールサイド */
export function wpLadder(p: Prop, depth = 1.0): void {
  poolLadder(p, depth);
}

export function wpExtinguisherBox(p: Prop): void {
  // 赤い箱と中の消火器（壁付け）
  p.box(WC.red, [-0.22, 0.6, -0.12], [0.22, 1.4, 0.04], { r: 0.015 });
  p.box(WC.white, [-0.17, 1.22, 0.04], [0.17, 1.32, 0.045], { shadow: false });
  wpExtinguisher(p.sub([0, 0.62, -0.04], 0, { scale: 0.85 }));
}
