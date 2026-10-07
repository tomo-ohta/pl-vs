/**
 * 屋内プール（建築版）の配置の数値。座標は場面と同じ（m。x 東・z 南・y 上。北 = -Z）。水面 y = 0、プールサイドの床 y = 0.15。
 * ホール A〜D は参考画像 pool-0〜3 の視点の足元（水面の高さ）を原点にした区域の座標で作り、ここで場面の座標へ置く（回さない）。
 * 壁は 1 m（ホールの間）・0.25 m（部屋の間仕切り）。部屋の rect は内側の寸法。
 */

export type Rect = [number, number, number, number];
export type HallId = 'A' | 'B' | 'C' | 'D' | 'E';

/** 水面・プールサイドの床の高さ */
export const WATER_Y = 0;
export const DECK_Y = 0.15;
/** 2 階（休憩ラウンジ）の床 */
export const UPPER_Y = 4.9;

/** ホールの原点（参考画像の視点の真下の水面）と、場面の座標での内側の範囲 */
export const HALL: Record<HallId, { o: [number, number]; rect: Rect; ceil: number; label: string }> = {
  // A: 流れの回廊（pool-0）。梁の下 3.45 m・天井 4.4 m。中島をめぐる流れるプール（1 周 約 80 m）と東の浅い段
  A: { o: [0, 0], rect: [-18, -36, 22, 12], ceil: 4.4, label: 'A 流れの回廊' },
  // B: 柱の森（pool-1）。浅い段々の池（0.3〜0.6 m）と 7.6 × 9 m の柱の升目。梁の格子の間に天窓
  B: { o: [27, 0], rect: [23, -40.5, 72.5, 6], ceil: 4.1, label: 'B 柱の森' },
  // C: 深いプールと洞窟の口（pool-2）。斜めの通路・観覧の段と階段・洞窟の水路の口
  C: { o: [-19, -59], rect: [-32, -85.5, -11, -50], ceil: 4.2, label: 'C 深いプールと洞窟の口' },
  // D: ガラス屋根の大広間（pool-3）。浅い池・台座つきの柱・段々のアーチの壁 3 枚・ガラスのかまぼこ屋根・洞窟の水路の口
  D: { o: [4, -43], rect: [-10, -68, 18, -37], ceil: 7.5, label: 'D ガラス屋根の大広間' },
  // E: 25 m プール（参考画像なし）。6 コース・幼児用プール・採暖室・観覧の段
  E: { o: [47, -58], rect: [23, -76, 72.5, -41.5], ceil: 6.0, label: 'E 25 m プール' },
};

export const HALL_IDS: HallId[] = ['A', 'B', 'C', 'D', 'E'];

/** 区域の座標 → 場面の座標 */
export function hallXZ(id: HallId, x: number, z: number): [number, number] {
  const o = HALL[id].o;
  return [o[0] + x, o[1] + z];
}

export type RoomKind =
  | 'lobby' // 入口・待合
  | 'office' // 事務室・受付の裏
  | 'staff' // スタッフ休憩室
  | 'guard' // 監視室（プールを見る窓・救助の道具）
  | 'aid' // 救護室
  | 'changing' // 更衣室
  | 'shower' // シャワー室（通過式）
  | 'toilet' // 便所
  | 'corridor' // 通路
  | 'plant' // 機械室（ろ過装置・ポンプ）
  | 'store' // 倉庫（プールの道具）
  | 'sauna' // 採暖室
  | 'lounge'; // 休憩ラウンジ

export interface DoorDef {
  /** 壁の向き: 'n' / 's' = z 一定の壁、'w' / 'e' = x 一定の壁 */
  side: 'n' | 's' | 'w' | 'e';
  /** 壁に沿った範囲（場面の座標の x か z） */
  a: number;
  b: number;
  /** 引き戸（自動ドア）・開き戸・開口・窓（通れない）・鍵 */
  kind: 'auto' | 'swing' | 'open' | 'window' | 'locked';
  /** ガラス（すりガラス）か */
  glass?: boolean;
  label?: string;
}

export interface RoomDef {
  id: string;
  label: string;
  kind: RoomKind;
  rect: Rect;
  /** 床・天井の高さ */
  floor: number;
  ceil: number;
  doors: DoorDef[];
  /** 区画（日の向き・見た目）。近いホール */
  zone: HallId;
  closed?: boolean;
  note?: string;
}

/**
 * 部屋。南の帯（z 13〜40）: 入口・更衣室・シャワー・監視室・事務・機械室。
 * A と C・D の間の通路（T）、B と南の帯の間（B の南の帯）、2 階のラウンジ（U）。
 */
export const ROOMS: RoomDef[] = [
  // ---- 南の帯 ----
  { id: 'guard', label: '監視室', kind: 'guard', rect: [-18, 13, -2.25, 21.75], floor: DECK_Y, ceil: 3.0, zone: 'A',
    doors: [{ side: 'n', a: -15.5, b: -5.5, kind: 'window', label: 'A を見る窓' }, { side: 'n', a: -4.2, b: -3.0, kind: 'swing', label: 'A へ' }, { side: 's', a: -9.0, b: -8.0, kind: 'swing' }] },
  { id: 'showerM', label: '男子シャワー室', kind: 'shower', rect: [-2, 13, 9.875, 19], floor: DECK_Y, ceil: 2.8, zone: 'A',
    doors: [{ side: 'n', a: 3.0, b: 5.0, kind: 'open', label: 'A へ' }, { side: 's', a: 3.0, b: 5.0, kind: 'open' }] },
  { id: 'showerW', label: '女子シャワー室', kind: 'shower', rect: [10.125, 13, 22, 19], floor: DECK_Y, ceil: 2.8, zone: 'A',
    doors: [{ side: 'n', a: 15.0, b: 17.0, kind: 'open', label: 'A へ' }, { side: 's', a: 15.0, b: 17.0, kind: 'open' }] },
  { id: 'changeM', label: '男子更衣室', kind: 'changing', rect: [-2, 19.25, 9.875, 33.75], floor: DECK_Y, ceil: 2.8, zone: 'A',
    doors: [{ side: 's', a: 1.0, b: 2.6, kind: 'swing', label: '通路から' }] },
  { id: 'changeW', label: '女子更衣室', kind: 'changing', rect: [10.125, 19.25, 22, 33.75], floor: DECK_Y, ceil: 2.8, zone: 'A',
    doors: [{ side: 's', a: 18.0, b: 19.6, kind: 'swing', label: '通路から' }] },
  { id: 'staff', label: 'スタッフ室', kind: 'staff', rect: [-18, 22, -9.75, 33.75], floor: DECK_Y, ceil: 2.8, zone: 'A',
    doors: [{ side: 's', a: -14.5, b: -13.5, kind: 'swing', label: '関係者' }] },
  { id: 'staffLocker', label: '職員更衣室（監視員の詰め所へ）', kind: 'changing', rect: [-9.5, 22, -2.25, 33.75], floor: DECK_Y, ceil: 2.8, zone: 'A',
    doors: [{ side: 's', a: -6.0, b: -5.0, kind: 'swing', label: '関係者' }] },
  { id: 'hallway', label: '通路（更衣室へ）', kind: 'corridor', rect: [-18, 34, 22, 37], floor: DECK_Y, ceil: 2.8, zone: 'A',
    doors: [{ side: 'e', a: 34.6, b: 36.4, kind: 'open', label: '入場ゲートから' }] },
  { id: 'entrance', label: 'エントランスホール', kind: 'lobby', rect: [22.25, 26, 46, 40], floor: DECK_Y, ceil: 3.6, zone: 'B',
    doors: [{ side: 's', a: 31.0, b: 37.0, kind: 'auto', glass: true, label: '正面入口' }] },
  { id: 'office', label: '事務室', kind: 'office', rect: [22.25, 13, 34, 25.75], floor: DECK_Y, ceil: 2.8, zone: 'B',
    doors: [{ side: 's', a: 25.0, b: 31.0, kind: 'window', label: '受付の窓口' }, { side: 's', a: 32.0, b: 33.0, kind: 'swing', label: '関係者' }] },
  { id: 'store', label: 'プール用具の倉庫', kind: 'store', rect: [34.25, 13, 46, 25.75], floor: DECK_Y, ceil: 2.8, zone: 'B',
    doors: [{ side: 's', a: 40.0, b: 42.0, kind: 'swing' }] },
  { id: 'plant', label: '機械室（ろ過装置・ポンプ・熱交換器）', kind: 'plant', rect: [46.25, 7, 72.5, 25.75], floor: DECK_Y, ceil: 4.0, zone: 'B',
    doors: [{ side: 'w', a: 20.0, b: 21.2, kind: 'swing', label: '倉庫から（関係者）' }, { side: 'n', a: 60.0, b: 61.5, kind: 'swing', label: 'B へ' }] },
  { id: 'boiler', label: 'ボイラー室・受水槽', kind: 'plant', rect: [46.25, 26, 72.5, 40], floor: DECK_Y, ceil: 4.0, zone: 'B', closed: true,
    doors: [{ side: 'w', a: 36.0, b: 37.2, kind: 'locked', label: 'エントランスから（関係者）' }] },
  // ---- B の南の帯（z 7〜13） ----
  { id: 'toiletB', label: 'プールサイドの便所', kind: 'toilet', rect: [23, 7, 31.75, 12.75], floor: DECK_Y, ceil: 2.8, zone: 'B',
    doors: [{ side: 'n', a: 26.0, b: 27.2, kind: 'swing' }] },
  { id: 'sauna', label: '採暖室', kind: 'sauna', rect: [32, 7, 46, 12.75], floor: DECK_Y, ceil: 2.6, zone: 'B',
    doors: [{ side: 'n', a: 38.0, b: 39.2, kind: 'swing', glass: true }] },
  // ---- A と C・D の間（T） ----
  { id: 'lobbyT', label: '休憩コーナー（A・C・D の間の通路）', kind: 'lobby', rect: [-25, -49, -11, -37], floor: DECK_Y, ceil: 3.2, zone: 'D',
    doors: [{ side: 's', a: -16.5, b: -14.0, kind: 'auto', glass: true, label: 'A へ' }, { side: 'e', a: -41.5, b: -39.0, kind: 'auto', glass: true, label: 'D へ' }, { side: 'n', a: -24.5, b: -22.0, kind: 'auto', glass: true, label: 'C へ' }] },
  { id: 'aid', label: '救護室', kind: 'aid', rect: [-32, -42.75, -25.25, -37], floor: DECK_Y, ceil: 3.0, zone: 'D',
    doors: [{ side: 'e', a: -40.6, b: -39.6, kind: 'swing' }] },
  { id: 'toiletT', label: '便所', kind: 'toilet', rect: [-32, -49, -25.25, -43], floor: DECK_Y, ceil: 3.0, zone: 'D',
    doors: [{ side: 'e', a: -46.6, b: -45.6, kind: 'swing' }] },
  // ---- D の東の通路（D と E の間） ----
  { id: 'service', label: '通路（D と E の間）', kind: 'corridor', rect: [19, -50, 22, -37], floor: DECK_Y, ceil: 3.0, zone: 'D',
    doors: [{ side: 'w', a: -40.5, b: -39.0, kind: 'auto', glass: true, label: 'D へ' }, { side: 'e', a: -46.5, b: -44.5, kind: 'auto', glass: true, label: 'E へ' }] },
  // ---- D の北（洞窟の水路の東・2 階のラウンジの下）: 関係者のみ ----
  { id: 'pump', label: 'ポンプ室（洞窟の水路の循環・ろ過）', kind: 'plant', rect: [7.25, -86, 18, -69.25], floor: DECK_Y, ceil: 4.3, zone: 'D', closed: true,
    doors: [{ side: 'n', a: 15.0, b: 16.2, kind: 'locked', label: '外から（関係者）' }] },
  { id: 'pumpW', label: '倉庫（洞窟の水路の西・ラウンジの下）', kind: 'store', rect: [-10, -86, 1.25, -69.25], floor: DECK_Y, ceil: 4.3, zone: 'D', closed: true,
    doors: [{ side: 'n', a: -6.0, b: -4.8, kind: 'locked', label: '外から（関係者）' }] },
  // ---- 2 階 ----
  { id: 'lounge', label: '2 階の休憩ラウンジ（軽食・展望）', kind: 'lounge', rect: [-10, -86, 18, -69], floor: UPPER_Y, ceil: 7.8, zone: 'D',
    doors: [
      { side: 'w', a: -82.5, b: -80.8, kind: 'auto', glass: true, label: 'C の観覧の階段から' },
      { side: 's', a: 13.5, b: 15.5, kind: 'auto', glass: true, label: 'D の 2 階の通路から' },
      { side: 'n', a: -8.5, b: -2.5, kind: 'window', label: '北の窓（洞窟の水路の屋根の上・外）' },
      { side: 'n', a: 0.5, b: 6.5, kind: 'window' },
      { side: 'n', a: 9.5, b: 15.5, kind: 'window' },
      { side: 'e', a: -84.0, b: -78.0, kind: 'window', label: '東の窓（外）' },
    ] },
];

/** A の西の屋外テラス（屋外プール。冬は閉めていて、プールにシートを掛けている）。A の西の壁のガラス戸から見える */
export const TERRACE: Rect = [-34, -30, -19, 2];

/** 洞窟の水路（D のトンネル → 北で西へ曲がる → C の洞窟の口）。泳いで通れる（足は着かない） */
export const CAVE = {
  /** D のトンネル（D の 3 枚目の壁から北へ） */
  tunnelX: [2.1, 6.3] as [number, number],
  tunnelZ: [-90.5, -62] as [number, number],
  /** 北の横の水路（東西） */
  crossZ: [-90.5, -86.5] as [number, number],
  crossX: [-22.2, 5.7] as [number, number],
  /** C の洞窟の口（C の北の壁から北へ） */
  mouthX: [-22.2, -18.2] as [number, number],
  mouthZ: [-90.5, -85.5] as [number, number],
};

/** 洞窟の上・D の北の機械室（ポンプ・ろ過装置。関係者のみ・鍵） */
export const PUMP: Rect = [-10, -86, 18, -69];

/**
 * ホールどうしの間の開口（部屋の扉は ROOMS の doors）。at = 開口の中心、wall = 'x'（z 一定の壁）/ 'z'（x 一定の壁）。
 * bottom < 0 は水の中まで開いた口（水がつながる。泳いで・歩いて通れる）
 */
export interface HallOpening {
  id: string;
  halls: [HallId, HallId];
  at: [number, number];
  wall: 'x' | 'z';
  width: number;
  bottom: number;
  top: number;
  kind: 'auto' | 'open' | 'window';
  label: string;
}

export const HALL_DOORS: HallOpening[] = [
  { id: 'AB-door', halls: ['A', 'B'], at: [22.5, 4.9], wall: 'z', width: 2.2, bottom: DECK_Y, top: DECK_Y + 2.3, kind: 'auto', label: 'A の入口のプールサイドから B の南のプールサイドへ（自動ドア）' },
  { id: 'AB-arch', halls: ['A', 'B'], at: [22.5, -15.25], wall: 'z', width: 4.5, bottom: -0.6, top: 2.6, kind: 'open', label: 'A の東の浅い段と B の池をつなぐ水の口（歩いて・泳いで通れる）' },
  { id: 'BE-door', halls: ['B', 'E'], at: [25.5, -41], wall: 'x', width: 2.0, bottom: DECK_Y, top: DECK_Y + 2.3, kind: 'auto', label: 'B の北西の前室（暗い青緑のタイル）から E（25 m プール）へ' },
  { id: 'A-terrace', halls: ['A', 'A'], at: [-18.5, -13.5], wall: 'z', width: 4.0, bottom: DECK_Y, top: 2.5, kind: 'window', label: 'A の西の壁のガラス戸（屋外テラスへ。冬は閉めている）' },
];
