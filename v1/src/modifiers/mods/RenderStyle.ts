/**
 * RenderStyle — 部屋単位の描画スタイル差替え（M13 untextured / M17 legacy）。
 * params: style('untextured' | 'legacy' | 'backside')。backside（M15）は v1.3 保留: 何もせずログだけ出す。
 *
 * untextured（M13 未描画空間）: layout フックで
 *   - シェル以降の内装箱（家具・パネル灯・装飾）を全削除、L.lights / labels / signs / decals / instances / particles を空にする
 *     （視覚ランドマークを排除し出口だけを残す。扉パネルは RoomBuilder が通常材質で描く = 唯一の目印）
 *   - palette.ambient を白（SurfaceLighting の焼き込みは ambient のみ → 面の向きだけ分かる陰影。Game の hemi も白）、
 *     palette.fog を明るい灰白（scene.fog / background が白に寄り、境界の無い白空間に見える）
 *   - L.render.style = 'untextured'（RoomBuilder が全 MatId を単一 'untextured' 材質に差し替える）
 * legacy（M17 旧バージョン階）: layout フックで
 *   - L.render.style = 'legacy'（RoomBuilder: 面取り・detailedBoxes をスキップ、32 px Nearest テクスチャ、bakedLight 4 段階量子化、ラベル 128 px）
 *   - 照明も粗く: PointLight を 1 本おきに間引き（強度で補う）、色をフラット白、位置を 0.5 m 格子へ、距離を 1 m 刻みに
 *   - palette.lightColor / ambient を量子化した白系に、decals / particles を無くす（旧描画に無い表現）
 * ジオメトリ（寸法・ソケット・コライダ）は変えない。Tier 差は無し（どちらも通常より軽い）。
 */
import type { ModifierImpl } from '../types';
import type { RoomLayout } from '../../generators/layout';
import { str } from '../util';

export type RenderStyleKind = 'untextured' | 'legacy' | 'backside';

/** params.style を正規化（未知は null） */
export function renderStyleOf(params: Record<string, unknown>): RenderStyleKind | null {
  const s = str(params.style, 'untextured').toLowerCase();
  return s === 'untextured' || s === 'legacy' || s === 'backside' ? s : null;
}

function applyUntextured(L: RoomLayout): void {
  // shellCount が無い Generator では内装とシェルを区別できないので箱は触らない
  if (L.shellCount !== undefined && L.shellCount >= 0 && L.shellCount <= L.boxes.length) {
    L.boxes.length = L.shellCount;
  }
  L.lights = [];
  L.labels = [];
  L.signs = undefined;
  L.decals = undefined;
  L.instances = undefined;
  L.particles = undefined;
  L.palette = {
    ...L.palette,
    light: 'lightPanel',
    lightColor: 0xffffff,
    ambient: 0xffffff,
    fog: 0xe6e6e2,
  };
  L.render = { ...(L.render ?? {}), style: 'untextured' };
}

/** 0..255 を levels 段階へ量子化 */
function quantizeChannel(v: number, levels: number): number {
  const step = 255 / (levels - 1);
  return Math.round(Math.round(v / step) * step);
}

function quantizeColor(color: number, levels = 5): number {
  const r = quantizeChannel((color >> 16) & 255, levels);
  const g = quantizeChannel((color >> 8) & 255, levels);
  const b = quantizeChannel(color & 255, levels);
  return (r << 16) | (g << 8) | b;
}

function snapHalf(v: number): number {
  return Math.round(v * 2) / 2;
}

function applyLegacy(L: RoomLayout): void {
  // 照明を粗く: 1 本おきに間引き、フラット白、格子位置
  const kept = L.lights.filter((_, i) => i % 2 === 0);
  const boost = L.lights.length > 0 ? Math.min(1.6, Math.sqrt(L.lights.length / Math.max(1, kept.length))) : 1;
  L.lights = kept.map((l) => ({
    pos: [snapHalf(l.pos[0]), Math.round(l.pos[1] * 4) / 4, snapHalf(l.pos[2])],
    color: 0xffffff,
    intensity: Math.round(l.intensity * boost * 4) / 4,
    distance: Math.max(2, Math.round(l.distance)),
  }));
  L.palette = {
    ...L.palette,
    lightColor: 0xffffff,
    ambient: quantizeColor(L.palette.ambient, 5),
    fog: quantizeColor(L.palette.fog, 5),
  };
  // 旧描画に無い表現は出さない
  L.decals = undefined;
  L.particles = undefined;
  L.render = { ...(L.render ?? {}), style: 'legacy' };
}

const RenderStyle: ModifierImpl = {
  id: 'RenderStyle',
  defaults: { style: 'untextured' },
  layout(L, p, params) {
    const style = renderStyleOf(params);
    switch (style) {
      case 'untextured':
        applyUntextured(L);
        break;
      case 'legacy':
        applyLegacy(L);
        break;
      case 'backside':
        // v1.3 D22: M15 オミットにより保留。何もしない
        console.info(`[RenderStyle] ${p.def.id}: style 'backside' は v1.3 保留（未実装）。通常描画のままにします`);
        break;
      default:
        console.warn(`[RenderStyle] ${p.def.id}: 不明な style '${String(params.style)}'。何もしません`);
    }
  },
};

export default RenderStyle;
