/**
 * 案の台帳・フロアの形（docs/stage4-workstreams.md）。この担当だけがこのファイルを書き換える。
 * 受け持つ案の番号は index.ts の OWNERS。書き方は types.ts。
 *
 * 実装の種類 'structure' の id はフロアの形の型（core/gen/floor/themes.ts の PatternId）。見本: クライアントの ?shape=<型>
 * （その型のフロアから始める）。型の出やすさは系統の重み × 調整表 structure.w.<型>、珍しい型は珍しいフロアだけ（PATTERN_INFO）。
 */
import type { CatalogEntry } from './types.ts';

export const STRUCTURE_CATALOG: CatalogEntry[] = [
  {
    idea: 'F01', name: '区画の格子', status: 'existing', impl: [{ kind: 'structure', id: 'grid' }],
    note: '段階 3 の grid（深さ優先の木 + ループ）。段階 4 の型の多くも、この格子の上の骨組みとして作る',
  },
  {
    idea: 'F02', name: '分棟', status: 'done', impl: [{ kind: 'structure', id: 'wings' }],
    note: '2〜3 棟（2 列ずつ）の間の列を、屋外の渡り廊下（天井なし・手すりの胸壁・街灯・灰色の霧）でまたぐ。棟ごとに系統（施設）が違う（学校の棟の隣が病院の棟）。外へ出た瞬間に音と霧が変わり、渡った先は別の施設',
  },
  {
    idea: 'F03', name: 'くねる部屋の連なり', status: 'done', impl: [{ kind: 'structure', id: 'chain' }],
    note: '廊下が無い。区画いっぱいの部屋どうしが壁 1 枚の扉で直接つながる（深さ優先の木なので部屋から部屋へくねくね続く）。扉の位置は辺のどこか（ずれていて先が読めない）。たまに隣どうしに 2 つ目の扉（回り道）',
  },
  {
    idea: 'F04', name: '高さの違う区画', status: 'existing', impl: [{ kind: 'structure', id: 'grid' }],
    note: '段階 3 の levelChance（つなぎごとに半階の段差・階段）。どこでも段差だらけにした型は F13',
  },
  {
    idea: 'F05', name: '中庭を囲む', status: 'done', impl: [{ kind: 'structure', id: 'courtyard' }],
    note: '外周の部屋（区画いっぱい・壁 1 枚でつながる輪）が、屋外の中庭（芝・煉瓦の壁・噴水・街灯・霧。天井なし）を囲む。どの部屋にも中庭へのガラス窓があり、2〜3 の部屋から中庭へ出られる。ぐるりと回るか、中庭を突っ切る近道か',
  },
  {
    idea: 'F06', name: '二重ループ', status: 'done', impl: [{ kind: 'structure', id: 'shortcut' }],
    note: '入口の部屋の隣が出口の部屋。ガラス窓越しに出口の緑の灯りが見えるのに、間の扉は出口の側からしか開かない（調べるとガタつく）。入口から出口へは、フロアをぐるりと回る長い道（木を何本か作って最も遠回りのもの）。着いた側からは扉が近道として開く',
  },
  {
    idea: 'F07', name: '入れ子のループ', status: 'done', impl: [{ kind: 'structure', id: 'loops' }],
    note: '外周を一周する大きな輪と、片側の内に 2×2 の小さな輪（大きな輪と 2 か所でつながる）。回っているうちに同じ曲がり角へ戻ってくる。残りの区画は輪から枝の部屋',
  },
  {
    idea: 'F08', name: 'ハブと放射', status: 'existing', impl: [{ kind: 'structure', id: 'hub' }],
    note: '段階 3 の hub（中央の広間から十字に廊下、腕の先と脇に部屋。何度もロビーへ戻る）',
  },
  {
    idea: 'F09', name: '櫛形', status: 'existing', impl: [{ kind: 'structure', id: 'comb' }],
    note: '段階 3 の comb（真ん中の行の背骨の廊下に、行き止まりの小部屋の列）',
  },
  {
    idea: 'F10', name: '環状', status: 'existing', impl: [{ kind: 'structure', id: 'ring' }],
    note: '段階 3 の ring（外周を一周できる。内側は外周からの枝）',
  },
  {
    idea: 'F11', name: '同心円', status: 'done', impl: [{ kind: 'structure', id: 'concentric' }],
    note: '外の輪 → 内の輪 → 中心。内へ行くほど通路は狭く（2.0 → 1.5 m）、照明は消えかけ、壁と床はコンクリートに、霧は濃く、床に染み。輪は左右の真ん中で切れていて、奥の半分へは中心を通らないと行けない（入口は手前・出口は奥）',
  },
  {
    idea: 'F12', name: '螺旋', status: 'done', impl: [{ kind: 'structure', id: 'spiral' }],
    note: '真ん中の吹き抜け（底に水）の周りを、四角い回廊が辺ごとに段で下りながら何周もする（shapes/spiral.ts）。内側は手すりで、吹き抜けの向こうに上下の回廊が見える。外側に部屋の扉。いちばん下の回廊に出口',
  },
  {
    idea: 'F13', name: 'スキップフロア', status: 'done', impl: [{ kind: 'structure', id: 'skip' }],
    note: '区画の高さが市松に半階ずつ違い、どのつなぎも半階の階段を上るか下る（区画の間隔を広げて階段を必ず収める）。どの部屋も隣の部屋とは半階ずれている',
  },
  {
    idea: 'F14', name: '中二階の重なり', status: 'done', impl: [{ kind: 'structure', id: 'gallery' }],
    note: '真ん中の広間が上の階まで吹き抜けで、壁沿いに中二階の回廊（ガラスの手すり越しに下の床が見える）と、回廊へ上る長い階段。回廊からだけ入れる上の階の部屋がある（shapes/styles.ts gallery）',
  },
  {
    idea: 'F15', name: '立体交差', status: 'done', impl: [{ kind: 'structure', id: 'crossing' }],
    note: '上の階（入口）の廊下が奥の行を横切り、下の階の廊下が 1 つの列を縦に貫く。交わる所は上の床がガラスで、下の曲がり角は天井が抜けている（上からは下の廊下、下からは上の廊下が見える）。奥の角の階段室で下り、交差の下をくぐって出口へ',
  },
  {
    idea: 'F16', name: '島と橋', status: 'done', impl: [{ kind: 'structure', id: 'islands' }],
    note: '部屋は柱で支えられた島で、つなぎは全部、手すりの付いた細い橋（1.7 m）。曲がり角は屋外の小さな足場。下は暗い奈落か水面（フロアに 1 つの「下」の区画を橋から窓の portal で見せる）',
  },
  {
    idea: 'F17', name: '入れ子の部屋', status: 'done', impl: [{ kind: 'structure', id: 'nest' }],
    note: '2×2 の大部屋の中に部屋、その中にさらに小部屋（中の部屋は外の部屋の床から天井の手前まで。外の壁は中の部屋の高さで切る）。扉は互い違いの辺にあり、毎回まわりを回り込んで入る。いちばん奥には椅子が 1 脚と床の灯りだけ',
  },
  {
    idea: 'F18', name: '巨大空間の中の建物', status: 'done', impl: [{ kind: 'structure', id: 'megahall' }],
    note: '天井 9 m の 3×2 の空間（体育館・倉庫）の真ん中に、外壁が板張り・トタンの小さな建物（中は系統に合った部屋: 事務所・教室・家・売店 …）。扉と窓があり、外から中が少し見える',
  },
  {
    idea: 'F19', name: '鏡写しのフロア', status: 'done', impl: [{ kind: 'structure', id: 'mirror' }],
    note: '真ん中の列で左右対称（骨組み・部屋の大きさ・テーマ・家具まで鏡写し。家具は中身を置いた後に左から右へ写す shapes/finish.ts）。片側だけ違う: 右側のつなぎが 1 つ無い（部屋が 1 つ足りない）・1 組の部屋だけ家具が違う・仕掛けや異変は片側だけ。真ん中の列は奥で切れていて、左右どちらかへ回る',
  },
  {
    idea: 'F20', name: '縮むくり返し', status: 'done', impl: [{ kind: 'structure', id: 'shrink' }],
    note: '同じ「廊下 + 部屋」の組がくり返すたびに 0.84 倍に縮む（天井・扉・家具も。家具は最初の部屋の家具を縮めて写す）。最後の方はしゃがまないと通れない（shapes/shrink.ts）',
  },
  {
    idea: 'F21', name: '表と裏の動線', status: 'done', impl: [{ kind: 'structure', id: 'staff' }],
    note: '手前は客用の廊下と部屋、奥の行は従業員用の裏の通路（狭い 1.4 m・低い・コンクリートと配管の色・暗い）。客用とは両端と真ん中の「関係者以外」の金属の扉でつながり、部屋の半分は裏口がある。出口は裏の通路の奥の設備室（裏へ回らないと出られない）',
  },
  {
    idea: 'F22', name: '天井裏・床下の網', status: 'done', impl: [{ kind: 'structure', id: 'crawl' }],
    note: '天井裏の網にした（床下は床を全部上げる必要があるため）。いくつかの部屋の壁際に、天井の点検口へ上る急な梯子段。上は高さ 1 m の天井裏の通路（しゃがんで進む）で、背骨と枝で別の部屋の点検口へ抜けられる（shapes/crawl.ts）',
  },
  {
    idea: 'F23', name: '縦に積んだビル', status: 'done', impl: [{ kind: 'structure', id: 'tower' }],
    note: '3×3 の区画を 2〜3 階積み、階ごとに系統（施設）が違う。手前の角の階段室（折り返し階段・防火扉）でつながる。3 階なら階段室は左右の角に 1 つずつ（真ん中の階を横切る）。入口は上の階、出口はいちばん下の階（shapes/well.ts）',
  },
  {
    idea: 'F24', name: 'エレベーターホールの中心', status: 'done', impl: [{ kind: 'structure', id: 'elevator' }, { kind: 'part', id: 'shaftLift' }],
    note: 'どの階も真ん中にエレベーターホール。奥の 2 基のかごに乗ってボタンを押すと、扉が閉まって揺れ、次の階（別の系統の施設）のかごの中で扉が開く（同じ形のかごどうしの継ぎ目の無い移動）。かごの扉の上の色が階ごとに違う。階段室もある',
  },
  {
    idea: 'F25', name: '緊張と解放の交互', status: 'done', impl: [{ kind: 'structure', id: 'linear' }],
    note: '段階 3 の linear を強めた: 曲がり角につながる廊下は幅 1.25 m・天井 2.15 m の狭く低い通路、その間の部屋は天井 6 m の広い空間',
  },
  {
    idea: 'F26', name: '一方通行の近道', status: 'existing', impl: [{ kind: 'secret', id: 'loop' }, { kind: 'structure', id: 'shortcut' }],
    note: '段階 3 の隠し通路の出口（openSide の扉。通路の側からだけ開く）。フロアの形では F06（出口の側から開く扉）・F29（下りる側から開く扉）でも使う',
  },
  {
    idea: 'F28', name: '別室', status: 'done', impl: [{ kind: 'anomaly', id: 'privateRoom' }],
    note: '普通の扉の先の行き止まりの部屋に、まれに異変を 3 つ重ねた個室（色の異変 + 時計だらけ + 逆さま など、組み合わせは毎回違う）[QR 特殊個室]',
  },
  {
    idea: 'F29', name: '下るだけのフロア', status: 'done', impl: [{ kind: 'structure', id: 'descent' }],
    note: '本道のつなぎは、黄色い線の先で飛び降りる段差（1.6 m。跳んでも上がれない）か、下へ下りる側からしか開かない扉の階段。上へは戻れないが、脇道は平らな行き止まりで、どの区画からも出口へ行ける',
  },
  {
    idea: 'F31', name: '吹き抜けの縦穴', status: 'done', impl: [{ kind: 'structure', id: 'shaft' }],
    note: '真ん中の区画が縦穴。まわりは手すりの回廊で、上下に 3 階ずつ「ほかの階の回廊」（暗い出入り口・まばらな灯り）が見え、底は水、遥か上に天窓。手すりの 1 か所が壊れていて（黄色い線）、飛び込むと 2 つ先のフロアへ',
  },
  {
    idea: 'F32', name: '迷路フロア', status: 'done', impl: [{ kind: 'structure', id: 'maze' }],
    note: '段階 3 の maze（狭い通路の網）に、出口を 2 つ足した（外周の行き止まりの奥）。出口ごとに行き先が違う: 次の深さ・次の深さの裏のフロア・2 つ先のフロア',
  },
  {
    idea: 'F33', name: '屋上', status: 'done', impl: [{ kind: 'structure', id: 'rooftop' }],
    note: '屋外の屋上（天井なし・灰色の霧・四方は胸壁と高い金網）。階段の小屋（入口）・機械室・給水塔・室外機。一段高い屋上へ上る段。出口は屋上の縁から下りる外の非常階段（shapes/rooftop.ts）',
  },
  {
    idea: 'F34', name: '地下街', status: 'done', impl: [{ kind: 'structure', id: 'arcade' }],
    note: '系統「地下街」: 天井 2.4 m の広い通路の網（ループが多い）。通路の真ん中に柱の列、両側はシャッターの降りた店・灯りの点いたショーウィンドウ・光る看板。店の多くは扉の無い店先。曲がり角の柱に案内の看板',
  },
  {
    idea: 'F35', name: '鉄道の駅と車両', status: 'done', impl: [{ kind: 'structure', id: 'station' }, { kind: 'part', id: 'trainRide' }],
    note: '深さの決まった所から 2〜3 フロア続く駅の線。コンコースから階段でホームへ下りると、線路の溝に車両が止まっている。乗ってしばらくすると扉が閉まり、窓の外を灯りが流れ、隣の駅（次のフロア）の車両の中に着く（続く駅なら扉が開いてまたホーム）。ふつうの出口の階段もある',
  },
];
