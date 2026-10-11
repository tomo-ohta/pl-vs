import type { FloorPlan, PlanOpening, PlanSpace, PlanTourStop, PlanWall } from '../plan.ts';
import { BAY_Y, CATWALK_Y, DOORS, LANDING_Y, ROOMS, SPACES, WALLS, type SpaceKind } from './layout.ts';

/**
 * サーバールームの間取り図。数は layout.ts（形と同じ数）から作る。
 */

const KIND: Record<SpaceKind, PlanSpace['kind']> = {
  server: 'room',
  corridor: 'corridor',
  ups: 'service',
  battery: 'service',
  gas: 'service',
  lift: 'lift',
  elec: 'service',
  staging: 'room',
  dock: 'hall',
  noc: 'room',
  stair: 'stair',
  ahu: 'service',
};

const spaces: PlanSpace[] = SPACES.map((s) => ({ id: s.id, label: s.label, kind: KIND[s.kind], rect: s.rect, floor: 0, ceiling: s.ceil, closed: s.closed, note: s.note }));
spaces.push(
  { id: 'BAY', label: 'トラックの着く床', kind: 'platform', rect: [-21.4, -1.8, -16.0, 8.6], floor: BAY_Y, ceiling: 4.6, note: '荷台の高さの床より 1.1 m 低い。北の端に階段' },
  { id: 'CAT', label: '中 2 階の点検通路', kind: 'platform', rect: [-10.6, 7.4, 7.1, 8.55], floor: CATWALK_Y, level: 1, note: '冷水の配管の弁と空調機の上の点検。東の端に階段' },
  { id: 'LAND', label: '階段の踊り場', kind: 'stair', rect: [16.05, 2.26, 19.3, 3.96], floor: LANDING_Y, level: 1, note: '上の階への折り返し' },
  { id: 'TOP', label: '上の階の扉の前', kind: 'stair', rect: [16.05, 7.6, 19.3, 8.6], floor: LANDING_Y * 2, level: 1, note: '4 階への扉は鍵' },
);

const openings: PlanOpening[] = DOORS.map((d) => ({
  kind: d.kind === 'opening' ? 'opening' : d.kind === 'double' ? 'double-door' : d.kind === 'shutter' ? 'gate' : 'door',
  at: d.wall === 'x' ? [(d.a + d.b) / 2, d.line] : [d.line, (d.a + d.b) / 2],
  width: d.b - d.a,
  wall: d.wall,
  state: d.state === 'locked' ? 'locked' : d.state === 'open' ? 'open' : 'closed',
  level: d.y0 > 1 ? 1 : undefined,
  note: `${d.label}${d.state === 'auto' ? '（近づくと開く）' : ''}`,
}));

const walls: PlanWall[] = WALLS.map((w) => ({ a: w.a, b: w.b, kind: w.outer ? 'wall' : 'partition' }));

const E = 1.55;
const tour: PlanTourStop[] = [
  { label: 'B の北の端から振り返って通路（南）', eye: [0, E, -11.25], yaw: Math.PI, pitch: -0.04 },
  { label: 'B の西のホットアイル（ラックの背と PDU）', eye: [-2.9, E, -4.0], yaw: 0.0, pitch: -0.04 },
  { label: 'A の南の端から北の扉（視点の後ろ）', eye: [-7.4, E, 2.6], yaw: 0.0, pitch: -0.03 },
  { label: 'A の西のホットアイルの行き止まり', eye: [-10.3, E, -10.8], yaw: Math.PI, pitch: -0.05 },
  { label: 'C の床の点検口（床下をのぞく）', eye: [7.4, E, -0.6], yaw: Math.PI, pitch: -0.75 },
  { label: 'C の視点から振り返る（南の扉と空調機の壁）', eye: [7.4, E, -3.0], yaw: Math.PI, pitch: -0.02 },
  { label: '廊下の西の端から東', eye: [-20.3, E, -13.4], yaw: -Math.PI / 2, pitch: -0.02 },
  { label: '廊下の東の端から振り返って西', eye: [18.4, E, -13.4], yaw: Math.PI / 2, pitch: -0.02 },
  { label: 'ボンベ室（行き止まり）', eye: [-13.4, E, -15.6], yaw: 0.45, pitch: -0.1 },
  { label: 'UPS 室の盤の列の間', eye: [-11.6, E, -18.5], yaw: -Math.PI / 2, pitch: -0.05 },
  { label: '蓄電池室の架台の間', eye: [-0.5, E, -17.75], yaw: -Math.PI / 2, pitch: -0.12 },
  { label: '電気室の盤の列の間', eye: [18.4, E, -18.5], yaw: Math.PI / 2, pitch: -0.05 },
  { label: '開梱室（棚・作業台・箱）', eye: [-12.0, E, -8.0], yaw: 1.9, pitch: -0.1 },
  { label: '荷捌き場の荷台の高さの床から低い床とシャッター', eye: [-12.6, E, -0.6], yaw: 2.5, pitch: -0.12 },
  { label: '低い床（トラックの着く所）からトラックの横と荷台の縁', eye: [-20.4, BAY_Y + E, 7.9], yaw: -0.45, pitch: 0.03 },
  { label: '空調機械室: 空調機の列', eye: [-9.6, E, 6.4], yaw: -Math.PI / 2 + 0.15, pitch: -0.02 },
  { label: '中 2 階の点検通路（高い所）から西', eye: [-2.0, CATWALK_Y + E, 7.95], yaw: Math.PI / 2, pitch: -0.25 },
  { label: '階段の踊り場から下のホール', eye: [17.4, LANDING_Y + E, 3.0], yaw: 1.9, pitch: -0.35 },
  { label: '上の階の扉の前（鍵）', eye: [16.8, LANDING_Y * 2 + E, 8.1], yaw: -Math.PI / 2, pitch: -0.05 },
  { label: '監視室: 壁の画面と机の列', eye: [12.2, E, -11.2], yaw: -2.2, pitch: -0.08 },
];

const A = ROOMS.A;
const B = ROOMS.B;
const C = ROOMS.C;

export const plan: FloorPlan = {
  id: 'serverroom',
  title: 'サーバールーム（通信ビルのデータセンターの 1 フロア）',
  typology:
    '通信ビルの 3 階のデータセンターのフロア（41 × 30 m）。南北に長いサーバー室 3 つ（各 7.2 × 16 m・二重床 0.6 m・ラック 2 列のコールドアイル型）を北の共用廊下で結び、' +
    '廊下の北に電源の部屋（UPS・蓄電池・電気室）と消火ガスのボンベ室・荷物用エレベーター、西の棟に開梱室と荷捌き場、東の棟に監視室（NOC）と階段、' +
    '南にサーバー室の床下へ冷気を送る空調機械室（空調機の列・冷水の配管・中 2 階の点検通路）。' +
    '根拠: データセンターの標準的な部屋の並び（搬入 → 開梱 → サーバー室、電源の系統 UPS → PDU、空調機は二重床の床下へ送る）、ラックは幅 0.6・奥行き 1.1 m・42〜48U、' +
    'コールドアイル 1.8〜2.4 m・ホットアイル 1.2〜1.5 m、床の板 0.6 m 角・吹き出しの穴あきの板はコールドアイルの列の前。',
  spaces,
  walls,
  openings,
  tour,
  notes: [
    `【参考画像の視点】serverroom-0 = B（目 (${B.cx}, 1.23, -3.04)・縦 50°）、serverroom-1 = C（目 (${C.cx}, 1.16, -2.64)・縦 50°）、serverroom-2 = A（目 (${A.cx}, 1.29, -2.74)・縦 39.4°）。3 枚とも通路から北の突き当たりの扉を見る`,
    '【画像同士の矛盾】3 枚は天井の照明（通路の上の四角い器具 / 横に渡る線の器具 / 小さな器具）・ラックの高さ（2.1 / 2.2 / 2.5 m）・色合い（青 / 青緑 / 灰青緑）・天井のケーブル（箱 / 垂れたカーテン / 幅の広いはしご形）が違う。同じ部屋の別の視点にすると矛盾するので、同じ造りの別の部屋（A・B・C）にして、それぞれの画像を優先した。部屋ごとの照明と色合いの違いは、部屋ごとの見た目（区域の色調整）で',
    '【奥に何も見えない】3 枚とも突き当たりは閉じた扉と淡い壁。扉は閉じて作り、近づくと廊下の側へ開く（撮影では閉じたまま）。扉の上と左右の壁は廊下の壁の裏',
    '【視点の外】視点の後ろは同じ列が南の壁まで続き、南の壁の西の端に空調機械室への扉。列の背（ホットアイル）と側の壁の間は 1.4〜1.6 m',
    '【現実離れ】部屋ごとに照明の色合いが違う（青・青緑・灰青緑）。参考画像の色を優先した。床は廊下と同じ高さ（スラブを下げて二重床にした想定）',
    '【高い所・低い所】荷捌き場のトラックの着く床（-1.1 m）・C の床の点検口（床下 0.6 m をのぞく）・空調機械室の中 2 階（+2.4 m）・階段の踊り場（+2.25 m）と上の階の扉の前（+4.5 m）',
  ],
};
