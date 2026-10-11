import { Prop } from '../../props/kit.ts';
import { chair } from '../../props/lib/index.ts';
import { CH, FL, MODULE, ROOM_D, ROOMS, SMALL_W, MAT_Z1, type RoomDef } from './layout.ts';
import { PAL, propSink, type Zone } from './mats.ts';
import {
  artRow,
  blackboard,
  bookStack,
  carton,
  ceilingTv,
  cleaningCabinet,
  cubbyLocker,
  deskSet,
  fileBox,
  fluorescent,
  globe,
  lectern,
  noticeBoard,
  pendantLight,
  platform,
  poster,
  steelCabinet,
  steelRack,
  wallClock,
  wallSpeaker,
} from './props/school.ts';
import { curtain, hangingMap, mapCase } from './props/fixtures.ts';
import { corridorBays } from './building.ts';
import { levelZone, type Env } from './shell.ts';

/**
 * 写っていない部屋の作り込み（部屋の種類ごとの決まり）。
 * 教室 = 前（西）に黒板・教壇・教卓・時計・スピーカー、机と椅子（6 列 × 5 行。窓ぎわの列は海の方へ少し向きがずれる: 2 階）、
 *        後ろ（東）にロッカーと後ろの掲示板・掃除用具入れ、天井に蛍光灯（2 階は天井付け・3 階は吊り下げ）、前の隅にテレビ。
 * 教材室 = スチールの棚（段ボール・書類の箱・巻いた地図）、地球儀、長机と椅子、書庫、地図の掲示
 */

export function furnishRooms(env: Env, level: 2 | 3): void {
  for (const r of ROOMS) {
    if (r.closed || r.level !== level) continue;
    // 廊下側の壁の内側（どの教室も。参考画像の部屋も、視点から見えるのは奥の端だけ）
    if (r.kind === 'classroom' || r.kind === 'small') corridorSideWall(env, r);
    if (r.view !== undefined) continue;
    if (r.kind === 'classroom') classroomRule(env, r);
    if (r.kind === 'material') materialRoom(env, r);
  }
}

/** 教室の廊下側の壁（x = ROOM_D の内側の面）: 廊下と同じ区画で、掲示板の区画に掲示板とその上の絵や習字の列（窓の区画は窓だけ） */
function corridorSideWall(env: Env, r: RoomDef): void {
  const { b, mats, ctx } = env;
  const fl = FL[r.level - 1];
  const zone: Zone = levelZone(r.level);
  const pm = mats.props(zone);
  const sink = propSink(b, ctx);
  let seed = Math.round((r.rect2 ?? r.rect)[1] * 31) + r.level;
  const on = (z: number, y: number): Prop => Prop.at(sink, pm, [ROOM_D, fl + y, z], -Math.PI / 2, seed++);
  for (const q of corridorBays(r.level as 2 | 3)) {
    if (q.room !== r || q.kind !== 'board') continue;
    const zc = (q.z0 + q.z1) / 2;
    const w = q.z1 - q.z0 - 0.1;
    noticeBoard(on(zc, 1.35), { w, h: 0.75 });
    artRow(on(zc, 1.95), { w, n: Math.max(3, Math.round(w / 0.36)), h: 0.3, kind: seed % 3 === 0 ? 'calli' : 'draw' });
  }
}

function classroomRule(env: Env, r: RoomDef): void {
  const { b, mats, ctx } = env;
  const fl = FL[r.level - 1];
  const zone: Zone = levelZone(r.level);
  const P = PAL[zone];
  const pm = mats.props(zone);
  const sink = propSink(b, ctx);
  const [x0, z0, x1, z1] = r.rect;
  const at = (x: number, y: number, z: number, yaw = 0, seed = 1): Prop => Prop.at(sink, pm, [x, fl + y, z], yaw, seed);
  const seed0 = Math.round(z0 * 100) + r.level * 7;
  // 前（西の間仕切り z = z0）: 黒板・教壇・教卓・時計・スピーカー・掲示
  const cx = (x0 + x1) / 2 + 0.3;
  blackboard(Prop.at(sink, pm, [cx, fl + 1.45, z0], 0, seed0), { w: 3.6, h: 1.2, board: zone === 'deep' ? '#1f4f4c' : '#174a44', writing: 0.5 });
  platform(at(cx, 0, z0 + 0.5, 0, seed0 + 1), { w: 4.6, d: 0.95, h: 0.18 });
  lectern(at(cx, 0.18, z0 + 1.35, 0, seed0 + 2));
  wallClock(Prop.at(sink, pm, [cx, fl + 2.45, z0], 0, seed0 + 3));
  wallSpeaker(Prop.at(sink, pm, [x1 - 0.6, fl + 2.55, z0], 0, seed0 + 4));
  noticeBoard(Prop.at(sink, pm, [x0 + 0.95, fl + 1.6, z0], 0, seed0 + 5), { w: 1.2, h: 0.9 });
  ceilingTv(at(x1 - 0.8, CH - 0.27 - 0.35, z0 + 0.7, -0.5, seed0 + 6), { drop: 0.35 });
  // 机（6 列 × 5 行）。2 階の窓ぎわの列は海の方へ向きがずれる（小さな教室と同じ）
  const dk = { top: P.desk.color, edge: P.deskEdge, frame: P.deskFrame, chairFrame: P.chairFrame, seat: P.seat };
  const cols = [0.75, 1.9, 3.05, 4.2, 5.35, 6.5];
  for (let ci = 0; ci < cols.length; ci++) {
    for (let ri = 0; ri < 5; ri++) {
      const z = z0 + 2.6 + ri * 1.15;
      if (z > z1 - 1.9) continue;
      const s = seed0 + 20 + ci * 7 + ri;
      const jit = ((s * 37) % 11) / 11 - 0.5;
      const yaw = r.level === 2 && ci === 0 ? 0.5 + jit * 0.2 : jit * 0.1;
      deskSet(at(cols[ci] + jit * 0.05, 0, z + jit * 0.06, yaw, s), { ...dk, clutter: 0.35, pull: 0.15 + Math.abs(jit) * 0.3 });
    }
  }
  // 後ろ（東の間仕切り z = z1）: ロッカー・後ろの掲示板・掃除用具入れ
  cubbyLocker(at(x0 + 3.0, 0, z1 - 0.25, Math.PI, seed0 + 60), { cols: 8, cw: 0.6, body: zone === 'deep' ? '#5f8fa2' : '#3f8a96' });
  noticeBoard(Prop.at(sink, pm, [x0 + 3.0, fl + 1.75, z1], Math.PI, seed0 + 61), { w: 3.6, h: 0.9 });
  cleaningCabinet(at(x1 - 0.55, 0, z1 - 0.3, Math.PI, seed0 + 62), { body: zone === 'deep' ? '#5f8fa2' : '#3f8a96' });
  poster(Prop.at(sink, pm, [x1 - 1.4, fl + 1.6, z1], Math.PI, seed0 + 63));
  // 天井の蛍光灯（窓と平行の 3 列）。参考画像の部屋のほかは廊下側の 2 列が点いている（光だまり）
  let k = 0;
  for (let z = z0 + 1.2; z < z1 - 0.6; z += MODULE) {
    for (const x of [3.6, 5.4]) {
      if (k++ % 2) continue;
      ctx.addLamp({ pos: [x, fl + 0.7, z], radius: 1.9, intensity: 0.7, box: [x0, fl - 0.1, z0, x1, fl + CH, z1], down: true, square: true, hard: true, color: '#c8eef4', shadow: 0 });
    }
    for (const x of [1.8, 3.6, 5.4]) {
      if (r.level === 3) pendantLight(at(x, CH, z, Math.PI / 2, seed0 + 70), { len: 1.25, drop: 0.5 });
      else fluorescent(at(x, CH, z, Math.PI / 2, seed0 + 70), { len: 1.25, body: '#2c4c66', tube: '#9cc4d4' });
    }
  }
  void ROOM_D;
}

function materialRoom(env: Env, r: RoomDef): void {
  const { b, mats, ctx } = env;
  const fl = FL[r.level - 1];
  const zone: Zone = levelZone(r.level);
  const pm = mats.props(zone);
  const sink = propSink(b, ctx);
  const [x0, z0, x1, z1] = r.rect;
  const at = (x: number, z: number, yaw = 0, seed = 1): Prop => Prop.at(sink, pm, [x, fl, z], yaw, seed);
  // 北の壁（廊下との壁 x = x1）に沿うスチールの棚（段ボール・書類の箱）
  // 棚の中身は隙間なく（段ボール・書類の箱・丸めた模造紙の束・教材の箱）。段ごとに種類を変える
  const fill = (s: Prop, w: number, d: number, clear: number, i: number): void => {
    let x = -w / 2 + 0.05;
    if (i === 3) {
      // 丸めた模造紙と掛け図の束（横に寝かせる）
      for (let k = 0; k < 7; k++) s.cyl(['#cfe6e6', '#d9eef0', '#9fc3c8'][k % 3], [(s.r() - 0.5) * 0.06, 0.035 + (k % 3) * 0.06 + Math.floor(k / 3) * 0.0, -d / 2 + 0.05 + k * (d - 0.1) / 7], 0.03, w - 0.1, { axis: 'x' });
      return;
    }
    while (x < w / 2 - 0.15) {
      const k = s.r();
      if (i % 2 === 0 && k < 0.75) {
        const cw = 0.32 + s.r() * 0.15;
        if (x + cw > w / 2) break;
        carton(s.sub([x + cw / 2, 0, (s.r() - 0.5) * 0.04], (s.r() - 0.5) * 0.08), { w: cw, h: Math.min(clear - 0.02, 0.24 + s.r() * 0.12), d: Math.min(d, 0.32), col: ['#8fa8a4', '#7f9c9c', '#9fb4ac'][Math.floor(s.r() * 3)] });
        x += cw + 0.02;
      } else {
        const n = 3 + Math.floor(s.r() * 6);
        for (let j = 0; j < n && x < w / 2 - 0.12; j++) {
          fileBox(s.sub([x + 0.05, 0, 0], 0), { col: ['#cfe6e6', '#6f9ab0', '#4f7f96', '#b8d8d8'][Math.floor(s.r() * 4)], h: Math.min(clear - 0.02, 0.3) });
          x += 0.105;
        }
        x += 0.05;
      }
    }
  };
  // 廊下への扉（z = 2.0）の前は空ける
  for (const [k, z] of [[0, z0 + 0.75], [1, z0 + 3.25], [2, z0 + 4.55]] as [number, number][]) steelRack(at(x1 - 0.25, z, -Math.PI / 2, 300 + k), { w: 1.2, d: 0.45, h: 1.8, levels: 5, fill });
  // 決まり（物置きの部屋の壁ぎわ）: 間仕切りの側に書庫と棚、東の壁に棚、西の窓の下に地図の引き出しの箱、壁の空いた所に掲示・地図
  steelCabinet(at(x0 + 0.21, z0 + 0.75, Math.PI / 2, 320), { w: 0.88, d: 0.4, h: 1.8, body: '#6f9aaa', glass: true });
  steelRack(at(x0 + 0.24, z0 + 1.78, Math.PI / 2, 321), { w: 0.95, d: 0.4, h: 1.8, levels: 5, fill });
  steelRack(at(x0 + 1.05, z1 - 0.25, Math.PI, 322), { w: 1.2, d: 0.45, h: 1.8, levels: 5, fill });
  mapCase(at(x0 + 1.6, z0 + 0.32, 0, 330));
  hangingMap(Prop.at(sink, pm, [x0, fl + 2.35, z0 + 4.95], Math.PI / 2, 323), { w: 1.0, h: 1.2 });
  // 西の窓のカーテン（左右に寄せた布）と、書庫の上の段ボール
  curtain(Prop.at(sink, pm, [x0 + 1.6, fl + 2.35, z0], 0, 326), { w: 1.6, h: 1.5, col: '#5f8fa2', open: 0.28 });
  carton(Prop.at(sink, pm, [x0 + 0.25, fl + 1.805, z0 + 1.7], Math.PI / 2 + 0.1, 327), { w: 0.45, h: 0.3, d: 0.35 });
  carton(Prop.at(sink, pm, [x0 + 0.24, fl + 2.105, z0 + 1.75], Math.PI / 2 - 0.15, 328), { w: 0.4, h: 0.22, d: 0.3, col: '#9fb4ac' });
  poster(Prop.at(sink, pm, [x0, fl + 1.6, z0 + 2.6], Math.PI / 2, 324), { w: 0.42, h: 0.6 });
  artRow(Prop.at(sink, pm, [x0 + 1.5, fl + 2.5, z1], Math.PI, 325), { w: 2.2, n: 5 });
  // 西の窓の前の床の明るさ（窓の形の光だまり: 竪框で 2 つ。床と机と棚の前の面）
  for (const [a, c] of [[x0 + 0.8, x0 + 1.56], [x0 + 1.64, x0 + 2.4]] as [number, number][]) {
    ctx.addLamp({ pos: [(a + c) / 2, fl + 1.6, z0 + 0.3], radius: 4.0, intensity: 0.8, box: [a, fl - 0.1, z0 + 0.2, c, fl + 1.4, z0 + 2.6], square: true, hard: true, color: '#d8f8ff', shadow: 0 });
  }
  // 壁の空いた所: 東の壁に掲示板（貼り紙）、西の窓の両脇に貼り紙
  noticeBoard(Prop.at(sink, pm, [x0 + 2.4, fl + 1.5, z1], Math.PI, 350), { w: 1.1, h: 0.8 });
  for (const [x, k] of [[x0 + 0.4, 352], [x1 - 0.35, 353]] as [number, number][]) poster(Prop.at(sink, pm, [x, fl + 1.55, z0], 0, k), { w: 0.3, h: 0.42 });
  // 棚の上の段ボール（棚の上の空いた所にも物を置く）
  for (const [k, z] of [[0, z0 + 0.75], [1, z0 + 3.25], [2, z0 + 4.55]] as [number, number][]) {
    carton(at(x1 - 0.27, z - 0.25, -Math.PI / 2 + 0.1, 340 + k).sub([0, 1.825, 0]), { w: 0.45, h: 0.3, d: 0.35 });
    carton(at(x1 - 0.27, z + 0.28, -Math.PI / 2 - 0.08, 345 + k).sub([0, 1.825, 0]), { w: 0.4, h: 0.24, d: 0.32, col: '#9fb4ac' });
  }
  // 巻いた地図（棚の横に立て掛け・筒）と地球儀・長机・椅子・書庫
  for (let k = 0; k < 5; k++) b.cyl(mats.get(zone, ['#cfe6e6', '#9fc8cc', '#e0ecec'][k % 3], { key: 'map' }), [x1 - 0.12, fl + 0.65, z0 + 6.0 + k * 0.09], 0.035, 1.3, { shadow: true });
  const table = mats.get(zone, '#7fa6b4', { key: 'table' });
  const tx = x0 + 1.65;
  b.boxMM(table, [tx - 0.45, fl + 0.68, z0 + 1.6], [tx + 0.45, fl + 0.72, z0 + 3.4], { shadow: true, collide: true });
  for (const [dx, dz] of [[-0.4, 1.65], [0.4, 1.65], [-0.4, 3.35], [0.4, 3.35]]) b.boxMM(table, [tx + dx - 0.02, fl, z0 + dz - 0.02], [tx + dx + 0.02, fl + 0.68, z0 + dz + 0.02], { shadow: true });
  globe(at(tx, z0 + 2.2, 0.3, 310).sub([0, 0.72, 0]));
  bookStack(at(tx + 0.2, z0 + 2.9, 0.2, 311).sub([0, 0.72, 0]), 4);
  chair(at(tx + 0.75, z0 + 2.5, -Math.PI / 2, 312), { kind: 'stack', seat: '#5f8fa2', frame: '#2c4c66' });
  steelCabinet(at(x0 + 0.21, z0 + 5.6, Math.PI / 2, 313), { w: 0.88, d: 0.4, h: 1.8, body: '#6f9aaa', glass: true });
  poster(Prop.at(sink, pm, [(x0 + x1) / 2, fl + 1.7, z1], Math.PI, 314), { w: 1.0, h: 0.7, paper: '#b9d8d8' });
  // 天井の蛍光灯 2 つ（部屋の長さの 1/4 と 3/4）と、その下の四角い光だまり
  for (const zz of [z0 + (z1 - z0) * 0.3, z0 + (z1 - z0) * 0.72]) {
    fluorescent(at((x0 + x1) / 2, zz, 0, 315).sub([0, CH, 0]), { len: 1.25, body: '#2c4c66', tube: '#9cc4d4' });
    ctx.addLamp({ pos: [(x0 + x1) / 2, fl + 0.9, zz], radius: 2.6, intensity: 0.8, box: [x0 + 0.05, fl - 0.1, zz - 1.0, x1 - 0.05, fl + 1.0, zz + 1.0], down: true, square: true, hard: true, color: '#c8eef4', shadow: 0 });
  }
  void SMALL_W;
  void MAT_Z1;
}
