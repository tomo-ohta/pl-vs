/**
 * 扉開閉の光漏れ（V04 手順 8。担当 P1）。開いた扉の向こうの明るさが床（と開口の両脇の壁）に落ちる表現。
 *
 * 方式: PointLight は増やさない（可視ライト本数は RoomStreamingManager.padVisibleLights で Tier 固定）。
 * - 床: 扉の開口から部屋の内側へ 2.5〜3.5 m 広がる扇形（台形 3×2 分割 = 12 三角形）の加算合成クワッド。
 * - 壁: 開口の両脇の壁面に細い縦の洗い（wall wash。0.4 m 幅 × 開口高 + 0.25 m。2 枚 = 4 三角形）。
 * - 扉 1 枚（片側）= 16 三角形、同時 ≤ MAX_LEAKS 枚。テクスチャは共有の CanvasTexture 1 枚（左半分 扇形 / 右半分 洗い）。
 * - 開閉に合わせて FADE_SEC でフェードイン / アウト。部屋が dispose されたら即座に消す（Game.syncDoorLeaks が built を渡す）。
 * - 色は「その床がある部屋から見て向こう側の部屋」のレア度（Common は向こうの器具色）。Legendary は 2 s の脈動 + 金の火花（Points）、
 *   Mythic は 4 s 周期の色相回転 + 強い脈動。Low Tier は色の扇形だけ（脈動・粒なし。色相回転は uniform だけなので残す）。
 * - Seam 扉（portal.seam）: 左シアン / 右マゼンタの 2 色、開口の縦枡に沿って上へ流れる光（UV を毎フレーム流す）、
 *   時刻 hash のフリッカー、床は逆に暗い（乗算合成 = 光が吸われている印象）。
 *
 * 座標系: 各 Leak は THREE.Group を socket のワールド位置（壁の外面・床）に置き rotation.y = dir·π/2（ローカル +Z が外向き、
 * 部屋の内側は -Z。RoomBuilder の扉枠と同じ）。壁の内面は z = -0.15。
 */
import * as THREE from 'three';
import { hashString } from '../core/rng';
import type { Dir, QualityTier, Rarity, Vec3 } from '../core/types';

/** 'seam' = 開いた Seam 扉 / 'seamClosed' = 閉じた Seam 扉（パネル下端の隙間の帯 + 細い縦の流れ。6 m 以内だけ） */
export type LeakStyle = Rarity | 'seam' | 'seamClosed';

export interface DoorLeakEntry {
  /** `${roomId}/${portalId}` */
  key: string;
  /** 扇形が置かれる部屋（dispose との同期用） */
  roomId: string;
  /** socket のワールド位置（壁面の床位置）と外向き方向 */
  pos: Vec3;
  dir: Dir;
  width: number;
  height: number;
  sill: number;
  style: LeakStyle;
  /** 向こうの部屋の器具色（開いた扉の漏れの色） */
  lightColor: number;
  /** 閉じた通常扉: パネル下端の隙間から僅かに漏れる帯（レア度の色）。開いた扉は向こうの器具色で弱く光る */
  closed?: boolean;
}

export const FADE_SEC = 0.3;
export const MAX_LEAKS = 24;
const SPARKS_PER_LEAK = 16;
const WALL_INNER_Z = -0.15;

/** レア度別の見た目（色・床の加算強度・動き）。docs/lighting-lightmap.md「扉の光漏れ」の表と一致させる */
export const LEAK_STYLE: Record<LeakStyle, { color: number; color2?: number; alpha: number; pulseSec?: number; pulseMin?: number; hueSec?: number; sparks?: boolean; label: string }> = {
  Common: { color: 0xffffff, alpha: 0.14, label: '向こうの器具色に近いごく弱い暖白（palette.lightColor）' },
  Uncommon: { color: 0xe4ffcc, alpha: 0.20, label: 'わずかに黄緑がかった白' },
  Rare: { color: 0x58ecff, alpha: 0.28, label: '澄んだシアン' },
  Epic: { color: 0x8f4dff, color2: 0xff4fd6, alpha: 0.34, pulseSec: 3, pulseMin: 0.9, hueSec: 6, label: '紫〜マゼンタをゆっくり往復（6 s）+ 弱い脈動（3 s）' },
  Legendary: { color: 0xffc548, alpha: 0.42, pulseSec: 2, pulseMin: 0.7, sparks: true, label: '金色。2 s 周期の脈動 + 床の光の中に漂う金の火花' },
  Mythic: { color: 0xffffff, alpha: 0.48, pulseSec: 1.2, pulseMin: 0.55, hueSec: 4, label: '虹色に色相が回る（4 s）+ 強い脈動（1.2 s）' },
  seam: { color: 0x3ae6ff, color2: 0xff3ad2, alpha: 0.42, label: '左シアン / 右マゼンタ。縦枡を上へ流れる光 + 不規則なフリッカー。床は暗い（乗算）' },
  seamClosed: { color: 0x3ae6ff, color2: 0xff3ad2, alpha: 0.14, label: '閉じた Seam 扉: パネル下端の隙間から床へ 0.25 m の 2 色の帯 + 枡に沿う細い流れ（開いた Seam の 1/3）。同じフリッカー。6 m 以内だけ' },
};
/** 閉じた Seam 扉の漏れを置くプレイヤー距離（m。Game.syncDoorLeaks が判定） */
export const SEAM_CLOSED_RANGE = 6;
/** 開いた扉の漏れの加算強度（向こうの器具色で僅かに） */
export const OPEN_LEAK_ALPHA = 0.08;
/** 閉じた通常扉の隙間の帯: LEAK_STYLE.alpha に掛ける倍率 */
export const CLOSED_LEAK_SCALE = 0.5;
/** 閉じた通常扉の漏れを置く距離（m） */
export const CLOSED_RANGE = 8;

const VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vColor;
void main() {
  vUv = uv;
  vColor = color;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uColor;
uniform float uAlpha;
uniform vec2 uOffset;
varying vec2 vUv;
varying vec3 vColor;
void main() {
  float m = texture2D(uMap, vUv + uOffset).a * uAlpha;
  #ifdef MULTIPLY
    // 乗算（three r186 の MultiplyBlending は premultipliedAlpha 前提: out = dst * (src.rgb + 1 - src.a)）。
    // src = (uColor * m, m) で out = dst * mix(1, uColor, m): m = 0 で不変、uColor へ寄せた分だけ床が暗くなる（トーンマップは掛けない = 比率）
    gl_FragColor = vec4(uColor * m, m);
  #else
    gl_FragColor = vec4(uColor * vColor * m, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  #endif
}`;

interface Leak {
  entry: DoorLeakEntry;
  group: THREE.Group;
  /** 加算の扇形 + 洗い（Seam は洗いだけ） */
  main: THREE.Mesh;
  mainMat: THREE.ShaderMaterial;
  /** Seam: 縦枡の流れ / 床の乗算 */
  flow?: THREE.Mesh;
  flowMat?: THREE.ShaderMaterial;
  dark?: THREE.Mesh;
  darkMat?: THREE.ShaderMaterial;
  /** Legendary: 金の火花 */
  sparks?: THREE.Points;
  sparkMat?: THREE.PointsMaterial;
  sparkVel?: Float32Array;
  fade: number;
  target: number;
  seed: number;
  triangles: number;
}

export class DoorLeakSystem {
  private readonly leaks = new Map<string, Leak>();
  private readonly atlas: THREE.CanvasTexture;
  private readonly flowTex: THREE.CanvasTexture;
  private readonly sparkTex: THREE.CanvasTexture;
  private animate = true;
  private sparksOn = true;
  /**
   * 直接描画（composer 無し: low Tier / 設定 off）では加算がトーンマップ + sRGB 変換の後に起きて小さな値が持ち上がる
   * （線形 0.2 → sRGB 0.48）。composer（線形 RT に加算 → まとめてトーンマップ）と見た目を揃えるための倍率
   */
  private alphaScale = 1;
  private readonly tmpColor = new THREE.Color();
  private readonly tmpColor2 = new THREE.Color();

  constructor(private readonly scene: THREE.Scene) {
    this.atlas = makeAtlas();
    this.flowTex = makeFlowTexture();
    this.sparkTex = makeSparkTexture();
  }

  /** 生きている（フェードアウト中を含む）Leak の数 */
  get count(): number { return this.leaks.size; }

  /** 開発用: Leak の一覧（キー → 状態） */
  debugList(): { key: string; style: LeakStyle; fade: number; alpha: number; triangles: number }[] {
    return [...this.leaks.values()].map((l) => ({ key: l.entry.key, style: l.entry.style, fade: l.fade, alpha: l.mainMat.uniforms.uAlpha.value as number, triangles: l.triangles }));
  }

  /** 三角形の合計（Points を除く） */
  get triangles(): number { let n = 0; for (const l of this.leaks.values()) n += l.triangles; return n; }

  setTier(tier: QualityTier): void {
    this.animate = tier.flicker;
    this.sparksOn = tier.id !== 'low';
  }

  /** 描画経路（Game.applyPostFxConfig から。direct = EffectComposer を使わない） */
  setDirectRender(direct: boolean): void {
    this.alphaScale = direct ? 0.6 : 1;
  }

  /**
   * 目標状態の同期。entries に無い Leak はフェードアウト、部屋が構築済みでなくなった Leak は即座に消す。
   * Game.updateVisibility の末尾（扉の開閉・自動閉扉・入室・後回し構築の完了）で呼ぶ
   */
  sync(entries: DoorLeakEntry[], roomAlive: (roomId: string) => boolean): void {
    const wanted = new Set<string>();
    for (const e of entries) {
      wanted.add(e.key);
      const cur = this.leaks.get(e.key);
      if (cur) {
        cur.target = 1;
        // 向こうの部屋が差し替わった（style / 器具色が変わった）ときだけ作り直す
        if (cur.entry.style !== e.style || cur.entry.lightColor !== e.lightColor || cur.entry.width !== e.width) {
          const fade = cur.fade;
          this.remove(cur);
          const nl = this.create(e);
          if (nl) nl.fade = fade;
        }
        continue;
      }
      if (this.leaks.size >= MAX_LEAKS) continue;
      this.create(e);
    }
    for (const l of [...this.leaks.values()]) {
      if (wanted.has(l.entry.key)) continue;
      if (!roomAlive(l.entry.roomId)) this.remove(l);
      else l.target = 0;
    }
  }

  /** 毎フレーム: フェード・脈動・色相回転・Seam の流れとフリッカー・火花 */
  update(dt: number, now: number): void {
    for (const l of [...this.leaks.values()]) {
      if (l.fade !== l.target) {
        const step = dt / FADE_SEC;
        l.fade = l.target > l.fade ? Math.min(l.target, l.fade + step) : Math.max(l.target, l.fade - step);
      }
      if (l.fade <= 0 && l.target === 0) { this.remove(l); continue; }
      // フェードは滑らかに（smoothstep）
      const f = l.fade * l.fade * (3 - 2 * l.fade);
      if (l.entry.style === 'seam') this.updateSeam(l, f, now);
      else if (l.entry.style === 'seamClosed') this.updateSeamClosed(l, f, now);
      else this.updateRarity(l, f, now, dt);
    }
  }

  clear(): void {
    for (const l of [...this.leaks.values()]) this.remove(l);
  }

  dispose(): void {
    this.clear();
    this.atlas.dispose();
    this.flowTex.dispose();
    this.sparkTex.dispose();
  }

  // ------------------------------------------------------------ 更新
  private updateRarity(l: Leak, f: number, now: number, dt: number): void {
    const st = LEAK_STYLE[l.entry.style as Rarity];
    const t = now + l.seed * 0.37;
    const c = this.tmpColor;
    if (!l.entry.closed) {
      // 開いた扉: 向こうの部屋の器具色（最大チャンネル 1 に正規化）で弱く光るだけ。脈動・火花・色相回転はしない
      c.setHex(l.entry.lightColor);
      const m = Math.max(c.r, c.g, c.b, 1e-3);
      c.multiplyScalar(1 / m);
      (l.mainMat.uniforms.uColor.value as THREE.Color).copy(c);
      l.mainMat.uniforms.uAlpha.value = OPEN_LEAK_ALPHA * f * this.alphaScale;
      if (l.sparks) this.removeSparks(l);
      return;
    }
    if (l.entry.style === 'Common') {
      // 向こうの器具色を最大チャンネル 1 に正規化（明るさはアルファで決める）
      c.setHex(l.entry.lightColor);
      const m = Math.max(c.r, c.g, c.b, 1e-3);
      c.multiplyScalar(1 / m);
    } else if (l.entry.style === 'Mythic') {
      const hue = ((t / (st.hueSec ?? 4)) % 1 + 1) % 1;
      c.setHSL(hue, 1, 0.62);
    } else if (st.color2 !== undefined && st.hueSec) {
      const k = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / st.hueSec);
      c.setHex(st.color).lerp(this.tmpColor2.setHex(st.color2), k);
    } else {
      c.setHex(st.color);
    }
    let pulse = 1;
    if (st.pulseSec) {
      if (this.animate) pulse = (st.pulseMin ?? 0.7) + (1 - (st.pulseMin ?? 0.7)) * (0.5 + 0.5 * Math.sin((2 * Math.PI * t) / st.pulseSec));
      else pulse = 0.5 + 0.5 * (st.pulseMin ?? 0.7);
    }
    const u = l.mainMat.uniforms;
    (u.uColor.value as THREE.Color).copy(c);
    // 閉じた扉の隙間の帯: レア度の色で僅かに（表の alpha の 1/2）。火花は置かない
    u.uAlpha.value = st.alpha * CLOSED_LEAK_SCALE * pulse * f * this.alphaScale;

    // 火花（Legendary。mid / high のみ。閉じた扉の帯には置かない）
    if (st.sparks && this.sparksOn && !l.entry.closed) {
      if (!l.sparks) this.addSparks(l);
      this.updateSparks(l, f * pulse, dt, now);
    } else if (l.sparks) {
      this.removeSparks(l);
    }
  }

  private updateSeam(l: Leak, f: number, now: number): void {
    const st = LEAK_STYLE.seam;
    // 不規則なフリッカー（30 Hz の時刻 hash。8% で落ちる）。決定論は不要
    const n = Math.floor(now * 30) + l.seed * 7;
    let fl = 0.55 + 0.45 * hash01(n);
    if (hash01(n * 3 + 1) < 0.08) fl *= 0.15;
    // 洗い（2 色は頂点色）
    l.mainMat.uniforms.uAlpha.value = 0.25 * fl * f * this.alphaScale;
    // 縦枡の流れ: UV を上へ流す（v を減らす = テクスチャが +y へ動く）
    if (l.flowMat) {
      l.flowMat.uniforms.uAlpha.value = st.alpha * fl * f * this.alphaScale;
      const off = l.flowMat.uniforms.uOffset.value as THREE.Vector2;
      off.y = -((now * 0.9) % 1);
    }
    // 床: 暗い（乗算）。フリッカーで少し揺れる
    if (l.darkMat) l.darkMat.uniforms.uAlpha.value = 0.6 * (0.75 + 0.25 * fl) * f;
  }

  /** 閉じた Seam 扉: 床の帯（main）と細い縦の流れ（flow）。フリッカーは開いた Seam と同じ時刻 hash */
  private updateSeamClosed(l: Leak, f: number, now: number): void {
    const n = Math.floor(now * 30) + l.seed * 7;
    let fl = 0.55 + 0.45 * hash01(n);
    if (hash01(n * 3 + 1) < 0.08) fl *= 0.15;
    l.mainMat.uniforms.uAlpha.value = LEAK_STYLE.seamClosed.alpha * 2.2 * fl * f * this.alphaScale;
    if (l.flowMat) {
      l.flowMat.uniforms.uAlpha.value = LEAK_STYLE.seamClosed.alpha * fl * f * this.alphaScale;
      (l.flowMat.uniforms.uOffset.value as THREE.Vector2).y = -((now * 0.9) % 1);
    }
  }

  // ------------------------------------------------------------ 構築
  private create(e: DoorLeakEntry): Leak | null {
    const group = new THREE.Group();
    group.name = `leak:${e.key}`;
    group.position.set(e.pos[0], e.pos[1], e.pos[2]);
    group.rotation.y = (e.dir * Math.PI) / 2;
    if (e.style === 'seamClosed') return this.createSeamClosed(e, group);
    if (e.closed) return this.createClosedRarity(e, group);
    const seam = e.style === 'seam';
    const L = fanLength(e.width);
    const top = e.sill + e.height + 0.25;
    const parts: THREE.BufferGeometry[] = [];
    let triangles = 0;
    if (!seam) {
      parts.push(trapezoid(-0.16, -(0.16 + L), e.width / 2 + 0.1, e.width / 2 + L * 0.9, 3, 2, [0, 0.5], 0xffffff, 0xffffff));
      triangles += 12;
    }
    for (const s of [-1, 1] as const) {
      // 部屋の内側から扉を見て左（ローカル +X）がシアン、右がマゼンタ
      const col = seam ? (s > 0 ? LEAK_STYLE.seam.color : LEAK_STYLE.seam.color2!) : 0xffffff;
      parts.push(wallWash(s, e.width / 2 + 0.12, 0.4, 0.03, top, WALL_INNER_Z - 0.02, col));
      triangles += 2;
    }
    const mainGeo = mergeGeoms(parts);
    const mainMat = makeMaterial(this.atlas, false);
    const main = new THREE.Mesh(mainGeo, mainMat);
    main.renderOrder = 20;
    excludeFromOverridePasses(main);
    group.add(main);
    const leak: Leak = { entry: e, group, main, mainMat, fade: 0, target: 1, seed: hashString(e.key) % 1000, triangles };
    if (seam) {
      // 縦枡の流れ: 開口の内側の枡面（2 枚）+ 枡の見付に沿う室内側の縦帯（2 枚。正面から見えるのはこちら）
      const flowGeo = mergeGeoms([
        jambQuad(e.width / 2 - 0.005, e.sill, e.sill + e.height, LEAK_STYLE.seam.color),
        jambQuad(-(e.width / 2 - 0.005), e.sill, e.sill + e.height, LEAK_STYLE.seam.color2!),
        jambBand(1, e.width / 2 - 0.02, 0.12, e.sill, e.sill + e.height + 0.1, LEAK_STYLE.seam.color),
        jambBand(-1, e.width / 2 - 0.02, 0.12, e.sill, e.sill + e.height + 0.1, LEAK_STYLE.seam.color2!),
      ]);
      const flowMat = makeMaterial(this.flowTex, false);
      const flow = new THREE.Mesh(flowGeo, flowMat);
      flow.renderOrder = 20;
      excludeFromOverridePasses(flow);
      group.add(flow);
      leak.flow = flow; leak.flowMat = flowMat; leak.triangles += 8;
      // 床は暗い（乗算）
      const darkGeo = trapezoid(-0.16, -(0.16 + 2.6), e.width / 2 + 0.1, e.width / 2 + 2.4, 3, 2, [0, 0.5], 0xffffff, 0xffffff);
      const darkMat = makeMaterial(this.atlas, true);
      (darkMat.uniforms.uColor.value as THREE.Color).setRGB(0.35, 0.4, 0.55);
      const dark = new THREE.Mesh(darkGeo, darkMat);
      dark.renderOrder = 19;
      excludeFromOverridePasses(dark);
      group.add(dark);
      leak.dark = dark; leak.darkMat = darkMat; leak.triangles += 12;
    }
    this.scene.add(group);
    this.leaks.set(e.key, leak);
    return leak;
  }

  /** 閉じた通常扉（4 三角形）: パネル下端の隙間から床へ 0.25 m の帯（レア度の色は uColor、アトラスの扇形で奥へ減衰） */
  private createClosedRarity(e: DoorLeakEntry, group: THREE.Group): Leak {
    const mainGeo = mergeGeoms([floorStrip(1, e.width / 2, -0.16, -0.41, 0xffffff), floorStrip(-1, e.width / 2, -0.16, -0.41, 0xffffff)]);
    const mainMat = makeMaterial(this.atlas, false);
    const main = new THREE.Mesh(mainGeo, mainMat);
    main.renderOrder = 20;
    excludeFromOverridePasses(main);
    group.add(main);
    const leak: Leak = { entry: e, group, main, mainMat, fade: 0, target: 1, seed: hashString(e.key) % 1000, triangles: 4 };
    this.scene.add(group);
    this.leaks.set(e.key, leak);
    return leak;
  }

  /**
   * 閉じた Seam 扉（8 三角形）: パネル下端の隙間から床へ漏れる 2 色の帯（幅 = 扉幅の半分ずつ、奥行き 0.25 m。アトラスの扇形で奥へ減衰）と、
   * 枡の見付に沿う細い縦の流れ（開いた Seam の 1/3 の幅 0.04 m・強度）
   */
  private createSeamClosed(e: DoorLeakEntry, group: THREE.Group): Leak {
    const cyan = LEAK_STYLE.seamClosed.color, magenta = LEAK_STYLE.seamClosed.color2!;
    const mainGeo = mergeGeoms([
      floorStrip(1, e.width / 2, -0.16, -0.41, cyan),
      floorStrip(-1, e.width / 2, -0.16, -0.41, magenta),
    ]);
    const mainMat = makeMaterial(this.atlas, false);
    const main = new THREE.Mesh(mainGeo, mainMat);
    main.renderOrder = 20;
    excludeFromOverridePasses(main);
    group.add(main);
    const flowGeo = mergeGeoms([
      jambBand(1, e.width / 2 - 0.01, 0.04, e.sill, e.sill + e.height + 0.05, cyan),
      jambBand(-1, e.width / 2 - 0.01, 0.04, e.sill, e.sill + e.height + 0.05, magenta),
    ]);
    const flowMat = makeMaterial(this.flowTex, false);
    const flow = new THREE.Mesh(flowGeo, flowMat);
    flow.renderOrder = 20;
    excludeFromOverridePasses(flow);
    group.add(flow);
    const leak: Leak = { entry: e, group, main, mainMat, flow, flowMat, fade: 0, target: 1, seed: hashString(e.key) % 1000, triangles: 8 };
    this.scene.add(group);
    this.leaks.set(e.key, leak);
    return leak;
  }

  private remove(l: Leak): void {
    this.leaks.delete(l.entry.key);
    this.scene.remove(l.group);
    l.main.geometry.dispose();
    l.mainMat.dispose();
    l.flow?.geometry.dispose();
    l.flowMat?.dispose();
    l.dark?.geometry.dispose();
    l.darkMat?.dispose();
    this.removeSparks(l);
  }

  private addSparks(l: Leak): void {
    const n = SPARKS_PER_LEAK;
    const pos = new Float32Array(n * 3);
    const vel = new Float32Array(n * 2); // [上昇速度, 揺れの位相]
    const L = fanLength(l.entry.width);
    for (let i = 0; i < n; i++) this.respawnSpark(pos, vel, i, l.entry.width, L, Math.random());
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ map: this.sparkTex, color: 0xffd070, size: 0.022, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    const pts = new THREE.Points(geo, mat);
    pts.renderOrder = 21;
    pts.frustumCulled = false;
    l.group.add(pts);
    l.sparks = pts; l.sparkMat = mat; l.sparkVel = vel;
  }

  private removeSparks(l: Leak): void {
    if (!l.sparks) return;
    l.group.remove(l.sparks);
    l.sparks.geometry.dispose();
    l.sparkMat?.dispose();
    l.sparks = undefined; l.sparkMat = undefined; l.sparkVel = undefined;
  }

  private respawnSpark(pos: Float32Array, vel: Float32Array, i: number, width: number, L: number, y0: number): void {
    const z = -(0.3 + Math.random() * Math.min(1.5, L - 0.8));
    const half = Math.min(width / 2 + 0.5, (width / 2 + 0.1) + (-z - 0.16) * 0.6);
    pos[i * 3] = (Math.random() * 2 - 1) * half;
    pos[i * 3 + 1] = 0.02 + y0 * 0.2;
    pos[i * 3 + 2] = z;
    vel[i * 2] = 0.1 + Math.random() * 0.14;
    vel[i * 2 + 1] = Math.random() * Math.PI * 2;
  }

  private updateSparks(l: Leak, k: number, dt: number, now: number): void {
    if (!l.sparks || !l.sparkMat || !l.sparkVel) return;
    l.sparkMat.opacity = 0.85 * k;
    const attr = l.sparks.geometry.getAttribute('position') as THREE.BufferAttribute;
    const pos = attr.array as Float32Array;
    const vel = l.sparkVel;
    const L = fanLength(l.entry.width);
    for (let i = 0; i < SPARKS_PER_LEAK; i++) {
      pos[i * 3 + 1] += vel[i * 2] * dt;
      pos[i * 3] += Math.sin(now * 1.7 + vel[i * 2 + 1]) * 0.05 * dt;
      if (pos[i * 3 + 1] > 0.4 + (vel[i * 2 + 1] / (Math.PI * 2)) * 0.3) this.respawnSpark(pos, vel, i, l.entry.width, L, 0);
    }
    attr.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- ジオメトリ
/** 扇形の長さ（扉幅 1 m で 2.5 m、2.2 m 以上で 3.5 m） */
function fanLength(width: number): number {
  return Math.min(3.5, Math.max(2.5, 2.5 + (width - 1) * 0.8));
}

/**
 * 床の台形（z0 が扉側、z1 が奥）。cols × rows に分割して非アフィンな UV の歪みを抑える。
 * UV: u = 横（uRange に写す。アトラス左半分が扇形）、v = 奥行き（0 扉側 → 1 奥）。頂点色は左右で colL / colR
 */
function trapezoid(z0: number, z1: number, half0: number, half1: number, cols: number, rows: number, uRange: [number, number], colL: number, colR: number): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = [];
  const cL = new THREE.Color(colL), cR = new THREE.Color(colR), c = new THREE.Color();
  for (let r = 0; r <= rows; r++) {
    const v = r / rows;
    const z = z0 + (z1 - z0) * v;
    const half = half0 + (half1 - half0) * v;
    for (let i = 0; i <= cols; i++) {
      const u = i / cols;
      pos.push(-half + 2 * half * u, 0.012, z);
      uv.push(uRange[0] + (uRange[1] - uRange[0]) * u, v);
      c.copy(cL).lerp(cR, u);
      col.push(c.r, c.g, c.b);
    }
  }
  for (let r = 0; r < rows; r++) for (let i = 0; i < cols; i++) {
    const a = r * (cols + 1) + i, b = a + 1, d = a + cols + 1, e = d + 1;
    idx.push(a, d, b, b, d, e);
  }
  return buildGeom(pos, uv, col, idx);
}

/** 開口の脇の壁の洗い。side = -1 / 1、x は枡の外端から outward 幅 w。UV: u 0.5（枡側、明）→ 1（外、暗）、v 下 → 上 */
function wallWash(side: -1 | 1, xJamb: number, w: number, y0: number, y1: number, z: number, color: number): THREE.BufferGeometry {
  const c = new THREE.Color(color);
  const x0 = side * xJamb, x1 = side * (xJamb + w);
  const pos = [x0, y0, z, x1, y0, z, x0, y1, z, x1, y1, z];
  const uv = [0.5, 0, 1, 0, 0.5, 1, 1, 1];
  const col = [c.r, c.g, c.b, c.r, c.g, c.b, c.r, c.g, c.b, c.r, c.g, c.b];
  const idx = side < 0 ? [0, 1, 2, 1, 3, 2] : [0, 2, 1, 1, 2, 3];
  return buildGeom(pos, uv, col, idx);
}

/** Seam の縦枡（開口内側の枡面、両方の壁厚を通す z ∈ [-0.17, 0.17]）。UV: u = z、v = y（テクスチャは縦方向に繰り返す） */
function jambQuad(x: number, y0: number, y1: number, color: number): THREE.BufferGeometry {
  const c = new THREE.Color(color);
  const z0 = -0.17, z1 = 0.17;
  const pos = [x, y0, z0, x, y0, z1, x, y1, z0, x, y1, z1];
  const vTop = (y1 - y0) / 0.8;
  const uv = [0, 0, 1, 0, 0, vTop, 1, vTop];
  const col = [c.r, c.g, c.b, c.r, c.g, c.b, c.r, c.g, c.b, c.r, c.g, c.b];
  return buildGeom(pos, uv, col, [0, 1, 2, 1, 3, 2]);
}

/** 閉じた Seam 扉の床の帯（片側。x は 0 から side·halfW、z0 が扉側）。UV はアトラスの扇形の片側（u 0.25 → 0.5 or 0.25 → 0: 中央が明るく外へフェード、奥へ減衰） */
function floorStrip(side: -1 | 1, halfW: number, z0: number, z1: number, color: number): THREE.BufferGeometry {
  const c = new THREE.Color(color);
  const x0 = 0, x1 = side * halfW;
  const uIn = 0.25, uOut = side > 0 ? 0.5 : 0;
  const pos = [x0, 0.012, z0, x1, 0.012, z0, x0, 0.012, z1, x1, 0.012, z1];
  const uv = [uIn, 0, uOut, 0, uIn, 1, uOut, 1];
  const col = [c.r, c.g, c.b, c.r, c.g, c.b, c.r, c.g, c.b, c.r, c.g, c.b];
  return buildGeom(pos, uv, col, [0, 1, 2, 1, 3, 2]);
}

/** Seam の縦帯（枡の見付の室内側、z = -0.19 に浮かせた縦長の帯。UV: u = 横、v = y 繰り返し） */
function jambBand(side: -1 | 1, xJamb: number, w: number, y0: number, y1: number, color: number): THREE.BufferGeometry {
  const c = new THREE.Color(color);
  const z = -0.19;
  const x0 = side * xJamb, x1 = side * (xJamb + w);
  const pos = [x0, y0, z, x1, y0, z, x0, y1, z, x1, y1, z];
  const vTop = (y1 - y0) / 0.8;
  const uv = [0, 0, 1, 0, 0, vTop, 1, vTop];
  const col = [c.r, c.g, c.b, c.r, c.g, c.b, c.r, c.g, c.b, c.r, c.g, c.b];
  return buildGeom(pos, uv, col, [0, 1, 2, 1, 3, 2]);
}

function buildGeom(pos: number[], uv: number[], col: number[], idx: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

/** 同じ属性構成（position / uv / color）のジオメトリを 1 つに結合する（インデックス付き） */
function mergeGeoms(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = [];
  for (const g of parts) {
    const base = pos.length / 3;
    pos.push(...Array.from(g.getAttribute('position').array as Float32Array));
    uv.push(...Array.from(g.getAttribute('uv').array as Float32Array));
    col.push(...Array.from(g.getAttribute('color').array as Float32Array));
    const ix = g.getIndex()!;
    for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + base);
    g.dispose();
  }
  const out = buildGeom(pos, uv, col, idx);
  out.computeBoundingSphere();
  return out;
}

/**
 * 画面空間 AO（GTAOPass）の法線 / 深度パスから外す。GTAOPass は Points / Line だけを隠し、Mesh は scene.overrideMaterial で
 * 不透明に描くので、床から 1 cm 浮いた加算クワッドが AO に「面」として写り、硬い縁の明るい矩形が出る。
 * overrideMaterial が掛かっている（渡された material が自分の material でない）描画だけ drawRange を 0 にして描かない
 */
function excludeFromOverridePasses(mesh: THREE.Mesh): void {
  mesh.onBeforeRender = (_r, _s, _c, geometry, material) => { if (material !== mesh.material) geometry.setDrawRange(0, 0); };
  mesh.onAfterRender = (_r, _s, _c, geometry) => { geometry.setDrawRange(0, Infinity); };
}

function makeMaterial(map: THREE.Texture, multiply: boolean): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map }, uColor: { value: new THREE.Color(0xffffff) }, uAlpha: { value: 0 }, uOffset: { value: new THREE.Vector2() } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    defines: multiply ? { MULTIPLY: 1 } : {},
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: multiply ? THREE.MultiplyBlending : THREE.AdditiveBlending,
    premultipliedAlpha: multiply,
    fog: false,
  });
  // 乗算は比率なのでトーンマップしない。加算はシーンと同じトーンマップ（RenderTarget 描画中は three が無効化する）
  m.toneMapped = !multiply;
  return m;
}

// ---------------------------------------------------------------- テクスチャ（共有 CanvasTexture）
function hash01(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * 左半分（u 0..0.5）: 床の扇形。横は中央が明るく縁へ余弦窓でフェード、奥行きは (1-v)^1.7 で減衰（扉側に細い明帯）。
 * 右半分（u 0.5..1）: 壁の洗い。枡側（u=0.5）が明るく外へ (1-x)^2.2、上へ (1-v) でフェード
 */
function makeAtlas(): THREE.CanvasTexture {
  const W = 256, H = 128;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    // UV の v=0 は画像の下端（three.js の flipY 既定 true）
    const v = 1 - (y + 0.5) / H;
    for (let x = 0; x < W; x++) {
      let a: number;
      if (x < W / 2) {
        const u = (x + 0.5) / (W / 2);
        const across = Math.pow(Math.max(0, Math.cos((u - 0.5) * Math.PI)), 1.4);
        // 扉側で横に広がり過ぎない: 奥ほど横の窓を広く（近くは扉幅、奥は扇）
        const along = Math.pow(1 - v, 1.9);
        a = across * along;
      } else {
        const u = (x - W / 2 + 0.5) / (W / 2);
        a = Math.pow(1 - u, 2.2) * (0.12 + 0.88 * Math.pow(1 - v, 1.5));
      }
      const i = (y * W + x) * 4;
      img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255; img.data[i + 3] = Math.round(Math.min(1, a) * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

/** Seam の縦枡を流れる光（縦に繰り返す）: 幅方向は中央が明るい 3 本の筋、長さ方向は不規則な明滅の帯 */
function makeFlowTexture(): THREE.CanvasTexture {
  const W = 32, H = 128;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const v = y / H;
    // 帯: 周期の異なる正弦の重ね（繰り返し境界で連続する整数周期）
    const band = 0.45 + 0.35 * Math.sin(v * Math.PI * 2 * 3) + 0.2 * Math.sin(v * Math.PI * 2 * 7 + 1.3);
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W;
      const streak = Math.pow(Math.max(0, Math.cos((u - 0.5) * Math.PI)), 0.8) * (0.6 + 0.4 * Math.abs(Math.sin(u * Math.PI * 3)));
      const a = Math.min(1, Math.max(0, band)) * streak;
      const i = (y * W + x) * 4;
      img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255; img.data[i + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

/** 火花（Points 用の丸い光点） */
function makeSparkTexture(): THREE.CanvasTexture {
  const S = 32;
  const canvas = document.createElement('canvas');
  canvas.width = S; canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,240,200,0.8)');
  g.addColorStop(1, 'rgba(255,200,100,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
