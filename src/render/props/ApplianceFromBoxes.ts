import type { Box, InstanceSpec, MatId } from '../../generators/layout';

/**
 * 生成器の箱で組まれた家電（自販機・洗濯機・乾燥機）を、コード生成の家電（ApplianceGeometry）のインスタンスに置き換える。
 * 当たり判定・焼き込みは元の箱のまま（RoomBuilder は返した箱を描かないだけ）。乱数列は使わない（位置のハッシュで色を選ぶ）。
 *
 * - propGroup + kind 'vending'（generators/furniture.ts vending）: 本体 = ソリッドの箱、正面 = 前面の薄い箔がある側
 * - kind 'vending' の単独の箱（RoomGenerator / common.ts / U04）: 正面 = 前面の薄い箱が貼られた面（無ければ部屋の中心を向く面）。前面の箱も描かない
 * - propGroup + kind 'washer' / 'dryer'（generators/furniture.ts washer。乾燥機は洗濯機の上に積む）
 */
export interface ApplianceConversion { specs: InstanceSpec[]; replaced: Box[] }

const VENDING_BODIES: MatId[] = ['plasticRed', 'plasticBlue', 'paintWhite', 'plasticRed', 'metalDark', 'plasticBlue'];

function hash(x: number, z: number): number {
  let h = (Math.round(x * 100) * 73856093) ^ (Math.round(z * 100) * 19349663);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

export function appliancesFromBoxes(boxes: Box[], center: [number, number]): ApplianceConversion {
  const specs = new Map<string, InstanceSpec>();
  const replaced: Box[] = [];
  const put = (shape: NonNullable<InstanceSpec['shape']>, body: MatId, accent: MatId | undefined, size: [number, number, number], pos: [number, number, number], yaw: number) => {
    // 自販機の缶の並び（4 組）は位置のハッシュで選ぶ（本体色とは別の桁）
    const screen = shape === 'vending' ? Math.floor(hash(pos[2] + 0.37, pos[0] - 0.61) * 4) : undefined;
    const key = `${shape}|${body}|${accent ?? ''}|${screen ?? ''}|${size.map((v) => v.toFixed(2)).join(',')}`;
    let s = specs.get(key);
    if (!s) { s = { mat: body, size, transforms: [], shape, accent, screen }; specs.set(key, s); }
    s.transforms.push({ pos, yaw });
  };
  const groups = new Map<string, Box[]>();
  for (const b of boxes) if (b.propGroup) { const l = groups.get(b.propGroup) ?? []; l.push(b); groups.set(b.propGroup, l); }
  for (const members of groups.values()) {
    const kind = members.find((m) => m.kind)?.kind;
    if (kind !== 'vending' && kind !== 'washer' && kind !== 'dryer') continue;
    const body = members.filter((m) => m.solid).sort((a, b) => vol(b) - vol(a))[0];
    if (!body) continue;
    const plates = members.filter((m) => !m.solid);
    const front = frontOf(body, plates);
    if (!front) continue;
    const { width, depth } = footprint(body, front);
    const pos: [number, number, number] = [(body.min[0] + body.max[0]) / 2, body.min[1], (body.min[2] + body.max[2]) / 2];
    const yaw = Math.atan2(front[0], front[1]);
    const h = body.max[1] - body.min[1];
    if (kind === 'vending') {
      const glow = plates.find((p) => /^light/.test(p.mat))?.mat;
      put('vending', VENDING_BODIES[Math.floor(hash(pos[0], pos[2]) * VENDING_BODIES.length)], glow, [width, h, depth], pos, yaw);
    } else {
      put(kind, 'paintWhite', undefined, [width, h, depth], pos, yaw);
    }
    replaced.push(...members);
  }
  // 単独の箱の自販機: 正面 = 薄い箱（前面の発光パネル・FakeSignage の商品ラベル）が最も多く貼られた面。無ければ部屋の中心を向く面
  for (const b of boxes) {
    if (b.kind !== 'vending' || b.propGroup) continue;
    const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const stuck = dirs.map((d) => ({ d, list: platesOn(b, boxes, d) }));
    stuck.sort((x, y) => y.list.length - x.list.length);
    let front = stuck[0].list.length ? stuck[0].d : null;
    if (!front) {
      const dx = center[0] - (b.min[0] + b.max[0]) / 2, dz = center[1] - (b.min[2] + b.max[2]) / 2;
      front = Math.abs(dx) >= Math.abs(dz) ? [Math.sign(dx) || 1, 0] : [0, Math.sign(dz) || 1];
    }
    const onFront = platesOn(b, boxes, front);
    const { width, depth } = footprint(b, front);
    const pos: [number, number, number] = [(b.min[0] + b.max[0]) / 2, b.min[1], (b.min[2] + b.max[2]) / 2];
    const glow = onFront.find((o) => /^light/.test(o.mat))?.mat;
    put('vending', VENDING_BODIES[Math.floor(hash(pos[0], pos[2]) * VENDING_BODIES.length)], glow, [width, b.max[1] - b.min[1], depth], pos, Math.atan2(front[0], front[1]));
    replaced.push(b, ...onFront);
  }
  return { specs: [...specs.values()], replaced };
}

/** 箱 b の面 d（外向き）に貼られた薄い非ソリッドの箱（面から外へ 6 cm 以内・面の範囲に重なる） */
function platesOn(b: Box, boxes: Box[], d: [number, number]): Box[] {
  const k = d[0] !== 0 ? 0 : 2, a = k === 0 ? 2 : 0, sgn = d[0] !== 0 ? d[0] : d[1];
  const F = sgn > 0 ? b.max[k] : b.min[k];
  return boxes.filter((o) => o !== b && !o.solid && (o.max[k] - o.min[k]) < 0.08
    && (sgn > 0 ? o.min[k] >= F - 0.01 && o.min[k] <= F + 0.06 : o.max[k] <= F + 0.01 && o.max[k] >= F - 0.06)
    && o.min[a] < b.max[a] && o.max[a] > b.min[a] && o.min[1] < b.max[1] && o.max[1] > b.min[1]);
}

function vol(b: Box): number { return (b.max[0] - b.min[0]) * (b.max[1] - b.min[1]) * (b.max[2] - b.min[2]); }

/** 正面の向き（軸平行の単位ベクトル [x, z]）: 本体の中心から、前面の薄い箔の平均へ */
function frontOf(body: Box, plates: Box[]): [number, number] | null {
  if (!plates.length) return null;
  const cx = (body.min[0] + body.max[0]) / 2, cz = (body.min[2] + body.max[2]) / 2;
  let sx = 0, sz = 0;
  for (const p of plates) { sx += (p.min[0] + p.max[0]) / 2 - cx; sz += (p.min[2] + p.max[2]) / 2 - cz; }
  if (Math.abs(sx) < 1e-3 && Math.abs(sz) < 1e-3) return null;
  return Math.abs(sx) >= Math.abs(sz) ? [Math.sign(sx), 0] : [0, Math.sign(sz)];
}

function footprint(b: Box, front: [number, number]): { width: number; depth: number } {
  const sx = b.max[0] - b.min[0], sz = b.max[2] - b.min[2];
  return front[0] !== 0 ? { width: sz, depth: sx } : { width: sx, depth: sz };
}
