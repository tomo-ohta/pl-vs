/**
 * 陶器の設備（スプラット）: 置き型の洗面ボウルと蛇口、壁掛けの小便器。白い釉薬（クリアコート）と金属の蛇口。
 */
import { LOOK, lin, Rand, revolve, scale3, superellipsoid, surface, tube, type ShapeSink, type V3 } from '../shape.ts';

type Xf = (p: V3) => V3;
const glaze = LOOK.ceramic;
const chrome = { rough: 0.08, metal: 1, opacity: 1.6, mat: 3 };

/** 置き型の洗面ボウル（局所: 底の中心が原点）と、後ろに立つ蛇口 */
export function vesselSink(S: ShapeSink, R: Rand, xf: Xf): void {
  const white = lin(0xf4f3ef);
  const prof = (t: number): [number, number] => [0.07 + 0.13 * Math.sin((t * Math.PI) / 2), t * 0.13];
  revolve(S, [0, 0, 0], prof, { spacing: 0.005, look: glaze, rand: R, xf, color: (_u, v) => scale3(white, 0.92 + 0.08 * v) });
  // 縁（丸く。内側から外側へ上を回るので、外向きにするには裏返す）と内側
  revolve(S, [0, 0, 0], (t) => { const a = t * Math.PI; return [0.2 - Math.cos(a) * 0.006, 0.13 + Math.sin(a) * 0.006]; }, { spacing: 0.003, look: glaze, rand: R, xf, flip: true, color: () => white });
  revolve(S, [0, 0, 0], (t) => [0.03 + 0.164 * Math.sin((t * Math.PI) / 2), 0.012 + t * 0.118], { spacing: 0.005, look: glaze, rand: R, xf, flip: true, color: (_u, v) => scale3(white, 0.8 + 0.2 * v) });
  // 排水口（金属）
  surface(S, { u: [0, Math.PI * 2], v: [0, 1], spacing: 0.002, look: chrome, rand: R, xf, pos: (u, v) => [Math.cos(u) * v * 0.03, 0.013, Math.sin(u) * v * 0.03], color: (_u, v) => (v < 0.6 && Math.sin(v * 40) > 0 ? lin(0x202020) : lin(0xd0d0d0)) });
  // 蛇口（後ろの台から立ち上がり、ボウルの上へ曲がる）
  const fx = 0, fz = -0.26;
  revolve(S, [fx, 0, fz], (t) => [0.028 - t * 0.008, t * 0.02], { spacing: 0.003, look: chrome, rand: R, xf, color: () => lin(0xdadada) });
  const neck = (t: number): V3 => {
    if (t < 0.6) return [fx, 0.02 + (t / 0.6) * 0.3, fz];
    const a = ((t - 0.6) / 0.4) * Math.PI * 0.9;
    return [fx, 0.32 + Math.sin(a) * 0.06, fz + (1 - Math.cos(a)) * 0.08];
  };
  tube(S, neck, () => 0.012, { spacing: 0.003, look: chrome, rand: R, xf, color: () => lin(0xdadada) });
  // レバー
  tube(S, (t) => [fx + 0.012 + t * 0.07, 0.26 + t * 0.02, fz], () => 0.006, { spacing: 0.0025, look: chrome, rand: R, xf, color: () => lin(0xdadada) });
}

/** 壁掛けの小便器（局所: 壁の面が z = 0、床が y = 0、正面 +z）。前の下側が開いた器 */
export function urinal(S: ShapeSink, R: Rand, xf: Xf): void {
  const white = lin(0xf3f2ee);
  const c: V3 = [0, 0.86, 0];
  const r: V3 = [0.18, 0.31, 0.36];
  // 開口（前の下側）: 向き d で判定
  const opening = (d: V3): boolean => d[2] > 0.35 && d[1] < 0.35 && d[1] > -0.75 && Math.abs(d[0]) < 0.78;
  superellipsoid(S, c, r, 0.55, 0.7, {
    spacing: 0.006, look: glaze, rand: R, xf,
    skip: (u, v) => { const d: V3 = [Math.cos(v) * Math.cos(u), Math.sin(v), Math.cos(v) * Math.sin(u)]; return d[2] < 0.02 || opening(d); },
    color: (_u, v) => scale3(white, 0.9 + 0.1 * Math.sin(v + 1)),
  });
  // 内側（器のくぼみ。内向き）
  superellipsoid(S, [0, 0.8, 0.03], [0.15, 0.26, 0.3], 0.55, 0.7, {
    spacing: 0.006, look: glaze, rand: R, xf, flip: true,
    skip: (u, v) => { const d: V3 = [Math.cos(v) * Math.cos(u), Math.sin(v), Math.cos(v) * Math.sin(u)]; return d[2] < 0.02 || !(d[2] > 0.0 && d[1] < 0.5); },
    color: (_u, v) => scale3(white, 0.75 + 0.2 * (Math.sin(v) + 1) / 2),
  });
  // 洗浄の管（壁から上へ）と排水口
  tube(S, (t) => [0, 1.17 + t * 0.3, 0.05], () => 0.014, { spacing: 0.003, look: chrome, rand: R, xf, color: () => lin(0xd6d6d6) });
  tube(S, (t) => [0, 1.47, 0.05 - t * 0.05], () => 0.016, { spacing: 0.003, look: chrome, rand: R, xf, color: () => lin(0xd6d6d6) });
  surface(S, { u: [0, Math.PI * 2], v: [0, 1], spacing: 0.002, look: chrome, rand: R, xf, pos: (u, v) => [Math.cos(u) * v * 0.025, 0.6, 0.18 + Math.sin(u) * v * 0.025], color: (_u, v) => (Math.sin(v * 30) > 0 ? lin(0x303030) : lin(0xc0c0c0)) });
}
