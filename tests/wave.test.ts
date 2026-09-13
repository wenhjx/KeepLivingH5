import { describe, it, expect } from 'vitest';
import { waveDifficulty, bossDifficulty } from '../src/logic/wave';

describe('waveDifficulty 小怪难度系数', () => {
  it('1 + (wave-1)×0.1', () => {
    expect(waveDifficulty(1)).toBe(1);
    expect(waveDifficulty(5)).toBeCloseTo(1.4, 10);
    expect(waveDifficulty(10)).toBeCloseTo(1.9, 10);
    expect(waveDifficulty(20)).toBeCloseTo(2.9, 10);
  });
});

describe('bossDifficulty Boss 难度系数', () => {
  it('按 Boss 波间隔指数成长：第5波 ×1.0 / 第10波 ×1.5 / 第15波 ×2.25', () => {
    expect(bossDifficulty(5, 5)).toBeCloseTo(1, 10);
    expect(bossDifficulty(10, 5)).toBeCloseTo(1.5, 10);
    expect(bossDifficulty(15, 5)).toBeCloseTo(2.25, 10);
  });

  it('档内平滑：wave 7 → 1.5^0.4 ≈ 1.176', () => {
    expect(bossDifficulty(7, 5)).toBeCloseTo(Math.pow(1.5, 0.4), 10);
  });

  it('未到首波钳制 ×1.0（wave 1-4）', () => {
    expect(bossDifficulty(1, 5)).toBe(1);
    expect(bossDifficulty(4, 5)).toBe(1);
  });

  it('interval 缺省为 5', () => {
    expect(bossDifficulty(10)).toBeCloseTo(1.5, 10);
  });
});
