export type Screen = 'start' | 'gather' | 'friction' | 'breath' | 'result';

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

export interface FrictionMetrics {
  startedAt: number;
  finishedAt: number | null;
}

export interface BreathMetrics {
  totalTicks: number;
  safeZoneTicks: number;
  extinguishCount: number;
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

  heat: number; // 0-100 friction gauge
  fire: number; // 0-100 fire strength
  oxygen: number; // 0-100 breathing gauge
  sparked: boolean; // ember created via friction

  frictionMetrics: FrictionMetrics;
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
