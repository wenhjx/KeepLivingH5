import { describe, it, expect } from 'vitest';
import {
  calcThornsReflect,
  calcOverflowAttack,
  calcOverflowCritRate,
  calcOverflowCritDamage,
  calcOverflowMaxHealth,
  calcCritStats,
  calcFavoredDamageMult,
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
describe('calcCritStats 暴击率溢出转暴伤（1:2）', () => {
  it('无属性：默认暴击率 5%、爆伤 1.5', () => {
    expect(calcCritStats(undefined)).toEqual({ critRate: 0.05, critDamageMult: 1.5 });
  });
  it('暴击率未溢出（0.05~1.0）：爆伤不增加', () => {
    expect(calcCritStats({ critRate: 0.05, critDamage: 1.5 })).toEqual({ critRate: 0.05, critDamageMult: 1.5 });
    expect(calcCritStats({ critRate: 0.8, critDamage: 2.0 })).toEqual({ critRate: 0.8, critDamageMult: 2.0 });
    expect(calcCritStats({ critRate: 1.0, critDamage: 1.5 })).toEqual({ critRate: 1.0, critDamageMult: 1.5 });
  });
  it('溢出 20%：判定率 clamp 到 100%，爆伤 +40%（1:2）', () => {
    expect(calcCritStats({ critRate: 1.2, critDamage: 1.5 })).toEqual({ critRate: 1.0, critDamageMult: 1.9 });
  });
  it('溢出 100%：爆伤 +200%（1.5 → 3.5），判定率仍 100%', () => {
    expect(calcCritStats({ critRate: 2.0, critDamage: 1.5 })).toEqual({ critRate: 1.0, critDamageMult: 3.5 });
  });
  it('自带爆伤 + 溢出叠加（回归 2026-09-13 前 1700% 爆伤事故：倍率线性累加不指数）', () => {
    // 6 级致命一击 = 1.5 + 3.0 = 4.5；再叠加 50% 溢出 → +1.0 → 5.5
    expect(calcCritStats({ critRate: 1.5, critDamage: 4.5 })).toEqual({ critRate: 1.0, critDamageMult: 5.5 });
  });
});
describe('calcFavoredDamageMult 角色熟练系别加成', () => {
  it('无熟练系别（拓荒者）：任何武器都是 1（全均衡）', () => {
    expect(calcFavoredDamageMult(['gun'], undefined, undefined)).toBe(1);
  });
  it('武器无标签：不受加成影响', () => {
    expect(calcFavoredDamageMult(undefined, ['gun'], 1.2)).toBe(1);
  });
  it('命中熟练系别：应用伤害倍率', () => {
    expect(calcFavoredDamageMult(['gun'], ['gun'], 1.2)).toBe(1.2);
  });
  it('多标签命中其一即生效；未命中无加成', () => {
    expect(calcFavoredDamageMult(['melee', 'aoe'], ['aoe'], 1.2)).toBe(1.2);
    expect(calcFavoredDamageMult(['summon'], ['melee', 'aoe'], 1.2)).toBe(1);
  });
});
