import { WEAPONS } from "../data/weapons";
import { SUPER_WEAPONS } from "../data/superWeapons";
import { EventBus } from "./EventBus";
import type { Player } from "../entities/Player";
import type { UpgradeOption } from "../types";

/**
 * 应用升级选项到玩家（统一入口）
 * 升级场景（UpgradeScene）与调试面板（DebugPanel）共用，
 * 确保调试面板能添加/触发与游戏中完全一致的全部升级选项。
 *
 * 覆盖 UPGRADE_OPTIONS 的三种类型：
 *   - stat：属性升级（modifyStat）
 *   - weapon：武器获取/升级（addWeapon）
 *   - passive：被动技能（addPassive）
 *
 * 兜底项（FALLBACK_UPGRADES）走 onApply 自定义逻辑（金币/治疗/狂暴/清屏）。
 */
export function applyUpgradeToPlayer(
  player: Player,
  option: UpgradeOption,
  scene?: any,
): void {
  // 兜底项/特殊项：自定义应用逻辑优先
  if (option.onApply) {
    option.onApply(player, scene);
    return;
  }

  const effect = option.effect;

  // 属性升级（并记录 stat 升级次数，满级后不再出现在候选池）
  if (effect.stat && effect.value !== undefined) {
    // 满级保护：已达 maxLevel 的 stat 不再应用（防止任何入口——升级/商店/调试面板——突破上限）
    if (option.maxLevel && player.isStatMaxLevel(option.id, option.maxLevel)) {
      return;
    }
    player.modifyStat(effect.stat, effect.value, effect.isPercent);
    if (option.maxLevel) {
      player.recordStatUpgrade(option.id, option.name, option.maxLevel);
    }
  }

  // 武器升级/获取
  if (effect.weaponId) {
    const weaponConfig = WEAPONS[effect.weaponId];
    if (weaponConfig) {
      player.addWeapon(weaponConfig);
    }
  }

  // 被动技能
  if (option.type === "passive") {
    player.addPassive(option.id, option.name, option.maxLevel ?? 5);
  }

  // 超武进化检测（武器满级 + 辅助升级满级组合达成即进化）
  trySuperEvolve(player, scene);
}

/** 检查超武进化条件（每局每组合仅一次）；导出供场景加载后补检 */
export function trySuperEvolve(player: Player, scene?: any): void {
  for (const cfg of Object.values(SUPER_WEAPONS)) {
    if (player.hasSuper(cfg.id)) continue;
    const weaponOk = player.isWeaponMaxLevel(cfg.weaponId);
    // 辅助升级：属性升级（stat）或被动（passive）任一达满级即可
    const statOk =
      player.getStatUpgradeLevel(cfg.requiredUpgradeId) >= cfg.requiredUpgradeMax;
    const passiveLevel =
      player.getPassives().find((p) => p.id === cfg.requiredUpgradeId)?.level ?? 0;
    const upgradeOk = statOk || passiveLevel >= cfg.requiredUpgradeMax;
    if (weaponOk && upgradeOk) {
      player.evolveSuper(cfg.id);
      EventBus.emit("super:evolved", cfg);
    }
  }
}
