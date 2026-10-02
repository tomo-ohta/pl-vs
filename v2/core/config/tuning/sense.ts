/**
 * 段階 4・光・音・視線・時間（2.6〜2.9）の調整値。この担当だけがこのファイルを書き換える（docs/stage4-workstreams.md）。
 * キーは 'sense.<仕掛け・異変>.<数値>'（例: 'sense.example.speedM'）。項目の作り方は spec.ts（num / bool）。
 */
import { num, type Spec } from '../spec.ts';

export const SENSE_TUNING = {
  // ---- 光の床の部屋（gimmicks/sense/lightfloor.ts）----
  'sense.lightPit.depthM': num(2.4, 2.0, 3.0, '光の床の部屋: 穴の深さ（m）'),
  'sense.beamFloor.tileM': num(0.6, 0.4, 1.2, '照らした所だけある床: 床板の大きさ（m）'),
  'sense.beamFloor.graceSec': num(1.4, 0.3, 4, '照らした所だけある床: 照らすのをやめてから床板が消えるまで（秒。歩いて足元まで来る間はある）'),
  'sense.beamFloor.deg': num(26, 10, 40, '照らした所だけある床: 床を作る光の円錐の半角（度。懐中電灯の明るい芯の大きさ）'),
  'sense.beamFloor.rangeM': num(8, 3, 20, '照らした所だけある床: 床を作る光の届く距離（m）'),
  'sense.spotRide.radiusM': num(1.05, 0.7, 2, '動く光の中だけ床: 光の円の半径（m）'),
  'sense.spotRide.speed': num(0.85, 0.3, 2.5, '動く光の中だけ床: 光の円の速さ（m/s。歩くより遅い）'),
  'sense.spotRide.pauseSec': num(2.5, 0.5, 8, '動く光の中だけ床: 両端で止まる秒数（乗り降りする間）'),
  'sense.spotRide.tileM': num(0.5, 0.3, 1, '動く光の中だけ床: 床板の大きさ（m）'),
  'sense.lightBands.widthM': num(0.75, 0.5, 1.4, '光の帯の橋: 帯の幅（m）'),
  'sense.lightBands.gapM': num(0.45, 0.2, 1.2, '光の帯の橋: 帯の間（m。隣の帯へ乗り移れる）'),
  'sense.lightBands.onSec': num(4.5, 2, 12, '光の帯の橋: 帯が点いている秒数'),
  'sense.lightBands.offSec': num(2.5, 0.5, 8, '光の帯の橋: 帯が消えている秒数'),
  'sense.lightBands.warnSec': num(1.0, 0, 3, '光の帯の橋: 消える前に瞬く秒数'),
  'sense.lookBridge.widthM': num(1.0, 0.6, 1.6, '見ている間だけある橋: 橋の幅（m）'),
  'sense.lookBridge.graceSec': num(0.9, 0.2, 3, '見ている間だけある橋: 目を離してから橋の板が消えるまで（秒）'),
} as const satisfies Record<string, Spec>;
