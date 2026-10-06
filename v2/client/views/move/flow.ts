/**
 * 移動と身体の描画: 流れ（flowZone）。visual で見せ方を選ぶ。
 * - wind: 送風機の羽根（突風のとき速く回る）・舞う紙くず（風の向きと強さで流れる）・突風の予告と始まりの音
 * - crowd: 見えない群衆の影（床を流れる薄い影）・流れのある間の足音のざわめき
 * - updraft: 床の格子から立ちのぼる埃
 * - escalator / slide / water: 坂の上を流れる線（坂の最初の区切りの params.strip が、坂全体に描く）
 * 動く物は流れの範囲の中だけ（範囲の外へ出たら反対の端へ戻す）。照明に依らない色（暗い部屋でも見える）
 * ほかに ramp（坂の面: 滑り台の板）
 */
import * as THREE from 'three';
import type { PartState } from '../../../core/sim/part.ts';
import type { MatId } from '../../../core/world/layout.ts';
import type { SoundHandle } from '../../audio/AudioEngine.ts';
import { defineView } from '../views.ts';
import { boxGeo, hashStr, lightAt, seeded, setBaked } from './util.ts';

interface Aabb { min: number[]; max: number[] }

defineView('flowZone', (spec, ctx) => {
  const visual = typeof spec.params.visual === 'string' ? spec.params.visual : 'wind';
  const a = spec.params.aabb as unknown as Aabb;
  const v = (spec.params.vector as number[] | undefined) ?? [0, 0, 1];
  const vl = Math.hypot(v[0]!, v[1]!, v[2]!) || 1;
  const dir = new THREE.Vector3(v[0]! / vl, v[1]! / vl, v[2]! / vl);
  const size = new THREE.Vector3(a.max[0]! - a.min[0]!, a.max[1]! - a.min[1]!, a.max[2]! - a.min[2]!);
  const min = new THREE.Vector3(a.min[0]!, a.min[1]!, a.min[2]!);
  const rnd = seeded(hashStr(spec.id));
  const disposers: (() => void)[] = [];
  const updaters: ((s: Readonly<PartState>, dt: number) => void)[] = [];
  let level = 0;

  // ---- 坂の上の流れ（エスカレーター・滑り台）: 坂の最初の区切りだけが、坂全体の線を描く（params.strip）
  const strip = spec.params.strip as { rect: { x0: number; z0: number; x1: number; z1: number }; axis: number; c0: number; c1: number; y0: number; y1: number } | undefined;
  if (visual === 'escalator' || visual === 'slide' || visual === 'water') {
    if (!strip) return null;
    return stripView(spec.id, strip, dir, visual, ctx);
  }
  // ---- 舞う物（紙くず・埃・影・線）: InstancedMesh。範囲の中を流れの向きに進み、端で反対側へ戻る
  const kind = visual === 'crowd' ? 'shadow' : visual === 'updraft' ? 'dust' : visual === 'wind' ? 'paper' : 'streak';
  const area = size.x * size.z;
  const count = Math.max(4, Math.min(kind === 'paper' ? 40 : kind === 'shadow' ? 10 : 30, Math.round(area * (kind === 'shadow' ? 0.5 : 1.2))));
  let geo: THREE.BufferGeometry;
  let mat: THREE.Material;
  if (kind === 'paper') {
    geo = new THREE.PlaneGeometry(0.18, 0.13);
    mat = new THREE.MeshBasicMaterial({ color: 0xe8e2d0, side: THREE.DoubleSide, fog: true });
  } else if (kind === 'shadow') {
    geo = new THREE.CircleGeometry(0.32, 16).rotateX(-Math.PI / 2);
    mat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false, fog: true });
  } else if (kind === 'dust') {
    geo = new THREE.PlaneGeometry(0.03, 0.03);
    mat = new THREE.MeshBasicMaterial({ color: 0xd8d0c0, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false, fog: true });
  } else {
    geo = new THREE.PlaneGeometry(0.05, 0.5).rotateX(-Math.PI / 2);
    mat = new THREE.MeshBasicMaterial({ color: 0xd9e4ee, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, fog: true });
  }
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  ctx.root.add(mesh);
  const pos = Array.from({ length: count }, () => new THREE.Vector3(min.x + rnd() * size.x, min.y + 0.1 + rnd() * Math.min(size.y - 0.2, kind === 'paper' ? 1.8 : kind === 'shadow' ? 0.01 : size.y), min.z + rnd() * size.z));
  const spin = Array.from({ length: count }, () => [rnd() * 6, rnd() * 6, 0.6 + rnd() * 1.2]);
  if (kind === 'shadow') for (const p of pos) p.y = min.y + 0.105;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), sc = new THREE.Vector3();
  const look = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir.clone().setY(0).normalize().lengthSq() > 0 ? dir.clone().setY(0).normalize() : new THREE.Vector3(0, 0, -1));
  let time = 0;
  updaters.push((_s, dt) => {
    time += dt;
    const speed = level;
    for (let i = 0; i < count; i++) {
      const p = pos[i]!;
      const r = spin[i]!;
      if (kind === 'paper') {
        // 紙くず: 強い風で流れ、弱い風では床へ落ちてゆっくり這う
        const lift = Math.max(0, speed - 1.5) * 0.25;
        p.addScaledVector(dir, speed * r[2]! * 0.8 * dt);
        p.y = Math.max(min.y + 0.12, Math.min(min.y + 2.2, p.y + (lift - 0.35 + Math.sin(time * 3 + r[0]!) * 0.4) * dt));
        e.set(time * r[0]! * (0.3 + speed * 0.3), time * r[1]! * 0.5, 0);
        q.setFromEuler(e);
        sc.copy(one);
      } else if (kind === 'shadow') {
        p.addScaledVector(dir, speed * (0.8 + r[2]! * 0.3) * dt);
        q.identity();
        const s = speed > 0.2 ? 1 : 0.0001;
        sc.set(s * (0.8 + r[2]! * 0.3), 1, s);
      } else if (kind === 'dust') {
        p.addScaledVector(dir, speed * (0.5 + r[2]! * 0.5) * dt);
        p.x += Math.sin(time * 1.7 + r[0]!) * 0.1 * dt;
        q.setFromEuler(e.set(time * r[0]!, time * r[1]!, 0));
        sc.copy(one);
      } else {
        p.addScaledVector(dir, Math.max(0.4, speed) * (0.9 + r[2]! * 0.2) * dt);
        q.copy(look);
        sc.set(1, 1, 0.6 + r[2]! * 0.8);
      }
      // 範囲の外へ出たら、流れの来る側の端へ戻す
      for (const ax of ['x', 'y', 'z'] as const) {
        const lo = min[ax], hi = min[ax] + size[ax];
        if (p[ax] > hi) p[ax] = lo + (p[ax] - hi);
        else if (p[ax] < lo) p[ax] = hi - (lo - p[ax]);
      }
      m4.compose(p, q, sc);
      mesh.setMatrixAt(i, m4);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  disposers.push(() => { mesh.removeFromParent(); geo.dispose(); mat.dispose(); });

  // ---- 送風機の羽根（params.fans: [x, y, z, 半径, 向き x, 向き z]）
  const fans = Array.isArray(spec.params.fans) ? (spec.params.fans as number[][]) : [];
  if (fans.length) {
    const bladeGeo = new THREE.BoxGeometry(0.1, 1, 0.02);
    const bladeMat = new THREE.MeshBasicMaterial({ color: 0x3a3f44, fog: true });
    const hubs: THREE.Group[] = [];
    for (const f of fans) {
      const hub = new THREE.Group();
      hub.position.set(f[0]!, f[1]!, f[2]!);
      hub.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(f[4]!, 0, f[5]!).normalize());
      for (let k = 0; k < 4; k++) {
        const b = new THREE.Mesh(bladeGeo, bladeMat);
        b.scale.set(1.6, f[3]! * 0.95, 1);
        b.position.set(0, 0, 0);
        const arm = new THREE.Group();
        arm.rotation.z = (k * Math.PI) / 2;
        b.position.y = f[3]! * 0.48;
        b.rotation.y = 0.5;
        arm.add(b);
        hub.add(arm);
      }
      ctx.root.add(hub);
      hubs.push(hub);
    }
    let angle = 0;
    updaters.push((_s, dt) => {
      angle += dt * (0.5 + level * 3.2);
      for (const h of hubs) h.rotation.z = angle;
    });
    disposers.push(() => { for (const h of hubs) h.removeFromParent(); bladeGeo.dispose(); bladeMat.dispose(); });
  }

  // ---- 音: 突風の予告・始まり（近くにいるときだけ）。人の流れはざわめき
  const center: [number, number, number] = [min.x + size.x / 2, min.y + Math.min(1.5, size.y / 2), min.z + size.z / 2];
  let loop: SoundHandle | null = null;
  const near = (): boolean => !ctx.camera || ctx.camera.position.distanceTo(new THREE.Vector3(...center)) < 22;
  const off = ctx.onEvent?.((ev) => {
    if (ev.type !== 'cue' || ev.entity !== spec.id || !ctx.audio || !near()) return;
    const name = String(ev.data?.name ?? '');
    if (visual === 'wind') {
      if (name === 'flow.warn') ctx.audio.play('ventFan', { pos: center, gain: 0.5 });
      else if (name === 'flow.on') ctx.audio.play('windStrong', { pos: center, gain: 0.9 });
    } else if (visual === 'crowd') {
      if (name === 'flow.on') { loop?.stop(0.5); loop = ctx.audio.play('footstepsEcho', { pos: center, gain: 0.6, loop: true }); }
      else if (name === 'flow.off') { loop?.stop(0.8); loop = null; }
    }
  });
  if (off) disposers.push(off);
  disposers.push(() => loop?.stop(0.2));

  return {
    update(s, dt) {
      const target = typeof s.strength === 'number' ? s.strength : 0;
      level += (target - level) * Math.min(1, dt * 3);
      for (const u of updaters) u(s, dt);
    },
    dispose() { for (const d of disposers) d(); },
  };
});

/**
 * 坂の上を流れる線: エスカレーター = 段の縁（暗い横の線）が下へ動く / 滑り台 = 明るい筋 / 水 = 青い筋が速く流れる。
 * 線は坂の面の少し上（坂の高さを、軸の位置から測る）
 */
function stripView(id: string, strip: { rect: { x0: number; z0: number; x1: number; z1: number }; axis: number; c0: number; c1: number; y0: number; y1: number }, dir: THREE.Vector3, visual: string, ctx: Parameters<Parameters<typeof defineView>[1]>[1]) {
  const r = strip.rect;
  const alongX = strip.axis === 0;
  const len = Math.abs(strip.c1 - strip.c0);
  const wid = alongX ? r.z1 - r.z0 : r.x1 - r.x0;
  const spacing = visual === 'escalator' ? 0.4 : visual === 'water' ? 0.35 : 0.6;
  const count = Math.max(2, Math.floor(len / spacing));
  const geo = visual === 'escalator' ? new THREE.BoxGeometry(alongX ? 0.03 : wid * 0.96, 0.012, alongX ? wid * 0.96 : 0.03) : new THREE.BoxGeometry(alongX ? 0.4 : 0.04, 0.004, alongX ? 0.04 : 0.4);
  const mat = new THREE.MeshBasicMaterial({ color: visual === 'escalator' ? 0x23272b : visual === 'water' ? 0xbfe6ff : 0xfff2e0, transparent: visual !== 'escalator', opacity: visual === 'water' ? 0.6 : 0.5, depthWrite: visual === 'escalator', fog: true });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  ctx.root.add(mesh);
  // 流れの向き: 軸の座標が c0 → c1 なら +1
  const sgnAxis = Math.sign(strip.c1 - strip.c0) || 1;
  const flowSign = Math.sign((alongX ? dir.x : dir.z) * sgnAxis) || 1;
  const rnd = seeded(hashStr(id));
  const side = Array.from({ length: count }, () => rnd());
  const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
  const slopeAngle = Math.atan2(strip.y1 - strip.y0, len);
  q.setFromAxisAngle(alongX ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0), alongX ? slopeAngle * sgnAxis : -slopeAngle * sgnAxis);
  let off = 0;
  return {
    update(s: Readonly<Record<string, unknown>>, dt: number) {
      const speed = typeof s.strength === 'number' ? s.strength : 0;
      off = (off + flowSign * speed * dt / len + 1) % 1;
      for (let i = 0; i < count; i++) {
        const k = (i / count + off) % 1;
        const c = strip.c0 + (strip.c1 - strip.c0) * k;
        const yy = strip.y0 + (strip.y1 - strip.y0) * k + 0.015;
        const across = visual === 'escalator' ? 0.5 : 0.15 + side[i]! * 0.7;
        if (alongX) p.set(c, yy, r.z0 + wid * across); else p.set(r.x0 + wid * across, yy, c);
        m4.compose(p, q, one);
        mesh.setMatrixAt(i, m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() { mesh.removeFromParent(); geo.dispose(); mat.dispose(); },
  };
}

// ---------------------------------------------------------------- 坂の面（滑り台の板。エスカレーターは段を見せるので描かない）
defineView('ramp', (spec, ctx) => {
  if (spec.params.visual === 'escalator') return null;
  const r = spec.params.rect as { x0: number; z0: number; x1: number; z1: number };
  const alongX = Number(spec.params.axis ?? 2) === 0;
  const a0 = Number(spec.params.a0), a1 = Number(spec.params.a1), y0 = Number(spec.params.y0), y1 = Number(spec.params.y1);
  const mat = (spec.params.mat as MatId | undefined) ?? 'plasticRed';
  const dl = a1 - a0, dy = y1 - y0;
  const len = Math.hypot(dl, dy);
  const wid = alongX ? r.z1 - r.z0 : r.x1 - r.x0;
  const g = boxGeo(alongX ? [len, 0.04, wid] : [wid, 0.04, len], mat);
  const mesh = new THREE.Mesh(g, ctx.materials.get(mat));
  const cx = alongX ? (a0 + a1) / 2 : (r.x0 + r.x1) / 2, cz = alongX ? (r.z0 + r.z1) / 2 : (a0 + a1) / 2;
  mesh.position.set(cx, (y0 + y1) / 2 - 0.02, cz);
  if (alongX) mesh.rotation.z = Math.atan2(dy, dl);
  else mesh.rotation.x = Math.atan2(-dy, dl);
  ctx.root.add(mesh);
  setBaked(g, lightAt(ctx, [cx, (y0 + y1) / 2 + 0.3, cz]));
  return { update() {}, dispose() { mesh.removeFromParent(); g.dispose(); } };
});
