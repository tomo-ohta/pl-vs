import * as THREE from 'three';
import { DEFAULT_STYLE, makeStyle, type StylePreset } from '../render/Style.ts';
import { Builder } from '../scenes/Builder.ts';
import type { BuiltScene, SceneContext, SceneDef, StyleZone } from '../scenes/types.ts';
import type { Lamp } from '../render/Lamps.ts';
import { makeGlassStreaks, makeGrille, makeServerAtlas } from './serverroom/atlas.ts';
import { buildWalls } from './serverroom/building.ts';
import { Doors } from './serverroom/doors.ts';
import { glassMaterial } from './serverroom/glass.ts';
import { DOORS, ROOMS, ROOM_IDS, spaceAt, type RoomId } from './serverroom/layout.ts';
import { LOOKS, toneHex } from './serverroom/looks.ts';
import { VcMats } from './serverroom/mats.ts';
import { plan } from './serverroom/plan.ts';
import { buildServerRoom, type RoomEnv } from './serverroom/room.ts';
import { makeSigns } from './serverroom/signs.ts';
import { buildSpaces, type SpaceEnv } from './serverroom/spaces.ts';
import { CAM_A, CAM_B, CAM_C } from './serverroom/views.ts';

/**
 * サーバールーム（参考画像 serverroom-0〜2。利用者のフォルダ名は severroom）。
 * 通信ビルのデータセンターの 1 フロア（間取り図は serverroom/plan.ts・数は serverroom/layout.ts）。
 * - 3 枚の参考画像は、同じ造りの 3 つのサーバー室（A・B・C）のコールドアイルから北の扉を見た視点
 * - 形: serverroom/room.ts（サーバー室）・rack.ts（ラック）・overhead.ts（天井のケーブルラック・垂れたケーブル）・building.ts（壁）・
 *       spaces.ts（廊下・機械室・開梱室・荷捌き場・監視室・階段・空調機械室）・doors.ts（扉）
 * - 図柄: serverroom/atlas.ts（機器の前面と LED・背面・吹き出しの床・ガラスの映り込み）・signs.ts（表示板）
 * - 材質: serverroom/mats.ts（頂点の色の材質・色の表）・glass.ts（フレネルのガラス）
 * - 小物: serverroom/props/（見本帳は props/gallery.ts）
 */
const style = makeStyle(DEFAULT_STYLE, {
  name: 'serverroom',
  background: '#0b2230',
  fog: { horizon: '#56b4d0', zenith: '#56b4d0', density: 0.05, heightFalloff: 0, baseHeight: 0, start: 2, max: 0.75, steps: 0 },
  toon: { amount: 1, thresholds: [1.35, 0.7, 0.42], soft: 0.02, noiseAmp: 0.04, noiseScale: 1.2, shade: [0.78, 0.95, 4], dark: [0.55, 0.95, 8], hi: [1.12, 0.8, -4], bounce: 0.22 },
  post: {
    bloom: { strength: 0.35, threshold: 1.0, radius: 0.5 },
    diffusion: { amount: 0.1, threshold: 0.7, radius: 0.6 },
    lines: { enabled: true, color: '#06161f', width: 1, depth: 0.08, normal: 0.6, id: 0.0, breakup: 0.1, fadeFar: 18, opacity: 0.6 },
  },
});

function roomStyle(id: RoomId): StylePreset {
  const L = LOOKS[id];
  return makeStyle(style, {
    name: `serverroom-${id}`,
    fog: { horizon: L.fog, zenith: L.fog, density: L.fogDensity, start: L.fogStart, heightFalloff: L.fogHeight ?? 0, baseHeight: 0 },
    post: {
      grade: { ...style.post.grade, saturation: L.saturation },
      lines: { ...style.post.lines, opacity: L.lines ?? style.post.lines.opacity },
      kuwahara: L.kuwahara ? { enabled: true, radius: L.kuwahara, sharpness: 8, aniso: 1, scale: 0.5 } : style.post.kuwahara,
    },
  });
}
/** サーバー室の外（廊下・機械室など）: 霧は薄く（部屋が狭く、奥まで霞むと平らになる） */
const SUPPORT_STYLE = makeStyle(style, {
  name: 'serverroom-support',
  fog: { density: 0.03, start: 4 },
  // 壁（縦の面）は陰の段、床と灯りの下だけ日なた（暗い部屋に光だまり。参考画像の暗い設備と明るい床の幅）
  toon: { ...style.toon, thresholds: [1.3, 0.85, 0.45] },
});
/** 部屋ごとの見た目（霧の色と濃さ。参考画像ごとの空気） */
const ROOM_STYLE: Record<RoomId, StylePreset> = {
  A: roomStyle('A'),
  B: roomStyle('B'),
  C: roomStyle('C'),
};

export const serverroom: SceneDef = {
  id: 'serverroom',
  label: 'サーバールーム',
  style,
  plan,
  sky: false,
  views: [
    { id: 'serverroom-0', label: 'サーバー室 B の通路から北の扉', ...CAM_B.def(), style: ROOM_STYLE.B },
    { id: 'serverroom-1', label: 'サーバー室 C の通路から北の扉', ...CAM_C.def(), style: ROOM_STYLE.C },
    { id: 'serverroom-2', label: 'サーバー室 A の通路から北の扉', ...CAM_A.def(), style: ROOM_STYLE.A },
  ],
  build(ctx) {
    const root = new THREE.Group();
    const vc = new VcMats(ctx, { shade: '#8ea4b4', dark: '#5a7080', hi: '#ffffff' });
    const atlas = makeServerAtlas(11);
    const face = ctx.mat({ color: '#ffffff', shade: '#c6d4dc', dark: '#a0b4c0', map: atlas.map, line: 0.3, noise: [0, 1], shadowQuant: false, name: 'sr-face' });
    (face as THREE.MeshStandardMaterial).emissiveMap = atlas.emissive;
    (face as THREE.MeshStandardMaterial).emissive.set('#ffffff');
    (face as THREE.MeshStandardMaterial).emissiveIntensity = 2.2;
    const streaks = makeGlassStreaks(5);
    const glass = glassMaterial({ map: streaks, color: '#1c4d60', opacity: 0.12, edgeColor: '#6cc4dc', edgeOpacity: 0.62, power: 2.2 });
    const refl = ctx.addReflector({ x: 0, y: 0, z: 0 });
    const reflection = { texture: refl.target.texture, matrix: refl.matrix, strength: 0.5, fresnel: 0.25, distort: 0.002 };
    const floor = ctx.mat({
      color: '#86dcf0',
      shade: '#6cc0da',
      dark: '#4f9ab8',
      hi: '#a6ecfa',
      tiles: { size: 0.6, line: 0.008, color: '#5fb2cc', jitter: 0.03 },
      reflection,
      noise: [0.5, 1],
      name: 'sr-floor',
    });
    const grille = ctx.mat({ color: '#ffffff', map: makeGrille(), transparent: true, depthWrite: false, unlit: true, line: 0.2, name: 'sr-grille' });
    // 建物の間仕切り・外壁の室内の面: 細かい縦の筋（マイクロリブ）の金属の壁の板。筋は板の形（色は板ごとに同じ。継ぎ目の押さえは dress.ts）
    const wall = ctx.mat({ color: '#3584a0', shade: '#2c7088', dark: '#205a70', hi: '#5fb0c8', tiles: { size: [0.05, 100], line: 0.016, color: '#2d7690', jitter: 0 }, noise: [0.35, 1], name: 'sr-wall' });
    const outer = ctx.mat({ color: '#3f97b4', shade: '#347f9a', dark: '#26647c', tiles: { size: [0.05, 100], line: 0.016, color: '#368aa6', jitter: 0 }, name: 'sr-outer' });
    const env: RoomEnv = {
      ctx,
      vc,
      rack: { face, glass, atlas },
      floor,
      wall,
      ceil: ctx.mat({ color: '#1d5a70', shade: '#164a5e', dark: '#0f3444', tiles: { size: 0.6, line: 0.02, color: '#2a6a82', jitter: 0.04 }, name: 'sr-ceil' }),
      grille,
      plenum: ctx.mat({ color: '#0a2532', shade: '#071c26', dark: '#04121a', name: 'sr-plenum' }),
    };
    const signs = makeSigns();
    const senv: SpaceEnv = {
      ctx,
      vc,
      rack: env.rack,
      signs,
      signMat: ctx.mat({ color: '#ffffff', shade: '#c6d4dc', dark: '#a0b4c0', map: signs.tex, line: 0.4, noise: [0, 1], shadowQuant: false, name: 'sr-signs' }),
      grille,
      mats: {
        // 床: 廊下 = 0.3 m 角のビニルのタイル（1 枚ごとに少し違う色）、壁ぎわの帯 = 濃い色のタイルの見切り
        corrFloor: ctx.mat({ color: '#7cc8da', shade: '#62adc2', dark: '#4a8ea4', tiles: { size: 0.3, line: 0.006, color: '#5fa9be', jitter: 0.14 }, reflection: { ...reflection, strength: 0.45 }, name: 'sr-corr-floor' }),
        corrBorder: ctx.mat({ color: '#4f98ae', shade: '#42849a', dark: '#336c80', tiles: { size: 0.3, line: 0.006, color: '#3f879c', jitter: 0.06 }, reflection: { ...reflection, strength: 0.38 }, name: 'sr-corr-border' }),
        epoxy: ctx.mat({ color: '#5aa3b6', shade: '#4a8c9f', dark: '#376f80', tiles: { size: 1.2, line: 0.01, color: '#3f8496', jitter: 0.1 }, flecks: { scale: 4, density: 0.08, color: '#6fb4c6', length: 0.35, width: 0.04, color2: '#4a8ea0', density2: 0.08 }, reflection: { ...reflection, strength: 0.42 }, name: 'sr-epoxy' }),
        // タイルカーペット（0.5 m 角。向きを変えて敷くので 1 枚ごとに明暗が違う）
        carpet: ctx.mat({ color: '#28627a', shade: '#1f5164', dark: '#163c4b', tiles: { size: 0.5, line: 0.004, color: '#1d566c', jitter: 0.16 }, name: 'sr-carpet' }),
        concrete: ctx.mat({ color: '#5e9aaa', shade: '#4d8494', dark: '#3a6a78', tiles: { size: 2.0, line: 0.012, color: '#43788a', jitter: 0.05 }, flecks: { scale: 6, density: 0.12, color: '#6fa9b8', length: 0.3, width: 0.05, color2: '#4a8090', density2: 0.1 }, name: 'sr-concrete' }),
        // 天井: 監視室 = 0.6 m の格子の天井の板（板ごとに少し違う）、ほか = 打ち放しの床の裏のデッキの溝（0.15 m おき）
        ceilGrid: ctx.mat({ color: '#2f7a92', shade: '#24647a', dark: '#1a4a5c', tiles: { size: 0.6, line: 0.018, color: '#4f9bb3', jitter: 0.08 }, name: 'sr-ceil-grid' }),
        ceilDark: ctx.mat({ color: '#123d4f', shade: '#0e3343', dark: '#092431', tiles: { size: [0.15, 40], line: 0.055, color: '#0a2835', jitter: 0.0 }, name: 'sr-ceil-dark' }),
        tileFloor: ctx.mat({ color: '#6db4c8', shade: '#5a9cb0', dark: '#44808f', tiles: { size: 0.6, line: 0.012, color: '#3f8aa0', jitter: 0.12 }, reflection: { ...reflection, strength: 0.45 }, name: 'sr-tile-floor' }),
        // 背の高い部屋の内張り: 台形の山の鋼板（0.1 m おきの山。1 枚の板の山は同じ色）
        corrugated: ctx.mat({ color: '#2f7a94', shade: '#27677e', dark: '#1d5064', tiles: { size: [0.1, 40], line: 0.032, color: '#22617a', jitter: 0 }, noise: [0.35, 1], name: 'sr-corrugated' }),
        // 監視室の壁: 縦の羽板の吸音の板（羽板 7.5 cm おき・間の暗い溝）
        acoustic: ctx.mat({ color: '#2a6f88', shade: '#235e74', dark: '#1a4a5c', tiles: { size: [0.075, 40], line: 0.022, color: '#1a5064', jitter: 0 }, noise: [0.35, 1], name: 'sr-acoustic' }),
        // 腰の帯（床から 1.15 m）: 濃い色の金属の板（同じ細かい縦の筋）
        dado: ctx.mat({ color: '#1a4e62', shade: '#164456', dark: '#103545', tiles: { size: [0.05, 100], line: 0.018, color: '#0f3444', jitter: 0 }, name: 'sr-dado' }),
        // 建物の壁と同じ細かい縦の筋の板（階段の間の壁など）
        panel: wall,
        beam: ctx.mat({ color: '#2f7690', shade: '#225e74', dark: '#163f50', hi: '#4f9cb4', name: 'sr-beam' }),
        grating: ctx.mat({ color: '#6fa3b0', shade: '#5a8a97', dark: '#40707c', tiles: { size: [0.1, 0.03], line: 0.012, color: '#3d6a76' }, name: 'sr-grating' }),
      },
    };

    // 部屋ごとの灯り（見えない部屋の灯りは消す。毎フレーム目に近い 16 個しか使えないので、壁の向こうの灯りに枠を取られない）
    const lampsOf = new Map<string, Lamp[]>();
    const ctxFor = (id: string): SceneContext => ({
      ...ctx,
      addLamp: (l: Lamp) => {
        const x = ctx.addLamp(l);
        let arr = lampsOf.get(id);
        if (!arr) lampsOf.set(id, (arr = []));
        arr.push(x);
        return x;
      },
    });
    senv.ctxFor = ctxFor;
    // 部屋ごとの Builder（見えない部屋を描かないため・材質ごとにまとめるのも部屋ごと）
    const builders = new Map<string, Builder>();
    const bOf = (id: string): Builder => {
      let b = builders.get(id);
      if (!b) builders.set(id, (b = new Builder(ctx)));
      return b;
    };
    // サーバー室ごとの材質（参考画像ごとの色合い: looks.ts）
    const floorMats = new Set<THREE.Material>([floor]);
    ROOM_IDS.forEach((id, i) => {
      const L = LOOKS[id];
      const rf = ctx.mat({
        color: L.floor[0],
        shade: L.floor[1],
        dark: L.floor[2],
        hi: L.floor[3],
        tiles: { size: 0.6, line: 0.008, color: L.joint, jitter: 0.03 },
        reflection: { ...reflection, strength: L.reflect, fresnel: 0.15, distort: 0.004, posterize: 5 },
        noise: [0.5, 1],
        name: `sr-floor-${id}`,
      });
      floorMats.add(rf);
      const rface = ctx.mat({ color: L.faceTint ?? '#ffffff', shade: L.faceTint ?? '#c6d4dc', dark: L.faceTint ?? '#a0b4c0', map: atlas.map, line: 0.3, noise: [0, 1], shadowQuant: false, name: `sr-face-${id}` });
      (rface as THREE.MeshStandardMaterial).emissiveMap = atlas.emissive;
      (rface as THREE.MeshStandardMaterial).emissive.set('#ffffff');
      (rface as THREE.MeshStandardMaterial).emissiveIntensity = L.led;
      const g = L.glass;
      const renv: RoomEnv = {
        ...env,
        ctx: ctxFor(id),
        vc: new VcMats(ctx, { shade: '#8ea4b4', dark: '#5a7080', hi: '#ffffff', name: `sr-vc-${id}`, remap: (hex) => toneHex(hex, L.tone) }),
        rack: { face: rface, glass: glassMaterial({
          map: streaks,
          color: g.color,
          opacity: g.opacity,
          edgeColor: g.edge,
          edgeOpacity: g.edgeOpacity,
          power: g.power,
          floorGlow: g.floorGlow,
          reflect: { strength: g.reflect ?? 0, aisle: ROOMS[id].aisle, rackH: ROOMS[id].rackH },
          reflColors: { rack: g.rack ?? '#0b2633', frame: g.frame ?? '#2f7f9c', light: g.light ?? '#7fd4ec' },
        }), atlas },
        floor: rf,
        handle: L.handle,
        wall: ctx.mat({ color: L.wall[0], shade: L.wall[1], dark: L.wall[2], hi: L.wall[3], tiles: { size: [1.2, 2.4], line: 0.006, color: L.wall[1], jitter: 0.02 }, name: `sr-wall-${id}` }),
        // 側の壁（ホットアイルの壁。視点からは列に隠れる）: 廊下・機械室と同じ細かい縦の筋の金属の板
        side: ctx.mat({ color: L.wall[2], shade: L.wall[2], dark: L.ceil[2], hi: L.wall[1], tiles: { size: [0.05, 100], line: 0.016, color: toneHex(L.wall[2], [0.9, 1, 0]), jitter: 0 }, name: `sr-side-${id}` }),
        ceil: ctx.mat({ color: L.ceil[0], shade: L.ceil[1], dark: L.ceil[2], tiles: { size: 0.6, line: 0.02, color: L.ceil[0], jitter: 0.04 }, name: `sr-ceil-${id}` }),
        dado: senv.mats.dado,
        signMat: senv.signMat,
        signAtlas: signs,
      };
      buildServerRoom(renv, bOf(id), ROOMS[id], 100 + i * 37);
    });
    buildSpaces(senv, bOf);
    const wallsB = new Builder(ctx);
    buildWalls(wallsB, vc, wall, outer);
    wallsB.finalize();
    root.add(wallsB.root);
    for (const [id, b] of builders) {
      b.finalize();
      b.root.name = `space-${id}`;
      root.add(b.root);
    }
    // 扉（部屋ごとの見た目: A = 大きなガラスの窓、C = 横の銘板）
    const doors = new Doors(ctx, vc);
    // 写っていない扉は網入りのガラスの窓・蹴板・ドアクローザー付き（service）
    for (const d of DOORS) doors.add(d, d.id === 'dA' ? 'glass' : d.id === 'dC' ? 'bar' : d.id === 'dB' ? 'plain' : 'service', d.id === 'dA' ? LOOKS.A.door : d.id === 'dB' ? LOOKS.B.door : d.id === 'dC' ? LOOKS.C.door : undefined);
    root.add(doors.root);

    // 床そのものは映り込みに出さない
    floorMats.add(senv.mats.corrFloor);
    floorMats.add(senv.mats.corrBorder);
    floorMats.add(senv.mats.epoxy);
    floorMats.add(senv.mats.tileFloor);
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && floorMats.has(m.material as THREE.Material)) refl.hide.push(m);
    });
    // 照明: 半球光（上から明るく・下から暗く）。面の向きで段を選ぶだけ（参考画像に落ちる影はほとんど無い）
    const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, Math.PI);
    hemi.color.setRGB(0.95, 0.95, 0.95);
    hemi.groundColor.setRGB(0.6, 0.6, 0.6);
    root.add(hemi);

    // ---- 見えない部屋を描かない ----
    // 今いる部屋と、開いている扉（開きかけ・閉じかけも）の向こうの部屋を描く。開口（開梱室 ↔ 荷捌き場）はいつも。
    // 閉じた扉の向こうは見えないので描かない（扉は 1.9 m で開き、離れると閉じる）
    const doorLinks = DOORS.filter((d) => d.kind !== 'lift' && d.kind !== 'shutter' && d.state !== 'locked').map((d) => {
      const mid = (d.a + d.b) / 2;
      const c = d.wall === 'x' ? new THREE.Vector2(mid, d.line) : new THREE.Vector2(d.line, mid);
      const n = d.wall === 'x' ? new THREE.Vector2(0, 0.4) : new THREE.Vector2(0.4, 0);
      const s0 = spaceAt(c.x - n.x, c.y - n.y)?.id;
      const s1 = spaceAt(c.x + n.x, c.y + n.y)?.id;
      return { id: d.id, c, s0, s1, always: d.state === 'open' };
    });
    const cull = (p: THREE.Vector3, all: boolean): void => {
      const here = spaceAt(p.x, p.z)?.id;
      const vis = new Set<string>();
      if (here) vis.add(here);
      for (const l of doorLinks) {
        if (!l.s0 || !l.s1) continue;
        const near = l.always || doors.openness(l.id) > 0.001;
        if (near && (l.s0 === here || l.s1 === here)) {
          vis.add(l.s0);
          vis.add(l.s1);
        }
      }
      for (const [id, b] of builders) b.root.visible = all || !here || vis.has(id);
      for (const [id, ls] of lampsOf) {
        const on = all || !here || vis.has(id);
        for (const l of ls) l.on = on;
      }
    };

    const v = CAM_B.def();
    // 部屋ごとの見た目の区域（サーバー室の中だけ。ほかは場面の見た目）
    const zones: StyleZone[] = ROOM_IDS.map((id) => ({ min: [ROOMS[id].x0 - 0.1, -2, -12.1], max: [ROOMS[id].x1 + 0.1, 6, 4.1], style: ROOM_STYLE[id] }));
    zones.push({ min: [-100, -10, -100], max: [100, 20, 100], style: SUPPORT_STYLE });
    const built: BuiltScene = {
      root,
      styleZones: zones,
      spawn: { pos: [v.eye[0], 0, v.eye[2]], yaw: v.yaw },
      update(dt, _t, camera) {
        doors.update(dt, camera.position);
      },
      beforeRender(camera, o) {
        cull(camera.position, !!o?.map);
      },
    };
    return built;
  },
};
