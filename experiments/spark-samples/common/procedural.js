import * as THREE from "three";

/*
 * 撮影したスプラットがまだ無くても検証を始められるように、
 * 部屋・ドア・小物を「コードで」スプラットとして生成する仮素材。
 *
 * どれも PackedSplats.pushSplat(center, scales, quaternion, opacity, color) で
 * 1粒ずつ積んでいるだけなので、実物の撮影データに差し替えても扱いは同じ。
 * 単位はメートル、Y が上。
 */

/* ------------------------------------------------------------------ */
/* 基本の道具                                                          */
/* ------------------------------------------------------------------ */

/** 毎回同じ部屋が生成されるよう、乱数は種から作る */
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 16進の色を「色空間の変換なし」で THREE.Color に入れる。
 * スプラットの色は撮影データと同じく sRGB の値をそのまま持たせる。
 * （new THREE.Color(0xffffff) だと線形空間に変換されて暗くなる）
 */
export function raw(hex, out = new THREE.Color()) {
  return out.setRGB(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);
}

const Z_AXIS = new THREE.Vector3(0, 0, 1);
const _center = new THREE.Vector3();
const _scales = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _normal = new THREE.Vector3();
const _color = new THREE.Color();
const _tmp = new THREE.Vector3();

function emit(splats, center, sx, sy, sz, quat, opacity, color, xform) {
  if (xform) {
    _tmp.copy(center).applyQuaternion(xform.quaternion).add(xform.position);
    _quat.copy(xform.quaternion).multiply(quat);
    _scales.set(sx, sy, sz);
    splats.pushSplat(_tmp, _scales, _quat, opacity, color);
  } else {
    _scales.set(sx, sy, sz);
    splats.pushSplat(center, _scales, quat, opacity, color);
  }
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
/** 色に明るさの係数を掛ける（0〜1に収める） */
function shadeBy(c, k) {
  c.r = clamp01(c.r * k);
  c.g = clamp01(c.g * k);
  c.b = clamp01(c.b * k);
  return c;
}
function hash2(i, j, seed = 0) {
  let h = (i * 374761393 + j * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * 長方形の面に薄い円盤状のスプラットを敷き詰める。
 * origin から u 方向に w、v 方向に h の範囲。shade(s, t, color) で色を決め、
 * false を返した位置には置かない（穴あけに使う）。
 */
export function fillRect(
  splats,
  { origin, u, v, w, h, spacing, rand, shade, size = 0.6, flat = 0.12, opacity = 1, jitter = 0.5, xform, bulge },
) {
  _normal.crossVectors(u, v).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(Z_AXIS, _normal);
  const nu = Math.max(1, Math.round(w / spacing));
  const nv = Math.max(1, Math.round(h / spacing));
  const du = w / nu;
  const dv = h / nv;
  const r = Math.max(du, dv) * size;
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const s = (i + 0.5 + (rand() - 0.5) * jitter) * du;
      const t = (j + 0.5 + (rand() - 0.5) * jitter) * dv;
      if (shade(s, t, _color) === false) continue;
      _center.copy(origin).addScaledVector(u, s).addScaledVector(v, t);
      if (bulge) _center.addScaledVector(_normal, bulge(s, t));
      emit(splats, _center, r, r, r * flat, q, opacity, _color, xform);
    }
  }
}

/**
 * 直方体の表面（底面以外）を埋める。shade(face, s, t, color, w, h)。
 * face は "front"(+Z) "back" "left" "right" "top"。
 */
export function fillBox(splats, { min, max, spacing, rand, shade, xform, size, opacity, skip = [] }) {
  const dx = max.x - min.x;
  const dy = max.y - min.y;
  const dz = max.z - min.z;
  const X = new THREE.Vector3(1, 0, 0);
  const Y = new THREE.Vector3(0, 1, 0);
  const Zp = new THREE.Vector3(0, 0, 1);
  const nX = X.clone().negate();
  const nZ = Zp.clone().negate();
  const faces = [
    ["front", new THREE.Vector3(min.x, min.y, max.z), X, Y, dx, dy],
    ["back", new THREE.Vector3(max.x, min.y, min.z), nX, Y, dx, dy],
    ["right", new THREE.Vector3(max.x, min.y, max.z), nZ, Y, dz, dy],
    ["left", new THREE.Vector3(min.x, min.y, min.z), Zp, Y, dz, dy],
    ["top", new THREE.Vector3(min.x, max.y, max.z), X, nZ, dx, dz],
  ];
  for (const [face, origin, u, v, w, h] of faces) {
    if (skip.includes(face)) continue;
    fillRect(splats, {
      origin,
      u,
      v,
      w,
      h,
      spacing,
      rand,
      xform,
      size,
      opacity,
      shade: (s, t, c) => shade(face, s, t, c, w, h),
    });
  }
}

/** 楕円体の表面に、向きがばらばらの毛羽立ったスプラットを置く */
function fuzzyEllipsoid(splats, { center, radii, spacing, rand, shade, opacity = 0.92, fluff = 0.006 }) {
  const area =
    4 * Math.PI * ((radii.x * radii.y) ** 1.6 + (radii.x * radii.z) ** 1.6 + (radii.y * radii.z) ** 1.6) ** (1 / 1.6) / 3 ** (1 / 1.6);
  const n = Math.max(24, Math.round(area / (spacing * spacing)));
  const golden = Math.PI * (3 - Math.sqrt(5));
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const rr = Math.sqrt(1 - y * y);
    const th = golden * i;
    _normal.set(Math.cos(th) * rr, y, Math.sin(th) * rr);
    const out = 1 + rand() * (fluff / Math.max(radii.x, radii.y));
    _center.set(
      center.x + _normal.x * radii.x * out,
      center.y + _normal.y * radii.y * out,
      center.z + _normal.z * radii.z * out,
    );
    if (shade(_normal, _center, _color) === false) continue;
    e.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
    q.setFromEuler(e);
    const s = spacing * (0.7 + rand() * 0.5);
    emit(splats, _center, s, s, s * 0.45, q, opacity, _color);
  }
}

/* ------------------------------------------------------------------ */
/* 部屋                                                                */
/* ------------------------------------------------------------------ */

/** 壁・床・天井の角を暗くして、焼き込んだ陰影っぽく見せる */
function cornerShade(s, t, w, h) {
  const side = Math.min(s, w - s);
  return clamp01(1 - 0.3 * Math.exp(-t / 0.22) - 0.14 * Math.exp(-(h - t) / 0.18) - 0.14 * Math.exp(-side / 0.3));
}

function makeStains(rand, w, h, count) {
  const list = [];
  for (let i = 0; i < count; i++) {
    list.push({
      s: rand() * w,
      t: rand() * h * 0.9,
      rx: 0.1 + rand() * 0.45,
      ry: 0.08 + rand() * 0.35,
      k: 0.08 + rand() * 0.14,
    });
  }
  return list;
}
function stainFactor(stains, s, t) {
  let k = 1;
  for (const st of stains) {
    const d = ((s - st.s) / st.rx) ** 2 + ((t - st.t) / st.ry) ** 2;
    if (d < 1) k *= 1 - st.k * (1 - d);
  }
  return k;
}

/** 天井の照明パネル（部屋の中心からの相対位置、メートル） */
function inPanel(panels, x, z) {
  for (const p of panels) {
    if (Math.abs(x - p.x) < p.w / 2 && Math.abs(z - p.z) < p.d / 2) return true;
  }
  return false;
}

const ROOM_STYLES = {
  // 黄色い壁紙と湿ったカーペット（オフィス系のリミナル）
  office: {
    wall(s, t, c, ctx) {
      raw(0xcdbd77, c);
      const stripe = Math.sin((s / 0.11) * Math.PI * 2) > 0.55 ? 1.035 : 1;
      const dot = (s * 9) % 1 < 0.18 && (t * 9) % 1 < 0.18 ? 0.95 : 1;
      const noise = 0.97 + ctx.rand() * 0.06;
      shadeBy(c, stripe * dot * noise * stainFactor(ctx.stains, s, t) * cornerShade(s, t, ctx.w, ctx.h));
      // 床際の巾木
      if (t < 0.08) shadeBy(raw(0x7b6c4b, c), 0.9 + ctx.rand() * 0.1);
    },
    floor(s, t, c, ctx) {
      raw(0x8e7b4c, c);
      shadeBy(c, (0.88 + ctx.rand() * 0.2) * stainFactor(ctx.stains, s, t) * cornerShade(s, t, ctx.w, ctx.h) ** 0.5);
    },
    ceiling(s, t, c, ctx) {
      if (inPanel(ctx.panels, ctx.toX(s), ctx.toZ(t))) {
        raw(0xfffbea, c);
        return;
      }
      raw(0xd9d5c3, c);
      const grid = (s + 0.3) % 0.6 < ctx.spacing || (t + 0.3) % 0.6 < ctx.spacing ? 0.82 : 1;
      shadeBy(c, grid * (0.96 + ctx.rand() * 0.06));
    },
    trim: 0x6d5f43,
  },
  // 白っぽいタイルの部屋（プールや更衣室のリミナル）
  tile: {
    wall(s, t, c, ctx) {
      const size = 0.2;
      const gs = s % size;
      const gt = t % size;
      if (gs < ctx.spacing * 0.9 || gt < ctx.spacing * 0.9) {
        raw(0x8fa6ab, c);
      } else {
        raw(0xd3e4e7, c);
        shadeBy(c, 0.95 + hash2(Math.floor(s / size), Math.floor(t / size), 3) * 0.08);
      }
      shadeBy(c, cornerShade(s, t, ctx.w, ctx.h) * stainFactor(ctx.stains, s, t));
    },
    floor(s, t, c, ctx) {
      const size = 0.3;
      if (s % size < ctx.spacing * 0.9 || t % size < ctx.spacing * 0.9) raw(0x7f9599, c);
      else {
        raw(0xb3cdd3, c);
        shadeBy(c, 0.94 + hash2(Math.floor(s / size), Math.floor(t / size), 9) * 0.1);
      }
      shadeBy(c, cornerShade(s, t, ctx.w, ctx.h) ** 0.5);
    },
    ceiling(s, t, c, ctx) {
      if (inPanel(ctx.panels, ctx.toX(s), ctx.toZ(t))) {
        raw(0xf4faff, c);
        return;
      }
      raw(0xdfe3e1, c);
      shadeBy(c, 0.96 + ctx.rand() * 0.05);
    },
    trim: 0x9aa7a6,
  },
};

/**
 * 箱型の部屋の内側をスプラットで作る。
 *
 * min / max   : 部屋の内側の範囲（THREE.Vector3）
 * doorways    : [{ wall: "north"|"south"|"east"|"west", center, width, height, depth }]
 *               center は壁に沿ったワールド座標（north/south なら x、east/west なら z）
 *               depth は壁の厚みの半分（開口部の側面を埋める）
 * panels      : 天井の照明パネル [{ x, z, w, d }]（ワールド座標）
 */
export function buildRoom(splats, { min, max, style = "office", doorways = [], panels = [], spacing = 0.03, seed = 1 }) {
  const rand = makeRng(seed);
  const S = ROOM_STYLES[style];
  const W = max.x - min.x;
  const D = max.z - min.z;
  const H = max.y - min.y;
  const X = new THREE.Vector3(1, 0, 0);
  const Y = new THREE.Vector3(0, 1, 0);
  const Zp = new THREE.Vector3(0, 0, 1);

  const walls = {
    north: { origin: new THREE.Vector3(min.x, min.y, min.z), u: X, len: W, toS: (x) => x - min.x },
    south: { origin: new THREE.Vector3(max.x, min.y, max.z), u: X.clone().negate(), len: W, toS: (x) => max.x - x },
    west: { origin: new THREE.Vector3(min.x, min.y, max.z), u: Zp.clone().negate(), len: D, toS: (z) => max.z - z },
    east: { origin: new THREE.Vector3(max.x, min.y, min.z), u: Zp, len: D, toS: (z) => z - min.z },
  };

  for (const [name, wall] of Object.entries(walls)) {
    const holes = doorways
      .filter((d) => d.wall === name)
      .map((d) => ({ s: wall.toS(d.center), half: d.width / 2, height: d.height, depth: d.depth ?? 0 }));
    const ctx = { rand, w: wall.len, h: H, stains: makeStains(rand, wall.len, H, 5), spacing };
    fillRect(splats, {
      origin: wall.origin,
      u: wall.u,
      v: Y,
      w: wall.len,
      h: H,
      spacing,
      rand,
      shade(s, t, c) {
        for (const hole of holes) {
          const ds = Math.abs(s - hole.s) - hole.half;
          if (ds < 0 && t < hole.height) return false; // 開口部
          if (ds < 0.07 && t < hole.height + 0.07) {
            raw(S.trim, c); // 枠
            shadeBy(c, 0.92 + rand() * 0.1);
            return true;
          }
        }
        S.wall(s, t, c, ctx);
        return true;
      },
    });

    // 開口部の側面と上面（壁の厚みの部分）
    const n = new THREE.Vector3().crossVectors(wall.u, Y);
    for (const hole of holes) {
      if (hole.depth <= 0) continue;
      const trim = (s, t, c) => {
        raw(S.trim, c);
        shadeBy(c, 0.85 + rand() * 0.1);
      };
      const left = wall.origin.clone().addScaledVector(wall.u, hole.s - hole.half);
      const right = wall.origin.clone().addScaledVector(wall.u, hole.s + hole.half);
      const back = n.clone().negate();
      fillRect(splats, { origin: left, u: back, v: Y, w: hole.depth, h: hole.height, spacing, rand, shade: trim });
      fillRect(splats, { origin: right, u: back, v: Y, w: hole.depth, h: hole.height, spacing, rand, shade: trim });
      fillRect(splats, {
        origin: left.clone().addScaledVector(Y, hole.height),
        u: wall.u,
        v: back,
        w: hole.half * 2,
        h: hole.depth,
        spacing,
        rand,
        shade: trim,
      });
    }
  }

  const surfCtx = (w, h) => ({
    rand,
    w,
    h,
    spacing,
    panels,
    stains: makeStains(rand, w, h, 4),
    toX: (s) => min.x + s,
    toZ: (t) => min.z + t,
  });

  // 床（s: +x, t: -z 方向）
  const floorCtx = surfCtx(W, D);
  fillRect(splats, {
    origin: new THREE.Vector3(min.x, min.y, max.z),
    u: X,
    v: Zp.clone().negate(),
    w: W,
    h: D,
    spacing,
    rand,
    shade: (s, t, c) => {
      S.floor(s, t, c, floorCtx);
      return true;
    },
  });

  // 天井（s: +x, t: +z 方向）
  const ceilCtx = surfCtx(W, D);
  fillRect(splats, {
    origin: new THREE.Vector3(min.x, max.y, min.z),
    u: X,
    v: Zp,
    w: W,
    h: D,
    spacing,
    rand,
    shade: (s, t, c) => {
      S.ceiling(s, t, c, ceilCtx);
      return true;
    },
  });
}

/* ------------------------------------------------------------------ */
/* ドア                                                                */
/* ------------------------------------------------------------------ */

/**
 * ドア板。蝶番が原点、板は +X 方向に width、+Y 方向に height、厚みは Z 方向。
 * 開閉は呼び出し側で Y 軸回転させる。
 */
export function buildDoor(splats, { width = 0.9, height = 2.05, thickness = 0.05, spacing = 0.018, seed = 5 }) {
  const rand = makeRng(seed);
  const X = new THREE.Vector3(1, 0, 0);
  const Y = new THREE.Vector3(0, 1, 0);
  const half = thickness / 2;
  const face = (s, t, c) => {
    raw(0xb9b29b, c);
    // 化粧板の溝
    const inset = 0.12;
    const onLine =
      (Math.abs(s - inset) < spacing && t > inset && t < height - inset) ||
      (Math.abs(s - (width - inset)) < spacing && t > inset && t < height - inset) ||
      (Math.abs(t - inset) < spacing && s > inset && s < width - inset) ||
      (Math.abs(t - (height - inset)) < spacing && s > inset && s < width - inset) ||
      (Math.abs(t - height * 0.48) < spacing && s > inset && s < width - inset);
    shadeBy(c, (onLine ? 0.78 : 1) * (0.95 + rand() * 0.07) * (1 - 0.18 * Math.exp(-t / 0.3)));
    return true;
  };
  for (const z of [half, -half]) {
    fillRect(splats, {
      origin: new THREE.Vector3(z > 0 ? 0 : width, 0, z),
      u: z > 0 ? X : X.clone().negate(),
      v: Y,
      w: width,
      h: height,
      spacing,
      rand,
      shade: face,
    });
  }
  // 小口（厚みの面）
  const edge = (s, t, c) => {
    raw(0x8c8572, c);
    return true;
  };
  const Zp = new THREE.Vector3(0, 0, 1);
  fillRect(splats, { origin: new THREE.Vector3(width, 0, -half), u: Zp, v: Y, w: thickness, h: height, spacing, rand, shade: edge });
  fillRect(splats, { origin: new THREE.Vector3(0, 0, -half), u: Zp, v: Y, w: thickness, h: height, spacing, rand, shade: edge });
  fillRect(splats, { origin: new THREE.Vector3(0, height, half), u: X, v: Zp.clone().negate(), w: width, h: thickness, spacing, rand, shade: edge });

  // レバーハンドル（両面）
  const q = new THREE.Quaternion();
  for (const side of [1, -1]) {
    for (let i = 0; i < 70; i++) {
      const along = rand();
      const p = new THREE.Vector3(width - 0.07 - along * 0.12, 1.0 + (rand() - 0.5) * 0.02, side * (half + 0.045 + (rand() - 0.5) * 0.015));
      raw(0xc9cbc6, _color);
      shadeBy(_color, 0.75 + rand() * 0.35);
      emit(splats, p, 0.008, 0.008, 0.008, q, 1, _color);
    }
    for (let i = 0; i < 40; i++) {
      const a = rand() * Math.PI * 2;
      const r = rand() * 0.025;
      const p = new THREE.Vector3(width - 0.07 + Math.cos(a) * r, 1.0 + Math.sin(a) * r, side * (half + 0.012));
      raw(0xa9aba5, _color);
      emit(splats, p, 0.007, 0.007, 0.004, q, 1, _color);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 小物                                                                */
/* ------------------------------------------------------------------ */

const propSpacing = (base, density) => base / Math.sqrt(Math.max(0.25, density));

/** 観葉植物（柔らかいもの）。原点は鉢の底の中心。高さ約1m */
export function buildPlant(splats, { density = 1, seed = 11 } = {}) {
  const rand = makeRng(seed);
  const ps = propSpacing(0.012, density);
  const q = new THREE.Quaternion();
  const n = new THREE.Vector3();

  // 鉢（上が広い円錐台）
  const r0 = 0.13;
  const r1 = 0.17;
  const ph = 0.28;
  const slope = (r1 - r0) / ph;
  const na = Math.round((2 * Math.PI * ((r0 + r1) / 2)) / ps);
  const nh = Math.round(ph / ps);
  for (let i = 0; i < na; i++) {
    for (let j = 0; j < nh; j++) {
      const a = ((i + rand() * 0.5) / na) * Math.PI * 2;
      const y = ((j + 0.5) / nh) * ph;
      const r = r0 + slope * y;
      _center.set(Math.cos(a) * r, y, Math.sin(a) * r);
      n.set(Math.cos(a), -slope, Math.sin(a)).normalize();
      q.setFromUnitVectors(Z_AXIS, n);
      raw(0xae6844, _color);
      const rim = y > ph - 0.035 ? 1.12 : 1;
      shadeBy(_color, rim * (0.8 + 0.25 * (y / ph)) * (0.93 + rand() * 0.1));
      emit(splats, _center, ps * 0.62, ps * 0.62, ps * 0.1, q, 1, _color);
    }
  }
  // 土
  const soilY = ph - 0.02;
  q.setFromUnitVectors(Z_AXIS, new THREE.Vector3(0, 1, 0));
  for (let r = ps * 0.5; r < r1 - 0.01; r += ps) {
    const m = Math.max(6, Math.round((2 * Math.PI * r) / ps));
    for (let k = 0; k < m; k++) {
      const a = ((k + rand()) / m) * Math.PI * 2;
      _center.set(Math.cos(a) * r, soilY + rand() * 0.006, Math.sin(a) * r);
      raw(0x3d2b1c, _color);
      shadeBy(_color, 0.7 + rand() * 0.5);
      emit(splats, _center, ps * 0.7, ps * 0.7, ps * 0.3, q, 1, _color);
    }
  }

  // 葉（細長い葉が鉢から放射状に伸びて先が垂れる）
  const leaves = 22;
  const d = new THREE.Vector3();
  const across = new THREE.Vector3();
  const p = new THREE.Vector3();
  for (let L = 0; L < leaves; L++) {
    const phi = (L / leaves) * Math.PI * 2 + rand() * 0.5;
    const tilt0 = 0.12 + rand() * 0.45;
    const bend = 0.5 + rand() * 0.9;
    const length = 0.5 + rand() * 0.38;
    const maxW = 0.045 + rand() * 0.025;
    const steps = Math.round(length / ps);
    const ds = length / steps;
    p.set(Math.cos(phi) * 0.03, soilY, Math.sin(phi) * 0.03);
    across.set(-Math.sin(phi), 0, Math.cos(phi));
    const hue = rand();
    for (let k = 0; k < steps; k++) {
      const u = k / steps;
      const th = tilt0 + bend * u * u;
      d.set(Math.sin(th) * Math.cos(phi), Math.cos(th), Math.sin(th) * Math.sin(phi));
      p.addScaledVector(d, ds);
      const width = maxW * (1 - u ** 1.6) * Math.min(1, u * 7 + 0.15);
      const nw = Math.max(1, Math.round((width * 2) / ps));
      n.crossVectors(d, across).normalize();
      q.setFromUnitVectors(Z_AXIS, n);
      for (let w = 0; w < nw; w++) {
        const off = ((w + 0.5) / nw - 0.5) * width * 2;
        _center.copy(p).addScaledVector(across, off).addScaledVector(n, -Math.abs(off) * 0.25);
        const edge = Math.abs(off) / Math.max(width, 1e-4);
        _color.setRGB(0.16 + hue * 0.06, 0.38 + hue * 0.1, 0.13 + hue * 0.04);
        // 中央の葉脈は明るく、縁と先端は黄色寄り
        if (edge < 0.2) shadeBy(_color, 1.18);
        if (u > 0.85) _color.r += 0.08;
        shadeBy(_color, (0.75 + 0.35 * u) * (0.92 + rand() * 0.14) * (1 - edge * 0.15));
        emit(splats, _center, ps * 0.62, ps * 0.62, ps * 0.12, q, 0.96, _color);
      }
    }
  }
}

/** ブラウン管テレビ（硬いもの）。原点は底面の中心、正面は +Z */
export function buildCrtTv(splats, { density = 1, seed = 21 } = {}) {
  const rand = makeRng(seed);
  const ps = propSpacing(0.009, density);
  const W = 0.52;
  const H = 0.42;
  const D = 0.46;
  const screen = { s0: 0.035, s1: 0.385, t0: 0.06, t1: 0.375, r: 0.035 };
  const inScreen = (s, t) => {
    const cx = Math.min(Math.max(s, screen.s0 + screen.r), screen.s1 - screen.r);
    const cy = Math.min(Math.max(t, screen.t0 + screen.r), screen.t1 - screen.r);
    return Math.hypot(s - cx, t - cy) < screen.r && s > screen.s0 && s < screen.s1 && t > screen.t0 && t < screen.t1;
  };
  fillBox(splats, {
    min: new THREE.Vector3(-W / 2, 0, -D / 2),
    max: new THREE.Vector3(W / 2, H, D / 2),
    spacing: ps,
    rand,
    shade(face, s, t, c, w, h) {
      raw(0xcdc4ac, c);
      let k = 0.94 + rand() * 0.07;
      if (face === "front") {
        if (inScreen(s, t)) {
          // 画面：暗いガラスに天井の映り込み
          const u = (s - screen.s0) / (screen.s1 - screen.s0);
          const v = (t - screen.t0) / (screen.t1 - screen.t0);
          const vignette = 1 - 0.5 * ((u - 0.5) ** 2 + (v - 0.5) ** 2) * 2;
          const reflect = 0.12 * smooth(0.45, 1, v) * smooth(0.7, 0.2, u);
          c.setRGB(0.09 + reflect, 0.115 + reflect, 0.105 + reflect);
          shadeBy(c, vignette * (0.95 + rand() * 0.08));
          return true;
        }
        const nearScreen = s > screen.s0 - 0.02 && s < screen.s1 + 0.02 && t > screen.t0 - 0.02 && t < screen.t1 + 0.02;
        if (nearScreen) k *= 0.72; // 画面まわりの黒い縁
        // つまみ
        for (const kt of [0.3, 0.22]) {
          if (Math.hypot(s - 0.455, t - kt) < 0.018) {
            raw(0x2f2c27, c);
            return true;
          }
        }
        // スピーカーの穴
        if (s > 0.42 && s < 0.495 && t > 0.06 && t < 0.15 && Math.floor(t / 0.012) % 2 === 0) k *= 0.6;
      }
      if (face === "top") {
        k *= 1.05;
        if (t > h * 0.55 && t < h * 0.85 && Math.floor(s / 0.02) % 2 === 0 && s > 0.08 && s < w - 0.08) k *= 0.55; // 通気口
      }
      if (face === "back") k *= 0.82;
      if (face !== "top") k *= 1 - 0.25 * Math.exp(-t / 0.05);
      shadeBy(c, k);
      return true;
    },
  });
}

/** ぬいぐるみ（ガラスケースに入れる）。原点は足元の中心、正面は +Z */
export function buildPlush(splats, { density = 1, seed = 31 } = {}) {
  const rand = makeRng(seed);
  const ps = propSpacing(0.0075, density);
  const fur = (lightness) => (nrm, pos, c) => {
    c.setRGB(0.56, 0.39, 0.25);
    shadeBy(c, lightness * (0.8 + rand() * 0.35) * (0.8 + 0.2 * clamp01(nrm.y + 0.6)));
    return true;
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const parts = [
    [V(0, 0.13, 0), V(0.11, 0.12, 0.09), fur(1)], // 胴
    [V(0, 0.3, 0.01), V(0.088, 0.083, 0.08), fur(1.04)], // 頭
    [V(-0.062, 0.37, 0), V(0.03, 0.03, 0.018), fur(0.95)], // 耳
    [V(0.062, 0.37, 0), V(0.03, 0.03, 0.018), fur(0.95)],
    [V(-0.105, 0.16, 0.03), V(0.034, 0.06, 0.034), fur(0.98)], // 腕
    [V(0.105, 0.16, 0.03), V(0.034, 0.06, 0.034), fur(0.98)],
    [V(-0.055, 0.035, 0.05), V(0.042, 0.035, 0.05), fur(0.97)], // 足
    [V(0.055, 0.035, 0.05), V(0.042, 0.035, 0.05), fur(0.97)],
    [V(0, 0.28, 0.075), V(0.038, 0.03, 0.03), fur(1.35)], // 鼻まわり
  ];
  for (const [center, radii, shade] of parts) {
    fuzzyEllipsoid(splats, { center, radii, spacing: ps, rand, shade });
  }
  // 目と鼻（小さく暗い粒の塊）
  const q = new THREE.Quaternion();
  const dots = [
    [V(-0.032, 0.315, 0.079), 0.011],
    [V(0.032, 0.315, 0.079), 0.011],
    [V(0, 0.29, 0.104), 0.012],
  ];
  for (const [p, r] of dots) {
    for (let i = 0; i < 40; i++) {
      _center.set(p.x + (rand() - 0.5) * r, p.y + (rand() - 0.5) * r, p.z + rand() * 0.004);
      _color.setRGB(0.05, 0.04, 0.04);
      emit(splats, _center, r * 0.35, r * 0.35, r * 0.2, q, 1, _color);
    }
  }
}

/** 段ボール2箱の積み重ね（ガラスの手前に置いて描画順を確かめる） */
export function buildCardboardStack(splats, { density = 1, seed = 41 } = {}) {
  const rand = makeRng(seed);
  const ps = propSpacing(0.011, density);
  const boxes = [
    { size: [0.5, 0.46, 0.42], pos: [0, 0, 0], rotY: 0 },
    { size: [0.44, 0.38, 0.36], pos: [0.02, 0.46, -0.01], rotY: 0.21 },
    { size: [0.34, 0.26, 0.3], pos: [-0.03, 0.84, 0.02], rotY: -0.12 },
  ];
  for (const b of boxes) {
    const [w, h, d] = b.size;
    const xform = {
      position: new THREE.Vector3(...b.pos),
      quaternion: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.rotY),
    };
    const stains = makeStains(rand, 0.5, 0.5, 2);
    fillBox(splats, {
      min: new THREE.Vector3(-w / 2, 0, -d / 2),
      max: new THREE.Vector3(w / 2, h, d / 2),
      spacing: ps,
      rand,
      xform,
      shade(face, s, t, c, fw, fh) {
        raw(0xb38d5c, c);
        let k = (0.93 + rand() * 0.08) * (Math.sin((s / 0.008) * Math.PI) > 0.6 ? 0.97 : 1);
        k *= stainFactor(stains, s % 0.5, t % 0.5);
        const edge = Math.min(s, fw - s, t, fh - t);
        if (edge < 0.015) k *= 0.82;
        if (face === "top") {
          if (Math.abs(s - fw / 2) < 0.025) {
            raw(0xcdb68a, c); // ガムテープ
            shadeBy(c, 1.04 + rand() * 0.05);
            return true;
          }
          if (Math.abs(t - fh / 2) < ps * 0.7) k *= 0.7; // フタの合わせ目
        }
        if (face === "front" && s > fw * 0.15 && s < fw * 0.38 && t > fh * 0.55 && t < fh * 0.8) {
          raw(0x9a2f25, c); // 印刷マーク
          shadeBy(c, 0.9 + rand() * 0.1);
          return true;
        }
        if (face !== "top") k *= 1 - 0.22 * Math.exp(-t / 0.04);
        shadeBy(c, k);
        return true;
      },
    });
  }
}
