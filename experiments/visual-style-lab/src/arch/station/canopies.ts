import type { Builder, V3 } from '../../scenes/Builder.ts';
import type { SceneContext } from '../../scenes/types.ts';
import { BoxBatch, underside } from './canopy.ts';
import { haunch, hColumn, pipe, strut } from './kit.ts';
import { SHED, TCAN, Y } from './layout.ts';
import { stationMat } from './mat.ts';
import type { Mats } from './mats.ts';
import type { Tube } from './glow.ts';

/**
 * 上屋（元の版と同じ形）: 大屋根（station-1）・中央柱の上屋（station-3）・映り込みにだけ出る上屋の続き・B と C の小さな上屋。
 * 置き場所は参考画像の視点から測った元の版の値のまま（建築版でも視点の見え方を変えない）
 */
export interface CanopyBatches {
  canDark: BoxBatch;
  canLite: BoxBatch;
  shedDark: BoxBatch;
  shedLite: BoxBatch;
  bcDark: BoxBatch;
  bcLite: BoxBatch;
}

export function buildCanopies(
  b: Builder,
  ctx: SceneContext,
  mat: Mats,
  tubes: Tube[],
  addTube: (c: V3, len: number, along: 'x' | 'z', w: number, h?: number, round?: boolean) => void,
): CanopyBatches {
  const M = stationMat;
  const canDark = new BoxBatch();
  const canLite = new BoxBatch();
  const shedDark = new BoxBatch();
  const shedLite = new BoxBatch();
  const bcDark = new BoxBatch();
  const bcLite = new BoxBatch();
  // ---------- 大屋根（station-1・A の中ほど） ----------
  {
    const z0 = SHED.z0;
    const z1 = SHED.z1;
    const H = SHED.soffit;
    b.boxMM(mat.roof, [-SHED.half, H + 0.3, z0 - 0.2], [SHED.half, H + 0.5, z1]);
    // 前の鼻先（梁）
    b.boxMM(mat.frontS, [-SHED.half, H - 0.02, z0 - 0.2], [SHED.half, H + 0.5, z0 + 0.1]);
    // 横の梁（3 m おき）と細い母屋（1 m おき）
    for (let z = z0 + 3; z < z1; z += 3) b.boxMM(mat.beam, [-SHED.colX, H, z - 0.12], [SHED.colX, H + 0.3, z + 0.12]);
    for (let z = z0 + 1; z < z1; z += 1) b.boxMM(mat.beam, [-SHED.colX, H + 0.2, z - 0.04], [SHED.colX, H + 0.3, z + 0.04]);
    // 縦の母屋
    for (const x of [-7.5, -4.6, -1.6, 1.6, 4.6, 7.5]) b.boxMM(mat.beam, [x - 0.08, H + 0.15, z0], [x + 0.08, H + 0.3, z1]);
    // 門形の骨組み（柱は線路の外の地面に立つ。参考画像に合わせて右は少し外）
    for (const z of [z0, (z0 + z1) / 2, z1]) {
      for (const s of [-1, 1]) {
        const x = s < 0 ? -SHED.colX : SHED.colX + 0.45;
        hColumn(b, s < 0 ? mat.shedColL : mat.shedCol, x, z, Y.ground + 0.45, H + 0.3, s < 0 ? 0.34 : 0.26, 0.3);
        b.box(mat.pedestal, [x, Y.ground + 0.22, z], [0.9, 0.45, 0.9], { collide: true });
        ctx.colliders.addCentered(x, 1.5, z, 0.4, 5, 0.4);
        // 左（西）は柱から梁へ曲がって伸びる方杖（アーチ形）、右（東）はまっすぐな方杖。梁は柱の外まで延びる
        if (s < 0) {
          strut(b, mat.shedCol, [x + 0.1, 3.4, z], [x + 2.2, H - 0.05, z], 0.3, 0.38);
          haunch(b, mat.shedCol, x - s * 0.17, -s, z, 3.2, 0.5, 0.45, 3.9, 0.3);
        } else strut(b, mat.shedCol, [x - 0.1, 3.45, z], [x - 1.4, H - 0.05, z], 0.16, 0.2);
        b.boxMM(mat.beam, [Math.min(x + s * 0.6, s * 6.5), H - 0.1, z - 0.15], [Math.max(x + s * 0.6, s * 6.5), H + 0.5, z + 0.15]);
      }
    }
    // 蛍光灯（2 列）
    for (const x of [-3.5, 3.75]) {
      for (let z = z0 + 0.2; z < z1 - 1; z += 2.65) {
        b.box(mat.housing, [x, H - 0.02, z], [0.34, 0.1, 1.45], { shadow: false });
        addTube([x, H - 0.1, z], 1.25, 'z', 0.2, 0.04, true);
        // 器具の端の明るい箱
        b.box(mat.board, [x, H - 0.06, z + 0.68], [0.36, 0.12, 0.12], { shadow: false });
      }
    }
    // 下面の細部: 波板の筋・ケーブルラック・配管・吊り下げの箱（空調・配電）・吊り金具
    underside({
      x0: -SHED.colX, x1: SHED.colX, z0: z0 + 0.2, z1, y: H + 0.3, along: 'z',
      rib: [0.25, 0.06],
      trays: [[0.7, 0.25, 0.35], [-5.9, 0.2, 0.3]],
      pipes: [[-2.6, 0.18, 0.06], [2.45, 0.22, 0.05], [6.1, 0.15, 0.08]],
      boxes: { n: 14, size: [0.25, 0.6], drop: [0.05, 0.3], lanes: [-2.4, 0.4, 2.0, 5.5, -6.5] },
      hangers: 0.9,
      seed: 11,
    }, shedDark, shedLite);
    shedDark.box([1.9, H - 0.05, -7.0], [1.0, 0.45, 0.9]);
    shedDark.box([1.0, H - 0.0, -6.6], [1.6, 0.2, 0.25]);
    // 吊り下げの案内（前の鼻先）と、鼻先の下の丸い器具
    for (const x of [-3.45, 3.9]) {
      b.box(mat.frontS, [x, 4.2, z0 + 0.25], [1.07, 0.28, 0.08], { shadow: false });
      for (const dx of [-0.4, 0.4]) b.box(mat.steel, [x + dx, 4.4, z0 + 0.25], [0.02, 0.12, 0.02]);
    }
    for (const x of [-1.9, -1.2, -0.3, 0.5, 1.1, 2.4]) b.cyl(mat.beam, [x, H - 0.12, z0 + 0.0], 0.13, 0.2, { segments: 10 });
    // 左の柱の脇の格子の柱と信号の箱、右の柱の信号
    {
      const x = -9.2;
      const z = z0 + 0.8;
      for (const dx of [-0.07, 0.07]) b.box(mat.lattice, [x + dx, 1.25, z], [0.04, 4.8, 0.04]);
      for (let y = Y.ground; y < 3.6; y += 0.32) strut(b, mat.lattice, [x - 0.07, y, z], [x + 0.07, y + 0.32, z], 0.02, 0.02);
      b.box(mat.sign, [-9.95, 1.0, z0 + 0.15], [0.45, 0.55, 0.3]);
      b.box(mat.signal, [-10.35, 0.15, z0 + 0.25], [0.12, 0.3, 0.05]);
      b.box(mat.sign, [10.5, 1.0, z0 + 0.2], [0.25, 0.3, 0.25]);
      b.box(mat.sign, [10.55, 2.35, z0 + 0.2], [0.25, 0.3, 0.25]);
    }
  }

  // ---------- 中央柱の上屋（station-3） ----------
  // 屋根・梁・器具・柱は床に映る（真上の暗い屋根が足元の床を暗くし、端の水たまりは外の空を映す）
  {
    const z0 = TCAN.z0;
    const z1 = TCAN.z1;
    const L1 = {} as const;
    // 中央の梁と、外へ上がる V 字の屋根
    b.boxMM(mat.beamT, [-0.35, TCAN.center - 0.35, z0], [0.35, TCAN.center + 0.05, z1], L1);
    for (const s of [-1, 1]) {
      strut(b, mat.roofT, [0, TCAN.center + 0.05, (z0 + z1) / 2], [s * TCAN.half, TCAN.edge + 0.04, (z0 + z1) / 2], z1 - z0, 0.14, L1);
      // 鼻先（樋）
      b.boxMM(mat.beamT, [s > 0 ? TCAN.half - 0.1 : -TCAN.half, TCAN.edge - 0.18, z0], [s > 0 ? TCAN.half : -TCAN.half + 0.1, TCAN.edge + 0.14, z1], L1);
      // 鼻先から下がる L 字の管（鼻先の下から下がり、内へ曲がる）
      for (let z = z0 + 6.4; z < z1 - 0.5; z += 4.15) {
        const x = s * (TCAN.half - 0.12);
        const H = TCAN.edge - 0.15;
        pipe(b, mat.hookT, [
          [x, H, z],
          [x + s * 0.02, H - 0.3, z],
          [x - s * 0.12, H - 0.42, z],
          [x - s * 0.6, H - 0.43, z],
          [x - s * 1.0, H - 0.43, z],
        ], 0.03, L1);
        b.box(mat.hookT, [x - s * 1.0, H - 0.52, z], [0.05, 0.18, 0.05], L1);
      }
      // 屋根の下の横の小梁と、長手の梁 2 本
      for (let z = z0 + 2; z < z1; z += 4.0) strut(b, mat.beamT, [0, TCAN.center - 0.1, z], [s * (TCAN.half - 0.1), TCAN.edge - 0.12, z], 0.12, 0.22, L1);
      for (const f of [0.3, 0.55]) {
        const x = s * TCAN.half * f;
        const yy = TCAN.center + (TCAN.edge - TCAN.center) * f - 0.12;
        b.boxMM(mat.beamT, [x - 0.07, yy - 0.2, z0], [x + 0.07, yy + 0.1, z1], L1);
      }
    }
    // 屋根の下面の細部（斜めの面に沿って、ケーブルと配管・吊り金具）
    for (const s of [-1, 1]) {
      for (const [f, t] of [[0.18, 0.05], [0.5, 0.035], [0.86, 0.04]] as const) {
        const x = s * TCAN.half * f;
        const yy = TCAN.center + (TCAN.edge - TCAN.center) * f - 0.22;
        canDark.box([x, yy, (z0 + z1) / 2], [t, t, z1 - z0 - 0.4]);
      }
      for (let z = z0 + 0.9; z < z1; z += 1.3) {
        const f = 0.2 + ((z * 7.31) % 1) * 0.6;
        const x = s * TCAN.half * f;
        const yy = TCAN.center + (TCAN.edge - TCAN.center) * f - 0.1;
        canDark.box([x, yy - 0.12, z], [0.02, 0.24, 0.02]);
        canLite.box([x, yy - 0.26, z], [0.07, 0.05, 0.05]);
      }
    }
    // 柱（細く暗い）。奥の柱だけ方杖
    for (const z of [20.5, 28.5, 36.4]) {
      hColumn(b, mat.columnT, 0, z, Y.top, TCAN.center - 0.35, 0.15, 0.15);
      ctx.colliders.addCentered(0, 1.5, z, 0.25, 3, 0.25);
    }
    for (const s of [-1, 1]) strut(b, mat.beamT, [0, 2.3, 36.4], [s * 1.3, 2.85, 36.4], 0.1, 0.1, L1);
    // 吊り下げの箱（配電盤）2 つと、その配線
    b.boxMM(mat.beamT, [-0.95, 2.85, 19.0], [-0.1, 3.42, 20.2], L1);
    b.boxMM(mat.beamT, [-1.8, 2.3, 23.6], [-0.25, 3.35, 25.0], L1);
    for (const x of [-1.6, -0.5]) b.box(mat.beamT, [x, 3.45, 24.3], [0.04, 0.3, 0.04], L1);
    // 端の鼻先
    for (const s of [-1, 1]) strut(b, mat.beamT, [0, TCAN.center - 0.1, z1 - 0.05], [s * TCAN.half, TCAN.edge, z1 - 0.05], 0.1, 0.3, L1);
    // 端の深い垂れ壁と、その下の機器の箱・梁（station-3 で中央の奥が暗く見える所）
    b.boxMM(mat.endT, [-3.8, 2.65, z1 - 0.3], [3.0, TCAN.center, z1 - 0.1], L1);
    b.boxMM(mat.endT, [-3.0, 2.4, z1 - 1.6], [-1.1, 2.65, z1 - 0.3], L1);
    b.boxMM(mat.endT, [0.6, 2.75, z1 - 2.6], [2.4, 2.95, z1 - 0.3], L1);
    // 蛍光灯（2 本ずつの器具）
    for (const x of [-2.95, 2.95]) {
      for (let z = 21.4; z < z1 - 0.8; z += 4.15) {
        b.box(mat.housingT, [x, 3.66, z], [0.34, 0.06, 1.7], { shadow: false });
        for (const dx of [-0.08, 0.08]) {
          b.box(mat.tubeT, [x + dx, 3.6, z], [0.05, 0.04, 1.55], { shadow: false });
        }
        tubes.push({ c: [x, 3.6, z], axis: [0, 0, 1], len: 1.55 });
      }
    }
  }

  // ---------- 映り込みだけに出る上屋の続き（layer 2） ----------
  // station-3 の床の水には、奥まで続く暗い屋根が映る（参考の絵）。本当の上屋は z = 37 で終わるので、
  // その先は映り込みだけに出す。B・C の上屋と重ならないよう、z = 46 より先は中央の細い帯だけ。
  // 上屋の端より先へ歩くと消える（見上げても無い屋根が足元に映らないように）
  {
    const ghost = M({
      color: '#183444', unlit: true, fogMul: 0.7, transparent: true, depthWrite: true,
      fragAlbedo: '  alpha *= smoothstep(36.0, 28.0, cameraPosition.z);',
    });
    const P = { layer: 2, shadow: false } as const;
    const zA = TCAN.z1;
    const zB = 46;
    const zC = 150;
    for (const s of [-1, 1]) {
      strut(b, ghost, [0, TCAN.center + 0.05, (zA + zB) / 2], [s * TCAN.half, TCAN.edge + 0.04, (zA + zB) / 2], zB - zA, 0.14, P);
      b.boxMM(ghost, [s > 0 ? TCAN.half - 0.1 : -TCAN.half, TCAN.edge - 0.18, zA], [s > 0 ? TCAN.half : -TCAN.half + 0.1, TCAN.edge + 0.14, zB], P);
      const f = 1.9 / TCAN.half;
      strut(b, ghost, [0, TCAN.center + 0.05, (zB + zC) / 2], [s * 1.9, TCAN.center + (TCAN.edge - TCAN.center) * f + 0.04, (zB + zC) / 2], zC - zB, 0.14, P);
    }
    b.boxMM(ghost, [-0.35, TCAN.center - 0.35, zA], [0.35, TCAN.center + 0.05, zC], P);
  }

  // ---------- B・C の小さな上屋（station-2・station-3） ----------
  // 中央の柱 1 本で支える平らな屋根（下面 3.56・鼻先の上 3.68。station-2 の視点から測った）。鼻先は薄く暗い帯。
  // 屋根は線路の上へ張り出す（A の側へ 1.9 m）。待合の小屋は北側、南側に券売機と案内の柱
  for (const s of [-1, 1]) {
    const cx = s * 6.55;
    const cz = 51.4;
    const RU = 3.56;
    const RT = 3.68;
    const rx0 = s < 0 ? -10.1 : 2.0;
    const rx1 = s < 0 ? -2.0 : 10.1;
    const z0 = 46.5;
    const z1 = 56.05;
    // 柱: 細く暗い幹（下は少し太い台座）。高さで明るさが変わる（床の近くと屋根の下が暗い）。
    // 幹から屋根へ斜めに上がる方杖が 4 方向に 2 本ずつ、頭は屋根の下面へ広がる暗い逆さの角錐
    b.box(mat.columnBase, [cx, 0.6, cz], [0.6, 1.2, 0.6], { collide: true });
    b.box(mat.columnBase, [cx, 1.22, cz], [0.64, 0.05, 0.64]);
    b.box(mat.columnB, [cx, (1.2 + RU) / 2, cz], [0.36, RU - 1.2, 0.36], { collide: true });
    // 幹の角の細い縁（左の明るい筋）
    b.box(mat.columnEdge, [cx - 0.17, (1.25 + RU) / 2, cz - 0.17], [0.03, RU - 1.25, 0.03]);
    b.cyl(mat.bcFunnel, [cx, RU - 0.3, cz], 0.28, 0.6, { radiusTop: 1.5, segments: 4, rotY: Math.PI / 4 });
    for (const d of [-1, 1]) {
      strut(b, mat.columnB, [cx, 2.1, cz], [cx + d * 2.2, RU - 0.06, cz], 0.12, 0.16);
      strut(b, mat.columnB, [cx, 2.35, cz], [cx, RU - 0.06, cz + d * 1.9], 0.12, 0.16, { up: [1, 0, 0] });
      strut(b, mat.columnB, [cx, 2.75, cz], [cx, RU - 0.06, cz + d * 2.8], 0.08, 0.1, { up: [1, 0, 0] });
    }
    // 屋根の板と、まわりの薄い鼻先
    b.boxMM(mat.roofB, [rx0, RU, z0], [rx1, RT - 0.03, z1]);
    // 北と南の鼻先は明るい（station-3 から見える面）、東西の鼻先は暗い（station-2 から見える面）
    b.boxMM(mat.fasciaN, [rx0 - 0.04, RU - 0.02, z0 - 0.04], [rx1 + 0.04, RT, z0 + 0.04]);
    b.boxMM(mat.fasciaN, [rx0 - 0.04, RU - 0.02, z1 - 0.04], [rx1 + 0.04, RT, z1 + 0.04]);
    b.boxMM(mat.beamB, [rx0 - 0.04, RU - 0.02, z0], [rx0 + 0.04, RT, z1]);
    b.boxMM(mat.beamB, [rx1 - 0.04, RU - 0.02, z0], [rx1 + 0.04, RT, z1]);
    // 両端（妻側）の深い垂れ壁
    for (const z of [z0 + 0.05, z1 - 0.05]) b.boxMM(mat.bcValance, [rx0, RU - 0.48, z - 0.05], [rx1, RU, z + 0.05]);
    // 下面の細部: 横の小梁・長手の梁・配線・吊り下げの箱
    underside({
      x0: rx0 + 0.1, x1: rx1 - 0.1, z0: z0 + 0.1, z1: z1 - 0.1, y: RU, along: 'z',
      rib: [0.0, 0.0],
      beams: [[cx, 0.3, 0.3], [cx - 2.4, 0.16, 0.1], [cx + 2.4, 0.16, 0.1], [rx0 + 0.6, 0.12, 0.08], [rx1 - 0.6, 0.12, 0.08]],
      cross: [[z0 + 0.6, 0.18, 0.1], [z0 + 2.9, 0.18, 0.1], [z0 + 5.2, 0.18, 0.1], [z0 + 7.5, 0.18, 0.1], [z1 - 0.6, 0.18, 0.1]],
      pipes: [[cx - 1.2, 0.1, 0.05], [cx + 1.4, 0.12, 0.04]],
      boxes: { n: 6, size: [0.2, 0.45], drop: [0.05, 0.3], lanes: [cx - 1.5, cx + 1.6, cx - 2.2, cx + 2.2] },
      hangers: 1.1,
      seed: s < 0 ? 21 : 22,
    }, bcDark, bcLite);
    // 屋根の上のアンテナ（縦の棒と斜めの棒）
    b.box(mat.steel, [s * 8.5, RT + 0.62, 50.6], [0.05, 1.25, 0.05]);
    b.box(mat.steel, [s * 7.5, RT + 0.1, 51.05], [0.08, 0.2, 0.08]);
    strut(b, mat.steel, [s * 9.5, RT, 56.0], [s * 9.5, RT + 1.2, 55.45], 0.05, 0.05);
    strut(b, mat.steel, [s * 9.5, RT, 55.65], [s * 9.5, RT + 0.9, 55.55], 0.03, 0.03);
    // 待合の小屋（柱の北、A の側の縁に寄せる。幅 1.15 m）: 暗い壁、外を向く面いっぱいに窓 2 つの両開きの扉、上に案内と時計
    const bin = s * 4.75;
    const bout = s * 7.2;
    const bx0 = Math.min(bin, bout);
    const bx1 = Math.max(bin, bout);
    const bz0 = 49.45;
    const bz1 = 50.6;
    b.boxMM(mat.booth, [bx0, 0, bz0], [bx1, 2.55, bz1], { collide: true });
    b.boxMM(mat.shelterDark, [bx0 - 0.06, 2.55, bz0 - 0.06], [bx1 + 0.06, 2.85, bz1 + 0.06]);
    const ox = bout;
    const so = s;
    const fx = (d: number): [number, number] => [Math.min(ox + so * d, ox + so * (d + 0.02)), Math.max(ox + so * d, ox + so * (d + 0.02))];
    // 扉の枠（明るい細い枠）と、2 枚の扉（下は暗い板、上に窓）
    const [f0, f1] = fx(0.0);
    const dz0 = bz0 + 0.08;
    const dz1 = bz1 - 0.08;
    b.boxMM(mat.doorFrame, [f0, 0.02, dz0 - 0.04], [f1, 2.0, dz0]);
    b.boxMM(mat.doorFrame, [f0, 0.02, dz1], [f1, 2.0, dz1 + 0.04]);
    b.boxMM(mat.doorFrame, [f0, 1.96, dz0 - 0.04], [f1, 2.0, dz1 + 0.04]);
    const [g0, g1] = fx(0.01);
    b.boxMM(mat.doorLeaf, [g0, 0.04, dz0], [g1, 1.96, dz1]);
    const dm = (dz0 + dz1) / 2;
    b.boxMM(mat.doorFrame, [g0, 0.04, dm - 0.015], [g1, 1.96, dm + 0.015]);
    const [w0, w1] = fx(0.02);
    for (const [za, zb] of [[dz0 + 0.07, dm - 0.06], [dm + 0.06, dz1 - 0.07]] as const) {
      b.boxMM(mat.glass, [w0, 1.08, za], [w1, 1.78, zb]);
    }
    b.box(mat.board, [ox + so * 0.04, 1.0, dm - 0.07], [0.02, 0.1, 0.025]);
    // 扉の上の案内（2 枚）と時計
    b.boxMM(mat.board, [w0, 2.12, bz0 + 0.12], [w1, 2.3, bz0 + 0.5]);
    b.boxMM(mat.board, [w0, 2.08, bz0 + 0.56], [w1, 2.2, bz0 + 0.82]);
    b.cyl(mat.board, [ox + so * 0.05, 2.22, bz1 - 0.14], 0.085, 0.03, { axis: 'x', segments: 16 });
    // 北の面の窓
    const fn = bz0 - 0.02;
    for (const [wa, wb] of [[bx0 + 0.2, bx0 + 1.12], [bx1 - 1.12, bx1 - 0.2]]) {
      b.boxMM(mat.glass, [wa, 1.0, fn - 0.01], [wb, 2.15, fn]);
      for (let k = 1; k < 4; k++) {
        const wx = wa + (k * (wb - wa)) / 4;
        b.boxMM(mat.shelterDark, [wx - 0.02, 1.0, fn - 0.03], [wx + 0.02, 2.15, fn]);
      }
    }
    // 柱の南の暗い小部屋（奥まった暗い壁）と、券売機 2 台（暗い箱に小さな明るい画面）
    b.boxMM(mat.booth, [Math.min(s * 4.0, s * 5.05), 0, 51.8], [Math.max(s * 4.0, s * 5.05), 2.1, 53.3], { collide: true });
    b.boxMM(mat.shelterDark, [Math.min(s * 4.0, s * 5.05) - 0.04, 2.1, 51.76], [Math.max(s * 4.0, s * 5.05) + 0.04, 2.25, 53.34]);
    for (const zz of [52.35, 52.85]) {
      b.boxMM(mat.ticket, [s < 0 ? -5.45 : 5.05, 0, zz - 0.21], [s < 0 ? -5.05 : 5.45, 1.55, zz + 0.21], { collide: true });
      const sx = s < 0 ? -5.45 : 5.45;
      b.boxMM(mat.ticketScreen, [sx - 0.012, 1.0, zz - 0.13], [sx + 0.012, 1.22, zz + 0.13]);
      b.boxMM(mat.shelterDark, [sx - 0.06, 1.55, zz - 0.21], [sx + 0.06, 1.68, zz + 0.21]);
    }
    // 蛍光灯（屋根の下、長手に。外の列は長く、内の列は短い）
    // 蛍光灯（station-2 の視点から測った位置。鼻先の内側の列と、A の側の列）
    for (const [zc, len] of [[48.77, 1.95], [53.76, 1.95]] as const) {
      addTube([s * 9.55, 3.22, zc], len, 'z', 0.12, 0.09);
      b.box(mat.shelterDark, [s * 9.55, 3.34, zc], [0.04, 0.18, len * 0.9], { shadow: false });
    }
    for (const [zc, len] of [[48.7, 1.6], [53.9, 2.2]] as const) {
      addTube([s * 3.6, 3.2, zc], len, 'z', 0.08);
      b.box(mat.shelterDark, [s * 3.6, 3.32, zc], [0.04, 0.22, len * 0.9], { shadow: false });
    }
    // 角の細い柱と案内の柱（光る案内の箱）、吊り下げの小さな灯り
    b.box(mat.steel, [s * 3.5, RU / 2, 47.4], [0.08, RU, 0.08]);
    b.box(mat.steel, [cx, 1.3, 54.5], [0.07, 2.6, 0.07]);
    b.box(mat.shelterDark, [cx, 1.6, 54.5], [0.12, 0.38, 0.12]);
    b.box(mat.tube, [cx - s * 0.08, 2.55, 54.3], [0.06, 0.24, 0.5], { shadow: false });
    b.box(mat.shelterDark, [cx - s * 0.08, 2.55, 54.95], [0.07, 0.24, 0.85], { shadow: false });
    b.box(mat.lampBox, [s < 0 ? -9.0 : 9.0, 2.35, 49.0], [0.12, 0.3, 0.18], { shadow: false });
  }

  return { canDark, canLite, shedDark, shedLite, bcDark, bcLite };
}
