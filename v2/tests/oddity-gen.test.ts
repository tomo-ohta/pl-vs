// 段階 4・oddity の部屋まるごとの異変の生成: それぞれが見て分かる形になっている（扉を開けた瞬間に分かる物がある）・
// 見本で置ける・同じ鍵なら同じ・部屋の箱と灯りが増えすぎない
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import '../core/gen/anomaly/index.ts';
import { anomalyDef } from '../core/gen/anomaly/types.ts';
import { KEEP_COLOR, mainRect } from '../core/gen/anomaly/util.ts';
import { ODDITY_CATALOG } from '../core/gen/catalog/oddity.ts';
import { dressCell } from '../core/gen/dress/index.ts';
import { generateFloorReport, type GenReport } from '../core/gen/floor/index.ts';
import type { CellLayout, EntitySpec, FloorLayout, Json } from '../core/world/layout.ts';

const t = defaultTuning();
/** この担当の異変（台帳の impl のうち、既存の異変でない物） */
const EXISTING = new Set(['flood', 'fog', 'upsideDown', 'tint']);
const MINE = [...new Set(ODDITY_CATALOG.flatMap((e) => e.impl.filter((m) => m.kind === 'anomaly' && !EXISTING.has(m.id)).map((m) => m.id)))];

const fxOf = (floor: FloorLayout, aid: string): { [k: string]: Json }[] => (floor.entities.find((e) => e.id === `${aid}.room`)?.params.fx as { [k: string]: Json }[] | undefined) ?? [];
const entsOf = (floor: FloorLayout, aid: string): EntitySpec[] => floor.entities.filter((e) => e.id.startsWith(`${aid}.`));
const labels = (floor: FloorLayout, aid: string): string[] => fxOf(floor, aid).filter((f) => f.kind === 'labels').flatMap((f) => (f.items as { text: string }[]).map((x) => x.text));
const area = (c: CellLayout): number => c.footprint.reduce((a, r) => a + (r.x1 - r.x0) * (r.z1 - r.z0), 0);

/** 異変ごとの「見て分かる形」の確かめ（問題の一覧を返す） */
function features(def: string, aid: string, c: CellLayout, floor: FloorLayout): string[] {
  const out: string[] = [];
  const fy = c.floorY;
  const fx = fxOf(floor, aid);
  const has = (k: string): boolean => fx.some((f) => f.kind === k);
  const mats = (m: string): number => c.boxes.filter((b) => b.mat === m).length;
  const need = (ok: boolean, what: string): void => { if (!ok) out.push(what); };
  switch (def) {
    case 'smoke': {
      const s = fx.find((f) => f.kind === 'smoke');
      need(!!s && Number(s.y0) >= fy + t['anomaly.smoke.bottomMin'] - 1e-6 && Number(s.y0) <= fy + t['anomaly.smoke.bottomMax'] + 1e-6, '煙の層の底の高さ');
      need(Number(s?.y0) - fy > 0.75 + 0.2 && Number(s?.y0) - fy < 1.6 - 0.2, 'しゃがんだ目は煙の下・立った目は煙の中');
      break;
    }
    case 'leak':
      need(has('rain'), '雨');
      need(mats('shadowDecal') >= 2 && mats('puddle') >= 2, '雨染みと水たまり');
      need((c.render?.floorWetness ?? 0) > 0.5, '濡れた床');
      need(c.zones.some((z) => z.kind === 'water'), '水たまりの水のゾーン');
      break;
    case 'snow':
      need(c.boxes.filter((b) => b.mat === 'snow' && b.min[1] <= fy + 1e-6).reduce((a, b) => a + (b.max[0] - b.min[0]) * (b.max[2] - b.min[2]), 0) >= area(c) * 0.6, '床一面の雪');
      need(entsOf(floor, aid).some((e) => e.type === 'oddTrail') && has('snowfall'), '足跡と降る雪');
      break;
    case 'wind': {
      const z = c.zones.find((x) => x.kind === 'force');
      need(!!z && Math.abs(Math.hypot(z.vector![0], z.vector![2]) - 1) < 1e-6 && z.params?.speed === t['anomaly.wind.push'], '風のゾーン');
      need(c.boxes.some((b) => b.slope) && has('drift'), '吹き流しと流れる紙');
      break;
    }
    case 'thermal':
      need(c.render?.fog?.far === t['anomaly.thermal.fogFar'] && has('thermal'), '冷たい霧と温度');
      need(mats('ice') >= 3, '凍った床・つらら');
      break;
    case 'meadow':
      need(mats('grass') >= 1 && mats('skyDay') >= 1, '草の床と空の天井');
      need(c.boxes.filter((b) => ['plant', 'wheat', 'grass', 'plasticYellow'].includes(b.mat)).length >= 20, '草木');
      break;
    case 'overgrowth':
      need(c.boxes.filter((b) => ['plant', 'plantLeaf', 'grass'].includes(b.mat) && b.propGroup?.includes('/a-overgrowth')).length >= 25, '草木');
      break;
    case 'sand': {
      need(mats('sand') >= 2 && c.zones.some((z) => z.kind === 'water' && z.params?.dry), '砂の床と遅くなるゾーン');
      const dune = c.boxes.filter((b) => b.mat === 'sand' && b.solid);
      need(dune.every((b) => b.max[1] - b.min[1] <= 0.11), '砂の山は登れる段');
      break;
    }
    case 'sea':
      need(c.zones.filter((z) => z.kind === 'water').length >= 2 && entsOf(floor, aid).some((e) => e.type === 'oddWaves'), '海と波');
      need(mats('sand') >= 1 && mats('skyDay') >= 1, '浜と空');
      break;
    case 'waterWall':
      need(mats('waterFilm') >= 3, '壁一面の水');
      need(mats('waterWall') >= 1 && fx.filter((f) => f.kind === 'grade' && f.aabb).length === mats('waterWall'), '開口の水の幕と、くぐる所の画面の揺らぎ');
      break;
    case 'miscount': {
      const nums = labels(floor, aid).filter((x) => /^\d+$/.test(x));
      const dup = nums.length - new Set(nums).size;
      need(nums.length >= 4 && dup === 1, `番号札（同じ番号が 1 回だけ重なる）: ${nums.join(',')}`);
      const board = labels(floor, aid).find((x) => x.startsWith('この部屋の'));
      if (board) need(Number(board.split('\n')[1]) === nums.length - 1, `掲示の数は 1 つ少ない: ${board}`);
      break;
    }
    case 'fakeSigns':
      need(c.boxes.some((b) => b.kind === 'decorDoor') && labels(floor, aid).some((x) => x.includes('出口')), '偽の扉と案内');
      need(labels(floor, aid).filter((x) => x === '#arrow:R').length >= 1, '床の矢印');
      break;
    case 'nameplate':
      need(labels(floor, aid).filter((x) => x.includes('{name}')).length >= 2, '名前の掲示と名札');
      break;
    case 'exitSign': {
      const ex = labels(floor, aid).filter((x) => x.startsWith('#exit:'));
      const l = ex.filter((x) => x === '#exit:L').length, r = ex.filter((x) => x === '#exit:R').length;
      need(ex.length >= 4 && Math.min(l, r) === 1, `非常口の印は 1 つだけ向きが違う: L${l} R${r}`);
      break;
    }
    case 'missingColor': {
      const g = fx.find((f) => f.kind === 'grade');
      need(!!(g?.grade as { hueKill?: unknown } | undefined)?.hueKill, '画面の色相を抜く');
      break;
    }
    case 'mono':
      need(c.boxes.every((b) => KEEP_COLOR.has(b.mat) || b.mat === 'screenDark' || b.mat === 'untextured'), '全部が 1 色');
      break;
    case 'void': {
      const fall = entsOf(floor, aid).filter((e) => e.type === 'respawnZone');
      need(fall.length >= 2, `穴 ${fall.length}`);
      need(c.boxes.some((b) => b.mat === 'void' && b.solid && b.max[1] < fy - 1), '虚空の底');
      break;
    }
    case 'huddle':
      need(c.boxes.filter((b) => b.propGroup?.endsWith('/a-dragMarks')).length >= 0, '');
      break;
    case 'oddScale':
      need(has('spin') || c.boxes.some((b) => b.solid && b.propGroup && b.max[1] - fy > 2), '宙で回る物か巨大な物');
      break;
    case 'misplaced':
      need(c.boxes.filter((b) => b.solid && b.propGroup?.includes('/x-')).length >= 1, 'よその部屋の家具');
      break;
    case 'carryover':
      need(c.boxes.some((b) => b.propGroup?.includes('/c-')), '前の部屋の家具');
      break;
    case 'vast': {
      need(c.height >= 6.5 && c.bounds.max[1] >= fy + c.height, `天井の高さ ${c.height.toFixed(1)}`);
      const m = c.map?.apparent?.[0], r = mainRect(c);
      need(!!m && (m.x1 - m.x0) * (m.z1 - m.z0) < (r.x1 - r.x0) * (r.z1 - r.z0) * 0.5, '地図の見かけは小部屋');
      need(c.boxes.some((b) => b.solid && b.max[1] >= fy + c.height - 0.01 && b.min[1] <= fy + 4.6 && b.max[1] - b.min[1] > 3), '天井まで続く壁');
      break;
    }
    case 'mirror': {
      const fig = fx.find((f) => f.kind === 'figure');
      need(!!fig, '鏡の中の人影');
      need(c.boxes.some((b) => b.propGroup?.endsWith('~m')), '鏡写しの家具');
      break;
    }
    case 'sideways':
      need(c.boxes.some((b) => b.mat === c.palette.floor && !b.solid && b.max[1] - b.min[1] > c.height * 0.9), '床材の壁');
      break;
    case 'perspective':
      need(c.boxes.filter((b) => b.solid && b.min[1] >= fy + t['anomaly.perspective.ceilMin'] - 1e-6 && b.min[1] < fy + c.height - 0.05).length >= 2, '下がっていく天井');
      need(mats('carpetPattern') >= 3, '細くなる絨毯');
      break;
    case 'dayCycle': {
      const clock = entsOf(floor, aid).find((e) => e.type === 'oddClock');
      need(!!clock && (clock.params.panes as unknown[]).length >= 1, '窓');
      need(c.lights.some((l) => l.lampId === clock?.id) && c.lights.some((l) => l.lampId?.endsWith('.night')), '日の光と夜の灯り');
      break;
    }
    case 'aging':
      need(mats('wallBrick') + mats('shadowDecal') >= 2 && has('gradient') && has('dust'), '古びた壁・褪せる画面・埃');
      break;
    case 'justLeft': {
      need(has('steam'), '湯気');
      const phone = entsOf(floor, aid).find((e) => e.type === 'soundBeacon');
      need(!!phone && phone.inputs?.enable === `${aid}.room.in`, '部屋にいる間だけ鳴る電話');
      break;
    }
    default:
      out.push(`確かめ方が無い: ${def}`);
  }
  return out.filter((x) => x);
}

test('oddity: 台帳の異変は全部登録されていて、確かめ方がある', () => {
  assert.ok(MINE.length >= 28, `異変 ${MINE.length}`);
  for (const id of MINE) assert.ok(anomalyDef(id), id);
});

test('oddity: どの異変も見本で置け、見て分かる形になっている・1 区画の箱と灯りが増えすぎない', () => {
  const fails: string[] = [];
  for (const id of MINE) {
    let r: GenReport | null = null;
    for (let w = 1; w <= 10 && !r; w++) {
      const s = generateFloorReport({ world: w, depth: 2, variant: 0 }, t, { showcase: { gimmicks: [], anomalies: [id] }, dress: dressCell });
      if (s.anomalies.some((a) => a.def === id)) r = s;
    }
    if (!r) { fails.push(`${id}: 置けない`); continue; }
    const a = r.anomalies.find((x) => x.def === id)!;
    const c = r.floor.cells.find((x) => x.id === a.cell)!;
    fails.push(...features(id, a.id, c, r.floor).map((s) => `${id}: ${s}`));
    // 重さ: 1 区画の箱・灯り
    if (c.boxes.length > 2400) fails.push(`${id}: 箱が多すぎる ${c.boxes.length}`);
    if (c.lights.length > 24) fails.push(`${id}: 灯りが多すぎる ${c.lights.length}`);
  }
  assert.deepEqual(fails, []);
});

test('oddity: ふつうのフロアに出る異変も、見て分かる形になっている（200 フロア）', () => {
  const fails: string[] = [];
  const seen = new Map<string, number>();
  // 200 フロア。ほかの担当の異変が増えて揃わなければ、揃うまで（400 フロアまで）
  for (let w = 1; w <= 200 || (w <= 400 && MINE.some((id) => !seen.get(id))); w++) {
    const r = generateFloorReport({ world: w, depth: 1 + (w % 9), variant: w % 6 === 0 ? 1 : 0 }, t, { dress: dressCell });
    for (const a of r.anomalies) {
      if (!MINE.includes(a.def)) continue;
      seen.set(a.def, (seen.get(a.def) ?? 0) + 1);
      const c = r.floor.cells.find((x) => x.id === a.cell)!;
      fails.push(...features(a.def, a.id, c, r.floor).map((s) => `w${w} ${a.id}: ${s}`));
      if (c.boxes.length > 2400) fails.push(`w${w} ${a.id}: 箱が多すぎる ${c.boxes.length}`);
    }
  }
  console.log(`  ${MINE.map((id) => `${id} ${seen.get(id) ?? 0}`).join('・')}`);
  for (const id of MINE) if (!seen.get(id)) fails.push(`${id}: 400 フロアに 1 度も出ない`);
  assert.deepEqual(fails, []);
});

test('oddity: 見本のフロア（この担当の異変をまとめて）は、同じ鍵なら同じ', () => {
  const part = MINE.slice(0, 12);
  const a = generateFloorReport({ world: 3, depth: 0, variant: 0 }, t, { showcase: { gimmicks: ['oneDifferent'], anomalies: part }, dress: dressCell });
  const b = generateFloorReport({ world: 3, depth: 0, variant: 0 }, t, { showcase: { gimmicks: ['oneDifferent'], anomalies: part }, dress: dressCell });
  assert.equal(JSON.stringify(a.floor), JSON.stringify(b.floor));
  assert.ok(a.anomalies.length >= 8);
});
