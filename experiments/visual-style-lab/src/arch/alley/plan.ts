import type { FloorPlan, PlanOpening, PlanSpace, PlanTourStop, PlanWall, V2 } from '../plan.ts';
import { ANNEX, BACKDOOR, BIKES, CLUB, COURT, EAST, FAR, LANE, MAIN, NORTH, STREET, W_CORR, W_ROOM, WALKWAY, WEST, westX, wpos } from './layout.ts';

/**
 * 校舎の間の通路（建築版）の間取り図。数は layout.ts（形と同じ数）から作る。
 * 座標: x 東・z 南（図では上が北 -Z）。参考画像 alley-0 の目の位置の真下が原点。
 */

const D = WEST.depth;
const wq = (u0: number, u1: number, w0: number, w1: number): V2[] => [wpos(WEST, u0, w0), wpos(WEST, u1, w0), wpos(WEST, u1, w1), wpos(WEST, u0, w1)];
const wingSW = wpos(WEST, WEST.u0, -D);
const wingSE = wpos(WEST, WEST.u0, 0);
const wingNE = wpos(WEST, WEST.u1, 0);
const wingNW = wpos(WEST, WEST.u1, -D);
const zAtX = (x: number): number => -(x - WEST.origin[0]) / 0.198; // 西棟の通路側の壁の線の z

const spaces: PlanSpace[] = [
  {
    id: 'lane',
    label: '通路（管理用の車路と歩道）',
    kind: 'outdoor',
    poly: [[LANE.asphaltW, LANE.z0], [EAST.origin[0], LANE.z0], [EAST.origin[0], -35.0], [CLUB.x[0], -35.0], [CLUB.x[0], ANNEX.z[1]], [ANNEX.x[0], ANNEX.z[1]], wingNE, [LANE.asphaltW, zAtX(LANE.asphaltW)]],
    floor: 0,
    note: '車路（アスファルト・白線・排水の蓋）・東の歩道（敷石）・東棟の壁ぞいの花壇と分電盤・雨どい・配管・室外機。参考画像 alley-0 の場所',
  },
  { id: 'shoulder', label: '西の路肩と生け垣', kind: 'outdoor', poly: [[westX(-4), -4], [LANE.asphaltW, -4], [LANE.asphaltW, zAtX(LANE.asphaltW)]], floor: 0, note: '西棟の壁の足元の低い生け垣' },
  { id: 'bed', label: '手前の植え込み', kind: 'outdoor', poly: [[westX(1), 1], [LANE.asphaltW, 1], [LANE.asphaltW, -4], [westX(-4), -4]], floor: 0, note: '参考画像の左下の暗い植え込み' },
  { id: 'bikes', label: '駐輪場', kind: 'outdoor', poly: [[westX(LANE.z0), LANE.z0], [LANE.asphaltW, LANE.z0], [LANE.asphaltW, 1], [westX(1), 1]], floor: 0, note: `片流れの屋根（x ${BIKES.x[0]}〜${BIKES.x[1]}）・ラック・自転車 約 16 台` },
  { id: 'west', label: '西棟（特別教室棟・5 階）', kind: 'room', poly: [wingSE, wingNE, wingNW, wingSW], floor: 0, ceiling: WEST.parapet, closed: true, note: '1 階 4.5 m・2 階より上 4.2 m。通路側が廊下。北の端は道路斜線で斜めに低い' },
  { id: 'wcorr', label: '西棟 1 階の廊下', kind: 'corridor', poly: wq(W_CORR.u[0], W_CORR.u[1], W_CORR.wIn, W_CORR.wOut), floor: 0, ceiling: W_CORR.ceil, note: '裏口から入れる。3 段の大きな窓（通路側）・教室の引き戸と窓・掲示板・消火栓・下駄箱' },
  { id: 'wroom', label: '教室（1 階）', kind: 'room', poly: wq(W_ROOM.u[0], W_ROOM.u[1], W_ROOM.w[0], W_ROOM.w[1]), floor: 0, ceiling: W_ROOM.ceil, note: '8.2 × 8.0 m。机 36・黒板・ロッカー・カーテン（西の窓）' },
  { id: 'east', label: '東棟（普通教室棟・5 階）', kind: 'room', rect: [EAST.origin[0], -EAST.u1, EAST.origin[0] + EAST.depth, -EAST.u0], floor: EAST.fl[0], ceiling: EAST.parapet, closed: true, note: '1 階は半地下（-0.9 m）。2 階より上 3.4 m。通路側が廊下、東（校庭）側が教室' },
  {
    id: 'north',
    label: '裏庭（ごみ置き場・キュービクル・通用門）',
    kind: 'outdoor',
    poly: [wingNE, wingNW, [NORTH.x0, wingNW[1]], [NORTH.x0, NORTH.fenceZ], [NORTH.x1, NORTH.fenceZ], [NORTH.x1, ANNEX.z[0]], [ANNEX.x[0], ANNEX.z[0]], [ANNEX.x[0], ANNEX.z[1]]],
    floor: 0,
    note: '通路の突き当たりから倉庫の西へ抜ける（西棟の北の端との間 1.7 m）。裏庭の木（ケヤキ）・自転車・ドラム缶',
  },
  { id: 'annex', label: '倉庫（用務員の作業室）', kind: 'service', rect: [ANNEX.x[0], ANNEX.z[0], ANNEX.x[1], ANNEX.z[1]], floor: 0, ceiling: ANNEX.h, closed: true, note: '参考画像の突き当たりの低い建物。南の扉は鍵' },
  { id: 'club', label: '部室棟（2 階）', kind: 'service', rect: [CLUB.x[0], CLUB.z[0], CLUB.x[1], CLUB.z[1]], floor: 0, ceiling: CLUB.h, closed: true, note: '西の面が参考画像の右奥の明るい壁' },
  { id: 'street', label: '道路（敷地の外）', kind: 'void', rect: [-30, STREET.z[0], 30, STREET.z[1]], floor: 0, note: '電柱・電線・街灯。フェンスと門の外' },
  { id: 'far', label: '向かいの明るい建物（道路の向こう）', kind: 'void', rect: [FAR.left.x[0], FAR.z[0], FAR.x[1], FAR.z[1]], floor: 0, note: '参考画像の突き当たりの白く霞んだ高い建物' },
  {
    id: 'court',
    label: '中庭',
    kind: 'outdoor',
    poly: [wingSW, wingSE, [EAST.origin[0], LANE.z0], [COURT.x[1], LANE.z0], [COURT.x[1], COURT.z[1]], [COURT.x[0], COURT.z[1]], [COURT.x[0], wingSW[1]]],
    floor: 0,
    note: '木 3 本・花壇・ベンチ・水飲み場・時計の柱。本館の影で暗い',
  },
  { id: 'walk', label: '渡り廊下（屋根だけ）', kind: 'corridor', rect: [WALKWAY.x[0], LANE.z0 + 0.4, WALKWAY.x[1], WALKWAY.z[1]], floor: 0, ceiling: WALKWAY.h, note: '通路の口から本館の入口まで。西棟の昇降口へ枝' },
  { id: 'walk2', label: '渡り廊下の枝', kind: 'corridor', rect: [-15.5, 18.6, WALKWAY.x[0], 21.2], floor: 0, ceiling: WALKWAY.h },
  { id: 'stairE', label: '東棟の外階段（屋外避難階段）', kind: 'stair', rect: [EAST.origin[0] + 4.1, 18, EAST.origin[0] + 10.1, 20.5], floor: 0, ceiling: Math.round((EAST.fl[4] + 1.1) * 10) / 10, note: '各階の踊り場に非常口（鍵）。5 階まで' },
  { id: 'main', label: '本館（4 階）', kind: 'room', rect: [MAIN.x[0], MAIN.z[0], MAIN.x[1], MAIN.z[1]], floor: 0, ceiling: MAIN.parapet, closed: true, note: '北の面が廊下側。入口（ガラスの戸）は鍵' },
  { id: 'yard', label: '校庭（入れない）', kind: 'outdoor', rect: [COURT.x[1], -35, 40, COURT.z[1]], floor: 0, closed: true, note: 'フェンスの向こう。バックネット・遠くの木' },
  { id: 'wstrip', label: '西棟の裏の細い土地（入れない）', kind: 'outdoor', poly: [wingSW, wingNW, wpos(WEST, WEST.u1, -D - 4), wpos(WEST, WEST.u0, -D - 4)], floor: 0, closed: true, note: '砂利と低い木・ブロック塀・向こうの家。教室の窓から見える' },
];

const walls: PlanWall[] = [
  // 西棟
  { a: wingSE, b: wingNE },
  { a: wingNE, b: wingNW },
  { a: wingNW, b: wingSW },
  { a: wingSW, b: wingSE },
  // 東棟
  { a: [EAST.origin[0], -EAST.u0], b: [EAST.origin[0], -EAST.u1] },
  { a: [EAST.origin[0], -EAST.u1], b: [EAST.origin[0] + D, -EAST.u1] },
  { a: [EAST.origin[0] + D, -EAST.u1], b: [EAST.origin[0] + D, -EAST.u0] },
  { a: [EAST.origin[0] + D, -EAST.u0], b: [EAST.origin[0], -EAST.u0] },
  // 倉庫・部室棟
  { a: [ANNEX.x[0], ANNEX.z[1]], b: [ANNEX.x[1], ANNEX.z[1]] },
  { a: [ANNEX.x[0], ANNEX.z[0]], b: [ANNEX.x[0], ANNEX.z[1]] },
  { a: [ANNEX.x[0], ANNEX.z[0]], b: [ANNEX.x[1], ANNEX.z[0]] },
  { a: [CLUB.x[0], CLUB.z[0]], b: [CLUB.x[0], CLUB.z[1]] },
  { a: [CLUB.x[0], CLUB.z[0]], b: [CLUB.x[1], CLUB.z[0]] },
  // 本館
  { a: [MAIN.x[0], MAIN.z[0]], b: [MAIN.x[1], MAIN.z[0]] },
  // 1 階の廊下と教室の間仕切り
  { a: wpos(WEST, W_CORR.u[0], W_CORR.wOut), b: wpos(WEST, W_CORR.u[1], W_CORR.wOut), kind: 'partition' },
  { a: wpos(WEST, W_ROOM.u[0], W_CORR.wOut), b: wpos(WEST, W_ROOM.u[0], W_ROOM.w[1]), kind: 'partition' },
  { a: wpos(WEST, W_ROOM.u[1], W_CORR.wOut), b: wpos(WEST, W_ROOM.u[1], W_ROOM.w[1]), kind: 'partition' },
  { a: wpos(WEST, W_CORR.u[0], W_CORR.wIn), b: wpos(WEST, W_CORR.u[0], W_CORR.wOut), kind: 'partition' },
  { a: wpos(WEST, W_CORR.u[1], W_CORR.wIn), b: wpos(WEST, W_CORR.u[1], W_CORR.wOut), kind: 'partition' },
  // 敷地の境界
  { a: [NORTH.x0, NORTH.fenceZ], b: [NORTH.x1, NORTH.fenceZ], kind: 'fence' },
  { a: [NORTH.x0, wingNW[1]], b: [NORTH.x0, NORTH.fenceZ], kind: 'wall' },
  { a: [COURT.x[1], LANE.z0], b: [COURT.x[1], COURT.z[1]], kind: 'fence' },
  { a: [COURT.x[0], wingSW[1]], b: [COURT.x[0], COURT.z[1]], kind: 'wall' },
  { a: wpos(WEST, WEST.u0, -D - 4), b: wpos(WEST, WEST.u1, -D - 4), kind: 'wall' },
];

const op = (o: PlanOpening): PlanOpening => o;
const openings: PlanOpening[] = [
  op({ kind: 'door', at: wpos(WEST, (BACKDOOR.u[0] + BACKDOOR.u[1]) / 2, -0.15), width: 0.9, wall: 'z', state: 'open', note: '裏口（参考画像の左の暗い凹み）。近づくと内へ開く' }),
  op({ kind: 'door', at: wpos(WEST, W_ROOM.u[0] + 0.85, W_CORR.wOut - 0.07), width: 0.9, wall: 'z', state: 'open', note: '教室の後ろの引き戸。近づくと開く' }),
  op({ kind: 'door', at: wpos(WEST, W_ROOM.u[1] - 0.95, W_CORR.wOut - 0.07), width: 0.9, wall: 'z', state: 'open', note: '教室の前の引き戸。近づくと開く' }),
  op({ kind: 'door', at: wpos(WEST, 7.85, W_CORR.wOut), width: 0.9, wall: 'z', state: 'locked', note: '準備室' }),
  op({ kind: 'door', at: wpos(WEST, 19.45, W_CORR.wOut), width: 0.9, wall: 'z', state: 'locked', note: '隣の教室（後ろ）' }),
  op({ kind: 'door', at: wpos(WEST, 24.85, W_CORR.wOut), width: 0.9, wall: 'z', state: 'locked', note: '隣の教室（前）' }),
  op({ kind: 'door', at: wpos(WEST, W_CORR.u[0], -1.6), width: 0.95, wall: 'x', state: 'locked', note: '廊下の南の端（階段室へ）' }),
  op({ kind: 'door', at: wpos(WEST, W_CORR.u[1], -1.6), width: 0.95, wall: 'x', state: 'locked', note: '廊下の北の端（防火戸の向こう）' }),
  op({ kind: 'door', at: [(ANNEX.door[0] + ANNEX.door[1]) / 2, ANNEX.z[1]], width: ANNEX.door[1] - ANNEX.door[0], wall: 'x', state: 'locked', note: '倉庫の扉（参考画像の突き当たりの暗い扉）' }),
  op({ kind: 'door', at: [CLUB.x[0], CLUB.z[1] - 11.45], width: 0.9, wall: 'z', state: 'locked', note: '部室棟' }),
  op({ kind: 'door', at: wpos(WEST, WEST.u1 + 0.15, -8.1), width: 1.0, wall: 'x', state: 'locked', note: '西棟の北の非常口' }),
  op({ kind: 'double-door', at: wpos(WEST, WEST.u0 - 0.15, -2.9), width: 3.4, wall: 'x', state: 'locked', note: '西棟の昇降口' }),
  op({ kind: 'double-door', at: [(WALKWAY.x[0] + WALKWAY.x[1]) / 2, MAIN.z[0]], width: 4, wall: 'x', state: 'locked', note: '本館の入口（ガラスの戸）' }),
  op({ kind: 'door', at: [EAST.origin[0] + 9.1, -EAST.u0], width: 1.0, wall: 'x', state: 'locked', note: '東棟の非常口（各階。外階段の踊り場）' }),
  op({ kind: 'gate', at: [(NORTH.gate[0] + NORTH.gate[1]) / 2, NORTH.fenceZ], width: NORTH.gate[1] - NORTH.gate[0], wall: 'x', state: 'locked', note: '通用門（引き戸の門扉・くぐり戸。鍵）' }),
  op({ kind: 'gate', at: [COURT.x[1], 29.5], width: 3, wall: 'z', state: 'locked', note: '中庭から校庭への門扉（鍵）' }),
  op({ kind: 'gate', at: [wingNW[0] - 0.6, wingNW[1]], width: 1.2, wall: 'x', state: 'locked', note: '西棟の裏の細い土地への門扉（鍵）' }),
  op({ kind: 'opening', at: [0, LANE.z0], width: 5, wall: 'x', state: 'open', note: '通路の口（中庭へ）' }),
  op({ kind: 'opening', at: [-1.6, -34.6], width: 1.7, wall: 'z', state: 'open', note: '倉庫の西の抜け道（裏庭へ）' }),
  op({ kind: 'stair', at: [EAST.origin[0] + 6.2, 19.9], width: 1.2, wall: 'x', state: 'open', note: '外階段の上り口' }),
];

/** 西棟の壁に向かう向き（窓を正面から）・壁に沿って北へ向く向き */
const YAW_W = Math.atan2(WEST.normal[0], WEST.normal[1]);
const YAW_N = Math.atan2(-WEST.tangent[0], -WEST.tangent[1]);
const at = (u: number, w: number, y = 1.6): [number, number, number] => {
  const p = wpos(WEST, u, w);
  return [p[0], y, p[1]];
};

const tour: PlanTourStop[] = [
  { label: '参考画像の視点から振り返る（通路の南・中庭の方）', eye: [0.2, 1.6, -0.5], yaw: Math.PI, pitch: 0.02 },
  { label: '東棟の窓を正面から（中の廊下）', eye: [1.4, 1.6, -12], yaw: -Math.PI / 2, pitch: 0.12 },
  { label: '西棟の 1 階の窓を正面から（廊下が透ける）', eye: at(19.5, 2.4), yaw: YAW_W, pitch: 0.02 },
  { label: '裏口の前', eye: at(14.4, 1.8), yaw: YAW_W + 0.3, pitch: -0.05 },
  { label: '1 階の廊下（北を見る）', eye: at(11.5, -1.6), yaw: YAW_N, pitch: -0.03 },
  { label: '教室の後ろから黒板を見る', eye: at(10.4, -7.2), yaw: YAW_N + 0.1, pitch: -0.12 },
  { label: '教室の窓ぎわ（カーテンの隙間）', eye: at(10.5, -10.35), yaw: YAW_N + 0.12, pitch: -0.03 },
  { label: '通路の北の端・倉庫の前', eye: [0.9, 1.6, -29.5], yaw: 0.12, pitch: 0.12 },
  { label: '倉庫の西の抜け道（西棟の北の端と倉庫の間）', eye: [-1.5, 1.6, -34.6], yaw: Math.PI / 2 - 0.1, pitch: 0 },
  { label: '裏庭の通用門（道路と向かいの建物）', eye: [-6.5, 1.6, -44.5], yaw: 0.05, pitch: 0.12 },
  { label: '裏庭から木と倉庫（振り返る）', eye: [-11, 1.6, -45], yaw: -1.15, pitch: 0.05 },
  { label: '通路の口から中庭（渡り廊下と本館）', eye: [0.6, 1.6, 15.5], yaw: Math.PI, pitch: 0.05 },
  { label: '中庭の木の下から通路の口を振り返る', eye: [-9, 1.6, 31], yaw: -0.4, pitch: 0.05 },
  { label: '自動販売機の前', eye: [4.4, 1.6, 21.2], yaw: 0, pitch: -0.08 },
  { label: '外階段の 4 階の踊り場から中庭を見下ろす（高い所・行き止まり）', eye: [EAST.origin[0] + 9.1, EAST.fl[3] + 1.6, 19.9], yaw: Math.PI + 0.5, pitch: -0.35 },
  { label: '駐輪場', eye: [-3.0, 1.6, 15.8], yaw: 0.25, pitch: -0.05 },
  { label: '渡り廊下の枝から西棟の昇降口', eye: [-4, 1.6, 20], yaw: 1.45, pitch: 0 },
  { label: '本館の入口の前（中庭を振り返る）', eye: [0.6, 1.6, 37.5], yaw: 0.2, pitch: 0.12 },
];

export const alleyPlan: FloorPlan = {
  id: 'alley',
  title: '校舎の間の通路（建築版）— 都市部の高校の 2 つの校舎の間の管理用通路',
  typology: [
    '都市部の高等学校（敷地が狭く、校舎を密に建てた）。南北に長い 2 つの校舎が廊下側どうしで向き合い、その間が管理用の通路（給食・ごみ収集の車も通る）。',
    '西棟 = 特別教室棟（5 階。1 階は階高 4.5 m の特別教室・昇降口、2 階より上は階高 4.2 m の鉄骨の大きな窓の階）。東棟 = 普通教室棟（5 階。敷地が東へ下がるので 1 階は通路から 0.9 m 低い半地下、2 階より上は階高 3.4 m）。',
    '通路の北の端は裏庭（倉庫・ごみ置き場・キュービクル・通用門）と道路、その向こうに町の高い建物。南の端は中庭（木・水飲み場・ベンチ）と渡り廊下・本館。',
    '根拠: 普通教室は 8 m 角程度（一辺 8 m 以上・64〜72 ㎡が目安。自治体の学校施設の設計要領）。廊下幅は建築基準法施行令 119 条（中学・高校の生徒用: 両側に居室 2.3 m 以上、片側 1.8 m 以上）→ 2.7 m。',
    '階段は施行令 23 条（中学・高校: 幅 1.4 m 以上・蹴上げ 18 cm 以下・踏面 26 cm 以上）、屋外避難階段は幅 0.9 m 以上 → 外階段は幅 1.2 m・蹴上げ 17 cm・踏面 28 cm。教室の採光は床面積の 1/5 以上（法 28 条）→ 大きな窓。',
    '道路斜線制限（前面道路の反対側の境界線から 1.25〜1.5 の勾配）: 北の道路に近い棟の端は、上の階を斜めに削る。参考画像の両側の屋根の線が奥ほど下がるのはこれと読む。',
  ].join('\n'),
  spaces,
  walls,
  openings,
  tour,
  notes: [
    '【参考画像 alley-0 の視点】元の版と同じ（目 (0, 1.6, 0)・yaw -0.0167・pitch 0.0984・縦の画角 48.8°）。写る物: 左に西棟（1 階の 3 段の鉄の窓・柱型 4.1 m おき・裏口の暗い凹み、2 階より上の横に続く窓）、右に東棟（柱型 4.5 m おき・半地下の 1 階の窓・2 階より上の窓・北の端の日なたの壁と配管・室外機）、路面の白線と歩道の敷石と日の差し込み、右の花壇と分電盤、左手前と右手前の植え込み、突き当たりに倉庫（扉・高窓）と裏庭のケヤキ、その上に道路の向こうの明るい高い建物、右奥に部室棟の明るい壁。',
    '【写っていない方向】画角の左右の端は西棟（左端で壁の z ≈ -7.7）と東棟（右端で z ≈ -2.9）の壁。目の後ろ（z > 0）の駐輪場・通路の口・中庭・渡り廊下は画角の外。倉庫の西の抜け道は西棟の北の角（x -1.08, z -33.6）に隠れる。裏庭の北のフェンスと門・道路は倉庫と木に隠れ、向かいの建物の下の方だけが木の上に見える。',
    '【画角の確かめ（--plan）】黄色の扇は壁で切った見える範囲。通路の両側の壁で切れ、突き当たりは倉庫の南の面（z -35.5）で止まる。',
    '【西棟が斜めの理由】参考画像の左の壁の横の線は通路と別の消失点（x ≈ 891）へ向かう（元の版で解いた傾き 0.198 = 約 11°）。敷地の西の境界が斜め（古い水路の跡の道に沿う）で、西棟をそれに合わせて建てたと読む。通路は東棟に平行で、西棟との間は手前 10 m・奥 3.6 m に狭まる。',
    '【階の高さの決め方】参考画像の窓の帯の高さを壁の上で測った（ViewCam で画素 → 壁の座標）。西棟: 1 階の窓 0.15〜3.05 m（3 段・横桟 1.33・2.43 m）、2 階の窓台 5.7 m・まぐさ 8.4 m → 2 階 4.5 m・階高 4.2 m・窓の高さ 2.7 m。東棟: 1 階の窓は通路の高さ〜2.17 m（横桟 1.78 m）、2 階の窓 3.2〜5.6 m（横桟 4.6 m）→ 2 階の床 2.5 m・階高 3.4 m・1 階は半地下（-0.9 m）。',
    '【窓の桟の間隔】西棟の 1 階は柱の間 3.8 m を 5 枚（参考画像の桟と ±0.15 m で合う）。2 階より上は 0.71 m の桟と 2.84 m ごとの方立て（参考画像の桟の位置と 0.1 m 以内で合う）。東棟は 0.65 m 前後。参考画像の桟は画面の上で等間隔に描かれていて遠近法に合わない所があり、建物としての等間隔を優先した。',
    '【窓の映り込み（alley/glass.ts）】元の版の壁面の絵（参考画像の視点の画素で手で描いた形。参考画像そのものは読まない）を、ガラスの奥 7 m の「鏡の中の世界の絵」として引く: 今の目からガラスの点を通る線を奥 7 m まで延ばした点を、参考画像の目から見たときの壁の上の位置で絵を引く。参考画像の目ではちょうど元の絵、ほかの所からは目の動きに合わせて映り込みがずれる。参考画像の画角の外（絵の無い所）は、反射の向きで向かいの壁（階ごとの窓の帯と桟）・空・木の冠・地面を描く（向かいの棟の階の高さに合わせた）。',
    '【見る角度と中の部屋】見る角度が浅い（面の法線から 37° より外）とほぼ映り込みだけ、正面（14° 以内）からは 8 割が中の部屋。参考画像の視点の窓はすべて 40° より外なので元の絵のまま。中の部屋は interior mapping（ガラスの奥に部屋の箱を視線でたどる）: 廊下 = 腰壁・引き戸・欄間・掲示板、教室 = 机の天板・黒板・ロッカー、階段 = 段の帯、事務・倉庫 = 棚。天井の照明（2 割の部屋は点いている）・カーテン（窓ごとに引いた量が違う）。入れる所（西棟 1 階の廊下・教室）のガラスは透明で、本当の形が見える。',
    '【窓の形】ガラスは外壁の面から 7 cm 奥、鉄の枠（見付け 4.5 cm・見込み 3 cm）・縦の桟・横の桟・水切り。浅い角度から見ても参考画像より桟が太く見えないよう、桟は細く浅くした（深い桟は斜めから見ると厚い板になり、参考画像より暗くなった）。',
    '【入れる所】西棟 1 階の廊下（裏口から）と教室（後ろの引き戸から）。ガラスは透明で、外から正面に見ると本当の廊下が見える。ほかの部屋・上の階は鍵（扉は開かない）。',
    '【閉じ方】北: 敷地の境界のフェンスと通用門（鍵）、西の塀、西棟の裏への門扉（鍵）。南: 中庭の東のフェンスと校庭への門扉（鍵）・西の塀・本館の入口（鍵）。建物の扉はすべて鍵（裏口と教室の扉だけ開く）。外階段は 5 階の踊り場で行き止まり（非常口は鍵）。',
    '【日なたと影】通路は両側の校舎の影。東棟の北の方の壁だけ、低くなった西棟の北の端（道路斜線）の上を越えた午後の日が当たり、下の縁は西棟の斜めの屋根の影、ちぎれは裏庭の木の葉の影（壁の座標の絵で決めた。どこから見ても同じ所が明るい）。向かいの建物の左下の暗い面は西棟の影（元の版の「手前の屋根」の形を向かいの壁へ写した）。',
    '【参考画像の視点との比べ】元の版 ΔE 3.6・構図 F 71 → 建築版 ΔE 3.9・構図 F 73（合格: ΔE +0.5・F −3 以内）。ΔE が少し上がったのは、本当の柱型・枠・壁の厚さが、元の版の絵の明るいガラスを少し隠すため（特に東棟の手前の柱は鉛直なので上の方で画面の左へ寄る）。',
    '【現実離れした所】(1) 西棟と東棟で階の高さが違う（参考画像の窓の帯の高さに合わせた。建てた時期が違う 2 つの棟とみなす）。(2) 東棟の 1 階の窓が通路の路面のすぐ上から始まる（半地下の廊下の窓台が路面の高さ）。(3) 両棟の屋根の線が奥ほど大きく下がる（道路斜線で説明したが、勾配は約 0.4〜0.8 で実際の 1.25 より緩い。参考画像を優先）。(4) 東棟の柱型・窓は鉛直・水平で作ったので、参考画像の「画面で縦」の柱とは上の方で 10〜20 画素ずれる。(5) 鉄の窓の枠は見付け 4.5 cm・見込み 3 cm と浅め（斜めから見たときに参考画像より太く見えないように）。ガラスは外壁の面から 7 cm 奥。',
    '【写っていない所の光（2026-10-07 作り込み）】日は西南西・高さ約 48°（alley/sun.ts の SUN_DIR）。中庭・裏庭・道路・通路の口（参考画像の視点の後ろ）・開けた所に向いた壁は、作る時に建物・塀・渡り廊下の屋根・木の冠へ光線を飛ばして日なたの分布の絵を作り、材質の側でノイズのしきい値で切る（ちぎれた縁・木漏れ日。日なただけ敷石の目地が見える＝参考画像の歩道と同じ）。通路の中（参考画像の視点の画角）は元の版の手で描いた日なたのまま。夕方なので西棟 1 階の廊下は 1 つおき・教室は前の列だけ蛍光灯が点き、渡り廊下・駐輪場・自販機の前にも灯りの光だまり（ctx.addLamp。照らす箱は部屋・屋根の下だけ。外壁の材質は室内の灯りを受けない）。空と霧は日の方ほど明るい（霧のにじみ。参考画像の視点は北を向くので変わらない）。',
    '【当たり判定の直し】外階段の手すり・踊り場の開いた縁・上り下りの段の間に当たり判定が無く、踊り場から壁の上（外壁の当たり判定の上端 4.2 m）へ渡って東棟・倉庫・部室棟の屋根の上を歩けた（歩いて行けるかの確かめ・無作為の場所が屋根の上に出ていた）。外壁の当たり判定を屋根の線まで上げ、外階段の縁に板の当たり判定を足した。',
    '【色】写っていない所に足した日なた・灯り・小物の色は、参考画像の 16 色（暗い青緑の段と #386b6f・#5f9790・#b9e8d2）に寄せた。',
    '【2 回目の作り込み】空のドームだけを参考画像の明るい奥の色（#ccf8e3）へ（物に掛かる霧はそのまま。参考画像の視点の画角には空がほとんど写らない）。ガラスは、手で描いた映り込みの外（参考画像の画角の外へ映る所と、正面から見る板）で、壁の座標の大きなノイズで決めたまとまった広がりの板を明るい空・明るい建物の映り込み（窓の段の帯）と、ちぎれた木の葉の塊にする（参考画像のガラスの言葉。板は窓の桟で区切る。遠くでは細かいちぎれを消す）。塀の向こうの家は日の向きで面を分け（南・西・屋根は明るく、正面の東と北は陰）、暗いガラスと空を映す明るい板・庇とベランダの下の影。道路の向こうの明るい建物には方立て・庇の下の影・室外機・屋上の塔屋と水槽・1 階の店先と看板・陰の東の面を足した（参考画像の視点から見える所は refSees で選り分け、壁の絵のまま）。西棟 1 階の灯りの照らす箱は壁の向きに回した（Lamp.yaw）。',
    '【写っていない所の作り込み】校舎の外壁は全周を同じ作り方（窓の穴・枠・桟・水切り・柱型・笠木）で作り、窓の中は部屋の種類（廊下・教室・階段・事務室・倉庫・部室）ごとの中の部屋で描く。屋外の置く物の決まり: 通路 = 排水の蓋・側溝・花壇・分電盤・雨どい・室外機と冷媒管・屋上の柱、裏庭 = ごみ置き場・キュービクルと柵・自転車・パレット・ドラム缶・ホース・植え込み・門柱と門扉、中庭 = 木・花壇と縁石・ベンチ・水飲み場・時計の柱・渡り廊下（柱・屋根・樋）・自販機と回収箱、駐輪場 = 屋根・柱・ラック・自転車・地面の線・札、敷地の外 = 道路・白線・歩道・電柱と電線・街灯・向かいの建物・家。2026-10-07 に足した決まり（alley/outside.ts・dress.ts・town.ts）: 開けた所に向いた壁ぞいにたて樋・室外機・メーター・換気口・散水栓・扉の上の灯り・札（日なたか陰かで色を選ぶ）、写っていない面の壁に階ごとの水平の帯・窓台の下の雨だれ・型枠の目地と塗りのむら、地面に補修の跡・ひび・油じみ・マンホール・雨水桝・横断側溝・落ち葉（木の下と吹きだまり）・壁と塀の足元の雑草、物の足元に接地の影、中庭に百葉箱・屋根付きの掲示板・ごみ箱・花壇の札・台車、塀の向こうの家とアパートは窓・庇・ベランダ・室外機・切妻の屋根まで。室内は廊下 = 幅木・掲示物（紙の絵の升目）・室名札・ロッカー・消火栓と非常ベル・掃除用具・網入りガラスの明るい突き当たりの扉、教室 = 学級目標・時間割・後ろの掲示・机の上の物・カーテンの隙間から床へ差す日。',
  ],
};
