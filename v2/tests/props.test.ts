// 作り込む小物（client/props）の検査: 形の関数がどれも作れて決まった形になる・三角形の数が予算の中・
// 区画の箱から見つける計画の決まり（隠す箱は区画の箱・1 つの箱は 1 つの物だけ・異変が触った箱は使わない）・
// 写した部屋（warp の双子）と元の部屋が同じ形・FloorBuilder が区切りごとに箱を分けて、近い区切りに形の関数の物を出す
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { defaultTuning } from '../core/config/tuning.ts';
import { dressCell } from '../core/gen/dress/index.ts';
import { generateFloorReport } from '../core/gen/floor/index.ts';
import { showcaseFloor } from '../core/gen/floor/showcase.ts';
import type { Box, CellLayout, FloorLayout } from '../core/world/layout.ts';
import { GEN, type PropSpec } from '../client/props/registry.ts';
import { buildProps } from '../client/props/props.worker.ts';
import { normalGroup, planCell, type PlanItem } from '../client/props/plan.ts';
import { CARRY_GEN } from '../client/props/gen/carry.ts';

const t = defaultTuning();
const sp = (kind: string, a: PropSpec['a'] = {}, seed = 3): PropSpec => ({ kind, o: [0, 0, 0], yaw: 0, s: 1, a, seed });

/** 種類ごとの見本の作り方（引数は区画で見つけたときと同じ形） */
const SAMPLES: Record<string, PropSpec[]> = {
  plant: ['ficus', 'dracaena', 'sansevieria'].map((species) => sp('plant', { species })),
  shrubs: [sp('shrubs', { boxes: [[0, 0.3, 0, 0.4, 0.3, 0.4], [1, 0.3, 0, 0.4, 0.3, 0.4]] })],
  bookRow: [sp('bookRow', { x0: 0.005, x1: 0.8, zBack: -0.01, zFront: 0.28, maxH: 0.32, binders: false }), sp('bookRow', { x0: 0.005, x1: 0.8, zBack: -0.01, zFront: 0.28, maxH: 0.32, binders: true })],
  goodsRow: ['drinks', 'cans', 'snacks', 'cartons', 'mixed'].map((goods) => sp('goodsRow', { x0: 0.005, x1: 0.9, zFront: 0.4, maxH: 0.35, goods })),
  bed: [sp('bed', { w: 1.4, d: 2.0, top: 0.5, color: 0x5a7aa8, pattern: true }), sp('bed', { w: 1.0, d: 2.0, top: 0.5, color: 0x5a7aa8, pattern: false })],
  pillow: [sp('pillow', { c: [0, 0.035, 0], w: 0.5, d: 0.35 })],
  coolerBottle: [sp('coolerBottle')], trophy: [sp('trophy')], sculpture: [sp('sculpture')],
  smallVase: [sp('smallVase', { h: [0.08, 0.12, 0.08], main: 0xb84a3a })],
  toy: [sp('toy', { h: [0.12, 0.16, 0.1], main: 0x9b6a43 })],
  cone: [sp('cone')], urinal: [sp('urinal')], wallBasin: [sp('wallBasin')], toilet: [sp('toilet', { lidUp: true }), sp('toilet', { lidUp: false })],
  kitchenTop: [sp('kitchenTop', { len: 2.4, depth: 0.62, sink: [0.3, 0.9], hobs: [1.6, 2.0] })],
  vendingDisplay: [sp('vendingDisplay', { width: 0.8, rows: [1.2, 1.46], perRow: 6 })],
  deskLamp: [sp('deskLamp')], wallClock: [sp('wallClock', { hour: 3, minute: 0 })], sconce: [sp('sconce')], extinguisherStand: [sp('extinguisherStand')],
  pinnedSheet: [sp('pinnedSheet', { w: 0.21, h: 0.297 })], futon: [sp('futon')],
  curtain: [sp('curtain', { w: 2.1, y0: 0.2, y1: 2.0, color: 0xe8e6e0 })], hoop: [sp('hoop')], ballPit: [sp('ballPit', { w: 2.0, d: 2.0, top: 0.36 })],
  carry: Object.keys(CARRY_GEN).map((item) => sp('carry', { item, h: [0.12, 0.12, 0.12], main: 0x8a6a4a })),
  carryWater: [sp('carryWater', { h: [0.13, 0.15, 0.13] })],
};

/** 1 つの物の三角形の上限（v2 の細かさ = 高画質の近い区切り 1.5 で。形の関数を変えて大きく増えたら気づく。大きな木・ベッド・流し台も含めて） */
const MAX_TRIANGLES = 60000;
const V2_DETAIL = 1.5;

const fingerprint = (r: ReturnType<typeof buildProps>): string => {
  const d = r.data!;
  let h = 0;
  for (const p of d.pages) for (let i = 0; i < p.albedo.length; i += 97) h = (h * 31 + p.albedo[i]!) >>> 0;
  for (const g of d.groups) for (let i = 0; i < g.pos.length; i += 13) h = (h * 31 + Math.round(g.pos[i]! * 1e4)) >>> 0;
  return `${d.triangles}/${d.vertices}/${d.pages.map((p) => `${p.w}x${p.h}`).join(',')}/${h}`;
};

test('形の関数: どの種類も作れて、同じ作り方なら同じ形・三角形は予算の中・テクスチャは 1 頁 2048 幅まで', () => {
  for (const kind of Object.keys(GEN)) assert.ok(SAMPLES[kind]?.length, `見本の無い種類: ${kind}`);
  for (const [kind, specs] of Object.entries(SAMPLES)) {
    for (const s of specs) {
      const a = buildProps({ id: 1, items: [{ spec: s, scale: V2_DETAIL }] });
      assert.equal(a.failed, 0, `${kind} が例外を出した: ${JSON.stringify(s.a)}`);
      assert.ok(a.data && a.data.triangles > 0, `${kind} が何も作らない: ${JSON.stringify(s.a)}`);
      assert.ok(a.data.triangles <= MAX_TRIANGLES, `${kind} の三角形が多すぎる: ${a.data.triangles}`);
      for (const p of a.data.pages) assert.ok(p.w <= 2048 && p.w % 4 === 0 && p.h % 4 === 0, `${kind} のアトラスの大きさ ${p.w}x${p.h}`);
      for (const g of a.data.groups) {
        assert.equal(g.pos.length, g.nor.length);
        assert.equal(g.uv.length / 2, g.pos.length / 3);
        for (let i = 0; i < g.index.length; i++) assert.ok(g.index[i]! < g.pos.length / 3, `${kind} の三角形の番号が頂点の外`);
        for (let i = 0; i < g.pos.length; i++) assert.ok(Number.isFinite(g.pos[i]!) && Number.isFinite(g.nor[i]!), `${kind} の頂点が数でない`);
      }
      const b = buildProps({ id: 2, items: [{ spec: s, scale: V2_DETAIL }] });
      assert.equal(fingerprint(a), fingerprint(b), `${kind} が同じ作り方で違う形になる`);
    }
  }
});

test('細かさの倍率: 粗くすると三角形とテクスチャが減る（遠い区切り・スマホ）', () => {
  const row = SAMPLES.bookRow![0]!;
  const fine = buildProps({ id: 1, items: [{ spec: row, scale: 1 }] }).data!;
  const coarse = buildProps({ id: 2, items: [{ spec: row, scale: 3 }], tex: 0.65 }).data!;
  assert.ok(coarse.triangles < fine.triangles, `${coarse.triangles} < ${fine.triangles}`);
  assert.ok(coarse.bytes < fine.bytes * 0.6, `${coarse.bytes} < ${fine.bytes} × 0.6`);
});

/** 計画の決まり（区画 1 つ） */
function checkPlan(cell: CellLayout, items: PlanItem[]): void {
  const own = new Set(cell.boxes);
  const used = new Set<Box>();
  for (const it of items) {
    assert.ok(GEN[it.spec.kind], `${cell.id}: 作り方の無い種類 ${it.spec.kind}`);
    assert.ok(it.spec.o.every(Number.isFinite) && Number.isFinite(it.spec.yaw) && it.spec.s > 0, `${cell.id}: 置き場所が数でない`);
    for (const b of it.hide) {
      assert.ok(own.has(b), `${cell.id}: 隠す箱が区画の箱でない（${it.label}）`);
      assert.ok(!used.has(b), `${cell.id}: 1 つの箱を 2 つの物が隠す（${it.label}）`);
      used.add(b);
      assert.ok(!b.odd && !b.revealGroup && !b.concealGroup && !b.slope && !b.kind?.startsWith('lamp:'), `${cell.id}: 使ってはいけない箱を隠す（${it.label}）`);
    }
    for (const b of it.add) assert.ok(!own.has(b) && !b.solid, `${cell.id}: 足す箱は新しい描くだけの箱（${it.label}）`);
  }
}

test('計画: 家具入りのフロアの区画で、隠す箱は区画の箱・1 つの箱は 1 つの物だけ・おもな種類が見つかる', () => {
  const labels = new Map<string, number>();
  for (let w = 1; w <= 24; w++) {
    const floor = generateFloorReport({ world: w, depth: 1 + (w % 7), variant: w % 5 === 0 ? 1 : 0 }, t, { dress: dressCell }).floor;
    for (const cell of floor.cells) {
      const items = planCell(cell);
      checkPlan(cell, items);
      for (const it of items) labels.set(it.label, (labels.get(it.label) ?? 0) + 1);
    }
  }
  for (const l of ['books', 'goods', 'plant', 'toilet', 'sink', 'clock', 'paper']) assert.ok((labels.get(l) ?? 0) > 0, `24 フロアで ${l} が 1 つも見つからない（中身の作りが変わった？）: ${JSON.stringify([...labels])}`);
});

test('写しの種: 区画・区域の名前と写しの印を除いた propGroup', () => {
  assert.equal(normalGroup('r3#x0z1/plant@1.20,3.40'), 'plant@1.20,3.40');
  assert.equal(normalGroup('r3~a1/plant@1.20,3.40'), 'plant@1.20,3.40');
  assert.equal(normalGroup('r3/plant@1.20,3.40:m'), 'plant@1.20,3.40');
  assert.equal(normalGroup('r3/plant@1.20,3.40:k2'), 'plant@1.20,3.40');
  assert.equal(normalGroup('r3/sofa@1,2~m'), 'sofa@1,2');
  assert.equal(normalGroup('r3/L2-plant@1,2'), 'plant@1,2');
});

/** 区画ごとの作り方（種類と種）の数え上げ */
const recipes = (floor: FloorLayout): Map<string, { cell: string; twin: boolean }[]> => {
  const out = new Map<string, { cell: string; twin: boolean }[]>();
  for (const cell of floor.cells) {
    const twin = cell.boxes.some((b) => b.uvFrame) || (!!cell.uvFrame && cell.frame !== 'group');
    for (const it of planCell(cell)) {
      const k = `${it.spec.kind}:${it.spec.seed}`;
      out.set(k, [...(out.get(k) ?? []), { cell: cell.id, twin }]);
    }
  }
  return out;
};

test('warp の双子の部屋: 双子の物は元の部屋の物と同じ作り方（種）になる', () => {
  let twins = 0;
  for (const ids of [['twoDoors'], ['timedDoors'], ['loopHall'], ['anomalyHall']]) {
    const floor = showcaseFloor(t, { ids, dress: dressCell }).floor;
    for (const cell of floor.cells) checkPlan(cell, planCell(cell));
    for (const [k, list] of recipes(floor)) {
      if (!list.some((x) => x.twin)) continue;
      twins++;
      assert.ok(list.some((x) => !x.twin), `${ids[0]}: 双子にしか無い物 ${k}（元の部屋と見た目が変わる）`);
    }
  }
  assert.ok(twins > 0, '双子の部屋の物が 1 つも無い（見本のフロアが変わった？）');
});

test('異変: 異変が触った箱（Box.odd）と、それに触れる物は差し替えない', () => {
  let marked = 0;
  for (const ids of [['upsideDown', 'aging', 'stack'], ['missingColor', 'mirror', 'giant'], ['scatter', 'tiny', 'oddScale'], ['overgrowth', 'snow', 'sand']]) {
    const floor = showcaseFloor(t, { ids, dress: dressCell }).floor;
    for (const cell of floor.cells) {
      const odd = cell.boxes.filter((b) => b.odd);
      marked += odd.length;
      const items = planCell(cell);
      checkPlan(cell, items);
      const E = 0.02;
      for (const it of items) for (const b of it.hide) for (const o of odd) {
        const touch = b.min[0] < o.max[0] + E && b.max[0] > o.min[0] - E && b.min[1] < o.max[1] + E && b.max[1] > o.min[1] - E && b.min[2] < o.max[2] + E && b.max[2] > o.min[2] - E;
        assert.ok(!touch, `${cell.id}: 異変 ${o.odd} の箱に触れる ${it.label} を差し替える`);
      }
    }
  }
  assert.ok(marked > 0, '異変の箱に印が付かない（gen/anomaly の markChanged）');
});

test('FloorBuilder: 区切りごとに箱を分け、近い区切りに形の関数の物を出す（遠くなれば箱に戻す）', async () => {
  const { MaterialLibrary } = await import('../client/render/MaterialLibrary.ts');
  const { FloorBuilder } = await import('../client/world/FloorBuilder.ts');
  const { PropManager } = await import('../client/props/PropManager.ts');
  const { QUALITY_TIERS } = await import('../client/render/quality.ts');
  const lib = new MaterialLibrary();
  await lib.ready;
  const camera = new THREE.PerspectiveCamera();
  const props = new PropManager({ materials: lib, camera, tier: QUALITY_TIERS.high });
  const builder = new FloorBuilder(lib);
  builder.props = props;
  // 本の多いフロアを探す
  let floor: FloorLayout | null = null;
  for (let w = 1; w <= 30 && !floor; w++) {
    const f = generateFloorReport({ world: w, depth: 2, variant: 0 }, t, { dress: dressCell }).floor;
    if (f.cells.some((c) => planCell(c).some((it) => it.label === 'books'))) floor = f;
  }
  assert.ok(floor, '本のあるフロアが見つからない');
  const built = builder.build(floor);
  const scene = new THREE.Scene();
  scene.add(built.root);
  scene.updateMatrixWorld(true);
  const cell = [...built.cells.values()].find((c) => c.props && planCell(c.layout).some((it) => it.label === 'books'))!;
  assert.ok(cell?.props, '差し替える区画に props が無い');
  const p = cell.props;
  // 区切りの元の箱は見えていて、差し替え中だけの箱は隠れている
  assert.ok(p.placeholders.size > 0, '区切りの箱のメッシュが無い');
  for (const list of p.placeholders.values()) for (const m of list) assert.equal(m.visible, true);
  for (const list of p.adds.values()) for (const m of list) assert.equal(m.visible, false);
  // カメラを区切りの真ん中に置いて、作り終わるまで回す
  const tile = (p.plan.data as { key: string; center: THREE.Vector3 }[])[0]!;
  camera.position.copy(tile.center).applyMatrix4(p.root.matrixWorld);
  camera.updateMatrixWorld(true);
  for (let i = 0; i < 400 && !p.root.children.length; i++) { props.update(); await new Promise((r) => setTimeout(r, 5)); }
  assert.ok(p.root.children.length > 0, '近い区切りに形の関数の物ができない');
  const s = props.stats();
  assert.ok(s.ready > 0 && s.triangles > 0 && s.failed === 0, JSON.stringify({ ...s, labels: [...s.labels] }));
  let meshes = 0;
  p.root.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; meshes++; const a = m.geometry.getAttribute('bakedLight'); assert.ok(a && a.count === m.geometry.getAttribute('position').count, 'bakedLight が無い'); for (let i = 0; i < a.array.length; i++) assert.ok(Number.isFinite(a.array[i]!)); });
  assert.ok(meshes > 0);
  for (const m of p.placeholders.get(tile.key) ?? []) assert.equal(m.visible, false, '作った区切りの元の箱が隠れない');
  // 遠くへ離れると（far より遠い状態が続くと）捨てて箱に戻す
  camera.position.set(1e4, 0, 1e4);
  camera.updateMatrixWorld(true);
  props.update();
  await new Promise((r) => setTimeout(r, 1600));
  props.update();
  assert.equal(p.root.children.length, 0, '遠くなっても捨てない');
  for (const m of p.placeholders.get(tile.key) ?? []) assert.equal(m.visible, true, '捨てた区切りの元の箱が出ない');
  props.dispose();
  built.dispose();
});

test('部品で入切する照明の区画: 形の関数の物も照明を消すと暗くなる（焼き込みの混ぜ合わせ）', async () => {
  const { MaterialLibrary } = await import('../client/render/MaterialLibrary.ts');
  const { FloorBuilder, applyLampLevels } = await import('../client/world/FloorBuilder.ts');
  const { PropManager } = await import('../client/props/PropManager.ts');
  const { QUALITY_TIERS } = await import('../client/render/quality.ts');
  const lib = new MaterialLibrary();
  await lib.ready;
  const camera = new THREE.PerspectiveCamera();
  const props = new PropManager({ materials: lib, camera, tier: QUALITY_TIERS.high });
  const builder = new FloorBuilder(lib);
  builder.props = props;
  let checked = 0;
  for (const ids of [['emergencyPower'], ['blinkoutHall'], ['switchOffDoor']]) {
    const floor = showcaseFloor(t, { ids, dress: dressCell }).floor;
    const built = builder.build(floor);
    new THREE.Scene().add(built.root);
    built.root.updateMatrixWorld(true);
    for (const cell of built.cells.values()) {
      if (!cell.lamps.length || !cell.props) continue;
      const p = cell.props;
      const tile = (p.plan.data as { center: THREE.Vector3 }[])[0]!;
      camera.position.copy(tile.center).applyMatrix4(p.root.matrixWorld);
      camera.updateMatrixWorld(true);
      for (let i = 0; i < 400 && !p.root.children.length; i++) { props.update(); await new Promise((r) => setTimeout(r, 5)); }
      if (!p.root.children.length) continue;
      const mine = cell.blend.filter((b) => { let o: THREE.Object3D | null = b.mesh; while (o && o !== p.root) o = o.parent; return o === p.root; });
      assert.ok(mine.length > 0, `${cell.id}: 形の関数の物が照明の混ぜ合わせに入っていない`);
      const sum = (): number => mine.reduce((a, b) => a + (b.mesh.geometry.getAttribute('bakedLight').array as Float32Array).reduce((x, y) => x + y, 0), 0);
      applyLampLevels(cell, () => 1);
      const on = sum();
      applyLampLevels(cell, () => 0);
      const off = sum();
      assert.ok(off < on * 0.95, `${cell.id}: 照明を消しても暗くならない（${off.toFixed(1)} / ${on.toFixed(1)}）`);
      checked++;
    }
    built.dispose();
  }
  props.dispose();
  assert.ok(checked > 0, '照明を入切する区画に作り込む小物が無い（見本のフロアが変わった？）');
});
