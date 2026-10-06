/**
 * 異変の廊下（warpLapHall）の描画: 見る廊下 C0 のふつうの物（異変で隠す物）と異変の物を、区画の箱と同じ見た目で作り、
 * 状態の anomaly に合わせて出し入れする。天井から下がる札に周の数（出口の周は「出口」、異変 signWrong は数字が逆さま）。
 * 点光源は足さない（描画の区画が隠れると灯の数が変わり、全部の材質のシェーダが作り直されるため）。赤い照明の異変は光る箱で見せる
 */
import { defineView } from '../views.ts';
import { cellBoxes, cellOfBoxes, type PartBox } from './common.ts';
import { placePlane, textPlane } from './sign.ts';

defineView('warpLapHall', (spec, ctx) => {
  const objects = (spec.params.objects as unknown as { boxes: PartBox[] }[] | undefined) ?? [];
  const anomalies = (spec.params.anomalies as unknown as { id: string; hide: number[]; boxes: PartBox[]; fx?: string }[] | undefined) ?? [];
  const cell = cellOfBoxes(ctx.built, objects[0]?.boxes ?? [], spec.cell);
  const visual = (bs: PartBox[]): PartBox[] => bs.filter((b) => b.mat !== 'colliderOnly');
  const og = objects.map((o) => { const g = cellBoxes(ctx.materials, ctx.built, visual(o.boxes), cell); ctx.root.add(g.group); return g; });
  const ag = anomalies.map((a) => { const g = cellBoxes(ctx.materials, ctx.built, visual(a.boxes), cell); g.group.visible = false; ctx.root.add(g.group); return g; });
  // 周の数の札
  const sp = spec.params.sign as { pos: number[]; dir: number; w: number; h: number } | undefined;
  const plate = sp ? textPlane(sp.w, sp.h, 'plate') : null;
  if (plate && sp) { placePlane(plate.mesh, sp.pos, sp.dir); ctx.root.add(plate.mesh); }
  const off = ctx.onEvent?.((e) => {
    if (e.type !== 'cue' || e.entity !== spec.id) return;
    if (e.data?.name === 'lap.exit') ctx.audio?.play('chime', { gain: 0.35 });
  });
  return {
    update(s) {
      const a = typeof s.anomaly === 'number' ? s.anomaly : -1;
      const cur = a >= 0 ? anomalies[a] : undefined;
      const hidden = new Set(cur?.hide ?? []);
      og.forEach((g, i) => { g.group.visible = !hidden.has(i); });
      ag.forEach((g, i) => { g.group.visible = i === a; });
      plate?.set([s.exit ? '出口' : String(s.count ?? 0)], cur?.fx === 'sign');
    },
    dispose() { off?.(); for (const g of [...og, ...ag]) g.dispose(); plate?.dispose(); },
  };
});
