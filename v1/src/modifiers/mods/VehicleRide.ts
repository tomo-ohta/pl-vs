/**
 * VehicleRide — 乗り物で別ノードへ（E11 浮遊列車 / L02 ボート / L11 モノレール）。v1.3 D16（Q5 = C）。
 * params: vehicleType('train' | 'boat' | 'monorail'), durationSec, skipAfterSec, shake。
 *
 * 流れ:
 *   layout     進行用の通常扉ソケット 1 つを乗車口に選び（VehicleRide.vehicle.ts の pickRideSocket。決定論）、
 *              その壁の外側に車両（Box 合成）・車外の暗幕・足元の暗い面を置く。L.rides に RideSpec、L.zones に 'ride' ゾーンを追加し、
 *              L.bounds を車両領域まで広げる（fits() が他の部屋をそこへ置かないように）。
 *   onConnect  乗車ソケットの Portal に ride = true を立て、{ seam: true } を返す（WorldManager は物理配置せず意図的 Seam にする。
 *              onNodeCreated 時点では node.portals が空なのでここが本命。onNodeCreated では既に Portal があれば同じ処理をする）。
 *   Game       interactRay: portal.ride → game.startRide（layout.rides の path / durationSec を使う）→ PlayerRide が車内で待つ
 *              → 到着で world.resolveRide の 'platform' Adapter へ遷移（既存実装）。
 *   build      窓外の流光: 細長い発光箔（MeshBasicMaterial）を車体の奥側の窓の外に並べ、乗車中だけ表示して壁沿いに流す RoomEffect。
 *              速度は乗車の進行率で加減速する。ジオメトリは増やさず位置・可視性だけ動かす。微振動は PlayerRide.shake（Game 既定 0.015）。
 * 決定論: レイアウトの選択は L.sockets の幾何だけで決まる（rng 不使用）。乗車 Portal の行き先は初回乗車で Portal.targetRoomId に保存される。
 */
import * as THREE from 'three';
import type { Portal, RoomInstance } from '../../core/types';
import type { RoomLayout, RideSpec } from '../../generators/layout';
import type { BuiltRoom, RoomEffect } from '../../render/RoomBuilder';
import type { ModifierImpl, ModifierParams, RuntimeContext } from '../types';
import { num, str } from '../util';
import { buildVehicle, frameOf, pickRideSocket, pt, rectToAABB, vehicleDims, vehicleRegion, type Vehicle, type VehicleDims } from './VehicleRide.vehicle';

const ID = 'VehicleRide';

function vehicleOf(params: ModifierParams): Vehicle {
  const v = str(params.vehicleType, 'train');
  return v === 'boat' || v === 'monorail' ? v : 'train';
}

/** 乗車 Portal に印を付ける（onNodeCreated / onConnect 共通）。該当すれば true */
function flagRidePortal(node: RoomInstance, portal: Portal, layout: RoomLayout): boolean {
  const spec = layout.rides?.find((r) => r.socketId === portal.socketId);
  if (!spec) return false;
  portal.ride = true;
  const st = (node.state.modifierState ??= {});
  st[ID] = { ...((st[ID] as Record<string, unknown> | undefined) ?? {}), socketId: spec.socketId, vehicle: spec.vehicle };
  return true;
}

// ---------------------------------------------------------------- 窓外の流光

interface StreakStyle {
  colors: number[];
  /** 流れる速さ（m/s）。負なら逆向き */
  speed: number;
  /** 高さの範囲 */
  y: [number, number];
  /** 車体奥面からの距離の範囲 */
  dist: [number, number];
  /** 箔の長さの範囲 */
  len: [number, number];
  thickness: number;
}

function streakStyle(v: Vehicle, d: VehicleDims): StreakStyle {
  switch (v) {
    case 'boat':
      // 水面の反射光: 低く・遅く・青緑
      return { colors: [0x7fd0d8, 0x9be6ea, 0x4f9fb0, 0xd8f4f6], speed: 5.5, y: [0.05, 0.7], dist: [1.0, d.backdrop - 0.5], len: [0.8, 3.0], thickness: 0.05 };
    case 'monorail':
      // 夜の都市のネオン: 高さ・色がばらつく
      return { colors: [0x79b9cf, 0xff6fb5, 0xffd27a, 0x8cff9a, 0xffffff], speed: 16, y: [0.4, d.height + 1.5], dist: [1.2, d.backdrop - 0.4], len: [0.6, 3.5], thickness: 0.12 };
    default:
      // トンネルの照明列: 窓帯の高さで一定間隔に近い
      return { colors: [0xffd29a, 0xffb060, 0xfff1d0], speed: 22, y: [d.winY0 + 0.1, d.winY1 + 0.6], dist: [1.5, d.backdrop - 0.6], len: [1.5, 4.0], thickness: 0.09 };
  }
}

interface Streak {
  mesh: THREE.Mesh;
  u: number;
  y: number;
  v: number;
  len: number;
}

/** 乗車中だけ表示し、壁沿い（u 軸）に流す。位置と可視性しか触らない */
class StreakEffect implements RoomEffect {
  private readonly streaks: Streak[] = [];
  private readonly group = new THREE.Group();
  private readonly materials: THREE.MeshBasicMaterial[] = [];
  private readonly geometry = new THREE.BoxGeometry(1, 1, 1);
  private readonly uMin: number;
  private readonly uMax: number;
  private readonly speed: number;
  private readonly frame: ReturnType<typeof frameOf>;

  constructor(built: BuiltRoom, L: RoomLayout, spec: RideSpec, count: number, seedRand: () => number) {
    const s = L.sockets.find((x) => x.id === spec.socketId)!;
    const f = frameOf(s);
    this.frame = f;
    const d = vehicleDims(spec.vehicle);
    const style = streakStyle(spec.vehicle, d);
    const hu = d.len / 2;
    this.uMin = -hu - 3;
    this.uMax = hu + 3;
    this.speed = style.speed;
    this.group.name = `${ID}/streaks`;
    this.group.visible = false;
    for (const c of style.colors) this.materials.push(new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, depthWrite: false }));
    // 車体の向き: 箔の長軸を u（t ベクトル）に合わせる
    const yaw = Math.atan2(f.t[0], f.t[2]);
    for (let i = 0; i < count; i++) {
      const len = style.len[0] + seedRand() * (style.len[1] - style.len[0]);
      const st: Streak = {
        mesh: new THREE.Mesh(this.geometry, this.materials[i % this.materials.length]),
        u: this.uMin + seedRand() * (this.uMax - this.uMin),
        y: style.y[0] + seedRand() * (style.y[1] - style.y[0]),
        v: d.gap + d.depth + style.dist[0] + seedRand() * (style.dist[1] - style.dist[0]),
        len,
      };
      st.mesh.scale.set(style.thickness, style.thickness * (0.6 + seedRand() * 1.2), len);
      st.mesh.rotation.y = yaw;
      st.mesh.frustumCulled = false;
      this.place(st);
      this.group.add(st.mesh);
      this.streaks.push(st);
    }
    built.group.add(this.group);
  }

  private place(st: Streak): void {
    const p = pt(this.frame, st.u, st.y, st.v);
    st.mesh.position.set(p[0], p[1], p[2]);
  }

  update(dt: number, ctx: RuntimeContext): void {
    const ride = ctx.game?.ride;
    const riding = !!ride?.riding && ctx.game?.currentRoomId === ctx.node.roomId;
    if (!riding) {
      if (this.group.visible) this.group.visible = false;
      return;
    }
    this.group.visible = true;
    // 加速 → 等速 → 減速（進行率の両端 15%）
    const p = ride!.progress;
    const ramp = Math.max(0.08, Math.min(1, p / 0.15, (1 - p) / 0.15));
    const dv = this.speed * ramp * dt;
    const span = this.uMax - this.uMin;
    for (const st of this.streaks) {
      st.u -= dv;
      if (st.u + st.len / 2 < this.uMin) st.u += span + st.len;
      else if (st.u - st.len / 2 > this.uMax) st.u -= span + st.len;
      this.place(st);
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    this.geometry.dispose();
    for (const m of this.materials) m.dispose();
    this.streaks.length = 0;
  }
}

// ---------------------------------------------------------------- Modifier

const VehicleRide: ModifierImpl = {
  id: ID,
  defaults: { vehicleType: 'train', durationSec: 25, skipAfterSec: 5, shake: 0.015 },

  layout(L, p, params) {
    if (L.rides?.some((r) => r.id === ID)) return;
    const vehicle = vehicleOf(params);
    const d = vehicleDims(vehicle);
    const extraIds = new Set(p.extraSockets.map((s) => s.id));
    const s = pickRideSocket(L, extraIds, d);
    if (!s) return; // 乗車口を置ける扉が無い（Modifier 無し相当。通常の部屋として成立する）
    const built = buildVehicle(vehicle, s, d, L.height, L.palette.lightColor);
    L.boxes.push(...built.boxes);
    L.lights.push(...built.lights);
    const durationSec = Math.max(5, num(params.durationSec, 25));
    const spec: RideSpec = { id: ID, socketId: s.id, path: [built.seat], durationSec, vehicle };
    (L.rides ??= []).push(spec);
    (L.zones ??= []).push({ kind: 'ride', aabb: built.interior, params: { rideId: ID, socketId: s.id, vehicle } });
    // バウンズを車両 + 背景まで広げる（他の部屋がそこへ置かれないように）。y は床下 0.6 m まで
    const region = rectToAABB(vehicleRegion(frameOf(s), d), -0.6, Math.max(L.height, d.height) + 0.2);
    for (let k = 0; k < 3; k++) {
      L.bounds.min[k] = Math.min(L.bounds.min[k], region.min[k]);
      L.bounds.max[k] = Math.max(L.bounds.max[k], region.max[k]);
    }
  },

  onNodeCreated(node, _def, _params, world) {
    // 通常は portals がまだ空（finalize で作られる）。ロード後など既にあれば印を付け直す
    if (node.portals.length === 0 || !node.placement) return;
    const layout = world.layoutFor(node);
    for (const portal of node.portals) flagRidePortal(node, portal, layout);
  },

  onConnect(ctx) {
    const layout = ctx.world.layoutFor(ctx.node);
    if (!flagRidePortal(ctx.node, ctx.portal, layout)) return;
    // 意図的 Seam: 物理配置しない。到着先（platform Adapter）は初回乗車時に resolveRide が確定する
    return { seam: true };
  },

  build(built, L, ctx) {
    const specs = (L.rides ?? []).filter((r) => r.id === ID && L.sockets.some((s) => s.id === r.socketId));
    if (specs.length === 0) return;
    const count = ctx.tier.id === 'low' ? 4 : ctx.tier.id === 'mid' ? 7 : 10;
    for (const spec of specs) built.effects.push(new StreakEffect(built, L, spec, count, () => ctx.rng.next()));
  },

  onExit(ctx) {
    // 到着で現在部屋が platform に移ると、この部屋の update は可視でない限り呼ばれないので、流光をここで消す（乗車中のみ表示）
    ctx.built?.group.traverse((o) => { if (o.name === `${ID}/streaks`) o.visible = false; });
  },
};

export default VehicleRide;
