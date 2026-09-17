import type { WeaponConfig } from "../types";

/**
 * 超武进化注册表（Vampire Survivors 式合成）
 *
 * 规则：源武器满级 + 指定辅助升级满级 → 武器自动进化为超武（每局每组合仅一次）
 * 条件在 conditionDesc 中明确展示（玩家可见），凑齐需要三选一/商店的机缘。
 * 进化后 fireWeapon 应用 override 属性覆盖（伤害/射速/弹数/穿透等）。
 */
export interface SuperWeaponConfig {
  id: string;
  /** 源武器 id（data/weapons.ts 键） */
  weaponId: string;
  /** 需求辅助升级 id（data/upgrades.ts 的 stat 升级 id） */
  requiredUpgradeId: string;
  /** 需求辅助升级的满级值（stat 达此等级即满足条件） */
  requiredUpgradeMax: number;
  name: string;
  sourceName: string;
  /** 超武级别（独立于普通稀有度，buff栏排序用，高于传说级） */
  rarity: "super";
  icon: string;
  /** 合成条件描述（玩家可见，图鉴/提示展示） */
  conditionDesc: string;
  /** 进化后效果描述 */
  effectDesc: string;
  /** 进化后对源武器的属性覆盖（fireWeapon 时应用） */
  override?: Partial<WeaponConfig> & {
    bulletColor?: number;
    scatter?: boolean;
    scatterArc?: number;
    bulletScaleY?: number;
  };
}

export const SUPER_WEAPONS: Record<string, SuperWeaponConfig> = {
  super_gunstorm: {
    id: "super_gunstorm",
    weaponId: "default_gun",
    requiredUpgradeId: "crit_rate",
    requiredUpgradeMax: 5,
    name: "无限弹幕",
    rarity: "super",
    sourceName: "冲锋枪",
    icon: "🌀",
    conditionDesc: "冲锋枪满级 + 暴击精通满级",
    effectDesc: "弹幕数量 ×3、射速大幅提升",
    override: {
      projectileCount: 6,
      attackSpeed: 6,
      damage: 20,
      projectileSpeed: 900,
      bulletColor: 0xffd700,
      scatter: true,
      scatterArc: 1.1,
    },
  },
  super_storm: {
    id: "super_storm",
    weaponId: "machine_gun",
    requiredUpgradeId: "attack_speed",
    requiredUpgradeMax: 5,
    name: "风暴突突",
    rarity: "super",
    sourceName: "机枪",
    icon: "🌪️",
    conditionDesc: "机枪满级 + 急速满级",
    effectDesc: "直线光束弹幕墙：双管平行、超高射速、子弹穿透",
    override: {
      attackSpeed: 14,
      projectileCount: 2,
      damage: 8,
      spread: 0.04,
      pierce: true,
      bulletColor: 0x7ec8ff,
      bulletScaleY: 3,
    },
  },
  super_chain_scatter: {
    id: "super_chain_scatter",
    weaponId: "shotgun",
    requiredUpgradeId: "passive_bounce",
    requiredUpgradeMax: 3,
    name: "链式散射",
    rarity: "super",
    sourceName: "霰弹枪",
    icon: "💥",
    conditionDesc: "霰弹枪满级 + 弹射满级",
    effectDesc: "弹片扇形爆发并弹射至附近敌人（70% 伤害）",
    override: {
      projectileCount: 8,
      damage: 12,
      knockback: 120,
      spread: 0.45,
      bulletColor: 0xff9a5e,
    },
  },
};

/** 按源武器索引（fireWeapon 查询） */
export function getSuperByWeapon(
  weaponId: string,
): SuperWeaponConfig | undefined {
  return Object.values(SUPER_WEAPONS).find((s) => s.weaponId === weaponId);
}
