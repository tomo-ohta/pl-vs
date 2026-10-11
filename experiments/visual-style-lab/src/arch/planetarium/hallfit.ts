import * as THREE from 'three';
import type { Builder } from '../../scenes/Builder.ts';
import type { SceneContext } from '../../scenes/types.ts';
import { Prop } from '../../props/kit.ts';
import type { LightShapes } from './fx.ts';
import { GeoBuf, type V3 } from './geo.ts';
import { doorAt, facing, l1R, onDrum, PIERS } from './hall.ts';
import { CAM, CATWALK_Y, DOORS, DRUM_R, HOUSE, LOGE, TIERS } from './layout.ts';
import { floorY, rWall, tierAt } from './profile.ts';

const xzOf = (p: V3): [number, number] => [p[0], p[2]];
import { domePropMats, domeSink } from './props/mats.ts';
import { wallSconce } from './props/lobby.ts';
import { doorHeader, exitSign } from './props/foyer.ts';

/**
 * 客席の中の、参考画像のカメラから見えない所の作り込み（決まりは「カメラの画角の外の面に、建物の部材と器具を足す」）。
 * 参考画像の視点の見た目は変えない（足す物は全部、カメラに写らない所だけ: ViewCam で画角の外を確かめる）。
 * - ドラムの壁（客席の側）: 柱の間ごとに、腰の見切り・吸音の布の板（継ぎ目で分かれる 2 色）・柱の壁付け灯と壁の明るみ。
 *   1 階の桟敷の高さにも同じ。上の壁は階の線の帯（蛇腹）で区切る
 * - ドラムの壁の出入口（客席の側）: 額縁・上の案内の箱と番号・誘導灯
 * - 北西の段床: 段鼻の下の足もとの光の帯（段ごと）
 * - 舞台の裏の塔の横の面: 板の継ぎ目（目地の帯）・点検の扉・換気の格子・壁付けの灯り
 */

const IMG_W = 1456;
const IMG_H = 816;

/** 点が参考画像のカメラの画角の外か（余白 m 画素） */
export function unseen(p: V3, m = 80): boolean {
  const q = CAM.proj(p);
  if (!q) return true;
  return q[0] < -m || q[0] > IMG_W + m || q[1] < -m || q[1] > IMG_H + m;
}
const allUnseen = (ps: V3[]): boolean => ps.every((p) => unseen(p));

export function buildHallFit(b: Builder, ctx: SceneContext, fx: LightShapes, m: { pier: THREE.Material; trim: THREE.Material; frame: THREE.Material; house: THREE.Material }): void {
  const sink = domeSink(b, ctx);
  const mats = domePropMats(ctx);
  // 木の桟（2 つの染めの板: 板ごとに交互）と暗い裏板
  const panelA = ctx.mat({ color: '#35596a', toon: 0, roughness: 0.8, line: 0, name: 'h-batten-a' });
  const batten2 = ctx.mat({ color: '#2e5060', toon: 0, roughness: 0.8, line: 0, name: 'h-batten-b' });
  const panelB = ctx.mat({ color: '#0c1a21', toon: 0, roughness: 1, line: 0, name: 'h-batten-back' });
  const dado = ctx.mat({ color: '#3a5a6a', toon: 0, roughness: 0.6, line: 0, name: 'h-dado' });
  const stepGlow = ctx.mat({ color: '#000000', unlit: true, emissive: '#5fb0d4', emissiveIntensity: 0.25, toon: 0, line: 0, name: 'h-step-glow' });

  // ---------------------------------------------------------------- ドラムの壁（柱の間ごと）
  for (let i = 0; i < PIERS; i++) {
    const p0 = ((i + 0.5) / PIERS) * Math.PI * 2;
    const p1 = ((i + 1.5) / PIERS) * Math.PI * 2;
    const pc = (p0 + p1) / 2;
    const yaw = -pc; // 正面がドームの中心の向き
    const span = (p1 - p0) * DRUM_R - 0.7 - 0.2;
    const at = (dr: number, y: number, dt = 0): V3 => onDrum(DRUM_R - dr, pc + dt / DRUM_R, y);
    if (doorAt(pc, 0.03)) continue;
    // 2 つの高さの帯: 1 階の桟敷の下（平土間）と、桟敷の上（壁ぎわ）
    const bands: { y0: number; y1: number; floor: number; sconceY: number }[] = [
      { y0: 0.95, y1: LOGE.l1 - 0.6, floor: 0, sconceY: 2.55 },
      { y0: LOGE.l1 + 0.95, y1: LOGE.l1 + 3.0, floor: LOGE.l1, sconceY: LOGE.l1 + 2.6 },
    ];
    for (const [bi, bd] of bands.entries()) {
      const corners: V3[] = [at(0.05, bd.floor, -span / 2), at(0.05, bd.floor, span / 2), at(0.05, bd.y1 + 0.3, -span / 2), at(0.05, bd.y1 + 0.3, span / 2), at(0.4, bd.sconceY, -span / 2 - 0.45), at(0.4, bd.sconceY, span / 2 + 0.45)];
      if (!allUnseen(corners)) continue;
      // 腰の見切り（笠木）と巾木
      b.box(dado, at(0.03, bd.floor + 0.9), [span, 0.05, 0.06], { rotY: yaw, shadow: false });
      b.box(m.frame, at(0.02, bd.floor + 0.05), [span, 0.1, 0.04], { rotY: yaw, shadow: false });
      // 吸音の木の格子の板（3 列 × 2 段。板ごとに暗い裏板と縦の桟 4.5 cm・隙間 3 cm。板の間の継ぎ目 2.5 cm）。
      // 下の帯の中の列は電飾の掲示の場所なので空ける
      const cols = 3;
      const rows = 2;
      const pw = (span - (cols - 1) * 0.025) / cols;
      const ph = (bd.y1 - bd.y0 - (rows - 1) * 0.025) / rows;
      for (let c = 0; c < cols; c++)
        for (let r = 0; r < rows; r++) {
          if (bi === 0 && c === 1 && i % 3 === 0) continue;
          const dt = -span / 2 + pw / 2 + c * (pw + 0.025);
          const y = bd.y0 + ph / 2 + r * (ph + 0.025);
          b.box(panelB, at(0.012, y, dt), [pw, ph, 0.02], { rotY: yaw, shadow: false });
          const nb = Math.floor((pw + 0.03) / 0.075);
          const w0 = nb * 0.075 - 0.03;
          for (let k = 0; k < nb; k++) b.box((c + r + i) % 2 ? panelA : batten2, at(0.037, y, dt - w0 / 2 + 0.0225 + k * 0.075), [0.045, ph - 0.04, 0.03], { rotY: yaw, shadow: false });
        }
      // 柱の正面の区画の番号の板（暗い枠と、光る番号の帯）
      {
        const pl = Prop.at(sink, mats, onDrum(DRUM_R - 0.405, p0, bd.floor + 1.7), -p0, 320 + i);
        pl.box('#0e181e', [-0.17, -0.11, -0.01], [0.17, 0.11, 0.0], { shadow: false });
        pl.box('#3f6f86', [-0.13, 0.0, 0.0], [0.13, 0.07, 0.004], { kind: 'glow', shadow: false });
        pl.box('#8a7458', [-0.13, -0.07, 0.0], [-0.03, -0.02, 0.004], { kind: 'glow', shadow: false });
      }
      // 柱の壁付け灯（柱の前の面）と、そのまわりの壁の明るみ
      const sp = onDrum(DRUM_R - 0.41, p0, bd.sconceY);
      wallSconce(Prop.at(sink, mats, sp, -p0, 300 + i * 2 + bi));
      fx.glow(onDrum(DRUM_R - 0.415, p0, bd.sconceY), -p0, 0.9, 2.2, '#ffdcb4', 0.08);
      // 壁付け灯の光（壁ぎわの帯だけを照らす箱。カメラの画角の外の箱だけ）
      {
        const c = onDrum(DRUM_R - 1.0, p0, bd.floor + 1.6);
        const hx = 1.9;
        const hz = 1.0;
        const corners: V3[] = [];
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const yy of [bd.floor, bd.floor + 3.2]) corners.push(onDrum(DRUM_R - 1.0 + sz * hz, p0 + (sx * hx) / DRUM_R, yy));
        if (allUnseen(corners))
          ctx.addLamp({ pos: onDrum(DRUM_R - 0.6, p0, bd.sconceY - 0.2), radius: 3.4, intensity: 1.8, color: '#b4dcef', box: [c[0] - hx, bd.floor - 0.05, c[2] - hz, c[0] + hx, bd.floor + 3.2, c[2] + hz], yaw: -p0, shadow: 0 });
      }
      // 桟敷の下の壁は、桟敷の下面のダウンライトが壁を洗う（光の山形）。桟敷の上は天井が無いので付けない
      if (bi === 0) {
        fx.scallop(at(0.06, bd.y1 + 0.2), yaw, span * 0.8, bd.y1 + 0.2 - bd.floor - 0.1, '#7fc0dc', 0.05);
        fx.pool(at(0.7, bd.floor + 0.02), span * 0.34, 0.45, yaw, '#7fc0dc', 0.035);
      }
    }
    // 1 階の桟敷の下面の梁（柱ごとの放射の梁と、中ほどの輪の梁）。下から見る所だけ（カメラからは見えない面）
    {
      const R1 = l1R(pc);
      const ys = LOGE.l1 - 0.35;
      const mid = onDrum((R1 + DRUM_R) / 2, p0, ys - 0.09);
      if (allUnseen([onDrum(R1, p0, ys), onDrum(DRUM_R, p0, ys), onDrum(R1, p1, ys), onDrum(R1, pc, ys - 0.2)])) {
        b.box(m.pier, mid, [0.22, 0.18, DRUM_R - R1 - 0.45], { rotY: -p0, shadow: false });
        const rc = (R1 + DRUM_R) / 2;
        b.box(m.pier, onDrum(rc, pc, ys - 0.06), [(p1 - p0) * rc - 0.22, 0.12, 0.16], { rotY: -pc, shadow: false });
      }
    }
    // 上の壁の階の線の帯（蛇腹）
    for (const y of [LOGE.l2 + 0.2, 10.4]) {
      if (!allUnseen([at(0.05, y, -span / 2 - 0.4), at(0.05, y, span / 2 + 0.4)])) continue;
      b.box(m.pier, at(0.04, y), [span + 0.25, 0.14, 0.1], { rotY: yaw, shadow: false });
      b.box(m.pier, at(0.03, y - 0.12), [span + 0.25, 0.05, 0.06], { rotY: yaw, shadow: false });
    }
  }
  void CATWALK_Y;

  // ---------------------------------------------------------------- 壁ぎわの通路（桟敷の下・平土間の高さ）: 敷物と、席の側の縁の足もとの光の帯
  {
    const rug = new GeoBuf();
    const edge = new GeoBuf();
    const r0 = DRUM_R - 0.45;
    const r1 = DRUM_R - 1.15;
    const n = 720;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const c = (k + 1) / n * Math.PI * 2;
      const mid = onDrum((r0 + r1) / 2, (a + c) / 2, 0);
      if (floorY(mid[0], mid[2]) > 0.01 || floorY(...xzOf(onDrum(r1, (a + c) / 2, 0))) > 0.01) continue;
      if (!unseen(onDrum(r1, a, 0.02), 40) || !unseen(onDrum(r0, a, 0.02), 40) || !unseen(onDrum(r1, c, 0.02), 40)) continue;
      const y = 0.008;
      facing(rug, onDrum(r0, a, y), onDrum(r1, a, y), onDrum(r1, c, y), onDrum(r0, c, y), [mid[0], 5, mid[2]]);
      facing(edge, onDrum(r1 + 0.05, a, y + 0.002), onDrum(r1, a, y + 0.002), onDrum(r1, c, y + 0.002), onDrum(r1 + 0.05, c, y + 0.002), [mid[0], 5, mid[2]]);
    }
    if (!rug.empty) b.mesh(rug.build(), ctx.mat({ color: '#10293a', toon: 0, roughness: 1, line: 0, name: 'h-rug' }), [0, 0, 0], { shadow: 'receive' });
    if (!edge.empty) b.mesh(edge.build(), stepGlow, [0, 0, 0], { shadow: false });
  }

  // ---------------------------------------------------------------- 出入口（客席の側）
  for (const [list, y0] of [
    [DOORS.ground, 0],
    [DOORS.upper, LOGE.l1],
  ] as [number[], number][]) {
    list.forEach((deg, k) => {
      const ph = (deg * Math.PI) / 180;
      const half = DOORS.w / 2;
      const at = (dr: number, y: number, dt = 0): V3 => onDrum(DRUM_R - dr, ph + dt / DRUM_R, y0 + y);
      if (!allUnseen([at(0, 0, -half - 0.6), at(0, 0, half + 0.6), at(0, DOORS.h + 0.8, -half - 0.6), at(0, DOORS.h + 0.8, half + 0.6)])) return;
      // 額縁（両脇と上）
      for (const s of [-1, 1]) b.box(m.trim, at(0.03, DOORS.h / 2 + 0.06, s * (half + 0.09)), [0.18, DOORS.h + 0.12, 0.06], { rotY: -ph, shadow: false });
      b.box(m.trim, at(0.03, DOORS.h + 0.09), [DOORS.w + 0.36, 0.18, 0.06], { rotY: -ph, shadow: false });
      doorHeader(Prop.at(sink, mats, at(0.02, DOORS.h + 0.22), -ph, 400 + k), 2.4, 1 + (k % 5));
      exitSign(Prop.at(sink, mats, at(0.02, DOORS.h + 0.42, half + 0.75), -ph, 410 + k));
      fx.glow(at(0.025, DOORS.h + 0.45), -ph, 3.2, 1.0, '#9fd6f0', 0.06);
      // 遮光の幕（客席の側。両脇に束ねた厚い布のひだと留め紐・上の幕の竿）
      const cp = Prop.at(sink, mats, at(0.12, 0), -ph, 430 + k);
      cp.box('#1d2c35', [-half - 0.5, DOORS.h + 0.02, -0.03], [half + 0.5, DOORS.h + 0.07, 0.03], { shadow: false });
      for (const sg of [-1, 1]) {
        for (let f = 0; f < 6; f++) {
          const x = sg * (half + 0.06 + f * 0.065);
          const rr = f % 2 ? 0.03 : 0.042;
          cp.cyl(f % 2 ? '#1a2a36' : '#223646', [x, DOORS.h / 2, (f % 2) * 0.02], rr, DOORS.h - 0.04, { seg: 8, shadow: false });
        }
        cp.box('#6a5a40', [sg * (half + 0.03) - (sg > 0 ? 0 : 0.42), 1.05, -0.06], [sg * (half + 0.03) + (sg > 0 ? 0.42 : 0), 1.1, 0.07], { shadow: false });
      }
    });
  }

  // ---------------------------------------------------------------- 北西の段床: 段鼻の下の足もとの光の帯
  {
    const g = new GeoBuf();
    const da = 0.006;
    for (let a = TIERS.west.a0 + 0.02; a < TIERS.west.a1 - 0.02; a += da) {
      const t = tierAt(a + da / 2);
      if (!t) continue;
      const a1 = a + da;
      const rw = rWall(a);
      let yPrev = 0;
      for (const row of t.rows) {
        const r = t.start + row.d0 - 0.012;
        if (r >= rw - 0.3) break;
        const yTop = row.y - 0.035;
        const yBot = row.y - 0.05;
        if (yTop > yPrev) {
          const pa: V3 = [r * Math.sin(a), yBot, -r * Math.cos(a)];
          const pb: V3 = [r * Math.sin(a1), yBot, -r * Math.cos(a1)];
          if (unseen(pa, 40) && unseen(pb, 40)) facing(g, pa, pb, [pb[0], yTop, pb[2]], [pa[0], yTop, pa[2]], [0, row.y, 0]);
        }
        yPrev = row.y;
      }
    }
    if (!g.empty) b.mesh(g.build(), stepGlow, [0, 0, 0], { shadow: false });
  }

  // ---------------------------------------------------------------- 2 階の柱の回廊の床（カメラより上の床の上面は見えない）: 石の板の目地と、中ほどの敷物
  {
    const R2 = DRUM_R - LOGE.l2Depth;
    const y = LOGE.l2 + 0.004;
    const joints = new GeoBuf();
    const rug = new GeoBuf();
    const p0 = (LOGE.l2Phi[0] * Math.PI) / 180;
    const p1 = (LOGE.l2Phi[1] * Math.PI) / 180;
    const up: V3 = [0, 100, 0];
    const n = Math.round(((p1 - p0) * 180) / Math.PI) * 2;
    for (let k = 0; k < n; k++) {
      const a = p0 + ((p1 - p0) * k) / n;
      const c = p0 + ((p1 - p0) * (k + 1)) / n;
      // 輪の向きの目地（壁ぎわから 0.6 m おき）と敷物（柱の列と壁の間の中ほど 1.0 m）
      for (const r of [R2 + 0.6, DRUM_R - 0.45]) facing(joints, onDrum(r - 0.012, a, y), onDrum(r + 0.012, a, y), onDrum(r + 0.012, c, y), onDrum(r - 0.012, c, y), up);
      facing(rug, onDrum(R2 + 0.75, a, y + 0.004), onDrum(DRUM_R - 0.6, a, y + 0.004), onDrum(DRUM_R - 0.6, c, y + 0.004), onDrum(R2 + 0.75, c, y + 0.004), up);
    }
    // 放射の向きの目地（0.9 m おき）
    const m2 = Math.round(((p1 - p0) * (R2 + DRUM_R)) / 2 / 0.9);
    for (let k = 0; k <= m2; k++) {
      const a = p0 + ((p1 - p0) * k) / m2;
      const d = 0.012 / ((R2 + DRUM_R) / 2);
      facing(joints, onDrum(R2 + 0.1, a - d, y), onDrum(DRUM_R - 0.05, a - d, y), onDrum(DRUM_R - 0.05, a + d, y), onDrum(R2 + 0.1, a + d, y), up);
    }
    b.mesh(joints.build(), m.frame, [0, 0, 0], { shadow: false });
    b.mesh(rug.build(), ctx.mat({ color: '#14303f', toon: 0, roughness: 1, line: 0, name: 'h-l2-rug' }), [0, 0, 0], { shadow: 'receive' });
  }

  // ---------------------------------------------------------------- 塔の屋上の床の目地と点検口・投影機の台座の見えない側の面の目地
  {
    const { x0, x1, front, back, top } = HOUSE;
    const onPlinth = (x: number, z: number): boolean => x > -2.35 && x < 1.35 && z > -13.75 && z < -10.05;
    for (let x = x0 + 1.2; x < x1 - 0.1; x += 1.2)
      for (let z = back + 0.1; z < front - 0.1; z += 0.6) if (!onPlinth(x, z) && !onPlinth(x, z + 0.6)) b.boxMM(m.frame, [x - 0.01, top, z], [x + 0.01, top + 0.006, Math.min(z + 0.6, front - 0.05)], { shadow: false });
    for (let z = back + 1.2; z < front - 0.1; z += 1.2)
      for (let x = x0 + 0.05; x < x1 - 0.05; x += 0.5) if (!onPlinth(x, z) && !onPlinth(x + 0.5, z)) b.boxMM(m.frame, [x, top, z - 0.01], [Math.min(x + 0.5, x1 - 0.05), top + 0.006, z + 0.01], { shadow: false });
    // 点検口（低い立ち上がりと蓋）
    b.boxMM(m.pier, [x1 - 1.05, top, back + 0.25], [x1 - 0.25, top + 0.1, back + 1.05], { shadow: false });
    b.boxMM(m.frame, [x1 - 1.0, top + 0.1, back + 0.3], [x1 - 0.3, top + 0.13, back + 1.0], { shadow: false });
    // 台座の横と裏の面: 中ほどの目地と縦の目地（1.1 m おき）
    for (const [xa, sg] of [
      [-2.2, -1],
      [1.2, 1],
    ] as [number, number][]) {
      const xf = xa + sg * 0.004;
      b.boxMM(m.frame, [xf - 0.004, top + 0.33, -13.6], [xf + 0.004, top + 0.36, -10.2], { shadow: false });
      for (let z = -13.6 + 1.1; z < -10.3; z += 1.1) b.boxMM(m.frame, [xf - 0.004, top, z - 0.012], [xf + 0.004, top + 0.7, z + 0.012], { shadow: false });
    }
    b.boxMM(m.frame, [-2.2, top + 0.33, -13.604 - 0.004], [1.2, top + 0.36, -13.604 + 0.004], { shadow: false });
    for (let x = -2.2 + 1.1; x < 1.1; x += 1.1) b.boxMM(m.frame, [x - 0.012, top, -13.612], [x + 0.012, top + 0.7, -13.604], { shadow: false });
  }

  // ---------------------------------------------------------------- 舞台の裏の塔の横の面（カメラから見えない）
  {
    const { x0, x1, front, back, top } = HOUSE;
    for (const [x, sgn] of [
      [x0, -1],
      [x1, 1],
    ] as [number, number][]) {
      const xf = x + sgn * 0.006;
      // 目地の帯: 横 1.0 m おき・縦 1.2 m おき
      for (let y = 1.0; y < top - 0.1; y += 1.0) b.boxMM(m.frame, [xf - 0.004, y - 0.012, back], [xf + 0.004, y + 0.012, front - 0.3], { shadow: false });
      for (let z = back + 1.2; z < front - 0.4; z += 1.2) b.boxMM(m.frame, [xf - 0.004, 0, z - 0.012], [xf + 0.004, top, z + 0.012], { shadow: false });
      // 笠木（上の縁）
      b.boxMM(m.pier, [x + sgn * 0.0 - 0.06, top - 0.12, back - 0.06], [x + 0.06, top, front], { shadow: false });
      // 換気の格子と壁付けの灯り（屋上の手すりの下）
      const zc = (back + front) / 2;
      b.boxMM(m.frame, [xf - 0.02, top - 1.15, zc - 0.5], [xf + 0.02, top - 0.55, zc + 0.5], { shadow: false });
      for (let k = 0; k < 6; k++) b.boxMM(m.pier, [xf + sgn * 0.02 - 0.01, top - 1.1 + k * 0.1, zc - 0.46], [xf + sgn * 0.02 + 0.01, top - 1.07 + k * 0.1, zc + 0.46], { shadow: false });
      const lp: V3 = [x + sgn * 0.05, top - 0.35, zc + 1.6];
      wallSconce(Prop.at(sink, mats, lp, sgn > 0 ? Math.PI / 2 : -Math.PI / 2, 420));
      fx.glow([x + sgn * 0.012, top - 0.35, zc + 1.6], sgn > 0 ? Math.PI / 2 : -Math.PI / 2, 1.0, 2.0, '#ffdcb4', 0.09);
    }
  }
}

/**
 * 客席の通路の足もとの灯り（席の列の端の側板に付く小さな灯りと、通路の床の小さな光だまり）。
 * 列の端（通路・区画の端に面する席）ごとに 1 つ。参考画像のカメラの画角の外の席だけ
 */
export function buildAisleLights(b: Builder, ctx: SceneContext, fx: LightShapes, places: { x: number; z: number; y: number }[]): void {
  const sink = domeSink(b, ctx);
  const mats = domePropMats(ctx);
  // 列ごと（半径と高さ）に分け、角度の順に並べて隙間を見る
  const rows = new Map<string, { a: number; r: number; y: number }[]>();
  for (const p of places) {
    const r = Math.hypot(p.x, p.z);
    const key = `${Math.round(r * 20)}|${Math.round(p.y * 20)}`;
    let row = rows.get(key);
    if (!row) rows.set(key, (row = []));
    row.push({ a: Math.atan2(p.x, -p.z), r, y: p.y });
  }
  for (const row of rows.values()) {
    if (row.length < 2) continue;
    row.sort((u, v) => u.a - v.a);
    const steps = row.slice(1).map((s, i) => s.a - row[i].a).sort((u, v) => u - v);
    const step = steps[Math.floor(steps.length / 2)];
    const ends: { a: number; r: number; y: number; dir: number }[] = [];
    for (let i = 0; i < row.length; i++) {
      const prev = row[(i + row.length - 1) % row.length];
      const next = row[(i + 1) % row.length];
      const dPrev = (row[i].a - prev.a + Math.PI * 4) % (Math.PI * 2);
      const dNext = (next.a - row[i].a + Math.PI * 4) % (Math.PI * 2);
      if (dPrev > step * 1.6) ends.push({ ...row[i], dir: -1 });
      if (dNext > step * 1.6) ends.push({ ...row[i], dir: 1 });
    }
    for (const e of ends) {
      const t: [number, number] = [Math.cos(e.a), Math.sin(e.a)];
      const at = (dt: number, y: number): V3 => [e.r * Math.sin(e.a) + t[0] * dt * e.dir, e.y + y, -e.r * Math.cos(e.a) + t[1] * dt * e.dir];
      const lp = at(0.31, 0.28);
      if (!unseen(lp, 60) || !unseen(at(0.7, 0), 60)) continue;
      // 側板の灯り（暗い枠と、通路の側を向く光る面）
      const yaw = Math.atan2(t[0] * e.dir, t[1] * e.dir);
      const p = Prop.at(sink, mats, lp, yaw, 500);
      p.box('#0e181e', [-0.05, -0.03, -0.02], [0.05, 0.03, 0.0], { shadow: false });
      p.box('#d9b480', [-0.04, -0.02, 0.0], [0.04, 0.012, 0.004], { kind: 'glow', shadow: false });
      fx.pool(at(0.55, 0.012), 0.24, 0.32, -e.a, '#ffd9a8', 0.05);
    }
  }
}
