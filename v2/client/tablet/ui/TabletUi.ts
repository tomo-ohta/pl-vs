/**
 * タブレットの画面（2D canvas。TabletModel の画面に貼る）: ホーム画面と各アプリ（カメラ・探索・マップ・SNS・ギャラリー。設定はメニューを開く）。
 *
 * - 座標は画面の絵の px（SCREEN_PX: 1152 × 800）。描くたびに押せる所（targets）を作り直し、指（カーソル・タッチ）はそれで当てる
 * - 描き直しは、変わったとき（dirty）と動きのある間（animUntil）だけ。描き直したら TabletModel の絵を送り直す（render の戻り値）
 * - 押す: down → up（12 px 以上動いたらドラッグ）。ホイールは指の下の物（無ければアプリの既定: カメラのズーム）
 * - 戻る: アプリ → ホーム、ギャラリーの写真 → 一覧、SNS の投稿 → タイムライン。タブレットをしまっても、開いていたアプリのまま
 * - SNS: 投稿のタイムライン（今は自分の投稿だけ。投稿者名・投稿日時・ルーム ID・画像）。ギャラリーの写真の「投稿」で載る（写しを持つので
 *   写真を消しても残る。同じ写真は 1 回だけ）。投稿を押すと大きく見て「探索」（撮った部屋へワープ）・「キャンセル」・「削除」
 */
import { APPS, DIAL_DIGITS, DialModel, formatTaken, type AppId } from '../logic.ts';
import type { PhotoMeta, PhotoStore } from '../PhotoStore.ts';
import type { PostAuthor, PostMeta, PostStore } from '../PostStore.ts';
import { SCREEN_PX } from '../TabletModel.ts';
import { appIcon, COLOR, fillRR, measure, MONO, rr, statusGlyphs, text, wallpaper, type G } from './paint.ts';

const W = SCREEN_PX.w, H = SCREEN_PX.h;
const STATUS_H = 48;
const CONTENT_Y = 140;

export interface MapView { zoom: number | null; pan: [number, number] | null }

export interface TabletUiHooks {
  /** 今いる所の名前（B6F）と部屋の番号（無ければ null） */
  place(): { label: string; roomId: number | null };
  /** 部屋の番号で移れるか（果てしない階） */
  roomsAvailable(): boolean;
  /** 番号の部屋があるか */
  checkRoom(id: number): Promise<boolean>;
  /** 番号の部屋へ移る（演出つき） */
  warp(id: number): void;
  /** 地図を (x, y, w, h) に描く（描いた倍率 px/m と中心。地図が無ければ null） */
  drawMap(g: G, x: number, y: number, w: number, h: number, view: MapView): { scale: number; center: [number, number] } | null;
  /** 設定を開く（メニュー） */
  openSettings(): void;
  /** シャッター（撮って保存する） */
  shutter(): Promise<{ meta: PhotoMeta; thumb: Blob } | null>;
  readonly photos: PhotoStore;
  /** SNS の投稿 */
  readonly posts: PostStore;
  /** 投稿者（自分） */
  author(): PostAuthor;
  /** 世界の seed（ギャラリーの「この部屋へ」・SNS の「探索」は同じ seed の写真だけ） */
  readonly seed: number;
  sound(kind: 'tap' | 'back' | 'open' | 'error'): void;
}

interface Target {
  id: string;
  x: number; y: number; w: number; h: number;
  click?: (x: number, y: number) => void;
  drag?: (dx: number, dy: number) => void;
  wheel?: (dy: number) => void;
}

type ExploreStatus = { kind: 'idle' } | { kind: 'checking'; at: number } | { kind: 'error'; text: string; at: number };

export class TabletUi {
  readonly canvas: HTMLCanvasElement;
  private readonly g: G;
  private readonly hooks: TabletUiHooks;
  app: AppId = 'home';
  /** アプリが変わった（カメラのときタブレットを顔の前へ） */
  onAppChange: ((app: AppId) => void) | null = null;
  /** 指の位置（絵の px）。見せないときは null */
  pointer: { x: number; y: number } | null = null;
  private targets: Target[] = [];
  private hoverId: string | null = null;
  private press: { target: Target | null; lx: number; ly: number; moved: number } | null = null;
  private dirty = true;
  private animUntil = 0;
  private now = 0;
  private minute = -1;
  private placeKey = '';
  private toast: { text: string; until: number; error?: boolean } | null = null;
  // カメラ
  /** 画面のうち見えている所（カメラのとき。絵の px。setCameraSafe で入れる） */
  cameraSafe: { x0: number; y0: number; x1: number; y1: number } = { x0: 0, y0: 0, x1: W, y1: H };
  zoom = 1;
  private flashAt = -1e9;
  private shooting = false;
  private lastShot: ImageBitmap | null = null;
  // 探索
  readonly dial = new DialModel(0);
  private dialAnim = new Array<number>(DIAL_DIGITS).fill(0);
  private dialDrag = new Array<number>(DIAL_DIGITS).fill(0);
  /** 遊ぶ人がダイアルを動かした（入るたびに今の部屋の番号へ戻さない） */
  private dialTouched = false;
  private explore: ExploreStatus = { kind: 'idle' };
  // マップ
  private readonly mapView: MapView = { zoom: null, pan: null };
  private mapDrawn: { scale: number; center: [number, number] } | null = null;
  private mapAt = 0;
  // ギャラリー
  private photos: (PhotoMeta & { thumb: Blob })[] | null = null;
  private readonly thumbs = new Map<number, ImageBitmap | 'loading' | 'failed'>();
  private scroll = 0;
  private detail: (PhotoMeta & { thumb: Blob }) | null = null;
  private detailImage: ImageBitmap | 'loading' | null = null;
  private deleteArmAt = -1e9;
  // SNS
  private posts: (PostMeta & { thumb: Blob })[] | null = null;
  /** 投稿の画像（元の大きさ。見えている物だけ読み、24 枚まで覚える） */
  private readonly postImages = new Map<number, ImageBitmap | 'loading' | 'failed'>();
  private snsScroll = 0;
  /** 大きく見ている投稿 */
  private post: (PostMeta & { thumb: Blob }) | null = null;
  private snsStatus: ExploreStatus = { kind: 'idle' };
  private postDeleteArmAt = -1e9;
  /** 投稿した写真の id（ギャラリーの「投稿済み」） */
  private postedIds = new Set<number>();
  private posting = false;

  constructor(hooks: TabletUiHooks, canvas: HTMLCanvasElement = document.createElement('canvas')) {
    this.hooks = hooks;
    this.canvas = canvas;
    canvas.width = W;
    canvas.height = H;
    this.g = canvas.getContext('2d')!;
    hooks.photos.onChange = () => { if (this.app === 'gallery') void this.loadPhotos(); };
    hooks.posts.onChange = () => { if (this.app === 'sns' || this.app === 'gallery') void this.loadPosts(); };
  }

  // ---------------------------------------------------------------- 描く
  /** 描き直したら true（呼ぶ側が絵を送り直す） */
  render(now: number): boolean {
    this.now = now;
    const m = Math.floor(Date.now() / 60000);
    if (m !== this.minute) { this.minute = m; this.dirty = true; }
    // 今いる所（階・部屋の番号）が変わった
    const pl = this.hooks.place();
    const pk = `${pl.label}/${pl.roomId ?? ''}/${this.hooks.roomsAvailable()}`;
    if (pk !== this.placeKey) { this.placeKey = pk; this.dirty = true; }
    if (this.app === 'map' && now - this.mapAt > 500) this.dirty = true;
    if (!this.dirty && now > this.animUntil) return false;
    this.dirty = false;
    this.draw();
    return true;
  }

  /** 画面のうち見えている所（カメラの位置へ上げる間に変わる。2 px 以上変わったら描き直す） */
  setCameraSafe(r: { x0: number; y0: number; x1: number; y1: number }): void {
    const c = this.cameraSafe;
    if (Math.abs(c.x0 - r.x0) + Math.abs(c.x1 - r.x1) + Math.abs(c.y0 - r.y0) + Math.abs(c.y1 - r.y1) < 2) return;
    this.cameraSafe = r;
    if (this.app === 'camera') this.dirty = true;
  }

  private animate(ms: number): void {
    this.animUntil = Math.max(this.animUntil, this.now + ms);
  }

  private invalidate(): void {
    this.dirty = true;
  }

  private draw(): void {
    const g = this.g;
    this.targets = [];
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    if (this.app === 'camera') {
      g.clearRect(0, 0, W, H);
      this.drawCamera(g);
    } else {
      if (this.app === 'home') wallpaper(g, W, H);
      else { g.fillStyle = COLOR.bg; g.fillRect(0, 0, W, H); }
      this.drawStatus(g);
      switch (this.app) {
        case 'home': this.drawHome(g); break;
        case 'explore': this.drawExplore(g); break;
        case 'map': this.drawMap(g); break;
        case 'gallery': this.drawGallery(g); break;
        case 'sns': this.drawSns(g); break;
        default: break;
      }
    }
    this.drawToast(g);
  }

  private add(t: Target): Target {
    this.targets.push(t);
    return t;
  }

  private hovered(id: string): boolean {
    return this.hoverId === id;
  }

  private drawStatus(g: G): void {
    const d = new Date();
    const hm = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    text(g, hm, 30, STATUS_H / 2 + 2, { size: 24, weight: 600 });
    const x = statusGlyphs(g, W - 26, STATUS_H / 2 + 2, 40, COLOR.text);
    text(g, '圏外', x, STATUS_H / 2 + 2, { size: 22, weight: 500, align: 'right', color: COLOR.dim });
  }

  /** アプリの見出し（戻るボタン・名前・右の文字） */
  private header(g: G, title: string, right = '', backLabel = '‹ 戻る'): void {
    const bw = Math.max(150, measure(g, backLabel, 30, 600) + 56);
    const hot = this.hovered('back');
    fillRR(g, 24, 62, bw, 58, 29, hot ? 'rgba(242,193,78,0.22)' : COLOR.panel2);
    text(g, backLabel, 24 + bw / 2, 91, { size: 30, weight: 600, align: 'center', color: hot ? COLOR.accent : COLOR.text });
    this.add({ id: 'back', x: 24, y: 62, w: bw, h: 58, click: () => this.back() });
    text(g, title, W / 2, 91, { size: 38, weight: 700, align: 'center', max: W - 2 * (bw + 60) });
    if (right) text(g, right, W - 32, 91, { size: 26, weight: 500, align: 'right', color: COLOR.dim, max: 300 });
  }

  private button(g: G, id: string, label: string, x: number, y: number, w: number, h: number, o: { accent?: boolean; danger?: boolean; disabled?: boolean; size?: number } = {}, click?: () => void): void {
    const hot = this.hovered(id) && !o.disabled;
    const pressed = this.press?.target?.id === id;
    const bg = o.disabled ? '#2a2f38' : o.danger ? (hot ? '#ff6d64' : '#d8443d') : o.accent ? (hot ? '#ffd56e' : COLOR.accent) : hot ? '#343b47' : COLOR.panel2;
    fillRR(g, x, y + (pressed ? 2 : 0), w, h, Math.min(h / 2, 30), bg);
    text(g, label, x + w / 2, y + h / 2 + (pressed ? 2 : 0), { size: o.size ?? 32, weight: 700, align: 'center', color: o.disabled ? COLOR.faint : o.accent ? '#1b1606' : COLOR.text, max: w - 24 });
    if (!o.disabled && click) this.add({ id, x, y, w, h, click });
  }

  private drawToast(g: G): void {
    const t = this.toast;
    if (!t) return;
    if (this.now > t.until) { this.toast = null; return; }
    const k = Math.min(1, (t.until - this.now) / 300);
    const cam = this.app === 'camera';
    const sc = cam ? Math.max(0.42, Math.min(1, (this.cameraSafe.x1 - this.cameraSafe.x0) / 1000)) : 1;
    const size = 28 * sc;
    const tw = Math.min(measure(g, t.text, size, 600) + 64 * sc, cam ? this.cameraSafe.x1 - this.cameraSafe.x0 - 20 : W - 40);
    const cy = cam ? this.cameraSafe.y0 + (this.cameraSafe.y1 - this.cameraSafe.y0) * 0.62 : H - 70;
    const mx = cam ? (this.cameraSafe.x0 + this.cameraSafe.x1) / 2 : W / 2;
    g.save();
    g.globalAlpha = k;
    fillRR(g, mx - tw / 2, cy - 30 * sc, tw, 60 * sc, 30 * sc, t.error ? 'rgba(160,32,28,0.92)' : 'rgba(18,20,26,0.88)');
    text(g, t.text, mx, cy + 1, { size, weight: 600, align: 'center', color: t.error ? '#ffe9e7' : COLOR.text, max: tw - 24 * sc });
    g.restore();
  }

  private showToast(s: string, ms = 2200, error = false): void {
    this.toast = { text: s, until: this.now + ms, ...(error ? { error } : {}) };
    this.animate(ms + 50);
  }

  // ---------------------------------------------------------------- ホーム
  private drawHome(g: G): void {
    const p = this.hooks.place();
    text(g, p.label, W / 2, 104, { size: 30, weight: 600, align: 'center', color: COLOR.dim });
    if (p.roomId !== null) text(g, `ROOM ${p.roomId}`, W / 2, 148, { size: 34, weight: 700, align: 'center', mono: true, color: COLOR.accent });
    const s = 150, gap = 118;
    const x0 = (W - (3 * s + 2 * gap)) / 2;
    APPS.forEach((a, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = x0 + col * (s + gap), y = 228 + row * 272;
      const hot = this.hovered(`app:${a.id}`);
      if (hot) fillRR(g, x - 16, y - 16, s + 32, s + 76, 30, 'rgba(255,255,255,0.10)');
      appIcon(g, a.id, x, y, s);
      text(g, a.label, x + s / 2, y + s + 34, { size: 30, weight: 600, align: 'center', color: hot ? COLOR.accent : COLOR.text });
      this.add({ id: `app:${a.id}`, x: x - 16, y: y - 16, w: s + 32, h: s + 76, click: () => this.open(a.id) });
    });
  }

  /** アプリを開く（設定はメニューを開く） */
  open(id: AppId): void {
    if (id === 'settings') { this.hooks.sound('open'); this.hooks.openSettings(); return; }
    if (id === this.app) return;
    this.hooks.sound('open');
    this.setApp(id);
  }

  private setApp(id: AppId): void {
    this.app = id;
    this.press = null;
    this.hoverId = null;
    if (id === 'explore') {
      if (!this.dialTouched) { const r = this.hooks.place().roomId; if (r !== null) this.dial.set(r); }
      if (this.explore.kind === 'error') this.explore = { kind: 'idle' };
    }
    if (id === 'gallery') { this.detail = null; this.detailImage = null; void this.loadPhotos(); void this.loadPosts(); }
    if (id === 'sns') { this.post = null; this.snsStatus = { kind: 'idle' }; void this.loadPosts(); }
    if (id === 'camera') this.zoom = 1;
    this.invalidate();
    this.onAppChange?.(id);
  }

  /** 戻る（アプリ → ホーム、写真 → 一覧） */
  back(): void {
    if (this.app === 'gallery' && this.detail) { this.detail = null; this.detailImage = null; this.hooks.sound('back'); this.invalidate(); return; }
    if (this.app === 'sns' && this.post) { this.closePost(); this.hooks.sound('back'); return; }
    if (this.app === 'home') return;
    this.hooks.sound('back');
    this.setApp('home');
  }

  // ---------------------------------------------------------------- カメラ
  private drawCamera(g: G): void {
    const s = this.cameraSafe;
    const cw = s.x1 - s.x0, ch = s.y1 - s.y0;
    // 見えている所の大きさに合わせて部品を縮める（スマホの縦持ちでは画面の真ん中の帯だけが見える）
    const k = Math.max(0.42, Math.min(1, cw / 1000, ch / 700));
    const portrait = cw < ch;
    const cx = s.x0 + cw / 2, cy = s.y0 + ch / 2;
    // 三分割の線・ピントの枠
    g.save();
    g.strokeStyle = 'rgba(255,255,255,0.22)';
    g.lineWidth = 2;
    for (const q of [1 / 3, 2 / 3]) {
      g.beginPath(); g.moveTo(s.x0 + cw * q, s.y0 + 120 * k); g.lineTo(s.x0 + cw * q, s.y1 - 30 * k); g.stroke();
      g.beginPath(); g.moveTo(s.x0 + 30 * k, s.y0 + ch * q); g.lineTo(s.x1 - (portrait ? 30 : 190) * k, s.y0 + ch * q); g.stroke();
    }
    const fw = 74 * k, fh = 54 * k, L = 22 * k;
    g.strokeStyle = 'rgba(255,214,94,0.9)';
    g.lineWidth = 3;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const x = cx + sx * fw, y = cy + sy * fh;
      g.beginPath(); g.moveTo(x - sx * L, y); g.lineTo(x, y); g.lineTo(x, y - sy * L); g.stroke();
    }
    g.restore();
    // 上の帯: 戻る・（広ければ）写真とズーム・部屋の番号
    const ty0 = s.y0 + 40 * k, th = 66 * k;
    fillRR(g, s.x0 + 16 * k, ty0, cw - 32 * k, th, th / 2, 'rgba(0,0,0,0.42)');
    const bw = 150 * k;
    const hot = this.hovered('back');
    fillRR(g, s.x0 + 24 * k, ty0 + 6 * k, bw, th - 12 * k, (th - 12 * k) / 2, hot ? 'rgba(242,193,78,0.3)' : 'rgba(255,255,255,0.14)');
    text(g, '‹ 戻る', s.x0 + 24 * k + bw / 2, ty0 + th / 2, { size: 28 * k, weight: 600, align: 'center', color: hot ? COLOR.accent : '#fff' });
    this.add({ id: 'back', x: s.x0 + 24 * k, y: ty0, w: bw, h: th, click: () => this.back() });
    const p = this.hooks.place();
    const room = p.roomId !== null ? `ROOM ${p.roomId}` : p.label;
    if (cw > 760) text(g, `写真  ${this.zoom.toFixed(1)}×`, cx, ty0 + th / 2, { size: 28 * k, weight: 700, align: 'center', color: '#ffd65e' });
    // 縦長（スマホ）は右上に画面のボタンが並ぶので、部屋の番号は戻るの右に
    if (portrait) text(g, room, s.x0 + 24 * k + bw + 18 * k, ty0 + th / 2, { size: 26 * k, weight: 600, mono: true, color: '#fff', max: cw - bw - 90 * k });
    else text(g, room, s.x1 - 36 * k, ty0 + th / 2, { size: 26 * k, weight: 600, align: 'right', mono: true, color: '#fff', max: cw - bw - 90 * k });
    // シャッター・ズーム・前の写真（横長: 右の真ん中に縦に並べる / 縦長: 下の真ん中に横に並べる）
    const R = 60 * k, gap = 130 * k;
    // 縦長は下寄り（画面の下のスティック・REC の時刻にかからない高さ）
    const sx = portrait ? cx : s.x1 - 112 * k, sy = portrait ? s.y0 + ch * 0.7 : cy;
    const zoomAt: [number, number] = portrait ? [sx - gap * 1.25, sy] : [sx, sy - gap];
    const lastAt: [number, number] = portrait ? [sx + gap * 1.25, sy] : [sx, sy + gap * 0.8 + 44 * k];
    const pressed = this.shooting || this.press?.target?.id === 'shutter';
    g.save();
    g.lineWidth = 9 * k;
    g.strokeStyle = '#ffffff';
    g.beginPath(); g.arc(sx, sy, R, 0, Math.PI * 2); g.stroke();
    g.fillStyle = this.hovered('shutter') ? '#ffe7a3' : '#ffffff';
    g.beginPath(); g.arc(sx, sy, (pressed ? 42 : 48) * k, 0, Math.PI * 2); g.fill();
    g.restore();
    this.add({ id: 'shutter', x: sx - R - 6, y: sy - R - 6, w: 2 * R + 12, h: 2 * R + 12, click: () => this.shutter() });
    const zw = 92 * k, zh = 60 * k;
    fillRR(g, zoomAt[0] - zw / 2, zoomAt[1] - zh / 2, zw, zh, zh / 2, this.hovered('zoom') ? 'rgba(242,193,78,0.35)' : 'rgba(0,0,0,0.45)');
    text(g, `${this.zoom < 1.5 ? 1 : this.zoom < 3 ? 2 : 4}×`, zoomAt[0], zoomAt[1] + 1, { size: 28 * k, weight: 700, align: 'center', color: '#fff' });
    this.add({ id: 'zoom', x: zoomAt[0] - zw / 2, y: zoomAt[1] - zh / 2, w: zw, h: zh, click: () => { this.zoom = this.zoom < 1.5 ? 2 : this.zoom < 3 ? 4 : 1; this.hooks.sound('tap'); this.invalidate(); } });
    const lw = 88 * k;
    const lx = lastAt[0] - lw / 2, ly = lastAt[1] - lw / 2;
    g.save();
    rr(g, lx, ly, lw, lw, 16 * k);
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fill();
    if (this.lastShot) { g.clip(); this.cover(g, this.lastShot, lx, ly, lw, lw); }
    g.restore();
    g.save();
    rr(g, lx, ly, lw, lw, 16 * k);
    g.strokeStyle = this.hovered('last') ? COLOR.accent : 'rgba(255,255,255,0.85)';
    g.lineWidth = 3;
    g.stroke();
    g.restore();
    this.add({ id: 'last', x: lx, y: ly, w: lw, h: lw, click: () => { this.hooks.sound('open'); this.setApp('gallery'); } });
    // シャッターの光
    const f = 1 - (this.now - this.flashAt) / 260;
    if (f > 0) { g.fillStyle = `rgba(255,255,255,${0.85 * f})`; g.fillRect(0, 0, W, H); }
  }

  /** シャッター（撮って保存。続けて押しても 1 枚ずつ） */
  shutter(): void {
    if (this.shooting) return;
    this.shooting = true;
    this.flashAt = this.now;
    this.animate(300);
    this.invalidate();
    void this.hooks.shutter().then(async (r) => {
      this.shooting = false;
      if (!r) { this.showToast('保存できませんでした', 2200, true); return; }
      try { this.lastShot = await createImageBitmap(r.thumb); } catch { /* 小さい写真が読めなくても保存はできている */ }
      this.showToast(r.meta.roomId !== null ? `保存しました ・ ROOM ${r.meta.roomId}` : '保存しました');
      this.invalidate();
    });
  }

  // ---------------------------------------------------------------- 探索
  private drawExplore(g: G): void {
    this.header(g, '探索');
    if (!this.hooks.roomsAvailable()) {
      text(g, 'この場所では使えません', W / 2, 380, { size: 38, weight: 700, align: 'center' });
      text(g, '（部屋の番号のない場所です）', W / 2, 440, { size: 28, align: 'center', color: COLOR.dim });
      return;
    }
    const here = this.hooks.place().roomId;
    text(g, '部屋の番号（ROOM ID）を合わせて「移動」', W / 2, 172, { size: 28, align: 'center', color: COLOR.dim });
    text(g, here !== null ? `現在地  ROOM ${here}` : '現在地  —', W / 2, 220, { size: 28, weight: 600, align: 'center', mono: true, color: COLOR.accent });
    const DW = 98, DH = 206, GAP = 12;
    const x0 = (W - (DIAL_DIGITS * DW + (DIAL_DIGITS - 1) * GAP)) / 2, y0 = 262;
    for (let i = 0; i < DIAL_DIGITS; i++) this.drawDial(g, i, x0 + i * (DW + GAP), y0, DW, DH);
    // 状態の行
    const st = this.explore;
    this.drawTravelStatus(g, st, 510);
    const busy = st.kind === 'checking';
    const bw = 320, bh = 96, by = 572;
    if (here !== null) {
      this.button(g, 'reset', '現在地に戻す', W / 2 - bw - 16, by, bw, bh, { size: 30, disabled: busy }, () => { this.dial.set(here); this.dialTouched = false; this.hooks.sound('tap'); this.invalidate(); });
      this.button(g, 'go', '移動', W / 2 + 16, by, bw, bh, { accent: true, disabled: busy, size: 36 }, () => this.go());
    } else this.button(g, 'go', '移動', W / 2 - bw / 2, by, bw, bh, { accent: true, disabled: busy, size: 36 }, () => this.go());
    text(g, 'ホイール・ドラッグ・▲▼ で回す ／ 数字キーでも入れられる ／ Enter で移動', W / 2, 726, { size: 23, align: 'center', color: COLOR.faint, max: W - 60 });
  }

  private drawDial(g: G, i: number, x: number, y: number, w: number, h: number): void {
    const hot = this.hovered(`dial:${i}`) || this.press?.target?.id === `dial:${i}`;
    const bg = g.createLinearGradient(x, y, x, y + h);
    bg.addColorStop(0, '#0b0d11');
    bg.addColorStop(0.5, '#252b35');
    bg.addColorStop(1, '#0b0d11');
    fillRR(g, x, y, w, h, 18, bg);
    g.save();
    rr(g, x, y, w, h, 18);
    g.clip();
    const d = this.dial.digits[i]!;
    const off = this.dialAnim[i]!;
    const rowH = 84, cy = y + h / 2;
    const dim = this.dial.leading(i);
    for (let k = -2; k <= 2; k++) {
      const yy = cy + (k + off) * rowH;
      const dist = Math.abs(k + off);
      if (dist > 1.6) continue;
      const v = (((d + k) % 10) + 10) % 10;
      const size = 88 - dist * 30;
      g.save();
      g.globalAlpha = Math.max(0, 1 - dist * 0.72);
      g.font = `700 ${size}px ${MONO}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = dim ? COLOR.faint : COLOR.text;
      g.fillText(String(v), x + w / 2, yy + 4);
      g.restore();
    }
    g.restore();
    text(g, '▲', x + w / 2, y + 16, { size: 18, align: 'center', color: hot ? COLOR.accent : COLOR.faint });
    text(g, '▼', x + w / 2, y + h - 16, { size: 18, align: 'center', color: hot ? COLOR.accent : COLOR.faint });
    g.save();
    rr(g, x, y, w, h, 18);
    g.strokeStyle = hot ? COLOR.accent : 'rgba(255,255,255,0.10)';
    g.lineWidth = hot ? 4 : 2;
    g.stroke();
    g.restore();
    if (Math.abs(off) > 0.01) this.animate(32);
    this.add({
      id: `dial:${i}`, x, y, w, h,
      click: (_px, py) => this.stepDial(i, py < y + h / 2 ? 1 : -1),
      wheel: (dy) => this.stepDial(i, dy < 0 ? 1 : -1),
      drag: (_dx, dy) => {
        this.dialDrag[i]! -= dy;
        while (this.dialDrag[i]! >= 34) { this.dialDrag[i]! -= 34; this.stepDial(i, 1); }
        while (this.dialDrag[i]! <= -34) { this.dialDrag[i]! += 34; this.stepDial(i, -1); }
      },
    });
  }

  private stepDial(i: number, d: number): void {
    if (this.explore.kind === 'checking') return;
    this.dial.step(i, d);
    this.dialAnim[i] = Math.max(-1.5, Math.min(1.5, this.dialAnim[i]! + d));
    this.dialTouched = true;
    if (this.explore.kind === 'error') this.explore = { kind: 'idle' };
    this.hooks.sound('tap');
    this.invalidate();
  }

  /** 1 フレームごと（ダイアルの回る動き） */
  tick(dt: number): void {
    let moving = false;
    for (let i = 0; i < DIAL_DIGITS; i++) {
      const a = this.dialAnim[i]!;
      if (a === 0) continue;
      const n = a * Math.exp(-dt / 0.055);
      this.dialAnim[i] = Math.abs(n) < 0.01 ? 0 : n;
      moving = true;
    }
    if (moving) this.invalidate();
  }

  /** 数字キー（探索のとき） */
  typed(s: string): void {
    if (this.app !== 'explore' || this.explore.kind === 'checking') return;
    for (const ch of s) this.dial.type(ch);
    this.dialTouched = true;
    if (this.explore.kind === 'error') this.explore = { kind: 'idle' };
    this.hooks.sound('tap');
    this.invalidate();
  }

  /** Backspace: 探索では 1 文字消す（それ以外は戻る） */
  backspace(): void {
    if (this.app !== 'explore') { this.back(); return; }
    if (this.explore.kind === 'checking') return;
    this.dial.backspace();
    this.dialTouched = true;
    this.hooks.sound('tap');
    this.invalidate();
  }

  /** Enter: 探索では移動 */
  enter(): void {
    if (this.app === 'explore') this.go();
  }

  /** 移動（探索）: ダイアルの番号の部屋へ */
  private go(): void {
    this.travel('explore', this.dial.value, () => { this.dialTouched = false; });
  }

  private statusOf(which: 'explore' | 'sns'): ExploreStatus {
    return which === 'explore' ? this.explore : this.snsStatus;
  }

  private setStatus(which: 'explore' | 'sns', st: ExploreStatus): void {
    if (which === 'explore') this.explore = st;
    else this.snsStatus = st;
  }

  /**
   * 番号の部屋へ移る（探索の「移動」・SNS の「探索」）: 部屋があるか確かめ（接続中…）、あれば移る（演出は hooks.warp）。
   * 無ければその画面に通信エラー。onWarp: 移り始める直前
   */
  private travel(which: 'explore' | 'sns', id: number, onWarp?: () => void): void {
    if (this.statusOf(which).kind === 'checking' || !this.hooks.roomsAvailable()) return;
    this.hooks.sound('tap');
    if (id < 1000) { this.fail(which, `ROOM ${id} は見つかりません（4 桁以上）`); return; }
    this.setStatus(which, { kind: 'checking', at: this.now });
    this.invalidate();
    void this.hooks.checkRoom(id).then((ok) => {
      if (!ok) { this.fail(which, `通信エラー：ROOM ${id} は見つかりません`); return; }
      this.setStatus(which, { kind: 'idle' });
      onWarp?.();
      this.invalidate();
      this.hooks.warp(id);
    }, () => this.fail(which, '通信エラー：接続できません'));
  }

  private fail(which: 'explore' | 'sns', s: string): void {
    this.setStatus(which, { kind: 'error', text: s, at: this.now });
    if (which === 'explore') this.dial.fresh = true;
    this.hooks.sound('error');
    this.animate(800);
    this.invalidate();
  }

  /** 移る用意の状態の行（接続中… / 通信エラー） */
  private drawTravelStatus(g: G, st: ExploreStatus, y: number): void {
    if (st.kind === 'checking') {
      const dots = '.'.repeat(1 + (Math.floor(this.now / 250) % 3));
      text(g, `接続中${dots}`, W / 2, y, { size: 30, weight: 600, align: 'center', color: COLOR.accent });
      this.animate(300);
    } else if (st.kind === 'error') {
      const t = this.now - st.at;
      const jitter = t < 700 ? (Math.random() - 0.5) * 14 : 0;
      text(g, st.text, W / 2 + jitter, y, { size: 30, weight: 700, align: 'center', color: COLOR.danger, alpha: t < 700 && Math.random() < 0.2 ? 0.3 : 1, max: W - 60 });
      if (t < 700) this.animate(60);
    }
  }

  // ---------------------------------------------------------------- マップ
  private drawMap(g: G): void {
    this.mapAt = this.now;
    this.header(g, 'マップ', this.hooks.place().label);
    const x = 24, y = CONTENT_Y, w = W - 48, h = H - CONTENT_Y - 24;
    fillRR(g, x, y, w, h, 22, '#0b0e12');
    g.save();
    rr(g, x, y, w, h, 22);
    g.clip();
    this.mapDrawn = this.hooks.drawMap(g, x, y, w, h, this.mapView);
    g.restore();
    if (!this.mapDrawn) { text(g, '地図がありません', W / 2, y + h / 2, { size: 32, align: 'center', color: COLOR.dim }); return; }
    this.add({
      id: 'map', x, y, w, h,
      drag: (dx, dy) => {
        const d = this.mapDrawn;
        if (!d) return;
        if (this.mapView.zoom === null) { this.mapView.zoom = d.scale; this.mapView.pan = [...d.center]; }
        const pan = this.mapView.pan ?? [...d.center];
        this.mapView.pan = [pan[0] - dx / this.mapView.zoom, pan[1] - dy / this.mapView.zoom];
        this.invalidate();
      },
      wheel: (dy) => this.zoomMap(Math.pow(1.12, -dy / 100)),
    });
    const bx = x + w - 20, by = y + h - 20;
    this.button(g, 'map:here', '現在地', bx - 170, by - 72, 170, 72, { size: 28 }, () => { this.mapView.zoom = null; this.mapView.pan = null; this.hooks.sound('tap'); this.invalidate(); });
    this.button(g, 'map:in', '＋', bx - 170 - 92, by - 72, 80, 72, { size: 34 }, () => this.zoomMap(1.4));
    this.button(g, 'map:out', '－', bx - 170 - 184, by - 72, 80, 72, { size: 34 }, () => this.zoomMap(1 / 1.4));
  }

  private zoomMap(k: number): void {
    const d = this.mapDrawn;
    if (!d) return;
    if (this.mapView.zoom === null) { this.mapView.zoom = d.scale; this.mapView.pan = [...d.center]; }
    this.mapView.zoom = Math.max(1.2, Math.min(160, this.mapView.zoom * k));
    this.invalidate();
  }

  // ---------------------------------------------------------------- SNS
  private async loadPosts(): Promise<void> {
    try {
      this.posts = await this.hooks.posts.list();
    } catch (e) {
      console.warn('[SNS] 読めません', e);
      this.posts = [];
    }
    this.postedIds = new Set(this.posts.map((p) => p.photoId).filter((x): x is number => x !== null));
    if (this.post && !this.posts.some((p) => p.id === this.post!.id)) this.post = null;
    this.invalidate();
  }

  /** 投稿の画像（元の大きさ。読み終えるまで null。24 枚を超えたら古い物を捨てる） */
  private postImageOf(p: PostMeta & { thumb: Blob }): ImageBitmap | null {
    const t = this.postImages.get(p.id);
    if (t instanceof ImageBitmap) { this.postImages.delete(p.id); this.postImages.set(p.id, t); return t; }
    if (t === undefined) {
      this.postImages.set(p.id, 'loading');
      void this.hooks.posts.image(p.id).then(async (blob) => {
        try { this.postImages.set(p.id, await createImageBitmap(blob ?? p.thumb)); } catch { this.postImages.set(p.id, 'failed'); }
        for (const [k, v] of this.postImages) {
          if (this.postImages.size <= 24) break;
          if (v instanceof ImageBitmap) v.close();
          this.postImages.delete(k);
        }
        this.invalidate();
      });
    }
    return null;
  }

  /** 投稿の画像がまだ無いときの文字 */
  private postImageNote(id: number): string {
    return this.postImages.get(id) === 'failed' ? '画像を読めません' : '読み込み中…';
  }

  /** 投稿者の丸い印（名前の頭の文字。色は投稿者の id から） */
  private avatar(g: G, a: PostAuthor, x: number, y: number, s: number): void {
    let h = 0;
    for (const ch of a.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    g.save();
    g.fillStyle = `hsl(${h % 360} 42% 40%)`;
    g.beginPath(); g.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2); g.fill();
    g.restore();
    text(g, [...a.name][0] ?? '?', x + s / 2, y + s / 2 + 1, { size: s * 0.48, weight: 700, align: 'center', color: '#fff' });
  }

  /** タイムライン（新しい順。縦に流れる） */
  private drawSns(g: G): void {
    if (this.post) { this.drawPost(g, this.post); return; }
    const list = this.posts;
    this.header(g, 'SNS', list ? `${list.length} 件` : '');
    if (!list) { text(g, '読み込み中…', W / 2, 420, { size: 30, align: 'center', color: COLOR.dim }); return; }
    if (!list.length) {
      appIcon(g, 'sns', W / 2 - 70, 210, 140);
      text(g, 'まだ投稿がありません', W / 2, 420, { size: 36, weight: 700, align: 'center' });
      text(g, 'ギャラリーで写真を開いて「投稿」を押すと、ここに並びます', W / 2, 476, { size: 26, align: 'center', color: COLOR.dim, max: W - 80 });
      return;
    }
    const CW = 720, x0 = (W - CW) / 2, viewH = H - CONTENT_Y, GAP = 20;
    const cards = list.map((p) => { const ih = Math.min(420, Math.round(((CW - 32) * p.h) / Math.max(1, p.w))); return { p, ih, h: 92 + ih + 18 }; });
    const total = cards.reduce((a, c) => a + c.h + GAP, 12);
    const maxScroll = Math.max(0, total - viewH);
    this.snsScroll = Math.max(0, Math.min(maxScroll, this.snsScroll));
    const scrollBy = (dy: number): void => { this.snsScroll = Math.max(0, Math.min(maxScroll, this.snsScroll + dy)); this.invalidate(); };
    this.add({ id: 'timeline', x: 0, y: CONTENT_Y, w: W, h: viewH, wheel: (dy) => scrollBy(dy * 0.8), drag: (_dx, dy) => scrollBy(-dy) });
    g.save();
    g.beginPath();
    g.rect(0, CONTENT_Y, W, viewH);
    g.clip();
    let y = CONTENT_Y + 12 - this.snsScroll;
    for (const c of cards) {
      if (y + c.h >= CONTENT_Y && y <= H) this.drawCard(g, c.p, x0, y, CW, c.ih, c.h, scrollBy);
      y += c.h + GAP;
    }
    g.restore();
    if (maxScroll > 0) {
      const th = Math.max(60, viewH * (viewH / (viewH + maxScroll)));
      const ty = CONTENT_Y + (viewH - th) * (this.snsScroll / maxScroll);
      fillRR(g, W - 12, ty + 4, 6, th - 8, 3, 'rgba(255,255,255,0.28)');
    }
  }

  /** タイムラインの 1 件（投稿者名・投稿日時・ルーム ID・画像） */
  private drawCard(g: G, p: PostMeta & { thumb: Blob }, x: number, y: number, w: number, ih: number, h: number, scrollBy: (dy: number) => void): void {
    const id = `post:${p.id}`;
    const hot = this.hovered(id);
    fillRR(g, x, y, w, h, 20, hot ? '#1f2630' : COLOR.panel);
    if (hot) { g.save(); rr(g, x, y, w, h, 20); g.strokeStyle = 'rgba(242,193,78,0.6)'; g.lineWidth = 3; g.stroke(); g.restore(); }
    const as = 56;
    this.avatar(g, p.author, x + 20, y + 18, as);
    const room = p.roomId !== null ? `ROOM ${p.roomId}` : 'ROOM —';
    const rw = measure(g, room, 24, 700, true) + 36;
    text(g, p.author.name, x + 20 + as + 16, y + 34, { size: 28, weight: 700, max: w - as - rw - 80 });
    text(g, formatTaken(p.postedAt), x + 20 + as + 16, y + 64, { size: 22, color: COLOR.dim });
    fillRR(g, x + w - 20 - rw, y + 24, rw, 44, 22, 'rgba(242,193,78,0.14)');
    text(g, room, x + w - 20 - rw / 2, y + 47, { size: 24, weight: 700, mono: true, align: 'center', color: COLOR.accent });
    const iy = y + 92;
    g.save();
    rr(g, x + 16, iy, w - 32, ih, 14);
    g.fillStyle = '#07090c';
    g.fill();
    const b = this.postImageOf(p);
    if (b) { g.clip(); this.cover(g, b, x + 16, iy, w - 32, ih); }
    else text(g, this.postImageNote(p.id), x + w / 2, iy + ih / 2, { size: 24, align: 'center', color: COLOR.faint });
    g.restore();
    const top = Math.max(y, CONTENT_Y);
    this.add({ id, x, y: top, w, h: Math.max(0, y + h - top), click: () => this.openPost(p), wheel: (dy) => scrollBy(dy * 0.8), drag: (_dx, dy) => scrollBy(-dy) });
  }

  private openPost(p: PostMeta & { thumb: Blob }): void {
    this.post = p;
    this.snsStatus = { kind: 'idle' };
    this.postDeleteArmAt = -1e9;
    this.hooks.sound('open');
    this.invalidate();
  }

  private closePost(): void {
    this.post = null;
    this.snsStatus = { kind: 'idle' };
    this.invalidate();
  }

  /** 投稿を大きく見る: 下に「探索」（撮った部屋へワープ）・「キャンセル」・「削除」 */
  private drawPost(g: G, p: PostMeta & { thumb: Blob }): void {
    this.header(g, '投稿', '', '‹ タイムライン');
    const x = 24, y = CONTENT_Y, w = W - 48, h = 430;
    fillRR(g, x, y, w, h, 18, '#07090c');
    const img = this.postImageOf(p);
    if (img) {
      const k = Math.min(w / img.width, h / img.height);
      const iw = img.width * k, ih = img.height * k;
      g.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
    } else text(g, this.postImageNote(p.id), W / 2, y + h / 2, { size: 28, align: 'center', color: COLOR.dim });
    const iy = y + h + 16;
    this.avatar(g, p.author, 32, iy, 50);
    text(g, p.author.name, 96, iy + 15, { size: 26, weight: 700, max: 520 });
    text(g, `${formatTaken(p.postedAt)} 投稿 ・ 撮影 ${formatTaken(p.takenAt)} ・ ${p.place}`, 96, iy + 41, { size: 22, color: COLOR.dim, max: 680 });
    text(g, p.roomId !== null ? `ROOM ${p.roomId}` : 'ROOM —', W - 32, iy + 26, { size: 32, weight: 700, mono: true, align: 'right', color: COLOR.accent });
    // 探索できない理由（番号が無い・別の世界・番号の無い遊び方）か、移る用意の状態
    const reason = p.roomId === null ? 'この写真には部屋の番号がありません' : p.seed !== this.hooks.seed ? `別の世界（seed ${p.seed}）の写真なので、ここからは行けません` : !this.hooks.roomsAvailable() ? 'この場所からは探索できません' : '';
    const sy = iy + 84;
    if (this.snsStatus.kind !== 'idle') this.drawTravelStatus(g, this.snsStatus, sy);
    else if (reason) text(g, reason, W / 2, sy, { size: 24, align: 'center', color: COLOR.dim, max: W - 60 });
    const busy = this.snsStatus.kind === 'checking';
    const by = H - 22 - 72, bh = 72;
    const armed = this.now - this.postDeleteArmAt < 3000;
    if (armed) this.animate(3050);
    this.button(g, 'post:delete', armed ? 'もう一度押すと削除' : '削除', 24, by, armed ? 300 : 170, bh, { danger: armed, size: 26, disabled: busy }, () => {
      if (!armed) { this.postDeleteArmAt = this.now; this.hooks.sound('tap'); this.invalidate(); return; }
      this.postDeleteArmAt = -1e9;
      const id = p.id;
      this.closePost();
      const b = this.postImages.get(id);
      if (b instanceof ImageBitmap) b.close();
      this.postImages.delete(id);
      this.hooks.sound('back');
      void this.hooks.posts.remove(id).then(() => this.showToast('投稿を削除しました'));
    });
    this.button(g, 'post:cancel', 'キャンセル', W - 24 - 300 - 16 - 240, by, 240, bh, { size: 30, disabled: busy }, () => { this.hooks.sound('back'); this.closePost(); });
    this.button(g, 'post:go', '探索', W - 24 - 300, by, 300, bh, { accent: true, size: 34, disabled: busy || !!reason }, () => this.travel('sns', p.roomId!, () => { this.post = null; }));
  }

  // ---------------------------------------------------------------- ギャラリー
  private async loadPhotos(): Promise<void> {
    try {
      this.photos = await this.hooks.photos.list();
    } catch (e) {
      console.warn('[写真] 読めません', e);
      this.photos = [];
    }
    if (this.detail && !this.photos.some((p) => p.id === this.detail!.id)) { this.detail = null; this.detailImage = null; }
    this.invalidate();
  }

  private thumbOf(p: PhotoMeta & { thumb: Blob }): ImageBitmap | null {
    const t = this.thumbs.get(p.id);
    if (t === undefined) {
      this.thumbs.set(p.id, 'loading');
      createImageBitmap(p.thumb).then((b) => { this.thumbs.set(p.id, b); this.invalidate(); }, () => this.thumbs.set(p.id, 'failed'));
      return null;
    }
    return t instanceof ImageBitmap ? t : null;
  }

  private drawGallery(g: G): void {
    if (this.detail) { this.drawPhoto(g, this.detail); return; }
    const list = this.photos;
    this.header(g, 'ギャラリー', list ? `${list.length} 枚` : '');
    if (!list) { text(g, '読み込み中…', W / 2, 420, { size: 30, align: 'center', color: COLOR.dim }); return; }
    if (!list.length) {
      text(g, 'まだ写真がありません', W / 2, 400, { size: 36, weight: 700, align: 'center' });
      text(g, '「カメラ」で撮った写真がここに並びます', W / 2, 456, { size: 28, align: 'center', color: COLOR.dim });
      return;
    }
    const PX = 28, GX = 20, cw = (W - 2 * PX - 2 * GX) / 3, ih = Math.round(cw * 9 / 16), rowH = ih + 92;
    const rows = Math.ceil(list.length / 3), viewH = H - CONTENT_Y;
    const maxScroll = Math.max(0, rows * rowH + 24 - viewH);
    this.scroll = Math.max(0, Math.min(maxScroll, this.scroll));
    const scrollBy = (dy: number): void => { this.scroll = Math.max(0, Math.min(maxScroll, this.scroll + dy)); this.invalidate(); };
    this.add({ id: 'grid', x: 0, y: CONTENT_Y, w: W, h: viewH, wheel: (dy) => scrollBy(dy * 0.8), drag: (_dx, dy) => scrollBy(-dy) });
    g.save();
    g.beginPath();
    g.rect(0, CONTENT_Y, W, viewH);
    g.clip();
    list.forEach((p, i) => {
      const x = PX + (i % 3) * (cw + GX), y = CONTENT_Y + 12 + Math.floor(i / 3) * rowH - this.scroll;
      if (y + rowH < CONTENT_Y || y > H) return;
      const id = `photo:${p.id}`;
      const hot = this.hovered(id);
      g.save();
      rr(g, x, y, cw, ih, 14);
      g.fillStyle = '#1b2028';
      g.fill();
      const b = this.thumbOf(p);
      if (b) { g.clip(); this.cover(g, b, x, y, cw, ih); }
      g.restore();
      if (hot) { g.save(); rr(g, x, y, cw, ih, 14); g.strokeStyle = COLOR.accent; g.lineWidth = 5; g.stroke(); g.restore(); }
      text(g, p.roomId !== null ? `ROOM ${p.roomId}` : p.place || '—', x + 4, y + ih + 30, { size: 26, weight: 700, mono: true, color: hot ? COLOR.accent : COLOR.text, max: cw - 8 });
      text(g, `${formatTaken(p.takenAt)}  ${p.place}`, x + 4, y + ih + 66, { size: 22, color: COLOR.dim, max: cw - 8 });
      this.add({ id, x, y: Math.max(y, CONTENT_Y), w: cw, h: Math.min(rowH - 8, y + rowH - Math.max(y, CONTENT_Y)), click: () => this.openPhoto(p), wheel: (dy) => scrollBy(dy * 0.8), drag: (_dx, dy) => scrollBy(-dy) });
    });
    g.restore();
    if (maxScroll > 0) {
      const th = Math.max(60, viewH * (viewH / (viewH + maxScroll)));
      const ty = CONTENT_Y + (viewH - th) * (this.scroll / maxScroll);
      fillRR(g, W - 12, ty + 4, 6, th - 8, 3, 'rgba(255,255,255,0.28)');
    }
  }

  private openPhoto(p: PhotoMeta & { thumb: Blob }): void {
    this.detail = p;
    this.detailImage = 'loading';
    this.deleteArmAt = -1e9;
    this.hooks.sound('open');
    this.invalidate();
    void this.hooks.photos.image(p.id).then(async (blob) => {
      if (this.detail?.id !== p.id) return;
      try { this.detailImage = blob ? await createImageBitmap(blob) : null; } catch { this.detailImage = null; }
      this.invalidate();
    });
  }

  private drawPhoto(g: G, p: PhotoMeta & { thumb: Blob }): void {
    this.header(g, p.roomId !== null ? `ROOM ${p.roomId}` : p.place || '写真', '', '‹ 一覧');
    const x = 24, y = CONTENT_Y, w = W - 48, h = 470;
    fillRR(g, x, y, w, h, 18, '#07090c');
    const img = this.detailImage instanceof ImageBitmap ? this.detailImage : this.thumbOf(p);
    if (img) {
      const k = Math.min(w / img.width, h / img.height);
      const iw = img.width * k, ih = img.height * k;
      g.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
    } else text(g, '読み込み中…', W / 2, y + h / 2, { size: 28, align: 'center', color: COLOR.dim });
    const info = `${formatTaken(p.takenAt, true)} ・ ${p.place}${p.seed !== this.hooks.seed ? ` ・ seed ${p.seed}` : ''}${p.look === 'video' ? ' ・ ビデオ調' : ''}`;
    text(g, info, 32, y + h + 40, { size: 26, color: COLOR.dim, max: W - 64 });
    const armed = this.now - this.deleteArmAt < 3000;
    if (armed) this.animate(3050);
    const by = y + h + 76, bh = 72;
    const canGo = p.roomId !== null && p.seed === this.hooks.seed && this.hooks.roomsAvailable();
    // 右から: 投稿（1 回だけ）・この部屋へ・削除
    const posted = this.postedIds.has(p.id);
    const postX = W - 24 - 260, goX = postX - 16 - 260, delX = (canGo ? goX : postX) - 16 - 300;
    this.button(g, 'photo:post', this.posting ? '投稿中…' : posted ? '投稿済み' : '投稿', postX, by, 260, bh, { accent: !posted, disabled: posted || this.posting, size: 30 }, () => this.postPhoto(p));
    this.button(g, 'photo:delete', armed ? 'もう一度押すと削除' : '削除', delX, by, 300, bh, { danger: armed, size: 28 }, () => {
      if (!armed) { this.deleteArmAt = this.now; this.hooks.sound('tap'); this.invalidate(); return; }
      this.deleteArmAt = -1e9;
      const id = p.id;
      this.detail = null;
      this.detailImage = null;
      this.thumbs.delete(id);
      this.hooks.sound('back');
      void this.hooks.photos.remove(id).then(() => this.showToast('削除しました'));
      this.invalidate();
    });
    if (canGo) this.button(g, 'photo:go', 'この部屋へ', goX, by, 260, bh, { size: 30 }, () => {
      this.dial.set(p.roomId!);
      this.dialTouched = true;
      this.explore = { kind: 'idle' };
      this.detail = null;
      this.detailImage = null;
      this.hooks.sound('open');
      this.setApp('explore');
    });
  }

  /** 写真を SNS に投稿する（写真の写しを持つ。同じ写真は 1 回だけ） */
  private postPhoto(p: PhotoMeta & { thumb: Blob }): void {
    if (this.posting || this.postedIds.has(p.id)) return;
    this.posting = true;
    this.hooks.sound('tap');
    this.invalidate();
    void (async () => {
      try {
        const image = await this.hooks.photos.image(p.id);
        if (!image) throw new Error('写真がありません');
        await this.hooks.posts.add({ postedAt: Date.now(), author: this.hooks.author(), photoId: p.id, roomId: p.roomId, seed: p.seed, place: p.place, takenAt: p.takenAt, w: p.w, h: p.h, look: p.look }, image, p.thumb);
        this.postedIds.add(p.id);
        this.showToast('SNS に投稿しました');
      } catch (e) {
        console.warn('[SNS] 投稿できません', e);
        this.hooks.sound('error');
        this.showToast('投稿できませんでした', 2200, true);
      }
      this.posting = false;
      this.invalidate();
    })();
  }

  /** 画像を枠いっぱいに（はみ出しは切る） */
  private cover(g: G, img: ImageBitmap, x: number, y: number, w: number, h: number): void {
    const k = Math.max(w / img.width, h / img.height);
    const iw = img.width * k, ih = img.height * k;
    g.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  }

  // ---------------------------------------------------------------- 指
  private hitTest(x: number, y: number): Target | null {
    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i]!;
      if (x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) return t;
    }
    return null;
  }

  /** (x, y) の指を画面が受け取るか（カメラのときは押せる物の上だけ。ほかは画面のどこでも） */
  captures(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x > W || y > H) return false;
    return this.app !== 'camera' || this.hitTest(x, y) !== null;
  }

  move(x: number, y: number): void {
    this.pointer = { x, y };
    const p = this.press;
    if (p) {
      const dx = x - p.lx, dy = y - p.ly;
      p.lx = x;
      p.ly = y;
      const before = p.moved;
      p.moved += Math.abs(dx) + Math.abs(dy);
      if (p.target?.drag && p.moved > 10) p.target.drag(before > 10 ? dx : dx * 0.5, before > 10 ? dy : dy * 0.5);
    }
    const h = this.hitTest(x, y)?.id ?? null;
    if (h !== this.hoverId) { this.hoverId = h; this.invalidate(); }
  }

  down(x: number, y: number): void {
    this.move(x, y);
    this.press = { target: this.hitTest(x, y), lx: x, ly: y, moved: 0 };
    this.invalidate();
  }

  up(x: number, y: number): void {
    const p = this.press;
    this.press = null;
    this.invalidate();
    if (!p?.target?.click || p.moved > 12) return;
    const t = p.target;
    if (x >= t.x - 8 && x <= t.x + t.w + 8 && y >= t.y - 8 && y <= t.y + t.h + 8) t.click!(x, y);
  }

  /** 指を離した（画面の外へ出た・しまった） */
  cancel(): void {
    this.press = null;
    this.pointer = null;
    if (this.hoverId !== null) { this.hoverId = null; this.invalidate(); }
  }

  /** ホイール（指の下の物。カメラはズーム） */
  wheel(dy: number): void {
    if (this.app === 'camera') {
      this.zoom = Math.max(1, Math.min(4, this.zoom * Math.pow(1.1, -dy / 100)));
      this.invalidate();
      return;
    }
    const t = this.pointer ? this.hitTest(this.pointer.x, this.pointer.y) : null;
    t?.wheel?.(dy);
  }
}
