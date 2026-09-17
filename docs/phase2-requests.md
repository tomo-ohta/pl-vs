
## M-material（ColorMissing / RenderStyle / MaterialGradient）

- 担当名: M-material
- 対象ファイル: src/render/MaterialLibrary.ts（createMaterial の onBeforeCompile）
- 必要な変更: colorMask を emissive にも掛ける。`shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= colorMask;')` を 1 行追加（uniform は既存の colorMask をそのまま使う。プログラム数・キーは変わらない）。
- 理由: 現状 colorMask は `map_fragment` 直後の diffuseColor にだけ乗算されるため、E20（赤欠損）で発光箔（lightPanel / lightWarm / ledBlue / サイン発光）の赤成分だけが残る。ColorMissing 側は L.lights の色を欠損させているので、発光箔もマスクされれば部屋内の「赤が存在しない」表現が一貫する。

- 担当名: M-material（任意・優先度低）
- 対象ファイル: src/render/MaterialLibrary.ts（gradient の mapTail）
- 必要な変更: gradT の補間を `smoothstep(0.15, 0.85, t)` にする（implementation-analysis.md MaterialGradient の前提「ブレンドは smoothstep(0.15, 0.85) の線形」）。現状は 0..1 の線形クランプ。
- 理由: 入口・出口の端で色が完全に from / to に達する区間ができ、遷移が読みやすくなる。Modifier 側（layout フック）からはシェーダを変えられない。

## M-light（LightingPhase / FakeSky）

- 担当名: M-light / 対象ファイル: `src/render/SurfaceGeometry.ts`（SurfaceLighting コンストラクタの `this.blockers` フィルタ）
  必要な変更: 遮蔽体の除外条件に sky* MatId を足す。
  `... && b.mat !== 'waterWall' && !SURFACES[b.mat].decal` → `... && b.mat !== 'waterWall' && !/^sky/.test(b.mat) && !SURFACES[b.mat].decal`
  理由: FakeSky はシェルの天井箔を skyOvercast / skyDusk / skyNoon に差し替えるが、ソリッドのままだと `lighting.directional`（日射）の遮蔽判定で
  天井が太陽を隠し、焼き込みの日射が全て ×0.08 になる。現状は FakeSky 側で天井箔を `solid: false` にして回避している（天井コライダが無くなるが、
  FakeSky 部屋の天井は 3.0 m 以上でジャンプが届かないため実害なし）。この変更が入れば FakeSky.ts の `solid: false` を外して天井コライダを戻せる。優先度: 低。
- 担当名: M-light / 対象ファイル: `src/render/ArchitecturalDetails.ts`（「Shallow metal housings around luminous ceiling panels」の正規表現）
  必要な変更: `/^(lightPanel|lightWarm|lightOff)$/` → `/^(lightPanel|lightWarm|lightOff|lightGreen|lightYellow)$/`
  理由: LightingPhase seedPhase（U01）が天井パネルを lightGreen / lightYellow に差し替えると、その区画だけ金物の筐体が付かず見た目が揃わない。優先度: 低（見た目のみ）。

## M-water（Wetness / ShallowWater / ParticleDetail）

- 担当名: M-water / 対象ファイル: `src/modifiers/index.ts` / 必要な変更: `import.meta.glob('./mods/*.ts')` のループで、basename にドットを含む補助ファイル（`<Id>.<name>.ts`。例 `ShallowWater.geom.ts`）を default export の検査より前に `continue` で読み飛ばす（例: `if (/\/[^/]+\.[^/]+\.ts$/.test(path)) continue;`）。/ 理由: 補助ファイルは規約どおり所有 ID をプレフィックスにして mods/ に置いているが、現状は起動時に `default export が ModifierImpl ではありません` の console.warn が補助ファイルごとに出る（M-water の `ShallowWater.geom.ts` のほか、EraPreset.shellSplit / GraphReference.wall / PropRepetition.shared / ZoneThemeShuffle.presets も同様）。
- 担当名: M-water / 対象ファイル: `src/generators/layout.ts`（任意・低優先） / 必要な変更: `RoomLayout.particles` を `ParticleSpec | ParticleSpec[]` にし、RoomBuilder 側で配列なら Points を複数作る。/ 理由: ParticleDetail(rain) は現状 1 部屋 1 領域（漏水点 1 か所）に制限している。複数の漏水点（分析 docs の「1〜3 か所」）を出すには複数 ParticleSpec が必要。無くても動くので Phase 3 でよい。

## M-instances（InstanceOvergrowth / PropRepetition / PropOrientation）

- 担当: M-instances / 対象ファイル: `src/modifiers/index.ts` / 必要な変更: `import.meta.glob('./mods/*.ts', { eager: true })` を補助ファイル（ID プレフィックス + ドット付き。例 `PropRepetition.shared.ts`）を除外する形にする。例: `import.meta.glob(['./mods/*.ts', '!./mods/*.*.ts'], { eager: true })`（Vite の negative pattern）。あるいは `mod?.default` が無いファイルは警告せず無視する。/ 理由: 現状は補助ファイル 1 つごとに起動時 `[modifiers] ./mods/X.Y.ts: default export が ModifierImpl ではありません` の console.warn が出る（現在 5 ファイル分）。動作には影響しない。
- 担当: M-instances / 対象: DuplicateNumber 担当への情報（ファイル変更なし）/ 内容: R20（StorageGrid）で PropRepetition(storageDoor) は GridGenerator の doorMetal 詰め物（0.8×0.5 の小箱）を捨て、代わりに扉板を **非 solid の 'doorMetal' 箱（幅 ≈2.2 m × 高 ≈2.4 m × 厚 0.05 m、shellCount 以降、通路順）** として L.boxes に出す。「doorMetal の非 solid 箱 = 扉」として番号を貼ればよい。rooms.json の順序どおり PropRepetition → DuplicateNumber の順で layout フックが走る。anchors フィールドは出していない。

## M-theme（EraPreset / ZoneThemeShuffle / AmbientCarryover）

- 担当名: M-theme / 対象ファイル: `src/generators/layout.ts`（GenParams）と `src/world/WorldManager.ts`（layoutFor） / 必要な変更: `GenParams` に任意フィールド `node?: RoomInstance`（`import type { RoomInstance } from '../core/types'`）を追加し、`WorldManager.layoutFor` の `generateLayout({ def, template, rng, ... , holeLocal: node.holeLocal, node }, node.fallback)` で渡す（Adapter 側の generateAdapter には不要）。 / 理由: AmbientCarryover はコピー元を `onNodeCreated` で `node.state.modifierState.AmbientCarryover` に固定するが、layout フックは `(L, p, params, rng)` しか受け取らず node に届かない。現状は `AmbientCarryover.ts` が `(p as { node?: RoomInstance }).node` を読む形で対応済みなので、この 1 フィールドが入れば layout 段階で palette / LightSpec / 発光パネル / render.fog の差し替えが SurfaceLighting の焼き込みに反映される。入るまでは build フックのフォールバック（キャッシュ済み RoomLayout の palette と BuiltRoom.fog / PointLight 色を直接差し替え）で動き、fog・背景・半球光・音はコピーされるが頂点の焼き込み色だけは既定のまま。GraphReference（past の展示）など「グラフ依存の選択を modifierState に保存する」Modifier も同じフィールドで済む。
- 担当名: M-theme / 対象ファイル: `src/modifiers/index.ts`（import.meta.glob のループ） / 必要な変更: M-water の依頼と同じ（basename にドットを含む補助ファイルを読み飛ばす）。M-theme の補助ファイルは `EraPreset.shellSplit.ts` / `ZoneThemeShuffle.presets.ts`。 / 理由: 起動時の console.warn を消す。動作には影響なし。
- 担当名: M-theme（任意・優先度低） / 対象ファイル: `src/render/RoomBuilder.ts`（buildDoor の `doorMat`） / 必要な変更: `const doorMat: MatId = portal.locked ? 'doorMetal' : (doorMatAt(layout, s.pos) ?? layout.palette.door)` のように、ソケット位置を含む `layout.zones` の kind 'theme' で `params.door` が MatId ならそれを使う（EraPreset は各区画の zone params に `door` を書いている。`params.mod === 'EraPreset'` で限定してよい）。 / 理由: R11 は区画ごとに客室ドア帯（内装箔）を年代の扉材質に差し替えているが、Portal の扉パネルだけは palette.door のまま（implementation-analysis「扉パネルもゾーンの door mat で buildDoor」）。見た目のみ。

## M-snapshot（PastWindow / GraphReference / SelfMap）
- 対象ファイル: `src/modifiers/index.ts`
- 必要な変更: `import.meta.glob('./mods/*.ts', { eager: true })` の走査で、ベース名にドットを含む補助ファイル（`PastWindow.wall.ts` / `GraphReference.wall.ts` / `EraPreset.shellSplit.ts` など、各担当が ID プレフィックスで作った補助ファイル）を登録対象から外す。例: `const fileId = path.replace(/^.*\/(.+)\.ts$/, '$1'); if (fileId.includes('.')) continue;` を `impl` 判定の前に入れる（あるいは glob パターンを `'./mods/*.ts'` のまま `{ eager: true }` + `!path.match(/\/[^/]+\.[^/]+\.ts$/)` でフィルタ）。
- 理由: 現在は補助ファイルごとに起動時 `console.warn('[modifiers] ./mods/X.Y.ts: default export が ModifierImpl ではありません')` が出る（Node ハーネスで 5 件確認）。動作には影響しないがコンソールエラー 0 の確認を妨げる。
- 優先度: 低（任意）。

## M-shell（GravityAxis / ScaleAnomaly）

- 担当名: M-shell（任意・優先度低）
- 対象ファイル: src/world/WorldManager.ts（growToFill）
- 必要な変更: `hasModifier(ROOM_BY_ID.get(node.definitionId), 'ScaleAnomaly')` かつ params.mode === 'room' の部屋は growToFill を skip する（`if (node.entryReq?.type === 'hole') return;` の隣に 1 行）。または node.mainRect を生成器に渡す前に 1/s する。
- 理由: growToFill は拡大後の footprint[0] を成長させて node.mainRect に保存し、生成器（RoomGenerator）はそれを元寸法の主矩形として読むため、ScaleAnomaly(room) の layout フックでさらに ×s される。現状は再生成後の fits() が失敗して取り消されるので破綻はしないが、無駄な再生成が 1 回入り、成長が効かない。implementation-analysis.md ScaleAnomaly の方針「mainRect は生成器に渡す前に 1/s する」に相当。

- 担当名: M-shell（任意・優先度低）
- 対象ファイル: src/render/RoomBuilder.ts（build の E03 ロール部分）
- 必要な変更: `workLights` / ラベル / サインのロールも箱と同じく `rollFrom` 以降だけに限定できるようにする（例: `LightSpec` 等には index が無いので、`layout.rollLightsFrom?: number` / `rollLabelsFrom?` を追加して既定は 0 = 全数）。
- 理由: 折れ廊下（L / Z / U）の E03 では 2 本目以降のセグメントを GravityAxis が自身の進行軸で手で回しており、照明・ラベルは RoomBuilder が全数を回すため、layout には「RoomBuilder のロールの逆変換を掛けた位置」を格納して打ち消している。動作は正しいが `L.lights` の生の座標が室外に見え、他の Modifier（ColorMissing / LightingPhase など L.lights を読むもの）が E03 と重なったときに誤解を招く。現状 E03 は GravityAxis のみなので急がない。

## M-zones（SurfaceFriction / ExternalForce / WaterWall）

- 担当名: M-zones（任意・Phase 3 の Generator 向けの契約メモ。今すぐの変更は不要）
- 対象ファイル: src/generators/MegaStructureGenerator.ts（本実装時）/ src/generators/StreetGenerator.ts（本実装時）
- 必要な変更: (1) MegaStructure（L19）は凍結面の床箱に MatId 'ice' を使う → SurfaceFriction は 'ice' 箱があればそれにだけ friction ゾーンを置き、自前の氷面（リンク + 帯）を作らない。
  (2) StreetGenerator RoadGraph（L15）は車線ごとに `L.zones.push({ kind: 'lane', aabb, vector: 進行方向, params: { speed? } })` を出す → ExternalForce(conveyor) は 'lane' ゾーンがあればそれを force ゾーンに写し、自前の帯（yellowLine 縁 + rubber 箔 + ベルト面）を作らない。
- 理由: 「形は Generator、挙動は Modifier」（implementation-analysis.md 未実装 Generator 節の共通基盤）。現状はスタブ（LargeRoom 代替）なので Modifier 側で見た目まで作っている。契約を先に書いておく。

- 担当名: M-zones（任意・優先度低）
- 対象ファイル: src/game/Game.ts（GameServices）
- 必要な変更: `ensurePrepared(roomId)` 相当を GameServices に公開する（`prepare(roomId: string): void`）。
- 理由: WaterWall は E09 の扉 Portal を build 時から常時「開」にするが、プレイヤーが隣室にいるとき水壁の先（2 hop）は `keep` に入らず dispose されるため、水面の向こうが暗く見える。Modifier から `game.prepare(portal.targetRoomId)` を呼べれば、開いた扉を E で開けたときと同じく先の部屋を構築できる。無くても進行に影響は無い（見た目のみ）。

- 担当名: M-ride-audio（任意・優先度低）
- 対象ファイル: src/game/Game.ts（startRide）
- 必要な変更: `startRide(node, portal, opts)` の `allowSkipAfterSec` / `shake` の既定値を `modParams(this.defOf(node), 'VehicleRide')` の `skipAfterSec` / `shake` から取る（無ければ現状の 5 / 0.015）。例: `const mp = modParams(this.defOf(node), 'VehicleRide'); allowSkipAfterSec: opts.allowSkipAfterSec ?? num(mp?.skipAfterSec, 5), shake: opts.shake ?? num(mp?.shake, 0.015)`。
- 理由: rooms.json の E11 / L02 / L11 に `skipAfterSec: 5` が入っているが、interactRay → startRide(owner, portal) は opts 無しで呼ぶため params が使われない。現状は既定値と一致しているので動作は同じ（データを変えたときだけ効く）。VehicleRide 側からは interactRay の呼び出しに介入できない。

## M-dynamics（MovingWalls / DynamicLength）

- 担当名: M-dynamics / 対象ファイル: `src/generators/CorridorGenerator.ts`（`generateCorridor` の shape / lengths の選択） / 必要な変更: `p.def.modifiers` に `DynamicLength` があるとき（E13）は形状を `'straight'` に固定し、長さ表を `[60, 48, 36, 24]` にする（例: `const dyn = p.def.modifiers?.some((m) => m.id === 'DynamicLength'); const shapes: Shape[] = dyn ? ['straight', 'straight', 'straight', 'straight'] : rng.shuffle([...]); const lengths = dyn ? [60, 48, 36, 24] : [26, 20, 14, 9];`。`rng.shuffle` を呼ばない分岐では共有乱数の消費が変わるが E13 専用なので他部屋には影響しない）。あわせて E13 では `wantHole` を false にしてよい（DynamicLength.layout 側でも hole ソケットを取り除いてシェルを組み直しているので必須ではない）。 / 理由: implementation-analysis「DynamicLength」の前提「配置は max=60 m の直線で試み、入らなければ 48 / 36 / 24 m へ縮小」。現状は E13 も L / Z / U 形（3/4）と 9〜26 m 長で生成されるため、偽端の可動域は最初のセグメント内（Node 計測: 直線 24 m で 14 m、80 ケース中 58 は折れ廊下か短すぎで偽端なし）に留まり「遠ざかる」印象が弱い。DynamicLength.ts は折れ廊下でも最初のセグメントの角の手前まで、直線なら奥の扉の前 1.6 m までを可動域にするので、この変更が入ればそのまま 60 m で動く。
- 担当名: M-dynamics / 対象ファイル: `src/render/RoomBuilder.ts`（`buildDynamics` の update）または `src/player/PlayerController.ts` / 必要な変更（どちらか）: (A) `buildDynamics` の毎フレーム更新で、`solid` な要素は「次の位置の AABB がプレイヤー AABB（余白 0.15）と重なるなら時間を進めず止まる」ようにする（プレイヤー AABB は RuntimeContext.player から取れる。effect.update(dt, ctx) の ctx.player.pos / crouching）。(B) `PlayerController.update` の末尾に `depenetrate(near)`（delta=0 でも重なった AABB から最短軸で押し出す。ただし上方向への押し出しは段差 0.35 までに制限）を追加する。 / 理由: 現状の `buildDynamics` は時間の純関数で位置を更新しプレイヤーを見ないため、静止中のプレイヤーにソリッドの可動要素が食い込むと `moveAxis(1)`（重力）が押し出し先を箱の上面（`c.max[1]`）に取り、同じ反復で天井スラブにも当たってさらに天井の上へ出る（屋上へ弾き出される）。M-dynamics は回避のため build フックで自分の可動要素（id `MovingWalls:*` / `DynamicLength:*`）の駆動を引き取っている（`src/modifiers/mods/MovingWalls.drive.ts` の `takeOverDynamics`: RoomBuilder の Mesh を非表示・コライダを非ソリッドにし、geometry / material を共有するクローンと自前コライダを登録して停止規則付きで動かす）。(A) が入れば takeOverDynamics を外して L.dynamics だけで済む。DynamicGridGenerator（M07 本実装）や他 Generator が solid な dynamics を出す場合は同じ問題が出るので、共通側での対応を推奨。優先度: 中。
- 担当名: M-dynamics（任意・優先度低） / 対象ファイル: `src/generators/CorridorGenerator.ts` / 必要な変更: `p.def.id === 'E18'`（または `MovingWalls` 付きの CorridorHotel）では shape の候補から `'straight'` を除く（`shapes = rng.shuffle(['L', 'Z', 'U', 'Z'])` など 4 要素を維持）。 / 理由: implementation-analysis「MovingWalls」の前提「E18 は廊下形状を Z / U に寄せる（可変蛇行）」。見た目のみ。

## M-connect（LoopTopology / RepeatDestination / FarLink / FakeExit）

- 担当名: M-connect / 対象ファイル: `src/game/Game.ts`（`registerWorldHooks` の connectHook） / 必要な変更: Adapter（`ctx.def === null`）でも、エレベーター籠なら親の部屋の定義で Modifier の onConnect を呼ぶ。
  ```ts
  world.connectHooks.push((ctx) => {
    let def = ctx.def;
    // エレベーター籠 Adapter の 'end' は親（paletteFrom = 籠を出した部屋）の Modifier に判断させる（RepeatDestination U18）
    if (!def && ctx.node.isAdapter && ctx.node.adapter?.kind === 'elevatorCar' && ctx.world.graph.has(ctx.node.adapter.paletteFrom)) {
      def = ctx.world.definitionOf(ctx.world.graph.get(ctx.node.adapter.paletteFrom));
    }
    if (!def) return;
    const socket = ctx.world.socketOf(ctx.node, ctx.portal.socketId);
    const rng = new Rng(ctx.node.seed).fork(`connect:${ctx.portal.portalId}`);
    const d = collectConnectDirective({ world: ctx.world, node: ctx.node, def, portal: ctx.portal, socket, depth: ctx.depth, rng });
    ...
  ```
  理由: U18（反復エレベーター）は primaryPortal が elevator で、進行先は `resolveElevator` が作る籠 Adapter の 'end' で抽選される。現状は Adapter で hook が早期 return するため RepeatDestination が U18 に届かない。RepeatDestination.onConnect は `ctx.node.isAdapter && adapter.kind === 'elevatorCar'` のとき `paletteFrom` の部屋の `repeat` を見て `{ forceDefinitionId: 'U18', role: 'repeat', repeat: n+1 }` を返す実装済み（他の Modifier は Adapter からの呼び出しを想定していないので、`elevatorCar` に限定すること）。Node ハーネス（scratchpad/p2/M-connect）で同じ写像を入れて確認済み（籠の end → U18/repeat#1 が 5 seed 中 5 で成立。置けない seed は前室 → 通常抽選で反復終了）。優先度: 中（無いと U18 は通常のエレベーターと同じ挙動）。
- 担当名: M-connect / 対象ファイル: `src/modifiers/index.ts`（import.meta.glob のループ） / 必要な変更: 他担当（M-water / M-instances / M-theme / M-snapshot）と同じ。補助ファイル `LoopTopology.shared.ts` も対象。 / 理由: 起動時の console.warn を消す。動作には影響なし。
- 担当名: M-connect（任意・優先度低） / 対象ファイル: `src/generators/layout.ts`（GenParams）/ `src/world/WorldManager.ts`（layoutFor） / 必要な変更: M-theme の依頼と同じ `GenParams.node?: RoomInstance`。 / 理由: RepeatDestination の番号サイン（'rd:num'）の初期文字を layout 段階で反復回数に合わせられる（`(p as { node?: RoomInstance }).node?.repeat` を読む実装済み）。無くても build / update で `updateSign` するので見た目は同じ。

## M-gate（NonEuclideanVolume / NoiseGate）

- 担当名: M-gate / 対象ファイル: `src/generators/layout.ts`（GenParams）と `src/world/WorldManager.ts`（layoutFor） / 必要な変更: M-theme の依頼と同じ `GenParams.node?: RoomInstance` を追加し、`layoutFor` の `generateLayout({ ..., holeLocal: node.holeLocal, node }, node.fallback)` で渡す。 / 理由: NonEuclideanVolume（E08）は「殻（4×4 m の閉じた箱）」と「内部（面積 ×interiorScale）」を同じ定義 E08 の 2 ノードで作り、内部は `RoomInstance.role === 'interior'` で区別する。layout フックには node が渡らないので `(p as { node?: RoomInstance }).node?.role` を読む形で実装済み。このフィールドが入るまでは内部ノードも殻と同じ 4×4 の箱になる（内部の 'inner' 扉は onConnect が Seam にしないので通常の扉として先へ繋がり、無限入れ子にはならない）。`GenParams.role?: string` だけの追加でも構わない（その場合は `node?.role ?? role` を読むよう M-gate 側を 1 行直す）。
- 担当名: M-gate / 対象ファイル: `src/game/Game.ts`（interactRay / updateHint の `checkCanOpen` 呼び出し、または `RuntimeContext`） / 必要な変更（任意・優先度低）: canOpen が「操作（interactRay）」から呼ばれたことを Modifier に伝える手段。例: `ctxFor` の戻り値に `interacting?: boolean` を足し、interactRay 側だけ `{ ...ctx, interacting: true }` で渡す。 / 理由: NoiseGate（E17）はマイク許可の要求を「E17 の扉に対する最初の操作（ユーザージェスチャ）」で行う仕様だが、canOpen は HUD ヒント（毎フレーム）と操作の両方から同じ形で呼ばれ区別できない。現状は「update の間に canOpen が 2 回以上呼ばれたフレーム = ヒント + 操作」というヒューリスティックで検出している（同一フレームなので通常は正しく働くが、扉が開いて updateVisibility の重い構築が挟まると検出が 1 回遅れることがある）。
- 担当名: M-gate / 対象ファイル: `src/game/Game.ts`（Pointer Lock） / 必要な変更（任意）: マイク許可ダイアログの後に PC で Pointer Lock が外れるので、`document.addEventListener('pointerlockchange')` で外れたときに次のクリックで `input.requestLock()` を呼ぶ（既に Esc メニュー経由の再ロックがあるなら不要）。 / 理由: implementation-analysis「NoiseGate」リスク 4。E17 で E を押した直後にダイアログが出るとマウス視点が止まる。
- 担当名: M-gate / 対象ファイル: `src/world/WorldManager.ts`（resolveSeamTarget） / 必要な変更（任意・優先度低）: 既存 target へ戻る Seam（`portal.far && targetPortalId`）のとき、`spawnPointOf(target)` の代わりに `targetPortalId` のソケット内側 1.5 m に着地させる（Legendary 前室の end 等は 'entry' なので挙動は変わらない）。 / 理由: E08 の内部から殻へ戻る Seam は `targetExisting` で作るため `targetPortalId = 'entry'` になり、殻の入口内側（'inner' 扉から 2.5 m）に着地する。殻は 4×4 m なので実害は小さいが、'inner' の内側に着地できれば「扉を開けたら元の部屋」がより自然になる（`targetExisting` の指示に `targetPortalId` を渡せる口があればなお良い）。

## M-rewire（ObservationRewire / DynamicMapNode / MultiEdge）

- 担当名: M-rewire / 対象ファイル: `src/modifiers/index.ts`（import.meta.glob のループ）/ 必要な変更: M-water・M-theme・M-snapshot の依頼と同じ（basename にドットを含む補助ファイルを読み飛ばす）。M-rewire の補助ファイルは `ObservationRewire.seam.ts`。/ 理由: 起動時の console.warn を消す。動作には影響なし。
- 担当名: M-rewire（任意・優先度低）/ 対象ファイル: `src/world/WorldManager.ts`（resolveSeamTarget）と `src/game/Game.ts`（interactRay / ownerPortal）/ 必要な変更: hook 由来の Seam（localFlags 'seam:<portalId>' がある扉）の先を作るとき、先の部屋の entry を「元の扉へ戻る return-seam」（`isReturn: true, seam: true, targetRoomId: 元の部屋, targetPortalId: 元の portalId`）にし、Game 側で `isReturn && seam` の扉を E で開けたら ownerPortal に解決せず「元の部屋のその扉の内側」へ遷移する分岐を足す。/ 理由: implementation-analysis の ObservationRewire / DynamicMapNode の方針（「旧接続先の entry は E07 の当該扉へ戻る return-seam」）。現状は Legendary 遠方配置と同じ一方通行（`entryIsReturn = false`）で動いており、E07 / M03 / M07 から出た先から戻れない。閉じ込めにはならない（先の部屋の他の出口は通常接続）ので Phase 3 でよい。

## M-signs（DuplicateNumber / FakeSignage / TemperatureField）

- 担当名: M-signs / 対象ファイル: `src/modifiers/index.ts`（import.meta.glob のループ） / 必要な変更: 他担当と同じ（basename にドットを含む補助ファイルを default export の検査前に読み飛ばす）。M-signs の補助ファイルは `FakeSignage.common.ts` / `FakeSignage.build.ts`。 / 理由: 起動時の console.warn を消す。動作には影響なし。
- 担当名: M-signs（任意・優先度低） / 対象ファイル: `src/render/SignAtlas.ts`（`MAX_ATLASES_PER_ROOM`）または `src/render/RoomBuilder.ts`（サインの上限） / 必要な変更: R20（StorageGrid + PropRepetition storageDoor）は扉が 100 枚を超えるが、サインは部屋あたり 48 枚（アトラス 3 枚 × 16 セル）で止まる。数字・英字だけの短いサインには 256 × 64 px の小セル（1 アトラス 64 セル）を使う `SignSpec.small?: true` のような選択肢があると、R20 の全扉に番号を付けられる（DuplicateNumber 側は上限定数を参照しているだけなので無変更で追従する）。 / 理由: 現状は入口に近い 48 枚だけ番号付きで、奥の扉は無番になる。見た目のみ。
- 担当名: M-signs（任意・優先度低） / 対象ファイル: `src/game/Game.ts`（`hudHint`）と `src/modifiers/types.ts`（RuntimeContext.hud） / 必要な変更: `hud.hint(text)` に加えて「今 HUD のヒント欄が扉の操作案内・施錠ヒントなどで使われているか」を返す `hud.busy(): boolean`（updateHint の interactables ヒット判定と同じ）を貸し出す。 / 理由: TemperatureField は「ヒントが他で使われていない時のみ」温度を出す仕様で、現状は `document.getElementById('hud-hint').textContent` を読んで判定している（DOM への依存。id が変わると温度が扉の案内を上書きする）。入るまでは現状の DOM 参照で動く。

## G1（PoolGenerator）

- 担当名: G1 PoolGenerator（優先度: 低。無くても動く）
- 対象ファイル: src/generators/presets.ts（BASE）
- 必要な変更: `PoolCorridor: { floor: 'floorTile', wall: 'floorTile', ceiling: 'ceilingWhite', door: 'doorMetal' },` を 1 行追加。
- 理由: PoolCorridor は BASE に無く paletteFor が DEFAULT（灰絨毯・クリーム壁）を返す。PoolGenerator は layout.palette を Generator 内で上書きしているので実際の部屋・Adapter（layoutFor(from).palette 経由）・足音（palette.floor = floorTile）は揃うが、paletteFor を直接読む側（visual-review のケース表示や将来の precompile）と一致させるため。

## G4 DynamicGridGenerator（M07）

- 担当名: G4 DynamicGridGenerator（FYI。変更は必須ではない）
- 対象ファイル: src/modifiers/mods/MovingWalls.ts（build フックの `takeOverDynamics(built, placement, (id) => id.startsWith('MovingWalls:'), ID)`）
- 必要な変更: なし（契約の共有）。DynamicGridGenerator は可動ブロックを `L.dynamics` に id `'MovingWalls:grid<n>'`（`DynamicGridGenerator.MOVER_ID_PREFIX`）で出す。MovingWalls の layout フックは `L.dynamics?.length` で追加をスキップし、build フックは接頭辞 `'MovingWalls:'` で一致するのでそのまま停止規則（次の位置がプレイヤーと重なるなら止まる）付きの駆動を引き取る。将来 match を厳密化（`'MovingWalls:' + 数字` のみ等）する場合は `'MovingWalls:grid'` も含めてほしい。ブロックは 1.7 m 角 × 天井高 − 0.05、振幅 3 / 6 m、period = max(2, 2·振幅 / speed)（M07 speed 0.5 → 12 / 24 s）。
- 理由: RoomBuilder 単独の時間駆動には挟み込み防止が無く（phase2-requests「M-dynamics / buildDynamics の停止規則」参照）、M07 の可動ブロックは床から天井まであるので、停止規則が無いと静止中のプレイヤーが押されて屋上へ弾き出される。RoomBuilder 側の (A) 案が入れば id の契約は不要になる。

- 担当名: G4 DynamicGridGenerator（任意・優先度低）
- 対象ファイル: src/generators/presets.ts（BASE）
- 必要な変更: `DynamicGrid: { floor: 'floorTile', wall: 'wallWhite', ceiling: 'ceilingTile', door: 'doorMetal' }` を 1 行追加。
- 理由: 現状 DynamicGrid はテンプレ既定が無く DEFAULT（floorCarpetGrey / wallCream）になるため、Generator 側で `L.palette = { ...p.palette, floor: 'floorTile', wall: 'wallWhite', ceiling: 'ceilingTile' }` と上書きしている。presets に入れば Generator の上書きは不要（両方あっても結果は同じ。door は palette.door を参照する側に任せる）。

## G2 StreetGenerator（StreetGrid / RoadGraph）

- 担当名: G2 StreetGenerator / 対象ファイル: `src/modifiers/mods/PropRepetition.ts`（`apartmentBlock`）/ 必要な変更: 関数の先頭で「Generator が既に棟を出している」ときは格子配置（`gridPlace` と `removeInterior`）を行わず、窓・街灯の instances 追加も省いて `return` する。判定例: `interiorBoxesOf(L).some((b) => b.solid && (b.mat === 'wallConcrete' || b.mat === 'wallBrick') && b.max[1] - b.min[1] >= 5 && Math.min(b.max[0] - b.min[0], b.max[2] - b.min[2]) >= 3)`（StreetGenerator の団地棟は wallConcrete のソリッド箱、高さ 11 m、幅 6 m 以上）。/ 理由: L17 は StreetGenerator 本実装で全ブロックに同形の板状団地（4 階、窓帯、外階段）を反復配置している。現状の apartmentBlock は `removeInterior(isFurniture || columnConcrete)` で街灯ポール（metal）・偽扉（doorMetal）・停車中の車を捨てたうえ、`gridPlace` が街路上（歩道・棟に重ならない空き）に 6×3 m の棟を 9 棟ほど追加してしまう（Node 計測 seed 42 variant 0: 追加 9 棟。進行レーンは避けるので到達性は保たれるが道路が塞がって見える）。implementation-analysis「L17 は StreetGenerator 未実装のため LargeRoom fallback 上に棟を格子配置する暫定表示」の暫定処理に当たる。優先度: 中（L17 の見た目）。
- 担当名: G2 StreetGenerator（任意・優先度低）/ 対象ファイル: `src/world/WorldManager.ts`（`growToFill`）/ 必要な変更: 対象 Generator の配列に `'StreetGenerator'` を加え、`maxDim` を StreetGrid（`baseTemplate === 'StreetGrid'`）は 64、RoadGraph は対象外（廊下型）にする。StreetGenerator は `p.mainRect` を受けたら矩形寸法から街区数・街路幅を逆算する（実装済み。Node で mainRect 42.5×37 を渡して footprint が一致することを確認）。/ 理由: implementation-analysis StreetGrid 節の前提「growToFill の対象に加える（maxDim 64）」。無くても動作する。
- 担当名: G2 StreetGenerator（任意・優先度低）/ 対象ファイル: `src/generators/presets.ts`（BASE）/ 必要な変更: `StreetGrid: { floor: 'floorAsphalt', wall: 'wallConcrete', ceiling: 'ceilingDark', door: 'doorMetal' }`、`RoadGraph: 同上` を追加。/ 理由: 現状は StreetGenerator が `L.palette` を自分で差し替えている（floor / wall / ceiling / door / light / lightColor / ambient / fog）ので動作には不要。Adapter（前室）の `paletteFrom` が `paletteFor(def, template)` を使う場合に、街区の前室が LargeRoom 既定（カーペット）になるのを避けたいときだけ。
- 担当名: G2 StreetGenerator（情報・変更なし）/ 対象: 接続・描画担当 / 内容: StreetGrid の街路端の出口は `type: 'street'`（幅 WIDE_W 2.2、高さ 3.2）。RoomBuilder は `portal.type === 'door'` にだけ扉パネルを作るので、street 開口はパネル無しの常開ゲート（README「street / gate は幅広の常開扉」どおり）。implementation-analysis の推奨 A（閉じられるシャッター）にするなら `RoomBuilder.buildDoor` を isDoorLike に広げる変更が要る（G2 側の変更は不要。ソケットの幅・高さはそのまま使える）。RoadGraph の出口は全て `type: 'ramp'`（WorldManager が ramp Adapter を挟む既存フロー）。立体ランプの上階出口は `pos[1] = 3.6`、開口高さ 2.8。

## G3 MegaStructureGenerator

- 担当名: G3 / 対象ファイル: `src/world/WorldManager.ts`（`tryPlaceLegendaryFar`） / 必要な変更: 遠方配置した部屋の `this.projector.assign(room.roomId, wb, owner.mapCell ?? null, 0, true)` にも `finalize` と同じ `levelSpan` を渡す（`const gen = this.generatorOf(room); const span = gen === 'MegaStructureGenerator' || gen === 'StreetGenerator' ? levelSpanOf(wb) : 1; ... assign(..., true, span > 1 ? { levelSpan: span } : undefined)`）。 / 理由: 周囲に入らず前室 + Seam で遠方に置かれた多層の Mega（Node 計測: 5 seed 中 2 seed）は `mapCell.levelSpan` が付かず、上階の出口先の部屋が 2F 以上の地図で「宙に浮いた部屋」になる（通常配置は finalize が levelSpan を付けるので問題ない）。優先度: 中。
- 担当名: G3（任意・優先度低） / 対象ファイル: `src/generators/layout.ts`（RoomLayout）+ `src/world/WorldManager.ts`（finalize / tryPlaceLegendaryFar）+ `src/map/GridProjector.ts` / 必要な変更: `RoomLayout.levels?: number`（歩ける階の数）を追加し、`levelSpanOf(wb)` の代わりに `layout.levels ?? levelSpanOf(wb)` を使う。MegaStructureGenerator は `L.levels = c.levels` を出す（1 行。依頼が通ったら追記する）。 / 理由: 単層で天井の高い MegaHall（L02 10〜13 m、L03 12〜14 m、L12 14〜18 m）が地図で 3〜5 フロア分に描かれる（`levelSpanOf` は世界 AABB の高さから丸めるため）。MegaAtrium は階数と一致するので影響なし。
- 担当名: G3（統合担当向けメモ。変更依頼ではない） / 対象ファイル: `README.md` / 内容: 「Pool / Street / MegaStructure / DynamicGrid はスタブ」の記述から MegaStructure を外す。`VARIANTS.MegaStructureGenerator` は 20（サイズ 5 段 × 入口位置 4。`MegaStructureGenerator.ts` の `variants` が registerVariants 経由で入る）。`data/index.ts` の IMPLEMENTED_GENERATORS / ROOMLIKE_GENERATORS には既に登録済みなので変更不要。

## 統合担当（Phase 2 統合）の処理記録

### 処理した依頼

| 依頼元 | 対象 | 処理 |
|---|---|---|
| M-water / M-instances / M-theme / M-snapshot / M-connect / M-rewire / M-signs | `src/modifiers/index.ts` glob の補助ファイル | basename にドットを含むファイル（`<Id>.<name>.ts`）を default export 検査前に `continue`（起動時 warn 0） |
| M-theme / M-connect / M-gate | `GenParams.node` / `role` | `layout.ts` の GenParams に `node?: RoomInstance` と `role?: string` を追加、`WorldManager.layoutFor` が渡す（AmbientCarryover の layout 経路・E08 内部の拡大・RepeatDestination のサイン初期文字が有効） |
| M-connect | `Game.registerWorldHooks` の elevatorCar | フック配線を `src/modifiers/hooks.ts` の `installWorldHooks(world)` に切り出し（Game と tools/seam-stats.mjs が共用）。elevatorCar Adapter の onConnect は paletteFrom の定義で呼ぶ（RepeatDestination を持つ定義に限定） |
| M-ride-audio | `Game.startRide` | `allowSkipAfterSec` / `shake` の既定を `modParams(def, 'VehicleRide')` の `skipAfterSec` / `shake` から |
| M-material | `MaterialLibrary` | `totalEmissiveRadiance *= colorMask;` を emissivemap_fragment 直後に追加。gradT を `smoothstep(0.15, 0.85, t)` に |
| M-light | `SurfaceGeometry` / `ArchitecturalDetails` | blockers から `sky*` を除外（FakeSky の天井箔を solid に戻した）。金物筐体の正規表現に lightGreen / lightYellow |
| M-theme | `RoomBuilder.buildDoor` | ソケット位置を含む kind 'theme'（`params.mod === 'EraPreset'`）ゾーンの `params.door` を扉パネル材質に |
| M-dynamics / G4 | `RoomBuilder.buildDynamics` | (A) 案: ソリッド要素は次の位置がプレイヤー AABB（余白 0.15）と重なるなら時間を進めず待つ（要素ごとに時刻を持つ）。MovingWalls.drive の引き取りはそのまま残す（二重に安全側） |
| M-dynamics | `CorridorGenerator` | DynamicLength 付き定義（E13）は shape 'straight' 固定・長さ [60, 48, 36, 24]。MovingWalls 付き廊下（E18）は 'straight' を 'Z' に置換（rng.shuffle は常に 1 回呼び共有乱数の消費を揃える） |
| M-zones | `GameServices.prepare(roomId)` | 追加（state 'playing' かつ graph にある部屋だけ ensurePrepared） |
| M-gate | `RuntimeContext.interacting` | interactRay からの checkCanOpen だけ `{ ...ctx, interacting: true }`。NoiseGate はこれを優先し、無い環境では従来の回数判定 |
| M-signs | `hud.busy()` | `RuntimeContext.hud.busy?()` を追加（updateHint が扉・EV の操作案内を出しているフレームで true）。TemperatureField はこれを優先し、無ければ DOM 参照 |
| M-shell | `WorldManager.growToFill` | ScaleAnomaly（mode 'room'）の部屋は成長させない |
| G3 | `WorldManager.tryPlaceLegendaryFar` / `resolveSeamTarget` | `levelSpanFor(node, wb)` を finalize と共用し、遠方配置・Seam 配置でも levelSpan を付ける |
| G3 | `RoomLayout.levels` | 追加。MegaStructure `finish` が `c.levels`、StreetGrid が 1、RoadGraph が立体ランプの有無で 2 / 1 を出す。`levelSpanFor` は `layout.levels` を優先 |
| G1 / G4 / G2 | `presets.ts` BASE | PoolCorridor / DynamicGrid / StreetGrid / RoadGraph を追加 |
| G2 | `PropRepetition.apartmentBlock` | Generator が既に棟（wallConcrete / wallBrick、高さ ≥ 5、幅 ≥ 3 のソリッド）を出していれば何もしない |
| G2 | `WorldManager.growToFill` | StreetGenerator（StreetGrid のみ）を対象に追加、maxDim 64 |
| G3（メモ） | README | MegaStructure をスタブから外し、Phase 2 節を追記 |

統合で見つけて直したもの: `SnapshotService.markExcluded` がレイヤ 0 も有効にしていたため、キャプチャ時にレイヤ 3 を外しても表示面が描かれ GL の「Feedback loop formed between Framebuffer and active Texture」警告が出ていた（R09）。レイヤ 3 のみにし、メインカメラで `camera.layers.enable(SNAPSHOT_EXCLUDE_LAYER)`。L03（MegaHall xl）の基準長辺 200 → 180 m（bounds ≤ 200 m）。`tools/seam-stats.mjs` は Modifier（手動登録 + installWorldHooks）を含めて計測するようにした（`--no-mods` で従来どおり）。

### 見送った依頼（理由）

- M-water `RoomLayout.particles` の配列化: RoomBuilder の Points 生成を複数化する変更で、現状 1 領域で動いている。Phase 3。
- M-shell RoomBuilder の照明・ラベルロールの限定（`rollLightsFrom`）: 動作は正しく E03 以外に影響しない。Phase 3。
- M-zones Generator 契約メモ: G3（'ice'）/ G2（'lane'）が契約どおり実装済みで、Modifier 側もそれを使う。変更不要。
- M-gate Pointer Lock のマイク許可後の再取得: 既存の Esc メニュー / クリックでの `input.requestLock()` で復帰できる。E17 の実機確認後に判断（Phase 3）。
- M-gate `resolveSeamTarget` の targetPortalId 内側への着地: `targetExisting` の指示に portal を渡す口が無く、E08 の殻は 4×4 m で差 2.5 m。Phase 3。
- M-rewire return-seam: Game / WorldManager の遷移分岐の追加が要り、現状は閉じ込めにならない。Phase 3。
- M-signs SignAtlas の小セル: R20 の奥の扉が無番になる見た目のみ。Phase 3。
- M-dynamics（任意）E18 の 'straight' 除外: 実施した（上表）。
- G4 FYI（`MovingWalls:grid` 接頭辞）: MovingWalls の match は `'MovingWalls:'` のまま。RoomBuilder 側の停止規則も入ったので二重に安全。
