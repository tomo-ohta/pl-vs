import * as THREE from 'three';
import { DEFAULT_STYLE, makeStyle } from '../render/Style.ts';
import { Builder } from '../scenes/Builder.ts';
import type { BuiltScene, SceneDef } from '../scenes/types.ts';
import { Doors } from './pastel/doors.ts';
import { furnishAll } from './pastel/furnish.ts';
import { BLDG, ROOMS, T_EXT, WINDOWS, type Rect } from './pastel/layout.ts';
import { buildOutside } from './pastel/outside.ts';
import { Paints } from './pastel/paint.ts';
import { pastelPlan } from './pastel/plan.ts';
import { buildDoors, buildWindow, glassMaterial, roomShell, roomStyle } from './pastel/shell.ts';
import { buildStairHall } from './pastel/stairs.ts';
import { buildReveals, buildStructure } from './pastel/trim.ts';
import { buildView } from './pastel/view.ts';

/**
 * 淡色の廊下（建築版）。昭和初期の町の診療所の 1 階（外来）: 南の玄関 → 待合（参考画像の目の位置）→ 北へまっすぐの廊下
 * → 奥のホール → 通用口。廊下の東に診察室 2・処置室、西に受付・薬局・医局・倉庫、奥に検査室・便所・階段室・給湯室。
 * 間取り図は pastel/plan.ts、寸法は pastel/layout.ts。
 *
 * 見た目は元の版（src/scenes/pastel.ts）と同じ「照明を使わない面ごとの色」（PaintMaterial）。参考画像に写る所は
 * 元の版の形と色をそのまま写し（pastel/view.ts）、写っていない所は同じ色の表から部屋の種類ごとに色と物を決めた。
 * 床・壁の足元の白い斑（雪）は上から見た 1 枚の分布の絵（pastel/paint.ts）で、外への開口と壁ぎわほど多い。
 */
const style = makeStyle(DEFAULT_STYLE, {
  name: 'pastel-arch',
  background: '#c9d3c8',
  fog: { horizon: '#dfe3d4', zenith: '#dfe3d4', density: 0.0, heightFalloff: 0, baseHeight: 0, start: 6, max: 0.5, steps: 0 },
  post: {
    lines: { enabled: false, color: '#3c4346', width: 1, depth: 0.12, normal: 0.9, id: 0, breakup: 0.55, fadeFar: 12, opacity: 0.5 },
    kuwahara: { enabled: false, radius: 3, sharpness: 8, aniso: 1 },
    grade: { exposure: 1, lift: 0, gamma: 1, gain: 1, saturation: 1, hue: 0, tint: [0, 0], posterize: 0, vignette: 0, grain: 0 },
  },
});

const EYE = 1.25;

/** 部屋が見える所（その部屋の外から開いた口・窓口・まっすぐの廊下で見通せる部屋） */
const SEE_FROM: Record<string, string[]> = {
  LOBBY: ['VEST', 'COR', 'BACK', 'W1', 'PORCH'],
  VEST: ['LOBBY', 'COR'],
  W1: ['LOBBY'],
  E4: ['BACK', 'COR'],
  STAIR: ['BACK', 'COR'],
};

export const pastel: SceneDef = {
  id: 'pastel',
  label: '淡色の廊下（建築版）',
  style,
  sky: false,
  plan: pastelPlan,
  views: [{ id: 'pastel-0', label: '待合から廊下の奥を見る', eye: [0, EYE, 0], yaw: 0.034, pitch: 0.028, fov: 44.39 }],
  build(ctx) {
    const root = new THREE.Group();
    const p = new Paints();
    const glass = glassMaterial();
    const builders = new Map<string, Builder>();
    const bOf = (k: string): Builder => {
      let b = builders.get(k);
      if (!b) builders.set(k, (b = new Builder(ctx)));
      return b;
    };

    // 参考画像に写る所（元の版の形）
    const vm = buildView(bOf('view'), p.snow);

    // 床（建物全体で 1 枚。雪の分布の絵を読む）と、風除室・通用口の土間
    const fb = bOf('floor');
    const floor = p.floor();
    fb.boxMM(floor, [BLDG.x0 - T_EXT, -0.3, BLDG.z0 - T_EXT], [BLDG.x1 + T_EXT, 0, BLDG.z1 + T_EXT], { collide: true, shadow: false });
    fb.boxMM(floor, [-1.65, -0.3, BLDG.z1 + T_EXT], [1.65, 0, 5.05], { collide: true, shadow: false });
    fb.boxMM(floor, [-1.65, -0.3, -23.35], [1.65, 0, BLDG.z0 - T_EXT], { collide: true, shadow: false });
    // 扉の敷居で区切られた部屋の床（筋の少ない床。待合・廊下・奥のホールは参考画像の床のまま）。床の板の上に 3 mm
    const roomFloor = p.roomFloor();
    for (const r of ROOMS) {
      if (r.view || r.kind === 'lobby') continue;
      const [x0, z0, x1, z1] = r.rect;
      fb.boxMM(roomFloor, [x0, 0, z0], [x1, 0.003, z1], { shadow: false });
    }

    // 部屋の殻・窓
    for (const r of ROOMS) {
      if (r.view) continue;
      const b = bOf(r.id);
      const st = roomStyle(p, r);
      if (r.kind === 'stair') {
        buildStairHall(b, ctx, p, st, glass);
        continue;
      }
      roomShell(b, p, r, st, { skip: r.id === 'LOBBY' ? ['n'] : [] });
      // 柱型・隅の柱・梁（部屋の種類ごとの決まり。trim.ts）
      buildStructure(b, p, r, st);
      for (const w of WINDOWS) if (w.room === r.id) buildWindow(b, ctx, p, w, glass);
    }
    // 扉（近づくと開く）
    const doors = new Doors(ctx);
    buildDoors(bOf('doorFrames'), ctx, p, doors, vm, glass);
    // 戸口の内側（壁の厚みの面）の暗い内張りと敷居
    buildReveals(bOf('doorFrames'), p);
    // 部屋の種類ごとの物
    furnishAll(ctx, p, bOf);
    // 外
    buildOutside(bOf('outside'), p);

    for (const [k, b] of builders) {
      b.finalize();
      b.root.name = k;
      root.add(b.root);
    }
    // 外（空・野原・木立）は真上の図の範囲に入れない（App の真上の図は 'sky' という名前の物を範囲から外す）
    const outside = builders.get('outside')!.root;
    outside.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.name = 'sky';
    });
    root.add(doors.root);

    // ---- 見えない部屋を描かない ----
    // 部屋は閉じた扉と壁でふさがれていて、扉は 1.7〜1.9 m まで近づかないと開かない。そこで部屋は、目がその部屋から 4 m 以内か、
    // 開いた口・窓口で見通せる場所（SEE_FROM）にある時だけ描く。参考画像に写る所・床・扉の枠・外はいつも描く
    const grow = (r: Rect, d: number): Rect => [r[0] - d, r[1] - d, r[2] + d, r[3] + d];
    const rectOf = (id: string): Rect => ROOMS.find((x) => x.id === id)!.rect;
    const cullList: { obj: THREE.Object3D; rects: Rect[] }[] = [];
    for (const [k, b] of builders) {
      const r = ROOMS.find((x) => x.id === k);
      if (!r) continue;
      cullList.push({ obj: b.root, rects: [grow(r.rect, 4), ...(SEE_FROM[k] ?? []).map((x) => grow(rectOf(x), 0.3))] });
    }
    const cull = (pos: THREE.Vector3, all: boolean): void => {
      for (const c of cullList) c.obj.visible = all || c.rects.some((r) => pos.x >= r[0] && pos.x <= r[2] && pos.z >= r[1] && pos.z <= r[3]);
    };

    // 物ごとの一番低い所（真上の図で天井を抜くため）
    const high = new Map<THREE.Object3D, number>();
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && !o.name.startsWith('sky')) high.set(o, new THREE.Box3().setFromObject(o).min.y);
    });
    const built: BuiltScene = {
      root,
      spawn: { pos: [0, 0, 0], yaw: 0.034 },
      update(dt, _t, camera) {
        doors.update(dt, camera.position);
      },
      beforeRender(camera, o) {
        cull(camera.position, !!o?.map);
        // 真上の図では外（空・野原）と、天井などの高い所だけの物を描かない（塗りの材質は切り取りの面が効かないので）
        outside.visible = !o?.map;
        for (const [m, y] of high) m.visible = !o?.map || y < 2.0;
      },
    };
    (built as unknown as { __doors: Doors }).__doors = doors;
    return built;
  },
};
