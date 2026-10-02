/**
 * 時間の仕掛けの描画。
 * - flood: 穴の水面（上下する）と、浮く木箱。満ち始めと引き始めに水の音、満ちる間は流れる音。溺れると水しぶきと巻き戻しの音
 * - senseFx 'rewindRoom': 壁の時計（針が一回りすると巻き戻る）・床の紙（巻き戻る間に散り、巻き戻ると元へ）。巻き戻ると逆回しの音と画面の乱れ
 * - senseFx 'loopClock': 11:59:SS の時計（7 つの線の数字）。決まった秒に電話が鳴る。出るとささやき。くり返すときに逆回しの音
 * - senseFx 'closing': 閉店の放送（チャイムと声）。照明が消えるたびにブレーカーの音
 */
import * as THREE from 'three';
import { crateTop, floodLevel, floodParams } from '../../../core/sim/parts/sense/time.ts';
import { defineView } from '../views.ts';
import { glowMaterial, LitParts, onCue, playerInCell, ScreenVeil, simTime } from './common.ts';
import { defineFx } from './fx.ts';

defineView('flood', (spec, ctx) => {
  const o = floodParams({ spec });
  const hole = spec.params.hole as number[];
  const crates = (spec.params.crates as number[][] | undefined) ?? [];
  const waterGeo = new THREE.PlaneGeometry(hole[2]! - hole[0]!, hole[3]! - hole[1]!);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshBasicMaterial({ color: 0x2c5b63, transparent: true, opacity: 0.62, depthWrite: false, fog: true, side: THREE.DoubleSide });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.set((hole[0]! + hole[2]!) / 2, o.bottom, (hole[1]! + hole[3]!) / 2);
  const sheenMat = glowMaterial(0x9fd6dc, 0.05);
  const sheen = new THREE.Mesh(waterGeo, sheenMat);
  ctx.root.add(water, sheen);
  const boxes = crates.map((c) => {
    const parts = new LitParts(ctx);
    const w = c[2]! - c[0]!, d = c[3]! - c[1]!, h = c[4]!;
    parts.box([w, h, d], [0, -h / 2, 0], 'woodPanel');
    parts.box([w * 0.9, 0.04, 0.06], [0, -h * 0.35, d / 2], 'furnitureDark');
    parts.box([w * 0.9, 0.04, 0.06], [0, -h * 0.35, -d / 2], 'furnitureDark');
    parts.group.position.set((c[0]! + c[2]!) / 2, o.bottom + h, (c[1]! + c[3]!) / 2);
    ctx.root.add(parts.group);
    return parts;
  });
  let flow: ReturnType<NonNullable<typeof ctx.audio>['beacon']> | null = null;
  const center: [number, number, number] = [(hole[0]! + hole[2]!) / 2, o.bottom + 0.5, (hole[1]! + hole[3]!) / 2];
  const off = onCue(ctx, spec.id, (name, e) => {
    if (!playerInCell(ctx, spec.cell)) return;
    if (name === 'flood.rise' || name === 'flood.drain') ctx.audio?.play('splash', { pos: center, gain: 0.5 });
    if (name === 'flood.drown') { ctx.audio?.play('splash', { pos: e.pos as [number, number, number] | undefined, gain: 0.9 }); ctx.audio?.play('rewind', { gain: 0.5 }); }
  });
  let relit = 0;
  return {
    update(s, dt) {
      const r = floodLevel(simTime(ctx.sim), o);
      const lv = Number(s.level ?? r.level);
      water.position.y = lv + 0.005;
      sheen.position.y = lv + 0.012;
      water.visible = sheen.visible = lv > o.bottom + 0.03;
      sheenMat.opacity = 0.04 + 0.03 * Math.sin(simTime(ctx.sim) * 1.7);
      const tops = (s.tops as number[] | undefined) ?? crates.map((c) => crateTop(c, lv, o.bottom));
      boxes.forEach((b, i) => {
        // 浮いている間は少し揺れる
        const bob = lv > o.bottom + 0.4 ? Math.sin(simTime(ctx.sim) * 1.3 + i) * 0.012 : 0;
        b.group.position.y = tops[i]! + bob;
        b.group.rotation.z = bob * 1.5;
      });
      // 満ちていく・引いていく間の水の流れる音
      const moving = r.stage === 'rise' || r.stage === 'drain';
      if (moving && playerInCell(ctx, spec.cell) && ctx.audio) { if (!flow || !flow.active) flow = ctx.audio.beacon('waterFlow', center, 0.7); }
      else if (flow) { flow.stop(0.8); flow = null; }
      relit -= dt;
      if (relit <= 0) { relit = 0.3; boxes.forEach((b) => b.relight([b.group.position.x, b.group.position.y + 0.2, b.group.position.z])); }
    },
    dispose() { off(); flow?.stop(0.1); water.removeFromParent(); sheen.removeFromParent(); waterGeo.dispose(); waterMat.dispose(); sheenMat.dispose(); for (const b of boxes) b.dispose(); },
  };
});

/** 壁の向き d（0..3）の面に貼る物の向き（室内を向く） */
const faceYaw = (d: number): number => [0, Math.PI / 2, Math.PI, -Math.PI / 2][d] ?? 0;

defineFx('rewindRoom', (spec, ctx) => {
  const time = String(spec.params.time);
  const period = Number(spec.params.period);
  const c = spec.params.clock as number[];
  const parts = new LitParts(ctx);
  const face = new THREE.Group();
  face.position.set(c[0]!, c[1]!, c[2]!);
  face.rotation.y = faceYaw(Number(spec.params.dir));
  const disc = parts.cylinder(0.32, 0.03, [0, 0, 0.015], 'paintWhite');
  disc.rotation.x = Math.PI / 2;
  const rim = parts.cylinder(0.34, 0.02, [0, 0, 0.005], 'metalDark');
  rim.rotation.x = Math.PI / 2;
  for (let k = 0; k < 12; k++) { const m = parts.box([0.02, 0.05, 0.01], [Math.sin((k * Math.PI) / 6) * 0.27, Math.cos((k * Math.PI) / 6) * 0.27, 0.035], 'metalDark'); m.rotation.z = -(k * Math.PI) / 6; }
  const hand = new THREE.Group();
  hand.position.z = 0.04;
  const handMesh = parts.box([0.022, 0.26, 0.01], [0, 0.11, 0.045], 'plasticRed');
  parts.group.remove(handMesh);
  hand.add(handMesh);
  face.add(parts.group, hand);
  ctx.root.add(face);
  parts.relight([c[0]!, c[1]!, c[2]!]);
  // 床の紙
  const y = Number(spec.params.y);
  const paperGeo = new THREE.PlaneGeometry(0.21, 0.3);
  paperGeo.rotateX(-Math.PI / 2);
  const paperMat = new THREE.MeshBasicMaterial({ color: 0xd8d4c8, fog: true, side: THREE.DoubleSide });
  const papers = ((spec.params.papers as number[][] | undefined) ?? []).map((p, i) => { const m = new THREE.Mesh(paperGeo, paperMat); m.position.set(p[0]!, y + 0.01 + i * 0.001, p[1]!); ctx.root.add(m); return { m, p }; });
  const veil = new ScreenVeil(ctx, 0x8a6a3a, true);
  let flash = 0;
  const off = onCue(ctx, time, (name) => {
    if (name !== 'rewind.back' || !playerInCell(ctx, spec.cell)) return;
    ctx.audio?.play('rewind', { gain: 0.9 });
    ctx.postfx?.videoPass?.forceJitter?.(45);
    flash = 1;
  });
  let tick = -1;
  return {
    update(_s, dt) {
      const left = ctx.sim.outputOf(time, 'left');
      const u = Math.max(0, Math.min(1, 1 - left / period));
      hand.rotation.z = -u * Math.PI * 2;
      // 紙は巻き戻る間に散る（周期の中の位置で決まる。巻き戻ると元へ）
      for (const { m, p } of papers) {
        const k = u * u;
        m.position.x = p[0]! + Math.sin(p[2]!) * 1.1 * k;
        m.position.z = p[1]! + Math.cos(p[2]!) * 1.1 * k;
        m.rotation.y = p[2]! + k * 2.5;
      }
      // 残り 5 秒から秒ごとに針の音
      const sec = Math.ceil(left);
      if (left < 5 && sec !== tick && playerInCell(ctx, spec.cell)) ctx.audio?.play('tick', { pos: [c[0]!, c[1]!, c[2]!], gain: 0.5 });
      tick = sec;
      flash = Math.max(0, flash - dt * 1.4);
      veil.set(flash * 0.5);
    },
    dispose() { off(); veil.dispose(); face.removeFromParent(); parts.dispose(); handMesh.geometry.dispose(); for (const { m } of papers) m.removeFromParent(); paperGeo.dispose(); paperMat.dispose(); },
  };
});

/** 7 つの線の数字（板の列）。digits の数だけ並べる。set(i, n) で i 桁目を n に */
class SevenSeg {
  readonly group = new THREE.Group();
  private readonly segs: THREE.Mesh[][] = [];
  private readonly geo = new THREE.PlaneGeometry(1, 1);
  readonly mat: THREE.MeshBasicMaterial;
  private static readonly ON: Record<number, string> = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
  constructor(digits: number, h: number, color: number) {
    this.mat = glowMaterial(color, 0.95);
    const w = h * 0.55, t = h * 0.12, pitch = w + h * 0.35;
    const lay: Record<string, [number, number, number, number]> = {
      a: [0, h / 2 - t / 2, w, t], g: [0, 0, w, t], d: [0, -h / 2 + t / 2, w, t],
      f: [-w / 2 + t / 2, h / 4, t, h / 2], b: [w / 2 - t / 2, h / 4, t, h / 2], e: [-w / 2 + t / 2, -h / 4, t, h / 2], c: [w / 2 - t / 2, -h / 4, t, h / 2],
    };
    const x0 = -((digits - 1) * pitch) / 2 - (pitch * 0.3);
    for (let i = 0; i < digits; i++) {
      const row: THREE.Mesh[] = [];
      // 2 桁ごとに区切りの間（: の場所）
      const gx = x0 + i * pitch + Math.floor(i / 2) * pitch * 0.3;
      for (const k of 'abcdefg') {
        const [x, y, sw, sh] = lay[k]!;
        const m = new THREE.Mesh(this.geo, this.mat);
        m.position.set(gx + x, y, 0);
        m.scale.set(sw, sh, 1);
        m.name = k;
        this.group.add(m);
        row.push(m);
      }
      this.segs.push(row);
      if (i % 2 === 1 && i < digits - 1) for (const yy of [h * 0.2, -h * 0.2]) { const dot = new THREE.Mesh(this.geo, this.mat); dot.position.set(gx + w / 2 + pitch * 0.32, yy, 0); dot.scale.set(t, t, 1); this.group.add(dot); }
    }
  }
  set(i: number, n: number): void {
    const on = SevenSeg.ON[n] ?? '';
    for (const m of this.segs[i] ?? []) m.visible = on.includes(m.name);
  }
  dispose(): void { this.group.removeFromParent(); this.geo.dispose(); this.mat.dispose(); }
}

defineFx('loopClock', (spec, ctx) => {
  const loop = String(spec.params.loop);
  const ls = ctx.sim.floor.entities.find((e) => e.id === loop);
  const period = Number(ls?.params.period ?? 40);
  const c = spec.params.clock as number[];
  const parts = new LitParts(ctx);
  const g = new THREE.Group();
  g.position.set(c[0]!, c[1]!, c[2]!);
  g.rotation.y = faceYaw(Number(spec.params.dir));
  parts.box([0.78, 0.26, 0.05], [0, 0, 0.025], 'furnitureDark');
  const seg = new SevenSeg(6, 0.13, 0xff4a30);
  seg.group.position.z = 0.055;
  g.add(parts.group, seg.group);
  ctx.root.add(g);
  parts.relight([c[0]!, c[1]!, c[2]!]);
  seg.set(0, 1); seg.set(1, 1); seg.set(2, 5); seg.set(3, 9);
  const phone = spec.params.phone as [number, number, number];
  let ring: ReturnType<NonNullable<typeof ctx.audio>['beacon']> | null = null;
  const off = onCue(ctx, loop, (name) => {
    if (!playerInCell(ctx, spec.cell)) return;
    if (name === 'loop.answer') { ring?.stop(0.05); ring = null; ctx.audio?.play('whisper', { pos: phone, gain: 0.8 }); }
    if (name === 'loop.reset') { ctx.audio?.play('rewind', { gain: 0.7 }); ctx.postfx?.videoPass?.forceJitter?.(30); }
  });
  return {
    update() {
      const sec = ctx.sim.outputOf(loop, 'sec');
      const shown = Math.min(59, Math.floor((sec / period) * 60));
      seg.set(4, Math.floor(shown / 10));
      seg.set(5, shown % 10);
      const ringing = ctx.sim.outputOf(loop, 'ringing') > 0.5 && playerInCell(ctx, spec.cell);
      if (ringing && ctx.audio) { if (!ring || !ring.active) ring = ctx.audio.beacon('phoneRing', phone, 0.8); }
      else if (ring) { ring.stop(0.1); ring = null; }
    },
    dispose() { off(); ring?.stop(0.05); g.removeFromParent(); parts.dispose(); seg.dispose(); },
  };
});

defineFx('closing', (spec, ctx) => {
  const closing = String(spec.params.closing);
  const speakers = (spec.params.speakers as number[][] | undefined) ?? [];
  const pending: { at: number; kind: string }[] = [];
  const near = (): [number, number, number] | undefined => {
    const p = ctx.sim.players[0];
    if (!p || !speakers.length) return undefined;
    const s = speakers.slice().sort((a, b) => Math.hypot(a[0]! - p.pos[0], a[2]! - p.pos[2]) - Math.hypot(b[0]! - p.pos[0], b[2]! - p.pos[2]))[0]!;
    return [s[0]!, s[1]!, s[2]!];
  };
  const off = onCue(ctx, closing, (name) => {
    if (!playerInCell(ctx, spec.cell)) return;
    const t = simTime(ctx.sim);
    if (name === 'closing.announce') { ctx.audio?.play('paChime', { pos: near(), gain: 0.8 }); pending.push({ at: t + 1.3, kind: 'paVoice' }); }
    if (name === 'closing.off') ctx.audio?.play('thud', { pos: near(), gain: 0.45 });
  });
  return {
    update() {
      const t = simTime(ctx.sim);
      for (let i = pending.length - 1; i >= 0; i--) if (t >= pending[i]!.at) { ctx.audio?.play(pending[i]!.kind, { pos: near(), gain: 0.7 }); pending.splice(i, 1); }
    },
    dispose() { off(); },
  };
});
