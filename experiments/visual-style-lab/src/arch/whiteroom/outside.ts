import * as THREE from 'three';
import type { Builder } from '../../scenes/Builder.ts';
import { bx, extrudeSection } from './geo.ts';
import type { Mats } from './mats.ts';

/**
 * 建物の外（山の上の敷地）: 建物のまわりの荒れた地面と、遠くの山の稜線（霧に溶ける）。
 * 参考画像の画角の中には写らない（中庭は建物で囲まれている）。テラス・バルコニーの高い所から見える。
 */
export function buildOutside(b: Builder, m: Mats): void {
  const ground = m.get('A', 'ground');
  const hill = m.get('A', 'hill', { brush: false });
  // 敷地の地面（中庭の床より 2 cm 下。建物の下にも敷く）
  bx(b, ground, -160, -0.6, -170, 150, -0.02, 190, { collide: true });
  // 遠くの山（断面を押し出した低い稜線。霧の向こう）
  const ridge = (cx: number, cz: number, w: number, h: number, d: number, yaw: number, seed: number): void => {
    const pts: [number, number][] = [[-w / 2, -1]];
    const n = 9;
    let r = seed * 9301 + 49297;
    const rnd = (): number => {
      r = (r * 16807) % 2147483647;
      return r / 2147483647;
    };
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const env = Math.sin(t * Math.PI);
      pts.push([-w / 2 + t * w, h * (0.25 + 0.75 * env) * (0.75 + rnd() * 0.25)]);
    }
    pts.push([w / 2, -1]);
    const mesh = extrudeSection(b, hill, 'xy', pts, -d / 2, d / 2, { shadow: false });
    // 押し出した形を回して置く（Builder の箱ではないので、メッシュの頂点を直接動かす）
    const mtx = new THREE.Matrix4().makeRotationY(yaw).setPosition(cx, 0, cz);
    mesh.geometry.applyMatrix4(mtx);
  };
  ridge(-20, -230, 260, 38, 30, 0, 1);
  ridge(160, -120, 200, 30, 30, Math.PI / 2, 2);
  ridge(-210, -40, 220, 44, 30, -Math.PI / 2, 3);
  ridge(30, 250, 280, 26, 30, Math.PI, 4);
  ridge(-170, 170, 160, 34, 30, Math.PI * 0.75, 5);
  ridge(150, 170, 160, 22, 30, -Math.PI * 0.75, 6);
}
