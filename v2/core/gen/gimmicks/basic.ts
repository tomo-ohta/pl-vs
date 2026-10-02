/**
 * 基本の仕掛け（段階 3 の 10 種のうち 6 種）。
 * - walkway 動く歩道 [WS M01]: 廊下・広間の真ん中を、出口の向きへ押し流す帯
 * - sensorLights 人感センサー [WS L01]: 廊下の照明が、歩いた所だけつく（離れると消える）
 * - lowCeiling 低い天井 [WS M02]: 廊下の途中が 1.25 m に下がる。しゃがんで通る
 * - soundGuide 音の道しるべ [WS A01]: 暗い部屋。出口の前で小さな音が鳴る（音を消していても、懐中電灯で進める）
 * - switchDoor スイッチで開く扉 [QR D01]: 脇の区画への扉が、部屋の奥のボタンで開く（本道の扉には付けない）
 * - mannequin 視線のマネキン [QR O01]: 見ている間は止まり、目を離すと近づく。触れたら部屋の入口からやり直し
 */
import { box } from '../../world/layout.ts';
import { lightPanel } from '../../world/build.ts';
import { defineGimmick } from './types.ts';
import { aabbJson, doorZone, freeWallSpan, frontOf, innerRect, mainAxis, rectD, rectW } from './util.ts';

defineGimmick({
  id: 'walkway', name: '動く歩道', axes: ['move'], kinds: ['corridor', 'hall'], minSize: [1.8, 7], weight: 1, intensity: 1, onMainPath: true,
  build(ctx) {
    const s = ctx.slot;
    const r = innerRect(s);
    const { axis, sign } = mainAxis(s);
    const y = s.cell.floorY;
    // 帯: 長い向きの真ん中。両端は開口の前を空ける
    const along = axis === 'x' ? [r.x0 + 1.0, r.x1 - 1.0] : [r.z0 + 1.0, r.z1 - 1.0];
    const across = axis === 'x' ? (r.z0 + r.z1) / 2 : (r.x0 + r.x1) / 2;
    const half = Math.min(1.0, ((axis === 'x' ? rectD(r) : rectW(r)) - 0.4) / 2);
    if (along[1]! - along[0]! < 3 || half < 0.5) return;
    const belt = axis === 'x' ? { min: [along[0]!, y, across - half] as [number, number, number], max: [along[1]!, y + 0.03, across + half] as [number, number, number] } : { min: [across - half, y, along[0]!] as [number, number, number], max: [across + half, y + 0.03, along[1]!] as [number, number, number] };
    const b = ctx.addBox(box(belt.min, belt.max, 'rubber', false));
    b.kind = 'belt';
    // 手すり（見た目だけ）
    for (const side of [-1, 1]) {
      const c = across + side * (half + 0.05);
      ctx.addBox(axis === 'x' ? box([along[0]!, y + 0.85, c - 0.03], [along[1]!, y + 0.92, c + 0.03], 'rubber', false) : box([c - 0.03, y + 0.85, along[0]!], [c + 0.03, y + 0.92, along[1]!], 'rubber', false));
    }
    const speed = ctx.rng.float(0.9, 1.4);
    ctx.addEntity('belt', { type: 'forceZone', params: { aabb: aabbJson({ min: [belt.min[0], y - 0.1, belt.min[2]], max: [belt.max[0], y + 0.6, belt.max[2]] }), vector: axis === 'x' ? [sign, 0, 0] : [0, 0, sign], speed, visual: 'belt' } });
  },
});

defineGimmick({
  id: 'sensorLights', name: '人感センサー', axes: ['light'], kinds: ['corridor'], minSize: [1.4, 6], weight: 1, intensity: 0, onMainPath: true,
  build(ctx) {
    const s = ctx.slot;
    const r = innerRect(s);
    const { axis } = mainAxis(s);
    const len = axis === 'x' ? rectW(r) : rectD(r);
    const n = Math.max(2, Math.round(len / 3));
    const y = s.cell.floorY;
    const segOf = (x: number, z: number): number => Math.min(n - 1, Math.max(0, Math.floor(((axis === 'x' ? x - r.x0 : z - r.z0) / len) * n)));
    const lamps: string[] = [];
    for (let i = 0; i < n; i++) {
      const a0 = (axis === 'x' ? r.x0 : r.z0) + (len / n) * i - 1.5, a1 = (axis === 'x' ? r.x0 : r.z0) + (len / n) * (i + 1) + 1.5;
      const zone = axis === 'x' ? { min: [a0, y - 0.2, r.z0], max: [a1, y + 2.5, r.z1] } : { min: [r.x0, y - 0.2, a0], max: [r.x1, y + 2.5, a1] };
      const sensor = ctx.addEntity(`zone${i}`, { type: 'zoneSensor', params: { aabb: { min: zone.min, max: zone.max } } });
      const hold = ctx.addEntity(`hold${i}`, { type: 'timer', params: { onDelay: 0, offDelay: 2.5 }, inputs: { in: `${sensor}.in` } });
      lamps.push(ctx.addEntity(`lamp${i}`, { type: 'lamp', params: { on: false, rate: 6 }, inputs: { on: `${hold}.out` } }));
    }
    // 区画の照明を、近い区間の照明に結び付ける
    for (const b of s.cell.boxes) if (b.mat === s.cell.palette.light && !b.solid && b.max[1] - b.min[1] < 0.06) b.kind = `lamp:${lamps[segOf((b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2)]}`;
    for (const l of s.cell.lights) l.lampId = lamps[segOf(l.pos[0], l.pos[2])]!;
  },
});

defineGimmick({
  id: 'lowCeiling', name: '低い天井', axes: ['body'], kinds: ['corridor'], minSize: [1.4, 6], weight: 0.8, intensity: 1, onMainPath: true,
  build(ctx) {
    const s = ctx.slot;
    const r = innerRect(s);
    const { axis } = mainAxis(s);
    const y = s.cell.floorY;
    const len = axis === 'x' ? rectW(r) : rectD(r);
    const sec = Math.min(len - 2.4, ctx.rng.float(2.5, 4.5));
    if (sec < 1.6) return;
    const mid = (axis === 'x' ? (r.x0 + r.x1) : (r.z0 + r.z1)) / 2;
    const a0 = mid - sec / 2, a1 = mid + sec / 2;
    const low = y + 1.25;
    const top = y + s.cell.height;
    // 下がった天井（当たる）。下に小さな照明
    ctx.addBox(axis === 'x' ? box([a0, low, r.z0], [a1, top, r.z1], s.cell.palette.ceiling) : box([r.x0, low, a0], [r.x1, top, a1], s.cell.palette.ceiling));
    ctx.removeBoxes((b) => !b.solid && b.max[1] > low && (axis === 'x' ? b.max[0] > a0 && b.min[0] < a1 : b.max[2] > a0 && b.min[2] < a1));
    s.cell.lights = s.cell.lights.filter((l) => !(axis === 'x' ? l.pos[0] > a0 - 0.3 && l.pos[0] < a1 + 0.3 : l.pos[2] > a0 - 0.3 && l.pos[2] < a1 + 0.3));
    const cx = axis === 'x' ? mid : (r.x0 + r.x1) / 2, cz = axis === 'x' ? (r.z0 + r.z1) / 2 : mid;
    lightPanel(s.cell.boxes, cx, cz, axis === 'x' ? 0.9 : 0.4, axis === 'x' ? 0.4 : 0.9, low, s.cell.palette.light);
    s.cell.lights.push({ pos: [cx, low - 0.3, cz], color: s.cell.palette.lightColor, intensity: s.cell.palette.lightIntensity * 0.5, distance: 4 });
    ctx.addZone({ kind: 'crawl', aabb: axis === 'x' ? { min: [a0, y, r.z0], max: [a1, low, r.z1] } : { min: [r.x0, y, a0], max: [r.x1, low, a1] } });
  },
});

defineGimmick({
  id: 'soundGuide', name: '音の道しるべ', axes: ['sound', 'light'], kinds: ['room', 'hall'], minSize: [4.5, 5], weight: 0.45, intensity: 1, onMainPath: true,
  fits: (s) => !!s.exit,
  build(ctx) {
    const s = ctx.slot;
    const ex = s.exit!;
    // 部屋の照明を消す（消えたまま。出口の近くに非常灯だけ）
    const dark = ctx.addEntity('dark', { type: 'lamp', params: { on: false } });
    for (const b of s.cell.boxes) if (b.mat === s.cell.palette.light && !b.solid && b.max[1] - b.min[1] < 0.06) b.kind = `lamp:${dark}`;
    for (const l of s.cell.lights) l.lampId = dark;
    const f = frontOf(ex, 0.6);
    ctx.addEntity('beacon', { type: 'soundBeacon', params: { pos: [f[0], s.cell.floorY + 1.2, f[2]], kind: ctx.rng.pick(['chime', 'drip', 'phoneRing']), period: ctx.rng.float(2.0, 3.2) } });
    const g = frontOf(ex, 0.05);
    ctx.addBox(box([g[0] - 0.2, s.cell.floorY + 2.15, g[2] - 0.2], [g[0] + 0.2, s.cell.floorY + 2.25, g[2] + 0.2], 'lightGreen', false));
  },
});

defineGimmick({
  id: 'switchDoor', name: 'スイッチで開く扉', axes: ['puzzle'], kinds: ['room', 'hall'], minSize: [4, 4], weight: 0.8, intensity: 0, onMainPath: true,
  // 脇の区画（本道でない）への扉があること
  fits: (s) => s.openings.some((o) => o !== s.entrance && o !== s.exit),
  build(ctx) {
    const s = ctx.slot;
    const side = s.openings.find((o) => o !== s.entrance && o !== s.exit && ctx.doorAt(o));
    if (!side) return;
    const door = ctx.doorAt(side)!;
    // ボタン: 扉から遠い壁
    const far = ([0, 1, 2, 3] as const).filter((d) => d !== side.dir).sort((a, b) => (a === ((side.dir + 2) % 4) ? -1 : 0) - (b === ((side.dir + 2) % 4) ? -1 : 0));
    for (const d of far) {
      const span = freeWallSpan(s, d, 0.6);
      if (!span) continue;
      const r = innerRect(s);
      const y = s.cell.floorY + 1.15;
      const wallC = d === 0 ? r.z1 : d === 2 ? r.z0 : d === 1 ? r.x1 : r.x0;
      const sgn = d === 0 || d === 1 ? -1 : 1;
      const bx = d === 0 || d === 2 ? { min: [span.at - 0.12, y, Math.min(wallC, wallC + sgn * 0.06)], max: [span.at + 0.12, y + 0.22, Math.max(wallC, wallC + sgn * 0.06)] } : { min: [Math.min(wallC, wallC + sgn * 0.06), y, span.at - 0.12], max: [Math.max(wallC, wallC + sgn * 0.06), y + 0.22, span.at + 0.12] };
      const btn = ctx.addEntity('button', { type: 'button', params: { box: { min: bx.min, max: bx.max }, mat: 'plasticRed' } });
      const latch = ctx.addEntity('latch', { type: 'latch', params: {}, inputs: { set: `${btn}.pressed` } });
      door.inputs = { ...(door.inputs ?? {}), open: `${latch}.out` };
      door.params.autoCloseSec = 0;
      // 扉の上に小さな赤い灯り（施錠の目印）
      const top = frontOf(side, 0.04);
      ctx.addBox(box([top[0] - 0.08, s.cell.floorY + 2.2, top[2] - 0.08], [top[0] + 0.08, s.cell.floorY + 2.3, top[2] + 0.08], 'neonRed', false));
      return;
    }
  },
});

defineGimmick({
  id: 'mannequin', name: '視線のマネキン', axes: ['sight'], kinds: ['room', 'hall'], minSize: [5, 6], weight: 0.7, intensity: 2, onMainPath: true,
  fits: (s) => !!s.entrance,
  build(ctx) {
    const s = ctx.slot;
    const r = innerRect(s, 0.4);
    const ent = s.entrance!;
    const e = frontOf(ent, 1.0);
    // 入口から最も遠い隅
    const corners: [number, number][] = [[r.x0 + 0.4, r.z0 + 0.4], [r.x1 - 0.4, r.z0 + 0.4], [r.x0 + 0.4, r.z1 - 0.4], [r.x1 - 0.4, r.z1 - 0.4]];
    const far = corners.sort((a, b) => Math.hypot(b[0] - e[0], b[1] - e[2]) - Math.hypot(a[0] - e[0], a[1] - e[2]))[0]!;
    const y = s.cell.floorY;
    const yaw = Math.atan2(e[0] - far[0], e[2] - far[1]);
    ctx.addEntity('figure', { type: 'mannequin', params: { pos: [far[0], y, far[1]], yaw, bounds: aabbJson({ min: [r.x0, y - 0.5, r.z0], max: [r.x1, y + 3, r.z1] }), speed: ctx.rng.float(1.6, 2.2) } });
    // 捕まったら部屋の入口から（入口の前に入ったらチェックポイント）
    const dz = doorZone(ent, y, 1.4, 0.2);
    ctx.addEntity('checkpoint', { type: 'checkpoint', params: { aabb: aabbJson(dz), pos: [e[0], y + 0.02, e[2]], yaw: Math.atan2(-(far[0] - e[0]), -(far[1] - e[2])) } });
    ctx.keepOut({ min: [far[0] - 0.6, y, far[1] - 0.6], max: [far[0] + 0.6, y + 2, far[1] + 0.6] });
  },
});
