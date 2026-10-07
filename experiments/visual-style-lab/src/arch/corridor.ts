import * as THREE from 'three';
import { DEFAULT_STYLE, makeStyle, type StylePreset } from '../render/Style.ts';
import { decalMaterial } from '../render/Decal.ts';
import { setStyleColors } from '../render/StyleMaterial.ts';
import { Builder } from '../scenes/Builder.ts';
import { Atlas } from '../scenes/corridor/kit.ts';
import { CAM0 } from '../scenes/corridor/seg0.ts';
import { CAM1 } from '../scenes/corridor/seg1.ts';
import { CAM2 } from '../scenes/corridor/seg2.ts';
import { CAM3 } from '../scenes/corridor/seg3.ts';
import type { BuiltScene, SceneDef, StyleZone, ViewDef } from '../scenes/types.ts';
import { Doors } from './corridor/doors.ts';
import { dressLeg, dressRoomExtras, TRACKED_LAMPS, zoneDecals } from './corridor/dress.ts';
import { dressRoom, Mats, palette, ROOM_FLECKS } from './corridor/furnish.ts';
import { LEGS, ROOMS, rectWorld, type LegId, type RoomDef } from './corridor/layout.ts';
import { Leg } from './corridor/leg.ts';
import { buildLegA, type LegCtx } from './corridor/legA.ts';
import { buildLegB } from './corridor/legB.ts';
import { buildLegC } from './corridor/legC.ts';
import { buildLegD } from './corridor/legD.ts';
import { corridorPlan } from './corridor/plan.ts';
import { mountable, RefVis } from './corridor/probe.ts';
import { type RoomPalette, roomShell } from './corridor/rooms.ts';
import { buildStairHall, dressStairs, type StairFrame } from './corridor/stairs.ts';

/**
 * 病院の病棟（建築版）。複廊下型の一般病棟 1 看護単位: 中央のコアを 4 本の廊下が環状に囲み、外側に病室。
 * 参考画像 corridor-0〜3 は 4 本の廊下（区画 A〜D）のそれぞれの始まりから突き当たりの防火戸を見た視点（間取り図は corridor/plan.ts）。
 * 廊下の見た目は元の版（src/scenes/corridor/seg0〜3）を写して、回した座標系（corridor/leg.ts）で置いた。
 * 部屋は間取り図の数値から作り（corridor/rooms.ts）、部屋の種類ごとの決まりで物を置く（corridor/furnish.ts）。
 *
 * 照明は元の版と同じ: 半球光（上から暗く・下から明るく）と真上に近い平行光。平行光の向きは今いる区画の座標系に合わせて回す
 * （元の版の各廊下の影の向きと同じになる）。影は動かない物だけなので影の地図は区画が変わった時だけ描き直す。
 */

const SKY_F = 0.45;
const GROUND_F = 1.45;
const SUN_F = 0.8;
/** 太陽の向き（区域の座標。元の版と同じ傾き） */
const SUN_DIR = new THREE.Vector3(-0.35, 1, -0.25).normalize();

const base = makeStyle(DEFAULT_STYLE, {
  name: 'corridor-arch',
  background: '#c9d6bd',
  fog: { horizon: '#d6e2c6', zenith: '#d6e2c6', density: 0.0, heightFalloff: 0, baseHeight: 0, start: 6, max: 0.4, steps: 0 },
  toon: { amount: 1, thresholds: [2.4, 0.72, 0.22], soft: 0.01, noiseAmp: 0.06, noiseScale: 1.6, shade: [0.8, 0.95, 6], dark: [0.62, 0.95, 12], hi: [1.06, 0.7, -4] },
  shadowJitter: 0.035,
  post: {
    bloom: { strength: 0, threshold: 1.0, radius: 0.6 },
    diffusion: { amount: 0, threshold: 0.8, radius: 0.6 },
    lines: { enabled: true, color: '#2e3b40', width: 1, depth: 0.06, normal: 0.5, id: 0.0, breakup: 0.25, fadeFar: 24, opacity: 0.85 },
    kuwahara: { enabled: false, radius: 3, sharpness: 8, aniso: 1, scale: 0.5 },
    grade: { exposure: 1, lift: 0, gamma: 1, gain: 1, saturation: 1, hue: 0, tint: [0, 0], posterize: 0, vignette: 0, grain: 0 },
  },
});
// 区画ごとの線（元の版の視点ごとの値）
const STYLES: Record<LegId, StylePreset> = {
  A: makeStyle(base, { name: 'corridor-0', post: { lines: { enabled: true, color: '#2e3b40', width: 1, depth: 0.05, normal: 0.6, id: 0, breakup: 0.06, fadeFar: 24, opacity: 0.75 } } }),
  B: makeStyle(base, { name: 'corridor-1', post: { lines: { enabled: true, color: '#3a4a46', width: 1, depth: 0.08, normal: 0.75, id: 0, breakup: 0.3, fadeFar: 14, opacity: 0.5 } } }),
  C: makeStyle(base, { name: 'corridor-2', post: { lines: { enabled: true, color: '#2a4044', width: 1.3, depth: 0.05, normal: 0.6, id: 0, breakup: 0.08, fadeFar: 26, opacity: 0.95 } } }),
  D: makeStyle(base, { name: 'corridor-3', post: { lines: { enabled: true, color: '#1d2e33', width: 1, depth: 0.08, normal: 0.75, id: 0, breakup: 0.3, fadeFar: 16, opacity: 0.6 } } }),
};

const CAMS = { A: CAM0, B: CAM1, C: CAM2, D: CAM3 };

const LABELS: Record<LegId, string> = { A: '掲示板とカート（東の廊下）', B: '2 色の影と窓の光（北の廊下）', C: '格子の天井と白いポール（西の廊下）', D: '青緑の壁と医療カート（南の廊下）' };
const IDS: LegId[] = ['A', 'B', 'C', 'D'];

const views: ViewDef[] = IDS.map((id) => {
  const leg = LEGS[id];
  const c = CAMS[id];
  const e: [number, number, number] = [leg.origin[0], c.eye[1], leg.origin[2]];
  return { id: leg.view, label: LABELS[id], eye: e, yaw: leg.yaw + c.yaw, pitch: c.pitch, roll: c.roll, fov: c.fov, style: STYLES[id] };
});

/** 階段室の座標系（北: 原点は待避の場所と階段の境・扉の側の壁。南は 180° 回す） */
function stairFrame(r: RoomDef): StairFrame {
  return r.id === 'STN'
    ? { origin: [1.6, 0, r.rect[3]], yaw: 0, refuge: 1.6 - r.rect[0], shaft: r.rect[2] - 1.6, depth: r.rect[3] - r.rect[1] }
    : { origin: [-21.2, 0, r.rect[1]], yaw: Math.PI, refuge: r.rect[2] + 21.2, shaft: -21.2 - r.rect[0], depth: r.rect[3] - r.rect[1] };
}

/** 場面の点がどの区画か（部屋 → 廊下の順に探す） */
function zoneAt(x: number, z: number): LegId | null {
  for (const r of ROOMS) {
    const [x0, z0, x1, z1] = r.rect;
    if (x >= x0 - 0.05 && x <= x1 + 0.05 && z >= z0 - 0.05 && z <= z1 + 0.05) return r.zone;
  }
  for (const id of IDS) {
    const L = LEGS[id];
    const [x0, z0, x1, z1] = rectWorld(L, [L.left - 0.7, L.endBack, L.right + 0.9, L.cornerEnd]);
    if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return id;
  }
  return null;
}

/** 区画の見た目の箱（部屋 → 廊下。先に書いた方が優先） */
function zoneBoxes(): StyleZone[] {
  const out: StyleZone[] = [];
  for (const r of ROOMS) {
    const [x0, z0, x1, z1] = r.rect;
    out.push({ min: [x0 - 0.05, -4, z0 - 0.05], max: [x1 + 0.05, 7, z1 + 0.05], style: STYLES[r.zone] });
  }
  for (const id of IDS) {
    const L = LEGS[id];
    const [x0, z0, x1, z1] = rectWorld(L, [L.left - 0.7, L.endBack, L.right + 0.9, L.cornerEnd]);
    out.push({ min: [x0, -4, z0], max: [x1, 7, z1], style: STYLES[id] });
  }
  return out;
}

export const corridor: SceneDef = {
  id: 'corridor',
  label: '病院の病棟（建築版）',
  style: base,
  sky: false,
  plan: corridorPlan,
  views,
  build(ctx) {
    const root = new THREE.Group();
    TRACKED_LAMPS.length = 0;
    // 掲示物の図柄（廊下の分と部屋の分。色はキャンバスの色そのまま）
    const atlas = new Atlas(2048);
    const paperMat = ctx.mat({ color: '#ffffff', shade: '#c4c8bc', dark: '#9da396', hi: '#ffffff', map: atlas.tex, line: 0.7 });
    const atlas2 = new Atlas(2048);
    const paperMat2 = ctx.mat({ color: '#ffffff', shade: '#c4c8bc', dark: '#9da396', hi: '#ffffff', map: atlas2.tex, line: 0.7 });
    const mats = new Mats(ctx);
    const doors = new Doors(ctx);

    // 部屋の色（区画の色の表。外周の南の部屋は青緑の壁）
    const pals = new Map<string, RoomPalette>();
    for (const r of ROOMS) {
      const p = palette(mats, r.zone, (r.ext?.length ?? 0) > 0);
      // 水まわり（浴室・脱衣室・トイレ・汚物処理室）の壁はタイル
      if (r.kind === 'bath' || r.kind === 'toilet' || r.kind === 'dress' || r.kind === 'dirty') {
        const c = (p.wall as THREE.MeshStandardMaterial).color.getHexString();
        p.wall = mats.get(`#${c}`, undefined, 0.4, { tiles: { size: [0.2, 0.2], line: 0.006, color: '#9fb1a4', jitter: 0.03 } });
        p.wallSide = undefined;
      } else {
        // 壁の白い傷（区域の描き方）
        const fl = { flecks: ROOM_FLECKS[r.zone] };
        p.wall = mats.get(`#${(p.wall as THREE.MeshStandardMaterial).color.getHexString()}`, undefined, 0.4, fl);
        if (p.wallSide?.w) p.wallSide.w = mats.get(`#${(p.wallSide.w as THREE.MeshStandardMaterial).color.getHexString()}`, undefined, 0.4, fl);
      }
      // 壁の足元の帯（区域の描き方）と、写っていない所の飾りが物を貼ってよい面
      p.band = zoneDecals(mats, r.zone);
      p.windowLight = mats.once('windowLight', () => decalMaterial({ color: '#f3f9df', rag: 0.035, scale: 5 }));
      mountable(p.wall, p.floor, p.ceil, p.wallSide?.w);
      pals.set(r.id, p);
    }
    // 描いた影（参考画像の視点からだけ影に見える形）。視点から離れる・向きが変わると下の面の色へ溶かす
    const fades: { view: LegId; mat: THREE.Material; from: THREE.Color; to: THREE.Color; k: number }[] = [];
    const lc: LegCtx = {
      doors,
      fade: (view, mat, under) => fades.push({ view, mat, from: (mat as THREE.MeshStandardMaterial).color.clone(), to: new THREE.Color(under), k: 0 }),
      roomWall: (id) => pals.get(id)!.wall,
      roomDoor: (id) => pals.get(id)!.door,
    };

    // 廊下（区画ごとに 1 つの Builder。まとめて描くのも区画ごと）
    const builders = new Map<string, Builder>();
    const bOf = (key: string): Builder => {
      let b = builders.get(key);
      if (!b) builders.set(key, (b = new Builder(ctx)));
      return b;
    };
    const legOf = (id: LegId): Leg => new Leg(bOf(`leg${id}`), ctx, LEGS[id].origin, CAMS[id], LEGS[id].yaw);
    buildLegA(legOf('A'), atlas, paperMat, lc);
    buildLegB(legOf('B'), atlas, paperMat, lc);
    buildLegC(legOf('C'), atlas, paperMat, lc);
    buildLegD(legOf('D'), atlas, paperMat, lc);

    // 部屋（部屋ごとに 1 つの Builder。見えない部屋は描かない）
    ROOMS.forEach((r: RoomDef, i) => {
      if (r.closed) return;
      const b = bOf(`room:${r.id}`);
      const p = pals.get(r.id)!;
      if (r.kind === 'stair') {
        roomShell(b, ctx, r, p, doors, { floor: false, ceil: false });
        buildStairHall(b, ctx, r, stairFrame(r), p, mats, atlas2, paperMat2);
        return;
      }
      roomShell(b, ctx, r, p, doors);
      dressRoom({ ctx, b, mats, zone: r.zone, atlas: atlas2, paperMat: paperMat2, seed: 1000 + i * 37 }, r);
    });
    // ---- 写っていない所の作り込み（dress.ts の決まり）----
    // 参考画像の視点から見えるかは、廊下の形と閉じた扉で調べる（見える所には足さない）
    const atlas3 = new Atlas(2048);
    const paperMat3 = ctx.mat({ color: '#ffffff', shade: '#c4c8bc', dark: '#9da396', hi: '#ffffff', map: atlas3.tex, line: 0.7 });
    const env = { ctx, mats, atlas: atlas3, paperMat: paperMat3 };
    const vis = new RefVis(views, [...IDS.map((id) => bOf(`leg${id}`).root), doors.root]);
    ROOMS.forEach((r, i) => {
      if (r.closed) return;
      const b = bOf(`room:${r.id}`);
      const open = r.doors.some((d) => d.leaf === 'open');
      if (r.kind === 'stair') {
        // 階段室: 扉の内側の一時待避の場所だけ（階段は stairs.ts）
        const north = r.id === 'STN';
        const rect: [number, number, number, number] = north ? [r.rect[0], r.rect[1], 1.6, r.rect[3]] : [-21.2, r.rect[1], r.rect[2], r.rect[3]];
        dressRoomExtras(env, b, doors.root, { ...r, rect }, 5000 + i * 31, { vis: null });
        dressStairs(env, b, r, stairFrame(r), 6000 + i * 13);
        return;
      }
      dressRoomExtras(env, b, doors.root, r, 5000 + i * 31, { vis: open ? vis : null });
    });
    for (const id of IDS) {
      const L = LEGS[id];
      const leg = new Leg(bOf(`leg${id}`), ctx, L.origin, CAMS[id], L.yaw);
      dressLeg(env, L, leg, doors.root, { vis, h: L.ceil, pilaster: { from: 0.9, depth: id === 'D' ? 0.18 : id === 'C' ? 0.25 : 0.3 } }, 7000 + IDS.indexOf(id) * 97);
    }
    atlas.tex.needsUpdate = true;
    atlas2.tex.needsUpdate = true;
    atlas3.tex.needsUpdate = true;

    // ---- 照明 ----
    const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, Math.PI);
    hemi.color.setRGB(SKY_F, SKY_F, SKY_F);
    hemi.groundColor.setRGB(GROUND_F, GROUND_F, GROUND_F);
    root.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, SUN_F * Math.PI);
    const center = new THREE.Vector3(-9.8, 0, -7.5);
    sun.target.position.copy(center);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 110 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0002;
    sun.shadow.normalBias = 0.02;
    root.add(sun, sun.target);
    ctx.setSun(sun);

    for (const [key, b] of builders) {
      b.finalize();
      b.root.name = key;
      root.add(b.root);
    }
    root.add(doors.root);

    // ---- 見えない所を描かない ----
    // 部屋の中は閉じた扉と壁でふさがれていて、扉は 1.9〜2.2 m まで近づかないと開かない。そこで部屋（と廊下の区画）は、
    // 目がその場所から 3 m 以内にある時だけ描く。扉の無い口（デイルーム・エレベーターホールなど）はつながる廊下の全体から見える。
    // 真上の図（beforeRender の o.map）では全部描く
    const grow = (r: [number, number, number, number], d: number): [number, number, number, number] => [r[0] - d, r[1] - d, r[2] + d, r[3] + d];
    const legRect = (id: LegId): [number, number, number, number] => {
      const L = LEGS[id];
      return rectWorld(L, [L.left - 0.7, L.endBack, L.right + 0.9, L.cornerEnd]);
    };
    const roomRect = (id: string): [number, number, number, number] => ROOMS.find((x) => x.id === id)!.rect;
    const seeFrom: Record<string, string[]> = {
      DAY: ['legC'], EV: ['legB', 'NS'], CONF: ['NS'], EQC: ['TRT'], LOCK: ['STF'], W3t: ['W3'], BTH: ['DRS'],
      legC: ['DAY'], legB: ['EV'],
    };
    const rectOf = (key: string): [number, number, number, number] => (key.startsWith('leg') ? legRect(key.slice(3) as LegId) : roomRect(key));
    const cullList: { obj: THREE.Object3D; rects: [number, number, number, number][] }[] = [];
    for (const [key, b] of builders) {
      const k = key.startsWith('room:') ? key.slice(5) : key;
      const rects = [grow(rectOf(k), 3.0), ...(seeFrom[k] ?? []).map((x) => grow(rectOf(x), 0.5))];
      cullList.push({ obj: b.root, rects });
    }
    const cull = (p: THREE.Vector3, all: boolean): void => {
      let changed = false;
      for (const c of cullList) {
        const v = all || c.rects.some((r) => p.x >= r[0] && p.x <= r[2] && p.z >= r[1] && p.z <= r[3]);
        if (c.obj.visible !== v) {
          c.obj.visible = v;
          changed = true;
        }
      }
      // 影の地図は描く物が変わった時だけ描き直す
      if (changed && !all) ctx.updateShadows();
    };

    let curYaw = NaN;
    const setSun = (yaw: number): void => {
      if (yaw === curYaw) return;
      curYaw = yaw;
      const d = SUN_DIR.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      sun.position.copy(center).addScaledVector(d, 50);
      sun.updateMatrixWorld();
      sun.target.updateMatrixWorld();
      sun.shadow.camera.updateMatrixWorld();
      ctx.updateShadows();
    };
    setSun(0);
    const dirV = new THREE.Vector3();
    const tmpC = new THREE.Color();
    const fadeShadows = (camera: THREE.Camera): void => {
      camera.getWorldDirection(dirV);
      const camYaw = Math.atan2(-dirV.x, -dirV.z);
      for (const f of fades) {
        const v = views[IDS.indexOf(f.view)];
        const d = Math.hypot(camera.position.x - v.eye[0], camera.position.z - v.eye[2]);
        let dy = Math.abs(camYaw - v.yaw) % (Math.PI * 2);
        if (dy > Math.PI) dy = Math.PI * 2 - dy;
        const k = Math.max(THREE.MathUtils.smoothstep(d, 0.8, 3.0), THREE.MathUtils.smoothstep(dy, 0.35, 0.9));
        if (Math.abs(k - f.k) < 0.01 && k !== 0 && k !== 1) continue;
        if (k === f.k) continue;
        f.k = k;
        tmpC.lerpColors(f.from, f.to, k);
        const hex = `#${tmpC.getHexString()}`;
        setStyleColors(f.mat, ctx.style, { color: hex, shade: hex, dark: hex, hi: hex });
      }
    };
    // 灯りの光だまりは、目がその灯りの箱から 3 m 以内の時だけ点ける
    const lamps = [...TRACKED_LAMPS];
    const lampsNear = (p: THREE.Vector3, all: boolean): void => {
      for (const l of lamps) {
        const b = l.box;
        l.on = all || !b || (p.x > b[0] - 3 && p.x < b[3] + 3 && p.z > b[2] - 3 && p.z < b[5] + 3 && p.y > b[1] - 3 && p.y < b[4] + 3);
      }
    };
    const v0 = views[0];
    const built: BuiltScene = {
      root,
      spawn: { pos: [v0.eye[0], 0, v0.eye[2]], yaw: v0.yaw, pitch: v0.pitch },
      staticShadows: true,
      styleZones: zoneBoxes(),
      update(dt, _t, camera) {
        doors.update(dt, camera.position);
      },
      beforeRender(camera, o) {
        // 真上の図（o.map）では全部描く
        if (o?.map) {
          cull(camera.position, true);
          lampsNear(camera.position, true);
          return;
        }
        lampsNear(camera.position, false);
        const z = zoneAt(camera.position.x, camera.position.z);
        if (z) setSun(LEGS[z].yaw);
        cull(camera.position, false);
        fadeShadows(camera);
      },
    };
    // 確かめ用（全部の扉を開けて撮る）
    (built as unknown as { __doors: Doors }).__doors = doors;
    return built;
  },
};
