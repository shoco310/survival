import type { EquipmentId } from './types';

export const EQUIPMENT_META: Record<EquipmentId, { emoji: string; label: string; desc: string }> = {
  fire: { emoji: '🔥', label: 'FIRE KIT', desc: '火を起こしやすくなる' },
  food: { emoji: '🍖', label: 'FOOD', desc: '体力を維持できる' },
  shelter: { emoji: '🏕️', label: 'SHELTER', desc: '雨と風に強くなる' },
};
