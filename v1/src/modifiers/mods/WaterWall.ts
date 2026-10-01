/**
 * WaterWall — 垂直水面オフィス（E09）。params: height(m。既定 3), flow(UV の流れ。見た目のみ)。
 *
 * 出口扉の 1 つを「水の壁」にする。Portal は通常の door として接続されるので配置・進行保証・施錠の扱いは変わらない。
 *  - layout（決定論）:
 *      候補 = 生成器の出口ソケット（exit*。entry / extra / crawl / sill 付きは除く）。候補と removedSockets（過去に壁へ戻した exit*）の
 *      和集合から rng で 1 本選び、選んだものが removedSockets にあれば水壁なし（配置失敗時は壁へ戻し、別ソケットを再選択しない）。
 *      選んだソケットの開口を 幅 2.2 m（壁区間に収まらなければ 1.0 のまま）× 高さ min(height, h-0.3) に広げ、シェル（床・天井・外壁）を
 *      buildShell で組み直す（シェル範囲にあった補助箱 = 着地目印などは残す）。開口の内側の床に濡れ箔、上端に暗い縁。L.waterWalls に記録。
 *      外壁の全面に流れ落ちる水の膜（waterFilm。壁の箱を 1.2 cm 包む非ソリッドの半透明の板。第22回）。
 *  - build:
 *      該当 Portal が施錠 / Seam / ride なら何もしない（通常扉のまま）。それ以外は扉パネルとノブを非表示にし、インタラクト対象から外し、
 *      Portal を常時開（open=true。自動閉扉の passedAt も消す）にして、開口の壁厚中央に 'waterWall' 材質の 1 枚板（非ソリッド・透過・両面）を置く。
 *      RoomEffect: 毎フレーム open を維持し、プレイヤーが板の面を越えた瞬間に水音（'waterFlow' 3 秒）と HUD ヒント。
 *  - onEnter / onExit: 水壁の位置に低い水圧音のビーコン（'waterPressure'）。
 *  - canOpen: 水壁の Portal は常に { ok: true }（施錠扱いにしない）。
 * 前提: 屈折・水中音・青いフェードは無し。コライダ無しで歩いて抜ける。板の先は通常抽選。
 */
import * as THREE from 'three';
import { aabbFromCenter } from '../../core/aabb';
import { addDir, dirVec, toWorld, type Socket, type Vec3 } from '../../core/types';
import { buildShell, spanForSocket, wallSpans, along } from '../../generators/footprint';
import { box, DOOR_W, HOLE_SIZE, WIDE_W, type Box, type RoomLayout, type WaterWallSpec } from '../../generators/layout';
import { SURFACES } from '../../render/MaterialLibrary';
import type { BuiltRoom, RoomEffect } from '../../render/RoomBuilder';
import type { AudioEngineLike, ModifierImpl, RuntimeContext } from '../types';
import { num } from '../util';

/** 開口を広げるときの壁端・隣ソケットからの余白（m） */
const SPAN_MARGIN = 0.3;
/** 板の壁厚方向の位置（外面から内側へ。扉パネルと同じ 0.075） */
const PLANE_INSET = 0.075;
/** 壁の水膜と壁面の隙間（m） */
const FILM_GAP = 0.012;
/** ビーコン（部屋ごと） */
const beacons = new Map<string, ReturnType<AudioEngineLike['play']>>();

function isExitId(id: string): boolean {
  return /^exit\d+$/.test(id);
}

/** 選んだソケットの開口を 2.2 m に広げられるか（壁区間の端・同じ壁の他ソケットと干渉しない） */
function canWiden(L: RoomLayout, s: Socket, width: number): boolean {
  const span = spanForSocket(wallSpans(L.footprint), s);
  if (!span) return false;
  const t = along(s.dir, s.pos[0], s.pos[2]);
  if (t - width / 2 < span.a0 + SPAN_MARGIN || t + width / 2 > span.a1 - SPAN_MARGIN) return false;
  for (const o of L.sockets) {
    if (o === s || o.dir !== s.dir || o.type === 'hole') continue;
    const oc = o.dir === 0 || o.dir === 2 ? o.pos[2] : o.pos[0];
    const sc = s.dir === 0 || s.dir === 2 ? s.pos[2] : s.pos[0];
    if (Math.abs(oc - sc) > 0.05) continue;
    if (Math.abs(along(o.dir, o.pos[0], o.pos[2]) - t) < (o.width + width) / 2 + SPAN_MARGIN) return false;
  }
  return true;
}

/** シェル（床・天井・外壁）を現在のソケットで組み直す。シェル範囲にあったシェル材以外の箱（着地目印など）は残す */
function rebuildShell(L: RoomLayout): void {
  const shellCount = L.shellCount ?? 0;
  const old = L.boxes.slice(0, shellCount);
  const rest = L.boxes.slice(shellCount);
  const pal = L.palette;
  const extras = old.filter((b) => b.mat !== pal.floor && b.mat !== pal.wall && b.mat !== pal.ceiling);
  const entry = L.sockets.find((s) => s.id === 'entry');
  const ceilingHoles = entry && entry.type === 'hole' ? [aabbFromCenter(entry.pos[0], L.height + 0.1, entry.pos[2], HOLE_SIZE / 2, 0.2, HOLE_SIZE / 2)] : [];
  const shell: Box[] = [];
  buildShell(shell, L.footprint, L.height, L.sockets, { floor: pal.floor, wall: pal.wall, ceiling: pal.ceiling, floorHoles: L.holes, ceilingHoles });
  shell.push(...extras);
  L.boxes.length = 0;
  L.boxes.push(...shell, ...rest);
  L.shellCount = shell.length;
}

/** 水壁ソケット → 部屋ローカルの板の中心・向き */
function planeLocal(s: Socket): { center: Vec3; yaw: number } {
  const out = dirVec(s.dir);
  return { center: [s.pos[0] - out[0] * PLANE_INSET, s.pos[1] + s.height / 2, s.pos[2] - out[2] * PLANE_INSET], yaw: (s.dir * Math.PI) / 2 };
}

/** 水面の板（幅 w × 高さ h。法線 ±Z、UV は材質のメートル基準） */
function planeGeometry(w: number, h: number): THREE.BufferGeometry {
  const m = SURFACES.waterWall.meters;
  const pos = new Float32Array([-w / 2, -h / 2, 0, w / 2, -h / 2, 0, w / 2, h / 2, 0, -w / 2, h / 2, 0]);
  const nrm = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
  const uv = new Float32Array([0, 0, w / m, 0, w / m, h / m, 0, h / m]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('bakedLight', new THREE.Float32BufferAttribute(new Float32Array(12).fill(0.45), 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeBoundingSphere();
  return g;
}

interface WaterPortalInfo {
  spec: WaterWallSpec;
  socket: Socket;
}

function waterPortalOf(L: RoomLayout): WaterPortalInfo | null {
  const spec = L.waterWalls?.[0];
  if (!spec) return null;
  const socket = L.sockets.find((s) => s.id === spec.socketId);
  return socket ? { spec, socket } : null;
}

/** ビルド済み部屋で実際に水壁になった Portal の id（施錠 / Seam / ride は通常扉のまま） */
function activePortalId(ctx: RuntimeContext): string | null {
  const info = waterPortalOf(ctx.layout);
  if (!info) return null;
  const portal = ctx.node.portals.find((p) => p.socketId === info.socket.id && !p.isReturn);
  if (!portal || portal.locked || portal.seam || portal.ride) return null;
  return portal.portalId;
}

/** 出口の 1 つを水壁にする（開口を広げ、シェルを組み直し、濡れ箔と上端の暗い縁、前の家具を除く） */
function layoutWaterDoor(...[L, p, params, rng]: Parameters<NonNullable<ModifierImpl['layout']>>): void {
  const wantH = num(params.height, 3);
  const flow = num(params.flow, 1);
  const present = L.sockets.filter((s) => s.type === 'door' && isExitId(s.id) && !s.crawl && !(s.sill ?? 0));
  const union = new Set<string>([...present.map((s) => s.id), ...p.removedSockets.filter(isExitId)]);
  if (union.size === 0) return;
  const ids = [...union].sort((a, b) => parseInt(a.slice(4), 10) - parseInt(b.slice(4), 10));
  const chosen = rng.pick(ids);
  const s = present.find((x) => x.id === chosen);
  // 過去に壁へ戻したソケットが選ばれた: 水壁なし（別ソケットを再選択しない = 入室後に開口が変わらない）
  if (!s) return;
  const height = Math.max(2.1, Math.min(wantH, L.height - 0.3));
  const width = canWiden(L, s, WIDE_W) ? WIDE_W : DOOR_W;
  if (Math.abs(s.height - height) > 1e-6 || Math.abs(s.width - width) > 1e-6) {
    s.height = height;
    s.width = width;
    rebuildShell(L);
  }
  L.waterWalls = [{ socketId: s.id, height, flow }];
  // 開口の内側: 床の濡れ箔（幅 +1.0 m、奥行き 1.4 m）と上端の暗い縁（壁面に貼る）
  const out = dirVec(s.dir);
  const inward: Vec3 = [-out[0], 0, -out[2]];
  const cx = s.pos[0] + inward[0] * 0.75;
  const cz = s.pos[2] + inward[2] * 0.75;
  const alongX = s.dir === 0 || s.dir === 2; // 壁が X 軸に平行（開口幅が X 方向）
  const hw = width / 2 + 0.5;
  L.boxes.push(alongX
    ? box([cx - hw, 0.0, cz - 0.7], [cx + hw, 0.008, cz + 0.7], 'waterShallow', false)
    : box([cx - 0.7, 0.0, cz - hw], [cx + 0.7, 0.008, cz + hw], 'waterShallow', false));
  const lx = s.pos[0] + inward[0] * 0.16;
  const lz = s.pos[2] + inward[2] * 0.16;
  const top = Math.min(L.height - 0.02, height + 0.3);
  if (top > height + 0.05) {
    L.boxes.push(alongX
      ? box([lx - width / 2 - 0.15, height, lz - 0.01], [lx + width / 2 + 0.15, top, lz + 0.01], 'wallDark', false)
      : box([lx - 0.01, height, lz - width / 2 - 0.15], [lx + 0.01, top, lz + width / 2 + 0.15], 'wallDark', false));
  }
  // 水壁の前は空けておく（家具が水面に刺さらないように）
  const shell = L.shellCount ?? 0;
  const keep = L.boxes.slice(0, shell);
  for (const b of L.boxes.slice(shell)) {
    const nearX = alongX ? b.max[0] > s.pos[0] - hw && b.min[0] < s.pos[0] + hw : b.max[0] > cx - 1.6 && b.min[0] < cx + 1.6;
    const nearZ = alongX ? b.max[2] > cz - 1.6 && b.min[2] < cz + 1.6 : b.max[2] > s.pos[2] - hw && b.min[2] < s.pos[2] + hw;
    if (b.solid && b.min[1] < 1.5 && nearX && nearZ) continue;
    keep.push(b);
  }
  L.boxes.length = 0;
  L.boxes.push(...keep);
}

/** 外壁の全面に流れ落ちる水の膜（水壁の有無によらない。第22回） */
function addWallFilms(L: RoomLayout): void {
  // 壁一面を流れ落ちる水の膜（第22回。「垂直水面」の部屋なのに、水は出口の 1 枚だけで他はただの壁に見えていた）:
  // シェルの外壁の箱を厚み方向に 1.2 cm ずつ包む薄い板（非ソリッド・半透明の waterFilm）。開口は壁の箱が分かれているので空いたまま
  const wallMat = L.palette.wall;
  for (const b of L.boxes.slice(0, L.shellCount ?? 0)) {
    if (b.mat !== wallMat || b.max[1] - b.min[1] < 1.5) continue;
    const sx = b.max[0] - b.min[0], sz = b.max[2] - b.min[2];
    if (Math.min(sx, sz) > 0.5 || Math.max(sx, sz) < 0.3) continue;
    const ax = sx < sz ? 0 : 2; // 厚み方向
    const min: Vec3 = [b.min[0], Math.max(b.min[1], 0) + 0.01, b.min[2]];
    const max: Vec3 = [b.max[0], Math.min(b.max[1], L.height) - 0.01, b.max[2]];
    min[ax] -= FILM_GAP; max[ax] += FILM_GAP;
    if (max[1] - min[1] < 1) continue;
    L.boxes.push(box(min, max, 'waterFilm', false));
  }
}

const WaterWall: ModifierImpl = {
  id: 'WaterWall',
  defaults: { height: 3, flow: 1 },

  layout(L, p, params, rng) {
    layoutWaterDoor(L, p, params, rng);
    addWallFilms(L);
  },

  build(built: BuiltRoom, L, ctx) {
    const info = waterPortalOf(L);
    if (!info) return;
    const { socket } = info;
    const portal = ctx.node.portals.find((p) => p.socketId === socket.id && !p.isReturn);
    // 施錠（行き止まり）/ 意図的 Seam / 乗車は通常扉のまま
    if (!portal || portal.locked || portal.seam || portal.ride) return;
    const door = built.doors.get(portal.portalId);
    if (door) {
      for (const c of door.pivot.children) c.visible = false;
      door.panel.visible = false;
      const i = built.interactables.indexOf(door.panel);
      if (i >= 0) built.interactables.splice(i, 1);
      door.angle = 1;
      door.pivot.rotation.y = -(Math.PI / 2) * 0.95;
    }
    portal.open = true;
    portal.passedAt = undefined;

    // 水面の板（部屋ローカル。開口の壁厚中央）
    const { center, yaw } = planeLocal(socket);
    const mesh = new THREE.Mesh(planeGeometry(socket.width + 0.04, socket.height + 0.02), ctx.materials.get('waterWall'));
    mesh.position.set(center[0], center[1], center[2]);
    mesh.rotation.y = yaw;
    mesh.renderOrder = 2;
    mesh.name = `waterWall/${socket.id}`;
    built.group.add(mesh);

    // 通過判定用のワールド座標
    const p = ctx.node.placement!;
    const wpos = toWorld(p, socket.pos);
    const wdir = dirVec(addDir(socket.dir, p.yawQ));
    const halfW = socket.width / 2 + 0.3;
    let prevAlong: number | null = null;
    const effect: RoomEffect = {
      update(_dt, rctx) {
        // 常時開（Game.enterRoom の passedAt による自動閉扉を打ち消す）
        if (!portal.open) portal.open = true;
        if (portal.passedAt !== undefined) portal.passedAt = undefined;
        const feet = rctx.player.pos;
        const dx = feet[0] - wpos[0];
        const dz = feet[2] - wpos[2];
        const alongD = dx * wdir[0] + dz * wdir[2];
        const across = dx * wdir[2] - dz * wdir[0];
        const inGate = Math.abs(across) < halfW && Math.abs(feet[1] - wpos[1]) < socket.height && Math.abs(alongD) < 1.0;
        if (inGate && prevAlong !== null && Math.sign(alongD) !== Math.sign(prevAlong) && alongD !== 0) {
          rctx.audio?.play('waterFlow', { pos: [wpos[0], wpos[1] + 1.2, wpos[2]], gain: 0.7, silentLog: true });
          rctx.hud.hint('水の壁を抜けた');
        }
        prevAlong = inGate ? alongD : null;
      },
      dispose() { /* Mesh は RoomBuilder.dispose の traverse で解放 */ },
    };
    built.effects.push(effect);
  },

  onEnter(ctx) {
    const audio = ctx.audio;
    if (!audio || !ctx.node.placement) return;
    if (!activePortalId(ctx)) return;
    const info = waterPortalOf(ctx.layout)!;
    const prev = beacons.get(ctx.node.roomId);
    if (prev?.active) return;
    const wpos = toWorld(ctx.node.placement, info.socket.pos);
    beacons.set(ctx.node.roomId, audio.beacon('waterPressure', [wpos[0], wpos[1] + 1.2, wpos[2]], 0.8));
    ctx.hud.hint('壁の一枚が水になっている');
  },

  onExit(ctx) {
    const h = beacons.get(ctx.node.roomId);
    if (h) {
      h.stop(1.0);
      beacons.delete(ctx.node.roomId);
    }
  },

  canOpen(portal, ctx) {
    const id = activePortalId(ctx);
    if (id && portal.portalId === id) return { ok: true };
    return;
  },
};

export default WaterWall;
