/**
 * DynamicLength — 遠ざかる廊下（E13。rate 0.5 / min 8 / max 60）。
 * params: rate(伸長率), min(最初に見える長さ m), max(設計上の最大長 m。配置側の上限で、ここでは参照のみ), thickness(偽端の厚さ m)
 *
 * 方針（implementation-analysis「DynamicLength」/ v1.3 D25）: 配置は Generator の出力（最大長）で確定し、外殻・ソケット・footprint は不動。
 * 室内に「偽の突き当たり」（壁材の全断面パネル + 偽扉 + 幕板 + 幅木。非インタラクト）を置き、プレイヤーの進行位置 d（入口セグメントの
 * ローカル z）の関数で見える長さを伸縮させる:  e(d) = clamp(min + (1 + rate)·d, min, maxE)。残距離 e − d = min + rate·d なので
 * 歩くほど端が遠ざかり、戻ると対称に縮む（ヒステリシス無し。速度に応じ = 位置の関数として等価）。e が実際の突き当たり（maxE）に
 * 達すると偽端は非表示・非当たりになり、本物の奥の扉が現れる（rate 0.5 / min 8 なら (maxE − 8) / 1.5 m 歩いた時点。maxE は奥の扉の前 1.6 m）。
 * 残距離は常に ≥ min なので押し潰しは起きない。
 *
 *   layout フック（決定論）: 入口セグメント（CorridorGenerator の最初の矩形。原点から +Z）に位相 0 = z=min の DynamicSpec を 4 枚出す
 *     （'DynamicLength:end' ソリッド壁 / ':door' 偽扉 / ':trim' 幕板 / ':skirt' 幅木。motion は slide +Z、amplitude = maxE − min、
 *     period 1e9 = RoomBuilder 任せなら実質静止）。折れ廊下では最初のセグメントの角の手前までが可動域。E13 では床穴を出さない
 *     （hole ソケットがあれば取り除いてシェルの床を穴無しで組み直す）。
 *   build フック: MovingWalls.drive.takeOverDynamics で 4 枚の駆動を引き取り、毎フレーム e(d) の位置へ置く（時間ではなく位置の純関数。保存状態なし）。
 * 制約: CorridorGenerator は E13 でも L / Z / U 形を選ぶことがある（直線 + 60/48/36/24 m 長は CorridorGenerator 側の依頼。phase2-requests.md）。
 */
import { toLocal } from '../../core/types';
import { buildShell } from '../../generators/footprint';
import { box, WALL_T, type Box, type DynamicSpec } from '../../generators/layout';
import type { RoomEffect } from '../../render/RoomBuilder';
import type { ModifierImpl } from '../types';
import { num } from '../util';
import { setOffset, setVisible, takeOverDynamics } from './MovingWalls.drive';

const ID = 'DynamicLength';
/** 偽端が本物の突き当たりに達したとみなす余白（m） */
const HIDE_EPS = 0.1;
/** 偽端の可動域がこれより短ければ出さない（m） */
const MIN_TRAVEL = 2.0;
/** 奥の扉の前に残す空き（m）。偽端はここまでしか進まず、達した時点で消える */
const END_CLEAR = 1.6;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** 進行距離 d に対する偽端の位置 e（ローカル z） */
export function fakeEndAt(d: number, rate: number, zMin: number, zMax: number): number {
  return clamp(zMin + (1 + rate) * d, zMin, zMax);
}

const DynamicLength: ModifierImpl = {
  id: ID,
  defaults: { rate: 0.5, min: 8, max: 60, thickness: 0.3 },
  layout(L, _p, params) {
    const rects = L.footprint;
    if (rects.length === 0) return;
    const r0 = rects[0];
    const w = r0.x1 - r0.x0;
    const len0 = r0.z1 - r0.z0;
    // 廊下（原点から +Z の入口セグメント）でなければ何もしない
    if (w > 6 || len0 < w || Math.abs(r0.z0) > 0.01) return;
    const h = L.height;
    const zMin = Math.max(3, num(params.min, 8));
    const thick = clamp(num(params.thickness, 0.3), 0.1, 0.6);

    // 床穴を出さない（偽端の向こうに落ちる導線を避ける）: hole ソケットを外し、シェルを穴無しで組み直す
    if (L.sockets.some((s) => s.type === 'hole' && s.id !== 'entry') || L.holes.length > 0) {
      L.sockets = L.sockets.filter((s) => s.type !== 'hole' || s.id === 'entry');
      L.holes = [];
      const shell: Box[] = [];
      buildShell(shell, rects, h, L.sockets, { floor: L.palette.floor, wall: L.palette.wall, ceiling: L.palette.ceiling, floorHoles: [] });
      L.boxes.splice(0, L.shellCount ?? 0, ...shell);
      L.shellCount = shell.length;
    }

    // 可動域: 直線なら奥の扉の前 1.6 m（扉前の空きを保つ。ここに達したら非表示で本物の端が現れる）、折れ廊下なら角（幅 w の正方形）の手前まで
    const zEndInner = rects.length === 1 ? r0.z1 - WALL_T - END_CLEAR : r0.z1 - w - 0.3;
    const zMax = zEndInner - thick;
    if (zMax - zMin < MIN_TRAVEL) return;

    const x0 = r0.x0 + WALL_T;
    const x1 = r0.x1 - WALL_T;
    const cx = (x0 + x1) / 2;
    const motion: DynamicSpec['motion'] = { kind: 'slide', axis: [0, 0, 1], amplitude: zMax - zMin, period: 1e9, phase: 0 };
    const specs: DynamicSpec[] = [
      { id: `${ID}:end`, box: box([x0, 0, zMin], [x1, h - 0.02, zMin + thick], L.palette.wall, true), motion, solid: true },
      { id: `${ID}:door`, box: box([cx - 0.45, 0, zMin - 0.03], [cx + 0.45, 2.05, zMin], L.palette.door, false), motion, solid: false },
      { id: `${ID}:trim`, box: box([cx - 0.55, 2.05, zMin - 0.06], [cx + 0.55, 2.15, zMin], 'trim', false), motion, solid: false },
      { id: `${ID}:skirt`, box: box([x0, 0, zMin - 0.02], [x1, 0.1, zMin], 'trim', false), motion, solid: false },
    ];
    L.dynamics = [...(L.dynamics ?? []), ...specs];
  },
  build(built, _L, ctx) {
    const placement = ctx.node.placement;
    if (!placement) return;
    const blocks = takeOverDynamics(built, placement, (id) => id.startsWith(`${ID}:`), ID);
    const end = blocks.find((b) => b.id === `${ID}:end`);
    if (!end) return;
    const rate = clamp(num(ctx.params.rate, 0.5), 0, 4);
    const zMin = end.spec.box.min[2];
    const travel = end.spec.motion.amplitude;
    const zMax = zMin + travel;
    const state = { d: 0, e: zMin, visible: true };
    // デバッグ・検証用（game.streaming.built.get(id).group.userData.dynamicLength）
    built.group.userData.dynamicLength = state;
    const apply = (d: number) => {
      const e = fakeEndAt(d, rate, zMin, zMax);
      const visible = e < zMax - HIDE_EPS;
      state.d = d;
      state.e = e;
      state.visible = visible;
      for (const b of blocks) {
        setOffset(b, e - zMin, placement);
        setVisible(b, visible);
      }
    };
    apply(0);
    const effect: RoomEffect = {
      update(_dt, rc) {
        const lp = toLocal(placement, rc.player.pos);
        // 入口セグメントの進行距離（入口より手前は 0、奥の壁より先は最大）
        apply(clamp(lp[2], 0, zMax + 1));
      },
      dispose() { /* クローン Mesh は RoomBuilder.dispose の traverse で解放（geometry / material は RoomBuilder 側と共有） */ },
    };
    built.effects.push(effect);
  },
};

export default DynamicLength;
