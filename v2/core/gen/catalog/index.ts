/**
 * 案の台帳をまとめる（types.ts）。担当ごとの台帳は catalog/<担当>.ts。
 */
import type { CatalogEntry, CatalogOwner } from './types.ts';
import { MOVE_CATALOG } from './move.ts';
import { GROUND_CATALOG } from './ground.ts';
import { SENSE_CATALOG } from './sense.ts';
import { ODDITY_CATALOG } from './oddity.ts';
import { CARRY_CATALOG } from './carry.ts';
import { WARP_CATALOG } from './warp.ts';
import { STRUCTURE_CATALOG } from './structure.ts';
import { ROOMS_CATALOG } from './rooms.ts';
import { MAP_CATALOG } from './map.ts';

export * from './types.ts';

/** 担当ごとの台帳 */
export const CATALOG_BY_WS: Record<string, CatalogEntry[]> = {
  move: MOVE_CATALOG,
  ground: GROUND_CATALOG,
  sense: SENSE_CATALOG,
  oddity: ODDITY_CATALOG,
  carry: CARRY_CATALOG,
  warp: WARP_CATALOG,
  structure: STRUCTURE_CATALOG,
  rooms: ROOMS_CATALOG,
  map: MAP_CATALOG,
};

export const CATALOG: CatalogEntry[] = Object.values(CATALOG_BY_WS).flat();

/** 担当と受け持つ案（docs/stage4-workstreams.md の表と同じ。2.16 体力・2.17 マルチプレイは後回しなので入れない） */
export const OWNERS: CatalogOwner[] = [
  { ws: 'move', ideas: ['M01', 'M02', 'M03', 'M04', 'M05', 'M06', 'M07', 'M08', 'M09', 'M10', 'M11', 'M12', 'M13', 'M14', 'M15', 'M16', 'M17', 'M18', 'M19', 'M20', 'M21', 'M22', 'M23', 'M24', 'M25', 'M26', 'M27', 'M28', 'M29', 'M30', 'M31', 'M32', 'M33', 'M34', 'M35', 'M36', 'M37', 'M38', 'M39', 'M40', 'M41', 'M42', 'M43', 'M44', 'M45', 'W01', 'W02', 'BM01', 'BM02', 'BM03', 'BM04', 'BM05', 'BM06', 'BM07', 'BM08', 'BM09', 'BM10', 'BM12', 'BM13', 'BM14', 'BM15'] },
  { ws: 'ground', ideas: ['G01', 'G02', 'G03', 'G04', 'G05', 'G06', 'G07', 'G08', 'G09', 'G10', 'G11', 'G12', 'G13', 'G14', 'G15', 'G16', 'G17', 'G18', 'G19', 'G20', 'D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10', 'D11', 'D12', 'BG01', 'BG02', 'BG03', 'BG04', 'BG05', 'BG06', 'BX06', 'BX07'] },
  { ws: 'sense', ideas: ['L01', 'L02', 'L03', 'L04', 'L05', 'L06', 'L07', 'L08', 'L09', 'L10', 'L11', 'L12', 'L13', 'L14', 'L15', 'L16', 'L17', 'L18', 'A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'A10', 'A11', 'A12', 'O01', 'O02', 'O03', 'O04', 'O06', 'O07', 'O08', 'O09', 'O10', 'O11', 'O12', 'T01', 'T03', 'T05', 'T06', 'T07', 'T10', 'BL01', 'BL02', 'BL03', 'BL04', 'BL05', 'BL06', 'BA01', 'BA02', 'BA03', 'BA04', 'BO01', 'BO02', 'BO03', 'BO04', 'BO05', 'BO06', 'BO07', 'BM11'] },
  { ws: 'oddity', ideas: ['E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'E08', 'E09', 'E10', 'E11', 'E12', 'X02', 'X03', 'X04', 'X05', 'X06', 'X07', 'X08', 'X09', 'X10', 'X11', 'X12', 'X13', 'W04', 'W09', 'W10', 'W15', 'W16', 'W17', 'W18', 'T02', 'T08', 'T09', 'BX05'] },
  { ws: 'carry', ideas: ['I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'I09', 'I10', 'I11', 'BI01', 'BI02', 'BI03', 'BI04', 'BI05', 'BI06', 'PZ01', 'PZ02', 'PZ03', 'PZ04', 'PZ05', 'PZ06', 'PZ07', 'PZ08', 'PZ09', 'PZ10', 'PZ11', 'PZ12', 'U01', 'U02', 'U03', 'U04', 'U05', 'U06', 'U07', 'U08', 'U09', 'U10', 'U11', 'U12'] },
  { ws: 'warp', ideas: ['W03', 'W05', 'W06', 'W07', 'W08', 'W11', 'W12', 'W13', 'W14', 'O05', 'T04', 'X01', 'F27', 'F30', 'BX01', 'BX02', 'BX03', 'BX08'] },
  { ws: 'structure', ideas: ['F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F07', 'F08', 'F09', 'F10', 'F11', 'F12', 'F13', 'F14', 'F15', 'F16', 'F17', 'F18', 'F19', 'F20', 'F21', 'F22', 'F23', 'F24', 'F25', 'F26', 'F28', 'F29', 'F31', 'F32', 'F33', 'F34', 'F35'] },
  { ws: 'rooms', ideas: ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09', 'S10', 'S11', 'S12', 'S13', 'S14', 'S15', 'S16', 'S17', 'S18', 'S19', 'S20', 'S21', 'S22', 'S23', 'S24', 'S25', 'S26', 'S27', 'S28', 'S29', 'S30'] },
  { ws: 'map', ideas: ['N01', 'N02', 'N03', 'N04', 'N05', 'N06', 'N07', 'N08', 'N09', 'BX04'] },
];
