/**
 * 図鑑に並べる項目: 仕掛け・異変の定義（name）・レア部屋・隠しの行き先。案の番号は案の台帳（core/gen/catalog）から引く。
 * 仕掛け・異変は登録の順（担当が足した物も自動で並ぶ）。
 */
import '../../core/gen/gimmicks/index.ts';
import { anomalyDefs } from '../../core/gen/anomaly/index.ts';
import { CATALOG, type CatalogImplKind } from '../../core/gen/catalog/index.ts';
import { gimmickDefs } from '../../core/gen/gimmicks/types.ts';
import { RARE_DEFS, SECRET_DESTS } from '../../core/gen/secrets/index.ts';
import type { CodexEntryDef } from '../ui/CodexPanel.ts';
import { DEST_JA } from './MapController.ts';

/** 実装の id → 案の番号（台帳に載っている物） */
export function ideasOf(kind: CatalogImplKind, id: string): string[] {
  return CATALOG.filter((e) => e.impl.some((m) => m.kind === kind && m.id === id)).map((e) => e.idea);
}

export function codexDefs(): CodexEntryDef[] {
  return [
    ...gimmickDefs().map((d): CodexEntryDef => ({ kind: 'gimmick', id: d.id, name: d.name, ideas: ideasOf('gimmick', d.id) })),
    ...anomalyDefs().map((d): CodexEntryDef => ({ kind: 'anomaly', id: d.id, name: d.name, ideas: ideasOf('anomaly', d.id) })),
    ...RARE_DEFS.map((d): CodexEntryDef => ({ kind: 'rare', id: d.id, name: d.name })),
    ...SECRET_DESTS.map((d): CodexEntryDef => ({ kind: 'dest', id: d, name: DEST_JA[d] ?? d })),
  ];
}
