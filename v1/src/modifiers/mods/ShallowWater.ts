/**
 * ShallowWater — 床全面の浅水（R01 depth 0.25 / R14 depth 0.3 / L02 depth 0.5 + 桟橋）。
 * params: depth(m), slow(速度倍率), pier(boolean。入口と全出口を結ぶ歩ける桟橋), pierWidth(m), sillMat(MatId)
 *
 * layout フック（決定論。ジオメトリはここで完結）:
 *   - 水面: footprint の各矩形に非ソリッドの 'waterShallow' 箔。扉前の前庭（apron）と床穴はくり抜く。
 *     水深が敷居より高いとき（L02）は箔を敷居の高さから水面までの箱にし、前庭の切り口に「水の壁」が見える。
 *   - 前庭 + 敷居: hole 以外の全開口の内側に乾いた前庭（扉パネルの回転半径より奥）を取り、コの字の低い 'trim' 縁
 *     （高さ min(depth+0.05, 0.3)。段差 0.35 で自動的に越えられる）で水を堰き止める。隣室から扉越しに水面が突き抜けて見えない。
 *   - R01はRoomBuilderで元の壁に局所濡れを適用。それ以外の壁の濡れ帯: 外壁の内面に 'wallDark' の薄い帯（y 0.02〜depth+0.12。開口は除く）。
 *   - ゾーン: 水面と同じ矩形を kind 'water'（params.slow）で L.zones に出す（前庭・桟橋の上では減速しない）。
 *   - 桟橋（pier=true。L02）: 主矩形中央のハブと各前庭を L 字の 'floorWood' デッキ（幅 pierWidth、上面 depth+0.1）で結ぶ。
 *     前庭の縁（0.3）→ デッキ（0.6）と 0.3 刻みで登れる。翼矩形のソケットは共有辺の中点を経由する。
 *     デッキに重なる内装（家具・柱）は取り除く。デッキ縁に杭。
 *   - 水面・帯・縁はシェル側（shellCount を増やす）、桟橋は内装側に入れる。
 * 音は Game.enterRoom が zones の 'water' を見て足音を水にする（既存配線）。
 */
import type { AABB } from '../../core/aabb';
import type { Socket } from '../../core/types';
import type { Rng } from '../../core/rng';
import { inner, rect, type Rect } from '../../generators/footprint';
import { box, WALL_T, type Box, type MatId, type Zone } from '../../generators/layout';
import type { ModifierImpl } from '../types';
import { bool, num, str } from '../util';
import {
  bandBox, footprintOrBounds, inwardVec, rectContainingSocket, rectIntersect, rectOfAabb, rectOverlaps, socketApron, subtractRects, wallBandSegments,
} from './ShallowWater.geom';

/** 敷居（前庭の縁）の最大高さ。PlayerController の段差 0.35 より低い */
const SILL_MAX = 0.3;
/** 1 段で登れる高さ（余裕込み） */
const STEP = 0.3;
/** 前庭の奥行きの最小値（扉パネル 1.06 m の回転半径より奥） */
const APRON_MIN_DEPTH = 1.3;
const APRON_PAD = 0.4;
const CURB_T = 0.15;
const CURB_BACK = 0.4;

interface Apron {
  socket: Socket;
  rect: Rect;
  /** 前庭の内側の縁の中心（デッキの起点） */
  point: [number, number];
  /** 前庭が載っている足跡矩形 */
  home: Rect;
}

const ShallowWater: ModifierImpl = {
  id: 'ShallowWater',
  defaults: { depth: 0.25, slow: 0.7, pier: false, pierWidth: 2.4, sillMat: 'trim' },
  layout(L, _p, params, rng) {
    const depth = Math.min(1.5, Math.max(0.05, num(params.depth, 0.25)));
    const slow = Math.min(1, Math.max(0.2, num(params.slow, 0.7)));
    const pier = bool(params.pier, false);
    const pierWidth = Math.min(4, Math.max(1.6, num(params.pierWidth, 2.4)));
    const sillMat = str(params.sillMat, 'trim') as MatId;
    const rects = footprintOrBounds(L);
    if (rects.length === 0) return;
    const sockets = L.sockets;
    const curbH = Math.min(depth + 0.05, SILL_MAX);
    const deckTop = depth + 0.1;

    // ---- 前庭（hole 以外の開口。開口下端が水面より高ければ不要）
    const aprons: Apron[] = [];
    for (const s of sockets) {
      if (s.type === 'hole' || (s.sill ?? 0) >= depth) continue;
      const home = rectContainingSocket(rects, s) ?? rects[0];
      const apronDepth = Math.max(APRON_MIN_DEPTH, s.width + 0.3);
      const r = socketApron(s, apronDepth, APRON_PAD, inner(home, 0.02));
      if (!r) continue;
      const inward = inwardVec(s.dir);
      const isZ = s.dir === 0 || s.dir === 2;
      const point: [number, number] = isZ
        ? [(r.x0 + r.x1) / 2, inward[1] > 0 ? r.z1 : r.z0]
        : [inward[0] > 0 ? r.x1 : r.x0, (r.z0 + r.z1) / 2];
      aprons.push({ socket: s, rect: r, point, home });
    }

    // ---- 水面の矩形（前庭と床穴をくり抜く）
    let pieces: Rect[] = [];
    for (const r of rects) {
      let cur: Rect[] = [r];
      for (const a of aprons) cur = subtractRects(cur, a.rect);
      for (const h of L.holes) cur = subtractRects(cur, rectOfAabb(h, 0.05));
      pieces = pieces.concat(cur);
    }
    const waterBottom = depth > curbH + 0.02 ? curbH - 0.02 : Math.max(0.01, depth - 0.02);
    const shell: Box[] = [];
    for (const r of pieces) shell.push(box([r.x0, waterBottom, r.z0], [r.x1, depth, r.z1], 'waterShallow', false));

    // ---- 壁の濡れ帯（開口は除く）
    const localizedWetness = _p.def.id === 'R01';
    // R01 shades the original wall in RoomBuilder; avoid a raised overlay seam.
    if (!localizedWetness) for (const seg of wallBandSegments(rects, sockets, 0.15))
      shell.push(bandBox(seg, 0.02, depth + 0.12, 'wallDark'));

    // ---- 前庭のコの字の縁（敷居）
    for (const a of aprons) shell.push(...curbBoxes(a, curbH, sillMat));

    // ---- 桟橋
    const interior: Box[] = [];
    let deckRects: Rect[] = [];
    if (pier && aprons.length > 0) {
      const built = buildPier(rects, aprons, L.holes, pierWidth, curbH, deckTop, rng);
      interior.push(...built.boxes);
      deckRects = built.deckRects;
    }

    // ---- レイアウトへ反映。水面・帯・縁はシェル側、桟橋は内装側
    const shellCount = L.shellCount ?? L.boxes.length;
    L.boxes.splice(shellCount, 0, ...shell);
    L.shellCount = shellCount + shell.length;
    if (deckRects.length > 0) {
      // デッキに重なる内装（家具・柱・机上の板）は取り除く。天井灯（高い位置の箔）は残す
      const keep: Box[] = L.boxes.slice(0, L.shellCount);
      for (const b of L.boxes.slice(L.shellCount)) {
        if (b.min[1] >= deckTop + 2.2) { keep.push(b); continue; }
        const br = rect(b.min[0], b.min[2], b.max[0], b.max[2]);
        if (deckRects.some((d) => rectOverlaps(rect(d.x0 - 0.3, d.z0 - 0.3, d.x1 + 0.3, d.z1 + 0.3), br))) continue;
        keep.push(b);
      }
      L.boxes = keep;
    }
    L.boxes.push(...interior);

    // ---- ゾーン（水面の矩形と同じ。足元が桟橋・前庭のときは入らない）
    const zones: Zone[] = pieces.map((r) => ({
      kind: 'water',
      aabb: { min: [r.x0, -0.1, r.z0], max: [r.x1, depth + 0.05, r.z1] } as AABB,
      params: { slow, depth },
    }));
    L.zones = [...(L.zones ?? []), ...zones];

    // 材質は全体に湿り気（床は水面下なので控えめ）
    const prevWet = L.render?.wetness ?? 0;
    L.render = { ...(L.render ?? {}), wetness: localizedWetness ? prevWet : Math.max(prevWet, 0.3) };
  },
};

/** 前庭のコの字の縁: 奥の縁（CURB_BACK 奥行き）+ 両側の縁（壁の内面から奥の縁まで） */
function curbBoxes(a: Apron, h: number, mat: MatId): Box[] {
  const r = a.rect;
  const inward = inwardVec(a.socket.dir);
  const out: Box[] = [];
  if (a.socket.dir === 0 || a.socket.dir === 2) {
    // 壁は z 方向、奥は inward[1] の向き
    const backZ0 = inward[1] > 0 ? r.z1 - CURB_BACK : r.z0;
    const backZ1 = inward[1] > 0 ? r.z1 : r.z0 + CURB_BACK;
    out.push(box([r.x0, 0, backZ0], [r.x1, h, backZ1], mat));
    const sideZ0 = inward[1] > 0 ? r.z0 + WALL_T : r.z0;
    const sideZ1 = inward[1] > 0 ? r.z1 : r.z1 - WALL_T;
    out.push(box([r.x0, 0, sideZ0], [r.x0 + CURB_T, h, sideZ1], mat));
    out.push(box([r.x1 - CURB_T, 0, sideZ0], [r.x1, h, sideZ1], mat));
  } else {
    const backX0 = inward[0] > 0 ? r.x1 - CURB_BACK : r.x0;
    const backX1 = inward[0] > 0 ? r.x1 : r.x0 + CURB_BACK;
    out.push(box([backX0, 0, r.z0], [backX1, h, r.z1], mat));
    const sideX0 = inward[0] > 0 ? r.x0 + WALL_T : r.x0;
    const sideX1 = inward[0] > 0 ? r.x1 : r.x1 - WALL_T;
    out.push(box([sideX0, 0, r.z0], [sideX1, h, r.z0 + CURB_T], mat));
    out.push(box([sideX0, 0, r.z1 - CURB_T], [sideX1, h, r.z1], mat));
  }
  return out;
}

// ---------------------------------------------------------------- 桟橋

interface PierBuild {
  boxes: Box[];
  deckRects: Rect[];
}

/** 翼矩形 wing と主矩形 main が共有する辺の中点（接していなければ null） */
function sharedEdgeMid(main: Rect, wing: Rect): [number, number] | null {
  const eps = 0.05;
  const zo0 = Math.max(main.z0, wing.z0);
  const zo1 = Math.min(main.z1, wing.z1);
  const xo0 = Math.max(main.x0, wing.x0);
  const xo1 = Math.min(main.x1, wing.x1);
  if (Math.abs(wing.x0 - main.x1) < eps && zo1 - zo0 > 1) return [main.x1, (zo0 + zo1) / 2];
  if (Math.abs(wing.x1 - main.x0) < eps && zo1 - zo0 > 1) return [main.x0, (zo0 + zo1) / 2];
  if (Math.abs(wing.z0 - main.z1) < eps && xo1 - xo0 > 1) return [(xo0 + xo1) / 2, main.z1];
  if (Math.abs(wing.z1 - main.z0) < eps && xo1 - xo0 > 1) return [(xo0 + xo1) / 2, main.z0];
  return null;
}

/** 2 点を結ぶ L 字のデッキ矩形（zFirst: 先に z 方向へ進む）。矩形 within に切り詰める */
function legRects(from: [number, number], to: [number, number], w: number, zFirst: boolean, within: Rect): Rect[] {
  const hw = w / 2;
  const corner: [number, number] = zFirst ? [from[0], to[1]] : [to[0], from[1]];
  const legs: Rect[] = [];
  const seg = (a: [number, number], b: [number, number]) => {
    if (Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01) return;
    if (Math.abs(a[0] - b[0]) < 0.01) legs.push(rect(a[0] - hw, Math.min(a[1], b[1]) - hw, a[0] + hw, Math.max(a[1], b[1]) + hw));
    else legs.push(rect(Math.min(a[0], b[0]) - hw, a[1] - hw, Math.max(a[0], b[0]) + hw, a[1] + hw));
  };
  seg(from, corner);
  seg(corner, to);
  const out: Rect[] = [];
  for (const l of legs) {
    const c = rectIntersect(l, within);
    if (c) out.push(c);
  }
  return out;
}

function buildPier(rects: Rect[], aprons: Apron[], holes: AABB[], w: number, curbH: number, deckTop: number, rng: Rng): PierBuild {
  const main = rects[0];
  const holeRects = holes.map((h) => rectOfAabb(h, 0.6));
  const hitsHole = (rs: Rect[]) => rs.some((r) => holeRects.some((h) => rectOverlaps(r, h)));

  // ハブ: 主矩形の中央。床穴が近ければ長辺方向へずらす
  let hub: [number, number] = [(main.x0 + main.x1) / 2, (main.z0 + main.z1) / 2];
  const hubHalf = Math.max(1.8, w * 0.75);
  if (hitsHole([rect(hub[0] - hubHalf, hub[1] - hubHalf, hub[0] + hubHalf, hub[1] + hubHalf)])) {
    const alongX = main.x1 - main.x0 >= main.z1 - main.z0;
    const sign = rng.chance(0.5) ? 1 : -1;
    hub = alongX ? [hub[0] + sign * 3.5, hub[1]] : [hub[0], hub[1] + sign * 3.5];
  }
  let deckRects: Rect[] = [];
  const mainIn = inner(main, WALL_T + 0.02);
  const hubRect = rectIntersect(rect(hub[0] - hubHalf, hub[1] - hubHalf, hub[0] + hubHalf, hub[1] + hubHalf), mainIn);
  if (hubRect) deckRects.push(hubRect);

  const route = (from: [number, number], to: [number, number], within: Rect, perpIsZ: boolean) => {
    // 壁から垂直に離れる脚を先に（壁沿いに他の前庭を横切らない）。床穴に当たれば順を入れ替える
    const a = legRects(from, to, w, perpIsZ, within);
    const b = legRects(from, to, w, !perpIsZ, within);
    deckRects.push(...(hitsHole(a) && !hitsHole(b) ? b : a));
  };

  const connectors = new Map<Rect, [number, number]>();
  for (const a of aprons) {
    const perpIsZ = a.socket.dir === 0 || a.socket.dir === 2;
    if (a.home === main) {
      route(a.point, hub, mainIn, perpIsZ);
      continue;
    }
    // 翼: 共有辺の中点を経由してハブへ
    let c = connectors.get(a.home);
    if (!c) {
      const mid = sharedEdgeMid(main, a.home);
      if (mid) {
        connectors.set(a.home, mid);
        // 主矩形側: 共有辺から垂直に離れてハブへ
        const perpZ = Math.abs(mid[1] - main.z0) < 0.05 || Math.abs(mid[1] - main.z1) < 0.05;
        route(mid, hub, mainIn, perpZ);
      }
      c = mid ?? hub;
    }
    route(a.point, c, mid2Within(a.home, main, c), perpIsZ);
  }

  // デッキは前庭（と中間段）の奥から始める。脚の矩形は端を半幅だけ延ばして角をつなぐので、そのままだと前庭の上まで
  // デッキが伸び、狭い前庭（幅 1 m の入口扉）では扉の真ん前が高さ deckTop の段になって縁 → デッキと登れなかった
  const stepsOf = (): number => { let y = curbH, k = 0; while (deckTop - y > STEP + 0.05 && k < 4) { y = Math.min(deckTop - 0.05, y + STEP); k++; } return k; };
  const nSteps = stepsOf();
  for (const a of aprons) {
    const inward = inwardVec(a.socket.dir);
    const hw = Math.max(a.socket.width / 2 + APRON_PAD, w / 2) + 0.01;
    const reach = nSteps * CURB_BACK;
    const r = a.rect;
    const cut = a.socket.dir === 0 || a.socket.dir === 2
      ? rect(a.point[0] - hw, Math.min(r.z0, a.point[1] + inward[1] * reach), a.point[0] + hw, Math.max(r.z1, a.point[1] + inward[1] * reach))
      : rect(Math.min(r.x0, a.point[0] + inward[0] * reach), a.point[1] - hw, Math.max(r.x1, a.point[0] + inward[0] * reach), a.point[1] + hw);
    deckRects = subtractRects(deckRects, cut);
  }

  // 箱: デッキ（床から deckTop まで）、前庭の縁から deckTop への中間段、杭
  const boxes: Box[] = [];
  for (const d of deckRects) boxes.push(box([d.x0, 0, d.z0], [d.x1, deckTop, d.z1], 'floorWood'));
  for (const a of aprons) {
    // 縁（curbH）とデッキ（deckTop）の差が 1 段で登れなければ、前庭の奥の縁の先に中間段を置く
    const inward = inwardVec(a.socket.dir);
    let y = curbH;
    let k = 0;
    while (k < nSteps) {
      y = Math.min(deckTop - 0.05, y + STEP);
      k++;
      const d0 = (k - 1) * CURB_BACK;
      const d1 = k * CURB_BACK;
      const hw = a.socket.width / 2 + APRON_PAD;
      const r = a.socket.dir === 0 || a.socket.dir === 2
        ? rect(a.point[0] - hw, a.point[1] + inward[1] * d0, a.point[0] + hw, a.point[1] + inward[1] * d1)
        : rect(a.point[0] + inward[0] * d0, a.point[1] - hw, a.point[0] + inward[0] * d1, a.point[1] + hw);
      boxes.push(box([r.x0, 0, r.z0], [r.x1, y, r.z1], 'trim'));
    }
  }
  // 杭: 各デッキ矩形の長辺に沿って 3 m ごと（デッキの外側 0.05）
  const seen = new Set<string>();
  for (const d of deckRects) {
    const alongX = d.x1 - d.x0 >= d.z1 - d.z0;
    const len = alongX ? d.x1 - d.x0 : d.z1 - d.z0;
    if (len < 4) continue;
    const n = Math.floor(len / 3);
    for (let i = 0; i <= n; i++) {
      const t = (alongX ? d.x0 : d.z0) + 0.4 + (i * (len - 0.8)) / Math.max(1, n);
      for (const side of [0, 1]) {
        const px = alongX ? t : side ? d.x1 + 0.12 : d.x0 - 0.12;
        const pz = alongX ? (side ? d.z1 + 0.12 : d.z0 - 0.12) : t;
        const key = `${Math.round(px * 4)}:${Math.round(pz * 4)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        // 他のデッキの上には立てない
        if (deckRects.some((o) => px > o.x0 && px < o.x1 && pz > o.z0 && pz < o.z1)) continue;
        if (!rects.some((r) => px > r.x0 + WALL_T && px < r.x1 - WALL_T && pz > r.z0 + WALL_T && pz < r.z1 - WALL_T)) continue;
        boxes.push(box([px - 0.07, 0, pz - 0.07], [px + 0.07, deckTop + 0.55, pz + 0.07], 'furnitureDark'));
      }
    }
  }
  return { boxes, deckRects };
}

/** 翼内の経路の切り詰め範囲: 翼の内側。接続点が共有辺上なので翼の内側矩形をその辺まで広げる */
function mid2Within(wing: Rect, main: Rect, c: [number, number]): Rect {
  const r = inner(wing, WALL_T + 0.02);
  const eps = 0.05;
  if (Math.abs(c[0] - wing.x0) < eps && Math.abs(wing.x0 - main.x1) < eps) r.x0 = wing.x0 - 0.3;
  if (Math.abs(c[0] - wing.x1) < eps && Math.abs(wing.x1 - main.x0) < eps) r.x1 = wing.x1 + 0.3;
  if (Math.abs(c[1] - wing.z0) < eps && Math.abs(wing.z0 - main.z1) < eps) r.z0 = wing.z0 - 0.3;
  if (Math.abs(c[1] - wing.z1) < eps && Math.abs(wing.z1 - main.z0) < eps) r.z1 = wing.z1 + 0.3;
  return r;
}

export default ShallowWater;
