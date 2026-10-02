/**
 * 地図の部品の描画（core/sim/parts/map）:
 * - mapBoard: 壁の地図（案内図・現在地の看板）と机の上の測量図。板の面に、フロアの形から描いた地図の絵（CanvasTexture）を貼る。
 *   絵は client/map/scene.ts の sceneOfReadable（嘘を含めて、描かれているとおり）を draw.ts の 'sign' の見た目で描く
 * - mapNote: 床に落ちている誰かの地図。鉛筆の線の紙（'paper' の見た目）
 * - landmark: 霧の中の塔の灯り（N05）。霧を通して見える（霧を掛けない材質）明滅する灯りと、ぼんやりした光の輪
 * - mapWall: 調べられる壁（BX04）。見た目は無く、調べたら壁を叩く音だけ
 * 絵は区画の焼き込みの明るさを測って暗くする（暗い部屋の板が光って見えないように）。document の無い環境（Node）では描かない。
 */
import * as THREE from 'three';
import type { Tuning } from '../../../core/config/tuning.ts';
import type { FloorLayout } from '../../../core/world/layout.ts';
import { drawMap, type DrawStyle } from '../../map/draw.ts';
import { buildMapInfo, type MapInfo, type MapReadable } from '../../map/MapInfo.ts';
import { readableContent, sceneOfReadable } from '../../map/scene.ts';
import { cellAt, sampleCellLight } from '../../world/FloorBuilder.ts';
import { defineView, type ViewContext } from '../views.ts';

const infos = new WeakMap<FloorLayout, MapInfo>();
/** フロアの地図の元（フロアごとに 1 つ） */
function infoOf(floor: FloorLayout, t: Tuning): MapInfo {
  let i = infos.get(floor);
  if (!i) { i = buildMapInfo(floor, t); infos.set(floor, i); }
  return i;
}

/** 区画の焼き込みの明るさ（0..1 に丸めた灰色） */
function brightness(ctx: ViewContext, at: [number, number, number]): number {
  const cell = cellAt(ctx.built, at);
  if (!cell) return 0.6;
  const l = sampleCellLight(cell, at, ctx.levelOf);
  return Math.max(0.18, Math.min(1, (l[0] + l[1] + l[2]) / 3 * 1.4));
}

/**
 * 地図の絵を描いた板（面の大きさ w × h）。rotation は地図の回転（壁の板は、板を見る人の前が上になるように回す。
 * 本物の「現在地」の看板と同じ。床・机の上の地図は回さない = 北が奥で、世界の向きとそのまま重なる）
 */
function boardMesh(info: MapInfo, r: MapReadable, w: number, h: number, style: DrawStyle, rotation = 0): { mesh: THREE.Mesh; dispose(): void } | null {
  if (typeof document === 'undefined') return null;
  const px = 512;
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = Math.max(64, Math.round((px * h) / Math.max(0.05, w)));
  const g = canvas.getContext('2d');
  if (!g) return null;
  const scene = sceneOfReadable(info, r);
  const c = readableContent(info, r);
  const label = style === 'paper' ? `${c.author ?? '誰か'} ${c.date ?? ''}`.trim() : c.title;
  drawMap(g, scene, { width: canvas.width, height: canvas.height, center: null, pxPerM: 40, style, label, pad: 26, dpr: 2, rotation });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  const geo = new THREE.PlaneGeometry(w, h);
  const mesh = new THREE.Mesh(geo, mat);
  return { mesh, dispose() { geo.dispose(); mat.dispose(); tex.dispose(); } };
}

function readable(type: 'mapBoard' | 'mapNote'): void {
  defineView(type, (spec, ctx) => {
    const info = infoOf(ctx.sim.floor, ctx.sim.tuning);
    const r = info.readables.find((x) => x.id === spec.id);
    const b = spec.params.box as { min: number[]; max: number[] } | undefined;
    if (!r || !b) return null;
    const min = b.min as [number, number, number], max = b.max as [number, number, number];
    const c: [number, number, number] = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    const n = Array.isArray(spec.params.normal) ? (spec.params.normal as number[]) : null;
    const flat = type === 'mapNote' || !n;
    // 板の面の大きさ（壁なら幅と高さ、床・机なら x と z）
    const sx = max[0] - min[0], sy = max[1] - min[1], sz = max[2] - min[2];
    const w = flat ? (type === 'mapNote' ? 0.28 : sx) : n![0] !== 0 ? sz : sx;
    const h = flat ? (type === 'mapNote' ? 0.2 : sz) : sy;
    // 壁の板: 板を見る人の向き（-normal）が地図の上
    const made = boardMesh(info, r, w, h, type === 'mapNote' ? 'paper' : 'sign', flat ? 0 : Math.atan2(n![0]!, n![1]!));
    if (!made) return null;
    const { mesh } = made;
    if (flat) {
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(c[0], type === 'mapNote' ? min[1] + 0.0105 : max[1] + 0.003, c[2]);
      if (type === 'mapNote') mesh.rotation.z = 0.35;
    } else {
      mesh.rotation.y = Math.atan2(n![0]!, n![1]!);
      mesh.position.set(c[0] + n![0]! * (sx < sz ? sx / 2 + 0.004 : 0.004), c[1], c[2] + n![1]! * (sz < sx ? sz / 2 + 0.004 : 0.004));
    }
    const k = brightness(ctx, [c[0] + (n?.[0] ?? 0) * 0.3, c[1], c[2] + (n?.[1] ?? 0) * 0.3]);
    (mesh.material as THREE.MeshBasicMaterial).color.setScalar(k);
    ctx.root.add(mesh);
    return {
      update() {},
      dispose() { mesh.removeFromParent(); made.dispose(); },
    };
  });
}
readable('mapBoard');
readable('mapNote');

/** 調べられる壁（BX04）: 見た目は無い。調べたら壁を叩く音（中が空洞の音） */
defineView('mapWall', (spec, ctx) => {
  const off = ctx.onEvent?.((e) => {
    if (e.type === 'cue' && e.entity === spec.id && e.data?.name === 'map.knock') ctx.audio?.play('knock', { ...(e.pos ? { pos: e.pos } : {}), gain: 0.8 });
  });
  return { update() {}, dispose() { off?.(); } };
});

/** 光の輪の絵（中心が明るい丸） */
function glowTexture(): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const s = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = s;
  const g = canvas.getContext('2d');
  if (!g) return null;
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

defineView('landmark', (spec, ctx) => {
  const p = Array.isArray(spec.params.pos) ? (spec.params.pos as number[]) : null;
  if (!p) return null;
  const color = new THREE.Color(typeof spec.params.color === 'number' ? spec.params.color : 0xff4030);
  // 灯り（霧を掛けない: 霧の中でも遠くから見える）
  const lampGeo = new THREE.SphereGeometry(0.16, 16, 10);
  const lampMat = new THREE.MeshBasicMaterial({ color, fog: false });
  const lamp = new THREE.Mesh(lampGeo, lampMat);
  lamp.position.set(p[0]!, p[1]!, p[2]!);
  ctx.root.add(lamp);
  const tex = glowTexture();
  let halo: THREE.Sprite | null = null;
  if (tex) {
    const mat = new THREE.SpriteMaterial({ map: tex, color, fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 });
    halo = new THREE.Sprite(mat);
    halo.scale.setScalar(2.4);
    halo.position.copy(lamp.position);
    ctx.root.add(halo);
  }
  let level = 1;
  return {
    update(_s, dt) {
      const on = ctx.sim.outputOf(spec.id, 'on') > 0.5 ? 1 : 0.18;
      level += (on - level) * Math.min(1, dt * 14);
      lampMat.color.copy(color).multiplyScalar(0.35 + 0.65 * level);
      if (halo) (halo.material as THREE.SpriteMaterial).opacity = 0.15 + 0.7 * level;
    },
    dispose() {
      lamp.removeFromParent(); lampGeo.dispose(); lampMat.dispose();
      if (halo) { halo.removeFromParent(); (halo.material as THREE.SpriteMaterial).dispose(); }
      tex?.dispose();
    },
  };
});
