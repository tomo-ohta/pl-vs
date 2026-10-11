import * as THREE from 'three';
import type { Builder } from '../../scenes/Builder.ts';
import type { SceneContext } from '../../scenes/types.ts';
import { Prop } from '../../props/kit.ts';
import { bench, pottedPlant } from '../../props/lib/index.ts';
import { doorAt, onDrum } from './hall.ts';
import { DOME, DRUM_R, LOBBY, LOGE, RING } from './layout.ts';

import { domePropMats, domeSink } from './props/mats.ts';
import { bannerRig, brochureRack, ceilingLight, displayCase, globeExhibit, pendantLamp, shopShelf, stanchion, ticketCounter } from './props/lobby.ts';
import { buildFoyer } from './foyer.ts';
import type { LightShapes } from './fx.ts';

/**
 * 写っていない所（回廊・玄関ホール）の作り込みの決まり。どこも同じ決まりで並べる（撮られる所だけ直さない）。
 * - 回廊の外の壁: 7.5° おき（壁柱の間）に [掲示の額 2 枚と額の灯り / 展示のケース / 長椅子 / 案内の端末と鉢植え] を順に。
 *   2 階は展示のケースの代わりに夜の窓。出入口・玄関ホールの所は空ける
 * - ドラムの外の面: 壁柱（7.5° おき）・出入口の上の光る番号の板・壁付けの縦長の灯り
 * - 天井: 7.5° おきに丸い灯り（光だまり ctx.addLamp。照らす箱は回廊の中だけ）
 * - 玄関ホール: 券売所（西の壁）・地球儀の展示（中ほど）・長椅子・展示のケース・吊った丸い灯り・掲示
 * 掲示の絵は手続きで描いた 1 枚の絵（星図・惑星・軌道・題の帯）にまとめる
 */

/** 掲示の絵（5 × 2 枚。縦長 3:4） */
function posterAtlas(): THREE.CanvasTexture {
  const CW = 384;
  const CH = 512;
  const cv = document.createElement('canvas');
  cv.width = CW * 5;
  cv.height = CH * 2;
  const g = cv.getContext('2d')!;
  let seed = 11;
  const rnd = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const bgs = ['#0c1c2a', '#101a33', '#0a2228', '#1a1430', '#0d1f2f'];
  for (let k = 0; k < 10; k++) {
    const x0 = (k % 5) * CW;
    const y0 = Math.floor(k / 5) * CH;
    g.fillStyle = bgs[k % 5];
    g.fillRect(x0, y0, CW, CH);
    // 星
    for (let i = 0; i < 160; i++) {
      const a = 0.3 + rnd() * 0.7;
      g.fillStyle = `rgba(220,235,255,${a})`;
      const r = rnd() < 0.08 ? 2 : 1;
      g.fillRect(x0 + rnd() * CW, y0 + rnd() * CH * 0.75, r, r);
    }
    const cx = x0 + CW * (0.3 + rnd() * 0.4);
    const cy = y0 + CH * (0.25 + rnd() * 0.25);
    if (k % 3 === 0) {
      // 惑星（光と影の丸）と環
      const R = 50 + rnd() * 50;
      const grd = g.createRadialGradient(cx - R * 0.4, cy - R * 0.4, R * 0.1, cx, cy, R);
      const hues = ['#d9a066', '#7fb4d8', '#c97a5a', '#9fc7a0'];
      grd.addColorStop(0, hues[k % 4]);
      grd.addColorStop(1, '#0a0d14');
      g.fillStyle = grd;
      g.beginPath();
      g.arc(cx, cy, R, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(230,220,190,0.7)';
      g.lineWidth = 3;
      g.beginPath();
      g.ellipse(cx, cy, R * 1.7, R * 0.35, -0.3, 0, Math.PI * 2);
      g.stroke();
    } else if (k % 3 === 1) {
      // 星座の線
      g.strokeStyle = 'rgba(160,210,255,0.8)';
      g.lineWidth = 2;
      g.beginPath();
      let px = cx;
      let py = cy;
      g.moveTo(px, py);
      for (let i = 0; i < 7; i++) {
        px += (rnd() - 0.5) * 120;
        py += (rnd() - 0.3) * 70;
        g.lineTo(px, py);
        g.fillStyle = '#ffffff';
        g.fillRect(px - 3, py - 3, 6, 6);
      }
      g.stroke();
    } else {
      // 軌道（太陽と同心の楕円）
      g.fillStyle = '#ffd27a';
      g.beginPath();
      g.arc(cx, cy, 14, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(180,200,220,0.6)';
      g.lineWidth = 1.5;
      for (let i = 1; i <= 5; i++) {
        g.beginPath();
        g.ellipse(cx, cy, 26 * i, 15 * i, 0.2, 0, Math.PI * 2);
        g.stroke();
        const t = rnd() * Math.PI * 2;
        g.fillStyle = '#cfe6ff';
        g.beginPath();
        g.arc(cx + Math.cos(t) * 26 * i, cy + Math.sin(t) * 15 * i, 4, 0, Math.PI * 2);
        g.fill();
      }
    }
    // 題と文の帯
    g.fillStyle = '#e8eef2';
    g.fillRect(x0 + 30, y0 + CH * 0.8, CW * (0.5 + rnd() * 0.3), 22);
    g.fillStyle = 'rgba(200,215,225,0.6)';
    for (let i = 0; i < 3; i++) g.fillRect(x0 + 30, y0 + CH * 0.87 + i * 14, CW * (0.3 + rnd() * 0.5), 6);
    // 縁
    g.strokeStyle = 'rgba(255,255,255,0.15)';
    g.lineWidth = 6;
    g.strokeRect(x0 + 3, y0 + 3, CW - 6, CH - 6);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** 垂れ幕の絵（4 枚を横に並べた 1 枚。縦長 1:2.4）: 渦巻きの銀河・土星・月の満ち欠けの縦の列・星座 */
function bannerAtlas(): THREE.CanvasTexture {
  const CW = 256;
  const CH = 620;
  const cv = document.createElement('canvas');
  cv.width = CW * 4;
  cv.height = CH;
  const g = cv.getContext('2d')!;
  let seed = 5;
  const rnd = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let k = 0; k < 4; k++) {
    const x0 = k * CW;
    g.fillStyle = ['#0c2236', '#14203a', '#0a1f2c', '#102a3c'][k];
    g.fillRect(x0, 0, CW, CH);
    for (let i = 0; i < 120; i++) {
      g.fillStyle = `rgba(220,235,255,${0.3 + rnd() * 0.6})`;
      g.fillRect(x0 + rnd() * CW, rnd() * CH * 0.7, 1.5, 1.5);
    }
    const cx = x0 + CW / 2;
    const cy = CH * 0.35;
    if (k === 0) {
      for (let a = 0; a < 900; a++) {
        const t = a / 900;
        const arm = a % 2 ? 0 : Math.PI;
        const r = t * 100;
        const ang = arm + t * 7;
        g.fillStyle = `rgba(190,220,240,${0.7 - t * 0.5})`;
        g.fillRect(cx + Math.cos(ang) * r + (rnd() - 0.5) * 10, cy + Math.sin(ang) * r * 0.55 + (rnd() - 0.5) * 6, 2, 2);
      }
      g.fillStyle = '#f2e6c8';
      g.beginPath();
      g.arc(cx, cy, 8, 0, Math.PI * 2);
      g.fill();
    } else if (k === 1) {
      const grd = g.createRadialGradient(cx - 20, cy - 20, 5, cx, cy, 60);
      grd.addColorStop(0, '#e6d2a4');
      grd.addColorStop(1, '#3a3020');
      g.fillStyle = grd;
      g.beginPath();
      g.arc(cx, cy, 60, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(230,215,180,0.85)';
      g.lineWidth = 6;
      g.beginPath();
      g.ellipse(cx, cy, 110, 22, -0.25, 0, Math.PI * 2);
      g.stroke();
    } else if (k === 2) {
      for (let i = 0; i < 6; i++) {
        const y = 70 + i * 62;
        g.fillStyle = '#1c2c38';
        g.beginPath();
        g.arc(cx, y, 24, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#e8eef0';
        g.beginPath();
        g.arc(cx, y, 24, -Math.PI / 2, Math.PI / 2, i > 2);
        g.fill();
        g.fillStyle = i % 2 ? '#e8eef0' : '#1c2c38';
        g.beginPath();
        g.ellipse(cx, y, 24 * Math.abs(Math.cos((i / 6) * Math.PI)) + 0.01, 24, 0, 0, Math.PI * 2);
        g.fill();
      }
    } else {
      g.strokeStyle = 'rgba(160,210,255,0.8)';
      g.lineWidth = 2;
      let px = cx - 60;
      let py = 80;
      g.beginPath();
      g.moveTo(px, py);
      for (let i = 0; i < 8; i++) {
        px = Math.min(x0 + CW - 20, Math.max(x0 + 20, px + (rnd() - 0.4) * 70));
        py += 30 + rnd() * 25;
        g.lineTo(px, py);
        g.fillStyle = '#ffffff';
        g.fillRect(px - 3, py - 3, 6, 6);
      }
      g.stroke();
    }
    // 題と文の帯（下の方）
    g.fillStyle = '#e6eef3';
    g.fillRect(x0 + 30, CH * 0.78, CW - 60, 20);
    g.fillStyle = 'rgba(200,220,232,0.6)';
    for (let i = 0; i < 3; i++) g.fillRect(x0 + 30, CH * 0.84 + i * 14, (CW - 60) * (0.5 + rnd() * 0.4), 6);
    // 布の縁の折り返し
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(x0, 0, 6, CH);
    g.fillRect(x0 + CW - 6, 0, 6, CH);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export interface DressMats {
  frame: THREE.Material;
  pier: THREE.Material;
  window: THREE.Material;
  plateGlow: THREE.Material;
}

export function buildDressing(b: Builder, ctx: SceneContext, m: DressMats, fx: LightShapes): void {
  const sink = domeSink(b, ctx);
  const mats = domePropMats(ctx);
  // 掲示は裏から光る箱（天体写真の電飾の看板。プラネタリウムのホワイエによくある）
  const atlas = posterAtlas();
  const posterMat = ctx.mat({ color: '#000000', unlit: true, map: atlas, toon: 0, line: 0, name: 'posters' });
  (posterMat as THREE.MeshStandardMaterial).emissive.set('#ffffff');
  (posterMat as THREE.MeshStandardMaterial).emissiveMap = atlas;
  (posterMat as THREE.MeshStandardMaterial).emissiveIntensity = 1.15;
  const posters: THREE.BufferGeometry[] = [];
  let posterIdx = 0;
  /** 壁の面の点（中心 c・外向きの法線 n の yaw）に掲示を 1 枚 */
  const poster = (c: [number, number, number], yaw: number): void => {
    const k = posterIdx++ % 10;
    const g = new THREE.PlaneGeometry(0.75, 1.0);
    // 絵の升目（上の段 = v 0.5〜1、下の段 = 0〜0.5。キャンバスは上下を返して貼られる）
    const uv = g.getAttribute('uv') as THREE.BufferAttribute;
    const row = Math.floor(k / 5);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, ((k % 5) + uv.getX(i)) / 5, (uv.getY(i) + (1 - row)) / 2);
    g.rotateY(yaw);
    // 額縁の前の面より 3 mm 前（同じ面に重ねない）
    g.translate(c[0] + Math.sin(yaw) * 0.003, c[1], c[2] + Math.cos(yaw) * 0.003);
    posters.push(g);
    // 額縁（暗い枠）
    b.box(m.frame, [c[0] - Math.sin(yaw) * 0.015, c[1], c[2] - Math.cos(yaw) * 0.015], [0.85, 1.1, 0.03], { rotY: yaw, shadow: false });
  };
  const N = 48;
  for (let i = 0; i < N; i++) {
    const deg = (i + 0.5) * (360 / N);
    const ph = (deg * Math.PI) / 180;
    // 天井の梁（回廊を横切る。7.5° おき）
    {
      const ph2 = ph + (3.75 * Math.PI) / 180;
      const a1 = onDrum(RING.wallOut, ph2, 0);
      const a2 = onDrum(RING.r1, ph2, 0);
      const len = Math.hypot(a2[0] - a1[0], a2[2] - a1[2]);
      b.box(m.pier, [(a1[0] + a2[0]) / 2, RING.ceil1 - 0.2, (a1[2] + a2[2]) / 2], [0.3, 0.4, len], { rotY: -ph2, shadow: false });
      const c1 = onDrum(RING.wallOut, ph2, 0);
      const c2 = onDrum(RING.r2, ph2, 0);
      const len2 = Math.hypot(c2[0] - c1[0], c2[2] - c1[2]);
      b.box(m.pier, [(c1[0] + c2[0]) / 2, RING.ceil2 - 0.2, (c1[2] + c2[2]) / 2], [0.3, 0.4, len2], { rotY: -ph2, shadow: false });
    }
    // ドラムの外の面: 壁柱（出入口の額縁と開いた扉の所は空ける）
    {
      const p = onDrum(RING.wallOut + 0.12, ph + (3.75 * Math.PI) / 180, RING.ceil2 / 2);
      const pp = ph + (3.75 * Math.PI) / 180;
      if (!doorAt(pp, 0.075)) {
        b.box(m.pier, [p[0], RING.ceil2 / 2, p[2]], [0.6, RING.ceil2, 0.24], { rotY: -pp, shadow: false });
        // 柱の面の縁の見付け（2 本の暗い縦の帯）と、間の縦の溝の付いた化粧板（リブ 5 本）、階ごとの柱礎・柱頭の帯（暗い金物）
        for (const t of [-0.24, 0.24]) {
          const q = onDrum(RING.wallOut + 0.25, pp + t / RING.wallOut, 0);
          b.box(m.frame, [q[0], RING.ceil2 / 2, q[2]], [0.04, RING.ceil2, 0.02], { rotY: -pp, shadow: false });
        }
        for (const t of [-0.14, -0.07, 0, 0.07, 0.14]) {
          const q = onDrum(RING.wallOut + 0.248, pp + t / RING.wallOut, 0);
          b.box(m.pier, [q[0], RING.ceil2 / 2, q[2]], [0.03, RING.ceil2, 0.018], { rotY: -pp, shadow: false });
        }
        for (const [y, h] of [
          [0.08, 0.16],
          [RING.ceil1 - 0.5, 0.08],
          [RING.floor2 + 0.08, 0.16],
          [RING.ceil2 - 0.5, 0.08],
        ] as [number, number][]) {
          const q = onDrum(RING.wallOut + 0.13, pp, 0);
          b.box(m.frame, [q[0], y, q[2]], [0.66, h, 0.28], { rotY: -pp, shadow: false });
        }
      }
    }
  }
  // 回廊のベイごとの作り込み（展示・休む・出入口。foyer.ts）
  const ceilingLightAt = (c: [number, number, number]): void => ceilingLight(Prop.at(sink, mats, c, 0, 66));
  const lightbox = buildFoyer(b, ctx, { frame: m.frame, window: m.window }, fx, poster);
  // 平土間の壁ぎわ（1 階の桟敷の下）: 柱 3 本おきに電飾の掲示（出入口の脇は空ける）
  for (let i = 0; i < 48; i += 3) {
    const ph = ((i + 1) / 48) * Math.PI * 2;
    if (doorAt(ph, 0.06)) continue;
    const p = onDrum(DRUM_R - 0.03, ph, 1.7);
    const yawIn = Math.atan2(DOME.cx - p[0], DOME.cz - p[2]);
    poster([p[0], p[1], p[2]], yawIn);
  }
  // ---- 玄関ホール ----
  {
    const { x0, x1, z0, z1, ceil } = LOBBY;
    // 券売所（西の壁ぎわ）と、その前の列の仕切り・冊子の立て・後ろの壁の上映の予定の電飾の板
    const tcz = (z0 + z1) / 2 + 2;
    ticketCounter(Prop.at(sink, mats, [x0 + 0.9, 0, tcz], Math.PI / 2, 50), 4.6);
    lightbox([x0 + 0.06, 3.6, tcz - 1.2], Math.PI / 2, 2.0, 1.25, 10);
    lightbox([x0 + 0.06, 3.6, tcz + 1.2], Math.PI / 2, 2.0, 1.25, 11);
    brochureRack(Prop.at(sink, mats, [x0 + 0.35, 0, tcz + 3.0], Math.PI / 2, 57));
    brochureRack(Prop.at(sink, mats, [x0 + 0.35, 0, tcz + 3.7], Math.PI / 2, 58));
    for (let k = 0; k < 4; k++) {
      const z = tcz - 1.8 + k * 1.2;
      stanchion(Prop.at(sink, mats, [x0 + 3.0, 0, z], -Math.PI / 2, 59), k < 3 ? 1.2 : 0);
      stanchion(Prop.at(sink, mats, [x0 + 4.4, 0, z], -Math.PI / 2, 60), k < 3 ? 1.2 : 0);
    }
    globeExhibit(Prop.at(sink, mats, [(x0 + x1) / 2 - 1, 0, (z0 + z1) / 2 + 1.5], 0.3, 51));
    for (const [x, z] of [
      [(x0 + x1) / 2 - 6, z1 - 3.5],
      [(x0 + x1) / 2 + 4, z1 - 3.5],
    ]) bench(Prop.at(sink, mats, [x, 0, z], Math.PI, 52), { w: 2.4, kind: 'seats', seat: '#3a5664', frame: '#1c272e', n: 5 });
    for (const [x, c] of [
      [x0 + 6, 'planet'],
      [x0 + 9, 'meteorite'],
    ] as [number, 'planet' | 'meteorite'][]) displayCase(Prop.at(sink, mats, [x, 0, z1 - 0.6], Math.PI, 53), c);
    // 売店（南の壁ぎわ）: 棚 2 つ・小さな台・上の題の電飾の板
    shopShelf(Prop.at(sink, mats, [x0 + 12.4, 0, z1 - 0.47], Math.PI, 61), 1.8, 0);
    shopShelf(Prop.at(sink, mats, [x0 + 14.3, 0, z1 - 0.47], Math.PI, 62), 1.8, 2);
    lightbox([x0 + 13.35, 2.6, z1 - 0.06], Math.PI, 3.6, 0.5, 11);
    {
      const t = Prop.at(sink, mats, [x0 + 13.35, 0, z1 - 1.6], Math.PI, 63);
      t.box('#5a4636', [-0.7, 0.8, -0.35], [0.7, 0.85, 0.35], { r: 0.01, collide: true });
      for (const sx of [-0.62, 0.62]) for (const sz of [-0.28, 0.28]) t.box('#1d2c35', [sx - 0.03, 0, sz - 0.03], [sx + 0.03, 0.8, sz + 0.03]);
      for (let i = 0; i < 5; i++) t.ball(['#5f9fd0', '#c27454', '#d2b08a', '#9fd4dc', '#3f7fa8'][i], [-0.5 + i * 0.25, 0.93, 0], 0.07, { seg: 14 });
    }
    // 東の壁の階の案内図（階段の上）
    lightbox([x1 - 0.06, 5.3, 43.2], -Math.PI / 2, 2.4, 1.5, 9);
    // 階段: 段鼻の足もとの光の帯・西の側桁（段ごとの板と斜めの笠木）・手すり子
    {
      const sx0 = x1 - 2.4;
      const n = Math.round(LOGE.l1 / 0.18);
      const rise = LOGE.l1 / n;
      const tread = 0.28;
      const zStart = z1 - 1.2;
      const st = Prop.at(sink, mats, [0, 0, 0], 0, 65);
      for (let i = 0; i < n; i++) {
        const zA = zStart - i * tread;
        const y = rise * (i + 1);
        st.box('#5f8fa6', [sx0 + 0.05, y - 0.035, zA - 0.006], [x1 - 0.05, y - 0.015, zA + 0.002], { kind: 'glow', shadow: false });
        st.box('#1d2c35', [sx0 - 0.03, Math.max(0, y - rise - 0.3), zA - tread], [sx0 + 0.002, y + 0.06, zA], { shadow: false });
        if (i % 2 === 0) st.rod('#6f8792', [sx0 - 0.03, y, zA - tread / 2], [sx0 - 0.03, y + 0.98, zA - tread / 2], 0.012, { shadow: false });
      }
      // 渡り廊下の下の天井の灯り（2 m おき）と床の光だまり
      for (let z = z0 + 1.0; z < zStart - n * tread - 0.5; z += 2.0) {
        const c: [number, number, number] = [x1 - 1.2, LOGE.l1 - 0.36, z];
        ceilingLightAt(c);
        fx.pool([c[0], 0.02, z], 1.0, 1.0, 0, '#8fd0ec', 0.035);
      }
      ctx.addLamp({ pos: [x1 - 1.2, LOGE.l1 - 0.6, (z0 + zStart - n * tread) / 2], radius: 4.5, intensity: 2.2, color: '#a4d6ee', box: [sx0 - 0.5, -0.1, z0, x1, LOGE.l1 - 0.35, zStart - n * tread], down: true, shadow: 0 });
    }
    // 階段の前の灯り（吊った灯り 1 つと光だまり）
    pendantLamp(Prop.at(sink, mats, [x1 - 4.2, ceil, (z0 + z1) / 2 + 1], 0, 67), 3.0);
    ctx.addLamp({ pos: [x1 - 4.2, ceil - 3.6, (z0 + z1) / 2 + 1], radius: 3.8, intensity: 2.6, color: '#d0e6f2', box: [x0, -0.1, z0, x1, ceil, z1], shadow: 0 });
    for (const x of [x0 + 4, x0 + 11, x1 - 8]) {
      for (const z of [z0 + 4, z1 - 4]) {
        fx.pool([x, 0.015, z], 2.4, 2.4, 0, '#cfe4ee', 0.03);
        pendantLamp(Prop.at(sink, mats, [x, ceil, z], 0, 54), 3.0);
        ctx.addLamp({ pos: [x, ceil - 3.6, z], radius: 5.2, intensity: 3.0, color: '#d0e6f2', box: [x0, -0.1, z0, x1, ceil, z1], shadow: 0 });
      }
    }
    // 天井から吊った垂れ幕（4 枚。布ごとに違う絵）
    {
      const tex = bannerAtlas();
      const bm = ctx.mat({ color: '#ffffff', map: tex, toon: 0, roughness: 0.95, line: 0, side: THREE.DoubleSide, name: 'banners' });
      const W = 1.2;
      const L = 2.9;
      [x0 + 7.5, x0 + 15.5, x1 - 11.5, x1 - 4.5].forEach((x, k) => {
        const z = (z0 + z1) / 2 - 0.5;
        bannerRig(Prop.at(sink, mats, [x, ceil, z], 0, 64 + k), W, L);
        const g = new THREE.PlaneGeometry(W, L);
        const uv = g.getAttribute('uv') as THREE.BufferAttribute;
        for (let i = 0; i < uv.count; i++) uv.setX(i, (k + uv.getX(i)) / 4);
        g.translate(x, ceil - 0.6 - L / 2, z);
        b.mesh(g, bm, [0, 0, 0], { shadow: false });
      });
    }
    for (let x = x0 + 17; x < x1 - 5; x += 1.1) poster([x, 1.6, z1 - 0.02], Math.PI);
    pottedPlant(Prop.at(sink, mats, [x0 + 0.6, 0, z1 - 0.6], Math.PI, 55), { pot: '#2f3e46', leaf: '#3f6a5c', h: 1.4 });
    pottedPlant(Prop.at(sink, mats, [x1 - 3.0, 0, z1 - 0.6], Math.PI, 56), { pot: '#2f3e46', leaf: '#3f6a5c', h: 1.4 });
  }
  for (const g of posters) b.mesh(g, posterMat, [0, 0, 0], { shadow: false });
}
