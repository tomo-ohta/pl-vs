import * as THREE from 'three';
import type { RoomId } from './layout.ts';

/**
 * サーバー室ごとの見た目（参考画像ごとの色合い）。3 枚は照明の色と空気が違う（B = 青、A = 淡い青緑、C = 灰青緑で奥が光る）。
 * 色は参考画像から --sample で拾い、霧の掛かり方を差し引いて決めた（docs/stages/serverroom.md の色の表）。
 */
export interface RoomLook {
  /** 霧の色・濃さ */
  fog: string;
  fogDensity: number;
  /** 霧が始まる距離（手前のラックの暗い色を霧で灰色にしない） */
  fogStart: number;
  /** 後処理の彩度 */
  saturation: number;
  /** 輪郭線の濃さ */
  lines?: number;
  /** 霧の高さの減り方（大きいほど床の近くだけ濃い） */
  fogHeight?: number;
  /** 絵の具の塊（異方性クワハラ。serverroom-1 の太い筆の跡） */
  kuwahara?: number;
  /** ラックの取っ手の色 */
  handle: string;
  /** 床（日なた・陰・暗部・明るい所）と目地 */
  floor: [string, string, string, string];
  joint: string;
  /** 壁の内張り（日なた・陰・暗部・明るい所） */
  wall: [string, string, string, string?];
  /** 天井 */
  ceil: [string, string, string];
  /** 北の扉の色 */
  door: string;
  /** ガラス（正面の色・不透明度・斜めの色・不透明度・鋭さ） */
  glass: { color: string; opacity: number; edge: string; edgeOpacity: number; power: number; floorGlow?: [number, number]; reflect?: number; rack?: string; frame?: string; light?: string };
  /** LED の明るさ */
  led: number;
  /** 機器の前面の図柄に掛ける色（部屋の色合い。C は紺へ寄せる） */
  faceTint?: string;
  /** 頂点の色（ラックの本体・設備）を部屋の色合いへ寄せる: OKLab の明度の倍率・彩度の倍率・色相の回転（度） */
  tone: [number, number, number];
  /** 床の映り込みの強さ */
  reflect: number;
}

export const LOOKS: Record<RoomId, RoomLook> = {
  A: {
    fog: '#62b2be',
    fogDensity: 0.07,
    fogStart: 3.0,
    fogHeight: 0.3,
    saturation: 1.15,
    lines: 0.4,
    handle: '#0a1a22',
    floor: ['#caf2f6', '#ade0e6', '#8ac4cc', '#dcf8fa'],
    joint: '#7fc3cb',
    wall: ['#6cb4bc', '#5ca0a8', '#46868f'],
    ceil: ['#285e6c', '#214f5c', '#183e4a'],
    door: '#1f6a78',
    glass: { color: '#08202a', opacity: 0.38, edge: '#3f92a8', edgeOpacity: 0.65, power: 2.6, floorGlow: [0.35, 1.0], reflect: 0.45, rack: '#0c2f3c', frame: '#3d8c9e', light: '#8fd4dc' },
    led: 3.2,
    faceTint: '#b4c4cc',
    tone: [1.0, 1.05, 0],
    reflect: 0.5,
  },
  B: {
    fog: '#4aaad0',
    fogDensity: 0.055,
    fogStart: 3.0,
    saturation: 1.04,
    lines: 0.6,
    handle: '#2f6478',
    floor: ['#8ae4fa', '#70c8e4', '#52a6c6', '#a8f2ff'],
    joint: '#62b8d4',
    wall: ['#45a6c6', '#3a8fae', '#2a7090', '#7ae0f2'],
    ceil: ['#22627e', '#1a5068', '#123c50'],
    door: '#0a5373',
    glass: { color: '#071c2a', opacity: 0.4, edge: '#3a8cb0', edgeOpacity: 0.6, power: 2.8, floorGlow: [0.3, 0.9], reflect: 0.45, rack: '#0a2838', frame: '#2f86a8', light: '#6fc4e0' },
    led: 3.0,
    faceTint: '#a8bcc8',
    tone: [0.95, 1.0, -4],
    reflect: 0.65,
  },
  C: {
    fog: '#86c8c2',
    fogDensity: 0.085,
    fogStart: 2.5,
    fogHeight: 0.55,
    kuwahara: 4,
    saturation: 1.12,
    handle: '#1a3346',
    floor: ['#9cdad4', '#84c2be', '#66a4a2', '#e8f7f5'],
    joint: '#76b4b0',
    wall: ['#3f7a8a', '#356a78', '#2a5664', '#a8dcd6'],
    ceil: ['#2c5f6e', '#244f5c', '#1a3d48'],
    door: '#6aa6a4',
    glass: { color: '#08142a', opacity: 0.4, edge: '#3f88aa', edgeOpacity: 0.6, power: 2.8, floorGlow: [0.2, 0.8], reflect: 0.4, rack: '#0c1e36', frame: '#2f6a88', light: '#8fcfcc' },
    led: 3.2,
    faceTint: '#c8d6ff',
    tone: [0.95, 1.05, 10],
    reflect: 0.55,
  },
};

/** sRGB の 16 進の色を OKLab で変える（明度の倍率・彩度の倍率・色相の回転） */
export function toneHex(hex: string, [lm, cm, hue]: [number, number, number]): string {
  if (lm === 1 && cm === 1 && hue === 0) return hex;
  const c = new THREE.Color(hex);
  const l = Math.cbrt(0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b);
  const m = Math.cbrt(0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b);
  const s = Math.cbrt(0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827607001 * m - 0.808675766 * s;
  const h = Math.atan2(B, A) + (hue * Math.PI) / 180;
  const ch = Math.hypot(A, B) * cm;
  const L2 = L * lm;
  const a2 = Math.cos(h) * ch;
  const b2 = Math.sin(h) * ch;
  const l3 = (L2 + 0.3963377774 * a2 + 0.2158037573 * b2) ** 3;
  const m3 = (L2 - 0.1055613458 * a2 - 0.0638541728 * b2) ** 3;
  const s3 = (L2 - 0.0894841775 * a2 - 1.291485548 * b2) ** 3;
  const out = new THREE.Color(
    Math.max(0, 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3),
    Math.max(0, -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3),
    Math.max(0, -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3),
  );
  return `#${out.getHexString()}`;
}
