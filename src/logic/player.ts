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
