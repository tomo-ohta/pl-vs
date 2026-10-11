import type { FloorPlan, PlanOpening, PlanSpace, PlanTourStop, V2 } from '../plan.ts';
import { BOOTH, CATWALK_Y, DOME, DOORS, DRUM_R, FLOOR, HOUSE, LOBBY, LOGE, PULPIT, RING, STAGE, TIERS, VIEW } from './layout.ts';

/**
 * プラネタリウム（大ドーム劇場）の間取り図。座標は場面と同じ（m。x 東・z 南・y 上。舞台の中心が原点）。
 * 作る前に決めた「現実にあったらどういう建物か」と、参考画像 1 枚の視点がどこにあるか・何が見えないか。
 */

const D2R = Math.PI / 180;
/** ドームの中心のまわりの円弧の帯（φ 度） */
function ring(r0: number, r1: number, p0: number, p1: number, n = 10): V2[] {
  const out: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const p = (p0 + ((p1 - p0) * i) / n) * D2R;
    out.push([DOME.cx + r1 * Math.sin(p), DOME.cz - r1 * Math.cos(p)]);
  }
  for (let i = n; i >= 0; i--) {
    const p = (p0 + ((p1 - p0) * i) / n) * D2R;
    out.push([DOME.cx + r0 * Math.sin(p), DOME.cz - r0 * Math.cos(p)]);
  }
  return out;
}
/** 舞台の中心のまわりの帯（角度 a ラジアン） */
function sector(r0: number, r1: (a: number) => number, a0: number, a1: number, n = 12): V2[] {
  const out: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const r = r1(a);
    out.push([r * Math.sin(a), -r * Math.cos(a)]);
  }
  for (let i = n; i >= 0; i--) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([r0 * Math.sin(a), -r0 * Math.cos(a)]);
  }
  return out;
}
function circle(cx: number, cz: number, r: number, n = 36): V2[] {
  return Array.from({ length: n }, (_, i): V2 => [cx + r * Math.sin((i / n) * Math.PI * 2), cz - r * Math.cos((i / n) * Math.PI * 2)]);
}
/** 舞台の中心から向き a のドラムの壁までの半径 */
function rWallA(a: number): number {
  const ux = Math.sin(a);
  const uz = -Math.cos(a);
  const uc = ux * DOME.cx + uz * DOME.cz;
  const c2 = DOME.cx * DOME.cx + DOME.cz * DOME.cz - DRUM_R * DRUM_R;
  return uc + Math.sqrt(Math.max(uc * uc - c2, 0));
}
const onRing = (r: number, deg: number): V2 => [DOME.cx + r * Math.sin(deg * D2R), DOME.cz - r * Math.cos(deg * D2R)];
/** ドームの中心のまわりの点から、回廊の向き（φ が増える向き）を向く yaw */
const alongYaw = (deg: number, dir = 1): number => {
  const t = (deg * D2R) + (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  // 進む向き (sin t, -cos t) → yaw（-Z が 0、左へ正）
  return Math.atan2(-Math.sin(t), Math.cos(t));
};
/** 点から点を向く yaw */
const lookYaw = (from: V2, to: V2): number => Math.atan2(-(to[0] - from[0]), -(to[1] - from[1]));

const spaces: PlanSpace[] = [
  { id: 'stage', label: '舞台（円形・大理石）', kind: 'platform', poly: circle(0, 0, STAGE.r), floor: STAGE.top, ceiling: 38, note: '照明の輪のスポットが当たる。演台・扉の前' },
  { id: 'floor', label: '平土間（机つきの席の弧・正面の劇場の椅子）', kind: 'hall', poly: circle(DOME.cx, DOME.cz, DRUM_R - 0.1, 48), floor: 0, ceiling: 40, note: '大きな床のタイル。席は舞台の中心のまわりの弧。通路の灯り・案内の板' },
  { id: 'back-tiers', label: '裏の段床（ベンチの席）', kind: 'stair', poly: sector(TIERS.back.r0, (a) => rWallA(a) - 0.1, TIERS.back.a0, TIERS.back.a1), floor: 0, ceiling: 40, note: '1 階の高さで横の通路、2 階の柱の回廊まで上がる。通路は半分の段' },
  { id: 'west-tiers', label: '北西の段床', kind: 'stair', poly: sector(1, (a) => rWallA(a) - 0.1, TIERS.west.a0, TIERS.west.a1).map((p, i, arr) => (i >= arr.length / 2 ? scaleTo(p, (a) => rWallA(a) - TIERS.west.depth) : p)), floor: 0, ceiling: 40, note: '壁ぎわの 9 段。上は 1 階の回廊へつながる' },
  { id: 'house', label: '舞台裏の前室（光る壁）', kind: 'room', rect: [HOUSE.x0 + 0.3, HOUSE.back + 0.3, HOUSE.x1 - 0.3, HOUSE.front - HOUSE.portalDepth - 0.3], floor: STAGE.top, ceiling: 3.4, note: '扉の向こうの光の前室。奥の下り階段（舞台の下の通路）は鍵' },
  { id: 'l1', label: '1 階の回廊（桟敷・全周）', kind: 'corridor', poly: ring(LOGE.l1R, DRUM_R, 0, 360, 48), floor: LOGE.l1, ceiling: LOGE.l2 - 0.45, level: 1, note: '手すりに小さな灯り。カメラのまわりは壁ぎわの細い通路' },
  { id: 'pulpit', label: '操作席の演台（参考画像の視点）', kind: 'platform', poly: circle(VIEW.eye[0], VIEW.eye[2], PULPIT.r, 16), floor: LOGE.l1, ceiling: CATWALK_Y - 1.2, level: 1, note: '丸い演台。手すりは目の下（画角の外）' },
  { id: 'l2', label: '2 階の柱の回廊（北〜東南東）', kind: 'corridor', poly: ring(DRUM_R - LOGE.l2Depth, DRUM_R, LOGE.l2Phi[0], LOGE.l2Phi[1], 20), floor: LOGE.l2, ceiling: LOGE.l2 + 3.4, level: 2, note: '柱・手すり・壁付け灯。裏の段床の上とつながる' },
  { id: 'booth', label: '投影室の塔（窓 3 本）', kind: 'service', poly: ring(DRUM_R - BOOTH.depth, DRUM_R, BOOTH.phi[0], BOOTH.phi[1], 8), floor: BOOTH.y0, ceiling: BOOTH.y1, level: 3, closed: true, note: '壁から張り出す。輪の通路はこの両脇で塔に入る' },
  { id: 'catwalk', label: '輪の通路（ドームの下端）', kind: 'void', poly: ring(DOME.R, DRUM_R, 0, 360, 48), floor: CATWALK_Y, level: 3, closed: true, note: '手すり・小さな灯りの帯。入れない（保守用）' },
  ...[
    [-20, 70],
    [70, 160],
    [160, 250],
    [250, 340],
  ].map(([p0, p1], i): PlanSpace => ({ id: `ring1-${i}`, label: `1 階の回廊（ホワイエ）${['北東', '南東', '南西', '北西'][i]}`, kind: 'corridor', poly: ring(RING.wallOut, RING.r1, p0, p1, 10), floor: 0, ceiling: RING.ceil1, note: '壁柱・腰の帯・天井の灯り・掲示と展示のケース・長椅子' })),
  ...[
    [-20, 70],
    [70, 160],
    [160, 250],
    [250, 340],
  ].map(([p0, p1], i): PlanSpace => ({ id: `ring2-${i}`, label: `2 階の回廊 ${['北東', '南東', '南西', '北西'][i]}`, kind: 'corridor', poly: ring(RING.wallOut, RING.r2, p0, p1, 10), floor: RING.floor2, ceiling: RING.ceil2, level: 1, note: '1 階の桟敷への出入口。玄関ホールの上は吹き抜けの手すり' })),
  { id: 'lobby', label: '玄関ホール（吹き抜け・券売所・展示）', kind: 'hall', rect: [LOBBY.x0, LOBBY.z0, LOBBY.x1, LOBBY.z1], floor: 0, ceiling: LOBBY.ceil, note: '南のガラスの玄関（閉じている・外は夜）。東の階段で 2 階の回廊へ' },
];
function scaleTo(p: V2, r: (a: number) => number): V2 {
  const a = Math.atan2(p[0], -p[1]);
  const rr = r(a);
  return [rr * Math.sin(a), -rr * Math.cos(a)];
}

const doorOpenings: PlanOpening[] = [
  ...DOORS.ground.map((deg): PlanOpening => ({ kind: 'opening', at: onRing(DRUM_R + 0.3, deg), width: DOORS.w, wall: deg * D2R, state: 'open', note: '平土間 ↔ 1 階の回廊' })),
  ...DOORS.upper.map((deg): PlanOpening => ({ kind: 'opening', at: onRing(DRUM_R + 0.3, deg), width: DOORS.w, wall: deg * D2R, state: 'open', level: 1, note: '1 階の桟敷 ↔ 2 階の回廊' })),
  { kind: 'opening', at: [-0.8, HOUSE.front - HOUSE.portalDepth - 0.15], width: 1.25, wall: 'x', state: 'open', note: '光る扉（舞台裏の前室）' },
  { kind: 'door', at: [HOUSE.x1 - 1.3, HOUSE.back + 0.35], width: 1.2, wall: 'x', state: 'locked', note: '舞台の下の通路への下り階段' },
  { kind: 'double-door', at: [(LOBBY.x0 + LOBBY.x1) / 2, LOBBY.z1], width: 9, wall: 'x', state: 'closed', note: '玄関（夜は閉じている）' },
  { kind: 'stair', at: [LOBBY.x1 - 1.2, LOBBY.z1 - 4], width: 2.4, wall: 'z', state: 'open', note: '玄関ホールの階段（2 階の回廊へ）' },
];

const eye = (p: V2, y: number): [number, number, number] => [p[0], y, p[1]];

const tour: PlanTourStop[] = [
  { label: '1 操作席の演台から振り返る（壁ぎわの細い通路と 2 階の回廊への出入口）', eye: VIEW.eye, yaw: VIEW.yaw + Math.PI * 0.85, pitch: 0.05, fov: 60 },
  { label: '2 1 階の桟敷（東）から舞台', eye: eye(onRing(DRUM_R - 0.9, 100), LOGE.l1 + 1.6), yaw: lookYaw(onRing(DRUM_R - 0.9, 100), [0, 0]), pitch: -0.12, fov: 60 },
  { label: '3 平土間の通路（正面の塊の脇）から舞台（低い所）', eye: [2.6, 1.6, 15.5], yaw: lookYaw([2.6, 15.5], [0, 0]), pitch: -0.02, fov: 60 },
  { label: '4 舞台の上から客席と演台を振り返る', eye: [0.5, STAGE.top + 1.6, 2.5], yaw: lookYaw([0.5, 2.5], [VIEW.eye[0], VIEW.eye[2]]), pitch: 0.06, fov: 60 },
  { label: '5 裏の段床の上（2 階の柱の回廊）から舞台を見下ろす（高い所）', eye: eye(onRing(DRUM_R - 1.1, 40), LOGE.l2 + 1.6), yaw: lookYaw(onRing(DRUM_R - 1.1, 40), [0, 0]), pitch: -0.25, fov: 60 },
  { label: '6 西の机つきの席の弧（平土間）', eye: [-13.2, 1.6, 11.86], yaw: lookYaw([-13.2, 11.86], [-24, -2]), pitch: 0.05, fov: 60 },
  { label: '7 北西の段床の上（1 階の回廊の高さ）から見下ろす', eye: eye(onRing(DRUM_R - 1.0, 285), LOGE.l1 + 1.6), yaw: lookYaw(onRing(DRUM_R - 1.0, 285), [0, 0]), pitch: -0.18, fov: 60 },
  { label: '8 光る扉の前室（舞台裏・行き止まり。奥の扉は鍵）', eye: [-0.6, STAGE.top + 1.6, -10.4], yaw: 0, pitch: -0.05, fov: 60 },
  { label: '9 1 階の回廊（ホワイエ）東', eye: eye(onRing((RING.wallOut + RING.r1) / 2, 92), 1.6), yaw: alongYaw(92, -1), pitch: 0, fov: 60 },
  { label: '10 1 階の回廊 北（舞台裏の側・行き止まりの無い一周）', eye: eye(onRing((RING.wallOut + RING.r1) / 2, 10), 1.6), yaw: alongYaw(10, 1), pitch: 0, fov: 60 },
  { label: '11 玄関ホール（券売所・展示の地球儀）から北', eye: [-13, 1.6, 44.5], yaw: lookYaw([-13, 44.5], [-11, 30]), pitch: 0.08, fov: 60 },
  { label: '12 玄関ホールの階段の上（2 階の渡り廊下）から吹き抜け', eye: [LOBBY.x1 - 1.2, LOGE.l1 + 1.6, 37], yaw: lookYaw([LOBBY.x1 - 1.2, 37], [-20, 44]), pitch: -0.2, fov: 60 },
  { label: '13 2 階の回廊 西', eye: eye(onRing((RING.wallOut + RING.r2) / 2, 268), LOGE.l1 + 1.6), yaw: alongYaw(268, -1), pitch: 0, fov: 60 },
  { label: '14 2 階の回廊から 1 階の桟敷へ出る出入口', eye: eye(onRing(RING.wallOut + 1.6, 232), LOGE.l1 + 1.6), yaw: lookYaw(onRing(RING.wallOut + 1.6, 232), [DOME.cx, DOME.cz]), pitch: 0, fov: 60 },
  { label: '15 平土間の南西の壁ぎわ（1 階の桟敷の下・暗い所）', eye: eye(onRing(DRUM_R - 1.0, 205), 1.6), yaw: alongYaw(205, 1), pitch: 0.05, fov: 60 },
  { label: '16 投影室の塔の下から見上げる（平土間の東）', eye: eye(onRing(DRUM_R - 2.5, 105), 1.6), yaw: lookYaw(onRing(DRUM_R - 2.5, 105), onRing(DRUM_R, 122)), pitch: 0.55, fov: 60 },
];

export const plan: FloorPlan = {
  id: 'planetarium',
  title: 'プラネタリウム（大ドーム劇場）: 科学館の直径 53 m のドーム劇場（投影ドーム・舞台・階段席・桟敷）',
  typology: [
    '類型: 科学館のドーム劇場（プラネタリウム兼の多目的ホール）。ドラム（円筒の壁・内径 53.2 m）の上に投影ドーム（内径 53.2 m・ドームの下端 14.9 m・頂部 41.5 m）が載る。',
    '参考: 大型プラネタリウムのドームは直径 20〜35 m（名古屋市科学館 35 m）。これを催し物にも使う劇場として一回り大きくした（参考画像の「巨大な」印象）。',
    '投影は輪（ドームの下端）の通路と投影室の塔から（今の全天の投影は縁に並べた投影機で行う）。昔の星の投影機（2 つの星の球）は舞台の裏の塔の上に展示として残す。',
    '舞台（直径 16.2 m・高さ 0.3 m）はドームの中心から東へ 12.4 m 寄る: 西の広い平土間を机つきの席（講座・観望会）に使うため。舞台の裏（北東）は急な段床（2 階の高さまで）。',
    '客席: 平土間（大きな床のタイル）に舞台の中心のまわりの弧。正面の塊は劇場の椅子（列の間 0.95 m）、東西は机つきの席の弧（列の間 2.05 m）。北西の壁ぎわに 9 段の段床。',
    '階段席は 1 段 0.4 m（踏み面 0.62〜0.85 m）。通路は半分の段（0.2 m）にして上れる。桟敷: 1 階（3.6 m・全周）・2 階（6.8 m・北〜東南東・柱の回廊）。',
    'ドラムのまわり: 1 階の回廊（ホワイエ・幅 5 m・天井 3.2 m）と 2 階の回廊（幅 4.2 m）。南の玄関ホール（吹き抜け 7.2 m・券売所・展示・階段）。舞台の裏の塔の中は光る壁の前室（舞台の下への階段は鍵）。',
    '照明: ドームの中心の下に吊った照明の輪（30 m）からのスポット（舞台と裏の段床。煙に光の筋）と洗い、ドームの映像の光（上から広く）、回廊の手すり・壁付け灯・通路の足もとの小さな灯り。',
  ].join(''),
  spaces,
  walls: [
    { a: [LOBBY.x0, LOBBY.z1], b: [LOBBY.x1, LOBBY.z1] },
    { a: [LOBBY.x0, LOBBY.z0], b: [LOBBY.x0, LOBBY.z1] },
    { a: [LOBBY.x1, LOBBY.z0], b: [LOBBY.x1, LOBBY.z1] },
    { a: [HOUSE.x0, HOUSE.front], b: [HOUSE.x1, HOUSE.front] },
    { a: [HOUSE.x0, HOUSE.back], b: [HOUSE.x1, HOUSE.back] },
    { a: [HOUSE.x0, HOUSE.front], b: [HOUSE.x0, HOUSE.back] },
    { a: [HOUSE.x1, HOUSE.front], b: [HOUSE.x1, HOUSE.back] },
  ],
  openings: doorOpenings,
  tour,
  notes: [
    '参考画像は 1 枚。カメラは舞台の楕円・扉の高さ（2.1 m）・近くの席の幅（0.6 m）から画角 60.5°（焦点距離 700 画素）を選び、舞台と扉に当てはめて目の位置を解いた（舞台の楕円の形だけだと画角 33° の遠い視点になるが、近くの席・ドームの曲がりと合わないので広い画角を採った）。',
    '輪（ドームの下端の手すり）の曲線は y = 16 の円に当てはまり（ずれ 0.6 m）、その円はカメラのほぼ真上を通る → カメラはドラムの壁ぎわ（1 階の桟敷）に立つ。経線のリブは 48 本（輪の上の位置が 3 画素以内で合う）。',
    '参考画像では舞台はドームの中心と合っていない（輪の一番低い所が舞台より左）。現実の説明: 舞台を東へ寄せて西に広い平土間を取った劇場（typology）。',
    '参考画像の右上の暗い所は、ドラムの壁から張り出した投影室の塔（輪の通路はこの両脇で塔に入る）。窓（縦の 3 本の光）は塔の面の 13〜14 m。',
    '参考画像の「レンズ形の明るい所」と両側の暗い帯: 照明の輪のスポットの光が煙に見える円錐（2 本の輪郭の線に接する円錐。開き角 2×19.9°）。右下の「膝」（段床と柱の回廊の明るい所）は 2 つ目の洗いの照明（煙の筋は見せない）。現実離れ: 筋の縁の暗い帯は煙が光を吸う帯として描いた。',
    'カメラの前の手すりは画角の外（目の下 0.6 m・前 0.75〜1 m の丸い演台）。1 階の桟敷はカメラのまわり（φ ±22°）だけ壁ぎわの細い通路にした（参考画像の右下に近くの手すりが写らない）。右の灯りの列は離れた所の桟敷の手すり。',
    '参考画像に写っていない所（カメラの後ろ・ドラムの外の回廊・玄関ホール・前室）は、画像の光の言葉（暗い青・小さな暖かい灯り・光の当たる所だけ明るい）で作った。外はどこも夜（玄関のガラスは暗い）。',
  ],
};

void FLOOR;
