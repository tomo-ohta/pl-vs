import type { Prop } from '../../../props/kit.ts';
import { GLOBE } from './mats.ts';

/**
 * 回廊（ホワイエ）と玄関ホールの小物（実寸。局所の座標: 床 y = 0、正面 +z）。
 * - 展示のケース（台・ガラスの箱・中の隕石 / 望遠鏡の模型 / 惑星の模型・上の灯りの帯・名札）
 * - 大きな地球儀の展示（台・子午線の輪・地球）・券売所のカウンター・案内の端末・天井の丸い灯り・壁付けの縦長の灯り・吊った丸い灯り
 */

const C = {
  base: '#1d2c35',
  baseDark: '#0e181e',
  metal: '#6f8792',
  brass: '#8c7a55',
  glass: '#a8d8ea',
  rock: '#3d3a38',
  rock2: '#59524b',
  white: '#d9e2e6',
  warm: '#ffe6c0',
  cool: '#bfe8ff',
  screen: '#78cfff',
  sea: '#1f5e7d',
  land: '#6aa58a',
  wood: '#5a4636',
};

/** 展示のケース: 幅 1.2・奥行き 0.6・高さ 1.45。content で中身を変える */
export function displayCase(p: Prop, content: 'meteorite' | 'telescope' | 'planet' = 'meteorite'): void {
  // 台（下の引き出しの目地・足の陰）
  p.box(C.base, [-0.6, 0.05, -0.3], [0.6, 0.9, 0.3], { r: 0.015, collide: true });
  p.box(C.baseDark, [-0.57, 0, -0.27], [0.57, 0.06, 0.27]);
  p.box(C.baseDark, [-0.58, 0.42, 0.3], [0.58, 0.43, 0.305], { shadow: false });
  // 名札（斜めの板）
  const tag = p.sub([0.32, 0.86, 0.31], 0, { pitch: -0.6 });
  tag.box(C.white, [-0.12, -0.04, 0], [0.12, 0.04, 0.008], { shadow: false });
  // ガラスの箱と枠
  p.box(C.glass, [-0.58, 0.9, -0.28], [0.58, 1.38, 0.28], { kind: 'glass', shadow: false });
  for (const [x, z] of [[-0.58, -0.28], [0.58, -0.28], [-0.58, 0.28], [0.58, 0.28]]) p.box(C.metal, [x - 0.012, 0.9, z - 0.012], [x + 0.012, 1.4, z + 0.012], { shadow: false });
  p.box(C.base, [-0.6, 1.38, -0.3], [0.6, 1.45, 0.3], { r: 0.01 });
  // 上の灯りの帯（ガラスの中を照らす）
  p.box(C.warm, [-0.5, 1.365, -0.05], [0.5, 1.38, 0.05], { kind: 'glow', shadow: false });
  // 中身
  const s = p.sub([0, 0.9, 0]);
  s.box(C.baseDark, [-0.45, 0, -0.2], [0.45, 0.03, 0.2]);
  if (content === 'meteorite') {
    s.ball(C.rock, [-0.12, 0.13, 0], [0.16, 0.11, 0.13], { seg: 10 });
    s.ball(C.rock2, [0.2, 0.08, 0.04], [0.08, 0.06, 0.07], { seg: 8 });
    s.box(C.metal, [-0.3, 0.03, -0.16], [-0.24, 0.05, 0.16], { shadow: false });
  } else if (content === 'telescope') {
    s.rod(C.wood, [0, 0.03, 0], [-0.12, 0.2, 0.02], 0.012);
    s.rod(C.wood, [0, 0.03, 0], [0.1, 0.2, -0.06], 0.012);
    s.rod(C.wood, [0, 0.03, 0], [0.02, 0.2, 0.1], 0.012);
    s.cyl(C.brass, [0, 0.3, 0], 0.045, 0.62, { axis: 'x' });
    s.cyl(C.brass, [0.33, 0.3, 0], 0.055, 0.05, { axis: 'x' });
    s.cyl(C.baseDark, [-0.32, 0.3, 0], 0.025, 0.06, { axis: 'x' });
  } else {
    s.cyl(C.metal, [0, 0.1, 0], 0.015, 0.16);
    s.ball(C.sea, [0, 0.27, 0], 0.13, { seg: 16 });
    s.torus(C.brass, [0, 0.27, 0], 0.2, 0.01, { axis: 'y', seg: 28 });
  }
}

/**
 * 大きな地球儀の展示（直径 1.6 m）: 挽き物の台座（段の付いた丸い台・くびれた柱）・柱の上の受け（二股）・
 * 子午線の真鍮の輪と地軸（23.4° 傾く）・なめらかな球（ドームと同じ手続きの地図を焼いた絵）・地平の輪と 4 本の脚・説明の板
 */
export function globeExhibit(p: Prop): void {
  // 台座: 床の丸い台（2 段）と挽き物の柱
  p.lathe(C.baseDark, [[0, 0], [1.0, 0], [1.02, 0.04], [0.98, 0.1], [0.86, 0.12], [0.84, 0.2], [0.7, 0.22], [0, 0.22]], [0, 0, 0], { seg: 48, collide: true });
  p.lathe(C.base, [[0, 0], [0.26, 0], [0.3, 0.05], [0.22, 0.12], [0.14, 0.3], [0.11, 0.6], [0.13, 0.66], [0.1, 0.72], [0.16, 0.78], [0.2, 0.82], [0, 0.82]], [0, 0.22, 0], { seg: 32 });
  // 地平の輪（球の赤道の高さの水平の輪）と 4 本の脚
  const cy = 1.95;
  p.torus(C.wood, [0, cy, 0], 0.98, 0.035, { axis: 'y', seg: 64 });
  for (let i = 0; i < 4; i++) {
    const t = (i / 4) * Math.PI * 2 + Math.PI / 4;
    p.rod(C.brass, [Math.cos(t) * 0.18, 1.02, Math.sin(t) * 0.18], [Math.cos(t) * 0.96, cy - 0.03, Math.sin(t) * 0.96], 0.018);
  }
  // 子午線の輪と地軸（球と同じ傾いた座標系）
  const g = p.sub([0, cy, 0], 0.4, { roll: 0.41 });
  g.ball(GLOBE, [0, 0, 0], 0.8, { seg: 64 });
  g.torus(C.brass, [0, 0, 0], 0.86, 0.022, { axis: 'z', seg: 72 });
  g.rod(C.brass, [0, -0.95, 0], [0, 0.95, 0], 0.012);
  g.cyl(C.brass, [0, 0.88, 0], 0.03, 0.05);
  g.cyl(C.brass, [0, -0.88, 0], 0.03, 0.05);
  // 子午線の輪の下の受け（台座の柱の上から）
  p.rod(C.brass, [0, 1.04, 0], [0, cy - 0.86, 0], 0.025);
  // 説明の板（斜めの台）
  const st = p.sub([0, 0, 1.25]);
  st.rod(C.baseDark, [0, 0, 0], [0, 0.85, 0], 0.025);
  st.box(C.baseDark, [-0.16, 0, -0.16], [0.16, 0.02, 0.16], { r: 0.008 });
  const tag = st.sub([0, 0.9, 0], 0, { pitch: -0.55 });
  tag.box(C.base, [-0.3, -0.18, -0.02], [0.3, 0.18, 0.02], { r: 0.01 });
  tag.box(C.brass, [-0.27, -0.15, 0.021], [0.27, 0.15, 0.024], { shadow: false });
  tag.box(C.baseDark, [-0.2, 0.06, 0.025], [0.2, 0.09, 0.027], { shadow: false });
  for (let i = 0; i < 3; i++) tag.box(C.baseDark, [-0.2, -0.02 - i * 0.04, 0.025], [0.1 + (i % 2) * 0.08, -0.005 - i * 0.04, 0.027], { shadow: false });
}

/** 券売所のカウンター（幅 w。天板・前の化粧板・ガラスの仕切り・上の光る看板・中の画面） */
export function ticketCounter(p: Prop, w = 4.2): void {
  p.box(C.base, [-w / 2, 0, -0.35], [w / 2, 1.05, 0.35], { r: 0.02, collide: true });
  p.box(C.wood, [-w / 2 - 0.05, 1.05, -0.4], [w / 2 + 0.05, 1.1, 0.42], { r: 0.012 });
  p.box(C.baseDark, [-w / 2, 0, 0.35], [w / 2, 0.12, 0.37]);
  for (let x = -w / 2 + 0.7; x < w / 2; x += 1.4) {
    p.box(C.glass, [x - 0.6, 1.1, 0.05], [x + 0.6, 1.75, 0.07], { kind: 'glass', shadow: false });
    p.box(C.metal, [x - 0.04, 1.1, 0.03], [x + 0.04, 1.78, 0.09], { shadow: false });
    p.box(C.baseDark, [x - 0.15, 1.1, 0.07], [x + 0.15, 1.16, 0.1], { shadow: false });
    // 中の画面（客の側からは背）
    const sc = p.sub([x, 1.1, -0.15], Math.PI);
    sc.box(C.baseDark, [-0.22, 0.12, -0.02], [0.22, 0.42, 0.02]);
    sc.box(C.screen, [-0.2, 0.14, 0.021], [0.2, 0.4, 0.024], { kind: 'glow', shadow: false });
    sc.box(C.baseDark, [-0.03, 0, -0.03], [0.03, 0.13, 0.03]);
  }
  // 上の光る看板（細い光の文字の帯）
  p.box(C.baseDark, [-w / 2, 2.4, -0.1], [w / 2, 2.85, 0.05], { r: 0.01 });
  p.box(C.cool, [-w / 2 + 0.3, 2.55, 0.05], [-w / 2 + 1.6, 2.7, 0.06], { kind: 'glow', shadow: false });
  p.box(C.warm, [-w / 2 + 1.9, 2.58, 0.05], [w / 2 - 0.3, 2.66, 0.06], { kind: 'glow', shadow: false });
  for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) p.rod(C.metal, [x, 2.85, -0.05], [x, 3.6, -0.05], 0.01);
}

/** 案内の端末（細い台の上の斜めの画面） */
export function infoKiosk(p: Prop): void {
  p.box(C.base, [-0.22, 0, -0.18], [0.22, 0.95, 0.18], { r: 0.03, collide: true });
  const sc = p.sub([0, 0.95, 0.02], 0, { pitch: -0.55 });
  sc.box(C.baseDark, [-0.3, -0.03, -0.22], [0.3, 0.03, 0.22], { r: 0.02 });
  sc.box(C.screen, [-0.26, 0.031, -0.18], [0.26, 0.034, 0.18], { kind: 'glow', shadow: false });
  p.box(C.baseDark, [-0.26, 0, -0.22], [0.26, 0.03, 0.22]);
}

/** 天井の丸い灯り（埋め込み。光る円と枠）。y = 0 が天井の面、下向き */
export function ceilingLight(p: Prop): void {
  p.cyl(C.baseDark, [0, -0.01, 0], 0.16, 0.02, { seg: 18, shadow: false });
  // 光る面は冷たい白（床の光だまりの色と同じ器具）
  p.cyl('#bfe4f6', [0, -0.022, 0], 0.12, 0.006, { seg: 18, kind: 'glow', shadow: false });
}

/** 壁付けの縦長の灯り（局所の +z が部屋の向き） */
export function wallSconce(p: Prop): void {
  p.box(C.baseDark, [-0.07, -0.3, 0], [0.07, 0.3, 0.06], { r: 0.01, shadow: false });
  // 乳白のガラス越しの暖かい光（まぶしすぎない明るさ）
  p.box('#a88a66', [-0.05, -0.26, 0.061], [0.05, 0.26, 0.066], { kind: 'glow', shadow: false });
}

/** 吊った丸い灯り（コードの長さ L。y = 0 が天井） */
export function pendantLamp(p: Prop, L = 2.2): void {
  p.cyl(C.baseDark, [0, -0.02, 0], 0.08, 0.04, { shadow: false });
  p.rod(C.baseDark, [0, -0.02, 0], [0, -L, 0], 0.006, { shadow: false });
  p.ball(C.warm, [0, -L - 0.22, 0], 0.22, { seg: 16, kind: 'glow', shadow: false });
  p.cyl(C.metal, [0, -L - 0.01, 0], 0.06, 0.04, { shadow: false });
}

/** 案内の冊子の立て（幅 0.6・高さ 1.5。斜めの棚 4 段に色の違う冊子） */
export function brochureRack(p: Prop): void {
  p.box(C.baseDark, [-0.3, 0, -0.18], [0.3, 0.04, 0.18], { r: 0.01, collide: true });
  p.box(C.metal, [-0.02, 0.04, -0.12], [0.02, 1.45, -0.08]);
  p.box(C.base, [-0.3, 0.3, -0.12], [0.3, 1.5, -0.1], { r: 0.008 });
  const cols = ['#c9d6dc', '#2f6f8f', '#d6b48c', '#7fa8bf', '#3d5a6a', '#b9c8a0'];
  for (let r = 0; r < 4; r++) {
    const s = p.sub([0, 0.42 + r * 0.27, -0.1], 0, { pitch: -0.25 });
    s.box(C.metal, [-0.29, 0, 0], [0.29, 0.012, 0.09]);
    s.box('#a8d8ea', [-0.29, 0.012, 0.085], [0.29, 0.1, 0.09], { kind: 'glass', shadow: false });
    for (let k = 0; k < 3; k++) {
      const x = -0.27 + k * 0.19;
      s.box(cols[(r * 3 + k) % cols.length], [x, 0.012, 0.01], [x + 0.16, 0.21, 0.03], { shadow: false });
      s.box('#e8eef2', [x + 0.02, 0.15, 0.031], [x + 0.14, 0.17, 0.032], { shadow: false });
    }
  }
}

/** 列の仕切り（ベルトの付いた支柱。h = 0.95）。dir の向き（局所の +x）へ長さ len のベルト */
export function stanchion(p: Prop, len = 0): void {
  p.cyl(C.baseDark, [0, 0.015, 0], 0.16, 0.03, { seg: 20 });
  p.cyl(C.metal, [0, 0.48, 0], 0.03, 0.93, { seg: 12 });
  p.cyl(C.metal, [0, 0.96, 0], 0.045, 0.06, { seg: 12 });
  if (len > 0) p.box('#2f5f7a', [0.04, 0.86, -0.005], [len - 0.04, 0.91, 0.005], { shadow: false });
}

/**
 * 売店の棚（幅 w・高さ 1.9・奥行き 0.45）: 木の枠と 4 段の棚板、段ごとに違う品物（小さな地球儀・箱入りの望遠鏡・本の列・
 * 丸めた星図・惑星のぬいぐるみ）と値札の帯
 */
export function shopShelf(p: Prop, w = 1.8, seed = 0): void {
  const d = 0.45;
  for (const s of [-1, 1]) p.box(C.wood, [s * (w / 2) - 0.025, 0, -d], [s * (w / 2) + 0.025, 1.9, 0], { r: 0.006, collide: true });
  p.box(C.baseDark, [-w / 2, 0, -d], [w / 2, 1.9, -d + 0.02]);
  p.box(C.wood, [-w / 2 - 0.03, 1.9, -d - 0.01], [w / 2 + 0.03, 1.95, 0.02], { r: 0.006 });
  const ys = [0.08, 0.5, 0.9, 1.3];
  const rnd = (k: number): number => {
    const v = Math.sin((k + seed * 17) * 127.1) * 43758.5453;
    return v - Math.floor(v);
  };
  ys.forEach((y, r) => {
    p.box(C.wood, [-w / 2 + 0.025, y - 0.025, -d + 0.02], [w / 2 - 0.025, y, 0]);
    // 値札の帯（棚板の前の縁）
    p.box('#d9e2e6', [-w / 2 + 0.05, y - 0.022, 0.001], [w / 2 - 0.05, y - 0.006, 0.004], { shadow: false });
    const kind = (r + seed) % 5;
    const s = p.sub([0, y, -d / 2]);
    if (kind === 0) {
      // 小さな地球儀（台と球）
      for (let i = 0; i < 4; i++) {
        const x = -w / 2 + 0.25 + i * ((w - 0.5) / 3);
        s.cyl(C.baseDark, [x, 0.02, 0], 0.06, 0.04, { seg: 12 });
        s.rod(C.brass, [x, 0.04, 0], [x, 0.12, 0], 0.006);
        s.ball(['#3f7fa8', '#2f6f8f', '#4a86a0', '#356f90'][i], [x, 0.21, 0], 0.09, { seg: 16 });
        s.torus(C.brass, [x, 0.21, 0], 0.1, 0.006, { axis: 'z', seg: 24 });
      }
    } else if (kind === 1) {
      // 箱入りの望遠鏡（横長の箱と印刷の帯）
      for (let i = 0; i < 3; i++) {
        const x = -w / 2 + 0.33 + i * ((w - 0.66) / 2);
        s.box(['#1f3b4d', '#2b2f45', '#203a3a'][i], [x - 0.24, 0, -0.12], [x + 0.24, 0.3, 0.12], { r: 0.004 });
        s.box('#cfe6ff', [x - 0.2, 0.18, 0.121], [x + 0.08, 0.24, 0.123], { shadow: false });
        s.box('#d6b48c', [x + 0.1, 0.05, 0.121], [x + 0.2, 0.15, 0.123], { shadow: false });
      }
    } else if (kind === 2) {
      // 本の列（背の色と高さが少しずつ違う）
      let x = -w / 2 + 0.06;
      let k = 0;
      while (x < w / 2 - 0.08) {
        const t = 0.025 + rnd(k) * 0.025;
        const h = 0.22 + rnd(k + 9) * 0.1;
        s.box(['#2f4f6f', '#6a4a3a', '#3a5a4a', '#c9c2a8', '#22344a', '#5a6f7f'][Math.floor(rnd(k + 3) * 6)], [x, 0, -0.1], [x + t, h, 0.1]);
        x += t + 0.004;
        k++;
      }
    } else if (kind === 3) {
      // 丸めた星図（筒を寝かせて積む）
      for (let i = 0; i < 9; i++) {
        const x = -w / 2 + 0.15 + (i % 5) * ((w - 0.3) / 4);
        const yy = i < 5 ? 0.04 : 0.11;
        s.cyl(['#d9d2bc', '#2f4f6f', '#cfe0e8'][i % 3], [x + (i >= 5 ? 0.18 : 0), yy, 0], 0.04, 0.36, { axis: 'z', seg: 12 });
      }
    } else {
      // 惑星のぬいぐるみ（丸い形・土星は環）
      const cs = ['#c27454', '#d2b08a', '#5f9fd0', '#dcc898', '#9fd4dc'];
      for (let i = 0; i < 5; i++) {
        const x = -w / 2 + 0.2 + i * ((w - 0.4) / 4);
        s.ball(cs[i], [x, 0.11, 0], [0.11, 0.1, 0.11], { seg: 14 });
        if (i === 3) s.torus('#c9b88a', [x, 0.11, 0], 0.17, 0.02, { axis: 'y', seg: 24 });
      }
    }
  });
}

/** 天井から吊った布の垂れ幕（幅 w・長さ L。y = 0 が天井）: 上の竿と吊りの線・布（絵は場面の材質で）・下の重りの竿 */
export function bannerRig(p: Prop, w: number, L: number): void {
  for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) p.rod(C.metal, [x, 0, 0], [x, -0.6, 0], 0.003, { shadow: false });
  p.cyl(C.metal, [0, -0.6, 0], 0.015, w + 0.08, { axis: 'x', seg: 8, shadow: false });
  p.cyl(C.metal, [0, -0.6 - L, 0], 0.018, w + 0.04, { axis: 'x', seg: 8, shadow: false });
}
