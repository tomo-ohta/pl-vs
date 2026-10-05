import { test } from 'node:test';
import assert from 'node:assert/strict';
// どれも import の時点で Web Audio に触れない（AudioContext は unlock() まで作らない）。ここで投げればこのファイル全体が失敗する
import { AudioEngine, VOICE_BUDGET } from '../client/audio/AudioEngine.ts';
import { EventLog } from '../client/audio/EventLog.ts';
import { LoudnessSource } from '../client/audio/LoudnessSource.ts';
import { LAYER_IDS, mapPreset, resetPresetWarnings } from '../client/audio/presetMap.ts';
import { RT60_STEPS, estimateRT60, quantizeRT60 } from '../client/audio/Reverb.ts';
import { SFX_KINDS, doorMatOf, floorKindOf } from '../client/audio/Sfx.ts';
import { DEFAULT_SEND, LAYER_BUILDERS } from '../client/audio/Synth.ts';
import { QUALITY_TIERS } from '../client/render/quality.ts';
import { Settings } from '../client/settings/Settings.ts';

const DB = (db: number): number => Math.pow(10, db / 20);

/** console.warn を記録して黙らせる（Node には Web Audio が無いので unlock は警告を出す） */
function captureWarn<T>(fn: () => T): { result: T; warnings: string[] } {
  const warnings: string[] = [];
  const orig = console.warn;
  console.warn = (...args: unknown[]) => { warnings.push(args.map(String).join(' ')); };
  try {
    return { result: fn(), warnings };
  } finally {
    console.warn = orig;
  }
}

/** v2 の CellLayout の形（core/world/layout.ts）。AudioEngine が読むのは bounds と palette だけ */
const cell = {
  id: 'c1', role: 'hub', bounds: { min: [0, 0, 0], max: [8, 3, 6] }, footprint: [], height: 3, floorY: 0,
  palette: { floor: 'floorCarpetGrey', wall: 'wallBeige', ceiling: 'ceilingTile', door: 'doorMetal', light: 'lightPanel', lightColor: 0xffffff, lightIntensity: 1, ambient: 0.3, fog: 0x202020 },
  boxes: [], lights: [], zones: [], audioPreset: '空調・蛍光灯',
};

test('new AudioEngine() は AudioContext を作らず、開始前の呼び出しは何もしない', () => {
  assert.equal(typeof (globalThis as { AudioContext?: unknown }).AudioContext, 'undefined');
  // Settings を作ると localStorage を見るので差し替えておく（Node 26 の localStorage は警告を出す）
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: () => null, setItem: () => {} };
  const settings = Settings.load();
  const audio = new AudioEngine(settings);
  assert.equal(audio.context, null);
  assert.equal(audio.ready, false);
  assert.equal(audio.now, 0);
  assert.equal(audio.debug(), 'audio: not unlocked');

  // 開始前でも投げない（何も鳴らない）
  audio.footstep(undefined, 'walk');
  audio.footstep('floorTile', 'dash', true, false, [1, 0, 2]);
  audio.land(6);
  audio.jump();
  audio.rustle(0.5, undefined, true);
  audio.door('open');
  audio.elevator('bell');
  audio.ui('click');
  const h = audio.play('pageTurn', { pos: [0, 1, 0] });
  assert.equal(h.active, false);
  h.stop();
  assert.equal(audio.beacon('phoneRing', [0, 0, 0]).active, false);
  audio.setListener([0, 1.6, 0], 0.3, -0.1);
  audio.update(1 / 60);
  assert.equal(audio.ambientLevel, 0);
  assert.equal(audio.stepBoost, 1); // 環境音の実測が無い（-80 dB）ので持ち上げない

  // 区画（CellLayout）を渡せる。開始前は保留し、床材と環境音のラベルは先に変わる
  audio.setRoom({ audioPreset: cell.audioPreset, layoutHints: ['reverbHigh'] }, cell as never, QUALITY_TIERS.low, { roomId: cell.id });
  assert.equal(audio.currentFloor, 'carpet');
  assert.equal(audio.currentPreset, '空調・蛍光灯');
  audio.setRoom(null, { ...cell, palette: { ...cell.palette, floor: 'floorTile' } } as never, undefined, { wet: true });
  assert.equal(audio.currentFloor, 'wet');
  assert.equal(audio.currentPreset, '空調・蛍光灯'); // info = null は環境音をそのまま
  audio.setNeighborLeak({ audioPreset: '雨音' }, [0, 0, 0], false);
  audio.clearNeighborLeak();

  // 設定の変更（音量）は ctx が無くても投げない
  settings.set({ masterVolume: 0.8, sfxVolume: 0.5 });
  audio.setVolumes({ ambientVolume: 0.3 });
  audio.setTier(QUALITY_TIERS.high);

  // Node には Web Audio が無い: unlock は警告して無音のまま
  const { warnings } = captureWarn(() => audio.unlock());
  assert.equal(audio.context, null);
  assert.ok(warnings.some((w) => w.includes('Web Audio')));

  // マイクの代わり: 移動から作る音量
  assert.ok(Math.abs(audio.loudnessLevel('walk') - 0.35) < 1e-9);
  audio.clearRoom();
  audio.dispose();
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

test('ボイス予算は v1 と同じ（low 8 / mid 12 / high 20）', () => {
  assert.deepEqual(VOICE_BUDGET, { low: 8, mid: 12, high: 20 });
});

test('すべての環境音レイヤーに合成の作り方がある', () => {
  for (const id of LAYER_IDS) assert.equal(typeof LAYER_BUILDERS[id], 'function', id);
  assert.equal(DEFAULT_SEND.reverbTail, 0.9);
  assert.ok(SFX_KINDS.includes('phoneRing'));
});

test('audioPreset のラベルを環境音レイヤーに写す（presetMap）', () => {
  assert.deepEqual(mapPreset('空調').layers, [{ id: 'hvac', gain: 1 }]);

  // 「遠い」= -8 dB + lowpass 1.2 kHz + reverbSend 0.7
  const far = mapPreset('遠い列車');
  assert.equal(far.layers.length, 1);
  assert.equal(far.layers[0].id, 'distantTrain');
  assert.ok(Math.abs(far.layers[0].gain - DB(-8)) < 1e-9);
  assert.equal(far.layers[0].lowpassHz, 1200);
  assert.equal(far.layers[0].reverbSend, 0.7);

  // 複数音源・長いキーワードから先に（換気扇 → ventFan、空調ハム → hvac + electricHum）。「静かな」= -10 dB
  const multi = mapPreset('換気扇・静かな空調ハム');
  assert.deepEqual(multi.layers.map((l) => l.id), ['ventFan', 'hvac', 'electricHum']);
  assert.ok(Math.abs(multi.layers[1].gain - DB(-10)) < 1e-9);

  // 修飾: 低い / 局所的な / 幻聴
  assert.equal(mapPreset('低い機械音').layers[0].pitchOct, -1);
  assert.equal(mapPreset('局所的な雨音').layers[0].localized, true);
  const ph = mapPreset('水滴幻聴').layers[0];
  assert.equal(ph.id, 'waterDrip');
  assert.deepEqual(ph.phantom, { meanIntervalSec: 20, probability: 0.5 });
  assert.equal(ph.gain, 0.5);

  // A→B: 30 秒後に B へ
  const seq = mapPreset('空調→雨音');
  assert.deepEqual(seq.layers.map((l) => l.id), ['hvac']);
  assert.equal(seq.followUp?.afterSec, 30);
  assert.deepEqual(seq.followUp?.layers.map((l) => l.id), ['rain']);

  // 無音・反響の下限・メタ指定・空
  const silent = mapPreset('無音に近い');
  assert.equal(silent.silent, true);
  assert.deepEqual(silent.layers.map((l) => l.id), ['subRumble']);
  const hall = mapPreset('広い反響');
  assert.equal(hall.reverbFloorSec, 2.5);
  assert.deepEqual(hall.layers.map((l) => l.id), ['reverbTail']);
  assert.equal(mapPreset('巨大反響').reverbFloorSec, 4.0);
  assert.equal(mapPreset('年代別環境音').meta, 'era');
  assert.deepEqual(mapPreset('').layers, [{ id: 'hvac', gain: 0.32 }]);

  // 写せない断片は hvac に置き換えて 1 回だけ警告する
  resetPresetWarnings();
  const { result, warnings } = captureWarn(() => [mapPreset('ぬるぬる'), mapPreset('ぬるぬる')]);
  assert.deepEqual(result[0].unmapped, ['ぬるぬる']);
  assert.deepEqual(result[0].layers, [{ id: 'hvac', gain: 0.5 }]);
  assert.equal(warnings.length, 1);
});

test('残響の長さを区画の大きさと材質から見積もる（Reverb）', () => {
  assert.equal(quantizeRT60(1.0), 0.8);
  assert.equal(quantizeRT60(3.4), 4.0);
  assert.equal(quantizeRT60(0.1), 0.4);
  const concrete = { floor: 'floorConcrete', wall: 'wallConcrete', ceiling: 'ceilingWhite' } as const;
  const box = { min: [0, 0, 0] as [number, number, number], max: [10, 4, 10] as [number, number, number] };
  // V = 400、吸音 = 100·0.05 + 100·0.1 + 160·0.05 = 23 → 0.161·400/23 ≈ 2.8 s → 2.5 s の段
  const e = estimateRT60(box, concrete);
  assert.ok(Math.abs(e.rt60 - (0.161 * 400) / 23) < 1e-9);
  assert.equal(e.quantized, 2.5);
  assert.ok(Math.abs(e.preDelay - 4 / 343) < 1e-12);
  assert.equal(estimateRT60(box, concrete, { hints: ['reverbHigh'] }).quantized, 4.0); // ×1.6
  assert.equal(estimateRT60(box, { floor: 'floorCarpetGrey', wall: 'wallBeige', ceiling: 'ceilingTile' }).quantized, 0.8);
  assert.equal(estimateRT60(box, concrete, { floorSec: 4 }).quantized, 4.0);
  // v2 の区画をそのまま渡せる
  assert.ok(RT60_STEPS.includes(estimateRT60(cell.bounds as never, cell.palette as never).quantized));
});

test('床材と扉の材質から足音・扉の音の種類を選ぶ（Sfx）', () => {
  assert.equal(floorKindOf('floorCarpetRed'), 'carpet');
  assert.equal(floorKindOf('floorTile'), 'tile');
  assert.equal(floorKindOf('metalDark'), 'metal');
  assert.equal(floorKindOf('waterShallow'), 'water');
  assert.equal(floorKindOf('floorAsphalt'), 'asphalt');
  assert.equal(floorKindOf('wheat'), 'grass');
  assert.equal(floorKindOf('somethingNew'), 'concrete');
  assert.equal(floorKindOf('floorWood', true), 'wet');
  assert.equal(doorMatOf('doorMetal'), 'metal');
  assert.equal(doorMatOf('glass'), 'glass');
  assert.equal(doorMatOf('doorWood'), 'wood');
});

test('効果音の記録（EventLog）と移動から作る音量（LoudnessSource）', () => {
  const log = new EventLog(60, 4);
  for (let t = 0; t < 6; t++) log.push({ kind: `k${t}`, t });
  assert.equal(log.size, 4); // 上限
  assert.deepEqual(log.between(5, 3, 1).map((e) => e.kind), ['k2', 'k3']);
  assert.deepEqual(log.recent(5, 1).map((e) => e.kind), ['k4', 'k5']);
  log.prune(64.5);
  assert.deepEqual(log.recent(64.5, 100).map((e) => e.kind), ['k5']);

  const loud = new LoudnessSource(() => null);
  assert.equal(loud.level(), 0);
  assert.equal(loud.movementLoudness('dash'), 0.7);
  loud.update(0.2);
  assert.ok(Math.abs(loud.level() - 0.4) < 1e-9);
  assert.equal(loud.movementLoudness('still', true), 1);
  assert.equal(loud.micAvailable, false);
});
