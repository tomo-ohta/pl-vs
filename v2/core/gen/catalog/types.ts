/**
 * 案の台帳（v2-plan.md 7.2）: gimmicks-and-structures.md の案の番号ごとに、何で実装したか・状態を記録する。
 * 担当ごとに catalog/<担当>.ts を持ち、index.ts でまとめる（tests/catalog.test.ts が、担当の案が全部載っているか・
 * 実装の id が登録されているかを確かめる）。
 *
 * 案の番号:
 * - 2.1〜2.15 の表の番号（F01・S07・M20・G03・W05・L13・A05・O07・T03・I05・D04・E04・X02・N04・U01 …）。
 *   「M01〜M08」「S01〜S06」のようにまとめて書かれた行は、1 つずつに分けて載せる（M01 … M08）
 * - 4.7 裏の振る舞い（v2-plan.md）: 分類ごとに、並びの順で番号を振る
 *   BM 移動と身体 / BL 光と闇 / BA 音 / BO 視線と観測 / BI 物を運ぶ・置く / BG 床と足場 / BX 空間と認知（例: BM01）
 * - 4.7 パズル: PZ01〜PZ12（並びの順）
 */

/** 実装の種類。gimmick / anomaly / part / view は登録の id（type）で確かめる */
export type CatalogImplKind = 'gimmick' | 'anomaly' | 'part' | 'view' | 'structure' | 'room' | 'secret' | 'client' | 'dress';

/**
 * done: この段階で作った / existing: 段階 3 までにあった物で足りる / merged: 別の案と同じ仕組み（impl に同じ物を書き、note に元の案）/
 * deferred: 後回し（note に理由。体力・マルチプレイが要る物だけ）
 */
export type CatalogStatus = 'done' | 'existing' | 'merged' | 'deferred';

export interface CatalogEntry {
  idea: string;
  name: string;
  status: CatalogStatus;
  impl: { kind: CatalogImplKind; id: string }[];
  /** 遊び方・裏の振る舞い・作りの要点（短く） */
  note?: string;
}

/** 担当と、担当が受け持つ案の番号（tests/catalog.test.ts が確かめる。docs/stage4-workstreams.md と同じ） */
export interface CatalogOwner {
  ws: string;
  /** 案の番号の一覧（範囲は展開して書く） */
  ideas: string[];
}
