import * as THREE from 'three';
import type { Builder } from '../../scenes/Builder.ts';
import type { SceneContext } from '../../scenes/types.ts';
import { hColumn, instanced, strut, trs } from './kit.ts';
import { POLES, SHED, STOP, TRACK, Y } from './layout.ts';
import type { Mats } from './mats.ts';

type P2 = [number, number];

/**
 * 線路（道床・枕木・レール・締結の金具）・車止め・分岐・架線と架線柱・信号・遠景。
 * 線路は折れ線（x, z）。駅の中はまっすぐ、構外で分かれて曲がっていく（霧の向こう）
 */
export function buildTracks(b: Builder, ctx: SceneContext, mat: Mats): void {
  const sleeperM: THREE.Matrix4[] = [];
  const clipM: THREE.Matrix4[] = [];
  const sleeperGeo = new THREE.BoxGeometry(2.0, 0.14, 0.22);

  /** 折れ線の線路。ballast = 道床の材質、rail = レールの側面の材質（使っていない線は錆） */
  const track = (pts: P2[], ballast: THREE.Material = mat.ballast, o: { rail?: THREE.Material; railTop?: THREE.Material; bed?: boolean } = {}): void => {
    const railM = o.rail ?? mat.rail;
    const topM = o.railTop ?? mat.railTop;
    let carry = 0.3;
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x0, z0] = pts[i];
      const [x1, z1] = pts[i + 1];
      const dx = x1 - x0;
      const dz = z1 - z0;
      const len = Math.hypot(dx, dz);
      const ux = dx / len;
      const uz = dz / len;
      // 進む向きの y 回りの角（箱の長手を z に置いたときの回転）
      const ry = Math.atan2(ux, uz);
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      const straight = Math.abs(dx) < 1e-6;
      const ext = straight ? 0 : 0.6; // 曲がり角の継ぎ目を隠す
      if (o.bed !== false) {
        if (straight) b.boxMM(ballast, [x0 - 2.1, Y.ground - 0.1, Math.min(z0, z1)], [x0 + 2.1, Y.ballast - 0.02, Math.max(z0, z1)], { shadow: false });
        else b.box(ballast, [cx, (Y.ground - 0.1 + Y.ballast - 0.02) / 2, cz], [4.2, Y.ballast - 0.02 - Y.ground + 0.1, len + ext], { rotY: ry, shadow: false });
      }
      for (const s of [-1, 1]) {
        // レールの位置（進む向きに直角）
        const ox = uz * s * (TRACK.gauge / 2);
        const oz = -ux * s * (TRACK.gauge / 2);
        if (straight) {
          const rx = x0 + ox;
          b.boxMM(railM, [rx - 0.035, Y.ballast, Math.min(z0, z1)], [rx + 0.035, Y.rail - 0.012, Math.max(z0, z1)], { shadow: false });
          b.boxMM(topM, [rx - 0.033, Y.rail - 0.012, Math.min(z0, z1)], [rx + 0.033, Y.rail, Math.max(z0, z1)], { shadow: false });
        } else {
          b.box(railM, [cx + ox, (Y.ballast + Y.rail - 0.012) / 2, cz + oz], [0.07, Y.rail - 0.012 - Y.ballast, len + 0.05], { rotY: ry, shadow: false });
          b.box(topM, [cx + ox, Y.rail - 0.006, cz + oz], [0.066, 0.012, len + 0.05], { rotY: ry, shadow: false });
        }
      }
      // 枕木と締結の金具（0.6 m おき）
      let t = carry;
      for (; t < len; t += 0.6) {
        const px = x0 + ux * t;
        const pz = z0 + uz * t;
        // 遠い所（駅から 160 m より先）は枕木だけ（締結の金具は霧で見えない）
        if (Math.hypot(px + 30, pz) > 260) continue;
        sleeperM.push(trs(px, Y.ballast - 0.07, pz, ry));
        if (Math.hypot(px + 30, pz - 10) > 160) continue;
        for (const s of [-1, 1]) {
          const rx = px + uz * s * (TRACK.gauge / 2);
          const rz = pz - ux * s * (TRACK.gauge / 2);
          for (const d of [-0.09, 0.09]) clipM.push(trs(rx + uz * d, Y.ballast + 0.02, rz - ux * d, ry, 1, 1, 1));
        }
      }
      carry = t - len;
    }
  };
  /** 車止め（レールを曲げて立ち上げた枠と横木・赤白の板）。dir = 線路の終わる向き（+1 = +z 側が終わり） */
  const bufferStop = (x: number, z: number, dir: number): void => {
    const zz = z;
    for (const s of [-1, 1]) {
      const rx = x + s * (TRACK.gauge / 2);
      strut(b, mat.rail, [rx, Y.ballast, zz - dir * 1.6], [rx, Y.ballast + 0.95, zz], 0.08, 0.08);
      b.box(mat.rail, [rx, Y.ballast + 0.5, zz], [0.08, 1.0, 0.08]);
    }
    b.box(mat.wood, [x, Y.ballast + 0.88, zz], [1.9, 0.26, 0.22], { collide: true });
    b.box(mat.redLit, [x, Y.ballast + 0.88, zz - dir * 0.12], [0.5, 0.2, 0.01]);
    b.box(mat.signWhite, [x - 0.4, Y.ballast + 0.88, zz - dir * 0.12], [0.3, 0.2, 0.01]);
    b.box(mat.signWhite, [x + 0.4, Y.ballast + 0.88, zz - dir * 0.12], [0.3, 0.2, 0.01]);
  };

  // ---------- 本線（電化複線・北から。1・2 番線は B・C の前の車止めで終わる） ----------
  const zNorth = -330;
  track([[TRACK.t1, zNorth], [TRACK.t1, STOP.t12]], mat.ballastA);
  track([[TRACK.t2, zNorth], [TRACK.t2, STOP.t12]], mat.ballastA);
  // 渡り線（構外の北。霧の向こう）
  track([[TRACK.t2, -150], [TRACK.t1, -122]], mat.ballastA, { bed: false });
  // 車止め（元の版と同じ箱。station-3 で B・C の前に見える）
  for (const x of [TRACK.t1, TRACK.t2]) {
    b.boxMM(mat.steel, [x - 0.9, Y.ballast, STOP.t12], [x + 0.9, Y.ballast + 0.9, STOP.t12 + 0.3], { collide: true });
  }

  // ---------- 支線（非電化・南から。3・4 番線は南西線、5・6 番線は南東線） ----------
  for (const s of [-1, 1]) {
    const xo = s * Math.abs(TRACK.t3);
    const xi = s * Math.abs(TRACK.t4);
    const xm = s * 8.8;
    track([[xo, STOP.t36], [xo, 105], [s * 10.6, 132], [xm, 150]]);
    track([[xi, STOP.t45], [xi, 112], [s * 7.2, 138], [xm, 150]]);
    // 合わさった後、南西・南東へ曲がる
    track([[xm, 150], [s * 11, 205], [s * 30, 280], [s * 70, 350], [s * 130, 420]]);
    bufferStop(xo, STOP.t36, -1);
    bufferStop(xi, STOP.t45, -1);
  }

  // ---------- 0 番線（西線。D の北端の車止めから南へ出て西へ曲がる）・7 番線（旧貨物側線・錆びている） ----------
  track([[TRACK.t0, STOP.t0], [TRACK.t0, 72], [-72.5, 105], [-80, 150], [-100, 205], [-140, 270], [-200, 340]]);
  bufferStop(TRACK.t0, STOP.t0, -1);
  track([[TRACK.t7, STOP.t7], [TRACK.t7, 50], [-73.6, 60], [-71.6, 68]], mat.ballast, { rail: mat.railRust, railTop: mat.railRust });
  bufferStop(TRACK.t7, STOP.t7, -1);

  instanced(b.root, sleeperGeo, mat.sleeper, sleeperM);
  instanced(b.root, new THREE.BoxGeometry(0.09, 0.05, 0.12), mat.clip, clipM);

  // ---------- 架線柱（A の北。元の版と同じ。構内は 18 m おき） ----------
  for (let i = 0; i < POLES.n; i++) {
    const z = POLES.z0 - i * POLES.step;
    for (const s of [-1, 1]) {
      const off = s > 0 ? 0.9 : 0;
      const xo = s * (POLES.x + 0.4 + off);
      const xi = s * (POLES.x - 0.8 + off);
      hColumn(b, mat.steel, xo, z, Y.ground, 5.4, 0.3, 0.3);
      hColumn(b, mat.steel, xi, z, Y.ground, 4.7, 0.22, 0.22);
      b.box(mat.pedestal, [xo, Y.ground + 0.3, z], [0.7, 0.6, 0.7]);
      b.boxMM(mat.steel, [Math.min(xo, s * 4.8), 5.25, z - 0.1], [Math.max(xo, s * 4.8), 5.45, z + 0.1]);
      strut(b, mat.steel, [xi, 3.4, z], [s * 5.2, 4.6, z], 0.08, 0.08);
      strut(b, mat.steel, [xi, 4.0, z], [s * 5.0, 3.95, z], 0.07, 0.07);
      if (z > -100) ctx.colliders.addCentered(xo, 0, z, 0.7, 3, 0.7);
    }
  }
  // 構外（50 m おき。霧の向こう）
  for (let z = POLES.z0 - POLES.n * POLES.step - 32; z > zNorth; z -= 50) {
    for (const s of [-1, 1]) {
      const xo = s * (POLES.x + 0.4 + (s > 0 ? 0.9 : 0));
      hColumn(b, mat.steel, xo, z, Y.ground, 5.4, 0.3, 0.3);
      b.boxMM(mat.steel, [Math.min(xo, s * 4.8), 5.25, z - 0.1], [Math.max(xo, s * 4.8), 5.45, z + 0.1]);
    }
  }
  // 架線（1・2 番線の上）: 吊架線・トロリ線・ハンガー。大屋根の下は低い架線（屋根の梁から吊る）で、大屋根の南の端で終わる
  const zA = zNorth;
  const zB = SHED.z0 + 2;
  const zEnd = SHED.z1 - 0.8;
  for (const x of [TRACK.t1, TRACK.t2]) {
    b.boxMM(mat.wire, [x - 0.012, 5.3, zA], [x + 0.012, 5.324, zB]);
    b.boxMM(mat.wire, [x - 0.012, 4.1, zA], [x + 0.012, 4.12, zEnd]);
    for (let z = zB - 2; z > zA; z -= 4.5) b.boxMM(mat.wire, [x - 0.006, 4.12, z - 0.006], [x + 0.006, 5.3, z + 0.006]);
    // 大屋根の下: 吊架線は梁のすぐ下（4.38）、終端は梁へ斜めに引き留める
    strut(b, mat.wire, [x, 5.3, zB], [x, 4.38, zB + 3], 0.024, 0.024);
    b.boxMM(mat.wire, [x - 0.012, 4.37, zB + 3], [x + 0.012, 4.39, zEnd]);
    for (let z = zB + 4; z < zEnd; z += 3) b.boxMM(mat.wire, [x - 0.006, 4.12, z - 0.006], [x + 0.006, 4.37, z + 0.006]);
    b.box(mat.steel, [x, 4.25, zEnd], [0.08, 0.3, 0.08]);
  }
  for (const sx of [-1, 1]) {
    for (const [dx, y] of [[0.0, 5.55], [-0.6, 5.2], [0.5, 5.35]] as const) {
      const x = sx * (POLES.x + 0.4 + dx);
      b.boxMM(mat.wire, [x - 0.012, y, zA], [x + 0.012, y + 0.024, zB]);
    }
  }
  for (let i = 0; i < POLES.n; i++) {
    const z = POLES.z0 - i * POLES.step;
    for (const sx of [-1, 1]) {
      const xi = sx * (POLES.x - 0.8);
      b.box(mat.steel, [xi - sx * 0.15, 2.8, z], [0.22, 0.4, 0.22]);
      b.box(mat.steel, [xi - sx * 0.15, 3.6, z], [0.18, 0.25, 0.18]);
      b.box(mat.steel, [sx * 5.3, 4.95, z], [0.12, 0.3, 0.12]);
    }
  }

  // ---------- 信号（出発信号機: A の北端の先、1・2 番線の外側。北へ出る電車に向く） ----------
  for (const s of [-1, 1]) {
    const x = s * 7.6;
    const z = -92;
    b.box(mat.poleConc, [x, Y.ground + 2.6, z], [0.22, 5.2, 0.22]);
    b.box(mat.black, [x, Y.ground + 4.6, z + 0.15], [0.42, 1.1, 0.12]);
    for (let k = 0; k < 3; k++) b.box(k === 2 ? mat.redLit : mat.black, [x, Y.ground + 4.25 + k * 0.33, z + 0.22], [0.18, 0.18, 0.02]);
    b.box(mat.steel, [x, Y.ground + 4.6, z + 0.33], [0.5, 0.04, 0.3]);
  }

  // 0 番線の出発信号機（D の北、西線へ出る気動車に向く。station-0 の後ろ）
  {
    const x = TRACK.t0 - 2.2;
    const z = -14;
    b.box(mat.poleConc, [x, Y.ground + 2.2, z], [0.2, 4.4, 0.2]);
    b.box(mat.black, [x, Y.ground + 3.9, z + 0.14], [0.4, 0.95, 0.1]);
    for (let k = 0; k < 2; k++) b.box(k === 1 ? mat.redLit : mat.black, [x, Y.ground + 3.65 + k * 0.38, z + 0.2], [0.17, 0.17, 0.02]);
    b.box(mat.board, [x, Y.ground + 2.6, z + 0.12], [0.3, 0.3, 0.02]);
  }

  // ---------- 遠くの建物（霧の向こう） ----------
  const shed = (x: number, z: number, w: number, d: number, h: number): void => {
    b.boxMM(mat.far, [x - w / 2, Y.ground, z - d / 2], [x + w / 2, Y.ground + h, z + d / 2]);
  };
  shed(-75, -150, 60, 14, 6);
  shed(-130, -170, 40, 12, 5);
  shed(85, -160, 50, 16, 7);
  shed(140, -190, 30, 12, 5);
  // station-2 の背景（東の野原の遠く）: 腕木のある柱・送電線の鉄塔・小屋・細い柱
  const lattice = (x: number, z: number, h: number, w: number): void => {
    for (const dx of [-w / 2, w / 2]) for (const dz of [-w / 2, w / 2]) strut(b, mat.far, [x + dx * 1.6, Y.ground, z + dz * 1.6], [x + dx * 0.5, Y.ground + h, z + dz * 0.5], 0.12, 0.12);
    for (let y = 0.9; y < h - 0.3; y += 1.3) b.box(mat.far, [x, Y.ground + y, z], [w * (1.6 - (y / h) * 1.1), 0.1, w * (1.6 - (y / h) * 1.1)]);
    b.box(mat.far, [x, Y.ground + h + 0.4, z], [w * 1.3, 0.8, w * 1.3]);
  };
  b.box(mat.far, [76.3, (Y.ground + 12.6) / 2, 8.5], [0.4, 12.6 - Y.ground, 0.4]);
  b.box(mat.far, [76.3, 11.3, 9.1], [0.25, 0.25, 3.2]);
  b.box(mat.far, [76.3, 10.0, 8.8], [0.6, 1.0, 0.7]);
  lattice(96.3, 2.5, 11.0, 1.6);
  lattice(116.3, 12.3, 10.5, 1.6);
  b.boxMM(mat.far, [123, Y.ground, -21.9], [129, Y.ground + 4.6, -15.5]);
  b.box(mat.far, [86.3, (Y.ground + 8.7) / 2, 97.7], [0.25, 8.7 - Y.ground, 0.25]);

  // 北の地平線の倉庫と電柱（station-1 の参考画像の地平線の影）。遠いので霧を薄く掛けて影だけ残す（薄さは場所ごと）
  {
    const zF = -230;
    const g = Y.ground;
    b.boxMM(mat.farHaze, [-204, g, zF - 20], [-126, 6.6, zF]);
    b.boxMM(mat.farHaze, [-128, g, zF - 14], [-106, 7.2, zF + 4]);
    b.boxMM(mat.farHaze, [119, g, zF - 24], [260, 5.8, zF]);
    b.boxMM(mat.farHaze, [167, g, zF - 18], [187, 10.0, zF - 2]);
    b.boxMM(mat.farHaze, [60, g, zF - 30], [100, 4.5, zF - 10]);
    for (const x of [-198, -169, -163, -137]) {
      b.box(mat.farHaze, [x, (g + 12.3) / 2, zF + 10], [0.5, 12.3 - g, 0.5]);
      b.box(mat.farHaze, [x, 11.8, zF + 10], [3.2, 0.3, 0.3]);
    }
    for (const x of [77, 96, 120, 148, 185]) {
      b.box(mat.farHaze, [x, (g + 8.1) / 2, zF], [0.4, 8.1 - g, 0.4]);
      b.box(mat.farHaze, [x, 7.7, zF], [2.4, 0.25, 0.25]);
    }
  }
}
