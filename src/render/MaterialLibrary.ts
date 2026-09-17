/**
 * 共有 PBR 材質テーブル + 部屋別バリアント。
 *
 * 統合担当向け: 呼び出し方
 * - `materials.get(id)`: 従来どおり共有材質（全部屋で 1 オブジェクト）。
 * - `materials.variant(id, overrides)`: 部屋別の材質差替え（RoomBuilder が RoomLayout.render から呼ぶ。Game 側は通常呼ばない）。
 *   uniform 値だけ違うもの（wetness / colorMask / roomFog の色距離）は同じシェーダプログラムを共有し、量子化キー + LRU（上限 MAX_VARIANTS）で管理する。
 *   プログラムが増えるのは style 'untextured' / 'legacy'、gradient、roomFog（有無）、視差（cc0 の pom）の族だけ。
 * - `materials.forRoom(id, { roomId, seed, overrides, lightMap })`: 部屋単位の材質。seed から CC0 セットのバリエーションと色相・明度のトーンを
 *   決定論的に選ぶ（同じテンプレートの隣室で床・壁が別の実測素材になる）。材質は (MatId, 上書き, バリエーション, トーン) で共有し、
 *   lightMap 付きだけ部屋専用の clone を返す。RoomBuilder.dispose から `releaseRoom(roomId)` を呼ぶこと。
 * - `materials.setTier(tier)`: 品質 Tier（high: 視差 + 2 層混合 / mid: 2 層混合 / low: 無し）。Game.setTier から呼ぶ（uniform だけ変わる。再コンパイル無し）。
 * - `materials.precompile(renderer, scene, camera, overrides)`: Rare 以上の部屋が 2 hop 先で確定した時点に呼ぶと、その variant 族を先にコンパイルできる（任意）。
 * - `materials.update(dt)`: 毎フレーム（水面 UV の流れ・明滅の時間 uniform）。従来どおり。
 * - `materials.setDiagnostic(mode)`: /visual-review の診断表示。従来どおり。
 * - `materials.adoptExternal(m, overrides?)`: glTF 由来の MeshStandardMaterial を clone して同じ注入（bakedLight / colorMask / roomFog / 診断）を施す。
 *   PropCatalog が呼ぶ。プログラム族は external-roomfog / external-scenefog の 2 つ。
 * - `materials.environmentTexture`: 共有 envMap（外部材質用）。
 *
 * CC0 セットの読込: 先頭候補（`get` / `variant` が使う）は起動時に読み `ready` で待つ。seed で選ばれる 2 番目以降の候補は
 * 最初に使われた時に読み（読込前は index.json の平均色 1 px）、部屋が dispose されて参照が無くなれば GPU から解放する（evict。
 * Image は保持するので再利用時は再アップロードだけ）。詳細は docs/cc0-pipeline.md / docs/material-variation.md。
 */
import * as THREE from 'three';
import { addSurfaceAppearance, usesSurfaceVariation, usesSurfaceWear, SURFACE_VARIATION_KEY } from './SurfaceAppearance';
import { createSurfaceMaps, hasAuthoredDetail, type DetailKind } from './SurfaceDetail';
import { CC0_INDEX_URL, CC0_MATERIALS_URL, CC0_VARIANTS, DEFAULT_BLEND, TONE_TABLE, variantHash, type Cc0Index, type Cc0IndexEntry, type Cc0Variant } from './cc0Materials';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { MatId } from '../generators/layout';
import type { QualityTier, QualityTierId, Vec3 } from '../core/types';

export type TextureId = 'wallpaper' | 'carpet' | 'concrete' | 'wood' | 'ceiling' | 'tile' | 'metal' | 'linoleum' | 'cardboard' | 'foliage' | 'diffuser' | 'water' | 'sky' | 'night';
/** ガラスの定義（V06 手順 1: 通常ガラス / 車窓 / 暗い窓を別定義にし、金属度で反射を足す代用をやめる） */
export interface GlassSpec {
  /** 物理的な透過（MeshPhysicalMaterial.transmission） */
  transmission: number;
  ior: number;
  thickness: number;
  /** 反射の強さ（共有 envMap の envMapIntensity 倍率。フレネルは PBR 側） */
  reflect: number;
}
interface Surface {
  detail?: DetailKind; albedo?: boolean;
  texture: TextureId; color: number; meters: number; roughness: number;
  bump: number; metalness?: number; grid?: [number, number]; emission?: number; opacity?: number;
  /** 発光色（既定は color。夜景のように map をそのまま光らせるときは白） */
  emissiveColor?: number;
  /** ガラス（MeshPhysicalMaterial の透過 + 弱い反射、金属度 0） */
  glass?: GlassSpec;
  /** テクスチャ・凹凸を一切使わない（untextured） */
  flat?: boolean;
  /** 常に両面（sky* の天井箔・水壁） */
  doubleSide?: boolean;
  /** 床に貼るデカール（polygonOffset でちらつきを避ける） */
  decal?: boolean;
  /** 水面と同じ UV 流れアニメーション */
  flow?: number;
}
/** Exhaustive shared material table. Pattern dimensions are measured in meters. */
export const SURFACES: Record<MatId, Surface> = {
  floorCarpetRed: { texture: 'carpet', color: 0x805349, meters: 1, roughness: .98, bump: .004 },
  floorCarpetGrey: { texture: 'carpet', color: 0x91938e, meters: 1, roughness: .98, bump: .004 },
  floorLino: { texture: 'linoleum', color: 0xb6c0a2, meters: 1.2, roughness: .3, bump: .002 },
  floorConcrete: { texture: 'concrete', color: 0xb8b6ad, meters: 2, roughness: .45, bump: .007 },
  floorTile: { texture: 'tile', color: 0xe0e4db, meters: 1.2, roughness: .29, bump: .005 },
  floorWood: { texture: 'wood', color: 0xc5aa81, meters: 1.2, roughness: .48, bump: .004, grid: [.15, 1.2] },
  wallBeige: { texture: 'wallpaper', color: 0xd3bc87, meters: 1, roughness: .88, bump: .006 },
  wallWhite: { texture: 'wallpaper', color: 0xe2e3d8, meters: 1, roughness: .88, bump: .0012 },
  wallCream: { texture: 'wallpaper', color: 0xe1d4ae, meters: 1, roughness: .9, bump: .004 },
  wallConcrete: { texture: 'concrete', color: 0xc0bfb5, meters: 2, roughness: .88, bump: .009 },
  wallGreen: { texture: 'wallpaper', color: 0x879b7f, meters: 1, roughness: .76, bump: .004 },
  wallDark: { texture: 'wallpaper', color: 0x5b5457, meters: 1, roughness: .9, bump: .004 },
  ceilingWhite: { texture: 'ceiling', color: 0xe4e0cf, meters: .6, roughness: .96, bump: .002, grid: [.6, .6] },
  ceilingTile: { texture: 'ceiling', color: 0xdde0d5, meters: .6, roughness: .96, bump: .002, grid: [.6, 1.2] },
  ceilingDark: { texture: 'concrete', color: 0x777b78, meters: 2, roughness: .9, bump: .008 },
  doorWood: { texture: 'wood', color: 0xb09576, meters: 1.1, roughness: .43, bump: .0008 },
  doorMetal: { detail: 'paint', albedo: false, texture: 'metal', color: 0xaab5ae, meters: 1, roughness: .46, bump: .001, metalness: 0 },
  trim: { texture: 'wood', color: 0x776653, meters: 1.1, roughness: .43, bump: .002 },
  // 通常の窓・扉ガラス: 透過 + 弱い反射、金属度 0（拡散板 lightPanel 系とは別定義。texture は albedo:false なので使わない）
  glass: { detail: 'glass', albedo: false, texture: 'diffuser', color: 0xdce8e4, meters: .35, roughness: .06, bump: .0002, metalness: 0, opacity: .2, glass: { transmission: .9, ior: 1.5, thickness: .01, reflect: 1.6 } },
  lightPanel: { texture: 'diffuser', color: 0xedf0d9, meters: .24, roughness: .45, bump: .001, emission: 2.5 },
  lightWarm: { texture: 'diffuser', color: 0xffd29a, meters: .24, roughness: .45, bump: .001, emission: 2.3 },
  lightOff: { texture: 'diffuser', color: 0x979c8f, meters: .24, roughness: .6, bump: .001 },
  ledBlue: { texture: 'diffuser', color: 0x79b9cf, meters: .24, roughness: .4, bump: .001, emission: 1.8 },
  columnConcrete: { texture: 'concrete', color: 0xc7c7ba, meters: 2, roughness: .8, bump: .008 },
  furnitureDark: { texture: 'wood', color: 0x746855, meters: 1.1, roughness: .46, bump: .003 },
  furnitureLight: { texture: 'wood', color: 0xe0caa5, meters: 1.1, roughness: .42, bump: .003 },
  metal: { texture: 'metal', color: 0xd4d8d4, meters: .6, roughness: .26, bump: .001, metalness: .94 },
  yellowLine: { texture: 'concrete', color: 0xd6b74d, meters: 1.5, roughness: .63, bump: .003 },
  // 窓の外（夜の遠景）: 生成テクスチャ 'night'（暗い青灰の空〜建物のシルエット・疎らな窓明かり・街灯の滲み。8 m × 4 m）を
  // 白い emissive で薄く光らせる。diffuse は暗く（室内光で白けない）。担当 W が窓の裏板に使う
  windowNight: { detail: 'glass', texture: 'night', color: 0x0b0e14, meters: 4, roughness: 1, bump: 0, emission: .9, emissiveColor: 0xffffff },
  // 参考画像（COMMON 基礎ステージ）向けの差し色・部材
  seatBlue: { texture: 'carpet', color: 0x3b5578, meters: .45, roughness: .95, bump: .005 },
  lockerGreen: { texture: 'metal', color: 0x6f8a6a, meters: 1, roughness: .42, bump: .0008, metalness: .25 },
  metalDark: { texture: 'metal', color: 0x2a2c2e, meters: .6, roughness: .45, bump: .001, metalness: .6 },
  wainscotCream: { texture: 'wallpaper', color: 0xcfc8b2, meters: 1, roughness: .7, bump: .002 },
  noticeGreen: { texture: 'carpet', color: 0x4f6b55, meters: .6, roughness: .98, bump: .004 },
  handrailWood: { texture: 'wood', color: 0x9a7452, meters: 1.1, roughness: .4, bump: .001 },
  placeholder: { texture: 'linoleum', color: 0xb2b0a0, meters: 1.2, roughness: .65, bump: .002 },
  void: { texture: 'concrete', color: 0x000000, meters: 2, roughness: 1, bump: 0 },
  shelfMetal: { detail: 'paint', albedo: false, texture: 'metal', color: 0xc3c6bc, meters: .7, roughness: .46, bump: .001, metalness: 0 },
  boxCardboard: { texture: 'cardboard', color: 0xe1c99e, meters: .6, roughness: .96, bump: .004 },
  // 葉: 上からの光しか無い部屋（E04 の木・L01/L05 の樹冠）で黒くならないよう明度を上げた（担当 E / L の依頼）
  plantLeaf: { detail: 'foliage', albedo: false, texture: 'foliage', color: 0x45692c, meters: .12, roughness: .57, bump: .0015 },
  plantSoil: { detail: 'concrete', albedo: false, texture: 'concrete', color: 0x2e2317, meters: .18, roughness: 1, bump: .012 },
  plant: { texture: 'foliage', color: 0xc6d9a8, meters: .8, roughness: .6, bump: .008 },
  // 車窓: 濃い色ガラス（透過は少なく反射が主）。金属度で反射を足す代用はしない
  carGlass: { detail: 'glass', albedo: false, texture: 'metal', color: 0x2c3638, meters: 1, roughness: .1, bump: .0001, metalness: 0, glass: { transmission: .45, ior: 1.5, thickness: .02, reflect: 2.2 } },
  carPaint: { detail: 'paint', albedo: false, texture: 'metal', color: 0x6c787b, meters: 1, roughness: .28, bump: .0002, metalness: 0 },
  rubber: { detail: 'rubber', albedo: false, texture: 'linoleum', color: 0x242624, meters: .4, roughness: .96, bump: .002 },
  upholstery: { texture: 'carpet', color: 0x76514a, meters: .45, roughness: .98, bump: .006 },
  water: { texture: 'water', color: 0x69938c, meters: 3, roughness: .12, bump: .002, opacity: .72, flow: 1 },
  // ---- v1.3 追加（Modifier / 新 Generator 用）----
  lightGreen: { texture: 'diffuser', color: 0xc8f0c0, meters: .24, roughness: .45, bump: .001, emission: 2.4 },
  lightYellow: { texture: 'diffuser', color: 0xe8dcb0, meters: .24, roughness: .45, bump: .001, emission: 2.1 }, // 古い管の黄ばみ（灰色寄り）
  /** 停電時の筐体・モニタの青白い発光（LightingPhase unpowered） */
  screenGlow: { texture: 'diffuser', color: 0x9fd0ff, meters: .5, roughness: .3, bump: .0005, emission: 1.6 },
  // ---- 部屋別ドレッシング（参考画像 Uncommon〜Mythic）----
  marbleFloor: { texture: 'tile', color: 0xd9d6cf, meters: 1.2, roughness: .18, bump: .001 },
  woodPanel: { texture: 'wood', color: 0x5a4535, meters: 1.1, roughness: .4, bump: .002, grid: [.6, 2.4] },
  bookshelfWood: { texture: 'wood', color: 0x6e4f36, meters: 1.1, roughness: .45, bump: .002 },
  carpetPattern: { texture: 'carpet', color: 0x6b2a2a, meters: .9, roughness: .98, bump: .005 },
  redShutter: { texture: 'metal', color: 0x8a2a2a, meters: 1, roughness: .5, bump: .002, metalness: .3, grid: [.12, 3] },
  neonRed: { texture: 'diffuser', color: 0xff3a48, meters: .24, roughness: .4, bump: .001, emission: 2.6 },
  neonBlue: { texture: 'diffuser', color: 0x4a7dff, meters: .24, roughness: .4, bump: .001, emission: 2.4 },
  goldTrim: { texture: 'metal', color: 0xc9a45c, meters: .6, roughness: .3, bump: .001, metalness: .85 },
  stainless: { texture: 'metal', color: 0xc8ccc9, meters: .6, roughness: .22, bump: .001, metalness: .9 },
  whiteFabric: { texture: 'carpet', color: 0xe8e6e0, meters: .6, roughness: .95, bump: .004 },
  plasticRed: { texture: 'diffuser', color: 0xd23a34, meters: .5, roughness: .35, bump: .0005 },
  plasticYellow: { texture: 'diffuser', color: 0xe8c23a, meters: .5, roughness: .35, bump: .0005 },
  plasticBlue: { texture: 'diffuser', color: 0x2f6fd0, meters: .5, roughness: .35, bump: .0005 },
  chalkboard: { texture: 'carpet', color: 0x2f3d33, meters: 1, roughness: .9, bump: .002 },
  aquariumBlue: { detail: 'glass', albedo: false, texture: 'diffuser', color: 0x1f5fbf, meters: .35, roughness: .1, bump: .0002, metalness: 0, opacity: .55, emission: .9, emissiveColor: 0x2a6fd8 },
  // 窓・偽出口の昼光。1.6 では露出が飽和して白く抜ける（R14 / M04 / M08）ので 1.1（担当 R / M の依頼）
  skyDay: { texture: 'sky', color: 0x9cc4ff, meters: 40, roughness: 1, bump: 0, emission: 1.1 },
  // 机上の液晶（E09）。screenGlow は白い板に見えるため青白く弱い発光にした
  screenLcd: { texture: 'diffuser', color: 0x9fc8ff, meters: .5, roughness: .3, bump: .0005, emission: 0.9 },
  // 像・胸像の白大理石（E06）。単一光でもシルエットにならない明るい白 + 低い粗さ
  marbleWhite: { texture: 'tile', color: 0xefece4, meters: 1.2, roughness: .22, bump: .001 },
  // 塗装の白（電車の車体 E11・自販機など）。リノリウム地の signPlate ではなく塗装ディテール
  paintWhite: { detail: 'paint', albedo: false, texture: 'metal', color: 0xe8e9e4, meters: .7, roughness: .38, bump: .001, metalness: 0 },
  seatRed: { texture: 'carpet', color: 0x7a1f2a, meters: .45, roughness: .95, bump: .005 },
  lockerBlue: { texture: 'metal', color: 0x6f86a8, meters: 1, roughness: .42, bump: .0008, metalness: .25 },
  screenDark: { texture: 'metal', color: 0x0e1014, meters: 1, roughness: .15, bump: 0, metalness: .2 },
  /** 偽の空（FakeSky）。天井箔として貼る。両面・大きなパターン */
  // 空箔（FakeSky）: 'diffuser' は拡散板の格子が空に見えないため、生成した低周波ノイズ 'sky'（雲の濃淡）を 40 m で貼る（FakeSky が offset を流す）
  skyOvercast: { texture: 'sky', color: 0xb9c0c8, meters: 40, roughness: 1, bump: 0, emission: 1.1, doubleSide: true },
  skyDusk: { texture: 'sky', color: 0xd28a5a, meters: 40, roughness: 1, bump: 0, emission: 1.0, doubleSide: true },
  skyNoon: { texture: 'sky', color: 0x8fb8ea, meters: 40, roughness: 1, bump: 0, emission: 1.4, doubleSide: true },
  /** 浅水（ShallowWater）。床の上に貼る半透明の水面 */
  waterShallow: { texture: 'water', color: 0x86b7b0, meters: 2.5, roughness: .1, bump: .0015, opacity: .5, flow: 1.4 },
  /** 水の壁（WaterWall）。開口を塞ぐ縦の水面 */
  waterWall: { texture: 'water', color: 0x4f8a86, meters: 2, roughness: .08, bump: .002, opacity: .62, flow: 2.2, doubleSide: true },
  /** ブロブ影デカール（InvertedShadow） */
  shadowDecal: { texture: 'concrete', color: 0x000000, meters: 2, roughness: 1, bump: 0, opacity: .5, decal: true },
  /** 白無地（RenderStyle untextured） */
  untextured: { texture: 'ceiling', color: 0xf2f2ee, meters: 1, roughness: 1, bump: 0, flat: true },
  floorAsphalt: { texture: 'concrete', color: 0x55575a, meters: 2.5, roughness: .92, bump: .008 },
  wallBrick: { texture: 'concrete', color: 0x9c6a56, meters: 1.5, roughness: .9, bump: .01, grid: [.22, .07] },
  windowLit: { texture: 'diffuser', color: 0xffd9a0, meters: .6, roughness: .3, bump: .0005, emission: 1.8 },
  // 外から見た消灯した窓: 暗い室内（透過は僅か）+ 反射が主
  windowDark: { detail: 'glass', albedo: false, texture: 'metal', color: 0x1a2024, meters: 1, roughness: .08, bump: .0001, metalness: 0, glass: { transmission: .2, ior: 1.5, thickness: .02, reflect: 2.2 } },
  /** ナトリウム灯（街灯）。橙色の発光 */
  sodiumLight: { texture: 'diffuser', color: 0xffa040, meters: .24, roughness: .4, bump: .001, emission: 2.8 },
  signPlate: { texture: 'linoleum', color: 0xf0f0e8, meters: .5, roughness: .5, bump: .001 },
  signEmissive: { texture: 'diffuser', color: 0x6fdc8c, meters: .3, roughness: .4, bump: .0005, emission: 2.0 },
  ice: { texture: 'tile', color: 0xcfe6f2, meters: 1.5, roughness: .06, bump: .002, metalness: 0 },
  snow: { texture: 'carpet', color: 0xf4f6f8, meters: 1, roughness: .98, bump: .006 },
  grass: { texture: 'foliage', color: 0x7f9a4e, meters: 1, roughness: .8, bump: .009 },
};

/** 部屋別バリアントの上書き。値だけ違うものは量子化してキーを共有する */
export interface MaterialOverrides {
  /** roughness の倍率（0.1 刻み） */
  roughnessScale?: number;
  /** 色の倍率（0.05 刻み） */
  colorScale?: number;
  /** 乗算マスク（ColorMissing。0.05 刻み） */
  colorMask?: [number, number, number];
  /** envMap 強度の倍率（0.25 刻み） */
  envMapIntensity?: number;
  style?: 'untextured' | 'legacy';
  /** axis に沿った位置 t=(dot(pos,axis)-range[0])/(range[1]-range[0]) で from の色から to の色へ */
  gradient?: { from: MatId; to: MatId; axis: Vec3; range: [number, number] };
  /** 部屋固有の霧（scene.fog を無視。色は sRGB hex、距離は m） */
  fog?: { color: number; near: number; far: number };
}

/** forRoom の引数（部屋単位の材質） */
export interface RoomMaterialContext {
  roomId: string;
  /** 部屋の seed（node.seed）。CC0 セットのバリエーションと色相・明度のトーンを決定論的に選ぶ */
  seed: number;
  overrides?: MaterialOverrides;
  /** Worker で焼いたライトマップ（uv1）。無ければ頂点の bakedLight だけ */
  lightMap?: THREE.Texture | null;
  lightMapIntensity?: number;
}

/** 外部（glTF）材質に施す部屋別上書き（adoptExternal）。値だけ違うものは同じプログラムを共有する */
export interface ExternalOverrides {
  /** 部屋固有の霧（scene.fog を無視。色は sRGB hex、距離は m） */
  fog?: { color: number; near: number; far: number };
  /** 乗算マスク（ColorMissing。0.05 刻み） */
  colorMask?: [number, number, number];
}

/** ExternalOverrides の量子化キー。上書きが無ければ null（呼び出し側は素の adoptExternal 結果を共有できる） */
export function externalOverridesKey(o: ExternalOverrides | undefined): string | null {
  if (!o) return null;
  const parts: string[] = [];
  if (o.colorMask && o.colorMask.some((v) => Math.abs(v - 1) > .01)) parts.push(`m${o.colorMask.map((v) => q(v, .05).toFixed(2)).join(',')}`);
  if (o.fog) parts.push(`f${o.fog.color.toString(16)}:${q(o.fog.near, .5).toFixed(1)}:${q(o.fog.far, 1).toFixed(0)}`);
  return parts.length ? parts.join('|') : null;
}

/** onBeforeCompile の引数型（three の WebGLProgramParametersWithUniforms） */
type ShaderParams = Parameters<THREE.Material['onBeforeCompile']>[0];

/** createMaterial / adoptExternal 共通の注入内容 */
interface CommonInjection {
  /** 焼き込み光の GLSL 式（legacy は 4 段階に量子化） */
  baked: string;
  mask: THREE.Vector3;
  /** 部屋固有の霧（無ければ scene.fog） */
  fog: { color: THREE.Color; near: number; far: number } | null;
}

/** 濡れ（0..1）を上書きに変換する（Wetness / ShallowWater が使う） */
export function wetnessOverrides(w: number): MaterialOverrides {
  const t = Math.max(0, Math.min(1, w));
  return { roughnessScale: 1 - .7 * t, colorScale: 1 - .25 * t, envMapIntensity: 1 + 2.5 * t };
}

/** 選ばれたバリエーション（CC0_VARIANTS[id] の添字。-1 は CC0 無し）とトーン（TONE_TABLE の添字） */
export interface MaterialPick { variant: number; tone: number; }

/** 共有 variant の LRU 上限。部屋ごとに (バリエーション, トーン) が変わるので 10 部屋で 150 前後になる（材質オブジェクトは軽い。プログラムはキーで共有） */
const MAX_VARIANTS = 256;

/**
 * 部屋切り替えの軽量化（担当 L2。docs/perf-room-switch.md）の各機能のスイッチ。計測の前後比較用に URL `?l2=off`（全部無効）または
 * `?l2=bitmap,queue,prefetch,split,precompile`（列挙したものを無効）で切れる。通常は全て有効
 */
export const L2_FLAGS = {
  /** CC0 セットを ImageBitmapLoader で読む（デコードを別スレッドへ） */
  bitmap: true,
  /** 読込済みテクスチャ・ライトマップの先行アップロード待ち行列 */
  queue: true,
  /** 2 hop 先の部屋の CC0 セットの先読み */
  prefetch: true,
  /** 後回し構築を複数フレームに分割 */
  split: true,
  /** 2 hop 先の部屋の材質シェーダの事前コンパイル */
  precompile: true,
};
(() => {
  try {
    if (typeof location === 'undefined') return;
    const v = new URLSearchParams(location.search).get('l2');
    if (!v) return;
    for (const k of Object.keys(L2_FLAGS) as (keyof typeof L2_FLAGS)[]) if (v === 'off' || v.split(',').includes(k)) L2_FLAGS[k] = false;
  } catch { /* ignore */ }
})();
const q = (v: number, step: number) => Math.round(v / step) * step;
/** 2 層混合のマスクの周期（m）。3〜6 m の間 */
const TILE_NOISE_PERIOD = 4.5;

export class MaterialLibrary {
  private readonly cache = new Map<MatId, THREE.MeshStandardMaterial>();
  /** 量子化キー → variant（LRU: 参照時に末尾へ移す） */
  private readonly variants = new Map<string, THREE.MeshStandardMaterial>();
  private readonly textures = new Map<TextureId, THREE.Texture>();
  private readonly normalTextures = new Map<DetailKind, THREE.Texture>();
  private readonly aoTextures = new Map<DetailKind, THREE.Texture>();
  private readonly dataTextures = new Map<DetailKind, THREE.Texture>();
  private readonly legacyTextures = new Map<TextureId, THREE.Texture>();
  private readonly manager = new THREE.LoadingManager();
  private readonly loader = new THREE.TextureLoader(this.manager);
  /**
   * CC0 セット用（担当 L2）: JPEG のデコードを main thread から外す。createImageBitmap は別スレッドでデコードし、
   * `imageOrientation: 'flipY'` で TextureLoader（flipY = true）と同じ向きの画像にする（three は ImageBitmap の flipY を無視する）。
   * createImageBitmap の無い環境（Node / 古いブラウザ）では null → TextureLoader
   */
  private readonly bitmapLoader: THREE.ImageBitmapLoader | null = L2_FLAGS.bitmap && typeof createImageBitmap === 'function' && typeof fetch === 'function'
    ? new THREE.ImageBitmapLoader(this.manager).setOptions({ imageOrientation: 'flipY', premultiplyAlpha: 'none' })
    : null;
  /**
   * 追跡テクスチャ（CC0 / ライトマップ / サイン・ラベルのアトラス）の GPU アップロード回数（texture.onUpdate）と、
   * ライトマップの反映回数。部屋切り替えの計測（Game.switchProfiler）が読む
   */
  readonly uploadStats = { count: 0, lightmaps: 0 };
  /** 読込済みテクスチャの先行アップロード待ち行列（Game.step が毎フレーム renderer.initTexture で 1〜2 枚ずつ流す） */
  readonly uploads = new TextureUploadQueue();
  private readonly clock = { value: 0 };
  private readonly diagnostic = { value: 0 };
  private readonly surfaceVariation = { value: 1 };
  private readonly surfaceEnvironment = { value: 1 };
  private readonly surfaceWear = { value: 1 };
  /** 品質 Tier（0 low / 1 mid / 2 high）。2 層混合は 1 以上、視差は 2 で有効。uniform なので切替で再コンパイルしない */
  private readonly materialQuality = { value: 2 };
  private environment: THREE.WebGLRenderTarget | null = null;
  /** CC0 セット（index.json にあって対応表から参照されるもの）。読込は先頭候補が起動時、他は初回使用時 */
  private readonly cc0Sets = new Map<string, Cc0Set>();
  /** 部屋 → その部屋が使う CC0 セット（releaseRoom で参照の無くなった遅延セットを GPU から解放する） */
  private readonly roomSets = new Map<string, Set<Cc0Set>>();
  private readonly setRooms = new Map<Cc0Set, Set<string>>();
  private readonly roomMaterials = new Map<string, Map<string, THREE.MeshStandardMaterial>>();
  private anisotropy = 1;
  /** CC0 の読込状態（デバッグ表示・統合時の確認用）。sets: 対応表から参照できるセット数、materials: CC0 で描ける MatId 数、
   *  loaded: GPU に載っている（読込中含む）セット数、variants: 候補の総数 */
  readonly cc0Status: { index: 'pending' | 'loaded' | 'missing'; sets: number; materials: number; loaded: number; variants: number } = { index: 'pending', sets: 0, materials: 0, loaded: 0, variants: 0 };
  readonly errors: string[] = [];
  readonly ready: Promise<void>;

  constructor() {
    this.manager.onError = (url) => this.errors.push(url);
    // 1) 生成テクスチャ（従来）→ 2) index.json があれば CC0 の先頭候補を同じ LoadingManager で読む → 3) legacy の縮小を作って ready。
    // index が無い / fetch 失敗 / Node 環境では 2) を飛ばし、従来どおりの材質になる（ビルド前でも動く）。
    const generated = new Promise<void>((resolve) => { this.manager.onLoad = () => resolve(); });
    const index = loadCc0Index();
    this.ready = (async () => {
      await generated;
      const idx = await index;
      this.cc0Status.index = idx ? 'loaded' : 'missing';
      if (idx) await this.startCc0(idx);
      this.refreshLegacyTextures();
    })();
    for (const id of new Set(Object.values(SURFACES).map((s) => s.texture))) {
      // 'sky'（雲の濃淡）と 'night'（夜景）は画像ではなく生成。他は textures/liminal/<id>.jpg
      const t = id === 'sky' ? createSkyTexture() : id === 'night' ? createNightTexture() : this.loader.load(`${import.meta.env.BASE_URL}textures/liminal/${id}.jpg`);
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = id === 'tile' ? THREE.RepeatWrapping : THREE.MirroredRepeatWrapping;
      // 夜景は u 方向に周期（8 m）、v は上下に伸ばさない（空の上端・地面の下端で止める）
      if (id === 'night') { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.repeat.set(.5, 1); }
      t.name = `generated/${id}/albedo`;
      this.textures.set(id, t);
    }
    for(const kind of new Set<DetailKind>([...Object.values(SURFACES).map(s=>s.detail??s.texture)])) {
      const maps=createSurfaceMaps(kind);this.dataTextures.set(kind,maps.detail);this.normalTextures.set(kind,maps.normal);this.aoTextures.set(kind,maps.ao);
    }
  }

  configure(renderer: THREE.WebGLRenderer): void {
    const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    this.anisotropy = anisotropy;
    for (const t of [...this.textures.values(), ...this.dataTextures.values(), ...this.normalTextures.values(), ...this.aoTextures.values()]) { t.anisotropy = anisotropy; if (t.image) t.needsUpdate = true; }
    for (const set of this.cc0Sets.values()) set.setAnisotropy(anisotropy);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    this.environment = pmrem.fromScene(room, .06);
    room.dispose(); pmrem.dispose();
  }

  /** 共有の環境マップ（configure 後。PropCatalog など外部材質が envMap に使う） */
  get environmentTexture(): THREE.Texture | null { return this.environment?.texture ?? null; }

  /** テクスチャのアップロード回数を数える（onUpdate。既存の onUpdate があれば続けて呼ぶ）。戻り値は同じテクスチャ */
  track<T extends THREE.Texture>(t: T): T {
    const prev = t.onUpdate;
    t.onUpdate = (tex: THREE.Texture) => { this.uploadStats.count++; if (prev) prev.call(t, tex); };
    return t;
  }

  /** 品質 Tier。high: 視差 + 2 層混合、mid: 2 層混合のみ、low: どちらも無し（uniform だけ変わる） */
  setTier(tier: QualityTier | QualityTierId): void {
    const id = typeof tier === 'string' ? tier : tier.id;
    this.materialQuality.value = id === 'high' ? 2 : id === 'mid' ? 1 : 0;
    // low はライトマップ無し（頂点焼き込みのみ）なので環境マップの拡散と動的光の拡散を多めに残す
    this.iblDiffuse.value = id === 'low' ? 0.35 : 0.12;
    this.directDiffuse.value = id === 'low' ? 0.8 : 0.4;
  }

  /** 共有材質（全部屋で 1 オブジェクト。CC0 は先頭候補、トーン 0） */
  get(id: MatId): THREE.MeshStandardMaterial {
    let m = this.cache.get(id);
    if (m) return m;
    m = this.createMaterial(id, {}, this.firstVariant(id), 0);
    this.cache.set(id, m);
    return m;
  }

  /** 部屋別バリアント。上書きが空なら共有材質を返す（CC0 は先頭候補、トーン 0） */
  variant(id: MatId, o: MaterialOverrides): THREE.MeshStandardMaterial {
    return this.material(id, o, this.firstVariant(id), 0);
  }

  /**
   * 部屋単位の材質（v1.3 写実化）。variant（上書き）に加えて、部屋 seed による素材バリエーション / 色相・明度のトーンと
   * ライトマップ（担当 L1: Worker で焼いたテクセル照明。uv1 を使う）を持てる。lightMap 付きは部屋ごとの clone になるので
   * RoomBuilder.dispose から releaseRoom(roomId) を呼ぶこと。lightMap が無ければ (MatId, 上書き, バリエーション, トーン) で共有する材質を返す
   */
  forRoom(id: MatId, ctx: RoomMaterialContext): THREE.MeshStandardMaterial {
    const o = ctx.overrides ?? {};
    const pick = this.pick(id, ctx.seed);
    const base = this.material(id, o, pick.variant, pick.tone);
    if (pick.variant >= 0) {
      const set = this.cc0Sets.get(CC0_VARIANTS[id]![pick.variant].set);
      if (set) this.retain(ctx.roomId, set);
    }
    if (!ctx.lightMap) return base;
    const key = `${base.name || id}|lm:${ctx.lightMap.uuid}`;
    let perRoom = this.roomMaterials.get(ctx.roomId);
    if (!perRoom) this.roomMaterials.set(ctx.roomId, perRoom = new Map());
    let m = perRoom.get(key);
    if (m) return m;
    m = cloneWithLightMap(base, ctx.lightMap, ctx.lightMapIntensity ?? 1);
    m.name = `${base.name || id}@${ctx.roomId}`;
    perRoom.set(key, m);
    return m;
  }

  /** 部屋を dispose したときに、その部屋専用の材質（lightMap 付き clone）を破棄し、参照の無くなった遅延 CC0 セットを GPU から解放する。共有 variant は残す */
  releaseRoom(roomId: string): void {
    const perRoom = this.roomMaterials.get(roomId);
    if (perRoom) {
      for (const m of perRoom.values()) m.dispose();
      this.roomMaterials.delete(roomId);
    }
    const sets = this.roomSets.get(roomId);
    if (!sets) return;
    this.roomSets.delete(roomId);
    for (const set of sets) {
      const rooms = this.setRooms.get(set);
      if (!rooms) continue;
      rooms.delete(roomId);
      if (!rooms.size) { this.setRooms.delete(set); this.maybeEvict(set); }
    }
    this.refreshCc0Status();
  }

  // ---------------------------------------------------------------- 2 hop 先の先読み（担当 L2。docs/perf-room-switch.md）

  /** 先読み中の部屋 → セット（構築されるまで / 対象から外れるまで evict しない） */
  private readonly prefetchSets = new Map<string, Set<Cc0Set>>();
  private readonly setPrefetchers = new Map<Cc0Set, Set<string>>();
  /** 事前コンパイル用の lightMap 付き clone（プログラムの参照を保つために残す。LRU） */
  private readonly lmProbes = new Map<string, THREE.MeshStandardMaterial>();
  /** 事前コンパイルに使う 2×2 のダミーライトマップ（プログラムは lightMap の有無だけで決まる） */
  private probeLightmap: THREE.DataTexture | null = null;
  private static readonly MAX_LM_PROBES = 96;

  /**
   * 部屋が使う CC0 セット（`pick(id, seed)` で選ばれる候補）の読込を始める。forRoom は呼ばない（材質は作らない）。
   * RoomBuilder.materialPlan の ids を渡す。戻り値は新たに読込 / 常駐にしたセット数
   */
  prefetchRoom(roomId: string, ids: MatId[], seed: number): number {
    let sets = this.prefetchSets.get(roomId);
    if (!sets) this.prefetchSets.set(roomId, sets = new Set());
    let started = 0;
    for (const id of ids) {
      const s = SURFACES[id];
      if (!s || s.flat) continue;
      const pick = this.pick(id, seed);
      if (pick.variant < 0) continue;
      const set = this.cc0Sets.get(CC0_VARIANTS[id]![pick.variant].set);
      if (!set || set.failed || set.eager) continue;
      if (!sets.has(set)) {
        sets.add(set);
        let rooms = this.setPrefetchers.get(set);
        if (!rooms) this.setPrefetchers.set(set, rooms = new Set());
        rooms.add(roomId);
      }
      if (!set.resident) started++;
      set.ensureLoaded();
    }
    this.refreshCc0Status();
    return started;
  }

  /** keep に無い部屋の先読みを外す。参照の無くなった遅延セットは GPU から解放する */
  dropPrefetch(keep: Set<string>): void {
    for (const [roomId, sets] of this.prefetchSets) {
      if (keep.has(roomId)) continue;
      this.prefetchSets.delete(roomId);
      for (const set of sets) {
        const rooms = this.setPrefetchers.get(set);
        if (!rooms) continue;
        rooms.delete(roomId);
        if (!rooms.size) { this.setPrefetchers.delete(set); this.maybeEvict(set); }
      }
    }
    this.refreshCc0Status();
  }

  /** 先読み中の部屋数 / セット数（デバッグ） */
  get prefetchStatus(): { rooms: number; sets: number } { return { rooms: this.prefetchSets.size, sets: this.setPrefetchers.size }; }

  /** 構築済みの部屋からも先読みからも参照されない遅延セットを GPU から解放する */
  private maybeEvict(set: Cc0Set): void {
    if (set.eager) return;
    if (this.setRooms.get(set)?.size) return;
    if (this.setPrefetchers.get(set)?.size) return;
    set.evict();
  }

  /**
   * 事前コンパイル用の材質（2 hop 先の部屋）。forRoom が返すものと同じプログラムになる材質を返す:
   * 共有 variant（seed のバリエーション・トーン）と、lightMap 付き clone の代表（ダミーの 2×2 ライトマップ。プログラムは
   * lightMap の有無で決まり、テクスチャの中身には依らない）。呼び出し側は Mesh に付けて renderer.compileAsync に渡す。
   * 代表 clone はプログラムの参照を保つためここで保持する（dispose するとプログラムが捨てられる）
   */
  probeMaterials(ids: MatId[], seed: number, overrides: MaterialOverrides, shared: MatId[] = []): THREE.MeshStandardMaterial[] {
    const out: THREE.MeshStandardMaterial[] = [];
    // 共有 variant（ライトマップ無し。扉・枠・小さな箱・可動要素）。上書き（roomfog / gradient / legacy …）があると別プログラム族になる
    for (const id of shared) if (SURFACES[id]) out.push(this.variant(id, overrides));
    for (const id of ids) {
      if (!SURFACES[id]) continue;
      const pick = this.pick(id, seed);
      const base = this.material(id, overrides, pick.variant, pick.tone);
      out.push(base);
      const key = `${base.name || id}|lmprobe`;
      let probe = this.lmProbes.get(key);
      if (probe && probe.userData.probeOf !== base) { probe.dispose(); probe = undefined; } // base が LRU で作り直されていた
      if (!probe) {
        if (!this.probeLightmap) {
          this.probeLightmap = new THREE.DataTexture(new Uint16Array(2 * 2 * 4), 2, 2, THREE.RGBAFormat, THREE.HalfFloatType);
          this.probeLightmap.colorSpace = THREE.NoColorSpace;
          this.probeLightmap.minFilter = this.probeLightmap.magFilter = THREE.LinearFilter;
          this.probeLightmap.generateMipmaps = false;
          this.probeLightmap.channel = 1;
          this.probeLightmap.needsUpdate = true;
        }
        probe = cloneWithLightMap(base, this.probeLightmap, 1);
        probe.name = key;
        probe.userData.probeOf = base;
        this.lmProbes.set(key, probe);
        while (this.lmProbes.size > MaterialLibrary.MAX_LM_PROBES) {
          const [oldKey, old] = this.lmProbes.entries().next().value as [string, THREE.MeshStandardMaterial];
          this.lmProbes.delete(oldKey);
          old.dispose();
        }
      } else {
        this.lmProbes.delete(key);
        this.lmProbes.set(key, probe); // LRU: 末尾へ
      }
      out.push(probe);
    }
    return out;
  }

  /** 部屋 seed から (バリエーション, トーン) を決める。決定論（node.seed から。世界の乱数列は消費しない） */
  pick(id: MatId, seed: number): MaterialPick {
    const avail = this.availableVariants(id);
    const variant = avail.length ? avail[variantHash(seed, id, 'set') % avail.length] : -1;
    const tone = variantHash(seed, id, 'tone') % TONE_TABLE.length;
    return { variant, tone };
  }

  /** variant 族の事前コンパイル（Rare 以上の部屋を 2 hop 先で確定したときに呼ぶ）。対象 MatId の代表だけコンパイルする */
  precompile(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, o: MaterialOverrides, ids: MatId[] = ['wallWhite', 'floorConcrete', 'lightPanel', 'water']): void {
    const probe = new THREE.Group();
    for (const id of ids) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(.1, .1, .1), this.variant(id, o));
      mesh.geometry.setAttribute('bakedLight', new THREE.Float32BufferAttribute(new Float32Array(mesh.geometry.getAttribute('position').count * 3), 3));
      probe.add(mesh);
    }
    scene.add(probe);
    try { renderer.compile(scene, camera); } finally {
      scene.remove(probe);
      probe.traverse((x) => { if (x instanceof THREE.Mesh) x.geometry.dispose(); });
    }
  }

  /** この MatId が CC0 セットで描かれるか（デバッグ / 検証用） */
  usesCc0(id: MatId): boolean { return this.availableVariants(id).length > 0; }

  /** id の候補のうち index にあって読込に失敗していないものの添字 */
  private availableVariants(id: MatId): number[] {
    const list = CC0_VARIANTS[id];
    if (!list) return [];
    const out: number[] = [];
    for (let i = 0; i < list.length; i++) { const s = this.cc0Sets.get(list[i].set); if (s && !s.failed) out.push(i); }
    return out;
  }

  private firstVariant(id: MatId): number { const a = this.availableVariants(id); return a.length ? a[0] : -1; }

  /** (MatId, 上書き, バリエーション, トーン) で共有する材質。上書き無し・先頭候補・トーン 0 は get() と同じ */
  private material(id: MatId, o: MaterialOverrides, vi: number, tone: number): THREE.MeshStandardMaterial {
    const s = SURFACES[id];
    const plainStyle = s.flat || o.style === 'untextured' || o.style === 'legacy';
    const first = this.firstVariant(id);
    if (plainStyle) { vi = first; tone = 0; } // 無地 / 旧版風は CC0 もトーンも使わない
    if (vi < 0 || !CC0_VARIANTS[id]?.[vi]) vi = first;
    const vkey = variantKey(id, o);
    const suffix = vi !== first || tone !== 0 ? `#v${vi}t${tone}` : '';
    if (vkey === null && !suffix) return this.get(id);
    const key = `${vkey ?? id}${suffix}`;
    let m = this.variants.get(key);
    if (m) {
      // LRU: 末尾へ
      this.variants.delete(key);
      this.variants.set(key, m);
      return m;
    }
    m = this.createMaterial(id, o, vi, tone);
    m.name = key;
    this.variants.set(key, m);
    while (this.variants.size > MAX_VARIANTS) {
      const [oldKey, old] = this.variants.entries().next().value as [string, THREE.MeshStandardMaterial];
      this.variants.delete(oldKey);
      old.dispose(); // GPU プログラムの参照を外すだけ。使用中の Mesh は次の描画で再初期化される
    }
    return m;
  }

  private retain(roomId: string, set: Cc0Set): void {
    let sets = this.roomSets.get(roomId);
    if (!sets) this.roomSets.set(roomId, sets = new Set());
    sets.add(set);
    let rooms = this.setRooms.get(set);
    if (!rooms) this.setRooms.set(set, rooms = new Set());
    rooms.add(roomId);
    set.ensureLoaded();
    // 先読み（優先度 2）で待っていたテクスチャは、構築で使われる部屋のもの（優先度 1）へ
    for (const t of set.baseTextures()) this.uploads.promote(t, 1);
    this.refreshCc0Status();
  }

  /** 構築済みの部屋が参照するセットか（先読みだけなら false。アップロードの優先度に使う） */
  private isRetained(set: Cc0Set): boolean { return !!this.setRooms.get(set)?.size; }

  /** index.json の内容から CC0 セットを作り、先頭候補（get / variant が使う）だけ同じ LoadingManager で読む（onLoad が再度発火するのを待つ） */
  private startCc0(index: Cc0Index): Promise<void> {
    const base = baseUrl() + CC0_MATERIALS_URL;
    // Displacement（視差）を読むセット
    const wantHeight = new Set<string>();
    for (const list of Object.values(CC0_VARIANTS)) for (const v of list!) if ((v.parallax ?? 0) > 0) wantHeight.add(v.set);
    const eager = new Set<Cc0Set>();
    const onFail = (_failed: Cc0Set) => this.refreshCc0Status(); // 失敗したセットは availableVariants から外れる（材質は代替の単色のまま）
    const host: Cc0Host = {
      loader: this.loader, bitmapLoader: this.bitmapLoader,
      track: (t) => this.track(t),
      enqueueUpload: (set, t, big) => { if (L2_FLAGS.queue) this.uploads.enqueue(t, { big, priority: set.eager || this.isRetained(set) ? 1 : 2 }); },
      cancelUpload: (t) => this.uploads.cancel(t),
    };
    for (const list of Object.values(CC0_VARIANTS) as Cc0Variant[][]) {
      let first = true;
      for (const v of list) {
        const entry = index[v.set];
        if (!entry) continue;
        let set = this.cc0Sets.get(v.set);
        if (!set) { set = new Cc0Set(v.set, entry, base, host, this.anisotropy, wantHeight.has(v.set), onFail); this.cc0Sets.set(v.set, set); }
        if (first) { set.eager = true; eager.add(set); first = false; }
      }
    }
    this.refreshCc0Status();
    if (!eager.size) return Promise.resolve();
    // onLoad は itemStart より先に差し替える（読込は非同期なので同期的に発火することはないが、順序を明示する）
    const done = new Promise<void>((resolve) => { this.manager.onLoad = () => resolve(); });
    for (const set of eager) set.ensureLoaded();
    return done;
  }

  private refreshCc0Status(): void {
    this.cc0Status.sets = this.cc0Sets.size;
    let loaded = 0;
    for (const set of this.cc0Sets.values()) if (set.resident) loaded++;
    this.cc0Status.loaded = loaded;
    let materials = 0, variants = 0;
    for (const id of Object.keys(CC0_VARIANTS) as MatId[]) { const n = this.availableVariants(id).length; if (n) materials++; variants += n; }
    this.cc0Status.materials = materials; this.cc0Status.variants = variants;
  }

  private createMaterial(id: MatId, o: MaterialOverrides, vi: number, tone: number): THREE.MeshStandardMaterial {
    const s = SURFACES[id];
    const legacy = o.style === 'legacy';
    const flat = s.flat || o.style === 'untextured';
    const color = new THREE.Color(s.color);
    // CC0 セット（写真計測 PBR）。legacy / untextured は従来どおり生成テクスチャ側の経路
    const bind: Cc0Variant | undefined = vi >= 0 ? CC0_VARIANTS[id]?.[vi] : undefined;
    const boundSet = bind ? this.cc0Sets.get(bind.set) : undefined;
    const cc0Set = flat || legacy || !boundSet || boundSet.failed ? undefined : boundSet;
    const cc0Bind = cc0Set ? bind : undefined;
    const cc0Albedo = !!cc0Set && !!cc0Bind && cc0Bind.albedo !== false;
    const cc0 = cc0Set && cc0Bind ? cc0Set.derive(s.meters / cc0Bind.meters, !!cc0Bind.rotate, cc0Albedo) : null;
    if (cc0Albedo && cc0Bind?.tint) color.setRGB(cc0Bind.tint[0], cc0Bind.tint[1], cc0Bind.tint[2], THREE.LinearSRGBColorSpace);
    if (o.colorScale !== undefined) color.multiplyScalar(o.colorScale);
    // 夜景（windowNight）: 1 枚貼りではなく、面の奥に置いた層（遠景 45 m / 近景 12 m）を視線で視差サンプルして発光にする（legacy / untextured は従来の 1 枚貼り）
    const night = s.texture === 'night' && !flat && !legacy;
    const map = night ? null : cc0 ? (cc0Albedo ? cc0.color : null) : flat || s.albedo===false ? null : legacy ? this.legacyTexture(s.texture) : this.textures.get(s.texture);
    const detail = flat || legacy || cc0 ? undefined : this.dataTextures.get(s.detail??s.texture);
    // CC0 の Roughness はそのまま roughnessMap に（係数 1 × 部屋別の倍率）。生成側は従来の s.roughness × 倍率
    const roughness = Math.max(.04, Math.min(1, (cc0 ? 1 : s.roughness) * (o.roughnessScale ?? 1)));
    const fogSpec = o.fog;
    const physical = !legacy && !flat && (!!s.glass || id === 'carPaint');
    const cc0NormalScale = cc0Bind?.normalScale ?? 1;
    // 2 層タイリング混合と視差（CC0 のみ。生成テクスチャは従来どおり）
    const blendParams = cc0Bind ? (cc0Bind.blend === false ? null : cc0Bind.blend ?? DEFAULT_BLEND) : null;
    const pom = !!cc0 && !!cc0.height && !!cc0Bind && (cc0Bind.parallax ?? 0) > 0;
    const parallaxHeight = pom && cc0Bind ? cc0Bind.parallax! / cc0Bind.meters : 0;
    const m = new (physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial)({
      name: id, color, map,
      roughness, metalness: legacy ? 0 : cc0 ? cc0Bind?.metalness ?? 0 : s.metalness ?? 0,
      normalMap: cc0 ? cc0.normal : detail && s.bump>0 ? this.normalTextures.get(s.detail??s.texture) : null,
      normalScale: cc0 ? new THREE.Vector2(cc0NormalScale, cc0NormalScale) : new THREE.Vector2(s.bump/s.meters,s.bump/s.meters),
      aoMap: cc0 ? cc0.ao : detail ? this.aoTextures.get(s.detail??s.texture) : null, aoMapIntensity: cc0 ? cc0Bind?.aoIntensity ?? 1 : 1,
      roughnessMap: cc0 ? cc0.roughness : detail ?? null,
      envMap: legacy ? null : this.environment?.texture ?? null, envMapIntensity: legacy ? 0 : .24 * (o.envMapIntensity ?? 1),
      transparent: s.opacity !== undefined, opacity: s.opacity ?? 1,
      depthWrite: s.opacity === undefined, side: s.opacity !== undefined || s.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
      emissive: s.emission ? (s.emissiveColor ?? s.color) : 0, emissiveMap: s.emission && !flat ? map : null,
      emissiveIntensity: s.emission ?? 0,
      flatShading: legacy,
      polygonOffset: !!s.decal, polygonOffsetFactor: s.decal ? -2 : 0, polygonOffsetUnits: s.decal ? -2 : 0,
    });
    if (fogSpec) m.fog = false; // 部屋固有の霧を材質側で計算する（scene.fog を無視）
    const gradient = o.gradient;
    const gradFrom = gradient ? new THREE.Color(SURFACES[gradient.from].color) : null;
    const gradTo = gradient ? new THREE.Color(SURFACES[gradient.to].color) : null;
    const mask = new THREE.Vector3(...(o.colorMask ?? [1, 1, 1]));
    const fogColor = new THREE.Color(1, 1, 1);
    if (fogSpec) fogColor.set(fogSpec.color); // 線形（作業色空間）のまま uniform に入れ、シェーダで出力色空間へ変換する（直接描画 / composer の両方で scene.fog と同じ扱い）
    if (m instanceof THREE.MeshPhysicalMaterial) {
      const g = s.glass;
      if (g) {
        // ガラス: 透過 + 弱い反射（金属度 0 のまま。反射量は envMap 強度で調整）
        m.transmission = g.transmission; m.ior = g.ior; m.thickness = g.thickness;
        m.opacity = 1; m.transparent = true; m.depthWrite = false; m.metalness = 0;
        m.envMapIntensity = .24 * g.reflect * (o.envMapIntensity ?? 1);
      }
      if (id === 'carPaint') { m.clearcoat = .85; m.clearcoatRoughness = .16; }
    }
    const authored = hasAuthoredDetail(s.texture);
    const varied = !flat && !legacy && usesSurfaceVariation(id);
    const worn = !flat && !legacy && usesSurfaceWear(id);
    const toned = !flat && !legacy;
    const common: CommonInjection = { baked: legacy ? 'floor(vBakedLight * 4.0 + 0.5) / 4.0' : 'vBakedLight', mask, fog: fogSpec ? { color: fogColor, near: fogSpec.near, far: fogSpec.far } : null };
    // 部屋トーン（色相 ±3°・明度 ±4%）: 線形 RGB の色相回転行列 × 明度。トーン 0 は単位行列
    const toneSpec = TONE_TABLE[tone] ?? TONE_TABLE[0];
    const toneMatrix = { value: hueMatrix(toneSpec.hue, toneSpec.light) };
    const tileParams = { value: new THREE.Vector3(...(blendParams ?? DEFAULT_BLEND)) };
    const tileSeed = { value: new THREE.Vector3(vi * 17.3 + 3.1, tone * 11.7 + 7.9, (vi + tone) * 5.3 + 1.7) };
    const parallaxMap = { value: pom && cc0 ? cc0.height : null };
    const parallaxScale = { value: parallaxHeight };
    // Generated irradiance supplements indirect diffuse, preserving direct PBR response.
    m.onBeforeCompile = (shader) => {
      if (s.flow && !flat) {
        shader.uniforms.surfaceTime = this.clock;
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float surfaceTime;');
        shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>\nvMapUv += vec2(surfaceTime * ${(0.006 * s.flow).toFixed(4)}, surfaceTime * ${(0.003 * s.flow).toFixed(4)});\n#ifdef USE_NORMALMAP\nvNormalMapUv += vec2(surfaceTime * ${(0.006 * s.flow).toFixed(4)}, surfaceTime * ${(0.003 * s.flow).toFixed(4)});\n#endif`);
      }
      // トーン / 2 層混合 / 視差の宣言。injectCommon より先に置く（後から置換したものほど #include の直後に入るので、
      // vRoomPos などの varying 宣言（injectCommon）がこの関数群より前に来る）
      if (toned) {
        shader.uniforms.liminalTone = toneMatrix;
        let pars = 'uniform mat3 liminalTone;';
        if (blendParams || pom) {
          shader.uniforms.tileBlendStrength = this.surfaceVariation;
          shader.uniforms.materialQuality = this.materialQuality;
          shader.uniforms.tileBlendParams = tileParams;
          shader.uniforms.tileSeed = tileSeed;
          pars += TILE_PARS_GLSL(!!blendParams);
        }
        if (pom) {
          shader.uniforms.parallaxMap = parallaxMap;
          shader.uniforms.parallaxHeight = parallaxScale;
          pars += '\nuniform sampler2D parallaxMap; uniform float parallaxHeight;';
        }
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${pars}`);
      }
      if (night) {
        const layers = this.nightLayers();
        shader.uniforms.nightFar = layers.far;
        shader.uniforms.nightNear = layers.near;
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vNightWorld; varying vec3 vNightNormal;');
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvNightWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvNightNormal = normalize(mat3(modelMatrix) * objectNormal);');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${NIGHT_PARS_GLSL}`);
        shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= liminalNight();');
      }
      // bakedLight / colorMask / 診断 / 部屋別の霧（adoptExternal と共通）
      this.injectCommon(shader, common);
      // 部屋トーンは map_fragment の直後（diffuseColor 確定後。colorMask との順は実用上可換）
      if (toned) shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb = max(vec3(0.0), liminalTone * diffuseColor.rgb);');
      // 勾配（MaterialGradient）は map_fragment の直後（diffuseColor 確定後。colorMask との積は可換）
      if (gradient && gradFrom && gradTo) {
        shader.uniforms.gradFrom = { value: gradFrom };
        shader.uniforms.gradTo = { value: gradTo };
        shader.uniforms.gradAxis = { value: new THREE.Vector3(...gradient.axis).normalize() };
        shader.uniforms.gradRange = { value: new THREE.Vector2(gradient.range[0], gradient.range[1]) };
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 gradFrom; uniform vec3 gradTo; uniform vec3 gradAxis; uniform vec2 gradRange;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
          float gradT = smoothstep(0.15, 0.85, clamp((dot(vRoomPos, gradAxis) - gradRange.x) / max(0.001, gradRange.y - gradRange.x), 0.0, 1.0));
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * gradTo / max(gradFrom, vec3(0.02)), gradT);`);
      }
      // 目地の暗線（grid）は生成テクスチャ用。CC0 の写真には目地が写っているので二重にしない
      if (s.grid && !flat && !legacy && !cc0) {
        shader.uniforms.surfaceGrid = { value: new THREE.Vector2(s.grid[0] / s.meters, s.grid[1] / s.meters) };
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec2 surfaceGrid;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
          vec2 guv = vMapUv / surfaceGrid;
          vec2 edge = abs(fract(guv + 0.5) - 0.5) * surfaceGrid;
          float seam = 1.0 - smoothstep(0.002, 0.006 + length(fwidth(vMapUv)), min(edge.x, edge.y));
          diffuseColor.rgb *= 1.0 - seam * 0.3;
        `);
      }
      // 2 層混合の重みと視差の UV オフセットは map_fragment より前に 1 回だけ求める（全マップのサンプルが使う）
      if (blendParams || pom) shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `${TILE_MAIN_GLSL(!!blendParams, pom)}\n#include <map_fragment>`);
      if (varied || worn) addSurfaceAppearance(shader, varied, this.surfaceVariation, this.surfaceWear, this.surfaceEnvironment);
      // 最後に: map / normalMap / roughnessMap / aoMap のサンプルを liminalSample（視差オフセット + 2 層混合）に差し替える。
      // addSurfaceAppearance が展開した map_fragment も、未展開の #include も同じ正規表現で拾えるよう先に展開する
      if (blendParams || pom) {
        let frag = shader.fragmentShader;
        for (const inc of ['map_fragment', 'roughnessmap_fragment', 'metalnessmap_fragment', 'normal_fragment_maps', 'aomap_fragment']) frag = frag.replace(`#include <${inc}>`, (THREE.ShaderChunk as Record<string, string>)[inc]);
        frag = frag.replace(/texture2D\(\s*(map|normalMap|roughnessMap|aoMap|metalnessMap)\s*,/g, 'liminalSample($1,');
        shader.fragmentShader = frag;
      }
    };
    // uniform 値はキーに含めない（同じプログラムを共有する）
    const family = flat ? 'flat' : legacy ? 'legacy' : cc0 ? (cc0Albedo ? 'cc0' : 'cc0paint') : authored ? 'authored' : 'plain';
    m.customProgramCacheKey = () => `liminal-pbr-v4-${varied || worn ? SURFACE_VARIATION_KEY : 'plain'}-${varied ? 'macro' : 'nomacro'}-${family}-${blendParams ? 'tile' : 'notile'}-${pom ? 'pom' : 'nopom'}-${s.flow && !flat ? 'flow' : 'static'}-${s.grid && !flat && !legacy && !cc0 ? s.grid.join(',') : 'nogrid'}-${gradient ? 'grad' : 'nograd'}-${fogSpec ? 'roomfog' : 'scenefog'}${night ? '-night' : ''}`;
    return m;
  }

  /** 夜景の視差層（起動後 1 回だけ生成。遠景 = 空 + 遠いビル + 街灯の滲み、近景 = 手前のビルのシルエット（アルファ）） */
  private nightLayerCache: { far: { value: THREE.Texture }; near: { value: THREE.Texture } } | null = null;
  private nightLayers(): { far: { value: THREE.Texture }; near: { value: THREE.Texture } } {
    if (!this.nightLayerCache) {
      const { far, near } = createNightLayers();
      this.track(far); this.track(near);
      this.nightLayerCache = { far: { value: far }, near: { value: near } };
    }
    return this.nightLayerCache;
  }

  /**
   * createMaterial / adoptExternal 共通の注入。
   * - 頂点属性 bakedLight（焼き込み光）を indirectDiffuse に足す
   * - colorMask（ColorMissing）を diffuse と発光に掛ける
   * - surfaceDiagnostic uniform（setDiagnostic）を共有する
   * - fog があれば scene.fog の代わりに部屋固有の霧を出力色空間で混ぜる（material.fog=false は呼び出し側）
   */
  /** 環境マップの拡散成分（IBL irradiance）の倍率。ライトマップ / 頂点焼き込みが拡散を持つので、mid/high では 0.08 まで落とす（鏡面は envMapIntensity のまま） */
  private readonly iblDiffuse = { value: 0.12 };
  /** 動的 PointLight の拡散成分の倍率。直接光の拡散は焼き込みが担い、動的光は床の鏡面反射（器具の映り込み）主体にする */
  private readonly directDiffuse = { value: 0.4 };

  private injectCommon(shader: ShaderParams, c: CommonInjection): void {
    shader.uniforms.surfaceDiagnostic = this.diagnostic;
    shader.uniforms.colorMask = { value: c.mask };
    shader.uniforms.liminalIblDiffuse = this.iblDiffuse;
    shader.uniforms.liminalDirectDiffuse = this.directDiffuse;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 bakedLight; varying vec3 vBakedLight; varying vec3 vRoomPos; varying float vRoomFogDepth;');
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvBakedLight = bakedLight;\nvRoomPos = transformed;');
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvRoomFogDepth = -mvPosition.z;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vBakedLight; varying vec3 vRoomPos; varying float vRoomFogDepth; uniform int surfaceDiagnostic; uniform vec3 colorMask; uniform float liminalIblDiffuse; uniform float liminalDirectDiffuse;');
    // 環境マップの拡散（一様な照度）は焼き込みと二重になるので倍率を掛ける（lights_fragment_maps で iblIrradiance が決まった直後）
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_maps>', '#include <lights_fragment_maps>\niblIrradiance *= liminalIblDiffuse;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>\nreflectedLight.directDiffuse *= liminalDirectDiffuse;\nreflectedLight.indirectDiffuse += ${c.baked} * BRDF_Lambert( diffuseColor.rgb );`);
    // 色マスク（ColorMissing）は map_fragment の直後（diffuseColor 確定後）
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= colorMask;');
    // 色マスクは発光にも掛ける（ColorMissing E20 で発光箔・サインの欠損チャンネルだけが残らないように。uniform は同じ）
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= colorMask;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
      if (surfaceDiagnostic == 1) outgoingLight = diffuseColor.rgb;
      if (surfaceDiagnostic == 2) outgoingLight = vec3(roughnessFactor);
      if (surfaceDiagnostic == 3) outgoingLight = normal * 0.5 + 0.5;
      if (surfaceDiagnostic == 4) outgoingLight = ${c.baked};
      if (surfaceDiagnostic >= 6) outgoingLight = vec3(0.0);
      if (surfaceDiagnostic == 5) outgoingLight = reflectedLight.directDiffuse + reflectedLight.directSpecular;
      #include <opaque_fragment>
    `);
    if (c.fog) {
      shader.uniforms.roomFogColor = { value: c.fog.color };
      shader.uniforms.roomFogNear = { value: c.fog.near };
      shader.uniforms.roomFogFar = { value: c.fog.far };
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 roomFogColor; uniform float roomFogNear; uniform float roomFogFar;');
      // scene.fog と同じ位置（出力色空間へ変換後）で混ぜる。霧色は線形 uniform なので linearToOutputTexel で同じ空間へ
      // （画面へ直接描くときは sRGB 符号化、EffectComposer の線形 RenderTarget へ描くときは恒等）
      shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', '#include <fog_fragment>\ngl_FragColor.rgb = mix(gl_FragColor.rgb, linearToOutputTexel(vec4(roomFogColor, 1.0)).rgb, smoothstep(roomFogNear, roomFogFar, vRoomFogDepth));');
    }
  }

  /**
   * 外部（glTF）由来の MeshStandardMaterial を clone し、createMaterial と同じ注入を施す。
   * - ジオメトリ側に vec3 属性 'bakedLight'（InstancedMesh なら InstancedBufferAttribute）が必要
   * - overrides.fog があれば material.fog=false にして部屋固有の霧を材質側で計算、colorMask は diffuse / 発光に乗算
   * - envMap は共有 environment（envMapIntensity は createMaterial と同じ .24）
   * - テクスチャは元材質と共有する（clone は参照のみ。呼び出し側は返り値を dispose してもテクスチャは残る）
   * - プログラム族は 'external-roomfog' / 'external-scenefog' の 2 つだけ（uniform 値はキーに含めない）
   * 毎回新しい材質を作るので、呼び出し側（PropCatalog）が「元材質 × externalOverridesKey」でキャッシュする
   */
  adoptExternal(src: THREE.MeshStandardMaterial, overrides?: ExternalOverrides): THREE.MeshStandardMaterial {
    const m = src.clone();
    m.envMap = this.environment?.texture ?? null;
    m.envMapIntensity = .24;
    const fogSpec = overrides?.fog;
    if (fogSpec) m.fog = false; // 部屋固有の霧を材質側で計算する（scene.fog を無視）
    const mask = new THREE.Vector3(...(overrides?.colorMask ?? [1, 1, 1]));
    const fogColor = new THREE.Color(1, 1, 1);
    if (fogSpec) fogColor.set(fogSpec.color); // 線形（作業色空間）のまま uniform に入れ、シェーダで出力色空間へ変換する（直接描画 / composer の両方で scene.fog と同じ扱い）
    const common: CommonInjection = { baked: 'vBakedLight', mask, fog: fogSpec ? { color: fogColor, near: fogSpec.near, far: fogSpec.far } : null };
    // 元材質に onBeforeCompile があっても引き継がない（glTF の材質は素の MeshStandardMaterial。二重注入を避ける）
    m.onBeforeCompile = (shader) => { this.injectCommon(shader, common); };
    m.customProgramCacheKey = () => `liminal-external-v1-${fogSpec ? 'roomfog' : 'scenefog'}`;
    return m;
  }

  /** 旧版風（RenderStyle legacy）: 32 px の NearestFilter テクスチャ。画像未読込なら単色で作り、読込完了時に差し替える */
  private legacyTexture(id: TextureId): THREE.Texture {
    let t = this.legacyTextures.get(id);
    if (t) return t;
    t = new THREE.CanvasTexture(this.legacyCanvas(id));
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    t.name = `legacy/${id}`;
    this.legacyTextures.set(id, t);
    return t;
  }

  private legacyCanvas(id: TextureId): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const ctx = c.getContext('2d')!;
    const src = this.textures.get(id)?.image as CanvasImageSource | undefined;
    const ready = !!src && (src as HTMLImageElement).width > 0;
    if (ready) { ctx.imageSmoothingEnabled = true; ctx.drawImage(src!, 0, 0, 32, 32); }
    else { ctx.fillStyle = '#9a9a92'; ctx.fillRect(0, 0, 32, 32); }
    return c;
  }

  private refreshLegacyTextures(): void {
    for (const [id, t] of this.legacyTextures) { t.image = this.legacyCanvas(id); t.needsUpdate = true; }
  }

  /** Development comparison switch; does not affect world RNG or save state. */
  setSurfaceEnvironment(enabled: boolean): void { this.surfaceEnvironment.value=enabled?1:0; }
  setSurfaceWear(enabled: boolean): void { this.surfaceWear.value = enabled ? 1 : 0; }

  /** 表面のバリエーション（SurfaceAppearance のマクロ変化 + CC0 の 2 層タイリング混合）の on/off */
  setSurfaceVariation(enabled: boolean): void { this.surfaceVariation.value = enabled ? 1 : 0; }

  setDiagnostic(mode: string): void { this.diagnostic.value = Math.max(0, ['beauty','albedo','roughness','normal','baked','direct','wear','environment'].indexOf(mode)); }

  update(dt: number): void { this.clock.value += dt; }

  /** 現在のバリアント数（デバッグ表示用） */
  get variantCount(): number { return this.variants.size; }

  dispose(): void {
    for (const m of this.cache.values()) m.dispose();
    for (const m of this.variants.values()) m.dispose();
    for (const m of this.lmProbes.values()) m.dispose();
    this.lmProbes.clear();
    this.probeLightmap?.dispose();
    this.probeLightmap = null;
    this.uploads.clear();
    this.prefetchSets.clear(); this.setPrefetchers.clear();
    for (const perRoom of this.roomMaterials.values()) for (const m of perRoom.values()) m.dispose();
    for (const t of [...this.textures.values(), ...this.dataTextures.values(), ...this.normalTextures.values(), ...this.aoTextures.values(), ...this.legacyTextures.values()]) t.dispose();
    for (const set of this.cc0Sets.values()) set.dispose();
    this.cc0Sets.clear(); this.roomSets.clear(); this.setRooms.clear(); this.roomMaterials.clear();
    this.environment?.dispose(); this.cache.clear(); this.variants.clear();
  }
}

/**
 * 2 層タイリング混合と視差の宣言（fragment。`#include <common>` の直後、injectCommon の varying より後に置かれる）。
 * liminalSample は map / normalMap / roughnessMap / aoMap の全サンプルの差し替え先: 視差の UV オフセットを足し、
 * 2 層目（uv * scale + offset）を部屋座標の低周波ノイズの重みで混ぜる。カラー・法線・粗さ・AO に同じ重みが掛かる
 */
function TILE_PARS_GLSL(blend: boolean): string {
  return `
uniform float tileBlendStrength; uniform float materialQuality; uniform vec3 tileBlendParams; uniform vec3 tileSeed;
float tileMixWeight = 0.0;
vec2 tileUvOffset = vec2(0.0);
float tileHash(vec3 p) { p = fract(p * 0.3183099 + vec3(0.1, 0.7, 0.3)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float tileNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(tileHash(i), tileHash(i + vec3(1, 0, 0)), f.x), mix(tileHash(i + vec3(0, 1, 0)), tileHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(tileHash(i + vec3(0, 0, 1)), tileHash(i + vec3(1, 0, 1)), f.x), mix(tileHash(i + vec3(0, 1, 1)), tileHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
vec4 liminalSample(sampler2D s, vec2 uv) {
  uv += tileUvOffset;
  vec4 a = texture2D(s, uv);
  ${blend ? 'if (tileMixWeight > 0.001) a = mix(a, texture2D(s, uv * tileBlendParams.x + tileBlendParams.yz), tileMixWeight);' : ''}
  return a;
}`;
}

/** main() 内、map_fragment の直前: 混合の重み（部屋座標の値ノイズ、周期 TILE_NOISE_PERIOD）と視差（POM）の UV オフセット */
function TILE_MAIN_GLSL(blend: boolean, pom: boolean): string {
  const weight = blend ? `tileMixWeight = smoothstep(0.35, 0.65, tileNoise(vRoomPos * ${(1 / TILE_NOISE_PERIOD).toFixed(4)} + tileSeed)) * tileBlendStrength * step(0.5, materialQuality);` : '';
  const parallax = pom ? `
#if defined( USE_NORMALMAP_TANGENTSPACE ) && !defined( FLAT_SHADED )
if (materialQuality > 1.5 && parallaxHeight > 0.0) {
  float pomDist = length(vViewPosition);
  float pomFade = 1.0 - smoothstep(6.0, 14.0, pomDist);
  if (pomFade > 0.0) {
    vec3 pomN = normalize(vNormal);
    #ifdef DOUBLE_SIDED
      pomN *= gl_FrontFacing ? 1.0 : -1.0;
    #endif
    mat3 pomTbn = getTangentFrame(-vViewPosition, pomN, vNormalMapUv);
    vec3 pomV = normalize(vViewPosition);
    vec3 pomVt = vec3(dot(pomV, pomTbn[0]), dot(pomV, pomTbn[1]), dot(pomV, pomTbn[2]));
    // 8〜16 ステップの線形探索 + 直前層との補間。視線が寝るほど UV の移動が大きいので z を 0.3 で下限
    float pomSteps = mix(16.0, 8.0, smoothstep(2.0, 10.0, pomDist));
    vec2 pomUv0 = vNormalMapUv;
    vec2 pomDx = dFdx(pomUv0), pomDy = dFdy(pomUv0);
    vec2 pomDelta = pomVt.xy / max(pomVt.z, 0.3) * (parallaxHeight * pomFade) / pomSteps;
    float pomLayer = 1.0 / pomSteps, pomDepth = 0.0;
    vec2 pomUv = pomUv0;
    float pomH = 1.0 - textureGrad(parallaxMap, pomUv, pomDx, pomDy).r;
    for (int i = 0; i < 16; i++) {
      if (pomDepth >= pomH || float(i) >= pomSteps) break;
      pomUv -= pomDelta; pomDepth += pomLayer;
      pomH = 1.0 - textureGrad(parallaxMap, pomUv, pomDx, pomDy).r;
    }
    vec2 pomPrev = pomUv + pomDelta;
    float pomAfter = pomH - pomDepth;
    float pomBefore = (1.0 - textureGrad(parallaxMap, pomPrev, pomDx, pomDy).r) - pomDepth + pomLayer;
    float pomW = clamp(pomAfter / (pomAfter - pomBefore + 1e-5), 0.0, 1.0);
    tileUvOffset = mix(pomUv, pomPrev, pomW) - pomUv0;
  }
}
#endif` : '';
  return `${weight}${parallax}`;
}

/** 線形 RGB の色相回転（灰軸まわりの Rodrigues 回転）× 明度倍率 */
function hueMatrix(hueDeg: number, light: number): THREE.Matrix3 {
  const a = hueDeg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const k = (1 - c) / 3, r = s / Math.sqrt(3);
  return new THREE.Matrix3().set(
    c + k, k - r, k + r,
    k + r, c + k, k - r,
    k - r, k + r, c + k,
  ).multiplyScalar(1 + light);
}

/**
 * CC0 セット 1 組（Color / NormalGL / Roughness / AO / Displacement）。repeat・回転の違いは Source を共有する clone で持つ（GPU 上は 1 枚）。
 * - 読込は ensureLoaded() で始まる（先頭候補は起動時、他は初回使用時）。読込前は index.json の平均色（法線は平坦、粗さ 0.7）の 1 px を
 *   入れておくので、読込中・失敗時も黒くならず単色で描ける。
 * - evict() は GPU のテクスチャだけ捨てる（Image と派生 Texture は保持）。次に描かれるとき three が再アップロードする
 */
/** Cc0Set が MaterialLibrary から借りるもの（読込器・アップロード追跡・先行アップロードの待ち行列） */
interface Cc0Host {
  loader: THREE.TextureLoader;
  /** createImageBitmap が使えるときだけ（デコードを main thread から外す） */
  bitmapLoader: THREE.ImageBitmapLoader | null;
  track(t: THREE.Texture): void;
  /** 読込完了したテクスチャを先行アップロードの待ち行列へ（big: 1024² 級） */
  enqueueUpload(set: Cc0Set, t: THREE.Texture, big: boolean): void;
  cancelUpload(t: THREE.Texture): void;
}

/** forRoom / probeMaterials 共通: 共有 variant の clone に lightMap（uv1）を付ける。プログラム族は `<base>-lm` */
function cloneWithLightMap(base: THREE.MeshStandardMaterial, lightMap: THREE.Texture, intensity: number): THREE.MeshStandardMaterial {
  const m = base.clone();
  m.onBeforeCompile = base.onBeforeCompile;
  const baseKey = base.customProgramCacheKey.bind(base);
  m.customProgramCacheKey = () => `${baseKey()}-lm`;
  m.lightMap = lightMap;
  m.lightMapIntensity = intensity;
  return m;
}

class Cc0Set {
  color: THREE.Texture | null = null; normal: THREE.Texture | null = null; roughness: THREE.Texture | null = null; ao: THREE.Texture | null = null; height: THREE.Texture | null = null;
  failed = false;
  /** 起動時に読む先頭候補（evict しない） */
  eager = false;
  /** GPU に載っている（読込中含む） */
  resident = false;
  readonly id: string;
  private loaded = false;
  private started = false;
  private disposed = false;
  /** 読込完了した枚数（全枚数に達したら isLoaded） */
  private arrived = 0;
  private total = 0;
  private readonly derived = new Map<string, Cc0Maps>();
  private readonly entry: Cc0IndexEntry;
  private readonly base: string;
  private readonly host: Cc0Host;
  private readonly wantHeight: boolean;
  private readonly onFail: (set: Cc0Set) => void;
  private anisotropy: number;

  // パラメータプロパティは使わない（Node の strip-only モードで tests / seam-stats がこのモジュールを読むため）
  constructor(id: string, entry: Cc0IndexEntry, base: string, host: Cc0Host, anisotropy: number, wantHeight: boolean, onFail: (set: Cc0Set) => void) {
    this.id = id; this.entry = entry; this.base = base; this.host = host; this.anisotropy = anisotropy; this.wantHeight = wantHeight; this.onFail = onFail;
  }

  /**
   * 読込を始める（2 回目以降は何もしない）。evict 後に再び使われるときは、読込済みの画像を先行アップロードの待ち行列に戻す
   * （放っておくと最初に描かれるフレームで全枚数が同期アップロードされる）
   */
  ensureLoaded(): void {
    const wasResident = this.resident;
    this.resident = true;
    if (this.started) {
      if (!wasResident) this.enqueueAll();
      return;
    }
    this.started = true;
    const avg = parseHex(this.entry.avg) ?? [128, 128, 128];
    const make = (file: string, kind: string, srgb: boolean, placeholder: [number, number, number]) => {
      const t = new THREE.Texture();
      // 読込前・失敗時の 1 px（Source を共有する派生 clone にも同じ画像が入る）
      const img = solidImage(placeholder);
      if (img) { t.image = img; t.needsUpdate = true; }
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping; // 計測素材はシームレス。法線は鏡像にしない
      t.channel = 0; // aoMap も uv（applyMetricUV / writeSurfaceCoordinates の出力）を使う
      t.anisotropy = this.anisotropy;
      t.name = `cc0/${this.id}/${kind}`;
      this.host.track(t);
      this.total++;
      // 到着: 1 px の仮画像で確保した GL ストレージ（texStorage2D）に別寸法の画像を texSubImage2D すると GL_INVALID_VALUE になるので、
      // 先に dispose して新しい寸法で確保し直させる（派生 clone も同様）。その後、先行アップロードの待ち行列へ入れる
      // （描かれる前に届いていれば、余裕のあるフレームで 1〜2 枚ずつ GPU に載る。描かれてしまえば three が同期で載せる）
      const onLoad = (image: TexImageSource) => {
        if (this.disposed) return;
        t.image = image;
        // ImageBitmap は imageOrientation: 'flipY' で既に上下が揃っている（three は ImageBitmap の flipY を無視する。cache key を派生と揃えるため false）
        if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) t.flipY = false;
        t.dispose();
        t.needsUpdate = true;
        this.arrived++;
        this.touch();
        if (this.resident) this.host.enqueueUpload(this, t, isBigImage(image));
      };
      const onError = () => { if (!this.failed) { this.failed = true; this.onFail(this); } };
      const url = this.base + file;
      if (this.host.bitmapLoader) this.host.bitmapLoader.load(url, onLoad, undefined, onError);
      else this.host.loader.load(url, (loaded) => onLoad(loaded.image as TexImageSource), undefined, onError);
      return t;
    };
    this.color = make(this.entry.color, 'color', true, avg);
    this.normal = make(this.entry.normal, 'normal-GL', false, [128, 128, 255]);
    this.roughness = make(this.entry.roughness, 'roughness', false, [180, 180, 180]);
    this.ao = this.entry.ao ? make(this.entry.ao, 'ao-uv0', false, [255, 255, 255]) : null;
    this.height = this.wantHeight && this.entry.displacement ? make(this.entry.displacement, 'height', false, [128, 128, 128]) : null;
    // 既に作ってあった派生（読込前に derive された場合）へ元テクスチャを渡す
    for (const [key, d] of this.derived) this.fill(key, d);
  }

  /** 読込済みの元テクスチャを先行アップロードの待ち行列へ（evict 後の再利用） */
  private enqueueAll(): void {
    for (const t of this.baseTextures()) {
      if (!isRealImage(t.image)) continue;
      t.needsUpdate = true;
      this.host.enqueueUpload(this, t, isBigImage(t.image as TexImageSource));
    }
  }

  /** 元テクスチャ（派生 clone を除く。GPU 上はこれと共有） */
  baseTextures(): THREE.Texture[] {
    const out: THREE.Texture[] = [];
    for (const t of [this.color, this.normal, this.roughness, this.ao, this.height]) if (t) out.push(t);
    return out;
  }

  /** SURFACES.meters / 実寸 の repeat と 90° 回転を持つ派生テクスチャ。読込を始めていなければ始める */
  derive(repeat: number, rotate: boolean, albedo = true): Cc0Maps {
    this.ensureLoaded();
    const key = `${repeat.toFixed(4)}|${rotate ? 1 : 0}|${albedo ? 'c' : 'p'}`;
    let d = this.derived.get(key);
    if (d) return d;
    d = { color: null, normal: null, roughness: null, ao: null, height: null };
    this.fill(key, d);
    this.derived.set(key, d);
    return d;
  }

  private fill(key: string, d: Cc0Maps): void {
    if (!this.color || !this.normal || !this.roughness) return;
    const [repeatText, rotateText, albedoText] = key.split('|');
    const repeat = Number(repeatText), rotate = rotateText === '1', albedo = albedoText === 'c';
    const make = (t: THREE.Texture | null) => {
      if (!t) return null;
      const c = t.clone(); // flipY / wrap / filter も写す（GL テクスチャの cache key が元と揃い、GPU 上は 1 枚になる）
      c.repeat.set(repeat, repeat);
      c.rotation = rotate ? Math.PI / 2 : 0;
      c.needsUpdate = !!t.image; // Source を共有するので読込済みなら次の描画で使える
      this.host.track(c);
      return c;
    };
    // 塗装面（albedo false）は Color を使わないので clone しない（GPU への再アップロードを避ける）
    d.color = albedo ? make(this.color) : this.color;
    d.normal = make(this.normal); d.roughness = make(this.roughness); d.ao = make(this.ao); d.height = make(this.height);
  }

  setAnisotropy(a: number): void {
    this.anisotropy = a;
    for (const t of this.all()) { t.anisotropy = a; if (t.image) t.needsUpdate = true; }
  }

  /** GPU のテクスチャを捨てる（Image と Texture オブジェクトは残す。次に使われるとき ensureLoaded が先行アップロードに戻す） */
  evict(): void {
    if (!this.resident) return;
    this.resident = false;
    for (const t of this.all()) { this.host.cancelUpload(t); t.dispose(); }
  }

  dispose(): void {
    this.disposed = true;
    for (const t of this.all()) { this.host.cancelUpload(t); t.dispose(); }
    this.derived.clear(); this.resident = false;
  }

  private all(): THREE.Texture[] {
    const list: THREE.Texture[] = [];
    for (const t of [this.color, this.normal, this.roughness, this.ao, this.height]) if (t) list.push(t);
    for (const d of this.derived.values()) for (const t of [d.color, d.normal, d.roughness, d.ao, d.height]) if (t && !list.includes(t)) list.push(t);
    return list;
  }

  /** 1 枚読み込まれるたび、既に作った派生テクスチャにも反映する（読込前に材質が作られた場合の保険）。flipY も元に揃える */
  private touch(): void {
    this.loaded = this.arrived >= this.total;
    const bases: [THREE.Texture | null, keyof Cc0Maps][] = [[this.color, 'color'], [this.normal, 'normal'], [this.roughness, 'roughness'], [this.ao, 'ao'], [this.height, 'height']];
    for (const d of this.derived.values()) {
      for (const [b, k] of bases) {
        const t = d[k];
        if (!t || !b || t === b || !t.image) continue;
        t.flipY = b.flipY;
        t.dispose();
        t.needsUpdate = true;
      }
    }
  }

  /** 全枚数が読み込まれた */
  get isLoaded(): boolean { return this.loaded; }
}

interface Cc0Maps { color: THREE.Texture | null; normal: THREE.Texture | null; roughness: THREE.Texture | null; ao: THREE.Texture | null; height: THREE.Texture | null; }

/** 1024² 級の画像か（アップロード待ち行列の重み） */
function isBigImage(image: TexImageSource | null | undefined): boolean {
  const w = (image as { width?: number } | null)?.width ?? 0;
  const h = (image as { height?: number } | null)?.height ?? 0;
  return w * h >= 768 * 768;
}

/** 読込済みの画像か（1 px の仮画像ではない） */
function isRealImage(image: unknown): boolean {
  const w = (image as { width?: number } | null)?.width ?? 0;
  return w > 1;
}

/** 先行アップロードの 1 項目 */
interface UploadItem {
  texture: THREE.Texture | null;
  /** アップロードの直前に走らせる処理（ライトマップ: 画像データの差し替えと頂点焼き込みの 0 化） */
  run: (() => void) | null;
  /** 1024² 級（1 フレームの枚数予算を 1 つ使う。小さい画像は 0.5） */
  big: boolean;
  /** ライトマップの反映（同じフレームに 2 部屋分は流さない） */
  lightmap: boolean;
  /** 小さいほど先（0: 見えている部屋のライトマップ / 1: 構築済み・構築待ちの部屋の素材 / 2: 2 hop 先の先読み） */
  priority: number;
  at: number;
  cancelled: boolean;
}

export interface UploadHandle {
  cancel(): void;
  readonly done: boolean;
}

/**
 * 読込済みテクスチャの先行アップロード待ち行列（担当 L2。docs/perf-room-switch.md）。
 * three.js はテクスチャを最初に描かれるフレームで同期アップロードする（1024² の JPEG で 5〜20 ms）。部屋 seed で変わる CC0 セット
 * 4〜5 枚とライトマップ（512² HalfFloat = 2 MB）が同じフレームに重なると 100 ms 級の停止になるので、読込が終わった時点で
 * ここに入れ、Game.step の末尾で更新の CPU 時間に余裕があるフレームだけ `renderer.initTexture` で 1〜2 枚ずつ載せる。
 * 描かれる前に載せ切れなかった分は従来どおり three が同期で載せる（見た目は変わらない）
 */
export class TextureUploadQueue {
  /** 1 フレームに載せる量（big = 1、小さい画像 = 0.5） */
  static UNITS_PER_FRAME = 2;
  /**
   * 更新の CPU 時間がこれ未満のフレームは UNITS_PER_FRAME、次の閾値未満なら 1、それ以上なら 0。
   * 分割構築中のフレーム（BUILD_BUDGET_MS ≈ 24 ms）でも 1 枚は通す: 止めてしまうと大部屋の構築中に届いた素材が
   * 扉を開けた瞬間にまとめて（40 枚 = 200 ms 級）同期アップロードされる
   */
  static BUDGET_FULL_MS = 8;
  static BUDGET_ONE_MS = 40;
  /** 重いフレームが続いても、この時間以上待った項目は 1 つだけ通す */
  static STARVE_MS = 1500;
  private readonly items: UploadItem[] = [];
  private readonly byTexture = new Map<THREE.Texture, UploadItem>();
  readonly stats = { uploaded: 0, applied: 0, framesWithUpload: 0, starved: 0, skippedBusy: 0 };

  get pending(): number { return this.items.length; }

  /** テクスチャ（またはライトマップ反映などの処理）を待ち行列へ。同じテクスチャは 1 項目にまとめる */
  enqueue(texture: THREE.Texture | null, opts: { big?: boolean; priority?: number; run?: () => void; lightmap?: boolean } = {}): UploadHandle {
    if (texture) {
      const existing = this.byTexture.get(texture);
      if (existing && !existing.cancelled) {
        existing.priority = Math.min(existing.priority, opts.priority ?? 1);
        if (opts.run) existing.run = opts.run;
        return { cancel: () => this.drop(existing), get done() { return existing.cancelled; } };
      }
    }
    const item: UploadItem = { texture, run: opts.run ?? null, big: opts.big ?? true, lightmap: opts.lightmap ?? false, priority: opts.priority ?? 1, at: performance.now(), cancelled: false };
    this.items.push(item);
    if (texture) this.byTexture.set(texture, item);
    return { cancel: () => this.drop(item), get done() { return item.cancelled; } };
  }

  cancel(texture: THREE.Texture): void {
    const item = this.byTexture.get(texture);
    if (item) this.drop(item);
  }

  private drop(item: UploadItem): void {
    if (item.cancelled) return;
    item.cancelled = true;
    const i = this.items.indexOf(item);
    if (i >= 0) this.items.splice(i, 1);
    if (item.texture) this.byTexture.delete(item.texture);
  }

  /** 優先度を変える（部屋が見えるようになった / 2 hop 先が隣接になった） */
  promote(texture: THREE.Texture, priority: number): void {
    const item = this.byTexture.get(texture);
    if (item && item.priority > priority) item.priority = priority;
  }

  /**
   * 毎フレーム末尾（描画の直前）。elapsedMs は今フレームの更新に使った CPU 時間。
   * 戻り値はアップロードした項目数
   */
  flush(renderer: THREE.WebGLRenderer, elapsedMs: number): number {
    if (!this.items.length) return 0;
    let units = elapsedMs < TextureUploadQueue.BUDGET_FULL_MS ? TextureUploadQueue.UNITS_PER_FRAME : elapsedMs < TextureUploadQueue.BUDGET_ONE_MS ? 1 : 0;
    const now = performance.now();
    if (units <= 0) {
      if (now - this.items[0].at > TextureUploadQueue.STARVE_MS || this.items.some((it) => now - it.at > TextureUploadQueue.STARVE_MS)) { units = 1; this.stats.starved++; }
      else { this.stats.skippedBusy++; return 0; }
    }
    // 優先度 → 到着順
    this.items.sort((a, b) => a.priority - b.priority || a.at - b.at);
    let n = 0;
    let lightmapDone = false;
    let i = 0;
    while (i < this.items.length && units > 0) {
      const item = this.items[i];
      if (item.lightmap && lightmapDone) { i++; continue; }
      this.items.splice(i, 1);
      if (item.texture) this.byTexture.delete(item.texture);
      item.cancelled = true; // 処理済み（done）
      try {
        if (item.run) { item.run(); this.stats.applied++; }
        if (item.texture) { renderer.initTexture(item.texture); this.stats.uploaded++; }
      } catch (err) {
        console.warn('[uploads] failed', err);
      }
      if (item.lightmap) lightmapDone = true;
      units -= item.big ? 1 : 0.5;
      n++;
    }
    if (n) this.stats.framesWithUpload++;
    return n;
  }

  clear(): void {
    for (const it of this.items) it.cancelled = true;
    this.items.length = 0;
    this.byTexture.clear();
  }
}

/** "#rrggbb" → [r, g, b]（0..255）。不正なら null */
function parseHex(hex: string | undefined): [number, number, number] | null {
  if (!hex || !/^#?[0-9a-f]{6}$/i.test(hex)) return null;
  const v = parseInt(hex.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** 1 px の単色画像（読込前の代替）。document が無い環境では null */
function solidImage(rgb: [number, number, number]): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  ctx.fillRect(0, 0, 1, 1);
  return c;
}

/** import.meta.env.BASE_URL（Node では '/'） */
function baseUrl(): string {
  try {
    const env = (import.meta as unknown as { env?: { BASE_URL?: string } }).env;
    return env?.BASE_URL ?? '/';
  } catch {
    return '/';
  }
}

/** public/cc0/materials/index.json を読む。無い / 失敗 / fetch が無い環境では null（従来の生成テクスチャに戻る） */
async function loadCc0Index(): Promise<Cc0Index | null> {
  if (typeof fetch !== 'function' || typeof document === 'undefined') return null;
  try {
    const res = await fetch(baseUrl() + CC0_INDEX_URL, { cache: 'no-cache' });
    if (!res.ok) return null;
    // Vite の dev server は無いパスに index.html を返すことがあるので JSON として解釈できるものだけ受け付ける
    const type = res.headers.get('content-type') ?? '';
    if (!/json/i.test(type)) return null;
    const json = (await res.json()) as unknown;
    if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
    const index: Cc0Index = {};
    for (const [id, e] of Object.entries(json as Record<string, Partial<Cc0IndexEntry>>)) {
      if (e && typeof e.color === 'string' && typeof e.normal === 'string' && typeof e.roughness === 'string') index[id] = { ...e, resolution: e.resolution ?? '?' } as Cc0IndexEntry;
    }
    return Object.keys(index).length ? index : null;
  } catch {
    return null;
  }
}

/**
 * 空箔の雲テクスチャ（256 px、タイル可能な値ノイズ 4 オクターブ）。明度 0.72〜1.0 の柔らかなまだらで、色は材質側（sky* の color）が付ける。
 * 見た目専用の固定シード（世界の乱数とは無関係）。document が無い環境（Node）では 1 px の白
 */
function createSkyTexture(): THREE.Texture {
  if (typeof document === 'undefined') return solidTexture([255, 255, 255]);
  const N = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = N;
  const ctx = canvas.getContext('2d')!;
  let seed = 0x5eed;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const lattice = (size: number) => Array.from({ length: size * size }, () => rnd());
  const sample = (g: number[], size: number, u: number, v: number) => {
    const x = u * size, y = v * size;
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const at = (i: number, j: number) => g[((j % size) + size) % size * size + ((i % size) + size) % size];
    const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
  };
  const octaves = [4, 8, 16, 32].map((size) => ({ size, g: lattice(size) }));
  const img = ctx.createImageData(N, N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let v = 0, amp = 1, sum = 0;
      for (const o of octaves) { v += sample(o.g, o.size, x / N, y / N) * amp; sum += amp; amp *= 0.5; }
      v /= sum;
      const l = Math.round(255 * (0.72 + 0.28 * Math.min(1, Math.max(0, (v - 0.3) / 0.4))));
      const i = (y * N + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = l;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

/**
 * 夜景の視差サンプリング（フラグメント）。面の world 位置と法線、cameraPosition から視線 D を求め、
 * 面の奥 d メートルの平面との交点を接線軸（T = up × N、B = up）に射影して層テクスチャをサンプルする。
 * 地平線はカメラの目の高さ（無限遠の地平線は常に目の高さ）。層は u 方向に周期、v はクランプ（上端 = 空、下端 = 地面の暗さ）。
 * 遠景: 45 m 奥・80 m × 40 m、近景: 12 m 奥・40 m × 40 m（アルファで遠景に重ねる）。sRGB → 線形は pow 2.2 の近似
 */
const NIGHT_PARS_GLSL = `
varying vec3 vNightWorld; varying vec3 vNightNormal;
uniform sampler2D nightFar; uniform sampler2D nightNear;
vec3 liminalNight() {
  vec3 D = normalize(vNightWorld - cameraPosition);
  vec3 N = normalize(vNightNormal);
  if (dot(D, N) > 0.0) N = -N;
  float denom = max(-dot(D, N), 0.08);
  vec3 T = abs(N.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : normalize(cross(vec3(0.0, 1.0, 0.0), N));
  float horizon = cameraPosition.y - 0.2;
  vec3 pf = vNightWorld + D * (45.0 / denom);
  vec2 uvf = vec2(dot(pf, T) / 80.0, clamp((pf.y - horizon) / 40.0 + 0.5, 0.002, 0.998));
  vec3 col = texture2D(nightFar, uvf).rgb;
  vec3 pn = vNightWorld + D * (12.0 / denom);
  vec2 uvn = vec2(dot(pn, T) / 40.0, clamp((pn.y - horizon) / 40.0 + 0.5, 0.002, 0.998));
  vec4 nearL = texture2D(nightNear, uvn);
  col = mix(col, nearL.rgb, nearL.a);
  return pow(col, vec3(2.2));
}`;

/**
 * 夜景の視差層。far: 1024 × 512 px = 80 m × 40 m（v 0.5 が地平線。空のグラデーション・遠いビル・街灯の滲み・地面）、
 * near: 1024 × 512 px = 40 m × 40 m（透明地に手前のビル。高さは地平線 −2〜+16 m、幅 6〜18 m、窓は 15% 点灯）。
 * 左右の端をまたぐ建物は x ± W にも描いてシームレス。見た目専用の固定シード。document が無い環境では 1 px の暗色
 */
function createNightLayers(): { far: THREE.Texture; near: THREE.Texture } {
  if (typeof document === 'undefined') return { far: solidTexture([12, 16, 26]), near: solidTexture([0, 0, 0]) };
  const W = 1024, H = 512, HZ = H / 2;
  let seed = 0x7f4a7c15;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const windows = (ctx: CanvasRenderingContext2D, x: number, top: number, w: number, bottom: number, cell: number, ww: number, wh: number, rate: number) => {
    const cols = Math.max(1, Math.floor((w - ww) / cell)), rows = Math.max(1, Math.floor((bottom - top - wh) / cell));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (rnd() > rate) continue;
      const a = (.45 + rnd() * .55).toFixed(2);
      ctx.fillStyle = rnd() < .7 ? `rgba(255,${196 + Math.floor(rnd() * 40)},${120 + Math.floor(rnd() * 60)},${a})` : `rgba(${150 + Math.floor(rnd() * 40)},${200 + Math.floor(rnd() * 30)},255,${a})`;
      for (const dx of [-W, 0, W]) ctx.fillRect(x + dx + 2 + c * cell, top + 3 + r * cell, ww, wh);
    }
  };
  // ---- 遠景 ----
  const farC = mk(); const f = farC.getContext('2d')!;
  const ppmF = W / 80; // px / m
  const sky = f.createLinearGradient(0, 0, 0, HZ + 8);
  sky.addColorStop(0, '#070a12'); sky.addColorStop(.55, '#111726'); sky.addColorStop(.9, '#262a38'); sky.addColorStop(1, '#3a3430');
  f.fillStyle = sky; f.fillRect(0, 0, W, HZ + 8);
  f.fillStyle = '#05060a'; f.fillRect(0, HZ + 8, W, H - HZ - 8);
  for (let i = 0; i < 9; i++) {
    const r = 20 + rnd() * 50, x = r + rnd() * (W - 2 * r), y = HZ - 4 + rnd() * 10;
    const g = f.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,176,96,0.34)'); g.addColorStop(.5, 'rgba(255,160,80,0.10)'); g.addColorStop(1, 'rgba(255,160,80,0)');
    f.fillStyle = g; f.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  // 遠いビル: 地平線の上 2〜14 m、幅 4〜14 m。奥の列（少し明るい）と手前の列
  for (let x = -40; x < W + 40;) {
    const w = (4 + rnd() * 10) * ppmF, top = HZ - (2 + rnd() * 12) * ppmF;
    f.fillStyle = '#131722';
    for (const dx of [-W, 0, W]) f.fillRect(x + dx + w * .3, Math.max(0, top + 40), w * .8, H - top);
    x += w + rnd() * 20;
  }
  for (let x = -40; x < W + 40;) {
    const w = (4 + rnd() * 10) * ppmF, top = HZ - (1 + rnd() * 9) * ppmF;
    f.fillStyle = '#080a10';
    for (const dx of [-W, 0, W]) f.fillRect(x + dx, top, w, H - top);
    windows(f, x, top, w, HZ + 20, 6, 2, 2, .10);
    x += w + (rnd() < .4 ? 6 + rnd() * 20 : 0);
  }
  // ---- 近景（透明地） ----
  const nearC = mk(); const n = nearC.getContext('2d')!;
  const ppmN = W / 40;
  n.clearRect(0, 0, W, H);
  // 手前のビル: 高さは地平線 −3〜+9 m（窓帯の高さから見ると屋上の上に空が残る）、幅 5〜12 m、間に 2〜7 m の隙間を 6 割で空ける。窓は 9% 点灯
  for (let x = -120; x < W + 120;) {
    const w = (5 + rnd() * 7) * ppmN, top = Math.max(0, HZ - (-3 + rnd() * 12) * ppmN);
    n.fillStyle = '#04060a';
    for (const dx of [-W, 0, W]) n.fillRect(x + dx, top, w, H - top);
    windows(n, x, top, w, H, 11, 4, 5, .09);
    x += w + (rnd() < .6 ? (2 + rnd() * 5) * ppmN : 0);
  }
  const far = new THREE.CanvasTexture(farC); far.name = 'generated/night/far';
  const near = new THREE.CanvasTexture(nearC); near.name = 'generated/night/near';
  for (const t of [far, near]) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4; }
  return { far, near };
}

/**
 * 窓の外の夜景（512 × 256 px = 8 m × 4 m。材質側で repeat.x = 0.5、u 方向に周期、v は ClampToEdge）。
 * 上: 暗い青灰の空（地平線に街明かりの滲み）、下: 黒い建物のシルエット 2 層と疎らな窓明かり（暖色 7 : 寒色 3、約 60 個）、
 * 地平線付近に遠い街灯の橙の滲み。左右の端をまたぐ建物・窓は両側に描いてシームレス。
 * windowNight は emissiveColor 白 × emission .9 でこのテクスチャをそのまま薄く光らせる（diffuse は暗色）。
 * 見た目専用の固定シード（世界の乱数とは無関係）。document が無い環境（Node）では 1 px の暗色
 */
function createNightTexture(): THREE.Texture {
  if (typeof document === 'undefined') return solidTexture([12, 16, 26]);
  const W = 512, H = 256;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  let seed = 0x9e3779b9;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  // 空: 上が暗い青灰、地平線へ向かって少し明るく暖かく（街の光害）
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0a0e17'); sky.addColorStop(.5, '#151b29'); sky.addColorStop(.78, '#262a36'); sky.addColorStop(1, '#3a332f');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  // 遠い街灯の滲み（地平線付近、橙。端をまたがない位置に置く）
  for (let i = 0; i < 7; i++) {
    const r = 16 + rnd() * 34, x = r + rnd() * (W - 2 * r), y = H * (.68 + rnd() * .12);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,176,96,0.38)'); g.addColorStop(.5, 'rgba(255,160,80,0.12)'); g.addColorStop(1, 'rgba(255,160,80,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  // 建物（手前の列）。u 方向に周期: 端をまたぐものは x ± W にも描く
  const buildings: { x: number; w: number; top: number }[] = [];
  for (let x = -24; x < W + 24;) {
    const w = 26 + rnd() * 62, top = H * (.3 + rnd() * .42);
    buildings.push({ x, w, top });
    x += w + (rnd() < .35 ? 3 + rnd() * 9 : 0);
  }
  // 奥の列（少し明るく低い）: 手前の隙間から見える
  ctx.fillStyle = '#12161f';
  for (const b of buildings) {
    const top = Math.min(H * .78, b.top + 26 + rnd() * 44), x = b.x + b.w * .35, w = b.w * .9;
    for (const dx of [-W, 0, W]) ctx.fillRect(x + dx, top, w, H - top);
  }
  for (const b of buildings) {
    ctx.fillStyle = '#05070b';
    for (const dx of [-W, 0, W]) ctx.fillRect(b.x + dx, b.top, b.w, H - b.top);
    // 窓: 4 × 5 px の小さな矩形。約 17% が点灯（暖色 7 : 寒色 3、明るさはばらつく。8 m 分で 70〜80 個）
    const cols = Math.max(1, Math.floor((b.w - 4) / 9)), rows = Math.max(1, Math.floor((H - b.top - 6) / 10));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rnd() > .17) continue;
        const wx = b.x + 3 + c * 9, wy = b.top + 4 + r * 10, a = (.45 + rnd() * .55).toFixed(2);
        ctx.fillStyle = rnd() < .7
          ? `rgba(255,${196 + Math.floor(rnd() * 40)},${120 + Math.floor(rnd() * 60)},${a})`
          : `rgba(${150 + Math.floor(rnd() * 40)},${200 + Math.floor(rnd() * 30)},255,${a})`;
        for (const dx of [-W, 0, W]) ctx.fillRect(wx + dx, wy, 4, 5);
      }
    }
  }
  // 地面（最下段は真っ暗に近い）
  const ground = ctx.createLinearGradient(0, H - 14, 0, H);
  ground.addColorStop(0, 'rgba(4,5,8,0)'); ground.addColorStop(1, 'rgba(4,5,8,1)');
  ctx.fillStyle = ground; ctx.fillRect(0, H - 14, W, 14);
  const t = new THREE.CanvasTexture(canvas);
  t.name = 'generated/night/albedo';
  return t;
}

/** 1 px の単色 DataTexture（document が無い環境の代替） */
function solidTexture(rgb: [number, number, number]): THREE.Texture {
  const t = new THREE.DataTexture(new Uint8Array([rgb[0], rgb[1], rgb[2], 255]), 1, 1, THREE.RGBAFormat);
  t.needsUpdate = true;
  return t;
}

/** 量子化キー。上書きが無ければ null（共有材質を使う） */
function variantKey(id: MatId, o: MaterialOverrides): string | null {
  const parts: string[] = [];
  if (o.roughnessScale !== undefined && Math.abs(o.roughnessScale - 1) > .01) parts.push(`r${q(o.roughnessScale, .1).toFixed(1)}`);
  if (o.colorScale !== undefined && Math.abs(o.colorScale - 1) > .01) parts.push(`c${q(o.colorScale, .05).toFixed(2)}`);
  if (o.colorMask && o.colorMask.some((v) => Math.abs(v - 1) > .01)) parts.push(`m${o.colorMask.map((v) => q(v, .05).toFixed(2)).join(',')}`);
  if (o.envMapIntensity !== undefined && Math.abs(o.envMapIntensity - 1) > .01) parts.push(`e${q(o.envMapIntensity, .25).toFixed(2)}`);
  if (o.style) parts.push(`s${o.style}`);
  if (o.gradient) parts.push(`g${o.gradient.from}>${o.gradient.to}@${o.gradient.axis.map((v) => q(v, .05).toFixed(2)).join(',')}:${o.gradient.range.map((v) => q(v, .5).toFixed(1)).join(',')}`);
  if (o.fog) parts.push(`f${o.fog.color.toString(16)}:${q(o.fog.near, .5).toFixed(1)}:${q(o.fog.far, 1).toFixed(0)}`);
  if (!parts.length) return null;
  return `${id}|${parts.join('|')}`;
}
