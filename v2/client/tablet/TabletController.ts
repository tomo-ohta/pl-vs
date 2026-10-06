/**
 * タブレット（一人称で手に持つ端末）: 出す・しまう動き、世界の中に見える描き方、操作、各アプリの働き（カメラ・探索・マップ・設定）。
 *
 * - 描き方: 別の場面とカメラ（近くの物用）に置き、PostFX の ViewmodelPass で世界の絵の上に重ねる（壁に埋まらない。ビデオの
 *   にじみ・走査線は世界と同じく掛かる）。本体は今いる所の焼き込みの明るさ × 露出の追従で照らし、画面は自分で光る
 * - 動き: 出す（下から持ち上げる 0.42 s）・しまう（下ろす 0.32 s）。持っている間は呼吸と、歩く揺れ・振り向きに少し遅れてついてくる。
 *   カメラのときは顔の前まで上げ、画面が視界の狭い向きの 9 割ほどを覆う（残りに黒い縁が見える。本体は視界を覆ったまま。
 *   画面の透けた所から世界が見える = カメラの映像）。写真から移るときも同じ所まで上げる
 * - 操作（PC・Pointer Lock 中）: マウスで画面の上の指のカーソルを動かす（視点は止める）・左クリックで押す・ホイール・右クリックか
 *   Backspace で戻る・数字キー（探索）。カメラのときはマウスで狙い、クリックでシャッター・ホイールでズーム。
 *   スマホ（と Pointer Lock を使わないマウス）: 画面を直接タップ・ドラッグ（光線を画面に当てる）。カメラのときはボタンの上だけ受け取る
 * - 持っている間: 歩ける（ダッシュ・ジャンプ・調べる・置くはできない）。物を持っている・乗り物・はしご・よじ登りの間は出せない
 * - 出す・しまうキーは input/keymap.ts の 'tablet'（既定 Tab）。スマホは右の「端末」ボタン
 * - 写真から移る（ギャラリー・SNS の「探索」。docs/tablet.md）: 覗き込む音 → タブレットを顔の前へ上げ、写真を視界いっぱいに見せる
 *   （押した瞬間から移る先を読み込み、その間ずっと写真。環境音を絞る）→ 着いたら世界を写真の視点に重ね、タブレットをゆっくり手元へ
 *   戻しながら普通の視点へ（環境音を戻す）。下ろし終えるまで視点と移動は止める。移れたら、手元へ戻したあと Tab と同じようにしまう
 */
import * as THREE from 'three';
import type { ArrivalView, ClientGame, HeldDevice } from '../game/ClientGame.ts';
import type { InputState } from '../input/InputController.ts';
import { keysLabel } from '../input/keymap.ts';
import type { MapController } from '../map/MapController.ts';
import { revealFov, type PhotoSpot } from './logic.ts';
import { PhotoStore, type PhotoMeta } from './PhotoStore.ts';
import { localPlayerId, PostStore } from './PostStore.ts';
import { playerName } from '../settings/playerName.ts';
import { SCREEN_PX, TABLET, TabletModel } from './TabletModel.ts';
import { TabletUi, type TravelRequest } from './ui/TabletUi.ts';

export interface TabletHooks {
  /** 世界の seed */
  readonly seed: number;
  /** 今いる部屋のルーム ID（番号の無い所・フロアでは null） */
  roomId(): number | null;
  /** 今いる階の名前（B6F・B6F 裏） */
  placeLabel(): string;
  /** 部屋の番号で移れるか（果てしない階） */
  roomsAvailable(): boolean;
  /** 番号の部屋があるか */
  checkRoom(id: number): Promise<boolean>;
  /** 番号の部屋へ移る（電源が落ちる演出。onDark: 画面が消えた所。移れたら true） */
  warp(id: number, onDark: () => void): Promise<boolean>;
  /** 足元 pos の場所（階と場所の印。果てしない階の区画の中なら。写真に残す） */
  spotAt(pos: readonly number[]): { depth: number; variant: number; sig: string } | null;
  /** 写真の場所がまだあるか（世界の作りが変わっていないか） */
  checkSpot(spot: PhotoSpot): Promise<boolean>;
  /** 写真の場所へ移る（演出はタブレット。読み込んで入れ替え、着いた視点を game.arrive に渡す。移れたら true） */
  travel(spot: PhotoSpot, view: ArrivalView): Promise<boolean>;
  readonly maps: MapController;
}

/** 姿勢（カメラから見た位置 m と回転 rad）: x y z rx ry rz */
type Pose = [number, number, number, number, number, number];
const HIDDEN: Pose = [0.05, -0.34, -0.27, -1.25, 0.12, 0.22];
const HELD: Pose = [0, -0.05, -0.262, -0.22, 0, 0];

const ease = (x: number): number => x * x * (3 - 2 * x);
/** 本体の真ん中（姿勢の原点）から画面の面まで（m。TabletModel の screen.position.z） */
const SURFACE = TABLET.T / 2 + 0.00016;
const approach = (v: number, t: number, step: number): number => (v < t ? Math.min(t, v + step) : Math.max(t, v - step));

export class TabletController implements HeldDevice {
  readonly model: TabletModel;
  readonly ui: TabletUi;
  readonly photos = new PhotoStore();
  readonly posts = new PostStore();
  private readonly game: ClientGame;
  private readonly hooks: TabletHooks;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(72, 1, 0.01, 3);
  private readonly hemi = new THREE.HemisphereLight(0xffffff, 0x404040, 1);
  private readonly key = new THREE.DirectionalLight(0xffffff, 1);
  private readonly ray = new THREE.Raycaster();
  /** しまってある間は false。出している（出す途中も）間 true */
  private want = false;
  /** 0 しまった … 1 持っている / 0 持っている … 1 カメラの位置 */
  private a = 0;
  private c = 0;
  private t = 0;
  private sway: [number, number] = [0, 0];
  private prevYaw: number | null = null;
  private prevPitch = 0;
  private cursor = { u: 0.5, v: 0.62 };
  /** 指のカーソルの 1 マウス画素あたりの絵の画素 */
  private pxPerCss = 1.6;
  private touch: number | null = null;
  private warping = false;
  /** 写真から移る: 0 手元 … 1 顔の前（写真が視界いっぱい） */
  private v = 0;
  /** 写真から移る間（上げる・見せたまま読み込む・下ろす）。result: 移れたか（読み込み中は null） */
  private trip: { phase: 'raise' | 'hold' | 'lower'; t: number; kind: 'gallery' | 'sns'; result: boolean | null } | null = null;
  /** 写真から移り終えて、しまう時刻（this.t。null はしまわない） */
  private stowAt: number | null = null;
  private hintTimer = 0;
  private lastHint = '';

  constructor(game: ClientGame, hooks: TabletHooks) {
    this.game = game;
    this.hooks = hooks;
    this.ui = new TabletUi({
      place: () => ({ label: hooks.placeLabel(), roomId: hooks.roomId() }),
      roomsAvailable: () => hooks.roomsAvailable(),
      checkRoom: (id) => hooks.checkRoom(id),
      warp: (id) => this.warp(id),
      travel: (req) => this.startTrip(req),
      checkSpot: (spot) => hooks.checkSpot(spot),
      drawMap: (g, x, y, w, h, view) => hooks.maps.drawTo(g, x, y, w, h, view),
      openSettings: () => this.openSettings(),
      shutter: () => this.shoot(),
      photos: this.photos,
      posts: this.posts,
      author: () => ({ id: localPlayerId(), name: playerName() }),
      seed: hooks.seed,
      sound: (k) => game.audio.ui(k === 'tap' ? 'click' : k === 'back' ? 'cancel' : k === 'open' ? 'confirm' : 'error'),
    });
    this.model = new TabletModel(this.ui.canvas);
    this.model.texture.generateMipmaps = true;
    this.model.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.scene.add(this.model.group, this.hemi, this.key);
    this.key.position.set(-0.4, 1, 0.6);
    this.ui.onAppChange = (app) => this.model.setViewfinder(app === 'camera');
    game.postfx.setOverlay(this.scene, this.camera);
    game.device = this;
    this.bindPointer();
  }

  /** 出している（出す・しまう途中も） */
  get out(): boolean {
    return this.want || this.a > 0.001;
  }

  // ---------------------------------------------------------------- 出す・しまう
  toggle(): void {
    if (this.want) this.close();
    else this.open();
  }

  open(): boolean {
    const g = this.game;
    if (this.warping || g.paused || !g.sim) return false;
    const busy = this.busyReason();
    if (busy) { this.flashHint(busy); return false; }
    this.want = true;
    this.model.setViewfinder(this.ui.app === 'camera');
    g.audio.ui('open');
    return true;
  }

  close(): void {
    if (!this.want) return;
    this.want = false;
    this.ui.cancel();
    this.touch = null;
    this.game.audio.ui('close');
  }

  /** すぐ見えなくする（部屋を移る演出で画面が消えた所） */
  hideNow(): void {
    this.want = false;
    this.a = 0;
    this.c = 0;
    this.ui.cancel();
    this.touch = null;
    this.game.rig.zoom = 1;
    this.game.postfx.overlayVisible = false;
    this.syncHud();
  }

  /** 出せない理由（手がふさがっている）。出せるなら null */
  private busyReason(): string | null {
    const p = this.game.sim?.players[0];
    if (!p) return '今は使えません';
    if (p.holding) return `手がふさがっています（${keysLabel(this.game.input.keymap, 'drop')} で置く）`;
    if (p.ride || p.climbing || p.mantle) return '手がふさがっています';
    return null;
  }

  private flashHint(s: string): void {
    this.game.ui.setHint(s);
    clearTimeout(this.hintTimer);
    this.hintTimer = window.setTimeout(() => this.game.ui.setHint(''), 1800);
  }

  // ---------------------------------------------------------------- 入力（遊んでいる間だけ呼ばれる）
  input(inp: InputState, _dt: number): InputState {
    if (inp.tablet) this.toggle();
    if (this.want) {
      const busy = this.busyReason();
      if (busy) { this.close(); this.flashHint(busy); }
    }
    if (!this.out) return inp;
    // 両手がふさがっている: 走る・跳ぶ・調べる・置く・タップで調べるはしない
    const o: InputState = { ...inp, jump: false, dash: false, interact: false, drop: false, tap: null };
    if (!this.want || this.a < 0.6) return o;
    const ui = this.ui;
    const cam = ui.app === 'camera';
    const ip = this.game.input;
    if (ip.mode === 'pc' && ip.locked) {
      if (!cam) {
        const sens = ip.pcSensitivity * ip.sensitivityScale;
        this.moveCursor((inp.lookDX / sens) * this.pxPerCss, (inp.lookDY / sens) * this.pxPerCss);
        o.lookDX = 0;
        o.lookDY = 0;
        const { x, y } = this.cursorPx();
        if (inp.click) ui.down(x, y);
        if (inp.release) ui.up(x, y);
        if (inp.wheel) ui.wheel(inp.wheel);
      } else {
        if (inp.click) ui.shutter();
        if (inp.wheel) ui.wheel(inp.wheel);
      }
    }
    if (inp.backspace) ui.backspace();
    else if (inp.back) ui.back();
    if (inp.digits) ui.typed(inp.digits);
    if (inp.enter) ui.enter();
    return o;
  }

  private moveCursor(dx: number, dy: number): void {
    if (!dx && !dy) return;
    this.cursor.u = Math.max(0, Math.min(1, this.cursor.u + dx / SCREEN_PX.w));
    this.cursor.v = Math.max(0, Math.min(1, this.cursor.v + dy / SCREEN_PX.h));
    const { x, y } = this.cursorPx();
    this.ui.move(x, y);
  }

  private cursorPx(): { x: number; y: number } {
    return { x: this.cursor.u * SCREEN_PX.w, y: this.cursor.v * SCREEN_PX.h };
  }

  // ---------------------------------------------------------------- タッチ・Pointer Lock を使わないマウス
  private bindPointer(): void {
    const el = this.game.renderer.domElement;
    const direct = (e: PointerEvent): boolean => e.pointerType !== 'mouse' || !this.game.input.locked;
    const usable = (): boolean => this.want && this.a > 0.9 && !this.game.paused && !this.warping;
    window.addEventListener('pointerdown', (e) => {
      if (e.target !== el || !direct(e) || !usable() || e.button > 0) return;
      const uv = this.uvAt(e.clientX, e.clientY, false);
      if (!uv) return;
      const x = uv.u * SCREEN_PX.w, y = uv.v * SCREEN_PX.h;
      if (!this.ui.captures(x, y)) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      this.touch = e.pointerId;
      try { el.setPointerCapture(e.pointerId); } catch { /* 既に離れた指 */ }
      this.cursor = uv;
      this.ui.down(x, y);
    }, { capture: true });
    window.addEventListener('pointermove', (e) => {
      if (this.touch !== null && e.pointerId === this.touch) {
        const uv = this.uvAt(e.clientX, e.clientY, true);
        if (uv) this.ui.move(uv.u * SCREEN_PX.w, uv.v * SCREEN_PX.h);
        e.stopImmediatePropagation();
        return;
      }
      // Pointer Lock を使わないマウス: 指のカーソルを画面の上で動かす（押していなくても光る所が分かる）
      if (e.pointerType === 'mouse' && !this.game.input.locked && usable() && e.target === el) {
        const uv = this.uvAt(e.clientX, e.clientY, false);
        if (uv) { this.cursor = uv; this.ui.move(uv.u * SCREEN_PX.w, uv.v * SCREEN_PX.h); }
      }
    }, { capture: true });
    const end = (e: PointerEvent): void => {
      if (this.touch === null || e.pointerId !== this.touch) return;
      this.touch = null;
      const uv = this.uvAt(e.clientX, e.clientY, true);
      if (e.type === 'pointerup' && uv) this.ui.up(uv.u * SCREEN_PX.w, uv.v * SCREEN_PX.h);
      else this.ui.cancel();
      e.stopImmediatePropagation();
    };
    window.addEventListener('pointerup', end, { capture: true });
    window.addEventListener('pointercancel', end, { capture: true });
    window.addEventListener('wheel', (e) => {
      if (this.game.input.locked || e.target !== el || !usable()) return;
      const uv = this.uvAt(e.clientX, e.clientY, false);
      if (uv) this.ui.move(uv.u * SCREEN_PX.w, uv.v * SCREEN_PX.h);
      this.ui.wheel(e.deltaY * (e.deltaMode === 1 ? 33 : 1));
      e.preventDefault();
    }, { capture: true, passive: false });
  }

  /** 画面の座標から、タブレットの画面の (u, v)。plane: 画面の外も広げた平面で（ドラッグを続けるとき） */
  private uvAt(clientX: number, clientY: number, plane: boolean): { u: number; v: number } | null {
    const r = this.game.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -(((clientY - r.top) / r.height) * 2 - 1));
    this.camera.updateMatrixWorld();
    this.model.group.updateMatrixWorld(true);
    this.ray.setFromCamera(ndc, this.camera);
    return plane ? this.model.planeUv(this.ray) : this.model.screenUv(this.ray);
  }

  // ---------------------------------------------------------------- アプリの働き
  private openSettings(): void {
    const g = this.game;
    g.pause();
    g.ui.setPauseVisible(true);
    g.ui.setTab('settings');
  }

  private warp(id: number): void {
    if (this.warping) return;
    this.warping = true;
    void this.hooks.warp(id, () => this.hideNow()).then((ok) => {
      this.warping = false;
      if (!ok) this.flashHint('通信エラー：移動できませんでした');
    }, () => { this.warping = false; });
  }

  /** 今の場所と視点（撮る瞬間。プレイヤーの足元・向き・しゃがみと、カメラの位置・向き・縦の画角。果てしない階の区画の中だけ） */
  private spotNow(): PhotoSpot | null {
    const g = this.game, p = g.sim?.players[0];
    if (!p) return null;
    const at = this.hooks.spotAt(p.pos);
    if (!at) return null;
    const cam = g.camera;
    const e = new THREE.Euler().setFromQuaternion(cam.quaternion, 'YXZ');
    return {
      depth: at.depth, variant: at.variant, sig: at.sig,
      feet: [p.pos[0], p.pos[1], p.pos[2]], yaw: p.yaw, crouch: p.crouching,
      eye: [cam.position.x, cam.position.y, cam.position.z], camYaw: e.y, camPitch: e.x, camRoll: e.z, fov: cam.fov,
    };
  }

  // ---------------------------------------------------------------- 写真から移る
  /** 写真から移り始める（ギャラリー・SNS の「探索」） */
  private startTrip(req: TravelRequest): void {
    const g = this.game;
    if (this.trip || this.warping || !this.want || g.paused) return;
    const T = g.tuning;
    this.warping = true;
    this.trip = { phase: 'raise', t: 0, kind: req.kind, result: null };
    g.input.enabled = false;
    this.ui.cancel();
    this.touch = null;
    this.ui.setTravelView({ image: req.image });
    this.peerSound();
    g.audio.fadeAmbient(0, T['tablet.travel.fadeOutSec']);
    // 押した瞬間から移る先を読み込む（着いた視点: 写真の視点。画角は、写真を視界いっぱいに見せたときに重なる画角）
    const s = req.spot;
    const view: ArrivalView = { eye: s.eye, yaw: s.camYaw, pitch: s.camPitch, roll: s.camRoll, fov: revealFov(s.fov, req.aspect, g.camera.aspect || 1), crouch: s.crouch };
    void this.hooks.travel(s, view).then((ok) => { if (this.trip) this.trip.result = ok; }, () => { if (this.trip) this.trip.result = false; });
  }

  /** 写真から移る間の毎フレーム（上げる → 見せたまま待つ → 下ろす） */
  private stepTrip(dt: number): void {
    const tr = this.trip;
    if (!tr) return;
    const g = this.game, T = g.tuning;
    tr.t += dt;
    if (tr.phase === 'raise') {
      this.v = approach(this.v, 1, dt / T['tablet.travel.raiseSec']);
      if (this.v >= 1) { tr.phase = 'hold'; tr.t = 0; }
    } else if (tr.phase === 'hold') {
      // 移り終えて（階を入れ替えて視点を合わせた）、写真を少しは見せた
      if (tr.result === null || g.arrivalPending || tr.t < T['tablet.travel.holdMinSec']) return;
      tr.phase = 'lower';
      tr.t = 0;
      g.audio.fadeAmbient(1, tr.result ? T['tablet.travel.fadeInSec'] : 0.4);
      if (!tr.result) this.ui.travelFailed(tr.kind, '通信エラー：この写真の場所へ移動できませんでした');
    } else {
      this.v = approach(this.v, 0, dt / T['tablet.travel.lowerSec']);
      // 下ろし始めは写真の視点のまま、残りで普通の視点へ
      const keep = 1 - T['tablet.travel.viewKeep'];
      if (g.rig.hold) g.rig.hold.k = ease(Math.min(1, this.v / Math.max(0.01, keep)));
      // 手元へ戻しきる前（残りの 3 割）に、写真から元の画面（ギャラリー・SNS の投稿）へ溶かす
      this.ui.setTravelAlpha(ease(Math.min(1, this.v / 0.3)));
      if (this.v <= 0) this.endTrip(!!tr.result);
    }
  }

  /** 写真から移り終えた（手元へ戻した）。移れたら、少し置いて Tab と同じようにしまう。行けなかったときは出したまま（通信エラーを読める） */
  private endTrip(arrived: boolean): void {
    const g = this.game;
    if (arrived) this.stowAt = this.t + g.tuning['tablet.travel.stowDelaySec'];
    this.trip = null;
    this.v = 0;
    this.warping = false;
    g.rig.hold = null;
    g.holdCrouch = false;
    this.ui.setTravelView(null);
    g.input.enabled = !g.paused;
    this.prevYaw = null;
  }

  /** 覗き込む音（息の長い布ずれのような音と、小さく低い響き。WebAudio の合成。効果音の音量に従う） */
  private peerSound(): void {
    const dest = this.game.audio.sfxInput;
    if (!dest) return;
    const ac = dest.context as AudioContext;
    const t = ac.currentTime;
    try {
      const n = Math.max(1, Math.floor(ac.sampleRate * 0.75));
      const buf = ac.createBuffer(1, n, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      const src = ac.createBufferSource();
      src.buffer = buf;
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 0.8;
      bp.frequency.setValueAtTime(360, t);
      bp.frequency.exponentialRampToValueAtTime(1500, t + 0.45);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.08, t + 0.14);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      src.connect(bp).connect(g).connect(dest);
      src.start(t);
      src.stop(t + 0.75);
      const o = ac.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(196, t + 0.12);
      o.frequency.exponentialRampToValueAtTime(247, t + 0.8);
      const og = ac.createGain();
      og.gain.setValueAtTime(0.0001, t + 0.12);
      og.gain.exponentialRampToValueAtTime(0.03, t + 0.35);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
      o.connect(og).connect(dest);
      o.start(t + 0.12);
      o.stop(t + 1.05);
    } catch {
      // 音は出せなくてよい
    }
  }

  /** 撮って保存する（手に持つ物を除いた今の画面。写真の見た目は設定の photoLook） */
  private async shoot(): Promise<{ meta: PhotoMeta; thumb: Blob } | null> {
    const g = this.game;
    const look = g.settings.data.photoLook;
    const img = g.capture({ video: look === 'video', maxWidth: 1280 });
    if (!img) return null;
    const spot = this.spotNow();
    g.audio.play('shutter', { gain: 0.8 });
    const th = document.createElement('canvas');
    th.width = 384;
    th.height = Math.max(1, Math.round((384 * img.height) / img.width));
    th.getContext('2d')!.drawImage(img, 0, 0, th.width, th.height);
    const blob = (c: HTMLCanvasElement, q: number): Promise<Blob | null> => new Promise((res) => c.toBlob((b) => res(b), 'image/jpeg', q));
    const [image, thumb] = await Promise.all([blob(img, 0.9), blob(th, 0.82)]);
    if (!image || !thumb) return null;
    try {
      const meta = await this.photos.add({ takenAt: Date.now(), roomId: this.hooks.roomId(), seed: this.hooks.seed, place: this.hooks.placeLabel(), w: img.width, h: img.height, look, ...(spot ? { spot } : {}) }, image, thumb);
      return { meta, thumb };
    } catch (e) {
      console.warn('[写真] 保存できません', e);
      return null;
    }
  }

  // ---------------------------------------------------------------- 毎フレーム（描く前）
  update(dt: number): void {
    const g = this.game;
    this.t += dt;
    // 写真から移り終えた: Tab と同じようにしまう
    if (this.stowAt !== null && this.t >= this.stowAt) {
      this.stowAt = null;
      if (this.want && !this.trip) this.close();
    }
    this.a = approach(this.a, this.want ? 1 : 0, dt / (this.want ? 0.42 : 0.32));
    this.c = approach(this.c, this.want && this.ui.app === 'camera' && !this.trip ? 1 : 0, dt / 0.34);
    this.stepTrip(dt);
    const vis = this.a > 0.001;
    g.postfx.overlayVisible = vis;
    this.syncHud();
    // ズームはカメラの位置にいる間だけ
    g.rig.zoom = this.c > 0.98 ? this.ui.zoom : 1;
    if (!vis) { this.prevYaw = null; return; }
    // 近くの物用のカメラ（画角は表示カメラの元の画角。ズームのゆらぎ・拡大は掛けない）
    const cam = this.camera;
    const aspect = g.camera.aspect || 1;
    if (cam.fov !== g.rig.baseFov || cam.aspect !== aspect) { cam.fov = g.rig.baseFov; cam.aspect = aspect; cam.updateProjectionMatrix(); }
    const tan = Math.tan((cam.fov * Math.PI) / 360);
    // 顔の前（カメラ・写真から移る）: 画面が視界の狭い向きを tablet.raise.screenCover だけ覆う（残りに黒い縁）。距離は画面の面まで
    // （本体の真ん中から画面の面までの厚み SURFACE を足す。足さないと縁が消える）
    const dScreen = Math.min(TABLET.SW / (2 * tan * aspect), TABLET.SH / (2 * tan)) / g.tuning['tablet.raise.screenCover'];
    const camPose: Pose = [0, 0, -(dScreen + SURFACE), 0, 0, 0];
    // 持つ位置: 細い画面（スマホの縦持ち）では、本体の幅が視界の 9 割に収まるまで離し、真ん中寄りに持つ
    const dHeld = Math.max(-HELD[2], TABLET.W / (2 * tan * aspect * 0.9));
    const far = dHeld / -HELD[2];
    const held: Pose = [HELD[0], aspect < 1 ? 0.012 : HELD[1] * far, -dHeld, HELD[3], HELD[4], HELD[5]];
    const A = ease(this.a), C = ease(this.c), V = ease(this.v);
    // 写真から移る: カメラと同じ顔の前
    const pose = HIDDEN.map((h, i) => { const hp = h + (held[i]! - h) * A; const cp = hp + (camPose[i]! - hp) * C; return cp + (camPose[i]! - cp) * V; }) as Pose;
    // 持ち上げるときの弧
    const arc = Math.sin(Math.PI * A) * (1 - C);
    pose[2] += arc * 0.025;
    pose[3] += arc * 0.14;
    // 呼吸・歩く揺れ・振り向きの遅れ
    const live = (1 - C * 0.75) * A * (1 - V);
    const rig = g.rig.out;
    const yawRate = this.prevYaw === null || dt <= 0 ? 0 : (rig.yaw - this.prevYaw) / dt;
    const pitchRate = this.prevYaw === null || dt <= 0 ? 0 : (rig.pitch - this.prevPitch) / dt;
    this.prevYaw = rig.yaw;
    this.prevPitch = rig.pitch;
    const k = dt > 0 ? 1 - Math.exp(-dt / 0.12) : 0;
    const clamp = (v: number): number => Math.max(-0.028, Math.min(0.028, v));
    this.sway[0] += (clamp(yawRate * 0.006) - this.sway[0]) * k;
    this.sway[1] += (clamp(-pitchRate * 0.006) - this.sway[1]) * k;
    pose[0] += this.sway[0] * live;
    pose[1] += (this.sway[1] + Math.sin(this.t * 1.25) * 0.0016 + rig.y * 0.35) * live;
    pose[4] += this.sway[0] * 1.6 * live;
    pose[5] += (Math.sin(this.t * 0.71) * 0.006 + rig.roll * 0.4) * live;
    const grp = this.model.group;
    grp.position.set(pose[0], pose[1], pose[2]);
    grp.rotation.set(pose[3], pose[4], pose[5], 'XYZ');
    // 写真から移る: 顔の前で視界に重なる所に写真を置く（絵の px）
    if (this.trip) {
      const hw = (dScreen * tan * aspect) / TABLET.SW, hh = (dScreen * tan) / TABLET.SH;
      this.ui.setTravelRect({ x0: (0.5 - hw) * SCREEN_PX.w, x1: (0.5 + hw) * SCREEN_PX.w, y0: (0.5 - hh) * SCREEN_PX.h, y1: (0.5 + hh) * SCREEN_PX.h });
    }
    // カメラのとき、画面のうち見えている所（絵の px。画面の面までの距離で）
    const d = -pose[2] - SURFACE;
    const hw = (d * tan * aspect) / TABLET.SW, hh = (d * tan) / TABLET.SH;
    this.ui.setCameraSafe({
      x0: Math.max(0, 0.5 - hw) * SCREEN_PX.w, x1: Math.min(1, 0.5 + hw) * SCREEN_PX.w,
      y0: Math.max(0, 0.5 - hh) * SCREEN_PX.h, y1: Math.min(1, 0.5 + hh) * SCREEN_PX.h,
    });
    // 指のカーソル: 画面の見た目の幅（CSS px）から、マウス 1 px を絵の何 px にするか
    const shownCss = (TABLET.SW / (2 * Math.max(0.05, d) * tan * aspect)) * window.innerWidth;
    this.pxPerCss = SCREEN_PX.w / Math.max(120, shownCss);
    // 明るさ: 今いる所の焼き込みの光 × 露出の追従（世界と同じ明るさに）
    const p = g.camera.position;
    const L = g.lightAt([p.x, p.y - 0.3, p.z]);
    const lum = Math.max(0.04, 0.2126 * L[0] + 0.7152 * L[1] + 0.0722 * L[2]);
    const gain = g.postfx.exposureGain;
    const tint = new THREE.Color(L[0] / lum, L[1] / lum, L[2] / lum);
    this.hemi.color.copy(tint);
    this.hemi.groundColor.copy(tint).multiplyScalar(0.35);
    this.hemi.intensity = Math.PI * lum * gain * 0.9 + (g.flashlightOn ? 0.25 : 0);
    this.key.color.copy(tint);
    this.key.intensity = lum * gain * 1.6;
    this.model.setScreenGain(2.4);
    // 画面の絵
    this.ui.tick(dt);
    if (this.ui.render(performance.now())) this.model.texture.needsUpdate = true;
    const ip = g.input;
    const showCursor = this.want && this.a > 0.9 && this.ui.app !== 'camera' && ((ip.mode === 'pc' && ip.locked) || (!ip.locked && ip.mode === 'pc' && this.ui.pointer !== null));
    this.model.setCursor(this.cursor.u, this.cursor.v, showCursor);
  }

  /** 照準・小さな地図を隠す・操作の案内 */
  private syncHud(): void {
    const g = this.game;
    document.body.classList.toggle('tablet-out', this.out);
    let s = '';
    if (this.want && !g.paused && !this.trip) {
      const km = g.input.keymap;
      const tab = keysLabel(km, 'tablet');
      if (g.input.mode === 'mobile') s = this.ui.app === 'camera' ? 'シャッターを押して撮影 ／ 端末ボタンでしまう' : '画面をタップ ／ 端末ボタンでしまう';
      else if (this.ui.app === 'camera') s = `クリック 撮影 ／ ホイール ズーム ／ 右クリック 戻る ／ ${tab} しまう`;
      else s = `マウス 指を動かす ／ クリック 押す ／ ホイール 回す・送る ／ 右クリック 戻る ／ ${tab} しまう`;
    }
    if (s !== this.lastHint) { this.lastHint = s; g.ui.setDeviceHint(s); }
  }
}
