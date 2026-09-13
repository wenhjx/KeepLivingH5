import { describe, it, expect } from 'vitest';
import { calcExplodeBase, calcExplodePlayerDamage, calcLifestealHeal } from '../src/logic/affixCombat';

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
