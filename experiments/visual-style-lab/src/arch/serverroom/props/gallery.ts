import * as THREE from 'three';
import type { GallerySpec } from '../../../props/gallery.ts';
import { Prop, type PropEntry, type PropMats, type PropSink } from '../../../props/kit.ts';
import { chair, extinguisher, steelShelf, trashBin, vendingMachine } from '../../../props/lib/index.ts';
import type { Builder } from '../../../scenes/Builder.ts';
import type { SceneContext } from '../../../scenes/types.ts';
import { makeGlassStreaks, makeServerAtlas, type Atlas } from '../atlas.ts';
import { glassMaterial } from '../glass.ts';
import { PAL, VcMats } from '../mats.ts';
import { hangBox, ladderZ, sagCable } from '../overhead.ts';
import { inRowCooler, serverRack, type RackMats } from '../rack.ts';
import { palletJack } from '../spaces.ts';
import { cableCoil, cableTrough } from './cables.ts';
import { kvmDrawer, powerCabinet, shortRack } from './equipment.ts';
import {
  cardReader,
  cctvDome,
  cone,
  crashCart,
  cylinderBank,
  exitSign,
  hydrantBox,
  nocDesk,
  pallet,
  serverBox,
  serverLift,
  tileLifter,
  videoWall,
  wallClock,
  wallScreen,
  workbench,
} from './facility.ts';
import { batteryRack, crah, eyewash, insulatedPipe, switchboard, upsCabinet } from './power.ts';
import { batteryCabinet, lockerBank, palletRack, palletWrapper, pump, rollCage, wrapLoad } from './storage.ts';
import { boxTruck } from './vehicles.ts';
import { dressWall } from '../dress.ts';

/**
 * サーバールームの小物の見本帳（props.html の serverroom）。場面と同じ頂点の色の材質（mats.ts）と、ラックの図柄の材質で並べる。
 * 撮る: node tools/capture.mjs --page props.html --tour serverroom
 */

let vc: VcMats | null = null;
let rack: { face: THREE.Material; glass: THREE.Material; atlas: Atlas } | null = null;

function mats(ctx: SceneContext): PropMats {
  vc = new VcMats(ctx, { shade: '#8ea4b4', dark: '#5a7080', hi: '#ffffff', name: 'sr-gallery' });
  const atlas = makeServerAtlas(11);
  const face = ctx.mat({ color: '#ffffff', shade: '#c6d4dc', dark: '#a0b4c0', map: atlas.map, line: 0.3, noise: [0, 1], shadowQuant: false, name: 'sr-gallery-face' });
  (face as THREE.MeshStandardMaterial).emissiveMap = atlas.emissive;
  (face as THREE.MeshStandardMaterial).emissive.set('#ffffff');
  (face as THREE.MeshStandardMaterial).emissiveIntensity = 2.2;
  rack = { face, glass: glassMaterial({ map: makeGlassStreaks(5), color: '#1c4d60', opacity: 0.12, edgeColor: '#6cc4dc', edgeOpacity: 0.62, power: 2.2 }), atlas };
  // 見本帳の床と壁は色の材質そのもの（見本帳は mats.get の材質で床・壁を直接描く）。物はしるしの材質を出し先（W）で頂点の色に
  const floor = ctx.mat({ color: '#86dcf0', shade: '#6cc0da', dark: '#4f9ab8', tiles: { size: 0.6, line: 0.008, color: '#5fb2cc', jitter: 0.03 }, name: 'sr-gallery-floor' });
  const wall = ctx.mat({ color: '#3584a0', shade: '#2c7088', dark: '#205a70', tiles: { size: [1.0, 3.0], line: 0.016, color: '#1a5468', jitter: 0.12 }, name: 'sr-gallery-wall' });
  const v = vc;
  return {
    get: (color, kind) => (color === '#86dcf0' && !kind ? floor : color === '#3584a0' && !kind ? wall : v.get(color, kind)),
  };
}

/** 見本帳の出し先（builderSink）を、頂点の色を焼く出し先に包む */
function W(p: Prop): Prop {
  const v = vc!;
  const sink: PropSink = { add: (geo, mat, sh) => p.sink.add(geo, v.resolve(geo, mat), sh), collide: (a, b) => p.sink.collide(a, b) };
  const q = new Prop(sink, v, p.m.clone());
  (q as { r: () => number }).r = p.r;
  return q;
}

/** ラックの図柄の板（Builder.mesh）を見本帳の出し先へ */
function rackMats(p: Prop): RackMats {
  const fake = {
    mesh(geo: THREE.BufferGeometry, mat: THREE.Material) {
      p.sink.add(geo, mat, 'receive');
      return null;
    },
  } as unknown as Builder;
  return { b: fake, ...rack! };
}

const E = (id: string, label: string, size: [number, number, number], build: (p: Prop) => void): PropEntry => ({ id, label, size, build: (p) => build(W(p)) });

export function gallery(): GallerySpec {
  return {
    label: 'サーバールーム',
    styleFrom: 'serverroom',
    mats,
    floor: '#86dcf0',
    wall: '#3584a0',
    entries: [
      E('rack', 'サーバーラック（ガラス扉・前）', [0.6, 2.2, 1.1], (p) => serverRack(p, rackMats(p), { design: 1, streak: 1, back: true })),
      E('rack-row', 'ラックの列（3 本・取っ手の向き違い）', [1.8, 2.2, 1.1], (p) => [-0.6, 0, 0.6].forEach((x, i) => serverRack(p.sub([x, 0, 0]), rackMats(p), { design: (i * 5 + 3) % 16, streak: i, hinge: i % 2 ? 1 : -1, back: true }))),
      E('rack-back', 'サーバーラック（背の扉・ケーブル・PDU）', [0.6, 2.2, 1.1], (p) => serverRack(p.sub([0, 0, -1.1], Math.PI), rackMats(p), { design: 6, rear: 9, back: true })),
      E('rack-open', '組み立て中のラック（扉なし）', [0.6, 2.0, 1.0], (p) => serverRack(p, rackMats(p), { design: 13, door: 'none', h: 2.0, d: 1.0 })),
      E('cooler', 'インロー空調機', [0.3, 2.2, 1.3], (p) => inRowCooler(p, { d: 1.3, h: 2.2 })),
      E('short-rack', '背の低いラック（キャスター付き）', [0.6, 0.85, 0.4], (p) => shortRack(p, { w: 0.55, d: 0.4, h: 0.82 })),
      E('power', '分電盤（淡い 2 枚扉）', [0.9, 2.3, 0.9], (p) => powerCabinet(p, { color: '#4f95a2' })),
      E('kvm', 'KVM のコンソール（引き出した画面とキーボード）', [0.5, 1.4, 0.8], (p) => {
        p.box(PAL.rack, [-0.3, 0, -0.6], [0.3, 1.25, -0.02], { r: 0.008 });
        kvmDrawer(p.sub([0, 0, -0.02]), { y: 0.82 });
      }),
      E('coil', '床のケーブルの輪', [1.0, 0.1, 0.8], (p) => cableCoil(p, { r: 0.32, loops: 3, tail: [0.6, 0, -0.2] })),
      E('trough', '床置きのケーブルダクト', [2.0, 0.2, 0.3], (p) => cableTrough(p, { len: 2.0 })),
      E('tray', 'はしご形のケーブルラックと垂れたケーブル', [1.0, 2.6, 2.0], (p) => {
        ladderZ(p, 0, 2.2, -1.0, 1.0, 0.5, { load: 0.7 });
        for (let k = 0; k < 5; k++) sagCable(p, [-0.15 + k * 0.07, 2.25, -0.8], [-0.1 + k * 0.07, 2.25, 0.6], 0.5 + k * 0.08, 0.008);
        for (const z of [-0.7, 0.7]) for (const x of [-0.27, 0.27]) p.box(PAL.steelDark, [x - 0.006, 2.2, z - 0.006], [x + 0.006, 2.6, z + 0.006]);
      }),
      E('hangbox', '天井から吊った箱（分岐の箱）', [0.8, 2.6, 1.0], (p) => hangBox(p, [0, 2.2, 0], [0.7, 0.35, 0.9], PAL.box, 2.6)),
      E('ups', 'UPS の盤', [0.8, 2.0, 0.9], (p) => upsCabinet(p)),
      E('batcab', '蓄電池の盤（LED の列）', [0.8, 2.0, 0.9], (p) => batteryCabinet(p, { w: 0.78 })),
      E('switchboard', '受変電の盤（計器・表示灯）', [0.9, 2.2, 0.8], (p) => switchboard(p, { meters: 3 })),
      E('batrack', '蓄電池の架台（3 段）', [2.4, 1.6, 0.6], (p) => batteryRack(p, { len: 2.4 })),
      E('crah', '空調機（CRAH）', [1.8, 3.0, 0.9], (p) => crah(p)),
      E('pump', '冷水のポンプと配管', [1.4, 1.2, 0.7], (p) => {
        pump(p);
        insulatedPipe(p, [-0.7, 1.4, -0.3], [0.7, 1.4, -0.3], 0.1);
      }),
      E('eyewash', '洗眼器', [0.4, 1.9, 0.4], (p) => eyewash(p)),
      E('cylinders', '消火ガスのボンベの列', [2.2, 2.8, 0.5], (p) => cylinderBank(p, { n: 6 })),
      E('nocdesk', '監視の机（画面 3 枚）', [1.6, 1.2, 0.8], (p) => nocDesk(p)),
      E('videowall', '壁の大きな画面', [3.7, 2.4, 0.5], (p) => videoWall(p)),
      E('wallitems', '壁の画面・時計・誘導灯・読み取り機・消火栓の箱・監視カメラ', [2.4, 2.6, 0.3], (p) => {
        p.box('#3584a0', [-1.2, 0, -0.06], [1.2, 2.6, -0.02]);
        wallScreen(p.sub([-0.6, 1.7, -0.02]), { w: 0.9 });
        wallClock(p.sub([0.4, 2.2, -0.02]), 0.14);
        exitSign(p.sub([0.9, 2.3, -0.02]));
        cardReader(p.sub([0.2, 0, -0.02]));
        hydrantBox(p.sub([0.8, 0, -0.02]));
        cctvDome(p.sub([-0.3, 2.6, 0.2]));
      }),
      E('serverbox', 'サーバーの段ボール箱', [0.62, 0.3, 1.0], (p) => serverBox(p)),
      E('pallet', 'パレットと箱', [1.1, 1.0, 1.1], (p) => {
        pallet(p);
        for (let k = 0; k < 3; k++) serverBox(p.sub([0, 0.14 + k * 0.29, 0], (k - 1) * 0.05));
      }),
      E('palletrack', 'パレットラック（重量棚）', [2.7, 3.2, 1.1], (p) => palletRack(p.sub([0, 0, 0.55]), { w: 2.7, levels: 3, h: 3.0 })),
      E('cage', 'カゴ台車', [0.8, 1.7, 0.6], (p) => rollCage(p)),
      E('jack', 'パレットを運ぶ台車', [0.6, 1.2, 1.4], (p) => palletJack(p)),
      E('workbench', '作業台（ノートパソコン・ケーブル・工具）', [1.8, 1.1, 0.8], (p) => workbench(p)),
      E('lift', '機器の持ち上げ台車', [0.7, 1.8, 0.9], (p) => serverLift(p)),
      E('crashcart', 'コンソール台車', [0.7, 1.3, 0.6], (p) => crashCart(p)),
      E('lifter', '床板の持ち上げ具と三角コーン', [1.0, 0.7, 0.5], (p) => {
        tileLifter(p.sub([-0.3, 0, 0]));
        cone(p.sub([0.3, 0, 0]));
      }),
      E('locker', 'ロッカー（4 列 × 2 段）', [1.5, 1.8, 0.5], (p) => lockerBank(p)),
      E('shelf', 'スチール棚（開梱室: 段ボール・収納箱）', [1.2, 2.0, 0.5], (p) => steelShelf(p, { w: 1.2, h: 2.0, d: 0.5, load: ['cardboard', 'bins', 'cardboard', 'cardboard', 'bins'], frame: '#8fb8c2', colors: ['#9a8a6c', '#a8977a', '#8f8064'] })),
      E('chair', '事務椅子（監視室）', [0.6, 1.1, 0.6], (p) => chair(p, { kind: 'office', seat: '#1d4a5c', frame: '#2b3f46', base: '#1a2a30' })),
      E('vending', '自動販売機（階段のホール）', [1.0, 1.85, 0.75], (p) => vendingMachine(p, { body: '#d8e8ea', accent: '#2f7a96', lit: '#e8f8fa' })),
      E('bins', '分別のごみ箱・消火器', [1.5, 0.9, 0.5], (p) => {
        trashBin(p.sub([-0.3, 0, 0]), { kind: 'recycle', body: '#5a93a3' });
        extinguisher(p.sub([0.6, 0, 0]), { stand: true, red: '#c0505a' });
      }),
      E('truck', '2 t のアルミバン（荷捌き場）', [2.0, 3.1, 6.2], (p) => boxTruck(p)),
      E('wrapped', 'ラップで巻いた荷（パレット・角の当て板・帯）', [1.1, 1.4, 1.1], (p) => {
        pallet(p);
        wrapLoad(p, 4);
      }),
      E('wrapper', 'ラップの巻き機（回る台・柱・フィルム）', [2.0, 2.3, 2.3], (p) => palletWrapper(p.sub([0, 0, 0.15]))),
      E('wall-plant', '機械室の壁（分電盤・端子箱・火災報知と消火器・立て管・還気の格子）', [3.6, 3.0, 0.5], (p) => {
        p.box('#3584a0', [-1.8, 0, -0.06], [1.8, 3.0, -0.02]);
        dressWall(p, { a: [-1.8, -0.02], b: [1.8, -0.02], n: [0, 1], floorY: 0, ceil: 3.0 }, 'plant');
      }),
      E('wall-corr', '廊下の壁（掲示板・火災受信機・時計・電話・非常灯）', [3.6, 2.7, 0.3], (p) => {
        p.box('#3584a0', [-1.8, 0, -0.06], [1.8, 2.7, -0.02]);
        dressWall(p, { a: [-1.8, -0.02], b: [1.8, -0.02], n: [0, 1], floorY: 0, ceil: 2.7 }, 'corridor');
      }),
    ],
  };
}
