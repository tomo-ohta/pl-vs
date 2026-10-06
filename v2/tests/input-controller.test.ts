/**
 * InputController の InputState への写し方（キーボード・Pointer Lock・スマホのスティック / ボタン / タップ）。
 * DOM は使わず、Node の EventTarget で window / document / 要素の代わりを作る（必要な最小限だけ）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

type Listenerish = EventTarget & Record<string, unknown>;

/** 要素の代わり（hidden・style・classList・属性・位置・pointer capture） */
class FakeElement extends EventTarget {
  hidden = false;
  style: Record<string, string> = {};
  readonly classes = new Set<string>();
  readonly attrs = new Map<string, string>();
  lockRequests = 0;
  classList = {
    add: (c: string) => { this.classes.add(c); },
    remove: (c: string) => { this.classes.delete(c); },
    toggle: (c: string, on?: boolean) => { const v = on ?? !this.classes.has(c); if (v) this.classes.add(c); else this.classes.delete(c); return v; },
    contains: (c: string) => this.classes.has(c),
  };
  setAttribute(k: string, v: string): void { this.attrs.set(k, v); }
  getBoundingClientRect() { return { left: 0, top: 0, width: 132, height: 132 }; }
  setPointerCapture(): void {}
  requestPointerLock(): Promise<void> { this.lockRequests++; return Promise.resolve(); }
}

const win = new EventTarget() as Listenerish;
Object.assign(win, { innerWidth: 800, innerHeight: 600, matchMedia: () => ({ matches: false }), location: { search: '' } });
const doc = new EventTarget() as Listenerish;
Object.assign(doc, { pointerLockElement: null, exitPointerLock() { (doc as { pointerLockElement: unknown }).pointerLockElement = null; } });
const g = globalThis as unknown as Record<string, unknown>;
g.window = win;
g.document = doc;
g.location = { search: '' };

// window を用意してから読む（client/device.ts が import の時点で window.matchMedia を見る）
const { InputController } = await import('../client/input/InputController.ts');

function make(search = '') {
  g.location = { search };
  const canvas = new FakeElement();
  const ui = { touchRoot: new FakeElement(), stick: new FakeElement(), knob: new FakeElement(), jump: new FakeElement(), dash: new FakeElement(), menu: new FakeElement(), crouch: new FakeElement() };
  ui.touchRoot.hidden = true;
  const input = new InputController(canvas as unknown as HTMLCanvasElement, ui as unknown as ConstructorParameters<typeof InputController>[1]);
  return { input, canvas, ui };
}

const ev = (type: string, props: Record<string, unknown> = {}): Event => Object.assign(new Event(type, { cancelable: true }), props);
const key = (type: 'keydown' | 'keyup', code: string): Event => {
  const e = ev(type, { code, repeat: false, ctrlKey: false });
  win.dispatchEvent(e);
  return e;
};
const ptr = (target: EventTarget, type: string, id: number, x: number, y: number, pointerType = 'touch'): void => {
  target.dispatchEvent(ev(type, { pointerId: id, pointerType, clientX: x, clientY: y }));
};

test('キーボード: 斜めは長さ 1 に・押した瞬間の値は poll ごとに戻る', () => {
  const { input } = make();
  assert.equal(input.mode, 'pc');
  key('keydown', 'KeyW');
  key('keydown', 'KeyD');
  let s = input.poll();
  assert.ok(Math.abs(s.moveX - Math.SQRT1_2) < 1e-9 && Math.abs(s.moveY - Math.SQRT1_2) < 1e-9);
  key('keyup', 'KeyD');
  s = input.poll();
  assert.deepEqual([s.moveX, s.moveY], [0, 1]);

  const space = key('keydown', 'Space');
  assert.equal(space.defaultPrevented, true); // ページのスクロールを止める
  key('keydown', 'KeyE');
  key('keydown', 'KeyR');
  key('keydown', 'Escape');
  key('keydown', 'ShiftLeft');
  key('keydown', 'KeyC');
  s = input.poll();
  assert.equal(s.jump, true);
  assert.equal(s.interact, true);
  assert.equal(s.flashlight, true);
  assert.equal(s.menu, true);
  assert.equal(s.dash, true);
  assert.equal(s.crouch, true);
  s = input.poll();
  assert.equal(s.jump || s.interact || s.flashlight || s.menu, false);
  assert.equal(s.dash && s.crouch, true); // 押している間は続く

  // 無効の間は動かない。メニュー（Esc）だけは届く
  input.enabled = false;
  key('keydown', 'Escape');
  s = input.poll();
  assert.deepEqual([s.moveX, s.moveY, s.dash, s.crouch, s.menu], [0, 0, false, false, true]);
  input.enabled = true;

  // フォーカスが外れたら押していたキーを忘れる
  win.dispatchEvent(ev('blur'));
  s = input.poll();
  assert.deepEqual([s.moveY, s.dash, s.crouch], [0, false, false]);
  input.dispose();
  key('keydown', 'KeyW');
  assert.equal(input.poll().moveY, 0); // dispose 後は何も受け取らない
});

test('Pointer Lock: マウスで視点・ロック中のクリックで interact・Esc で外れたら menu。?nolock=1 は使わない', async () => {
  const { input, canvas } = make();
  assert.equal(input.useLock, true);
  assert.equal(await input.requestLock(), false); // 偽の canvas はロックされない
  assert.equal(canvas.lockRequests, 1);
  (doc as { pointerLockElement: unknown }).pointerLockElement = canvas;
  doc.dispatchEvent(ev('pointerlockchange'));
  assert.equal(input.locked, true);
  input.sensitivityScale = 2;
  doc.dispatchEvent(ev('mousemove', { movementX: 10, movementY: -5 }));
  canvas.dispatchEvent(ev('mousedown', { button: 0 }));
  let s = input.poll();
  assert.ok(Math.abs(s.lookDX - 10 * 0.002 * 2) < 1e-12 && Math.abs(s.lookDY + 5 * 0.002 * 2) < 1e-12);
  assert.equal(s.interact, true);
  (doc as { pointerLockElement: unknown }).pointerLockElement = null;
  doc.dispatchEvent(ev('pointerlockchange'));
  s = input.poll();
  assert.equal(input.locked, false);
  assert.equal(s.menu, true);
  input.dispose();

  const nolock = make('?nolock=1');
  assert.equal(nolock.input.useLock, false);
  assert.equal(await nolock.input.requestLock(), true);
  assert.equal(nolock.canvas.lockRequests, 0);
  nolock.input.dispose();
});

test('スマホ: スティック・しゃがむの切替・スワイプの視点・短いタップ', () => {
  const { input, canvas, ui } = make();
  // スティック: 中心（66, 66）から真上へ半径いっぱい → 前へ 1。半径の外へ出ても半径で止まる
  ptr(ui.stick, 'pointerdown', 1, 66, 66);
  assert.equal(input.mode, 'mobile');
  assert.equal(ui.touchRoot.hidden, false);
  ptr(ui.stick, 'pointermove', 1, 66, 0);
  assert.equal(ui.knob.style.transform, 'translate(0px, -66px)');
  let s = input.poll();
  assert.ok(Math.abs(s.moveX) < 1e-9 && Math.abs(s.moveY - 1) < 1e-9);
  ptr(ui.stick, 'pointermove', 1, 66 + 300, 66);
  s = input.poll();
  assert.ok(Math.abs(s.moveX - 1) < 1e-9 && Math.abs(s.moveY) < 1e-9);
  // 遊び（半径の 10% 未満）は 0
  ptr(ui.stick, 'pointermove', 1, 66 + 5, 66);
  assert.equal(input.poll().moveX, 0);
  ptr(ui.stick, 'pointerup', 1, 66, 66);
  s = input.poll();
  assert.deepEqual([s.moveX, s.moveY], [0, 0]);

  // しゃがむはタップで切替（点灯と aria-pressed）
  ui.crouch.dispatchEvent(ev('pointerdown', { pointerId: 2 }));
  assert.equal(input.poll().crouch, true);
  assert.ok(ui.crouch.classes.has('active'));
  assert.equal(ui.crouch.attrs.get('aria-pressed'), 'true');
  input.resetCrouchToggle();
  assert.equal(input.poll().crouch, false);
  assert.equal(ui.crouch.attrs.get('aria-pressed'), 'false');

  // ジャンプは押した瞬間、ダッシュは押している間
  ui.jump.dispatchEvent(ev('pointerdown', { pointerId: 3 }));
  ui.dash.dispatchEvent(ev('pointerdown', { pointerId: 4 }));
  s = input.poll();
  assert.equal(s.jump && s.dash, true);
  ui.dash.dispatchEvent(ev('pointerup', { pointerId: 4 }));
  assert.equal(input.poll().dash, false);

  // 画面のスワイプで視点
  win.dispatchEvent(ev('pointerdown', { pointerId: 5, pointerType: 'touch' }));
  ptr(canvas, 'pointerdown', 5, 400, 300);
  ptr(canvas, 'pointermove', 5, 500, 280);
  s = input.poll();
  assert.ok(Math.abs(s.lookDX - 100 * 0.004) < 1e-12 && Math.abs(s.lookDY + 20 * 0.004) < 1e-12);
  ptr(win, 'pointerup', 5, 500, 280);
  assert.equal(input.poll().tap, null); // 動かした指はタップにしない

  // 短いタップは tap（画面中央 = NDC 0, 0）
  win.dispatchEvent(ev('pointerdown', { pointerId: 6, pointerType: 'touch' }));
  ptr(canvas, 'pointerdown', 6, 400, 300);
  ptr(win, 'pointerup', 6, 400, 300);
  assert.deepEqual(input.poll().tap, { x: 0, y: 0 });

  // メニューボタン
  ui.menu.dispatchEvent(ev('pointerdown', { pointerId: 7 }));
  assert.equal(input.poll().menu, true);

  // キーを押すと PC に戻る
  key('keydown', 'KeyW');
  assert.equal(input.mode, 'pc');
  assert.equal(ui.touchRoot.hidden, true);
  input.dispose();
});
