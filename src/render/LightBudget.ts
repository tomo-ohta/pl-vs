/**
 * Fixed light slots with hysteresis and a visible fade-out before reassignment.
 * three.js に依存しない（tests/light-budget.mjs が Node で読む）。
 */
export interface BudgetLight { visible: boolean; intensity: number; userData: { baseIntensity?: number; [key: string]: unknown }; }

/**
 * 可視ライトを limit 本に保つ。距離のヒステリシス（点灯中は 0.8 倍で評価）付きで選び、外れたライトは 0 へ減衰してから visible を落とす。
 * 戻り値: このフレームで「選ばれている」ライト（増光中・点灯中）。退出中（減衰中）のライトは含まない
 */
export function updateLightBudget<T extends BudgetLight>(entries: { light: T; d: number }[], limit: number, dt: number): Set<T> {
  const sorted = [...entries].sort((a,b) => a.d*(a.light.visible?.8:1)-b.d*(b.light.visible?.8:1));
  const desired = new Set(sorted.slice(0,limit).map(e=>e.light));
  const alpha=1-Math.exp(-8*Math.max(0,Math.min(.1,dt)));
  // On an explicit quality reduction, enforce the new cap immediately.
  const active=sorted.filter(e=>e.light.visible);
  for(const {light} of active.slice(limit)){light.visible=false;light.intensity=0;}
  for(const {light} of sorted){
    if(!light.visible)continue;
    const target=desired.has(light)?Number(light.userData.baseIntensity??0):0;
    light.intensity+=(target-light.intensity)*alpha;
    if(!desired.has(light)&&light.intensity<.01){light.visible=false;light.intensity=0;}
  }
  let count=sorted.filter(e=>e.light.visible).length;
  for(const {light} of sorted){
    if(count>=limit)break;
    if(!light.visible&&desired.has(light)){light.visible=true;light.intensity=Number(light.userData.baseIntensity??0)*alpha;count++;}
  }
  return desired;
}

// ---------------------------------------------------------------- 影スロット（V04 手順 7 の影版）

/** 影スロットの対象（three の PointLight を構造的に表す） */
export interface ShadowSlotLight extends BudgetLight {
  castShadow: boolean;
  shadow: { intensity: number };
}

export interface ShadowSlotEntry<T> {
  light: T;
  /** プレイヤーからの距離²（updateLights と同じ単位） */
  d: number;
  /** updateLightBudget で選ばれている（増光中・点灯中）。false は退出中 */
  lit: boolean;
}

export interface ShadowSlotOptions {
  /** 現保持ライトの距離² に対するこの比率より近い挑戦者だけが交代を要求できる（0.6 = 距離で約 0.77 倍） */
  hysteresis?: number;
  /** 挑戦者がこの秒数だけ連続して近いときに交代を始める */
  holdSec?: number;
  /** shadow.intensity を 0↔1 に動かす秒数（受け渡しの間、影を落とすライトの本数は変わらない） */
  fadeSec?: number;
}

/**
 * 可視ライトのうちプレイヤーに近い slotCount 灯だけに castShadow を与える。
 * - 交代は「保持ライトの影を 0 へフェード → castShadow を外す → 挑戦者に castShadow を立てて 0 から増光」の順で、同時に 1 件だけ。
 *   影を落とすライトの本数が受け渡し中に増えないので、three.js の numPointLightShadows（プログラムキー）が揺れない。
 * - 距離のヒステリシス + 保持時間で、選択境界を往復しても影がパカパカしない。
 * - 消えた（退出した・dispose された）ライトは即解放する（onRelease で影マップを捨てる）。
 */
export class ShadowSlots<T extends ShadowSlotLight> {
  readonly holders: T[] = [];
  private readonly hysteresis: number;
  private readonly holdSec: number;
  private readonly fadeSec: number;
  private readonly challengeSince = new Map<T, number>();
  private fadingOut: T | null = null;
  private pendingIn: T | null = null;

  constructor(opts: ShadowSlotOptions = {}) {
    this.hysteresis = opts.hysteresis ?? 0.6;
    this.holdSec = opts.holdSec ?? 0.4;
    this.fadeSec = opts.fadeSec ?? 0.35;
  }

  /**
   * entries は可視ライト（updateLightBudget の後）。onAcquire は castShadow を立てる直前（影パラメータの設定）、
   * onRelease は外した直後（影マップの解放）に呼ばれる
   */
  update(entries: ShadowSlotEntry<T>[], slotCount: number, dt: number, onAcquire: (light: T) => void, onRelease: (light: T) => void): void {
    const alive = new Map<T, ShadowSlotEntry<T>>();
    for (const e of entries) if (e.light.visible) alive.set(e.light, e);
    // 1. 消えたライトと、Tier 変更で減った枠を即解放
    for (let i = this.holders.length - 1; i >= 0; i--) {
      if (!alive.has(this.holders[i]) || i >= slotCount) this.releaseAt(i, onRelease);
    }
    if (this.fadingOut && !this.holders.includes(this.fadingOut)) { this.fadingOut = null; this.pendingIn = null; }
    if (this.pendingIn && !alive.has(this.pendingIn)) this.pendingIn = null;
    // 2. 保持中の影を増光
    const step = dt / Math.max(1e-3, this.fadeSec);
    for (const h of this.holders) if (h !== this.fadingOut && h.shadow.intensity < 1) h.shadow.intensity = Math.min(1, h.shadow.intensity + step);
    // 3. 受け渡し中: 減光が終わったら挑戦者へ
    if (this.fadingOut) {
      const h = this.fadingOut;
      h.shadow.intensity = Math.max(0, h.shadow.intensity - step);
      if (h.shadow.intensity <= 0) {
        this.releaseAt(this.holders.indexOf(h), onRelease);
        const c = this.pendingIn;
        this.fadingOut = null;
        this.pendingIn = null;
        if (c && alive.has(c) && !this.holders.includes(c) && this.holders.length < slotCount) this.acquire(c, onAcquire);
      }
      return;
    }
    // 4. 空き枠は近い点灯ライトで即埋める
    const lit = [...alive.values()].filter((e) => e.lit).sort((a, b) => a.d - b.d);
    for (const e of lit) {
      if (this.holders.length >= slotCount) break;
      if (!this.holders.includes(e.light)) this.acquire(e.light, onAcquire);
    }
    if (this.holders.length === 0) { this.challengeSince.clear(); return; }
    // 5. 退出中（lit でない）の保持ライトがあれば、その影を先に消す
    const dying = this.holders.find((h) => !alive.get(h)!.lit);
    if (dying) {
      this.fadingOut = dying;
      this.pendingIn = lit.find((e) => !this.holders.includes(e.light))?.light ?? null;
      this.challengeSince.clear();
      return;
    }
    // 6. 挑戦: 最も近い非保持ライト vs 最も遠い保持ライト（ヒステリシス + 保持時間）
    const challenger = lit.find((e) => !this.holders.includes(e.light));
    let far: T | null = null;
    let farD = -1;
    for (const h of this.holders) { const d = alive.get(h)!.d; if (d > farD) { farD = d; far = h; } }
    if (!challenger || !far || this.holders.length < slotCount) { this.challengeSince.clear(); return; }
    if (challenger.d < farD * this.hysteresis) {
      const t = (this.challengeSince.get(far) ?? 0) + dt;
      if (t >= this.holdSec) {
        this.challengeSince.clear();
        this.fadingOut = far;
        this.pendingIn = challenger.light;
      } else {
        this.challengeSince.set(far, t);
      }
    } else {
      this.challengeSince.clear();
    }
  }

  /** ライトが dispose されるとき（部屋の破棄）に呼ぶ。保持中なら即解放 */
  forget(light: T, onRelease: (light: T) => void): void {
    const i = this.holders.indexOf(light);
    if (i >= 0) this.releaseAt(i, onRelease);
    if (this.fadingOut === light) { this.fadingOut = null; this.pendingIn = null; }
    if (this.pendingIn === light) this.pendingIn = null;
    this.challengeSince.delete(light);
  }

  clear(onRelease: (light: T) => void): void {
    for (let i = this.holders.length - 1; i >= 0; i--) this.releaseAt(i, onRelease);
    this.fadingOut = null;
    this.pendingIn = null;
    this.challengeSince.clear();
  }

  private acquire(light: T, onAcquire: (light: T) => void): void {
    onAcquire(light);
    light.shadow.intensity = 0;
    light.castShadow = true;
    this.holders.push(light);
  }

  private releaseAt(i: number, onRelease: (light: T) => void): void {
    if (i < 0 || i >= this.holders.length) return;
    const light = this.holders[i];
    this.holders.splice(i, 1);
    light.castShadow = false;
    light.shadow.intensity = 1;
    this.challengeSince.delete(light);
    onRelease(light);
  }
}
