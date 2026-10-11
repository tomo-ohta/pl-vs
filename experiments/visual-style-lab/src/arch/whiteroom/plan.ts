import type { FloorPlan, PlanOpening, PlanSpace, PlanTourStop, PlanWall } from '../plan.ts';
import { A_ROOMS, A_STAIR, WEST_OPENINGS } from './courtA.ts';
import { B_ROOMS } from './courtB.ts';
import { C_ROOMS, C_STAIR, FORECOURT } from './courtC.ts';
import type { RoomSpec } from './interior.ts';
import { A, CW } from './layout.ts';

/**
 * whiteroom（白いコンクリートの中庭）の間取り図。数は courtA/B/C.ts・layout.ts（形と同じ数）から作る。
 * 座標は場面と同じ（x 右・z 手前）。図は上が -z。
 */

const KIND: Record<RoomSpec['kind'], PlanSpace['kind']> = {
  porter: 'room',
  passage: 'corridor',
  stair: 'stair',
  chapter: 'hall',
  library: 'room',
  refectory: 'hall',
  workshop: 'room',
  classroom: 'room',
  store: 'service',
  cell: 'room',
  hall: 'hall',
};

const roomSpaces = (rs: RoomSpec[]): PlanSpace[] =>
  rs.map((r) => ({ id: r.id, label: r.label, kind: KIND[r.kind], rect: r.rect, floor: r.y0, ceiling: r.y1, level: r.y0 > 2 ? 1 : 0 }));

const roomDoors = (rs: RoomSpec[]): PlanOpening[] =>
  rs.flatMap((r) =>
    (r.doors ?? [])
      .filter((d) => (d.y0 ?? 0) < 1 || d.h > 1.9)
      .map((d): PlanOpening => {
        const t = r.t ?? 0.3;
        const [x0, z0, x1, z1] = r.rect;
        const at: [number, number] =
          d.side === 'n' ? [d.at, z0 - t / 2] : d.side === 's' ? [d.at, z1 + t / 2] : d.side === 'w' ? [x0 - t / 2, d.at] : [x1 + t / 2, d.at];
        return {
          kind: d.open ? 'opening' : 'door',
          at,
          width: d.w,
          wall: d.side === 'n' || d.side === 's' ? 'x' : 'z',
          state: d.locked ? 'locked' : d.open ? 'open' : 'closed',
          level: r.y0 > 2 ? 1 : 0,
          note: `${r.label}${d.locked ? '（鍵）' : d.open ? '' : '・近づくと開く'}`,
        };
      }),
  );

const spaces: PlanSpace[] = [
  // 部屋（無作為の場所の区分けで、外の大きな塊より先に当てる）
  ...roomSpaces(A_ROOMS),
  ...roomSpaces(B_ROOMS),
  ...roomSpaces(C_ROOMS),
  // ---- A 回廊の中庭 ----
  { id: 'A', label: 'A 回廊の中庭（参考画像 0）', kind: 'outdoor', rect: [A.xW, A.zN, 5.36, A.zS], floor: 0, note: '目 1.5 m で北の棟を見る。床は淡い緑の灰色の打ち放し、南の端に暗い舗石の帯。真ん中に長いベンチ' },
  { id: 'A-cloister', label: '西の回廊（中庭へ開いた開口 6 つ）', kind: 'corridor', rect: [A.westPorchBack, A.zN, A.xW - 0.6, A.zS], floor: 0, ceiling: A.soffit },
  { id: 'A-stair', label: '西の棟の階段の吹き抜け', kind: 'stair', rect: [-14.0, -19.0, -8.1, -5.3], floor: 0, ceiling: 7.5, note: '回廊から広い口。階段は西の壁ぎわを北へ上って 2 階の図書室（4.9 m）へ' },
  { id: 'A-loggia', label: '北の棟のロッジア（暗い凹み）', kind: 'hall', rect: [-4.19, A.zN - A.loggia.depth, A.loggia.x1, A.zN], floor: 0, ceiling: A.loggia.h },
  { id: 'A-north', label: '北の棟（3 階建て・2 階より上は入れない）', kind: 'service', rect: [-16, A.zN - 10, 18, A.zN], floor: 0, ceiling: A.northH, closed: true },
  { id: 'A-east', label: '東の棟（3 階建て・1 階の袖壁の間の扉。2 つが教室・工房）', kind: 'service', rect: [A.xE, A.zN, 16, A.zS], floor: 0, ceiling: A.eastH, closed: true },
  { id: 'A-gate', label: '門の通路（A ↔ B。中ほどに両開きの門扉）', kind: 'corridor', rect: [-1.0, A.zS, 1.2, A.zS + 6], floor: 0, ceiling: 2.5 },
  { id: 'A-balcony', label: '西の棟の 2 階のバルコニー（参考画像 2 の視点）', kind: 'platform', rect: [-16.5, -21.8, -14.3, -18.2], floor: 4.9, level: 1 },
  // ---- B 庇の中庭 ----
  { id: 'B', label: 'B 庇の中庭（参考画像 1）', kind: 'outdoor', rect: [-6.5, 14.0, 6.0, 51.8], floor: 0, note: '東西の 2 階建ての棟の 1 階に庇 3 組。庇の下の壁と扉はいつも陰。ベンチ 1 つ' },
  { id: 'B-west', label: 'B 西の棟（工房のほかは入れない）', kind: 'service', rect: [-16.4, 14.0, -6.5, 51.8], floor: 0, ceiling: 6.6, closed: true },
  { id: 'B-east', label: 'B 東の棟（教室のほかは入れない）', kind: 'service', rect: [6.0, 14.0, 15.6, 51.8], floor: 0, ceiling: 6.6, closed: true },
  { id: 'B-balcony', label: '南の棟の 2 階のバルコニー（参考画像 1 の視点）', kind: 'platform', rect: [-2.4, 50.4, 1.6, 51.8], floor: 4.4, level: 1 },
  // ---- 前庭・C 沈んだ中庭 ----
  { id: 'F', label: '前庭（A の西の棟と C の門の壁の間）', kind: 'outdoor', poly: [[FORECOURT.x0, FORECOURT.z0], [FORECOURT.x1, FORECOURT.z0], [FORECOURT.x1, FORECOURT.z1], [FORECOURT.xNorth, FORECOURT.z1], [FORECOURT.xNorth, CW.podN], [FORECOURT.x0, CW.podN]], floor: 0, note: '南の端に外への門（鍵）。北の端に門の壁の上のテラスへの階段' },
  { id: 'F-stair', label: '前庭の階段（門の壁の上へ）', kind: 'stair', rect: [C_STAIR.x0, C_STAIR.zBottom - 5.6, C_STAIR.x1, C_STAIR.zBottom], floor: 0, ceiling: 3.6 },
  { id: 'C', label: 'C 沈んだ中庭（参考画像 2）', kind: 'outdoor', rect: [CW.x0, CW.zS, CW.wallIn, CW.zN], floor: 0, note: '平屋の回廊（屋上がテラス）に囲まれる。ベンチ・長い低いコンクリートの台' },
  { id: 'C-walkN', label: 'C 南の回廊（参考画像の左。長く低い開口・暗い）', kind: 'corridor', rect: [CW.x0 - 3.4, CW.zN + 0.4, CW.wallIn, CW.zN + 3.4], floor: 0, ceiling: 3.3 },
  { id: 'C-walkS', label: 'C 北の回廊（参考画像の右）', kind: 'corridor', rect: [CW.x0 - 3.4, CW.zS - 3.4, CW.wallIn, CW.zS - 0.4], floor: 0, ceiling: 3.3 },
  { id: 'C-walkW', label: 'C 西のロッジア（行き止まり）', kind: 'corridor', rect: [CW.x0 - 3.4, CW.zS - 0.4, CW.x0 - 0.4, CW.zN + 0.4], floor: 0, ceiling: 3.3 },
  { id: 'C-terN', label: 'C 南のテラス（回廊の屋上）', kind: 'platform', rect: [CW.x0 - 3.7, CW.zN, CW.wallIn, CW.podN], floor: 3.6, level: 1 },
  { id: 'C-terS', label: 'C 北のテラス', kind: 'platform', rect: [CW.x0 - 3.7, CW.podS, CW.wallIn, CW.zS], floor: 3.6, level: 1 },
  { id: 'C-terW', label: 'C 西のテラス', kind: 'platform', rect: [CW.podW, CW.zS, CW.x0, CW.zN], floor: 3.6, level: 1 },
  { id: 'C-terE', label: '門の壁の上のテラス', kind: 'platform', rect: [CW.wallIn, CW.podS, CW.wallOut, CW.podN], floor: 3.6, level: 1 },
  { id: 'C-gates', label: '門の壁の口（通り抜け）', kind: 'corridor', rect: [CW.wallIn, -22.4, CW.wallOut, -16.2], floor: 0, ceiling: 2.7 },
  { id: 'C-outer', label: 'C を囲む 2 階建ての棟（2 階の寝室のほかは入れない）', kind: 'service', poly: [[CW.outW, CW.outS], [CW.wallOut, CW.outS], [CW.wallOut, CW.podS], [CW.podW, CW.podS], [CW.podW, CW.podN], [CW.outE, CW.podN], [CW.outE, CW.outN], [CW.outW, CW.outN]], floor: 0, ceiling: CW.outH, closed: true },
];

const walls: PlanWall[] = [
  // A の中庭の東西の面・北の棟の面
  { a: [A.xW, A.zS], b: [A.xW, A.zN] },
  { a: [5.36, A.zS], b: [5.36, A.zN] },
  { a: [-16, A.zN], b: [18, A.zN] },
  // B の東西の棟の面
  { a: [-6.5, 14], b: [-6.5, 51.8] },
  { a: [6.0, 14], b: [6.0, 51.8] },
  { a: [-16, 14], b: [16, 14] },
  { a: [-16, 51.8], b: [16, 51.8] },
  // 前庭と C
  { a: [CW.wallOut, CW.podS], b: [CW.wallOut, CW.podN] },
  { a: [CW.wallIn, CW.podS], b: [CW.wallIn, CW.podN] },
  { a: [CW.x0, CW.zN], b: [CW.wallIn, CW.zN] },
  { a: [CW.x0, CW.zS], b: [CW.wallIn, CW.zS] },
  { a: [CW.x0, CW.zS], b: [CW.x0, CW.zN] },
  { a: [FORECOURT.xNorth, FORECOURT.z1], b: [FORECOURT.x1, FORECOURT.z1] },
  { a: [CW.wallIn, FORECOURT.z0], b: [FORECOURT.x1, FORECOURT.z0] },
  { a: [-14.3, A.zN], b: [-14.3, A.zS] },
];

const openings: PlanOpening[] = [
  ...WEST_OPENINGS.map(([z0, z1]): PlanOpening => ({ kind: 'opening', at: [A.xW - 0.3, (z0 + z1) / 2], width: z0 - z1, wall: 'z', state: 'open', note: '回廊の開口（上端 3.6 m）' })),
  { kind: 'opening', at: [A.westPorchBack - 0.15, -9.3], width: 1.6, wall: 'z', state: 'open', note: '階段の吹き抜けの口' },
  { kind: 'double-door', at: [0.1, 11.0], width: 2.2, wall: 'x', state: 'closed', note: '門の通路の両開きの門扉（近づくと開く。B から見ると暗い青緑の口）' },
  { kind: 'opening', at: [0.1, A.zS], width: 2.2, wall: 'x', state: 'open', note: '門の通路（A 側）' },
  { kind: 'opening', at: [0.1, A.zS + 6], width: 2.2, wall: 'x', state: 'open', note: '門の通路（B 側）' },
  ...[
    [-16.95, 1.3],
    [-20.415, 1.69],
    [-21.905, 0.79],
  ].map(([z, w]): PlanOpening => ({ kind: 'gate', at: [(CW.wallOut + CW.wallIn) / 2, z], width: w, wall: 'z', state: 'open', note: '門の壁の口（暗い鉄の扉は口の中に引っ込めてある。通れる）' })),
  { kind: 'gate', at: [-19.7, FORECOURT.z1 + 0.2], width: 2.6, wall: 'x', state: 'locked', note: '前庭の南の外への門（鍵）' },
  { kind: 'opening', at: [-14.3, -20.0], width: 1.2, wall: 'z', state: 'open', level: 1, note: '図書室 → 西のバルコニー' },
  ...roomDoors([...A_ROOMS, ...B_ROOMS, ...C_ROOMS]),
];

const E = 1.55;
const tour: PlanTourStop[] = [
  { label: 'A: 振り返って南の門の棟（B への門の口）', eye: [0.3, E, -10], yaw: Math.PI, pitch: 0 },
  { label: 'A: 東の棟の袖壁と扉（近く）', eye: [3.2, E, -13.0], yaw: -1.15, pitch: -0.05 },
  { label: 'A: 西の回廊の中（暗い・低い）', eye: [-6.9, E, -12.0], yaw: 0.05, pitch: -0.05 },
  { label: 'A: 食堂（ロッジアの真ん中の扉の奥）', eye: [-0.6, E, -34.3], yaw: 0.2, pitch: -0.08 },
  { label: 'A: 階段の吹き抜けを見上げる', eye: [-10.5, E, -7.0], yaw: 0.25, pitch: 0.35, fov: 68 },
  { label: 'A: 2 階の図書室', eye: [-8.0, 4.9 + E, -19.5], yaw: 0.35, pitch: -0.1 },
  { label: '西のバルコニーから前庭と門の壁を見下ろす（高い所）', eye: [-15.6, 4.9 + E, -18.9], yaw: 0.9, pitch: -0.45 },
  { label: '前庭: 門の壁の口と、上のテラスへの階段', eye: [-17.0, E, -18.5], yaw: 1.9, pitch: 0.05 },
  { label: 'C: 門の口を抜けて西を見る', eye: [-26.2, E, -20.4], yaw: Math.PI / 2, pitch: 0 },
  { label: 'C: 南の回廊の中（暗い）', eye: [-40.0, E, -11.8], yaw: Math.PI / 2, pitch: -0.05 },
  { label: 'C: 西のロッジア（行き止まり）から振り返る', eye: [-57.8, E, -22.0], yaw: -Math.PI / 2, pitch: 0 },
  { label: 'C: 北のテラスから中庭を見下ろす（高い所）', eye: [-40.0, 3.6 + E, -30.6], yaw: Math.PI - 0.2, pitch: -0.35 },
  { label: 'C: 南の棟の 2 階の寝室', eye: [-47.5, 3.6 + E, -4.0], yaw: 0.3, pitch: -0.1 },
  { label: '門の壁の上のテラス（前庭の階段を上ったところ）から C を見下ろす', eye: [-24.2, 3.6 + E, -31.0], yaw: Math.PI / 2 + 0.5, pitch: -0.25 },
  { label: 'B: 門の口の前から振り返って南の棟', eye: [0.1, E, 17.0], yaw: Math.PI, pitch: 0.05 },
  { label: 'B: 庇の下（暗い壁と扉）', eye: [-5.0, E, 34.5], yaw: 0.6, pitch: -0.05 },
  { label: 'B: 西の棟の工房', eye: [-8.0, E, 38.4], yaw: 0.75, pitch: -0.15 },
  { label: 'B: 東の棟の教室（扉の内側から）', eye: [6.9, E, 38.3], yaw: -Math.PI / 2 + 0.35, pitch: -0.08 },
  { label: 'B: 南の棟の階段室を見上げる', eye: [-5.3, E, 53.3], yaw: Math.PI + 0.2, pitch: 0.4, fov: 68 },
  { label: 'B: 南の棟の 2 階の談話室', eye: [0.5, 4.4 + E, 57.5], yaw: Math.PI / 2, pitch: -0.1 },
  { label: 'A ↔ B: 門の通路（低い・暗い）', eye: [0.1, E, 12.7], yaw: 0.0, pitch: 0 },
  { label: 'A: 東の棟の教室', eye: [9.5, E, -15.0], yaw: Math.PI / 2, pitch: -0.08 },
  { label: 'A: 門番の部屋', eye: [-10.0, E, 3.0], yaw: 1.2, pitch: -0.1 },
  { label: 'A: 集会室', eye: [-11.0, E, -21.0], yaw: 0.0, pitch: -0.05 },
];

export const whiteroomPlan: FloorPlan = {
  id: 'whiteroom',
  title: '白いコンクリートの中庭 — 山の上の修道院（寄宿の学びの家）の 3 つの中庭',
  typology: [
    '1960〜70 年代の打ち放しコンクリート（白い塗り）の修道院付属の寄宿学校。回廊で囲んだ中庭を軸に、用途ごとの中庭が連なる（ル・トゥーレットのラ・トゥーレット修道院・各地のブルータリズムの神学校・刑務所の運動場の中庭と同じ構成）。',
    '3 つの中庭: A 回廊の中庭（礼拝堂の棟・教室の棟・食堂のある北の棟に囲まれる。参考画像 0）、B 庇の中庭（工房と教室の 2 階建ての棟の間。1 階に深い庇の歩廊。参考画像 1）、C 沈んだ中庭（平屋の回廊の屋上がテラスで、その外に寝室の 2 階建ての棟。参考画像 2）。A と B は平屋の門の棟の通路、A と C は前庭（西の棟の通り抜けの外）でつながる。',
    '寸法の根拠: 扉 2.1〜2.5 m・回廊の開口の上端 3.6 m（参考画像の扉との比）、階高 3.6〜4.5 m、3 階建て 9.8〜9.9 m、2 階建て 6.6〜7.6 m、回廊の幅 2.5〜3 m、階段 1 段 0.175 m・踏み面 0.28 m（歩いて上れる）。',
    '参考画像の視点はどれも縦の線が平行のまま見下ろす建築パースの描き方なので、あおりレンズ（写す範囲を上下にずらす）で撮る。目の高さは 0 = 1.5 m（中庭に立つ）、1 = 6.0 m（南の棟の 2 階のバルコニー）、2 = 6.5 m（A の西の棟の 2 階のバルコニー）。',
  ].join('\n'),
  spaces,
  walls,
  openings,
  tour,
  notes: [
    '【参考画像 0】焦点距離 1400 画素・消失点 (730, 425)・目 1.5 m。東西の面（x -5.3 / 5.36）・北の棟の面（z -30.9）・ロッジア（x -4.19〜2.9・天井 3.66）・扉と窓・ベンチの位置は画素から ShiftCam で求めた。西の棟の屋根の線は参考画像の輪郭（(445,0)→(540,300)）が奥へ下がるので、2 階建ての部分の屋根を奥へ上げてから北の棟の手前で下げる折れ屋根にした（z -26 で 9.4 m・北の棟で 7.75 m）。南の端（z > -7.6）が平屋なのは、床の影の幅（参考画像で手前ほど狭い）から求めた。',
    '【参考画像 1】焦点距離 1450 画素・消失点 (715, 105)・目 6.0 m。庇の床の影が庇の真下に落ちている（影の端と庇の先端の X が同じ）ので、B の日はほぼ真上。庇の上面の高さは影と庇の奥の端の重なりから求めた（手前 3.47 m、中 3.2 m）。突き当たりの壁の上の暗い灰青緑の帯は空とし、B の霧の色も同じにして、門の棟の向こう（37 m より遠く）の A の棟は霧に溶かした（B の中を北へ歩けば A の棟が見えてくる）。',
    '【参考画像 2】焦点距離 1500 画素・消失点 (660, 45)・目 6.5 m。手前の淡い帯 + 暗い面は、視点の棟（A の西の棟）の外にある門の壁（高さ 3.6 m・厚さ 1.6 m・上はテラス）の上面と外の面とした（バルコニーの手すり壁とすると目の高さが 3.5 m になり合わない）。中庭の面の三角・平行四辺形の暗い形は、長く低い開口（上端 2 m）の奥の暗い回廊が手前の壁で隠れた形（水平の上端が消失点へ向かう）。',
    '【矛盾の解き方】(1) 3 枚は同じ建物の別の中庭（A・B・C）とした。0 は 3 階建ての壁に囲まれ、2 は平屋の回廊とテラスに囲まれ、1 は庇の並ぶ長い中庭で、1 つの中庭にはまとまらない。(2) 日の向きが画像ごとに合わない（0 = 左の後ろの上、1 = ほぼ真上、2 = 前の少し左の上）。中庭ごとに日の向きと影の範囲を切り替える（区域。プールの建築版と同じ。中庭の間は屋根のある通路と門扉なので、切り替わる所は見えない）。(3) 空の色も 1 だけ暗い灰青緑（区域ごとの空のドームの色）。(4) 0 の北の棟のロッジアは周りの壁と同じ向きなのに暗い → 凹み 2.2 m の奥は日が届かない（形で説明）+ 暗い材質。',
    '【写っていない方向】0 の南（後ろ）は平屋の門の棟と B への門の通路、1 の南（後ろ）は視点のある南の棟（階段室・談話室）、2 の東（後ろ）は A の西の棟の図書室。どれも参考画像の画角の外。前庭の階段・植木鉢・洗い場・排水の格子は画角の外（z > -5.4 など）に置いた。',
    '【閉じ方】開く扉は近づくと開く（門番の部屋・通り抜けの間・集会室・食堂・東の教室と工房・B の工房と教室・南の棟の階段室・C の寝室・門の通路の門扉）。食堂の左右の扉・集会室の北の扉・前庭の南の外への門は鍵。棟の残りの部分（3 階建ての上の階・C を囲む棟の 1 階など）は入れない塊（間取り図の service）。',
    '【現実離れした所】(1) 中庭ごとに日の向きが違う（上の (2)）。(2) B の霧は 38 m から急に濃い（突き当たりの壁より向こうを空に溶かすため）。(3) 西の棟の屋根は 2 階建ての部分で奥へ上がり、北の棟の手前で下がる折れ屋根（礼拝堂の棟の高い天井の名残とみなす）。(4) C の手前の門の壁は外の面だけ暗い（北向きで苔むした面とみなす）。',
  ],
};

export const STAIR_A = A_STAIR;
