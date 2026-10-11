import * as THREE from 'three';
import type { Builder } from '../../scenes/Builder.ts';
import type { SceneContext } from '../../scenes/types.ts';

/**
 * 器具の光の形（足す合成の薄い板）。灯りの光だまり（ctx.addLamp）は目に近い 16 個しか使えないので、回廊の奥まで
 * 「器具ごとの光の形」が見えるように、器具の下・脇に光の形を置く（どれも本物の器具 1 つに 1 つ。器具の無い所には置かない）。
 * - pool: ダウンライトの床の光だまり（縁が少し硬い円）
 * - scallop: 壁の近くの器具が壁に落とす光の山形（上の頂点が明るく、下へ広がって消える）
 * - glow: 器具のまわりの壁の明るみ（壁付け灯の上下の光）
 * 色は頂点の色（器具の色 × 強さ）。形は式で描き、縁は無い（なめらかに 0 まで）。目から遠いほど薄れる（霧の代わり）
 */

type V3 = [number, number, number];

export class LightShapes {
  private readonly pools: number[] = [];
  private readonly poolCol: number[] = [];
  private readonly walls: number[] = [];
  private readonly wallCol: number[] = [];
  private readonly glows: number[] = [];
  private readonly glowCol: number[] = [];

  private quad(arr: number[], col: number[], c: V3, ax: V3, ay: V3, color: THREE.Color, flipV = false): void {
    const p = (sx: number, sy: number): number[] => [c[0] + ax[0] * sx + ay[0] * sy, c[1] + ax[1] * sx + ay[1] * sy, c[2] + ax[2] * sx + ay[2] * sy];
    // 2 つの三角形（uv は位置から: u = sx、v = sy）。uv は build で別に持つ
    const pts = [p(-1, -1), p(1, -1), p(1, 1), p(-1, -1), p(1, 1), p(-1, 1)];
    for (const q of pts) arr.push(...q);
    for (let i = 0; i < 6; i++) col.push(color.r, color.g, color.b);
    void flipV;
  }

  /** 床の光だまり（中心 c・半径 rx, rz・向き yaw） */
  pool(c: V3, rx: number, rz: number, yaw: number, color: string, k: number): void {
    const cs = Math.cos(yaw);
    const sn = Math.sin(yaw);
    this.quad(this.pools, this.poolCol, c, [cs * rx, 0, -sn * rx], [sn * rz, 0, cs * rz], new THREE.Color(color).multiplyScalar(k));
  }

  /** 壁の光の山形: top = 山の頂点（器具の高さのすぐ下・壁の面の上）、n = 壁の外向きの法線の yaw、幅 w・高さ h（下へ） */
  scallop(top: V3, yaw: number, w: number, h: number, color: string, k: number): void {
    const ux: V3 = [Math.cos(yaw) * (w / 2), 0, -Math.sin(yaw) * (w / 2)];
    const uy: V3 = [0, h / 2, 0];
    const c: V3 = [top[0], top[1] - h / 2, top[2]];
    this.quad(this.walls, this.wallCol, c, ux, uy, new THREE.Color(color).multiplyScalar(k));
  }

  /** 壁付け灯のまわりの明るみ（中心 c・幅 w・高さ h） */
  glow(c: V3, yaw: number, w: number, h: number, color: string, k: number): void {
    const ux: V3 = [Math.cos(yaw) * (w / 2), 0, -Math.sin(yaw) * (w / 2)];
    this.quad(this.glows, this.glowCol, c, ux, [0, h / 2, 0], new THREE.Color(color).multiplyScalar(k));
  }

  build(b: Builder, ctx: SceneContext): void {
    void ctx;
    /**
     * 光の形の材質: 形は uv から式で（縁の無いなめらかな減衰）。目からの距離で薄れる（遠くの光だまりが円盤の列にならない）。
     * 場面の描画先は 2 枚（色と情報）なので、情報の側には何も足さない（gInfo = 0、アルファは足さない）
     */
    const mk = (name: string, shape: string, fade: [number, number]): THREE.Material => {
      const m = new THREE.ShaderMaterial({
        name,
        uniforms: { uFade: { value: new THREE.Vector2(fade[0], fade[1]) } },
        vertexColors: true,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          varying vec3 vCol;
          varying float vD;
          void main() {
            vUv = uv;
            vCol = color;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vD = -mv.z;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          layout(location = 1) out highp vec4 gInfo;
          varying vec2 vUv;
          varying vec3 vCol;
          varying float vD;
          uniform vec2 uFade;
          void main() {
            vec2 q = vUv * 2.0 - 1.0;
            float m = 0.0;
            ${shape}
            float f = 1.0 - smoothstep(uFade.x, uFade.y, vD);
            // 負の数の累乗などで数でない値が出ても描画先へ入れない（ブルームで広がるので）
            gl_FragColor = vec4(max(vCol * m * f, vec3(0.0)), 0.0);
            gInfo = vec4(0.0);
          }`,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
        blendSrcAlpha: THREE.ZeroFactor,
        blendDstAlpha: THREE.OneFactor,
      });
      m.polygonOffset = true;
      m.polygonOffsetFactor = -2;
      m.polygonOffsetUnits = -2;
      return m;
    };
    // 光だまり: 中心から縁へなめらかに 0 まで（平らな所も硬い縁も無い）
    const POOL = 'float r2 = dot(q, q); m = pow(max(1.0 - r2, 0.0), 3.0);';
    // 壁の光の山形: 頂点のすぐ下の弧から放物線の縁で広がり、下へ弱まる。縁はぼかす
    const SCALLOP = `
      float d = 1.0 - vUv.y;
      float e = 0.06 + 0.55 * q.x * q.x;
      float inside = smoothstep(e - 0.03, e + 0.3, d);
      float fall = pow(clamp(1.0 - d, 0.0, 1.0), 1.6);
      float h = d - e - 0.15;
      float hot = 0.45 * exp(-h * h * 18.0);
      m = inside * (0.7 * fall + hot) * (1.0 - smoothstep(0.45, 1.0, abs(q.x)));`;
    // 壁付け灯のまわりの明るみ: 縦長の柔らかい楕円
    const GLOW = 'float r2 = dot(q, q); m = pow(max(1.0 - r2, 0.0), 2.5);';
    const geo = (pos: number[], col: number[]): THREE.BufferGeometry => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      const uv: number[] = [];
      const n = pos.length / 18;
      for (let i = 0; i < n; i++) uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.computeVertexNormals();
      return g;
    };
    const add = (pos: number[], col: number[], m: THREE.Material): void => {
      if (!pos.length) return;
      const mesh = new THREE.Mesh(geo(pos, col), m);
      mesh.renderOrder = 4;
      mesh.frustumCulled = false;
      b.root.add(mesh);
    };
    add(this.pools, this.poolCol, mk('fx-pool', POOL, [3, 14]));
    add(this.walls, this.wallCol, mk('fx-scallop', SCALLOP, [5, 20]));
    add(this.glows, this.glowCol, mk('fx-glow', GLOW, [6, 24]));
  }
}
