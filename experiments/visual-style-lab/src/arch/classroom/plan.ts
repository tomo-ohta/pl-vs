import type { FloorPlan, PlanOpening, PlanSpace, PlanTourStop, PlanWall } from '../plan.ts';
import { BALC, DOORS, ESC, FL, MAT_Z1, ROOM_D, ROOMS, SMALL_W, STAIR, T_EXT, WC, XN, Z_EAST } from './layout.ts';

/**
 * 海の見える教室（建築版）の間取り図。数は layout.ts（形と同じ数）から作る。
 * 座標: x = 南（海・窓）→ 北（廊下）。z = 西（岬の先）→ 東。図では上が西（-Z）。
 */

const E = 1.6;
const lvSpaces = (lv: 2 | 3): PlanSpace[] => {
  const fl = FL[lv - 1];
  return ROOMS.filter((r) => r.level === lv).map((r): PlanSpace => {
    const poly = r.rect2
      ? ([
          [r.rect[0], r.rect[1]],
          [r.rect[2], r.rect[1]],
          [r.rect[2], r.rect2[1]],
          [r.rect2[2], r.rect2[1]],
          [r.rect2[2], r.rect2[3]],
          [r.rect2[0], r.rect2[3]],
        ] as [number, number][])
      : undefined;
    // 廊下は教室との壁の厚さまで含める（扉の敷居の所の点もどこかの場所に入る）
    const rect: [number, number, number, number] = r.kind === 'corridor' ? [ROOM_D, r.rect[1], XN + T_EXT, r.rect[3]] : r.rect;
    return {
      id: r.id,
      label: r.label,
      kind: r.kind === 'corridor' ? 'corridor' : 'room',
      ...(poly ? { poly } : { rect }),
      floor: fl,
      ceiling: fl + 3.0,
      level: lv,
      closed: r.closed,
      note: r.note,
    };
  });
};

const spaces: PlanSpace[] = [
  ...lvSpaces(2),
  ...lvSpaces(3),
  { id: 'ST1', label: '階段室（1 階の踊り場・鍵の扉）', kind: 'stair', rect: [STAIR[0], STAIR[1], STAIR[2], STAIR[3]], floor: FL[0], ceiling: FL[1], level: 1, note: '1 階の廊下への扉は鍵（下の行き止まり）' },
  { id: 'ST2', label: '階段室（2 階〜3 階）', kind: 'stair', rect: [STAIR[0], STAIR[1], STAIR[2], STAIR[3]], floor: FL[1], ceiling: FL[2], level: 2, note: '折り返しの階段。北の踊り場に窓' },
  { id: 'ST3', label: '階段室（3 階〜屋上の口）', kind: 'stair', rect: [STAIR[0], STAIR[1], STAIR[2], STAIR[3]], floor: FL[2], ceiling: FL[3] + 2.6, level: 3, note: '屋上の扉は鍵（上の行き止まり）' },
  { id: 'WC2', label: '2 階 便所（鍵）', kind: 'service', rect: [WC[0], WC[1], WC[2], WC[3]], floor: FL[1], ceiling: FL[1] + 3, level: 2, closed: true },
  { id: 'WC3', label: '3 階 便所（鍵）', kind: 'service', rect: [WC[0], WC[1], WC[2], WC[3]], floor: FL[2], ceiling: FL[2] + 3, level: 3, closed: true },
  { id: 'B2', label: '2 階 西のバルコニー', kind: 'outdoor', rect: [BALC[0], BALC[1], BALC[2], 0], floor: FL[1], ceiling: FL[2], level: 2, note: '小さな教室の西の扉・廊下の西の扉から出る。避難階段の下り口は鍵の門' },
  { id: 'B3', label: '3 階 西のバルコニー', kind: 'outdoor', rect: [BALC[0], BALC[1], BALC[2], 0], floor: FL[2], ceiling: FL[3], level: 3, note: '岬の先と離れ岩が見える（高い所）' },
  { id: 'ESC', label: '外の避難階段（北西の角）', kind: 'stair', rect: [ESC[0], ESC[1], ESC[2], BALC[1]], floor: FL[1], ceiling: FL[2] + 1.8, level: 2, note: '鉄の折り返し階段。2 階 ↔ 3 階。1 階（地面）へは 2 階の門が鍵' },
  { id: 'YARD', label: '崖の上の地面と北の校庭（入れない）', kind: 'void', rect: [-5, -6.5, 45.5, 59.5], floor: 0, closed: true, note: '草と土・崖の縁の柵・体育館・松・電柱。窓とバルコニーから見えるだけ' },
  { id: 'SEA', label: '海（岬の先・離れ岩）', kind: 'void', rect: [-40, -40, -5, 60], floor: -10.5, note: '離れ岩は方位 28〜56°・450〜950 m（図の外）。白い岩は 70 m' },
];

const walls: PlanWall[] = [
  // 外壁
  { a: [-T_EXT, -T_EXT], b: [XN + T_EXT, -T_EXT] },
  { a: [-T_EXT, Z_EAST + T_EXT], b: [XN + T_EXT, Z_EAST + T_EXT] },
  { a: [-T_EXT, -T_EXT], b: [-T_EXT, Z_EAST + T_EXT], kind: 'glass' },
  { a: [XN + T_EXT, -T_EXT], b: [XN + T_EXT, Z_EAST + T_EXT] },
  // 教室と廊下の間
  { a: [ROOM_D, 0], b: [ROOM_D, Z_EAST], kind: 'partition' },
  // 小さな教室と教材室（2 階）
  { a: [SMALL_W, 0], b: [SMALL_W, MAT_Z1], kind: 'partition', level: 2 },
  { a: [SMALL_W, MAT_Z1], b: [ROOM_D, MAT_Z1], kind: 'partition', level: 2 },
  // 階段室・便所
  { a: [STAIR[0], STAIR[1]], b: [STAIR[2], STAIR[1]] },
  { a: [STAIR[2], STAIR[1]], b: [STAIR[2], WC[3]] },
  { a: [STAIR[0], WC[3]], b: [STAIR[2], WC[3]] },
  { a: [STAIR[0], STAIR[3]], b: [STAIR[2], STAIR[3]] },
  // バルコニーの手すり
  { a: [BALC[0], BALC[1]], b: [BALC[2], BALC[1]], kind: 'railing' },
  { a: [ESC[0], ESC[1]], b: [ESC[2], ESC[1]], kind: 'railing' },
  { a: [ESC[0], ESC[1]], b: [ESC[0], BALC[1]], kind: 'railing' },
  { a: [ESC[2], ESC[1]], b: [ESC[2], BALC[3]], kind: 'railing' },
];
for (const r of ROOMS) {
  if (r.kind === 'corridor' || r.kind === 'small' || r.kind === 'material') continue;
  if (r.rect[1] > 0.1) walls.push({ a: [0, r.rect[1]], b: [ROOM_D, r.rect[1]], kind: 'partition', level: r.level });
}

const openings: PlanOpening[] = [];
for (const lv of [2, 3] as const) {
  for (const d of DOORS[lv]) {
    const at: [number, number] = d.wall === 'cw' ? [ROOM_D + 0.06, d.at] : d.wall === 'mat' ? [SMALL_W + 0.06, d.at] : d.wall === 'w' ? [d.at, -T_EXT / 2] : [d.at, Z_EAST + T_EXT / 2];
    openings.push({ kind: d.kind === 'double' ? 'fire-door' : 'door', at, width: d.width, wall: d.wall === 'cw' || d.wall === 'mat' ? 'z' : 'x', state: d.locked ? 'locked' : 'open', level: lv });
  }
  openings.push({ kind: 'opening', at: [XN + T_EXT / 2, (STAIR[1] + STAIR[3]) / 2], width: 3.2, wall: 'z', state: 'open', level: lv, note: '階段室の口' });
  openings.push({ kind: 'door', at: [XN + T_EXT / 2, WC[1] + 1.2], width: 0.85, wall: 'z', state: 'locked', level: lv, note: '便所' });
}
openings.push({ kind: 'door', at: [XN + T_EXT / 2, (STAIR[1] + STAIR[3]) / 2], width: 1.0, wall: 'z', state: 'locked', level: 1, note: '1 階の廊下へ（鍵）' });
openings.push({ kind: 'gate', at: [ESC[2] - 0.65, BALC[1]], width: 1.05, wall: 'x', state: 'locked', level: 2, note: '避難階段の下り口（地面へ）' });
openings.push({ kind: 'door', at: [1.7, -T_EXT / 2], width: 0.85, wall: 'x', state: 'open', level: 2, note: '小さな教室の西の扉（右の 1 枚）' });
openings.push({ kind: 'stair', at: [ESC[0] + 0.65, BALC[1]], width: 1.05, wall: 'x', state: 'open', level: 2, note: '避難階段の上り口（3 階へ）' });

const at = (x: number, lv: number, z: number): [number, number, number] => [x, FL[lv - 1] + E, z];

const tour: PlanTourStop[] = [
  { label: '小さな教室の奥（西の扉の前）から振り返る（東）', eye: at(1.6, 2, 1.2), yaw: Math.PI + 0.25, pitch: -0.05 },
  { label: '小さな教室の窓ぎわ（泡の窓台と海）', eye: at(0.8, 2, 11.5), yaw: 0.75, pitch: -0.12 },
  { label: '教材室（棚と地球儀）', eye: at(4.7, 2, 5.0), yaw: -0.9, pitch: -0.12 },
  { label: '2 階の廊下の西の端から東を見る', eye: at(8.7, 2, 0.8), yaw: Math.PI, pitch: 0 },
  { label: '2 階の教室 2-B の後ろから黒板', eye: at(5.0, 2, 20.4), yaw: 0.15, pitch: -0.08 },
  { label: '2 階の廊下・階段室の口', eye: at(8.7, 2, 21.5), yaw: -0.9, pitch: 0.02 },
  { label: '階段の中の踊り場（2 階と 3 階の間）から上を見る', eye: [15.2, FL[1] + 1.8 + E, 18.0], yaw: -Math.PI / 2 + 0.6, pitch: 0.35 },
  { label: '階段室の 1 階の踊り場（鍵の扉・下の行き止まり）', eye: at(12.6, 1, 15.9), yaw: Math.PI / 2 + 0.75, pitch: -0.05 },
  { label: '屋上の口（鍵・上の行き止まり）', eye: [11.6, FL[3] + E, 19.6], yaw: Math.PI / 2 - 0.6, pitch: -0.25 },
  { label: '3 階の廊下の東の端（防火戸・行き止まり）', eye: at(8.7, 3, 29.5), yaw: Math.PI, pitch: 0 },
  { label: '3 階の廊下から西を見る', eye: at(8.7, 3, 26.0), yaw: 0, pitch: 0 },
  { label: '3 階の教室 3-A の前（教壇の横）から振り返る', eye: at(2.2, 3, 1.6), yaw: Math.PI - 0.35, pitch: -0.1 },
  { label: '3 階の教室 3-B の前の窓ぎわ', eye: at(0.9, 3, 15.2), yaw: 2.5, pitch: -0.05 },
  { label: '3 階のバルコニー（高い所）から岬の先', eye: at(1.2, 3, -0.85), yaw: 0.9, pitch: -0.05 },
  { label: '外の避難階段の踊り場から岬の先と離れ岩', eye: [ESC[0] + 1.6, FL[1] + 1.8 + E, -5.0], yaw: 0.75, pitch: -0.1 },
  { label: '2 階のバルコニー・避難階段の鍵の門（行き止まり）', eye: at(ESC[2] - 0.6, 2, -0.75), yaw: 0.35, pitch: -0.35 },
];

export const classroomPlan: FloorPlan = {
  id: 'classroom',
  title: '岬の分校の校舎（2・3 階の西の端）',
  typology:
    '離島の岬の先、崖の上に建つ小さな小中学校（分校）の 3 階建ての校舎。RC の壁式構造・片廊下型（南に教室・北に廊下）。' +
    '南の窓の壁は 2.3 m ごとの壁柱の間に窓（2 階は木の框の 2 枚・3 階はアルミの 3 枚と型板ガラスの欄間）。教室 7.2 × 9〜13.5 m、廊下 2.7 m、' +
    '階段室と便所は廊下の北へ出た塔。西の端（岬の先）に 2・3 階のバルコニーと南西の角の外の避難階段（二方向避難）。' +
    '寸法の根拠: 教室の奥行き 7.2 m（旧来の 4 間）・天井 3.0 m（学校の教室の天井高 3 m 以上）・階高 3.6 m・廊下幅 2.7 m（両側でない片廊下 1.8 m 以上）・' +
    '階段の蹴上げ 16 cm・踏面 28 cm（小学校の階段の基準 16 cm 以下・26 cm 以上）',
  spaces,
  walls,
  openings,
  tour,
  notes: [
    '参考画像の 2 枚は窓の割り付け・天井・机の並びが違う（2 枚目は細いアルミの框と型板ガラスの欄間・吊り下げの蛍光灯・机 6 列、1 枚目は太い木の框・天井付けの蛍光灯・机 2 列）。同じ部屋にせず、上下の階の西の端の部屋にした',
    'classroom-0 の部屋は窓の壁から右の壁まで約 4.1 m しかない（消失点と奥の壁の大きさから）。2 階の西の端を「小さな教室（複式学級）」と、その北の教材室に分けた',
    'classroom-0 の右奥の掲示・細い扉・緑の板は、窓の壁の消失点とは合わない正面向きに描かれている。北西の隅の作り付けの物入れ（正面 z = 2.0）の面に置いた',
    'classroom-0 の窓ぎわの机は天板が正面向きに描かれている。机を海の方へ 33° 回した（波に押されたように海を向く）。同じ決まりを 2 階の教室 2-B の窓ぎわの列にも使った',
    'classroom-0 の奥の壁の両開きの扉は、外の避難階段へ出る扉。左の 1 枚は書庫でふさがる。奥の壁は消失点に対して正面向きに描かれている（矛盾）。窓の壁を優先した',
    '2 階と 3 階で壁柱の位置が 1.1 m ずれる（それぞれの参考画像の窓に合わせた）。外から壁柱の並びを近くで見られる所は無い',
    '日は南（方位 80°）・高さ 40°。2 枚とも床の日なたの筋が窓の壁に直角に伸びる。3 階の欄間は型板ガラスで日を通さない（2 枚目の 2 列目の机の天板が陰）',
    '室内の霧は「水の中の霞」。窓（南西）の方が明るい（霧の光源方向のにじみ）。窓の外の物には目から建物の外の面までの分だけ掛ける',
    '1 階は外壁と階段室だけ（中は鍵）。地面へは出られない（避難階段の 2 階の下り口が鍵の門）',
    '階段室の窓: 中の踊り場の北の壁に大きな窓（3 枚）、床の踊り場の西の壁に窓（2 枚）、屋上の階は北の高窓と西の窓。屋上の扉は網入りガラスの窓つき',
    '教室と廊下の間の壁は 1.82 m の区画（欄間と同じ割り付け）。扉の無い区画を廊下側の窓（腰窓）と掲示板の壁に交互に（教材室は掲示板だけ・鍵の教室は型板ガラス）。参考画像の 2 つの視点の画面にこの壁は入らない（ViewCam で確かめた）',
  ],
};
