import type { EquipmentId } from './types';

export const EQUIPMENT_META: Record<EquipmentId, { emoji: string; label: string; desc: string }> = {
  fire: { emoji: '🔥', label: '火起こしキット', desc: '火を起こしやすくなる' },
  food: { emoji: '🍖', label: '非常食', desc: '体力を維持できる' },
  shelter: { emoji: '🏕️', label: '簡易シェルター', desc: '雨と風に強くなる' },
};
