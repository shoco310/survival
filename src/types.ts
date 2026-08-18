export type Screen = 'start' | 'gather' | 'friction' | 'breath' | 'result';

export type EquipmentId = 'fire' | 'food' | 'shelter';

export type WeatherId = 'sunny' | 'wind' | 'rain' | 'storm';

export interface Material {
  id: string;
  emoji: string;
  label: string;
  /** 燃焼/着火効率 0-100。摩擦フェーズの熱上昇速度と判断力スコアに使われる */
  quality: number;
}

export interface GatherLogEntry {
  materialId: string;
  quality: number;
}

export interface FrictionMetrics {
  startedAt: number;
  finishedAt: number | null;
  decayEvents: number;
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

  materialsPool: Material[];
  collectedMaterials: GatherLogEntry[];

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
