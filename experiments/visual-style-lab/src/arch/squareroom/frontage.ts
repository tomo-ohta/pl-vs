import type * as THREE from 'three';
import type { V3 } from '../../scenes/Builder.ts';
import { rng } from '../../scenes/Builder.ts';
import { builderSink, Prop } from '../../props/kit.ts';
import { cqBox, type Env } from './env.ts';
import type { Frame } from './frame.ts';
import { lampNearViews, seenFromViews } from './sight.ts';
import { stainOf } from './mats.ts';
import { concreteBench, pipeRailing, steelDoor, wallLamp, wallVent } from './props/fixtures.ts';
import { SC } from './props/mats.ts';
import { bulkheadLamp, catLadder, conduitRun, downpipe, meterCabinet, signPlate, windowGrille } from './props/wall.ts';
import { crate } from './props/room.ts';
import { pottedPlant, trashBin } from '../../props/lib/index.ts';

/**
 * 歩廊の奥の壁（決まり）: 参考画像の目の高さの語彙（低い箱の突き出し・暗い戸口・柱型）に、人の住む建物の中くらいの形を足して、
 * 写っていない歩廊の奥の壁にも並べる。1.5〜3.3 m の区切りごとに 1 つ選ぶ:
 * - 突き出した低い箱（上の水切りと、その下から垂れる染み）
 * - 奥まった戸口（抱きの深い枠・まぐさ・庇・段・鉄の扉・番号の札・戸口の灯りと光だまり・庇の下の染み）
 * - 柱型（天井まで。竪樋が添う）
 * - 窓（額縁・窓台・方立て・所々の格子・灯りの窓。窓台の下から染み）。開けた壁では所々に上へバルコニー
 * - 設備（計器の箱・長椅子・換気口）。開けた壁では所々に上の箱へ上る背かごのはしご
 * 壁に沿って通しで電線管（継ぎ箱・スイッチへ下りる管）。区切りごとに参考画像の視点から近くに見えるなら置かない
 */

export { lampNearViews, seenFromViews } from './sight.ts';

export interface FrontageSpec {
  f: Frame;
  /** 奥の壁の面（局所の x）と、歩廊の向き（+1 = 壁の面が +x を向く: 歩廊は +x 側） */
  X: number;
  facing: 1 | -1;
  z0: number;
  z1: number;
  /** 歩廊の床の高さ・天井（回廊なら天井の高さ。無ければ上は開けている） */
  floor: number;
  ceil?: number;
  /** 突き出しの上限（歩廊の幅の 1/3 まで） */
  maxOut: number;
  seed: number;
  wall: THREE.Material;
  voidMat: THREE.Material;
  /** 置かない z の範囲（扉の前など） */
  skip?: [number, number][];
  /** 開けた壁の上の箱の高さ（竪樋・はしごの上端）。既定 floor + 7.5 */
  upper?: number;
  /** 戸口・窓・突き出しを作らない（手で置いた戸口の並ぶ壁）。電線管・灯り・計器の箱だけ */
  fixturesOnly?: boolean;
  /**
   * 壁の面が区切りごとに違う（積んだ箱の低い段が奥まる水庭の壁）: z の範囲の面の局所の x を返す（null = 箱の間の溝: 置かない）。
   * 無ければどこでも X
   */
  face?: (za: number, zb: number) => number | null;
  /** 参考画像の視点からこの距離より近くに見える所には置かない（既定 40 m） */
  near?: number;
  /** 腕木の灯り（床の光だまり）を置く間隔（m）。水際の決まり（dress.ts）の灯りの無い壁だけ */
  lampEvery?: number;
}

export function frontage(env: Env, o: FrontageSpec): void {
  const r = rng(o.seed);
  const open = o.ceil === undefined;
  const ceil = o.ceil ?? o.floor + 4.2;
  const s = o.facing;
  const sink = builderSink(env.b, env.ctx);
  const mats = env.props.out;
  const stain = stainOf(env.ctx, o.wall);
  const upper = o.upper ?? o.floor + 7.5;
  let seed = o.seed * 1000;
  // 今の区切りの壁の面（局所の x）
  let X = o.X;
  /** 局所の箱（x は壁の面からの出 d0〜d1） */
  const lb = (d0: number, d1: number, y0: number, y1: number, za: number, zb: number): { min: V3; max: V3 } => {
    const xa = X + s * d0;
    const xb = X + s * d1;
    return o.f.box([Math.min(xa, xb), y0, Math.min(za, zb)], [Math.max(xa, xb), y1, Math.max(za, zb)]);
  };
  const box = (d0: number, d1: number, y0: number, y1: number, za: number, zb: number, m: THREE.Material, collide: boolean): void => {
    const w = lb(d0, d1, y0, y1, za, zb);
    cqBox(env.b, m, w.min, w.max, { collide, shadow: true });
  };
  const flat = (d0: number, d1: number, y0: number, y1: number, za: number, zb: number, m: THREE.Material): void => {
    const w = lb(d0, d1, y0, y1, za, zb);
    env.b.boxMM(m, w.min, w.max, { collide: false, shadow: 'receive' });
  };
  /** 染みの板（壁の面から 4 mm。上の縁 y1 から下へ垂れる） */
  const stainAt = (d: number, y0: number, y1: number, za: number, zb: number): void => {
    const w = lb(d + 0.002, d + 0.006, y0, y1, za, zb);
    env.b.boxMM(stain, w.min, w.max, { collide: false, shadow: 'receive' });
  };
  /** 壁に付ける小物（局所の +z が壁から出る向き）。y は床からではなく世界の高さ */
  const prop = (d: number, y: number, z: number, fn: (p: Prop) => void): void => {
    const p = o.f.p(X + s * d, y, z);
    fn(Prop.at(sink, mats, p, o.f.yawW((s * Math.PI) / 2), seed++));
  };
  /** 区切りが参考画像の視点から近くに見えるか */
  const seenBay = (za: number, zb: number, out = 1.2, top = ceil): boolean => {
    const w = lb(-0.1, out, o.floor - 0.2, top, za, zb);
    return seenFromViews(w.min, w.max, o.near ?? 40);
  };
  const lamp = (za: number, zb: number, y: number, k = 0.85): void => {
    const w = lb(0, 3.6, o.floor - 0.2, Math.min(ceil, o.floor + 3.4), za - 2.0, zb + 2.0);
    if (lampNearViews(w.min, w.max)) return;
    const c = o.f.p(X + s * 0.5, y, (za + zb) / 2);
    env.ctx.addLamp({ pos: c, radius: 4.6, intensity: k * 3.0, color: '#f2e6c8', box: [...w.min, ...w.max], down: true, shadow: 0.3 });
  };

  // ---------------- 区切りごとの形 ----------------
  const busy: [number, number][] = [];
  let ladderAt = o.z0 + 8 + r() * 10;
  let z = o.z0 + 0.6;
  while (!o.fixturesOnly && z < o.z1 - 1.2) {
    const kind = r();
    const w = Math.min(1.5 + Math.floor(r() * 3) * 0.9, o.z1 - z - 0.6);
    const za = z;
    const zb = z + w;
    z += w + 0.2;
    if ((o.skip ?? []).some(([a, b]) => za < b && zb > a)) continue;
    const fx = o.face ? o.face(za, zb) : o.X;
    if (fx === null) continue;
    X = fx;
    // 天井の低い回廊（2.9 m 未満）には戸口を作らない（窓にする）
    const low = ceil - o.floor < 2.9;
    // 区切りの形の外形（種類ごとの高さ）が参考画像の視点から見えるなら置かない。上へ伸びる物（竪樋・はしご・バルコニー）は別に調べる
    const topOf = kind < 0.26 ? Math.min(ceil, o.floor + 4.0) : kind < 0.56 && !low ? o.floor + 3.0 : kind < 0.68 ? ceil : o.floor + 2.8;
    if (seenBay(za, zb, Math.max(o.maxOut, 0.85) + 0.1, topOf)) continue;
    const tallOk = !seenBay(za, zb, 1.0, upper + 0.3);
    if (kind < 0.26 && o.maxOut >= 0.3) {
      // 突き出した低い箱（上の端に薄い水切り）と、水切りの下から垂れる染み。正面に小さな高窓
      const out = 0.3 + r() * (o.maxOut - 0.3);
      const h = Math.min(2.7 + Math.floor(r() * 3) * 0.6, ceil - o.floor - 0.05);
      box(0, out, o.floor, o.floor + h, za, zb, o.wall, true);
      if (o.floor + h + 0.12 < ceil - 0.02) box(0, out + 0.08, o.floor + h, o.floor + h + 0.12, za - 0.05, zb + 0.05, o.wall, false);
      stainAt(out, o.floor + h - 1.4 - r(), o.floor + h, za + 0.05, zb - 0.05);
      if (w >= 1.4 && r() < 0.6) {
        const sw = Math.min(w - 0.6, 0.9);
        const sy = o.floor + h - 0.85;
        const sz = za + (w - sw) / 2;
        flat(out - 0.02, out + 0.012, sy, sy + 0.45, sz, sz + sw, r() < 0.3 ? env.glow('#d6e2d6') : o.voidMat);
        box(out, out + 0.1, sy - 0.07, sy, sz - 0.06, sz + sw + 0.06, o.wall, false);
        stainAt(out, sy - 1.0, sy - 0.07, sz, sz + sw);
      }
      busy.push([za, zb]);
    } else if (kind < 0.56 && !low) {
      // 奥まった戸口: 抱きの深い枠（0.35 m）・まぐさ・庇・段・鉄の扉・番号の札・戸口の灯り
      const dw = Math.min(0.95 + r() * 0.25, w - 0.6);
      const dh = Math.min(2.15 + r() * 0.2, ceil - o.floor - 0.6);
      const dz = za + (w - dw) / 2;
      const rd = 0.35;
      const step = 0.14;
      const y0 = o.floor;
      const headTop = y0 + step + dh + 0.3;
      box(0, rd, y0, headTop, dz - 0.25, dz, o.wall, true);
      box(0, rd, y0, headTop, dz + dw, dz + dw + 0.25, o.wall, true);
      box(0, rd, y0 + step + dh, headTop, dz, dz + dw, o.wall, false);
      // 庇（回廊の天井に当たらなければ）
      const hood = headTop + 0.12 < ceil - 0.05;
      if (hood) box(0, rd + 0.45, headTop, headTop + 0.12, dz - 0.42, dz + dw + 0.42, o.wall, false);
      // 段（扉の前へ 0.45 m）
      box(0, rd + 0.45, y0, y0 + step, dz - 0.1, dz + dw + 0.1, o.wall, true);
      // 鉄の扉（壁の面）。4 戸に 1 戸は開いていて、中の灯りが見え、段と歩廊に光がこぼれる
      const col = [SC.paint, SC.steel, SC.paintPale, SC.steelDark, SC.paint, SC.steel, SC.paintPale, SC.rust][Math.floor(r() * 8)];
      if (r() < 0.25) {
        flat(-0.03, 0.006, y0 + step, y0 + step + dh, dz, dz + dw, env.glow('#e2e3cf'));
        // 開いた扉の板（外開き。吊り元の縦の縁から歩廊の方へ 90° 開く）
        const lp = Prop.at(sink, mats, o.f.p(X + s * 0.02, y0 + step, dz + 0.05), o.f.yawW(s > 0 ? 0 : Math.PI), seed++);
        lp.box(col, [0, 0.01, -0.02], [dw, dh, 0.025], { r: 0.008, collide: true });
        for (const y of [0.3, dh - 0.3]) lp.box(col, [0.05, y - 0.03, 0.025], [dw - 0.05, y + 0.03, 0.04], { shadow: 'receive' });
        lp.box(SC.steel, [dw - 0.16, 1.0, 0.025], [dw - 0.12, 1.12, 0.06], { r: 0.008, shadow: 'receive' });
        lp.box(SC.rustDark, [0.02, 0.01, 0.026], [dw - 0.02, 0.18, 0.03], { shadow: 'receive' });
        const lw = lb(0, 2.2, o.floor - 0.2, o.floor + 2.4, dz - 0.6, dz + dw + 0.6);
        if (!lampNearViews(lw.min, lw.max)) env.ctx.addLamp({ pos: o.f.p(X - s * 0.3, y0 + 1.4, dz + dw / 2), radius: 2.6, intensity: 1.6, color: '#efe6c8', box: [...lw.min, ...lw.max], shadow: 0.2 });
      } else prop(0, y0 + step, dz + dw / 2, (p) => steelDoor(p, dw, dh, col));
      // 枠の正面の染み（庇・まぐさの下から）と、番号の札・灯り
      stainAt(rd, headTop - 1.3 - r() * 0.8, headTop, dz - 0.25, dz);
      stainAt(rd, headTop - 1.0 - r() * 0.8, headTop, dz + dw, dz + dw + 0.25);
      if (w - dw > 1.0) prop(0, 0, dz + dw + 0.55, (p) => signPlate(p, y0 + 1.6));
      if (r() < 0.6) {
        prop(rd, 0, dz + dw / 2, (p) => bulkheadLamp(p, y0 + step + dh + 0.15));
        lamp(dz, dz + dw, y0 + step + dh + 0.1);
      }
      // 戸口の脇の住人の物（2 戸に 1 戸: 鉢植え・ごみ箱・木の箱）
      if (r() < 0.55 && w - dw > 0.9) {
        const side = r() < 0.5 ? -1 : 1;
        const zi = side < 0 ? dz - 0.55 : dz + dw + 0.55;
        const xi = 0.3 + r() * 0.25;
        const k2 = r();
        const ip = Prop.at(sink, mats, o.f.p(X + s * xi, o.floor, zi), r() * 6, seed++);
        if (k2 < 0.45) pottedPlant(ip, { pot: r() < 0.5 ? SC.concMid : SC.rustDark, leaf: SC.leaf, soil: SC.woodDark, h: 0.7 + r() * 0.5 });
        else if (k2 < 0.75) trashBin(ip, { kind: 'round', body: SC.steel, lid: SC.steelDark });
        else {
          crate(ip, 0.55, 0.38, 0.4);
          crate(ip.sub([0.03, 0.38, 0], 0.3), 0.45, 0.3, 0.36);
        }
      }
      busy.push([dz - 0.3, dz + dw + 0.3]);
    } else if (kind < 0.68) {
      // 柱型（天井まで。開けた壁では 4.2 m まで）に、竪樋が添う
      const pz = za + w / 2;
      box(0, 0.35, o.floor, ceil, pz - 0.3, pz + 0.3, o.wall, true);
      if (open && r() < 0.7 && tallOk) prop(0, o.floor, pz + 0.42, (p) => downpipe(p, upper - o.floor));
    } else if (kind < 0.88) {
      // 窓（額縁・窓台・方立て・格子・灯りの窓）と、窓台の下から垂れる染み
      const ww = Math.min(0.9 + Math.floor(r() * 3) * 0.3, w - 0.5);
      const wh = Math.min(1.1 + r() * 0.3, ceil - o.floor - 1.5);
      const sy = o.floor + 0.95 + r() * 0.2;
      const sz = za + (w - ww) / 2;
      const lit = r() < 0.45;
      flat(-0.02, 0.012, sy, sy + wh, sz, sz + ww, lit ? env.glow('#dfe6d6') : o.voidMat);
      // 額縁（0.1 m 出る）・窓台（0.16 m 出る）・方立て
      box(0, 0.1, sy, sy + wh + 0.12, sz - 0.12, sz, o.wall, false);
      box(0, 0.1, sy, sy + wh + 0.12, sz + ww, sz + ww + 0.12, o.wall, false);
      box(0, 0.1, sy + wh, sy + wh + 0.12, sz, sz + ww, o.wall, false);
      box(0, 0.16, sy - 0.08, sy, sz - 0.2, sz + ww + 0.2, o.wall, false);
      if (ww >= 1.2) box(0, 0.06, sy, sy + wh, sz + ww / 2 - 0.04, sz + ww / 2 + 0.04, o.wall, false);
      if (!lit && r() < 0.45) prop(0, 0, sz + ww / 2, (p) => windowGrille(p, ww, wh, sy));
      stainAt(0, Math.max(o.floor + 0.15, sy - 1.3 - r() * 0.5), sy - 0.08, sz - 0.1, sz + ww + 0.1);
      // 開けた壁: 所々に上の階のバルコニー（床板・手すり・奥の暗い戸口）
      if (open && r() < 0.4 && upper > o.floor + 4.8 && tallOk) {
        const by = o.floor + 3.4;
        const bw = Math.min(w + 0.2, 2.6);
        const bz = za + (w - bw) / 2;
        box(0, 0.95, by - 0.2, by, bz, bz + bw, o.wall, false);
        stainAt(0, by - 1.6, by - 0.2, bz + 0.1, bz + bw - 0.1);
        flat(-0.02, 0.012, by, by + 2.1, bz + bw / 2 - 0.45, bz + bw / 2 + 0.45, o.voidMat);
        const rp = o.f.p(X + s * 0.9, by, bz + bw / 2);
        pipeRailing(Prop.at(sink, mats, rp, o.f.yawW((s * Math.PI) / 2), seed++), bw - 0.1, 1.0);
      }
      busy.push([sz - 0.2, sz + ww + 0.2]);
    } else {
      // 設備: 計器の箱・長椅子・換気口。開けた壁では所々に上の箱へ上る背かごのはしご
      const cz = za + w / 2;
      if (open && za > ladderAt && upper > o.floor + 4 && tallOk) {
        prop(0, o.floor, cz, (p) => catLadder(p, upper - o.floor, 0.0));
        ladderAt = za + 22 + r() * 14;
      } else if (r() < 0.5) {
        prop(0, 0, cz, (p) => meterCabinet(p, o.floor + 0.9));
      } else if (w >= 2.0) {
        const bp = o.f.p(X + s * 0.32, o.floor, cz);
        concreteBench(Prop.at(sink, mats, bp, o.f.yawW((s * Math.PI) / 2), seed++), Math.min(2.2, w - 0.3));
      } else {
        prop(0, 0, cz, (p) => wallVent(p.sub([0, o.floor + 2.2, 0]), 0.5, 0.32));
      }
      if (open && r() < 0.5 && tallOk) prop(0, o.floor, za + 0.25, (p) => downpipe(p, upper - o.floor));
    }
  }

  // ---------------- 腕木の灯り（決まりの間隔。戸口・窓を避ける）と、床の光だまり ----------------
  if (o.lampEvery) {
    let last = -Infinity;
    for (let zc = o.z0 + o.lampEvery / 2; zc < o.z1 - 0.5; zc += o.lampEvery) {
      let zz = zc;
      for (const [u, v] of busy) if (zz > u - 0.3 && zz < v + 0.3) zz = v + 0.45;
      if (zz > o.z1 - 0.5 || zz - last < o.lampEvery * 0.6 || (o.skip ?? []).some(([u, v]) => zz > u && zz < v)) continue;
      last = zz;
      const fx = o.face ? o.face(zz - 0.3, zz + 0.3) : o.X;
      if (fx === null) continue;
      X = fx;
      if (seenBay(zz - 3, zz + 3, 3)) continue;
      const ly = Math.min(o.floor + 2.6, ceil - 0.35);
      prop(0, 0, zz, (p) => wallLamp(p, ly));
      lamp(zz - 2.2, zz + 2.2, ly - 0.15, 0.95);
    }
  }

  // ---------------- 通しの電線管（継ぎ箱 4.8 m ごと・所々スイッチへ下りる）。壁の面が変わる所・見える所で切る ----------------
  {
    const cy = open ? o.floor + 3.0 : ceil - 0.22;
    const segs: [number, number, number][] = [];
    let a = o.z0 + 0.4;
    let aX: number | null = null;
    const close = (end: number): void => {
      if (aX !== null && end - a > 2) segs.push([a, end, aX]);
    };
    for (let zz = o.z0 + 0.4; zz < o.z1 - 0.4; zz += 2.4) {
      const zb = Math.min(zz + 2.4, o.z1 - 0.4);
      const fx = o.face ? o.face(zz, zb) : o.X;
      X = fx ?? o.X;
      const bad = fx === null || (o.skip ?? []).some(([p, q]) => zz < q && zb > p) || seenBay(zz, zb, 0.4, cy + 0.4);
      if (bad || fx !== aX) {
        close(zz);
        a = bad ? zb : zz;
        aX = bad ? null : fx;
      }
    }
    close(o.z1 - 0.4);
    for (const [p0, p1, fx] of segs) {
      X = fx;
      const L = p1 - p0;
      const drops: number[] = [];
      for (let x = -L / 2 + 2.4; x < L / 2 - 1; x += 4.8) {
        // 小物の局所の x は水路の局所の -s·z の向き
        const zc = (p0 + p1) / 2 - s * x;
        if (r() < 0.35 && !busy.some(([u, v]) => zc > u - 0.2 && zc < v + 0.2)) drops.push(x);
      }
      // 電線管は小物の局所の x の向きに延びる（壁の小物と同じ向きで、壁に沿う）
      const c = o.f.p(X, 0, (p0 + p1) / 2);
      conduitRun(Prop.at(sink, mats, c, o.f.yawW((s * Math.PI) / 2), seed++), L, cy, { drops });
    }
  }
}
