/**
 * 調整表: 生成と仕掛けの数値をすべてここに置く（コードに数値を直書きしない。v2-plan.md 6.5）。
 *
 * - 値を恒久的に変える: 下の TUNING_SPEC の default を書き換える
 * - 一時的に上書きする: URL `?tune=secrets.perFloorMean=2,secrets.visibilityCheck=false`（parseTuneParam）
 * - 項目を足す: TUNING_SPEC に 1 行足すだけ（型・既定値・範囲・説明）。使う側は tuning['キー'] で読む
 *
 * tuningVersion() は値の組から作る短い識別子。フロアの生成結果の保存に含め、値を変えても
 * 遊んでいる世界が勝手に作り変わらないようにする。
 */

interface NumberSpec { readonly kind: 'number'; readonly default: number; readonly min: number; readonly max: number; readonly integer?: boolean; readonly note: string }
interface BooleanSpec { readonly kind: 'boolean'; readonly default: boolean; readonly note: string }
type Spec = NumberSpec | BooleanSpec;

const num = (def: number, min: number, max: number, note: string, integer = false): NumberSpec =>
  ({ kind: 'number', default: def, min, max, note, ...(integer ? { integer } : {}) });
const bool = (def: boolean, note: string): BooleanSpec => ({ kind: 'boolean', default: def, note });

export const TUNING_SPEC = {
  // ---- 隠し発見（v2-plan.md 4 章）----
  'secrets.perFloorMean': num(1.2, 0, 10, '1 フロアあたりの隠しの平均（ポアソン分布で引く。0 個のフロアもある）'),
  'secrets.perFloorMax': num(4, 0, 16, '1 フロアの隠しの上限', true),
  'secrets.depthGain': num(0, 0, 1, '深さ 1 階あたり、平均に足す量'),
  'secrets.rarityBonusLegendary': num(1, 0, 5, 'Legendary 以上のフロアで平均に足す量'),
  'secrets.nestChance': num(0.15, 0, 1, '隠し先の中に、さらに隠しを仕込む確率'),
  'secrets.maxNestDepth': num(2, 0, 4, '入れ子の深さの上限', true),
  'secrets.visibilityCheck': bool(true, '隠し場所が本道から見えないかを確かめる（時間がかかるなら省いてよい。ユーザー了承済み）'),
  'secrets.visibilityBudgetMs': num(4, 0, 200, '1 フロアの視線検査に使える時間（ms）。超えたら残りの検査を省く'),
  'secrets.visibilitySamples': num(64, 1, 1024, '本道の上で視線を調べる点の数', true),

  // 隠し方の型の重み（v2-plan.md 4.1。両方を使える仕掛けで引く。相対値）
  'secrets.mode.present': num(70, 0, 100, '存在型: 扉や穴は最初からあり、見えにくいだけ'),
  'secrets.mode.appear': num(30, 0, 100, '出現型: 条件を満たして初めて道や扉が現れる'),

  // 隠し先の中身の重み（v2-plan.md 4.6。相対値）
  'secrets.dest.passage': num(30, 0, 100, '隠し通路'),
  'secrets.dest.room': num(30, 0, 100, '隠し部屋'),
  'secrets.dest.privateRoom': num(14, 0, 100, '特殊個室 [QR]'),
  'secrets.dest.rareRoom': num(6, 0, 100, '稀な部屋（v1 の Legendary / Mythic）'),
  'secrets.dest.floorLink': num(5, 0, 100, '別のフロアへの抜け道'),
  'secrets.dest.bFloor': num(2, 0, 100, '裏のフロア'),
  'secrets.dest.clue': num(13, 0, 100, '次の隠しの手がかり（入れ子）'),

  // ---- フロア（v2-plan.md 5 章）----
  'floor.sizeM': num(70, 30, 200, '1 フロアの一辺（m）'),
  'floor.baySpacingM': num(8, 4, 20, '区画の間隔（m）[QR]'),

  // ---- 物理（v2-plan.md 6.1）----
  'physics.tickHz': num(60, 30, 120, 'シミュレーションの固定 tick', true),
  'physics.maxBodiesDesktop': num(400, 0, 4000, '同時に動かす剛体の上限（PC）', true),
  'physics.maxBodiesMobile': num(120, 0, 2000, '同時に動かす剛体の上限（スマホ）', true),
} as const satisfies Record<string, Spec>;

export type TuningKey = keyof typeof TUNING_SPEC;
type ValueOf<S> = S extends NumberSpec ? number : S extends BooleanSpec ? boolean : never;
export type Tuning = { readonly [K in TuningKey]: ValueOf<(typeof TUNING_SPEC)[K]> };
export type TuningOverrides = { -readonly [K in TuningKey]?: Tuning[K] };

const KEYS = Object.keys(TUNING_SPEC) as TuningKey[];
const isKey = (k: string): k is TuningKey => Object.hasOwn(TUNING_SPEC, k);

export function defaultTuning(): Tuning {
  const t: Record<string, number | boolean> = {};
  for (const k of KEYS) t[k] = TUNING_SPEC[k].default;
  return t as Tuning;
}

/** 1 項目を検査して正規化する。範囲外は端に寄せず誤りにする（気づかないまま別の値で回らないように） */
function coerce(key: TuningKey, raw: unknown): { value?: number | boolean; error?: string } {
  const spec: Spec = TUNING_SPEC[key];
  if (spec.kind === 'boolean') {
    if (typeof raw === 'boolean') return { value: raw };
    if (raw === 'true' || raw === '1') return { value: true };
    if (raw === 'false' || raw === '0') return { value: false };
    return { error: `${key}: true / false を指定してください（${String(raw)}）` };
  }
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return { error: `${key}: 数値を指定してください（${String(raw)}）` };
  if (n < spec.min || n > spec.max) return { error: `${key}: ${spec.min}〜${spec.max} の範囲で指定してください（${n}）` };
  if (spec.integer && !Number.isInteger(n)) return { error: `${key}: 整数を指定してください（${n}）` };
  return { value: n };
}

/** 既定値に上書きを重ねる。誤った項目は無視して errors に返す */
export function makeTuning(overrides: Readonly<Record<string, unknown>> = {}): { tuning: Tuning; errors: string[] } {
  const t = defaultTuning() as Record<string, number | boolean>;
  const errors: string[] = [];
  for (const [k, raw] of Object.entries(overrides)) {
    if (!isKey(k)) { errors.push(`${k}: 調整表にない項目です`); continue; }
    const { value, error } = coerce(k, raw);
    if (error) errors.push(error); else if (value !== undefined) t[k] = value;
  }
  return { tuning: t as Tuning, errors };
}

/** URL の tune パラメータ（`a=1,b=false`）を上書きの組にする */
export function parseTuneParam(param: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (param ?? '').split(',')) {
    const i = part.indexOf('=');
    if (i <= 0) continue;
    out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

/** 既定値と違う項目だけを取り出す（JSON への書き出し用） */
export function diffFromDefault(t: Tuning): TuningOverrides {
  const out: Record<string, number | boolean> = {};
  for (const k of KEYS) if (t[k] !== TUNING_SPEC[k].default) out[k] = t[k];
  return out as TuningOverrides;
}

/** 値の組の識別子（FNV-1a 32bit。キー順を固定して計算するので、項目の並びを変えても同じ値なら同じ） */
export function tuningVersion(t: Tuning): string {
  let h = 0x811c9dc5;
  for (const k of [...KEYS].sort()) {
    const s = `${k}=${t[k]};`;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  }
  return h.toString(16).padStart(8, '0');
}
