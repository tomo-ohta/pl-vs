# Modifier / Generator / 音響 / Seam 削減 実装前分析（2026-09-16）

自動分析（9 領域並列）の結果を統合したもの。ユーザー確認前のドラフト。

## 総括

9 領域の分析を統合し、実装を大きく左右する質問を 12 件（blocking 2 / important 7 / minor 3）に絞りました。blocking は「重力軸回転を見た目だけで表現するか」と「Legendary 巨大部屋の規模上限と地図表現」の 2 件で、どちらも RoomBuilder・配置・地図の基盤設計に直結します。important は部屋別霧の方式、乗車演出の量、巻き戻し範囲、M20 の Legendary 不足時、音源アセット方針、M05 のノード構成、Seam 残件の扱いです。それ以外の論点（E02 の階数、M19 の回転範囲、U06 の解錠イベント、U14 の beacon 位置、'street' ゲート化、DynamicMapNode の Seam 方式、側道前室の廃止など）は妥当な既定値を assumptions に置いたので、違和感があるものだけ指摘してください。技術的に困難な項目（真の重力回転、L02 の深水、E13 の真の伸縮、複数ノードの記号フロア、明瞭な人声合成など）は代替案付きで infeasibleOrDeferred にまとめています。実装順序は「Modifier パイプライン → RoomLayout 拡張 → 環境適用フック → MaterialLibrary.variant → RoomBuilder 拡張（InstancedMesh・サイン・チャンク）→ ゾーン/プレイヤー効果 → PlayerRide/Proxy → Seam 一般化 → footprint 修正 → 地図 → AudioEngine」を先頭に置くことを推奨します。クラスタ間で重複提案されていた zones 型・Modifier フック名・InstancedMesh 経路・チャンク分割は 1 つの基盤に統一する前提で記載しました。

## 実装前に確認する質問

### Q1. 重力軸回転の表現（GravityAxis）（blocking）

E03 横向きホテル / E10 天井エスカレーターの重力軸回転を、見た目だけ（部屋の中身を 90° ロールして生成、E10 はスクリプト移動でカメラをロール）で表現してよいですか。本当にプレイヤーの上方向を変える案は物理・ソケット互換・配置・地図の 4 系統に手が入ります。

- A: 見た目だけ横倒し（物理・カメラ系・配置・扉互換は不変。工数 M）
- B: 本当に重力軸を変える（X 上向き物理 + camera.up + 重力遷移 Adapter + Placement の roll 対応。工数 L〜XL、スマホ酔い Q3 を抱える）

推奨: A（実機検証後に B へ拡張する余地は残す）  
影響: GravityAxis, PlayerRide, E03, E10

### Q2. Legendary 巨大部屋の規模上限と地図表現（blocking）

MegaStructure / Street 系 Legendary（L01〜L20 の 14 部屋）の初回実装の最大寸法と、地図での見せ方をどうしますか。仕様の「16 セル（64 m）で打ち切り」のままだと 100 m 級で扉・隣室が矩形外に浮きます。

- A: 仕様どおり Mega / Street とも最大 64 m 角、地図は 16 セルで打ち切り（チャンク分割は視錐台カリングのみで足りる）
- B: RoomBuilder チャンク分割 + 時間分割ビルドを前提に Mega は 60〜160 m（xl 200 m）、Street は 64 m から開始し基盤後に 80 m へ。地図は Legendary だけ 80 セルに緩和し実寸矩形 + ゾーン内訳線を描く
- C: 仕様上限（300 m / 5 街区）まで最初から許す（MegaStructure と同等の内部ストリーミングが全 Generator に必要）

推奨: B  
影響: MegaStructureGenerator, StreetGenerator, RoomBuilder チャンク分割, GridProjector MAX_CELLS, MapCell.levelSpan, L01, L02, L03, L04, L05, L07, L09, L10, L11, L12, L14, L15, L17, L19, L20

### Q3. Seam 削減後に残る進行不能扉の扱い（SEAM-9）（important）

SEAM-1〜5 導入後も踏破 100 部屋あたり約 5 件残る「どこにも置けない進行用扉」を、Seam 扉のままにするか施錠して行き止まりにするか決めてください。

- A: Seam 扉のまま（開けた瞬間に座標遷移、地図「？」。Common〜Rare でも稀に非ユークリッド遷移が起きる）
- B: 施錠して行き止まり（仕様のデッドエンド許容 10〜20% 内。ただし戻りの無い部屋では閉じ込め）
- C: ハイブリッド。戻りがある部屋は施錠、戻りの無い部屋（Hole / Seam 着地・エレベーター籠・開始部屋）だけ Seam

推奨: C（実装差分は lockOrVestibule の最終分岐 1 箇所）  
影響: SEAM-9, SEAM-1, SEAM-2, SEAM-3, WorldManager.lockOrVestibule

### Q4. 部屋ごとの霧の方式（FogDepth）（important）

部屋ごとの霧を、入室時に scene.fog を補間する方式（A）と、部屋の材質に部屋固有の fog を持たせる方式（B）のどちらを最終形にしますか。B は扉を開けた瞬間に向こうの部屋が固有の霧色で見えます（D5 の実配置の売り）。

- A: 入室時に scene.fog を 0.8 s で補間（実装 S。扉口では隣室に現在部屋の霧がかかる）
- B: 部屋別 fog を材質 variant で持つ（実装 M。扉口から向こうが固有の霧で見える。シェーダ 1 族追加）

推奨: B（Phase 順は A → B。A は環境適用フックとして他 Modifier にも必要）  
影響: FogDepth, AmbientCarryover, MaterialLibrary.variant, U13, R03, R05, R06, L01, L19, M14, M18

### Q5. 乗車演出の量（VehicleRide）（important）

E11 浮遊列車 / L02 ボート / L11 モノレールの乗車中演出をどこまで作りますか（durationSec 20〜30 秒）。

- A: 乗車→暗転 3 秒→到着（車内演出なし、durationSec 無視）
- B: 車内で durationSec 秒待つ。窓の流光 + 微振動、視点のみ操作可
- C: B と同じ演出だが 5 秒経過後は E / タップで到着を早められる（durationSec は上限）

推奨: C  
影響: VehicleRide, PlayerRide, E11, L02, L11

### Q6. 巻き戻しの対象（RewindState M10）（important）

M10 巻き戻しフロアで 20 秒ごとに戻す対象をどこまでにしますか。

- A: この部屋の扉状態のみ（自動閉扉と区別がつきにくい）
- B: 扉状態 + プレイヤー位置・視点（入口側へ戻される。回数上限 2 回で脱出保証）
- C: B に加えて隣接部屋で開けた扉も戻す（隣室のストリーミング状態・セーブ整合が増える）

推奨: B  
影響: RewindState, M10

### Q7. M20 中央接続室で既発見 Legendary が不足するとき（important）

M20（FarLink discoveredLegendary, count 4）到達時に既発見 Legendary が 0〜3 件しか無い場合、どう扱いますか（docx 未決 Q5）。

- A: 0 件なら M20 を抽選から除外し、1〜3 件なら far 扉の本数をその数に減らす（施錠扉を並べない）
- B: 不足分は既発見 Epic 以上 → それも無ければ最遠の既訪部屋で代替（常に 4 枚）
- C: 不足分は施錠扉（多くの場合 4 枚全部が施錠）

推奨: A（B の Epic 代替は任意の追加）  
影響: FarLink, HubGenerator, RarityGenerator.pickDefinition, M20, M08

### Q8. 音源のアセット方針（important）

音声アセットが無いため全音を WebAudio 合成で作ります。人声・楽音系（遠い笑い声、館内放送、チャイム、ピアノ、BGM、犬・鳥・虫）は合成だと「言葉にならない声」になり不気味さに寄ります。どうしますか。

- A: 全て合成で出荷。人声はフォルマント合成の不明瞭な声として不気味さを許容
- B: 約 10 ラベル分の CC0 / 自前録音アセットをユーザー側で用意し public/audio/ に置く（届くまでは合成で代替）
- C: A で出荷しつつ、ファイルがあれば差し替わるマニフェスト + ローダ（合成フォールバック付き）を用意

推奨: C  
影響: AudioEngine 基盤, audioPreset 写像, AssetManifest, U19, L07, L16, L19, L20, C17

### Q9. 俯瞰記号フロア（M05 GraphMacro）のノード構成（important）

地図上で記号（矢印・十字・環・T・H）を形成する M05 を、仕様どおり複数 RoomNode で作るか、1 部屋の footprint で記号形を作り地図が footprint を描くように変えるかを決めてください。

- A: 単一ノード。footprint で記号形を作り、Minimap / Map3D が footprint の各矩形を描く（既存の折れ廊下・翼付き部屋の地図表現も改善）
- B: 複数ノード。中央 + 腕ノードを専用のマクロ配置トランザクションで同時配置し扉で接続（複数ノード同時配置・ロールバック・カウント除外の新経路が必要、工数 L〜XL）

推奨: A（B は保留）  
影響: GraphMacroGenerator, 地図の足跡描画, M05

### Q10. R09 監視映画館のスクリーン内容（PastWindow）（minor）

R09 のスクリーンに何を映しますか（3 秒遅延）。

- a: この劇場内の固定監視カメラ映像。自分が 3 秒遅れて入ってくる。出口を画面内に収めて次部屋ヒントにする
- b: 進行方向の隣室を固定カメラで映す（静的な部屋なので遅延は体感できない。隣室を RT パスだけ強制可視にする処理が必要）
- c: プレイヤー自身の 3 秒前の視点（POV）

推奨: a  
影響: PastWindow, SnapshotService, PlayerProxy, R09

### Q11. M15 壁の裏側（RenderStyle backside）の解釈（minor）

M15「壁の裏側」をどう見せますか。

- a: 構造裏の素地（コンクリ・配管・スタッド）+ 家具や棚を BackSide で中空に見せ、サインを左右反転
- b: 全材質を BackSide にして近い面が透け奥の面だけ描かれる（壁厚 0.15 m のため単体では弱く、a との併用前提）
- c: 直前に訪れた表側部屋の壁裏に対応した配管・配線を配置（字義通り。表側部屋のレイアウト参照と配置協調が必要、工数 L 以上）

推奨: a（b の要素は家具・棚に限定して併用）  
影響: RenderStyle, M15

### Q12. M06 100% 扉の閾値（minor）

M06（DiscoveryGate）の解錠閾値の決め方はどれにしますか。

- A: 固定 100（データ既定値。Mythic 最低深度 35 との差が「後で戻ってくる」動機になる）
- B: M06 到達時の発見数 + 25 をノードに固定（文脈依存の値の保存が必要）
- C: 固定だがもっと低い値（例 60）

推奨: A  
影響: DiscoveryGate, M06

## 技術的に困難・保留（代替案付き）

- **FutureAudio**: 使用部屋なし（E05 欠番、D8 で予測系演出をオミット）。近接予測での復活案も予測系演出そのもの  
  代替: Modifier 本体は実装せず「登録なし → 無視 + world.log」。効果音イベントログ（60 秒リング）だけ AudioEngine に持たせ、E12「遠い過去音」/ M10「逆再生環境音」が共用する
- **GravityAxis mode fixed（真の重力回転）**: PlayerController（軸並行 AABB・Y 固定）、Placement（yaw のみ）、ソケット（床位置の直立開口）、GridProjector の 4 系統を触る L〜XL 規模。スマホ酔い（未決 Q3）も未検証  
  代替: E03 は廊下の中身を 90° ロールして生成（実 Portal は直立の通常扉）、E10 は PlayerRide のスクリプト移動でカメラ up を補間。Q1 参照
- **ShallowWater mode sea（L02 depth 2.0）**: 水深 2 m は歩行不能で、VehicleRide + MegaStructureGenerator が前提。水泳・溺れの物理は無い  
  代替: L02 は膝下 0.5 m の歩行可能な浅水 + 入口と全出口を結ぶ桟橋ネットワークで先行実装。boat ソケットは door として出力し、VehicleRide 実装後に乗船点へ置き換える
- **ScaleAnomaly perProp の小型扉（R16「しゃがみ/専用遷移」）**: しゃがみ操作が無く、0.5 倍の開口は隣室との扉寸法互換（DOOR_W×DOOR_H）を壊す  
  代替: 実 Portal は通常寸法のまま、0.5〜2.0 倍の小型/巨大扉は壁面の偽扉 Box として置く。M12 の実装メモ「10〜30 倍」もデータの 4.0 を採用
- **MovingWalls M07 本来版（床セル移動 + 経路グラフ更新）**: DynamicGridGenerator 未実装。セル移動で外殻・ソケットが動くと 1 hop 物理配置と frozen 不変条件が壊れる  
  代替: 外周回廊・ソケットは固定、内部の壁ブロック（スライドパズル型、最大 8 個）だけ動かす。E18 と共通の可動要素基盤で実装。床タイルに乗って運ばれる案は後日
- **DynamicLength E13 の真のセグメント増減**: 奥の扉ソケットと隣接部屋の配置が動くため frozen 不変条件と 1 hop 配置に反する  
  代替: 配置は max 長（60 → 48/36/24 m）で確定し、室内に「偽の突き当たり」を動的コライダとして置いて見える長さだけを位置の関数で伸縮させる
- **PastWindow E12「過去ノードを生きたまま描画」**: 2 hop 先は dispose 済みで描画できない。RenderTarget の追加パスは Low Tier の draw call 予算も圧迫する  
  代替: 10 秒ごとの現在視点スナップショット 3 枚（30 秒）を窓に古い順で表示。Low Tier は静止キャプチャ、R09 は 3 秒ごとの静止（自然に 3 秒遅れる）
- **RenderStyle M15 backside 案 c（表側部屋の壁裏座標と対応）**: 表側部屋のレイアウト参照と配置クラスタの協調が必要で工数 L 以上  
  代替: 案 a（素地 + BackSide 家具 + 反転サイン）で表現。Q11 参照
- **GraphMacro 複数 RoomNode 方式**: 1 定義から 5〜9 ノードを 1 トランザクションで配置しロールバックする仕組みが無く、占有率 0.54 の世界では記号が崩れる。visitedCount が複数回加算される副作用も  
  代替: 単一ノードの footprint で記号形を作り、地図が footprint を描くように変更（Q9）
- **MegaAtrium 部屋内リフト（L07「壁面オフィスを EV で接続」）**: Game.tryElevator / Portal に新しい遷移種別を足すため他部屋の EV 挙動にも影響する  
  代替: v1 は階段・斜路のみで全階到達を保証。EV ソケットは出口専用（既存 resolveElevator）。部屋内リフトは L07 専用の追加課題
- **FogDepth far 160（L01）/ 巨大部屋の視程**: Tier の fogFar は 40/60/90 で、それ以上は見えず生成コストだけ増える  
  代替: far = min(far, tier.fogFar) でクランプ。チャンク出現距離を fog の向こう側に固定する
- **ExternalForce R18「風向と逆方向ほどレア出口率上昇」/ MaterialGradient R15「ホテル系への接続確率増」**: 接続抽選側（RarityGenerator）の重み付けで、v1 の Modifier 基盤の範囲外  
  代替: 後日 PickOptions に bias を足す口だけ残す（NoiseGate の帯別 PickOptions と同じ拡張点）
- **FakeSignage U06「3:17 相当イベントで出口解錠」**: 「施錠扉に解錠手段なし（塞いだだけ）」の確定判断に反し、時限イベント + 入室後の隣接部屋追加という新機構が必要  
  代替: 全時計を 3:17 に固定する装飾のみ（秒針 1 本だけ回す）
- **音: 明瞭な日本語放送・特定楽曲・明瞭な人声**: WebAudio の手続き合成では作れない。Web Speech API は WebAudio に取り込めず定位・残響が掛からない  
  代替: 「言葉にならない声」のフォルマント合成 + AssetManifest（ファイルがあれば差し替え、無ければ合成）。Q8 参照
- **SEAM-6 frozen の緩和 / SEAM-8 施錠扉の解錠直結**: headless 実測で効果がそれぞれ −3% / 2% 未満と小さく、再構築タイミングの注意点や実装コストに見合わない  
  代替: SEAM-1〜5 導入後に再計測し、frozen 起因が目立つ場合のみ着手
- **Legendary 300 m / 5 街区（仕様上限）**: fogFar 最大 90 m で見えず、bake・メモリ・配置成功率が成立しない  
  代替: データ上は上限として許すが既定バリアントには含めない。Q2 の規模に従う
- **未実装 Generator 依存部屋の本来の景観（R01/R04/L01〜L20/M05/M07/M20）**: Pool / Street / MegaStructure / DynamicGrid / GraphMacro / Hub の各 Generator は未実装で LargeRoom 代替 + TODO サイン  
  代替: Modifier と接続ロジックは Generator 非依存の汎用パスとして今作り、fallback 部屋上で動かす。Generator 実装時はチャンク矩形・zones を渡すだけで流用

## 質問せず既定値として進める前提

- 【共通】Modifier のレイアウト効果はすべて generateLayout / layoutFor 内の決定論的 post-pass（rng = Rng(node.seed).fork('mod:'+id)）で完結させ、毎フレーム処理は uniform・位置・可視性・テクスチャ更新のみ。frozen（現在部屋は再構築しない）不変条件はそのまま維持
- 【共通】グラフ状態に依存する選択（GraphReference の展示、AmbientCarryover の sourceRoomId、FarLink の行き先、DiscoveryGate の閾値、RewindState 回数）は初回 layoutFor / ノード生成時に node.state.localFlags へ JSON 化可能な型で保存し、dirty 再構築・ロード後も同じ結果。SaveData.version は 1 のまま（追加は全て省略可能フィールド）
- 【共通】未実装 Generator 依存の部屋（R01/R04/L01〜L20/M05/M07/M20）にも Modifier を fallback LargeRoom 上で先行適用する（後で捨てる作業が無く、Legendary の異常表現がゼロの期間を作らない）
- 【共通】再配線・スワップ系（E07 ObservationRewire、M03/M07 DynamicMapNode）は仕様 3.3「再配線は Seam」に従い、対象部屋の前進扉を全て Seam 化して接続先の差し替え（pending 定義 + 扉上サインの交換）で表現する。物理配置済みサブツリーを削除して再接続する案は採らない
- 【共通】Tier で寸法・抽選・当たり判定を変えない。Tier 差は InstancedMesh.count / Points.drawRange / パネル数 / RT 更新周期 / 明滅の有無 / Convolver→フィードバックディレイなど描画・音の量だけ
- 【描画】ColorMissing は全 Tier を材質側（colorMask uniform）で実装し EffectComposer は導入しない。隣室・HUD・ミニマップは影響なし
- 【描画】FakeSky は天井高の発光面（256² CanvasTexture の空）で表現し遠景スカイボックスにしない。日射は SurfaceLighting の directional emitter で焼き込み、ランタイム動的光は中央 1 灯のみ
- 【描画】InvertedShadow はブロブ影デカール + 単一 PointLight で表現し、焼き込み影の遮蔽判定は E06 で無効化。動的影は使わない
- 【描画】MirrorOffset は RenderTarget を使わず、部屋ジオメトリの反転コピー + PlayerProxy（0.5 s 遅れ）。鏡裏空間は reservedBounds で占有扱いにし、配置に失敗するバリアントは鏡なし生成
- 【描画】WaterWall は 1 枚板、コライダ無し、通過演出は既存 #fade を青で 0.25 s。配置失敗時は壁へ戻し別ソケットを再選択しない。幅は Adapter 前室と同じ 2.2 m 固定
- 【描画】Wetness の反射は共有 PMREM のまま（実反射なし）。水たまり密度は面積/25・上限 40
- 【描画】RenderStyle untextured でも扉パネルは通常描画（出口＝唯一のランドマーク）。legacy はテクスチャ縮小版を起動時に 1 度生成して共有
- 【描画】EraPreset E02 の VerticalCore は 2 レベル固定のまま、seed で eras から 2 つ（下が古い）を選ぶ。3〜4 レベル版は作らない
- 【描画】LightingPhase の明滅は seedPhase のみ（Low Tier は静的）。allWindowsLit は StreetGenerator 実装まで壁面の発光窓帯で簡易表現
- 【プロップ】反復・植生の細かい要素（商品・スーツケース・麦・低木）は InstancedMesh（非ソリッド）、大きなユニット（卓・棟・扉・生垣）はソリッド箱で出し、当たり判定は全 Tier で一致させる。InstancedMesh 経路の実装は RoomBuilder 側の 1 か所（Modifier クラスタと MegaStructure クラスタで共用）
- 【プロップ】PropOrientation 'wall' は「ソケットの無い最長の壁を向く」と解釈。ParticleDetail の respawn は全 type ループ再生で特別扱いしない
- 【プロップ】GraphReference M16 は params.mode='past' より接続ルール「通常生成から除外されたテンプレ候補」を優先し、未発見定義を展示（名札は定義名のみ）。E14 は 1 hop で確定済みの隣接定義を写真化（予測ではない）
- 【プロップ】AmbientCarryover の source は「直前に訪問した Rare 以上」を優先し、無ければ直前訪問部屋。M18 ノード生成時に固定・保存
- 【物理】ScaleAnomaly(room) は Three.js の Group スケールではなくレイアウト段階で footprint・箱・照明を ×s し、Portal 開口は通常寸法のまま（巨大な空間に普通の扉）。該当部屋は床穴を出さない。E13 も床穴なし
- 【物理】SurfaceFriction は zone データが無いため全室適用（frictionScale = friction²）。ExternalForce の方向は部屋ローカル +Z（入口→奥）を既定、U03 は stairs Adapter を escalator 見た目にして踏面をゾーンに、L15 は車線帯を端壁 3 m 手前で切る
- 【物理】MovingWalls / DynamicLength の外殻・ソケット・footprint は不動。動くのは室内パネル・偽端と動的コライダのみ（扉前 ±1.6 m と通路幅 1.2 m を常に確保、位相は実時間ベースで保存しない）
- 【物理】VehicleRide の行き先は初回乗車時に確定し Portal.targetRoomId に保存（エレベーターと同じ）。到着先は新 Adapter 'platform'、車両は Box 合成で GLB は導入しない。乗車中はメニュー/セーブ不可
- 【接続】LoopTopology E01 のループ継ぎ目は v1 では現行 Seam の流用（閉扉→150 ms フェード→A の入口へ）。周期ノードは別 RoomNode として発見数に数える。L11 は環状 footprint そのもので満たし、グラフ辺の自己接続は作らない
- 【接続】FarLink（M08/M20）と FakeExit（M04）は一方通行。既訪部屋（frozen）に戻り Portal は追加せず、ハブ・元部屋へは通常経路で歩いて戻る。Hub の far 扉は E/タップで開けたときだけ遷移（checkSeamCrossing の自動遷移は緊急 Seam のみに限定）
- 【接続】NoiseGate E17 は 1 帯 1 扉の 3 扉構成。マイク許可は E17 での最初の扉操作時に要求し、拒否/未対応/非 HTTPS は移動音量（静止/歩行/ダッシュ・ジャンプ）で代替。マイク結果は localStorage に保存しない
- 【接続】RepeatDestination の「正解階」は D1/D2 に従いメカニクス無し（番号・照明色の微差のみ）。NonEuclideanVolume E08 は殻 4×4 m + 内部（面積 4 倍）の 2 ノードで、内部は初回開扉時の遅延生成
- 【接続】MultiEdge M11 は主扉 1 枚だけ物理接続、他 3 枚は mirrorOf で開閉状態を共有する Seam
- 【地図/サイン】サインは SignAtlas（数字・英字・矢印・固定漢字語彙）で結合し部屋あたり +2〜3 draw call。任意文字列（案内板・時計盤・電子サイン・メーター）だけ CanvasTexture で部屋あたり最大 3 枚
- 【地図/サイン】DuplicateNumber の番号は seed から決定論的に再生成し保存しない。U16 の欠番率・重複率は各 0.2。FakeSignage E16 truthRatio 0.3 / R10 0.5 / U05 は必ず壁（EXIT の先は開かない偽扉、鍵なし）。E15 の小数階は看板だけで HUD のフロア表記は変えない
- 【地図/サイン】MapRotation M19 は滞在中だけミニマップ・全体マップ・Map3D を回転（angle 90 + drift ±25°/30 s、入退室 0.6 s イーズ）し退室で戻す。保存なし。MapErase M02 は localFlags.mapErased で表示側だけ除外、発見数は減らさない
- 【地図/サイン】TemperatureField E19 は HUD の温度数値 + 薄い色被せ（CSS）で、ポスト処理・追加ライト・音は使わない。場は構築時に再計算し保存しない
- 【音】全音を WebAudio 手続き合成で作り、rooms.json の audioPreset ラベルは TS 内の静的キーワード表で約 55 レイヤーへ写像（rooms.json に新フィールドは追加しない）。BGM は 4 和音パッドの「聞き取れないムード音楽」、館内放送は不明瞭な声
- 【音】音量スライダーは master / 環境音 / 効果音の 3 本（Settings を localStorage 'liminal.settings.v1' に保存）。AudioContext は開始オーバーレイのタップで生成し、iOS の interrupted は visibilitychange/focus/pointerdown で resume 再試行。PannerNode は equalpower（HRTF 不使用）
- 【音】足音の床材は palette.floor（部屋単位）で決めレイキャストしない。残響は現在部屋 1 つ分、RT60 を 5 段階に量子化。環境音・足音の乱数は Math.random（決定論から分離）、beacon の Portal 選択だけ Rng fork
- 【音】AudioEvent U14 の beacon は誘導先 Portal の位置に置く（電話プロップは追加しない）。通過で停止し localFlags に保存、再訪時は鳴らさない
- 【Generator】Legendary は D4 どおり 1 定義 = 1 RoomNode（発見数 1）。内部ゾーンは zones[] で持ちチャンク分割・地図内訳・Modifier 適用の受け皿にする。巨大部屋が周囲に入らないときは前室 Adapter + Seam で遠方（tryPlaceFree 広域）に配置する（Legendary は Seam 許可、地図は「？」）
- 【Generator】Mega/Street の階高は 3.6 m 固定、上階出口は buildShell の y 対応 Opening で切る。歩行で全出口へ到達できる構造を Generator が保証し、VehicleRide / ShallowWater / InstanceOvergrowth 等の Modifier は上乗せ
- 【Generator】'street' Portal は door-like（isDoorLike ヘルパで door | street）として閉じられる幅広ゲートにし、既存の可視性・自動閉扉・2 hop dispose に乗せる。boat / train ソケットは VehicleRide 実装まで door として出力
- 【Generator】PoolCorridor の「曲率」は L/Z/U/T/cross の折れで近似（斜め・円弧なし）、床は y=0 のまま 0.25 m の描画専用水面。Street は ROOMLIKE（Hole 落下先）に追加、Pool は追加しない
- 【Generator】DynamicGrid M07 は壁ブロックのスライド（乗らない、接触しそうなら停止）で v1。HubGenerator M20 の far 扉数は既発見数に合わせて減らす
- 【Seam】側道扉（mustSucceed=false）には前室を挿入せず即 locked（3/4 は壁へ戻す）。前室は進行保証扉のみ。実測で Seam −32%、前室ノード 約 1,000→約 100、施錠扉率 6.5%→8.3%。演出用の暗い前室は別途 Modifier 側で明示的に置く
- 【Seam】進行保証の再試行は全候補を Seam 禁止で試し切り → 未構築・未凍結の部屋にだけ新設ソケット（最大 1 本、扉のみ）→ 一段小さい定義（SmallRoom/Restroom）で再抽選 → 前室、の順。findWallBehind の既存ソケット近接判定を 1.6→3.6 m に揃える。目標: 生成ノード 100 あたり Seam 4.7→約 1.4
- 【開発】Mythic / Legendary の検証用に `?force=<ROOM_ID>` で次の抽選を固定する開発用フックを RarityGenerator に入れる。Seam 削減効果は tools/seam-stats.mjs（rolldown + Node headless）で実装後の本体コードを再計測する

## 共通基盤（実装順）

- 1. Modifier パイプライン（src/modifiers/index.ts に単一レジストリ、1 ファイル 1 Modifier）: フェーズは layout（generateLayout/layoutFor 直後の決定論 post-pass）/ onConnect・onNodeCreated（WorldManager.connectPortal / finalize）/ build（RoomBuilder.build 末尾）/ onEnter・onExit（Game.enterRoom）/ update（Game.step、現在部屋 + 可視部屋のみ）/ canOpen（interactRay / updateHint、既定ヒント「この扉は開かなそうだ」）。modParams(def, id) ヘルパ、node.state.localFlags 保存規約、RoomStateDiff.modifierState / rewireLog、Observation.isDoorObserved ヘルパを含む
- 2. RoomLayout 純データ拡張（src/generators/layout.ts、全て任意フィールド）: zones[]（kind: water|friction|force|lane|block|theme, aabb, vector, params — 全クラスタで 1 つの型に統一）、shellCount / furnitureFrom、path（進行軸）、instances[]、particles、decals[] / signs[] / anchors[]、dynamics[]、vehicles[] / paths[] / rides[]、mirrors / waterWalls / reservedBounds、render（材質オーバーライド）、fogFar、Box.chunk
- 3. 部屋単位の環境適用フック（Game.enterRoom 1 箇所）: palette + FogDepth / AmbientCarryover / layout.fogFar から scene.fog・background・hemi・ambient を設定（案 A 補間）、AudioEngine.setRoom も同じ場所から呼ぶ
- 4. MaterialLibrary.variant(matId, overrides) + QualityTier 拡張（fogFarCap, rtUpdateHz, flicker, decals, puddles, instanceScale, particleCap, decalRes）+ 新 MatId 群（lightGreen/lightYellow/screenGlow/sky*/waterShallow/waterWall/shadowDecal/untextured/floorAsphalt/wallBrick/windowLit/windowDark/sodiumLight/signPlate/signEmissive）+ Rare 以上を 2 hop 先で確定した時点の renderer.compile 事前コンパイル + dispose 連動 LRU
- 5. RoomBuilder 拡張（担当を 1 か所に集約）: InstancedMesh 経路（instances）、Points（particles、頂点シェーダで時間更新）、SignAtlas 結合 + updateLabel（CanvasTexture 再描画、部屋あたり ≤3 枚）、dynamic Mesh + dynamicColliders、BuiltRoom.zones / effects / labels、軸並行格子（24/32 m）チャンク分割 + 距離 dispose + 時間分割ビルド（rAF 4 ms/フレーム）、SurfaceLighting の 8 m 近傍インデックス・directional emitter・skyAmbient・areaEmitter・遮蔽判定オフ
- 6. ゾーン / プレイヤー効果システム: BuiltRoom.zones（ワールド AABB）→ Game.step が足元ゾーンを合成 → PlayerController に frictionScale / external（既存）/ depenetrate(colliders) / moveRank・strideAccum・landedSpeed の公開。ShallowWater / SurfaceFriction / ExternalForce / 足音 / NoiseGate 代替が共用
- 7. PlayerRide（スクリプト移動・入力無効・camera.up 補間・フェード、Game.state 'riding'）+ PlayerProxy / PoseHistory（30 s リング）+ SnapshotService（256×144 RT プール、Tier 別更新周期）。VehicleRide / GravityAxis(E10) / MirrorOffset / PastWindow / InvertedShadow / GraphReference が共用
- 8. Seam・接続系の一般化（WorldManager / Game）: connectPortal の mustSucceed を {allowVestibule, allowSeam} に分解、canRelayout(node) の明示、isDoorLike(type)（door | street）、Portal.far / mirrorOf / targetPortalId、RoomInstance.loop / repeat / role / layoutSeed、rollRoomNode の forceDefinitionId / smallOnly、resolveSeamTarget の spawnAtPortal・forceDefinitionId、Game.transition(fadeMs, holdMs, overlayText)、checkSeamCrossing を緊急 Seam に限定、FarLink リゾルバ（RoomGraph.bfsDistance）、resolveElevator → resolveVehicle（AdapterKind 'platform'）、removeSubtree の集約
- 9. footprint / Generator 共通修正: buildShell の Opening y 対応（上階出口）、findWallBehind 近接判定 3.6 m、corridorSegments の export（T/cross 追加）、RoomGenerator.furnish の矩形指定 export、hasFreeExit 枡を最小前室サイズへ、AdapterGenerator 2 m ミニ前室、Generator 登録の定型作業（index switch / IMPLEMENTED_GENERATORS / VARIANTS / presets BASE / growToFill 対象 / ROOMLIKE / visualReviewCases）
- 10. 地図側の受け口（Minimap / Map3D / MapPanel / GridProjector）: MapView.rotation、hidden（mapErased）除外、footprint の各矩形描画、MapCell.levelSpan / subCells、Legendary の MAX_CELLS 緩和、'water' / 'street' グリフ、revealNeighbors（SelfMap 用）
- 11. AudioEngine 基盤（src/audio/）: AudioContext + master/ambient/sfx バス + リバーブ send、Synth レイヤー工場（共有ピンクノイズ 1 本 + フィルタ）、presetMap（ラベル→レイヤー）、AmbientMixer（現在部屋 + 扉越し漏れ音 1 本）、Reverb（Sabine RT60 5 段階、low Tier はフィードバックディレイ）、Footsteps / DoorSfx、LoudnessSource（マイク + 移動代替）、効果音イベントログ（60 s）、AssetManifest + ローダ（合成フォールバック）、Settings.ts（音量 3 種・感度・Tier 手動値・言語）
- 12. RoomGraph 拡張: visitLog（訪問順、上限 64）/ prevRoomId を toJSON/fromJSON に含める（省略可能、version 1 維持）。AmbientCarryover / 音のクロスフェード元 / GraphReference past が使う
- 13. 検証基盤: tools/seam-stats.mjs（rolldown で WorldManager を Node で束ねる headless 計測、決定論・ロード整合チェック付き）、RarityGenerator の `?force=<ROOM_ID>` 開発用フック、window.game.audio.debug()

## 領域別の詳細

### 描画・材質系 Modifier（LightingPhase / Wetness / ShallowWater / ColorMissing / FakeSky / FogDepth / MaterialGradient / InvertedShadow / RenderStyle / WaterWall / MirrorOffset / PastWindow）

共通基盤: 現行コードの前提: 材質は MatId 単位で全部屋共有（MaterialLibrary.cache）、部屋固有の陰影は頂点属性 bakedLight に焼き込み済み、fog は scene.fog 1 つ（palette.fog は未使用）、ポスト処理・ブロブ影・プレイヤーの身体メッシュ・PortalType 'water' の実処理は無い。Modifier は現在未適用（データのみ）。以下を先に用意すると 12 種すべてが同じ経路に乗る。

1) 適用フック（4 段）
- レイアウト時: src/generators/index.ts の generateLayout 末尾で applyLayoutModifiers(L, p) を呼ぶ（生成器本体は最小改修）。乱数は p.rng.fork(`mod:${id}`) で決定論。Generator が知る必要がある情報（LightingPhase の区画色、MaterialGradient の進行軸）は GenParams.lightingPlan / RoomLayout.path として受け渡す。
- 3D 構築時: RoomLayout.render（RoomRenderOverrides: wetness, colorMask, style, gradient, fog…）を RoomBuilder が読み、材質取得を materialFor(matId) に一本化して MaterialLibrary.variant(matId, overrides) を経由。bakedLight と同様に頂点属性 roomAttr（gradT 等）を付与。BuiltRoom.effects: RoomEffect[] を返す。
- 毎フレーム: RoomStreamingManager.updateEffects(dt, ctx) が現在部屋 + 可視部屋の effects だけ更新（明滅 uniform、鏡像プロキシ、水壁通過、スナップショット更新）。dispose と連動。
- 入室時: Game.enterRoom → effects.onEnter（FogDepth の遷移、background）。
- 接続決定時（接続クラスタと境界）: WorldManager の 'water' ソケット処理、MirrorOffset の reservedBounds を fits/growToFill で占有扱い。

2) MaterialLibrary.variant(matId, overrides)
- uniform 値だけ違う variant（Wetness の roughness、ColorMissing の colorMask、FogDepth 案B の roomFog）は新規シェーダプログラムを生まない。キーは値を量子化（wetness 0.1 刻み等）し、常駐部屋 ≤ 約 6 × MatId ≈ 15 で上限を持つ LRU。
- プログラムが増える variant は 4 族に限定: untextured / legacy / gradient / roomFog(案B)。初回構築時のカクつき対策に renderer.compile による事前コンパイル（Rare 以上の部屋を 2 hop 先で確定した時点）。
- 共通 onBeforeCompile に colorMask uniform を追加（既定 [1,1,1]）。SURFACES に新 MatId: lightGreen, lightYellow, screenGlow, skyOvercast, skyDusk, skyNoon, waterShallow, waterWall, shadowDecal, untextured。

3) RoomLayout 拡張フィールド（すべて任意・純データ）
render, zones（{kind:'water'|'friction'|'force', aabb, params} — 物理クラスタの SurfaceFriction / ExternalForce / ParticleDetail(rain) と共用）, path（進行軸: 廊下セグメント列）, mirrors, waterWalls, decals, sky, reservedBounds。

4) SurfaceLighting 拡張（src/render/SurfaceGeometry.ts）
directional emitter（距離無限・遮蔽判定あり）、emitter 判定の拡張（薄いパネル以外の発光箱も areaEmitter フラグで対象）、skyAmbient（normal.y 重み付き空色）、遮蔽判定のオン/オフ（InvertedShadow）。

5) PlayerProxy + PoseHistory（src/player/PlayerProxy.ts）
見えないカプセルメッシュ（layer 分離）と 30 s のリング姿勢履歴。MirrorOffset（0.5 s 遅れの鏡像）、PastWindow（3 s 遅れの監視映像）、InvertedShadow（プレイヤーのブロブ影）が共用。

6) SnapshotService（src/render/SnapshotService.ts）
低解像度 RenderTarget プール（256×144）、表示面自身を layers で除外、Tier ごとの更新周期（high 毎フレーム / mid 2 フレームに 1 回 / low 3 s ごと静止）。PastWindow と他クラスタの GraphReference（簡易サムネイル）が共用。

7) QualityTier 追加フィールド（src/core/types.ts）
fogFarCap（既存 fogFar）, rtUpdateHz, flicker(boolean), decals(boolean), puddles(boolean)。Low: 静止キャプチャ・明滅なし・水たまり箔なし。

8) セーブ/ロード
新たに RoomGraph に永続化する状態は無い。全レイアウト側効果は (definitionId, seed, variant, extraSockets, removedSockets) の決定論的関数で、rebuild しても同一。ランタイム限定: PoseHistory、スナップショット、fog 補間、明滅位相（ロード直後は履歴が空 → 数秒で埋まる）。WaterWall の 'water' ポータルは既存の portals[].type で保存済み。EntryReq.height を追加する場合は任意フィールドで後方互換（SaveData.version は 1 のまま）。

9) 不変条件（frozen / 現在部屋は再構築しない）との整合
効果はすべて generateLayout 内（rebuild 時も同結果）か、ジオメトリを変えない毎フレーム更新のどちらか。現在部屋の材質 variant は構築時に固定し、毎フレームは uniform 値だけ動かす。WaterWall のソケット選択は「配置できなければ壁に戻す（別ソケットを水壁に再選択しない）」で入室後の変化を防ぐ。

10) 未実装 Generator（Pool/Street/MegaStructure）の部屋
R01/R04/L01/L02/L09/L10/L19 は現在 LargeRoom 代替。FogDepth / FakeSky / Wetness / ShallowWater は footprint 依存なので代替部屋にもそのまま効く。LightingPhase allWindowsLit と ShallowWater sea は本来の Generator 実装まで簡易版。

リスク: 1) シェーダプログラム数とコンパイルのカクつき: variant 4 族（untextured / legacy / gradient / roomFog）は初回使用時にコンパイルが走る。スマホでは 100〜300 ms 級の停止になり得るため、Rare 以上の部屋を 2 hop 先で確定した時点で renderer.compile による事前コンパイルを行う。uniform のみの variant は影響なし。
2) 材質オブジェクトの増加: 部屋別 variant は常駐部屋 ≤ 約 6 × MatId ≈ 15 が上限だが、量子化キーと dispose 連動の LRU を怠ると増え続ける。RoomStreamingManager.dispose で参照カウントを減らす。
3) RenderTarget（PastWindow R09）: Low-end スマホでは追加の描画パスが draw call 予算（<120）を圧迫する。Low は静止キャプチャのみ、mid は 2 フレームに 1 回に固定し、実機計測で調整する（仕様 Q4 の通り見え方の実機確認が必要）。
4) MirrorOffset の予約領域: 鏡裏の空間を占有として確保するため D10 の占有率がわずかに下がる。失敗時は鏡なし生成でログに残す。
5) FogDepth 案A の場合、扉口で隣室が現在部屋の霧に染まる。案B は正しいが variant 基盤の範囲が広がる。
6) 未実装 Generator の部屋（R01/R04/L01/L02/L09/L10/L19）は fallback LargeRoom 上で効果だけ成立する。本来の景観（プール回廊・街区・巨大構造）は Generator 実装後。
7) 音声アセットが無いため、LightingPhase のハム位相ずれ、Wetness の足音、ShallowWater の水音、WaterWall の水圧低音は表現できない（AudioEngine 実装後に AudioPreset 側で対応）。
8) WaterWall は接続クラスタとの境界が多い（施錠時の壁戻し、EntryReq.height、Adapter 幅、地図グリフ）。先に接続側の 'water' 契約を固めないと入室後に開口が変わる恐れがある。
9) 現在部屋は再構築しない不変条件のため、Modifier のレイアウト効果は必ず generateLayout 内で完結させる。RoomEffect（毎フレーム）はジオメトリを変更しないこと（uniform・位置・可視性のみ）。

#### LightingPhase（implementable / 工数 M） — U01, R02, E04, L10, M14

- 仕様: 5 モード。U01 seedPhase: 区画ごとに緑/白/黄の色温度相がシード依存で変わる廊下。R02 unpowered: 一般照明は全消灯で筐体（emissiveProps）だけ光る。E04 daylight: 地下の昼光（FakeSky 併用、日照方向と出口が連動）。L10 allWindowsLit: 夜の住宅街で全戸の窓が点灯。M14 singleLight: 黒い霧の歩廊に蛍光灯が一本だけ。
- 方針: レイアウト時（GenParams.lightingPlan を pre-hook で渡す）。seedPhase: CorridorGenerator の lightGrid をセグメント単位で呼び、セグメント i の色相を rng.fork('LightingPhase') で green/white/yellow から選択 → 新 MatId lightGreen/lightYellow と LightSpec.color。bakedLight は SurfaceLighting が MatId 色を拾うため自動追従。明滅は部屋専用 variant（emissive の時間 uniform + セグメント位相属性）を RoomEffect が毎フレーム更新（Low Tier は静的）。unpowered: lightGrid を offChance=1 で呼び L.lights を空にし、GridGenerator RetailGrid の棚 fill を 'screenGlow'（青白 emissive）へ差替え、SurfaceLighting の emitter 判定を areaEmitter フラグで拡張、筐体 4〜6 台に LightSpec（青、distance 5）、palette.ambient を 0x202428 へ。daylight: FakeSky で天井を空にした上で palette.lightColor 0xfff4dc / ambient 0xb8c4d8、天井パネル灯は全て lightOff、中央上 1 灯のみ。singleLight: CorridorGenerator Bridge 分岐（既に 1 灯）に可視の器具箱（1.2×0.3 の lightPanel + 吊り金物）を中央に追加、他のパネル/lights 無し、palette.ambient 0x000000。allWindowsLit: StreetGenerator 未実装のため「ファサード窓ボックスを lightWarm にする」契約だけ定義し、fallback 時は壁面に等間隔の暖色発光窓帯を貼る簡易版。
- 依存: applyLayoutModifiers フック, MaterialLibrary.variant, RoomEffect 更新ループ, FakeSky（E04 は FakeSky → LightingPhase の順で適用）
- 前提: 明滅は seedPhase のみ（周期 0.8〜2.4 s、振幅 ±15%）。Low Tier は静的
- 前提: unpowered の筐体発光色は青白固定、筐体位置は棚 fill 位置を流用
- 前提: allWindowsLit は StreetGenerator 実装まで簡易版（壁面の発光窓帯）
- 前提: 照明ハムの位相ずれ等の音表現は音声アセットが無いため対象外

#### Wetness（implementable / 工数 S） — U07, U08, U13, L09

- 仕様: 床が濡れて反射する（wetness 0.4〜0.8）。U07 は雨域（ParticleDetail rain）と連動、U08 は摩擦/足音が変化（他クラスタ）、U13 更衣室、L09 温浴施設。
- 方針: ビルド時。RoomLayout.render.wetness=w を RoomBuilder が読み、床系 MatId（floor*）を materials.variant(mat, {roughnessScale: 1-0.75w, colorScale: 1-0.25w, envMapIntensity: .24+.6w, bumpMap: water テクスチャ, bumpScale: .003w}) で取得（uniform 値の差のみ → 新規プログラム無し、w は 0.1 刻みに量子化）。レイアウト時に水たまり: 床上 0.004 m の非ソリッド 'water' 薄箔を rng で 面積/25 個（上限 40）配置、U07 は zones の雨域 AABB 内に限定。壁下端 0〜0.25 m を 'wallDark' 帯で濡れ跡。Low Tier は水たまり箔を省き roughness 変更のみ。
- 依存: MaterialLibrary.variant, ParticleDetail(rain) の zones 出力（環境クラスタ）, SurfaceFriction（物理クラスタ、U08）
- 前提: 反射は共有 RoomEnvironment PMREM のまま（実反射は使わない）
- 前提: 水たまり密度は面積/25、上限 40 個
- 前提: 雨域が無い部屋（U08/U13/L09）は床全体を対象

#### ShallowWater（implementable / 工数 M） — R01, R14, L02

- 仕様: R01/R14: 水深 0.25/0.3 m の浅水で移動が 0.7 倍に減速。L02: depth 2.0 の sea モード（ボート移動 VehicleRide と併用）。
- 方針: レイアウト時: footprint 全矩形に y=0..depth の非ソリッド 'waterShallow' 箔（透過 .6、既存 water シェーダの UV 流れを流用）、壁に depth+0.1 までの 'wallDark' 濡れ帯、全扉開口に高さ min(depth+.05, .3) の 'trim' 敷居（ソリッド。段差 0.35 で自動で越えられ、隣室へ水面が突き抜ける見え方を防ぐ）、L.zones.push({kind:'water', aabb, speed: slow})。物理: Game.step で現在部屋の zones を PlayerController に渡し、feet が内側なら水平速度×slow（物理クラスタの SurfaceFriction / ExternalForce と同じ zone 機構を共用）。ビルド: 矩形ごとの水面箔を 1 mesh に結合、bakedLight には水面反射を焼かない。R01 は PoolGenerator 未実装のため fallback LargeRoom 上でも成立（footprint 依存）。L02 sea（深さ 2 m は歩行不能）は MegaStructureGenerator + VehicleRide が前提のため defer。
- 依存: zones 速度フック（物理クラスタと共通）, L02: VehicleRide / MegaStructureGenerator / PoolGenerator（未実装）
- 前提: 水中は速度のみ低下し、ジャンプは可
- 前提: 床材は変更せず水面箔を重ねる
- 前提: L02 sea モードは MegaStructure / VehicleRide 実装後に対応（本項目では対象外）

#### ColorMissing（implementable / 工数 S） — E20

- 仕様: E20: 赤チャンネルが欠損したフロア。特定色チャンネルを材質変換で除外。実装メモ: Low Tier はポスト処理を使わず材質色変換で代替。
- 方針: 全 Tier を材質側で実装（EffectComposer は未導入で、docs の V07 撮像表現と競合するため採用しない）。MaterialLibrary の共通 onBeforeCompile に uniform vec3 colorMask を追加し、`#include <colorspace_fragment>` の直後で gl_FragColor.rgb *= colorMask（ACES トーンマップ後に掛けて完全に 0 にする）。E20 の部屋は variant(mat, {colorMask:[0,1,1]}) を全 MatId・扉パネル・枠・ラベル材質に適用（uniform のみ → 新プログラム無し、材質オブジェクト ≈15）。LightSpec.color の R も 0 にして隣室へ漏れる光を整合。隣室は通常色のままなので扉口で赤が戻る境界が「部屋の性質」として読める。
- 依存: MaterialLibrary.variant
- 前提: 欠損は部屋の材質の性質で、隣室・HUD・ミニマップは影響なし
- 前提: channel は red 固定（green/blue も同 API で対応可能）
- 前提: fog 色は補間対象外（黒〜灰色なので影響が小さい）

#### FakeSky（implementable / 工数 M） — U20, R04, E04

- 仕様: 天井/開口を発光スカイテクスチャに置換し光源方向を連動。U20 overcastNoon（屋内モーテル中庭の偽空天井）、R04 dusk（屋内住宅街）、E04 noonSun（地下の昼光室。日照方向と出口位置が連動）。
- 方針: レイアウト時: palette.ceiling → 'skyOvercast'|'skyDusk'|'skyNoon'（新 MatId、emission 1.2〜2.0、map は起動時に生成する 256² CanvasTexture の空グラデーション + 雲ノイズ、roughness 1、envMap なし）。天井パネル灯を削除（U20/R04 は壁灯 lightWarm を残す）。太陽方位は rng で選び、E04 では進行用出口ソケットの方向へ固定（高度 55°）。SurfaceLighting 拡張: skyAmbient（normal.y 重み付きの空色を ambient に加算）と directional emitter（遮蔽判定あり、sky MatId の天井箔は blockers から除外）で日射と静的な影を焼き込む。ランタイム動的光は中央上 1 灯のみ（隣室に漏れる DirectionalLight は使わない）。AtriumGenerator の中二階帯・柱はそのまま（吹抜が空に開いて見える）。全 Tier 同一（emissive 1 draw）。
- 依存: SurfaceLighting 拡張（directional emitter / skyAmbient）, LightingPhase daylight（E04）
- 前提: 空は天井高（5.5〜9 m）の発光面で表現し、遠景スカイボックスにはしない（偽空天井の意図）
- 前提: 雲は静止。Mid 以上で UV を毎秒 0.002 流す程度
- 前提: lightColor 未指定時は skyPreset から派生（overcastNoon 0xdfe6ee / dusk 0xf0a870 / noonSun 0xfff4dc）

#### FogDepth（needsDecision / 工数 M） — U13, R03, R05, R06, L01, L19, M14

- 仕様: Scene fog を部屋ごとに上書き（視程・色化・暗闇）。U13 塩素色 8/40、R03 暖色 15/60、R05 夜色 5/40（床下は霧）、R06 青 6/35、L01 30/160、L19 白 10/80、M14 黒 2/18。
- 方針: 現状 Game.scene.fog は 1 つ（0x262a28, 12, tier.fogFar）で palette.fog は未使用。案A: Game.enterRoom → RoomEffects.onEnter で目標 fog（Modifier があればその値、無ければ palette.fog + 既定 near/far）へ 0.8 s で補間し、scene.background も同色へ。far は min(far, tier.fogFar) でクランプ（Low 40 なので L01 の 160 は無効化。L01 は StreetGenerator 未実装）。案B: 部屋別 fog を材質側で持つ（variant で material.fog=false にし onBeforeCompile に roomFog uniform を注入、1 プログラム族）。B なら扉を開けた瞬間に向こうの部屋が固有の霧で見える（D5「開けた瞬間に次の部屋が見える」と整合、M14 の黒い虚空や R06 の青が扉口で見える）。Adapter（前室）は paletteFrom の部屋の fog を継承。いずれも Bridge（R05/M14）の voidBelow は霧色の 'void' 箔で床下を塞ぐ。
- 依存: Game.enterRoom の onEnter フック, 案B の場合 MaterialLibrary.variant（roomFog 族）
- 前提: fog 色は sRGB 文字列を Color.setStyle で読み linear へ変換
- 前提: near の最小値は 1.5 m（M14 の near 2 はそのまま）
- 前提: Modifier の無い部屋は palette.fog（青系プリセット等）+ 既定 12/tier.fogFar を使う
- 質問: 部屋ごとの霧を、入室時に全体の fog を補間する方式（A）と、部屋の材質に部屋固有の fog を持たせる方式（B）のどちらにするか 選択肢: A: 入室時に scene.fog を 0.8 s で補間（実装 S。扉を開けた時点では隣室に現在部屋の霧がかかる） / B: 部屋別 fog を材質 variant で持つ（実装 M。扉口から向こうの部屋が固有の霧色で見える。プログラム 1 族追加、材質オブジェクト増） 推奨: B（先に A を実装しても B へ差し替え可能なので、Phase 順は A → B でよい）

#### MaterialGradient（implementable / 工数 M） — R15

- 仕様: R15 絨毯化する設備通路: 進行方向（axis forward）に沿って concrete → carpet へ 2 材質をブレンド。照明も白色→暖色、環境音も機械音→空調音へ遷移。接続ルール: 進行につれホテル系テンプレへの接続確率が増える（接続クラスタ）。
- 方針: CorridorGenerator が L.path = セグメント列（rect + heading）を公開。ビルド時に頂点属性 gradT（入口からの中心線距離 / 全長、0..1）を結合ジオメトリ全体に付与（bakedLight と同じ経路）。材質: variant 族 'gradient'（mapA/mapB, colorA/B, roughA/B, bumpA/B を vGradT で mix。onBeforeCompile で map_fragment / roughnessmap_fragment / bumpmap を差替え、1 プログラム族）。役割別対応表: 床 floorConcrete→floorCarpetRed、壁 wallConcrete→wallBeige、天井 ceilingDark→ceilingWhite。天井の配管 'metal' は t>0.6 の区間で間引き（レイアウト時）。照明: lightGrid をセグメント単位で呼び、t で LightSpec.color を lerp、パネル MatId は閾値 0.5 で lightPanel→lightWarm（bakedLight も追従）。他 Generator では forward = 入口(z0) から反対側への z の正規化。
- 依存: MaterialLibrary.variant（gradient 族）+ 事前コンパイル, 接続クラスタ: 'end' ソケットの接続先抽選でホテル系テンプレを優先する PickOptions（任意）
- 前提: from/to は「テクスチャ族」名で、MatId 対応表を modifiers/MaterialGradient.ts に置く
- 前提: ブレンドは smoothstep(0.15, 0.85) の線形
- 前提: axis が forward 以外（未使用）は同じ path 機構で x/z 軸へ一般化

#### InvertedShadow（implementable / 工数 M） — E06

- 仕様: E06 逆影広間: 強い単一光の対称大空間で、影が光源側へ落ちる（ブロブ影デカールの向きを反転、動的影は使わない）。接続ルール: 影の方向が正しい出口の逆を指す。
- 方針: 現状ブロブ影は無い（bakedLight の接触陰影のみ）。レイアウト時: LargeRoom の家具/柱ボックスごとに床上 0.003 m の 'shadowDecal'（新 MatId: 黒、opacity .5、transparent、depthWrite false、polygonOffset）非ソリッド箔を、光源へ向かう方向へ box 高さ×0.6 だけずらして置く（通常と逆）。光源は中央上 1 灯（PointLight 高強度、palette.lightIntensity 1.6）を「進行用出口の反対側」寄りに置く → 逆影がすべて出口の逆を指す。SurfaceLighting は正しい向きの焼き込み影（occluded .06）を作ってしまうため E06 では遮蔽判定を無効化（影はデカールだけ）。プレイヤーの影: PlayerProxy 直下のブロブ 1 枚を RoomEffect が毎フレーム光源側へずらす。デカールは 1 mesh に結合（+1 draw）。Low Tier もそのまま（十分軽い）。
- 依存: PlayerProxy, RoomEffect 更新ループ
- 前提: mode 未指定 → 'towardLight'（唯一のモード）
- 前提: デカールは柱・家具・パーティションが対象、壁・扉には付けない
- 前提: 焼き込み影を無効化し、部屋全体の陰影はデカールと単一 PointLight で作る

#### RenderStyle（needsDecision / 工数 M） — M13, M15, M17

- 仕様: 部屋単位で Material を差替え。M13 untextured（未描画空間: 白無地、視覚ランドマークを排除し出口だけ配置）、M15 backside（壁の裏側: 世界の裏面、片面 Material、表側部屋の壁裏座標と対応）、M17 legacy（旧バージョン階: フラット低ポリ、低 LOD / 旧材質セット）。
- 方針: レイアウト時 + ビルド時。untextured: レイアウトでシェル以外の内装ソリッドと天井パネル灯を全削除、palette.ambient 0xffffff、L.lights 無し。ビルドで全 MatId → 単一 'untextured' 材質（map なし、白、roughness 1。bakedLight は残し面の向きだけ分かる）、扉パネルは通常材質のまま（出口＝唯一のランドマーク）。legacy: ビルドで detailedBoxes / 面取り / テッセレーションをスキップ、variant 族 'legacy'（32 px に縮小した NearestFilter テクスチャ、bump/roughnessMap/envMap 無し、bakedLight を 4 段階に量子化、拡散のみ）、ラベルも 128 px に縮小。backside: 質問参照。推奨案では GridGenerator ServiceMaze の壁を 'wallConcrete' 素地 + 天井配管・スタッドの追加、家具・棚は side=BackSide の variant で中空に見せ、ラベル/サインを左右反転、bakedLight を法線反転で焼いて明暗を入れ替える。legacy / untextured は通常より軽く Tier 差は不要。
- 依存: MaterialLibrary.variant（untextured / legacy 族）+ 事前コンパイル
- 前提: untextured でも扉パネルは通常描画（出口を見せる仕様）
- 前提: legacy はテクスチャの縮小版を起動時に 1 度生成して共有
- 前提: RenderStyle は他の描画 Modifier と同一部屋で併用しない（該当部屋なし）
- 質問: M15 backside（壁の裏側）の見せ方をどう解釈するか 選択肢: a: 構造裏の素地（コンクリ・配管・スタッド）+ 家具や棚は BackSide で中空に見え、サインが左右反転する（世界の裏面が「作りかけの裏方」として見える） / b: すべての材質を BackSide にして近い面が透けて奥の面だけ描かれる（グリッチ寄り。壁厚 0.15 m のため単体では違いが弱く、素地化と併用が前提） / c: 地図クラスタと連動し、直前に訪れた表側部屋の壁裏に対応した配管・配線を配置（接続ルールの「表側部屋の壁裏座標と対応」を字義通り実装。工数大） 推奨: a（b の要素は家具・棚にだけ限定して併用）

#### WaterWall（implementable / 工数 L） — E09

- 仕様: E09 垂直水面オフィス: 高さ 3.0 m の垂直水面が壁にあり、水壁の通過が Portal(water)。実装メモ: 垂直水面は Portal(water) として扱う。
- 方針: レイアウト時（OfficeGrid 生成後の Modifier pass）: 出口ソケットのうち 1 本（進行用を優先。exits≥2 のとき）を type 'water'、width WIDE_W(2.2)、height min(3.0, h-0.3) に変更。ビルド時: 開口面（壁厚中央）に 'waterWall' 材質（既存 water の縦流れ variant、DoubleSide、opacity .7、UV を y 方向へ流す）の 1 枚板、床に濡れ帯、開口上端に暗い縁。通過演出: RoomEffect がカメラが板の AABB（厚 0.3 m）に入った瞬間、既存の #fade 要素を青で 0.25 s 点灯（DOM のみ）。接続側の現状: 'water' ソケットは door 以外の一般経路（rollRoomNode → tryPlace → lockOrVestibule）で処理され、portalOpen は非 door=常に開なので隣室は常時可視。追加が必要: (1) 配置失敗時は 100% 壁へ戻す（removedSockets。別ソケットを水壁に再選択しない）、(2) 隣室 makeEntry / Adapter が開口高さを受け取る EntryReq.height、(3) Minimap / Map3D の 'water' グリフ。
- 依存: 接続クラスタ: PortalType 'water' の施錠時の壁戻し、EntryReq.height、Adapter 幅 2.2 固定, RoomEffect 更新ループ
- 前提: 水壁は 1 枚。屈折・水中音は無し、コライダ無しで歩いて抜ける
- 前提: 水壁の先は通常抽選（特定テンプレ指定なし）
- 前提: 幅は Adapter 前室と同じ 2.2 m 固定（Adapter 連鎖で進行を保証できる）

#### MirrorOffset（implementable / 工数 L） — U09

- 仕様: U09 鏡のずれる洗面所: 鏡像が 0.3 m ずれ、0.5 s 遅れる（反射不一致）。鏡内だけに存在する疑似扉をヒントとして表示。RenderTarget は使わず鏡像ジオメトリ + ずらしたプレイヤー代理で表現。
- 方針: レイアウト時: ソケットの無い長辺 1 面を鏡壁にし L.mirrors=[{axis, coord, span, y0:0.9, y1:2.1}]。壁に鏡開口（高さ 0.9〜2.1 の窓型 Opening。footprint.wallOnEdge に下端 y 付き Opening を追加）を切り、透明 'glass' 板 + 不可視ソリッド箱（コライダ）を置く。L.bounds を鏡面の向こう側へ部屋奥行き分だけ拡張（reservedBounds）し、WorldManager.fits / growToFill / 直結が鏡裏空間に部屋を置かないようにする（クリッピング・ステンシル不要、隣室に鏡像が漏れない）。ビルド時: 部屋の結合ジオメトリを鏡面で反転コピー（頂点座標反転 + 三角形巻き順反転 + 法線反転 → 共有材質のまま使える）し offset 0.3 m ずらして配置。鏡像側にだけ追加の扉パネルを置く（疑似扉）。PlayerProxy を鏡像化し、PoseHistory の 0.5 s 前の姿勢に置く（RoomEffect 毎フレーム）。Low Tier は遅延なし・ずれのみ。
- 依存: PlayerProxy + PoseHistory, 配置クラスタ: reservedBounds を占有のみとして扱い、壁・直結対象にしない
- 前提: 鏡は 1 面。Restroom は small 族（≤10×9 m）なので三角形 2 倍でも数千程度
- 前提: reservedBounds で配置に失敗するバリアントは鏡なしで生成し world.log に記録
- 前提: 疑似扉は純粋に視覚ヒント（実際の接続は作らない）

#### PastWindow（needsDecision / 工数 L） — R09, E12

- 仕様: R09 監視映画館: mode screen、delaySec 3。スクリーンに数秒遅延の映像、スクリーン映像が次部屋のヒント。実装メモ: 低解像度 RenderTarget、Low Tier は静止画。E12 過去窓回廊: mode window、historyDepthSec 30。窓の RenderTexture に過去ノードを簡易表示。Low Tier は静止キャプチャ。
- 方針: SnapshotService（RT 256×144、layers で表示面自身を除外、Tier で更新周期: high 毎フレーム / mid 2 フレームに 1 回 / low 3 s ごとの静止）。R09: Theater の 'wallWhite' スクリーン箔を 'screen' 材質（無照明・RT テクスチャ）へ。推奨案: 劇場後方上部の固定監視カメラから、PlayerProxy を PoseHistory の 3 s 前の姿勢に置いて描画 → 自分が 3 秒遅れて入ってくる映像。カメラは進行用出口を画面内に収める構図にして「次部屋ヒント」を兼ねる。Low Tier は 3 s ごとの静止キャプチャ（自然に 3 s 遅れる）。E12: 10 s ごとに現在視点を静止キャプチャ（リング 3 枚 = 30 s）し、廊下の窓（wallBand glass の裏に 'screen' 箔）に古い順で表示（全 Tier 同一で軽い）。セーブ後の再開はリングが空なので黒から順次埋まる。
- 依存: PlayerProxy + PoseHistory, SnapshotService（演出クラスタの GraphReference と共用）, QualityTier.rtUpdateHz
- 前提: E12 の「過去ノード」は 10/20/30 s 前の視点スナップショットで表現（過去の部屋を生きたまま描画しない。2 hop 先は dispose 済みのため不可能）
- 前提: スナップショット履歴は保存しない（ランタイム限定）
- 前提: R09 の RT 描画にはスクリーン自身を含めない（フィードバック防止）
- 質問: R09 監視映画館のスクリーンに何を映すか 選択肢: a: この劇場内の固定監視カメラ映像（PlayerProxy を 3 s 前の位置に置く）。出口を画面内に収めてヒントにする / b: 進行方向の隣室（1 hop 先で常駐）を固定カメラで映す遅延映像（静的な部屋なので遅延は体感できない） / c: プレイヤー自身の 3 s 前の視点（POV） 推奨: a

### プロップ・植生・演出系 Modifier（InstanceOvergrowth / PropOrientation / PropRepetition / ParticleDetail / EraPreset / ZoneThemeShuffle / GraphReference / SelfMap / AmbientCarryover）

共通基盤: 現行コードは「WorldManager.layoutFor → generateLayout（純データ RoomLayout、seed 決定論、layouts にキャッシュ）→ RoomBuilder.build（材質ごとにジオメトリ結合、SurfaceLighting が palette.ambient と lights の色を頂点属性 bakedLight に焼く）→ RoomStreamingManager（現在+1 hop）」で、Modifier は未適用（README 既知の制約）。frozen/dirty の規則により、現在部屋は再構築せず、非現在部屋だけ layouts.delete + rebuild される。この構造に合わせ、次の共通基盤を先に入れる（本クラスタ 9 件のうち 8 件がこれに乗る）。

1. Modifier レジストリ `src/modifiers/index.ts`（3 フェーズ）
   - `layout(L, ctx)`: WorldManager.layoutFor で generateLayout 直後・キャッシュ前に、def.modifiers[] の順で呼ぶ後処理パス。ctx = { def, params, node, graph(読み取り専用), rng = new Rng(node.seed).fork(`mod:${id}`) }。ジオメトリ・材質・出口配置に関わるものは全てここ（決定論が保たれ、frozen 規則もそのまま効く）。
   - `build(built, L, ctx)`: RoomBuilder.build の末尾（または RoomStreamingManager.ensure 直後）で呼ぶ。CanvasTexture・Points・InstancedMesh など Three.js オブジェクトの追加。dispose は built.group 配下に置き userData.disposable に登録すれば既存 dispose が拾う。
   - `update(dt, ctx)`: Game.step で「可視（group.visible）な built」に対してのみ呼ぶ。粒子の時間 uniform、SelfMap の再描画など。レイアウトを変えない演出だけを許す。
   - 生成器内部で参照が必要なもの（PropOrientation の教室机）は `modParams(def, id)` ヘルパで GenParams.def.modifiers から直接読む。

2. RoomLayout の拡張（layout.ts、純データのまま）
   - `furnitureFrom: number`（各生成器が buildShell 後の shellCount を 1 行で記録）→ 後処理パスが「家具だけ捨てて差し替え」できる（PropRepetition / ZoneThemeShuffle で必須）。
   - `instances: InstanceSpec[]` = { mat: MatId, shape: 'box'|'sphere'|'cross', size: Vec3, transforms: {pos, rotY, scale}[], solid: boolean }。RoomBuilder が 1 spec = 1 THREE.InstancedMesh に変換。transforms は生成時に決定論的にシャッフルしておき、Tier に応じて `mesh.count` を切り詰める（再構築不要・Tier 切替も即時）。solid=true のものはコライダ AABB を全 Tier で同一に出す（当たり判定を Tier で変えない）。
   - `particles?: ParticleSpec` = { type, count, emitters: AABB[] , area }（描画は RoomBuilder）。
   - `decals: DecalSpec[]` = { pos, dir, w, h, kind: 'photo'|'exhibitPlate'|'selfMap', payload }。RoomBuilder が buildLabel と同じ CanvasTexture 方式で描く。
   - `zones?: Zone[]` = { rect, palette, theme }（将来 AudioZones / audioPreset 切替の受け皿にもなる）。

3. ゾーン分割パス `src/modifiers/zones.ts`（EraPreset と ZoneThemeShuffle が共用）
   - 「shell の床/壁/天井ボックスをゾーン境界で分割して mat を差し替え、LightSpec.color / lightPanel の mat をゾーンの palette に置き換える」汎用関数。SurfaceLighting は emitter 色から焼くので、ゾーンごとの光色は自動で bakedLight に反映される（ambient は単一のまま＝許容）。

4. QualityTier の拡張（types.ts）: `instanceScale`（low .45 / mid .7 / high 1.0）、`particleCap`（150 / 400 / 1000）、`decalRes`（256 / 512 / 1024）。Game.setTier で built の InstancedMesh.count と Points.drawRange を更新（rebuild しない）。

5. RoomGraph に `visitLog: string[]`（訪問順 roomId、上限 64）を追加し toJSON/fromJSON に含める（無ければ [] で復元。SaveData version は据え置きで後方互換）。AmbientCarryover の「直前 Rare 以上」を決めるのに使う。グラフ依存で決めた選択結果（M18 の sourceRoomId、L16/M16 の展示定義）は `node.state.localFlags` に保存し、layoutFor は保存済みなら再計算しない（dirty 再構築・ロード後も同じ結果）。

6. 部屋単位の環境適用フック（enterRoom 時に scene.fog / hemi / 背景色を現在部屋の palette と環境系 Modifier から設定する）。今は Game に単一 fog が固定されているため、FogDepth / LightingPhase 担当クラスタと共通で 1 箇所に置く。AmbientCarryover はこのフックに「コピー元の palette を返す」だけで乗る。

不変条件との整合: ジオメトリ系は全て layout フェーズ（seed 決定論・キャッシュ）なので「入室後に部屋が変わらない」はそのまま成立。build/update フェーズはテクスチャ更新と時間 uniform だけで開口・家具・コライダを変えない。dirty による非現在部屋の rebuild でも、グラフ依存の選択は localFlags から再現される。

リスク: 1. 三角形・インスタンス予算: 現行は材質ごとに全箱を結合して 1 メッシュにしているため、PropRepetition の sameProduct（数千個）や InstanceOvergrowth の麦（約 7,700 株）を箱で出すと結合ジオメトリが膨らみ、low Tier の可視 250k 三角形を超える。必ず instances（InstancedMesh）に出し、count を Tier で切る。solid なものは箱で出すので、当たり判定は全 Tier で一致する。
2. 頂点ベイクとの整合: SurfaceLighting は palette.ambient と lights 色を頂点に焼くため、EraPreset / ZoneThemeShuffle / AmbientCarryover の光色差はレイアウト時に決めなければ反映されない（build 後の差し替え不可）。全て layout フェーズに寄せている理由はこれ。instances と Points は bakedLight を持たないので、InstancedMesh 用に『ゾーンの ambient を uniform で渡す』簡易版シェーダが必要（MaterialLibrary の onBeforeCompile を拡張）。
3. 決定論とグラフ依存: GraphReference（past）と AmbientCarryover はグラフ状態に依存するため、初回 layoutFor で localFlags に保存しないと dirty 再構築やロードで展示内容が変わる。ensureNeighbors の prune（layouts.delete）でも layoutFor が再走するので、保存済みを優先する実装が必須。
4. E14 の写真は portals.targetRoomId が確定している前提。addAdjacencyLinks / tryLinkExisting で E14 が未凍結のうちに extraSockets が増えると写真枚数が変わるが、いずれも入室前なので許容。入室後は frozen で固定される。
5. 環境適用フック（fog / hemi）が無いと AmbientCarryover の fog コピーと ParticleDetail の mist の見え方が半減する。FogDepth / LightingPhase クラスタと同じ 1 箇所（enterRoom）に置くことを先に決めておく。
6. 未実装 Generator（MegaStructure / Street）に依存する 8 部屋は fallback 上での暫定表示になる。パスは流用可能だが、チャンク分割ストリーミング（chunked）が入るまで 1 部屋あたりの instances / particles は最大 28×34 m 相当で見積もる。
7. セーブ互換: RoomGraph.visitLog と node.state.localFlags の追加はどちらも省略可能フィールドとして読むので version 1 のまま維持できるが、localFlags に入れる値は JSON 化可能な型（string[] / string）に限定する。

#### InstanceOvergrowth（implementable / 工数 M） — R07, L03, L14

- 仕様: 植生を InstancedMesh で密度 density（R07 0.7・L14 0.9 は blocksPath=true、L03 は propId=wheat 密度 1.0）だけ敷く。R07 は『植生密度の低い方向へ出口』、L14 は『植生侵食』、L03 は倉庫内の麦畑（農道交差）。OrganicZone は『植栽密度を Tier で制御』が仕様。
- 方針: layout フェーズ。(1) 密度場: 部屋の内側矩形を 0.5 m セルに区切り、base=density × (出口ソケット・入口からの距離に応じた減衰 0.15〜1.0) × rng ノイズ。これで『出口方向ほど疎』が自動で成立し、clearDoorways の 1.8 m 空けと整合する。(2) blocksPath=true: 既存 patternPartitions(mat 'plant') を使って solid な生垣（高さ 1.6〜2.2 m、1.4 m の抜け道付き）を 2〜3 本作り、その上に葉のインスタンスを重ねる（衝突は箱、見た目は instances）。false（L03）は非 solid。(3) instances: R07/L14 は shape 'sphere'（8×6 分割）を scale 0.4〜1.2 でセルごとに 0〜2 個、L03 は 'cross'（交差 2 枚板 0.05×1.0 m）を 0.35 m 間隔 → 1 InstancedMesh。農道は入口〜各出口を結ぶ幅 2 m の直線レーンをセル除外で作る。(4) MaterialLibrary の 'plant' に water と同じ time uniform で微小な揺れ（頂点 y に応じた xz オフセット）を追加（high Tier のみ有効化）。RoomBuilder の 'plant' 球体変換はそのまま残し、instances 側で描く。
- 依存: 共通基盤 1（レジストリ layout フェーズ）, 共通基盤 2（RoomLayout.instances と RoomBuilder の InstancedMesh 対応、QualityTier.instanceScale）
- 前提: density は『内側面積 1 m² あたりの株数の上限係数』と解釈し、R07 0.7 で約 0.7 株/m²、L03 の麦は 0.35 m 間隔（約 8 株/m²）を上限とする
- 前提: Tier で mesh.count を instanceScale 倍に切り詰める（low ではおよそ半分）。生垣（solid）の数と位置は Tier に依らず同一
- 前提: L03（MegaStructureGenerator 未実装）と L14 は当面 LargeRoom fallback（最大 28×34 m）上で動かし、MegaStructure 実装後もパスはそのまま流用する
- 前提: 風揺れは high Tier のみ。low/mid は静止

#### PropOrientation（implementable / 工数 S） — U10

- 仕様: U10 壁向き教室: facing='wall'。『入口は通常。机方向が出口候補と逆を指す』。実装欄は『PropSpawner の向き決定を差し替える』。パラメータは facing(wall|oneWay|random)。
- 方針: 生成時（RoomGenerator.furnish の Classroom 分岐）。現行の Classroom は patternRows の連続スラブで向きが表現できないため、`patternDesks(c, facing)` を common.ts に追加: 机 0.6×0.5×0.72 + 椅子 0.4×0.4×0.45（座面）を 1 ユニットとして 1.1×1.4 m グリッドに個別配置し、椅子の位置で向きを出す。facing 決定: 'wall' = ソケット（入口・出口）が 1 つも無い壁のうち最長の辺を向く（無ければ出口ソケット数が最少の辺）、'oneWay' = seed で 1 方向、'random' = 机ごとに 4 方向乱択。黒板（wallGreen の薄板）は向いた壁へ移す。既定の Classroom（U10 以外）は facing='board'（従来通り黒板側）で同じ関数を通し、見た目の一貫性を保つ。
- 依存: 共通基盤 1 の modParams ヘルパのみ（後処理パス不要）
- 前提: 'wall' は『出口候補と逆』を『ソケットの無い壁』と解釈する。全辺にソケットがある場合は出口が最少の辺
- 前提: 机ユニットは箱の組合せで、ArchitecturalDetails の机化（天板+脚）はサイズ条件を満たさないので適用されない（意図通り、小さな箱のまま）
- 前提: 衝突は机のみ solid、椅子は非 solid

#### PropRepetition（implementable / 工数 M） — U11, U15, R03, R20, L13, L17

- 仕様: 同一プロップを大量反復配置（propId, density, scale）。U11 luggage 0.8（楕円+リング＝コンベア）、U15 sameProduct 1.0（全商品同一）、R03 banquetTable 1.0（一定距離ごとに同型出口・距離感錯誤）、R20 storageDoor 1.0（+DuplicateNumber）、L13 serverRack 1.0、L17 apartmentBlock 1.0（+ScaleAnomaly、チャンク分割）。
- 方針: layout フェーズの後処理。`src/modifiers/props.ts` に propId → PropArchetype 表（箱クラスタ、footprint、solid、配置戦略）を持ち、(a) 'grid' 戦略（banquetTable: 1.8 m 丸卓=箱 + 椅子 4、apartmentBlock: 6×3×(h-0.5) の棟 + 窓の lightPanel 帯）は L.boxes を furnitureFrom で切って再配置、格子間隔 = 基準間隔 / density。(b) 'shelfFill' 戦略（sameProduct / serverRack / storageDoor）は GridGenerator の shelves が出した棚箱（mat が shelfMetal/metal/furnitureDark で高さ>1.3）を検出し、その面に同一ユニットを instances で並べる: sameProduct は 0.3×0.3×0.4 の箱を段ごとに隙間無く（InstancedMesh 必須、数千個）、storageDoor は棚を 2.4 m 幅の扉ユニット（doorMetal + 取手 metal）に置換、serverRack は ledBlue の帯を全ラックに揃える。(c) 'ring' 戦略（luggage）は主矩形内側に矩形リングのコンベア（高さ 0.9、幅 1.0、solid）を作り、その上に同一スーツケース 0.7×0.3×0.5 を density に応じた間隔で instances 配置。R03 の『一定距離ごとに同型出口』は placeExits の minGap を卓の格子間隔の整数倍に揃えて出口を等間隔化する（出口数は変えない）。大きなユニット（卓・棟・扉）は solid 箱として L.boxes に、細かい反復（商品・スーツケース）は instances（非 solid）に出して draw call を 1 に抑える。
- 依存: 共通基盤 1・2（furnitureFrom、instances）, GridGenerator / RoomGenerator に furnitureFrom を記録する 1 行ずつの変更
- 前提: scale 省略時は 1.0。density は『基準間隔の逆数』（1.0 で基準間隔、0.8 で 1.25 倍間隔）
- 前提: sameProduct の商品は seed で 1 色（boxCardboard の色替えマテリアルを 1 つ追加）
- 前提: R20 の扉番号は DuplicateNumber（別クラスタ）が decals で貼る。本 Modifier は扉ユニットの反復だけ
- 前提: L17 は StreetGenerator 未実装のため LargeRoom fallback 上に棟を格子配置する暫定表示。ScaleAnomaly（別クラスタ）とは独立に動く
- 前提: low Tier は instances の count を instanceScale 倍に間引く。棚扉・卓・棟（solid）は間引かない

#### ParticleDetail（implementable / 工数 M） — U07, U12, R19, L09, L19

- 仕様: 少数のスプライトパーティクル。type(steam|mist|rain|snow), density, respawn。U07 rain 0.5（局所降雨、Wetness と連動）、U12 steam 0.3（食物だけ温かい）、R19 steam 0.2 respawn（カップ再加熱）、L09 mist 0.5（湿度演出）、L19 snow 0.3（凍結リゾート）。
- 方針: layout フェーズで ParticleSpec（type、count = density × 内側面積 × 係数、emitters）を決め、build フェーズで RoomBuilder が 1 部屋 = 1 THREE.Points を group に追加。位置更新は CPU で行わず、頂点シェーダで `pos = f(seed属性, time uniform)` を計算（MaterialLibrary.clock を共用）→ 毎フレームの CPU コストはゼロ、draw call 1。type 別: rain = 天井の漏水点（内側矩形から 1〜3 か所、各 3×3 m）から落下する縦長スプライト（拡大率 y 6 倍）、床で消える。steam = 発生源（R19: カウンター上の小箱=カップ、U12: 店舗カウンター）から上昇 1.2 m で減衰、少数（20〜60）。mist = 床上 0〜0.6 m を漂う大きな柔らかいスプライト（半径 1.5〜3 m、40〜120 個、透明度 0.08）。snow = 部屋全体から降下+横揺れ。可視部屋のみ描かれる（group.visible に従う）ため常駐コストは現在+1 hop 分のみ。rain の床の濡れは Wetness（別クラスタ）に任せ、本 Modifier は emitter の矩形を L.zones/localFlags に出して Wetness が読めるようにする。
- 依存: 共通基盤 1（build/update フェーズ）, 共通基盤 4（QualityTier.particleCap）, Wetness（別クラスタ）との連携は emitter 矩形の受け渡しのみ。無くても動く
- 前提: respawn は『発生源から途切れず出続ける』の意味とし、全 type ともループ再生（respawn=false でも消えない）。特別扱いしない
- 前提: count は Tier の particleCap で上限（low 150 / mid 400 / high 1000）。Points.setDrawRange で切るので Tier 切替に再構築不要
- 前提: スプライトは CanvasTexture の柔らかい円 1 枚を全 type で共有（雨は uv スケールで縦長化）。音声アセット無しのため雨音等は AudioEngine 実装後
- 前提: L09 / L19 は MegaStructure 未実装のため fallback 部屋で動く

#### EraPreset（needsDecision / 工数 M） — R11, E02

- 仕様: 区画ごとに Material / Props / Lighting プリセットを切替（eras[], segmentLength）。R11 年代混在ホテル: 1970s/1990s/2010s を 8 m ごと、『年代ごとに色温度変化』。E02 年代階段: 1960s/1980s/2000s/2020s を 1 階ごと。
- 方針: layout フェーズでゾーン分割パス（共通基盤 3）を使う。R11: CorridorGenerator の footprint（折れ廊下のセグメント矩形列）を通路方向に segmentLength=8 m で刻み、ゾーン i に eras[i % n] の EraPalette を割り当てて床・壁・天井・扉パネル（palette.door はソケット単位なので Portal の扉はゾーンの door mat で buildDoor）・客室ドア帯（wallBand）・LightSpec.color/lightPanel mat を差し替える。E02: VerticalGenerator の各レベル（床 y = k×3.6）をゾーンとし eras[k]（下が古い）を割り当てる。EraPalette 表（既存 MatId のみで構成）: 1960s floorTile+wallGreen+lightWarm(2700K 寄り) / 1970s floorCarpetRed+wallBeige+lightWarm / 1980s floorCarpetGrey+wallCream+lightPanel / 1990s floorLino+wallWhite+lightPanel / 2000s floorTile+wallWhite+lightPanel(白) / 2010s floorWood+wallDark+lightPanel / 2020s floorConcrete+wallWhite+ledBlue。SurfaceLighting は emitter 色から焼くため、色温度差は bakedLight に自動反映。境目には 5 cm の trim 帯を入れて切替を明示。
- 依存: 共通基盤 1・3（ゾーン分割パス）, RoomBuilder.buildDoor がゾーンの door mat を受け取れるようにする小変更
- 前提: R11 の『扉ごとに年代テーマ別部屋へ』は隣接ノードの定義を変える意味ではなく、廊下内の区画テーマとして実装する（隣室は通常抽選）
- 前提: EraPalette は現在の 12 テクスチャ内で色替えのみ。年代固有プロップ（ブラウン管 TV 等）はアセット導入後
- 前提: ゾーン ambient は単一（既存 SurfaceLighting のまま）。光色の差で年代感を出す
- 質問: E02 年代階段の VerticalCore は現在 2 レベル固定です。eras が 4 つある E02 の扱いは？ 選択肢: A: 2 レベルのまま。seed で eras から 2 つ（下が古い）を選ぶ。既存の配置ロジックを変えない / B: E02 だけ 3〜4 レベルの VerticalCore バリアントを追加（高さ 10.8〜14.4 m。占有 AABB が縦に伸び、上下階の配置・階段 Adapter・地図の level 判定に影響） 推奨: A

#### ZoneThemeShuffle（needsDecision / 工数 M） — L05, L20

- 仕様: ゾーンごとに Props / Material プリセットをシードで乱択（zoneCount, presetPool）。L05 屋内学園都市: 6 ゾーン、pool=campus（校舎・体育館・プール・通路）。L20 永久万博会場: 8 ゾーン、pool=any（各パビリオンをランダムテーマ化）。どちらも chunked/multiZone、MegaStructure/Street Generator（未実装）。
- 方針: layout フェーズ。主矩形（fallback の LargeRoom では最大 28×34 m）を zoneCount 個に分割（rng で 2〜3 行×列の不均等グリッド、各ゾーン最小 6 m）し、共通基盤 3 のゾーン分割パスで床・壁・天井・光色を差し替え、家具は furnitureFrom 以降を捨ててゾーンごとに RoomGenerator.furnish を『そのゾーンの矩形だけを rects にした FurnishCtx』で呼び直す（Classroom → 机列、LockerRoom → ロッカー、Gallery → 展示壁 等を再利用）。ゾーン境界には高さ 2.2 m の間仕切り（1.4 m の抜け道付き、patternPartitions 相当）を置いて『パビリオン』感を出す。presetPool: campus = [Classroom, LockerRoom, CorridorSchool, Gallery, PlayArea, Restroom]（プールは Wetness/ShallowWater 導入後に追加）、any = presets.ts の BASE 全キー。MegaStructureGenerator / StreetGenerator 実装時は、それらが出すチャンク矩形を zones として渡すだけで同じパスが使える。
- 依存: 共通基盤 1・2・3, RoomGenerator.furnish を外部から矩形指定で呼べるよう export する小変更
- 前提: ゾーン割当は node.seed から決定論的に決まるので保存不要
- 前提: ゾーンの audioPreset は L.zones に文字列で持たせ、AudioEngine 実装後に audioZones と同じ経路で再生
- 前提: ゾーン境界の間仕切りはソケット前 1.8 m を避ける（clearDoorways を最後に再実行）
- 質問: L03 / L05 / L09 / L13 / L14 / L17 / L19 / L20 は MegaStructure / Street Generator が未実装（LargeRoom fallback + TODO サイン）。本クラスタの Modifier をどう扱う？ 選択肢: A: 汎用パス（ゾーン分割・反復・植生・粒子）を今つくり fallback 部屋上で動かす。巨大 Generator 実装後はチャンク矩形を渡すだけで流用。見た目は当面 28×34 m 級の暫定 / B: 該当 8 部屋分は Generator 実装（Phase 4/6）まで Modifier 適用も保留し、U/R/E の 14 部屋分だけ先に入れる 推奨: A

#### GraphReference（implementable / 工数 M） — E14, L16, M16

- 仕様: 既訪または隣接ノードの定義名・簡易サムネイル・プロップを展示（mode past|adjacent, count）。E14 予測写真室: adjacent 4、『入室時に確定した隣接ノード定義を写真として表示（予測ではない）』。L16 空間博物館: past 8、『展示室ごとに過去テンプレの縮小版』。M16 没部屋博物館: past 12、『通常生成から除外されたテンプレ候補を展示』。
- 方針: layout フェーズで展示対象を決めて decals（写真パネル）と展示台（箱）を L に出し、build フェーズで CanvasTexture を描く。E14: node.portals の targetRoomId（prepareRoom の順序上、E14 が 1 hop で構築される時点で ensureNeighbors(E14) が済み確定している）ごとに 1.2×0.9 m の写真を壁面に等間隔配置。写真 = レア度色の枠 + 定義名 + カテゴリ + 対象 layoutFor(target).footprint のシルエット + palette 色見本。locked / 行き先無しの扉は黒い写真。L16: 展示定義を『訪問順の新しいものから count 件の相異なる definitionId（アダプタ除く）』とし localFlags.exhibits に保存。各展示 = 台座（1.6×1.6×0.9 solid）+ その定義の縮小版（対象ノードの layoutFor(node).boxes を 1/20 に縮めて台座上に置く。床・壁・家具の箱そのまま、~200 箱/体）+ 名札 decal。M16: 展示定義を『ROOMS のうち discoveredIds に無い定義から seed で count 件』とし localFlags に保存。縮小版は generateLayout(def, 仮 seed, variant 0) を純関数として呼んで作る（ノードは作らない）。
- 依存: 共通基盤 1・5（localFlags 保存規約）, RoomLayout.decals と RoomBuilder の CanvasTexture 描画（buildLabel を一般化）
- 前提: M16 は params.mode='past' だが接続ルール『通常生成から除外されたテンプレ候補』を優先し、未発見定義を展示する。名札は定義名のみで ID とレア度は出さない（発見の楽しみを残す）
- 前提: 展示対象は初回 layoutFor 時に localFlags に保存し、dirty 再構築・ロード後も同じ。既訪数が count 未満なら足りない分は空の台座
- 前提: 縮小版は low Tier では shell（床・外壁）のみに間引き、家具箱を省く。写真 decal は Tier の decalRes で解像度を落とす
- 前提: E14 の写真は count=4 に対し扉数が少なければその数だけ、多ければ isReturn 以外の先頭 4 枚

#### SelfMap（implementable / 工数 S） — M01

- 仕様: M01 地図室: DisplayedMapGraph を CanvasTexture に描画して壁面に貼る（scale）。『壁マップが現在グラフを可視化。隠し接続も示唆』。
- 方針: layout フェーズで入口の対面壁に kind='selfMap' の decal（幅 3.0 m × 高 1.7 m、scale で pxPerCell を決める）と、その前に机（solid 箱）を置く。build フェーズで 1024×580 の canvas を作り、既存 Minimap.drawMap(canvas, world, roomId, player, view) をそのまま呼んで CanvasTexture 化（drawMap は canvas 引数を取るので再利用可）。update フェーズ（可視時のみ）で 0.5 秒ごとに再描画し needsUpdate。『隠し接続の示唆』は MapView に revealNeighbors フラグを追加し、未訪問だが物理配置済みの 1 hop ノードを破線の輪郭で、施錠扉を灰色点で描く（HUD のミニマップには出さない情報 = この部屋だけの価値）。地図は訪問済みのみ・4 m セル・北固定の既存規則をそのまま使う。
- 依存: 共通基盤 1（build/update フェーズ）, Minimap.drawMap への revealNeighbors オプション追加
- 前提: scale 省略時は pxPerCell 24（3 m 幅で約 40 セル≒160 m 分）。中心は M01 自身
- 前提: 再描画はテクスチャ更新のみでレイアウトを変えないため frozen 規則と衝突しない。0.5 秒間隔なら low Tier でも負荷は無視できる（canvas は decalRes に応じ 512×290 まで縮小）
- 前提: フロアは M01 と同じ level のみ表示（Map3D の多層表示は使わない）

#### AmbientCarryover（implementable / 工数 S） — M18

- 仕様: M18 天候記憶室: fog / audio / light preset をコピー（params source='lastVisited'、modifiers.json は sourceRoomId）。『直前 Legendary/Rare の環境パラメータをコピー』『前階の色調・前階の天候音』。
- 方針: layout フェーズ（M18 ノードの初回 layoutFor = 親に入室した時点）で、RoomGraph.visitLog を新しい順に走査し、アダプタ以外で rarity が Rare 以上の最初のノードを sourceRoomId として localFlags に保存（無ければ直前の訪問部屋、それも無ければコピー無し）。コピー内容: (a) palette の light / lightColor / lightIntensity / ambient / fog（床・壁・天井は SmallRoom のまま＝『観測室』の形は保つ）、(b) コピー元 def.modifiers のうち環境系（FogDepth, ParticleDetail, Wetness, LightingPhase, ColorMissing）を params ごと M18 の適用リストに継ぎ足して同じ layout/build パスを通す（ParticleDetail は本クラスタで実装済みになる）、(c) audioPreset 文字列を localFlags に保持し AudioEngine 実装後に再生。palette 差し替えは SurfaceLighting の bakedLight に自動反映。enterRoom 時の fog / hemi は共通基盤 6 の環境適用フックが palette から読む。
- 依存: 共通基盤 5（RoomGraph.visitLog、localFlags 保存規約）, 共通基盤 6（部屋単位の環境適用フック。FogDepth / LightingPhase クラスタと共通）, ParticleDetail（本クラスタ）、FogDepth / Wetness / LightingPhase（別クラスタ）の layout パスが再利用可能であること
- 前提: source は『直前に訪問した Rare 以上』を優先し、無ければ直前訪問部屋（params の lastVisited）にフォールバックする
- 前提: コピー元の決定は M18 ノード生成時（親入室時）で固定・保存。プレイヤーがその後別の部屋を訪れても変わらない（入室後に部屋が変わらない規則と同じ扱い）
- 前提: 継ぎ足す環境系 Modifier は本クラスタと Fog/Light クラスタの実装済みのものだけ。未実装は無視してログに残す
- 前提: visitLog は上限 64 件。古いセーブ（visitLog 無し）は空で復元し、その場合は親部屋をコピー元にする

### 物理・プレイヤー系 Modifier（GravityAxis / SurfaceFriction / ExternalForce / MovingWalls / DynamicLength / ScaleAnomaly / VehicleRide / RewindState）

共通基盤: 1) Modifier レジストリ（src/modifiers/registry.ts）: ROOM_BY_ID の modifiers[] を id→params に解決し、4 種のフックを持つ。 layout(L, params, node) = WorldManager.layoutFor の生成器直後に呼ぶ決定論パス（ScaleAnomaly / GravityAxis(E03) / DynamicLength / ExternalForce のゾーン出力）。配置 fits() より前に効くので bounds も正しく反映され、frozen 不変条件（同じ node フィールド → 同じレイアウト）を保つ。 build(built, L, node) = RoomBuilder.build の末尾で動的 Mesh・トリガーを追加。 enter/exit(node) = Game.enterRoom（RewindState のバッファ、VehicleRide の状態）。 step(dt, ctx) = Game.step で player.update の直前に、現在部屋（物理系）と built 済み可視部屋（MovingWalls）に対して呼ぶ。 2) RoomLayout 拡張（generators/layout.ts）: zones[]（ローカル AABB + kind 'force'|'friction' + params）、shellCount（シェル Box と家具 Box の境界。ScaleAnomaly / GravityAxis の切り直しに使う）、dynamic[]（動くパネル・偽端の仕様）、vehicles[]（elevators の一般化: train/boat/monorail/escalator の乗降 volume と扉）、rides[]（E10 のスプライン）。 3) 動的オブジェクト機構: BuiltRoom.dynamic（個別 Mesh、材質は共有）と BuiltRoom.dynamicColliders。RoomStreamingManager.colliders() は毎フレーム配列を再構築しているので動的分を末尾に足すだけ。PlayerController に depenetrate(colliders)（delta=0 の押し出し）と frictionScale を追加し、external は既存フィールドをそのまま使う。 4) PlayerRide（player/PlayerRide.ts）: 入力無効・視点のみ可・スプライン追従またはその場固定・カメラ up の補間・フェード。VehicleRide（E11/L02/L11）と GravityAxis pathFollow（E10）が共用する。Game.state に 'riding' を追加し、メニュー/セーブを乗車中は不可にする。 5) 接続決定時の拡張: makePortals で train/boat/monorail を elevator と同じ seam=true にし、resolveElevator を一般化した resolveVehicle が新 AdapterKind 'platform' を遠方に配置する。 6) セーブ: 永続化が必要なのは RewindState の回数だけで、既存の RoomStateDiff.localFlags に入れる（SaveManager のバージョンは不変）。VehicleRide の行き先は Portal.targetRoomId として既に保存される。その他の動的状態（パネル位相、偽端位置、外力、乗車中）は時間か位置の純関数で保存しない。 7) スマホ（Low/Mid）方針: 物理系（Friction / Force / Scale / DynamicLength / Rewind）は追加コストが実質ゼロ。MovingWalls はパネル数を Tier で間引く（low 8 / mid 12 / high 24）、UV 流動と車窓の流光は surfaceTime 方式の共有材質 1〜2 枚のみ、動的ライトは増やさない。GravityAxis / VehicleRide のカメラ演出は Tier で変えず、酔い対策は乗車速度・フェードで一律に行う。

リスク: ・GravityAxis を「本当の重力回転（B 案）」で採る場合、PlayerController（軸並行 AABB・Y 固定）、Placement（yaw のみ）、ソケット（床位置の直立開口）、GridProjector の 4 系統を触ることになり、Phase 5 の他項目より重い。推奨 A 案なら回避できる。・動的コライダ（MovingWalls / DynamicLength）は静止中のプレイヤーに食い込むため depenetrate が必須。押し出し方向の判定を誤ると壁抜けや床下落下が起きるので、可動量を小さく（呼吸 0.3 m 以内、偽端は常に 8 m 以上離す）保つ設計にしてある。・DynamicLength の 60 m 直線と ScaleAnomaly ×3〜4 の巨大部屋は fits() で入らないことが多く、バリアント縮小で「遠ざかる」「巨大」の印象が弱まる。E13 は 48/36/24 m、巨大部屋は小さい元寸法から ×s になるため、配置成功率を seed 42 の先行生成で計測してから縮小段階を調整する。・VehicleRide は Seam（Epic 以上限定）と tryPlaceFree（遠方配置）に乗るが、到着側 platform の end 扉から先の通常配置が失敗すると seam fallback が連鎖する。既存の「WARN seam fallback」ログで監視する。・Legendary 6 部屋（L02 / L11 / L12 / L15 / L17 / L19）は Mega / Street Generator が未実装で LargeRoom 代替のまま Modifier だけ効く。機構は今作れるが見た目は Phase 6 待ちで、TODO サインと併存する期間がある。・RewindState は通過に 20 秒以上かかる配置で閉じ込めになり得るため、回数上限（2 回）を必ず入れる。・M07 の本来の「セル移動 + 経路更新」は DynamicGridGenerator と DynamicMapNode（別クラスタ）に依存し、v1 では内張りパネル代替になる。・音声アセットが無いため、逆再生環境音・駆動音・列車接近音などの聴覚側の異常はすべて後回しになり、視覚のみで成立させる必要がある。

#### SurfaceFriction（implementable / 工数 S） — C11, U08, L19

- 仕様: ゾーン内のプレイヤー加減速係数を変更する滑る床。C11 体育館更衣室 friction 0.6、U08 湿ったホテル廊下 0.5（Wetness と併用）、L19 凍結リゾート 0.2。ペナルティ無し、速度が変わるだけ（17.5 節）。
- 方針: PlayerController.update の accel 定数（地上 18 / 空中 6）を `groundAccel * frictionScale` にし、frictionScale = friction^2（0.6→0.36、0.5→0.25、0.2→0.04 → 氷上の時定数 約1.4s）とする。入力ゼロ時の減速にも同じ係数が掛かるので自然に滑る。Game.step でプレイヤー足元を含む部屋（currentRoomId）の RoomDefinition.modifiers から SurfaceFriction を取り、毎フレーム player.frictionScale を設定（部屋を出たら 1.0 に戻す。Adapter 内は 1.0）。zone は将来のために RoomLayout.zones（ローカル AABB）で表せるようにするが、対象 3 部屋は全室適用。レイアウト・配置・セーブには一切触れない。適用フック: 毎フレーム（Game.step、player.update の直前）。
- 依存: Modifier レジストリ（部屋定義から id→params を取る共通ヘルパ）
- 前提: zone パラメータはデータに無いので全室適用。将来 zone を使う場合は RoomLayout.zones に kind:'friction' の AABB を置く共通機構を使う
- 前提: 扉をまたいだ瞬間に係数を切り替える（補間なし）。違和感があれば 0.3 秒の線形補間を後付け
- 前提: 空中では摩擦係数を掛けない（空中 accel 6 のまま）
- 前提: L19 は MegaStructureGenerator 未実装のため LargeRoom 代替のまま全室 0.2 を適用（雪面・氷の見た目は FogDepth/ParticleDetail 側）
- 前提: スマホ Tier による差は無し（計算コストゼロ）

#### ExternalForce（implementable / 工数 M） — U03, R18, L15

- 仕様: ゾーン内でプレイヤー速度に一定ベクトルを加算する動く床 / 風。U03 無人エスカレーター conveyor 0.8（稼働中の 1 基だけが次階へ）、R18 密閉風洞廊下 wind 2.5（直線、常時風力）、L15 屋内高速道路 conveyor 6.0（車線の動く床として表現）。ペナルティ無し。
- 方針: PlayerController.external（既存・未使用）に毎フレームベクトルを入れる。ExternalForce は現行式 `target = 入力*speed + external` でそのまま効く（風 2.5 に逆らうと 0.5 m/s、追い風で 5.5 m/s）。ゾーンは RoomLayout.zones（ローカル AABB + kind:'force' + vectorLocal）で表し、RoomBuilder が BuiltRoom.zones（ワールド AABB + ワールドベクトル）へ変換、Game.step が足元を含むゾーンの合成ベクトルを external に入れる（無ければ 0）。ゾーンの出し方は部屋別: R18 は全室、方向は部屋ローカル +Z（入口→奥。GenericRoom は entry が z0 壁なので「奥へ吹く」）。U03 は AtriumLobby 本体ではなく、U03 から出る stairs Adapter を 'escalator' 見た目（金属段 + 手すり）にしてその踏面 AABB を conveyor ゾーン（+Z＝上り方向、0.8）にする。Adapter ノードは paletteFrom=U03 なので判別できる。非稼働のエスカレーターは装飾 Box として 1〜2 基置く。L15 は StreetGenerator 未実装のため v1 は LargeRoom 代替の床に車線帯（yellowLine の細長 Box）を 2 本描き、各車線帯を conveyor ゾーン（片側 +Z、片側 -Z、6.0）にする。端壁の 3 m 手前でゾーンを切り、6 m/s で壁に叩きつけられないようにする。適用フック: レイアウト生成時（zones 出力）+ 毎フレーム（external 設定）。
- 依存: RoomLayout.zones / BuiltRoom.zones の共通ゾーン機構, L15 の本来の見た目は StreetGenerator（Phase 6）
- 前提: vector はデータに無いので、方向は部屋ローカル +Z（入口から奥）を既定にする。U03 のエスカレーターは Adapter の上り方向
- 前提: U03 の「稼働中の 1 基のみ次階へ」は、Portal になる stairs Adapter 1 本だけを動かし、他は停止した装飾エスカレーターとして表現。エスカレーターを下る（逆走）と 0.8 m/s 減速するだけで通行可
- 前提: R18 の「風向と逆方向ほどレア出口率上昇」は接続抽選側（RarityGenerator）の話で v1 では実装しない（後日 PickOptions に bias を足せる）
- 前提: L15 の車線ゾーンは StreetGenerator 実装時に RoadGraph の車線矩形へ置き換える。ゾーン機構自体は今作る
- 前提: 風は空中にも作用する（現行の空中 accel 6 で追従）
- 前提: スマホ Tier 差なし。風の可視化（パーティクル）は ParticleDetail 側で、ここでは力のみ

#### ScaleAnomaly（implementable / 工数 M） — R13, R16, L12, L17, M12

- 仕様: 親 Group スケール + コライダ再生成。mode room: R13 巨大児童遊園 ×3.0、L17 無限団地 ×1.5、M12 巨大Common ×4.0。mode perProp: R16 縮尺異常オフィス 0.5〜2.0（小型扉はしゃがみ/専用遷移）、L12 設備大聖堂 3〜8（巨大設備）。
- 方針: Three.js の Group スケールではなく RoomLayout 段階の後処理にする（配置 fits() と Portal 接続に効かせるため）。WorldManager.layoutFor で生成器の出力に対し modifier のレイアウトパスを掛ける。mode room: footprint 矩形・height・holes・全 Box・ライト位置と distance・ラベル位置を原点基準で ×s し、シェル Box（RoomLayout.shellCount で区切る。生成器は既に shellCount を局所変数で持っているので layout に出すだけ）を捨てて、拡大後の矩形 + 元のままの寸法（DOOR_W×DOOR_H、位置だけ ×s）のソケットで buildShell を再実行する。これで「巨大な部屋に通常サイズの扉」になり、隣接部屋との物理接続（ソケット寸法・entryReq）が一切変わらない。壁厚・床厚は WALL_T/0.2 のまま。perProp: shellCount 以降の家具 Box を、Box の底面中心を基準に seed 乱数で [min,max] 倍（高さは天井 -0.3 でクランプ、footprint 外へ出るものは捨てる）。両モード共通で最後に clearDoorways を再実行して扉前 1.8 m を空ける。mainRect（grow-to-fill）は拡大後座標で保存されるので生成器に渡す前に 1/s する。hole は拡大後 4.2 m 穴になり真下部屋の天井穴（1.4 m）と合わないため ScaleAnomaly(room) の部屋は allowHole=false。バリアント探索（大→小）が既にあるので ×3〜4 で入らなければ自動的に小さい元寸法が選ばれる。適用フック: レイアウト生成時のみ（決定論、毎フレームコスト 0、保存状態なし、frozen 不変条件に影響なし）。
- 依存: Modifier レイアウトパス（layoutFor 内の共通フック）, RoomLayout.shellCount
- 前提: Portal 開口（扉・階段・穴）は拡大しない。「巨大な空間に普通の扉」で縮尺異常を表現する（隣室との寸法互換を保つため）
- 前提: R16 の「小型扉はしゃがみ/専用遷移」はしゃがみ操作が無いので実装しない。0.5 倍の小型扉は壁面装飾（偽扉 Box）として置き、実 Portal は通常寸法
- 前提: M12 の実装メモ「10〜30 倍」ではなくデータの 4.0 を採用（4 倍でも GenericCorridor 26 m → 104 m、高さ 10.8 m）
- 前提: ScaleAnomaly(room) の部屋は床穴を出さない
- 前提: perProp の乱数は node.seed から fork('scale') で決定論。上限は天井高 -0.3 m
- 前提: 地図の mapCell は実寸から投影（最大 16 セルで打ち切り）のままで良い
- 前提: L12/L17 は Mega/Street Generator 未実装のため LargeRoom 代替に適用（見た目は Phase 6 で改善）

#### MovingWalls（implementable / 工数 M） — E18, M07

- 仕様: セル単位 Transform 更新で壁を動かす。E18 動く壁紙区画（CorridorHotel、speed 0.2、壁紙 UV 流動に合わせ壁セグメントをスライド、可変蛇行）、M07 動くマップタイル（DynamicGrid、speed 0.5、床セルが移動し経路グラフも更新。再配線は未構築・非観測の接続に限定）。
- 方針: 外殻（footprint・ソケット・bounds）は絶対に動かさず、動くのは室内の「内張りパネル」だけにする。これで配置・隣接接続・frozen 不変条件・地図に影響しない。E18: CorridorGenerator の decorate で、壁の内側 0.05 m に幅 2〜3 m × 高さ h の壁紙パネル Box を辞書順で並べ、ソケット周辺 ±1.6 m は置かない。RoomLayout に `dynamic: MovingPanelSpec[]`（ローカル AABB、移動軸、振幅、位相）を出し、RoomBuilder は dynamic を結合メッシュに含めず個別 Mesh（1 パネル 1 Box、全パネルで材質共有）にして BuiltRoom.dynamic に登録、毎フレーム位置更新: 壁沿いスライド（speed 0.2 m/s、位相 seed）+ 内側へ最大 0.3 m の呼吸。通路幅が 1.2 m を下回らないよう振幅をクランプ。コライダ: BuiltRoom.dynamicColliders を毎フレーム更新し RoomStreamingManager.colliders() が追加する（既に毎フレーム再構築している配列なので追加コストのみ）。静止中のプレイヤーに壁が食い込む問題は PlayerController.depenetrate(colliders) を update 末尾に 1 回追加して解く（moveAxis の押し出しを delta=0 でも走らせる）。壁紙 UV 流動は MaterialLibrary の water と同じ surfaceTime 方式で 'wallBeige' の複製材質 1 枚（wallFlow）を作りパネルに使う。M07: DynamicGridGenerator（Phase 7）未実装のため、v1 は同じ内張りパネル方式を speed 0.5 で適用する代替。本来の「セル間仕切りがグリッド位置間をスライドし、経路グラフを更新」は入口→各出口の BFS 経路上のセルを動かさない制約付きで DynamicGridGenerator と同時に実装する（DynamicMapNode は別クラスタ）。適用フック: レイアウト生成時（パネル仕様）+ 3D 構築時（個別 Mesh）+ 毎フレーム（built 済み全部屋、可視のものだけ）。
- 依存: 動的オブジェクト機構（BuiltRoom.dynamic + dynamicColliders + PlayerController.depenetrate）, M07 本来版は DynamicGridGenerator（Phase 7）
- 前提: 外殻・ソケット・footprint は不動。動くのは室内の内張りパネルと、その動的コライダのみ
- 前提: 扉前 ±1.6 m と通路幅 1.2 m を常に確保し、進行を塞がない
- 前提: 位相は node.seed、時間はワールド起動からの経過秒（保存しない。再ロード後の位相ずれは演出上問題なし）
- 前提: E18 は廊下形状を Z / U に寄せる（可変蛇行）。CorridorGenerator でバリアント選択時に E18 は straight を除外
- 前提: パネル数上限: low 8 / mid 12 / high 24（Tier で間引く。UV 流動は全 Tier 共通）
- 前提: M07 の本来のセル移動版は DynamicGridGenerator 実装時に。v1 は内張りパネル代替 + TODO サイン

#### DynamicLength（implementable / 工数 M） — E13

- 仕様: 廊下セグメント数をプレイヤー位置に応じて増減（コライダ再生成）。E13 遠ざかる廊下（GenericCorridor、rate 0.5、min 8、max 60、プレイヤー速度に応じ廊下長を伸長、伸縮直線）。
- 方針: 本当にセグメントを増減させると奥の扉ソケットと隣接部屋の配置が動き、frozen 不変条件と 1 hop 物理配置が壊れる。そこで「配置は max 長で確定し、見える長さだけ動かす」方式にする。E13 は CorridorGenerator で直線のみ、長さ max（60 → 入らなければバリアントで 48 / 36 / 24 m と縮める）で生成・配置し、奥の扉と隣接部屋は本当の端に置く。室内に「偽の突き当たり」（壁材の全断面パネル + 装飾扉 + 幅木、非インタラクト）を動的オブジェクトとして 1 枚置く。プレイヤーの廊下軸上の進行距離 d（入口からの距離、ローカル z）から偽端の位置 e = clamp(min + (1+rate)·d, min, max) を毎フレーム決める。残距離 e−d = min + rate·d なので歩くほど端が遠ざかり、戻ると縮む。e ≥ max−0.1 で偽端を非表示にし本物の端が現れる（rate 0.5、min 8、max 60 なら約 35 m 歩いた時点）。偽端は不透明なので向こう側の照明・側面扉は見えず、側面扉の隣接部屋は通常どおり配置・構築されていても問題ない。コライダは偽端の AABB 1 個を dynamicColliders に入れる（残距離 ≥ 8 m なので押し潰しは起きない）。位置は f(d) の純関数なので保存状態なし。地図は実寸（60 m）で投影されるが「伸縮直線」として許容。適用フック: レイアウト生成時（直線・max 長・偽端仕様）+ 3D 構築時（偽端 Mesh）+ 毎フレーム（現在部屋のみ）。
- 依存: 動的オブジェクト機構（MovingWalls と共通）, CorridorGenerator のバリアント長を定義別に上書きできる仕組み
- 前提: 「速度に応じ」は位置の関数として実装する（rate·速度 を積分すると rate·距離になり等価）。ダッシュ時は端が速く遠ざかる
- 前提: 戻ると対称に縮む（ヒステリシス無し）。振り向いたときに端が近づいて見えるのは演出として採用
- 前提: 配置は max=60 m の直線で試み、入らなければ 48 / 36 / 24 m へ縮小（min はデータの 8 を維持）
- 前提: 偽端の側面扉（偽端の向こう側にある側面ソケット）は偽端が過ぎるまで到達不能なだけで、接続・構築は通常どおり
- 前提: E13 では床穴を出さない（偽端の向こうに落ちる導線を避ける）
- 前提: スマホ Tier 差なし（動的 Mesh 1 枚）

#### GravityAxis（needsDecision / 工数 M） — E03, E10

- 仕様: プレイヤー座標系と camera.up を変更する重力軸回転。v1.1 で 90 度単位・フェード付きに限定、連続回転禁止（酔い対策）。E03 横向きホテル（CorridorHotel、mode fixed、upVector [1,0,0]、Portal 通過で重力軸変更、90 度回転セル）、E10 天井エスカレーター（VerticalCore、mode pathFollow、床→壁→天井へ移動、3 軸曲線）。地図では重力回転の接続は「？」。未決 Q3: スマホ実機検証後に採否判断。
- 方針: 現行の PlayerController は軸並行 AABB で Y 上向き固定、Placement は yaw 回転のみ、ソケットは「床位置の直立開口」前提なので、本当に重力軸を変えると (1) X 上向きの部屋の扉開口（1.0×2.1）が隣室の直立扉と 90 度ずれて寸法互換が壊れ、(2) 重力遷移用 Adapter（回転開口を持つ立方体前室）と Opening の y オフセット対応、(3) Placement への roll 追加または 6 軸対応の物理・カメラ合成が必要で、L〜XL 規模になる。推奨は「重力は Y のまま、部屋の中身を横倒しにする」方式。E03: CorridorGenerator の出力を廊下軸まわりに 90 度ロールするレイアウトパス（upVector [1,0,0] = ローカル -X 壁が床）。カーペット床→側壁、天井の照明パネル→反対側壁、元の -X 壁（壁紙 + 偽扉列）→歩く床、元の +X 壁→天井に偽扉が並ぶ。廊下幅を 2.4 m 以上にクランプして天井高（旧幅）を確保し、幅は旧高さ 2.7 m。実 Portal（entry / end / side / extraSockets）は直立の通常扉のまま、ロール後の矩形に buildShell で切り直す（ScaleAnomaly と同じ shellCount 方式）。カメラも物理も不変、隣室との物理接続と地図投影は通常どおり。E10: 「床→壁→天井」は歩行では成立しないので VehicleRide と共通のスクリプト移動（PlayerRide）で表現する。VerticalGenerator の E10 版で直階段の代わりに、下階床→+X 壁→天井（y=7.2）→反対壁→上階踊り場（y=3.6）へ続くスプライン上に段 Box のリボンを描き、始点の踏面に乗ると入力無効・スプライン追従・カメラ up をスプライン法線に合わせて 0→90→180→90→0 度ロール（約 12 s）、上階踊り場で解除。上階の既存 up0/up1/up2 ソケットから通常接続。逆方向のリボンで下りも可。E10 内部で完結するので Seam 不要。適用フック: E03 はレイアウト生成時のみ。E10 は 3D 構築時（トリガー volume）+ 乗車中の毎フレーム。
- 依存: Modifier レイアウトパス + shellCount（E03）, PlayerRide スクリプト移動（VehicleRide と共通）（E10）
- 前提: E03 の実 Portal はすべて直立の通常扉。横倒しになるのは装飾（偽扉・カーペット・照明）だけ
- 前提: E03 の廊下幅は 2.4 m 以上にクランプ（横倒し後の天井高になる）
- 前提: E10 のエスカレーターは踏面に乗ると自動で乗車（インタラクト不要）。乗車中は視点のみ操作可、移動入力無効
- 前提: E10 のカメラロールは PC / スマホ同じ。酔い対策は乗車速度と 0.3 s のフェードで行い、Tier で挙動を変えない
- 前提: 地図の「重力回転は？」は推奨案では接続が通常なので付けない（真の重力回転を選んだ場合のみ「？」）
- 質問: 重力軸回転をどう表現しますか？ 選択肢: A: 見た目だけ横倒し。E03 は部屋の中身を 90 度ロールして生成し、E10 はスクリプト移動でカメラをロール（物理・カメラ系・配置は不変） / B: 本当にプレイヤーの上方向を変える。X 上向き物理 + camera.up 変更 + 重力遷移 Adapter（回転開口）+ Placement/AABB の拡張 推奨: A

#### VehicleRide（needsDecision / 工数 L） — E11, L02, L11

- 仕様: 乗車で入力を無効化しスクリプト移動、到着時に Seam 遷移。E11 線路のないホーム（Terminal、train、20 s、線路メッシュなし、浮遊列車）、L02 室内海洋（MegaHall、boat、25 s、桟橋・浮橋・水門）、L11 環状モノレール都市（MegaAtrium、monorail、30 s、環状線駅をハブ接続）。未決 Q2: 車両モデル・乗降アニメを作るか「乗ると暗転して到着」まで簡略化するか。
- 方針: エレベーター（籠 Adapter + seam Portal + transition）の流れをそのまま一般化する。(1) Terminal（AtriumGenerator）にホーム縁の 'train' ソケットと、浮いた車両 Box（床 1.0 m 浮上、線路なし、窓 = glass 帯）を出力し、layout.elevators を `vehicles: {socketId, type, volume, door}` に一般化。makePortals で type train/boat/monorail は seam=true にして ensureNeighbors の物理配置対象外にする（elevator と同じ）。(2) 車両扉をインタラクト（E / タップ）→ 乗車: state='riding'、input 無効（視点のみ許可）、プレイヤーを車内 volume に固定、窓材質（surfaceTime で流れる発光ストライプ、MaterialLibrary に 1 枚追加）と微小なカメラ揺れで走行感を出す。(3) durationSec 経過（またはスキップ）で fade → WorldManager.resolveVehicle: 新 AdapterKind 'platform'（短いホーム + 同型車両 + end 扉）を tryPlaceFree で遠方（+200 m）に配置し、プレイヤーを到着側の車内へ teleport → enterRoom(platform) → 扉が開き、platform の end 扉から connectPortal の通常連鎖で次の部屋へ。行き先は resolveElevator と同様に初回乗車時に確定し、以後は同じ platform へ（Portal.targetRoomId に保存されるためセーブ整合）。到着側の車両にも乗れば元の駅へ戻る（elevator の戻り処理と同じ）。boat/monorail は車両の形状・材質・浮上高（boat は水面 0、monorail は 3 m 上の軌道桁）と窓の流光色を変えるだけの variant。L02/L11 は MegaStructureGenerator 未実装なので v1 は LargeRoom 代替の縁に同じ乗降ソケットを置く。適用フック: レイアウト生成時（vehicles ソケット）+ 3D 構築時（車両 Mesh、インタラクト対象）+ 乗車中の毎フレーム（PlayerRide）+ 接続決定時（resolveVehicle）。
- 依存: PlayerRide スクリプト移動（E10 と共通）, エレベーター実装（resolveElevator / tryElevator）の一般化, L02 / L11 の見た目は MegaStructureGenerator（Phase 6）
- 前提: 乗車中は視点操作のみ可、移動・ジャンプ・インタラクト無効。メニュー（セーブ）は乗車中は開けない（state='riding'）
- 前提: 行き先は初回乗車時に確定し Portal.targetRoomId に保存（エレベーターと同じ）。到着側の車両で元の駅へ戻れる（往復可）
- 前提: 到着先は新 Adapter 'platform'（ホーム + 車両 + end 扉）で、そこから通常の物理配置連鎖。到着先の地図は Seam 扱いで「？」
- 前提: 車両モデルは Box 合成（車体・窓帯・扉）。GLB は導入しない
- 前提: L02 / L11 の本来の見た目（海面・環状線）は Phase 6 の Generator 実装時。乗車機構は共通
- 前提: L11 の LoopTopology（同一部屋へ戻る環状）は別クラスタ。VehicleRide 単体では通常の新規行き先
- 質問: 乗車演出の量はどこまで作りますか（durationSec 20 / 25 / 30 秒）？ 選択肢: A: 乗車→暗転 3 秒→到着（車内演出なし、durationSec は無視） / B: 車内で durationSec 秒待つ。窓の流光 + 微振動、視点のみ操作可 / C: B と同じ演出だが、5 秒経過後は E / タップで到着を早められる（durationSec は上限） 推奨: C

#### RewindState（needsDecision / 工数 M） — M10

- 仕様: RoomState リングバッファ。M10 巻き戻しフロア（GenericCorridor、seconds 20、部屋状態を数分前のスナップショットへ戻す、逆再生環境音、状態巻戻しが地図・接続・状態へ干渉することを視覚的にも示す）。9.3 節: 世界全体ではなく対象 RoomState のリングバッファだけ巻き戻す。
- 方針: Game.step で currentRoomId が M10 のとき、0.25 s ごとに {t, playerPos, yaw, pitch, この部屋の全 Portal.open（戻り扉は所有側の値）} を長さ seconds/0.25 = 80 のリングバッファに積む（入室時にクリアし、入室時点の状態を先頭に入れる）。入室から seconds 経過ごとに「seconds 秒前のスナップショット」を復元: 扉の open/passedAt を戻して streaming.updateDoors が閉扉アニメを再生、プレイヤーを teleport（フェード 0.15 s + 一瞬の反転色フラッシュを既存 #fade で表現）。復元対象は M10 自身の Portal と、そこにつながる隣室側の戻り扉だけ（LogicalRoomGraph・visitedCount・隣室の配置には触れない。D3 の進行は減らさない）。脱出保証: 通常の廊下（≤26 m）は 20 秒以内に抜けられるが、寄り道で 20 秒を超えると入口まで戻される。無限ループを防ぐため state.localFlags.rewindCount を持ち 2 回で巻き戻しを止める（RoomStateDiff.localFlags は既に RoomGraph 経由でセーブされるので追加のセーブ項目なし）。リングバッファ自体は runtime のみ（ロード直後は空から再開）。適用フック: 入室時（クリア）+ 毎フレーム（現在部屋のみ）。frozen 不変条件: レイアウトに触れず Portal.open だけを書き換えるので整合。
- 依存: Modifier レジストリの enter / step フック
- 前提: 巻き戻しはプレイヤーが M10 の中にいる間だけ進行・発火する。部屋を出ればバッファは捨てる
- 前提: 復元するのは M10 の扉状態とプレイヤー位置・視点。隣接部屋の中身・visitedCount・接続先は変えない（D3 / LogicalRoomGraph 不変）
- 前提: 発火は seconds ごとの周期。1 回目は入室 + seconds 秒後
- 前提: 脱出保証として 1 回の入室あたり 2 回まで（state.localFlags.rewindCount、セーブ対象）。上限後は普通の廊下として振る舞う
- 前提: 視覚演出は既存の #fade を使った短い暗転 + 反転色フラッシュ。音は未実装のため無し
- 前提: スマホ Tier 差なし（バッファ 80 要素、コストほぼゼロ）
- 質問: 巻き戻す対象はどこまでにしますか？ 選択肢: A: この部屋の扉状態のみ（プレイヤーは動かさない） / B: 扉状態 + プレイヤー位置・視点（seconds 秒前の場所へ戻される）。回数上限 2 回で脱出保証 / C: B に加えて、隣接部屋で開けた扉も戻す 推奨: B

### 接続・トポロジー系 Modifier（LoopTopology / ObservationRewire / RepeatDestination / FakeExit / NonEuclideanVolume / NoiseGate / DiscoveryGate / FarLink / MultiEdge / DynamicMapNode）

共通基盤: ■ 現行コードの要点（読み取り結果）
- 接続確定は WorldManager.ensureNeighbors → connectPortal（①既存部屋へ直結 tryLinkExisting ②stairs/ramp Adapter ③rollRoomNode→tryPlace→growToFill→link→finalize、失敗時 lockOrVestibule → mustSucceed なら portal.seam=true）。Game.enterRoom が prepareRoom（現在+1hop の接続確定 = 2hop 配置）。
- Seam 扉は既にある: 閉じた扉として描き、開けた瞬間 Game.transition(フェード 280ms) → WorldManager.resolveSeamTarget（targetRoomId が既にあればそこへ spawnPointOf(entry 内側 1.5m)、無ければ新規抽選して tryPlaceFree で別階層/横にずらして配置、projected=false→地図「？」）。updateVisibility / placedNeighbors は seam を除外するので Seam 先は物理配置も 3D 化もされない。
- 不変条件: enterRoom 時に frozen（現在・構築済み・訪問済み）を組み、frozen な部屋には開口を追加しない。dirty 再構築も現在部屋は除外。
- セーブは RoomGraph.toJSON が RoomInstance を丸ごと（portals / extraSockets / removedSockets / variant / mainRect / holeLocal / state）保存。RoomInstance / Portal / RoomStateDiff に optional フィールドを足せば追加コード無しで永続化される（SaveData.version は 1→2 に上げ、欠損フィールドは既定値で埋める）。
- Modifier は data 読込のみで未適用（README「Phase 3 以降で src/modifiers/」）。

■ 提案する共通基盤（このクラスタ全体で先に作るもの）
1) src/modifiers/ModifierHost.ts + src/modifiers/<Id>.ts（1 ファイル 1 Modifier）。RoomDefinition.modifiers[] から部屋ごとのハンドラ配列を解決する registry。フックは 5 か所に固定する:
  a. レイアウト生成時: generators/index.ts generateLayout() 末尾で applyLayoutModifiers(def, L, rng.fork('mod')) を post-pass 実行（MultiEdge の追加扉ソケット、NoiseGate の 3 扉、E08 の殻/内部切替、M03 の扉上サイン・M06 の銘板・R17 の病室番号など LabelSpec 追加）。決定論は node.seed 由来なので永続化不要。
  b. 接続決定時: WorldManager.connectPortal() の冒頭で host.onConnect(node, portal, rng) を呼び、{handled:true} なら通常フローをスキップ（Loop/Repeat/FarLink/FakeExit/MultiEdge/E08/Rewire 系が接続先やseam を決める）。finalize() 直後に host.onNodeCreated(node) を呼び、Seam 化する扉の初期化・chain 情報の付与を行う。rollRoomNode に opts.forceDefinitionId と RoomInstance.layoutSeed?（同一ジオメトリ用）を追加。
  c. 3D 構築時: RoomBuilder は Modifier を知らない。ただし LabelSpec に id? を足し BuiltRoom.labels: Map<id, {mesh, canvas, tex}> を返す updateLabel(roomId, labelId, text) を追加（サイン差替えは CanvasTexture の再描画のみ）。Portal.mirrorOf を扉の開閉参照で解決（MultiEdge）。
  d. 毎フレーム: Game.step 内 playing 時に host.update(dt, {currentRoomId, neighbors, camera, playerPos, input, now}) を呼ぶ。対象は現在部屋 + placedNeighbors のみ（他は休止）。共通ヘルパ Observation.isDoorObserved(door, camera): 扉コライダ AABB と camera Frustum の交差 + 距離 3m 超で「観測中」。
  e. 扉操作時・入退室: Game.interactRay / updateHint で host.canOpen(node, portal) → {ok, hint} を通す（DiscoveryGate / NoiseGate。hint 既定「この扉は開かなそうだ」）。Game.enterRoom で host.onEnter(node) / onLeave(prev)。
2) Seam の一般化（src/world/WorldManager.ts + Game.ts）: (i) resolveSeamTarget が portal.targetPortalId を尊重し spawnAtPortal(target, portalId)（entry 以外にも着地できる）。(ii) isReturn && seam の扉は「自分の targetRoomId へ戻る」経路として SeamRouter に統一（今は elevator だけ特別扱い）。(iii) Game.transition(fn, {fadeMs, holdMs, overlayText}) に演出パラメータを追加（FakeExit の偽エンディング、Loop の短いフェード）。(iv) Portal に mirrorOf?: string、RoomInstance に loop? / repeat? / role? の optional を追加し、RoomStateDiff に 11.1 節どおり modifierState: Record<string, unknown> と rewireLog: {portalId, from, to, at}[] を追加。
3) 再配線・スワップ系（E07 / M03 / M07）は spec 3.3「再配線は Seam」に従い、対象部屋の前進扉を全て seam=true（閉扉）で生成し、物理隣接を置かない。接続先の変更は targetRoomId / pending 定義の差替えだけになり、frozen 不変条件（構築済み部屋の開口・家具を変えない）と衝突しない。
4) スマホ方針: 追加コストは frustum テスト数枚・Analyser RMS 10Hz・CanvasTexture 再描画（Low は 4Hz 上限）のみ。Seam 主体の部屋は物理隣接が減るため実質軽くなる。Tier 依存で寸法や抽選を変えない（決定論維持）。

リスク: 1) Seam 主体の部屋（E07 / M03 / M07 / M11 / M08 / M20）は物理隣接を置かないため、その周辺で地図の占有率が下がり D10（密度）と局所的に逆行する。Epic 以上限定なので許容範囲だが、Seam 先を tryPlaceFree で別階層に置く現行方式は他フロアの空間を消費する（worldBounds に登録されるため衝突はしない）。
2) 再配線・スワップで旧接続先ノードが孤立して増える。1 扉 3 回の上限で抑えるが、セーブサイズは単調増加する（数百ノード規模なら問題なし）。
3) LoopTopology の同一ジオメトリ化は layoutSeed と variant の固定が前提。周期ノードの配置に失敗すると鎖が短くなり、L08（Terminal）はほぼ常に 1〜2 周期で自己 Seam になる。Legendary チャンク実装後に再調整が必要。
4) NoiseGate: getUserMedia は HTTPS 必須、iOS Safari は AudioContext をユーザー操作から開始する必要がある。初回の扉操作で要求し、それまでは移動代替で動く設計にしないと扉が一切開かない状態になり得る。マイク許可ダイアログがゲーム画面（Pointer Lock）を外すので、PC では要求後に requestLock を再度呼ぶ。
5) 未実装 Generator（M07 DynamicGrid / M20 Hub / L11 MegaStructure）上ではこのクラスタの Modifier は LargeRoom 代替の上で動く。接続ロジックは Generator に依存しないので先行実装できるが、見た目の完成は別クラスタ待ち。
6) 既存 Seam 経路（resolveSeamTarget / checkSeamCrossing / ownerPortal）の一般化は elevator と緊急 Seam の挙動を巻き込む。回帰確認項目: エレベーター往復、seed 42 の緊急 Seam 3 件、セーブ→ロード後の Seam 扉。
7) FarLink の BFS は接続確定時に全ノード走査。数万ノードまで育つと数十 ms になるので、M08/M20 生成時に 1 回だけ実行しキャッシュする。
8) スマホ Low Tier で CanvasTexture の頻繫更新（サイン・メーター）は 4Hz 上限にする。frustum 判定は扉数枚なので無視できる。

#### LoopTopology（implementable / 工数 M） — E01, L08, L11

- 仕様: E01（閉ループ廊下, loopLength 3）「直進で開始点へ戻る。特定扉だけループ外」、L08（空港, 4）、L11（環状モノレール, 1）。RoomGraph のエッジを自己/祖先へ接続し、同一周期ジオメトリの境界で Seam 遷移（9.1 節: A→B→C→A）。
- 方針: onConnect（接続決定時）: 先頭ノード A のループ辺（廊下は 'end'、Atrium 系は entry から最遠の扉）で発火。loopLength-1 個の「周期ノード」を同一 definitionId・layoutSeed=A.seed・variant=A.variant で forceDefinitionId 抽選し、通常どおり tryPlace で物理配置して鎖状に繋ぐ（RoomInstance.loop = {headRoomId, index, length} を永続化）。最後の周期ノードのループ辺は seam=true, targetRoomId=A, targetPortalId='entry' とし、通過で A の入口内側へ spawnPointOf(A)（前進向き）に着地。配置に失敗した時点で鎖を打ち切り、その部屋のループ辺を A への Seam にする（ループが短くなるだけで破綻しない）。側面扉は通常接続（=ループ外の扉）。周期ノードの側面出口数は 0〜1 に抑える。loopLength 1（L11）は A の最遠扉を自己 Seam。地図: 周期ノードは実座標投影、ループ辺だけ「？」（既存の seam 描画で済む）。毎フレーム処理なし。
- 依存: ModifierHost.onConnect / onNodeCreated, rollRoomNode の forceDefinitionId・layoutSeed 対応, Seam 一般化（targetPortalId 着地・fadeMs）, L11: VehicleRide / MegaStructureGenerator（別クラスタ）
- 前提: ループ辺の Seam は現行どおり「閉じた扉 → 短いフェード → 着地」（fadeMs 150 に短縮）。開いた戸口で継ぎ目を隠すダミー区画は v1 では作らない（質問参照）
- 前提: 周期ノードは別 RoomNode として visitedCount に数える
- 前提: L08 は Terminal が巨大なため鎖は 1〜2 個で打ち切られる想定。chunked/xl は Legendary チャンク実装（別クラスタ）に委ねる
- 前提: L11 の MegaStructureGenerator / VehicleRide は未実装。LargeRoom 代替のまま自己 Seam だけ先行実装する
- 質問: E01 のループ継ぎ目の見せ方 選択肢: A: 閉じた扉を開けると短いフェードで A の入口へ（現行 Seam の流用） / B: 扉を開放状態にし、戸口の先に A の先頭 4〜6m を複製したダミー区画を置き、踏み込んだ瞬間にフェード無しでカット 推奨: A（v1）。B は Phase 5 の演出強化で追加

#### ObservationRewire（implementable / 工数 M） — E07

- 仕様: E07（観測依存廊下, rewireRate 0.5）「カメラ外になった扉の接続先を再抽選」。再配線は非観測時のみ、部屋ごとの決定論的乱数列で再抽選し stateDiff.rewireLog に保存（07 シート「接続先確定」ルール）。
- 方針: onNodeCreated: E07 の戻り以外の door Portal を全て seam=true（閉扉）にし物理隣接を置かない（spec 3.3「再配線は Seam」）。接続先は初回開扉時に resolveSeamTarget が fork(`seam:${portalId}:${n}`) で抽選（n = state.modifierState.ObservationRewire.count[portalId]）。update（毎フレーム、プレイヤーが E07 内のときのみ）: 各 Seam 扉について Observation.isDoorObserved を追跡し、「観測→非観測」に遷移した瞬間に fork(`rewire:${portalId}:${k}`).chance(rewireRate) で再配線判定。成立なら count++、targetRoomId/targetPortalId を外し（既に開けた先の部屋はグラフに残す）、rewireLog に {portalId, from, to:null, at} を追記。条件: 扉が閉、非観測、接続先が未構築（Seam 先は E07 滞在中は常に未構築）。1 扉あたり再配線は最大 3 回で打ち止め（孤立ノード増加の抑制）。旧接続先の entry は E07 の当該扉へ戻る return-seam にしておき、そこから戻ると E07 に着地（SeamRouter の isReturn&&seam 経路）。地図: 全て「？」で表現済み。
- 依存: ModifierHost.update（毎フレーム, 現在部屋のみ）, Seam 一般化（isReturn&&seam の戻り経路、seed タグに count を含める）, RoomStateDiff.modifierState / rewireLog
- 前提: 再抽選は新規部屋の抽選のみ（既訪部屋へ繋ぎ直す演出は入れない）
- 前提: 再配線の判定タイミングは「観測→非観測の遷移」1 回につき 1 回。遠距離（>3m）かつ frustum 外を非観測とみなす
- 前提: 打ち止め回数 3 は定数。旧接続先はグラフに残るが visitedCount には影響しない

#### RepeatDestination（implementable / 工数 S） — U18, R17

- 仕様: U18（反復エレベーター, repeatCount 3）「何階を押しても同系部屋、内装差で正解階を判定」、R17（無限病棟, repeatCount 4）「病室番号が増え続ける。節目で分岐」。Portal の接続先を同一定義へ N 回接続してから解放。
- 方針: onConnect: 前進 Portal（廊下 'end'、エレベーター籠 Adapter の 'end'）で node.repeat = {definitionId, remaining} が残っていれば rollRoomNode を forceDefinitionId=同定義で行い、生成ノードに repeat.remaining-1 を引き継ぐ（0 で解放=通常抽選）。U18 は resolveElevator で作る elevatorCar Adapter に親の repeat を複製し、籠の 'end' 接続で消費する。物理配置は通常フロー（失敗すれば lockOrVestibule に落ち、反復はそこで終わる）。側面扉は通常（=節目の分岐）。レイアウト時 post-pass: R17 は label.sub を「病室 {base}〜{base+19}」で連番（base = 301 + 20×index）、U18 は階表示ラベルを連番にする（正解階は機構を持たないので内装差 = 番号・照明の微差のみ）。毎フレーム処理・永続化は node.repeat のみ。
- 依存: ModifierHost.onConnect, rollRoomNode の forceDefinitionId
- 前提: 「正解階」は D1/D2 に従いメカニクス無し。番号と照明色の微差だけで表現する
- 前提: 反復中の各ノードは別 RoomNode として発見数に数える（同定義なので図鑑上は 1 種）
- 前提: 連番の初期値は先頭ノードの seed から決める（決定論）

#### FakeExit（implementable / 工数 S） — M04

- 仕様: M04（偽帰還口, returnDepth 3, showEndingOverlay true）「出口風景は開始地点風だが別ノードへ戻す」。終了条件が無いため偽エンディングは UI オーバーレイ演出のみ。
- 方針: レイアウト post-pass: SmallRoom の entry 対面の壁に「出口」ラベル付きの明るい扉（door 材質を lightPanel に差替え、上に EXIT サイン）を 1 枚追加ソケットとして置く。onNodeCreated: その Portal を seam=true, oneWay=true, projected=false にし、targetRoomId = parentRoomId を returnDepth 回たどった祖先（Adapter は飛ばす。足りなければ開始部屋 r1）、targetPortalId='entry'。開扉時は Game.transition(fn, {fadeMs 600, holdMs 2500, overlayText:'外に出た——' 等の白フェード + 発見数表示}) で偽エンディングを見せてから祖先の entry 内側に着地。戻り Portal は無し（Mythic の一方通行許可）。他の扉は通常接続。永続化は Portal の target のみ（既存フィールド）。
- 依存: ModifierHost.onNodeCreated / applyLayoutModifiers, Game.transition の overlay/hold 拡張
- 前提: 帰還先は「祖先 returnDepth hop」。開始部屋固定ではない（開始部屋は祖先が足りない場合のフォールバック）
- 前提: オーバーレイ文言は仮。HUD に発見数を出し「探索は続く」で閉じる（終了条件無し）
- 前提: 「自然光」照明プリセットの色は presets.ts の正規表現に追加（描画クラスタと共有）

#### NonEuclideanVolume（implementable / 工数 M） — E08

- 仕様: E08（内部拡張会議室, interiorScale 4.0）「外寸より内部セル数が多い」。入口寸法より大きい内部を Seam Portal 越しの別配置で実現。外形と内部寸法の不一致を許容。
- 方針: 2 ノード構成。①殻ノード: E08 を role='shell' として通常配置（SmallRoom 最小級 4×4m、内部は無く外壁のみの閉じた箱。mapCell は小さく projected）。親の扉→殻の entry は onNodeCreated で seam=true（閉扉）にする。②内部ノード: 初回開扉時に resolveSeamTarget 相当で role='interior' の E08 ノードを生成し、RoomGenerator を LargeRoom 系サイズ × sqrt(interiorScale)（面積 ×4）で生成、tryPlaceFree で別階層/横ずらしに配置、projected=false（地図では破線の大部屋 + 親扉に「？」）。内部の entry は親扉への return-seam（戻ると親の扉内側へ）。内部の他の出口は通常接続（内部の周囲に物理隣接が付く）。殻は frozen 不変条件に触れない（内部は Seam 先なので殻の 3D は変わらない）。
- 依存: Seam 一般化（return-seam、spawnAtPortal）, RoomInstance.role の追加と layoutFor の分岐
- 前提: 殻 4×4m、内部は LargeRoom family サイズを面積 4 倍に拡大（辺 2 倍）。Tier で寸法を変えない
- 前提: 内部生成は elevator と同じく初回開扉時の遅延生成（決定論は seed タグで担保）
- 前提: 発見数は殻と内部で 2 カウントになるが許容（内部だけ数えるなら markVisited で role='shell' を除外）

#### NoiseGate（implementable / 工数 M） — E17

- 仕様: E17（音声認証扉, thresholds [still, walk, dash], useMic true）「音量帯により接続先カテゴリ変更」。マイク入力（getUserMedia）の音量で開く扉を分岐。許可が無い端末では移動音量（静止/歩行/ダッシュ/ジャンプ）で代替（A4 確定）。
- 方針: レイアウト post-pass: GenericRoom の前進壁に 3 枚の扉ソケット（gate0/1/2）を並べ、それぞれ上に「静」「歩」「走」のサインと、中央に音量メーター LabelSpec(id='meter') を置く。onConnect: 3 扉は通常どおり物理接続するが PickOptions を帯ごとに変える（still→RoomGenerator の小部屋優先、walk→CorridorGenerator、dash→Parking/Grid/Atrium の大空間優先 = 接続先カテゴリ変更）。update（E17 滞在中のみ）: LoudnessSource が現在の帯を返す。マイクは初回のインタラクト（E/タップ = ユーザー操作）で getUserMedia({audio:true}) → AudioContext + AnalyserNode(fftSize 256) の RMS を 10Hz で取得し 3 帯（-50/-30 dBFS 目安、ヒステリシス 0.5s）へ量子化。拒否/未対応/非 HTTPS の場合は移動代替（静止=still、移動=walk、dash 中またはジャンプ後 0.6s=dash）。canOpen(node, gateN): 現在帯 === N なら ok、それ以外は「この扉は開かなそうだ」。メーターは updateLabel で帯を表示（Low Tier は 4Hz）。永続化なし（帯はライブ値）。
- 依存: ModifierHost.canOpen / update, RoomBuilder.updateLabel（CanvasTexture 再描画）, PickOptions の生成器優先度拡張
- 前提: 扉は 3 枚（1 帯 1 扉）。1 扉で接続先を切り替える案は物理配置と両立しないため採らない
- 前提: マイク許可要求は E17 での最初の扉操作時。以後 useMic の結果をセッション内で記憶（localStorage には保存しない）
- 前提: dash 帯の判定はマイク時「大声」、代替時「ダッシュ中 or ジャンプ直後」。静止やジャンプへの反応は A4 のとおり残す
- 前提: 音声アセットは無いため音の再生は行わない（入力のみ）

#### DiscoveryGate（implementable / 工数 S） — M06

- 仕様: M06（100%扉, threshold 100）「探索率100%条件でのみ有効化」。発見済み RoomNode 数が閾値以上のとき扉を解錠。閾値は初期値 100 で調整可（docx Q5 で未決）。
- 方針: レイアウト post-pass: SmallRoom に金色の扉 1 枚（doorMetal + lightWarm 縁）と銘板 LabelSpec(id='plaque') を追加。onConnect: 金扉は mustSucceed 扱いで必ず接続先を配置（Adapter 連鎖→最終手段 Seam）。canOpen: graph.visitedCount >= node.gateThreshold（生成時に params.threshold をノードへコピーして永続化）なら ok、未達は「この扉は開かなそうだ」。onEnter/update: 銘板を updateLabel で「{visitedCount} / {threshold}」に更新（部屋滞在中 1Hz）。解錠後の先は通常抽選の部屋（特別な報酬部屋は D3 により将来）。
- 依存: ModifierHost.canOpen / onEnter, RoomBuilder.updateLabel
- 前提: 閾値は生成時にノードへ固定コピー（後からデータを変えても既存ノードは不変）
- 前提: 銘板に進捗数を表示する（隠さない）
- 前提: 解錠先は通常抽選。図鑑・報酬は将来検討
- 質問: M06 の閾値の決め方 選択肢: A: 固定 100（データ既定値） / B: M06 到達時の visitedCount + 25 の相対値をノードに固定 / C: 固定だがもっと低い値（例 60） 推奨: A（100 固定。Mythic 最低深度 35 との差が『後で戻ってくる』動機になる）

#### FarLink（needsDecision / 工数 M） — M08, M20

- 仕様: M08（不可能なショートカット, minGraphDistance 30）「遠距離ノードへ直接接続」、M20（中央接続室, targetFilter discoveredLegendary, count 4）「既発見Legendaryへ複数直結Portal」。グラフ距離の遠いノードへ Seam Portal で接続（9.2 節）。既発見 Legendary が 0 件のときの挙動は未決（Q5）。
- 方針: onConnect: M08 は前進扉 1 枚、M20 は count 枚の扉を Seam 化（seam=true, projected=false, oneWay=true）。接続先は Portal 単位の BFS（graph.nodes を portals の targetRoomId で走査、Adapter は距離に数えない）で候補を選ぶ: M08 = visited かつ距離 >= minGraphDistance の非 Adapter ノードから fork('farlink') で 1 つ（無ければ距離 >=10、さらに無ければ最遠の既訪、それも無ければ通常接続）。M20 = visited かつ rarity Legendary のノードを距離降順で count 件、足りない分は質問の方針に従う。着地は spawnPointOf(target)（entry 内側）。戻り Portal は無し（既訪部屋は frozen のため開口を追加しない）。地図は「？」+ Map3D の破線で表現済み。M20 の HubGenerator は未実装（LargeRoom 代替 + TODO サイン）なので、扉配置は post-pass で count 枚を確保する。
- 依存: ModifierHost.onConnect / applyLayoutModifiers, Seam 一般化, RoomGraph.bfsDistance(from) の追加, M20: HubGenerator（別クラスタ。無くても LargeRoom 代替で動作）
- 前提: 接続先は既訪（visited）ノードのみ。未探索ノードへは繋がない
- 前提: 一方通行。戻りは無い（Mythic の一方通行許可）
- 前提: BFS は接続確定時に 1 回（数千ノードでもミリ秒オーダー）
- 質問: M20 で既発見 Legendary が count 未満のときの残り扉 選択肢: A: locked（docx Q5 の想定。多くの場合 4 枚全部が施錠） / B: 既発見 Epic 以上 → それも無ければ最遠の既訪ノードへ順に代替 / C: 残りは通常の抽選接続 推奨: B（メタハブとしての体験を常に成立させる）

#### MultiEdge（implementable / 工数 S） — M11

- 仕様: M11（多重扉室, edgeCount 4）「見た目上複数扉だが同一Portal IDを共有」。同一部屋への Portal を複数配置、または 1 Portal を複数の見た目で表現。
- 方針: レイアウト post-pass: AtriumLobby の主扉 exit0 に加え、別の壁面に edgeCount-1 枚の扉ソケット（me1..me3）を placeExits で追加。onConnect: exit0 は通常どおり物理接続（先の部屋 T）。onNodeCreated: me1..me3 の Portal を mirrorOf='exit0', seam=true, projected=false とし、exit0 の接続確定後に targetRoomId=T, targetPortalId='entry' を同期（exit0 が lockOrVestibule に落ちた場合は最初に配置できた扉を主にする）。開閉状態は ownerPortal の解決に mirrorOf を加えて共有（1 枚開けると 4 枚とも開く = 同一 Portal ID）。鏡像扉を開けると短いフェードで T の entry 内側へ着地（T から見ると同じ扉から入ってくる）。ensureNeighbors は seam を飛ばすので物理隣接は増えない。地図: 主扉は通常、鏡像 3 枚は「？」（多重エッジ）。
- 依存: Portal.mirrorOf と portalOpen / ownerPortal の解決拡張, Seam 一般化, applyLayoutModifiers
- 前提: 主扉 1 枚だけ物理、他は Seam。全て同じ部屋 T へ
- 前提: open 状態は主 Portal が持ち、鏡像は参照のみ（既存の isReturn 参照と同じ仕組み）
- 前提: 扉の見た目は同一材質。異なる見た目のバリエーションは後回し

#### DynamicMapNode（implementable / 工数 M） — M03, M07

- 仕様: M03（移動座標室, swapIntervalSec 45）「一定条件でグラフ上の接続先を交換。swap 対象は未探索エッジのみ。戻りエッジと開始点への到達可能性は不変」、M07（動くマップタイル, 20 + MovingWalls）「再配線は未構築・非観測の接続に限定」。論理グラフ上で node edge swap（9.3 節）。
- 方針: onNodeCreated: 戻り以外の前進扉を全て seam=true（閉扉）にし、各扉に pending = {defId, seedTag} を接続確定時に事前抽選して state.modifierState.DynamicMapNode.pending[portalId] に保存。レイアウト post-pass: 各扉の上に電子サイン LabelSpec(id=`sign:${portalId}`) を置き、pending の部屋名（RoomDefinition.name）を表示。update（プレイヤーが部屋内の間だけ計時、swapIntervalSec ごと）: 未探索（targetRoomId 無し）かつ閉かつ非観測の扉が 2 枚以上あれば fork(`swap:${n}`) で 2 枚選び pending を交換、swapCount++、updateLabel でサイン差替え、rewireLog に追記。開扉時の resolveSeamTarget は pending.defId を forceDefinitionId として使う（一度開けた扉は targetRoomId が付き以後 swap 対象外 = 未探索エッジのみ）。戻り扉は対象外なので開始点への到達可能性は不変。M07 は DynamicGridGenerator 未実装のため LargeRoom 代替上で同じ処理を動かし、MovingWalls は別クラスタ。
- 依存: ModifierHost.update / onNodeCreated, RoomStateDiff.modifierState / rewireLog, RoomBuilder.updateLabel, resolveSeamTarget の forceDefinitionId 対応, M07: DynamicGridGenerator / MovingWalls（別クラスタ）
- 前提: swap は目に見える『扉上のサイン』の入替で表現する（接続先の交換をプレイヤーが認識できる唯一の手段）
- 前提: 計時は部屋滞在中のみ。ロード時はタイマーを 0 から再開（経過時間は保存しない）
- 前提: 非観測判定は ObservationRewire と同じヘルパ
- 前提: 地図は未訪問ノードを描かないため、表示地図側の追従処理は不要（Seam 扉は「？」）

### 地図・サイン・UI 系 Modifier（DuplicateNumber / FakeSignage / MapErase / MapRotation / TemperatureField）

共通基盤: 【現状】Modifier は未適用（README「Phase 3 以降で src/modifiers/ に追加」）。文字表示は RoomLayout.labels（LabelSpec 1 件 = 部屋名）だけで、RoomBuilder.buildLabel が 1 ラベルごとに 512×128 の CanvasTexture + Material を作る（= ラベル 1 枚につき 1 draw call・256KB）。ホテル扉番号や倉庫扉番号のように 20〜100 枚のサインを出すと現行方式ではスマホ予算（Low <120 calls）を超えるので、この 5 Modifier の前に次の 3 つの共通基盤を入れる。

(1) ModifierPipeline（新規 /src/modifiers/index.ts）: RoomDefinition.modifiers[]（rooms.json。tools/modifier_params.json と同内容なので rooms.json を正本にする）を読み、部屋単位で 4 つのフックを呼ぶ。
  - onLayout(ctx): WorldManager.layoutFor() 内、generateLayout() 直後・layouts.set() 直前に呼ぶ（Adapter 除く）。ctx = {def, node, params, rng = new Rng(node.seed).fork(`mod:${id}`), layout}。ここで RoomLayout（boxes / lights / signs / anchors）を書き換える。決定論的で、dirty による再生成（直結ソケット追加・穴の蓋）でも同じ結果になる。frozen 後は layout が再生成されないので「入室後に部屋が変わらない」不変条件を自動的に満たす。サイン系は原則ここ。
  - onBuild(ctx + built, world): RoomStreamingManager.ensure() で builder.build() 直後に呼ぶ。この時点では Game.enterRoom → prepareRoom → refreshStreaming の順なので、構築される部屋（現在 + 1 hop）の Portal 接続先・locked は確定済み。接続先の名前を使う案内板（R10）や、locked を除いた出口から温度場を作る（E19）はここ。結果は RoomRuntime（Map<roomId, …>、非永続）に置く。
  - onEnter / onExit(node, world, game): Game.enterRoom の prev / 新 roomId に対して呼ぶ。MapErase のフラグ書き込み、MapRotation の開始・終了。
  - onFrame(dt, game): 現在部屋の Modifier だけ毎フレーム。MapRotation の drift、TemperatureField の HUD サンプリング、U06 の秒針。
  ヘルパー: modifiersOf(def) / hasModifier(def, id, params 部分一致)。既存の layoutHints 参照と同じ流儀で生成器からも参照可（U05 の end ソケット移動など、生成器内で分岐が必要な箇所）。

(2) SignAtlas + SignSpec（新規 /src/render/SignAtlas.ts、/src/generators/layout.ts に型追加）: 数字・英大文字・矢印（←↑→↓）・記号（: . - / F B）・固定の漢字語（出口 階段 非常口 EV 番 号 室 駐車場 ゲート 搭乗 便 行先）を 1 枚の CanvasTexture（High 1024²、Low/Mid 512²）に一度だけ焼き、MaterialLibrary に 'signPlate'（不透明白板）/ 'signEmissive'（非常灯グリーン・LED 赤の発光。emission 付き）として登録。RoomLayout.signs: SignSpec[] = {pos, dir, text, height(m), style: 'plate'|'exitGreen'|'ledRed'|'paint'|'blank', bg?}。RoomBuilder は部屋内の全 SignSpec を 1 文字 = 1 quad（UV はアトラス参照）としてジオメトリ結合し、style ごとに 1 Mesh → 部屋あたり最大 2〜3 draw call、テクスチャ追加ゼロ。既存 labelAtEntry も将来この経路に寄せる。日本語の部屋名など任意文字列が必要な少数の掲示（R10 の案内板 2 枚、U06 のアナログ時計 1 枚）だけは従来の CanvasTexture（1 枚 = 1 call）を許容し、部屋あたり 3 枚を上限にする。

(3) Anchor（/src/generators/layout.ts: RoomLayout.anchors: {kind, pos, dir, id?}[]）: 各生成器が「サインを貼れる場所」を出力する。CorridorGenerator: 'hotelDoor'（偽扉・実扉それぞれ。実扉は socketId 付き）/ 'junction'（セグメントの折れ点）/ 'blankWall'（ソケットの無い壁区間の中央）、ParkingGenerator: 'column'、GridGenerator: 'storageDoor'（StorageGrid の doorMetal fill 1 枚ごと）/ 'mazeGrid'（迷路格子の origin・cell・nx・nz）、RoomGenerator: 'vendingFace'（自販機の前面）/ 'wallBlank'、AtriumGenerator: 'gateCounter'、VerticalGenerator: 'stairLanding'（下階・上階）/ 'elevatorPanel'。Modifier は anchors だけを見てサインを置くので、生成器の内部構造に依存しない。PropRepetition（他クラスタ）が storageDoor を InstancedMesh 化する場合も同じ 'storageDoor' anchor を出してもらえば DuplicateNumber 側は無変更。

(4) DisplayedMap ビュー状態（/src/ui/Minimap.ts の MapView に rotation?: number、roomsOnLevel に hidden 判定）: drawMap / Map3D は既に「訪問済み・配置済み」のみ描く構造なので、除外条件を 1 つ足し、描画前に中心回転を掛けるだけで MapErase / MapRotation が乗る。LogicalRoomGraph（RoomGraph）は一切触らない（9.4 節）。

セーブ: 永続化が要るのは MapErase の「退室済み」フラグだけで、RoomInstance.state.localFlags（RoomGraph.toJSON でノードごと保存済み）に書く。SaveData.version は 1 のまま（追加キーのみ）。それ以外（回転角・温度場・サイン文字列）は seed から再生成、または実行時のみ。

スマホ: サイン結合で draw call は部屋あたり +2〜3 に固定。アトラス 512² は Low で 1MB。地図回転は Canvas 2D の transform のみ。温度場は最大 12×14 セルの BFS を構築時 1 回、毎フレームは配列 1 参照 + HUD テキスト更新（値が変わったときだけ DOM 更新）。ポスト処理・動的ライト追加は使わない。

リスク: ・draw call: 現行の buildLabel 方式（ラベル 1 枚 = CanvasTexture 1 枚 + 1 call）のままサインを増やすと、ホテル廊下 20 枚・トランクルーム 100 枚超で Low Tier の <120 calls とメモリを超える。SignAtlas での結合が前提。
・日本語文字: アトラスは数字・英字・矢印 + 固定の漢字語彙のみ。部屋名などの任意文字列（R10 案内板）は CanvasTexture に限定し、部屋あたり 3 枚を上限にしないと再び call が増える。
・可読性: 0.65× 解像度のスマホで 0.12m の番号板は 3m 以上離れると読めない。文字高の最小値と mipmap 設定（アトラスは LinearMipmapLinear + anisotropy）を実機で確認。
・フック順序: onBuild が「接続先確定後」に呼ばれる保証は Game.enterRoom（prepareRoom → refreshStreaming）の順序に依存する。扉を開けた瞬間の streaming.ensure（interactRay）も 1 hop の部屋なので確定済みだが、将来 2 hop を先行構築するようになると R10 の案内板と E19 の温度場が未確定の Portal を見る。onBuild 側で targetRoomId 未確定を許容（その行はランダム名にする）しておく。
・決定論: onLayout は layout 再生成（dirty）のたびに同じ rng（node.seed fork）で走るので結果は同じだが、生成器が anchors を出す順序が変わると番号の割当が変わる。anchors は座標でソートしてから使う。
・frozen 不変条件: サインは layout に属するので現在部屋では変わらない。onFrame で動かすのは U06 の秒針と MapRotation の角度・E19 の HUD だけで、ジオメトリや接続は変えない。
・TemperatureField の locked 扉: layout 時点では locked が未確定なので、照明の寒暖振り分け（onLayout）は施錠扉も出口として数える。温度場本体（onBuild）は locked を除くため、稀に「暖色灯の先が施錠扉」になる程度の不整合が残る。
・MapErase と Map3D: roomsOnLevel の除外で自動的に消えるが、M02 が visitedLevels の唯一の部屋であるフロアでは、そのフロアのタブだけが残って空になる。visitedLevels も同じ除外を通す。
・PropRepetition との重なり（R20）: 扉が InstancedMesh 化されると個別の doorMetal fill が無くなるため、'storageDoor' anchor を PropRepetition 側が出す取り決めが必要。
・U05 の end ソケット移動は生成器の変更なので、既存 seed での U05 の形が変わる（セーブ互換は保たれるが、同 seed の見た目は v1.2 データ更新として扱う）。

#### DuplicateNumber（implementable / 工数 M） — U02, U16, R20

- 仕様: サインの番号を重複（U02 duplicateRate 0.5、R20 0.3）/ 欠番+重複（U16 mode skipAndDuplicate）させる。U02 は「同一番号の扉 2 つが別部屋へ接続」、U16 は「番号列が接続方角のヒントになるが一部欠落」、R20 は大量反復扉の一部が同番号。実装方式はテキスト/デカール差替え、負荷: 低。
- 方針: onLayout フック（決定論。layout 再生成でも同結果）。
・U02 CorridorHotel: CorridorGenerator.decorate の偽扉 wallBand と実扉ソケット（exit*, x*）に 'hotelDoor' anchor を出し、廊下に沿って連番（例 4F → 401, 402…。階は rng）を振ってから、duplicateRate の割合で他の扉の番号に置換。実扉（entry 以外の door ソケット）が 2 枚以上あれば必ず 1 組は同番号にする（接続ルール）。1 枚しか無ければ実扉の番号を偽扉 1 枚にコピー。番号板は扉上 2.15m、高さ 0.12m の 'plate' SignSpec。
・U16 ParkingGrid: ParkingGenerator の柱ごとに 'column' anchor。ランプソケット（'ramp0'）へ向かう軸で番号が増える区画コード（例 B3-01, 02, 04, 04, 06）を生成し、skip 20% / duplicate 20%（seed 固定）。柱の 2 面に 'paint' スタイル（黄帯の上、高さ 0.35m）。
・R20 StorageGrid: GridGenerator.shelves の StorageGrid fill（doorMetal）1 枚ごとに 'storageDoor' anchor（PropRepetition 実装後はそちらが出す）。ユニット番号（A-101…）を通路順に振り、30% を他ユニットの番号に置換。上限 160 枚。全てアトラス結合なので draw call は +1。
HUD・地図・接続には影響しない（サインだけが嘘をつく）。
- 依存: ModifierPipeline.onLayout, SignAtlas + SignSpec, Anchor（hotelDoor / column / storageDoor）, PropRepetition（R20。無くても fallback 可）
- 前提: 番号は部屋 seed から決定論的に生成し、セーブしない（layout と同様に再生成）。
- 前提: U02 の重複ペアは「entry 以外の実 door ソケット」から優先して作る。実扉が 1 枚のときは偽扉と重複。
- 前提: U16 の欠番率・重複率は各 0.2（params に無いので既定値）。番号の増加方向はランプ出口へ向かう軸。
- 前提: R20 の番号は PropRepetition が未実装でも現行の doorMetal fill を扉と見なして付ける。
- 前提: 文字は数字・英字・ハイフンのみ（アトラスで足りる）。

#### FakeSignage（needsDecision / 工数 L） — U04, U05, U06, U17, R10, E15, E16

- 仕様: 接続先とサイン表示を別抽選する。mode ごとに: blank = ラベル空白（U04 商品ラベル、U17 名札）、misleading = 誤誘導（U05 EXIT 標識が壁、R10 存在しない便名の案内板、E16 案内表示の 70% が虚偽）、fixedTime = 全時計 3:17（U06）、fractional = 小数階表示 4→4.1→4.11（E15）。負荷: 低。
- 方針: 1 Modifier だが mode/target ごとに小さな適用関数に分ける（/src/modifiers/FakeSignage.ts 内 switch）。
・U04 blank/productLabel（onLayout）: RoomGenerator SmallRoom の自販機（現行 1 台）を 2〜4 台に増やし、'vendingFace' anchor に商品ラベル格子（style 'blank' = 白無地の小板 4×5 枚）と価格帯（空白）を貼る。装飾のみ。
・U17 blank/nameTag（onLayout）: LargeRoom に patternPartitions でブース列を作り、各ブース前の机（patternRows）に 'blank' の名札小板、ブース上部に無地バナー。装飾のみ（v1.1 で収集廃止）。
・U05 misleading/exitSign: CorridorGenerator 内で hasModifier(def,'FakeSignage',{target:'exitSign'}) のとき end ソケットを最後のセグメントの側壁へ移す（真の出口は別壁）。onLayout で末端壁（ソケット無し）に 'exitGreen' の EXIT サイン + 開かない偽扉（wallBand の doorMetal 板、コライダあり）。照明は既存 palette（非常灯 → 低照度）。
・E16 misleading truthRatio 0.3（onLayout）: 'junction' anchor と各セグメント中央に天井吊りの案内板（例「→ 出口」「← 階段」「↑ EV」）。矢印方向は rng で、確率 truthRatio でその方向に実出口ソケットがある向き、それ以外はソケットの無い向き（壁 / 戻り方向）。虚偽方向の壁には偽扉を 1〜2 枚追加して説得力を持たせる。
・R10 misleading/flightBoard（onBuild。接続先が必要）: Terminal の 'gateCounter' 上のパネルをゲート標識（A, B, C…= 出口ソケット順）にし、コンコース中央に出発案内板 2 枚（CanvasTexture、1024×512、1 枚 1 call）。行: 便名（架空 LM 4471 等）/ 行先 / ゲート。行先は truthRatio（既定 0.5）で実接続先 RoomDefinition.name、残りは ROOMS からランダムな名前。ゲート列も半分だけ正しい。node.portals は構築時点で確定済みなので再構築でも同じ内容。
・U06 fixedTime 3:17（onLayout + onFrame）: 待合室の壁 2〜4 箇所に 'ledRed' デジタル時計「3:17」（アトラス）と、アナログ時計 1 枚（CanvasTexture の文字盤 + 針は細い box 2 本を 3:17 で固定）。onFrame で秒針 1 本だけ回す（Mesh の rotation 更新のみ）。「3:17 相当イベントで出口解錠」は下記質問。
・E15 fractional/floorLabel（onLayout）: VerticalGenerator の 'stairLanding'（下階・上階）と 'elevatorPanel' anchor に階表示。基準階 n を rng（2〜9）で選び、下階「n」、上階「n.1」、上階扉上「n.11」、エレベーター籠側「n.11」。ミニマップ・HUD のフロア名（1F/B1F）は変えない（地図は正確、D6）。
全体: 生成器側の変更は anchor 出力と U05 の end ソケット移動のみ。frozen 後の変化なし（U06 の秒針は見た目のみ）。
- 依存: ModifierPipeline.onLayout / onBuild / onFrame, SignAtlas + SignSpec（漢字語彙: 出口 階段 非常口 EV ゲート 便 行先 を含める）, Anchor（vendingFace / wallBlank / junction / blankWall / gateCounter / stairLanding / elevatorPanel）, MaterialLibrary に 'signPlate' / 'signEmissive'（EXIT 緑・LED 赤）追加
- 前提: E16 の params に target が無いので 'directionSign'（案内板）扱い。E16 では truthRatio 0.3、R10 では既定 0.5、U05 では 0（必ず壁）。
- 前提: R10 の行先は実接続先の定義名を混ぜる（接続ルール「案内板の行先が実接続候補」）。便名は全て架空。
- 前提: U05 は end ソケットを側壁へ移し、末端は EXIT + 開かない偽扉（施錠扉と同じ「この扉は開かなそうだ」ヒントを出す。鍵なし）。
- 前提: E15 は看板だけが小数階を示し、ミニマップのフロア表記は実際の階のまま。
- 前提: U04 / U17 は純装飾（収集・接続への影響なし）。
- 前提: 案内板・時計盤など任意文字列は部屋あたり最大 3 枚の CanvasTexture、それ以外はアトラス結合。
- 質問: U06「3:17 相当イベントで出口候補が 1 つ解錠」を実装しますか。 選択肢: A. 実装しない。時計を 3:17 に固定する装飾のみ（施錠扉は鍵なしで塞いだだけ、という決定と整合） / B. 入室から 3 分 17 秒経過で、部屋に残っている施錠扉 1 枚を解錠し、その先の部屋を配置する（時限イベント基盤が新規に必要。現在部屋の隣に部屋が増えるが部屋自体の形は変わらない） 推奨: A

#### MapErase（implementable / 工数 S） — M02

- 仕様: M02 未記録室（SmallRoom）。退出後、通常マップからそのノードを非表示化する（hidePolicy: self）。LogicalRoomGraph は変更せず DisplayedMapGraph だけ消す（9.3 節）。
- 方針: onExit（Game.enterRoom で prev が M02）で prev.state.localFlags.mapErased = true を書く。Minimap.roomsOnLevel（drawMap と Map3D の両方が使う）に「localFlags.mapErased かつ currentRoomId でない」ノードを除外する条件を足す。Map3D のフロア間接続線もこの関数経由なので自動的に消える。隣室側の扉マーカーは残る（扉はあるが部屋は記録されない）。再入室中は破線の外形とプレイヤー矢印だけ描き、退室で再び消える。visitedCount・discoveredIds は変えない（進行は発見数のみ、D3）。永続化は localFlags 経由で既存セーブに乗る。ホール等で M02 に落ちた場合も同じ。
- 依存: ModifierPipeline.onExit, RoomInstance.state.localFlags（既存・保存済み）
- 前提: 非表示は最初の退室以降ずっと（再訪しても記録されない）。中にいる間だけ破線表示。
- 前提: 隣室の扉マーカーは残す。「？」は付けない（Seam ではない）。
- 前提: 発見数は減らさない。

#### MapRotation（needsDecision / 工数 S） — M19

- 仕様: M19 方位破壊区画（GenericCorridor）。ミニマップの北とワールド北を回転ずらしする（angle 90, drift true）。DisplayedMapGraph のみ。地図の北は通常ワールド北固定で、M19 だけ表示回転を許可（9.4 節）。
- 方針: onEnter で開始、onFrame で角度を更新、onExit で戻す。角度 = angle + drift（sin 波 ±25°、周期 30 s。drift=false なら固定）。入退室時 0.6 s でイーズ。Game.step の drawMap 呼び出しに view.rotation を渡し、drawMap はミニマップ中心（プレイヤー位置）を軸に ctx.rotate してから部屋・扉・矢印を描く（矢印は同じ変換内なので相対関係は保たれる）。フロア名ラベルは回転外。メニューの全体マップ（MapPanel.draw）と Map3D（content グループの rotation.y）にも同じ角度を渡し、M19 にいる間だけ回転する。永続化なし。
- 依存: ModifierPipeline.onEnter / onFrame / onExit, MapView.rotation（Minimap / Map3D）
- 前提: drift は「角度がゆっくり揺れ続けて定まらない」表現（±25°/30 s）。連続回転は酔い対策で避ける。
- 前提: フロア名・発見数などの HUD 文字は回転しない。
- 前提: LogicalRoomGraph / mapCell / セーブは触らない。
- 質問: M19 の地図回転は、どの範囲に効かせますか。 選択肢: A. M19 にいる間だけミニマップ・全体マップを回転し、退室で元に戻る（保存なし） / B. M19 を一度通ると、そのワールドの地図北が以後ずっと 90° ずれたまま（RoomGraph に回転オフセットを保存。複数回で累積） / C. M19 のセルだけ mapCell.rot=90 で回して描き、周囲とかみ合わない見た目にする（全体は回さない） 推奨: A

#### TemperatureField（implementable / 工数 M） — E19

- 仕様: E19 温度座標迷宮（MazeGrid）。温度スカラー場が方角情報になる。セルごとの温度値 + UI/音。照明プリセットは「寒色→暖色」。params なし。
- 方針: onBuild（locked を除いた実出口が確定している時点）で、GridGenerator が出す 'mazeGrid' anchor（origin, cell, nx, nz と壁配列）上で BFS を行い、entry から遠く・有効出口（isReturn でない、locked でない door）に近いほど高温になる場 T(cell) を作る（出口 30℃、入口 8℃、迷路の経路距離で線形）。Float32Array（最大 12×14）を RoomRuntime に保持（非永続。再構築時に再計算）。onFrame で現在部屋が E19 なら player.pos を toLocal してセル参照し、HUD の温度表示（新規 #hud-temp、0.1℃ 単位、値変化時のみ DOM 更新）と画面端の薄い色被せ（CSS div の背景色を青→橙、opacity 0.06〜0.1。ポスト処理不使用）を更新。照明: onLayout で lightGrid の各灯を、出口ソケットへの距離に応じて 'lightPanel'（寒色、PointLight 色 0x9fc8ff）/ 'lightWarm'（暖色 0xffd9a0）に振り分け、迷路内の見た目にも勾配を作る。音は AudioEngine とアセットが無いため今回は対象外（将来 WebAudio のオシレータで温度に応じてハム音のピッチを変える余地を残す）。
- 依存: ModifierPipeline.onLayout / onBuild / onFrame, Anchor（mazeGrid: 迷路格子と壁配列）, RoomRuntime（構築時の派生データ置き場）, AudioEngine（任意・将来）
- 前提: 熱源 = 進行方向の有効出口（複数なら全て等価）、冷点 = 入口。数値は 8〜30℃。
- 前提: UI は HUD の数値 + 薄い色被せの両方。ポスト処理・追加ライトは使わない。
- 前提: 音は実装しない（アセット・AudioEngine なし）。
- 前提: 場はセーブしない（構築時に決定論的に再計算）。

### 音響システム全体 + 音系 Modifier（AudioEvent / FutureAudio）

共通基盤: (1) AudioEngine 単一インスタンス（新規 /Users/tashi/Documents/プログラミング/pro_Liminal/src/audio/AudioEngine.ts）。Game が所有し、AudioContext・master/ambient/sfx の 3 バス・リバーブ send・リスナー同期・ボイス予算（tier low 8 / mid 12 / high 20。rules.json performanceBudget「音」行に準拠）を一元管理する。Modifier や Generator はこの API しか触らない。(2) 部屋単位の Modifier 適用フック（他クラスタと共通。新規 src/modifiers/ModifierRuntime.ts）: onRoomEnter(node, layout, built) / onRoomExit / onBuilt / update(dt)。Game.enterRoom（現行 /src/game/Game.ts:128）に prev/next を渡す 1 か所の呼び出しを追加し、AudioEvent・AmbientCarryover・NoiseGate・EraPreset がここに乗る。(3) プレイヤー状態の公開: PlayerController に「歩行距離の累積 / 着地エッジと着地速度 / 現在の移動ランク(still|walk|dash|jump)」を追加。足音と E17 NoiseGate のマイク代替（移動音量）が同じ値を参照する。(4) 設定の永続化モジュール（新規 src/settings/Settings.ts、localStorage 'liminal.settings.v1'）: 音量 3 種に加え、他クラスタの視点感度・品質 Tier 手動値・言語も同じ器に入れる。(5) 効果音イベントログ（AudioEngine 内の 60 秒リングバッファ: kind, pos, t）: FutureAudio（保留）と E12 PastWindow「遠い過去音」、M10「逆再生環境音」が共有する。(6) RoomGraph に prevRoomId / 訪問順（visitedOrder）を保存: M18 AmbientCarryover の source=lastVisited、および遷移時のクロスフェード元の特定に使う（現行 Game.enterRoom の prev はローカル変数のみ）。

リスク: (1) iOS Safari: AudioContext が通話・他アプリ・ロック解除で 'interrupted' になり無音のまま復帰しないことがある。visibilitychange/focus/pointerdown での resume 再試行を必須にし、実機で確認が必要。(2) ConvolverNode の CPU: RT60 4 s（約 190k サンプル×2ch）は低価格 Android で 1 コアの数割を使う可能性。tier low はフィードバックディレイ版へ自動切替する設計にしたが閾値は実機計測待ち。(3) ノイズ系レイヤーを部屋ごとに 3〜5 本 + 隣室分も持つと 1 hop で 10 本を超え、tier low の予算 8 に収まらない。隣室の環境音は「扉中心に置く 1 本のミックス（lowpass 済み）」に畳む前提で、AmbientMixer の設計時に確定させる。(4) フォルマント合成の「声」は不気味の谷に落ちやすく、U19「遠い笑い声」や館内放送を明瞭に聞かせたい意図があればアセット提供が必要（アセット方針の質問）。(5) 決定論: 環境音・足音の乱数は Math.random とし、RoomGraph の決定論（seed）とは分離する。beacon の Portal 選択だけは Rng fork で決定論にする。(6) PannerNode/AudioListener の AudioParam（positionX 等）は Safari 14.1 以降のみ。それ以前は setPosition フォールバック。(7) 扉音と閉扉判定: updateDoors は angle をフレームごとに補間するため「閉じ切った瞬間」の検出は angle が 0 に到達したフレームのエッジで行い、同一フレームで複数扉が閉じるケースも 1 音ずつ鳴らす（ボイス予算内）。(8) FutureAudio は D8 に基づき実装しない。復活要望が出た場合は予測系演出の再判断が先。

#### AudioEngine 基盤（implementable / 工数 L）

- 仕様: 仕様書 12 章: 環境音は AudioPreset 化し、空調・蛍光灯ハム・水滴・風・遠い放送等を複数の低負荷ループで合成する。音源は距離減衰させ、聞こえない Room の AudioNode は停止。性能予算は同時発音 8〜12 / 12〜20 / 20〜32。17.4 メニューに音量設定。音声アセットは存在しない。
- 方針: 新規 src/audio/AudioEngine.ts, src/audio/Synth.ts（レイヤー工場）, src/audio/AmbientMixer.ts。グラフ: AudioContext → masterGain → destination。masterGain の手前に ambientBus / sfxBus / reverbReturn の 3 GainNode。全レイヤーは共有ノイズバッファ 1 本（4 秒ピンクノイズ AudioBufferSourceNode loop）を BiquadFilter + Gain + 必要なら LFO で色付けする構成（hvac=ノイズ lowpass 250Hz + 遅い LFO, fluorescent=100/120Hz 矩形波 + 高域ノイズ, refrigerator=60Hz sawtooth lowpass + ランプ, など）。API: play(kind, {pos?, loop?, gain?, pitch?, reverbSend?, priority?}) → Handle{stop(fadeSec), setGain, setPos}。setRoom(node, layout, prevNode) が環境音・リバーブを切替。setListener(camera) を Game.step 末尾で毎フレーム呼ぶ（AudioListener.positionX/forwardX 等の AudioParam。無い Safari 旧版は setPosition/setOrientation にフォールバック）。autoplay: AudioContext は Game.onStartClick（/src/game/Game.ts:363、ユーザージェスチャ内）で生成 + resume。iOS の 'interrupted' 対策として visibilitychange/focus/pointerdown で state !== 'running' なら resume を再試行。document.hidden で ambientBus を 0 にフェード。ボイス予算超過時は優先度（現在部屋の環境音 > 足音/扉 > beacon > 隣室環境音 > oneShot）の低いものから stop。音量 UI: index.html の #menu に master / 環境音 / 効果音 の range 3 本を追加し Settings に保存、AudioEngine.setVolumes に反映。テスト用に window.game.audio を公開し、game.audio.debug() で有効ボイス数と現在レイヤーを出す。
- 前提: 音声ファイルは一切使わず、全音を WebAudio の手続き合成で作る（アセット方針の項で拡張余地を残す）
- 前提: 音量スライダーは master / 環境音 / 効果音 の 3 本。既定 0.8 / 1.0 / 1.0。ミュート切替はスライダー 0 で代替
- 前提: タブ非表示時は環境音を 0 にフェードし AudioContext は suspend しない（復帰時のクリック音を避ける）
- 前提: PannerNode は panningModel 'equalpower'、distanceModel 'inverse'、refDistance 2 m、maxDistance 40 m。HRTF はモバイル CPU 負荷が高いため使わない
- 前提: 同時発音上限は QualityTier に連動（low 8 / mid 12 / high 20）。auto Tier 昇降と同時に更新
- 前提: AudioContext の生成は開始オーバーレイのクリック/タップに限定し、メニューには「音が出ない場合はタップ」等の案内を出さない（自動再試行で足りる想定）

#### audioPreset 写像（implementable / 工数 M） — C17, E02, E12, E17, M08, M10, M18, M20

- 仕様: rooms.json の audioPreset は 118 部屋で 107 種の日本語ラベル（「空調」5、「駆動音」3 などの重複を除く）。「・」区切りで複数音源、「→」で時間変化、「遠い」「静かな」「微かな」「幻聴」で距離・音量・確率の修飾。仕様書 5 章: 照明・音の雰囲気は Preset で表現し Modifier にしない。
- 方針: 新規 src/audio/presetMap.ts にキーワード表（約 70 語 → 約 55 レイヤー ID）を置き、ラベルを「・」「→」で分割して各断片を先頭一致するキーワードでレイヤー化する。修飾規則: 「遠い」= gain -8 dB + lowpass 1.2 kHz + reverbSend 0.7 / 「静かな・微か」= gain -10 dB / 「低い」= 中心周波数を 1 オクターブ下げる / 「幻聴」= ループではなく低確率(20 秒平均)の低音量 oneShot にランダム定位 / 「A→B」= A で開始し 30 秒で B へクロスフェード（該当 1 部屋: 機械音→空調音）/ 「無音に近い・ほぼ無音」= sub_rumble -30 dB のみ + 足音の reverbSend を上げる。試作スクリプトで 107 ラベル中 100 が写像でき、頻度は hvac 37, reverb_tail 8, wind 8, water_flow 6, refrigerator 6, water_drip 6, sub_rumble 6, beep 5, pa_announce 5, clock_tick 4 …。写像できない 7 ラベルはすべて Modifier が音を決めるメタ指定なので、Modifier 側フックで処理する: E02「年代別環境音」→ EraPreset の各年代にレイヤー集合を割当（1960s: radio_hiss+hum_low / 1980s: crt_whine+fluorescent / 2000s: fan_pc+beep / 2020s: hvac 静）、E12「遠い過去音」→ 効果音イベントログの 30 秒前を lowpass + -12 dB で再生、E17「環境音レベル」→ hvac 静 + NoiseGate の音量メーター、M08「接続先環境音混在」/M20「複数環境音の混合」→ FarLink 接続先部屋の preset を各 gain 0.4 で重ねる、M10「逆再生環境音」→ oneShot に逆エンベロープ（急減衰→遅アタック）を掛ける（ループノイズの逆再生は聴感差が無いため）、M18「前階の天候音」→ AmbientCarryover で直前部屋の preset を丸ごとコピー。未知ラベル（今後の追加部屋）は hvac 静 + 体積連動リバーブに落とし world.log に警告。C17 layoutHints 'audioZones' は扉ごとの「漏れ音」= 隣室扉の位置に bgm_muzak を lowpass で置く（Modifier 不要）。
- 依存: AudioEngine 基盤, 部屋単位の Modifier 適用フック（E02/E12/M08/M10/M18/M20 のメタラベル用）, RoomGraph の prevRoomId / 訪問順（M18）
- 前提: ラベル → レイヤーの写像は TS 内の静的表で持ち、rooms.json には新フィールドを追加しない（設計表 xlsx を正本のまま保つ）
- 前提: 写像は文字列一致のみで、部屋 ID ごとの手動上書きは E02/E12/E17/M08/M10/M18/M20 の 7 件に限る
- 前提: BGM 系（低いBGM・微かなBGM・遠いBGM）は 4 和音パッドを lowpass 800 Hz で流す「聞き取れないムード音楽」とし、楽曲は作らない
- 前提: 館内放送・アナウンス系は「不明瞭な声」= フォルマント帯 3 本のノイズ変調 + lowpass + 反響で、言葉として聞き取れない放送音にする（アセット方針の質問で変更可）
- 前提: 「遠い笑い声」「遠い遊具音」は同じフォルマント手法の短い上昇音列 + 高い reverbSend で表現し、露骨な人声にはしない

#### 足音/扉音（implementable / 工数 M） — U08, U13, R01, R14, L02, L09, U07, C19

- 仕様: U08「湿潤区画で歩行音が変化」、C19「換気・反響」、「足音反響」「湿った足音・水滴」等のラベルが足音を前提にしている。扉は E/タップで開閉、通過後 4 秒で自動閉扉、施錠扉は「この扉は開かなそうだ」。stairs/ramp は Adapter、elevator は閉扉 + フェード遷移。
- 方針: 床材は現行の layout.palette.floor（部屋ごとに 1 種。floorCarpetRed/Grey, floorLino, floorTile, floorConcrete, floorWood。/src/generators/presets.ts）から決め、レイキャストしない。Adapter は paletteFrom の床材。ShallowWater / Wetness Modifier を持つ部屋は 'water' / 'wet' バリアントに置換（R01, R14, L02 は water、U08, U13, L09, U07 は wet）。合成: carpet=bandpass 300〜800 Hz 60 ms 小音量 / lino=highpass 2 kHz クリック 20 ms + 500 Hz ボディ / tile=明るいクリック + 長め + reverbSend 0.8 / concrete=bandpass 400 Hz 80 ms + 砂利ノイズ / wood=lowpass 200 Hz の鈍い打音 + 10% で軋み / water=ノイズ lowpass を 4 kHz→800 Hz へスイープ 150 ms + 水滴尾 / wet=lino/tile に water を 40% 混合。トリガ: PlayerController に onGround 中の水平移動距離を累積し、歩行 0.65 m / ダッシュ 0.8 m ごとに 1 歩（左右 ±0.15 の定位交互、ピッチ ±6% ランダム、gain は速度比例）。ジャンプ踏切で擦れ音、着地は着地時の |vel.y| で gain を変える（Hole 落下後は大きな着地音）。PlayerController.update に landedSpeed / strideAccum / moveRank(still|walk|dash|jump) を追加し Game.step から AudioEngine.footsteps.update(dt, player, floorKind) を呼ぶ。扉: Game.interactRay（/src/game/Game.ts:220）で open トグル時に「ラッチ音 + 蝶番の掃引ノイズ 400 ms」、RoomStreamingManager.updateDoors で angle が 0 に到達した瞬間に「閉扉の打音 + ラッチ」、施錠扉ヒント表示時に「ガタつき 2 連クリック」。素材は palette.door（doorWood / doorMetal / glass）で共鳴の色を変える（metal は 1.8 kHz 高 Q の金属リング）。位置は DoorObject.center を PannerNode に渡す。エレベーター: transition 中（280+150 ms）に扉ゴロゴロ音 + モーター低音 0.8 s、到着でチャイム（2 音）。stairs/ramp Adapter は床材同一でピッチをわずかに上げるのみ。移動ランクと着地イベントは AudioEngine.playerLoudness（0〜1）としても公開し、E17 NoiseGate のマイク代替に渡す。
- 依存: AudioEngine 基盤, PlayerController の状態公開（移動ランク・着地速度・歩行距離）
- 前提: 床材は部屋単位（palette.floor）で決め、家具や段差の上でも同じ足音にする。部屋内の局所的な床材差は扱わない
- 前提: 歩幅は歩行 0.65 m / ダッシュ 0.8 m 固定。しゃがみは存在しないので考慮しない
- 前提: 扉音の位置は DoorObject.center。戻り側パネル（isReturn）は所有側の状態に追従するだけなので音は所有側で 1 回だけ鳴らす
- 前提: エレベーターの遷移時間（現行 430 ms）は変えず、音を遷移に合わせて短く作る
- 前提: 足音の乱数は Math.random（ゲーム進行に影響しないため決定論に含めない）

#### 残響（implementable / 工数 M） — C19, U13, U23, R01

- 仕様: layoutHints 'reverbHigh'（C19 地下歩道）と「反響」「足音反響」「広い反響」「巨大反響」「館内反響」「換気・反響」等のラベル約 8 件。仕様書 12 章「同じ素材を違う組み合わせで見せる」の音版として、部屋の広さで残響を変える。
- 方針: 新規 src/audio/Reverb.ts。RoomLayout.bounds から体積 V と表面積 S を取り、Sabine 近似 RT60 = 0.161·V / (S·α) を計算。吸音率 α は palette から（floorTile/Concrete 0.05, floorLino 0.08, floorWood 0.15, carpet 0.3、壁は wallConcrete 0.05 / その他 0.1、天井 ceilingTile 0.3 / その他 0.1）。0.3〜4.5 s にクランプし、'reverbHigh' は ×1.6、ラベルに「巨大反響・広い反響・館内反響」があれば下限 2.5 s。プリディレイ = 最短辺 / 343。実装は ConvolverNode + 手続き生成 IR（指数減衰ホワイトノイズに高域減衰を掛けたステレオバッファ。OfflineAudioContext 不要、Float32Array を直接生成）。IR は RT60 を 5 段階（0.4 / 0.8 / 1.5 / 2.5 / 4.0 s）に量子化してキャッシュし、部屋ごとに再生成しない。部屋遷移は A/B 2 本の Convolver を用意し 1.2 s でクロスフェード（環境音レイヤーも同じ時間で入れ替える。AmbientMixer が現在部屋 = 無定位、隣室 = 扉中心に定位 + 扉が閉じていれば lowpass 600 Hz + -12 dB の「漏れ音」）。tier low では Convolver をやめ 4 comb + 2 allpass のフィードバックディレイに切替える（IReverb インターフェースで両実装を差し替え）。send 量: 足音 0.5〜0.9（床材依存）、扉 0.6、reverb_tail レイヤー 0.7、その他環境音 0.2。
- 依存: AudioEngine 基盤
- 前提: 残響は現在部屋 1 つ分のみ。隣室の音も現在部屋のリバーブを通す（部屋ごとに Convolver を持たない）
- 前提: IR は 5 段階に量子化し、体積の微差では変えない
- 前提: tier low（またはフレーム時間悪化時）は自動でフィードバックディレイ版へ切替え、ユーザー設定は設けない
- 前提: Legendary の巨大空間（MegaStructure。未実装 Generator）は RT60 上限 4.5 s を使い、チャンク単位の残響差は付けない

#### AudioEvent（implementable / 工数 M） — U14, U19, R08

- 仕様: modifiers.json: mode(oneShot|beacon), sound, interval, portalId。「確率再生の一発音、または特定 Portal へ誘導する定常音源」。使用: U14 受話器の上がったオフィス（beacon, phoneRing。portalId 未指定）、U19 無人キッズスペース（oneShot, children, interval 20）、R08 無書籍図書館（oneShot, pageTurn, interval 12）。
- 方針: 新規 src/modifiers/AudioEvent.ts。ModifierRuntime の onRoomEnter で起動、onRoomExit で停止（隣室に居るときは鳴らさない: 扉越しの誘導は beacon のみ、扉が開いていれば -6 dB で継続）。oneShot: 平均 interval 秒（±40% ジッタ）ごとに確率 0.7 で 1 発。位置は部屋 bounds 内でプレイヤーから 3 m 以上離れたランダム点（高さ 1.2 m）、PannerNode で定位。pageTurn = 帯域ノイズの短い掃引 2 回（合成可）、children = フォルマント上昇音列の短い群 + 高 reverbSend（合成は可能だが人声らしさは限定的。アセット方針の質問参照）。beacon: 対象 Portal のソケット世界座標（WorldManager.socketWorld）に高さ 1.2 m でループ音源を置く。phoneRing = 400 Hz 正弦を 16 Hz で振幅変調、1 s 鳴動 / 2 s 休止（日本の呼出音）。portalId 未指定時は「戻り以外・非施錠・行き先未訪問」の出口から部屋 Rng fork('audioEvent') で決定論的に 1 つ選ぶ。プレイヤーがその Portal を通過（enterRoom の prev/next 一致）したら停止し node.state.localFlags.audioEventDone = true を保存（再訪時は鳴らさない）。sound 語彙は src/audio/sfx/ に登録し、未知の sound 名は beep にフォールバックして world.log に記録。
- 依存: AudioEngine 基盤, 部屋単位の Modifier 適用フック, RoomInstance.state.localFlags のセーブ（現行 RoomStateDiff にあり）
- 前提: beacon の portalId 未指定時は「未訪問の行き先を持つ非施錠出口」から決定論的に 1 つ選ぶ。全出口が訪問済みなら鳴らさない
- 前提: beacon は Portal を通過した時点で終了し、localFlags に保存して再訪時は鳴らさない（受話器を置く操作などのインタラクトは追加しない）
- 前提: oneShot の乱数は Math.random（進行に影響しないため）
- 前提: 現在部屋に居る間だけ鳴らし、1 hop 先の AudioEvent は開いた扉越しの beacon 以外は再生しない（ボイス予算のため）
- 前提: U14 の電話プロップ配置はレイアウト側の課題とし、音は Portal 位置に置く（プロップ位置に置く変更は別途）
- 質問: U14 の beacon（電話の呼出音）はどこに置くか 選択肢: A: 誘導先 Portal（進行方向の扉）の位置に置く。データの意図「特定 Portal へ誘導」に忠実。プロップ不要 / B: 部屋内の「受話器の上がった机」プロップの位置に置き、近づくと止まる。Portal 誘導はしない（レイアウトクラスタに電話プロップの追加が必要） / C: 両方（電話プロップから鳴り、取ると次の扉の向こうから鳴り直す） 推奨: A

#### FutureAudio（defer / 工数 S）

- 仕様: modifiers.json: leadSec、「予約再生イベント」。v1.1 で E05「先行音響区画」（次の行動音を数秒前に再生）が欠番になり使用部屋なし。仕様書 5.3 / D8: 予測系演出はオミット、FutureAudio は保留 Modifier として残す。
- 方針: Modifier 本体は実装しない（usedBy 空、D8 で予測系演出を欠番にしているため再質問もしない）。ただし将来復活や E12 PastWindow「遠い過去音」・M10「逆再生環境音」と共有できる下地として、AudioEngine 内に効果音イベントログ（60 秒リングバッファ: kind, pos, roomId, t）を持たせ、play() 呼び出し時に自動記録する。FutureAudio を復活させる場合は「プレイヤーが扉から 3 m 以内に近づいたら leadSec 後に想定される扉音を先行再生」という近接予測に限定した実装になるが、それ自体が予測系演出なので現時点では着手しない。modifiers.json の定義は読み込むだけで、未実装 Modifier 一覧として world.log に出す。
- 依存: AudioEngine 基盤
- 前提: FutureAudio は実装せず、ModifierRuntime に「登録なし → 無視 + ログ」で通す
- 前提: イベントログ（記録側）だけは AudioEngine 基盤に含めて実装する（E12 / M10 が使う）

#### アセット方針（needsDecision / 工数 S） — U19, L07, L16, L19, L20, C17

- 仕様: public/ にはテクスチャのみで音声アセットは存在しない。ラベルのうち人声・楽音・生物音（遠い笑い声 U19、館内放送 L20/L16 系 5 件、古いチャイム L07、遠いピアノ L19、低いBGM 3 件、遠い犬声、鳥声幻聴、虫音 2 件、遠い遊具音、映写機、コーヒーマシン・食器音）は純粋な合成では「らしさ」が限定的。
- 方針: 合成可能性の分類: (a) 合成で十分 — 空調/換気/ファン/ハム/低周波/水滴/水流/波/雨/風/時計/電子音/回線ノイズ/金属音/台車/軋み/紙擦れ/ページ/ノック/シャッター/コンプレッサー/コンベア/昇降機/チャイム（正弦 + 倍音の減衰 2〜3 音）/ピアノ（Karplus-Strong か減衰正弦の和音、遠い前提なら可）/BGM（4 和音パッドを lowpass、ムード音楽として成立）/虫（高域チャープの群）/鳥（周波数スイープの短音、幻聴前提なら可）。(b) 合成だと不気味さに寄る — 笑い声・館内放送・アナウンス・犬声・遊具の歓声（フォルマント合成では「言葉にならない声」になる。リミナルの世界観には合うが、明瞭な人声にはならない）。(c) 実質不可 — 特定の楽曲、明瞭な日本語放送。実装案: src/audio/AssetManifest.ts に sound 名 → {file?: 'audio/xxx.mp3', synth: kind} を置き、ファイルがあれば fetch + decodeAudioData でループ/ワンショットに使い、無ければ synth へフォールバック。これにより今は全合成で出荷し、後からユーザーが CC0 音源（freesound 等、mp3 44.1k mono 10〜20 s、合計 1 MB 以内）を public/audio/ に置くだけで置き換わる。
- 依存: AudioEngine 基盤
- 前提: ファイル形式は mp3（Safari/Chrome/Firefox で decodeAudioData が共通に通る。ogg/opus は Safari で不安定）。mono、ループ素材は 10〜20 s
- 前提: アセットが来ても「遠い」修飾（lowpass + 残響）は合成レイヤーと同じ後処理を通し、質感を揃える
- 前提: Web Speech API（speechSynthesis）は WebAudio に取り込めず定位も残響も掛けられないため館内放送には使わない
- 前提: BGM は権利上の理由で自作パッド合成に限り、既存楽曲は使わない
- 質問: 人声・楽音系（遠い笑い声、館内放送、チャイム、ピアノ、BGM、犬・鳥・虫）の音源をどうするか 選択肢: A: 全て合成。人声は「言葉にならないつぶやき/歓声のようなフォルマント音」で表現し、不気味さを許容する / B: 上記約 10 ラベル分の CC0/自前録音アセットをユーザー側で用意し、public/audio/ に置く（こちらはマニフェストとローダを実装し、届くまでは合成で代替） / C: A で出荷しつつ B のマニフェスト差し替え口を用意する（合成フォールバック付き） 推奨: C

### 未実装 Generator（PoolGenerator / StreetGenerator）: PoolCorridor(R01), StreetGrid(R04, L01, L10, L17, L20), RoadGraph(L15)

共通基盤: (1) RoomLayout.zones の追加（src/generators/layout.ts）: `zones?: { kind: 'water' | 'lane' | 'block'; aabb: AABB; vector?: Vec3; params?: Record<string,unknown> }[]`。PoolGenerator は水域、RoadGraph は車線（進行ベクトル）、StreetGrid は街区（ZoneThemeShuffle のゾーン単位）を書き出す。ShallowWater / ExternalForce / ZoneThemeShuffle の各 Modifier はこれを読むだけにし、Generator と Modifier の責任を「形は Generator、挙動は Modifier」で分ける。Modifier クラスタと合意が必要。
(2) isDoorLike(type) ヘルパー（src/core/types.ts）: 現在 Game.ts / WorldManager.ts / RoomStreamingManager.ts は `p.type === 'door'` を直書きしており、door 以外の Portal は常時開放（閉じられず、可視性 2 hop も dispose も door 前提）。'street' ゲートを閉じられる幅広扉として扱うために `door | street` を door-like に統一する（tryLinkExisting / hasFreeExit / makePortals.open / RoomBuilder.buildDoor のパネル寸法を幅・高さ可変に）。
(3) RoomBuilder のチャンク分割（src/render/RoomBuilder.ts）: 現状は部屋全体を材質ごとに 1 メッシュへ結合するため、64 m 級の部屋は視界外の半分も描く。Box に `chunk?: number` を持たせ（無指定は 0）、チャンク × 材質で結合して個別の boundingSphere を持たせる（three.js の視錐台カリングがそのまま効く）。さらに Game の updateVisibility でカメラ距離 > fog.far + 10 のチャンクを非表示にする。layoutHints 'chunked' の部屋だけ Generator がチャンク番号を振る。MegaStructure / Atrium(Terminal) 系とも共用できる。
(4) 登録の追加: src/generators/index.ts の switch、src/data/index.ts の IMPLEMENTED_GENERATORS（fallback サイン解除）、layout.ts の VARIANTS（PoolGenerator 12 / StreetGenerator 12）、WorldManager.growToFill の対象 Generator 配列と maxDim（Street 64 / Pool 対象外）、presets.ts BASE に PoolCorridor / StreetGrid / RoadGraph のパレット、visualReviewCases.ts への代表ケース追加。
(5) MatId の追加（layout.ts MatId + MaterialLibrary.SURFACES）: 既存 12 テクスチャの流用で `floorAsphalt`（concrete を暗色）、`wallBrick`（wallpaper を赤茶・目地 grid）、`skyDusk` / `skyNight` / `skyOvercast`（diffuser を発光。FakeSky の天井）、`sodiumLight`（diffuser 橙発光）、`windowLit` / `windowDark`（diffuser 発光 / 非発光、薄板）。新規画像は不要。

リスク: (1) 配置成功率: Legendary は深度 20 以降（地上階占有率 0.54）で出るため、60 m 超のバリアントは fits() に落ちて小バリアントか前室連鎖になりやすい。「巨大単室」の体験が実際には 45 m 角に収まる可能性が高い。y を 1 階層ずらして置く（tryPlaceFree 相当）を Legendary だけ許すかは別途判断。(2) 高さ 7–9 m の街区 AABB は上下の階層（±3.6 m）の配置も塞ぐため、周囲の占有率と直結数が下がる。(3) SurfaceLighting の bake は頂点 × (emitter + blocker) の全探索で、64 m 級の部屋に数百の箱があると入室時に数百 ms〜秒単位のスパイクが出る。emitter を街灯に限定し blocker をチャンク内に絞る前提が必須。(4) 既存の door 直書き判定は 4 ファイルに散在しており、'street' のゲート化はヘルパーへの置換漏れがあると「閉じたのに見える / 消えない」不具合になる。(5) FakeSky / FogDepth など描画系 Modifier が未実装の間は、Generator 側の暫定天井材質と palette.fog で見た目を成立させる二重管理になる。Modifier 実装時に Generator 側の暫定処理を外す作業を忘れない。(6) 地図 16 セル打ち切りにより 64 m 超の街区は地図上で欠けて見える（仕様どおりだがプレイヤーには不整合に見える）。(7) 音声アセットが無いため R01 の水音 / L15 の道路音幻聴は未対応のまま。

#### PoolGenerator / PoolCorridor (R01 浅水タイル回廊)（implementable / 工数 M） — R01

- 仕様: タイル + 浅水面の回廊。幅 3–12 m、ソケットは端部 + 分岐、パラメータは水深 / 反射率 / 曲率、モバイルは実反射を避けて簡易水シェーダ。R01 は Rare、door、出口 1–3、「水路交差点に出口」、地図形は曲線 / 直線混在、Modifier ShallowWater{depth 0.25, slow 0.7}。
- 方針: CorridorGenerator の corridorSegments（直線 / L / Z / U の矩形連結）を export して再利用し、形状に 'T' と 'cross'（水路交差点。中間セグメントに直交する矩形を足し、共有辺は footprint が自動で開く）を追加する。幅は snap(rng.float(3, 12))、高さ 3.4–4.2。シェル: floor 'floorTile'、wall 'floorTile'（Restroom と同じタイル壁）、ceiling 'ceilingWhite'。水面: 各 footprint 矩形に対し内側 0.6 m を残した non-solid の 'water' 箱を y 0.02〜depth(0.25) に置く（既存 'water' 材質は opacity .72・UV 微動・SurfaceLighting の blockers から除外済みなのでそのまま使える）。両端 1.5 m は乾いたタイルデッキにして扉前を水から外す。水域 AABB を RoomLayout.zones に kind 'water' として書き出し、ShallowWater Modifier が slow を掛ける（Generator は速度を触らない）。装飾: 壁の腰高ライン（'trim'）、はしご（'metal' 細箱）、床のレーンライン（'wallWhite' 薄板を水面下に）、排水口。照明: lightGrid を 'lightPanel' 間隔 4 m、拡散白色。ソケット: makeEntry + 末端 end + placeExits の side（分岐矩形の端を優先するため wallSpans を分岐矩形で重み付け）。床穴は Corridor と同じく低確率 0.05。バリアント 12 = 形状 6 種 × 長さ 2 段（28 / 18 m）。
- 依存: RoomLayout.zones（ShallowWater Modifier との受け渡し形式。Modifier クラスタと合意）
- 前提: 「曲率」は矩形 footprint で表せないため折れ（L/Z/U/T/cross）で近似する。斜め・円弧は作らない。
- 前提: 床面は y=0 のまま、水は 0.25 m の描画専用ボリューム（プレイヤーは膝下まで水に入る見え方）。掘り込みプールは作らない（ソケット y と段差処理が複雑になる）。
- 前提: 反射率は既存 'water' 材質固定（envMapIntensity .24）。部屋ごとの材質クローンは行わない。
- 前提: R14（浸水学校）/ L02 のように PoolGenerator を使わない ShallowWater は、zones が無い場合に Modifier 側が footprint 全面を水域とみなす。
- 前提: Hole 落下先（ROOMLIKE）には加えない（Corridor 系と同じ扱い）。
- 前提: growToFill の対象外（廊下と同じ）。

#### StreetGenerator / StreetGrid 基本形（R04 屋内住宅街）（implementable / 工数 L） — R04

- 仕様: 道路 + 建物ファサードの街区。標準寸法 1–5 街区、ソケットは交差点 + 入口、パラメータは街路幅 / 建物高さ、遠景建物は HLOD。R04 は Rare、door、出口 1–3、「住宅玄関・路地・階段へ」、地図形は街区グリッド、Modifier FakeSky{dusk}、照明はオフィス天井蛍光灯（屋内なのに街区）。
- 方針: 1 部屋 = 外周を建物ファサードで囲んだ屋内街区。footprint は単一矩形（growToFill 対応のため主矩形から全てを導出する）。寸法モデル: 街路幅 S=6–8 m、島ブロック B=12–16 m、n 街区で 一辺 = n·B + (n+1)·S（n=1: 約 26 m、n=2: 約 45 m、n=3: 約 64 m = 地図 16 セル）。R04 は n=1–2、バリアント 12 = n(2,2,1,1) × 入口位置 3。mainRect が渡された場合は矩形寸法から n と S を逆算する（S を余りで吸収）。高さ 7–9 m（天井は 'skyDusk' 等の発光材質 = 屋内の偽空。天井灯は付けず、街灯ポールと窓明かりを光源にする）。外周ファサード: 部屋の外壁（buildShell）に CorridorGenerator.decorate 方式の wallBand で 2–3 層分の窓帯（'windowLit' / 'windowDark'）、玄関ドア風の偽扉、ひさし、看板を貼る。本物の Portal は外周壁のソケット（placeExits）だけで、扉の向こうの隣室が「建物の中」を演じる。島ブロック: 各 B×B を 1–3 棟（区画分割 rng）の solid 箱建物（高さ 5–8 m、ファサード同様の窓帯・偽扉）で埋め、一部の棟に 2.5 m 奥のエントランス・アルコーブ（歩いて入れる凹み。奥は開かない扉 = 施錠扉と同じ見せ方）を作る。道路: 'floorAsphalt' の床に 'wallWhite' 薄板でセンターライン・横断歩道、縁石（'floorConcrete' 高さ 0.12 = 段差登り 0.35 内）、街灯ポール（'metal' 細箱 + 'lightWarm' 小箱 + LightSpec、交差点ごとに 1 灯）、室外機・ゴミ箱・自販機の小箱。ソケット: makeEntry を南辺の道路端に合わせ（entry x を最も近い街路中心へ snap）、exits は「道路が外壁に当たる位置」= 街路端を優先し、残りをファサードの玄関（DOOR_W）に置く。addAdjacencyLinks / tryLinkExisting で増える extraSockets は buildShell が開口を作るので、ファサード装飾は nearSocket で避ける。clearDoorways で扉前 1.8 m を空ける。Hole は道路上のマンホール（allowHole, 0.1）。
- 依存: MatId 追加（共通基盤 5）
- 前提: 建物内部は別 RoomNode にしない。外周ファサードの扉 = 通常 Portal、島建物 = 見た目のみ（D4/D5 に整合。Rare は Seam 禁止なので島内部を部屋化する手段が無い）。
- 前提: 「1 街区」= 島ブロック 1 個 + 周囲の街路（約 26 m 角）。R04 の最大は 2 街区（約 45 m）。
- 前提: 偽空の天井材質は lightingPreset の正規表現で選ぶ（薄明/夕→skyDusk、夜→skyNight、蛍光/白→skyOvercast）。FakeSky Modifier は skyPreset で上書きするだけ。
- 前提: FakeSky が付かない街区（L17 等）は天井を 'ceilingDark' + 遠い天井灯にし、屋内感を残す。
- 前提: 窓帯は薄い non-solid 箱で、SurfaceLighting の emitter 条件（高さ < 0.3）に当たらないよう高さ 1.0 以上にする（bake 時間の爆発防止）。街灯だけを emitter にする。
- 前提: growToFill の対象に加える（maxDim 64）。天井穴入口のときは成長させない（既存ルール）。

#### StreetGrid Legendary 拡張（L01 永久薄明都市 / L10 夜間郊外住宅地 / L17 無限団地 / L20 永久万博会場）（needsDecision / 工数 L） — L01, L10, L17, L20

- 仕様: 「無限」は有限の巨大街区。1 RoomNode 内部をチャンク分割してストリーミング（D4、layoutHints chunked）。L01/L17 は xl（最大寸法域）、L20 は multiZone。L01/L10 は主 Portal 'street'、出口 2–5。地図は 16×16 セルで打ち切り（Legendary は上限で打ち切り）。Modifier: L01 FogDepth{#2b2f4a, 30–160}、L10 LightingPhase{allWindowsLit}、L17 PropRepetition{apartmentBlock}+ScaleAnomaly{room 1.5}、L20 ZoneThemeShuffle{zoneCount 8}。
- 方針: R04 と同じ StreetGrid 生成器を、レア度 Legendary と hints で拡張する。サイズ表: 通常 Legendary は n=3→2 まで（約 64→45 m）、'xl' は n=4→2（約 83→45 m）。バリアントは大→小の順なので、深度 20 以降の混み合った空間では自然に小さい版へ落ちる（配置失敗→前室→Seam の既存フローに乗る）。'chunked': 島ブロック単位（街路半分を含む B+S 角）で Box.chunk を振り、RoomBuilder がチャンク × 材質で結合、Game が距離で非表示にする。'multiZone'(L20): 各島ブロックをパビリオンとして presets.ts の BASE パレットから乱択した材質セット（壁・窓色・看板色）を割り当て、zones に kind 'block' で書き出す（ZoneThemeShuffle は zoneCount を上書きするだけ）。L10 allWindowsLit: 窓帯を全て 'windowLit' に。L17 apartmentBlock: 島ブロックを分割せず 1 棟の長い板状団地（高さ 12–15 m、5 階層の窓帯、外階段の箱）で埋め、全ブロック同一形状で反復。ScaleAnomaly room 1.5 は Group スケールではなく layout パラメータとして適用（街路幅・建物高さ・階高 ×1.5。worldBounds と当たり判定が一致する）。L01 FogDepth: 天井を 'skyDusk'、街灯を青白く、fog 色を palette.fog に反映。Modifier がシーン fog を上書きする際 far=160 は Tier の fogFar（40/60/90）を超えるので clamp する。
- 依存: RoomBuilder チャンク分割（共通基盤 3）, 'street' Portal のゲート化（次項）, Modifier クラスタ: FogDepth / LightingPhase / ScaleAnomaly / ZoneThemeShuffle / PropRepetition の適用フック
- 前提: Legendary でも 1 RoomNode（D4）。街区を複数ノードのサブグラフにしない。
- 前提: 地図の 16 セル上限は変更せず、64 m 超は打ち切り表示（仕様どおり）。
- 前提: Legendary の最大寸法でも三角形数は 15 万以下を目標（建物は箱 + 窓帯の薄板、街灯は 4 箱）。RoomBuilder は箱面を 1.25 m 刻みで分割するので、大床・大天井は 1 枚で約 8k 三角形になるがチャンク分割で描画対象が半分以下になる。
- 前提: ScaleAnomaly(mode room) / PropRepetition / ZoneThemeShuffle / LightingPhase(allWindowsLit) のうち「形に影響する」パラメータは Generator が def.modifiers を直接読む（GenParams に modifierParams を渡す）。挙動系（fog、速度）は Modifier 側。
- 前提: SurfaceLighting の bake は頂点 × (emitter + blocker) なので、Legendary では blocker を chunk 内に限定する（既存の box-local shortlist を chunk で切る）。
- 質問: Legendary 街区（L01/L17 の xl）の最大規模をどこまで許すか 選択肢: A) 3 街区 ≒ 64 m 角まで（地図 16 セルに収まる。チャンク分割は視錐台カリングだけで足りる。スマホでも安全） / B) 4 街区 ≒ 80–83 m 角まで（地図は打ち切り表示。距離カリングとチャンク単位の bake が必須） / C) 仕様上限の 5 街区 ≒ 100 m 超（MegaStructure と同等の内部ストリーミングが必要。Phase 6 相当の工数） 推奨: A を初回実装の上限にし、共通基盤 (3) のチャンク分割が入った後に xl だけ B へ広げる

#### 'street' Portal 型の扱い（L01 / L10 の主 Portal）（needsDecision / 工数 S） — L01, L10

- 仕様: portalTypes に 'street'（道路の先へ進む）がある。L01/L10 は primaryPortal 'street'、接続ルール「街路交差点 / 建物入口が Portal」。仕様は「ドアだけを特別扱いしない」が、現行コードは door 以外の Portal を常時開放として扱う。
- 方針: 現行: makePortals は `open: type !== 'door'`、portalOpen は door 以外 true、可視性 2 hop・disposeExcept・tryLinkExisting・hasFreeExit も door 直書き。'street' をそのまま出すと「街路端の幅広開口」は閉じられず、隣室（任意の Generator）が常に見え、2 hop dispose が効かない。案 A: 'street' を door-like にする（isDoorLike ヘルパーで door | street を同じ開閉メカニクスに乗せ、RoomBuilder.buildDoor をソケット幅・高さ可変にして 2.2×2.6 m のシャッター / 格子ゲートを描く。E / タップで開閉、4 秒自動閉扉）。街路端の外壁に 'street' ソケット（WIDE_W）を 1–2 本置き、隣室は通常抽選（相手側 makeEntry は type !== 'door' で幅 2.2 の開口を作る = 既存挙動）。案 B: 常時開放の開口のままにし、街路端の外側に暗い前室 Adapter を必ず挟んで見通しを切る。
- 前提: door-like 化しても Portal.type は 'street' を保持し、Minimap は太い開口マークで描く。
- 前提: 'street' で入る隣室側の入口は既存 makeEntry の幅広開口（高さ h-0.3）で成立し、Generator の追加改修は不要。
- 質問: 街路端の 'street' Portal をどう見せるか 選択肢: A) 閉じられる幅広ゲート（シャッター / 格子）。既存の扉ロジック（可視性・自動閉扉・2 hop dispose・直結）にそのまま乗る / B) 常時開放の開口。向こうの部屋が常に見える代わりに、暗い前室 Adapter を必ず挟み、描画常駐が増える 推奨: A

#### StreetGenerator / RoadGraph（L15 屋内高速道路）（implementable / 工数 M） — L15

- 仕様: StreetGrid 派生。車線 + ジャンクション + ランプ、寸法 1–5 区画、ソケットは交差点 + ランプ、遠景は HLOD。L15 は Legendary、主 Portal 'ramp'、出口 2–5、「ランプ分岐を Portal として扱う」、地図形はジャンクション、Modifier ExternalForce{conveyor 6.0}（高速移動は車線の動く床として表現）、照明ナトリウム / LED、chunked。
- 方針: 街区グリッドではなく、CorridorGenerator の矩形連結を太くしたジャンクション形状にする。本線: 幅 7–8 m（2 車線 3.5 m + 路肩）、長さ 40–70 m、高さ 5.5 m（'ceilingDark' + 'sodiumLight' の天井灯列）。分岐: 本線の途中から直交 / 斜め代替の T 字・Y 字近似（矩形連結。Z 形で斜めを表す）を 1–3 本。各矩形端の外壁に 'ramp' ソケット（WIDE_W、高さ h-0.3）を置き、WorldManager の既存フロー（部屋発 stairs/ramp → 3.6 m 昇降の ramp Adapter → その先は必ず部屋）をそのまま使う。ramp Adapter は幅 3.0 固定なので「1 車線の出口ランプ」として見える（本線 7 m から 2.2 m 開口へ絞る絞り込み路肩を 'floorConcrete' 縁石で作る）。入口も 'ramp'（makeEntry が幅 2.2・高さ h-0.3 の開口を作る）。路面: 'floorAsphalt' + 車線の白線・矢印（薄板）、中央分離帯（'floorConcrete' 高 0.8、solid）、ガードレール（'metal'）、案内標識（'wallGreen' 板 + LabelSpec）、停止した車（ParkingGenerator の車箱を流用）。車線ごとに zones kind 'lane'（AABB + 進行ベクトル、speed）を書き出し、ExternalForce Modifier が PlayerController.external に加算する（Generator は速度を触らない）。chunked: 矩形（本線セグメント / 分岐）単位で Box.chunk。RoadGraph は「屋外風」ではなく暗いトンネル型なので偽空は使わない。
- 依存: RoomLayout.zones（ExternalForce Modifier との受け渡し）, RoomBuilder チャンク分割（共通基盤 3。無くても動作はするが 70 m 本線は全描画になる）
- 前提: ランプ分岐は既存の ramp Adapter（幅 3.0、3.6 m 昇降）を再利用し、専用の車道ランプは作らない。
- 前提: 本線の高低差（立体交差）は作らない。全て同一 y の平面ジャンクション。
- 前提: 対向車線の動く床は逆向きベクトル。中央分離帯で分ける。
- 前提: hasFreeExit は door / stairs / ramp のみ数えるので、RoadGraph の出口は全て 'ramp' でよい（追加改修不要）。
- 前提: growToFill の対象外（廊下型）。

#### Hole 落下先としての Street / Pool（ROOMLIKE_GENERATORS）（implementable / 工数 S） — R04, L01, L10, L17, L20

- 仕様: Hole は真下に天井穴付きの部屋を物理配置する（A3）。落下先の抽選は ROOMLIKE_GENERATORS（Room / Parking / Grid / Atrium）に限定されており、天井穴入口（makeEntry type 'hole'）を扱える Generator だけが対象。
- 方針: StreetGenerator は単一矩形 footprint で makeEntry(hole) → ceilingHole を偽空の天井に開ける形にし、ROOMLIKE_GENERATORS に追加する（空の穴から街に落ちる演出）。着地点は道路上に来るよう、hole 位置（rect0 の 30% 点）が島ブロックに重なる場合はそのブロックの建物を削って小広場にする。tryPlaceBelow は部屋全体の AABB が地下に収まる必要があるので、街区は小バリアント（n=1 約 26 m）で置かれることが多い。growToFill は天井穴入口では走らない（既存）。PoolGenerator は廊下型で CorridorGenerator と同じ扱いにし、追加しない。
- 依存: StreetGrid 基本形
- 前提: Street を ROOMLIKE に追加、Pool は追加しない。
- 前提: 高さ 7–9 m の天井からの落下（約 9 m）はダメージ無し（D1）。既存の vel.y クランプ -25 で問題ない。
- 前提: Legendary の街区が Hole 先に選ばれるのはレア度抽選の結果次第で、Generator 側で制限しない。

### 未実装 Generator: MegaStructureGenerator（MegaAtrium / MegaHall、Legendary 10 部屋）

共通基盤: 【結論: 1 定義 = 1 RoomNode + 1 RoomLayout を維持し、分割は RoomBuilder / Streaming 側で行う（D4・16.1 準拠）】

■ 比較（1 RoomLayout 内部チャンク vs 複数 RoomNode サブ部屋）
- 案 A: 1 RoomNode。RoomLayout はこれまで通り純データ 1 つ（箱 5,000〜15,000 個）。RoomBuilder が bounds を 24 m 格子（低 Tier は 32 m）のチャンクに切り、チャンクごとに材質結合 Mesh を作る。利点: 仕様 D4/16.1 に一致、扉を開けた先に 100 m の見通し（Legendary の価値）が成立、WorldManager の接続・凍結・保存・detectRoom（AABB 判定）が無改修で動く、発見数 1 の意味が明確。欠点: RoomBuilder に「チャンク単位の生成・破棄・距離カリング」と「時間分割ビルド」が必要（現状 build は同期・材質ごと 1 Mesh で、部屋全体が常にフラスタム内 = 200 m 分を毎フレーム全描画）、地図が 1 セル塊になる。
- 案 B: 複数 RoomNode（ゾーン = 部屋、橋 = 廊下）を 1 定義から一括生成。利点: 既存ストリーミング・地図・コライダ・発見数がそのまま、1 ノードのメッシュ量が小さい。欠点: 仕様が明示的に禁止（16.1「Legendary を複数ノードのサブグラフとして実装する」）、ゾーン間が扉で閉じるため巨大空間の見通しが消え「大きい普通の部屋の連なり」になる、配置が 1 hop ずつ進むので Legendary 抽選 1 回で他レア度の部屋が割り込む、visitedCount がゾーン数だけ増えバランスが変わる。
- 推奨: 案 A。ただしレイアウトに `zones[]`（矩形 + 階 + 用途タグ + テーマ）を持たせ、チャンク分割・地図の内訳表示・Modifier のゾーン適用（ZoneThemeShuffle / SurfaceFriction zone / audioZones）の共通の受け皿にする。

■ 共通基盤（このクラスタで先に作るもの。他クラスタ [Modifier: InstanceOvergrowth, VehicleRide, FogDepth 等] とも共有）
1. RoomBuilder チャンク化（src/render/RoomBuilder.ts, src/streaming/RoomStreamingManager.ts）: layout.boxes をチャンク格子に振り分け、チャンクごとに `THREE.Group`（材質別 Mesh）+ 境界球を持つ。プレイヤー距離 > tier.fogFar + チャンク対角で `visible=false`、> fogFar + 2 チャンクで dispose、近づいたら再ビルド（ヒステリシス）。コライダ（AABB）はチャンクに関係なく全量保持（1 万個 ≒ 0.5 MB、PlayerController.broadphase は単純比較なので許容）。通常部屋はチャンク 1 個に収まるので挙動は変わらない。
2. 時間分割ビルド: 現状 `ensure()` が同期で SurfaceLighting.bake を回す。bake は頂点数 × 発光パネル数（14 m カットオフはあるがループは全件）で、200×100 m ホール（頂点 30 万・パネル 800）だと数秒〜10 秒の停止になる。対策: (a) 発光体・遮蔽体を 8 m 格子でインデックス化しチャンク近傍だけ参照、(b) 入口周辺チャンク（入口から 2 チャンク）だけ同期、残りは rAF 1 フレーム 4 ms 上限のジョブキューで近い順に作る。1 hop の部屋は扉が閉じた状態で作られるので余裕がある。
3. buildShell の階対応（src/generators/footprint.ts）: `Opening` に y を追加し、上階ソケット（pos.y = 3.6k）の開口を該当階の高さだけ切る。現状は y を無視して床から切ってしまう（VerticalGenerator は私設 wallX で回避している）。MegaAtrium の回廊出口に必須。
4. 巨大部屋の配置（src/world/WorldManager.ts）: `VARIANTS.MegaStructureGenerator = 16`（サイズ 4 段 × 入口位置 4: 辺中央 / ±1/4 / 角寄り）。全バリアント失敗時は前室 Adapter + Seam（Legendary は Epic 以上なので許可）で `tryPlaceFree` に広域探索（xz ±60/120/240 m、y ±1〜6 階）を追加して置く。`growToFill` の対象外にする（現状の allowlist に無いので既定で除外）。`addAdjacencyLinks` の上限を Mega だけ 4 本に。`IMPLEMENTED_GENERATORS` に追加。
5. 地図（src/core/types.ts MapCell, src/map/GridProjector.ts, src/ui/Minimap.ts, Map3D.ts）: `MapCell.levelSpan?: [min,max]` を追加し、多層の部屋は範囲内の全フロアに描く（上階の出口先が宙に浮かない）。MAX_CELLS は Legendary だけ 80（320 m）に緩和し、`zones[]` を薄い内訳線として描く（下記 Q2）。
6. RoomLayout 拡張（src/generators/layout.ts）: `zones?: {id, rect, level, tag, theme?}[]`, `instances?: {mat, kind:'blade'|'box', size, transforms[]}[]`（InstancedMesh。L03/L14 と Modifier InstanceOvergrowth・PropRepetition で共用。RoomBuilder に InstancedMesh 経路を追加）, `paths?: {id, points: Vec3[]}[]`（VehicleRide の経路）, `fogFar?: number`（部屋ごとの視程上書き。FogDepth と同じフック）。
7. 部屋ごとの視程: Game.ts の `scene.fog` を入室時に `min(tier.fogFar, layout.fogFar ?? ∞)` で更新（チャンク出現距離 = fog の向こう側に固定できる）。

■ 予算の見立て（200×100 m MegaHall、24 m チャンク）
- 三角形: 床・壁スラブは BoxGeometry 分割（1.25 m、上限 40）で床 100 m² あたり ≒ 7k、柱・家具は RoundedBox 108 tri/個。チャンク 1 個 ≒ 8〜15k tri。low Tier（fogFar 40）で可視 ≒ 12〜16 チャンク → 150〜240k（予算 250k ぎりぎり）。低 Tier では detailedBoxes の付帯造形（巾木・灯具ハウジング）と lightGrid 密度（5 m → 8 m）を落とす。
- Draw call: 材質 ≒ 6〜8 × 可視チャンク 16 ≒ 100〜130（low 予算 120）。低 Tier はチャンク 32 m で半減。
- ライト: L.lights は LightBudget で最近傍 2/4/8 個のみ点灯するので数は問題ないが `updateLights` が全ライトの getWorldPosition を毎フレーム呼ぶ → 可視チャンクのライトだけ集計するよう変更（S）。
- メモリ: 全チャンク常駐だと 70 チャンク × 約 2 MB = 140 MB で mobile 不可 → 上記 1 の距離 dispose が必須。

リスク: 1. 生成時のフリーズ: 現行 RoomBuilder.build は同期で、SurfaceLighting.bake が頂点数 × 発光体数に比例する。200 m 級を素朴に 1 部屋として作ると PC でも数秒、スマホで 10 秒近い停止が出る。チャンク化 + 近傍インデックス + 時間分割ビルドを先に入れないと MegaStructure は成立しない（最優先の共通基盤）。
2. 配置成功率: 深度 20 以降は世界が埋まっており 100 m 級の AABB が入口脇に入る確率は低い。Seam 前室フォールバック（Q1）を認めないと Legendary が「抽選されても出ない」部屋になる。物理配置を最大化するため入口位置バリアントは必須。
3. メモリ: 全チャンク常駐で 100 MB 超になり得る。距離 dispose を入れても、隣接部屋（1 hop・閉扉で不可視）が同時に常駐するので、Mega 内では隣接部屋のビルドを「扉を開けた時」まで遅らせる既存の ensure タイミングを崩さないこと。
4. 予算超過（低 Tier）: 可視三角形 250k / Draw call 120 は 24 m チャンクでぎりぎり。実機計測前提で、低 Tier ではチャンク 32 m・detailedBoxes の付帯造形省略・lightGrid 間引きの 3 段階の逃げ道を用意する。
5. 上階出口: buildShell が Opening の y を無視しているため、回廊出口を今のまま出すと床から穴が開く。MegaAtrium 着手前に footprint.ts の修正が必要（S だが前提条件）。
6. 地図: MAX_CELLS 16 のままだと 100 m 級で扉マーカーが矩形外に浮く。Q2 の決定待ち。levelSpan を入れないと上階の隣接部屋が「宙に浮いた部屋」として 2F 地図に出る。
7. Modifier 依存: VehicleRide（L02/L11）、InstanceOvergrowth（L03/L14）、ShallowWater、ScaleAnomaly、SurfaceFriction、ZoneThemeShuffle は別クラスタ。本クラスタでは「無くても歩いて全出口へ行ける」構造を保証し、Modifier は上乗せとする。InstancedMesh 経路（RoomBuilder）だけは両クラスタ共用の基盤なので、担当を 1 か所に決める。
8. 音: 音声アセットが無いため audioPreset（波音・列車音・遠いピアノ）は未実装。zones[] を audioZones の受け皿として残すのみ。
9. 決定論: variant の意味を sizeClass × entryOffset に拡張しても、保存されるのは variant 番号だけなので既存セーブ互換に影響しない。ただし CHUNK サイズは Tier で変わるため、レイアウト（純データ）側にチャンク依存の乱数を入れないこと。

#### MegaStructureGenerator（共通コア + MegaHall）（implementable / 工数 L） — L02, L03, L12

- 仕様: templates.json: MegaHall = 巨大ホール、巨大床 + 柱 + 環境要素、50〜300 m、ソケット周囲/内部、パラメータ 柱間隔・地形要素、モバイル注意「チャンク分割必須」。docx 8 章 / A.5: Legendary は 1 RoomNode の巨大単室、内部をチャンク分割してストリーミング。使用部屋 L02 / L03 / L12。
- 方針: 新規 src/generators/MegaStructureGenerator.ts（generateMega(p)）。src/generators/index.ts に分岐追加、layout.ts VARIANTS に 16 を登録、src/data/index.ts IMPLEMENTED_GENERATORS に追加、presets.ts BASE に MegaHall / MegaAtrium パレット追加。
寸法: variant を sizeClass(4) × entryOffset(4) に分解。MegaHall の sizeClass は [160×100, 120×80, 90×60, 60×50]（hint xl は先頭を 200×120 に）。rng で 0.85〜1.15 揺らし、0.5 m スナップ。高さ 9〜18 m（L12 は 14〜18）。
足跡: 主矩形 1 個（+ 40% で袖矩形）。makeEntry の ex を entryOffset で辺中央 / ±1/4 / 角寄りに変える（配置成功率のため。RoomGenerator の offIdx と同じ発想）。
出口: placeExits(minGap 6) を count = clamp(p.exits + bonusExits, 2, 6)。hole は allowHole 時 25% で 1 個（真下配置は既存 connectHole がそのまま働く）。
アーキタイプ（rng + 部屋 hints で選択。同名部屋でも変わる = D10/A6）: 'columnField'（柱 8〜10 m 格子 + 農道/通路帯）、'nave'（中央身廊 + 側廊の 2 列柱 + 高い天井 + 上部の配管橋は装飾）、'terraces'（0.6 m 段床を 2〜3 段。PlayerController.step 0.35 では登れないので段差にはスロープ帯を必ず付ける）。
内部の「地形要素」は zones[] に登録し、チャンク分割・地図・Modifier 適用に使う。照明は lightGrid(spacing 8〜10, everyNth 6) + 高所吊り灯を zones 中心に。ラベルは labelAtEntry。
出力に zones / fogFar（Mega は min(90, 対角の 0.6)）を含める。
- 依存: RoomBuilder チャンク化 + 時間分割ビルド（下記項目）, 配置フォールバック（WorldManager.tryPlaceFree 広域化 + Seam 前室）
- 前提: 実寸は 60〜160 m（xl で 200 m）を既定とし、仕様の 300 m は上限値としてデータで許すが既定バリアントには含めない。理由: fogFar の最大が 90 m（high）で、それ以上は見えず歩行時間と生成コストだけ増える。
- 前提: 1 RoomNode = 発見数 1。内部ゾーンは発見数に数えない（D3）。
- 前提: growToFill の対象外（現状の allowlist のまま）。巨大部屋は成長させない。
- 前提: hole ソケットは通常部屋と同じ確率規則（allowHole かつ入口が hole でない）で最大 1 個。
- 前提: 内装の ScaleAnomaly / InstanceOvergrowth 等は Modifier クラスタの実装を待たず、生成器が def.modifiers の params を直接読んで「素の見た目」を出す（GridGenerator が lightingPreset を正規表現で読むのと同じ方針）。Modifier 基盤が入ったらそちらへ移す。
- 質問: 巨大部屋が入口の周囲に物理配置できなかったとき（16 バリアント全滅）の扱い 選択肢: A) 扉を施錠して Legendary を出さない（抽選は無駄になる） / B) 暗い前室 Adapter + Seam で空き領域（別階・遠方）に配置する（Legendary は Epic 以上なので Seam 許可。地図は「？」） / C) その扉の定義を通常レア度に再抽選する 推奨: B（第 1 候補は物理配置。失敗時のみ B）

#### MegaStructureGenerator（MegaAtrium: 多層吹抜 + 回廊 + ゾーン）（implementable / 工数 L） — L04, L05, L07, L09, L11, L14, L19

- 仕様: templates.json: MegaAtrium = 巨大複合空間、ゾーン + 橋 + 吹抜、50〜200 m、ゾーン間 Portal、パラメータ ゾーン数・視認距離、モバイル注意「霧/遮蔽で同時描画量を制限」。hints: multiZone（複数用途ゾーン）、vertical（多層構成）。使用部屋 L04 / L05 / L07 / L09 / L11 / L14 / L19。
- 方針: 同じ MegaStructureGenerator.ts 内の generateMegaAtrium。
多層: levels = hint vertical → 4〜6、それ以外 2〜3。階高は FLOOR=3.6 固定（WorldManager の FLOOR、GridProjector の level = round(y/3.6) と一致させる）。総高 h = 3.6 × levels + 1.8。各階 k≥1 に外周回廊（幅 4 m の床スラブ y=3.6k-0.2..3.6k、内側に 1.05 m の手すり solid 箱）。中央は吹抜（床なし）。橋: 階ごとに 0〜2 本、幅 3 m のスラブ + 手すりで吹抜を横断。
階段: 四隅に直階段（VerticalGenerator の 20 段 × 0.18 rise を関数化して再利用）で隣接階を接続。全階が到達可能になるよう各階間に最低 1 本。
出口: 地上階に 40%、上階回廊の外壁に 60%（socketOnSpan の y 引数で pos.y=3.6k）。buildShell に y 対応 Opening を追加してから使う。elevator ソケットは最大 1（既存 resolveElevator がそのまま別階の部屋へ運ぶ）。
ゾーン: 地上階を zoneCount（既定 4〜6、ZoneThemeShuffle params があればそれ）の矩形に分割し、各ゾーンに用途タグ（campus: 教室列 / 体育館 / プール / 中庭、bath: 浴槽 / 更衣 / 休憩 / プール、hotel: 宴会場 / ロビー / 客室翼、resort: ホテル / プール / 雪面 …）と既存パターン（patternRows / patternIslands / patternPerimeter / patternColumns、水面は 'water' 非ソリッド + 床下 0.5 m の見えないコライダ）を割り当てる。ゾーン境界は 2.2 m 高の間仕切り or ガラス壁で、幅 3 m 以上の開口を必ず 2 か所残す（循環）。
アーキタイプ: 'ring'（4 矩形で環状足跡。内側は中庭 = 足跡外なので外壁が立つ。内側壁を 'glass' にして向こう側を見せる）、'campus'（ゾーン格子 + 中央通路）、'vertical'（狭い足跡 40×60 × 5 階、回廊に偽オフィス正面）、'terraces'。
出力: zones（階付き）、fogFar、paths（'ring' の周回中心線。VehicleRide 用）。
- 依存: footprint.buildShell の y 対応 Opening（上階出口）, MapCell.levelSpan（上階出口先を地図に載せる）, RoomBuilder チャンク化
- 前提: 階高は 3.6 m 固定（既存 FLOOR / level 丸めと整合）。中二階など半端な高さは作らない。
- 前提: 上階の回廊は幅 4 m、手すり 1.05 m。吹抜への転落は可能（床下は地上階なので実害なし。checkHole の世界外判定にも掛からない）。
- 前提: 回廊から下階への内部の穴（hole Portal）は作らない。hole は地上階のみ。
- 前提: 内部の階移動は階段（+ 斜路）だけで保証する。エレベーター籠は出口専用（既存機構）。
- 前提: ZoneThemeShuffle が Modifier として未実装でも、生成器が params.zoneCount / presetPool を直接読んでゾーンテーマを乱択する。
- 質問: MegaAtrium の内部縦移動にエレベーター（部屋内リフト）を新設するか 選択肢: A) 階段・斜路のみ（既存機構だけで成立） / B) 部屋内リフト: 籠ボリューム + ボタンで同一部屋内の別階へフェード移動（Game.tryElevator の分岐追加 + layout.elevators に internalTarget） / C) 既存の別階 Adapter エレベーターを増やす（出口が増えるだけで内部移動にはならない） 推奨: A で v1、B は L07 専用の追加課題として後回し

#### RoomBuilder 内部チャンク分割 + 時間分割ビルド（共通基盤）（implementable / 工数 L） — L02, L03, L04, L05, L07, L09, L11, L12, L14, L19

- 仕様: docx 8 章: Legendary の巨大空間は 1 RoomNode の内部をゾーン/チャンク単位でストリーミング。xlsx 04 シート Step 8: モジュールをチャンク単位で配置、同一物体は InstancedMesh。性能予算: 可視三角形 <250k/500k/1.5M、Draw call <120/200/500、動的ライト 0〜2/2〜4/4〜8。
- 方針: RoomBuilder.build を 2 段に分ける: (1) buildSkeleton — コライダ全量・扉・ソケット枠・ラベル・holes/elevators を今まで通り同期で作る。(2) buildChunk(ix,iz) — layout.bounds を CHUNK（tier で 24/32 m）格子に切り、箱を中心座標で振り分け、材質ごとに mergeGeometries して `THREE.Group`（bounds 付き）を返す。箱が格子をまたぐ場合は所属チャンクを中心で決める（頂点分割はしない）。
BuiltRoom に `chunks: Map<key, {group, bounds, state:'none'|'queued'|'built'}>` を追加。通常部屋はチャンク 1 個で従来と同じ結果。
RoomStreamingManager に `updateChunks(playerPos, tier, dt)`: 可視部屋の各チャンクについて距離 d を測り、d < fogFar + CHUNK なら queued、d > fogFar + 2·CHUNK なら dispose。ジョブキューは近い順、1 フレーム 4 ms まで（performance.now で打ち切り）。入室・扉開放時は入口ソケットから 2 チャンク以内を同期で作る。
SurfaceLighting: 発光体と遮蔽体を 8 m 格子でインデックスし、bake(g, own) が own の近傍セルだけ参照する（現状 14 m カットオフ前に全件ループ）。
InstancedMesh 経路: layout.instances をチャンクごとに InstancedMesh 化（bakedLight は一定値）。
updateLights は built チャンクのライトだけ集計。
- 前提: チャンクは軸平行格子（ゾーン形状には合わせない）。ゾーンは地図・Modifier 用の論理単位、チャンクは描画単位として分ける。
- 前提: コライダは全量常駐（1 万 AABB 程度）。broadphase の最適化は実測後。
- 前提: チャンクの出現距離は fog より遠いので pop-in は見えない前提。fogFar より近い距離でしか動かせない Tier 自動降格時は、降格直後の 1 フレームだけ遠景が欠けるのを許容。
- 前提: 1 hop の通常部屋の同期ビルド挙動は変えない（チャンク 1 個 = 従来通り）。

#### 巨大部屋の地図表現（MAX_CELLS / 多層 levelSpan）（needsDecision / 工数 M） — L02, L03, L04, L05, L07, L09, L11, L12, L14, L19

- 仕様: docx 9.4 / D6: mapCell は 4 m セル、最小 1×1・最大 16×16、「Legendary は上限で打ち切り」。ミニマップはフロア別、全体 3D はフロアを縦に積む。mapShape は L04「多層アトリウム」、L05「キャンパスグラフ」、L11「大リング」など。
- 方針: GridProjector.assign に定義のレア度（または layout.levels）を渡し、Legendary は MAX_CELLS を 80 に。MapCell に `levelSpan?: [number, number]`（wb.min.y と wb.max.y-2 から丸め）と `subCells?: {gx,gy,w,h,level}[]`（layout.zones を投影）を追加。Minimap.roomsOnLevel / Map3D は levelSpan が level を含む部屋も描く（非主階は塗りを薄く、subCells を細線で描く）。扉マーカーはソケットの y から階を出し、その階だけに描く。SaveManager は mapCell をそのまま保存しているので追加フィールドも自然に保存される。
- 依存: RoomLayout.zones
- 前提: ミニマップは現在位置中心・固定スケール（7 px/セル）なので 200 m = 350 px の矩形がはみ出しても問題ない。全体マップは自動スケールで収まる。
- 前提: 内部ゾーンは「？」にはしない（物理的に連続しているため）。
- 質問: Legendary の地図上の見え方 選択肢: A) 仕様どおり 16 セル（64 m）で打ち切る（遠い辺の扉マーカーが矩形の外に浮く） / B) Legendary だけ上限を 80 セルに緩和し、実寸矩形 + ゾーン内訳の細線を描く / C) 実寸矩形は描かず、ゾーンを個別のセル群として描く（キャンパスグラフ風。ただしゾーン間の接続線が必要） 推奨: B

#### L02 室内海洋（implementable / 工数 M） — L02

- 仕様: MegaHall / 海洋ホール。primaryPortal boat、出口 1〜3、「桟橋・浮橋・水門で接続」、mapShape 巨大セル、Modifiers ShallowWater(depth 2.0, mode sea) + VehicleRide(boat 25 s)。ボートはスクリプト移動で到着時 Seam 遷移。
- 方針: アーキタイプ 'columnField' の派生 'sea': 床全面を 'water' 非ソリッド面（y=0）にし、その下 y=-0.5 に見えないソリッド床（膝下まで浸かる）。入口と全出口を結ぶ桟橋ネットワーク（幅 2.4 m、y=0.3 の 'furnitureDark' 板 + 杭）を最小全域木 + 1 ループで生成し、歩行で必ず全出口へ到達できるようにする。水門 = 出口ソケットは WIDE_W の 'door' 開口（type は boat を door に丸める。Portal 型 boat は WorldManager 未対応のため）。桟橋の経路を layout.paths に入れ、VehicleRide 実装時にボート経路として使う。天井は暗い高天井 + 疎らな吊り灯（薄明）。
- 依存: MegaHall コア, ShallowWater / VehicleRide（Modifier クラスタ。無くても歩行で成立）
- 前提: 水深の見た目は ShallowWater に任せ、ゲーム上は膝下 0.5 m の歩行可能な浅水にする（水泳・溺れは実装しない）。
- 前提: boat 型ソケットは door（幅 2.2 m）として出力し、VehicleRide 実装後に乗船点へ置き換える。ボート無しでも桟橋で全出口へ歩いて行ける。
- 前提: 波音は音声アセットが無いため未実装。

#### L03 倉庫内麦畑（implementable / 工数 M） — L03

- 仕様: MegaHall / 倉庫 + 畑。primaryPortal path、出口 2〜5、「農道交差・倉庫扉へ」、mapShape 大矩形、hints chunked + xl、Modifier InstanceOvergrowth(wheat, density 1.0)、高所灯。
- 方針: 'columnField' の xl サイズ（200×120 m）。畑区画を 12〜18 m 格子に切り、格子線を幅 3 m の農道（'floorConcrete'）、区画内を麦とする。麦は layout.instances（kind 'blade'、0.08×1.1 m の薄板 2 枚交差、1 m² あたり 2 本、密度は Tier と density param で 0.5〜1.0 倍）で InstancedMesh 化。低 Tier や InstancedMesh 未実装時のフォールバックとして区画を高さ 0.9 m の 'plant' 単一スラブで表す（RoomBuilder が 'plant' 箱を球にする分岐を避けるため、スラブは新 MatId 'crop' か solid=false の box として出す）。倉庫柱 12 m 格子、高所灯は spacing 12。出口は農道の延長上に置く（placeExits 後に最寄りの農道へ農道を延ばす）。
- 依存: MegaHall コア, RoomBuilder InstancedMesh 経路（InstanceOvergrowth と共用）
- 前提: 麦は歩行を妨げない（非ソリッド）。農道はガイドであり必須経路ではない。
- 前提: InstancedMesh 経路（layout.instances）が入るまではスラブ表現で出す。

#### L04 無限グランドホテル（implementable / 工数 M） — L04

- 仕様: MegaAtrium / 巨大ホテル。door、出口 1〜4、「客室/宴会場/階段/EV をグラフ生成」、mapShape 多層アトリウム、hints chunked + multiZone + vertical、Modifier なし、暖色豪華照明。
- 方針: 'vertical' 寄りの MegaAtrium: 4〜5 階、足跡 60×90 m 前後。各階回廊の外壁に 3.6 m 間隔で偽客室扉（壁面に 0.05 m 凹ませた 'doorWood' 箱 + 番号ラベルは 8 枚に 1 枚）。地上階ゾーン: ロビー（受付島 + 植栽 = AtriumGenerator の受付島を再利用）、宴会場（列柱 + 円卓 patternIslands + 吊りシャンデリア 'lightWarm' 箱）、客室翼（間仕切りで小部屋列、扉開口あり、入れる）。階段は四隅 + 中央大階段 1 本。EV ソケット 1（出口）。実出口はランダム階。「グラフ生成」は内部ゾーン間の開口配置（各ゾーン 2 開口以上）で表現し、RoomGraph 上の辺は出口のみ。
- 依存: MegaAtrium コア, buildShell 上階開口
- 前提: 偽客室扉は開かない装飾（インタラクト対象にしない。Game.interactRay は interactables のみ拾うので自然に無視される）。
- 前提: 客室翼の小部屋はゾーン内部の間仕切りで、RoomNode にはしない。

#### L05 屋内学園都市（implementable / 工数 M） — L05

- 仕様: MegaAtrium / 学校都市。door、出口 1〜4、「校舎・体育館・プール・通路をゾーン接続」、mapShape キャンパスグラフ、hints chunked + multiZone、Modifier ZoneThemeShuffle(zoneCount 6, presetPool campus)、昼白色。
- 方針: 'campus' アーキタイプ、2 階、足跡 100×80 m。zoneCount=6 を 3×2 格子に切り、格子線を幅 5 m の通路（床 'floorLino'）とする。campus プール: 教室列（patternRows 机 + 黒板箱）、体育館（間仕切り無し・ライン 'yellowLine' 帯・高天井部）、プール（'water' 非ソリッド + 床下コライダ + 更衣ロッカー列）、図書室（棚列 = GridGenerator の shelves を関数化して再利用）、食堂（長机列）、中庭（'plant' 島 + ベンチ）。テーマの割当は rng 乱択で重複可。各ゾーンの壁材はテーマごとの BASE パレット（Classroom / LockerRoom / Gallery …）を presets から借り、箱の mat をゾーン単位で差し替える。上階は回廊のみ。
- 依存: MegaAtrium コア
- 前提: ZoneThemeShuffle は生成器が params を直接読んで実装（Modifier エンジン無しでも動く）。Modifier 基盤が入れば同じゾーン情報を渡す。
- 前提: ゾーン間は必ず 2 開口以上（袋小路を作らない）。

#### L07 垂直オフィス世界（implementable / 工数 S） — L07

- 仕様: MegaAtrium / 巨大アトリウム。primaryPortal elevator、出口 1〜3、「壁面オフィスを EV/橋で接続」、mapShape 縦グラフ、hints chunked + vertical、Modifier なし、冷白色。
- 方針: 'vertical' アーキタイプ: 足跡 40×60 m、5〜6 階（総高 約 20 m）。各階回廊の外側に奥行 6 m のオフィス帯（ガラス正面 'glass' + 内部に patternRows デスク列、2 か所に開口で入れる）。橋は各階に 1〜2 本で千鳥配置。階段は 2 か所（対角）。出口は各階に散らし、EV ソケットを最大 2 本（既存 resolveElevator で別階の部屋へ。EV 出口は WorldManager.makePortals で seam=true として扱われる既存挙動のまま）。高天井の天窓帯 + 冷白 lightPanel。fogFar は 60 に抑え、上下方向の見通しは吹抜越しに確保。
- 依存: MegaAtrium コア, （任意）部屋内リフト
- 前提: primaryPortal=elevator でも入口の型は親のソケットで決まる（既存仕様）。EV の「らしさ」は出口側の EV ソケット数で出す。
- 前提: 内部の階移動は階段のみ（MegaAtrium 項の質問 A を既定）。

#### L09 無限温浴施設（implementable / 工数 S） — L09

- 仕様: MegaAtrium / 温浴施設。door、出口 1〜4、「浴場/更衣/休憩/プールを循環接続」、mapShape 多室連結、hints chunked + multiZone、Modifiers Wetness(0.7) + ParticleDetail(mist 0.5)、暖色 + 水面光。
- 方針: 'ring' アーキタイプの 1 階 + 中央大浴場: 外周の環状帯（幅 14 m）を bath プールで 6〜8 ゾーンに切り（浴槽 = 0.3 m 立ち上がり 'floorTile' 枡 + 'water' 面、更衣 = ロッカー patternRows、休憩 = 座敷島、プール = 大水面 + 床下コライダ）、環状帯なので自然に循環する。中央矩形は吹抜の大浴場（高天井 + 湯気は ParticleDetail）。ゾーン境界は腰壁 1.2 m + 開口 2 か所。パレットは Restroom/LockerRoom 系タイル。Wetness / ParticleDetail は Modifier 側（無くても成立）。
- 依存: MegaAtrium コア, Wetness / ParticleDetail（Modifier クラスタ、任意）
- 前提: 浴槽は膝下 0.5 m の歩行可能な水面（L02 と同じ扱い）。
- 前提: 2 階は作らない（多室連結は平面で表現）。

#### L11 環状モノレール都市（implementable / 工数 M） — L11

- 仕様: MegaAtrium / 交通都市。primaryPortal train、出口 1〜3、「環状線駅をハブ接続」、mapShape 大リング、hints chunked、Modifiers VehicleRide(monorail 30 s) + LoopTopology(loopLength 1)、都市夜景光。モノレールはスクリプト移動。
- 方針: 'ring' アーキタイプ: 外形 120×120 m、環状帯幅 16 m（4 矩形の足跡。中庭側の壁は 'glass' で向こう岸を見せる）。帯の内側 4 m を y=3.6 のホーム（スラブ + 手すり）、外側 10 m を歩行通路 + 店舗跡（patternPerimeter）とし、ホームへは各駅の階段で上がる。駅は 4 角 + 辺中央の最大 8 か所。軌道桁は y=4.8 の 'metal' 帯（装飾・非ソリッド）。出口は駅の外壁に集約（ハブ接続）。layout.paths に周回中心線（y=4.2）を入れ VehicleRide が使う。夜景: ambient を落として 'ledBlue' / 'lightWarm' の看板箱を多めに（emissiveProps 相当）。LoopTopology は環状足跡そのもので満たすため RoomGraph の辺は変えない。
- 依存: MegaAtrium コア（ring 足跡）, VehicleRide（Modifier クラスタ、任意）
- 前提: train 型ソケットは door（幅 2.2 m）として出力。モノレール未実装でも周回歩行で全駅へ到達できる。
- 前提: LoopTopology(loopLength 1) は自己ループ = 環状足跡で表現し、グラフ辺の自己接続は作らない。

#### L12 設備大聖堂（implementable / 工数 S） — L12

- 仕様: MegaHall / 設備ホール。door、出口 1〜4、「配管橋・制御室・階段で接続」、mapShape 大聖堂型、hints chunked、Modifier ScaleAnomaly(perProp, 3〜8 倍)、高コントラスト。
- 方針: 'nave' アーキタイプ: 足跡 40〜60 × 120〜160 m、高さ 16 m。中央身廊（幅 16 m）の両側に 2 列の 'columnConcrete' 角柱（1.2 m、8 m 間隔）、側廊の外壁沿いに制御室（間仕切り小部屋、扉開口、内部にコンソール = furnitureDark 箱 + ledBlue）。巨大設備: 3〜8 倍スケールの 'metal' タンク / ダクト箱を身廊に配置（params min/max を直接読む。ScaleAnomaly 実装後は素のサイズを出して Modifier に任せる）。配管橋は y=6 の 'metal' 帯（装飾、非ソリッド）+ 両端に階段風の斜路（歩けるものは 1 本だけ、他は装飾）。照明は高所の少数の強い lightPanel + 大部分 lightOff（高コントラスト）。
- 依存: MegaHall コア, ScaleAnomaly perProp（Modifier クラスタ、任意）
- 前提: 巨大設備は歩行の主経路（身廊中央 4 m）を塞がない配置制約を付ける。
- 前提: 配管橋の大半は装飾で歩けない。歩ける橋は 1 本（階段付き）。

#### L14 温室都市（implementable / 工数 M） — L14

- 仕様: MegaAtrium / 温室モール。primaryPortal path、出口 2〜5、「橋・庭園・店舗跡を接続」、mapShape 有機ネットワーク、hints chunked + multiZone、Modifier InstanceOvergrowth(density 0.9, blocksPath true)、自然光風 + 育成灯。
- 方針: 'campus' の派生 'greenhouse': 2 階、足跡 90×90 m、天井・外壁を 'glass'（OrganicZone パレット）。地上階を不規則なゾーン（格子を rng で 1〜2 セル結合して有機的に）に切り、庭園（'plant' 島 + 花壇枡）、店舗跡（patternPerimeter 棚 + ガラス正面）、通路。上階回廊 + 橋 2〜3 本。植生は layout.instances（低木 = 球 + 幹、density 0.9）。blocksPath: 通路の一部を植生ブロック（ソリッド 'plant' 箱）で塞ぐが、入口と全出口を結ぶ主経路（幅 2.4 m）は keep-clear 領域として必ず空ける。
- 依存: MegaAtrium コア, RoomBuilder InstancedMesh 経路
- 前提: blocksPath は生成器が主経路を保護した上で脇道だけ塞ぐ。進行不能は作らない。
- 前提: 育成灯は 'lightWarm' と 'ledBlue' の混在パネルで表現。

#### L19 凍結リゾート（implementable / 工数 S） — L19

- 仕様: MegaAtrium / リゾート。door、出口 1〜4、「ホテル/プール/雪面を接続」、mapShape 複合地形、hints chunked、Modifiers SurfaceFriction(0.2) + FogDepth(#dfe7ee, near 10, far 80) + ParticleDetail(snow 0.3)、青白色 + 暖色室内。
- 方針: 'terraces' アーキタイプ（MegaAtrium 版）: 足跡 100×70 m を 3 ゾーンに分割。ホテル翼（2 階回廊 + 偽客室扉、暖色 lightWarm、L04 の部品を再利用）、プール（凍結面 = 'water' をソリッドの歩行面にして氷、プールサイド段差 0.6 m はスロープ付き）、雪面（白床 'ceilingWhite' を床材に流用、緩い段丘、まばらな 'furnitureDark' ベンチ）。zones に tag 'ice' / 'snow' を付け、SurfaceFriction の zone 指定に使う。fogFar 80 を layout.fogFar に出す（FogDepth 未実装でも視程が効く）。ParticleDetail は Modifier 側。
- 依存: MegaAtrium コア, 部屋ごとの fogFar 上書き（FogDepth と共用フック）, SurfaceFriction zone（Modifier クラスタ、任意）
- 前提: 氷面は摩擦以外は通常床と同じ（SurfaceFriction 未実装なら普通に歩ける）。
- 前提: 雪の見た目は既存 'ceilingWhite' 材の流用で始め、専用 'snow' 材は後回し。

### 未実装 Generator（DynamicGridGenerator / GraphMacroGenerator / HubGenerator）と、それらが要求する共通基盤（可動要素・FarLink・DynamicMapNode・地図の足跡描画）

共通基盤: 現行コードは「RoomLayout = 純データ → RoomBuilder が材質ごとに 1 メッシュへ結合、コライダは build 時の静的 AABB 配列」「接続先は ensureNeighbors → connectPortal で確定、Modifier は未適用」という構造なので、3 Generator を載せる前に次の 4 つを先に入れると各 Generator 本体は小さく済む。
(1) 可動要素基盤（MovingWalls 用。E18 と M07 で共用）: RoomLayout に `dynamics?: DynamicBlock[]`（{box, axis:'x'|'z', travel, speed, phase, kind:'wall'}）を追加。RoomBuilder は dynamics を結合対象から外し、ブロックごとに独立 Mesh + 専用 AABB を作って BuiltRoom.dynamics に保持。RoomStreamingManager.updateDynamics(dt, now, playerAABB) を新設し Game.step の player.update 直前に呼び、AABB を in-place 更新（streaming.colliders は毎フレーム b.colliders を集め直すので参照更新で効く）。プレイヤーの AABB が次フレームの移動先と重なるときはそのブロックを停止させる（挟み込み防止。エレベーター扉のセンサー相当）。位相は performance.now ベースでセーブしない。
(2) Modifier 適用フック（src/modifiers/）: `ModifierRuntime { onNodeCreated?(node, world); onConnect?(node, portal, world): boolean; update?(dt, now, node, world, game) }` を id 登録し、WorldManager.finalize / ensureNeighbors と Game.step（現在部屋のみ）から呼ぶ。FarLink と DynamicMapNode はここに載る。Portal に `far?: boolean`（Seam の種別）を追加し、Game.checkSeamCrossing の自動遷移は「緊急 Seam のみ」に限定する（現状は seam 扉に 0.6 m 近づくだけで遷移するため、Hub の扉が E を押さずに発火してしまう）。
(3) FarLink リゾルバ（M08 / M20 共用）: 訪問済みノード集合から targetFilter（'discoveredLegendary' | minGraphDistance）で候補を絞り、`new Rng(node.seed).fork('far:'+portalId)` で決定論的に選ぶ。portal.seam=true, far=true, open=false, targetRoomId=候補, targetPortalId='entry', projected=false。遷移は既存の Game.interactRay → world.resolveSeamTarget（target 既存なら spawnPointOf を返す）がそのまま使えるので Game 側の追加は不要。
(4) 地図の足跡描画: Minimap.drawMap / Map3D が mapCell の 1 矩形ではなく `world.layoutFor(n).footprint` の各 Rect を placement でワールド変換して 4 m セルに丸めて描く（GridProjector は AABB のまま）。GraphMacro の記号を地図に出す前提であり、既存の L / Z / U 廊下や翼付き部屋の地図表現も改善する（D10 の品質指摘にも寄与）。

リスク: (1) 出現率: Mythic は最低深度 35・重み 0.5 なので通常プレイでは数百部屋に 1 回。開発中は `?force=M20` のような URL パラメータで次の抽選を固定する開発用フックを RarityGenerator に入れないと検証できない。(2) 配置失敗: GraphMacro（30〜45 m）と Hub（24 m）は密な世界では variant 縮小でも置けず lockOrVestibule に落ちる可能性がある。前室の先で再試行されるが、最小 variant でも記号が崩れない下限（0.5 倍・幅 4 m）を守るため、それ以下では別定義に差し替えるのではなく前室連鎖に任せる。(3) DynamicMapNode のサブツリー削除は graph / worldBounds / layouts / projector / streaming の 5 箇所を同期して消す必要があり、漏れると detectRoom や地図でゴーストが出る。削除用の `WorldManager.removeSubtree()` を 1 箇所に集約すること。(4) 可動ブロックは材質結合から外れるため draw call が増える。Low tier では個数上限（8）を守る。(5) Seam 自動遷移: 現行 Game.checkSeamCrossing は seam 扉に 0.6 m 近づくだけで遷移するため、Hub の far 扉に `far` フラグを付けて除外しないと E を押す前に飛ばされる。(6) セーブ互換: Portal.far / RoomLayout.dynamics / state.localFlags.farLinks・rewireLog はすべて省略可能にし、旧セーブでは undefined を既定値として読む。(7) 音: 3 部屋とも音のプリセット（床駆動音・低周波・複数環境音の混合）が主演出の一部だが音アセットが無いため、AudioEngine 導入まで視覚のみで成立させる。

#### DynamicGridGenerator（Template: DynamicGrid / M07 動くマップタイル）（needsDecision / 工数 M） — M07

- 仕様: 8–30 m の可変床/壁。Portal ソケットはセル境界。床セルが移動し経路グラフも更新（ライブ再配線）。Modifier は DynamicMapNode(swapIntervalSec 20) と MovingWalls(speed 0.5)。実装メモ「再配線は未構築・非観測の接続に限定」。モバイルは簡略コライダ。
- 方針: src/generators/DynamicGridGenerator.ts を新設し generators/index.ts に登録、data/index.ts の IMPLEMENTED_GENERATORS に追加、layout.ts VARIANTS に DynamicGridGenerator: 6（30/24/18/14/10/8 m 正方）を追加。足跡は単一矩形、内部を 3 m セル格子に分割。外周 1 セル幅は固定の回廊（静的床）とし、entry と出口ソケットはこの回廊の外壁上でセル境界（3 m グリッド）に丸めて配置する。これで「入室後に部屋（ソケット・接続）は変わらない」不変条件を保ちつつ、可動要素は内部のみに限定できる。内部セルには床から天井までの壁ブロック（1 セル、材質 wallWhite/metal）を市松状に配置し、各行または各列で 1 ブロックを rng で選び `dynamics` に登録（axis は行/列方向、travel = 1〜2 セル、speed = 0.5 m/s、phase = rng）。行き止まりを作らないよう固定ブロックは 1 セル置き。RoomBuilder/RoomStreamingManager は共通基盤(1)で駆動する。プレイヤーの扱い: 壁ブロックは乗れないので「乗っているセル」は発生しない。プレイヤーに接触しそうなブロックは停止（挟み込み無し）。地図: 部屋は通常どおり mapCell 1 矩形で描き、内部セルは描かない。DynamicMapNode（共通基盤(2)）: 20 秒ごとに、現在部屋の door Portal のうち「閉扉・行き先が未訪問・行き先サブツリーが親以外の既存部屋へ直結（extraSockets）を持たない」ものを 1 本選び、行き先サブツリーを graph/worldBounds/layouts/projector/streaming から除去して `portal:${id}:rewire${n}` の fork で connectPortal を再実行、n を node.state.localFlags.rewireLog に保存する。再抽選できる候補が無ければ何もしない。growToFill の対象外、allowHole=false、hole 落下先（ROOMLIKE）にも含めない。
- 依存: 可動要素基盤（RoomLayout.dynamics / BuiltRoom.dynamics / updateDynamics）, Modifier 適用フック（src/modifiers/）, DynamicMapNode 再抽選（M03 と共用）
- 前提: 可動セルは部屋内部のみ。外周回廊・entry・出口ソケットは固定（不変条件を守るため）
- 前提: ブロックの位相は実時間ベースでセーブしない（再ロード時の位置ズレは許容）
- 前提: 地図上は通常の 1 矩形。内部の可動セルは地図に描かない（描くと毎フレーム地図データが変わる）
- 前提: DynamicMapNode の再抽選は現在部屋の閉扉・未訪問・独立サブツリーの扉に限定し、候補が無ければスキップ（戻り扉・訪問済みへの扉は対象外）
- 前提: 音（床駆動音）はアセットが無いので未実装。将来 AudioEngine のプリセットで対応
- 前提: Low tier でも可動ブロック数は最大 8 個程度に制限（メッシュが結合できないため draw call を増やす）
- 質問: 可動セルを「壁ブロックが滑る（乗らない）」にするか「床タイルが動き、プレイヤーが乗って運ばれる」にするか 選択肢: A: 壁ブロック（スライドパズル型）。プレイヤーは乗らず、接触しそうなブロックは停止 / B: 床タイル（高さ 0.3 m の台）が動き、乗っているプレイヤーを運ぶ（PlayerController.external で搬送、隙間への落下判定が必要） / C: A を v1、B を後日追加 推奨: A（または C）

#### GraphMacroGenerator（Template: GraphMacro / M05 俯瞰記号フロア）（needsDecision / 工数 M） — M05

- 仕様: 記号/メタ配置。推奨モジュール「複数 RoomNode」、ソケットは「ノードエッジ」、寸法任意。複数部屋の配置そのものが地図上で記号（矢印・十字など）を形成する。Modifier 無し、規則照明、低周波。低頻度生成。
- 方針: 推奨案（単一ノード方式）: src/generators/GraphMacroGenerator.ts を新設し、footprint（Rect[] の連結。既存の L/Z/U 廊下と同じ仕組み）で記号形を作る。記号セット: 矢印（→）、十字（+）、環（□ ループ）、T、H の 5 種を rng で選び、廊下幅 4 m（1 セル）・腕長 12〜20 m でレイアウト。variant 0..5 でスケール 1.0/0.8/0.65/0.5 と入口腕の選択を変え、空き空間に合わせる。entry は 1 本の腕の端、出口は他の腕の端（各腕先に door ソケット、exits は def の 1〜4 を上限）。内装は規則的な天井灯（lightGrid、消灯率 0）と等間隔の柱のみで「規則照明」を表現。地図側は共通基盤(4)で footprint を描くよう Minimap/Map3D を変更する（これが無いと 1 矩形に丸められ記号が見えない）。入室した瞬間に部屋全体の足跡が地図に現れるので、記号が一度に「見える」演出になる。growToFill 対象外、allowHole=false。仕様どおりの複数ノード方式は次の理由で非推奨: (a) 1 定義から複数 RoomInstance を 1 トランザクションで配置する仕組みが無く、Adapter 挿入（connectPortal 内で 1 ノード追加）の流用では 5〜9 ノードの同時配置・失敗時のロールバックが書けない、(b) 占有率 0.54 の密な世界では 30〜40 m 幅の配置が高確率で衝突し、縮小→Adapter→locked のフローで記号が崩れる、(c) 訪問済みのみ描く地図では全サブノードを踏むまで記号が完成せず、Mythic で visitedCount / recentRarities が複数回加算される副作用がある、(d) 常時開放の開口で繋ぐと 2 hop 先が未構築で黒い虚空が見えるため扉が必須になり「1 つのフロア」に見えない。
- 依存: 地図の足跡描画（Minimap / Map3D が footprint の各矩形を描く）
- 前提: 記号セットは矢印・十字・環・T・H の 5 種（0.5 m グリッドと矩形連結で表せる形に限定。斜め・曲線・文字は不可）
- 前提: 廊下幅は 4 m（地図 1 セル）で、腕長は 12〜20 m。variant で 0.5 倍まで縮小
- 前提: 記号を構成する矩形は 1 ノードの footprint。visitedCount は 1 加算
- 前提: 規則照明 = 等間隔の天井灯（消灯なし）。低周波音は未実装
- 前提: 地図での表示以外に室内で記号を示す演出（床のライン等）は入れない
- 質問: 記号を「1 部屋の足跡（footprint）」で作るか、仕様どおり「複数 RoomNode」で作るか 選択肢: A: 単一ノード。footprint で記号形を作り、地図が footprint を描くように変更（既存の折れ廊下・翼付き部屋の地図表現も改善） / B: 複数ノード。中央ノード + 腕ノード（各腕は 1 hop）を専用のマクロ配置トランザクションで配置し、扉で接続。失敗時は腕を減らす / C: A を v1、B は保留 推奨: A（C）

#### HubGenerator（Template: HubRoom / M20 中央接続室）（needsDecision / 工数 M） — M20

- 仕様: 10–30 m の中央空間 + Portal 群（ソケット 3〜8）。既発見 Legendary へ複数直結 Portal（FarLink targetFilter=discoveredLegendary, count=4）。Seam Portal。暖色荘厳灯、複数環境音の混合。Portal 先は遅延ロード。未決 Q5: 既発見 Legendary が 0 件のときの挙動（施錠想定）。
- 方針: src/generators/HubGenerator.ts を新設（Atrium に近い単室。variant 5 段: 24/20/16/13/10 m の正方形、天井高 5〜6 m、中央に柱の環と床の同心円ライン（yellowLine 材）、壁沿いに等間隔の壁灯、lightWarm）。ソケット: entry + 通常出口（def の minExits〜maxExits から 1〜2 本、物理配置）+ far ソケット N 本（id `far0..`、扉幅 1.0、各壁の中央寄りに等間隔）。N は node 作成時（finalize 直前）に FarLink リゾルバが決め、選んだ行き先 roomId 配列を node.state.localFlags.farLinks に保存して GenParams 経由で Generator に渡す（レイアウト再生成でも同じ N・同じ位置になる）。makePortals で far ソケットは seam=true, far=true, open=false, locked=false, projected=false, targetRoomId/targetPortalId（'entry'）を設定するので ensureNeighbors の pending（!seam）から外れて物理配置されない。行き先の選定: graph.nodes のうち visited && ROOM_BY_ID.rarity==='Legendary' を definitionId で重複除去し、`Rng(node.seed).fork('far:'+i)` で最大 count(4) 件。遷移は既存の Game.interactRay の seam 分岐 → world.resolveSeamTarget（target 既存 → spawnPointOf(target)）でそのまま動く。resolveSeamTarget が返す spawn は target の entry から 1.5 m 内側。到着先は既に物理配置済みなので enterRoom → prepareRoom で周辺が復元される（遅延ロード）。戻り: 一方通行（Legendary 側に戻り扉は作らない。訪問済み部屋は frozen で開口を増やせないため）。ハブ自体は通常の扉で親と繋がっており、歩いて戻れる。地図: portal.projected=false なので Minimap は扉位置に「？」を描く（既存実装）。Map3D は同フロア間の線を引かない（既存どおり）。Game.checkSeamCrossing は far=true の扉を除外（E / タップで開けたときだけ遷移）。
- 依存: FarLink リゾルバ（M08 と共用）, Modifier 適用フック, Portal.far の追加と checkSeamCrossing の限定
- 前提: far 扉は E / タップで開けた瞬間にフェード遷移（既存の Seam 扉と同じ演出）。接近だけでは遷移しない
- 前提: 一方通行。Legendary 側に戻り Portal は追加しない（訪問済み部屋の不変条件を守る）。ハブへは通常経路で歩いて戻る
- 前提: 行き先は definitionId で重複除去し、既発見数が count 未満なら far 扉の本数もその数に減らす（施錠扉を並べない）
- 前提: 到着位置は行き先の entry から 1.5 m 内側（spawnPointOf）。到着で visitedCount は増えない
- 前提: 複数環境音の混合は音アセットが無いため未実装
- 前提: farLinks は node.state.localFlags に保存し、セーブ互換のため省略可能フィールドとする
- 質問: 既発見 Legendary が 0 件のとき M20 をどう扱うか（未決 Q5） 選択肢: A: 抽選から除外する（pickDefinition で ctx.discoveredIds に Legendary が無ければ M20 を候補から外す）。1〜3 件なら far 扉をその本数に減らす / B: 施錠扉で出す（far 扉すべて「この扉は開かなそうだ」） / C: 既発見 Epic → それも無ければ graph 距離 30 以上の訪問済み部屋で代替 推奨: A
- 質問: 行き先（既発見 Legendary）から戻る手段 選択肢: A: 一方通行。ハブには通常経路で歩いて戻る / B: 行き先 Legendary の部屋に戻り用 Seam 扉を後から追加する（訪問済み部屋の壁に開口を増やすため「入室後に部屋が変わらない」不変条件の例外が必要。未構築中に追加すれば目の前では変わらない） 推奨: A

#### 共通基盤: 可動要素（MovingWalls）（implementable / 工数 M） — E18, M07

- 仕様: MovingWalls — 対象: 壁 / パラメータ: 速度・位相 / 実装: セル単位 Transform 更新 / 負荷: 中。E18（speed 0.2、壁紙 UV 流動に合わせ壁セグメントをスライド）と M07（speed 0.5）で使用。
- 方針: layout.ts に `DynamicBlock { box: Box; axis: 'x'|'z'; travel: number; speed: number; phase: number }` と `RoomLayout.dynamics: DynamicBlock[]` を追加（emptyLayout は []）。RoomBuilder.build は dynamics を静的結合から除外し、ブロックごとに surfaceBox の Mesh を group に追加、ワールド AABB を colliders に push しつつ `BuiltRoom.dynamics: { mesh, base: AABB, collider: AABB(参照), axisWorld, travel, speed, phase }` に保持。RoomStreamingManager.updateDynamics(now, playerAABB) は built のうち group.visible な部屋について offset = travel * (0.5 + 0.5 * sin(2π * now * speed / (2*travel) + phase)) を計算し、次位置の AABB がプレイヤー AABB（±0.1）と重なるなら更新をスキップ（停止）、そうでなければ mesh.position と collider.min/max を in-place で更新。Game.step で colliders 取得の前に呼ぶ。E18 では廊下の壁帯の一部（1.5 m × 壁厚）を dynamics として登録して壁に沿ってスライドさせるだけで成立する。
- 前提: 位相は performance.now ベース。セーブ/決定論の対象外
- 前提: 可動ブロックは部屋あたり最大 8 個（結合できず draw call が増えるため）
- 前提: 停止方式（挟み込み防止）で、プレイヤーを押す・運ぶ処理は入れない

#### 共通基盤: DynamicMapNode（未観測扉の再抽選）（implementable / 工数 M） — M03, M07

- 仕様: DynamicMapNode — 対象: マップ / swapInterval / 論理グラフ上で node edge swap / 負荷: 低。M03（45 秒）と M07（20 秒）。swap 対象は未探索エッジのみ。戻りエッジと開始点への到達可能性は不変。再配線は Portal が非観測のときだけ、部屋ごとの決定論的乱数列で再抽選し stateDiff に保存。
- 方針: src/modifiers/DynamicMapNode.ts。Game.step から現在部屋の Modifier update を呼び、swapIntervalSec ごとに候補を探す。候補条件: p.type==='door' && !p.isReturn && !p.open && targetRoomId があり、target.visited===false、target およびその子孫（parentRoomId で辿る）に「サブツリー外（親を除く）を targetRoomId とする Portal」も「サブツリー外から自分を指す Portal」も無い（addAdjacencyLinks / tryLinkExisting で他室の extraSockets を増やしたノードは除外。除外しないと他室のレイアウトが変わり不変条件を破る）。候補があれば rng = Rng(node.seed).fork(`rewire:${portalId}:${n}`) で 1 本選び、サブツリーのノードを streaming.built から dispose、graph.nodes / worldBounds / layouts / projector.cells から削除、portal.targetRoomId/targetPortalId を undefined に戻し、WorldManager に `reconnectPortal(node, portal, n)` を追加して connectPortal を fork タグ付きで再実行（rollRoomNode の seedTag に `:rewire${n}` を付与）。n を node.state.localFlags.rewireLog[portalId] に記録し、地図では再抽選済みの扉を projected=false（「？」）にする。現在 1 hop は常に built（非表示）なので「非観測 = 閉扉」で判定する。
- 依存: Modifier 適用フック
- 前提: 非観測 = 所有側 Portal が閉扉。プレイヤーが扉から 3 m 以内にいる場合も対象外にする（開け始めの瞬間に変わらないように）
- 前提: 候補が無ければスキップ（密な場所では発火頻度が下がることを許容）
- 前提: 再抽選済みの扉は地図で「？」にする（mapRules の「再配線は投影不能」に従う）
- 前提: M07 は本基盤が入るまで MovingWalls のみで出す

#### 共通基盤: FarLink リゾルバ（implementable / 工数 S） — M08, M20

- 仕様: FarLink — 対象: 接続 / minGraphDistance, targetFilter, count / グラフ距離の遠いノード（既発見 Legendary 等）へ Seam Portal で接続 / 負荷: 低。M08（minGraphDistance 30）と M20（discoveredLegendary, count 4）。
- 方針: src/modifiers/FarLink.ts に `resolveFarTargets(node, params, graph): string[]` を置く。候補は visited && placement を持つノード（Adapter 除く）。targetFilter='discoveredLegendary' なら rarity==='Legendary' で絞り definitionId で重複除去。minGraphDistance が指定されていれば node から BFS（portals の targetRoomId を辺とする無向グラフ）で距離 ≥ 値のものに絞り、無ければ最遠のもの。決定論: Rng(node.seed).fork('far') で shuffle し count 件。WorldManager.finalize の直前（ノード作成時）に呼び、結果を node.state.localFlags.farLinks に保存、makePortals が `far*` ソケットに seam/far/target を設定する。M08 では SmallRoom の出口 1 本を far ソケットに置き換える（RoomGenerator に `farCount` を渡す小変更）。
- 依存: Modifier 適用フック
- 前提: 行き先は訪問済みのみ（未訪問へ飛ぶと発見の意味が変わる）
- 前提: 到着位置は spawnPointOf(target)。到着時にハブ側の far 扉は閉じたまま
- 前提: 候補が無い（訪問数が少ない）場合は far ソケットを作らず通常出口にする

#### 共通基盤: 地図の足跡（footprint）描画（implementable / 工数 S） — M05

- 仕様: mapRules: DisplayedMapGraph は 4 m セル、部屋の実寸から丸める。現行実装は mapCell の 1 矩形（外接 AABB）だけを描くため、折れ廊下や記号形の部屋が地図で矩形に潰れる。
- 方針: Minimap.drawMap と Map3D.show で、部屋ごとに `world.layoutFor(n).footprint` の各 Rect を n.placement で toWorld し、GridProjector と同じ丸め（端点を CELL で Math.round）でセル矩形に変換して描く。mapCell は位置決め・フロア判定・外接範囲の計算に引き続き使う。Map3D は BoxGeometry を矩形数ぶん並べる。layoutFor はキャッシュ済みなので毎フレームのコストは小さい。
- 前提: GridProjector/MapCell のデータ構造は変えない（セーブ互換維持）
- 前提: Adapter も footprint が無いので従来どおり bounds を描く

### Seam フォールバックの削減（生成品質）

共通基盤: (1) connectPortal / lockOrVestibule の boolean `mustSucceed` を モード `{ allowVestibule, allowSeam }` に分解する（SEAM-1/2/3/4 の前提。Seam 禁止で全候補を試す・側道は前室を挿入しない、を表現できる）。(2) `canRelayout(node) = !frozen.has(node.roomId) && !node.visited` を WorldManager に明示し、レイアウト変更（ソケット追加・Variant 変更）を行う経路は必ずこれを通す（不変条件「入室後に部屋が変わらない」をコードで保証）。(3) headless 計測基盤（SEAM-10）。WorldManager 系は DOM 非依存（document/window/THREE 参照は Game / Streaming / UI 側のみ）なので、node_modules に既にある rolldown で `src/world/WorldManager.ts + RoomGraph + data` を束ねて Node 26 で直接回せる（Node の型除去だけでは data/*.json の import に `with {type:'json'}` が無い点と `constructor(public graph)` のパラメータプロパティで失敗するため、rolldown 経由が確実）。今回の分析はこの基盤（scratchpad/seamlab/*.mjs）で実測した。

リスク: (a) 潜在バグ: tryLinkExisting / addAdjacencyLinks が既存部屋に extraSocket を足すとき、findWallBehind の既存ソケット近接判定は 1.6 m だが、生成器 placeExits の tooClose は minGap 2.4〜3.5 m。extraSocket が既存出口から 1.6〜3.5 m の位置に入ると再生成時にその出口が別位置へ移り、既に接続済みの隣室とずれ得る。新規ソケット追加系（SEAM-3）を入れる前に近接判定を 3.6 m へ揃えるべき。(b) 施錠扉が増える: 側道前室を止めると施錠扉率は 6.5%→8.3%（3/4 は壁に戻すので見える施錠扉は +約 0.5 本/部屋）。(c) 世界の質感変化: 前室 Adapter が約 1,000→約 100 に減る（進行保証扉のみ）。前室は「暗い前室」で継ぎ目を隠す仕様上の手段でもあるので、演出用の前室は別途 Modifier 側で明示的に置く前提。(d) 最終手段を施錠にした場合、戻りの無い部屋（Hole 着地・Seam 着地・エレベーター籠・開始部屋）で行き止まりになると閉じ込め（ソフトロック）になるため、そこは Seam を残す必要がある。(e) 計測値は headless の DFS 徒歩シミュレーション（frozen = 現在 + 直前の構築集合 + 訪問済み）で、実プレイ経路とは分布が異なる。目標値は「生成ノード 100 あたり」と「踏破部屋 100 あたり」を区別して置く。

#### SEAM-0 フォールバック発生条件の列挙（実測）（implementable / 工数 S）

- 仕様: 仕様 3.3 / D5: 干渉時は縮小→Adapter→locked。進行保証扉には locked を適用せず Adapter を連鎖させて必ず配置。Seam は Epic 以上のみ許可、Common〜Rare は物理配置で成立させる。現行は最終手段として進行用扉を Seam 化しログに残す。
- 方針: headless 計測（10 seed × 100 部屋踏破、4,812 ノード）で 224 件の Seam を分類した。発生条件: (1) 前室連鎖の末端: 121/224。側道扉（mustSucceed=false）にも lockOrVestibule が長さ 4/6 の前室を挿入し、その前室の唯一の出口 `end` が次の ensureNeighbors で必ず解決を要求されるため連鎖→Seam 化する（連鎖深さ 1 が 91、2 以上が 30）。(2) 扉の外は空いているが何も入らない: 168/224 は 0.3 m 先に部屋が無い。うち 141 は部屋の最小 Variant（large 系 6×7 m、medium 4.5×5、small 3.5×4、廊下 9 m）も前室 3〜10 m も入らない「細い隙間」（廊下が growToFill 対象外で 1〜3 m の隙間が残る＋hasFreeExit の枡 2.6×3.2 m が最小前室 2.3×3.3 m より小さく見通しが甘い）。(3) tryLinkExisting の拒否: 扉の裏に部屋があっても frozen（24 件。訪問済み・構築済み）、Adapter（2）、角から 0.7 m 以内や既存ソケット 1.6 m 以内の noSpan/clash、別フロア、で直結できない。(4) ensureNeighbors の再試行が 1 本目で打ち切り: hasForward が偽のとき施錠候補を順に mustSucceed=true で試すが Seam 化も「成功」扱いで break するため、2 本目以降の扉に部屋が置けても試さない。(5) 抽選が空間を知らない: 1 扉につき 1 定義しか抽選せず、その定義の Variant が全て入らないと即前室へ落ちる。(6) 副次: Hole 入口部屋は成長しない、Adapter は成長・直結の対象外、frozen の判定が部屋単位。重要な前提: Seam 化が起きた部屋は 224 件とも frozen ではない（未構築・未訪問）ので、その部屋のレイアウトはまだ変えてよい。
- 前提: ユーザーの「100 部屋あたり 3〜7 回」は生成ノード 100 あたり（実測 4.7）。踏破部屋 100 あたりでは約 22 回。以後の効果は両単位で示す。
- 前提: 計測の徒歩は未訪問の隣室を優先する DFS。frozen は Game.enterRoom と同じ「現在 + 直前に構築されていた集合 + 訪問済み」で模倣。

#### SEAM-1 側道扉には前室を挿入しない（前室は進行保証扉のみ）（implementable / 工数 S）

- 仕様: 仕様は Adapter を「干渉時の解決手段」とし、進行保証扉のみ Adapter 連鎖で必ず配置するとしている。側道扉は locked（3/4 は壁へ戻す）でよい。
- 方針: lockOrVestibule で mustSucceed=false（側道）のときは前室を試さず即 locked にする（allowVestibule=false）。前室の `end` が次の入室で必ず解決を要求される構造が Seam の主因（121/224）なので、側道由来の連鎖が消える。実測: 単独で 224→152（−32%）、前室ノード 1,024→66、施錠扉率 6.5%→8.3%。決定論・セーブ・不変条件への影響なし（配置時にしか走らない）。
- 依存: connectPortal のモードフラグ化 {allowVestibule, allowSeam}
- 前提: 前室が減って世界が「部屋と廊下の直結」中心になるのは許容（前室は演出目的では Modifier 側で明示的に置く）。
- 前提: 施錠扉は従来どおり 3/4 を壁へ戻す。

#### SEAM-2 進行保証の再試行順序: 全候補を Seam 禁止で試し切ってから Seam（implementable / 工数 S）

- 仕様: 進行保証用 Portal（未探索方向 1 本）は Adapter 連鎖で必ず配置。Seam は最終手段。
- 方針: ensureNeighbors の hasForward 偽時の再試行を 2 パスにする。パス 1: 施錠候補（door/stairs/ramp）全てを {allowVestibule:true, allowSeam:false} で試す（部屋→前室連鎖まで。失敗なら再び locked）。パス 2: 全て失敗した場合のみ 1 本を Seam 化（または SEAM-9 の方針）。現行は 1 本目で Seam 化して break している。実測: 単独では +9 件救済のみ（失敗部屋は候補が 1 本のことが多い）だが SEAM-1 と併用で 145 件救済（前室が減り候補扉が locked のまま残るため）。影響なし（配置時のみ）。
- 依存: connectPortal のモードフラグ化 {allowVestibule, allowSeam}
- 前提: 候補の試行順は現行どおり portals 配列順（決定論）。

#### SEAM-3 進行用扉を新設ソケットへ移す（未構築・未凍結の部屋のみ）（implementable / 工数 M）

- 仕様: 入室時に全 Portal の接続先を確定し、隣接部屋のレイアウトは入室前に確定していればよい（v1.2「入室後に扉や家具が変わらない」）。Seam 化した部屋は実測 224/224 が未構築・未凍結。
- 方針: パス 1（SEAM-2）が失敗し、node が !isAdapter かつ !frozen.has(id) のとき、layout.footprint の wallSpans を部屋 seed の fork('newexit') で並べ、既存ソケットから 3.6 m 以上離れた 0.5 m 刻みの位置で、外側に大きい枡（3×7.5 m → 2.2×5 → 1.3×3.6 の順）が空いている点を探す。socketOnSpan で extraSocket を追加し Portal を生成、{allowVestibule:true, allowSeam:false} で connectPortal。成功したら dirty に入れて（構築前に）再構築、失敗したら extraSocket と Portal を戻す。実測: SEAM-1/2 併用で 224→56（−75%、生成ノード 100 あたり 4.7→1.4、踏破 100 あたり 22→5.6）。extraSockets はセーブ済みフィールドなので保存・復元・決定論はそのまま。frozen 部屋には絶対に適用しない（assert）。同時に findWallBehind の既存ソケット近接判定を 1.6→3.6 m に揃え、既存出口の位置ずれ（risks (a)）を防ぐ。
- 依存: connectPortal のモードフラグ化, canRelayout(node) の明示, findWallBehind の近接判定 3.6 m 化
- 前提: 新設ソケットは扉のみ（stairs/ramp は増やさない）。
- 前提: 1 部屋につき新設は最大 1 本、成功で打ち切り。
- 前提: dirty→rebuild は現行 refreshStreaming の経路（現在の部屋以外を作り直す）で足りる。

#### SEAM-4 一段小さい定義で再抽選（空間を知る抽選）（implementable / 工数 S）

- 仕様: 仕様の (a)「テンプレートパラメータ縮小」は現行では同一定義の Variant 縮小のみ。定義そのものを小さい系（SmallRoom / Restroom）に切り替える経路が無い。
- 方針: tryPlace(room) が全 Variant で失敗したら、部屋 seed の fork(`small:${portalId}`) で baseTemplate ∈ {SmallRoom, Restroom} かつ実装済み・Common/Uncommon の定義を 1 つ抽選し、exitCount=1 で再度 tryPlace→growToFill。前室より前に試す。実測: 進行保証扉のみに限定（推奨）では SEAM-1/2/3 併用で 56→52 と効果は小さいが、抽選の偏り無し。全扉に適用すると単独で 224→167、併用で 86 まで下がるが、小部屋 396→1,099・平均床面積 454→382 m² と世界の質感が変わるため非推奨。rollRoomNode に opts.smallOnly を足す形で pickDefinition を拡張する。
- 依存: connectPortal のモードフラグ化
- 前提: 適用は進行保証扉（mustSucceed）のみ。側道は SEAM-1 で locked。
- 前提: レア度抽選はスキップし Common/Uncommon の小部屋から一様抽選（recentRarities に影響させない）。

#### SEAM-5 前室の見通しを最小部屋に揃える + 2 m ミニ前室（90° 転回）（implementable / 工数 S）

- 仕様: 仕様 (b): Adapter は幅 2.2 m × 長さ 4〜8 m、90 度転回可。現行の前室は最短 3 m（Math.max(3, length)）、hasFreeExit の枡は 2.6×3.2 m。
- 方針: (1) hasFreeExit の枡を「最小前室が実際に入るか」（2.3 幅 × 3.3 奥行）以上にし、前室配置時は `end` の先に最小前室か最小部屋が入ることまで見る（前室の末端が袋小路になるのを防ぐ。前室末端 Seam 121 件の直接原因）。(2) AdapterGenerator の下限を 2.0 m に下げ、turn 付きなら側面扉を中央（hl−1.0 → 0）に置く「戸袋」型を追加。lockOrVestibule の lengths を [4,6,8,3,2] に。実測で Seam 224 件のうち 118 件は扉外に 2.3×2.4 m の空きがあり、転回して逃げられる余地がある。生成器内部の変更なので headless で効果を計測してから採用を決める。
- 依存: SEAM-10 の計測基盤（効果の事前確認）
- 前提: ミニ前室は進行保証扉にのみ使う（SEAM-1）。
- 前提: 前室の幅は現行どおり入口幅 +1.0 m。

#### SEAM-6 frozen の緩和（構築済み・未訪問・非可視の部屋への開口追加）（defer / 工数 S）

- 仕様: 不変条件は「見えている部屋が目の前で変わらない」「訪問済みの部屋は変わらない」。閉じた扉の向こうは描画しないので、構築済みでも非可視なら再構築は見えない。
- 方針: Game.enterRoom の frozen を「現在 + 訪問済み + 開いた扉で現在から到達できる可視部屋」に絞る（RoomStreamingManager.built 全体ではなく updateVisibility の集合）。dirty→rebuild は既存経路。実測では 224→218（−3%）と効果が小さく、扉を開けた瞬間の再構築タイミングに注意が要るため後回し。
- 前提: SEAM-1〜3 導入後に残件を再計測し、frozen 起因が目立つ場合のみ着手。

#### SEAM-7 廊下も growToFill の対象にする（隙間の解消）（implementable / 工数 M）

- 仕様: 仕様: 配置後は主矩形を隣に当たるまで 0.5 m 刻みで成長させる。現行は廊下を除外（README 既知の制約: 大部屋と廊下の間に細い隙間）。
- 方針: 折れ廊下は矩形列（次セグメントが前セグメント末端の正方形に接続）なので主矩形だけ伸ばすと接続が崩れる。案: (a) 直線廊下（footprint 1 矩形）のみ幅方向（x0/x1）に成長させる、(b) 折れ廊下は最終セグメントの長さのみ伸ばす（末端の `end` ソケットは mid() で再計算されるが接続済みなら動かせないため、end 未接続の時点＝配置直後に限定）。Seam への効果は間接的（側道扉が 1〜3 m の隙間に開くケースを減らす）で未計測。SEAM-10 で効果を測ってから幅方向のみ導入。
- 依存: SEAM-10 の計測基盤
- 前提: 幅の上限は 5.0 m（TransitCorridor 上限）まで。
- 前提: 成長は配置直後（finalize 前）のみ。接続済みソケットは動かさない。

#### SEAM-8 frozen 部屋の既存施錠扉を解錠して直結（defer / 工数 M）

- 仕様: frozen 部屋に開口は足せないが、既に壁に開いている施錠扉（1/4 残し）を解錠して接続先にするなら形状は変わらない。
- 方針: 新部屋の扉が frozen 部屋の壁に面したとき、その壁の同方向の施錠扉が 1.2 m 以内にあれば新部屋側のソケットをそこへ合わせて追加し、施錠扉の locked=false・target を設定。実測: Seam 224 件のうち frozen 壁が背後にあるのは 25 件、そのうち 6 m 以内に施錠扉があるのは 4 件で、期待効果が 2% 未満。実装コストに対して効果が薄いので保留。

#### SEAM-9 削減しきれない残件の扱い（Seam 扉 か 施錠＝デッドエンド か）（needsDecision / 工数 S）

- 仕様: 仕様: Common〜Rare は Seam 禁止。進行保証扉には locked を適用しない。一方で「デッドエンドは全体の 10〜20% 程度を許容」（3 章）。施錠扉の文言は「この扉は開かなそうだ」。
- 方針: SEAM-1〜5 導入後の残件は生成ノード 100 あたり約 1.2〜1.4（踏破 100 部屋あたり約 5）。方針 A: 現行どおり Seam 扉（閉扉→フェード遷移、地図は「？」）。方針 B: 施錠して行き止まりにする（hasForward の WARN は残すが Seam にしない）。ただし戻り Portal の無い部屋（Hole 着地・Seam 着地・エレベーター籠・開始部屋・entryIsReturn=false）で B を取ると閉じ込めになるので、その部屋だけ A を残す（ハイブリッド）。実装は lockOrVestibule の最終分岐で node.entryIsReturn && 親が配置済み なら locked、そうでなければ seam。
- 前提: 残件率が 2%/ノード以下になったことを SEAM-10 で確認してから方針を適用。
- 前提: 方針 B のデッドエンド率は仕様の 10〜20% 許容内（現行の施錠扉 3/4 壁戻しは維持）。
- 質問: 削減後も残る進行不能な扉（踏破 100 部屋あたり約 5 件）をどう見せるか 選択肢: A: Seam 扉のまま（開けた瞬間に座標遷移。地図に「？」。Common〜Rare でも稀に非ユークリッド遷移が起きる） / B: 施錠して行き止まり（「この扉は開かなそうだ」。戻って別ルートへ。ただし戻りの無い部屋では閉じ込めになる） / C: ハイブリッド。戻りがある部屋は B（施錠）、戻りの無い部屋（Hole/Seam 着地・開始部屋）だけ A（Seam） 推奨: C

#### SEAM-10 headless 計測スクリプト（Node / rolldown）（implementable / 工数 S）

- 仕様: README のテスト方法はブラウザで game.step() を回し world.log の 'WARN seam fallback' を数える手法。Node で WorldManager を直接動かせるかの調査と設計。
- 方針: WorldManager → generators / data / GridProjector / RarityGenerator / rng / aabb / types は DOM・THREE 非依存（document/window/performance/localStorage の参照は Game / RoomStreamingManager / UI / Save のみ）。Node 26 の型除去単体では (1) data/*.json の import に `with { type: 'json' }` が無い、(2) `constructor(public graph)` のパラメータプロパティ、で失敗するため、vite 8 が同梱する rolldown（node_modules/rolldown）で `entry.ts`（WorldManager, RoomGraph, ROOM_BY_ID, footprint ヘルパを再エクスポート）を platform:'node' で ESM に束ねて実行する。スクリプト設計: (a) `new WorldManager(new RoomGraph(seed))` → createStartRoom、(b) enter(id) = markVisited → frozen = {現在} ∪ 直前の構築集合（現在 + placedNeighbors）∪ 訪問済み → prepareRoom → 構築集合更新（Game.enterRoom と同じ順序）、(c) 未訪問の配置済み隣室を優先する DFS で N 部屋踏破、(d) 指標: log の seam fallback 数 / forward 未保証数、ノード数、部屋数、前室数、施錠扉率、平均床面積、Seam の親生成器・連鎖深さ・扉裏の状態（free / frozen / adapter）の分類、(e) 同 seed 2 回の graph.toJSON 一致と、toJSON→fromJSON 後の全ノード layoutFor のソケット一致でセーブ整合を確認。実測: 20 seed × 100 部屋で 2.3 秒、決定論・ロード後再生成の不一致 0。プロトタイプは scratchpad/seamlab/{build.mjs, measure.mjs, diag.mjs, fixes3.mjs, determinism.mjs}。プロジェクトへは tools/seam-stats.mjs（build + run）と package.json の `seamstats` スクリプトとして追加する。
- 前提: rolldown はプロジェクト直下 node_modules のものを使う（追加依存なし）。
- 前提: 計測スクリプトは読み取り専用でプロジェクトの src を変更しない。効果検証は prototype 同様に prototype ではなく実装後の本体コードで再計測する。

## v1.3 決定（2026-09-16。第 3 回回答の反映）

上記の質問 Q1〜Q12 への回答と追加決定（しゃがみ / R16 / 保留・代替）を、設計資料 v1.3（Desktop の xlsx / docx）と `data/*.json` に反映した。資料側では決定事項 D11〜D26 として 09 シート / 18 章に追記している。

| 質問 | 決定 | 資料・データへの反映 |
| --- | --- | --- |
| しゃがみ（新規 D11） | PC: 左 Ctrl または C を押している間。スマホ: JUMP の上に CROUCH（タップでトグル）。当たり判定 0.85 m / 視点 0.75 m / 速度 ×0.5 / ダッシュ不可 / ジャンプ可。頭上が塞がっていれば立てない。crawl 開口は高さ 1.0〜1.2 m | xlsx 10_操作仕様（しゃがみブロック追加）、docx 17.1 / 17.2 / 17.3 / 17.6、05 シート・11 章の InputController.crouch / PlayerState、rules.json `controls` |
| Q1 GravityAxis（D12） | E10 オミット。E03 は見た目だけ横倒し（中身を 90° ロール生成）。床の扉 = hole ソケット + 扉パネル（Hole 動作）。壁の扉 = 横長スロット 2.1×1.0 m・下端 0.6 m → 'crawl' Adapter（床 0.6 m → 段で 0 m） | E03 の connectionRule / notes / params（visualOnly, rollDeg, floorDoors, wallDoors）、03 シート GravityAxis 行、docx 6 章 |
| Q2 巨大部屋（D13） | B。RoomBuilder チャンク分割（軸並行格子 24〜32 m、Group + AABB、距離 / 視錐台）+ 時間分割ビルド。Mega 60〜160 m（xl 200 m）、Street 64 m から。地図は Legendary 80 セル上限・実寸 + ゾーン内訳線 | 02_Generator一覧「状態 (v1.3)」列、04 シート step 9 / 12、11 シート P17 / M1 / M10、docx 5.2 / 8 章 / 9.4 / 15 章 |
| Q3 Seam 残件（D14） | B。施錠して行き止まり（閉じ込め許容）。緊急 Seam フォールバック廃止。Seam は意図的用途のみ（EV、Legendary 遠方配置、FarLink / FakeExit / LoopTopology / MultiEdge / ObservationRewire / DynamicMapNode / VehicleRide / NonEuclideanVolume） | 11 シート P3 / P4 / P6 / P8、07 シート Seam 行、docx 0 章プロンプト / 3.1 / 3.2 / 3.3 / 4 章 / 9.1 / 9.2 / 16 章 DoD・避けるべき実装 |
| Q4 FogDepth（D15） | B（A の入室時補間を基盤にして材質 variant の部屋別 fog へ発展） | 03 シート FogDepth 行、docx 6.3 / 10 章 |
| Q5 VehicleRide（D16） | C。車内で durationSec 待つ（窓の流光 + 微振動、視点のみ操作可）。5 秒後は E / タップで到着を早められる。到着先は 'platform' Adapter | E11 / L02 / L11 の params に `skipAfterSec: 5`、03 シート VehicleRide 行、docx 3.1 Portal.ride / 17.5 |
| Q6 M10（D17） | オミット。RewindState は保留 | 01 シート「状態」= オミット (v1.3)、rooms.json `omitted[]`、modifiers.json `deferred: true` |
| Q7 M20（D18） | オミット。HubGenerator 不要。FarLink は M08 のみ | 同上 + 02_Generator一覧 Hub「v1.3 保留」、03 シート FarLink 使用部屋 M08 |
| Q8 音（D19） | C。全音 WebAudio 合成 + public/audio/manifest.json で差し替え（合成フォールバック） | 03 シート AudioEvent 行、05 シート AssetManifest、docx 6.2 / 10 章 |
| Q9 M05（D20） | オミット。GraphMacroGenerator 不要 | 01 シート状態 / rooms.json omitted / 02_Generator一覧 GraphMacro「v1.3 保留」 |
| Q10 R09（D21） | a。劇場内の固定カメラ映像に自分が 3 秒遅れて映る | R09 params に `source: "theaterCamera"`、03 シート PastWindow 備考 |
| Q11 M15（D22） | オミット。RenderStyle backside 保留（untextured / legacy のみ） | 01 シート状態 / 03 シート RenderStyle params・状態 |
| Q12 M06（D23） | オミット。DiscoveryGate 保留 | 01 シート状態 / modifiers.json deferred |
| R16 小型扉（D24） | 0.7×1.2 m（sill 0）→ 'crawl' Adapter → 通常の部屋（近道）。巨大扉は壁面の偽扉 | R16 connectionRule / notes / params `smallDoor: "crawl"`、03 シート ScaleAnomaly 備考 |
| 保留・代替（D25） | FutureAudio 実装なし、L02 浅水 0.5 m + 桟橋、M07 / E13 外殻固定、E12 静止画 3 枚、R18 / R15 バイアスは拡張点、U06 3:17 装飾、300 m / 5 街区はデータ上限のみ | L02 params（depth 0.5, pier）、E12 params（snapshotIntervalSec 10, snapshotCount 3）、各部屋 notes、03 シート備考 |

### データ側の変更点（`tools/xlsx_to_json.py`）

- 01 シートに「状態」列（有効 / オミット (v1.3)）を追加。`xlsx_to_json.py` は「状態」がオミットで始まる行（無ければ実装メモ先頭の「オミット」）を `rooms` から除外し、`rooms.json.omitted[]` に `status: 'omitted'` / `omitReason` 付きで残す。`rooms.json.rooms` は 112 件。既存の読み手（`src/data/index.ts`）は `.rooms` だけを見るので後方互換。
- `modifiers.json`: `usedBy` はオミット部屋を除く。`status`（03 シート「状態 (v1.3)」）と `deferred`（状態が「保留」で始まる、または使用部屋なし）を追加。deferred = FutureAudio / RewindState / DiscoveryGate。
- `templates.json`: `generators[].status` と `templates[].status` を追加（GraphMacroGenerator / HubGenerator、GraphMacro / HubRoom が「v1.3 保留」）。
- `rules.json`: `placementRules` 18 件（P15 低い開口、P16 床の扉、P17 巨大部屋、P18 乗り物）、`mapRules` 10 件、`controls` に「しゃがみ（v1.3 D11）」ブロック。
- `tools/modifier_params.json` は scratchpad の `gen_params.py`（mapping.py の ROOM_MAP から生成）で再生成。E03 / R09 / R16 / E11 / E12 / L02 / L11 の params に v1.3 のキーを追加（既存キーは維持）。
- 資料生成パイプライン: scratchpad の `mapping.py`（VERSION 1.3、DECISIONS_V13、OMITTED_V13、CROUCH_RULES、GENERATOR_STATUS、MODIFIER_STATUS、CONNECTION_RULE_CHANGES、CHANGELOG_V13）→ `edit_xlsx.py` / `edit_docx.py` が backup_v1.0 の原本から out/ を生成 → Desktop へコピー。docx の validate.py は v1.0 原本から存在する 4 件（tcMar / shd の順序、settings.xml zoom percent）のみで、新規エラーなし。

### 実装への含意（この節を読む担当向け）

- 抽選（RarityGenerator / pickDefinition）は `rooms.json.rooms` のみを候補にすればオミット部屋は自然に外れる。`src/data/index.ts` の `OMITTED_ROOM_IDS` による二重ガードはそのまま有効。
- Seam フォールバック（WorldManager.lockOrVestibule の最終分岐）は「施錠」に置き換える。`hasForward` の WARN は残してよいが Seam は作らない。Seam を作れるのはエレベーター、Legendary 遠方配置、Modifier 由来（FarLink / FakeExit / LoopTopology / MultiEdge / ObservationRewire / DynamicMapNode / VehicleRide / NonEuclideanVolume）だけ。
- しゃがみは PlayerController の当たり判定高さ・視点高さ・速度・立ち上がり判定と、InputController の `crouch`（PC は押下中、スマホはトグル）で実装する。低い開口の互換判定は `Socket.sill / crawl` と `EntryReq.height / sill / crawl`、Adapter は `AdapterKind 'crawl'`。
