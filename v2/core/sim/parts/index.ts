/**
 * 部品の登録。ここで import したファイルの definePart が実行される。
 * 部品を足すときは parts/ にファイルを作り、ここに 1 行足す。
 */
import './logic.ts';
import './sensors.ts';
import './actuators.ts';
import './motion.ts';
import './gimmicks.ts';
// 段階 4 の担当ごとの部品（docs/stage4-workstreams.md）
import './move/index.ts';
import './ground/index.ts';
import './sense/index.ts';
import './oddity/index.ts';
import './carry/index.ts';
import './warp/index.ts';
import './structure/index.ts';
import './rooms/index.ts';
import './map/index.ts';
// 果てしない階の移る所（エレベーター・案内板・着く部屋の床板）
import './world.ts';
