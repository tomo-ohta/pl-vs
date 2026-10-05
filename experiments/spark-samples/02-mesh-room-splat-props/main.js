/*
 * 検証2：メッシュの部屋とスプラットの小物
 *
 * 確かめたいこと
 *  - メッシュの部屋に置いたスプラットの小物が浮いて見えないか
 *  - 色味の補正（照明の色に合わせて recolor）でどこまで馴染むか
 *  - 接地の影（床に敷くデカール）の効果
 *  - 半透明のガラスとスプラットの重なり（描画順の問題）
 *  - 同じデータを共有して複製したときの重さ
 *  - 小物の作成と破棄を繰り返したときのメモリ
 *
 * 部屋は「照明を焼き込んだメッシュ」を想定して MeshBasicMaterial で描く。
 * ライトの計算をしないので軽く、照明の色を変えるときは素材の色を掛けるだけ。
 *
 * レイアウト（上から見た図、単位 m）
 *
 *   z = -2.5 ┌──────────[棚+テレビ]──────────┐
 *            │ [植物]                  [ガラスケース] │
 *            │                     [段ボール]    │
 *            │            ● 開始位置               │
 *            │   ・  ・  ・  テレビの複製  ・  ・  │
 *   z = +2.5 └────────────────────────────────┘
 *          x = -3.5                         x = +3.5
 */

import * as THREE from "three";
import { PackedSplats, SparkRenderer, SplatMesh } from "@sparkjsdev/spark";
import GUI from "lil-gui";
import { Player } from "../common/player.js";
import { buildCardboardStack, buildCrtTv, buildPlant, buildPlush, raw } from "../common/procedural.js";
import {
  Hud,
  FpsMeter,
  fpsTone,
  readMemory,
  formatMemory,
  formatCount,
  createOverlay,
  createHint,
  createCrosshair,
  pickSplatFile,
  copyText,
  makeCollider,
  setCollidersVisible,
  nextFrames,
  prepareGui,
} from "../common/ui.js";

/* ------------------------------------------------------------------ */
/* 設定                                                                */
/* ------------------------------------------------------------------ */

const ROOM = { min: new THREE.Vector3(-3.5, 0, -2.5), max: new THREE.Vector3(3.5, 2.7, 2.5) };
const CABINET = { x: 0, z: -2.22, w: 1.0, h: 0.55, d: 0.5 };
const PEDESTAL = { x: 2.4, z: -1.55, w: 0.6, h: 0.9, d: 0.6 };
const GLASS_H = 0.62;

const LIGHT_PRESETS = {
  昼光色の蛍光灯: 0xeef3ff,
  電球色: 0xffd3a0,
  緑がかった古い蛍光灯: 0xe0f2c4,
  非常灯: 0xff9f92,
};

const params = new URLSearchParams(location.search);
const settings = {
  lightPreset: "昼光色の蛍光灯",
  lightBrightness: 1.0,
  tintLink: true,
  tintExtra: "#ffffff",
  tintBrightness: 1.0,
  decals: true,
  decalStrength: 0.55,
  decalScale: 1.0,
  compareOff: false,
  glassOpacity: 0.22,
  glassAfterSplats: true,
  splatDepthWrite: false,
  density: Number(params.get("density") ?? 1),
  copies: 0,
  pixelRatio: Math.min(window.devicePixelRatio, 1.5),
  showColliders: false,
  stressCount: 10,
};

/* ------------------------------------------------------------------ */
/* three.js と Spark                                                   */
/* ------------------------------------------------------------------ */

// ?capture=1 を付けると描画結果を画像として取り出せる（スクリーンショット用。少し重くなる）
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: params.has("capture") });
renderer.setPixelRatio(settings.pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.append(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.03, 60);
const spark = new SparkRenderer({ renderer });
// 描画順：床の影(1) → スプラット(10) → ガラス(20)。ガラスの順番は設定で入れ替えられる
spark.renderOrder = 10;
scene.add(spark);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ------------------------------------------------------------------ */
/* メッシュの部屋（照明を焼き込んだ想定）                              */
/* ------------------------------------------------------------------ */

function canvasTexture(size, draw, repeatX = 1, repeatY = 1) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  draw(g, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  return tex;
}

function noise(g, size, count, colors, maxR = 1.5) {
  for (let i = 0; i < count; i++) {
    g.fillStyle = colors[i % colors.length];
    const r = Math.random() * maxR + 0.4;
    g.fillRect(Math.random() * size, Math.random() * size, r, r);
  }
}

function stains(g, size, count, rgb) {
  for (let i = 0; i < count; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = size * (0.08 + Math.random() * 0.2);
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${rgb},${0.1 + Math.random() * 0.12})`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

const wallpaperTex = (w, h) =>
  canvasTexture(
    512,
    (g, s) => {
      g.fillStyle = "#d3c486";
      g.fillRect(0, 0, s, s);
      for (let x = 0; x < s; x += 32) {
        g.fillStyle = "rgba(255,248,215,0.16)";
        g.fillRect(x, 0, 9, s);
      }
      g.fillStyle = "rgba(120,100,50,0.12)";
      for (let y = 8, row = 0; y < s; y += 32, row++) for (let x = 8; x < s; x += 32) g.fillRect(x + (row % 2 ? 16 : 0), y, 4, 4);
      noise(g, s, 9000, ["rgba(90,70,30,0.08)", "rgba(255,250,230,0.08)"]);
      stains(g, s, 6, "110,85,40");
    },
    w,
    h,
  );

const carpetTex = (w, h) =>
  canvasTexture(
    256,
    (g, s) => {
      g.fillStyle = "#8c7a4d";
      g.fillRect(0, 0, s, s);
      noise(g, s, 14000, ["rgba(60,45,20,0.25)", "rgba(190,170,110,0.18)", "rgba(110,95,55,0.3)"], 1.2);
      stains(g, s, 4, "70,55,25");
    },
    w,
    h,
  );

const ceilingTex = (w, h) =>
  canvasTexture(
    256,
    (g, s) => {
      g.fillStyle = "#d8d4c3";
      g.fillRect(0, 0, s, s);
      noise(g, s, 4000, ["rgba(120,115,100,0.25)", "rgba(255,255,250,0.2)"], 1);
      g.strokeStyle = "rgba(110,105,90,0.55)";
      g.lineWidth = 4;
      g.strokeRect(0, 0, s, s);
    },
    w,
    h,
  );

const woodTex = canvasTexture(256, (g, s) => {
  g.fillStyle = "#5b4631";
  g.fillRect(0, 0, s, s);
  for (let y = 0; y < s; y += 3) {
    g.fillStyle = `rgba(${30 + Math.random() * 40},${20 + Math.random() * 25},10,${0.15 + Math.random() * 0.2})`;
    g.fillRect(0, y, s, 1 + Math.random() * 2);
  }
});

/** 角や床際を暗くする頂点カラー付きの平面（焼き込んだ陰影の代わり） */
function aoPlane(width, height, shade) {
  const g = new THREE.PlaneGeometry(width, height, Math.ceil(width * 10), Math.ceil(height * 10));
  const pos = g.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const k = shade(pos.getX(i) + width / 2, pos.getY(i) + height / 2);
    colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = k;
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return g;
}
const edgeDark = (d, reach, amount) => amount * Math.exp(-d / reach);

const roomMaterials = [];
function bakedMaterial(map) {
  const m = new THREE.MeshBasicMaterial({ map, vertexColors: true });
  roomMaterials.push(m);
  return m;
}

const room = new THREE.Group();
scene.add(room);
{
  const W = ROOM.max.x - ROOM.min.x;
  const D = ROOM.max.z - ROOM.min.z;
  const H = ROOM.max.y;
  const wallShade = (len) => (s, t) =>
    1 - edgeDark(t, 0.25, 0.32) - edgeDark(H - t, 0.2, 0.15) - edgeDark(Math.min(s, len - s), 0.35, 0.16);
  const flatShade = (w, d) => (s, t) =>
    1 - edgeDark(Math.min(s, w - s), 0.35, 0.28) - edgeDark(Math.min(t, d - t), 0.35, 0.28);

  const floor = new THREE.Mesh(aoPlane(W, D, flatShade(W, D)), bakedMaterial(carpetTex(W / 1.2, D / 1.2)));
  floor.rotation.x = -Math.PI / 2;
  const ceiling = new THREE.Mesh(aoPlane(W, D, flatShade(W, D)), bakedMaterial(ceilingTex(W / 0.6, D / 0.6)));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = H;
  room.add(floor, ceiling);

  const walls = [
    [W, [0, H / 2, ROOM.min.z], 0],
    [W, [0, H / 2, ROOM.max.z], Math.PI],
    [D, [ROOM.min.x, H / 2, 0], Math.PI / 2],
    [D, [ROOM.max.x, H / 2, 0], -Math.PI / 2],
  ];
  for (const [len, pos, rotY] of walls) {
    const m = new THREE.Mesh(aoPlane(len, H, wallShade(len)), bakedMaterial(wallpaperTex(len / 1.1, H / 1.1)));
    m.position.set(...pos);
    m.rotation.y = rotY;
    room.add(m);
  }
}

// 天井の照明パネル（光っている見た目だけ）
const panelMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
for (const x of [-1.6, 1.6]) {
  const p = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.03, 0.3), panelMaterial);
  p.position.set(x, ROOM.max.y - 0.015, -0.6);
  room.add(p);
}

// テレビを載せる棚と、ガラスケースの台（どちらもメッシュ）
const furnitureMaterial = bakedMaterial(woodTex);
function furnitureBox(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const pos = g.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const k = 0.62 + 0.38 * ((pos.getY(i) + h / 2) / h); // 下ほど暗く
    colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = k;
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return g;
}
const cabinet = new THREE.Mesh(furnitureBox(CABINET.w, CABINET.h, CABINET.d), furnitureMaterial);
cabinet.position.set(CABINET.x, CABINET.h / 2, CABINET.z);
const pedestal = new THREE.Mesh(furnitureBox(PEDESTAL.w, PEDESTAL.h, PEDESTAL.d), furnitureMaterial);
pedestal.position.set(PEDESTAL.x, PEDESTAL.h / 2, PEDESTAL.z);
room.add(cabinet, pedestal);

// ガラスケース（半透明メッシュ）と枠
const glassMaterial = new THREE.MeshBasicMaterial({
  color: 0xcfe6ee,
  transparent: true,
  opacity: settings.glassOpacity,
  depthWrite: false,
  side: THREE.DoubleSide,
});
const glass = new THREE.Mesh(new THREE.BoxGeometry(PEDESTAL.w - 0.02, GLASS_H, PEDESTAL.d - 0.02), glassMaterial);
glass.position.set(PEDESTAL.x, PEDESTAL.h + GLASS_H / 2, PEDESTAL.z);
glass.renderOrder = 20;
const glassFrame = new THREE.LineSegments(
  new THREE.EdgesGeometry(glass.geometry),
  new THREE.LineBasicMaterial({ color: 0x3b3a35 }),
);
glassFrame.position.copy(glass.position);
scene.add(glass, glassFrame);

/* ------------------------------------------------------------------ */
/* 接地の影（デカール）                                                */
/* ------------------------------------------------------------------ */

const shadowTexture = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(0,0,0,1)");
  grad.addColorStop(0.45, "rgba(0,0,0,0.6)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
const decalMaterial = new THREE.MeshBasicMaterial({
  map: shadowTexture,
  color: 0x000000,
  transparent: true,
  opacity: settings.decalStrength,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -1,
});
const decalGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const decals = [];
function makeDecal(x, y, z, w, d) {
  const m = new THREE.Mesh(decalGeometry, decalMaterial);
  m.position.set(x, y + 0.002, z);
  m.userData.size = [w, d];
  m.scale.set(w * settings.decalScale, 1, d * settings.decalScale);
  m.renderOrder = 1; // スプラットより先に描く（後に描くと小物の足元に影が乗ってしまう）
  scene.add(m);
  decals.push(m);
  return m;
}
function removeDecal(m) {
  scene.remove(m);
  decals.splice(decals.indexOf(m), 1);
}
function refreshDecals() {
  const on = settings.decals && !settings.compareOff;
  decalMaterial.opacity = settings.decalStrength;
  for (const m of decals) {
    m.visible = on;
    m.scale.set(m.userData.size[0] * settings.decalScale, 1, m.userData.size[1] * settings.decalScale);
  }
}

/* ------------------------------------------------------------------ */
/* スプラットの小物                                                    */
/* ------------------------------------------------------------------ */

const PROP_DEFS = {
  plant: {
    label: "観葉植物（柔らかいもの）",
    build: buildPlant,
    base: [-2.55, 0, -1.65],
    rotY: 20,
    shadow: [0.75, 0.75],
    collider: [0.2, 0.2],
  },
  tv: {
    label: "ブラウン管テレビ（硬いもの）",
    build: buildCrtTv,
    base: [CABINET.x, CABINET.h, CABINET.z + 0.02],
    rotY: 0,
    shadow: [0.75, 0.62],
    collider: null, // 棚の判定で足りる
  },
  plush: {
    label: "ぬいぐるみ（ガラスの中）",
    build: buildPlush,
    base: [PEDESTAL.x, PEDESTAL.h, PEDESTAL.z],
    rotY: -30,
    shadow: [0.34, 0.3],
    collider: null,
  },
  boxes: {
    label: "段ボール（ガラスの手前）",
    build: buildCardboardStack,
    base: [1.6, 0, -0.6],
    rotY: -14,
    shadow: [0.72, 0.62],
    collider: [0.3, 0.27],
  },
};

const props = {};
for (const [id, def] of Object.entries(PROP_DEFS)) {
  props[id] = {
    id,
    def,
    source: null,
    packed: null,
    mesh: null,
    decal: makeDecal(def.base[0], def.base[1], def.base[2], ...def.shadow),
    transform: { x: 0, y: 0, z: 0, rotY: 0, scale: 1, flip: true },
  };
}
const copies = [];

function placeProp(p, mesh) {
  const [bx, by, bz] = p.def.base;
  const custom = p.source !== null;
  const t = p.transform;
  mesh.position.set(bx + (custom ? t.x : 0), by + (custom ? t.y : 0), bz + (custom ? t.z : 0));
  const yaw = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    THREE.MathUtils.degToRad(p.def.rotY + (custom ? t.rotY : 0)),
  );
  const flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), custom && t.flip ? Math.PI : 0);
  mesh.quaternion.copy(yaw).multiply(flip);
  mesh.scale.setScalar(custom ? t.scale : 1);
}

/**
 * 共有している PackedSplats を壊さずに SplatMesh だけ破棄する。
 * Spark 2.3.1 の SplatMesh.dispose() は自分の packedSplats も破棄するため、
 * 同じデータを複数の SplatMesh で使い回す場合は参照を外してから dispose する。
 */
function disposeSharingMesh(mesh) {
  scene.remove(mesh);
  mesh.splats = undefined;
  mesh.packedSplats = undefined;
  mesh.extSplats = undefined;
  mesh.dispose();
}

async function createProp(id) {
  const p = props[id];
  const packed = p.source
    ? new PackedSplats({ fileBytes: p.source.fileBytes.slice(), fileName: p.source.fileName })
    : new PackedSplats({ construct: (splats) => p.def.build(splats, { density: settings.density }) });
  await packed.initialized;
  const mesh = new SplatMesh({ packedSplats: packed });
  await mesh.initialized;
  placeProp(p, mesh);
  p.packed = packed;
  p.mesh = mesh;
  scene.add(mesh);
  applyTint();
}

function destroyProp(id) {
  const p = props[id];
  if (id === "tv") setCopyCount(0, false);
  if (p.mesh) disposeSharingMesh(p.mesh);
  p.packed?.dispose();
  p.mesh = null;
  p.packed = null;
}

async function rebuildProp(id) {
  const keepCopies = id === "tv" ? copies.length : 0;
  destroyProp(id);
  await createProp(id);
  if (keepCopies) setCopyCount(keepCopies);
}

async function rebuildAll() {
  for (const id of Object.keys(props)) await rebuildProp(id);
}

/** テレビのデータを共有して複製する（データは1つ、置く場所だけ増える） */
function setCopyCount(n, log = true) {
  const tv = props.tv;
  while (copies.length > n) {
    const c = copies.pop();
    disposeSharingMesh(c.mesh);
    removeDecal(c.decal);
  }
  while (copies.length < n && tv.packed) {
    const i = copies.length;
    const x = -3.0 + (i % 9) * 0.75;
    const z = 1.0 + Math.floor(i / 9) * 0.6;
    const mesh = new SplatMesh({ packedSplats: tv.packed });
    mesh.position.set(x, 0, z);
    mesh.rotation.y = Math.PI + (Math.random() - 0.5) * 0.4;
    scene.add(mesh);
    copies.push({ mesh, decal: makeDecal(x, 0, z, ...PROP_DEFS.tv.shadow) });
  }
  refreshDecals();
  applyTint();
  if (log) hud.log(`テレビの複製を${copies.length}個に（データは共有）`);
}

/* ------------------------------------------------------------------ */
/* 照明と色合わせ                                                      */
/* ------------------------------------------------------------------ */

const _tint = new THREE.Color();
const _extra = new THREE.Color();

function applyLighting() {
  const hex = LIGHT_PRESETS[settings.lightPreset];
  // メッシュ：素材の色に照明の色を掛ける（焼き込んだライトマップの色を変えるイメージ）
  const c = new THREE.Color(hex).multiplyScalar(settings.lightBrightness);
  for (const m of roomMaterials) m.color.copy(c);
  panelMaterial.color.set(hex);
  applyTint();
}

/**
 * スプラットの小物に照明の色を掛ける。
 * スプラットの色は sRGB のまま扱うので、明るさはメッシュ側（線形）と揃うよう 1/2.2 乗する。
 */
function applyTint() {
  if (settings.tintLink && !settings.compareOff) {
    raw(LIGHT_PRESETS[settings.lightPreset], _tint).multiplyScalar(settings.lightBrightness ** (1 / 2.2));
    _extra.setStyle(settings.tintExtra, THREE.LinearSRGBColorSpace);
    _tint.multiply(_extra).multiplyScalar(settings.tintBrightness);
  } else {
    _tint.setRGB(1, 1, 1);
  }
  for (const p of Object.values(props)) if (p.mesh) p.mesh.recolor.copy(_tint);
  for (const c of copies) c.mesh.recolor.copy(_tint);
}

function applyGlass() {
  glassMaterial.opacity = settings.glassOpacity;
  glass.renderOrder = settings.glassAfterSplats ? 20 : 5;
  spark.material.depthWrite = settings.splatDepthWrite;
}

/* ------------------------------------------------------------------ */
/* 当たり判定                                                          */
/* ------------------------------------------------------------------ */

const colliders = [];
const addCollider = (min, max, name) => colliders.push(makeCollider(scene, min, max, name));
{
  const { min, max } = ROOM;
  addCollider([min.x - 0.2, 0, min.z - 0.2], [min.x, max.y, max.z + 0.2], "壁");
  addCollider([max.x, 0, min.z - 0.2], [max.x + 0.2, max.y, max.z + 0.2], "壁");
  addCollider([min.x - 0.2, 0, min.z - 0.2], [max.x + 0.2, max.y, min.z], "壁");
  addCollider([min.x - 0.2, 0, max.z], [max.x + 0.2, max.y, max.z + 0.2], "壁");
  addCollider(
    [CABINET.x - CABINET.w / 2, 0, CABINET.z - CABINET.d / 2],
    [CABINET.x + CABINET.w / 2, CABINET.h, CABINET.z + CABINET.d / 2],
    "棚",
  );
  addCollider(
    [PEDESTAL.x - PEDESTAL.w / 2, 0, PEDESTAL.z - PEDESTAL.d / 2],
    [PEDESTAL.x + PEDESTAL.w / 2, PEDESTAL.h + GLASS_H, PEDESTAL.z + PEDESTAL.d / 2],
    "ガラスケース",
  );
  for (const def of Object.values(PROP_DEFS)) {
    if (!def.collider) continue;
    const [x, , z] = def.base;
    const [hx, hz] = def.collider;
    addCollider([x - hx, 0, z - hz], [x + hx, 1.2, z + hz], def.label);
  }
}

/* ------------------------------------------------------------------ */
/* プレイヤー・計測                                                    */
/* ------------------------------------------------------------------ */

const player = new Player({ camera, dom: renderer.domElement, getColliders: () => colliders });
player.setPose(0, 0.45, 0);

createCrosshair();
createHint(
  player.isTouch
    ? "左半分：移動　右半分：視点"
    : "クリック：視点操作　WASD：移動　C：補正のオン・オフを比較　Esc：カーソルを戻す",
);
window.addEventListener("keydown", (e) => {
  if (e.code === "KeyC" && player.enabled && !e.repeat) {
    settings.compareOff = !settings.compareOff;
    compareCtrl.updateDisplay();
    onCompareChange();
  }
});

const hud = new Hud([
  ["fps", "FPS"],
  ["splats", "描画中の粒"],
  ["data", "小物のデータ"],
  ["light", "照明"],
  ["fix", "補正"],
  ["heap", "JSヒープ"],
  ["gpu", "GPU資源"],
  ["near", "近くの小物"],
]);
const fps = new FpsMeter();
let memTimer = 0;

function nearestProp() {
  let best = null;
  let bestD = Infinity;
  for (const p of Object.values(props)) {
    const [x, , z] = p.def.base;
    const d = Math.hypot(player.position.x - x, player.position.z - z);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return [best, bestD];
}

function updateHud(dt) {
  const f = fps.tick(dt);
  hud.set("fps", f ? f.toFixed(0) : "-", fpsTone(f));
  hud.set("splats", formatCount(spark.activeSplats ?? 0), "accent");
  let unique = 0;
  for (const p of Object.values(props)) unique += p.packed?.numSplats ?? 0;
  hud.set("data", `${formatCount(unique)}粒・複製${copies.length}個`);
  hud.set("light", `${settings.lightPreset} ×${settings.lightBrightness.toFixed(2)}`);
  hud.set(
    "fix",
    settings.compareOff
      ? "すべて切っている"
      : `色${settings.tintLink ? "あり" : "なし"}・影${settings.decals ? "あり" : "なし"}`,
    settings.compareOff ? "warn" : "",
  );
  const [p, d] = nearestProp();
  hud.set("near", p ? `${p.def.label.replace(/（.*）/, "")} ${d.toFixed(1)}m` : "-");
  memTimer -= dt;
  if (memTimer <= 0) {
    memTimer = 0.5;
    const m = formatMemory(readMemory(renderer));
    hud.set("heap", m.heap);
    hud.set("gpu", m.gpu);
  }
}

/* ------------------------------------------------------------------ */
/* メモリの検証                                                        */
/* ------------------------------------------------------------------ */

let stressRunning = false;
async function runStressTest() {
  if (stressRunning) return;
  stressRunning = true;
  const n = settings.stressCount;
  hud.log(`メモリ検証：小物4つの破棄→生成を${n}回`);
  await nextFrames(3);
  const before = readMemory(renderer);
  const t0 = performance.now();
  for (let i = 0; i < n; i++) {
    await rebuildAll();
    await nextFrames(2);
  }
  await nextFrames(5);
  const after = readMemory(renderer);
  const heap =
    before.heapMB === null ? "未対応" : `${after.heapMB - before.heapMB >= 0 ? "+" : ""}${(after.heapMB - before.heapMB).toFixed(1)}MB`;
  const tex = after.textures - before.textures;
  hud.log(
    `検証完了：${n}回・${Math.round(performance.now() - t0)}ms・ヒープ差 ${heap}・テクスチャ差 ${tex >= 0 ? "+" : ""}${tex}`,
    tex > 0 ? "warn" : "ok",
  );
  stressRunning = false;
}

/* ------------------------------------------------------------------ */
/* 設定パネル                                                          */
/* ------------------------------------------------------------------ */

const gui = prepareGui(new GUI({ title: "設定" }));

const fLight = gui.addFolder("部屋の照明");
fLight.add(settings, "lightPreset", Object.keys(LIGHT_PRESETS)).name("照明の種類").onChange(applyLighting);
fLight.add(settings, "lightBrightness", 0.3, 1.6, 0.01).name("明るさ").onChange(applyLighting);

const fTint = gui.addFolder("小物の色合わせ");
fTint.add(settings, "tintLink").name("照明の色に合わせる").onChange(applyTint);
fTint.addColor(settings, "tintExtra").name("さらに掛ける色").onChange(applyTint);
fTint.add(settings, "tintBrightness", 0.5, 1.5, 0.01).name("明るさの補正").onChange(applyTint);

const fShadow = gui.addFolder("接地の影");
fShadow.add(settings, "decals").name("影を敷く").onChange(refreshDecals);
fShadow.add(settings, "decalStrength", 0, 1, 0.01).name("濃さ").onChange(refreshDecals);
fShadow.add(settings, "decalScale", 0.5, 2, 0.01).name("大きさ").onChange(refreshDecals);

function onCompareChange() {
  applyTint();
  refreshDecals();
  hud.log(settings.compareOff ? "色合わせと影を切った（比較用）" : "色合わせと影を戻した");
}
const compareCtrl = gui.add(settings, "compareOff").name("補正をすべて切って比較（C）").onChange(onCompareChange);

const fGlass = gui.addFolder("半透明（ガラス）");
fGlass.add(settings, "glassOpacity", 0, 0.8, 0.01).name("ガラスの不透明度").onChange(applyGlass);
fGlass.add(settings, "glassAfterSplats").name("ガラスを小物より後に描く").onChange(applyGlass);
fGlass.add(settings, "splatDepthWrite").name("スプラットの深度書き込み（実験）").onChange(applyGlass);

const fPerf = gui.addFolder("性能");
fPerf
  .add(settings, "density", 0.5, 12, 0.5)
  .name("仮の小物の粒の密度")
  .onFinishChange(async () => {
    for (const id of Object.keys(props)) if (!props[id].source) await rebuildProp(id);
    hud.log(`仮の小物を密度×${settings.density}で作り直した`);
  });
fPerf
  .add(settings, "copies", 0, 27, 1)
  .name("テレビの複製数")
  .onFinishChange((v) => setCopyCount(v));
fPerf
  .add(settings, "pixelRatio", 0.5, 2, 0.25)
  .name("解像度の倍率")
  .onChange((v) => renderer.setPixelRatio(v));

function addPropFolder(id) {
  const p = props[id];
  const f = gui.addFolder(`${p.def.label.replace(/（.*）/, "")}の素材`);
  f.close();
  const info = { source: "仮の小物（コードで生成）" };
  const srcCtrl = f.add(info, "source").name("使用中").disable();
  f.add(
    {
      pick: async () => {
        const file = await pickSplatFile();
        if (!file) return;
        p.source = file;
        info.source = file.fileName;
        srcCtrl.updateDisplay();
        try {
          await rebuildProp(id);
          hud.log(`${p.def.label}を ${file.fileName} に差し替えた`, "ok");
        } catch (err) {
          console.error(err);
          hud.log(`読み込みに失敗：${err.message}`, "bad");
        }
      },
    },
    "pick",
  ).name("自分のファイルを読み込む");
  f.add(
    {
      reset: async () => {
        p.source = null;
        info.source = "仮の小物（コードで生成）";
        srcCtrl.updateDisplay();
        await rebuildProp(id);
      },
    },
    "reset",
  ).name("仮の小物に戻す");
  const t = p.transform;
  const apply = () => p.mesh && placeProp(p, p.mesh);
  f.add(t, "x", -2, 2, 0.005).name("位置のずれ X").onChange(apply);
  f.add(t, "y", -2, 2, 0.005).name("位置のずれ Y").onChange(apply);
  f.add(t, "z", -2, 2, 0.005).name("位置のずれ Z").onChange(apply);
  f.add(t, "rotY", -180, 180, 0.5).name("向き（度）").onChange(apply);
  f.add(t, "scale", 0.05, 5, 0.005).name("大きさ").onChange(apply);
  f.add(t, "flip").name("上下を反転（撮影データ用）").onChange(apply);
  f.add(
    {
      copy: async () => {
        const ok = await copyText(JSON.stringify(t));
        hud.log(ok ? "位置合わせの値をコピーした" : "コピーできなかったのでコンソールに出力した");
      },
    },
    "copy",
  ).name("位置合わせの値をコピー");
}
for (const id of Object.keys(props)) addPropFolder(id);

const fView = gui.addFolder("表示");
fView
  .add(settings, "showColliders")
  .name("当たり判定を表示")
  .onChange((v) => setCollidersVisible(colliders, v));

const fMem = gui.addFolder("メモリの検証");
fMem.add(settings, "stressCount", 3, 30, 1).name("繰り返す回数");
fMem.add({ run: runStressTest }, "run").name("小物の破棄→生成を繰り返す");

/* ------------------------------------------------------------------ */
/* 開始                                                                */
/* ------------------------------------------------------------------ */

const overlay = createOverlay({
  title: "メッシュの部屋とスプラットの小物",
  body: "照明を焼き込んだメッシュの部屋に、スプラットの小物を4つ置いています。小物が浮いて見えないか、色合わせと接地の影でどこまで馴染むか、ガラスとの重なり、複製したときの重さを確かめます。",
  controls: player.isTouch
    ? [
        ["移動", "画面の左半分をドラッグ"],
        ["視点", "画面の右半分をドラッグ"],
        ["設定", "右上のパネル"],
      ]
    : [
        ["移動", "WASD（Shiftで走る）"],
        ["視点", "クリックしてマウス"],
        ["比較", "C で補正のオン・オフ"],
        ["設定", "Escでカーソルを戻して右上のパネル"],
      ],
});

applyLighting();
applyGlass();

let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  player.update(dt);
  renderer.render(scene, camera);
  updateHud(dt);
});

overlay.status("小物を生成しています…");
(async () => {
  try {
    const t0 = performance.now();
    for (const id of Object.keys(props)) await createProp(id);
    const initialCopies = Number(params.get("copies") ?? 0);
    if (initialCopies > 0) {
      settings.copies = Math.min(27, initialCopies);
      setCopyCount(settings.copies);
    }
    hud.log(`小物4つを生成：${Math.round(performance.now() - t0)}ms`, "ok");
    overlay.status("");
    overlay.ready();
  } catch (err) {
    console.error(err);
    overlay.status(`準備に失敗しました：${err.message}`, "bad");
  }
})();

overlay.started.then(() => {
  player.enabled = true;
  if (!player.isTouch) renderer.domElement.requestPointerLock?.();
});

window.sample = { THREE, renderer, camera, scene, spark, player, props, copies, settings, applyTint, applyGlass, setCopyCount, runStressTest };
