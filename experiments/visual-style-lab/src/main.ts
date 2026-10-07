import * as THREE from 'three';
import { App } from './App.ts';
import { setStyleColors } from './render/StyleMaterial.ts';
import { ARCH_SCENES } from './arch/index.ts';
import { SCENES } from './scenes/index.ts';
import { Panel } from './ui/Panel.ts';

const params = new URLSearchParams(location.search);
const root = document.getElementById('app')!;
const capture = params.has('capture');
/** 建築版（arch.html）: 間取り図から作った場面。元の版（index.html）はそのまま */
const ARCH = /arch\.html$/.test(location.pathname);
const REGISTRY = ARCH ? ARCH_SCENES : SCENES;
const app = new App(root, REGISTRY, { persistFilm: !capture });
app.variant = ARCH ? 'arch' : 'v1';
if (capture) document.body.classList.add('capture');

// 開発・撮影用の窓口
declare global {
  interface Window {
    __lab: {
      app: App;
      capture: App['capture'];
      ready: boolean;
      error?: string;
      /** 場面の材質を名前で（名前の無い物は uuid の頭）。色の調整: __lab.setColors('wall', { color: '#...', shade: '#...' }) */
      mats(): Record<string, THREE.Material>;
      setColors(name: string, c: { color?: string; shade?: string; dark?: string; hi?: string }): boolean;
    };
  }
}
function sceneMats(): Record<string, THREE.Material> {
  const out: Record<string, THREE.Material> = {};
  app.scene.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    if (!m) return;
    for (const mm of Array.isArray(m) ? m : [m]) out[mm.name || mm.uuid.slice(0, 8)] = mm;
  });
  return out;
}
window.__lab = {
  app,
  capture: (id?: string, gx?: number, gy?: number) => app.capture(id, gx, gy),
  ready: false,
  mats: sceneMats,
  setColors: (name, c) => {
    const m = sceneMats()[name];
    if (!m) return false;
    setStyleColors(m, app.style, c);
    return true;
  },
};

const viewParam = params.get('view');
const sceneId = params.get('scene') ?? (viewParam ? viewParam.replace(/-\d+$/, '') : REGISTRY[0].id);

/**
 * URL で見た目の値を上書きする（調整・確認用）: ?set=post.lines.normal=0.6,toon.noiseAmp=0.1&debug=5
 * 値に JSON（配列・オブジェクト）を使うときは区切りを ; にする: ?set=post.gradients=[{...}];post.bloom.strength=1
 */
function applyOverrides(): void {
  const set = params.get('set');
  if (set) {
    for (const kv of set.split(set.includes(';') ? ';' : ',')) {
      const i = kv.indexOf('=');
      const path = kv.slice(0, i);
      const raw = kv.slice(i + 1);
      const keys = path.split('.');
      let o = app.style as unknown as Record<string, unknown>;
      for (const k of keys.slice(0, -1)) o = o[k] as Record<string, unknown>;
      const v = /^[[{]/.test(raw) ? JSON.parse(raw) : raw === 'true' ? true : raw === 'false' ? false : Number.isNaN(Number(raw)) ? raw : Number(raw);
      o[keys[keys.length - 1]] = v;
    }
    app.setStyle(app.style);
  }
  if (params.get('debug')) app.post.debug = Number(params.get('debug'));
  // カメラ効果: ?film=tape&vhs=1.5&keep=0.85&handheld=0.6&hold=24&ae=1&awb=1
  const film = params.get('film');
  if (film) {
    app.film.set({
      preset: film as 'off',
      ...(params.get('vhs') ? { vhsStrength: Number(params.get('vhs')) } : {}),
      ...(params.get('keep') ? { colorKeep: Number(params.get('keep')) } : {}),
      ...(params.get('handheld') ? { handheld: Number(params.get('handheld')) } : {}),
      ...(params.get('hold') ? { frameHold: params.get('hold') as 'off' } : {}),
      ...(params.get('ae') ? { autoExposure: params.get('ae') === '1' } : {}),
      ...(params.get('awb') ? { autoWhiteBalance: params.get('awb') === '1' } : {}),
    }, false);
  }
}

async function boot(): Promise<void> {
  await app.load(sceneId, viewParam ?? undefined);
  applyOverrides();
  const panel = capture ? null : new Panel(app, root);
  if (panel && params.get('compare')) panel.setMode(params.get('compare') as 'overlay');
  if (capture) {
    app.frozen = true;
    app.player.bob = 0;
    app.renderFrame();
  } else {
    app.start();
  }
  window.__lab.ready = true;
}
boot().catch((e: unknown) => {
  console.error(e);
  window.__lab.error = String(e);
});
