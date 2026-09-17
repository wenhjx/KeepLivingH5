import { describe, it, expect } from 'vitest';
import {
  calcPoisonDps,
  calcExplodeBase,
  calcExplodePlayerDamage,
  calcLifestealHeal,
  calcAttackDamage,
} from '../src/logic/affix';
describe('calcPoisonDps 剧毒每秒伤害', () => {
  it('基础公式：攻击力 × 难度系数 × dpsMult（venom 为 0.08）', () => {
    expect(calcPoisonDps(100, 1, 0.08)).toBe(8);
    expect(calcPoisonDps(50, 1, 0.08)).toBe(4);
    expect(calcPoisonDps(100, 1, 0.5)).toBe(50);
  });
  it('随波次难度成长（wave 20 → 难度系数 2.9）', () => {
    expect(calcPoisonDps(100, 2.9, 0.08)).toBeCloseTo(23.2, 10);
  });
  it('下限保护：计算结果小于 1 时至少造成 1 点伤害', () => {
    expect(calcPoisonDps(1, 1, 0.08)).toBe(1);
    expect(calcPoisonDps(0, 1, 0.08)).toBe(1);
    expect(calcPoisonDps(100, 1, 0.001)).toBe(1);
  });
  it('浮点精度：小数结果按乘法精确保留', () => {
    expect(calcPoisonDps(7, 1.3, 0.3)).toBeCloseTo(2.73, 10);
    expect(calcPoisonDps(37, 1.5, 0.08)).toBeCloseTo(4.44, 10);
  });
});
describe('calcExplodeBase 爆炸基础伤害', () => {
  it('基础值 × 难度系数 × 攻击加成', () => {
    expect(calcExplodeBase(30, 1, 1)).toBe(30);
    expect(calcExplodeBase(30, 2.9, 1)).toBe(87); // wave 20 难度
    expect(calcExplodeBase(30, 1, 1.5)).toBe(45); // 攻击加成
    expect(calcExplodeBase(30, 2.9, 1.5)).toBe(130.5);
  });
});
describe('calcExplodePlayerDamage 爆炸对玩家伤害（含距离衰减）', () => {
  const base = 30;
  it('贴脸（距离 0）：无衰减，全额', () => {
    expect(calcExplodePlayerDamage(base, 1, 1, 0, 60)).toBe(30);
  });
  it('半径边缘（距离=半径）：衰减至 50%', () => {
    expect(calcExplodePlayerDamage(base, 1, 1, 60, 60)).toBe(15);
    expect(calcExplodePlayerDamage(base, 2.9, 1, 60, 60)).toBeCloseTo(43.5, 10);
  });
  it('半程（距离=半径一半）：衰减 25%', () => {
    expect(calcExplodePlayerDamage(base, 1, 1, 30, 60)).toBeCloseTo(22.5, 10);
  });
  it('超半径后兜底为 1 点（falloff 归零/为负也不致 0 或负数）', () => {
    expect(calcExplodePlayerDamage(base, 1, 1, 120, 60)).toBe(1); // falloff = 0
    expect(calcExplodePlayerDamage(base, 1, 1, 180, 60)).toBe(1); // falloff 为负
  });
});
describe('calcLifestealHeal 吸血回复', () => {
  it('按伤害 × 倍率回复（向下取整）', () => {
    expect(calcLifestealHeal(50, 100, 100, 0.05)).toBe(55); // +5
    expect(calcLifestealHeal(50, 100, 99, 0.05)).toBe(54); // floor(4.95)=4 → +4
  });
  it('下限保护：伤害 × 倍率不足 1 时至少回 1 点', () => {
    expect(calcLifestealHeal(50, 100, 10, 0.05)).toBe(51); // floor(0.5)=0 → +1
    expect(calcLifestealHeal(50, 100, 0, 0.05)).toBe(51);
  });
  it('上限截断：不超出最大生命', () => {
    expect(calcLifestealHeal(98, 100, 100, 0.05)).toBe(100); // +5 → 103 → 截断 100
    expect(calcLifestealHeal(100, 100, 100, 0.05)).toBe(100);
  });
});
describe('calcAttackDamage 敌人普攻/冲锋', () => {
  it('基础：攻击力 × 难度系数（无倍率时全部为 1）', () => {
    expect(calcAttackDamage(10, 1)).toBe(10);
    expect(calcAttackDamage(10, 2.9)).toBe(29);
  });
  it('Boss 倍率 ×1.3 / 冲锋倍率 ×1.6 叠加', () => {
    expect(calcAttackDamage(10, 1, { bossMult: 1.3 })).toBe(13);
    expect(calcAttackDamage(10, 1, { chargeMult: 1.6 })).toBe(16);
    expect(calcAttackDamage(10, 1, { bossMult: 1.3, chargeMult: 1.6 })).toBe(20.8);
  });
  it('攻击加成与词缀攻击加成叠加', () => {
    expect(calcAttackDamage(10, 1, { atkBoost: 1.5, affixAtkBoost: 1.2 })).toBe(18);
  });
  it('全量组合与 Enemy.attackPlayer 原公式一致', () => {
    // attackPower × bossMult × chargeMult × diff × atkBoost × affixAtkBoost
    expect(calcAttackDamage(30, 2.9, { bossMult: 1.3, chargeMult: 1.6, atkBoost: 1.5, affixAtkBoost: 1.2 })).toBeCloseTo(
      30 * 1.3 * 1.6 * 2.9 * 1.5 * 1.2,
      10
    );
  });
});
