import { shade, type Prop } from '../../../props/kit.ts';

/**
 * 階段の踊り場・バルコニーの小物（傘立て・鉢・バケツとモップ・ホース）。校舎の間の通路（alley/props/school.ts）の作り方を写して、この場所の色にした
 */

/** 閉じた長い傘（先・畳んだ布・留め帯・柄・曲がった持ち手）。局所: 先が原点、上へ */
function umbrella(p: Prop, col: string, len = 0.86): void {
  p.lathe(col, [[0, 0.03], [0.006, 0.03], [0.012, 0.09], [0.03, 0.26], [0.033, 0.4], [0.027, 0.56], [0.016, 0.66], [0.007, 0.69], [0, 0.69]], [0, 0, 0], { seg: 8 });
  p.rod('#a9cdd4', [0, 0, 0], [0, 0.04, 0], 0.004, { radial: 4, shadow: false });
  p.cyl(shade(col, -0.3), [0, 0.42, 0], 0.034, 0.025, { seg: 8, shadow: false });
  p.rod('#7fa9b4', [0, 0.68, 0], [0, len - 0.02, 0], 0.006, { radial: 4 });
  const handle = p.r() < 0.5 ? '#1d3348' : '#cfe6e6';
  p.rod(handle, [0, len - 0.12, 0], [0, len, 0], 0.011, { radial: 6 });
  p.torus(handle, [0.032, len, 0], 0.032, 0.011, { axis: 'z', arc: Math.PI, seg: 8 });
}

/** 傘立て（鉄の角の管の枠・上の升目の枠・下の受け皿。升目のいくつかに傘） */
export function umbrellaStand(p: Prop, o: { w?: number; d?: number; h?: number; nx?: number; nz?: number; frame?: string; fill?: number } = {}): void {
  const W = o.w ?? 0.6;
  const D = o.d ?? 0.3;
  const H = o.h ?? 0.52;
  const nx = o.nx ?? 4;
  const nz = o.nz ?? 2;
  const fr = o.frame ?? '#7fa9b4';
  const t = 0.012;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.box(fr, [sx * W / 2 - t, 0, sz * D / 2 - t], [sx * W / 2 + t, H, sz * D / 2 + t], { r: 0.003, seg: 1 });
  for (const y of [H - 0.02, 0.22]) {
    for (const sz of [-1, 1]) p.box(fr, [-W / 2, y, sz * D / 2 - 0.008], [W / 2, y + 0.02, sz * D / 2 + 0.008]);
    for (const sx of [-1, 1]) p.box(fr, [sx * W / 2 - 0.008, y, -D / 2], [sx * W / 2 + 0.008, y + 0.02, D / 2]);
  }
  for (let i = 1; i < nx; i++) p.box(fr, [-W / 2 + (i * W) / nx - 0.005, H - 0.018, -D / 2], [-W / 2 + (i * W) / nx + 0.005, H - 0.004, D / 2]);
  p.box(shade(fr, -0.45), [-W / 2 + 0.01, 0.0, -D / 2 + 0.01], [W / 2 - 0.01, 0.006, D / 2 - 0.01]);
  const cols = ['#1d3348', '#22303a', '#cfe6e6', '#2c4a66', '#4a3a48', '#2f5a52'];
  const fill = o.fill ?? 0.5;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      if (p.r() > fill) continue;
      const cx = -W / 2 + ((i + 0.5) * W) / nx + (p.r() - 0.5) * 0.03;
      const cz = -D / 2 + ((j + 0.5) * D) / nz + (p.r() - 0.5) * 0.03;
      umbrella(p.sub([cx, 0.008, cz], p.r() * Math.PI * 2, { pitch: (p.r() - 0.5) * 0.12, roll: (p.r() - 0.5) * 0.12 }), cols[Math.floor(p.r() * cols.length)], 0.8 + p.r() * 0.1);
    }
  }
  p.collide([-W / 2 - t, 0, -D / 2 - t], [W / 2 + t, H, D / 2 + t]);
}

/** 鉢植え（素焼きの鉢・土・枯れかけた葉の塊。バルコニーの鉢） */
export function planter(p: Prop, o: { pot?: string; leaf?: string; dead?: boolean } = {}): void {
  const pot = o.pot ?? '#5f8f9e';
  const leaf = o.leaf ?? '#3f7a76';
  p.lathe(pot, [[0, 0], [0.13, 0], [0.14, 0.02], [0.17, 0.24], [0.185, 0.25], [0.185, 0.27], [0.16, 0.27], [0.155, 0.25], [0, 0.25]], [0, 0, 0], { seg: 16, collide: true });
  p.cyl('#1d3348', [0, 0.245, 0], 0.15, 0.01, { seg: 14, shadow: false });
  const n = o.dead ? 6 : 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + p.r() * 0.4;
    const h = 0.18 + p.r() * 0.3;
    const s = p.sub([0, 0.25, 0], a, { pitch: -(0.3 + p.r() * 0.5) });
    if (o.dead) s.rod(shade(leaf, -0.4), [0, 0, 0], [0, h, 0.02], 0.006, { radial: 4 });
    else s.ball(leaf, [0, h * 0.5, 0], [0.035, h * 0.5, 0.012], { seg: 6 });
  }
}

/** バケツとモップ（壁に立て掛け） */
export function bucketMop(p: Prop, o: { col?: string } = {}): void {
  const col = o.col ?? '#3f78a8';
  p.lathe(col, [[0, 0], [0.11, 0], [0.115, 0.012], [0.14, 0.255], [0.15, 0.262], [0.15, 0.275], [0.138, 0.275], [0.128, 0.03], [0, 0.03]], [0, 0, 0], { seg: 16, collide: true });
  p.sub([0, 0.255, 0], 0, { pitch: -1.25 }).torus('#a9cdd4', [0, 0, 0], 0.152, 0.0035, { axis: 'z', arc: Math.PI, seg: 12 });
  const m = p.sub([0.25, 0, -0.08], -0.3, { pitch: -0.12, roll: -0.05 });
  m.lathe('#cfe6e6', [[0, 0.0], [0.07, 0.0], [0.1, 0.03], [0.085, 0.14], [0.05, 0.24], [0.03, 0.27], [0, 0.27]], [0, 0, 0], { seg: 10 });
  m.rod('#7fa9b4', [0, 0.28, 0], [0, 1.3, 0], 0.012, { radial: 6 });
}
