/**
 * 見た目と音だけの部品 senseFx の描画（params.fx の種類ごと）。
 * - glowDoor: 壁の扉の形の、光る縁（蓄光の塗料）。照明 lamp が暗いほど見える（照明が点いている間は見えない）。
 *     params.flashlightOff があれば、懐中電灯を消している間だけ見える。隠しの扉が付いていない壁には描かない
 */
import * as THREE from 'three';
import type { EntitySpec } from '../../../core/world/layout.ts';
import { defineView, type EntityView, type ViewContext } from '../views.ts';
import { doorNear, glowMaterial } from './common.ts';

type FxFactory = (spec: EntitySpec, ctx: ViewContext) => EntityView | null;
const FX = new Map<string, FxFactory>();

/** senseFx の種類を登録する（fx.ts の外の描画ファイルからも足せる） */
export function defineFx(kind: string, f: FxFactory): void {
  FX.set(kind, f);
}

defineView('senseFx', (spec, ctx) => FX.get(String(spec.params.fx ?? ''))?.(spec, ctx) ?? null);

/** 壁 dir・壁の面 wall・壁に沿った at の、扉の形の縁（4 本の細い光る板）。戻り値の group を root に足す */
export function doorOutline(dir: number, wall: number, at: number, y: number, w: number, h: number, color: number): { group: THREE.Group; mat: THREE.MeshBasicMaterial; geo: THREE.BoxGeometry } {
  const group = new THREE.Group();
  const mat = glowMaterial(color, 0);
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const alongX = dir === 0 || dir === 2;
  const inward = dir === 0 || dir === 1 ? -1 : 1;
  const off = wall + inward * 0.012;
  const bar = (a0: number, a1: number, y0: number, y1: number): void => {
    const m = new THREE.Mesh(geo, mat);
    const len = a1 - a0, hh = y1 - y0;
    if (alongX) { m.scale.set(len, hh, 0.01); m.position.set((a0 + a1) / 2, (y0 + y1) / 2, off); }
    else { m.scale.set(0.01, hh, len); m.position.set(off, (y0 + y1) / 2, (a0 + a1) / 2); }
    group.add(m);
  };
  const t = 0.04;
  bar(at - w / 2 - t, at - w / 2, y, y + h);
  bar(at + w / 2, at + w / 2 + t, y, y + h);
  bar(at - w / 2 - t, at + w / 2 + t, y + h, y + h + t);
  // 取っ手の小さな印
  const k = new THREE.Mesh(geo, mat);
  const kx = at + w / 2 - 0.14;
  if (alongX) { k.scale.set(0.05, 0.05, 0.01); k.position.set(kx, y + 1.0, off); } else { k.scale.set(0.01, 0.05, 0.05); k.position.set(off, y + 1.0, kx); }
  group.add(k);
  return { group, mat, geo };
}

defineFx('glowDoor', (spec, ctx) => {
  const dir = Number(spec.params.dir), wall = Number(spec.params.wall), at = Number(spec.params.at), y = Number(spec.params.y);
  const cx = dir === 0 || dir === 2 ? at : wall, cz = dir === 0 || dir === 2 ? wall : at;
  if (!doorNear(ctx, cx, cz, 0.9)) return null;
  const o = doorOutline(dir, wall, at, y, Number(spec.params.w ?? 1), Number(spec.params.h ?? 2), typeof spec.params.color === 'number' ? spec.params.color : 0x9dffb8);
  ctx.root.add(o.group);
  const lamp = typeof spec.params.lamp === 'string' ? spec.params.lamp : null;
  const needDark = !!spec.params.flashlightOff;
  let shown = 0;
  return {
    update(_s, dt) {
      const dark = lamp ? 1 - ctx.levelOf(lamp) : 1;
      const p = ctx.sim.players[0];
      const fl = needDark && p?.flashlight ? 0 : 1;
      const target = Math.max(0, Math.min(1, dark)) ** 2 * fl;
      shown += (target - shown) * Math.min(1, dt * 3);
      o.mat.opacity = 0.85 * shown;
    },
    dispose() { o.group.removeFromParent(); o.mat.dispose(); o.geo.dispose(); },
  };
});
