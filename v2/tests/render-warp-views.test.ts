/**
 * 空間のゆがみ（warp）の描画の煙試験（WebGL は使わない）: 担当の仕掛けを全部置いた見本のフロアを FloorBuilder で組み、
 * 全部の部品の描画を作って、シミュレーションを進めながら update し、dispose する（例外が出ない・窓と枠の板が登録される・消すと外れる）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { defaultTuning } from '../core/config/tuning.ts';
import { WARP_CATALOG } from '../core/gen/catalog/warp.ts';
import { showcaseFloor } from '../core/gen/floor/showcase.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';

test('warp の描画: 見本のフロアの全部の部品の描画を作り、update と dispose が通る・窓と枠の板が登録される', async () => {
  const { MaterialLibrary } = await import('../client/render/MaterialLibrary.ts');
  const { FloorBuilder } = await import('../client/world/FloorBuilder.ts');
  const { PortalRenderer } = await import('../client/world/Portals.ts');
  const { createView } = await import('../client/views/index.ts');
  const t = defaultTuning();
  const ids = [...new Set(WARP_CATALOG.flatMap((e) => e.impl.filter((i) => i.kind === 'gimmick').map((i) => i.id)))];
  const r = showcaseFloor(t, { ids });
  const placed = new Set(r.gimmicks!.gimmicks.map((g) => g.def));
  assert.ok(ids.filter((id) => placed.has(id)).length >= ids.length - 2, `置けた仕掛け ${[...placed].join(',')}`);
  const floor = r.floor;
  const lib = new MaterialLibrary();
  await lib.ready;
  const built = new FloorBuilder(lib).build(floor);
  const sim = new Sim(floor, { tuning: t, physics: new PhysicsWorld(await loadRapier(), 1 / 60) });
  const portals = new PortalRenderer();
  const scene = new THREE.Scene();
  scene.add(built.root);
  const camera = new THREE.PerspectiveCamera(72, 1.6, 0.05, 150);
  const views: { id: string; v: ReturnType<typeof createView> }[] = [];
  const types = new Set<string>();
  for (const e of floor.entities) {
    const root = new THREE.Group();
    built.root.add(root);
    const v = createView(e, { root, materials: lib, built, sim, levelOf: () => 1, camera, scene, portals, onEvent: () => () => {} });
    if (!v) continue;
    views.push({ id: e.id, v });
    if (e.id.startsWith('g:') && ids.some((g) => e.id.startsWith(`g:${g}:`))) types.add(e.type);
  }
  // 担当の描画の種類が作られている
  for (const ty of ['swapSet', 'warpLapHall', 'warpRecede', 'warpTurnRoom', 'warpPortal', 'warpPastWindow', 'warpPhaseLamp', 'warpIndicator']) {
    assert.ok(types.has(ty), `描画 ${ty}（${[...types].join(',')}）`);
  }
  assert.ok(portals.surfaces.size >= 3, `窓と枠の板 ${portals.surfaces.size}`);
  for (let i = 0; i < 120; i++) {
    sim.step([{ ...IDLE_COMMAND }]);
    if (i % 20 !== 0) continue;
    for (const { id, v } of views) { const st = sim.stateOf(id); if (st) v!.update(st, 1 / 3); }
  }
  // 枠の表の前にカメラを置いて描く（描画の器は偽物: 呼ばれた回数を数える）
  const frame = floor.entities.find((e) => e.type === 'warpPortal' && e.id.endsWith('.pSF'));
  if (frame) {
    const c = frame.params.center as number[];
    const d = Number(frame.params.dir) & 3;
    const n = [[0, 1], [1, 0], [0, -1], [-1, 0]][d]!;
    camera.position.set(c[0]! + n[0]! * 2.5, c[1]!, c[2]! + n[1]! * 2.5);
    camera.lookAt(c[0]!, c[1]!, c[2]!);
    camera.updateMatrixWorld();
    let renders = 0, targets = 0;
    const applied: (ReadonlySet<string> | null)[] = [];
    const fake = {
      getDrawingBufferSize: (v: THREE.Vector2) => v.set(800, 500),
      getRenderTarget: () => null,
      setRenderTarget: (rt: unknown) => { if (rt) targets++; },
      clear: () => {},
      render: () => { renders++; },
    } as unknown as THREE.WebGLRenderer;
    portals.render(fake, scene, camera, { applyCells: (cells) => { applied.push(cells); }, visibleFrom: () => new Set([String(frame.params.center)]) });
    assert.equal(renders, 1, '見えて近い枠の向こうを 1 回描く');
    assert.equal(targets, 1);
    assert.ok(applied.length === 2 && applied[0] && applied[1] === null, '区画の見え方を替えて戻す');
    // 枠の裏から（隠しの無い裏は描かない・表の板は裏から見えない）
    camera.position.set(c[0]! - n[0]! * 2.5, c[1]!, c[2]! - n[1]! * 2.5);
    camera.lookAt(c[0]!, c[1]!, c[2]!);
    camera.updateMatrixWorld();
    renders = 0;
    portals.render(fake, scene, camera, { applyCells: () => {}, visibleFrom: () => new Set() });
    const back = floor.entities.find((e) => e.id === frame.id.replace(/\.pSF$/, '.pSB'));
    const backOn = !!back && floor.entities.some((e) => e.type === 'reveal' && Object.values(e.inputs ?? {}).includes(String(back.params.needs)));
    assert.equal(renders, backOn ? 1 : 0, '裏は隠しがあるときだけ描く');
  }
  for (const { v } of views) v!.dispose();
  assert.equal(portals.surfaces.size, 0, '消すと板が外れる');
  sim.physics?.dispose();
});
