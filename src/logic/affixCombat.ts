/**
 * 词缀战斗结算纯函数（可单测，零 Phaser 依赖）
 *
 * 覆盖：爆炸词缀/自爆怪伤害、吸血词缀回复。调用方：Enemy（explode / attackPlayer）。
 * 数值与实现保持逐字一致——改动任何公式前先改这里 + 测试。
 */

/** 爆炸基础伤害 = 基础值 × 难度系数 × 攻击加成（explodeDamage 缺省 30 由调用方兜底） */
export function calcExplodeBase(baseDamage: number, difficultyMultiplier: number, atkBoost: number): number {
  return baseDamage * difficultyMultiplier * atkBoost;
}

/**
 * 爆炸对玩家伤害：基础伤害 × 距离衰减，下限 1 点
 * falloff = 1 - max(0, 玩家距离/半径) × 0.5；超出半径后 falloff 可归零甚至为负 → 由 max(1, …) 兜底
 */
export function calcExplodePlayerDamage(
  baseDamage: number,
  difficultyMultiplier: number,
  atkBoost: number,
  playerDist: number,
  radius: number
): number {
  const base = calcExplodeBase(baseDamage, difficultyMultiplier, atkBoost);
  const falloff = 1 - Math.max(0, playerDist / radius) * 0.5;
  return Math.max(1, base * falloff);
}

/** 吸血词缀回复 = min(最大生命, 当前生命 + max(1, floor(伤害 × 吸血倍率)))——至少回 1 点，不超上限 */
export function calcLifestealHeal(
  currentHealth: number,
  maxHealth: number,
  damage: number,
  lifestealMult: number
): number {
  return Math.min(maxHealth, currentHealth + Math.max(1, Math.floor(damage * lifestealMult)));
}
