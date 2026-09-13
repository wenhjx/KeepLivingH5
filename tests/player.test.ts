import { describe, it, expect } from 'vitest';
import {
  calcThornsReflect,
  calcOverflowAttack,
  calcOverflowCritRate,
  calcOverflowCritDamage,
  calcOverflowMaxHealth,
} from '../src/logic/player';

describe('calcThornsReflect 荆棘反弹', () => {
  it('伤害 × (0.2 + 等级 × 0.05)', () => {
    expect(calcThornsReflect(100, 1)).toBeCloseTo(25, 10); // 100 × 0.25
    expect(calcThornsReflect(100, 2)).toBeCloseTo(30, 10); // 100 × 0.30
    expect(calcThornsReflect(100, 5)).toBeCloseTo(45, 10); // 100 × 0.45
  });

  it('等级 0（未学习）：0.2 倍率（调用方已有 >0 判断，函数本身纯计算）', () => {
    expect(calcThornsReflect(100, 0)).toBe(20);
  });

  it('浮点伤害保持精度', () => {
    expect(calcThornsReflect(37.5, 3)).toBeCloseTo(37.5 * 0.35, 10);
  });
});

describe('超限强化（线性化，2026-09-13 收敛）', () => {
  it('攻击：+3 固定值（替代 ×1.03 指数）', () => {
    expect(calcOverflowAttack(10)).toBe(13);
    expect(calcOverflowAttack(1210)).toBe(1213); // n=1600 轮后仍线性
  });

  it('暴击率：+1%（0.01，保持原设计）', () => {
    expect(calcOverflowCritRate(0.05)).toBeCloseTo(0.06, 10);
    expect(calcOverflowCritRate(1)).toBeCloseTo(1.01, 10);
  });

  it('暴伤：+0.5%（0.005 倍率，替代 +3%）', () => {
    expect(calcOverflowCritDamage(1.5)).toBeCloseTo(1.505, 10);
    expect(calcOverflowCritDamage(3)).toBeCloseTo(3.005, 10);
  });

  it('生命：+20 取整（替代 ×1.05）', () => {
    expect(calcOverflowMaxHealth(100)).toBe(120);
    expect(calcOverflowMaxHealth(99.4)).toBe(119); // floor
  });
});
