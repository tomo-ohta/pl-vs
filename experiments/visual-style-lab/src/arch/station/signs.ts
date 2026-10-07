import * as THREE from 'three';

/**
 * 駅の掲示物・案内のキャンバスの絵（記号的に描く: 白地・紺の帯・灰色のくねった線の文字の代わり・矢印）。
 * 駅名や番線の大きな文字だけは本当の字で書く（遠目に読める所）。
 */
export type SignKind =
  | 'fare' // 運賃表（路線図）
  | 'kippu' // きっぷうりば
  | 'timetable' // 時刻表
  | 'posters' // 掲示物（ポスター数枚）
  | 'guide' // 改札の上の案内
  | 'under' // 階段室の案内（地下道）
  | 'arrowA' // 地下道の矢印（ホームへ）
  | 'arrowGate' // 地下道の矢印（改札へ）
  | 'exit' // A の階段の上の案内
  | 'name' // 駅名標
  | 'bus' // バス停の標識
  | 'map' // 駅前の案内図
  | 'warn' // 踏切・線路の注意
  | 'deadend' // 行き止まり・踏切廃止
  | 'closed' // 通行止め
  | 'ja' // 倉庫の看板
  | 'ekimei' // 駅名標（ホーム）
  | 'notice' // 掲示板（運行・お知らせ）
  | 'hangGate' // 吊り下げの案内（改札口・出口）
  | 'depart' // 発車の案内（暗い板に光る字の行）
  | 'dengon' // 伝言板（緑の黒板にチョークの線）
  | 'ad'; // 広告（内照式の板。霧の野原の写真のような絵）

const cache = new Map<SignKind, THREE.CanvasTexture>();
const NAVY = '#1c3a4a';
const INK = '#7a8a88';
const FONT = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif';

/** 文字の代わりのくねった灰色の線 */
function scribble(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rows: number, seed: number, color = INK): void {
  let s = seed;
  const r = (): number => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  g.strokeStyle = color;
  g.lineWidth = Math.max(1.5, h / rows / 4);
  for (let i = 0; i < rows; i++) {
    const yy = y + (i + 0.5) * (h / rows);
    const len = w * (0.55 + r() * 0.45);
    g.beginPath();
    g.moveTo(x, yy);
    for (let t = 0; t < len; t += 6) g.lineTo(x + t, yy + Math.sin(t * 0.35 + r() * 6) * (h / rows) * 0.18);
    g.stroke();
  }
}

function text(g: CanvasRenderingContext2D, t: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'center'): void {
  g.fillStyle = color;
  g.font = `bold ${size}px ${FONT}`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.fillText(t, x, y);
}

function arrow(g: CanvasRenderingContext2D, x: number, y: number, s: number, dir: 1 | -1, color: string): void {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x + dir * s, y);
  g.lineTo(x, y - s * 0.6);
  g.lineTo(x, y - s * 0.25);
  g.lineTo(x - dir * s * 0.8, y - s * 0.25);
  g.lineTo(x - dir * s * 0.8, y + s * 0.25);
  g.lineTo(x, y + s * 0.25);
  g.lineTo(x, y + s * 0.6);
  g.closePath();
  g.fill();
}

const WIDE: SignKind[] = ['kippu', 'guide', 'under', 'arrowA', 'arrowGate', 'exit', 'name', 'deadend', 'closed', 'ja', 'hangGate', 'depart'];
const BOARD: SignKind[] = ['fare', 'timetable', 'posters', 'bus', 'map', 'warn', 'dengon', 'ad'];
const PANEL: SignKind[] = ['ekimei', 'notice'];

/** 1 枚の掲示物を描いたキャンバス */
function drawSign(kind: SignKind): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const wide = WIDE.includes(kind);
  const panel = PANEL.includes(kind);
  c.width = wide || panel ? 1024 : 512;
  c.height = wide ? 128 : panel ? 340 : 384;
  const g = c.getContext('2d')!;
  const W = c.width;
  const H = c.height;
  g.fillStyle = '#e8f0ec';
  g.fillRect(0, 0, W, H);
  switch (kind) {
    case 'fare': {
      // 路線図: 紺の線と駅の丸、運賃の数字の代わりの線
      g.strokeStyle = NAVY;
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(40, 190);
      g.lineTo(470, 190);
      g.moveTo(256, 190);
      g.lineTo(256, 40);
      g.moveTo(256, 190);
      g.lineTo(120, 340);
      g.moveTo(256, 190);
      g.lineTo(400, 340);
      g.stroke();
      for (const [x, y] of [[60, 190], [130, 190], [200, 190], [330, 190], [400, 190], [460, 190], [256, 60], [256, 120], [170, 285], [340, 285], [130, 330], [390, 330]]) {
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.arc(x, y, 10, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = NAVY;
        g.lineWidth = 3;
        g.stroke();
      }
      g.fillStyle = '#c04838';
      g.beginPath();
      g.arc(256, 190, 14, 0, Math.PI * 2);
      g.fill();
      scribble(g, 290, 30, 180, 120, 6, 3);
      break;
    }
    case 'kippu':
      g.fillStyle = NAVY;
      g.fillRect(0, 0, W, H);
      text(g, 'きっぷうりば', W / 2, H / 2, 72, '#ffffff');
      break;
    case 'timetable': {
      g.fillStyle = NAVY;
      g.fillRect(0, 0, W, 50);
      text(g, '時刻表', W / 2, 26, 32, '#ffffff');
      for (let i = 0; i < 12; i++) {
        g.fillStyle = i % 2 ? '#dde8e4' : '#eef4f0';
        g.fillRect(0, 50 + i * 27, W, 27);
        text(g, String(5 + i * 1.5 | 0), 30, 64 + i * 27, 18, NAVY);
        scribble(g, 60, 52 + i * 27, 420, 24, 1, 11 + i);
      }
      break;
    }
    case 'posters': {
      g.fillStyle = '#c8d4d0';
      g.fillRect(0, 0, W, H);
      const cols = ['#e8f0ec', '#f0e8d8', '#dcecf0', '#e8f0ec'];
      for (let i = 0; i < 4; i++) {
        const x = 12 + i * 125;
        g.fillStyle = cols[i];
        g.fillRect(x, 30, 112, 320);
        g.fillStyle = i === 1 ? '#c04838' : i === 2 ? '#2a6a8a' : '#3a7a5a';
        g.fillRect(x + 10, 44, 92, i === 3 ? 30 : 90);
        scribble(g, x + 10, 150, 92, 180, 8, 21 + i);
      }
      break;
    }
    case 'guide':
      g.fillStyle = NAVY;
      g.fillRect(0, 0, W, H);
      text(g, '0 番線', 150, H / 2, 58, '#ffffff');
      g.fillStyle = '#e8c048';
      g.fillRect(300, 30, 6, 68);
      text(g, '1・2 番線　3〜6 番線は地下道', 640, H / 2, 46, '#ffffff');
      arrow(g, 960, H / 2, 34, 1, '#ffffff');
      break;
    case 'under':
      g.fillStyle = NAVY;
      g.fillRect(0, 0, W, H);
      arrow(g, 90, H / 2, 40, 1, '#ffffff');
      text(g, '1・2 番線　3〜6 番線', 560, H / 2, 58, '#ffffff');
      break;
    case 'arrowA':
      g.fillStyle = NAVY;
      g.fillRect(0, 0, W, H);
      text(g, '1・2・3〜6 番線のりば', 460, H / 2, 56, '#ffffff');
      arrow(g, 940, H / 2, 40, 1, '#ffffff');
      break;
    case 'arrowGate':
      g.fillStyle = NAVY;
      g.fillRect(0, 0, W, H);
      arrow(g, 84, H / 2, 40, -1, '#ffffff');
      text(g, '改札口・0 番線', 560, H / 2, 56, '#ffffff');
      break;
    case 'exit':
      g.fillStyle = '#e8c048';
      g.fillRect(0, 0, W, H);
      text(g, '改札口　0 番線', 560, H / 2, 58, '#1a2a30');
      arrow(g, 120, H / 2, 40, -1, '#1a2a30');
      break;
    case 'name':
      g.fillStyle = '#f2f6f4';
      g.fillRect(0, 0, W, H);
      text(g, 'きりはら　霧原駅', W / 2, H / 2, 70, '#1a2a30');
      break;
    case 'bus':
      g.fillStyle = '#f2f6f4';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#2a6a8a';
      g.beginPath();
      g.arc(W / 2, 130, 110, 0, Math.PI * 2);
      g.fill();
      text(g, 'バス', W / 2, 130, 70, '#ffffff');
      scribble(g, 60, 260, 390, 100, 4, 41);
      break;
    case 'map': {
      g.fillStyle = '#dce8e2';
      g.fillRect(0, 0, W, H);
      g.fillStyle = NAVY;
      g.fillRect(0, 0, W, 46);
      text(g, '駅周辺のご案内', W / 2, 24, 28, '#ffffff');
      g.strokeStyle = '#8a9a96';
      g.lineWidth = 10;
      g.beginPath();
      g.moveTo(20, 220);
      g.lineTo(490, 210);
      g.moveTo(300, 60);
      g.lineTo(300, 370);
      g.stroke();
      g.strokeStyle = '#3a4a50';
      g.lineWidth = 4;
      g.setLineDash([14, 8]);
      g.beginPath();
      g.moveTo(340, 50);
      g.lineTo(350, 380);
      g.stroke();
      g.setLineDash([]);
      for (const [x, y, w, h] of [[60, 80, 90, 60], [170, 260, 70, 50], [400, 100, 70, 80], [80, 290, 60, 50]]) {
        g.fillStyle = '#b8c8c0';
        g.fillRect(x, y, w, h);
      }
      g.fillStyle = '#c04838';
      g.beginPath();
      g.arc(318, 200, 12, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'warn':
      g.fillStyle = '#e8c048';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#1a1a1a';
      for (let x = -H; x < W; x += 60) {
        g.beginPath();
        g.moveTo(x, H);
        g.lineTo(x + 30, H);
        g.lineTo(x + 30 + H * 0.3, H - 40);
        g.lineTo(x + H * 0.3, H - 40);
        g.closePath();
        g.fill();
      }
      text(g, 'とまれみよ', W / 2, H / 2 - 30, 80, '#1a1a1a');
      text(g, '列車に注意', W / 2, H / 2 + 60, 56, '#c03020');
      break;
    case 'deadend':
      g.fillStyle = '#f2f6f4';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#c03020';
      g.fillRect(0, 0, 30, H);
      g.fillRect(W - 30, 0, 30, H);
      text(g, 'この先 行き止まり（踏切は廃止しました）', W / 2, H / 2, 46, '#1a2a30');
      break;
    case 'closed':
      g.fillStyle = '#f2f6f4';
      g.fillRect(0, 0, W, H);
      text(g, 'この先 通行止め', W / 2, H / 2, 64, '#c03020');
      break;
    case 'ja':
      g.fillStyle = '#f2f6f4';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#2a7a4a';
      g.fillRect(0, 0, 120, H);
      text(g, 'JA', 60, H / 2, 64, '#ffffff');
      text(g, '霧原 農業倉庫', 580, H / 2, 62, '#1a2a30');
      break;
    case 'ekimei':
      // 駅名標: 漢字・大きなひらがな・ローマ字、下の帯に隣の駅
      g.fillStyle = '#f4f8f6';
      g.fillRect(0, 0, W, H);
      text(g, '霧原', W / 2, 46, 44, '#1a2a30');
      text(g, 'きりはら', W / 2, 138, 112, '#1a2a30');
      text(g, 'Kirihara', W / 2, 220, 40, '#3a4a50');
      g.fillStyle = '#2a7a5a';
      g.fillRect(0, 262, W, 78);
      text(g, '◀ きたはら', 30, 301, 40, '#ffffff', 'left');
      text(g, 'みなみだ ▶', W - 30, 301, 40, '#ffffff', 'right');
      break;
    case 'hangGate':
      g.fillStyle = NAVY;
      g.fillRect(0, 0, W, H);
      arrow(g, 80, H / 2, 38, -1, '#ffffff');
      text(g, '改札口　0 番線', 330, H / 2, 52, '#ffffff');
      g.fillStyle = '#e8c048';
      g.fillRect(560, 26, 6, 76);
      text(g, '出口　バスのりば', 790, H / 2, 52, '#ffffff');
      arrow(g, 975, H / 2, 38, 1, '#ffffff');
      break;
    case 'depart': {
      g.fillStyle = '#10181a';
      g.fillRect(0, 0, W, H);
      const rows = [['普通', '10:42', 'みなみだ', '#e89848'], ['快速', '11:05', 'きたはら', '#78d0a0']];
      rows.forEach((r, i) => {
        const y = 34 + i * 60;
        text(g, r[0], 90, y, 40, r[3]);
        text(g, r[1], 260, y, 40, r[3]);
        text(g, r[2], 520, y, 40, r[3]);
        g.fillStyle = r[3];
        for (let k = 0; k < 7; k++) g.fillRect(700 + k * 42, y - 12, 26, 24);
      });
      break;
    }
    case 'dengon':
      g.fillStyle = '#2a5a48';
      g.fillRect(0, 0, W, H);
      g.strokeStyle = '#6a5a3a';
      g.lineWidth = 18;
      g.strokeRect(9, 9, W - 18, H - 18);
      text(g, '伝言板', W / 2, 44, 34, '#d8e4dc');
      scribble(g, 40, 80, 430, 270, 7, 77, '#c8d6ce');
      break;
    case 'ad': {
      // 霧の野原と小さな駅の絵（色は場所の色の表から）
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#c8eee4');
      gr.addColorStop(0.55, '#9ad2c4');
      gr.addColorStop(1, '#4a8a7c');
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#2a5a5a';
      g.fillRect(60, 200, 160, 26);
      g.fillRect(130, 120, 8, 80);
      g.fillStyle = '#e8f4ee';
      g.fillRect(0, H - 96, W, 96);
      text(g, 'きりはら 霧の里めぐり', W / 2, H - 62, 34, '#1a3a40');
      scribble(g, 60, H - 40, 390, 30, 1, 91);
      break;
    }
    case 'notice': {
      g.fillStyle = '#d8e4de';
      g.fillRect(0, 0, W, H);
      g.fillStyle = NAVY;
      g.fillRect(0, 0, W, 44);
      text(g, 'お知らせ', 90, 22, 28, '#ffffff');
      for (let i = 0; i < 3; i++) {
        const x = 24 + i * 330;
        g.fillStyle = ['#f2f4ee', '#eef0e4', '#f4ece4'][i];
        g.fillRect(x, 60, 300, 260);
        g.fillStyle = ['#2a6a8a', '#c04838', '#3a7a5a'][i];
        g.fillRect(x + 14, 74, 272, 40);
        scribble(g, x + 14, 130, 272, 170, 7, 61 + i);
      }
      break;
    }
  }
  return c;
}

/**
 * 全部の掲示物を 1 枚にまとめた絵（描画の回数を減らす）。横長（1024×128）は 2 列 6 段、板（512×384）は 4 列 2 段、パネルは 2 列に並べる。
 * 各掲示物の範囲（u0, v0, u1, v1）は rect(kind)
 */
let atlas: { texture: THREE.CanvasTexture; rects: Map<SignKind, [number, number, number, number]> } | null = null;
export function signAtlas(): { texture: THREE.CanvasTexture; rect(kind: SignKind): [number, number, number, number] } {
  if (!atlas) {
    const W = 2048;
    const H = 2048;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d')!;
    g.fillStyle = '#808080';
    g.fillRect(0, 0, W, H);
    const rects = new Map<SignKind, [number, number, number, number]>();
    const pad = 6;
    const put = (kind: SignKind, x: number, y: number, w: number, h: number): void => {
      g.drawImage(drawSign(kind), x + pad, y + pad, w - pad * 2, h - pad * 2);
      // テクスチャの v は下から（flipY）
      rects.set(kind, [(x + pad) / W, 1 - (y + h - pad) / H, (x + w - pad) / W, 1 - (y + pad) / H]);
    };
    WIDE.forEach((k, i) => put(k, (i % 2) * 1024, Math.floor(i / 2) * 140, 1024, 140));
    BOARD.forEach((k, i) => put(k, (i % 4) * 512, 860 + Math.floor(i / 4) * 400, 512, 400));
    PANEL.forEach((k, i) => put(k, (i % 2) * 1024, 1660 + Math.floor(i / 2) * 360, 1024, 360));
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    atlas = { texture: t, rects };
  }
  const a = atlas;
  return { texture: a.texture, rect: (kind) => a.rects.get(kind)! };
}

/** 形の UV（0〜1）を、まとめた絵の中の掲示物の範囲へ移す */
export function signUV(geo: THREE.BufferGeometry, kind: SignKind): THREE.BufferGeometry {
  const [u0, v0, u1, v1] = signAtlas().rect(kind);
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
  uv.needsUpdate = true;
  return geo;
}

/** 掲示物の板（箱）。size = 箱の寸法 */
export function signGeo(kind: SignKind, size: [number, number, number]): THREE.BufferGeometry {
  return signUV(new THREE.BoxGeometry(...size), kind);
}

/** 掲示物 1 枚だけの絵（まとめた絵を使わない所用） */
export function signTexture(kind: SignKind): THREE.CanvasTexture {
  const hit = cache.get(kind);
  if (hit) return hit;
  const t = new THREE.CanvasTexture(drawSign(kind));
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(kind, t);
  return t;
}
