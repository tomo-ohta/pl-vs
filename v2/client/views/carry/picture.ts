/**
 * 絵の描き方（canvas）: タイルの絵（PZ04。seed で決まる絵）・配置図（PZ08）・足跡の図（PZ12）・楽譜（U11）。
 * タイルの絵は、タイル 1 枚ずつの上の面に、絵の一部（UV の範囲）として貼る。canvas はブラウザだけ（Node では作らない）
 */
import * as THREE from 'three';
import type { EntitySpec } from '../../../core/world/layout.ts';
import { CANVAS } from './puzzle.ts';

/** seed で決まる絵: 夕焼けの空・地平線・真ん中の扉・円と帯（タイルの縁で絵がつながるのが分かるように、大きな形を横切らせる） */
export function drawPicture(g: CanvasRenderingContext2D, W: number, H: number, seed: number): void {
  let k = (seed * 9301 + 49297) % 233280 || 1;
  const rnd = (): number => { k = (k * 16807) % 2147483647; return k / 2147483647; };
  const hue = Math.floor(rnd() * 360);
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, `hsl(${hue}, 55%, 35%)`);
  sky.addColorStop(0.6, `hsl(${(hue + 40) % 360}, 70%, 65%)`);
  sky.addColorStop(1, `hsl(${(hue + 60) % 360}, 50%, 30%)`);
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  // 太陽（大きな円）
  g.fillStyle = `hsl(${(hue + 180) % 360}, 80%, 70%)`;
  g.beginPath(); g.arc(W * (0.2 + rnd() * 0.6), H * (0.2 + rnd() * 0.25), W * 0.16, 0, Math.PI * 2); g.fill();
  // 帯（斜めに横切る）
  g.strokeStyle = `hsl(${(hue + 90) % 360}, 60%, 50%)`; g.lineWidth = W * 0.06;
  g.beginPath(); g.moveTo(0, H * (0.3 + rnd() * 0.4)); g.lineTo(W, H * (0.3 + rnd() * 0.4)); g.stroke();
  // 地平線と床の目地
  g.fillStyle = `hsl(${hue}, 25%, 22%)`; g.fillRect(0, H * 0.68, W, H * 0.32);
  g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 2;
  for (let i = -6; i <= 6; i++) { g.beginPath(); g.moveTo(W / 2 + i * W * 0.02, H * 0.68); g.lineTo(W / 2 + i * W * 0.18, H); g.stroke(); }
  // 真ん中の扉
  g.fillStyle = '#1b1a20';
  const dw = W * 0.18, dh = H * 0.42, dx = W / 2 - dw / 2, dy = H * 0.68 - dh;
  g.fillRect(dx, dy, dw, dh);
  g.fillStyle = '#f2d080'; g.fillRect(dx + dw * 0.78, dy + dh * 0.55, dw * 0.08, dh * 0.05);
  g.strokeStyle = '#f2e6c0'; g.lineWidth = W * 0.012; g.strokeRect(dx, dy, dw, dh);
}

const cache = new Map<number, THREE.CanvasTexture>();

/** 絵の texture（seed ごとに 1 つ。Node では null） */
export function pictureTexture(seed: number): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  let t = cache.get(seed);
  if (!t) {
    const cv = document.createElement('canvas');
    cv.width = 384; cv.height = 384;
    const g = cv.getContext('2d');
    if (g) drawPicture(g, cv.width, cv.height, seed);
    t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    cache.set(seed, t);
  }
  return t;
}

/** タイルの上の面: 絵の pic 番目（N × N の升目の、i = pic % N・k = pic / N）。原点中心・幅 w の正方形（上向き） */
export function tileTop(w: number, pic: number, n: number, seed: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(w, w);
  geo.rotateX(-Math.PI / 2);
  const i = pic % n, k = Math.floor(pic / n);
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  for (let j = 0; j < uv.count; j++) {
    uv.setXY(j, (i + uv.getX(j)) / n, 1 - (k + 1 - uv.getY(j)) / n);
  }
  const tex = pictureTexture(seed);
  // Node（絵なし）では、升目ごとに色を変えて見分ける
  const mat = tex ? new THREE.MeshBasicMaterial({ map: tex, color: 0xd8d8d8 }) : new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(pic / (n * n), 0.5, 0.5) });
  return new THREE.Mesh(geo, mat);
}

// ---------------------------------------------------------------- canvas の絵（carryDecor の view 'canvas'）
CANVAS.tiles = (g, W, H, spec) => drawPicture(g, W, H, Number(spec.params.picSeed ?? 0));

/** 配置図: 部屋の外形・入口の切れ目・扉の位置の線と、家具の印（■ 椅子・● 丸椅子・▲ 鉢植え・★ 電気スタンド） */
CANVAS.plan = (g, W, H, spec: EntitySpec) => {
  const aspect = Number(spec.params.aspect ?? 1.3);
  const pad = 14;
  const bw = Math.min(W - 2 * pad, (H - 2 * pad) * aspect), bh = bw / aspect;
  const ox = (W - bw) / 2, oy = (H - bh) / 2;
  g.fillStyle = '#efe9d6'; g.fillRect(ox, oy, bw, bh);
  g.strokeStyle = '#3c3428'; g.lineWidth = 4; g.strokeRect(ox, oy, bw, bh);
  const at = (p: number[]): [number, number] => [ox + p[0]! * bw, oy + p[1]! * bh];
  const ent = spec.params.ent as number[] | undefined;
  if (ent) { const [x, y] = at(ent); g.fillStyle = '#efe9d6'; g.fillRect(x - 14, y - 6, 28, 12); g.fillStyle = '#7a6e58'; g.font = '14px sans-serif'; g.fillText('入口', x - 14, Math.min(H - 4, y + 20)); }
  const door = spec.params.door as number[] | undefined;
  if (door) { const [x, y] = at(door); g.strokeStyle = '#a03020'; g.lineWidth = 3; g.setLineDash([5, 4]); g.strokeRect(x - 14, y - 6, 28, 12); g.setLineDash([]); }
  for (const m of (spec.params.marks as (string | number)[][] | undefined) ?? []) {
    const [x, y] = at([Number(m[1]), Number(m[2])]);
    g.fillStyle = '#2c4a7a';
    const s = 9;
    g.beginPath();
    if (m[0] === 'chair') g.rect(x - s, y - s, 2 * s, 2 * s);
    else if (m[0] === 'stool') g.arc(x, y, s, 0, Math.PI * 2);
    else if (m[0] === 'plant') { g.moveTo(x, y - s * 1.2); g.lineTo(x + s, y + s); g.lineTo(x - s, y + s); g.closePath(); }
    else { for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5 - Math.PI / 2, rr = i % 2 ? s * 0.45 : s * 1.1; if (i) g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); }
    g.fill();
  }
};

/** 足跡の図: N × N の升目に、踏む順の足跡（番号の代わりに、だんだん濃くなる足の形）。入口の側が下 */
CANVAS.feet = (g, W, H, spec: EntitySpec) => {
  const n = Number(spec.params.n ?? 4);
  const pattern = (spec.params.pattern as number[] | undefined) ?? [];
  const d = Number(spec.params.entDir ?? 0);
  const pad = 18, cs = Math.min(W, H - 20) / n - 2 * pad / n;
  const ox = (W - cs * n) / 2, oy = (H - 20 - cs * n) / 2;
  // 升目 (i, k) → 図の (列, 行)。入口の壁が下になるように回す
  const map = (c: number): [number, number] => {
    const i = c % n, k = Math.floor(c / n);
    if (d === 0) return [i, k];
    if (d === 2) return [n - 1 - i, n - 1 - k];
    if (d === 1) return [n - 1 - k, i];
    return [k, n - 1 - i];
  };
  g.strokeStyle = '#5a5040'; g.lineWidth = 2;
  for (let a = 0; a <= n; a++) { g.beginPath(); g.moveTo(ox + a * cs, oy); g.lineTo(ox + a * cs, oy + n * cs); g.stroke(); g.beginPath(); g.moveTo(ox, oy + a * cs); g.lineTo(ox + n * cs, oy + a * cs); g.stroke(); }
  pattern.forEach((c, j) => {
    const [col, row] = map(c);
    const x = ox + (col + 0.5) * cs, y = oy + (row + 0.5) * cs;
    g.fillStyle = `rgba(60, 40, 30, ${0.25 + (0.7 * j) / Math.max(1, pattern.length - 1)})`;
    g.beginPath(); g.ellipse(x - cs * 0.1, y, cs * 0.09, cs * 0.18, -0.2, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(x + cs * 0.12, y - cs * 0.05, cs * 0.09, cs * 0.18, 0.2, 0, Math.PI * 2); g.fill();
  });
  g.fillStyle = '#7a6e58'; g.font = '16px sans-serif'; g.fillText('入口', W / 2 - 16, H - 4);
};

/** 楽譜: 5 本の線と、音の高さの点（鍵盤の番号）。左から順に */
CANVAS.sheet = (g, W, H, spec: EntitySpec) => {
  const notes = (spec.params.melody as number[] | undefined) ?? [];
  const keys = Number(spec.params.keys ?? 8);
  g.strokeStyle = '#3c3428'; g.lineWidth = 2;
  for (let i = 0; i < 5; i++) { const y = H * 0.25 + (i * H * 0.5) / 4; g.beginPath(); g.moveTo(10, y); g.lineTo(W - 10, y); g.stroke(); }
  notes.forEach((nt, i) => {
    const x = 30 + ((W - 60) * (i + 0.5)) / notes.length;
    const y = H * 0.8 - (nt / Math.max(1, keys - 1)) * H * 0.6;
    g.fillStyle = '#1c1a18'; g.beginPath(); g.ellipse(x, y, 9, 7, -0.4, 0, Math.PI * 2); g.fill();
    g.fillRect(x + 7, y - 34, 2.5, 34);
  });
};
