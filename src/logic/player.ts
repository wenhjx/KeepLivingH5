import type { WeaponTag } from '../types';
/**
 * 玩家侧被动/属性结算（纯函数，可单测，零 Phaser 依赖）
 *
 * 覆盖：荆棘反弹、超限强化四件套。
 * 数值与实现逐字一致——改动公式先改这里 + 测试。
 */

/** 荆棘反弹 = 实际受击伤害 × (0.2 + 荆棘等级 × 0.05) */
export function calcThornsReflect(actualDamage: number, thornsLevel: number): number {
  return actualDamage * (0.2 + thornsLevel * 0.05);
}

/**
 * 超限强化（满级后经验条循环触发，每 4 轮轮换一次）：
 * 攻击 +3 → 暴击率 +1% → 暴伤 +0.5% → 生命 +20
 * 2026-09-13 收敛：原 ×1.03 / +3% / ×1.05 为乘算指数，挂机 n 轮后攻击可达 136 万（n=1600），
 * 全部改为线性固定值，永不指数爆炸。
 */

/** 超限攻击强化：+3（线性） */
export function calcOverflowAttack(attackPower: number): number {
  return attackPower + 3;
}

/** 超限暴击率强化：+1%（线性，保持原设计，0.05 = 5%） */
export function calcOverflowCritRate(critRate: number): number {
  return critRate + 0.01;
}

/** 超限暴伤强化：+0.5%（线性，倍率单位 1.5 = 150%） */
export function calcOverflowCritDamage(critDamage: number): number {
  return critDamage + 0.005;
}

/** 超限生命强化：+20（线性，取整） */
export function calcOverflowMaxHealth(maxHealth: number): number {
  return Math.floor(maxHealth + 20);
}

/**
 * 暴击结算（确定性部分）：
 * critRate 超过 100% 的部分按 1:2 转暴击伤害（每 1% 溢出 → +2% 爆伤），
 * 判定率 clamp 到 100%（溢出后必定暴击）。
 * 返回 clamp 后的判定率与最终暴击伤害倍率；是否暴击由调用处 Math.random() 判定。
 */
export interface CritStats {
  critRate?: number;
  critDamage?: number;
}

export function calcCritStats(stats: CritStats | undefined): { critRate: number; critDamageMult: number } {
  const rawCritRate = stats?.critRate ?? 0.05;
  const critRateOverflow = Math.max(0, rawCritRate - 1);
  const critRate = Math.min(1, rawCritRate);
  const critDamageMult = (stats?.critDamage ?? 1.5) + critRateOverflow * 2;
  return { critRate, critDamageMult };
}

/**
 * 角色熟练系别武器加成：武器任一系别命中角色熟练系别 → 应用伤害倍率（默认 1 = 全均衡）。
 * 无熟练系别（拓荒者）、武器无标签或未命中 → 1（不受影响）。
 */
export function calcFavoredDamageMult(
  weaponTags: WeaponTag[] | undefined,
  favoredTags: WeaponTag[] | undefined,
  damageMult: number | undefined,
): number {
  if (!weaponTags || weaponTags.length === 0 || !favoredTags || favoredTags.length === 0 || !damageMult) return 1;
  return favoredTags.some((t) => weaponTags.includes(t)) ? damageMult : 1;
}
