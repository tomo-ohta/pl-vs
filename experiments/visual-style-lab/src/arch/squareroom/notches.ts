import type { V3 } from '../../scenes/Builder.ts';
import { rng } from '../../scenes/Builder.ts';
import type { LBox } from './author.ts';
import { A } from './canalA.ts';
import { B } from './canalB.ts';
import { C } from './canalC.ts';
import { D } from './canalD.ts';
import { Frame } from './frame.ts';
import { VIEWS, localCam } from './layout.ts';
import { visibleIn } from './stack.ts';

/**
 * 空の切れ目（決まり）: 水路の両側の積んだ塊は、20〜30 m ごとに高い所（14〜20 m より上）が抜けて空が見える
 * （参考画像の上の細い明るい切れ目と同じ語彙）。真南の日はこの切れ目を抜けて、向かいの壁の上の方に日なたの帯を落とす。
 * 抜く所は世界の箱で返し、積んだ塊・詰め物を置くときに抜く（env.holes）。参考画像の視点から見える所には作らない
 */
export function skyNotches(): { min: V3; max: V3 }[] {
  const out: { min: V3; max: V3 }[] = [];
  const views = [VIEWS.v0, VIEWS.v1, VIEWS.v2, VIEWS.v3].map((v) => ({ f: new Frame(v.frame), cam: localCam(v) }));
  const seen = (w: { min: V3; max: V3 }): boolean =>
    views.some(({ f, cam }) => {
      const l = f.boxInv(w.min, w.max);
      return visibleIn(cam, { min: l.min, max: l.max } as LBox, 20);
    });
  const canals: { f: Frame; z0: number; z1: number; xl: number; xr: number; seed: number }[] = [
    { f: new Frame(VIEWS.v2.frame), z0: A.endZ + 3, z1: A.mouthZ - 3, xl: -5.5, xr: 5.0, seed: 61 },
    { f: new Frame(VIEWS.v0.frame), z0: B.plazaZ, z1: B.mouthZ - 3, xl: B.xl, xr: B.xr, seed: 62 },
    { f: new Frame(VIEWS.v3.frame), z0: C.endZ + 3, z1: C.mouthZ - 3, xl: C.walkBack - 1.4, xr: C.wallR, seed: 63 },
    { f: new Frame(VIEWS.v1.frame), z0: D.endZ + 3, z1: D.mouthZ - 3, xl: D.overL, xr: D.wallR, seed: 64 },
  ];
  for (const c of canals) {
    const r = rng(c.seed);
    for (const side of [-1, 1]) {
      let z = c.z0 + 4 + r() * 8;
      while (z < c.z1) {
        const w = 2.4 + Math.floor(r() * 3) * 1.2;
        const base = 14 + Math.floor(r() * 4) * 1.8;
        const x = side < 0 ? c.xl : c.xr;
        // 水路の面から外へ 40 m（詰め物の向こうまで）
        const l: LBox = side < 0 ? { min: [x - 40, base, z], max: [x + 6, 90, z + w] } : { min: [x - 6, base, z], max: [x + 40, 90, z + w] };
        const wb = c.f.box(l.min, l.max);
        if (!seen(wb)) out.push(wb);
        z += w + 18 + r() * 14;
      }
    }
  }
  return out;
}
