/**
 * レバー・スイッチ・非常電源・霧の誘導灯の描画。
 * - lever: style 'lever' は壁の箱から出た取っ手（引くと下がり、戻るまでの残り時間に合わせて少しずつ上がる）。
 *     style 'switch' は照明のスイッチ（小さな板の切り替え）。引くと金属の音・カチッという音
 * - senseFx 'power': 電源が入っている間のうなり。残り 4 秒から 1 秒ごとの警告音。切れると落ちる音
 * - senseFx 'beacons': 誘導灯の頭（光る玉）と、霧ににじむ光の暈（近いほど濃い）。本当の灯りは出口の向きへ順に流れるように点滅し、
 *     偽の灯り（少し黄色）は逆の向きに、違う間隔で流れる
 */
import * as THREE from 'three';
import { defineView } from '../views.ts';
import { glowMaterial, LitParts, onCue, playerInCell, simTime } from './common.ts';
import { defineFx } from './fx.ts';

defineView('lever', (spec, ctx) => {
  const p = spec.params.pos as number[];
  const d = Number(spec.params.dir);
  const style = String(spec.params.style ?? 'lever');
  const sec = Number(spec.params.sec ?? 0);
  const parts = new LitParts(ctx);
  const pivot = new THREE.Group();
  pivot.position.set(p[0]!, p[1]!, p[2]!);
  // 壁から内側へ向く（d の壁の法線）: 0 → -z・1 → -x・2 → +z・3 → +x
  pivot.rotation.y = [0, Math.PI / 2, Math.PI, -Math.PI / 2][d] ?? 0;
  const arm = new THREE.Group();
  if (style === 'lever') {
    parts.box([0.05, 0.05, 0.34], [0, 0, 0.17], 'metal');
    parts.box([0.1, 0.1, 0.1], [0, 0, 0.36], 'plasticRed');
  } else {
    parts.box([0.035, 0.06, 0.03], [0, 0, 0.015], 'paintWhite');
  }
  arm.add(parts.group);
  pivot.add(arm);
  ctx.root.add(pivot);
  parts.relight([p[0]!, p[1]!, p[2]!]);
  // 腕の角度: 上（切）・下（入）。スイッチは小さく傾く
  const up = style === 'lever' ? 0.75 : 0.35, down = style === 'lever' ? -0.75 : -0.35;
  let a = up;
  const off = onCue(ctx, spec.id, (name, e) => {
    const pos = e.pos as [number, number, number] | undefined;
    if (name === 'lever.pull') ctx.audio?.play(style === 'lever' ? 'clank' : 'beep', { pos, gain: style === 'lever' ? 0.6 : 0.15 });
    if (name === 'lever.off') ctx.audio?.play('thud', { pos, gain: 0.5 });
  });
  let relit = 0;
  return {
    update(s, dt) {
      const on = Number(s.on ?? 0) > 0;
      let want = on ? down : up;
      if (on && sec > 0) {
        const at = Number(s.at ?? -1);
        const left = Math.max(0, sec - (simTime(ctx.sim) - at));
        want = down + (up - down) * (1 - left / sec) * 0.85;
      }
      a += (want - a) * Math.min(1, dt * 12);
      arm.rotation.x = -a;
      relit -= dt;
      if (relit <= 0) { relit = 0.4; parts.relight([p[0]!, p[1]!, p[2]!]); }
    },
    dispose() { off(); pivot.removeFromParent(); parts.dispose(); },
  };
});

defineFx('power', (spec, ctx) => {
  const lever = String(spec.params.lever);
  const lspec = ctx.sim.floor.entities.find((e) => e.id === lever);
  const pos = (lspec?.params.pos as number[] | undefined) ?? [0, 0, 0];
  let hum: ReturnType<NonNullable<typeof ctx.audio>['beacon']> | null = null;
  let lastTick = -1;
  return {
    update() {
      const on = ctx.sim.outputOf(lever, 'on') > 0.5;
      const left = ctx.sim.outputOf(lever, 'left');
      const inside = playerInCell(ctx, spec.cell);
      if (on && inside && ctx.audio) {
        if (!hum || !hum.active) hum = ctx.audio.beacon('electricHum', [pos[0]!, pos[1]! + 0.6, pos[2]!], 0.45);
      } else if (hum) { hum.stop(0.25); hum = null; }
      const k = Math.ceil(left);
      if (on && inside && left < 4 && k !== lastTick) { ctx.audio?.play('tick', { gain: 0.5 }); }
      lastTick = k;
    },
    dispose() { hum?.stop(0.1); },
  };
});

defineFx('beacons', (spec, ctx) => {
  const list = (spec.params.beacons as { pos: number[]; order: number; fake: boolean }[] | undefined) ?? [];
  const headGeo = new THREE.SphereGeometry(0.06, 12, 10);
  const haloGeo = new THREE.SphereGeometry(0.45, 14, 10);
  const items = list.map((b) => {
    const color = b.fake ? 0xffcf6a : 0x6dffa0;
    const head = new THREE.Mesh(headGeo, glowMaterial(color, 0.25));
    const haloMat = glowMaterial(color, 0);
    haloMat.fog = false;
    const halo = new THREE.Mesh(haloGeo, haloMat);
    head.position.set(b.pos[0]!, b.pos[1]!, b.pos[2]!);
    halo.position.copy(head.position);
    ctx.root.add(head, halo);
    return { b, head, halo, haloMat };
  });
  const n = list.filter((b) => !b.fake).length;
  const nf = list.filter((b) => b.fake).length;
  const step = 0.22, period = n * step + 0.9;
  const fstep = 0.31, fperiod = nf * fstep + 1.4;
  return {
    update() {
      const t = simTime(ctx.sim);
      const p = ctx.sim.players[0];
      for (const it of items) {
        // 本当の灯り: order の順（入口 → 出口）に光が流れる。偽の灯り: 壁の側から道へ（逆）
        const ph = it.b.fake ? ((t - (nf + it.b.order + 1) * fstep) % fperiod + fperiod) % fperiod : ((t - it.b.order * step) % period + period) % period;
        const on = ph < (it.b.fake ? 0.26 : 0.18) ? 1 : 0;
        const k = 0.25 + 0.75 * on;
        (it.head.material as THREE.MeshBasicMaterial).opacity = k;
        // 暈: 霧に依らず、近いほど濃い（7 m で消える）
        const dist = p ? Math.hypot(p.pos[0] - it.b.pos[0]!, p.pos[2] - it.b.pos[2]!) : 99;
        it.haloMat.opacity = Math.max(0, 1 - dist / 7) * (0.05 + 0.2 * on);
      }
    },
    dispose() {
      for (const it of items) { it.head.removeFromParent(); it.halo.removeFromParent(); (it.head.material as THREE.Material).dispose(); it.haloMat.dispose(); }
      headGeo.dispose(); haloGeo.dispose();
    },
  };
});
