/**
 * トップページ（仮。docs/endless-world.md 15 章）: アドレスに始める場所の指定が無いときに出す。
 * ルーム ID を入れてその部屋から / ランダムな部屋から / はじめから（B1F の階段室の上）の 3 つ。選ぶと閉じて、選んだ物を返す
 */

export type TopChoice = { kind: 'id'; id: string } | { kind: 'begin' };

const CSS = `
.top-page { position: fixed; inset: 0; z-index: 900; display: flex; align-items: center; justify-content: center; padding: 16px;
  background: radial-gradient(ellipse at 50% 40%, #1d2028 0%, #0a0b0e 70%); color: var(--ui-fg); user-select: none; -webkit-user-select: none; touch-action: auto; }
.top-page::after { content: ''; position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 3px); }
.top-page .panel { position: relative; width: min(440px, 100%); }
.top-page h1 { margin: 0; font: 600 34px/1.1 var(--mono); letter-spacing: 0.28em; }
.top-page .sub { margin: 8px 0 28px; font-size: 13px; color: var(--ui-dim); letter-spacing: 0.08em; }
.top-page label { display: block; font: 12px var(--mono); letter-spacing: 0.16em; color: var(--ui-dim); margin-bottom: 6px; }
.top-page .row { display: flex; gap: 8px; }
.top-page input { flex: 1; min-width: 0; font: 20px var(--mono); letter-spacing: 0.12em; color: var(--ui-fg); background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.22); border-radius: 6px; padding: 10px 12px; outline: none; user-select: text; -webkit-user-select: text; }
.top-page input:focus { border-color: var(--accent); }
.top-page button { font: 14px/1 inherit; font-family: inherit; color: var(--ui-fg); background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.25);
  border-radius: 6px; padding: 12px 16px; cursor: pointer; letter-spacing: 0.06em; }
.top-page button:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.top-page button:disabled { opacity: 0.45; cursor: default; }
.top-page button.primary { background: rgba(242,193,78,0.14); border-color: rgba(242,193,78,0.6); }
.top-page .wide { width: 100%; margin-top: 12px; }
.top-page .or { margin: 22px 0 4px; font: 11px var(--mono); letter-spacing: 0.2em; color: var(--ui-dim); text-align: center; }
.top-page .status { min-height: 20px; margin-top: 10px; font-size: 13px; color: #ffcf6a; }
.top-page .foot { margin-top: 26px; font: 11px var(--mono); color: rgba(154,163,178,0.7); letter-spacing: 0.08em; }
`;

export interface TopPageOptions {
  /** 世界の seed（1 以外なら下に出す） */
  seed: number;
  /** ランダムな部屋の番号を作る（区域を作るので時間がかかる。作れなければ null） */
  randomRoom(): Promise<number | null>;
}

/** トップページを出し、選ばれるまで待つ */
export function showTopPage(o: TopPageOptions): Promise<TopChoice> {
  const st = document.createElement('style');
  st.textContent = CSS;
  document.head.append(st);
  document.title = 'Liminal v2';
  const root = document.createElement('div');
  root.className = 'top-page';
  root.innerHTML = `
    <div class="panel">
      <h1>LIMINAL</h1>
      <p class="sub">果てしない階の、どこかの部屋へ</p>
      <label for="top-room-id">ROOM ID</label>
      <div class="row">
        <input id="top-room-id" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" maxlength="16" placeholder="例: 1234">
        <button class="primary" data-act="go">この部屋へ</button>
      </div>
      <div class="or">― または ―</div>
      <button class="wide" data-act="random">ランダムな部屋へ</button>
      <button class="wide" data-act="begin">はじめから（B1F）</button>
      <div class="status" aria-live="polite"></div>
      <div class="foot"></div>
    </div>`;
  document.body.append(root);
  const input = root.querySelector<HTMLInputElement>('#top-room-id')!;
  const status = root.querySelector<HTMLElement>('.status')!;
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('button')];
  root.querySelector<HTMLElement>('.foot')!.textContent = o.seed !== 1 ? `seed ${o.seed}` : '';
  input.focus();
  return new Promise((resolve) => {
    const done = (c: TopChoice): void => { root.remove(); st.remove(); resolve(c); };
    const busy = (b: boolean): void => { for (const x of buttons) x.disabled = b; input.disabled = b; };
    const go = (): void => {
      const v = input.value.replace(/\s+/g, '');
      if (!v) { status.textContent = 'ルーム ID を入れてください'; input.focus(); return; }
      if (!/^\d+$/.test(v)) { status.textContent = 'ルーム ID は数字です'; input.focus(); return; }
      done({ kind: 'id', id: v });
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    // 開始画面の上の操作がゲームに渡らないように（キーは入力欄だけ）
    root.addEventListener('pointerdown', (e) => e.stopPropagation());
    root.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest<HTMLButtonElement>('button')?.dataset.act;
      if (act === 'go') go();
      else if (act === 'begin') done({ kind: 'begin' });
      else if (act === 'random') {
        busy(true);
        status.textContent = '接続中…';
        void o.randomRoom().then((id) => {
          if (id === null) { busy(false); status.textContent = '部屋を探せませんでした。もう一度押してください'; return; }
          done({ kind: 'id', id: String(id) });
        });
      }
    });
  });
}
