import * as THREE from "three";

/* ------------------------------------------------------------------ */
/* 計測パネル                                                          */
/* ------------------------------------------------------------------ */

export class Hud {
  constructor(rows) {
    this.el = document.createElement("div");
    this.el.id = "hud";
    const grid = document.createElement("div");
    grid.className = "rows";
    this.values = {};
    for (const [key, label] of rows) {
      const k = document.createElement("div");
      k.className = "k";
      k.textContent = label;
      const v = document.createElement("div");
      v.className = "v";
      v.textContent = "-";
      grid.append(k, v);
      this.values[key] = v;
    }
    this.list = document.createElement("ol");
    this.el.append(grid, this.list);
    document.body.append(this.el);
    this.maxLines = 7;
  }

  set(key, text, tone = "") {
    const v = this.values[key];
    if (!v) return;
    if (v.textContent !== text) v.textContent = text;
    const cls = `v${tone ? ` ${tone}` : ""}`;
    if (v.className !== cls) v.className = cls;
  }

  log(text, tone = "") {
    const t = new Date();
    const stamp = `${String(t.getMinutes()).padStart(2, "0")}:${String(t.getSeconds()).padStart(2, "0")}`;
    const li = document.createElement("li");
    li.textContent = `${stamp} ${text}`;
    if (tone) li.className = tone;
    this.list.prepend(li);
    while (this.list.children.length > this.maxLines) this.list.lastChild.remove();
    console.log(`[log] ${text}`);
  }
}

export class FpsMeter {
  constructor() {
    this.frames = 0;
    this.time = 0;
    this.fps = 0;
  }
  tick(dt) {
    this.frames++;
    this.time += dt;
    if (this.time >= 0.5) {
      this.fps = this.frames / this.time;
      this.frames = 0;
      this.time = 0;
    }
    return this.fps;
  }
}

export function fpsTone(fps) {
  if (fps >= 50) return "ok";
  if (fps >= 28) return "warn";
  return "bad";
}

/** JSヒープ（Chrome系のみ）とGPU資源の数を読む */
export function readMemory(renderer) {
  const m = performance.memory;
  return {
    heapMB: m ? m.usedJSHeapSize / 1048576 : null,
    textures: renderer.info.memory.textures,
    geometries: renderer.info.memory.geometries,
  };
}

export function formatMemory(mem) {
  const heap = mem.heapMB === null ? "未対応" : `${mem.heapMB.toFixed(1)} MB`;
  return { heap, gpu: `テクスチャ ${mem.textures} / 形状 ${mem.geometries}` };
}

export function formatCount(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}

/* ------------------------------------------------------------------ */
/* 開始画面・操作ヒント・アクションボタン                              */
/* ------------------------------------------------------------------ */

export function createOverlay({ title, body, controls, buttonLabel = "はじめる" }) {
  const el = document.createElement("div");
  el.id = "overlay";
  const card = document.createElement("div");
  card.className = "card";
  const h1 = document.createElement("h1");
  h1.textContent = title;
  const p = document.createElement("p");
  p.textContent = body;
  const dl = document.createElement("dl");
  for (const [dt, dd] of controls) {
    const a = document.createElement("dt");
    a.textContent = dt;
    const b = document.createElement("dd");
    b.textContent = dd;
    dl.append(a, b);
  }
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "準備中…";
  button.disabled = true;
  const status = document.createElement("div");
  status.className = "status";
  card.append(h1, p, dl, button, status);
  el.append(card);
  document.body.append(el);

  let resolveStart;
  const started = new Promise((r) => {
    resolveStart = r;
  });
  button.addEventListener("click", () => {
    el.hidden = true;
    resolveStart();
  });

  return {
    started,
    ready() {
      button.disabled = false;
      button.textContent = buttonLabel;
      button.focus();
    },
    status(text, tone = "") {
      status.textContent = text;
      status.className = `status${tone ? ` ${tone}` : ""}`;
    },
  };
}

export function createPrompt() {
  const el = document.createElement("div");
  el.id = "prompt";
  el.hidden = true;
  document.body.append(el);
  return {
    show(text) {
      if (el.textContent !== text) el.textContent = text;
      el.hidden = false;
    },
    hide() {
      el.hidden = true;
    },
  };
}

export function createHint(text) {
  const el = document.createElement("div");
  el.id = "hint";
  el.textContent = text;
  document.body.append(el);
  return el;
}

export function createCrosshair() {
  const el = document.createElement("div");
  el.id = "crosshair";
  document.body.append(el);
  return el;
}

export function createActionButton(onPress) {
  const el = document.createElement("button");
  el.id = "action";
  el.type = "button";
  el.hidden = true;
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    onPress();
  });
  document.body.append(el);
  return el;
}

/* ------------------------------------------------------------------ */
/* ファイル読み込み・クリップボード                                    */
/* ------------------------------------------------------------------ */

const SPLAT_ACCEPT = ".spz,.ply,.splat,.ksplat,.sog,.zip,.rad";

/** ファイル選択ダイアログを開き、{ fileBytes, fileName } を返す */
export function pickSplatFile() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = SPLAT_ACCEPT;
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      resolve({ fileBytes: new Uint8Array(await file.arrayBuffer()), fileName: file.name });
    });
    input.click();
  });
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    console.log(text);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* 当たり判定の箱                                                      */
/* ------------------------------------------------------------------ */

const helperMaterial = new THREE.LineBasicMaterial({ color: 0xff4fa3 });

/**
 * 当たり判定用の箱を作る。見た目には使わない。
 * 表示用の線（helper）は「当たり判定を表示」がオンのときだけ見える。
 */
export function makeCollider(scene, min, max, name = "") {
  const box = new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max));
  const helper = new THREE.Box3Helper(box);
  helper.material = helperMaterial;
  helper.visible = false;
  scene.add(helper);
  return { box, helper, enabled: true, name };
}

export function setCollidersVisible(colliders, visible) {
  for (const c of colliders) c.helper.visible = visible && c.enabled !== false;
}

/* ------------------------------------------------------------------ */
/* その他                                                              */
/* ------------------------------------------------------------------ */

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
export async function nextFrames(n) {
  for (let i = 0; i < n; i++) await nextFrame();
}

/** lil-gui をスマホでは閉じた状態で始める */
export function prepareGui(gui) {
  if (window.matchMedia("(max-width: 640px)").matches) gui.close();
  return gui;
}
