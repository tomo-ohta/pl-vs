/**
 * 段階 4・空間のゆがみと輪（2.5 の移動・2.13 X01・F27・F30）の調整値。この担当だけがこのファイルを書き換える（docs/stage4-workstreams.md）。
 * キーは 'warp.<仕掛け・異変>.<数値>'（例: 'warp.example.speedM'）。項目の作り方は spec.ts（num / bool）。
 *
 * 仕掛けの出やすさ（*.weight）は定義を読み込むときの既定値を使う（?tune では変わらない。ほかの仕掛けの weight と同じ扱い）。
 * 長さの多くは、継ぎ目の無い移動で床・壁の模様が揃うように 6 m の倍数にしてある（core/gen/gimmicks/warp/pocket.ts）
 */
import { num, type Spec } from '../spec.ts';

export const WARP_TUNING = {
  // ---- 閉じた輪の廊下（loopHall: W06・BX02）
  'warp.loopHall.weight': num(0.5, 0, 10, '閉じた輪の廊下: 出やすさ（相対）'),
  'warp.loopHall.periodM': num(12, 6, 24, '閉じた輪の廊下: 同じ物が並ぶ長さ = 戻される長さ（m。6 の倍数）', true),
  'warp.loopHall.periods': num(3, 3, 6, '閉じた輪の廊下: くり返しの数（霧の届く長さの 2 倍 + 1 周より長く）', true),
  'warp.loopHall.fogFarM': num(10, 6, 14, '閉じた輪の廊下: 霧で何も見えなくなる距離（m）'),
  'warp.loopHall.widthM': num(2.4, 1.8, 3.2, '閉じた輪の廊下: 廊下の幅（壁を含む）'),
  'warp.loopHall.heightM': num(2.7, 2.4, 3.2, '閉じた輪の廊下: 天井の高さ'),
  'warp.loopHall.lapsOut': num(4, 1, 12, '閉じた輪の廊下: 前へ何周すると輪がほどけて奥の扉へ進めるか', true),
  'warp.loopHall.lapsBack': num(3, 1, 12, '閉じた輪の廊下（BX02）: 輪が閉じたあと、後ろへ何周すると後ろの輪がほどけて隠しの入口が現れるか', true),
  'warp.loopHall.giveUpSec': num(80, 20, 600, '閉じた輪の廊下: 抜けられなくてもこの秒数で前も後ろもほどける（閉じ込めない）'),
  'warp.loopHall.secretWeight': num(1.4, 0, 5, '閉じた輪の廊下（BX02）: 隠しの元の重み'),
  // ---- 異変の廊下（anomalyHall: X01・BX01）
  'warp.lapHall.weight': num(0.6, 0, 10, '異変の廊下: 出やすさ（相対）'),
  'warp.lapHall.goal': num(5, 1, 12, '異変の廊下: 何回続けて正しく進む・引き返すと出口の周になるか', true),
  'warp.lapHall.chance': num(0.55, 0, 1, '異変の廊下: 周に異変がある確率（間違えた次の周と最初の周は異変なし）'),
  'warp.lapHall.secretRun': num(3, 1, 8, '異変の廊下（BX01）: 一度も引き返さずに、異変のある周を何回進むと、異変の部屋の扉が現れるか', true),
  'warp.lapHall.secretWeight': num(1.6, 0, 5, '異変の廊下（BX01）: 隠しの元の重み'),
  // ---- 階段の数（endlessStairs: W14）
  'warp.stairs.weight': num(0.45, 0, 10, '階段の数: 出やすさ（相対）'),
  'warp.stairs.goal': num(6, 1, 20, '階段の数: 何階上ると、同じ踊り場から抜けて上の階へ出られるか', true),
  'warp.stairs.giveUpSec': num(150, 30, 900, '階段の数: 階段室に入ってからこの秒数で、上の階へ必ず抜けられる'),
  // ---- 遠ざかる廊下（recedingHall: W05）
  'warp.recede.weight': num(0.45, 0, 10, '遠ざかる廊下: 出やすさ（相対）'),
  'warp.recede.periods': num(4, 2, 8, '遠ざかる廊下: 廊下の長さ（12 m のくり返しの数）', true),
  'warp.recede.startM': num(9, 4, 20, '遠ざかる廊下: 扉を開けたときに見える突き当たりまでの距離（m）'),
  'warp.recede.rate': num(0.5, 0, 3, '遠ざかる廊下: 1 m 歩くごとに残りの距離が伸びる量（m。v1 E13 と同じ 0.5）'),
  'warp.recede.widthM': num(2.4, 1.8, 3.2, '遠ざかる廊下: 廊下の幅（壁を含む）'),
  'warp.recede.heightM': num(2.7, 2.4, 3.2, '遠ざかる廊下: 天井の高さ'),
  // ---- 振り返ると変わる（lookBack: O05）
  'warp.lookBack.weight': num(0.6, 0, 10, '振り返ると変わる: 出やすさ（相対）'),
  'warp.lookBack.booths': num(6, 3, 8, '振り返ると変わる: 壁沿いの小部屋の数（多くて）', true),
  'warp.lookBack.unseenSec': num(0.6, 0.1, 5, '振り返ると変わる: 小部屋から目を離してこの秒数で別の場面に変わる'),
  // ---- 4 回曲がっても戻らない（fourRights: W13）
  'warp.fourRights.weight': num(0.5, 0, 10, '4 回曲がっても戻らない: 出やすさ（相対）'),
  'warp.fourRights.ringM': num(1.5, 1.1, 2.2, '4 回曲がっても戻らない: 真ん中の塊のまわりの通路の幅（m）'),
  'warp.fourRights.secretWeight': num(1.5, 0, 5, '4 回曲がっても戻らない: 隠しの元（1 周回ると現れる扉）の重み'),
  // ---- 曲がると変わる景色（cornerSwap: W07）
  'warp.cornerSwap.weight': num(0.5, 0, 10, '曲がると変わる景色: 出やすさ（相対）'),
  'warp.cornerSwap.passageM': num(1.7, 1.4, 2.4, '曲がると変わる景色: 扉の壁と仕切りの間の通路の幅（m）'),
  'warp.cornerSwap.gapM': num(1.2, 1.0, 1.8, '曲がると変わる景色: 仕切りの端の切れ目の幅（m）'),
  'warp.cornerSwap.unseenSec': num(0.5, 0.1, 5, '曲がると変わる景色: 通路と切れ目が見えなくなってこの秒数で次の部屋に変わる'),
  // ---- 回転する部屋（turnRoom: W11）
  'warp.turnRoom.weight': num(0.8, 0, 10, '回転する部屋: 出やすさ（相対。置ける部屋が広い部屋だけなので重め）'),
  'warp.turnRoom.ringM': num(1.2, 1.0, 2.0, '回転する部屋: 筒の外の通路の幅（m）'),
  'warp.turnRoom.gapM': num(1.1, 0.9, 1.6, '回転する部屋: 筒の入口の幅（m）'),
  'warp.turnRoom.periodSec': num(40, 15, 120, '回転する部屋: 1 回りの秒数'),
  'warp.turnRoom.drift': num(0.12, 0, 0.6, '回転する部屋: 外へ押す強さ（軸から 1 m 離れるごとの m/s）'),
  // ---- 2 つの扉が同じ部屋へ（twoDoors: W12）
  'warp.twoDoors.weight': num(0.5, 0, 10, '2 つの扉が同じ部屋へ: 出やすさ（相対）'),
  'warp.twoDoors.spacingM': num(2.6, 2.2, 4, '2 つの扉が同じ部屋へ: 並んだ扉の真ん中どうしの間隔（m）'),
  'warp.twoDoors.depthM': num(4.8, 3.6, 7, '2 つの扉が同じ部屋へ: 居間の奥行き（扉 A から扉 B まで。m）'),
} as const satisfies Record<string, Spec>;
