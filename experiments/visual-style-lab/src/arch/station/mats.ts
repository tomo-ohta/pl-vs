import * as THREE from 'three';
import { fieldMat } from './field.ts';
import { stationMat, type StationMatOptions } from './mat.ts';
import { D, D_OLD } from './layout.ts';
import { signAtlas } from './signs.ts';

/** 柱の高さによる明るさ（屋根の下で暗く、床の近くで暗い） */
const PILLAR_GRAD = /* glsl */ `
  albedo *= mix(0.3, 1.0, smoothstep(0.3, 2.2, p.y)) * mix(1.0, 0.4, smoothstep(2.2, 3.3, p.y));
`;

/** 白いタイルの目地と、1 枚ずつの色のむら（焼きむら・汚れ） */
const TILE_J = /* glsl */ `
  {
    vec3 a = abs(n);
    vec2 uv = a.x > 0.5 ? p.zy : (a.z > 0.5 ? p.xy : p.xz);
    vec2 g = abs(fract(uv / 0.15) - 0.5) * 0.15;
    vec2 w = fwidth(uv) * 0.8 + 0.004;
    float line = 1.0 - smoothstep(0.0, w.x, g.x) * smoothstep(0.0, w.y, g.y);
    float h = sl_hash12(floor(uv / 0.15) + floor(a.x * 3.0) * 17.0);
    albedo *= mix(1.0, 0.72, line) * (0.93 + 0.12 * h);
  }
`;

/**
 * 壁の傷み（縦の面）: 天井の継ぎ目から垂れた細い水の筋（0.6 m の列ごとに 3 割ほど・幅 3〜8 cm・縁はくっきり・下の端はちぎれる）と、
 * 床から上がる湿りの帯（縁はくっきり、ちぎれる）。壁の明るさはそのまま（筋と帯だけ暗い）。
 * uSpan = (床の高さ, 天井の高さ, 強さ, 湿りの帯の高さの倍率)
 */
const WEAR = /* glsl */ `
  if (abs(n.y) < 0.5) {
    float hx = abs(n.x) > 0.5 ? p.z : p.x;
    float H = uSpan.y - uSpan.x;
    float ci = floor(hx / 0.6);
    float run = 0.0;
    if (sl_hash12(vec2(ci, 3.7 + uSpan.x)) > 0.68) {
      float cx = (ci + 0.2 + 0.6 * sl_hash12(vec2(ci, 9.1))) * 0.6;
      float w = 0.018 + 0.03 * sl_hash12(vec2(ci, 5.3));
      float len = (0.25 + 0.55 * sl_hash12(vec2(ci, 1.1))) * H;
      float d = abs(hx - cx + sl_vnoise(vec3(p.y * 3.0, ci, 2.0)) * 0.012);
      float aw = fwidth(hx) + 1e-4;
      float core = 1.0 - smoothstep(w - aw, w + aw, d);
      float fromTop = uSpan.y - p.y;
      float endN = len * (1.0 + sl_vnoise(vec3(hx * 9.0, 0.0, ci)) * 0.2);
      float vert = 1.0 - smoothstep(endN - 0.04, endN + 0.04, fromTop);
      run = core * vert * mix(0.55, 1.0, 1.0 - fromTop / max(len, 0.01));
    }
    albedo *= 1.0 - run * 0.42 * uSpan.z;
    float band = 0.12 + uSpan.w * 0.18 + sl_vnoise(vec3(hx * 1.7, 0.0, 5.1)) * 0.06 + sl_vnoise(vec3(hx * 9.0, 0.0, 3.3)) * 0.02;
    float aw2 = fwidth(p.y) + 1e-4;
    albedo *= mix(1.0, 0.76, (1.0 - smoothstep(band - aw2, band + aw2, p.y - uSpan.x)) * uSpan.z);
  }
`;

/** 外の床の水たまり（上向きの面）: uPud = (大きさ 1/m, しきい値, 映る強さ) */
const PUDDLE_A = /* glsl */ `
  if (n.y > 0.9) {
    // ねじったノイズは重いので、2 つの値ノイズでずらした 3 段の fbm（形は同じく、ちぎれた縁の不定形）
    vec2 pq = p.xz * uPud.x;
    pq += vec2(sl_vnoise(vec3(pq * 0.7, 3.1)), sl_vnoise(vec3(pq * 0.7, 9.4))) * 1.1;
    // 縁をちぎる細かいノイズ（ホームの水たまりと同じ: 9 /m と 31 /m）
    float wn = sl_fbm(vec3(pq, 3.7), 3) * 0.8 + sl_vnoise(vec3(p.xz * 9.0, 1.1)) * 0.06 + sl_vnoise(vec3(p.xz * 31.0, 4.1)) * 0.03;
    float ww = fwidth(wn) * 0.8 + 0.002;
    pudM = smoothstep(uPud.y - ww, uPud.y + ww, wn);
    // 補修の跡（4.3 m の升目に、ときどき四角い暗い継ぎ当て。縁は 1 画素ぼかす）
    {
      vec2 cl = floor(p.xz / 4.3);
      if (sl_hash12(cl) > 0.66) {
        vec2 f = fract(p.xz / 4.3);
        vec2 lo = vec2(0.08 + 0.3 * sl_hash12(cl + 7.1), 0.08 + 0.3 * sl_hash12(cl + 3.3));
        vec2 hi = lo + vec2(0.22 + 0.32 * sl_hash12(cl + 1.9), 0.18 + 0.38 * sl_hash12(cl + 5.7));
        vec2 aw = fwidth(f) + 1e-4;
        vec2 e = smoothstep(lo - aw, lo + aw, f) * (1.0 - smoothstep(hi - aw, hi + aw, f));
        float patchM = e.x * e.y;
        albedo *= mix(1.0, 0.8, patchM);
        // 継ぎ当ての縁の細い線（目地の砂）
        vec2 ed = min(abs(f - lo), abs(f - hi)) / aw;
        albedo *= mix(1.0, 1.25, (1.0 - smoothstep(0.5, 1.5, min(ed.x, ed.y))) * step(0.01, patchM + 0.02) * 0.6);
      }
    }
    // 水たまりのまわりは濡れて暗い（縁はちぎれる）
    float wm = smoothstep(uPud.y - 0.1 - ww, uPud.y - 0.1 + ww, wn);
    albedo *= mix(1.0, 0.72, wm) * mix(1.0, 0.85, pudM);
  }
`;
const PUDDLE_F = /* glsl */ `
  if (pudM > 0.0) {
    vec3 vdp = normalize(p - cameraPosition);
    vec3 rp = reflect(vdp, vec3(0.0, 1.0, 0.0));
    float frp = 0.35 + 0.65 * pow(1.0 - clamp(-vdp.y, 0.0, 1.0), 3.0);
    // 映るのは霧の空。濡れた路面より少しだけ明るい（白く飛ばない）
    col = mix(col, st_fogColor(rp) * 0.62, pudM * frp * uPud.z);
  }
`;

/** 波板（トタン）: 7.6 cm おきの筋（遠くでは消す）と、縦の面の錆の筋 */
const CORR = /* glsl */ `
  {
    vec3 a = abs(n);
    float u = a.y > 0.6 ? p.x : (a.x > a.z ? p.z : p.x);
    float k = 1.0 - smoothstep(0.015, 0.05, fwidth(u));
    albedo *= mix(1.0, 0.8 + 0.34 * (0.5 + 0.5 * sin(u * 82.0)), k * 0.8);
    if (a.y < 0.5) {
      float st = smoothstep(0.2, 0.7, sl_vnoise(vec3(u * 1.6, p.y * 0.3, 4.2)) * 0.5 + 0.5) * smoothstep(0.0, 0.8, sl_vnoise(vec3(u * 7.0, p.y * 0.9, 1.3)) * 0.5 + 0.5);
      albedo *= mix(vec3(1.0), vec3(0.82, 0.74, 0.66), st * 0.6);
    }
  }
`;

/** 天井の板の継ぎ目（0.9 m 角の升目の暗い線）と、板ごとの色のむら */
const CEIL_GRID = /* glsl */ `
  if (n.y < -0.5) {
    vec2 uv = p.xz / 0.91;
    vec2 g = abs(fract(uv) - 0.5) * 0.91;
    vec2 w = fwidth(p.xz) * 0.8 + 0.003;
    float line = 1.0 - smoothstep(0.0, w.x, g.x) * smoothstep(0.0, w.y, g.y);
    albedo *= mix(1.0, 0.6, line) * (0.92 + 0.14 * sl_hash12(floor(uv)));
  }
`;

/** 元の版の D の座標の点を、回した D の座標へ（x, z）。元の -X（先端の向き）→ +Z（南） */
export function dToNew(x: number, z: number): [number, number] {
  return [D.x + (z - D_OLD.zc), D.z1 - (x - D_OLD.xEnd)];
}

/** 野原の小川（元の版の station-0 の参考画像から床へ投げ返した位置）を、回した D に合わせて置き直す（D の南の野原） */
const STREAM_OLD: [number, number][] = [
  [-480, 200], [-383, 131], [-306, 66], [-258, 29], [-212, 5], [-187, -3], [-152, -6], [-119, -9.5], [-99, -11.4], [-86, -12], [-70, -12.6],
];

/**
 * 駅の材質（元の版の色をそのまま使い、建築版で足した物の材質を加える）。
 * 色は参考画像から拾った色・元の版の値。駅舎・地下道・広場の色は参考画像の色の表（暗い青緑・灰緑・ミント）から選ぶ
 */
export function makeMats() {
  const M = (o: StationMatOptions): THREE.ShaderMaterial => stationMat(o);
  return {
    concrete: M({ color: '#1a2e40', mottle: [0.12, 1.3] }),
    coping: M({ color: '#2e4e54' }),
    roof: M({ color: '#3a6878' }),
    beam: M({ color: '#3e6c7c' }),
    steel: M({ color: '#3d6e7c' }),
    pedestal: M({ color: '#3f6a74', mottle: [0.1, 2] }),
    bench: M({ color: '#1a6878', emissive: '#04222c', emissiveIntensity: 1, side: THREE.DoubleSide, sheen: 0.3 }),
    frameD: M({ color: '#2a6670', emissive: '#0a3c44', emissiveIntensity: 1 }),
    benchB: M({ color: '#123238', sheen: 0.2 }),
    benchT: M({ color: '#1e4450', side: THREE.DoubleSide, sheen: 0.6 }),
    benchD: M({ color: '#2a6670', emissive: '#0a3c44', emissiveIntensity: 1, side: THREE.DoubleSide, sheen: 0.3 }),
    housing: M({ color: '#3a5a5e' }),
    tube: M({ color: '#000000', unlit: true, fragAlbedo: '  emis = uStTubeCol * (0.65 + 0.45 * abs(dot(n, normalize(cameraPosition - p))));' }),
    sign: M({ color: '#1d3a40' }),
    rail: M({ color: '#24383c' }),
    railTop: M({ color: '#a8c8c6', gain: 1.0 }),
    railRust: M({ color: '#4a4a40', mottle: [0.3, 4] }),
    clip: M({ color: '#3a5c60', gain: 1.0 }),
    sleeper: M({ color: '#25393a', mottle: [0.15, 3] }),
    ballast: M({ color: '#0e1a20', mottle: [0.35, 6] }),
    // A の両側の線路（大屋根の下でも明るい灰色の砂利）
    ballastA: M({ color: '#4a8088', mottle: [0.35, 6], fragAlbedo: '  albedo *= mix(1.0, 0.4, smoothstep(4.0, 14.0, p.z));' }),
    field: fieldMat({
      color: '#8ab6ae',
      dark: '#4c766a',
      light: '#b4d8b8',
      stream: STREAM_OLD.map(([x, z]) => dToNew(x, z)),
      keep: 2.0,
    }),
    far: M({ color: '#3d5e5c' }),
    // 地平線の影（霧を薄く掛ける。薄さは場所ごと）
    farHaze: M({ color: '#2a5a5c', farFog: true }),
    booth: M({ color: '#1e4a50' }),
    glass: M({ color: '#5a9890', gain: 1.0 }),
    wire: M({ color: '#2a4a50' }),
    // D の柱: 逆光の暗い柱。高さで明るさが変わる（屋根の下と床の近くが暗い）
    steelD: M({ color: '#6a9aa0', gain: 5.5, fragAlbedo: PILLAR_GRAD }),
    pedestalD: M({ color: '#3a6a7a', gain: 5.0, fragAlbedo: PILLAR_GRAD }),
    roofB: M({ color: '#3a96a0' }),
    columnB: M({ color: '#1a4a54', fragAlbedo: '  albedo *= mix(0.6, 1.0, smoothstep(0.5, 2.0, p.y)) * mix(1.0, 0.7, smoothstep(2.4, 3.4, p.y));' }),
    columnBase: M({ color: '#164a50' }),
    columnEdge: M({ color: '#3a7a80' }),
    bcFunnel: M({ color: '#24646c' }),
    shelterDark: M({ color: '#2a5a60' }),
    lampBox: M({ color: '#000000', unlit: true, emissive: '#f4f0c0', emissiveIntensity: 1.3 }),
    beamB: M({ color: '#2a6466' }),
    roofT: M({ color: '#2c4c70' }),
    columnT: M({ color: '#3a7488', emissive: '#16505e', emissiveIntensity: 1, sheen: 0.3 }),
    endT: M({ color: '#1a3848', fogMul: 0.55 }),
    shedCol: M({ color: '#24505a' }),
    shedColL: M({ color: '#3a7480', emissive: '#103a42', emissiveIntensity: 1 }),
    lattice: M({ color: '#4a8088', emissive: '#14424a', emissiveIntensity: 1 }),
    underDark: M({ color: '#1c3646' }),
    bcUnderDark: M({ color: '#2a7078' }),
    ticket: M({ color: '#1c4a4e' }),
    ticketScreen: M({ color: '#000000', unlit: true, emissive: '#9ad0c8', emissiveIntensity: 0.8 }),
    doorFrame: M({ color: '#4a8a84' }),
    doorLeaf: M({ color: '#1a4c50' }),
    fasciaN: M({ color: '#8ab4a0', emissive: '#2a4a40', emissiveIntensity: 1 }),
    bcValance: M({ color: '#2a6a72' }),
    bcUnderLite: M({ color: '#4a9aa0' }),
    underLite: M({ color: '#3a6a7a' }),
    hookT: M({ color: '#5aa0a8', emissive: '#0a2a30', emissiveIntensity: 1 }),
    beamT: M({ color: '#2a4a68' }),
    steelT: M({ color: '#2a4c58' }),
    housingT: M({ color: '#3a5a5e' }),
    tubeT: M({ color: '#000000', unlit: true, fragAlbedo: '  emis = uStTubeCol;' }),
    board: M({ color: '#b6d6d0' }),
    frontS: M({ color: '#2a5a64', emissive: '#16383e', emissiveIntensity: 1 }),
    frontD: M({ color: '#2a6a74', emissive: '#28626a', emissiveIntensity: 1 }),
    signLight: M({ color: '#94b4aa', unlit: true }),
    signal: M({ color: '#c06050', unlit: true }),
    signalG: M({ color: '#60c0a0', unlit: true }),
    // ---------- 建築版で足した物 ----------
    // 駅舎: 外壁（灰緑のモルタル）・腰壁・屋根（濃い青緑の瓦棒）・窓枠・建具
    wallExt: M({ color: '#5a8a88', mottle: [0.08, 1.5] }),
    wallBase: M({ color: '#2a4a50', mottle: [0.1, 2] }),
    roofTile: M({ color: '#1e3a48', mottle: [0.08, 3] }),
    sash: M({ color: '#2a4a4e' }),
    // 透ける窓ガラス（中からは外の霧、外からは中の灯りが見える。浅い角度で霧の空を映す）
    winGlass: M({ color: '#5a9890', transparent: true, opacity: 0.2, depthWrite: false, sheen: 0.9, side: THREE.DoubleSide }),
    // 窓（中の明かり。夜ではないので弱い）
    winLit: M({ color: '#000000', unlit: true, emissive: '#8ab8a8', emissiveIntensity: 0.55 }),
    // 室内（駅舎・地下道）: 天井の蛍光灯と窓の光だまりを受ける（pool）。屋根の下の一様な灯りは弱くして、
    // 光だまりの外は暗い（参考画像の上屋の下の暗さと、明るい開口の対比）
    // 壁: 上は明るい灰緑の塗り（天井の継ぎ目からの水の筋・床から上がる湿りの帯）、腰は濃い色
    wallInt: M({ color: '#94b4aa', mottle: [0.05, 2], fogMul: 0.18, pool: true, fragHead: 'uniform vec4 uSpan;', fragAlbedo: WEAR, uniforms: { uSpan: { value: new THREE.Vector4(0, 3.1, 0.7, 0) } } }),
    floorInt: M({ color: '#2c4648', mottle: [0.08, 1.5], fogMul: 0.18, pool: true, wet: [0.35, 0.8, 0.35], fragAlbedo: TILE_J.replace(/0\.15/g, '0.3').replace('0.72', '0.8') }),
    ceilInt: M({ color: '#2c4244', fogMul: 0.18, pool: true, fragAlbedo: CEIL_GRID }),
    // 地下道: 白いタイルの壁（1 枚ずつの色のむら・水の筋・湿りの帯）・濡れた床・天井（霧は弱く）
    tileTun: M({ color: '#86acae', fogMul: 0.15, pool: true, fragHead: 'uniform vec4 uSpan;', fragAlbedo: TILE_J + WEAR, uniforms: { uSpan: { value: new THREE.Vector4(-4.25, -1.85, 1.0, 1) } } }),
    floorTun: M({ color: '#243c3e', mottle: [0.12, 1.2], fogMul: 0.15, pool: true, wet: [0.4, 1.0, 0.45] }),
    ceilTun: M({ color: '#2c4040', fogMul: 0.15, pool: true, fragAlbedo: CEIL_GRID }),
    trimTun: M({ color: '#2a4a50', fogMul: 0.15, pool: true }),
    // 室内の物（光だまりを受ける版）: 腰壁・鋼・木・建具・ベンチ・券売機・掲示物・階段
    wallBaseIn: M({ color: '#2a4a50', fogMul: 0.18, pool: true }),
    steelIn: M({ color: '#3d6e7c', fogMul: 0.18, pool: true }),
    woodIn: M({ color: '#2e3a36', fogMul: 0.18, pool: true }),
    sashIn: M({ color: '#2a4a4e', fogMul: 0.18, pool: true }),
    doorIn: M({ color: '#1a4c50', fogMul: 0.18, pool: true }),
    benchIn: M({ color: '#1e4450', side: THREE.DoubleSide, fogMul: 0.18, pool: true }),
    ticketIn: M({ color: '#1c4a4e', fogMul: 0.18, pool: true }),
    vendingIn: M({ color: '#b8ccc8', fogMul: 0.18, pool: true }),
    lockerIn: M({ color: '#7e9e9a', fogMul: 0.18, pool: true }),
    boardIn: M({ color: '#b6d6d0', fogMul: 0.18, pool: true }),
    blackIn: M({ color: '#141e20', fogMul: 0.18, pool: true }),
    housingIn: M({ color: '#3a5a5e', fogMul: 0.18, pool: true }),
    concreteIn: M({ color: '#2a4048', fogMul: 0.15, pool: true }),
    greenIn: M({ color: '#2a6a50', fogMul: 0.18, pool: true }),
    signLitIn: M({ color: '#ffffff', map: signAtlas().texture, gain: 0.95, fogMul: 0.18, pool: true }),
    // 内照式の広告（明るく光る板）
    signBright: M({ color: '#ffffff', map: signAtlas().texture, unlit: true, fogMul: 0.15, gain: 1.0, emissive: '#1a2a28' }),
    // 室内の光る板（発車の案内・内照式の広告）
    signGlowIn: M({ color: '#c8d8d4', map: signAtlas().texture, unlit: true, fogMul: 0.18 }),
    // 黄色の点字ブロック（線状 = 進む向きの筋、点状 = 点）。筋の向きは長い辺の向き（x か z）
    tactileX: M({ color: '#a8a060', fogMul: 0.18, pool: true, fragAlbedo: '  albedo *= mix(0.72, 1.0, smoothstep(0.18, 0.3, abs(fract(p.z / 0.075) - 0.5))) * mix(0.8, 1.0, step(0.012, abs(fract(p.x / 0.3 + 0.5) - 0.5) * 0.3));' }),
    tactileZ: M({ color: '#a8a060', fogMul: 0.18, pool: true, fragAlbedo: '  albedo *= mix(0.72, 1.0, smoothstep(0.18, 0.3, abs(fract(p.x / 0.075) - 0.5))) * mix(0.8, 1.0, step(0.012, abs(fract(p.z / 0.3 + 0.5) - 0.5) * 0.3));' }),
    tactileDot: M({ color: '#a8a060', fogMul: 0.18, pool: true, fragAlbedo: '  albedo *= mix(0.75, 1.05, smoothstep(0.32, 0.22, length(fract(p.xz / 0.075) - 0.5)));' }),
    // ホームの壁（0・7 番線・本線側の面。笠石の下からの水の筋と、根元の湿りの帯）。B・C は参考画像のまま concrete
    concreteW: M({ color: '#1a2e40', mottle: [0.12, 1.3], fragHead: 'uniform vec4 uSpan;', fragAlbedo: WEAR, uniforms: { uSpan: { value: new THREE.Vector4(-1.15, 0, 0.9, 0.6) } } }),
    concreteDark: M({ color: '#0f1e28' }),
    // 信号の機器箱（灰緑の鋼板）・ビニールハウスの膜・稲の束
    cabinet: M({ color: '#4a6a6c' }),
    film: M({ color: '#a8d4cc', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, sheen: 0.5 }),
    straw: M({ color: '#6a6c4c', side: THREE.DoubleSide }),
    // 野原の木（模様なしの木の色。升目ごとに頂点色にまとめる）
    woodP: M({ color: '#3a4a44' }),
    // 屋外の点字ブロック（歩道）
    tactileXo: M({ color: '#a8a060', fragAlbedo: '  albedo *= mix(0.72, 1.0, smoothstep(0.18, 0.3, abs(fract(p.z / 0.075) - 0.5))) * mix(0.8, 1.0, step(0.012, abs(fract(p.x / 0.3 + 0.5) - 0.5) * 0.3));' }),
    tactileZo: M({ color: '#a8a060', fragAlbedo: '  albedo *= mix(0.72, 1.0, smoothstep(0.18, 0.3, abs(fract(p.x / 0.075) - 0.5))) * mix(0.8, 1.0, step(0.012, abs(fract(p.z / 0.3 + 0.5) - 0.5) * 0.3));' }),
    tactileDoto: M({ color: '#a8a060', fragAlbedo: '  albedo *= mix(0.75, 1.05, smoothstep(0.32, 0.22, length(fract(p.xz / 0.075) - 0.5)));' }),
    // 赤い箱（消火栓）・赤い灯
    redIn: M({ color: '#8a3a34', fogMul: 0.18, pool: true }),
    // 駅舎の外壁（軒からの雨の筋・地面から上がる湿りの帯）
    wallExtW: M({ color: '#5a8a88', mottle: [0.08, 1.5], fragHead: 'uniform vec4 uSpan;', fragAlbedo: WEAR, uniforms: { uSpan: { value: new THREE.Vector4(0, 3.6, 0.9, 0.3) } } }),
    // 道（アスファルト）・砂利・縁石・白線
    // 濡れたアスファルト（浅い角度で霧の空を映す）
    // 水たまり: ちぎれた縁の不定形（ねじったノイズのしきい値）。水たまりは鏡のように霧の空を映す（参考画像のホームの水たまりと同じ絵）
    asphalt: M({ color: '#22363a', mottle: [0.14, 0.7], sheen: 0.5, fragAlbedo: PUDDLE_A, fragFinal: PUDDLE_F, uniforms: { uPud: { value: new THREE.Vector3(0.7, 0.22, 0.5) } }, fragHead: 'uniform vec3 uPud;\nfloat pudM = 0.0;' }),
    gravel: M({ color: '#3a5050', mottle: [0.3, 5] }),
    curb: M({ color: '#5a7a78' }),
    paint: M({ color: '#a8c8c0' }),
    yellowPaint: M({ color: '#a8a060' }),
    // 柵（金網・パイプ）・手すり
    fence: M({ color: '#3a5a5c' }),
    // 木（電柱・小屋の板）・トタン・錆
    wood: M({ color: '#3a4a44', mottle: [0.2, 3] }),
    // トタン（波板の筋と、錆の筋）
    tin: M({ color: '#3a5a60', mottle: [0.15, 2], fragAlbedo: CORR }),
    rust: M({ color: '#4a4038', mottle: [0.25, 3], fragAlbedo: CORR }),
    // 茂み（形の頂点色で、根元は暗く上は霧の空を受けて明るい）
    bush: M({ color: '#4a7464', vertexColors: true, side: THREE.DoubleSide }),
    // 畦（草の生えた低い土手）
    ridge: M({ color: '#4e7a6a' }),
    poleConc: M({ color: '#5a7470' }),
    // 看板（白地）・赤・黄
    signWhite: M({ color: '#c8dcd4' }),
    red: M({ color: '#8a3a34' }),
    redLit: M({ color: '#c04838', unlit: true }),
    yellow: M({ color: '#b0a050' }),
    black: M({ color: '#141e20' }),
    vending: M({ color: '#b8ccc8' }),
    vendingLit: M({ color: '#000000', unlit: true, emissive: '#c8e8e0', emissiveIntensity: 0.7 }),
    green: M({ color: '#2a6a50' }),
    water: M({ color: '#3a6a6c', sheen: 1.0 }),
    hedge: M({ color: '#1e3e36', side: THREE.DoubleSide }),
    grass: M({ color: '#4a7a62', side: THREE.DoubleSide }),
    // 掲示物（1 枚にまとめた絵）: 照らされる板・光る板・地下道の中（霧を弱く）
    signLit: M({ color: '#ffffff', map: signAtlas().texture, gain: 0.95 }),
    signUnlit: M({ color: '#ffffff', map: signAtlas().texture, unlit: true }),
    // 内照式の看板（暗い所で光る。明るさは控えめ）
    signGlow: M({ color: '#b8c8c4', map: signAtlas().texture, unlit: true }),
    signLitTun: M({ color: '#ffffff', map: signAtlas().texture, gain: 0.85, fogMul: 0.25 }),
    signUnlitTun: M({ color: '#ffffff', map: signAtlas().texture, unlit: true, fogMul: 0.25 }),
    // station-2 の手前の草は逆光の暗い影（光を当てない暗い色に霧だけ掛ける）
    grassDark: M({ color: '#0c2a2e', unlit: true, side: THREE.DoubleSide }),
  };
}

export type Mats = ReturnType<typeof makeMats>;
