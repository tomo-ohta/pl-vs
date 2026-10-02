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
import type { DrawInput } from './draw.ts';
import { buildMapInfo, type MapInfo } from './MapInfo.ts';
import { FloorMap, type MapEvent, type MapSave } from './MapModel.ts';
import { MapStore } from './MapStore.ts';
import { ghostOf, mergeScenes, sceneOfMap, sceneOfSketch, sketchOf, type MapSketch } from './scene.ts';

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

/** 果てしない階の区域の中身（区域の layout の region.contents から） */
export function contentsOfRegion(L: FloorLayout): FloorContents {
  const out: FloorContents = { gimmicks: new Map(), anomalies: new Map(), secrets: [] };
  const c = L.region?.contents;
  if (!c) return out;
  for (const [cell, def] of c.gimmicks) out.gimmicks.set(cell, { def, name: gimmickDef(def)?.name ?? def });
  for (const [cell, def, name] of c.anomalies) out.anomalies.set(cell, { def, name });
  for (const s of c.secrets) out.secrets.push({ ...s, cells: s.cells.slice() });
  return out;
}

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

/** region: 果てしない階の区域（地図と調査率は区域ごと。docs/endless-world.md 5.4）。name: 区域の名前 */
export interface FloorMeta { world: number; depth: number; variant: number; region?: string; name?: string }
export const floorLabel = (m: FloorMeta): string => `B${m.depth + 1}F${m.variant ? ' 裏' : ''}${m.name ? ` ・ ${m.name}` : ''}`;

/** 階の地図の区域（果てしない階）: 地図の元と自分の地図（覚えておく数まで）か、写し（それより古い区域・前に遊んだときの区域） */
interface RegionEntry {
  region: string;
  key: string;
  info: MapInfo | null;
  map: FloorMap | null;
  sketch: MapSketch | null;
  contents: FloorContents;
  meta: FloorMeta;
  /** 最後に入った順（覚えておく数を超えたら古い物から写しにする） */
  used: number;
  /** 描く物の覚え（今いない区域は変わらないので、少しの間は作り直さない） */
  cache?: { scene: DrawInput; layer: number; at: number };
}

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
  /** 果てしない階の、今の階の地図（区域ごと。区域が替わっても地図は消えず、全部の区域をつないで描く） */
  private story: { key: string; entries: Map<string, RegionEntry> } | null = null;
  private useCount = 0;

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

  get floorKey(): string { return `${this.meta.world}:${this.meta.depth}.${this.meta.variant}${this.meta.region ? `:${this.meta.region}` : ''}`; }

  /** フロアを読んだ（前のフロアの地図は保存する） */
  setFloor(floor: FloorLayout, report: GenReport | null, meta: FloorMeta): void {
    this.saveNow();
    this.meta = meta;
    this.info = buildMapInfo(floor, this.t);
    this.map = new FloorMap(this.info, this.t, this.store.get(this.info.key));
    this.contents = report || !floor.region?.contents ? contentsOf(report) : contentsOfRegion(floor);
    const extra = report ? { rarity: report.profile.rarity, family: report.profile.family.name } : floor.region ? { rarity: floor.region.rarity, family: floor.region.name } : {};
    this.codex.recordFloor(this.floorKey, floorLabel(meta), { ...extra, secretsTotal: this.contents.secrets.length });
    this.codex.setSurvey(this.floorKey, this.map.survey(), this.secretsFound());
    this.saveAcc = 0;
    // 一時停止の画面の題に、今いるフロア（v1 の OSD と同じく「いまどこか」）
    const title = this.ui?.pause?.title;
    if (title) {
      this.titleBase ??= title.textContent ?? 'LIMINAL';
      title.textContent = `${this.titleBase} ・ ${floorLabel(meta)}`;
    }
  }

  /**
   * 果てしない階の区域に入った（docs/endless-world.md 13 章）。地図と調査率は区域ごとに持つが、描くときは今の階の区域を全部つなぐ。
   * 前に入った区域なら、その区域の地図に戻る（作り直さない）。階が替わったら、その階の前の地図（写し）を読む
   */
  setRegion(floor: FloorLayout, report: GenReport | null, meta: FloorMeta): void {
    const storyKey = `${meta.world}:${meta.depth}.${meta.variant}:${floor.tuningVersion}`;
    if (this.story?.key !== storyKey) {
      this.saveNow();
      this.story = { key: storyKey, entries: new Map() };
      for (const k of this.store.storyRegions(storyKey)) {
        const sk = this.store.get(k)?.sketch as MapSketch | undefined;
        if (sk && sk.region) this.story.entries.set(sk.region, { region: sk.region, key: k, info: null, map: null, sketch: sk, contents: contentsOf(null), meta: { ...meta, region: sk.region }, used: 0 });
      }
    }
    const region = meta.region ?? floor.id;
    const st = this.story;
    const have = st.entries.get(region);
    if (have?.map && have.info) {
      this.saveNow();
      this.meta = meta;
      this.info = have.info;
      this.map = have.map;
      this.contents = report ? contentsOf(report) : have.contents;
      have.contents = this.contents;
      have.used = ++this.useCount;
      this.afterSwitch(report);
      return;
    }
    this.setFloor(floor, report, meta);
    const e: RegionEntry = { region, key: this.info!.key, info: this.info, map: this.map, sketch: null, contents: this.contents, meta, used: ++this.useCount };
    st.entries.set(region, e);
    this.store.addStoryRegion(storyKey, e.key, this.t['map.save.regions']);
    // 覚えておく数を超えたら、古い区域から写しにする（地図の元を捨てる）
    const live = [...st.entries.values()].filter((x) => x.map && x !== e).sort((a, b) => a.used - b.used);
    while (live.length + 1 > this.t['map.story.keep']) {
      const old = live.shift()!;
      this.store.put(old.key, this.saveOf(old.map!, old.region));
      old.sketch = sketchOf(old.map!, old.region, groundLayer(old.info!));
      old.map = null;
      old.info = null;
      delete old.cache;
    }
  }

  private afterSwitch(report: GenReport | null): void {
    const meta = this.meta;
    this.codex.recordFloor(this.floorKey, floorLabel(meta), { ...(report ? { rarity: report.profile.rarity, family: report.profile.family.name } : {}), secretsTotal: this.contents.secrets.length });
    this.codex.setSurvey(this.floorKey, this.map!.survey(), this.secretsFound());
    this.saveAcc = 0;
    const title = this.ui?.pause?.title;
    if (title) {
      this.titleBase ??= title.textContent ?? 'LIMINAL';
      title.textContent = `${this.titleBase} ・ ${floorLabel(meta)}`;
    }
  }

  /** 区域の地図の保存（写しも入れる。次に遊んだとき、入っていない区域も階の地図に描ける） */
  private saveOf(map: FloorMap, region: string): MapSave {
    const save = map.save();
    const n = this.t['map.save.trail'] * 3;
    if (save.trail.length > n) save.trail = save.trail.slice(-n);
    const sketch = sketchOf(map, region, groundLayer(map.info));
    if (sketch.trail.length > n / 1.5) sketch.trail = sketch.trail.slice(-Math.floor(n / 3) * 2);
    return { ...save, sketch };
  }

  /** 今の階の地図の区域の数（写しを含む） */
  get storyRegions(): number { return this.story?.entries.size ?? (this.map ? 1 : 0); }

  /**
   * 描く物: 果てしない階では今の階の区域を全部つなぐ（今の区域は層 layer、ほかの区域は高さの近い層）。フロアは今のフロアだけ
   */
  sceneFor(o: { layer?: number; player: DrawInput['player']; doorAngle?: (id: string) => number }): DrawInput | null {
    const map = this.map;
    if (!map) return null;
    const cur = map.current ? map.info.byId.get(map.current) : undefined;
    const layer = o.layer ?? cur?.layer ?? 0;
    const here = sceneOfMap(map, { layer, player: o.player, ...(o.doorAngle ? { doorAngle: o.doorAngle } : {}) });
    if (!this.story) return here;
    const y = map.info.layerY[layer] ?? 0;
    const list: DrawInput[] = [here];
    for (const e of this.story.entries.values()) {
      if (e.map === map) continue;
      if (e.map && e.info) {
        let best = 0;
        e.info.layerY.forEach((ly, i) => { if (Math.abs(ly - y) < Math.abs((e.info!.layerY[best] ?? 0) - y)) best = i; });
        // 今いない区域の地図は変わらない（扉の開き具合だけ）: 1 秒の間は覚えた物を使う
        const now = map.time;
        if (!e.cache || e.cache.layer !== best || Math.abs(now - e.cache.at) > 1) e.cache = { scene: sceneOfMap(e.map, { layer: best, player: null, ...(o.doorAngle ? { doorAngle: o.doorAngle } : {}) }), layer: best, at: now };
        list.push(e.cache.scene);
      } else if (e.sketch) {
        if (!e.cache) e.cache = { scene: sceneOfSketch(e.sketch), layer: -1, at: 0 };
        list.push(e.cache.scene);
      }
    }
    return mergeScenes(list, o.player);
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
    const player = p ? { x: p.pos[0], z: p.pos[2], yaw: p.yaw } : null;
    const doorAngle = (id: string): number => sim.outputOf(id, 'angle');
    this.minimap.update(map, dt, { player, doorAngle, ...(this.story ? { scene: () => this.sceneFor({ player, doorAngle })! } : {}) });
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
    this.store.put(this.info.key, this.story ? this.saveOf(this.map, this.meta.region ?? this.info.floorId) : this.map.save());
    this.codex.setSurvey(this.floorKey, this.map.survey(), this.secretsFound());
  }

  private onTab(tab: PauseTab): void {
    if (!this.ui?.pauseVisible) return;
    if (tab === 'map' && this.map) {
      const p = this.game.sim?.players[0];
      const sim = this.game.sim;
      const doorAngle = sim ? (id: string): number => sim.outputOf(id, 'angle') : undefined;
      this.panel.show({
        map: this.map, floorLabel: floorLabel(this.meta), player: p ? { x: p.pos[0], z: p.pos[2], yaw: p.yaw } : null, ...(doorAngle ? { doorAngle } : {}),
        ...(this.story ? { scene: (layer: number, player: DrawInput['player']) => this.sceneFor({ layer, player, ...(doorAngle ? { doorAngle } : {}) })!, regions: this.storyRegions } : {}),
      });
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

/** 地面の高さの層（床の高さが 0 にいちばん近い層） */
function groundLayer(info: MapInfo): number {
  let best = 0;
  info.layerY.forEach((y, i) => { if (Math.abs(y) < Math.abs(info.layerY[best] ?? 0)) best = i; });
  return best;
}
