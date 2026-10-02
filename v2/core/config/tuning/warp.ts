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
} as const satisfies Record<string, Spec>;
