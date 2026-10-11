import * as THREE from 'three';
import type { GallerySpec } from '../../../props/gallery.ts';
import { Prop, type PropEntry } from '../../../props/kit.ts';
import { chair, extinguisher, steelShelf, trashBin } from '../../../props/lib/index.ts';
import { doorLeaf, SHELF_COLORS } from '../interior.ts';
import { wrPropMats } from './mats.ts';
import { bucketBroom, crateStack, darkDoor, downpipe, drain, elecBox, louverDoor, parkBench, planter, roofDrain, roofHatch, slabBench, spout, trough, ventPipe, wallLamp, wheelbarrow, window } from './court.ts';
import { blackboard, bookcase, coatRail, cot, jar, keyBoard, lectern, longTable, noticeBoard, radiator, schoolDesk, servingCounter, sink, tableTop, toolWall, wallClock, wallCross, wallMap, workbench } from './rooms.ts';

/**
 * whiteroom（白いコンクリートの中庭の修道院）の小物の見本帳（props.html）。この場所で使う物を全部、この場所の材質で並べる。
 * 壁に付ける物（扉・窓・灯り・配電の箱・掲示板・黒板・掛け具）は後ろに壁の板を立てる。
 * 撮る: node tools/capture.mjs --page props.html --tour whiteroom
 */

/** 壁に付ける物の後ろの板（場面の壁の色） */
function backWall(p: Prop, w: number, h: number): void {
  p.box('#b0c5b7', [-w / 2, 0, -0.08], [w / 2, h, 0]);
}

const entries: PropEntry[] = [
  { id: 'bench-a', label: '背なしの長いベンチ（A 回廊の中庭）', size: [2.26, 0.43, 0.4], build: (p) => slabBench(p, 2.26) },
  { id: 'bench-c', label: '背なしのベンチ（C・細い脚）', size: [1.75, 0.43, 0.4], build: (p) => slabBench(p, 1.75, { legs: 'post' }) },
  { id: 'bench-b', label: '背もたれのベンチ（B 庇の中庭）', size: [1.63, 0.64, 0.52], build: (p) => parkBench(p, 1.63) },
  { id: 'bench-walk', label: '回廊の腰掛け', size: [2.2, 0.43, 0.4], build: (p) => slabBench(p, 2.2, { dark: '#3d4f49', top: '#566b63' }) },
  {
    id: 'louver-door',
    label: '換気の格子の白い鉄の扉（B 突き当たり）',
    size: [1.2, 2.6, 0.2],
    build: (p) => {
      backWall(p, 1.3, 2.7);
      louverDoor(p, 0.83, 2.39);
    },
  },
  {
    id: 'dark-door',
    label: '暗い鉄の扉（鍵の扉）',
    size: [1.2, 2.3, 0.2],
    build: (p) => {
      backWall(p, 1.3, 2.4);
      darkDoor(p, 0.92, 2.08, { panels: 2 });
    },
  },
  {
    id: 'door-leaf',
    label: '近づくと開く扉の板',
    size: [1.0, 2.2, 0.1],
    build: (p) => {
      const g = doorLeaf(p.mats, 0.95, 2.1, '#2a3c39');
      // 見本帳では板の形を Prop の出し先へ写す
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) p.sink.add(m.geometry.clone().applyMatrix4(new THREE.Matrix4().makeTranslation(-0.475, 0, 0)).applyMatrix4(p.m), m.material as THREE.Material, true);
      });
    },
  },
  {
    id: 'window',
    label: '窓（淡い枠・暗いガラス・格子あり / なし）',
    size: [2.0, 1.4, 0.2],
    build: (p) => {
      backWall(p, 2.2, 1.6);
      window(p.sub([-0.55, 0.3, 0.085]), 0.9, 0.9, { depth: 0.07 });
      window(p.sub([0.55, 0.3, 0.085]), 0.9, 0.9, { depth: 0.07, bars: 3 });
    },
  },
  {
    id: 'wall-lamp',
    label: '壁の腕木の灯り',
    size: [0.4, 2.0, 0.3],
    build: (p) => {
      backWall(p, 0.6, 2.2);
      wallLamp(p.sub([0, 1.8, 0]));
    },
  },
  {
    id: 'elec-box',
    label: '配電の箱と配管',
    size: [0.5, 1.5, 0.2],
    build: (p) => {
      backWall(p, 0.7, 1.6);
      elecBox(p);
    },
  },
  { id: 'drain', label: '床の排水の格子', size: [0.6, 0.05, 0.6], build: (p) => drain(p, 0.5, 0.5) },
  { id: 'planter', label: 'コンクリートの植木鉢（枯れかけた草）', size: [0.9, 0.9, 0.9], build: (p) => planter(p, 0.9) },
  { id: 'trough', label: '石の洗い場と蛇口', size: [1.4, 1.1, 0.6], build: (p) => trough(p, 1.4) },
  { id: 'crates', label: '積んだ木箱', size: [0.9, 1.3, 0.65], build: (p) => crateStack(p, 3) },
  { id: 'wheelbarrow', label: '手押し車', size: [0.9, 0.8, 1.8], build: (p) => wheelbarrow(p) },
  { id: 'bucket', label: 'バケツとほうき', size: [0.8, 1.4, 0.4], build: (p) => bucketBroom(p) },
  { id: 'bookcase', label: '本棚（本 1 冊ずつ）', size: [1.2, 2.0, 0.32], build: (p) => bookcase(p, 1.2, 2.0, 0.32) },
  {
    id: 'long-table',
    label: '長い机と机の上（本・紙・湯飲み・燭台）',
    size: [2.4, 0.9, 0.85],
    build: (p) => {
      longTable(p, 2.4, 0.85, 0.75);
      tableTop(p.sub([0, 0.75, 0]), 2.2, 0.7);
    },
  },
  {
    id: 'blackboard',
    label: '黒板（チョークの線・受け）',
    size: [2.6, 2.1, 0.15],
    build: (p) => {
      backWall(p, 2.8, 2.3);
      blackboard(p, 2.4, 1.0, 0.9);
    },
  },
  { id: 'school-desk', label: '教室の机と椅子', size: [0.7, 0.8, 1.1], build: (p) => schoolDesk(p) },
  { id: 'lectern', label: '書見台', size: [0.6, 1.3, 0.5], build: (p) => lectern(p) },
  { id: 'workbench', label: '作業台（万力・道具・下の箱）', size: [2.0, 1.0, 0.75], build: (p) => workbench(p, 2.0) },
  {
    id: 'sink',
    label: '陶器の流しと蛇口',
    size: [0.9, 1.2, 0.6],
    build: (p) => {
      backWall(p.sub([0, 0, -0.28]), 1.0, 1.4);
      sink(p, 0.9);
    },
  },
  {
    id: 'coat-rail',
    label: '壁の掛け具と外套',
    size: [1.4, 1.9, 0.2],
    build: (p) => {
      backWall(p, 1.6, 2.0);
      coatRail(p, 1.4, 2);
    },
  },
  {
    id: 'notice',
    label: '掲示板（貼り紙）',
    size: [1.0, 1.9, 0.1],
    build: (p) => {
      backWall(p, 1.2, 2.0);
      noticeBoard(p, 1.0, 0.7);
    },
  },
  { id: 'cot', label: '寝台（鉄の枠・布団・枕）', size: [0.9, 0.9, 2.0], build: (p) => cot(p) },
  {
    id: 'jars',
    label: '素焼きの壺',
    size: [0.9, 0.6, 0.4],
    build: (p) => {
      jar(p.sub([-0.25, 0, 0]), 0.4);
      jar(p.sub([0.2, 0, 0]), 0.55, '#9fb2a7');
    },
  },
  // ---- 3 回目の直しで足した物（部屋の種類ごとの物・どの部屋にもある物・屋上と外壁の造り） ----
  {
    id: 'radiator',
    label: '鋳物の放熱器（窓の下。弁と床への管）',
    size: [1.3, 0.8, 0.2],
    build: (p) => {
      backWall(p, 1.5, 1.0);
      radiator(p, 1.1, 0.62);
    },
  },
  {
    id: 'tool-wall',
    label: '道具の壁（工房。のこぎり・金槌・定規・鑿・縄）',
    size: [1.9, 2.2, 0.2],
    build: (p) => {
      backWall(p, 2.1, 2.3);
      toolWall(p, 1.8);
    },
  },
  {
    id: 'key-board',
    label: '鍵の板（門番の部屋。鍵と札）',
    size: [0.8, 1.9, 0.5],
    build: (p) => {
      backWall(p, 1.0, 2.0);
      keyBoard(p);
    },
  },
  { id: 'serving', label: '配膳の台（食堂。積んだ器・鍋・水差し）', size: [2.4, 1.2, 0.65], build: (p) => servingCounter(p, 2.4) },
  {
    id: 'clock-map-cross',
    label: '壁の時計・教室の地図・十字架',
    size: [2.8, 3.0, 0.2],
    build: (p) => {
      backWall(p, 3.0, 3.1);
      wallClock(p.sub([-1.0, 0, 0]), 2.5);
      wallMap(p.sub([0.3, 0, 0]), 1.2, 0.9, 1.0);
      wallCross(p.sub([1.25, 0, 0]), 0.8, 1.6);
    },
  },
  { id: 'roof-hatch', label: '屋上の点検口（立ち上がり・鋼のふた）', size: [1.3, 0.5, 1.3], build: (p) => roofHatch(p) },
  { id: 'vent-pipe', label: '屋上の通気管', size: [0.4, 0.9, 0.4], build: (p) => ventPipe(p, 0.7) },
  { id: 'roof-drain', label: '屋上の排水口と水の跡', size: [1.1, 0.05, 0.9], build: (p) => roofDrain(p, '#a9b8ad') },
  {
    id: 'downpipe',
    label: '竪樋（集水器・つかみ金物・下の曲がり）と水の吐き口',
    size: [1.2, 3.2, 0.5],
    build: (p) => {
      backWall(p, 1.4, 3.3);
      downpipe(p.sub([-0.3, 0, 0]), 0, 3.0);
      spout(p.sub([0.4, 0, 0]), 2.6);
    },
  },
  { id: 'chair', label: '椅子（積み重ね。共通の小物を場所の色で）', size: [0.5, 0.9, 0.5], build: (p) => chair(p, { seat: '#6d7d72', frame: '#3b4f4a' }) },
  { id: 'shelf', label: 'スチール棚（ファイル・紙・段ボール）', size: [1.0, 1.8, 0.45], build: (p) => steelShelf(p, { w: 1.0, d: 0.45, h: 1.8, load: ['binders', 'paper', 'cardboard', 'binders'], frame: '#4d5f5b', colors: SHELF_COLORS }) },
  { id: 'bin', label: 'ごみ箱', size: [0.45, 0.75, 0.45], build: (p) => trashBin(p, { body: '#7f938a', lid: '#4d5f5b' }) },
  { id: 'extinguisher', label: '消火器', size: [0.3, 0.65, 0.3], build: (p) => extinguisher(p, { red: '#6b4f48', metal: '#9fb2a7' }) },
];

export function gallery(): GallerySpec {
  return {
    label: '白いコンクリートの中庭（修道院の学びの家）',
    styleFrom: 'whiteroom',
    mats: (ctx) => wrPropMats(ctx, [0.6, 0.95, 8]),
    entries,
    floor: '#bad0c0',
    wall: '#b0c5b7',
  };
}
