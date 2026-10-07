import * as THREE from 'three';
import { Colliders } from './core/Colliders.ts';
import { Input } from './core/Input.ts';
import { Player } from './core/Player.ts';
import { PlanarReflector } from './render/PlanarReflector.ts';
import { Post } from './render/Post.ts';
import { createSky } from './render/Sky.ts';
import { drawPlan, spacePoly, type PlanTourStop } from './arch/plan.ts';
import { imageStats, palette, rng, toLab, type ImageStats } from './core/Quality.ts';
import { Film } from './render/Film.ts';
import { applyStyleUniforms, styleUniforms, type StylePreset } from './render/Style.ts';
import { createStyleMaterial } from './render/StyleMaterial.ts';
import { LampSet } from './render/Lamps.ts';
import type { SceneEntry } from './scenes/index.ts';
import type { BuiltScene, SceneContext, SceneDef, ViewDef } from './scenes/types.ts';

export const REF_W = 1456;
export const REF_H = 816;

/** テストステージの本体: 場面の読み込み・視点・描画・撮影 */
export class App {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera = new THREE.PerspectiveCamera(60, REF_W / REF_H, 0.05, 1200);
  readonly input: Input;
  readonly player: Player;
  readonly colliders = new Colliders();
  readonly post: Post;
  /** カメラ効果（VHS）。描画効果 'off' なら何もしない */
  readonly film: Film;
  readonly scene = new THREE.Scene();
  /** 灯りの光だまり（場面の build で ctx.addLamp） */
  readonly lamps = new LampSet();
  def: SceneDef | null = null;
  built: BuiltScene | null = null;
  view: ViewDef | null = null;
  style!: StylePreset;
  sun: THREE.DirectionalLight | null = null;
  /** 'v1' = 元の版、'arch' = 建築版（間取り図から作った場面） */
  variant: 'v1' | 'arch' = 'v1';
  /** 参考画像の比率で描く（false で画面いっぱい） */
  letterbox = true;
  /** 時間を止める（撮影用） */
  frozen = false;
  time = 0;
  fps = 0;
  private last = performance.now();
  private frames = 0;
  private fpsT = 0;
  private pixelRatio = Math.min(window.devicePixelRatio, 1.5);
  private fixedSize: [number, number] | null = null;
  onChange: (() => void) | null = null;

  private readonly defs = new Map<string, SceneDef>();
  loading = false;

  constructor(readonly container: HTMLElement, readonly scenes: SceneEntry[], opts: { persistFilm?: boolean } = {}) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // 合成の最後で sRGB にする
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.autoClear = false;
    this.renderer.info.autoReset = false; // 1 フレーム分（反射・後処理も含む）を数える
    container.appendChild(this.renderer.domElement);
    this.input = new Input(this.renderer.domElement);
    this.player = new Player(this.camera);
    this.camera.layers.enable(1); // 1 番 = 映り込みに出さない物（PlanarReflector が外す）。2 番 = 映り込みにだけ出す物（画面のカメラは描かない）
    this.post = new Post(this.renderer);
    // REC 表示は描画の枠（参考画像の比率の枠）の中に出す
    const frame = document.createElement('div');
    frame.className = 'film-frame';
    container.appendChild(frame);
    this.film = new Film(this.scene, this.camera, frame, opts.persistFilm ?? true);
    this.post.setFilm(this.film);
    this.film.onChange = () => {
      if (!this.film.active) {
        // 効果を切ったら、手持ち感のズームで変わった画角を戻す
        this.camera.fov = this.film.rig.baseFov;
        this.camera.updateProjectionMatrix();
      }
      this.onChange?.();
    };
    window.addEventListener('resize', () => this.resize());
  }

  /** 場面の定義を読み込む（遅れて import） */
  async getDef(id: string): Promise<SceneDef> {
    const e = this.scenes.find((s) => s.id === id) ?? this.scenes[0];
    let d = this.defs.get(e.id);
    if (!d) {
      d = await e.load();
      this.defs.set(e.id, d);
    }
    return d;
  }

  /** 場面を読み込む。viewId が無ければ最初の視点 */
  async load(id: string, viewId?: string | null): Promise<void> {
    this.loading = true;
    let def: SceneDef;
    try {
      def = await this.getDef(id);
    } finally {
      this.loading = false;
    }
    this.unload();
    this.def = def;
    this.style = def.style;
    applyStyleUniforms(this.style);
    this.post.style = this.style;
    this.scene.clear();
    this.colliders.clear();
    this.lamps.clear();
    this.sun = null;
    const ctx: SceneContext = {
      style: def.style,
      renderer: this.renderer,
      colliders: this.colliders,
      mat: (o) => createStyleMaterial(def.style, o),
      addReflector: (point, normal, scale) => {
        const r = new PlanarReflector(point, normal, scale);
        r.setSize(this.post.width, this.post.height);
        this.post.reflectors.push(r);
        return r;
      },
      setSun: (l) => (this.sun = l),
      updateShadows: () => (this.renderer.shadowMap.needsUpdate = true),
      addLamp: (l) => this.lamps.add(l),
    };
    this.renderer.shadowMap.autoUpdate = true; // 場面の build が変えてもよい
    this.built = def.build(ctx);
    if (this.built.staticShadows) this.renderer.shadowMap.autoUpdate = false;
    this.scene.add(this.built.root);
    if (def.sky !== false) this.scene.add(createSky(def.sky ?? {}));
    this.renderer.shadowMap.needsUpdate = true;
    const sp = this.built.spawn;
    this.player.setSpawn({ x: sp.pos[0], y: sp.pos[1], z: sp.pos[2] }, sp.yaw, sp.pitch ?? 0);
    this.camera.fov = def.views[0]?.fov ?? 60;
    this.camera.updateProjectionMatrix();
    this.film.snap(this.camera, this.player.yaw, this.player.pitch);
    this.view = null;
    const vid = viewId === undefined ? def.views[0]?.id : viewId;
    if (vid) this.setView(vid);
    else this.player.applyCamera();
    this.resize();
    this.onChange?.();
  }

  private unload(): void {
    this.built?.dispose?.();
    for (const r of this.post.reflectors) r.dispose();
    this.post.reflectors.length = 0;
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mm of mats) {
          for (const v of Object.values(mm)) if (v instanceof THREE.Texture) v.dispose();
          mm.dispose();
        }
      }
    });
    this.built = null;
  }

  /** 参考画像の視点へ移る */
  setView(id: string | null): void {
    if (!this.def) return;
    const v = id ? this.def.views.find((x) => x.id === id) : undefined;
    this.view = v ?? null;
    this.setStyle(v?.style ?? this.def.style);
    if (!v) return;
    this.camera.fov = v.fov;
    this.camera.updateProjectionMatrix();
    this.player.placeEye({ x: v.eye[0], y: v.eye[1], z: v.eye[2] }, v.yaw, v.pitch, v.roll ?? 0, this.colliders);
    this.player.applyCamera();
    this.film.snap(this.camera, v.yaw, v.pitch);
    this.onChange?.();
  }

  setStyle(s: StylePreset): void {
    this.style = s;
    applyStyleUniforms(s);
    this.post.style = s;
  }

  resize(): void {
    let w: number;
    let h: number;
    const cw = window.innerWidth;
    const ch = window.innerHeight;
    if (this.fixedSize) {
      [w, h] = this.fixedSize;
    } else if (this.letterbox) {
      const a = REF_W / REF_H;
      if (cw / ch > a) {
        h = ch;
        w = Math.round(ch * a);
      } else {
        w = cw;
        h = Math.round(cw / a);
      }
    } else {
      w = cw;
      h = ch;
    }
    const pr = this.fixedSize ? 1 : this.pixelRatio;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h);
    const el = this.renderer.domElement;
    el.style.left = `${Math.round((cw - w) / 2)}px`;
    el.style.top = `${Math.round((ch - h) / 2)}px`;
    this.container.style.setProperty('--vw', `${w}px`);
    this.container.style.setProperty('--vh', `${h}px`);
    this.container.style.setProperty('--vx', `${Math.round((cw - w) / 2)}px`);
    this.container.style.setProperty('--vy', `${Math.round((ch - h) / 2)}px`);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.post.setSize(Math.round(w * pr), Math.round(h * pr));
  }

  start(): void {
    const loop = (): void => {
      requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min((now - this.last) / 1000, 0.1);
      this.last = now;
      this.step(dt);
      this.frames++;
      this.fpsT += dt;
      if (this.fpsT > 0.5) {
        this.fps = this.frames / this.fpsT;
        this.frames = 0;
        this.fpsT = 0;
      }
    };
    requestAnimationFrame(loop);
  }

  step(dt: number): void {
    if (!this.frozen) this.time += dt;
    styleUniforms.uTime.value = this.time;
    const before = this.player.pos.clone();
    this.player.externalCamera = this.film.active;
    this.player.update(dt, this.input, this.colliders);
    if (this.view && before.distanceToSquared(this.player.pos) > 1e-6) {
      // 歩き出したら視点の上書きはそのまま、表示だけ「自由」に
      this.view = null;
      this.onChange?.();
    }
    this.input.endFrame();
    const pl = this.player;
    this.film.updateCamera(dt, { pos: pl.pos, yaw: pl.yaw, pitch: pl.pitch, eye: pl.eyeHeight, onGround: pl.onGround, crouching: pl.height < 1.5 });
    this.film.update(dt);
    this.built?.update?.(dt, this.time, this.camera);
    this.applyZoneStyle();
    this.renderFrame();
  }

  /** カメラが入っている区域の見た目にする（区域の外ならそのまま） */
  applyZoneStyle(): void {
    const zones = this.built?.styleZones;
    if (!zones) return;
    const p = this.camera.position;
    const z = zones.find((s) => p.x >= s.min[0] && p.x <= s.max[0] && p.y >= s.min[1] && p.y <= s.max[1] && p.z >= s.min[2] && p.z <= s.max[2]);
    if (z && z.style !== this.style) this.setStyle(z.style);
  }

  renderFrame(): void {
    this.built?.beforeRender?.(this.camera);
    this.lamps.update(this.camera.position);
    if (this.sun) {
      styleUniforms.uSunShadowMatrix.value.copy(this.sun.shadow.matrix);
      styleUniforms.uSunShadowNormalBias.value = this.sun.shadow.normalBias;
    }
    this.camera.updateMatrixWorld();
    this.renderer.info.reset();
    this.post.render(this.scene, this.camera);
    // 影の行列は影の描画で更新されるので、最初のフレームの後にもう一度合わせる
    if (this.sun) styleUniforms.uSunShadowMatrix.value.copy(this.sun.shadow.matrix);
  }

  /**
   * 真上から見た図（間取りの確かめ用）。cut（m）より上は切り取って中を見せる。視点の位置・向き・横の画角を描き込む。
   * 図は上が奥（-Z）、右が +X
   */
  async topDownMap(cut = 2.2, px = 1400, overlay = true): Promise<{ image: string; bounds: [number, number, number, number] }> {
    const box = new THREE.Box3();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || o.name === 'sky' || !m.visible) return;
      const b = new THREE.Box3().setFromObject(m);
      if (Number.isFinite(b.min.x) && b.max.x - b.min.x < 300 && b.max.z - b.min.z < 300) box.union(b); // 地面・遠景の大きな板は範囲に入れない
    });
    for (const v of this.def?.views ?? []) box.expandByPoint(new THREE.Vector3(...v.eye));
    const pad = 2;
    const x0 = box.min.x - pad;
    const x1 = box.max.x + pad;
    const z0 = box.min.z - pad;
    const z1 = box.max.z + pad;
    const w = x1 - x0;
    const d = z1 - z0;
    const W = w >= d ? px : Math.round((px * w) / d);
    const H = w >= d ? Math.round((px * d) / w) : px;
    // 真上から見下ろす正射影（画像の上 = -Z）
    const cam = new THREE.OrthographicCamera(x0, x1, -z0, -z1, 0.1, 4000);
    cam.position.set(0, box.max.y + 50, 0);
    cam.up.set(0, 0, -1);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
    const r = this.renderer;
    const prevSize = r.getSize(new THREE.Vector2());
    const prevPR = r.getPixelRatio();
    r.setPixelRatio(1);
    r.setSize(W, H, false);
    r.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), cut)];
    const sky = this.scene.getObjectByName('sky');
    if (sky) sky.visible = false;
    this.built?.beforeRender?.(cam, { map: true });
    // 真上の図は霧なし（場面の材質は styleUniforms の霧の濃さを読む）
    const fogDensity = styleUniforms.uFogParams.value.x;
    styleUniforms.uFogParams.value.x = 0;
    r.setRenderTarget(null);
    r.setClearColor(0x101418, 1);
    r.clear();
    r.render(this.scene, cam);
    styleUniforms.uFogParams.value.x = fogDensity;
    this.built?.beforeRender?.(this.camera);
    const raw = r.domElement.toDataURL('image/png');
    if (sky) sky.visible = true;
    r.clippingPlanes = [];
    r.setPixelRatio(prevPR);
    r.setSize(prevSize.x, prevSize.y, false);
    this.resize();
    if (!overlay) return { image: raw, bounds: [x0, z0, x1, z1] };
    const img = await loadImage(raw);
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0);
    const toPx = (x: number, z: number): [number, number] => [((x - x0) / w) * W, ((z - z0) / d) * H];
    g.lineWidth = 2;
    g.font = 'bold 14px sans-serif';
    for (const v of this.def?.views ?? []) {
      const [vx, vz] = toPx(v.eye[0], v.eye[2]);
      const hf = Math.atan(Math.tan(THREE.MathUtils.degToRad(v.fov) / 2) * (REF_W / REF_H));
      const len = Math.min(W, H) * 0.12;
      g.strokeStyle = '#ffcc33';
      g.fillStyle = 'rgba(255, 204, 51, 0.2)';
      g.beginPath();
      g.moveTo(vx, vz);
      for (const sgn of [-1, 1]) {
        const a = v.yaw + sgn * hf;
        g.lineTo(vx - Math.sin(a) * len, vz - Math.cos(a) * len);
      }
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = '#ffcc33';
      g.fillText(v.id, vx + 6, vz - 6);
    }
    g.fillStyle = '#ffffff';
    g.fillText(`${w.toFixed(0)} × ${d.toFixed(0)} m（上が奥 -Z）・高さ ${cut} m より上を切り取り`, 10, H - 10);
    return { image: c.toDataURL('image/png'), bounds: [x0, z0, x1, z1] };
  }

  /** 間取り図の画像（建築版）。top = true なら作った場面の真上の図を下に敷いて重ねる（図どおりに作れているか） */
  async planImage(o: { level?: number; top?: boolean; cut?: number } = {}): Promise<string | null> {
    const plan = this.def?.plan;
    if (!plan) return null;
    const views = (this.def?.views ?? []).map((v) => ({ id: v.id, eye: v.eye, yaw: v.yaw, fov: v.fov, reach: this.viewFan(v.eye, v.yaw, v.fov) }));
    const c = document.createElement('canvas');
    if (o.top) {
      const t = await this.topDownMap(o.cut ?? 2.2, 1600, false);
      const img = await loadImage(t.image);
      drawPlan(plan, c, { level: o.level, views, under: { image: img, bounds: t.bounds }, bounds: t.bounds, px: 1600 });
    } else {
      drawPlan(plan, c, { level: o.level, views });
    }
    return c.toDataURL('image/png');
  }

  /**
   * 歩いて行けるかの確かめ（建築版）。出発点（spawn）から当たり判定の上を 0.3 m の升目で歩き広げ（段差 0.36 m まで上る・4 m まで落ちる・
   * しゃがめば 1.12 m の隙間を通れる）、参考画像の視点・道順の各点に届くかを返す。届いた範囲は間取り図の上に点で描ける。
   * wadeMax を渡すと、水深がそれより深い床（Box.depth）には入らない（「泳がないと行けない所」を見つける）
   */
  reach(step = 0.3, wadeMax = Infinity): { views: Record<string, boolean>; tour: Record<string, boolean>; cells: number; points: [number, number, number][] } {
    const col = this.colliders;
    // 近づくと開く扉は開いているものとして歩く（撮影の後などで扉が閉じていても結果が変わらないように）
    const doors = col.boxes.filter((b) => b.passable);
    const doorState = doors.map((b) => b.enabled);
    for (const b of doors) b.enabled = false;
    try {
      return this.reachInner(step, wadeMax);
    } finally {
      doors.forEach((b, i) => (b.enabled = doorState[i]));
    }
  }

  private reachInner(step: number, wadeMax: number): { views: Record<string, boolean>; tour: Record<string, boolean>; cells: number; points: [number, number, number][] } {
    const col = this.colliders;
    const R = 0.26;
    const STEP = 0.36;
    const CROUCH = 1.12;
    const sp = this.built?.spawn.pos ?? [0, 0, 0];
    const g0 = col.groundBelow(sp[0], sp[2], R, sp[1] + STEP);
    const start: [number, number, number] = [sp[0], Number.isFinite(g0.y) ? g0.y : sp[1], sp[2]];
    const key = (x: number, z: number, y: number): string => `${Math.round(x / step)},${Math.round(z / step)},${Math.round(y * 5)}`;
    const seen = new Set<string>([key(...start)]);
    const pts: [number, number, number][] = [start];
    const q: [number, number, number][] = [start];
    const tmp = new THREE.Vector3();
    const LIMIT = 1500000;
    while (q.length && seen.size < LIMIT) {
      const [x, y, z] = q.pop()!;
      for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
        const nx = x + dx;
        const nz = z + dz;
        const g = col.groundBelow(nx, nz, R, y + STEP);
        if (!Number.isFinite(g.y) || g.y < y - 4) continue;
        if (g.depth > wadeMax) continue;
        // 壁: しゃがんだ体（段差より上〜1.12 m）が押し出されるなら通れない
        tmp.set(nx, g.y, nz);
        col.pushOut(tmp, R, g.y + STEP, g.y + CROUCH);
        if (Math.hypot(tmp.x - nx, tmp.z - nz) > 0.05) continue;
        // 落ちる前に今の高さで横へ動けるか（床の板を突き抜けて下の階へ落ちない）
        if (g.y < y - STEP) {
          tmp.set(nx, y, nz);
          col.pushOut(tmp, R, y + STEP, y + CROUCH);
          if (Math.hypot(tmp.x - nx, tmp.z - nz) > 0.05) continue;
        }
        if (col.ceilingAbove(nx, nz, R, g.y + 0.3) < g.y + CROUCH) continue;
        const k = key(nx, nz, g.y);
        if (seen.has(k)) continue;
        seen.add(k);
        const p: [number, number, number] = [nx, g.y, nz];
        pts.push(p);
        q.push(p);
      }
    }
    // 届いたか: 目の下の床の 0.45 m 以内に、同じ高さ（±0.25 m）の届いた点がある
    const near = (eye: [number, number, number]): boolean => {
      const g = col.groundBelow(eye[0], eye[2], R, eye[1] - 0.3);
      const fy = Number.isFinite(g.y) ? g.y : eye[1] - 1.6;
      return pts.some((p) => Math.abs(p[1] - fy) < 0.25 && Math.hypot(p[0] - eye[0], p[2] - eye[2]) < 0.45);
    };
    const views: Record<string, boolean> = {};
    for (const v of this.def?.views ?? []) views[v.id] = near(v.eye);
    const tour: Record<string, boolean> = {};
    for (const t of this.def?.plan?.tour ?? []) tour[t.label] = near(t.eye);
    return { views, tour, cells: seen.size, points: pts };
  }

  /** 視点の横の画角を、目の高さで当たり判定の壁まで伸ばした扇の各光線の長さ（間取り図で「どこまで見えるか」を描く） */
  viewFan(eye: [number, number, number], yaw: number, fov: number, n = 48, maxDist = 80): number[] {
    const hf = Math.atan(Math.tan(THREE.MathUtils.degToRad(fov) / 2) * (REF_W / REF_H));
    const out: number[] = [];
    for (let i = 0; i <= n; i++) {
      const a = yaw - hf + (2 * hf * i) / n;
      out.push(this.colliders.rayXZ(eye[0], eye[2], eye[1], -Math.sin(a), -Math.cos(a), maxDist));
    }
    return out;
  }

  /** 決めた位置・向きから参考画像と同じ寸法で 1 枚撮る（歩いて確かめる道順用） */
  async shotAt(eye: [number, number, number], yaw: number, pitch = 0, fov = 60, settle = 2): Promise<HTMLImageElement> {
    this.view = null;
    if (this.def) this.setStyle(this.def.style);
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
    this.player.placeEye({ x: eye[0], y: eye[1], z: eye[2] }, yaw, pitch, 0);
    this.player.applyCamera();
    this.applyZoneStyle();
    // 場面の時間を少し進める（近づくと開く扉などを、その場に立った状態にする）
    if (settle > 0 && this.built?.update) {
      for (let t = 0; t < settle; t += 0.1) this.built.update(0.1, this.time + t, this.camera);
    }
    this.frozen = true;
    this.fixedSize = [REF_W, REF_H];
    this.resize();
    this.film.snap(this.camera, yaw, pitch);
    for (let i = 0; i < 3; i++) this.renderFrame();
    const img = await loadImage(this.renderer.domElement.toDataURL('image/png'));
    this.fixedSize = null;
    this.resize();
    return img;
  }

  /** 道順の各点の重さ（1456×816 で frames 回描いた 1 回あたりの ms） */
  async tourPerf(frames = 40): Promise<{ label: string; ms: number; calls: number }[]> {
    const out: { label: string; ms: number; calls: number }[] = [];
    for (const t of this.def?.plan?.tour ?? []) {
      await this.shotAt(t.eye, t.yaw, t.pitch ?? 0, t.fov ?? 60);
      const p = this.perf(frames);
      out.push({ label: t.label, ms: p.ms, calls: p.calls });
    }
    return out;
  }

  /** 間取り図の道順（plan.tour）を全部撮って 1 枚の一覧にする */
  async tourSheet(cols = 3): Promise<string | null> {
    const tour = this.def?.plan?.tour;
    if (!tour?.length) return null;
    return this.stopsSheet(tour, cols);
  }

  /**
   * 無作為の場所（道順を作った人が選ばなかった所も見る）。歩いて届く所を間取り図の場所ごとに分け、
   * 場所を順に選んで、その中の無作為の点から、開けた向き（壁まで 2.5 m 以上）を無作為に向く。種が同じなら毎回同じ
   */
  randomStops(n = 18, seed = 1): PlanTourStop[] {
    const R = rng(seed);
    const pts = this.reach().points;
    const spaces = (this.def?.plan?.spaces ?? []).filter((s) => s.kind !== 'void');
    const inPoly = (x: number, z: number, poly: [number, number][]): boolean => {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, zi] = poly[i];
        const [xj, zj] = poly[j];
        if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
      }
      return inside;
    };
    const polys = spaces.map((s) => spacePoly(s));
    const groups = new Map<number, [number, number, number][]>();
    for (let i = 0; i < pts.length; i += 3) {
      const [x, y, z] = pts[i];
      let k = -1;
      for (let j = 0; j < spaces.length; j++) {
        const s = spaces[j];
        if (y < s.floor - 0.7 || (s.ceiling !== undefined && y > s.ceiling)) continue;
        if (inPoly(x, z, polys[j])) {
          k = j;
          break;
        }
      }
      const g = groups.get(k) ?? [];
      g.push(pts[i]);
      groups.set(k, g);
    }
    const keys = [...groups.keys()];
    for (let i = keys.length - 1; i > 0; i--) {
      const j = Math.floor(R() * (i + 1));
      [keys[i], keys[j]] = [keys[j], keys[i]];
    }
    const out: PlanTourStop[] = [];
    // 扉の板の近く（近づくと開いた板が目の前を塞ぐ）と、狭すぎる所（便所の個室など）は選び直す
    const doorBoxes = this.colliders.boxes.filter((b) => b.passable);
    const nearDoor = (x: number, z: number): boolean =>
      doorBoxes.some((b) => Math.max(b.min.x - x, 0, x - b.max.x) ** 2 + Math.max(b.min.z - z, 0, z - b.max.z) ** 2 < 0.9 * 0.9);
    const cramped = (x: number, ey: number, z: number): boolean => {
      let open = 0;
      for (let a = 0; a < 12; a++) {
        const t = (a / 12) * Math.PI * 2;
        if (this.colliders.rayXZ(x, z, ey, -Math.sin(t), -Math.cos(t), 1.5) >= 1.5) open++;
      }
      return open < 4;
    };
    for (let i = 0; i < n && keys.length; i++) {
      const k = keys[i % keys.length];
      const g = groups.get(k)!;
      let [x, y, z] = g[Math.floor(R() * g.length)];
      for (let tries = 0; tries < 12 && (nearDoor(x, z) || cramped(x, y + 1.6, z)); tries++) [x, y, z] = g[Math.floor(R() * g.length)];
      const ey = y + 1.6;
      // 開けた向きを選ぶ（遠くまで見える向きほど選ばれやすい）
      const cand: [number, number][] = [];
      for (let a = 0; a < 16; a++) {
        const yaw = (a / 16) * Math.PI * 2 + R() * 0.3;
        const d = this.colliders.rayXZ(x, z, ey, -Math.sin(yaw), -Math.cos(yaw), 30);
        if (d >= 2.5) cand.push([yaw, Math.min(d, 20) ** 2]);
      }
      let yaw = R() * Math.PI * 2;
      if (cand.length) {
        let t = R() * cand.reduce((s, c) => s + c[1], 0);
        for (const c of cand) {
          t -= c[1];
          if (t <= 0) {
            yaw = c[0];
            break;
          }
        }
      }
      const label = k >= 0 ? spaces[k].label : '間取り図の外';
      out.push({ label: `無作為 ${i + 1}: ${label}`, eye: [x, ey, z], yaw, pitch: (R() - 0.5) * 0.16 - 0.02, fov: 60 });
    }
    return out;
  }

  private palCache: { id: string; pal: [number, number, number][] } | null = null;

  /** 場所の参考画像の 16 色（質感の物差しの「色差」の基準） */
  async refPalette(): Promise<[number, number, number][]> {
    const def = this.def!;
    if (this.palCache?.id === def.id) return this.palCache.pal;
    const labs: ReturnType<typeof toLab>[] = [];
    for (const v of def.views) labs.push(toLab(await loadImage(`refs/${v.id}.jpg`)));
    const pal = palette(labs);
    this.palCache = { id: def.id, pal };
    return pal;
  }

  /** 1 枚撮って、画像と質感の数値を返す（--shot） */
  async shotStats(eye: [number, number, number], yaw: number, pitch = 0, fov = 60): Promise<{ src: string; stats: ImageStats }> {
    const pal = await this.refPalette();
    const img = await this.shotAt(eye, yaw, pitch, fov);
    return { src: img.src, stats: imageStats(toLab(img), pal) };
  }

  /** 決めた場所を全部撮って 1 枚の一覧にする（stats を渡すと各画像の質感の数値も入れる） */
  async stopsSheet(stops: PlanTourStop[], cols = 3, stats?: ImageStats[], pal?: [number, number, number][]): Promise<string> {
    const tw = Math.round(REF_W / cols);
    const th = Math.round((tw * REF_H) / REF_W);
    const lab = 20;
    const rows = Math.ceil(stops.length / cols);
    const c = document.createElement('canvas');
    c.width = tw * cols;
    c.height = rows * (th + lab);
    const g = c.getContext('2d')!;
    g.fillStyle = '#101416';
    g.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < stops.length; i++) {
      const t = stops[i];
      const img = await this.shotAt(t.eye, t.yaw, t.pitch ?? 0, t.fov ?? 60);
      if (stats) stats.push(imageStats(toLab(img), pal));
      const x = (i % cols) * tw;
      const y = Math.floor(i / cols) * (th + lab);
      g.fillStyle = '#e8efec';
      g.font = '13px sans-serif';
      g.fillText(`${i + 1}. ${t.label}`, x + 6, y + 15);
      g.drawImage(img, x, y + lab, tw, th);
    }
    return c.toDataURL('image/jpeg', 0.86);
  }

  /**
   * 質感の物差し（core/Quality.ts）: 参考画像・参考画像の視点の描画・道順・無作為の場所を同じ数値で測る。
   * 道順と無作為の場所の一覧の画像も返す
   */
  async qualityReport(n = 18, seed = 1): Promise<{
    refs: { id: string; stats: ImageStats }[];
    views: { id: string; stats: ImageStats }[];
    tour: { label: string; stats: ImageStats }[];
    random: { label: string; stats: ImageStats }[];
    tourSheet: string | null;
    randomSheet: string;
  }> {
    const def = this.def!;
    const pal = await this.refPalette();
    const refs: { id: string; stats: ImageStats }[] = [];
    for (const v of def.views) refs.push({ id: v.id, stats: imageStats(toLab(await loadImage(`refs/${v.id}.jpg`)), pal) });
    const views: { id: string; stats: ImageStats }[] = [];
    for (const v of def.views) {
      const r = await this.capture(v.id);
      views.push({ id: v.id, stats: imageStats(toLab(await loadImage(r.render)), pal) });
    }
    const tour = def.plan?.tour ?? [];
    const ts: ImageStats[] = [];
    const tourSheet = tour.length ? await this.stopsSheet(tour, 3, ts, pal) : null;
    const rnd = this.randomStops(n, seed);
    const rs: ImageStats[] = [];
    const randomSheet = await this.stopsSheet(rnd, 3, rs, pal);
    return {
      refs,
      views,
      tour: tour.map((t, i) => ({ label: t.label, stats: ts[i] })),
      random: rnd.map((t, i) => ({ label: t.label, stats: rs[i] })),
      tourSheet,
      randomSheet,
    };
  }

  /** 描画の重さを測る（参考画像と同じ寸法で frames 回描き、1 回あたりの ms） */
  perf(frames = 90): { ms: number; calls: number; triangles: number } {
    this.fixedSize = [REF_W, REF_H];
    this.resize();
    const gl = this.renderer.getContext();
    const px = new Uint8Array(4);
    // readPixels は GPU の処理が終わるまで待つ（finish は待たないことがある）
    const sync = (): void => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    this.renderFrame();
    sync();
    const t0 = performance.now();
    for (let i = 0; i < frames; i++) {
      this.time += 1 / 60;
      styleUniforms.uTime.value = this.time;
      this.renderFrame();
      sync();
    }
    const ms = (performance.now() - t0) / frames;
    const { calls, triangles } = this.renderer.info.render;
    this.fixedSize = null;
    this.resize();
    return { ms: Math.round(ms * 100) / 100, calls, triangles };
  }

  /** 参考画像と同じ寸法で描いて、画像と比較の数値を返す */
  async capture(viewId?: string, gridX = 4, gridY = 3): Promise<{ render: string; compare: string; diff: string; edges: string; metrics: Record<string, unknown> }> {
    if (viewId) {
      const sid = viewId.replace(/-\d+$/, '');
      if (this.def?.id !== sid && this.scenes.some((s) => s.id === sid)) await this.load(sid, viewId);
      else this.setView(viewId);
    }
    const prevFrozen = this.frozen;
    this.frozen = true;
    this.player.bob = 0;
    this.fixedSize = [REF_W, REF_H];
    this.resize();
    // カメラ効果: ノイズの種を固定して、時間を少し進めた状態で撮る（揺れ・ノイズを毎回同じに）
    this.film.freezeNoise(7);
    if (this.film.active) this.film.update(1 / 60);
    for (let i = 0; i < 3; i++) this.renderFrame();
    this.film.freezeNoise(null);
    const canvas = this.renderer.domElement;
    const render = canvas.toDataURL('image/png');
    const img = await loadImage(render);
    let compare = '';
    let diff = '';
    let edges = '';
    let metrics: Record<string, unknown> = {};
    const refId = viewId ?? this.view?.id;
    const ref = refId ? await loadImage(`refs/${refId}.jpg`).catch(() => null) : null;
    if (ref) {
      const c = document.createElement('canvas');
      c.width = REF_W;
      c.height = Math.round(REF_H / 2);
      const g = c.getContext('2d')!;
      g.drawImage(img, 0, 0, REF_W / 2, REF_H / 2);
      g.drawImage(ref, REF_W / 2, 0, REF_W / 2, REF_H / 2);
      g.fillStyle = 'rgba(0,0,0,0.6)';
      g.fillRect(0, 0, 70, 18);
      g.fillRect(REF_W / 2, 0, 70, 18);
      g.fillStyle = '#fff';
      g.font = '12px sans-serif';
      g.fillText('render', 6, 13);
      g.fillText('reference', REF_W / 2 + 6, 13);
      compare = c.toDataURL('image/png');
      metrics = compareImages(img, ref, gridX, gridY);
      diff = diffImage(img, ref);
      const e = edgeCompare(img, ref);
      edges = e.image;
      Object.assign(metrics, { edgeF: e.f, edgeP: e.p, edgeR: e.r });
    }
    this.fixedSize = null;
    this.frozen = prevFrozen;
    this.resize();
    return { render, compare, diff, edges, metrics };
  }
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

/**
 * 差の地図（半分の大きさ）: 明るさの差を赤（描画が明るい）・青（描画が暗い）、色み（a・b）の差を緑で。
 * 下に参考画像を薄く敷く（どこの差かが分かるように）
 */
export function diffImage(a: HTMLImageElement, b: HTMLImageElement): string {
  const W = REF_W / 2;
  const H = REF_H / 2;
  const read = (img: HTMLImageElement): Uint8ClampedArray => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0, W, H);
    return g.getImageData(0, 0, W, H).data;
  };
  const A = read(a);
  const B = read(b);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const out = g.createImageData(W, H);
  const lab = (d: Uint8ClampedArray, i: number): [number, number, number] => {
    const lin = (v: number): number => {
      const x = v / 255;
      return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    };
    return linToOklabArr(lin(d[i]), lin(d[i + 1]), lin(d[i + 2]));
  };
  for (let i = 0; i < W * H * 4; i += 4) {
    const la = lab(A, i);
    const lb = lab(B, i);
    const dl = (la[0] - lb[0]) * 6; // ΔL 0.17 で振り切る
    const dc = Math.hypot(la[1] - lb[1], la[2] - lb[2]) * 12;
    const base = (B[i] + B[i + 1] + B[i + 2]) / 3 * 0.25;
    out.data[i] = Math.min(255, base + Math.max(0, dl) * 255);
    out.data[i + 1] = Math.min(255, base + Math.min(1, dc) * 200);
    out.data[i + 2] = Math.min(255, base + Math.max(0, -dl) * 255);
    out.data[i + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  return c.toDataURL('image/png');
}

/**
 * 構図の一致（輪郭の重なり）。色差 ΔE は「形が数 px ずれている」「柱が 1 本足りない」を見逃すので、輪郭の位置でも比べる。
 * 半分の大きさで明るさの輪郭（Sobel）を取り、強い方から約 8% を輪郭とする。相手の輪郭から 3 px（原寸 6 px）以内なら一致。
 * - P（適合）: 描画の輪郭のうち参考画像にもある割合（余計な線が多いと下がる）
 * - R（再現）: 参考画像の輪郭のうち描画にもある割合（足りない物・ずれた物があると下がる）
 * - F: 両方の調和平均（×100）。画像: 暗くした参考画像の上に、参考の輪郭を赤、描画の輪郭を水色、重なりを白
 */
export function edgeCompare(a: HTMLImageElement, b: HTMLImageElement): { f: number; p: number; r: number; image: string } {
  const W = REF_W / 2;
  const H = REF_H / 2;
  const lum = (img: HTMLImageElement): Float32Array => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d')!;
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, W, H);
    const d = g.getImageData(0, 0, W, H).data;
    const out = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) out[i] = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255;
    return out;
  };
  const edges = (L: Float32Array): Uint8Array => {
    const mag = new Float32Array(W * H);
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        const gx = L[i - W + 1] + 2 * L[i + 1] + L[i + W + 1] - L[i - W - 1] - 2 * L[i - 1] - L[i + W - 1];
        const gy = L[i + W - 1] + 2 * L[i + W] + L[i + W + 1] - L[i - W - 1] - 2 * L[i - W] - L[i - W + 1];
        mag[i] = Math.hypot(gx, gy);
      }
    }
    const sample: number[] = [];
    for (let i = 0; i < mag.length; i += 7) sample.push(mag[i]);
    sample.sort((p, q) => p - q);
    const th = Math.max(0.12, sample[Math.floor(sample.length * 0.92)]);
    const e = new Uint8Array(W * H);
    for (let i = 0; i < mag.length; i++) e[i] = mag[i] > th ? 1 : 0;
    return e;
  };
  const dilate = (e: Uint8Array, r: number): Uint8Array => {
    const t = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let v = 0;
        for (let k = -r; k <= r && !v; k++) {
          const xx = x + k;
          if (xx >= 0 && xx < W) v = e[y * W + xx];
        }
        t[y * W + x] = v;
      }
    }
    const o = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let v = 0;
        for (let k = -r; k <= r && !v; k++) {
          const yy = y + k;
          if (yy >= 0 && yy < H) v = t[yy * W + x];
        }
        o[y * W + x] = v;
      }
    }
    return o;
  };
  const La = lum(a);
  const Lb = lum(b);
  const Ea = edges(La);
  const Eb = edges(Lb);
  const Da = dilate(Ea, 3);
  const Db = dilate(Eb, 3);
  let na = 0;
  let nb = 0;
  let hitA = 0;
  let hitB = 0;
  for (let i = 0; i < W * H; i++) {
    if (Ea[i]) {
      na++;
      if (Db[i]) hitA++;
    }
    if (Eb[i]) {
      nb++;
      if (Da[i]) hitB++;
    }
  }
  const p = na ? hitA / na : 0;
  const r = nb ? hitB / nb : 0;
  const f = p + r > 0 ? (2 * p * r) / (p + r) : 0;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const out = g.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    const base = Lb[i] * 70;
    const ea = Ea[i];
    const eb = Eb[i];
    out.data[i * 4] = ea && eb ? 255 : eb ? 255 : ea ? 60 : base;
    out.data[i * 4 + 1] = ea && eb ? 255 : eb ? 70 : ea ? 220 : base;
    out.data[i * 4 + 2] = ea && eb ? 255 : eb ? 60 : ea ? 255 : base;
    out.data[i * 4 + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  const r1 = (v: number): number => Math.round(v * 1000) / 10;
  return { f: r1(f), p: r1(p), r: r1(r), image: c.toDataURL('image/png') };
}

function linToOklabArr(r: number, g: number, b: number): [number, number, number] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827607001 * m - 0.808675766 * s,
  ];
}

/** 縮小して OKLab で比べる（全体・3×4 の地域ごと・明るさの帯） */
export function compareImages(a: HTMLImageElement, b: HTMLImageElement, GX = 4, GY = 3): Record<string, unknown> {
  const W = 182;
  const H = 102;
  const get = (img: HTMLImageElement): Float32Array => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d')!;
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, W, H);
    const d = g.getImageData(0, 0, W, H).data;
    const out = new Float32Array(W * H * 3);
    for (let i = 0; i < W * H; i++) {
      const lin = (v: number): number => {
        const x = v / 255;
        return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
      };
      const r = lin(d[i * 4]);
      const gg = lin(d[i * 4 + 1]);
      const bb = lin(d[i * 4 + 2]);
      const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * gg + 0.0514459929 * bb);
      const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * gg + 0.1073969566 * bb);
      const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * gg + 0.6299787005 * bb);
      out[i * 3] = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
      out[i * 3 + 1] = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
      out[i * 3 + 2] = 0.0259040371 * l + 0.7827607001 * m - 0.808675766 * s;
    }
    return out;
  };
  const A = get(a);
  const B = get(b);
  let de = 0;
  let dl = 0;
  let ca = 0;
  let cb = 0;
  const cells = new Array(GX * GY).fill(0);
  const cellL = new Array(GX * GY).fill(0);
  const cnt = new Array(GX * GY).fill(0);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const e = Math.hypot(A[i] - B[i], A[i + 1] - B[i + 1], A[i + 2] - B[i + 2]);
      de += e;
      dl += A[i] - B[i];
      ca += Math.hypot(A[i + 1], A[i + 2]);
      cb += Math.hypot(B[i + 1], B[i + 2]);
      const ci = Math.min(GY - 1, Math.floor((y / H) * GY)) * GX + Math.min(GX - 1, Math.floor((x / W) * GX));
      cells[ci] += e;
      cellL[ci] += A[i] - B[i];
      cnt[ci]++;
    }
  }
  const n = W * H;
  const r2 = (v: number): number => Math.round(v * 1000) / 10;
  return {
    dE: r2(de / n),
    dL: r2(dl / n),
    chromaRender: r2(ca / n),
    chromaRef: r2(cb / n),
    gridDE: cells.map((v, i) => r2(v / cnt[i])),
    gridDL: cellL.map((v, i) => r2(v / cnt[i])),
  };
}
