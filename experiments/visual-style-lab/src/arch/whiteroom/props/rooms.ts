import type { Prop } from '../../../props/kit.ts';
import { shade } from '../../../props/kit.ts';

/**
 * whiteroom の部屋の中の小物（修道院の学びの家: 図書室・食堂・工房・教室・門番の部屋）。正面 +z、床 y = 0。実寸。
 * 色は場所の色の表（淡い灰緑の漆喰・暗い灰緑の木部・生成りの紙）から。
 */
export const RC = {
  wood: '#4a5a52',
  woodLight: '#6d7d72',
  woodTop: '#8a978b',
  paper: '#dfe3d3',
  paperOld: '#c9ccb6',
  book: ['#3f5b55', '#5d7465', '#2f4440', '#7a8873', '#9aa38e', '#4d4a3e', '#6b5e4b'],
  board: '#24332f',
  chalk: '#c8d2c4',
  metal: '#59696a',
  cloth: '#a9b8ad',
  ceramic: '#e1e6dc',
  jar: '#86a39a',
  /** 放熱器の塗り（淡い灰緑。暗い腰壁の前で形が分かる。布と同じ色 = 同じ材質で描く回数を増やさない） */
  radiator: '#a9b8ad',
  concrete: '#c5d4c8',
};

/** 本棚（側板・棚板 5 段・背板。本は 1 冊ずつ厚み・高さ・色・傾きを変える） */
export function bookcase(p: Prop, w = 1.2, h = 2.0, d = 0.32): void {
  const t = 0.025;
  p.box(RC.wood, [-w / 2, 0, -d / 2], [-w / 2 + t, h, d / 2]);
  p.box(RC.wood, [w / 2 - t, 0, -d / 2], [w / 2, h, d / 2]);
  p.box(RC.wood, [-w / 2, h - t, -d / 2], [w / 2, h, d / 2]);
  p.box(shade(RC.wood, -0.2), [-w / 2 + t, 0, -d / 2], [w / 2 - t, h - t, -d / 2 + 0.012]);
  p.box(RC.wood, [-w / 2 + t, 0, -d / 2], [w / 2 - t, 0.08, d / 2]);
  const n = 5;
  const step = (h - 0.08 - t) / n;
  for (let i = 0; i < n; i++) {
    const y = 0.08 + i * step;
    if (i > 0) p.box(RC.wood, [-w / 2 + t, y - 0.02, -d / 2], [w / 2 - t, y, d / 2]);
    // 本の列（所々に隙間・寝かせた本）
    let x = -w / 2 + t + 0.01;
    const end = w / 2 - t - 0.01;
    while (x < end - 0.03) {
      const r = p.r();
      if (r < 0.06) {
        x += 0.06 + p.r() * 0.1;
        continue;
      }
      const bt = 0.02 + p.r() * 0.035;
      if (x + bt > end) break;
      const bh = Math.min(step - 0.05, 0.18 + p.r() * 0.12);
      const bd = d - 0.06 - p.r() * 0.05;
      const c = RC.book[Math.floor(p.r() * RC.book.length)];
      if (r > 0.95 && x + 0.25 < end) {
        // 寝かせた本の山
        for (let k = 0; k < 3; k++) p.box(c, [x, y + k * 0.03, -d / 2 + 0.03], [x + 0.22, y + k * 0.03 + 0.028, -d / 2 + 0.03 + bd], { r: 0.003, shadow: false });
        x += 0.25;
        continue;
      }
      p.box(c, [x, y, -d / 2 + 0.03], [x + bt, y + bh, -d / 2 + 0.03 + bd], { r: 0.003, shadow: false });
      // 背のラベル
      if (p.r() < 0.4) p.box(RC.paper, [x + bt * 0.2, y + bh * 0.62, -d / 2 + 0.03 + bd], [x + bt * 0.8, y + bh * 0.72, -d / 2 + 0.035 + bd], { shadow: false });
      x += bt + 0.002;
    }
  }
  p.collide([-w / 2, 0, -d / 2], [w / 2, h, d / 2]);
}

/** 長い机（厚い天板・板の脚 2 枚・貫） */
export function longTable(p: Prop, w = 2.4, d = 0.8, h = 0.75): void {
  p.box(RC.woodTop, [-w / 2, h - 0.05, -d / 2], [w / 2, h, d / 2], { r: 0.012 });
  p.box(RC.wood, [-w / 2 + 0.1, h - 0.12, -d / 2 + 0.06], [w / 2 - 0.1, h - 0.05, -d / 2 + 0.09], { r: 0.006 });
  p.box(RC.wood, [-w / 2 + 0.1, h - 0.12, d / 2 - 0.09], [w / 2 - 0.1, h - 0.05, d / 2 - 0.06], { r: 0.006 });
  for (const x of [-w / 2 + 0.25, w / 2 - 0.25]) {
    p.box(RC.wood, [x - 0.04, 0, -d / 2 + 0.08], [x + 0.04, h - 0.05, d / 2 - 0.08], { r: 0.008 });
    p.box(RC.wood, [x - 0.06, 0, -d / 2 + 0.05], [x + 0.06, 0.05, d / 2 - 0.05], { r: 0.008 });
  }
  p.box(RC.wood, [-w / 2 + 0.25, 0.18, -0.03], [w / 2 - 0.25, 0.24, 0.03], { r: 0.006 });
  p.collide([-w / 2, 0, -d / 2], [w / 2, h, d / 2]);
}

/** 机の上の物（本・紙・燭台のような灯り・湯飲み） */
export function tableTop(p: Prop, w: number, d: number): void {
  const n = Math.max(2, Math.round(w / 0.6));
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (w * (i + 0.5)) / n + (p.r() - 0.5) * 0.15;
    const r = p.r();
    const s = p.sub([x, 0, (p.r() - 0.5) * (d * 0.4)], (p.r() - 0.5) * 0.6);
    if (r < 0.35) {
      s.box(RC.book[Math.floor(p.r() * RC.book.length)], [-0.11, 0, -0.15], [0.11, 0.035, 0.15], { r: 0.004, shadow: false });
      s.box(RC.paper, [-0.1, 0.035, -0.14], [0.1, 0.04, 0.14], { shadow: false });
    } else if (r < 0.6) {
      s.box(RC.paper, [-0.105, 0, -0.15], [0.105, 0.012, 0.15], { shadow: false });
      s.box(RC.paperOld, [-0.05, 0.012, -0.12], [0.16, 0.016, 0.1], { shadow: false });
    } else if (r < 0.8) {
      s.lathe(RC.ceramic, [[0, 0], [0.035, 0], [0.04, 0.07], [0.037, 0.075], [0.033, 0.01], [0, 0.01]], [0, 0, 0], { seg: 12, shadow: false });
    } else {
      s.cyl(RC.metal, [0, 0.01, 0], 0.06, 0.02, { seg: 12, shadow: false });
      s.cyl(RC.ceramic, [0, 0.09, 0], 0.012, 0.14, { seg: 8, shadow: false });
    }
  }
}

/** 黒板（枠・板・チョークの受け・書いた白い線） */
export function blackboard(p: Prop, w = 2.6, h = 1.1, y0 = 0.9): void {
  p.box(RC.wood, [-w / 2 - 0.04, y0 - 0.04, 0], [w / 2 + 0.04, y0 + h + 0.04, 0.03]);
  p.box(RC.board, [-w / 2, y0, 0.03], [w / 2, y0 + h, 0.04], { shadow: false });
  p.box(RC.wood, [-w / 2, y0 - 0.06, 0.02], [w / 2, y0 - 0.03, 0.1], { shadow: false });
  for (let i = 0; i < 5; i++) {
    const y = y0 + h * (0.2 + i * 0.15);
    const x0 = -w / 2 + 0.15 + p.r() * 0.2;
    p.box(RC.chalk, [x0, y, 0.041], [x0 + 0.4 + p.r() * (w * 0.5), y + 0.012, 0.043], { shadow: false });
  }
  p.box(RC.chalk, [w / 2 - 0.3, y0 - 0.045, 0.05], [w / 2 - 0.2, y0 - 0.03, 0.07], { shadow: false });
}

/** 教室の机と椅子（天板・鉄の脚・物入れ、背の付いた椅子） */
export function schoolDesk(p: Prop): void {
  p.box(RC.woodTop, [-0.32, 0.7, -0.22], [0.32, 0.73, 0.22], { r: 0.006 });
  p.box(RC.wood, [-0.3, 0.6, -0.2], [0.3, 0.62, 0.2], { shadow: false });
  for (const x of [-0.29, 0.29]) {
    p.box(RC.metal, [x - 0.015, 0, -0.18], [x + 0.015, 0.7, -0.15]);
    p.box(RC.metal, [x - 0.015, 0, 0.15], [x + 0.015, 0.7, 0.18]);
    p.box(RC.metal, [x - 0.015, 0.05, -0.18], [x + 0.015, 0.08, 0.18], { shadow: false });
  }
  // 椅子（手前 +z）
  const c = p.sub([0, 0, 0.45]);
  c.box(RC.woodTop, [-0.2, 0.42, -0.18], [0.2, 0.44, 0.18], { r: 0.006 });
  c.box(RC.woodTop, [-0.19, 0.6, 0.17], [0.19, 0.78, 0.19], { r: 0.006 });
  for (const x of [-0.18, 0.18])
    for (const z of [-0.16, 0.16]) c.box(RC.metal, [x - 0.012, 0, z - 0.012], [x + 0.012, 0.42, z + 0.012], { shadow: false });
  for (const x of [-0.18, 0.18]) c.box(RC.metal, [x - 0.012, 0.42, 0.165], [x + 0.012, 0.78, 0.19], { shadow: false });
  p.collide([-0.32, 0, -0.22], [0.32, 0.73, 0.65]);
}

/** 書見台（斜めの板・柱・足） */
export function lectern(p: Prop): void {
  p.box(RC.wood, [-0.2, 0, -0.2], [0.2, 0.06, 0.2], { r: 0.01 });
  p.box(RC.wood, [-0.06, 0.06, -0.06], [0.06, 1.0, 0.06], { r: 0.008 });
  const top = p.sub([0, 1.05, 0], 0, { pitch: -0.45 });
  top.box(RC.wood, [-0.28, -0.02, -0.2], [0.28, 0.02, 0.2], { r: 0.008 });
  top.box(RC.wood, [-0.28, 0.02, 0.17], [0.28, 0.05, 0.2], { shadow: false });
  top.box(RC.paperOld, [-0.22, 0.02, -0.16], [0.22, 0.035, 0.15], { shadow: false });
  p.collide([-0.28, 0, -0.25], [0.28, 1.2, 0.25]);
}

/** 作業台（厚い天板・下の棚・万力・道具） */
export function workbench(p: Prop, w = 2.0): void {
  const d = 0.75;
  const h = 0.86;
  p.box(RC.woodTop, [-w / 2, h - 0.07, -d / 2], [w / 2, h, d / 2], { r: 0.01 });
  for (const x of [-w / 2 + 0.08, w / 2 - 0.08])
    for (const z of [-d / 2 + 0.08, d / 2 - 0.08]) p.box(RC.wood, [x - 0.05, 0, z - 0.05], [x + 0.05, h - 0.07, z + 0.05], { r: 0.008 });
  p.box(RC.wood, [-w / 2 + 0.05, 0.15, -d / 2 + 0.05], [w / 2 - 0.05, 0.18, d / 2 - 0.05]);
  // 下の棚の箱と板切れ
  for (let i = 0; i < 3; i++) {
    const x = -w / 2 + 0.3 + i * (w / 3.2);
    p.box(shade(RC.woodLight, (p.r() - 0.5) * 0.3), [x, 0.18, -0.2], [x + 0.35, 0.36 + p.r() * 0.1, 0.18], { r: 0.008, shadow: false });
  }
  // 万力
  const v = p.sub([w / 2 - 0.25, h, d / 2 - 0.05]);
  v.box(RC.metal, [-0.08, 0, -0.1], [0.08, 0.1, 0.02], { r: 0.008, shadow: false });
  v.box(RC.metal, [-0.08, 0.02, 0.02], [0.08, 0.1, 0.06], { r: 0.008, shadow: false });
  v.rod(RC.metal, [0, 0.06, 0.06], [0, 0.06, 0.2], 0.008, { shadow: false });
  // 道具（木槌・のこぎり・鉋）
  const t = p.sub([-w / 4, h, 0]);
  t.box(RC.woodLight, [-0.05, 0, -0.04], [0.05, 0.06, 0.04], { r: 0.008, shadow: false });
  t.rod(RC.woodLight, [0, 0.03, 0.04], [0, 0.03, 0.3], 0.012, { shadow: false });
  const s = p.sub([0.1, h, -0.1], 0.3);
  s.box(RC.metal, [-0.25, 0, -0.05], [0.25, 0.003, 0.05], { shadow: false });
  s.box(RC.woodLight, [0.25, 0, -0.03], [0.37, 0.025, 0.03], { r: 0.006, shadow: false });
  p.collide([-w / 2, 0, -d / 2], [w / 2, h, d / 2]);
}

/** 流し（陶器の槽・脚・蛇口） */
export function sink(p: Prop, w = 0.9): void {
  const d = 0.55;
  const h = 0.82;
  p.box(RC.ceramic, [-w / 2, h - 0.25, -d / 2], [w / 2, h, d / 2], { r: 0.02 });
  p.box('#9fb2a7', [-w / 2 + 0.06, h - 0.2, -d / 2 + 0.06], [w / 2 - 0.06, h + 0.001, d / 2 - 0.06], { shadow: false });
  for (const x of [-w / 2 + 0.08, w / 2 - 0.08]) p.box(RC.metal, [x - 0.02, 0, -0.02], [x + 0.02, h - 0.25, 0.02]);
  p.bend(RC.metal, [[0, h + 0.25, -d / 2 + 0.02], [0, h + 0.25, -d / 2 + 0.15], [0, h + 0.15, -d / 2 + 0.18]], 0.012, 0.04, { shadow: false });
  p.collide([-w / 2, 0, -d / 2], [w / 2, h, d / 2]);
}

/** 壁の掛け具（板と木の釘・掛けた外套） */
export function coatRail(p: Prop, w = 1.4, coats = 2): void {
  p.box(RC.wood, [-w / 2, 1.62, 0], [w / 2, 1.72, 0.025]);
  const n = Math.max(3, Math.round(w / 0.25));
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (w * (i + 0.5)) / n;
    p.rod(RC.woodLight, [x, 1.67, 0.02], [x, 1.7, 0.1], 0.012, { shadow: false });
  }
  for (let k = 0; k < coats; k++) {
    const x = -w / 2 + (w * (k * 2 + 1.5)) / (coats * 2 + 1);
    // 外套: 肩から裾へ広がる平たい輪郭
    p.sub([x, 0, 0]).extrude(k % 2 ? '#3b4f4a' : '#59695f', [[-0.2, 0.55], [0.2, 0.55], [0.15, 1.6], [0.05, 1.68], [-0.05, 1.68], [-0.15, 1.6]], 'xy', 0.03, 0.12, { bevel: 0.015 });
  }
}

/** 掲示板（枠・コルク・貼り紙） */
export function noticeBoard(p: Prop, w = 1.0, h = 0.7): void {
  p.box(RC.wood, [-w / 2, 1.1, 0], [w / 2, 1.1 + h, 0.025]);
  p.box('#9a9a7e', [-w / 2 + 0.04, 1.14, 0.025], [w / 2 - 0.04, 1.06 + h, 0.03], { shadow: false });
  for (let i = 0; i < 5; i++) {
    const x = -w / 2 + 0.1 + p.r() * (w - 0.35);
    const y = 1.18 + p.r() * (h - 0.35);
    p.box(p.r() < 0.5 ? RC.paper : RC.paperOld, [x, y, 0.031], [x + 0.15 + p.r() * 0.08, y + 0.2 + p.r() * 0.06, 0.033], { shadow: false });
  }
}

/** 寝台（鉄の枠・薄い布団・毛布・枕） */
export function cot(p: Prop): void {
  const w = 0.85;
  const l = 1.95;
  for (const x of [-w / 2, w / 2]) p.box(RC.metal, [x - 0.02, 0.32, -l / 2], [x + 0.02, 0.36, l / 2], { shadow: false });
  for (const z of [-l / 2, l / 2]) {
    p.box(RC.metal, [-w / 2, 0.0, z - 0.02], [w / 2, 0.06, z + 0.02], { shadow: false });
    for (const x of [-w / 2, w / 2]) p.box(RC.metal, [x - 0.02, 0, z - 0.02], [x + 0.02, z < 0 ? 0.85 : 0.6, z + 0.02]);
    p.box(RC.metal, [-w / 2, z < 0 ? 0.75 : 0.5, z - 0.015], [w / 2, z < 0 ? 0.8 : 0.55, z + 0.015], { shadow: false });
  }
  p.box(RC.cloth, [-w / 2 + 0.03, 0.36, -l / 2 + 0.03], [w / 2 - 0.03, 0.5, l / 2 - 0.03], { r: 0.04 });
  p.box('#6f8579', [-w / 2 + 0.02, 0.5, -0.2], [w / 2 - 0.02, 0.54, l / 2 - 0.02], { r: 0.02 });
  p.box(RC.ceramic, [-0.3, 0.5, -l / 2 + 0.06], [0.3, 0.6, -l / 2 + 0.4], { r: 0.04 });
  p.collide([-w / 2, 0, -l / 2], [w / 2, 0.6, l / 2]);
}

/** 壺・瓶の列（棚の上や床に。lathe の素焼きの壺） */
export function jar(p: Prop, h = 0.4, col = RC.jar): void {
  const r = h * 0.32;
  p.lathe(col, [[0, 0], [r * 0.7, 0], [r, h * 0.35], [r * 0.85, h * 0.8], [r * 0.5, h * 0.92], [r * 0.55, h], [0, h]], [0, 0, 0], { seg: 14 });
}

/** 鋳物の放熱器（窓の下。縦の節を並べた箱・上下の管・脚・弁と床への管）。壁の面（z = 0）に付け、正面 +z */
export function radiator(p: Prop, w = 1.0, h = 0.62): void {
  const col = RC.radiator;
  const y0 = 0.14;
  const d0 = 0.05;
  const d1 = 0.16;
  const n = Math.max(4, Math.round(w / 0.065));
  const pitch = w / n;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + pitch * (i + 0.5);
    p.box(col, [x - pitch * 0.38, y0 + 0.03, d0], [x + pitch * 0.38, y0 + h - 0.03, d1], { r: 0.012, shadow: i % 3 === 0 });
  }
  // 上下の管（節をつなぐ）
  p.box(col, [-w / 2, y0 + h - 0.06, d0 + 0.03], [w / 2, y0 + h - 0.02, d1 - 0.03], { shadow: false });
  p.box(col, [-w / 2, y0 + 0.02, d0 + 0.03], [w / 2, y0 + 0.06, d1 - 0.03], { shadow: false });
  // 脚・弁・床への管
  for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) p.box(col, [x - 0.025, 0, d0 + 0.02], [x + 0.025, y0 + 0.03, d1 - 0.02], { shadow: false });
  p.rod(RC.metal, [-w / 2 - 0.02, y0 + h - 0.08, 0.1], [-w / 2 - 0.12, y0 + h - 0.08, 0.1], 0.014, { shadow: false });
  p.cyl(RC.metal, [-w / 2 - 0.12, y0 + h - 0.02, 0.1], 0.025, 0.07, { shadow: false });
  p.rod(RC.metal, [-w / 2 - 0.12, y0 + h - 0.08, 0.1], [-w / 2 - 0.12, 0, 0.1], 0.014, { shadow: false });
  p.rod(RC.metal, [w / 2 + 0.02, y0 + 0.04, 0.1], [w / 2 + 0.1, y0 + 0.04, 0.1], 0.014, { shadow: false });
  p.rod(RC.metal, [w / 2 + 0.1, y0 + 0.04, 0.1], [w / 2 + 0.1, 0, 0.1], 0.014, { shadow: false });
  p.collide([-w / 2, 0, 0], [w / 2, y0 + h, d1]);
}

/** 道具の壁（工房）: 有孔の板・枠と、掛けた道具（のこぎり・金槌・直角定規・鑿の列・やっとこ・巻いた縄）。壁の面（z = 0） */
export function toolWall(p: Prop, w = 1.8, y0 = 1.0, h = 1.1): void {
  p.box(RC.woodLight, [-w / 2, y0, 0], [w / 2, y0 + h, 0.02]);
  p.box(RC.wood, [-w / 2 - 0.03, y0 - 0.03, 0], [w / 2 + 0.03, y0, 0.035], { shadow: false });
  p.box(RC.wood, [-w / 2 - 0.03, y0 + h, 0], [w / 2 + 0.03, y0 + h + 0.03, 0.035], { shadow: false });
  // のこぎり（台形の刃と握り）
  const s = p.sub([-w / 2 + 0.35, y0 + 0.25, 0.03]);
  s.extrude(RC.metal, [[-0.05, 0], [0.05, 0], [0.09, 0.55], [-0.09, 0.55]], 'xy', 0, 0.004, {});
  s.box(RC.wood, [-0.07, 0.55, -0.005], [0.07, 0.7, 0.025], { r: 0.01, shadow: false });
  // 金槌 2 本
  for (const [dx, len] of [
    [-w / 2 + 0.7, 0.32],
    [-w / 2 + 0.85, 0.28],
  ]) {
    const hm = p.sub([dx, y0 + 0.45, 0.04]);
    hm.rod(RC.woodLight, [0, 0, 0], [0, len, 0], 0.012, { shadow: false });
    hm.box(RC.metal, [-0.06, len - 0.015, -0.015], [0.06, len + 0.025, 0.02], { r: 0.006, shadow: false });
  }
  // 直角定規
  const q = p.sub([-w / 2 + 1.15, y0 + 0.3, 0.03]);
  q.box(RC.metal, [0, 0, 0], [0.025, 0.5, 0.006], { shadow: false });
  q.box(RC.metal, [0, 0, 0], [0.3, 0.025, 0.006], { shadow: false });
  // 鑿・ねじ回しの列（棚の板に差す）
  const r0 = p.sub([w / 2 - 0.45, y0 + 0.62, 0.02]);
  r0.box(RC.wood, [-0.25, 0, 0], [0.25, 0.03, 0.08], { shadow: false });
  for (let i = 0; i < 7; i++) {
    const x = -0.21 + i * 0.07;
    r0.rod(i % 2 ? RC.woodLight : RC.wood, [x, 0.03, 0.05], [x, 0.14, 0.05], 0.011, { shadow: false });
    r0.rod(RC.metal, [x, 0.03, 0.05], [x, -0.12, 0.05], 0.005, { shadow: false });
  }
  // 巻いた縄
  p.torus('#9a9a7e', [w / 2 - 0.25, y0 + 0.3, 0.06], 0.13, 0.03, { axis: 'z', seg: 16, shadow: false });
}

/** 鍵の板（門番の部屋）: 扉の付いた浅い箱・掛けた鍵と札の列。壁の面（z = 0） */
export function keyBoard(p: Prop, w = 0.7, h = 0.55, y0 = 1.3): void {
  p.box(RC.wood, [-w / 2, y0, 0], [w / 2, y0 + h, 0.07], { r: 0.008 });
  p.box(RC.paperOld, [-w / 2 + 0.03, y0 + 0.03, 0.07], [w / 2 - 0.03, y0 + h - 0.03, 0.072], { shadow: false });
  const rows = 4;
  const cols = 6;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (p.r() < 0.2) continue;
      const x = -w / 2 + 0.07 + (c * (w - 0.14)) / (cols - 1);
      const y = y0 + h - 0.09 - r * ((h - 0.12) / rows);
      p.rod(RC.metal, [x, y, 0.072], [x, y, 0.09], 0.004, { shadow: false });
      p.box(RC.metal, [x - 0.006, y - 0.06, 0.084], [x + 0.006, y - 0.01, 0.088], { shadow: false });
      p.box(p.r() < 0.5 ? RC.paper : RC.paperOld, [x - 0.018, y - 0.1, 0.086], [x + 0.018, y - 0.06, 0.089], { shadow: false });
    }
  // 開いた扉（左に 100° ほど開く薄い板）
  const d = p.sub([-w / 2, y0, 0.07], -1.75);
  d.box(RC.wood, [0, 0, -0.012], [w * 0.98, h, 0.0], { r: 0.006 });
}

/** 配膳の台（食堂）: 腰の高さの打ち放しの台・上の板・積んだ器と鍋・下の棚の口 */
export function servingCounter(p: Prop, w = 2.4): void {
  const d = 0.6;
  const h = 0.9;
  p.box(RC.concrete, [-w / 2, 0, -d / 2], [w / 2, h - 0.04, d / 2], { r: 0.01 });
  p.box(RC.woodTop, [-w / 2 - 0.03, h - 0.04, -d / 2 - 0.03], [w / 2 + 0.03, h, d / 2 + 0.03], { r: 0.008 });
  // 下の棚の口（暗い凹み 3 つ）
  for (let i = 0; i < 3; i++) {
    const x = -w / 2 + (w * (i + 0.5)) / 3;
    p.box(RC.board, [x - w / 7, 0.12, d / 2 - 0.005], [x + w / 7, h - 0.2, d / 2 + 0.002], { shadow: false });
  }
  // 積んだ器（浅い鉢を重ねる）・鍋と蓋・水差し
  for (let k = 0; k < 2; k++) {
    const bw = p.sub([-w / 2 + 0.35 + k * 0.4, h, 0]);
    for (let j = 0; j < 4 + k * 2; j++) bw.lathe(RC.ceramic, [[0, 0], [0.06, 0], [0.11, 0.04], [0.1, 0.045], [0.05, 0.008], [0, 0.008]], [0, j * 0.03, 0], { seg: 14, shadow: false });
  }
  const pot = p.sub([0.3, h, 0]);
  pot.lathe(RC.metal, [[0, 0], [0.17, 0], [0.18, 0.22], [0.17, 0.23], [0, 0.23]], [0, 0, 0], { seg: 18 });
  pot.lathe(RC.metal, [[0, 0.25], [0.17, 0.23], [0.18, 0.24], [0, 0.27]], [0, 0, 0], { seg: 18, shadow: false });
  pot.ball(RC.board, [0, 0.285, 0], 0.02, { shadow: false });
  p.sub([w / 2 - 0.35, h, 0.05]).lathe(RC.ceramic, [[0, 0], [0.06, 0], [0.075, 0.12], [0.045, 0.2], [0.055, 0.24], [0, 0.24]], [0, 0, 0], { seg: 14, shadow: false });
  p.collide([-w / 2, 0, -d / 2], [w / 2, h, d / 2]);
}

/** 木の十字架（集会室の正面の壁）。壁の面（z = 0） */
export function wallCross(p: Prop, h = 1.2, y0 = 2.0): void {
  p.box(RC.wood, [-0.04, y0, 0], [0.04, y0 + h, 0.05], { r: 0.006 });
  p.box(RC.wood, [-h * 0.3, y0 + h * 0.68, 0], [h * 0.3, y0 + h * 0.68 + 0.08, 0.05], { r: 0.006 });
}

/** 壁掛けの時計（丸い枠・淡い文字盤・目盛り・針）。壁の面（z = 0）、中心の高さ y */
export function wallClock(p: Prop, y = 2.6, r = 0.16): void {
  p.cyl(RC.wood, [0, y, 0.025], r + 0.02, 0.05, { axis: 'z', seg: 24 });
  p.cyl(RC.paper, [0, y, 0.052], r, 0.006, { axis: 'z', seg: 24, shadow: false });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const c = p.sub([Math.sin(a) * r * 0.82, y + Math.cos(a) * r * 0.82, 0.056], 0, { roll: -a });
    c.box(RC.board, [-0.004, -0.012, 0], [0.004, 0.012, 0.002], { shadow: false });
  }
  const h = p.r() * Math.PI * 2;
  const m = p.r() * Math.PI * 2;
  p.sub([0, y, 0.058], 0, { roll: -h }).box(RC.board, [-0.006, 0, 0], [0.006, r * 0.5, 0.003], { shadow: false });
  p.sub([0, y, 0.061], 0, { roll: -m }).box(RC.board, [-0.004, 0, 0], [0.004, r * 0.78, 0.003], { shadow: false });
}

/** 壁の地図（教室）: 木の上下の棒・淡い紙・陸と海の塊の色・吊るす紐。壁の面（z = 0） */
export function wallMap(p: Prop, w = 1.4, h = 1.0, y0 = 1.2): void {
  p.rod(RC.wood, [-w / 2 - 0.04, y0 + h, 0.03], [w / 2 + 0.04, y0 + h, 0.03], 0.015, { shadow: false });
  p.rod(RC.wood, [-w / 2 - 0.04, y0, 0.03], [w / 2 + 0.04, y0, 0.03], 0.015, { shadow: false });
  p.box(RC.paperOld, [-w / 2, y0, 0.02], [w / 2, y0 + h, 0.025]);
  // 陸の塊（場所の色の表の淡い緑・黄土）。矩形を重ねた素朴な地図
  const land = ['#9aa38e', '#a9b8ad', '#8a978b'];
  for (let i = 0; i < 6; i++) {
    const x = -w / 2 + 0.08 + p.r() * (w - 0.5);
    const y = y0 + 0.08 + p.r() * (h - 0.4);
    p.box(land[i % 3], [x, y, 0.026], [x + 0.15 + p.r() * 0.3, y + 0.1 + p.r() * 0.25, 0.028], { shadow: false });
  }
  p.rod(RC.board, [-w / 2 + 0.05, y0 + h, 0.03], [0, y0 + h + 0.25, 0.01], 0.003, { shadow: false });
  p.rod(RC.board, [w / 2 - 0.05, y0 + h, 0.03], [0, y0 + h + 0.25, 0.01], 0.003, { shadow: false });
}
