/**
 * デモ本体: 世界（3D）・一人称の移動・ボタンの謎・進行（踏破 / 制圧 / ヒントの段階）・タブレット・画面の表示・設定・デバッグをつなぐ
 */
import * as THREE from 'three';
import { Sfx } from './audio/Sfx.ts';
import { Progress, type Pose } from './game/Progress.ts';
import { COLOR_NAME, SYMBOL_NAME, wallPoint } from './gen/puzzles.ts';
import { fmtId } from './gen/types.ts';
import { START_ROOM, type World } from './gen/world.ts';
import { Input } from './player/Input.ts';
import { EYE_H, Player } from './player/Player.ts';
import { TabletScreen } from './tablet/TabletScreen.ts';
import { TabletView } from './tablet/TabletView.ts';
import { Hud } from './ui/Hud.ts';
import { Overlay } from './ui/Overlay.ts';
import { saveSettings, type Settings } from './ui/settings.ts';
import { PuzzleView, type ButtonView } from './world/PuzzleView.ts';
import { WorldView } from './world/WorldView.ts';

const FOV = 68;
/** ボタンに届く距離（m） */
const REACH = 2.7;
/** ヒントのタブを見続けたら新着を消すまでの時間（s） */
const SEEN_AFTER = 1.2;

export interface AppOptions {
  thresholds: readonly number[];
  settings: Settings;
  /** Pointer Lock を使わない（自動の確かめ用） */
  test: boolean;
}

export class App {
  readonly world: World;
  readonly progress: Progress;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 160);
  private readonly view: WorldView;
  private readonly puzzles: PuzzleView;
  private readonly player = new Player();
  private readonly input: Input;
  private readonly tablet: TabletView;
  private readonly hud: Hud;
  private readonly overlay: Overlay;
  private readonly sfx = new Sfx();
  private readonly settings: Settings;
  private readonly ray = new THREE.Raycaster();
  private room = -1;
  private started = false;
  private last = performance.now();
  private saveTimer = 0;
  private seenTimer = 0;
  private wheelAcc = 0;

  constructor(root: HTMLElement, world: World, opts: AppOptions) {
    this.world = world;
    this.settings = opts.settings;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.autoClear = false;
    root.append(this.renderer.domElement);

    // 世界
    this.scene.background = new THREE.Color(0x9aa1aa);
    this.scene.fog = new THREE.Fog(0x9aa1aa, 18, 75);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x7a828d, 1.25));
    const sun = new THREE.DirectionalLight(0xffffff, 1.05);
    sun.position.set(0.45, 1, 0.3);
    this.scene.add(sun);
    this.view = new WorldView(world);
    this.puzzles = new PuzzleView(world, this.view.atlas);
    this.scene.add(this.view.group, this.puzzles.group);
    this.camera.rotation.order = 'YXZ';

    // 進行（保存から戻す）
    this.progress = new Progress(world, opts.thresholds);
    const pose = this.progress.load();
    this.syncSolved();
    this.place(pose);

    // タブレット・画面の表示
    const scale = window.devicePixelRatio >= 1.5 ? 1.3 : 1;
    this.tablet = new TabletView(new TabletScreen(world, this.progress, scale), this.settings.tablet);
    this.hud = new Hud(document.body);
    this.input = new Input(this.renderer.domElement, opts.test);
    this.player.sensitivity = this.settings.sensitivity;
    this.sfx.volume = this.settings.volume;
    this.overlay = new Overlay(document.body, {
      resume: () => this.resume(),
      settings: this.settings,
      changed: () => this.applySettings(),
      stats: () => ({
        visited: this.progress.visitedCount,
        solved: this.progress.solvedCount,
        total: this.progress.total,
        stage: this.progress.stage,
        next: this.progress.nextThreshold,
        seed: world.seed,
      }),
      debugNext: () => this.debugNext(),
      debugVisitAll: () => {
        this.progress.debugVisitAll();
        return '全部屋を踏破にしました';
      },
      debugReset: () => {
        this.progress.reset();
        this.progress.visit(this.room);
        return '進行を初期化しました';
      },
      debugAnswer: () => this.answerText(),
      debugWarp: (id) => this.warp(id),
    });
    this.progress.on((e) => {
      switch (e.kind) {
        case 'visit':
          this.tablet.screen.invalidate(true);
          break;
        case 'solve':
          this.view.setRoomSolved(e.room, true);
          this.tablet.screen.invalidate(true);
          break;
        case 'stage':
          this.onStage(e.from, e.to);
          break;
        case 'bulk':
          this.syncSolved();
          this.tablet.screen.invalidate(true);
          break;
      }
      this.updateRoomCard();
      this.saveTimer = 0.5;
    });
    this.input.onLockChange = (locked) => {
      if (locked) this.overlay.hide();
      else if (this.started) {
        this.overlay.showPause();
        this.save();
      }
    };
    this.renderer.domElement.addEventListener('click', () => {
      if (!this.input.locked && !this.overlay.shown) this.resume();
    });
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('beforeunload', () => this.save());
    document.fonts?.addEventListener?.('loadingdone', () => this.tablet.screen.invalidate(true));
    this.resize();
    this.enterRoom(this.view.roomAt(this.player.x, this.player.z), true);
    this.overlay.showStart(pose !== null);
    this.exposeDebug();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ---------------------------------------------------------------- 開始・設定

  private resume(): void {
    this.sfx.start();
    this.started = true;
    this.input.lock();
  }

  private applySettings(): void {
    this.tablet.mode = this.settings.tablet;
    this.player.sensitivity = this.settings.sensitivity;
    this.sfx.volume = this.settings.volume;
    saveSettings(this.settings);
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.tablet.resize(FOV, w / h);
  }

  /** 保存した位置か、スタートの部屋の真ん中（ボタンの壁を向く） */
  private place(pose: Pose | null): void {
    if (pose) {
      this.player.x = pose.x;
      this.player.z = pose.z;
      this.player.yaw = pose.yaw;
      this.player.pitch = pose.pitch;
      return;
    }
    this.placeInRoom(START_ROOM);
  }

  private placeInRoom(i: number): void {
    const r = this.world.rooms[i].rect;
    const p = this.world.puzzles[i];
    const cx = r.x + r.w / 2;
    const cz = r.z + r.d / 2;
    const b = wallPoint(r, p.side, p.buttons[0].mount.u);
    this.player.x = cx;
    this.player.z = cz;
    this.player.vx = this.player.vz = 0;
    this.player.yaw = Math.atan2(b.x - cx, -(b.z - cz));
    this.player.pitch = -0.05;
  }

  private save(): void {
    this.progress.save({ x: this.player.x, z: this.player.z, yaw: this.player.yaw, pitch: this.player.pitch });
  }

  /** 保存・デバッグの後に、ボタンと部屋の帯を進行に合わせる */
  private syncSolved(): void {
    this.world.rooms.forEach((r) => {
      const s = this.progress.solved[r.index];
      if (this.puzzles.isSolved(r.index) !== s) this.puzzles.setSolved(r.index, s);
      this.view.setRoomSolved(r.index, s);
    });
  }

  // ---------------------------------------------------------------- 毎フレーム

  private frame(): void {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const input = this.input;
    const playing = input.locked;
    const tablet = this.tablet;

    if (playing) {
      if (input.hit('Tab')) {
        tablet.toggle();
        if (tablet.isOpen) this.sfx.tabletOpen();
        else this.sfx.tabletClose();
        this.hud.setTabletOpen(tablet.isOpen);
        this.seenTimer = 0;
      }
      if (input.hit('KeyV')) {
        this.settings.tablet = tablet.mode === 'holo' ? 'glass' : 'holo';
        this.applySettings();
        this.hud.toast('info', 'TABLET', this.settings.tablet === 'holo' ? '空中に映すホログラム' : '手に持つガラスの端末', '', 1400);
      }
      if (tablet.isOpen) {
        if (input.hit('Digit1', 'Numpad1')) this.switchTab('map');
        if (input.hit('Digit2', 'Numpad2')) this.switchTab('hint');
        this.wheelAcc += input.wheel;
        if (Math.abs(this.wheelAcc) >= 1) {
          this.switchTab(this.wheelAcc > 0 ? 'hint' : 'map');
          this.wheelAcc = 0;
        }
      }
      if (input.hit('KeyN')) this.hud.toast('info', 'DEBUG', this.debugNext(), '', 2200);
    }

    this.player.update(dt, input, this.view, playing);
    const r = this.view.roomAt(this.player.x, this.player.z);
    if (r >= 0 && r !== this.room) this.enterRoom(r, false);

    // カメラ（歩くとわずかに揺れる）
    const walk = Math.min(1, this.player.speed / 3);
    this.camera.position.set(this.player.x, EYE_H + Math.sin(this.player.stride * 2.1) * 0.012 * walk, this.player.z);
    this.camera.rotation.set(this.player.pitch, -this.player.yaw, 0);

    // ボタン（タブレットを出している間は押せない）
    let target: ButtonView | null = null;
    if (playing && !tablet.isOpen) {
      this.camera.updateMatrixWorld();
      this.ray.setFromCamera(new THREE.Vector2(0, 0), this.camera);
      target = this.puzzles.pick(this.ray, this.room, REACH);
      if (target && (input.click || input.hit('KeyE'))) this.press(target);
    }
    this.puzzles.setHover(target);
    this.hud.setTarget(!!target, !!target && this.puzzles.isSolved(target.room));
    this.puzzles.update(dt);
    this.updateSequence();
    this.hud.setYaw(this.player.yaw);

    // ヒントのタブを見たら新着を消す
    if (tablet.isOpen && tablet.screen.tab === 'hint' && this.room >= 0 && this.progress.unseen(this.room) > 0) {
      this.seenTimer += dt;
      if (this.seenTimer > SEEN_AFTER) {
        this.progress.markSeen(this.room);
        tablet.screen.invalidate();
        this.updateRoomCard();
        this.seenTimer = 0;
        this.saveTimer = 0.5;
      }
    } else this.seenTimer = 0;

    tablet.update(dt, { yaw: this.player.yaw, pitch: this.player.pitch, speed: this.player.speed, stride: this.player.stride, x: this.player.x, z: this.player.z });

    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    tablet.render(this.renderer);

    if (this.saveTimer > 0) {
      this.saveTimer -= dt;
      if (this.saveTimer <= 0) this.save();
    }
    input.endFrame();
  }

  private switchTab(t: 'map' | 'hint'): void {
    if (this.tablet.screen.tab === t) return;
    this.tablet.setTab(t);
    this.sfx.tab();
    this.seenTimer = 0;
  }

  private enterRoom(r: number, silent: boolean): void {
    if (r < 0) return;
    this.room = r;
    this.tablet.screen.setRoom(r);
    const first = this.progress.visit(r);
    if (first && !silent) {
      this.sfx.discover();
      this.hud.toast('discover', 'NEW ROOM', `ROOM ${this.world.rooms[r].label} を踏破`, '', 1500);
    }
    this.updateRoomCard();
  }

  private updateRoomCard(): void {
    if (this.room < 0) return this.hud.setRoom(null);
    const r = this.world.rooms[this.room];
    this.hud.setRoom({
      label: r.label,
      difficulty: r.difficulty,
      visited: this.progress.visited[r.index],
      solved: this.progress.solved[r.index],
      stage: this.progress.stage,
      unseen: this.progress.unseen(r.index),
    });
  }

  private updateSequence(): void {
    const p = this.room >= 0 ? this.world.puzzles[this.room] : null;
    if (!p) return;
    const s = this.puzzles.sequence(this.room);
    this.hud.setSequence(s.pressed, p.buttons.length, s.failing);
  }

  private press(b: ButtonView): void {
    const res = this.puzzles.press(b);
    const label = this.world.rooms[b.room].label;
    switch (res.kind) {
      case 'pressed':
        this.sfx.press(res.order);
        break;
      case 'wrong':
        this.sfx.press(res.order);
        this.sfx.wrong();
        this.hud.flash('rgba(255, 70, 100, 0.45)');
        this.hud.toast('wrong', 'MISMATCH', '順番が違うようだ。ボタンが元に戻った', '', 2000);
        break;
      case 'solved':
        this.sfx.press(res.order);
        this.sfx.solved();
        this.hud.flash('rgba(255, 154, 60, 0.55)');
        this.hud.toast('solved', 'CLEARED', `ROOM ${label} を制圧`, '', 2400);
        this.progress.solve(b.room);
        break;
      case 'locked':
        this.sfx.dull();
        break;
      case 'none':
        break;
    }
  }

  private onStage(from: number, to: number): void {
    this.sfx.unlock();
    this.hud.flash('rgba(255, 196, 107, 0.5)');
    const which = from + 1 === to ? `ヒント ${to}` : `ヒント ${from + 1}〜${to}`;
    this.hud.toast('unlock', `HINT ${to} UNLOCKED`, `${which} 解放`, `全部屋で ${which} が見られます（タブレットの HINT）`, 4200);
  }

  // ---------------------------------------------------------------- デバッグ

  private debugNext(): string {
    const before = this.progress.solvedCount;
    const picked = this.progress.debugNextStage(this.room);
    if (!picked.length) return 'すべての部屋を制圧済みです';
    return `制圧を ${before} → ${this.progress.solvedCount} 部屋に進めました（ヒントの段階 ${this.progress.stage}）`;
  }

  private answerText(): string {
    if (this.room < 0) return '部屋の外です';
    const p = this.world.puzzles[this.room];
    const steps = p.answer.map((i) => {
      const b = p.buttons[i];
      const what = b.color ? COLOR_NAME[b.color] : b.symbol ? SYMBOL_NAME[b.symbol] : '';
      return `左から${i + 1}番目${what ? `（${what}）` : ''}`;
    });
    return `ROOM ${this.world.rooms[this.room].label}（${p.kind}）: ${steps.join(' → ')}`;
  }

  private warp(id: number): string {
    const i = Math.round(id) - 1;
    if (!(i >= 0 && i < this.world.rooms.length)) return `ROOM ${id} はありません（1〜${this.world.rooms.length}）`;
    this.placeInRoom(i);
    this.enterRoom(i, false);
    return `ROOM ${fmtId(i + 1)} へ移りました`;
  }

  private face(what: 'buttons' | 'other' | number): string {
    if (this.room < 0) return '部屋の外です';
    const rect = this.world.rooms[this.room].rect;
    let mount = null;
    if (what === 'buttons') {
      const bs = this.world.puzzles[this.room].buttons;
      mount = { ...bs[Math.floor(bs.length / 2)].mount };
    } else if (what === 'other') {
      for (const p of this.world.puzzles) for (const c of p.clues) if (c.mount.room === this.room && c.forRoom !== this.room) mount = c.mount;
    } else mount = this.world.puzzles[this.room].clues[what]?.mount ?? null;
    if (!mount || mount.room !== this.room) return '向く物がありません';
    const at = wallPoint(rect, mount.side, mount.u);
    this.player.yaw = Math.atan2(at.x - this.player.x, -(at.z - this.player.z));
    this.player.pitch = Math.atan2(mount.y - EYE_H, Math.hypot(at.x - this.player.x, at.z - this.player.z));
    return `${mount.side} の壁の方を向きました`;
  }

  private exposeDebug(): void {
    (window as unknown as { debug: unknown }).debug = {
      nextStage: () => this.debugNext(),
      reset: () => {
        this.progress.reset();
        this.progress.visit(this.room);
        return '進行を初期化しました';
      },
      visitAll: () => this.progress.debugVisitAll(),
      answer: () => this.answerText(),
      warp: (id: number) => this.warp(id),
      /** 今の部屋で、ボタン（'buttons'）・この部屋の謎の手がかり k 番目（数）・ほかの部屋の手がかり（'other'）の方を向く */
      face: (what: 'buttons' | 'other' | number) => this.face(what),
      /** 今の部屋の左から index 番目（0 から）のボタンを押す（狙わずに） */
      press: (index: number) => {
        const b = this.puzzles.button(this.room, index);
        if (b) this.press(b);
        return this.answerText();
      },
      world: this.world,
      progress: this.progress,
      player: this.player,
      tablet: this.tablet,
    };
  }
}
