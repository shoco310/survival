import type { WeatherId } from './types';

/**
 * ゲームバランスに関わる全ての数値をここに集約する。
 * 値を変えるだけで難易度・演出タイミング・スコア配分を調整できる。
 */
export const GAME_CONFIG = {
  weather: {
    // 天候の出現確率（合計100になるように調整すること）
    probabilities: {
      sunny: 45,
      wind: 25,
      rain: 20,
      storm: 10,
    } satisfies Record<WeatherId, number>,
    // 各天候が摩擦フェーズの熱上昇に与える倍率
    frictionMultiplier: {
      sunny: 1.0,
      wind: 1.0,
      rain: 0.82,
      storm: 0.55,
    } satisfies Record<WeatherId, number>,
    // 各天候が息吹きフェーズの火力成長に与える倍率
    fireGrowthMultiplier: {
      sunny: 1.0,
      wind: 0.88, // 火が小さいうちは不利
      rain: 0.72,
      storm: 0.5,
    } satisfies Record<WeatherId, number>,
    // 強風時、火力がこの値以上なら燃焼速度が逆にブーストされる
    windBoostThreshold: 50,
    windBoostMultiplier: 1.35,
    // 強風時、火力がこの値未満だと風で消えかける（追加の減少）
    windWeakFireThreshold: 30,
    windWeakFireShrinkPerSecond: 3.2,
    // shelter装備時、天候の悪影響をどれだけ軽減するか（0.6 = 60%軽減）
    shelterMitigation: 0.6,
    // 雨・嵐が中央の炎に与える直接的な減衰（オキシジン管理と無関係に常時かかる）
    passiveFireDecayPerSecond: {
      sunny: 0,
      wind: 0,
      rain: 0.5,
      storm: 1.1,
    } satisfies Record<WeatherId, number>,
  },

  // 天候はゲーム開始時に決まった後も、途中で変化する可能性がある
  weatherDynamics: {
    // 1プレイで発生する天候変化の回数（0〜2回）とその出現重み
    transitionCountWeights: { 0: 30, 1: 50, 2: 20 } as Record<number, number>,
    // 変化と変化の間隔（ゲーム開始/前回の変化からの秒数）
    minGapSeconds: 16,
    maxGapSeconds: 48,
    // 変化の何秒前から予兆演出（木々の揺れ・小雨の気配など）を始めるか
    foreshadowLeadSeconds: 6,
    // 変化発生時に画面中央に出すトースト表示時間
    toastDurationMs: 2400,
  },

  // 強風時にランダムで発生する突風
  gust: {
    minIntervalSeconds: 4,
    maxIntervalSeconds: 10,
    durationMs: 700,
    oxygenSpike: 20, // 突風で酸素ゲージが即座に上がる量
    weakFireThreshold: 35, // これ未満の火力だと突風で消えかける
    weakFireShrink: 12,
    strongFireBoostThreshold: 55,
    strongFireBoost: 5, // 火力が十分な場合は逆に一瞬燃焼が加速
  },

  // 激しい雨（storm）で時々発生する雷
  lightning: {
    minIntervalSeconds: 3,
    maxIntervalSeconds: 8,
    flashMs: 200,
  },

  // 素材の湿り具合（雨・豪雨で時間経過とともに蓄積）
  wetness: {
    gainPerSecondRain: 2.0,
    gainPerSecondStorm: 4.5,
    dryPerSecond: 3, // 雨が止んでいる間に乾いていく速度
    max: 100,
    // wetSensitiveな素材が、湿度maxのときに失う効果の割合（0.35 = 最大35%減。それでも必ず進行できる程度に抑える）
    qualityPenaltyAtMax: 0.35,
  },

  // 日没との競争。この秒数までに焚き火(fire>=100)を完成させないとGAME OVER
  sunset: {
    budgetSeconds: 200,
    // HUDの時計表示の起点（この時刻からカウントダウンしているという体裁）
    startClockHour: 18,
    startClockMinute: 42,
    // 残りこの秒数を切ったら時計表示を警告色にする
    warningSeconds: 45,
  },

  // タイムプレッシャー演出：残り時間に応じた夜の暗さ（0=明るい,1=真っ暗に近い）
  // sunset.budgetSecondsに対する経過割合で決まる（後述のenvironment.tsで算出）
  nightCycle: {
    breakpoints: [
      { atRatio: 0, darkness: 0.05 },
      { atRatio: 0.3, darkness: 0.32 },
      { atRatio: 0.6, darkness: 0.6 },
      { atRatio: 0.9, darkness: 0.82 },
    ],
    // 天候による追加の暗さ
    rainExtraDarkness: 0.12,
    stormExtraDarkness: 0.26,
    maxDarkness: 0.88,
  },

  // スタミナ：回転で消費し、止めると回復する。尽きると回転効率が落ちる（即ゲームオーバーにはしない）
  stamina: {
    drainPerSecondWhileRotating: 9,
    recoverPerSecondWhileIdle: 14,
    // これ未満まで消耗すると、回転の効率が落ち始める
    tiredThreshold: 25,
    // 完全に尽きたときの効率倍率の下限
    exhaustedMultiplier: 0.45,
    // FOOD装備時、消費量に掛かる倍率
    foodDrainMultiplier: 0.6,
  },

  equipment: {
    fire: {
      // ファイヤースターター：摩擦フェーズの初期熱を強化（上昇速度は rotate.fireKitHeatMultiplier）
      startingHeat: 40,
    },
    food: {
      // 非常食：体力を維持できるため、熱の自然減衰が少なく、火種を消してしまっても回復が早い
      heatDecayMultiplier: 0.6,
      resetRecoveryBonus: 8, // 火が消えて摩擦フェーズへ後戻りする際、熱の初期値に加算
    },
    shelter: {
      // 簡易シェルター：weather.shelterMitigation / wetness軽減 に反映
    },
  },

  materials: {
    // 画面に出現しうる素材（火口 tinder / 焚き付け kindling / 燃料 fuel）
    // それぞれの役割・効率をプレイヤーには明示しない
    pool: [
      // --- Tinder / 火口：最初の火花を受け止める ---
      { id: 'driedLeaves', emoji: '🍂', label: '枯れ葉', role: 'tinder', quality: 95, wetSensitive: true },
      { id: 'dryGrass', emoji: '🌾', label: '乾いた草', role: 'tinder', quality: 90, wetSensitive: true },
      { id: 'cottonFluff', emoji: '🪶', label: '綿毛', role: 'tinder', quality: 100, wetSensitive: true },
      { id: 'thinBark', emoji: '📄', label: '薄い樹皮', role: 'tinder', quality: 78, wetSensitive: true },
      { id: 'dryMoss', emoji: '🍃', label: '乾いた苔', role: 'tinder', quality: 60, wetSensitive: true },
      { id: 'moss', emoji: '🌱', label: '苔', role: 'tinder', quality: 35, wetSensitive: true },
      { id: 'greenGrass', emoji: '☘️', label: '青い草', role: 'tinder', quality: 20, wetSensitive: false },
      { id: 'wetFallenLeaves', emoji: '🍁', label: '湿った落ち葉', role: 'tinder', quality: 10, wetSensitive: true },
      { id: 'mud', emoji: '🟫', label: '泥', role: 'tinder', quality: 0, wetSensitive: false },

      // --- Kindling / 焚き付け：小さな炎を育てる ---
      { id: 'dryTwig', emoji: '🥢', label: '乾いた小枝', role: 'kindling', quality: 88, wetSensitive: true },
      { id: 'pineCone', emoji: '🌰', label: '松ぼっくり', role: 'kindling', quality: 75, wetSensitive: false },
      { id: 'bark', emoji: '🪵', label: '樹皮', role: 'kindling', quality: 70, wetSensitive: true },
      { id: 'bambooSliver', emoji: '🎍', label: '竹片', role: 'kindling', quality: 65, wetSensitive: false },
      { id: 'wetBranch', emoji: '🌿', label: '湿った小枝', role: 'kindling', quality: 15, wetSensitive: true },
      { id: 'stone', emoji: '🪨', label: '石', role: 'kindling', quality: 0, wetSensitive: false },

      // --- Fuel / 燃料：炎を維持する ---
      { id: 'thickDryBranch', emoji: '🪵', label: '太い乾燥枝', role: 'fuel', quality: 85, wetSensitive: true },
      { id: 'driftwood', emoji: '🌊', label: '流木', role: 'fuel', quality: 55, wetSensitive: true },
      { id: 'rottenWood', emoji: '🍄', label: '腐った木', role: 'fuel', quality: 20, wetSensitive: true },
      { id: 'greenWood', emoji: '🪵', label: '生木', role: 'fuel', quality: 10, wetSensitive: true },
      { id: 'flatStone', emoji: '🧱', label: '平たい石', role: 'fuel', quality: 0, wetSensitive: false },
    ],
    // 1回のプレイで画面に表示する候補数（プールからランダム抽出）
    displayCount: 11,
    // 集める素材数の範囲
    minPick: 4,
    maxPick: 5,
    // ある役割の素材を1つも選ばなかった場合に使う仮の効率値
    missingRoleBaseline: 12,
  },

  // PHASE 1: 木の棒を中心に円を描いて回す摩擦フェーズ
  rotate: {
    // これ未満の角速度(rad/s)はほぼ回転とみなさない（熱がほぼ上がらない）
    minAngularSpeed: 2.0,
    // これ以上の角速度は頭打ち
    maxAngularSpeed: 13,
    // 角速度1rad/sあたりの摩擦熱上昇/秒の基礎値（火口品質・装備・天候で補正）
    heatGainPerRadPerSecond: 1.05,
    // 回転をやめたとき、1秒あたりに減衰する熱量
    decayPerSecond: 13,
    // 中心からこの半径未満の操作は無効（棒を横に撫でているだけとみなす）
    minRadius: 24,
    // 中心からこの半径を超えた操作は無効（画面端の暴れ防止）
    maxRadius: 150,
    // 火口(tinder)品質の正規化基準（この値で係数1.0）
    tinderNormalizer: 70,
    // FIRE KIT装備時、摩擦熱の上昇速度に掛かる倍率
    fireKitHeatMultiplier: 1.9,
  },

  // PHASE 2: 摩擦熱100%で火種が生まれた直後の状態
  ember: {
    // 火種の初期パワー（この上に素材品質による補正が乗る）
    initialPowerBase: 30,
    initialPowerVariance: 10,
    // 息を吹いていない間、1秒あたりに減衰する火種/火力（小さな火のうちだけ有効）
    neglectDecayPerSecond: 3.4,
    // この火力未満は「まだ火種」とみなし、消えると摩擦フェーズへ後戻りする
    fragileFireThreshold: 32,
    // 摩擦フェーズへ後戻りするときの熱の初期値（多少は楽になる）
    resetHeat: 18,
  },

  // PHASE 3: 息を吹いて火種を焚き火まで育てる（焚き付け/燃料は品質として自動的に効く）。
  // 「吹きすぎると消える」失敗状態は廃止。ずっと持ち続けるだけでも成功できるよう、
  // 酸素量に応じた成長効率のゆるやかな山（ベルカーブ）だけで表現する
  breath: {
    // 長押し中、1秒あたりに増加する酸素量
    blowRatePerSecond: 32,
    // 離している間、1秒あたりに減少する酸素量
    releaseDecayPerSecond: 18,
    // 成長効率が最大になる酸素量（この付近を保つと一番早く育つが、必須ではない）
    optimalOxygen: 60,
    // ベルカーブの広さ（大きいほど、外れても効率が落ちにくい＝易しい）
    bellWidth: 65,
    // 酸素量が0や100に張り付いていても最低限保証される成長効率（0.5 = 半分は必ず育つ）
    minGrowthMultiplier: 0.55,
    // 成長効率のベルカーブに掛かる基礎火力成長速度（1秒あたり。素材係数で補正される）
    fireGrowthPerSecond: 12,
    // この火力を境に、成長の主役が焚き付け(kindling)から燃料(fuel)に切り替わる
    earlyFireThreshold: 45,
    // 酸素がほぼゼロ（吹くのを完全にやめた）とみなす閾値
    neglectOxygenThreshold: 8,
    // 完全に放置しているとき、1秒あたりに減少する火力
    starveShrinkPerSecond: 4,
  },

  // PHASE: 小さな炎に、拾った焚き付け/燃料を任意でドラッグして投入できる（必須ではない）
  kindling: {
    // この火力に到達すると薪投入の演出が使えるようになる
    unlocksAtFire: 15,
    // 炎の中心からこの距離(px)以内にドロップすると受理される
    dropZoneRadius: 100,
    // タイミングが正しいときの火力ボーナス（息だけより明確に速く育つ）
    goodBoost: 16,
    // タイミングが早すぎる／太すぎるときの小さなペナルティ（消えはしない）
    badPenalty: 5,
    // 火力がこの値未満ならkindling、以上ならfuelが「正しいタイミング」
    idealSwitchFire: 55,
  },

  score: {
    weights: {
      firemaking: 20,
      materialChoice: 15,
      breathControl: 20,
      fireManagement: 15,
      survivalIQ: 15,
      time: 15,
    },
    // MATERIAL CHOICE：平均品質と役割バランス（火口+焚き付け+燃料が揃っているか）の重み
    judgementQualityWeight: 0.65,
    judgementBalanceWeight: 0.35,
    // FIREMAKING：想定される回転フェーズ所要時間(秒)。これより速いほど高得点。後戻り1回ごとに減点
    idealFrictionSeconds: 14,
    frictionPenaltyPerSecond: 3,
    resetPenalty: 12,
    // FIRE MANAGEMENT：薪を投入しなかった場合の中立点（任意行動なので大きく損はしない）
    kindlingNeutralScore: 55,
    // SURVIVAL IQ：装備と天候の相性が良かった場合のボーナス
    survivalIQBase: 55,
    survivalIQSynergyBonus: 30,
    survivalIQResetPenalty: 10,
    // TIME：日没までの残り時間の割合が多いほど高得点
    timeFullMarkRatio: 0.6, // 残り60%以上の余裕でクリアすればフルスコア
  },

  ranks: [
    { min: 0, max: 19, title: 'LOST TOURIST', jp: '都会に帰ろう' },
    { min: 20, max: 39, title: 'CAMP ROOKIE', jp: 'キャンプ初心者' },
    { min: 40, max: 59, title: 'FIRE STARTER', jp: '火おこし見習い' },
    { min: 60, max: 79, title: 'WILDERNESS SURVIVOR', jp: 'ワイルドサバイバー' },
    { min: 80, max: 94, title: 'SURVIVAL EXPERT', jp: 'サバイバルエキスパート' },
    { min: 95, max: 100, title: 'PRIMAL LEGEND', jp: '人類代表' },
  ],

  share: {
    url: 'https://survival-seven-olive.vercel.app/',
    hashtags: ['SURVIVETHENIGHT', '火おこしチャレンジ', 'サバイバル力'],
  },

  storageKey: 'survival-fire-best-time',
} as const;
