import { Prop, type PropEntry, type PropMats } from '../../../props/kit.ts';
import { chair, extinguisher, trashBin } from '../../../props/lib/index.ts';
import type { GallerySpec } from '../../../props/gallery.ts';
import type { SceneContext } from '../../../scenes/types.ts';
import { Mats, PAL, type Zone } from '../mats.ts';
import {
  artRow,
  blackboard,
  bookStack,
  carton,
  ceilingTv,
  cleaningCabinet,
  cubbyLocker,
  deskSet,
  fileBox,
  fluorescent,
  globe,
  hookRail,
  lectern,
  noticeBoard,
  pendantLight,
  platform,
  poster,
  radiator,
  schoolChair,
  schoolDesk,
  steelCabinet,
  steelLocker,
  steelRack,
  wallClock,
  wallSpeaker,
} from './school.ts';
import { acUnit, bracketLight, curtain, drinkingFountain, emergencyLight, hangingMap, hydrantCabinet, mapCase, smokeDetector } from './fixtures.ts';

/**
 * 海の見える教室の小物の見本帳（props.html の classroom）。場所で使う小物を全部並べる。
 * 材質は場所と同じ作り方（Mats.props: 階の段の色。2 階 = 青い deep・3 階 = 青緑 shallow）
 */

let mats: Record<Zone, PropMats> | null = null;

function zoned(z: Zone, f: (p: Prop) => void): (p: Prop) => void {
  return (p) => f(new Prop(p.sink, mats?.[z] ?? p.mats, p.m, 7));
}
const deep = (f: (p: Prop) => void): ((p: Prop) => void) => zoned('deep', f);
const shallow = (f: (p: Prop) => void): ((p: Prop) => void) => zoned('shallow', f);
const D = PAL.deep;
const S = PAL.shallow;

const ENTRIES: PropEntry[] = [
  // ---- 教室
  { id: 'deskset', label: '生徒の机と椅子（2 階）', size: [0.7, 0.85, 1.0], build: deep((p) => deskSet(p, { top: D.desk.color, edge: D.deskEdge, frame: D.deskFrame, seat: D.seat, clutter: 1, pull: 0.25 })) },
  { id: 'deskset3', label: '生徒の机と椅子（3 階）', size: [0.7, 0.85, 1.0], build: shallow((p) => deskSet(p, { top: S.desk.color, edge: S.deskEdge, frame: S.deskFrame, seat: S.seat, clutter: 1, pull: 0.25 })) },
  { id: 'desk', label: '生徒の机（物入れと教科書）', size: [0.65, 0.75, 0.45], build: deep((p) => { schoolDesk(p, { top: D.desk.color, edge: D.deskEdge, frame: D.deskFrame }); bookStack(p.sub([0.05, 0.71, 0.0], 0.2), 3); }) },
  { id: 'chair', label: '生徒の椅子（管の輪の背）', size: [0.45, 0.82, 0.45], build: deep((p) => schoolChair(p, { seat: D.seat, frame: D.deskFrame })) },
  { id: 'lectern', label: '教卓と教壇', size: [1.6, 1.1, 1.0], build: deep((p) => { platform(p.sub([0, 0, 0]), { w: 1.6, d: 1.0, h: 0.18 }); lectern(p.sub([0, 0.18, 0])); }) },
  { id: 'blackboard', label: '黒板（チョーク受け・消し跡）', size: [3.6, 2.6, 0.2], build: deep((p) => blackboard(p.sub([0, 1.45, -0.1]), { w: 3.6, h: 1.2 })) },
  { id: 'notice', label: '掲示板と絵の列', size: [1.8, 2.4, 0.1], build: deep((p) => { noticeBoard(p.sub([0, 1.45, -0.05]), { w: 1.8, h: 0.9 }); artRow(p.sub([0, 2.15, -0.05]), { w: 1.8, n: 5 }); }) },
  { id: 'cubby', label: '教室の後ろのロッカー', size: [2.4, 1.05, 0.45], build: deep((p) => cubbyLocker(p, { cols: 4, body: '#5f8fa2' })) },
  { id: 'clock', label: '掛け時計・放送のスピーカー・テレビ', size: [1.8, 2.6, 0.5], build: deep((p) => { wallClock(p.sub([-0.65, 2.0, -0.2])); wallSpeaker(p.sub([-0.15, 2.0, -0.2])); ceilingTv(p.sub([0.55, 1.5, 0.1]), { drop: 0.3 }); }) },
  { id: 'lights', label: '蛍光灯（天井付け・吊り下げ）', size: [1.6, 1.0, 1.3], build: deep((p) => { fluorescent(p.sub([-0.4, 0.9, 0], Math.PI / 2), { body: '#2c4c66', tube: '#9cc4d4' }); pendantLight(p.sub([0.45, 1.0, 0], Math.PI / 2), { drop: 0.3 }); }) },
  { id: 'cabinet', label: '薄い色の書庫（扉の前）', size: [0.98, 1.12, 0.4], build: deep((p) => steelCabinet(p, { w: 0.98, d: 0.4, h: 1.12, body: '#8ab4c4' })) },
  { id: 'cabinet-glass', label: '書庫（ガラス戸）', size: [0.88, 1.8, 0.4], build: deep((p) => steelCabinet(p, { w: 0.88, d: 0.4, h: 1.8, body: '#6f9aaa', glass: true })) },
  { id: 'clean', label: '掃除用具入れ', size: [0.7, 1.8, 0.5], build: deep((p) => cleaningCabinet(p, { body: '#5f8fa2' })) },
  { id: 'radiator', label: '窓の下の放熱器', size: [1.2, 0.5, 0.2], build: deep((p) => radiator(p)) },
  // ---- 廊下
  { id: 'locker', label: '廊下のスチールロッカー', size: [1.54, 1.0, 0.36], build: deep((p) => steelLocker(p, { cols: 4, body: '#5f8fa2' })) },
  { id: 'hooks', label: 'フック掛けと袋', size: [1.6, 0.6, 0.1], build: deep((p) => hookRail(p.sub([0, 1.2, -0.05]), { w: 1.6, n: 7 })) },
  { id: 'poster', label: '貼り紙（時間割・お知らせ）', size: [0.9, 0.7, 0.05], build: deep((p) => { poster(p.sub([-0.25, 1.5, -0.02]), { w: 0.42, h: 0.6 }); poster(p.sub([0.25, 1.55, -0.02]), { w: 0.3, h: 0.42 }); }) },
  { id: 'bins', label: '分別のごみ箱', size: [1.1, 0.9, 0.45], build: deep((p) => trashBin(p, { kind: 'recycle', body: '#6f9aa6', lid: '#3f6f86' })) },
  { id: 'ext', label: '消火器', size: [0.3, 0.65, 0.3], build: deep((p) => extinguisher(p, { red: '#b2545c' })) },
  { id: 'hydrant', label: '屋内消火栓の箱（表示灯・発信機・ベル）', size: [1.2, 1.3, 0.25], build: deep((p) => hydrantCabinet(p.sub([-0.1, 0.1, -0.12]))) },
  { id: 'fountain', label: '水飲み場（上向きの蛇口）', size: [1.4, 1.0, 0.45], build: deep((p) => drinkingFountain(p, { w: 1.4 })) },
  { id: 'ceiling-fix', label: '非常灯・煙感知器・壁付けの灯り', size: [1.0, 0.5, 0.4], build: deep((p) => { p.box('#2c4d68', [-0.5, 0.45, -0.2], [0.15, 0.48, 0.2]); p.box('#4f8aa6', [0.18, 0, -0.14], [0.48, 0.48, -0.12]); emergencyLight(p.sub([-0.3, 0.45, 0])); smokeDetector(p.sub([0.0, 0.45, 0])); bracketLight(p.sub([0.33, 0.25, -0.12])); }) },
  // ---- 階段室・教材室
  { id: 'curtain', label: 'カーテン（寄せた布・ひだ）', size: [1.8, 1.6, 0.15], build: deep((p) => curtain(p.sub([0, 1.6, -0.07]), { w: 1.6, h: 1.5, col: '#5f8fa2', open: 0.28 })) },
  { id: 'ac', label: '空調の室外機（バルコニー）', size: [0.9, 0.7, 0.3], build: deep((p) => acUnit(p)) },
  { id: 'map', label: '掛け図と地図の引き出しの箱', size: [1.4, 2.2, 0.6], build: deep((p) => { mapCase(p); hangingMap(p.sub([0, 2.1, -0.3]), { w: 1.0, h: 1.2 }); }) },
  // ---- 教材室
  { id: 'rack', label: 'スチールの棚（段ボール・書類の箱）', size: [1.2, 1.8, 0.45], build: deep((p) => steelRack(p, { w: 1.2, d: 0.45, h: 1.8, levels: 5, fill: (s, w, d, clear, i) => {
    let x = -w / 2 + 0.05;
    while (x < w / 2 - 0.15) {
      if (i % 2 === 0) { carton(s.sub([x + 0.2, 0, 0]), { w: 0.38, h: Math.min(clear - 0.02, 0.28), d: Math.min(d, 0.32) }); x += 0.42; }
      else { fileBox(s.sub([x + 0.05, 0, 0]), { col: ['#cfe6e6', '#6f9ab0', '#4f7f96'][Math.floor(s.r() * 3)], h: Math.min(clear - 0.02, 0.3) }); x += 0.105; }
    }
  } })) },
  { id: 'globe', label: '地球儀と本', size: [0.6, 0.6, 0.4], build: deep((p) => { globe(p.sub([-0.12, 0, 0])); bookStack(p.sub([0.2, 0, 0.05], 0.3), 4); }) },
  { id: 'stack-chair', label: '積み重ねの椅子（教材室）', size: [0.5, 0.9, 0.5], build: deep((p) => chair(p, { kind: 'stack', seat: '#5f8fa2', frame: '#2c4c66' })) },
];

export function gallery(): GallerySpec {
  return {
    label: '海の見える教室',
    styleFrom: 'classroom',
    mats: (ctx: SceneContext) => {
      const m = new Mats(ctx);
      mats = { deep: m.props('deep'), shallow: m.props('shallow') };
      return mats.deep;
    },
    entries: ENTRIES,
    floor: '#6dd0d8',
    wall: '#4f8aa6',
  };
}
