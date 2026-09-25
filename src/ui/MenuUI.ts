/**
 * メニュー（第21回で刷新）: タブ「マップ」「フロアリスト」「設定」。ビデオカメラの一時停止画面（❚❚ PAUSE・四隅の枠・等幅の OSD 文字）。
 *
 * - マップ: MapPanel（階の目盛り + 2D 平面図 / 全体 3D）
 * - フロアリスト: レア度別に全フロアの格子。踏破済みは初めて入ったときの画像（FloorCodex）、未踏破は「？」。
 *   踏破済みを長押し（0.45 s。PC は右クリック・Enter でも）すると詳細（分類・照明・環境音・特徴・形・危険度・記録）のポップアップ
 * - 設定: SettingsPanel（#settings-slot）+ 品質 + 記録（セーブ / ロード / 新しい世界）+ 開発
 * - キー: 1 / 2 / 3 でタブ、Q / E で前後のタブ、マップでは ↑↓ で階・M で平面 / 3D。Esc は Game が閉じる（ポップアップが開いていればそれを閉じる）
 *
 * 統合担当向け: Game が new MenuUI(codex) し、openMenu で show(ctx)、closeMenu で hide()、毎フレーム update()
 */
import { RARITY_COLOR, ROOMS, ROOM_BY_ID } from '../data';
import type { Rarity, RoomDefinition } from '../core/types';
import type { WorldManager } from '../world/WorldManager';
import type { FloorCodex } from './FloorCodex';
import { MapPanel, type MapPanelOptions } from './MapPanel';
import { floorLabel, levelOf } from './Minimap';

type Tab = 'map' | 'floors' | 'settings';
const TABS: Tab[] = ['map', 'floors', 'settings'];
const RARITIES: Rarity[] = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];
const RARITY_JA: Record<Rarity, string> = { Common: 'コモン', Uncommon: 'アンコモン', Rare: 'レア', Epic: 'エピック', Legendary: 'レジェンド', Mythic: 'ミシック' };
const LONG_PRESS_MS = 450;

export interface MenuContext {
  world: WorldManager;
  currentRoomId: string | null;
  player: { x: number; z: number; yaw: number };
  mapOpts: MapPanelOptions;
}

export class MenuUI {
  readonly map: MapPanel;
  private tab: Tab = 'map';
  private ctx: MenuContext | null = null;
  private readonly root = document.getElementById('menu')!;
  private readonly floorsEl = document.getElementById('pane-floors')!;
  private readonly pop = document.getElementById('floor-pop')!;
  private floorsDirty = true;
  private visible = false;

  constructor(private readonly codex: FloorCodex) {
    this.map = new MapPanel(document.getElementById('pane-map')!);
    for (const b of this.root.querySelectorAll<HTMLButtonElement>('.menu-tabs button')) {
      b.addEventListener('click', () => this.setTab(b.dataset.tab as Tab));
    }
    this.pop.addEventListener('click', (e) => { if (e.target === this.pop || (e.target as HTMLElement).closest('.fp-close')) this.closePop(); });
    codex.onChange(() => { this.floorsDirty = true; if (this.visible && this.tab === 'floors') this.renderFloors(); });
    window.addEventListener('keydown', (e) => this.onKey(e));
    // メニュー上の操作が視点入力へ漏れないように
    for (const ev of ['pointerdown', 'touchstart', 'touchmove'] as const) this.root.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    try { const t = localStorage.getItem('liminal.menu.tab') as Tab | null; if (t && TABS.includes(t)) this.tab = t; } catch { /* noop */ }
    this.applyTab();
  }

  /** ポップアップが開いているか（Esc でメニューより先に閉じる） */
  get popOpen(): boolean { return !this.pop.hidden; }

  show(ctx: MenuContext): void {
    this.ctx = ctx;
    this.visible = true;
    this.renderWhere();
    const codexEl = document.getElementById('menu-codex');
    if (codexEl) codexEl.textContent = `${this.codex.size} / ${ROOMS.length}`;
    this.applyTab();
  }

  hide(): void {
    this.visible = false;
    this.closePop();
    this.map.hide();
  }

  update(): void {
    if (this.visible && this.tab === 'map') this.map.update();
  }

  /** Esc: ポップアップを閉じたら true（メニューは閉じない） */
  closePop(): boolean {
    if (this.pop.hidden) return false;
    this.pop.hidden = true;
    return true;
  }

  private setTab(t: Tab): void {
    if (t === this.tab) return;
    this.tab = t;
    try { localStorage.setItem('liminal.menu.tab', t); } catch { /* noop */ }
    this.applyTab();
  }

  private applyTab(): void {
    for (const b of this.root.querySelectorAll<HTMLButtonElement>('.menu-tabs button')) {
      const on = b.dataset.tab === this.tab;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', String(on));
    }
    for (const p of this.root.querySelectorAll<HTMLElement>('.menu-pane')) p.hidden = p.dataset.pane !== this.tab;
    const foot = document.getElementById('menu-foot');
    if (foot) foot.textContent = FOOT[this.tab];
    if (!this.visible || !this.ctx) return;
    if (this.tab === 'map') this.map.show(this.ctx.world, this.ctx.currentRoomId, this.ctx.player, this.ctx.mapOpts);
    else this.map.hide();
    if (this.tab === 'floors' && this.floorsDirty) this.renderFloors();
  }

  private onKey(e: KeyboardEvent): void {
    if (!this.visible) return;
    if (!this.pop.hidden) { if (e.key === 'Enter' || e.key === ' ') { this.closePop(); e.preventDefault(); } return; }
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'SELECT' || target.tagName === 'INPUT')) return;
    const i = TABS.indexOf(this.tab);
    if (e.key === '1' || e.key === '2' || e.key === '3') { this.setTab(TABS[Number(e.key) - 1]); e.preventDefault(); return; }
    if (e.key.toLowerCase() === 'q') { this.setTab(TABS[(i + TABS.length - 1) % TABS.length]); e.preventDefault(); return; }
    if (e.key.toLowerCase() === 'e') { this.setTab(TABS[(i + 1) % TABS.length]); e.preventDefault(); return; }
    if (this.tab === 'map' && this.map.onKey(e)) e.preventDefault();
  }

  /** 上部の「いまどこか」 */
  private renderWhere(): void {
    const el = document.getElementById('menu-where');
    if (!el || !this.ctx) return;
    const { world, currentRoomId } = this.ctx;
    const node = currentRoomId ? world.graph.nodes.get(currentRoomId) : undefined;
    const def = node && !node.isAdapter ? ROOM_BY_ID.get(node.definitionId) : undefined;
    const lv = currentRoomId ? levelOf(world, currentRoomId) : 0;
    el.replaceChildren();
    const f = document.createElement('span'); f.className = 'mono w-floor'; f.textContent = floorLabel(lv);
    const n = document.createElement('span'); n.className = 'w-name'; n.textContent = def?.name ?? (node?.isAdapter ? '通路' : '—');
    el.append(f, n);
    if (def) { const r = document.createElement('span'); r.className = 'mono w-rar'; r.style.color = RARITY_COLOR[def.rarity]; r.textContent = def.rarity.toUpperCase(); el.append(r); }
  }

  // ---------------------------------------------------------------- フロアリスト

  private renderFloors(): void {
    this.floorsDirty = false;
    const el = this.floorsEl;
    el.replaceChildren();
    const total = ROOMS.length;
    const found = ROOMS.filter((d) => this.codex.get(d.id)).length;
    const head = document.createElement('div');
    head.className = 'fl-summary';
    head.innerHTML = `<span class="mono">踏破 <b>${found}</b> / ${total}</span><span class="fl-bar"><i style="width:${(found / Math.max(1, total)) * 100}%"></i></span><span class="fl-help">踏破したフロアを長押しで詳細</span>`;
    el.appendChild(head);
    for (const r of RARITIES) {
      const defs = ROOMS.filter((d) => d.rarity === r).sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
      if (!defs.length) continue;
      const got = defs.filter((d) => this.codex.get(d.id)).length;
      const sec = document.createElement('section');
      sec.className = 'fl-sec';
      sec.style.setProperty('--rar', RARITY_COLOR[r]);
      sec.innerHTML = `<h3 class="fl-h"><span class="fl-rar mono">${r.toUpperCase()}</span><span class="fl-ja">${RARITY_JA[r]}</span><span class="fl-n mono">${got} / ${defs.length}</span></h3>`;
      const grid = document.createElement('div');
      grid.className = 'fl-grid';
      for (const d of defs) grid.appendChild(this.card(d));
      sec.appendChild(grid);
      el.appendChild(sec);
    }
  }

  private card(d: RoomDefinition): HTMLElement {
    const rec = this.codex.get(d.id);
    const c = document.createElement('button');
    c.type = 'button';
    c.className = 'fl-card' + (rec ? ' got' : ' unknown');
    if (!rec) {
      c.innerHTML = `<span class="fl-q mono">？</span><span class="fl-no mono">${d.id}</span>`;
      c.setAttribute('aria-label', `未踏破のフロア ${d.id}`);
      c.tabIndex = -1;
      return c;
    }
    const src = this.codex.thumb(d.id);
    c.innerHTML = `${src ? `<img src="${src}" alt="" loading="lazy" draggable="false" />` : `<span class="fl-noshot mono">NO SIGNAL</span>`}<span class="fl-name">${escapeHtml(d.name)}</span><span class="fl-no mono">${d.id}</span>`;
    c.setAttribute('aria-label', `${d.name}（長押しで詳細）`);
    // 長押し（タッチ・マウス共通）。移動したら取り消す
    let timer: ReturnType<typeof setTimeout> | null = null;
    let sx = 0, sy = 0;
    const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } c.classList.remove('pressing'); };
    c.addEventListener('pointerdown', (e) => {
      sx = e.clientX; sy = e.clientY;
      c.classList.add('pressing');
      timer = setTimeout(() => { timer = null; c.classList.remove('pressing'); this.openPop(d); }, LONG_PRESS_MS);
    });
    c.addEventListener('pointermove', (e) => { if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) cancel(); });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel'] as const) c.addEventListener(ev, cancel);
    c.addEventListener('contextmenu', (e) => { e.preventDefault(); cancel(); this.openPop(d); });
    c.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.openPop(d); } });
    return c;
  }

  private openPop(d: RoomDefinition): void {
    const rec = this.codex.get(d.id);
    if (!rec) return;
    const pop = this.pop;
    pop.style.setProperty('--rar', RARITY_COLOR[d.rarity]);
    const img = pop.querySelector<HTMLImageElement>('.fp-shot img')!;
    const src = this.codex.thumb(d.id);
    img.hidden = !src;
    if (src) img.src = src;
    pop.querySelector('.fp-shot')!.classList.toggle('empty', !src);
    pop.querySelector('.fp-rar')!.textContent = `${d.rarity.toUpperCase()} ・ ${RARITY_JA[d.rarity]}`;
    pop.querySelector('.fp-id')!.textContent = `No. ${d.id}`;
    pop.querySelector('.fp-name')!.textContent = d.name;
    const info = pop.querySelector('.fp-info')!;
    info.replaceChildren();
    const row = (k: string, v: string | null | undefined) => {
      if (!v || v === 'なし' || v === '特になし') return;
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = v;
      info.append(dt, dd);
    };
    row('区分', d.category);
    row('照明', d.lightingPreset);
    row('環境音', d.audioPreset);
    row('特徴', d.effectLabel);
    row('形', d.mapShape);
    row('つながり', d.connectionRule);
    row('危険度', '■'.repeat(Math.max(0, Math.min(5, d.dangerTag ?? 0))) + '□'.repeat(Math.max(0, 5 - Math.min(5, d.dangerTag ?? 0))));
    const first = new Date(rec.first);
    const floors = rec.levelMin === rec.levelMax ? floorLabel(rec.levelMin) : `${floorLabel(rec.levelMin)} 〜 ${floorLabel(rec.levelMax)}`;
    pop.querySelector('.fp-log')!.textContent = `初踏破 ${fmtDate(first)} ／ ${rec.visits} 回 ／ ${floors}`;
    pop.hidden = false;
    (pop.querySelector('.fp-close') as HTMLElement).focus({ preventScroll: true });
  }
}

const FOOT: Record<Tab, string> = {
  map: 'Esc 再開 ・ 1–3 / Q E タブ ・ ↑↓ フロア ・ M 平面 / 3D',
  floors: 'Esc 再開 ・ 1–3 / Q E タブ ・ 長押し（右クリック）で詳細',
  settings: 'Esc 再開 ・ 1–3 / Q E タブ ・ 設定はすぐに保存されます',
};

function fmtDate(d: Date): string {
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
