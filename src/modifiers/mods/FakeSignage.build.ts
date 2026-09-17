/**
 * FakeSignage の build / update 側（Three.js を触る部分）。layout 側（FakeSignage.ts）が置いたマーカー箔を探して Mesh を足す。
 *  - U06 fixedTime: アナログ時計。文字盤（CanvasTexture 1 枚。針は 3:17 で固定描画）+ 秒針 Mesh（RoomEffect が回転だけ更新）。
 *  - R10 flightBoard: 出発案内板（CanvasTexture 1024×512、両面 2 枚の平面）。行先は接続先の部屋名が要るので、
 *    最初の update（RuntimeContext.world が使える）で 1 回だけ描き込む。node.seed 由来の Rng で決定論。
 * ジオメトリは構築時に 1 度だけ足す（入室後に増えない）。テクスチャ・材質は Mesh の userData.disposable で RoomBuilder.dispose が解放する。
 */
import * as THREE from 'three';
import { Rng } from '../../core/rng';
import type { Dir, Vec3 } from '../../core/types';
import { dirVec } from '../../core/types';
import { ROOM_BY_ID, ROOMS } from '../../data';
import type { Box, RoomLayout } from '../../generators/layout';
import type { BuiltRoom, RoomEffect } from '../../render/RoomBuilder';
import type { RuntimeContext } from '../types';
import { centerOf, opposite, sizeOf } from './FakeSignage.common';

// ---------------------------------------------------------------- マーカー（layout 側と共有する寸法）

/** アナログ時計の裏板（非 solid furnitureDark、0.56 × 0.56、厚 0.03） */
export const ANALOG_BACK = 0.56;
export const ANALOG_BACK_T = 0.03;
/** 出発案内板の裏板（非 solid furnitureDark、幅 1.6 × 高 0.9 × 厚 0.08、床から 2.3 m 以上） */
export const BOARD_W = 1.6;
export const BOARD_H = 0.9;
export const BOARD_T = 0.08;

function near(a: number, b: number, eps = 0.02): boolean {
  return Math.abs(a - b) < eps;
}

/** 薄い箔の表面が向く方向（薄い軸で、footprint の最も近い辺の反対 = 室内側）。壁から離れた両面の板は null */
function facingOf(L: RoomLayout, b: Box): Dir | null {
  const [sx, , sz] = sizeOf(b);
  const c = centerOf(b);
  const thinX = sx < sz;
  let best: { dir: Dir; d: number } | null = null;
  for (const r of L.footprint) {
    const cands: { dir: Dir; coord: number }[] = thinX ? [{ dir: 1, coord: r.x1 }, { dir: 3, coord: r.x0 }] : [{ dir: 0, coord: r.z1 }, { dir: 2, coord: r.z0 }];
    for (const k of cands) {
      const d = Math.abs((thinX ? c[0] : c[2]) - k.coord);
      if (d < 0.5 && (!best || d < best.d)) best = { dir: opposite(k.dir), d };
    }
  }
  return best?.dir ?? null;
}

function quatFacing(dir: Dir): THREE.Quaternion {
  return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (dir * Math.PI) / 2);
}

// ---------------------------------------------------------------- U06 アナログ時計

function drawDial(canvas: HTMLCanvasElement, hour: number, minute: number): void {
  const g = canvas.getContext('2d')!;
  const S = canvas.width;
  const c = S / 2;
  g.clearRect(0, 0, S, S);
  g.fillStyle = '#f4f2ea';
  g.beginPath();
  g.arc(c, c, c - 4, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#22252b';
  g.lineWidth = 6;
  g.stroke();
  // 目盛り
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const r0 = i % 5 === 0 ? c - 26 : c - 16;
    g.lineWidth = i % 5 === 0 ? 4 : 2;
    g.beginPath();
    g.moveTo(c + Math.sin(a) * r0, c - Math.cos(a) * r0);
    g.lineTo(c + Math.sin(a) * (c - 10), c - Math.cos(a) * (c - 10));
    g.stroke();
  }
  g.fillStyle = '#22252b';
  g.font = `bold ${Math.round(S * 0.11)}px sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const [n, a] of [[12, 0], [3, Math.PI / 2], [6, Math.PI], [9, (Math.PI * 3) / 2]] as [number, number][]) {
    g.fillText(String(n), c + Math.sin(a) * (c - 52), c - Math.cos(a) * (c - 52));
  }
  // 針（固定）
  const hand = (angle: number, len: number, w: number) => {
    g.lineWidth = w;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(c - Math.sin(angle) * 14, c + Math.cos(angle) * 14);
    g.lineTo(c + Math.sin(angle) * len, c - Math.cos(angle) * len);
    g.stroke();
  };
  g.strokeStyle = '#22252b';
  hand(((hour % 12) / 12 + minute / 720) * Math.PI * 2, c * 0.5, 9);
  hand((minute / 60) * Math.PI * 2, c * 0.74, 6);
  g.fillStyle = '#22252b';
  g.beginPath();
  g.arc(c, c, 8, 0, Math.PI * 2);
  g.fill();
}

/** 文字盤 + 秒針を裏板マーカーごとに置き、秒針を回す RoomEffect を返す（マーカーが無ければ null） */
export function addAnalogClocks(built: BuiltRoom, L: RoomLayout, time: { hour: number; minute: number }): RoomEffect | null {
  const markers = L.boxes.slice(L.shellCount ?? 0).filter((b) => {
    if (b.solid || b.mat !== 'furnitureDark') return false;
    const [sx, sy, sz] = sizeOf(b);
    return near(sy, ANALOG_BACK) && near(Math.max(sx, sz), ANALOG_BACK) && near(Math.min(sx, sz), ANALOG_BACK_T);
  });
  if (markers.length === 0) return null;
  const hands: { pivot: THREE.Group; phase: number }[] = [];
  for (const m of markers) {
    const dir = facingOf(L, m);
    if (dir === null) continue;
    const c = centerOf(m);
    const n = dirVec(dir);
    const [sx, , sz] = sizeOf(m);
    const half = Math.min(sx, sz) / 2;
    const q = quatFacing(dir);
    // 文字盤
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    drawDial(canvas, time.hour, time.minute);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false });
    const dial = new THREE.Mesh(new THREE.PlaneGeometry(ANALOG_BACK - 0.04, ANALOG_BACK - 0.04), mat);
    const face: Vec3 = [c[0] + n[0] * (half + 0.006), c[1], c[2] + n[2] * (half + 0.006)];
    dial.position.set(face[0], face[1], face[2]);
    dial.quaternion.copy(q);
    dial.userData.disposable = [tex, mat];
    built.group.add(dial);
    // 秒針。向き（quaternion）は外側の Group に、回転は内側の spin Group の rotation.z（+Z = 面の法線）に分ける
    //（同じ Object3D で quaternion と rotation.z を混ぜると Euler 分解で向きが崩れる）
    const mount = new THREE.Group();
    mount.position.set(c[0] + n[0] * (half + 0.014), c[1], c[2] + n[2] * (half + 0.014));
    mount.quaternion.copy(q);
    const pivot = new THREE.Group();
    const handMat = new THREE.MeshBasicMaterial({ color: 0xc8302a, toneMapped: false });
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.24, 0.004), handMat);
    hand.position.set(0, 0.09, 0); // 尾 0.03 / 先 0.21
    hand.userData.disposable = [handMat];
    pivot.add(hand);
    mount.add(pivot);
    built.group.add(mount);
    hands.push({ pivot, phase: Math.random() * 60 });
  }
  if (hands.length === 0) return null;
  let t = 0;
  return {
    update(dt) {
      t += dt;
      for (const h of hands) h.pivot.rotation.z = -(((t + h.phase) % 60) / 60) * Math.PI * 2;
    },
    dispose() {
      hands.length = 0;
    },
  };
}

// ---------------------------------------------------------------- R10 出発案内板

interface BoardState {
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  filled: boolean;
  gateCount: number;
}

const boards = new WeakMap<BuiltRoom, BoardState>();

const STATUS = ['定刻', '搭乗中', '遅延', '定刻', '最終案内', '欠航', '定刻', '---'];

function drawBoard(canvas: HTMLCanvasElement, rows: { time: string; flight: string; dest: string; gate: string; status: string }[]): void {
  const g = canvas.getContext('2d')!;
  const W = canvas.width;
  const H = canvas.height;
  g.fillStyle = '#0b0f14';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#ffc040';
  g.font = 'bold 40px sans-serif';
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  g.fillText('出発 DEPARTURES', 32, 40);
  g.fillStyle = '#8899aa';
  g.font = '24px sans-serif';
  const cols = [32, 170, 340, 760, 880];
  const heads = ['時刻', '便名', '行先', 'ゲート', '備考'];
  heads.forEach((h, i) => g.fillText(h, cols[i], 88));
  g.fillStyle = '#334455';
  g.fillRect(24, 106, W - 48, 2);
  g.font = 'bold 30px "Courier New", monospace';
  rows.forEach((r, i) => {
    const y = 138 + i * 44;
    g.fillStyle = r.status === '欠航' ? '#ff6a5a' : r.status === '遅延' ? '#ffd060' : '#e8f0e8';
    g.fillText(r.time, cols[0], y);
    g.fillText(r.flight, cols[1], y);
    g.font = 'bold 28px sans-serif';
    g.fillText(r.dest, cols[2], y, 400);
    g.font = 'bold 30px "Courier New", monospace';
    g.fillText(r.gate, cols[3], y);
    g.font = '26px sans-serif';
    g.fillText(r.status, cols[4], y);
    g.font = 'bold 30px "Courier New", monospace';
  });
}

/** 裏板マーカーの両面に案内板の平面を置く（内容は最初の update で描く） */
export function addFlightBoards(built: BuiltRoom, L: RoomLayout, gateCount: number): void {
  const marker = L.boxes.slice(L.shellCount ?? 0).find((b) => {
    if (b.solid || b.mat !== 'furnitureDark' || b.min[1] < 2.0) return false;
    const [sx, sy, sz] = sizeOf(b);
    return near(sy, BOARD_H) && near(Math.max(sx, sz), BOARD_W) && near(Math.min(sx, sz), BOARD_T);
  });
  if (!marker) return;
  const c = centerOf(marker);
  const [sx, , sz] = sizeOf(marker);
  const thinX = sx < sz;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  drawBoard(canvas, Array.from({ length: 8 }, () => ({ time: '--:--', flight: '-------', dest: '', gate: '-', status: '' })));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  const faces: Dir[] = thinX ? [1, 3] : [0, 2];
  faces.forEach((dir, i) => {
    const n = dirVec(dir);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_W - 0.1, (BOARD_W - 0.1) / 2), mat);
    mesh.position.set(c[0] + n[0] * (BOARD_T / 2 + 0.006), c[1], c[2] + n[2] * (BOARD_T / 2 + 0.006));
    mesh.quaternion.copy(quatFacing(dir));
    if (i === 0) mesh.userData.disposable = [texture, mat];
    built.group.add(mesh);
  });
  boards.set(built, { canvas, texture, filled: false, gateCount: Math.max(1, gateCount) });
}

/** 接続先の部屋名を混ぜて案内板を 1 回だけ描く（truthRatio の行だけ実接続先。ゲート列も半分だけ正しい） */
export function fillFlightBoards(ctx: RuntimeContext, truthRatio: number): void {
  const st = ctx.built ? boards.get(ctx.built) : undefined;
  if (!st || st.filled) return;
  const graph = ctx.world.graph;
  // 進行用 Portal（戻り以外）の接続先。Adapter（前室 / 階段）は 1〜2 段たどる
  const real: { name: string; gate: number }[] = [];
  let gateIdx = 0;
  for (const po of ctx.node.portals) {
    if (po.isReturn || po.type === 'hole') continue;
    const g = gateIdx++;
    let id = po.targetRoomId;
    for (let hop = 0; hop < 3 && id && graph.has(id) && graph.get(id).isAdapter; hop++) {
      id = graph.get(id).portals.find((q) => !q.isReturn && q.targetRoomId)?.targetRoomId;
    }
    if (!id || !graph.has(id)) continue;
    const n = graph.get(id);
    if (n.isAdapter) continue;
    const def = ROOM_BY_ID.get(n.definitionId);
    if (def) real.push({ name: def.name, gate: g });
  }
  const rng = new Rng(ctx.node.seed).fork('mod:FakeSignage:board');
  const realNames = new Set(real.map((r) => r.name));
  const others = ROOMS.filter((r) => !realNames.has(r.name));
  const letters = 'ABCDEFGH';
  let minutes = 3 * 60 + 17;
  const rows = Array.from({ length: 8 }, (_, i) => {
    const truthful = real.length > 0 && rng.chance(truthRatio);
    const r = truthful ? real[i % real.length] : null;
    const dest = r ? r.name : (others.length ? rng.pick(others).name : '—');
    const gate = r && rng.chance(0.5) ? letters[r.gate % letters.length] : letters[rng.int(0, st.gateCount - 1) % letters.length];
    const time = `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    minutes += rng.int(7, 23);
    return { time, flight: `LM ${rng.int(1000, 9999)}`, dest, gate, status: STATUS[rng.int(0, STATUS.length - 1)] };
  });
  drawBoard(st.canvas, rows);
  st.texture.needsUpdate = true;
  st.filled = true;
}
