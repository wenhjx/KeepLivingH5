import { describe, it, expect } from 'vitest';
import { passiveLevelTexts, passiveDescForLevel } from '../src/data/upgrades';
describe('passiveLevelTexts 等级化描述（公式与代码实现一致）', () => {
  it('生命恢复：每秒恢复 1+level 点', () => {
    expect(passiveLevelTexts('passive_regen', 1)).toEqual({ current: '每秒恢复 2 点生命', next: '每秒恢复 3 点生命' });
    expect(passiveLevelTexts('passive_regen', 5)).toEqual({ current: '每秒恢复 6 点生命', next: '每秒恢复 7 点生命' });
  });
  it('荆棘：反弹 20+level*5 % 伤害', () => {
    expect(passiveLevelTexts('passive_thorns', 0)).toEqual({ current: '受击反弹 20% 伤害', next: '受击反弹 25% 伤害' });
    expect(passiveLevelTexts('passive_thorns', 2)).toEqual({ current: '受击反弹 30% 伤害', next: '受击反弹 35% 伤害' });
  });
  it('经验加成：25+level*10 %', () => {
    expect(passiveLevelTexts('passive_exp_boost', 1)).toEqual({ current: '获得经验 +35%', next: '获得经验 +45%' });
    expect(passiveLevelTexts('passive_exp_boost', 4)).toEqual({ current: '获得经验 +65%', next: '获得经验 +75%' });
  });
  it('金币加成：50+level*10 %（Lv.1 即 60%）', () => {
    expect(passiveLevelTexts('passive_gold_boost', 1)).toEqual({ current: '获得金币 +60%', next: '获得金币 +70%' });
    expect(passiveLevelTexts('passive_gold_boost', 3)).toEqual({ current: '获得金币 +80%', next: '获得金币 +90%' });
  });
  it('吸血：回复 level*3 % 伤害', () => {
    expect(passiveLevelTexts('passive_lifesteal', 2)).toEqual({ current: '攻击回复 6% 伤害', next: '攻击回复 9% 伤害' });
  });
  it('冰冻：概率 level*8 %，减速 2 秒', () => {
    expect(passiveLevelTexts('passive_freeze', 1)).toEqual({ current: '冰冻概率 8%（减速 2 秒）', next: '冰冻概率 16%（减速 2 秒）' });
  });
  it('灼烧：概率 level*15 %', () => {
    expect(passiveLevelTexts('passive_burn', 1)).toEqual({ current: '点燃概率 15%', next: '点燃概率 30%' });
  });
  it('闪电链：概率 level*10 %', () => {
    expect(passiveLevelTexts('passive_chain', 3)).toEqual({ current: '闪电链概率 30%', next: '闪电链概率 40%' });
  });
  it('弹射：level 次，70% 伤害（与 amount*0.7 一致）', () => {
    expect(passiveLevelTexts('passive_bounce', 1)).toEqual({ current: '弹射 1 次（70% 伤害）', next: '弹射 2 次（70% 伤害）' });
  });
  it('未知 id 返回 null', () => {
    expect(passiveLevelTexts('passive_unknown', 1)).toBeNull();
  });
});
describe('passiveDescForLevel', () => {
  it('有等级化文案时返回当前级', () => {
    expect(passiveDescForLevel('passive_gold_boost', 2, 'fallback')).toBe('获得金币 +70%');
  });
  it('无等级化文案时返回 fallback', () => {
    expect(passiveDescForLevel('some_other_upgrade', 1, 'fallback-text')).toBe('fallback-text');
  });
});
