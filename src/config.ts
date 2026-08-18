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
    // shelter装備時、天候の悪影響をどれだけ軽減するか（0.6 = 60%軽減）
    shelterMitigation: 0.6,
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
    gainPerSecondRain: 3.5,
    gainPerSecondStorm: 8,
    dryPerSecond: 3, // 雨が止んでいる間に乾いていく速度
    max: 100,
    // wetSensitiveな素材が、湿度maxのときに失う効果の割合（0.5 = 最大50%減）
    qualityPenaltyAtMax: 0.55,
  },

  // タイムプレッシャー演出：経過時間による夜の暗さ（0=明るい,1=真っ暗に近い）
  nightCycle: {
    breakpoints: [
      { atSeconds: 0, darkness: 0.05 },
      { atSeconds: 60, darkness: 0.32 },
      { atSeconds: 120, darkness: 0.6 },
      { atSeconds: 180, darkness: 0.82 },
    ],
    // 天候による追加の暗さ
    rainExtraDarkness: 0.12,
    stormExtraDarkness: 0.26,
    maxDarkness: 0.88,
  },

  equipment: {
    fire: {
      // ファイヤースターター：摩擦フェーズの初期熱と上昇速度を強化
      startingHeat: 45,
      frictionRateMultiplier: 1.45,
    },
    food: {
      // 非常食：体力を維持できるため、熱の自然減衰と再挑戦時のロスが少ない
      heatDecayMultiplier: 0.6,
      reigniteEmberBonus: 8, // 消火後、再着火時のfire初期値に加算
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

  friction: {
    // 1スワイプ（方向転換）あたりの基礎熱上昇量
    baseSwipeGain: 5,
    // 火口(tinder)品質の正規化基準（この値で係数1.0）
    tinderNormalizer: 70,
    // スワイプと判定する最小移動距離(px)
    minSwipeDistance: 18,
    // 入力が無いとき、1秒あたりに減衰する熱量
    decayPerSecond: 10,
    // 入力なしとみなすまでの猶予(ms)
    idleGraceMs: 350,
  },

  breath: {
    // 長押し中、1秒あたりに増加する酸素量
    blowRatePerSecond: 50,
    // 離している間、1秒あたりに減少する酸素量
    releaseDecayPerSecond: 34,
    // 安全ゾーン
    safeZoneMin: 40,
    safeZoneMax: 70,
    // 安全ゾーン内にいるときの基礎火力成長速度（1秒あたり。素材係数で補正される）
    fireGrowthPerSecond: 11,
    // この火力を境に、成長の主役が焚き付け(kindling)から燃料(fuel)に切り替わる
    earlyFireThreshold: 45,
    // 酸素不足（10%未満）のとき、火力が減少する速度
    starveShrinkPerSecond: 6,
    // 吹きすぎ状態に入ったとみなす酸素値
    overblowThreshold: 70,
    // 吹きすぎ状態がこの時間(ms)続くと警告を表示
    overblowWarningMs: 900,
    // 吹きすぎ状態がこの時間(ms)続くと消火が始まる
    overblowDangerMs: 2000,
    // 消火時の火力減少速度（1秒あたり）
    extinguishShrinkPerSecond: 70,
    // 消火後、再着火時のfireの初期値（食料ボーナスが加算される）
    emberRestartFire: 4,
    // 火種の初期値（摩擦フェーズ完了直後）
    initialEmberFire: 5,
  },

  score: {
    weights: {
      judgement: 30,
      technique: 25,
      management: 25,
      speed: 20,
    },
    // 判断力：平均品質と役割バランス（火口+焚き付け+燃料が揃っているか）の重み
    judgementQualityWeight: 0.65,
    judgementBalanceWeight: 0.35,
    // 火おこし技術：想定される摩擦フェーズ所要時間(秒)。これより速いほど高得点
    idealFrictionSeconds: 10,
    frictionPenaltyPerSecond: 5,
    // 火の管理：消火1回につき減点する割合(0-100点満点中)
    managementPenaltyPerExtinguish: 18,
    // スピード：この秒数以内ならフルスコア、以降1秒ごとに減点
    speedFullMarkSeconds: 50,
    speedPenaltyPerSecond: 0.9,
  },

  ranks: [
    { min: 0, max: 29, title: '都会に帰ろう' },
    { min: 30, max: 49, title: 'キャンプ初心者' },
    { min: 50, max: 69, title: 'サバイバー' },
    { min: 70, max: 84, title: 'ワイルドサバイバー' },
    { min: 85, max: 94, title: 'サバイバルマスター' },
    { min: 95, max: 100, title: '人類代表' },
  ],

  share: {
    url: 'https://survival-seven-olive.vercel.app/',
    hashtags: ['SURVIVETHENIGHT', '火おこしチャレンジ', 'サバイバル力'],
  },

  storageKey: 'survival-fire-best-time',
} as const;
