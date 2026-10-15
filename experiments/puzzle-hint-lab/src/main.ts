/**
 * 入口: URL の値を読み、フォントを待ってから世界を作って始める。
 * - ?seed=1015 … 世界の seed（同じ seed なら同じ地図・謎・ヒント）
 * - ?tablet=holo|glass … タブレットの見せ方（既定は設定。初めは holo）
 * - ?h1=50&h2=75&h3=95 … ヒント 1 / 2 / 3 を解放する制圧の部屋の数
 * - ?test=1 … Pointer Lock を使わない（自動の確かめ用。見回しはできない）
 */
import './ui/style.css';
import { App } from './App.ts';
import { HINT_THRESHOLDS } from './gen/progress.ts';
import { generateWorld } from './gen/world.ts';
import { loadSettings } from './ui/settings.ts';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed')) || 1015;
const thresholds = HINT_THRESHOLDS.map((t, i) => {
  const v = Number(params.get(`h${i + 1}`));
  return v > 0 ? v : t;
});

const world = generateWorld(seed);

/** 画面の絵に使う文字（Google Fonts の日本語は文字の範囲ごとに読むので、使う文字を先に読ませる） */
const UI_TEXT =
  '全体マップヒント今いる部屋踏破制圧未済み難易度状態謎ボタン個押せば決まった順に押す（全部押すと判定）次の解放あと集計凡例現在地段階すべてを解放済み' +
  'ヒントは全部屋の制圧数で解放抽象具体核心で解放部屋進行率＝：・';
const texts = [UI_TEXT, ...world.hints.flat(), ...world.puzzles.flatMap((p) => p.clues.flatMap((c) => (c.kind === 'words' ? c.words : [])))].join('');
const fonts = [
  `600 30px "Chakra Petch"`,
  `400 30px "Chakra Petch"`,
  `400 30px "Share Tech Mono"`,
  `500 30px "Zen Kaku Gothic New"`,
  `700 30px "Zen Kaku Gothic New"`,
];
await Promise.race([
  Promise.all(fonts.map((f) => document.fonts.load(f, f.includes('Zen') ? texts : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/%'))).catch(() => {}),
  new Promise((r) => setTimeout(r, 3500)),
]);

const app = new App(document.getElementById('app')!, world, { thresholds, settings: loadSettings(params), test: params.has('test') });
// 開発・撮影用の窓口（tools/shot.mjs は __phlReady を待つ）
Object.assign(window, { app, __phlReady: true });
