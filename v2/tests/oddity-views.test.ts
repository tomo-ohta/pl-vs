// 段階 4・oddity の描画（client/views/oddity）と部屋の画面効果（client/render/RoomGrade.ts・PostFX）:
// Node で部品の描画を作って動かせる（例外が無い・部屋にいる間だけ画面の色を頼む・煙の中で霧が濃くなる）。
// PostFX は画面効果の間だけ pass を差し込み、効果が消えたら外す（直接描画の設定でも、効果の間だけ小さな composer を作る）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { defaultTuning } from '../core/config/tuning.ts';
import { ODDITY_CATALOG } from '../core/gen/catalog/oddity.ts';
import { dressCell } from '../core/gen/dress/index.ts';
import { generateFloorReport } from '../core/gen/floor/index.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import type { FloorLayout } from '../core/world/layout.ts';
import type { RoomGrade } from '../client/render/RoomGrade.ts';

const t = defaultTuning();
const EXISTING = new Set(['flood', 'fog', 'upsideDown', 'tint']);
const MINE = [...new Set(ODDITY_CATALOG.flatMap((e) => e.impl.filter((m) => m.kind === 'anomaly' && !EXISTING.has(m.id)).map((m) => m.id)))];
const TYPES = new Set(['oddRoom', 'oddTrail', 'oddWaves', 'oddClock', 'oddTouch']);

test('oddity の描画: どの異変の部屋の部品も、Node で作って動かせる（部屋にいる間だけ画面の色を頼む・煙の中で霧が濃くなる）', async () => {
  const { MaterialLibrary } = await import('../client/render/MaterialLibrary.ts');
  const { FloorBuilder } = await import('../client/world/FloorBuilder.ts');
  const { createView } = await import('../client/views/index.ts');
  const lib = new MaterialLibrary();
  const made = new Map<string, number>();
  const grades = new Map<string, number>();
  let fogged = false;
  for (const id of MINE) {
    let r = generateFloorReport({ world: 1, depth: 0, variant: 0 }, t, { showcase: { gimmicks: ['oneDifferent'], anomalies: [id] }, dress: dressCell });
    for (let w = 2; w <= 10 && !r.anomalies.some((a) => a.def === id); w++) r = generateFloorReport({ world: w, depth: 0, variant: 0 }, t, { showcase: { gimmicks: ['oneDifferent'], anomalies: [id] }, dress: dressCell });
    // 描くのは異変の部屋だけ（焼き込みの時間を短く）
    const cells = new Set(r.anomalies.map((a) => a.cell));
    const floor: FloorLayout = { ...r.floor, cells: r.floor.cells.filter((c) => cells.has(c.id)) };
    const built = new FloorBuilder(lib).build(floor);
    const sim = new Sim(r.floor, { tuning: t });
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x101010, 8, 40);
    scene.background = new THREE.Color(0x101010);
    const camera = new THREE.PerspectiveCamera(72, 1.6, 0.05, 150);
    const requests: { key: string; g: RoomGrade | null }[] = [];
    const postfx = { setRoomGrade: (key: string, g: RoomGrade | null) => requests.push({ key, g }) };
    for (const a of r.anomalies) {
      const cell = r.floor.cells.find((c) => c.id === a.cell)!;
      for (const e of r.floor.entities.filter((x) => x.id.startsWith(`${a.id}.`) && TYPES.has(x.type))) {
        const root = new THREE.Group();
        const v = createView(e, { root, materials: lib, built, sim, levelOf: () => 1, postfx: postfx as never, camera, scene, onEvent: () => () => {} });
        if (!v) continue;
        made.set(a.def, (made.get(a.def) ?? 0) + 1);
        // 目を部屋の真ん中の立った高さに置いて 20 フレーム
        const b = cell.bounds;
        camera.position.set((b.min[0] + b.max[0]) / 2, cell.floorY + 1.6, (b.min[2] + b.max[2]) / 2);
        camera.updateMatrixWorld();
        const before = requests.length;
        (scene.fog as THREE.Fog).far = 40;
        for (let k = 0; k < 20; k++) v.update(sim.stateOf(e.id) ?? {}, 1 / 60);
        if (requests.length > before) grades.set(a.def, (grades.get(a.def) ?? 0) + 1);
        if (a.def === 'smoke' && (scene.fog as THREE.Fog).far < 5) fogged = true;
        // 部屋の外では画面の色を頼まない
        camera.position.set(b.max[0] + 30, cell.floorY + 1.6, b.max[2] + 30);
        const out = requests.length;
        for (let k = 0; k < 5; k++) v.update(sim.stateOf(e.id) ?? {}, 1 / 60);
        assert.equal(requests.length, out, `${a.def}: 部屋の外で画面の色を頼まない`);
        v.dispose();
      }
    }
    built.dispose();
  }
  // 部屋の部品のある異変は、描画が作れる
  for (const id of ['smoke', 'leak', 'snow', 'wind', 'thermal', 'sand', 'sea', 'waterWall', 'oddScale', 'mirror', 'dayCycle', 'aging', 'justLeft', 'missingColor', 'mono', 'void']) assert.ok(made.get(id), `${id} の描画`);
  // 画面の色を頼む異変
  for (const id of ['smoke', 'snow', 'thermal', 'missingColor', 'mono', 'dayCycle', 'aging', 'waterWall', 'void']) assert.ok(grades.get(id), `${id} は部屋にいる間だけ画面の色を頼む`);
  assert.ok(fogged, '煙の中では霧が濃い');
  lib.dispose();
});

test('PostFX の部屋の画面効果: 効果の間だけ pass を差し込み、効果が消えたら外す', async () => {
  const { PostFX } = await import('../client/render/PostFX.ts');
  const { GradePass, mergeGrades, isNeutral } = await import('../client/render/RoomGrade.ts');
  const { OutputPass } = await import('three/addons/postprocessing/OutputPass.js');
  const { RenderPass } = await import('three/addons/postprocessing/RenderPass.js');
  const fake = { getContext: () => ({}), getPixelRatio: () => 1, getSize: (v: THREE.Vector2) => v.set(800, 450) } as unknown as THREE.WebGLRenderer;
  const fx = new PostFX(fake, new THREE.Scene(), new THREE.PerspectiveCamera());
  const tick = (dt: number): void => { const f = fx as unknown as { frame: number; updateGrade(dt: number): void }; f.frame++; f.updateGrade(dt); };
  // 直接描画の設定
  fx.configure({ gtao: false, bloom: false, msaa: 0, gtaoScale: 0.5, film: 'off' });
  assert.equal(fx.describe(), 'direct');
  fx.setRoomGrade('room', { saturation: 0, frost: 0.8 });
  tick(0.1);
  assert.equal(fx.describe(), 'direct+grade', '効果の間だけ小さな composer');
  assert.equal(fx.active, false, '画面効果のための composer は数えない');
  const passes = fx.composer!.passes;
  assert.ok(passes[0] instanceof RenderPass && passes[1] instanceof GradePass && passes[2] instanceof OutputPass);
  for (let i = 0; i < 20; i++) { fx.setRoomGrade('room', { saturation: 0, frost: 0.8 }); tick(0.1); }
  assert.ok(fx.roomGrade.saturation < 0.05 && fx.roomGrade.frost > 0.75, '頼んだ値へ寄る');
  // 頼むのをやめると戻り、pass を外して直接描画に戻る
  for (let i = 0; i < 60; i++) tick(0.1);
  assert.equal(fx.describe(), 'direct');
  assert.equal(fx.composer, null);
  // composer のある設定: OutputPass の前に差し込む
  fx.configure({ gtao: true, bloom: true, msaa: 0, gtaoScale: 0.5, film: 'homeVideo' });
  const n = fx.composer!.passes.length;
  fx.setRoomGrade('room', { hueKill: { hue: 0, width: 0.1, amount: 1 } });
  tick(0.1);
  const ps = fx.composer!.passes;
  assert.equal(ps.length, n + 1);
  assert.ok(ps[ps.indexOf(fx.outputPass!) - 1] instanceof GradePass, 'OutputPass の前');
  for (let i = 0; i < 60; i++) tick(0.1);
  assert.equal(fx.composer!.passes.length, n, '効果が消えたら外す');
  fx.dispose();
  // 重ね方: 彩度は掛け、量は大きい方
  const m = mergeGrades([{ saturation: 0.5, frost: 0.2 }, { saturation: 0.5, frost: 0.6, vignette: 0.3 }]);
  assert.ok(Math.abs(m.saturation - 0.25) < 1e-9 && m.frost === 0.6 && m.vignette === 0.3);
  assert.ok(isNeutral(mergeGrades([])));
});
