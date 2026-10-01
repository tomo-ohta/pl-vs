import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PlayerFlashlight } from '../src/render/PlayerFlashlight.ts';

const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
const torch = new PlayerFlashlight(scene);
const direction = () => torch.light.target.position.clone().sub(torch.light.position).normalize();
torch.update(camera, 1 / 60, true);
camera.rotation.y = Math.PI / 2;
torch.update(camera, 1 / 60, true);
const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
const lag = direction().angleTo(forward);
assert(lag > .01 && lag < .245, 'Turn inertia must remain within the visible forward cone');
for (let i = 0; i < 60; i++) torch.update(camera, 1 / 60, true);
assert(direction().angleTo(forward) < .004, 'Beam must settle on the viewing direction');
const stationary = direction();
let peakSway = 0;
for (let i = 0; i < 60; i++) {
  camera.position.z -= .05; torch.update(camera, 1 / 60, true);
  peakSway = Math.max(peakSway, direction().angleTo(stationary));
}
assert(peakSway > .01, 'Walking must sway the beam');
assert(torch.light.position.equals(camera.position), 'Light origin must not extend through a nearby wall');
const paused = direction();
torch.update(camera, 0, true);
assert(direction().distanceTo(paused) < 1e-10, 'Menu pause must stop sway');
camera.position.set(100, 2, 100); camera.rotation.y = Math.PI;
torch.update(camera, 1 / 60, true, true);
assert(direction().angleTo(new THREE.Vector3(0, 0, 1)) < .004, 'Teleport must clear stale aim');
// 近接減光: 照らした面の照度（強度 / 距離²）は 4 m より近くで一定（壁・床に寄っても白く飛ばない）
const illuminance = (d) => { for (let i = 0; i < 90; i++) torch.update(camera, 1 / 30, true, false, d); return torch.light.intensity / (d * d); };
const e4 = illuminance(4), e1 = illuminance(1), e05 = illuminance(0.5);
assert(Math.abs(e1 / e4 - 1) < 0.05 && Math.abs(e05 / e4 - 1) < 0.05, `Near surfaces must not get brighter (E 4 m ${e4.toFixed(2)}, 1 m ${e1.toFixed(2)}, 0.5 m ${e05.toFixed(2)})`);
assert(e4 < 7, 'Illuminance at the reference distance stays moderate');
torch.update(camera, 1 / 60, false);
assert(torch.light.visible && torch.light.intensity === 0 && !torch.light.shadow.autoUpdate, 'Disabled torch stays in the light count (no program rebuild) but emits nothing');
torch.dispose();
assert.equal(scene.children.length, 0, 'Disposal must release light and target');
console.log('Flashlight: bounded lag, settling, walking sway, pause, teleport, constant near illuminance, disable and disposal passed');
