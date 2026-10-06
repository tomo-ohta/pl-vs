/**
 * 検証用の小さな操作パネル（右下）。v2 の画面（一時停止のメニューなど）より手前に出す。
 * P キーでスプラット ↔ v2 のメッシュを切り替える（v2 は P を使っていない）。
 */
import type { SplatPropManager } from './manager.ts';

const CSS = `
#splat-panel { position: fixed; right: 10px; bottom: 10px; z-index: 100000; width: min(320px, calc(100vw - 20px)); box-sizing: border-box; max-height: calc(100vh - 20px); overflow: auto;
  background: rgba(14, 15, 18, 0.9); color: #e9e6da; border: 1px solid rgba(233, 230, 218, 0.18); border-radius: 6px;
  font: 12px/1.5 system-ui, -apple-system, "Hiragino Sans", sans-serif; font-variant-numeric: tabular-nums; user-select: none; }
#splat-panel header { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-bottom: 1px solid rgba(233, 230, 218, 0.12); cursor: pointer; }
#splat-panel header b { flex: 1; font-weight: 600; }
#splat-panel .body { padding: 8px 10px 10px; display: grid; gap: 8px; }
#splat-panel.closed .body { display: none; }
#splat-panel .stats { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 0 10px; color: #b9b5a6; }
#splat-panel .stats span:nth-child(even) { color: #e9e6da; text-align: right; overflow-wrap: anywhere; }
#splat-panel button { font: inherit; color: #15161a; background: #d9c25a; border: 0; border-radius: 4px; padding: 6px 8px; cursor: pointer; }
#splat-panel button.ghost { background: transparent; color: #e9e6da; border: 1px solid rgba(233, 230, 218, 0.3); }
#splat-panel .row { display: grid; grid-template-columns: 104px minmax(0, 1fr) 48px; align-items: center; gap: 6px; }
#splat-panel .row select { grid-column: 2 / 4; min-width: 0; }
#splat-panel .row output { text-align: right; color: #d9c25a; }
#splat-panel input[type=range] { width: 100%; }
#splat-panel select { font: inherit; background: #23252b; color: #e9e6da; border: 1px solid rgba(233, 230, 218, 0.25); border-radius: 4px; }
#splat-panel .group { display: grid; gap: 6px; padding-top: 6px; border-top: 1px solid rgba(233, 230, 218, 0.1); }
#splat-panel .note { color: #8f8b7e; font-size: 11px; }
#splat-panel .mode { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
#splat-panel .mode button[aria-pressed=false] { background: transparent; color: #e9e6da; border: 1px solid rgba(233, 230, 218, 0.3); }
`;

export function mountPanel(mgr: SplatPropManager): void {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
  const el = document.createElement('div');
  el.id = 'splat-panel';
  el.innerHTML = `
    <header><b>スプラットの小物（検証）</b><span class="note">P で切替</span></header>
    <div class="body">
      <div class="mode">
        <button type="button" data-mode="splat">スプラット</button>
        <button type="button" data-mode="mesh">v2 のメッシュ</button>
      </div>
      <div class="stats"></div>
      <div class="group">
        <b>つや・映り込み（見る向きで変わる色）</b>
        <div class="row"><label for="sp-gloss">つやの強さ</label><input id="sp-gloss" type="range" min="0" max="4" step="0.1"><output></output></div>
        <div class="row"><label for="sp-rough">粗さの倍率</label><input id="sp-rough" type="range" min="0.2" max="1" step="0.05"><output></output></div>
        <div class="row"><label for="sp-deg">SH の段数</label><select id="sp-deg"><option value="0">0（向きで変わらない）</option><option value="1">1</option><option value="2">2</option><option value="3">3（撮影データと同じ）</option></select></div>
        <div class="mode"><button type="button" class="ghost" data-preset="v2">v2 と同じ</button><button type="button" class="ghost" data-preset="shiny">つやを強調</button></div>
        <span class="note">v2 の照明（点光源）と材質の粗さ・金属度から計算。変えると粒は作り直さず色だけ計算し直す</span>
      </div>
      <div class="group">
        <b>粒</b>
        <div class="row"><label for="sp-texel">細かい粒の大きさ</label><select id="sp-texel"><option value="0.006">0.6 cm</option><option value="0.01">1 cm</option><option value="0.015">1.5 cm</option><option value="0.025">2.5 cm</option></select></div>
        <div class="row"><label for="sp-tol">まとめる色の差</label><input id="sp-tol" type="range" min="0" max="0.08" step="0.002"><output></output></div>
        <div class="row"><label for="sp-radius">変える半径</label><input id="sp-radius" type="range" min="6" max="40" step="1"><output></output></div>
        <label class="row" style="grid-template-columns: auto 1fr"><input id="sp-foliage" type="checkbox"><span>植物の葉を、向きばらばらの葉の粒にする</span></label>
        <button type="button" class="ghost" data-rebuild>粒を作り直す</button>
        <span class="note">半径の中の区画だけスプラットにする（外はメッシュのまま）。粒の大きさ・まとめ方は「作り直す」で反映</span>
      </div>
    </div>`;
  document.body.append(el);
  const $ = <T extends HTMLElement>(s: string): T => el.querySelector(s) as T;
  $('header').addEventListener('click', () => el.classList.toggle('closed'));
  // パネルの上の操作をゲームへ渡さない（クリックで視点が掴まれないように）
  for (const ev of ['pointerdown', 'mousedown', 'click', 'keydown', 'wheel']) el.addEventListener(ev, (e) => e.stopPropagation());

  const s = mgr.settings;
  const range = (id: string, get: () => number, set: (v: number) => void, fmt: (v: number) => string, onDone: () => void): void => {
    const input = $<HTMLInputElement>(`#${id}`);
    const out = input.nextElementSibling as HTMLOutputElement;
    input.value = String(get());
    out.textContent = fmt(get());
    input.addEventListener('input', () => { set(Number(input.value)); out.textContent = fmt(get()); });
    input.addEventListener('change', onDone);
  };
  const reshade = (): void => { void mgr.reshadeAll(); };
  range('sp-gloss', () => s.sh.gloss, (v) => { s.sh.gloss = v; }, (v) => `×${v.toFixed(1)}`, reshade);
  range('sp-rough', () => s.sh.roughScale, (v) => { s.sh.roughScale = v; }, (v) => `×${v.toFixed(2)}`, reshade);
  range('sp-tol', () => s.face.tolerance, (v) => { s.face.tolerance = v; }, (v) => v.toFixed(3), () => {});
  range('sp-radius', () => s.radius, (v) => { s.radius = v; }, (v) => `${v} m`, () => {});
  const deg = $<HTMLSelectElement>('#sp-deg');
  deg.value = String(s.sh.degree);
  deg.addEventListener('change', () => { s.sh.degree = Number(deg.value); reshade(); });
  const texel = $<HTMLSelectElement>('#sp-texel');
  texel.value = String(s.texel);
  texel.addEventListener('change', () => { s.texel = Number(texel.value); });
  const foliage = $<HTMLInputElement>('#sp-foliage');
  foliage.checked = s.face.foliage;
  foliage.addEventListener('change', () => { s.face.foliage = foliage.checked; });
  $('[data-rebuild]').addEventListener('click', () => mgr.rebuildAll());
  const syncInputs = (): void => {
    for (const [id, v] of [['sp-gloss', s.sh.gloss], ['sp-rough', s.sh.roughScale]] as const) {
      const input = $<HTMLInputElement>(`#${id}`);
      input.value = String(v);
      input.dispatchEvent(new Event('input'));
    }
  };
  el.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.preset === 'shiny') { s.sh.gloss = 2.5; s.sh.roughScale = 0.5; }
    else { s.sh.gloss = 1; s.sh.roughScale = 1; }
    syncInputs();
    reshade();
  }));
  const modeButtons = el.querySelectorAll<HTMLButtonElement>('[data-mode]');
  modeButtons.forEach((b) => b.addEventListener('click', () => mgr.setShowSplats(b.dataset.mode === 'splat')));
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyP' || e.repeat || e.target instanceof HTMLInputElement) return;
    mgr.setShowSplats(!s.showSplats);
  });

  const stats = $('.stats');
  const render = (): void => {
    modeButtons.forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.mode === 'splat') === s.showSplats)));
    const t = mgr.totals();
    const rows: [string, string][] = [
      ['表示', s.showSplats ? 'スプラット' : 'v2 のメッシュ'],
      ['FPS', mgr.fps ? mgr.fps.toFixed(0) : '—'],
      ['描画中の粒', (mgr.sparkRenderer?.activeSplats ?? 0).toLocaleString()],
      ['小物のある区画', `${t.converted} / ${t.cells} をスプラットに`],
      ['小物', `${t.props.toLocaleString()} 個`],
      ['粒', `${t.splats.toLocaleString()} / 上限 ${s.budget.toLocaleString()}`],
      ['見る向きで色が変わる粒', t.glossy.toLocaleString()],
      ['変換中', t.converting ? t.converting.replace(/#.*/, '') : '—'],
      ['直近の変換', t.lastMs ? `${(t.lastMs / 1000).toFixed(1)} 秒` : '—'],
    ];
    if (t.failed) rows.push(['失敗', `${t.failed} 区画（console）`]);
    stats.replaceChildren(...rows.flatMap(([k, v]) => { const a = document.createElement('span'); a.textContent = k; const b = document.createElement('span'); b.textContent = v; return [a, b]; }));
  };
  mgr.onChange = render;
  render();
  setInterval(render, 500);
}
