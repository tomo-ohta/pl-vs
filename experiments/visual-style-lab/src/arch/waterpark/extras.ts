import type { Builder } from '../../scenes/Builder.ts';
import type { SceneContext } from '../../scenes/types.ts';
import { builderSink, Prop } from '../../props/kit.ts';
import { chair } from '../../props/lib/index.ts';
import { table } from '../pool/props/furniture.ts';
import type { ShiftCam } from './cam.ts';
import { CAM_A } from './hallA.ts';
import { buildSlide, duct, HallKit, railing, roundLight, stairRail } from './hallkit.ts';
import { mono2 } from './looks.ts';
import { CAM_B } from './hallB.ts';
import { CAM_C } from './hallC.ts';
import { CAM_D } from './hallD.ts';
import type { HallId } from './layout.ts';
import { glow, semi } from './mats.ts';
import { WC, wpPropMats } from './props/mats.ts';
import { floatRack, wpBench, wpPlant } from './props/items.ts';
import { stairs } from '../kit.ts';

/**
 * 写っていない所の作り込み（広間の参考画像の画角の外）。
 * - どの広間にも: 壁ぎわの上の高さにダクトの列（参考画像の語彙: 銀色のダクトが壁沿いに走る）と、柱の列の上の投光
 * - B の北半分: 2 本目のスライダーの塔と螺旋・水路をまたぐ橋・寝椅子の列
 * - C の休憩所: テーブルと椅子の島
 * 参考画像の視点から見える所には置かない（seen）
 */
const CAMS: Record<HallId, ShiftCam> = { A: CAM_A, B: CAM_B, C: CAM_C, D: CAM_D };
function seen(id: HallId, pts: [number, number, number][], pad = 30): boolean {
  return pts.some((p) => {
    const q = CAMS[id].proj(p);
    return !!q && q[0] > -pad && q[0] < 1232 + pad && q[1] > -pad && q[1] < 928 + pad;
  });
}

export function buildExtras(b: Builder, ctx: SceneContext): void {
  const duc = semi(ctx, '#6f97b2', { metalness: 0.3, roughness: 0.35, name: 'E-duct' });
  const band = semi(ctx, '#4f7892');
  const steel = semi(ctx, '#8aa6b8', { metalness: 0.3, roughness: 0.5 });
  // B の北のスライダー（部品ごとに 1 色。桃色の樋とミントの筒）
  const pink = mono2(ctx, 'E-pink', '#e0988e', '#f2b8ac', '#ffe0d8', '#d68e84');
  const mint = mono2(ctx, 'E-mint', '#7fb8b2', '#9cccc6', '#dcfff8', '#77b0aa');
  const tubeIn = semi(ctx, '#203236');
  const deck = semi(ctx, '#7f98a4', { tiles: { size: [0.15, 1.2], line: 0.008, color: '#5f7884', jitter: 0.06 }, name: 'E-deck' });
  const rail = semi(ctx, '#b8c8d2', { metalness: 0.2, roughness: 0.5 });
  const lampBody = semi(ctx, '#2a3c48');
  const lampLit = glow(ctx, '#ffe0c4', 6);

  // ---- 広間の壁ぎわのダクト（見えない壁だけ。高さ 7.5 m 前後）
  const kOf = (id: HallId): HallKit => new HallKit(b, ctx, id);
  const wallDucts: [HallId, [number, number, number], [number, number, number], number][] = [
    ['B', [21.6, 8.2, -58], [21.6, 8.2, 6], 0.7],
    ['B', [-2.5, 8.6, -58], [20.5, 8.6, -58.8], 0.6],
    ['C', [13.2, 7.6, -30], [13.2, 7.6, 8], 0.65],
    ['C', [-8, 8.2, 8.2], [13, 8.2, 8.2], 0.55],
    ['D', [-11.2, 7.9, -38], [-11.2, 7.9, -19], 0.6],
    ['D', [10.2, 7.9, -38], [10.2, 7.9, -16], 0.6],
    ['A', [-16.2, 9.0, 9.0], [15.0, 9.0, 9.0], 0.6],
  ];
  for (const [id, a, c, r] of wallDucts) {
    const k = kOf(id);
    // 画角の中の区間は飛ばす（4 m ずつ）
    const len = Math.hypot(c[0] - a[0], c[2] - a[2]);
    const n = Math.ceil(len / 4);
    for (let i = 0; i < n; i++) {
      const t0 = i / n;
      const t1 = (i + 1) / n;
      const p0: [number, number, number] = [a[0] + (c[0] - a[0]) * t0, a[1], a[2] + (c[2] - a[2]) * t0];
      const p1: [number, number, number] = [a[0] + (c[0] - a[0]) * t1, a[1], a[2] + (c[2] - a[2]) * t1];
      if (seen(id, [k.p(...p0), k.p(...p1)])) continue;
      duct(k, duc, band, p0, p1, r, 1.4);
    }
  }

  // ---- B の北半分（参考画像の奥の暗い所より先）
  {
    const k = kOf('B');
    // 2 本目のスライダーの塔（鉄骨の 4 本柱と階段）と螺旋の筒
    const TX = 16.0;
    const TZ = -46.0;
    for (const [dx, dz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]] as [number, number][]) k.box(steel, [TX + dx - 0.1, 0, TZ + dz - 0.1], [TX + dx + 0.1, 8.0, TZ + dz + 0.1], { collide: true });
    k.box(steel, [TX - 1.7, 6.8, TZ - 1.7], [TX + 1.7, 7.05, TZ + 1.7], { shadow: false });
    railing(k, rail, [TX - 1.7, TZ - 1.7], [TX + 1.7, TZ - 1.7], 7.05);
    for (let i = 0; i < 4; i++) {
      const y0 = (i * 6.8) / 4;
      stairRail(k, rail, [TX + 1.7, y0, TZ + 1.4 - (i % 2) * 2.8], [TX + 1.7, y0 + 1.7, TZ - 1.4 + (i % 2) * 2.8], { h: 0.95, gap: 0.2 });
    }
    const helix = k.path([TX - 1.6, 7.3, TZ], [{ kind: 'helix', c: [11.4, -46.0], r: 3.0, turn: Math.PI * 2.6, y1: 1.8 }, { kind: 'line', to: [9.0, 0.5, -38.5] }], 0.25, 0.25);
    buildSlide(k, { path: helix, kind: 'tube', r: 0.6, pal: mint, tubeIn, posts: { every: 4, floor: 0, mat: steel, r: 0.09 } });
    const t2 = k.path([TX, 7.3, TZ - 1.6], [{ kind: 'line', to: [15.5, 6.6, -51] }, { kind: 'helix', c: [12.5, -52.5], r: 3.0, turn: -Math.PI * 1.6, y1: 2.0 }, { kind: 'line', to: [8.5, 0.5, -48.0] }], 0.25, 0.25);
    buildSlide(k, { path: t2, kind: 'trough', r: 0.8, lip: 0.38, pal: pink, posts: { every: 3.8, floor: 0, mat: steel, r: 0.09 } });
    // 着水の浅いプール（北東）
    // 水路をまたぐ橋（床 1.2 m・両側に手すり。西の歩道と東の床をつなぐ）
    const BZ = -40.0;
    k.box(deck, [0.3, 1.0, BZ - 1.0], [4.7, 1.2, BZ + 1.0], { collide: true });
    stairs(k.b, deck, k.p(-1.1, 0, BZ), '+x', 1.2, 1.8, { tread: 0.28 });
    stairs(k.b, deck, k.p(6.1, 0, BZ), '-x', 1.2, 1.8, { tread: 0.28 });
    railing(k, rail, [0.3, BZ - 1.0], [4.7, BZ - 1.0], 1.2, { h: 1.0 });
    railing(k, rail, [0.3, BZ + 1.0], [4.7, BZ + 1.0], 1.2, { h: 1.0 });
    // 寝椅子の列と浮き輪の台（東の床）
    const sink = builderSink(b, ctx);
    const pm = wpPropMats(ctx);
    let seed = 7100;
    floatRack(Prop.at(sink, pm, k.p(8.0, 0, -56.8), 0, seed++));
    wpBench(Prop.at(sink, pm, k.p(-2.6, 0, -30), Math.PI / 2, seed++));
    wpPlant(Prop.at(sink, pm, k.p(-2.6, 0, -34), Math.PI / 2, seed++));
    // 東の 2 階の回廊（床 4.5 m。北半分だけ。参考画像の右の階段の続き）と柱・手すり・下のダウンライト
    k.box(deck, [19.4, 4.1, -59.5], [22.5, 4.5, -27.0], { collide: true });
    railing(k, rail, [19.4, -59.5], [19.4, -31.0], 4.5, { h: 1.05, gap: 0.16 });
    railing(k, rail, [19.4, -29.4], [19.4, -27.0], 4.5, { h: 1.05, gap: 0.16 });
    railing(k, rail, [19.4, -27.0], [22.5, -27.0], 4.5, { h: 1.05, gap: 0.16 });
    for (let z = -57; z < -27; z += 6) {
      k.cyl(steel, [19.6, 2.05, z], 0.16, 4.1, { collide: true, segments: 12 });
      roundLight(k, lampBody, lampLit, [21.0, 4.07, z + 3], 0.15);
    }
    stairs(k.b, deck, k.p(18.4, 0, -22.0), '-z', 4.5, 1.6, { tread: 0.28 });
    stairRail(k, rail, [17.6, 0, -22.0], [17.6, 4.5, -29.4], { h: 1.0, gap: 0.16 });
    k.box(deck, [17.6, 4.1, -31.0], [19.4, 4.5, -29.4], { collide: true });
    // 天井の吊りの投光
    for (let z = -32; z > -58; z -= 6) {
      roundLight(k, lampBody, lampLit, [10.0, 10.95, z], 0.18);
      k.lamp({ pos: [10, 6, z], radius: 7, intensity: 0.6, color: '#ffe0cc', box: [5, -1, z - 4, 22, 11, z + 4], down: true });
    }
  }

  // ---- C の休憩所（仕切りの向こう）: テーブルと椅子の島
  {
    const k = kOf('C');
    const sink = builderSink(b, ctx);
    const pm = wpPropMats(ctx);
    let seed = 7300;
    for (const [x, z] of [[11.2, -10.0], [11.2, -5.0], [11.2, 0.0], [11.2, 5.0]] as [number, number][]) {
      if (seen('C', [k.p(x, 1, z)])) continue;
      table(Prop.at(sink, pm, k.p(x, 0, z), 0, seed++), 1.2, 0.8);
      for (const [dx, yaw] of [[-0.85, Math.PI / 2], [0.85, -Math.PI / 2]] as [number, number][]) chair(Prop.at(sink, pm, k.p(x + dx, 0, z), yaw, seed++), { seat: WC.blue, frame: WC.chrome });
    }
  }
}
