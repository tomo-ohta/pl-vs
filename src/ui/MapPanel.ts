/** メニューの地図パネル。踏破済みフロアごとの 2D 地図と、全体 3D 地図をタブで切り替える。
 *
 *  統合担当向け: 呼び出し方
 *   - show(world, currentRoomId, player, opts?): メニューを開いたとき。opts は省略可能
 *       { rotation?: number（MapRotation。ラジアン）, hiddenRoomIds?: Set<string>（MapErase） }
 *   - setView(opts): 表示中に rotation / hidden を更新（MapRotation の drift を毎フレーム渡してよい。値が変わったときだけ再描画）
 *   - update(): 毎フレーム（従来どおり）。 */
import type { WorldManager } from '../world/WorldManager';
import { drawMap, floorLabel, levelOf, visitedLevels } from './Minimap';
import { Map3D } from './Map3D';

type Player = { x: number; z: number; yaw: number };

export interface MapPanelOptions {
  /** MapRotation: 地図全体の回転（ラジアン。画面上で時計回り正） */
  rotation?: number;
  /** MapErase: 描かない部屋（発見数は変えない） */
  hiddenRoomIds?: Set<string>;
}

export class MapPanel {
  private readonly map3d: Map3D;
  private mode: 'floor' | '3d' = 'floor';
  private level = 0;
  private world: WorldManager | null = null;
  private currentRoomId: string | null = null;
  private player: Player = { x: 0, z: 0, yaw: 0 };
  private rotation = 0;
  private hiddenRoomIds: Set<string> | undefined;
  private visible = false;

  constructor(private readonly tabs: HTMLElement, private readonly canvas2d: HTMLCanvasElement, canvas3d: HTMLCanvasElement) {
    this.map3d = new Map3D(canvas3d);
    this.canvas3d = canvas3d;
  }
  private readonly canvas3d: HTMLCanvasElement;

  /** メニューを開いたとき。既定は現在のフロア（前回 3D を見ていたなら 3D のまま） */
  show(world: WorldManager, currentRoomId: string | null, player: Player, opts?: MapPanelOptions): void {
    this.world = world;
    this.currentRoomId = currentRoomId;
    this.player = player;
    this.visible = true;
    if (opts) {
      this.rotation = opts.rotation ?? 0;
      this.hiddenRoomIds = opts.hiddenRoomIds;
    }
    const levels = visitedLevels(world, this.hiddenRoomIds);
    const cur = currentRoomId ? levelOf(world, currentRoomId) : 0;
    if (this.mode === 'floor' || !levels.includes(this.level)) this.level = levels.includes(cur) ? cur : levels[0] ?? 0;
    this.renderTabs(levels, cur);
    this.draw();
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
    if (this.mode === '3d') {
      if (hiddenChanged) this.draw();
      else this.map3d.setRotation(rot);
    } else {
      this.draw();
    }
  }

  hide(): void { this.visible = false; this.map3d.hide(); }

  /** 毎フレーム（3D 表示中の回転・拡大縮小の反映） */
  update(): void { this.map3d.update(); }

  private renderTabs(levels: number[], cur: number): void {
    this.tabs.replaceChildren();
    for (const lv of levels) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = floorLabel(lv) + (lv === cur ? ' ●' : '');
      b.title = lv === cur ? '現在のフロア' : '';
      b.classList.toggle('active', this.mode === 'floor' && lv === this.level);
      b.addEventListener('click', () => { this.mode = 'floor'; this.level = lv; this.renderTabs(levels, cur); this.draw(); });
      this.tabs.appendChild(b);
    }
    const all = document.createElement('button');
    all.type = 'button';
    all.textContent = '全体 3D';
    all.classList.toggle('active', this.mode === '3d');
    all.addEventListener('click', () => { this.mode = '3d'; this.renderTabs(levels, cur); this.draw(); });
    this.tabs.appendChild(all);
  }

  private draw(): void {
    if (!this.world) return;
    if (this.mode === '3d') {
      this.canvas2d.hidden = true;
      this.canvas3d.hidden = false;
      this.map3d.show(this.world, this.currentRoomId, this.player, { rotation: this.rotation, hiddenRoomIds: this.hiddenRoomIds });
    } else {
      this.map3d.hide();
      this.canvas3d.hidden = true;
      this.canvas2d.hidden = false;
      drawMap(this.canvas2d, this.world, this.currentRoomId, this.player, {
        center: null, pxPerCell: 10, level: this.level, label: true, rotation: this.rotation, hiddenRoomIds: this.hiddenRoomIds,
      });
    }
  }
}
