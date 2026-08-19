export type Screen = 'title' | 'field' | 'result' | 'gameover';

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
}

export interface KindlingLogEntry {
  id: string;
  goodTiming: boolean;
}

/**
 * フィールド内部の進行段階。画面遷移ではなく、同じ森の中で連続的に切り替わる。
 * 息吹き以降の炎の見た目段階（EMBER/FLAME/FIRE/CAMPFIRE）は `fire` の値から都度算出する。
 */
export type FieldPhase = 'item_selection' | 'gathering' | 'rotate' | 'breath';

export type GameOverReason = 'sunset' | 'exhausted';

export interface GameState {
  screen: Screen;
  debug: boolean;

  fieldPhase: FieldPhase;

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
  /** この時刻(epoch ms)を過ぎると日没＝タイムオーバー */
  sunsetAt: number | null;
  gameOverReason: GameOverReason | null;

  stamina: number; // 0-100。回転で消費、休むと回復。FOODで消費が減る

  heat: number; // 0-100 摩擦熱（回転で上昇）
  fire: number; // 0-100 火力（=中央の炎の大きさと同期。火種の勢いもこの値で兼ねる）
  oxygen: number; // 0-100 呼吸ゲージ
  sparked: boolean; // 火種ができたか

  rotateResetCount: number; // 火種が消えて摩擦フェーズへ戻った回数
  kindlingLog: KindlingLogEntry[]; // 薪投入の履歴（任意行動。演出とボーナススコアに使用）

  rotateMetrics: RotateMetrics;
  breathMetrics: BreathMetrics;
}

export interface ScoreBreakdown {
  firemaking: number; // 火おこし技術
  materialChoice: number; // 素材選択
  breathControl: number; // 息のコントロール
  fireManagement: number; // 薪の投入
  survivalIQ: number; // アイテム選択・天候対応
  time: number; // クリア速度
  total: number; // /100
  rank: string;
}
