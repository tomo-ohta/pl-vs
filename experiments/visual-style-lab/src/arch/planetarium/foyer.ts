import * as THREE from 'three';
import type { Builder } from '../../scenes/Builder.ts';
import type { SceneContext } from '../../scenes/types.ts';
import { Prop, type PropSink } from '../../props/kit.ts';
import { bench, extinguisher, pottedPlant, trashBin, waterCooler } from '../../props/lib/index.ts';
import type { LightShapes } from './fx.ts';
import { hash } from './geo.ts';
import { onDrum } from './hall.ts';
import { DOME, DOORS, RING } from './layout.ts';
import { diagramAtlas, panelUV } from './panels.ts';
import { domePropMats, domeSink, domeVcMat } from './props/mats.ts';
import { ceilingLight, displayCase, wallSconce } from './props/lobby.ts';
import { doorHeader, doorLeaf, exitSign, guideFrame, hangingPlanet, lockers, orrery, railBracket, seatAlcove, wallVitrine } from './props/foyer.ts';
import { BAY_DEG, BAYS, bayPhi, bays, type BayInfo } from './zones.ts';

/**
 * 回廊（ホワイエ）の作り込み（zones.ts のベイの種類ごとの決まりを、1 階・2 階の全部のベイに当てる）。
 * - 床: 回廊の輪に沿って割った石の板（壁ぎわの縁の帯は暗い石・中は 1.2 m の板を半分ずつずらす。板ごとに少し明るさが違う）。
 *   展示と休む区間は中ほどに縁取りの付いた敷物、出入口の前は真鍮の象眼（輪と星）
 * - 天井: 展示 = 格天井の枠・ダウンライト 2 つ・壁を洗うスポットのレール・吊った惑星。休む = 間接照明の帯・ダウンライト・吊った灯り。
 *   出入口 = 扉の前のダウンライト 2 つ
 * - 外の壁: 展示 = ケース・図の電飾の板・オーラリー・読む台。休む = 長椅子の小部屋・ロッカーと水飲み・掲示と長椅子（2 階は夜の窓）。
 *   出入口 = 案内図の電飾の板・消火器
 * - ドラムの面: 展示 = 吸音の布の板（継ぎ目で分かれる 2 色）。休む = 星の壁と壁付け灯。出入口 = 扉の額縁・開いた扉・案内の箱と番号・
 *   誘導灯・手すり
 * - 光: 器具ごとに床の光だまり・壁の光の山形（fx.ts）。灯りの光だまり（ctx.addLamp）はベイに 1 つ（物を照らす）
 */

export interface FoyerMats {
  frame: THREE.Material;
  window: THREE.Material;
}

interface Level {
  n: 1 | 2;
  y: number;
  ceil: number;
  rIn: number;
  rOut: number;
}
const LEVELS: Level[] = [
  { n: 1, y: 0, ceil: RING.ceil1, rIn: RING.wallOut, rOut: RING.r1 },
  { n: 2, y: RING.floor2, ceil: RING.ceil2, rIn: RING.wallOut, rOut: RING.r2 },
];

type V3 = [number, number, number];

/** 展示の区間の題（区間の番号ごと）: ケースの中身・図の板の番号 */
const THEMES: { cases: ('meteorite' | 'telescope' | 'planet')[]; panels: number[] }[] = [
  { cases: ['meteorite', 'meteorite'], panels: [5, 7, 2] },
  { cases: ['planet', 'planet'], panels: [0, 3, 1] },
  { cases: ['telescope', 'meteorite'], panels: [6, 4, 2] },
];

const PLANET_COLS = ['#9a948c', '#d6bf8a', '#5f9fd0', '#c27454', '#d2b08a', '#dcc898', '#9fd4dc', '#5f84d4'];

/** 図の電飾の板を置く関数（中心・外向きの yaw・幅・高さ・絵の番号）。玄関ホールでも使う */
export type Lightbox = (c: V3, yaw: number, w: number, h: number, k: number) => void;

export function buildFoyer(b: Builder, ctx: SceneContext, m: FoyerMats, fx: LightShapes, poster: (c: V3, yaw: number) => void): Lightbox {
  const sink: PropSink = domeSink(b, ctx);
  const mats = domePropMats(ctx);
  const atlas = diagramAtlas();
  const panelMat = ctx.mat({ color: '#000000', unlit: true, toon: 0, line: 0, name: 'diagram-panels' }) as THREE.MeshStandardMaterial;
  panelMat.emissive.set('#ffffff');
  panelMat.emissiveMap = atlas;
  panelMat.emissiveIntensity = 1.0;
  /** 図の電飾の板（中心 c・外向きの yaw・幅 w・高さ h・絵 k）と枠 */
  const lightbox = (c: V3, yaw: number, w: number, h: number, k: number): void => {
    const g = new THREE.PlaneGeometry(w, h);
    panelUV(g, k);
    g.rotateY(yaw);
    g.translate(c[0] + Math.sin(yaw) * 0.002, c[1], c[2] + Math.cos(yaw) * 0.002);
    b.mesh(g, panelMat, [0, 0, 0], { shadow: false });
    b.box(m.frame, [c[0] - Math.sin(yaw) * 0.035, c[1], c[2] - Math.cos(yaw) * 0.035], [w + 0.1, h + 0.1, 0.07], { rotY: yaw, shadow: false });
  };

  // ---------------------------------------------------------------- 床
  const tileMat = ctx.mat({ color: '#ffffff', vertexColors: true, toon: 0, roughness: 0.38, line: 0, name: 'o-floor-tiles' });
  const runnerMat = ctx.mat({ color: '#123544', toon: 0, roughness: 1, line: 0, name: 'o-runner' });
  const runnerEdge = ctx.mat({ color: '#3e4a46', toon: 0, roughness: 0.9, line: 0, name: 'o-runner-edge' });
  const brass = ctx.mat({ color: '#7a6c4c', toon: 0, roughness: 0.3, metalness: 0.4, line: 0, name: 'o-inlay' });
  const tilePos: number[] = [];
  const tileCol: number[] = [];
  const cField = new THREE.Color('#21404f');
  const cBorder = new THREE.Color('#132833');
  const tile = (lv: Level, ra: number, rb: number, p0: number, p1: number, col: THREE.Color): void => {
    const y = lv.y + 0.004;
    const g = 0.007;
    const a0 = p0 + g / ra;
    const a1 = p1 - g / ra;
    const pts = [onDrum(ra + g, a0, y), onDrum(rb - g, a0, y), onDrum(rb - g, a1, y), onDrum(ra + g, a1, y)];
    // 上向き（反時計回りを上から）: a → d → c → b の順が上向き
    for (const i of [0, 3, 2, 0, 2, 1]) tilePos.push(...pts[i]);
    for (let i = 0; i < 6; i++) tileCol.push(col.r, col.g, col.b);
  };
  let seed = 0;
  for (const lv of LEVELS) {
    const rows: { ra: number; rb: number; len: number; col: THREE.Color }[] = [];
    const bw = 0.45;
    rows.push({ ra: lv.rIn, rb: lv.rIn + bw, len: 0.6, col: cBorder });
    const fw = lv.rOut - lv.rIn - 2 * bw;
    const nr = Math.max(1, Math.round(fw / 0.65));
    for (let k = 0; k < nr; k++) rows.push({ ra: lv.rIn + bw + (k * fw) / nr, rb: lv.rIn + bw + ((k + 1) * fw) / nr, len: 0.75, col: cField });
    rows.push({ ra: lv.rOut - bw, rb: lv.rOut, len: 0.6, col: cBorder });
    rows.forEach((row, ri) => {
      const rm = (row.ra + row.rb) / 2;
      const N = Math.round((Math.PI * 2 * rm) / row.len);
      const off = ri % 2 ? 0.5 : 0;
      for (let t = 0; t < N; t++) {
        const p0 = ((t + off) / N) * Math.PI * 2;
        const p1 = ((t + 1 + off) / N) * Math.PI * 2;
        // 中の板は 2 つの石を市松に（石ごとの色）。板ごとに少し明るさが違う
        const two = row.col === cField && (t + ri) % 2 === 1 ? 0.78 : 1;
        const j = (1 + (hash(seed++, 41) - 0.5) * 0.14) * two;
        tile(lv, row.ra, row.rb, p0, p1, row.col.clone().multiplyScalar(j));
      }
    });
  }
  {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(tilePos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(tileCol, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((tilePos.length / 3) * 2), 2));
    g.computeVertexNormals();
    b.mesh(g, tileMat, [0, 0, 0], { shadow: 'receive', merge: false });
  }

  // 敷物（展示・休む区間の中ほど。区間の端は 0.4 m 手前で切る）
  const runF: number[] = [];
  const runE: number[] = [];
  const strip = (arr: number[], lv: Level, ra: number, rb: number, p0: number, p1: number, y: number): void => {
    const n = Math.max(1, Math.ceil(((p1 - p0) * 180) / Math.PI));
    for (let i = 0; i < n; i++) {
      const a = p0 + ((p1 - p0) * i) / n;
      const c = p0 + ((p1 - p0) * (i + 1)) / n;
      const pts = [onDrum(ra, a, y), onDrum(rb, a, y), onDrum(rb, c, y), onDrum(ra, c, y)];
      for (const k of [0, 3, 2, 0, 2, 1]) arr.push(...pts[k]);
    }
    void lv;
  };
  for (const lv of LEVELS) {
    const info = bays(lv.n);
    const rm = (lv.rIn + lv.rOut) / 2;
    const hw = lv.n === 1 ? 0.85 : 0.75;
    for (let i = 0; i < BAYS; i++) {
      const z = info[i].zone;
      if (z !== 'exhibit' && z !== 'rest') continue;
      const prev = info[(i + BAYS - 1) % BAYS].zone;
      const next = info[(i + 1) % BAYS].zone;
      const runs = (zz: string): boolean => zz === 'exhibit' || zz === 'rest';
      let p0 = (i * BAY_DEG * Math.PI) / 180;
      let p1 = ((i + 1) * BAY_DEG * Math.PI) / 180;
      if (!runs(prev)) p0 += 0.4 / rm;
      if (!runs(next)) p1 -= 0.4 / rm;
      const y = lv.y + 0.012;
      strip(runF, lv, rm - hw + 0.1, rm + hw - 0.1, p0, p1, y);
      strip(runE, lv, rm - hw, rm - hw + 0.08, p0, p1, y + 0.001);
      strip(runE, lv, rm + hw - 0.08, rm + hw, p0, p1, y + 0.001);
      // 区間の端の帯
      if (!runs(prev)) strip(runE, lv, rm - hw, rm + hw, p0, p0 + 0.08 / rm, y + 0.001);
      if (!runs(next)) strip(runE, lv, rm - hw, rm + hw, p1 - 0.08 / rm, p1, y + 0.001);
    }
  }
  const geoOf = (pos: number[]): THREE.BufferGeometry => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
    g.computeVertexNormals();
    return g;
  };
  b.mesh(geoOf(runF), runnerMat, [0, 0, 0], { shadow: 'receive' });
  b.mesh(geoOf(runE), runnerEdge, [0, 0, 0], { shadow: 'receive' });

  // 出入口の前の床の象眼（真鍮の 2 つの輪と 8 つの頂の星）
  const inlay = (c: V3): void => {
    for (const [r0, r1] of [
      [0.74, 0.78],
      [0.5, 0.525],
    ]) {
      const g = new THREE.RingGeometry(r0, r1, 64);
      g.rotateX(-Math.PI / 2);
      b.mesh(g, brass, [c[0], c[1] + 0.007, c[2]], { shadow: 'receive' });
    }
    const s = new THREE.Shape();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = i % 2 ? 0.12 : i % 4 === 0 ? 0.46 : 0.28;
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const g = new THREE.ShapeGeometry(s);
    g.rotateX(-Math.PI / 2);
    b.mesh(g, brass, [c[0], c[1] + 0.0075, c[2]], { shadow: 'receive' });
  };

  // ---------------------------------------------------------------- ベイごと
  for (const lv of LEVELS) {
    const info = bays(lv.n);
    const rm = (lv.rIn + lv.rOut) / 2;
    const H = lv.ceil - lv.y;
    for (let i = 0; i < BAYS; i++) {
      const bi: BayInfo = info[i];
      const ph = bayPhi(i);
      const yawIn = -ph; // 外の壁の物（正面が中心の向き）
      const yawOut = Math.PI - ph; // ドラムの面の物（正面が外の向き）
      const at = (r: number, y: number, dt = 0): V3 => onDrum(r, ph + dt / r, lv.y + y);
      // ダウンライト 1 つと、その真下の柔らかい丸い光だまり（区画ごとに配光の広さと強さが違う。ベイごとに器具の明るさが少し違う）
      const jit = 0.85 + 0.3 * hash(i, lv.n * 7);
      const ceilLight = (r: number, dt: number, seedK: number, pool = 1.0, k = 0.05): void => {
        const c = at(r, H, dt);
        ceilingLight(Prop.at(sink, mats, c, -ph, seedK));
        fx.pool([c[0], lv.y + 0.02, c[2]], pool, pool, 0, '#8fd0ec', k * jit);
      };
      // 壁を洗う器具: 壁の光の山形と、壁ぎわの床へ薄れていく光（壁から 0.3 m・壁に沿って長い柔らかい楕円）
      const wash = (top: V3, foot: V3, yaw: number, w: number, k: number): void => {
        fx.scallop(top, yaw, w, H - 0.35, '#a8dcf2', k * jit);
        fx.pool(foot, w * 0.42, 0.45, yaw, '#a8dcf2', k * 0.8 * jit);
      };
      const sd = lv.n * 1000 + i * 10;
      // 灯りの光だまり（物を照らす。ベイに 1 つ）
      const lampAt = (r: number, dt: number, intensity: number, radius: number): void => {
        const c = at(r, H - 0.3, dt);
        // 照らす箱は回廊の向きに回す（輪の向きに 2.3 m・幅の向きは回廊の両の壁の面まで。壁の向こうへは漏れない）
        const bc = at(rm, H - 0.3, dt);
        const hz = (lv.rOut - lv.rIn) / 2 + 0.12;
        const half = 2.3;
        ctx.addLamp({ pos: c, radius, intensity, color: '#a4d6ee', box: [bc[0] - half, lv.y - 0.1, bc[2] - hz, bc[0] + half, lv.ceil, bc[2] + hz], yaw: -(ph + dt / rm), shadow: 0 });
      };
      if (bi.zone === 'lobby') {
        ceilLight(rm, 0, sd, 1.2, 0.03);
        lampAt(rm, 0, 3.4, 3.7);
      } else if (bi.zone === 'exhibit') {
        // 格天井の枠（輪に沿う 2 本。ベイの両端の梁と組んで升になる）
        for (const r of [lv.rIn + 0.75, lv.rOut - 0.75]) {
          const len = (BAY_DEG * Math.PI) / 180 * r - 0.3;
          const c = at(r, H - 0.15);
          b.box(m.frame, c, [len, 0.3, 0.14], { rotY: yawIn, shadow: false });
        }
        ceilLight(rm, -1.0, sd, 0.75, 0.055);
        ceilLight(rm, 1.0, sd + 1, 0.75, 0.055);
        // 壁を洗うスポットのレール（外の壁の前）と頭 2 つ → 外の壁の光の山形
        const tr = lv.rOut - 0.55;
        const tlen = (BAY_DEG * Math.PI) / 180 * tr - 0.5;
        b.box(m.frame, at(tr, H - 0.03), [tlen, 0.035, 0.05], { rotY: yawIn, shadow: false });
        for (const dt of [-1.05, 1.05]) {
          const hp = Prop.at(sink, mats, at(tr, H - 0.04, dt), yawIn + Math.PI, sd + 3);
          const s = hp.sub([0, -0.06, 0], 0, { pitch: 0.7 });
          s.cyl('#0e181e', [0, -0.07, 0], 0.045, 0.16, { seg: 12, shadow: false });
          s.cyl('#ffe6c0', [0, -0.151, 0], 0.035, 0.004, { seg: 12, kind: 'glow', shadow: false });
          wash(at(lv.rOut - 0.035, H - 0.3, dt), at(lv.rOut - 0.3, 0.02, dt), yawIn, 1.9, 0.04);
        }
        // ドラムの面も 1 つ洗う（吸音の板の継ぎ目が見える）
        for (const dt of [-0.9, 0.9]) wash(at(lv.rIn + 0.065, H - 0.3, dt), at(lv.rIn + 0.35, 0.02, dt), yawOut, 2.0, 0.03);
        // 吊った惑星の模型（区間の中の順に色を変える）。球は模型を照らすスポットの陰影（明暗の境・縁の暗み・環の影）を塗った形
        {
          const pi = (bi.k + bi.seg * 3) % PLANET_COLS.length;
          const r = 0.07 + ((pi * 37) % 5) * 0.025;
          const L = 0.38 + r;
          const hp = Prop.at(sink, mats, at(rm, H), 0, sd + 4);
          hangingPlanet(hp, L, r, PLANET_COLS[pi], pi === 5, true);
          b.mesh(shadedSphere(at(rm, H - L), r, PLANET_COLS[pi], pi === 5, -ph), domeVcMat(ctx, 'matte'), [0, 0, 0], { shadow: true });
        }
        lampAt(rm + 0.6, 0, 3.7, 3.7);
      } else if (bi.zone === 'rest') {
        // 木の羽根板の天井（回廊を横切る板。0.4 m おき・せい 0.14 m。板の間から星の天井とダウンライト）。両端は梁
        const nbf = Math.floor(((BAY_DEG * Math.PI) / 180) * rm / 0.4) - 1;
        for (let k = 1; k <= nbf; k++) {
          const a = ph - (BAY_DEG * Math.PI) / 360 + (((BAY_DEG * Math.PI) / 180) * k) / (nbf + 1);
          if (Math.abs(a - ph) * rm < 0.2) continue;
          const c0 = onDrum(rm, a, lv.y + H - 0.1);
          const len = lv.rOut - lv.rIn - 0.7;
          b.box(baffle(ctx), c0, [0.05, 0.14, len], { rotY: -a, shadow: false });
        }
        ceilLight(rm, 0, sd, 1.5, 0.035);
        lampAt(rm, 0, 3.4, 3.7);
      } else {
        // 出入口: 扉の前のダウンライト 2 つ（扉のベイ）、ほかはベイの中ほどに 1 つ
        if (bi.door !== undefined) {
          const dph = (bi.door * Math.PI) / 180;
          for (const s of [-1, 1]) {
            const c = onDrum(lv.rIn + 1.3, dph + (s * 0.9) / (lv.rIn + 1.3), lv.y + H);
            ceilingLight(Prop.at(sink, mats, c, -dph, sd + 5));
            fx.pool([c[0], lv.y + 0.02, c[2]], 1.0, 1.0, 0, '#8fd0ec', 0.06 * jit);
          }
          const c = onDrum(lv.rIn + 1.6, dph, lv.y + H - 0.3);
          const bc = onDrum(rm, dph, lv.y + H - 0.3);
          const hz = (lv.rOut - lv.rIn) / 2 + 0.12;
          ctx.addLamp({ pos: c, radius: 3.6, intensity: 4.3, color: '#a4d6ee', box: [bc[0] - 2.4, lv.y - 0.1, bc[2] - hz, bc[0] + 2.4, lv.ceil, bc[2] + hz], yaw: -dph, down: true, shadow: 0 });
        } else {
          ceilLight(rm, 0, sd, 1.2, 0.04);
          lampAt(rm, 0, 3.4, 3.7);
        }
      }

      // ---- 外の壁 ----
      const wall = (dr: number, y: number, dt = 0): V3 => at(lv.rOut - dr, y, dt);
      if (bi.zone === 'exhibit') {
        const th = THEMES[Math.floor(bi.seg / 2) % THEMES.length];
        const mid = Math.floor(bi.n / 2);
        if (bi.k === mid) {
          orrery(Prop.at(sink, mats, wall(lv.n === 1 ? 1.25 : 1.05, 0), yawIn, sd + 6));
          lightbox(wall(0.06, 1.55, -1.55), yawIn, 0.9, 0.56, th.panels[1]);
          lightbox(wall(0.06, 1.55, 1.55), yawIn, 0.9, 0.56, th.panels[2]);
        } else if ((bi.k + mid) % 2 === 1) {
          displayCase(Prop.at(sink, mats, wall(0.45, 0, -0.75), yawIn, sd + 7), th.cases[0]);
          displayCase(Prop.at(sink, mats, wall(0.45, 0, 0.75), yawIn, sd + 8), th.cases[1]);
          lightbox(wall(0.06, 2.05, 0), yawIn, 1.6, 1.0, th.panels[bi.k % 3]);
        } else {
          lightbox(wall(0.06, 1.65, 0), yawIn, 2.4, 1.5, th.panels[(bi.k + 1) % 3]);
          // 読む台（斜めの板と、光る小さな説明の札 3 枚）
          const rd = Prop.at(sink, mats, wall(0.3, 0), yawIn, sd + 9);
          rd.box('#1d2c35', [-1.2, 0, -0.18], [1.2, 0.82, -0.02], { r: 0.01, collide: true });
          const top = rd.sub([0, 0.86, -0.05], 0, { pitch: 0.45 });
          top.box('#0e181e', [-1.22, -0.03, -0.18], [1.22, 0.0, 0.18], { r: 0.008 });
          for (const x of [-0.75, 0, 0.75]) top.box('#6fa8c4', [x - 0.28, 0.001, -0.12], [x + 0.28, 0.004, 0.12], { kind: 'glow', shadow: false });
        }
      } else if (bi.zone === 'rest') {
        const kind = bi.k % 3;
        if (kind === 0) {
          seatAlcove(Prop.at(sink, mats, wall(0.75, 0), yawIn, sd + 10), 2.4);
          // 小部屋の上の棚の光が座と床に落ちる
          fx.pool(wall(0.55, 0.02), 1.3, 0.6, yawIn, '#ffe0b8', 0.05);
          fx.glow(wall(0.1, 1.3), yawIn, 2.2, 1.6, '#ffdcb4', 0.06);
        } else if (kind === 1) {
          lockers(Prop.at(sink, mats, wall(0.6, 0, -0.6), yawIn, sd + 12), 5, 4);
          waterCooler(Prop.at(sink, mats, wall(0.35, 0, 1.25), yawIn, sd + 13), { body: '#9fb2b8', top: '#7d9196', button: '#4f86b8' });
          trashBin(Prop.at(sink, mats, wall(0.3, 0, 1.75), yawIn, sd + 14), { kind: 'round', body: '#2b3a42', lid: '#1a242a' });
          wash(wall(0.035, H - 0.3, -0.6), wall(0.3, 0.02, -0.6), yawIn, 1.8, 0.03);
        } else if (lv.n === 2) {
          // 2 階: 夜の窓（暗い青のガラスと縦の桟）と長椅子
          const p = wall(0.02, 1.6);
          b.box(m.window, p, [2.2, 1.9, 0.04], { rotY: yawIn, shadow: false });
          for (const dt of [-1.1, -0.37, 0.37, 1.1]) b.box(m.frame, wall(0.05, 1.6, dt), [0.06, 1.95, 0.06], { rotY: yawIn, shadow: false });
          b.box(m.frame, wall(0.1, 0.62), [2.3, 0.06, 0.2], { rotY: yawIn, shadow: false });
          bench(Prop.at(sink, mats, wall(0.45, 0), yawIn, sd + 15), { w: 1.6, kind: 'locker', seat: '#3a4c56', frame: '#1c272e' });
        } else {
          poster(wall(0.03, 1.55, -0.55), yawIn);
          poster(wall(0.03, 1.55, 0.55), yawIn);
          bench(Prop.at(sink, mats, wall(0.45, 0), yawIn, sd + 15), { w: 1.8, kind: 'locker', seat: '#3a4c56', frame: '#1c272e' });
          pottedPlant(Prop.at(sink, mats, wall(0.35, 0, 1.55), yawIn, sd + 16), { pot: '#2f3e46', leaf: '#3f6a5c', h: 1.2 });
          wash(wall(0.035, H - 0.3), wall(0.3, 0.02), yawIn, 2.2, 0.03);
        }
      } else if (bi.zone === 'entrance') {
        if (bi.door !== undefined) {
          // 扉の向かい: 案内図の電飾の板（客席の区画と扉の番号）と消火器
          guideFrame(Prop.at(sink, mats, wall(0.0, 0), yawIn, sd + 17), 1.6, 1.0, 1.1);
          lightbox(wall(0.09, 1.6), yawIn, 1.6, 1.0, 8 + (i % 2));
          extinguisher(Prop.at(sink, mats, wall(0.2, 0, 1.4), yawIn, sd + 18));
          wash(wall(0.035, H - 0.3), wall(0.3, 0.02), yawIn, 2.2, 0.03);
        } else {
          poster(wall(0.03, 1.6, -0.5), yawIn);
          poster(wall(0.03, 1.6, 0.5), yawIn);
          lightbox(wall(0.06, 1.6, 1.55), yawIn, 0.9, 0.56, 10 + (i % 2));
        }
      }
      // 外の壁の横木（腰と上）: 展示のベイは板とケースがあるので付けない
      if (bi.zone === 'rest' || bi.zone === 'entrance') {
        const seg = 2 * lv.rOut * Math.sin(Math.PI / BAYS);
        const q = at(lv.rOut - 0.06, 0);
        b.box(m.frame, [q[0], lv.y + 0.92, q[2]], [seg, 0.05, 0.08], { rotY: yawIn, shadow: false });
        b.box(m.frame, [q[0], lv.y + 2.45, q[2]], [seg, 0.04, 0.04], { rotY: yawIn, shadow: false });
      }

      // ---- ドラムの面 ----
      const drum = (dr: number, y: number, dt = 0): V3 => at(lv.rIn + dr, y, dt);
      const halfArc = ((BAY_DEG * Math.PI) / 180 / 2) * lv.rIn;
      if (bi.zone === 'exhibit') {
        // 吸音の布の板（柱の間に 3 列。1 列は縦に 3 枚、継ぎ目 2.5 cm。板ごとに 2 色を市松に: 反物ごとの違い）。
        // 中の列の下は壁の陳列棚（中から照らす）
        const span = 2 * halfArc - 0.9;
        const pw = (span - 0.05) / 3;
        const vTop = 2.2;
        for (let j = 0; j < 3; j++) {
          const dt = -span / 2 + pw / 2 + j * (pw + 0.025);
          const y0 = j === 1 ? vTop + 0.08 : 1.0;
          const y1 = H - 0.4;
          const rows = j === 1 ? 1 : 3;
          const ph = (y1 - y0 - (rows - 1) * 0.025) / rows;
          for (let r = 0; r < rows; r++) {
            const ya = y0 + r * (ph + 0.025);
            b.box((i + j + r) % 2 ? acoustic(ctx, 0) : acoustic(ctx, 1), drum(0.035, ya + ph / 2, dt), [pw, ph, 0.04], { rotY: yawOut, shadow: false });
          }
        }
        wallVitrine(Prop.at(sink, mats, drum(0.015, 1.05), yawOut, sd + 24), pw - 0.1, vTop - 1.05);
        fx.glow(drum(0.03, 1.6), yawOut, pw + 0.6, 1.8, '#9fd6f0', 0.05);
        // 板の下の真鍮の見切り
        b.box(brass, drum(0.03, 0.97), [span, 0.03, 0.05], { rotY: yawOut, shadow: false });
      } else if (bi.zone === 'rest' || (bi.zone === 'entrance' && bi.door === undefined)) {
        // 星の壁: 光ファイバーの星を植えた紺の布の板（柱の間に 3 列 × 3 段・継ぎ目 2.5 cm）と、中の列の壁付け灯
        {
          const span = 2 * halfArc - 0.9;
          const pw = (span - 0.05) / 3;
          const y0 = 1.0;
          const y1 = H - 0.4;
          const ph3 = (y1 - y0 - 2 * 0.025) / 3;
          for (let j = 0; j < 3; j++)
            for (let r = 0; r < 3; r++) {
              const dt = -span / 2 + pw / 2 + j * (pw + 0.025);
              b.box((i + j + r) % 2 ? acoustic(ctx, 2) : acoustic(ctx, 3), drum(0.035, y0 + r * (ph3 + 0.025) + ph3 / 2, dt), [pw, ph3, 0.04], { rotY: yawOut, shadow: false });
            }
          b.box(brass, drum(0.03, 0.97), [span, 0.03, 0.05], { rotY: yawOut, shadow: false });
        }
        const p = drum(0.056, 2.0);
        wallSconce(Prop.at(sink, mats, p, yawOut, sd + 19));
        fx.glow(drum(0.015, 2.0), yawOut, 1.0, 1.9, '#ffdcb4', 0.07);
      }
      if (bi.zone === 'entrance' || (bi.zone === 'lobby' && bi.door !== undefined)) {
        // 壁の手すり（扉の口と柱を避けて弧に沿う）
        const y = 0.86;
        const dph = bi.door !== undefined ? (bi.door * Math.PI) / 180 : null;
        const pts: THREE.Vector3[][] = [];
        let cur: THREE.Vector3[] = [];
        const steps = 24;
        for (let s = 0; s <= steps; s++) {
          const a = ph - (BAY_DEG * Math.PI) / 360 + ((BAY_DEG * Math.PI) / 180) * (s / steps);
          const nearDoor = dph !== null && Math.abs(a - dph) * lv.rIn < 1.85;
          const nearPier = Math.abs(a - Math.round(a / ((BAY_DEG * Math.PI) / 180)) * ((BAY_DEG * Math.PI) / 180)) * lv.rIn < 0.45;
          if (nearDoor || nearPier) {
            if (cur.length > 1) pts.push(cur);
            cur = [];
            continue;
          }
          const q = onDrum(lv.rIn + 0.1, a, lv.y + y);
          cur.push(new THREE.Vector3(...q));
        }
        if (cur.length > 1) pts.push(cur);
        for (const run of pts) {
          b.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(run), Math.max(2, run.length * 2), 0.02, 6, false), railMat(ctx), [0, 0, 0], { shadow: false });
          for (let s = 0; s < run.length; s += 6) {
            const v = run[s];
            const a = Math.atan2(v.x - DOME.cx, -(v.z - DOME.cz));
            railBracket(Prop.at(sink, mats, onDrum(lv.rIn + 0.005, a, lv.y), Math.PI - a, sd + 20 + s), y);
          }
        }
      }
      if (bi.door !== undefined) {
        const dph = (bi.door * Math.PI) / 180;
        const dat = (dr: number, y: number, dt = 0): V3 => onDrum(lv.rIn + dr, dph + dt / lv.rIn, lv.y + y);
        // 開いて壁に沿う扉の板 2 枚（蝶番は口の側）
        for (const s of [-1, 1]) doorLeaf(Prop.at(sink, mats, dat(0.09, 0, s * (DOORS.w / 2 + 0.25 + 0.49)), Math.PI - dph, sd + 21), 0.98, 2.42, s < 0);
        // 上の案内の箱と番号・誘導灯（脇）
        doorHeader(Prop.at(sink, mats, dat(0.02, DOORS.h + 0.08), Math.PI - dph, sd + 22), 2.7, 1 + (DOORS.ground.concat(DOORS.upper).indexOf(bi.door) % 5));
        exitSign(Prop.at(sink, mats, dat(0.02, DOORS.h + 0.25, -1.75 * (lv.n === 1 ? 1 : -1)), Math.PI - dph, sd + 23));
        // 扉の両脇を洗う光（扉の板が見える）
        for (const s of [-1, 1]) wash(dat(0.12, H - 0.3, s * 1.7), dat(0.4, 0.02, s * 1.7), Math.PI - dph, 1.6, 0.035);
        // 床の象眼
        inlay(onDrum(lv.rIn + 1.45, dph, lv.y));
      }
    }
  }
  return lightbox;
}

let acousticMats: THREE.Material[] | null = null;
let acousticCtx: SceneContext | null = null;
/** 吸音の布の板の材質（2 色: 布の反物ごとの違い） */
function acoustic(ctx: SceneContext, k: number): THREE.Material {
  if (!acousticMats || acousticCtx !== ctx) {
    acousticCtx = ctx;
    acousticMats = [
      ctx.mat({ color: '#29495a', toon: 0, roughness: 1, line: 0, name: 'o-acoustic-a' }),
      ctx.mat({ color: '#23404f', toon: 0, roughness: 1, line: 0, name: 'o-acoustic-b' }),
      // 星の壁の紺の布（2 つの反物）
      ctx.mat({ color: '#142a3a', toon: 0, roughness: 1, line: 0, name: 'o-starcloth-a' }),
      ctx.mat({ color: '#112433', toon: 0, roughness: 1, line: 0, name: 'o-starcloth-b' }),
    ];
  }
  return acousticMats[k];
}
let baffleM: THREE.Material | null = null;
let baffleCtx: SceneContext | null = null;
/** 天井の木の羽根板の材質 */
function baffle(ctx: SceneContext): THREE.Material {
  if (!baffleM || baffleCtx !== ctx) {
    baffleCtx = ctx;
    baffleM = ctx.mat({ color: '#4a5f63', toon: 0, roughness: 0.8, line: 0, name: 'o-baffle' });
  }
  return baffleM;
}
let railM: THREE.Material | null = null;
let railCtx: SceneContext | null = null;
function railMat(ctx: SceneContext): THREE.Material {
  if (!railM || railCtx !== ctx) {
    railCtx = ctx;
    railM = ctx.mat({ color: '#7d909a', toon: 0, roughness: 0.3, metalness: 0.5, line: 0, name: 'o-handrail' });
  }
  return railM;
}

/**
 * 吊った惑星の球: 頂点の色に、模型を照らすスポット（斜め上・回廊の外の側から）の陰影を塗る。
 * 明暗の境はなめらか（明るい側 → 暗い側）、下ほど少し暗く、土星は環の影の帯。下から見上げても球に見える
 */
function shadedSphere(c: V3, r: number, color: string, ring: boolean, yaw: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(r, 28, 18);
  // 模型の塗りの色（色相は保ち、少し灰へ寄せて暗く。大ドームの青い色寄せは掛けない: 黄土色が緑に転ばないように）
  const base = new THREE.Color(color);
  const grey = (base.r + base.g + base.b) / 3;
  base.lerp(new THREE.Color(grey, grey, grey), 0.25).multiplyScalar(0.6);
  const Ld = new THREE.Vector3(0.55, 0.62, 0.56).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).normalize();
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    n.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
    const ndl = n.dot(Ld);
    // 明暗の境（なめらかな段）と、暗い側の照り返し
    let k = 0.07 + 0.93 * THREE.MathUtils.smoothstep(ndl, -0.05, 0.65);
    // 下ほど少し暗い（上からの照明の自分の影・天井の受けの側の照り返しが無い）
    k *= 0.8 + 0.2 * (n.y * 0.5 + 0.5);
    if (ring && Math.abs(n.y + 0.18) < 0.07 && ndl > -0.1) k *= 0.55;
    col[i * 3] = base.r * k;
    col[i * 3 + 1] = base.g * k;
    col[i * 3 + 2] = base.b * k;
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.translate(c[0], c[1], c[2]);
  return g;
}
