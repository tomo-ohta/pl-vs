/**
 * 小さな地図（HUD。v1 ui/Minimap.ts の HUD の地図の作り直し）。プレイヤーを中心に、今いる層の見た区画だけを描く。
 * 地図が回る（N03）ときは地図ごと回り、右上の N の印も回る。地図が消える（N02）ときは区画が明滅しながら消える。
 * 地図に記録されない部屋（N08）の中では、区画の破線と「NO DATA」だけ。
 * DOM の無い環境（Node）では canvas が null になり、何もしない（tests/ui-map.test.ts）。
 *
 * 統合担当向け: client/map/MapController.ts が毎フレーム draw を呼ぶ（30 fps に間引く）。
 */
import { drawMap, type DrawInput } from '../map/draw.ts';
import type { FloorMap } from '../map/MapModel.ts';
import { sceneOfMap } from '../map/scene.ts';

export interface MinimapOptions {
  player: { x: number; z: number; yaw: number } | null;
  doorAngle?: (id: string) => number;
  /** 1 m の画素（CSS の画素） */
  pxPerM?: number;
  /** 描く物（果てしない階の、区域をつないだ階の地図。無ければ map だけ） */
  scene?: () => DrawInput;
}

export class Minimap {
  readonly canvas: HTMLCanvasElement | null;
  readonly surveyEl: HTMLElement | null;
  visible = true;
  /** 描いた回数（試験用） */
  draws = 0;
  private acc = Infinity;
  private lastSurvey = '';

  constructor(canvas: HTMLCanvasElement | null = null, surveyEl: HTMLElement | null = null) {
    this.canvas = canvas;
    this.surveyEl = surveyEl;
  }

  setVisible(v: boolean): void {
    this.visible = v;
    if (this.canvas?.parentElement) this.canvas.parentElement.hidden = !v;
  }

  /** 毎フレーム呼ぶ（dt 秒）。30 fps に間引いて描く */
  update(map: FloorMap | null, dt: number, o: MinimapOptions): void {
    this.acc += dt;
    if (map) this.setSurvey(map.survey(), map.complete);
    if (!this.visible || !map || this.acc < 1 / 30) return;
    this.acc = 0;
    this.draw(map, o);
  }

  draw(map: FloorMap, o: MinimapOptions): void {
    const c = this.canvas;
    if (!c) return;
    const g = c.getContext('2d');
    if (!g) return;
    const dpr = Math.min(2, (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1);
    const w = Math.max(60, Math.round((c.clientWidth || 180) * dpr)), h = Math.max(60, Math.round((c.clientHeight || 180) * dpr));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const scene = o.scene ? o.scene() : sceneOfMap(map, { player: o.player, ...(o.doorAngle ? { doorAngle: o.doorAngle } : {}) });
    const p = o.player;
    drawMap(g, scene, { width: w, height: h, center: p ? [p.x, p.z] : null, pxPerM: (o.pxPerM ?? 4) * dpr, rotation: map.rotation, style: 'hud', north: true, dpr, time: map.time });
    // 地図に記録されない部屋の中（N08）
    const cur = map.current ? map.info.byId.get(map.current) : undefined;
    if (cur?.hidden) {
      g.save();
      g.fillStyle = 'rgba(10,12,18,0.55)';
      g.fillRect(0, 0, w, h);
      g.fillStyle = `rgba(230,232,238,${0.6 + 0.4 * Math.abs(Math.sin(map.time * 9))})`;
      g.font = `bold ${Math.round(13 * dpr)}px ui-monospace, Menlo, monospace`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('NO DATA', w / 2, h / 2);
      g.restore();
    }
    this.draws++;
  }

  /** 調査率の表示（変わったときだけ書く） */
  setSurvey(s: number, complete: boolean): void {
    const text = complete ? '調査 100% ✓' : `調査 ${Math.floor(s * 100)}%`;
    if (text === this.lastSurvey) return;
    this.lastSurvey = text;
    if (this.surveyEl) {
      this.surveyEl.textContent = text;
      this.surveyEl.classList.toggle('done', complete);
    }
  }

  get surveyText(): string { return this.lastSurvey; }
}
