/**
 * world.html の小さなパネル（右下）: 表示の切り替え（P）と、差し替えた区画・小物・三角形の数。
 */
import { FAR, type ProceduralProps } from './worldProps.ts';

const CSS = `
#proc-panel { position: fixed; right: 10px; bottom: 10px; z-index: 100000; width: min(300px, calc(100vw - 20px)); box-sizing: border-box;
  background: rgba(14, 15, 18, 0.9); color: #e9e6da; border: 1px solid rgba(233, 230, 218, 0.18); border-radius: 6px;
  font: 12px/1.5 system-ui, -apple-system, "Hiragino Sans", sans-serif; font-variant-numeric: tabular-nums; user-select: none; }
#proc-panel header { display: flex; gap: 8px; padding: 7px 10px; border-bottom: 1px solid rgba(233, 230, 218, 0.12); cursor: pointer; }
#proc-panel header b { flex: 1; font-weight: 600; }
#proc-panel .body { padding: 8px 10px 10px; display: grid; gap: 8px; }
#proc-panel.closed .body { display: none; }
#proc-panel .mode { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
#proc-panel button { font: inherit; color: #15161a; background: #d9c25a; border: 0; border-radius: 4px; padding: 6px 8px; cursor: pointer; }
#proc-panel button[aria-pressed=false] { background: transparent; color: #e9e6da; border: 1px solid rgba(233, 230, 218, 0.3); }
#proc-panel .stats { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 0 10px; color: #b9b5a6; }
#proc-panel .stats span:nth-child(even) { color: #e9e6da; text-align: right; overflow-wrap: anywhere; }
#proc-panel .note { color: #8f8b7e; font-size: 11px; }
`;

const LABELS: Record<string, string> = {
  plant: '植物', planter: '植え込み', books: '本・ファイル', goods: '商品', bed: '寝具', pillow: '枕', waterCooler: '給水機のボトル', plinthObj: '台座の展示物',
  vitrineObj: 'ショーケースの物', cone: 'カラーコーン', urinal: '小便器', sink: '洗面器', toilet: '便器', kitchen: '流し台', vending: '自販機の見本', lamp: '電気スタンド',
  clock: '時計', sconce: '壁の灯り', extinguisher: '消火器', paper: '掲示の紙', futon: '布団', cushion: '座布団', curtain: 'カーテン', hoop: 'リング', ballPit: 'ボールプール',
};

export function mountWorldPanel(mgr: ProceduralProps): void {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
  const el = document.createElement('div');
  el.id = 'proc-panel';
  el.innerHTML = `
    <header><b>小物を形の関数で（v2 の世界）</b><span class="note">P 切替</span></header>
    <div class="body">
      <div class="mode"><button type="button" data-mode="proc">形の関数</button><button type="button" data-mode="v2">v2 の箱</button></div>
      <div class="stats"></div>
      <span class="note">近い区画から順に作る（作り終わるまでは v2 の箱）。持てる物も形の関数の物に替わる</span>
    </div>`;
  document.body.append(el);
  el.querySelector('header')!.addEventListener('click', () => el.classList.toggle('closed'));
  for (const ev of ['pointerdown', 'mousedown', 'click', 'keydown', 'wheel']) el.addEventListener(ev, (e) => e.stopPropagation());
  const buttons = el.querySelectorAll<HTMLButtonElement>('[data-mode]');
  buttons.forEach((b) => b.addEventListener('click', () => mgr.setMode(b.dataset.mode === 'v2' ? 'v2' : 'proc')));
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyP' || e.repeat || e.target instanceof HTMLInputElement) return;
    mgr.setMode(mgr.mode === 'proc' ? 'v2' : 'proc');
  });
  const stats = el.querySelector('.stats')!;
  const render = (): void => {
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mgr.mode)));
    const t = mgr.totals();
    const kinds = [...mgr.counts].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${LABELS[k] ?? k} ${n}`).join('・');
    const rows: [string, string][] = [
      ['表示', mgr.mode === 'proc' ? '形の関数のメッシュ' : 'v2 の箱'],
      ['FPS', mgr.fps ? mgr.fps.toFixed(0) : '—'],
      ['差し替えた所', `${t.ready} / ${t.tiles} 区切り（うち細かく ${t.fine}）・${t.cells} 区画${t.building ? `・作成中 ${t.building.replace(/#[^@]*/, '')}` : ''}`],
      ['小物', `${t.items.toLocaleString()} 個`],
      ['三角形', `${t.triangles.toLocaleString()}・約 ${(t.bytes / 1048576).toFixed(0)} MB`],
      ['多い種類', kinds || '—'],
    ];
    if (mgr.dropped) rows.push(['遠くで戻した', `${mgr.dropped} 区切り（${FAR} m より遠いと v2 の箱に戻す）`]);
    if (mgr.failures) rows.push(['作れなかった', `${mgr.failures} 個（console）`]);
    stats.replaceChildren(...rows.flatMap(([k, v]) => { const a = document.createElement('span'); a.textContent = k; const b = document.createElement('span'); b.textContent = v; return [a, b]; }));
  };
  mgr.onChange = render;
  render();
  setInterval(render, 500);
}
