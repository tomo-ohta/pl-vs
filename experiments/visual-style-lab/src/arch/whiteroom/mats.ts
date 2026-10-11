import type * as THREE from 'three';
import type { SceneContext } from '../../scenes/types.ts';
import { addBrush, type BrushOptions } from './brush.ts';

/**
 * whiteroom の材質。色は参考画像から --sample で拾った値（sRGB）を、日なた（color）・陰（shade）・暗部（dark）・明るい所（hi）に直接書く。
 * 中庭ごとに色の表が違う（A = 緑みの灰・深い緑の陰、B = 生成りのクリーム・青緑の陰、C = 淡い灰緑・霧で陰も淡い）。
 * どの面にも筆の跡（brush.ts）・小さな濃い点（flecks）を入れる。
 */
export interface Tone {
  color: string;
  shade: string;
  dark?: string;
  hi?: string;
}

export type Court = 'A' | 'B' | 'C';

/** 中庭ごとの色の表 */
export const PAL: Record<Court, Record<string, Tone>> = {
  A: {
    // 壁: 日なた #abbdaf〜#b1c7ba、陰 #2b463b〜#345648、深い凹み #1e2c29
    wall: { color: '#b0c5b7', shade: '#3a5d4f', dark: '#1f302b', hi: '#c3d6c8' },
    // 床: 日なた #bbd1c1、陰 #202f2c（壁の陰より暗い）
    floor: { color: '#bad0c0', shade: '#253b34', dark: '#192623', hi: '#cfe0d4' },
    // 窓の下の雨の垂れ（日なたの壁の上の暗い筋・陰の壁の上の暗い筋）
    stain: { color: '#93ab9d', shade: '#2f4a3f', dark: '#22362e' },
    stainW: { color: '#7d978a', shade: '#2c4639', dark: '#1f3129' },
    // 東の棟の袖壁（中庭の面は日なた #90ac9e、ひさしの影の三角 #284035）
    fin: { color: '#9cb4a6', shade: '#253d33', dark: '#1a2b25', hi: '#b0c5b7' },
    // 手前の暗い帯の舗石 #83a18f（日なた）
    apron: { color: '#86a492', shade: '#2a4239', dark: '#1d2b28' },
    // 屋根のある歩廊の敷石（回廊 = 中庭の床と同じ色、門の通路 = 手前の帯と同じ色）
    floorWalk: { color: '#bad0c0', shade: '#253b34', dark: '#192623', hi: '#cfe0d4' },
    floorPass: { color: '#86a492', shade: '#2a4239', dark: '#1d2b28' },
    // 北の棟の 1 階のロッジア（凹んだ壁・天井）#2d4841〜#263c38
    loggia: { color: '#1f3d32', shade: '#1a352b', dark: '#142821' },
    // 扉・開口の奥 #1b2524〜#22312f
    door: { color: '#22312f', shade: '#1c2826', dark: '#151f1e' },
    // 窓（細い縦長の窓の奥）
    slot: { color: '#1c2a26', shade: '#172320', dark: '#111a18' },
    // 敷地の荒れた地面・遠くの山（霧の向こう）
    ground: { color: '#a6b9a8', shade: '#5a7265', dark: '#3f5248', hi: '#b9c9ba' },
    hill: { color: '#a3b8ab', shade: '#8ea597', dark: '#7d9488' },
    // 部屋の中: 陰の段は中庭の陰と同じ深さ（3 回目の直し: 部屋の中も「くっきりした日なたと深い陰」）。色は造りに従う:
    // 白い漆喰の上の壁は陰でも少し明るく、暗い緑の塗りの腰壁と天井（下を向く面）は深い陰。
    // 窓・光の筒から入る日と灯りの光だまりだけが日なたの段になる。漆喰の壁・床・天井
    inWall: { color: '#d3dfd3', shade: '#4a6455', dark: '#30463b', hi: '#d5e0d4' },
    // 腰壁（暗い緑の塗り）・柱型と梁（打ち放しの濃い灰緑）
    inDado: { color: '#6a8676', shade: '#203228', dark: '#18261f', hi: '#7a9686' },
    inTrim: { color: '#93a99b', shade: '#3a5246', dark: '#283a31', hi: '#a6bbad' },
    inFloor: { color: '#b6c8bb', shade: '#2f4439', dark: '#22332b', hi: '#c6d5c9' },
    inCeil: { color: '#b3c3b7', shade: '#2b3f35', dark: '#1d2c25' },
  },
  B: {
    // 日はほぼ真上なので、縦の面はどれも陰の段（淡い色）。西の棟の面 #cbd7c9、東の棟の面 #b7c7bc
    wallW: { color: '#d0dbcc', shade: '#c8d5c7', dark: '#8fa59c', hi: '#dfe6d7' },
    wall: { color: '#c9d5c7', shade: '#b9c8bc', dark: '#8fa59c', hi: '#dfe6d7' },
    // 庇の下の 1 階の壁（いつも庇の陰）#3c6060・#385654
    under: { color: '#3d6261', shade: '#3a5c5b', dark: '#30504e' },
    // 庇の上面 #e4e8d9・前の面 #dde3d4
    canopy: { color: '#e4e8d9', shade: '#d7ddcf', dark: '#4b6b68', hi: '#eaede0' },
    // 床: 日なた #cdd5c0〜#d7decc、庇の影 #3d6762
    floor: { color: '#d3dbc7', shade: '#3f6863', dark: '#355955', hi: '#e0e5d4' },
    // 突き当たりの壁 #d2ddcf・門の暗い口 #5a7e78
    back: { color: '#d4decf', shade: '#d0dacc', dark: '#5a7e78' },
    door: { color: '#2b3d40', shade: '#283a3d', dark: '#1d2b2e' },
    gate: { color: '#5b7f79', shade: '#587c76', dark: '#4b6e69' },
    slot: { color: '#3f5f5c', shade: '#3a5956', dark: '#2c4846' },
    stain: { color: '#b4c3b6', shade: '#a6b8ac', dark: '#7f978c' },
    inWall: { color: '#e0e6d9', shade: '#587269', dark: '#3a524b', hi: '#e2e7da' },
    inDado: { color: '#5a7f7a', shade: '#223a38', dark: '#1a2f2d', hi: '#6a8f8a' },
    inTrim: { color: '#a8b9ae', shade: '#465e57', dark: '#33463f', hi: '#bccbc0' },
    inFloor: { color: '#c6cfbe', shade: '#3a4d45', dark: '#2b3a34', hi: '#d3dbca' },
    inCeil: { color: '#c4cfc2', shade: '#344a42', dark: '#243530' },
  },
  C: {
    // 回廊の面: 陰でも淡い（#9eb0a2〜#adbfb1。霧で遠くほど淡く）。テラス・床 #cedfd4・#cadcd0
    wall: { color: '#b8cabd', shade: '#84998d', dark: '#5e786e', hi: '#cbdcd1' },
    // 西（奥）の回廊と棟の面（逆光で真っ向の陰。霧の向こうで #8ea9a0・#94afa8）
    wallW: { color: '#a9bdb1', shade: '#66806f', dark: '#4e665b', hi: '#cbdcd1' },
    floor: { color: '#cfe0d5', shade: '#7d988e', dark: '#5d7a72', hi: '#dbe8df' },
    terrace: { color: '#cfe0d5', shade: '#a9bfb3', dark: '#7d988e', hi: '#d8e6dd' },
    // 手前の門の壁の外の面（北向きの陰。苔で暗い）#2e483f・#37524d
    gateWall: { color: '#34503f', shade: '#2c473f', dark: '#243a34' },
    // 開口の奥（回廊・ロッジア）#2b3b39
    deep: { color: '#26363a', shade: '#223234', dark: '#1a2628' },
    // 回廊の敷石: 陰は開口の奥の暗がりと同じ。灯りの光だまりの所だけ明るい（回廊の灯り）
    floorDeep: { color: '#56716a', shade: '#223234', dark: '#1a2628' },
    door: { color: '#3a4f4b', shade: '#33473f', dark: '#1f2c2b' },
    window: { color: '#1e2a2b', shade: '#1b2627', dark: '#121a1d' },
    // 門の口の扉（黒に近い）・西のロッジアの奥（青緑の暗がり #678880 を霧の手前で）
    gate: { color: '#141d1f', shade: '#121a1c', dark: '#0e1416' },
    loggia: { color: '#31504b', shade: '#2d4a45', dark: '#223a36' },
    // 窓台・水の吐き口の下の雨の垂れ（外の面）
    stain: { color: '#9cb1a4', shade: '#6c8478', dark: '#4e665b' },
    inWall: { color: '#d8e3d9', shade: '#4e675a', dark: '#33483d', hi: '#d8e3d9' },
    inDado: { color: '#668275', shade: '#213228', dark: '#18261f', hi: '#769285' },
    inTrim: { color: '#9cb0a3', shade: '#3e5348', dark: '#2c3d35', hi: '#aec1b4' },
    inFloor: { color: '#bacabe', shade: '#32463c', dark: '#25352d', hi: '#c9d6cc' },
    inCeil: { color: '#b9c8bd', shade: '#2e4238', dark: '#1f2e27' },
  },
};

/**
 * 筆の跡（中庭ごと。参考画像 0 = 大きな面のむら、1 = 横に引いた乾いた筆、2 = 湿ったむらの面）。
 * patch の振れ幅は「型枠の板ごと（壁）・打設の区画ごと（床）の色」の強さ（3 回目の直し: 勝手な四角い斑をやめ、色は造りに従う）
 */
const BRUSH: Record<Court, { wall: BrushOptions; floor: BrushOptions }> = {
  A: {
    wall: { big: [2.6, 1.1], small: [0.8, 0.25], amp: [0.1, 0.055], cover: [0.65, 0.6], patch: [0, 0.1], hueAmp: 0.35, dark: 1.8 },
    floor: { big: [3.0, 0.7], small: [0.9, 0.18], amp: [0.075, 0.055], cover: [0.75, 0.65], patch: [0, 0.07], hueAmp: 0.3, dark: 2.0, along: 'x' },
  },
  B: {
    wall: { big: [1.6, 0.4], small: [0.7, 0.15], amp: [0.125, 0.05], cover: [0.75, 0.55], patch: [0, 0.035], hueAmp: 0.3, dark: 2.0 },
    floor: { big: [2.4, 0.34], small: [0.9, 0.12], amp: [0.15, 0.06], cover: [0.75, 0.6], patch: [0, 0.03], hueAmp: 0.3, dark: 2.6, along: 'x' },
  },
  C: {
    wall: { big: [2.0, 0.6], small: [0.7, 0.18], amp: [0.11, 0.075], cover: [0.7, 0.65], patch: [0, 0.06], hueAmp: 0.3, dark: 1.6 },
    floor: { big: [3.2, 0.9], small: [1.0, 0.25], amp: [0.095, 0.07], cover: [0.7, 0.65], patch: [0, 0.035], hueAmp: 0.4, dark: 2.0, along: 'z' },
  },
};

/** 打ち放しの型枠（板 0.9 × 1.8 m・継ぎ目・打ち継ぎの下のにじみ）と締め付けの穴（板の中に横 0.45・縦 0.6 m おき = 板 1 枚に 6 つ） */
const PANEL: [number, number, number, number] = [0.9, 1.8, 0.3, 0.35];
const TIES: [number, number, number, number] = [0.45, 0.6, 0.016, 0.45];

/** 濃い点・短いひびの割合（参考画像 0 の床が一番多い） */
const FLECK: Record<Court, { wall: number; floor: number }> = {
  A: { wall: 0.1, floor: 0.2 },
  B: { wall: 0.07, floor: 0.06 },
  C: { wall: 0.1, floor: 0.1 },
};

export class Mats {
  private cache = new Map<string, THREE.Material>();
  constructor(readonly ctx: SceneContext) {}

  /** 中庭 court の色 key の材質（床・壁は筆の跡と点） */
  get(court: Court, key: string, o: { brush?: 'wall' | 'floor' | false; line?: number } = {}): THREE.Material {
    const k = `${court}:${key}:${o.brush ?? 'auto'}:${o.line ?? 1}`;
    let m = this.cache.get(k);
    if (m) return m;
    const t = PAL[court][key];
    if (!t) throw new Error(`whiteroom: no tone ${court}.${key}`);
    const brush = o.brush ?? (key === 'inFloor' || key === 'inCeil' || key.includes('floor') || key === 'terrace' || key === 'apron' ? 'floor' : 'wall');
    const mat = this.ctx.mat({
      color: t.color,
      shade: t.shade,
      dark: t.dark,
      hi: t.hi,
      name: `wr-${court}-${key}`,
      // 部屋の中の面は段の境目のノイズを弱く細かく（光だまりの縁が雲のように大きくちぎれないように）
      noise: key.startsWith('in') ? [0.35, 2.5] : undefined,
      line: o.line ?? 1,
      flecks: brush ? { scale: brush === 'floor' ? 1.5 : 1.4, density: FLECK[court][brush], color: shift(t.color, -0.66), length: 0.22, width: 0.07, color2: shift(t.color, 0.1), density2: 0.03 } : undefined,
      // C の沈んだ中庭の床は湿った斑（参考画像 2 の床の暗い水の跡）。水は低い所 = 壁ぎわ・回廊の開口の前に溜まるので、
      // 中庭の真ん中から離れるほど斑が出やすい（造りに従う濡れ。テラスは水が排水口へ流れるので斑を描かない）
      blotch: court === 'C' && key === 'floor' ? { color: shift(t.color, -0.1), scale: 0.16, threshold: 0.3, only: 'floor', grad: { origin: [-40.5, 0, -20.8], abs: [-0.012, 0, -0.04] } } : undefined,
      // 部屋の床は石の板（目地と板ごとの明るさのむら）
      tiles: key === 'inFloor' ? { size: [0.45, 0.45], line: 0.012, color: shift(t.color, -0.45), jitter: 0.08, broken: 0.05 } : undefined,
    });
    if (brush) {
      const base0 = BRUSH[court][brush];
      // 部屋の中: 塗りの壁（漆喰・腰壁）は静かに（筆の跡を弱く、板の色・締め付けの穴は無い）。柱型と梁は打ち放し（板と穴）
      const plaster = key === 'inWall' || key === 'inDado';
      const inside = key.startsWith('in');
      let o2: BrushOptions;
      if (brush === 'wall') {
        // 塗りの壁: 大きな跡は弱く（面の色のむらにしない）、細かい筆の跡（絵の具の地）は外の壁と同じ
        o2 = plaster
          ? { ...base0, amp: [base0.amp[0] * 0.4, base0.amp[1] * 1.1], patch: [0, 0], dark: 1.0 }
          : { ...base0, ties: TIES, panel: PANEL, ...(inside ? { amp: [base0.amp[0] * 0.6, base0.amp[1] * 0.9] as [number, number] } : {}) };
      } else if (key === 'inCeil') {
        // 部屋の天井（打ち放しの板）: 型枠の板の継ぎ目（1.8 m 角）と板ごとの色
        o2 = { ...base0, amp: [base0.amp[0] * 0.4, base0.amp[1] * 0.9], patch: [0, 0.05], joints: [1.8, 0.006, 0.4] };
      } else {
        // 床: 目地（3 m おき）と区画ごとの色。部屋の床は石の板（tiles）が区画
        // テラス（屋上の防水の上の押さえの板）は 1 m 角の板ごと（目地は近くでだけ見える）
        o2 =
          key === 'inFloor'
            ? { ...base0, amp: [base0.amp[0] * 0.6, base0.amp[1] * 0.9], patch: [0, 0], joints: [99, 0.012, 0] }
            : key === 'terrace'
              ? { ...base0, patch: [0, 0.035], joints: [1.0, 0.008, 0.35] }
              : key.startsWith('floor') && key !== 'floor'
                ? // 屋根のある歩廊の床（回廊・門の通路）は 0.5 m 角の敷石。目地は近くでだけ見える
                  { ...base0, patch: [0, 0.045], joints: [0.5, 0.008, 0.45] }
                : { ...base0, joints: [3.0, 0.012, 0.25] };
      }
      // 部屋の中（参考画像の視点から見えない）は、近くの細かい筆の跡を 1 画素 1.1 cm まで
      if (inside) o2 = { ...o2, nearPx: 0.011 };
      addBrush(mat, o2);
    }
    this.cache.set(k, mat);
    return mat;
  }

  /** 照明なしの半透明の色（部屋の窓の内の面: 外の明るさに外の景色が淡く透ける） */
  haze(color: string, opacity: number): THREE.Material {
    const k = `haze:${color}:${opacity}`;
    let m = this.cache.get(k);
    if (!m) this.cache.set(k, (m = this.ctx.mat({ color, unlit: true, transparent: true, opacity, depthWrite: false, line: 0.2, name: `wr-haze-${color}` })));
    return m;
  }

  /** 照明なしの色（空・光る物） */
  flat(color: string): THREE.Material {
    const k = `flat:${color}`;
    let m = this.cache.get(k);
    if (!m) this.cache.set(k, (m = this.ctx.mat({ color, unlit: true, name: `wr-flat-${color}` })));
    return m;
  }
}

/** sRGB の 16 進の色の明るさを変える（-1〜1） */
export function shift(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(Math.max(0, Math.min(255, k >= 0 ? c + (255 - c) * k : c * (1 + k)))));
  return '#' + ch.map((c) => c.toString(16).padStart(2, '0')).join('');
}
