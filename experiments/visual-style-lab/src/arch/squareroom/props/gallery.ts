import type { GallerySpec } from '../../../props/gallery.ts';
import type { Prop, PropEntry } from '../../../props/kit.ts';
import { chair, steelShelf } from '../../../props/lib/index.ts';
import { concreteBench, hoseCabinet, pendantLamp, pipeRailing, planterTrough, rooftopUnit, steelDoor, tubeLight, ventStack, wallLamp, wallVent } from './fixtures.ts';
import { cableTray, controlPanel, gateValve, gaugeBoard, hoistBeam, pipeRun, pumpSet, waterTank } from './machines.ts';
import { SC, sqPropMats } from './mats.ts';
import { grassClump, grassTuft, ivyCurtain, mossCushion, shrub, shrubClump } from './plants.ts';
import { bed, coatRail, crate, duct, filingCabinet, noticeBoard, officeDesk, pictureFrame, radiator, smallDesk, wallClock, wallShelf, wardrobe, washBasin, workbench } from './room.ts';
import { bollard, bulkheadLamp, catLadder, conduitRun, downpipe, meterCabinet, signPlate, windowGrille } from './wall.ts';
import { chippedBlock, debrisCluster, drainGrate, gaugeStaff, mooringRing, skiff, waterLadder } from './water.ts';

/**
 * 立方体の大広間の小物の見本帳（props.html の squareroom）。場面で使う小物を全部、場所の材質で並べる。
 * 壁に付ける物は後ろに小さな壁、水まわりの物は歩廊の縁の段を置いて見せる
 */
const wall = (p: Prop, w: number, h = 2.8): void => p.box(SC.concMid, [-w / 2, 0, -0.3], [w / 2, h, 0]);
/** 歩廊の縁（上面 y = h、水の側は z = 0） */
const edge = (p: Prop, w: number, h: number): void => p.box(SC.conc, [-w / 2, 0, -1.0], [w / 2, h, 0]);

export function gallery(): GallerySpec {
  const entries: PropEntry[] = [
    // ---- 水まわり ----
    { id: 'step', label: '飛び石（欠けた打ち放しの塊・苔）', size: [2.1, 0.75, 1.6], build: (p) => chippedBlock(p, 2.1, 0.75, 1.6, { moss: 0.8, waterline: 0.45 }) },
    { id: 'debris', label: '水の中の瓦礫', size: [2.4, 0.6, 1.6], build: (p) => debrisCluster(p.sub([0, 0.2, 0]), 6) },
    { id: 'ring', label: '係留の環', size: [0.5, 0.5, 0.5], build: (p) => { edge(p, 0.6, 0.3); mooringRing(p.sub([0, 0.3, -0.12])); } },
    { id: 'ladder', label: '水へ下りるはしご', size: [0.8, 1.6, 1.2], build: (p) => { edge(p, 1.0, 0.75); waterLadder(p.sub([0, 0.75, 0]), 0.75); } },
    { id: 'grate', label: '排水の格子', size: [0.8, 0.1, 0.6], build: (p) => drainGrate(p.sub([0, 0.01, 0])) },
    { id: 'gauge', label: '水位標', size: [0.4, 2.5, 0.4], build: (p) => gaugeStaff(p.sub([0, 0.0, 0]), 2.4, 0) },
    { id: 'skiff', label: '小舟（平底の作業舟）', size: [1.3, 0.6, 3.8], build: (p) => skiff(p) },
    // ---- 建物の設備 ----
    { id: 'lamp', label: '壁の腕木の灯り', size: [0.6, 2.8, 0.5], build: (p) => { wall(p, 0.8); wallLamp(p, 2.3); } },
    { id: 'door', label: '鉄の扉', size: [1.4, 2.4, 0.4], build: (p) => { wall(p, 1.6); steelDoor(p, 1.0, 2.2); } },
    { id: 'vent', label: '壁の換気口', size: [0.6, 2.0, 0.3], build: (p) => { wall(p, 0.8, 2.0); wallVent(p.sub([0, 1.6, 0])); } },
    { id: 'railing', label: 'パイプの手すり（3 m）', size: [3.0, 1.1, 0.2], build: (p) => pipeRailing(p, 3.0) },
    { id: 'bench', label: '打ち放しの長椅子', size: [2.4, 0.5, 0.5], build: (p) => concreteBench(p) },
    { id: 'pendant', label: '天井の吊り灯', size: [0.5, 2.6, 0.5], build: (p) => pendantLamp(p, 2.6, 0.8) },
    // ---- ポンプ室・管理室 ----
    { id: 'pump', label: '排水ポンプの組', size: [1.9, 1.2, 0.9], build: (p) => pumpSet(p) },
    { id: 'pipe', label: '配管とフランジ', size: [3.0, 1.6, 0.4], build: (p) => pipeRun(p, [[-1.5, 0.4, 0], [0.6, 0.4, 0], [0.6, 1.6, 0], [1.5, 1.6, 0]]) },
    { id: 'valve', label: '仕切弁', size: [0.6, 0.9, 0.5], build: (p) => { pipeRun(p, [[-0.6, 0.3, 0], [0.6, 0.3, 0]]); gateValve(p.sub([0, 0.3, 0])); } },
    { id: 'panel', label: '制御盤', size: [1.2, 2.0, 0.5], build: (p) => controlPanel(p) },
    { id: 'tank', label: '水槽', size: [1.8, 2.7, 1.8], build: (p) => waterTank(p, 0.8, 2.2) },
    { id: 'desk', label: '事務机（書類・台帳・電気スタンド）', size: [1.4, 1.2, 0.7], build: (p) => officeDesk(p) },
    { id: 'chair', label: '事務椅子', size: [0.6, 1.1, 0.6], build: (p) => chair(p, { kind: 'office', seat: SC.binder, frame: SC.steelDark, base: SC.steelDark }) },
    { id: 'shelf', label: '棚（台帳・ファイル・紙の束）', size: [1.2, 1.8, 0.45], build: (p) => steelShelf(p, { frame: SC.steel, load: ['binders', 'paper', 'binders', 'bins'], colors: [SC.binder, SC.binder2, SC.paper, SC.paintPale] }) },
    { id: 'clock', label: '壁の時計', size: [0.5, 2.6, 0.2], build: (p) => { wall(p, 0.6); wallClock(p.sub([0, 2.1, 0])); } },
    // ---- 歩廊の壁の設備（3 回目） ----
    { id: 'conduit', label: '電線管・継ぎ箱・スイッチ', size: [2.4, 3.2, 0.3], build: (p) => { wall(p, 2.6, 3.2); conduitRun(p, 2.4, 2.9, { boxEvery: 1.2, drops: [0.6] }); } },
    { id: 'downpipe', label: '竪樋（集水器・留め金具・下の曲がり）', size: [0.6, 3.6, 0.5], build: (p) => { wall(p, 0.8, 3.6); downpipe(p, 3.3); } },
    { id: 'catladder', label: '壁のはしご（背かご）', size: [0.9, 4.2, 0.8], build: (p) => { wall(p, 1.0, 4.2); catLadder(p, 4.2, 0); } },
    { id: 'meter', label: '計器の箱', size: [0.7, 2.6, 0.3], build: (p) => { wall(p, 0.9, 2.6); meterCabinet(p, 0.9); } },
    { id: 'bollard', label: '係船柱', size: [0.4, 0.5, 0.4], build: (p) => bollard(p) },
    { id: 'grille', label: '窓の格子と番号の札・戸口の灯り', size: [1.4, 2.6, 0.3], build: (p) => { wall(p, 1.6, 2.6); windowGrille(p, 0.9, 1.2, 1.0); signPlate(p.sub([0.65, 0, 0]), 1.6, 0.2, 0.14); bulkheadLamp(p, 2.4); } },
    { id: 'tube', label: '天井の蛍光灯', size: [1.5, 0.5, 0.3], build: (p) => tubeLight(p, 1.5, 0.4, 0.3) },
    { id: 'hose', label: '消火栓の箱', size: [0.7, 2.0, 0.3], build: (p) => { wall(p, 0.9, 2.0); hoseCabinet(p, 0.9); } },
    { id: 'rooftop', label: '屋上の室外機と換気の筒', size: [1.6, 1.8, 0.6], build: (p) => { rooftopUnit(p.sub([-0.3, 0, 0])); ventStack(p.sub([0.6, 0, 0]), 1.4); } },
    { id: 'planter', label: '植え込みの箱（笠木・水抜きと染み・土・低木の塊と草）', size: [2.4, 1.1, 0.7], build: (p) => { planterTrough(p, 2.4, 0.65, 0.55); shrubClump(p.sub([-0.75, 0.39, 0]), 0.8, 0.55); grassClump(p.sub([0, 0.39, 0]), 0.4, 0.5); shrubClump(p.sub([0.75, 0.39, 0], 1.3), 0.7, 0.5); } },
    // ---- 部屋の家具（3 回目） ----
    { id: 'bed', label: '鉄の寝台', size: [0.9, 0.9, 2.0], build: (p) => bed(p) },
    { id: 'basin', label: '洗面台と鏡', size: [0.6, 2.0, 0.5], build: (p) => { wall(p, 0.8, 2.0); washBasin(p); } },
    { id: 'shelf2', label: '壁の棚板（本・瓶）', size: [1.1, 2.0, 0.3], build: (p) => { wall(p, 1.2, 2.0); wallShelf(p, 1.1, 1.5); } },
    { id: 'desk2', label: '小さな机（本・湯呑み・灯り）', size: [1.0, 1.2, 0.6], build: (p) => smallDesk(p) },
    { id: 'filing', label: '書類の引き出しの棚', size: [0.5, 1.4, 0.65], build: (p) => filingCabinet(p) },
    { id: 'notice', label: '掲示板', size: [1.2, 2.0, 0.1], build: (p) => { wall(p, 1.4, 2.0); noticeBoard(p, 1.5); } },
    { id: 'radiator', label: '放熱器', size: [1.0, 1.0, 0.2], build: (p) => { wall(p, 1.2, 1.0); radiator(p); } },
    { id: 'coat', label: '外套掛け（上着・鞄）', size: [0.9, 2.0, 0.4], build: (p) => { wall(p, 1.1, 2.0); coatRail(p); } },
    { id: 'picture', label: '額', size: [0.6, 2.0, 0.1], build: (p) => { wall(p, 0.8, 2.0); pictureFrame(p, 1.6); } },
    { id: 'crate', label: '木の箱', size: [0.6, 0.7, 0.45], build: (p) => { crate(p); crate(p.sub([0, 0.4, 0], 0.3), 0.45, 0.3, 0.36); } },
    { id: 'wardrobe', label: '洋服の箪笥', size: [1.0, 2.2, 0.6], build: (p) => wardrobe(p) },
    { id: 'workbench', label: '作業台（万力・工具箱・工具掛け）', size: [1.8, 2.0, 0.8], build: (p) => { wall(p.sub([0, 0, -0.35]), 1.9, 2.0); workbench(p); } },
    { id: 'duct', label: '天井の風道', size: [2.6, 0.9, 0.6], build: (p) => duct(p, 2.6, 0.2) },
    { id: 'gauges', label: '圧力計の板', size: [0.9, 2.0, 0.2], build: (p) => { wall(p, 1.1, 2.0); gaugeBoard(p, 1.5); } },
    { id: 'tray', label: '電線の受け皿', size: [2.0, 2.4, 0.5], build: (p) => { wall(p, 2.2, 2.4); cableTray(p, 2.0, 2.1); } },
    { id: 'hoist', label: '吊り上げの梁と鎖の巻き上げ機', size: [2.4, 2.6, 0.3], build: (p) => hoistBeam(p, 2.4, 2.3, 0.2) },
    // ---- 植物 ----
    { id: 'grass', label: '草の株', size: [0.5, 0.3, 0.5], build: (p) => grassTuft(p) },
    { id: 'moss', label: '苔', size: [0.7, 0.1, 0.6], build: (p) => mossCushion(p) },
    { id: 'shrub', label: '茂み（高い箱の上）', size: [1.3, 1.0, 1.0], build: (p) => shrub(p) },
    { id: 'ivy', label: '垂れ下がる蔦', size: [1.6, 2.8, 0.3], build: (p) => { wall(p, 1.8); ivyCurtain(p.sub([0, 2.8, 0]), 1.6, 2.4); } },
  ];
  return {
    label: '立方体の大広間と水路',
    styleFrom: 'squareroom',
    mats: (ctx) => sqPropMats(ctx),
    entries,
    floor: SC.concMid,
    wall: SC.concDark,
  };
}
