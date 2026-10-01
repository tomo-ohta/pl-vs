/**
 * ZoneThemeShuffle の材質・家具プリセット表。既存 MatId と generators/common.ts の家具パターンだけで構成する（アセット追加なし）。
 * presetPool: 'campus'（L05 屋内学園都市: 校舎・体育館・プール・通路…）/ 'any'（L20 永久万博会場: 全プリセット）。
 */
import type { Rng } from '../../core/rng';
import { inner, type Rect } from '../../generators/footprint';
import { patternColumns, patternIslands, patternPartitions, patternPerimeter, patternRows, type FurnishCtx } from '../../generators/common';
import { box, type MatId, type RoomLayout } from '../../generators/layout';

export interface ThemeSpec {
  id: string;
  /** サイン・検証用の表示名 */
  label: string;
  floor: MatId;
  wall: MatId;
  ceiling: MatId;
  light: MatId;
  lightColor: number;
  lightIntensity: number;
  /** 消灯率 */
  dim: number;
  /** ゾーン内に浅水（'water' ゾーン + 水面箔）を張る */
  water?: boolean;
  /** presetMap のキーワードで組んだ環境音ラベル（ゾーンの params.audio に保持。再生は将来の audioZones 経路） */
  audio: string;
  /** 家具（c.rects はゾーンの矩形 1 つ） */
  furnish(c: FurnishCtx, zone: Rect): void;
}

/** ゾーン内側の矩形（壁厚 + 余白） */
function zoneInner(zone: Rect, margin = 0.6): Rect {
  return inner(zone, margin);
}

function benches(c: FurnishCtx, zone: Rect): void {
  patternPerimeter(c, 0.45, 0.45, 'furnitureDark', 0.5);
  void zone;
}

/** 体育館のコートライン（床の薄い帯。非ソリッド） */
function courtLines(L: RoomLayout, zone: Rect): void {
  const ir = zoneInner(zone, 1.4);
  if (ir.x1 - ir.x0 < 4 || ir.z1 - ir.z0 < 4) return;
  const t = 0.06;
  const y0 = 0.0005;
  const y1 = 0.01;
  L.boxes.push(box([ir.x0, y0, ir.z0], [ir.x1, y1, ir.z0 + t], 'yellowLine', false));
  L.boxes.push(box([ir.x0, y0, ir.z1 - t], [ir.x1, y1, ir.z1], 'yellowLine', false));
  L.boxes.push(box([ir.x0, y0, ir.z0], [ir.x0 + t, y1, ir.z1], 'yellowLine', false));
  L.boxes.push(box([ir.x1 - t, y0, ir.z0], [ir.x1, y1, ir.z1], 'yellowLine', false));
  const cz = (ir.z0 + ir.z1) / 2;
  L.boxes.push(box([ir.x0, y0, cz - t / 2], [ir.x1, y1, cz + t / 2], 'yellowLine', false));
}

/** 浅いプール: 水面箔（非ソリッド）と縁石。'water' ゾーンは呼び出し側が張る */
export function poolBasin(L: RoomLayout, zone: Rect): Rect | null {
  const ir = zoneInner(zone, 1.2);
  if (ir.x1 - ir.x0 < 3 || ir.z1 - ir.z0 < 3) return null;
  L.boxes.push(box([ir.x0, 0.0, ir.z0], [ir.x1, 0.25, ir.z1], 'waterShallow', false));
  const k = 0.3;
  L.boxes.push(box([ir.x0 - k, 0, ir.z0 - k], [ir.x1 + k, 0.12, ir.z0], 'floorTile'));
  L.boxes.push(box([ir.x0 - k, 0, ir.z1], [ir.x1 + k, 0.12, ir.z1 + k], 'floorTile'));
  L.boxes.push(box([ir.x0 - k, 0, ir.z0], [ir.x0, 0.12, ir.z1], 'floorTile'));
  L.boxes.push(box([ir.x1, 0, ir.z0], [ir.x1 + k, 0.12, ir.z1], 'floorTile'));
  return ir;
}

export const THEMES: Record<string, ThemeSpec> = {
  classroom: {
    id: 'classroom', label: '教室', floor: 'floorWood', wall: 'wallCream', ceiling: 'ceilingWhite', light: 'lightPanel', lightColor: 0xe9f0ff, lightIntensity: 1.0, dim: 0.05,
    audio: '蛍光灯・遠いチャイム',
    furnish(c, zone) {
      patternRows(c, { spacing: 1.7, depth: 0.5, height: 0.72, mat: 'furnitureLight', gapEvery: 4.5, margin: 1.4 });
      const r = zoneInner(zone, 0.2);
      c.L.boxes.push(box([r.x0 + 0.8, 0.9, r.z1 - 0.05], [r.x1 - 0.8, 2.1, r.z1 - 0.02], 'wallGreen', false));
    },
  },
  gym: {
    id: 'gym', label: '体育館', floor: 'floorWood', wall: 'wallWhite', ceiling: 'ceilingWhite', light: 'lightPanel', lightColor: 0xf3f0e0, lightIntensity: 1.1, dim: 0.02,
    audio: '広い反響・足音反響',
    furnish(c, zone) {
      courtLines(c.L, zone);
      benches(c, zone);
    },
  },
  pool: {
    id: 'pool', label: 'プール', floor: 'floorTile', wall: 'floorTile', ceiling: 'ceilingWhite', light: 'lightPanel', lightColor: 0x9fc8ff, lightIntensity: 0.9, dim: 0.08,
    water: true,
    audio: '水音・広い反響',
    furnish() { /* 水盤は呼び出し側（poolBasin） */ },
  },
  hallway: {
    id: 'hallway', label: '通路', floor: 'floorLino', wall: 'wallCream', ceiling: 'ceilingWhite', light: 'lightPanel', lightColor: 0xe9f0ff, lightIntensity: 0.9, dim: 0.1,
    audio: '空調・足音',
    furnish(c) {
      patternPerimeter(c, 0.45, 1.8, 'furnitureDark', 0.4);
    },
  },
  gallery: {
    id: 'gallery', label: '展示室', floor: 'floorWood', wall: 'wallWhite', ceiling: 'ceilingWhite', light: 'lightPanel', lightColor: 0xfff4e0, lightIntensity: 1.0, dim: 0.0,
    audio: '静かな空調・遠い館内放送',
    furnish(c) {
      patternPartitions(c, 1, 2.4, 'wallWhite');
      patternIslands(c, 1 / 50, ['furnitureLight']);
    },
  },
  playarea: {
    id: 'playarea', label: '遊戯室', floor: 'floorCarpetRed', wall: 'wallCream', ceiling: 'ceilingWhite', light: 'lightWarm', lightColor: 0xffd9a0, lightIntensity: 1.0, dim: 0.05,
    audio: '遊具音・遠い笑い声',
    furnish(c) {
      patternIslands(c, 1 / 22, ['furnitureLight', 'yellowLine', 'furnitureDark']);
    },
  },
  restroom: {
    id: 'restroom', label: '洗面所', floor: 'floorTile', wall: 'floorTile', ceiling: 'ceilingWhite', light: 'lightPanel', lightColor: 0xe9f0ff, lightIntensity: 0.85, dim: 0.15,
    audio: '水滴・換気扇',
    furnish(c) {
      patternPerimeter(c, 1.3, 2.0, 'furnitureLight', 0.5);
    },
  },
  library: {
    id: 'library', label: '図書室', floor: 'floorCarpetGrey', wall: 'wallCream', ceiling: 'ceilingTile', light: 'lightWarm', lightColor: 0xffe2b0, lightIntensity: 0.9, dim: 0.05,
    audio: '静かな空調・ページ音',
    furnish(c) {
      patternRows(c, { spacing: 2.6, depth: 0.6, height: 1.9, mat: 'shelfMetal', gapEvery: 5, margin: 1.4 });
    },
  },
  office: {
    id: 'office', label: '事務室', floor: 'floorCarpetGrey', wall: 'wallWhite', ceiling: 'ceilingTile', light: 'lightPanel', lightColor: 0xe9f0ff, lightIntensity: 1.0, dim: 0.06,
    audio: '空調ハム・PCファン',
    furnish(c) {
      patternRows(c, { spacing: 3.2, depth: 1.4, height: 0.75, mat: 'furnitureLight', gapEvery: 5, top: 'furnitureDark', margin: 1.4 });
    },
  },
  retail: {
    id: 'retail', label: '売店', floor: 'floorTile', wall: 'wallWhite', ceiling: 'ceilingTile', light: 'lightPanel', lightColor: 0xf2f6ff, lightIntensity: 1.1, dim: 0.02,
    audio: 'BGM・冷蔵庫',
    furnish(c) {
      patternRows(c, { spacing: 2.4, depth: 0.9, height: 1.5, mat: 'shelfMetal', gapEvery: 5, margin: 1.4 });
    },
  },
  theater: {
    id: 'theater', label: '小劇場', floor: 'floorCarpetRed', wall: 'wallDark', ceiling: 'ceilingDark', light: 'lightWarm', lightColor: 0xffc27a, lightIntensity: 0.5, dim: 0.3,
    audio: '映写機・静かな空調',
    furnish(c) {
      patternRows(c, { spacing: 1.4, depth: 0.5, height: 0.9, mat: 'furnitureDark', gapEvery: 6, margin: 1.4 });
    },
  },
  parking: {
    id: 'parking', label: '駐車区画', floor: 'floorConcrete', wall: 'wallConcrete', ceiling: 'ceilingDark', light: 'lightPanel', lightColor: 0xdfe8ff, lightIntensity: 0.7, dim: 0.25,
    audio: '低周波・遠い車',
    furnish(c, zone) {
      patternColumns(c, 6);
      const ir = zoneInner(zone, 1.2);
      for (let x = ir.x0 + 0.5; x + 0.12 < ir.x1; x += 2.6) c.L.boxes.push(box([x, 0.0005, ir.z0 + 0.5], [x + 0.12, 0.01, ir.z1 - 0.5], 'yellowLine', false));
    },
  },
  warehouse: {
    id: 'warehouse', label: '倉庫', floor: 'floorConcrete', wall: 'wallConcrete', ceiling: 'ceilingDark', light: 'lightPanel', lightColor: 0xdfe8ff, lightIntensity: 0.8, dim: 0.15,
    audio: '換気設備・遠い台車',
    furnish(c) {
      patternRows(c, { spacing: 3.0, depth: 1.0, height: 2.2, mat: 'shelfMetal', gapEvery: 6, margin: 1.4 });
      patternIslands(c, 1 / 45, ['boxCardboard']);
    },
  },
  lounge: {
    id: 'lounge', label: '休憩室', floor: 'floorCarpetRed', wall: 'wallBeige', ceiling: 'ceilingWhite', light: 'lightWarm', lightColor: 0xffd9a0, lightIntensity: 0.8, dim: 0.1,
    audio: '遠いBGM・自販機',
    furnish(c) {
      patternIslands(c, 1 / 26, ['upholstery', 'furnitureDark']);
    },
  },
  garden: {
    id: 'garden', label: '温室', floor: 'grass', wall: 'wallWhite', ceiling: 'ceilingWhite', light: 'lightGreen', lightColor: 0xd8f0c8, lightIntensity: 1.0, dim: 0.0,
    audio: '虫・微風',
    furnish(c) {
      patternIslands(c, 1 / 18, ['plant']);
    },
  },
  server: {
    id: 'server', label: '機械室', floor: 'floorLino', wall: 'wallWhite', ceiling: 'ceilingTile', light: 'ledBlue', lightColor: 0x9fc8ff, lightIntensity: 0.7, dim: 0.1,
    audio: 'ファン群・電子音',
    furnish(c) {
      patternRows(c, { spacing: 2.6, depth: 0.8, height: 1.9, mat: 'furnitureDark', gapEvery: 5, margin: 1.4, top: 'ledBlue' });
    },
  },
  hospital: {
    id: 'hospital', label: '医務室', floor: 'floorLino', wall: 'wallWhite', ceiling: 'ceilingTile', light: 'lightPanel', lightColor: 0xf2f6ff, lightIntensity: 1.0, dim: 0.05,
    audio: '電子表示音・静かな空調',
    furnish(c) {
      patternPerimeter(c, 0.9, 0.6, 'furnitureLight', 0.5);
    },
  },
};

export const POOLS: Record<string, string[]> = {
  campus: ['classroom', 'gym', 'pool', 'hallway', 'gallery', 'playarea', 'restroom', 'library'],
  any: Object.keys(THEMES),
};

/** presetPool 名 → テーマ id 列（未知の名前・カンマ区切りの直接指定にも対応） */
export function poolOf(name: string): string[] {
  const direct = POOLS[name];
  if (direct) return direct;
  const ids = name.split(/[,、・\s]+/).filter((s) => THEMES[s]);
  return ids.length ? ids : POOLS.any;
}

/** ゾーン数ぶんのテーマを重複を避けて割り当てる（プールが足りなければ繰り返す） */
export function assignThemes(rng: Rng, pool: string[], count: number): ThemeSpec[] {
  const out: ThemeSpec[] = [];
  let bag: string[] = [];
  for (let i = 0; i < count; i++) {
    if (bag.length === 0) bag = rng.shuffle([...pool]);
    out.push(THEMES[bag.pop()!]);
  }
  return out;
}
