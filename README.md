# SURVIVE THE NIGHT 🔥

無人島に漂着したあなたは、夜になる前に火を起こせるか？

ゲーム開始から火力100%になるまでのタイムを競う、ブラウザで遊べるスマホ対応のサバイバル・タイムアタックゲームです。

## ゲーム概要

1. **装備選択** — 🔥ファイヤースターター / 🍖非常食 / 🏕️シェルターから1つを選ぶ
2. **素材集め** — 森の地面に散らばる素材（毎回20種類の中から10〜12個が出現）から4〜5個タップして集める
3. **PHASE 1 摩擦** — 画面中央の木の棒の周りを指（PCはマウス）でぐるぐる回し、摩擦熱を100%まで上げる。回転が遅い/止まると熱はすぐ下がる
4. **PHASE 2〜3 火種→息吹き** — 摩擦熱100%で赤い火種が生まれる。放置すると火種は消えて摩擦フェーズに逆戻り。長押しで息を吹きかけ、炎を100%（焚き火）まで育てる。「吹きすぎたら消える」という失敗は無く、酸素量が理想値から離れるほど成長が少し緩やかになるだけの、易しい調整
5. **🔥 FIRE!** → **結果画面** — クリアタイム・サバイバル力スコア・ランクを表示し、SNSでシェアできる

火の状態は常に画面中央のビジュアル（木屑→煙→火種→炎→焚き火）と直結しており、ゲージは補助情報として控えめに表示されます。集めた素材（火口/焚き付け/燃料）は最初から地面に見える形で配置され、その品質が回転の重さや炎の育ちやすさに自動的に反映されます。天候（晴れ/強風/小雨/激しい雨）はランダムに決まり、**プレイ中に0〜2回変化することもあります**（予兆演出つき）。雨は炎そのものを弱らせ、強風は小さな炎を消しかけ突風を起こし、装備の選び方によって有利不利が変わります。

## 起動方法

```bash
npm install
npm run dev
```

ブラウザで表示された `http://localhost:5173` を開いてください（スマホ実機で確認する場合は `npm run dev -- --host` でLAN内に公開できます）。

本番ビルド:

```bash
npm run build   # dist/ に出力
npm run preview # ビルド結果をローカルで確認
```

## ディレクトリ構成

```
src/
  config.ts        # GAME_CONFIG — 全てのゲームバランス値を集約
  types.ts          # 型定義（GameState, Material, WeatherEvent, ScoreBreakdown など）
  state.ts           # グローバルストア（購読可能なシンプルなストア）
  weather.ts          # 天候の抽選・タイムライン生成・予兆演出の強度計算
  environment.ts       # 画面遷移をまたいで動く環境ティッカー（天候進行/突風/雷/湿度/夜の暗さ/木々の揺れ/中央トースト）
  materials.ts          # 素材プールの抽選・役割(火口/焚き付け/燃料)ごとの集計・各種係数計算
  scoring.ts             # サバイバル力スコアの計算・タイムフォーマット
  fireCanvas.ts           # Canvasパーティクルシステム（炎・煙・火の粉・雨・葉/砂埃）
  equipment.ts             # 装備（FIRE KIT/FOOD/SHELTER）の表示メタ情報
  share.ts                  # Web Share API（画像つき） / X 共有用の文言・URL生成・保存
  share/
    rankPresets.ts            # ランクごとのキャラクター画像パス・一言診断・火の強さ
    ResultCardGenerator.ts     # Result Card（1200x630 PNG）をCanvasで生成
  ui.ts                      # 画面共通の小さなヘルパー（天候チップ、タイマー表示、clamp）
  main.ts                     # ルーター（画面のマウント/アンマウント・環境レイヤーの初期化）
  screens/
    start.ts                 # STEP0 装備選択画面
    gather.ts                 # STEP1 素材集め画面（森の地面スキャッター配置）
    firepit.ts                 # PHASE1-3 摩擦→火種→息吹き を1画面で担当
    result.ts                    # 結果画面（スコア・シェア・リトライ）
    debug.ts                      # デバッグパネル
```

摩擦（回転）・火種・息吹きは体験として地続きなので、画面遷移をはさまず [`src/screens/firepit.ts`](src/screens/firepit.ts) 1つの中でサブフェーズ（`rotate` → `breath`）を切り替えます。中央のビジュアル（回転する棒・木屑・煙・火種・炎）は [`src/fireCanvas.ts`](src/fireCanvas.ts) が一括で描画します。

state / scoring / weather / environment / fire simulation / UI / share を分離しているので、
「スコア配分だけ変えたい」「天候の効果だけ調整したい」といった変更は該当ファイルだけ触れば完結します。

## GAME_CONFIGの変更方法

すべてのゲームバランス値は [`src/config.ts`](src/config.ts) の `GAME_CONFIG` にまとまっています。値を変えて保存するだけで、コードの他の部分に触れずに難易度調整ができます。

主なパラメータ:

| カテゴリ | 主な項目 | 説明 |
|---|---|---|
| `weather.probabilities` | 晴れ45 / 強風25 / 小雨20 / 激しい雨10 | ゲーム開始時の天候の出現確率（合計100） |
| `weather.frictionMultiplier` / `fireGrowthMultiplier` | 各天候ごとの倍率 | 回転・火力成長への影響 |
| `weather.passiveFireDecayPerSecond` | 雨1.1 / 嵐3.4 | 酸素管理と無関係に常時かかる炎への直接ダメージ |
| `weather.windWeakFireThreshold/ShrinkPerSecond` | 30 / 3.2 | 強風時、小さな炎が消えかける速さ |
| `weather.shelterMitigation` | 0.6 | シェルター装備時の悪天候軽減率 |
| `weatherDynamics.transitionCountWeights` | `{0:30, 1:50, 2:20}` | 1プレイ中に天候が何回変化するか（0〜2回）の重み |
| `weatherDynamics.minGapSeconds/maxGapSeconds` | 16〜48秒 | 天候変化どうしの間隔 |
| `weatherDynamics.foreshadowLeadSeconds` | 6秒 | 変化の何秒前から予兆演出を始めるか |
| `gust.*` | 発生間隔・酸素スパイク量・火力への影響 | 強風時にランダムで起きる突風の挙動 |
| `lightning.*` | 発生間隔・フラッシュ時間 | 激しい雨（storm）時の雷演出 |
| `wetness.*` | 蓄積/乾燥速度・最大減衰率 | 雨で素材が湿っていく速さと効果減衰 |
| `nightCycle.breakpoints` | 経過秒数ごとの暗さ | タイムプレッシャー演出（夕方→夜） |
| `equipment.fire` | `startingHeat: 40` | ファイヤーキットの初期熱ボーナス（回転速度は`rotate.fireKitHeatMultiplier`） |
| `equipment.food` | `heatDecayMultiplier: 0.6`, `resetRecoveryBonus: 8` | 非常食の効果（火が消えて摩擦フェーズへ後戻りしたときの復帰が早い） |
| `materials.pool` | 各素材の `role`（火口/焚き付け/燃料）と `quality` | 判断力スコアと回転・燃焼速度に影響 |
| `materials.missingRoleBaseline` | 12 | ある役割を1つも選ばなかった場合の仮の効率値 |
| `rotate.*` | `minAngularSpeed`, `heatGainPerRadPerSecond`, `fireKitHeatMultiplier` | PHASE1（回転）の難易度 |
| `ember.*` | `initialPowerBase`, `neglectDecayPerSecond`, `fragileFireThreshold` | 火種ができた直後の脆さ・放置減衰 |
| `breath.*` | `optimalOxygen`, `bellWidth`, `minGrowthMultiplier`, `fireGrowthPerSecond` | PHASE3（息吹き）の育ちやすさ |
| `score.weights` | 判断力30 / 技術25 / 管理25 / スピード20 | スコア配分（合計100） |
| `ranks` | 称号としきい値 | サバイバルランクの境界点 |

## 素材の役割（火口・焚き付け・燃料）

素材には内部的に3つの役割があり、プレイヤーには表示されません（自分で判断してもらうため）。ゲーム開始時に選んだ素材は、火おこし画面にもそのまま地面に散らばって表示されます。

- **Tinder / 火口** — PHASE1（回転）の摩擦熱の上がりやすさを主に左右する。枯れ葉・乾いた草・綿毛など。火種ができる瞬間に燃え尽きて画面から消える
- **Kindling / 焚き付け** — PHASE3序盤（火力45%未満）の炎の育ちやすさを左右する。乾いた小枝・松ぼっくり・樹皮など
- **Fuel / 燃料** — PHASE3終盤（火力45%以上）の炎の育ちやすさを左右する。太い乾燥枝・流木など

薪をくべる操作は無く、集めたKindling/Fuelの品質は息を吹いている間ずっと自動的に成長速度へ反映されます（`materials.ts`の`fireGrowthFactor`）。役割を1つも選ばないと、その役割は`materials.missingRoleBaseline`相当の低い効率として扱われます。特に**燃料を1つも選ばなかった場合、火力80%を超えたあたりで成長が少し鈍化**します。逆に火口だけを高品質で揃えても、焚き付け・燃料が無ければ着火は速くても炎を大きく育てにくくなります。「火口＋焚き付け＋燃料」のバランスが最も強い組み合わせです（ただし必須ではなく、多少偏っていても時間をかければクリアできる難易度に調整しています）。

湿った素材や、雨で時間経過とともに湿っていった素材（`wetness`）は`wetSensitive: true`の場合に効率が落ちます（`materials.ts`の`effectiveQuality`）。

## スコア計算方法

ゲーム終了時に100点満点の「サバイバル力」を算出します（[`src/scoring.ts`](src/scoring.ts)）。

- **判断力（30点）** — 集めた素材の平均品質（65%）と、火口/焚き付け/燃料をバランスよく揃えられたか（35%）の合算
- **火おこし技術（25点）** — PHASE1（回転）の所要時間。`score.idealFrictionSeconds` より速いほど満点に近づく。火種を放置して摩擦フェーズへ後戻りした回数も減点
- **火の管理（25点）** — 息吹き中、酸素量が理想値（`breath.optimalOxygen`）にどれだけ近かったかの平均効率
- **スピード（20点）** — ゲーム開始から成功までの合計タイム。`score.speedFullMarkSeconds` 以内なら満点

合計スコアに応じて `GAME_CONFIG.ranks` からサバイバルランクが決まります（都会に帰ろう 〜 人類代表）。

自己ベストタイムは `localStorage`（キー: `survival-fire-best-time`）に保存され、更新時に「NEW RECORD!」が表示されます。

## 天候確率と天候の変化

ゲーム開始時、以下の確率で最初の天候が決まります（`GAME_CONFIG.weather.probabilities`）。

- ☀️ 晴れ: 45%
- 💨 強風: 25%（火が育つと逆に燃焼速度がブースト。ランダムで突風が発生し、酸素ゲージが急上昇する）
- 🌧️ 小雨: 20%（素材が時間経過で湿っていく）
- ⛈️ 激しい雨: 10%（もっとも難しい。ランダムで雷が発生し、画面が一瞬明るくなる）

🏕️ シェルターを選んでいる場合、悪天候の影響（燃焼速度・湿度蓄積）を60%軽減します。

さらに、天候は**1プレイ中に0〜2回変化することがあります**（`weatherDynamics`）。変化の6秒前から木々の揺れや雨の気配が少しずつ強まる「予兆」演出が入り、変化の瞬間に画面中央へ「風が強くなってきた…」「雨が降り始めた…」といったトーストが表示されます。

また、経過時間に応じて画面が夕方→夜→ほぼ真っ暗へと暗くなっていきます（`nightCycle`）。火力が上がるとその周囲だけが暖色に照らされ、「夜になる前に火を起こせ」というテーマを視覚的に表現しています。雨・嵐の天候はこの暗さにさらに加算されます。

## デバッグモード

URLに `?debug=true` を付けて開くと、画面下部にデバッグパネルが表示されます。

```
http://localhost:5173/?debug=true
```

確認できる値: 現在の画面/サブフェーズ・天候（次の天候変化イベントの進行状況つき）・装備・湿度・集めた素材（役割つき）・摩擦熱・火力・酸素量・火種フラグ・経過時間・PHASE1の所要時間と後戻り回数・息吹きフェーズの効率加重滞在時間。ゲームバランス調整時に使用してください。

## SNSシェア設定

結果画面の「結果をシェア」ボタンは `navigator.share`（Web Share API）が使える環境ではネイティブの共有シートを開きます。使えない場合は結果テキストをクリップボードにコピーします。

「Xでシェア」ボタンは常に表示され、X（旧Twitter）の投稿画面をシェア文付きで新しいタブで開きます。シェア文には結果時の天候も含まれます。

```
🔥 無人島で火を起こした！

⏱ FIRE TIME：01:24.38
🏆 サバイバル力：81点
🌴 RANK：ワイルドサバイバー
🌧 WEATHER：小雨

あなたは夜になる前に火を起こせる？

#SURVIVETHENIGHT
#火おこしチャレンジ
#サバイバル力
```

シェア文言のテンプレートやハッシュタグ、共有先URLは [`src/share.ts`](src/share.ts) と `GAME_CONFIG.share`（`url` / `hashtags`）で変更できます。本番URLを変更した場合は`GAME_CONFIG.share.url`と`index.html`のOGP用URLも合わせて更新してください。

## Result Card（プレイ結果の共有画像）

固定のOGP画像とは別に、**プレイヤーごとの結果**を1200×630のPNG画像として毎回動的に生成します（[`src/share/ResultCardGenerator.ts`](src/share/ResultCardGenerator.ts)）。役割分担は以下の通りです。

- **固定OGP画像**（`public/og-image.png`）— ゲームURLそのものをシェアされたときの入口。「あなたは火を起こせるか？」という問いかけ役
- **Result Card**（動的生成PNG）— 実際にプレイした人が「自分の結果」を見せびらかすための画像。スコア・タイム・ランク・キャラクターを毎回描き直す

結果画面が表示されると同時にCanvasでカードを生成し、下部に縮小プレビュー（「シェアするとこんな感じ」）を表示します。ボタンは4つです。

- **📤 結果をシェア** — `navigator.canShare({ files: [...] })`で画像共有に対応していれば、生成したPNGを`File`化してテキスト・URLと一緒に`navigator.share()`。対応していなければテキストのみの共有、それも無ければクリップボードにコピー、という順にフォールバックします
- **🖼️ 結果画像を保存** — 生成したPNGをそのままダウンロード（`<a download>`）
- **𝕏 Xでシェア** — X Web Intent（テキストのみ。Xの仕様上ローカル画像は自動添付できないため、保存した画像を手動添付する運用を想定）
- **🔥 もう一度挑戦** — リトライ

### キャラクター画像とランク演出

ランクごとのキャラクター画像・一言診断・Result Cardの炎の強さ（`fireLevel: 0〜5`）は [`src/share/rankPresets.ts`](src/share/rankPresets.ts) に集約されています。キャラクター画像本体は `public/characters/*.webp`（透過PNG由来）で、ランクが上がるほど体格・装備（ヘッドバンド／トライバル柄／マント／オーラ）・炎の大きさが増していく一枚絵のシルエットになっています。キャラクターを差し替えたい場合は、同じ`public/characters/`配下のパスに1200×630想定の縦長・透過webp画像を置き換えてください（`ResultCardGenerator`側は画像の縦横比を保ってカード右側に自動フィットします）。

## OGP（SNSシェア時のカード表示）

`index.html` の `<head>` に OGP / Twitter Card 用の meta タグを設定しています（title・description・og:image など）。`og:image` は `public/og-image.png`（1200×630px）を指しており、`npm run build` すると `dist/og-image.png` としてサイトのルート直下に配信されます。

キービジュアルの画像自体はゲームのスクリーンショットではなく、専用に作成したキーアートです。デザインを変更したい場合は、同じ構成のHTMLを作成してヘッドレスブラウザ（Playwrightなど）で1200×630のスクリーンショットを撮り、`public/og-image.png` を差し替えてください。

OGP設定を変更した後の確認ポイント:

1. `npm run build` が成功すること
2. ビルド後、`/og-image.png` にブラウザから直接アクセスしてHTTP 200で1200×630のPNGが返ること
3. `index.html` のOGP metaタグ（特に`og:image`・`og:url`）が絶対URLになっていること
4. X / Slack / Discord 等はOGPを一定時間キャッシュすることがあるため、画像やmetaタグを変更しても反映されない場合は、各サービスのデバッグツール（例: Xの場合はCard Validator相当の機能）でキャッシュを再取得するか、`og-image.png`のファイル名自体を変更（例: `og-image-v2.png`）してキャッシュを回避してください。
