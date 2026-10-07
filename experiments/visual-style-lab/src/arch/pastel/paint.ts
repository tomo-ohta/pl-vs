import * as THREE from 'three';
import { createPaint, type CovShape, type FaceColors, type PaintLayer, type PaintOptions } from '../../render/PaintMaterial.ts';
import { shiftColor } from '../../render/Style.ts';
import { BLDG, DOORS, ROOMS, WINDOWS, type Rect, type RoomDef } from './layout.ts';

/**
 * 淡色の廊下（建築版）の塗り。元の版と同じ「照明を使わない面ごとの色」（PaintMaterial）で、
 * 写っていない所の色は参考画像の色の表（セージ・クリーム・灰青・白・暗い青緑）から選ぶ。
 *
 * 面ごとの色の決まり（写っていない所）: 南の窓と玄関からの柔らかい光とみなし、
 * 上面 = 明るく、南向き = そのまま、東向き・西向き = 少し暗く、北向き = もう少し暗く、下面 = いちばん暗い。
 */

export const WHITE = '#f5f7ea';

export const hex = (c: THREE.Color): string => `#${c.getHexString()}`;

/** 面の向きごとの明るさ（OKLab の明度の倍率） */
const FACE_L = { py: 1.05, pz: 1.0, px: 0.975, nx: 0.96, nz: 0.93, ny: 0.86 };

/** 1 色から面ごとの色を作る */
export function faces(base: string, k = 1): Record<'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz', string> {
  const f = (m: number): string => `#${shiftColor(base, [1 + (m - 1) * k, 1, 0]).getHexString()}`;
  return { px: f(FACE_L.px), nx: f(FACE_L.nx), py: f(FACE_L.py), ny: f(FACE_L.ny), pz: f(FACE_L.pz), nz: f(FACE_L.nz) };
}

/**
 * 柱型の横の面の暗さ（参考画像の廊下の柱型: 壁 #a5b5ab → 横の面 #8a9b95。明度で約 0.89 倍）。
 * 壁に沿った柱型は、壁に垂直な面（axis の ± の面）を 1 段暗くする
 */
export const PIL_SIDE = 0.89;

/** 面ごとの色の、axis の向きの 2 面だけ明度を k 倍する */
export function darkenAxis(c: Record<string, string>, axis: 'x' | 'z', k = PIL_SIDE): Record<string, string> {
  const out = { ...c };
  for (const f of axis === 'x' ? ['px', 'nx'] : ['pz', 'nz']) if (out[f]) out[f] = `#${shiftColor(out[f], [k, 1, 0]).getHexString()}`;
  return out;
}

/** 材質の置き場（同じ指定は同じ材質 → まとめて描ける） */
export class Paints {
  private readonly cache = new Map<string, THREE.ShaderMaterial>();
  /** 雪の分布の絵（上から見た図。床・壁の足元で共有） */
  readonly snow: { texture: THREE.DataTexture; rect: Rect };

  constructor() {
    this.snow = snowCoverage();
  }

  get(key: string, make: () => PaintOptions): THREE.ShaderMaterial {
    let m = this.cache.get(key);
    // 灯りの光だまりは床だけに使う（窓の前の床）。ほかの塗りは灯りの計算を飛ばす（16 個の灯りを画素ごとに回すと重い）
    if (!m) this.cache.set(key, (m = createPaint({ lamp: 0, ...make() })));
    return m;
  }

  /** 物の色（面ごとの陰を付けた 1 色） */
  solid(base: string, k = 1): THREE.ShaderMaterial {
    return this.get(`solid|${base}|${k}`, () => ({ color: faces(base, k) }));
  }

  /** 面ごとの色を直接 */
  face(c: FaceColors, key?: string): THREE.ShaderMaterial {
    return this.get(`face|${key ?? JSON.stringify(c)}`, () => ({ color: c }));
  }

  /** 光る物（灯り・シャウカステン・外の明るい面） */
  glow(c: string): THREE.ShaderMaterial {
    return this.get(`glow|${c}`, () => ({ color: c, noFog: true }));
  }

  /** 部屋の壁（腰壁つき・足元に雪の白い塗り。雪は分布の絵を読む） */
  wall(p: WallPalette): THREE.ShaderMaterial {
    return this.get(`wall|${JSON.stringify(p)}`, () => wallPaint(p, this.snow));
  }

  /** 床（雪の分布の絵を読む。元の版の床と同じ層） */
  floor(color = '#768987'): THREE.ShaderMaterial {
    return this.get(`floor|${color}`, () => ({ ...floorPaint(this.snow, color), lamp: 1 }));
  }

  /**
   * 部屋の床（扉の敷居で廊下・待合と分かれる部屋）。廊下と同じ塗りで、明るい灰青の筋（層 0）だけ少なく・縁を細かく割らない
   *（部屋は廊下より雪が吹き込まず、細かい筋が画面いっぱいに出ると参考画像より細かい模様が多くなった）
   */
  roomFloor(): THREE.ShaderMaterial {
    return this.get('roomFloor', () => ({ ...floorPaint(this.snow, '#768987', 0.78, 0.45), lamp: 1 }));
  }

  /** タイルの床（便所・給湯室・通用口の土間）。目地は全面、雪は分布の絵 */
  tileFloor(color: string, size: number, joint: string): THREE.ShaderMaterial {
    return this.get(`tileFloor|${color}|${size}|${joint}`, () => ({
      color,
      cov: this.snow,
      layers: [
        { color, scale: 1, threshold: -9, only: 'floor' },
        { color: '#c2ccc6', scale: 2.0, threshold: 0.92, cov: 0.62, stretch: [0.35, 4.0], detail: 0.6, only: 'floor', seed: 2 },
        { color: '#dde2da', scale: 2.0, threshold: 0.95, cov: 0.62, stretch: [0.35, 4.0], detail: 0.6, only: 'floor', seed: 3 },
        { color: WHITE, scale: 1.8, threshold: 0.95, cov: 0.8, stretch: [0.35, 4.0], detail: 0.6, only: 'floor', seed: 4 },
      ],
      grid: { layer: 0, size: [size, size], width: 0.012, color: joint },
    }));
  }

  /** タイルの壁（全面。目地つき） */
  tileWall(color: string, size: number, joint: string): THREE.ShaderMaterial {
    return this.get(`tileWall|${color}|${size}|${joint}`, () => ({
      color: faces(color, 0.6),
      cov: this.snow,
      layers: [
        { color: faces(color, 0.6), scale: 1, threshold: -9, only: 'wall' },
        { color: '#ffffff', scale: 1, threshold: 9, only: 'ceil' },
        { color: '#ffffff', scale: 1, threshold: 9, only: 'ceil' },
        { color: WHITE, scale: 2.2, threshold: 0.92, yRange: [0.03, 0.42], yGain: 1.1, detail: 0.55, only: 'wall', seed: 6, cov: 0.75 },
      ],
      grid: { layer: 0, size: [size, size], width: 0.008, color: joint },
    }));
  }

  /** 天井（薄いしみ） */
  ceil(color: string): THREE.ShaderMaterial {
    return this.get(`ceil|${color}`, () => ({
      color: faces(color),
      layers: [{ color: shiftColor(color, [1.07, 0.8, 0]).getHex(), scale: 2.5, threshold: 0.86, stretch: [0.5, 2.5], detail: 0.45, only: 'ceil', seed: 25 }],
    }));
  }

  /**
   * 梁（天井の色の 1 段暗い帯。参考画像の廊下の梁 #9db2ab は天井 #a8bcb3 より少し暗い）。
   * 下の面は天井の下の面（0.86 倍）より少し暗く、横の面は向きで少しずつ変える
   */
  beam(color: string): THREE.ShaderMaterial {
    const f = (m: number): string => hex(shiftColor(color, [m, 1, 0]));
    return this.get(`beam|${color}`, () => ({
      color: { ny: f(0.81), pz: f(0.9), nz: f(0.85), px: f(0.88), nx: f(0.87), py: f(0.9) },
      layers: [{ color: { ny: f(0.88), pz: f(0.95) }, scale: 2.2, threshold: 0.84, stretch: [0.4, 2.5], detail: 0.5, only: 'all', seed: 26 }],
    }));
  }

  /** 幅木（暗い青緑の帯。雪の吹きだまりの所は白い塗りがちぎれて掛かる。参考画像の右の塊の幅木と同じ） */
  baseboard(color: string): THREE.ShaderMaterial {
    return this.get(`baseboard|${color}`, () => ({
      color: faces(color, 0.5),
      cov: this.snow,
      layers: [{ color: WHITE, scale: 4, threshold: 0.9, cov: 0.6, covChannel: 3, detail: 0.45, only: 'wall', seed: 41 }],
    }));
  }

  /** 戸口の内側（壁の厚みの面）。開口の奥まった所の 1 段暗い面（参考画像の塊と枠の間の暗い隙間の考え） */
  reveal(color = '#8a9b95'): THREE.ShaderMaterial {
    return this.get(`reveal|${color}`, () => ({ color: faces(color, 0.6) }));
  }
}

export interface WallPalette {
  /** 上の色・腰壁の色・腰壁の高さ */
  up: string;
  low: string;
  band: number;
  /** はがれた塗りの斑（上の色を明るく）の多さ（0 で無し） */
  flake?: number;
  /** 柱型用: この軸の向きの面（柱型の横の面）を 1 段暗くする */
  side?: 'x' | 'z';
  /** 2 つ目のはがれた塗りの帯（高さの範囲。階段室の 2 階の腰の高さなど） */
  flake2?: [number, number];
  /** 面の向きごとの明度の倍率（窓の光の決まり。shell.ts の windowLight） */
  faceMul?: Partial<Record<'px' | 'nx' | 'pz' | 'nz', number>>;
}

/** 部屋の壁の塗り（面ごとの陰・腰壁の垂れ・はがれ・足元の雪） */
function wallPaint(p: WallPalette, snow: { texture: THREE.Texture; rect: Rect }): PaintOptions {
  const fc = (c: string): Record<string, string> => {
    const f: Record<string, string> = p.side ? darkenAxis(faces(c), p.side) : faces(c);
    for (const [k, m] of Object.entries(p.faceMul ?? {})) if (f[k] && m) f[k] = hex(shiftColor(f[k], [m, 1, 0]));
    return f;
  };
  const layers: PaintLayer[] = [];
  // 0: はがれた塗り: 腰壁のちぎれた上の縁のすぐ上だけに、小さく少し（参考画像の腰壁は落ち着いた灰青の帯で、白は縁の近くの小さな欠けだけ）。
  //    縁からの高さの差でしきい値を上げて（abs）、腰壁の面の上や壁の高い所には出さない
  const flake = p.flake ?? 0.12;
  layers.push({ color: fc(hex(shiftColor(p.up, [1.08, 0.8, 0]))), scale: 3.2, threshold: 0.77 - flake * 0.15, origin: [0, p.band + 0.14, 0], abs: [0, 1.6, 0], detail: 0.45, only: 'wall', seed: 31 });
  // 1: 腰壁の足元の明るい筋（腰壁の色を少し明るく。下の 0.4 m だけ）
  layers.push({ color: fc(hex(shiftColor(p.low, [1.05, 0.92, 0]))), scale: 2.0, threshold: 0.58, yRange: [0.05, 0.45], yGain: 0.8, stretch: [2.5, 0.6], detail: 0.45, only: 'wall', seed: 13 });
  // 2: 2 つ目のはがれた塗りの帯（指定のある壁だけ）
  if (p.flake2) {
    // 帯の真ん中ほど多く、上下の端でなくなる（abs で高さの真ん中からの距離に応じてしきい値を上げる）
    const mid = (p.flake2[0] + p.flake2[1]) / 2;
    const half = Math.max(0.3, (p.flake2[1] - p.flake2[0]) / 2);
    layers.push({ color: fc(hex(shiftColor(p.up, [1.07, 0.8, 0]))), scale: 2.6, threshold: 0.78, origin: [0, mid, 0], abs: [0, 0.3 / half, 0], detail: 0.45, only: 'wall', seed: 37 });
  }
  else layers.push({ color: '#ffffff', scale: 1, threshold: 9, only: 'ceil' });
  // 3: 足元の雪（分布の絵の白。吹きだまりの所だけ壁にも付く）
  layers.push({ color: WHITE, scale: 2.2, threshold: 0.92, yRange: [0.02, 0.32], yGain: 1.3, detail: 0.5, only: 'wall', seed: 6, cov: 0.65 });
  return {
    color: fc(p.up),
    band: { y: p.band, color: fc(p.low), amp: 0.04, scale: 1.2, drip: 0.12 },
    layers,
    cov: snow,
  };
}

/** 床の塗り（元の版の床と同じ 4 層。分布の絵で場所ごとの多さを決める） */
function floorPaint(snow: { texture: THREE.Texture; rect: Rect }, color: string, l0 = 0.68, d0 = 0.6): PaintOptions {
  return {
    color,
    cov: snow,
    layers: [
      { color: '#a5b5b5', scale: 2.0, threshold: l0, cov: 0.6, stretch: [0.35, 4.0], detail: d0, only: 'floor', seed: 1 },
      { color: '#a9bfbd', scale: 2.0, threshold: 0.92, cov: 0.62, stretch: [0.35, 4.0], detail: 0.6, only: 'floor', seed: 2 },
      { color: '#cbd2cb', scale: 2.0, threshold: 0.95, cov: 0.62, stretch: [0.35, 4.0], detail: 0.6, only: 'floor', seed: 3 },
      { color: WHITE, scale: 1.8, threshold: 0.95, cov: 0.8, stretch: [0.35, 4.0], detail: 0.6, only: 'floor', seed: 4 },
    ],
  };
}

// ---------------------------------------------------------------- 雪の分布の絵

/**
 * 分布の絵の範囲（建物と風除室・通用口を含む）と画素の数。元の版の床の絵（x -2.4〜2.4 を 77 画素・z 2〜-23 を 400 画素）と
 * 画素の位置がそろうように広げる（参考画像の視点の床の斑の縁が元の版と同じ所に出る）
 */
const DX = 4.8 / 77;
const DZ = 0.0625;
const SNOW_W = 77 + 87 * 2;
const SNOW_H = 400 + 55 + 13;
export const SNOW_RECT: Rect = [-2.4 - 87 * DX, 2 + 55 * DZ, -2.4 - 87 * DX + SNOW_W * DX, 2 + 55 * DZ - SNOW_H * DZ];

/** 元の版の床の手で置いた分布（参考画像の視点の廊下・奥の区画）。そのまま */
const VIEW_SHAPES: CovShape[] = [
  { ch: 1, seg: [-1.35, -5.0, -1.15, -9.0], w: 0.45, soft: 0.3 },
  { ch: 1, seg: [-1.35, -9.0, -1.3, -12.5], w: 0.2, soft: 0.2, v: 0.8 },
  { ch: 1, seg: [1.0, -6.0, 1.0, -8.5], w: 0.25, soft: 0.2 },
  { ch: 0, e: [-0.2, -3.38, 1.1, 0.16] },
  { ch: 0, e: [0.1, -4.0, 0.4, 0.3] },
  { ch: 1, e: [0, -18.5, 1.0, 1.5], v: 0.7 },
  { ch: 1, seg: [-1.6, -4.7, -1.3, -6.0], w: 0.4, soft: 0.3 },
  { ch: 1, e: [0.9, -15, 0.4, 2], v: 0.8 },
  { ch: 2, seg: [1.05, -4.3, 1.15, -6.6], w: 0.55, soft: 0.3 },
  { ch: 2, seg: [0, -16.5, 0, -22], w: 1.6, soft: 1.5 },
  { ch: 2, e: [-1.0, -4.8, 0.8, 0.45], v: 0.9 },
  { ch: 3, seg: [-3, -4.0, -1.1, -4.0], w: 0.42, soft: 0.25 },
  { ch: 3, seg: [-1.1, -4.05, -0.3, -4.05], w: 0.12, soft: 0.2, v: 0.8 },
  { ch: 3, seg: [0.95, -4.0, 3, -4.0], w: 0.45, soft: 0.2 },
  { ch: 3, seg: [1.3, -3.6, 3, -3.6], w: 0.35, soft: 0.2 },
  { ch: 3, e: [-1.5, -4.6, 0.55, 0.55] },
  { ch: 3, e: [1.9, -4.0, 0.8, 0.3] },
  { ch: 3, e: [-0.7, -14.5, 0.9, 1.6], v: 0.85 },
  { ch: 3, seg: [-1.5, -10.55, 1.2, -10.55], w: 0.1, soft: 0.2, v: 0.7 },
  { ch: 3, seg: [-1.5, -12.35, 1.2, -12.35], w: 0.15, soft: 0.2, v: 0.75 },
  { ch: 3, seg: [-1.5, -13.55, 1.2, -13.55], w: 0.15, soft: 0.2, v: 0.8 },
  { ch: 3, seg: [-1.76, -5, -1.76, -9], w: 0.05, soft: 0.15, v: 0.6 },
];

/**
 * 決まりで作る分布（参考画像に写らない所）:
 * - 壁ぎわの吹きだまり（部屋の 4 辺）: 部屋の雪の多さ（外の開口からの近さ）で強さを変える
 * - 割れた窓の下・玄関の割れたガラス・通用口の扉の下に雪の山（白）と、その周りに白っぽい灰
 * - 扉の口: 風が抜けるので敷居の所に薄い筋
 * 参考画像の視点に写る床（廊下・奥の区画・北の塊の前）には足さない（元の版の手で置いた分布のまま）
 */
function ruleShapes(): CovShape[] {
  const out: CovShape[] = [];
  const edge = (r: RoomDef, sides: ('n' | 's' | 'w' | 'e')[]): void => {
    const [x0, z0, x1, z1] = r.rect;
    const k = r.snow;
    const segs: Record<string, [number, number, number, number]> = { n: [x0, z0, x1, z0], s: [x0, z1, x1, z1], w: [x0, z0, x0, z1], e: [x1, z0, x1, z1] };
    for (const s of sides) {
      const g = segs[s];
      // 白い吹きだまりは雪の少ない部屋の壁ぎわにも細く残す（参考画像はどの壁の足元も白い）
      out.push({ ch: 3, seg: g, w: 0.1 + 0.18 * k, soft: 0.15 + 0.2 * k, v: 0.5 + 0.45 * k });
      // 灰色の斑（白っぽい灰・明るい灰青）は細く・薄く: 床の暗い灰青を残す（参考画像の床は半分ほどが暗い色）
      out.push({ ch: 2, seg: g, w: 0.06 + 0.22 * k, soft: 0.3, v: 0.4 + 0.4 * k });
      out.push({ ch: 1, seg: g, w: 0.15 + 0.35 * k, soft: 0.4, v: 0.35 + 0.3 * k });
    }
  };
  for (const r of ROOMS) {
    if (r.view) continue;
    if (r.id === 'LOBBY') {
      // 北の壁（参考画像に写る x -3.3〜2.9 の前）は元の版の分布のまま。西・東・南の壁と、北の壁の外側
      edge(r, ['w', 'e', 's']);
      out.push({ ch: 3, seg: [-7.2, -4.18, -4.6, -4.18], w: 0.3, soft: 0.3, v: 0.9 });
      out.push({ ch: 2, seg: [-7.2, -4.18, -4.6, -4.18], w: 0.6, soft: 0.4, v: 0.9 });
      out.push({ ch: 3, seg: [4.3, -4.28, 7.2, -4.28], w: 0.3, soft: 0.3, v: 0.9 });
      out.push({ ch: 2, seg: [4.3, -4.28, 7.2, -4.28], w: 0.6, soft: 0.4, v: 0.9 });
      // 玄関から吹き込んだ雪（風除室の口から北へ扇形に薄くなる）
      out.push({ ch: 3, e: [0, 2.4, 2.2, 1.0], soft: 0.6 });
      out.push({ ch: 3, e: [0.4, 0.9, 1.4, 1.2], soft: 0.8, v: 0.8 });
      out.push({ ch: 2, e: [0, 1.0, 3.6, 2.4], soft: 0.6 });
      out.push({ ch: 1, e: [0, -0.5, 5.0, 2.6], soft: 0.7, v: 0.9 });
      out.push({ ch: 3, e: [-1.6, -1.2, 0.9, 0.5], soft: 0.8, v: 0.7 });
      out.push({ ch: 3, e: [1.9, -1.8, 0.8, 0.5], soft: 0.8, v: 0.65 });
      continue;
    }
    edge(r, ['n', 's', 'w', 'e']);
  }
  // 部屋の床の全体にも薄く白い斑（参考画像の床は壁ぎわだけでなく全体に白い斑がある）。壁ぎわ・開口の近くの方が多いのは上の決まり
  for (const r of ROOMS) {
    if (r.view) continue;
    const [x0, z0, x1, z1] = r.rect;
    out.push({ ch: 3, e: [(x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) * 0.62, (z1 - z0) * 0.62], v: 0.05 + 0.08 * r.snow, soft: 0.7 });
  }
  // 割れた窓の下（窓の内側に山）
  for (const w of WINDOWS) {
    if (!w.broken || w.y0 > 2) continue;
    const m = (w.a + w.b) / 2;
    const L = (w.b - w.a) / 2;
    const inX = w.wall === 'z' ? w.line - w.out * (w.thick / 2) : m;
    const inZ = w.wall === 'x' ? w.line - w.out * (w.thick / 2) : m;
    const along: [number, number] = w.wall === 'z' ? [0.5, L] : [L, 0.5];
    const dir: [number, number] = w.wall === 'z' ? [-w.out, 0] : [0, -w.out];
    out.push({ ch: 3, e: [inX + dir[0] * 0.3, inZ + dir[1] * 0.3, along[0] + 0.5 * Math.abs(dir[0]), along[1] + 0.5 * Math.abs(dir[1])], soft: 0.5 });
    out.push({ ch: 2, e: [inX + dir[0] * 0.8, inZ + dir[1] * 0.8, along[0] + 1.4 * Math.abs(dir[0]) + 0.4, along[1] + 1.4 * Math.abs(dir[1]) + 0.4], soft: 0.6 });
    out.push({ ch: 1, e: [inX + dir[0] * 1.4, inZ + dir[1] * 1.4, along[0] + 2.4 * Math.abs(dir[0]) + 0.8, along[1] + 2.4 * Math.abs(dir[1]) + 0.8], soft: 0.7 });
  }
  // 風除室（外の扉の割れたガラスの内側に大きな山）・通用口（扉の下）
  out.push({ ch: 3, e: [0.6, 4.4, 1.3, 0.7], soft: 0.5 });
  out.push({ ch: 3, e: [-0.4, 3.6, 1.2, 0.8], soft: 0.7, v: 0.9 });
  out.push({ ch: 3, e: [0, -22.9, 1.4, 0.6], soft: 0.6 });
  out.push({ ch: 2, e: [0, -22.4, 1.6, 1.2], soft: 0.6 });
  // 扉の口の敷居（風の抜け道）
  for (const d of DOORS) {
    if (d.kind === 'pass' || d.kind === 'window' || d.y0 > 0.5) continue;
    if (d.rooms.includes('COR') || d.rooms.includes('BACK')) continue;
    const m = (d.a + d.b) / 2;
    const c: [number, number] = d.wall === 'x' ? [m, d.line] : [d.line, m];
    out.push({ ch: 2, e: [c[0], c[1], d.wall === 'x' ? (d.b - d.a) / 2 : 0.5, d.wall === 'x' ? 0.5 : (d.b - d.a) / 2], soft: 0.7, v: 0.7 });
  }
  return out;
}

/** 参考画像の視点に写る床（決まりの分布を足さない所）。[x0, z0, x1, z1] */
const VIEW_FLOOR: Rect[] = [
  [-3.6, -21.1, 3.2, -3.0], // 北の塊の前〜廊下〜奥の区画
];

/** 上から見た分布の絵（RGBA = 層 0〜3。重なりは大きい方）。形ごとに範囲を絞って速く描く */
function snowCoverage(): { texture: THREE.DataTexture; rect: Rect } {
  const rect = SNOW_RECT;
  const [x0, z0, x1, z1] = rect;
  const W = SNOW_W;
  const H = SNOW_H;
  const acc = new Float32Array(W * H * 4);
  const ss = (a: number, b: number, x: number): number => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const toI = (x: number): number => ((x - x0) / (x1 - x0)) * W - 0.5;
  const toJ = (z: number): number => ((z - z0) / (z1 - z0)) * H - 0.5;
  const draw = (s: CovShape, mask: Rect[] | null): void => {
    let bx0: number;
    let bx1: number;
    let bz0: number;
    let bz1: number;
    if ('e' in s) {
      const [cx, cz, rx, rz] = s.e;
      bx0 = cx - rx;
      bx1 = cx + rx;
      bz0 = cz - rz;
      bz1 = cz + rz;
    } else {
      const [ax, az, bx, bz] = s.seg;
      const r = s.w + (s.soft ?? 0.3);
      bx0 = Math.min(ax, bx) - r;
      bx1 = Math.max(ax, bx) + r;
      bz0 = Math.min(az, bz) - r;
      bz1 = Math.max(az, bz) + r;
    }
    const i0 = Math.max(0, Math.floor(toI(bx0)));
    const i1 = Math.min(W - 1, Math.ceil(toI(bx1)));
    const j0 = Math.max(0, Math.floor(Math.min(toJ(bz0), toJ(bz1))));
    const j1 = Math.min(H - 1, Math.ceil(Math.max(toJ(bz0), toJ(bz1))));
    const v = s.v ?? 1;
    for (let j = j0; j <= j1; j++) {
      const z = z0 + ((j + 0.5) / H) * (z1 - z0);
      for (let i = i0; i <= i1; i++) {
        const x = x0 + ((i + 0.5) / W) * (x1 - x0);
        if (mask && mask.some((m) => x >= m[0] && x <= m[2] && z >= m[1] && z <= m[3])) continue;
        let val: number;
        if ('e' in s) {
          const [cx, cz, rx, rz] = s.e;
          const d = Math.hypot((x - cx) / rx, (z - cz) / rz);
          val = v * (1 - ss(1 - (s.soft ?? 0.5), 1, d));
        } else {
          const [ax, az, bx, bz] = s.seg;
          const vx = bx - ax;
          const vz = bz - az;
          const t = Math.min(1, Math.max(0, ((x - ax) * vx + (z - az) * vz) / Math.max(vx * vx + vz * vz, 1e-9)));
          const d = Math.hypot(x - (ax + vx * t), z - (az + vz * t));
          val = v * (1 - ss(s.w, s.w + (s.soft ?? 0.3), d));
        }
        const k = (j * W + i) * 4 + s.ch;
        if (val > acc[k]) acc[k] = val;
      }
    }
  };
  for (const s of VIEW_SHAPES) draw(s, null);
  for (const s of ruleShapes()) draw(s, VIEW_FLOOR);
  const data = new Uint8Array(W * H * 4);
  for (let i = 0; i < data.length; i++) data[i] = Math.round(Math.min(1, acc[i]) * 255);
  const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  void BLDG;
  return { texture: t, rect };
}
