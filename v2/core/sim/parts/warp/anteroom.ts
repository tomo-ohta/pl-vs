/**
 * warpAnteroom: 控え室（空間のゆがみの別の空間への入口）。
 *
 * 仕掛けの部屋 R（フロアの部屋）に、もう 1 枚（か何枚か）の扉 pod を付ける。pod は「ほかの扉（部屋の扉 全部）が閉じているときだけ」開く。
 * 開けた瞬間に、プレイヤーを R の双子の部屋 R'（フロアの上空。中身も扉も同じ）へ継ぎ目なく移し、R' の pod を開ける。
 * R' の pod の向こうが別の空間（くり返す廊下・異変の廊下・終わらない階段 …）。別の空間の終わりには、もう 1 つの双子の部屋 Q' がある。
 * R'・Q' の部屋の扉（双子）を開けると、R へ継ぎ目なく戻して R の同じ扉を開ける（来た扉からはいつでも出られる）。
 *
 * pod が何枚かあるとき（2 つの扉が同じ部屋へ・時間で入れ替わる扉）: pod j は、双子の部屋 copies[entries[j]] へ移して、その部屋の pod j を開ける。
 * entries は時間で変えられる（phase: { sec, entries: [[…], …] }。sec 秒ごとに次の組）。双子の部屋の pod のうち、その部屋に向こうの空間が
 * つながっていない物（今の entries でその部屋が行き先でない pod）は、閉じていれば、行き先の双子の部屋へ移してそちらの pod を開ける。
 * 双子の部屋から移すときは、その部屋の pod が全部閉じてから（開いていれば閉めて待つ。開いた扉の向こうが移した先で変わって見えないように）。
 *
 * 足した扉（pod・双子の部屋の扉）の開け閉めはこの部品がまとめて行う（扉の入力 open に配線する。E / タップで開閉・誰も近くにいなければ
 * 自動で閉まる。扉の部品と同じ）。R の扉はふつうの扉のまま（入力 lock を出力 free（いつも 0）に配線して、この部品の後に動くようにする。
 * 双子の部屋から戻すときは、プレイヤーがその扉を調べたことにして、同じ tick に本物の扉を開ける）。
 *
 * params:
 *   room   … R の内側の範囲（pod を開けるとき、R の中にいること）
 *   doors  … { real: [R の扉の id …（入口が先）], pod, pods? }（pods が無ければ [pod]）
 *   copies … [{ doors: [双子の扉の id …（real と同じ並び）], pod, pods?, xform, entry? }]（R からの写し方）。copies[0] が入口の R'（entry）。
 *            entry の双子の部屋の pod は、今の行き先がその部屋のときだけ向こうへつながる（ほかの時は行き先の双子の部屋へ移す）。
 *            entry でない双子の部屋（別の空間の終わりの Q'）の pod は、いつも向こうへつながる
 *   entries … [pod j の行き先の copies の番号 …]（無ければ [0]）・phase … { sec, entries: [[…], …] }（時間で入れ替える）
 *   managed … この部品が開け閉めする扉の id（d<i> の並び）
 *   auto   … { 扉の id: 自動で閉まる秒 }（0 は閉まらない）
 * outputs: d0, d1, …・ready（R の扉が全部閉じている）・entered（pod から入った回数）・free（いつも 0）・phase（今の組の番号）・
 *          multi（同じ扉で 2 つの別の双子の部屋へ行ったことがある = 時間で入れ替わったことに気づいた）
 */
import { aabbCenter } from '../../../math/aabb.ts';
import { distXZ, type Vec3 } from '../../../math/vec.ts';
import { definePart, pNum, type PartContext } from '../../part.ts';
import type { PlayerState } from '../../types.ts';
import { inBox, readAabb, readXform, xCompose, xInverse, xPoint, xYaw, type Xform } from './util.ts';

interface Copy { doors: string[]; pods: string[]; xform: Xform; end: boolean }

const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

type S = { target: Record<string, number>; idle: Record<string, number>; centers: Record<string, number[]>; entered: number; pending: Record<string, string>; via: number[]; multi: number };

/** 今の pod ごとの行き先（時間で入れ替えるなら今の組） */
export function anteEntries(ctx: { spec: PartContext['spec']; time: number }): { entries: number[]; phase: number } {
  const P = ctx.spec.params;
  const ph = P.phase as { sec?: number; entries?: number[][] } | undefined;
  if (ph && ph.entries?.length && (ph.sec ?? 0) > 0) {
    const k = Math.floor(ctx.time / ph.sec!) % ph.entries.length;
    return { entries: ph.entries[k]!, phase: k };
  }
  return { entries: (P.entries as number[] | undefined) ?? [0], phase: 0 };
}

definePart<S>({
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
    return { target, idle: {}, centers, entered: 0, pending: {}, via: [], multi: 0 };
  },
  step(s, ctx) {
    const P = ctx.spec.params;
    const managed = ids(P.managed);
    const d = (P.doors ?? {}) as { real?: unknown; pod?: unknown; pods?: unknown };
    const real = ids(d.real);
    const pods = d.pods ? ids(d.pods) : typeof d.pod === 'string' ? [d.pod] : [];
    const copies: Copy[] = ((P.copies as unknown[] | undefined) ?? []).map((c) => {
      const o = c as { doors?: unknown; pod?: unknown; pods?: unknown; xform?: unknown; entry?: unknown };
      // 入口の双子の部屋（copies[0] と entry の物）は pod が行き先のときだけ向こうへつながる。ほかは終わりの双子の部屋（pod はいつも向こうへ）
      return { doors: ids(o.doors), pods: o.pods ? ids(o.pods) : [String(o.pod)], xform: readXform(o.xform as never), end: !o.entry };
    });
    const { entries, phase } = anteEntries(ctx);
    const room = readAabb(P.room);
    const auto = (P.auto ?? {}) as Record<string, number>;
    s.pending ??= {};
    s.via ??= [];
    s.multi ??= 0;
    /** 扉 k で双子の部屋 c へ行った（同じ扉で 2 つの部屋へ行ったら multi） */
    const went = (k: number, c: number): void => { s.via[k] = (s.via[k] ?? 0) | (1 << c); if ((s.via[k]! & (s.via[k]! - 1)) !== 0) s.multi = 1; };
    const angle = (id: string): number => Number(ctx.stateOf(id)?.angle ?? 0);
    // 閉じている: 板が閉じきっていて、開ける途中でもない（R の扉はふつうの扉の状態 target、足した扉はこの部品の target）
    const closed = (id: string): boolean => angle(id) < 0.02 && !(managed.includes(id) ? s.target[id] : Number(ctx.stateOf(id)?.target ?? 0));
    const allClosed = real.every(closed);
    /** 双子の部屋 c の pod が（except を除いて）全部閉じているか。閉じていなければ閉め始める */
    const podsShut = (c: Copy, except: string | null): boolean => {
      let ok = true;
      for (const id of c.pods) if (id !== except && !closed(id)) { ok = false; s.target[id] = 0; }
      return ok;
    };
    const near = (p: PlayerState, id: string, r: number): boolean => { const c = s.centers[id]; return !!c && distXZ(p.pos, c as Vec3) < r; };
    const locked = (id: string, p: PlayerState): void => ctx.cue('door.locked', (s.centers[id] ?? p.pos) as Vec3, { mat: 'doorMetal' });
    for (const p of ctx.players) {
      // 待っていた操作（双子の部屋の pod が閉じるのを待って移す）: 閉じたら、もう一度調べたことにする
      const wait = s.pending[p.id];
      if (wait) {
        if (!near(p, wait, 2.2)) delete s.pending[p.id];
        else {
          const c = copies.find((x) => x.doors.includes(wait) || x.pods.includes(wait));
          if (c && c.pods.every((id) => id === wait || closed(id))) { delete s.pending[p.id]; if (!p.interactedId) p.interactedId = wait; }
        }
      }
      const hit = p.interactedId;
      if (!hit || !managed.includes(hit)) continue;
      const j = pods.indexOf(hit);
      if (j >= 0) {
        // R の pod: ほかの扉が閉じていれば、行き先の双子の部屋へ移して向こうの pod を開ける
        const c = copies[entries[j] ?? 0];
        const there = c?.pods[j];
        if (c && there && allClosed && inBox([p.pos[0], p.pos[1] + 0.1, p.pos[2]], room, 0.2) && c.pods.every((id) => id === there || closed(id))) {
          ctx.warp(p, xPoint(c.xform, p.pos), xYaw(c.xform, p.yaw));
          s.target[there] = 1;
          s.idle[there] = 0;
          s.entered++;
          went(j, entries[j] ?? 0);
        } else locked(hit, p);
        continue;
      }
      const copy = copies.find((c) => c.doors.includes(hit) || c.pods.includes(hit));
      if (copy) {
        const di = copy.doors.indexOf(hit);
        if (di >= 0) {
          // 双子の部屋の扉: pod が全部閉じてから、フロアの部屋へ戻して本物の扉を調べたことにする（本物の扉はこの部品の後に動くので、同じ tick に開く）
          const r = real[di];
          if (!r) continue;
          if (!podsShut(copy, null)) { s.pending[p.id] = hit; continue; }
          const back = xInverse(copy.xform);
          ctx.warp(p, xPoint(back, p.pos), xYaw(back, p.yaw));
          p.interactedId = r;
          continue;
        }
        const k = copy.pods.indexOf(hit);
        const dest = copies[entries[k] ?? 0];
        const open = !closed(hit);
        if (open || copy.end || !dest || dest === copy) {
          // 開いている pod・この部屋に向こうがつながっている pod: ふつうに開け閉め
          s.target[hit] = s.target[hit] ? 0 : 1;
          s.idle[hit] = 0;
          continue;
        }
        // 向こうがつながっていない pod: 行き先の双子の部屋へ移して、そちらの pod を開ける（この部屋の pod が閉じてから）
        if (!podsShut(copy, hit)) { s.pending[p.id] = hit; continue; }
        const there = dest.pods[k];
        if (!there || !dest.pods.every(closed)) { locked(hit, p); continue; }
        const x = xCompose(xInverse(copy.xform), dest.xform);
        ctx.warp(p, xPoint(x, p.pos), xYaw(x, p.yaw));
        s.target[there] = 1;
        s.idle[there] = 0;
        s.entered++;
        went(k, entries[k] ?? 0);
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
      const nearAny = !!c && ctx.players.some((p) => distXZ(p.pos, c as Vec3) < pNum(ctx.spec, 'near', 1.6) && Math.abs(p.pos[1] - c[1]!) < 2.5);
      s.idle[id] = nearAny ? 0 : (s.idle[id] ?? 0) + ctx.dt;
      if ((s.idle[id] ?? 0) >= sec) { s.target[id] = 0; s.idle[id] = 0; }
    }
    managed.forEach((id, i) => ctx.output(`d${i}`, s.target[id] ? 1 : 0));
    ctx.output('ready', allClosed ? 1 : 0);
    ctx.output('entered', s.entered);
    ctx.output('free', 0);
    ctx.output('phase', phase);
    ctx.output('multi', s.multi);
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

/**
 * 行き先の色の灯り（時間で入れ替わる扉: 扉の上の細い灯り）。入力 phase（控え室の出力 phase）の組の色 colors[phase] を状態 idx にする。
 * 組が変わったときに合図 'phase.flip'（描画は小さなチャイム）
 */
definePart<{ idx: number }>({
  type: 'warpPhaseLamp',
  inputs: ['phase'],
  outputs: ['idx'],
  init: () => ({ idx: 0 }),
  step(s, ctx) {
    const n = Math.max(1, ((ctx.spec.params.colors as number[] | undefined) ?? [0]).length);
    const k = Math.max(0, Math.round(ctx.input('phase'))) % n;
    if (k !== s.idx) { s.idx = k; ctx.cue('phase.flip', ctx.spec.params.pos as Vec3 | undefined, { idx: k }); }
    ctx.output('idx', s.idx);
  },
});
