# 担当への指示の雛形（段階 5）

場面を担当（Agent ツールの general-purpose）に任せるときの指示。`{}` を埋める。英語で書くと担当の取り違えが少なかった。
**禁止事項は最初の指示に必ず入れる**（後から言うと作り直しになる）。

```text
You are building one scene of a look-development test stage. The user's goal: reproduce the reference images
as a walkable 3D first-person stage, aiming for a 100% faithful look. Visual fidelity is the top priority.

## Project
- Repo: {repo path} (branch {branch} — do NOT commit, do NOT switch branches). Work folder:
  experiments/visual-style-lab/ (three.js r186, WebGL2, TypeScript, Vite). Do not touch v1/, v2/, shared/.
- Read first: docs/01-reference-analysis.md, docs/02-techniques.md, docs/03-scene-guide.md, docs/05-method.md,
  and .claude/skills/reference-stage/reference/techniques.md. Then src/core/ViewCam.ts, src/render/StyleMaterial.ts,
  src/render/PaintMaterial.ts, src/render/Decal.ts, src/render/Style.ts, src/render/Post.ts, src/scenes/Builder.ts,
  src/scenes/types.ts, and the best example scene for this look: {corridor.ts / pastel.ts / station.ts}.
- The dev server is running at http://localhost:5176/ (do not start/stop it).

## Your scene: `{id}` ({label}) — references public/refs/{id}-0.jpg … {id}-{n}.jpg
{言語化: 何が写っているか、型（平らな色面 / 段落とし / 半写実）、特徴的な質感、画像同士の関係}
Design ONE coherent space in which all viewpoints exist and the player can walk between them.

## Ownership rules
- You own ONLY src/scenes/{id}.ts and src/scenes/{id}/. Keep export `{id}` and id '{id}'.
- Do NOT edit core files (src/core/*, src/render/*, src/App.ts, src/main.ts, src/ui/*, src/scenes/index.ts,
  Builder.ts, types.ts, tools/*, docs/*). If core lacks something, do it scene-locally and list requests in your report.
- NEVER load, sample or project the reference images in scene code (no camera mapping, no masks baked from refs).
  Shapes and colours must be authored: measured by eye or with `--sample`, then written as numbers.
- Do not use automatic parameter search to lower ΔE if it flattens contrast or shapes.
- Typecheck: `cd experiments/visual-style-lab && npx tsc -p tsconfig.json` (fix only your files). Comments in Japanese.

## Workflow and gates (do them in order; don't tune colours before the camera and shapes pass)
1. Camera: measure the vanishing point (≥ 2 receding horizontal lines) and known sizes; use
   `solveFromVanishingPoint` + `ViewCam`. Gate: `-edges.png` shows the main edges white (overlapping), structure F ≥ 60.
2. Blockout from pixels with `cam.hit` / `cam.rectOn`; verify with `cam.proj`. Gate: structure F ≥ 70 (≥ 65 for heavy texture).
3. Colours with `--sample` written straight into color/shade/dark/hi (or per-face paint). Gate: `--sample-both` matches on flat areas.
4. Light/shadow shapes (light directions, painted decals, shadow casters). Gate: no large red/blue areas in `-diff.png`.
5. Atmosphere and post (fog, lines, bloom, diffusion, grade). 6. Props. 7. Walkable (colliders, styleZones, staticShadows).
8. Walk between and beyond the viewpoints; check seams, box edges, swimming patterns, stripes. Frame ≤ 8 ms (`--perf`).
Commands (inside experiments/visual-style-lab): `node tools/capture.mjs {id} --grid 8x4`,
`--sample {view} x,y ...`, `--sample-both {view} x,y ...`, `--params 'set=...'`, `--perf`.
Open the -cmp.png, -edges.png and -diff.png images every time; numbers are guides, your eyes decide. Expect 20–40 iterations.

## Final report
ΔE and structure F per view, a 1–2 line honest assessment per view (what matches / what differs), cmp paths,
core requests. Concise.
```

## 戻すときの指示の形

```text
Thanks — {良くなった所}. Please do one more focused round (same rules).
Core changes since your run: {入れた道具}.
My review of {paths}, by priority:
1. **{視点}: {短い題}.** Reference: {画素の位置と何があるか}. Your render: {画素の位置と何になっているか}. {直し方の方向}.
2. ...
Targets: ΔE ≤ {n}, structure F ≥ {n}, frame ≤ 8 ms. Report final numbers.
```
