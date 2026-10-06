/**
 * 小物の形を作る Web Worker（形の関数 → 曲面 → アトラスと頂点の配列）。three.js を使わない。
 *
 * 受け取る物: PropBuildRequest（作り方 PropSpec の並びと細かさ）。返す物: PropBuildResult（PropMeshData。配列は移す）。
 * 焼き込み光はメインの側で付ける（v2 の SurfaceLighting は three.js の型で計算するため）。
 * モジュールとして import しても副作用は無い（Worker として起動されたときだけ onmessage を登録する。試験は buildProps を直に呼ぶ）。
 */
import { detail, ShapeSink } from './shape.ts';
import { runSpec, type PropSpec } from './registry.ts';
import { buildMeshData, transferablesOf, type PropMeshData } from './atlas.ts';

export interface PropBuildRequest {
  id: number;
  /** 作り方と、その物の細かさの倍率（間隔に掛ける。大きいほど粗い） */
  items: { spec: PropSpec; scale: number }[];
  /** 模様（テクスチャ）の細かさの倍率（1 以下。画質で下げる） */
  tex?: number;
}

export interface PropBuildResult {
  id: number;
  data: PropMeshData | null;
  /** 作れなかった物の数（形の関数が例外を出した） */
  failed: number;
  /** 作るのにかかった時間（ms） */
  ms: number;
  error?: string;
}

/** 作り方の並びから、描画に渡す配列を作る（Worker の中身。試験からも呼ぶ） */
export function buildProps(req: PropBuildRequest): PropBuildResult {
  const t0 = performance.now();
  const S = new ShapeSink();
  const patches = S.patches!;
  let failed = 0;
  const base = detail.spacingScale;
  detail.textureScale = req.tex ?? 1;
  for (const it of req.items) {
    const from = patches.length;
    detail.spacingScale = base * it.scale;
    try { runSpec(S, it.spec); } catch { failed++; patches.length = from; }
    finally { detail.spacingScale = base; }
  }
  detail.textureScale = 1;
  const data = patches.length ? buildMeshData(patches) : null;
  return { id: req.id, data, failed, ms: performance.now() - t0 };
}

// Worker として起動されたときだけ受け付ける
const scope = globalThis as unknown as { WorkerGlobalScope?: unknown; onmessage: unknown; postMessage: (m: unknown, t: Transferable[]) => void };
if (typeof scope.WorkerGlobalScope !== 'undefined') {
  scope.onmessage = (e: MessageEvent<PropBuildRequest>) => {
    let res: PropBuildResult;
    try { res = buildProps(e.data); } catch (err) { res = { id: e.data.id, data: null, failed: e.data.items.length, ms: 0, error: String((err as Error)?.message ?? err) }; }
    scope.postMessage(res, res.data ? transferablesOf(res.data) : []);
  };
}
