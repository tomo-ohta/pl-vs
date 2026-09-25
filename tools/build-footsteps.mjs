#!/usr/bin/env node
/**
 * 足音・動作音（第20回）: CC0 素材から床種ごとの一歩の音を作り、public/audio/steps/ に mp3（mono・44.1 kHz）と index.json を書き出す。
 *
 *   node tools/build-footsteps.mjs          # assets/cc0/audio/src の zip / 7z を展開して変換（ffmpeg が必要）
 *
 * 素材（すべて CC0。assets/cc0/audio/src に置く。git 管理外）:
 *   - kenney_impact-sounds.zip（kenney.nl Impact Sounds）: footstep_carpet / concrete / grass / snow / wood 各 5
 *   - kenney_rpg-audio.zip（kenney.nl RPG Audio）: cloth1〜4（ジャンプの衣擦れ・草木の擦れ）
 *   - sfx_100_v2.zip（OpenGameArt「100 CC0 SFX #2」）: footstep_wet / footstep_wood / metal
 *   - 100-CC0-SFX_0.zip（OpenGameArt「100 CC0 SFX」）: splash / metal
 *   - Fantozzi-footsteps.7z（OpenGameArt「Fantozzi's Footsteps (Grass/Sand & Stone)」）: Sand / Stone 各 6
 * 素材に無い床は近い素材を加工 / 重ねて作る（tile = 石畳・コンクリートの高域を持ち上げる、lino = 柔らかく、metal = コンクリート + 金属の打音、
 * asphalt = コンクリート + 砂、water = 濡れた一歩 + 水しぶき）。
 *
 * Adobe Audition の効果音（assets/adobe/audio/foley_footsteps.zip）があれば、硬い床・金属・木・雪・砂利・着地・擦れはそちらを使う（下の「Adobe」）。
 * 出力のキー（AssetManifest が index.json を読む）: step.<床種>.<n>、land.<床種>.<n>、move.jump.<n>、move.rustle.<n>、move.rustleTall.<n>。
 * 各ファイルは先頭の無音を削り、長さを揃え、体感の音量（100 ms 窓の RMS の最大）を TARGET ±0.5 dB に揃える。床ごとの音量は Sfx.ts の STEP_GAIN で調える
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'assets/cc0/audio/src');
const X = join(SRC, 'x');
const OUT = join(ROOT, 'public/audio/steps');

const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', ...args], { stdio: ['ignore', 'ignore', 'inherit'] });

// ---------------------------------------------------------------- 展開
const need = ['kenney_impact-sounds.zip', 'kenney_rpg-audio.zip', 'sfx_100_v2.zip', '100-CC0-SFX_0.zip', 'Fantozzi-footsteps.7z'];
for (const f of need) if (!existsSync(join(SRC, f))) { console.error(`素材がありません: ${join(SRC, f)}（README「足音」の入手先から取得）`); process.exit(1); }
mkdirSync(X, { recursive: true });
for (const f of need) {
  const dir = join(X, f.replace(/\.(zip|7z)$/, ''));
  if (existsSync(dir)) continue;
  mkdirSync(dir, { recursive: true });
  if (f.endsWith('.zip')) execFileSync('unzip', ['-oq', join(SRC, f), '-d', dir]);
  else execFileSync('tar', ['-xf', join(SRC, f), '-C', dir]);
}
const K = join(X, 'kenney_impact-sounds/Audio');
const R = join(X, 'kenney_rpg-audio/Audio');
const V2 = join(X, 'sfx_100_v2');
const C0 = join(X, '100-CC0-SFX_0');
const FZ = join(X, 'Fantozzi-footsteps/Fantozzi-footsteps/ogg');
const range = (n, f) => Array.from({ length: n }, (_, i) => f(i));
const pad = (i, w = 3) => String(i).padStart(w, '0');

// ---------------------------------------------------------------- 加工
/** 先頭の無音を削る → 追加のフィルター → 長さ・フェード → mono。 */
function shape(extra, maxDur) {
  return [
    'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.004',
    ...extra,
    `atrim=0:${maxDur}`,
    FADE_END,
  ].join(',');
}
/**
 * 実際の尻に 40 ms のフェード（第22回）: 以前は maxDur - 0.06 からのフェードで、それより短い区間（次の一歩の手前で切った区間）は
 * フェード無しで途切れていた。反転 → 頭にフェードイン → 反転 で長さによらず尻を丸める
 */
const FADE_END = 'areverse,afade=t=in:d=0.04,areverse';

/**
 * 体感の音量の目安（dBFS）: 100 ms 窓の RMS の最大（耳が大きさを積分する長さ。短い打音の 1 瞬の違いに引っ張られない）。
 * 第20回の 3 回目: 50 ms 窓 + 短い音 +3 dB では、ゲーム内で同じ床の一歩が 5.8 dB ばらついた
 */
const TARGET = -17;
function stats(file) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', '44100', '-f', 'f32le', '-'], { maxBuffer: 1 << 26 });
  const x = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
  const w = 4410;
  let loud = -120;
  if (x.length < w) { let e = 0; for (const v of x) e += v * v; loud = 10 * Math.log10(e / w + 1e-12); }
  for (let i = 0; i + w <= x.length; i += 441) { let e = 0; for (let j = i; j < i + w; j++) e += x[j] * x[j]; loud = Math.max(loud, 10 * Math.log10(e / w + 1e-12)); }
  return { loud };
}

/** 最大の打音の立ち上がりの位置（秒）。2 ms の包絡で最大から遡り、最大の 10% を下回った所 -3 ms */
function attackOffset(file) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', '44100', '-f', 'f32le', '-'], { maxBuffer: 1 << 26 });
  const x = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
  const w = 88, env = [];
  for (let i = 0; i + w <= x.length; i += w) { let m = 0; for (let j = i; j < i + w; j++) m = Math.max(m, Math.abs(x[j])); env.push(m); }
  let pk = 0; for (let i = 1; i < env.length; i++) if (env[i] > env[pk]) pk = i;
  let k = pk; while (k > 0 && env[k - 1] > env[pk] * 0.1) k--;
  return Math.max(0, (k * w) / 44100 - 0.003);
}

const entries = {};
let tmpN = 0;
function emit(key, inputs, filter, maxDur = 0.6) {
  const tmp = join(OUT, `.tmp${tmpN++}.wav`);
  const args = [];
  for (const i of inputs) {
    if (typeof i === 'string') args.push('-i', i);
    else args.push('-ss', i.ss.toFixed(3), '-t', i.t.toFixed(3), '-i', i.file);
  }
  // 長さは頭を揃えてから詰める（第22回。先に詰めると、頭をずらした分だけ尻が削れていた）
  const pre = maxDur + 0.4;
  if (inputs.length === 1) ff([...args, '-af', shape(filter, pre), '-ac', '1', '-ar', '44100', tmp]);
  else ff([...args, '-filter_complex', filter.join(';') + `;[mix]${shape([], pre)}[o]`, '-map', '[o]', '-ac', '1', '-ar', '44100', tmp]);
  // 頭を「一番大きい打音の立ち上がり」に揃える（第20回の 3 回目）: Adobe の録音は部屋の雑音があり silenceremove（-50 dB）が効かず、
  // 先頭に最大 177 ms の間が残っていた。靴の擦れなどの小さな前触れの 200 ms 後に本体が来る歩もあった → 一歩ごとに鳴り出しが
  // 0〜230 ms ずれて「鳴ったり鳴らなかったり」「二重」に聞こえた。最大の打音から遡り、2 ms 包絡が最大の 10% を下回った所 -3 ms を頭にする
  {
    // 擦れ（noAlign）は連続音なので頭を動かさない
    const off = inputs.some((i) => typeof i !== 'string' && i.noAlign) ? 0 : attackOffset(tmp);
    {
      const tmp2 = tmp.replace(/\.wav$/, 'b.wav');
      ff(['-i', tmp, '-af', `atrim=start=${off.toFixed(4)},asetpts=PTS-STARTPTS,atrim=0:${maxDur},${FADE_END}`, tmp2]);
      rmSync(tmp);
      execFileSync('mv', [tmp2, tmp]);
    }
  }
  // 音量: 体感に近い 100 ms 窓の RMS の最大を TARGET に揃える（stats）。最後にリミッターでピーク -1 dBFS まで
  const st = stats(tmp);
  let gain = TARGET - st.loud;
  const name = `${key}.mp3`;
  // リミッター（ピーク -1 dBFS）で下がった分は測り直して 2 回まで詰める（仕上がりを TARGET ±0.5 dB に）
  for (let pass = 0; pass < 3; pass++) {
    ff(['-i', tmp, '-af', `volume=${gain.toFixed(2)}dB,alimiter=limit=0.89:attack=1:release=30:level=disabled`, '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '112k', join(OUT, name)]);
    const err = TARGET - stats(join(OUT, name)).loud;
    if (Math.abs(err) <= 0.5) break;
    gain += err;
  }
  rmSync(tmp);
  entries[key] = `steps/${name}`;
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// 床種ごとの素材
const concrete = [...range(5, (i) => join(K, `footstep_concrete_${pad(i)}.ogg`)), ...['L1', 'L2', 'L3', 'R1', 'R2', 'R3'].map((s) => join(FZ, `Fantozzi-Stone${s}.ogg`))];
const sand = ['L1', 'L2', 'L3', 'R1', 'R2', 'R3'].map((s) => join(FZ, `Fantozzi-Sand${s}.ogg`));
const metals = [join(V2, 'sfx100v2_metal_01.ogg'), join(V2, 'sfx100v2_metal_02.ogg'), join(V2, 'sfx100v2_metal_04.ogg'), join(V2, 'sfx100v2_metal_05.ogg')];
const wets = range(3, (i) => join(V2, `sfx100v2_footstep_wet_0${i + 1}.ogg`));
const splashes = [join(C0, 'splash_01.ogg'), join(C0, 'splash_02.ogg')];

// 床ごとに素材は 1 系統（第20回の 2 回目。Kenney の鈍く短い「コツ」と Fantozzi の石畳の明るい「ザリッ」を同じ床で混ぜていて、
// 一歩ごとに入れ替わる音が「二重」に聞こえた）。硬い床は長さと音色が揃う Fantozzi の石畳から加工する
const stone = concrete.slice(5); // Fantozzi Stone L1〜R3
// コンクリート: 石畳のざらつきを少し丸め、低めの芯を足す
stone.forEach((f, i) => emit(`step.concrete.${i}`, [f], ['highpass=f=70', 'lowpass=f=7000', 'equalizer=f=300:t=q:w=1:g=3', 'equalizer=f=4000:t=q:w=1.5:g=-4'], 0.32));
range(5, (i) => emit(`step.carpet.${i}`, [join(K, `footstep_carpet_${pad(i)}.ogg`)], ['lowpass=f=6000'], 0.3));
range(5, (i) => emit(`step.grass.${i}`, [join(K, `footstep_grass_${pad(i)}.ogg`)], [], 0.4));
range(5, (i) => emit(`step.snow.${i}`, [join(K, `footstep_snow_${pad(i)}.ogg`)], [], 0.45));
// 木: 長さのある OpenGameArt の木の一歩だけ（Kenney の木は 30 ms の鈍い打音で、混ぜると音量と音色が揃わなかった）
range(4, (i) => emit(`step.wood.${i}`, [join(V2, `sfx100v2_footstep_wood_0${i + 1}.ogg`)], ['highpass=f=60', 'equalizer=f=250:t=q:w=1:g=2'], 0.36));
// タイル: 硬い床に踵が当たる明るさ（高域 +5 dB、低域を切る、短く）
stone.forEach((f, i) => emit(`step.tile.${i}`, [f], ['highpass=f=200', 'equalizer=f=3200:t=q:w=1.2:g=5', 'equalizer=f=1200:t=q:w=1:g=2'], 0.24));
// リノリウム: ゴム底が張り付く柔らかさ（高域を大きく丸め、中域を少し）
stone.forEach((f, i) => emit(`step.lino.${i}`, [f], ['highpass=f=100', 'lowpass=f=3000', 'equalizer=f=700:t=q:w=1:g=4'], 0.24));
// 砂利・土: 砂の一歩
sand.forEach((f, i) => emit(`step.gravel.${i}`, [f], [], 0.45));
// アスファルト: 石畳そのまま（屋外の硬い路面）
stone.forEach((f, i) => emit(`step.asphalt.${i}`, [f], ['highpass=f=80', 'lowpass=f=9000'], 0.34));
// 金属（キャットウォーク・グレーチング・籠）: 石畳の一歩 + 金属の打音（-12 dB、高域のみ、短く）。重ねる打音は一歩の立ち上がりに揃える
stone.forEach((f, i) => emit(`step.metal.${i}`, [f, metals[i % metals.length]], ['[0]highpass=f=120,lowpass=f=6000[a]', '[1]silenceremove=start_periods=1:start_threshold=-40dB,atrim=0:0.3,afade=t=out:st=0.15:d=0.15,highpass=f=900,volume=-12dB[b]', '[a][b]amix=inputs=2:normalize=0[mix]'], 0.4));
// 濡れた床
wets.forEach((f, i) => emit(`step.wet.${i}`, [f], ['highpass=f=80'], 0.4));
// 水の中（浅い水を歩く）: 濡れた一歩 + 水しぶき（-9 dB、丸めて）
// 水の中（浅い水を歩く）。第22回の 3 回目: 流れる水の録音を重ねた版は「洗濯機を回す音」に聞こえた（続く撹拌音）→ 使わない。
// 一歩 = 踵の濡れた接地（丸めて小さく）+ 25 ms 後の短い水しぶき（音程 -2〜-12%・5 kHz 以下・0.12 s から 0.25 s で消える）。
// 足首までの水を踏む「ジャブッ」の長さ（0.35 s）に収め、尾を引かない。素材: 100 CC0 SFX の splash 2 本 × 開始位置と音程で 6 変種
const rates = [0.98, 0.9, 0.94, 0.88, 1.0, 0.92];
range(6, (i) => emit(`step.water.${i}`, [wets[i % wets.length], splashes[i % splashes.length]], [
  '[0]highpass=f=90,lowpass=f=3800,volume=-6dB[a]',
  `[1]atrim=${(Math.floor(i / 2) * 0.03).toFixed(2)}:0.5,asetpts=PTS-STARTPTS,asetrate=${Math.round(44100 * rates[i])},aresample=44100,highpass=f=120,lowpass=f=5000,afade=t=out:st=0.12:d=0.25,adelay=25:all=1[b]`,
  '[a][b]amix=inputs=2:normalize=0[mix]'], 0.42));
// ジャンプの踏み切り（衣擦れ）
range(4, (i) => emit(`move.jump.${i}`, [join(R, `cloth${i + 1}.ogg`)], ['highpass=f=250'], 0.3));
// 草木を通り抜ける擦れ（衣擦れを明るく・長めに）
range(4, (i) => emit(`move.rustle.${i}`, [join(R, `cloth${i + 1}.ogg`)], ['highpass=f=900', 'equalizer=f=5000:t=q:w=1:g=4'], 0.55));


// ---------------------------------------------------------------- Adobe Audition の効果音（あれば優先。第20回の 3 回目）
// assets/adobe/audio/foley_footsteps.zip（download.adobe.com。Adobe のライセンス: 作品への組み込み可・単体配布不可・帰属不要）。
// 連続した歩行の録音なので、立ち上がりを検出して一歩ずつ切り出し、音量が中央値に近い（±2.5 dB）ものを選ぶ
const ADOBE_ZIP = join(ROOT, 'assets/adobe/audio/foley_footsteps.zip');
const AX = join(ROOT, 'assets/adobe/audio/x/Foley Footsteps');
const adobe = existsSync(ADOBE_ZIP);
if (adobe && !existsSync(AX)) { mkdirSync(join(ROOT, 'assets/adobe/audio/x'), { recursive: true }); execFileSync('unzip', ['-oq', ADOBE_ZIP, '-d', join(ROOT, 'assets/adobe/audio/x')]); }
const A = (name) => join(AX, `Foley Footstep ${name}.wav`);

/**
 * 録音の中の一歩ずつの区間（立ち上がり: 5 ms 窓で 20 ms 前より +12 dB、上位 1% から -24 dB 以内、minGap 以上離れる）。
 * 第22回: 一歩は「踵 → つま先」の 2 打で、大きい方が踵のことも つま先のこともある（ゲームの一歩は 0.2〜0.25 s 間隔なので 2 打を続けて鳴らすと忙しい）。
 * 区間の頭は一番大きい打音の立ち上がり（-3 ms）に揃え、尻は後ろの打音（最大 -18 dB 以上）の手前で切る。first = 一番大きい打音が区間の最初の打音か
 * （踵が大きい歩 / つま先が大きい歩。混ぜると音色が一歩ごとに変わるので pickSteps が多い方だけ使う）。
 * 以前は区間の頭（小さい方の打音）で切ってから長さを詰め、そのあと頭を大きい打音へずらしていたので、多くの歩が 0.06〜0.2 s に
 * 削れて途切れ、2 打が残った歩だけ「質感の違う音」に聞こえた
 */
function sliceSteps(file, { maxDur = 0.45, minGap = 0.28, single = true, align = true } = {}) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', '44100', '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  const x = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
  // win = 包絡 1 点の秒（220 サンプル = 4.99 ms。0.005 と丸めると 20 s の録音の尻で 45 ms ずれ、区間の頭が打音の後ろに来ていた）
  const sr = 44100, w = Math.floor(sr * 0.005), win = w / sr, env = [];
  for (let i = 0; i + w <= x.length; i += w) { let e = 0; for (let j = i; j < i + w; j++) e += x[j] * x[j]; env.push(10 * Math.log10(e / w + 1e-12)); }
  const top = [...env].sort((a, b) => b - a)[Math.floor(env.length * 0.01)];
  const on = [];
  for (let i = 4; i < env.length; i++) if (env[i] - env[i - 4] > 12 && env[i] > top - 24 && (!on.length || (i - on[on.length - 1]) * win > minGap)) on.push(i);
  return on.map((i, k) => {
    const next = k + 1 < on.length ? on[k + 1] : env.length;
    // 擦れ（single = false）は連続音なので従来どおり立ち上がりから次の一歩の手前まで
    if (!single) {
      const ss = Math.max(0, (i - 2) * win), end = Math.min((next - 6) * win, ss + maxDur);
      const A = Math.floor(ss * sr), B = Math.floor(end * sr);
      let loud = -120;
      for (let j = A; j + 2205 <= B; j += 441) { let e = 0; for (let t = j; t < j + 2205; t++) e += x[t] * x[t]; loud = Math.max(loud, 10 * Math.log10(e / 2205 + 1e-12)); }
      return { file, ss, t: end - ss, loud, first: true, noAlign: !align };
    }
    let im = i;
    for (let j = Math.max(0, i - 2); j < next; j++) if (env[j] > env[im]) im = j;
    const mx = env[im];
    // 大きい打音の立ち上がり: 最大から遡り、最大 -20 dB を下回った所
    let a0 = im;
    while (a0 > i - 2 && a0 > 0 && env[a0 - 1] > mx - 20) a0--;
    // 後ろの打音（局所最大で、直前 10〜40 ms の谷から +6 dB 立ち上がる）の手前で切る
    let cut = next - 2;
    for (let j = im + 8; j < next - 1; j++) {
      let valley = Infinity;
      for (let q = j - 8; q <= j - 2; q++) valley = Math.min(valley, env[q]);
      if (env[j] >= env[j - 1] && env[j] >= env[j + 1] && env[j] - valley > 6 && env[j] > mx - 18) { cut = j - 3; break; }
    }
    // 一番大きい打音より前に、最大 -18 dB 以上の打音があるか（= つま先が大きい歩）
    let first = true;
    for (let j = Math.max(1, i - 2); j < a0 - 2; j++) if (env[j] > mx - 18 && env[j] >= env[j - 1] && env[j] >= env[j + 1]) { first = false; break; }
    const ss = Math.max(0, a0 * win - 0.003);
    const end = Math.min(cut * win, ss + maxDur);
    const A = Math.floor(ss * sr), B = Math.floor(end * sr);
    let loud = -120;
    for (let j = A; j + 2205 <= B; j += 441) { let e = 0; for (let t = j; t < j + 2205; t++) e += x[t] * x[t]; loud = Math.max(loud, 10 * Math.log10(e / 2205 + 1e-12)); }
    return { file, ss, t: end - ss, loud, first };
  });
}
/**
 * 音量が中央値に近い（±3.5 dB）区間を n 個（録音の頭と尻の 1 歩は歩き出し・止まりなので除く）。0.1 s（擦れは 0.25 s）に満たない区間は使わず、
 * 一打の歩（single）は「踵が大きい歩 / つま先が大きい歩」の多い方だけ（混ぜると一歩ごとに音色が変わる）
 */
function pickSteps(files, n, opts = {}) {
  let all = files.flatMap((f) => { const st = sliceSteps(f, opts); return st.length > 4 ? st.slice(1, -1) : st; }).filter((s) => s.t >= (opts.single === false ? 0.25 : 0.1));
  if (opts.single !== false) { const nFirst = all.filter((s) => s.first).length; all = all.filter((s) => s.first === nFirst * 2 >= all.length); }
  // 同じ歩の重複を除く（革靴・セメントの録音は後半が前半の繰り返しで、同じ一歩が 2 つずつ選ばれていた）
  const seen = new Set();
  all = all.filter((s) => { const key = `${s.file}|${s.loud.toFixed(1)}`; if (seen.has(key)) return false; seen.add(key); return true; });
  const med = [...all].sort((a, b) => a.loud - b.loud)[Math.floor(all.length / 2)]?.loud ?? -20;
  return all.filter((s) => Math.abs(s.loud - med) <= 3.5).sort((a, b) => Math.abs(a.loud - med) - Math.abs(b.loud - med)).slice(0, n);
}
/** 着地: ジャンプの録音の中で一番大きい区間（踏み切りより着地が大きい） */
function pickLand(files) {
  return files.flatMap((f) => { const st = sliceSteps(f, { maxDur: 0.6, minGap: 0.5, single: false }); return st.length ? [st.reduce((a, b) => (b.loud > a.loud ? b : a))] : []; });
}

if (adobe) {
  for (const k of Object.keys(entries)) {
    if (/^step\.(concrete|tile|lino|asphalt|metal|wood|snow|gravel)\./.test(k) || /^move\.rustle\./.test(k)) { rmSync(join(OUT, entries[k].replace(/^steps\//, '')), { force: true }); delete entries[k]; }
  }
  // 硬い床: 革靴でセメントを歩く（26 歩。かかとの締まった「コツ」）。床ごとに音色だけ変える（素材は 1 系統）
  const cement = pickSteps([A('Hard Sole Dress Shoe Walking On Cement 02')], 10);
  cement.forEach((st, i) => emit(`step.concrete.${i}`, [st], ['highpass=f=60', 'equalizer=f=250:t=q:w=1:g=2'], 0.4));
  // タイル: 第22回の 2 回目で高域の持ち上げを +5 → +1.5 dB・上端 8 kHz に（「コツコツ」が耳に付いた）
  cement.forEach((st, i) => emit(`step.tile.${i}`, [st], ['highpass=f=120', 'equalizer=f=3000:t=q:w=1.2:g=1.5', 'lowpass=f=8000'], 0.34));
  cement.forEach((st, i) => emit(`step.lino.${i}`, [st], ['highpass=f=90', 'lowpass=f=2600', 'equalizer=f=700:t=q:w=1:g=3'], 0.28));
  cement.forEach((st, i) => emit(`step.asphalt.${i}`, [st], ['highpass=f=70', 'lowpass=f=9000'], 0.4)); // 高域を持ち上げると後ろの小さな擦れが最大になる歩があった
  // 金属の足場 / 木の台（同じ革靴）
  pickSteps([A('Hard Sole Dress Shoe Walking On Metal Platform 01'), A('Hard Sole Dress Shoe Metal Surface Running 01')], 8).forEach((st, i) => emit(`step.metal.${i}`, [st], ['highpass=f=80'], 0.45));
  pickSteps([A('Hard Sole Dress Shoe Walking On Wood Platform 01')], 10).forEach((st, i) => emit(`step.wood.${i}`, [st], ['highpass=f=60'], 0.4));
  // 雪: ブーツで岩塩（粒が潰れるザクッ）/ 砂利・土: ブーツで土と小石
  pickSteps([A('Boots Walking On Rock Salt 02')], 8, { single: false }).forEach((st, i) => emit(`step.snow.${i}`, [st], ['highpass=f=90'], 0.45));
  const dirt = pickSteps([A('Cowboy Boots Dirt Debris Waking 02'), A('Cowboy Boots Dirt Debris Waking Short 01')], 8, { single: false });
  (dirt.length >= 4 ? dirt : []).forEach((st, i) => emit(`step.gravel.${i}`, [st], ['highpass=f=80'], 0.45));
  if (dirt.length < 4) sand.forEach((f, i) => emit(`step.gravel.${i}`, [f], [], 0.45));
  // 着地（同じ革靴で各床に飛び降りる）
  pickLand([A('Hard Sole Dress Shoe Jump On Cement 01'), A('Hard Sole Dress Shoe Jump On Cement 03')]).forEach((st, i) => emit(`land.concrete.${i}`, [st], ['highpass=f=50'], 0.55));
  pickLand([A('Hard Sole Dress Shoe Jump On Metal Platform 01'), A('Hard Sole Dress Shoe Jump On Metal Platform 02'), A('Hard Sole Dress Shoe Jump On Metal Platform 03')]).forEach((st, i) => emit(`land.metal.${i}`, [st], ['highpass=f=50'], 0.6));
  pickLand([A('Hard Sole Dress Shoe Jump On Solid Wood Platform 01'), A('Hard Sole Dress Shoe Jump On Wood Platform 01'), A('Hard Sole Dress Shoe Jump On Wood Board Walk 01')]).forEach((st, i) => emit(`land.wood.${i}`, [st], ['highpass=f=50'], 0.55));
  // 草木を抜ける擦れ（茂み）/ 麦・背の高い草の中（トウモロコシ畑）
  pickSteps([A('Human Walk Through Brush 01'), A('Human Walking Through Brush 01'), A('Human Walking Through Brush 02')], 6, { maxDur: 0.6, single: false, align: false }).forEach((st, i) => emit(`move.rustle.${i}`, [st], ['highpass=f=300'], 0.55));
  pickSteps([A('Human Walk Through Cornstalk 01'), A('Human Walking Through Tall Grass 01')], 6, { maxDur: 0.6, single: false, align: false }).forEach((st, i) => emit(`move.rustleTall.${i}`, [st], ['highpass=f=300'], 0.55));
}

writeFileSync(join(OUT, 'index.json'), JSON.stringify(entries, null, 1));
const n = Object.keys(entries).length;
const bytes = readdirSync(OUT).filter((f) => f.endsWith('.mp3')).reduce((a, f) => a + execFileSync('stat', ['-f', '%z', join(OUT, f)], { encoding: 'utf8' }).trim() * 1, 0);
console.log(`steps: ${n} files, ${(bytes / 1024).toFixed(0)} KB → ${OUT}`);
