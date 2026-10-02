/**
 * 異変の定義を登録する（defineAnomaly）。異変を足すときは defs/ にファイルを置き、ここから import する。
 * 調整表に anomaly.w.<id>（出やすさ）と数値を足す。
 */
import './water.ts';
import './scale.ts';
import './arrange.ts';
import './light.ts';
import './walls.ts';
import './gravity.ts';
// 段階 4 の担当ごとの異変（docs/stage4-workstreams.md）
import './move/index.ts';
import './ground/index.ts';
import './sense/index.ts';
import './oddity/index.ts';
import './carry/index.ts';
import './warp/index.ts';
import './structure/index.ts';
import './rooms/index.ts';
import './map/index.ts';
