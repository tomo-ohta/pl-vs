/**
 * 案の台帳・物を運ぶ・パズル・ミニゲーム（docs/stage4-workstreams.md）。この担当だけがこのファイルを書き換える。
 * 受け持つ案の番号は index.ts の OWNERS。書き方は types.ts。
 *
 * 共通の部品（core/sim/parts/carry）: 持てる物 carryItem（物理なし）/ carryBody（剛体）・受け carryReceiver（枠・範囲・重さ・向き）・
 * 持って待つ枠 carrySensor。調べる（E）で拾い、Q で置く（枠へ吸い付く）、走りながら・上を向いて Q で投げる。持ったまま別の物を調べると入れ替え。
 * 報酬は置かない: 運ばなくても普通に通れる。運ぶ・普通と違う遊び方をすると隠し（v2-plan.md 4 章）。
 */
import type { CatalogEntry } from './types.ts';

const WIP = '作業中（段階 4 の carry で作る）';

export const CARRY_CATALOG: CatalogEntry[] = [
  // ---- 2.10 物を運ぶ・置く ----
  { idea: 'I01', name: '水を運ぶ', status: 'deferred', impl: [], note: WIP },
  { idea: 'I02', name: '荷物と待つ扉', status: 'deferred', impl: [], note: WIP },
  { idea: 'I03', name: '本を集める', status: 'deferred', impl: [], note: WIP },
  { idea: 'I04', name: '椅子を戻す', status: 'deferred', impl: [], note: WIP },
  { idea: 'I05', name: '鍵ではない鍵', status: 'deferred', impl: [], note: WIP },
  { idea: 'I06', name: '落とし物を届ける', status: 'deferred', impl: [], note: WIP },
  { idea: 'I07', name: '電球を付け替える', status: 'deferred', impl: [], note: WIP },
  { idea: 'I08', name: '物を置くと増える', status: 'deferred', impl: [], note: WIP },
  {
    idea: 'I09', name: '置いた物が残る', status: 'done',
    impl: [{ kind: 'part', id: 'carryItem' }, { kind: 'part', id: 'carryBody' }, { kind: 'client', id: 'client/views/carry/persist.ts' }],
    note: '動かして置いた物の位置をフロアの id ごとに保存（localStorage。core/sim/parts/carry/persist.ts の carrySave / carryRestore）。次に同じフロアを作ったら、生成の後に部品の状態へ戻す（core は決定的なまま）。保存は {部品 id: [x, 底の y, z, yaw]} だけで小さい。フロアの id・生成器と調整表の版が違えば戻さない',
  },
  { idea: 'I10', name: '重さで開く', status: 'deferred', impl: [], note: WIP },
  { idea: 'I11', name: '運ぶと変わる物', status: 'deferred', impl: [], note: WIP },
  // ---- 4.7 裏の振る舞い: 物を運ぶ・置く ----
  { idea: 'BI01', name: '水を一滴もこぼさず満杯で運ぶ → 台が沈んで扉', status: 'deferred', impl: [], note: WIP },
  { idea: 'BI02', name: '待つ扉で違う荷物を持って待つ → 別の扉', status: 'deferred', impl: [], note: WIP },
  { idea: 'BI03', name: '本を 1 冊も集めない / 全部集める → それぞれ別の扉', status: 'deferred', impl: [], note: WIP },
  { idea: 'BI04', name: '椅子を全部どかす → 床下収納', status: 'deferred', impl: [], note: WIP },
  { idea: 'BI05', name: '物を全部同じ向きにそろえる → 壁の一部がずれる', status: 'deferred', impl: [], note: WIP },
  { idea: 'BI06', name: '拾った物を元の部屋に戻す → 戻した部屋に新しい扉', status: 'deferred', impl: [], note: WIP },
  // ---- 4.7 パズル（行き止まりの部屋。解くと隠し）----
  { idea: 'PZ01', name: '手がかりが別の部屋にある数字錠', status: 'deferred', impl: [], note: WIP },
  { idea: 'PZ02', name: '色の照明を混ぜて決まった色にする', status: 'deferred', impl: [], note: WIP },
  { idea: 'PZ03', name: '部屋中の時計の針を同じ時刻に合わせる', status: 'deferred', impl: [], note: WIP },
  { idea: 'PZ04', name: '床のタイルを入れ替えて絵を完成させる', status: 'deferred', impl: [], note: WIP },
  { idea: 'PZ05', name: '影絵: 照明と物の位置を合わせ、扉の形の影を作る', status: 'deferred', impl: [], note: WIP },
  { idea: 'PZ06', name: '鏡を並べて光を部屋の奥へ通す', status: 'deferred', impl: [], note: WIP },
  { idea: 'PZ07', name: '音の高さの順にベルを鳴らす', status: 'deferred', impl: [], note: WIP },
  { idea: 'PZ08', name: '家具の配置を壁の写真と同じにする', status: 'deferred', impl: [], note: WIP },
  { idea: 'PZ09', name: '重さの違う箱を天秤の両側で釣り合わせる', status: 'deferred', impl: [], note: WIP },
  { idea: 'PZ10', name: '迷路の模型で球を転がし、本物の迷路の隠し出口を知る', status: 'deferred', impl: [], note: WIP },
  { idea: 'PZ11', name: '消えた照明を、電球を運んで元の順に戻す', status: 'deferred', impl: [], note: WIP },
  { idea: 'PZ12', name: '足跡の模様どおりに床を踏む', status: 'deferred', impl: [], note: WIP },
  // ---- 2.15 自由に遊べるミニゲーム（脇の部屋。いつでも出られる・失敗は区間の最初へ・報酬なし・普通と違う遊び方で隠し）----
  { idea: 'U01', name: '球を穴に入れる（床を傾ける）', status: 'deferred', impl: [], note: WIP },
  { idea: 'U02', name: 'ボウリングの廊下', status: 'deferred', impl: [], note: WIP },
  { idea: 'U03', name: 'ゴルフの部屋（1 打で入れる）', status: 'deferred', impl: [], note: WIP },
  { idea: 'U04', name: '鬼ごっこする灯り', status: 'deferred', impl: [], note: WIP },
  { idea: 'U05', name: 'かくれんぼ（灯りが探しに来る）', status: 'deferred', impl: [], note: WIP },
  { idea: 'U06', name: 'ピンボールの吹き抜け（自分が球）', status: 'deferred', impl: [], note: WIP },
  { idea: 'U07', name: 'カートの坂', status: 'deferred', impl: [], note: WIP },
  { idea: 'U08', name: '的当て（物を投げる）', status: 'deferred', impl: [], note: WIP },
  { idea: 'U09', name: '記憶の部屋（10 秒見たあと照明が消え、同じ所に物を戻す）', status: 'deferred', impl: [], note: WIP },
  { idea: 'U10', name: '影絵（光と物を合わせて形を作る）', status: 'deferred', impl: [], note: WIP },
  { idea: 'U11', name: '音合わせ（ピアノの床）', status: 'deferred', impl: [], note: WIP },
  { idea: 'U12', name: '無重力の部屋で浮かぶ輪をくぐる', status: 'deferred', impl: [], note: WIP },
];
