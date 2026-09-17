/**
 * FogDepth — 部屋ごとの霧（U13, R03, R05, R06, L01, L19, M14）。
 * params: color('#rrggbb' | number), near(m), far(m)。
 * layout フックで RoomLayout.render.fog と fogFar を設定するだけ。
 *   - RoomBuilder が render.fog を MaterialLibrary.variant の roomFog（案 B: 材質側の部屋別霧）に渡し、BuiltRoom.fog にも保持する。
 *   - Game.enterRoom（統合担当）は BuiltRoom.fog（無ければ palette.fog + 既定 12 / tier.fogFar）へ scene.fog と background を 0.8 s で補間する（案 A）。
 *   - far は Tier の fogFar でクランプするのは Game 側（ここでは設計値のまま持つ）。
 */
import type { ModifierImpl } from '../types';
import { num, parseColor } from '../util';

const FogDepth: ModifierImpl = {
  id: 'FogDepth',
  defaults: { color: '#262a28', near: 12, far: 60 },
  layout(L, _p, params) {
    const color = parseColor(params.color, 0x262a28);
    const near = Math.max(1.5, num(params.near, 12));
    const far = Math.max(near + 2, num(params.far, 60));
    L.render = { ...(L.render ?? {}), fog: { color, near, far } };
    L.fogFar = far;
  },
};

export default FogDepth;
