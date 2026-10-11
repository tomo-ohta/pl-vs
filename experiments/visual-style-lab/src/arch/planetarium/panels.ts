import * as THREE from 'three';

/**
 * 回廊の展示の図の電飾の板（横長 8:5）の絵。手続きで描いた 8 枚を 1 枚の絵（4 × 2）にまとめる（参考画像は使わない）。
 * 0 惑星の軌道・1 月の満ち欠け・2 星の色と明るさの図（HR 図）・3 惑星の大きさ比べ・4 星図（赤経・赤緯の升目と星座の線）・
 * 5 隕石の種類（断面の 3 つの塊と説明の行）・6 望遠鏡の光の道（屈折と反射）・7 年表（横の線と節目の点）・
 * 8 客席の案内図（ドームの円・客席の区画・扉の番号）・9 階の案内図（輪の回廊と玄関ホール）・10 上映の予定の表・11 上映の案内（星空と題）
 * 地は暗い紺、線は明るい水色と白。題と文は細い帯（読めない文字の代わり）
 */
export const PANEL_COLS = 4;
export const PANEL_ROWS = 3;
export const PANEL_KINDS = PANEL_COLS * PANEL_ROWS;

export function diagramAtlas(): THREE.CanvasTexture {
  const CW = 512;
  const CH = 320;
  const cv = document.createElement('canvas');
  cv.width = CW * PANEL_COLS;
  cv.height = CH * PANEL_ROWS;
  const g = cv.getContext('2d')!;
  let seed = 23;
  const rnd = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const line = 'rgba(170,220,245,0.85)';
  const faint = 'rgba(140,190,220,0.35)';
  for (let k = 0; k < PANEL_KINDS; k++) {
    const x0 = (k % PANEL_COLS) * CW;
    const y0 = Math.floor(k / PANEL_COLS) * CH;
    g.save();
    g.beginPath();
    g.rect(x0, y0, CW, CH);
    g.clip();
    g.fillStyle = ['#0b1d2b', '#0d1a2e', '#0a2029', '#0e1b2c'][k % 4];
    g.fillRect(x0, y0, CW, CH);
    // 題の帯と文の行（左の列）
    g.fillStyle = '#e6eef3';
    g.fillRect(x0 + 24, y0 + 22, 150 + rnd() * 90, 16);
    g.fillStyle = 'rgba(200,220,232,0.55)';
    for (let i = 0; i < 6; i++) g.fillRect(x0 + 24, y0 + 56 + i * 13, 90 + rnd() * 50, 5);
    // 図の場所（右の 2/3）
    const fx = x0 + 180;
    const fy = y0 + 40;
    const fw = CW - 200;
    const fh = CH - 70;
    const cx = fx + fw / 2;
    const cy = fy + fh / 2;
    g.lineWidth = 1.6;
    g.strokeStyle = line;
    if (k === 0) {
      g.fillStyle = '#ffd88a';
      g.beginPath();
      g.arc(cx, cy, 10, 0, Math.PI * 2);
      g.fill();
      for (let i = 1; i <= 6; i++) {
        const a = 20 * i;
        g.strokeStyle = i % 2 ? line : faint;
        g.beginPath();
        g.ellipse(cx, cy, a, a * 0.62, 0, 0, Math.PI * 2);
        g.stroke();
        const t = rnd() * Math.PI * 2;
        g.fillStyle = ['#9fc4dc', '#d9b08a', '#7fb4d8', '#c98a6a', '#d8c39a', '#b8d6e0'][i - 1];
        g.beginPath();
        g.arc(cx + Math.cos(t) * a, cy + Math.sin(t) * a * 0.62, 3 + (i % 3), 0, Math.PI * 2);
        g.fill();
      }
    } else if (k === 1) {
      for (let i = 0; i < 8; i++) {
        const px = fx + 20 + i * ((fw - 40) / 7);
        const r = 17;
        g.fillStyle = '#1c2c38';
        g.beginPath();
        g.arc(px, cy, r, 0, Math.PI * 2);
        g.fill();
        // 照らされた所（満ち欠け）: 右半分（前半）か左半分（後半）を明るく、楕円で欠けを足し引き
        const ph = (i / 8) * Math.PI * 2;
        const right = i <= 4;
        g.fillStyle = '#e8eef0';
        g.beginPath();
        g.arc(px, cy, r, -Math.PI / 2, Math.PI / 2, !right);
        g.fill();
        const gib = Math.cos(ph) < 0;
        g.fillStyle = gib ? '#e8eef0' : '#1c2c38';
        g.beginPath();
        g.ellipse(px, cy, Math.abs(Math.cos(ph)) * r + 0.01, r, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(200,220,232,0.5)';
        g.fillRect(px - 12, cy + 30, 24, 4);
      }
      g.strokeStyle = faint;
      g.beginPath();
      g.moveTo(fx + 10, cy - 40);
      g.lineTo(fx + fw - 10, cy - 40);
      g.stroke();
    } else if (k === 2) {
      g.strokeStyle = faint;
      g.strokeRect(fx + 10, fy + 6, fw - 20, fh - 16);
      for (let i = 0; i < 260; i++) {
        const t = rnd();
        const main = rnd() < 0.8;
        const px = fx + 14 + t * (fw - 28);
        const py = main ? fy + 14 + t * (fh - 40) + (rnd() - 0.5) * 18 : fy + 14 + rnd() * (fh * 0.4);
        const hue = t < 0.3 ? '#a9d4ff' : t < 0.6 ? '#f2f0dc' : '#ffb98a';
        g.fillStyle = hue;
        g.fillRect(px, py, 2.2, 2.2);
      }
    } else if (k === 3) {
      const sizes = [4, 9, 10, 6, 46, 38, 18, 17];
      const cols = ['#b8b0a4', '#d9c28a', '#6fa8d0', '#c97a5a', '#d6b48c', '#e0cc96', '#9fd4dc', '#5f8fd8'];
      let px = fx + 8;
      for (let i = 0; i < 8; i++) {
        const r = sizes[i] * 0.95;
        px += r + 4;
        g.fillStyle = cols[i];
        g.beginPath();
        g.arc(px, cy + 20 - r * 0.2, r, 0, Math.PI * 2);
        g.fill();
        if (i === 5) {
          g.strokeStyle = 'rgba(230,220,190,0.8)';
          g.beginPath();
          g.ellipse(px, cy + 20 - r * 0.2, r * 1.7, r * 0.35, -0.2, 0, Math.PI * 2);
          g.stroke();
        }
        px += r;
      }
      g.strokeStyle = faint;
      g.beginPath();
      g.moveTo(fx, cy + 72);
      g.lineTo(fx + fw, cy + 72);
      g.stroke();
    } else if (k === 4) {
      g.strokeStyle = faint;
      for (let i = 0; i <= 6; i++) {
        g.beginPath();
        g.moveTo(fx + (i / 6) * fw, fy);
        g.lineTo(fx + (i / 6) * fw, fy + fh);
        g.stroke();
      }
      for (let i = 0; i <= 4; i++) {
        g.beginPath();
        g.moveTo(fx, fy + (i / 4) * fh);
        g.lineTo(fx + fw, fy + (i / 4) * fh);
        g.stroke();
      }
      for (let c = 0; c < 4; c++) {
        let px = fx + 30 + rnd() * (fw - 60);
        let py = fy + 30 + rnd() * (fh - 60);
        g.strokeStyle = line;
        g.beginPath();
        g.moveTo(px, py);
        for (let i = 0; i < 5; i++) {
          px = Math.min(fx + fw - 8, Math.max(fx + 8, px + (rnd() - 0.5) * 70));
          py = Math.min(fy + fh - 8, Math.max(fy + 8, py + (rnd() - 0.5) * 50));
          g.lineTo(px, py);
          g.fillStyle = '#ffffff';
          g.fillRect(px - 2.5, py - 2.5, 5, 5);
        }
        g.stroke();
      }
      g.fillStyle = 'rgba(220,235,255,0.7)';
      for (let i = 0; i < 90; i++) g.fillRect(fx + rnd() * fw, fy + rnd() * fh, 1.5, 1.5);
    } else if (k === 5) {
      for (let i = 0; i < 3; i++) {
        const px = fx + 50 + i * ((fw - 100) / 2);
        g.fillStyle = ['#5a524a', '#7a7066', '#4a4440'][i];
        g.beginPath();
        for (let a = 0; a < 14; a++) {
          const t = (a / 14) * Math.PI * 2;
          const r = 34 + rnd() * 10;
          const qx = px + Math.cos(t) * r;
          const qy = cy - 10 + Math.sin(t) * r * 0.8;
          if (a === 0) g.moveTo(qx, qy);
          else g.lineTo(qx, qy);
        }
        g.closePath();
        g.fill();
        // 断面の結晶の模様（ウィドマンシュテッテン）
        g.strokeStyle = 'rgba(210,215,215,0.45)';
        for (let j = 0; j < 6; j++) {
          g.beginPath();
          g.moveTo(px - 26, cy - 30 + j * 9);
          g.lineTo(px + 26, cy - 22 + j * 9 - (i - 1) * 6);
          g.stroke();
        }
        g.fillStyle = 'rgba(200,220,232,0.6)';
        g.fillRect(px - 26, cy + 46, 52, 5);
        g.fillRect(px - 20, cy + 56, 40, 4);
      }
    } else if (k === 6) {
      // 屈折と反射の筒と光の道
      g.strokeStyle = faint;
      g.strokeRect(fx + 20, cy - 70, fw - 60, 40);
      g.strokeRect(fx + 20, cy + 20, fw - 60, 46);
      g.strokeStyle = '#ffe6a8';
      for (const dy of [-8, 8]) {
        g.beginPath();
        g.moveTo(fx + 10, cy - 50 + dy);
        g.lineTo(fx + 40, cy - 50 + dy);
        g.lineTo(fx + fw - 50, cy - 50);
        g.stroke();
        g.beginPath();
        g.moveTo(fx + 10, cy + 43 + dy);
        g.lineTo(fx + fw - 44, cy + 43 + dy);
        g.lineTo(fx + 70, cy + 43);
        g.stroke();
      }
      g.fillStyle = '#9fd0ea';
      g.fillRect(fx + 36, cy - 70, 6, 40);
      g.fillRect(fx + fw - 46, cy + 20, 6, 46);
    } else if (k === 8 || k === 9) {
      // 案内図: ドームの円・客席の区画（扇）・扉の位置の番号の丸。9 は外の輪の回廊と玄関ホールの四角も
      const R = Math.min(fw, fh) * 0.42;
      g.strokeStyle = line;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(cx, cy, R, 0, Math.PI * 2);
      g.stroke();
      if (k === 9) {
        g.strokeStyle = faint;
        g.beginPath();
        g.arc(cx, cy, R * 1.25, 0, Math.PI * 2);
        g.stroke();
        g.strokeRect(cx - R * 0.6, cy + R * 1.1, R * 1.2, R * 0.35);
      }
      for (let s = 0; s < 6; s++) {
        const a0 = -2.4 + s * 0.8;
        g.fillStyle = s % 2 ? 'rgba(95,183,216,0.45)' : 'rgba(95,183,216,0.25)';
        g.beginPath();
        g.arc(cx + R * 0.2, cy, R * 0.85, a0, a0 + 0.7);
        g.arc(cx + R * 0.2, cy, R * 0.4, a0 + 0.7, a0, true);
        g.closePath();
        g.fill();
      }
      g.fillStyle = '#cfe6ff';
      g.beginPath();
      g.arc(cx + R * 0.2, cy, R * 0.28, 0, Math.PI * 2);
      g.fill();
      for (let d = 0; d < 5; d++) {
        const a = -1.2 + d * 1.25;
        g.fillStyle = '#ffd88a';
        g.beginPath();
        g.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 7, 0, Math.PI * 2);
        g.fill();
      }
      // 現在地の印
      g.fillStyle = '#ff9a7a';
      g.beginPath();
      g.arc(cx + R * (k === 8 ? 0.9 : 1.2), cy + R * 0.3, 5, 0, Math.PI * 2);
      g.fill();
    } else if (k === 10) {
      // 予定の表（時刻の列と題の行）
      for (let i = 0; i < 7; i++) {
        const yy = fy + 10 + i * ((fh - 20) / 7);
        g.fillStyle = i % 2 ? 'rgba(95,183,216,0.18)' : 'rgba(95,183,216,0.08)';
        g.fillRect(fx, yy, fw, (fh - 20) / 7 - 3);
        g.fillStyle = '#ffd88a';
        g.fillRect(fx + 8, yy + 9, 40, 7);
        g.fillStyle = 'rgba(220,235,245,0.75)';
        g.fillRect(fx + 64, yy + 9, 80 + rnd() * 120, 7);
      }
    } else if (k === 11) {
      // 上映の案内: 星空と大きな惑星の弧・題
      g.fillStyle = '#0a1a33';
      g.fillRect(fx - 160, fy - 40, fw + 180, fh + 70);
      for (let i = 0; i < 160; i++) {
        g.fillStyle = `rgba(220,235,255,${0.3 + rnd() * 0.7})`;
        g.fillRect(fx - 160 + rnd() * (fw + 180), fy - 40 + rnd() * (fh + 30), 1.6, 1.6);
      }
      const grd = g.createRadialGradient(cx + 40, fy + fh + 60, 20, cx + 40, fy + fh + 140, 220);
      grd.addColorStop(0, '#7fc4e6');
      grd.addColorStop(1, '#0c2a44');
      g.fillStyle = grd;
      g.beginPath();
      g.arc(cx + 40, fy + fh + 160, 230, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#e6eef3';
      g.fillRect(x0 + 24, y0 + 22, 260, 24);
      g.fillStyle = 'rgba(200,220,232,0.7)';
      g.fillRect(x0 + 24, y0 + 56, 180, 8);
    } else {
      g.strokeStyle = line;
      g.beginPath();
      g.moveTo(fx + 6, cy);
      g.lineTo(fx + fw - 6, cy);
      g.stroke();
      for (let i = 0; i < 9; i++) {
        const px = fx + 16 + i * ((fw - 32) / 8);
        g.fillStyle = i % 3 === 0 ? '#ffd88a' : '#cfe6ff';
        g.beginPath();
        g.arc(px, cy, i % 3 === 0 ? 6 : 4, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(200,220,232,0.55)';
        const up = i % 2 === 0 ? -1 : 1;
        g.fillRect(px - 18, cy + up * 26 - 3, 36, 5);
        g.fillRect(px - 14, cy + up * 38 - 3, 28, 4);
        g.strokeStyle = faint;
        g.beginPath();
        g.moveTo(px, cy);
        g.lineTo(px, cy + up * 20);
        g.stroke();
      }
    }
    // 縁
    g.strokeStyle = 'rgba(255,255,255,0.18)';
    g.lineWidth = 6;
    g.strokeRect(x0 + 3, y0 + 3, CW - 6, CH - 6);
    g.restore();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** 絵の k 番の板の uv を、PlaneGeometry（u 0〜1・v 0〜1）に当てる */
export function panelUV(geo: THREE.BufferGeometry, k: number): void {
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  const col = k % PANEL_COLS;
  const row = Math.floor(k / PANEL_COLS) % PANEL_ROWS;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (col + uv.getX(i)) / PANEL_COLS, (uv.getY(i) + (PANEL_ROWS - 1 - row)) / PANEL_ROWS);
}
