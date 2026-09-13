/**
 * 词缀/敌人战斗结算（纯函数，可单测，零 Phaser 依赖）
 *
 * 覆盖：剧毒持续伤害、爆炸（基础/玩家衰减）、吸血回复、敌人普攻/冲锋伤害。
 * 调用方：Enemy（affixPoison / explode / attackPlayer）。
 * 数值与实现逐字一致——改动公式先改这里 + 测试，业务模块禁止内联。
 */

/** 剧毒：每秒中毒伤害 = max(1, 攻击力 × 难度系数 × dpsMult)，至少 1 点 */
export function calcPoisonDps(attackPower: number, difficultyMultiplier: number, dpsMult: number): number {
  return Math.max(1, attackPower * difficultyMultiplier * dpsMult);
}

/** 爆炸基础伤害 = 基础值 × 难度系数 × 攻击加成（explodeDamage 缺省 30 由调用方兜底） */
export function calcExplodeBase(baseDamage: number, difficultyMultiplier: number, atkBoost: number): number {
  return baseDamage * difficultyMultiplier * atkBoost;
}

/**
 * 爆炸对玩家伤害：基础伤害 × 距离衰减，下限 1 点
 * falloff = 1 - max(0, 玩家距离/半径) × 0.5；超半径后 falloff 归零/为负 → 由 max(1, …) 兜底
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

/** 吸血：回复 = min(最大生命, 当前生命 + max(1, floor(伤害 × 吸血倍率)))——至少回 1 点，不超上限 */
export function calcLifestealHeal(
  currentHealth: number,
  maxHealth: number,
  damage: number,
  lifestealMult: number
): number {
  return Math.min(maxHealth, currentHealth + Math.max(1, Math.floor(damage * lifestealMult)));
}

/** 敌人普攻/冲锋：攻击力 × Boss倍率 × 冲锋倍率 × 难度系数 × 攻击加成 × 词缀攻击加成（各倍率缺省 1） */
export function calcAttackDamage(
  attackPower: number,
  difficultyMultiplier: number,
  opts: { bossMult?: number; chargeMult?: number; atkBoost?: number; affixAtkBoost?: number } = {}
): number {
  return (
    attackPower *
    (opts.bossMult ?? 1) *
    (opts.chargeMult ?? 1) *
    difficultyMultiplier *
    (opts.atkBoost ?? 1) *
    (opts.affixAtkBoost ?? 1)
  );
}
