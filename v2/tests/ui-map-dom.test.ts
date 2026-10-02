/**
 * 画面の部品（client/ui/dom.ts の mountUi）と、地図・図鑑のタブの DOM（MapPanel・CodexPanel）を、最小の偽の DOM で組み立てる。
 * タブの切り替え（ボタン・1/2/3 キー）・知らせ・スマホのボタンが作られること・地図と図鑑の中身が作られること。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

/** 偽の要素（mountUi・MapPanel・CodexPanel が使う所だけ） */
class FakeNode extends EventTarget {
  children: FakeNode[] = [];
  parentElement: FakeNode | null = null;
  textContent: string | null = '';
  readonly ownerDocument: FakeDocument;
  readonly tagName: string;
  constructor(ownerDocument: FakeDocument, tagName: string) { super(); this.ownerDocument = ownerDocument; this.tagName = tagName; }
  append(...nodes: (FakeNode | string)[]): void {
    for (const n of nodes) {
      const node = typeof n === 'string' ? this.ownerDocument.createTextNode(n) : n;
      node.parentElement = this;
      this.children.push(node);
    }
  }
  replaceChildren(...nodes: FakeNode[]): void { this.children = []; this.append(...nodes); }
  remove(): void { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((c) => c !== this); this.parentElement = null; }
  /** 子孫をたどる */
  *all(): Generator<FakeNode> { for (const c of this.children) { yield c; yield* c.all(); } }
  text(): string { return (this.textContent ?? '') + this.children.map((c) => c.text()).join(''); }
}
class FakeElement extends FakeNode {
  id = '';
  className = '';
  hidden = false;
  type = '';
  innerHTML = '';
  width = 0;
  height = 0;
  clientWidth = 0;
  clientHeight = 0;
  readonly dataset: Record<string, string> = {};
  readonly style: Record<string, string> = {};
  readonly attrs = new Map<string, string>();
  readonly classList = {
    add: (c: string) => { if (!this.classes().includes(c)) this.className = [...this.classes(), c].join(' '); },
    remove: (c: string) => { this.className = this.classes().filter((x) => x !== c).join(' '); },
    toggle: (c: string, on?: boolean) => { const v = on ?? !this.classes().includes(c); if (v) this.classList.add(c); else this.classList.remove(c); return v; },
    contains: (c: string) => this.classes().includes(c),
  };
  classes(): string[] { return this.className.split(' ').filter(Boolean); }
  setAttribute(k: string, v: string): void { this.attrs.set(k, v); }
  getContext(): null { return null; }
}
class FakeDocument {
  readonly defaultView = new EventTarget();
  createElement(tag: string): FakeElement { return new FakeElement(this, tag.toUpperCase()); }
  createTextNode(text: string): FakeNode { const n = new FakeNode(this, '#text'); n.textContent = text; return n; }
}

const { mountUi } = await import('../client/ui/dom.ts');
const { MapPanel } = await import('../client/ui/MapPanel.ts');
const { CodexPanel } = await import('../client/ui/CodexPanel.ts');
const { Codex } = await import('../client/map/Codex.ts');
const { codexDefs } = await import('../client/map/codexDefs.ts');
const { buildMapInfo } = await import('../client/map/MapInfo.ts');
const { FloorMap } = await import('../client/map/MapModel.ts');
const { defaultTuning } = await import('../core/config/tuning.ts');
const { labFloor } = await import('../core/lab/lab.ts');

const doc = new FakeDocument();
const body = doc.createElement('body');
const find = (root: FakeNode, f: (e: FakeElement) => boolean): FakeElement | undefined => [...root.all()].find((n): n is FakeElement => n instanceof FakeElement && f(n));

test('mountUi: タブ（地図 / 図鑑 / 設定）・小さな地図・知らせ・スマホのボタン（地図・ライト・置く）', () => {
  const ui = mountUi(body as unknown as HTMLElement);
  const layer = body.children[0]!;
  for (const id of ['minimap', 'hud-survey', 'hud-toast', 'btn-map', 'btn-flash', 'btn-drop', 'btn-menu', 'settings-slot']) assert.ok(find(layer, (e) => e.id === id), id);
  assert.equal(ui.tab, 'settings', '最初は設定のタブ（操作の案内がある）');
  assert.equal((ui.pause.panes.map as unknown as FakeElement).hidden, true);
  const seen: string[] = [];
  ui.onTabChange = (t) => seen.push(t);
  ui.pause.tabs.map.dispatchEvent(new Event('click'));
  assert.equal(ui.tab, 'map');
  assert.equal((ui.pause.panes.map as unknown as FakeElement).hidden, false);
  assert.equal((ui.pause.panes.settings as unknown as FakeElement).hidden, true);
  assert.equal((ui.pause.tabs.map as unknown as FakeElement).attrs.get('aria-selected'), 'true');
  // 開いている間は 1 / 2 / 3 キー
  ui.setPauseVisible(true);
  const key = (code: string): void => { doc.defaultView.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { code })); };
  key('Digit2');
  assert.equal(ui.tab, 'codex');
  ui.setPauseVisible(false);
  key('Digit3');
  assert.equal(ui.tab, 'codex', '閉じている間はキーでタブを変えない');
  assert.deepEqual(seen, ['map', 'codex']);
  // 知らせ
  ui.toast('図鑑に記録: 傾く床', 10);
  const toast = find(layer, (e) => e.id === 'hud-toast')!;
  assert.equal(toast.textContent, '図鑑に記録: 傾く床');
  assert.ok(toast.classList.contains('show'));
  // スマホのボタンは InputController に渡す
  assert.ok(ui.input.map && ui.input.flashlight && ui.input.drop);
  ui.dispose();
  assert.equal(body.children.length, 0);
});

test('地図のタブと図鑑のタブの DOM（見出し・層のボタン・凡例・カード）', () => {
  const t = defaultTuning();
  const pane = doc.createElement('section');
  const panel = new MapPanel(pane as unknown as HTMLElement);
  const map = new FloorMap(buildMapInfo(labFloor(), t), t);
  map.update({ pos: [0, 0, -3], yaw: 0, dt: 0.1, doorAngle: () => 1, revealed: () => false });
  map.addGhost({ source: 'note', id: 'n', cells: [], marks: [], trail: [], author: 'K.' });
  panel.show({ map, floorLabel: 'B2F', player: { x: 0, z: -3, yaw: 0 } });
  assert.ok(pane.text().includes('B2F'));
  assert.ok(pane.text().includes('調査'));
  assert.ok(pane.text().includes('誰かの地図（K.）'), '読んだ地図');
  assert.ok(find(pane, (e) => e.className.includes('map-legend')));
  const cp = new CodexPanel(doc.createElement('section') as unknown as HTMLElement);
  const codex = Codex.load(null);
  codex.find('gimmick', 'tiltRoom');
  codex.recordFloor('1:1.0', 'B2F');
  cp.render(codex, codexDefs());
  const root = cp.pane as unknown as FakeElement;
  assert.ok(root.text().includes('傾く床'));
  assert.ok(root.text().includes('？？？'), '見つけていない物は伏せる');
  assert.ok(root.text().includes('フロアの記録'));
  assert.ok(root.text().includes('B2F'));
});
