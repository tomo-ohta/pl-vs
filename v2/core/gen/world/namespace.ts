/**
 * 区域の id の付け替え（docs/endless-world.md 4.1）: 区域の中で一意な id（区画・portal・部品・出口・見え隠れの組）を、
 * 階の中で一意な `<元の id>#<区域 id>` にする（`~` は warp の双子の区画の id が使っている）。区域を作るときは今のまま id を作り、Sim と描画に入れる前にこれを通す。
 *
 * 付け替える所: 区画（id・箱の lamp:・家具の組の頭・見え隠れの組・照明の lamp・別の空間）・portal（id・区画・扉）・
 * 部品（id・区画・配線・params の中の文字列）・出口・面・出てくる区画・区域の情報。
 * params の中は、文字列がちょうど id か、`<部品 id>.<出力>`（配線）・`<区画 id>/…`（家具の組）・`lamp:<部品 id>` の形なら付け替える。
 * 後ろに付けるので、`g:` などの頭で種類を見ている所はそのまま動く。
 */
import type { FloorLayout, Json } from '../../world/layout.ts';

export const REGION_SEP = '#';
export const nsId = (id: string, rid: string): string => `${id}${REGION_SEP}${rid}`;

/** 付け替えた id の区域の id（付け替えていなければ null） */
export function regionOfId(id: string): string | null {
  const i = id.lastIndexOf(REGION_SEP);
  return i >= 0 ? id.slice(i + 1) : null;
}

/** 付け替えた id の元の id */
export function localId(id: string): string {
  const i = id.lastIndexOf(REGION_SEP);
  return i >= 0 ? id.slice(0, i) : id;
}

/** 区域の layout の写しを作り、id を付け替える */
export function namespaceLayout(src: FloorLayout, rid: string): FloorLayout {
  const L = JSON.parse(JSON.stringify(src)) as FloorLayout;
  const cellIds = new Set(L.cells.map((c) => c.id));
  const entIds = new Set(L.entities.map((e) => e.id));
  const groups = new Set<string>();
  for (const c of L.cells) for (const b of c.boxes) { if (b.revealGroup) groups.add(b.revealGroup); if (b.concealGroup) groups.add(b.concealGroup); }
  const known = new Set<string>([...cellIds, ...entIds, ...L.portals.map((p) => p.id), ...groups, ...L.exits.map((x) => x.id), ...L.surfaces.map((s) => s.id)]);
  const ren = (s: string): string => (known.has(s) ? nsId(s, rid) : s);
  const renStr = (s: string): string => {
    if (known.has(s)) return nsId(s, rid);
    if (s.startsWith('lamp:') && entIds.has(s.slice(5))) return `lamp:${nsId(s.slice(5), rid)}`;
    const slash = s.indexOf('/');
    if (slash > 0 && cellIds.has(s.slice(0, slash))) return nsId(s.slice(0, slash), rid) + s.slice(slash);
    const dot = s.lastIndexOf('.');
    if (dot > 0 && entIds.has(s.slice(0, dot))) return nsId(s.slice(0, dot), rid) + s.slice(dot);
    return s;
  };
  const walk = (v: Json): Json => {
    if (typeof v === 'string') return renStr(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') { const o: { [k: string]: Json } = {}; for (const [k, x] of Object.entries(v)) o[k] = walk(x); return o; }
    return v;
  };
  for (const c of L.cells) {
    c.id = ren(c.id);
    if (c.pocket) c.pocket = renStr(c.pocket);
    for (const b of c.boxes) {
      if (b.kind) b.kind = renStr(b.kind);
      if (b.propGroup) b.propGroup = renStr(b.propGroup);
      if (b.revealGroup) b.revealGroup = ren(b.revealGroup);
      if (b.concealGroup) b.concealGroup = ren(b.concealGroup);
    }
    for (const l of c.lights) if (l.lampId) l.lampId = ren(l.lampId);
    for (const z of c.zones) { if (z.id) z.id = renStr(z.id); if (z.params) z.params = walk(z.params as Json) as typeof z.params; }
  }
  for (const p of L.portals) {
    p.id = ren(p.id);
    p.cells = [ren(p.cells[0]), ren(p.cells[1])];
    if (p.doorId) p.doorId = ren(p.doorId);
  }
  for (const e of L.entities) {
    e.id = ren(e.id);
    if (e.cell) e.cell = ren(e.cell);
    e.params = walk(e.params) as typeof e.params;
    if (e.inputs) {
      for (const [k, w] of Object.entries(e.inputs)) {
        const wire = w as string | { from: string | string[]; invert?: boolean };
        e.inputs[k] = typeof wire === 'string' ? renStr(wire) : { ...wire, from: Array.isArray(wire.from) ? wire.from.map(renStr) : renStr(wire.from) };
      }
    }
  }
  for (const x of L.exits) { x.id = ren(x.id); if (x.shaft?.lift) x.shaft.lift = ren(x.shaft.lift); }
  for (const s of L.surfaces) s.id = ren(s.id);
  L.spawn.cell = ren(L.spawn.cell);
  if (L.region) {
    for (const g of L.region.gates) g.cell = ren(g.cell);
    for (const a of L.region.airlocks) { a.cell = ren(a.cell); a.live = ren(a.live); a.sealed = ren(a.sealed); if (a.car) a.car = ren(a.car); }
    for (const l of L.region.landings ?? []) { l.cell = ren(l.cell); if (l.lift) l.lift = ren(l.lift); }
    const c = L.region.contents;
    if (c) {
      for (const g of c.gimmicks) g[0] = ren(g[0]);
      for (const a of c.anomalies) a[0] = ren(a[0]);
      for (const x of c.secrets) { x.host = ren(x.host); x.cells = x.cells.map(ren); }
    }
  }
  return L;
}
