# SURVIVE THE NIGHT 🔥

日没直前の森に取り残されたあなたは、夜になる前に火を起こせるか？

ブラウザで遊べるスマホ対応のサバイバルゲームです。画面遷移でステップを踏ませるWebアプリ的な作りではなく、**タイトルを抜けたら最後まで同じ「森」の中で状況が連続的に変化する**ことを最優先に作られています（V2で全面刷新）。

## ゲーム概要

1. **タイトル** — 「SURVIVE」を押すとそのまま森の中へ
2. **オープニング** — `DAY 1` → 時刻 → `SUNSET IN 03:20` → `MAKE FIRE BEFORE SUNSET` と表示され、ここからタイマー（＝日没までのカウントダウン）が動き出す
3. **アイテム選択** — 地面に置かれた🔥FIRE KIT / 🍖FOOD / 🏕️SHELTERから1つだけタップして持つ
4. **素材集め** — 森の地面に散らばる素材（毎回20種類の中から10〜12個が出現）から4〜5個タップして集める。良さそうな素材は「パキッ」、悪そうな素材は「グニャ」という手触りの合図が出る
5. **PHASE 1 摩擦** — 画面中央の木の棒の周りを指（PCはマウス）でぐるぐる回し、摩擦熱を100%まで上げる。回し続けるとスタミナを消費し、疲れると効率が落ちる
6. **PHASE 2〜3 火種→息吹き** — 摩擦熱100%で赤い火種が生まれる（`EMBER CREATED`）。放置すると火種は消えて摩擦フェーズに逆戻り（`EMBER LOST`）。長押しで息を吹きかけ、炎を100%（焚き火）まで育てる
7. **薪くべ（任意）** — 育ってきた炎に、集めた焚き付け・燃料を画面下のトレイからドラッグして投入できる。タイミングが合えば炎が一気に育つ演出つきのボーナス。投入しなくても息だけでクリア可能
8. **🔥 FIRE! → 結果画面（YOU SURVIVED）** — 映画のラストシーンのような結果画面で、スコア・ランク・キャラクター・クリアタイムを表示し、SNSでシェアできる
9. **日没までに火を起こせなければ GAME OVER（YOU DIDN'T SURVIVE）**

火の状態は常に画面中央のビジュアル（木屑→煙→火種→炎→焚き火）と直結しており、ゲージ類はHUDに最小限だけ表示されます。天候（晴れ/強風/小雨/激しい雨）はランダムに決まり、**プレイ中に0〜2回変化することもあります**（予兆演出つき）。雨は炎そのものを弱らせ、強風は小さな炎を消しかけ突風を起こし、装備の選び方によって有利不利が変わります。

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
  types.ts          # 型定義（GameState, Material, ScoreBreakdown など）
  state.ts           # グローバルストア（購読可能なシンプルなストア）
  weather.ts          # 天候の抽選・タイムライン生成・予兆演出の強度計算
  environment.ts       # 画面をまたいで動く環境ティッカー（日没カウントダウン/天候進行/突風/雷/湿度/夜の暗さ/木々の揺れ/中央トースト）
  materials.ts          # 素材プールの抽選・役割(火口/焚き付け/燃料)ごとの集計・各種係数計算
  scoring.ts             # サバイバルスコア(6項目)の計算・タイム/時計フォーマット
  fireCanvas.ts           # Canvasパーティクルシステム（回転する棒・炎・煙・火の粉・雨・葉/砂埃）
  audio.ts                 # Web Audio APIで生成する環境音・天候音・火の音・操作音（音声ファイル不使用）
  equipment.ts               # 装備（FIRE KIT/FOOD/SHELTER）の表示メタ情報
  share.ts                    # Web Share API（画像つき） / X 共有用の文言・URL生成・保存
  share/
    rankPresets.ts               # ランクごとのキャラクター画像パス・一言診断・火の強さ
    ResultCardGenerator.ts        # Result Card（1200x630 PNG）をCanvasで生成
  ui.ts                          # 画面共通の小さなヘルパー（clampなど）
  main.ts                         # ルーター（画面のマウント/アンマウント・環境レイヤーの初期化）
  screens/
    title.ts                       # タイトル画面
    field.ts                        # アイテム選択→素材集め→摩擦→火種→息吹き→薪くべ を1画面で担当
    result.ts                        # 結果画面（スコア・シェア・リトライ）
    gameover.ts                       # 日没タイムオーバー画面
    debug.ts                           # デバッグパネル
```

タイトルを抜けた後の全工程（アイテム選択〜焚き火完成）は画面遷移せず、[`src/screens/field.ts`](src/screens/field.ts) 1つの中で内部フェーズ（`item_selection` → `gathering` → `rotate` → `breath`）を切り替えます。中央のビジュアル（回転する棒・木屑・煙・火種・炎）は [`src/fireCanvas.ts`](src/fireCanvas.ts) が一括で描画し、日没カウントダウン・天候・夜の暗さは [`src/environment.ts`](src/environment.ts) が画面をまたいで管理します。

state / scoring / weather / environment / fire simulation / audio / share を分離しているので、「スコア配分だけ変えたい」「天候の効果だけ調整したい」といった変更は該当ファイルだけ触れば完結します。

## GAME_CONFIGの変更方法

すべてのゲームバランス値は [`src/config.ts`](src/config.ts) の `GAME_CONFIG` にまとまっています。値を変えて保存するだけで、コードの他の部分に触れずに難易度調整ができます。

主なパラメータ:

| カテゴリ | 主な項目 | 説明 |
|---|---|---|
| `sunset.budgetSeconds` | 200秒 | 日没までの制限時間（この時間内にfire=100にできないとGAME OVER） |
| `sunset.warningSeconds` | 45秒 | 残りこの秒数を切るとHUDの時計が警告色になる |
| `stamina.*` | 消費/回復速度・疲労時の効率倍率 | PHASE1（回転）でのスタミナ管理 |
| `weather.probabilities` | 晴れ45 / 強風25 / 小雨20 / 激しい雨10 | ゲーム開始時の天候の出現確率（合計100） |
| `weather.passiveFireDecayPerSecond` | 雨0.5 / 嵐1.1 | 酸素管理と無関係に常時かかる炎への直接ダメージ |
| `weather.shelterMitigation` | 0.6 | シェルター装備時の悪天候軽減率 |
| `weatherDynamics.*` | 変化回数の重み・間隔・予兆リード時間 | 天候が何回・いつ変化するか |
| `gust.*` / `lightning.*` | 発生間隔・影響 | 強風の突風、嵐の雷 |
| `nightCycle.breakpoints` | 日没までの残り時間比率ごとの暗さ | タイムプレッシャー演出 |
| `equipment.*` | 各装備の効果値 | FIRE KIT/FOOD/SHELTERの補正 |
| `materials.pool` | 各素材の `role`（火口/焚き付け/燃料）と `quality` | 判断力スコアと回転・燃焼速度に影響 |
| `rotate.*` | `minAngularSpeed`, `heatGainPerRadPerSecond`, `fireKitHeatMultiplier` | PHASE1（回転）の難易度 |
| `ember.*` | `initialPowerBase`, `neglectDecayPerSecond`, `fragileFireThreshold` | 火種ができた直後の脆さ・放置減衰 |
| `breath.*` | `optimalOxygen`, `bellWidth`, `fireGrowthPerSecond` | PHASE3（息吹き）の育ちやすさ |
| `kindling.*` | `unlocksAtFire`, `goodBoost`, `badPenalty`, `idealSwitchFire` | 任意の薪くべ演出の効果 |
| `score.weights` | FIREMAKING20 / MATERIAL CHOICE15 / BREATH CONTROL20 / FIRE MANAGEMENT15 / SURVIVAL IQ15 / TIME15 | スコア配分（合計100） |
| `ranks` | 称号としきい値（0〜19 LOST TOURIST 〜 95〜100 PRIMAL LEGEND） | サバイバルランクの境界点 |

## 素材の役割（火口・焚き付け・燃料）

素材には内部的に3つの役割があり、プレイヤーには表示されません（自分で判断してもらうため）。選んだ素材は最初から地面に見える形で配置されます。

- **Tinder / 火口** — PHASE1（回転）の摩擦熱の上がりやすさを主に左右する。枯れ葉・乾いた草・綿毛など。火種ができる瞬間に燃え尽きて画面から消える
- **Kindling / 焚き付け** — PHASE3序盤（火力45%未満）の炎の育ちやすさを左右する。乾いた小枝・松ぼっくり・樹皮など
- **Fuel / 燃料** — PHASE3終盤（火力45%以上）の炎の育ちやすさを左右する。太い乾燥枝・流木など

集めたKindling/Fuelの品質は、息を吹いている間ずっと自動的に成長速度へ反映されます（`materials.ts`の`fireGrowthFactor`）。さらに、炎が`kindling.unlocksAtFire`（デフォルト15%）まで育つと、画面下にKindling/Fuelのトレイが現れ、中央の炎へドラッグして任意で投入できます。正しいタイミング（小さい炎には焚き付け、育った炎には燃料）で投入すると`kindling.goodBoost`ぶん火力が一気に伸びる演出つきボーナスになり、`state.kindlingLog`としてスコアのFIRE MANAGEMENT項目にも反映されます。投入は必須ではなく、息だけでも100%まで育てられます。

役割を1つも選ばないと、その役割は`materials.missingRoleBaseline`相当の低い効率として扱われます。特に**燃料を1つも選ばなかった場合、火力80%を超えたあたりで成長が少し鈍化**します。湿った素材や、雨で時間経過とともに湿っていった素材（`wetness`）は`wetSensitive: true`の場合に効率が落ちます（`materials.ts`の`effectiveQuality`）。

## スコア計算方法

ゲーム終了時に100点満点のサバイバルスコアを6項目から算出します（[`src/scoring.ts`](src/scoring.ts)）。

- **FIREMAKING（20点）** — PHASE1（回転）の所要時間。速いほど高得点。火種を放置して摩擦フェーズへ後戻りした回数も減点
- **MATERIAL CHOICE（15点）** — 集めた素材の平均品質と、火口/焚き付け/燃料をバランスよく揃えられたか
- **BREATH CONTROL（20点）** — 息吹き中、酸素量が理想値にどれだけ近かったかの平均効率
- **FIRE MANAGEMENT（15点）** — 薪くべのタイミングの良し悪し（投入しなかった場合は中立点）
- **SURVIVAL IQ（15点）** — 装備と天候の相性、火種を消さずに済んだか
- **TIME（15点）** — 日没までどれだけ余裕を残してクリアできたか

合計スコアに応じて `GAME_CONFIG.ranks` からサバイバルランクが決まります（`LOST TOURIST` 〜 `PRIMAL LEGEND`）。自己ベストは `localStorage`（クリアタイム/スコア/ランク）に保存され、更新時に結果画面へ「NEW RECORD」が表示されます。

## 天候確率と天候の変化

ゲーム開始時、以下の確率で最初の天候が決まります（`GAME_CONFIG.weather.probabilities`）。

- ☀️ 晴れ: 45%
- 💨 強風: 25%（火が育つと逆に燃焼速度がブースト。ランダムで突風が発生し、酸素ゲージが急上昇する）
- 🌧️ 小雨: 20%（素材が時間経過で湿っていく）
- ⛈️ 激しい雨: 10%（もっとも難しい。ランダムで雷が発生し、画面が一瞬明るくなる）

🏕️ シェルターを選んでいる場合、悪天候の影響（燃焼速度・湿度蓄積）を60%軽減します。

天候は**1プレイ中に0〜2回変化することがあります**（`weatherDynamics`）。変化の6秒前から木々の揺れや雨の気配が少しずつ強まる「予兆」演出が入り、変化の瞬間に画面中央へ「風が強くなってきた…」「雨が降り始めた…」といったトーストが表示されます。

また、日没までの残り時間の比率に応じて画面が夕方→夜→ほぼ真っ暗へと連続的に暗くなっていきます（`nightCycle`）。火力が上がるとその周囲だけが暖色に照らされ、「日没までに火を起こせ」というテーマを視覚的に表現しています。雨・嵐の天候はこの暗さにさらに加算されます。

## サウンド

実音声ファイルは一切使わず、Web Audio APIでその場に音を生成しています（[`src/audio.ts`](src/audio.ts)）。森の環境音（虫の声・風）、天候音（風・雨）、火のクラックル音（火力に応じて頻度・音量が変化）、操作音（素材を拾う・折る・火種完成・薪投入・成功/失敗）を全て合成しており、追加の音声アセットは不要です。ブラウザの自動再生制限のため、タイトル画面の「SURVIVE」ボタン押下（＝最初のユーザー操作）で`AudioEngine`を起動します。プレイ中は右上のスピーカーアイコンでいつでもミュートできます。

## デバッグモード

URLに `?debug=true` を付けて開くと、画面下部にデバッグパネルが表示されます。

```
http://localhost:5173/?debug=true
```

確認できる値: 現在の画面/内部フェーズ・天候（次の天候変化イベントの進行状況つき）・装備・湿度・スタミナ・集めた素材（役割つき）・摩擦熱・火力・酸素量・火種フラグ・経過時間・日没までの残り秒数・GAME OVER理由・PHASE1の所要時間と後戻り回数・息吹きフェーズの効率加重滞在時間・薪くべログ。ゲームバランス調整時に使用してください。

## SNSシェア設定

結果画面の「結果をシェア」ボタンは `navigator.share`（Web Share API）が使える環境ではネイティブの共有シートを開きます。使えない場合は結果テキストをクリップボードにコピーします。

「Xでシェア」ボタンは常に表示され、X（旧Twitter）の投稿画面をシェア文付きで新しいタブで開きます。シェア文には結果時の天候も含まれます。

```
🔥 SURVIVE THE NIGHT

私のサバイバル力は…

🏆 81 / 100
🔥 WILDERNESS SURVIVOR
⏱ FIRE TIME：01:24.38
🌧 WEATHER：小雨

あなたは夜になる前に火を起こせる？

#SURVIVETHENIGHT
#火おこしチャレンジ
#サバイバル力
```

シェア文言のテンプレートやハッシュタグ、共有先URLは [`src/share.ts`](src/share.ts) と `GAME_CONFIG.share`（`url` / `hashtags`）で変更できます。本番URLを変更した場合は`GAME_CONFIG.share.url`と`index.html`のOGP用URLも合わせて更新してください。

## Result Card（プレイ結果の共有画像）

固定のOGP画像とは別に、**プレイヤーごとの結果**を1200×630のPNG画像として毎回動的に生成します（[`src/share/ResultCardGenerator.ts`](src/share/ResultCardGenerator.ts)）。役割分担は以下の通りです。

- **固定OGP画像**（`public/og-image.png`）— ゲームURLそのものをシェアされたときの入口。「火を起こせ。夜を生き延びろ。」という問いかけ役
- **Result Card**（動的生成PNG）— 実際にプレイした人が「自分の結果」を見せびらかすための画像。スコア・タイム・ランク・キャラクターを毎回描き直す

結果画面が表示されると同時にCanvasでカードを生成し、下部に縮小プレビュー（「シェアするとこんな感じ」）を表示します。ボタンは4つです。

- **📤 結果をシェア** — `navigator.canShare({ files: [...] })`で画像共有に対応していれば、生成したPNGを`File`化してテキスト・URLと一緒に`navigator.share()`。対応していなければテキストのみの共有、それも無ければクリップボードにコピー、という順にフォールバックします
- **🖼️ 結果画像を保存** — 生成したPNGをそのままダウンロード（`<a download>`）
- **𝕏 Xでシェア** — X Web Intent（テキストのみ。Xの仕様上ローカル画像は自動添付できないため、保存した画像を手動添付する運用を想定）
- **🔥 TRY AGAIN** — リトライ

### キャラクター画像とランク演出

ランクごとのキャラクター画像・一言診断・Result Cardの炎の強さ（`fireLevel: 0〜5`）は [`src/share/rankPresets.ts`](src/share/rankPresets.ts) に集約されています。キャラクター画像本体は `public/characters/*.webp`（透過PNG由来）で、ランクが上がるほど体格・装備（ヘッドバンド／トライバル柄／マント／オーラ）・炎の大きさが増していく一枚絵のシルエットになっています。結果画面では`object-fit: contain`で表示しているため、画像が不自然に引き伸ばされることはありません。キャラクターを差し替えたい場合は、同じ`public/characters/`配下のパスに縦長・透過webp画像を置き換えてください。

## OGP（SNSシェア時のカード表示）

`index.html` の `<head>` に OGP / Twitter Card 用の meta タグを設定しています（title・description・og:image など）。`og:image` は `public/og-image.png`（1200×630px）を指しており、`npm run build` すると `dist/og-image.png` としてサイトのルート直下に配信されます。

キービジュアルの画像自体はゲームのスクリーンショットではなく、専用に作成したキーアートです。デザインを変更したい場合は、同じ構成のHTMLを作成してヘッドレスブラウザ（Playwrightなど）で1200×630のスクリーンショットを撮り、`public/og-image.png` を差し替えてください。

OGP設定を変更した後の確認ポイント:

1. `npm run build` が成功すること
2. ビルド後、`/og-image.png` にブラウザから直接アクセスしてHTTP 200で1200×630のPNGが返ること
3. `index.html` のOGP metaタグ（特に`og:image`・`og:url`）が絶対URLになっていること
4. X / Slack / Discord 等はOGPを一定時間キャッシュすることがあるため、画像やmetaタグを変更しても反映されない場合は、各サービスのデバッグツール（例: Xの場合はCard Validator相当の機能）でキャッシュを再取得するか、`og-image.png`のファイル名自体を変更（例: `og-image-v2.png`）してキャッシュを回避してください。

## V2で実装しなかったもの・簡略化したもの

今回のV2改修は非常に広範な仕様変更だったため、以下は意図的に簡略化しています。

- **サウンド** — 実録音ファイルではなく、Web Audio APIによるプロシージャル生成音のみ
- **マイク入力での息吹き操作** — 未実装（仕様上も必須ではないオプション扱い）
- **火口（Tinder）の手作業での組み立て** — ドラッグでの積み上げUIではなく、集めた瞬間に自動配置。テンポ優先の判断
- **スタミナ切れによるGAME OVER** — スタミナは回転効率を下げるだけのソフトな負荷とし、それ単体でのGAME OVERは実装していません（日没タイムオーバーが主なGAME OVER条件）
