// 描画層の移植の確認（v2 で足した）: Node で import できる・材質のシェーダ注入が three のシェーダに当たる・
// v1 の RoomBuilder と同じ流れ（surfaceBox → uv1 → 見え方の属性 → 頂点の焼き込み → 非インデックス化 → 材質ごとに結合 → forRoom）が
// v2 の CellLayout で通る・ライトマップの焼き込み（Worker の中身を直接呼ぶ）・PostFX の組み立て
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildShell, footprintAABB, rect } from '../core/world/footprint.ts';
import type { Box, CellLayout, MatId, Palette } from '../core/world/layout.ts';

test('Node で import できる（MaterialLibrary / SurfaceGeometry / Lightmap / PostFX）', async () => {
  for (const name of ['MaterialLibrary', 'SurfaceGeometry', 'Lightmap', 'PostFX']) {
    const mod = (await import(`../client/render/${name}.ts`)) as Record<string, unknown>;
    assert.ok(Object.keys(mod).length > 0, name);
  }
});

type ShaderParams = Parameters<THREE.Material['onBeforeCompile']>[0];
const shaderOf = (m: THREE.Material): ShaderParams => {
  const src = (m as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial ? THREE.ShaderLib.physical : THREE.ShaderLib.standard;
  const s = { vertexShader: src.vertexShader, fragmentShader: src.fragmentShader, uniforms: {} } as unknown as ShaderParams;
  m.onBeforeCompile(s, null as unknown as THREE.WebGLRenderer);
  return s;
};

test('document が無くても MaterialLibrary を作れる・全材質の注入が three の #include に当たる', async () => {
  const { MaterialLibrary, SURFACES } = await import('../client/render/MaterialLibrary.ts');
  const lib = new MaterialLibrary();
  await lib.ready;
  assert.equal(lib.cc0Status.index, 'missing', 'Node では CC0 の索引を読まない（従来の生成テクスチャ）');
  const overrides = [{}, { style: 'legacy' as const }, { style: 'untextured' as const }, { fog: { color: 0x223344, near: 2, far: 25 }, colorMask: [1, 0.5, 0.5] as [number, number, number] }];
  for (const id of Object.keys(SURFACES) as MatId[]) {
    for (const o of overrides) {
      const m = lib.variant(id, o);
      const s = shaderOf(m);
      const key = m.customProgramCacheKey();
      if (id === 'outsideView' && !o.style) {
        assert.ok(s.fragmentShader.includes('totalEmissiveRadiance = liminalOutside();'), 'outsideView の注入');
        assert.equal(key, 'liminal-outside-v1');
        continue;
      }
      const label = `${id} ${JSON.stringify(o)}`;
      assert.match(key, /^liminal-pbr-v4-/, label);
      // injectCommon の各差し込み先（begin_vertex / project_vertex / lights_fragment_maps / lights_fragment_end / map_fragment / emissivemap_fragment / opaque_fragment）
      assert.ok(s.vertexShader.includes('vBakedLight = bakedLight;'), `${label}: begin_vertex`);
      assert.ok(s.vertexShader.includes('vRoomFogDepth = -mvPosition.z;'), `${label}: project_vertex`);
      assert.ok(s.fragmentShader.includes('iblIrradiance *= liminalIblDiffuse;'), `${label}: lights_fragment_maps`);
      assert.ok(s.fragmentShader.includes('reflectedLight.indirectDiffuse +='), `${label}: lights_fragment_end`);
      assert.ok(s.fragmentShader.includes('diffuseColor.rgb *= colorMask;'), `${label}: map_fragment`);
      assert.ok(s.fragmentShader.includes('totalEmissiveRadiance *= colorMask;'), `${label}: emissivemap_fragment`);
      assert.ok(s.fragmentShader.includes('if (surfaceDiagnostic == 1)'), `${label}: opaque_fragment`);
      if (o.fog) assert.ok(s.fragmentShader.includes('smoothstep(roomFogNear, roomFogFar, vRoomFogDepth)'), `${label}: fog_fragment`);
    }
  }
  // 水面: 法線の揺らぎ（normal_fragment_maps）と、透過の水深（transmission_fragment の文字列置換）が当たっている
  const water = shaderOf(lib.get('water'));
  assert.ok(water.fragmentShader.includes('normal = liminalWaterNormal(normal);'));
  assert.ok(water.fragmentShader.includes('material.thickness = thickness * waterDepth;'), 'three の transmission_fragment の文字列が変わると水深が効かなくなる');
  assert.ok(water.fragmentShader.includes('material.diffuseContribution = mix(vec3(1.0), material.diffuseContribution,'));
  // 色ムラ・擦れ（addSurfaceAppearance）は map_fragment の中身を展開して置き換える
  assert.ok(shaderOf(lib.get('wallWhite')).fragmentShader.includes('sampledDiffuseColor.rgb*=wearColor;'), 'three の map_fragment の文字列が変わると色ムラが効かなくなる');
  lib.dispose();
});

const PALETTE: Palette = { floor: 'floorCarpetGrey', wall: 'wallBeige', ceiling: 'ceilingTile', door: 'doorWood', light: 'lightPanel', lightColor: 0xfff1d8, lightIntensity: 1, ambient: 0x8a8678, fog: 0x202020 };

test('区画の描画上書き → 材質の上書き（v1 の RoomBuilder の overridesFor と同じ）・器具の発光だけが色温度に染まる', async () => {
  const { MaterialLibrary, materialOverridesFor, wetnessOverrides } = await import('../client/render/MaterialLibrary.ts');
  assert.deepEqual(materialOverridesFor(undefined, undefined), {});
  const fog = { color: 0x112233, near: 3, far: 30 };
  assert.deepEqual(
    materialOverridesFor({ wetness: 0.5, floorWetness: 0.3, colorMask: [1, 0.5, 0.5], style: 'legacy', fog }, PALETTE),
    { ...wetnessOverrides(0.5), floorWetness: 0.3, lightTint: PALETTE.lightColor, colorMask: [1, 0.5, 0.5], style: 'legacy', fog },
  );
  assert.equal(materialOverridesFor({ style: 'untextured' }, undefined).style, undefined, 'untextured は材質 ID の差し替えで表す');
  const lib = new MaterialLibrary();
  const o = materialOverridesFor(undefined, { ...PALETTE, lightColor: 0xffa060 });
  assert.notEqual(lib.variant('lightPanel', o).emissive.getHex(), lib.get('lightPanel').emissive.getHex(), '器具の発光面は色温度に追従');
  assert.equal(lib.variant('wallWhite', o), lib.get('wallWhite'), '器具以外は共有材質のまま');
  assert.equal(lib.variant('screenArcade', o), lib.get('screenArcade'), '画面の絵は染めない');
  lib.dispose();
});

/** L 字の区画: 外殻（buildShell）+ 天井の器具 3 台 + 机・棚・窓 */
function sampleCell(): CellLayout {
  const footprint = [rect(0, 0, 8, 6), rect(8, 0, 12, 14)];
  const height = 2.7;
  const boxes: Box[] = [];
  buildShell(boxes, footprint, height, [{ id: 'd0', pos: [4, 0, 6], dir: 0, width: 1, height: 2.1 }], { floor: PALETTE.floor, wall: PALETTE.wall, ceiling: PALETTE.ceiling });
  const B = (min: Box['min'], max: Box['max'], mat: MatId, solid = true): Box => ({ min, max, mat, solid });
  boxes.push(
    B([2, 2.62, 2], [3.2, 2.68, 2.6], 'lightPanel', false), B([5, 2.62, 3], [6.2, 2.68, 3.6], 'lightPanel', false), B([9.5, 2.62, 9], [10.7, 2.68, 9.6], 'lightWarm', false),
    B([1, 0, 1], [2.4, 0.75, 1.8], 'furnitureDark'), B([4, 0, 4], [4.8, 1.8, 4.4], 'shelfMetal'), B([11.9, 1, 8], [12, 2, 10], 'windowLit', false),
  );
  return { id: 'c0', role: 'hub', bounds: footprintAABB(footprint, height), footprint, height, floorY: 0, palette: PALETTE, boxes, lights: [{ pos: [3, 2.4, 3], color: 0xfff1d8, intensity: 1, distance: 9 }], zones: [] };
}

test('v1 の RoomBuilder と同じ流れが CellLayout で通る（頂点焼き込み → 結合 → forRoom + ライトマップ）', async () => {
  const { MaterialLibrary, SURFACES } = await import('../client/render/MaterialLibrary.ts');
  const { surfaceBox, SurfaceLighting } = await import('../client/render/SurfaceGeometry.ts');
  const { appearanceSeed, attachSurfaceAppearance } = await import('../client/render/SurfaceAppearance.ts');
  const { attachWindowRoom, WINDOW_ROOM_MATS } = await import('../client/render/WindowRoom.ts');
  const { allocateLightmapAtlas, createLightmapTexture, isLightmapTarget, LightmapBaker, LightmapSampler, lightmapsSupported, writeConstantUV1, writeLightmapUV, LIGHTMAP_TIER } = await import('../client/render/Lightmap.ts');
  const { bakeLightmap } = await import('../client/render/lightmap.worker.ts');

  const cell = sampleCell();
  const lib = new MaterialLibrary();
  const lighting = new SurfaceLighting(cell);
  assert.ok(lighting.fixtures.length > 0, '発光箱が器具になる');
  // ライトマップの対象と割り当て（mid Tier の設定）
  const cfg = LIGHTMAP_TIER.mid!;
  const parts = cell.boxes.map((b) => ({ b, target: -1 }));
  const targets: Box[] = [];
  for (const p of parts) if (isLightmapTarget(p.b, !!SURFACES[p.b.mat].emission, !!SURFACES[p.b.mat].decal)) p.target = targets.push(p.b) - 1;
  const shell = cell.boxes.filter((b) => b.solid && /^(floor|ceiling|wall)/.test(b.mat));
  const atlas = allocateLightmapAtlas(targets, { texel: cfg.texel, maxSize: cfg.maxSize, footprint: cell.footprint, bounds: cell.bounds, shell });
  if (!atlas) throw new Error('アトラスを割り当てられない');
  assert.ok(atlas.faceCount > 0, '面がある');
  const lmTex = createLightmapTexture(atlas.width, atlas.height);

  const byMat = new Map<MatId, THREE.BufferGeometry[]>();
  const litMats = new Set<MatId>();
  for (const { b, target } of parts) {
    let g = surfaceBox(b);
    if (WINDOW_ROOM_MATS.has(b.mat)) attachWindowRoom(g, b.min, b.max);
    if (target >= 0) { if (writeLightmapUV(g, b, atlas.rects[target], atlas).length) litMats.add(b.mat); } else writeConstantUV1(g, atlas.blackU, atlas.blackV);
    attachSurfaceAppearance(g, appearanceSeed(7, cell.id, b.mat), [0, 0, 0, 0], b.environment ?? [0, 0, 0, 0]);
    lighting.bake(g, b);
    const baked = g.getAttribute('bakedLight').array as Float32Array;
    assert.ok(baked.every(Number.isFinite), `${b.mat}: 焼き込みが有限`);
    if (g.index) { const flat = g.toNonIndexed(); g.dispose(); g = flat; }
    const list = byMat.get(b.mat) ?? [];
    list.push(g);
    byMat.set(b.mat, list);
  }
  assert.ok(litMats.has('floorCarpetGrey') && litMats.has('wallBeige'), '外殻はライトマップの対象');
  for (const [mat, geos] of byMat) {
    const merged = mergeGeometries(geos, false);
    assert.ok(merged, `${mat}: 同じ属性の集合で結合できる`);
    for (const name of ['position', 'normal', 'uv', 'uv1', 'bakedLight', 'surfaceSeed', 'surfaceWear', 'surfaceEnvironment']) assert.ok(merged.getAttribute(name), `${mat}: ${name}`);
    const material = litMats.has(mat) ? lib.forRoom(mat, { roomId: cell.id, seed: 7, lightMap: lmTex, palette: cell.palette, height: cell.height }) : lib.variant(mat, {});
    if (litMats.has(mat)) {
      assert.equal(material.lightMap, lmTex, `${mat}: 部屋専用の clone にライトマップ`);
      assert.match(material.customProgramCacheKey(), /-lm$/);
    }
    merged.dispose();
  }
  // 床の頂点焼き込みは器具の下で明るい
  const floor = cell.boxes.find((b) => b.mat === 'floorCarpetGrey')!;
  const fg = surfaceBox(floor);
  lighting.bake(fg, floor);
  const fb = fg.getAttribute('bakedLight').array as Float32Array;
  assert.ok(Math.max(...fb) > 0.05, '床が照らされている');

  // ライトマップ（Node には Worker が無いので、Worker の中身 bakeLightmap を直接呼ぶ。LightmapBaker は失敗を返す）
  assert.equal(lightmapsSupported(), false);
  const failed = await new Promise<string>((resolve) => LightmapBaker.shared.enqueue({ ...lighting.payload(), width: atlas.width, height: atlas.height, faces: atlas.faces.slice(), aoRays: cfg.aoRays }, () => true, () => resolve('done'), (reason) => resolve(reason)));
  assert.equal(failed, 'unsupported');
  const res = bakeLightmap({ ...lighting.payload(), type: 'bake', id: 1, width: atlas.width, height: atlas.height, faces: atlas.faces.slice(), aoRays: 8 });
  assert.ok(res.stats.faces === atlas.faceCount && res.stats.mean > 0, '面のテクセルが焼ける');
  const sampler = new LightmapSampler(atlas, res.data);
  const out: [number, number, number] = [0, 0, 0];
  assert.ok(sampler.sampleBelow(2.6, 0.5, 2.3, out) && out[1] > 0, '床のライトマップを CPU で読める');

  lib.releaseRoom(cell.id);
  lib.dispose();
});

test('PostFX: GL の無い所でも pass の組み立てまで（構成が同じでプリセットだけ変わったら作り直さない）', async () => {
  const { PostFX } = await import('../client/render/PostFX.ts');
  const { LensPass } = await import('../client/render/LensPass.ts');
  const { VideoPass } = await import('../client/render/VideoPass.ts');
  const { GTAOPass } = await import('three/addons/postprocessing/GTAOPass.js');
  const { UnrealBloomPass } = await import('three/addons/postprocessing/UnrealBloomPass.js');
  const { OutputPass } = await import('three/addons/postprocessing/OutputPass.js');
  const { RenderPass } = await import('three/addons/postprocessing/RenderPass.js');
  // EffectComposer の組み立てに要る分だけの代わりの renderer（描画はしない）
  const fake = { getContext: () => ({}), getPixelRatio: () => 1, getSize: (v: THREE.Vector2) => v.set(800, 450) } as unknown as THREE.WebGLRenderer;
  const fx = new PostFX(fake, new THREE.Scene(), new THREE.PerspectiveCamera());
  fx.configure({ gtao: false, bloom: false, msaa: 0, gtaoScale: 0.5, film: 'off' });
  assert.equal(fx.active, false);
  assert.equal(fx.describe(), 'direct');
  fx.configure({ gtao: true, bloom: true, msaa: 2, gtaoScale: 0.4, film: 'homeVideo' });
  const passes = fx.composer!.passes;
  const kinds = [RenderPass, GTAOPass, UnrealBloomPass, LensPass, OutputPass, VideoPass];
  assert.equal(passes.length, kinds.length);
  passes.forEach((p, i) => assert.ok(p instanceof kinds[i], `pass ${i}`));
  assert.equal(fx.describe(), 'gtao×0.4+bloom+msaa2+film:homeVideo');
  const composer = fx.composer;
  fx.configure({ gtao: true, bloom: true, msaa: 2, gtaoScale: 0.4, film: 'tape' });
  assert.equal(fx.composer, composer, 'プリセットだけの変更は数値を写すだけ');
  fx.setSize(800, 450, 1.25);
  fx.configure({ gtao: false, bloom: true, msaa: 0, gtaoScale: 0.5, film: 'clean' });
  assert.notEqual(fx.composer, composer, '構成が変われば作り直す');
  fx.dispose();
  assert.equal(fx.composer, null);
});
