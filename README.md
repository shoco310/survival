# SURVIVE THE NIGHT 🔥

無人島に漂着したあなたは、夜になる前に火を起こせるか？

ゲーム開始から火力100%になるまでのタイムを競う、ブラウザで遊べるスマホ対応のサバイバル・タイムアタックゲームです。

## ゲーム概要

1. **装備選択** — 🔥ファイヤースターター / 🍖非常食 / 🏕️シェルターから1つを選ぶ
2. **素材集め** — 森の中から火種になりそうな素材を3〜5個タップして集める
3. **摩擦フェーズ** — 画面を左右にすばやくスワイプ（PCはドラッグ）して摩擦熱を100%まで上げる
4. **息吹きフェーズ** — 火種に息を吹きかけ、酸素ゲージを安全ゾーン（40〜70%）に保ちながら火力を100%まで育てる
5. **結果画面** — クリアタイム・サバイバル力スコア・ランクを表示し、SNSでシェアできる

天候（晴れ/強風/小雨/激しい雨）はランダムに決まり、装備の選び方によって有利不利が変わります。

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
  weather.ts          # 天候の抽選・倍率計算
  materials.ts         # 素材プールの抽選・平均品質計算
  scoring.ts            # サバイバル力スコアの計算・タイムフォーマット
  fireCanvas.ts          # Canvasパーティクルシステム（炎・煙・火の粉・雨）
  share.ts                # Web Share API / X 共有用の文言・URL生成
  ui.ts                    # 画面共通の小さなヘルパー（天候チップ、タイマー表示）
  main.ts                   # ルーター（画面のマウント/アンマウントを管理）
  screens/
    start.ts               # STEP0 装備選択画面
    gather.ts               # STEP1 素材集め画面
    friction.ts              # STEP2 摩擦フェーズ
    breath.ts                 # STEP3 息吹きフェーズ
    result.ts                  # 結果画面（スコア・シェア・リトライ）
    debug.ts                    # デバッグパネル
```

state / scoring / weather / fire simulation / UI / share を分離しているので、
「スコア配分だけ変えたい」「天候の効果だけ調整したい」といった変更は該当ファイルだけ触れば完結します。

## GAME_CONFIGの変更方法

すべてのゲームバランス値は [`src/config.ts`](src/config.ts) の `GAME_CONFIG` にまとまっています。値を変えて保存するだけで、コードの他の部分に触れずに難易度調整ができます。

主なパラメータ:

| カテゴリ | 主な項目 | 説明 |
|---|---|---|
| `weather.probabilities` | 晴れ45 / 強風25 / 小雨20 / 激しい雨10 | 天候の出現確率（合計100） |
| `weather.frictionMultiplier` / `fireGrowthMultiplier` | 各天候ごとの倍率 | 摩擦・火力成長への影響 |
| `weather.shelterMitigation` | 0.6 | シェルター装備時の悪天候軽減率 |
| `equipment.fire` | `startingHeat: 50`, `frictionRateMultiplier: 1.5` | ファイヤーキットの効果 |
| `equipment.food` | `heatDecayMultiplier: 0.6`, `reigniteEmberBonus: 8` | 非常食の効果（消火からの復帰に強い） |
| `materials.pool` | 各素材の `quality`（0-100） | 燃焼/着火効率。判断力スコアと摩擦速度に影響 |
| `friction.*` | `baseSwipeGain`, `decayPerSecond` など | 摩擦フェーズの難易度 |
| `breath.*` | `safeZoneMin/Max`, `overblowDangerMs` など | 息吹きフェーズの難易度 |
| `score.weights` | 判断力30 / 技術25 / 管理25 / スピード20 | スコア配分（合計100） |
| `ranks` | 称号としきい値 | サバイバルランクの境界点 |

## スコア計算方法

ゲーム終了時に100点満点の「サバイバル力」を算出します（[`src/scoring.ts`](src/scoring.ts)）。

- **判断力（30点）** — 集めた素材の平均品質（`quality`）に比例
- **火おこし技術（25点）** — 摩擦フェーズの所要時間。`score.idealFrictionSeconds` より速いほど満点に近づく
- **火の管理（25点）** — 息吹きフェーズで酸素を安全ゾーン（40〜70%）に保てた時間の割合。消火（吹きすぎ）1回ごとに `score.managementPenaltyPerExtinguish` 点を減点
- **スピード（20点）** — ゲーム開始から成功までの合計タイム。`score.speedFullMarkSeconds` 以内なら満点

合計スコアに応じて `GAME_CONFIG.ranks` からサバイバルランクが決まります（都会に帰ろう 〜 人類代表）。

自己ベストタイムは `localStorage`（キー: `survival-fire-best-time`）に保存され、更新時に「NEW RECORD!」が表示されます。

## 天候確率

デフォルトでは以下の確率で天候が決まります（`GAME_CONFIG.weather.probabilities`）。

- ☀️ 晴れ: 45%
- 💨 強風: 25%（火が育つと逆に燃焼速度がブースト）
- 🌧️ 小雨: 20%
- ⛈️ 激しい雨: 10%（もっとも難しい）

🏕️ シェルターを選んでいる場合、悪天候の影響を60%軽減します。

## デバッグモード

URLに `?debug=true` を付けて開くと、画面下部にデバッグパネルが表示されます。

```
http://localhost:5173/?debug=true
```

確認できる値: 現在の天候・装備・集めた素材・摩擦熱・火力・酸素量・火種フラグ・経過時間・摩擦フェーズの所要時間・息吹きフェーズの安全ゾーン滞在時間・消火回数・吹きすぎ警告フラグ。ゲームバランス調整時に使用してください。

## SNSシェア設定

結果画面の「結果をシェア」ボタンは `navigator.share`（Web Share API）が使える環境ではネイティブの共有シートを開きます。使えない場合は結果テキストをクリップボードにコピーします。

「Xでシェア」ボタンは常に表示され、X（旧Twitter）の投稿画面をシェア文付きで新しいタブで開きます。

シェア文言のテンプレートやハッシュタグは [`src/share.ts`](src/share.ts) と `GAME_CONFIG.share.hashtags` で変更できます。
