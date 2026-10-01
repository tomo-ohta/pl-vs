/** メニューの「マップ」タブ（第21回で刷新）。踏破済みフロアごとの 2D 平面図と、全体 3D 地図を切り替える。
 *
 *  - 左の「階の目盛り」（縦軸。上ほど高い階）でフロアを選ぶ。以前はフロアの数だけボタンを横に並べていて、数十階で埋まった。
 *    目盛りは踏破した階ごと、ラベルは 1 / 5 / 10 階ごとに間引き（現在フロア ● と選択中は必ず）。↑↓ / PageUp / PageDown / Home（現在の階）でも選べる。
 *  - 2D の平面図には階名を描かない（見出しと目盛りに出す）。キャンバスは表示サイズ × 画素密度で描き直す（くっきり、スマホでも潰れない）。
 *  - 3D は選択中のフロアを注目フロアとして描く（Map3D の focusLevel）。
 *
 *  統合担当向け: 呼び出し方
 *   - new MapPanel(root): root の中に部品を作る
 *   - show(world, currentRoomId, player, opts?): メニューを開いたとき / タブを開いたとき。opts は省略可能
 *       { rotation?: number（MapRotation。ラジアン）, hiddenRoomIds?: Set<string>（MapErase） }
 *   - setView(opts): 表示中に rotation / hidden を更新（MapRotation の drift を毎フレーム渡してよい。値が変わったときだけ再描画）
 *   - update(): 毎フレーム。hide(): タブを離れた / メニューを閉じた。onKey(e): メニューが開いている間のキー（処理したら true） */
import type { WorldManager } from '../world/WorldManager';
import { RARITY_COLOR } from '../data';
import { drawMap, floorLabel, levelOf, roomsOnLevel, visitedLevels } from './Minimap';
import { Map3D, labelStep, labeledLevel } from './Map3D';

type Player = { x: number; z: number; yaw: number };

export interface MapPanelOptions {
  /** MapRotation: 地図全体の回転（ラジアン。画面上で時計回り正） */
  rotation?: number;
  /** MapErase: 描かない部屋（発見数は変えない） */
  hiddenRoomIds?: Set<string>;
}

const RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'] as const;

export class MapPanel {
  private readonly map3d: Map3D;
  private readonly canvas2d: HTMLCanvasElement;
  private readonly canvas3d: HTMLCanvasElement;
  private readonly axis: HTMLElement;
  private readonly title: HTMLElement;
  private readonly sub: HTMLElement;
  private readonly modeBtns: Record<'floor' | '3d', HTMLButtonElement>;
  private readonly stage: HTMLElement;
  private mode: 'floor' | '3d' = 'floor';
  private level = 0;
  private levels: number[] = [];
  private cur = 0;
  private world: WorldManager | null = null;
  private currentRoomId: string | null = null;
  private player: Player = { x: 0, z: 0, yaw: 0 };
  private rotation = 0;
  private hiddenRoomIds: Set<string> | undefined;
  private visible = false;
  private readonly ro: ResizeObserver | null;
  private hintTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(root: HTMLElement) {
    root.classList.add('map-panel');
    root.innerHTML = `
      <div class="map-head">
        <div class="map-title"><span class="map-floor mono"></span><span class="map-sub"></span></div>
        <div class="seg" role="tablist" aria-label="地図の表示">
          <button type="button" data-mode="floor" role="tab">平面</button>
          <button type="button" data-mode="3d" role="tab">全体 3D</button>
        </div>
      </div>
      <div class="map-body">
        <div class="map-axis" role="listbox" aria-label="フロア"></div>
        <div class="map-stage">
          <canvas class="map-2d"></canvas>
          <canvas class="map-3d" hidden></canvas>
          <div class="map-corner tl"></div><div class="map-corner tr"></div><div class="map-corner bl"></div><div class="map-corner br"></div>
          <div class="map-hint"></div>
        </div>
      </div>
      <div class="map-legend">${RARITIES.map((r) => `<span><i style="background:${RARITY_COLOR[r]}"></i>${r}</span>`).join('')}<span class="map-legend-note">▼ 穴 ／ ↕ 階段 ／ ▣ 乗り物 ／ ？ 不明な接続</span></div>`;
    this.title = root.querySelector('.map-floor')!;
    this.sub = root.querySelector('.map-sub')!;
    this.axis = root.querySelector('.map-axis')!;
    this.stage = root.querySelector('.map-stage')!;
    this.canvas2d = root.querySelector('.map-2d')!;
    this.canvas3d = root.querySelector('.map-3d')!;
    const btns = root.querySelectorAll<HTMLButtonElement>('.seg button');
    this.modeBtns = { floor: btns[0], '3d': btns[1] };
    for (const b of btns) b.addEventListener('click', () => { this.mode = b.dataset.mode === '3d' ? '3d' : 'floor'; this.refresh(); });
    this.map3d = new Map3D(this.canvas3d);
    // 3D 操作が視点入力へ漏れないように
    for (const ev of ['pointerdown', 'touchstart', 'touchmove', 'wheel'] as const) this.stage.addEventListener(ev, (e) => e.stopPropagation(), { passive: ev !== 'wheel' });
    this.ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { if (this.visible) { this.map3d.resize(); this.draw(); } }) : null;
    this.ro?.observe(this.stage);
  }

  /** メニューを開いたとき。既定は現在のフロア（3D を見ていたなら 3D のまま） */
  show(world: WorldManager, currentRoomId: string | null, player: Player, opts?: MapPanelOptions): void {
    this.world = world;
    this.currentRoomId = currentRoomId;
    this.player = player;
    this.visible = true;
    if (opts) {
      this.rotation = opts.rotation ?? 0;
      this.hiddenRoomIds = opts.hiddenRoomIds;
    }
    this.levels = visitedLevels(world, this.hiddenRoomIds);
    this.cur = currentRoomId ? levelOf(world, currentRoomId) : 0;
    this.level = this.levels.includes(this.cur) ? this.cur : this.levels[this.levels.length - 1] ?? 0;
    this.refresh();
  }

  /** 表示中に回転・隠し部屋を更新する（値が変わったときだけ描き直す） */
  setView(opts: MapPanelOptions): void {
    const rot = opts.rotation ?? 0;
    const hidden = opts.hiddenRoomIds;
    const rotChanged = Math.abs(rot - this.rotation) > 1e-4;
    const hiddenChanged = hidden !== this.hiddenRoomIds;
    if (!rotChanged && !hiddenChanged) return;
    this.rotation = rot;
    this.hiddenRoomIds = hidden;
    if (!this.visible || !this.world) return;
    if (this.mode === '3d' && !hiddenChanged) this.map3d.setRotation(rot);
    else this.draw();
  }

  hide(): void {
    this.visible = false;
    this.map3d.hide();
    const hint = this.stage.querySelector<HTMLElement>('.map-hint');
    if (hint) delete hint.dataset.key; // 次に開いたときにもう一度案内する
  }

  /** 毎フレーム（3D 表示中の回転・拡大縮小の反映） */
  update(): void { if (this.visible) this.map3d.update(); }

  /** メニューが開いている間のキー。処理したら true */
  onKey(e: KeyboardEvent): boolean {
    if (!this.visible || !this.levels.length) return false;
    const i = this.levels.indexOf(this.level);
    let to = -1;
    if (e.key === 'ArrowUp') to = Math.min(this.levels.length - 1, i + 1);
    else if (e.key === 'ArrowDown') to = Math.max(0, i - 1);
    else if (e.key === 'PageUp') to = Math.min(this.levels.length - 1, i + 5);
    else if (e.key === 'PageDown') to = Math.max(0, i - 5);
    else if (e.key === 'Home') to = Math.max(0, this.levels.indexOf(this.cur));
    else if (e.key.toLowerCase() === 'm') { this.mode = this.mode === 'floor' ? '3d' : 'floor'; this.refresh(); return true; }
    if (to < 0) return false;
    this.select(this.levels[to]);
    return true;
  }

  private select(level: number): void {
    if (level === this.level) return;
    this.level = level;
    this.refresh();
  }

  private refresh(): void {
    this.modeBtns.floor.classList.toggle('on', this.mode === 'floor');
    this.modeBtns['3d'].classList.toggle('on', this.mode === '3d');
    this.renderAxis();
    this.renderTitle();
    this.draw();
  }

  private renderTitle(): void {
    if (!this.world || !this.levels.length) { this.title.textContent = '—'; this.sub.textContent = '踏破したフロアがありません'; return; }
    this.title.textContent = floorLabel(this.level);
    const n = roomsOnLevel(this.world, this.level, this.hiddenRoomIds).length;
    const here = this.level === this.cur ? '現在地 ・ ' : '';
    this.sub.textContent = `${here}${n} 部屋 ・ 踏破 ${this.levels.length} フロア`;
  }

  /** 階の目盛り（上が高い階）。フロアが多いと行を詰め、ラベルは間引く */
  private renderAxis(): void {
    this.axis.replaceChildren();
    if (!this.levels.length) return;
    const lo = this.levels[0], hi = this.levels[this.levels.length - 1];
    const step = labelStep(hi - lo + 1);
    const dense = this.levels.length > 14;
    this.axis.classList.toggle('dense', dense);
    for (let k = this.levels.length - 1; k >= 0; k--) {
      const lv = this.levels[k];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tick';
      const labeled = labeledLevel(lv, step) || lv === this.cur || lv === this.level;
      if (labeled) b.classList.add('lab');
      if (lv === this.cur) b.classList.add('cur');
      if (lv === this.level) b.classList.add('sel');
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', String(lv === this.level));
      b.setAttribute('aria-label', floorLabel(lv) + (lv === this.cur ? '（現在地）' : ''));
      b.title = floorLabel(lv);
      b.innerHTML = `<span class="t-label mono">${labeled ? floorLabel(lv) : ''}</span><span class="t-mark"></span>`;
      b.addEventListener('click', () => this.select(lv));
      this.axis.appendChild(b);
      // 連続しない階（踏破していない階をまたぐ）には隙間の印
      const below = this.levels[k - 1];
      if (below !== undefined && lv - below > 1) {
        const gap = document.createElement('div');
        gap.className = 'gap';
        gap.textContent = '⋮';
        this.axis.appendChild(gap);
      }
    }
    // 選択中の階を見える位置へ
    const sel = this.axis.querySelector<HTMLElement>('.sel');
    if (sel) sel.scrollIntoView({ block: 'nearest' });
  }

  private draw(): void {
    if (!this.world) return;
    this.canvas2d.hidden = this.mode === '3d';
    this.canvas3d.hidden = this.mode !== '3d';
    const hint = this.stage.querySelector<HTMLElement>('.map-hint')!;
    // 操作の案内は表示を切り替えたときだけ 4 s 出して消す（地図に重なり続けないように）
    const hintKey = `${this.mode}`;
    if (hint.dataset.key !== hintKey) {
      hint.dataset.key = hintKey;
      hint.classList.add('show');
      if (this.hintTimer) clearTimeout(this.hintTimer);
      this.hintTimer = setTimeout(() => hint.classList.remove('show'), 4000);
    }
    if (this.mode === '3d') {
      hint.textContent = 'ドラッグで回転 ・ ホイール / ピンチで拡大縮小';
      this.map3d.resize();
      this.map3d.show(this.world, this.currentRoomId, this.player, { rotation: this.rotation, hiddenRoomIds: this.hiddenRoomIds, focusLevel: this.level });
      return;
    }
    hint.textContent = this.levels.length > 1 ? '↑↓ でフロアを切り替え' : '';
    this.map3d.hide();
    // 表示サイズ × 画素密度（最大 2）で描く
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(this.canvas2d.clientWidth * dpr)), h = Math.max(1, Math.round(this.canvas2d.clientHeight * dpr));
    if (this.canvas2d.width !== w || this.canvas2d.height !== h) { this.canvas2d.width = w; this.canvas2d.height = h; }
    drawMap(this.canvas2d, this.world, this.currentRoomId, this.player, {
      center: null, pxPerCell: 10 * dpr, level: this.level, label: false, rotation: this.rotation, hiddenRoomIds: this.hiddenRoomIds,
    });
  }
}
