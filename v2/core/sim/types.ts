/**
 * シミュレーションの入出力の型。クライアント（とのちのサーバー）はこれだけを介してシミュレーションとやり取りする。
 * - InputCommand: 1 tick 分のプレイヤーの操作（視線は絶対値。マウスの差分はクライアントが積算する）
 * - SimEvent: 1 tick の間に起きたこと（足音・着地・扉・隠しの出現 …）。クライアントが音と演出に使う（Cue）
 */
import type { Vec3 } from '../math/vec.ts';

export interface InputCommand {
  /** 右(+) / 前(+)。-1..1 */
  moveX: number;
  moveY: number;
  /** 視線（rad）。yaw 0 で -Z、pitch + で上 */
  yaw: number;
  pitch: number;
  jump: boolean;
  dash: boolean;
  crouch: boolean;
  /** 調べる（扉・ボタン）。視線の向きで当てる。スマホのタップは、タップした方向の視線を入れる */
  interact: { yaw: number; pitch: number } | null;
  /** 持っている物を置く・投げる（Q キー）。押した tick だけ true */
  drop?: boolean;
  /** 懐中電灯が点いているか（R キーで切り替える状態。照らした所だけ現れる物などが読む） */
  flashlight?: boolean;
  /** マイクの音量（0..1。マイクを使っていなければ無し。担当 sense: 声で開く扉） */
  voice?: number;
}

export const IDLE_COMMAND: Readonly<InputCommand> = { moveX: 0, moveY: 0, yaw: 0, pitch: 0, jump: false, dash: false, crouch: false, interact: null, drop: false, flashlight: false };

export type MoveRank = 'still' | 'walk' | 'dash';

/** プレイヤーの状態（すべて JSON にできる値。保存と同期にそのまま使う） */
export interface PlayerState {
  id: string;
  /** 足元の位置 */
  pos: Vec3;
  vel: Vec3;
  yaw: number;
  pitch: number;
  onGround: boolean;
  crouching: boolean;
  /** 視点の高さ（補間中の値） */
  eye: number;
  moveRank: MoveRank;
  /** 足音の歩幅の積算（m）と通算歩数 */
  strideAcc: number;
  strideCount: number;
  /** 足元のゾーンの合成結果 */
  inWater: boolean;
  zoneSlow: number;
  zoneFriction: number;
  /** 重さの倍率（gravity ゾーン。1 が普通） */
  zoneGravity: number;
  /** ゾーン（force）の外力 */
  zoneForce: Vec3;
  /** 乗っている動く物（動く床）の速度 */
  carry: Vec3;
  /** 動いていない（移動も視線も変えていない）秒数 */
  stillSec: number;
  /** 立っている面（坂・傾く床）の id。床や箱の上なら null */
  surfaceId: string | null;
  /** 落ちたとき戻る位置（チェックポイント） */
  respawn: { pos: Vec3; yaw: number };
  /** 最後に地面にいた位置（落下の判定・戻る位置の候補） */
  lastGround: Vec3;
  /** その tick に調べる操作をしたか（部品の判定用）と、当たった部品 */
  interactedId: string | null;
  /** 懐中電灯が点いているか（コマンドの flashlight。目の位置・視線の向きで照らす） */
  flashlight: boolean;
  /** マイクの音量（コマンドの voice。マイクを使っていなければ -1。担当 sense） */
  voice?: number;
  /** その tick に「置く」操作をしたか（持ち物の部品が読む） */
  dropPressed: boolean;
  /** 持っている物（持ち物の部品の id）。無ければ null */
  holding: string | null;
}

/** 1 tick に起きたこと。type ごとに使う欄が違う */
export interface SimEvent {
  type: string;
  tick: number;
  /** 関係する部品 */
  entity?: string;
  /** 関係するプレイヤー */
  player?: string;
  pos?: Vec3;
  /** 種類ごとの値（足音の床の材質・着地の速さ・Cue の名前 …） */
  data?: { [k: string]: string | number | boolean | null };
}
