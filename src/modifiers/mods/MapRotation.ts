/**
 * MapRotation — 地図の北とワールド北をずらす（M19 方位破壊区画）。表示側（ctx.game.mapView.rotation）だけを書き、保存しない。
 * params: angle（度。既定 90。画面上で時計回り正）, drift（既定 true）, driftDeg（既定 25）, driftPeriodSec（既定 30）, easeSec（既定 0.6）。
 *
 * onEnter : 現在の回転から angle へ 0.6 s（easeSec）でイーズインを開始する（実際の補間は update）。
 * update  : rotation = lerp(from, angle, ease(t)) + drift。drift は入室からの経過時間の正弦（±driftDeg / driftPeriodSec）で、
 *           イーズ中は同じ係数で立ち上げる（sin(0) = 0 なので入室時に跳ばない）。連続回転はしない（酔い対策）。
 * onExit  : 現在の回転から 0 へ easeSec でイーズアウト。update は「可視部屋」に対しても呼ばれるので、扉が開いていて M19 が見えている間は
 *           update が補間を進める。見えなくなって update が来なくなっても最後に 0 を書けるように setTimeout の保険を置く
 *           （easeSec + 0.1 s 後に、まだ退室中なら 0）。
 * 状態はモジュール内の 1 つ（回転は地図全体で 1 つの値）。M19 → M19 の連続入室は現在値から滑らかに繋ぐ。
 * newWorld / load は Game 側が rotation を 0 に戻す（状態は次の onEnter で上書きされる）。
 */
import type { ModifierImpl, ModifierParams } from '../types';
import { bool, num } from '../util';

const ID = 'MapRotation';
const DEG = Math.PI / 180;

interface RotationState {
  /** 回転を担当している部屋 id（update はこの部屋のコンテキストだけに反応する） */
  roomId: string | null;
  phase: 'idle' | 'in' | 'out';
  /** イーズの開始値（ラジアン） */
  from: number;
  /** イーズの目標値（ラジアン。'out' は 0） */
  target: number;
  /** イーズの経過秒 */
  t: number;
  /** 入室からの経過秒（drift の位相） */
  sinceEnter: number;
  /** onEnter ごとに増やし、古い setTimeout を無効化する */
  token: number;
  timer: ReturnType<typeof setTimeout> | null;
}

const state: RotationState = { roomId: null, phase: 'idle', from: 0, target: 0, t: 0, sinceEnter: 0, token: 0, timer: null };

function readParams(params: ModifierParams) {
  return {
    angle: num(params.angle, 90) * DEG,
    drift: bool(params.drift, true),
    driftAmp: Math.max(0, num(params.driftDeg, 25)) * DEG,
    driftPeriod: Math.max(1, num(params.driftPeriodSec, 30)),
    ease: Math.max(0.01, num(params.easeSec, 0.6)),
  };
}

/** smoothstep（0〜1） */
function ease01(k: number): number {
  const x = Math.min(1, Math.max(0, k));
  return x * x * (3 - 2 * x);
}

function clearTimer(): void {
  if (state.timer !== null) {
    clearTimeout(state.timer);
    state.timer = null;
  }
}

const MapRotation: ModifierImpl = {
  id: ID,
  defaults: { angle: 90, drift: true, driftDeg: 25, driftPeriodSec: 30, easeSec: 0.6 },

  onEnter(ctx, params) {
    const mv = ctx.game?.mapView;
    if (!mv) return;
    const p = readParams(params);
    clearTimer();
    state.roomId = ctx.node.roomId;
    state.phase = 'in';
    state.from = mv.rotation; // 退室イーズ中の再入室・M19 連続でも現在値から繋ぐ
    state.target = p.angle;
    state.t = 0;
    state.sinceEnter = 0;
    state.token += 1;
  },

  update(dt, ctx, params) {
    const mv = ctx.game?.mapView;
    if (!mv || state.phase === 'idle' || ctx.node.roomId !== state.roomId) return;
    const p = readParams(params);
    state.t += dt;
    const k = ease01(state.t / p.ease);
    if (state.phase === 'in') {
      state.sinceEnter += dt;
      const drift = p.drift ? Math.sin((state.sinceEnter / p.driftPeriod) * Math.PI * 2) * p.driftAmp : 0;
      mv.rotation = state.from + (state.target - state.from) * k + drift * k;
      return;
    }
    // 'out': 0 へ戻す
    mv.rotation = state.from * (1 - k);
    if (k >= 1) {
      mv.rotation = 0;
      state.phase = 'idle';
      clearTimer();
    }
  },

  onExit(ctx, params) {
    const mv = ctx.game?.mapView;
    if (!mv || ctx.node.roomId !== state.roomId) return;
    const p = readParams(params);
    state.phase = 'out';
    state.from = mv.rotation;
    state.target = 0;
    state.t = 0;
    const token = state.token;
    clearTimer();
    // 保険: M19 が見えなくなって update が来なくなっても、最後に必ず 0 を書く
    state.timer = setTimeout(() => {
      state.timer = null;
      if (state.token !== token || state.phase !== 'out') return;
      mv.rotation = 0;
      state.phase = 'idle';
    }, (p.ease + 0.1) * 1000);
  },
};

export default MapRotation;
