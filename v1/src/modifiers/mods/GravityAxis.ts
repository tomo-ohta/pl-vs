/**
 * GravityAxis — E03 横向きホテル（v1.3 D12: 見た目だけ横倒し。真の重力回転と mode pathFollow / E10 はオミット）。
 * params: mode('fixed') / upVector（参照のみ）/ visualOnly(true) / rollDeg(90) / floorDoors('hole') / wallDoors('slot')。
 *
 * layout フック（決定論）に加えて、床扉のパネルのために onConnect / build フックを持つ:
 *  (1) 見た目のロール: L.roll（1/4 回転数）/ rollAxis / rollPivot / rollFrom を設定し、RoomBuilder に「最初の廊下セグメントと同軸の
 *      内装（箱・照明・ラベル）」を進行軸まわりに回してもらう。折れ廊下の他セグメントは進行方向が違うので、この hook 内で
 *      各セグメント自身の進行軸まわりに手で回し（rollFrom より前に置いて RoomBuilder には回させない）、照明・ラベルの位置だけは
 *      RoomBuilder が全数を回すので、手で回した結果に RoomBuilder のロールの逆変換を掛けて格納する（合成で正しい位置になる）。
 *      廊下の断面は幅 w（1.9〜2.6）× 高さ h（2.7）で正方形ではないため、回す前に断面を非等方に伸縮させる
 *      （内法幅 → h、高さ → 内法幅）。これで旧壁の偽扉が床・天井にぴたりと付き、旧天井のパネル灯が側壁に付く。
 *      外殻（床・天井・外壁）は回さない。footprint / bounds は変えないので配置・地図・隣接接続は通常どおり。
 *  (2) 進行用の壁扉（entry と直結用 extraSockets を除く door ソケット）を横長スロット SLOT_W×SLOT_H（2.1×1.0）・下端 SLOT_SILL(0.6)・
 *      crawl=true に変える（端の壁が狭いときは壁の内法に収まる幅へ丸める）。WorldManager が crawl Adapter を挟む。
 *  (3) floorDoors='hole': 床の扉 = hole ソケット + 扉パネル（v1.3 Q1）。旧床側の壁に寄せて 0.9〜1.1 × 1.4 m の細長い穴を開け
 *      （真下の部屋の天井穴 1.4×1.4 に収まる。プレイヤー幅 0.7 より広く、横に 1.0 m 前後の通路を残す。廊下幅は生成器が 2.4 m 以上に
 *      クランプ）、縁に trim の枠と metal の蝶番を置く（枡・蝶番は rollFrom より前に置き、床に残す）。
 *      p.allowHole / p.removedSockets('hole') / p.holeLocal（生成器が固定位置に置いた穴）を尊重する。
 *  (4) 外殻を buildShell で組み直し（スロット開口・床穴を反映）、shellCount / rollFrom を更新する。ヒント文言は Game の crawl 表示に任せる。
 *
 * 床扉パネル（Hole 動作 + 扉）:
 *  - onConnect: hole Portal（所有側）に `covered = true, open = false` を立てる（接続抽選の直前 = Portal ができてから最初のフック。
 *    決定論で毎回同じ結果になり、セーブにもそのまま残る）。WorldManager.portalOpen は covered な穴を扉と同じく open で判定するので、
 *    閉じている間は下の部屋を描かない（Game.updateVisibility）。
 *  - build: 穴を覆うパネル（palette.door の薄い箱）を蝶番側（壁側の長辺）を軸にしたピボットに載せて built.doorGroup に置き、
 *    userData kind 'door' で built.interactables に登録する（Game.interactRay / updateHint の扉分岐がそのまま開閉・「E: 扉を開ける」を扱う）。
 *    閉じている間は穴と同じ xz の AABB（y −0.2〜0）を solid な DynamicCollider として built.dynamicColliders に登録し、歩いて渡れる。
 *    RoomEffect が portal.open に応じてパネルを 0→90° 起こし（既存の扉と同じ dt×2.2）、半分以上開いたらコライダを外す = 落ちる。
 *    BuiltRoom.doors には入れない（4 秒自動閉扉の対象外。落ちた後に閉まる必要はない）。パネルは上の廊下からだけ操作できる
 *    （真下から見上げて閉めると上の部屋が非表示になり効果の更新が止まるため。raycast を上からの視線に限定）。
 */
import * as THREE from 'three';
import { aabbContains, aabbFromCenter, aabbOverlap, aabbToWorld, type AABB } from '../../core/aabb';
import type { Dir, Portal, Socket, Vec3 } from '../../core/types';
import type { Rng } from '../../core/rng';
import { buildShell, clearOfSockets, inRect, type Rect } from '../../generators/footprint';
import { box, HOLE_SIZE, SLOT_H, SLOT_SILL, SLOT_W, WALL_T, type Box, type DynamicSpec, type RoomLayout } from '../../generators/layout';
import type { BuiltRoom, DynamicCollider, RoomEffect } from '../../render/RoomBuilder';
import { surfaceBox } from '../../render/SurfaceGeometry';
import type { BuildContext, ModifierImpl } from '../types';
import { bool, num, str } from '../util';

/** 廊下セグメント（footprint の矩形 1 つ）と、その進行軸まわりのロールに必要な量 */
interface Seg {
  rect: Rect;
  heading: Dir;
  /** 進行軸。'z' なら断面の水平軸は x */
  axis: 'x' | 'z';
  /** 断面の水平単位ベクトル e = up × f（f は進行方向）。axis 'z' なら ex、'x' なら ez が ±1 */
  ex: number;
  ez: number;
  /** 断面中心（e 軸の座標） */
  pc: number;
  /** 内法幅（壁厚を除く） */
  wi: number;
  /** 進行軸に沿った区間 */
  a0: number;
  a1: number;
}

const cx = (r: Rect) => (r.x0 + r.x1) / 2;
const cz = (r: Rect) => (r.z0 + r.z1) / 2;

function segmentsOf(rects: Rect[]): Seg[] {
  const out: Seg[] = [];
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    let heading: Dir;
    if (i === 0) heading = r.z1 - r.z0 >= r.x1 - r.x0 ? 0 : 1;
    else {
      const q = rects[i - 1];
      const dx = cx(r) - cx(q);
      const dz = cz(r) - cz(q);
      heading = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 1 : 3) : dz > 0 ? 0 : 2;
    }
    const axis: 'x' | 'z' = heading === 0 || heading === 2 ? 'z' : 'x';
    const ex = heading === 0 ? 1 : heading === 2 ? -1 : 0;
    const ez = heading === 3 ? 1 : heading === 1 ? -1 : 0;
    const w = axis === 'z' ? r.x1 - r.x0 : r.z1 - r.z0;
    out.push({
      rect: r, heading, axis, ex, ez, pc: axis === 'z' ? cx(r) : cz(r), wi: Math.max(0.6, w - 2 * WALL_T),
      a0: axis === 'z' ? r.z0 : r.x0, a1: axis === 'z' ? r.z1 : r.x1,
    });
  }
  return out;
}

/** 点 (x, z) を含むセグメント（無ければ中心が最も近いもの） */
function segIndexAt(segs: Seg[], x: number, z: number): number {
  for (let i = 0; i < segs.length; i++) if (inRect(segs[i].rect, x, z, -0.05)) return i;
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < segs.length; i++) {
    const d = Math.hypot(cx(segs[i].rect) - x, cz(segs[i].rect) - z);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

/** 断面の非等方伸縮（内法幅 → h、高さ → 内法幅）。90° 回した後に内装が床・天井・側壁へぴたりと付くための前処理 */
function prescalePoint(seg: Seg, h: number, v: Vec3): Vec3 {
  const kx = h / seg.wi;
  const ky = seg.wi / h;
  const y = h / 2 + (v[1] - h / 2) * ky;
  return seg.axis === 'z' ? [seg.pc + (v[0] - seg.pc) * kx, y, v[2]] : [v[0], y, seg.pc + (v[2] - seg.pc) * kx];
}

/** 進行方向 f まわりに +90° × q 回す（(a, b) = (e 軸, 上) → (-b, a)） */
function rollPoint(seg: Seg, h: number, v: Vec3, q: number): Vec3 {
  let a = seg.axis === 'z' ? seg.ex * (v[0] - seg.pc) : seg.ez * (v[2] - seg.pc);
  let b = v[1] - h / 2;
  for (let i = 0; i < q; i++) { const na = -b; b = a; a = na; }
  return seg.axis === 'z' ? [seg.pc + seg.ex * a, h / 2 + b, v[2]] : [v[0], h / 2 + b, seg.pc + seg.ez * a];
}

/** RoomBuilder のロール（layout.roll / rollAxis / rollPivot）と同じ写像。inverse=true で逆変換 */
function builderRoll(axis: 'x' | 'z', pivot: Vec3, times: number, v: Vec3, inverse: boolean): Vec3 {
  let u = axis === 'z' ? v[0] - pivot[0] : v[2] - pivot[2];
  let y = v[1] - pivot[1];
  for (let i = 0; i < times; i++) {
    if (inverse) { const nu = y; y = -u; u = nu; } else { const nu = -y; y = u; u = nu; }
  }
  return axis === 'z' ? [u + pivot[0], y + pivot[1], v[2]] : [v[0], y + pivot[1], u + pivot[2]];
}

function mapBox(b: Box, f: (v: Vec3) => Vec3): Box {
  const a = f(b.min);
  const c = f(b.max);
  return { ...b, min: [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.min(a[2], c[2])], max: [Math.max(a[0], c[0]), Math.max(a[1], c[1]), Math.max(a[2], c[2])] };
}

const boxCenterXZ = (b: Box): [number, number] => [(b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2];

/**
 * 床扉の穴。旧床側（e 側）の壁に寄せた細長い穴。
 * 幅（断面方向）は 0.9〜1.1 m: プレイヤーの当たり判定（AABB 幅 0.7）より 0.2 m 以上広くないと隣の床箱に支えられて落ちられない
 * （検証で 0.7 m の穴は中心に立っても落ちなかった）。内法幅 wi からは「横に 1.0 m の通路を残す」幅とし、
 * 廊下幅は CorridorGenerator が 2.4 m 以上にクランプするので通常 1.1 m。真下の部屋の天井穴 1.4×1.4 に収まる
 */
function floorDoorHole(seg: Seg, pos: Vec3): AABB {
  const across = Math.round(Math.min(1.1, Math.max(0.9, seg.wi - 1.0)) * 100) / 100;
  const along = HOLE_SIZE;
  return seg.axis === 'z'
    ? aabbFromCenter(pos[0], 0, pos[2], across / 2, 0.2, along / 2)
    : aabbFromCenter(pos[0], 0, pos[2], along / 2, 0.2, across / 2);
}

/** 床扉の位置を決める（決定論）。長いセグメントの e 側の壁から 0.7 m（真下の天井穴 1.4 m が足跡内に収まる距離）に寄せる */
function placeFloorDoor(segs: Seg[], sockets: Socket[], rng: Rng): Socket | null {
  // 進行軸に沿った候補区間。角（次のセグメントとの接合部 = 幅 w の正方形）と前のセグメントとの接合部、入口・端の壁から離す
  const ranges = segs.map((seg, i) => {
    const w = seg.wi + 2 * WALL_T;
    const startMargin = i > 0 ? 1.7 : 2.6;
    const endMargin = i < segs.length - 1 ? w + 1.7 : 2.6;
    const forward = seg.heading === 0 || seg.heading === 1; // 進行方向が座標の + 側
    const lo = seg.a0 + (forward ? startMargin : endMargin);
    const hi = seg.a1 - (forward ? endMargin : startMargin);
    return { seg, lo, hi };
  });
  const eligible = ranges.filter((c) => c.hi - c.lo >= 2.0);
  if (eligible.length === 0) return null;
  for (let i = 0; i < 16; i++) {
    const { seg, lo, hi } = rng.pick(eligible);
    const t = Math.round(rng.float(lo, hi) * 10) / 10;
    const r = seg.rect;
    let x: number;
    let z: number;
    if (seg.axis === 'z') { x = seg.ex > 0 ? r.x1 - 0.7 : r.x0 + 0.7; z = t; }
    else { z = seg.ez > 0 ? r.z1 - 0.7 : r.z0 + 0.7; x = t; }
    if (!clearOfSockets(sockets, x, z, 2.4)) continue;
    return { id: 'hole', type: 'hole', pos: [x, 0, z], dir: 0, width: HOLE_SIZE, height: 0 };
  }
  return null;
}

/** 穴の縁の扉枠（trim）と蝶番（metal）。非ソリッド。床扉の見た目 */
function holeTrim(hole: AABB, seg: Seg, out: Box[]): void {
  const t = 0.08;
  const y0 = 0.0;
  const y1 = 0.03;
  const { min, max } = hole;
  out.push(box([min[0] - t, y0, min[2] - t], [max[0] + t, y1, min[2]], 'trim', false));
  out.push(box([min[0] - t, y0, max[2]], [max[0] + t, y1, max[2] + t], 'trim', false));
  out.push(box([min[0] - t, y0, min[2]], [min[0], y1, max[2]], 'trim', false));
  out.push(box([max[0], y0, min[2]], [max[0] + t, y1, max[2]], 'trim', false));
  // 蝶番は壁側（e 側）の長辺に 2 つ
  if (seg.axis === 'z') {
    const xh = seg.ex > 0 ? max[0] : min[0] - 0.05;
    for (const f of [0.2, 0.8]) {
      const z = min[2] + (max[2] - min[2]) * f;
      out.push(box([xh, y0, z - 0.06], [xh + 0.05, y1 + 0.02, z + 0.06], 'metal', false));
    }
  } else {
    const zh = seg.ez > 0 ? max[2] : min[2] - 0.05;
    for (const f of [0.2, 0.8]) {
      const x = min[0] + (max[0] - min[0]) * f;
      out.push(box([x - 0.06, y0, zh], [x + 0.06, y1 + 0.02, zh + 0.05], 'metal', false));
    }
  }
}

/** 開口の前（室内側 0.35 m）とスロット面を塞がないための除外領域 */
function openingZones(sockets: Socket[], holes: AABB[]): AABB[] {
  const zones: AABB[] = [];
  for (const s of sockets) {
    if (s.type === 'hole') continue;
    const y0 = s.pos[1] + (s.sill ?? 0) - 0.1;
    const y1 = s.pos[1] + (s.sill ?? 0) + s.height + 0.1;
    const half = s.width / 2 + 0.1;
    const depth = WALL_T + 0.35;
    switch (s.dir) {
      case 0: zones.push({ min: [s.pos[0] - half, y0, s.pos[2] - depth], max: [s.pos[0] + half, y1, s.pos[2] + 0.05] }); break;
      case 2: zones.push({ min: [s.pos[0] - half, y0, s.pos[2] - 0.05], max: [s.pos[0] + half, y1, s.pos[2] + depth] }); break;
      case 1: zones.push({ min: [s.pos[0] - depth, y0, s.pos[2] - half], max: [s.pos[0] + 0.05, y1, s.pos[2] + half] }); break;
      default: zones.push({ min: [s.pos[0] - 0.05, y0, s.pos[2] - half], max: [s.pos[0] + depth, y1, s.pos[2] + half] }); break;
    }
  }
  for (const hh of holes) zones.push({ min: [hh.min[0] - 0.15, -0.3, hh.min[2] - 0.15], max: [hh.max[0] + 0.15, 1.2, hh.max[2] + 0.15] });
  return zones;
}

// ---------------------------------------------------------------- 床扉パネル（build フック）

/** パネルの開き角（rad）。蝶番が壁面にあるので 90° で壁に沿って立つ（それ以上は壁へ食い込む） */
const FLOOR_DOOR_OPEN_RAD = Math.PI / 2;
/** 既存の扉と同じ開閉速度（angle 0→1 / 秒） */
const FLOOR_DOOR_SPEED = 2.2;
const FLOOR_DOOR_ID = 'GravityAxis/floorDoor';

/** 所有側の hole Portal（床扉）。無ければ null */
function floorDoorPortal(portals: Portal[]): Portal | null {
  return portals.find((p) => p.type === 'hole' && !p.isReturn) ?? null;
}

/**
 * 床扉のパネルを組む。蝶番は holeTrim と同じ壁側（e 側）の長辺。パネルは蝶番から穴の反対側の縁まで（周囲 1 cm の余白）、
 * 厚さ 6 cm（y −0.035〜0.025。trim の枡 0.03 のすぐ下に上面がくる）。ピボットは部屋ローカル座標（doorGroup は group と同じ変換）
 */
function buildFloorDoor(built: BuiltRoom, L: RoomLayout, ctx: BuildContext): void {
  const node = ctx.node;
  const placement = node.placement;
  if (!placement) return;
  const portal = floorDoorPortal(node.portals);
  if (!portal) return;
  const socket = L.sockets.find((s) => s.id === portal.socketId);
  if (!socket) return;
  const hole = L.holes.find((h) => aabbContains(h, [socket.pos[0], 0, socket.pos[2]], 0.05));
  if (!hole || L.footprint.length === 0) return;
  // 念のため（通常は onConnect で立っている。build は接続確定後に走る）
  if (!portal.covered) { portal.covered = true; portal.open = false; }

  const segs = segmentsOf(L.footprint);
  const cx = (hole.min[0] + hole.max[0]) / 2;
  const cz = (hole.min[2] + hole.max[2]) / 2;
  const seg = segs[segIndexAt(segs, cx, cz)];
  // 蝶番の位置と、蝶番から穴の内側へ向く単位ベクトル（水平）
  let hingePos: Vec3;
  let inward: Vec3;
  let across: number;
  let along: number;
  if (seg.axis === 'z') {
    const hx = seg.ex > 0 ? hole.max[0] : hole.min[0];
    hingePos = [hx, 0, cz];
    inward = [seg.ex > 0 ? -1 : 1, 0, 0];
    across = hole.max[0] - hole.min[0];
    along = hole.max[2] - hole.min[2];
  } else {
    const hz = seg.ez > 0 ? hole.max[2] : hole.min[2];
    hingePos = [cx, 0, hz];
    inward = [0, 0, seg.ez > 0 ? -1 : 1];
    across = hole.max[2] - hole.min[2];
    along = hole.max[0] - hole.min[0];
  }
  // 回転軸 h = inward × up。+θ で inward が上（+y）へ起き上がる
  const axis = new THREE.Vector3(...inward).cross(new THREE.Vector3(0, 1, 0)).normalize();
  const m = 0.01;
  const a0: Vec3 = [inward[0] * m, 0, inward[2] * m];
  const a1: Vec3 = [inward[0] * (across - m), 0, inward[2] * (across - m)];
  const hs = along / 2 - m;
  const panelBox: Box = {
    min: [Math.min(a0[0], a1[0]) - Math.abs(axis.x) * hs, -0.035, Math.min(a0[2], a1[2]) - Math.abs(axis.z) * hs],
    max: [Math.max(a0[0], a1[0]) + Math.abs(axis.x) * hs, 0.025, Math.max(a0[2], a1[2]) + Math.abs(axis.z) * hs],
    mat: L.palette.door,
    solid: false,
  };
  const legacy = L.render?.style === 'legacy';
  const geo = surfaceBox(panelBox, { legacy });
  geo.setAttribute('bakedLight', new THREE.Float32BufferAttribute(new Float32Array(geo.getAttribute('position').count * 3).fill(0.55), 3));
  const panel = new THREE.Mesh(geo, ctx.materials.get(L.palette.door));
  panel.name = FLOOR_DOOR_ID;
  panel.userData = { roomId: node.roomId, portalId: portal.portalId, kind: 'door' };
  const pivot = new THREE.Group();
  pivot.name = `${FLOOR_DOOR_ID}/pivot`;
  pivot.position.set(hingePos[0], hingePos[1], hingePos[2]);
  pivot.add(panel);
  // 所有部屋が非表示でも真下の部屋から見上げたときにパネルの裏が見えるよう、扉と同じく doorGroup に置く
  built.doorGroup.add(pivot);
  built.interactables.push(panel);

  // 上の廊下からだけ操作できる（真下の部屋から見上げて閉めると、上の部屋が非表示になって効果の更新が止まる）
  const hingeWorldY = placement.position[1] + hingePos[1];
  const meshRaycast = panel.raycast.bind(panel);
  panel.raycast = (raycaster, intersects) => {
    if (raycaster.ray.origin.y < hingeWorldY + 0.3) return;
    if (!node.portals.includes(portal)) return;
    meshRaycast(raycaster, intersects);
  };

  // 閉じている間のコライダ（穴と同じ xz、床の厚み）。開いたら solid を外して落ちる
  const spec: DynamicSpec = {
    id: FLOOR_DOOR_ID,
    box: { min: [hole.min[0], -0.2, hole.min[2]], max: [hole.max[0], 0, hole.max[2]], mat: L.palette.door, solid: true },
    motion: { kind: 'rotate', axis: [axis.x, axis.y, axis.z], amplitude: 0, period: 1, phase: 0 },
    solid: true,
  };
  const collider: DynamicCollider = { id: FLOOR_DOOR_ID, spec, mesh: panel, aabb: aabbToWorld(spec.box, placement), solid: !portal.open };
  built.dynamicColliders.push(collider);

  let angle = portal.open ? 1 : 0;
  const apply = () => {
    pivot.quaternion.setFromAxisAngle(axis, angle * FLOOR_DOOR_OPEN_RAD);
    collider.solid = angle < 0.5;
  };
  apply();
  const effect: RoomEffect = {
    update(dt, rc) {
      // Portal は接続失敗で取り除かれることがある（穴が塞がれ、部屋は rebuild される）。見つからなければ隠す
      const p = rc.node.portals.find((x) => x.portalId === portal.portalId && x.type === 'hole' && !x.isReturn);
      if (!p) {
        pivot.visible = false;
        collider.solid = false;
        return;
      }
      const target = p.open ? 1 : 0;
      if (angle === target) return;
      angle += Math.sign(target - angle) * Math.min(Math.abs(target - angle), dt * FLOOR_DOOR_SPEED);
      apply();
    },
    dispose() { /* Mesh は RoomBuilder.dispose の traverse（doorGroup）で解放 */ },
  };
  built.effects.push(effect);
}

const GravityAxis: ModifierImpl = {
  id: 'GravityAxis',
  defaults: { mode: 'fixed', upVector: [1, 0, 0], visualOnly: true, rollDeg: 90, floorDoors: 'hole', wallDoors: 'slot' },

  layout(L, p, params, rng) {
    const mode = str(params.mode, 'fixed');
    if (mode !== 'fixed') {
      console.info(`[GravityAxis] ${p.def.id}: mode '${mode}' は v1.3 オミット（E10）。何もしない`);
      return;
    }
    if (!bool(params.visualOnly, true)) console.info(`[GravityAxis] ${p.def.id}: visualOnly=false は未対応（D12）。見た目のロールだけ行う`);
    const rects = L.footprint;
    if (rects.length === 0 || L.shellCount === undefined) {
      console.warn(`[GravityAxis] ${p.def.id}: footprint / shellCount が無いので適用できない`);
      return;
    }
    const h = L.height;
    const q = ((Math.round(num(params.rollDeg, 90) / 90) % 4) + 4) % 4;
    const segs = segmentsOf(rects);
    const seg0 = segs[0];
    const extraIds = new Set(p.extraSockets.map((s) => s.id));

    // (2) 進行用の壁扉 → 横長スロット（crawl）。entry と直結用の extraSockets（相手側が通常扉）は通常扉のまま
    if (str(params.wallDoors, 'slot') === 'slot') {
      for (const s of L.sockets) {
        if (s.type !== 'door' || s.id === 'entry' || extraIds.has(s.id)) continue;
        // ソケットが載る矩形の辺の長さ（両端の側壁の厚みを除く）に収める
        const si = segIndexAt(segs, s.pos[0], s.pos[2]);
        const r = segs[si].rect;
        const edgeLen = s.dir === 0 || s.dir === 2 ? r.x1 - r.x0 : r.z1 - r.z0;
        const avail = Math.floor((edgeLen - 2 * WALL_T - 0.1) * 10 + 1e-6) / 10;
        s.width = Math.max(1.0, Math.min(SLOT_W, avail));
        s.height = Math.min(SLOT_H, h - SLOT_SILL - 0.1);
        s.sill = SLOT_SILL;
        s.crawl = true;
      }
    }

    // (3) 床の扉 = hole ソケット（真下の部屋へ落ちる）。生成器が holeLocal で固定した穴があればその位置を使い、形だけ扉型にする
    if (str(params.floorDoors, 'hole') === 'hole') {
      let hs = L.sockets.find((s) => s.type === 'hole');
      if (!hs && p.allowHole && !p.removedSockets.includes('hole')) {
        const placed = placeFloorDoor(segs, L.sockets, rng.fork('hole'));
        if (placed) {
          L.sockets.push(placed);
          hs = placed;
        }
      }
      if (hs) L.holes = [floorDoorHole(segs[segIndexAt(segs, hs.pos[0], hs.pos[2])], hs.pos)];
    }

    // (1) 内装のロール。q=0 なら回さない（スロット・床扉だけ）
    const shellCount = L.shellCount;
    const interior = L.boxes.slice(shellCount);
    const manual: Box[] = [];
    const auto: Box[] = [];
    const swap = q % 2 === 1;
    const axis = seg0.axis;
    const pivot: Vec3 = axis === 'z' ? [seg0.pc, h / 2, 0] : [0, h / 2, seg0.pc];
    // RoomBuilder の (u, y) → (-y, u) は heading 0（axis z）/ heading 3（axis x）の +90° に一致。逆向きの heading では回数を反転する
    const builderTimes = q === 0 ? 0 : seg0.heading === 0 || seg0.heading === 3 ? q : (4 - q) % 4;
    const isAuto = (seg: Seg) => seg.heading === seg0.heading && Math.abs(seg.pc - seg0.pc) < 0.01;
    const pre = (seg: Seg, v: Vec3) => (swap ? prescalePoint(seg, h, v) : v);
    const finalPoint = (seg: Seg, v: Vec3) => rollPoint(seg, h, pre(seg, v), q);

    if (q !== 0) {
      for (const b of interior) {
        const [bx, bz] = boxCenterXZ(b);
        const seg = segs[segIndexAt(segs, bx, bz)];
        if (isAuto(seg)) auto.push(mapBox(b, (v) => pre(seg, v)));
        else manual.push(mapBox(b, (v) => finalPoint(seg, v)));
      }
      // 照明・ラベル・サインは RoomBuilder が全数を回す。手で回すセグメントの分は RoomBuilder のロールの逆変換を掛けて格納する
      const place = (v: Vec3): Vec3 => {
        const seg = segs[segIndexAt(segs, v[0], v[2])];
        if (isAuto(seg)) return pre(seg, v);
        return builderRoll(axis, pivot, builderTimes, finalPoint(seg, v), true);
      };
      for (const l of L.lights) l.pos = place(l.pos);
      for (const lb of L.labels) lb.pos = place(lb.pos);
      for (const sg of L.signs ?? []) sg.pos = place(sg.pos);
    } else {
      auto.push(...interior);
    }

    // 開口（スロット・扉・床扉）を塞ぐ内装は捨てる。auto の箱は RoomBuilder のロール後の位置で判定する
    const zones = openingZones(L.sockets, L.holes);
    const blocked = (b: Box) => zones.some((z) => aabbOverlap(b, z, 0.005));
    const manualKept = manual.filter((b) => !blocked(b));
    const autoKept = auto.filter((b) => !blocked(mapBox(b, (v) => builderRoll(axis, pivot, builderTimes, v, false))));

    // 床扉の枠（回さない領域に置く）
    for (const hh of L.holes) {
      const seg = segs[segIndexAt(segs, (hh.min[0] + hh.max[0]) / 2, (hh.min[2] + hh.max[2]) / 2)];
      holeTrim(hh, seg, manualKept);
    }

    // (4) 外殻の組み直し（スロット開口・床穴を反映）
    const entry = L.sockets.find((s) => s.id === 'entry');
    const ceilingHoles: AABB[] = entry && entry.type === 'hole' ? [aabbFromCenter(entry.pos[0], h + 0.1, entry.pos[2], HOLE_SIZE / 2, 0.2, HOLE_SIZE / 2)] : [];
    const shell: Box[] = [];
    buildShell(shell, rects, h, L.sockets, { floor: L.palette.floor, wall: L.palette.wall, ceiling: L.palette.ceiling, floorHoles: L.holes, ceilingHoles });
    L.boxes = [...shell, ...manualKept, ...autoKept];
    L.shellCount = shell.length;
    if (q !== 0) {
      L.roll = builderTimes as 0 | 1 | 2 | 3;
      L.rollAxis = axis;
      L.rollPivot = pivot;
      L.rollFrom = shell.length + manualKept.length;
    }
  },

  /** 床扉の hole Portal を「扉パネル付きの穴」にする（閉じた状態で始まる）。接続抽選への指示は出さない */
  onConnect(ctx) {
    if (str(ctx.params.mode, 'fixed') !== 'fixed' || str(ctx.params.floorDoors, 'hole') !== 'hole') return;
    const p = ctx.portal;
    if (p.type !== 'hole' || p.isReturn || p.covered) return;
    p.covered = true;
    p.open = false;
  },

  /** 床扉のパネル・コライダ・開閉アニメーション */
  build(built, L, ctx) {
    if (str(ctx.params.mode, 'fixed') !== 'fixed' || str(ctx.params.floorDoors, 'hole') !== 'hole') return;
    buildFloorDoor(built, L, ctx);
  },
};

export default GravityAxis;
