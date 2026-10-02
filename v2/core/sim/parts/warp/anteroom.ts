/**
 * warpAnteroom: 控え室（空間のゆがみの別の空間への入口）。
 *
 * 仕掛けの部屋 R（フロアの部屋）に、もう 1 枚の扉 pod を付ける。pod は「ほかの扉（部屋の扉 全部）が閉じているときだけ」開く。
 * 開けた瞬間に、プレイヤーを R の双子の部屋 R'（フロアの上空。中身も扉も同じ）へ継ぎ目なく移し、R' の pod を開ける。
 * R' の pod の向こうが別の空間（くり返す廊下・異変の廊下・終わらない階段 …）。別の空間の終わりには、もう 1 つの双子の部屋 Q' がある。
 * R'・Q' の部屋の扉（双子）を開けると、R へ継ぎ目なく戻して R の同じ扉を開ける（来た扉からはいつでも出られる）。
 *
 * 足した扉（pod・双子の部屋の扉）の開け閉めはこの部品がまとめて行う（扉の入力 open に配線する。E / タップで開閉・誰も近くにいなければ
 * 自動で閉まる。扉の部品と同じ）。R の扉はふつうの扉のまま（入力 lock を出力 free（いつも 0）に配線して、この部品の後に動くようにする。
 * 双子の部屋から戻すときは、プレイヤーがその扉を調べたことにして、同じ tick に本物の扉を開ける）。
 *
 * params:
 *   room   … R の内側の範囲（pod を開けるとき、R の中にいること）
 *   doors  … { real: [R の扉の id …（入口が先）], pod }
 *   copies … [{ doors: [双子の扉の id …（real と同じ並び）], pod, xform }]（R からの写し方）。copies[0] が入口の R'
 *   managed … この部品が開け閉めする扉の id（d<i> の並び）
 *   auto   … { 扉の id: 自動で閉まる秒 }（0 は閉まらない）
 * outputs: d0, d1, …・ready（R の扉が全部閉じている）・entered（pod から入った回数）・free（いつも 0）
 */
import { aabbCenter } from '../../../math/aabb.ts';
import { distXZ, type Vec3 } from '../../../math/vec.ts';
import { definePart, pNum } from '../../part.ts';
import { inBox, readAabb, readXform, xInverse, xPoint, xYaw, type Xform } from './util.ts';

interface Copy { doors: string[]; pod: string; xform: Xform }

const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

definePart<{ target: Record<string, number>; idle: Record<string, number>; centers: Record<string, number[]>; entered: number }>({
  type: 'warpAnteroom',
  init(ctx) {
    const managed = ids(ctx.spec.params.managed);
    const real = ids((ctx.spec.params.doors as { real?: unknown } | undefined)?.real);
    const centers: Record<string, number[]> = {};
    for (const id of [...managed, ...real]) {
      const e = ctx.floor.entities.find((x) => x.id === id);
      const pn = e?.params.panel;
      if (pn) centers[id] = aabbCenter(readAabb(pn));
    }
    const target: Record<string, number> = {};
    for (const id of managed) target[id] = 0;
    return { target, idle: {}, centers, entered: 0 };
  },
  step(s, ctx) {
    const P = ctx.spec.params;
    const managed = ids(P.managed);
    const d = (P.doors ?? {}) as { real?: unknown; pod?: unknown };
    const real = ids(d.real);
    const POD = typeof d.pod === 'string' ? d.pod : null;
    const copies: Copy[] = ((P.copies as unknown[] | undefined) ?? []).map((c) => {
      const o = c as { doors?: unknown; pod?: unknown; xform?: unknown };
      return { doors: ids(o.doors), pod: String(o.pod), xform: readXform(o.xform as never) };
    });
    const room = readAabb(P.room);
    const auto = (P.auto ?? {}) as Record<string, number>;
    const angle = (id: string): number => Number(ctx.stateOf(id)?.angle ?? 0);
    // 閉じている: 板が閉じきっていて、開ける途中でもない（R の扉はふつうの扉の状態 target、足した扉はこの部品の target）
    const closed = (id: string): boolean => angle(id) < 0.02 && !(managed.includes(id) ? s.target[id] : Number(ctx.stateOf(id)?.target ?? 0));
    const allClosed = real.every(closed);
    for (const p of ctx.players) {
      const hit = p.interactedId;
      if (!hit || !managed.includes(hit)) continue;
      if (hit === POD) {
        // もう 1 枚の扉: ほかの扉が閉じていれば、双子の部屋へ移して向こうの扉を開ける
        const c0 = copies[0];
        if (c0 && allClosed && inBox([p.pos[0], p.pos[1] + 0.1, p.pos[2]], room, 0.2)) {
          ctx.warp(p, xPoint(c0.xform, p.pos), xYaw(c0.xform, p.yaw));
          s.target[c0.pod] = 1;
          s.idle[c0.pod] = 0;
          s.entered++;
        } else ctx.cue('door.locked', (s.centers[hit] ?? p.pos) as Vec3, { mat: 'doorMetal' });
        continue;
      }
      // 双子の部屋の扉: フロアの部屋へ戻して、本物の扉を調べたことにする（本物の扉はこの部品の後に動くので、同じ tick に開く）
      const copy = copies.find((c) => c.doors.includes(hit));
      if (copy) {
        const r = real[copy.doors.indexOf(hit)];
        if (r) {
          const back = xInverse(copy.xform);
          ctx.warp(p, xPoint(back, p.pos), xYaw(back, p.yaw));
          p.interactedId = r;
        }
        continue;
      }
      s.target[hit] = s.target[hit] ? 0 : 1;
      s.idle[hit] = 0;
    }
    // 自動で閉まる（誰も 1.6 m 以内にいない時間）。開いている扉の中に人がいる間は閉めない（扉の部品が開け直す）
    for (const id of managed) {
      if (!s.target[id]) continue;
      const sec = auto[id] ?? 4;
      if (sec <= 0) continue;
      const c = s.centers[id];
      const near = !!c && ctx.players.some((p) => distXZ(p.pos, c as Vec3) < pNum(ctx.spec, 'near', 1.6) && Math.abs(p.pos[1] - c[1]!) < 2.5);
      s.idle[id] = near ? 0 : (s.idle[id] ?? 0) + ctx.dt;
      if ((s.idle[id] ?? 0) >= sec) { s.target[id] = 0; s.idle[id] = 0; }
    }
    managed.forEach((id, i) => ctx.output(`d${i}`, s.target[id] ? 1 : 0));
    ctx.output('ready', allClosed ? 1 : 0);
    ctx.output('entered', s.entered);
    ctx.output('free', 0);
  },
});

/** 表示用の小さな灯り（控え室のもう 1 枚の扉の上: 入れるとき緑・入れないとき赤）。入力 on をそのまま状態にする */
definePart<{ on: number }>({
  type: 'warpIndicator',
  inputs: ['on'],
  outputs: ['on'],
  init: (ctx) => ({ on: ctx.wired('on') ? 0 : 1 }),
  step(s, ctx) {
    s.on = !ctx.wired('on') || ctx.input('on') > 0.5 ? 1 : 0;
    ctx.output('on', s.on);
  },
});
