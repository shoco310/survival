export type Screen = 'start' | 'gather' | 'firepit' | 'result';

export type EquipmentId = 'fire' | 'food' | 'shelter';

export type WeatherId = 'sunny' | 'wind' | 'rain' | 'storm';

export type MaterialRole = 'tinder' | 'kindling' | 'fuel';

export interface Material {
  id: string;
  emoji: string;
  label: string;
  /** その役割の中での燃焼/着火効率 0-100 */
  quality: number;
  role: MaterialRole;
  /** 雨・豪雨で時間経過とともに効果が落ちるか */
  wetSensitive: boolean;
}

export interface RoleAggregate {
  count: number;
  quality: number;
}

export type RoleAggregates = Record<MaterialRole, RoleAggregate>;

export interface WeatherEvent {
  atSeconds: number;
  next: WeatherId;
}

export interface RotateMetrics {
  startedAt: number;
  finishedAt: number | null;
}

export interface BreathMetrics {
  totalTicks: number;
  safeZoneTicks: number;
  extinguishCount: number;
}

/** 火おこし工程内の段階。中央のビジュアルステージがこの段階に応じて変化する */
export type FirePhase = 'rotate' | 'breath' | 'fuel' | 'success';

export interface FuelLogEntry {
  id: string;
  role: MaterialRole;
  goodTiming: boolean;
}

export interface GameState {
  screen: Screen;
  debug: boolean;

  equipment: EquipmentId | null;
  weather: WeatherId;
  weatherTimeline: WeatherEvent[];
  weatherEventIndex: number;

  gustNextAt: number;
  gustUntil: number;
  lightningNextAt: number;
  lightningUntil: number;
  wetness: number; // 0-100

  materialsPool: Material[];
  collectedMaterials: Material[];

  startTime: number | null;
  finishTime: number | null;

  firePhase: FirePhase;
  heat: number; // 0-100 摩擦熱（回転で上昇）
  emberPower: number; // 0-100 火種の勢い（放置で減衰、0で摩擦フェーズへ後戻り）
  fire: number; // 0-100 火力（=中央の炎の大きさと同期）
  oxygen: number; // 0-100 呼吸ゲージ
  sparked: boolean; // 火種ができたか

  rotateResetCount: number; // 火種が消えて摩擦フェーズへ戻った回数
  fuelLog: FuelLogEntry[]; // 薪投入の履歴（順序評価・スコアに使用）
  fuelMistakes: number; // 投入タイミングを誤った回数

  rotateMetrics: RotateMetrics;
  breathMetrics: BreathMetrics;

  overblowWarning: boolean;
}

export interface ScoreBreakdown {
  judgement: number; // 判断力 /30
  technique: number; // 火おこし技術 /25
  management: number; // 火の管理 /25
  speed: number; // スピード /20
  total: number; // /100
  rank: string;
}
