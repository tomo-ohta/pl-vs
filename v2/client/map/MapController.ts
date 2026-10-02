/**
 * 地図と図鑑の取りまとめ（main.ts が作り、ClientGame の onFrame から毎フレーム呼ぶ）。
 *
 * - フロアを読んだら setFloor: 地図の元（MapInfo）と自分の地図（FloorMap。保存があれば続きから）・図鑑のフロアの記録
 * - 毎フレーム: プレイヤーの位置と向きを地図に渡す（見た区画・調査・足跡・地図の異変）→ 小さな地図 → 知らせ（図鑑に記録・調査の完成）
 *   → 読んだ壁の地図・誰かの地図を写す（部品の出力 read）→ 一定の間隔で保存
 * - M キー / 地図ボタン: メニューを地図のタブで開く（開いている間は地図のタブへ）
 * - 図鑑: 区画に入ったとき、その区画の仕掛け・異変（フロアの生成の報告 GenReport から）・隠し場所（隠しの元・行き先・レア部屋）を記録する
 * three・DOM に直接は依存しない（UI の部品は null でもよい）。ClientGame の代わりに GameLike を渡せば Node で試験できる。
 */
import type { Tuning } from '../../core/config/tuning.ts';
import type { GenReport } from '../../core/gen/floor/index.ts';
import { gimmickDef } from '../../core/gen/gimmicks/types.ts';
import { RARE_DEFS } from '../../core/gen/secrets/index.ts';
import type { FloorLayout } from '../../core/world/layout.ts';
import type { InputState } from '../input/InputController.ts';
import type { PauseTab, UiRefs } from '../ui/dom.ts';
import { CodexPanel, type CodexEntryDef } from '../ui/CodexPanel.ts';
import { MapPanel } from '../ui/MapPanel.ts';
import { Minimap } from '../ui/Minimap.ts';
import { Codex } from './Codex.ts';
import { buildMapInfo, type MapInfo } from './MapInfo.ts';
import { FloorMap, type MapEvent } from './MapModel.ts';
import { MapStore } from './MapStore.ts';
import { ghostOf } from './scene.ts';

/** ClientGame のうち地図が使う所（試験では偽物を渡す） */
export interface GameLike {
  sim: {
    players: readonly { pos: readonly [number, number, number]; yaw: number }[];
    outputOf(id: string, port: string): number;
    isRevealed(group: string): boolean;
    focusedInteractable(): string | null;
  } | null;
  paused: boolean;
  pause(): void;
  audio?: { ui(kind: 'open' | 'confirm'): void; play?(kind: string, o?: { gain?: number }): unknown };
}

/** フロアの中身の索引（フロアの生成の報告から。図鑑に使う） */
export interface FloorContents {
  gimmicks: Map<string, { def: string; name: string }>;
  anomalies: Map<string, { def: string; name: string }>;
  secrets: { id: string; host: string; hook: string; dest: string; rare?: string; cells: string[] }[];
}

export const DEST_JA: Record<string, string> = { rareRoom: 'レア部屋', passageRare: '隠し通路の先のレア部屋', loop: '別の部屋へ抜ける隠し通路', floorLink: '下のフロアへの穴', bFloor: '裏のフロアへの穴' };

export function contentsOf(r: GenReport | null): FloorContents {
  const out: FloorContents = { gimmicks: new Map(), anomalies: new Map(), secrets: [] };
  if (!r) return out;
  for (const g of r.gimmicks?.gimmicks ?? []) out.gimmicks.set(g.cell, { def: g.def, name: gimmickDef(g.def)?.name ?? g.def });
  for (const a of r.anomalies) out.anomalies.set(a.cell, { def: a.def, name: a.name });
  for (const s of r.gimmicks?.secrets ?? []) {
    const e: FloorContents['secrets'][number] = { id: s.id, host: s.host, hook: s.hook, dest: s.dest, cells: s.cells.slice() };
    if (s.rare) e.rare = s.rare;
    out.secrets.push(e);
  }
  return out;
}

export interface FloorMeta { world: number; depth: number; variant: number }
export const floorLabel = (m: FloorMeta): string => `B${m.depth + 1}F${m.variant ? ' 裏' : ''}`;

export interface MapControllerOptions {
  game: GameLike;
  ui: UiRefs | null;
  tuning: Tuning;
  codex?: Codex;
  store?: MapStore;
  /** 図鑑に並べる項目（仕掛け・異変・レア部屋・隠しの行き先） */
  defs?: CodexEntryDef[];
}

export class MapController {
  readonly game: GameLike;
  readonly ui: UiRefs | null;
  readonly t: Tuning;
  readonly codex: Codex;
  readonly store: MapStore;
  readonly minimap: Minimap;
  readonly panel: MapPanel;
  readonly codexPanel: CodexPanel;
  defs: CodexEntryDef[];
  info: MapInfo | null = null;
  map: FloorMap | null = null;
  contents: FloorContents = { gimmicks: new Map(), anomalies: new Map(), secrets: [] };
  meta: FloorMeta = { world: 1, depth: 0, variant: 0 };
  /** 知らせの記録（試験用。新しい物が後ろ） */
  readonly toasts: string[] = [];
  private saveAcc = 0;
  private wasPaused = true;
  private focusHint = false;
  /** 一時停止の画面の題（最初に読んだときの文字。フロアの名前を後ろに足す） */
  private titleBase: string | null = null;

  constructor(o: MapControllerOptions) {
    this.game = o.game;
    this.ui = o.ui;
    this.t = o.tuning;
    this.codex = o.codex ?? Codex.load();
    this.store = o.store ?? MapStore.load(undefined, o.tuning['map.save.floors']);
    this.defs = o.defs ?? [];
    this.minimap = new Minimap(o.ui?.minimap ?? null, o.ui?.survey ?? null);
    this.panel = new MapPanel(o.ui?.pause.panes.map ?? null);
    this.codexPanel = new CodexPanel(o.ui?.pause.panes.codex ?? null);
    if (o.ui) o.ui.onTabChange = (tab) => this.onTab(tab);
    // 地図のタブを開いている間の ↑↓（高さの層）
    if (o.ui && typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => {
        if (this.ui?.pauseVisible && this.ui.tab === 'map' && this.panel.onKey(e.key)) e.preventDefault();
      });
    }
    this.codex.onChange(() => { if (this.ui?.pauseVisible && this.ui.tab === 'codex') this.codexPanel.render(this.codex, this.defs); });
  }

  get floorKey(): string { return `${this.meta.world}:${this.meta.depth}.${this.meta.variant}`; }

  /** フロアを読んだ（前のフロアの地図は保存する） */
  setFloor(floor: FloorLayout, report: GenReport | null, meta: FloorMeta): void {
    this.saveNow();
    this.meta = meta;
    this.info = buildMapInfo(floor, this.t);
    this.map = new FloorMap(this.info, this.t, this.store.get(this.info.key));
    this.contents = contentsOf(report);
    this.codex.recordFloor(this.floorKey, floorLabel(meta), { ...(report ? { rarity: report.profile.rarity, family: report.profile.family.name } : {}), secretsTotal: this.contents.secrets.length });
    this.codex.setSurvey(this.floorKey, this.map.survey(), this.secretsFound());
    this.saveAcc = 0;
    // 一時停止の画面の題に、今いるフロア（v1 の OSD と同じく「いまどこか」）
    const title = this.ui?.pause?.title;
    if (title) {
      this.titleBase ??= title.textContent ?? 'LIMINAL';
      title.textContent = `${this.titleBase} ・ ${floorLabel(meta)}`;
    }
  }

  /** 毎フレーム（ClientGame の onFrame） */
  frame(input: InputState | null, dt: number): void {
    const ui = this.ui, map = this.map, sim = this.game.sim;
    // 地図を開く
    if (input?.map) this.openMap();
    // メニューを開いた・閉じた
    const paused = !!ui?.pauseVisible;
    if (paused !== this.wasPaused) {
      this.wasPaused = paused;
      if (paused) { this.onTab(ui!.tab); this.saveNow(); } else this.panel.hide();
    }
    if (!map || !sim) return;
    const p = sim.players[0];
    if (p && !this.game.paused) {
      const ev = map.update({ pos: p.pos, yaw: p.yaw, dt, doorAngle: (id) => sim.outputOf(id, 'angle'), revealed: (g) => sim.isRevealed(g) });
      for (const e of ev) this.onEvent(e);
      this.readReadables();
      this.saveAcc += dt;
      if (this.saveAcc >= this.t['map.save.intervalSec']) { this.saveAcc = 0; this.saveNow(); }
      // 調べられる地図を見ているときの案内
      const focus = sim.focusedInteractable();
      const onMap = !!focus && !!this.info?.readables.some((r) => r.id === focus);
      if (onMap !== this.focusHint) { this.focusHint = onMap; ui?.setHint(onMap ? 'E / タップ: 地図を見る（自分の地図に写す）' : ''); }
    }
    this.minimap.update(map, dt, { player: p ? { x: p.pos[0], z: p.pos[2], yaw: p.yaw } : null, doorAngle: (id) => sim.outputOf(id, 'angle') });
    this.panel.update(dt);
  }

  /** メニューを地図のタブで開く */
  openMap(): void {
    const ui = this.ui;
    if (!ui) return;
    if (!this.game.paused) { this.game.pause(); ui.setPauseVisible(true); this.game.audio?.ui('open'); }
    ui.setTab('map');
  }

  /** フロアの隠しのうち、入った物の数 */
  secretsFound(): number {
    const m = this.map;
    return m ? this.contents.secrets.filter((s) => s.cells.some((c) => m.visited.has(c))).length : 0;
  }

  saveNow(): void {
    if (!this.map || !this.info) return;
    this.store.put(this.info.key, this.map.save());
    this.codex.setSurvey(this.floorKey, this.map.survey(), this.secretsFound());
  }

  private onTab(tab: PauseTab): void {
    if (!this.ui?.pauseVisible) return;
    if (tab === 'map' && this.map) {
      const p = this.game.sim?.players[0];
      const sim = this.game.sim;
      this.panel.show({ map: this.map, floorLabel: floorLabel(this.meta), player: p ? { x: p.pos[0], z: p.pos[2], yaw: p.yaw } : null, ...(sim ? { doorAngle: (id: string) => sim.outputOf(id, 'angle') } : {}) });
    } else this.panel.hide();
    if (tab === 'codex') this.codexPanel.render(this.codex, this.defs);
  }

  private toast(text: string): void {
    this.toasts.push(text);
    if (this.toasts.length > 20) this.toasts.shift();
    this.ui?.toast(text);
  }

  private onEvent(e: MapEvent): void {
    const map = this.map!;
    if (e.type === 'visit') {
      const floor = this.floorKey;
      const g = this.contents.gimmicks.get(e.cell);
      if (g && this.codex.find('gimmick', g.def, g.name, floor)) this.toast(`図鑑に記録: ${g.name}`);
      const a = this.contents.anomalies.get(e.cell);
      if (a && this.codex.find('anomaly', a.def, a.name, floor)) this.toast(`図鑑に記録: ${a.name}`);
      for (const s of this.contents.secrets) {
        if (!s.cells.includes(e.cell)) continue;
        if (e.cell === s.cells[0] && e.first) {
          const host = this.contents.gimmicks.get(s.host)?.name;
          const label = host ? `${host}の隠し` : '暗がりの隠し';
          const newHook = this.codex.find('secret', s.hook, label, floor);
          const newDest = this.codex.find('dest', s.dest, DEST_JA[s.dest] ?? s.dest, floor);
          this.toast(newHook || newDest ? `隠しを見つけた（図鑑に記録: ${label}）` : '隠しを見つけた');
          this.codex.setSurvey(this.floorKey, map.survey(), this.secretsFound());
        }
        const cell = this.info!.byId.get(e.cell);
        const rare = RARE_DEFS.find((r) => r.id === s.rare);
        if (rare && cell?.name === rare.name && this.codex.find('rare', rare.id, rare.name, floor)) this.toast(`図鑑に記録: ${rare.name}`);
      }
      this.codex.setSurvey(this.floorKey, map.survey(), this.secretsFound());
      return;
    }
    if (e.type === 'complete') {
      this.codex.setSurvey(this.floorKey, 1, this.secretsFound());
      const total = this.contents.secrets.length;
      this.toast(`フロアの記録が完成した（調査 100%${total ? `・隠し ${this.secretsFound()} / ${total}` : ''}）`);
      this.game.audio?.ui('confirm');
      return;
    }
    if (e.type === 'fx' && e.fx === 'erase' && (e.erased ?? 0) > 0) this.game.audio?.play?.('pageTurn', { gain: 0.5 });
  }

  /** 読んだ壁の地図・誰かの地図を写す */
  private readReadables(): void {
    const sim = this.game.sim, map = this.map, info = this.info;
    if (!sim || !map || !info) return;
    for (const r of info.readables) {
      if (map.read.has(r.id) || sim.outputOf(r.id, 'read') < 0.5) continue;
      const g = ghostOf(info, r);
      if (!map.addGhost(g)) continue;
      this.game.audio?.play?.('pageTurn', { gain: 0.7 });
      this.toast(r.mode === 'note' ? `誰かの地図を読んだ（${g.author ?? '誰か'}の書き込みを地図に写した）` : r.mode === 'guide' ? '案内図を地図に写した（点線）' : r.mode === 'here' ? '看板の地図を写した（「現在地」は…？）' : '測量図を地図に写した');
    }
  }
}
