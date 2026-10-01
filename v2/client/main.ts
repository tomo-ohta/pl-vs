/**
 * v2 の起動確認用の画面（段階 1 の前の器）。three.js・Rapier（決定論版）・調整表・共有素材が
 * ブラウザで動くことだけを確かめる。本実装の段階 1 で置き換える。
 */
import * as THREE from 'three';
import { loadRapier } from '../core/physics/rapier.ts';
import { makeTuning, parseTuneParam, tuningVersion } from '../core/config/tuning.ts';
import { assetUrl } from './env.ts';

const status = document.getElementById('status')!;
const canvas = document.getElementById('game') as HTMLCanvasElement;
const params = new URLSearchParams(location.search);
const { tuning, errors } = makeTuning(parseTuneParam(params.get('tune')));

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x15161a);
const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 100);
camera.position.set(7, 6, 9);
camera.lookAt(0, 0, 0);
scene.add(new THREE.HemisphereLight(0xfff4e0, 0x202028, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(4, 8, 3);
scene.add(sun);

const resize = (): void => {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
};
addEventListener('resize', resize);
resize();

const R = await loadRapier();
const world = new R.World({ x: 0, y: -9.81, z: 0 });
world.timestep = 1 / tuning['physics.tickHz'];
const floorBody = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased());
world.createCollider(R.ColliderDesc.cuboid(5, 0.1, 5), floorBody);
const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 0.2, 10), new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 0.9 }));
scene.add(floorMesh);

const boxGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
const boxMat = new THREE.MeshStandardMaterial({ color: 0xb8a27a, roughness: 0.7 });
const boxes: { body: ReturnType<typeof world.createRigidBody>; mesh: THREE.Mesh }[] = [];
for (let i = 0; i < 120; i++) {
  const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation((i % 10) * 0.5 - 2.25, 0.4 + Math.floor(i / 10) * 0.45, ((i * 7) % 10) * 0.5 - 2.25));
  world.createCollider(R.ColliderDesc.cuboid(0.2, 0.2, 0.2).setFriction(0.6), body);
  const mesh = new THREE.Mesh(boxGeo, boxMat);
  scene.add(mesh);
  boxes.push({ body, mesh });
}

// 共有素材（shared/public）が読めるか
const assetOk = await fetch(assetUrl('cc0/materials/index.json')).then((r) => r.ok).catch(() => false);

let tick = 0;
let acc = 0;
let last = performance.now();
const dt = 1 / tuning['physics.tickHz'];
renderer.setAnimationLoop((now) => {
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  while (acc >= dt) {
    const a = Math.sin(tick * dt * 0.6) * 0.25; // ゆっくり左右に傾ける
    floorBody.setNextKinematicRotation({ x: 0, y: 0, z: Math.sin(a / 2), w: Math.cos(a / 2) });
    world.step();
    tick++;
    acc -= dt;
  }
  const q = floorBody.rotation();
  floorMesh.quaternion.set(q.x, q.y, q.z, q.w);
  for (const { body, mesh } of boxes) {
    const p = body.translation(); const r = body.rotation();
    mesh.position.set(p.x, p.y, p.z); mesh.quaternion.set(r.x, r.y, r.z, r.w);
  }
  renderer.render(scene, camera);
  status.textContent = [
    'Liminal v2 — 起動確認',
    `three r${THREE.REVISION} / Rapier ${R.version()}（決定論版）/ tick ${tick}`,
    `調整表 ${tuningVersion(tuning)}  隠しの平均 ${tuning['secrets.perFloorMean']}` + (errors.length ? `  誤り: ${errors.join(' / ')}` : ''),
    `共有素材: ${assetOk ? '読めた' : '読めない'}`,
  ].join('\n');
});
