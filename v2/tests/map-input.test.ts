/**
 * 段階 4 で足した操作（client/input/InputController.ts）: M キー / スマホの地図ボタン・ライト（R）・置く（Q）のボタン。
 * DOM は使わず、Node の EventTarget で window / document / 要素の代わりを作る（tests/input-controller.test.ts と同じ作り）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

type Listenerish = EventTarget & Record<string, unknown>;

class FakeElement extends EventTarget {
  hidden = false;
  style: Record<string, string> = {};
  readonly classes = new Set<string>();
  readonly attrs = new Map<string, string>();
  classList = {
    add: (c: string) => { this.classes.add(c); },
    remove: (c: string) => { this.classes.delete(c); },
    toggle: (c: string, on?: boolean) => { const v = on ?? !this.classes.has(c); if (v) this.classes.add(c); else this.classes.delete(c); return v; },
    contains: (c: string) => this.classes.has(c),
  };
  setAttribute(k: string, v: string): void { this.attrs.set(k, v); }
  getBoundingClientRect() { return { left: 0, top: 0, width: 132, height: 132 }; }
  setPointerCapture(): void {}
  requestPointerLock(): Promise<void> { return Promise.resolve(); }
}

const win = new EventTarget() as Listenerish;
Object.assign(win, { innerWidth: 800, innerHeight: 600, matchMedia: () => ({ matches: false }), location: { search: '' } });
const doc = new EventTarget() as Listenerish;
Object.assign(doc, { pointerLockElement: null, exitPointerLock() {} });
const g = globalThis as unknown as Record<string, unknown>;
g.window = win;
g.document = doc;
g.location = { search: '' };

const { InputController } = await import('../client/input/InputController.ts');

const ev = (type: string, props: Record<string, unknown> = {}): Event => Object.assign(new Event(type, { cancelable: true }), props);

function make(withButtons = true) {
  const canvas = new FakeElement();
  const base = { touchRoot: new FakeElement(), stick: new FakeElement(), knob: new FakeElement(), jump: new FakeElement(), dash: new FakeElement(), menu: new FakeElement(), crouch: new FakeElement() };
  const extra = { map: new FakeElement(), flashlight: new FakeElement(), drop: new FakeElement() };
  const ui = withButtons ? { ...base, ...extra } : base;
  const input = new InputController(canvas as unknown as HTMLCanvasElement, ui as unknown as ConstructorParameters<typeof InputController>[1]);
  return { input, ui: { ...base, ...extra } };
}

test('M キーで地図（押した瞬間だけ）。メニュー中（無効）でも届く', () => {
  const { input } = make();
  win.dispatchEvent(ev('keydown', { code: 'KeyM', repeat: false, ctrlKey: false }));
  assert.equal(input.poll().map, true);
  assert.equal(input.poll().map, false);
  input.enabled = false;
  win.dispatchEvent(ev('keydown', { code: 'KeyM', repeat: false, ctrlKey: false }));
  const s = input.poll();
  assert.equal(s.map, true);
  assert.equal(s.flashlight, false);
  input.dispose();
});

test('スマホ: 地図・ライト・置くのボタンは押した瞬間だけ立ち、押している間は点灯する', () => {
  const { input, ui } = make();
  ui.map.dispatchEvent(ev('pointerdown', { pointerId: 1 }));
  assert.equal(input.mode, 'mobile');
  assert.ok(ui.map.classes.has('active'));
  let s = input.poll();
  assert.equal(s.map, true);
  ui.map.dispatchEvent(ev('pointerup', { pointerId: 1 }));
  assert.ok(!ui.map.classes.has('active'));
  ui.flashlight.dispatchEvent(ev('pointerdown', { pointerId: 2 }));
  ui.drop.dispatchEvent(ev('pointerdown', { pointerId: 3 }));
  s = input.poll();
  assert.equal(s.flashlight, true);
  assert.equal(s.drop, true);
  assert.equal(s.map, false);
  s = input.poll();
  assert.equal(s.flashlight || s.drop, false);
  input.dispose();
});

test('ボタンが無い画面（段階 3 までの作り）でも動く', () => {
  const { input } = make(false);
  assert.equal(input.poll().map, false);
  input.dispose();
});
