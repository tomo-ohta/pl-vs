import type { FloorPlan, PlanSpace, V2 } from '../plan.ts';
import { HALL, hallRectW, LOCKER, PROM, PROM_CEIL, SHOWER, SOUTH_OPEN, SOUTH_OPEN_UP, UPPER, UPPER_Y, type HallId, type Rect } from './layout.ts';

/**
 * 地下のウォーターパークの間取り図。
 * 類型: 都市の大きな建物（ホテル・商業の複合施設）の地下 2 階にある屋内レジャープール（ウォーターパーク）。
 * 地上の受付からエレベーターで下り、更衣室・シャワー室を抜けて南の「プールサイドの通路」に出る。通路の北に 4 つの広間が東西に並ぶ
 * （西から B 流れの水路・A スライダーの大広間・C 円いプール・D 夕焼け）。どの広間も天井（9〜11 m）は空の絵、床は濡れたタイル。
 * 通路の上は 2 階の観覧通路（床 4.4 m）で、A の東の回廊・C と D の階段の上の観覧席とつながる。
 */
const W = (id: HallId, x: number, z: number): V2 => [HALL[id].o[0] + x, HALL[id].o[1] + z];
const R = (r: Rect): [number, number, number, number] => [r[0], r[1], r[2], r[3]];

/** 上の階の場所（広間より先に書く: 無作為の場所は最初に当たる場所に入るので、回廊の点が広間に数えられないように） */
const upperSpaces: PlanSpace[] = [
  { id: 'A-tower', label: 'A スライダーの塔の上', kind: 'platform', rect: [W('A', -2.4, -28.6)[0], W('A', -2.4, -28.6)[1], W('A', 1.6, -24.6)[0], W('A', 1.6, -24.6)[1]], floor: 6.9, ceiling: 10, level: 2, note: '桃色と白のスライダーの出発台。奥の踊り場（3.4 m）から階段で上がる。高い所から大広間を見下ろす' },
  {
    id: 'upper',
    label: '2 階の観覧通路と回廊',
    kind: 'corridor',
    poly: [
      [UPPER[0], PROM[3]],
      [UPPER[0], hallRectW('A')[1]],
      [16, hallRectW('A')[1]],
      [16, UPPER[1]],
      [17, UPPER[1]],
      [17, W('C', 0, -5)[1]],
      [W('C', -3, 0)[0], W('C', 0, -5)[1]],
      [W('C', -3, 0)[0], UPPER[1]],
      [W('D', 5, 0)[0], UPPER[1]],
      [W('D', 5, 0)[0], W('D', 0, -5)[1]],
      [UPPER[2], W('D', 0, -5)[1]],
      [UPPER[2], PROM[3]],
      [UPPER[0], PROM[3]],
    ],
    floor: UPPER_Y,
    ceiling: 8,
    level: 1,
    note: '通路の上の観覧通路（床 4.4 m）。A の東の回廊（4.5 m・ダクトの下）、C と D の階段の上の観覧席につながる',
  },

  { id: 'B-east', label: 'B 東の 2 階の回廊', kind: 'corridor', rect: [W('B', 17.6, -59.5)[0], W('B', 17.6, -59.5)[1], W('B', 22.5, -27)[0], W('B', 22.5, -27)[1]], floor: 4.5, ceiling: 11, level: 1, note: '水路の広間の東の壁沿いの監視用の回廊（北の行き止まり）。南の端の階段で上がる' },
  { id: 'A-west', label: 'A 西の低い回廊', kind: 'corridor', rect: [W('A', -17, -31.5)[0], W('A', -17, -31.5)[1], W('A', -14.9, -12)[0], W('A', -14.9, -12)[1]], floor: 3.6, ceiling: 6.8, level: 1, note: '西の壁沿いの監視用の回廊（上の点検通路の下・行き止まり）。西の着水プールの北から西へ上がる階段で' },
];

export const plan: FloorPlan = {
  id: 'waterpark',
  title: '地下のウォーターパーク（地下 2 階のプール階）',
  typology:
    '都市の複合施設の地下 2 階の屋内レジャープール。根拠: 屋内のウォータースライダーは高さ 8〜12 m・柱の間隔 8〜10 m・着水プールの水深 0.9〜1.1 m、' +
    '天井に空を描いた屋内プール（大型の屋内リゾートプールの「空の天井」）。更衣室とシャワーを抜けてプールサイドに出る動線、2 階の観覧席、設備のダクトは壁沿いの高い所。',
  spaces: [
    ...upperSpaces,
    { id: 'A', label: 'A スライダーの大広間', kind: 'hall', rect: R(hallRectW('A')), floor: 0, ceiling: HALL.A.ceil, note: '東西に 2 階の回廊（東 4.5 m・西 7.2 m は点検通路）、柱の上に投光器、奥に階段の塔。桃色と白の螺旋のスライダーと 3 つの着水プール' },
    { id: 'B', label: 'B 流れの水路の広間', kind: 'hall', rect: R(hallRectW('B')), floor: 0, ceiling: HALL.B.ceil, note: '西に低い天井のアーケード（扉の列は倉庫・救護室）、その東に北へ延びる水路、東に浅いプールと大きな樋のスライダー' },
    { id: 'C', label: 'C 円いプールの広間', kind: 'hall', rect: R(hallRectW('C')), floor: 0, ceiling: HALL.C.ceil, note: '西に南へ上がる階段（観覧席へ）とその下の低い水槽、東に円いプール、奥に柵のある板張りの段とスライダーの群れ' },
    { id: 'D', label: 'D 夕焼けの広間', kind: 'hall', rect: R(hallRectW('D')), floor: 0, ceiling: HALL.D.ceil, note: '西に大きなプール（腰の高さの縁）、まだらの幅広のスライダー、奥に筒の群れ、東に観覧席への階段。天井は夕焼けの雲と吊りの灯り' },
    { id: 'prom', label: '南のプールサイドの通路', kind: 'corridor', rect: R(PROM), floor: 0, ceiling: PROM_CEIL, note: '広間の南の壁の開口（視点の真後ろ）を結ぶ通路。ベンチ・自販機・案内板・ロッカーの返却箱' },
    { id: 'shower', label: 'シャワー室', kind: 'room', rect: R(SHOWER), floor: 0, ceiling: 3.0, note: '仕切りのあるシャワーの列と、腰洗いの浅い槽' },
    { id: 'locker', label: '更衣室', kind: 'room', rect: R(LOCKER), floor: 0, ceiling: 3.0, note: 'ロッカーの列とベンチ。南の扉（受付・エレベーターへ）は営業時間外で鍵（行き止まり）' },
  ],
  walls: [],
  openings: [
    ...(['A', 'B', 'C', 'D'] as HallId[]).map((id) => ({ kind: 'opening' as const, at: [(SOUTH_OPEN[id][0] + SOUTH_OPEN[id][1]) / 2, hallRectW(id)[3] + 0.25] as V2, width: SOUTH_OPEN[id][1] - SOUTH_OPEN[id][0], wall: 'x' as const, note: `${id} の南の開口（通路へ）` })),
    ...(['A', 'C', 'D'] as HallId[]).map((id) => ({ kind: 'opening' as const, at: [(SOUTH_OPEN_UP[id]![0] + SOUTH_OPEN_UP[id]![1]) / 2, hallRectW(id)[3] + 0.25] as V2, width: SOUTH_OPEN_UP[id]![1] - SOUTH_OPEN_UP[id]![0], wall: 'x' as const, level: 1, note: `${id} の 2 階の開口（観覧通路へ）` })),
    { kind: 'double-door', at: [0, 17.25], width: 3, wall: 'x', state: 'open', note: 'シャワー室の入口（通路から）' },
    { kind: 'opening', at: [0, 22.25], width: 3, wall: 'x', note: 'シャワー室 → 更衣室' },
    { kind: 'double-door', at: [0, 33.25], width: 2.4, wall: 'x', state: 'locked', note: '受付・エレベーターへ（営業時間外で鍵）' },
    { kind: 'stair', at: W('A', 2.2, -23), width: 1.4, wall: 'x', note: 'A 奥の踊り場（3.4 m）への階段' },
    { kind: 'stair', at: W('A', -12, -15), width: 1.2, wall: 'x', note: 'A 西の低い回廊（3.6 m）への階段' },
    { kind: 'stair', at: W('C', -5.8, -8.5), width: 2, wall: 'z', note: 'C の観覧席への階段' },
    { kind: 'stair', at: W('D', 7.5, -8.1), width: 1.8, wall: 'z', note: 'D の東の観覧席（4.4 m）への階段' },
    { kind: 'door', at: [W('B', -3.6, -11.6)[0], W('B', -3.6, -11.6)[1]], width: 1.1, wall: 'z', state: 'locked', note: 'B アーケードの扉（倉庫・救護室。鍵）' },
  ],
  tour: [
    { label: 'A 大広間の中ほどから南（入口の方）を振り返る', eye: [0, 1.6, -14], yaw: Math.PI },
    { label: 'A スライダーの塔の上から南西を見下ろす（高い所）', eye: [-0.4, 8.5, -26.4], yaw: Math.PI + 0.5, pitch: -0.35 },
    { label: 'A 東の回廊（4.5 m）から西', eye: [13.3, 6.1, -12], yaw: Math.PI / 2 },
    { label: 'A 西の低い回廊の北の行き止まりから広間を見下ろす', eye: [-15.8, 5.2, -30.4], yaw: -2.3, pitch: -0.2 },
    { label: 'A 西の着水プールの中（低い所）から北', eye: [-2.8, 0.7, -9.6], yaw: 0.55 },
    { label: '南の通路を東へ', eye: [-20, 1.6, 13.8], yaw: -Math.PI / 2 },
    { label: 'シャワー室', eye: [0, 1.6, 19.6], yaw: 0.4 },
    { label: '更衣室の奥（受付への扉・行き止まり）', eye: [0, 1.6, 26], yaw: Math.PI },
    { label: 'B 水路の北の端から南を振り返る', eye: [-32, 1.6, -52], yaw: Math.PI },
    { label: 'B アーケードの歩道を北へ（扉の列）', eye: [-42, 1.6, -18], yaw: 0 },
    { label: 'B 東の床・浅いプールの脇から西', eye: [-19, 1.6, 0], yaw: Math.PI / 2 + 0.3 },
    { label: 'B 東の 2 階の回廊（4.5 m）の北の行き止まりから南西', eye: [-19.0, 6.1, -55.0], yaw: Math.PI * 0.75, pitch: -0.15 },
    { label: '2 階の観覧通路を東へ', eye: [20, 6.0, 13], yaw: -Math.PI / 2 },
    { label: 'C 階段の上の観覧席から北を見下ろす', eye: [21.6, 6.0, 0.5], yaw: -0.35, pitch: -0.3 },
    { label: 'C 円いプールの脇から西', eye: [31.5, 1.6, -3], yaw: Math.PI / 2 },
    { label: 'C 仕切りの向こうの休憩所', eye: [35.4, 1.6, -6.5], yaw: 0.2 },
    { label: 'D 東の観覧席（4.4 m）から西の大きなプール', eye: [60.5, 6.0, 4], yaw: Math.PI / 2 + 0.3 },
    { label: 'D プールの縁から南を振り返る', eye: [59, 1.6, -12], yaw: Math.PI + 0.4 },
  ],
  notes: [
    '4 枚の参考画像は天井の雲の色（白灰・桃色・夕焼け）・スライダーの形・床の色（青・灰・桃色）が画像ごとに違う → 別々の広間（A〜D）にして、それぞれの画像を優先した',
    '4 枚とも縦の線がまっすぐで、地平線が画面の中央より下（建築写真のあおり補正）→ カメラは水平のまま投影を縦にずらす（cam.ts）。広間ごとに参考画像と同じずらし。歩くときは参考画像の視点から離れるほど弱める',
    '参考画像の奥・横に写っていない広間のつなぎ（南の開口・2 階の開口）は、どれも視点の目の真後ろ（参考画像には写らない）',
    'C（waterpark-2）の目の高さ 1.6 m・地平線 650 px は、柵・柱・壁の灯りの大きさが合う値（地平線を中央寄りにすると柵が 0.5 m の高さになる）',
    'A の奥の踊り場と塔の上（3.4 m・6.9 m）は、参考画像の奥の中央に写る明るい階段の上。塔からスライダーが出る',
    '天井の雲は参考画像の位置に「塊」を置き、形は手続きの玉の重なり（参考画像の画素は使わない）。参考画像の雲は「絵の上 = 雲の頭」なので、天井では頭が目の側を向く',
  ],
};
