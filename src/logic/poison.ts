/**
 * 剧毒词缀伤害结算（纯函数，可单测）
 *
 * 每秒中毒伤害 = max(1, 攻击力 × 难度系数 × dpsMult)，至少 1 点；
 * 持续时长由词缀配置决定（venom: 3000ms），此处只负责每秒伤害计算。
 * 调用方：Enemy 命中玩家时（Enemy.ts affixPoison 分支）。
 */
export function calcPoisonDps(attackPower: number, difficultyMultiplier: number, dpsMult: number): number {
  return Math.max(1, attackPower * difficultyMultiplier * dpsMult);
}
