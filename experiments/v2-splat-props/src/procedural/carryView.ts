/**
 * 持てる物（v2 の carryItem / carryBody）の描画を、形の関数のメッシュにする（world.html）。v2 のファイルは変えない。
 *
 * v2 の描画の登録（views.ts の defineView）を、このページの中でだけ上書きする。v2 の itemView と同じ振る舞い
 * （状態の位置と向き・持っているときは手の前・区画の外では場面の直下・バケツの水の高さ・運ぶと変わる物・0.3 秒ごとの明るさ・音）を
 * そのまま写し、見た目だけ形の関数の物（無い kind は v2 の形）にする。P（ProceduralProps の mode）で v2 の形と切り替える。
 * 形の関数の物は種類ごとに 1 回だけ作り、写し（形とテクスチャは共有）を使う。作り終わるまでは v2 の形
 */
import * as THREE from 'three';
import type { PartState } from '../../../../v2/core/sim/part.ts';
import type { EntitySpec, Json, MatId } from '../../../../v2/core/world/layout.ts';
import { defineView, type ViewContext } from '../../../../v2/client/views/views.ts';
import { buildShape } from '../../../../v2/client/views/carry/items.ts';
import { lightAt, onCue, Parts } from '../../../../v2/client/views/carry/common.ts';
import { SURFACES } from '../../../../v2/client/render/MaterialLibrary.ts';
import { Rand, Surfels, type V3 } from '../showroom/surfel.ts';
import { bucketWater, CARRY_GEN, type CarryColors } from '../showroom/gen/carry.ts';
import { buildRoomMeshes, disposeInstance, instanceOf, relightMeshes } from '../showroom/meshes.ts';
import { nextTask } from '../showroom/bake.ts';
import type { ProceduralProps } from './worldProps.ts';

const hex = (m: MatId | undefined, fb: number): number => (m && SURFACES[m] ? (SURFACES[m].emissiveColor ?? SURFACES[m].color) : fb);

/** 数（開発用。window.procedural.carry） */
export const carryStats = { views: 0, asked: 0, built: 0, ready: 0, noGen: new Set<string>() };

/** 種類ごとの形の関数の物（一度だけ作る）。water は水面（別の物。v2 と同じく名前 'water'） */
const templates = new Map<string, Promise<THREE.Object3D | null>>();

function templateFor(ctx: ViewContext, renderer: THREE.WebGLRenderer, kind: string, half: V3, params: { [k: string]: Json }, mat: MatId): Promise<THREE.Object3D | null> | null {
  const gen = CARRY_GEN[kind];
  if (!gen) { carryStats.noGen.add(kind); return null; }
  const c: CarryColors = { main: hex(mat, 0xcccccc), label: hex(params.label as MatId | undefined, 0xd23a34), glass: hex((params.glass as MatId | undefined) ?? 'lightWarm', 0xffd29a), dots: Number(params.dots ?? 1) };
  const key = `${kind}|${half.map((v) => v.toFixed(3))}|${mat}|${c.label}|${c.glass}|${c.dots}`;
  let p = templates.get(key);
  if (p) return p;
  p = (async () => {
    await nextTask();
    const build = async (f: (S: Surfels) => void, name: string): Promise<THREE.Object3D> => {
      const S = new Surfels();
      S.patches = [];
      S.noSplats = true;
      f(S);
      const m = await buildRoomMeshes(S.patches, new Map(), null, ctx.materials, renderer, name);
      return m.group;
    };
    const root = new THREE.Group();
    root.add(await build((S) => gen(S, new Rand(7), (q) => q, half, c), `carry:${kind}`));
    if (kind === 'bucket') {
      const w = await build((S) => bucketWater(S, new Rand(7), (q) => q, half), 'carry:water');
      w.name = 'water';
      root.add(w);
    }
    carryStats.built++;
    return root;
  })().catch((e) => { console.warn('[procedural] 持てる物を作れなかった', kind, e); return null; });
  templates.set(key, p);
  return p;
}

/** 持っている物を手の前に描く位置（v2 の handPlace と同じ） */
function handPlace(group: THREE.Group, half: V3): void {
  const size = Math.max(half[0], half[1], half[2]) * 2;
  const s = size > 0.45 ? 0.45 / size : 1;
  group.scale.setScalar(s);
  group.position.set(0.26, -0.3 - (size > 0.45 ? 0.08 : 0), -0.62);
  group.rotation.set(0.12, -0.35, 0);
}

export function installCarryViews(mgr: ProceduralProps, renderer: () => THREE.WebGLRenderer | null): void {
  const view = (spec: EntitySpec, ctx: ViewContext): ReturnType<Parameters<typeof defineView>[1]> => {
    const half = (spec.params.half as V3 | undefined) ?? [0.15, 0.15, 0.15];
    const kind = String(spec.params.kind ?? 'box');
    const mat = (spec.params.mat as MatId | undefined) ?? 'boxCardboard';
    const g = new THREE.Group();
    carryStats.views++;
    let P = new Parts(ctx);
    let proc: THREE.Object3D | null = null;
    let stage = -1;
    let relight = 0;
    let inHand = false;
    let gen = 0;
    let disposed = false;
    const build = (st: number): void => {
      gen++;
      const my = gen;
      P.dispose();
      if (proc) { proc.removeFromParent(); disposeInstance(proc); proc = null; }
      P = new Parts(ctx);
      buildShape(P, kind, half, mat, spec.params, st);
      g.add(P.group);
      stage = st;
      relight = 0;
      // 運ぶと変わる物は段ごとの形
      const forms = (spec.params.forms as string[] | undefined) ?? ['cup', 'vase', 'bird', 'key'];
      want = kind === 'morph' ? forms[Math.min(forms.length - 1, st)]! : kind;
      asked = false;
      ask(my);
    };
    // 形の関数の物を頼む（ゲームを作っている途中で描画の器がまだ無ければ、update で後から頼む）
    let want = kind;
    let asked = false;
    const ask = (my: number): void => {
      const r = renderer();
      if (!r) return;
      asked = true;
      carryStats.asked++;
      const t = templateFor(ctx, r, want, half, spec.params, mat);
      void t?.then((tpl) => {
        if (!tpl || disposed || my !== gen) return;
        proc = instanceOf(tpl);
        g.add(proc);
        relight = 0;
        carryStats.ready++;
      });
    };
    build(0);
    const cellBounds = ctx.built.cells.get(spec.cell ?? '')?.bounds ?? null;
    const q = new THREE.Quaternion();
    const offCue = onCue(ctx, spec.id, (name, e) => {
      const a = ctx.audio;
      if (!a) return;
      const pos = e.pos;
      if (name === 'carry.pick' || name === 'carry.swap') a.play('pageTurn', { pos, gain: 0.25 });
      else if (name === 'carry.drop') a.play('thud', { pos, gain: 0.25 });
      else if (name === 'carry.place') { a.play('clank', { pos, gain: 0.1 }); a.play('thud', { pos, gain: 0.2 }); }
      else if (name === 'carry.throw') a.play('pageTurn', { pos, gain: 0.18, pitch: 0.7 });
      else if (name === 'carry.land') a.play('thud', { pos, gain: Math.min(0.7, 0.15 + Number(e.data?.speed ?? 2) * 0.06) });
      else if (name === 'carry.spill') a.play('drip', { pos, gain: 0.6 });
      else if (name === 'carry.fill') { a.play('drip', { pos, gain: 0.5 }); a.play('drip', { pos, gain: 0.4 }); }
      else if (name === 'carry.morph') a.play('chime', { pos, gain: 0.15 });
      else if (name === 'carry.return') a.play('pageTurn', { pos, gain: 0.15 });
    });
    return {
      update(s: Readonly<PartState>, dt: number) {
        const st = typeof s.stage === 'number' ? s.stage : 0;
        if (kind === 'morph' && st !== stage) build(st);
        if (!asked) ask(gen);
        // 見せ方: 形の関数の物ができていて、P の表示が形の関数なら v2 の形を隠す
        const useProc = !!proc && mgr.mode === 'proc';
        P.group.visible = !useProc;
        if (proc) proc.visible = useProc;
        const held = s.held === 'p1' && !!ctx.camera;
        if (held) {
          if (!inHand) { ctx.camera!.add(g); handPlace(g, half); inHand = true; relight = 0; }
        } else {
          const p = s.poses as number[];
          const out = !!cellBounds && (p[0]! < cellBounds.min[0] || p[0]! > cellBounds.max[0] || p[2]! < cellBounds.min[2] || p[2]! > cellBounds.max[2]);
          const parent = out && ctx.scene ? ctx.scene : ctx.root;
          if (g.parent !== parent || inHand) { parent.add(g); g.scale.setScalar(1); g.rotation.set(0, 0, 0); inHand = false; relight = 0; }
          g.position.set(p[0]!, p[1]!, p[2]!);
          q.set(p[3]!, p[4]!, p[5]!, p[6]!);
          g.quaternion.copy(q);
        }
        // バケツの水面（v2 の形と形の関数の物の両方）
        const f = typeof s.fill === 'number' ? s.fill : 0;
        for (const root of [P.group, proc]) {
          const water = root?.getObjectByName('water');
          if (!water) continue;
          water.visible = f > 0.01;
          water.position.y = -half[1] + 0.02 + f * half[1] * 1.7;
        }
        relight -= dt;
        if (relight <= 0) {
          relight = 0.3;
          const wp = new THREE.Vector3();
          g.getWorldPosition(wp);
          const rgb = lightAt(ctx, [wp.x, wp.y, wp.z]);
          P.relight(rgb);
          if (proc) relightMeshes(proc, rgb);
        }
      },
      dispose() { disposed = true; offCue(); P.dispose(); if (proc) { proc.removeFromParent(); disposeInstance(proc); } g.removeFromParent(); },
    };
  };
  defineView('carryItem', view);
  defineView('carryBody', view);
}
