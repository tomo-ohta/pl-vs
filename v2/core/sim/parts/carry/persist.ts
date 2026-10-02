/**
 * I09 置いた物が残る（セーブ・非同期マルチプレイの下地）: 動かして置いた物の位置を小さな形で取り出し、次に同じフロアを作ったとき
 * 生成の後に部品の状態へ戻す。core は決定的なまま（同じ保存を戻せば同じ状態）。保存先（ブラウザの localStorage）はクライアントが持つ
 * （client/game/carryStore.ts）。
 *
 * 保存の形: { v: 1, floor, gen, tune, items: { 部品 id: [x, 底の y, z, yaw] } }（cm に丸める）。
 * フロアの id・生成器の版・調整表の版が違えば戻さない（部品の id が別の物を指しているかもしれないので）。
 * 持っている物・飛んでいる物は保存しない。persist: false の物（ミニゲームの球など）も保存しない
 */
import type { Sim } from '../../sim.ts';
import type { FloorLayout } from '../../../world/layout.ts';
import { carryIndex, HELD, REST, type ItemState } from './common.ts';
import { itemCfg, setRest } from './item.ts';

export interface CarrySave {
  v: 1;
  floor: string;
  gen: string;
  tune: string;
  /** [x, 底の y, z, yaw]（受けの枠に置いた物は 5 つ目に 1） */
  items: { [id: string]: number[] };
}

const r2 = (v: number): number => Math.round(v * 100) / 100;

/** 置いた物の保存（動かして置いた物が無ければ null）。果てしない階は区域ごと（layout = 区域の layout） */
export function carrySave(sim: Sim, layout: FloorLayout = sim.floor): CarrySave | null {
  const ix = carryIndex(layout);
  const items: CarrySave['items'] = {};
  let n = 0;
  for (const id of ix.items) {
    const st = sim.stateOf(id) as ItemState | null;
    const cfg = itemCfg(ix.specs.get(id)!, layout.cells);
    if (!st || !st.moved || st.mode !== REST || !cfg.persist) continue;
    items[id] = [r2(st.poses[0]!), r2(st.poses[1]! - cfg.half[1]), r2(st.poses[2]!), r2(st.yaw), ...(st.slot ? [1] : [])];
    n++;
  }
  return n ? { v: 1, floor: layout.id, gen: layout.genVersion, tune: layout.tuningVersion, items } : null;
}

/** 保存を部品の状態へ戻す（シミュレーションを作った直後に呼ぶ）。戻した物の数 */
export function carryRestore(sim: Sim, save: CarrySave | null | undefined, layout: FloorLayout = sim.floor): number {
  if (!save || save.v !== 1 || save.floor !== layout.id || save.gen !== layout.genVersion || save.tune !== layout.tuningVersion) return 0;
  const ix = carryIndex(layout);
  let n = 0;
  for (const [id, p] of Object.entries(save.items)) {
    const spec = ix.specs.get(id);
    // 状態は読むだけの型で返るが、生成の直後に戻すときだけ書き換える
    const st = sim.stateOf(id) as ItemState | null;
    if (!spec || !st || st.mode === HELD || !Array.isArray(p) || p.length < 4 || p.length > 5 || !p.every(Number.isFinite)) continue;
    const cfg = itemCfg(spec, layout.cells);
    if (!cfg.persist) continue;
    setRest(st, cfg, [p[0]!, p[1]!, p[2]!], p[3]!);
    st.moved = 1;
    st.slot = p[4] ? 1 : 0;
    st.prev = [st.poses[0]!, st.poses[1]!, st.poses[2]!];
    if (st.handle >= 0 && sim.physics) sim.physics.placeBody(st.handle, [st.poses[0]!, st.poses[1]!, st.poses[2]!], [st.poses[3]!, st.poses[4]!, st.poses[5]!, st.poses[6]!]);
    n++;
  }
  return n;
}
