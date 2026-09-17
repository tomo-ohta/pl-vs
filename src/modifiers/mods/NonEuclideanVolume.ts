/**
 * NonEuclideanVolume — 非ユークリッド容積（E08 内部拡張会議室）。
 * params: interiorScale（面積倍率。既定 4.0 → 辺 sqrt(4) = 2 倍）/ shellSize（殻の一辺 m。既定 4.0）。
 *
 * 2 ノード方式（implementation-analysis「NonEuclideanVolume」/ v1.3 D14 の意図的 Seam）:
 *   ① 殻ノード（role 無し。E08 が通常抽選・?force= で出たとき）
 *      layout フックで生成器の出力を捨て、入口を中心にした shellSize × shellSize の閉じた箱に組み直す
 *      （床・天井・外壁 + 入口の対面に 'inner' 扉 1 枚 + WorldManager が後から足す直結ソケット x*）。内装は無く、天井灯 1 枚と扉脇の銘板だけ。
 *      onConnect: 'inner' 扉に { seam: true, forceDefinitionId: 自分の定義, role: 'interior' } を返す
 *      → WorldManager は物理配置せず閉じた Seam 扉にし、開けた瞬間に Game が resolveSeamTarget で内部ノードを遠方に抽選・配置してテレポートする。
 *   ② 内部ノード（role 'interior'。resolveSeamTarget が stash した指示から生成）
 *      layout フックで SmallRoom の足跡を辺 sqrt(interiorScale) 倍（面積 ×interiorScale）に広げ、外殻を通常寸法の開口で組み直し、
 *      大会議室として家具（長机・椅子・壁面キャビネット・ホワイトボード）と天井灯を置き直す。他の出口は通常接続（内部の周囲に物理隣接が付く）。
 *      onConnect: 内部の 'entry' 扉（resolveSeamTarget は isReturn=false で作る）に { targetExisting: 殻 } を返し、殻への一方通行 Seam（戻り）にする。
 *      戻った先は殻の入口内側（spawnPointOf）。
 *
 * RoomInstance.role は layout フックに渡らない（GenParams に node が無い）ので、`(p as { node? }).node?.role` があればそれで内部を判定する
 * （統合担当への依頼: docs/phase2-requests.md「GenParams.node」。M-theme の AmbientCarryover も同じフィールドを読む）。
 * node が渡らないうちは内部ノードも殻と同じ 4×4 の箱になるが、内部ノードの 'inner' は onConnect が seam にしないので通常の扉として先へ繋がる（無限入れ子にはならない）。
 *
 * 決定論: layout フックの乱数は渡された rng のみ。onNodeCreated で role を modifierState に記録する（保存・再生成で同じ扱い）。
 * Tier 差なし（描画量は元の SmallRoom と同程度）。build / update は持たない（入室後に部屋は変わらない）。
 */
import { aabbFromCenter, type AABB } from '../../core/aabb';
import type { Dir, RoomInstance, Socket, Vec3 } from '../../core/types';
import { addDir, dirVec } from '../../core/types';
import type { Rng } from '../../core/rng';
import { clearDoorways, labelAtEntry, lightGrid } from '../../generators/common';
import { buildShell, footprintAABB, inner as innerRect, rect, rectArea, type Rect } from '../../generators/footprint';
import { box, DOOR_H, DOOR_W, HOLE_SIZE, lightPanel, socket, WALL_T, type Box, type GenParams, type RoomLayout, type SignSpec } from '../../generators/layout';
import type { ModifierImpl } from '../types';
import { num } from '../util';

export const NEV_ID = 'NonEuclideanVolume';
/** 殻の内側の扉（Seam）。この id を onConnect が見る */
export const INNER_SOCKET_ID = 'inner';
export const INTERIOR_ROLE = 'interior';

export interface NevState {
  role: 'shell' | 'interior';
}

export function readNevState(node: RoomInstance | null | undefined): NevState | null {
  const s = node?.state?.modifierState?.[NEV_ID] as NevState | undefined;
  return s && (s.role === 'shell' || s.role === 'interior') ? s : null;
}

/** 壁面ソケットの内側に貼るサイン（壁の内面 + 1 cm、室内向き） */
function wallSign(id: string, wallPos: Vec3, wallDir: Dir, y: number, width: number, text: string, sub: string | undefined, kind: SignSpec['kind'], offsetAlong = 0): SignSpec {
  const inward = dirVec(addDir(wallDir, 2));
  const alongV = dirVec(addDir(wallDir, 1));
  const d = WALL_T + 0.01;
  return {
    id, text, sub, kind, width,
    pos: [wallPos[0] + inward[0] * d + alongV[0] * offsetAlong, y, wallPos[2] + inward[2] * d + alongV[2] * offsetAlong],
    dir: addDir(wallDir, 2),
  };
}

// ---------------------------------------------------------------- ① 殻

function buildShellRoom(L: RoomLayout, p: GenParams, size: number): void {
  const entry = L.sockets.find((s) => s.id === 'entry');
  if (!entry) {
    console.warn(`[${NEV_ID}] ${p.def.id}: entry が無いので殻を組めない`);
    return;
  }
  const extraIds = new Set(p.extraSockets.map((x) => x.id));
  const h = L.height;
  const half = size / 2;
  // 足跡: 入口を中心にした size × size（hole 入口は穴を 30% 位置に含む矩形）
  let fp: Rect;
  if (entry.type === 'hole') {
    fp = rect(entry.pos[0] - size * 0.3, entry.pos[2] - size * 0.3, entry.pos[0] + size * 0.7, entry.pos[2] + size * 0.7);
  } else {
    // 入口壁の外向き dir に対し、部屋は内側（-dir）へ size だけ伸びる
    const inward = dirVec(addDir(entry.dir, 2));
    const cx = entry.pos[0] + inward[0] * half;
    const cz = entry.pos[2] + inward[2] * half;
    fp = rect(cx - half, cz - half, cx + half, cz + half);
  }
  L.footprint = [fp];
  L.bounds = footprintAABB([fp], h);
  const cx = (fp.x0 + fp.x1) / 2;
  const cz = (fp.z0 + fp.z1) / 2;

  // ソケット: entry + 内側の扉（入口の対面。hole 入口なら +Z 壁）+ WorldManager の直結ソケット
  const innerDir: Dir = entry.type === 'hole' ? 0 : addDir(entry.dir, 2);
  const out = dirVec(innerDir);
  const innerPos: Vec3 = [
    innerDir === 0 || innerDir === 2 ? cx : (out[0] > 0 ? fp.x1 : fp.x0),
    0,
    innerDir === 1 || innerDir === 3 ? cz : (out[2] > 0 ? fp.z1 : fp.z0),
  ];
  const innerSocket = socket(INNER_SOCKET_ID, 'door', innerPos, innerDir, DOOR_W, DOOR_H);
  const sockets: Socket[] = [entry];
  if (!p.removedSockets.includes(INNER_SOCKET_ID)) sockets.push(innerSocket);
  for (const s of L.sockets) if (extraIds.has(s.id) && !p.removedSockets.includes(s.id)) sockets.push(s);
  L.sockets = sockets;
  L.holes = [];
  L.elevators = [];

  // 箔: 外殻（床穴なし。hole 入口なら天井穴）
  const ceilingHoles: AABB[] = entry.type === 'hole' ? [aabbFromCenter(entry.pos[0], h + 0.1, entry.pos[2], HOLE_SIZE / 2, 0.2, HOLE_SIZE / 2)] : [];
  const shell: Box[] = [];
  buildShell(shell, [fp], h, sockets, { floor: L.palette.floor, wall: L.palette.wall, ceiling: L.palette.ceiling, floorHoles: [], ceilingHoles });
  L.boxes = shell;
  L.shellCount = shell.length;
  if (entry.type === 'hole') {
    const c = ceilingHoles[0];
    L.boxes.push(box([c.min[0] - 0.2, 0.001, c.min[2] - 0.2], [c.max[0] + 0.2, 0.012, c.max[2] + 0.2], 'furnitureDark', false));
  }
  // 天井灯 1 枚 + 点光源 1 つ
  lightPanel(L.boxes, cx, cz, Math.min(1.2, size * 0.3), 0.6, h, L.palette.light);
  L.lights = [{ pos: [cx, h - 0.4, cz], color: L.palette.lightColor, intensity: L.palette.lightIntensity, distance: size * 2.2 }];
  // 内側の扉の脇の銘板（暗示: 中は広い）
  L.signs = [
    ...(L.signs ?? []),
    wallSign(`nev:${INNER_SOCKET_ID}`, innerPos, innerDir, 1.55, 0.7, '会議室', 'CONFERENCE ROOM', 'plate', DOOR_W / 2 + 0.55),
  ];
  // ラベルは入口のもの（位置は入口相対なので据え置き）。v1.3 任意フィールドは殻に不要なので落とす
  L.zones = undefined;
  L.instances = undefined;
  L.particles = undefined;
  L.decals = undefined;
  L.dynamics = undefined;
  L.path = entry.type === 'hole' ? undefined : [[entry.pos[0], 0, entry.pos[2]], [innerPos[0], 0, innerPos[2]]];
  clearDoorways(L, L.sockets, L.shellCount);
}

// ---------------------------------------------------------------- ② 内部

function expandInterior(L: RoomLayout, p: GenParams, s: number, rng: Rng): void {
  if (L.shellCount === undefined || L.footprint.length === 0) {
    console.warn(`[${NEV_ID}] ${p.def.id}: shellCount / footprint が無いので内部を拡大できない`);
    return;
  }
  const extraIds = new Set(p.extraSockets.map((x) => x.id));
  const h = Math.round(Math.min(4.0, L.height * 1.3) * 2) / 2;

  // 足跡・高さ
  L.footprint = L.footprint.map((r) => ({ x0: r.x0 * s, z0: r.z0 * s, x1: r.x1 * s, z1: r.z1 * s }));
  L.height = h;
  L.bounds = footprintAABB(L.footprint, h);
  // ソケット: 寸法はそのまま、位置だけ ×s。床穴は出さない。直結ソケット x* は拡大後座標で来るので触らない
  L.sockets = L.sockets.filter((x) => !(x.type === 'hole' && x.id !== 'entry'));
  for (const x of L.sockets) {
    if (extraIds.has(x.id)) continue;
    x.pos = x.type === 'hole' ? [x.pos[0] * s, h + 0.2, x.pos[2] * s] : [x.pos[0] * s, x.pos[1], x.pos[2] * s];
  }
  L.holes = [];
  L.elevators = [];
  const entry = L.sockets.find((x) => x.id === 'entry');

  // 外殻を組み直す
  const ceilingHoles: AABB[] = entry && entry.type === 'hole' ? [aabbFromCenter(entry.pos[0], h + 0.1, entry.pos[2], HOLE_SIZE / 2, 0.2, HOLE_SIZE / 2)] : [];
  const shell: Box[] = [];
  buildShell(shell, L.footprint, h, L.sockets, { floor: L.palette.floor, wall: L.palette.wall, ceiling: L.palette.ceiling, floorHoles: [], ceilingHoles });
  L.boxes = shell;
  L.shellCount = shell.length;
  if (entry && entry.type === 'hole') {
    const c = ceilingHoles[0];
    L.boxes.push(box([c.min[0] - 0.2, 0.001, c.min[2] - 0.2], [c.max[0] + 0.2, 0.012, c.max[2] + 0.2], 'furnitureDark', false));
  }

  // 家具: 大会議室（長机 + 椅子 + 壁面キャビネット + ホワイトボード）
  const main = L.footprint[0];
  const ir = innerRect(main, 1.6);
  const w = ir.x1 - ir.x0;
  const d = ir.z1 - ir.z0;
  const alongX = w >= d;
  const tableLen = Math.min(alongX ? w - 3.0 : d - 3.0, 14);
  const tableW = 1.6;
  const tcx = (ir.x0 + ir.x1) / 2;
  const tcz = (ir.z0 + ir.z1) / 2;
  if (tableLen >= 2.4) {
    const t = alongX
      ? box([tcx - tableLen / 2, 0, tcz - tableW / 2], [tcx + tableLen / 2, 0.75, tcz + tableW / 2], 'furnitureDark')
      : box([tcx - tableW / 2, 0, tcz - tableLen / 2], [tcx + tableW / 2, 0.75, tcz + tableLen / 2], 'furnitureDark');
    L.boxes.push(t);
    L.boxes.push(box([t.min[0], 0.75, t.min[2]], [t.max[0], 0.79, t.max[2]], 'furnitureLight', false));
    // 椅子（両側 0.9 m 間隔）
    const n = Math.floor(tableLen / 0.9);
    for (let i = 0; i < n; i++) {
      const a = -tableLen / 2 + 0.45 + i * 0.9;
      for (const side of [-1, 1]) {
        const off = side * (tableW / 2 + 0.45);
        const cx = alongX ? tcx + a : tcx + off;
        const cz = alongX ? tcz + off : tcz + a;
        L.boxes.push(box([cx - 0.25, 0, cz - 0.25], [cx + 0.25, 0.45, cz + 0.25], 'furnitureLight'));
        L.boxes.push(box([cx - 0.25, 0.45, cz - 0.25], [cx + 0.25, 0.48, cz + 0.25], 'upholstery', false));
      }
    }
  }
  // 壁面キャビネット（入口壁を除く 3 面。ソケット付近は clearDoorways が空ける）
  const cab = 0.45;
  const edges: { r: Rect; dir: Dir }[] = [
    { r: rect(main.x0 + WALL_T, main.z1 - WALL_T - cab, main.x1 - WALL_T, main.z1 - WALL_T), dir: 0 },
    { r: rect(main.x1 - WALL_T - cab, main.z0 + WALL_T, main.x1 - WALL_T, main.z1 - WALL_T), dir: 1 },
    { r: rect(main.x0 + WALL_T, main.z0 + WALL_T, main.x0 + WALL_T + cab, main.z1 - WALL_T), dir: 3 },
  ];
  const entryDir: Dir | -1 = entry && entry.type !== 'hole' ? entry.dir : -1;
  const cr = rng.fork('cabinets');
  const cabinetWalls = new Set<Dir>();
  for (const e of edges) {
    if (e.dir === entryDir) continue;
    if (cr.chance(0.35)) continue;
    cabinetWalls.add(e.dir);
    const horizontal = e.dir === 0 || e.dir === 2;
    const len = horizontal ? e.r.x1 - e.r.x0 : e.r.z1 - e.r.z0;
    const seg = 1.8;
    for (let t = 0.6; t + seg <= len - 0.6; t += seg + 0.15) {
      const b = horizontal
        ? box([e.r.x0 + t, 0, e.r.z0], [e.r.x0 + t + seg, 1.1, e.r.z1], 'furnitureLight')
        : box([e.r.x0, 0, e.r.z0 + t], [e.r.x1, 1.1, e.r.z0 + t + seg], 'furnitureLight');
      L.boxes.push(b);
    }
  }
  // ホワイトボード（入口の対面の壁）
  if (entryDir !== -1) {
    const wd = addDir(entryDir, 2);
    const inward = dirVec(addDir(wd, 2));
    const cxw = (main.x0 + main.x1) / 2;
    const czw = (main.z0 + main.z1) / 2;
    const wallPos: Vec3 = wd === 0 ? [cxw, 0, main.z1] : wd === 2 ? [cxw, 0, main.z0] : wd === 1 ? [main.x1, 0, czw] : [main.x0, 0, czw];
    const bw = Math.min(3.6, (wd === 0 || wd === 2 ? main.x1 - main.x0 : main.z1 - main.z0) * 0.4);
    const d0 = WALL_T + (cabinetWalls.has(wd) ? cab : 0) + 0.02;
    const pa: Vec3 = [wallPos[0] + inward[0] * d0, 0.95, wallPos[2] + inward[2] * d0];
    const pb: Vec3 = [wallPos[0] + inward[0] * (d0 + 0.04), 2.05, wallPos[2] + inward[2] * (d0 + 0.04)];
    if (wd === 0 || wd === 2) L.boxes.push(box([pa[0] - bw / 2, pa[1], pa[2]], [pb[0] + bw / 2, pb[1], pb[2]], 'wallWhite', false));
    else L.boxes.push(box([pa[0], pa[1], pa[2] - bw / 2], [pb[0], pb[1], pb[2] + bw / 2], 'wallWhite', false));
  }

  // 照明・ラベル・サイン
  L.lights = [];
  const area = L.footprint.reduce((a, r) => a + rectArea(r), 0);
  lightGrid(L, L.footprint, h, 4.0, 0.04, rng.fork('lights'), L.palette.light, L.palette.lightColor, L.palette.lightIntensity, area > 200 ? 4 : 3);
  L.labels = [];
  if (entry) labelAtEntry(L, entry, 2.4, p.label);
  if (entry && entry.type !== 'hole') {
    // 入口ラベル（幅 2.4）と重ならないよう、入口壁の広い側へ 2.2 m ずらす（alongV = 壁の右手方向 = addDir(dir, 1)）
    const alongV = dirVec(addDir(entry.dir, 1));
    const extentPos = alongV[0] !== 0 ? (alongV[0] > 0 ? main.x1 - entry.pos[0] : entry.pos[0] - main.x0) : (alongV[2] > 0 ? main.z1 - entry.pos[2] : entry.pos[2] - main.z0);
    const extentNeg = alongV[0] !== 0 ? (alongV[0] > 0 ? entry.pos[0] - main.x0 : main.x1 - entry.pos[0]) : (alongV[2] > 0 ? entry.pos[2] - main.z0 : main.z1 - entry.pos[2]);
    const side = extentPos >= extentNeg ? 1 : -1;
    if (Math.max(extentPos, extentNeg) >= 3.0) {
      L.signs = [...(L.signs ?? []), wallSign('nev:interior', entry.pos, entry.dir, 2.0, 1.2, '会議室', `${(area).toFixed(0)} m²`, 'plate', side * 2.2)];
    }
    L.path = [[entry.pos[0], 0, entry.pos[2]], [tcx, 0, tcz]];
  }
  L.zones = undefined;
  L.instances = undefined;
  L.particles = undefined;
  L.decals = undefined;
  L.dynamics = undefined;
  clearDoorways(L, L.sockets, L.shellCount);
}

// ---------------------------------------------------------------- Modifier

const NonEuclideanVolume: ModifierImpl = {
  id: NEV_ID,
  defaults: { interiorScale: 4.0, shellSize: 4.0 },

  layout(L, p, params, rng) {
    const role = (p as { node?: RoomInstance }).node?.role;
    if (role === INTERIOR_ROLE) {
      const s = Math.sqrt(Math.max(1, num(params.interiorScale, 4.0)));
      expandInterior(L, p, s, rng);
    } else {
      buildShellRoom(L, p, Math.max(3.0, num(params.shellSize, 4.0)));
    }
  },

  onNodeCreated(node) {
    if (!node.state.modifierState) node.state.modifierState = {};
    const s: NevState = { role: node.role === INTERIOR_ROLE ? 'interior' : 'shell' };
    node.state.modifierState[NEV_ID] = s;
  },

  onConnect(ctx) {
    const isInterior = ctx.node.role === INTERIOR_ROLE || readNevState(ctx.node)?.role === 'interior';
    if (isInterior) {
      // 内部の入口（resolveSeamTarget は isReturn=false で作る）→ 殻へ戻る一方通行 Seam
      if (ctx.portal.portalId === 'entry' && !ctx.portal.isReturn && ctx.node.parentRoomId && ctx.world.graph.has(ctx.node.parentRoomId)) {
        return { targetExisting: ctx.node.parentRoomId };
      }
      return;
    }
    if (ctx.portal.socketId === INNER_SOCKET_ID) {
      // 殻の内側の扉: 物理配置せず、開けた瞬間に内部ノードを遠方に生成してテレポート
      return { seam: true, forceDefinitionId: ctx.def.id, role: INTERIOR_ROLE };
    }
  },
};

export default NonEuclideanVolume;
