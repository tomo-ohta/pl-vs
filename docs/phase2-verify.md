
## M-material: ColorMissing（E20）/ RenderStyle（M13, M17）/ MaterialGradient（R15）

### ColorMissing — `?force=E20`
- 見た目: 部屋の中は赤成分が無い（絨毯・木扉・肌色系が緑〜シアン寄りに見える）。扉口から見える隣室は通常色で、境界で赤が戻る。HUD / ミニマップは通常色。
- JS: `const n = game.world.graph.nodes.get(game.currentRoomId); const L = game.world.layoutFor(n); JSON.stringify(L.render.colorMask) === '[0,1,1]'` / `L.lights.every(l => ((l.color >> 16) & 255) === 0)` / 隣室 `game.world.layoutFor(<隣ノード>).render?.colorMask === undefined`
- 既知の制約: 発光箔（lightPanel 等）の emissive はマスクされない（MaterialLibrary への依頼を phase2-requests.md に記載）。scene.fog / hemi は触らない。

### RenderStyle untextured — `?force=M13`
- 見た目: 白無地の部屋。家具・天井パネル灯・入口ラベルが無く、面の向きだけ分かる淡い陰影。扉パネルだけ通常材質（木目 / 金属）。背景・霧が明るい灰白。
- JS: `L.render.style === 'untextured'` / `L.boxes.length === L.shellCount` / `L.lights.length === 0 && L.labels.length === 0` / `L.palette.ambient === 0xffffff` / `game.streaming.built.get(game.currentRoomId).group` 内の Mesh の material.name が `untextured|...` で始まる（扉は `doorGroup` 側で通常名）
- 既知の制約: PointLight 無し（可視本数はダミーで固定されるので材質再コンパイルは起きない）。RoomGenerator 以外の Generator では shellCount が無いと箱を削らない。

### RenderStyle legacy — `?force=M17`
- 見た目: 32 px の Nearest テクスチャで粗いドット感、面取り無し、陰影が 4 段階、ラベルが低解像度、照明がフラット白で本数が半分。
- JS: `L.render.style === 'legacy'` / `L.lights.every(l => l.color === 0xffffff)` / `L.decals === undefined && L.particles === undefined` / built の Mesh material.name に `slegacy` を含む
- 既知の制約: 32 px テクスチャは起動時の画像読込完了時に 1 度生成（未読込中は単色）。

### RenderStyle backside — （M15 はオミット。`?force=M15` で出しても通常描画）
- JS: コンソールに `[RenderStyle] M15: style 'backside' は v1.3 保留` の info が出るだけ。`L.render?.style === undefined`

### MaterialGradient — `?force=R15`
- 見た目: 入口側はコンクリ色 + 冷白パネル、奥へ進むほど床・壁が赤茶（絨毯色）に寄り、パネル灯が暖色（lightWarm）に切り替わる（中間点）。天井配管は奥 40% で消える。
- JS: `L.render.gradient.from === 'floorConcrete' && L.render.gradient.to === 'floorCarpetRed'` / `L.path.length >= 2` / `L.boxes.some(b => b.mat === 'lightWarm') && L.boxes.some(b => b.mat === 'lightPanel')`（直線廊下で長さ十分なとき）/ built の Mesh material.name に `gfloorConcrete>floorCarpetRed@` を含む / 奥側の扉（t ≥ 0.5）の接続で `prefer: 'room'` が渡る（`game.world.log` には出ない。接続先が部屋型になりやすい）
- 既知の制約: ブレンドは材質側の直線軸投影（部屋 bounds を axis に投影）。折れ廊下（L / Z / U）では entry→end の直線方向へ投影するため最初の脚で t がわずかに逆行する。ホテル系優先は `prefer: 'room'`（部屋型 ×2.2 の重み）のみで、ホテルテンプレ限定ではない。

## M-light: LightingPhase / FakeSky

共通の前提: `const node = game.world.graph.get(game.currentRoomId); const L = game.world.layoutFor(node); const built = game.streaming.built.get(game.currentRoomId);`

### LightingPhase mode=seedPhase — `?force=U01`（蛍光灯位相廊下。CorridorGenerator）
- 見た目: 廊下が 6 m 前後の区画ごとに 緑 / 白 / 黄 の蛍光灯に分かれる（隣り合う区画は別の色）。Mid / High では各色の区画が別々の位相で ±15 % ほど明滅し、ごく稀に一瞬暗くなる。Low では静止。
- JS: `new Set(L.boxes.filter(b => /^light(Green|Yellow|Panel)$/.test(b.mat)).map(b => b.mat)).size >= 2`（seed によって 3 色揃わないことはある）
- JS: `L.lights.every(l => [0xc8f0c0, 0xe9f0ff, 0xf6e6a0].includes(l.color))`
- JS（Mid / High）: `built.effects.length >= 1` かつ 発光メッシュの材質が部屋専用に複製されている: `built.group.children.filter(o => o.isMesh && /^light(Green|Yellow|Panel)/.test(o.material.name)).every(o => o.userData.disposable?.includes(o.material))`。emissiveIntensity を数秒おきに読むと 2.0〜2.8 で揺れる。
- JS（Low）: `game.tier.flicker === false` のとき `built.effects.length === 0`（他 Modifier の効果が無い前提）。
- 既知の制約: lightGreen / lightYellow のパネルには金物の筐体（ArchitecturalDetails）が付かない（phase2-requests.md）。

### LightingPhase mode=unpowered — `?force=R02`（無電源アーケード。GridGenerator RetailGrid）
- 見た目: 天井灯は全て消灯（暗い筐体だけ残る）。棚の陳列箱の約 4 割が青白く光る画面（screenGlow）になり、部屋全体が暗い青。壁・床に画面の光が焼き込まれる。
- JS: `L.lights.length >= 4 && L.lights.length <= 6 && L.lights.every(l => l.color === 0x9fd0ff && l.distance === 5)`
- JS: `L.boxes.filter(b => b.mat === 'screenGlow').length >= 4` / `L.boxes.some(b => b.mat === 'lightPanel' && !b.solid && b.max[1] > L.height - 0.3) === false`
- JS: `L.lighting.areaEmitters === true && L.palette.ambient === 0x202428`
- 既知の制約: 棚の無いバリアント（代替部屋）では壁沿いに筐体（furnitureDark の箱 + 画面）を最大 6 台置く。

### LightingPhase mode=daylight + FakeSky skyPreset=noonSun — `?force=E04`（地下の昼光室。RoomGenerator LargeRoom）
- 見た目: 天井が青い空（skyNoon の発光面）で、コンクリートの桁が周囲と 4 m 間隔の梁として空の手前に残る。天井のパネル灯は無い。壁・床に低い（高度 30°）暖色の日射と影が焼き込まれ、日射は進行用出口（entry 以外の最初のソケット）の側から差す。動的光は中央 1 灯のみ。
- JS: `L.boxes.some(b => b.mat === 'skyNoon')` / `L.lights.length === 1` / `L.palette.ambient === 0xb8c4d8`
- JS: `const d = L.lighting.directional[0]; Math.abs(Math.asin(-d.dir[1]) * 180 / Math.PI - 30) < 0.5 && d.color === 0xffe2b8`
- JS: 日射方位 = 出口の外向き: `const e = L.sockets.find(s => s.id !== 'entry' && s.type !== 'hole'); const v = [[0,1],[1,0],[0,-1],[-1,0]][e.dir]; Math.sign(-d.dir[0]) === Math.sign(v[0]) && Math.sign(-d.dir[2]) === Math.sign(v[1])`
- JS: `L.render.sky.preset === 'noon'` / 梁: `L.boxes.filter(b => b.mat === 'columnConcrete' && !b.solid && b.max[1] === L.height).length > 0`
- 既知の制約: 天井箔は非ソリッド（コライダなし。SurfaceGeometry が sky* を遮蔽体から除外するまで）。空は天井高の発光面でスカイボックスではない。

### LightingPhase mode=allWindowsLit — `?force=L10`（夜間郊外住宅地。StreetGenerator スタブ = LargeRoom 代替。Legendary なので depth 20 以上で出す）
- 見た目: 天井灯は消え、壁面に 2.6 m 間隔で暖色に光る窓（十字の桟付き。高い部屋は 2 段）が並ぶ。1 割ほどは暗い窓。点光源は橙のナトリウム灯色。窓の光が床・壁に焼き込まれる。
- JS: `L.boxes.filter(b => b.mat === 'windowLit').length >= 8`（上限 80）/ `L.lights.every(l => l.color === 0xffa040)` / `L.lighting.areaEmitters === true` / `L.palette.ambient === 0x2a2c38`
- JS: 扉開口と窓が重ならない: `L.sockets.filter(s => s.type !== 'hole').every(s => !L.boxes.some(b => b.mat === 'windowLit' && Math.hypot((b.min[0]+b.max[0])/2 - s.pos[0], (b.min[2]+b.max[2])/2 - s.pos[2]) < s.width/2 + 0.9))`
- 既知の制約: StreetGenerator 実装後は既存の windowDark 箱を windowLit に点灯するだけになる（簡易版の窓帯は出さない）。

### LightingPhase mode=singleLight — `?force=M14`（照明一本の虚空。CorridorGenerator Bridge。Mythic なので depth 35 以上）
- 見た目: 真っ黒（FogDepth #000000 2/18）の歩廊の中央に、吊り金物で下がった蛍光灯が 1 本だけ光る。他の光源なし。
- JS: `L.lights.length === 1 && L.palette.ambient === 0` / `L.boxes.filter(b => b.mat === 'lightPanel').length === 1`
- JS: 器具と光源が同じ位置: `const f = L.boxes.find(b => b.mat === 'lightPanel'); Math.hypot((f.min[0]+f.max[0])/2 - L.lights[0].pos[0], (f.min[2]+f.max[2])/2 - L.lights[0].pos[2]) < 0.01`
- 既知の制約: 吊り棒は天井が無いので 3.35 m（上階の床の下）で終わる。

### FakeSky skyPreset=overcastNoon — `?force=U20`（屋内モーテル中庭。AtriumGenerator）
- 見た目: 吹抜の天井が曇天（skyOvercast）の発光面になり、周囲の桁と梁（columnConcrete）が空の手前に残る。天窓帯・天井のパネル灯は無く、吊りペンダント灯（lightWarm）は残る。動的光は中央 1 灯。Mid / High では雲がごくゆっくり流れる（10 秒で UV 0.02）。
- JS: `L.boxes.some(b => b.mat === 'skyOvercast') && !L.boxes.some(b => b.mat === L.palette.ceiling && b.min[1] >= L.height - 0.01)`
- JS: `L.lights.length === 1 && L.lighting.directional.length === 1 && !!L.lighting.skyAmbient && L.render.sky.preset === 'overcast' && L.palette.ambient === 0x9aa2ac`
- JS（Mid / High）: `built.effects.length >= 1`、空メッシュの材質・テクスチャが部屋専用: `const m = built.group.children.find(o => o.isMesh && /^skyOvercast/.test(o.material.name)); m.userData.disposable.includes(m.material) && m.material.map !== game.materials.get('skyOvercast').map`
- 既知の制約: 同上（非ソリッド天井）。太陽方位は rng（seed 依存）。

### FakeSky skyPreset=dusk — `?force=R04`（屋内住宅街。StreetGenerator スタブ = LargeRoom 代替。Rare なので depth 4 以上）
- 見た目: 天井が夕焼け（skyDusk）、梁は暗色（wallDark）。高度 18° の橙の日射が壁の片側を染め、反対側に長い影が焼き込まれる。
- JS: `L.boxes.some(b => b.mat === 'skyDusk') && L.render.sky.preset === 'dusk' && L.palette.ambient === 0x7a5c50`
- JS: `Math.abs(Math.asin(-L.lighting.directional[0].dir[1]) * 180 / Math.PI - 18) < 0.5`

## M-water: Wetness / ShallowWater / ParticleDetail

共通の取り方: `const id = game.currentRoomId, node = game.world.graph.get(id), L = game.world.layoutFor(node), B = game.streaming.built.get(id);`

### Wetness — U08（wetness 0.8）/ U13（0.4 + FogDepth）/ L09（0.7 + mist）
- `?force=U08`（廊下）、`?force=U13`（更衣室）、`?force=L09`（LargeRoom 代替の大部屋）
- 見た目: 床が暗く沈んで反射が強い（roughness ↓ / envMap ↑）。床に不規則な水たまり（水材質、UV が流れる）、外壁の足元に暗い濡れ帯（高さ 0.27〜0.3 m。扉の前は途切れる）。mid / high のみ水たまりと帯が出る（`game.tier.decals`）。low は材質の濡れだけ。
- 事実: `L.render.wetness === 0.8`（U08）/ `0.4`（U13）/ `0.7`（L09）。`L.decals.filter(d => d.mat === 'water' && d.normal === 'y').length` が 1〜40。`L.decals.some(d => d.mat === 'wallDark')`。`game.audio.debug()` の床種が wet（足音に水しぶきが混じる）。
- 既知の制約: RoomBuilder は render.wetness を部屋の全材質に掛ける（床だけではない）。細い廊下では水たまりが 1〜3 個しか置けないことがある。

### Wetness + ParticleDetail(rain) — U07（室内雨漏り広場。雨域だけ濡れる）
- `?force=U07`（Atrium）
- 見た目: 天井の 1 か所（辺 6 m 程度の四角）から雨が床まで落ち続ける（縦長の粒。領域内でラップ）。その真下の床に水溜まりの薄い水面（常に出る）、周囲 1.5 m 以内に水たまり decals（mid / high）。部屋全体の床は濡れない。
- 事実: `L.particles.type === 'rain'` かつ `L.particles.aabb` が部屋より小さい（幅 ≤ 8 m）。`L.render?.wetness === undefined`（部屋全体の濡れは無い）。`L.boxes.some(b => b.mat === 'water' && !b.solid && b.max[1] < 0.05)`（水溜まり箔 1 枚）。`B.group.getObjectByName('particles/rain').geometry.getAttribute('position').count <= game.tier.particleCap`。`B.effects.length >= 1`（パーティクルの時間 uniform 更新）。
- 既知の制約: 雨域は 1 部屋 1 か所（ParticleSpec が単数のため）。rooms.json の順序が ParticleDetail → Wetness であることに依存（逆なら部屋全体を濡らす通常動作）。

### ParticleDetail — U12（steam 0.3）/ R19（steam 0.2）/ L09（mist 0.5）/ L19（snow 0.3）
- `?force=U12` / `?force=R19`: カウンター・卓（内装の天板 0.7〜1.3 m の箱）の上 1.2 m に湯気が 20〜60 粒ゆっくり上る。事実: `L.particles.type === 'steam'`、`(a => (a.max[0]-a.min[0])*(a.max[2]-a.min[2]))(L.particles.aabb) < 60`（発生源は局所）、`Math.round(L.particles.density * vol)` が 20〜60。
- `?force=L09`: 床上 0〜0.6 m に大きな柔らかい霧（size 2.2）が漂う。事実: `L.particles.type === 'mist' && L.particles.aabb.max[1] === 0.6`、`L.particles.size === 2.2`。
- `?force=L19`: 部屋全体に雪が横揺れしながら降り、床が白い（'snow' 材の薄い箔）。事実: `L.particles.type === 'snow'`、`L.boxes.slice(0, L.shellCount).some(b => b.mat === 'snow')`、Points の count が `game.tier.particleCap` 以下（low 150 / mid 400 / high 1000）。
- 既知の制約: respawn は無視（全 type ループ再生）。粒数は Tier の particleCap で切られる（見た目だけ変わる）。L09 / L19 は MegaStructure スタブ（LargeRoom 代替）上で動く。

### ShallowWater — R01（depth 0.25）/ R14（depth 0.3）/ L02（depth 0.5 + 桟橋）
- `?force=R14`（GenericRoom）/ `?force=R01`（PoolGenerator スタブ → LargeRoom 相当）
- 見た目: 床全面に半透明の水面（'waterShallow'、UV が流れる）。各扉の内側に乾いた前庭（奥行き 1.3 m 以上）と、コの字の低い縁（'trim'、高さ 0.3 m）。隣室から扉越しに水面は見えず、縁は歩くだけで越えられる（ジャンプ不要）。外壁の足元に暗い濡れ帯（水面 +0.12 m まで）。床穴の周囲は水面がくり抜かれている。
- 事実: `L.zones.filter(z => z.kind === 'water').length > 0` かつ `.every(z => z.params.slow === 0.7)`。`L.boxes.filter(b => b.mat === 'waterShallow').length === L.zones.filter(z => z.kind === 'water').length`。`L.boxes.filter(b => b.mat === 'trim' && b.solid).length === 3 * L.sockets.filter(s => s.type !== 'hole').length`。`game.streaming.zonesOf(id).length > 0`。水中で歩くと速度が 0.7 倍（`game.player.vel` の水平成分が歩行 2.88 → 約 2.0 m/s）、前庭・縁の上では減速しない。足音が水（`game.audio.debug()`）。`L.render.wetness === 0.3`。
- `?force=L02`（室内海洋。MegaStructure スタブ → LargeRoom 代替、VehicleRide は別担当）
- 見た目: 水深 0.5 m。各扉の前庭から縁（0.3 m）→ 木のデッキ（上面 0.6 m。幅 2.4 m）に 0.3 刻みで登れ、デッキは L 字に中央のハブ（3.6 m 角）へ集まる。入口と全出口をデッキだけで（水に入らず）往復できる。翼矩形の扉は共有辺の中点を経由する。前庭の縁の上には水面（0.28〜0.5 m）の切り口が「水の壁」として 0.2 m 見える。デッキ縁に杭。デッキに重なる家具・柱は無い。
- 事実: `L.boxes.filter(b => b.mat === 'floorWood' && b.solid).length >= L.sockets.filter(s => s.type !== 'hole').length`。デッキ上面 `.every(b => Math.abs(b.max[1] - 0.6) < 1e-6)`。デッキ上に立つと `game.streaming.zonesOf(id)` の water ゾーンに足元（y+0.1 = 0.7）が入らない（減速しない）。水に落ちると 0.7 倍。
- 既知の制約: 桟橋は「前庭 → 壁から垂直 → ハブ座標」の L 字の星形で、床穴を避けるときだけ順序を入れ替える（床穴を覆うことが稀にある。覆った場合その穴の行き先には行けない）。水面箔は上下 2 面が重なって見えるため実効の不透明度が設計値より高い。杭はソリッド（デッキ端で引っかかることがある）。E03 のロールとは併用しない前提（水面はシェル側なので回らない）。

## M-instances: InstanceOvergrowth / PropRepetition / PropOrientation

共通の確認式（`node = game.world.graph.nodes.get(id)`、`L = game.world.layoutFor(node)`、`built = game.streaming.built.get(id)`。id は現在部屋 `game.currentRoomId`）:
- 通路が空いている: 入口から各出口へ真っ直ぐ歩いて行ける（幅 1.2 m の直線帯 + 扉前 ±1.6 m に solid 箱が無い）。式: `L.boxes.slice(L.shellCount).filter(b => b.solid).length > 0` かつ扉に到達できる。
- 入室前後で `L.boxes.length` と `(L.instances ?? []).reduce((n, s) => n + s.transforms.length, 0)` が変わらない。
- Tier を low にしても solid 箱の数（`L.boxes.filter(b => b.solid).length`）は同じで、InstancedMesh の表示数だけ減る（`built.group` 配下の `InstancedMesh.count` の合計が high の約 0.4 倍）。

### InstanceOvergrowth
- 対象 ID: R07（`?force=R07`。OrganicZone、density 0.7、blocksPath）/ L14（`?force=L14`。MegaAtrium は LargeRoom fallback、density 0.9、blocksPath）/ L03（`?force=L03`。MegaHall fallback、propId wheat、density 1.0）。
- R07 / L14 の見た目: 床・低い家具の上・壁際に葉の塊（plant の箔 InstancedMesh）と下草（grass）。出入口の周り 1.8 m は空き、出口へ向かうほど疎（6 m 以上離れると密）。solid な 'plant' 箱（RoomBuilder が球体に描く）が 2〜3 列の生垣（1.4 m の抜け道付き）とプランターとして立つ。式: `L.instances.length === 2`（plant, grass）、`L.instances[0].transforms.length > 300`（28×34 の fallback で約 600〜800）、`L.boxes.slice(L.shellCount).filter(b => b.solid && b.mat === 'plant').length >= 10`。生垣は通路に掛からない（歩いて全出口へ行ける）。
- L03 の見た目: 倉庫の家具が消え、部屋一面に細い茎（grass、高さ約 1.05 m）と穂（boxCardboard、茎 2 本に 1 個）。入口→各出口の幅 2 m の農道と扉前が空く。出口脇に木箱（boxCardboard、solid）が最大で出口数だけ。式: `L.instances.map(s => s.mat)` が `['grass','boxCardboard']`、`L.instances[0].transforms.length` が 5000〜9000（上限 9000）。
- 既知の制約: L03 / L14 は MegaStructureGenerator 未実装のため LargeRoom fallback（最大 28×34 m）上。風揺れ（材質 uniform）は未実装で静止。麦は箱（板 2 枚の cross ではない）。密度場のノイズは rng なのでシード固定で再現する。

### PropRepetition
- 対象 ID と `?force=` : U11 luggage 0.8（LargeRoom）/ U15 sameProduct 1.0（RetailGrid）/ R03 banquetTable 1.0（LargeRoom + FogDepth）/ R20 storageDoor 1.0（StorageGrid + DuplicateNumber）/ L13 serverRack 1.0（ServerGrid）/ L17 apartmentBlock 1.0（StreetGrid fallback + ScaleAnomaly）。
- U11: 元の家具が消え、内側 2.4 m 内に矩形リングのコンベア（solid 'metal'、高さ 0.9、幅 1.0、上面に非 solid の 'rubber' ベルト）。通路・扉前に掛かる区間は切れる。ベルト上に同一スーツケース（upholstery 0.7×0.3×0.5、金属の取手）が約 1.1 m 間隔（density 0.8 → 1.375 m）。入口内側上部に発光サイン「BAGGAGE CLAIM」。式: `L.instances.map(s => s.mat)` = `['upholstery','metal']`、`L.signs.length === 1`、`L.boxes.slice(L.shellCount).some(b => b.mat === 'rubber')`。
- U15: 棚（shelfMetal）の詰め物（furnitureLight の小箱）が消え、全棚の両面・各段に同一色の商品（0.28×0.36×0.24、0.32 m 間隔、seed で 1 材質: boxCardboard / carPaint / wallGreen / yellowLine / upholstery / lightGreen のどれか）。式: `L.instances.length === 1 && L.instances[0].transforms.length > 1000`（30×36 で約 2500）、`L.boxes.slice(L.shellCount).filter(b => !b.solid && b.mat === 'furnitureLight').length === 0`。
- R03: 元の家具が消え、丸卓風の卓（furnitureLight 1.6×1.6×0.75 solid + 白いクロス）が 3.2 m 格子に並び、各卓に椅子 4 脚（座面 upholstery + 背 furnitureDark、卓を向く。非 solid）。式: `L.boxes.slice(L.shellCount).filter(b => b.solid && b.mat === 'furnitureLight').length` が 20〜40、`L.instances.map(s => s.transforms.length)` がその 4 倍ずつ。FogDepth の霧は従来どおり。
- R20: 金属ブロック（metal、solid）の両面に 2.4 m 間隔で扉板（非 solid 'doorMetal' 2.2×2.4×0.05、shellCount 以降）+ 枠（wallDark）+ 取手（metal instances）+ シャッターの横筋（wallDark instances）。式: `L.boxes.slice(L.shellCount).filter(b => !b.solid && b.mat === 'doorMetal').length` が 100〜250、`L.instances.map(s => s.mat)` = `['metal','wallDark']`。DuplicateNumber はこの扉板に番号を貼る想定（同担当の項を参照）。
- L13: ラック（furnitureDark ブロック）の両面に 0.6 m ピッチの金属レール、0.32 m ごとの ledBlue 帯、3 台に 1 つ screenGlow。元の ledBlue 詰め物は消える。`L.chunkSize === 24`。式: `L.instances.map(s => s.mat)` = `['metal','ledBlue','screenGlow']`、合計 3000〜8000（上限 12000 を超えると帯の間隔を広げる）。
- L17: 家具・柱が消え、団地の棟（wallConcrete 6×3×(h−0.5) solid、屋上縁 wallDark、入口扉 doorMetal 非 solid）が格子に並び、長辺に窓（windowLit 35% / windowDark）、棟の角に街灯（metal 柱 + sodiumLight）。通路に阻まれて 6 棟未満なら 4.2 m 幅に縮む。式: `L.boxes.slice(L.shellCount).filter(b => b.solid && b.mat === 'wallConcrete').length >= 3`、`L.instances.some(s => s.mat === 'windowLit' || s.mat === 'windowDark')`。ScaleAnomaly（別担当）が後段で ×1.5 する。
- 既知の制約: L17 は StreetGenerator 未実装のため LargeRoom fallback 上の暫定（棟は 1 階建て相当、28×34 m で 4〜8 棟）。R03 の「一定距離ごとに同型出口」（出口の等間隔化）はソケットを動かさないため未実装（卓の格子のみ）。propId が上記 6 種以外なら木箱（boxCardboard 1 m 立方）を格子に置く既定動作。

### PropOrientation
- 対象 ID: U10（`?force=U10`。Classroom、facing 'wall'）。
- 見た目: 机が連続スラブではなく 1 台ずつ（furnitureLight 0.6×0.5×0.72 solid）+ 椅子（座面 + 背、furnitureDark 非 solid）で、全ての机が「ソケットの無い最長の壁」を向く（椅子の背が反対側）。向いた壁の内面に黒板（wallGreen 幅 ≤7 m、高さ 0.9〜2.1）、その上に時計サイン（`kind 'clock'`、'10:08'、`id 'PropOrientation.clock'`）、壁から 1 m に教卓（furnitureDark 1.4×0.7×0.76 solid）。入口の壁（南）や出口のある壁は向かない。
- 式: `L.signs.find(s => s.id === 'PropOrientation.clock')` がある。`d = (L.signs[0].dir + 2) % 4` が机の向き（壁の方向）で、`L.sockets.filter(s => s.type !== 'hole' && s.dir === d).length === 0`（全辺にソケットがある場合はソケット最少の辺）。机の寸法: `d` が 0/2 なら x 幅 0.6・z 奥行 0.5、1/3 なら x 0.5・z 0.6（`L.boxes.slice(L.shellCount).filter(b => b.solid && b.mat === 'furnitureLight')`）。机の数は 16×18 の教室で 50〜70。
- 既知の制約: facing 'oneWay'（seed で 1 方向）/ 'random'（机ごと乱択。黒板は北壁）はデータに使用部屋が無く未検証。ArchitecturalDetails の机化（天板 + 脚）はサイズ条件外なので小箱のまま（意図どおり）。翼付き（L 字）教室では翼にも同じ向きの机を置く。

## M-theme: EraPreset（R11, E02）/ ZoneThemeShuffle（L05, L20）/ AmbientCarryover（M18）

共通の前置き（コンソール）: `const id = game.currentRoomId, n = game.world.graph.nodes.get(id), L = game.world.layoutFor(n), Z = (L.zones ?? []).filter(z => z.kind === 'theme');`

### EraPreset — `?force=R11`（年代混在ホテル。CorridorGenerator）
- 見た目: 折れ廊下が入口から 8 m ごとに区画に分かれ、区画ごとに床・壁・天井・客室ドア帯・天井灯の色が変わる（1970s: 赤絨毯 + ベージュ壁 + 電球色 / 1990s: リノリウム + 白壁 + 蛍光灯 / 2010s: 木床 + 暗い壁 + 白色）。境目の床に 5 cm の細い木色（trim）帯。Portal の扉パネルは palette.door のまま（依頼済み・任意）。
- JS: `Z.length >= 2 && Z.every(z => z.params.mod === 'EraPreset')` / `new Set(Z.map(z => z.params.era)).size >= 2` / `Z[0].params.era === '1970s'`（入口側は eras[0]）/ `L.boxes.filter(b => b.mat === 'trim' && !b.solid && b.max[1] < 0.02).length >= Z.length - L.footprint.length`（境目の帯）/ `new Set(L.lights.map(l => l.color)).size >= 2`（区画で照明色が違う）/ 区画を歩いて越えると `game.audio.debug()` のプリセットラベルが「空調・古いチャイム・<年代ラベル>」に切り替わる（年代ラベル: 1970s 低いハム・遠いBGM / 1990s 蛍光灯・空調 / 2010s 空調・微かな電子表示音）。
- 既知の制約: 8 m の刻みは入口からの累積距離で決めるため、折れ目の直後に 0.3〜2 m の短い区画ができることがある。ゾーンの ambient は部屋で 1 つ（光色の差で年代感）。

### EraPreset — `?force=E02`（年代階段。VerticalGenerator）
- 見た目: 下階と上階で床・壁・天井・天井灯の色が違う（seed で eras[1960s/1980s/2000s/2020s] から 2 つ。下が古い）。階段（floorConcrete = palette.floor）も下階の年代の床材になる。壁は y = 3.6 m で色が切り替わる。
- JS: `Z.length === 2` / `Z.map(z => z.params.level).sort().join() === '0,1'` / `parseInt(Z.find(z => z.params.level === 0).params.era) < parseInt(Z.find(z => z.params.level === 1).params.era)`（下が古い）/ `L.boxes.filter(b => b.mat.startsWith('wall') && b.min[1] < 3.5 && b.max[1] > 3.7).length === 0`（壁が 3.6 で分割済み）/ `L.shellCount === undefined`（VerticalGenerator は shellCount を持たない。触らない）/ 階段を上ると `game.audio.debug()` のプリセットが上階の年代ラベルに変わる（audioPreset「年代別環境音」はメタ指定なので年代ラベルのみ。1960s 回線ノイズ・低いハム・時計 / 1980s モニター・蛍光灯 / 2000s PCファン・電子音 / 2020s 静かな空調）。
- 既知の制約: 2 レベル固定（v1.3 前提）。エレベーター籠（metal）は年代の対象外。

### ZoneThemeShuffle — `?force=L05`（campus）/ `?force=L20`（any）
- 見た目: 大部屋（MegaStructure / Street スタブ → LargeRoom 代替）の主矩形が不均等な格子（各セル 6 m 以上）で 5〜8 ゾーンに分かれ、ゾーンごとに床・壁・天井・天井灯の色と家具が変わる（教室: 机列 + 黒板 / 体育館: 黄色のコートライン + ベンチ / プール: 半透明の浅い水面 + 縁石 / 通路: ロッカー / 展示室: 間仕切り + 展示台 / 遊戯室: 色つきの島 / 図書室: 棚列 …。L20 はさらに 事務室・売店・小劇場・駐車区画・倉庫・休憩室・温室・機械室・医務室）。ゾーン境界の床に色帯（L05 は木色 trim / L20 は黄色）、高さ 2.2 m の白い間仕切り（各境界に 2.8 m の抜け道、上端に横桟）。翼矩形は 1 ゾーン。入口・出口の前 1.8 m は空いている。
- JS: `Z.length >= 4 && Z.every(z => z.params.mod === 'ZoneThemeShuffle')` / `Z.every(z => z.params.pool === 'campus')`（L05）または `'any'`（L20）/ `new Set(Z.map(z => z.params.preset)).size >= Math.min(Z.length, 5)`（重複を避けて割当）/ `L.boxes.filter(b => b.mat === 'wallWhite' && b.solid && Math.abs(b.max[1] - Math.min(2.2, L.height - 0.3)) < 1e-6).length > 0`（間仕切り）/ プールがあれば `L.zones.some(z => z.kind === 'water' && z.params.slow === 0.55)` かつ `L.boxes.some(b => b.mat === 'waterShallow')`、水に入ると歩行が 0.55 倍で足音が水 / `L.lights.length >= Z.length`（ゾーンごとに照明）/ ミニマップにゾーンの内訳線が出る / `game.streaming.built.get(id).zones.filter(z => z.kind === 'theme').length === Z.length`。
- 既知の制約: MegaStructureGenerator / StreetGenerator は Phase 3 のスタブなので LargeRoom（最大 28×34 m）上の暫定表示。Generator が将来 kind 'theme' のゾーンを出した場合は、それをそのまま使って材質・照明色・params.preset だけ付け、内装は触らない。ゾーンの audio ラベルは params.audio に持つだけ（再生は audioZones 経路の実装後）。床穴があるゾーンには水を張らない。

### AmbientCarryover — `?force=M18`（天候記憶室。Mythic）
- 手順: Rare 以上の部屋（例 `?force=R06` の FogDepth 部屋、または任意の Rare / Epic）を先に訪れてから、その次の部屋に `?force=M18` で M18 を出す（M18 ノードは親部屋に入室した時点で作られ、その時の visitLog で決まる）。
- 見た目: SmallRoom の形（床・壁・天井は M18 のまま）で、霧・背景色・半球光・天井灯の材質と色がコピー元の部屋と同じになる（R06 なら青い霧 near/far も同じ）。入室すると環境音がコピー元の audioPreset（R06 なら「低周波・水音」）に切り替わる。
- JS: `const s = n.state.modifierState.AmbientCarryover; s.sourceRoomId`（コピー元 roomId）/ `s.reason === 'rare'`（直前の Rare 以上）または `'last'`（Rare 以上が無く直前訪問部屋）/ `const S = game.world.layoutFor(game.world.graph.nodes.get(s.sourceRoomId)); L.palette.fog === S.palette.fog && L.palette.ambient === S.palette.ambient && L.palette.lightColor === S.palette.lightColor` / FogDepth 元なら `JSON.stringify(game.streaming.built.get(id).fog) === JSON.stringify(S.render.fog)` / `game.audio.debug()` のラベルが `s.audioPreset` / セーブ → リロード後も `s` が同じ（JSON 化可能な値のみ）。
- 既知の制約: layout フックは GenParams に node が無いと保存値を読めないため、現状は build フックのフォールバック（キャッシュ済み RoomLayout の palette と BuiltRoom.fog / PointLight 色を差し替え）で動く。この経路では頂点の焼き込み色（SurfaceLighting）だけコピー元の色にならない（`GenParams.node` の依頼が入れば layout 段階で反映される）。開始直後で visitLog に部屋が無い場合はコピー元なし（既定のパレット）。コピー元の環境系 Modifier（ParticleDetail / Wetness / LightingPhase）の継ぎ足しは未実装（FogDepth の fog だけ render.fog 経由でコピー）。

## M-proxy: MirrorOffset — 検証部屋 U09（?force=U09）
- 見た目: Restroom（1 矩形）の中ほどに壁一枚のスラブ（下 0.9 m 腰壁 / 高さ 0.9〜2.2 m のガラス帯 / 上帯）が立ち、手前に洗面カウンター（0.55 × 0.85 m）。ガラス越しに「同じ部屋」が見える（実側の家具・天井パネル・カウンターの反転コピー。0.3 m 横にずれている）。奥の壁には疑似扉（パネル + 枠。開かない・接続なし）。鏡の中に自分の代わりの黒いカプセルが 0.5 s 遅れて動く（Low Tier は遅れなし）。
- 位置: 鏡は入口正面（z 軸）優先、無理なら左右（x 軸）。ソケットの都合で中央に置けないときは鏡像側が浅くなり、反射は奥の壁で切れる（奥壁の扉だけは鏡像側の壁に置く）。
- JS 確認:
  - `const n = game.world.graph.get(game.currentRoomId); const L = game.world.layoutFor(n); L.mirrors.length === 1`（鏡なし生成なら 0。Node 計測では 300 ケース中 233 で鏡あり。極小バリアント 4×4 m 以下や穴・扉が鏡面近くにある場合は 0）
  - `L.boxes.filter(b => b.mat === 'glass' && b.solid).length === 1`（ガラススラブはソリッド = 通れない）
  - `L.boxes.slice(L.shellCount).some(b => b.mat === L.palette.door && !b.solid)`（疑似扉パネルがある）
  - `game.streaming.built.get(game.currentRoomId).effects.length >= 1` と `game.streaming.built.get(game.currentRoomId).group.getObjectByName('MirrorOffset/proxy')` が存在し、実側に立つと `.visible === true`、鏡から 0.5 s 遅れて追従する（立ち止まって 0.5 s 後に止まる）。しゃがむと Y スケール 0.5
  - 入室前後で `L.boxes.length` が変わらない（layout フックのみでジオメトリ確定）
- 既知の制約: 鏡は透明ガラス板 + 反転ジオメトリなので、鏡面の反射（周囲の映り込み）は無い。反転コピーはずらしのため側壁から 0.3 m 浮く / 壁に食い込んで切れることがある（意図: 反射不一致）。ラベルの文字は反転しない。

## M-proxy: InvertedShadow — 検証部屋 E06（?force=E06）
- 見た目: 天井灯グリッドが全部消灯（lightOff）で、中央付近（進行用出口の反対側寄り）に 1 枚だけ大きな発光パネル + 強い PointLight。柱・家具・間仕切りの足元に黒い半透明の箔（ブロブ影）があり、光源側へ伸びている（通常の影と逆）。自分の足元にも楕円のブロブが光源側へ伸びて追従する。焼き込み陰影に遮蔽影が無い（家具の裏が暗くならない）。
- JS 確認:
  - `const n = game.world.graph.get(game.currentRoomId); const L = game.world.layoutFor(n); L.lights.length === 1 && L.lighting.occlusion === false`
  - `L.boxes.filter(b => b.mat === 'shadowDecal').length > 0`（Node 計測平均 12 枚/部屋。Tier に依らず出る = L.boxes 直置き）
  - `L.boxes.slice(L.shellCount).filter(b => !b.solid && /^(lightPanel|lightWarm)$/.test(b.mat) && b.max[1]-b.min[1] < 0.12).length === 1`（発光パネルは 1 枚）
  - `game.streaming.built.get(game.currentRoomId).group.getObjectByName('InvertedShadow/playerBlob').visible === true`（部屋の中に居るとき）。光源の下に立つとブロブが足元に縮み、離れると光源側へ伸びる
  - 影の向き: 任意の柱について、デカール中心が柱中心より光源（`L.lights[0].pos`）側にある
- 既知の制約: PointLight 強度は `palette.lightIntensity × 1.6 × clamp(対角/10, 1, 4)`（仮バランス。眩しすぎ / 暗すぎなら InvertedShadow.ts の boost を調整）。デカールは軸並行の矩形（箱の足元 + 光源方向へ高さ × 0.6 の伸び）で、斜め方向は太めになる。

## M-snapshot: PastWindow / GraphReference / SelfMap

### PastWindow（R09 監視映画館 = mode screen）
- 部屋: `?force=R09`（Rare。depth 4 以上で抽選）。
- 見た目: 劇場（Theater）の白いスクリーンが黒い箔になり、その手前に劇場後方上部の固定カメラ映像が映る。入室すると映像の中に自分（黒いカプセル）が **3 秒遅れて** 入ってくる（high / mid Tier）。low Tier（rtUpdateHz 0）は 3 秒ごとの静止画（0〜3 秒遅れ）。スクリーン自身は映像に写らない（黒い面）。映像には入口と出口の扉が入る構図。
- JS:
  - `game.streaming.built.get(id).effects.length >= 1`（R09 の BuiltRoom。id は `game.currentRoomId`）
  - `game.streaming.built.get(id).group.children.find(o => o.name === 'PastWindow/screen')` が存在し、`.material.map` が数フレーム後に `snapshot/N` という名前のテクスチャ（`game.snapshots.activeCount >= 1`）
  - `game.world.layoutFor(game.world.graph.get(id)).boxes.filter(b => b.mat === 'void' && !b.solid).length === 1`（スクリーン箔）
  - 入室前後で `layoutFor(node).boxes.length` が変わらない
- 既知の制約: 映像は劇場のカメラの「現在」を撮り Proxy だけを 3 秒前の姿勢に置く方式なので、扉の開閉は遅延しない。Tier high でも RT 更新は 24 Hz 上限。

### PastWindow（E12 過去窓回廊 = mode window）
- 部屋: `?force=E12`（Epic。depth 10 以上）。
- 見た目: 廊下の外壁に額縁付きの窓が 3 枚（入口から近い順）。10 秒ごとに現在の視点が撮られ、入口に近い窓が最も古い映像、奥の窓が最新。最初の 1 枚は部屋が見えた瞬間に撮られ、残りは 10 秒ごとに埋まる（それまで黒）。全 Tier 同一。
- JS:
  - `game.streaming.built.get(id).group.children.filter(o => o.name === 'PastWindow/screen').length === 3`（壁が短い variant では 1〜2）
  - `game.snapshots.activeCount` が時間とともに 1 → 3 まで増える（他のスナップショット利用部屋が同時に見えていなければ）
  - `game.world.layoutFor(node).boxes.filter(b => b.mat === 'void' && !b.solid).length` が窓の数と一致
- 既知の制約: SnapshotService のスロット（6）が MirrorOffset / R09 と競合したときは取れた枚数だけ表示。スナップショット履歴は保存しない（ロード直後は黒から埋まる）。

### GraphReference（E14 adjacent / L16 past / M16 unlisted）
- 部屋: `?force=E14` / `?force=L16` / `?force=M16`（Epic / Legendary / Mythic。depth 10 / 20 / 35 以上）。
- 見た目: Gallery の外壁に額縁（trim）+ 写真面 + 名札（SignAtlas plate）が count 枚（E14 4 / L16 8 / M16 12）。写真面は対象部屋の footprint シルエット（レア度色の枠 + 右上のレア度ドット）。名札は定義名 + カテゴリ。
  - E14: 部屋が見えた最初のフレームで node.portals の行き先（Adapter は先の部屋まで辿る）から確定。施錠・行き先無しは真っ黒、Seam 先未確定は「？」。予測ではない（`world.graph.get(p.targetRoomId).definitionId` と一致）。
  - L16: 訪問ログ（`game.world.graph.visitLog`）の新しい順に相異なる定義。訪問数が足りない分は「—」の空額縁。
  - M16: 未発見（`discoveredIds` に無い）定義から seed で 12 件。名札は定義名のみ・枠は灰色（レア度・ID は出さない）。
- JS:
  - `node.state.modifierState.GraphReference` が `{ mode, count, exhibits }`（E14 は初回可視まで `exhibits: null`、可視後に配列）
  - `game.world.layoutFor(node).signs.filter(s => s.id?.startsWith('gr:')).length === count`（壁が足りない variant ではそれ以下）
  - `game.streaming.built.get(id).signs.length` が同数、`built.group.children.filter(o => o.name.startsWith('GraphReference/photo')).length` が同数
  - E14: `node.portals.filter(p => !p.isReturn).map(p => p.targetRoomId && game.world.graph.get(p.targetRoomId).definitionId)` と exhibits の defId の対応
  - M16: `exhibits.every(e => !e.rarity)` かつ `exhibits.every(e => !game.world.graph.discoveredIds.has(e.defId))`（M16 生成時点）
  - 再生成・ロード（`localStorage` 保存 → リロード）で exhibits が同じ
- 既知の制約: VerticalCore 系定義（E02 など 5 定義）は footprint が空なので縮小図は「▭」のプレースホルダ。壁が狭い variant では count 未満の枚数になる。

### SelfMap（M01 地図室）
- 部屋: `?force=M01`（Mythic。depth 35 以上。`?seed=` と併用して到達）。
- 見た目: 入口から最も遠い壁に額縁付きの大きな暗い板（幅 3.0 m。壁が狭ければ 2.4 / 1.8）、その下に「現在地図 / YOU ARE HERE」の名札、手前に机 + 読書灯。板には HUD ミニマップと同じ描画の地図（この部屋のフロア、この部屋が中心、北固定）が 1 秒ごと（low は 2 秒）に更新され、未訪問だが配置済みの隣接部屋が白い破線の外形で示唆される。地図の回転（MapRotation）や MapErase は反映しない。
- JS:
  - `game.streaming.built.get(id).effects.length >= 1`、`built.group.children.find(o => o.name === 'SelfMap/panel')` が存在（`.material.map.image.width` は Tier で 1024 / 768 / 512）
  - `game.world.layoutFor(node).signs.find(s => s.id?.startsWith('sm:title:'))` が存在
  - 隣の部屋へ入って戻ると板の地図に新しい部屋が塗られている（1 秒以内）
- 既知の制約: 地図は M01 のフロアのみ（多層表示なし）。机は扉前ゾーン・内装と干渉するときは置かない。

## M-shell: GravityAxis（E03）/ ScaleAnomaly（R13, R16, L12, L17, M12）

共通の前提: `const node = game.world.graph.get(game.currentRoomId); const L = game.world.layoutFor(node); const built = game.streaming.built.get(game.currentRoomId);`

### GravityAxis — `?force=E03`
- 見た目: ホテル廊下の中身が進行軸まわりに 90° 横倒し。歩く床（元の壁）に偽扉の板と幅木が寝ていて、天井にも偽扉が並ぶ。片側の側壁に天井パネル灯が縦に付き、反対側の側壁は何も無い（元の床）。外殻（床・天井・外壁の材質）と扉パネル・入口ラベル位置は通常の直立。折れ廊下（L / Z / U）は各セグメントごとに自身の進行軸で横倒し。
- 見た目（扉）: 入口以外の進行用扉は横長スロット（幅 2.1（端の壁が狭いときは 1.6〜2.0）× 高 1.0 m、下端 0.6 m）でパネルもその寸法。ジャンプで乗ってしゃがむと通れ、先は 'crawl' Adapter（0.6 m → 段 → 0 m）を経て通常の部屋。直結用に足された `x1` 等の扉は通常の直立扉のまま。
- 見た目（床扉）: 廊下の片側の壁沿い（偽扉が寝ている側）に 1.1（廊下幅 2.5 のとき。0.9〜1.1）× 1.4 m の細長い穴。縁に trim の枠と metal の蝶番が 2 つ。穴は palette.door の扉パネル（厚さ 6 cm）で覆われていて、閉じている間は歩いて渡れ、下の部屋は描かれない（`Portal.covered`）。見下ろして E（「E: 扉を開ける」）でパネルが蝶番側（壁側の長辺）を軸に 90° 起きて壁に沿って立ち、真下の部屋（天井穴付き）が見え、穴に入ると落ちる。自動閉扉はしない。真下の部屋からは見上げるとパネルの裏（閉）/ 上の廊下（開）が見え、下からは操作できない。反対側に 1.0 m 以上の通路が残る。廊下幅は E03（GravityAxis 付き）だけ 2.4 m 以上にクランプ（実質 2.5）。
- JS: `L.roll === 1 && L.rollAxis === 'z' && L.rollFrom >= L.shellCount` / `L.sockets.filter(s => s.type === 'door' && s.id !== 'entry' && !/^x\d+$/.test(s.id)).every(s => s.crawl && s.sill === 0.6 && s.height === 1.0 && s.width <= 2.1)` / `L.sockets.find(s => s.id === 'entry').height === 2.1` / 床扉があれば `L.holes.length === 1 && Math.max(L.holes[0].max[0]-L.holes[0].min[0], L.holes[0].max[2]-L.holes[0].min[2]) <= 1.4` と `Math.min(L.holes[0].max[0]-L.holes[0].min[0], L.holes[0].max[2]-L.holes[0].min[2]) >= 0.9`（プレイヤー AABB 0.7 より広い）と `node.portals.find(p => p.type === 'hole').targetRoomId`（真下の部屋。置けなければ `node.removedSockets.includes('hole')` で穴なし）/ 床扉パネル `const hp = node.portals.find(p => p.type === 'hole'); hp.covered === true && hp.open === false`（初期状態）/ `built.dynamicColliders.find(d => d.id === 'GravityAxis/floorDoor').solid === true` / `built.interactables.some(o => o.userData.portalId === 'hole' && o.userData.kind === 'door')` / `!built.doors.has('hole')`（自動閉扉の対象外）/ 穴中心（ローカル hole ソケット pos を toWorld）へ teleport → enterRoom → 60 フレーム step で `player.pos.y === 0`（閉じたパネルの上に立てる）と `game.streaming.built.get(hp.targetRoomId).group.visible === false` / 穴の手前 1.2 m で見下ろし `game.devInput = { interact: true }; game.step(1/60); game.devInput = null` → `hp.open === true` かつ 40 フレーム後に dynamicCollider の `solid === false`、真下の部屋の `group.visible === true` / その後、穴中心へ teleport → 120 フレーム step で `player.pos.y < -1 && currentRoomId === hp.targetRoomId`/ スロット扉の先 `game.world.graph.get(node.portals.find(p => p.socketId === 'end').targetRoomId).adapter.kind === 'crawl'`（施錠されていなければ）/ 扉オブジェクト `built.doors.get('end').crawl === true && built.doors.get('end').sill === 0.6` / 入室後に `L.boxes.length` が変わらない
- 既知の制約: 真の重力回転・camera.up 変更はしない（D12）。床扉パネルの開き角は 90°（蝶番が壁面にあるので、それ以上は壁へ食い込む）。パネルは `BuiltRoom.doors` に入れず RoomEffect で動かすので、所有部屋が非表示の間はアニメーション・コライダ更新が止まる（下からは操作できないようにして回避）。RoomBuilder は照明・ラベルを全数ロールするため、折れ廊下の 2 本目以降のセグメントの照明は layout 上は「逆変換済みの位置」に入っている（`L.lights` の生の座標は室外に見えることがある。RoomBuilder のロール後に正しい位置になる。Node ハーネスで全 80 ケース確認済み）。廊下幅は 2.4 m 以上にクランプされるためスロット幅は 2.1 のまま（クランプ前の 2.0 幅では 1.6 に丸まっていた）。E03 の hole 抽選は生成器の 8% ではなく Modifier が必ず 1 つ置こうとする（長さ 7.5 m 以上のセグメントが無ければ無し）。

### ScaleAnomaly room — `?force=R13`（×3.0）/ `?force=M12`（×4.0）/ `?force=L17`（×1.5。Street 未実装で LargeRoom 代替）
- 見た目: 部屋全体（足跡・天井高・家具・パネル灯・柱）が s 倍の巨大空間。扉は通常寸法（1.0 × 2.1）で「巨大な空間に普通の扉」。入口ラベルは通常サイズで入口脇の目の高さ。床穴は無い。R13 は 3 倍の遊具島（高さ 1.4〜3.3 m の箱）、M12 は幅 8〜13 m・高さ 10.8 m の廊下（4.8 × 2.4 m のパネル灯）、L17 は 1.5 倍の LargeRoom（TODO サインは通常サイズ）。大部屋はチャンク分割される（28 m 格子）。
- JS: `L.height === 15`（R13）/ `10.8`（M12）/ `7.5`（L17）/ `L.sockets.every(s => s.type !== 'hole' && s.width === 1 && s.height === 2.1)`（hole 入口の場合は entry を除く）/ `L.holes.length === 0` / `L.footprint[0].x1 - L.footprint[0].x0 >= 24`（R13 は元 8〜34 m の 3 倍。配置空間が狭いと小さいバリアントに落ちる）/ `built.chunks.length > 1`（R13 / M12 の大きいバリアント）/ `L.lights[0].intensity` が palette の s² 倍（R13: 9 倍）/ 直結扉 `x1` があれば `L.sockets.find(s => s.id === 'x1')` の位置が壁面上にあり開口が切れている
- 既知の制約: `node.mainRect`（grow-to-fill）は拡大後座標で保存され、生成器はそれを元寸法として読むので再拡大 → fits() で弾かれ成長は取り消される（成長が効きにくいだけ。phase2-requests.md に WorldManager 側の回避を依頼）。R13 の ×3 は 100 m 級になり、混んだ空間では小さいバリアント（元 6〜7 m → 18〜21 m）になる。hole 入口（真下に置かれた場合）は天井穴を 1.4 m のまま拡大後の位置に切り直すが、着地点の暗い床マークは s 倍のまま。

### ScaleAnomaly perProp — `?force=R16`（0.5〜2.0、小型扉）/ `?force=L12`（3〜8。MegaHall 未実装で LargeRoom 代替）
- 見た目（R16）: オフィスの机列・天板・柱・間仕切りが什器ごとに 0.5〜2 倍（机と天板は一体で拡縮）。壁からの通路（0.9 m 以上、元が壁沿いの什器は壁沿いのまま）は残る。出口の 1 つが 0.7 × 1.2 m の小型扉（しゃがみで通る。先は 'crawl' Adapter → 通常の部屋）。空いた壁面に 2.0 × (天井-0.15) m の巨大な偽扉（木扉 + 枠 + 高いノブ。開かない、体は当たる）が 1〜2 枚。
- 見た目（L12）: LargeRoom 代替の家具・柱が 3〜8 倍（天井 -0.3 m と壁からの余白でクランプ。柱は太くなるだけ）。パネル灯は元のまま。
- JS（R16）: `L.sockets.filter(s => s.crawl).length <= 1` と、あれば `{width: 0.7, height: 1.2, crawl: true}` / その Portal の先 `game.world.graph.get(node.portals.find(p => p.socketId === <小型扉 id>).targetRoomId).adapter.kind === 'crawl'` / `built.doors.get(<小型扉 id>).crawl === true` / 巨大扉 `L.boxes.slice(L.shellCount).filter(b => b.mat === L.palette.door && b.solid && b.max[1]-b.min[1] > 2.4).length` が 0〜2 / `L.footprint` と `L.height` は Modifier 無しと同じ / 入室後に `L.boxes.length` が変わらない
- JS（L12）: `L.sockets.every(s => !s.crawl)` / 内装ソリッド箱の体積合計が Modifier 無しの 1.5 倍以上（Node ハーネスで 16〜60 倍を確認）
- 既知の制約: 小型扉の選択は「元の出口集合（removedSockets を含む）」から決めるので、選ばれた扉が施錠・撤去（3/4 プルーン）されると小型扉は無くなる（他の扉が代わりに小型化することはない。headless 3 seed 中 1 seed で無し）。perProp は「footprint 外へ出るものは捨てる」ではなく倍率を落として収める（L12 で家具が消えすぎないため）。clearDoorways が拡大後に扉前 1.8 m の什器を捨てるので箱数は減ることがある。

## M-zones: SurfaceFriction（C11 / U08 / L19）/ ExternalForce（U03 / R18 / L15）/ WaterWall（E09）

共通の前提: `const id = game.currentRoomId; const node = game.world.graph.get(id); const L = game.world.layoutFor(node); const B = game.streaming.built.get(id); const Z = game.streaming.zonesOf(id);`

### SurfaceFriction — `?force=C11`（更衣室 0.6）/ `?force=U08`（ホテル廊下 0.5。Wetness と併用）
- 見た目: 変化なし（物理のみ）。歩き始め・止まりが鈍く、方向転換で滑る（加減速 ×friction²: C11 0.36 / U08 0.25）。速度の上限は変わらない。
- 事実: `L.zones.filter(z => z.kind === 'friction').length === 1`、`L.zones[0].params.friction === 0.6`（C11）/ `0.5`（U08）、ゾーンが部屋全体（`z.aabb.min[0] <= L.bounds.min[0] && z.aabb.max[2] >= L.bounds.max[2]`）。`Z.length >= 1`。扉をまたいだ隣室（Adapter を含む）では滑らない。
- 既知の制約: zone のデータが無いため全室適用。補間なし（扉をまたいだ瞬間に切り替わる）。

### SurfaceFriction（ice）— `?force=L19`（凍結リゾート 0.2。MegaStructure スタブ → LargeRoom 代替）
- 見た目: 白い雪床（ParticleDetail）の上に、光沢のある淡青の氷面: 主矩形の中央に大きなリンク（内側 15% 縮め）、各扉口から幅 2.4 m の氷の帯がリンクへ伸びる（床穴の周囲 0.3 m は氷を避ける）。氷の上だけ強く滑る（×0.04。止まるのに約 1.4 s）。雪の上は普通に歩ける。
- 事実: `L.boxes.filter(b => b.mat === 'ice').length >= 1` かつ `=== L.zones.filter(z => z.kind === 'friction').length`（氷箔 1 枚 = ゾーン 1 つ）。`L.zones.filter(z => z.kind === 'friction').every(z => z.params.friction === 0.2)`。氷箔は非ソリッドで `b.max[1] === 0.03`（snow 箔 0.02 より上）。氷の外で `game.player` の加速が通常（ゾーン判定点は足元 y+0.1）。
- 既知の制約: MegaStructureGenerator 本実装後は Generator が出す 'ice' 箱をそのまま使う（自前の氷面は作らない）。翼矩形の帯はリンクを持たない（その矩形の反対側の壁まで）。

### ExternalForce wind — `?force=R18`（風洞廊下 2.5 m/s）
- 見た目: 変化なし（力 + 音）。入室で強風のループ音（`game.audio.debug()` に windStrong）。入口から奥（entry → 最初の出口の主軸方向）へ常に 2.5 m/s 押される: 追い風で歩行 3.0 → 5.5 m/s、向かい風で 0.5 m/s。空中でも効く。退室で風音が 1 s で止まる。
- 事実: `L.zones.filter(z => z.kind === 'force').length === 1`、`z.params.mode === 'wind' && z.params.speed === 2.5`、`z.vector` が単位ベクトル（`[0,0,±1]` か `[±1,0,0]`）。`Z[0].vector` はワールド方向（yaw で回転済み）。止まって立つと `game.player.zoneForce.length()` が 2.5、隣室に出ると 0。
- 既知の制約: 「風向と逆方向ほどレア出口率上昇」は onConnect で upwind を判定するだけで抽選には反映しない（D25 の拡張点）。風の可視化（粒）は無し。

### ExternalForce conveyor — `?force=U03`（無人エスカレーター 0.8 m/s）
- 見た目: 入口の正面（入口が端壁のとき）から進行軸に沿って幅 1.0 m の暗いベルトが床に走り、両縁に青く光る細帯（ledBlue）。ベルト面はスラット模様が進行方向へ流れ続ける（UV スクロール）。隣に停止した暗いベルト（金属縁）が 1 本。ベルト上に青い PointLight（1〜3 灯）。ベルトに乗ると 0.8 m/s で運ばれ、逆走は 2.2 m/s に落ちるが通れる。入室でベルト駆動音（conveyor）のループ。
- 事実: `L.zones.filter(z => z.kind === 'force').length === 1` かつ `z.params.mode === 'conveyor' && z.params.speed === 0.8 && z.params.lane === 0`。`L.boxes.some(b => b.mat === 'rubber' && !b.solid && b.max[1] === 0.015)`（ベルト箔）、`L.boxes.some(b => b.mat === 'ledBlue')`、`L.lights.some(l => l.color === 0x79b9cf)`。`B.group.getObjectByName('belt/0')` が Mesh で、`B.effects.length >= 1`（材質の `map.offset.y` が毎フレーム変わる）。ベルトの矩形（z.aabb の XZ）の上に `L.boxes.slice(L.shellCount)` のソリッドが無い。
- 既知の制約: 分析の「stairs Adapter をエスカレーターにする」案は Adapter（def=null）に Modifier が掛からないため、U03 本体の床の帯で表現。主矩形が細すぎる（進行方向 4 m 未満）バリアントではベルト無し（ゾーンも無し）。ベルト面は PointLight + 半球光のみで陰影（焼き込み無し）。

### ExternalForce conveyor — `?force=L15`（屋内高速道路 6.0 m/s。Street スタブ → LargeRoom 代替）
- 見た目: 主矩形の中央に幅 3.5 m の車線 2 本（黄線の縁）が長辺方向に並び、隣接する 2 本は逆向き。端壁の 3 m 手前で切れる。車線上のスラット模様が 6 m/s で流れる。乗ると 6 m/s で運ばれる（歩行と合わせて最大 9 m/s。壁の 3 m 手前で力が切れる）。逆向きの車線に乗り換えると逆へ運ばれる。
- 事実: `L.zones.filter(z => z.kind === 'force').length === 2`、2 本の `vector` が逆（`a.vector[0] === -b.vector[0] && a.vector[2] === -b.vector[2]`）、`params.speed === 6`。各 aabb の端は主矩形の端壁から 3.0 m 以上。`B.group.getObjectByName('belt/1')` が存在。車線上に柱・間仕切りが無い（`L.boxes.slice(L.shellCount)` のソリッドが車線矩形と重ならない）。
- 既知の制約: StreetGenerator 本実装後は Generator の kind 'lane'（vector 付き）ゾーンをそのまま force ゾーンに写す（自前の帯は作らない）。9 m/s で壁の 3 m 手前から減速するので壁に触れることはあるが、ダメージ・ペナルティは無い。

### WaterWall — `?force=E09`（垂直水面オフィス）
- 見た目: 出口扉の 1 つが扉パネル無しの大きな開口（幅 2.2 m（壁区間に余裕が無いときは 1.0）× 高さ 3.0 m（天井 -0.3 でクランプ））になり、開口全体を半透明の青緑の水面（'waterWall'。UV が縦横に流れる、両面）が塞ぐ。足元に濡れ箔、開口上端に暗い縁。水面の前 1.6 m は家具が無い。隣室が水面越しに揺らいで見える（開口は常時「開」）。ヒント「壁の一枚が水になっている」。近づくと低い水圧音（beacon）。E / タップしても何も起きない（開閉できない・施錠でもない）。歩いて抜けると水音（waterFlow 3 s）+ ヒント「水の壁を抜けた」。抜けた後も閉じない（自動閉扉なし）。
- 事実: `L.waterWalls.length === 1`、`const s = L.sockets.find(x => x.id === L.waterWalls[0].socketId); s.type === 'door' && s.height === L.waterWalls[0].height && (s.width === 2.2 || s.width === 1)`。`const P = node.portals.find(p => p.socketId === s.id && !p.isReturn); P.open === true && P.passedAt === undefined`（毎フレーム維持）。`B.group.getObjectByName('waterWall/' + s.id)` が Mesh で material.name === 'waterWall'。`B.doors.get(P.portalId).panel.visible === false` かつ `B.interactables.includes(B.doors.get(P.portalId).panel) === false`。`B.effects.length >= 1`。`L.boxes.some(b => b.mat === 'waterShallow')`。他の出口は 1.0 × 2.1 のまま。
- 施錠時: その扉が dead-end で施錠された（`P.locked`）/ Legendary 遠方 Seam / ride のときは通常の扉のまま（水面無し。`B.group.getObjectByName('waterWall/...') === undefined`）。開口は広いまま（金属扉 2.2 × 3.0）。
- 選択の安定性: 水壁ソケットは exit* の和集合（removedSockets を含む）から rng で選ぶ。選ばれた exit が壁へ戻された部屋では水壁無し（`L.waterWalls === undefined`。別ソケットへ移らない）。exit が 1 本だけ（minExits 1）の小バリアントでも成立。
- 既知の制約: 屈折・水中演出・青いフェードは無し（板 1 枚 + 音）。隣室の開口は 2.2 × 2.1（通常扉高）なので、水面越しに 2.1〜3.0 m の帯は隣室側の壁（まぐさ）が見える。プレイヤーが隣室にいて水壁の先（2 hop）が未構築のときは水面の向こうが暗く見える（通常の開いた扉と同じ挙動）。地図は通常の扉として描く（'water' グリフは使わない）。E09 が未構築で隣室だけ構築されているときは隣室側の戻り扉パネルが「開いた扉」として見える。

### VehicleRide — `?force=E11`（線路のないホーム。train 20 s）/ `?force=L02`（室内海洋。boat 25 s）/ `?force=L11`（環状モノレール都市。monorail 30 s）
- 見た目: entry 以外の通常扉 1 つ（entry から一番遠い、他の出口の外側と重ならない扉）が乗車口になり、HUD ヒントが「E: 乗る」（`portal.ride`）。扉は閉じたまま（意図的 Seam）。その壁の外側に車両: train = 灰色の箱形車体（床は室内床と同じ高さ、床下 0.35 m は浮いて線路・地面なし、暗い路盤面のみ）・窓帯（透過ガラス）・ロングシート・天井の暖色灯 / monorail = 同型 + 白い天井灯 + 足元の金属の軌道桁 / boat = 低い船体 + 木の甲板 + 舷側 0.95 m + 4 本柱の屋根 + 吊り灯。車両の奥 4〜4.5 m に黒い暗幕。E で乗車すると車内中央に立ち、視点だけ動く。窓の外（暗幕の手前）を細長い発光箔が壁沿いに流れ（train 橙 22 m/s / monorail 多色ネオン 16 m/s / boat 低い青緑の水面反射 5.5 m/s）、乗車の始め・終わり 15% で加減速する。微振動は PlayerRide。5 秒後は E / タップで到着。到着で 'platform' Adapter（ホーム + end 扉）に立ち、乗降口は施錠ヒント。
- 事実: `const L = game.world.layoutFor(node); L.rides.length === 1 && L.rides[0].vehicle === 'train'|'boat'|'monorail' && L.rides[0].durationSec === 20|25|30 && L.rides[0].path.length === 1`。`L.zones.filter(z => z.kind === 'ride').length === 1`。`const P = node.portals.find(p => p.socketId === L.rides[0].socketId); P.ride === true && P.seam === true && !P.locked && P.open === false`（onConnect 後。`node.state.modifierState.VehicleRide.socketId === L.rides[0].socketId`）。乗車前は `P.targetRoomId === undefined`、到着後は `P.targetRoomId` が platform Adapter（`game.world.graph.get(P.targetRoomId).adapter.kind === 'platform'`）で `P.far === true`。`game.streaming.built.get(id).effects.length >= 1`、`game.streaming.built.get(id).group.getObjectByName('VehicleRide/streaks').visible` は乗車中のみ true（`game.state === 'riding'`）。`L.boxes.filter(b => b.mat === 'carPaint').length >= 8`（boat は舷側・船体）。乗車口と同じ壁の他の出口の外側は車両領域（bounds に含む）なので、そこへ隣室は置かれない（施錠される）。`game.world.log` に `INFO ride start` → `INFO ride <room>/<portal> -> <platform>`。
- 既知の制約: 乗車口の抽選は rng を使わず幾何で決めるので、同じソケット構成なら常に同じ扉。候補が無い（通常扉が entry のみ、または全候補の車両領域が自分の footprint と重なる）バリアントでは車両無し（`L.rides === undefined`。部屋は通常どおり成立）。Game.startRide は params の skipAfterSec / shake を読まず既定 5 s / 0.015 を使う（rooms.json の値と一致）。L02 / L11 は MegaStructure が LargeRoom 代替の間はその縁の扉に付く（桟橋端・環状駅の見た目は Generator 実装後）。車両の窓帯は 'glass'（opacity .2）で、暗幕の外の背景色（fog）は窓の上下端からわずかに見える。到着側 platform の車両は AdapterGenerator の担当（本 Modifier は出発側のみ）。

### AudioEvent oneShot — `?force=U19`（無人キッズスペース children 20 s）/ `?force=R08`（無書籍図書館 pageTurn 12 s）
- 見た目: 変化なし（音のみ）。入室後 10 s 前後から、平均 interval 秒（±40%）ごとに確率 0.7 で 1 発、部屋の壁際（壁から 0.6 m・高さ 1.2 m・プレイヤーから 3 m 以上を優先）で定位した音が鳴る。U19 は残響の深い子どもの声（send 0.75）、R08 は乾いたページ音（send 0.35）。隣室に居るときは鳴らない。退室で停止。
- 事実: `game.audio.debug()` のイベントログ / `game.audio.events.between(game.audio.now, 60, 0)` に kind 'children' / 'pageTurn' が 1 分あたり 1〜4 件（U19 20 s 間隔 × 0.7 ≈ 2 件、R08 12 s × 0.7 ≈ 3.5 件）。`game.world.layoutFor(node).rides === undefined && zones === undefined`（レイアウト不変）。隣室から見ているだけでは events に追加されない。
- 既知の制約: ランタイム乱数は Math.random（進行に影響しない）。位置は footprint 矩形の内側の壁際で、家具の中に埋まることがある（音のみなので見えない）。

### AudioEvent beacon — `?force=U14`（受話器の上がったオフィス phoneRing）
- 見た目: 変化なし（音のみ）。入室すると、出口扉の 1 つ（params.portalId 無し → 「戻り以外・非施錠・行き先未訪問」の出口から node.seed で決定論的に 1 つ）の開口位置・高さ 1.2 m で電話の呼出音がループ（近づくと大きく、方向が分かる）。その扉の開口 1.1 m 以内に入る（= 通過）と止まり、以後その部屋では鳴らない（再訪・再ロード後も）。別の扉から出た場合は止まるだけで、戻ると同じ扉から再び鳴る。
- 事実: 入室直後 `node.state.modifierState.AudioEvent` が `{ portalId: 'exit*', done: false }`（同じ seed / 世界で常に同じ portalId）、`game.audio.debug()` に phoneRing の定常ボイス 1 本。誘導先の扉に入ると `done === true` になり phoneRing が消える。全出口の行き先が訪問済み（`node.portals.filter(p => !p.isReturn && !p.locked).every(p => game.world.graph.get(p.targetRoomId).visited)`）なら鳴らず modifierState も無し。セーブ → ロード後に `done` が残っている。
- 既知の制約: 電話プロップは置かない（音は Portal 位置。分析 A 案）。1 hop 先の U14 は開いた扉越しでも鳴らさない（ボイス予算）。beacon の音量は AudioEngine の距離減衰のまま（-6 dB の扉越し継続は未実装）。

## M-map: MapErase（M02）/ MapRotation（M19）

共通の前提: `const node = game.world.graph.get(game.currentRoomId);`。どちらも表示側（`game.mapView`）だけを書き、RoomGraph の接続・発見数（`game.world.graph.visitedCount`）・レイアウト（`L.boxes.length`）は変えない。

### MapErase — `?force=M02`（未記録室。Mythic なので `?seed=` と併用して depth 35 以上で出す。hidePolicy 'self'）
- 見た目: M02 に入った瞬間から、ミニマップ上の現在部屋が塗りのない白い破線の外形（+ プレイヤー矢印）になる。退室すると M02 の矩形は地図から消え、隣室側の扉マーカーだけが残る（「？」は付かない）。メニューの全体マップ・Map3D でも同じく描かれない。M02 の再入室で再び破線、再退室で再び消える。発見数の HUD 表示は減らない。
- JS:
  - 入室中: `game.mapView.hiddenRoomIds instanceof Set && game.mapView.hiddenRoomIds.has(game.currentRoomId)` / `node.mapCell.hidden === true`
  - `node.state.modifierState.MapErase` が `{ policy: 'self', mapErased: [<M02 の roomId>], entries: <入室回数> }`
  - 退室後（隣室で）: `game.mapView.hiddenRoomIds.has(<M02 の roomId>)` のまま / `game.world.graph.get(<M02 の roomId>).visited === true` / `game.world.graph.visitedCount` が退室前後で不変
  - ロード: `localStorage` 保存 → リロード直後（M02 に再入室する前）でも `game.world.graph.get(<M02 の roomId>).mapCell.hidden === true` で地図に出ない（`mapView.hiddenRoomIds` は Game が空に戻すが mapCell.hidden が保存に乗る）。M02 へ再入室すると `mapView.hiddenRoomIds` にも modifierState から復元される
  - 他ポリシー（rooms.json の M02 は 'self' のみ。確認するなら data/rooms.json の params を一時的に変える）: 'visitedExceptCurrent' は現在部屋以外の訪問済み（Adapter 含む）全部、'random50' は未消去の訪問済みの半分（切り上げ。`new Rng(node.seed).fork('mod:MapErase').fork(entries)` の shuffle で決定論）
- 既知の制約: 消えるのは「入室した時点」（分析 docs の「最初の退室以降」より早い。中にいる間は Minimap が破線の外形を描く既存仕様に乗せた）。hiddenRoomIds は毎回新しい Set に差し替える（MapPanel の参照比較で再描画させるため）。SelfMap（M01）の壁の地図は mapView を反映しない設計なので、M01 の板には M02 が描かれる。

### MapRotation — `?force=M19`（方位破壊区画。GenericCorridor。Mythic。angle 90 / drift true）
- 見た目: M19 に入ると 0.6 s かけてミニマップ（とメニューの全体マップ・Map3D）が時計回りに 90° 回り、その後 30 s 周期でゆっくり ±25° 揺れ続ける（65°〜115°。連続回転はしない）。フロア名・発見数の HUD 文字は回らない。退室すると 0.6 s で 0° へ戻る。3D 空間・プレイヤーの向き・扉の位置は一切変わらない（地図だけが嘘をつく）。
- JS:
  - 入室 1 秒後: `Math.abs(game.mapView.rotation - Math.PI / 2) < 0.1`（≈ 90°）。入室 7.5 s 後は ≈ 115°（`game.mapView.rotation * 180 / Math.PI`）、22.5 s 後は ≈ 65°
  - 入室中いつでも `game.mapView.rotation >= 64.9 * Math.PI / 180 && game.mapView.rotation <= 115.1 * Math.PI / 180`（イーズイン中を除く）
  - 退室後 0.7 s 以降: `game.mapView.rotation === 0`（M19 が見えている間は update の補間、見えなくなっていても setTimeout の保険で 0）
  - `node.state.modifierState` に MapRotation のキーが無い（保存なし）/ `game.world.layoutFor(node)` は Modifier 無しと同じ
  - 同期テスト: `game.step(1/60)` を 36 回で 90° + 約 3°（drift）、`game.step(7.5)` 1 回では ease が 1 フレームで完了するので 90° + sin(2π·7.5/30)·25° = 115° 付近
- 既知の制約: 回転の状態はモジュール内に 1 つ（地図の回転は全体で 1 値）。M19 → M19 の連続入室は現在角から滑らかに繋ぐ。メニューを開いている間は `runUpdate` が止まるので drift も止まる（MapPanel は開いた時点の角度で描く）。`game.newWorld()` は Game 側が rotation を 0 に戻す（次の onEnter で状態は上書き）。

## M-dynamics（MovingWalls / DynamicLength）

共通: どちらも `L.dynamics`（layout フックで確定）に可動要素を出し、RoomBuilder が個別 Mesh + コライダを作る。build フックで自分の要素の駆動を引き取る（`MovingWalls.drive.takeOverDynamics`: RoomBuilder 側の Mesh `dynamic/<id>` は `visible=false`・コライダ `solid=false` になり、クローン `MovingWalls/<id>` / `DynamicLength/<id>` と自前のソリッドコライダが `built.dynamicColliders` に追加される）。共通の確認式（`const id = game.currentRoomId, n = game.world.graph.get(id), L = game.world.layoutFor(n), B = game.streaming.built.get(id)`）:
- `L.dynamics.length > 0 && L.dynamics.every(d => ['slide','oscillate'].includes(d.motion.kind))`
- `B.dynamicColliders.filter(d => d.mesh.name.startsWith('dynamic/')).every(d => !d.solid && !d.mesh.visible)`（RoomBuilder 側は無効化）
- `B.dynamicColliders.filter(d => /^(MovingWalls|DynamicLength)\//.test(d.mesh.name)).length === L.dynamics.length`（クローン側が登録）
- `B.effects.length >= 2`（RoomBuilder の dynamics 効果 + 引き取り効果）
- 入室前後で `L.boxes.length` と `L.dynamics.length` が変わらない。`game.newWorld(42)` で同じ seed なら同じ `JSON.stringify(L.dynamics)`。

### MovingWalls — `?force=E18`（動く壁紙区画。Epic、CorridorHotel）/ `?force=M07`（動くマップタイル。Mythic、DynamicGrid スタブ = LargeRoom 代替）
- 見た目 E18: 廊下の側壁の内側 0.14 m に壁紙と同じ材質のパネル（幅 1.8〜3 m × 天井高、厚 8 cm。壁の偽扉・幕板・壁灯の手前を滑る）が 0.2 m/s で壁沿いに往復する（三角波 0.6〜1.5 m）。幅 2.5 m の廊下では一部のパネルが内側へ 0.28 m 呼吸する（6 s 周期の正弦波）。扉の前後 1.6 m には来ない。廊下幅 2.0 m では呼吸なし（通路 1.2 m 確保のため）。短い廊下（9〜14 m）や扉の多い廊下ではパネルが 0〜2 枚のことがある（Node 計測: 80 ケース中 56 でパネルあり、平均 2.6 枚、最大 7）。
- 見た目 M07: 大部屋の内部に白い壁ブロック（2.4 × 0.3 m × 高さ 3.0 m。天井 5 m には届かない）が最大 8 個、0.5 m/s で 1.0〜1.8 m スライド（3/4 が三角波、1/4 が正弦波）。ブロック同士・壁・家具との間隔は掃引範囲込みで 1.2 m 以上、扉の前 1.8 m には入らない。机列などで内部が密な LargeRoom（例 seed 42 のオフィス配置）では代わりに壁沿いのパネル（E18 と同じ方式）になる。
- 動き: ブロックの手前に立って待つと、次の位置が自分の AABB（余白 0.15 m）に重なる瞬間にそのブロックだけ止まり、離れると再び動く（挟み込み防止）。ブロックが自分を押したり運んだりはしない。ブロックに寄りかかっても屋上へ弾き出されない（RoomBuilder 直駆動だと起きる）。
- JS: `L.dynamics.every(d => d.id.startsWith('MovingWalls:') && d.solid) && L.dynamics.length <= 8` / E18 で `L.dynamics.every(d => Math.min(d.box.max[0]-d.box.min[0], d.box.max[2]-d.box.min[2]) <= 0.09)`（薄いパネル）/ M07 で blocks 方式なら `L.dynamics.some(d => Math.abs((d.box.max[1]-d.box.min[1]) - Math.min(L.height-0.05, 3.0)) < 1e-6)` / 停止規則の確認: ブロック（`B.dynamicColliders.find(d => d.mesh.name === 'MovingWalls/MovingWalls:0')`）の進路に立ち、`d.aabb` が数フレーム変わらないこと / パネルの周期 `d.spec.motion.period === Math.max(2, 2 * d.spec.motion.amplitude / speed)`（E18 speed 0.2 → 6〜15 s、M07 0.5 → 4〜7.2 s）。
- 既知の制約: 位相は build 時刻起点の実時間（保存しない。再ロードで位相が変わるのは仕様）。M07 の本来版（床セルの移動 + 経路更新）は DynamicGridGenerator 本実装時。Generator が既に `L.dynamics` を出していれば MovingWalls は追加しない。壁紙の UV 流動（E18「壁紙 UV 流動に合わせ」）は材質側の機能が無いため未実装（パネルの移動のみ）。

### DynamicLength — `?force=E13`（遠ざかる廊下。Epic、GenericCorridor）
- 見た目: 入口から 8 m 先に廊下の断面いっぱいの「突き当たり」（壁材の板 + 中央に偽扉 + 幕板 + 幅木。開かない・インタラクト不可）が見える。歩き始めると突き当たりは自分の 1.5 倍の速さで奥へ逃げ、残距離は 8 + 0.5 × 進行距離 m（ダッシュすると速く逃げる）。戻ると対称に近づく。奥の扉の前 1.6 m に達した時点（rate 0.5 / min 8 なら入口から約 (廊下長 − 10) / 1.5 m 歩いた地点）で突き当たりが消え、本物の奥の扉が現れる。突き当たりの向こう側の側面扉は、突き当たりが過ぎるまで見えない・届かないだけで接続は通常どおり。床穴は出ない。
- 注意: 現状の CorridorGenerator は E13 でも L / Z / U 形や 9〜26 m を選ぶ（直線 60/48/36/24 m は phase2-requests.md の依頼）。折れ廊下では最初のセグメント内（角の手前 0.3 m まで）だけ動き、最初のセグメントが 10.5 m 未満だと偽端は出ない（`L.dynamics` が空）。直線を出すには `?force=E13` で seed を変えて試す（Node 計測: seed 1 variant 1 = 24 m 直線、variant 5 = 21 m 直線）。
- JS: `L.dynamics.filter(d => d.id.startsWith('DynamicLength:')).length === 4`（end / door / trim / skirt）/ `const end = L.dynamics.find(d => d.id === 'DynamicLength:end'); end.solid && end.box.min[2] === 8 && end.motion.axis[2] === 1 && end.motion.period === 1e9` / `const r0 = L.footprint[0]; end.box.min[2] + end.motion.amplitude + 0.3 + (L.footprint.length === 1 ? 1.6 : 0.3) <= (L.footprint.length === 1 ? r0.z1 - 0.15 : r0.z1 - (r0.x1 - r0.x0)) + 1e-6`（可動域は奥の扉の前 1.6 m / 角の手前まで）/ 実行時 `const S = B.group.userData.dynamicLength; S.e === Math.min(8 + 1.5 * S.d, end.box.min[2] + end.motion.amplitude)` と、歩くと `S.d` と `S.e` が増え `S.e - S.d >= 8`、`S.visible === false` になった瞬間に `B.dynamicColliders.find(d => d.mesh.name === 'DynamicLength/DynamicLength:end').solid === false` / `!L.sockets.some(s => s.type === 'hole' && s.id !== 'entry') && L.holes.length === 0`。
- 既知の制約: 偽端の位置は位置の純関数（保存状態なし）。偽端の焼き込み陰影は位相 0（z = 8 m）の位置でサンプルした値のまま動く。地図は実寸で描かれる（「伸縮直線」として許容）。

## M-connect: LoopTopology（E01 / L08 / L11）/ RepeatDestination（U18 / R17）/ FarLink（M08）/ FakeExit（M04）

共通: いずれも onConnect（world.connectHooks）で決まる。`const N = id => game.world.graph.get(id)`、`const find = def => [...game.world.graph.nodes.values()].find(n => n.definitionId === def)` として書く。`?force=<ID>` は開始部屋の隣（depth 1）に置く。

### LoopTopology — `?force=E01`（L08 も同様。L11 は何もしない）
- 見た目: E01（閉ループ廊下）の奥の扉（廊下の 'end'）は閉じた Seam 扉。地図ではその扉が「？」。E で開けた瞬間にフェードし、3 段上の祖先の部屋（`?force=E01` では祖先が足りないので開始部屋 r1）の入口内側（1.5 m）に前向きで着地する（直進で開始点へ戻る）。側面の扉は通常の部屋に繋がる（ループ外の扉）。戻り Portal は無い（祖先側の扉は増えない）。
- JS:
  - `const n = find('E01'); const loop = n.portals.find(p => p.far && p.seam && !p.isReturn); loop.portalId === 'end' && loop.targetRoomId === n.state.modifierState.LoopTopology.targetRoomId`
  - 深い場所（通常到達 / セーブ後に `?force=E01` で 2 hop 先に出す）では `loop.targetRoomId` が親を 3 段（Adapter を数えない）登った部屋: `let c = n, k = 0; while (k < 3 && c.parentRoomId) { c = N(c.parentRoomId); if (!c.isAdapter) k++; } c.roomId === loop.targetRoomId`
  - `game.world.log.some(l => /INFO far link/.test(l))`、扉を開けた後 `game.currentRoomId === loop.targetRoomId`
  - L08（`?force=L08`。Legendary なので前室 → Seam 先に配置。前室の end を開けて入る）: `find('L08').portals.find(p => p.far && p.seam)` があり、`modifierState.LoopTopology.climbed <= 4`。進行用扉は入口から最遠の gate / door。
  - L11: `find('L11').portals.some(p => p.far) === false`（loopLength 1 は環状 footprint 側の表現。自己 Seam は作らない）
- 既知の制約: E01 の出口が 1 本（exitCount 1）だと進行はループのみ（直進で戻る。閉じ込めではない: 戻った先から別の扉で進める）。ループ辺はフェード遷移（案 A。ダミー区画のカットは無し）。

### RepeatDestination — `?force=R17` / `?force=U18`
- 見た目（R17 無限病棟）: 入口の脇の側壁（高さ 1.75 m）に「病室 X01〜X20」の白いプレート（X は 2〜7 の階数。鎖の先頭 seed で決まる）。奥の扉（'end'）の先は再び R17 で、サインが「X21〜X40」「X41〜X60」…と 20 ずつ増える。4 回反復した後（5 部屋目の先）は通常の部屋。側面の扉は通常接続（節目の分岐）。反復中の部屋は別 RoomNode（発見数に数える。図鑑上は同定義）。
- JS（R17）:
  - `const h = find('R17'); game.world.layoutFor(h).signs.find(s => s.id === 'rd:num')`（`kind: 'plate'`、text が「病室 …」）
  - `const end = h.portals.find(p => p.portalId === 'end'); const c1 = N(end.targetRoomId)`（前室 Adapter なら `c1.portals.find(p => !p.isReturn).targetRoomId` の先）: `c1.definitionId === 'R17' && c1.role === 'repeat' && c1.repeat === 1 && c1.forcedDefinitionId === 'R17'`
  - `c1.state.modifierState.RepeatDestination` が `{ index: 1, base, headRoomId: h.roomId }`（h 自身は `{ index: 0, base, headRoomId: h.roomId }`。base は同じ）
  - 構築後 `game.streaming.built.get(c1.roomId).signs.length >= 1`、サインの文字は base×100 + 1 + 20×index から 20 室分
  - 5 部屋目（repeat 4）の 'end' の先は `definitionId !== 'R17'`（解放）。置けない seed では前室 → 通常抽選で早く終わる（seam-stats 相当の Node 計測: 10 seed 中 8 で 4 回完走、2 で 1 回で終了）
- JS（U18 反復エレベーター）:
  - `game.world.layoutFor(find('U18')).signs.find(s => s.id === 'rd:num')` が `kind: 'emissive'` で「N F」（N は 2〜7）
  - 壁の扉の先は U18 ではない（`find('U18').portals.filter(p => p.type === 'door' && p.targetRoomId).every(p => N(p.targetRoomId).definitionId !== 'U18')`）
  - エレベーター（E で乗る → 籠 → E）: **phase2-requests.md の Game.registerWorldHooks 依頼（籠 Adapter の def を paletteFrom から解決）が入った後**、籠の 'end' の先が `definitionId === 'U18' && role === 'repeat' && repeat === 1` で階サインが「N+1 F」。3 回反復後は通常の部屋。依頼が入る前は籠の先は通常抽選（U18 は普通のエレベーターと同じ）。
- 既知の制約: 正解階のメカニクスは無い（D1/D2。番号だけ）。サインは入口の壁が広ければ入口脇（部屋名ラベルの下横）、廊下など狭ければ入口直ぐ内側の側壁に置く。どちらにも置けない variant ではサイン無し。

### FarLink — M08（`?force=M08` は候補が無いので通常接続になる。下の手順で既訪ノードのある状態で出す）
- 手順: 通常に 30〜50 部屋歩く（`game.world.ensureNeighbors` / テレポートでも可。visited が増えていること）→ セーブされた状態でページを `?force=M08`（`?new=1` を付けない）で再読込 → M08 が現在地の 2 hop 先に置かれる → 歩いて M08 に入る。
- 見た目: M08（小部屋）の入口から最も遠い扉が閉じた Seam 扉（地図「？」）。E で開けるとフェードして、グラフ距離 30 以上（無ければ 10 以上、無ければ最遠）の**既訪**の部屋の入口内側に着地する。戻り扉は無い（既訪部屋なので通常経路で歩いて戻れる）。他の扉は通常接続。
- JS:
  - `const m = find('M08'); m.state.modifierState.FarLink` が `{ resolved: true, targetRoomId, distance, portalId }`（候補無しなら `targetRoomId: null` で通常接続）
  - `const far = m.portals.find(p => p.far && p.seam && !p.isReturn); far.targetRoomId === m.state.modifierState.FarLink.targetRoomId && far.projected === false`
  - `N(far.targetRoomId).visited === true && !N(far.targetRoomId).isAdapter`。`game.world.log` に `INFO far link <M08>/<portal> -> <target>`
  - 開けた後 `game.currentRoomId === far.targetRoomId`。リロード後も同じ targetRoomId（modifierState に保存）
- 既知の制約: 行き先は最初の onConnect（親と繋がった時点）で確定する（onNodeCreated では親が無く距離が測れない）。`?force=M08` を開始直後に使うと既訪が開始部屋だけ（距離 1）なので候補無し → 通常接続（`resolved: true, targetRoomId: null`）。

### FakeExit — `?force=M04`
- 見た目: M04（偽帰還口）の入口から最も遠い扉の先が開始部屋と同じ定義（C02 オフィス廊下）の新しい部屋（物理配置。Seam ではない）。その部屋に入った直後、HUD ヒントに約 3 秒「— 終 —」、続けて約 2.5 秒「発見 N 部屋 — 探索は続く」。1 回だけ（戻って入り直しても出ない。リロード後も出ない）。
- JS:
  - `const m = find('M04'); const pid = m.state.modifierState.FakeExit.portalId; const p = m.portals.find(x => x.portalId === pid); let t = N(p.targetRoomId); while (t.isAdapter) t = N(t.portals.find(x => !x.isReturn).targetRoomId); t.definitionId === N('r1').definitionId && t.role === 'fakeStart' && !p.seam`
  - 入室後: `m.state.modifierState.FakeExit.shown === true`（演出は M04 の update で出す: 到着直後は M04 が 1 hop の可視部屋として残っている間に `game.currentRoomId` の部屋が role 'fakeStart' の自分の子であることを検出）
  - `params.showEndingOverlay === false` なら何も出ない（rooms.json は true）
- 既知の制約: 終了条件は無いので HUD ヒントのみ（フェード・オーバーレイ無し。Game.transition の overlay 拡張は未依頼）。returnDepth は未使用（行き先は開始部屋の定義に固定）。到着時に M04 が可視でない（扉が閉じ切っている等）とヒントは出ない。

## M-gate: NonEuclideanVolume（E08）/ NoiseGate（E17）

共通の前提: `const node = game.world.graph.get(game.currentRoomId); const L = game.world.layoutFor(node); const built = game.streaming.built.get(game.currentRoomId);`

### NonEuclideanVolume — `?force=E08`（内部拡張会議室。Epic なので depth の抽選条件を満たす位置で）
- 見た目（殻）: 4×4 m・高さ 2.6 m の何も無い小部屋。入口の正面に扉 1 枚（'inner'）と、その右脇に「会議室 / CONFERENCE ROOM」の銘板。天井灯 1 枚。地図では小さい 1 セル。隣室と壁を共有していれば直結扉（x1 …）が付くことがある。
- 見た目（内部）: 'inner' を E で開けた瞬間にフェードして、面積 4 倍（SmallRoom の辺 ×2。例 21×17 m、高さ 3.5 m）の大会議室に出る。中央に長机 + 椅子、壁沿いにキャビネット、入口の対面にホワイトボード、天井灯グリッド、入口脇に「会議室 / NNN m²」の銘板。他の扉は通常の部屋へ繋がる。入口の扉を E で開けると殻へ戻る（殻の入口内側に着地）。地図では内部は「？」（projected=false）。
- JS（殻）: `L.footprint.length === 1 && (L.footprint[0].x1 - L.footprint[0].x0) === 4 && (L.footprint[0].z1 - L.footprint[0].z0) === 4` / `L.sockets.some(s => s.id === 'inner')` / `node.portals.find(p => p.portalId === 'inner').seam === true` / `game.world.log.some(l => /intentional seam .*\/inner/.test(l))` / `node.state.modifierState.NonEuclideanVolume.role === 'shell'`
- JS（内部。'inner' を開けた後）: `node.role === 'interior' && node.definitionId === 'E08'` / `node.state.modifierState.NonEuclideanVolume.role === 'interior'` / `node.parentRoomId === <殻の roomId>` / `const e = node.portals.find(p => p.portalId === 'entry'); e.seam && e.far && e.targetRoomId === node.parentRoomId` / `game.world.log.some(l => /far link .*\/entry ->/.test(l))` / 面積: `const f = L.footprint[0]; (f.x1 - f.x0) * (f.z1 - f.z0) >= 49`（GenParams.node が渡っている場合。渡っていなければ殻と同じ 4×4 で `L.sockets.some(s => s.id === 'inner')` だが、その 'inner' は seam ではない通常扉）
- 既知の制約: 内部の判定は `GenParams.node?.role`（phase2-requests.md の依頼）に依存。無い間は内部も 4×4 の箱（無限入れ子にはならない）。殻から内部へ・内部から殻へは共に発見数に数える（殻 + 内部で 2）。戻りの着地は殻の入口内側（'inner' の内側ではない）。

### NoiseGate — `?force=E17`（音声認証扉。GenericRoom）
- 見た目: 入口の対面の壁（狭ければ側壁に分散）に扉が 3 枚、2.5 m 間隔。各扉の上に「🔈 静 / 🔉 歩 / 🔊 走」の銘板（並びは seed で入れ替わる）。gate0 と gate1 の間（無ければ gate0 の脇）に緑の発光メーター「▮▮▯▯▯▯▯▯ 歩」が動く（Low Tier は 4 Hz、それ以外 10 Hz）。生成器の他の出口扉と床穴は無い。
- 動作（マイク無し = 移動代替）: 立ち止まって E → 「静」の扉だけ開く。歩きながら E → 「歩」だけ開く。ダッシュ中（または停止後 0.4 秒以内、またはジャンプ着地直後）に E → 「走」だけ開く。帯が違う扉は HUD に「この扉は音に反応しない… いまの音は「歩」だ」（施錠音は Portal ごとに 1 回）。扉の向こう側（子部屋）から戻るときも同じ判定。
- 動作（マイク）: E17 の扉に最初に E / タップした直後にマイク許可ダイアログ（HTTPS のみ。許可で HUD「マイクが有効になった…」、拒否で「マイクは使えない…」、以後は要求しない）。許可後はメーターの sub が LEVEL → MIC になり、黙っていれば「静」、話せば「歩」、大声で「走」。E17 を出るとマイクは止まる（次の E17 で再要求。ブラウザが記憶していればダイアログ無し）。
- JS: `L.sockets.filter(s => /^gate\d$/.test(s.id)).length === 3`（WorldManager が行き先を置けず壁へ戻した場合は 2 以下） / `!L.sockets.some(s => /^exit/.test(s.id)) && L.holes.length === 0` / `(L.signs ?? []).filter(s => /^ng:gate\d:(still|walk|dash)$/.test(s.id)).length === 3 && L.signs.some(s => s.id === 'ng:meter')` / 帯の保存: `JSON.stringify(node.state.modifierState.NoiseGate.bands)` が `{"gate0":"…","gate1":"…","gate2":"…"}` で 3 帯が全て異なる / 接続先の傾向: 「静」の扉の先は SmallRoom / Restroom 系（`game.world.graph.get(node.portals.find(p => p.portalId === '<still の gate>').targetRoomId).definitionId` が Common/Uncommon の小部屋）、「歩」は廊下寄り、「走」は部屋型寄り（確率なので複数 seed で傾向を見る） / メーター更新: `built.signs.find(s => s.id === 'ng:meter')` があり、歩くと `game.audio.debug()` の `level=` が 0.35 前後、ダッシュで 0.7、静止で 0 へ減衰 / マイク状態: `game.audio.loudness.micAvailable`
- 既知の制約: マイク要求のタイミングは「同一フレームで canOpen が 2 回（ヒント + 操作）」の検出に依存（phase2-requests.md）。移動ランクは Modifier 側でプレイヤー位置の差分から推定する（PlayerController.moveRank は RuntimeContext に無い）。しゃがみ歩行（1.5 m/s）は「歩」扱い。ダイアログ後の Pointer Lock 復帰は Game 側。壁が短い部屋（対面の壁 < 8.5 m）では扉が側壁に分散する。

## M-rewire: ObservationRewire（E07）/ DynamicMapNode（M03, M07）/ MultiEdge（M11）

共通の前提: `const node = game.world.graph.get(game.currentRoomId); const L = game.world.layoutFor(node); const built = game.streaming.built.get(game.currentRoomId);`
共通の仕組み: 対象の前進扉は意図的 Seam（`portal.seam === true`、閉じた扉、地図は「？」、物理隣接なし）。行き先は pending 定義 = `node.state.localFlags['seam:<portalId>'].forceDefinitionId`（E で開けた瞬間に `resolveSeamTarget` がこの定義で部屋を作る。以後 `targetRoomId` が付き対象外）。

### ObservationRewire — `?force=E07`（観測依存廊下。CorridorGenerator）
- 見た目: 廊下の出口（end / side*）は全て閉じた扉で、各扉の上に銘板サイン（行き先の部屋名）。扉の向こうに部屋は配置されていない。扉に背を向けて画面外に出す（正面→背後）と、確率 0.5 でサインの部屋名が変わる（1 扉 3 回まで）。E で開けるとフェードしてサインの部屋へ遷移する。
- JS: `node.portals.filter(p => !p.isReturn && p.type === 'door').every(p => p.seam && !p.locked)` / `game.world.graph.placedNeighbors(node.roomId).length <= 1 + node.extraSockets.length`（物理隣接は親 + 直結だけ）
- JS: `const st = node.state.modifierState.ObservationRewire; Object.keys(st.pending).length === node.portals.filter(p => !p.isReturn && p.type === 'door').length` / `Object.entries(st.pending).every(([pid, d]) => node.state.localFlags['seam:' + pid].forceDefinitionId === d)`
- JS: サイン: `L.signs.filter(s => s.id.startsWith('rewire:')).length === node.portals.filter(p => !p.isReturn && p.type === 'door').length` / `built.signs.every(s => !s.id?.startsWith('rewire:') || s.atlas)`（文字は `ROOM_BY_ID.get(st.pending[pid]).name`）
- JS（再配線）: 扉を見てから背を向ける操作を 10 回ほど繰り返した後 `st.attempts[<pid>] >= 1` と `st.log.length >= 1`（`{portalId, from, to, at}`）。`st.rewires[<pid>] <= 3`。差し替え後も `node.state.localFlags['seam:'+pid].forceDefinitionId === st.pending[pid]` でサインの文字がその部屋名。
- JS（通過）: E で開けた扉 `p` について遷移後 `game.world.graph.get(p.targetRoomId).definitionId === st.pending[p.portalId]` かつ `forcedDefinitionId` も同じ。通過済みの扉は以後 `attempts` が増えない。
- 既知の制約: 判定は「画面内 → 画面外かつ背後」の遷移 1 回につき 1 回（扉を見ずに部屋に入った直後は初期化のみ）。Seam 先の部屋の entry は戻り Portal ではない（既存の Seam 一般と同じ一方通行。E07 へ戻る経路は無い）。プレイヤーが E07 にいる間だけ判定する。判定タイミングは操作依存だが、k 回目の判定結果と抽選される定義は node.seed から決まる。

### DynamicMapNode — `?force=M03`（移動座標室 45 秒）/ `?force=M07`（動くマップタイル 20 秒。DynamicGridGenerator スタブ = LargeRoom 代替。MovingWalls は別担当）
- 見た目: 前進扉は全て閉じた Seam 扉で、扉の上に発光する電子サイン（行き先の部屋名）。部屋に入って swapIntervalSec 経過後、未通過の扉のうち画面に映っていない 2 枚のサインの文字が入れ替わる（見ている扉は変わらない）。地図は変わらない。
- JS: `node.portals.filter(p => !p.isReturn && p.type === 'door').every(p => p.seam)` / `L.signs.filter(s => s.id.startsWith('rewire:')).every(s => s.kind === 'emissive')`
- JS: `const st = node.state.modifierState.DynamicMapNode; st.swapCount === 0` → 天井や床を見たまま 45 秒（M07 は 20 秒）待つ → `st.swapCount === 1 && st.log.length === 1`（`{a, b, at}`）。`st.pending[st.log[0].a]` と `st.pending[st.log[0].b]` が入れ替わっており `node.state.localFlags['seam:'+pid].forceDefinitionId === st.pending[pid]`。サインの文字も交換される。
- JS: 扉を 2 枚以上画面内に入れたまま待つと swap は起きない（画面外の未通過扉が 2 枚未満の間は毎フレーム再試行、条件が揃った瞬間に交換）。
- JS（通過）: 交換後に E で開けた扉の先 `game.world.graph.get(p.targetRoomId).definitionId === st.pending[p.portalId]`。通過済みの扉は swap 対象外（未探索エッジのみ）。戻り扉は対象外。
- 既知の制約: 未通過の Seam 扉が 1 枚だけの部屋では何も起きない。タイマーは入室時に 0 から（保存しない）。M07 の内部可動タイルは MovingWalls / DynamicGridGenerator 側。

### MultiEdge — `?force=M11`（多重扉室。AtriumGenerator）
- 見た目: 扉が 4 枚以上。主扉（ソケット順で最初の前進扉。通常 exit0）だけ向こうに部屋があり、他 3 枚（鏡像）は同じ部屋へ繋がる Seam 扉。主扉を開けると鏡像 3 枚も同時に開き（戸口の奥は真っ黒）、閉めると同時に閉じる。鏡像を E で開ける / 開いた鏡像を通り抜けると、フェードして主扉の先の部屋の入口内側へ出る。地図では主扉だけ実線、鏡像は「？」。
- JS: `const doors = L.sockets.filter(s => s.id !== 'entry' && s.type === 'door' && !node.extraSockets.some(x => x.id === s.id)); doors.length >= 4` / `const main = node.portals.find(p => p.portalId === doors[0].id); !main.seam && !!main.targetRoomId`
- JS: `const ms = node.portals.filter(p => p.mirrorOf); ms.length === 3 && ms.every(p => p.mirrorOf === main.portalId && p.seam && p.far && p.targetRoomId === main.targetRoomId && !p.locked)` / `game.world.graph.placedNeighbors(node.roomId).filter(id => id === main.targetRoomId).length === 1`
- JS: `L.boxes.filter(b => b.mat === 'void').length === 3`（鏡像の戸口の奥の黒い箔。非ソリッド）
- JS（同期）: 主扉を E で開けて 1 フレーム後 `ms.every(p => p.open)`、閉めると `ms.every(p => !p.open)`。`game.world.log.filter(l => l.includes('far link ' + node.roomId)).length === 3`
- JS（施錠連動）: `main.locked = true` にすると鏡像の HUD ヒントが「この扉は開かなそうだ」（`checkCanOpen` が ok:false）。戻して確認。
- 既知の制約: 主扉が側道抽選に失敗して後段（SEAM-2〜5）で繋がった場合、鏡像は一度施錠され、3/4 は壁に戻る（`removedSockets`）。残った鏡像は M11 が可視になった最初の update で Seam に遅延同期する（扉パネルは doorMetal のまま）。着地は接続先の entry 内側（主扉が既存部屋へ直結 xN で繋がった場合も entry）。扉が 4 枚未満の Generator では 'me<i>' ソケットを足して外殻を組み直すが、M11（AtriumLobby は常に 4 枚以上）では通らない。

## M-signs: DuplicateNumber（U02, U16, R20）/ FakeSignage（U04, U05, U06, U17, R10, E15, E16）/ TemperatureField（E19）

共通の取り方: `const id = game.currentRoomId, node = game.world.graph.get(id), L = game.world.layoutFor(node), B = game.streaming.built.get(id); const S = L.signs ?? [];`
サインは全て `L.signs`（SignAtlas。部屋あたり 48 枚上限）。番号・文字は seed から再生成（保存しない）。HUD・地図・接続は変えない。

### DuplicateNumber duplicate — `?force=U02`（重複客室階。CorridorHotel）
- 見た目: 客室扉（実扉 + 壁の偽扉パネル）の右脇 1.9 m に白い部屋番号板（例 702 / 707 / 704 …）。同じ番号の板が 2 枚以上あり、うち 1 組は実扉同士（両方とも別の部屋へ通じる）。
- JS: `S.filter(s => /^dn:/.test(s.id)).length >= 2` / 重複あり: `const t = S.map(s => s.text); t.length - new Set(t).size >= 1` / 実扉ペア: 実扉ソケット（`L.sockets.filter(s => s.type==='door' && s.id!=='entry')`）が 2 枚以上なら、その脇の番号（`S.find(s => Math.hypot(s.pos[0]-sock.pos[0], s.pos[2]-sock.pos[2]) < 0.8)`）に同値の組がある
- JS: 板の高さ `S.every(s => Math.abs(s.pos[1] - 1.9) < 0.01 || Math.abs(s.pos[1] - 2.25) < 0.01)`（脇に置けない偽扉だけ扉上 2.25 m）
- 既知の制約: 番号は entry 側の扉から距離順。偽扉が無いバリアントでは実扉だけに番号が付く。

### DuplicateNumber skipAndDuplicate — `?force=U16`（番号異常駐車場。ParkingGrid）
- 見た目: 柱の黄帯の上（1.15 m）に黄色地・黒字の区画コード（B3-01, 03, 04, 04, 06 …）。入口 → ランプ出口の軸に垂直な 2 面。番号は軸に沿って増え、欠番と隣同士の重複がある。
- JS: `const cols = S.filter(s => /^dn:\d+:[0-3]$/.test(s.id)); cols.length >= 4 && cols.every(s => s.background === 0xd9b52e && /^B\d-\d\d$/.test(s.text))`
- JS: 欠番: `const ns = [...new Set(cols.map(s => +s.text.split('-')[1]))].sort((a,b)=>a-b); ns.some((n,i) => i > 0 && n - ns[i-1] > 1)`（seed により出ないことはある）/ 重複: 同じ text の柱（id の `dn:<i>:` が異なる）が存在
- 既知の制約: 柱 25 本以上は遠い柱の面から順に無番（48 枚上限）。

### DuplicateNumber duplicate 0.3 — `?force=R20`（巨大トランクルーム。StorageGrid + PropRepetition storageDoor。Rare）
- 見た目: シャッター扉（PropRepetition の doorMetal 箔）の左上 1.95 m にユニット番号板（A-101 … 列ごとに A / B / C …）。約 3 割が他ユニットと同じ番号。
- JS: `S.length === 48`（扉が 48 枚以上のとき）/ `S.every(s => /^[A-Z]-\d{3}$/.test(s.text))` / 重複: `S.length - new Set(S.map(s => s.text)).size >= 1`
- JS: 番号は扉の面の手前: 各 sign の pos から dir の逆へ 0.05 進んだ点が doorMetal 非 solid 箱に入る（`L.boxes.some(b => !b.solid && b.mat==='doorMetal' && ...)`）
- 既知の制約: 番号は全扉に振るがサインは入口に近い 48 枚だけ（RoomBuilder のアトラス上限。phase2-requests.md）。PropRepetition が無い場合は GridGenerator の doorMetal 詰め物に貼る。

### FakeSignage blank/productLabel — `?force=U04`（無名自販機室。SmallRoom）
- 見た目: 自販機が 2〜4 台並び、前面に白無地の商品ラベル 4 × 5、下に空白の価格帯、上に空白の銘板。文字は一切無い。
- JS: `L.boxes.filter(b => b.solid && b.mat==='furnitureDark' && b.max[1]-b.min[1] > 1.7).length >= 2` / `L.boxes.filter(b => b.mat==='signPlate').length >= 40` / `S.every(s => s.text === '')`
- 既知の制約: 複製先が扉前・他の家具に掛かるときは台数が減る（最低 2 台。空き壁が無い極小バリアントでは 1 台のまま）。

### FakeSignage misleading/exitSign — `?force=U05`（出口のない EXIT。GenericCorridor）
- 見た目: 廊下の突き当たりに緑の EXIT（非常口）サインと扉（枡付き）があるが開かない（壁。E で反応しない）。手前の天井に「↑ EXIT」。真の出口（end）は突き当たり 1.6〜4.6 m 手前の側壁。緑の非常灯 1 灯。
- JS: `const ex = S.find(s => s.id==='fs:exit'); ex.kind==='emissive' && ex.text==='EXIT'` / EXIT 直下にソケット無し: `!L.sockets.some(s => s.type!=='hole' && Math.hypot(s.pos[0]-ex.pos[0], s.pos[2]-ex.pos[2]) < 0.8)`
- JS: end が側壁: `const end = L.sockets.find(s => s.id==='end'); end && (end.dir % 2) !== (L.sockets.find(s=>s.id==='entry').dir % 2)`（直線 / U 字は entry と end が同軸なので側壁へ移ると軸が変わる。L / Z 字では元から異なるので `ex.dir !== (end.dir+2)%4` で確認）/ `L.lights.some(l => l.color === 0x4cff80)`
- JS: シェル整合: `L.boxes.slice(0, L.shellCount).every(b => [L.palette.floor, L.palette.wall, L.palette.ceiling].includes(b.mat))` かつ end の開口が切られている（end の前に立って通れる）
- 既知の制約: end が removedSockets で無いとき・側壁に置けないときは、入口から最も遠い空き壁に EXIT + 偽扉を置く（サインは常に壁を指す）。偽扉は箔なので E のヒントは出ない。

### FakeSignage fixedTime — `?force=U06`（3:17 の待合室。LargeRoom）
- 見た目: 壁に赤 LED のデジタル時計 2〜4 枚（全て 3:17）、別の壁にアナログ時計 1 枚（針は 3:17 で止まり、赤い秒針だけ 60 秒で 1 周）。解錠イベントは無い。
- JS: `S.filter(s => s.kind==='clock').every(s => s.text === '3:17') && S.filter(s => s.kind==='clock').length >= 2` / `B.effects.length >= 1`（秒針）/ 秒針 Mesh: `B.group.children.filter(o => o.isGroup && o.children[0]?.geometry?.type==='BoxGeometry').length === 1` で、その `rotation.z` が数秒で変わる
- JS: `B.updateSign('fs:clock:0', '3:18')` で 1 枚だけ文字が変わる（アトラス更新の確認）
- 既知の制約: アナログ時計は空き壁が無ければ出ない（デジタルのみ）。

### FakeSignage blank/nameTag — `?force=U17`（終了後の展示会場。LargeRoom）
- 見た目: 中央通路の両側にブース列（白い背板 + 机）。机の前に空白の名札板、背板上部に無地のバナー。
- JS: `S.filter(s => /^fs:tag:/.test(s.id)).length >= 2 && S.every(s => s.text === '')` / 背板: `L.boxes.filter(b => b.solid && b.mat==='wallWhite' && Math.abs(b.max[1]-2.2) < 0.01).length >= 2`
- 既知の制約: 既存の家具パターン（furnishGeneric）と重なる位置のブースは省く。短辺 7 m 未満の部屋では出ない。

### FakeSignage misleading/flightBoard — `?force=R10`（ゲートのない空港。Terminal。Rare）
- 見た目: 奥のゲートカウンター上の発光パネルに GATE A / B / C（出口順）。コンコース中央に両面の出発案内板（黒地・橙の見出し「出発 DEPARTURES」）。8 行の便名（LM 4471 など全て架空）/ 行先 / ゲート / 備考。行先の約半分は実際に隣にある部屋の名前、残りは無関係な部屋名。
- JS: `S.filter(s => /^GATE /.test(s.text)).length >= 1`（座席列バリアントによりカウンター無しのことがある）/ `S.filter(s => /^fs:board:/.test(s.id)).length === 2` / 案内板 Mesh: `B.group.children.filter(o => o.isMesh && o.material.map?.image?.width === 1024).length === 2`
- JS: 実接続先が混ざる: `const names = node.portals.filter(p => !p.isReturn && p.targetRoomId).map(p => { let n = game.world.graph.get(p.targetRoomId); while (n?.isAdapter) n = game.world.graph.get(n.portals.find(q => !q.isReturn && q.targetRoomId)?.targetRoomId); return n && ROOM_BY_ID.get(n.definitionId)?.name; })`（`ROOM_BY_ID` は `game.world` 経由でなく DevTools で `import` するか、案内板を目視で照合）
- 既知の制約: 案内板の内容は最初の update（入室 or 隣室として可視化された最初のフレーム）で 1 回描く。それ以前に接続先が未確定なら無関係な名前だけになる（同 seed の再構築では同じ内容）。

### FakeSignage fractional — `?force=E15`（小数階フロア。VerticalCore。Epic）
- 見た目: 下階の扉脇に「n.1F」、上階の扉脇に「n.11F」、エレベーター扉脇に赤 LED「n.111」、階段の壁に「↑ n.11F / ↓ n.1F」（n は 2〜9）。HUD のフロア表記・ミニマップは変わらない。
- JS: `S.some(s => /\.1F$/.test(s.text)) && S.some(s => /\.11F$/.test(s.text)) && S.some(s => s.id==='fs:floor:elev' && /\.111$/.test(s.text))`
- 既知の制約: サインだけ。地図は D6 どおり正確。

### FakeSignage misleading truthRatio 0.3 — `?force=E16`（虚偽案内区域。GenericCorridor。Epic）
- 見た目: 各セグメント中央の天井に緑の案内板（両面。「→ 出口」「← 階段」「↑ EV」など）。約 3 割だけ矢印の先に本当の出口があり、残りは壁や戻り方向を指す。虚偽の横矢印が指す壁には偽扉（開かない）。
- JS: `const d = S.filter(s => /^fs:dir:/.test(s.id)); d.length >= 2 && d.every(s => /^[←→↑] /.test(s.text) && s.kind==='emissive')` / 偽扉: `L.boxes.filter(b => !b.solid && b.mat===L.palette.door && Math.abs(b.max[1]-b.min[1]-2.05) < 0.01).length >= 0`（虚偽の横矢印があるときだけ 1〜3 枚）
- 既知の制約: 「真」の判定は「その向きが支配的な出口ソケットがある」（施錠は layout で未確定なので施錠扉も出口に数える）。

### TemperatureField — `?force=E19`（温度座標迷宮。MazeGrid。Epic）
- 見た目: 迷路の照明が入口側は寒色（青白）、出口側は暖色（橙）に変わっていく（65 % の部屋。35 % は逆で出口側が寒色）。歩くと HUD のヒント欄に足元の温度「18.4℃」が 0.5 秒ごとに更新される。扉を見ている間（E: の案内が出ている間）は温度を出さない。色被せ・音は無い。
- JS: `new Set(L.lights.map(l => l.color)).size >= 2` / `L.boxes.some(b => b.mat==='lightWarm') && L.boxes.some(b => b.mat==='lightPanel')`（部屋が小さいと片方だけのことがある）
- JS: `document.getElementById('hud-hint').textContent` が `/^\d+\.\d℃$/` に一致（扉から視線を外して 1 秒待つ）。隣室（E19 が可視だが現在部屋でない）では出ない
- JS: 場の取り出し: `import('/src/modifiers/mods/TemperatureField.ts').then(m => { const f = m.temperatureFieldOf(L); console.log(f.nx, f.nz, f.hotExit, m.temperatureAt(f, entry.pos[0], entry.pos[2]), m.temperatureAt(f, exit.pos[0], exit.pos[2])); })`（入口 8℃ 付近・出口 30℃ 付近、hotExit=false なら逆）
- 既知の制約: 勾配は迷路の壁を無視した距離（入口からの距離 − 最寄り出口への距離）+ セル固定ノイズ ±0.6℃。施錠扉も出口に数えるので、稀に「暖色灯の先が施錠扉」になる。

## G1: PoolGenerator（PoolCorridor）— R01 浅水タイル回廊

共通の前提: `const n = game.world.graph.nodes.get(game.currentRoomId); const L = game.world.layoutFor(n); const B = game.streaming.built.get(game.currentRoomId); const I = L.boxes.slice(L.shellCount);`（I = 内装の箱）。
形状は `n.variant % 6` で決まる（0 cross / 1 T / 2 U / 3 Z / 4 L / 5 straight）、長さの段は `Math.floor(n.variant / 6)`（0: 28 m・幅上限 12 / 1: 18 m・幅 8 / 2: 12 m・幅 5）。幅は `L.footprint[0].x1 - L.footprint[0].x0`（整数 m。seed 共有で variant では変わらない）。

### PoolCorridor — `?force=R01`
- 見た目: 白タイル床・タイル壁・白天井（高さ 3.4 / 3.8 / 4.2 のどれか）の回廊が 直線 / L / Z / U / T / 十字 のいずれかに折れる。ShallowWater が敷く 0.25 m の水面の上に、幅 5 m 以上の回廊では両側の長辺沿いに **タイルの歩道デッキ**（上面 0.32 m。段差で登れる）が続き、デッキの縁に **金属の手すり**（区画の中ほどだけ。両端 1.2 m は開いている）・**はしご**（デッキの縁から水路へ垂れる細い金物）・**柱列**（幅 6 m 以上。デッキの縁に 4.5 m 間隔。材質はタイル巻きかコンクリ）が並ぶ。水路の中央に **低い仕切り**（高さ 0.6 の点線状の低い壁。幅 9 m 以上の水路）と、水面下の **白いレーンライン**・6 m おきの **金属グレーチング**・デッキ縁（幅 5 m 未満では壁際）の **暗い排水溝の帯**。壁の高さ 1.05〜1.25 に **タイルの色帯**（緑 / 暗色 / 木目調のどれか。seed 共有）。T / 十字では交差点の内角に柱、中央に 1.2 m 角の大きな排水口。幅 5 m 未満の細い回廊はデッキ無しで、壁際にタイルのベンチ（0.45 m）が出ることがある。最長の壁に青地の銘板「NO DIVING / SHALLOW WATER 0.25 m」。床付近に薄い水蒸気の粒。出口は主線の末端（`end`）と、T / 十字の腕の末端（`arm0` / `arm1` = 水路交差点の出口）+ 側面（`side*`）。入口内側に部屋名ラベル。扉の前は ShallowWater の乾いた前庭（縁 0.3 m）で、デッキは前庭の幅ぶん切れている。
- JS（形状・ソケット）: `n.definitionId === 'R01'` / `L.footprint.length >= 1 && L.footprint.length <= 3` / `L.sockets.some(s => s.id === 'end')` / 十字（`n.variant % 6 === 0` かつ `L.footprint.length === 3`）で `['arm0','arm1'].every(id => L.sockets.some(s => s.id === id))`、T（`n.variant % 6 === 1` かつ `L.footprint.length === 2`）で `L.sockets.some(s => s.id === 'arm0')` / 全ソケットが 0.5 m グリッド: `L.sockets.filter(s => s.type !== 'hole').every(s => Number.isInteger(s.pos[0] * 2) && Number.isInteger(s.pos[2] * 2))`
- JS（材質・シェル）: `L.palette.floor === 'floorTile' && L.palette.wall === 'floorTile' && L.palette.ceiling === 'ceilingWhite' && L.palette.door === 'doorMetal'` / `L.shellCount > 0 && L.boxes.length > L.shellCount` / `[3.4, 3.8, 4.2].includes(L.height)`
- JS（内装。幅 W = `L.footprint[0].x1 - L.footprint[0].x0`）: デッキ `W >= 5 ? I.some(b => b.solid && b.mat === 'floorTile' && Math.abs(b.max[1] - 0.32) < 1e-6) : true` / 柱（W ≥ 6 で長辺区画が 4.4 m 以上あればほぼ常に）`I.some(b => b.solid && b.max[1] === L.height && b.max[0] - b.min[0] < 0.6)` / 色帯 `I.some(b => !b.solid && Math.abs(b.min[1] - 1.05) < 1e-6 && Math.abs(b.max[1] - 1.25) < 1e-6)` / レーンライン `I.some(b => b.mat === 'wallWhite' && !b.solid && b.max[1] < 0.02)` / 排水溝 `I.some(b => b.mat === 'wallDark' && !b.solid && b.max[1] <= 0.012)` / 手すり（出た場合）`I.filter(b => b.mat === 'metal' && b.solid && Math.abs(b.max[1] - 1.05) < 1e-6).length` / サイン `L.signs.length === 1 && L.signs[0].id === 'pool-notice' && L.signs[0].kind === 'plate'` / 水蒸気 `L.particles.type === 'mist'` / 進行軸 `L.path.length >= 2 && L.path[0].join() === '0,0,0'`
- JS（ShallowWater との合成。Generator は水面・水域を出さず Modifier に任せる）: `L.zones.some(z => z.kind === 'water')` / `L.boxes.some(b => b.mat === 'waterShallow')` / `L.render.wetness >= 0.3` / 内装ソリッドはすべて footprint 内: `I.filter(b => b.solid).every(b => L.footprint.some(r => (b.min[0]+b.max[0])/2 > r.x0 && (b.min[0]+b.max[0])/2 < r.x1 && (b.min[2]+b.max[2])/2 > r.z0 && (b.min[2]+b.max[2])/2 < r.z1))`
- 歩行: 水路（減速 0.7）→ デッキへ歩くだけで登れる（`game.player.pos.y` が約 0.32 になる）。手すりの区画は端から回り込める。低い仕切り（0.6）は越えられず、両側を回る。全出口へ歩いて到達できる（Node で 8 seed × 18 variant × 2 条件を格子探索で確認済み）。
- 見た目（Modifier 無し想定）: `?force=R01` では常に ShallowWater が付く。水面が無い場合でも「水を抜いたプール回廊」（デッキ・排水溝・レーンライン・色帯）として成立する設計。
- 既知の制約: 曲率は折れ（L / Z / U / T / 十字）で近似し、斜め・円弧は無い。growToFill の対象外（`p.mainRect` は読まない）。Hole 落下先（ROOMLIKE）には入らない（床穴は 5 % で出る側）。バリアントの bounds 面積は概ね大 → 小だが厳密な単調減少ではない（U と Z で入れ替わることがある）。腕（arm）の扉は 1.0 m 幅の通常扉（幅広の water 開口ではない）。`extraSockets` が長辺に付くとデッキは前庭幅ぶん切れ、`clearDoorways` の対象になった 6 m 以下の塊は消える。天井の PointLight は 3〜4 本（everyNth 4）で、広い十字では中央が暗めになることがある。PoolCorridor は `presets.ts` の BASE に無いためパレットは Generator 内で上書きしている（phase2-requests.md 参照。Adapter は layout の palette を使うので揃う）。

## G4 DynamicGridGenerator: DynamicGrid（M07 動くマップタイル）

### DynamicGrid — `?force=M07`（Mythic。depth 1 に配置される。`game.newWorld(42)` など seed を変えて variant / 大きさの違いも見る）
- 見た目: 正方形寄りの白い格子室（30 / 24 / 18 / 15 / 12 / 9 m 角。もう一方の辺は ±3 m）。床は格子タイル（floorTile）で 3 m ごとに暗い細い溝、外周 1 セル（3 m）の回廊と内部の可動域の境界に黄線。天井はタイル + 白色パネル灯（回廊は市松、内部はブロックの掛からない空きセルだけ）。内部には床から天井まで届く 1.7 m 角の白いブロックが市松状に並び（一部欠けて広場）、そのうち最大 8 個が床の金属レールの上を 3 m または 6 m、0.5 m/s（三角波。一部は正弦波）で往復する。動くブロックの前に立つと手前で止まる（MovingWalls の停止規則）。入口・出口の扉は外壁の 3 m グリッド線上（床の溝の延長）にあり、扉の前 1.8 m と回廊にブロックは入らない。壁の 2 セルごとにベイ銘板（北南 = 英字、東西 = 2 桁数字。扉の近くは無し）。入口上に部屋名ラベル、各前進扉の上には DynamicMapNode の電子サイン（行き先名。20 秒ごとに入れ替わる）。
- JS（`const n = game.world.graph.nodes.get(game.currentRoomId); const L = game.world.layoutFor(n); const B = game.streaming.built.get(game.currentRoomId);`）:
  - 足跡と格子: `L.footprint.length === 1 && [30,24,18,15,12,9].includes(L.footprint[0].x1 - L.footprint[0].x0) && ((L.footprint[0].z1 - L.footprint[0].z0) % 3 === 0)` / `L.height === (n.variant <= 1 ? 3.4 : 3.0)` / `L.palette.floor === 'floorTile' && L.palette.wall === 'wallWhite'` / `L.shellCount > 0` / `L.holes.length === 0 && !L.sockets.some(s => s.type === 'hole' && s.id !== 'entry')`
  - ソケットがグリッド線上: `L.sockets.filter(s => s.id === 'entry' || s.id.startsWith('exit')).every(s => { const r = L.footprint[0]; const t = (s.dir === 0 || s.dir === 2) ? s.pos[0] - r.x0 : s.pos[2] - r.z0; return Math.abs(t / 3 - Math.round(t / 3)) < 1e-6; })` / 出口数 `L.sockets.filter(s => s.id.startsWith('exit')).length <= 4`
  - 可動ブロック（Generator 由来）: `L.dynamics.length >= 1 && L.dynamics.length <= 8 && L.dynamics.every(d => d.id.startsWith('MovingWalls:grid') && d.solid && (d.motion.amplitude === 3 || d.motion.amplitude === 6) && d.motion.period === Math.max(2, 2 * d.motion.amplitude / 0.5) && Math.abs((d.box.max[0] - d.box.min[0]) - 1.7) < 1e-9 && Math.abs(d.box.max[1] - (L.height - 0.05)) < 1e-9)`（9 m 角など内部に動かせるブロックが無い小 variant では Generator は dynamics を出さず、MovingWalls Modifier の lining / blocks（id `MovingWalls:<n>`）が代わりに付く。混在はしない: `!(L.dynamics.some(d => d.id.startsWith('MovingWalls:grid')) && L.dynamics.some(d => !d.id.startsWith('MovingWalls:grid')))`）
  - 掃引範囲が回廊・扉前に入らない: `L.dynamics.every(d => { const r = L.footprint[0], a = d.motion.axis, A = d.motion.amplitude; const x0 = Math.min(d.box.min[0], d.box.min[0] + a[0] * A), x1 = Math.max(d.box.max[0], d.box.max[0] + a[0] * A), z0 = Math.min(d.box.min[2], d.box.min[2] + a[2] * A), z1 = Math.max(d.box.max[2], d.box.max[2] + a[2] * A); return x0 >= r.x0 + 3 - 1e-6 && x1 <= r.x1 - 3 + 1e-6 && z0 >= r.z0 + 3 - 1e-6 && z1 <= r.z1 - 3 + 1e-6; })`
  - 固定ブロックの隙間（通路 ≥ 1.2 m。実際は 1.3 m）: `(() => { const S = L.boxes.slice(L.shellCount).filter(b => b.solid); for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) { const a = S[i], b = S[j]; if (a.min[0] < b.max[0] + 1.2 - 1e-6 && a.max[0] > b.min[0] - 1.2 + 1e-6 && a.min[2] < b.max[2] + 1.2 - 1e-6 && a.max[2] > b.min[2] - 1.2 + 1e-6) return false; } return true; })()`
  - 駆動の引き取り（MovingWalls build フック）: `B.dynamicColliders.filter(d => d.mesh.name.startsWith('MovingWalls/MovingWalls:grid')).length === L.dynamics.length` と、RoomBuilder 側の元要素が非表示・非ソリッド `B.dynamicColliders.filter(d => d.mesh.name.startsWith('dynamic/MovingWalls:grid')).every(d => !d.solid && !d.mesh.visible)` / 進路に立つと `B.dynamicColliders.find(d => d.mesh.name === 'MovingWalls/MovingWalls:grid0').aabb` が数フレーム変わらない（`game.step(1/60)` を繰り返して確認）
  - ゾーン・照明・サイン: `L.zones.length === 1 && L.zones[0].kind === 'theme' && L.zones[0].params.preset === 'grid'`（地図で内部の可動域に内訳線）/ `L.lights.length > 0 && L.dynamics.every(d => !L.lights.some(l => { const a = d.motion.axis, A = d.motion.amplitude; return l.pos[0] > Math.min(d.box.min[0], d.box.min[0] + a[0] * A) && l.pos[0] < Math.max(d.box.max[0], d.box.max[0] + a[0] * A) && l.pos[2] > Math.min(d.box.min[2], d.box.min[2] + a[2] * A) && l.pos[2] < Math.max(d.box.max[2], d.box.max[2] + a[2] * A); }))`（掃引範囲に PointLight が無い）/ `L.signs.some(s => s.id.startsWith('bay:'))` / `L.boxes.some(b => b.mat === 'yellowLine') && L.boxes.some(b => b.mat === 'metal' && !b.solid)`（黄線とレール）
  - 決定論・不変条件: 入室前後で `L.boxes.length` と `L.dynamics.length` が変わらない。`game.newWorld(42)` を 2 回して同じ `JSON.stringify(L.sockets)` / `JSON.stringify(L.dynamics)`。
- 既知の制約: ブロックは「乗らない・押さない」（進路上のプレイヤーの手前で止まって待つ。停止規則は MovingWalls の build フック経由。RoomBuilder 単独駆動では停止しない）。位相は build 時刻起点の実時間で保存しない。地図は通常の 1 矩形 + 可動域の内訳線（内部ブロックは描かない）。床穴・多層なし。mainRect（growToFill）は DynamicGridGenerator では来ない前提（来た場合は残り幅を回廊に吸収する）。回廊の 3 m 幅は extraSockets（隣室からの直結扉）がどこに付いても扉前を空けたままにする。Tier による違いはない（可動ブロックは常に ≤ 8）。

## G2 StreetGenerator（StreetGrid: R04 / L01 / L10 / L17 / L20、RoadGraph: L15）

共通の確認式（`const id = game.currentRoomId, n = game.world.graph.get(id), L = game.world.layoutFor(n), B = game.streaming.built.get(id)`）:
- `L.shellCount > 0 && L.chunkSize === 32 && L.palette.floor === 'floorAsphalt'`（外殻は StreetGenerator。fallback の LargeRoom + TODO サインではない）
- `L.sockets.filter(s => s.id !== 'entry' && s.type !== 'hole').every(s => ['street','door','ramp'].includes(s.type))`
- `L.boxes.filter(b => /^window/.test(b.mat)).length > 0`（窓は L.boxes の非ソリッド薄板。L15 は 0）
- 入室前後で `L.boxes.length` と `L.sockets.length` が変わらない。`game.newWorld(42)` で同じ seed なら同じ `JSON.stringify(L.sockets)`
- 大きい部屋（一辺 > 32 m）は `B.chunks.length >= 4`（32 m 格子）。
- 到達性: 全出口へ歩いて行ける（Node ハーネスで 6 部屋 × 5 seed × 6 variant × 4 条件 = 720 ケースの flood fill を確認済み）。ブラウザでは街路を歩いて各出口の前に立てること。

### StreetGrid 共通 — `?force=R04` / `?force=L01` / `?force=L10` / `?force=L17` / `?force=L20`
- 見た目: 暗い高天井（9〜12 m。R04 は FakeSky の夕空）の下に、アスファルトの街路（白の破線センターライン・横断歩道）が格子状（1〜3 街区）に走り、島ブロックは歩道（0.12 m の段）+ ソリッドの建物（窓帯・偽扉・屋上の縁）、外周の壁は外装板（brick / concrete / beige…）+ 窓帯 + 発光看板（24H / CAFE / HOTEL…）のファサード。街灯（ポール + 発光灯具）が交差点の角に立ち、歩道沿いに車が停まっている。入口は南辺の街路の中心。街路端の出口は幅 2.2 × 高 3.2 のパネル無しゲート（縁取り付き）、玄関の出口は通常扉（ひさし + 玄関灯）。建物の中には入れない（偽扉は開かない）。
- サイズ（seed 42、variant 0 → 5）: Legendary 64 / 48 / 40 / 32 / 24 / 20 m、Rare（R04）48 / 40 / 32 / 26 / 22 / 18 m（縦横比 0.85〜1.15、最大 64）。`L.footprint[0]` で確認。
- JS: `L.sockets.filter(s => s.type === 'street').length >= 1`（街路端の出口）/ `L.boxes.slice(L.shellCount).filter(b => b.solid && b.max[1] - b.min[1] > 3).length >= 1`（建物）/ `L.lights.length >= 1`（街灯。R04 は FakeSky が 1 灯にする）/ `L.signs.length >= 1 && L.signs.length <= 48` / `L.path.length >= 2`
- Hole 落下先: 別の部屋の床穴から街区へ落ちると、天井穴の真下が道路または「広場」（建物を建てないブロック。植栽・ベンチ・街灯）になる。`n.entryReq.type === 'hole'` のとき `L.sockets.find(s => s.id === 'entry').type === 'hole'`。床穴（マンホール）は道路上の低確率（0.1）: `L.holes.length <= 1`。
- R04（屋内住宅街、Rare。FakeSky dusk）: 天井箔が `skyDusk`（`L.boxes.slice(0, L.shellCount).some(b => b.mat === 'skyDusk')`）。街灯の灯具は白（lightPanel）、蛍光灯プリセットなので天井に蛍光灯パネル列（FakeSky が天井付近の灯を除くので残らないことがある）。
- L01（永久薄明都市。FogDepth #2b2f4a 30–160）: 高さ 12 m、7〜11 m の暗い高層ファサード、青白い街灯（`L.palette.lightColor === 0x9fb8ff`、灯具 ledBlue）、`L.render.fog.color === 0x2b2f4a`、`L.fogFar === 160`（Tier でクランプ）。入口・街路端は 'street'（`L.sockets.find(s => s.id==='entry').type === 'street'` となるのは親が 'street' で繋いだとき）。
- L10（夜間郊外住宅地。LightingPhase allWindowsLit）: 低い家（3.6〜6.2 m、庭のセットバック、窓枠あり）が並び、窓は全て点灯: `L.boxes.filter(b => b.mat === 'windowDark').length === 0 && L.boxes.filter(b => b.mat === 'windowLit').length > 50`。街灯はナトリウム色。
- L17（無限団地。PropRepetition apartmentBlock + ScaleAnomaly room 1.5）: 全ブロックに同形の板状棟（4 階、階段室の縦帯、屋上の給水塔、棟番号の銘板 A-1 / B-2…）。各棟の東端に外階段（段 0.18 m × 20 段）があり 3.6 m の踊り場まで歩いて上がれる（踊り場に共用灯）。ScaleAnomaly で全体 ×1.5（`L.height === 18`、variant 0 は 96 m 角 → WorldManager は小さい variant へ落ちることが多い）。`L.boxes.slice(L.shellCount).filter(b => b.solid && b.mat === 'wallConcrete' && b.max[1]-b.min[1] > 15).length` が棟数（+ PropRepetition の追加棟。phase2-requests.md の依頼が処理されるまでは街路上に 6×3 m の棟が足される）。
- L20（永久万博会場。ZoneThemeShuffle zoneCount 8）: 各島ブロックがパビリオン（本体 + 塔 + 展示カラーの帯 + 前庭のキャノピー + 発光サイン `PAVILION n`）。`L.zones.filter(z => z.kind === 'theme').length === ブロック数`（variant 0 は 9、48 m は 4、32 m 以下は 1）、`L.zones.every(z => z.kind !== 'theme' || z.params.preset)`（ZoneThemeShuffle が preset を付ける）、外殻の床・天井がブロック単位で分割されゾーンのテーマ材質になる（`L.boxes.slice(0, L.shellCount).length > 50`）。地図にゾーンの内訳線が出る。
- 既知の制約: 建物内部は別ノードにしない（D4/D5）。街路端の 'street' 出口はパネル無しの常開ゲート（RoomBuilder が door 以外にパネルを作らないため。隣室が常に見える）。外周のファサードは部屋の壁の内面に貼った非ソリッドの薄板なので 6〜8 cm だけ体がめり込める。窓帯は 1 部屋あたり最大 500 箔程度（L01 64 m で約 490）。growToFill の対象外（要求済み・任意）。ScaleAnomaly 後の L17 の街路は 9〜10 m 幅、段は 0.27 m（しゃがみ不要で登れる）。

### RoadGraph — `?force=L15`（屋内高速道路。ExternalForce conveyor 6.0）
- 見た目: 高さ 6.8 m の暗いトンネル。幅 12 m の本線（片側 1 車線 3.5 m + 路肩 2.5 m）に白の実線・破線、中央分離帯（コンクリート 0.9 m、両端 3 m は回り込める）、防音壁パネル、ガードレール、天井のナトリウム灯列、緑地の案内標識（ガントリー。`EXIT n →` と残距離 / `RAMP ↑ 3.6 m`）、路肩に停まった車。本線の途中から T 字の分岐ランプが 1〜3 本（variant 0 = 70 m 本線 + 3 本）。そのうち 1 本（variant 0〜3）は段 0.15 × 0.6 m の斜路で 3.6 m 上がる立体ランプで、踊り場の端に上階の出口がある。入口は南端の左車線側。左車線に乗ると奥へ（+z）6 m/s で運ばれ、右車線は入口側へ戻る（ExternalForce の帯が車線の上に描かれる）。
- JS: `L.footprint.length >= 2`（本線 + 分岐）/ `L.zones.filter(z => z.kind === 'lane').length >= 2 && L.zones.filter(z => z.kind === 'lane').every(z => Math.hypot(z.vector[0], z.vector[2]) > 0.9)` / `L.zones.filter(z => z.kind === 'force').length === L.zones.filter(z => z.kind === 'lane').length`（ExternalForce が lane を force に写す）/ variant 0〜3 で `L.sockets.some(s => s.pos[1] === 3.6 && s.type === 'ramp')`（上階出口）/ `L.sockets.filter(s => s.id !== 'entry').every(s => s.type === 'ramp')` / `L.signs.some(s => /EXIT/.test(s.text))` / `L.holes.length === 0`。
- 上階出口の確認: 立体ランプ（標識 `RAMP ↑ 3.6 m` の分岐）を歩いて登り、踊り場（y ≈ 3.6）の奥の開口の先に ramp Adapter → 部屋が y = 3.6 起点で配置される（`game.world.graph.get(<隣>).placement.position[1]` が現在部屋 +3.6 または +7.2）。
- 既知の制約: 分岐は同一平面の T 字のみ（立体交差なし）。車線の「動く床」の見た目（ベルト）は ExternalForce 側。速度は Modifier params（Generator は速度を持たない。分岐は params.speed 3.0 を提案値として書く）。床穴は出さない。

## G3 MegaStructureGenerator（MegaHall: L02 L03 L12 / MegaAtrium: L04 L05 L07 L09 L11 L14 L19）

共通（`const id = game.currentRoomId, n = game.world.graph.get(id), L = game.world.layoutFor(n), B = game.streaming.built.get(id)`。`?force=<ID>` で開始部屋の隣に出る。周囲に入らないときは前室 + 意図的 Seam の遠方配置になり `game.world.log` に `INFO legendary far placement` が残る）:
- `L.footprint.length >= 1 && L.shellCount > 0 && L.boxes.length <= 6000`（箱予算。Node 計測: 最大 L04 v0 ≈ 3100 個、他は 400〜1600）
- `L.zones.filter(z => z.kind === 'theme').length >= 3`（用途ゾーン。params.name に日本語名、params.preset にテーマ ID。地図に内訳線が出る）
- `L.fogFar >= 40 && L.fogFar <= 90`、`L.chunkSize === 28`（L03 は 32）、`B.chunks.length > 1`（チャンク分割されている。HUD の chunks も複数）
- `L.path.length >= 2`（進行軸。L11 は周回 6 点）
- 決定論・不変条件: 入室前後で `L.boxes.length` / `L.sockets.length` が変わらない。`game.newWorld(42)` + `?force=` で同じ形。variant（`n.variant`）は 0 = 160 m 級、4 段ごとに 120 / 96 / 72 / 60 m へ縮む（`n.variant % 4` は入口位置: 中央 / 左 1/4 / 右 1/4 / 角寄り）
- 構造（階段・回廊・手すり・間仕切り・柱・EV 籠）は `L.boxes.slice(0, L.shellCount)` に入っている（Modifier の内装処理の対象外）。家具は `L.shellCount` 以降
- 上階の出口: `L.sockets.filter(s => s.id.startsWith('up')).every(s => s.pos[1] % 3.6 === 0 && s.pos[1] > 0)`。上階出口の先の部屋は `n.portals.find(p => p.socketId === 'up0').targetRoomId` が配置済み（`game.world.graph.get(<id>).placement.position[1] === 3.6k + 自室の y`）。地図はその階に扉印
- 階段: 全階へ歩いて登れる（1 段 0.18 m × 20 段 = 3.6 m。壁沿いの帯。上階のスラブは階段の真上が切り欠かれ手すりで囲われている）。Node 検査: 各階 k について上面 3.6k の最上段が存在（`L.boxes.some(b => b.solid && Math.abs(b.max[1] - 3.6 * k) < 0.01 && b.max[1] - b.min[1] > 3.0 && Math.min(b.max[0]-b.min[0], b.max[2]-b.min[2]) < 0.5)`）
- 扉前 1.8 m に家具・階段が無い（`clearDoorways` + 予約領域の除去）。Node 検査 GROUND_SOCKET_BLOCKED / UPPER_SOCKET_BLOCKED 0 件（L02 は ShallowWater の桟橋デッキ 0.6 m が扉前を通ることがあるが縁石 0.3 で登れる）

### L02 室内海洋 — `?force=L02`（MegaHall 'sea'）
- 見た目: 100〜160 × 60〜100 m、高さ 10〜13 m の暗い高天井ホール。疎らな杭柱（14〜18 m 格子）、床全面が浅水（ShallowWater。膝下 0.5 m）と入口〜全出口を結ぶ木の桟橋（ShallowWater pier）、低い木デッキの浮橋島（0.3 m。登れる）に係船柱・木箱、浮標。各出口（幅 2.2 m の水門）の内側に金属の門柱 + 梁と `GATE n` の発光サイン。暖色の吊り灯は疎らで 3 割消灯（薄明）。ボート（VehicleRide）はいずれかの出口の外側
- JS: `L.zones.filter(z => z.kind === 'theme').map(z => z.params.name)` が `['桟橋区','外海','水門区']`（+ ShallowWater の 'water' ゾーン + VehicleRide の 'ride' ゾーン）/ `L.signs.some(s => /^GATE/.test(s.text))` / `L.sockets.filter(s => s.id !== 'entry' && s.type === 'door').every(s => s.width === 2.2)` / `n.portals.some(p => p.ride)`
- 既知の制約: 深水・水泳なし。桟橋は ShallowWater 側が作る（Modifier 無しなら浅水も桟橋も出ず、浮橋島と門だけ）

### L03 倉庫内麦畑 — `?force=L03`（MegaHall 'field'、xl = 最大 200 × 120 m）
- 見た目: 倉庫柱 12 m 格子、高さ 12〜14 m、農道格子（幅 3 m の薄い舗装帯。14〜18 m 間隔 + 外周 + 各出口へ延びる帯）、区画は低い草の箔（麦の茎は InstanceOvergrowth の InstancedMesh）、壁沿いのパレット山（InstanceOvergrowth 適用時は撤去される）、高所の白色ハイベイ灯（6 灯に 1 灯が PointLight）、高所の梁。出口は幅 2.2 m の倉庫扉
- JS: `L.chunkSize === 32` / `L.zones.filter(z => z.kind === 'theme').length === 4`（南西 / 南東 / 北西 / 北東の畑）/ `L.instances?.length >= 1`（InstanceOvergrowth の麦）/ `L.bounds.max[0] - L.bounds.min[0] >= 150 || L.bounds.max[2] - L.bounds.min[2] >= 150`（v0〜3）
- 既知の制約: 農道はガイドで必須経路ではない（InstanceOvergrowth は入口→各出口の直線帯を空ける）

### L12 設備大聖堂 — `?force=L12`（MegaHall 'nave'）
- 見た目: 幅 26〜56 × 長さ 70〜160 m、高さ 14〜18 m の身廊。中央通路の両側に 1.2 m 角柱の列（7〜9 m 間隔）と縦配管、側廊に制御室（3 m 壁の小部屋。身廊側に 1.2 m の開口。中にコンソール + 青い発光帯）、部屋の中ほどに歩ける配管橋（y 3.6。両端の側廊に 20 段の階段 + 踊り場 + 手すり）、高所の装飾配管橋（6.5〜9.5 m。歩けない）、巨大設備（金属タンク・盤。ScaleAnomaly perProp で 3〜8 倍。中央 4 m は空く）。高所の強いパネル灯は少数で半分以上消灯（高コントラスト）
- JS: `L.zones.filter(z => z.kind === 'theme').map(z => z.params.name)` に '身廊' '西側廊' '東側廊' '配管橋' / 配管橋のスラブ `L.boxes.some(b => b.mat === 'metal' && b.solid && Math.abs(b.max[1] - 3.6) < 0.01 && b.max[0] - b.min[0] > 10)` / 階段・橋はシェル側（`L.boxes.slice(0, L.shellCount)`）なので ScaleAnomaly 後も 20 段 × 0.18 のまま
- 既知の制約: 制御室は身廊側 1 開口のみ。橋の下は 3.4 m 空く

### L04 無限グランドホテル — `?force=L04`（MegaAtrium 'hotel'）
- 見た目: 3〜5 階（v0 = 5 階、高 19.8 m）、赤絨毯。各階に幅 4.5 m の外周回廊 + 吹抜側に手すり、吹抜を渡る橋 1〜2 本、壁沿いの直階段が各階間に 2 本。回廊の外壁に 3.6 m 間隔の偽客室扉（開かない）と 5 枚に 1 枚の番号板（`101`…）。地上は宴会場（柱 + 円卓）/ ロビー（受付島・ソファ・植栽）/ 客室翼（2.7 m 壁の客室列。扉開口から入れる。ベッド・ナイトテーブル・読書灯）。EV ソケット 1（外壁の籠。別階の部屋へ）。出口の 6 割は上階の回廊
- JS: `L.elevators.length === 1 && n.portals.some(p => p.type === 'elevator')` / `L.signs.length >= 20`（番号板）/ `L.zones.filter(z => z.kind === 'theme').map(z => z.params.name)` が ロビー / 宴会場 / 客室翼 / `n.mapCell.levelSpan >= 3`（多層。遠方配置時は未設定 = 1: phase2-requests 参照）
- 既知の制約: 偽客室扉はインタラクト不可。内部リフトなし（階段のみ）

### L05 屋内学園都市 — `?force=L05`（MegaAtrium 'campus'）
- 見た目: 2 階（回廊 + 橋）、地上を 5 m 通路（タイル帯）で 3×2（zoneCount 6）のゾーン格子に切り、2.2 m の間仕切り（各辺 2 か所の 4 m 開口）で囲う。テーマは 教室棟（机列 + 教卓）/ 体育館（木床 + 黄色コートライン + ゴール）/ プール（縁石 0.3 + 浅水 0.25 m。減速）/ 図書室（棚列）/ 食堂（長机 + カウンター）/ 中庭（芝 + 植栽 + ベンチ）を seed で並べ替え。ZoneThemeShuffle はこのゾーンをそのまま受け取り材質・照明色を差し替える
- JS: `L.zones.filter(z => z.kind === 'theme').length === 6` / `L.zones.some(z => z.kind === 'water')`（プールがあるとき）/ ZoneThemeShuffle 適用後 `L.zones.filter(z => z.kind === 'theme').every(z => z.params.mod === 'ZoneThemeShuffle' && z.params.preset)`
- 既知の制約: zoneCount は params から読む（2〜9）。ゾーン間は通路なので袋小路なし

### L07 垂直オフィス世界 — `?force=L07`（MegaAtrium 'office'）
- 見た目: 狭い足跡（30〜52 × 47〜90 m）に 4〜6 階（v0 = 6 階、高 23.4 m）。西の長辺は奥行 6 m のオフィス帯（ガラス間仕切り 3.3 m、1.2 m 開口が 12〜14 m ごと、中に机列 + 蛍光灯）+ 3.5 m の歩廊、他の 3 辺は 4.5 m 回廊。橋は階ごとに 1〜2 本の千鳥、階段は短辺。出口の 7 割が上階（短辺・東辺）、EV ソケット 2。天井中央に天窓帯、冷白色。視程 60 m
- JS: `L.fogFar === 60` / `L.elevators.length === 2` / `L.sockets.filter(s => s.id.startsWith('up')).every(s => s.dir !== 3)`（オフィス側の壁に出口が無い）/ `L.boxes.filter(b => b.mat === 'glass' && b.solid).length >= 4`（ガラス間仕切り）
- 既知の制約: 内部リフトなし。EV 出口は既存の resolveElevator（別階の部屋へ Seam）

### L09 無限温浴施設 — `?force=L09`（MegaAtrium 'bath'）
- 見た目: 2 階（木の回廊 = 休憩フロア。座敷島）、タイル床。地上は中央の大浴場（柱で囲まれた大浴槽。縁石 0.3 + 浅水 0.4 m）と、外周帯を 18〜26 m ごとに切った 浴場（小浴槽 2〜3）/ 更衣室（ロッカー列）/ 休憩所（座敷島 + 卓）/ プール。区画の境界は 1.2 m の腰壁（開口 2 か所）で循環する。Wetness / ParticleDetail(mist) は Modifier
- JS: `L.zones.filter(z => z.kind === 'theme').length >= 5` / `L.zones.filter(z => z.kind === 'water').length >= 2` / `L.render?.wetness >= 0.7`（Wetness）
- 既知の制約: 水面は膝下（歩ける）。3 階なし

### L11 環状モノレール都市 — `?force=L11`（MegaAtrium 'ring'、環状 footprint）
- 見た目: 外形 60〜160 m 角、幅 12〜18 m の帯 4 本の環状 footprint（中央は中庭 = 部屋の外。中庭側の壁は暗い窓ガラス材 'windowDark'）。中庭側に y 3.6 のホーム（幅 4 m、手すり）と各帯 2 か所の階段 = 8 駅、ホームの外側上空 y 4.6〜5.0 に軌道桁（金属。歩けない）と 12 m ごとの支柱。地上は外壁沿いの店舗跡（棚）と発光看板帯、青白い LED の回廊灯 + 暖色の吊り灯（夜景）。駅名サイン `ST. S/N/W/E`。出口は外周の壁だけ（幅 2.2 m）。モノレール（VehicleRide）はいずれかの出口の外側
- JS: `L.footprint.length === 4` / `L.path.length === 6 && L.path[0][1] === 4.2`（周回中心線）/ `L.sockets.filter(s => s.id !== 'entry' && s.type === 'door').every(s => /* 外周 */ true)`: `game.world.graph.get(id).portals.every(p => !p.targetRoomId || game.world.graph.get(p.targetRoomId).placement)` / `L.boxes.some(b => b.mat === 'windowDark')` / `n.portals.some(p => p.ride)` / LoopTopology は辺を作らない（`n.portals.filter(p => p.seam && !p.ride && !p.isReturn).length === 0`）
- 既知の制約: 中庭は空き空間なので他の部屋がそこに配置され得る。ホームへは階段のみ

### L14 温室都市 — `?force=L14`（MegaAtrium 'greenhouse'）
- 見た目: ほぼ正方形（60〜160 m）、2 階回廊 + 橋 2〜3 本、天井はガラス（外の環境色が透ける）、外壁の内面に明るい窓帯。地上は 24 m 級のセルを 1〜2 個結合した不規則ゾーン: 庭園（0.45 m の花壇枡 + 土 + 植栽の球。上に暖色 / 青の育成灯）/ 店舗跡（ガラス店先 + 棚）/ 遊歩道（タイル + ベンチ）。植生の小片・生垣は InstanceOvergrowth
- JS: `L.palette.ceiling === 'glass'` / `L.zones.filter(z => z.kind === 'theme').length >= 8` / `L.boxes.some(b => b.mat === 'windowLit')` / `L.instances?.length >= 1`（InstanceOvergrowth）
- 既知の制約: ガラス天井越しに他の部屋の外壁が見えることがある（OrganicZone R07 と同じ）

### L19 凍結リゾート — `?force=L19`（MegaAtrium 'resort'）
- 見た目: 主矩形（46〜122 × 32〜85 m。青白い照明）+ 側面に付くホテル翼（2 階回廊 + 偽客室扉 + 番号板、暖色）。主矩形は 凍結プール（縁石 0.3 + 'ice' 面。SurfaceFriction が滑るゾーンにする。プールサイドにデッキチェア列）と 雪面（白い箔 + 0.3 m の段丘 2 段 + ベンチ + 街灯）。視程 80（FogDepth が上書き）。上階の出口はホテル翼の外壁だけ
- JS: `L.footprint.length === 2` / `L.boxes.some(b => b.mat === 'ice' && !b.solid)` / SurfaceFriction 適用後 `L.zones.some(z => z.kind === 'friction')` / `L.boxes.some(b => b.mat === 'snow')` / `L.zones.find(z => z.params?.name === '雪面').params.tag === 'snow'`
- 既知の制約: growToFill（mainRect）時はホテル翼が付かない（Mega は growToFill 対象外なので通常は付く）。雪面は既存 'snow' 材の箔

## 検証結果の修正（fail / warn 対応）

共通の前提: `const node = game.world.graph.get(game.currentRoomId); const L = game.world.layoutFor(node); const built = game.streaming.built.get(game.currentRoomId);`

### E03 床扉の穴（fail → 修正） — `?nolock=1&new=1&seed=103&force=E03`
- 修正: CorridorGenerator が GravityAxis 付き定義の廊下幅を 2.4 m 以上にクランプ（snap で実質 2.5）。GravityAxis の床扉の穴幅を 0.9〜1.1 m（内法幅 − 1.0、通常 1.1）にした。プレイヤー AABB 幅 0.7 と同じ 0.7 m の穴では隣の床箱に支えられて落ちられなかった。スロット幅の丸め（1.6 → 1.5 になる浮動小数の誤差）も修正。
- 見た目: 廊下幅 2.5 m。壁沿いに 1.1 × 1.4 m の穴（trim 枠 + 蝶番）、反対側に 1.1 m の通路。
- JS: `L.footprint.every(r => Math.min(r.x1 - r.x0, r.z1 - r.z0) >= 2.4)` / `Math.min(L.holes[0].max[0]-L.holes[0].min[0], L.holes[0].max[2]-L.holes[0].min[2]) >= 0.9` / `L.sockets.filter(s => s.crawl).every(s => s.width === 2.1)`（端の壁が 2.5 のとき）/ 穴中心（hole ソケット pos を placement で toWorld）に teleport → `enterRoom` → 90 フレーム `step(1/60)` で `player.pos.y < -1 && currentRoomId === node.portals.find(p => p.type === 'hole').targetRoomId`。穴の脇（穴と反対側の壁寄り）を前進すると穴に落ちず end 壁まで届く。
- 既知の制約: 廊下幅が常に 2.5 になる（1.9〜2.6 の抽選が 2.4 以上へクランプされ 0.5 刻みに丸まる）。
- 追記（v1.3 Q1 床扉パネル）: 穴は扉パネルで覆われ、初期状態は閉（`covered: true, open: false`）。同 seed で r2 の hole ソケットはワールド (−0.55, 0, −23.3)、真下は r12。穴中心に teleport → enterRoom → 60 フレームで `player.pos.y === 0`（落ちない）、`built.get('r12').group.visible === false`。(−0.55, 0, −21.4) から見下ろすとヒント「E: 扉を開ける」、`devInput = { interact: true }` で 1 step → `open === true`、40 フレームでパネルが −90°（壁側に立つ）、r12 が見える。穴中心で 120 フレーム → `currentRoomId === 'r12'`、y −3.05（r12 の床）。保存 → 読込後も `covered / open` が保たれパネル・コライダが再構築される。trim 枡・蝶番の箱（index 26〜31）は `rollFrom`（32）より前で床に残る。

### 板サイン（plate）の可読性（R20 / R17 / RepeatDestination など warn）
- 修正: SignAtlas の plate 材質を弱い自己発光（emissiveIntensity 0.28、metalness 0）に。DuplicateNumber の番号板を 0.5 → 0.7 m。RepeatDestination の入口脇サイン（LoopTopology.shared.signBesideSocket）は内装の箱（偽扉の板・枠）と重なる位置を避け、廊下では 0.7 m ずつ奥へずらす。
- JS（R17 seed 177）: `const sg = L.signs.find(s => s.id === 'rd:num'); L.boxes.slice(L.shellCount).filter(b => /* sg の面 ±0.2 m と重なる */ ...).length === 0`。見た目: 入口脇の側壁に「病室 4xx〜4xx」が扉枠に隠れず読める。
- JS（R20 seed 200）: `L.signs.filter(s => s.id.startsWith('dn:')).every(s => s.width <= 0.7 && s.width > 0.5)`（大扉は 0.7）。2.5 m 先から番号が判読できる。

### FakeSky の空箔（U20 / R04 / E04 warn）
- 修正: skyOvercast / skyDusk / skyNoon の texture を 'diffuser'（拡散板の格子）から新設の生成テクスチャ 'sky'（256 px の値ノイズ 4 オクターブ、40 m）に変更。FakeSky の流れ（offset）はそのまま。
- 見た目: 見上げると格子ではなく柔らかなまだらの曇天 / 夕空 / 青空。JS: 空メッシュの `material.map.name === 'generated/sky/albedo'`（FakeSky が clone するので name は同じ）。

### R09 Theater スクリーン（warn）
- 修正: RoomGenerator Theater のスクリーンを 16:9（幅 min(室内幅 − 2, 16)、高さ ≤ 天井 − 1.5 → 6 m 天井では 8 × 4.5 m）にし、周囲を暗幕（furnitureDark 箔、全幅）で覆う。座席は幅 12 m 以上で中央通路 1.4 m を空ける。
- JS: `const s = L.boxes.slice(L.shellCount).find(b => b.mat === 'void' && !b.solid); Math.abs((s.max[0]-s.min[0]) / (s.max[1]-s.min[1]) - 16/9) < 0.02`。

### R02 LightingPhase unpowered（warn）
- 修正: 画面発光にする筐体を 12 台までに制限（103 台の emissive 焼き込みで部屋全体が明るくなっていた）。JS: `L.boxes.filter(b => b.mat === 'screenGlow').length <= 12`。

### L13 PropRepetition serverRack（warn）
- 修正: LED はレール・画面と合算で 12000 以下（LED 単独で 8400 以下）。ServerGrid の詰め物（低い非ソリッド ledBlue）は全て消す。JS: `L.instances.reduce((n, i) => n + i.transforms.length, 0) <= 12000` / `L.boxes.slice(L.shellCount).filter(b => !b.solid && b.mat === 'ledBlue').length === 0`。

### L02 桟橋の柱（warn）
- 修正: MegaStructureGenerator.common.columnGrid が全ソケット（hole 以外）の正面 6 m × (扉幅 + 両側 1.2 m) に柱を立てない。JS: entry の正面 6 m の矩形に `columnConcrete` の solid 箱が無い。到着後の流光（VehicleRide/streaks）は onExit で非表示: 到着後 `game.streaming.built.get(元の部屋).group.getObjectByName('VehicleRide/streaks').visible === false`。

### M08 FarLink（warn）
- 修正: RoomGraph.undirectedDistances（無向 BFS）で候補距離を測る（有向 BFS では一方通行 Seam の手前へ戻れず distance 5 が選ばれた）。JS: `game.world.graph.undirectedDistances('r1').size === game.world.graph.nodes.size`（全ノード連結）/ FarLink の `modifierState.FarLink.distance >= 30`（訪問済みが 30 部屋以上先にあるとき）。
