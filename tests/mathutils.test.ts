import { describe, it, expect } from 'vitest';
import { MathUtils } from '../src/utils/MathUtils';

describe('MathUtils 基础数学', () => {
  it('degToRad / radToDeg 互逆', () => {
    expect(MathUtils.degToRad(180)).toBeCloseTo(Math.PI, 10);
    expect(MathUtils.radToDeg(Math.PI)).toBeCloseTo(180, 10);
  });

  it('distance / distanceSq', () => {
    expect(MathUtils.distance(0, 0, 3, 4)).toBe(5);
    expect(MathUtils.distanceSq(0, 0, 3, 4)).toBe(25);
  });

  it('clamp 边界', () => {
    expect(MathUtils.clamp(5, 0, 10)).toBe(5);
    expect(MathUtils.clamp(-1, 0, 10)).toBe(0);
    expect(MathUtils.clamp(11, 0, 10)).toBe(10);
  });

  it('normalize 返回单位向量', () => {
    const v = MathUtils.normalize(3, 4);
    expect(v.x).toBeCloseTo(0.6, 10);
    expect(v.y).toBeCloseTo(0.8, 10);
    // 零向量不产生 NaN
    const z = MathUtils.normalize(0, 0);
    expect(Number.isNaN(z.x)).toBe(false);
    expect(Number.isNaN(z.y)).toBe(false);
  });

  it('lerp 线性插值', () => {
    expect(MathUtils.lerp(0, 10, 0.5)).toBe(5);
    expect(MathUtils.lerp(0, 10, 0)).toBe(0);
    expect(MathUtils.lerp(0, 10, 1)).toBe(10);
  });

  it('angleDiff 归一化到 [-PI, PI]', () => {
    expect(MathUtils.angleDiff(0, Math.PI)).toBeCloseTo(Math.PI, 10);
    expect(MathUtils.angleDiff(0, 3 * Math.PI)).toBeCloseTo(Math.PI, 10);
    expect(MathUtils.angleDiff(0, -3 * Math.PI)).toBeCloseTo(-Math.PI, 10);
    expect(MathUtils.angleDiff(Math.PI / 2, Math.PI / 2)).toBe(0);
  });

  it('randomRange 结果在区间内', () => {
    for (let i = 0; i < 200; i++) {
      const v = MathUtils.randomRange(1, 2);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(2);
    }
  });

  it('randomInt 为整数且在闭区间内', () => {
    for (let i = 0; i < 200; i++) {
      const v = MathUtils.randomInt(3, 5);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(5);
    }
  });

  it('randomChoice 从数组中取值', () => {
    const arr = ['a', 'b', 'c'];
    for (let i = 0; i < 100; i++) {
      expect(arr).toContain(MathUtils.randomChoice(arr));
    }
  });

  it('chance 在 [0,1] 内稳定返回布尔', () => {
    expect(MathUtils.chance(0)).toBe(false);
    expect(MathUtils.chance(1)).toBe(true);
    expect(typeof MathUtils.chance(0.5)).toBe('boolean');
  });
});
