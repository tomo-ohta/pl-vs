/**
 * 「通信エラー」の演出（docs/endless-world.md 15 章）: 無いルーム ID で来たとき、画面いっぱいの砂嵐・横に裂ける帯・にじむ文字を
 * 出してから、トップページへ戻す（戻すのは呼ぶ側）。音は、ページで既に音を鳴らせるとき（トップページで押した後）だけ短い砂嵐とピー音
 */

const CSS = `
.conn-err { position: fixed; inset: 0; z-index: 1000; background: #000; overflow: hidden; cursor: default; }
.conn-err canvas { position: absolute; inset: 0; width: 100%; height: 100%; image-rendering: pixelated; opacity: 0.85; }
.conn-err .bar { position: absolute; left: 0; right: 0; height: 6vh; background: rgba(255,255,255,0.08); mix-blend-mode: screen; }
.conn-err .box { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); text-align: center; width: min(560px, calc(100vw - 32px));
  padding: 22px 16px; background: rgba(0,0,0,0.72); box-shadow: 0 0 40px 20px rgba(0,0,0,0.6); }
.conn-err h1 {
  margin: 0; font: 700 clamp(34px, 8vw, 64px)/1.1 var(--mono); letter-spacing: 0.12em; color: #f4f4f4;
  text-shadow: 3px 0 rgba(255,40,60,0.85), -3px 0 rgba(40,220,255,0.85), 0 0 18px rgba(255,255,255,0.35);
}
.conn-err .code { margin-top: 14px; font: 13px/1.6 var(--mono); letter-spacing: 0.14em; color: #ffcf6a; }
.conn-err .msg { margin-top: 6px; font-size: 13px; color: #c8ccd4; letter-spacing: 0.06em; }
.conn-err .rec { position: absolute; left: 18px; top: 14px; font: 12px var(--mono); letter-spacing: 0.2em; color: #ff4b4b; }
@media (prefers-reduced-motion: reduce) { .conn-err canvas { opacity: 0.35; } }
`;

let styled = false;

/** 演出を ms ミリ秒出す（終わったら resolve。画面は残す: 呼ぶ側がページを移る） */
export function showConnectionError(id: string, o: { ms?: number; audio?: boolean } = {}): Promise<void> {
  if (!styled) { const st = document.createElement('style'); st.textContent = CSS; document.head.append(st); styled = true; }
  const ms = o.ms ?? 2800;
  const root = document.createElement('div');
  root.className = 'conn-err';
  root.setAttribute('role', 'alert');
  const cv = document.createElement('canvas');
  cv.width = 160; cv.height = 90;
  const bar = document.createElement('div');
  bar.className = 'bar';
  const box = document.createElement('div');
  box.className = 'box';
  const h = document.createElement('h1');
  h.textContent = '通信エラー';
  const code = document.createElement('div');
  code.className = 'code';
  code.textContent = `ERR_ROOM_NOT_FOUND ― ROOM ${id.slice(0, 24) || '----'}`;
  const msg = document.createElement('div');
  msg.className = 'msg';
  msg.textContent = 'この部屋には接続できません。トップページへ戻ります…';
  const rec = document.createElement('div');
  rec.className = 'rec';
  rec.textContent = '● NO SIGNAL';
  box.append(h, code, msg);
  root.append(cv, bar, box, rec);
  document.body.append(root);
  document.title = '通信エラー';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(cv.width, cv.height);
  const t0 = performance.now();
  let raf = 0;
  const frame = (now: number): void => {
    const k = (now - t0) / ms;
    // 砂嵐（初めは強く、だんだん弱く。ときどき横の帯が裂ける）
    const tear = Math.random() < 0.18 ? Math.floor(Math.random() * cv.height) : -1;
    for (let y = 0; y < cv.height; y++) {
      const shift = Math.abs(y - tear) < 6 ? Math.floor(Math.random() * 40) : 0;
      for (let x = 0; x < cv.width; x++) {
        const v = Math.random() * 255 * (0.55 + 0.45 * (1 - k)) + (shift ? 40 : 0);
        const i = (y * cv.width + ((x + shift) % cv.width)) * 4;
        img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    bar.style.top = `${((now - t0) * 0.05) % 110 - 6}vh`;
    if (!reduced) {
      const j = Math.random();
      h.style.transform = j < 0.12 ? `translateX(${(Math.random() - 0.5) * 18}px) skewX(${(Math.random() - 0.5) * 20}deg)` : '';
      h.style.opacity = j < 0.06 ? '0.2' : '1';
    }
    if (now - t0 < ms) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  if (o.audio !== false) noiseBurst(ms / 1000);
  return new Promise((res) => setTimeout(() => { cancelAnimationFrame(raf); res(); }, ms));
}

/** 短い砂嵐とピー音（WebAudio の合成。鳴らせない（ページでまだ操作していない）ときは鳴らさない） */
function noiseBurst(sec: number): void {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC || !navigator.userActivation?.hasBeenActive) return;
    const ac = new AC();
    const len = Math.floor(ac.sampleRate * sec);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.6;
    const g = ac.createGain();
    g.gain.value = 0.18;
    src.connect(bp).connect(g).connect(ac.destination);
    const beep = ac.createOscillator();
    beep.type = 'square'; beep.frequency.value = 1000;
    const bg = ac.createGain();
    bg.gain.setValueAtTime(0, ac.currentTime);
    bg.gain.setValueAtTime(0.05, ac.currentTime + 0.35);
    bg.gain.setValueAtTime(0, ac.currentTime + 1.35);
    beep.connect(bg).connect(ac.destination);
    src.start(); beep.start(); beep.stop(ac.currentTime + sec);
    setTimeout(() => void ac.close(), sec * 1000 + 200);
  } catch {
    // 音は出せなくてよい
  }
}
