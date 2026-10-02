// 懐中電灯（v1 tests/player-flashlight.mjs から移植 + 姿勢（FlashlightPose）だけで動かせることの確認）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PlayerFlashlight } from '../client/render/PlayerFlashlight.ts';

test('向きの遅れは前方の円錐の内側・落ち着く・歩くと揺れる・止めると揺れない・瞬間移動で古い向きを捨てる・近くでも照度一定・消灯・破棄', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const torch = new PlayerFlashlight(scene);
  const direction = (): THREE.Vector3 => torch.light.target.position.clone().sub(torch.light.position).normalize();
  torch.update(camera, 1 / 60, true);
  camera.rotation.y = Math.PI / 2;
  torch.update(camera, 1 / 60, true);
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const lag = direction().angleTo(forward);
  assert.ok(lag > 0.01 && lag < 0.245, '振り向いたときの遅れは見えている円錐の内側');
  for (let i = 0; i < 60; i++) torch.update(camera, 1 / 60, true);
  assert.ok(direction().angleTo(forward) < 0.004, '視線の向きに落ち着く');
  const stationary = direction();
  let peakSway = 0;
  for (let i = 0; i < 60; i++) {
    camera.position.z -= 0.05;
    torch.update(camera, 1 / 60, true);
    peakSway = Math.max(peakSway, direction().angleTo(stationary));
  }
  assert.ok(peakSway > 0.01, '歩くと光が揺れる');
  assert.ok(torch.light.position.equals(camera.position), '光源は目の位置（近くの壁を手の位置で突き抜けない）');
  const paused = direction();
  torch.update(camera, 0, true);
  assert.ok(direction().distanceTo(paused) < 1e-10, 'メニューで止めている間は揺れない');
  camera.position.set(100, 2, 100);
  camera.rotation.y = Math.PI;
  torch.update(camera, 1 / 60, true, true);
  assert.ok(direction().angleTo(new THREE.Vector3(0, 0, 1)) < 0.004, '瞬間移動で古い向きを捨てる');
  // 近接減光: 照らした面の照度（強度 / 距離²）は 4 m より近くで一定（壁・床に寄っても白く飛ばない）
  const illuminance = (d: number): number => { for (let i = 0; i < 90; i++) torch.update(camera, 1 / 30, true, false, d); return torch.light.intensity / (d * d); };
  const e4 = illuminance(4), e1 = illuminance(1), e05 = illuminance(0.5);
  assert.ok(Math.abs(e1 / e4 - 1) < 0.05 && Math.abs(e05 / e4 - 1) < 0.05, `近い面ほど明るくはならない（照度 4 m ${e4.toFixed(2)}, 1 m ${e1.toFixed(2)}, 0.5 m ${e05.toFixed(2)}）`);
  assert.ok(e4 < 7, '基準距離の照度は控えめ');
  torch.update(camera, 1 / 60, false);
  assert.ok(torch.light.visible && torch.light.intensity === 0 && !torch.light.shadow.autoUpdate, '消灯しても光源の数は変えない（シェーダを作り直さない）が光らない');
  torch.dispose();
  assert.equal(scene.children.length, 0, '破棄で光源と的を外す');
});

test('カメラでなく姿勢（位置 + 向き）だけでも同じに動く（他プレイヤーの懐中電灯）', () => {
  const camera = new THREE.PerspectiveCamera();
  const pose = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };
  const a = new PlayerFlashlight(new THREE.Scene());
  const b = new PlayerFlashlight(new THREE.Scene());
  for (let i = 0; i < 120; i++) {
    camera.position.set(Math.sin(i / 15) * 2, 1.6, -i * 0.03);
    camera.rotation.set(Math.sin(i / 20) * 0.3, i * 0.02, 0);
    pose.position.copy(camera.position);
    pose.quaternion.copy(camera.quaternion);
    a.update(camera, 1 / 60, true, false, 3);
    b.update(pose, 1 / 60, true, false, 3);
    assert.deepEqual(b.light.position.toArray(), a.light.position.toArray());
    assert.deepEqual(b.light.target.position.toArray(), a.light.target.position.toArray());
    assert.equal(b.light.intensity, a.light.intensity);
  }
  a.dispose();
  b.dispose();
});
