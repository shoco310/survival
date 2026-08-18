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
      rain: 0.85,
      storm: 0.6,
    } satisfies Record<WeatherId, number>,
    // 各天候が息吹きフェーズの火力成長に与える倍率
    fireGrowthMultiplier: {
      sunny: 1.0,
      wind: 0.9, // 火が小さいうちは不利
      rain: 0.75,
      storm: 0.55,
    } satisfies Record<WeatherId, number>,
    // 強風時、火力がこの値以上なら燃焼速度が逆にブーストされる
    windBoostThreshold: 50,
    windBoostMultiplier: 1.35,
    // shelter装備時、天候の悪影響をどれだけ軽減するか（0.6 = 60%軽減）
    shelterMitigation: 0.6,
  },

  equipment: {
    fire: {
      // ファイヤースターター：摩擦フェーズの初期熱と上昇速度を強化
      startingHeat: 50,
      frictionRateMultiplier: 1.5,
    },
    food: {
      // 非常食：体力を維持できるため、熱の自然減衰と再挑戦時のロスが少ない
      heatDecayMultiplier: 0.6,
      reigniteEmberBonus: 8, // 消火後、再着火時のfire初期値に加算
    },
    shelter: {
      // 簡易シェルター：weather.shelterMitigation で悪天候を軽減
    },
  },

  materials: {
    // 画面に出現しうる素材と、その燃焼/着火効率（0-100）
    pool: [
      { id: 'dryTwig', emoji: '🥢', label: '乾いた小枝', quality: 90 },
      { id: 'driedLeaves', emoji: '🍂', label: '枯れ葉', quality: 100 },
      { id: 'bark', emoji: '🪵', label: '樹皮', quality: 80 },
      { id: 'grass', emoji: '🌾', label: '草', quality: 45 },
      { id: 'wetBranch', emoji: '🌿', label: '湿った枝', quality: 25 },
      { id: 'greenWood', emoji: '🪵', label: '生木', quality: 10 },
      { id: 'stone', emoji: '🪨', label: '石', quality: 0 },
    ],
    // 1回のプレイで画面に表示する候補数
    displayCount: 7,
    // 集める素材数の範囲
    minPick: 3,
    maxPick: 5,
  },

  friction: {
    // 1スワイプ（方向転換）あたりの基礎熱上昇量
    baseSwipeGain: 7,
    // 素材品質の正規化基準（この値の品質で倍率1.0）
    qualityNormalizer: 70,
    // スワイプと判定する最小移動距離(px)
    minSwipeDistance: 18,
    // 入力が無いとき、1秒あたりに減衰する熱量
    decayPerSecond: 9,
    // 入力なしとみなすまでの猶予(ms)
    idleGraceMs: 350,
  },

  breath: {
    // 長押し中、1秒あたりに増加する酸素量
    blowRatePerSecond: 55,
    // 離している間、1秒あたりに減少する酸素量
    releaseDecayPerSecond: 32,
    // 安全ゾーン
    safeZoneMin: 40,
    safeZoneMax: 70,
    // 安全ゾーン内にいるときの火力成長速度（1秒あたり）
    fireGrowthPerSecond: 14,
    // 酸素不足（safeZoneMin未満）のとき、火力が減少する速度
    starveShrinkPerSecond: 6,
    // 吹きすぎ状態に入ったとみなす酸素値
    overblowThreshold: 70,
    // 吹きすぎ状態がこの時間(ms)続くと警告を表示
    overblowWarningMs: 1000,
    // 吹きすぎ状態がこの時間(ms)続くと消火が始まる
    overblowDangerMs: 2200,
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
    // 火おこし技術：想定される摩擦フェーズ所要時間(秒)。これより速いほど高得点
    idealFrictionSeconds: 7,
    frictionPenaltyPerSecond: 6,
    // 火の管理：消火1回につき減点する割合(0-100点満点中)
    managementPenaltyPerExtinguish: 18,
    // スピード：この秒数以内ならフルスコア、以降1秒ごとに減点
    speedFullMarkSeconds: 45,
    speedPenaltyPerSecond: 1.1,
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
    hashtags: ['火おこしチャレンジ', 'サバイバル力'],
  },

  storageKey: 'survival-fire-best-time',
} as const;
