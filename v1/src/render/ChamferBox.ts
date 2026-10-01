import * as THREE from 'three';

/**
 * 面取り箱（見た目専用。当たり判定は元の箱のまま）。
 *
 * BoxGeometry を「両端に幅 r の帯 + 内側を maxSeg m 以下の等間隔」で分割し、各頂点を内側の箱（半辺 − r）からの
 * 方向へ r だけ押し出す（RoundedBoxGeometry と同じ写像）。帯が 1 段なので辺は 45° の面取り、法線は面 → 辺で滑らかに
 * 曲がり、辺がハイライトを拾う。RoundedBoxGeometry（segments 1）との違いは、面の内側も分割すること:
 * 長い巾木・手すり・棚板でも頂点の焼き込み（bakedLight）が粗くならない。
 *
 * 面の group（materialIndex 0〜5 = +x −x +y −y +z −z）は BoxGeometry のまま残るので、面ごとの UV（writeSurfaceCoordinates）と
 * ライトマップの uv1（writeLightmapUV）はそのまま使える。type も 'BoxGeometry'。
 */
export function chamferBoxGeometry(sx: number, sy: number, sz: number, r: number, maxSeg = 1.25): THREE.BufferGeometry {
  const size = [sx, sy, sz];
  const half = size.map((v) => v / 2);
  const rr = Math.max(0, Math.min(r, ...half.map((h) => h * 0.49)));
  // 内側の分割数（帯の 2 段を除く）
  const inner = size.map((v) => Math.max(1, Math.min(40, Math.ceil((v - 2 * rr) / maxSeg))));
  const g = new THREE.BoxGeometry(sx, sy, sz, inner[0] + 2, inner[1] + 2, inner[2] + 2);
  if (rr <= 0) return g;
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const nrm = g.getAttribute('normal') as THREE.BufferAttribute;
  const p = [0, 0, 0];
  const d = [0, 0, 0];
  for (let i = 0; i < pos.count; i++) {
    p[0] = pos.getX(i); p[1] = pos.getY(i); p[2] = pos.getZ(i);
    // 等間隔の格子番号 → 帯付きの座標
    for (let a = 0; a < 3; a++) {
      const n = inner[a] + 2;
      const k = Math.round(((p[a] + half[a]) / size[a]) * n);
      const t = k === 0 ? 0 : k === n ? size[a] : rr + ((k - 1) / (n - 2)) * (size[a] - 2 * rr);
      p[a] = t - half[a];
    }
    // 内側の箱からの押し出し
    let len = 0;
    for (let a = 0; a < 3; a++) {
      const lim = half[a] - rr;
      const c = Math.max(-lim, Math.min(lim, p[a]));
      d[a] = p[a] - c;
      len += d[a] * d[a];
    }
    len = Math.sqrt(len);
    if (len > 1e-9) {
      for (let a = 0; a < 3; a++) p[a] = p[a] - d[a] + (d[a] / len) * rr;
      nrm.setXYZ(i, d[0] / len, d[1] / len, d[2] / len);
    }
    pos.setXYZ(i, p[0], p[1], p[2]);
  }
  pos.needsUpdate = true;
  nrm.needsUpdate = true;
  return g;
}

/** 面取りにする材質か。RoomBuilder はこの材質の箱をチャンク格子で分割しない（継ぎ目に角が出るため）。
 *  家具・扉・金属に加え、巾木 / 枠（trim）・手すり・ロッカー・座面・樹脂・ステンレス・棚板・黒板枠・画面の筐体・案内板・布張り */
export function isBevelMat(mat: string): boolean {
  return /^(door|furniture|shelf|boxCardboard|metal|column|carPaint|carGlass|trim|handrail|locker|seat|plastic|stainless|goldTrim|bookshelf|chalkboard|screenDark|signPlate|upholstery|whiteFabric|woodPanel|wainscot|marbleWhite|redShutter)/.test(mat);
}

/** 面取りの品質（RoomBuilder.setTier が Tier から決める）。high: 小さな部材まで / mid: 目に付く大きさだけ / low: 従来（最小辺 8 cm 超のみ） */
export type BevelQuality = 'high' | 'mid' | 'low';
let bevelQuality: BevelQuality = 'high';
export function setBevelQuality(q: BevelQuality): void { bevelQuality = q; }

/**
 * 箱の面取り半径（m）。0 なら面取りしない。
 * 半径は材質ごとの上限（金物 6 mm・木 / 樹脂 8〜12 mm・布張り 35 mm・車体 13 cm）と、最小辺の 1/4 の小さい方。
 * 最小辺と最大辺で「見て分かる大きさ」を足切りする（脚・金具・細い枠は high だけ。三角形は 1 箱 12 → 約 108。C09 社員食堂で high 3.7 万 → 18 万、mid はスマホ向けに天板・扉・棚など大きな部材だけ）
 */
export function bevelRadius(mat: string, size: number[]): number {
  if (!isBevelMat(mat)) return 0;
  const lo = Math.min(...size), hi = Math.max(...size);
  const need = bevelQuality === 'high' ? { lo: .012, hi: .25 } : bevelQuality === 'mid' ? { lo: .04, hi: .6 } : { lo: .08, hi: 0 };
  if (lo <= need.lo || hi < need.hi) return 0;
  const cap = mat === 'carPaint' || mat === 'carGlass' ? .13
    : /^(upholstery|whiteFabric)/.test(mat) ? .035
    : /^(metal|stainless|shelfMetal|goldTrim|locker)/.test(mat) ? .006
    : /^(trim|handrail|signPlate|screenDark|chalkboard)/.test(mat) ? .008
    : .018;
  const r = Math.min(cap, lo * .25);
  return r >= .002 ? r : 0;
}

