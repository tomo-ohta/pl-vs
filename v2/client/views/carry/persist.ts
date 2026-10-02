/**
 * I09 置いた物が残る（クライアントの保存）: フロアの id ごとに、動かして置いた物の位置を localStorage に入れ、
 * 次に同じフロアを読んだとき、最初の持てる物の描画を作る所で部品の状態へ戻す（core の carryRestore。生成の後・最初の tick の前）。
 * 保存は置く・投げた物が落ちる・戻るたびに少し待ってから。フロアを離れる（描画を捨てる）ときにも保存する。
 * 保存するフロアの数は 48 まで（古い物から消す）。読めない・書けない環境（試験・プライベートモード）では何もしない
 */
import { carryRestore, carrySave } from '../../../core/sim/parts/carry/index.ts';
import type { Sim } from '../../../core/sim/sim.ts';
import type { ViewContext } from '../views.ts';

const PREFIX = 'liminal.v2.carry.';
const INDEX_KEY = `${PREFIX}index`;
const MAX_FLOORS = 48;
const started = new WeakSet<Sim>();

function storage(): Storage | null {
  // Node（試験）には window が無い（localStorage を触ると警告が出る）
  try { return typeof window === 'undefined' || typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

function write(sim: Sim): void {
  const ls = storage();
  if (!ls) return;
  try {
    const key = PREFIX + sim.floor.id;
    const save = carrySave(sim);
    if (save) ls.setItem(key, JSON.stringify(save)); else ls.removeItem(key);
    const index = (JSON.parse(ls.getItem(INDEX_KEY) ?? '[]') as string[]).filter((id) => id !== sim.floor.id);
    if (save) index.push(sim.floor.id);
    while (index.length > MAX_FLOORS) ls.removeItem(PREFIX + index.shift()!);
    ls.setItem(INDEX_KEY, JSON.stringify(index));
  } catch { /* 保存できなくても遊べる */ }
}

/** フロアの最初の持てる物の描画から呼ぶ: 保存を戻し、置くたびに保存する。戻り値は描画を捨てるときに呼ぶ */
export function persistFor(ctx: ViewContext): () => void {
  const sim = ctx.sim;
  if (started.has(sim)) return () => {};
  started.add(sim);
  const ls = storage();
  if (ls && sim.tick === 0) {
    try {
      const raw = ls.getItem(PREFIX + sim.floor.id);
      if (raw) carryRestore(sim, JSON.parse(raw));
    } catch { /* 壊れた保存は使わない */ }
  }
  let timer: ReturnType<typeof setTimeout> | null = null;
  const off = ctx.onEvent?.((e) => {
    if (e.type !== 'cue') return;
    const name = String(e.data?.name ?? '');
    if (!/^carry\.(drop|place|land|return|swap)$/.test(name)) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; write(sim); }, 600);
  });
  return () => { off?.(); if (timer) clearTimeout(timer); write(sim); };
}
