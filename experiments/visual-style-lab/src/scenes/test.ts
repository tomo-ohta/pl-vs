import * as THREE from 'three';
import { DEFAULT_STYLE, makeStyle } from '../render/Style.ts';
import { Builder } from './Builder.ts';
import type { SceneDef } from './types.ts';

/** 基盤の動作確認用（タイル・升目の影・水面の映り込み・水たまり・光る板・霧・空） */
const style = makeStyle(DEFAULT_STYLE, {
  name: 'test',
  background: '#bfe9e0',
  fog: { horizon: '#c9f2ea', zenith: '#9fd6d0', ground: '#c9f2ea', density: 0.03, heightFalloff: 0.08, baseHeight: 0, start: 2, max: 0.97, steps: 0, extinction: [1.4, 1.0, 0.9], glow: { color: '#ffffff', strength: 0.15, dir: [0.3, 0.2, -1], power: 6 } },
  toon: { amount: 1, thresholds: [1.5, 0.6, 0.25], soft: 0.01, noiseAmp: 0.05, noiseScale: 1.4, shade: [0.78, 0.9, 10], dark: [0.55, 1, 18], hi: [1.06, 0.6, -4] },
  shadowQuant: 0.3,
  shadowJitter: 0.0,
  post: {
    bloom: { strength: 0.8, threshold: 1.0, radius: 0.7 },
    diffusion: { amount: 0.25, threshold: 0.75, radius: 0.8 },
    lines: { enabled: true, color: '#20363a', width: 1, depth: 0.1, normal: 0.6, id: 0.6, breakup: 0.3, fadeFar: 30, opacity: 0.9 },
    kuwahara: { enabled: false, radius: 4, sharpness: 8, aniso: 1 },
  },
});

export const test: SceneDef = {
  id: 'test',
  label: '基盤の確認',
  style,
  sky: { clouds: 0.3, cloudColor: '#e6fbf6' },
  views: [{ id: 'test-0', label: '全体', eye: [0, 1.6, 6], yaw: 0, pitch: -0.12, fov: 60 }],
  build(ctx) {
    const b = new Builder(ctx);
    const m = ctx.mat;
    const tile = m({ color: '#f2f1e2', shade: '#9fb7a8', dark: '#3e6e6c', tiles: { size: 0.3, line: 0.012, color: '#9fae9f', jitter: 0.03 } });
    // タイルの床（中央に水路）
    b.boxMM(tile, [-10, -0.2, 8], [-1.5, 0, -20], { collide: true });
    b.boxMM(tile, [1.5, -0.2, 8], [10, 0, -20], { collide: true });
    const basin = m({ color: '#e8efe2', shade: '#9fb7a8', tiles: { size: 0.3, line: 0.012, color: '#7aa39a' }, underwater: { level: -0.05, color: '#2f8a86', depth: 0.6, caustics: 0.5 } });
    b.boxMM(basin, [-1.5, -1.0, 8], [1.5, -0.8, -20], { collide: true });
    b.boxMM(basin, [-1.6, -1.0, 8], [-1.5, 0, -20]);
    b.boxMM(basin, [1.5, -1.0, 8], [1.6, 0, -20]);
    const refl = ctx.addReflector({ x: 0, y: -0.05, z: 0 });
    const water = m({ color: '#2b7d7c', shade: '#2b7d7c', dark: '#1e5a5c', toon: 0, roughness: 0.2, reflection: { texture: refl.target.texture, matrix: refl.matrix, strength: 0.85, distort: 0.012, posterize: 4, fresnel: 0.6 }, line: 0 });
    const wm = b.boxMM(water, [-1.5, -0.1, 8], [1.5, -0.05, -20], { shadow: 'receive', merge: false });
    refl.hide.push(wm);
    // 柱
    const col = m({ color: '#f2f1e2', shade: '#9fb7a8', dark: '#3e6e6c', tiles: { size: 0.3, line: 0.012, color: '#9fae9f' } });
    for (let z = 4; z > -20; z -= 4) {
      b.box(col, [-3.5, 2, z], [1.2, 4, 1.2], { collide: true });
      b.box(col, [3.5, 2, z], [1.2, 4, 1.2], { collide: true });
      b.box(col, [0, 4.3, z], [8.2, 0.6, 1.0]);
    }
    // 水たまりの床と光る板
    const reflF = ctx.addReflector({ x: 0, y: 0.001, z: 0 });
    const wet = m({ color: '#2a4d52', shade: '#1d3a40', dark: '#132a30', toon: 0.3, puddle: { scale: 0.35, threshold: 0.12, wetDarken: 0.1 }, reflection: { texture: reflF.target.texture, matrix: reflF.matrix, strength: 0.9, puddleOnly: true, fresnel: 0.3 } });
    const pf = b.boxMM(wet, [6, -0.19, 8], [10, 0.001, -20], { collide: true, merge: false });
    reflF.hide.push(pf);
    const tube = m({ color: '#ffffff', unlit: true, emissive: '#f4ffe8', emissiveIntensity: 6, line: 0 });
    for (let z = 4; z > -20; z -= 4) b.box(tube, [8, 3.2, z], [0.12, 0.05, 1.2], { shadow: false });

    const sun = new THREE.DirectionalLight(0xffffff, 3.4);
    sun.position.set(8, 14, 6);
    sun.target.position.set(0, 0, -6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 50 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.normalBias = 0.02;
    b.root.add(sun, sun.target, new THREE.HemisphereLight(0xe8fff8, 0x8fb0a8, 1.4));
    ctx.setSun(sun);
    b.finalize();
    return { root: b.root, spawn: { pos: [0, 0, 6], yaw: 0 } };
  },
};
