import * as THREE from 'three';
import { A } from './canalA.ts';
import { C } from './canalC.ts';
import { place, type Env } from './env.ts';
import { Frame } from './frame.ts';
import { VIEWS, WATER, localCam } from './layout.ts';
import { rng } from '../../scenes/Builder.ts';

/**
 * 外（A・C の門の外にだけ見える）: 霧の湖と、遠くの段々の堤（参考画像 squareroom-3 の門の中の段々）と、明るい霞。
 * 湖は門の外にだけ張る（建物の下・部屋の中には水面を出さない）。霞は霧を掛けない明るい大きな板で、その手前の堤は霧で霞む
 */
export function buildOutside(env: Env, lake: THREE.Material, terrace: THREE.Material, terrace2: THREE.Material, stone: THREE.Material): void {
  const fA = new Frame(VIEWS.v2.frame);
  const fC = new Frame(VIEWS.v3.frame);
  const plane = (x0: number, z0: number, x1: number, z1: number): void => {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    g.rotateX(-Math.PI / 2);
    env.b.mesh(g, lake, [(x0 + x1) / 2, WATER - 0.02, (z0 + z1) / 2], { shadow: 'receive' });
  };
  // A の外（世界の x > 門の外の面）・C の外（世界の z < 門の外の面）
  const aOut = fA.p(0, 0, A.endZ - 4)[0];
  const cOut = fC.p(0, 0, C.endZ - 6)[2];
  plane(aOut, -320, aOut + 420, 320);
  plane(-320, cOut - 420, aOut, cOut);

  // 段々の堤（5 段・1 段 0.9 m・4 m ずつ下がる。霧を掛けない淡い灰色: 霞の前の影絵）。局所の座標（水路の奥 -z）で門の先 150 m 余り
  const steps = (f: Frame, zNear: number, half: number): void => {
    for (let i = 0; i < 5; i++) {
      const z0 = zNear - i * 4;
      place(env, f, terrace, { min: [-half + i * 3, -0.5, z0 - 40], max: [half - i * 3, 0.9 * (i + 1), z0] }, { collide: false, shadow: false, noCarve: true });
    }
    // 堤の上の低い建物（箱がいくつか）
    for (let k = 0; k < 9; k++) {
      const x = -half * 0.8 + (k / 8) * half * 1.6 + ((k * 37) % 7) - 3;
      const w = 4 + ((k * 13) % 7);
      const h = 1.2 + ((k * 7) % 4) * 0.6;
      place(env, f, terrace, { min: [x - w / 2, 4.5, zNear - 24 - (k % 3) * 4], max: [x + w / 2, 4.5 + h, zNear - 20 - (k % 3) * 4] }, { collide: false, shadow: false, noCarve: true });
    }
  };
  steps(fC, C.endZ - 160, 110);
  // 湖の向こうの別の積み重ね（霞む立方体の塊の影絵）と、湖に散らばる飛び石の塊。
  // 決まり: 門の外 40〜130 m に、参考画像の視点からは見えない所（門の口の外）にだけ置く。門の抜けまで来ると見える
  const throughGate = gateSight();
  const towers = (f: Frame, z0: number, seed: number): void => {
    const r = rng(seed);
    let placed = 0;
    for (let i = 0; i < 60 && placed < 14; i++) {
      const side = r() < 0.5 ? 1 : -1;
      const x = side * (14 + r() * 90);
      const z = z0 - 40 - r() * 90;
      const w = 8 + Math.floor(r() * 4) * 3.6;
      const d = 8 + Math.floor(r() * 3) * 3.6;
      const h = 14 + r() * 30;
      const foot = f.box([x - w / 2, -1, z - d / 2], [x + w / 2, h, z + d / 2]);
      if (throughGate(foot.min, foot.max)) continue;
      placed++;
      // 3〜4 段に積んで、段ごとに出入りさせる（立方体の積み重ねの輪郭）
      let y = -0.5;
      for (let k = 0; k < 4 && y < h; k++) {
        const hh = 3.6 * (1 + Math.floor(r() * 3));
        const dx = (r() - 0.5) * 7;
        const dz = (r() - 0.5) * 5;
        const ww = w * (0.6 + r() * 0.5);
        place(env, f, terrace2, { min: [x - ww / 2 + dx, y, z - d / 2 + dz], max: [x + ww / 2 + dx, y + hh, z + d / 2 + dz] }, { collide: false, shadow: false, noCarve: true });
        y += hh;
      }
    }
    // 飛び石の塊（湖面から 0.3〜1.2 m 出る 1〜3 m の箱）
    let stones = 0;
    for (let i = 0; i < 120 && stones < 26; i++) {
      const x = (r() - 0.5) * 70;
      const z = z0 - 6 - r() * 45;
      const s = 1 + r() * 2;
      const box = f.box([x - s / 2, -1.5, z - s / 2], [x + s / 2, 0.3 + r() * 0.9, z + s / 2]);
      if (throughGate(box.min, box.max)) continue;
      stones++;
      env.b.boxMM(stone, box.min, box.max, { shadow: true });
    }
  };
  towers(fA, A.endZ - 4, 11);
  towers(fC, C.endZ - 6, 23);
  // 遠くの丘（C の門の向こうの低い丘。参考画像 squareroom-3 の門の中の右の低い影）。霧に溶ける
  for (const [x, z, rx, ry, rz] of [
    [60, C.endZ - 320, 90, 22, 40],
    [-40, C.endZ - 360, 120, 16, 50],
    [150, C.endZ - 300, 70, 28, 40],
  ] as [number, number, number, number, number][]) {
    const c = fC.p(x, 0, z);
    const g = new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    g.scale(rx, ry, rz);
    env.b.mesh(g, terrace2, [c[0], -1, c[2]], { shadow: false });
  }
  // 門の外の明るい霞は霧の光のにじみ（水路ごとの見た目 fog.glow。門の向き）で描く（明るい板を置くと抜けの中から縁が見える）
}

/** 参考画像の視点から門の開口を通して見えるか（世界の箱が開口の画素の長方形と重なるか。壁で隠れる所は見えない） */
export function gateSight(): (min: [number, number, number], max: [number, number, number]) => boolean {
  const fA = new Frame(VIEWS.v2.frame);
  const fC = new Frame(VIEWS.v3.frame);
  const gates = [
    { cam: localCam(VIEWS.v2), f: fA, rect: [A.gate[0], 0, A.endZ, A.gate[1], A.gate[2], A.endZ] },
    { cam: localCam(VIEWS.v3), f: fC, rect: [C.gate[0], 0, C.endZ, C.gate[1], C.gate[2], C.endZ] },
  ].map((g) => {
    const a = g.cam.proj([g.rect[0], g.rect[1], g.rect[2]])!;
    const b = g.cam.proj([g.rect[3], g.rect[4], g.rect[5]])!;
    return { ...g, px: [Math.min(a[0], b[0]) - 30, Math.min(a[1], b[1]) - 30, Math.max(a[0], b[0]) + 30, Math.max(a[1], b[1]) + 30] };
  });
  return (min: [number, number, number], max: [number, number, number]): boolean =>
    gates.some((g) => {
      const l = g.f.boxInv(min, max);
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const x of [l.min[0], l.max[0]]) for (const y of [l.min[1], l.max[1]]) for (const z of [l.min[2], l.max[2]]) {
        const q = g.cam.proj([x, y, z]);
        if (!q) continue;
        x0 = Math.min(x0, q[0]);
        y0 = Math.min(y0, q[1]);
        x1 = Math.max(x1, q[0]);
        y1 = Math.max(y1, q[1]);
      }
      return x1 > g.px[0] && x0 < g.px[2] && y1 > g.px[1] && y0 < g.px[3];
    });
}
