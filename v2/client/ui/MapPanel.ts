/**
 * メニューの「地図」タブ（v1 ui/MapPanel.ts の作り直し）。今いるフロアの、見た区画だけの平面図。
 *
 * - 見出し: フロアの名前（B3F）・調査率・入った区画の数・読んだ地図（案内図・看板・誰かの地図）
 * - 高さの層: 上下に重なる区画のあるフロアでは、層のボタン（↑↓ でも切り替え）。ほかの層は薄い破線
 * - 平面図: 入った区画は明るく、調べていない升目は影、見ただけの区画は暗く。足跡・写し（点線）・空白・出口・塔
 * - 地図が回る（N03）ときは、メニューの地図も回っている（地図の異変は「地図を信じていたのに」）
 * - 凡例（色・記号）
 * v1 の全体 3D 地図（Map3D）とフロアの目盛り（踏破したフロアの一覧）は作らない: v2 はフロアごとに別の世界なので、
 * 歩いたフロアは図鑑の「フロアの記録」に出す。
 * DOM の無い環境（Node）では pane が null になり、状態だけ持つ（tests/ui-map.test.ts）。
 *
 * 統合担当向け: client/map/MapController.ts が、メニューを開いたとき・地図のタブにしたときに show、閉じたら hide
 */
import { drawMap } from '../map/draw.ts';
import type { FloorMap } from '../map/MapModel.ts';
import { sceneOfMap } from '../map/scene.ts';

export interface MapPanelContext {
  map: FloorMap;
  /** 見出しのフロアの名前（B3F・B3F 裏） */
  floorLabel: string;
  player: { x: number; z: number; yaw: number } | null;
  doorAngle?: (id: string) => number;
}

const LEGEND: [string, string][] = [
  ['#7a86a2', '今いる'], ['#505a6e', '入った'], ['#2a2f3a', '見ただけ'], ['#7a5aa0', '隠し'], ['#f1eee4', '空白'],
];
const NOTE = '影 まだ調べていない所 ／ ・ 足跡 ／ ▼ 出口 ／ ▲ 塔 ／ 点線 読んだ地図の写し';
const SOURCE_JA = { guide: '案内図', here: '現在地の看板', note: '誰かの地図' } as const;

export class MapPanel {
  readonly pane: HTMLElement | null;
  private canvas: HTMLCanvasElement | null = null;
  private titleEl: HTMLElement | null = null;
  private subEl: HTMLElement | null = null;
  private layersEl: HTMLElement | null = null;
  private readsEl: HTMLElement | null = null;
  private ctx: MapPanelContext | null = null;
  /** 表示している層（null なら今いる層） */
  layer: number | null = null;
  visible = false;
  /** 描いた回数（試験用） */
  draws = 0;
  private acc = 0;
  private readonly ro: ResizeObserver | null = null;

  constructor(pane: HTMLElement | null = null) {
    this.pane = pane;
    if (!pane) return;
    const doc = pane.ownerDocument;
    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] => {
      const e = doc.createElement(tag);
      e.className = cls;
      if (text !== undefined) e.textContent = text;
      return e;
    };
    pane.classList.add('map-panel');
    const head = el('div', 'map-head');
    const title = el('div', 'map-title');
    this.titleEl = el('span', 'map-floor mono', '—');
    this.subEl = el('span', 'map-sub', '');
    title.append(this.titleEl, this.subEl);
    this.layersEl = el('div', 'seg map-layers');
    this.layersEl.setAttribute('role', 'tablist');
    this.layersEl.setAttribute('aria-label', '高さの層');
    head.append(title, this.layersEl);
    const stage = el('div', 'map-stage');
    this.canvas = el('canvas', 'map-2d');
    stage.append(this.canvas);
    for (const c of ['tl', 'tr', 'bl', 'br']) stage.append(el('div', `map-corner ${c}`));
    // 地図の操作が視点入力へ漏れないように
    for (const ev of ['pointerdown', 'touchstart', 'touchmove'] as const) stage.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    const legend = el('div', 'map-legend');
    for (const [color, label] of LEGEND) {
      const s = el('span', '');
      const i = el('i', '');
      i.style.background = color;
      s.append(i, doc.createTextNode(label));
      legend.append(s);
    }
    legend.append(el('span', 'map-legend-note', NOTE));
    this.readsEl = el('div', 'map-reads');
    pane.append(head, stage, legend, this.readsEl);
    this.ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { if (this.visible) this.draw(); }) : null;
    this.ro?.observe(stage);
  }

  show(ctx: MapPanelContext): void {
    this.ctx = ctx;
    this.visible = true;
    this.renderHead();
    this.draw();
  }

  hide(): void {
    this.visible = false;
  }

  /** 毎フレーム（地図が回っている・消えていく間は描き直す） */
  update(dt: number): void {
    if (!this.visible || !this.ctx) return;
    const m = this.ctx.map;
    this.acc += dt;
    if ((m.rotationPhase !== 'idle' || m.erasing.size) && this.acc > 1 / 20) { this.acc = 0; this.draw(); }
  }

  /** 表示する層（今いる層の番号） */
  get shownLayer(): number {
    const m = this.ctx?.map;
    if (!m) return 0;
    const cur = m.current ? m.info.byId.get(m.current)?.layer ?? 0 : 0;
    return Math.min(m.info.layers - 1, Math.max(0, this.layer ?? cur));
  }

  /** ↑↓ で層を変える（処理したら true） */
  onKey(key: string): boolean {
    const m = this.ctx?.map;
    if (!this.visible || !m || m.info.layers < 2) return false;
    const l = this.shownLayer;
    if (key === 'ArrowUp' && l + 1 < m.info.layers) this.setLayer(l + 1);
    else if (key === 'ArrowDown' && l > 0) this.setLayer(l - 1);
    else return false;
    return true;
  }

  setLayer(l: number | null): void {
    this.layer = l;
    this.renderHead();
    this.draw();
  }

  /** 見出しの文字（試験用にも返す） */
  headText(): { title: string; sub: string } {
    const c = this.ctx;
    if (!c) return { title: '—', sub: '' };
    const m = c.map;
    const visited = [...m.visited].filter((id) => { const x = m.info.byId.get(id); return x && !x.hidden && x.kind !== 'secret'; }).length;
    const total = m.info.cells.filter((x) => !x.hidden && x.kind !== 'secret').length;
    const pct = m.complete ? '100%（記録が完成）' : `${Math.floor(m.survey() * 100)}%`;
    const rot = Math.abs(m.rotation) > 0.05 ? ' ・ 地図が回っている' : '';
    return { title: c.floorLabel, sub: `調査 ${pct} ・ 入った区画 ${visited} / ${total}${rot}` };
  }

  private renderHead(): void {
    const c = this.ctx;
    if (!c || !this.titleEl || !this.subEl || !this.layersEl || !this.readsEl) return;
    const h = this.headText();
    this.titleEl.textContent = h.title;
    this.subEl.textContent = h.sub;
    const m = c.map;
    const doc = this.layersEl.ownerDocument;
    this.layersEl.replaceChildren();
    this.layersEl.hidden = m.info.layers < 2;
    for (let l = m.info.layers - 1; l >= 0; l--) {
      const b = doc.createElement('button');
      b.type = 'button';
      b.textContent = `高さ ${l + 1}`;
      b.classList.toggle('on', l === this.shownLayer);
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(l === this.shownLayer));
      b.addEventListener('click', () => this.setLayer(l));
      this.layersEl.append(b);
    }
    this.readsEl.replaceChildren();
    for (const g of m.ghosts) {
      const s = doc.createElement('span');
      s.className = `map-read ${g.source}`;
      s.textContent = g.source === 'note' && g.author ? `${SOURCE_JA[g.source]}（${g.author}）` : SOURCE_JA[g.source];
      this.readsEl.append(s);
    }
  }

  draw(): void {
    const c = this.ctx;
    const cv = this.canvas;
    if (!c || !cv) return;
    const g = cv.getContext('2d');
    if (!g) return;
    const dpr = Math.min(2, (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1);
    const w = Math.max(1, Math.round(cv.clientWidth * dpr)), h = Math.max(1, Math.round(cv.clientHeight * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const layer = this.shownLayer;
    const cur = c.map.current ? c.map.info.byId.get(c.map.current)?.layer : undefined;
    const scene = sceneOfMap(c.map, { layer, player: cur === layer ? c.player : null, ...(c.doorAngle ? { doorAngle: c.doorAngle } : {}) });
    drawMap(g, scene, { width: w, height: h, center: scene.bounds ? null : c.player ? [c.player.x, c.player.z] : [0, 0], pxPerM: 14 * dpr, rotation: c.map.rotation, style: 'panel', north: true, dpr, pad: 24 * dpr, time: c.map.time });
    this.draws++;
  }
}
