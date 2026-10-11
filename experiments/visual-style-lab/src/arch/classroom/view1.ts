import * as THREE from 'three';
import { Prop } from '../../props/kit.ts';
import type { V3 } from '../../scenes/Builder.ts';
import { CH, FL, MODULE, PART3, ROOM_D } from './layout.ts';
import { PAL, propSink } from './mats.ts';
import { blackboard, cubbyLocker, deskSet, lectern, noticeBoard, pendantLight, platform, poster, wallClock, wallSpeaker, cleaningCabinet } from './props/school.ts';
import { W1_TRANSOM, W1_WIN, type Env, type LevelMats } from './shell.ts';

/**
 * 3 階の教室 3-A（classroom-1 の部屋）の作り込み。
 * - 前（西）の壁: 窓ぎわに下の窓と欄間の帯（海と水平線が見える）、真ん中に掲示、右に黒板。前に教壇と教卓
 * - 天井: 壁柱ごとの梁（窓から廊下へ渡る）、梁の間に吊り下げの蛍光灯 3 列、配管
 * - 机: 6 列 × 6 行（窓ぎわの列は窓の壁に付ける）。後ろ（東）にロッカーと掃除用具入れ
 */

export function buildView1(env: Env, lm: LevelMats): void {
  const { b, mats } = env;
  const fl = FL[2];
  const zone = 'shallow' as const;
  const P = PAL.shallow;
  const pm = mats.props(zone);
  const sink = propSink(b, env.ctx);
  const at = (x: number, y: number, z: number, yaw = 0, seed = 1): Prop => Prop.at(sink, pm, [x, fl + y, z], yaw, seed);
  const fr = lm.frame;
  const box = (m: THREE.Material, a: V3, c: V3, collide = false): void => {
    b.boxMM(m, [a[0], fl + a[1], a[2]], [c[0], fl + c[1], c[2]], { collide, shadow: true });
  };
  const zf: [number, number] = [-0.16, -0.06];
  const RL = PART3[0] - 0.06;

  // ---- 前（西）の壁の窓: 下の窓（2 枚）と欄間の帯（4 枚）
  {
    const [x0, x1] = W1_WIN;
    box(fr, [x0, 1.12, zf[0]], [x1, 1.17, zf[1]]);
    box(fr, [x0, 2.04, zf[0]], [x1, 2.09, zf[1]]);
    for (const x of [x0, (x0 + x1) / 2 - 0.025, x1 - 0.05]) box(fr, [x, 1.12, zf[0]], [x + 0.05, 2.09, zf[1]]);
    b.plane(lm.glass, [(x0 + x1) / 2, fl + 1.6, -0.11], x1 - x0, 0.92, 'z', { shadow: false, layer: 1 });
    box(lm.sill, [x0, 1.08, -0.14], [x1, 1.12, 0.08]);
    const [t0, t1] = W1_TRANSOM;
    box(fr, [t0, 2.26, zf[0]], [t1, 2.3, zf[1]]);
    box(fr, [t0, 2.73, zf[0]], [t1, 2.77, zf[1]]);
    for (let k = 0; k <= 4; k++) {
      const x = t0 + ((t1 - t0 - 0.04) * k) / 4;
      box(fr, [x, 2.26, zf[0]], [x + 0.04, 2.77, zf[1]]);
    }
    b.plane(lm.glass, [(t0 + t1) / 2, fl + 2.515, -0.11], t1 - t0, 0.47, 'z', { shadow: false, layer: 1 });
  }
  // 掲示・黒板・時計・スピーカー
  const front = (x: number, y: number, seed: number): Prop => Prop.at(sink, pm, [x, fl + y, 0], 0, seed);
  noticeBoard(front(2.73, 1.72, 11), { w: 0.95, h: 0.72, papers: 4 });
  blackboard(front(5.45, 1.55, 12), { w: 3.2, h: 1.2, board: '#174a44', writing: 0.4 });
  wallClock(front(5.45, 2.55, 13));
  wallSpeaker(front(6.75, 2.6, 14));
  poster(front(3.55, 1.9, 15), { w: 0.3, h: 0.42 });
  platform(at(4.6, 0, 0.5, 0, 16), { w: 5.2, d: 0.95, h: 0.18 });
  lectern(at(4.4, 0.18, 1.35, 0, 17));
  // ---- 天井の梁（壁柱の位置で、窓から廊下へ）と吊り下げの蛍光灯
  const beam = mats.get(zone, P.ceil.color, { shade: P.ceil.shade, dark: P.ceil.dark, key: 'beam' });
  const f = { pier0: 9.035, };
  void f;
  for (let z = 2.14; z < RL; z += MODULE) box(beam, [0, CH - 0.42, z - 0.18], [ROOM_D, CH, z + 0.18]);
  box(beam, [0, CH - 0.42, 0], [ROOM_D, CH, 0.25]);
  // 廊下側の壁に沿う梁
  box(beam, [ROOM_D - 0.3, CH - 0.42, 0], [ROOM_D, CH, RL]);
  for (let z = 2.14 + MODULE / 2; z < RL - 0.5; z += MODULE) {
    for (const x of [1.8, 3.6, 5.4]) pendantLight(at(x, CH, z, Math.PI / 2, 20), { len: 1.25, drop: 0.5 });
  }
  // 配管（窓の上の梁に沿う細い管）
  for (const [x, y, r] of [[0.35, CH - 0.12, 0.03], [0.5, CH - 0.12, 0.02]] as [number, number, number][]) b.cyl(lm.base, [x, fl + y, RL / 2], r, RL, { axis: 'z', shadow: true });
  // ---- 机（6 列 × 6 行。窓ぎわの列は壁に付く）。参考画像の窓ぎわの机 x 0.05〜0.9・2 列目 x 1.6〜2.5
  const dk = { top: P.desk.color, edge: P.deskEdge, frame: P.deskFrame, chairFrame: P.chairFrame, seat: P.seat };
  const cols = [0.42, 2.05, 3.25, 4.45, 5.65];
  const rows = [3.05, 4.25, 5.45, 6.65, 7.85, 9.05];
  cols.forEach((x, ci) =>
    rows.forEach((z, ri) => {
      const s = 400 + ci * 10 + ri;
      const jit = ((s * 37) % 11) / 11 - 0.5;
      deskSet(at(x + jit * 0.06, 0, z + jit * 0.08, jit * 0.08, s), { ...dk, clutter: ci === 0 ? 0.8 : 0.35, pull: 0.22 + Math.abs(jit) * 0.2 });
    }),
  );
  // ---- 後ろ（東）: ロッカー・掃除用具入れ・後ろの掲示
  cubbyLocker(at(3.1, 0, RL - 0.25, Math.PI, 30), { cols: 9, cw: 0.6 });
  cleaningCabinet(at(6.4, 0, RL - 0.3, Math.PI, 31));
  noticeBoard(Prop.at(sink, pm, [3.1, fl + 1.75, RL], Math.PI, 32), { w: 3.6, h: 0.9 });
  void lm;
}
