/**
 * 見本の部屋の操作パネル（右下）。展示物の一覧（押すとその前へ移る）・表示（スプラット / 同じ形のメッシュ / v2 の箱）・
 * つやの調整・粒と三角形の数・作る進み具合。
 * キー: P（表示を順に切り替え。Shift+P で逆へ）/ N・B（次・前の展示物）。v2 は P・N・B を使っていない
 */
import type { ShowroomController } from './main.ts';
import { MODE_NAMES, MODES, type Mode } from './modes.ts';

const CSS = `
#showroom-panel { position: fixed; right: 10px; bottom: 10px; z-index: 100000; width: min(340px, calc(100vw - 20px)); box-sizing: border-box; max-height: calc(100vh - 20px); display: flex; flex-direction: column;
  background: rgba(14, 15, 18, 0.92); color: #e9e6da; border: 1px solid rgba(233, 230, 218, 0.18); border-radius: 6px;
  font: 12px/1.5 system-ui, -apple-system, "Hiragino Sans", sans-serif; font-variant-numeric: tabular-nums; user-select: none; }
#showroom-panel header { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-bottom: 1px solid rgba(233, 230, 218, 0.12); cursor: pointer; }
#showroom-panel header b { flex: 1; font-weight: 600; }
#showroom-panel .body { padding: 8px 10px 10px; display: grid; gap: 8px; overflow: auto; min-height: 0; }
#showroom-panel.closed .body { display: none; }
#showroom-panel button { font: inherit; color: #15161a; background: #d9c25a; border: 0; border-radius: 4px; padding: 6px 8px; cursor: pointer; }
#showroom-panel button.ghost, #showroom-panel .mode button[aria-pressed=false] { background: transparent; color: #e9e6da; border: 1px solid rgba(233, 230, 218, 0.3); }
#showroom-panel .mode { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
#showroom-panel .mode.three { grid-template-columns: 1fr 1fr 1fr; }
#showroom-panel .tour { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 6px; align-items: center; }
#showroom-panel .card { display: grid; gap: 2px; padding: 6px 8px; background: rgba(233, 230, 218, 0.06); border-radius: 4px; min-height: 44px; }
#showroom-panel .card b { font-weight: 600; }
#showroom-panel .note { color: #8f8b7e; font-size: 11px; }
#showroom-panel .stats { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 0 10px; color: #b9b5a6; }
#showroom-panel .stats span:nth-child(even) { color: #e9e6da; text-align: right; overflow-wrap: anywhere; }
#showroom-panel details { border-top: 1px solid rgba(233, 230, 218, 0.1); padding-top: 6px; }
#showroom-panel summary { cursor: pointer; font-weight: 600; }
#showroom-panel .list { display: grid; gap: 1px; margin-top: 4px; max-height: 32vh; overflow: auto; }
#showroom-panel .list h4 { margin: 6px 0 2px; font-size: 11px; color: #d9c25a; font-weight: 600; }
#showroom-panel .list button { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; text-align: left; background: transparent; color: #e9e6da; padding: 3px 6px; }
#showroom-panel .list button:hover, #showroom-panel .list button[aria-current=true] { background: rgba(217, 194, 90, 0.16); }
#showroom-panel .list button span:last-child { color: #8f8b7e; }
#showroom-panel .row { display: grid; grid-template-columns: 96px minmax(0, 1fr) 44px; align-items: center; gap: 6px; }
#showroom-panel .row select { grid-column: 2 / 4; min-width: 0; }
#showroom-panel .row output { text-align: right; color: #d9c25a; }
#showroom-panel input[type=range] { width: 100%; }
#showroom-panel select { font: inherit; background: #23252b; color: #e9e6da; border: 1px solid rgba(233, 230, 218, 0.25); border-radius: 4px; }
`;

export function mountShowroomPanel(show: ShowroomController): void {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
  const el = document.createElement('div');
  el.id = 'showroom-panel';
  el.innerHTML = `
    <header><b>スプラットの見本の部屋</b><span class="note">P 表示・N/B 移動</span></header>
    <div class="body">
      <div class="mode three">
        <button type="button" data-mode="splat">スプラット</button>
        <button type="button" data-mode="mesh">メッシュ</button>
        <button type="button" data-mode="v2">v2 の箱</button>
      </div>
      <div class="tour">
        <button type="button" class="ghost" data-step="-1" aria-label="前の展示物">◀ B</button>
        <div class="card" data-card></div>
        <button type="button" class="ghost" data-step="1" aria-label="次の展示物">N ▶</button>
      </div>
      <div class="stats"></div>
      <details>
        <summary>展示物の一覧</summary>
        <div class="list"></div>
      </details>
      <details>
        <summary>つや・映り込み（見る向きで変わる色）</summary>
        <div style="display:grid;gap:6px;margin-top:6px">
          <div class="row"><label for="sr-gloss">つやの強さ</label><input id="sr-gloss" type="range" min="0" max="4" step="0.1"><output></output></div>
          <div class="row"><label for="sr-rough">粗さの倍率</label><input id="sr-rough" type="range" min="0.2" max="1" step="0.05"><output></output></div>
          <div class="row"><label for="sr-deg">SH の段数</label><select id="sr-deg"><option value="0">0（向きで変わらない）</option><option value="1">1</option><option value="2">2</option><option value="3">3（撮影データと同じ）</option></select></div>
          <div class="mode"><button type="button" class="ghost" data-preset="v2">v2 と同じ</button><button type="button" class="ghost" data-preset="shiny">つやを強調</button></div>
          <span class="note">v2 の照明と粒ごとの粗さ・金属度・クリアコートから計算。変えると形はそのまま色だけ計算し直す</span>
        </div>
      </details>
    </div>`;
  document.body.append(el);
  const $ = <T extends HTMLElement>(s: string): T => el.querySelector(s) as T;
  $('header').addEventListener('click', () => el.classList.toggle('closed'));
  if (matchMedia('(max-width: 700px)').matches) el.classList.add('closed');
  // パネルの上の操作をゲームへ渡さない（クリックで視点が掴まれないように）
  for (const ev of ['pointerdown', 'mousedown', 'click', 'keydown', 'wheel', 'touchstart']) el.addEventListener(ev, (e) => e.stopPropagation());

  // 切り替えと移動
  const modeButtons = el.querySelectorAll<HTMLButtonElement>('[data-mode]');
  modeButtons.forEach((b) => b.addEventListener('click', () => show.setMode((MODES.find((m) => m === b.dataset.mode) ?? 'splat') as Mode)));
  el.querySelectorAll<HTMLButtonElement>('[data-step]').forEach((b) => b.addEventListener('click', () => show.goTo(show.tourAt + Number(b.dataset.step))));
  addEventListener('keydown', (e) => {
    if (e.repeat || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    if (e.code === 'KeyP') show.cycle(e.shiftKey ? -1 : 1);
    else if (e.code === 'KeyN') show.goTo(show.tourAt + 1);
    else if (e.code === 'KeyB') show.goTo(show.tourAt - 1);
  });

  // 一覧（部屋ごと）
  const list = $('.list');
  const items: HTMLButtonElement[] = [];
  let room = '';
  show.exhibits.forEach((e, i) => {
    if (e.room !== room) {
      room = e.room;
      const h = document.createElement('h4');
      h.textContent = show.rooms.get(room)?.name ?? room;
      list.append(h);
    }
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<span></span><span></span>`;
    b.firstElementChild!.textContent = e.name;
    b.addEventListener('click', () => show.goTo(i));
    list.append(b);
    items.push(b);
  });

  // つや
  const p = show.params;
  const reshade = (): void => { void show.reshade(); };
  const range = (id: string, get: () => number, set: (v: number) => void, fmt: (v: number) => string): void => {
    const input = $<HTMLInputElement>(`#${id}`);
    const out = input.nextElementSibling as HTMLOutputElement;
    input.value = String(get());
    out.textContent = fmt(get());
    input.addEventListener('input', () => { set(Number(input.value)); out.textContent = fmt(get()); });
    input.addEventListener('change', reshade);
  };
  range('sr-gloss', () => p.gloss, (v) => { p.gloss = v; }, (v) => `×${v.toFixed(1)}`);
  range('sr-rough', () => p.roughScale, (v) => { p.roughScale = v; }, (v) => `×${v.toFixed(2)}`);
  const deg = $<HTMLSelectElement>('#sr-deg');
  deg.value = String(p.degree);
  deg.addEventListener('change', () => { p.degree = Number(deg.value); reshade(); });
  el.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.preset === 'shiny') { p.gloss = 2.5; p.roughScale = 0.5; } else { p.gloss = 1; p.roughScale = 1; }
    for (const [id, v] of [['sr-gloss', p.gloss], ['sr-rough', p.roughScale]] as const) {
      const input = $<HTMLInputElement>(`#${id}`);
      input.value = String(v);
      input.dispatchEvent(new Event('input'));
    }
    reshade();
  }));

  const card = $('[data-card]');
  const stats = $('.stats');
  const render = (): void => {
    modeButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === show.mode)));
    const e = show.exhibits[show.tourAt];
    if (e) {
      const n = show.splatsOf(e), t = show.trianglesOf(e);
      card.innerHTML = '<b></b><span class="note"></span><span class="note"></span><span class="note"></span>';
      card.children[0]!.textContent = `${show.tourAt + 1}/${show.exhibits.length} ${e.name}`;
      card.children[1]!.textContent = `${show.rooms.get(e.room)?.name ?? e.room}・${e.group}`;
      card.children[2]!.textContent = n ? `粒 ${n.toLocaleString()} / メッシュ 三角形 ${t.toLocaleString()}` : '作成中…';
      card.children[3]!.textContent = e.note;
    } else {
      card.innerHTML = '<b>展示物の前へ移る</b><span class="note">N / ▶ で最初の展示物へ。歩いて見て回っても良い</span>';
    }
    items.forEach((b, i) => {
      b.setAttribute('aria-current', String(i === show.tourAt));
      const n = show.splatsOf(show.exhibits[i]!);
      b.lastElementChild!.textContent = n ? `${(n / 1000).toFixed(0)}k` : '…';
    });
    let total = 0, glossy = 0, tris = 0, meshBytes = 0, texels = 0;
    const building: string[] = [];
    let ready = 0;
    for (const st of show.rooms.values()) {
      if (st.splats) { total += st.splats.batch.n; glossy += st.splats.glossy; }
      const m = st.splats?.meshes;
      if (m) { tris += m.triangles; meshBytes += m.bytes; texels += m.pages.reduce((a, p) => a + p.w * p.h, 0); }
      if (st.state === 'ready') ready++;
      if (st.state === 'building') building.push(`${st.name}（${st.step}）`);
      if (st.state === 'failed') building.push(`${st.name}: 失敗 ${st.error ?? ''}`);
    }
    // GPU に置く量（計算値）: 粒は位置・色・形 32 バイト + SH（3 段 64・2 段 32・1 段 16 バイト）+ 懐中電灯用の材質 16 バイト
    const shBytes = p.degree >= 3 ? 64 : p.degree === 2 ? 32 : p.degree === 1 ? 16 : 0;
    const mb = (b: number): string => `約 ${(b / 1048576).toFixed(0)} MB`;
    const rows: [string, string][] = [
      ['表示', MODE_NAMES[show.mode]],
      ['FPS', show.fps ? show.fps.toFixed(0) : '—'],
      ['作った部屋', `${ready} / ${show.rooms.size}`],
      ['スプラット', `粒 ${total.toLocaleString()}（つやあり ${glossy.toLocaleString()}）・${mb(total * (32 + shBytes + 16))}`],
      ['メッシュ', `三角形 ${tris.toLocaleString()}・テクスチャ ${(texels / 1e6).toFixed(1)} M 画素・${mb(meshBytes)}`],
    ];
    if (show.mode === 'splat') rows.push(['描画中の粒', (show.spark.activeSplats ?? 0).toLocaleString()]);
    if (building.length) rows.push(['作成中', building.join(' / ')]);
    stats.replaceChildren(...rows.flatMap(([k, v]) => { const a = document.createElement('span'); a.textContent = k; const b = document.createElement('span'); b.textContent = v; return [a, b]; }));
  };
  show.onChange = render;
  render();
  setInterval(render, 500);
}
