/**
 * I09 置いた物が残る（クライアントの保存。段階 4 carry の物を ClientGame の読み込みへ移した）:
 * フロアの鍵（世界の seed・フロアの id・調整表の版）ごとに、動かして置いた物の位置を localStorage に入れ、
 * 次に同じフロアを読んだとき、最初の tick の前に部品の状態へ戻す（core の carryRestore）。
 * 保存は置く・投げた物が落ちる・戻るたびに少し待ってから。フロアを離れるときにも保存する。
 * 保存するフロアの数は 48 まで（古い物から消す）。読めない・書けない環境（試験・プライベートモード）では何もしない
 */
import { carryRestore, carrySave } from '../../core/sim/parts/carry/index.ts';
import type { Sim } from '../../core/sim/sim.ts';
import type { SimEvent } from '../../core/sim/types.ts';
import { STORAGE_PREFIX } from '../env.ts';

const INDEX_KEY = `${STORAGE_PREFIX}carry.v1`;
const floorKey = (key: string): string => `${INDEX_KEY}:${key}`;
const MAX_FLOORS = 48;
/** 段階 4 の途中の保存（フロアの id だけを鍵にしていたので、別の世界の同じ深さに戻っていた）。読まずに消す */
const OLD_PREFIX = 'liminal.v2.carry.';

function storage(): Storage | null {
  try { return typeof window === 'undefined' || typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

function dropOld(ls: Storage): void {
  for (let i = ls.length - 1; i >= 0; i--) { const k = ls.key(i); if (k?.startsWith(OLD_PREFIX)) ls.removeItem(k); }
}

function write(sim: Sim, key: string): void {
  const ls = storage();
  if (!ls) return;
  try {
    const save = carrySave(sim);
    if (save) ls.setItem(floorKey(key), JSON.stringify(save)); else ls.removeItem(floorKey(key));
    const index = (JSON.parse(ls.getItem(INDEX_KEY) ?? '[]') as string[]).filter((k) => k !== key);
    if (save) index.push(key);
    while (index.length > MAX_FLOORS) ls.removeItem(floorKey(index.shift()!));
    ls.setItem(INDEX_KEY, JSON.stringify(index));
  } catch { /* 保存できなくても遊べる */ }
}

/** 読み込んだフロアに保存を戻す（最初の tick の前に呼ぶ） */
export function restoreCarry(sim: Sim, key: string): void {
  const ls = storage();
  if (!ls) return;
  try {
    dropOld(ls);
    const raw = ls.getItem(floorKey(key));
    if (raw) carryRestore(sim, JSON.parse(raw));
  } catch { /* 壊れた保存は使わない */ }
}

/** 置くたびに保存する。戻り値はフロアを離れるときに呼ぶ（そこでも保存する） */
export function watchCarry(sim: Sim, key: string, subscribe: (f: (e: SimEvent) => void) => () => void): () => void {
  if (!sim.floor.entities.some((e) => e.type === 'carryItem' || e.type === 'carryBody')) return () => {};
  let timer: ReturnType<typeof setTimeout> | null = null;
  const off = subscribe((e) => {
    if (e.type !== 'cue') return;
    if (!/^carry\.(drop|place|land|return|swap)$/.test(String(e.data?.name ?? ''))) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; write(sim, key); }, 600);
  });
  return () => { off(); if (timer) clearTimeout(timer); write(sim, key); };
}
