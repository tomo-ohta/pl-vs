/**
 * QR コードを作る（本物の、読み取れる QR。ISO/IEC 18004 のバイトモード・誤り訂正 L / M・型番 1〜14）。
 * 外のライブラリを足さないために、この検証ステージの中に書いた（作り方は広く知られた手順: データの符号化 → リード・ソロモン符号 →
 * ブロックの交互の並べ → 機能パターン（位置検出・タイミング・位置合わせ・形式と型番の情報）→ ジグザグの配置 → 8 つのマスクから減点の少ない物）
 */
export type QrEcc = 'L' | 'M';

export interface QrCode {
  /** 一辺のモジュール数（型番 × 4 + 17） */
  size: number;
  version: number;
  /** (x, y) が黒か */
  get(x: number, y: number): boolean;
}

// 型番ごとの、ブロックごとの誤り訂正の符号語の数と、ブロックの数（0 番は使わない）
const ECC_PER_BLOCK: Record<QrEcc, number[]> = {
  L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30],
  M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24],
};
const NUM_BLOCKS: Record<QrEcc, number[]> = {
  L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4],
  M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9],
};
const FORMAT_BITS: Record<QrEcc, number> = { L: 1, M: 0 };
const MAX_VERSION = 14;

/** 文字列（UTF-8 のバイト）を QR にする。入らなければ例外 */
export function encodeQr(text: string, ecc: QrEcc = 'M'): QrCode {
  const bytes = Array.from(new TextEncoder().encode(text));
  let version = 1;
  for (; version <= MAX_VERSION; version++) {
    const cc = version <= 9 ? 8 : 16;
    if (4 + cc + bytes.length * 8 <= dataCodewords(version, ecc) * 8) break;
  }
  if (version > MAX_VERSION) throw new Error('QR: 長すぎます');
  // データのビット列
  const bits: number[] = [];
  const push = (v: number, n: number): void => {
    for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) push(b, 8);
  const cap = dataCodewords(version, ecc) * 8;
  push(0, Math.min(4, cap - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) push(pad, 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    data.push(b);
  }
  const all = addEccAndInterleave(data, version, ecc);

  const size = version * 4 + 17;
  const mod: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const fn: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const setF = (x: number, y: number, dark: boolean): void => {
    mod[y][x] = dark;
    fn[y][x] = true;
  };
  // 機能パターン
  for (let i = 0; i < size; i++) {
    setF(6, i, i % 2 === 0);
    setF(i, 6, i % 2 === 0);
  }
  const finder = (cx: number, cy: number): void => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        setF(x, y, d !== 2 && d !== 4);
      }
    }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);
  const align = alignmentPositions(version);
  const na = align.length;
  for (let i = 0; i < na; i++) {
    for (let j = 0; j < na; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setF(align[i] + dx, align[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
  const drawFormat = (mask: number): void => {
    const d = (FORMAT_BITS[ecc] << 3) | mask;
    let rem = d;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const b = ((d << 10) | rem) ^ 0x5412;
    const bit = (i: number): boolean => ((b >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) setF(8, i, bit(i));
    setF(8, 7, bit(6));
    setF(8, 8, bit(7));
    setF(7, 8, bit(8));
    for (let i = 9; i < 15; i++) setF(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) setF(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) setF(8, size - 15 + i, bit(i));
    setF(8, size - 8, true);
  };
  drawFormat(0);
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const b = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = ((b >>> i) & 1) !== 0;
      const a = size - 11 + (i % 3);
      const c = Math.floor(i / 3);
      setF(a, c, dark);
      setF(c, a, dark);
    }
  }
  // データのジグザグの配置
  let k = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!fn[y][x] && k < all.length * 8) {
          mod[y][x] = ((all[k >>> 3] >>> (7 - (k & 7))) & 1) !== 0;
          k++;
        }
      }
    }
  }
  // マスク（減点の少ない物）
  const applyMask = (m: number): void => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (fn[y][x]) continue;
        let inv: boolean;
        switch (m) {
          case 0: inv = (x + y) % 2 === 0; break;
          case 1: inv = y % 2 === 0; break;
          case 2: inv = x % 3 === 0; break;
          case 3: inv = (x + y) % 3 === 0; break;
          case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: inv = ((x * y) % 2) + ((x * y) % 3) === 0; break;
          case 6: inv = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          default: inv = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
        }
        if (inv) mod[y][x] = !mod[y][x];
      }
    }
  };
  let best = 0;
  let bestScore = Infinity;
  for (let m = 0; m < 8; m++) {
    applyMask(m);
    drawFormat(m);
    const s = penalty(mod, size);
    if (s < bestScore) {
      bestScore = s;
      best = m;
    }
    applyMask(m);
  }
  applyMask(best);
  drawFormat(best);
  return { size, version, get: (x, y) => mod[y][x] };
}

function rawDataModules(ver: number): number {
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const na = Math.floor(ver / 7) + 2;
    r -= (25 * na - 10) * na - 55;
    if (ver >= 7) r -= 36;
  }
  return r;
}

function dataCodewords(ver: number, ecc: QrEcc): number {
  return Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK[ecc][ver] * NUM_BLOCKS[ecc][ver];
}

function alignmentPositions(ver: number): number[] {
  if (ver === 1) return [];
  const size = ver * 4 + 17;
  const na = Math.floor(ver / 7) + 2;
  const step = Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2;
  const out = [6];
  for (let pos = size - 7; out.length < na; pos -= step) out.splice(1, 0, pos);
  return out;
}

function addEccAndInterleave(data: number[], ver: number, ecc: QrEcc): number[] {
  const nb = NUM_BLOCKS[ecc][ver];
  const eLen = ECC_PER_BLOCK[ecc][ver];
  const raw = Math.floor(rawDataModules(ver) / 8);
  const nShort = nb - (raw % nb);
  const shortLen = Math.floor(raw / nb);
  const div = rsDivisor(eLen);
  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < nb; i++) {
    const dat = data.slice(k, k + shortLen - eLen + (i < nShort ? 0 : 1));
    k += dat.length;
    const e = rsRemainder(dat, div);
    if (i < nShort) dat.push(0);
    blocks.push(dat.concat(e));
  }
  const out: number[] = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((b, j) => {
      if (i !== shortLen - eLen || j >= nShort) out.push(b[i]);
    });
  }
  return out;
}

function rsMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsDivisor(degree: number): number[] {
  const r = new Array<number>(degree).fill(0);
  r[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < r.length; j++) {
      r[j] = rsMul(r[j], root);
      if (j + 1 < r.length) r[j] ^= r[j + 1];
    }
    root = rsMul(root, 0x02);
  }
  return r;
}

function rsRemainder(data: number[], div: number[]): number[] {
  const r = div.map(() => 0);
  for (const b of data) {
    const f = b ^ (r.shift() as number);
    r.push(0);
    div.forEach((c, i) => (r[i] ^= rsMul(c, f)));
  }
  return r;
}

/** 減点（並びの長さ・2×2 の塊・位置検出に似た並び・黒の割合） */
function penalty(m: boolean[][], size: number): number {
  let s = 0;
  const line = (get: (i: number) => boolean): void => {
    let run = 1;
    for (let i = 1; i <= size; i++) {
      if (i < size && get(i) === get(i - 1)) run++;
      else {
        if (run >= 5) s += 3 + (run - 5);
        run = 1;
      }
    }
    // 1:1:3:1:1 の並び（前か後ろに明るい 4 つ）
    for (let i = 0; i + 6 < size; i++) {
      if (get(i) && !get(i + 1) && get(i + 2) && get(i + 3) && get(i + 4) && !get(i + 5) && get(i + 6)) {
        const lightBefore = [1, 2, 3, 4].every((k) => i - k < 0 || !get(i - k));
        const lightAfter = [7, 8, 9, 10].every((k) => i + k >= size || !get(i + k));
        if (lightBefore || lightAfter) s += 40;
      }
    }
  };
  for (let y = 0; y < size; y++) line((x) => m[y][x]);
  for (let x = 0; x < size; x++) line((y) => m[y][x]);
  for (let y = 0; y + 1 < size; y++) {
    for (let x = 0; x + 1 < size; x++) {
      const c = m[y][x];
      if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) s += 3;
    }
  }
  let dark = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (m[y][x]) dark++;
  const total = size * size;
  s += Math.max(0, Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  return s;
}

/** QR を canvas に描く（quiet = 周りの白の幅（モジュール）・px = 1 モジュールの画素） */
export function drawQr(qr: QrCode, px: number, quiet = 4, dark = '#111', light = '#fff'): HTMLCanvasElement {
  const n = qr.size + quiet * 2;
  const c = document.createElement('canvas');
  c.width = c.height = n * px;
  const g = c.getContext('2d')!;
  g.fillStyle = light;
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = dark;
  for (let y = 0; y < qr.size; y++) for (let x = 0; x < qr.size; x++) if (qr.get(x, y)) g.fillRect((x + quiet) * px, (y + quiet) * px, px, px);
  return c;
}
