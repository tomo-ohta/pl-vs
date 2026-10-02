/**
 * 別室（F28。[QR 特殊個室]）: 普通の扉の先の小さな部屋が、まれに異変を重ねた個室になっている。
 * 家具の異変（巨大・小さい・積み上げ・散乱・逆さま）・光の異変（暗闇・霧・色）・部屋の異変（浸水・軽い部屋・時計・扉だらけ）から
 * 1 つずつ、structure.privateRoom.parts 個を選んで、同じ部屋に順に掛ける（扉を開けた瞬間に「全部おかしい」）。
 * どれかが掛けられなければ全部取り消す（部屋は普通の部屋に戻る。異変の仕組み anomaly/index.ts が戻す）。
 * 重ねる異変の部品の名前は、異変ごとに分ける（`a:privateRoom:<区画>.<異変>.<名前>`）。
 */
import { anomalyDef, defineAnomaly, type AnomalyContext, type AnomalyDef } from '../../types.ts';

/** 重ねる異変の組（同じ組からは 1 つだけ。家具を動かす異変どうし・照明を変える異変どうしは重ねない） */
const GROUPS: readonly string[][] = [
  ['giant', 'tiny', 'stack', 'scatter', 'upsideDown'],
  ['dark', 'fog', 'tint'],
  ['flood', 'lowGravity', 'clocks', 'doors'],
];

/** 重ねる異変の文脈（部品の名前・pre と post の受け渡し・乱数を異変ごとに分ける） */
function subContext(ctx: AnomalyContext, def: AnomalyDef, stage: string): AnomalyContext {
  const memo = (ctx.memo[def.id] ??= {}) as Record<string, unknown>;
  return {
    geo: ctx.geo, cell: ctx.cell, rng: ctx.rng.fork(`${def.id}:${stage}`), tuning: ctx.tuning, floor: ctx.floor, id: `${ctx.id}.${def.id}`,
    entrance: ctx.entrance, main: ctx.main, rects: ctx.rects, furniture: ctx.furniture, memo,
    addBox: (b) => ctx.addBox(b),
    removeBoxes: (p) => ctx.removeBoxes(p),
    addEntity: (name, e) => ctx.addEntity(`${def.id}.${name}`, e),
    addZone: (z) => ctx.addZone(z),
    skipDress: () => ctx.skipDress(),
    keepOut: (a) => ctx.keepOut(a),
    reachOk: () => ctx.reachOk(),
  };
}

defineAnomaly({
  id: 'privateRoom', name: '別室', weight: 1.0, intensity: 3, kinds: ['room'], minSize: [3.6, 4.0], minHeight: 2.3,
  pre(ctx) {
    const n = ctx.tuning['structure.privateRoom.parts'];
    const picked: string[] = [];
    for (const group of ctx.rng.shuffle(GROUPS.map((g) => g.slice()))) {
      if (picked.length >= n) break;
      const ok = group.filter((id) => { const d = anomalyDef(id); return !!d && (!d.fits || d.fits(ctx.geo, ctx.floor)) && (!d.minHeight || ctx.cell.height >= d.minHeight); });
      if (ok.length) picked.push(ctx.rng.pick(ok));
    }
    if (picked.length < 2) return false;
    ctx.memo.parts = picked;
    for (const id of picked) {
      const d = anomalyDef(id)!;
      if (d.pre && d.pre(subContext(ctx, d, 'pre')) === false) return false;
    }
    return true;
  },
  post(ctx) {
    const picked = (ctx.memo.parts as string[] | undefined) ?? [];
    for (const id of picked) {
      const d = anomalyDef(id)!;
      if (d.needsFurniture && !ctx.furniture.length) return false;
      if (d.post && d.post(subContext(ctx, d, 'post')) === false) return false;
    }
    return true;
  },
});
