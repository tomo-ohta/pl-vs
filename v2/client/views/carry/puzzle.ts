/**
 * パズルの部品の描画: ダイヤル（数字・時計）・鐘・手がかりの絵（carryDecor: 色の扉の絵・止まった時計・色の点の写真・
 * 絵・配置図・足跡の図・楽譜）・電球の受け口の色の灯り。
 * 絵は canvas で描く（ブラウザだけ。試験の Node では無地の板）
 */
import * as THREE from 'three';
import type { PartState } from '../../../core/sim/part.ts';
import type { EntitySpec, MatId } from '../../../core/world/layout.ts';
import { defineView, type ViewContext } from '../views.ts';
import { lightAt, noteHz, onCue, Parts, playTone } from './common.ts';

/** 壁 d の部屋の側を向く向き（Y 回り）: 0:+Z の壁 → -Z を向く … */
export function faceYaw(d: number): number {
  const n = [[0, -1], [-1, 0], [0, 1], [1, 0]][d] ?? [0, 1];
  return Math.atan2(n[0]!, n[1]!);
}

const basic = (color: number): THREE.MeshBasicMaterial => new THREE.MeshBasicMaterial({ color });

/** 7 本の線の数字（原点中心・幅 w・高さ 1.8 w。+z の面） */
const SEG = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f];
function digitMesh(w: number, mat: THREE.Material): { group: THREE.Group; set(v: number): void; dispose(): void } {
  const group = new THREE.Group();
  const t = w * 0.18, h = w * 0.9;
  const hz = new THREE.BoxGeometry(w, t, 0.004), vt = new THREE.BoxGeometry(t, h, 0.004);
  const at: [number, number, boolean][] = [[0, h, true], [w / 2, h / 2, false], [w / 2, -h / 2, false], [0, -h, true], [-w / 2, -h / 2, false], [-w / 2, h / 2, false], [0, 0, true]];
  const segs = at.map(([x, y, horiz]) => { const m = new THREE.Mesh(horiz ? hz : vt, mat); m.position.set(x, y, 0); group.add(m); return m; });
  return {
    group,
    set(v) { const bits = SEG[((v % 10) + 10) % 10]!; segs.forEach((m, i) => { m.visible = !!(bits & (1 << i)); }); },
    dispose() { hz.dispose(); vt.dispose(); },
  };
}

/** 時計の顔（原点中心・半径 r・+z の面）と時針 */
function clockMesh(P: Parts, r: number): { group: THREE.Group; set(hour: number): void } {
  const group = new THREE.Group();
  const face = new THREE.CylinderGeometry(r, r, 0.03, 28);
  face.rotateX(Math.PI / 2);
  P.add(face, 'paintWhite', [0, 0, 0], group);
  const rim = new THREE.TorusGeometry(r, 0.012, 6, 28);
  P.add(rim, 'metalDark', [0, 0, 0.016], group);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    P.box([0.012, i % 3 ? 0.025 : 0.045, 0.006], 'metalDark', [Math.sin(a) * r * 0.82, Math.cos(a) * r * 0.82, 0.018], group).rotation.z = -a;
  }
  const hourPivot = new THREE.Group();
  hourPivot.position.z = 0.022;
  P.box([0.018, r * 0.55, 0.006], 'metalDark', [0, r * 0.25, 0], hourPivot);
  group.add(hourPivot);
  const minPivot = new THREE.Group();
  minPivot.position.z = 0.026;
  P.box([0.01, r * 0.8, 0.005], 'metalDark', [0, r * 0.38, 0], minPivot);
  group.add(minPivot);
  return { group, set(hour) { hourPivot.rotation.z = -(hour * Math.PI) / 6; } };
}

// ---------------------------------------------------------------- ダイヤル
defineView('dial', (spec, ctx) => {
  const b = spec.params.box as { min: number[]; max: number[] };
  const c: [number, number, number] = [(b.min[0]! + b.max[0]!) / 2, (b.min[1]! + b.max[1]!) / 2, (b.min[2]! + b.max[2]!) / 2];
  const d = Number(spec.params.dir ?? 2);
  const P = new Parts(ctx);
  const g = P.group;
  g.position.set(...c);
  g.rotation.y = faceYaw(d);
  const clock = spec.params.mode === 'clock';
  const size = Math.max(b.max[0]! - b.min[0]!, b.max[2]! - b.min[2]!);
  let set: (v: number) => void;
  let digit: ReturnType<typeof digitMesh> | null = null;
  const glow = basic(0xffa040);
  if (clock) {
    const m = clockMesh(P, size / 2);
    g.add(m.group);
    set = m.set;
  } else {
    P.box([size, b.max[1]! - b.min[1]!, 0.05], 'metalDark', [0, 0, 0]);
    digit = digitMesh(size * 0.45, glow);
    digit.group.position.z = 0.028;
    g.add(digit.group);
    set = digit.set;
  }
  ctx.root.add(g);
  P.relight(lightAt(ctx, [c[0], c[1], c[2]]));
  let shown = -1;
  const off = onCue(ctx, spec.id, (name, e) => { if (name === 'carry.dial') ctx.audio?.play(clock ? 'clank' : 'beep', { pos: e.pos, gain: clock ? 0.08 : 0.12 }); });
  return {
    update(s: Readonly<PartState>) {
      const v = Number(s.v ?? 0);
      if (v !== shown) { set(v); shown = v; }
    },
    dispose() { off(); P.dispose(); digit?.dispose(); glow.dispose(); },
  };
});

// ---------------------------------------------------------------- 鐘
defineView('bell', (spec, ctx) => {
  const b = spec.params.box as { min: number[]; max: number[] };
  const size = Number(spec.params.size ?? 0.2);
  const freq = Number(spec.params.freq ?? 523.25);
  const P = new Parts(ctx);
  const pivot = new THREE.Group();
  pivot.position.set((b.min[0]! + b.max[0]!) / 2, b.min[1]! + size * 1.4, (b.min[2]! + b.max[2]!) / 2);
  P.group.add(pivot);
  P.add(new THREE.CylinderGeometry(size * 0.35, size, size * 1.1, 20, 1, true), 'goldTrim', [0, -size * 0.65, 0], pivot);
  P.add(new THREE.SphereGeometry(size * 0.36, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), 'goldTrim', [0, -size * 0.1, 0], pivot);
  P.add(new THREE.SphereGeometry(size * 0.12, 10, 8), 'metalDark', [0, -size * 1.1, 0], pivot);
  P.box([0.03, 0.12, 0.03], 'metalDark', [0, 0.04, 0], pivot);
  ctx.root.add(P.group);
  P.relight(lightAt(ctx, [pivot.position.x, pivot.position.y, pivot.position.z]));
  let swing = 0;
  const off = onCue(ctx, spec.id, (name, e) => { if (name === 'carry.bell') { swing = 1; playTone(ctx, freq, { pos: e.pos, dur: 2.2, gain: 0.8, bell: true }); } });
  return {
    update(_s: Readonly<PartState>, dt: number) {
      swing = Math.max(0, swing - dt * 0.7);
      pivot.rotation.z = Math.sin(swing * 22) * 0.25 * swing;
    },
    dispose() { off(); P.dispose(); },
  };
});

// ---------------------------------------------------------------- 手がかりの絵
/** canvas に描いた板（ブラウザだけ。Node では無地） */
function canvasPlate(ctx: ViewContext, w: number, h: number, px: number, draw: (g: CanvasRenderingContext2D, W: number, H: number) => void): { mesh: THREE.Mesh; dispose(): void } {
  const geo = new THREE.PlaneGeometry(w, h);
  let tex: THREE.CanvasTexture | null = null;
  let mat: THREE.Material;
  if (typeof document !== 'undefined') {
    const cv = document.createElement('canvas');
    cv.width = px; cv.height = Math.round((px * h) / w);
    const g = cv.getContext('2d');
    if (g) draw(g, cv.width, cv.height);
    tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    mat = new THREE.MeshBasicMaterial({ map: tex, color: 0xb8b8b8 });
  } else mat = basic(0x808080);
  const mesh = new THREE.Mesh(geo, mat);
  void ctx;
  return { mesh, dispose() { geo.dispose(); mat.dispose(); tex?.dispose(); } };
}

const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;

/** 描くだけの部品の描き方（view ごと）。戻り値は捨てる関数か、毎フレーム動かす物（update・dispose） */
export type DecorMaker = (spec: EntitySpec, ctx: ViewContext, root: THREE.Group, P: Parts) => (() => void) | { update(dt: number): void; dispose(): void };
export const DECOR: Record<string, DecorMaker> = {
  // 色の扉の絵: 枠の中に、色の付いた扉
  doorPicture(spec, _ctx, root, P) {
    const w = Number(spec.params.w ?? 0.3), h = Number(spec.params.h ?? 0.55);
    const color = Number(spec.params.color ?? 0xffffff);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.7, h * 0.85), basic(color));
    door.position.set(0, -h * 0.07, 0.004);
    root.add(door);
    P.box([w, h, 0.01], 'paintWhite', [0, 0, -0.003], root);
    return () => { door.geometry.dispose(); (door.material as THREE.Material).dispose(); };
  },
  // 止まった時計
  clock(spec, _ctx, root, P) {
    const m = clockMesh(P, 0.16);
    m.set(Number(spec.params.hour ?? 0));
    root.add(m.group);
    return () => {};
  },
  // 色の点の並び（灯りの並びの写真）
  dots(spec, ctx, root) {
    const colors = (spec.params.colors as number[] | undefined) ?? [];
    const w = Number(spec.params.w ?? 0.7);
    const pl = canvasPlate(ctx, w, 0.4, 256, (g, W, H) => {
      g.fillStyle = '#d8cfb8'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#5a5040'; g.fillRect(0, H * 0.12, W, H * 0.05);
      colors.forEach((c, i) => {
        const x = (W * (i + 0.5)) / colors.length;
        g.strokeStyle = '#3a3428'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, H * 0.15); g.lineTo(x, H * 0.45); g.stroke();
        g.fillStyle = hex(c); g.beginPath(); g.arc(x, H * 0.62, H * 0.16, 0, Math.PI * 2); g.fill();
      });
    });
    root.add(pl.mesh);
    // Node でも色が分かるように、点は形でも描く
    const balls = colors.map((c, i) => { const m = new THREE.Mesh(new THREE.CircleGeometry(0.05, 16), basic(c)); m.position.set((i - (colors.length - 1) / 2) * (w / colors.length), -0.04, 0.003); root.add(m); return m; });
    return () => { pl.dispose(); for (const m of balls) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } };
  },
  // 絵（タイルの絵の完成図）・配置図・足跡の図・楽譜: canvas に描く（描き方は params.draw の名前）
  canvas(spec, ctx, root) {
    const w = Number(spec.params.w ?? 0.8), h = Number(spec.params.h ?? 0.6);
    const draw = CANVAS[String(spec.params.draw ?? '')];
    const pl = canvasPlate(ctx, w, h, 256, (g, W, H) => { g.fillStyle = '#e8e2d0'; g.fillRect(0, 0, W, H); draw?.(g, W, H, spec); });
    root.add(pl.mesh);
    return () => pl.dispose();
  },
};

/** canvas の絵の描き方（パズルが params.draw で選ぶ） */
export const CANVAS: Record<string, (g: CanvasRenderingContext2D, W: number, H: number, spec: EntitySpec) => void> = {};

defineView('carryDecor', (spec, ctx) => {
  const make = DECOR[String(spec.params.view ?? '')];
  const at = spec.params.at as number[] | undefined;
  if (!make || !at) return null;
  const P = new Parts(ctx);
  const root = P.group;
  root.position.set(at[0]!, at[1]!, at[2]!);
  root.rotation.y = faceYaw(Number(spec.params.dir ?? 2));
  const done = make(spec, ctx, root, P);
  ctx.root.add(root);
  P.relight(lightAt(ctx, [at[0]!, at[1]!, at[2]!]));
  const live = typeof done === 'function' ? null : done;
  return { update(_s: Readonly<PartState>, dt: number) { live?.update(dt); }, dispose() { if (typeof done === 'function') done(); else done.dispose(); P.dispose(); } };
});

// ---------------------------------------------------------------- 電球の受け口の色の灯り（carryReceiver の glow）
export const BULB_COLOR: Record<string, number> = { red: 0xff5040, blue: 0x5070ff, yellow: 0xffe060, green: 0x60ff70 };

export function receiverGlow(spec: EntitySpec, ctx: ViewContext): { update(s: Readonly<PartState>): void; dispose(): void } | null {
  if (!spec.params.glow) return null;
  const slots = (spec.params.slots as { pos: number[] }[] | undefined) ?? [];
  const geo = new THREE.SphereGeometry(0.16, 14, 10);
  const mats = slots.map(() => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
  const meshes = slots.map((sl, i) => { const m = new THREE.Mesh(geo, mats[i]!); m.position.set(sl.pos[0]!, sl.pos[1]! + 0.09, sl.pos[2]!); ctx.root.add(m); return m; });
  let last = '';
  return {
    update(s) {
      const occ = (s.occ as (string | null)[] | undefined) ?? [];
      const key = occ.join('|');
      if (key === last) return;
      last = key;
      occ.forEach((id, i) => {
        const e = id ? ctx.sim.floor.entities.find((x) => x.id === id) : null;
        const tag = String(e?.params.tag ?? '');
        const col = BULB_COLOR[tag.split('.')[1] ?? ''] ?? 0xfff0c0;
        mats[i]!.color.setHex(col);
        mats[i]!.opacity = id ? 0.35 : 0;
        if (id) playTone(ctx, noteHz(i * 4), { pos: meshes[i]!.position.toArray(), dur: 0.6, gain: 0.25 });
      });
    },
    dispose() { for (const m of meshes) m.removeFromParent(); geo.dispose(); for (const m of mats) m.dispose(); },
  };
}

export type { MatId };
