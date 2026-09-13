/**
 * 玩家侧被动/属性结算（纯函数，可单测，零 Phaser 依赖）
 *
 * 覆盖：荆棘反弹。调用方：Player（takeDamage 内被动分支）。
 * 数值与实现逐字一致——改动公式先改这里 + 测试。
 */

/** 荆棘反弹 = 实际受击伤害 × (0.2 + 荆棘等级 × 0.05) */
export function calcThornsReflect(actualDamage: number, thornsLevel: number): number {
  return actualDamage * (0.2 + thornsLevel * 0.05);
}
