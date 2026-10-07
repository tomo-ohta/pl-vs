import * as THREE from 'three';

/**
 * 間取り図（建築版）。参考画像の場所が現実にあったらどういう建物・敷地か、を先に決めて書く設計の図。
 * - 場面を作る前に書く（部屋・通路・階段・階・出入口・視点の位置と画角・歩いて確かめる道順）
 * - 図に描いて（`drawPlan`）、視点の画角に「参考画像に無い物」が入らないかを確かめる
 * - 場面はこの図のとおりに作る。作った後は真上の図（`--top`）に図の輪郭を重ねて、図どおりかを確かめる
 * 座標は場面と同じ（m。x 右・z 手前・y 上）。図では上が奥（-Z）。
 */

export type V2 = [number, number];

export type SpaceKind =
  | 'corridor' // 廊下・通路
  | 'room' // 部屋
  | 'hall' // 広間・吹き抜け・ホール
  | 'stair' // 階段・斜路
  | 'lift' // エレベーター
  | 'platform' // ホーム・台
  | 'track' // 線路
  | 'water' // 水面・プール
  | 'outdoor' // 屋外（地面・中庭）
  | 'service' // 設備・倉庫など（入れない所も）
  | 'void'; // 入れない（見えるだけ・吹き抜けの穴）

export interface PlanSpace {
  id: string;
  label: string;
  kind: SpaceKind;
  /** 多角形（x, z）。四角なら rect = [x0, z0, x1, z1] */
  poly?: V2[];
  rect?: [number, number, number, number];
  /** 床の高さ・天井の高さ（m。屋外は天井なし） */
  floor: number;
  ceiling?: number;
  /** 階（図を階ごとに分けて描く。既定 0） */
  level?: number;
  /** 歩いて入れない（見えるだけ・鍵の掛かった部屋） */
  closed?: boolean;
  /** 何のための場所か・何があるか（作り込みの指示） */
  note?: string;
}

export type OpeningKind = 'door' | 'double-door' | 'fire-door' | 'opening' | 'window' | 'gate' | 'stair' | 'crossing';

export interface PlanOpening {
  kind: OpeningKind;
  /** 中心の位置（x, z） */
  at: V2;
  /** 幅（m） */
  width: number;
  /** 開口が付く壁の向き: 'x' = x 軸に沿った壁（z 一定）、'z' = z 軸に沿った壁（x 一定）、数値 = 壁の向き（x 軸から z 軸へのラジアン。斜めの壁） */
  wall: 'x' | 'z' | number;
  /** 開いている / 閉じている（見えるが通れない）/ 鍵（通れない） */
  state?: 'open' | 'closed' | 'locked';
  level?: number;
  note?: string;
}

export interface PlanWall {
  a: V2;
  b: V2;
  kind?: 'wall' | 'glass' | 'fence' | 'railing' | 'partition';
  level?: number;
}

export interface PlanTourStop {
  label: string;
  eye: [number, number, number];
  yaw: number;
  pitch?: number;
  /** 縦の画角（度。既定 60） */
  fov?: number;
}

export interface FloorPlan {
  id: string;
  title: string;
  /** どんな建物・敷地か（現実の類型と、その根拠） */
  typology: string;
  spaces: PlanSpace[];
  walls?: PlanWall[];
  openings: PlanOpening[];
  /** 歩いて確かめる道順（参考画像の視点の間・外。`--tour` で撮る） */
  tour: PlanTourStop[];
  /** 判断の記録（参考画像同士の矛盾をどう解いたか・現実離れした所とその理由） */
  notes?: string[];
}

export function spacePoly(s: PlanSpace): V2[] {
  if (s.poly) return s.poly;
  const [x0, z0, x1, z1] = s.rect!;
  return [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ];
}

export function planBounds(plan: FloorPlan, extra: V2[] = []): [number, number, number, number] {
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  const add = (p: V2): void => {
    x0 = Math.min(x0, p[0]);
    z0 = Math.min(z0, p[1]);
    x1 = Math.max(x1, p[0]);
    z1 = Math.max(z1, p[1]);
  };
  for (const s of plan.spaces) spacePoly(s).forEach(add);
  for (const w of plan.walls ?? []) {
    add(w.a);
    add(w.b);
  }
  extra.forEach(add);
  return [x0, z0, x1, z1];
}

const KIND_COLOR: Record<SpaceKind, string> = {
  corridor: '#cfd8c4',
  room: '#e7e1cc',
  hall: '#d8e4dc',
  stair: '#c9b8d8',
  lift: '#b8b8d8',
  platform: '#c8d2d6',
  track: '#8a8f86',
  water: '#7cc7c0',
  outdoor: '#a8c49a',
  service: '#b9b2a6',
  void: '#3a4044',
};

export interface PlanViewMark {
  id: string;
  eye: [number, number, number];
  yaw: number;
  fov: number;
  /** 画角の扇の各光線の長さ（m。壁で止まる所まで）。無ければ決まった長さの三角 */
  reach?: number[];
}

export interface DrawPlanOptions {
  /** 描く階（省略で全部を重ねる） */
  level?: number;
  /** 1 m あたりの画素（既定は全体が px に収まる値） */
  px?: number;
  /** 視点（参考画像）の位置と画角 */
  views?: PlanViewMark[];
  /** 下に敷く画像（真上の図）と、その範囲 */
  under?: { image: CanvasImageSource; bounds: [number, number, number, number] };
  /** 今の位置（ミニマップ） */
  player?: { x: number; z: number; yaw: number };
  /** 範囲を固定する */
  bounds?: [number, number, number, number];
  /** 文字を小さく・枠だけ（ミニマップ） */
  compact?: boolean;
}

/** 間取り図を 2D の canvas に描く（上が奥 -Z）。視点の画角・道順・縮尺も描く */
export function drawPlan(plan: FloorPlan, canvas: HTMLCanvasElement, o: DrawPlanOptions = {}): void {
  const views = o.views ?? [];
  const pad = o.compact ? 2 : 4;
  const b = o.bounds ?? planBounds(plan, views.map((v) => [v.eye[0], v.eye[2]] as V2));
  const x0 = b[0] - pad;
  const z0 = b[1] - pad;
  const x1 = b[2] + pad;
  const z1 = b[3] + pad;
  const maxPx = o.px ?? 1400;
  const s = Math.min(maxPx / (x1 - x0), maxPx / (z1 - z0));
  const W = Math.round((x1 - x0) * s);
  const H = Math.round((z1 - z0) * s);
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }
  const g = canvas.getContext('2d')!;
  const P = (x: number, z: number): V2 => [(x - x0) * s, (z - z0) * s];
  g.fillStyle = '#14191b';
  g.fillRect(0, 0, W, H);
  if (o.under) {
    const [ux0, uz0, ux1, uz1] = o.under.bounds;
    const [a, c] = P(ux0, uz0);
    const [bx, d] = P(ux1, uz1);
    g.globalAlpha = 0.85;
    g.drawImage(o.under.image, a, c, bx - a, d - c);
    g.globalAlpha = 1;
  }
  // 升目（1 m・5 m）
  if (!o.compact) {
    for (let x = Math.ceil(x0); x <= x1; x++) {
      g.strokeStyle = x % 5 === 0 ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.04)';
      g.beginPath();
      g.moveTo(...P(x, z0));
      g.lineTo(...P(x, z1));
      g.stroke();
    }
    for (let z = Math.ceil(z0); z <= z1; z++) {
      g.strokeStyle = z % 5 === 0 ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.04)';
      g.beginPath();
      g.moveTo(...P(x0, z));
      g.lineTo(...P(x1, z));
      g.stroke();
    }
  }
  const lvlOk = (l?: number): boolean => o.level === undefined || (l ?? 0) === o.level;
  // 場所
  for (const sp of plan.spaces) {
    if (!lvlOk(sp.level)) continue;
    const poly = spacePoly(sp);
    g.beginPath();
    poly.forEach((p, i) => (i ? g.lineTo(...P(p[0], p[1])) : g.moveTo(...P(p[0], p[1]))));
    g.closePath();
    g.globalAlpha = o.under ? 0.25 : 0.85;
    g.fillStyle = KIND_COLOR[sp.kind];
    g.fill();
    g.globalAlpha = 1;
    g.lineWidth = o.compact ? 1 : 1.5;
    g.strokeStyle = sp.closed ? '#6b5a4a' : '#2a3236';
    if (o.under) g.strokeStyle = '#ffffff';
    g.setLineDash(sp.closed ? [4, 3] : []);
    g.stroke();
    g.setLineDash([]);
    if (!o.compact) {
      const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length;
      const cz = poly.reduce((a, p) => a + p[1], 0) / poly.length;
      const [tx, tz] = P(cx, cz);
      g.fillStyle = o.under ? '#ffffff' : '#1d2427';
      g.font = `${Math.max(10, Math.min(14, s * 0.9))}px sans-serif`;
      g.textAlign = 'center';
      g.fillText(sp.label, tx, tz);
      g.font = '10px sans-serif';
      g.fillStyle = o.under ? '#dddddd' : '#4a5357';
      g.fillText(`床 ${sp.floor}${sp.ceiling !== undefined ? ` / 天井 ${sp.ceiling}` : ''} m`, tx, tz + 13);
      g.textAlign = 'start';
    }
  }
  // 壁
  for (const w of plan.walls ?? []) {
    if (!lvlOk(w.level)) continue;
    g.strokeStyle = w.kind === 'glass' ? '#7fd0e6' : w.kind === 'fence' || w.kind === 'railing' ? '#c8b46a' : '#1a1f22';
    if (o.under) g.strokeStyle = w.kind === 'glass' ? '#7fd0e6' : '#ffffff';
    g.lineWidth = w.kind === 'wall' || !w.kind ? Math.max(2, s * 0.2) : 2;
    g.beginPath();
    g.moveTo(...P(...w.a));
    g.lineTo(...P(...w.b));
    g.stroke();
  }
  // 開口
  for (const op of plan.openings) {
    if (!lvlOk(op.level)) continue;
    const [cx, cz] = P(op.at[0], op.at[1]);
    const hw = (op.width / 2) * s;
    const col = op.state === 'locked' ? '#e05a4f' : op.state === 'closed' ? '#e0a64f' : '#58c46b';
    g.strokeStyle = col;
    g.lineWidth = o.compact ? 2 : 3;
    g.beginPath();
    const ang = op.wall === 'x' ? 0 : op.wall === 'z' ? Math.PI / 2 : op.wall;
    g.moveTo(cx - Math.cos(ang) * hw, cz - Math.sin(ang) * hw);
    g.lineTo(cx + Math.cos(ang) * hw, cz + Math.sin(ang) * hw);
    g.stroke();
    if (!o.compact && op.kind !== 'opening') {
      g.fillStyle = col;
      g.font = '9px sans-serif';
      g.fillText(op.kind, cx + 3, cz - 3);
    }
  }
  // 道順
  if (!o.compact && plan.tour.length) {
    g.strokeStyle = 'rgba(120,180,255,0.8)';
    g.lineWidth = 1.5;
    g.setLineDash([6, 4]);
    g.beginPath();
    plan.tour.forEach((t, i) => (i ? g.lineTo(...P(t.eye[0], t.eye[2])) : g.moveTo(...P(t.eye[0], t.eye[2]))));
    g.stroke();
    g.setLineDash([]);
    plan.tour.forEach((t, i) => {
      const [tx, tz] = P(t.eye[0], t.eye[2]);
      g.fillStyle = '#78b4ff';
      g.beginPath();
      g.arc(tx, tz, 4, 0, Math.PI * 2);
      g.fill();
      g.font = '10px sans-serif';
      g.fillText(String(i + 1), tx + 5, tz + 4);
    });
  }
  // 視点の画角（参考画像）
  for (const v of views) {
    const [vx, vz] = P(v.eye[0], v.eye[2]);
    const hf = Math.atan(Math.tan(THREE.MathUtils.degToRad(v.fov) / 2) * (1456 / 816));
    const len = o.compact ? 10 * s : Math.max(40, 18 * s);
    g.fillStyle = 'rgba(255, 204, 51, 0.18)';
    g.strokeStyle = '#ffcc33';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(vx, vz);
    if (v.reach?.length) {
      // 壁で止まる扇（見える範囲）
      const n = v.reach.length - 1;
      for (let i = 0; i <= n; i++) {
        const a = v.yaw - hf + (2 * hf * i) / n;
        const d = v.reach[i] * s;
        g.lineTo(vx - Math.sin(a) * d, vz - Math.cos(a) * d);
      }
    } else {
      for (const sgn of [-1, 1]) {
        const a = v.yaw + sgn * hf;
        g.lineTo(vx - Math.sin(a) * len, vz - Math.cos(a) * len);
      }
    }
    g.closePath();
    g.fill();
    g.stroke();
    if (!o.compact) {
      g.fillStyle = '#ffcc33';
      g.font = 'bold 12px sans-serif';
      g.fillText(v.id, vx + 6, vz + 14);
    }
  }
  // 今の位置
  if (o.player) {
    const [px, pz] = P(o.player.x, o.player.z);
    g.fillStyle = '#ff4fa0';
    g.beginPath();
    g.arc(px, pz, o.compact ? 4 : 6, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#ff4fa0';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(px, pz);
    g.lineTo(px - Math.sin(o.player.yaw) * 14, pz - Math.cos(o.player.yaw) * 14);
    g.stroke();
  }
  if (!o.compact) {
    // 縮尺と題
    const bar = 10 * s;
    g.fillStyle = '#ffffff';
    g.fillRect(12, H - 18, bar, 3);
    g.font = '11px sans-serif';
    g.fillText('10 m', 12, H - 24);
    g.font = 'bold 13px sans-serif';
    g.fillText(`${plan.title}${o.level !== undefined ? `（${o.level} 階）` : ''}`, 12, 18);
    g.font = '11px sans-serif';
    g.fillStyle = '#c8d0cc';
    g.fillText('上が奥（-Z）・黄 = 参考画像の視点・青 = 歩いて確かめる道順・緑 / 橙 / 赤 = 開いた / 閉じた / 鍵の開口', 12, 34);
  }
}
