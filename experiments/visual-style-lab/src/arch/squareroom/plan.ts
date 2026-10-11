import type { FloorPlan, PlanOpening, PlanSpace, PlanTourStop, V2 } from '../plan.ts';
import { A } from './canalA.ts';
import { B } from './canalB.ts';
import { C } from './canalC.ts';
import { D } from './canalD.ts';
import { Frame } from './frame.ts';
import { BASIN, BED, VIEWS, WALK } from './layout.ts';
import { ROOMS, TERRACE } from './rooms.ts';

/**
 * 立方体の大広間と水路（squareroom）の間取り図。数値は水路の局所の座標（canalA〜D.ts）を Frame で世界へ写したもの。
 */
const fA = new Frame(VIEWS.v2.frame);
const fB = new Frame(VIEWS.v0.frame);
const fC = new Frame(VIEWS.v3.frame);
const fD = new Frame(VIEWS.v1.frame);
const R = (f: Frame, r: [number, number, number, number]): [number, number, number, number] => f.rect(r);
const P = (f: Frame, x: number, z: number): V2 => {
  const p = f.p(x, 0, z);
  return [p[0], p[2]];
};
/** 局所の目の位置と向き → 道順の一点 */
const stop = (label: string, f: Frame, x: number, eyeY: number, z: number, yaw: number, pitch = -0.02, fov = LENS): PlanTourStop => {
  const p = f.p(x, eyeY, z);
  return { label, eye: p, yaw: f.yawW(yaw), pitch, fov };
};

/** 道順のレンズ（縦 60°。無作為の場所と同じ） */
const LENS = 60;
const W = BASIN.walk;
const Wr = BASIN.water;

const spaces: PlanSpace[] = [
  // ---- 水庭 ----
  { id: 'basin', label: '四角い水庭（水深 0.45 m）', kind: 'water', rect: [-Wr, -Wr, Wr, Wr], floor: BED, note: '浅い。歩いて渡れる。四方の歩廊から段で下りる' },
  { id: 'basin-walk-n', label: '水庭の北の歩廊', kind: 'platform', rect: [-W, -W, W, -Wr], floor: WALK },
  { id: 'basin-walk-s', label: '水庭の南の歩廊', kind: 'platform', rect: [-W, Wr, W, W], floor: WALK, note: '出発点。西に階段室の扉' },
  { id: 'basin-walk-w', label: '水庭の西の歩廊', kind: 'platform', rect: [-W, -Wr, -Wr, Wr], floor: WALK },
  { id: 'basin-walk-e', label: '水庭の東の歩廊', kind: 'platform', rect: [Wr, -Wr, W, Wr], floor: WALK },
  { id: 'island', label: '中央の四角い島', kind: 'platform', rect: [-3, -3, 3, 3], floor: WALK, note: '南北へ飛び石' },
  { id: 'terrace', label: '屋上テラス（12.7 m）', kind: 'platform', rect: TERRACE.rect, floor: TERRACE.y, level: 1, note: '水庭の上へ張り出す。手すり壁。高い所から水庭と C の口を見下ろす' },
  // ---- B ----
  { id: 'B-street', label: 'B 浸水した通り（水盤と板石の通路）', kind: 'corridor', rect: R(fB, [-5.6, B.plazaZ, 5.6, B.mouthZ]), floor: 0, note: 'squareroom-0 の視点。両側の壁は低い箱が手前へ出て、上は 40 m 余り' },
  { id: 'B-plaza', label: 'B 奥の前庭', kind: 'hall', rect: R(fB, [B.plazaXl, B.endZ, B.plazaXr, B.plazaZ]), floor: 0, note: '正面の壁に細く高い扉（光る。中庭へは入れない）と上の切れ目' },
  // ---- A ----
  { id: 'A-water', label: 'A 大運河（水深 0.45 m）', kind: 'water', rect: R(fA, [A.wl, A.endZ, A.wr, A.mouthZ]), floor: BED, note: 'squareroom-2 の視点は水の中（膝まで）' },
  { id: 'A-walk-n', label: 'A 北の回廊（柱の列・日の当たる岸）', kind: 'corridor', rect: R(fA, [A.backL, A.endZ, A.wl, A.mouthZ]), floor: WALK, ceiling: A.roofL },
  { id: 'A-walk-s', label: 'A 南の回廊（暗い岸）', kind: 'corridor', rect: R(fA, [A.wr, A.endZ, A.backR, A.mouthZ]), floor: WALK, ceiling: A.roofR, note: '奥の壁に小さな灯りの窓・管理室の扉' },
  // ---- C ----
  { id: 'C-water', label: 'C 日の差す水路（水深 0.45 m）', kind: 'water', rect: R(fC, [C.walkEdge, C.endZ, C.wallR, C.mouthZ]), floor: BED, note: 'squareroom-3 の視点。東の壁ぞいに飛び石の列' },
  { id: 'C-walk', label: 'C 西の歩廊', kind: 'corridor', rect: R(fC, [C.walkBack - 1.4, C.endZ, C.walkEdge, C.mouthZ]), floor: C.walkTop, note: '低い箱の正面と歩廊に日だまり。奥に小部屋の扉' },
  // ---- D ----
  { id: 'D-water', label: 'D 細く暗い水路（水深 0.45 m）', kind: 'water', rect: R(fD, [D.wl, D.endZ, D.wr, D.mouthZ]), floor: BED, note: 'squareroom-1 の視点' },
  { id: 'D-walk-s', label: 'D 南の暗い回廊', kind: 'corridor', rect: R(fD, [D.backL, D.endZ, D.wl, D.mouthZ]), floor: D.walkTop, ceiling: D.underL, note: '排水の升。奥にポンプ室の扉' },
  { id: 'D-walk-n', label: 'D 北の歩廊', kind: 'corridor', rect: R(fD, [D.wr, D.endZ, D.wallR, D.mouthZ]), floor: D.walkTop },
  // ---- 門の抜け（行き止まり。外は深い湖） ----
  { id: 'A-gate', label: 'A の開口の抜け', kind: 'corridor', rect: R(fA, [A.gate[0] - A.gateWd, A.endZ - 4, A.gate[1] + A.gateWd, A.endZ]), floor: BED, ceiling: A.gate[2] + A.gateSh, note: '外の湖を見る行き止まり。枠の奥は左右に縁の段・天井のリブ・灯りの列・水門の枠' },
  { id: 'C-gate', label: 'C の門の抜け', kind: 'corridor', rect: R(fC, [C.gate[0] - C.gateWd, C.endZ - 6, C.gate[1] + C.gateWd, C.endZ]), floor: BED, ceiling: C.gate[2] + C.gateSh, note: '外の湖と段々の堤を見る行き止まり。枠の奥は左右に縁の段・天井のリブ・灯りの列・水門の枠。外に高い岸壁' },
  // ---- 外 ----
  { id: 'lake-e', label: '外の湖（深い）', kind: 'void', rect: R(fA, [-8, A.endZ - 40, 10, A.endZ - 4]), floor: -3, closed: true, note: 'A の開口の外。霧で何も見えない' },
  { id: 'lake-n', label: '外の湖と段々', kind: 'void', rect: R(fC, [-12, C.endZ - 60, 10, C.endZ - 6]), floor: -3, closed: true, note: 'C の門の外。遠くに段々の堤（霞む）' },
  { id: 'court-s', label: '光の中庭（入れない）', kind: 'void', rect: R(fB, [B.door[0] - 0.5, B.endZ - 7, B.door[1] + 0.5, B.endZ - 6]), floor: 0, closed: true },
  { id: 'court-w', label: '水際の扉の奥（入れない）', kind: 'void', rect: R(fD, [D.door[0] - 0.4, D.endZ - 6, D.door[1] + 0.4, D.endZ - 5]), floor: BED, closed: true },
];
for (const r of ROOMS) {
  spaces.push({
    id: r.id,
    label: r.label,
    kind: r.id === 'stair' ? 'stair' : r.id === 'pump' ? 'service' : 'room',
    rect: r.rect,
    floor: r.floor,
    ceiling: r.ceil,
    note: r.id === 'stair' ? '折り返し階段 4 段落ち（1 段 0.172 m）で屋上テラスへ' : r.id === 'pump' ? '床が 1.5 m 下がる。ポンプ・配管・弁・制御盤' : undefined,
  });
}

const openings: PlanOpening[] = [
  { kind: 'opening', at: [(-18.8 - 5.3) / 2, -W], width: 13.5, wall: 'x', note: 'C の口（上は 12 m の楣）' },
  { kind: 'opening', at: [W, (-20.3 + 2.7) / 2], width: 23, wall: 'z', note: 'A の口' },
  { kind: 'opening', at: [9, W], width: 11.2, wall: 'x', note: 'B の口' },
  { kind: 'opening', at: [-W, (3.1 + 19.6) / 2], width: 16.5, wall: 'z', note: 'D の口' },
  { kind: 'opening', at: P(fA, (A.gate[0] + A.gate[1]) / 2, A.endZ), width: A.gate[1] - A.gate[0], wall: 'z', state: 'locked', note: 'A の開口（外は深い湖。行き止まり）' },
  { kind: 'opening', at: P(fC, (C.gate[0] + C.gate[1]) / 2, C.endZ), width: C.gate[1] - C.gate[0], wall: 'x', state: 'locked', note: 'C の門（外は深い湖と段々。行き止まり）' },
  { kind: 'door', at: P(fB, (B.door[0] + B.door[1]) / 2, B.endZ), width: B.door[1] - B.door[0], wall: 'x', state: 'closed', note: 'B の高い扉（光の中庭。閉じている）' },
  { kind: 'door', at: P(fD, (D.door[0] + D.door[1]) / 2, D.endZ), width: D.door[1] - D.door[0], wall: 'z', state: 'closed', note: 'D の水際の扉（閉じている）' },
  { kind: 'door', at: [-4.1, 18.8], width: 1.8, wall: 'x', note: '水庭の南の歩廊 → 階段室' },
  { kind: 'stair', at: [-8.5, 21.3], width: 3.2, wall: 'x', note: '階段室の折り返し階段（0.3 → 12.7 m）' },
  { kind: 'door', at: [-4.1, 19.4], width: 1.8, wall: 'x', level: 1, note: '階段室 → 屋上テラス（12.7 m）' },
  { kind: 'door', at: [-43.2, 19.4], width: 1.6, wall: 'x', note: 'D の南の回廊 → ポンプ室（下りる）' },
  { kind: 'door', at: [29.9, 3.2], width: 1.4, wall: 'x', note: 'A の南の回廊 → 管理室' },
  { kind: 'door', at: [-17.4, -30], width: 1.2, wall: 'z', note: 'C の西の歩廊 → 小部屋' },
];

const tour: PlanTourStop[] = [
  { label: '1 水庭の南の歩廊（出発点）から北', eye: [-9, WALK + 1.6, 16], yaw: 0, fov: LENS },
  { label: '2 中央の島から東（A の口）', eye: [0, WALK + 1.6, 0], yaw: -Math.PI / 2, fov: LENS },
  { label: '3 屋上テラス（高い所）から水庭を見下ろす', eye: [-8, TERRACE.y + 1.6, 16], yaw: 0, pitch: -0.3, fov: LENS },
  { label: '4 階段室の中（折り返し）', eye: [-4.4, WALK + 1.6, 20.4], yaw: Math.PI / 2, fov: LENS },
  stop('5 B の通りの口から南', fB, 0, 1.6, 6, 0),
  stop('6 B の前庭・扉の前（行き止まり）から振り返る', fB, 3, 1.6, -64, Math.PI),
  stop('7 A の北の回廊（柱の列）から東', fA, -8, WALK + 1.6, -20, 0),
  stop('8 A の開口の前（行き止まり）から外', fA, 0.5, BED + 1.6, -46, 0, 0.05),
  stop('9 A の南の回廊から振り返る（水庭へ）', fA, 8, WALK + 1.6, -30, Math.PI),
  stop('10 C の日の当たる歩廊から北', fC, -6.5, C.walkTop + 1.6, -14, 0),
  stop('11 C の飛び石の脇（水の中）から門', fC, 0.3, BED + 1.6, -50, 0),
  stop('12 C の奥から振り返る', fC, -6.5, C.walkTop + 1.6, -62, Math.PI),
  stop('13 D の北の歩廊から西', fD, 4.5, D.walkTop + 1.6, -8, 0),
  stop('14 D の扉の前（行き止まり）から振り返る', fD, -1, BED + 1.6, -40, Math.PI),
  { label: '15 ポンプ室（低い所）', eye: [-43.5, -1.5 + 1.6, 26.5], yaw: Math.PI * 0.1, pitch: 0.05, fov: LENS },
  { label: '16 管理室（机と窓）', eye: [35.2, WALK + 1.6, 9.0], yaw: 0.62, fov: LENS },
  { label: '17 小部屋（住戸の 1 つ）', eye: [-21.6, 0.25 + 1.6, -31.5], yaw: -Math.PI * 0.7, fov: LENS },
  { label: '18 水庭の北東の角から南西（振り返り）', eye: [14, WALK + 1.6, -15], yaw: Math.PI * 0.75, fov: LENS },
];

export const plan: FloorPlan = {
  id: 'squareroom',
  title: '立方体の大広間と水路（浅い貯水池に建つ積層の集合体の地上階）',
  typology:
    '立方体の住戸（一辺 3〜4 m の打ち放しの箱）を 40〜50 m まで積み上げた巨大な集合住宅（Habitat 67・中銀カプセルタワー・九龍城の積層）が、' +
    '浅い貯水池（調整池）の上に建つ。地上は道の代わりに水路（水深 0.45 m・歩いて渡れる）と幅 1.5〜7 m の歩廊・柱の回廊で、' +
    '中央の四角い水庭（28 × 28 m）から 4 本の水路が風車形（卍）に外周の門へ延びる（風車形にすると、どの水路からも向かいの門が見通せない）。' +
    '型枠は 1.8 × 0.9 m の横長のパネル（セパの穴 3 × 2）。住戸の箱は歩廊の上 2.5〜4.5 m から水路へ張り出し、下は暗い。' +
    '水位を保つポンプ室・管理室・階段室が箱の中にある。外は霧の湖で、門の外は深い（行き止まり）。',
  spaces,
  openings,
  tour,
  notes: [
    '4 枚の参考画像は水路の幅（B 8.4 m・D 6.4 m・A 8.3 m・C 9 m）・岸の形（水盤と板石・排水の升のある歩廊・柱の回廊・飛び石）・色調がそれぞれ違うので、1 本の水路にまとめず 4 本に分けた。どれも中央の水庭を背にして外周の門を見る向き',
    '画角はどれも 45°（扉・歩廊の段・型枠の割付けから無理のない値）。目の高さは B が通りの床から 1.6 m、ほかは水路の底（-0.45）から 1.6 m（= 水面から 1.15 m。膝まで水に入って立つ）',
    'squareroom-0 の通りは手前が幅 8.4 m・奥ほど壁が下がって 18 m の前庭になる（参考画像の奥の壁の幅が手前より広い）。扉の下端と床の線の高さの差から奥行き 72 m',
    '日は南南東・高さ 35°（A の北の岸と C の低い箱の正面が明るい・B と D は日陰）。C の低い箱だけが明るく上の箱が暗い形は 1 つの日では作れないので、口の上に楣（12〜30 m）を置いて日を遮り、低い箱の正面と歩廊は日だまりの灯り（描いた光）にした',
    'A の右（南）の壁は、手前（画角の上の外）を高く・奥を 9.5 m に抑え、左の TL を日陰に、B2 の側面だけに日が届くようにした（参考画像の明暗）',
    '水路の口の上は高さ 12 m の楣（どの水路も門のように水庭へ入る）。参考画像の画角の外',
    '参考画像の門・扉の奥は明るいだけで何も写っていない: A・C は外の霧の湖（深い・行き止まり）、B・D の扉は閉じた光の中庭',
    '参考画像の画角の中は手で置いた塊だけ（目から 30〜40 m より手前）。奥と上と画角の外は決まりで積む（stack.ts）',
  ],
};
