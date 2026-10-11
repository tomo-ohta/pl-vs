import type * as THREE from 'three';
import { rng } from '../../scenes/Builder.ts';
import { builderSink, Prop } from '../../props/kit.ts';
import type { LBox } from './author.ts';
import type { Env } from './env.ts';
import type { Frame } from './frame.ts';
import { seenFromViews } from './frontage.ts';
import { stainOf } from './mats.ts';
import { pipeRailing } from './props/fixtures.ts';
import { SC } from './props/mats.ts';
import { downpipe } from './props/wall.ts';
import type { WallOut } from './stack.ts';

/**
 * 積んだ箱の面（決まり。歩廊から見上げる 4〜22 m）: 住戸の窓のまわりの暮らしの形と、造りに従う汚れ。
 * - 窓台の下から垂れる染み（窓の幅。全部の窓）
 * - 窓の下に吊った室外機（2 割）・窓の前の小さな手すり（1 割）
 * - 箱の上の縁から下りる竪樋（2 割の箱。上の集水器・留め金具・下の曲がり）
 * 参考画像の視点から近くに見える所には付けない
 */
export function stackDress(env: Env, f: Frame, g: WallOut, side: 'L' | 'R', matOf: (b: LBox) => THREE.Material, seed: number, o: { yMin?: number; yMax?: number } = {}): void {
  const r = rng(seed);
  const s = side === 'L' ? 1 : -1;
  const yMin = o.yMin ?? 3.5;
  const yMax = o.yMax ?? 22;
  const sink = builderSink(env.b, env.ctx);
  const mats = env.props.out;
  let ps = seed * 1000;
  const yawOut = f.yawW((s * Math.PI) / 2);
  const seen = (min: [number, number, number], max: [number, number, number]): boolean => {
    const w = f.box(min, max);
    return seenFromViews(w.min, w.max);
  };
  const big = g.blocks.filter((b) => b.max[1] - b.min[1] > 1.5);
  /** 窓を含む箱（材質と面） */
  const host = (w: LBox): LBox | undefined => big.find((b) => b.min[1] <= w.min[1] && b.max[1] >= w.max[1] && b.min[2] <= w.min[2] && b.max[2] >= w.max[2]);
  for (const w of g.windows) {
    const h = w.max[1] - w.min[1];
    const ww = w.max[2] - w.min[2];
    if (h < 1.0 || ww < 0.5 || w.min[1] < yMin || w.min[1] > yMax) continue;
    const b = host(w);
    if (!b) continue;
    const face = s > 0 ? w.max[0] - 0.03 : w.min[0] + 0.03;
    const zc = (w.min[2] + w.max[2]) / 2;
    const sy = w.min[1] - 0.12;
    if (seen([face - 1, sy - 2.2, w.min[2] - 0.5], [face + 1, w.max[1], w.max[2] + 0.5])) continue;
    // 窓台の下の染み（窓台の下の端から 1.0〜2.2 m）
    const len = Math.min(1.0 + r() * 1.2, sy - b.min[1] - 0.05);
    if (len > 0.4) {
      const st = stainOf(env.ctx, matOf(b));
      const xa = face + s * 0.002;
      const xb = face + s * 0.006;
      const pw = f.box([Math.min(xa, xb), sy - len, w.min[2] - 0.05], [Math.max(xa, xb), sy, w.max[2] + 0.05]);
      env.b.boxMM(st, pw.min, pw.max, { shadow: 'receive' });
    }
    const k = r();
    if (k < 0.2 && sy - b.min[1] > 1.0) {
      // 窓の下に吊った室外機（腕木 2 本・箱・丸い羽根の格子）
      const p = Prop.at(sink, mats, f.p(face, sy - 0.75, zc + (r() - 0.5) * Math.max(0, ww - 0.8)), yawOut, ps++);
      for (const x of [-0.3, 0.3]) p.box(SC.steelDark, [x - 0.015, -0.03, 0], [x + 0.015, 0.0, 0.42], { shadow: 'receive' });
      p.box(SC.paintPale, [-0.38, 0.0, 0.04], [0.38, 0.55, 0.38], { r: 0.012 });
      p.cyl(SC.steelDark, [-0.08, 0.275, 0.385], 0.19, 0.012, { axis: 'z', seg: 18, shadow: 'receive' });
      p.rod(SC.steel, [0.3, 0.45, 0.2], [0.3, 0.75, 0.0], 0.015, { shadow: 'receive' });
    } else if (k < 0.3) {
      // 窓の前の小さな手すり（窓台の上 0.9 m）
      pipeRailing(Prop.at(sink, mats, f.p(face + s * 0.12, sy + 0.12, zc), yawOut, ps++), ww + 0.2, 0.9);
    }
  }
  // 箱の上の縁から下りる竪樋（箱の端寄り）
  for (const b of big) {
    const hgt = b.max[1] - b.min[1];
    const len = b.max[2] - b.min[2];
    if (hgt < 4 || len < 2.5 || b.min[1] > yMax || b.max[1] < yMin || r() > 0.22) continue;
    const face = s > 0 ? b.max[0] : b.min[0];
    const z = r() < 0.5 ? b.min[2] + 0.35 : b.max[2] - 0.35;
    if (seen([face - 0.5, b.min[1], z - 0.5], [face + 0.5, b.max[1], z + 0.5])) continue;
    // 窓に重ならない所だけ
    if (g.windows.some((w) => w.max[2] > z - 0.3 && w.min[2] < z + 0.3 && w.max[1] > b.min[1] && w.min[1] < b.max[1])) continue;
    downpipe(Prop.at(sink, mats, f.p(face, b.min[1] - 0.05, z), yawOut, ps++), hgt - 0.3);
  }
}
