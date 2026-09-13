import { describe, it, expect } from 'vitest';
import { calcThornsReflect } from '../src/logic/player';

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
