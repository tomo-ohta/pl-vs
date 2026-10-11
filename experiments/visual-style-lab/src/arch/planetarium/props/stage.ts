import type { Prop, V2 } from '../../../props/kit.ts';
import { roundRect } from '../../../props/kit.ts';

/**
 * 舞台と客席の小物（実寸。局所の座標: 床 y = 0、正面 +z）。
 * - 操作卓（舞台の前の縁。客席側が正面 = 化粧板、舞台側に操作面・画面・卓上灯・ガラスの陳列ケース）と機材の棚
 * - 星の投影機（昔の 2 つの星の球の投影機。舞台の裏の塔の上の展示）
 * - 通路の足もとの灯り（低い柱の灯り）・案内の板（自立の看板）・演台・スピーカー
 */

const C = {
  body: '#1a2a33',
  bodyDark: '#0d171d',
  panel: '#22333d',
  metal: '#5d7480',
  black: '#07090b',
  screen: '#7fd6ff',
  warm: '#ffd9a0',
  glass: '#9fd8ee',
  brass: '#8c7a55',
  sphere: '#2b3a44',
};

/** 操作卓: 幅 w（既定 3.7 m）・奥行き 1.0 m・高さ 1.1 m。正面（+z）は客席側の化粧板 */
export function consoleDesk(p: Prop, o: { w?: number } = {}): void {
  const w = o.w ?? 3.7;
  const d = 1.0;
  const h = 1.1;
  // 本体と化粧板（客席側は縦の板、上に笠木）
  p.box(C.body, [-w / 2, 0.05, -d / 2], [w / 2, h - 0.06, d / 2], { r: 0.02, collide: true });
  p.box(C.bodyDark, [-w / 2 - 0.02, 0, -d / 2 - 0.02], [w / 2 + 0.02, 0.06, d / 2 + 0.02]);
  p.box(C.panel, [-w / 2 - 0.03, h - 0.06, d / 2 - 0.12], [w / 2 + 0.03, h, d / 2 + 0.03], { r: 0.012 });
  // 化粧板の縦の目地（板の継ぎ）
  for (let x = -w / 2 + 0.6; x < w / 2 - 0.3; x += 0.6) p.box(C.bodyDark, [x - 0.008, 0.1, d / 2], [x + 0.008, h - 0.1, d / 2 + 0.006], { shadow: false });
  // 操作面（舞台側へ下がる斜めの面）と、ボタン・つまみの列
  const slope = p.sub([0, h - 0.04, -0.1], 0, { pitch: -0.32 });
  slope.box(C.panel, [-w / 2 + 0.1, 0, -0.34], [w / 2 - 0.1, 0.04, 0.3], { r: 0.01 });
  for (let i = 0; i < 26; i++) {
    const x = -w / 2 + 0.3 + i * ((w - 0.6) / 25);
    for (let k = 0; k < 3; k++) {
      const glow = (i * 7 + k * 3) % 5 === 0;
      slope.box(glow ? C.warm : C.metal, [x - 0.018, 0.04, -0.22 + k * 0.12], [x + 0.018, 0.06, -0.19 + k * 0.12], { kind: glow ? 'glow' : 'solid', shadow: false });
    }
  }
  // 画面 2 台（台と首。舞台側を向く → 客席からは背中）
  for (const x of [-w * 0.28, w * 0.05]) {
    const s = p.sub([x, h, -0.2], Math.PI);
    s.box(C.black, [-0.33, 0.2, -0.03], [0.33, 0.6, 0.03], { r: 0.01 });
    s.box(C.screen, [-0.3, 0.23, 0.032], [0.3, 0.57, 0.036], { kind: 'glow', shadow: false });
    s.box(C.bodyDark, [-0.04, 0, -0.04], [0.04, 0.22, 0.04]);
    s.box(C.bodyDark, [-0.14, 0, -0.1], [0.14, 0.02, 0.1]);
  }
  // 卓上灯（首の曲がった細い灯り）
  {
    const s = p.sub([w * 0.4, h, -0.25]);
    s.cyl(C.black, [0, 0.01, 0], 0.07, 0.02);
    s.tube(C.metal, [[0, 0.02, 0], [0, 0.25, 0.02], [0.05, 0.38, 0.12]], 0.008);
    s.cyl(C.black, [0.07, 0.38, 0.16], 0.035, 0.08, { axis: 'z' });
    s.cyl(C.warm, [0.07, 0.38, 0.2], 0.028, 0.004, { axis: 'z', kind: 'glow', shadow: false });
  }
  // ガラスの陳列ケース（台の上の四角い箱。中に小さな天球儀）
  {
    const s = p.sub([-w * 0.42, h, 0.05]);
    s.box(C.bodyDark, [-0.3, 0, -0.3], [0.3, 0.06, 0.3], { r: 0.01 });
    s.box(C.glass, [-0.28, 0.06, -0.28], [0.28, 0.42, 0.28], { kind: 'glass', shadow: false });
    s.box(C.metal, [-0.29, 0.41, -0.29], [0.29, 0.44, 0.29], { r: 0.008 });
    s.ball(C.brass, [0, 0.22, 0], 0.1);
    s.torus(C.brass, [0, 0.22, 0], 0.13, 0.008, { axis: 'z' });
    s.torus(C.brass, [0, 0.22, 0], 0.13, 0.008, { axis: 'x' });
    s.cyl(C.brass, [0, 0.09, 0], 0.02, 0.06);
  }
  // マイクの台（細い柱と曲がった首）
  {
    const s = p.sub([w * 0.15, h, 0.2]);
    s.cyl(C.black, [0, 0.01, 0], 0.06, 0.02);
    s.tube(C.black, [[0, 0.02, 0], [0, 0.3, 0], [0, 0.42, 0.08]], 0.006);
    s.cyl(C.black, [0, 0.44, 0.12], 0.012, 0.09, { axis: 'z' });
  }
}

/** 機材の棚（19 インチの棚 2 本並び）: 幅 1.3・高さ 2.0・奥行き 0.9。正面 +z に通気の板・つまみ・小さな灯り */
export function equipmentRack(p: Prop): void {
  for (const x of [-0.33, 0.33]) {
    const s = p.sub([x, 0, 0]);
    s.box(C.black, [-0.31, 0.04, -0.45], [0.31, 2.0, 0.45], { r: 0.01, collide: true });
    s.box(C.bodyDark, [-0.3, 0, -0.43], [0.3, 0.05, 0.43]);
    // 段ごとの機器の前板
    for (let k = 0; k < 9; k++) {
      const y0 = 0.15 + k * 0.2;
      s.box(k % 3 === 0 ? C.panel : C.body, [-0.26, y0, 0.45], [0.26, y0 + 0.17, 0.47], { shadow: false });
      if (k % 2 === 0) s.box(k % 4 === 0 ? C.screen : C.warm, [0.16, y0 + 0.07, 0.47], [0.2, y0 + 0.1, 0.48], { kind: 'glow', shadow: false });
      for (let j = 0; j < 4; j++) s.cyl(C.metal, [-0.18 + j * 0.07, y0 + 0.085, 0.475], 0.012, 0.01, { axis: 'z', shadow: false });
    }
  }
}

/** 星の投影機（2 つの星の球を棒でつないだ昔の投影機）。高さ約 3.2 m・長さ 3.4 m。台座・腕・惑星棚の籠・星の球（小さな窓の点） */
export function starProjector(p: Prop): void {
  // 台座（八角の段と柱）
  p.cyl(C.bodyDark, [0, 0.15, 0], 0.9, 0.3, { seg: 8, collide: true });
  p.cyl(C.body, [0, 0.45, 0], 0.62, 0.3, { seg: 8 });
  p.lathe(C.sphere, [[0, 0], [0.45, 0], [0.38, 0.2], [0.26, 0.9], [0.3, 1.1], [0, 1.1]], [0, 0.6, 0], { seg: 20 });
  // 腕を傾けた座標系（地軸の傾き 35°）
  const arm = p.sub([0, 1.75, 0], 0.3, { roll: 1.15 });
  // 中央の籠（惑星の投影の棚。格子の箱）
  arm.box(C.sphere, [-0.32, -0.5, -0.32], [0.32, 0.5, 0.32], { r: 0.04 });
  for (const y of [-0.3, 0, 0.3]) arm.torus(C.metal, [0, y, 0], 0.4, 0.02, { axis: 'y', seg: 20 });
  for (const a of [0, 1, 2, 3]) {
    const x = Math.cos((a * Math.PI) / 2 + 0.78) * 0.4;
    const z = Math.sin((a * Math.PI) / 2 + 0.78) * 0.4;
    arm.rod(C.metal, [x, -0.5, z], [x, 0.5, z], 0.015);
  }
  // 両端の棒と星の球
  for (const sg of [-1, 1]) {
    arm.cyl(C.body, [0, sg * 0.95, 0], 0.12, 0.9);
    arm.cyl(C.metal, [0, sg * 1.38, 0], 0.22, 0.08, { seg: 20 });
    arm.ball(C.sphere, [0, sg * 1.75, 0], 0.48, { seg: 24 });
    // 星の窓（小さな丸い窓。暗い球に点々）
    for (let i = 0; i < 22; i++) {
      const t = (i * 2.399963) % (Math.PI * 2);
      const v = -0.85 + (1.7 * i) / 22;
      const rr = Math.sqrt(1 - v * v) * 0.485;
      arm.ball(C.metal, [Math.cos(t) * rr, sg * 1.75 + v * 0.485, Math.sin(t) * rr], 0.035, { seg: 6, shadow: false });
    }
  }
  // 台座の銘板
  p.box(C.brass, [-0.22, 0.32, 0.6], [0.22, 0.46, 0.63], { shadow: false });
}

/** 通路の足もとの灯り（低い四角い柱。上の面と通路側の面が光る） */
export function aisleLamp(p: Prop): void {
  p.box(C.black, [-0.06, 0, -0.06], [0.06, 0.62, 0.06], { r: 0.01 });
  p.box(C.bodyDark, [-0.09, 0.62, -0.09], [0.09, 0.78, 0.09], { r: 0.012 });
  p.box(C.warm, [-0.065, 0.645, 0.09], [0.065, 0.755, 0.095], { kind: 'glow', shadow: false });
  p.box(C.bodyDark, [-0.1, 0.78, -0.1], [0.1, 0.8, 0.1]);
  p.box(C.bodyDark, [-0.09, 0, -0.09], [0.09, 0.02, 0.09]);
}

/** 自立の案内の板（客席の通路の入口。斜めの板と細い脚） */
export function signStand(p: Prop): void {
  const board = p.sub([0, 0.95, 0], 0, { pitch: -0.18 });
  board.box(C.body, [-0.32, -0.42, -0.02], [0.32, 0.42, 0.02], { r: 0.008 });
  board.box('#4c6a78', [-0.28, -0.36, 0.021], [0.28, 0.36, 0.024], { shadow: false });
  // 板の上の文字の帯（明るい細い線）
  for (let i = 0; i < 4; i++) board.box('#9fb8c2', [-0.22, 0.2 - i * 0.12, 0.025], [0.1 + (i % 2) * 0.08, 0.22 - i * 0.12, 0.027], { shadow: false });
  p.rod(C.black, [-0.2, 0, -0.05], [-0.2, 0.6, 0.04], 0.012);
  p.rod(C.black, [0.2, 0, -0.05], [0.2, 0.6, 0.04], 0.012);
  p.box(C.bodyDark, [-0.3, 0, -0.18], [0.3, 0.025, 0.12], { r: 0.008 });
}

/** 演台（舞台の上の話す人の台） */
export function lectern(p: Prop): void {
  const out: V2[] = [[-0.3, 0], [0.3, 0], [0.26, 1.05], [-0.26, 1.05]];
  p.extrude(C.body, out, 'xy', -0.25, 0.25, { bevel: 0.01 });
  const top = p.sub([0, 1.08, 0], 0, { pitch: 0.3 });
  top.box(C.panel, [-0.34, -0.02, -0.26], [0.34, 0.02, 0.26], { r: 0.01 });
  top.box(C.warm, [-0.2, 0.021, -0.18], [0.2, 0.024, -0.16], { kind: 'glow', shadow: false });
  p.box(C.bodyDark, [-0.36, 0, -0.3], [0.36, 0.04, 0.3]);
  void roundRect;
}

/** スピーカー（床置きの箱。網と 2 つの丸い振動板） */
export function speaker(p: Prop): void {
  p.box(C.black, [-0.3, 0, -0.3], [0.3, 1.0, 0.3], { r: 0.02, collide: true });
  p.box(C.bodyDark, [-0.27, 0.04, 0.3], [0.27, 0.96, 0.31], { shadow: false });
  p.cyl(C.body, [0, 0.35, 0.31], 0.18, 0.02, { axis: 'z', shadow: false });
  p.cyl(C.body, [0, 0.75, 0.31], 0.08, 0.02, { axis: 'z', shadow: false });
}
