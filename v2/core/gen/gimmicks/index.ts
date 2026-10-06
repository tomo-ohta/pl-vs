/**
 * 仕掛けの登録。ここで import したファイルの defineGimmick が実行される。
 * 仕掛けを足すときは gimmicks/ にファイルを作り、ここに 1 行足す。
 */
import './basic.ts';
import './belts.ts';
import './floor.ts';
import './secret.ts';
// 段階 4 の担当ごとの仕掛け（docs/stage4-workstreams.md）
import './move/index.ts';
import './ground/index.ts';
import './sense/index.ts';
import './oddity/index.ts';
import './carry/index.ts';
import './warp/index.ts';
import './structure/index.ts';
import './rooms/index.ts';
import './map/index.ts';
