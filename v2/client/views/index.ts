/**
 * 部品の描画の入口。views.ts の基本の描画に、各作業の描画（views/*.ts）を足していく。
 * 描画を足すときは、ここに import を 1 行足す（defineView は import のときに登録される）。
 */
export * from './views.ts';
// 段階 4 の担当ごとの描画（docs/stage4-workstreams.md）
import './move/index.ts';
import './ground/index.ts';
import './sense/index.ts';
import './oddity/index.ts';
import './carry/index.ts';
import './warp/index.ts';
import './structure/index.ts';
import './rooms/index.ts';
import './map/index.ts';
