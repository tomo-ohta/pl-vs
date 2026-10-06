/**
 * タブレットの決まり（client/tablet）: 探索のダイアル・撮影日時の表示・キーの割り当て・写真の保存と SNS の投稿（IndexedDB の無い所の入れ物）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { APPS, DIAL_DIGITS, DialModel, formatTaken, revealFov } from '../client/tablet/logic.ts';
import { actionsOf, copyKeymap, DEFAULT_KEYMAP, keyLabel, keysLabel } from '../client/input/keymap.ts';
import { PhotoStore } from '../client/tablet/PhotoStore.ts';
import { localPlayerId, PostStore } from '../client/tablet/PostStore.ts';
import { DEFAULT_PLAYER_NAME, playerName } from '../client/settings/playerName.ts';

test('タブレット: ホーム画面のアプリはカメラ・探索・マップ・SNS・ギャラリー・設定の順', () => {
  assert.deepEqual(APPS.map((a) => a.label), ['カメラ', '探索', 'マップ', 'SNS', 'ギャラリー', '設定']);
});

test('探索のダイアル: 数を入れる・前の 0・桁を回す（0〜9 で回る）', () => {
  const d = new DialModel(1328);
  assert.equal(d.digits.length, DIAL_DIGITS);
  assert.deepEqual(d.digits, [0, 0, 0, 0, 0, 1, 3, 2, 8]);
  assert.equal(d.value, 1328);
  assert.equal(d.text, '1328');
  assert.ok(d.leading(0) && d.leading(4) && !d.leading(5) && !d.leading(8));
  d.step(8, 1);
  assert.equal(d.value, 1329);
  d.step(8, 1);
  assert.equal(d.value, 1320, '9 の次は 0（上の桁は変えない）');
  d.step(5, -2);
  assert.equal(d.value, 9320, '1 から 2 戻すと 9（上の桁へ繰り下がらない）');
  assert.equal(new DialModel(0).leading(8), false, '0 の一の位は薄くしない');
  // 入りきらない上の桁は捨てる・負は 0
  assert.equal(new DialModel(12345678901).value, 345678901);
  assert.equal(new DialModel(-5).value, 0);
});

test('探索のダイアル: 数字キーは電卓のように右から入る。入れた・回した後の最初の数字は入れ直し。Backspace で 1 文字消す', () => {
  const d = new DialModel(774051);
  for (const ch of '1305') d.type(ch);
  assert.equal(d.value, 1305, '最初の数字で入れ直す');
  d.type('7');
  assert.equal(d.value, 13057, '続けて入れる');
  d.backspace();
  assert.equal(d.value, 1305);
  d.step(0, 1);
  d.type('9');
  assert.equal(d.value, 9, '回した後は入れ直す');
  for (const ch of '1234567890') d.type(ch);
  assert.equal(d.value, 234567890, '9 桁を超えたら上の桁を押し出す');
  d.type('x');
  assert.equal(d.value, 234567890, '数字でない物は入れない');
});

test('撮影日時の表示: 年/月/日 時:分（秒）', () => {
  const ms = new Date(2026, 9, 6, 9, 5, 7).getTime();
  assert.equal(formatTaken(ms), '2026/10/06 09:05');
  assert.equal(formatTaken(ms, true), '2026/10/06 09:05:07');
});

test('キーの割り当て: タブレットは Tab・戻るは Backspace。割り当てを差し替えると読み方も案内も変わる', () => {
  assert.deepEqual(DEFAULT_KEYMAP.tablet, ['Tab']);
  assert.ok(actionsOf(DEFAULT_KEYMAP, 'Tab').includes('tablet'));
  assert.ok(actionsOf(DEFAULT_KEYMAP, 'Backspace').includes('tabletBack'));
  assert.deepEqual(actionsOf(DEFAULT_KEYMAP, 'KeyW'), ['forward']);
  assert.equal(keyLabel('KeyE'), 'E');
  assert.equal(keyLabel('Digit1'), '1');
  assert.equal(keyLabel('Escape'), 'Esc');
  const m = copyKeymap();
  m.tablet = ['KeyT'];
  assert.deepEqual(DEFAULT_KEYMAP.tablet, ['Tab'], '写しを変えても既定は変わらない');
  assert.ok(actionsOf(m, 'KeyT').includes('tablet') && !actionsOf(m, 'Tab').includes('tablet'));
  assert.equal(keysLabel(m, 'tablet'), 'T');
});

test('写真の保存（IndexedDB の無い所）: 足す・新しい順の一覧・元の写真・消す・変わったら知らせる', async () => {
  const st = new PhotoStore(false);
  let changes = 0;
  st.onChange = () => { changes++; };
  const blob = (s: string): Blob => new Blob([s], { type: 'image/jpeg' });
  const a = await st.add({ takenAt: 1000, roomId: 1328, seed: 1, place: 'B1F', w: 1280, h: 720, look: 'clean' }, blob('A'), blob('a'));
  const b = await st.add({ takenAt: 2000, roomId: null, seed: 3, place: 'B2F 裏', w: 1280, h: 960, look: 'video' }, blob('B'), blob('b'));
  assert.ok(a.id !== b.id);
  const list = await st.list();
  assert.deepEqual(list.map((p) => p.id), [b.id, a.id], '新しい順');
  assert.equal(list[1]!.roomId, 1328);
  assert.equal(await (await st.image(a.id))!.text(), 'A');
  await st.remove(a.id);
  assert.deepEqual((await st.list()).map((p) => p.id), [b.id]);
  assert.equal(await st.image(a.id), null);
  assert.equal(changes, 3);
});

test('SNS の投稿（IndexedDB の無い所）: 新しく投稿した順・投稿した写真の id・写真を消しても投稿は残る・投稿を消す', async () => {
  const photos = new PhotoStore(false);
  const posts = new PostStore(false);
  const blob = (s: string): Blob => new Blob([s], { type: 'image/jpeg' });
  const a = await photos.add({ takenAt: 1000, roomId: 1328, seed: 1, place: 'B1F', w: 1280, h: 720, look: 'clean' }, blob('A'), blob('a'));
  const b = await photos.add({ takenAt: 2000, roomId: 774051, seed: 1, place: 'B6F', w: 1280, h: 960, look: 'video' }, blob('B'), blob('b'));
  const author = { id: localPlayerId(), name: playerName() };
  assert.equal(author.id, 'local', 'localStorage の無い所では local');
  assert.equal(author.name, DEFAULT_PLAYER_NAME);
  const post = async (p: typeof a, at: number): Promise<number> => (await posts.add({ postedAt: at, author, photoId: p.id, roomId: p.roomId, seed: p.seed, place: p.place, takenAt: p.takenAt, w: p.w, h: p.h, look: p.look }, (await photos.image(p.id))!, blob('t'))).id;
  const pb = await post(b, 5000);
  const pa = await post(a, 6000);
  const list = await posts.list();
  assert.deepEqual(list.map((p) => p.id), [pa, pb], '新しく投稿した順（撮った順ではない）');
  assert.deepEqual([...await posts.postedPhotoIds()].sort(), [a.id, b.id].sort());
  // ギャラリーの写真を消しても、投稿と画像は残る
  await photos.remove(b.id);
  assert.equal(await (await posts.image(pb))!.text(), 'B');
  assert.equal(list.find((p) => p.id === pb)!.roomId, 774051);
  // 投稿を消す
  await posts.remove(pa);
  assert.deepEqual((await posts.list()).map((p) => p.id), [pb]);
  assert.deepEqual([...await posts.postedPhotoIds()], [b.id]);
});


test('写真から移る: 写真を視界いっぱいに覆って見せたときに重なる世界の画角（縦横比・ズーム）', () => {
  // 同じ縦横比なら写真の画角のまま・写真が横に広い（左右が切れる）ときも縦の画角はそのまま
  assert.ok(Math.abs(revealFov(60, 16 / 9, 16 / 9) - 60) < 1e-9);
  assert.ok(Math.abs(revealFov(60, 16 / 9, 4 / 3) - 60) < 1e-9);
  // 写真が細い（縦長の写真を横長の画面で見る）と上下が切れるので、縦の画角が狭まる
  const f = revealFov(60, 9 / 16, 16 / 9);
  assert.ok(Math.abs(Math.tan((f * Math.PI) / 360) - Math.tan(Math.PI / 6) * (9 / 16) / (16 / 9)) < 1e-9);
  // ズームした写真（画角 20°）は 20°
  assert.ok(Math.abs(revealFov(20, 4 / 3, 4 / 3) - 20) < 1e-9);
});
