/**
 * 遠ざかる廊下の偽の突き当たり（warpRecede）: 本物の突き当たりの箱（奥の壁・非常口の灯り）と扉の見た目を、ずれ off だけ手前に置く。
 * 扉は扉の部品の描画（views.ts の 'door'）をそのまま使う（同じ見た目）。偽の突き当たりが消えたら隠す
 */
import * as THREE from 'three';
import { rotQ, type Dir } from '../../../core/math/vec.ts';
import type { EntitySpec } from '../../../core/world/layout.ts';
import { createView, defineView } from '../views.ts';
import { cellBoxes, cellOfBoxes, type PartBox } from './common.ts';

defineView('warpRecede', (spec, ctx) => {
  const group = new THREE.Group();
  ctx.root.add(group);
  const boxes = (spec.params.boxes as unknown as PartBox[] | undefined) ?? [];
  const cell = cellOfBoxes(ctx.built, boxes, spec.cell);
  const walls = cellBoxes(ctx.materials, ctx.built, boxes, cell);
  group.add(walls.group);
  const doorId = typeof spec.params.door === 'string' ? spec.params.door : null;
  const real = doorId ? ctx.built.floor.entities.find((e) => e.id === doorId) : undefined;
  const door = real ? createView({ ...real, id: `${spec.id}.door` } as EntitySpec, { ...ctx, root: group }) : null;
  door?.update({ angle: 0 }, 0);
  const f = rotQ([0, 0, 1], ((typeof spec.params.fwd === 'number' ? spec.params.fwd : 0) & 3) as Dir);
  return {
    update(s) {
      const off = typeof s.off === 'number' ? s.off : 0;
      group.position.set(f[0] * off, 0, f[2] * off);
      group.visible = !s.gone;
    },
    dispose() { door?.dispose(); walls.dispose(); group.removeFromParent(); },
  };
});
