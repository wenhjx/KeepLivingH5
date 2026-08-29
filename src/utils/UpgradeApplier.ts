import { WEAPONS } from '../data/weapons';
import type { Player } from '../entities/Player';
import type { UpgradeOption } from '../types';

/**
 * 应用升级选项到玩家（统一入口）
 * 升级场景（UpgradeScene）与调试面板（DebugPanel）共用，
 * 确保调试面板能添加/触发与游戏中完全一致的全部升级选项。
 *
 * 覆盖 UPGRADE_OPTIONS 的三种类型：
 *   - stat：属性升级（modifyStat）
 *   - weapon：武器获取/升级（addWeapon）
 *   - passive：被动技能（addPassive）
 */
export function applyUpgradeToPlayer(player: Player, option: UpgradeOption): void {
  const effect = option.effect;

  // 属性升级
  if (effect.stat && effect.value !== undefined) {
    player.modifyStat(effect.stat, effect.value, effect.isPercent);
  }

  // 武器升级/获取
  if (effect.weaponId) {
    const weaponConfig = WEAPONS[effect.weaponId];
    if (weaponConfig) {
      player.addWeapon(weaponConfig);
    }
  }

  // 被动技能
  if (option.type === 'passive') {
    player.addPassive(option.id, option.name, 5);
  }
}
