import * as THREE from 'three';
import type { MatId } from '../../generators/layout';
import type { Kit } from './ApplianceGeometry';
import type { ExhibitKind } from '../../generators/exhibits';

export { isExhibitKind } from '../../generators/exhibits';

/**
 * 日用品博物館（R12）の展示品のコード生成（見た目専用。ガラスケースの中に置くので当たり判定は無い）。
 * ApplianceGeometry の Kit（材質ごとに結合）で組み、InstanceSpec.shape 'exhibit' + variant（品目）として並べる。
 *
 * 局所系: 原点 = 底面の中心、正面 = +z、単位 m（実物の寸法）。回転体（Lathe）・押し出し（profile / Extrude）・管（Tube）で
 * 箱の寄せ集めに見えない輪郭にする。三角形は 1 品 400〜2,500 程度（ケースは部屋に 20 前後）。
 */
export function buildExhibit(K: Kit, kind: ExhibitKind): void {
  switch (kind) {
    case 'kettle': kettle(K); break;
    case 'phone': phone(K); break;
    case 'radio': radio(K); break;
    case 'bucket': bucket(K); break;
    case 'chair': chair(K); break;
    case 'fan': fan(K); break;
    case 'riceCooker': riceCooker(K); break;
    case 'iron': iron(K); break;
    case 'lamp': lamp(K); break;
    case 'clock': clock(K); break;
    case 'thermos': thermos(K); break;
  }
}

// ---------------------------------------------------------------- 品目

/** 電気ケトル: 台座・膨らんだ胴（回転体）・蓋とつまみ・背面の取っ手・前へ上向きの注ぎ口 */
function kettle(K: Kit): void {
  K.cyl(0.095, 0.02, 'y', [0, 0.01, 0], 'metalDark', 24);
  K.lathe([[0, 0.02], [0.084, 0.02], [0.09, 0.035], [0.091, 0.1], [0.088, 0.15], [0.078, 0.195], [0.062, 0.212], [0, 0.212]], 'stainless', 28);
  K.lathe([[0, 0.212], [0.062, 0.212], [0.052, 0.224], [0.025, 0.23], [0, 0.231]], 'metalDark', 20);
  K.sphere(0.012, [0, 0.238, 0], 'metalDark', 8);
  K.tube([[0, 0.19, -0.075], [0, 0.222, -0.125], [0, 0.17, -0.152], [0, 0.08, -0.138], [0, 0.045, -0.09]], 0.012, 'metalDark', 20, 6);
  // 注ぎ口: 先細りの筒を前へ 54° 起こす（rotateX(+θ) で +y 軸が前上へ倒れる）
  K.geom(new THREE.CylinderGeometry(0.011, 0.02, 0.075, 12, 1, true), 'stainless', (g) => { g.rotateX(0.95); g.translate(0, 0.185, 0.1); });
  // 水位窓
  K.box(-0.012, 0.012, 0.05, 0.16, 0.084, 0.092, 'screenDark');
}

/** 黒電話（赤）: 台形の胴（側面の押し出し）・受話器（握り + 耳 / 口の受け）・傾いた前面のダイヤル（指穴 10）・巻いたコード */
function phone(K: Kit): void {
  const body: MatId = 'plasticRed';
  K.profile([[-0.11, 0], [0.11, 0], [0.105, 0.03], [0.065, 0.105], [-0.07, 0.105], [-0.105, 0.05]], 0.21, body);
  K.box(-0.1, 0.1, 0, 0.006, -0.1, 0.1, 'rubber');
  K.box(-0.085, -0.058, 0.105, 0.124, -0.035, 0.012, body, 0.004);
  K.box(0.058, 0.085, 0.105, 0.124, -0.035, 0.012, body, 0.004);
  // 受話器
  K.cyl(0.014, 0.15, 'x', [0, 0.143, -0.012], body, 10);
  K.cyl(0.028, 0.03, 'y', [-0.085, 0.13, -0.012], body, 16);
  K.cyl(0.028, 0.03, 'y', [0.085, 0.13, -0.012], body, 16);
  // ダイヤル: 前面の斜面（(z 0.105, y 0.03) → (0.065, 0.105)）の中央。法線は上へ 28°
  const tilt = Math.atan2(0.04, 0.075);
  const ny = Math.sin(tilt), nz = Math.cos(tilt);
  const onFace = (off: number) => (g: THREE.BufferGeometry) => { g.rotateX(-tilt); g.translate(0, 0.0675 + ny * off, 0.085 + nz * off); };
  K.geom(new THREE.CircleGeometry(0.036, 24), 'whiteFabric', onFace(0.002));
  K.geom(new THREE.TorusGeometry(0.03, 0.004, 4, 24), 'metal', onFace(0.004));
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 3 + (i / 10) * Math.PI * 1.6;
    K.geom(new THREE.CircleGeometry(0.0055, 8), 'metalDark', (g) => { g.translate(Math.cos(a) * 0.024, Math.sin(a) * 0.024, 0); onFace(0.0045)(g); });
  }
  K.geom(new THREE.CircleGeometry(0.011, 12), 'plasticRed', onFace(0.0045));
  // 巻いたコード: 受話器の左端から胴の左側面へ（螺旋 11 巻き）
  const A = [-0.1, 0.118, -0.02], B = [-0.118, 0.02, 0.04];
  const pts: number[][] = [];
  for (let i = 0; i <= 88; i++) {
    const t = i / 88, a = t * Math.PI * 2 * 11;
    pts.push([A[0] + (B[0] - A[0]) * t + Math.cos(a) * 0.006, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t + Math.sin(a) * 0.006]);
  }
  K.tube(pts, 0.0028, 'metalDark', 88, 4);
}

/** トランジスタラジオ: 面取りの胴（アイボリー）・金の帯・スピーカー格子（横のスリット）・周波数窓と赤い針・つまみ・革紐・斜めのアンテナ */
function radio(K: Kit): void {
  K.box(-0.12, 0.12, 0, 0.15, -0.03, 0.03, 'paintWhite', 0.012);
  K.box(-0.105, 0.03, 0.018, 0.128, 0.029, 0.033, 'shelfMetal');
  for (let i = 0; i < 7; i++) K.box(-0.098, 0.023, 0.027 + i * 0.014, 0.033 + i * 0.014, 0.033, 0.035, 'metalDark');
  K.box(-0.12, 0.12, 0.134, 0.14, 0.029, 0.034, 'goldTrim');
  K.box(0.045, 0.105, 0.075, 0.125, 0.029, 0.033, 'whiteFabric');
  for (let i = 0; i < 6; i++) K.box(0.05 + i * 0.01, 0.052 + i * 0.01, 0.105, 0.12, 0.033, 0.034, 'metalDark');
  K.box(0.07, 0.073, 0.078, 0.122, 0.033, 0.036, 'plasticRed');
  K.cyl(0.017, 0.014, 'z', [0.075, 0.042, 0.037], 'goldTrim', 16);
  K.cyl(0.009, 0.01, 'z', [0.075, 0.042, 0.046], 'metalDark', 10);
  K.tube([[-0.1, 0.14, 0], [-0.085, 0.195, 0], [0, 0.215, 0], [0.085, 0.195, 0], [0.1, 0.14, 0]], 0.006, 'rubber', 20, 5);
  K.geom(new THREE.CylinderGeometry(0.002, 0.003, 0.32, 6), 'stainless', (g) => { g.rotateZ(-0.35); g.translate(0.1 + 0.055, 0.15 + 0.15, -0.018); });
}

/** バケツ: 肉厚の回転体（外壁・縁・内壁・内底）・巻いた縁・両耳・前へ倒した持ち手と握り */
function bucket(K: Kit): void {
  K.lathe([[0, 0], [0.118, 0], [0.132, 0.14], [0.15, 0.27], [0.142, 0.27], [0.124, 0.14], [0.111, 0.012], [0, 0.012]], 'plasticBlue', 32);
  K.hring(0.148, 0.007, [0, 0.27, 0], 'plasticBlue', 32);
  K.hring(0.137, 0.004, [0, 0.19, 0], 'plasticBlue', 32);
  for (const sx of [-1, 1]) K.box(sx > 0 ? 0.144 : -0.158, sx > 0 ? 0.158 : -0.144, 0.225, 0.262, -0.012, 0.012, 'plasticBlue');
  K.tube([[-0.153, 0.245, 0], [-0.13, 0.26, 0.09], [-0.06, 0.266, 0.155], [0, 0.267, 0.166], [0.06, 0.266, 0.155], [0.13, 0.26, 0.09], [0.153, 0.245, 0]], 0.0035, 'stainless', 32, 5);
  K.cyl(0.009, 0.06, 'x', [0, 0.267, 0.166], 'metalDark', 8);
}

/** 中心線 center（[z, y]）を厚み t の閉じた輪郭にする（反時計回り） */
function shell(center: [number, number][], t: number): [number, number][] {
  const up: [number, number][] = [], dn: [number, number][] = [];
  for (let i = 0; i < center.length; i++) {
    const a = center[Math.max(0, i - 1)], b = center[Math.min(center.length - 1, i + 1)];
    const dz = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dz, dy) || 1;
    const nz = -dy / l, ny = dz / l; // 進行方向の左
    up.push([center[i][0] + nz * t / 2, center[i][1] + ny * t / 2]);
    dn.push([center[i][0] - nz * t / 2, center[i][1] - ny * t / 2]);
  }
  const ring = [...dn, ...up.reverse()];
  let area = 0;
  for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; area += p[0] * q[1] - q[0] * p[1]; }
  return area >= 0 ? ring : ring.reverse();
}

/** 成形合板風の樹脂椅子: 座面から背へ一体の曲面（中心線を厚み 1.6 cm で押し出す）+ ステンレスの 4 本脚と横桟 */
function chair(K: Kit): void {
  const line: [number, number][] = [[0.245, 0.405], [0.238, 0.43], [0.2, 0.448], [0.1, 0.452], [0, 0.448], [-0.12, 0.45], [-0.2, 0.465], [-0.235, 0.52], [-0.25, 0.62], [-0.262, 0.72], [-0.268, 0.815]];
  K.profile(shell(line, 0.016), 0.44, 'plasticYellow');
  for (const sx of [-1, 1]) {
    K.tube([[sx * 0.2, 0, 0.23], [sx * 0.172, 0.44, 0.16]], 0.011, 'stainless', 1, 8);
    K.tube([[sx * 0.2, 0, -0.24], [sx * 0.172, 0.44, -0.15]], 0.011, 'stainless', 1, 8);
    K.tube([[sx * 0.197, 0.12, 0.212], [sx * 0.195, 0.12, -0.215]], 0.007, 'stainless', 1, 6);
    K.cyl(0.013, 0.012, 'y', [sx * 0.2, 0.006, 0.23], 'rubber', 8);
    K.cyl(0.013, 0.012, 'y', [sx * 0.2, 0.006, -0.24], 'rubber', 8);
  }
}

/** 卓上扇風機: 台座・支柱・モーター（z 軸の回転体）・ガードの前後の輪と帯と放射の針金・羽根 3 枚（裏表）・中央の青い銘板 */
function fan(K: Kit): void {
  K.lathe([[0, 0], [0.12, 0], [0.12, 0.012], [0.1, 0.035], [0, 0.04]], 'paintWhite', 28);
  K.cyl(0.03, 0.02, 'y', [0.06, 0.045, 0.05], 'plasticBlue', 12);
  K.cyl(0.014, 0.25, 'y', [0, 0.16, -0.025], 'paintWhite', 12);
  const cy = 0.31;
  K.geom(new THREE.LatheGeometry([[0, -0.06], [0.04, -0.055], [0.055, -0.02], [0.05, 0.02], [0, 0.03]].map(([r, y]) => new THREE.Vector2(r, y)), 20), 'paintWhite', (g) => { g.rotateX(Math.PI / 2); g.translate(0, cy, -0.02); });
  K.cyl(0.15, 0.04, 'z', [0, cy, 0.055], 'stainless', 32, true);
  K.ring(0.15, 0.004, [0, cy, 0.075], 'stainless');
  K.ring(0.15, 0.004, [0, cy, 0.035], 'stainless');
  K.ring(0.095, 0.003, [0, cy, 0.079], 'stainless');
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    K.geom(new THREE.BoxGeometry(0.003, 0.15, 0.003), 'stainless', (g) => { g.translate(0, 0.075, 0); g.rotateZ(a); g.translate(0, cy, 0.079); });
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3;
    for (const back of [false, true]) {
      K.geom(new THREE.CircleGeometry(0.06, 14), 'plasticBlue', (g) => {
        g.scale(0.75, 1, 1);
        if (back) g.rotateY(Math.PI);
        g.translate(0, 0.07, 0);
        g.rotateZ(a);
        g.translate(0, cy, 0.056);
      });
    }
  }
  K.cyl(0.028, 0.03, 'z', [0, cy, 0.055], 'plasticBlue', 16);
  K.disc(0.026, [0, cy, 0.081], 'plasticBlue', 18);
}

/** 炊飯器: 丸い胴と蓋（回転体）・継ぎ目の帯・持ち手・前面の操作部（小さな液晶と赤いボタン）・蒸気口 */
function riceCooker(K: Kit): void {
  K.lathe([[0, 0], [0.115, 0], [0.135, 0.02], [0.14, 0.12], [0.132, 0.15], [0, 0.15]], 'paintWhite', 32);
  K.lathe([[0, 0.15], [0.134, 0.15], [0.125, 0.185], [0.08, 0.212], [0, 0.218]], 'paintWhite', 32);
  K.hring(0.137, 0.005, [0, 0.15, 0], 'metal', 32);
  K.tube([[-0.105, 0.18, 0], [-0.075, 0.255, 0], [0, 0.272, 0], [0.075, 0.255, 0], [0.105, 0.18, 0]], 0.008, 'metalDark', 20, 6);
  K.box(-0.06, 0.06, 0.045, 0.115, 0.118, 0.142, 'metalDark', 0.006);
  K.box(-0.046, -0.004, 0.068, 0.098, 0.142, 0.145, 'screenLcd');
  K.cyl(0.012, 0.008, 'z', [0.03, 0.082, 0.145], 'plasticRed', 12);
  K.cyl(0.018, 0.006, 'y', [0.03, 0.216, -0.03], 'metalDark', 12);
  for (let i = 0; i < 4; i++) K.cyl(0.012, 0.006, 'y', [Math.cos(i * 1.57 + 0.78) * 0.09, 0.003, Math.sin(i * 1.57 + 0.78) * 0.09], 'rubber', 8);
}

/** アイロン: 尖った底板（平面形の押し出し）・一回り小さい青い胴・輪の取っ手・温度つまみ・後ろへ垂れるコード */
function iron(K: Kit): void {
  // 平面形は (x, s)（s = −z。rotateX(−π/2) で押し出しの +z が +y、形の +y が −z になる）。先端は +z
  const plan = (k: number) => {
    const s = new THREE.Shape();
    s.moveTo(-0.06 * k, 0.12 * k);
    s.lineTo(0.06 * k, 0.12 * k);
    s.lineTo(0.06 * k, 0.0);
    s.quadraticCurveTo(0.05 * k, -0.1 * k, 0, -0.13 * k);
    s.quadraticCurveTo(-0.05 * k, -0.1 * k, -0.06 * k, 0.0);
    s.closePath();
    return s;
  };
  const extrude = (k: number, depth: number, y0: number, mat: MatId) => K.geom(new THREE.ExtrudeGeometry(plan(k), { depth, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: 8 }), mat, (g) => { g.rotateX(-Math.PI / 2); g.translate(0, y0, 0); });
  extrude(1, 0.01, 0.004, 'stainless');
  extrude(0.9, 0.04, 0.022, 'plasticBlue');
  K.tube([[0, 0.066, -0.095], [0, 0.128, -0.085], [0, 0.142, -0.01], [0, 0.12, 0.05], [0, 0.068, 0.07]], 0.012, 'plasticBlue', 24, 6);
  K.cyl(0.02, 0.01, 'y', [0, 0.071, -0.03], 'whiteFabric', 16);
  K.box(-0.002, 0.002, 0.076, 0.078, -0.045, -0.03, 'plasticRed');
  K.tube([[0, 0.05, -0.11], [0.01, 0.04, -0.17], [0.04, 0.012, -0.22], [0.07, 0.005, -0.27]], 0.004, 'rubber', 16, 5);
}

/** 卓上ライト: 台座・二本の腕と関節・前へ俯いた笠（外は赤、内は白）・電球 */
function lamp(K: Kit): void {
  K.lathe([[0, 0], [0.08, 0], [0.078, 0.014], [0.05, 0.03], [0, 0.032]], 'metalDark', 24);
  K.cyl(0.012, 0.01, 'z', [0.045, 0.02, 0.055], 'metal', 10);
  K.tube([[0, 0.03, 0], [0, 0.24, -0.07]], 0.008, 'metalDark', 1, 8);
  K.sphere(0.014, [0, 0.24, -0.07], 'metalDark', 8);
  K.tube([[0, 0.24, -0.07], [0, 0.34, 0.07]], 0.007, 'metalDark', 1, 8);
  K.sphere(0.012, [0, 0.34, 0.07], 'metalDark', 8);
  const shadeOut = [[0.022, 0.05], [0.03, 0.04], [0.072, -0.028], [0.08, -0.04]].map(([r, y]) => new THREE.Vector2(r, y));
  const shadeIn = [[0.077, -0.04], [0.069, -0.027], [0.028, 0.038], [0.02, 0.046]].map(([r, y]) => new THREE.Vector2(r, y));
  const place = (g: THREE.BufferGeometry) => { g.rotateX(-0.6); g.translate(0, 0.355, 0.1); };
  K.geom(new THREE.LatheGeometry(shadeOut, 24), 'plasticRed', place);
  K.geom(new THREE.LatheGeometry(shadeIn, 24), 'whiteFabric', place);
  K.geom(new THREE.SphereGeometry(0.02, 10, 8), 'whiteFabric', (g) => { g.translate(0, -0.012, 0); place(g); });
}

/** 目覚まし時計（二つベル）: 胴（z 軸の円柱）・白い文字盤と目盛 12・針・傾いた二つのベルと支柱・ハンマー・持ち手・脚 */
function clock(K: Kit): void {
  const cy = 0.1;
  K.cyl(0.065, 0.045, 'z', [0, cy, 0], 'stainless', 28);
  K.ring(0.062, 0.004, [0, cy, 0.023], 'stainless');
  K.disc(0.058, [0, cy, 0.0226], 'whiteFabric', 28);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    K.geom(new THREE.BoxGeometry(i % 3 === 0 ? 0.006 : 0.003, 0.011, 0.002), 'metalDark', (g) => { g.translate(0, 0.047, 0); g.rotateZ(-a); g.translate(0, cy, 0.0235); });
  }
  K.geom(new THREE.BoxGeometry(0.005, 0.03, 0.002), 'metalDark', (g) => { g.translate(0, 0.015, 0); g.rotateZ(-2.1); g.translate(0, cy, 0.025); });
  K.geom(new THREE.BoxGeometry(0.0035, 0.045, 0.002), 'metalDark', (g) => { g.translate(0, 0.0225, 0); g.rotateZ(-5.2); g.translate(0, cy, 0.026); });
  K.geom(new THREE.BoxGeometry(0.0015, 0.048, 0.002), 'plasticRed', (g) => { g.translate(0, 0.02, 0); g.rotateZ(-0.7); g.translate(0, cy, 0.027); });
  K.cyl(0.004, 0.004, 'z', [0, cy, 0.028], 'metalDark', 8);
  for (const sx of [-1, 1]) {
    K.geom(new THREE.SphereGeometry(0.033, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), 'stainless', (g) => { g.rotateZ(-sx * 0.5); g.translate(sx * 0.044, 0.166, -0.004); });
    K.cyl(0.003, 0.03, 'y', [sx * 0.036, 0.155, -0.004], 'stainless', 6);
    K.geom(new THREE.CylinderGeometry(0.005, 0.008, 0.045, 8), 'stainless', (g) => { g.rotateZ(sx * 0.45); g.translate(sx * 0.042, 0.02, 0); });
  }
  K.box(-0.003, 0.003, 0.162, 0.192, -0.008, 0.0, 'stainless');
  K.tube([[-0.036, 0.16, -0.016], [-0.022, 0.205, -0.016], [0.022, 0.205, -0.016], [0.036, 0.16, -0.016]], 0.004, 'stainless', 14, 5);
}

/** 魔法瓶（押すポット）: 胴（回転体）・金の帯・黒い肩と蓋・押しボタン・注ぎ口・背の取っ手 */
function thermos(K: Kit): void {
  K.lathe([[0, 0], [0.085, 0], [0.09, 0.015], [0.092, 0.12], [0.09, 0.24], [0.076, 0.268], [0, 0.268]], 'paintWhite', 28);
  K.hring(0.091, 0.004, [0, 0.03, 0], 'goldTrim', 28);
  K.hring(0.092, 0.003, [0, 0.2, 0], 'goldTrim', 28);
  K.lathe([[0, 0.266], [0.078, 0.266], [0.07, 0.298], [0.03, 0.31], [0, 0.312]], 'metalDark', 24);
  K.box(-0.03, 0.03, 0.3, 0.322, -0.03, 0.045, 'metalDark', 0.008);
  K.cyl(0.018, 0.012, 'y', [0, 0.328, 0.008], 'plasticRed', 16);
  K.box(-0.015, 0.015, 0.232, 0.27, 0.07, 0.135, 'metalDark', 0.006);
  K.tube([[0, 0.255, -0.085], [0, 0.29, -0.125], [0, 0.22, -0.142], [0, 0.13, -0.128], [0, 0.1, -0.09]], 0.012, 'metalDark', 20, 6);
}
