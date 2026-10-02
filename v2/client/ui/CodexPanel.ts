/**
 * メニューの「図鑑」タブ（v1 ui/MenuUI.ts のフロアリストの作り直し）。見つけた仕掛け・異変・レア部屋・隠しと、歩いたフロアの記録。
 *
 * - 項目の一覧（仕掛け・異変・レア部屋）は、仕掛け・異変の定義の name とレア部屋の名前（core/gen/secrets）から。
 *   案の番号は案の台帳（core/gen/catalog）から。まだ見つけていない物は「？？？」で伏せる（数だけ分かる）
 * - 隠し: 見つけた隠しの元（仕掛けの名前と目印）と、隠しの行き先 5 種（見つけた / まだ）
 * - フロアの記録: 新しい順。調査率・完成の印・隠しの数（フロアの隠しの数は、調査が完成すると出る）
 * DOM の無い環境（Node）では pane が null になり、何も作らない。中身の組み立て（sections）は DOM なしで試験できる。
 */
import type { Codex, CodexKind, FloorRecord } from '../map/Codex.ts';

export interface CodexEntryDef {
  kind: CodexKind;
  id: string;
  name: string;
  /** 案の番号（台帳の N05 など） */
  ideas?: string[];
}

export interface CodexItem { id: string; name: string; found: boolean; ideas: string[]; first?: string; count?: number }
export interface CodexSection { kind: CodexKind; title: string; found: number; total: number; items: CodexItem[] }

const TITLES: Record<CodexKind, string> = { gimmick: '仕掛け', anomaly: '異変', rare: 'レア部屋', secret: '見つけた隠し', dest: '隠しの行き先' };

/** 図鑑の中身（見つけていない物は名前を伏せる。見つけた隠しは見つけた物だけ） */
export function codexSections(codex: Codex, defs: readonly CodexEntryDef[]): CodexSection[] {
  const out: CodexSection[] = [];
  for (const kind of ['gimmick', 'anomaly', 'rare', 'dest'] as const) {
    const list = defs.filter((d) => d.kind === kind);
    const items = list.map((d): CodexItem => {
      const f = codex.get(kind, d.id);
      const it: CodexItem = { id: d.id, name: f ? d.name : '？？？', found: !!f, ideas: f ? d.ideas ?? [] : [] };
      if (f) { it.first = f.first; it.count = f.count; }
      return it;
    });
    out.push({ kind, title: TITLES[kind], found: items.filter((i) => i.found).length, total: items.length, items });
  }
  const secrets = Object.entries(codex.snapshot.found.secret).map(([id, f]): CodexItem => ({ id, name: f.label ?? id, found: true, ideas: [], first: f.first, count: f.count }));
  out.splice(3, 0, { kind: 'secret', title: TITLES.secret, found: secrets.length, total: secrets.length, items: secrets });
  return out;
}

/** フロアの記録の 1 行 */
export function floorLine(r: FloorRecord): string {
  const pct = r.complete ? '調査 100% ✓' : `調査 ${Math.floor(r.survey * 100)}%`;
  const sec = r.secrets ? (r.complete ? ` ・ 隠し ${r.secrets.found} / ${r.secrets.total}` : r.secrets.found ? ` ・ 隠し ${r.secrets.found}` : '') : '';
  return `${r.label} ・ ${pct}${sec}${r.visits > 1 ? ` ・ ${r.visits} 回` : ''}`;
}

export class CodexPanel {
  readonly pane: HTMLElement | null;
  /** 描いた回数（試験用） */
  renders = 0;

  constructor(pane: HTMLElement | null = null) {
    this.pane = pane;
    pane?.classList.add('codex-panel');
  }

  render(codex: Codex, defs: readonly CodexEntryDef[]): void {
    this.renders++;
    const pane = this.pane;
    if (!pane) return;
    const doc = pane.ownerDocument;
    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] => {
      const e = doc.createElement(tag);
      if (cls) e.className = cls;
      if (text !== undefined) e.textContent = text;
      return e;
    };
    pane.replaceChildren();
    const sections = codexSections(codex, defs);
    // まとめ
    const known = sections.filter((s) => s.kind !== 'secret');
    const found = known.reduce((a, s) => a + s.found, 0), total = known.reduce((a, s) => a + s.total, 0);
    const sum = el('div', 'fl-summary');
    const n = el('span', 'mono');
    n.append(doc.createTextNode('記録 '), el('b', '', String(found)), doc.createTextNode(` / ${total}`));
    const bar = el('span', 'fl-bar');
    const fill = el('i', '');
    fill.style.width = `${(found / Math.max(1, total)) * 100}%`;
    bar.append(fill);
    sum.append(n, bar, el('span', 'fl-help', '見つけた物は世界をまたいで残る'));
    pane.append(sum);
    // フロアの記録
    const floors = codex.floors();
    const fsec = el('section', 'fl-sec');
    fsec.append(this.head(doc, 'フロアの記録', `${floors.filter((f) => f.complete).length} 完成 / ${floors.length}`));
    const flist = el('div', 'cx-floors');
    for (const r of floors.slice(0, 40)) {
      const row = el('div', `cx-floor${r.complete ? ' done' : ''}`);
      const bar2 = el('span', 'cx-fbar');
      const f2 = el('i', '');
      f2.style.width = `${r.survey * 100}%`;
      bar2.append(f2);
      row.append(el('span', 'cx-fline', floorLine(r)), bar2);
      flist.append(row);
    }
    if (!floors.length) flist.append(el('p', 'cx-empty', 'まだ記録がありません'));
    fsec.append(flist);
    pane.append(fsec);
    // 項目
    for (const s of sections) {
      const sec = el('section', `fl-sec cx-${s.kind}`);
      sec.append(this.head(doc, s.title, s.kind === 'secret' ? `${s.found}` : `${s.found} / ${s.total}`));
      const grid = el('div', 'cx-grid');
      for (const it of s.items) {
        const card = el('div', `cx-card ${it.found ? 'got' : 'unknown'}`);
        card.append(el('span', 'cx-name', it.name));
        if (it.ideas.length) card.append(el('span', 'cx-no mono', it.ideas.join(' ')));
        if (it.count && it.count > 1) card.append(el('span', 'cx-count mono', `×${it.count}`));
        grid.append(card);
      }
      if (!s.items.length) grid.append(el('p', 'cx-empty', s.kind === 'secret' ? 'まだ見つけていない（普通でないことをすると見つかる）' : '—'));
      sec.append(grid);
      pane.append(sec);
    }
  }

  private head(doc: Document, title: string, count: string): HTMLElement {
    const h = doc.createElement('h3');
    h.className = 'fl-h';
    const a = doc.createElement('span');
    a.className = 'fl-rar mono';
    a.textContent = title;
    const b = doc.createElement('span');
    b.className = 'fl-n mono';
    b.textContent = count;
    h.append(a, b);
    return h;
  }
}
