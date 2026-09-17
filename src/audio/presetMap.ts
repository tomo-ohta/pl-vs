/**
 * rooms.json の audioPreset（日本語ラベル）→ 手続き合成レイヤー配列への静的キーワード写像。
 * Web Audio / DOM に依存しない純粋ロジック（Node で検証できる）。rooms.json には新フィールドを追加しない。
 *
 * 規則:
 *   - 「・」「、」で複数音源に分割。「A→B」は A で開始し 30 秒で B へクロスフェード（followUp）。
 *   - 修飾: 「遠い」= gain -8 dB + lowpass 1.2 kHz + reverbSend 0.7 / 「静かな」「微かな」= -10 dB /
 *     「低い」= 中心周波数 1 オクターブ下 / 「幻聴」= ループではなく低確率の低音量ワンショット（ランダム定位） /
 *     「局所的な」= 部屋内 1 点に定位。
 *   - 「無音に近い」「ほぼ無音」= subRumble -30 dB のみ + 足音の reverbSend を上げる（silent）。
 *   - 「巨大反響 / 広い反響 / 館内反響」= RT60 の下限を持ち上げる（reverbFloorSec）。
 *   - Modifier が音を決めるメタ指定（年代別 / 遠い過去音 / 環境音レベル / 接続先混在 / 逆再生 / 前階の天候 / 複数混合）は
 *     meta を立てて既定レイヤー（hvac 静）を返す。Modifier 側フックが差し替える。
 *   - 写像できない断片は hvac にフォールバックし console.warn を 1 回だけ出す（unmapped に記録）。
 */

/** Synth.ts が実装するレイヤー id。ここに無い id は生成できない */
export const LAYER_IDS = [
  // 空調・機械
  'hvac', 'ventFan', 'fanArray', 'pcFan', 'compressor', 'refrigerator', 'vendingMachine', 'dryer', 'conveyor', 'cart',
  'machinery', 'machineryLow', 'driveHum', 'elevatorHum', 'outdoorUnit', 'projector',
  // 電気・ハム・低周波
  'fluorescentHum', 'fluorescentHumDetuned', 'electricHum', 'subRumble', 'resonanceLow', 'cableHum', 'pipeKnock',
  'monitorWhine', 'crtWhine', 'radioHiss', 'phoneLineNoise',
  // 水・天候・屋外
  'waterDrip', 'waterFlow', 'waterPressure', 'waves', 'fountain', 'rain', 'wind', 'windStrong', 'breeze', 'grassRustle',
  'distantTraffic', 'distantTrain', 'trainApproach', 'distantCity', 'outdoorAmbience', 'iceCrack',
  // 電子音・時計
  'clockTick', 'electronicBeep', 'displayBeep', 'numberCall', 'delayEcho', 'retroSfx', 'phoneRing',
  // 楽音・声・生物
  'chime', 'muzak', 'piano', 'paAnnounce', 'crowdMurmur', 'laughter', 'children', 'dogBark', 'birds', 'insects',
  // 物音
  'footstepsEcho', 'wetFootsteps', 'metalClank', 'dishes', 'coffeeMachine', 'pageTurn', 'paperRustle', 'knock',
  'doorCreak', 'wallScrape', 'shutter', 'cameraShutter', 'reverbTail',
] as const;
export type LayerId = (typeof LAYER_IDS)[number];
const LAYER_SET: ReadonlySet<string> = new Set(LAYER_IDS);

export function isLayerId(s: string): s is LayerId {
  return LAYER_SET.has(s);
}

export interface LayerSpec {
  id: LayerId;
  /** 相対ゲイン（線形。1 = レイヤー既定の音量） */
  gain: number;
  /** 「遠い」修飾のローパス（Hz） */
  lowpassHz?: number;
  /** リバーブ send（0〜1）。未指定はレイヤー既定 */
  reverbSend?: number;
  /** 「低い」修飾: 中心周波数のオクターブシフト */
  pitchOct?: number;
  /** 「幻聴」: ループせず平均 meanIntervalSec ごとに probability で 1 発（ランダム定位） */
  phantom?: { meanIntervalSec: number; probability: number };
  /** 「局所的な」: 部屋内の 1 点に定位して鳴らす */
  localized?: boolean;
}

export type PresetMeta = 'era' | 'past' | 'level' | 'farlink' | 'reverse' | 'carryover' | 'mix';

export interface PresetMix {
  label: string;
  layers: LayerSpec[];
  /** 「A→B」: afterSec 秒後にこのレイヤー集合へクロスフェード */
  followUp?: { afterSec: number; layers: LayerSpec[] };
  /** RT60 の下限（秒）。「巨大反響」など */
  reverbFloorSec?: number;
  /** 「無音に近い」: 足音の reverb send を上げる */
  silent?: boolean;
  /** Modifier が音を決めるメタ指定 */
  meta?: PresetMeta;
  /** 写像できなかった断片（hvac フォールバック） */
  unmapped: string[];
}

/** ラベル全体の完全一致で扱う特別指定 */
const META_LABELS: Record<string, { meta: PresetMeta; layers: LayerSpec[] }> = {
  '年代別環境音': { meta: 'era', layers: [{ id: 'hvac', gain: 0.5 }] },
  '遠い過去音': { meta: 'past', layers: [{ id: 'hvac', gain: 0.32 }] },
  '環境音レベル': { meta: 'level', layers: [{ id: 'hvac', gain: 0.32 }] },
  '接続先環境音混在': { meta: 'farlink', layers: [{ id: 'hvac', gain: 0.5 }] },
  '逆再生環境音': { meta: 'reverse', layers: [{ id: 'hvac', gain: 0.5 }] },
  '前階の天候音': { meta: 'carryover', layers: [{ id: 'wind', gain: 0.4 }, { id: 'rain', gain: 0.3 }] },
  '複数環境音の混合': { meta: 'mix', layers: [{ id: 'hvac', gain: 0.5 }] },
};

const SILENT_LABELS = new Set(['無音に近い', 'ほぼ無音']);

/** 断片の核（修飾語を除いたもの）→ レイヤー。長いキーワードから順に部分一致させる */
const KEYWORDS: [string, LayerId[], Partial<LayerSpec>?][] = [
  ['カメラシャッター', ['cameraShutter']],
  ['シャッター音', ['shutter']],
  ['コンプレッサー', ['compressor']],
  ['コンベア', ['conveyor']],
  ['コーヒーマシン', ['coffeeMachine']],
  ['食器', ['dishes']],
  ['ファン群', ['fanArray']],
  ['PCファン残響', ['pcFan'], { reverbSend: 0.8 }],
  ['PCファン', ['pcFan']],
  ['ファン', ['ventFan']],
  ['モニター', ['monitorWhine']],
  ['空調ハム', ['hvac', 'electricHum']],
  ['空調風', ['hvac', 'breeze']],
  ['空調', ['hvac']],
  ['乾燥機', ['dryer']],
  ['BGM', ['muzak']],
  ['照明ハムの位相ずれ', ['fluorescentHumDetuned']],
  ['蛍光灯', ['fluorescentHum']],
  ['ハム', ['electricHum']],
  ['共鳴', ['resonanceLow']],
  ['電気音', ['electricHum']],
  ['低周波', ['subRumble']],
  ['水圧', ['waterPressure']],
  ['水景', ['fountain']],
  ['水音', ['waterFlow']],
  ['水滴', ['waterDrip']],
  ['滴水', ['waterDrip']],
  ['波音', ['waves']],
  ['雨音', ['rain']],
  ['冷蔵庫', ['refrigerator']],
  ['冷蔵機', ['refrigerator']],
  ['冷蔵設備', ['refrigerator', 'compressor']],
  ['自販機', ['vendingMachine']],
  ['台車', ['cart']],
  ['列車接近', ['trainApproach']],
  ['列車', ['distantTrain']],
  ['受話器の無音', ['phoneLineNoise'], { gain: 0.5 }],
  ['回線ノイズ', ['phoneLineNoise']],
  ['古いSE', ['retroSfx']],
  ['扉の軋み', ['doorCreak']],
  ['換気設備', ['ventFan', 'hvac']],
  ['換気扇', ['ventFan']],
  ['換気', ['ventFan']],
  ['擦過音', ['wallScrape']],
  ['室外機', ['outdoorUnit']],
  ['犬声', ['dogBark']],
  ['強風', ['windStrong']],
  ['微風', ['breeze']],
  ['風で揺れる麦', ['grassRustle', 'breeze']],
  ['葉擦れ', ['grassRustle']],
  ['屋外環境音', ['outdoorAmbience']],
  ['風音', ['wind']],
  ['風', ['wind']],
  ['駆動音', ['driveHum']],
  ['鳥声', ['birds']],
  ['道路音', ['distantTraffic']],
  ['車道音', ['distantTraffic']],
  ['車', ['distantTraffic']],
  ['秒針', ['clockTick']],
  ['時計', ['clockTick']],
  ['館内放送', ['paAnnounce']],
  ['放送', ['paAnnounce']],
  ['アナウンス', ['paAnnounce']],
  ['昇降機', ['elevatorHum']],
  ['映写機', ['projector']],
  ['遅延音', ['delayEcho']],
  ['機械低音', ['machineryLow']],
  ['機械音', ['machinery']],
  ['虫', ['insects']],
  ['チャイム', ['chime']],
  ['番号呼出音', ['numberCall']],
  ['ノック', ['knock']],
  ['ピアノ', ['piano']],
  ['金属音', ['metalClank']],
  ['電子表示音', ['displayBeep']],
  ['電子音', ['electronicBeep']],
  ['紙擦れ', ['paperRustle']],
  ['ページ音', ['pageTurn']],
  ['笑い声', ['laughter']],
  ['街音', ['distantCity']],
  ['都市音', ['distantCity']],
  ['遊具音', ['children']],
  ['配線', ['cableHum']],
  ['配管音', ['pipeKnock']],
  ['氷音', ['iceCrack']],
  ['湿った足音', ['wetFootsteps']],
  ['足音反響', ['footstepsEcho']],
  ['足音', ['footstepsEcho']],
  ['巨大反響', ['reverbTail']],
  ['広い反響', ['reverbTail']],
  ['館内反響', ['reverbTail']],
  ['反響', ['reverbTail']],
];
// 長いキーワードから順に試す（「換気扇」を「換気」より先に、など）
KEYWORDS.sort((a, b) => b[0].length - a[0].length);

/** 反響ラベルごとの RT60 下限（秒） */
const REVERB_FLOORS: [string, number][] = [
  ['巨大反響', 4.0],
  ['広い反響', 2.5],
  ['館内反響', 2.5],
];

const DB = (db: number): number => Math.pow(10, db / 20);

interface Modifiers {
  gainMul: number;
  lowpassHz?: number;
  reverbSend?: number;
  pitchOct?: number;
  phantom?: LayerSpec['phantom'];
  localized?: boolean;
}

/** 断片から修飾語を剥がし、核と修飾を返す */
function parseFragment(frag: string): { core: string; mods: Modifiers } {
  let core = frag.trim();
  const mods: Modifiers = { gainMul: 1 };
  // 前置修飾（複数可: 「遠い」「静かな」など）
  let progress = true;
  while (progress) {
    progress = false;
    if (core.startsWith('遠い')) {
      core = core.slice(2); mods.gainMul *= DB(-8); mods.lowpassHz = 1200; mods.reverbSend = 0.7; progress = true;
    } else if (core.startsWith('静かな')) {
      core = core.slice(3); mods.gainMul *= DB(-10); progress = true;
    } else if (core.startsWith('微かな')) {
      core = core.slice(3); mods.gainMul *= DB(-10); progress = true;
    } else if (core.startsWith('局所的な')) {
      core = core.slice(4); mods.localized = true; progress = true;
    } else if (core.startsWith('低い')) {
      core = core.slice(2); mods.pitchOct = -1; progress = true;
    }
  }
  if (core.endsWith('幻聴')) {
    core = core.slice(0, -2);
    mods.phantom = { meanIntervalSec: 20, probability: 0.5 };
    mods.gainMul *= 0.5;
  }
  return { core, mods };
}

function applyMods(id: LayerId, base: Partial<LayerSpec> | undefined, mods: Modifiers): LayerSpec {
  const spec: LayerSpec = { id, gain: (base?.gain ?? 1) * mods.gainMul };
  if (base?.reverbSend !== undefined) spec.reverbSend = base.reverbSend;
  if (mods.lowpassHz !== undefined) spec.lowpassHz = mods.lowpassHz;
  if (mods.reverbSend !== undefined) spec.reverbSend = Math.max(spec.reverbSend ?? 0, mods.reverbSend);
  if (mods.pitchOct !== undefined) spec.pitchOct = mods.pitchOct;
  if (mods.phantom) spec.phantom = mods.phantom;
  if (mods.localized) spec.localized = true;
  return spec;
}

/** 同じレイヤーは 1 本に畳む（ゲインは最大値） */
function dedupe(list: LayerSpec[]): LayerSpec[] {
  const out: LayerSpec[] = [];
  for (const s of list) {
    const ex = out.find((o) => o.id === s.id);
    if (!ex) out.push(s);
    else if (s.gain > ex.gain) Object.assign(ex, s);
  }
  return out;
}

const warned = new Set<string>();

function mapFragments(label: string, unmapped: string[]): { layers: LayerSpec[]; reverbFloorSec?: number } {
  const layers: LayerSpec[] = [];
  let reverbFloorSec: number | undefined;
  for (const raw of label.split(/[・、]/)) {
    if (!raw.trim()) continue;
    const { core, mods } = parseFragment(raw);
    for (const [kw, floor] of REVERB_FLOORS) if (raw.includes(kw)) reverbFloorSec = Math.max(reverbFloorSec ?? 0, floor);
    const hit = KEYWORDS.find(([kw]) => core.includes(kw));
    if (!hit) {
      unmapped.push(raw);
      layers.push(applyMods('hvac', { gain: 0.5 }, mods));
      continue;
    }
    for (const id of hit[1]) layers.push(applyMods(id, hit[2], mods));
  }
  return { layers: dedupe(layers), reverbFloorSec };
}

/** audioPreset ラベル → レイヤー配列。未知ラベルは hvac フォールバック + console.warn 1 回 */
export function mapPreset(label: string): PresetMix {
  const trimmed = (label ?? '').trim();
  const meta = META_LABELS[trimmed];
  if (meta) return { label: trimmed, layers: meta.layers.map((l) => ({ ...l })), meta: meta.meta, unmapped: [] };
  if (SILENT_LABELS.has(trimmed)) return { label: trimmed, layers: [{ id: 'subRumble', gain: DB(-30) }], silent: true, unmapped: [] };
  if (!trimmed) return { label: trimmed, layers: [{ id: 'hvac', gain: 0.32 }], unmapped: [] };

  const unmapped: string[] = [];
  const stages = trimmed.split('→');
  const first = mapFragments(stages[0], unmapped);
  const mix: PresetMix = { label: trimmed, layers: first.layers, unmapped };
  if (first.reverbFloorSec !== undefined) mix.reverbFloorSec = first.reverbFloorSec;
  if (stages.length > 1) {
    const next = mapFragments(stages[stages.length - 1], unmapped);
    mix.followUp = { afterSec: 30, layers: next.layers };
    if (next.reverbFloorSec !== undefined) mix.reverbFloorSec = Math.max(mix.reverbFloorSec ?? 0, next.reverbFloorSec);
  }
  if (unmapped.length && !warned.has(trimmed)) {
    warned.add(trimmed);
    if (typeof console !== 'undefined') console.warn(`[audio] audioPreset を写像できない断片 (${trimmed}): ${unmapped.join(' / ')} → hvac`);
  }
  return mix;
}

/** テスト用: 警告の記録をリセット */
export function resetPresetWarnings(): void {
  warned.clear();
}
