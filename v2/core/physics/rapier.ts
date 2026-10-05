/**
 * Rapier（決定論版）の読み込み。core から使うのでブラウザでも Node（ヘッドレスの検査）でも動く。
 *
 * @dimforge/rapier3d-deterministic-compat は WASM を JS に埋め込んだ版。バンドラの WASM 設定が要らず、
 * 同じ版・同じ初期条件なら、ブラウザ・OS・CPU が違っても同じ結果になる（https://rapier.rs/docs/user_guides/javascript/determinism/）。
 * 初回の読み込みが大きい（数 MB）ので、使う直前に動的 import する。
 */
// パッケージは default で名前空間（init / World / RigidBodyDesc …）を書き出す
export type Rapier = typeof import('@dimforge/rapier3d-deterministic-compat').default;

let loading: Promise<Rapier> | null = null;

export function loadRapier(): Promise<Rapier> {
  loading ??= import('@dimforge/rapier3d-deterministic-compat').then(async ({ default: R }) => {
    await R.init();
    return R;
  });
  return loading;
}
