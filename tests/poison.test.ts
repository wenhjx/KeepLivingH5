import { describe, it, expect } from 'vitest';
import { calcPoisonDps } from '../src/logic/poison';

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
