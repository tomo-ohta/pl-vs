/*
 * 検証1：部屋2つとドア1枚
 *
 * 確かめたいこと
 *  - 見た目はスプラット、当たり判定は透明な箱、という分け方で歩けるか
 *  - ドア（独立したスプラット）を回転させて開閉できるか
 *  - ドアに近づいたら隣の部屋を読み込み、離れたら破棄する流れが破綻しないか
 *  - 読み込みと破棄を繰り返したときにメモリが解放されるか
 *  - スマホで快適に動くか
 *
 * レイアウト（上から見た図、単位 m）
 *
 *        z = -6  ┌──────────────┐
 *                │    部屋A     │  黄色い壁紙
 *                │              │
 *        z = 0   ├────┤ドア├────┤  仕切り壁（厚さ0.2m）
 *                │    部屋B     │  白いタイル
 *                │              │
 *        z = +6  └──────────────┘
 *              x = -3          x = +3
 */

import * as THREE from "three";
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";
import GUI from "lil-gui";
import { Player } from "../common/player.js";
import { buildDoor, buildRoom } from "../common/procedural.js";
import {
  Hud,
  FpsMeter,
  fpsTone,
  readMemory,
  formatMemory,
  formatCount,
  createOverlay,
  createPrompt,
  createHint,
  createCrosshair,
  createActionButton,
  pickSplatFile,
  copyText,
  makeCollider,
  setCollidersVisible,
  sleep,
  nextFrames,
  prepareGui,
} from "../common/ui.js";

/* ------------------------------------------------------------------ */
/* 寸法と設定                                                          */
/* ------------------------------------------------------------------ */

const ROOM_H = 2.7;
const WALL_HALF = 0.1; // 仕切り壁の厚みの半分
const DOOR = { x: 0, z: 0, width: 0.9, height: 2.05, thickness: 0.05 };
const HINGE_X = DOOR.x - DOOR.width / 2;
const DOOR_OPEN_ANGLE = -Math.PI / 2; // 部屋B側へ開く

const params = new URLSearchParams(location.search);

/**
 * 部屋の定義。source が null の間はコードで生成した仮の部屋を使う。
 * 撮影したスプラットを使う場合は ?roomA=xxx.spz のようにURLで渡すか、
 * 設定パネルの「自分のファイルを読み込む」から差し替える。
 * transform は差し替えた素材を当たり判定の箱に合わせるための値。
 */
const ROOMS = {
  A: {
    label: "部屋A",
    min: new THREE.Vector3(-3, 0, -6),
    max: new THREE.Vector3(3, ROOM_H, -WALL_HALF),
    style: "office",
    seed: 101,
    doorway: { wall: "south", center: DOOR.x, width: DOOR.width, height: DOOR.height, depth: WALL_HALF },
    panels: [
      { x: -1.3, z: -4.2, w: 1.2, d: 0.3 },
      { x: 1.3, z: -1.8, w: 1.2, d: 0.3 },
    ],
    source: params.get("roomA") ? { url: params.get("roomA") } : null,
    transform: { x: 0, y: 0, z: 0, rotY: 0, scale: 1, flip: true },
  },
  B: {
    label: "部屋B",
    min: new THREE.Vector3(-3, 0, WALL_HALF),
    max: new THREE.Vector3(3, ROOM_H, 6),
    style: "tile",
    seed: 202,
    doorway: { wall: "north", center: DOOR.x, width: DOOR.width, height: DOOR.height, depth: WALL_HALF },
    panels: [
      { x: 0, z: 2.0, w: 0.3, d: 1.2 },
      { x: 0, z: 4.4, w: 0.3, d: 1.2 },
    ],
    source: params.get("roomB") ? { url: params.get("roomB") } : null,
    transform: { x: 0, y: 0, z: 0, rotY: 0, scale: 1, flip: true },
  },
};

const settings = {
  streaming: true,
  preloadDistance: 3.0,
  unloadDistance: 4.0,
  fakeLatencyMs: Number(params.get("latency") ?? 0),
  autoClose: true,
  showColliders: false,
  pixelRatio: Math.min(window.devicePixelRatio, 1.5),
  roomSpacing: Number(params.get("spacing") ?? 0.03), // 仮の部屋の粒の間隔。大きいほど軽い
  stressCount: 20,
};

/* ------------------------------------------------------------------ */
/* three.js と Spark                                                   */
/* ------------------------------------------------------------------ */

// Spark の推奨どおりアンチエイリアスは切る（スプラットには効かず重くなるだけ）
// ?capture=1 を付けると描画結果を画像として取り出せる（スクリーンショット用。少し重くなる）
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: params.has("capture") });
renderer.setPixelRatio(settings.pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.append(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 100);
const spark = new SparkRenderer({ renderer });
scene.add(spark);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ------------------------------------------------------------------ */
/* 当たり判定（見えない箱）                                            */
/* ------------------------------------------------------------------ */

const colliders = [];
const addCollider = (min, max, name) => colliders.push(makeCollider(scene, min, max, name));
addCollider([-3.2, 0, -6.2], [-3, ROOM_H, 6.2], "西の壁");
addCollider([3, 0, -6.2], [3.2, ROOM_H, 6.2], "東の壁");
addCollider([-3.2, 0, -6.2], [3.2, ROOM_H, -6], "北の壁");
addCollider([-3.2, 0, 6], [3.2, ROOM_H, 6.2], "南の壁");
addCollider([-3.2, 0, -WALL_HALF], [DOOR.x - DOOR.width / 2, ROOM_H, WALL_HALF], "仕切り壁・左");
addCollider([DOOR.x + DOOR.width / 2, 0, -WALL_HALF], [3.2, ROOM_H, WALL_HALF], "仕切り壁・右");
addCollider([DOOR.x - DOOR.width / 2, DOOR.height, -WALL_HALF], [DOOR.x + DOOR.width / 2, ROOM_H, WALL_HALF], "ドアの上");
const doorCollider = makeCollider(scene, [0, 0, 0], [0, 0, 0], "ドア");
colliders.push(doorCollider);

/* ------------------------------------------------------------------ */
/* ドア（部屋とは別のスプラット。常に読み込んでおく）                  */
/* ------------------------------------------------------------------ */

const door = {
  pivot: new THREE.Group(),
  mesh: new SplatMesh({
    constructSplats: (splats) =>
      buildDoor(splats, { width: DOOR.width, height: DOOR.height, thickness: DOOR.thickness }),
  }),
  angle: 0,
  target: 0,
  pendingOpen: false,
  get isClosed() {
    return this.target === 0 && Math.abs(this.angle) < 0.01;
  },
};
door.pivot.position.set(HINGE_X, 0, DOOR.z);
door.pivot.add(door.mesh);
scene.add(door.pivot);

function openDoor() {
  door.target = DOOR_OPEN_ANGLE;
  door.pendingOpen = false;
  hud.log("ドアを開けた");
}
function closeDoor(reason) {
  door.target = 0;
  door.pendingOpen = false;
  hud.log(`ドアを閉めた（${reason}）`);
}

function updateDoor(dt) {
  const speed = 2.6; // rad/s
  const diff = door.target - door.angle;
  door.angle += Math.sign(diff) * Math.min(Math.abs(diff), speed * dt);
  door.pivot.rotation.y = door.angle;

  // 回転途中のドアは判定を外す（斜めの板を軸並行の箱で表すと大きくなりすぎるため）
  const a = Math.abs(door.angle);
  const b = doorCollider.box;
  if (a < 0.26) {
    doorCollider.enabled = true;
    b.min.set(HINGE_X, 0, DOOR.z - 0.03);
    b.max.set(HINGE_X + DOOR.width, DOOR.height, DOOR.z + 0.03);
  } else if (a > 1.3) {
    doorCollider.enabled = true;
    b.min.set(HINGE_X - 0.03, 0, DOOR.z);
    b.max.set(HINGE_X + 0.03, DOOR.height, DOOR.z + DOOR.width);
  } else {
    doorCollider.enabled = false;
  }
}

/* ------------------------------------------------------------------ */
/* 部屋の読み込みと破棄                                                */
/* ------------------------------------------------------------------ */

const state = {
  A: { status: "unloaded", mesh: null, promise: null, wantUnload: false },
  B: { status: "unloaded", mesh: null, promise: null, wantUnload: false },
};

/** 撮影データは OpenCV 座標系（Y が下）のことが多いので flip で上下を戻す */
function applyTransform(mesh, t) {
  mesh.position.set(t.x, t.y, t.z);
  const flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), t.flip ? Math.PI : 0);
  const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(t.rotY));
  mesh.quaternion.copy(yaw).multiply(flip);
  mesh.scale.setScalar(t.scale);
}

function createRoomMesh(id) {
  const cfg = ROOMS[id];
  if (cfg.source) {
    const mesh = cfg.source.url
      ? new SplatMesh({ url: cfg.source.url })
      : // 読み込み側にバッファを渡すと使えなくなる場合があるので毎回コピーを渡す
        new SplatMesh({ fileBytes: cfg.source.fileBytes.slice(), fileName: cfg.source.fileName });
    applyTransform(mesh, cfg.transform);
    return mesh;
  }
  return new SplatMesh({
    constructSplats: (splats) =>
      buildRoom(splats, {
        min: cfg.min,
        max: cfg.max,
        style: cfg.style,
        doorways: [cfg.doorway],
        panels: cfg.panels,
        spacing: settings.roomSpacing,
        seed: cfg.seed,
      }),
  });
}

function loadRoom(id, reason) {
  const st = state[id];
  st.wantUnload = false;
  if (st.status === "loaded" || st.status === "error") return st.promise;
  if (st.status === "loading") return st.promise;
  st.status = "loading";
  const label = ROOMS[id].label;
  hud.log(`${label}を読み込み開始（${reason}）`);
  const t0 = performance.now();
  st.promise = (async () => {
    try {
      if (settings.fakeLatencyMs > 0) await sleep(settings.fakeLatencyMs);
      const mesh = createRoomMesh(id);
      await mesh.initialized;
      if (st.wantUnload) {
        mesh.dispose();
        st.status = "unloaded";
        hud.log(`${label}は読み込み中に不要になったので破棄`, "warn");
        return;
      }
      scene.add(mesh);
      st.mesh = mesh;
      st.status = "loaded";
      hud.log(`${label}を読み込み完了：${Math.round(performance.now() - t0)}ms・${formatCount(mesh.numSplats)}粒`, "ok");
    } catch (err) {
      console.error(err);
      st.status = "error";
      hud.log(`${label}の読み込みに失敗：${err.message}`, "bad");
    }
  })();
  return st.promise;
}

function unloadRoom(id, reason) {
  const st = state[id];
  if (st.status === "loading") {
    st.wantUnload = true;
    return;
  }
  if (st.status !== "loaded") return;
  scene.remove(st.mesh);
  st.mesh.dispose();
  st.mesh = null;
  st.status = "unloaded";
  hud.log(`${ROOMS[id].label}を破棄（${reason}）`);
}

/** 素材や設定を変えたときに読み直す */
function reloadRoom(id, reason) {
  const st = state[id];
  if (st.status === "error") st.status = "unloaded";
  if (st.status === "loaded" || st.status === "loading") unloadRoom(id, reason);
  // 必要なら次のフレームの updateStreaming が読み込み直す
}

const currentRoom = () => (player.position.z < 0 ? "A" : "B");
const otherRoom = (id) => (id === "A" ? "B" : "A");
const distToDoor = () => Math.hypot(player.position.x - DOOR.x, player.position.z - DOOR.z);

function updateStreaming() {
  const cur = currentRoom();
  const other = otherRoom(cur);
  const dist = distToDoor();
  if (state[cur].status === "unloaded") loadRoom(cur, "今いる部屋");

  if (!settings.streaming) {
    if (state[other].status === "unloaded") loadRoom(other, "自動破棄オフ");
    return;
  }
  const unloadAt = Math.max(settings.unloadDistance, settings.preloadDistance + 0.5);
  if (dist < settings.preloadDistance) {
    if (state[other].status === "unloaded") loadRoom(other, `ドアまで${dist.toFixed(1)}m`);
  } else if (dist > unloadAt && door.isClosed) {
    if (state[other].status === "loaded" || state[other].status === "loading") {
      unloadRoom(other, `ドアから${dist.toFixed(1)}m・ドアは閉`);
    }
  }

  if (settings.autoClose && door.target !== 0 && dist > 2.2) closeDoor("離れたので自動");

  if (door.pendingOpen) {
    if (state[other].status === "loaded") openDoor();
    else if (state[other].status === "error") door.pendingOpen = false;
  }
}

/* ------------------------------------------------------------------ */
/* プレイヤーと操作                                                    */
/* ------------------------------------------------------------------ */

const player = new Player({ camera, dom: renderer.domElement, getColliders: () => colliders });
player.setPose(0, -4.5, Math.PI); // 部屋Aからドアの方を向いて開始

const _fwd = new THREE.Vector3();
function canInteract() {
  const dx = DOOR.x - player.position.x;
  const dz = DOOR.z - player.position.z;
  const dist = Math.hypot(dx, dz);
  if (dist > 1.9) return false;
  if (dist < 0.8) return true;
  player.forward(_fwd);
  return (_fwd.x * dx + _fwd.z * dz) / dist > 0.35;
}

function interact() {
  if (!canInteract()) return;
  if (door.target !== 0 || door.pendingOpen) {
    closeDoor("手動");
    return;
  }
  const other = otherRoom(currentRoom());
  if (state[other].status === "loaded") {
    openDoor();
  } else {
    door.pendingOpen = true;
    if (state[other].status === "error") state[other].status = "unloaded";
    loadRoom(other, "ドアを開けようとした");
    hud.log("隣の部屋の読み込みを待ってから開く", "warn");
  }
}
player.onInteract = interact;

const prompt = createPrompt();
const action = createActionButton(interact);
createCrosshair();
createHint(
  player.isTouch
    ? "左半分：移動　右半分：視点　ボタン：ドア"
    : "クリック：視点操作　WASD：移動　Shift：走る　E：ドア　Esc：カーソルを戻す",
);

function updateInteractionUi() {
  let text = null;
  if (door.pendingOpen) text = "隣の部屋を読み込み中…";
  else if (canInteract()) text = door.target !== 0 ? "ドアを閉める" : "ドアを開ける";

  if (!text || !player.enabled) {
    prompt.hide();
    action.hidden = true;
    return;
  }
  if (player.isTouch) {
    prompt.hide();
    action.hidden = false;
    action.textContent = text;
    action.disabled = door.pendingOpen;
  } else {
    prompt.show(door.pendingOpen ? text : `E：${text}`);
  }
}

/* ------------------------------------------------------------------ */
/* 計測                                                                */
/* ------------------------------------------------------------------ */

const hud = new Hud([
  ["fps", "FPS"],
  ["splats", "描画中の粒"],
  ["roomA", "部屋A"],
  ["roomB", "部屋B"],
  ["door", "ドア"],
  ["heap", "JSヒープ"],
  ["gpu", "GPU資源"],
  ["pos", "位置"],
]);
const fps = new FpsMeter();
let memTimer = 0;

function roomStatusText(id) {
  const st = state[id];
  switch (st.status) {
    case "loaded":
      return [`読み込み済み・${formatCount(st.mesh.numSplats)}粒`, "ok"];
    case "loading":
      return ["読み込み中…", "warn"];
    case "error":
      return ["失敗", "bad"];
    default:
      return ["未読み込み", ""];
  }
}

function updateHud(dt) {
  const f = fps.tick(dt);
  hud.set("fps", f ? f.toFixed(0) : "-", fpsTone(f));
  hud.set("splats", formatCount(spark.activeSplats ?? 0), "accent");
  hud.set("roomA", ...roomStatusText("A"));
  hud.set("roomB", ...roomStatusText("B"));
  hud.set(
    "door",
    door.pendingOpen ? "読み込み待ち" : door.isClosed ? "閉" : door.target === 0 ? "閉じている途中" : "開",
    door.pendingOpen ? "warn" : "",
  );
  hud.set(
    "pos",
    `${ROOMS[currentRoom()].label} (${player.position.x.toFixed(1)}, ${player.position.z.toFixed(1)}) ドアまで${distToDoor().toFixed(1)}m`,
  );
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
  hud.log(`メモリ検証：部屋Bを${n}回 読み込み→破棄`);
  await nextFrames(3);
  const before = readMemory(renderer);
  const t0 = performance.now();
  for (let i = 0; i < n; i++) {
    const mesh = createRoomMesh("B");
    mesh.position.y -= 60; // 視界の外に置く
    await mesh.initialized;
    scene.add(mesh);
    await nextFrames(2); // GPUに送られるまで待つ
    scene.remove(mesh);
    mesh.dispose();
    await nextFrames(1);
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

const fLoad = gui.addFolder("読み込みと破棄");
fLoad.add(settings, "streaming").name("距離で自動的に読み込み・破棄");
fLoad.add(settings, "preloadDistance", 1, 6, 0.1).name("先読みを始める距離 (m)");
fLoad.add(settings, "unloadDistance", 1.5, 8, 0.1).name("破棄する距離 (m)");
fLoad.add(settings, "fakeLatencyMs", 0, 4000, 100).name("疑似的な読み込み遅延 (ms)");
fLoad.add(settings, "autoClose").name("離れたらドアを自動で閉める");

const fView = gui.addFolder("表示");
fView
  .add(settings, "showColliders")
  .name("当たり判定を表示")
  .onChange((v) => setCollidersVisible(colliders, v));
fView
  .add(settings, "pixelRatio", 0.5, 2, 0.25)
  .name("解像度の倍率")
  .onChange((v) => renderer.setPixelRatio(v));
fView
  .add(settings, "roomSpacing", 0.02, 0.06, 0.005)
  .name("仮の部屋の粒の間隔 (m)")
  .onFinishChange(() => {
    for (const id of ["A", "B"]) if (!ROOMS[id].source) reloadRoom(id, "粒の間隔を変更");
  });

function addRoomFolder(id) {
  const cfg = ROOMS[id];
  const f = gui.addFolder(`${cfg.label}の素材`);
  f.close();
  const info = { source: cfg.source ? cfg.source.url : "仮の部屋（コードで生成）" };
  const srcCtrl = f.add(info, "source").name("使用中").disable();
  f.add(
    {
      pick: async () => {
        const file = await pickSplatFile();
        if (!file) return;
        cfg.source = file;
        info.source = file.fileName;
        srcCtrl.updateDisplay();
        reloadRoom(id, "素材を差し替え");
      },
    },
    "pick",
  ).name("自分のファイルを読み込む");
  f.add(
    {
      reset: () => {
        cfg.source = null;
        info.source = "仮の部屋（コードで生成）";
        srcCtrl.updateDisplay();
        reloadRoom(id, "仮の部屋に戻す");
      },
    },
    "reset",
  ).name("仮の部屋に戻す");

  const t = cfg.transform;
  const apply = () => {
    const m = state[id].mesh;
    if (m && cfg.source) applyTransform(m, t);
  };
  f.add(t, "x", -10, 10, 0.01).name("位置 X").onChange(apply);
  f.add(t, "y", -5, 5, 0.01).name("位置 Y").onChange(apply);
  f.add(t, "z", -10, 10, 0.01).name("位置 Z").onChange(apply);
  f.add(t, "rotY", -180, 180, 0.5).name("向き（度）").onChange(apply);
  f.add(t, "scale", 0.05, 5, 0.01).name("大きさ").onChange(apply);
  f.add(t, "flip").name("上下を反転（撮影データ用）").onChange(apply);
  f.add(
    {
      copy: async () => {
        const ok = await copyText(JSON.stringify(t));
        hud.log(ok ? `${cfg.label}の位置合わせの値をコピーした` : "コピーできなかったのでコンソールに出力した");
      },
    },
    "copy",
  ).name("位置合わせの値をコピー");
}
addRoomFolder("A");
addRoomFolder("B");

const fMem = gui.addFolder("メモリの検証");
fMem.add(settings, "stressCount", 5, 50, 1).name("繰り返す回数");
fMem.add({ run: runStressTest }, "run").name("部屋Bの読み込み→破棄を繰り返す");

/* ------------------------------------------------------------------ */
/* 開始                                                                */
/* ------------------------------------------------------------------ */

const overlay = createOverlay({
  title: "部屋2つとドア1枚",
  body: "見た目はスプラット、当たり判定は透明な箱。ドアに近づくと隣の部屋を読み込み、離れると破棄します。部屋の素材は設定パネルから撮影データに差し替えられます。",
  controls: player.isTouch
    ? [
        ["移動", "画面の左半分をドラッグ"],
        ["視点", "画面の右半分をドラッグ"],
        ["ドア", "近づくと出るボタン"],
      ]
    : [
        ["移動", "WASD（Shiftで走る）"],
        ["視点", "クリックしてマウス"],
        ["ドア", "E"],
        ["設定", "Escでカーソルを戻して右上のパネル"],
      ],
});

let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  player.update(dt);
  updateDoor(dt);
  updateStreaming();
  updateInteractionUi();
  if (settings.showColliders) setCollidersVisible(colliders, true);
  renderer.render(scene, camera);
  updateHud(dt);
});

overlay.status("部屋Aを生成しています…");
Promise.all([door.mesh.initialized, loadRoom("A", "開始時")])
  .then(() => {
    overlay.status("");
    overlay.ready();
  })
  .catch((err) => overlay.status(`準備に失敗しました：${err.message}`, "bad"));

overlay.started.then(() => {
  player.enabled = true;
  if (!player.isTouch) renderer.domElement.requestPointerLock?.();
});

// コンソールから状態を確認できるようにしておく
window.sample = { THREE, renderer, camera, scene, spark, player, door, state, settings, ROOMS, interact, runStressTest };
