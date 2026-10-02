/**
 * 文字の板（warpSign・異変の廊下の周の数の札）。文字は canvas に描いてテクスチャにする（document の無い試験では無地の板）。
 */
import * as THREE from 'three';
import { defineView } from '../views.ts';

export interface TextPlane {
  mesh: THREE.Mesh;
  /** 文字を描き直す（同じ文字なら何もしない）。flip で上下逆さまに描く */
  set(lines: readonly string[], flip?: boolean): void;
  dispose(): void;
}

/**
 * 幅 w・高さ h の文字の板。style 'board' は白地に濃い灰色の文字（壁の掲示）、'plate' は黒地に黄色の文字（天井から下がる札。少し光る）
 */
export function textPlane(w: number, h: number, style: 'board' | 'plate'): TextPlane {
  const geo = new THREE.PlaneGeometry(w, h);
  const bg = style === 'plate' ? '#141414' : '#ecebe4';
  const fg = style === 'plate' ? '#f2c230' : '#30302c';
  const doc = typeof document !== 'undefined' ? document : null;
  const canvas = doc ? doc.createElement('canvas') : null;
  const tex = canvas ? new THREE.CanvasTexture(canvas) : null;
  if (canvas) { canvas.width = 512; canvas.height = Math.max(64, Math.round((512 * h) / w)); }
  if (tex) tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ color: tex ? 0xffffff : style === 'plate' ? 0x202020 : 0xe0e0d8, fog: true, ...(tex ? { map: tex } : {}) });
  if (style === 'board') mat.color.setScalar(0.62);
  const mesh = new THREE.Mesh(geo, mat);
  let last = '';
  return {
    mesh,
    set(lines, flip = false) {
      const key = `${flip ? '!' : ''}${lines.join('\n')}`;
      if (key === last || !canvas || !tex) return;
      last = key;
      const c = canvas.getContext('2d');
      if (!c) return;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.fillStyle = bg;
      c.fillRect(0, 0, canvas.width, canvas.height);
      if (flip) { c.translate(canvas.width, canvas.height); c.rotate(Math.PI); }
      c.fillStyle = fg;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      const n = Math.max(1, lines.length);
      const size = Math.min(canvas.height / (n * 1.35), (canvas.width * 0.9) / Math.max(1, ...lines.map((l) => l.length)));
      c.font = `bold ${Math.round(size)}px sans-serif`;
      lines.forEach((l, i) => c.fillText(l, canvas.width / 2, (canvas.height * (i + 0.5)) / n));
      tex.needsUpdate = true;
    },
    dispose() { mesh.removeFromParent(); geo.dispose(); mat.dispose(); tex?.dispose(); },
  };
}

/** 板を置く: 真ん中 pos、表が向き dir（0:+Z 1:+X 2:-Z 3:-X）を向く */
export function placePlane(mesh: THREE.Object3D, pos: readonly number[], dir: number): void {
  mesh.position.set(pos[0]!, pos[1]!, pos[2]!);
  mesh.rotation.y = ((dir & 3) * Math.PI) / 2;
}

defineView('warpSign', (spec, ctx) => {
  const w = typeof spec.params.w === 'number' ? spec.params.w : 1;
  const h = typeof spec.params.h === 'number' ? spec.params.h : 0.6;
  const p = textPlane(w, h, spec.params.style === 'plate' ? 'plate' : 'board');
  placePlane(p.mesh, (spec.params.pos as number[] | undefined) ?? [0, 0, 0], typeof spec.params.dir === 'number' ? spec.params.dir : 0);
  p.set(((spec.params.lines as string[] | undefined) ?? []).map(String));
  ctx.root.add(p.mesh);
  return { update() {}, dispose() { p.dispose(); } };
});
