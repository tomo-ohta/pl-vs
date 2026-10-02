/**
 * 写す物の描画（senseFx: photoGhost・cctv・mirror）。写した像にだけ写る物は LAYER_IMAGE に置く（画面のカメラには写らない）。
 * - photoGhost: 三脚のカメラを調べると、白い閃光とシャッターの音。隣の額に、カメラから撮った写真（その後は撮り直すまで同じ写真）
 * - cctv: 机のモニターに、天井の監視カメラの映像（画質の段で 5〜10 枚/秒、低い段は部屋に入ったときに 1 枚）
 * - mirror: 壁の鏡（Reflector。高い段 512 px・中 320 px。低い段は映らない暗いガラスに、扉の縁がうっすら）。鏡の中にだけ、向かいの壁の開いた扉
 */
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { defineFx } from './fx.ts';
import { Capture, disposeGroup, imageDoor, imageFigure } from './capture.ts';
import { doorNear, LAYER_IMAGE, onCue, playerInCell, ScreenVeil } from './common.ts';
import { doorOutline } from './fx.ts';

defineFx('photoGhost', (spec, ctx) => {
  const camSpec = ctx.sim.floor.entities.find((e) => e.id === spec.params.cam);
  if (!camSpec) return null;
  const eye = camSpec.params.eye as number[], look = camSpec.params.look as number[], frame = camSpec.params.frame as number[], fl = camSpec.params.frameLook as number[];
  const cap = new Capture(ctx, 0.56, 0.42, 58, 0xfff4e6);
  cap.aim(eye, look);
  cap.place(frame, [fl[0]! - frame[0]!, fl[1]! - frame[2]!]);
  // 写真の前の、白い台紙（撮る前）
  const blank = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.42), new THREE.MeshBasicMaterial({ color: 0x3a3632, fog: true }));
  blank.position.copy(cap.mesh.position);
  blank.rotation.copy(cap.mesh.rotation);
  blank.translateZ(0.002);
  const border = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.5), new THREE.MeshBasicMaterial({ color: 0xece6da, fog: true }));
  border.position.copy(cap.mesh.position);
  border.rotation.copy(cap.mesh.rotation);
  border.translateZ(-0.003);
  ctx.root.add(border, cap.mesh, blank);
  cap.enabled = false;
  // 写真にだけ写る物: 隠しの扉があれば開いた扉、無ければ人影
  const d = spec.params.door as number[];
  const dir = d[0]!, at = d[1]!, y = d[2]!;
  const wall = dir % 2 === 0 ? look[2]! : look[0]!;
  const cx = dir % 2 === 0 ? at : wall, cz = dir % 2 === 0 ? wall : at;
  const extra = doorNear(ctx, cx, cz, 0.9) ? imageDoor(dir, wall, at, y) : imageFigure(spec.params.ghost as number[], Math.atan2(eye[0]! - (spec.params.ghost as number[])[0]!, eye[2]! - (spec.params.ghost as number[])[2]!));
  ctx.root.add(extra);
  const veil = new ScreenVeil(ctx, 0xffffff);
  let flash = 0;
  const off = onCue(ctx, camSpec.id, (name) => {
    if (name !== 'photo.shot') return;
    ctx.audio?.play('shutterClick', { pos: eye as [number, number, number], gain: 0.9 });
    flash = 1;
    cap.enabled = true;
    cap.request();
    cap.onRendered = () => { blank.visible = false; cap.enabled = false; };
  });
  return {
    update(_s, dt) {
      flash = Math.max(0, flash - dt * 3.5);
      veil.set(flash * 0.85);
    },
    dispose() { off(); veil.dispose(); cap.dispose(); disposeGroup(blank); disposeGroup(border); disposeGroup(extra); },
  };
});

defineFx('cctv', (spec, ctx) => {
  const sc = spec.params.screen as number[], n = spec.params.screenNormal as number[];
  const cam = spec.params.cam as number[], look = spec.params.look as number[];
  const cap = new Capture(ctx, Number(spec.params.screenW ?? 0.56), Number(spec.params.screenH ?? 0.4), 70, 0xc8f0d8);
  cap.aim(cam, look);
  cap.place([sc[0]! + n[0]! * 0.012, sc[1]!, sc[2]! + n[1]! * 0.012], n);
  ctx.root.add(cap.mesh);
  // 映像の中だけ: 隠しの扉が開いている・自分の後ろに人が立っている
  const d = spec.params.door as number[];
  const dir = d[0]!, at = d[1]!, y = d[2]!;
  const r = ctx.sim.floor.cells.find((c) => c.id === spec.cell)!;
  const b = r.bounds;
  const wall = dir === 0 ? b.max[2] - 0.15 : dir === 2 ? b.min[2] + 0.15 : dir === 1 ? b.max[0] - 0.15 : b.min[0] + 0.15;
  const cx = dir % 2 === 0 ? at : wall, cz = dir % 2 === 0 ? wall : at;
  const extras: THREE.Group[] = [];
  if (doorNear(ctx, cx, cz, 0.9)) extras.push(imageDoor(dir, wall, at, y));
  const g = spec.params.ghost as number[];
  extras.push(imageFigure(g, Math.atan2(sc[0]! - g[0]!, sc[2]! - g[2]!)));
  for (const e of extras) ctx.root.add(e);
  let once = false;
  return {
    update() {
      const inside = playerInCell(ctx, spec.cell);
      cap.enabled = inside;
      if (inside && !once) { cap.request(); once = true; }
      if (!inside) once = false;
    },
    dispose() { cap.dispose(); for (const e of extras) disposeGroup(e); },
  };
});

defineFx('mirror', (spec, ctx) => {
  const dir = Number(spec.params.dir), at = Number(spec.params.at), y = Number(spec.params.y), wall = Number(spec.params.wall);
  const w = Number(spec.params.w ?? 1.9), h = Number(spec.params.h ?? 2.0);
  const inward = dir === 0 || dir === 1 ? -1 : 1;
  const alongX = dir === 0 || dir === 2;
  const pos: [number, number, number] = alongX ? [at, y + 0.2 + h / 2, wall + inward * 0.04] : [wall + inward * 0.04, y + 0.2 + h / 2, at];
  const normal = alongX ? [0, inward] : [inward, 0];
  const yaw = Math.atan2(normal[0]!, normal[1]!);
  const q = ctx.quality?.();
  const objs: THREE.Object3D[] = [];
  let reflector: Reflector | null = null;
  if (q && q.id !== 'low') {
    const px = q.id === 'high' ? 512 : 320;
    reflector = new Reflector(new THREE.PlaneGeometry(w, h), { textureWidth: px, textureHeight: Math.round((px * h) / w), color: 0xb8bcc0, clipBias: 0.003, multisample: 0 });
    // 鏡のカメラは、鏡の中にだけ写る物（LAYER_IMAGE）も描く。カメラの子（画面の幕）は持たない
    const cams = new WeakMap<THREE.Camera, THREE.PerspectiveCamera>();
    reflector.getReflectionCamera = (camera: THREE.Camera): THREE.PerspectiveCamera => {
      let c = cams.get(camera);
      if (!c) { c = new THREE.PerspectiveCamera(); c.layers.enable(LAYER_IMAGE); cams.set(camera, c); }
      return c;
    };
    reflector.position.set(...pos);
    reflector.rotation.y = yaw;
    objs.push(reflector);
  } else {
    // 低い段: 暗いガラス
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0x15181c, fog: true }));
    m.position.set(...pos);
    m.rotation.y = yaw;
    objs.push(m);
  }
  // 鏡の中にだけ写る、向かいの壁の開いた扉（隠しの扉が付いているときだけ）
  const d = spec.params.door as number[];
  const odir = d[0]!;
  const cell = ctx.sim.floor.cells.find((c) => c.id === spec.cell)!;
  const b = cell.bounds;
  const owall = odir === 0 ? b.max[2] - 0.15 : odir === 2 ? b.min[2] + 0.15 : odir === 1 ? b.max[0] - 0.15 : b.min[0] + 0.15;
  const ocx = odir % 2 === 0 ? d[1]! : owall, ocz = odir % 2 === 0 ? owall : d[1]!;
  if (doorNear(ctx, ocx, ocz, 0.9)) {
    objs.push(imageDoor(odir, owall, d[1]!, d[2]!));
    if (!reflector) {
      // 低い段: 鏡の上に扉の縁をうっすら描く（映り込みの代わり）
      const o = doorOutline(dir, wall + inward * 0.05, at, y, 1.0, 2.0, 0xd8c8a0);
      o.mat.opacity = 0.18;
      objs.push(o.group);
    }
  }
  for (const o of objs) ctx.root.add(o);
  return {
    update() { /* 映り込みは Reflector が描くたびに作る */ },
    dispose() { for (const o of objs) { if (o === reflector) { reflector.dispose(); o.removeFromParent(); } else disposeGroup(o); } },
  };
});

