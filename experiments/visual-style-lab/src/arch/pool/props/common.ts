import type { Prop } from '../../../props/kit.ts';
import { bench, chair, extinguisher, pottedPlant, ticketMachine, trashBin, vendingMachine, waterCooler } from '../../../props/lib/index.ts';
import { PC, PG } from './mats.ts';

/**
 * 共通の小物（src/props/lib）をプールの色で。場面と見本帳の両方からこの関数で作る。
 */

/** 自動販売機: drink = 飲み物（青緑の帯・色とりどりの缶とボトル）、water = 水とスポーツ飲料（青の帯・白と青のボトル） */
export function poolVending(p: Prop, kind: 'drink' | 'water' = 'drink'): void {
  if (kind === 'water') vendingMachine(p, { body: PC.white, accent: PC.blue, lit: PG.lamp, goodsColors: [PC.white, PC.blue, PC.pale, PC.blue, PC.white, PC.teal], cold: PG.blue, hot: PG.red });
  else vendingMachine(p, { body: PC.white, accent: PC.teal, lit: PG.lamp, goodsColors: [PC.red, PC.blue, PC.white, PC.yellow, PC.teal, PC.tealDark, PC.kraft, PC.red], cold: PG.blue, hot: PG.red });
}

export function poolTicket(p: Prop): void {
  ticketMachine(p, { body: PC.pale, screen: PG.aqua, accent: PC.teal });
}

export function poolCooler(p: Prop): void {
  waterCooler(p, { body: PC.chrome, top: PC.metal });
}

/** ベンチ: deck = プールサイド（青緑の板・ステンレスの脚）、wood = 更衣室・通路（木の板）、seats = 待合いの椅子 */
export function poolBench(p: Prop, kind: 'deck' | 'wood' | 'seats', w: number): void {
  if (kind === 'seats') bench(p, { kind: 'seats', w, seat: PC.teal, frame: PC.steel });
  else if (kind === 'deck') bench(p, { kind: 'slat', w, seat: PC.teal, frame: PC.chrome });
  else bench(p, { kind: 'slat', w, seat: PC.wood, frame: PC.metal });
}

export function poolChair(p: Prop, kind: 'stack' | 'office' = 'stack', seat: string = PC.tealDark): void {
  chair(p, { kind, seat, frame: kind === 'office' ? PC.steel : PC.chrome });
}

/** 鉢植え（白い鉢・緑の葉。h = 葉の上までの高さ） */
export function poolPlant(p: Prop, h = 1.1, kind: 'broad' | 'palm' = 'broad'): void {
  pottedPlant(p, { pot: PC.white, leaf: PC.leaf, h, kind });
}

export function poolBin(p: Prop, kind: 'round' | 'recycle' = 'round'): void {
  trashBin(p, { kind, body: kind === 'round' ? PC.pale : PC.white, lid: PC.tealDark });
}

export function poolExtinguisher(p: Prop, stand = true): void {
  extinguisher(p, { stand, red: PC.red });
}
