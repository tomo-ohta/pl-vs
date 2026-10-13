import * as THREE from 'three';
import type { ArrivalView, ClientGame, HeldDevice } from '../../../../v2/client/game/ClientGame.ts';
import type { InputState } from '../../../../v2/client/input/InputController.ts';
import { DEFAULT_KEYMAP } from '../../../../v2/client/input/keymap.ts';
import type { MapController } from '../../../../v2/client/map/MapController.ts';
import type { PhotoSpot } from '../../../../v2/client/tablet/logic.ts';
import { TabletController, type TabletHooks } from '../../../../v2/client/tablet/TabletController.ts';
import { PowerFx } from '../../../../v2/client/ui/PowerFx.ts';
import type { QrHit } from '../qr/QrWorld.ts';
import type { App } from '../App.ts';
import { drawPlan, spacePoly, type FloorPlan } from '../arch/plan.ts';
import { LabAudio } from './LabAudio.ts';

/**
 * v2 のタブレット（v2/client/tablet。docs/tablet.md）を、このステージにそのまま持たせる。v2 のファイルは変えない。
 *
 * TabletController はゲーム本体（ClientGame）を受け取るので、ここで同じ形の受け皿（LabHost）を作って渡す
 * （使う所だけ: カメラ・ズーム・入力・持ち手の状態・音・写真を撮る・重ねて描く口・調整値）。
 * - カメラ・ギャラリー・SNS・ホーム・指のカーソル: v2 のまま
 * - 写真・SNS・投稿者の保存先はゲームと分ける（src/tablet/env.ts を vite.config.ts の labEnv で差し込む。`vsl.photos` / `vsl.sns`）
 * - 地図: v2 の階の地図の代わりに、このステージの間取り図（M キーのミニマップと同じ図）
 * - 写真から移る: 撮った場所（場面）と視点へ、場面を読み直して立つ
 * - 探索（部屋の番号のダイアル）: 画面は残し、どの番号でも「見つからない」（v2 の既存の通信エラーの表示）
 * - 設定: このステージの操作パネルを出す
 */

/** 部屋の番号: 場面の番号 × 1000 + 間取り図の場所の番号（場所の外・間取り図の無い場面は × 1000 だけ） */
const ROOM_PER_SCENE = 1000;
/** このステージの写真の seed（ゲームの世界の seed とは関係ない。ギャラリーの「探索」は同じ seed の写真だけ） */
const LAB_SEED = 7176;

/** v2 の core/config/tuning.ts のタブレットの値（2026-10-12 の main と同じ） */
const TUNING: Record<string, number> = {
  'tablet.raise.screenCover': 0.92,
  'tablet.travel.raiseSec': 0.55,
  'tablet.travel.holdMinSec': 0.8,
  'tablet.travel.lowerSec': 1.6,
  'tablet.travel.viewKeep': 0.4,
  'tablet.travel.fadeOutSec': 0.8,
  'tablet.travel.fadeInSec': 1.8,
  'tablet.travel.stowDelaySec': 0.25,
};

type Hold = { pos: THREE.Vector3; quat: THREE.Quaternion; fov: number; k: number };

/** 持っている物の動き（v2 の CameraRig の zoom・hold・out・baseFov）。カメラ効果が入っていれば v2 の CameraRig へそのまま渡す */
export class LabRig {
  zoom = 1;
  hold: Hold | null = null;
  private readonly plain = { y: 0, roll: 0, yaw: 0, pitch: 0, fov: 0 };
  constructor(private readonly app: App) {}

  get baseFov(): number {
    return this.app.film.active ? this.app.film.rig.baseFov : this.app.heldFovBase ?? this.app.camera.fov;
  }

  get out(): { y: number; roll: number; yaw: number; pitch: number; fov: number } {
    if (this.app.film.active) return this.app.film.rig.out;
    this.plain.yaw = this.app.player.yaw;
    this.plain.pitch = this.app.player.pitch;
    return this.plain;
  }
}

/** プレイヤーの状態（v2 の Sim の players[0] のうちタブレットが見る所。このステージでは手はいつも空いている） */
class LabPlayer {
  readonly holding = null;
  readonly ride = null;
  readonly climbing = false;
  readonly mantle = null;
  constructor(private readonly app: App) {}
  get pos(): [number, number, number] {
    const p = this.app.player.pos;
    return [p.x, p.y, p.z];
  }
  get yaw(): number {
    return this.app.player.yaw;
  }
  get crouching(): boolean {
    return this.app.player.height < 1.5;
  }
}

/** タブレットに渡す受け皿（ClientGame のうち TabletController が使う所） */
class LabHost {
  device: HeldDevice | null = null;
  readonly rig: LabRig;
  readonly sim: { players: LabPlayer[] };
  readonly audio = new LabAudio();
  readonly settings = { data: { photoLook: 'clean' as 'clean' | 'video' } };
  readonly tuning = TUNING;
  readonly flashlightOn = false;
  readonly arrivalPending = false;
  holdCrouch = false;
  /** シャッターで写真を撮った直後（写っている QR コード。src/qr） */
  onCaptured: ((hit: QrHit | null) => void) | null = null;
  readonly input: { locked: boolean; mode: 'pc' | 'mobile'; pcSensitivity: number; sensitivityScale: number; keymap: typeof DEFAULT_KEYMAP; enabled: boolean };
  readonly ui: { setHint(s: string): void; setDeviceHint(s: string): void; setPauseVisible(v: boolean): void; setTab(t: string): void };
  readonly postfx: { setOverlay(scene: THREE.Scene, camera: THREE.Camera): void; overlayVisible: boolean; readonly exposureGain: number };

  constructor(private readonly app: App, hint: HTMLElement, deviceHint: HTMLElement, onPause: () => void) {
    this.rig = new LabRig(app);
    this.sim = { players: [new LabPlayer(app)] };
    const inp = app.input;
    this.input = {
      get locked(): boolean {
        return inp.locked;
      },
      mode: inp.mobile ? 'mobile' : 'pc',
      pcSensitivity: app.player.sensitivity,
      sensitivityScale: 1,
      keymap: DEFAULT_KEYMAP,
      get enabled(): boolean {
        return inp.enabled;
      },
      set enabled(v: boolean) {
        inp.enabled = v;
      },
    };
    const show = (el: HTMLElement, s: string): void => {
      el.textContent = s;
      el.style.display = s ? 'block' : 'none';
    };
    this.ui = {
      setHint: (s) => show(hint, s),
      setDeviceHint: (s) => show(deviceHint, s),
      setPauseVisible: (v) => { if (v) onPause(); },
      setTab: () => undefined,
    };
    const post = app.post;
    this.postfx = {
      setOverlay: (scene, camera) => { post.overlay = { scene, camera, visible: false }; },
      get overlayVisible(): boolean {
        return post.overlay?.visible ?? false;
      },
      set overlayVisible(v: boolean) {
        if (post.overlay) post.overlay.visible = v;
      },
      // カメラ効果の前は線形の値を inputScale 倍して渡すので、本体の照明もそれに合わせる
      get exposureGain(): number {
        return post.film?.active ? post.film.inputScale : 1;
      },
    };
  }

  get renderer(): THREE.WebGLRenderer {
    return this.app.renderer;
  }
  get camera(): THREE.PerspectiveCamera {
    return this.app.camera;
  }
  get paused(): boolean {
    return false;
  }
  /** 設定のアプリ: ポインタロックを外して操作パネルを出す */
  pause(): void {
    document.exitPointerLock?.();
  }
  /** 手に持つ物を除いた今の画面（写真） */
  capture(o: { video: boolean; maxWidth: number }): HTMLCanvasElement | null {
    const img = this.app.capturePhoto(o);
    // QR コードを読む（真ん中あたりに十分な大きさで写っているか。写真を撮れたときだけ）
    if (img) this.onCaptured?.(this.app.qr.scan(this.app.camera));
    return img;
  }
  /** 今いる所の明るさ（本体を照らす）: 場面の霧の地平線の色から（暗い場面では暗く） */
  lightAt(): [number, number, number] {
    const c = new THREE.Color(this.app.style?.fog.horizon ?? '#c8d8d0');
    const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    const k = THREE.MathUtils.clamp(l * 1.3, 0.22, 0.85) / Math.max(l, 1e-3);
    return [c.r * k, c.g * k, c.b * k];
  }
}

/** 間取り図の場所（足元の高さの床がある所。重なったら床の高い方） */
function spaceAt(plan: FloorPlan, x: number, y: number, z: number): number {
  let best = -1;
  let bestFloor = -Infinity;
  plan.spaces.forEach((s, i) => {
    if (s.floor > y + 0.4 || s.floor <= bestFloor) return;
    if (s.ceiling !== undefined && y > s.ceiling) return;
    if (inPoly(x, z, spacePoly(s))) {
      best = i;
      bestFloor = s.floor;
    }
  });
  return best;
}

function inPoly(x: number, z: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-12) + xi) inside = !inside;
  }
  return inside;
}

export class LabTablet {
  readonly controller: TabletController;
  readonly host: LabHost;
  /** スマホの「端末」ボタンを押した（次のフレームで出す・しまう） */
  private buttonPressed = false;
  /** 電源が落ちる・入る演出（v2 の PowerFx。探索で部屋を移るときと同じ。初めて使うときに作る） */
  private fx: PowerFx | null = null;
  private jumping = false;
  private readonly planCanvas = document.createElement('canvas');

  constructor(private readonly app: App, root: HTMLElement) {
    const hint = mkHint(root, 'lab-tablet-hint', '18%');
    const deviceHint = mkHint(root, 'lab-tablet-device', '10px');
    this.host = new LabHost(app, hint, deviceHint, () => {
      this.controller.close();
      app.onShowPanel?.();
    });
    const hooks: TabletHooks = {
      seed: LAB_SEED,
      roomId: () => this.roomId(),
      placeLabel: () => this.placeLabel(),
      // 探索の画面は残す（番号を回せる）。どの番号でも見つからない（v2 の既存の「通信エラー」の表示）
      roomsAvailable: () => true,
      checkRoom: async () => false,
      warp: async () => false,
      spotAt: () => this.spotHere(),
      checkSpot: async (spot) => this.sceneOf(spot) !== null,
      travel: (spot, view) => this.travel(spot, view),
      maps: { drawTo: (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, view: { zoom: number | null; pan: [number, number] | null }) => this.drawMap(g, x, y, w, h, view) } as unknown as MapController,
    };
    this.controller = new TabletController(this.host as unknown as ClientGame, hooks);
    this.host.onCaptured = (hit) => this.onScan(hit);
    // 電源が落ちる演出の間は、画面の上の文字・ボタンを隠す（v2 が HUD を隠すのと同じ）
    const st = document.createElement('style');
    st.textContent = 'body.fx-power #lab-tablet-hint, body.fx-power #lab-tablet-device, body.fx-power .lab-tablet-btn, body.fx-power .help { visibility: hidden !important; }';
    document.head.appendChild(st);
    if (app.input.mobile) {
      const b = document.createElement('button');
      b.textContent = '端末';
      b.className = 'lab-tablet-btn';
      Object.assign(b.style, { position: 'absolute', right: '14px', bottom: '96px', zIndex: '3', padding: '12px 14px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(10,16,18,0.6)', color: '#dfe9e6', fontSize: '13px' });
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.buttonPressed = true;
      });
      root.appendChild(b);
    }
  }

  /** 出している（出す・しまう途中も） */
  get out(): boolean {
    return this.controller.out;
  }

  get rig(): LabRig {
    return this.host.rig;
  }

  /** 毎フレーム（プレイヤーを動かす前）: タブレットの操作。返す入力の見回しが 0 なら、プレイヤーも見回さない */
  input(dt: number): void {
    const inp = this.app.input;
    const sens = this.app.player.sensitivity;
    const raw: InputState = {
      moveX: inp.moveX,
      moveY: inp.moveY,
      lookDX: inp.lookDX * sens,
      lookDY: inp.lookDY * sens,
      jump: inp.down('Space'),
      dash: inp.down('ShiftLeft', 'ShiftRight'),
      crouch: false,
      interact: false,
      flashlight: false,
      drop: false,
      menu: false,
      map: false,
      tap: null,
      tablet: inp.enabled && (inp.pressed.has('Tab') || this.buttonPressed),
      back: inp.pressed.has('Backspace') || inp.rightClick,
      backspace: inp.pressed.has('Backspace'),
      enter: inp.pressed.has('Enter') || inp.pressed.has('NumpadEnter'),
      click: inp.click,
      release: inp.release,
      mouseHeld: false,
      wheel: inp.wheel,
      digits: inp.digits,
    };
    this.buttonPressed = false;
    const o = this.host.device ? this.host.device.input(raw, dt) : raw;
    if (o.lookDX === 0) inp.lookDX = 0;
    if (o.lookDY === 0) inp.lookDY = 0;
    // 持っている間は走る・跳ぶ・飛ぶを止める（v2 と同じ。歩くのはよい）
    inp.suppress.clear();
    if (this.out) for (const k of ['Space', 'ShiftLeft', 'ShiftRight', 'KeyF']) inp.suppress.add(k);
    if (!inp.enabled) {
      inp.lookDX = 0;
      inp.lookDY = 0;
      inp.moveX = 0;
      inp.moveY = 0;
    }
  }

  /** 毎フレーム（描く前）: 持つ位置・画面の絵 */
  update(dt: number): void {
    this.host.device?.update(dt);
    // カメラ効果の前は値が inputScale 倍なので、自分で光る画面もそれに合わせる（v2 の画面の明るさ 2.4）
    this.controller.model.setScreenGain(2.4 * this.host.postfx.exposureGain);
  }

  close(): void {
    this.controller.close();
  }

  // ---------------------------------------------------------------- QR コード（src/qr）
  /** シャッターで撮った写真に QR コードが写っていた: 読み取れれば、少し置いて探索と同じ演出でその URL の場所へ */
  private onScan(hit: QrHit | null): void {
    if (!hit || this.jumping) return;
    const ui = this.host.ui;
    if (hit.kind === 'broken') {
      ui.setHint('読み取れません（QR コードが欠けています）');
      this.host.audio.ui('error');
      window.setTimeout(() => ui.setHint(''), 2200);
      return;
    }
    const url = hit.url!;
    ui.setHint(`QR コードを読み取りました：${hit.label}`);
    this.host.audio.ui('confirm');
    this.jumping = true;
    window.setTimeout(() => void this.jump(url, hit.label ?? ''), 900);
  }

  /** 電源が落ちる → 読み込む（LOADING） → 電源が入る。移る間は動けない */
  private async jump(url: string, label: string): Promise<void> {
    const app = this.app;
    const fx = (this.fx ??= new PowerFx(app.renderer.domElement, () => this.host.audio.sfxInput));
    this.host.ui.setHint('');
    app.input.enabled = false;
    try {
      await fx.off(label);
      this.controller.hideNow();
      const ok = await app.openUrl(url);
      // v2 と同じく、アドレスを今いる場所の URL にする（履歴は増やさない）
      if (ok) history.replaceState(null, '', new URL(url, location.href).pathname + new URL(url, location.href).search);
      // 移った先を描いてから電源を入れる（読み込み直後は前の場面の絵が残っていることがある）
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    } catch (e) {
      console.warn('[QR] 移れませんでした', e);
    } finally {
      app.input.enabled = true;
      await fx.on();
      this.jumping = false;
    }
  }

  // ---------------------------------------------------------------- 場所
  private sceneIndex(): number {
    return Math.max(0, this.app.scenes.findIndex((s) => s.id === this.app.def?.id));
  }

  private roomId(): number | null {
    const def = this.app.def;
    if (!def) return null;
    const base = (this.sceneIndex() + 1) * ROOM_PER_SCENE;
    if (!def.plan) return base;
    const p = this.app.player.pos;
    const i = spaceAt(def.plan, p.x, p.y, p.z);
    return base + (i >= 0 ? i + 1 : 0);
  }

  private placeLabel(): string {
    const e = this.app.scenes.find((s) => s.id === this.app.def?.id);
    return (e?.label ?? '').replace(/（建築版）$/, '');
  }

  /** 写真に残す場所: 場面（ページの種類と場面の id） */
  private spotHere(): { depth: number; variant: number; sig: string } | null {
    const def = this.app.def;
    if (!def) return null;
    const v = this.app.variant === 'arch' ? 1 : this.app.variant === 'props' ? 2 : 0;
    return { depth: this.sceneIndex(), variant: v, sig: `${this.app.variant}:${def.id}` };
  }

  /** 写真の場面（このページに無ければ null） */
  private sceneOf(spot: PhotoSpot): string | null {
    const [variant, id] = spot.sig.split(':');
    if (variant !== this.app.variant || !id) return null;
    return this.app.scenes.some((s) => s.id === id) ? id : null;
  }

  /** 写真の場所へ移る: 場面が違えば読み直し、写真の視点に立つ（着いた直後は写真の画角。v2 の CameraRig.hold と同じ重ね方） */
  private async travel(spot: PhotoSpot, view: ArrivalView): Promise<boolean> {
    const id = this.sceneOf(spot);
    if (!id) return false;
    const app = this.app;
    if (app.def?.id !== id) await app.load(id, null);
    const eye = new THREE.Vector3(...view.eye);
    app.player.placeEye(eye, view.yaw, view.pitch, view.roll, app.colliders);
    app.setView(null);
    app.player.applyCamera();
    app.film.snap(app.camera, view.yaw, view.pitch);
    this.host.rig.hold = { pos: eye, quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(view.pitch, view.yaw, view.roll, 'YXZ')), fov: view.fov, k: 1 };
    return true;
  }

  // ---------------------------------------------------------------- 地図（間取り図）
  private drawMap(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, view: { zoom: number | null; pan: [number, number] | null }): { scale: number; center: [number, number] } | null {
    const plan = this.app.def?.plan;
    if (!plan) return null;
    const p = this.app.player;
    const pad = 4;
    let scale: number;
    let center: [number, number];
    if (view.zoom === null) {
      // 全体に合わせる（drawPlan の範囲 = 場所の外接 + 4 m）
      const xs: number[] = [];
      const zs: number[] = [];
      for (const s of plan.spaces) for (const [px, pz] of spacePoly(s)) { xs.push(px); zs.push(pz); }
      const x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, z0 = Math.min(...zs) - pad, z1 = Math.max(...zs) + pad;
      scale = Math.min(w / (x1 - x0), h / (z1 - z0));
      center = [(x0 + x1) / 2, (z0 + z1) / 2];
    } else {
      scale = view.zoom;
      center = view.pan ?? [p.pos.x, p.pos.z];
    }
    // 見せる範囲を drawPlan の範囲にする（drawPlan は範囲のまわりに pad m を足すので、その分を引いておく）
    const hw = w / (2 * scale);
    const hh = h / (2 * scale);
    drawPlan(plan, this.planCanvas, {
      bounds: [center[0] - hw + pad, center[1] - hh + pad, center[0] + hw - pad, center[1] + hh - pad],
      px: Math.max(w, h),
      views: (this.app.def?.views ?? []).map((v) => ({ id: v.id, eye: v.eye, yaw: v.yaw, fov: v.fov })),
      player: { x: p.pos.x, z: p.pos.z, yaw: p.yaw },
    });
    g.drawImage(this.planCanvas, x, y, w, h);
    return { scale, center };
  }
}

function mkHint(root: HTMLElement, id: string, bottom: string): HTMLDivElement {
  const el = document.createElement('div');
  el.id = id;
  Object.assign(el.style, {
    position: 'absolute', left: '50%', bottom, transform: 'translateX(-50%)', zIndex: '3', display: 'none',
    padding: '6px 12px', borderRadius: '6px', background: 'rgba(10,16,18,0.7)', color: '#dfe9e6', fontSize: '12px',
    pointerEvents: 'none', whiteSpace: 'nowrap',
  });
  root.appendChild(el);
  return el;
}
